import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate, useRevalidator } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"; 
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  Badge, Box, Divider, Tabs, DataTable, Select, TextField, Banner, Grid, Icon
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

// --- 1. THE RULE SET ---
const INITIAL_GLOBAL_LINKS = [
  { key: "global_all_stones", url: "/collections/all", label: "All Stones" },
  { key: "global_all_tales", url: "/pages/tails-and-trails", label: "All Tales" }
];

const INITIAL_HARDWARE_LINKS = [
  { key: "hardware_build_your_setting", url: "/pages/build-your-setting", label: "Build Your Setting" }
];

const COLLECTION_RULES = {
  "richardsons-rock-ranch": {
    name: "Richardson's Rock Ranch",
    links: [
      { url: "/pages/the-richardson-strike", label: "The Richardson Strike" },
      { url: "/collections/richardsons-rock-ranch", label: "Richardson's Collection" },
      { url: "/pages/the-3-000-mile-run", label: "The 3,000-Mile Run" },
      { url: "/collections/the-3-000-mile-run-1", label: "3,000-Mile Run Collection" }
    ]
  },
  "the-shopped-rock": {
    name: "The Shopped Rock",
    links: [
      { url: "/pages/the-shopped-rock", label: "The Shopped Rock" },
      { url: "/collections/the-shopped-rock", label: "Shopped Rock Collection" }
    ]
  },
  "the-spokane-river-collection": {
    name: "Spokane River",
    links: [
      { url: "/pages/the-rufus-protocol", label: "The Rufus Protocol" },
      { url: "/collections/the-spokane-river-collection", label: "Spokane River Collection" }
    ]
  },
  "the-yellowstone-river-collection": {
    name: "Yellowstone",
    links: [
      { url: "/pages/day-7-yellowstone-sun-enters", label: "Day 7 — Yellowstone Sun Enters" },
      { url: "/collections/the-yellowstone-river-collection", label: "Yellowstone River Collection" },
      { url: "/pages/the-3-000-mile-run", label: "The 3,000-Mile Run" },
      { url: "/collections/the-3-000-mile-run-1", label: "3,000-Mile Run Collection" },
      { url: "/pages/the-shop-lore-spencer-opal-mine-sox-the-manx", label: "Sox — The Yellowstone Highway" }
    ]
  }
};

// --- 3. EVALUATION ENGINE (Hoisted for Loader use) ---
function extractLinks(html) {
  if (!html) return [];
  const regex = /href=["']([^"']*)["']/gi;
  const links = [];
  let match;
  while ((match = regex.exec(html)) !== null) links.push(match[1]);
  return links;
}

function checkLinkPresence(htmlLinks, requiredUrl) {
  return htmlLinks.some(h => h.includes(requiredUrl));
}

function evaluateProducts(products, livePaths, currentGlobalLinks, currentHardwareLinks) {
  return products.map(product => {
    const htmlLinks = extractLinks(product.descriptionHtml);
    const required = [];
    const missing = [];
    const present = [];
    const isHardware = product.tags && product.tags.includes("hardware");

    if (isHardware) {
      currentHardwareLinks.forEach(link => {
        if (!required.some(r => r.url === link.url)) {
          required.push({ ...link, isDead: !livePaths.includes(link.url) });
        }
      });
    } else {
      currentGlobalLinks.forEach(link => {
        if (!required.some(r => r.url === link.url)) {
          required.push({ ...link, isDead: !livePaths.includes(link.url) });
        }
      });

      product.collectionHandles.forEach(handle => {
        if (COLLECTION_RULES[handle]) {
          COLLECTION_RULES[handle].links.forEach(link => {
            if (!required.some(r => r.url === link.url || r.label === link.label)) {
              required.push({ ...link, isDead: !livePaths.includes(link.url) });
            }
          });
        }
      });
    }

    required.forEach(link => {
      if (checkLinkPresence(htmlLinks, link.url)) {
        present.push(link);
      } else {
        missing.push(link);
      }
    });

    const isCompliant = missing.length === 0;
    
    let complianceStatus = "Broken";
    if (isCompliant) {
      complianceStatus = "Compliant";
    } else if (missing.length > 0 && present.length > 0) {
      complianceStatus = "Partial";
    } else {
      complianceStatus = "Broken";
    }

    return {
      ...product,
      isHardware,
      required,
      missing,
      present,
      extractedUrls: htmlLinks,
      isCompliant,
      complianceStatus,
      hasDeadLinks: required.some(r => r.isDead)
    };
  });
}

function generateInjectionHtml(currentHtml, missingLinks) {
  let newHtml = currentHtml || "";
  let injectionHtml = `\n\n<div class="rockhound-dwell-links" style="margin-top: 2em; display: flex; flex-wrap: wrap; gap: 10px;">`;
  
  const validLinks = missingLinks.filter(link => !link.isDead);
  if (validLinks.length === 0) return newHtml;

  validLinks.forEach(link => {
     injectionHtml += `\n  <a href="${link.url}" class="button" style="padding: 10px 15px; background: #f4f6f8; border: 1px solid #c9cccf; border-radius: 4px; text-decoration: none; color: #202223; font-weight: 500;">${link.label}</a>`;
  });
  injectionHtml += `\n</div>`;
  return newHtml + injectionHtml;
}

// --- 2. SERVER ACTIONS & LOADERS ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const requestUrl = new URL(request.url);
  const successMessage = requestUrl.searchParams.get("success") === "rule_saved" 
    ? "Rule saved successfully!" 
    : null;

  try {
    const res = await admin.graphql(`#graphql
      query {
        products(first: 100) {
          edges {
            node {
              id title descriptionHtml tags
              collections(first: 10) { edges { node { handle } } }
            }
          }
        }
        collections(first: 150) { edges { node { handle } } }
        pages(first: 100) { edges { node { id title handle body } } }
        articles(first: 100) { edges { node { id title handle blog { handle } body } } }
      }
    `);
    const json = await res.json();
    
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    
    const dbGlobalRules = await prisma.dwellRule.findMany({ 
      where: { isGlobal: true } 
    });

    const globalLinks = INITIAL_GLOBAL_LINKS.map(defaultLink => {
      const dbMatch = dbGlobalRules.find(r => r.key === defaultLink.key);
      return dbMatch 
        ? { key: dbMatch.key, url: dbMatch.url, label: dbMatch.label } 
        : defaultLink;
    });

    const hardwareLinks = INITIAL_HARDWARE_LINKS.map(defaultLink => {
      const dbMatch = dbGlobalRules.find(r => r.key === defaultLink.key);
      return dbMatch 
        ? { key: dbMatch.key, url: dbMatch.url, label: dbMatch.label } 
        : defaultLink;
    });

    const products = (json.data?.products?.edges || []).map(e => ({
      ...e.node,
      tags: e.node.tags || [],
      collectionHandles: e.node.collections.edges.map(ce => ce.node.handle)
    }));
    const collections = (json.data?.collections?.edges || []).map(e => e.node);
    const pages = (json.data?.pages?.edges || []).map(e => e.node);
    const articles = (json.data?.articles?.edges || []).map(e => e.node);
    
    const livePaths = [
      "/collections/all",
      ...collections.map(c => `/collections/${c.handle}`),
      ...pages.map(p => `/pages/${p.handle}`),
      ...articles.map(a => `/blogs/${a.blog.handle}/${a.handle}`)
    ];

    const evaluatedProducts = evaluateProducts(products, livePaths, globalLinks, hardwareLinks);

    return Response.json({ evaluatedProducts, pages, articles, livePaths, globalLinks, hardwareLinks, successMessage });
  } catch (error) {
    console.error("Loader error:", error);
    return Response.json({ evaluatedProducts: [], pages: [], articles: [], livePaths: [], globalLinks: INITIAL_GLOBAL_LINKS, hardwareLinks: INITIAL_HARDWARE_LINKS, loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveGlobalRule") {
    const key = formData.get("key");
    const label = formData.get("label");
    const url = formData.get("url");

    try {
      await prisma.dwellRule.upsert({
        where: { key: key },
        update: { label, url },
        create: { key, label, url, isGlobal: true }
      });
      
      const requestUrl = new URL(request.url);
      return redirect(requestUrl.pathname + "?success=rule_saved");
    } catch (error) {
      return Response.json({ ok: false, error: "Failed to save to database." });
    }
  }

  if (intent === "injectLinks") {
    const rawId = formData.get("id");
    const safeId = rawId.includes("gid://shopify/") ? rawId : `gid://shopify/Product/${rawId.split('/').pop()}`;
    const newHtml = formData.get("newHtml");
    try {
      const res = await admin.graphql(`#graphql
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { userErrors { message } }
        }
      `, { variables: { input: { id: safeId, descriptionHtml: newHtml } } });
      const json = await res.json();
      if (json.data?.productUpdate?.userErrors?.length) {
        return Response.json({ ok: false, error: json.data.productUpdate.userErrors[0].message });
      }
      return Response.json({ ok: true, intent, message: "Links injected successfully!" });
    } catch (e) {
      return Response.json({ ok: false, error: e.message });
    }
  }

  if (intent === "bulkInjectLinks") {
    const payload = JSON.parse(formData.get("payload"));
    let errors = [];
    
    for (const item of payload) {
      try {
        const safeId = item.id.includes("gid://shopify/") ? item.id : `gid://shopify/Product/${item.id.split('/').pop()}`;
        const res = await admin.graphql(`#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) { userErrors { message } }
          }
        `, { variables: { input: { id: safeId, descriptionHtml: item.newHtml } } });
        
        const json = await res.json();
        if (json.data?.productUpdate?.userErrors?.length) {
          errors.push(`Error on product ${item.id}: ${json.data.productUpdate.userErrors[0].message}`);
        }
      } catch (e) {
        errors.push(`Exception on product ${item.id}: ${e.message}`);
      }
    }
    if (errors.length > 0) return Response.json({ ok: false, error: `Finished with errors: ${errors.join(', ')}` });
    return Response.json({ ok: true, intent, message: `Successfully applied fixes to ${payload.length} products!` });
  }

  if (intent === "updatePage") {
    const rawId = formData.get("id");
    const safeId = rawId.includes("gid://shopify/") ? rawId : `gid://shopify/Page/${rawId.split('/').pop()}`;
    const bodyHtml = formData.get("bodyHtml");
    const res = await admin.graphql(`#graphql
      mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) { userErrors { message } }
      }
    `, { variables: { id: safeId, page: { body: bodyHtml } } });
    const json = await res.json();
    if (json.data?.pageUpdate?.userErrors?.length) return Response.json({ ok: false, error: json.data.pageUpdate.userErrors[0].message });
    return Response.json({ ok: true, intent, message: "Page saved successfully!" });
  }

  if (intent === "updateArticle") {
    const rawId = formData.get("id");
    const safeId = rawId.includes("gid://shopify/") ? rawId : `gid://shopify/Article/${rawId.split('/').pop()}`;
    const bodyHtml = formData.get("bodyHtml");
    const res = await admin.graphql(`#graphql
      mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) { userErrors { message } }
      }
    `, { variables: { id: safeId, article: { body: bodyHtml } } });
    const json = await res.json();
    if (json.data?.articleUpdate?.userErrors?.length) return Response.json({ ok: false, error: json.data.articleUpdate.userErrors[0].message });
    return Response.json({ ok: true, intent, message: "Article saved successfully!" });
  }

  return Response.json({ ok: false });
};

// --- 4. MAIN COMPONENT ---
export default function DwellWeb() {
  const { evaluatedProducts, pages, articles, livePaths, loaderError, globalLinks: loadedGlobalLinks, hardwareLinks: loadedHardwareLinks, successMessage } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const revalidator = useRevalidator(); 

  const [selectedTab, setSelectedTab] = useState(0);
  const [editorType, setEditorType] = useState("pages"); 
  const [activeItem, setActiveItem] = useState(null);
  const [contentHtml, setContentHtml] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  const [globalLinks, setGlobalLinks] = useState(loadedGlobalLinks || INITIAL_GLOBAL_LINKS);
  const [editingGlobalIndex, setEditingGlobalIndex] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", url: "" });

  const [hardwareLinks, setHardwareLinks] = useState(loadedHardwareLinks || INITIAL_HARDWARE_LINKS);
  const [editingHardwareIndex, setEditingHardwareIndex] = useState(null);
  const [editHardwareForm, setEditHardwareForm] = useState({ label: "", url: "" });

  useEffect(() => {
    if (loadedGlobalLinks) setGlobalLinks(loadedGlobalLinks);
    if (loadedHardwareLinks) setHardwareLinks(loadedHardwareLinks);
  }, [loadedGlobalLinks, loadedHardwareLinks]);

  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data?.error) {
      setEditingGlobalIndex(null);
      setEditingHardwareIndex(null);
    }
  }, [fetcher.state, fetcher.data]);

  const handleTabChange = (index) => setSelectedTab(index);

  const nonCompliantProducts = evaluatedProducts.filter(p => !p.isCompliant);

  const handleInject = (product) => {
    const newHtml = generateInjectionHtml(product.descriptionHtml, product.missing);
    const fd = new FormData();
    fd.append("intent", "injectLinks");
    fd.append("id", product.id);
    fd.append("newHtml", newHtml);
    fetcher.submit(fd, { method: "post" });
  };

  const handleBulkInject = () => {
    const payload = nonCompliantProducts.map(p => ({
      id: p.id,
      newHtml: generateInjectionHtml(p.descriptionHtml, p.missing)
    }));
    const fd = new FormData();
    fd.append("intent", "bulkInjectLinks");
    fd.append("payload", JSON.stringify(payload));
    fetcher.submit(fd, { method: "post" });
  };

  const renderRulesTab = () => {
    const renderLinkRule = (l) => {
      const isDead = !livePaths.includes(l.url);
      return (
        <BlockStack key={l.url || l.label} gap="0">
          <InlineStack gap="200" blockAlign="center">
            <Text fontWeight="bold" as="span">• {l.label}</Text>
            {isDead && <Badge tone="critical">DEAD LINK</Badge>}
          </InlineStack>
          <Text variant="bodySm" tone={isDead ? "critical" : "subdued"} as="span">{l.url}</Text>
        </BlockStack>
      );
    };

    return (
      <BlockStack gap="500">
        {successMessage && (
          <Banner tone="success">{successMessage}</Banner>
        )}
        
        {fetcher.data?.error && (
          <Banner tone="critical">{fetcher.data.error}</Banner>
        )}

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Global Rule (All Products)</Text>
            <Text tone="subdued" as="p">Every stone product must contain these two footer buttons.</Text>
            <Box padding="300" background="bg-surface-secondary" borderRadius="100">
              <BlockStack gap="400">
                {globalLinks.map((l, index) => {
                  const isDead = !livePaths.includes(l.url);
                  const isEditing = editingGlobalIndex === index;

                  if (isEditing) {
                    return (
                      <BlockStack gap="200" key={l.key}>
                        <TextField
                          label="Label"
                          value={editForm.label}
                          onChange={(val) => setEditForm({ ...editForm, label: val })}
                          autoComplete="off"
                        />
                        <TextField
                          label="URL"
                          value={editForm.url}
                          onChange={(val) => setEditForm({ ...editForm, url: val })}
                          autoComplete="off"
                        />
                        <InlineStack gap="200">
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button 
                              variant="primary"
                              loading={fetcher.state === "submitting" && fetcher.formData?.get("key") === l.key}
                              accessibilityLabel={`Save global rule for ${l.label}`}
                              onClick={() => {
                                const fd = new FormData();
                                fd.append("intent", "saveGlobalRule");
                                fd.append("key", l.key);
                                fd.append("label", editForm.label);
                                fd.append("url", editForm.url);
                                fetcher.submit(fd, { method: "post" });
                              }}
                            >
                              Save
                            </Button>
                          </div>
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button 
                              onClick={() => setEditingGlobalIndex(null)}
                              accessibilityLabel="Cancel editing global rule"
                            >
                              Cancel
                            </Button>
                          </div>
                        </InlineStack>
                      </BlockStack>
                    );
                  }

                  return (
                    <BlockStack key={l.key} gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Text fontWeight="bold" as="span">• {l.label}</Text>
                          {isDead && <Badge tone="critical">DEAD LINK</Badge>}
                        </InlineStack>
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button 
                            onClick={() => { setEditingGlobalIndex(index); setEditForm(l); }}
                            accessibilityLabel={`Edit global rule for ${l.label}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </InlineStack>
                      <Text variant="bodySm" tone={isDead ? "critical" : "subdued"} as="span">{l.url}</Text>
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd" as="h2">Hardware Rule</Text>
            <Text tone="subdued" as="p">Applies automatically to any product tagged with "hardware".</Text>
            <Box padding="300" background="bg-surface-secondary" borderRadius="100">
              <BlockStack gap="400">
                {hardwareLinks.map((l, index) => {
                  const isDead = !livePaths.includes(l.url);
                  const isEditing = editingHardwareIndex === index;

                  if (isEditing) {
                    return (
                      <BlockStack gap="200" key={l.key}>
                        <TextField
                          label="Label"
                          value={editHardwareForm.label}
                          onChange={(val) => setEditHardwareForm({ ...editHardwareForm, label: val })}
                          autoComplete="off"
                        />
                        <TextField
                          label="URL"
                          value={editHardwareForm.url}
                          onChange={(val) => setEditHardwareForm({ ...editHardwareForm, url: val })}
                          autoComplete="off"
                        />
                        <InlineStack gap="200">
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button 
                              variant="primary"
                              loading={fetcher.state === "submitting" && fetcher.formData?.get("key") === l.key}
                              accessibilityLabel={`Save hardware rule for ${l.label}`}
                              onClick={() => {
                                const fd = new FormData();
                                fd.append("intent", "saveGlobalRule");
                                fd.append("key", l.key);
                                fd.append("label", editHardwareForm.label);
                                fd.append("url", editHardwareForm.url);
                                fetcher.submit(fd, { method: "post" });
                              }}
                            >
                              Save
                            </Button>
                          </div>
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button 
                              onClick={() => setEditingHardwareIndex(null)}
                              accessibilityLabel="Cancel editing hardware rule"
                            >
                              Cancel
                            </Button>
                          </div>
                        </InlineStack>
                      </BlockStack>
                    );
                  }

                  return (
                    <BlockStack key={l.key} gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Text fontWeight="bold" as="span">• {l.label}</Text>
                          {isDead && <Badge tone="critical">DEAD LINK</Badge>}
                        </InlineStack>
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button 
                            onClick={() => { setEditingHardwareIndex(index); setEditHardwareForm(l); }}
                            accessibilityLabel={`Edit hardware rule for ${l.label}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </InlineStack>
                      <Text variant="bodySm" tone={isDead ? "critical" : "subdued"} as="span">{l.url}</Text>
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
        
        <Text variant="headingMd" as="h2">Collection-Specific Rules</Text>
        <Grid>
          {Object.entries(COLLECTION_RULES).map(([handle, rule]) => (
            <Grid.Cell key={handle} columnSpan={{xs: 6, sm: 6, md: 3, lg: 6, xl: 6}}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">{rule.name}</Text>
                  <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                    <BlockStack gap="200">
                      {rule.links.map(renderLinkRule)}
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>
            </Grid.Cell>
          ))}
        </Grid>
      </BlockStack>
    );
  };

  const renderScanTab = () => {
    const rows = evaluatedProducts.map(p => {
      let statusBadge;
      if (p.hasDeadLinks) {
        statusBadge = <Badge tone="warning">⚠️ Setup Error</Badge>;
      } else if (p.complianceStatus === "Compliant") {
        statusBadge = <Badge tone="success">✅ Compliant</Badge>;
      } else if (p.complianceStatus === "Partial") {
        statusBadge = <Badge tone="warning">⚠️ Partial</Badge>;
      } else {
        statusBadge = <Badge tone="critical">🔴 Broken</Badge>;
      }

      let missingText;
      if (p.hasDeadLinks) {
        missingText = <Text tone="critical" as="span">Rule contains dead link</Text>;
      } else if (p.isCompliant) {
        missingText = <Text tone="subdued" as="span">—</Text>;
      } else {
        missingText = <Text as="span">{p.missing.map(m => m.label).join(", ")}</Text>;
      }

      return [
        <Text fontWeight="bold" truncate as="span">{p.title}</Text>,
        p.required.length.toString(),
        statusBadge,
        missingText
      ];
    });

    return (
      <BlockStack gap="400">
        <InlineStack align="end">
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
            <Button 
              onClick={() => revalidator.revalidate()} 
              loading={revalidator.state === "loading"}
              accessibilityLabel="Rescan live data from Shopify"
            >
              🔄 Rescan Live Data
            </Button>
          </div>
        </InlineStack>
        
        <Card padding="0">
          <DataTable
            columnContentTypes={['text', 'numeric', 'text', 'text']}
            headings={['Product', 'Required Links', 'Status', 'Missing Targets']}
            rows={rows}
          />
        </Card>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h2">Engine Diagnostics</Text>
              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                <Button 
                  onClick={() => setShowDebug(!showDebug)}
                  accessibilityLabel="Toggle debug data visibility"
                >
                  {showDebug ? "Hide Debug Data" : "Show Debug Data"}
                </Button>
              </div>
            </InlineStack>
            {showDebug && (
              <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                <BlockStack gap="400">
                  {evaluatedProducts.map(p => (
                    <BlockStack key={p.id} gap="100">
                      <Text fontWeight="bold" as="span">{p.title} ({p.complianceStatus})</Text>
                      <Text variant="bodySm" as="span"><b>Required:</b> {p.required.map(r => r.url).join(', ') || "None"}</Text>
                      <Text variant="bodySm" as="span"><b>Found (Raw):</b> {p.extractedUrls.join(', ') || "None"}</Text>
                      <Text variant="bodySm" as="span"><b>Missing:</b> {p.missing.map(m => m.url).join(', ') || "None"}</Text>
                      <Divider />
                    </BlockStack>
                  ))}
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    );
  };

  const renderApplyTab = () => {
    if (nonCompliantProducts.length === 0) {
      return (
        <Card>
          <Box padding="800" textAlign="center">
            <Text variant="headingLg" tone="success" as="h2">All products are 100% compliant! 🎉</Text>
            <Text tone="subdued" as="p">The Dwell Web is secure.</Text>
          </Box>
        </Card>
      );
    }

    const hasDeadLinkConfig = nonCompliantProducts.some(p => p.hasDeadLinks);
    const hasAnyValidMissing = nonCompliantProducts.some(p => p.missing.some(l => !l.isDead));

    return (
      <BlockStack gap="400">
        {hasDeadLinkConfig && (
          <Banner tone="warning" title="Dead Links Detected in Rules">
            <Text as="p">Some products require URLs that are currently dead (404). You can still inject the links, but dead URLs will be safely ignored until you correct them in the Rules tab.</Text>
          </Banner>
        )}

        <Card background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingMd" as="h2">Bulk Action</Text>
              <Text tone="subdued" as="p">Found {nonCompliantProducts.length} products with missing Dwell links.</Text>
            </BlockStack>
            <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
              <Button 
                size="large"
                variant="primary" 
                onClick={handleBulkInject}
                loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "bulkInjectLinks"}
                disabled={!hasAnyValidMissing}
                accessibilityLabel="Bulk inject all missing links across non-compliant products"
              >
                ⚡ Bulk Inject All Missing Links
              </Button>
            </div>
          </InlineStack>
        </Card>

        {fetcher.data?.message && ["injectLinks", "bulkInjectLinks"].includes(fetcher.data?.intent) && (
          <Banner tone="success">{fetcher.data.message}</Banner>
        )}
        
        {nonCompliantProducts.map(p => {
          const hasValidMissingForProduct = p.missing.some(l => !l.isDead);

          return (
            <Card key={p.id}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingSm" as="h3">{p.title}</Text>
                    <Text variant="bodySm" tone="subdued" as="span">
                      Found in: {p.isHardware ? "Hardware" : (p.collectionHandles.filter(h => COLLECTION_RULES[h]).map(h => COLLECTION_RULES[h].name).join(", ") || "Global Only")}
                    </Text>
                  </BlockStack>
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button 
                      variant="primary" 
                      onClick={() => handleInject(p)}
                      loading={fetcher.state === "submitting" && fetcher.formData?.get("id") === p.id}
                      disabled={!hasValidMissingForProduct}
                      accessibilityLabel={`Inject missing links for ${p.title}`}
                    >
                      Inject Missing Links
                    </Button>
                  </div>
                </InlineStack>
                <Divider />
                <InlineStack gap="400">
                  <Box style={{ flex: 1 }}>
                    <Text variant="bodySm" fontWeight="bold" tone="success" as="p">✅ Present:</Text>
                    <InlineStack gap="200" wrap>
                      {p.present.length === 0 && <Text variant="bodySm" tone="subdued" as="span">None</Text>}
                      {p.present.length > 0 && p.present.map((l, i) => <Badge key={i} tone="success">{l.label}</Badge>)}
                    </InlineStack>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Text variant="bodySm" fontWeight="bold" tone="critical" as="p">🔴 Missing:</Text>
                    <InlineStack gap="200" wrap>
                      {p.missing.map((l, i) => (
                        <Badge key={i} tone={l.isDead ? "warning" : "critical"}>
                          {l.label} {l.isDead && "(DEAD URL - Ignored)"}
                        </Badge>
                      ))}
                    </InlineStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          );
        })}
      </BlockStack>
    );
  };

  const renderEditorTab = () => {
    const itemsToList = editorType === "pages" ? pages : articles;
    const filteredItems = itemsToList.filter(item => item.title.toLowerCase().includes(searchQuery.toLowerCase()));

    const handleSaveContent = () => {
      if (!activeItem) return;
      const fd = new FormData();
      fd.append("intent", activeItem.type === "pages" ? "updatePage" : "updateArticle");
      fd.append("id", activeItem.id);
      fd.append("bodyHtml", contentHtml);
      fetcher.submit(fd, { method: "post" });
    };

    return (
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Select
                label="Content Type"
                options={[
                  { label: "📄 Pages", value: "pages" },
                  { label: "📝 Blog Posts", value: "articles" }
                ]}
                value={editorType}
                onChange={(val) => { setEditorType(val); setActiveItem(null); }}
              />
              <TextField
                label="Search content"
                labelHidden
                placeholder="Search..."
                value={searchQuery}
                onChange={setSearchQuery}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
                prefix={<Icon source={SearchIcon} />}
              />
              <Divider />
              <Box style={{ maxHeight: "50vh", overflowY: "auto" }}>
                <BlockStack gap="200">
                  {filteredItems.map(item => (
                    <button 
                      key={item.id} 
                      onClick={() => {
                        setActiveItem({ ...item, type: editorType });
                        setContentHtml(item.body);
                      }} 
                      style={{ cursor: "pointer", background: "none", border: "none", width: "100%", textAlign: "left", padding: 0, minHeight: "48px" }}
                      aria-label={`Select ${item.title} to edit`}
                    >
                      <Box
                        padding="200"
                        background={activeItem?.id === item.id ? "bg-surface-active" : "transparent"}
                        borderRadius="100"
                      >
                        <Text fontWeight={activeItem?.id === item.id ? "bold" : "regular"} as="span" truncate>
                          {item.title}
                        </Text>
                      </Box>
                    </button>
                  ))}
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          {!activeItem && (
            <Card>
              <Box padding="800" textAlign="center">
                <Text tone="subdued" as="p">Select a page or article to edit body content.</Text>
              </Box>
            </Card>
          )}
          
          {activeItem && (
            <BlockStack gap="400">
              {fetcher.data?.message && ["updatePage", "updateArticle"].includes(fetcher.data?.intent) && (
                <Banner tone="success">{fetcher.data.message}</Banner>
              )}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingLg" as="h2">{activeItem.title}</Text>
                    <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                      <Button 
                        variant="primary" 
                        onClick={handleSaveContent} 
                        loading={fetcher.state === "submitting" && ["updatePage", "updateArticle"].includes(fetcher.formData?.get("intent"))}
                        accessibilityLabel={`Save HTML for ${activeItem.title}`}
                      >
                        Save HTML
                      </Button>
                    </div>
                  </InlineStack>
                  <TextField
                    label="Body HTML"
                    labelHidden
                    value={contentHtml}
                    onChange={setContentHtml}
                    multiline={15}
                    autoComplete="off"
                    monospaced
                  />
                </BlockStack>
              </Card>
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    );
  };

  const tabs = [
    { id: 'rules', content: '📋 Rules', panelID: 'panel-rules' },
    { id: 'scan', content: `🔍 Scan Products (${evaluatedProducts.length})`, panelID: 'panel-scan' },
    { id: 'apply', content: `⚡ Apply Fixes (${nonCompliantProducts.length})`, panelID: 'panel-apply' },
    { id: 'editor', content: '📝 Text Editor (Bonus)', panelID: 'panel-editor' },
  ];

  return (
    <Page
      title="Dwell Web Manager 🕸️"
      subtitle="Product Link Governance & Dwell Loop Enforcer"
      backAction={{ content: "Command Center", onAction: () => navigate("/app") }}
      primaryAction={{
        content: "🔄 Rescan Live Data",
        onAction: () => revalidator.revalidate(),
        loading: revalidator.state === "loading"
      }}
    >
      {loaderError && (
        <Box paddingBlockEnd="400">
          <Banner tone="critical" title="Failed to load Shopify data">
            <Text as="p">{loaderError}</Text>
          </Banner>
        </Box>
      )}

      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
        <Box paddingBlockStart="400">
          {selectedTab === 0 && renderRulesTab()}
          {selectedTab === 1 && renderScanTab()}
          {selectedTab === 2 && renderApplyTab()}
          {selectedTab === 3 && renderEditorTab()}
        </Box>
      </Tabs>
    </Page>
  );
}
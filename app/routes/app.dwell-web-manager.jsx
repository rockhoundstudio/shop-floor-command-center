import { useState, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher, data, redirect, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"; // Prisma Engine Connection
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  Badge, Box, Divider, Tabs, DataTable, Select, TextField, Banner, Grid, Icon
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

// --- 1. THE RULE SET ---
const INITIAL_GLOBAL_LINKS = [
  { key: "global_all_stones", url: "/collections/all", label: "All Stones" },
  { key: "global_all_tales", url: "/pages/tails-and-trails
", label: "All Tales" }
];

const HARDWARE_LINKS = [
  { url: "/pages/build-your-setting", label: "Build Your Setting" },
  { url: "/collections/hardware", label: "Hardware Collection" }
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

function evaluateProducts(products, livePaths, currentGlobalLinks) {
  return products.map(product => {
    const htmlLinks = extractLinks(product.descriptionHtml);
    const required = [];
    const missing = [];
    const present = [];
    const isHardware = product.tags && product.tags.includes("hardware");

    if (isHardware) {
      // Hardware products strictly require these two links
      HARDWARE_LINKS.forEach(link => required.push({ ...link, isDead: !livePaths.includes(link.url) }));
    } else {
      // Standard stone products require global links + collection specifics
      currentGlobalLinks.forEach(link => required.push({ ...link, isDead: !livePaths.includes(link.url) }));

      product.collectionHandles.forEach(handle => {
        if (COLLECTION_RULES[handle]) {
          COLLECTION_RULES[handle].links.forEach(link => {
            if (!required.some(r => r.label === link.label)) {
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
    
    // Determine strict compliance state
    let complianceStatus = "Broken";
    if (isCompliant) {
      complianceStatus = "Compliant";
    } else if (present.length === 2) {
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
      isCompliant,
      complianceStatus,
      hasDeadLinks: required.some(r => r.isDead)
    };
  });
}

function generateInjectionHtml(currentHtml, missingLinks) {
  let newHtml = currentHtml || "";
  let injectionHtml = `\n\n<div class="rockhound-dwell-links" style="margin-top: 2em; display: flex; flex-wrap: wrap; gap: 10px;">`;
  
  // Hard Filter: Only inject valid URLs, deliberately bypassing dead links
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
    ? "Global rule saved successfully!" 
    : null;

  try {
    // 1. Fetch live products, tags, and pages from Shopify
    const res = await admin.graphql(`
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
    
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }
    
    // 2. Fetch global rules from Render Prisma Database
    const dbGlobalRules = await prisma.dwellRule.findMany({ 
      where: { isGlobal: true } 
    });

    // Merge database rules over the hardcoded defaults
    const globalLinks = INITIAL_GLOBAL_LINKS.map(defaultLink => {
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

    // 3. Process Server-Side Scan
    const evaluatedProducts = evaluateProducts(products, livePaths, globalLinks);

    return data({ evaluatedProducts, pages, articles, livePaths, globalLinks, successMessage });
  } catch (error) {
    console.error("Loader error:", error);
    return data({ evaluatedProducts: [], pages: [], articles: [], livePaths: [], globalLinks: INITIAL_GLOBAL_LINKS, loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  // 1. Core Engine Hookup: Secure the Admin GraphQL client
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Save the rule to Render Postgres DB & Trigger Loader Redirect
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
      
      // Redirect back to page to force a clean loader re-scan
      const requestUrl = new URL(request.url);
      return redirect(requestUrl.pathname + "?success=rule_saved");
    } catch (error) {
      return data({ ok: false, error: "Failed to save to database." });
    }
  }

  if (intent === "injectLinks") {
    const id = formData.get("id");
    const newHtml = formData.get("newHtml");
    try {
      const res = await admin.graphql(`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { userErrors { message } }
        }
      `, { variables: { input: { id, descriptionHtml: newHtml } } });
      const json = await res.json();
      if (json.data?.productUpdate?.userErrors?.length) {
        return data({ ok: false, error: json.data.productUpdate.userErrors[0].message });
      }
      return data({ ok: true, intent, message: "Links injected successfully!" });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "bulkInjectLinks") {
    const payload = JSON.parse(formData.get("payload"));
    let errors = [];
    
    for (const item of payload) {
      try {
        const res = await admin.graphql(`
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) { userErrors { message } }
          }
        `, { variables: { input: { id: item.id, descriptionHtml: item.newHtml } } });
        
        const json = await res.json();
        if (json.data?.productUpdate?.userErrors?.length) {
          errors.push(`Error on product ${item.id}: ${json.data.productUpdate.userErrors[0].message}`);
        }
      } catch (e) {
        errors.push(`Exception on product ${item.id}: ${e.message}`);
      }
    }
    if (errors.length > 0) return data({ ok: false, error: `Finished with errors: ${errors.join(', ')}` });
    return data({ ok: true, intent, message: `Successfully applied fixes to ${payload.length} products!` });
  }

  if (intent === "updatePage") {
    const id = formData.get("id");
    const bodyHtml = formData.get("bodyHtml");
    const res = await admin.graphql(`
      mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
        pageUpdate(id: $id, page: $page) { userErrors { message } }
      }
    `, { variables: { id, page: { body: bodyHtml } } });
    const json = await res.json();
    if (json.data?.pageUpdate?.userErrors?.length) return data({ ok: false, error: json.data.pageUpdate.userErrors[0].message });
    return data({ ok: true, intent, message: "Page saved successfully!" });
  }

  if (intent === "updateArticle") {
    const id = formData.get("id");
    const bodyHtml = formData.get("bodyHtml");
    const res = await admin.graphql(`
      mutation articleUpdate($id: ID!, $article: ArticleUpdateInput!) {
        articleUpdate(id: $id, article: $article) { userErrors { message } }
      }
    `, { variables: { id, article: { body: bodyHtml } } });
    const json = await res.json();
    if (json.data?.articleUpdate?.userErrors?.length) return data({ ok: false, error: json.data.articleUpdate.userErrors[0].message });
    return data({ ok: true, intent, message: "Article saved successfully!" });
  }

  return data({ ok: false });
};

// --- 4. MAIN COMPONENT ---
export default function DwellWeb() {
  const { evaluatedProducts, pages, articles, livePaths, loaderError, globalLinks: loadedGlobalLinks, successMessage } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [editorType, setEditorType] = useState("pages"); 
  const [activeItem, setActiveItem] = useState(null);
  const [contentHtml, setContentHtml] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [globalLinks, setGlobalLinks] = useState(loadedGlobalLinks || INITIAL_GLOBAL_LINKS);
  const [editingGlobalIndex, setEditingGlobalIndex] = useState(null);
  const [editForm, setEditForm] = useState({ label: "", url: "" });

  // Sync state if loader data re-fetches after a save
  useEffect(() => {
    if (loadedGlobalLinks) setGlobalLinks(loadedGlobalLinks);
  }, [loadedGlobalLinks]);

  // Clear editing UI on successful backend save or redirect completion
  useEffect(() => {
    if (fetcher.state === "idle" && !fetcher.data?.error) {
      setEditingGlobalIndex(null);
    }
  }, [fetcher.state, fetcher.data]);

  const handleTabChange = (index) => setSelectedTab(index);

  // Directly access evaluated results calculated server-side
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
        <BlockStack key={l.url} gap="0">
          <InlineStack gap="200" blockAlign="center">
            <Text fontWeight="bold">• {l.label}</Text>
            {isDead && <Badge tone="critical">DEAD LINK</Badge>}
          </InlineStack>
          <Text variant="bodySm" tone={isDead ? "critical" : "subdued"}>{l.url}</Text>
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
            <Text variant="headingMd">Global Rule (All Products)</Text>
            <Text tone="subdued">Every stone product must contain these two footer buttons.</Text>
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
                          <Button 
                            size="micro" 
                            variant="primary"
                            loading={fetcher.state === "submitting" && fetcher.formData?.get("key") === l.key}
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
                          <Button size="micro" onClick={() => setEditingGlobalIndex(null)}>Cancel</Button>
                        </InlineStack>
                      </BlockStack>
                    );
                  }

                  return (
                    <BlockStack key={l.key} gap="100">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="200" blockAlign="center">
                          <Text fontWeight="bold">• {l.label}</Text>
                          {isDead && <Badge tone="critical">DEAD LINK</Badge>}
                        </InlineStack>
                        <Button size="micro" onClick={() => { setEditingGlobalIndex(index); setEditForm(l); }}>Edit</Button>
                      </InlineStack>
                      <Text variant="bodySm" tone={isDead ? "critical" : "subdued"}>{l.url}</Text>
                    </BlockStack>
                  );
                })}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Hardware Rule</Text>
            <Text tone="subdued">Applies automatically to any product tagged with "hardware".</Text>
            <Box padding="300" background="bg-surface-secondary" borderRadius="100">
              <BlockStack gap="200">
                {HARDWARE_LINKS.map(renderLinkRule)}
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>
        
        <Text variant="headingMd">Collection-Specific Rules</Text>
        <Grid>
          {Object.entries(COLLECTION_RULES).map(([handle, rule]) => (
            <Grid.Cell key={handle} columnSpan={{xs: 6, sm: 6, md: 3, lg: 6, xl: 6}}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm">{rule.name}</Text>
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
    const rows = evaluatedProducts.map(p => [
      <Text fontWeight="bold" truncate>{p.title}</Text>,
      p.required.length.toString(),
      p.hasDeadLinks 
        ? <Badge tone="warning">⚠️ Setup Error</Badge> 
        : p.complianceStatus === "Compliant" 
          ? <Badge tone="success">✅ Compliant</Badge> 
          : p.complianceStatus === "Partial"
            ? <Badge tone="warning">⚠️ Partial</Badge>
            : <Badge tone="critical">🔴 Broken</Badge>,
      p.hasDeadLinks
        ? <Text tone="critical">Rule contains dead link</Text>
        : p.isCompliant ? <Text tone="subdued">—</Text> : p.missing.map(m => m.label).join(", ")
    ]);

    return (
      <BlockStack gap="400">
        <InlineStack align="end">
          <Button 
            onClick={() => window.location.reload()} 
          >
            🔄 Rescan Live Data
          </Button>
        </InlineStack>
        <Card padding="0">
          <DataTable
            columnContentTypes={['text', 'numeric', 'text', 'text']}
            headings={['Product', 'Required Links', 'Status', 'Missing Targets']}
            rows={rows}
          />
        </Card>
      </BlockStack>
    );
  };

  const renderApplyTab = () => {
    if (nonCompliantProducts.length === 0) {
      return (
        <Card>
          <Box padding="800" textAlign="center">
            <Text variant="headingLg" tone="success">All products are 100% compliant! 🎉</Text>
            <Text tone="subdued">The Dwell Web is secure.</Text>
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
            <Text>Some products require URLs that are currently dead (404). You can still inject the links, but dead URLs will be safely ignored until you correct them in the Rules tab.</Text>
          </Banner>
        )}

        <Card background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingMd">Bulk Action</Text>
              <Text tone="subdued">Found {nonCompliantProducts.length} products with missing Dwell links.</Text>
            </BlockStack>
            <Button 
              size="large"
              variant="primary" 
              onClick={handleBulkInject}
              loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "bulkInjectLinks"}
              disabled={!hasAnyValidMissing}
            >
              ⚡ Bulk Inject All Missing Links
            </Button>
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
                    <Text variant="headingSm">{p.title}</Text>
                    <Text variant="bodySm" tone="subdued">
                      Found in: {p.isHardware ? "Hardware" : (p.collectionHandles.filter(h => COLLECTION_RULES[h]).map(h => COLLECTION_RULES[h].name).join(", ") || "Global Only")}
                    </Text>
                  </BlockStack>
                  <Button 
                    variant="primary" 
                    onClick={() => handleInject(p)}
                    loading={fetcher.state === "submitting" && fetcher.formData?.get("id") === p.id}
                    disabled={!hasValidMissingForProduct}
                  >
                    Inject Missing Links
                  </Button>
                </InlineStack>
                <Divider />
                <InlineStack gap="400">
                  <Box style={{ flex: 1 }}>
                    <Text variant="bodySm" fontWeight="bold" tone="success">✅ Present:</Text>
                    <InlineStack gap="200" wrap>
                      {p.present.length === 0 ? <Text variant="bodySm" tone="subdued">None</Text> : p.present.map((l, i) => <Badge key={i} tone="success">{l.label}</Badge>)}
                    </InlineStack>
                  </Box>
                  <Box style={{ flex: 1 }}>
                    <Text variant="bodySm" fontWeight="bold" tone="critical">🔴 Missing:</Text>
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
                    <div 
                      key={item.id} 
                      onClick={() => {
                        setActiveItem({ ...item, type: editorType });
                        setContentHtml(item.body);
                      }} 
                      style={{ cursor: "pointer" }}
                    >
                      <Box
                        padding="200"
                        background={activeItem?.id === item.id ? "bg-surface-active" : "transparent"}
                        borderRadius="100"
                      >
                        <Text fontWeight={activeItem?.id === item.id ? "bold" : "regular"} truncate>
                          {item.title}
                        </Text>
                      </Box>
                    </div>
                  ))}
                </BlockStack>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>
        <Layout.Section>
          {!activeItem ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text tone="subdued">Select a page or article to edit body content.</Text>
              </Box>
            </Card>
          ) : (
            <BlockStack gap="400">
              {fetcher.data?.message && ["updatePage", "updateArticle"].includes(fetcher.data?.intent) && (
                <Banner tone="success">{fetcher.data.message}</Banner>
              )}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingLg">{activeItem.title}</Text>
                    <Button variant="primary" onClick={handleSaveContent} loading={fetcher.state === "submitting" && ["updatePage", "updateArticle"].includes(fetcher.formData?.get("intent"))}>
                      Save HTML
                    </Button>
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
        onAction: () => window.location.reload()
      }}
    >
      {loaderError && (
        <Box paddingBlockEnd="400">
          <Banner tone="critical" title="Failed to load Shopify data">
            {loaderError}
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
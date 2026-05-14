import { useState, useMemo } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import { useNavigate } from "@shopify/app-bridge-react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  Badge, Box, Divider, Tabs, DataTable, Select, TextField, Banner, Grid, Tooltip, Icon
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

// --- 1. THE RULE SET ---
const GLOBAL_LINKS = [
  { url: "/collections/all", label: "All Stones" },
  { url: "/pages/rockhound-logbook-hub", label: "All Tales" }
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

// --- 2. SERVER ACTIONS & LOADERS ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const res = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id title descriptionHtml
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
    
    const products = (json.data?.products?.edges || []).map(e => ({
      ...e.node,
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

    return data({ products, pages, articles, livePaths });
  } catch (error) {
    console.error("Loader error:", error);
    return data({ products: [], pages: [], articles: [], livePaths: [], loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "injectLinks") {
    const id = formData.get("id");
    const newHtml = formData.get("newHtml");
    const res = await admin.graphql(`
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) { userErrors { message } }
      }
    `, { variables: { input: { id, descriptionHtml: newHtml } } });
    const json = await res.json();
    if (json.data?.productUpdate?.userErrors?.length) return data({ ok: false, error: json.data.productUpdate.userErrors[0].message });
    return data({ ok: true, message: "Links injected successfully!" });
  }

  if (intent === "bulkInjectLinks") {
    const payload = JSON.parse(formData.get("payload"));
    let errors = [];
    
    for (const item of payload) {
      const res = await admin.graphql(`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { userErrors { message } }
        }
      `, { variables: { input: { id: item.id, descriptionHtml: item.newHtml } } });
      const json = await res.json();
      if (json.data?.productUpdate?.userErrors?.length) {
        errors.push(`Error on product ${item.id}: ${json.data.productUpdate.userErrors[0].message}`);
      }
    }
    if (errors.length > 0) return data({ ok: false, error: `Finished with errors: ${errors.join(', ')}` });
    return data({ ok: true, message: `Successfully injected links into ${payload.length} products!` });
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
    return data({ ok: true, message: "Page saved successfully!" });
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
    return data({ ok: true, message: "Article saved successfully!" });
  }

  return data({ ok: false });
};

// --- 3. EVALUATION ENGINE ---
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

function evaluateProducts(products, livePaths) {
  return products.map(product => {
    const htmlLinks = extractLinks(product.descriptionHtml);
    const required = [];
    const missing = [];
    const present = [];

    GLOBAL_LINKS.forEach(link => required.push({ ...link, isDead: !livePaths.includes(link.url) }));

    product.collectionHandles.forEach(handle => {
      if (COLLECTION_RULES[handle]) {
        COLLECTION_RULES[handle].links.forEach(link => {
          if (!required.some(r => r.label === link.label)) {
            required.push({ ...link, isDead: !livePaths.includes(link.url) });
          }
        });
      }
    });

    required.forEach(link => {
      if (checkLinkPresence(htmlLinks, link.url)) {
        present.push(link);
      } else {
        missing.push(link);
      }
    });

    return {
      ...product,
      required,
      missing,
      present,
      isCompliant: missing.length === 0,
      hasDeadLinks: required.some(r => r.isDead)
    };
  });
}

function generateInjectionHtml(currentHtml, missingLinks) {
  let newHtml = currentHtml || "";
  let injectionHtml = `\n\n<div class="rockhound-dwell-links" style="margin-top: 2em; display: flex; flex-wrap: wrap; gap: 10px;">`;
  missingLinks.forEach(link => {
     injectionHtml += `\n  <a href="${link.url}" class="button" style="padding: 10px 15px; background: #f4f6f8; border: 1px solid #c9cccf; border-radius: 4px; text-decoration: none; color: #202223; font-weight: 500;">${link.label}</a>`;
  });
  injectionHtml += `\n</div>`;
  return newHtml + injectionHtml;
}

// --- 4. MAIN COMPONENT ---
export default function DwellWeb() {
  const { products, pages, articles, livePaths, loaderError } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [editorType, setEditorType] = useState("pages"); 
  const [activeItem, setActiveItem] = useState(null);
  const [contentHtml, setContentHtml] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const handleTabChange = (index) => setSelectedTab(index);

  const evaluatedProducts = useMemo(() => evaluateProducts(products, livePaths), [products, livePaths]);
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
        <Card>
          <BlockStack gap="300">
            <Text variant="headingMd">Global Rule (All Products)</Text>
            <Text tone="subdued">Every product must contain these two footer buttons.</Text>
            <Box padding="300" background="bg-surface-secondary" borderRadius="100">
              <BlockStack gap="200">
                {GLOBAL_LINKS.map(renderLinkRule)}
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
        : p.isCompliant 
          ? <Badge tone="success">✅ Compliant</Badge> 
          : <Badge tone="critical">🔴 {p.missing.length} Missing</Badge>,
      p.hasDeadLinks
        ? <Text tone="critical">Rule contains dead link</Text>
        : p.isCompliant ? <Text tone="subdued">—</Text> : p.missing.map(m => m.label).join(", ")
    ]);

    return (
      <Card padding="0">
        <DataTable
          columnContentTypes={['text', 'numeric', 'text', 'text']}
          headings={['Product', 'Required Links', 'Status', 'Missing Targets']}
          rows={rows}
        />
      </Card>
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

    return (
      <BlockStack gap="400">
        <Card background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingMd">Bulk Action</Text>
              <Text tone="subdued">Found {nonCompliantProducts.length} products with broken Dwell loops.</Text>
            </BlockStack>
            <Tooltip content={hasDeadLinkConfig ? "Fix dead links in Rules tab first." : "Inject links into all missing products."}>
              <div>
                <Button 
                  size="large"
                  variant="primary" 
                  onClick={handleBulkInject}
                  loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "bulkInjectLinks"}
                  disabled={hasDeadLinkConfig}
                >
                  ⚡ Bulk Inject All Missing Links
                </Button>
              </div>
            </Tooltip>
          </InlineStack>
        </Card>

        {fetcher.data?.message && ["injectLinks", "bulkInjectLinks"].includes(fetcher.formData?.get("intent")) && (
          <Banner tone="success">{fetcher.data.message}</Banner>
        )}
        
        {nonCompliantProducts.map(p => (
          <Card key={p.id}>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="headingSm">{p.title}</Text>
                  <Text variant="bodySm" tone="subdued">
                    Found in: {p.collectionHandles.filter(h => COLLECTION_RULES[h]).map(h => COLLECTION_RULES[h].name).join(", ") || "Global Only"}
                  </Text>
                </BlockStack>
                <Button 
                  variant="primary" 
                  onClick={() => handleInject(p)}
                  loading={fetcher.state === "submitting" && fetcher.formData?.get("id") === p.id}
                  disabled={p.hasDeadLinks}
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
                        {l.label} {l.isDead && "(DEAD URL)"}
                      </Badge>
                    ))}
                  </InlineStack>
                </Box>
              </InlineStack>
            </BlockStack>
          </Card>
        ))}
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
              {fetcher.data?.message && ["updatePage", "updateArticle"].includes(fetcher.formData?.get("intent")) && (
                <Banner tone="success">{fetcher.data.message}</Banner>
              )}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text variant="headingLg">{activeItem.title}</Text>
                    <Button variant="primary" onClick={handleSaveContent} loading={fetcher.state === "submitting"}>
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
    >
      <Box paddingBlockEnd="400">
        <Button onClick={() => navigate("/app/_index")}>← Command Center</Button>
      </Box>

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
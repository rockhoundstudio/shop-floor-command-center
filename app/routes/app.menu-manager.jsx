import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  TextField, Badge, Banner, Box, Icon, Select, Divider
} from "@shopify/polaris";
import {
  PlusIcon, DeleteIcon, AlertTriangleIcon, CheckCircleIcon, MagicIcon
} from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const res = await admin.graphql(`
      query {
        menus(first: 50) {
          edges {
            node {
              id title handle
              items {
                id title url type
                items { id title url type }
              }
            }
          }
        }
        collections(first: 250) {
          edges { node { id title handle } }
        }
        pages(first: 100) {
          edges { node { id title handle } }
        }
      }
    `);
    const json = await res.json();
    const menus = (json.data?.menus?.edges || []).map(e => e.node);
    const collections = (json.data?.collections?.edges || []).map(e => e.node);
    const pages = (json.data?.pages?.edges || []).map(e => e.node);
    const liveCollectionHandles = collections.map(c => c.handle);
    const livePageHandles = pages.map(p => p.handle);
    return data({ menus, collections, pages, liveCollectionHandles, livePageHandles });
  } catch (error) {
    return data({ menus: [], collections: [], pages: [], liveCollectionHandles: [], livePageHandles: [] });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateMenu") {
    const id = formData.get("id");
    const title = formData.get("title");
    const handle = formData.get("handle");
    const itemsRaw = formData.get("items");

    const formatItem = (item) => ({
      title: item.title,
      url: item.url || "#",
      type: "HTTP",
      items: item.items && item.items.length > 0 ? item.items.map(formatItem) : []
    });

    const items = JSON.parse(itemsRaw).map(formatItem);

    const res = await admin.graphql(`
      mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
          userErrors { message }
        }
      }
    `, { variables: { id, title, handle, items } });

    const json = await res.json();
    if (json.data?.menuUpdate?.userErrors?.length)
      return data({ ok: false, error: json.data.menuUpdate.userErrors[0].message });
    return data({ ok: true, message: "Menu saved successfully!" });
  }
  return data({ ok: false });
};

function getDestinationStatus(url, liveCollectionHandles, livePageHandles) {
  if (!url || url.trim() === "" || url === "#") return "dead";
  if (url === "/" || url === "/collections/all") return "live";
  const collMatch = url.match(/^\/collections\/(.+)$/);
  if (collMatch) return liveCollectionHandles.includes(collMatch[1]) ? "live" : "dead";
  const pageMatch = url.match(/^\/pages\/(.+)$/);
  if (pageMatch) return livePageHandles.includes(pageMatch[1]) ? "live" : "draft";
  if (url.startsWith("http")) return "external";
  return "unknown";
}

function StatusBadge({ status }) {
  const map = {
    live:     { tone: "success",  label: "🟢 Live" },
    draft:    { tone: "warning",  label: "🟡 Draft / Unverified" },
    dead:     { tone: "critical", label: "🔴 Dead" },
    external: { tone: "info",     label: "🔗 External" },
    unknown:  { tone: "warning",  label: "⚠️ Unknown" },
  };
  const { tone, label } = map[status] || map.unknown;
  return <Badge tone={tone}>{label}</Badge>;
}

function countByStatus(items, liveCollectionHandles, livePageHandles) {
  let live = 0, draft = 0, dead = 0;
  const check = (url) => {
    const s = getDestinationStatus(url, liveCollectionHandles, livePageHandles);
    if (s === "live" || s === "external") live++;
    else if (s === "draft" || s === "unknown") draft++;
    else dead++;
  };
  items.forEach(item => {
    check(item.url);
    (item.items || []).forEach(child => check(child.url));
  });
  return { live, draft, dead };
}

export default function MenuManager() {
  const { menus, collections, pages, liveCollectionHandles, livePageHandles } = useLoaderData();
  const fetcher = useFetcher();

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuTitle, setMenuTitle] = useState("");
  const [scanned, setScanned] = useState(false);
  const [globalScan, setGlobalScan] = useState(null);

  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...collections.map(c => ({ label: `📦 ${c.title}`, value: `/collections/${c.handle}` })),
    ...pages.map(p => ({ label: `📄 ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    setMenuItems(menu.items.map(item => ({
      id: item.id || Math.random().toString(),
      title: item.title,
      url: item.url || "",
      items: (item.items || []).map(child => ({
        id: child.id || Math.random().toString(),
        title: child.title,
        url: child.url || ""
      }))
    })));
    setScanned(globalScan !== null);
  };

  const handleAddLink = () => {
    setMenuItems([...menuItems, { id: Math.random().toString(), title: "New Link", url: "", items: [] }]);
    setScanned(false);
  };

  const handleUpdateLink = (id, field, value) => {
    setMenuItems(menuItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    setScanned(false);
  };

  const handleDeleteLink = (id) => {
    setMenuItems(menuItems.filter(item => item.id !== id));
    setScanned(false);
  };

  const handleScan = () => setScanned(true);

  const handleGlobalScan = () => {
    const result = {};
    menus.forEach(menu => {
      result[menu.id] = countByStatus(menu.items, liveCollectionHandles, livePageHandles);
    });
    setGlobalScan(result);
    setScanned(true);
  };

  const autoFillCollections = () => {
    const newLinks = collections.map(c => ({
      id: Math.random().toString(),
      title: c.title,
      url: `/collections/${c.handle}`,
      items: []
    }));
    setMenuItems([...menuItems, ...newLinks]);
  };

  const autoCleanDeadLinks = () => {
    setMenuItems(menuItems.filter(item =>
      getDestinationStatus(item.url, liveCollectionHandles, livePageHandles) !== "dead"
    ));
    setScanned(true);
  };

  const handleSaveMenu = () => {
    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", activeMenu.id);
    fd.append("title", menuTitle);
    fd.append("handle", activeMenu.handle);
    fd.append("items", JSON.stringify(menuItems));
    fetcher.submit(fd, { method: "post" });
  };

  const activeCounts = scanned && activeMenu
    ? countByStatus(menuItems, liveCollectionHandles, livePageHandles)
    : null;

  return (
    <Page
      title="Menu Manager 🗂️"
      subtitle="Link Governance — Nav Audit & Repair"
      backAction={{ content: "Command Center", url: "/app/_index" }}
    >
      <Layout>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Your Menus</Text>
                  <Button size="slim" onClick={handleGlobalScan}>Scan All</Button>
                </InlineStack>
                <Divider />
                {menus.map((menu) => {
                  const counts = globalScan?.[menu.id];
                  return (
                    <Box
                      key={menu.id}
                      padding="300"
                      background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="100"
                      onClick={() => handleSelectMenu(menu)}
                      style={{ cursor: "pointer" }}
                    >
                      <BlockStack gap="100">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"}>
                            {menu.title}
                          </Text>
                          <Badge tone="info">{menu.items.length} Links</Badge>
                        </InlineStack>
                        {counts && (
                          <InlineStack gap="100">
                            <Badge tone="success">🟢 {counts.live}</Badge>
                            {counts.draft > 0 && <Badge tone="warning">🟡 {counts.draft}</Badge>}
                            {counts.dead > 0 && <Badge tone="critical">🔴 {counts.dead}</Badge>}
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm">🕸️ Link Governance</Text>
                <Text tone="subdued" variant="bodySm">
                  Nav links checked here. Body copy links checked in Dwell Web Manager.
                </Text>
                <Button url="/app/dwell-web-manager" disabled>
                  Run Full Site Audit → (coming soon)
                </Button>
              </BlockStack>
            </Card>

            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
            {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          {!activeMenu ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text variant="headingLg" tone="subdued">Select a menu on the left to start editing.</Text>
              </Box>
            </Card>
          ) : (
            <BlockStack gap="400">

              {activeCounts && (
                <Banner tone={activeCounts.dead > 0 ? "critical" : activeCounts.draft > 0 ? "warning" : "success"}>
                  <Text>
                    Scan complete — 🟢 {activeCounts.live} live &nbsp;|&nbsp;
                    🟡 {activeCounts.draft} draft/unverified &nbsp;|&nbsp;
                    🔴 {activeCounts.dead} dead
                  </Text>
                </Banner>
              )}

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm">✨ Quick Actions</Text>
                  <InlineStack gap="200" wrap>
                    <Button icon={MagicIcon} onClick={autoFillCollections}>🪄 Auto-Fill All Collections</Button>
                    <Button icon={AlertTriangleIcon} onClick={autoCleanDeadLinks}>🧹 Remove Dead Links</Button>
                    <Button onClick={handleScan}>🔍 Scan This Menu</Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="500">
                  <TextField
                    label="Menu Title"
                    value={menuTitle}
                    onChange={setMenuTitle}
                    autoComplete="off"
                  />

                  <Box padding="400" borderRadius="200" borderWidth="025" borderColor="border">
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text variant="headingSm">Menu Links ({menuItems.length})</Text>
                        <Button icon={PlusIcon} variant="primary" onClick={handleAddLink}>Add Link</Button>
                      </InlineStack>

                      {menuItems.map((item) => {
                        const status = scanned
                          ? getDestinationStatus(item.url, liveCollectionHandles, livePageHandles)
                          : null;
                        return (
                          <Card key={item.id} background="bg-surface">
                            <BlockStack gap="200">
                              <InlineStack align="space-between" blockAlign="center">
                                {status
                                  ? <StatusBadge status={status} />
                                  : <Badge tone="info">Not scanned</Badge>
                                }
                                <Button
                                  icon={DeleteIcon}
                                  tone="critical"
                                  variant="plain"
                                  onClick={() => handleDeleteLink(item.id)}
                                />
                              </InlineStack>
                              <InlineStack blockAlign="end" gap="300" wrap>
                                <div style={{ flex: 1, minWidth: "140px" }}>
                                  <TextField
                                    label="Display Name"
                                    value={item.title}
                                    onChange={(v) => handleUpdateLink(item.id, "title", v)}
                                    autoComplete="off"
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: "180px" }}>
                                  <Select
                                    label="Quick Select"
                                    options={linkOptions}
                                    value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"}
                                    onChange={(v) => v !== "custom" && handleUpdateLink(item.id, "url", v)}
                                  />
                                </div>
                                <div style={{ flex: 1, minWidth: "180px" }}>
                                  <TextField
                                    label="URL Path"
                                    value={item.url}
                                    onChange={(v) => handleUpdateLink(item.id, "url", v)}
                                    autoComplete="off"
                                    error={
                                      scanned && status === "dead"
                                        ? "Dead link — destination not found"
                                        : scanned && status === "draft"
                                        ? "Page may be unpublished"
                                        : undefined
                                    }
                                  />
                                </div>
                              </InlineStack>
                            </BlockStack>
                          </Card>
                        );
                      })}
                    </BlockStack>
                  </Box>

                  <InlineStack align="end">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleSaveMenu}
                      loading={fetcher.state === "submitting"}
                    >
                      Save Menu
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

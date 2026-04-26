import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  TextField, Badge, Banner, Box, Icon, Select
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, AlertTriangleIcon, CheckCircleIcon, MagicIcon } from "@shopify/polaris-icons";

// ── GID MAP ────────────────────────────────────────────────────────────────
const MENU_GID = "gid://shopify/Menu/252615295227";

const MENU_ITEM_GIDS = {
  "gid://shopify/MenuItem/619586322683": { title: "all collections",             url: "/collections/all-collections" },
  "gid://shopify/MenuItem/619586355451": { title: "Touch Stones & Mile Stones",  url: "/collections/memorials" },
  "gid://shopify/MenuItem/619586388219": { title: "Small Batches / The Vault",   url: "/collections/small-batches-the-vault" },
  "gid://shopify/MenuItem/619586420987": { title: "Wearable Art",                url: "/collections/wearable-art" },
  "gid://shopify/MenuItem/619586453755": { title: "The Yakima Canyon Collection", url: "/collections/yakima-canyon" },
  "gid://shopify/MenuItem/619586486523": { title: "The Gallery",                 url: "/collections/the-gallery" },
  "gid://shopify/MenuItem/619586519291": { title: "Richardson's Rock Ranch",     url: "/collections/richardsons-rock-ranch" },
  "gid://shopify/MenuItem/619586552059": { title: "The 3,000-Mile Run",          url: "/collections/the-3-000-mile-run-1" },
  "gid://shopify/MenuItem/619586584827": { title: "Home",                        url: "/" },
};

const COLLECTION_GIDS = {
  "gid://shopify/Collection/452654924027": { title: "all collections",             handle: "all-collections" },
  "gid://shopify/Collection/452655775995": { title: "Touch Stones & Mile Stones",  handle: "memorials" },
  "gid://shopify/Collection/452658528507": { title: "Small Batches / The Vault",   handle: "small-batches-the-vault" },
  "gid://shopify/Collection/452823482619": { title: "Wearable Art",                handle: "wearable-art" },
  "gid://shopify/Collection/452884922619": { title: "The Yakima Canyon Collection", handle: "yakima-canyon" },
  "gid://shopify/Collection/452886495483": { title: "The Gallery",                 handle: "the-gallery" },
  "gid://shopify/Collection/452912972027": { title: "Richardson's Rock Ranch",     handle: "richardsons-rock-ranch" },
  "gid://shopify/Collection/452913135867": { title: "The 3,000-Mile Run",          handle: "the-3-000-mile-run-1" },
};
// ── END GID MAP ────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const res = await admin.graphql(`
      query {
        menus(first: 50) {
          edges { node { id title handle items { id title url type items { id title url type } } } }
        }
        collections(first: 100) {
          edges { node { id title handle } }
        }
        pages(first: 50) {
          edges { node { id title handle } }
        }
      }
    `);
    const json = await res.json();
    const menus = (json.data?.menus?.edges || []).map(e => e.node);
    const collections = (json.data?.collections?.edges || []).map(e => e.node);
    const pages = (json.data?.pages?.edges || []).map(e => e.node);
    return data({ menus, collections, pages });
  } catch (error) {
    return data({ menus: [], collections: [], pages: [] });
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
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) { userErrors { message } }
      }
    `, { variables: { id, title, handle, items } });

    const json = await res.json();
    if (json.data?.menuUpdate?.userErrors?.length)
      return data({ ok: false, error: json.data.menuUpdate.userErrors[0].message });
    return data({ ok: true, message: "Menu Saved Successfully!" });
  }
  return data({ ok: false });
};

export default function MenuManager() {
  const { menus, collections, pages } = useLoaderData();
  const fetcher = useFetcher();

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuTitle, setMenuTitle] = useState("");
  const [scanned, setScanned] = useState(false);

  // Resolve GID display name for menu item badge
  const resolveItemGidLabel = (id) => MENU_ITEM_GIDS[id] ? "✅ GID Matched" : "⚠️ No GID";

  // Build dropdown options
  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...Object.values(COLLECTION_GIDS).map(c => ({
      label: `📦 Collection: ${c.title}`,
      value: `/collections/${c.handle}`
    })),
    ...pages.map(p => ({ label: `📄 Page: ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    const parsedItems = menu.items.map(item => ({
      id: item.id || Math.random().toString(),
      title: item.title,
      url: item.url || "",
      items: item.items ? item.items.map(child => ({
        id: child.id || Math.random().toString(),
        title: child.title,
        url: child.url || ""
      })) : []
    }));
    setMenuItems(parsedItems);
    setScanned(false);
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
  };

  const handleScan = () => setScanned(true);

  const verifyUrl = (url) => {
    if (!url || url.trim() === "" || url === "#") return "critical";
    if (!url.startsWith("/") && !url.startsWith("http")) return "warning";
    return "success";
  };

  const autoFillCollections = () => {
    const newLinks = Object.values(COLLECTION_GIDS).map(c => ({
      id: Math.random().toString(),
      title: c.title,
      url: `/collections/${c.handle}`,
      items: []
    }));
    setMenuItems([...menuItems, ...newLinks]);
  };

  const autoCleanDeadLinks = () => {
    setMenuItems(menuItems.filter(item => verifyUrl(item.url) !== "critical"));
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

  return (
    <Page title="Menu Maker 🗂️" subtitle="Prestige V11 Mega-Menu Factory" backAction={{ content: "Command Center", url: "/app" }}>
      <Layout>

        {/* LEFT COLUMN */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Your Menus</Text>
                {menus.map((menu) => (
                  <Box key={menu.id} padding="200"
                    background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                    borderWidth="025" borderColor="border" borderRadius="100"
                    onClick={() => handleSelectMenu(menu)} style={{ cursor: "pointer" }}>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"}>{menu.title}</Text>
                      <BlockStack gap="100">
                        <Badge tone="info">{menu.items.length} Links</Badge>
                        {menu.id === MENU_GID && <Badge tone="success">GID ✅</Badge>}
                      </BlockStack>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </Card>
            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
            {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}
          </BlockStack>
        </Layout.Section>

        {/* RIGHT COLUMN */}
        <Layout.Section>
          {!activeMenu ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text variant="headingLg" tone="subdued">Select a menu on the left to start editing.</Text>
              </Box>
            </Card>
          ) : (
            <BlockStack gap="400">

              {/* MAGIC AUTOMATION PANEL */}
              <Card background="bg-surface-secondary">
                <BlockStack gap="300">
                  <Text variant="headingSm">✨ Janyce's Magic Automations</Text>
                  <InlineStack gap="200" wrap>
                    <Button icon={MagicIcon} onClick={autoFillCollections}>🪄 Auto-Fill All Collections</Button>
                    <Button icon={AlertTriangleIcon} onClick={autoCleanDeadLinks}>🧹 Clean Dead Links</Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* VISUAL EDITOR */}
              <Card>
                <BlockStack gap="500">
                  <TextField label="Menu Title" value={menuTitle} onChange={setMenuTitle} autoComplete="off" />

                  <Box padding="400" borderRadius="200" borderWidth="025" borderColor="border">
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text variant="headingSm">Menu Links</Text>
                        <InlineStack gap="200">
                          <Button onClick={handleScan}>Scan Links</Button>
                          <Button icon={PlusIcon} variant="primary" onClick={handleAddLink}>Add Link</Button>
                        </InlineStack>
                      </InlineStack>

                      {menuItems.map((item) => {
                        const status = verifyUrl(item.url);
                        const gidLabel = resolveItemGidLabel(item.id);
                        return (
                          <Card key={item.id} background="bg-surface">
                            <BlockStack gap="200">
                              <InlineStack align="space-between">
                                <Badge tone={MENU_ITEM_GIDS[item.id] ? "success" : "warning"}>{gidLabel}</Badge>
                                <Text tone="subdued" variant="bodySm">{item.id}</Text>
                              </InlineStack>
                              <InlineStack blockAlign="end" gap="300">
                                <div style={{ flex: 1 }}>
                                  <TextField label="Display Name" value={item.title}
                                    onChange={(v) => handleUpdateLink(item.id, "title", v)} autoComplete="off" />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <Select label="Quick Select Destination" options={linkOptions}
                                    value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"}
                                    onChange={(v) => v !== "custom" && handleUpdateLink(item.id, "url", v)} />
                                </div>
                                <div style={{ flex: 1 }}>
                                  <TextField label="URL Path" value={item.url}
                                    onChange={(v) => handleUpdateLink(item.id, "url", v)} autoComplete="off" />
                                </div>
                                {scanned && status === "success" && <Icon source={CheckCircleIcon} tone="success" />}
                                {scanned && status === "critical" && <Icon source={AlertTriangleIcon} tone="critical" />}
                                <Button icon={DeleteIcon} tone="critical" variant="plain"
                                  onClick={() => handleDeleteLink(item.id)} />
                              </InlineStack>
                            </BlockStack>
                          </Card>
                        );
                      })}
                    </BlockStack>
                  </Box>

                  <InlineStack align="end">
                    <Button variant="primary" size="large" onClick={handleSaveMenu}
                      loading={fetcher.state === "submitting"}>Save Menu</Button>
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

import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button, 
  TextField, Badge, Banner, Box, Icon, Select
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, AlertTriangleIcon, CheckCircleIcon, MagicIcon } from "@shopify/polaris-icons";

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
    if (json.data?.menuUpdate?.userErrors?.length) return data({ ok: false, error: json.data.menuUpdate.userErrors[0].message });
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

  // Build the dropdown options for Janyce
  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...collections.map(c => ({ label: `📦 Collection: ${c.title}`, value: `/collections/${c.handle}` })),
    ...pages.map(p => ({ label: `📄 Page: ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    const parsedItems = menu.items.map(item => ({ 
      id: item.id || Math.random().toString(), title: item.title, url: item.url || "",
      items: item.items ? item.items.map(child => ({ id: child.id || Math.random().toString(), title: child.title, url: child.url || "" })) : []
    }));
    setMenuItems(parsedItems);
    setScanned(false);
  };

  const handleAddLink = () => {
    setMenuItems([...menuItems, { id: Math.random().toString(), title: "New Link", url: "" }]);
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

  // --- THE AUTOMATIONS ---
  const autoFillCollections = () => {
    const newLinks = collections.map(c => ({
      id: Math.random().toString(), title: c.title, url: `/collections/${c.handle}`, items: []
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
                  <Box key={menu.id} padding="200" background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                    borderWidth="025" borderColor="border" borderRadius="100" onClick={() => handleSelectMenu(menu)}
                    style={{ cursor: "pointer" }}>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"}>{menu.title}</Text>
                      <Badge tone="info">{menu.items.length} Links</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </Card>
            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
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
                        return (
                          <Card key={item.id} background="bg-surface">
                            <InlineStack blockAlign="end" gap="300">
                              <div style={{ flex: 1 }}>
                                <TextField label="Display Name" value={item.title} onChange={(v) => handleUpdateLink(item.id, "title", v)} autoComplete="off" />
                              </div>
                              <div style={{ flex: 1 }}>
                                {/* THE DROP-DOWN LINK FINDER */}
                                <Select 
                                  label="Quick Select Destination" 
                                  options={linkOptions} 
                                  value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"} 
                                  onChange={(v) => v !== "custom" && handleUpdateLink(item.id, "url", v)} 
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <TextField label="URL Path" value={item.url} onChange={(v) => handleUpdateLink(item.id, "url", v)} autoComplete="off" />
                              </div>
                              {scanned && status === "success" && <Icon source={CheckCircleIcon} tone="success" />}
                              {scanned && status === "critical" && <Icon source={AlertTriangleIcon} tone="critical" />}
                              <Button icon={DeleteIcon} tone="critical" variant="plain" onClick={() => handleDeleteLink(item.id)} />
                            </InlineStack>
                          </Card>
                        );
                      })}
                    </BlockStack>
                  </Box>

                  <InlineStack align="end">
                    <Button variant="primary" size="large" onClick={handleSaveMenu} loading={fetcher.state === "submitting"}>Save Menu</Button>
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
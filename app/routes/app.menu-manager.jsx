import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Badge,
  Banner,
  Box,
  Icon,
  Modal,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const res = await admin.graphql(`
      query {
        menus(first: 50) {
          edges {
            node {
              id
              title
              handle
              items {
                id
                title
                url
                type
              }
            }
          }
        }
      }
    `);
    const json = await res.json();
    if (json.errors) console.error("🚨 GraphQL Menu Error:", json.errors);
    
    const menus = (json.data?.menus?.edges || []).map(e => e.node);
    return data({ menus });
  } catch (error) {
    console.error("🚨 FATAL MENU LOADER ERROR:", error);
    return data({ menus: [] });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "createMenu") {
      const title = formData.get("title");
      const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const res = await admin.graphql(`
        mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) {
            menu { id }
            userErrors { field message }
          }
        }
      `, { variables: { title, handle, items: [] } });
      const json = await res.json();
      if (json.data?.menuCreate?.userErrors?.length) return data({ ok: false, error: json.data.menuCreate.userErrors[0].message });
      return data({ ok: true, intent, message: "Menu Created!" });
    }

    if (intent === "updateMenu") {
      const id = formData.get("id");
      const title = formData.get("title");
      const handle = formData.get("handle");
      const itemsRaw = formData.get("items");
      
      // Map visual items back to Shopify's strict API requirements
      const items = JSON.parse(itemsRaw).map(item => ({
        title: item.title,
        url: item.url || "#", 
        type: "HTTP" // Forces standard link behavior
      }));

      const res = await admin.graphql(`
        mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
            menu { id }
            userErrors { field message }
          }
        }
      `, { variables: { id, title, handle, items } });
      const json = await res.json();
      if (json.data?.menuUpdate?.userErrors?.length) return data({ ok: false, error: json.data.menuUpdate.userErrors[0].message });
      return data({ ok: true, intent, message: "Menu Saved Successfully!" });
    }

    if (intent === "deleteMenu") {
      const id = formData.get("id");
      const res = await admin.graphql(`
        mutation menuDelete($id: ID!) {
          menuDelete(id: $id) {
            deletedId
            userErrors { field message }
          }
        }
      `, { variables: { id } });
      const json = await res.json();
      if (json.data?.menuDelete?.userErrors?.length) return data({ ok: false, error: json.data.menuDelete.userErrors[0].message });
      return data({ ok: true, intent, message: "Menu Deleted." });
    }
  } catch (err) {
    console.error("🚨 MENU ACTION ERROR:", err);
    return data({ ok: false, error: "Server disconnected. Check logs." });
  }
  return data({ ok: false });
};

export default function MenuManager() {
  const { menus } = useLoaderData();
  const fetcher = useFetcher();

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuTitle, setMenuTitle] = useState("");
  
  const [createModal, setCreateModal] = useState(false);
  const [newMenuTitle, setNewMenuTitle] = useState("");
  
  const [scanned, setScanned] = useState(false);

  // Load menu into the visual editor
  const handleSelectMenu = (menu) => {
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    setMenuItems(menu.items.map(item => ({ id: item.id || Math.random().toString(), title: item.title, url: item.url || "" })));
    setScanned(false);
  };

  // Add a blank slot for Janyce to type in
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

  const verifyUrl = (url) => {
    if (!url || url.trim() === "" || url === "#") return "critical"; // Dead link
    if (!url.startsWith("/") && !url.startsWith("http")) return "warning"; // Might be broken formatting
    return "success"; // Looks good
  };

  const handleScan = () => {
    setScanned(true);
  };

  // Master Save
  const handleSaveMenu = () => {
    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", activeMenu.id);
    fd.append("title", menuTitle);
    fd.append("handle", activeMenu.handle);
    fd.append("items", JSON.stringify(menuItems));
    fetcher.submit(fd, { method: "post" });
  };

  // Master Create
  const handleCreateMenu = () => {
    if (!newMenuTitle) return;
    const fd = new FormData();
    fd.append("intent", "createMenu");
    fd.append("title", newMenuTitle);
    fetcher.submit(fd, { method: "post" });
    setCreateModal(false);
    setNewMenuTitle("");
  };

  // Master Delete
  const handleDeleteMenu = (id) => {
    if(!confirm("Are you sure you want to delete this entire menu?")) return;
    const fd = new FormData();
    fd.append("intent", "deleteMenu");
    fd.append("id", id);
    fetcher.submit(fd, { method: "post" });
    if (activeMenu?.id === id) setActiveMenu(null);
  };

  return (
    <Page title="Menu Maker 🗂️" subtitle="Point, Click, and Verify.">
      <Layout>
        {/* LEFT COLUMN: Menu List */}
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">Your Menus</Text>
                  <Button icon={PlusIcon} size="slim" onClick={() => setCreateModal(true)}>New Menu</Button>
                </InlineStack>
                
                {menus.map((menu) => (
                  <Box 
                    key={menu.id} 
                    padding="200" 
                    background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                    borderWidth="025"
                    borderColor="border"
                    borderRadius="100"
                    onClick={() => handleSelectMenu(menu)}
                    style={{ cursor: "pointer", transition: "all 0.2s" }}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"}>{menu.title}</Text>
                      <Badge tone="info">{menu.items.length} Links</Badge>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
            </Card>

            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
            {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}

          </BlockStack>
        </Layout.Section>

        {/* RIGHT COLUMN: The Visual Editor */}
        <Layout.Section>
          {!activeMenu ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text variant="headingLg" tone="subdued">Select a menu on the left to start editing.</Text>
              </Box>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between" blockAlign="center">
                  <div style={{ flex: 1, paddingRight: "16px" }}>
                    <TextField label="Menu Title" value={menuTitle} onChange={setMenuTitle} autoComplete="off" />
                  </div>
                  <Button tone="critical" variant="plain" onClick={() => handleDeleteMenu(activeMenu.id)}>Delete Menu</Button>
                </InlineStack>

                <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                  <BlockStack gap="300">
                    <InlineStack align="space-between">
                      <Text variant="headingSm">Menu Links</Text>
                      <InlineStack gap="200">
                        <Button icon={AlertTriangleIcon} onClick={handleScan}>Scan Links</Button>
                        <Button icon={PlusIcon} variant="primary" onClick={handleAddLink}>Add Link</Button>
                      </InlineStack>
                    </InlineStack>

                    {menuItems.length === 0 && <Text tone="subdued">No links yet. Click Add Link.</Text>}

                    {menuItems.map((item, index) => {
                      const status = verifyUrl(item.url);
                      return (
                        <Card key={item.id} background="bg-surface">
                          <InlineStack blockAlign="end" gap="300">
                            <div style={{ flex: 1 }}>
                              <TextField 
                                label="Display Name" 
                                value={item.title} 
                                onChange={(v) => handleUpdateLink(item.id, "title", v)} 
                                autoComplete="off"
                              />
                            </div>
                            <div style={{ flex: 2 }}>
                              <TextField 
                                label="URL Destination" 
                                value={item.url} 
                                onChange={(v) => handleUpdateLink(item.id, "url", v)} 
                                placeholder="/collections/agate"
                                autoComplete="off"
                                helpText={scanned && status === "critical" ? <Text tone="critical">Warning: Blank or dead link.</Text> : null}
                              />
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
                  <Button variant="primary" size="large" onClick={handleSaveMenu} loading={fetcher.state === "submitting"}>
                    Save Menu
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>

      {/* CREATE MODAL */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Create New Menu" primaryAction={{ content: 'Create', onAction: handleCreateMenu }}>
        <Modal.Section>
          <TextField label="Menu Name" value={newMenuTitle} onChange={setNewMenuTitle} placeholder="e.g. Footer Links" autoComplete="off" />
        </Modal.Section>
      </Modal>

    </Page>
  );
}
import React, { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Button, Badge, BlockStack, InlineStack, Box,
  DataTable, TextField, Modal, Banner, Toast, Frame, ResourceList,
  ResourceItem, Divider, Spinner, EmptySearchResult, Icon
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, MenuIcon, ExternalIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// SERVER: LOADER (Fetch all menus)
// ==========================================
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  try {
    const response = await admin.graphql(`
      query GetAllMenus {
        menus(first: 50) {
          edges {
            node {
              id
              title
              handle
              itemsCount
            }
          }
        }
      }
    `, { 
      apiVersion: "2026-07" // Enforce the correct API version
    });

    const parsed = await response.json();

    // Catch GraphQL errors that return a 200 OK HTTP status
    if (parsed.errors) {
      console.error("GraphQL Errors in loader:", JSON.stringify(parsed.errors, null, 2));
      return { menus: [] }; // Safe fallback
    }

    const menus = parsed.data?.menus?.edges.map(e => e.node) || [];
    return { menus };

  } catch (error) {
    console.error("Loader failed to fetch menus:", error);
    
    // Log the full graphQLErrors array to console for debugging
    if (error.graphQLErrors) {
      console.error("Full graphQLErrors array:", JSON.stringify(error.graphQLErrors, null, 2));
    } else if (error.response?.errors) {
      console.error("Full response errors array:", JSON.stringify(error.response.errors, null, 2));
    } else {
      console.error("Error message:", error.message);
    }
    
    // Return safe fallback instead of crashing the route
    return { menus: [] };
  }
}

// ==========================================
// SERVER: ACTION (GraphQL Intent Engine)
// ==========================================
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    // --- FETCH SINGLE MENU (Live Inspector) ---
    if (intent === "fetchSingleMenu") {
      const menuId = formData.get("menuId");
      const response = await admin.graphql(`
        query GetSingleMenu($id: ID!) {
          menu(id: $id) {
            id
            title
            handle
            itemsCount
            items {
              id
              title
              url
              type
              items {
                id
                title
                url
                type
              }
            }
          }
        }
      `, { 
        variables: { id: menuId },
        apiVersion: "2026-07"
      });
      
      const json = await response.json();
      if (json.errors) {
        console.error("GraphQL Errors fetching single menu:", JSON.stringify(json.errors, null, 2));
      }
      return { success: true, menu: json.data?.menu || null };
    }

    // --- CREATE MENU ---
    if (intent === "createMenu") {
      const title = formData.get("title");
      const handle = formData.get("handle");
      
      const response = await admin.graphql(`
        mutation MenuCreate($menu: MenuCreateInput!) {
          menuCreate(menu: $menu) {
            menu { id title }
            userErrors { field message }
          }
        }
      `, { 
        variables: { menu: { title, handle } },
        apiVersion: "2026-07"
      });

      const json = await response.json();
      const errors = json.data?.menuCreate?.userErrors || [];
      
      if (errors.length > 0) return { success: false, errors, message: "Failed to create menu." };
      return { success: true, message: `Menu "${title}" created successfully.` };
    }

    // --- DELETE MENU ---
    if (intent === "deleteMenu") {
      const id = formData.get("menuId");
      const response = await admin.graphql(`
        mutation MenuDelete($id: ID!) {
          menuDelete(id: $id) {
            deletedId
            userErrors { field message }
          }
        }
      `, { 
        variables: { id },
        apiVersion: "2026-07"
      });

      const json = await response.json();
      const errors = json.data?.menuDelete?.userErrors || [];

      if (errors.length > 0) return { success: false, errors, message: "Failed to delete menu." };
      return { success: true, message: "Menu deleted successfully." };
    }

    return { success: false, errors: [{ message: "Unknown command" }] };
    
  } catch (error) {
    console.error("Action Error:", error);
    if (error.graphQLErrors) {
      console.error("Full graphQLErrors:", JSON.stringify(error.graphQLErrors, null, 2));
    }
    return { success: false, errors: [{ message: "Server error occurred during GraphQL operation." }] };
  }
}

// ==========================================
// CLIENT: COMPONENT
// ==========================================
export default function MenuManager() {
  const { menus } = useLoaderData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();

  // --- STATE ---
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [activeMenuId, setActiveMenuId] = useState("");
  const [actionErrors, setActionErrors] = useState([]);
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newMenuTitle, setNewMenuTitle] = useState("");
  const [newMenuHandle, setNewMenuHandle] = useState("");
  
  const [menuToDelete, setMenuToDelete] = useState(null);

  // --- HELPERS ---
  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  // --- MUTATION HANDLING ---
  useEffect(() => {
    if (actionFetcher.data) {
      const isSuccess = !!actionFetcher.data.success;
      if (actionFetcher.data.message) {
        setToastState({ active: true, message: actionFetcher.data.message, isError: !isSuccess });
      }
      if (isSuccess) {
        setIsCreateModalOpen(false);
        setMenuToDelete(null);
        setNewMenuTitle("");
        setNewMenuHandle("");
        // If we deleted the currently viewed menu, clear the inspector
        if (actionFetcher.formData?.get("intent") === "deleteMenu" && actionFetcher.formData?.get("menuId") === activeMenuId) {
          setActiveMenuId("");
        }
      }
      setActionErrors(actionFetcher.data.errors || []);
    }
  }, [actionFetcher.data, activeMenuId]);

  // --- LIVE FETCHING EFFECT ---
  useEffect(() => {
    if (activeMenuId) {
      inspectorFetcher.submit({ intent: "fetchSingleMenu", menuId: activeMenuId }, { method: "post" });
    }
  }, [activeMenuId]);

  const activeMenuDetails = inspectorFetcher.data?.menu;
  const isInspectorLoading = inspectorFetcher.state !== "idle";

  // --- ACTIONS ---
  const handleCreateMenu = () => {
    if (!newMenuTitle) return setToastState({ active: true, message: "Title is required", isError: true });
    actionFetcher.submit(
      { intent: "createMenu", title: newMenuTitle, handle: newMenuHandle },
      { method: "post" }
    );
  };

  const executeDelete = () => {
    if (menuToDelete) {
      actionFetcher.submit({ intent: "deleteMenu", menuId: menuToDelete.id }, { method: "post" });
    }
  };

  // --- RENDERERS ---
  const renderNestedItems = (items, depth = 0) => {
    if (!items || items.length === 0) return null;
    
    return (
      <BlockStack gap="200">
        {items.map((item, index) => (
          <Box key={item.id || index} paddingInlineStart={depth > 0 ? "400" : "0"}>
            <Card padding="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Icon source={MenuIcon} tone="subdued" />
                  <BlockStack>
                    <Text variant="bodyMd" fontWeight="bold">{item.title}</Text>
                    <Text variant="bodySm" color="subdued">{item.url || "No Link"}</Text>
                  </BlockStack>
                </InlineStack>
                <Badge tone="info">{item.type || "Link"}</Badge>
              </InlineStack>
            </Card>
            {item.items && item.items.length > 0 && (
              <Box paddingBlockStart="200">
                {renderNestedItems(item.items, depth + 1)}
              </Box>
            )}
          </Box>
        ))}
      </BlockStack>
    );
  };

  return (
    <Frame>
      <Page
        fullWidth
        title="Navigation Command Center"
        subtitle="Manage Shopify Menus via GraphQL GIDs"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        primaryAction={{
          content: "Create New Menu",
          icon: PlusIcon,
          onAction: () => setIsCreateModalOpen(true)
        }}
      >
        <Layout>
          {/* ERROR BANNER */}
          {actionErrors.length > 0 && (
            <Layout.Section>
              <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                <BlockStack gap="200">
                  {actionErrors.map((err, i) => <Text key={i} as="p">{err.message}</Text>)}
                </BlockStack>
              </Banner>
            </Layout.Section>
          )}

          {/* DUAL PANE LAYOUT */}
          <Layout.Section>
            <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '70vh' }}>
              
              {/* LEFT PANE: MENU LIST */}
              <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column' }}>
                <Card padding="0">
                  <Box padding="400" borderBottom="1px solid var(--p-color-border-subdued)">
                    <Text variant="headingMd" as="h2">Store Menus ({menus.length})</Text>
                  </Box>
                  <Scrollable style={{ height: '65vh' }}>
                    {menus.length === 0 && (
                      <Box padding="400">
                        <EmptySearchResult title="No menus found" description="Create a new menu to get started." withIllustration />
                      </Box>
                    )}
                    <ResourceList
                      resourceName={{ singular: "menu", plural: "menus" }}
                      items={menus}
                      renderItem={(item) => {
                        const isActive = item.id === activeMenuId;
                        return (
                          <ResourceItem
                            id={item.id}
                            onClick={() => setActiveMenuId(item.id)}
                            accessibilityLabel={`View menu ${item.title}`}
                          >
                            <Box background={isActive ? "bg-surface-secondary" : "transparent"} padding="200" borderRadius="200">
                              <InlineStack align="space-between" blockAlign="center">
                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight={isActive ? "bold" : "regular"}>{item.title}</Text>
                                  <Text variant="bodySm" color="subdued">Handle: {item.handle}</Text>
                                </BlockStack>
                                <Badge tone={item.itemsCount > 0 ? "success" : "warning"}>{item.itemsCount} items</Badge>
                              </InlineStack>
                            </Box>
                          </ResourceItem>
                        );
                      }}
                    />
                  </Scrollable>
                </Card>
              </div>

              {/* RIGHT PANE: LIVE INSPECTOR */}
              <div style={{ flex: 1 }}>
                <Card>
                  {!activeMenuId && (
                    <Box padding="800">
                      <EmptySearchResult
                        title="No Menu Selected"
                        description="Select a menu from the left panel to inspect its live navigation links."
                        withIllustration
                      />
                    </Box>
                  )}

                  {activeMenuId && (
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="400" blockAlign="center">
                          <Text variant="headingLg" as="h2">
                            {activeMenuDetails?.title || "Loading..."}
                          </Text>
                          {isInspectorLoading && <Spinner size="small" />}
                        </InlineStack>
                        <InlineStack gap="300">
                          <div style={tapTargetStyle}>
                            <Button 
                              icon={ExternalIcon} 
                              onClick={() => window.open(`shopify:admin/menus/${activeMenuId.split('/').pop()}`, '_blank')}
                              accessibilityLabel="Edit in Shopify Admin"
                            >
                              Deep Edit in Shopify
                            </Button>
                          </div>
                          <div style={tapTargetStyle}>
                            <Button 
                              tone="critical" 
                              icon={DeleteIcon} 
                              onClick={() => setMenuToDelete({ id: activeMenuId, title: activeMenuDetails?.title })}
                              accessibilityLabel="Delete this menu"
                            >
                              Delete Menu
                            </Button>
                          </div>
                        </InlineStack>
                      </InlineStack>

                      <Divider />

                      <Box paddingBlockStart="200">
                        <Text variant="headingMd" as="h3">Navigation Tree</Text>
                        <Box paddingBlockStart="400">
                          {activeMenuDetails?.items?.length === 0 && !isInspectorLoading && (
                            <Banner tone="warning">This menu has no links. Add links via the Shopify Admin.</Banner>
                          )}
                          {renderNestedItems(activeMenuDetails?.items)}
                        </Box>
                      </Box>
                    </BlockStack>
                  )}
                </Card>
              </div>
            </div>
          </Layout.Section>
        </Layout>

        {/* MODALS */}
        {isCreateModalOpen && (
          <Modal
            open={true}
            onClose={() => setIsCreateModalOpen(false)}
            title="Create New Menu"
            primaryAction={{
              content: "Create Menu",
              onAction: handleCreateMenu,
              tone: "success",
              loading: actionFetcher.state !== "idle"
            }}
            secondaryActions={[{ content: "Cancel", onAction: () => setIsCreateModalOpen(false) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <TextField
                  label="Menu Title"
                  value={newMenuTitle}
                  onChange={setNewMenuTitle}
                  autoComplete="off"
                  helpText="E.g., Footer Links, Main Menu"
                />
                <TextField
                  label="Menu Handle (Optional)"
                  value={newMenuHandle}
                  onChange={setNewMenuHandle}
                  autoComplete="off"
                  helpText="Leave blank to auto-generate from title"
                />
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {menuToDelete && (
          <Modal
            open={true}
            onClose={() => setMenuToDelete(null)}
            title={`Delete "${menuToDelete.title}"?`}
            primaryAction={{
              content: "Yes, Delete Menu",
              onAction: executeDelete,
              tone: "critical",
              loading: actionFetcher.state !== "idle"
            }}
            secondaryActions={[{ content: "Cancel", onAction: () => setMenuToDelete(null) }]}
          >
            <Modal.Section>
              <Text as="p">
                Are you sure you want to delete this menu? This action cannot be undone and will immediately remove it from your online store if it is currently linked in your theme.
              </Text>
            </Modal.Section>
          </Modal>
        )}

        {/* TOASTS */}
        {toastState.active && (
          <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />
        )}
      </Page>
    </Frame>
  );
}
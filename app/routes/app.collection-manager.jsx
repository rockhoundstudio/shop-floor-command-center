import React, { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, Badge, BlockStack, InlineStack, Box,
  TextField, Modal, Banner, Toast, Frame, ResourceList,
  ResourceItem, Divider, Spinner, EmptySearchResult, Thumbnail
} from "@shopify/polaris";
import { DeleteIcon, PlusIcon, ExternalIcon, CollectionsIcon, ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// SERVER: LOADER (Fetch all collections)
// ==========================================
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(`
    query GetAllCollections {
      collections(first: 50, sortKey: TITLE) {
        edges {
          node {
            id
            title
            handle
            image {
              url
              altText
            }
          }
        }
      }
    }
  `);

  const parsed = await response.json();
  const collections = parsed.data?.collections?.edges.map(e => e.node) || [];

  return { collections };
}

// ==========================================
// SERVER: ACTION (GraphQL Intent Engine)
// ==========================================
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // --- FETCH SINGLE COLLECTION (Live Inspector) ---
  if (intent === "fetchSingleCollection") {
    const collectionId = formData.get("collectionId");
    const response = await admin.graphql(`
      query GetSingleCollection($id: ID!) {
        collection(id: $id) {
          id
          title
          handle
          descriptionHtml
          image {
            url
            altText
          }
          products(first: 15) {
            pageInfo {
              hasNextPage
            }
            edges {
              node {
                id
                title
                status
                featuredImage {
                  url
                }
              }
            }
          }
        }
      }
    `, { variables: { id: collectionId } });
    
    const json = await response.json();
    return { success: true, collection: json.data?.collection || null };
  }

  // --- CREATE COLLECTION ---
  if (intent === "createCollection") {
    const title = formData.get("title");
    const handle = formData.get("handle");
    
    // Creating a basic manual collection
    const response = await admin.graphql(`
      mutation CollectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { input: { title, handle } } });

    const json = await response.json();
    const errors = json.data?.collectionCreate?.userErrors || [];
    
    if (errors.length > 0) return { success: false, errors, message: "Failed to create collection." };
    return { success: true, message: `Collection "${title}" created successfully.` };
  }

  // --- DELETE COLLECTION ---
  if (intent === "deleteCollection") {
    const id = formData.get("collectionId");
    const response = await admin.graphql(`
      mutation CollectionDelete($input: CollectionDeleteInput!) {
        collectionDelete(input: $input) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `, { variables: { input: { id } } });

    const json = await response.json();
    const errors = json.data?.collectionDelete?.userErrors || [];

    if (errors.length > 0) return { success: false, errors, message: "Failed to delete collection." };
    return { success: true, message: "Collection deleted successfully." };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}

// ==========================================
// CLIENT: COMPONENT
// ==========================================
export default function CollectionManager() {
  const { collections } = useLoaderData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();

  // --- STATE ---
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [actionErrors, setActionErrors] = useState([]);
  
  // Modal States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState("");
  const [newCollectionHandle, setNewCollectionHandle] = useState("");
  const [collectionToDelete, setCollectionToDelete] = useState(null);

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
        setCollectionToDelete(null);
        setNewCollectionTitle("");
        setNewCollectionHandle("");
        // If we deleted the currently viewed collection, clear the inspector
        if (actionFetcher.formData?.get("intent") === "deleteCollection" && actionFetcher.formData?.get("collectionId") === activeCollectionId) {
          setActiveCollectionId("");
        }
      }
      setActionErrors(actionFetcher.data.errors || []);
    }
  }, [actionFetcher.data, activeCollectionId]);

  // --- LIVE FETCHING EFFECT ---
  useEffect(() => {
    if (activeCollectionId) {
      inspectorFetcher.submit({ intent: "fetchSingleCollection", collectionId: activeCollectionId }, { method: "post" });
    }
  }, [activeCollectionId, inspectorFetcher]);

  const activeDetails = inspectorFetcher.data?.collection;
  const isInspectorLoading = inspectorFetcher.state !== "idle";

  // --- ACTIONS ---
  const handleCreateCollection = () => {
    if (!newCollectionTitle) return setToastState({ active: true, message: "Title is required", isError: true });
    actionFetcher.submit(
      { intent: "createCollection", title: newCollectionTitle, handle: newCollectionHandle },
      { method: "post" }
    );
  };

  const executeDelete = () => {
    if (collectionToDelete) {
      actionFetcher.submit({ intent: "deleteCollection", collectionId: collectionToDelete.id }, { method: "post" });
    }
  };

  return (
    <Frame>
      <Page
        fullWidth
        title="Collection Command Center"
        subtitle="Manage Shopify Collections via GraphQL GIDs"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        primaryAction={{
          content: "Create Collection",
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
              
              {/* LEFT PANE: COLLECTION LIST */}
              <div style={{ flex: '0 0 400px', display: 'flex', flexDirection: 'column' }}>
                <Card padding="0">
                  <Box padding="400" borderBottom="1px solid var(--p-color-border-subdued)">
                    <Text variant="headingMd" as="h2">Store Collections ({collections.length})</Text>
                  </Box>
                  <Scrollable style={{ height: '65vh' }}>
                    {collections.length === 0 && (
                      <Box padding="400">
                        <EmptySearchResult title="No collections found" description="Create a new collection to get started." withIllustration />
                      </Box>
                    )}
                    <ResourceList
                      resourceName={{ singular: "collection", plural: "collections" }}
                      items={collections}
                      renderItem={(item) => {
                        const isActive = item.id === activeCollectionId;
                        return (
                          <ResourceItem
                            id={item.id}
                            onClick={() => setActiveCollectionId(item.id)}
                            accessibilityLabel={`View collection ${item.title}`}
                          >
                            <Box background={isActive ? "bg-surface-secondary" : "transparent"} padding="200" borderRadius="200">
                              <InlineStack align="start" blockAlign="center" gap="300">
                                <Thumbnail
                                  source={item.image?.url || CollectionsIcon}
                                  alt={item.image?.altText || item.title}
                                  size="small"
                                />
                                <BlockStack gap="100">
                                  <Text variant="bodyMd" fontWeight={isActive ? "bold" : "regular"}>{item.title}</Text>
                                  <Text variant="bodySm" color="subdued">Handle: {item.handle}</Text>
                                </BlockStack>
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
                  {!activeCollectionId && (
                    <Box padding="800">
                      <EmptySearchResult
                        title="No Collection Selected"
                        description="Select a collection from the left panel to inspect its details and products."
                        withIllustration
                      />
                    </Box>
                  )}

                  {activeCollectionId && (
                    <BlockStack gap="400">
                      <InlineStack align="space-between" blockAlign="center">
                        <InlineStack gap="400" blockAlign="center">
                          <Text variant="headingLg" as="h2">
                            {activeDetails?.title || "Loading..."}
                          </Text>
                          {isInspectorLoading && <Spinner size="small" />}
                        </InlineStack>
                        <InlineStack gap="300">
                          <div style={tapTargetStyle}>
                            <Button 
                              icon={ExternalIcon} 
                              onClick={() => window.open(`shopify:admin/collections/${activeCollectionId.split('/').pop()}`, '_blank')}
                              accessibilityLabel="Edit in Shopify Admin"
                            >
                              Deep Edit in Shopify
                            </Button>
                          </div>
                          <div style={tapTargetStyle}>
                            <Button 
                              tone="critical" 
                              icon={DeleteIcon} 
                              onClick={() => setCollectionToDelete({ id: activeCollectionId, title: activeDetails?.title })}
                              accessibilityLabel="Delete this collection"
                            >
                              Delete
                            </Button>
                          </div>
                        </InlineStack>
                      </InlineStack>

                      <Divider />

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                        {/* Meta Details */}
                        <BlockStack gap="400">
                          <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                            <BlockStack gap="300">
                              <Text variant="headingSm" as="h3">Collection Details</Text>
                              <Thumbnail
                                source={activeDetails?.image?.url || ImageIcon}
                                alt={activeDetails?.image?.altText || "No image"}
                                size="large"
                              />
                              <Text as="p"><strong>Handle:</strong> {activeDetails?.handle}</Text>
                              <Text as="p"><strong>Description:</strong></Text>
                              {activeDetails?.descriptionHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: activeDetails.descriptionHtml }} style={{ fontSize: '14px', color: 'var(--p-color-text-subdued)' }} />
                              ) : (
                                <Text color="subdued" as="span">No description provided.</Text>
                              )}
                            </BlockStack>
                          </Box>
                        </BlockStack>

                        {/* Product Preview */}
                        <BlockStack gap="400">
                          <InlineStack align="space-between" blockAlign="center">
                            <Text variant="headingSm" as="h3">Product Preview (Top 15)</Text>
                            {activeDetails?.products?.pageInfo?.hasNextPage && (
                              <Badge tone="info">More products unlisted</Badge>
                            )}
                          </InlineStack>
                          
                          {activeDetails?.products?.edges.length === 0 && !isInspectorLoading && (
                            <Banner tone="warning">This collection has no products attached to it.</Banner>
                          )}

                          <BlockStack gap="200">
                            {activeDetails?.products?.edges.map(({ node: product }) => (
                              <Card key={product.id} padding="200">
                                <InlineStack align="start" blockAlign="center" gap="300">
                                  <Thumbnail
                                    source={product.featuredImage?.url || ImageIcon}
                                    alt={product.title}
                                    size="small"
                                  />
                                  <BlockStack>
                                    <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
                                    <Badge tone={product.status === "ACTIVE" ? "success" : "default"}>{product.status}</Badge>
                                  </BlockStack>
                                </InlineStack>
                              </Card>
                            ))}
                          </BlockStack>
                        </BlockStack>
                      </div>
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
            title="Create New Collection"
            primaryAction={{
              content: "Create Collection",
              onAction: handleCreateCollection,
              tone: "success",
              loading: actionFetcher.state !== "idle"
            }}
            secondaryActions={[{ content: "Cancel", onAction: () => setIsCreateModalOpen(false) }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                <TextField
                  label="Collection Title"
                  value={newCollectionTitle}
                  onChange={setNewCollectionTitle}
                  autoComplete="off"
                  helpText="E.g., Summer Sale, Rare Minerals"
                />
                <TextField
                  label="Collection Handle (Optional)"
                  value={newCollectionHandle}
                  onChange={setNewCollectionHandle}
                  autoComplete="off"
                  helpText="Leave blank to auto-generate from title"
                />
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {collectionToDelete && (
          <Modal
            open={true}
            onClose={() => setCollectionToDelete(null)}
            title={`Delete "${collectionToDelete.title}"?`}
            primaryAction={{
              content: "Yes, Delete",
              onAction: executeDelete,
              tone: "critical",
              loading: actionFetcher.state !== "idle"
            }}
            secondaryActions={[{ content: "Cancel", onAction: () => setCollectionToDelete(null) }]}
          >
            <Modal.Section>
              <Text as="p">
                Are you sure you want to delete this collection? This action cannot be undone. 
                (Note: Deleting a collection does NOT delete the products inside it).
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
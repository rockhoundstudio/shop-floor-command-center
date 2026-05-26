import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  TextField,
  Button,
  Badge,
  BlockStack,
  InlineStack,
  Box,
  EmptySearchResult,
  Modal,
  Frame,
  Toast,
  Thumbnail,
  Divider,
  Icon
} from "@shopify/polaris";
import { SearchIcon, AlertCircleIcon, ImportIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// --- SERVER: LOADER ---
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(`
    #graphql
    query GetCollections {
      collections(first: 50, sortKey: UPDATED_AT, reverse: true) {
        edges {
          node {
            id
            title
            handle
            productsCount {
              count
            }
          }
        }
      }
    }
  `);

  const parsedResponse = await response.json();
  const rawCollections = parsedResponse.data?.collections?.edges || [];
  const collections = rawCollections.map((edge) => edge.node);

  return { collections };
}

// --- SERVER: ACTION ---
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const intent = formData.get("intent");

  if (intent === "searchProducts") {
    const queryValue = formData.get("query");
    const safeQuery = queryValue ? `title:*${queryValue}*` : "";
    const response = await admin.graphql(`
      #graphql
      query SearchProducts($query: String!) {
        products(first: 30, query: $query) {
          edges {
            node {
              id
              title
              status
              featuredImage {
                url
                altText
              }
              collections(first: 50) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `, {
      variables: { query: safeQuery }
    });

    const json = await response.json();
    const products = json.data?.products?.edges.map((e) => e.node) || [];
    return { intent, success: true, products };
  }

  if (intent === "findOrphans") {
    const response = await admin.graphql(`
      #graphql
      query FindOrphans {
        products(first: 50, query: "-collection:*") {
          edges {
            node {
              id
              title
              status
              featuredImage {
                url
                altText
              }
              collections(first: 5) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
          }
        }
      }
    `);

    const json = await response.json();
    const products = json.data?.products?.edges.map((e) => e.node) || [];
    return { intent, success: true, products };
  }

  if (intent === "assignProduct") {
    const collectionId = formData.get("collectionId");
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
      mutation assignProduct($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: { id: collectionId, productIds: [productId] }
    });
    
    const json = await response.json();
    const errors = json.data?.collectionAddProducts?.userErrors;
    
    if (errors && errors.length > 0) {
      return { intent, success: false, message: errors[0].message };
    }
    return { intent, success: true, message: "We successfully added the product to your collection." };
  }

  if (intent === "removeProduct") {
    const collectionId = formData.get("collectionId");
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
      mutation removeProduct($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: { id: collectionId, productIds: [productId] }
    });
    
    const json = await response.json();
    const errors = json.data?.collectionRemoveProducts?.userErrors;
    
    if (errors && errors.length > 0) {
      return { intent, success: false, message: errors[0].message };
    }
    return { intent, success: true, message: "We successfully removed the product from your collection." };
  }

  if (intent === "addAllProducts") {
    const collectionId = formData.get("collectionId");
    const productsResponse = await admin.graphql(`
      #graphql
      query GetAllProducts {
        products(first: 250) {
          edges {
            node {
              id
            }
          }
        }
      }
    `);
    const productsJson = await productsResponse.json();
    const productIds = productsJson.data?.products?.edges.map((e) => e.node.id) || [];

    if (productIds.length === 0) {
      return { intent, success: false, message: "We could not find any products in your store to add." };
    }

    const response = await admin.graphql(`
      #graphql
      mutation addMultipleProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: { id: collectionId, productIds }
    });
    
    const json = await response.json();
    const errors = json.data?.collectionAddProducts?.userErrors;
    
    if (errors && errors.length > 0) {
      return { intent, success: false, message: errors[0].message };
    }
    return { intent, success: true, message: `We successfully added ${productIds.length} products to your collection!` };
  }

  if (intent === "clearCollection") {
    const collectionId = formData.get("collectionId");
    const productsResponse = await admin.graphql(`
      #graphql
      query GetCollectionProducts($id: ID!) {
        collection(id: $id) {
          products(first: 250) {
            edges {
              node {
                id
              }
            }
          }
        }
      }
    `, {
      variables: { id: collectionId }
    });
    
    const productsJson = await productsResponse.json();
    const productIds = productsJson.data?.collection?.products?.edges.map((e) => e.node.id) || [];

    if (productIds.length === 0) {
      return { intent, success: false, message: "This collection is already completely empty." };
    }

    const response = await admin.graphql(`
      #graphql
      mutation clearCollection($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors {
            message
          }
        }
      }
    `, {
      variables: { id: collectionId, productIds }
    });
    
    const json = await response.json();
    const errors = json.data?.collectionRemoveProducts?.userErrors;
    
    if (errors && errors.length > 0) {
      return { intent, success: false, message: errors[0].message };
    }
    return { intent, success: true, message: "We successfully cleared all products from your collection." };
  }

  return { intent, success: false, message: "We didn't recognize that command. Please try again." };
}

// --- CLIENT: COMPONENT ---
export default function CollectionManager() {
  const { collections } = useLoaderData();
  const navigate = useNavigate();
  const searchFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [collectionQuery, setCollectionQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [viewingOrphans, setViewingOrphans] = useState(false);
  
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [modalState, setModalState] = useState({ active: false, type: "", targetId: "" });

  const closeToast = useCallback(() => {
    setToastState({ active: false, message: "", isError: false });
  }, []);

  const openModal = useCallback((type, targetId) => {
    setModalState({ active: true, type, targetId });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ active: false, type: "", targetId: "" });
  }, []);

  // Handle action responses for Janyce Mode Toast
  useEffect(() => {
    const data = actionFetcher.data;
    if (data) {
      const isSuccess = !!data.success;
      
      setToastState({
        active: true,
        message: data.message || (isSuccess ? "Action completed successfully." : "Oops! Something went wrong."),
        isError: !isSuccess
      });

      if (data.intent === "addAllProducts" || data.intent === "clearCollection") {
        closeModal();
      }

      if (data.intent === "assignProduct" || data.intent === "removeProduct") {
        if (viewingOrphans) {
          searchFetcher.submit({ intent: "findOrphans" }, { method: "post" });
        } else {
          searchFetcher.submit({ intent: "searchProducts", query: productQuery }, { method: "post" });
        }
      }
    }
  }, [actionFetcher.data, closeModal, productQuery, searchFetcher, viewingOrphans]);

  const handleCollectionSearch = useCallback((value) => {
    setCollectionQuery(value);
  }, []);

  const handleProductSearchInput = useCallback((value) => {
    setProductQuery(value);
  }, []);

  const submitProductSearch = useCallback(() => {
    setViewingOrphans(false);
    searchFetcher.submit(
      { intent: "searchProducts", query: productQuery },
      { method: "post" }
    );
  }, [productQuery, searchFetcher]);

  const submitFindOrphans = useCallback(() => {
    setViewingOrphans(true);
    setActiveCollectionId("");
    searchFetcher.submit(
      { intent: "findOrphans" },
      { method: "post" }
    );
  }, [searchFetcher]);

  const executeBulkAction = useCallback(() => {
    const { type, targetId } = modalState;
    
    if (type === "addAll") {
      actionFetcher.submit(
        { intent: "addAllProducts", collectionId: targetId },
        { method: "post" }
      );
    } else if (type === "clearAll") {
      actionFetcher.submit(
        { intent: "clearCollection", collectionId: targetId },
        { method: "post" }
      );
    }
  }, [modalState, actionFetcher]);

  const assignProduct = useCallback((productId, collectionId) => {
    actionFetcher.submit(
      { intent: "assignProduct", productId, collectionId },
      { method: "post" }
    );
  }, [actionFetcher]);

  const removeProduct = useCallback((productId, collectionId) => {
    actionFetcher.submit(
      { intent: "removeProduct", productId, collectionId },
      { method: "post" }
    );
  }, [actionFetcher]);

  const filteredCollections = useMemo(() => {
    const lowerQuery = collectionQuery.toLowerCase();
    return collections.filter((col) => {
      return (
        col.title.toLowerCase().includes(lowerQuery) || 
        col.handle.toLowerCase().includes(lowerQuery)
      );
    });
  }, [collections, collectionQuery]);

  const activeCollection = useMemo(() => {
    return collections.find((c) => c.id === activeCollectionId) || null;
  }, [collections, activeCollectionId]);

  const searchResults = useMemo(() => {
    return searchFetcher.data?.products || [];
  }, [searchFetcher.data]);

  const isActionLoading = actionFetcher.state !== "idle";
  const isSearchLoading = searchFetcher.state !== "idle";

  const renderCollectionItem = useCallback((item) => {
    const { id, title, handle, productsCount } = item;
    const count = productsCount?.count || 0;
    const isSelected = id === activeCollectionId;

    return (
      <ResourceItem
        id={id}
        accessibilityLabel={`Select collection: ${title}`}
        onClick={() => {
          setActiveCollectionId(id);
          setViewingOrphans(false);
        }}
      >
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight={isSelected ? "bold" : "regular"} as="h3">
                {title}
              </Text>
              <Text variant="bodySm" as="span" color="subdued">
                {handle}
              </Text>
            </BlockStack>
            {count > 0 ? (
              <Badge tone="info">{count} Products</Badge>
            ) : (
              <Badge tone="warning">Empty</Badge>
            )}
          </InlineStack>
        </BlockStack>
      </ResourceItem>
    );
  }, [activeCollectionId]);

  const renderProductItem = useCallback((product) => {
    const { id, title, status, featuredImage, collections: productCollections } = product;
    const imageUrl = featuredImage?.url || "";
    const imageAlt = featuredImage?.altText || title;
    
    const assignedCollections = productCollections?.edges || [];
    const isAssignedToActive = assignedCollections.some((c) => c.node.id === activeCollectionId);
    
    const tapTargetStyle = { minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center' };

    let actionButtonMarkup = null;
    
    if (viewingOrphans) {
      actionButtonMarkup = (
        <div style={tapTargetStyle}>
          <Button
            onClick={() => {
              if (collections.length > 0) {
                assignProduct(id, collections[0].id);
              }
            }}
            disabled={isActionLoading || collections.length === 0}
            accessibilityLabel={`Assign ${title} to first available collection`}
          >
            Assign to a Collection
          </Button>
        </div>
      );
    } else if (activeCollectionId) {
      actionButtonMarkup = isAssignedToActive ? (
        <div style={tapTargetStyle}>
          <Button
            tone="critical"
            onClick={() => removeProduct(id, activeCollectionId)}
            disabled={isActionLoading}
            accessibilityLabel={`Remove ${title} from collection`}
          >
            Remove from Collection
          </Button>
        </div>
      ) : (
        <div style={tapTargetStyle}>
          <Button
            tone="success"
            onClick={() => assignProduct(id, activeCollectionId)}
            disabled={isActionLoading}
            accessibilityLabel={`Assign ${title} to collection`}
          >
            Assign to Collection
          </Button>
        </div>
      );
    } else {
      actionButtonMarkup = (
        <Text variant="bodySm" as="span" color="subdued">Select a collection first</Text>
      );
    }

    return (
      <Box padding="400" borderBlockEndWidth="025" borderColor="border" key={id}>
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <Thumbnail
              source={imageUrl || ImageIcon}
              alt={imageAlt}
              size="medium"
            />
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold" as="h4">
                {title}
              </Text>
              <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>
                {status}
              </Badge>
            </BlockStack>
          </InlineStack>
          {actionButtonMarkup}
        </InlineStack>
      </Box>
    );
  }, [activeCollectionId, viewingOrphans, isActionLoading, assignProduct, removeProduct, collections]);

  const tapTargetStyle = { minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <Frame>
      <Page
        title="Shop Floor Command Center"
        subtitle="Manage collections, assign products, and keep your store organized in plain English."
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      >
        <Layout>
          <Layout.Section>
            <Box paddingBlockEnd="400">
              <InlineStack gap="400" blockAlign="center" align="end">
                <div style={tapTargetStyle}>
                  <Button
                    icon={SearchIcon}
                    onClick={submitFindOrphans}
                    accessibilityLabel="Find products not assigned to any collection"
                    disabled={isSearchLoading}
                  >
                    Find Orphaned Products
                  </Button>
                </div>
              </InlineStack>
            </Box>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card padding="0">
              <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                <Text variant="headingSm" as="h2">1. Select a Collection</Text>
              </Box>
              <Box padding="300">
                <TextField
                  label="Search your collections by name"
                  labelHidden={false}
                  value={collectionQuery}
                  onChange={handleCollectionSearch}
                  autoComplete="off"
                  placeholder="e.g. Summer Sale"
                  clearButton={true}
                  onClearButtonClick={() => setCollectionQuery("")}
                  accessibilityLabel="Search collections text input"
                />
              </Box>
              <ResourceList
                resourceName={{ singular: "collection", plural: "collections" }}
                items={filteredCollections}
                renderItem={renderCollectionItem}
                emptyState={
                  collectionQuery && (
                    <EmptySearchResult
                      title="No collections found"
                      description={`We could not find anything matching "${collectionQuery}".`}
                      withIllustration={true}
                    />
                  )
                }
              />
            </Card>
          </Layout.Section>

          <Layout.Section variant="twoThirds">
            <Card padding="0">
              <Box padding="400" borderBlockEndWidth="025" borderColor="border">
                <Text variant="headingSm" as="h2">
                  {viewingOrphans ? "Orphaned Products" : "2. Manage Products"}
                </Text>
              </Box>

              {viewingOrphans ? (
                <Box padding="400" background="bg-surface-warning">
                  <Text variant="bodyMd" as="p">
                    These products are currently not assigned to any collection. Click the button next to them to assign them to your first available collection.
                  </Text>
                </Box>
              ) : activeCollectionId ? (
                <Box padding="400" background="bg-surface-secondary">
                  <BlockStack gap="400">
                    <Text variant="headingMd" as="h2">Managing: {activeCollection.title}</Text>
                    <InlineStack gap="300">
                      <div style={tapTargetStyle}>
                        <Button
                          icon={ImportIcon}
                          onClick={() => openModal("addAll", activeCollection.id)}
                          accessibilityLabel={`Add all products in store to ${activeCollection.title}`}
                        >
                          Add All Store Products
                        </Button>
                      </div>
                      <div style={tapTargetStyle}>
                        <Button
                          tone="critical"
                          icon={AlertCircleIcon}
                          onClick={() => openModal("clearAll", activeCollection.id)}
                          accessibilityLabel={`Remove all products from ${activeCollection.title}`}
                        >
                          Clear Collection Entirely
                        </Button>
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>
              ) : (
                <Box padding="800">
                  <BlockStack align="center" inlineAlign="center" gap="400">
                    <Text variant="headingLg" as="h3" alignment="center">No Collection Selected</Text>
                    <Text variant="bodyLg" as="p" alignment="center" color="subdued">
                      Please select a collection from the list on the left to start assigning or removing products.
                    </Text>
                  </BlockStack>
                </Box>
              )}

              <Divider />

              <Box padding="400">
                <InlineStack gap="300" blockAlign="end" wrap={false}>
                  <Box width="100%">
                    <TextField
                      label="Find products to assign or remove"
                      labelHidden={false}
                      value={productQuery}
                      onChange={handleProductSearchInput}
                      autoComplete="off"
                      placeholder="e.g. Red T-Shirt"
                      accessibilityLabel="Search products text input"
                    />
                  </Box>
                  <div style={tapTargetStyle}>
                    <Button
                      onClick={submitProductSearch}
                      disabled={isSearchLoading || !productQuery}
                      accessibilityLabel="Execute product search"
                    >
                      Search Products
                    </Button>
                  </div>
                </InlineStack>
              </Box>

              <Divider />

              {searchResults.length > 0 ? (
                <Box>
                  {searchResults.map(renderProductItem)}
                </Box>
              ) : (
                <Box padding="800">
                  <EmptySearchResult
                    title="No products found"
                    description="Try adjusting your search terms or checking your spelling."
                    withIllustration={true}
                  />
                </Box>
              )}
            </Card>
          </Layout.Section>
        </Layout>

        {modalState.active && (
          <Modal
            open={true}
            onClose={closeModal}
            title={
              modalState.type === "addAll" 
                ? "Are you sure you want to add all products?" 
                : "Are you sure you want to clear this collection?"
            }
            primaryAction={{
              content: modalState.type === "addAll" ? "Yes, Add Products" : "Yes, Clear Collection",
              onAction: executeBulkAction,
              destructive: modalState.type === "clearAll",
              loading: isActionLoading
            }}
            secondaryActions={[
              {
                content: "Cancel and go back",
                onAction: closeModal,
                disabled: isActionLoading
              }
            ]}
          >
            <Modal.Section>
              <Text variant="bodyLg" as="p">
                {modalState.type === "addAll"
                  ? "This action will take up to 250 of your most recent products and place them directly into this collection. This might change what your customers see on your storefront immediately."
                  : "Are you completely sure you want to remove every single product from this collection? This action cannot be easily undone, and your customers will no longer see these items grouped together."}
              </Text>
            </Modal.Section>
          </Modal>
        )}

        {toastState.active && (
          <Toast
            content={toastState.message}
            error={toastState.isError}
            onDismiss={closeToast}
          />
        )}

      </Page>
    </Frame>
  );
}

// Fallback dummy component for missing imagery
function ImageIcon() {
  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon source={SearchIcon} tone="subdued" />
    </div>
  );
}
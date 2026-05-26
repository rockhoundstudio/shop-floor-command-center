import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page,
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
  Icon,
  Banner,
  Select
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

  if (intent === "fetchCollectionProducts") {
    const collectionId = formData.get("collectionId");
    const response = await admin.graphql(`
      #graphql
      query GetCollectionProducts($id: ID!) {
        collection(id: $id) {
          products(first: 250) {
            edges {
              node {
                id
                title
                status
                featuredImage { url altText }
                originMetafield: metafield(namespace: "custom", key: "origin") { value }
                collections(first: 50) { edges { node { id } } }
              }
            }
          }
        }
      }
    `, { variables: { id: collectionId } });

    const json = await response.json();
    const products = json.data?.collection?.products?.edges.map((e) => e.node) || [];
    return { intent, success: true, products };
  }

  if (intent === "searchProducts") {
    const queryValue = formData.get("query");
    const safeQuery = queryValue ? `title:*${queryValue}*` : "";
    const response = await admin.graphql(`
      #graphql
      query SearchProducts($query: String!) {
        products(first: 50, query: $query) {
          edges {
            node {
              id
              title
              status
              featuredImage { url altText }
              originMetafield: metafield(namespace: "custom", key: "origin") { value }
              collections(first: 50) { edges { node { id } } }
            }
          }
        }
      }
    `, { variables: { query: safeQuery } });

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
              featuredImage { url altText }
              originMetafield: metafield(namespace: "custom", key: "origin") { value }
              collections(first: 5) { edges { node { id } } }
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
          userErrors { field message }
        }
      }
    `, { variables: { id: collectionId, productIds: [productId] } });
    
    const json = await response.json();
    const errors = json.data?.collectionAddProducts?.userErrors || [];
    
    if (errors.length > 0) {
      return { intent, success: false, errors, message: "Failed to assign product." };
    }
    return { intent, success: true, message: "Assigned product successfully." };
  }

  if (intent === "removeProduct") {
    const collectionId = formData.get("collectionId");
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
      mutation removeProduct($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }
    `, { variables: { id: collectionId, productIds: [productId] } });
    
    const json = await response.json();
    const errors = json.data?.collectionRemoveProducts?.userErrors || [];
    
    if (errors.length > 0) {
      return { intent, success: false, errors, message: "Failed to remove product." };
    }
    return { intent, success: true, message: "Removed product successfully." };
  }

  if (intent === "addAllProducts") {
    const collectionId = formData.get("collectionId");
    const productsResponse = await admin.graphql(`
      #graphql
      query GetAllProducts {
        products(first: 250) {
          edges { node { id } }
        }
      }
    `);
    const productsJson = await productsResponse.json();
    const productIds = productsJson.data?.products?.edges.map((e) => e.node.id) || [];

    if (productIds.length === 0) {
      return { intent, success: false, errors: [{ message: "No products in store to add." }] };
    }

    const response = await admin.graphql(`
      #graphql
      mutation addMultipleProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }
    `, { variables: { id: collectionId, productIds } });
    
    const json = await response.json();
    const errors = json.data?.collectionAddProducts?.userErrors || [];
    
    if (errors.length > 0) {
      return { intent, success: false, errors, message: "Failed to add all products." };
    }
    return { intent, success: true, message: `Added ${productIds.length} products!` };
  }

  if (intent === "clearCollection") {
    const collectionId = formData.get("collectionId");
    const productsResponse = await admin.graphql(`
      #graphql
      query GetCollectionProducts($id: ID!) {
        collection(id: $id) {
          products(first: 250) {
            edges { node { id } }
          }
        }
      }
    `, { variables: { id: collectionId } });
    
    const productsJson = await productsResponse.json();
    const productIds = productsJson.data?.collection?.products?.edges.map((e) => e.node.id) || [];

    if (productIds.length === 0) {
      return { intent, success: false, errors: [{ message: "Collection is already empty." }] };
    }

    const response = await admin.graphql(`
      #graphql
      mutation clearCollection($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors { field message }
        }
      }
    `, { variables: { id: collectionId, productIds } });
    
    const json = await response.json();
    const errors = json.data?.collectionRemoveProducts?.userErrors || [];
    
    if (errors.length > 0) {
      return { intent, success: false, errors, message: "Failed to clear collection." };
    }
    return { intent, success: true, message: "Cleared all products from collection." };
  }

  return { intent, success: false, errors: [{ message: "Unknown command." }] };
}

// --- CLIENT: COMPONENT ---
export default function CollectionManager() {
  const { collections } = useLoaderData();
  const navigate = useNavigate();
  
  const searchFetcher = useFetcher();
  const collectionProductsFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [collectionQuery, setCollectionQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [viewingOrphans, setViewingOrphans] = useState(false);
  const [sortMode, setSortMode] = useState("default");
  
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [modalState, setModalState] = useState({ active: false, type: "", targetId: "" });

  const closeToast = useCallback(() => setToastState({ active: false, message: "", isError: false }), []);
  const openModal = useCallback((type, targetId) => setModalState({ active: true, type, targetId }), []);
  const closeModal = useCallback(() => setModalState({ active: false, type: "", targetId: "" }), []);

  useEffect(() => {
    if (activeCollectionId && !viewingOrphans) {
      collectionProductsFetcher.submit(
        { intent: "fetchCollectionProducts", collectionId: activeCollectionId }, 
        { method: "post" }
      );
    }
  }, [activeCollectionId, viewingOrphans]);

  useEffect(() => {
    const data = actionFetcher.data;
    if (data) {
      const isSuccess = !!data.success;
      
      if (isSuccess && data.message) {
        setToastState({ active: true, message: data.message, isError: false });
      }

      if (data.intent === "addAllProducts" || data.intent === "clearCollection") {
        closeModal();
      }

      if (data.intent === "assignProduct" || data.intent === "removeProduct" || data.intent === "addAllProducts" || data.intent === "clearCollection") {
        if (viewingOrphans) {
          searchFetcher.submit({ intent: "findOrphans" }, { method: "post" });
        } else if (activeCollectionId) {
          collectionProductsFetcher.submit({ intent: "fetchCollectionProducts", collectionId: activeCollectionId }, { method: "post" });
          if (productQuery) {
            searchFetcher.submit({ intent: "searchProducts", query: productQuery }, { method: "post" });
          }
        }
      }
    }
  }, [actionFetcher.data, closeModal, productQuery, activeCollectionId, viewingOrphans]);

  const handleCollectionSearch = useCallback((value) => setCollectionQuery(value), []);
  const handleProductSearchInput = useCallback((value) => setProductQuery(value), []);

  const submitProductSearch = useCallback(() => {
    setViewingOrphans(false);
    searchFetcher.submit({ intent: "searchProducts", query: productQuery }, { method: "post" });
  }, [productQuery, searchFetcher]);

  const submitFindOrphans = useCallback(() => {
    setViewingOrphans(true);
    setActiveCollectionId("");
    searchFetcher.submit({ intent: "findOrphans" }, { method: "post" });
  }, [searchFetcher]);

  const executeBulkAction = useCallback(() => {
    const { type, targetId } = modalState;
    if (type === "addAll") {
      actionFetcher.submit({ intent: "addAllProducts", collectionId: targetId }, { method: "post" });
    } else if (type === "clearAll") {
      actionFetcher.submit({ intent: "clearCollection", collectionId: targetId }, { method: "post" });
    }
  }, [modalState, actionFetcher]);

  const assignProduct = useCallback((productId, collectionId) => {
    actionFetcher.submit({ intent: "assignProduct", productId, collectionId }, { method: "post" });
  }, [actionFetcher]);

  const removeProduct = useCallback((productId, collectionId) => {
    actionFetcher.submit({ intent: "removeProduct", productId, collectionId }, { method: "post" });
  }, [actionFetcher]);

  const filteredCollections = useMemo(() => {
    const lowerQuery = collectionQuery.toLowerCase();
    return collections.filter((col) => 
      col.title.toLowerCase().includes(lowerQuery) || col.handle.toLowerCase().includes(lowerQuery)
    );
  }, [collections, collectionQuery]);

  const activeCollection = useMemo(() => {
    return collections.find((c) => c.id === activeCollectionId) || null;
  }, [collections, activeCollectionId]);

  const combinedProducts = useMemo(() => {
    const searchResults = searchFetcher.data?.products || [];
    const collectionProducts = collectionProductsFetcher.data?.products || [];
    
    const productMap = new Map();
    searchResults.forEach(p => productMap.set(p.id, p));
    collectionProducts.forEach(p => productMap.set(p.id, p));
    
    let merged = Array.from(productMap.values());

    merged.sort((a, b) => {
      const aAssigned = a.collections?.edges?.some(c => c.node.id === activeCollectionId) || collectionProducts.some(cp => cp.id === a.id);
      const bAssigned = b.collections?.edges?.some(c => c.node.id === activeCollectionId) || collectionProducts.some(cp => cp.id === b.id);

      if (aAssigned && !bAssigned) return -1;
      if (!aAssigned && bAssigned) return 1;

      if (sortMode === "origin_asc" || sortMode === "origin_desc") {
        const originA = a.originMetafield?.value || "";
        const originB = b.originMetafield?.value || "";
        if (originA < originB) return sortMode === "origin_asc" ? -1 : 1;
        if (originA > originB) return sortMode === "origin_asc" ? 1 : -1;
      }

      return 0;
    });

    return merged;
  }, [searchFetcher.data, collectionProductsFetcher.data, activeCollectionId, sortMode]);

  const isActionLoading = actionFetcher.state !== "idle";
  const isSearchLoading = searchFetcher.state !== "idle" || collectionProductsFetcher.state !== "idle";
  const actionErrors = actionFetcher.data?.errors || [];

  const tapTargetStyle = { minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

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
              <Text variant="bodyMd" fontWeight={isSelected ? "bold" : "regular"} as="h3">{title}</Text>
              <Text variant="bodySm" as="span" color="subdued">{handle}</Text>
            </BlockStack>
            {count > 0 ? <Badge tone="info">{count} Products</Badge> : <Badge tone="warning">Empty</Badge>}
          </InlineStack>
        </BlockStack>
      </ResourceItem>
    );
  }, [activeCollectionId]);

  const renderProductItem = useCallback((product) => {
    const { id, title, status, featuredImage } = product;
    const imageUrl = featuredImage?.url || "";
    const imageAlt = featuredImage?.altText || title;
    const origin = product.originMetafield?.value || "Unknown";
    
    const collectionProducts = collectionProductsFetcher.data?.products || [];
    const isAssignedToActive = product.collections?.edges?.some(c => c.node.id === activeCollectionId) || collectionProducts.some(cp => cp.id === id);
    
    let actionButtonMarkup = null;
    
    if (viewingOrphans) {
      actionButtonMarkup = (
        <div style={tapTargetStyle}>
          <Button
            onClick={() => collections.length > 0 && assignProduct(id, collections[0].id)}
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
            Remove
          </Button>
        </div>
      ) : (
        <div style={tapTargetStyle}>
          <Button
            tone="success"
            onClick={() => assignProduct(id, activeCollectionId)}
            disabled={isActionLoading}
            accessibilityLabel={`Add ${title} to collection`}
          >
            Add
          </Button>
        </div>
      );
    } else {
      actionButtonMarkup = <Text variant="bodySm" as="span" color="subdued">Select a collection first</Text>;
    }

    return (
      <Box padding="400" borderBlockEndWidth="025" borderColor="border-default" key={id}>
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <Thumbnail source={imageUrl || ImageIcon} alt={imageAlt} size="medium" />
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold" as="h4">{title}</Text>
              <Text variant="bodySm" color="subdued">Origin: {origin}</Text>
              <InlineStack gap="200">
                <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>{status}</Badge>
                {activeCollectionId && isAssignedToActive && <Badge tone="success">Assigned</Badge>}
              </InlineStack>
            </BlockStack>
          </InlineStack>
          {actionButtonMarkup}
        </InlineStack>
      </Box>
    );
  }, [activeCollectionId, viewingOrphans, isActionLoading, assignProduct, removeProduct, collections, collectionProductsFetcher.data]);

  return (
    <Frame>
      <Page
        fullWidth
        title="Shop Floor Command Center"
        subtitle="Manage collections, assign products, and keep your store organized."
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', gap: '16px', height: 'calc(100vh - 160px)', width: '100%', alignItems: 'stretch' }}>
          
          {/* ======================= */}
          {/* LEFT COLUMN: COLLECTIONS */}
          {/* ======================= */}
          <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'hidden', minWidth: 0 }}>
            {/* Left Header (Fixed) */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0 }}>
              <Text variant="headingSm" as="h2">1. Select a Collection</Text>
              <div style={{ marginTop: '16px' }}>
                <TextField
                  label="Search collections"
                  labelHidden
                  value={collectionQuery}
                  onChange={handleCollectionSearch}
                  autoComplete="off"
                  placeholder="Filter collections..."
                  clearButton
                  onClearButtonClick={() => setCollectionQuery("")}
                  accessibilityLabel="Search collections text input"
                />
              </div>
            </div>
            
            {/* Left Scrollable Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ResourceList
                resourceName={{ singular: "collection", plural: "collections" }}
                items={filteredCollections}
                renderItem={renderCollectionItem}
                emptyState={
                  collectionQuery && (
                    <EmptySearchResult
                      title="No collections found"
                      description={`We could not find anything matching "${collectionQuery}".`}
                      withIllustration
                    />
                  )
                }
              />
            </div>
          </div>

          {/* ======================= */}
          {/* RIGHT COLUMN: PRODUCTS */}
          {/* ======================= */}
          <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'hidden', minWidth: 0 }}>
            
            {/* Right Header (Fixed) */}
            <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0 }}>
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h2">
                  {viewingOrphans ? "Orphaned Products" : activeCollectionId ? `2. Manage: ${activeCollection.title}` : "2. Manage Products"}
                </Text>
                <div style={tapTargetStyle}>
                  <Button
                    icon={SearchIcon}
                    onClick={submitFindOrphans}
                    accessibilityLabel="Find products not assigned to any collection"
                    disabled={isSearchLoading}
                  >
                    Find Orphans
                  </Button>
                </div>
              </InlineStack>

              {activeCollectionId && !viewingOrphans && (
                <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                  <InlineStack gap="300">
                    <div style={tapTargetStyle}>
                      <Button
                        icon={ImportIcon}
                        onClick={() => openModal("addAll", activeCollection.id)}
                        accessibilityLabel={`Add all products to ${activeCollection.title}`}
                      >
                        Add All
                      </Button>
                    </div>
                    <div style={tapTargetStyle}>
                      <Button
                        tone="critical"
                        icon={AlertCircleIcon}
                        onClick={() => openModal("clearAll", activeCollection.id)}
                        accessibilityLabel={`Clear ${activeCollection.title}`}
                      >
                        Clear All
                      </Button>
                    </div>
                  </InlineStack>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="end" wrap={false}>
                    <Box width="60%">
                      <TextField
                        label="Search products"
                        labelHidden
                        value={productQuery}
                        onChange={handleProductSearchInput}
                        autoComplete="off"
                        placeholder="Search products..."
                        accessibilityLabel="Search products text input"
                        clearButton
                        onClearButtonClick={() => setProductQuery("")}
                      />
                    </Box>
                    <Box width="35%">
                      <Select
                        label="Sort Products"
                        labelHidden
                        options={[
                          { label: "Default Sort", value: "default" },
                          { label: "Origin (A-Z)", value: "origin_asc" },
                          { label: "Origin (Z-A)", value: "origin_desc" }
                        ]}
                        value={sortMode}
                        onChange={setSortMode}
                        accessibilityLabel="Sort products dropdown"
                      />
                    </Box>
                  </InlineStack>
                  <div style={{ ...tapTargetStyle, width: '100%' }}>
                    <Button
                      onClick={submitProductSearch}
                      disabled={isSearchLoading || !productQuery}
                      accessibilityLabel="Execute product search"
                      fullWidth
                    >
                      Search
                    </Button>
                  </div>
                </BlockStack>
              </div>
            </div>

            {/* Right Scrollable Area */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {actionErrors.length > 0 && (
                <Box padding="400">
                  <Banner tone="critical" title="There was a problem updating the collection">
                    <BlockStack gap="200">
                      {actionErrors.map((error, index) => (
                        <Text key={index} as="p">{error.message}</Text>
                      ))}
                    </BlockStack>
                  </Banner>
                </Box>
              )}

              {!activeCollectionId && !viewingOrphans ? (
                <Box padding="800">
                  <EmptySearchResult
                    title="No Collection Selected"
                    description="Select a collection from the left panel to begin managing products."
                    withIllustration
                  />
                </Box>
              ) : combinedProducts.length > 0 ? (
                <Box paddingBlock="200">
                  {combinedProducts.map(renderProductItem)}
                </Box>
              ) : (
                <Box padding="800">
                  <EmptySearchResult
                    title="No products found"
                    description="Try adjusting your search terms."
                    withIllustration
                  />
                </Box>
              )}
            </div>
          </div>
        </div>

        {/* Modals & Toasts */}
        {modalState.active && (
          <Modal
            open={true}
            onClose={closeModal}
            title={modalState.type === "addAll" ? "Are you sure you want to add all products?" : "Are you sure you want to clear this collection?"}
            primaryAction={{
              content: modalState.type === "addAll" ? "Yes, Add Products" : "Yes, Clear Collection",
              onAction: executeBulkAction,
              destructive: modalState.type === "clearAll",
              loading: isActionLoading
            }}
            secondaryActions={[{ content: "Cancel", onAction: closeModal, disabled: isActionLoading }]}
          >
            <Modal.Section>
              <Text variant="bodyLg" as="p">
                {modalState.type === "addAll"
                  ? "This will add up to 250 of your recent products directly into this collection."
                  : "Are you sure you want to completely empty this collection?"}
              </Text>
            </Modal.Section>
          </Modal>
        )}

        {toastState.active && (
          <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />
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
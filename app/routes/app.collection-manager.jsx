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
  Frame,
  Toast,
  Thumbnail,
  Icon,
  Banner,
  Modal
} from "@shopify/polaris";
import { SearchIcon, InfoIcon, AlertCircleIcon, ImportIcon } from "@shopify/polaris-icons";
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
  const rawCollections = parsedResponse.data?.collections?.edges ? parsedResponse.data.collections.edges : [];
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
              }
            }
          }
        }
      }
    `, { variables: { id: collectionId } });

    const json = await response.json();
    const products = json.data?.collection?.products?.edges.map((e) => e.node) ? json.data.collection.products.edges.map((e) => e.node) : [];
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
            }
          }
        }
      }
    `, { variables: { query: safeQuery } });

    const json = await response.json();
    const products = json.data?.products?.edges.map((e) => e.node) ? json.data.products.edges.map((e) => e.node) : [];
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
            }
          }
        }
      }
    `);

    const json = await response.json();
    const products = json.data?.products?.edges.map((e) => e.node) ? json.data.products.edges.map((e) => e.node) : [];
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
    const errors = json.data?.collectionAddProducts?.userErrors ? json.data.collectionAddProducts.userErrors : [];
    
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
    const errors = json.data?.collectionRemoveProducts?.userErrors ? json.data.collectionRemoveProducts.userErrors : [];
    
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
    const productIds = productsJson.data?.products?.edges.map((e) => e.node.id) ? productsJson.data.products.edges.map((e) => e.node.id) : [];

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
    const errors = json.data?.collectionAddProducts?.userErrors ? json.data.collectionAddProducts.userErrors : [];
    
    if (errors.length > 0) {
      return { intent, success: false, errors, message: "Failed to add all products." };
    }
    return { intent, success: true, message: `Successfully added ${productIds.length} products!` };
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
    const productIds = productsJson.data?.collection?.products?.edges.map((e) => e.node.id) ? productsJson.data.collection.products.edges.map((e) => e.node.id) : [];

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
    const errors = json.data?.collectionRemoveProducts?.userErrors ? json.data.collectionRemoveProducts.userErrors : [];
    
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
  
  const colProductsFetcher = useFetcher();
  const searchProductsFetcher = useFetcher();
  const actionFetcher = useFetcher();

  const [collectionQuery, setCollectionQuery] = useState("");
  const [assignedQuery, setAssignedQuery] = useState("");
  const [unassignedQuery, setUnassignedQuery] = useState("");
  
  const [activeCollectionId, setActiveCollectionId] = useState("");
  const [viewingOrphans, setViewingOrphans] = useState(false);
  
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [modalState, setModalState] = useState({ active: false, type: "", targetId: "" });

  const closeToast = useCallback(() => setToastState({ active: false, message: "", isError: false }), []);
  const openModal = useCallback((type, targetId) => setModalState({ active: true, type, targetId }), []);
  const closeModal = useCallback(() => setModalState({ active: false, type: "", targetId: "" }), []);

  // Fetch data when active collection changes
  useEffect(() => {
    if (activeCollectionId !== "") {
      colProductsFetcher.submit(
        { intent: "fetchCollectionProducts", collectionId: activeCollectionId }, 
        { method: "post" }
      );
      searchProductsFetcher.submit(
        { intent: "searchProducts", query: "" }, 
        { method: "post" }
      );
    }
  }, [activeCollectionId]);

  // Handle action responses
  useEffect(() => {
    const data = actionFetcher.data;
    if (data) {
      const isSuccess = data.success ? true : false;
      
      if (data.message) {
        setToastState({ active: true, message: data.message, isError: isSuccess ? false : true });
      }

      const requiresModalClose = data.intent === "addAllProducts" ? true : data.intent === "clearCollection" ? true : false;
      if (requiresModalClose) {
        closeModal();
      }

      const requiresRefresh = data.intent === "assignProduct" ? true : data.intent === "removeProduct" ? true : data.intent === "addAllProducts" ? true : data.intent === "clearCollection" ? true : false;
      
      if (requiresRefresh) {
        if (viewingOrphans) {
          searchProductsFetcher.submit({ intent: "findOrphans" }, { method: "post" });
        } else if (activeCollectionId !== "") {
          colProductsFetcher.submit(
            { intent: "fetchCollectionProducts", collectionId: activeCollectionId }, 
            { method: "post" }
          );
          searchProductsFetcher.submit(
            { intent: "searchProducts", query: unassignedQuery }, 
            { method: "post" }
          );
        }
      }
    }
  }, [actionFetcher.data, activeCollectionId, unassignedQuery, viewingOrphans, closeModal]);

  const handleCollectionSearch = useCallback((value) => setCollectionQuery(value), []);
  const handleAssignedSearch = useCallback((value) => setAssignedQuery(value), []);
  const handleUnassignedSearch = useCallback((value) => setUnassignedQuery(value), []);

  const submitUnassignedSearch = useCallback(() => {
    searchProductsFetcher.submit(
      { intent: "searchProducts", query: unassignedQuery }, 
      { method: "post" }
    );
  }, [unassignedQuery, searchProductsFetcher]);

  const submitFindOrphans = useCallback(() => {
    setViewingOrphans(true);
    setActiveCollectionId("");
    searchProductsFetcher.submit(
      { intent: "findOrphans" }, 
      { method: "post" }
    );
  }, [searchProductsFetcher]);

  const executeBulkAction = useCallback(() => {
    const type = modalState.type;
    const targetId = modalState.targetId;
    if (type === "addAll") {
      actionFetcher.submit({ intent: "addAllProducts", collectionId: targetId }, { method: "post" });
    } else if (type === "clearAll") {
      actionFetcher.submit({ intent: "clearCollection", collectionId: targetId }, { method: "post" });
    }
  }, [modalState, actionFetcher]);

  const assignProduct = useCallback((productId) => {
    if (activeCollectionId !== "") {
      actionFetcher.submit(
        { intent: "assignProduct", productId, collectionId: activeCollectionId }, 
        { method: "post" }
      );
    }
  }, [actionFetcher, activeCollectionId]);

  const assignOrphanFallback = useCallback((productId) => {
    const fallbackId = collections.length > 0 ? collections[0].id : "";
    if (fallbackId !== "") {
      actionFetcher.submit(
        { intent: "assignProduct", productId, collectionId: fallbackId }, 
        { method: "post" }
      );
    }
  }, [actionFetcher, collections]);

  const removeProduct = useCallback((productId) => {
    if (activeCollectionId !== "") {
      actionFetcher.submit(
        { intent: "removeProduct", productId, collectionId: activeCollectionId }, 
        { method: "post" }
      );
    }
  }, [actionFetcher, activeCollectionId]);

  const filteredCollections = useMemo(() => {
    const lowerQuery = collectionQuery.toLowerCase();
    return collections.filter((col) => {
      const matchTitle = col.title.toLowerCase().includes(lowerQuery) ? true : false;
      const matchHandle = col.handle.toLowerCase().includes(lowerQuery) ? true : false;
      return matchTitle ? true : matchHandle ? true : false;
    });
  }, [collections, collectionQuery]);

  const activeCollection = useMemo(() => {
    const match = collections.find((c) => c.id === activeCollectionId);
    return match ? match : null;
  }, [collections, activeCollectionId]);

  const assignedProducts = useMemo(() => {
    const allAssigned = colProductsFetcher.data?.products ? colProductsFetcher.data.products : [];
    const lowerQuery = assignedQuery.toLowerCase();
    return allAssigned.filter((p) => p.title.toLowerCase().includes(lowerQuery));
  }, [colProductsFetcher.data, assignedQuery]);

  const unassignedProducts = useMemo(() => {
    const allSearched = searchProductsFetcher.data?.products ? searchProductsFetcher.data.products : [];
    if (viewingOrphans) {
      return allSearched;
    }
    const assignedIds = colProductsFetcher.data?.products ? colProductsFetcher.data.products.map(p => p.id) : [];
    return allSearched.filter((p) => {
      const isAssigned = assignedIds.includes(p.id) ? true : false;
      return isAssigned ? false : true;
    });
  }, [searchProductsFetcher.data, colProductsFetcher.data, viewingOrphans]);

  const isActionLoading = actionFetcher.state !== "idle" ? true : false;
  const isSearchLoading = searchProductsFetcher.state !== "idle" ? true : false;
  const actionErrors = actionFetcher.data?.errors ? actionFetcher.data.errors : [];

  const tapTargetStyle = { minWidth: '48px', minHeight: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const renderCollectionItem = useCallback((item) => {
    const { id, title, handle, productsCount } = item;
    const count = productsCount?.count ? productsCount.count : 0;
    const isSelected = id === activeCollectionId ? true : false;

    return (
      <ResourceItem
        id={id}
        accessibilityLabel={`Select collection: ${title}`}
        onClick={() => {
          setActiveCollectionId(id);
          setViewingOrphans(false);
        }}
      >
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight={isSelected ? "bold" : "regular"} as="h3">{title}</Text>
            <Text variant="bodySm" as="span" color="subdued">{handle}</Text>
          </BlockStack>
          <InlineStack gap="300" blockAlign="center">
            {count > 0 ? <Badge tone="info">{count} Products</Badge> : <Badge tone="warning">Empty</Badge>}
            <div style={tapTargetStyle}>
              <Button icon={InfoIcon} variant="plain" accessibilityLabel={`Info for ${title}`} />
            </div>
          </InlineStack>
        </InlineStack>
      </ResourceItem>
    );
  }, [activeCollectionId]);

  const renderAssignedItem = useCallback((product) => {
    const { id, title, status, featuredImage } = product;
    const imageUrl = featuredImage?.url ? featuredImage.url : "";
    const imageAlt = featuredImage?.altText ? featuredImage.altText : title;
    const origin = product.originMetafield?.value ? product.originMetafield.value : "Unknown";

    return (
      <Box padding="400" borderBlockEndWidth="025" borderColor="border-default" key={id}>
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <Thumbnail source={imageUrl === "" ? ImageIcon : imageUrl} alt={imageAlt} size="medium" />
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold" as="h4">{title}</Text>
              <Text variant="bodySm" color="subdued">Origin: {origin}</Text>
              <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>{status}</Badge>
            </BlockStack>
          </InlineStack>
          <div style={tapTargetStyle}>
            <Button
              tone="critical"
              onClick={() => removeProduct(id)}
              disabled={isActionLoading}
              accessibilityLabel={`Remove ${title} from collection`}
            >
              Remove
            </Button>
          </div>
        </InlineStack>
      </Box>
    );
  }, [isActionLoading, removeProduct]);

  const renderAvailableItem = useCallback((product) => {
    const { id, title, status, featuredImage } = product;
    const imageUrl = featuredImage?.url ? featuredImage.url : "";
    const imageAlt = featuredImage?.altText ? featuredImage.altText : title;
    const origin = product.originMetafield?.value ? product.originMetafield.value : "Unknown";

    return (
      <Box padding="400" borderBlockEndWidth="025" borderColor="border-default" key={id}>
        <InlineStack align="space-between" blockAlign="center" wrap={false}>
          <InlineStack gap="400" blockAlign="center" wrap={false}>
            <Thumbnail source={imageUrl === "" ? ImageIcon : imageUrl} alt={imageAlt} size="medium" />
            <BlockStack gap="100">
              <Text variant="bodyMd" fontWeight="bold" as="h4">{title}</Text>
              <Text variant="bodySm" color="subdued">Origin: {origin}</Text>
              <Badge tone={status === "ACTIVE" ? "success" : "neutral"}>{status}</Badge>
            </BlockStack>
          </InlineStack>
          <div style={tapTargetStyle}>
            <Button
              tone="success"
              onClick={() => viewingOrphans ? assignOrphanFallback(id) : assignProduct(id)}
              disabled={isActionLoading ? true : (viewingOrphans ? (collections.length === 0 ? true : false) : false)}
              accessibilityLabel={`Add ${title} to collection`}
            >
              {viewingOrphans ? "Assign" : "Add"}
            </Button>
          </div>
        </InlineStack>
      </Box>
    );
  }, [isActionLoading, assignProduct, assignOrphanFallback, viewingOrphans, collections]);

  return (
    <Frame>
      <Page
        fullWidth
        title="Shop Floor Command Center"
        subtitle="Manage collections, assign products, and keep your store organized."
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', gap: '16px' }}>
          
          {/* ======================= */}
          {/* SECTION 1: COLLECTION PICKER */}
          {/* ======================= */}
          <div style={{ flex: '0 0 220px', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'visible' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0 }}>
              <InlineStack align="space-between" blockAlign="center">
                <Box width="60%">
                  <TextField
                    label="Search collections"
                    labelHidden
                    value={collectionQuery}
                    onChange={handleCollectionSearch}
                    autoComplete="off"
                    placeholder="Find a collection to manage..."
                    clearButton
                    onClearButtonClick={() => setCollectionQuery("")}
                    accessibilityLabel="Search collections text input"
                    prefix={<Icon source={SearchIcon} />}
                  />
                </Box>
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
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <ResourceList
                resourceName={{ singular: "collection", plural: "collections" }}
                items={filteredCollections}
                renderItem={renderCollectionItem}
                emptyState={
                  collectionQuery === "" ? null : (
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

          {/* Action Error Banner */}
          {actionErrors.length > 0 ? (
            <div style={{ flexShrink: 0 }}>
              <Banner tone="critical" title="There was a problem updating the collection">
                <BlockStack gap="200">
                  {actionErrors.map((error, index) => (
                    <Text key={index} as="p">{error.message}</Text>
                  ))}
                </BlockStack>
              </Banner>
            </div>
          ) : null}

          {/* Bulk Action Controls (Only visible when collection selected and NOT viewing orphans) */}
          {activeCollectionId === "" ? null : viewingOrphans ? null : (
            <div style={{ flexShrink: 0, padding: '12px 16px', backgroundColor: 'var(--p-color-bg-surface-secondary, #f4f6f8)', borderRadius: 'var(--p-border-radius-200, 8px)' }}>
              <InlineStack gap="300" align="space-between" blockAlign="center">
                <Text variant="headingSm" as="h3">Managing: {activeCollection ? activeCollection.title : "Selected Collection"}</Text>
                <InlineStack gap="300">
                  <div style={tapTargetStyle}>
                    <Button
                      icon={ImportIcon}
                      onClick={() => openModal("addAll", activeCollectionId)}
                      accessibilityLabel="Add all store products"
                    >
                      Add All Store Products
                    </Button>
                  </div>
                  <div style={tapTargetStyle}>
                    <Button
                      tone="critical"
                      icon={AlertCircleIcon}
                      onClick={() => openModal("clearAll", activeCollectionId)}
                      accessibilityLabel="Clear entire collection"
                    >
                      Clear Collection Entirely
                    </Button>
                  </div>
                </InlineStack>
              </InlineStack>
            </div>
          )}

          {/* ======================= */}
          {/* SECTIONS 2 & 3: TWO COLUMNS */}
          {/* ======================= */}
          {activeCollectionId === "" ? (
            viewingOrphans ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'visible' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0, backgroundColor: 'var(--p-color-bg-surface-warning, #ffea8a)' }}>
                  <Text variant="headingSm" as="h2">Orphaned Products</Text>
                  <Text variant="bodyMd" as="p">These products have no collection. Click assign to send them to your first available collection.</Text>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                   {unassignedProducts.length > 0 ? (
                    <Box paddingBlock="200">
                      {unassignedProducts.map(renderAvailableItem)}
                    </Box>
                  ) : (
                    <Box padding="800">
                      <EmptySearchResult title="No orphans found" description="All products belong to a collection." withIllustration={false} />
                    </Box>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))' }}>
                <EmptySearchResult
                  title="No Collection Selected"
                  description="Select a collection from the top panel to begin managing its products."
                  withIllustration
                />
              </div>
            )
          ) : (
            <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'row', gap: '16px', minHeight: 0 }}>
              
              {/* LEFT COLUMN: IN COLLECTION */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'visible' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0 }}>
                  <Text variant="headingSm" as="h2">In {activeCollection ? activeCollection.title : "Collection"}</Text>
                  <div style={{ marginTop: '16px' }}>
                    <TextField
                      label="Filter assigned products"
                      labelHidden
                      value={assignedQuery}
                      onChange={handleAssignedSearch}
                      autoComplete="off"
                      placeholder="Filter assigned products..."
                      accessibilityLabel="Filter assigned products text input"
                      clearButton
                      onClearButtonClick={() => setAssignedQuery("")}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {assignedProducts.length > 0 ? (
                    <Box paddingBlock="200">
                      {assignedProducts.map(renderAssignedItem)}
                    </Box>
                  ) : (
                    <Box padding="800">
                      <EmptySearchResult
                        title="No products in this collection"
                        description="Assigned products will appear here."
                        withIllustration={false}
                      />
                    </Box>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: ADD PRODUCTS */}
              <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--p-color-bg-surface-default, #fff)', borderRadius: 'var(--p-border-radius-200, 8px)', boxShadow: 'var(--p-shadow-100, 0 1px 3px rgba(0,0,0,0.1))', overflow: 'visible' }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--p-color-border-default, #ebebeb)', flexShrink: 0 }}>
                  <Text variant="headingSm" as="h2">Add Products</Text>
                  <div style={{ marginTop: '16px' }}>
                    <InlineStack gap="300" wrap={false} blockAlign="center">
                      <div style={{ flex: 1 }}>
                        <TextField
                          label="Search available products"
                          labelHidden
                          value={unassignedQuery}
                          onChange={handleUnassignedSearch}
                          autoComplete="off"
                          placeholder="Search available products..."
                          accessibilityLabel="Search available products text input"
                          clearButton
                          onClearButtonClick={() => setUnassignedQuery("")}
                        />
                      </div>
                      <div style={{ ...tapTargetStyle, width: 'auto' }}>
                        <Button
                          onClick={submitUnassignedSearch}
                          disabled={isSearchLoading}
                          accessibilityLabel="Execute product search"
                        >
                          Search
                        </Button>
                      </div>
                    </InlineStack>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {unassignedProducts.length > 0 ? (
                    <Box paddingBlock="200">
                      {unassignedProducts.map(renderAvailableItem)}
                    </Box>
                  ) : (
                    <Box padding="800">
                      <EmptySearchResult
                        title="All products already added"
                        description="Try a different search term or check the left column."
                        withIllustration={false}
                      />
                    </Box>
                  )}
                </div>
              </div>

            </div>
          )}
        </div>

        {modalState.active ? (
          <Modal
            open={true}
            onClose={closeModal}
            title={modalState.type === "addAll" ? "Are you sure you want to add all products?" : "Are you sure you want to clear this collection?"}
            primaryAction={{
              content: modalState.type === "addAll" ? "Yes, Add Products" : "Yes, Clear Collection",
              onAction: executeBulkAction,
              destructive: modalState.type === "clearAll" ? true : false,
              loading: isActionLoading
            }}
            secondaryActions={[{ content: "Cancel", onAction: closeModal, disabled: isActionLoading }]}
          >
            <Modal.Section>
              <Text variant="bodyLg" as="p">
                {modalState.type === "addAll"
                  ? "This action will take up to 250 of your most recent products and place them directly into this collection. This might change what your customers see on your storefront immediately."
                  : "Are you completely sure you want to remove every single product from this collection? This action cannot be easily undone, and your customers will no longer see these items grouped together."}
              </Text>
            </Modal.Section>
          </Modal>
        ) : null}

        {toastState.active ? (
          <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />
        ) : null}
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




import { useState, useEffect } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Divider, Button, Box, TextField, Grid, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

// ==========================================
// 1. ENGINE: FETCH LIVE COLLECTIONS & PRODUCTS
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    let allCollections = [];
    let cursor = null;
    let hasNext = true;
    let cycle = 0;

    // Fetch all collections and their products
    while (hasNext && cycle < 20) {
      const collQuery = `#graphql
        query($cursor: String) {
          collections(first: 50, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                products(first: 250) {
                  edges { node { id title } }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(collQuery, { variables: { cursor } });
      const json = await res.json();
      
      if (json.errors) {
        throw new Error(json.errors[0].message);
      }

      const nodes = (json.data?.collections?.edges || []).map(e => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        products: e.node.products.edges.map(pe => pe.node)
      }));
      
      allCollections = allCollections.concat(nodes);
      hasNext = json.data?.collections?.pageInfo?.hasNextPage || false;
      cursor = json.data?.collections?.pageInfo?.endCursor || null;
      cycle++;
    }

    let allProducts = [];
    cursor = null;
    hasNext = true;
    cycle = 0;

    // Fetch all products and their collections
    while (hasNext && cycle < 20) {
      const prodQuery = `#graphql
        query($cursor: String) {
          products(first: 100, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                collections(first: 10) {
                  edges { node { id title } }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(prodQuery, { variables: { cursor } });
      const json = await res.json();
      
      if (json.errors) {
        throw new Error(json.errors[0].message);
      }

      const nodes = (json.data?.products?.edges || []).map(e => ({
        id: e.node.id,
        title: e.node.title,
        handle: e.node.handle,
        collections: e.node.collections.edges.map(ce => ce.node)
      }));
      
      allProducts = allProducts.concat(nodes);
      hasNext = json.data?.products?.pageInfo?.hasNextPage || false;
      cursor = json.data?.products?.pageInfo?.endCursor || null;
      cycle++;
    }

    return Response.json({ collections: allCollections, products: allProducts });
  } catch (error) {
    console.error("Failed to load collection data:", error);
    return Response.json({ collections: [], products: [], error: error.message });
  }
};

// ==========================================
// 2. TRANSMISSION: ACTIONS & MUTATIONS
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent");

  try {
    if (intent === "createCollection") {
      const title = fd.get("title");
      const res = await admin.graphql(`
        mutation createCollection($title: String!) {
          collectionCreate(input: { title: $title }) {
            collection { id title }
            userErrors { field message }
          }
        }
      `, { variables: { title } });
      const json = await res.json();
      if (json.data?.collectionCreate?.userErrors?.length) {
        return Response.json({ ok: false, error: json.data.collectionCreate.userErrors[0].message });
      }
      return Response.json({ ok: true, message: `Collection "${title}" created.` });
    }

    if (intent === "deleteCollection") {
      const id = fd.get("id");
      const res = await admin.graphql(`
        mutation deleteCollection($id: ID!) {
          collectionDelete(input: { id: $id }) {
            deletedCollectionId
            userErrors { field message }
          }
        }
      `, { variables: { id } });
      const json = await res.json();
      if (json.data?.collectionDelete?.userErrors?.length) {
        return Response.json({ ok: false, error: json.data.collectionDelete.userErrors[0].message });
      }
      return Response.json({ ok: true, message: "Collection deleted successfully." });
    }

    if (intent === "assignCollection") {
      const productId = fd.get("productId");
      const collectionId = fd.get("collectionId");
      const res = await admin.graphql(`
        mutation assignCollection($collectionId: ID!, $productIds: [ID!]!) {
          collectionAddProducts(id: $collectionId, productIds: $productIds) {
            collection { id title }
            userErrors { field message }
          }
        }
      `, { variables: { collectionId, productIds: [productId] } });
      const json = await res.json();
      if (json.data?.collectionAddProducts?.userErrors?.length) {
        return Response.json({ ok: false, error: json.data.collectionAddProducts.userErrors[0].message });
      }
      return Response.json({ ok: true, message: "Product assigned to collection." });
    }

    if (intent === "removeCollection") {
      const productId = fd.get("productId");
      const collectionId = fd.get("collectionId");
      const res = await admin.graphql(`
        mutation removeCollection($collectionId: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $collectionId, productIds: $productIds) {
            job { id }
            userErrors { field message }
          }
        }
      `, { variables: { collectionId, productIds: [productId] } });
      const json = await res.json();
      if (json.data?.collectionRemoveProducts?.userErrors?.length) {
        return Response.json({ ok: false, error: json.data.collectionRemoveProducts.userErrors[0].message });
      }
      return Response.json({ ok: true, message: "Product removed from collection." });
    }

    return Response.json({ ok: false, error: "Unknown intent" });
  } catch (error) {
    return Response.json({ ok: false, error: error.message });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI DASHBOARD
// ==========================================
export default function CollectionManager() {
  const navigate = useNavigate();
  const { collections = [], products = [], error } = useLoaderData() || {};
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [newTitle, setNewTitle] = useState("");

  useEffect(() => {
    if (actionData?.message) shopify.toast.show(actionData.message);
    if (actionData?.error) shopify.toast.show(actionData.error, { isError: true });
    if (actionData?.ok && navigation.state === "idle") {
      setNewTitle("");
    }
  }, [actionData, navigation.state]);

  const orphanedProducts = products.filter(p => p.collections.length === 0);
  const multiCollectionProducts = products.filter(p => p.collections.length > 1);

  const handleCreateCollection = () => {
    if (!newTitle.trim()) return;
    submit({ intent: "createCollection", title: newTitle }, { method: "post" });
  };

  const handleDeleteCollection = (id) => {
    submit({ intent: "deleteCollection", id }, { method: "post" });
  };

  return (
    <Page 
      title="Collection Manager" 
      subtitle="Live taxonomy mapping and conflict detection"
      fullWidth
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      {error && <Banner tone="critical">{error}</Banner>}

      <BlockStack gap="600">
        
        {/* OVERVIEW DASHBOARD */}
        <Grid>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card padding="400">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Total Collections</Text>
                <Text variant="headingXl" as="p" fontWeight="bold">{collections.length}</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card padding="400" background={orphanedProducts.length > 0 ? "bg-surface-warning" : "bg-surface"}>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Orphaned Products</Text>
                <InlineStack align="space-between">
                  <Text variant="headingXl" as="p" fontWeight="bold">{orphanedProducts.length}</Text>
                  {orphanedProducts.length > 0 && <Badge tone="warning">Requires Taxonomy</Badge>}
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
            <Card padding="400" background={multiCollectionProducts.length > 0 ? "bg-surface-warning" : "bg-surface"}>
              <BlockStack gap="200">
                <Text variant="headingMd" as="h3">Multi-Collection Conflicts</Text>
                <InlineStack align="space-between">
                  <Text variant="headingXl" as="p" fontWeight="bold">{multiCollectionProducts.length}</Text>
                  {multiCollectionProducts.length > 0 && <Badge tone="warning">Overlap Detected</Badge>}
                </InlineStack>
              </BlockStack>
            </Card>
          </Grid.Cell>
        </Grid>

        {/* COLLECTIONS ROSTER */}
        <Card padding="0">
          <Box padding="400" borderBottom="025" borderColor="border">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Live Collections Roster</Text>
              <InlineStack gap="300" blockAlign="center" wrap={false}>
                <Box width="100%">
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center", width: "100%" }}>
                    <TextField
                      label="New Collection Title"
                      labelHidden
                      value={newTitle}
                      onChange={setNewTitle}
                      placeholder="Enter new collection title..."
                      autoComplete="off"
                    />
                  </div>
                </Box>
                <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                  <Button
                    variant="primary"
                    accessibilityLabel="Create New Collection"
                    onClick={handleCreateCollection}
                    loading={navigation.state === "submitting" && navigation.formData?.get("intent") === "createCollection"}
                  >
                    Create Collection
                  </Button>
                </div>
              </InlineStack>
            </BlockStack>
          </Box>
          <Box padding="400">
            {collections.length === 0 && (
              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                <Text tone="subdued">No collections found on the shop floor.</Text>
              </div>
            )}
            {collections.length > 0 && (
              <BlockStack gap="400">
                {collections.map(collection => (
                  <Box key={collection.id}>
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingSm" as="h3" fontWeight="bold">{collection.title}</Text>
                        <Text tone="subdued">Handle: {collection.handle}</Text>
                      </BlockStack>
                      <InlineStack gap="400" blockAlign="center">
                        <Badge tone="info">{collection.products.length} Products</Badge>
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button
                            tone="critical"
                            accessibilityLabel={`Delete Collection ${collection.title}`}
                            onClick={() => handleDeleteCollection(collection.id)}
                            loading={navigation.state === "submitting" && navigation.formData?.get("id") === collection.id}
                          >
                            Delete
                          </Button>
                        </div>
                      </InlineStack>
                    </InlineStack>
                    <Box paddingBlockStart="400"><Divider /></Box>
                  </Box>
                ))}
              </BlockStack>
            )}
          </Box>
        </Card>

        {/* PRODUCTS ROSTER */}
        <Card padding="0">
          <Box padding="400" borderBottom="025" borderColor="border">
            <Text variant="headingMd" as="h2">Product Taxonomy Status</Text>
          </Box>
          <Box padding="400">
            {products.length === 0 && (
              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                <Text tone="subdued">No products found on the shop floor.</Text>
              </div>
            )}
            {products.length > 0 && (
              <BlockStack gap="400">
                {products.map(product => {
                  const isOrphaned = product.collections.length === 0;
                  const isMulti = product.collections.length > 1;

                  return (
                    <Box key={product.id}>
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="200">
                          <Text variant="headingSm" as="h3" fontWeight="bold">{product.title}</Text>
                          <InlineStack gap="200" wrap>
                            {isOrphaned && <Badge tone="critical">Orphaned (No Collection)</Badge>}
                            {isMulti && <Badge tone="warning">Multi-Collection Conflict</Badge>}
                            {!isOrphaned && !isMulti && <Badge tone="success">Assigned</Badge>}
                            
                            {product.collections.map(c => (
                              <Badge key={c.id} tone="info">{c.title}</Badge>
                            ))}
                          </InlineStack>
                        </BlockStack>
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button
                            accessibilityLabel={`View ${product.title} in Shopify Admin`}
                            url={`shopify:admin/products/${product.id.split("/").pop()}`}
                            target="_blank"
                          >
                            View
                          </Button>
                        </div>
                      </InlineStack>
                      <Box paddingBlockStart="400"><Divider /></Box>
                    </Box>
                  );
                })}
              </BlockStack>
            )}
          </Box>
        </Card>

      </BlockStack>
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
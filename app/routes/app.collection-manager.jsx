import React, { useState, useCallback, useMemo } from "react";
import { useLoaderData, useSubmit, useNavigation, useNavigate } from "react-router";
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
  FormLayout
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// --- LOADER (Server Side) ---
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
  const rawCollections = parsedResponse.data?.collections?.edges;
  
  const collections = Array.isArray(rawCollections) 
    ? rawCollections.map((edge) => edge.node) 
    : [];

  return { collections };
}

// --- ACTION (Server Side) ---
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const actionType = formData.get("actionType");
  const collectionId = formData.get("collectionId");
  const productId = formData.get("productId");

  if (actionType === "add") {
    await admin.graphql(`
      #graphql
      mutation addProductToCollection($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: collectionId,
        productIds: [productId]
      }
    });
  }

  if (actionType === "remove") {
    await admin.graphql(`
      #graphql
      mutation removeProductFromCollection($id: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $id, productIds: $productIds) {
          userErrors {
            field
            message
          }
        }
      }
    `, {
      variables: {
        id: collectionId,
        productIds: [productId]
      }
    });
  }

  return { success: true };
}

// --- COMPONENT (Client Side) ---
export default function CollectionManager() {
  const { collections } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [queryValue, setQueryValue] = useState("");
  const [activeProductIdInputs, setActiveProductIdInputs] = useState({});

  const isNavigating = navigation.state !== "idle";

  const handleQueryChange = useCallback(
    (value) => setQueryValue(value),
    []
  );

  const handleQueryClear = useCallback(
    () => setQueryValue(""),
    []
  );

  const handleProductIdChange = useCallback((value, id) => {
    setActiveProductIdInputs((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleAssignProduct = useCallback((collectionId) => {
    const targetProductId = activeProductIdInputs[collectionId];
    if (targetProductId) {
      const formData = new FormData();
      formData.append("actionType", "add");
      formData.append("collectionId", collectionId);
      formData.append("productId", targetProductId);
      submit(formData, { method: "post" });
    }
  }, [activeProductIdInputs, submit]);

  const handleRemoveProduct = useCallback((collectionId) => {
    const targetProductId = activeProductIdInputs[collectionId];
    if (targetProductId) {
      const formData = new FormData();
      formData.append("actionType", "remove");
      formData.append("collectionId", collectionId);
      formData.append("productId", targetProductId);
      submit(formData, { method: "post" });
    }
  }, [activeProductIdInputs, submit]);

  const filteredCollections = useMemo(() => {
    const lowerQuery = queryValue.toLowerCase();
    return collections.filter((col) => {
      return (
        col.title.toLowerCase().includes(lowerQuery) || 
        col.handle.toLowerCase().includes(lowerQuery)
      );
    });
  }, [collections, queryValue]);

  const renderItem = useCallback((item) => {
    const { id, title, handle, productsCount } = item;
    const count = productsCount?.count || 0;
    const currentInput = activeProductIdInputs[id] || "";
    const isActionDisabled = isNavigating || !currentInput;

    return (
      <ResourceItem
        id={id}
        accessibilityLabel={`View details for collection: ${title}`}
      >
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="200">
              <Text variant="bodyMd" fontWeight="bold" as="h3">
                {title}
              </Text>
              <Text variant="bodySm" as="span" color="subdued">
                {handle}
              </Text>
            </BlockStack>
            
            {count > 0 && <Badge tone="info">{count} Products</Badge>}
            {count === 0 && <Badge tone="warning">Empty</Badge>}
          </InlineStack>

          <Box padding="300" background="bg-surface-secondary" borderRadius="100">
            <FormLayout>
              <TextField
                label="Product ID for modification"
                labelHidden={false}
                value={currentInput}
                onChange={(val) => handleProductIdChange(val, id)}
                autoComplete="off"
                placeholder="gid://shopify/Product/123456789"
              />
              <InlineStack gap="300">
                {/* 48px tap target compliance wrapper */}
                <div style={{ minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center' }}>
                  <Button
                    onClick={() => handleAssignProduct(id)}
                    disabled={isActionDisabled}
                    accessibilityLabel={`Assign product to ${title}`}
                  >
                    Assign Product
                  </Button>
                </div>
                <div style={{ minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center' }}>
                  <Button
                    tone="critical"
                    onClick={() => handleRemoveProduct(id)}
                    disabled={isActionDisabled}
                    accessibilityLabel={`Remove product from ${title}`}
                  >
                    Remove Product
                  </Button>
                </div>
              </InlineStack>
            </FormLayout>
          </Box>
        </BlockStack>
      </ResourceItem>
    );
  }, [activeProductIdInputs, handleProductIdChange, handleAssignProduct, handleRemoveProduct, isNavigating]);

  return (
    <Page
      title="Collection Manager"
      subtitle="Shop Floor Command Center"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <div style={{ padding: '16px' }}>
              <TextField
                label="Search Collections"
                labelHidden={true}
                value={queryValue}
                onChange={handleQueryChange}
                clearButton={true}
                onClearButtonClick={handleQueryClear}
                placeholder="Filter by title or handle..."
                autoComplete="off"
              />
            </div>
            <ResourceList
              resourceName={{ singular: "collection", plural: "collections" }}
              items={filteredCollections}
              renderItem={renderItem}
              emptyState={
                queryValue && (
                  <EmptySearchResult
                    title="No collections found"
                    description={`Try changing the search term "${queryValue}"`}
                    withIllustration={true}
                  />
                )
              }
            />
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
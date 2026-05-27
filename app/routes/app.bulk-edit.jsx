import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, 
  Banner, IndexTable, useIndexResourceState, Badge, Select, TextField
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH PRODUCTS
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(
      `#graphql
      query getProductsForBulkEdit {
        products(first: 50, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              status
              tags
              totalInventory
            }
          }
        }
      }`
    );

    const parsed = await response.json();
    if (parsed.errors) throw new Error(parsed.errors[0].message);

    const products = parsed.data?.products?.edges.map(e => e.node) || [];
    return Response.json({ products });
  } catch (error) {
    console.error("Bulk Edit Loader Error:", error);
    return Response.json({ products: [], error: error.message });
  }
};

// ==========================================
// 2. TRANSMISSION: BATCH MUTATIONS
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "bulkUpdate") {
      const targetIds = JSON.parse(formData.get("targetIds"));
      const actionType = formData.get("actionType");
      const actionValue = formData.get("actionValue");
      
      let successCount = 0;
      let errors = [];

      // Process batch updates
      for (const id of targetIds) {
        let mutation = "";
        let variables = { input: { id } };

        if (actionType === "status") {
          variables.input.status = actionValue;
          mutation = `mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { userErrors { message } } }`;
        } else if (actionType === "add_tag") {
          variables.input.tags = actionValue; // This appends tags in Shopify
          mutation = `mutation productUpdate($input: ProductInput!) { productUpdate(input: $input) { userErrors { message } } }`;
        }

        if (mutation) {
          const updateRes = await admin.graphql(mutation, { variables });
          const updateData = await updateRes.json();

          if (updateData.data?.productUpdate?.userErrors?.length > 0) {
            errors.push(`Failed on ${id}: ${updateData.data.productUpdate.userErrors[0].message}`);
          } else {
            successCount++;
          }
        }
      }

      return Response.json({ 
        intent, 
        success: true, 
        message: `Successfully updated ${successCount} products.`,
        errors: errors.length > 0 ? errors : null 
      });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Action Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI FRAMEWORK
// ==========================================
export default function BulkEditTab() {
  const { products = [], error } = useLoaderData() || {};
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // --- STATE ---
  const [bulkAction, setBulkAction] = useState("status");
  const [statusValue, setStatusValue] = useState("ACTIVE");
  const [tagValue, setTagValue] = useState("");
  const [toastMessage, setToastMessage] = useState("");

  const isUpdating = fetcher.state !== "idle";

  // --- TABLE STATE ---
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(products);

  // --- MUTATION EFFECTS ---
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.message) {
        shopify.toast.show(fetcher.data.message);
        clearSelection();
        setTagValue("");
      }
      if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
      if (fetcher.data.errors?.length > 0) {
        setToastMessage(`Partial failure: ${fetcher.data.errors.join(" | ")}`);
      }
    }
  }, [fetcher.data, clearSelection]);

  // --- ACTIONS ---
  const executeBulkUpdate = () => {
    if (selectedResources.length === 0) {
      shopify.toast.show("Please select at least one product.", { isError: true });
      return;
    }
    
    let actionValue = bulkAction === "status" ? statusValue : tagValue;
    
    if (bulkAction === "add_tag" && !tagValue.trim()) {
      shopify.toast.show("Please enter a tag to add.", { isError: true });
      return;
    }

    fetcher.submit(
      {
        intent: "bulkUpdate",
        targetIds: JSON.stringify(selectedResources),
        actionType: bulkAction,
        actionValue: actionValue
      },
      { method: "post" }
    );
  };

  // --- RENDERING ---
  const rowMarkup = products.map(({ id, title, status, tags, totalInventory }, index) => (
    <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">{title}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={status === "ACTIVE" ? "success" : status === "DRAFT" ? "info" : "critical"}>
          {status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{totalInventory} in stock</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" color="subdued">{tags.length > 0 ? tags.join(", ") : "No tags"}</Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  const promotedBulkActions = [
    {
      content: 'Apply Bulk Edit',
      onAction: executeBulkUpdate,
    },
  ];

  return (
    <Page
      title="Bulk Editor"
      subtitle="Rapidly mutate product statuses and tags across your roster."
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        {/* ALERTS */}
        {error && <Banner tone="critical">{error}</Banner>}
        {toastMessage && <Banner tone="warning" onDismiss={() => setToastMessage("")}>{toastMessage}</Banner>}

        <Layout>
          {/* CONTROL PANEL */}
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Operation Settings</Text>
                
                <Select
                  label="Select Action"
                  options={[
                    { label: 'Change Status', value: 'status' },
                    { label: 'Add Tag', value: 'add_tag' },
                  ]}
                  value={bulkAction}
                  onChange={setBulkAction}
                />

                {bulkAction === "status" && (
                  <Select
                    label="Target Status"
                    options={[
                      { label: 'Active', value: 'ACTIVE' },
                      { label: 'Draft', value: 'DRAFT' },
                      { label: 'Archived', value: 'ARCHIVED' },
                    ]}
                    value={statusValue}
                    onChange={setStatusValue}
                  />
                )}

                {bulkAction === "add_tag" && (
                  <TextField
                    label="Tag to Add"
                    value={tagValue}
                    onChange={setTagValue}
                    autoComplete="off"
                    placeholder="e.g. Summer Sale, Rare"
                  />
                )}

                <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                  <Button
                    size="large"
                    variant="primary"
                    tone="success"
                    loading={isUpdating}
                    onClick={executeBulkUpdate}
                    disabled={selectedResources.length === 0}
                  >
                    Execute on {selectedResources.length} items
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* TABLE */}
          <Layout.Section>
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={products.length}
                selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                promotedBulkActions={promotedBulkActions}
                headings={[
                  { title: 'Product' },
                  { title: 'Status' },
                  { title: 'Inventory' },
                  { title: 'Tags' },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

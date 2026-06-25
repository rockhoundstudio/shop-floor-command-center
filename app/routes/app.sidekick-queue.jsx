import { useEffect } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import {
  Page, Layout, Card, Text, BlockStack, Badge, IndexTable, 
  Box, InlineStack, EmptySearchResult, Banner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH JOBS
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // Note: We should move this to the afterAuth hook later to save loader speed!
  const setupMutation = `#graphql
    mutation {
      metaobjectDefinitionCreate(definition: {
        name: "Sidekick Queue",
        type: "sidekick_queue",
        access: { admin: "MERCHANT_READ_WRITE" },
        fieldDefinitions: [
          { name: "Product ID", key: "productId", type: "single_line_text_field" },
          { name: "Key", key: "key", type: "single_line_text_field" },
          { name: "Value", key: "value", type: "single_line_text_field" },
          { name: "Status", key: "status", type: "single_line_text_field" }
        ]
      }) { metaobjectDefinition { id } }
    }
  `;
  try { await admin.graphql(setupMutation); } catch(e) { /* Silently ignore if it already exists */ }

  try {
    const response = await admin.graphql(`#graphql
      query {
        metaobjects(type: "sidekick_queue", first: 20, reverse: true) {
          edges { node { id fields { key value } } }
        }
      }
    `);

    const data = await response.json();
    const edges = data.data?.metaobjects?.edges || [];

    const jobs = edges.map((edge) => {
      const fields = edge.node.fields.reduce((acc, field) => {
        acc[field.key] = field.value; return acc;
      }, {});
      return {
        id: edge.node.id,
        productId: fields.productId || "N/A",
        targetKey: fields.key || "N/A",
        targetValue: fields.value || "N/A",
        status: fields.status || "pending",
      };
    });
    
    return Response.json({ jobs, success: true });
  } catch (error) {
    console.error("Sidekick Queue Loader Error:", error);
    return Response.json({ jobs: [], success: false, error: error.message });
  }
};

// ==========================================
// 2. CHASSIS: UI DASHBOARD
// ==========================================
export default function SidekickQueueTab() {
  const { jobs = [], error } = useLoaderData();
  const navigate = useNavigate();
  
  // Native way to refresh loader data safely
  const { revalidate, state } = useRevalidator();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (state === "idle") {
        revalidate();
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [state, revalidate]);

  const rowMarkup = jobs.map((job, index) => (
    <IndexTable.Row id={job.id} key={job.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {job.id.split('/').pop()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.productId.split('/').pop()}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">{job.targetKey}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.targetValue}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={job.status === "pending" ? "warning" : job.status === "complete" ? "success" : "critical"}>
          {job.status.toUpperCase()}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page 
      title="Sidekick Command Queue"
      subtitle="Live feed of AI jobs sent by Sidekick."
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        {error && <Banner tone="critical">{error}</Banner>}

        <Layout>
          <Layout.Section>
            <Card padding="0">
              <Box padding="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">Rockhound Studio - Job Queue</Text>
                    <Text tone="subdued" as="span">Auto-refreshes every 30 seconds.</Text>
                  </BlockStack>
                  <Badge tone={state === "loading" ? "info" : "success"}>
                    {state === "loading" ? "Syncing..." : "Live"}
                  </Badge>
                </InlineStack>
              </Box>

              {jobs.length === 0 && (
                <Box padding="800">
                  <EmptySearchResult
                    title="Waiting for Sidekick..."
                    description="No jobs in the queue yet. The database is linked and standing by."
                    withIllustration
                  />
                </Box>
              )}

              {jobs.length > 0 && (
                <IndexTable
                  resourceName={{ singular: 'job', plural: 'jobs' }}
                  itemCount={jobs.length}
                  selectable={false}
                  headings={[
                    { title: 'Job ID' },
                    { title: 'Product ID' },
                    { title: 'Metafield' },
                    { title: 'Value' },
                    { title: 'Status' },
                  ]}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
}


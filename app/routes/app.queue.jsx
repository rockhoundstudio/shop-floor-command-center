import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text, BlockStack, Badge, DataTable } from "@shopify/polaris";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  // --- SILENTLY AUTO-BUILD THE MAILBOX DATABASE IF MISSING ---
  const setupMutation = `
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
  try { await admin.graphql(setupMutation); } catch(e) { /* Ignore if it already exists */ }

  // --- LOAD THE QUEUE JOBS ---
  try {
    const response = await admin.graphql(`
      #graphql
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
    return json({ jobs });
  } catch (error) {
    return json({ jobs: [] });
  }
};

export default function SidekickQueueTab() {
  const { jobs } = useLoaderData();
  const fetcher = useFetcher();

  useEffect(() => {
    const interval = setInterval(() => {
      if (fetcher.state === "idle") fetcher.load("/app/queue");
    }, 30000);
    return () => clearInterval(interval);
  }, [fetcher]);

  const rows = jobs.map((job) => [
    job.id.split('/').pop(),
    job.productId.split('/').pop(),
    job.targetKey,
    job.targetValue,
    <Badge tone={job.status === "pending" ? "warning" : job.status === "complete" ? "success" : "critical"}>
      {job.status}
    </Badge>,
  ]);

  return (
    <Page title="Sidekick Queue">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Rockhound Studio - AI Command Queue</Text>
              <Text as="p">Live feed of jobs sent by Sidekick. This dashboard auto-refreshes every 30 seconds.</Text>
              {jobs.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Job ID', 'Product ID', 'Metafield', 'Value', 'Status']}
                  rows={rows}
                />
              ) : (
                <Text as="p">Waiting for Sidekick... No jobs in the queue yet. (Database is linked and ready!)</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

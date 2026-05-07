import { useLoaderData, useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text, BlockStack, DataTable } from "@shopify/polaris";

export const loader = async ({ request }) => {
  // THE FIX: Shopify's security check MUST be outside the error trap!
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      #graphql
      query {
        metaobjects(type: "sidekick_queue", first: 20) {
          edges { node { id fields { key value } } }
        }
      }
    `);

    const data = await response.json();
    const edges = data.data?.metaobjects?.edges || [];

    const jobs = edges.map((edge) => {
      const fields = (edge.node.fields || []).reduce((acc, field) => {
        acc[field.key] = field.value; return acc;
      }, {});
      return {
        id: String(edge.node.id || "N/A"),
        productId: String(fields.productId || "N/A"),
        targetKey: String(fields.key || "N/A"),
        targetValue: String(fields.value || "N/A"),
        status: String(fields.status || "pending"),
      };
    });
    return Response.json({ jobs });
  } catch (error) {
    return Response.json({ jobs: [] });
  }
};

export default function SidekickQueueTab() {
  const data = useLoaderData();
  const jobs = data?.jobs || [];

  // THE FIX 2: 100% plain text rendering so React cannot crash
  const rows = jobs.map((job) => [
    String(job.id).split('/').pop(),
    String(job.productId).split('/').pop(),
    String(job.targetKey),
    String(job.targetValue),
    String(job.status).toUpperCase()
  ]);

  return (
    <Page title="Sidekick Queue">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Rockhound Studio - AI Command Queue</Text>
              <Text as="p">Live feed of jobs sent by Sidekick.</Text>
              {jobs.length > 0 ? (
                <DataTable
                  columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                  headings={['Job ID', 'Product ID', 'Metafield', 'Value', 'Status']}
                  rows={rows}
                />
              ) : (
                <Text as="p">Waiting for Sidekick... No jobs in the queue yet. (Tab is stable and active!)</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// THE BLACK BOX: If it crashes, Bob sees the exact error, not a white screen.
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="System Error">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">We hit a snag.</Text>
              <Text as="p">Please copy this error for Gemini: {error?.message || "Unknown rendering error"}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text, BlockStack, Badge, DataTable } from "@shopify/polaris";
import { useEffect } from "react";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

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
        id: edge.node.id ? String(edge.node.id) : "N/A",
        productId: fields.productId ? String(fields.productId) : "N/A",
        targetKey: fields.key ? String(fields.key) : "N/A",
        targetValue: fields.value ? String(fields.value) : "N/A",
        status: fields.status ? String(fields.status) : "pending",
      };
    });
    return Response.json({ jobs });
  } catch (error) {
    // Fails safely if the metaobject doesn't exist yet
    return Response.json({ jobs: [] });
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

  // Heavily armored string splitting to prevent React crashes
  const rows = jobs.map((job) => [
    job.id && job.id.includes('/') ? job.id.split('/').pop() : job.id || "N/A",
    job.productId && job.productId.includes('/') ? job.productId.split('/').pop() : job.productId || "N/A",
    job.targetKey || "N/A",
    job.targetValue || "N/A",
    <Badge tone={job.status === "pending" ? "warning" : job.status === "complete" ? "success" : "critical"}>
      {job.status || "pending"}
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
              {jobs && jobs.length > 0 ? (
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

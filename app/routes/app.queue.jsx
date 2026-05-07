import { useLoaderData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text, BlockStack, DataTable, Button, Banner } from "@shopify/polaris";

export const loader = async ({ request }) => {
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

    // If Shopify returns an error because the DB doesn't exist, trigger the setup button
    if (data.errors) {
      return Response.json({ jobs: [], needsSetup: true });
    }

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
    return Response.json({ jobs, needsSetup: false });
  } catch (error) {
    return Response.json({ jobs: [], needsSetup: true });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
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
  try {
    await admin.graphql(setupMutation);
    return Response.json({ success: true });
  } catch (e) {
    return Response.json({ success: false, error: e.message });
  }
};

export default function SidekickQueueTab() {
  const { jobs, needsSetup } = useLoaderData() || { jobs: [], needsSetup: true };
  const submit = useSubmit();
  const nav = useNavigation();
  const isLoading = nav.state === "submitting";

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
          {needsSetup ? (
            <Card>
              <BlockStack gap="400">
                <Banner tone="warning" title="Missing Database" />
                <Text as="p">Sidekick was right! The holding tank doesn't exist yet. Click the button below to have the app build it automatically.</Text>
                <Button variant="primary" loading={isLoading} onClick={() => submit({}, { method: "post" })}>
                  Build Queue Database Now
                </Button>
              </BlockStack>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Rockhound Studio - AI Command Queue</Text>
                <Text as="p">Live feed of jobs sent by Sidekick. (Database is linked and active!)</Text>
                {jobs.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                    headings={['Job ID', 'Product ID', 'Metafield', 'Value', 'Status']}
                    rows={rows}
                  />
                ) : (
                  <Text as="p">Waiting for Sidekick... No jobs in the queue yet.</Text>
                )}
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}

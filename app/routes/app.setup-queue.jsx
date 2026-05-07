import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  const mutation = `
    mutation CreateMetaobjectDefinition($definition: MetaobjectDefinitionCreateInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        metaobjectDefinition {
          name
          type
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    definition: {
      name: "Sidekick Queue",
      type: "sidekick_queue",
      access: {
        admin: "MERCHANT_READ_WRITE"
      },
      fieldDefinitions: [
        { name: "Product ID", key: "productId", type: "single_line_text_field" },
        { name: "Key", key: "key", type: "single_line_text_field" },
        { name: "Value", key: "value", type: "single_line_text_field" },
        { name: "Status", key: "status", type: "single_line_text_field" }
      ]
    }
  };

  try {
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();
    return json({ data });
  } catch (error) {
    return json({ error: error.message });
  }
};

export default function SetupQueue() {
  const { data, error } = useLoaderData();
  
  return (
    <Page title="Queue Setup">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Rockhound Studio - Auto Setup</Text>
              <Text as="p">
                If you see data below with no userErrors, the Sidekick Queue was successfully created in Shopify! 
                You can now close this tab and go back to the Command Center.
              </Text>
              <div style={{ padding: "10px", backgroundColor: "#f4f6f8", borderRadius: "5px" }}>
                <pre>{JSON.stringify(data || error, null, 2)}</pre>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

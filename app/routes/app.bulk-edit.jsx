import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, Text, Button, BlockStack } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query getCollections {
      collections(first: 250) {
        edges {
          node {
            id
            title
            handle
          }
        }
      }
    }`
  );

  const data = await response.json();
  const edges = data.data.collections.edges;
  
  const collectionHandles = [];
  for (let i = 0; i < edges.length; i++) {
    collectionHandles.push(edges[i].node.handle);
  }

  return json({
    collectionHandles: collectionHandles
  });
};

export function getPageCategory(handle, url, collectionHandles) {
  if (collectionHandles.includes(handle)) {
    return "Collection";
  }

  if (url.includes("/pages/")) {
    return "Story";
  }

  return "Page";
}

export default function MenuManager() {
  const { collectionHandles } = useLoaderData();
  const navigate = useNavigate();

  return (
    <Page
      title="Menu Manager"
      backAction={{
        content: "Back",
        onAction: () => navigate("/app"),
        accessibilityLabel: "Navigate back to Command Center",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Menu Configuration Data Active
              </Text>
              
              {collectionHandles.length > 0 ? (
                <Text as="p">Connected to Shopify GraphQL. Category mapping dynamically applied.</Text>
              ) : (
                <Text as="p">Awaiting collection data or store has zero collections.</Text>
              )}
              
              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                <Button 
                  accessibilityLabel="Refresh live menu categories" 
                  onClick={() => navigate(0)}
                  size="large"
                >
                  Refresh Live Data
                </Button>
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`
    query {
      products(first: 50) {
        edges {
          node {
            id
            title
            featuredImage {
              url
              altText
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  const products = data.data.products.edges.map(({ node }) => node);
  return { products };
};

export default function MetaInjector() {
  const { products } = useLoaderData();
  const [search, setSearch] = useState("");

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Page title="Meta Injector">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <TextField
                label="Search stones"
                value={search}
                onChange={setSearch}
                placeholder="Type a stone name..."
                clearButton
                onClearButtonClick={() => setSearch("")}
                autoComplete="off"
              />
              <ResourceList
                resourceName={{ singular: "stone", plural: "stones" }}
                items={filtered}
                renderItem={(product) => (
                  <ResourceItem
                    id={product.id}
                    media={
                      <Thumbnail
                        source={product.featuredImage?.url || ""}
                        alt={product.featuredImage?.altText || product.title}
                        size="medium"
                      />
                    }
                  >
                    <Text variant="bodyMd" fontWeight="bold">
                      {product.title}
                    </Text>
                  </ResourceItem>
                )}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong loading Meta Injector.</div>;
}

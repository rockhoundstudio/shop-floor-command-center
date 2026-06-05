import React, { useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, Box, InlineStack, Divider
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // These are the old ghosts throwing the errors
  const TARGET_KEYS = ["is_one_of_a_kind", "treated", "found_object", "honest_flaws_and_character", "origin_story", "artist_notes"];
  const NAMESPACE = "custom"; // Targeting the live namespace!
  const results = [];

  let definitions = [];
  try {
    const queryResponse = await admin.graphql(`
      #graphql
      query GetMetafieldDefinitions {
        metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "${NAMESPACE}") {
          edges {
            node {
              id
              key
              name
            }
          }
        }
      }
    `);
    const json = await queryResponse.json();
    if (json.data && json.data.metafieldDefinitions && json.data.metafieldDefinitions.edges) {
      definitions = json.data.metafieldDefinitions.edges.map(edge => edge.node);
    }
  } catch (error) {
    results.push({ step: "Fetch", status: "error", message: error.message });
  }

  for (const key of TARGET_KEYS) {
    const defToDelete = definitions.find(def => def.key === key);
    if (defToDelete) {
      try {
        const deleteResponse = await admin.graphql(`
          #graphql
          mutation DeleteMetafieldDefinition($id: ID!) {
            metafieldDefinitionDelete(id: $id) {
              deletedDefinitionId
              userErrors { field message }
            }
          }
        `, { variables: { id: defToDelete.id } });
        
        const deleteJson = await deleteResponse.json();
        const userErrors = deleteJson.data && deleteJson.data.metafieldDefinitionDelete && deleteJson.data.metafieldDefinitionDelete.userErrors ? deleteJson.data.metafieldDefinitionDelete.userErrors : [];
        
        if (userErrors.length > 0) {
          results.push({ field: key, action: "Delete", status: "error", message: userErrors[0].message });
        } else {
          results.push({ field: key, action: "Delete", status: "success", message: "Deleted old format" });
        }
      } catch (error) {
        results.push({ field: key, action: "Delete", status: "error", message: error.message });
      }
    }
  }

  // Recreate with strict single text field for the dropdowns
  const FIELDS_TO_CREATE = [
    { namespace: NAMESPACE, key: "is_one_of_a_kind", name: "Is One of a Kind", type: "single_line_text_field" },
    { namespace: NAMESPACE, key: "treated", name: "Treated", type: "single_line_text_field" },
    { namespace: NAMESPACE, key: "found_object", name: "Found Object", type: "single_line_text_field" },
    { namespace: NAMESPACE, key: "honest_flaws_and_character", name: "Honest Flaws and Character", type: "single_line_text_field" },
    { namespace: NAMESPACE, key: "origin_story", name: "Origin Story", type: "single_line_text_field" },
    { namespace: NAMESPACE, key: "artist_notes", name: "Artist Notes", type: "single_line_text_field" }
  ];

  for (const def of FIELDS_TO_CREATE) {
    try {
      const createResponse = await admin.graphql(`
        #graphql
        mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition { name }
            userErrors { field message }
          }
        }
      `, {
        variables: {
          definition: {
            namespace: def.namespace,
            key: def.key,
            name: def.name,
            type: def.type,
            ownerType: "PRODUCT"
          }
        }
      });

      const createJson = await createResponse.json();
      const userErrors = createJson.data && createJson.data.metafieldDefinitionCreate && createJson.data.metafieldDefinitionCreate.userErrors ? createJson.data.metafieldDefinitionCreate.userErrors : [];

      if (userErrors.length > 0) {
        // Ignore "taken" errors if they already exist properly
        if (!userErrors[0].message.includes("taken")) {
           results.push({ field: def.key, action: "Create", status: "error", message: userErrors[0].message });
        }
      } else {
        results.push({ field: def.key, action: "Create", status: "success", message: "Recreated securely" });
      }
    } catch (error) {
      results.push({ field: def.key, action: "Create", status: "error", message: error.message });
    }
  }

  return { results };
}

export default function FixMetafieldsRoute() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;

  const isSubmitting = fetcher.state !== "idle";
  const data = fetcher.data;

  const handleRunFix = () => fetcher.submit({}, { method: "post" });

  useEffect(() => {
    if (fetcher.state === "idle" && data && data.results) {
      if (shopify) shopify.toast.show("Database correction routine finished.");
    }
  }, [fetcher.state, data, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success") return <span style={{ color: "#2E7D32" }}>✅</span>;
    if (status === "error") return <span style={{ color: "#C62828" }}>❌</span>;
    return <span>⚠️</span>;
  };

  return (
    <Page title="Fix Metafield Definitions" backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Eradicate Old Data Types</Text>
                <Text as="p">
                  Purges the old boolean and list definitions from the live "custom" namespace and immediately rebuilds them to match the new Command Center schema.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: '60px' }}>
                    <Button size="large" variant="primary" tone="critical" fullWidth onClick={handleRunFix} loading={isSubmitting}>
                      {isSubmitting ? "Running Mutations..." : "Nuke & Rebuild Fields"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {data && data.results && (
              <Card padding="600">
                <BlockStack gap="400">
                  <Text variant="headingLg" as="h3">Execution Log</Text>
                  <Divider />
                  {data.results.map((r, i) => (
                    <InlineStack key={i} gap="300" align="space-between">
                      <Text as="span"><b>[{r.action}]</b> {r.field}</Text>
                      <Text as="span"><StatusIcon status={r.status} /> {r.message}</Text>
                    </InlineStack>
                  ))}
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
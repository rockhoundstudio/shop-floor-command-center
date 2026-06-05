import React, { useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, Box, InlineStack, Badge, Divider
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const TARGET_KEYS = ["is_one_of_a_kind", "treated", "found_object"];
  const NAMESPACE = "rockhound";
  const results = [];

  // 1. Fetch existing definitions to get their IDs
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

  // 2. Delete targeted metafields
  for (const key of TARGET_KEYS) {
    const defToDelete = definitions.find(def => def.key === key);
    if (defToDelete) {
      try {
        const deleteResponse = await admin.graphql(`
          #graphql
          mutation DeleteMetafieldDefinition($id: ID!) {
            metafieldDefinitionDelete(id: $id) {
              deletedDefinitionId
              userErrors {
                field
                message
              }
            }
          }
        `, {
          variables: { id: defToDelete.id }
        });
        
        const deleteJson = await deleteResponse.json();
        const userErrors = deleteJson.data && deleteJson.data.metafieldDefinitionDelete && deleteJson.data.metafieldDefinitionDelete.userErrors ? deleteJson.data.metafieldDefinitionDelete.userErrors : [];
        
        if (userErrors.length > 0) {
          results.push({ field: key, action: "Delete", status: "error", message: userErrors[0].message });
        } else {
          results.push({ field: key, action: "Delete", status: "success", message: `Deleted successfully (ID: ${defToDelete.id})` });
        }
      } catch (error) {
        results.push({ field: key, action: "Delete", status: "error", message: error.message });
      }
    } else {
      results.push({ field: key, action: "Delete", status: "info", message: "Did not exist, skipping delete" });
    }
  }

  // 3. Recreate the 3 metafields as single_line_text_field
  const FIELDS_TO_CREATE = [
    { namespace: NAMESPACE, key: "is_one_of_a_kind", name: "Is One of a Kind", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: NAMESPACE, key: "treated", name: "Treated", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: NAMESPACE, key: "found_object", name: "Found Object", type: "single_line_text_field", ownerType: "PRODUCT" }
  ];

  for (const def of FIELDS_TO_CREATE) {
    try {
      const createResponse = await admin.graphql(`
        #graphql
        mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition {
              name
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          definition: {
            namespace: def.namespace,
            key: def.key,
            name: def.name,
            type: def.type,
            ownerType: def.ownerType
          }
        }
      });

      const createJson = await createResponse.json();
      const userErrors = createJson.data && createJson.data.metafieldDefinitionCreate && createJson.data.metafieldDefinitionCreate.userErrors ? createJson.data.metafieldDefinitionCreate.userErrors : [];

      if (userErrors.length > 0) {
        results.push({ field: def.key, action: "Create", status: "error", message: userErrors[0].message });
      } else {
        results.push({ field: def.key, action: "Create", status: "success", message: "Created as single_line_text_field" });
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

  const handleRunFix = () => {
    fetcher.submit({}, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.state === "idle" && data && data.results) {
      if (shopify) {
        const hasErrors = data.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Fix completed with some errors.", { isError: true });
        } else {
          shopify.toast.show("Metafields successfully recreated.");
        }
      }
    }
  }, [fetcher.state, data, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success") {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label="Success" role="img">
          <circle cx="10" cy="10" r="10" fill="#2E7D32" />
          <path d="M5.5 10.5L8.5 13.5L14.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    if (status === "info") {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label="Info" role="img">
          <circle cx="10" cy="10" r="10" fill="#1565C0" />
          <path d="M10 6L10 6.5M10 9L10 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    }
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label="Error" role="img">
        <circle cx="10" cy="10" r="10" fill="#C62828" />
        <path d="M6 6L14 14M14 6L6 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  return (
    <Page
      title="Fix Dropdown Metafields"
      subtitle="Rockhound Studio Database Correction"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Rebuild Dropdown Fields</Text>
                <Text as="p">
                  This tool targets three specific fields (is_one_of_a_kind, treated, found_object) that were previously constructed with the wrong data type. 
                  It will safely delete the existing definitions and immediately recreate them as single_line_text_field so the UI dropdowns work flawlessly.
                </Text>
                
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: '60px', minWidth: '100%' }}>
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="critical" 
                      fullWidth 
                      onClick={handleRunFix} 
                      loading={isSubmitting}
                      accessibilityLabel="Delete and Recreate 3 Metafields"
                    >
                      {isSubmitting ? "Running Mutations..." : "Delete and Recreate Fields"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {data && data.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Execution Results</Text>
                  
                  <Divider />

                  <BlockStack gap="300">
                    {data.results.map((result, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E1E3E5' }}>
                        <InlineStack gap="300" align="start" blockAlign="center">
                          <StatusIcon status={result.status} />
                          <Text as="span" fontWeight="bold">
                            [{result.action}] {result.field}
                          </Text>
                        </InlineStack>
                        <Text as="span" tone={result.status === "error" ? "critical" : "subdued"}>
                          {result.message}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
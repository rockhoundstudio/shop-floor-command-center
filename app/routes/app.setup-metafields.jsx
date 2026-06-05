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
  
  const METAFIELD_DEFS = [
    // 🟢 Always Fill
    { namespace: "rockhound", key: "piece_name", name: "Piece Name", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "primary_medium", name: "Primary Medium", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "handcrafted_by", name: "Handcrafted By", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "is_one_of_a_kind", name: "Is One of a Kind", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "treated", name: "Treated", type: "single_line_text_field", ownerType: "PRODUCT" },
    // 🔵 Stone Fields
    { namespace: "rockhound", key: "material", name: "Material", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "stone_family", name: "Stone Family", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "color", name: "Color", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "cut_and_shape", name: "Cut and Shape", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "surface_finish", name: "Surface Finish", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "dimensions_mm", name: "Dimensions (mm)", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "weight_grams", name: "Weight (grams)", type: "single_line_text_field", ownerType: "PRODUCT" },
    // 🟠 Story & Lore
    { namespace: "rockhound", key: "origin_story", name: "Origin Story", type: "multi_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "trip_or_series", name: "Trip or Series", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "honest_flaws_and_character", name: "Honest Flaws and Character", type: "multi_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "artist_notes", name: "Artist Notes", type: "multi_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "collection_name", name: "Collection Name", type: "single_line_text_field", ownerType: "PRODUCT" },
    // 🟣 Mixed Media
    { namespace: "rockhound", key: "secondary_medium", name: "Secondary Medium", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "found_object", name: "Found Object", type: "single_line_text_field", ownerType: "PRODUCT" },
    // 🟡 Google / SEO
    { namespace: "rockhound", key: "primary_use", name: "Primary Use", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "setting_ready", name: "Setting Ready", type: "single_line_text_field", ownerType: "PRODUCT" },
    { namespace: "rockhound", key: "bail_included", name: "Bail Included", type: "single_line_text_field", ownerType: "PRODUCT" }
  ];

  const results = [];
  let createdCount = 0;
  let existsCount = 0;
  let errorCount = 0;

  for (const def of METAFIELD_DEFS) {
    try {
      const response = await admin.graphql(`
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

      const json = await response.json();
      const userErrors = json.data && json.data.metafieldDefinitionCreate && json.data.metafieldDefinitionCreate.userErrors ? json.data.metafieldDefinitionCreate.userErrors : [];

      if (userErrors.length > 0) {
        const isTaken = userErrors.some(err => err.message.toLowerCase().includes("taken") || err.message.toLowerCase().includes("already exists"));
        if (isTaken) {
          existsCount++;
          results.push({ name: def.name, status: "exists", message: "Already exists" });
        } else {
          errorCount++;
          results.push({ name: def.name, status: "error", message: userErrors[0].message });
        }
      } else {
        createdCount++;
        results.push({ name: def.name, status: "success", message: "Successfully created" });
      }
    } catch (error) {
      errorCount++;
      results.push({ name: def.name, status: "error", message: error.message || "Network or execution error" });
    }
  }

  return {
    results,
    summary: { createdCount, existsCount, errorCount, total: METAFIELD_DEFS.length }
  };
}

export default function SetupMetafieldsRoute() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;

  const isSubmitting = fetcher.state !== "idle";
  const data = fetcher.data;

  const handleRunSetup = () => {
    fetcher.submit({}, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.state === "idle" && data && data.summary) {
      if (shopify) {
        if (data.summary.errorCount > 0) {
          shopify.toast.show("Setup completed with some errors.", { isError: true });
        } else {
          shopify.toast.show("Setup completed successfully.");
        }
      }
    }
  }, [fetcher.state, data, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success" || status === "exists") {
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-label={status === "success" ? "Success" : "Already exists"} role="img">
          <circle cx="10" cy="10" r="10" fill="#2E7D32" />
          <path d="M5.5 10.5L8.5 13.5L14.5 6.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
      title="Database Infrastructure Setup"
      subtitle="Rockhound Studio Metafield Definitions"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Initialize 22 Metafields</Text>
                <Text as="p">
                  This tool will create the 22 database receptacles required by the Command Center into your live Shopify Admin settings. 
                  It is safe to run multiple times; if a field already exists, it will simply skip it without breaking.
                </Text>
                
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: '60px', minWidth: '100%' }}>
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="success" 
                      fullWidth 
                      onClick={handleRunSetup} 
                      loading={isSubmitting}
                      accessibilityLabel="Create All 22 Metafields"
                    >
                      {isSubmitting ? "Running GraphQL Mutations..." : "Create All 22 Metafields"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {data && data.summary && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Execution Summary</Text>
                  
                  <InlineStack gap="400" align="start">
                    <Badge tone="success" size="large">{data.summary.createdCount} Created</Badge>
                    <Badge tone="info" size="large">{data.summary.existsCount} Already Existed</Badge>
                    {data.summary.errorCount > 0 && (
                      <Badge tone="critical" size="large">{data.summary.errorCount} Errors</Badge>
                    )}
                  </InlineStack>

                  <Divider />

                  <BlockStack gap="300">
                    {data.results && data.results.map((result, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #E1E3E5' }}>
                        <InlineStack gap="300" align="start" blockAlign="center">
                          <StatusIcon status={result.status} />
                          <Text as="span" fontWeight="bold">{result.name}</Text>
                        </InlineStack>
                        <Text as="span" tone={result.status === "error" ? "critical" : "subdued"}>
                          {result.status === "exists" ? "Already exists ✅" : result.message}
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
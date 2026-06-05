import React, { useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, Box, InlineStack, Divider, Banner
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const results = [];
  let productsProcessed = 0;
  let fieldsMigrated = 0;

  try {
    // 1. Fetch products and their current metafields from the rockhound namespace
    // Grabbing a solid chunk of 250 products to process in one click
    const queryResponse = await admin.graphql(`
      #graphql
      query GetAllProductsForMigration {
        products(first: 250) {
          edges {
            node {
              id
              title
              metafields(first: 50, namespace: "rockhound") {
                edges {
                  node {
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `);
    
    const json = await queryResponse.json();
    const products = json.data && json.data.products && json.data.products.edges ? json.data.products.edges.map(e => e.node) : [];

    const allNewMetafields = [];

    // 2. Loop through products and map the old data
    products.forEach(product => {
      if (product.metafields && product.metafields.edges && product.metafields.edges.length > 0) {
        const mfs = product.metafields.edges.map(e => e.node);
        const getVal = (key) => {
          const field = mfs.find(f => f.key === key);
          return field ? field.value : null;
        };

        // Extract old values
        const stoneStory = getVal("stone_story");
        const originLocation = getVal("origin_location");
        const characterMarks = getVal("character_marks");
        const treatmentStatus = getVal("treatment_status");
        const stoneShape = getVal("stone_shape");
        const rescuedBy = getVal("rescued_by");
        
        // Extract the science fields for the bundle
        const mohs = getVal("mohs_hardness") || getVal("hardness");
        const fracture = getVal("fracture");
        const cleavage = getVal("cleavage");
        const diaphaneity = getVal("diaphaneity");
        const age = getVal("geological_age");
        const gravity = getVal("specific_gravity");

        let productUpdates = [];

        // MAPPING: Origin Story (Merge location and story)
        const newOrigin = [stoneStory, originLocation].filter(Boolean).join(" — ");
        if (newOrigin) {
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "origin_story", value: newOrigin, type: "single_line_text_field" });
        }

        // MAPPING: Honest Flaws
        if (characterMarks) {
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "honest_flaws_and_character", value: characterMarks, type: "single_line_text_field" });
        }

        // MAPPING: Treated
        if (treatmentStatus) {
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "treated", value: treatmentStatus, type: "single_line_text_field" });
        }

        // MAPPING: Cut and Shape
        if (stoneShape) {
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "cut_and_shape", value: stoneShape, type: "single_line_text_field" });
        }

        // MAPPING: Handcrafted By
        if (rescuedBy) {
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "handcrafted_by", value: rescuedBy, type: "single_line_text_field" });
        }

        // MAPPING: The Science Bundle -> Artist Notes
        const specs = [
          mohs ? `Mohs: ${mohs}` : null,
          fracture ? `Fracture: ${fracture}` : null,
          cleavage ? `Cleavage: ${cleavage}` : null,
          diaphaneity ? `Diaphaneity: ${diaphaneity}` : null,
          age ? `Age: ${age}` : null,
          gravity ? `Gravity: ${gravity}` : null
        ].filter(Boolean).join(" | ");

        if (specs) {
          const shopSpecsNote = `[Shop Specs] ${specs}`;
          productUpdates.push({ ownerId: product.id, namespace: "rockhound", key: "artist_notes", value: shopSpecsNote, type: "single_line_text_field" });
        }

        if (productUpdates.length > 0) {
          allNewMetafields.push(...productUpdates);
          productsProcessed++;
        }
      }
    });

    // 3. Save the new mappings in chunks of 25 (Shopify limit for metafieldsSet)
    const chunks = [];
    for (let i = 0; i < allNewMetafields.length; i += 25) {
      chunks.push(allNewMetafields.slice(i, i + 25));
    }

    for (const chunk of chunks) {
      const setResponse = await admin.graphql(`
        #graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }
      `, { variables: { metafields: chunk } });

      const setJson = await setResponse.json();
      const errors = setJson.data && setJson.data.metafieldsSet && setJson.data.metafieldsSet.userErrors ? setJson.data.metafieldsSet.userErrors : [];
      
      if (errors.length > 0) {
        results.push({ status: "error", message: `Chunk failed: ${errors[0].message}` });
      } else {
        fieldsMigrated += chunk.length;
      }
    }

    results.push({ status: "success", message: `Scanned ${products.length} products. Migrated ${fieldsMigrated} total fields across ${productsProcessed} items.` });

  } catch (error) {
    results.push({ status: "error", message: `Migration completely failed: ${error.message}` });
  }

  return { results, productsProcessed, fieldsMigrated };
}

export default function MigrateDataRoute() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;

  const isSubmitting = fetcher.state !== "idle";
  const data = fetcher.data;

  const handleRunMigration = () => {
    fetcher.submit({}, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.state === "idle" && data && data.results) {
      if (shopify) {
        const hasErrors = data.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Migration finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Successfully migrated ${data.fieldsMigrated} fields!`);
        }
      }
    }
  }, [fetcher.state, data, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success") return <span style={{ color: "#2E7D32" }}>✅</span>;
    return <span style={{ color: "#C62828" }}>❌</span>;
  };

  return (
    <Page
      title="Data Migration Engine"
      subtitle="Rockhound Studio Legacy Data Importer"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Banner tone="info" title="The Data Bundling Strategy">
              <p>
                This script safely grabs your old science fields (Mohs, cleavage, diaphaneity, etc.) and bundles them into a clean <b>Shop Specs</b> text string inside the new <b>Artist Notes</b> field. This keeps Google happy with keywords without forcing you to manage useless fields manually.
              </p>
            </Banner>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Run Legacy Migration</Text>
                <Text as="p">
                  Clicking this button will scan your products, map the old data over to the new Freeform Revolution schema, and build the Shop Specs bundles. 
                  (It is safe to run multiple times—it will just overwrite the new fields with the exact same legacy data).
                </Text>
                
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: '60px', minWidth: '100%' }}>
                    <Button 
                      size="large" 
                      variant="primary" 
                      fullWidth 
                      onClick={handleRunMigration} 
                      loading={isSubmitting}
                      accessibilityLabel="Run Data Migration"
                    >
                      {isSubmitting ? "Scanning and Migrating Data..." : "Run Auto-Migration"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {data && data.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Migration Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {data.results.map((result, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #E1E3E5' }}>
                        <StatusIcon status={result.status} />
                        <Text as="span" tone={result.status === "error" ? "critical" : "base"}>
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
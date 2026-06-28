import React, { useEffect } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Button, BlockStack, Box, Divider, Banner
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── STANDARDIZE ONE OF A KIND ──────────────────────────────────────────────
  if (intent === "standardizeOneOfAKind") {
    const results = [];
    let fixed = 0;

    try {
      const queryResponse = await admin.graphql(`
        #graphql
        query GetProductsForStandardize {
          products(first: 250) {
            edges {
              node {
                id
                title
                metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      id
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
      const products = json.data && json.data.products && json.data.products.edges
        ? json.data.products.edges.map(e => e.node)
        : [];

      const toFix = [];

      products.forEach(product => {
        if (product.metafields && product.metafields.edges) {
          product.metafields.edges.forEach(edge => {
            if (edge.node.key === "is_one_of_a_kind" && edge.node.value === "true") {
              toFix.push({
                ownerId: product.id,
                namespace: "custom",
                key: "is_one_of_a_kind",
                value: "Yes — one of a kind",
                type: "single_line_text_field"
              });
            }
          });
        }
      });

      if (toFix.length === 0) {
        results.push({ status: "success", message: "All products already standardized. Nothing to update." });
      } else {
        const chunks = [];
        for (let i = 0; i < toFix.length; i += 25) {
          chunks.push(toFix.slice(i, i + 25));
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
          const errors = setJson.data && setJson.data.metafieldsSet && setJson.data.metafieldsSet.userErrors
            ? setJson.data.metafieldsSet.userErrors
            : [];

          if (errors.length > 0) {
            results.push({ status: "error", message: `Chunk failed: ${errors[0].message}` });
          } else {
            fixed += chunk.length;
          }
        }

        results.push({ status: "success", message: `Done. Updated ${fixed} products to "Yes — one of a kind".` });
      }
    } catch (error) {
      results.push({ status: "error", message: `Standardize failed: ${error.message}` });
    }

    return { intent, results, fixed };
  }

  // ── COPY ROCKHOUND TO CUSTOM ──────────────────────────────────────────────
  if (intent === "copyRockhoundToCustom") {
    const results = [];
    let fieldsWritten = 0;

    try {
      const GET_PRODUCTS = `
        query {
          products(first: 250) {
            edges {
              node {
                id
                rockhoundMeta: metafields(first: 50, namespace: "custom") {
                  edges { node { key value } }
                }
                customMeta: metafields(first: 50, namespace: "custom") {
                  edges { node { key value } }
                }
              }
            }
          }
        }
      `;
      
      const res = await admin.graphql(GET_PRODUCTS);
      const json = await res.json();
      const products = json.data?.products?.edges || [];
      
      const KEYS_TO_COPY = [
        "primary_medium", "stone_family", "collection_name", "treated",
        "found_object", "custom_product", "cut_and_shape", "origin_story", "honest_flaws_and_character"
      ];

      const mutations = [];
      
      for (const p of products) {
        const rockhound = p.node.rockhoundMeta?.edges || [];
        const custom = p.node.customMeta?.edges || [];
        
        for (const key of KEYS_TO_COPY) {
          const rNode = rockhound.find(e => e.node.key === key);
          const cNode = custom.find(e => e.node.key === key);
          
          const rValue = rNode?.node?.value;
          const cValue = cNode?.node?.value;
          
          if (rValue && rValue.trim() !== "" && (!cValue || cValue.trim() === "")) {
            mutations.push({
              ownerId: p.node.id,
              namespace: "custom",
              key: key,
              value: rValue,
              type: "single_line_text_field"
            });
          }
        }
      }

      const SET_METAFIELDS = `
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }
      `;

      const chunks = [];
      for (let i = 0; i < mutations.length; i += 25) {
        chunks.push(mutations.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        const res = await admin.graphql(SET_METAFIELDS, { variables: { metafields: chunk } });
        const json = await res.json();
        
        const errors = json.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) {
          results.push({ status: "error", message: `Copy chunk failed: ${errors[0].message}` });
        } else {
          fieldsWritten += chunk.length;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      results.push({ status: "success", message: `Scanned ${products.length} products. Copied ${fieldsWritten} fields to custom namespace.` });
    } catch (e) {
      results.push({ status: "error", message: `Copy failed: ${e.message}` });
    }
    
    return { intent, results };
  }

  // ── DELETE ROCKHOUND NAMESPACE ────────────────────────────────────────────
  if (intent === "deleteRockhoundNamespace") {
    const results = [];
    let deletedCount = 0;

    try {
      const GET_PRODUCTS = `
        query {
          products(first: 250) {
            edges {
              node {
                id
                rockhoundMeta: metafields(first: 50, namespace: "custom") {
                  edges { node { key } }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(GET_PRODUCTS);
      const json = await res.json();
      const products = json.data?.products?.edges || [];
      
      const deletePayloads = [];
      for (const p of products) {
        const rockhound = p.node.rockhoundMeta?.edges || [];
        for (const e of rockhound) {
          deletePayloads.push({
            ownerId: p.node.id,
            namespace: "custom",
            key: e.node.key
          });
        }
      }

      const DELETE_METAFIELDS = `
        mutation MetafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) {
            deletedMetafields { key namespace ownerId }
            userErrors { field message }
          }
        }
      `;

      const chunks = [];
      for (let i = 0; i < deletePayloads.length; i += 25) {
        chunks.push(deletePayloads.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        const delRes = await admin.graphql(DELETE_METAFIELDS, { variables: { metafields: chunk } });
        const delJson = await delRes.json();
        
        const errors = delJson.data?.metafieldsDelete?.userErrors || [];
        if (errors.length > 0) {
          results.push({ status: "error", message: `Delete chunk failed: ${errors[0].message}` });
        } else {
          deletedCount += chunk.length;
        }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      results.push({ status: "success", message: `Scanned ${products.length} products. Deleted ${deletedCount} fields from rockhound namespace.` });
    } catch (e) {
      results.push({ status: "error", message: `Delete failed: ${e.message}` });
    }
    
    return { intent, results };
  }

  // ── LEGACY MIGRATION ───────────────────────────────────────────────────────
  if (intent === "migrate") {
    const results = [];
    let productsProcessed = 0;
    let fieldsMigrated = 0;

    try {
      const queryResponse = await admin.graphql(`
        #graphql
        query GetAllProductsForMigration {
          products(first: 250) {
            edges {
              node {
                id
                title
                customMetafields: metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
                rockhoundMetafields: metafields(first: 50, namespace: "custom") {
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
      const products = json.data && json.data.products && json.data.products.edges
        ? json.data.products.edges.map(e => e.node)
        : [];

      const pendingUpdates = [];

      products.forEach(product => {
        const getCustom = (key) => {
          if (!product.customMetafields || !product.customMetafields.edges) return null;
          const field = product.customMetafields.edges.find(e => e.node.key === key);
          return field ? field.value : null;
        };

        const getRockhound = (key) => {
          if (!product.rockhoundMetafields || !product.rockhoundMetafields.edges) return null;
          const field = product.rockhoundMetafields.edges.find(e => e.node.key === key);
          return field ? field.value : null;
        };

        const custDim = getCustom("dimensions_mm");
        const custTreat = getCustom("treatment_status");
        const custStory = getCustom("stone_story");
        const custChar = getCustom("character_marks");
        const custBench = getCustom("bench_notes");

        const rhDim = getRockhound("dimensions_mm");
        const rhTreat = getRockhound("treated");
        const rhStory = getRockhound("origin_story");
        const rhFlaws = getRockhound("honest_flaws_and_character");

        let addedToThisProduct = false;

        const pushUpdate = (key, value, type) => {
          pendingUpdates.push({
            update: { ownerId: product.id, namespace: "custom", key, value, type },
            title: product.title
          });
          addedToThisProduct = true;
        };

        // custom.dimensions_mm → rockhound.dimensions_mm
        if (custDim && !rhDim) {
          pushUpdate("dimensions_mm", custDim, "single_line_text_field");
        }

        // custom.treatment_status → rockhound.treated
        if (custTreat && !rhTreat) {
          pushUpdate("treated", custTreat, "single_line_text_field");
        }

        // custom.stone_story → rockhound.origin_story
        if (custStory && !rhStory) {
          pushUpdate("origin_story", custStory, "multi_line_text_field");
        }

        // custom.character_marks & custom.bench_notes → rockhound.honest_flaws_and_character
        if (!rhFlaws) {
          let combinedFlaws = null;
          
          if (custChar && custBench) {
            combinedFlaws = `${custChar}\n${custBench}`;
          } else if (custChar) {
            combinedFlaws = custChar;
          } else if (custBench) {
            combinedFlaws = custBench;
          }

          if (combinedFlaws) {
            pushUpdate("honest_flaws_and_character", combinedFlaws, "multi_line_text_field");
          }
        }

        if (addedToThisProduct) {
          productsProcessed++;
        }
      });

      const chunks = [];
      for (let i = 0; i < pendingUpdates.length; i += 25) {
        chunks.push(pendingUpdates.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        // Extract just the Shopify input objects for the mutation
        const metafields = chunk.map(c => c.update);

        const setResponse = await admin.graphql(`
          #graphql
          mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }
        `, { variables: { metafields } });

        const setJson = await setResponse.json();
        const errors = setJson.data && setJson.data.metafieldsSet && setJson.data.metafieldsSet.userErrors
          ? setJson.data.metafieldsSet.userErrors
          : [];

        if (errors.length > 0) {
          results.push({ status: "error", message: `Chunk failed: ${errors[0].message}` });
        } else {
          fieldsMigrated += chunk.length;
          // Log individual successful migrations to the results array
          chunk.forEach(c => {
            results.push({ status: "success", message: `Migrated '${c.update.key}' for product: ${c.title}` });
          });
        }
      }

      if (fieldsMigrated === 0 && results.length === 0) {
        results.push({ status: "success", message: `Scanned ${products.length} products. All fields are already migrated or blank.` });
      } else {
        // Unshift a grand summary to the top of the report
        results.unshift({ status: "success", message: `SUMMARY: Scanned ${products.length} products. Migrated ${fieldsMigrated} total fields across ${productsProcessed} items.` });
      }

    } catch (error) {
      results.push({ status: "error", message: `Migration completely failed: ${error.message}` });
    }

    return { intent: "migrate", results, productsProcessed, fieldsMigrated };
  }

  return { intent: "unknown", results: [{ status: "error", message: "Unknown intent" }] };
}

export default function MigrateDataRoute() {
  const navigate = useNavigate();
  const migrateFetcher = useFetcher();
  const standardizeFetcher = useFetcher();
  const copyFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const shopify = typeof window !== "undefined" ? window.shopify : undefined;

  const isMigrating = migrateFetcher.state !== "idle";
  const isStandardizing = standardizeFetcher.state !== "idle";
  const isCopying = copyFetcher.state !== "idle";
  const isDeleting = deleteFetcher.state !== "idle";

  const migrateData = migrateFetcher.data;
  const standardizeData = standardizeFetcher.data;
  const copyData = copyFetcher.data;
  const deleteData = deleteFetcher.data;

  const handleRunMigration = () => {
    migrateFetcher.submit({ intent: "migrate" }, { method: "post" });
  };

  const handleStandardize = () => {
    standardizeFetcher.submit({ intent: "standardizeOneOfAKind" }, { method: "post" });
  };

  useEffect(() => {
    if (migrateFetcher.state === "idle" && migrateData && migrateData.results) {
      if (shopify) {
        const hasErrors = migrateData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Migration finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Successfully migrated ${migrateData.fieldsMigrated} fields!`);
        }
      }
    }
  }, [migrateFetcher.state, migrateData, shopify]);

  useEffect(() => {
    if (standardizeFetcher.state === "idle" && standardizeData && standardizeData.results) {
      if (shopify) {
        const hasErrors = standardizeData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Standardize finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Done. ${standardizeData.fixed} products updated.`);
        }
      }
    }
  }, [standardizeFetcher.state, standardizeData, shopify]);

  useEffect(() => {
    if (copyFetcher.state === "idle" && copyData && copyData.results) {
      if (shopify) {
        const hasErrors = copyData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Copy finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(copyData.results[0].message);
        }
      }
    }
  }, [copyFetcher.state, copyData, shopify]);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteData && deleteData.results) {
      if (shopify) {
        const hasErrors = deleteData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Delete finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(deleteData.results[0].message);
        }
      }
    }
  }, [deleteFetcher.state, deleteData, shopify]);

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
                  (It is safe to run multiple times — it will just overwrite the new fields with the exact same legacy data).
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleRunMigration}
                      loading={isMigrating}
                      accessibilityLabel="Run Data Migration"
                    >
                      {isMigrating ? "Scanning and Migrating Data..." : "Run Auto-Migration"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {migrateData && migrateData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Migration Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {migrateData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
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

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Standardize One of a Kind Values</Text>
                <Text as="p">
                  Finds every product where is_one_of_a_kind is set to "true" and updates it to "Yes — one of a kind" for consistent SEO and storefront display.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleStandardize}
                      loading={isStandardizing}
                      accessibilityLabel="Standardize One of a Kind Values"
                    >
                      {isStandardizing ? "Standardizing..." : "Standardize One of a Kind Values"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {standardizeData && standardizeData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Standardize Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {standardizeData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
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

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Copy Rockhound → Custom</Text>
                <Text as="p">
                  Scans all products and copies 8 specific rockhound fields to the custom namespace if they are not already populated.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      fullWidth
                      onClick={() => copyFetcher.submit({ intent: "copyRockhoundToCustom" }, { method: "post" })}
                      accessibilityLabel="Copy Rockhound to Custom (8 fields)"
                      loading={isCopying}
                    >
                      {isCopying ? "Copying..." : "Copy Rockhound → Custom (8 fields)"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {copyData && copyData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Copy Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {copyData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
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

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Delete Rockhound Namespace</Text>
                <Text as="p">
                  Permanently deletes all metafields in the rockhound namespace. This cannot be undone.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <button
                      onClick={() => {
                        if (window.confirm("Are you sure? This permanently deletes all rockhound metafields. This cannot be undone.")) {
                          deleteFetcher.submit({ intent: "deleteRockhoundNamespace" }, { method: "post" });
                        }
                      }}
                      disabled={isDeleting}
                      style={{
                        backgroundColor: "#d72c0d",
                        color: "white",
                        minHeight: "56px",
                        width: "100%",
                        fontSize: "18px",
                        fontWeight: "bold",
                        border: "none",
                        borderRadius: "4px",
                        cursor: isDeleting ? "not-allowed" : "pointer",
                        opacity: isDeleting ? 0.7 : 1
                      }}
                      aria-label="Delete Rockhound Namespace"
                    >
                      {isDeleting ? "Deleting..." : "Delete Rockhound Namespace"}
                    </button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {deleteData && deleteData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Deletion Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {deleteData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
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
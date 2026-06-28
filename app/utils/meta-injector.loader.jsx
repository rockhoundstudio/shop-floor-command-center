import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ROCKHOUND_FIELDS } from "./meta-injector.constants.jsx";
import { data as json } from "react-router";

const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
 pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
          customMeta: metafields(first: 50, namespace: "custom") {
            edges { node { namespace key value type } }
          }
          rockhoundMeta: metafields(first: 50, namespace: "custom") {
            edges { node { namespace key value type } }
          }
          geoMeta: metafields(first: 50, namespace: "geo") {
            edges { node { namespace key value type } }
          }
        }
      }
    }
  }
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
  query GetMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "custom") {
      edges { node { id name key type { name } } }
    }
  }
`;

const GET_SNAPSHOTS_QUERY = `
  query GetSnapshots {
    metaobjects(type: "rockhound_snapshot", first: 10) {
      edges { node { id handle updatedAt fields { key value } } }
    }
  }
`;

const PRODUCT_CREATE_MUTATION = `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id }
      userErrors { field message }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

const COLLECTION_ADD_PRODUCTS_MUTATION = `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id }
      userErrors { field message }
    }
  }
`;

const COLLECTION_MAP = {
  "Spokane River": "gid://shopify/Collection/454794117371",
  "Yakima Canyon": "gid://shopify/Collection/452884922619",
  "Yellowstone River": "gid://shopify/Collection/454795886843",
  "Richardson's Rock Ranch": "gid://shopify/Collection/452912972027",
  "The 3,000-Mile Run": "gid://shopify/Collection/452913135867",
  "Nickel Back": "gid://shopify/Collection/454794871035",
  "Rufus Serpentine": "gid://shopify/Collection/454841237755",
  "The Shopped Rock": "gid://shopify/Collection/454840615163",
  "The Gallery": "gid://shopify/Collection/452886495483"
};

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
  return chunked;
};

async function fetchAllProducts(graphql) {
  const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor: null } });
  const { data } = await response.json();
  if (data && data.products) {
    return data.products.edges.map(edge => {
      const product = edge.node;
      const allEdges = [
        ...(product.customMeta?.edges || []),
        ...(product.rockhoundMeta?.edges || []),
        ...(product.geoMeta?.edges || []),
      ];
      product.metafields = { edges: allEdges };
      return product;
    });
  }
  return [];
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const products = await fetchAllProducts(admin.graphql);
  
  const [definitionsRes, snapshotsRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY)
  ]);
  
  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();
  
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(e => e.node) || [];
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(e => e.node) || [];
  
  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try { count = JSON.parse(dataField.value).length || 0; } catch (e) { count = "Unknown"; }
    }
    return { id: snap.id, createdAt: new Date(snap.updatedAt).toLocaleString(), count };
  });
  
  return json({ products, pageInfo: { hasNextPage: false, endCursor: null }, metafieldDefinitions, snapshots });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── SAVE PRODUCT ───────────────────────────────────────────────────────────
  if (intent === "saveProduct") {
    try {
      const payloadStr = formData.get("payload") || formData.get("metafields");
      let metafields = [];
      if (payloadStr) {
        metafields = JSON.parse(payloadStr);
      }
      
      metafields = metafields.map(mf => ({
        ...mf,
        namespace: "custom"
      }));

      const hasPieceName = metafields.some(mf => mf.key === "piece_name" && mf.value && String(mf.value).trim() !== "");
      if (!hasPieceName && metafields.length > 0) {
        const productId = metafields[0].ownerId;
        if (productId) {
          const productResponse = await admin.graphql(`
            #graphql
            query GetProductTitle($id: ID!) {
              product(id: $id) {
                title
              }
            }
          `, { variables: { id: productId } });
          const productJson = await productResponse.json();
          const productTitle = productJson.data?.product?.title;
          
          if (productTitle) {
            metafields.push({
              namespace: "custom",
              key: "piece_name",
              type: "single_line_text_field",
              value: productTitle,
              ownerId: productId
            });
          }
        }
      }

      const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
        variables: { metafields }
      });
      
      const result = await response.json();
      return { intent, success: true, result };
    } catch (error) {
      return { intent, success: false, error: error.message };
    }
  }

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

  // ── LEGACY MIGRATION ───────────────────────────────────────────────────────
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

export default function MigrateDataRoute() {
  const navigate = useNavigate();
  const migrateFetcher = useFetcher();
  const standardizeFetcher = useFetcher();
  const shopify = typeof window !== "undefined" ? window.shopify : undefined;

  const isMigrating = migrateFetcher.state !== "idle";
  const isStandardizing = standardizeFetcher.state !== "idle";
  const migrateData = migrateFetcher.data;
  const standardizeData = standardizeFetcher.data;

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

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
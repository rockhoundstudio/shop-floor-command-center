import React, { useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { Page, Layout, Card, Box, Tabs, Banner, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

import IntakeEngine from "../components/IntakeEngine";
import OperationsMatrix from "../components/OperationsMatrix";

// ==========================================
// 1. ENGINE BLOCK: GRAPHQL QUERIES
// ==========================================
const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title } }
    }
  }
`;

const GET_SINGLE_PRODUCT_QUERY = `
  query GetSingleProduct($id: ID!) {
    product(id: $id) {
      id title tags
      metafields(namespace: "rockhound", first: 50) {
        edges { node { id key value namespace type } }
      }
    }
  }
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
  query GetMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "rockhound") {
      edges { node { id name key type { name } } }
    }
  }
`;

const GET_SNAPSHOTS_QUERY = `
  query GetSnapshots {
    metaobjects(type: "rockhound_snapshot", first: 10, sortKey: "updated_at", reverse: true) {
      edges { node { id handle updatedAt fields { key value } } }
    }
  }
`;

// --- GRAPHQL MUTATIONS ---
const SET_METAFIELDS_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

const CREATE_METAFIELD_DEFINITION_MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name }
      userErrors { field message }
    }
  }
`;

const CREATE_METAOBJECT_MUTATION = `
  mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const DELETE_METAOBJECT_MUTATION = `
  mutation DeleteMetaobject($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors { field message }
    }
  }
`;

// --- UTILITY FUNCTIONS ---
const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
  return chunked;
};

const formatStrictGid = (id, type) => {
  const numericId = id.toString().replace(/\D/g, ""); 
  return `gid://shopify/${type}/${numericId}`;
};

const extractOriginFromTitle = (title) => {
  const parts = title.split(" — ");
  if (parts.length >= 3) return parts[1].trim();
  return null;
};

async function fetchAllProducts(graphql) {
  const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor: null } });
  const { data } = await response.json();
  if (data && data.products) return data.products.edges.map(edge => edge.node);
  return [];
}

// ==========================================
// 2. TRANSMISSION: BACKEND LOADER & ACTION
// ==========================================
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const products = await fetchAllProducts(admin.graphql);
  const [definitionsRes, snapshotsRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY)
  ]);

  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();

  const pageInfo = { hasNextPage: false, endCursor: null }; 
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(edge => edge.node) || [];
  
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(edge => edge.node) || [];
  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try { count = JSON.parse(dataField.value).length || 0; } 
      catch (e) { count = "Unknown"; }
    }
    return { id: snap.id, createdAt: new Date(snap.updatedAt).toLocaleString(), count };
  });

  return new Response(JSON.stringify({ products, pageInfo, metafieldDefinitions, snapshots }), {
    status: 200, headers: { "Content-Type": "application/json" }
  });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const errors = [];

  switch (intent) {
    case "generateSEO": {
      const formDataStr = formData.get("formData");
      if (!formDataStr) return new Response(JSON.stringify({ success: false, error: "No form data provided" }), { status: 400 });

      const stoneData = JSON.parse(formDataStr);
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) return new Response(JSON.stringify({ success: false, error: "GEMINI_API_KEY missing from server." }), { status: 500 });

      const dataPoints = Object.entries(stoneData)
        .filter(([key, value]) => value && key !== 'generated_seo')
        .map(([key, value]) => `- ${key.replace(/_/g, ' ').toUpperCase()}: ${value}`)
        .join("\n");

      const prompt = `You are Bob, a 27-year mechanic turned lapidary artist in Spokane Valley. You built your lapidary machines out of scrap car parts and sheer willpower. You write spare, honest, and mechanically detailed product descriptions. Do not use marketing fluff, exclamation points, or words like 'stunning,' 'gorgeous,' or 'must-have.' Focus on the raw materials, the physical trial-and-error of the cut, and the origin of the stone. Your philosophy is: 'The rock tells you what it needs.' 
      
      Based on the following intake data for a specific piece, write one punchy, story-driven SEO meta description. 
      
      STRICT RULES: 
      1. Must be strictly under 160 characters. 
      2. No markdown formatting, quotes, or hashtags.
      3. Never use generic sales words. Sound like a mechanic.
      
      STONE DATA:
      ${dataPoints}`;

      try {
        const aiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
          }
        );

        const aiData = await aiRes.json();
        let generatedDescription = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        generatedDescription = generatedDescription.replace(/^["']|["']$/g, '').trim();

        return new Response(JSON.stringify({ success: true, intent, seoDescription: generatedDescription }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });

      } catch (error) {
        console.error("Gemini AI Error:", error);
        return new Response(JSON.stringify({ success: false, error: "Failed to connect to AI Forge" }), { status: 500 });
      }
    }

    case "saveProduct": {
      const payloadStr = formData.get("payload");
      if (!payloadStr) return new Response(JSON.stringify({ success: false, error: "No payload provided" }), { status: 400 });

      const payload = JSON.parse(payloadStr);
      const metafieldsInputs = payload.map(field => {
        const strictOwnerId = formatStrictGid(field.ownerId, "Product");
        let finalValue = field.value.toString();
        const finalType = field.type || "single_line_text_field";
        
        if (finalType === "list.metaobject_reference" && !finalValue.startsWith("[")) {
          finalValue = `["${finalValue}"]`;
        }

        return { ownerId: strictOwnerId, namespace: "rockhound", key: field.key, value: finalValue, type: finalType };
      });

      const chunks = chunkArray(metafieldsInputs, 3);
      for (const chunk of chunks) {
        try {
          const response = await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields: chunk } });
          const result = await response.json();
          if (result.data?.metafieldsSet?.userErrors?.length > 0) errors.push(...result.data.metafieldsSet.userErrors);
        } catch (e) { errors.push({ field: ["network"], message: e.message }); }
      }

      if (errors.length > 0) return new Response(JSON.stringify({ success: false, intent, errors }), { status: 422, headers: { "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ success: true, intent, errors: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    case "autoFill": {
      const productId = formData.get("productId");
      if (!productId) return new Response(JSON.stringify({ success: false, error: "Missing productId" }), { status: 400 });

      const response = await admin.graphql(GET_SINGLE_PRODUCT_QUERY, { variables: { id: formatStrictGid(productId, "Product") } });
      const result = await response.json();
      const product = result.data?.product;

      if (!product) return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404 });

      const autoFillData = {};
      const titleParts = product.title.split(" — ");
      
      if (titleParts.length === 1) autoFillData.piece_name = titleParts[0];
      else if (titleParts.length === 2) { autoFillData.material = titleParts[0]; autoFillData.piece_name = titleParts[1]; }
      else if (titleParts.length >= 3) {
        autoFillData.material = titleParts[0];
        autoFillData.collection_location = titleParts[1];
        autoFillData.piece_name = titleParts[titleParts.length - 1];
      }

      if (product.tags && product.tags.length > 0) {
        const colorTag = product.tags.find(t => ["red", "blue", "green", "black", "white", "purple", "yellow", "orange", "brown", "pink", "clear"].some(c => t.toLowerCase().includes(c)));
        if (colorTag && !autoFillData.color) autoFillData.color = colorTag;

        const locationTag = product.tags.find(t => t.toLowerCase().includes("mine") || t.toLowerCase().includes("ridge") || t.toLowerCase().includes("county"));
        if (locationTag && !autoFillData.collection_location) autoFillData.collection_location = locationTag;
      }

      return new Response(JSON.stringify({ success: true, intent, autoFillData }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    case "autoExtractAll": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const updates = [];

      allProducts.forEach(product => {
        const origin = extractOriginFromTitle(product.title);
        if (!origin) return;

        let hasOrigin = false;
        if (product.metafields && product.metafields.edges) {
          hasOrigin = product.metafields.edges.some(edge => edge.node.namespace === "rockhound" && edge.node.key === "collection_location" && edge.node.value !== "");
        }

        if (!hasOrigin) {
          updates.push({ ownerId: formatStrictGid(product.id, "Product"), namespace: "rockhound", key: "collection_location", value: origin, type: "single_line_text_field" });
        }
      });

      if (updates.length > 0) {
        const chunks = chunkArray(updates, 3);
        for (const chunk of chunks) {
          const response = await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields: chunk } });
          const result = await response.json();
          if (result.data?.metafieldsSet?.userErrors?.length > 0) errors.push(...result.data.metafieldsSet.userErrors);
        }
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, updatedCount: updates.length, errors }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    case "standardizeOOAK": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const updates = [];

      allProducts.forEach(product => {
        let isStandardized = false;
        if (product.metafields && product.metafields.edges) {
          const ooakField = product.metafields.edges.find(edge => edge.node.namespace === "rockhound" && edge.node.key === "is_one_of_a_kind");
          if (ooakField && ooakField.node.value === "Yes — one of a kind") isStandardized = true;
        }

        if (!isStandardized) {
          updates.push({ ownerId: formatStrictGid(product.id, "Product"), namespace: "rockhound", key: "is_one_of_a_kind", value: "Yes — one of a kind", type: "single_line_text_field" });
        }
      });

      if (updates.length > 0) {
        const chunks = chunkArray(updates, 3);
        for (const chunk of chunks) {
          const response = await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields: chunk } });
          const result = await response.json();
          if (result.data?.metafieldsSet?.userErrors?.length > 0) errors.push(...result.data.metafieldsSet.userErrors);
        }
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, updatedCount: updates.length, errors }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    case "saveSnapshot": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const snapshotData = allProducts.map(p => {
        const fieldData = {};
        if (p.metafields && p.metafields.edges) p.metafields.edges.forEach(edge => { fieldData[edge.node.key] = edge.node.value; });
        return { id: p.id, title: p.title, fields: fieldData };
      });

      const existingSnapshotsRes = await admin.graphql(GET_SNAPSHOTS_QUERY);
      const existingData = await existingSnapshotsRes.json();
      const existingNodes = existingData.data?.metaobjects?.edges.map(e => e.node) || [];

      if (existingNodes.length >= 5) {
        const oldestId = existingNodes[existingNodes.length - 1].id;
        const delRes = await admin.graphql(DELETE_METAOBJECT_MUTATION, { variables: { id: oldestId } });
        const delResult = await delRes.json();
        if (delResult.data?.metaobjectDelete?.userErrors?.length > 0) errors.push(...delResult.data.metaobjectDelete.userErrors);
      }

      const timestamp = new Date().toISOString();
      const createRes = await admin.graphql(CREATE_METAOBJECT_MUTATION, {
        variables: {
          metaobject: {
            type: "rockhound_snapshot", handle: `snapshot-${Date.now()}`,
            fields: [ { key: "created_at", value: timestamp }, { key: "snapshot_data", value: JSON.stringify(snapshotData) } ]
          }
        }
      });
      const createResult = await createRes.json();
      if (createResult.data?.metaobjectCreate?.userErrors?.length > 0) errors.push(...createResult.data.metaobjectCreate.userErrors);

      return new Response(JSON.stringify({ success: errors.length === 0, intent, errors }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    case "exportCSV": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const keys = [
        "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", 
        "material", "stone_family", "color", "cut_and_shape", "surface_finish", 
        "dimensions_mm", "weight_grams", "collection_name", "collection_location", 
        "collection_date", "primary_use", "setting_ready", "bail_included", 
        "is_one_of_a_kind", "treated", "found_object", "wire_material", "artist_notes"
      ];

      let csv = "Product ID,Product Title," + keys.join(",") + "\n";

      allProducts.forEach(product => {
        const row = [`"${product.id}"`, `"${product.title.replace(/"/g, '""')}"`];
        const fieldMap = {};
        if (product.metafields && product.metafields.edges) {
          product.metafields.edges.forEach(edge => { fieldMap[edge.node.key] = edge.node.value; });
        }
        keys.forEach(key => { row.push(`"${(fieldMap[key] || "").toString().replace(/"/g, '""')}"`); });
        csv += row.join(",") + "\n";
      });

      return new Response(JSON.stringify({ success: true, intent, csv }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    default:
      return new Response(JSON.stringify({ success: false, error: "Unknown intent" }), { status: 400 });
  }
}

// ==========================================
// 3. CHASSIS: THE REACT UI
// ==========================================
export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const navigate = useNavigate();
  const primaryFetcher = useFetcher();
  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'intake', content: '1. Intake Bench (Janyce)', accessibilityLabel: 'Daily Intake Workflow' },
    { id: 'operations', content: '2. Sweeps & Matrix (Bob)', accessibilityLabel: 'Global Operations' }
  ];

  return (
    <Page fullWidth title="Shop Floor Command Center" subtitle="Master Intake & Operations" backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}>
      <Layout>
        <Layout.Section>
          {primaryFetcher.data?.errors && primaryFetcher.data.errors.length > 0 && (
            <Box paddingBlockEnd="400">
              <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                <BlockStack gap="200">
                  {primaryFetcher.data.errors.map((err, i) => (
                    <Text key={i} as="p">{err.message}</Text>
                  ))}
                </BlockStack>
              </Banner>
            </Box>
          )}

          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
              <Box padding="600" background="bg-surface-secondary">
                {selectedTab === 0 && (
                  <IntakeEngine products={products} fetcher={primaryFetcher} shopify={shopify} />
                )}
                {selectedTab === 1 && (
                  <OperationsMatrix products={products} fetcher={primaryFetcher} shopify={shopify} />
                )}
              </Box>
            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
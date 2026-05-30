import React, { useState } from "react";
import { useLoaderData, useActionData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { EXCLUDED_TITLES } from "./app.meta-injector.constants";
import { db } from "../db.server";

import { NorthStarTab } from "./app.meta-injector.northstar";
import { MatrixTab } from "./app.meta-injector.matrix";
import { InspectorTab } from "./app.meta-injector.inspector";
import { InjectorTab } from "./app.meta-injector.injector";
import { OriginsTab } from "./app.meta-injector.origins";
import { ProfilesTab } from "./app.meta-injector.profiles";
import { SnapshotsTab } from "./app.meta-injector.snapshots";
import { CsvTab } from "./app.meta-injector.csv";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(`
      #graphql
      query GetAllProducts($cursor: String) {
        products(first: 50, after: $cursor, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title status featuredImage { url altText }
              metafields(first: 50) {
                edges { node { id namespace key value type } }
              }
            }
          }
        }
      }
    `, { variables: { cursor } });

    const parsed = await response.json();
    const productsData = parsed.data?.products || null;

    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo.hasNextPage || false;
      cursor = productsData.pageInfo.endCursor || null;
    } else {
      hasNextPage = false;
    }
  }

  const products = allRawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  const snapResponse = await admin.graphql(`
    #graphql
    query GetSnapshots {
      metaobjects(type: "meta_injector_snapshot", first: 10, reverse: true) {
        edges {
          node {
            id
            timestamp: field(key: "timestamp") { value }
            scope: field(key: "scope") { value }
            action: field(key: "action") { value }
            payload: field(key: "payload") { value }
          }
        }
      }
    }
  `);

  const snapParsed = await snapResponse.json();
  const rawSnapshots = snapParsed.data?.metaobjects?.edges.map(e => e.node) || [];

  const snapshots = rawSnapshots.map(s => ({
    id: s.id,
    date: s.timestamp?.value || "Unknown Date",
    action: s.action?.value || "Snapshot",
    scopeCount: s.scope?.value || "0",
    payloadStr: s.payload?.value || "[]"
  }));

  const dbProfiles = await db.stoneProfile.findMany({ orderBy: { stoneName: "asc" } });
  
  return { products, snapshots, dbProfiles };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveMetafields") {
    const payload = JSON.parse(formData.get("payload"));
    const chunks = [];
    for (let i = 0; i < payload.length; i += 3) {
      chunks.push(payload.slice(i, i + 3));
    }

    let allErrors = [];
    for (const chunk of chunks) {
      const response = await admin.graphql(`
        #graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }
      `, { variables: { metafields: chunk } });
      const json = await response.json();
      const errors = json.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) allErrors = [...allErrors, ...errors];
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated in batches." };
  }

  if (intent === "fetchSingleProduct") {
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
      query GetSingleProduct($id: ID!) {
        product(id: $id) {
          id title status featuredImage { url altText }
          metafields(first: 50) {
            edges { node { id namespace key value type } }
          }
        }
      }
    `, { variables: { id: productId } });
    const json = await response.json();
    return { success: true, product: json.data?.product || null };
  }

  if (intent === "fetchOrigins") {
    let allRaw = [];
    let hasNext = true;
    let cursor = null;

    while (hasNext) {
      const response = await admin.graphql(`
        #graphql
        query GetOrigins($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title
                originMetafield: metafield(namespace: "custom", key: "origin_location") { value }
              }
            }
          }
        }
      `, { variables: { cursor } });
      const json = await response.json();
      const data = json.data?.products || null;
      if (data) {
        allRaw = [...allRaw, ...data.edges.map(e => e.node)];
        hasNext = data.pageInfo.hasNextPage || false;
        cursor = data.pageInfo.endCursor || null;
      } else {
        hasNext = false;
      }
    }
    const filtered = allRaw.filter(p => !EXCLUDED_TITLES.includes(p.title));
    return { success: true, origins: filtered };
  }

  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const response = await admin.graphql(`
      #graphql
      query ValidateGIDs($ids: [ID!]!) {
        nodes(ids: $ids) { id }
      }
    `, { variables: { ids: gids } });
    const json = await response.json();
    const nodes = json.data?.nodes || [];
    const isInvalid = nodes.some(n => n === null);
    return { success: true, isValid: !isInvalid };
  }

  if (intent === "saveSnapshot") {
    const actionName = formData.get("actionName");
    const payloadStr = formData.get("payloadStr");
    const scopeCount = formData.get("scopeCount");

    const createRes = await admin.graphql(`
      #graphql
      mutation CreateSnapshot($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "meta_injector_snapshot",
          capabilities: { publishable: { status: "ACTIVE" } },
          fields: [
            { key: "timestamp", value: new Date().toLocaleString() },
            { key: "action", value: actionName },
            { key: "scope", value: scopeCount },
            { key: "payload", value: payloadStr }
          ]
        }
      }
    });

    const createJson = await createRes.json();
    const errors = createJson.data?.metaobjectCreate?.userErrors || [];

    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
      return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    const existingIds = JSON.parse(formData.get("existingIds") || "[]");
    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      await admin.graphql(`
        #graphql
        mutation DeleteSnapshot($id: ID!) {
          metaobjectDelete(id: $id) { userErrors { message } }
        }
      `, { variables: { id: oldestId } });
    }

    return { success: true };
  }

  if (intent === "lookupMindat") {
    const stoneName = formData.get("stoneName");
    const dictionary = { "Jasper": "Quartz", "Agate": "Quartz", "Chalcedony": "Quartz", "Labradorite": "Labradorite", "Obsidian": "Obsidian", "Variscite": "Variscite", "Serpentine": "Serpentine", "Quartzite": "Quartz", "Andesite": "Andesite", "Feldspar": "Feldspar", "Aventurine": "Quartz", "Hornblende": "Hornblende", "Ironstone": "Goethite" };
    const baseMineralName = dictionary[stoneName] || stoneName;
    const cached = await db.stoneCache.findUnique({ where: { stoneName: baseMineralName } });
    const cacheAge = cached ? (Date.now() - new Date(cached.updatedAt).getTime()) / (1000 * 60 * 60 * 24) : 999;
    if (cached && cacheAge < 30) {
      return { success: true, mindatData: JSON.parse(cached.data), fromCache: true };
    }
    const res = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(baseMineralName)}&format=json`, { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } });
    const json = await res.json();
    const mineral = json.results?.[0] || {};
    const mapped = { hardness: mineral.hardness_max || mineral.hardness_min || "", crystalSystem: mineral.crystal_system || "", luster: mineral.luster || "", fracture: mineral.fracture || "", cleavage: mineral.cleavage || "", specificGravity: mineral.specific_gravity || "", diaphaneity: mineral.transparency || "", mineralClass: mineral.mineral_class || "" };
    await db.stoneCache.upsert({ where: { stoneName: baseMineralName }, update: { data: JSON.stringify(mapped), updatedAt: new Date() }, create: { stoneName: baseMineralName, data: JSON.stringify(mapped) } });
    return { success: true, mindatData: mapped, fromCache: false };
  }

  if (intent === "saveStoneProfile") {
    const stoneName = formData.get("stoneName");
    const fields = { baseMineralName: formData.get("baseMineralName") || "", colorPattern: formData.get("colorPattern") || "", authenticity: formData.get("authenticity") || "", rarity: formData.get("rarity") || "", crystalSystem: formData.get("crystalSystem") || "", geologicalEra: formData.get("geologicalEra") || "", mineralClass: formData.get("mineralClass") || "", rockComposition: formData.get("rockComposition") || "", rockFormation: formData.get("rockFormation") || "", hardness: formData.get("hardness") || "", luster: formData.get("luster") || "", fracture: formData.get("fracture") || "", cleavage: formData.get("cleavage") || "", specificGravity: formData.get("specificGravity") || "", diaphaneity: formData.get("diaphaneity") || "" };
    await db.stoneProfile.upsert({ where: { stoneName }, update: { ...fields, updatedAt: new Date() }, create: { stoneName, ...fields } });
    return { success: true, message: "Stone profile saved." };
  }

  if (intent === "deleteStoneProfile") {
    const id = formData.get("id");
    await db.stoneProfile.delete({ where: { id } });
    return { success: true, message: "Profile deleted." };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}

export default function MetaInjectorV2() {
  const { products, snapshots = [], dbProfiles = [], metaobjectHandles = {} } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'northstar', content: '⭐ North Star Auto-Fill', panelID: 'panel-northstar' },
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'bulk', content: 'Smart Bulk Injector', panelID: 'panel-bulk' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'DB Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
  ];

  return (
    <Frame>
      <Page
        fullWidth 
        title="Meta Injector v2" 
        subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {actionFetcher.data?.errors?.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionFetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="400">
                  {selectedTab === 0 && (
                    <NorthStarTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      dbProfiles={dbProfiles} 
                    />
                  )}
                  {selectedTab === 1 && (
                    <MatrixTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      metaobjectHandles={metaobjectHandles} 
                      onInspectProduct={() => setSelectedTab(2)} 
                    />
                  )}
                  {selectedTab === 2 && (
                    <InspectorTab 
                      fetcher={inspectorFetcher} 
                      products={products} 
                    />
                  )}
                  {selectedTab === 3 && (
                    <InjectorTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      shopify={typeof window !== 'undefined' ? window.shopify : undefined} 
                    />
                  )}
                  {selectedTab === 4 && (
                    <OriginsTab 
                      fetcher={originFetcher} 
                    />
                  )}
                  {selectedTab === 5 && (
                    <ProfilesTab 
                      fetcher={profileFetcher} 
                      products={products} 
                      dbProfiles={dbProfiles} 
                    />
                  )}
                  {selectedTab === 6 && (
                    <SnapshotsTab 
                      fetcher={snapshotFetcher} 
                      snapshots={snapshots} 
                    />
                  )}
                  {selectedTab === 7 && (
                    <CsvTab 
                      fetcher={actionFetcher} 
                      products={products} 
                    />
                  )}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
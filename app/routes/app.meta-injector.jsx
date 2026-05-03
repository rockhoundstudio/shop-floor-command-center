import { useState, useRef } from "react";
import { useLoaderData, data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import fs from "fs";
import path from "path";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

import ProductsTab from "../components/meta/ProductsTab";
import MetaCore from "../components/meta/MetaCore";
import CollectionsTab from "../components/meta/CollectionsTab";
import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription, autoLinkStory } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";

// ─── TAXONOMY FORMATTER ─────────────────────────────────────────────────────
function formatMetafieldValue(originalKey, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim();
  
  // The taxonomyMap.js uses underscores (e.g., mineral_class)
  const mapKey = originalKey.replace(/-/g, "_");

  if (TAXONOMY_GIDS[mapKey] && TAXONOMY_GIDS[mapKey][cleanValue]) {
    return {
      value: wrapGid(TAXONOMY_GIDS[mapKey][cleanValue]),
      type: "list.metaobject_reference",
      namespace: "shopify",
      key: originalKey.replace(/_/g, "-") // Shopify requires dashes (e.g., mineral-class)
    };
  }

  // Fallback for custom fields
  return {
    value: String(value).trim(),
    type: "single_line_text_field",
    namespace: "custom",
    key: mapKey
  };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const [productsRes, collectionsRes] = await Promise.all([
      admin.graphql(`
        query {
          products(first: 100) {
            edges {
              node {
                id title descriptionHtml
                featuredImage { url altText }
                customMeta: metafields(first: 100, namespace: "custom") {
                  edges { node { key value } }
                }
                shopifyMeta: metafields(first: 100, namespace: "shopify") {
                  edges { node { key value } }
                }
                collections(first: 10) {
                  edges { node { id title } }
                }
              }
            }
          }
        }
      `),
      admin.graphql(`
        query {
          collections(first: 50) {
            edges { node { id title handle } }
          }
        }
      `)
    ]);

    const pData = await productsRes.json();
    const cData = await collectionsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const customMfs = Object.fromEntries(
        (node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const shopifyMfs = Object.fromEntries(
        (node.shopifyMeta?.edges || []).map(({ node: mf }) => [
          mf.key.replace(/-/g, "_"), mf.value
        ])
      );
      const rawMfs = { ...shopifyMfs, ...customMfs };
      
      const mfs = Object.fromEntries(
        Object.entries(rawMfs).map(([k, v]) => {
          let finalVal = String(v);
          
          // 1. Unpack the JSON array first
          if (finalVal.startsWith("[") && finalVal.endsWith("]")) {
            try {
              const parsed = JSON.parse(finalVal);
              finalVal = Array.isArray(parsed) && parsed.length > 0 ? String(parsed[0]) : "";
            } catch {}
          }

          // 2. Translate the clean ID back to English
          const mapKey = k.replace(/-/g, "_");
          if (TAXONOMY_GIDS[mapKey]) {
            for (const [word, mappedGid] of Object.entries(TAXONOMY_GIDS[mapKey])) {
              if (finalVal.includes(String(mappedGid))) {
                finalVal = word;
                break;
              }
            }
          }

          return [k, finalVal];
        })
      );
      
      const { status, filledCount } = evaluateProductStatus(mfs);
      return {
        ...node,
        description: stripHtml(node.descriptionHtml),
        metafields: mfs,
        status,
        filledCount,
        currentCollections: (node.collections?.edges || []).map(({ node: c }) => ({ id: c.id, title: c.title })),
      };
    });

    const collections = (cData.data?.collections?.edges || [])
      .map(({ node }) => node)
      .filter((c) => c.handle !== "all-collections");

    return data({ products, collections, loaderError: null });
  } catch (error) {
    return data({ products: [], collections: [], loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ─── QA & INJECT VIEW HANDLERS ──────────────────────────────────────────────
  if (intent === "build_payload") {
    const productId = formData.get("productId");
    const existingMeta = JSON.parse(formData.get("existingMeta") || "{}");

    const payloadObj = Object.keys(existingMeta)
      .filter(k => existingMeta[k] && String(existingMeta[k]).trim() !== "")
      .map(k => {
        const mapKey = k.replace(/-/g, "_");
        return {
          ownerId: productId,
          namespace: TAXONOMY_GIDS[mapKey] ? "shopify" : "custom",
          key: TAXONOMY_GIDS[mapKey] ? k.replace(/_/g, "-") : mapKey,
          value: String(existingMeta[k]).replace(/[✅⚠️]/g, "").trim()
        };
      });

    return data({ ok: true, payload: JSON.stringify(payloadObj, null, 2) });
  }

  if (intent === "inject") {
    try {
      const payloadStr = formData.get("payload");
      const rawMetafields = JSON.parse(payloadStr);

      if (!Array.isArray(rawMetafields) || rawMetafields.length === 0) {
         return data({ ok: false, error: "Invalid or empty payload" });
      }

      const metafields = rawMetafields.map(mf => {
        const formatted = formatMetafieldValue(mf.key, mf.value);
        if (!formatted) return null;
        
        return {
          ownerId: mf.ownerId,
          namespace: formatted.namespace,
          key: formatted.key,
          value: formatted.value,
          type: formatted.type
        };
      }).filter(Boolean);

      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errors = json.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) return data({ ok: false, error: errors[0].message });
      }
      return data({ ok: true, injected: metafields.length });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  // ─── SAVE METAFIELDS (MANUAL EDITS) ─────────────────────────────────────────
  if (intent === "saveMetafields") {
    const rawMetafields = JSON.parse(formData.get("metafields"));

    const processedMetafields = rawMetafields
      .filter(mf => mf.value != null && String(mf.value).trim() !== "")
      .map(mf => {
        let finalValue = mf.value;
        if (mf.key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);

        const formatted = formatMetafieldValue(mf.key, finalValue);
        if (!formatted) return null;
        return {
          ownerId:   mf.ownerId,
          namespace: formatted.namespace,
          key:       formatted.key,
          value:     formatted.value,
          type:      formatted.type,
        };
      }).filter(Boolean);

    if (processedMetafields.length === 0) {
      return data({ ok: false, error: "Empty Payload: No valid fields to save." });
    }

    const chunks = [];
    for (let i = 0; i < processedMetafields.length; i += 25) chunks.push(processedMetafields.slice(i, i + 25));
    for (const chunk of chunks) {
      try {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errors = json.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) return data({ ok: false, error: errors[0].message });
      } catch (e) {
        return data({ ok: false, error: e.message });
      }
    }
    return data({ ok: true, success: true, message: "Metafields locked to Shopify." });
  }

  // ─── BULK EDIT ───────────────────────────────────────────────────────────────
  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const ooakText = formData.get("ooakText") || "";
    const currentStories = JSON.parse(formData.get("currentStories") || "{}");

    const metafields = [];

    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (updates[key] && updates[key].trim() !== "") {
          let finalValue = updates[key];
          if (key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);

          const formatted = formatMetafieldValue(key, finalValue);
          if (!formatted) return;
          
          metafields.push({
            ownerId,
            namespace: formatted.namespace,
            key: formatted.key,
            value: formatted.value,
            type: formatted.type
          });
        }
      });

      if (ooakText && ooakText.trim() !== "") {
        const baseStory = currentStories[ownerId] || "";
        const combinedStory = baseStory
          ? `${baseStory} | ✨ Unique Features: ${ooakText}`
          : `✨ Unique Features: ${ooakText}`;
        const linkedStory = autoLinkStory(combinedStory);
        metafields.push({ ownerId, namespace: "custom", key: "stone_story", value: linkedStory, type: "single_line_text_field" });
      }
    });

    if (metafields.length === 0) {
      return data({ ok: false, error: "Empty Payload: No text or valid dropdowns to save." });
    }

    const chunks = [];
    for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
    for (const chunk of chunks) {
      try {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        
        const errors = json.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) return data({ ok: false, error: errors[0].message });
      } catch (e) {
          return data({ ok: false, error: e.message });
      }
    }
    return data({ ok: true });
  }

  if (intent === "mindat_lookup") {
    const query = formData.get("query");
    
    if (!query || !query.trim()) return data({ ok: true, found: false });
    try {
      const res = await fetch(
        `https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(query.trim())}&format=json`,
        { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.results?.[0]) return data({ ok: true, found: true, result: json.results[0] });
      }
    } catch (e) {}
    return data({ ok: true, found: false });
  }

  return data({ ok: false });
};

export default function MetaInjector() {
  const { products, collections, loaderError } = useLoaderData();
  const [tabIndex, setTabIndex] = useState(0);
  const [menuActive, setMenuActive] = useState(false);

  const tabs = [
    { id: "products",    content: "🪨 Products" },
    { id: "bulk",        content: "📦 Bulk Edit" },
    { id: "inject",      content: "💉 QA & Inject" },
    { id: "mindat",      content: "🌍 Mindat" },
    { id: "collections", content: "🗂️ Collections" }
  ];

  return (
    <Page title="Shop Floor Command Center" fullWidth>
      <Layout>
        <Layout.Section>
          {loaderError && <Banner tone="critical">Loader error: {loaderError}</Banner>}
          <Card padding="0">
            <Box padding="400">
              <Popover
                active={menuActive}
                activator={<Button onClick={() => setMenuActive(!menuActive)} icon={MenuIcon} size="large">{tabs[tabIndex].content}</Button>}
                onClose={() => setMenuActive(false)}
              >
                <ActionList
                  actionRole="menuitem"
                  items={tabs.map((tab, index) => ({
                    content: tab.content,
                    onAction: () => { setTabIndex(index); setMenuActive(false); },
                  }))}
                />
              </Popover>
            </Box>
            <Divider />
            <Box padding="400">
              {tabIndex === 0 && <ProductsTab products={products} />}
              {tabIndex === 1 && <MetaCore products={products} mode="bulk" />}
              {tabIndex === 2 && <MetaCore products={products} mode="inject" />}
              {tabIndex === 3 && <MetaCore products={products} mode="mindat" />}
              {tabIndex === 4 && <CollectionsTab products={products} collections={collections} onBack={() => setTabIndex(0)} />}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
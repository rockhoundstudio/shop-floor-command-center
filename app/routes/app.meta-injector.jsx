import { useState, useRef } from "react";
import { useLoaderData, data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

import ProductsTab from "../components/meta/ProductsTab";
import MetaCore from "../components/meta/MetaCore";
import CollectionsTab from "../components/meta/CollectionsTab";

// 🐛 Added autoLinkStory to the imports!
import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription, autoLinkStory } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";

// ─── TAXONOMY FORMATTER ─────────────────────────────────────────────────────
function formatMetafieldValue(key, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim(); 
  const safeKey = key.replace(/-/g, "_"); 
  
  if (TAXONOMY_GIDS[safeKey] && TAXONOMY_GIDS[safeKey][cleanValue]) {
    return {
      value: wrapGid(TAXONOMY_GIDS[safeKey][cleanValue]),
      type: "list.metaobject_reference" 
    };
  }

  return {
    value: String(value).trim(),
    type: "single_line_text_field"
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
      const mfs = { ...shopifyMfs, ...customMfs };
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
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ─── SINGLE PRODUCT AUTO-FILL ───────────────────────────────────────────────
  if (intent === "autoFill") {
    // [Logic remains identical for autoFill data generation...]
    const title       = formData.get("title");
    const description = formData.get("description");
    const existingRaw = formData.get("existingMeta");
    const existing    = existingRaw ? JSON.parse(existingRaw) : {};

    const parsed  = parseDescription(description);
    const library = lookupStone(title) || {};

    let stoneName = existing.official_name ? String(existing.official_name).trim() : null;
    if (!stoneName && library.official_name) {
      stoneName = library.official_name;
    }

    let mindat = {};
    let mindatError = null;

    if (!stoneName) {
      mindatError = "Could not identify stone from title. Please set Official Name.";
    } else {
      try {
        const normalizedName = stoneName.toLowerCase().trim();
        const cachedStone = await prisma.stoneCache.findUnique({
          where: { stoneName: normalizedName }
        });

        if (cachedStone) {
          mindat = JSON.parse(cachedStone.data);
        } else {
          if (!process.env.MINDAT_API_KEY) throw new Error("MINDAT_API_KEY not set");
          const res = await fetch(
            `https://api.mindat.org/geomaterials/?name=${encodeURIComponent(stoneName)}&format=json`,
            { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
          );
          if (!res.ok) throw new Error(`Mindat HTTP ${res.status}`);
          const json = await res.json();
          if (json.results?.[0]) {
            const m = json.results[0];
            const hardnessStr = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
            const gravityStr = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";

            mindat = {
              moh_hardness:      hardnessStr,
              crystal_system:    m.crystal_system   || "", // Fixed key
              specific_gravity:  gravityStr,
              luster:            m.lustre           || "",
              cleavage:          m.cleavage         || "",
              fracture_pattern:  m.fracture         || "",
              diaphaneity:       m.diaphaneity      || "",
            };
            Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });

            if (Object.keys(mindat).length > 0) {
              await prisma.stoneCache.create({
                data: { stoneName: normalizedName, data: JSON.stringify(mindat) }
              });
            }
          }
        }
      } catch (e) {
        mindatError = e.message;
      }
    }

    const merged = {};
    const conflicts = [];
    
    if (stoneName && !existing["official_name"]) {
      merged["official_name"] = stoneName;
    }

    TARGET_KEYS.forEach(key => {
      if (existing[key] && String(existing[key]).trim() !== "") {
        merged[key] = existing[key];
        return;
      }
      const libVal    = library[key]  || "";
      const parsedVal = parsed[key]   || "";
      const mindatVal = mindat[key]   || "";
      if (mindatVal) {
        if (libVal && libVal !== mindatVal) conflicts.push({ key, library: libVal, mindat: mindatVal });
        merged[key] = `✅ ${mindatVal}`;
      } else if (libVal) {
        merged[key] = libVal;
      } else if (parsedVal) {
        merged[key] = `⚠️ ${parsedVal}`;
      }
    });

    return data({ ok: true, merged, conflicts, mindatError });
  }

  // ─── BULK AUTO-FILL ALL PRODUCTS ────────────────────────────────────────────
  if (intent === "bulkAutoFill") {
    // [Logic remains identical to previous version, ensuring crystal_system is passed]
    const productsRaw = formData.get("products");
    const products = JSON.parse(productsRaw);
    const results = [];

    for (const p of products) {
      const library  = lookupStone(p.title) || {};
      const parsed   = parseDescription(p.description || "");
      const existing = p.metafields || {};

      let stoneName = existing.official_name ? String(existing.official_name).trim() : null;
      if (!stoneName && library.official_name) {
        stoneName = library.official_name;
      }

      if (!stoneName) {
        results.push({ id: p.id, title: p.title, ok: false, error: "Could not identify stone." });
        continue;
      }

      let mindat = {};
      let mindatError = null;
      try {
        const normalizedName = stoneName.toLowerCase().trim();
        const cachedStone = await prisma.stoneCache.findUnique({
          where: { stoneName: normalizedName }
        });

        if (cachedStone) {
           mindat = JSON.parse(cachedStone.data);
        } else {
          if (!process.env.MINDAT_API_KEY) throw new Error("MINDAT_API_KEY not set");
          const res = await fetch(
            `https://api.mindat.org/geomaterials/?name=${encodeURIComponent(stoneName)}&format=json`,
            { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
          );
          if (res.ok) {
            const json = await res.json();
            if (json.results?.[0]) {
              const m = json.results[0];
              const hardnessStr = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
              const gravityStr = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";

              mindat = {
                moh_hardness:      hardnessStr,
                crystal_system:    m.crystal_system   || "",
                specific_gravity:  gravityStr,
                luster:            m.lustre           || "",
                cleavage:          m.cleavage         || "",
                fracture_pattern:  m.fracture         || "",
                diaphaneity:       m.diaphaneity      || "",
              };
              Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });

              if (Object.keys(mindat).length > 0) {
                await prisma.stoneCache.create({
                  data: { stoneName: normalizedName, data: JSON.stringify(mindat) }
                });
              }
            }
          }
        }
      } catch (e) {
        mindatError = e.message;
      }

      const merged = {};
      if (stoneName && !existing["official_name"]) merged["official_name"] = stoneName;

      TARGET_KEYS.forEach(key => {
        if (existing[key] && String(existing[key]).trim() !== "") {
          merged[key] = existing[key];
          return;
        }
        const libVal    = library[key] || "";
        const parsedVal = parsed[key]  || "";
        const mindatVal = mindat[key]  || "";
        if (mindatVal)      merged[key] = `✅ ${mindatVal}`;
        else if (libVal)    merged[key] = libVal;
        else if (parsedVal) merged[key] = `⚠️ ${parsedVal}`;
      });

      const metafields = TARGET_KEYS
        .filter(key => merged[key] && String(merged[key]).trim() !== "")
        .map(key => {
          let finalValue = merged[key];
          // 🚀 MAGIC: Auto-link the story before it goes to Shopify!
          if (key === "stone_story") {
            finalValue = autoLinkStory(finalValue);
          }
          const formatted = formatMetafieldValue(key, finalValue);
          return {
            ownerId:   p.id,
            namespace: TAXONOMY_GIDS[key.replace(/-/g, "_")] ? "shopify" : "custom",
            key:       TAXONOMY_GIDS[key.replace(/-/g, "_")] ? key.replace(/_/g, "-") : key,
            value:     formatted.value,
            type:      formatted.type,
          };
        });

      if (metafields.length === 0) {
        results.push({ id: p.id, title: p.title, ok: false, error: "no data found" });
        continue;
      }

      let saveError = null;
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errors = (json.data?.metafieldsSet?.userErrors || [])
          .filter(e => !e.message.includes("must be consistent with the definition"));
        if (errors.length > 0) { saveError = errors[0].message; break; }
      }

      results.push({ id: p.id, title: p.title, ok: !saveError, error: saveError || mindatError || null });
      await new Promise(r => setTimeout(r, 200)); 
    }

    const failed = results.filter(r => !r.ok);
    return data({ ok: true, total: results.length, failed });
  }

  // ─── SAVE METAFIELDS (MANUAL EDITS) ─────────────────────────────────────────
  if (intent === "saveMetafields") {
    const rawMetafields = JSON.parse(formData.get("metafields"));
    
    const processedMetafields = rawMetafields
      .filter(mf => mf.value && String(mf.value).trim() !== "")
      .map(mf => {
        const safeKey = mf.key.replace(/-/g, "_");
        let finalValue = mf.value;
        
        // 🚀 MAGIC: Auto-link manual edits too!
        if (safeKey === "stone_story") {
          finalValue = autoLinkStory(finalValue);
        }

        const formatted = formatMetafieldValue(safeKey, finalValue);
        return {
          ownerId:   mf.ownerId,
          namespace: TAXONOMY_GIDS[safeKey] ? "shopify" : "custom",
          key:       TAXONOMY_GIDS[safeKey] ? mf.key.replace(/_/g, "-") : mf.key,
          value:     formatted.value,
          type:      formatted.type,
        };
      });

    const chunks = [];
    for (let i = 0; i < processedMetafields.length; i += 25) chunks.push(processedMetafields.slice(i, i + 25));
    for (const chunk of chunks) {
      const res = await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { message } }
        }
      `, { variables: { metafields: chunk } });
      const json = await res.json();
      const errors = (json.data?.metafieldsSet?.userErrors || [])
        .filter(e => !e.message.includes("must be consistent with the definition"));
      if (errors.length > 0) return data({ success: false, error: errors[0].message });
    }
    return data({ success: true });
  }

  // ─── THE NEW SMART BULK EDIT (WITH OOAK APPEND) ───────────────────────────
  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const ooakText = formData.get("ooakText") || "";
    const currentStories = JSON.parse(formData.get("currentStories") || "{}");
    
    const metafields = [];
    
    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (updates[key] && updates[key].trim() !== "") {
          const safeKey = key.replace(/-/g, "_");
          let finalValue = updates[key];
          
          // 🚀 MAGIC: Auto-link Bulk Edits!
          if (safeKey === "stone_story") {
            finalValue = autoLinkStory(finalValue);
          }

          const formatted = formatMetafieldValue(safeKey, finalValue);
          metafields.push({ 
            ownerId, 
            namespace: TAXONOMY_GIDS[safeKey] ? "shopify" : "custom", 
            key: TAXONOMY_GIDS[safeKey] ? key.replace(/_/g, "-") : key, 
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
        
        // 🚀 MAGIC: Auto-link OOAK appended stories!
        const linkedStory = autoLinkStory(combinedStory);

        metafields.push({ ownerId, namespace: "custom", key: "stone_story", value: linkedStory, type: "single_line_text_field" });
      }
    });

    if (metafields.length > 0) {
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
      }
    }
    return data({ ok: true });
  }

  if (intent === "mindat_lookup") {
    const query = formData.get("query");
    if (!query || !query.trim()) return data({ ok: true, found: false });
    try {
      const res = await fetch(
        `https://api.mindat.org/geomaterials/?name=${encodeURIComponent(query.trim())}&format=json`,
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
              {tabIndex === 2 && <MetaCore products={products} mode="mindat" />}
              {tabIndex === 3 && <CollectionsTab products={products} collections={collections} onBack={() => setTabIndex(0)} />}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
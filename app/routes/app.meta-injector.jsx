import { useState, useRef } from "react";
import { useLoaderData, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

import ProductsTab from "../components/meta/ProductsTab";
import MetaCore from "../components/meta/MetaCore";
import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription, autoLinkStory } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";

const LIST_TEXT_FIELDS = ["character_marks", "stone_story"];
const BOOLEAN_FIELDS = ["is_ooak", "custom_product"];

const KEYS_TO_PROCESS = TARGET_KEYS.filter(k =>
  !["geological_age", "geological_era", "rock_composition", "rock_formation", "mineral_class"].includes(k)
);

function unwrapListValue(value) {
  let val = String(value).trim();
  while (val.startsWith("[") && val.endsWith("]")) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        val = String(parsed[0]).trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return val;
}

function formatMetafieldValue(originalKey, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim();
  const mapKey = originalKey.replace(/-/g, "_");

  if (TAXONOMY_GIDS[mapKey] && TAXONOMY_GIDS[mapKey][cleanValue]) {
    return {
      value: wrapGid(TAXONOMY_GIDS[mapKey][cleanValue]),
      type: "list.metaobject_reference",
      namespace: "shopify",
      key: originalKey.replace(/_/g, "-")
    };
  }

  const isListField = LIST_TEXT_FIELDS.includes(mapKey);
  const isBooleanField = BOOLEAN_FIELDS.includes(mapKey);

  let finalValue = String(value).trim();
  let finalType = "single_line_text_field";

  if (isListField) {
    finalValue = JSON.stringify([finalValue]);
    finalType = "list.single_line_text_field";
  } else if (isBooleanField) {
    const truthy = ["true", "yes", "1", "✅ true"];
    finalValue = truthy.some(t => finalValue.toLowerCase().includes(t)) ? "true" : "false";
    finalType = "boolean";
  }

  return {
    value: finalValue,
    type: finalType,
    namespace: "custom",
    key: mapKey
  };
}

function extractShopifyError(errors, chunk) {
  if (!errors || errors.length === 0) return null;
  let failingKey = "UNKNOWN";
  try {
    if (errors[0].field && typeof errors[0].field[1] === "number") {
      failingKey = chunk[errors[0].field[1]]?.key || "UNKNOWN";
    }
  } catch (e) {}
  return `[FIELD: ${failingKey}] ${errors[0].message} | RAW: ${JSON.stringify(errors)} | CHUNK: [${chunk.map(c => c.key).join(", ")}]`;
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const productsRes = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id title descriptionHtml status
              variants(first: 1) { edges { node { id price } } }
              featuredImage { url altText }
              customMeta: metafields(first: 100, namespace: "custom") {
                edges { node { key value } }
              }
              shopifyMeta: metafields(first: 100, namespace: "shopify") {
                edges { node { key value } }
              }
            }
          }
        }
      }
    `);

    const pData = await productsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const customMfs = Object.fromEntries(
        (node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const shopifyMfs = Object.fromEntries(
        (node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const rawMfs = { ...shopifyMfs, ...customMfs };

      const mfs = Object.fromEntries(
        Object.entries(rawMfs).map(([k, v]) => {
          let finalVal = unwrapListValue(String(v));
          const dictKey = k.replace(/_/g, "-");
          if (TAXONOMY_GIDS[dictKey]) {
            for (const [word, mappedGid] of Object.entries(TAXONOMY_GIDS[dictKey])) {
              if (finalVal.includes(String(mappedGid))) {
                finalVal = word;
                break;
              }
            }
          }
          return [k.replace(/-/g, "_"), finalVal];
        })
      );

      const { status, filledCount } = evaluateProductStatus(mfs);
      const price = node.variants?.edges?.[0]?.node?.price || "0.00";
      const shopifyStatus = node.status;

      return {
        ...node,
        price,
        shopifyStatus,
        description: stripHtml(node.descriptionHtml),
        metafields: mfs,
        status,
        filledCount,
      };
    });

    return data({ products, loaderError: null });
  } catch (error) {
    return data({ products: [], loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "loadVocabulary") {
    try {
      const res = await admin.graphql(`
        query {
          metaobjects(type: "field_vocabulary", first: 50) {
            edges {
              node {
                id
                field_key: field(key: "field_key") { value }
                values: field(key: "values") { value }
              }
            }
          }
        }
      `);
      const json = await res.json();
      const map = {};
      const edges = json.data?.metaobjects?.edges || [];
      for (const edge of edges) {
        const fk = edge.node.field_key?.value;
        const vals = edge.node.values?.value;
        if (fk && vals) {
          map[fk] = vals.split(",").map(v => v.trim()).filter(Boolean);
        }
      }
      return data({ ok: true, vocabulary: map });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "saveVocabularyEntry") {
    const fieldKey = formData.get("field_key");
    const newValue = formData.get("new_value");
    if (!fieldKey || !newValue) return data({ ok: false, error: "Missing fields" });
    try {
      const res = await admin.graphql(`
        query {
          metaobjects(type: "field_vocabulary", first: 50) {
            edges {
              node {
                id
                field_key: field(key: "field_key") { value }
                values: field(key: "values") { value }
              }
            }
          }
        }
      `);
      const json = await res.json();
      const edges = json.data?.metaobjects?.edges || [];
      const existing = edges.find(e => e.node.field_key?.value === fieldKey);
      if (existing) {
        const currentVals = existing.node.values?.value ? existing.node.values.value.split(",").map(v => v.trim()) : [];
        if (!currentVals.includes(newValue.trim())) currentVals.push(newValue.trim());
        await admin.graphql(`
          mutation metaobjectUpdate($id: ID!, $metaobject: MetaobjectUpdateInput!) {
            metaobjectUpdate(id: $id, metaobject: $metaobject) {
              userErrors { message }
            }
          }
        `, { variables: { id: existing.node.id, metaobject: { fields: [{ key: "values", value: currentVals.join(",") }] } } });
      } else {
        await admin.graphql(`
          mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
            metaobjectCreate(metaobject: $metaobject) {
              userErrors { message }
            }
          }
        `, { variables: { metaobject: { type: "field_vocabulary", fields: [{ key: "field_key", value: fieldKey }, { key: "values", value: newValue.trim() }] } } });
      }
      return data({ ok: true });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "saveProductBase") {
    const productId = formData.get("productId");
    const title     = formData.get("title");
    const status    = formData.get("status");
    const price     = formData.get("price");
    try {
      await admin.graphql(`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors { field message }
          }
        }
      `, { variables: { input: { id: productId, title, status } } });

      const variantRes = await admin.graphql(`
        query getVariant($id: ID!) {
          product(id: $id) {
            variants(first: 1) { edges { node { id } } }
          }
        }
      `, { variables: { id: productId } });
      const variantJson = await variantRes.json();
      const variantId = variantJson.data?.product?.variants?.edges?.[0]?.node?.id;

      if (variantId && price) {
        await admin.graphql(`
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }
        `, { variables: {
          productId,
          variants: [{ id: variantId, price: String(parseFloat(price).toFixed(2)) }]
        }});
      }
      return data({ ok: true, success: true });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "build_payload") {
    const productId = formData.get("productId");
    const existingMeta = JSON.parse(formData.get("existingMeta") || "{}");
    const payloadObj = Object.keys(existingMeta)
      .filter(k => existingMeta[k] && String(existingMeta[k]).trim() !== "")
      .map(k => {
        const dictKey = k.replace(/_/g, "-");
        const uiKey = k.replace(/-/g, "_");
        return {
          ownerId: productId,
          namespace: TAXONOMY_GIDS[dictKey] ? "shopify" : "custom",
          key: TAXONOMY_GIDS[dictKey] ? dictKey : uiKey,
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
        return { ownerId: mf.ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type };
      }).filter(Boolean);
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) return data({ ok: false, error: errorMsg });
      }
      return data({ ok: true, injected: metafields.length });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "saveMetafields") {
    const rawMetafields = JSON.parse(formData.get("metafields"));
    const processedMetafields = rawMetafields
      .filter(mf => mf.value != null && String(mf.value).trim() !== "")
      .map(mf => {
        let finalValue = mf.value;
        if (mf.key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);
        const formatted = formatMetafieldValue(mf.key, finalValue);
        if (!formatted) return null;
        return { ownerId: mf.ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type };
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
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) return data({ ok: false, error: errorMsg });
      } catch (e) {
        return data({ ok: false, error: e.message });
      }
    }
    return data({ ok: true, success: true, message: "Metafields locked to Shopify." });
  }

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
          metafields.push({ ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
        }
      });
      if (ooakText && ooakText.trim() !== "") {
        const baseStory = currentStories[ownerId] || "";
        const combinedStory = baseStory ? `${baseStory} | ✨ Unique Features: ${ooakText}` : `✨ Unique Features: ${ooakText}`;
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
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) return data({ ok: false, error: errorMsg });
      } catch (e) {
        return data({ ok: false, error: e.message });
      }
    }
    return data({ ok: true });
  }

  if (intent === "autoFill") {
    const title       = formData.get("title");
    const description = formData.get("description");
    const existingRaw = formData.get("existingMeta");
    const existing    = existingRaw ? JSON.parse(existingRaw) : {};
    const parsed      = parseDescription(description);
    const library     = lookupStone(title) || {};

    let stoneName = existing.official_name ? String(existing.official_name).trim() : null;
    if (!stoneName && library.official_name) stoneName = library.official_name;
    if (!stoneName && title) stoneName = title;

    let mindat = {};
    let mindatError = null;

    if (!stoneName) {
      mindatError = "missing_name";
    } else {
      try {
        const normalizedName = stoneName.toLowerCase().trim();
        const cachedStone = await prisma.stoneCache.findUnique({ where: { stoneName: normalizedName } });
        if (cachedStone) {
          mindat = JSON.parse(cachedStone.data);
        } else {
          if (!process.env.MINDAT_API_KEY) throw new Error("MINDAT_API_KEY not set");
          const res = await fetch(
            `https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(stoneName)}&format=json`,
            { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
          );
          if (!res.ok) throw new Error(`Mindat HTTP ${res.status}`);
          const json = await res.json();
          if (json.results?.[0]) {
            const m = json.results[0];
            const hardnessStr = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
            const gravityStr = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";
            mindat = {
              moh_hardness: hardnessStr, crystal_system: m.crystal_system || "",
              specific_gravity: gravityStr, luster: m.lustre || "",
              cleavage: m.cleavage || "", fracture_pattern: m.fracture || "",
              diaphaneity: m.diaphaneity || "", tenacity: m.tenacity || "",
            };
            Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });
            if (Object.keys(mindat).length > 0) {
              await prisma.stoneCache.create({ data: { stoneName: normalizedName, data: JSON.stringify(mindat) } });
            }
          }
        }
      } catch (e) {
        mindatError = e.message;
      }
    }

    const merged = {};
    const conflicts = [];
    if (stoneName && !existing["official_name"]) merged["official_name"] = stoneName;

    KEYS_TO_PROCESS.forEach(key => {
      if (existing[key] && String(existing[key]).trim() !== "") { merged[key] = existing[key]; return; }
      const libVal    = library[key] || "";
      const parsedVal = parsed[key]  || "";
      const mindatVal = mindat[key]  || "";
      if (key === "luster") {
        if (libVal) { if (mindatVal && libVal !== mindatVal) conflicts.push({ key, library: libVal, mindat: mindatVal }); merged[key] = libVal; }
        else if (mindatVal) { merged[key] = `✅ ${mindatVal}`; }
        else if (parsedVal) { merged[key] = `⚠️ ${parsedVal}`; }
      } else {
        if (mindatVal) { if (libVal && libVal !== mindatVal) conflicts.push({ key, library: libVal, mindat: mindatVal }); merged[key] = `✅ ${mindatVal}`; }
        else if (libVal) { merged[key] = libVal; }
        else if (parsedVal) { merged[key] = `⚠️ ${parsedVal}`; }
      }
    });

    if (stoneName && (!existing["is_ooak"] || String(existing["is_ooak"]).trim() === "")) {
      merged["is_ooak"] = "✅ true";
    }
    return data({ ok: true, merged, conflicts, mindatError });
  }

  if (intent === "bulkAutoFill") {
    const products = JSON.parse(formData.get("products"));
    const results = [];
    for (const p of products) {
      const library  = lookupStone(p.title) || {};
      const parsed   = parseDescription(p.description || "");
      const existing = p.metafields || {};
      let stoneName = existing.official_name ? String(existing.official_name).trim() : null;
      if (!stoneName && library.official_name) stoneName = library.official_name;
      if (!stoneName && p.title) stoneName = p.title;
      if (!stoneName) { results.push({ id: p.id, title: p.title, ok: false, error: "Could not identify stone." }); continue; }

      let mindat = {};
      let mindatError = null;
      try {
        const normalizedName = stoneName.toLowerCase().trim();
        const cachedStone = await prisma.stoneCache.findUnique({ where: { stoneName: normalizedName } });
        if (cachedStone) {
          mindat = JSON.parse(cachedStone.data);
        } else {
          if (!process.env.MINDAT_API_KEY) throw new Error("MINDAT_API_KEY not set");
          const res = await fetch(
            `https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(stoneName)}&format=json`,
            { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
          );
          if (res.ok) {
            const json = await res.json();
            if (json.results?.[0]) {
              const m = json.results[0];
              const hardnessStr = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
              const gravityStr = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";
              mindat = {
                moh_hardness: hardnessStr, crystal_system: m.crystal_system || "",
                specific_gravity: gravityStr, luster: m.lustre || "",
                cleavage: m.cleavage || "", fracture_pattern: m.fracture || "",
                diaphaneity: m.diaphaneity || "", tenacity: m.tenacity || "",
              };
              Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });
              if (Object.keys(mindat).length > 0) {
                await prisma.stoneCache.create({ data: { stoneName: normalizedName, data: JSON.stringify(mindat) } });
              }
            }
          }
        }
      } catch (e) { mindatError = e.message; }

      const merged = {};
      const conflicts = [];
      if (stoneName && !existing["official_name"]) merged["official_name"] = stoneName;

      KEYS_TO_PROCESS.forEach(key => {
        if (existing[key] && String(existing[key]).trim() !== "") { merged[key] = existing[key]; return; }
        const libVal    = library[key] || "";
        const parsedVal = parsed[key]  || "";
        const mindatVal = mindat[key]  || "";
        if (key === "luster") {
          if (libVal) { if (mindatVal && libVal !== mindatVal) conflicts.push({ key, library: libVal, mindat: mindatVal }); merged[key] = libVal; }
          else if (mindatVal) { merged[key] = `✅ ${mindatVal}`; }
          else if (parsedVal) { merged[key] = `⚠️ ${parsedVal}`; }
        } else {
          if (mindatVal) { if (libVal && libVal !== mindatVal) conflicts.push({ key, library: libVal, mindat: mindatVal }); merged[key] = `✅ ${mindatVal}`; }
          else if (libVal) { merged[key] = libVal; }
          else if (parsedVal) { merged[key] = `⚠️ ${parsedVal}`; }
        }
      });

      const metafields = KEYS_TO_PROCESS
        .filter(key => merged[key] && String(merged[key]).trim() !== "")
        .map(key => {
          let finalValue = merged[key];
          if (key === "stone_story") finalValue = autoLinkStory(finalValue);
          const formatted = formatMetafieldValue(key, finalValue);
          if (!formatted) return null;
          return { ownerId: p.id, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type };
        }).filter(Boolean);

      if (metafields.length === 0) { results.push({ id: p.id, title: p.title, ok: false, error: "no data found" }); continue; }

      let saveError = null;
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) { saveError = errorMsg; break; }
      }

      results.push({ id: p.id, title: p.title, ok: !saveError, error: saveError || mindatError || null, merged, conflicts });
      await new Promise(r => setTimeout(r, 200));
    }

    const failed = results.filter(r => !r.ok);
    return data({ ok: true, total: results.length, failed, results });
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
  const { products, loaderError } = useLoaderData();
  const [activeView, setActiveView] = useState(0);
  const [menuActive, setMenuActive] = useState(false);

  const views = [
    { id: "products",    content: "🪨 Products" },
    { id: "bulk",        content: "📦 Bulk Edit" },
    { id: "inject",      content: "💉 QA & Inject" },
    { id: "mindat",      content: "🌍 Mindat" }
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
                activator={<Button onClick={() => setMenuActive(!menuActive)} icon={MenuIcon} size="large">{views[activeView].content}</Button>}
                onClose={() => setMenuActive(false)}
              >
                <ActionList
                  actionRole="menuitem"
                  items={views.map((view, index) => ({
                    content: view.content,
                    onAction: () => { 
                      setActiveView(Number(index)); 
                      setMenuActive(false); 
                    },
                  }))}
                />
              </Popover>
            </Box>
            <Divider />
            <Box padding="400">
              {activeView === 0 && <ProductsTab products={products} />}
              {activeView === 1 && <MetaCore products={products} mode="bulk" />}
              {activeView === 2 && <MetaCore products={products} mode="inject" />}
              {activeView === 3 && <MetaCore products={products} mode="mindat" />}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
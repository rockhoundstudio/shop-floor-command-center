import { useState, useRef } from "react";
import { useLoaderData, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

import ProductsTab from "../components/meta/ProductsTab";
import MetaCore from "../components/meta/MetaCore";
import CollectionsTab from "../components/meta/CollectionsTab";
import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";

// ─── FIELDS THAT ARE list.metaobject_reference — never write as plain text ───
const SKIP_KEYS = new Set(["mineral_class", "rock_composition"]);

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
    const title       = formData.get("title");
    const description = formData.get("description");
    const existingRaw = formData.get("existingMeta");
    const existing    = existingRaw ? JSON.parse(existingRaw) : {};

    const parsed  = parseDescription(description);
    const library = lookupStone(title) || {};

    const stoneName = existing.official_name ? String(existing.official_name).trim() : null;

    let mindat = {};
    let mindatError = null;

    if (!stoneName) {
      mindatError = "Stone must be identified before auto-fill. Please set the Official Name field first.";
    } else {
      try {
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
            where_found:       "", 
            geological_age:    "", 
            crystal_structure: m.crystal_system   || "",
            chemical_formula:  m.formula          || "",
            specific_gravity:  gravityStr,
            luster:            m.lustre           || "",
            cleavage:          m.cleavage         || "",
            fracture_pattern:  m.fracture         || "",
            diaphaneity:       m.diaphaneity      || "",
          };
          Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });
        }
      } catch (e) {
        mindatError = e.message;
      }
    }

    const merged = {};
    const conflicts = [];
    TARGET_KEYS.forEach(key => {
      if (SKIP_KEYS.has(key)) return;
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
    const productsRaw = formData.get("products");
    const products = JSON.parse(productsRaw);
    const results = [];

    for (const p of products) {
      const library  = lookupStone(p.title) || {};
      const parsed   = parseDescription(p.description || "");
      const existing = p.metafields || {};

      const stoneName = existing.official_name ? String(existing.official_name).trim() : null;
      if (!stoneName) {
        results.push({ id: p.id, title: p.title, ok: false, error: "Stone must be identified first — set Official Name" });
        continue;
      }

      let mindat = {};
      let mindatError = null;
      try {
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
              where_found:       "",
              geological_age:    "",
              crystal_structure: m.crystal_system   || "",
              chemical_formula:  m.formula          || "",
              specific_gravity:  gravityStr,
              luster:            m.lustre           || "",
              cleavage:          m.cleavage         || "",
              fracture_pattern:  m.fracture         || "",
              diaphaneity:       m.diaphaneity      || "",
            };
            Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });
          }
        }
      } catch (e) {
        mindatError = e.message;
      }

      const merged = {};
      TARGET_KEYS.forEach(key => {
        if (SKIP_KEYS.has(key)) return;
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
        .filter(key => !SKIP_KEYS.has(key) && merged[key] && String(merged[key]).trim() !== "")
        .map(key => ({
          ownerId:   p.id,
          namespace: "custom",
          key,
          value:     merged[key],
          type:      "single_line_text_field",
        }));

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

      results.push({
        id: p.id,
        title: p.title,
        ok: !saveError,
        error: saveError || mindatError || null,
      });

      await new Promise(r => setTimeout(r, 200));
    }

    const failed = results.filter(r => !r.ok);
    return data({ ok: true, total: results.length, failed });
  }

  // ─── SAVE METAFIELDS ────────────────────────────────────────────────────────
  if (intent === "saveMetafields") {
    const metafields = JSON.parse(formData.get("metafields"));
    const nonEmpty = metafields
      .filter(mf => !SKIP_KEYS.has(mf.key) && mf.value && String(mf.value).trim() !== "");
    const chunks = [];
    for (let i = 0; i < nonEmpty.length; i += 25) chunks.push(nonEmpty.slice(i, i + 25));
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

  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const metafields = [];
    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (SKIP_KEYS.has(key)) return;
        if (updates[key] && updates[key].trim() !== "") {
          metafields.push({ ownerId, namespace: "custom", key, value: updates[key], type: "single_line_text_field" });
        }
      });
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

  if (intent === "inject") {
    const payload = formData.get("payload");
    const lines = payload.split("\n").filter(Boolean);
    const metafields = [];
    let skipped = 0;
    for (const line of lines) {
      try {
        const mf = JSON.parse(line);
        if (!SKIP_KEYS.has(mf.key)) metafields.push(mf);
        else skipped++;
      }
      catch { skipped++; }
    }
    for (let i = 0; i < metafields.length; i += 25) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { message } }
        }
      `, { variables: { metafields: metafields.slice(i, i + 25) } });
    }
    return data({ ok: true, injected: metafields.length, skipped });
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

  if (intent === "createCollection") {
    const title = formData.get("title");
    await admin.graphql(`mutation collectionCreate($input: CollectionInput!) { collectionCreate(input: $input) { userErrors { message } } }`, { variables: { input: { title } } });
    return data({ ok: true });
  }
  if (intent === "deleteCollection") {
    const id = formData.get("id");
    await admin.graphql(`mutation collectionDelete($input: CollectionDeleteInput!) { collectionDelete(input: $input) { userErrors { message } } }`, { variables: { input: { id } } });
    return data({ ok: true });
  }
  if (intent === "assignCollection") {
    const productId = formData.get("productId");
    const collectionId = formData.get("collectionId");
    await admin.graphql(`mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message } } }`, { variables: { id: collectionId, productIds: [productId] } });
    return data({ ok: true });
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
    { id: "inject",      content: "💉 Inject" },
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
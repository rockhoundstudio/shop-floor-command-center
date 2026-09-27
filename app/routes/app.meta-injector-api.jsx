import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

// 🟢 Structural Engine — No Prisma Import Here

const PIN_CONFIG = {
  // Native Branches (Bypass Metafields)
  shopify_title: { target: "native", path: "title" },
  price: { target: "native_variant", path: "price" },
  shipping_weight_oz: { target: "native_variant", path: "weight" },
  seo_title: { target: "native", path: "seo_title" },
  poetic_hook: { target: "native", path: "seo_description" },
  alt_text: { target: "native_media", path: "alt" },
  google_product_category: { target: "native", path: "category" },
  collection_name: { target: "native_collection", path: "collections" },

  // Existing custom metafields
  piece_name: { target: "metafield", ns: "custom", key: "piece_name", type: "single_line_text_field" },
  weight_grams: { target: "metafield", ns: "custom", key: "weight_grams", type: "number_decimal" },
  dimensions_mm: { target: "metafield", ns: "custom", key: "dimensions_mm", type: "single_line_text_field" },
  surface_finish: { target: "metafield", ns: "custom", key: "surface_finish", type: "single_line_text_field" },
  honest_flaws_and_character: { target: "metafield", ns: "custom", key: "honest_flaws_and_character", type: "multi_line_text_field" },
  bench_notes: { target: "metafield", ns: "custom", key: "bench_notes", type: "multi_line_text_field" },
  mohs_hardness: { target: "metafield", ns: "custom", key: "mohs_hardness", type: "single_line_text_field" },
  specific_gravity: { target: "metafield", ns: "custom", key: "specific_gravity", type: "single_line_text_field" },
  fracture_pattern: { target: "metafield", ns: "custom", key: "fracture_pattern", type: "single_line_text_field" },
  cleavage: { target: "metafield", ns: "custom", key: "cleavage", type: "single_line_text_field" },
  luster: { target: "metafield", ns: "custom", key: "luster", type: "single_line_text_field" },
  diaphaneity: { target: "metafield", ns: "custom", key: "diaphaneity", type: "single_line_text_field" },
  origin_location: { target: "metafield", ns: "custom", key: "origin_location", type: "single_line_text_field" },
  origin_story: { target: "metafield", ns: "custom", key: "origin_story", type: "multi_line_text_field" },

  // Shopify Metaobject References (Strict)
  color_pattern: { target: "metafield", ns: "shopify", key: "color-pattern", type: "list.metaobject_reference" },
  primary_use: { target: "metafield", ns: "shopify", key: "product-use", type: "list.metaobject_reference" },
  jewelry_type: { target: "metafield", ns: "shopify", key: "jewelry-type", type: "list.metaobject_reference" },
  primary_medium: { target: "metafield", ns: "shopify", key: "material", type: "list.metaobject_reference" },
  secondary_medium: { target: "metafield", ns: "shopify", key: "jewelry-material", type: "list.metaobject_reference" },
  jewelry_finding_type: { target: "metafield", ns: "shopify", key: "jewelry-finding-type", type: "list.metaobject_reference" },
  crystal_system: { target: "metafield", ns: "shopify", key: "crystal-system", type: "list.metaobject_reference" },
  mineral_class: { target: "metafield", ns: "shopify", key: "mineral-class", type: "list.metaobject_reference" },
  geological_era: { target: "metafield", ns: "shopify", key: "geological-era", type: "list.metaobject_reference" },
  rock_formation: { target: "metafield", ns: "shopify", key: "rock-formation", type: "list.metaobject_reference" },
  authenticity: { target: "metafield", ns: "shopify", key: "authenticity", type: "list.metaobject_reference" },
  rarity: { target: "metafield", ns: "shopify", key: "rarity", type: "list.metaobject_reference" },

  // Existing Aliases
  is_ooak: { target: "metafield", ns: "custom", key: "is_one_of_a_kind", type: "single_line_text_field" },
  origin_handle: { target: "metafield", ns: "custom", key: "origin_page_handle", type: "single_line_text_field" },

  // Explicit Separate Custom Fields (Not aliases)
  stone_family: { target: "metafield", ns: "custom", key: "stone_family", type: "single_line_text_field" },
  cut_and_shape: { target: "metafield", ns: "custom", key: "cut_and_shape", type: "single_line_text_field" },
  primary_color: { target: "metafield", ns: "custom", key: "primary_color", type: "single_line_text_field" },
  product_format: { target: "metafield", ns: "custom", key: "product_format", type: "single_line_text_field" },
  setting_ready: { target: "metafield", ns: "custom", key: "setting_ready", type: "boolean" },
  bail_included: { target: "metafield", ns: "custom", key: "bail_included", type: "boolean" },
  chain_material: { target: "metafield", ns: "custom", key: "chain_material", type: "single_line_text_field" },
  collection_location: { target: "metafield", ns: "custom", key: "collection_location", type: "single_line_text_field" },
  craftsmanship: { target: "metafield", ns: "custom", key: "craftsmanship", type: "multi_line_text_field" },

  // Separate Output
  generated_description: { target: "metafield", ns: "custom", key: "generated_description", type: "multi_line_text_field" }
};

const METAOBJECT_DICT = {
  "shopify.authenticity": {
    "genuine": "gid://shopify/Metaobject/151951114491",
    "authentic": "gid://shopify/Metaobject/151951114491",
    "replica": "gid://shopify/Metaobject/156128346363"
  },
  "shopify.rarity": {
    "common": "gid://shopify/Metaobject/151951147259",
    "rare": "gid://shopify/Metaobject/154252050683",
    "one-of-a-kind": "gid://shopify/Metaobject/154252050683"
  }
};

const LEGACY_MAP_LOCAL = {
  "custom.crystal-system": "custom.crystal_system",
  "custom.mineral-class": "custom.mineral_class",
  "custom.rock-composition": "custom.rock_composition",
  "custom.geological-era": "custom.geological_era",
  "custom.rock-formation": "custom.rock_formation",
  "custom.necklace-design": "custom.necklace_design",
  "custom.is_one_of_a_kind": "custom.is_ooak"
};

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeMetafieldValue(key, value, type) {
  let val = String(value).replace(/^⚠️\s*/, "");
  
  if (type === "boolean") {
     const lower = val.toLowerCase();
     if (lower === "yes" || lower === "true" || lower === "1") return "true";
     if (lower === "no" || lower === "false" || lower === "0") return "false";
     return val; 
  }

  const booleanKeys = ["is_ooak", "found_object", "custom_product", "setting_ready", "bail_included", "treated"];
  if (booleanKeys.includes(key) && type !== "boolean") {
    if (val.toLowerCase() === "true") val = "Yes";
    else if (val.toLowerCase() === "false") val = "No";
  }
  return val;
}

function sanitizeDescription(html) {
  if (!html || typeof html !== "string") return html;
  let safeHtml = html;
  const targets = ["/pages/the-shopped-rock", "/collections/the-shopped-rock", "/pages/the-shocked-rock", "/collections/the-shocked-rock"];
  for (const target of targets) {
    const regexNormal = new RegExp(`<a[^>]*href=["']?[^"'>]*${target.replace(/\//g, '\\/')}["']?[^>]*>.*?<\\/a>`, 'gi');
    safeHtml = safeHtml.replace(regexNormal, "");
    const regexEscaped = new RegExp(`&lt;a[^&]*href=[&quot;']?[^&quot;'>]*${target.replace(/\//g, '\\/')}[&quot;']?[^&]*&gt;.*?&lt;\\/a&gt;`, 'gi');
    safeHtml = safeHtml.replace(regexEscaped, "");
  }
  return safeHtml;
}

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "loadProductData") {
      const pieceId = body.get("pieceId");
      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      const productQuery = await admin.graphql(`
        query getProduct($id: ID!) {
          product(id: $id) {
            id title
            seo { title description }
            category { name }
            variants(first: 1) { edges { node { id price weight weightUnit } } }
            media(first: 1) { edges { node { ... on MediaImage { id image { altText } } } } }
            collections(first: 10) { edges { node { id title } } }
            metafields(first: 250) { edges { node { namespace key value } } }
          }
        }
      `, { variables: { id: productGid } });

      const productData = await productQuery.json();
      const product = productData?.data?.product;
      if (!product) return Response.json({ intent: "loadProductData", success: false, message: "Product not found" });

      const currentMetafields = {};
      if (product.metafields?.edges) {
        product.metafields.edges.forEach(({node}) => {
            currentMetafields[`${node.namespace}.${node.key}`] = node.value;
        });
      }

      const canonicalFields = {};
      const repairPlan = {};
      const legacyFields = {};

      Object.keys(PIN_CONFIG).forEach(inKey => {
         const cfg = PIN_CONFIG[inKey];
         if (cfg.target === "metafield") {
             const dotKey = `${cfg.ns}.${cfg.key}`;
             canonicalFields[inKey] = currentMetafields[dotKey] ?? "";
             repairPlan[inKey] = currentMetafields[dotKey] ?? "";
         } else if (cfg.target === "native") {
             if (inKey === "shopify_title") canonicalFields[inKey] = product.title || "";
             if (inKey === "seo_title") canonicalFields[inKey] = product.seo?.title || "";
             if (inKey === "poetic_hook") canonicalFields[inKey] = product.seo?.description || "";
             if (inKey === "google_product_category") canonicalFields[inKey] = product.category?.name || "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_variant") {
             const variant = product.variants?.edges?.[0]?.node;
             if (inKey === "price") canonicalFields[inKey] = variant?.price || "0.00";
             if (inKey === "shipping_weight_oz") canonicalFields[inKey] = variant?.weight ? String(variant.weight) : "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_media") {
             canonicalFields[inKey] = product.media?.edges?.[0]?.node?.image?.altText || "";
             repairPlan[inKey] = canonicalFields[inKey];
         } else if (cfg.target === "native_collection") {
             canonicalFields[inKey] = product.collections?.edges?.map(e => e.node.title).join(", ") || "";
             repairPlan[inKey] = canonicalFields[inKey];
         }
      });

      canonicalFields["global.title_tag"] = currentMetafields["global.title_tag"] ?? "";
      canonicalFields["global.description_tag"] = currentMetafields["global.description_tag"] ?? "";

      Object.entries(LEGACY_MAP_LOCAL).forEach(([leg, can]) => {
         if (currentMetafields[leg] !== undefined) {
            legacyFields[leg] = {
               value: String(currentMetafields[leg]),
               canonicalTarget: can,
               canonicalCurrent: canonicalFields[can] || ""
            };
         }
      });

      return Response.json({
         intent: "loadProductData",
         success: true,
         productId: product.id,
         productTitle: product.title,
         currentMetafields,
         canonicalFields,
         legacyFields,
         repairPlan
      });
    }

    if (intent === "executeRepairPlan") {
      const pieceId = body.get("pieceId");
      const rawPlan = body.get("repairPlan");
      const rawLegacy = body.get("legacyKeysToRemove");
      
      if (!pieceId || !rawPlan) {
        return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Missing pieceId or repairPlan payload." });
      }

      const repairPlan = JSON.parse(rawPlan);
      const legacyKeysToRemove = rawLegacy ? JSON.parse(rawLegacy) : [];
      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      const lookupResponse = await admin.graphql(`
        query getProductLookup($id: ID!) {
          product(id: $id) { 
            title
            seo { title description }
            category { name }
            variants(first: 1) { edges { node { id price weight weightUnit } } }
            media(first: 1) { edges { node { ... on MediaImage { id image { altText } } } } }
            collections(first: 10) { edges { node { id title } } }
            metafields(first: 250) { edges { node { namespace key value type id } } } 
          }
        }
      `, { variables: { id: productGid } });
      
      const lookupData = await lookupResponse.json();
      const product = lookupData?.data?.product;
      if (!product) {
         return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Product not found on lookup." });
      }

      const currentMetaList = product.metafields?.edges || [];
      const currentMetafields = {};
      currentMetaList.forEach(e => { currentMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value; });

      const currentFields = {};
      Object.keys(PIN_CONFIG).forEach(inKey => {
         const cfg = PIN_CONFIG[inKey];
         if (cfg.target === "metafield") {
             currentFields[inKey] = currentMetafields[`${cfg.ns}.${cfg.key}`] || null;
         } else if (cfg.target === "native") {
             if (inKey === "shopify_title") currentFields[inKey] = product.title || "";
             if (inKey === "seo_title") currentFields[inKey] = product.seo?.title || "";
             if (inKey === "poetic_hook") currentFields[inKey] = product.seo?.description || "";
             if (inKey === "google_product_category") currentFields[inKey] = product.category?.name || "";
         } else if (cfg.target === "native_variant") {
             const variant = product.variants?.edges?.[0]?.node;
             if (inKey === "price") currentFields[inKey] = variant?.price || "0.00";
             if (inKey === "shipping_weight_oz") currentFields[inKey] = variant?.weight ? String(variant.weight) : "";
         } else if (cfg.target === "native_media") {
             currentFields[inKey] = product.media?.edges?.[0]?.node?.image?.altText || "";
         } else if (cfg.target === "native_collection") {
             currentFields[inKey] = product.collections?.edges?.map(e => e.node.title).join(", ") || "";
         }
      });

      const proposedChanges = {};
      const setToShopify = [];
      const deleteFromShopify = [];
      const allErrors = [];
      
      let prodUpdates = {};
      let varUpdates = {};
      let mediaUpdates = [];
      let reqProd = false, reqVar = false, reqMedia = false;
      let collectionsToResolve = [];
      let fieldsUpdatedCount = 0;

      const variantId = product.variants?.edges?.[0]?.node?.id;
      const mediaId = product.media?.edges?.[0]?.node?.id;

      Object.entries(repairPlan).forEach(([fullKey, val]) => {
        const valStr = String(val !== null && val !== undefined ? val : "").trim();
        const config = PIN_CONFIG[fullKey];

        let ns = "custom", key = fullKey, type = "single_line_text_field", target = "metafield";
        if (config) {
           target = config.target;
           ns = config.ns || ns;
           key = config.key || key;
           type = config.type || type;
        } else {
           if (fullKey.includes(".")) {
              const parts = fullKey.split(".");
              ns = parts[0];
              key = parts.slice(1).join(".");
           }
        }

        if (target === "metafield") {
            const currentVal = currentMetafields[`${ns}.${key}`] || null;
            if (valStr === "" || valStr.toLowerCase() === "none" || valStr.toLowerCase() === "n/a" || valStr.toLowerCase() === "null" || valStr.toLowerCase() === "undefined") {
              if (currentVal !== null) {
                  deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
                  proposedChanges[fullKey] = { from: currentVal, to: "" };
              }
            } else {
              let resolvedValue = normalizeMetafieldValue(key, valStr, type);
              
              if (key === "generated_description" || key === "craftsmanship" || key === "bench_notes" || key === "origin_story" || key === "honest_flaws_and_character") {
                 resolvedValue = sanitizeDescription(resolvedValue);
              }

              if (type === "number_decimal") {
                const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
                resolvedValue = isNaN(parsedNum) ? "0.0" : (parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum));
              } else if (type.includes("metaobject_reference")) {
                if (!resolvedValue.startsWith("gid://")) {
                  const dict = METAOBJECT_DICT[`${ns}.${key}`] || {};
                  const mappedGid = dict[resolvedValue.toLowerCase()];
                  if (mappedGid) {
                    resolvedValue = type.startsWith("list.") ? JSON.stringify([mappedGid]) : mappedGid;
                  } else {
                    allErrors.push({ message: `Blocked: No Metaobject GID mapping found for '${resolvedValue}' in ${ns}.${key}. Cannot safely write to list.metaobject_reference.` });
                    return; 
                  }
                } else {
                   resolvedValue = type.startsWith("list.") && !resolvedValue.startsWith("[") ? JSON.stringify([resolvedValue]) : resolvedValue;
                }
              } else if (type === "multi_line_text_field") {
                if (resolvedValue.length > 10000) resolvedValue = resolvedValue.slice(0, 10000);
              } else if (type === "list.single_line_text_field") {
                if (!resolvedValue.startsWith("[")) resolvedValue = JSON.stringify([resolvedValue]);
              } else if (type !== "boolean") {
                if (resolvedValue.length > 255) resolvedValue = resolvedValue.slice(0, 255);
              }

              if (currentVal !== resolvedValue) {
                 setToShopify.push({ ownerId: productGid, namespace: ns, key: key, type: type, value: resolvedValue });
                 proposedChanges[fullKey] = { from: currentVal, to: resolvedValue };
              }
            }
        } else {
            const currentVal = currentFields[fullKey] || "";
            if (valStr !== currentVal && valStr !== "") {
               proposedChanges[fullKey] = { from: currentVal, to: valStr };
               
               if (target === "native") {
                  if (fullKey === "shopify_title") { prodUpdates.title = valStr; reqProd = true; }
                  if (fullKey === "seo_title") { prodUpdates.seo = prodUpdates.seo || {}; prodUpdates.seo.title = valStr; reqProd = true; }
                  if (fullKey === "poetic_hook") { prodUpdates.seo = prodUpdates.seo || {}; prodUpdates.seo.description = valStr; reqProd = true; }
                  if (fullKey === "google_product_category") {
                     if (valStr && !valStr.startsWith("gid://")) {
                        allErrors.push({ message: `google_product_category requires a TaxonomyNode GID. Got: '${valStr}'`});
                     } else if (valStr) {
                        prodUpdates.productCategory = { productTaxonomyNodeId: valStr };
                        reqProd = true;
                     }
                  }
               } else if (target === "native_variant") {
                  if (!variantId) { allErrors.push({message: `Cannot update ${fullKey}, variant ID missing.`}); return; }
                  if (fullKey === "price") { varUpdates.price = String(valStr); reqVar = true; }
                  if (fullKey === "shipping_weight_oz") { 
                      varUpdates.weight = parseFloat(valStr) || 0; 
                      varUpdates.weightUnit = "OUNCES"; 
                      reqVar = true; 
                  }
               } else if (target === "native_media") {
                  if (!mediaId) { allErrors.push({message: `Cannot update ${fullKey}, media ID missing.`}); return; }
                  if (fullKey === "alt_text") { mediaUpdates.push({ id: mediaId, alt: valStr }); reqMedia = true; }
               } else if (target === "native_collection") {
                  if (valStr) {
                     collectionsToResolve = valStr.split(",").map(s => s.trim()).filter(s => s);
                  }
               }
            }
        }
      });

      if (collectionsToResolve.length > 0) {
         prodUpdates.collectionsToJoin = [];
         for (const cname of collectionsToResolve) {
             if (cname.startsWith("gid://")) {
                 prodUpdates.collectionsToJoin.push(cname);
                 reqProd = true;
             } else {
                 try {
                     const cRes = await admin.graphql(`query { collections(first:1, query: "title:'${cname.replace(/'/g, "\\'")}'") { edges { node { id } } } }`);
                     const cData = await cRes.json();
                     const cid = cData?.data?.collections?.edges?.[0]?.node?.id;
                     if (cid) {
                         prodUpdates.collectionsToJoin.push(cid);
                         reqProd = true;
                     } else {
                         allErrors.push({ message: `Collection not found: '${cname}'`});
                     }
                 } catch (e) {
                     allErrors.push({ message: `Error querying collection '${cname}': ${e.message}`});
                 }
             }
         }
      }

      legacyKeysToRemove.forEach(fullKey => {
        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }
        if (currentMetafields[`${ns}.${key}`] !== undefined) {
           deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
           proposedChanges[fullKey] = { from: currentMetafields[`${ns}.${key}`], to: null };
        }
      });

      if (setToShopify.length === 0 && deleteFromShopify.length === 0 && !reqProd && !reqVar && !reqMedia) {
          if (allErrors.length > 0) {
              return Response.json({ 
                  intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
                  errors: allErrors, currentMetafields, repairPlan, proposedChanges, fieldsUpdated: 0, legacyKeysRemoved: 0,
                  conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write blocked by errors."
              });
          }
          return Response.json({
              intent: "executeRepairPlan", pieceId, success: true, status: "NO_CHANGES_REQUIRED",
              fieldsUpdated: 0, legacyKeysRemoved: 0, message: "No changes required.",
              currentMetafields, repairPlan, proposedChanges, conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: true
          });
      }

      if (deleteFromShopify.length > 0) {
        const uniqueDel = new Map();
        deleteFromShopify.forEach(m => uniqueDel.set(`${m.namespace}:${m.key}`, m));
        const chunks = chunkArray(Array.from(uniqueDel.values()), 250);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const deleteResponse = await admin.graphql(
              `#graphql
              mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                metafieldsDelete(metafields: $metafields) { userErrors { message field } }
              }`,
              { variables: { metafields: chunks[i] } }
            );
            const deleteJson = await deleteResponse.json();
            if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) allErrors.push(...deleteJson.data.metafieldsDelete.userErrors);
          } catch (delErr) { allErrors.push({ message: `API Error on Delete: ${delErr.message}` }); }
        }
      }

      if (setToShopify.length > 0) {
        const uniqueSet = new Map();
        setToShopify.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        const chunks = chunkArray(Array.from(uniqueSet.values()), 25);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const setResponse = await admin.graphql(
              `#graphql
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) { userErrors { field message } }
              }`,
              { variables: { metafields: chunks[i] } }
            );
            const setJson = await setResponse.json();
            if (setJson?.data?.metafieldsSet?.userErrors?.length) {
                allErrors.push(...setJson.data.metafieldsSet.userErrors);
            } else {
                fieldsUpdatedCount += chunks[i].length;
            }
          } catch (setErr) { allErrors.push({ message: `API Error on Set: ${setErr.message}` }); }
        }
      }

      if (reqProd) {
         try {
             const res = await admin.graphql(`
               mutation productUpdate($input: ProductInput!) {
                 productUpdate(input: $input) { userErrors { field message } }
               }
             `, { variables: { input: { id: productGid, ...prodUpdates } } });
             const json = await res.json();
             if (json?.data?.productUpdate?.userErrors?.length) {
                 allErrors.push(...json.data.productUpdate.userErrors);
             } else {
                 fieldsUpdatedCount++;
             }
         } catch (err) { allErrors.push({ message: `API Error on productUpdate: ${err.message}` }); }
      }

      if (reqVar) {
         try {
             const res = await admin.graphql(`
               mutation productVariantUpdate($input: ProductVariantInput!) {
                 productVariantUpdate(input: $input) { userErrors { field message } }
               }
             `, { variables: { input: { id: variantId, ...varUpdates } } });
             const json = await res.json();
             if (json?.data?.productVariantUpdate?.userErrors?.length) {
                 allErrors.push(...json.data.productVariantUpdate.userErrors);
             } else {
                 fieldsUpdatedCount++;
             }
         } catch (err) { allErrors.push({ message: `API Error on variantUpdate: ${err.message}` }); }
      }

      if (reqMedia) {
         try {
             const res = await admin.graphql(`
               mutation productUpdateMedia($media: [UpdateMediaInput!]!, $productId: ID!) {
                 productUpdateMedia(media: $media, productId: $productId) { userErrors { field message } }
               }
             `, { variables: { media: mediaUpdates, productId: productGid } });
             const json = await res.json();
             if (json?.data?.productUpdateMedia?.userErrors?.length) {
                 allErrors.push(...json.data.productUpdateMedia.userErrors);
             } else {
                 fieldsUpdatedCount++;
             }
         } catch (err) { allErrors.push({ message: `API Error on mediaUpdate: ${err.message}` }); }
      }

      if (allErrors.length > 0) {
         return Response.json({ 
             intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
             errors: allErrors, currentMetafields, repairPlan, proposedChanges, fieldsUpdated: fieldsUpdatedCount, legacyKeysRemoved: deleteFromShopify.length,
             conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write produced errors."
         });
      }

      await new Promise(r => setTimeout(r, 600)); 
      
      const readBackResponse = await admin.graphql(`
        query getProductLookup($id: ID!) {
          product(id: $id) { 
            title
            seo { title description }
            category { name }
            variants(first: 1) { edges { node { id price weight weightUnit } } }
            media(first: 1) { edges { node { ... on MediaImage { id image { altText } } } } }
            collections(first: 10) { edges { node { id title } } }
            metafields(first: 250) { edges { node { namespace key value type } } } 
          }
        }
      `, { variables: { id: productGid } });
      
      const readBackData = await readBackResponse.json();
      const newProduct = readBackData?.data?.product;
      const newMetaList = newProduct?.metafields?.edges || [];
      const newMetafields = {};
      newMetaList.forEach(e => { newMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value; });

      let readBackVerified = true;
      const conflicts = {};

      Object.entries(proposedChanges).forEach(([fullKey, change]) => {
         const config = PIN_CONFIG[fullKey];
         const expected = change.to;
         if (expected === null || expected === "") return; 

         let target = "metafield", ns = "custom", key = fullKey;
         if (config) {
             target = config.target;
             ns = config.ns || ns;
             key = config.key || key;
         } else if (fullKey.includes(".")) {
             const parts = fullKey.split(".");
             ns = parts[0];
             key = parts.slice(1).join(".");
         }

         if (target === "metafield") {
             const actual = newMetafields[`${ns}.${key}`];
             const expStr = String(expected).trim();
             const actStr = String(actual !== undefined && actual !== null ? actual : "").trim();
             
             if (config?.type === "number_decimal") {
                 if (parseFloat(expStr) !== parseFloat(actStr)) {
                     readBackVerified = false;
                     conflicts[fullKey] = { expected: expStr, actual: actStr };
                 }
             } else {
                 if (expStr !== actStr) {
                     readBackVerified = false;
                     conflicts[fullKey] = { expected: expStr, actual: actStr };
                 }
             }
         } else {
             let actStr = "";
             if (fullKey === "shopify_title") actStr = newProduct?.title || "";
             if (fullKey === "seo_title") actStr = newProduct?.seo?.title || "";
             if (fullKey === "poetic_hook") actStr = newProduct?.seo?.description || "";
             if (fullKey === "price") actStr = newProduct?.variants?.edges?.[0]?.node?.price || "";
             if (fullKey === "shipping_weight_oz") actStr = newProduct?.variants?.edges?.[0]?.node?.weight ? String(newProduct.variants.edges[0].node.weight) : "";
             if (fullKey === "alt_text") actStr = newProduct?.media?.edges?.[0]?.node?.image?.altText || "";
             
             const expStr = String(expected).trim();
             if (actStr.trim() !== expStr && fullKey !== "google_product_category" && fullKey !== "collection_name") {
                 readBackVerified = false;
                 conflicts[fullKey] = { expected: expStr, actual: actStr };
             }
         }
      });

      if (!readBackVerified) {
            return Response.json({
              intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
              fieldsUpdated: fieldsUpdatedCount, legacyKeysRemoved: deleteFromShopify.length,
              message: "Repair failed: Read-back verification detected conflicts.",
              currentMetafields, repairPlan, proposedChanges, conflicts, missingFields: [], unknownFields: [], readBackVerified: false
          });
      }

      return Response.json({ 
        intent: "executeRepairPlan", pieceId, success: true, status: "REPAIRED",
        fieldsUpdated: fieldsUpdatedCount, legacyKeysRemoved: deleteFromShopify.length,
        message: `Repair successful: ${fieldsUpdatedCount} fields updated, ${deleteFromShopify.length} legacy keys cleared.`,
        currentMetafields, repairPlan, proposedChanges, conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: true
      });
    }

    if (intent === "saveMetafields") {
       return Response.json({
           intent: "saveMetafields",
           success: false,
           error: "Tab 2 injection is currently disabled for safety. Please use the Operations Matrix (Tab 3) for verified staging and injection.",
           message: "Route deprecated. Use Tab 3."
       });
    }

    if (intent === "cleanMalformedKeys" || intent === "cleanAllCamelKeys" || intent === "stagedUpload" || intent === "createProduct" || intent === "cleanGhostNamespaces" || intent === "cleanAllGhostNamespaces" || intent === "toggleStatus" || intent === "batchAuditItem") {
       return await executeAutofill(intent, body, admin);
    }

    return Response.json({ success: true, intent: intent || "unknown" });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
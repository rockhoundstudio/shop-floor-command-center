import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

// 🟢 Structural Engine — No Prisma Import Here

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field", origin_location: "single_line_text_field", geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field", official_name: "single_line_text_field", luster: "single_line_text_field",
  specific_gravity: "single_line_text_field", fracture_pattern: "single_line_text_field", cleavage: "single_line_text_field",
  tenacity: "single_line_text_field", primary_color: "single_line_text_field", diaphaneity: "single_line_text_field",
  character_marks: "single_line_text_field", dimensions_mm: "single_line_text_field", cut_type: "single_line_text_field",
  bench_notes: "multi_line_text_field", stone_shape: "single_line_text_field", surface_finish: "single_line_text_field",
  treatment_status: "single_line_text_field", secondary_colors: "single_line_text_field", base_stone_type: "single_line_text_field",
  hardness: "single_line_text_field", primary_medium: "single_line_text_field", piece_name: "single_line_text_field",
  stone_family: "single_line_text_field", collection_name: "single_line_text_field", collection_location: "single_line_text_field",
  origin_handle: "single_line_text_field", origin_page_handle: "single_line_text_field", cut_and_shape: "single_line_text_field",
  primary_use: "single_line_text_field", handcrafted_by: "single_line_text_field", alt_text: "single_line_text_field",
  is_ooak: "single_line_text_field", found_object: "single_line_text_field", custom_product: "single_line_text_field",
  color: "single_line_text_field", setting_ready: "single_line_text_field", bail_included: "single_line_text_field",
  wire_material: "single_line_text_field", chain_material: "single_line_text_field", seo_title: "single_line_text_field",
  secondary_medium: "single_line_text_field", treated: "single_line_text_field", weight_grams: "number_decimal",
  shipping_weight_oz: "number_decimal", price: "number_decimal", origin_story: "multi_line_text_field",
  honest_flaws: "single_line_text_field", honest_flaws_and_character: "multi_line_text_field", generated_description: "multi_line_text_field",
  artist_notes: "multi_line_text_field", color_pattern: "list.metaobject_reference", "color-pattern": "list.metaobject_reference",
  material: "metaobject_reference", jewelry_material: "metaobject_reference", "jewelry-material": "metaobject_reference",
  age_group: "metaobject_reference", "age-group": "metaobject_reference", jewelry_type: "metaobject_reference",
  "jewelry-type": "metaobject_reference", target_gender: "metaobject_reference", "target-gender": "metaobject_reference",
  necklace_design: "metaobject_reference", "necklace-design": "metaobject_reference", authenticity: "metaobject_reference",
  rarity: "metaobject_reference", condition: "metaobject_reference", crystal_system: "metaobject_reference",
  "crystal-system": "metaobject_reference", mineral_class: "metaobject_reference", "mineral-class": "metaobject_reference",
  geological_era: "metaobject_reference", "geological-era": "metaobject_reference", rock_composition: "metaobject_reference",
  "rock-composition": "metaobject_reference", rock_formation: "metaobject_reference", "rock-formation": "metaobject_reference",
  chain_link_type: "metaobject_reference", "chain-link-type": "metaobject_reference", jewelry_finding_type: "metaobject_reference",
  "jewelry-finding-type": "metaobject_reference"
};

const EXPLICIT_METAOBJECT_KEYS = [
  "material", "color-pattern", "color_pattern", "jewelry-material", "jewelry_material",
  "target-gender", "age-group", "age_group", "condition", "rarity", 
  "authenticity", "jewelry-type", "jewelry_type", "necklace-design", "necklace_design", 
  "crystal-system", "geological-era", "geological_era", 
  "mineral-class", "mineral_class", "rock-composition", "rock_composition", 
  "rock-formation", "rock_formation", "chain-link-type", "chain_link_type",
  "jewelry-finding-type", "jewelry_finding_type"
];

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeMetafieldValue(key, value) {
  let val = String(value).replace(/^⚠️\s*/, "");
  const booleanKeys = ["is_ooak", "found_object", "custom_product", "setting_ready", "bail_included", "treated"];
  if (booleanKeys.includes(key)) {
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
            variants(first: 1) { edges { node { price } } }
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

      const CANONICAL_KEYS = Object.keys(MASTER_TYPE_MAP).map(k => `custom.${k}`);
      CANONICAL_KEYS.push("global.title_tag", "global.description_tag");

      CANONICAL_KEYS.forEach(k => {
         let val = currentMetafields[k] ?? "";
         canonicalFields[k] = val;
         repairPlan[k] = val; 
      });

      canonicalFields["shopify_title"] = product.title;
      repairPlan["shopify_title"] = product.title;
      canonicalFields["price"] = product.variants?.edges?.[0]?.node?.price || "0.00";
      repairPlan["price"] = canonicalFields["price"];

      const LEGACY_MAP_LOCAL = {
        "custom.crystal-system": "custom.crystal_system",
        "custom.mineral-class": "custom.mineral_class",
        "custom.rock-composition": "custom.rock_composition",
        "custom.geological-era": "custom.geological_era",
        "custom.rock-formation": "custom.rock_formation",
        "custom.necklace-design": "custom.necklace_design",
        "custom.is_one_of_a_kind": "custom.is_ooak"
      };

      Object.entries(LEGACY_MAP_LOCAL).forEach(([leg, can]) => {
         if (currentMetafields[leg] !== undefined) {
            legacyFields[leg] = {
               value: String(currentMetafields[leg]),
               canonicalTarget: can,
               canonicalCurrent: canonicalFields[can]
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
        query getMetafields($id: ID!) {
          product(id: $id) { metafields(first: 250) { edges { node { namespace key value type id } } } }
        }
      `, { variables: { id: productGid } });
      
      const lookupData = await lookupResponse.json();
      const currentMetaList = lookupData?.data?.product?.metafields?.edges || [];
      const currentMetafields = {};
      currentMetaList.forEach(e => { currentMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value; });

      const proposedChanges = {};
      const setToShopify = [];
      const deleteFromShopify = [];
      
      Object.entries(repairPlan).forEach(([fullKey, val]) => {
        if (fullKey === "shopify_title" || fullKey === "price") return;

        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }

        const valStr = String(val !== null && val !== undefined ? val : "").trim();
        const currentVal = currentMetafields[fullKey] || null;

        if (valStr === "" || valStr.toLowerCase() === "none" || valStr.toLowerCase() === "n/a" || valStr.toLowerCase() === "null" || valStr.toLowerCase() === "undefined") {
          if (currentVal !== null) {
              deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
              proposedChanges[fullKey] = { from: currentVal, to: "" };
          }
        } else {
          let resolvedType = MASTER_TYPE_MAP[key] || "single_line_text_field";
          let resolvedValue = normalizeMetafieldValue(key, valStr);

          if (key === "generated_description") resolvedValue = sanitizeDescription(resolvedValue);

          if (resolvedType === "number_decimal") {
            const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
            resolvedValue = isNaN(parsedNum) ? "0.0" : (parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum));
          } else if (resolvedType === "list.single_line_text_field") {
            if (!resolvedValue.startsWith("[")) resolvedValue = JSON.stringify([resolvedValue]);
          } else if (resolvedType.includes("metaobject_reference")) {
            if (!String(resolvedValue).startsWith("gid://")) resolvedType = "single_line_text_field";
          } else if (resolvedType === "multi_line_text_field") {
            if (resolvedValue.length > 10000) resolvedValue = resolvedValue.slice(0, 10000);
          } else {
            if (resolvedValue.length > 255) resolvedValue = resolvedValue.slice(0, 255);
          }

          if (currentVal !== resolvedValue) {
             setToShopify.push({ ownerId: productGid, namespace: ns, key: key, type: resolvedType, value: resolvedValue });
             proposedChanges[fullKey] = { from: currentVal, to: resolvedValue };
          }
        }
      });

      legacyKeysToRemove.forEach(fullKey => {
        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }
        if (currentMetafields[fullKey] !== undefined) {
           deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
           proposedChanges[fullKey] = { from: currentMetafields[fullKey], to: null };
        }
      });

      if (setToShopify.length === 0 && deleteFromShopify.length === 0) {
          return Response.json({
              intent: "executeRepairPlan",
              pieceId,
              success: true,
              status: "NO_CHANGES_REQUIRED",
              fieldsUpdated: 0,
              legacyKeysRemoved: 0,
              message: "No changes required.",
              currentMetafields, repairPlan, proposedChanges, conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: true
          });
      }

      const allErrors = [];

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
            if (setJson?.data?.metafieldsSet?.userErrors?.length) allErrors.push(...setJson.data.metafieldsSet.userErrors);
          } catch (setErr) { allErrors.push({ message: `API Error on Set: ${setErr.message}` }); }
        }
      }

      if (allErrors.length > 0) {
         return Response.json({ 
             intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
             errors: allErrors, currentMetafields, repairPlan, proposedChanges, fieldsUpdated: 0, legacyKeysRemoved: 0,
             conflicts: {}, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write produced errors."
         });
      }

      await new Promise(r => setTimeout(r, 600)); 
      
      const readBackResponse = await admin.graphql(`
        query getMetafields($id: ID!) {
          product(id: $id) { metafields(first: 250) { edges { node { namespace key value } } } }
        }
      `, { variables: { id: productGid } });
      
      const readBackData = await readBackResponse.json();
      const newMetaList = readBackData?.data?.product?.metafields?.edges || [];
      const newMetafields = {};
      newMetaList.forEach(e => { newMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value; });

      let readBackVerified = true;
      const conflicts = {};

      setToShopify.forEach(m => {
         const dotKey = `${m.namespace}.${m.key}`;
         const actual = newMetafields[dotKey];
         let expStr = String(m.value).trim();
         let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();
         
         if (m.type === "number_decimal") {
             if (parseFloat(expStr) !== parseFloat(actStr)) {
                 readBackVerified = false;
                 conflicts[dotKey] = { expected: expStr, actual: actStr };
             }
         } else {
             if (expStr !== actStr) {
                 readBackVerified = false;
                 conflicts[dotKey] = { expected: expStr, actual: actStr };
             }
         }
      });

      if (!readBackVerified) {
           return Response.json({
             intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
             fieldsUpdated: setToShopify.length, legacyKeysRemoved: deleteFromShopify.length,
             message: "Repair failed: Read-back verification detected conflicts.",
             currentMetafields, repairPlan, proposedChanges, conflicts, missingFields: [], unknownFields: [], readBackVerified: false
          });
      }

      return Response.json({ 
        intent: "executeRepairPlan", pieceId, success: true, status: "REPAIRED",
        fieldsUpdated: setToShopify.length, legacyKeysRemoved: deleteFromShopify.length,
        message: `Repair successful: ${setToShopify.length} fields updated, ${deleteFromShopify.length} legacy keys cleared.`,
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
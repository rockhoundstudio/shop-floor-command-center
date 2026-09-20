import { data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractStoneName(title) {
  if (!title) return "Unknown";
  
  let sectionOne = title.split(/[—–-]/)[0].trim();
  
  const adjectives = [
    "Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White", "Grey", "Gray", "Brown",
    "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume", "Moss", "Dendritic", "Banded", "Polychrome",
    "Imperial", "Royal", "Dark", "Light", "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled",
    "Polished", "Natural", "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"
  ];

  let words = sectionOne.split(/\s+/);
  words = words.filter(word => !adjectives.some(adj => adj.toLowerCase() === word.toLowerCase()));

  if (words.length > 0) {
    let baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }

  return "Unknown";
}

function normalizeMetafieldValue(key, value) {
  let val = String(value);

  if (val.startsWith("⚠️ ")) {
    val = val.replace(/^⚠️\s*/, "");
  }

  const booleanKeys = [
    "is_ooak", "found_object", 
    "custom_product", "setting_ready", "bail_included", "treated"
  ];
  if (booleanKeys.includes(key)) {
    if (val.toLowerCase() === "true") val = "Yes";
    else if (val.toLowerCase() === "false") val = "No";
  }

  return val;
}

function applyOriginOverridesBeforeApi(title, metafieldsArray) {
  let newMetafields = [...(metafieldsArray || [])];

  newMetafields = newMetafields.filter(m => m.key !== "origin_handle" && m.key !== "origin_page_handle");

  if (title && typeof title === "string") {
    const segments = title.split(/\s*—\s*/);
    if (segments.length >= 3) {
      const middleSegment = segments[1].trim();
      let overrideHandle = null;

      if (middleSegment === "Richardson's Rock Ranch") {
        overrideHandle = "the-richardson-strike";
      } else if (middleSegment === "Yakima River Canyon" || middleSegment === "Yakima Canyon") {
        overrideHandle = "the-shop-lore-chert-road-detour-yakima-river-jasper";
      } else if (middleSegment === "Yellowstone River" || middleSegment === "Seven Sisters") {
        overrideHandle = "the-yellowstone-river";
      } else if (middleSegment === "Rufus" || middleSegment === "Rufus Serpentine") {
        overrideHandle = "the-rufus-protocol";
      } else if (middleSegment === "Nickel Back") {
        overrideHandle = "the-nickel-back-collection";
      } else if (middleSegment === "North Fork CdA") {
        overrideHandle = "north-fork-cda-collection";
      } else if (middleSegment === "Spokane River" || middleSegment === "Stateline") {
        overrideHandle = "spokane-river-stateline";
      } else if (middleSegment === "Irv's Rock and Jewelry" || middleSegment === "Irv's") {
        overrideHandle = "the-shopped-rock";
      }

      if (overrideHandle) {
        const ownerId = metafieldsArray.length > 0 ? metafieldsArray[0].ownerId : null;
        if (ownerId) {
          newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_handle", type: "single_line_text_field", value: overrideHandle });
          newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_page_handle", type: "single_line_text_field", value: overrideHandle });
        }
      }
    }
  }

  return newMetafields;
}

function sanitizeDescription(html) {
  if (!html || typeof html !== "string") return html;
  let safeHtml = html;
  
  const targets = [
    "/pages/the-shopped-rock",
    "/collections/the-shopped-rock",
    "/pages/the-shocked-rock",
    "/collections/the-shocked-rock"
  ];
  
  for (const target of targets) {
    const regexNormal = new RegExp(`<a[^>]*href=["']?[^"'>]*${target.replace(/\//g, '\\/')}["']?[^>]*>.*?<\\/a>`, 'gi');
    safeHtml = safeHtml.replace(regexNormal, "");
    
    const regexEscaped = new RegExp(`&lt;a[^&]*href=[&quot;']?[^&quot;'>]*${target.replace(/\//g, '\\/')}[&quot;']?[^&]*&gt;.*?&lt;\\/a&gt;`, 'gi');
    safeHtml = safeHtml.replace(regexEscaped, "");
  }
  
  return safeHtml;
}

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field",
  origin_location: "single_line_text_field",
  geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field",
  official_name: "single_line_text_field",
  luster: "single_line_text_field",
  specific_gravity: "single_line_text_field",
  fracture_pattern: "single_line_text_field",
  cleavage: "single_line_text_field",
  tenacity: "single_line_text_field",
  primary_color: "single_line_text_field",
  diaphaneity: "single_line_text_field",
  character_marks: "single_line_text_field",
  dimensions_mm: "single_line_text_field",
  cut_type: "single_line_text_field",
  bench_notes: "multi_line_text_field",
  stone_shape: "single_line_text_field",
  surface_finish: "single_line_text_field",
  treatment_status: "single_line_text_field",
  secondary_colors: "single_line_text_field",
  base_stone_type: "single_line_text_field",
  hardness: "single_line_text_field",
  primary_medium: "single_line_text_field",
  piece_name: "single_line_text_field",
  stone_family: "single_line_text_field",
  collection_name: "single_line_text_field",
  collection_location: "single_line_text_field",
  origin_handle: "single_line_text_field",
  origin_page_handle: "single_line_text_field",
  cut_and_shape: "single_line_text_field",
  primary_use: "single_line_text_field",
  handcrafted_by: "single_line_text_field",
  alt_text: "single_line_text_field",
  is_ooak: "single_line_text_field",
  found_object: "single_line_text_field",
  custom_product: "single_line_text_field",
  color: "single_line_text_field",
  setting_ready: "single_line_text_field",
  bail_included: "single_line_text_field",
  wire_material: "single_line_text_field",
  chain_material: "single_line_text_field",
  seo_title: "single_line_text_field",
  secondary_medium: "single_line_text_field",
  treated: "single_line_text_field",
  weight_grams: "number_decimal",
  shipping_weight_oz: "number_decimal",
  price: "number_decimal",
  origin_story: "multi_line_text_field",
  honest_flaws: "single_line_text_field",
  honest_flaws_and_character: "multi_line_text_field",
  generated_description: "multi_line_text_field",
  artist_notes: "multi_line_text_field",
  color_pattern: "list.metaobject_reference",
  "color-pattern": "list.metaobject_reference",
  material: "metaobject_reference",
  jewelry_material: "metaobject_reference",
  "jewelry-material": "metaobject_reference",
  age_group: "metaobject_reference",
  "age-group": "metaobject_reference",
  jewelry_type: "metaobject_reference",
  "jewelry-type": "metaobject_reference",
  target_gender: "metaobject_reference",
  "target-gender": "metaobject_reference",
  necklace_design: "metaobject_reference",
  "necklace-design": "metaobject_reference",
  authenticity: "metaobject_reference",
  rarity: "metaobject_reference",
  condition: "metaobject_reference",
  crystal_system: "metaobject_reference",
  "crystal-system": "metaobject_reference",
  mineral_class: "metaobject_reference",
  "mineral-class": "metaobject_reference",
  geological_era: "metaobject_reference",
  "geological-era": "metaobject_reference",
  rock_composition: "metaobject_reference",
  "rock-composition": "metaobject_reference",
  rock_formation: "metaobject_reference",
  "rock-formation": "metaobject_reference",
  chain_link_type: "metaobject_reference",
  "chain-link-type": "metaobject_reference",
  jewelry_finding_type: "metaobject_reference",
  "jewelry-finding-type": "metaobject_reference",
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

async function executeGhostDelete(admin, productGid) {
  try {
    const lookupResponse = await admin.graphql(
      `#graphql
      query getMetafields($ownerId: ID!) {
        product(id: $ownerId) { metafields(first: 250) { edges { node { id namespace key } } } }
      }`,
      { variables: { ownerId: productGid } }
    );
    const lookupResult = await lookupResponse.json();
    const allMeta = lookupResult?.data?.product?.metafields?.edges || [];

    const ghostKeys = [
      "stone_story", "story_theme", "rock_formation", "geological_era",
      "crystal_system", "mineral_class", "rock_composition", "is_one_of_a_kind",
      "chain_material", "pattern"
    ];
    const isCamelCase = (str) => /[a-z][A-Z]/.test(str);
    const safeNamespaces = ["shopify", "judgeme", "mm-google-shopping", "mc-facebook"];

    const toDelete = allMeta.map(e => e.node).filter(m => {
      if (safeNamespaces.includes(m.namespace) || m.namespace.startsWith("app-")) return false;
      
      if (m.namespace === "custom") {
        if (ghostKeys.includes(m.key)) return true;
        if (isCamelCase(m.key)) return true;
      }
      return false;
    });

    if (toDelete.length > 0) {
      await admin.graphql(
        `#graphql
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
        }`,
        { variables: { metafields: toDelete.map(m => ({ ownerId: productGid, namespace: m.namespace, key: m.key })) } }
      );
    }
  } catch (err) {
    console.error("Ghost delete error:", err);
  }
}

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const rawFormData = await request.formData();

  const formData = new FormData();
  for (const [key, value] of rawFormData.entries()) {
    formData.append(key, value);
  }

  let intent = formData.get("intent");

  // ==========================================
  // SHARED AI ENGINE PASS-THROUGH
  // Seamlessly catches AI intents and hands them to the server utility
  // ==========================================
  if (
    intent === "tab2AutoFill" || 
    intent === "fullRescan" || 
    intent === "visionScan" || 
    intent === "generateDescription" || 
    intent === "geoLookup" || 
    intent === "titleParse"
  ) {
    const autofillResult = await executeAutofill(intent, formData, admin);
    return data(autofillResult);
  }

  if (intent === "auto_fill_single") {
    const title = formData.get("title");
    const stoneName = extractStoneName(title);

    if (stoneName === "Unknown") {
      return data({ success: false, message: "Could not auto-detect stone type from title. Manual entry required.", fields: {} });
    }

    try {
      let cachedStone = await prisma.stoneCache.findUnique({ where: { stoneName: stoneName } });

      if (!cachedStone) {
        let mohsVal = "Varies";
        (stoneName === "Jasper" || stoneName === "Agate") && (mohsVal = "6.5 - 7");

        const titleSegments = (title || "").split(/\s+[—–-]\s+/);
        const pieceName = titleSegments.length >= 3 ? titleSegments[titleSegments.length - 1].trim() : "";
        const lapidaryData = {
          "mineral_class": "Silicate",
          "mohs_hardness": mohsVal,
          "crystal_system": "Trigonal",
          "primary_color": "Varies by specimen",
          "title_tag": `${stoneName}${pieceName ? ` — ${pieceName}` : ""} — One-of-a-Kind Rockhound Studio`,
          "description_tag": `Natural, one-of-a-kind ${stoneName} handcrafted by Bob and Janyce. Honest flaws, authentic character, and zero workshop fluff.`,
          "google_product_category": "Apparel & Accessories > Jewelry",
          "target_gender": "Unisex",
          "age_group": "adult",
          "condition": "new",
          "geological_age": "Varies by specimen",
          "fracture_pattern": "Varies by specimen",
          "luster": "Varies by specimen",
          "fracture": "Varies by specimen",
          "cleavage": "None",
          "specific_gravity": "Varies by specimen",
          "diaphaneity": "Opaque to Translucent",
          "rock_composition": "Silicified",
          "rock_formation": "Natural"
        };

        cachedStone = await prisma.stoneCache.create({
          data: { stoneName: stoneName, data: JSON.stringify(lapidaryData) }
        });
      }

      return data({ success: true, message: `Loaded data for ${stoneName} from database.`, fields: JSON.parse(cachedStone.data) });
    } catch (error) {
      return data({ success: false, message: "Database connection failed." }, { status: 500 });
    }
  }

  // ==========================================
  // TAB 3: LIVE REPAIR ENGINE
  // Executes the diagnostic manifest generated by the Operations Matrix
  // ==========================================
  if (intent === "executeRepairPlan") {
    try {
      const pieceId = formData.get("pieceId");
      const rawManifest = formData.get("manifest");
      
      if (!pieceId || !rawManifest) {
        return data({ intent: "executeRepairPlan", success: false, message: "Missing pieceId or manifest payload." });
      }

      const manifest = JSON.parse(rawManifest);
      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      const setToShopify = [];
      const deleteFromShopify = [];

      // 1. Parse Manifest
      manifest.forEach(item => {
        if (item.class === "COPY TO CANONICAL KEY" || item.class === "NORMALIZE VALUE") {
          let resolvedType = MASTER_TYPE_MAP[item.propKey] || "single_line_text_field";
          let resolvedValue = String(item.propVal);

          if (resolvedType.startsWith("list.") && !resolvedValue.startsWith("[")) {
             resolvedValue = JSON.stringify([resolvedValue]);
          }

          setToShopify.push({
            ownerId: productGid,
            namespace: "custom",
            key: item.propKey,
            type: resolvedType,
            value: resolvedValue
          });
        }

        if (item.class === "REMOVE AFTER VERIFICATION") {
          deleteFromShopify.push({
            ownerId: productGid,
            namespace: "custom",
            key: item.key
          });
        }
      });

      const allErrors = [];

      // 2. Delete Legacy/Duplicate Keys First
      if (deleteFromShopify.length > 0) {
        const chunks = chunkArray(deleteFromShopify, 250);
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
            if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) {
              allErrors.push(...deleteJson.data.metafieldsDelete.userErrors);
            }
          } catch (delErr) {
            allErrors.push({ message: `API Throttle/Error on Delete: ${delErr.message}` });
          }
          // The Governor: 800ms delay between chunks to prevent throttling
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
        }
      }

      // 3. Write Canonical Keys / Normalized Values
      if (setToShopify.length > 0) {
        const uniqueSet = new Map();
        setToShopify.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        const finalSet = Array.from(uniqueSet.values());

        const chunks = chunkArray(finalSet, 25);
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
            }
          } catch (setErr) {
            allErrors.push({ message: `API Throttle/Error on Set: ${setErr.message}` });
          }
          // The Governor: 800ms delay between chunks to prevent throttling
          if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 800));
        }
      }

      if (allErrors.length > 0) {
         return data({ intent: "executeRepairPlan", success: false, pieceId, errors: allErrors });
      }

      return data({ 
        intent: "executeRepairPlan", 
        success: true, 
        pieceId, 
        message: `Repair successful: ${setToShopify.length} fields updated, ${deleteFromShopify.length} legacy keys removed.` 
      });

    } catch (error) {
      return data({ intent: "executeRepairPlan", success: false, pieceId: formData.get("pieceId"), error: error.message });
    }
  }

  // ==========================================
  // TAB 3: BATCH ORCHESTRATOR PIPELINE
  // ==========================================
  if (intent === "batchAuditItem") {
    try {
      const pieceId = formData.get("pieceId");
      const runMode = formData.get("runMode"); // "DRY_RUN" or "LIVE_RUN"
      const explicitConfirm = formData.get("explicitConfirm");
      
      if (runMode === "LIVE_RUN" && explicitConfirm !== "true") {
         return data({
           intent: "batchAuditItem",
           success: false,
           pieceId,
           finalStatus: "Failed",
           logs: ["Server rejected LIVE_RUN: Missing explicit confirmation token."]
         });
      }

      // 1. Fetch the raw Shopify product to get the title and legacy data
      const productQuery = await admin.graphql(`
        query getProduct($id: ID!) {
          product(id: $id) {
            title
            handle
            descriptionHtml
            media(first: 1) { edges { node { ... on MediaImage { image { url } } } } }
          }
        }
      `, { variables: { id: pieceId } });
      
      const productData = await productQuery.json();
      const product = productData?.data?.product;
      
      if (!product) {
         return data({
           intent: "batchAuditItem",
           success: false,
           pieceId,
           finalStatus: "Failed",
           logs: ["Shopify product not found."]
         });
      }

      // 2. Build the fake FormData required by the executeAutofill engine
      const autoFillBody = new FormData();
      autoFillBody.append("intent", "visionScan");
      autoFillBody.append("pieceId", pieceId);
      autoFillBody.append("productTitle", product.title);
      autoFillBody.append("imageUrl", product.media?.edges?.[0]?.node?.image?.url || "");

      // 3. Run the AI Autofill Brain
      const autofillResult = await executeAutofill("visionScan", autoFillBody, admin);

      if (!autofillResult.success) {
         return data({
           intent: "batchAuditItem",
           success: false,
           pieceId,
           finalStatus: "Failed",
           logs: [`Autofill engine failed: ${autofillResult.error}`]
         });
      }

      // 4. Run Strict Validation on the Output
      const payload = autofillResult.tab2Data;
      let validationLogs = ["Autofill scan complete."];
      let isValid = true;

      if (!payload.piece_name || !payload.stone_family || !payload.origin_location) {
          validationLogs.push("Validation Failed: Missing critical title segments.");
          isValid = false;
      }
      
      if (payload.origin_location && payload.origin_location.toLowerCase().includes("irv")) {
          validationLogs.push("Validation Failed: Deleted 'Shopped Rock' link detected.");
          isValid = false;
      }

      if (!isValid) {
         return data({
           intent: "batchAuditItem",
           success: false,
           pieceId,
           finalStatus: "Needs Review",
           logs: validationLogs
         });
      }

      if (runMode === "DRY_RUN") {
         validationLogs.push("Dry Run complete. Validation passed. No data saved.");
         return data({
           intent: "batchAuditItem",
           success: true,
           pieceId,
           finalStatus: "Validated",
           logs: validationLogs
         });
      }

      // 5. LIVE RUN: Compile the payload and feed it directly into the saveMetafields logic below
      validationLogs.push("Live Run: Payload verified. Routing to save module.");

      const savePayloadArray = Object.keys(payload).map(key => ({
         ownerId: pieceId,
         key: key,
         value: payload[key]
      }));

      // Set flags to fall through to the save logic
      formData.set("isBatchRun", "true");
      formData.set("payload", JSON.stringify(savePayloadArray));
      formData.set("productId", pieceId);
      if (payload.generated_description) {
          formData.set("descriptionHtml", payload.generated_description);
        }
      if (payload.weight_grams) {
          formData.set("weightGrams", payload.weight_grams);
      }
      if (payload.shipping_weight_oz) {
          formData.set("shippingWeightOz", payload.shipping_weight_oz);
      }
      
      intent = "saveMetafields"; // FALL THROUGH TO SAVE BLOCK

    } catch (error) {
      console.error("[BatchOrchestrator] Crash:", error);
      return data({
        intent: "batchAuditItem",
        success: false,
        pieceId: formData.get("pieceId"),
        finalStatus: "Failed",
        logs: [`Server crash: ${error.message}`]
      });
    }
  }

  // ==========================================
  // MASTER SAVE BLOCK (Used by Tab 1, 2, and 3)
  // ==========================================
  if (intent === "saveMetafields") {
    try {
      const allErrors = [];
      const rawPayload = formData.get("payload") || formData.get("metafields");
      const directWeightGrams = formData.get("weightGrams");
      const directShippingWeightOz = formData.get("shippingWeightOz");
      const fallbackProductId = formData.get("productId");
      
      let payloadArray = [];
      try {
        if (rawPayload) payloadArray = JSON.parse(rawPayload);
      } catch (e) {
        payloadArray = [];
      }

      let finalDescriptionHtml = sanitizeDescription(formData.get("descriptionHtml"));
      if (!finalDescriptionHtml && payloadArray.length > 0) {
        const genDescItem = payloadArray.find(p => p.key === "generated_description");
        if (genDescItem && genDescItem.value) {
          finalDescriptionHtml = sanitizeDescription(String(genDescItem.value));
        }
      }

      if (!rawPayload && !directWeightGrams && !fallbackProductId) {
        return data({ intent: "saveMetafields", success: false, message: "No data provided to save." });
      }

      if (directWeightGrams && !payloadArray.some(p => p.key === "weight_grams")) {
        payloadArray.push({
          ownerId: fallbackProductId,
          namespace: "custom",
          key: "weight_grams",
          type: "number_decimal",
          value: String(directWeightGrams)
        });
      }

      if (directShippingWeightOz && !payloadArray.some(p => p.key === "shipping_weight_oz")) {
        payloadArray.push({
          ownerId: fallbackProductId,
          namespace: "custom",
          key: "shipping_weight_oz",
          type: "number_decimal",
          value: String(directShippingWeightOz)
        });
      }

      const finalShippingOz = directShippingWeightOz || payloadArray.find(item => item.key === "shipping_weight_oz")?.value;
      
      const altTextItem = payloadArray.find(item => item.key === "alt_text");
      const altTextValue = altTextItem ? String(altTextItem.value).trim() : null;

      const explicitBlanks = [];

      let setMetafields = payloadArray.flatMap(item => {
        const itemOwnerId = item.ownerId || fallbackProductId;
        if (!itemOwnerId) return [];

        let resolvedId = itemOwnerId.startsWith("gid://") ? itemOwnerId : `gid://shopify/Product/${itemOwnerId.split("/").pop()}`;
        
        let resolvedNamespace = item.namespace || "custom";
        if (item.key === "is_ooak" || resolvedNamespace === "none" || resolvedNamespace === "") {
          resolvedNamespace = "custom";
        }

        const valStr = String(item.value).trim();
        
        if (valStr === "" || valStr.toLowerCase() === "none" || valStr.toLowerCase() === "n/a" || valStr.toLowerCase() === "null" || valStr.toLowerCase() === "undefined") {
          explicitBlanks.push({ ownerId: resolvedId, namespace: resolvedNamespace, key: item.key });
          
          const standardKey = item.key.replace(/_/g, '-');
          if (EXPLICIT_METAOBJECT_KEYS.includes(standardKey) || EXPLICIT_METAOBJECT_KEYS.includes(item.key)) {
             explicitBlanks.push({ ownerId: resolvedId, namespace: "shopify", key: standardKey });
          }
          return [];
        }

        const multiLineKeys = ["origin_story", "artist_notes", "honest_flaws_and_character", "bench_notes", "generated_description"];
        const decimalKeys = ["weight_grams", "shipping_weight_oz", "price"];
        const listSingleLineKeys = ["character_marks"];

        if (item.key === "generated_description") {
          item.value = sanitizeDescription(valStr);
        }

        let normalizedValue = normalizeMetafieldValue(item.key, item.value);
        let resolvedValue = normalizedValue;
        let resolvedType = MASTER_TYPE_MAP[item.key] || "single_line_text_field";

        if (multiLineKeys.includes(item.key)) {
          resolvedType = "multi_line_text_field";
        } else if (decimalKeys.includes(item.key)) {
          resolvedType = "number_decimal";
        } else if (listSingleLineKeys.includes(item.key)) {
          resolvedType = "list.single_line_text_field";
        }

        if (resolvedType === "multi_line_text_field") {
          if (resolvedValue.length > 10000) resolvedValue = resolvedValue.slice(0, 10000);
        } else if (resolvedType === "number_decimal") {
          const parsedNum = parseFloat(String(normalizedValue).replace(/[^0-9.-]/g, ""));
          resolvedValue = isNaN(parsedNum) ? "0.0" : (parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum));
        } else if (resolvedType.startsWith("list.")) {
          resolvedValue = JSON.stringify([String(normalizedValue).trim()]);
        } else if (resolvedType.includes("metaobject_reference")) {
          if (!String(resolvedValue).startsWith("gid://")) {
            resolvedType = "single_line_text_field";
          }
        } else {
          if (resolvedValue.length > 255) resolvedValue = resolvedValue.slice(0, 255);
        }

        const fieldsToReturn = [];

        if (item.key === "seo_title") {
          fieldsToReturn.push({ ownerId: resolvedId, namespace: "global", key: "title_tag", type: "single_line_text_field", value: resolvedValue });
          fieldsToReturn.push({ ownerId: resolvedId, namespace: "custom", key: "seo_title", type: "single_line_text_field", value: resolvedValue });
        } else if (item.key === "generated_description") {
          fieldsToReturn.push({ ownerId: resolvedId, namespace: "global", key: "description_tag", type: "single_line_text_field", value: resolvedValue.slice(0, 320) });
          fieldsToReturn.push({ ownerId: resolvedId, namespace: resolvedNamespace, key: item.key, type: resolvedType, value: resolvedValue });
        } else if (["age_group", "target_gender", "condition"].includes(item.key)) {
          fieldsToReturn.push({ ownerId: resolvedId, namespace: "google", key: item.key, type: "single_line_text_field", value: resolvedValue });
        } else {
          fieldsToReturn.push({ ownerId: resolvedId, namespace: resolvedNamespace, key: item.key, type: resolvedType, value: resolvedValue });
        }

        return fieldsToReturn;
      });

      const productTitle = formData.get("productTitle") || formData.get("title");
      if (productTitle) {
        setMetafields = applyOriginOverridesBeforeApi(productTitle, setMetafields);
      }

      if (explicitBlanks.length > 0) {
        const chunks = chunkArray(explicitBlanks, 250);
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
            if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) {
              allErrors.push(...deleteJson.data.metafieldsDelete.userErrors);
            }
          } catch (err) {
            allErrors.push({ message: `Delete blanks error: ${err.message}` });
          }
        }
      }

      if (setMetafields.length > 0) {
        const uniqueSet = new Map();
        setMetafields.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        setMetafields = Array.from(uniqueSet.values());

        const chunks = chunkArray(setMetafields, 25);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const response = await admin.graphql(
              `#graphql
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) { userErrors { field message } }
              }`,
              { variables: { metafields: chunks[i] } }
            );
            const result = await response.json();
            const batchErrors = result?.data?.metafieldsSet?.userErrors || [];
            if (batchErrors.length > 0) allErrors.push(...batchErrors);
          } catch (err) {
            allErrors.push({ message: `Metafields set error: ${err.message}` });
          }
        }
      }

      const newProductTitle = formData.get("productTitle") || formData.get("title");
      const seoItem = payloadArray.find(p => p.key === "seo_title");
      const seoTitleValue = seoItem ? String(seoItem.value).trim() : null;

      let primaryProductId = fallbackProductId;
      if (!primaryProductId && payloadArray.length > 0) {
        primaryProductId = payloadArray[0].ownerId;
      }

      if (primaryProductId) {
        try {
          const productGid = primaryProductId.startsWith("gid://") ? primaryProductId : `gid://shopify/Product/${primaryProductId.split("/").pop()}`;
          let inputVars = { id: productGid };
          let hasUpdates = false;

          if (newProductTitle) { inputVars.title = newProductTitle; hasUpdates = true; }
          
          if (finalDescriptionHtml !== null && finalDescriptionHtml !== undefined) { 
            inputVars.descriptionHtml = finalDescriptionHtml; 
            hasUpdates = true; 
          }
          if (seoTitleValue) { inputVars.seo = { title: seoTitleValue }; hasUpdates = true; }

          if (hasUpdates) {
            const updateResponse = await admin.graphql(
              `#graphql
              mutation productUpdate($input: ProductInput!) {
                productUpdate(input: $input) { userErrors { field message } }
              }`,
              { variables: { input: inputVars } }
            );
            const updateJson = await updateResponse.json();
            if (updateJson?.data?.productUpdate?.userErrors?.length) {
              allErrors.push(...updateJson.data.productUpdate.userErrors);
            }
          }

          await executeGhostDelete(admin, productGid);
        } catch (err) {
          allErrors.push({ message: `Base update or ghost kill error: ${err.message}` });
        }
      }

      // --- IMAGE ALT-TEXT PIPELINE ---
      if (altTextValue && altTextValue.toLowerCase() !== "none" && altTextValue.toLowerCase() !== "n/a" && primaryProductId) {
        try {
          const productGid = primaryProductId.startsWith("gid://") ? primaryProductId : `gid://shopify/Product/${primaryProductId.split("/").pop()}`;
          
          const mediaQuery = await admin.graphql(
            `#graphql
            query getProductMedia($id: ID!) {
              product(id: $id) { media(first: 10) { edges { node { id mediaContentType } } } }
            }`,
            { variables: { id: productGid } }
          );
          const mediaData = await mediaQuery.json();
          const mediaEdges = mediaData?.data?.product?.media?.edges || [];
          
          const mediaToUpdate = mediaEdges
            .filter(edge => edge.node.mediaContentType === "IMAGE")
            .map(edge => ({
              id: edge.node.id,
              alt: altTextValue
            }));

          if (mediaToUpdate.length > 0) {
            const mediaUpdateResponse = await admin.graphql(
              `#graphql
              mutation updateProductMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
                productUpdateMedia(productId: $productId, media: $media) {
                  userErrors { field message }
                }
              }`,
              { variables: { productId: productGid, media: mediaToUpdate } }
            );
            const mediaUpdateJson = await mediaUpdateResponse.json();
            const mediaErrors = mediaUpdateJson?.data?.productUpdateMedia?.userErrors || [];
            if (mediaErrors.length > 0) {
              allErrors.push(...mediaErrors);
            }
          }
        } catch (mediaErr) {
          allErrors.push({ message: `Image Alt Text update failed: ${mediaErr.message}` });
        }
      }

      // --- INVENTORY WEIGHT UPDATE ---
      if (finalShippingOz && fallbackProductId) {
        const parsedOz = parseFloat(String(finalShippingOz));
        if (!isNaN(parsedOz) && parsedOz >= 0) {
          try {
            const productGid = fallbackProductId.startsWith("gid://") ? fallbackProductId : `gid://shopify/Product/${fallbackProductId.split("/").pop()}`;
            const variantQuery = await admin.graphql(
              `#graphql
              query getDefaultVariant($id: ID!) {
                product(id: $id) { variants(first: 1) { edges { node { id inventoryItem { id } } } } }
              }`,
              { variables: { id: productGid } }
            );
            const variantData = await variantQuery.json();
            const inventoryItemId = variantData?.data?.product?.variants?.edges?.[0]?.node?.inventoryItem?.id;
            
            if (inventoryItemId) {
              const weightResponse = await admin.graphql(
                `#graphql
                mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                  inventoryItemUpdate(id: $id, input: $input) { userErrors { field message } }
                }`,
                { variables: { id: inventoryItemId, input: { measurement: { weight: { value: parsedOz, unit: "OUNCES" } } } } }
              );
              const weightJson = await weightResponse.json();
              if (weightJson?.data?.inventoryItemUpdate?.userErrors?.length) {
                allErrors.push(...weightJson.data.inventoryItemUpdate.userErrors);
              }
            }
          } catch (weightErr) {
            allErrors.push({ message: `Variant weight update failed: ${weightErr.message}` });
          }
        }
      }

      const finalReturnIntent = formData.get("isBatchRun") === "true" ? "batchAuditItem" : "saveMetafields";

      if (allErrors.length > 0) {
        return data({ intent: finalReturnIntent, success: false, pieceId: fallbackProductId, message: "Saved with errors.", errors: allErrors });
      }

      return data({ intent: finalReturnIntent, success: true, pieceId: fallbackProductId, message: "All metafields, alt text, description, and variant weights locked in.", writtenCount: setMetafields.length });
    } catch (error) {
      const errIntent = formData.get("isBatchRun") === "true" ? "batchAuditItem" : "saveMetafields";
      return data({ intent: errIntent, success: false, pieceId: formData.get("productId"), error: error.message });
    }
  }

  if (intent === "cleanMalformedKeys") {
    const productId = formData.get("productId");
    if (!productId) return data({ success: false, message: "No productId provided." });

    let resolvedId = `gid://shopify/Product/${productId}`;
    if (productId.startsWith("gid://")) resolvedId = productId;

    const lookupResponse = await admin.graphql(
      `#graphql
      query getMetafields($ownerId: ID!) {
        product(id: $ownerId) { metafields(first: 250) { edges { node { id namespace key } } } }
      } `,
      { variables: { ownerId: resolvedId } }
    );

    const lookupResult = await lookupResponse.json();
    const allMeta = lookupResult?.data?.product?.metafields?.edges || [];
    const malformedKeys = ["cut_type", "crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "mohsHardness", "stone_story"];
    
    const toDelete = allMeta.map(e => e.node).filter(m => malformedKeys.includes(m.key));
    if (toDelete.length === 0) return data({ success: true, message: "No malformed keys found. Already clean." });

    const deleteResponse = await admin.graphql(
      `#graphql
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
      } `,
      { variables: { metafields: toDelete.map(m => ({ ownerId: resolvedId, namespace: m.namespace, key: m.key })) } }
    );

    const deleteResult = await deleteResponse.json();
    const deleteErrors = deleteResult?.data?.metafieldsDelete?.userErrors || [];
    const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];

    if (deleteErrors.length > 0) return data({ success: false, message: "Delete had errors.", errors: deleteErrors });
    return data({ success: true, message: `Cleaned ${deleted.length} malformed metafield(s). Re-save the product to write them correctly.`, deleted });
  }

  if (intent === "cleanAllCamelKeys") {
    try {
      let hasNextPage = true;
      let cursor = null;
      let totalScanned = 0;
      let totalDeleted = 0;

      const customCamelKeys = ["cut_type", "crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "mohsHardness", "hardness", "fracture", "stone_story"];

      while (hasNextPage) {
        const productsResponse = await admin.graphql(
          `#graphql
          query getProductsMetafields($cursor: String) {
            products(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges { node { id metafields(first: 250) { edges { node { id namespace key } } } } }
            }
          }`,
          { variables: { cursor } }
        );

        const productsResult = await productsResponse.json();
        const products = productsResult?.data?.products?.edges || [];

        for (const productEdge of products) {
          totalScanned++;
          const productNode = productEdge.node;
          const allMeta = productNode.metafields?.edges || [];
          
          const toDelete = allMeta.map(e => e.node).filter(m => {
            if (["geo", "rockhound"].includes(m.namespace)) return true;
            if (m.namespace === "custom") {
              if (["weight_grams", "shipping_weight_oz"].includes(m.key)) return false;
              if (customCamelKeys.includes(m.key)) return true;
              if (m.key.includes("-")) return true;
            }
            return false;
          });

          if (toDelete.length > 0) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                  metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } }
                }`,
                { variables: { metafields: toDelete.map(m => ({ ownerId: productNode.id, namespace: m.namespace, key: m.key })) } }
              );
              const deleteResult = await deleteResponse.json();
              totalDeleted += (deleteResult?.data?.metafieldsDelete?.deletedMetafields || []).length;
            } catch (errors) {}
          }
        }

        hasNextPage = productsResult?.data?.products?.pageInfo?.hasNextPage;
        cursor = productsResult?.data?.products?.pageInfo?.endCursor;
        if (hasNextPage) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return data({ success: true, message: `Nuclear sweep complete. Scanned ${totalScanned} products, deleted ${totalDeleted} ghost metafields.` });
    } catch (error) {
      return data({ success: false, message: "Bulk clean failed", error: error.message });
    }
  }

  if (intent === "stagedUpload") {
    try {
      const file = formData.get("file_0");
      const pieceId = formData.get("pieceId");
      const scanToken = formData.get("scanToken");

      if (!file || !(file instanceof File)) return data({ success: false, intent: "stagedUpload", error: "Missing file_0 binary payload." });

      const uploadResponse = await admin.graphql(
        `#graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets { url resourceUrl parameters { name value } }
            userErrors { field message }
          }
        }`,
        { variables: { input: [{ resource: "IMAGE", filename: file.name || `upload_${Date.now()}.jpg`, mimeType: file.type || "image/jpeg", fileSize: String(file.size), httpMethod: "POST" }] } }
      );

      const uploadResult = await uploadResponse.json();
      const userErrors = uploadResult?.data?.stagedUploadsCreate?.userErrors || [];
      if (userErrors.length > 0) return data({ success: false, intent: "stagedUpload", error: userErrors.map(e => e.message).join(", ") });

      const stagedTargets = uploadResult?.data?.stagedUploadsCreate?.stagedTargets;
      if (!stagedTargets || stagedTargets.length === 0) return data({ success: false, intent: "stagedUpload", error: "No upload target returned from Shopify." });

      const target = stagedTargets[0];
      const s3FormData = new FormData();
      target.parameters.forEach((param) => s3FormData.append(param.name, param.value));

      const arrayBuffer = await file.arrayBuffer();
      const fileBlob = new Blob([arrayBuffer], { type: file.type || "image/jpeg" });
      s3FormData.append("file", fileBlob, file.name || `upload_${Date.now()}.jpg`);

      const s3Response = await fetch(target.url, { method: "POST", body: s3FormData });
      if (!s3Response.ok) return data({ success: false, intent: "stagedUpload", error: `S3 upload failed.` });

      return data({ success: true, intent: "stagedUpload", resourceUrl: target.resourceUrl, pieceId: pieceId, scanToken: scanToken });
    } catch (error) {
      return data({ success: false, intent: "stagedUpload", error: error.message });
    }
  }

  if (intent === "createProduct") {
    try {
      const rawPayload = formData.get("payload");
      if (!rawPayload) return data({ success: false, intent: "createProduct", error: "Missing JSON payload." });

      const payload = JSON.parse(rawPayload);
      let piece = {};
      (payload.pieces && payload.pieces.length > 0) && (piece = payload.pieces[0]);

      const stoneFamily = payload.stone_family || "Unknown Stone";
      const pieceName = piece.piece_name || payload.piece_name || "New Piece";
      const originLocation = payload.collection_name ? payload.collection_name.replace(/\s+Collection$/i, "").trim() : (payload.origin_location || "Unknown Origin");

      const title = payload.title && !payload.title.includes("Unknown") ? payload.title : `${stoneFamily} — ${originLocation} — ${pieceName}`;
      
      const descriptionHtmlRaw = payload.descriptionHtml || payload.generated_description || "";
      const descriptionHtml = sanitizeDescription(descriptionHtmlRaw);
      
      const price = String(payload.price || piece.price || "0.00");
      const productType = payload.productType || "Wearable Art";
      const status = payload.status || "DRAFT";

      const allUserErrors = [];
      const seoTitle = payload.seo_title || `${stoneFamily} — ${pieceName} — One-of-a-Kind Rockhound Studio`;

      const createResponse = await admin.graphql(
        `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id handle variants(first: 1) { edges { node { id inventoryItem { id } } } } }
            userErrors { field message }
          }
        }`,
        { variables: { input: { 
            title, 
            descriptionHtml: descriptionHtml, 
            productType, 
            status,
            seo: { title: seoTitle }
        } } }
      );

      const createResult = await createResponse.json();
      const createErrors = createResult?.data?.productCreate?.userErrors || [];
      (createErrors.length > 0) && allUserErrors.push(...createErrors);

      const createdProduct = createResult?.data?.productCreate?.product;
      if (!createdProduct) return data({ success: false, intent: "createProduct", error: "Product creation failed", userErrors: allUserErrors });

      const productId = createdProduct.id;
      const productHandle = createdProduct.handle;
      const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;
      const inventoryItemId = createdProduct.variants?.edges?.[0]?.node?.inventoryItem?.id;

      await new Promise(resolve => setTimeout(resolve, 500));

      const shippingOzRaw = payload.shipping_weight_oz || piece.shipping_weight_oz || 0;
      const shippingOz = parseFloat(String(shippingOzRaw));
      
      if (defaultVariantId) {
        const variantUpdateInput = { id: defaultVariantId, price: price };
        const variantResponse = await admin.graphql(
          `#graphql
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
          } `,
          { variables: { productId, variants: [variantUpdateInput] } }
        );
        const variantResult = await variantResponse.json();
        allUserErrors.push(...(variantResult?.data?.productVariantsBulkUpdate?.userErrors || []));
      }
      
      if (inventoryItemId && !isNaN(shippingOz) && shippingOz >= 0) {
        const weightResponse = await admin.graphql(
          `#graphql
          mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
            inventoryItemUpdate(id: $id, input: $input) { userErrors { field message } }
          }`,
          { variables: { id: inventoryItemId, input: { measurement: { weight: { value: shippingOz, unit: "OUNCES" } } } } }
        );
        const weightJson = await weightResponse.json();
        if (weightJson?.data?.inventoryItemUpdate?.userErrors?.length) {
          allUserErrors.push(...weightJson.data.inventoryItemUpdate.userErrors);
        }
      }

      const flatPayload = { ...payload, ...piece };
      const targetKeys = [
        "cut_and_shape", "surface_finish", "color", "dimensions_mm", 
        "weight_grams", "shipping_weight_oz", "artist_notes", "origin_story", 
        "character_marks", "honest_flaws", "honest_flaws_and_character", 
        "is_ooak", "treated", "found_object", "custom_product", "piece_name", 
        "stone_shape", "specific_gravity", "mohs_hardness", "generated_description", 
        "collection_location", "origin_handle", "origin_page_handle",
        "material", "color_pattern", "jewelry_material", "target_gender", "age_group", 
        "condition", "rarity", "authenticity", "jewelry_type", "necklace_design", 
        "crystal_system", "geological_era", "mineral_class", "rock_composition", 
        "rock_formation"
      ];
      
      const injectMetafieldsMap = new Map();

      Object.entries(flatPayload).forEach(([key, value]) => {
        if (value === null || value === undefined || String(value).trim() === "") return;
        
        let metaKey = key;
        let isCustomField = targetKeys.includes(key);

        if (key.startsWith("custom/")) {
          isCustomField = true;
          metaKey = key.split("custom/")[1];
        }

        if (isCustomField && metaKey && MASTER_TYPE_MAP.hasOwnProperty(metaKey)) {
          let resolvedType = MASTER_TYPE_MAP[metaKey];

          if ((resolvedType && resolvedType.includes("metaobject_reference")) || EXPLICIT_METAOBJECT_KEYS.includes(metaKey)) {
            const valStr = String(value).trim().toLowerCase();
            if (["n/a", "none", "null", "undefined", ""].includes(valStr)) return;
          }

          if (metaKey === "generated_description") {
            value = sanitizeDescription(String(value));
          }

          let normalizedValue = normalizeMetafieldValue(metaKey, value);
          let resolvedValue = normalizedValue;

          const multiLineKeys = ["origin_story", "artist_notes", "honest_flaws_and_character", "bench_notes", "generated_description"];
          const decimalKeys = ["weight_grams", "shipping_weight_oz", "price"];
          const listSingleLineKeys = ["character_marks"];

          if (multiLineKeys.includes(metaKey)) {
            resolvedType = "multi_line_text_field";
            if (resolvedValue.length > 10000) resolvedValue = resolvedValue.slice(0, 10000);
          } else if (decimalKeys.includes(metaKey)) {
            resolvedType = "number_decimal";
            const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
            resolvedValue = isNaN(parsedNum) ? "0.0" : (parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum));
          } else if (listSingleLineKeys.includes(metaKey)) {
            resolvedType = "list.single_line_text_field";
            resolvedValue = JSON.stringify([String(resolvedValue).trim()]);
          } else if (resolvedType.includes("metaobject_reference")) {
            if (!String(resolvedValue).startsWith("gid://")) {
                resolvedType = "single_line_text_field";
            }
          } else {
            resolvedType = "single_line_text_field";
            if (resolvedValue.length > 255) resolvedValue = resolvedValue.slice(0, 255);
          }

          injectMetafieldsMap.set(metaKey, {
            ownerId: productId,
            namespace: "custom",
            key: metaKey,
            type: resolvedType,
            value: resolvedType.startsWith("list.") && !resolvedValue.startsWith("[") ? JSON.stringify([resolvedValue]) : resolvedValue
          });
        }
      });

      let injectMetafields = Array.from(injectMetafieldsMap.values());
      injectMetafields = applyOriginOverridesBeforeApi(title, injectMetafields);

      if (injectMetafields.length > 0) {
        const uniqueSet = new Map();
        injectMetafields.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        injectMetafields = Array.from(uniqueSet.values());

        const chunks = chunkArray(injectMetafields, 25);
        
        for (let i = 0; i < chunks.length; i++) {
          const response = await admin.graphql(
            `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { userErrors { field message } }
            }`,
            { variables: { metafields: chunks[i] } }
          );
          const result = await response.json();
          const createErrs = result?.data?.metafieldsSet?.userErrors || [];
          if (createErrs.length > 0) allUserErrors.push(...createErrs);
        }
      }

      await executeGhostDelete(admin, createdProduct.id);

      return data({ success: true, intent: "createProduct", productId: productId, productHandle: productHandle, userErrors: allUserErrors });
    } catch (error) {
      return data({ success: false, intent: "createProduct", error: error.message });
    }
  }

  if (intent === "cleanGhostNamespaces") {
    try {
      const productId = formData.get("productId");
      if (!productId) return data({ success: false, message: "No productId provided." });

      let resolvedId = `gid://shopify/Product/${productId}`;
      if (productId.startsWith("gid://")) resolvedId = productId;

      const lookupResponse = await admin.graphql(
        `#graphql
        query getMetafields($ownerId: ID!) { product(id: $ownerId) { metafields(first: 250) { edges { node { id namespace key } } } } } `,
        { variables: { ownerId: resolvedId } }
      );
      const lookupResult = await lookupResponse.json();
      const allMeta = lookupResult?.data?.product?.metafields?.edges || [];

      const toDelete = allMeta.map(e => e.node).filter(m => {
        if (["weight_grams", "shipping_weight_oz"].includes(m.key)) return false;
        if (["geo", "rockhound", "geology"].includes(m.namespace)) return true;
        if (m.namespace === "custom") {
          if (["crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "hardness", "fracture", "geoSource", "store_hardness", "store_luster", "store_fracture", "store_cleavage", "store_specific_gravity", "store_diaphaneity", "moh_hardness", "mohsHardness", "primary_color", "secondary_colors", "cut_type", "base_stone_type", "meta_status", "tenacity", "official_name", "polishing_compound", "dimensions", "chemical_formula", "crystal_structure", "refractive_index", "title_tag", "description_tag", "google_product_category", "color-pattern", "jewelry-material", "target-gender", "age-group", "seo_title", "age_group", "condition", "is_one_of_a-kind", "authenticity", "rarity", "stone_story"].includes(m.key)) return true;
          if (/[a-z][A-Z]/.test(m.key)) return true;
        }
        return false;
      });

      if (toDelete.length === 0) return data({ success: true, message: "No ghost namespaces or keys found.", deletedCount: 0, deletedKeys: [] });

      const deleteResponse = await admin.graphql(
        `#graphql
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
        } `,
        { variables: { metafields: toDelete.map(m => ({ ownerId: resolvedId, namespace: m.namespace, key: m.key })) } }
      );

      const deleteResult = await deleteResponse.json();
      const deleteErrors = deleteResult?.data?.metafieldsDelete?.userErrors || [];
      const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];

      if (deleteErrors.length > 0) return data({ success: false, message: "Delete had errors.", errors: deleteErrors });
      return data({ success: true, message: `Cleaned ${deleted.length} ghost metafield(s).`, deletedCount: deleted.length, deletedKeys: deleted.map(d => `${d.namespace}/${d.key}`) });
    } catch (error) {
      return data({ success: false, error: error.message });
    }
  }

  if (intent === "cleanAllGhostNamespaces") {
    try {
      let hasNextPage = true;
      let cursor = null;
      let totalScanned = 0;
      let totalDeleted = 0;
      let allDeletedKeys = [];

      while (hasNextPage) {
        const productsResponse = await admin.graphql(
          `#graphql
          query getProductsMetafields($cursor: String) {
            products(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges { node { id metafields(first: 250) { edges { node { id namespace key } } } } }
            }
          }`,
          { variables: { cursor } }
        );

        const productsResult = await productsResponse.json();
        const products = productsResult?.data?.products?.edges || [];

        for (const productEdge of products) {
          totalScanned++;
          const productNode = productEdge.node;
          const allMeta = productNode.metafields?.edges || [];
          
          const toDelete = allMeta.map(e => e.node).filter(m => {
            if (["weight_grams", "shipping_weight_oz"].includes(m.key)) return false;
            if (["geo", "rockhound"].includes(m.namespace)) return true;
            if (m.namespace === "custom") {
              if (["crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "hardness", "fracture", "geoSource", "store_hardness", "store_luster", "store_fracture", "store_cleavage", "store_specific_gravity", "store_diaphaneity", "moh_hardness", "mohsHardness", "primary_color", "secondary_colors", "cut_type", "base_stone_type", "meta_status", "tenacity", "official_name", "polishing_compound", "dimensions", "chemical_formula", "crystal_structure", "refractive_index", "title_tag", "description_tag", "google_product_category", "color-pattern", "jewelry-material", "target-gender", "age-group", "seo_title", "age_group", "condition", "is_one_of_a-kind", "authenticity", "rarity", "stone_story"].includes(m.key)) return true;
              if (/[a-z][A-Z]/.test(m.key)) return true;
            }
            return false;
          });

          if (toDelete.length > 0) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                  metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace } }
                }`,
                { variables: { metafields: toDelete.map(m => ({ ownerId: productNode.id, namespace: m.namespace, key: m.key })) } }
              );
              const deleteResult = await deleteResponse.json();
              const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];
              totalDeleted += deleted.length;
              deleted.forEach(d => allDeletedKeys.push(`${d.namespace}/${d.key}`));
            } catch (errors) {}
          }
        }

        hasNextPage = productsResult?.data?.products?.pageInfo?.hasNextPage;
        cursor = productsResult?.data?.products?.pageInfo?.endCursor;
        if (hasNextPage) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return data({ success: true, message: `Nuclear sweep complete. Scanned ${totalScanned} products, deleted ${totalDeleted} ghost metafields.`, deletedCount: totalDeleted, deletedKeys: allDeletedKeys });
    } catch (error) {
      return data({ success: false, message: "Bulk clean failed", error: error.message });
    }
  }

  if (intent === "toggleStatus") {
    try {
      const productId = formData.get("pieceId");
      const newStatus = formData.get("newStatus"); 

      if (!productId || !newStatus) {
        return data({ success: false, error: "Missing pieceId or newStatus" });
      }

      const productGid = productId.startsWith("gid://") ? productId : `gid://shopify/Product/${productId.split("/").pop()}`;

      if (newStatus === "ACTIVE") {
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id status }
              userErrors { field message }
            }
          }`,
          { variables: { input: { id: productGid, status: "ACTIVE" } } }
        );

        const result = await response.json();
        const userErrors = result?.data?.productUpdate?.userErrors || [];

        if (userErrors.length > 0) {
          return data({ success: false, error: userErrors.map(e => e.message).join(", ") });
        }

        const publishResponse = await admin.graphql(
          `#graphql
          mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) {
              publishable { id }
              userErrors { field message }
            }
          }`,
          {
            variables: {
              id: productGid,
              input: [
                { publicationId: "gid://shopify/Publication/179140788475" },
                { publicationId: "gid://shopify/Publication/179140821243" },
                { publicationId: "gid://shopify/Publication/179140886779" },
                { publicationId: "gid://shopify/Publication/179324944635" },
                { publicationId: "gid://shopify/Publication/179488489723" },
                { publicationId: "gid://shopify/Publication/179794477307" }
              ]
            }
          }
        );

        const publishResult = await publishResponse.json();
        const publishUserErrors = publishResult?.data?.publishablePublish?.userErrors || [];

        if (publishUserErrors.length > 0) {
          return data({ success: false, error: "Product set to ACTIVE, but publishing failed: " + publishUserErrors.map(e => e.message).join(", ") });
        }

        return data({ success: true, newStatus: "ACTIVE" });

      } else if (newStatus === "DRAFT") {
        const response = await admin.graphql(
          `#graphql
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id status }
              userErrors { field message }
            }
          }`,
          { variables: { input: { id: productGid, status: "DRAFT" } } }
        );

        const result = await response.json();
        const userErrors = result?.data?.productUpdate?.userErrors || [];

        if (userErrors.length > 0) {
          return data({ success: false, error: userErrors.map(e => e.message).join(", ") });
        }

        return data({ success: true, newStatus: "DRAFT" });
      }

    } catch (error) {
      console.error("[toggleStatus] error:", error);
      return data({ success: false, error: error.message });
    }
  }

};
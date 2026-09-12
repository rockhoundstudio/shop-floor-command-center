import { data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// 🟢 FIX: THE GEO-STRIPPER
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

  // 1. Strip out ANY incoming handles so we can rebuild them accurately and kill typos
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

  // 🔴 NUMBERS: strictly number_decimal to match Shopify definitions
  weight_grams: "number_decimal",
  shipping_weight_oz: "number_decimal",
  price: "number_decimal",

  // 🔴 TEXT BLOCKS: align with definitions
  origin_story: "multi_line_text_field",
  honest_flaws: "single_line_text_field",
  honest_flaws_and_character: "multi_line_text_field",
  generated_description: "multi_line_text_field",
  artist_notes: "multi_line_text_field",

  // SHOPIFY TAXONOMY / METAOBJECTS
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
  "target-gender", "target-gender", "age-group", "age_group", "condition", "rarity", 
  "authenticity", "jewelry-type", "jewelry_type", "necklace-design", "necklace_design", 
  "crystal-system", "crystal_system", "geological-era", "geological_era", 
  "mineral-class", "mineral_class", "rock-composition", "rock_composition", 
  "rock-formation", "rock_formation", "chain-link-type", "chain_link_type",
  "jewelry-finding-type", "jewelry_finding_type"
];

// 🔴 CRITICAL NAMESPACE RULE: Never write these to the custom/ namespace
const CRITICAL_SHOPIFY_KEYS = [
  "mineral_class", "crystal_system", "rock_composition", "geological_era",
  "rock_formation", "jewelry_type", "necklace_design", "color_pattern",
  "authenticity", "rarity", "condition", "target_gender", "jewelry_material"
];

// 🟢 THE GHOST DELETE SEQUENCE
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
      "crystal_system", "mineral_class", "rock_composition", "is_one_of_a_kind"
    ];
    const isCamelCase = (str) => /[a-z][A-Z]/.test(str);
    const safeNamespaces = ["shopify", "judgeme", "mm-google-shopping", "mc-facebook"];

    const toDelete = allMeta.map(e => e.node).filter(m => {
      // Never touch safe namespaces or internal app namespaces
      if (safeNamespaces.includes(m.namespace) || m.namespace.startsWith("app-")) return false;
      
      if (m.namespace === "custom") {
        if (ghostKeys.includes(m.key)) return true;
        if (isCamelCase(m.key)) return true;
      }
      return false;
    });

    if (toDelete.length > 0) {
      const deleteResponse = await admin.graphql(
        `#graphql
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
        }`,
        { variables: { metafields: toDelete.map(m => ({ ownerId: productGid, namespace: m.namespace, key: m.key })) } }
      );
      const deleteResult = await deleteResponse.json();
      const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];
      deleted.forEach(d => {
        console.log(`[GHOST DELETE] Deleted ghost field: ${d.namespace}/${d.key}`);
      });
    }
  } catch (err) {
    console.error("Ghost delete error:", err);
  }
}

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const rawFormData = await request.formData();

  // 🟢 FIX: THE INTAKE MANIFOLD FILTER
  // Intercept all incoming strings and kill the AI geology autocorrect 
  // before the data hits the distribution block.
  const formData = new FormData();
  for (const [key, value] of rawFormData.entries()) {
    if (typeof value === "string") {
      let safeString = value;
      safeString = safeString.replace(/Shocked\s*Rock/gi, "Shopped Rock");
      safeString = safeString.replace(/the-shocked-rock/gi, "the-shopped-rock");
      safeString = safeString.replace(/shocked[-_]rock/gi, "shopped-rock");
      safeString = safeString.replace(/shocked%2Drock/gi, "shopped-rock");
      formData.append(key, safeString);
    } else {
      formData.append(key, value); // Pass binary files (like image uploads) untouched
    }
  }

  console.log("[MANIFOLD CHECK] descriptionHtml:", formData.get("descriptionHtml")?.slice(0, 200));

  const intent = formData.get("intent");

  // ==========================================
  // 🟢 INTENT 1: AUTO-FILL (Mindat & Cache)
  // ==========================================
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
      console.error("Cache Error:", error);
      return data({ success: false, message: "Database connection failed." }, { status: 500 });
    }
  }

  // ==========================================
  // 🔵 INTENT 2: LOCK DATA TO SHOPIFY
  // ==========================================
  if (intent === "saveMetafields") {
    try {
      const rawPayload = formData.get("payload") || formData.get("metafields");
      const directWeightGrams = formData.get("weightGrams");
      const directShippingWeightOz = formData.get("shippingWeightOz");
      const fallbackProductId = formData.get("productId");

      if (!rawPayload && !directWeightGrams && !fallbackProductId) {
        return data({ intent: "saveMetafields", success: false, message: "No data provided to save." });
      }

      let payloadArray = [];
      try {
        if (rawPayload) payloadArray = JSON.parse(rawPayload);
      } catch (e) {
        payloadArray = [];
      }

      // Explicitly inject manual weight fields if passed directly through form
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

      let setMetafields = payloadArray
        .filter(item => {
          if (item.value === null || item.value === undefined || String(item.value).trim() === "") return false;
          if (!MASTER_TYPE_MAP.hasOwnProperty(item.key)) return false;
          
          let ns = item.namespace || "custom";
          if (item.key === "is_ooak" || ns === "none" || ns === "") ns = "custom";

          // 🔴 CRITICAL NAMESPACE RULE: Never write these keys to custom/
          if (CRITICAL_SHOPIFY_KEYS.includes(item.key) && ns === "custom") return false;
          if (item.key === "material" && ns === "custom") return false;

          const resolvedType = MASTER_TYPE_MAP[item.key];
          
          // 🔴 GUARD FOR METAOBJECT REFERENCES: Skip "N/A", "None", empty
          if ((resolvedType && resolvedType.includes("metaobject_reference")) || EXPLICIT_METAOBJECT_KEYS.includes(item.key)) {
            const valStr = String(item.value).trim().toLowerCase();
            if (["n/a", "none", "null", "undefined", ""].includes(valStr)) return false;
          }

          return true;
        })
        .flatMap(item => {
          const itemOwnerId = item.ownerId || fallbackProductId;
          if (!itemOwnerId) throw new Error(`Missing ownerId for field: ${item.key}`);

          let resolvedId = `gid://shopify/Product/${itemOwnerId.split("/").pop()}`;
          if (itemOwnerId.startsWith("gid://")) resolvedId = itemOwnerId;

          const resolvedType = MASTER_TYPE_MAP[item.key] || "single_line_text_field";
          let normalizedValue = normalizeMetafieldValue(item.key, item.value);
          let resolvedValue = normalizedValue;
          
          // 🔴 FORCE DECIMAL STRING FORMAT FOR SHOPIFY VALIDATION
          if (resolvedType === "number_decimal") {
            const parsedNum = parseFloat(String(normalizedValue).replace(/[^0-9.-]/g, ""));
            if (isNaN(parsedNum)) {
              resolvedValue = "0.0";
            } else {
              resolvedValue = parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum);
            }
          } else if (resolvedType.startsWith("list.")) {
            resolvedValue = JSON.stringify([normalizedValue]);
          }

          let resolvedNamespace = item.namespace || "custom";
          if (item.key === "is_ooak" || resolvedNamespace === "none" || resolvedNamespace === "") {
            resolvedNamespace = "custom";
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

      const productTitle = formData.get("productTitle");
      if (productTitle) {
        setMetafields = applyOriginOverridesBeforeApi(productTitle, setMetafields);
      }

      if (setMetafields.length > 0) {
        // Deduplicate before execution to prevent double-writes
        const uniqueSet = new Map();
        setMetafields.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        setMetafields = Array.from(uniqueSet.values());

        console.log("[CANONICAL WRITE]");
        const chunks = chunkArray(setMetafields, 25);
        const allErrors = [];

        for (let i = 0; i < chunks.length; i++) {
          console.log(`[BATCH ${i + 1} of ${chunks.length}]`);
          const response = await admin.graphql(
            `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { userErrors { field message } }
            }`,
            { variables: { metafields: chunks[i] } } // Exactly ONE call per batch
          );
          const result = await response.json();
          const batchErrors = result?.data?.metafieldsSet?.userErrors || [];
          if (batchErrors.length > 0) allErrors.push(...batchErrors);
        }

        if (allErrors.length > 0) {
          return data({ success: false, message: "Saved with errors: " + allErrors.map(e => e.message).join(" | "), errors: allErrors });
        }
      }

      // Base Product Update, SEO Update, and Ghost Kill
      const newProductTitle = formData.get("productTitle");
      const descriptionHtml = formData.get("descriptionHtml");
      
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
          // Map descriptionHtml to bodyHtml for the productUpdate mutation
          if (descriptionHtml) { 
            inputVars.descriptionHtml = descriptionHtml; 
            hasUpdates = true; 
          }
          if (seoTitleValue) { inputVars.seo = { title: seoTitleValue }; hasUpdates = true; }

          if (hasUpdates) {
            await admin.graphql(
              `#graphql
              mutation productUpdate($input: ProductInput!) {
                productUpdate(input: $input) { userErrors { field message } }
              }`,
              { variables: { input: inputVars } }
            );
          }

          // Execute Ghost Delete Sequence
          await executeGhostDelete(admin, productGid);

        } catch (err) {
          console.warn("[saveMetafields] Base update or ghost kill failed:", err.message);
        }
      }

      // 🔴 Physical Variant Weight Sync
      const finalWeightGrams = directWeightGrams || payloadArray.find(item => item.key === "weight_grams")?.value;
      if (finalWeightGrams && fallbackProductId) {
        const parsedGrams = parseFloat(String(finalWeightGrams).replace(/[^0-9.-]/g, ""));
        if (!isNaN(parsedGrams) && parsedGrams > 0) {
          try {
            const productGid = `gid://shopify/Product/${fallbackProductId.split("/").pop()}`;
            const variantQuery = await admin.graphql(
              `#graphql
              query getDefaultVariant($id: ID!) {
                product(id: $id) { variants(first: 1) { edges { node { id } } } }
              }`,
              { variables: { id: productGid } }
            );
            const variantData = await variantQuery.json();
            const variantId = variantData?.data?.product?.variants?.edges?.[0]?.node?.id;
            if (variantId) {
              await admin.graphql(
                `#graphql
                mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                  productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
                }`,
                { variables: { productId: productGid, variants: [{ id: variantId, inventoryItem: { measurement: { weight: { value: parsedGrams / 28.3495, unit: "OUNCES" } } } }] } }
              );
            }
          } catch (weightErr) {
            console.warn("[saveMetafields] Variant weight update failed:", weightErr.message);
          }
        }
      }

      return data({ intent: "saveMetafields", success: true, message: "All metafields and variant weights locked in." });
    } catch (error) {
      return data({ intent: "saveMetafields", success: false, error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT 3: CLEAN MALFORMED KEYS
  // ==========================================
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

  // ==========================================
  // 🔴 INTENT 3.5: CLEAN ALL CAMEL KEYS (NUCLEAR SWEEP)
  // ==========================================
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

  // ==========================================
  // INTENT 4: STAGED UPLOAD
  // ==========================================
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

  // ==========================================
  // INTENT 5: CREATE PRODUCT
  // ==========================================
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
      const descriptionHtml = payload.descriptionHtml || piece.generated_description || piece.descriptionHtml || "";
      const price = String(payload.price || piece.price || "0.00");
      const productType = payload.productType || "Wearable Art";
      const status = payload.status || "DRAFT";

      const allUserErrors = [];
      const seoTitle = payload.seo_title || `${stoneFamily} — ${pieceName} — One-of-a-Kind Rockhound Studio`;

      const createResponse = await admin.graphql(
        `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id handle variants(first: 1) { edges { node { id } } } }
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

      await new Promise(resolve => setTimeout(resolve, 500));

      // Variant Price & Weight Sync
      const weightGrams = parseFloat(String(payload.weight_grams || piece.weight_grams || 0).replace(/[^0-9.-]/g, ""));
      if (defaultVariantId) {
        const variantUpdateInput = { id: defaultVariantId, price: price };
        if (!isNaN(weightGrams) && weightGrams > 0) {
          variantUpdateInput.inventoryItem = {
            measurement: { weight: { value: weightGrams / 28.3495, unit: "OUNCES" } }
          };
        }

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

      // Post-Creation Metafield Injection
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

        // 🔴 CRITICAL NAMESPACE RULE: Never write these keys to custom/
        if (CRITICAL_SHOPIFY_KEYS.includes(metaKey)) return;
        if (metaKey === "material") return;

        if (isCustomField && metaKey && MASTER_TYPE_MAP.hasOwnProperty(metaKey)) {
          const resolvedType = MASTER_TYPE_MAP[metaKey];

          // 🔴 GUARD FOR METAOBJECT REFERENCES: Skip "N/A", "None", empty
          if ((resolvedType && resolvedType.includes("metaobject_reference")) || EXPLICIT_METAOBJECT_KEYS.includes(metaKey)) {
            const valStr = String(value).trim().toLowerCase();
            if (["n/a", "none", "null", "undefined", ""].includes(valStr)) return;
          }

          let resolvedValue = normalizeMetafieldValue(metaKey, value);

          // 🔴 FORCE DECIMAL STRING FORMAT FOR SHOPIFY VALIDATION
          if (resolvedType === "number_decimal") {
            const parsed = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
            if (isNaN(parsed)) {
              resolvedValue = "0.0";
            } else {
              resolvedValue = parsed % 1 === 0 ? parsed.toFixed(1) : String(parsed);
            }
          }

          injectMetafieldsMap.set(metaKey, {
            ownerId: productId,
            namespace: "custom",
            key: metaKey,
            type: resolvedType || "single_line_text_field",
            value: (resolvedType || "").startsWith("list.") ? JSON.stringify([resolvedValue]) : resolvedValue
          });
        }
      });

      let injectMetafields = Array.from(injectMetafieldsMap.values());
      injectMetafields = applyOriginOverridesBeforeApi(title, injectMetafields);

      if (injectMetafields.length > 0) {
        // Deduplicate before execution to prevent double-writes
        const uniqueSet = new Map();
        injectMetafields.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        injectMetafields = Array.from(uniqueSet.values());

        console.log("[CANONICAL WRITE]");
        const chunks = chunkArray(injectMetafields, 25);
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`[BATCH ${i + 1} of ${chunks.length}]`);
          const response = await admin.graphql(
            `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { userErrors { field message } }
            }`,
            { variables: { metafields: chunks[i] } } // Exactly ONE call per batch
          );
          const result = await response.json();
          const createErrs = result?.data?.metafieldsSet?.userErrors || [];
          if (createErrs.length > 0) allUserErrors.push(...createErrs);
        }
      }

      // Execute Ghost Delete Sequence
      await executeGhostDelete(admin, createdProduct.id);

      return data({ success: true, intent: "createProduct", productId: productId, productHandle: productHandle, userErrors: allUserErrors });
    } catch (error) {
      return data({ success: false, intent: "createProduct", error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT: CLEAN GHOST NAMESPACES (SINGLE PRODUCT)
  // ==========================================
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

  // ==========================================
  // 🔴 INTENT: CLEAN ALL GHOST NAMESPACES (ALL PRODUCTS)
  // ==========================================
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
};
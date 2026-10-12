import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

// 🟢 Structural Engine — No Prisma Import Here

const ALLOWED_TAB3_KEYS = [
  "shopify_title", "piece_name", "stone_family", "price", "weight_grams", 
  "shipping_weight_oz", "is_ooak", "dimensions_mm", 
  "surface_finish", "primary_color", "color_pattern", "honest_flaws_and_character", 
  "jewelry_type", 
  "primary_medium", "secondary_medium", "setting_ready", "bail_included", 
  "chain_material", "jewelry_finding_type", "mohs_hardness", "specific_gravity", 
  "crystal_system", "fracture_pattern", "cleavage", "luster", "diaphaneity", 
  "mineral_class", "geological_era", "rock_formation", "origin_location", 
  "origin_handle", "collection_name", "collection_location", "origin_story", 
  "seo_title", "alt_text", 
  "google_product_category", "authenticity", "rarity", "generated_description",
  
  // EXACT CUSTOM DESTINATIONS
  "is_one_of_a_kind", "origin_page_handle", "rescued_by", "character_marks",
  "treatment_status", "treated", "necklace_design", "chain_link_type",
  "rock_composition", "geological_age", "target_gender",

  // NATIVE CONTRACT TARGETS (ACCEPTED FOR ROUTING, EXCLUDED FROM CUSTOM NAMESPACE)
  "native_title", "native_shipping_weight", "native_image_alts",

  // STANDARDIZED TAXONOMY LIST
  "age-group", "chain-link-type", "condition", "construction", "crystal-system", 
  "geological-era", "jewelry-finding-type", "jewelry-material", "jewelry-type", 
  "material", "material-origin", "mineral-class", "necklace-design", 
  "product-classification", "product-use", "rock-composition", "rock-formation", 
  "target-gender"
];

// Strictly enforce these specific keys reside only in the custom namespace
const STRICT_CUSTOM_KEYS = [
  "is_one_of_a_kind", "origin_page_handle", "rescued_by", "character_marks",
  "treatment_status", "treated", "necklace_design", "chain_link_type",
  "rock_composition", "geological_age", "target_gender"
];

const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "wire_material", "primary_use"
];

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field", origin_location: "single_line_text_field", geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field", official_name: "single_line_text_field", luster: "single_line_text_field",
  specific_gravity: "single_line_text_field", fracture_pattern: "single_line_text_field", cleavage: "single_line_text_field",
  tenacity: "single_line_text_field", primary_color: "single_line_text_field", diaphaneity: "single_line_text_field",
  character_marks: "single_line_text_field", dimensions_mm: "single_line_text_field", cut_type: "single_line_text_field",
  surface_finish: "single_line_text_field", treatment_status: "single_line_text_field", secondary_colors: "single_line_text_field",
  base_stone_type: "single_line_text_field", hardness: "single_line_text_field", primary_medium: "single_line_text_field",
  piece_name: "single_line_text_field", stone_family: "single_line_text_field", collection_name: "single_line_text_field",
  collection_location: "single_line_text_field", origin_handle: "single_line_text_field", origin_page_handle: "single_line_text_field",
  alt_text: "single_line_text_field", is_ooak: "single_line_text_field", found_object: "single_line_text_field",
  custom_product: "single_line_text_field", setting_ready: "single_line_text_field", bail_included: "single_line_text_field",
  chain_material: "single_line_text_field", seo_title: "single_line_text_field", secondary_medium: "single_line_text_field",
  treated: "single_line_text_field", weight_grams: "number_decimal", shipping_weight_oz: "number_decimal", price: "number_decimal",
  origin_story: "multi_line_text_field", honest_flaws: "single_line_text_field", honest_flaws_and_character: "multi_line_text_field",
  generated_description: "multi_line_text_field", color_pattern: "list.metaobject_reference", "color-pattern": "list.metaobject_reference",
  material: "metaobject_reference", jewelry_material: "metaobject_reference", "jewelry-material": "metaobject_reference",
  age_group: "metaobject_reference", "age-group": "metaobject_reference", jewelry_type: "metaobject_reference",
  "jewelry-type": "metaobject_reference", target_gender: "metaobject_reference", "target-gender": "metaobject_reference",
  necklace_design: "metaobject_reference", "necklace-design": "metaobject_reference", authenticity: "metaobject_reference",
  rarity: "metaobject_reference", condition: "metaobject_reference", crystal_system: "metaobject_reference",
  "crystal-system": "metaobject_reference", mineral_class: "metaobject_reference", "mineral-class": "metaobject_reference",
  geological_era: "metaobject_reference", "geological-era": "metaobject_reference", rock_composition: "metaobject_reference",
  "rock-composition": "metaobject_reference", rock_formation: "metaobject_reference", "rock-formation": "metaobject_reference",
  chain_link_type: "metaobject_reference", "chain-link-type": "metaobject_reference", jewelry_finding_type: "metaobject_reference",
  "jewelry-finding-type": "metaobject_reference", google_product_category: "single_line_text_field",
  
  // Standardized taxonomy explicit mappings to avoid fallback to single_line_text_field
  "construction": "metaobject_reference",
  "material-origin": "metaobject_reference",
  "product-classification": "metaobject_reference",
  "product-use": "metaobject_reference"
};

const EXPLICIT_METAOBJECT_KEYS = [
  "material", "color-pattern", "color_pattern", "jewelry-material", "jewelry_material",
  "target-gender", "age-group", "age_group", "condition", "rarity", 
  "authenticity", "jewelry-type", "jewelry_type", "necklace-design", "necklace_design", 
  "crystal-system", "geological-era", "geological_era", 
  "mineral-class", "mineral_class", "rock-composition", "rock_composition", 
  "rock-formation", "rock_formation", "chain-link-type", "chain_link_type",
  "jewelry-finding-type", "jewelry_finding_type", "construction", "material-origin",
  "product-classification", "product-use"
];

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeMetafieldValue(key, value) {
  let val = String(value).replace(/^⚠️\s*/, "");
  const booleanKeys = ["is_ooak", "found_object", "custom_product", "treated"]; 
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

      let productQueryRes;
      try {
        productQueryRes = await admin.graphql(`
          query getProduct($id: ID!) {
            product(id: $id) {
              id title descriptionHtml seo { title description }
              metafields(first: 250) { edges { node { namespace key value } } }
              variants(first: 250) {
                pageInfo { hasNextPage endCursor }
                edges { node { id title price inventoryItem { measurement { weight { value unit } } } } }
              }
              media(first: 250) {
                pageInfo { hasNextPage endCursor }
                edges {
                  node {
                    ... on MediaImage {
                      id alt preview { image { url } }
                    }
                  }
                }
              }
            }
          }
        `, { variables: { id: productGid } });
      } catch (e) {
        return Response.json({ intent: "loadProductData", success: false, message: "Failed to query product data: " + e.message });
      }

      const productData = await productQueryRes.json();
      const product = productData?.data?.product;
      if (!product) return Response.json({ intent: "loadProductData", success: false, message: "Product not found" });

      const currentMetafields = {};
      if (product.metafields?.edges) {
        product.metafields.edges.forEach(({node}) => {
            currentMetafields[`${node.namespace}.${node.key}`] = node.value;
        });
      }

      const allVariants = [];
      const allMedia = [];
      let vPageInfo = product.variants?.pageInfo || { hasNextPage: false, endCursor: null };
      let mPageInfo = product.media?.pageInfo || { hasNextPage: false, endCursor: null };
      
      if (product.variants?.edges) allVariants.push(...product.variants.edges);
      if (product.media?.edges) {
          allMedia.push(...product.media.edges.filter(e => e.node && e.node.id));
      }

      let isComplete = true;
      let loadError = null;

      try {
          while (vPageInfo.hasNextPage) {
              const vRes = await admin.graphql(`
                  query getVariants($id: ID!, $cursor: String!) {
                      product(id: $id) {
                          variants(first: 250, after: $cursor) {
                              pageInfo { hasNextPage endCursor }
                              edges { node { id title price inventoryItem { measurement { weight { value unit } } } } }
                          }
                      }
                  }
              `, { variables: { id: productGid, cursor: vPageInfo.endCursor } });
              const vJson = await vRes.json();
              if (vJson.errors) throw new Error(vJson.errors[0].message);
              const newVariants = vJson?.data?.product?.variants;
              if (newVariants?.edges) allVariants.push(...newVariants.edges);
              vPageInfo = newVariants?.pageInfo || { hasNextPage: false, endCursor: null };
          }
      } catch (err) {
          isComplete = false;
          loadError = `Variants pagination failed: ${err.message}`;
          vPageInfo.hasNextPage = true;
      }

      try {
          while (mPageInfo.hasNextPage) {
              const mRes = await admin.graphql(`
                  query getMedia($id: ID!, $cursor: String!) {
                      product(id: $id) {
                          media(first: 250, after: $cursor) {
                              pageInfo { hasNextPage endCursor }
                              edges {
                                  node {
                                      ... on MediaImage { id alt preview { image { url } } }
                                  }
                              }
                          }
                      }
                  }
              `, { variables: { id: productGid, cursor: mPageInfo.endCursor } });
              const mJson = await mRes.json();
              if (mJson.errors) throw new Error(mJson.errors[0].message);
              const newMedia = mJson?.data?.product?.media;
              if (newMedia?.edges) {
                  allMedia.push(...newMedia.edges.filter(e => e.node && e.node.id));
              }
              mPageInfo = newMedia?.pageInfo || { hasNextPage: false, endCursor: null };
          }
      } catch (err) {
          isComplete = false;
          loadError = loadError ? `${loadError} | Media pagination failed: ${err.message}` : `Media pagination failed: ${err.message}`;
          mPageInfo.hasNextPage = true;
      }

      const uniqueVariants = Array.from(new Map(allVariants.map(e => [e.node.id, e])).values());
      const uniqueMedia = Array.from(new Map(allMedia.map(e => [e.node.id, e])).values());

      const nativeTargets = {
          productId: product.id, productTitle: product.title, descriptionHtml: product.descriptionHtml, seo: product.seo,
          isComplete,
          loadError,
          variants: {
              edges: uniqueVariants,
              pageInfo: vPageInfo
          },
          media: {
              edges: uniqueMedia,
              pageInfo: mPageInfo
          }
      };

      const canonicalFields = {};
      const repairPlan = {};
      const legacyFields = {};

      const CANONICAL_KEYS = Object.keys(MASTER_TYPE_MAP).map(k => {
          if (k.includes("-")) return `shopify.${k}`;
          return `custom.${k}`;
      });
      CANONICAL_KEYS.push("global.title_tag", "global.description_tag");

      CANONICAL_KEYS.forEach(k => {
         let val = currentMetafields[k] ?? "";
         canonicalFields[k] = val;
         repairPlan[k] = val; 
      });

      canonicalFields["shopify_title"] = product.title;
      repairPlan["shopify_title"] = product.title;
      canonicalFields["price"] = uniqueVariants[0]?.node?.price || "0.00";
      repairPlan["price"] = canonicalFields["price"];

      // Removed mapping is_one_of_a_kind -> is_ooak per requirement
      const LEGACY_MAP_LOCAL = {
        "custom.crystal-system": "shopify.crystal-system",
        "custom.mineral-class": "shopify.mineral-class",
        "custom.rock-composition": "shopify.rock-composition",
        "custom.geological-era": "shopify.geological-era",
        "custom.rock-formation": "shopify.rock-formation",
        "custom.necklace-design": "shopify.necklace-design"
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
         productId: product.id, productTitle: product.title, descriptionHtml: product.descriptionHtml, seo: product.seo,
         productTitle: product.title,
         currentMetafields,
         canonicalFields,
         legacyFields,
         repairPlan,
         nativeTargets
      });
    }

    if (intent === "executeRepairPlan") {
      const pieceId = body.get("pieceId");
      const rawPlan = body.get("repairPlan");
      const rawLegacy = body.get("legacyKeysToRemove");
      const rawNativeChanges = body.get("nativeChanges");
      
      if (!pieceId || !rawPlan) {
        return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Missing pieceId or repairPlan payload." });
      }

      const repairPlan = JSON.parse(rawPlan);
      const legacyKeysToRemove = rawLegacy ? JSON.parse(rawLegacy) : [];
      const nativeChanges = rawNativeChanges ? JSON.parse(rawNativeChanges) : {};
      
      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      const lookupResponse = await admin.graphql(`
        query getProductAndMetafields($id: ID!) {
          product(id: $id) { 
            title 
            descriptionHtml 
            seo { title description }
            variants(first: 2) {
              pageInfo { hasNextPage }
              edges { node { id price } }
            }
            media(first: 50) {
              edges {
                node {
                  ... on MediaImage { id alt }
                }
              }
            }
            metafields(first: 250) { edges { node { namespace key value type id } } } 
          }
        }
      `, { variables: { id: productGid } });
      
      const lookupData = await lookupResponse.json();
      const currentNativeTitle = lookupData?.data?.product?.title || "";
      const currentNativeBodyHtml = lookupData?.data?.product?.descriptionHtml || "";
      const currentNativeSeoTitle = lookupData?.data?.product?.seo?.title || "";
      const currentMetaList = lookupData?.data?.product?.metafields?.edges || [];
      
      const currentMetafields = {};
      const currentMetafieldsTypes = {};
      currentMetaList.forEach(e => { 
        const fullKey = `${e.node.namespace}.${e.node.key}`;
        currentMetafields[fullKey] = e.node.value;
        currentMetafieldsTypes[fullKey] = e.node.type; 
      });

      // Fetch dynamic definitions for true types
      let hasNextPage = true;
      let cursor = null;
      const defs = {};

      try {
          while (hasNextPage) {
              const defQuery = `#graphql
                query getDefs($cursor: String) {
                  metafieldDefinitions(first: 250, ownerType: PRODUCT, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges { node { id namespace key type { name } validations { name value } } }
                  }
                }
              `;
              const defRes = await admin.graphql(defQuery, cursor ? { variables: { cursor } } : {});
              const defJson = await defRes.json();
              const defData = defJson?.data?.metafieldDefinitions;
              
              defData?.edges?.forEach(e => {
                  const t = e.node.type;
                  const fullKey = `${e.node.namespace}.${e.node.key}`;
                  const validation = e.node.validations?.find(v => v.name === "metaobject_definition_id");
                  defs[fullKey] = {
                      type: (t && typeof t === 'object' && t.name) ? t.name : t,
                      requiredDefinitionId: validation ? validation.value : null
                  };
              });
              
              hasNextPage = defData?.pageInfo?.hasNextPage;
              cursor = defData?.pageInfo?.endCursor;
          }
      } catch (e) {
          console.error("Failed to load metafield definitions:", e);
      }

      const proposedChanges = {};
      const setToShopify = [];
      const deleteFromShopify = [];
      const blockedFields = {};
      const skippedKeys = [];
      const unsupportedKeys = [];
      const unchanged = [];
      const attemptedDestinations = [];
      const verifiedDestinations = [];
      const unresolvedChanges = {};

      const nativeInput = { id: productGid };
      let doNativeUpdate = false;

      let doPriceUpdate = false;
      let priceVariantGid = null;
      let newPriceString = null;
      let priceReadBackVerified = false;
      
      // Native Changes Integration
      let nativeTitleUpdated = false;
      if (nativeChanges.title !== undefined) {
         if (nativeChanges.title !== currentNativeTitle) {
             nativeInput.title = nativeChanges.title;
             doNativeUpdate = true;
             nativeTitleUpdated = true;
             proposedChanges["native_title"] = { from: currentNativeTitle, to: nativeChanges.title };
             attemptedDestinations.push("native_title");
         } else {
             unchanged.push("native_title");
         }
      }
      
      // We must handle shipping weight via inventoryItem mutation, not productUpdate
      let doShippingWeightUpdate = false;
      let shippingWeightInput = null;
      
      if (nativeChanges.shippingWeight) {
         const sw = nativeChanges.shippingWeight;
         const valStr = String(sw.value !== null && sw.value !== undefined ? sw.value : "").trim();
         
         if (valStr !== "") {
            const parsedNum = parseFloat(valStr);
            if (isNaN(parsedNum) || parsedNum < 0) {
               blockedFields["native_shipping_weight"] = "Shipping weight must be a positive number.";
            } else if (!sw.variantId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(sw.variantId)) {
               blockedFields["native_shipping_weight"] = "Missing or invalid variant ID for shipping weight.";
            } else if (sw.unit !== "OUNCES") {
               blockedFields["native_shipping_weight"] = "Shipping weight unit must be exactly 'OUNCES'.";
            } else {
               try {
                  const invRes = await admin.graphql(`
                     query getInventoryItem($id: ID!) {
                       productVariant(id: $id) {
                         inventoryItem { id measurement { weight { value unit } } }
                       }
                     }
                  `, { variables: { id: sw.variantId }});
                  const invJson = await invRes.json();
                  const invItem = invJson.data?.productVariant?.inventoryItem;
                  
                  if (!invItem) {
                     blockedFields["native_shipping_weight"] = "Failed to resolve inventory item for variant.";
                  } else {
                     const currentWeight = invItem.measurement?.weight?.value;
                     const currentUnit = invItem.measurement?.weight?.unit;
                     
                     if (parseFloat(currentWeight) !== parsedNum || currentUnit !== sw.unit) {
                         doShippingWeightUpdate = true;
                         shippingWeightInput = {
                            id: invItem.id,
                            measurement: { weight: { value: parsedNum, unit: sw.unit } }
                         };
                         proposedChanges["native_shipping_weight"] = { 
                            from: `${currentWeight} ${currentUnit}`, 
                            to: `${parsedNum} ${sw.unit}` 
                         };
                         attemptedDestinations.push("native_shipping_weight");
                     } else {
                         unchanged.push("native_shipping_weight");
                     }
                  }
               } catch (e) {
                  blockedFields["native_shipping_weight"] = "Failed to fetch inventory item details.";
               }
            }
         }
      }
      
      // Image Alt Text Native Updates
      let doImageAltUpdates = false;
      const imageAltInputs = [];
      
      if (nativeChanges.imageAlts && Array.isArray(nativeChanges.imageAlts)) {
         const currentMedia = lookupData?.data?.product?.media?.edges || [];
         
         for (const imgReq of nativeChanges.imageAlts) {
            if (!imgReq.imageId || !/^gid:\/\/shopify\/MediaImage\/\d+$/.test(imgReq.imageId)) {
               blockedFields[`native_image_alts_${imgReq.imageId || 'unknown'}`] = "Invalid image ID.";
               continue;
            }
            
            const match = currentMedia.find(m => m.node.id === imgReq.imageId);
            if (!match) {
               blockedFields[`native_image_alts_${imgReq.imageId}`] = "Image ID not found on this product.";
               continue;
            }
            
            if (match.node.alt !== imgReq.altText) {
               doImageAltUpdates = true;
               imageAltInputs.push({
                  id: imgReq.imageId,
                  alt: imgReq.altText || ""
               });
               proposedChanges[`native_image_alts_${imgReq.imageId}`] = { from: match.node.alt, to: imgReq.altText };
               attemptedDestinations.push(`native_image_alts_${imgReq.imageId}`);
            } else {
               unchanged.push(`native_image_alts_${imgReq.imageId}`);
            }
         }
      }

      // Shared Metaobject Validation Cache
      const moValidationCache = new Map();
      
      for (const [fullKey, val] of Object.entries(repairPlan)) {
        if (fullKey === "shopify_title") {
           if (!nativeTitleUpdated && nativeChanges.title === undefined) {
               skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "price") {
           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (valStr === "") continue;

           const validPrice = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
           if (!validPrice.test(valStr)) {
               blockedFields["price"] = "Malformed price: must be a non-negative number with up to two decimals.";
               continue;
           }

           const variantsConn = lookupData?.data?.product?.variants;
           if (!variantsConn || !variantsConn.edges || typeof variantsConn.pageInfo?.hasNextPage !== "boolean") {
               blockedFields["price"] = "Missing variant or pagination data from Shopify.";
               continue;
           }
           if (variantsConn.edges.length === 0) {
               blockedFields["price"] = "Ambiguous destination: Product has zero variants.";
               continue;
           }
           if (variantsConn.edges.length > 1 || variantsConn.pageInfo.hasNextPage === true) {
               blockedFields["price"] = "Ambiguous destination: Product has multiple variants. Edit price manually.";
               continue;
           }

           const targetVariantId = variantsConn.edges[0].node.id;
           const currentPriceStr = variantsConn.edges[0].node.price;

           if (!targetVariantId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(targetVariantId)) {
               blockedFields["price"] = "Invalid variant ID retrieved.";
               continue;
           }
           if (typeof currentPriceStr !== "string") {
               blockedFields["price"] = "Missing current price data from Shopify.";
               continue;
           }

           const getCents = (str) => {
               const parts = (str || "0").split(".");
               const dollars = parts[0];
               const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
               return BigInt(dollars + cents);
           };

           if (getCents(valStr) !== getCents(currentPriceStr)) {
               doPriceUpdate = true;
               priceVariantGid = targetVariantId;
               newPriceString = valStr;
               proposedChanges["price"] = { from: currentPriceStr, to: valStr };
               attemptedDestinations.push("price");
           } else {
               unchanged.push("price");
           }
           continue;
        }

        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }

        // 🟢 RETIREMENT GUARD
        if (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey)) {
            skippedKeys.push(fullKey);
            continue;
        }

        // 🟢 STRICT NAMESPACE ENFORCEMENT FOR THE 11 CUSTOM KEYS
        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            continue;
        }

        // 🟢 STRICT ALLOWLIST ENFORCEMENT
        if (!ALLOWED_TAB3_KEYS.includes(key) && !ALLOWED_TAB3_KEYS.includes(fullKey)) {
            unsupportedKeys.push(fullKey);
            continue;
        }

        // 🟢 BLOCKED KEYS UNTIL VERIFIED
        if (key === "jewelry_type") {
            blockedFields[fullKey] = "Safety block active on jewelry_type taxonomy destination.";
            continue;
        }

        const currentVal = currentMetafields[fullKey] || null;
        const valStr = String(val !== null && val !== undefined ? val : "").trim();
        
        // Blank strings must not implicitly delete. 
        if (valStr === "") {
            if (!currentVal) unchanged.push(fullKey);
            else skippedKeys.push(fullKey);
            continue; 
        }

        // Resolve exact type from definition or stored type
        const def = defs[fullKey];
        const storedType = currentMetafieldsTypes[fullKey];
        let resolvedType = def ? def.type : storedType;

        if (def && storedType && def.type !== storedType) {
            blockedFields[fullKey] = `Type conflict: Definition is ${def.type} but stored is ${storedType}`;
            continue;
        }
        if (!resolvedType) {
            blockedFields[fullKey] = "No exact live definition or stored type available; fallback mappings are strictly forbidden.";
            continue;
        }

        let resolvedValue = normalizeMetafieldValue(key, valStr);
        if (key === "generated_description") {
            resolvedValue = sanitizeDescription(resolvedValue);
            if (currentNativeBodyHtml !== resolvedValue) {
                nativeInput.descriptionHtml = resolvedValue;
                doNativeUpdate = true;
                proposedChanges["native_description"] = { from: currentNativeBodyHtml, to: resolvedValue };
                attemptedDestinations.push("native_description");
            } else {
                unchanged.push("native_description");
            }
        }
        
        if (key === "seo_title") {
            if (currentNativeSeoTitle !== resolvedValue) {
                nativeInput.seo = nativeInput.seo || {};
                nativeInput.seo.title = resolvedValue;
                doNativeUpdate = true;
                proposedChanges["native_seo_title"] = { from: currentNativeSeoTitle, to: resolvedValue };
                attemptedDestinations.push("native_seo_title");
            } else {
                unchanged.push("native_seo_title");
            }
        }

        if (resolvedType === "number_decimal" || resolvedType === "number_integer") {
          const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
          if (isNaN(parsedNum)) {
             blockedFields[fullKey] = `Invalid numeric value: ${resolvedValue}`;
             continue;
          }
          resolvedValue = resolvedType === "number_integer" ? String(Math.round(parsedNum)) : String(parsedNum);
        } else if (resolvedType.includes("metaobject_reference")) {
          
          let idsToVerify = [];
          
          if (resolvedType.includes("list.")) {
             try {
                const parsed = JSON.parse(resolvedValue);
                if (!Array.isArray(parsed)) throw new Error();
                
                for (const item of parsed) {
                    if (!String(item).startsWith("gid://shopify/Metaobject/")) {
                        throw new Error(`Invalid item: ${item}`);
                    }
                    idsToVerify.push(String(item));
                }
                resolvedValue = JSON.stringify(parsed);
             } catch (e) {
                if (resolvedValue.startsWith("gid://shopify/Metaobject/")) {
                    idsToVerify.push(resolvedValue);
                    resolvedValue = JSON.stringify([resolvedValue]);
                } else {
                    blockedFields[fullKey] = `Requires valid JSON array of metaobject reference IDs, got text instead.`;
                    continue;
                }
             }
          } else {
             if (!String(resolvedValue).startsWith("gid://shopify/Metaobject/")) {
                blockedFields[fullKey] = `Requires metaobject reference ID, got plain text.`;
                continue;
             }
             idsToVerify.push(String(resolvedValue));
          }

          // Strict Structural Metaobject Validation
          const requiredDefId = def?.requiredDefinitionId;
          if (!requiredDefId) {
             blockedFields[fullKey] = "Destination field lacks a required metaobject definition ID restriction.";
             continue;
          }

          let allValid = true;
          for (const moId of idsToVerify) {
              if (moValidationCache.has(moId)) {
                 const cachedDefId = moValidationCache.get(moId);
                 if (cachedDefId !== requiredDefId) {
                     blockedFields[fullKey] = `Reference ${moId} belongs to def ${cachedDefId}, but field requires ${requiredDefId}`;
                     allValid = false;
                     break;
                 }
              } else {
                 try {
                     const moRes = await admin.graphql(`
                        query getMetaobject($id: ID!) {
                           metaobject(id: $id) {
                              definition { id }
                           }
                        }
                     `, { variables: { id: moId } });
                     const moJson = await moRes.json();
                     const actualDefId = moJson?.data?.metaobject?.definition?.id;
                     
                     if (!actualDefId) {
                         blockedFields[fullKey] = `Metaobject ${moId} not found or missing definition.`;
                         allValid = false;
                         break;
                     }
                     
                     moValidationCache.set(moId, actualDefId);
                     
                     if (actualDefId !== requiredDefId) {
                         blockedFields[fullKey] = `Reference ${moId} belongs to def ${actualDefId}, but field requires ${requiredDefId}`;
                         allValid = false;
                         break;
                     }
                 } catch (e) {
                     blockedFields[fullKey] = `Validation lookup failed for ${moId}: ${e.message}`;
                     allValid = false;
                     break;
                 }
              }
          }
          
          if (!allValid) continue;

        } else if (resolvedType === "list.single_line_text_field") {
          try {
             const parsed = JSON.parse(resolvedValue);
             if (!Array.isArray(parsed)) throw new Error();
             resolvedValue = JSON.stringify(parsed);
          } catch {
             if (!resolvedValue.startsWith("[")) resolvedValue = JSON.stringify([resolvedValue]);
          }
        } else if (resolvedType === "multi_line_text_field") {
          if (resolvedValue.length > 10000) {
             blockedFields[fullKey] = `Value exceeds 10,000 characters limit`;
             continue;
          }
        } else {
          if (resolvedValue.length > 255) {
             blockedFields[fullKey] = `Value exceeds 255 characters limit`;
             continue;
          }
        }

        if (currentVal !== resolvedValue) {
            setToShopify.push({ ownerId: productGid, namespace: ns, key: key, type: resolvedType, value: resolvedValue });
            proposedChanges[fullKey] = { from: currentVal, to: resolvedValue };
            attemptedDestinations.push(fullKey);
        } else {
            unchanged.push(fullKey);
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

        // 🟢 RETIREMENT GUARD
        if (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey)) {
            skippedKeys.push(fullKey);
            return;
        }

        // 🟢 STRICT NAMESPACE ENFORCEMENT
        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            return;
        }

        // 🟢 STRICT ALLOWLIST ENFORCEMENT FOR DELETES
        if (!ALLOWED_TAB3_KEYS.includes(key) && !ALLOWED_TAB3_KEYS.includes(fullKey)) {
            unsupportedKeys.push(fullKey);
            return;
        }

        if (currentMetafields[fullKey] !== undefined) {
           deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
           proposedChanges[fullKey] = { from: currentMetafields[fullKey], to: null };
           attemptedDestinations.push(fullKey);
        } else {
           unchanged.push(fullKey);
        }
      });

      if (attemptedDestinations.length === 0) {
          const hasIntendedThatFailed = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;
          if (hasIntendedThatFailed) {
              return Response.json({
                  intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_BLOCKED",
                  message: "No changes executed. Some requested changes were blocked or unsupported.",
                  fieldsUpdated: 0, legacyKeysRemoved: 0,
                  currentMetafields, repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
                  variantTarget: priceVariantGid || null
              });
          }
          return Response.json({
              intent: "executeRepairPlan", pieceId, success: true, status: "NO_CHANGES_REQUIRED",
              fieldsUpdated: 0, legacyKeysRemoved: 0, message: "No intended changes required.",
              currentMetafields, repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
              variantTarget: priceVariantGid || null
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

      let nativeWriteSucceeded = false;
      if (doNativeUpdate) {
        try {
          const nativeResponse = await admin.graphql(
            `#graphql
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product { id }
                userErrors { field message }
              }
            }`,
            { variables: { input: nativeInput } }
          );
          const nativeJson = await nativeResponse.json();
          if (nativeJson?.data?.productUpdate?.userErrors?.length) {
            allErrors.push(...nativeJson.data.productUpdate.userErrors);
          } else {
            nativeWriteSucceeded = true;
          }
        } catch (nativeErr) {
          allErrors.push({ message: `API Error on Native Update: ${nativeErr.message}` });
        }
      }

      let priceWriteSucceeded = false;
      if (doPriceUpdate) {
        try {
          const priceResponse = await admin.graphql(
            `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                product { id }
                productVariants { id price }
                userErrors { field message }
              }
            }`,
            { variables: { productId: productGid, variants: [{ id: priceVariantGid, price: newPriceString }] } }
          );
          const priceJson = await priceResponse.json();
          const bulkData = priceJson?.data?.productVariantsBulkUpdate;
          if (bulkData?.userErrors?.length) {
            allErrors.push(...bulkData.userErrors);
          } else if (!bulkData?.productVariants || !bulkData.productVariants.some(v => v.id === priceVariantGid)) {
            allErrors.push({ message: "Price update accepted by API but variant was not returned in success payload." });
          } else {
            priceWriteSucceeded = true;
          }
        } catch (priceErr) {
          allErrors.push({ message: `API Error on Price Update: ${priceErr.message}` });
        }
      }
      
      let shippingWeightSucceeded = false;
      if (doShippingWeightUpdate) {
         try {
            const swResponse = await admin.graphql(`
               #graphql
               mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
                  inventoryItemUpdate(id: $id, input: $input) {
                     inventoryItem { id measurement { weight { value unit } } }
                     userErrors { field message }
                  }
               }
            `, { variables: { id: shippingWeightInput.id, input: { measurement: shippingWeightInput.measurement } } });
            
            const swJson = await swResponse.json();
            const swData = swJson?.data?.inventoryItemUpdate;
            if (swData?.userErrors?.length) {
               allErrors.push(...swData.userErrors);
            } else {
               shippingWeightSucceeded = true;
            }
         } catch (swErr) {
            allErrors.push({ message: `API Error on Shipping Weight Update: ${swErr.message}` });
         }
      }

      let imageAltUpdatesSucceeded = 0;
      if (doImageAltUpdates) {
         for (const imgInput of imageAltInputs) {
            try {
               const imgResponse = await admin.graphql(`
                  #graphql
                  mutation productUpdateMedia($media: [UpdateMediaInput!]!, $productId: ID!) {
                     productUpdateMedia(media: $media, productId: $productId) {
                        media { ... on MediaImage { id alt } }
                        userErrors { field message }
                     }
                  }
               `, { variables: { productId: productGid, media: [{ id: imgInput.id, alt: imgInput.alt }] } });
               
               const imgJson = await imgResponse.json();
               const imgData = imgJson?.data?.productUpdateMedia;
               
               if (imgData?.userErrors?.length) {
                  allErrors.push(...imgData.userErrors);
               } else {
                  imageAltUpdatesSucceeded++;
               }
            } catch (imgErr) {
               allErrors.push({ message: `API Error on Image Alt Update for ${imgInput.id}: ${imgErr.message}` });
            }
         }
      }

      if (allErrors.length > 0) {
         return Response.json({ 
             intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
             errors: allErrors, currentMetafields, repairPlan, proposedChanges, fieldsUpdated: 0, legacyKeysRemoved: 0,
             conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write produced unhandled errors.",
             variantTarget: priceVariantGid || null
         });
      }

      await new Promise(r => setTimeout(r, 600)); 
      
      let readBackVariantId = null;
      if (doPriceUpdate) readBackVariantId = priceVariantGid;
      if (doShippingWeightUpdate && nativeChanges.shippingWeight?.variantId) readBackVariantId = nativeChanges.shippingWeight.variantId;
      
      const readBackQuery = `
        query getProductAndVariant($id: ID!${readBackVariantId ? ', $variantId: ID!' : ''}) {
          product(id: $id) { 
            title 
            descriptionHtml 
            seo { title description }
            media(first: 50) { edges { node { ... on MediaImage { id alt } } } }
            metafields(first: 250) { edges { node { namespace key value } } } 
          }
          ${readBackVariantId ? `
          node(id: $variantId) {
            ... on ProductVariant { 
               id 
               price 
               product { id } 
               inventoryItem { measurement { weight { value unit } } }
            }
          }
          ` : ''}
        }
      `;
      const readBackVars = { id: productGid };
      if (readBackVariantId) readBackVars.variantId = readBackVariantId;
      
      const readBackResponse = await admin.graphql(readBackQuery, { variables: readBackVars });
      
      const readBackData = await readBackResponse.json();
      const readBackProduct = readBackData?.data?.product || {};
      const actualTitle = readBackProduct.title || "";
      const actualBodyHtml = readBackProduct.descriptionHtml || "";
      const actualSeoTitle = readBackProduct.seo?.title || "";
      const actualMedia = readBackProduct.media?.edges || [];

      const newMetaList = readBackProduct.metafields?.edges || [];
      const newMetafields = {};
      newMetaList.forEach(e => { newMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value; });

      let readBackVerified = true;
      const conflicts = {};

      if (doPriceUpdate) {
         if (!priceWriteSucceeded) {
             readBackVerified = false;
             unresolvedChanges["price"] = { reason: "API mutation failed", expected: newPriceString, actual: "Unchanged" };
         } else {
             const variantNode = readBackData?.data?.node;
             if (!variantNode || variantNode.id !== priceVariantGid || typeof variantNode.price !== "string") {
                 readBackVerified = false;
                 unresolvedChanges["price"] = { reason: "Missing, detached, or malformed variant node", expected: newPriceString, actual: "Unknown" };
                 conflicts["price"] = { expected: newPriceString, actual: "Missing, detached, or malformed variant node" };
             } else {
                 const getCents = (str) => {
                     const parts = (str || "0").split(".");
                     const dollars = parts[0];
                     const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
                     return BigInt(dollars + cents);
                 };
                 if (getCents(variantNode.price) !== getCents(newPriceString)) {
                     readBackVerified = false;
                     unresolvedChanges["price"] = { reason: "Read-back mismatch", expected: newPriceString, actual: variantNode.price };
                     conflicts["price"] = { expected: newPriceString, actual: variantNode.price };
                 } else {
                     priceReadBackVerified = true;
                     verifiedDestinations.push("price");
                 }
             }
         }
      }

      if (doNativeUpdate) {
          if (!nativeWriteSucceeded) {
              readBackVerified = false;
              if (nativeInput.descriptionHtml !== undefined) unresolvedChanges["native_description"] = { reason: "API mutation failed", expected: nativeInput.descriptionHtml, actual: "Unchanged" };
              if (nativeInput.seo?.title !== undefined) unresolvedChanges["native_seo_title"] = { reason: "API mutation failed", expected: nativeInput.seo.title, actual: "Unchanged" };
              if (nativeInput.title !== undefined) unresolvedChanges["native_title"] = { reason: "API mutation failed", expected: nativeInput.title, actual: "Unchanged" };
          } else {
              if (nativeInput.descriptionHtml !== undefined) {
                 if (nativeInput.descriptionHtml !== actualBodyHtml) {
                     readBackVerified = false;
                     unresolvedChanges["native_description"] = { reason: "Read-back mismatch", expected: nativeInput.descriptionHtml, actual: actualBodyHtml };
                     conflicts["native_description"] = { expected: nativeInput.descriptionHtml, actual: actualBodyHtml };
                 } else {
                     verifiedDestinations.push("native_description");
                 }
              }
              if (nativeInput.seo?.title !== undefined) {
                 if (nativeInput.seo.title !== actualSeoTitle) {
                     readBackVerified = false;
                     unresolvedChanges["native_seo_title"] = { reason: "Read-back mismatch", expected: nativeInput.seo.title, actual: actualSeoTitle };
                     conflicts["native_seo_title"] = { expected: nativeInput.seo.title, actual: actualSeoTitle };
                 } else {
                     verifiedDestinations.push("native_seo_title");
                 }
              }
              if (nativeInput.title !== undefined) {
                 if (nativeInput.title !== actualTitle) {
                     readBackVerified = false;
                     unresolvedChanges["native_title"] = { reason: "Read-back mismatch", expected: nativeInput.title, actual: actualTitle };
                     conflicts["native_title"] = { expected: nativeInput.title, actual: actualTitle };
                 } else {
                     verifiedDestinations.push("native_title");
                 }
              }
          }
      }
      
      if (doShippingWeightUpdate) {
         if (!shippingWeightSucceeded) {
             readBackVerified = false;
             unresolvedChanges["native_shipping_weight"] = { reason: "API mutation failed", expected: shippingWeightInput.measurement.weight.value, actual: "Unchanged" };
         } else {
             const variantNode = readBackData?.data?.node;
             if (!variantNode || variantNode.id !== nativeChanges.shippingWeight.variantId) {
                readBackVerified = false;
                unresolvedChanges["native_shipping_weight"] = { reason: "Missing variant node", expected: shippingWeightInput.measurement.weight.value, actual: "Unknown" };
                conflicts["native_shipping_weight"] = { expected: shippingWeightInput.measurement.weight.value, actual: "Missing variant node" };
             } else {
                const actualWeight = variantNode.inventoryItem?.measurement?.weight?.value;
                const actualUnit = variantNode.inventoryItem?.measurement?.weight?.unit;
                const expectedWeight = shippingWeightInput.measurement.weight.value;
                const expectedUnit = shippingWeightInput.measurement.weight.unit;
                
                if (parseFloat(actualWeight) !== parseFloat(expectedWeight) || actualUnit !== expectedUnit) {
                   readBackVerified = false;
                   unresolvedChanges["native_shipping_weight"] = { reason: "Read-back mismatch", expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
                   conflicts["native_shipping_weight"] = { expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
                } else {
                   verifiedDestinations.push("native_shipping_weight");
                }
             }
         }
      }

      if (doImageAltUpdates) {
         for (const imgInput of imageAltInputs) {
            const match = actualMedia.find(m => m.node.id === imgInput.id);
            if (!match || match.node.alt !== imgInput.alt) {
               readBackVerified = false;
               unresolvedChanges[`native_image_alts_${imgInput.id}`] = { reason: "Read-back mismatch", expected: imgInput.alt, actual: match?.node?.alt || "Missing node" };
               conflicts[`native_image_alts_${imgInput.id}`] = { expected: imgInput.alt, actual: match?.node?.alt || "Missing node" };
            } else {
               verifiedDestinations.push(`native_image_alts_${imgInput.id}`);
            }
         }
      }

      setToShopify.forEach(m => {
         const dotKey = `${m.namespace}.${m.key}`;
         const actual = newMetafields[dotKey];
         let expStr = String(m.value).trim();
         let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();
         
         if (m.type === "number_decimal") {
             if (parseFloat(expStr) !== parseFloat(actStr)) {
                 readBackVerified = false;
                 unresolvedChanges[dotKey] = { reason: "Read-back mismatch", expected: expStr, actual: actStr };
                 conflicts[dotKey] = { expected: expStr, actual: actStr };
             } else {
                 verifiedDestinations.push(dotKey);
             }
         } else {
             if (expStr !== actStr) {
                 readBackVerified = false;
                 unresolvedChanges[dotKey] = { reason: "Read-back mismatch", expected: expStr, actual: actStr };
                 conflicts[dotKey] = { expected: expStr, actual: actStr };
             } else {
                 verifiedDestinations.push(dotKey);
             }
         }
      });

      deleteFromShopify.forEach(m => {
         const dotKey = `${m.namespace}.${m.key}`;
         if (newMetafields[dotKey] !== undefined) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = { reason: "Deletion failed", expected: null, actual: newMetafields[dotKey] };
         } else {
             verifiedDestinations.push(dotKey);
         }
      });

      const totalFieldsUpdated = setToShopify.length + (priceReadBackVerified ? 1 : 0) + (nativeTitleUpdated ? 1 : 0) + (doShippingWeightUpdate && shippingWeightSucceeded ? 1 : 0) + imageAltUpdatesSucceeded;

      const hasUnresolved = Object.keys(unresolvedChanges).length > 0;
      const hasExcluded = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;
      
      let finalStatus = "REPAIRED";
      let finalSuccess = true;

      if (hasUnresolved || hasExcluded) {
          finalStatus = "PARTIAL_SUCCESS";
          if (hasUnresolved) finalSuccess = false;
      }

      const diagnosticMsg = finalStatus === "PARTIAL_SUCCESS" 
          ? `Partial execution: ${verifiedDestinations.length} verified. ${Object.keys(unresolvedChanges).length} unresolved, ${Object.keys(blockedFields).length} blocked, ${unsupportedKeys.length} unsupported.` 
          : `Repair successful: ${verifiedDestinations.length} verified destinations.`;

      return Response.json({ 
        intent: "executeRepairPlan", pieceId, success: finalSuccess, status: finalStatus,
        fieldsUpdated: totalFieldsUpdated, legacyKeysRemoved: deleteFromShopify.length,
        message: diagnosticMsg,
        currentMetafields: newMetafields, repairPlan, proposedChanges, conflicts, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified,
        variantTarget: priceVariantGid || null
      });
    }

    if (intent === "saveMetafields" || intent === "cleanMalformedKeys" || intent === "cleanAllCamelKeys" || intent === "stagedUpload" || intent === "createProduct" || intent === "cleanGhostNamespaces" || intent === "cleanAllGhostNamespaces" || intent === "toggleStatus" || intent === "batchAuditItem") {
       return await executeAutofill(intent, body, admin);
    }

    return Response.json({ success: true, intent: intent || "unknown" });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
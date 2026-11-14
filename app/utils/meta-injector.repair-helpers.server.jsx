// ==========================================================================
// ROCKHOUND STUDIO — REPAIR PLAN VALIDATION, STAGING & ERROR-MAPPING HELPERS
// File: app/utils/meta-injector.repair-helpers.server.jsx
// ==========================================================================

import {
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS
} from "./meta-injector.standardized.jsx";
import {
  RETIRED_KEYS
} from "./meta-injector.read-actions.server.jsx";
import {
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES,
  isExactProductVariantGid,
  isPlainTextProposalRejectedForContract,
  validateAgainstLiveTextDefinitionValidations
} from "./bench-v2.contract.jsx";

export const ALLOWED_TAB3_KEYS = [
  "shopify_title", "piece_name", "stone_family", "price", "weight_grams",
  "whole_product_weight_grams", "custom.whole_product_weight_grams",
  "shipping_weight_oz", "is_ooak", "dimensions_mm",
  "surface_finish", "primary_color", "color_pattern", "honest_flaws_and_character",
  "jewelry_type", "wire_material",
  "primary_medium", "secondary_medium", "setting_ready", "bail_included",
  "chain_material", "jewelry_finding_type", "mohs_hardness", "specific_gravity",
  "crystal_system", "fracture_pattern", "cleavage", "luster", "diaphaneity",
  "mineral_class", "geological_era", "rock_formation", "origin_location",
  "origin_handle", "collection_name", "collection_location", "origin_story",
  "seo_title", "alt_text",
  "google_product_category", "generated_description",

  // EXACT CUSTOM DESTINATIONS
  "is_one_of_a_kind", "origin_page_handle",
  "treatment_status", "treated", "chain_link_type",
  "rock_composition", "geological_age", "target_gender",
  "cut_type", "secondary_colors",
  "tenacity",
  "found_object", "collection_date",
  "custom.cut_type", "custom.secondary_colors",
  "custom.tenacity",
  "custom.found_object", "custom.collection_date", "custom.wire_material", "custom.jewelry_type",

  // NATIVE CONTRACT TARGETS (ACCEPTED FOR ROUTING, EXCLUDED FROM CUSTOM NAMESPACE)
  "native_title", "native_price", "native_shipping_weight", "native_image_alts", "native_seo_description",
  "native_seo_title", "native_description",

  // STANDARDIZED TAXONOMY LIST
  "age-group", "chain-link-type", "color-pattern", "shopify.condition", "construction", "crystal-system",
  "geological-era", "jewelry-finding-type", "jewelry-material", "jewelry-type",
  "material", "material-origin", "mineral-class",
  "product-classification", "product-use", "rock-composition", "rock-formation",
  "target-gender"
];

// Strictly enforce these specific keys reside only in the custom namespace
export const STRICT_CUSTOM_KEYS = [
  "is_one_of_a_kind", "origin_page_handle", "rescued_by", "character_marks",
  "treatment_status", "treated", "necklace_design", "chain_link_type",
  "rock_composition", "geological_age", "target_gender",
  "official_name", "stone_story", "cut_type", "secondary_colors",
  "tenacity", "age_group", "condition", "custom_product",
  "found_object", "collection_date", "wire_material",
  "whole_product_weight_grams"
];

export const BENCH_V2_OPT_IN_SUPPORTED_STANDARDIZED_KEY_SET = new Set(
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS
);

export function isRetiredProductMetafieldDestination(ns, key, fullKey, canonicalDestinationKey) {
  if (
    RETIRED_KEYS.includes(key) ||
    RETIRED_KEYS.includes(fullKey) ||
    RETIRED_KEYS.includes(canonicalDestinationKey) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${canonicalDestinationKey}`) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCTVARIANT:${canonicalDestinationKey}`) ||
    REMOVED_PARKED_DESTINATIONS.has(canonicalDestinationKey) ||
    REMOVED_PARKED_DESTINATIONS.has(fullKey)
  ) {
    return true;
  }

  if (
    ns === "custom" &&
    (REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(key) ||
      REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(fullKey) ||
      REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(canonicalDestinationKey))
  ) {
    return true;
  }

  return false;
}

export const CANONICAL_DECIMAL_NUMBER_REGEX = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
export const CANONICAL_USD_TWO_DECIMAL_MONEY_REGEX = /^(?:0|[1-9]\d*)\.\d{2}$/;

export function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

export function normalizeMetafieldValue(key, value) {
  let val = String(value).replace(/^⚠️\s*/, "");
  return val;
}

export function sanitizeDescription(html) {
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

export const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title", "xmp"]);

export function normalizeBareAmpersandsInOrdinaryText(textSegment) {
  return textSegment.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)/g, "&amp;");
}

export function canonicalizeDescriptionHtmlForReadBack(html) {
  if (typeof html !== "string") return null;
  let out = "";
  let i = 0;
  const len = html.length;
  let rawTextTag = null;

  while (i < len) {
    if (rawTextTag !== null) {
      const rest = html.slice(i);
      const closeRe = new RegExp(`^<\\/${rawTextTag}(?=[\\t\\n\\f\\r />])`, "i");
      const m = closeRe.exec(rest);
      if (m) {
        let j = i + m[0].length;
        while (j < len && html[j] !== ">") {
          if (html[j] === "<" || html[j] === '"' || html[j] === "'") return null;
          j++;
        }
        if (j >= len) return null;
        out += html.slice(i, j + 1);
        rawTextTag = null;
        i = j + 1;
        continue;
      }
      const nextLt = html.indexOf("<", i + 1);
      if (nextLt === -1) {
        out += html.slice(i);
        break;
      }
      out += html.slice(i, nextLt);
      i = nextLt;
      continue;
    }

    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += normalizeBareAmpersandsInOrdinaryText(html.slice(i));
      break;
    }

    if (lt > i) {
      out += normalizeBareAmpersandsInOrdinaryText(html.slice(i, lt));
      i = lt;
    }

    if (html.startsWith("<!--", i)) {
      const endComment = html.indexOf("-->", i + 4);
      if (endComment === -1) return null;
      out += html.slice(i, endComment + 3);
      i = endComment + 3;
      continue;
    }

    if (html.startsWith("<![CDATA[", i)) {
      const endCdata = html.indexOf("]]>", i + 9);
      if (endCdata === -1) return null;
      out += html.slice(i, endCdata + 3);
      i = endCdata + 3;
      continue;
    }

    if (/^<![a-zA-Z]/.test(html.slice(i, i + 3)) || html.startsWith("<?", i)) {
      let j = i + 2;
      let quote = null;
      while (j < len) {
        const ch = html[j];
        if (quote) {
          if (ch === quote) quote = null;
        } else {
          if (ch === '"' || ch === "'") quote = ch;
          else if (ch === ">") break;
        }
        j++;
      }
      if (j >= len) return null;
      out += html.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)(?=[\t\n\f\r />])/.exec(html.slice(i));
    if (!tagMatch) {
      return null;
    }

    const isClosing = tagMatch[1] === "/";
    const tagNameLower = tagMatch[2].toLowerCase();
    let j = i + tagMatch[0].length;
    let quote = null;
    while (j < len) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else {
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "<") return null;
        else if (ch === ">") break;
      }
      j++;
    }
    if (j >= len) return null;

    const fullTag = html.slice(i, j + 1);
    const isSelfClosing = !isClosing && /\/\s*>$/.test(fullTag);
    out += fullTag;
    i = j + 1;

    if (!isClosing && !isSelfClosing && RAW_TEXT_ELEMENTS.has(tagNameLower)) {
      rawTextTag = tagNameLower;
    }
  }

  if (rawTextTag !== null) return null;
  return out;
}

export function areDescriptionHtmlEquivalentOnReadBack(expectedHtml, actualHtml) {
  if (typeof expectedHtml !== "string" || typeof actualHtml !== "string") return false;
  if (expectedHtml === actualHtml) return true;
  const canonExpected = canonicalizeDescriptionHtmlForReadBack(expectedHtml);
  if (canonExpected === null) return false;
  const canonActual = canonicalizeDescriptionHtmlForReadBack(actualHtml);
  if (canonActual === null) return false;
  return canonExpected === canonActual;
}

export function parseIndexedMutationFieldIndex(fieldProp, rootFieldName) {
  if (Array.isArray(fieldProp)) {
    const rootIdx = fieldProp.findIndex(part => String(part) === rootFieldName);
    if (rootIdx !== -1 && fieldProp.length > rootIdx + 1) {
      const parsed = Number.parseInt(String(fieldProp[rootIdx + 1]), 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
    if (fieldProp.length >= 2 && String(fieldProp[0]) === "input") {
      const parsed = Number.parseInt(String(fieldProp[1]), 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
  } else if (typeof fieldProp === "string") {
    const trimmed = fieldProp.trim();
    const regex = new RegExp(`(?:^|\\.|\\[)${rootFieldName}(?:\\.|\\[)(\\d+)(?:\\]|\\.|$)`);
    const match = trimmed.match(regex);
    if (match && match[1] !== undefined) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

export function attachChunkDestinationToUserErrors(userErrors, chunkItems, rootFieldName = "metafields") {
  if (!Array.isArray(userErrors)) return [];
  return userErrors.map(err => {
    if (!err || typeof err !== "object") return err;
    const idx = parseIndexedMutationFieldIndex(err.field, rootFieldName);
    const targetItem = idx !== null && Array.isArray(chunkItems) ? chunkItems[idx] : null;
    if (targetItem && targetItem.namespace && targetItem.key) {
      const destination = `${targetItem.namespace}.${targetItem.key}`;
      return {
        ...err,
        destination,
        ownerId: targetItem.ownerId || null,
        namespace: targetItem.namespace,
        key: targetItem.key
      };
    }
    return { ...err };
  });
}

export function attachNativeDestinationToUserErrors(userErrors, nativeInput) {
  if (!Array.isArray(userErrors)) return [];
  const attemptedNativeKeys = [];
  if (nativeInput?.title !== undefined) attemptedNativeKeys.push("native_title");
  if (nativeInput?.descriptionHtml !== undefined) attemptedNativeKeys.push("native_description");
  if (nativeInput?.seo?.title !== undefined) attemptedNativeKeys.push("native_seo_title");
  if (nativeInput?.seo?.description !== undefined) attemptedNativeKeys.push("native_seo_description");

  return userErrors.map(err => {
    if (!err || typeof err !== "object") return err;
    if (err.destination) return { ...err };
    const pathStr = Array.isArray(err.field)
      ? err.field.map(p => String(p)).join(".")
      : (typeof err.field === "string" ? err.field : "");

    let destination = null;
    if (/(?:^|\.)seo\.title(?:$|\.)/i.test(pathStr)) {
      destination = "native_seo_title";
    } else if (/(?:^|\.)seo\.description(?:$|\.)/i.test(pathStr)) {
      destination = "native_seo_description";
    } else if (/(?:^|\.)descriptionHtml(?:$|\.)/i.test(pathStr)) {
      destination = "native_description";
    } else if (/(?:^|\.)title(?:$|\.)/i.test(pathStr) && !/seo/i.test(pathStr)) {
      destination = "native_title";
    } else if (attemptedNativeKeys.length === 1) {
      destination = attemptedNativeKeys[0];
    }

    return destination ? { ...err, destination } : { ...err };
  });
}

export function parsePriceToCentsBigInt(str) {
  const parts = (str || "0").split(".");
  const dollars = parts[0];
  const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
  return BigInt(dollars + cents);
}

/**
 * Stages native product fields (`nativeChanges.title`, `description`, `seoTitle`,
 * `seoDescription`), shipping weight (`nativeChanges.shippingWeight` via the existing
 * `getInventoryItem` read query), and media image alt updates (`nativeChanges.imageAlts`),
 * and exposes the `evaluateAndStageNative*` callbacks used when `repairPlan` contains
 * fallback `native_description`, `native_seo_title`, or `native_seo_description` keys.
 */
export async function stageNativeAndShippingAndMediaChanges({
  admin,
  nativeChanges = {},
  lookupData,
  hasNativeTitleBaseline,
  hasNativeBodyBaseline,
  hasNativeSeoTitleBaseline,
  hasNativeSeoDescriptionBaseline,
  currentNativeTitle,
  currentNativeBodyHtml,
  currentNativeSeoTitle,
  currentNativeSeoDescription,
  nativeInput,
  blockedFields,
  proposedChanges,
  attemptedDestinations,
  unchanged
}) {
  let doNativeUpdate = false;
  let nativeTitleUpdated = false;
  let nativeDescriptionUpdated = false;
  let nativeSeoTitleUpdated = false;
  let nativeSeoDescriptionUpdated = false;

  if (nativeChanges.title !== undefined) {
    const titleStr = String(nativeChanges.title ?? "").trim();
    if (!hasNativeTitleBaseline) {
      blockedFields["native_title"] = "Native product title baseline could not be loaded from Shopify; reload product data before saving.";
    } else if (titleStr === "") {
      blockedFields["native_title"] = "Native product title cannot be empty.";
    } else if (titleStr.length > 255) {
      blockedFields["native_title"] = "Native product title exceeds 255 characters limit.";
    } else if (titleStr !== currentNativeTitle) {
      nativeInput.title = titleStr;
      doNativeUpdate = true;
      nativeTitleUpdated = true;
      proposedChanges["native_title"] = { from: currentNativeTitle, to: titleStr };
      attemptedDestinations.push("native_title");
    } else {
      unchanged.push("native_title");
    }
  }

  const evaluateAndStageNativeDescription = (rawDescStr, allowEmptyBlock) => {
    const sanitizedDescStr = sanitizeDescription(rawDescStr);
    if (!hasNativeBodyBaseline) {
      blockedFields["native_description"] = "Native product description baseline could not be loaded from Shopify; reload product data before saving.";
    } else if (allowEmptyBlock && rawDescStr === "") {
      blockedFields["native_description"] = "Native product description cannot be empty.";
    } else if (sanitizedDescStr !== rawDescStr) {
      blockedFields["native_description"] = "Native product description contains disallowed anchor links that alter approved content; remove disallowed links and re-approve before saving.";
    } else if (sanitizedDescStr.length > 10000) {
      blockedFields["native_description"] = "Native product description exceeds 10,000 characters limit.";
    } else if (sanitizedDescStr !== currentNativeBodyHtml) {
      nativeInput.descriptionHtml = sanitizedDescStr;
      doNativeUpdate = true;
      nativeDescriptionUpdated = true;
      proposedChanges["native_description"] = { from: currentNativeBodyHtml, to: sanitizedDescStr };
      attemptedDestinations.push("native_description");
    } else {
      unchanged.push("native_description");
    }
  };

  if (nativeChanges.description !== undefined) {
    evaluateAndStageNativeDescription(String(nativeChanges.description ?? "").trim(), true);
  }

  const evaluateAndStageNativeSeoTitle = (rawSeoTitleStr, allowEmptyBlock) => {
    const normalizedSeoTitleStr = normalizeMetafieldValue("seo_title", rawSeoTitleStr).trim();
    if (!hasNativeSeoTitleBaseline) {
      blockedFields["native_seo_title"] = "Native SEO title baseline could not be loaded from Shopify; reload product data before saving.";
    } else if (allowEmptyBlock && normalizedSeoTitleStr === "") {
      blockedFields["native_seo_title"] = "Native SEO title cannot be empty.";
    } else if (normalizedSeoTitleStr !== rawSeoTitleStr) {
      blockedFields["native_seo_title"] = "Native SEO title contains warning prefixes that alter approved content; edit and re-approve before saving.";
    } else if (normalizedSeoTitleStr.length > 70) {
      blockedFields["native_seo_title"] = "Native SEO title exceeds 70 characters limit.";
    } else if (normalizedSeoTitleStr !== currentNativeSeoTitle) {
      nativeInput.seo = nativeInput.seo || {};
      nativeInput.seo.title = normalizedSeoTitleStr;
      doNativeUpdate = true;
      nativeSeoTitleUpdated = true;
      proposedChanges["native_seo_title"] = { from: currentNativeSeoTitle, to: normalizedSeoTitleStr };
      attemptedDestinations.push("native_seo_title");
    } else {
      unchanged.push("native_seo_title");
    }
  };

  if (nativeChanges.seoTitle !== undefined) {
    evaluateAndStageNativeSeoTitle(String(nativeChanges.seoTitle ?? "").trim(), true);
  }

  const evaluateAndStageNativeSeoDescription = (seoDescStr, allowEmptyBlock) => {
    if (!hasNativeSeoDescriptionBaseline) {
      blockedFields["native_seo_description"] = "Native SEO description baseline could not be loaded from Shopify; reload product data before saving.";
    } else if (allowEmptyBlock && seoDescStr === "") {
      blockedFields["native_seo_description"] = "Native SEO description cannot be empty.";
    } else if (seoDescStr.length > 160) {
      blockedFields["native_seo_description"] = "SEO description exceeds 160 characters limit.";
    } else if (seoDescStr !== currentNativeSeoDescription) {
      nativeInput.seo = nativeInput.seo || {};
      nativeInput.seo.description = seoDescStr;
      doNativeUpdate = true;
      nativeSeoDescriptionUpdated = true;
      proposedChanges["native_seo_description"] = { from: currentNativeSeoDescription, to: seoDescStr };
      attemptedDestinations.push("native_seo_description");
    } else {
      unchanged.push("native_seo_description");
    }
  };

  if (nativeChanges.seoDescription !== undefined) {
    evaluateAndStageNativeSeoDescription(String(nativeChanges.seoDescription ?? "").trim(), true);
  }

  let doShippingWeightUpdate = false;
  let shippingWeightInput = null;

  if (nativeChanges.shippingWeight) {
    const sw = nativeChanges.shippingWeight;
    const valStr = String(sw.value !== null && sw.value !== undefined ? sw.value : "").trim();

    if (valStr !== "") {
      const parsedNum = parseFloat(valStr);
      if (isNaN(parsedNum) || parsedNum < 0) {
        blockedFields["native_shipping_weight"] = "Shipping weight must be a positive number.";
      } else if (!sw.variantId || !isExactProductVariantGid(sw.variantId)) {
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

  return {
    getDoNativeUpdate: () => doNativeUpdate,
    getNativeTitleUpdated: () => nativeTitleUpdated,
    getNativeDescriptionUpdated: () => nativeDescriptionUpdated,
    getNativeSeoTitleUpdated: () => nativeSeoTitleUpdated,
    getNativeSeoDescriptionUpdated: () => nativeSeoDescriptionUpdated,
    evaluateAndStageNativeDescription,
    evaluateAndStageNativeSeoTitle,
    evaluateAndStageNativeSeoDescription,
    doShippingWeightUpdate,
    shippingWeightInput,
    doImageAltUpdates,
    imageAltInputs
  };
}

/**
 * Evaluates and stages a Bench V2 opt-in variant-owned custom metafield destination
 * (`BENCH_V2_OPT_IN_VARIANT_DESTINATIONS`). Mutates `unsupportedKeys`, `blockedFields`,
 * `unchanged`, `setToShopify`, `proposedChanges`, and `attemptedDestinations` identically
 * to the inline loop and returns `{ attemptedVariantMetafieldWrite: boolean }`.
 */
export function evaluateBenchV2VariantDestinationWrite({
  isBenchV2OptIn,
  fullKey,
  ns,
  key,
  canonicalDestinationKey,
  val,
  productGid,
  callerVariantTargetId,
  productLookupComplete,
  variantTargetStatus,
  verifiedSingleVariantGid,
  variantMetafieldsReadComplete,
  currentVariantMetafields,
  variantMetafieldsReadError,
  variantDefsReadComplete,
  variantDefReadErrors,
  variantDefs,
  currentVariantMetafieldTypes,
  unsupportedKeys,
  blockedFields,
  unchanged,
  setToShopify,
  proposedChanges,
  attemptedDestinations
}) {
  if (!isBenchV2OptIn || fullKey !== canonicalDestinationKey) {
    unsupportedKeys.push(fullKey);
    return { attemptedVariantMetafieldWrite: false };
  }

  if (!callerVariantTargetId || !isExactProductVariantGid(callerVariantTargetId)) {
    blockedFields[fullKey] = `Missing or invalid caller variantTargetId for variant-owned destination ${canonicalDestinationKey}; exact Shopify ProductVariant GID is required.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (!productLookupComplete) {
    blockedFields[fullKey] = `Product lookup did not complete for ${productGid}; cannot verify single-variant membership for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (variantTargetStatus === "multiple_variants_ambiguous") {
    blockedFields[fullKey] = `Ambiguous variant destination on ${canonicalDestinationKey}: product has multiple variants; single-variant target is required.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (variantTargetStatus === "zero_variants") {
    blockedFields[fullKey] = `Invalid variant destination on ${canonicalDestinationKey}: product has zero variants.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (variantTargetStatus !== "single_variant_verified" || !verifiedSingleVariantGid) {
    blockedFields[fullKey] = `Single-variant enumeration could not be verified on ${canonicalDestinationKey} (status: ${variantTargetStatus}).`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (callerVariantTargetId !== verifiedSingleVariantGid) {
    blockedFields[fullKey] = `Caller variantTargetId (${callerVariantTargetId}) does not match the product's verified single variant (${verifiedSingleVariantGid}) for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (!variantMetafieldsReadComplete || !currentVariantMetafields) {
    blockedFields[fullKey] = variantMetafieldsReadError
      ? `Variant metafields baseline read failed on ${verifiedSingleVariantGid}: ${variantMetafieldsReadError}`
      : `Variant metafields baseline read did not complete on ${verifiedSingleVariantGid} for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (!variantDefsReadComplete) {
    blockedFields[fullKey] = variantDefReadErrors.length > 0
      ? `Live PRODUCTVARIANT metafield definition read did not complete for ${canonicalDestinationKey}: ${variantDefReadErrors.join("; ")}`
      : `Live PRODUCTVARIANT metafield definition read did not complete for ${canonicalDestinationKey}; reload product data before saving.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  const varDef = variantDefs[canonicalDestinationKey] || null;
  const varStoredType = currentVariantMetafieldTypes?.[canonicalDestinationKey] || null;

  if (varDef?.constraints && (varDef.constraints.hasConstraints || varDef.constraints.isComplete !== true || varDef.constraints.error)) {
    if (varDef.constraints.isComplete !== true || varDef.constraints.error) {
      blockedFields[fullKey] = varDef.constraints.error || `Incomplete constraint enumeration on PRODUCTVARIANT definition ${canonicalDestinationKey}.`;
      return { attemptedVariantMetafieldWrite: false };
    }
  }

  if (!varDef?.type && !varStoredType) {
    blockedFields[fullKey] = `Neither live PRODUCTVARIANT metafield definition nor stored variant metafield type is available for ${canonicalDestinationKey}; guessing a type is forbidden.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (varDef?.type && varStoredType && varDef.type !== varStoredType) {
    blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: live PRODUCTVARIANT definition is ${varDef.type} but stored variant metafield is ${varStoredType}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  const resolvedVarType = varDef?.type || varStoredType;
  if (resolvedVarType !== "single_line_text_field") {
    blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: observed PRODUCTVARIANT type is ${resolvedVarType}, expected single_line_text_field.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (typeof val !== "string") {
    blockedFields[fullKey] = `Rejected non-string proposal for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  const rawUntrimmedVal = val;
  const valStr = rawUntrimmedVal.trim();
  if (valStr === "") {
    blockedFields[fullKey] = `Blank or whitespace-only proposals are forbidden for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  const normalizedVarVal = normalizeMetafieldValue(key, valStr);
  if (normalizedVarVal !== rawUntrimmedVal) {
    blockedFields[fullKey] = `Proposal for ${canonicalDestinationKey} contains leading/trailing whitespace or warning prefixes that would alter the exact approved value.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (isPlainTextProposalRejectedForContract(rawUntrimmedVal, normalizedVarVal)) {
    blockedFields[fullKey] = `Rejected non-text or reference-shaped proposal for plain-text variant destination ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  if (normalizedVarVal.length > 255) {
    blockedFields[fullKey] = `Value exceeds 255 characters limit for ${canonicalDestinationKey}.`;
    return { attemptedVariantMetafieldWrite: false };
  }

  const liveValidationCheck = validateAgainstLiveTextDefinitionValidations(
    varDef,
    normalizedVarVal,
    canonicalDestinationKey
  );
  if (!liveValidationCheck.valid) {
    blockedFields[fullKey] = liveValidationCheck.reason;
    return { attemptedVariantMetafieldWrite: false };
  }

  const hasCurrentVarProp = Object.prototype.hasOwnProperty.call(
    currentVariantMetafields,
    canonicalDestinationKey
  );
  const currentVarVal = hasCurrentVarProp
    ? currentVariantMetafields[canonicalDestinationKey]
    : null;

  if (hasCurrentVarProp && typeof currentVarVal === "string" && currentVarVal === normalizedVarVal) {
    unchanged.push(canonicalDestinationKey);
    return { attemptedVariantMetafieldWrite: false };
  }

  setToShopify.push({
    ownerId: verifiedSingleVariantGid,
    ownerType: "PRODUCTVARIANT",
    namespace: ns,
    key: key,
    type: resolvedVarType,
    value: normalizedVarVal
  });
  proposedChanges[canonicalDestinationKey] = {
    owner: "PRODUCTVARIANT",
    variantId: verifiedSingleVariantGid,
    from: currentVarVal,
    to: normalizedVarVal
  };
  attemptedDestinations.push(canonicalDestinationKey);
  return { attemptedVariantMetafieldWrite: true };
}
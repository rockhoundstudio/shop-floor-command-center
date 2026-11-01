// ==========================================================================
// ROCKHOUND STUDIO — MATRIX BASELINE, KEEP-ORIGINAL & CLEANUP PREVIEW OWNER
// File: app/utils/meta-injector.matrix-baseline.jsx
// Pure browser-safe baseline inspection, Keep-Original decision contract,
// catalog/destination/approval-key primitives, and one-time current-stock
// bezel cleanup preview helper. Zero DB, zero network, zero server imports.
// ==========================================================================

import {
  TAB3_PARKED_DRAWER_HEADING,
  TAB3_INSPECTABLE_TEMPLATE_GROUPS,
  EXCLUDED_CATALOG_FIELDS
} from "./meta-injector.constants.jsx";
import {
  isSettingOrHardwareMediumTokenInDomain
} from "./meta-injector.standardized.jsx";
import {
  isExactProductGid,
  isExactMediaImageGid
} from "./bench-v2.observation.jsx";

export const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "native_seo_title": 70,
  "native_seo_description": 160,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.alt_text": 255,
  "custom.honest_flaws_and_character": 255
};

export const NATIVE_FIELDS = ["price", "shopify_title"];

export const NATIVE_ALIAS_MAP = {
  "native_title": "shopify_title",
  "native_description": "custom.generated_description",
  "native_seo_title": "custom.seo_title",
  "native_shipping_weight": "custom.shipping_weight_oz",
  "native_price": "price"
};

export const DESTINATION_SPECIFIC_APPROVAL_KEYS = new Set([
  "native_description",
  "custom.generated_description",
  "native_seo_title",
  "custom.seo_title",
  "custom.alt_text"
]);

export const resolveApprovalStorageKey = (key) => {
  if (typeof key !== "string") return "";
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed === "generated_description") return "custom.generated_description";
  if (trimmed === "seo_title") return "custom.seo_title";
  if (trimmed === "alt_text") return "custom.alt_text";
  if (DESTINATION_SPECIFIC_APPROVAL_KEYS.has(trimmed)) {
    return trimmed;
  }
  return NATIVE_ALIAS_MAP[trimmed] || trimmed;
};

export const isExactProductGidString = (val) =>
  typeof val === "string" && isExactProductGid(val.trim());

export const isExactMediaImageGidString = (val) =>
  typeof val === "string" && isExactMediaImageGid(val.trim());

export const hasStoredNonBlankGeneralAltMetafield = (manifest) => {
  if (!manifest || typeof manifest !== "object") return false;
  const cm = manifest.currentMetafields;
  if (!cm || typeof cm !== "object" || Array.isArray(cm)) return false;
  const raw = Object.prototype.hasOwnProperty.call(cm, "custom.alt_text")
    ? cm["custom.alt_text"]
    : cm["alt_text"];
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
};

export const hasVerifiedLoadedDestinationBaseline = (destKey, data, expectedProductId) => {
  if (!data || typeof data !== "object") return false;
  if (!isExactProductGidString(expectedProductId)) return false;

  const cleanProductId = expectedProductId.trim();
  const manifestProductId =
    (typeof data.nativeTargets?.productId === "string" && data.nativeTargets.productId.trim()) ||
    (typeof data.productId === "string" && data.productId.trim()) ||
    null;

  if (!manifestProductId || manifestProductId !== cleanProductId) {
    return false;
  }

  const unverifiedFields = Array.isArray(data.nativeTargets?.unverifiedFields)
    ? data.nativeTargets.unverifiedFields
    : [];

  if (destKey === "native_description") {
    if (unverifiedFields.includes("descriptionHtml")) return false;
    return typeof data.nativeTargets?.descriptionHtml === "string";
  }

  if (destKey === "native_seo_title") {
    if (unverifiedFields.includes("seo")) return false;
    const seoObj = data.nativeTargets?.seo;
    if (!seoObj || typeof seoObj !== "object" || Array.isArray(seoObj)) return false;
    if (!Object.prototype.hasOwnProperty.call(seoObj, "title")) return false;
    return typeof seoObj.title === "string" || seoObj.title === null;
  }

  if (destKey === "native_seo_description") {
    if (unverifiedFields.includes("seo")) return false;
    const seoObj = data.nativeTargets?.seo;
    if (!seoObj || typeof seoObj !== "object" || Array.isArray(seoObj)) return false;
    if (!Object.prototype.hasOwnProperty.call(seoObj, "description")) return false;
    return typeof seoObj.description === "string" || seoObj.description === null;
  }

  if (destKey === "native_title" || destKey === "shopify_title") {
    if (unverifiedFields.includes("productTitle")) return false;
    return typeof data.nativeTargets?.productTitle === "string";
  }

  if (destKey === "custom.generated_description" || destKey === "custom.seo_title") {
    if (
      !data.currentMetafields ||
      typeof data.currentMetafields !== "object" ||
      Array.isArray(data.currentMetafields)
    ) {
      return false;
    }
    if (data.readBackVerified === false) {
      return false;
    }
    const hasLoadedProductContext =
      data.intent === "loadProductData" ||
      data.intent === "executeRepairPlan" ||
      data.diagnostics?.shopifyRead === "Success" ||
      typeof data.nativeTargets?.productTitle === "string" ||
      typeof data.productTitle === "string";
    return Boolean(hasLoadedProductContext);
  }

  if (destKey === "custom.alt_text" || destKey === "alt_text") {
    if (
      !data.currentMetafields ||
      typeof data.currentMetafields !== "object" ||
      Array.isArray(data.currentMetafields)
    ) {
      return false;
    }
    if (data.readBackVerified === false) {
      return false;
    }
    const hasLoadedProductContext =
      data.intent === "loadProductData" ||
      data.intent === "executeRepairPlan" ||
      data.diagnostics?.shopifyRead === "Success" ||
      typeof data.nativeTargets?.productTitle === "string" ||
      typeof data.productTitle === "string";
    // Only allow writing to custom.alt_text when the compatibility metafield already exists on the loaded product
    return Boolean(hasLoadedProductContext && hasStoredNonBlankGeneralAltMetafield(data));
  }

  return true;
};

export const CANONICAL_READ_COMPANIONS = Object.freeze({
  "custom.material": ["custom.primary_medium", "primary_medium"],
  "custom.is_one_of_a_kind": ["custom.is_ooak", "is_ooak"],
  "custom.origin_page_handle": ["custom.origin_handle", "origin_handle"],
  "custom.cut_and_shape": ["custom.cut_type", "cut_type"]
});

export const formatLabel = (key) => {
  const parts = key.split('.');
  const name = parts[parts.length - 1];
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export function resolveConfigFieldDestination(f) {
  if (!f) return "";
  if (f.owner === "native" || f.namespace === "native" || f.role === "native_control" || f.key?.startsWith("native_")) {
    return f.key;
  }
  if (f.registryRole === "EXCLUDED_INPUT" && typeof f.registryIdentity === "string" && f.registryIdentity.trim() !== "") {
    return f.registryIdentity.trim();
  }
  if (NATIVE_FIELDS.includes(f.key)) {
    return f.key;
  }
  if (f.role === "standardized_attribute" || f.namespace === "shopify") {
    const mk = f.metaKey || (typeof f.key === "string" ? f.key.replace(/^std_/, "").replace(/_/g, "-") : "");
    return `shopify.${mk}`;
  }
  if (f.namespace && f.metaKey) {
    return `${f.namespace}.${f.metaKey}`;
  }
  if (typeof f.key === "string" && f.key.includes(".")) {
    return f.key;
  }
  const ns = f.namespace || "custom";
  return `${ns}.${f.metaKey || f.key}`;
}

export const PARKED_EXCLUDED_CATALOG_BY_IDENTITY = (() => {
  const map = new Map();
  const parkedGroup = (TAB3_INSPECTABLE_TEMPLATE_GROUPS || []).find(
    (g) => g && (g.heading === TAB3_PARKED_DRAWER_HEADING || g.isParkedGroup === true)
  );
  const parkedFields = [
    ...(Array.isArray(parkedGroup?.fields) ? parkedGroup.fields : []),
    ...(Array.isArray(EXCLUDED_CATALOG_FIELDS) ? EXCLUDED_CATALOG_FIELDS : [])
  ];
  parkedFields.forEach((f) => {
    if (!f) return;
    if (f.registryIdentity && !map.has(f.registryIdentity)) {
      map.set(f.registryIdentity, f);
    }
    const resolvedDest = resolveConfigFieldDestination(f);
    if (resolvedDest && !map.has(resolvedDest)) {
      map.set(resolvedDest, f);
    }
    if (f.key && !map.has(f.key)) {
      map.set(f.key, f);
    }
  });
  return map;
})();

export const isParkedExcludedKey = (key) => {
  if (typeof key !== "string" || !key.trim()) return false;
  return PARKED_EXCLUDED_CATALOG_BY_IDENTITY.has(key.trim());
};

// ==========================================================================
// KEEP-ORIGINAL BASELINE & DECISION CONTRACTS
// ==========================================================================

const serializeExactStoredValueToken = (val) => {
  if (val === undefined) return "undefined:absent";
  if (val === null) return "null:null";
  const t = typeof val;
  if (t === "boolean") return `boolean:${val ? "true" : "false"}`;
  if (t === "number") return `number:${Number.isFinite(val) ? String(val) : "NaN"}`;
  if (t === "string") return `string:${val}`;
  try {
    return `json:${JSON.stringify(val)}`;
  } catch {
    return `object:${String(val)}`;
  }
};

/**
 * Inspects the actual loaded stored baseline for a field without ever fabricating
 * a baseline from display placeholders (such as "N/A" on collection_date or the
 * zero-image native_image_alt placeholder) or flattening variant-owned fields into product fields.
 * Preserves actual stored types, absence, empty strings, false, and zero.
 */
export function inspectFieldBaselineDescriptor(key, data, expectedProductId = null, templateConfig = null) {
  const safeData = data && typeof data === "object" ? data : {};
  const isExplicitUnselectedDraft = Boolean(
    expectedProductId === null && safeData.isUnselectedDraft === true
  );
  const hasMatchingProductId =
    !isExplicitUnselectedDraft &&
    (!expectedProductId ||
      (isExactProductGidString(expectedProductId) &&
        ((typeof safeData.nativeTargets?.productId === "string" &&
          safeData.nativeTargets.productId.trim() === expectedProductId.trim()) ||
          (typeof safeData.productId === "string" &&
            safeData.productId.trim() === expectedProductId.trim()))));

  const hasLoadedProductManifest = Boolean(
    !isExplicitUnselectedDraft &&
      hasMatchingProductId &&
      safeData.readBackVerified !== false &&
      (safeData.intent === "loadProductData" ||
        safeData.intent === "executeRepairPlan" ||
        safeData.diagnostics?.shopifyRead === "Success" ||
        (safeData.currentMetafields &&
          typeof safeData.currentMetafields === "object" &&
          !Array.isArray(safeData.currentMetafields) &&
          (typeof safeData.nativeTargets?.productTitle === "string" ||
            typeof safeData.productTitle === "string")))
  );

  if (key === "native_image_alt" || templateConfig?.expandsToMediaControls === true && !key.startsWith("native_image_alts_")) {
    return {
      evidenceAvailable: false,
      propertyPresent: false,
      valueType: "placeholder",
      rawValue: undefined,
      sourceKey: null,
      owner: "MEDIAIMAGE",
      signature: "placeholder:native_image_alt",
      note: "Zero-image capability placeholder; not a stored Shopify field."
    };
  }

  if (isExplicitUnselectedDraft) {
    return {
      evidenceAvailable: false,
      propertyPresent: false,
      valueType: "unavailable",
      rawValue: undefined,
      sourceKey: null,
      owner: templateConfig?.registryOwner || "PRODUCT",
      signature: "unavailable:unselected_draft",
      note: "Unsaved new-product draft (no product selected or saved in Shopify)."
    };
  }

  if (!hasLoadedProductManifest) {
    return {
      evidenceAvailable: false,
      propertyPresent: false,
      valueType: "unavailable",
      rawValue: undefined,
      sourceKey: null,
      owner: templateConfig?.registryOwner || "PRODUCT",
      signature: "unavailable:manifest_not_loaded",
      note: "Product manifest baseline is not loaded or verified."
    };
  }

  const variants = Array.isArray(safeData.nativeTargets?.variants?.edges)
    ? safeData.nativeTargets.variants.edges
    : [];
  const isSingleVariantComplete =
    variants.length === 1 &&
    safeData.nativeTargets?.variants?.pageInfo?.hasNextPage === false &&
    safeData.nativeTargets?.isComplete === true &&
    !safeData.nativeTargets?.loadError;
  const unverifiedNativeFields = Array.isArray(safeData.nativeTargets?.unverifiedFields)
    ? safeData.nativeTargets.unverifiedFields
    : [];

  if (key.startsWith("native_image_alts_")) {
    const imageId = key.replace("native_image_alts_", "");
    const mediaEdges = Array.isArray(safeData.nativeTargets?.media?.edges)
      ? safeData.nativeTargets.media.edges
      : null;
    if (!mediaEdges || safeData.nativeTargets?.isComplete === false || safeData.nativeTargets?.loadError || unverifiedNativeFields.includes("media")) {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: imageId,
        owner: "MEDIAIMAGE",
        signature: `unavailable:media:${imageId}`,
        note: "MediaImage baseline is incomplete or unverified."
      };
    }
    const matchedEdge = mediaEdges.find((e) => e?.node?.id === imageId);
    if (!matchedEdge || !matchedEdge.node || typeof matchedEdge.node.alt !== "string") {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: imageId,
        owner: "MEDIAIMAGE",
        signature: `unavailable:media_node:${imageId}`,
        note: "MediaImage node alt baseline not found."
      };
    }
    const rawAlt = matchedEdge.node.alt;
    return {
      evidenceAvailable: true,
      propertyPresent: true,
      valueType: typeof rawAlt,
      rawValue: rawAlt,
      sourceKey: imageId,
      owner: "MEDIAIMAGE",
      signature: `present:${imageId}:${serializeExactStoredValueToken(rawAlt)}`,
      note: null
    };
  }

  if (key === "native_title" || key === "shopify_title") {
    if (unverifiedNativeFields.includes("productTitle") || typeof safeData.nativeTargets?.productTitle !== "string") {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.productTitle",
        owner: "PRODUCT",
        signature: "unavailable:native_title",
        note: "Native productTitle baseline is unverified or unavailable."
      };
    }
    const rawTitle = safeData.nativeTargets.productTitle;
    return {
      evidenceAvailable: true,
      propertyPresent: true,
      valueType: "string",
      rawValue: rawTitle,
      sourceKey: "nativeTargets.productTitle",
      owner: "PRODUCT",
      signature: `present:native_title:${serializeExactStoredValueToken(rawTitle)}`,
      note: null
    };
  }

  if (key === "native_description") {
    if (unverifiedNativeFields.includes("descriptionHtml") || typeof safeData.nativeTargets?.descriptionHtml !== "string") {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.descriptionHtml",
        owner: "PRODUCT",
        signature: "unavailable:native_description",
        note: "Native descriptionHtml baseline is unverified or unavailable."
      };
    }
    const rawDesc = safeData.nativeTargets.descriptionHtml;
    return {
      evidenceAvailable: true,
      propertyPresent: true,
      valueType: "string",
      rawValue: rawDesc,
      sourceKey: "nativeTargets.descriptionHtml",
      owner: "PRODUCT",
      signature: `present:native_description:${serializeExactStoredValueToken(rawDesc)}`,
      note: null
    };
  }

  if (key === "native_seo_title") {
    const seoObj = safeData.nativeTargets?.seo;
    if (
      unverifiedNativeFields.includes("seo") ||
      !seoObj ||
      typeof seoObj !== "object" ||
      Array.isArray(seoObj) ||
      !Object.prototype.hasOwnProperty.call(seoObj, "title") ||
      (typeof seoObj.title !== "string" && seoObj.title !== null)
    ) {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.seo.title",
        owner: "PRODUCT",
        signature: "unavailable:native_seo_title",
        note: "Native SEO title baseline is unverified or unavailable."
      };
    }
    const rawSeoTitle = seoObj.title;
    return {
      evidenceAvailable: true,
      propertyPresent: rawSeoTitle !== null,
      valueType: rawSeoTitle === null ? "null" : typeof rawSeoTitle,
      rawValue: rawSeoTitle,
      sourceKey: "nativeTargets.seo.title",
      owner: "PRODUCT",
      signature: `present:native_seo_title:${serializeExactStoredValueToken(rawSeoTitle)}`,
      note: null
    };
  }

  if (key === "native_seo_description") {
    const seoObj = safeData.nativeTargets?.seo;
    if (
      unverifiedNativeFields.includes("seo") ||
      !seoObj ||
      typeof seoObj !== "object" ||
      Array.isArray(seoObj) ||
      !Object.prototype.hasOwnProperty.call(seoObj, "description") ||
      (typeof seoObj.description !== "string" && seoObj.description !== null)
    ) {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.seo.description",
        owner: "PRODUCT",
        signature: "unavailable:native_seo_description",
        note: "Native SEO description baseline is unverified or unavailable."
      };
    }
    const rawSeoDesc = seoObj.description;
    return {
      evidenceAvailable: true,
      propertyPresent: rawSeoDesc !== null,
      valueType: rawSeoDesc === null ? "null" : typeof rawSeoDesc,
      rawValue: rawSeoDesc,
      sourceKey: "nativeTargets.seo.description",
      owner: "PRODUCT",
      signature: `present:native_seo_description:${serializeExactStoredValueToken(rawSeoDesc)}`,
      note: null
    };
  }

  if (key === "native_price" || key === "price") {
    if (!isSingleVariantComplete || typeof variants[0]?.node?.price !== "string") {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.variants[0].price",
        owner: "PRODUCTVARIANT",
        signature: "unavailable:native_price",
        note: "Single complete variant price baseline is unavailable."
      };
    }
    const rawPrice = variants[0].node.price;
    return {
      evidenceAvailable: true,
      propertyPresent: true,
      valueType: "string",
      rawValue: rawPrice,
      sourceKey: "nativeTargets.variants[0].price",
      owner: "PRODUCTVARIANT",
      signature: `present:native_price:${serializeExactStoredValueToken(rawPrice)}`,
      note: null
    };
  }

  if (key === "native_shipping_weight") {
    if (!isSingleVariantComplete) {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
        owner: "INVENTORYITEM",
        signature: "unavailable:native_shipping_weight",
        note: "Single complete variant shipping weight baseline is unavailable."
      };
    }
    const w = variants[0]?.node?.inventoryItem?.measurement?.weight;
    if (!w || typeof w !== "object" || w.value === undefined || w.value === null || typeof w.unit !== "string") {
      return {
        evidenceAvailable: true,
        propertyPresent: false,
        valueType: "absent",
        rawValue: undefined,
        sourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
        owner: "INVENTORYITEM",
        signature: "absent:native_shipping_weight",
        note: null
      };
    }
    const weightObj = { value: w.value, unit: w.unit };
    return {
      evidenceAvailable: true,
      propertyPresent: true,
      valueType: typeof w.value,
      rawValue: weightObj,
      sourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
      owner: "INVENTORYITEM",
      signature: `present:native_shipping_weight:${serializeExactStoredValueToken(weightObj)}`,
      note: null
    };
  }

  // Variant-owned metafields (PRODUCTVARIANT): never flatten into product-level currentMetafields unless variant metafield map is explicitly provided
  const isVariantOwnedMetafield =
    templateConfig?.owner === "variant_metafield" ||
    (templateConfig?.registryOwner === "PRODUCTVARIANT" &&
      templateConfig?.owner !== "native" &&
      templateConfig?.namespace !== "native");

  if (isVariantOwnedMetafield) {
    const variantNode = isSingleVariantComplete ? variants[0]?.node : null;
    const variantMetafieldsMap =
      (variantNode?.metafields && typeof variantNode.metafields === "object" && !Array.isArray(variantNode.metafields)
        ? variantNode.metafields
        : null) ||
      (safeData.currentVariantMetafields &&
      typeof safeData.currentVariantMetafields === "object" &&
      !Array.isArray(safeData.currentVariantMetafields)
        ? safeData.currentVariantMetafields
        : null);

    if (!variantMetafieldsMap) {
      return {
        evidenceAvailable: false,
        propertyPresent: false,
        valueType: "unavailable",
        rawValue: undefined,
        sourceKey: key,
        owner: "PRODUCTVARIANT",
        signature: `unavailable:variant_metafield:${key}`,
        note: "Variant-owned metafield (PRODUCTVARIANT) baseline is not loaded in product-level currentMetafields."
      };
    }

    const hasVarProp = Object.prototype.hasOwnProperty.call(variantMetafieldsMap, key);
    const rawVarVal = hasVarProp ? variantMetafieldsMap[key] : undefined;
    return {
      evidenceAvailable: true,
      propertyPresent: hasVarProp && rawVarVal !== undefined,
      valueType: !hasVarProp || rawVarVal === undefined ? "absent" : (rawVarVal === null ? "null" : typeof rawVarVal),
      rawValue: rawVarVal,
      sourceKey: hasVarProp ? key : null,
      owner: "PRODUCTVARIANT",
      signature:
        hasVarProp && rawVarVal !== undefined
          ? `present:variant:${key}:${serializeExactStoredValueToken(rawVarVal)}`
          : `absent:variant:${key}`,
      note: null
    };
  }

  const currentMetafields = safeData.currentMetafields;
  if (!currentMetafields || typeof currentMetafields !== "object" || Array.isArray(currentMetafields)) {
    return {
      evidenceAvailable: false,
      propertyPresent: false,
      valueType: "unavailable",
      rawValue: undefined,
      sourceKey: key,
      owner: templateConfig?.registryOwner || "PRODUCT",
      signature: `unavailable:metafield:${key}`,
      note: "currentMetafields map is not loaded."
    };
  }

  const isParkedKey = Boolean(
    templateConfig?.registryRole === "EXCLUDED_INPUT" ||
      templateConfig?.isParkedExcluded === true ||
      isParkedExcludedKey(key)
  );

  let matchedSourceKey = null;
  let rawStoredVal = undefined;

  if (Object.prototype.hasOwnProperty.call(currentMetafields, key)) {
    matchedSourceKey = key;
    rawStoredVal = currentMetafields[key];
  } else if (!key.includes(".") && Object.prototype.hasOwnProperty.call(currentMetafields, `custom.${key}`)) {
    matchedSourceKey = `custom.${key}`;
    rawStoredVal = currentMetafields[`custom.${key}`];
  }

  // Only consult canonical read companions for active canonical working fields, never for parked/excluded entries
  // and never promote a setting/metal/plating string from custom.primary_medium into custom.material baseline.
  if (
    !isParkedKey &&
    (matchedSourceKey === null || rawStoredVal === undefined || rawStoredVal === null || String(rawStoredVal).trim() === "") &&
    CANONICAL_READ_COMPANIONS[key]
  ) {
    for (const compKey of CANONICAL_READ_COMPANIONS[key]) {
      if (Object.prototype.hasOwnProperty.call(currentMetafields, compKey)) {
        const compVal = currentMetafields[compKey];
        if (compVal !== undefined && compVal !== null && String(compVal).trim() !== "") {
          if (key === "custom.material" && isSettingOrHardwareMediumTokenInDomain(compVal)) {
            continue;
          }
          matchedSourceKey = compKey;
          rawStoredVal = compVal;
          break;
        }
      }
    }
  }

  if (matchedSourceKey === null || rawStoredVal === undefined) {
    return {
      evidenceAvailable: true,
      propertyPresent: false,
      valueType: "absent",
      rawValue: undefined,
      sourceKey: null,
      owner: templateConfig?.registryOwner || "PRODUCT",
      signature: `absent:metafield:${key}`,
      note:
        key === "custom.collection_date" || key === "collection_date"
          ? 'No stored metafield value in Shopify (UI displays "N/A" as a display convention, not a stored baseline).'
          : null
    };
  }

  return {
    evidenceAvailable: true,
    propertyPresent: true,
    valueType: rawStoredVal === null ? "null" : (Array.isArray(rawStoredVal) ? "array" : typeof rawStoredVal),
    rawValue: rawStoredVal,
    sourceKey: matchedSourceKey,
    owner: templateConfig?.registryOwner || "PRODUCT",
    signature: `present:${matchedSourceKey}:${serializeExactStoredValueToken(rawStoredVal)}`,
    note: null
  };
}

/**
 * Builds an immutable keep-original decision record bound to the exact product,
 * destination key, verified baseline descriptor, and current proposal string.
 */
export function createKeepOriginalDecisionRecord({
  productId,
  key,
  data,
  propVal,
  templateConfig = null
}) {
  if (!isExactProductGidString(productId)) return null;
  if (typeof key !== "string" || !key.trim()) return null;
  const approvalStorageKey = resolveApprovalStorageKey(key);
  if (
    !approvalStorageKey ||
    approvalStorageKey === "native_image_alt" ||
    isParkedExcludedKey(key) ||
    isParkedExcludedKey(approvalStorageKey)
  ) {
    return null;
  }

  const cleanProductId = productId.trim();
  const baselineDesc = inspectFieldBaselineDescriptor(
    DESTINATION_SPECIFIC_APPROVAL_KEYS.has(approvalStorageKey) ? approvalStorageKey : key,
    data,
    cleanProductId,
    templateConfig
  );
  if (!baselineDesc.evidenceAvailable) {
    return null;
  }

  const proposalSnapshot = propVal === undefined || propVal === null ? "" : String(propVal);
  if (proposalSnapshot.trim() === "") {
    return null;
  }

  return Object.freeze({
    decision: "keep_original",
    productId: cleanProductId,
    destinationKey: approvalStorageKey,
    fieldKey: key,
    baselineSignature: baselineDesc.signature,
    baselinePropertyPresent: Boolean(baselineDesc.propertyPresent),
    baselineValueType: baselineDesc.valueType,
    baselineRawValue: baselineDesc.rawValue !== undefined ? baselineDesc.rawValue : null,
    baselineSourceKey: baselineDesc.sourceKey || null,
    proposalSnapshot,
    decidedAt: new Date().toISOString()
  });
}

/**
 * Validates a stored keep-original decision record against the current product,
 * destination key, live baseline descriptor, and current proposal value.
 * Automatically invalidates if the baseline or proposal has materially changed.
 */
export function isKeepOriginalDecisionValid({
  decisionRecord,
  productId,
  approvalStorageKey,
  baselineDescriptor,
  currentPropVal,
  proposalExists
}) {
  if (!decisionRecord || typeof decisionRecord !== "object") return false;
  if (decisionRecord.decision !== "keep_original") return false;
  if (!isExactProductGidString(productId) || decisionRecord.productId !== productId.trim()) return false;
  if (!approvalStorageKey || decisionRecord.destinationKey !== approvalStorageKey) return false;
  if (!baselineDescriptor || !baselineDescriptor.evidenceAvailable) return false;
  if (!proposalExists) return false;

  if (decisionRecord.baselineSignature !== baselineDescriptor.signature) {
    return false;
  }

  const normalizedCurrentProp =
    currentPropVal === undefined || currentPropVal === null ? "" : String(currentPropVal);
  if (decisionRecord.proposalSnapshot !== normalizedCurrentProp) {
    return false;
  }

  return true;
}

// ==========================================================================
// ONE-TIME CURRENT-STOCK BEZEL CLEANUP PREVIEW HELPER (PURE / NO MUTATION)
// ==========================================================================

const BEZEL_WORD_REGEX = /\bbezel(?:[-\s]?set(?:ting)?s?|\s+bails?|\s+mount(?:ed|ing)?|\s+frames?|\s+rims?|s)?\b/i;
const PINCH_BAIL_REGEX = /\bpinch\s+bails?\b|\bdrilled\s+(?:stone|hole|top|pendant)\b|\bpins?\s+(?:pass(?:ing)?|through)\b/i;
const NEGATED_OR_HISTORICAL_BEZEL_REGEX = /\b(?:no|not|without|non|never|unlike|instead\s+of|rather\s+than|free\s+of|lacks?|lacking)\s+(?:a\s+|an\s+|any\s+)?bezel\b|\bnon[-\s]?bezel\b|\bbezel[-\s]?free\b/i;

const applyCaseAwareReplacement = (matchedText, lowerReplacement) => {
  if (!matchedText) return lowerReplacement;
  if (matchedText === matchedText.toUpperCase() && matchedText !== matchedText.toLowerCase()) {
    return lowerReplacement.toUpperCase();
  }
  const firstChar = matchedText.charAt(0);
  if (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase()) {
    return lowerReplacement.charAt(0).toUpperCase() + lowerReplacement.slice(1);
  }
  return lowerReplacement;
};

/**
 * Surgically replaces unambiguous false bezel fastening phrases in plain text while flagging
 * negated, decorative-rim, or unrecognized/ambiguous "bezel" mentions for manual review.
 */
const transformPlainTextBezelClaims = (rawText) => {
  if (typeof rawText !== "string" || !rawText) {
    return { status: "clean", after: rawText, matchedPhrases: [], reason: null };
  }
  if (!BEZEL_WORD_REGEX.test(rawText)) {
    return { status: "clean", after: rawText, matchedPhrases: [], reason: null };
  }
  if (NEGATED_OR_HISTORICAL_BEZEL_REGEX.test(rawText)) {
    return {
      status: "flagged",
      after: null,
      matchedPhrases: [],
      reason: "Contains negated or historical bezel phrasing (e.g. 'no bezel' / 'without bezel'); flagged for manual review instead of auto-replacing."
    };
  }
  if (PINCH_BAIL_REGEX.test(rawText)) {
    return {
      status: "flagged",
      after: null,
      matchedPhrases: [],
      reason: "Contains both pinch-bail/drilled-hole and bezel wording in the same text; flagged as contradictory for manual review."
    };
  }

  const matchedPhrases = [];
  let working = rawText;

  const phraseRules = [
    {
      regex: /\bwith\s+an\s+integrated\s+bezel\s+bail\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "with an integrated chain loop");
      }
    },
    {
      regex: /\bwith\s+integrated\s+bezel\s+bail\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "with an integrated chain loop");
      }
    },
    {
      regex: /\ban\s+integrated\s+bezel\s+bail\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "an integrated chain loop");
      }
    },
    {
      regex: /\bintegrated\s+bezel\s+bails?\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        const plural = /s$/i.test(m);
        return applyCaseAwareReplacement(m, plural ? "integrated chain loops" : "integrated chain loop");
      }
    },
    {
      regex: /\bbezel\s+setting\s*[\u2014\u2013-]\s*ready\s+to\s+wear\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "glue-on setting \u2014 ready to wear");
      }
    },
    {
      regex: /\bmounted\s+in\s+a\s+bezel\s+setting\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "mounted in a glue-on setting");
      }
    },
    {
      regex: /\bset\s+in\s+a\s+bezel\s+setting\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "set in a glue-on setting");
      }
    },
    {
      regex: /\bin\s+a\s+bezel\s+setting\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "in a glue-on setting");
      }
    },
    {
      regex: /\bbezel[-\s]?set\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "glue-on set");
      }
    },
    {
      regex: /\bbezel\s+settings?\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        const plural = /s$/i.test(m);
        return applyCaseAwareReplacement(m, plural ? "glue-on settings" : "glue-on setting");
      }
    },
    {
      regex: /\bbezel\s+mount(?:ed|ing)\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        const isIng = /ing$/i.test(m);
        return applyCaseAwareReplacement(m, isIng ? "glue-on mounting" : "glue-on mounted");
      }
    }
  ];

  phraseRules.forEach((rule) => {
    working = working.replace(rule.regex, rule.replace);
  });

  // If any "bezel" token still remains after surgical phrase replacement (e.g. "bezel wire", "bezel rim",
  // "bezel bail", or standalone "bezel"), flag for manual review rather than doing a blind regex replace.
  if (/\bbezel/i.test(working)) {
    return {
      status: "flagged",
      after: null,
      matchedPhrases,
      reason: "Contains ambiguous, standalone, or decorative-rim 'bezel' wording that cannot be safely auto-replaced without human review."
    };
  }

  if (working === rawText) {
    return { status: "clean", after: rawText, matchedPhrases: [], reason: null };
  }

  return {
    status: "replaced",
    after: working,
    matchedPhrases,
    reason: `Replaced unambiguous false bezel phrase(s) (${matchedPhrases.join("; ")}) with confirmed glue-on setting / integrated chain loop wording.`
  };
};

/**
 * Surgically transforms text nodes inside HTML while preserving all tags, attributes, href URLs,
 * and structure verbatim. Fails closed (flags) if malformed markup or any tag-attribute "bezel"
 * occurrence is detected.
 */
const transformHtmlBezelClaims = (rawHtml) => {
  if (typeof rawHtml !== "string" || !rawHtml) {
    return { status: "clean", after: rawHtml, matchedPhrases: [], reason: null };
  }
  if (!BEZEL_WORD_REGEX.test(rawHtml)) {
    return { status: "clean", after: rawHtml, matchedPhrases: [], reason: null };
  }

  // Verify well-formed tag boundaries before attempting text-node-only replacement
  const tokens = rawHtml.split(/(<[^>]+>)/g);
  let openAngleCount = 0;
  let closeAngleCount = 0;
  for (let i = 0; i < rawHtml.length; i += 1) {
    if (rawHtml[i] === "<") openAngleCount += 1;
    if (rawHtml[i] === ">") closeAngleCount += 1;
  }
  if (openAngleCount !== closeAngleCount) {
    return {
      status: "flagged",
      after: null,
      matchedPhrases: [],
      reason: "HTML has unbalanced '<' / '>' angle brackets; flagged to avoid risking markup corruption."
    };
  }

  const allMatchedPhrases = [];
  const transformedTokens = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token) {
      transformedTokens.push(token);
      continue;
    }

    if (token.startsWith("<") && token.endsWith(">")) {
      // Tag token: never alter attributes or URLs; if "bezel" appears inside a tag attribute/URL, flag for review
      if (/\bbezel/i.test(token)) {
        return {
          status: "flagged",
          after: null,
          matchedPhrases: allMatchedPhrases,
          reason: "HTML tag attribute or URL contains 'bezel'; flagged to preserve links and attributes intact."
        };
      }
      transformedTokens.push(token);
      continue;
    }

    // Text node token
    if (!BEZEL_WORD_REGEX.test(token)) {
      transformedTokens.push(token);
      continue;
    }

    const res = transformPlainTextBezelClaims(token);
    if (res.status === "flagged") {
      return {
        status: "flagged",
        after: null,
        matchedPhrases: allMatchedPhrases,
        reason: res.reason
      };
    }
    if (res.status === "replaced") {
      allMatchedPhrases.push(...res.matchedPhrases);
      transformedTokens.push(res.after);
    } else {
      transformedTokens.push(token);
    }
  }

  const reconstructed = transformedTokens.join("");
  if (reconstructed === rawHtml) {
    return { status: "clean", after: rawHtml, matchedPhrases: [], reason: null };
  }

  return {
    status: "replaced",
    after: reconstructed,
    matchedPhrases: allMatchedPhrases,
    reason: `Surgically replaced ${allMatchedPhrases.length} false bezel phrase(s) in HTML text nodes while preserving tags, links, stories, specs, and signatures.`
  };
};

const evaluateHardwareFieldBezelCleanup = (destKey, rawStoredVal) => {
  if (rawStoredVal === undefined || rawStoredVal === null) {
    return { status: "clean", after: null, reason: null };
  }
  const strVal = String(rawStoredVal).trim();
  if (!strVal || !/\bbezel/i.test(strVal)) {
    return { status: "clean", after: null, reason: null };
  }
  if (NEGATED_OR_HISTORICAL_BEZEL_REGEX.test(strVal)) {
    return {
      status: "flagged",
      after: null,
      reason: `Negated bezel phrasing in ${destKey} ("${strVal}"); flagged for manual review.`
    };
  }
  if (PINCH_BAIL_REGEX.test(strVal)) {
    return {
      status: "flagged",
      after: null,
      reason: `Contradictory pinch-bail and bezel wording in ${destKey} ("${strVal}"); flagged for manual review.`
    };
  }

  if (destKey === "custom.setting_ready") {
    if (/^bezel\s+setting\s*[\u2014\u2013-]\s*ready\s+to\s+wear$/i.test(strVal) || /^bezel\s+setting$/i.test(strVal)) {
      return {
        status: "replaced",
        after: "Yes",
        reason: 'Retains ready-to-wear status ("Yes" per custom.setting_ready contract) while removing false "Bezel Setting" claim.'
      };
    }
    return {
      status: "flagged",
      after: null,
      reason: `Unrecognized bezel phrasing in custom.setting_ready ("${strVal}"); flagged for manual review.`
    };
  }

  if (destKey === "custom.bail_included") {
    if (/^integrated\s+bezel\s+bail$/i.test(strVal) || /^bezel\s+bail$/i.test(strVal)) {
      return {
        status: "replaced",
        after: "Yes",
        reason: 'Retains top chain-loop/bail presence ("Yes" per custom.bail_included contract) while removing false "Integrated Bezel Bail" claim.'
      };
    }
    return {
      status: "flagged",
      after: null,
      reason: `Unrecognized bezel phrasing in custom.bail_included ("${strVal}"); flagged for manual review.`
    };
  }

  if (destKey === "custom.jewelry_finding_type") {
    const tokens = strVal
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const nonBezelTokens = [];
    let sawRecognizedBezelToken = false;

    for (let i = 0; i < tokens.length; i += 1) {
      const tok = tokens[i];
      if (
        /^integrated\s+bezel\s+bail$/i.test(tok) ||
        /^bezel\s+setting$/i.test(tok) ||
        /^bezel[-\s]?set(?:ting)?$/i.test(tok) ||
        /^bezel\s+bail$/i.test(tok)
      ) {
        sawRecognizedBezelToken = true;
      } else if (/\bbezel/i.test(tok)) {
        return {
          status: "flagged",
          after: null,
          reason: `Ambiguous finding token "${tok}" in custom.jewelry_finding_type ("${strVal}"); flagged for manual review.`
        };
      } else {
        nonBezelTokens.push(tok);
      }
    }

    if (!sawRecognizedBezelToken) {
      return {
        status: "flagged",
        after: null,
        reason: `Ambiguous bezel wording in custom.jewelry_finding_type ("${strVal}"); flagged for manual review.`
      };
    }

    const replacementFinding = "Assorted Glue-In Setting";
    const mergedTokens = nonBezelTokens.some((t) => t.toLowerCase() === replacementFinding.toLowerCase())
      ? nonBezelTokens
      : [replacementFinding, ...nonBezelTokens];

    return {
      status: "replaced",
      after: mergedTokens.join(", "),
      reason: 'Replaces false bezel finding claim with confirmed "Assorted Glue-In Setting" (glue-on setting with integrated chain loop) from supported inventory vocabulary.'
    };
  }

  return {
    status: "flagged",
    after: null,
    reason: `Bezel mention in ${destKey} ("${strVal}") requires manual review.`
  };
};

/**
 * Pure helper that inspects ONLY the explicitly supplied `targetProductIds` against `manifestData`
 * to build a deterministic preview of one-time current-stock bezel cleanup candidates,
 * ambiguity/contradiction flags, pinch-bail preservations, and saved stone-identity writer diagnostics.
 * Never mutates state, never runs on load, and never invents values for unloaded baselines.
 */
export function buildCurrentStockBezelCleanupPreview(manifestData, targetProductIds = []) {
  const safeManifestMap = manifestData && typeof manifestData === "object" ? manifestData : {};
  const rawIds = Array.isArray(targetProductIds) ? targetProductIds : [];
  const capturedProductIds = Array.from(
    new Set(
      rawIds
        .map((id) => (typeof id === "string" ? id.trim() : ""))
        .filter((id) => isExactProductGidString(id))
    )
  );

  const candidates = [];
  const flaggedItems = [];
  const skippedItems = [];
  const unavailableProducts = [];
  const stoneIdentityDiagnostics = [];

  capturedProductIds.forEach((productId) => {
    const manifest = safeManifestMap[productId];
    const manifestPid =
      (typeof manifest?.nativeTargets?.productId === "string" && manifest.nativeTargets.productId.trim()) ||
      (typeof manifest?.productId === "string" && manifest.productId.trim()) ||
      null;

    const hasCompleteBaseline = Boolean(
      manifest &&
      typeof manifest === "object" &&
      manifestPid === productId &&
      manifest.readBackVerified !== false &&
      manifest.currentMetafields &&
      typeof manifest.currentMetafields === "object" &&
      !Array.isArray(manifest.currentMetafields) &&
      manifest.nativeTargets &&
      typeof manifest.nativeTargets === "object" &&
      manifest.nativeTargets.isComplete === true &&
      !manifest.nativeTargets.loadError
    );

    const productTitle =
      (typeof manifest?.nativeTargets?.productTitle === "string" && manifest.nativeTargets.productTitle) ||
      (typeof manifest?.productTitle === "string" && manifest.productTitle) ||
      productId;

    if (!hasCompleteBaseline) {
      unavailableProducts.push({
        productId,
        productTitle,
        reason: !manifest
          ? "Manifest baseline is not loaded for this product ID."
          : manifestPid !== productId
            ? `Manifest productId mismatch (expected ${productId}, found ${manifestPid || "none"}).`
            : "Product nativeTargets or currentMetafields baseline is incomplete or unverified."
      });
      return;
    }

    const cm = manifest.currentMetafields;
    const unverifiedFields = Array.isArray(manifest.nativeTargets?.unverifiedFields)
      ? manifest.nativeTargets.unverifiedFields
      : [];

    // Check saved primary_medium / stone_family hardware contamination & writer limitation diagnostic (Requirement 10)
    const rawSavedMaterial = cm["custom.material"];
    const rawSavedPrimaryMedium = cm["custom.primary_medium"];
    const rawSavedStoneFamily = cm["custom.stone_family"];
    const pmContaminated = isSettingOrHardwareMediumTokenInDomain(rawSavedPrimaryMedium);
    const sfContaminated = isSettingOrHardwareMediumTokenInDomain(rawSavedStoneFamily);
    const matContaminated = isSettingOrHardwareMediumTokenInDomain(rawSavedMaterial);

    if (pmContaminated || sfContaminated || matContaminated) {
      stoneIdentityDiagnostics.push({
        productId,
        productTitle,
        savedMaterial: rawSavedMaterial ?? null,
        savedPrimaryMedium: rawSavedPrimaryMedium ?? null,
        savedStoneFamily: rawSavedStoneFamily ?? null,
        writableCanonicalDestination: "custom.material",
        compatibilityWriterLimitation:
          "app/routes/app.meta-injector-api.jsx skips writing custom.primary_medium and custom.stone_family (compatibility hold). Generation-context protection prevents hardware values from polluting prompts or custom.material, and custom.material is writable, but saved custom.primary_medium / custom.stone_family cannot be overwritten by the current repair writer."
      });
    }

    // Gather all construction/text surfaces on this product to check for pinch-bail construction
    const settingReadyVal = String(cm["custom.setting_ready"] ?? "");
    const bailIncludedVal = String(cm["custom.bail_included"] ?? "");
    const findingTypeVal = String(cm["custom.jewelry_finding_type"] ?? "");
    const generalAltVal = hasStoredNonBlankGeneralAltMetafield(manifest)
      ? String(cm["custom.alt_text"] ?? cm["alt_text"] ?? "")
      : "";
    const nativeDescVal =
      !unverifiedFields.includes("descriptionHtml") && typeof manifest.nativeTargets?.descriptionHtml === "string"
        ? manifest.nativeTargets.descriptionHtml
        : null;
    const customDescVal =
      typeof cm["custom.generated_description"] === "string"
        ? cm["custom.generated_description"]
        : null;
    const mediaEdges =
      !unverifiedFields.includes("media") && Array.isArray(manifest.nativeTargets?.media?.edges)
        ? manifest.nativeTargets.media.edges.filter(
            (e) => e?.node?.id && isExactMediaImageGidString(String(e.node.id)) && typeof e.node.alt === "string"
          )
        : [];

    const hasPinchBailEvidence =
      PINCH_BAIL_REGEX.test(bailIncludedVal) ||
      PINCH_BAIL_REGEX.test(findingTypeVal) ||
      PINCH_BAIL_REGEX.test(settingReadyVal) ||
      PINCH_BAIL_REGEX.test(generalAltVal) ||
      (typeof nativeDescVal === "string" && PINCH_BAIL_REGEX.test(nativeDescVal)) ||
      (typeof customDescVal === "string" && PINCH_BAIL_REGEX.test(customDescVal)) ||
      mediaEdges.some((e) => PINCH_BAIL_REGEX.test(e.node.alt));

    const hasAnyBezelMentionOnProduct =
      /\bbezel/i.test(settingReadyVal) ||
      /\bbezel/i.test(bailIncludedVal) ||
      /\bbezel/i.test(findingTypeVal) ||
      /\bbezel/i.test(generalAltVal) ||
      (typeof nativeDescVal === "string" && /\bbezel/i.test(nativeDescVal)) ||
      (typeof customDescVal === "string" && /\bbezel/i.test(customDescVal)) ||
      mediaEdges.some((e) => /\bbezel/i.test(e.node.alt));

    // Requirement 5: Pinch-bail products (pins through drilled holes) must NEVER be converted to glue-on.
    // If a pinch-bail product ALSO contains contradictory bezel claims, flag each contradictory field as unresolved!
    if (hasPinchBailEvidence) {
      if (!hasAnyBezelMentionOnProduct) {
        skippedItems.push({
          productId,
          productTitle,
          status: "pinch_bail_preserved",
          reason: "Pinch-bail construction (pins through drilled hole) preserved; no bezel claims present."
        });
        return;
      }

      const checkPinchContradiction = (destKey, label, val, mediaImageId = null) => {
        if (typeof val === "string" && /\bbezel/i.test(val)) {
          flaggedItems.push({
            productId,
            productTitle,
            destinationKey: destKey,
            fieldLabel: label,
            mediaImageId,
            beforeValue: val,
            reason: "Contradictory bezel claim on a pinch-bail (drilled-hole) product. Pinch bails are never auto-converted to glue-on; resolve manually."
          });
        }
      };

      checkPinchContradiction("custom.setting_ready", "Setting Ready", settingReadyVal);
      checkPinchContradiction("custom.bail_included", "Bail Included", bailIncludedVal);
      checkPinchContradiction("custom.jewelry_finding_type", "Jewelry Finding Type", findingTypeVal);
      if (hasStoredNonBlankGeneralAltMetafield(manifest)) {
        checkPinchContradiction("custom.alt_text", "Alt Text (General Metafield Compat)", generalAltVal);
      }
      mediaEdges.forEach((edge) => {
        const imgId = edge.node.id;
        checkPinchContradiction(`native_image_alts_${imgId}`, `Native Image Alt (${imgId.split("/").pop()})`, edge.node.alt, imgId);
      });
      if (typeof nativeDescVal === "string") {
        checkPinchContradiction("native_description", "Native Description (descriptionHtml)", nativeDescVal);
      }
      if (typeof customDescVal === "string") {
        checkPinchContradiction("custom.generated_description", "Generated Description (custom.generated_description)", customDescVal);
      }
      return;
    }

    if (!hasAnyBezelMentionOnProduct) {
      skippedItems.push({
        productId,
        productTitle,
        status: "no_bezel_claims",
        reason: "No bezel mentions found in hardware, alt text, or descriptions."
      });
      return;
    }

    const pushCandidateOrFlag = ({
      destinationKey,
      fieldLabel,
      owner,
      mediaImageId = null,
      beforeValue,
      evalResult
    }) => {
      const baselineDesc = inspectFieldBaselineDescriptor(destinationKey, manifest, productId);
      if (!baselineDesc.evidenceAvailable) {
        flaggedItems.push({
          productId,
          productTitle,
          destinationKey,
          fieldLabel,
          mediaImageId,
          beforeValue,
          reason: `Baseline descriptor unavailable for ${destinationKey}; skipped to prevent unverified staging.`
        });
        return;
      }

      if (evalResult.status === "flagged") {
        flaggedItems.push({
          productId,
          productTitle,
          destinationKey,
          fieldLabel,
          mediaImageId,
          beforeValue,
          reason: evalResult.reason
        });
        return;
      }

      if (evalResult.status === "replaced" && typeof evalResult.after === "string" && evalResult.after !== beforeValue) {
        const limit = FIELD_LIMITS[destinationKey] || null;
        if (limit !== null && evalResult.after.length > limit) {
          flaggedItems.push({
            productId,
            productTitle,
            destinationKey,
            fieldLabel,
            mediaImageId,
            beforeValue,
            reason: `Proposed replacement (${evalResult.after.length} chars) exceeds limit (${limit}) for ${destinationKey}; flagged for manual review.`
          });
          return;
        }

        candidates.push({
          candidateId: `${productId}::${destinationKey}`,
          productId,
          productTitle,
          destinationKey,
          approvalStorageKey: resolveApprovalStorageKey(destinationKey),
          fieldLabel,
          owner,
          mediaImageId,
          baselineSignature: baselineDesc.signature,
          beforeValue,
          afterValue: evalResult.after,
          reason: evalResult.reason
        });
      }
    };

    // 1. Hardware fields
    ["custom.setting_ready", "custom.bail_included", "custom.jewelry_finding_type"].forEach((hwKey) => {
      const rawHw = cm[hwKey];
      if (rawHw === undefined || rawHw === null || String(rawHw).trim() === "") return;
      const beforeStr = String(rawHw);
      if (!/\bbezel/i.test(beforeStr)) return;
      const evalRes = evaluateHardwareFieldBezelCleanup(hwKey, beforeStr);
      pushCandidateOrFlag({
        destinationKey: hwKey,
        fieldLabel: formatLabel(hwKey),
        owner: "PRODUCT",
        beforeValue: beforeStr,
        evalResult: evalRes
      });
    });

    // 2. Existing custom.alt_text compatibility field (only when already present on product; never copied from hero alt)
    if (hasStoredNonBlankGeneralAltMetafield(manifest) && /\bbezel/i.test(generalAltVal)) {
      const genAltRes = transformPlainTextBezelClaims(generalAltVal);
      pushCandidateOrFlag({
        destinationKey: "custom.alt_text",
        fieldLabel: "Alt Text (General Metafield Compat)",
        owner: "PRODUCT",
        beforeValue: generalAltVal,
        evalResult: genAltRes
      });
    }

    // 3. Individual MediaImage alts
    mediaEdges.forEach((edge) => {
      const imgId = edge.node.id;
      const rawAlt = edge.node.alt;
      if (typeof rawAlt !== "string" || !/\bbezel/i.test(rawAlt)) return;
      const mediaKey = `native_image_alts_${imgId}`;
      const altRes = transformPlainTextBezelClaims(rawAlt);
      pushCandidateOrFlag({
        destinationKey: mediaKey,
        fieldLabel: `Native Image Alt (${imgId.split("/").pop()})`,
        owner: "MEDIAIMAGE",
        mediaImageId: imgId,
        beforeValue: rawAlt,
        evalResult: altRes
      });
    });

    // 4. Native descriptionHtml (evaluated on its own HTML string)
    if (typeof nativeDescVal === "string" && /\bbezel/i.test(nativeDescVal)) {
      const nativeDescRes = transformHtmlBezelClaims(nativeDescVal);
      pushCandidateOrFlag({
        destinationKey: "native_description",
        fieldLabel: "Native Description (descriptionHtml)",
        owner: "PRODUCT",
        beforeValue: nativeDescVal,
        evalResult: nativeDescRes
      });
    } else if (unverifiedFields.includes("descriptionHtml")) {
      unavailableProducts.push({
        productId,
        productTitle,
        reason: "Native descriptionHtml baseline is marked unverified."
      });
    }

    // 5. Custom generated_description metafield (evaluated independently on its own HTML string)
    if (typeof customDescVal === "string" && /\bbezel/i.test(customDescVal)) {
      const customDescRes = transformHtmlBezelClaims(customDescVal);
      pushCandidateOrFlag({
        destinationKey: "custom.generated_description",
        fieldLabel: "Generated Description (custom.generated_description)",
        owner: "PRODUCT",
        beforeValue: customDescVal,
        evalResult: customDescRes
      });
    }
  });

  return {
    capturedProductIds,
    evaluatedAt: new Date().toISOString(),
    candidates,
    flaggedItems,
    skippedItems,
    unavailableProducts,
    stoneIdentityDiagnostics,
    summary: {
      capturedProductCount: capturedProductIds.length,
      candidateCount: candidates.length,
      affectedProductCount: new Set(candidates.map((c) => c.productId)).size,
      flaggedCount: flaggedItems.length,
      skippedCount: skippedItems.length,
      unavailableCount: unavailableProducts.length,
      stoneIdentityWarningCount: stoneIdentityDiagnostics.length
    }
  };
}
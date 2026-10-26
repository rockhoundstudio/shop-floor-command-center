import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  PRODUCT_TEMPLATE_GROUPS,
  TAB3_PARKED_DRAWER_HEADING,
  TAB3_INSPECTABLE_TEMPLATE_GROUPS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
  PROTECTED_DATA_ENTRIES
} from "./meta-injector.constants.jsx";
import {
  isExactMetaobjectGid,
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList
} from "./meta-injector.standardized.jsx";

export const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  COMPLETE: "Repaired",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

export const UNSELECTED_DRAFT_STORAGE_KEY = "__UNSELECTED_NEW_PRODUCT_DRAFT__";

export const BLOCKED_UNVERIFIED_PINS = [];

export const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "native_seo_title": 70,
  "native_seo_description": 160,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.alt_text": 255,
  "custom.honest_flaws_and_character": 255
};

export const PROTECTED_FIELDS = [
  "custom.material", "custom.stone_family", "custom.surface_finish",
  "custom.color_pattern", "custom.google_product_category", "custom.setting_ready",
  "custom.bail_included", "custom.chain_material", "custom.jewelry_finding_type",
  "shopify_title"
];

export const HARDWARE_FIELDS = [
  "custom.setting_ready", "custom.bail_included", "custom.chain_material",
  "custom.jewelry_finding_type", "custom.wire_material"
];

export const POLICY_PRE_APPROVED_FIELDS = [
  "custom.rarity",
  "custom.authenticity",
  "custom.material",
  "custom.stone_family",
  "custom.surface_finish",
  "custom.primary_color",
  "custom.color_pattern",
  "custom.honest_flaws_and_character",
  "custom.setting_ready",
  "custom.chain_material",
  "custom.jewelry_finding_type",
  "custom.seo_title",
  "native_seo_title"
];

export const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];
export const REQUIRED_FIELDS = ["shopify_title", "price"];
export const INTEGRATION_PREFIXES = ["google.", "shopify.", "mm-google", "mc-facebook"];
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

const isExactProductGidString = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/Product\/\d+$/.test(val.trim());

const isExactMediaImageGidString = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/MediaImage\/\d+$/.test(val.trim());

const hasStoredNonBlankGeneralAltMetafield = (manifest) => {
  if (!manifest || typeof manifest !== "object") return false;
  const cm = manifest.currentMetafields;
  if (!cm || typeof cm !== "object" || Array.isArray(cm)) return false;
  const raw = Object.prototype.hasOwnProperty.call(cm, "custom.alt_text")
    ? cm["custom.alt_text"]
    : cm["alt_text"];
  return raw !== undefined && raw !== null && String(raw).trim() !== "";
};

const parseStrictExactMetaobjectGidJsonArray = (rawVal) => {
  if (typeof rawVal !== "string") return null;
  const trimmed = rawVal.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) return null;
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return null;
  const seen = new Set();
  const gids = [];
  for (let i = 0; i < parsed.length; i += 1) {
    const item = parsed[i];
    if (typeof item !== "string" || !isExactMetaobjectGid(item)) {
      return null;
    }
    const cleanGid = item.trim();
    if (seen.has(cleanGid)) {
      return null;
    }
    seen.add(cleanGid);
    gids.push(cleanGid);
  }
  return gids;
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

const CANONICAL_READ_COMPANIONS = Object.freeze({
  "custom.material": ["custom.primary_medium", "primary_medium"],
  "custom.is_one_of_a_kind": ["custom.is_ooak", "is_ooak"],
  "custom.origin_page_handle": ["custom.origin_handle", "origin_handle"],
  "custom.cut_and_shape": ["custom.cut_type", "cut_type"]
});

const isSettingOrHardwareMediumTokenInDomain = (rawVal) => {
  if (rawVal === undefined || rawVal === null) return false;
  const trimmed = String(rawVal).trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();

  if (lower === "stone" || lower === "metal" || lower === "none" || lower === "n/a" || lower === "unknown") {
    return true;
  }

  if (
    /\b(plated|plating|electroplated|alloy|sterling|925|fine\s+silver|nickel\s+silver|german\s+silver|tibetan\s+silver|pewter|brass|bronze|stainless|steel|aluminum|aluminium|vermeil|gold[-\s]?filled|silver[-\s]?filled|rose\s+gold|white\s+gold|yellow\s+gold|karat|10k|14k|18k|24k|bezel|bail|pinch\s+bail|glue[-\s]?on|glue[-\s]?in|wire[-\s]?wrap(?:ped)?|craft\s+wire|copper\s+wire|silver\s+wire|gold\s+wire|brass\s+wire|snake\s+chain|chain|cord|pendant\s+setting|metal\s+setting|finding|clasp|loop|rim|frame)\b/i.test(
      trimmed
    )
  ) {
    return true;
  }

  if (
    /^(silver|gold|copper|metal)\s+(tone|toned|finish|color|coloured|colored|hardware|setting|finding|mounting|frame|rim|backing|bail|loop|wire|chain)$/i.test(
      trimmed
    )
  ) {
    return true;
  }

  return false;
};

export const DESCRIPTION_REVIEW_EXCLUDED_KEYS = ["native_description", "custom.generated_description"];

// Used strictly for global telemetry tracking and source-context preservation in normal 62-slot projection.
export const HIDDEN_CONTEXT_FIELDS = ["custom.origin_story"];

export const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.primary_use"
];

const NON_ORDINARY_COMPAT_AND_EXCLUDED_SET = (() => {
  const s = new Set([
    "is_ooak",
    "custom.is_ooak",
    "stone_family",
    "custom.stone_family",
    "primary_medium",
    "custom.primary_medium",
    "origin_handle",
    "custom.origin_handle",
    "cut_type",
    "custom.cut_type",
    "target_gender",
    "custom.target_gender",
    "alt_text",
    "custom.alt_text"
  ]);

  const addCatalogEntryKeys = (entry) => {
    if (!entry) return;
    if (entry.key) {
      s.add(entry.key);
      if (!entry.key.includes(".") && (!entry.namespace || entry.namespace === "custom")) {
        s.add(`custom.${entry.key}`);
      }
    }
    if (entry.registryIdentity) {
      s.add(entry.registryIdentity);
    }
  };

  (COMPATIBILITY_ADAPTER_FIELDS || []).forEach(addCatalogEntryKeys);
  (EXCLUDED_CATALOG_FIELDS || []).forEach(addCatalogEntryKeys);
  (DUPLICATE_ALIAS_CATALOG_FIELDS || []).forEach(addCatalogEntryKeys);
  (PROTECTED_DATA_ENTRIES || []).forEach(entry => {
    if (entry?.identity) s.add(entry.identity);
  });

  // Preserve explicit typed staging/native-companion routes handled by dedicated branches in buildRepairPayload
  s.delete("shopify_title");
  s.delete("custom.generated_description");
  s.delete("custom.seo_title");
  s.delete("custom.shipping_weight_oz");
  s.delete("price");

  return s;
})();

const PARKED_EXCLUDED_CATALOG_BY_IDENTITY = (() => {
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

export const FILTER_OPTIONS = [
  {label: 'All', value: 'All'},
  {label: 'Needs review', value: 'Needs review'},
  {label: 'Proposed changes', value: 'Proposed changes'},
  {label: 'Conflicts', value: 'Conflicts'},
  {label: 'Blank', value: 'Blank'},
  {label: 'Shopify', value: 'Shopify'},
  {label: 'Gemini', value: 'Gemini'},
  {label: 'Vision', value: 'Vision'},
  {label: 'Geo Library', value: 'Geo Library'},
  {label: 'Derived', value: 'Derived'},
  {label: 'Manual', value: 'Manual'}
];

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

export const isParkedExcludedKey = (key) => {
  if (typeof key !== "string" || !key.trim()) return false;
  return PARKED_EXCLUDED_CATALOG_BY_IDENTITY.has(key.trim());
};

const normalizeOoakComparable = (rawVal, expectedType = "single_line_text_field") => {
  if (rawVal === undefined || rawVal === null) return "";
  if (typeof rawVal === "boolean") {
    if (expectedType === "boolean") return rawVal ? "true" : "false";
    return rawVal ? "Yes" : "No";
  }
  const trimmed = String(rawVal).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (
    lower === "true" ||
    lower === "yes" ||
    lower === "1" ||
    lower === "one-of-a-kind" ||
    lower === "one of a kind" ||
    lower.startsWith("yes —") ||
    lower.startsWith("yes -") ||
    lower.startsWith("yes ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")
  ) {
    return expectedType === "boolean" ? "true" : "Yes";
  }
  if (lower === "false" || lower === "no" || lower === "0") {
    return expectedType === "boolean" ? "false" : "No";
  }
  return trimmed;
};

const serializeFieldValueByType = (rawVal, expectedType, targetKey = "") => {
  if (rawVal === undefined || rawVal === null) return "";

  if (targetKey === "custom.is_one_of_a_kind" || targetKey === "custom.is_ooak") {
    return normalizeOoakComparable(rawVal, expectedType);
  }

  if (targetKey === "custom.treated" && expectedType === "single_line_text_field") {
    if (typeof rawVal === "boolean") {
      return rawVal ? "Yes" : "No";
    }
    const trimmed = String(rawVal).trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (lower === "true") return "Yes";
    if (lower === "false") return "No";
    return String(rawVal);
  }

  if (expectedType === "list.single_line_text_field") {
    if (Array.isArray(rawVal)) {
      const cleaned = rawVal
        .map(item => (item !== undefined && item !== null ? String(item).trim() : ""))
        .filter(Boolean);
      return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
    }
    const str = typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal);
    const trimmed = str.trim();
    if (!trimmed || trimmed === "[]") return "";
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map(item => (item !== undefined && item !== null ? String(item).trim() : ""))
            .filter(Boolean);
          return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
        }
      } catch (e) {
        // Preserve raw string if not valid JSON array
      }
    }
    return trimmed;
  }

  if (Array.isArray(rawVal)) {
    return rawVal.length > 0 ? JSON.stringify(rawVal) : "";
  }
  if (typeof rawVal === "object") {
    return JSON.stringify(rawVal);
  }
  return String(rawVal);
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

const resolveShippingProposalState = (data) => {
  const repairPlan = data?.repairPlan;
  let rawExplicit = undefined;

  if (repairPlan && typeof repairPlan === "object") {
    if (
      Object.prototype.hasOwnProperty.call(repairPlan, "native_shipping_weight") &&
      String(repairPlan["native_shipping_weight"] ?? "").trim() !== ""
    ) {
      rawExplicit = repairPlan["native_shipping_weight"];
    } else if (
      Object.prototype.hasOwnProperty.call(repairPlan, "custom.shipping_weight_oz") &&
      String(repairPlan["custom.shipping_weight_oz"] ?? "").trim() !== ""
    ) {
      rawExplicit = repairPlan["custom.shipping_weight_oz"];
    }
  }

  if (rawExplicit !== undefined) {
    const explicitStr = String(rawExplicit)
      .replace(/\s*OUNCES$/i, "")
      .trim();
    return {
      isProposed: explicitStr !== "",
      propVal: explicitStr,
      isDerived: false
    };
  }

  // Only derive shipping weight from an evidenced complete-product weight (distinct from stone-only custom.weight_grams)
  // that does not already include the 0.5 oz packaging allowance. Never use Math.ceil or stone-only grams.
  const completeOzRaw =
    (repairPlan &&
      typeof repairPlan === "object" &&
      (repairPlan["complete_product_weight_oz"] ?? repairPlan["custom.complete_product_weight_oz"])) ??
    data?.currentMetafields?.["custom.complete_product_weight_oz"];

  if (completeOzRaw !== undefined && completeOzRaw !== null && String(completeOzRaw).trim() !== "") {
    const completeOz = Number(String(completeOzRaw).trim());
    if (!Number.isNaN(completeOz) && completeOz > 0) {
      return {
        isProposed: true,
        propVal: String(Number((completeOz + 0.5).toFixed(4))),
        isDerived: true
      };
    }
  }

  const completeGramsRaw =
    (repairPlan &&
      typeof repairPlan === "object" &&
      (repairPlan["complete_product_weight_grams"] ??
        repairPlan["custom.complete_product_weight_grams"] ??
        repairPlan["whole_product_weight_grams"] ??
        repairPlan["custom.whole_product_weight_grams"])) ??
    data?.currentMetafields?.["custom.complete_product_weight_grams"] ??
    data?.currentMetafields?.["custom.whole_product_weight_grams"];

  if (completeGramsRaw !== undefined && completeGramsRaw !== null && String(completeGramsRaw).trim() !== "") {
    const completeGrams = Number(String(completeGramsRaw).trim());
    if (!Number.isNaN(completeGrams) && completeGrams > 0) {
      return {
        isProposed: true,
        propVal: String(Number(((completeGrams / 28.3495) + 0.5).toFixed(4))),
        isDerived: true
      };
    }
  }

  const hasEmptySeed =
    Boolean(repairPlan && typeof repairPlan === "object") &&
    (Object.prototype.hasOwnProperty.call(repairPlan, "native_shipping_weight") ||
      Object.prototype.hasOwnProperty.call(repairPlan, "custom.shipping_weight_oz"));

  return {
    isProposed: hasEmptySeed,
    propVal: "",
    isDerived: false
  };
};

export const getDynamicSections = (manifest, options = null) => {
  const includeTab3InspectableInventory = Boolean(
    options &&
    typeof options === "object" &&
    options.includeTab3InspectableInventory === true
  );

  const sourceGroups = includeTab3InspectableInventory
    ? TAB3_INSPECTABLE_TEMPLATE_GROUPS
    : PRODUCT_TEMPLATE_GROUPS;

  const hasExistingGeneralAlt = hasStoredNonBlankGeneralAltMetafield(manifest);

  return sourceGroups.map(group => {
    const isParkedGroup = Boolean(
      includeTab3InspectableInventory &&
      (group.isParkedGroup === true || group.heading === TAB3_PARKED_DRAWER_HEADING)
    );
    let keys = [];

    group.fields.forEach(f => {
      if (isParkedGroup) {
        const parkedKey = resolveConfigFieldDestination(f);
        if (parkedKey && !keys.includes(parkedKey)) {
          keys.push(parkedKey);
        }
        return;
      }

      if (RETIRED_KEYS.includes(f.key) || RETIRED_KEYS.includes(`custom.${f.key}`)) return;
      if (f.registryRole && f.registryRole !== "PRIMARY_CANDIDATE_DESTINATION" && f.registryRole !== "APPROVED_MEASUREMENT_ADDITION") return;
      if (f.key === "is_ooak" || f.key === "custom.is_ooak" || f.key === "cut_type" || f.key === "custom.cut_type") return;
      
      if (f.key === "native_image_alt") {
        // When custom.alt_text compatibility metafield already exists on the loaded product,
        // surface it in section.keys for independent review/edit alongside per-image media alt controls.
        // Do NOT append a new entry to group.fields so the canonical 62 / 93 logical capability count remains unchanged.
        if (hasExistingGeneralAlt && !keys.includes("custom.alt_text")) {
          keys.push("custom.alt_text");
        }
        const mediaEdges = manifest?.nativeTargets?.media?.edges;
        const mediaKeys = Array.isArray(mediaEdges)
          ? mediaEdges
              .filter(e => e?.node?.id && isExactMediaImageGidString(String(e.node.id)))
              .map(e => `native_image_alts_${e.node.id}`)
          : [];
        if (mediaKeys.length > 0) {
          keys.push(...mediaKeys);
        } else if (DEV_SHOW_ALL_TEMPLATE_FIELDS) {
          // Retain one identifiable display placeholder when no eligible image rows are available in DEV Show-All mode
          keys.push("native_image_alt");
        }
        return;
      }
      
      const resolvedKey = resolveConfigFieldDestination(f);
      if (
        resolvedKey &&
        !RETIRED_KEYS.includes(resolvedKey) &&
        !NON_ORDINARY_COMPAT_AND_EXCLUDED_SET.has(resolvedKey)
      ) {
        keys.push(resolvedKey);
      }
    });
    
    // In the default 62-slot projection, retain custom.origin_story as hidden diagnostic source context in Origin and collection.
    // In the 93-slot Tab 3 inspectable projection, custom.origin_story lives once inside the Parked / Excluded drawer.
    if (
      !includeTab3InspectableInventory &&
      (group.heading === "3. Origin, Story, and Collection" || group.heading === "Origin and collection")
    ) {
      if (!keys.includes("custom.origin_story")) keys.push("custom.origin_story");
    }

    return {
      title: group.heading,
      keys,
      configFields: group.fields,
      ...(isParkedGroup ? { isParkedGroup: true } : {})
    };
  });
};

export const getStatusTone = (status) => {
  switch(status) {
    case STATUS.VALIDATED: return "success";
    case STATUS.COMPLETE: return "success";
    case STATUS.SCANNING: return "magic";
    case STATUS.FAILED: return "critical";
    case STATUS.QUEUED: return "info";
    default: return undefined;
  }
};

export const isMultilineKey = (k, control) => control === "multiline" || [
  "custom.generated_description", "custom.stone_story", 
  "custom.bench_notes", "custom.character_marks", "custom.honest_flaws_and_character", 
  "custom.artist_notes", "custom.origin_story", "native_seo_description"
].includes(k);

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
      regex: /\bbezel\s+setting\s*[—–-]\s*ready\s+to\s+wear\b/gi,
      replace: (m) => {
        matchedPhrases.push(m);
        return applyCaseAwareReplacement(m, "glue-on setting — ready to wear");
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
    if (/^bezel\s+setting\s*[—–-]\s*ready\s+to\s+wear$/i.test(strVal) || /^bezel\s+setting$/i.test(strVal)) {
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

export const evaluateFieldMetadata = ({
  key,
  data,
  productId,
  currentApprovals,
  currentKeepOriginal = {},
  currentManualEdits = {},
  configFields = [],
  standardizedCandidatesByProduct = {},
  getStandardizedEvaluationForField,
  includeTab3InspectableInventory = false
}) => {
  const safeData = data || {};
  const isUnselectedDraftMode = Boolean(
    productId === null && safeData.isUnselectedDraft === true
  );
  const effectiveApprovalLookupId = isUnselectedDraftMode
    ? UNSELECTED_DRAFT_STORAGE_KEY
    : productId;
  const isParkedEntryFromCatalog = isParkedExcludedKey(key);
  const targetKeyForProposal = isParkedEntryFromCatalog
    ? key
    : key === "alt_text" || key === "custom.alt_text"
      ? "custom.alt_text"
      : (NATIVE_ALIAS_MAP[key] || key);
  const approvalStorageKey = isParkedEntryFromCatalog ? key : resolveApprovalStorageKey(key);
  const isDestinationSpecificApprovalField = DESTINATION_SPECIFIC_APPROVAL_KEYS.has(approvalStorageKey);
  const isDescriptionDestination =
    key === "native_description" ||
    key === "custom.generated_description" ||
    approvalStorageKey === "native_description" ||
    approvalStorageKey === "custom.generated_description";
  const isSeoTitleDestination =
    key === "native_seo_title" ||
    key === "custom.seo_title" ||
    approvalStorageKey === "native_seo_title" ||
    approvalStorageKey === "custom.seo_title";
  const isGeneralAltCompatField =
    key === "custom.alt_text" ||
    key === "alt_text" ||
    targetKeyForProposal === "custom.alt_text" ||
    approvalStorageKey === "custom.alt_text";
  const isNativeImageAlt = key.startsWith("native_image_alts_");
  const isImageAltCapabilityPlaceholder = key === "native_image_alt";
  const isShippingWeightField = key === "native_shipping_weight" || key === "custom.shipping_weight_oz";
  const isCollectionDateField = key === "custom.collection_date" || key === "collection_date";
  
  const unprefixedKey = targetKeyForProposal.replace(/^custom\./, '');
  const allTemplateFields =
    Array.isArray(configFields) && configFields.length > 0
      ? configFields
      : (includeTab3InspectableInventory ? TAB3_INSPECTABLE_TEMPLATE_GROUPS : PRODUCT_TEMPLATE_GROUPS).flatMap(g => g.fields || []);

  const templateConfig = allTemplateFields.find(f => {
    if (!f) return false;
    const resolvedDest = resolveConfigFieldDestination(f);
    if (resolvedDest === key || resolvedDest === targetKeyForProposal) return true;
    if (f.registryIdentity === key || f.registryIdentity === targetKeyForProposal) return true;
    if (f.key === key || f.key === targetKeyForProposal) return true;
    if (
      f.role !== "standardized_attribute" &&
      f.namespace !== "shopify" &&
      f.owner !== "native" &&
      f.namespace !== "native" &&
      f.registryRole !== "EXCLUDED_INPUT" &&
      !key.startsWith("shopify.") &&
      f.key === unprefixedKey
    ) {
      return true;
    }
    return false;
  }) || PARKED_EXCLUDED_CATALOG_BY_IDENTITY.get(key) || (COMPATIBILITY_ADAPTER_FIELDS || []).find(f => {
    if (!f) return false;
    const resolvedDest = resolveConfigFieldDestination(f);
    return (
      resolvedDest === key ||
      resolvedDest === targetKeyForProposal ||
      f.registryIdentity === key ||
      f.registryIdentity === targetKeyForProposal ||
      f.key === key ||
      f.key === unprefixedKey
    );
  });

  const isParkedExcluded = Boolean(
    templateConfig?.registryRole === "EXCLUDED_INPUT" ||
    templateConfig?.isParkedExcluded === true ||
    isParkedEntryFromCatalog
  );

  // If custom.origin_story is evaluated in normal 62-slot mode (outside the Tab 3 parked drawer), keep its legacy Hidden Source behavior.
  const treatAsHiddenContext =
    HIDDEN_CONTEXT_FIELDS.includes(key) &&
    !includeTab3InspectableInventory &&
    templateConfig?.templateGroup !== TAB3_PARKED_DRAWER_HEADING;

  const expectedType =
    (isNativeImageAlt || isImageAltCapabilityPlaceholder || key.startsWith("native_") || NATIVE_FIELDS.includes(key)
      ? "native"
      : templateConfig?.type || templateConfig?.metaConfig?.type ||
        (key.startsWith("shopify.")
          ? "list.metaobject_reference"
          : key === "custom.character_marks" || key === "custom.stone_story"
            ? "list.single_line_text_field"
            : key === "custom.weight_grams" || key === "custom.shipping_weight_oz" || key === "custom.overall_solid_length_in" || key === "custom.whole_product_weight_grams"
              ? "number_decimal"
              : key === "custom.honest_flaws_and_character" || key === "custom.origin_story" || key === "custom.generated_description" || key === "custom.artist_notes" || key === "custom.bench_notes"
                ? "multi_line_text_field"
                : "single_line_text_field"));

  const isStandardizedAttribute =
    templateConfig?.role === "standardized_attribute" ||
    templateConfig?.namespace === "shopify" ||
    key.startsWith("shopify.");
  const isVerifiedStdDest = !isParkedExcluded && isVerifiedStandardizedDestination(targetKeyForProposal);

  const standardizedDestKey = isStandardizedAttribute
    ? (targetKeyForProposal.startsWith("shopify.")
        ? targetKeyForProposal
        : (templateConfig?.metaKey ? `shopify.${templateConfig.metaKey}` : targetKeyForProposal))
    : targetKeyForProposal;

  // Evaluate technical and category eligibility for ALL standardized attributes
  const stdEvaluation =
    !isUnselectedDraftMode && isStandardizedAttribute && typeof getStandardizedEvaluationForField === "function"
      ? getStandardizedEvaluationForField(productId, standardizedDestKey, safeData)
      : null;

  const isCategoryEligible = Boolean(stdEvaluation?.isCategoryEligible);
  const categoryEligibility = stdEvaluation?.categoryEligibility || null;

  // Distinguish actual zero-image placeholder state from per-image media targets only when state establishes it
  const mediaTargetsObj = safeData.nativeTargets?.media;
  const mediaEdgesList = Array.isArray(mediaTargetsObj?.edges)
    ? mediaTargetsObj.edges.filter(e => e?.node?.id && isExactMediaImageGidString(String(e.node.id)))
    : null;
  let imageAltPlaceholderReason = "";
  if (isImageAltCapabilityPlaceholder) {
    if (!safeData.nativeTargets || !mediaTargetsObj || !Array.isArray(mediaTargetsObj.edges)) {
      imageAltPlaceholderReason = "Media is not available (placeholder is read-only; writes require an exact MediaImage GID)";
    } else if (safeData.nativeTargets.loadError) {
      imageAltPlaceholderReason = `Media failed to load (${safeData.nativeTargets.loadError}); placeholder is read-only`;
    } else if (safeData.nativeTargets.isComplete === false || mediaTargetsObj.pageInfo?.hasNextPage === true) {
      imageAltPlaceholderReason = "Media is still loading or incomplete; placeholder is read-only";
    } else if (mediaEdgesList && mediaEdgesList.length === 0) {
      imageAltPlaceholderReason = "No product images present on this product (0 MediaImage targets; placeholder is read-only)";
    } else {
      imageAltPlaceholderReason = "Display placeholder for native_image_alt capability (placeholder is never a writable media target)";
    }
  }

  // Explicit contract/verification hold flags from constants.jsx
  const hasExplicitStorageHold =
    templateConfig?.storageVerified === false ||
    templateConfig?.writerVerified === false ||
    templateConfig?.registryRole === "APPROVED_MEASUREMENT_ADDITION";
  const hasExplicitProducerHold = templateConfig?.producerAlignmentPending === true;
  const isChannelFlagReadOnly =
    targetKeyForProposal === "mm-google-shopping.custom_product" ||
    key === "mm-google-shopping.custom_product";
  const isVariantMetafieldHold =
    templateConfig?.owner === "variant_metafield" ||
    (templateConfig?.registryOwner === "PRODUCTVARIANT" &&
      templateConfig?.owner !== "native" &&
      templateConfig?.namespace !== "native" &&
      !key.startsWith("native_") &&
      !NATIVE_FIELDS.includes(key));

  // custom.alt_text is only editable/writable on loaded products where custom.alt_text already exists in Shopify
  const hasExistingGeneralAltOnProduct =
    !isUnselectedDraftMode && hasStoredNonBlankGeneralAltMetafield(safeData);

  // Relax pending_read_only ONLY for the six verified standardized destinations when BOTH reference matching and category eligibility pass.
  // Parked/excluded entries, zero-image native_image_alt placeholders, and absent custom.alt_text compatibility fields are held read-only.
  const isPendingReadOnly = isImageAltCapabilityPlaceholder || isParkedExcluded
    ? true
    : isGeneralAltCompatField
      ? !hasExistingGeneralAltOnProduct
      : isVerifiedStdDest
        ? !(Boolean(stdEvaluation?.isTechnicallyEligible) && isCategoryEligible)
        : (isStandardizedAttribute
            ? true
            : (templateConfig?.mappingStatus === "pending_read_only" || hasExplicitStorageHold || isChannelFlagReadOnly));

  const hasContractOrOwnerHold =
    isImageAltCapabilityPlaceholder ||
    isParkedExcluded ||
    isPendingReadOnly ||
    hasExplicitStorageHold ||
    hasExplicitProducerHold ||
    isChannelFlagReadOnly ||
    isVariantMetafieldHold;

  const baselineDescriptor = inspectFieldBaselineDescriptor(
    isDestinationSpecificApprovalField ? approvalStorageKey : key,
    safeData,
    productId,
    templateConfig
  );

  // Resolve owner-specific manual edit state without cross-product leakage
  const ownerManualEditsMap =
    effectiveApprovalLookupId &&
    currentManualEdits &&
    typeof currentManualEdits === "object" &&
    !Array.isArray(currentManualEdits) &&
    currentManualEdits[effectiveApprovalLookupId] &&
    typeof currentManualEdits[effectiveApprovalLookupId] === "object" &&
    !Array.isArray(currentManualEdits[effectiveApprovalLookupId])
      ? currentManualEdits[effectiveApprovalLookupId]
      : null;

  // For destination-specific approval fields (e.g. native_description vs custom.generated_description),
  // check manual edits on the specific key/approvalStorageKey so independent edits do not bleed across destinations.
  const isManuallyEdited = Boolean(
    !isParkedExcluded &&
    !isImageAltCapabilityPlaceholder &&
    ownerManualEditsMap &&
    (isDestinationSpecificApprovalField
      ? (ownerManualEditsMap[key] === true || ownerManualEditsMap[approvalStorageKey] === true)
      : (ownerManualEditsMap[key] === true ||
          ownerManualEditsMap[targetKeyForProposal] === true ||
          (approvalStorageKey && ownerManualEditsMap[approvalStorageKey] === true)))
  );

  let currentVal = "";
  const variants = safeData.nativeTargets?.variants?.edges || [];
  const isSingleVariant = variants.length === 1 && 
                          safeData.nativeTargets?.variants?.pageInfo?.hasNextPage === false && 
                          safeData.nativeTargets?.isComplete === true && 
                          !safeData.nativeTargets?.loadError;

  if (isImageAltCapabilityPlaceholder) {
      currentVal = "";
  } else if (isParkedExcluded && isVariantMetafieldHold) {
      if (baselineDescriptor.evidenceAvailable && baselineDescriptor.propertyPresent && baselineDescriptor.rawValue !== undefined && baselineDescriptor.rawValue !== null) {
          currentVal = serializeFieldValueByType(baselineDescriptor.rawValue, expectedType, key);
      } else {
          currentVal = "";
      }
  } else if (isGeneralAltCompatField) {
      // General alt retains its own stored metafield baseline; never copy hero photo alt into it automatically
      const rawGenAlt = safeData.currentMetafields?.["custom.alt_text"] ?? safeData.currentMetafields?.["alt_text"] ?? "";
      currentVal = rawGenAlt !== undefined && rawGenAlt !== null ? String(rawGenAlt) : "";
  } else if (isNativeImageAlt) {
      const imageId = key.replace("native_image_alts_", "");
      const match = safeData.nativeTargets?.media?.edges?.find(e => e.node?.id === imageId);
      currentVal = match?.node?.alt ?? "";
  } else if (key === "native_title" || key === "shopify_title") {
      currentVal = safeData.nativeTargets?.productTitle ?? safeData.canonicalFields?.shopify_title ?? "";
  } else if (key === "native_description" || key === "custom.generated_description") {
      currentVal = key === "native_description" 
        ? (typeof safeData.nativeTargets?.descriptionHtml === "string" ? safeData.nativeTargets.descriptionHtml : "")
        : (typeof safeData.currentMetafields?.["custom.generated_description"] === "string" ? safeData.currentMetafields["custom.generated_description"] : String(safeData.currentMetafields?.["custom.generated_description"] ?? ""));
  } else if (key === "native_seo_title" || key === "custom.seo_title") {
      currentVal = key === "native_seo_title"
        ? (typeof safeData.nativeTargets?.seo?.title === "string" ? safeData.nativeTargets.seo.title : "")
        : (typeof safeData.currentMetafields?.["custom.seo_title"] === "string" ? safeData.currentMetafields["custom.seo_title"] : String(safeData.currentMetafields?.["custom.seo_title"] ?? ""));
  } else if (key === "native_seo_description") {
      currentVal = typeof safeData.nativeTargets?.seo?.description === "string" ? safeData.nativeTargets.seo.description : "";
  } else if (key === "native_price" || key === "price") {
      if (isUnselectedDraftMode) {
          currentVal = "";
      } else if (isSingleVariant) {
          currentVal = variants[0].node?.price ?? "";
      } else if (variants.length !== 1 || safeData.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !safeData.nativeTargets?.isComplete || safeData.nativeTargets?.loadError) {
          currentVal = "Multiple variants / Incomplete data - review manually";
      }
  } else if (isShippingWeightField) {
      if (key === "native_shipping_weight") {
          if (isUnselectedDraftMode) {
              currentVal = "";
          } else if (isSingleVariant) {
              const w = variants[0].node?.inventoryItem?.measurement?.weight;
              currentVal = (w?.value !== undefined && w?.value !== null) ? `${w.value} ${w.unit}` : "";
          } else if (variants.length !== 1 || safeData.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !safeData.nativeTargets?.isComplete || safeData.nativeTargets?.loadError) {
              currentVal = "Multiple variants / Incomplete data - review manually";
          }
      } else {
          currentVal = safeData.currentMetafields?.["custom.shipping_weight_oz"] ?? "";
      }
  } else if (isStandardizedAttribute && stdEvaluation) {
      if (stdEvaluation.existingGids.length > 0) {
          currentVal = JSON.stringify(stdEvaluation.existingGids);
      } else {
          const hasCurrent = safeData.currentMetafields?.hasOwnProperty(standardizedDestKey) || safeData.currentMetafields?.hasOwnProperty(key);
          const rawCurrent = safeData.currentMetafields?.[standardizedDestKey] ?? safeData.currentMetafields?.[key] ?? "";
          if (Array.isArray(rawCurrent)) {
              currentVal = rawCurrent.length > 0 ? JSON.stringify(rawCurrent) : "";
          } else if (typeof rawCurrent === "object" && rawCurrent !== null) {
              currentVal = JSON.stringify(rawCurrent);
          } else {
              currentVal = hasCurrent ? String(rawCurrent ?? "") : "";
          }
      }
  } else {
      const hasCurrent =
        safeData.currentMetafields?.hasOwnProperty(key) ||
        (!key.includes(".") && safeData.currentMetafields?.hasOwnProperty(`custom.${key}`));
      let rawCurrent = safeData.currentMetafields?.hasOwnProperty(key)
        ? safeData.currentMetafields[key]
        : (!key.includes(".") && safeData.currentMetafields?.hasOwnProperty(`custom.${key}`)
            ? safeData.currentMetafields[`custom.${key}`]
            : "");
      if (!isParkedExcluded && (!hasCurrent || String(rawCurrent ?? "").trim() === "") && CANONICAL_READ_COMPANIONS[key]) {
          for (const companionKey of CANONICAL_READ_COMPANIONS[key]) {
              const compVal = safeData.currentMetafields?.[companionKey];
              if (compVal !== undefined && compVal !== null && String(compVal).trim() !== "") {
                  if (key === "custom.material" && isSettingOrHardwareMediumTokenInDomain(compVal)) {
                      continue;
                  }
                  rawCurrent = compVal;
                  break;
              }
          }
      }
      currentVal = rawCurrent !== undefined && rawCurrent !== null && String(rawCurrent).trim() !== ""
        ? serializeFieldValueByType(rawCurrent, expectedType, key)
        : (isCollectionDateField ? "N/A" : "");
  }

  let isProposed = false;
  let propVal = "";
  let shippingProposalState = null;

  if (isImageAltCapabilityPlaceholder || isParkedExcluded) {
      isProposed = false;
      propVal = "";
  } else if (isGeneralAltCompatField) {
      if (hasExistingGeneralAltOnProduct && safeData.repairPlan && typeof safeData.repairPlan === "object") {
          if (Object.prototype.hasOwnProperty.call(safeData.repairPlan, "custom.alt_text")) {
              isProposed = true;
              propVal = serializeFieldValueByType(safeData.repairPlan["custom.alt_text"], expectedType, "custom.alt_text");
          } else if (Object.prototype.hasOwnProperty.call(safeData.repairPlan, "alt_text")) {
              isProposed = true;
              propVal = serializeFieldValueByType(safeData.repairPlan["alt_text"], expectedType, "custom.alt_text");
          }
      }
  } else if (key === "native_description") {
      // Requirement 8: Support an independent repairPlan["native_description"] proposal (e.g., from one-time surgical HTML cleanup)
      // while falling back to shared repairPlan["custom.generated_description"] ONLY when native_description does not have its own key
      // AND custom.generated_description was not staged solely for the metafield destination by one-time cleanup.
      if (safeData.repairPlan && typeof safeData.repairPlan === "object") {
          if (Object.prototype.hasOwnProperty.call(safeData.repairPlan, "native_description")) {
              isProposed = true;
              propVal = String(safeData.repairPlan["native_description"] ?? "");
          } else if (
              Object.prototype.hasOwnProperty.call(safeData.repairPlan, "custom.generated_description") &&
              safeData.metadata?.["custom.generated_description"]?.destinationOnly !== true
          ) {
              isProposed = true;
              propVal = String(safeData.repairPlan["custom.generated_description"] ?? "");
          }
      }
  } else if (key === "custom.generated_description") {
      if (
          safeData.repairPlan &&
          typeof safeData.repairPlan === "object" &&
          Object.prototype.hasOwnProperty.call(safeData.repairPlan, "custom.generated_description")
      ) {
          isProposed = true;
          propVal = String(safeData.repairPlan["custom.generated_description"] ?? "");
      }
  } else if (isVerifiedStdDest) {
      if (stdEvaluation?.isTechnicallyEligible && isCategoryEligible) {
          if (safeData.repairPlan !== undefined && safeData.repairPlan.hasOwnProperty(targetKeyForProposal)) {
              isProposed = true;
              const rawProp = safeData.repairPlan[targetKeyForProposal];
              propVal = Array.isArray(rawProp) ? JSON.stringify(rawProp) : String(rawProp ?? "");
          } else if (stdEvaluation.autoProposalSerialized) {
              isProposed = true;
              propVal = stdEvaluation.autoProposalSerialized;
          }
      }
  } else if (isShippingWeightField && !isPendingReadOnly) {
      shippingProposalState = resolveShippingProposalState(safeData);
      isProposed = shippingProposalState.isProposed;
      propVal = shippingProposalState.propVal;
  } else if (key === "native_seo_description") {
      if (safeData.repairPlan !== undefined && safeData.repairPlan.hasOwnProperty("native_seo_description")) {
          isProposed = true;
          propVal = String(safeData.repairPlan["native_seo_description"] ?? "");
      }
  } else if (safeData.repairPlan !== undefined && !isPendingReadOnly && !isStandardizedAttribute) {
      if (safeData.repairPlan.hasOwnProperty(key)) {
          isProposed = true;
          propVal = serializeFieldValueByType(safeData.repairPlan[key], expectedType, key);
      } else if (targetKeyForProposal !== key && safeData.repairPlan.hasOwnProperty(targetKeyForProposal)) {
          isProposed = true;
          propVal = serializeFieldValueByType(safeData.repairPlan[targetKeyForProposal], expectedType, targetKeyForProposal);
      }
      if (isCollectionDateField && GENERIC_VALUES.includes(propVal.trim())) {
          isProposed = false;
          propVal = "";
      }
  }

  let fieldMeta = isDestinationSpecificApprovalField
    ? (safeData.metadata?.[key] ||
        safeData.metadata?.[approvalStorageKey] ||
        (key === "native_description" && !Object.prototype.hasOwnProperty.call(safeData.repairPlan || {}, "native_description")
          ? safeData.metadata?.["custom.generated_description"]
          : {}) ||
        {})
    : (safeData.metadata?.[key] || safeData.metadata?.[targetKeyForProposal] || {});
  let source =
    fieldMeta.source ||
    (isVerifiedStdDest && isProposed
      ? "Vision"
      : shippingProposalState?.isDerived
        ? "Derived"
        : isManuallyEdited
          ? "Manual"
          : "Not reported");
  let stage =
    fieldMeta.stage ||
    (isVerifiedStdDest && isProposed
      ? "resolveStandardizedCandidates"
      : shippingProposalState?.isDerived
        ? "complete_product_weight_calculation"
        : isManuallyEdited
          ? "ManualEdit"
          : "Not reported");

  const isOneTimeCleanupStaged = stage === "OneTimeStockBezelCleanup";

  let fieldStatus = "Unchanged";
  let proposalStatus = isProposed ? (propVal.trim() !== "" ? "Provided" : "Empty") : "Not provided";
  let isBlockedAction = false;
  let reasons = [];
  
  let isContentPreApproved = false;
  let preApprovalReason = "";

  const currentExists =
    currentVal.trim() !== "" &&
    currentVal.trim() !== "[]" &&
    currentVal !== "Multiple variants / Incomplete data - review manually" &&
    !(isCollectionDateField && GENERIC_VALUES.includes(currentVal.trim()));
  const proposalExists =
    !isParkedExcluded &&
    isProposed &&
    propVal.trim() !== "" &&
    propVal.trim() !== "[]" &&
    !(isCollectionDateField && GENERIC_VALUES.includes(propVal.trim()));

  const isEqualToCurrent = (() => {
    if (!currentExists || !proposalExists) return false;
    if (key === "native_shipping_weight" && isSingleVariant) {
      const w = variants[0]?.node?.inventoryItem?.measurement?.weight;
      const propNum = Number(propVal);
      if (
        w &&
        w.value !== undefined &&
        w.value !== null &&
        !Number.isNaN(propNum) &&
        propNum > 0
      ) {
        return Number(w.value) === propNum && w.unit === "OUNCES";
      }
    }
    if (isStandardizedAttribute || expectedType === "list.metaobject_reference") {
      if (isVerifiedStdDest) {
        const propCheck = validateProposedStandardizedGidList(propVal, stdEvaluation);
        if (!propCheck.valid) return false;
      }
      const strictCurrGids = parseStrictExactMetaobjectGidJsonArray(currentVal);
      const strictPropGids = parseStrictExactMetaobjectGidJsonArray(propVal);
      if (!strictCurrGids || !strictPropGids) return false;
      if (strictCurrGids.length !== strictPropGids.length) return false;
      return strictCurrGids.every((gid, idx) => gid === strictPropGids[idx]);
    }
    return currentVal === propVal;
  })();

  const isKnownKey =
    templateConfig !== undefined ||
    isGeneralAltCompatField ||
    isParkedExcluded ||
    DESTINATION_SPECIFIC_APPROVAL_KEYS.has(key) ||
    DESTINATION_SPECIFIC_APPROVAL_KEYS.has(targetKeyForProposal) ||
    NATIVE_FIELDS.includes(key) ||
    isNativeImageAlt ||
    isImageAltCapabilityPlaceholder ||
    HIDDEN_CONTEXT_FIELDS.includes(key) ||
    key.startsWith("native_");

  const hasLoadedBaseline = isUnselectedDraftMode
    ? false
    : isParkedExcluded
      ? Boolean(baselineDescriptor.evidenceAvailable)
      : (isDescriptionDestination || isSeoTitleDestination || isGeneralAltCompatField || key === "native_seo_description" || key === "native_title" || key === "shopify_title")
        ? hasVerifiedLoadedDestinationBaseline(approvalStorageKey, safeData, productId)
        : Boolean(baselineDescriptor.evidenceAvailable);

  // Evaluate Keep-Original decision for this exact product and destination before pre-approval/approval
  const rawKeepOriginalDecision =
    !isUnselectedDraftMode && !isParkedExcluded && productId && currentKeepOriginal && typeof currentKeepOriginal === "object"
      ? (isDestinationSpecificApprovalField
          ? currentKeepOriginal?.[productId]?.[approvalStorageKey]
          : (currentKeepOriginal?.[productId]?.[approvalStorageKey] !== undefined
              ? currentKeepOriginal[productId][approvalStorageKey]
              : (currentKeepOriginal?.[productId]?.[key] !== undefined
                  ? currentKeepOriginal[productId][key]
                  : currentKeepOriginal?.[productId]?.[targetKeyForProposal])))
      : null;

  const isKeepOriginalSelected =
    !isUnselectedDraftMode &&
    !isImageAltCapabilityPlaceholder &&
    !isParkedExcluded &&
    !hasContractOrOwnerHold &&
    hasLoadedBaseline &&
    proposalExists &&
    !isEqualToCurrent &&
    isKeepOriginalDecisionValid({
      decisionRecord: rawKeepOriginalDecision,
      productId,
      approvalStorageKey,
      baselineDescriptor,
      currentPropVal: propVal,
      proposalExists
    });

  // Never auto-preapprove description destinations, custom.alt_text compatibility fields, one-time cleanup staged proposals,
  // standardized reference proposals, image-alt placeholders, parked fields, or fields under contract/owner hold.
  if (
    !hasContractOrOwnerHold &&
    !isParkedExcluded &&
    !isVerifiedStdDest &&
    !isImageAltCapabilityPlaceholder &&
    !isDescriptionDestination &&
    !isGeneralAltCompatField &&
    !isOneTimeCleanupStaged
  ) {
      if (targetKeyForProposal === "custom.google_product_category" && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Category pre-approved";
      } else if (
          safeData.verifiedGeoValues && 
          safeData.verifiedGeoValues[unprefixedKey] !== undefined && 
          String(safeData.verifiedGeoValues[unprefixedKey]) === propVal && 
          proposalExists
      ) {
          isContentPreApproved = true;
          preApprovalReason = "Verified Geo Library";
      } else if ((POLICY_PRE_APPROVED_FIELDS.includes(key) || POLICY_PRE_APPROVED_FIELDS.includes(targetKeyForProposal)) && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Pre-approved by operator policy";
      } else if (isNativeImageAlt && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Native Image Alt pre-approved by policy";
      }
  }

  const isRequired = !isParkedExcluded && REQUIRED_FIELDS.includes(targetKeyForProposal);
  const isProtected = PROTECTED_FIELDS.includes(targetKeyForProposal) || PROTECTED_FIELDS.includes(key);
  const isHardware = HARDWARE_FIELDS.includes(targetKeyForProposal) || HARDWARE_FIELDS.includes(key);
  const isIntegration = INTEGRATION_PREFIXES.some(prefix => targetKeyForProposal.startsWith(prefix));

  const currentCount = currentExists ? currentVal.length : 0;
  const propCount = propVal.length;
  const limit = FIELD_LIMITS[key] || FIELD_LIMITS[targetKeyForProposal] || null;

  const isManualOnly = false;
  const isOperatorOwned = (
    targetKeyForProposal === "price" ||
    targetKeyForProposal === "custom.weight_grams" ||
    targetKeyForProposal === "custom.dimensions_mm" ||
    hasExplicitStorageHold
  );
  
  // Destination-specific approval lookup: mutually exclusive with a valid Keep-Original decision
  const exactApprovalVal = effectiveApprovalLookupId
    ? (isDestinationSpecificApprovalField
        ? currentApprovals?.[effectiveApprovalLookupId]?.[approvalStorageKey]
        : (currentApprovals?.[effectiveApprovalLookupId]?.[approvalStorageKey] !== undefined
            ? currentApprovals[effectiveApprovalLookupId][approvalStorageKey]
            : (currentApprovals?.[effectiveApprovalLookupId]?.[key] !== undefined
                ? currentApprovals[effectiveApprovalLookupId][key]
                : currentApprovals?.[effectiveApprovalLookupId]?.[targetKeyForProposal])))
    : undefined;

  const isApproved =
    !isKeepOriginalSelected &&
    !isParkedExcluded &&
    !isImageAltCapabilityPlaceholder &&
    !hasContractOrOwnerHold &&
    (hasLoadedBaseline || isUnselectedDraftMode) &&
    (!isVerifiedStdDest || (Boolean(stdEvaluation?.isTechnicallyEligible) && isCategoryEligible)) &&
    exactApprovalVal !== undefined &&
    String(exactApprovalVal) === propVal &&
    propVal.trim() !== "";

  if (treatAsHiddenContext) {
      return {
        currentVal, propVal, isProposed, fieldStatus: "Hidden Source", proposalStatus, source, stage,
        isBlockedAction: true, reasons: ["Hidden Context"], currentExists, proposalExists, isApproved: false,
        isManuallyEdited: false, isTemporarilyClearedManualEdit: false,
        isKeepOriginalSelected: false, keepOriginalDecision: null, canKeepOriginal: false,
        isParkedExcluded: true, registryRole: templateConfig?.registryRole || "EXCLUDED_INPUT",
        registryOwner: templateConfig?.registryOwner || "PRODUCT",
        registryIdentity: templateConfig?.registryIdentity || key,
        baselineDescriptor,
        hasTechnicalBlock: true, contentNeedsReview: false, isContentPreApproved: false, preApprovalReason: "",
        isManualOnly: false, isActualBlockedProposal: false, isOperatorOwned: false, isSupported: true,
        isPendingReadOnly: true, isStandardizedAttribute: false, hasLoadedBaseline: Boolean(baselineDescriptor.evidenceAvailable),
        isUnselectedDraftMode,
        approvalStorageKey,
        type: expectedType, owner: templateConfig?.owner || "metafield", namespace: templateConfig?.namespace || "custom",
        metaKey: templateConfig?.metaKey || unprefixedKey, label: templateConfig?.label || formatLabel(key),
        control: templateConfig?.control || "multiline"
      };
  }

  let hasTechnicalBlock = false;
  let contentNeedsReview = false;

  // Require explicit exact-value operator approval for changed proposals on native_description, custom.generated_description,
  // custom.alt_text, one-time cleanup staged proposals, custom.jewelry_type, custom.wire_material, and native_seo_description.
  if (
    !isParkedExcluded &&
    (isDescriptionDestination ||
      isGeneralAltCompatField ||
      isOneTimeCleanupStaged ||
      targetKeyForProposal === "custom.jewelry_type" ||
      targetKeyForProposal === "custom.wire_material" ||
      key === "native_seo_description") &&
    proposalExists &&
    !isEqualToCurrent
  ) {
      contentNeedsReview = true;
  }

  // Require demonstrably loaded baseline for the exact product and destination before authorizing any loaded-product write
  if (
    !isUnselectedDraftMode &&
    !isParkedExcluded &&
    !hasLoadedBaseline &&
    (isDescriptionDestination || isSeoTitleDestination || isGeneralAltCompatField || key === "native_seo_description" || key === "native_title" || key === "shopify_title")
  ) {
      hasTechnicalBlock = true;
      reasons.push(
        isGeneralAltCompatField
          ? "custom.alt_text compatibility metafield is not present on this product (only existing custom.alt_text values can be edited/saved)"
          : `Baseline not loaded or unverified for ${approvalStorageKey} — reload product data before saving`
      );
  }

  // Technical Verification Layer
  const isOverLimit = !isParkedExcluded && limit !== null && !isNativeImageAlt && !isImageAltCapabilityPlaceholder && (currentCount > limit || (isProposed && propCount > limit));
  if (isOverLimit) {
      hasTechnicalBlock = true;
      reasons.push("Over limit");
  }
  
  if (isIntegration) reasons.push("Integration owned");

  if (isParkedExcluded) {
      hasTechnicalBlock = true;
      const ownerTag = templateConfig?.registryOwner || (isVariantMetafieldHold ? "PRODUCTVARIANT" : "PRODUCT");
      const identTag = templateConfig?.registryIdentity || key;
      const parkedReason = isVariantMetafieldHold
        ? `Parked / excluded variant inventory (${ownerTag}:${identTag} — role: EXCLUDED_INPUT). Read-only inspection only; generation, approval, and writes disabled.`
        : `Parked / excluded inventory (${ownerTag}:${identTag} — role: EXCLUDED_INPUT). Read-only inspection only; generation, approval, and writes disabled.`;
      reasons.push(parkedReason);
      if (!baselineDescriptor.evidenceAvailable && isVariantMetafieldHold) {
          reasons.push("Variant-owned metafield value is not loaded in product-level currentMetafields (reported as unavailable/absent, never fabricated).");
      }
  } else if (isImageAltCapabilityPlaceholder) {
      hasTechnicalBlock = true;
      reasons.push(imageAltPlaceholderReason);
  } else if (isGeneralAltCompatField && !hasExistingGeneralAltOnProduct) {
      hasTechnicalBlock = true;
      reasons.push("General alt compatibility field (custom.alt_text) is absent on this product; new general-alt fields are never created automatically.");
  } else if (isVerifiedStdDest) {
      if (!stdEvaluation?.isTechnicallyEligible || !isCategoryEligible) {
          hasTechnicalBlock = true;
          reasons.push(stdEvaluation?.blockReason || "Standardized attribute awaiting valid reference match and category eligibility.");
      } else if (proposalExists) {
          const propValidation = validateProposedStandardizedGidList(propVal, stdEvaluation);
          if (!propValidation.valid) {
              hasTechnicalBlock = true;
              reasons.push(propValidation.reason);
          } else if (!isEqualToCurrent) {
              // Require explicit exact-value approval for changed standardized reference proposals
              contentNeedsReview = true;
          }
      }
  } else if (isStandardizedAttribute) {
      hasTechnicalBlock = true;
      if (categoryEligibility) {
          if (categoryEligibility.isComplete === true && categoryEligibility.isEligible === true) {
              const catReason = typeof categoryEligibility.reason === "string" && categoryEligibility.reason.trim() !== ""
                ? ` (${categoryEligibility.reason.trim()})`
                : "";
              reasons.push(`Standardized attribute read-only (pending_read_only) — Category-eligible for this product${catReason}`);
          } else if (categoryEligibility.isComplete === true && categoryEligibility.isEligible === false) {
              reasons.push(stdEvaluation?.blockReason || "Blocked by product category constraint (Standardized attribute also pending_read_only)");
          } else {
              reasons.push(stdEvaluation?.blockReason || "Standardized attribute read-only (pending_read_only) — Category eligibility check incomplete");
          }
      } else {
          reasons.push("Standardized attribute read-only (pending_read_only)");
      }
  } else if (hasExplicitStorageHold) {
      hasTechnicalBlock = true;
      reasons.push("Measurement storage/writer contract unverified (read-only hold)");
  } else if (isChannelFlagReadOnly) {
      hasTechnicalBlock = true;
      reasons.push("Channel boolean flag read-only pending verified rules (mm-google-shopping.custom_product)");
  } else if (isPendingReadOnly) {
      hasTechnicalBlock = true;
      reasons.push("Field contract read-only (pending_read_only)");
  }

  if (!isParkedExcluded && hasExplicitProducerHold) {
      hasTechnicalBlock = true;
      reasons.push("Producer/writer definition alignment pending verification");
  }

  if (!isParkedExcluded && isVariantMetafieldHold) {
      hasTechnicalBlock = true;
      reasons.push("Variant-owned metafield (PRODUCTVARIANT) held: product-level writer route not applicable");
  }

  if (!isParkedExcluded && (BLOCKED_UNVERIFIED_PINS.includes(targetKeyForProposal) || BLOCKED_UNVERIFIED_PINS.includes(key)) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Type/destination unverified");
  }

  if (!isParkedExcluded && isHardware && GENERIC_VALUES.includes(propVal.trim()) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Generic hardware fill into blank");
  }

  if (!isParkedExcluded && isShippingWeightField && proposalExists) {
      const parsedShipping = Number(propVal);
      if (Number.isNaN(parsedShipping) || parsedShipping <= 0) {
          hasTechnicalBlock = true;
          reasons.push("Shipping weight must be a positive number in OUNCES.");
      } else if (!isUnselectedDraftMode && !isSingleVariant) {
          hasTechnicalBlock = true;
          reasons.push("Shipping weight requires a single complete variant.");
      }
  }

  if (isNativeImageAlt) {
      if (safeData.nativeTargets?.isComplete === false || safeData.nativeTargets?.loadError) {
          hasTechnicalBlock = true;
          reasons.push(`Media targets incomplete/failed. Retry load. Error: ${safeData.nativeTargets?.loadError || 'Pagination failed'}`);
      }
  }

  // Destination-Specific Backend Technical Blockers & Read-Back Conflicts
  // Do not let a custom.seo_title or custom.generated_description metafield block/conflict poison native_seo_title or native_description
  const apiBlockReason = isParkedExcluded
    ? undefined
    : isDestinationSpecificApprovalField
      ? (safeData.blockedFields?.[key] ||
          safeData.blockedFields?.[approvalStorageKey] ||
          (key.startsWith("custom.") ? safeData.blockedFields?.[unprefixedKey] : undefined))
      : (safeData.blockedFields?.[key] ||
          safeData.blockedFields?.[targetKeyForProposal] ||
          safeData.blockedFields?.[unprefixedKey]);

  if (apiBlockReason) {
      hasTechnicalBlock = true;
      reasons.push(`Backend Blocked: ${apiBlockReason}`);
  }

  let conflictData = isParkedExcluded
    ? undefined
    : isDestinationSpecificApprovalField
      ? (safeData.conflicts?.[key] ||
          safeData.conflicts?.[approvalStorageKey] ||
          (key.startsWith("custom.") ? safeData.conflicts?.[unprefixedKey] : undefined))
      : (safeData.conflicts?.[key] ||
          safeData.conflicts?.[targetKeyForProposal] ||
          safeData.conflicts?.[unprefixedKey]);

  let nativeDescConflictData = null;
  if (key === "native_description" && safeData.conflicts?.["native_description"]) {
      nativeDescConflictData = safeData.conflicts["native_description"];
      const expLen = String(nativeDescConflictData.expected || "").length;
      const actLen = String(nativeDescConflictData.actual || "").length;
      reasons.push(`Read-back Mismatch [Native descriptionHtml]: Expected (${expLen} chars) != Actual (${actLen} chars)`);
  }

  if (conflictData && !(key === "native_description" && conflictData === nativeDescConflictData)) {
      if (key === "custom.generated_description" || key === "native_description") {
          const expLen = String(conflictData.expected || "").length;
          const actLen = String(conflictData.actual || "").length;
          reasons.push(`Read-back Mismatch [Metafield / Native Field]: Expected (${expLen} chars) != Actual (${actLen} chars)`);
      } else {
          reasons.push(`Read-back Mismatch [Metafield / Native Field]: ${conflictData.expected} != ${conflictData.actual}`);
      }
  }

  // Content Review Status Evaluation
  if (isParkedExcluded) {
      fieldStatus = currentExists ? "Unchanged" : "Optional blank";
  } else if (currentExists) {
      if (!proposalExists) {
          fieldStatus = "Unchanged";
      } else if (isEqualToCurrent) {
          fieldStatus = "Unchanged";
      } else {
          if (isVerifiedStdDest) {
              contentNeedsReview = true;
              fieldStatus = "Proposed";
              reasons.push("Proposed (Preserves existing references + adds verified entry)");
          } else if (isProtected || isOperatorOwned) {
              contentNeedsReview = true;
              if (!isContentPreApproved && !isKeepOriginalSelected) fieldStatus = "Degrade";
              reasons.push(
                isKeepOriginalSelected
                  ? "Historical: Degrade (Original saved value retained)"
                  : (isContentPreApproved ? "Historical: Degrade (Pre-approved)" : "Degrade")
              );
          } else {
              contentNeedsReview = true;
              if (!isContentPreApproved && !isKeepOriginalSelected) fieldStatus = "Conflict";
              reasons.push(
                isKeepOriginalSelected
                  ? "Historical: Conflict (Original saved value retained)"
                  : (isContentPreApproved ? "Historical: Conflict (Pre-approved)" : "Conflict")
              );
          }
      }
  } else {
      if (!proposalExists) {
          fieldStatus = isRequired ? "Required missing" : "Optional blank";
          if (isRequired) reasons.push("Required missing");
      } else {
          if (source === "Not reported") {
              contentNeedsReview = true;
              if (!isContentPreApproved && !isKeepOriginalSelected) fieldStatus = "Unverified proposal";
              reasons.push(
                isKeepOriginalSelected
                  ? "Historical: Unverified proposal (Original saved value retained)"
                  : (isContentPreApproved ? "Historical: Unverified proposal (Pre-approved)" : "Unverified proposal")
              );
          } else {
              if (!isContentPreApproved && !isKeepOriginalSelected) fieldStatus = "Proposed";
              reasons.push(
                isKeepOriginalSelected
                  ? "Historical: Proposed (Original saved value retained)"
                  : "Proposed"
              );
          }
      }
  }

  const candidateMetaKeyForCheck = templateConfig?.metaKey || (key.startsWith("shopify.") ? key.slice(8) : "");
  const hasStagedCandidateForRow =
    !isUnselectedDraftMode &&
    isVerifiedStdDest &&
    Boolean(standardizedCandidatesByProduct[productId]?.[candidateMetaKeyForCheck]);

  // Apply baseline technical overrides
  if (!isParkedExcluded && isVerifiedStdDest && hasTechnicalBlock && hasStagedCandidateForRow) {
      fieldStatus = "Blocked";
  } else if (!isParkedExcluded && !isKeepOriginalSelected && hasTechnicalBlock && fieldStatus !== "Unchanged" && fieldStatus !== "Optional blank" && fieldStatus !== "Required missing") {
      if (isOverLimit) {
          fieldStatus = "Over limit";
      } else if (isPendingReadOnly || hasTechnicalBlock || reasons.includes("Type/destination unverified") || reasons.includes("Generic hardware fill into blank")) {
          fieldStatus = "Blocked";
      } else if (isNativeImageAlt) {
          fieldStatus = "Blocked";
      }
  }
  
  // Apply read-back and block overrides strictly for UI display (never hidden by Keep-Original)
  if (apiBlockReason) {
      fieldStatus = "API Error / Blocked";
  } else if (conflictData || nativeDescConflictData) {
      fieldStatus = "Save Conflict";
  }

  // React to Keep-Original, Approvals & Pre-Approvals
  if (
    !isParkedExcluded &&
    proposalExists &&
    !isEqualToCurrent &&
    !isManualOnly &&
    !hasContractOrOwnerHold &&
    !apiBlockReason &&
    !conflictData &&
    !nativeDescConflictData
  ) {
      if (isKeepOriginalSelected) {
          fieldStatus = "Keep original (suggestion rejected)";
          isBlockedAction = true;
          contentNeedsReview = false;
          if (!reasons.includes("Use original saved value selected (suggestion rejected; omitted from save payload)")) {
              reasons.push("Use original saved value selected (suggestion rejected; omitted from save payload)");
          }
      } else if (isApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Approved, not saved";
              isBlockedAction = false;
              contentNeedsReview = false;
          }
      } else if (isContentPreApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Pre-approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Pre-approved, not saved";
              isBlockedAction = false;
              contentNeedsReview = false;
          }
      } else {
          if (contentNeedsReview || hasTechnicalBlock) {
              isBlockedAction = true;
          } else {
              isBlockedAction = false; 
          }
      }
  } else {
      if (hasTechnicalBlock || hasContractOrOwnerHold || isParkedExcluded || apiBlockReason || conflictData || nativeDescConflictData || fieldStatus === "Optional blank" || fieldStatus === "Required missing") {
          isBlockedAction = true;
      }
  }

  if (isManualOnly) {
      isBlockedAction = true;
      if (proposalExists && !isEqualToCurrent) {
          fieldStatus = "Manual only";
          if (!reasons.includes("Manual only")) reasons.push("Manual only");
      }
  }

  if (hasContractOrOwnerHold || isParkedExcluded) {
      isBlockedAction = true;
  }

  const canKeepOriginal = Boolean(
    !isUnselectedDraftMode &&
    !isParkedExcluded &&
    !isImageAltCapabilityPlaceholder &&
    !hasContractOrOwnerHold &&
    !isManualOnly &&
    hasLoadedBaseline &&
    baselineDescriptor.evidenceAvailable &&
    proposalExists &&
    !isEqualToCurrent &&
    !apiBlockReason &&
    !conflictData &&
    !nativeDescConflictData &&
    isKnownKey
  );

  const isActualBlockedProposal =
    !isParkedExcluded &&
    !isKeepOriginalSelected &&
    isBlockedAction && 
    !isManualOnly && 
    !isImageAltCapabilityPlaceholder &&
     (!isPendingReadOnly || (isVerifiedStdDest && hasStagedCandidateForRow)) &&
    (!isStandardizedAttribute || isVerifiedStdDest) &&
    !treatAsHiddenContext && 
    ((proposalExists && !isEqualToCurrent) || (isVerifiedStdDest && hasStagedCandidateForRow && hasTechnicalBlock));

  // True only when an editable working field has been manually edited by the operator on the active product/draft
  // and its input value is currently empty (!proposalExists), so it stays mounted in "Needs review" mid-edit
  // without changing proposalExists, approval, or buildRepairPayload semantics.
  const isTemporarilyClearedManualEdit = Boolean(
    isManuallyEdited &&
    !proposalExists &&
    !isParkedExcluded &&
    !isImageAltCapabilityPlaceholder &&
    !hasContractOrOwnerHold &&
    !isManualOnly &&
    isKnownKey
  );

  // Only report Applicable/Inapplicable when explicit existing evidence (e.g. category eligibility) proves it; never infer from blank/false/zero
  const applicabilityState = isParkedExcluded
    ? {
        status: "Parked / Excluded",
        tone: "info",
        reason: "Excluded from active Tab 3 working capabilities (inspectable read-only inventory)"
      }
    : isGeneralAltCompatField
      ? {
          status: hasExistingGeneralAltOnProduct ? "Applicable" : "Not evaluated",
          tone: hasExistingGeneralAltOnProduct ? "info" : "info",
          reason: hasExistingGeneralAltOnProduct
            ? "Existing product-level general alt compatibility metafield (custom.alt_text)"
            : "Compatibility representation (absent on this product)"
        }
      : categoryEligibility && categoryEligibility.isComplete === true
        ? (categoryEligibility.isEligible === false
            ? {
                status: "Inapplicable",
                tone: "warning",
                reason: categoryEligibility.reason || "Confirmed ineligible for this product's taxonomy category"
              }
            : {
                status: "Applicable",
                tone: "success",
                reason: categoryEligibility.reason || "Confirmed eligible for this product's taxonomy category"
              })
        : {
            status: "Not evaluated",
            tone: "info",
            reason: "Applicability not evaluated"
          };

  return { 
    currentVal, propVal, isProposed, fieldStatus, proposalStatus, source, stage, 
    isBlockedAction, reasons, currentExists, proposalExists, isApproved,
    isManuallyEdited,
    isTemporarilyClearedManualEdit,
    isKeepOriginalSelected,
    keepOriginalDecision: isKeepOriginalSelected ? rawKeepOriginalDecision : null,
    canKeepOriginal,
    isParkedExcluded,
    registryRole: templateConfig?.registryRole || (isGeneralAltCompatField ? "COMPAT_REP" : (isParkedExcluded ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION")),
    registryOwner: templateConfig?.registryOwner || (isVariantMetafieldHold ? "PRODUCTVARIANT" : "PRODUCT"),
    registryIdentity: templateConfig?.registryIdentity || (isGeneralAltCompatField ? "custom.alt_text" : key),
    baselineDescriptor,
    hasTechnicalBlock, contentNeedsReview,
    isContentPreApproved, preApprovalReason, isManualOnly, isOperatorOwned, isActualBlockedProposal,
    conflictData, nativeDescConflictData,
    isSupported: isKnownKey,
    hasLoadedBaseline,
    isUnselectedDraftMode,
    approvalStorageKey,
    isPendingReadOnly,
    isStandardizedAttribute,
    isVerifiedStdDest,
    isCategoryEligible,
    categoryEligibility,
    stdEvaluation,
    hasExplicitStorageHold,
    hasExplicitProducerHold,
    isChannelFlagReadOnly,
    isVariantMetafieldHold,
    hasContractOrOwnerHold,
    isImageAltCapabilityPlaceholder,
    imageAltPlaceholderReason,
    applicabilityState,
    type: expectedType,
    owner: (isNativeImageAlt || isImageAltCapabilityPlaceholder || key.startsWith("native_") || NATIVE_FIELDS.includes(key)) ? "native" : (templateConfig?.owner || "metafield"),
    namespace: key.startsWith("shopify.") ? "shopify" : ((isNativeImageAlt || isImageAltCapabilityPlaceholder || key.startsWith("native_")) ? "native" : (templateConfig?.namespace || "custom")),
    metaKey: templateConfig?.metaKey || (key.startsWith("shopify.") ? key.slice(8) : unprefixedKey),
    label: isGeneralAltCompatField ? "Alt Text (General Metafield Compat)" : (templateConfig?.label || formatLabel(key)),
    control: templateConfig?.control
  };
};

export const computeSystemStatus = ({
  data,
  selectedBenchId,
  isLoadingData,
  isExecuting,
  executionMode,
  queueIds,
  loadIndex,
  executeIndex,
  aiStep,
  batchFetcherState,
  batchFetcherFormData,
  referenceMatchFetcherState = "idle",
  pendingReferenceMatch = null,
  referenceMatchStatusByProduct = null,
  safetyMessage = "",
  safetyError
}) => {
  let diag = data?.diagnostics || {
      shopifyRead: "Not reported",
      gemini: "Not reported",
      vision: "Not reported",
      geoLibrary: "Not reported",
      readBack: "Not called",
      stage: "Not reported",
      error: null
  };

  let shopifyReadStatus = diag.shopifyRead;
  let geminiStatus = diag.gemini;
  let visionStatus = diag.vision;
  let geoLibraryStatus = diag.geoLibrary;
  let readBackStatus = diag.readBack;
  let currentStage = diag.stage || "Not reported";

  const isCurrentlyProcessing = (isLoadingData && queueIds[loadIndex] === selectedBenchId) ||
                                (isExecuting && executionMode === "AI_BATCH_PIPELINE" && queueIds[executeIndex] === selectedBenchId) ||
                                (isExecuting && executionMode === "AI_SINGLE_PIPELINE" && selectedBenchId) ||
                                (isExecuting && executionMode === "REPAIR" && queueIds[executeIndex] === selectedBenchId);
  
  let finalStageDisplay = executionMode || "Not reported";
  let fetcherStateDisplay = batchFetcherState;
  let loadingStateDisplay = isLoadingData ? "Loading" : "Idle";
  let errorMessageDisplay = safetyError || diag.error || "None";

  const isPendingRefMatchOnBench =
    Boolean(selectedBenchId) &&
    Boolean(pendingReferenceMatch && pendingReferenceMatch.pieceId === selectedBenchId);

  const productRefStatus =
    selectedBenchId && referenceMatchStatusByProduct && typeof referenceMatchStatusByProduct === "object"
      ? (referenceMatchStatusByProduct[selectedBenchId] || null)
      : null;

  if (isCurrentlyProcessing) {
      if (isLoadingData) {
          shopifyReadStatus = "Running";
      } else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
          if (aiStep === 1) { geminiStatus = "Running"; currentStage = "titleParse"; }
          if (aiStep === 2) { geminiStatus = "Running"; visionStatus = "Running"; currentStage = "tab3FullRescan"; }
          if (aiStep === 3) { geminiStatus = "Running"; currentStage = "generateDescription"; }
          if (aiStep === 4) {
              shopifyReadStatus = "Running";
              currentStage = "resolveStandardizedCandidates";
              if (referenceMatchFetcherState && referenceMatchFetcherState !== "idle") {
                  fetcherStateDisplay = referenceMatchFetcherState;
              }
          }
      } else if (executionMode === "REPAIR") {
          if (isPendingRefMatchOnBench || pendingReferenceMatch?.source === "repair_preflight") {
              shopifyReadStatus = "Running";
              currentStage = "resolveStandardizedCandidates";
              finalStageDisplay = "REPAIR_PREFLIGHT (Read-Only Matching)";
              if (referenceMatchFetcherState && referenceMatchFetcherState !== "idle") {
                  fetcherStateDisplay = referenceMatchFetcherState;
              }
          } else {
              shopifyReadStatus = "Running"; 
              currentStage = "executeRepairPlan";
          }
      }
  }

  // Active reference matching on the selected bench item (manual, AI Stage 4, or single-repair preflight)
  if (isPendingRefMatchOnBench) {
      shopifyReadStatus = "Running";
      currentStage = "resolveStandardizedCandidates";
      if (referenceMatchFetcherState && referenceMatchFetcherState !== "idle") {
          fetcherStateDisplay = referenceMatchFetcherState;
      } else if (pendingReferenceMatch.sawNonIdle === false) {
          fetcherStateDisplay = "submitting";
      }
      if (!isExecuting) {
          if (pendingReferenceMatch.source === "repair_preflight") {
              finalStageDisplay = "REPAIR_PREFLIGHT (Read-Only Matching)";
          } else if (pendingReferenceMatch.source === "ai_stage_4") {
              finalStageDisplay = "AI_STAGE_4 (Read-Only Matching)";
          }
      }
  } else if (!isCurrentlyProcessing && currentStage === "resolveStandardizedCandidates") {
      // Distinguish completed with blocks, paused-for-review preflight, cancelled, and failed/incomplete states
      if (productRefStatus) {
          const st = productRefStatus.state;
          const msg = typeof productRefStatus.message === "string" ? productRefStatus.message : "";
          const hasBlocksInMessage = /blocked by/i.test(msg);

          if (st === "cancelled" || st === "discarded_stale") {
              shopifyReadStatus = st === "cancelled" ? "Cancelled" : "Discarded (Stale)";
              if (productRefStatus.source === "repair_preflight") {
                  finalStageDisplay = "REPAIR_PREFLIGHT_STOPPED (Cancelled)";
              }
              if (errorMessageDisplay === "None" && msg) {
                  errorMessageDisplay = msg;
              }
          } else if (st === "failed" || st === "incomplete") {
              shopifyReadStatus = st === "incomplete" ? "Incomplete" : "Failed";
              if (productRefStatus.source === "repair_preflight") {
                  finalStageDisplay = "REPAIR_PREFLIGHT_HALTED (Failed / Incomplete)";
              }
              if (errorMessageDisplay === "None" && msg) {
                  errorMessageDisplay = msg;
              }
          } else if (st === "completed") {
              if (productRefStatus.source === "repair_preflight") {
                  shopifyReadStatus = hasBlocksInMessage ? "Completed (With Blocks)" : "Completed (Review Required)";
                  finalStageDisplay = "PAUSED_FOR_REVIEW (Repair Preflight Stopped)";
              } else if (hasBlocksInMessage) {
                  shopifyReadStatus = "Completed (With Blocks)";
              } else {
                  shopifyReadStatus = "Completed (Awaiting Approval)";
              }
          }
      } else if (diag.error) {
          shopifyReadStatus = "Failed";
      } else if (typeof safetyMessage === "string" && safetyMessage.includes("Repair preflight matching completed")) {
          const hasBlocksInSafety = /blocked by/i.test(safetyMessage);
          shopifyReadStatus = hasBlocksInSafety ? "Completed (With Blocks)" : "Completed (Review Required)";
          finalStageDisplay = "PAUSED_FOR_REVIEW (Repair Preflight Stopped)";
      }
  }

  if (batchFetcherState !== "idle" && batchFetcherFormData?.get("pieceId") === selectedBenchId) {
      const intent = batchFetcherFormData?.get("intent");
      if (intent === "executeRepairPlan") {
          shopifyReadStatus = "Running";
          currentStage = "executeRepairPlan";
      }
  }

  return {
      shopifyReadStatus, geminiStatus, visionStatus, geoLibraryStatus, readBackStatus,
      currentStage, finalStageDisplay, fetcherStateDisplay, loadingStateDisplay, errorMessageDisplay
  };
};

export const computeDiagnosticsStats = ({
  data,
  selectedBenchId,
  approvals,
  getFieldMetadata,
  includeTab3InspectableInventory = false
}) => {
  if (!data) return null;
  let stats = {
      proposed: 0,
      blocked: 0,
      degraded: 0,
      conflicts: 0,
      unverified: 0,
      optionalBlanks: 0,
      requiredMissing: 0,
      approvedWrite: 0,
      keepOriginal: 0,
      parkedExcluded: 0,
      total: 0,
      filled: 0,
      blank: 0,
      manualOnly: 0,
      unchangedFlagged: 0
  };

  const dynamicSections = getDynamicSections(data, { includeTab3InspectableInventory });
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  dynamicSections.forEach(sec => {
      sec.keys.forEach(k => {
          stats.total++;
          const meta = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
          
          if (meta.isParkedExcluded) {
              stats.parkedExcluded++;
          }

          if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
          else stats.filled++;

          if (meta.isManualOnly) stats.manualOnly++;

          const eligibleForStats =
            !meta.isParkedExcluded &&
            !meta.isImageAltCapabilityPlaceholder &&
            !meta.isPendingReadOnly &&
            !meta.hasExplicitStorageHold &&
            !meta.hasExplicitProducerHold &&
            !meta.isChannelFlagReadOnly &&
            !meta.isVariantMetafieldHold &&
            (!meta.isStandardizedAttribute || meta.isVerifiedStdDest);

          if (meta.isKeepOriginalSelected) {
              stats.keepOriginal++;
          }

          if (
            eligibleForStats &&
            !meta.isKeepOriginalSelected &&
            (meta.fieldStatus === "Proposed" ||
              meta.fieldStatus === "Approved, not saved" ||
              meta.fieldStatus === "Approved, blocked" ||
              meta.fieldStatus === "Pre-approved, not saved" ||
              meta.fieldStatus === "Pre-approved, blocked")
          ) {
              stats.proposed++;
          }
          
          if (meta.isActualBlockedProposal) {
              stats.blocked++;
          } else if (
            meta.isBlockedAction &&
            !meta.isKeepOriginalSelected &&
            !HIDDEN_CONTEXT_FIELDS.includes(k) &&
            !meta.isManualOnly &&
            eligibleForStats &&
            meta.proposalExists &&
            meta.currentVal === meta.propVal
          ) {
              stats.unchangedFlagged++;
          }

          if (meta.fieldStatus === "Degrade") stats.degraded++;
          
          if (meta.fieldStatus === "Conflict") {
              stats.conflicts++;
          } else if (meta.fieldStatus === "Save Conflict") {
              let conflictCounted = false;
              if (meta.conflictData) {
                  stats.conflicts++;
                  conflictCounted = true;
              }
              if (meta.nativeDescConflictData && meta.nativeDescConflictData !== meta.conflictData) {
                  stats.conflicts++;
                  conflictCounted = true;
              }
              if (!conflictCounted) {
                  stats.conflicts++;
              }
          }

          if (meta.fieldStatus === "Unverified proposal") stats.unverified++;
          if (meta.fieldStatus === "Optional blank") stats.optionalBlanks++;
          if (meta.fieldStatus === "Required missing") stats.requiredMissing++;
          if (
            (meta.fieldStatus === "Proposed" ||
              meta.fieldStatus === "Approved, not saved" ||
              meta.fieldStatus === "Pre-approved, not saved") &&
            !meta.isKeepOriginalSelected &&
            !meta.isBlockedAction &&
            eligibleForStats &&
            !HIDDEN_CONTEXT_FIELDS.includes(k)
          ) {
              stats.approvedWrite++;
          }
      });
  });

  return stats;
};

export const buildRepairPayload = (manifest, product, currentId, currentApprovals, getFieldMetadata) => {
  const safePlan = {};
  const nativeChanges = {};
  
  if (!manifest || typeof manifest !== "object" || !isExactProductGidString(currentId)) {
    return { safePlan, nativeChanges };
  }

  const dynamicSections = getDynamicSections(manifest);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  const candidateKeys = new Set(Object.keys(manifest.repairPlan || {}));
  dynamicSections.forEach(sec => {
    (sec.keys || []).forEach(k => candidateKeys.add(k));
  });
  candidateKeys.add("native_title");
  candidateKeys.add("native_description");
  candidateKeys.add("custom.generated_description");
  candidateKeys.add("native_seo_title");
  candidateKeys.add("custom.seo_title");
  candidateKeys.add("native_seo_description");
  candidateKeys.add("native_price");
  candidateKeys.add("native_shipping_weight");
  if (hasStoredNonBlankGeneralAltMetafield(manifest)) {
    candidateKeys.add("custom.alt_text");
  }

  let handledTitle = false;
  let handledShippingWeight = false;
  let handledNativeDescription = false;
  let handledCustomDescription = false;
  let handledNativeSeoTitle = false;
  let handledCustomSeoTitle = false;
  let handledSeoDescription = false;
  let handledGeneralAlt = false;
  let handledPrice = false;

  candidateKeys.forEach(key => {
      // Never serialize a zero-image native_image_alt placeholder or handle per-image alts in the metafield loop
      if (key.startsWith("native_image_alts_") || key === "native_image_alt") return; 
      if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
      if (key.startsWith("custom.std_") || key.startsWith("std_")) return;
      if (key.startsWith("shopify.") && !isVerifiedStandardizedDestination(key)) return;
      if (isParkedExcludedKey(key)) return;

      // Dedicated compatibility writer branch for existing custom.alt_text on the same product:
      // Requires existing stored custom.alt_text baseline, non-empty changed proposal, no technical/Keep-Original block,
      // and explicit exact-value approval (never auto-copied from hero alt and never auto-created when absent).
      if (key === "custom.alt_text" || key === "alt_text") {
          if (handledGeneralAlt) return;
          handledGeneralAlt = true;
          if (!hasStoredNonBlankGeneralAltMetafield(manifest)) return;
          const generalAltMeta = getFieldMetadata("custom.alt_text", manifest, currentId, currentApprovals, allConfigFields);
          const hasGeneralAltBaseline = hasVerifiedLoadedDestinationBaseline("custom.alt_text", manifest, currentId);
          if (
              hasGeneralAltBaseline &&
              !generalAltMeta.isKeepOriginalSelected &&
              !generalAltMeta.isBlockedAction &&
              !generalAltMeta.hasTechnicalBlock &&
              generalAltMeta.isApproved &&
              generalAltMeta.proposalExists &&
              generalAltMeta.propVal !== generalAltMeta.currentVal
          ) {
              safePlan["custom.alt_text"] = serializeFieldValueByType(
                  generalAltMeta.propVal,
                  generalAltMeta.type || "single_line_text_field",
                  "custom.alt_text"
              );
          }
          return;
      }

      if (NON_ORDINARY_COMPAT_AND_EXCLUDED_SET.has(key)) {
          return;
      }
      
      const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);

      if (meta.isImageAltCapabilityPlaceholder || meta.isParkedExcluded || meta.isKeepOriginalSelected) return;

      if (isVerifiedStandardizedDestination(key)) {
          if (
              meta.isKeepOriginalSelected ||
              meta.isPendingReadOnly ||
              meta.isBlockedAction ||
              !meta.isApproved ||
              meta.hasTechnicalBlock ||
              meta.isCategoryEligible !== true
          ) return;
          const valCheck = validateProposedStandardizedGidList(meta.propVal, meta.stdEvaluation);
          if (!valCheck.valid) return;
          if (meta.proposalExists && meta.propVal !== meta.currentVal) {
              safePlan[key] = JSON.stringify(valCheck.gids);
          }
          return;
      }

      if (key === "shopify_title" || key === "native_title") {
          if (handledTitle) return;
          handledTitle = true;
          const titleMeta = getFieldMetadata("native_title", manifest, currentId, currentApprovals, allConfigFields);
          const hasTitleBaseline = hasVerifiedLoadedDestinationBaseline("native_title", manifest, currentId);
          if (
              hasTitleBaseline &&
              !titleMeta.isKeepOriginalSelected &&
              !titleMeta.isBlockedAction &&
              !titleMeta.hasTechnicalBlock &&
              titleMeta.proposalExists &&
              titleMeta.propVal !== titleMeta.currentVal
          ) {
              nativeChanges.title = titleMeta.propVal;
          }
          return;
      }

      if (key === "native_seo_description") {
          if (handledSeoDescription) return;
          handledSeoDescription = true;
          const seoDescMeta = getFieldMetadata("native_seo_description", manifest, currentId, currentApprovals, allConfigFields);
          const hasSeoDescBaseline = hasVerifiedLoadedDestinationBaseline("native_seo_description", manifest, currentId);
          if (
              hasSeoDescBaseline &&
              !seoDescMeta.isKeepOriginalSelected &&
              !seoDescMeta.isBlockedAction &&
              !seoDescMeta.hasTechnicalBlock &&
              seoDescMeta.isApproved &&
              seoDescMeta.proposalExists &&
              seoDescMeta.propVal !== seoDescMeta.currentVal
          ) {
              nativeChanges.seoDescription = seoDescMeta.propVal;
          }
          return;
      }

      if (key === "custom.shipping_weight_oz" || key === "native_shipping_weight") {
          if (handledShippingWeight) return;
          handledShippingWeight = true;
          const variantsConn = manifest.nativeTargets?.variants;
          if (
              variantsConn?.edges?.length === 1 &&
              variantsConn?.pageInfo?.hasNextPage === false &&
              manifest.nativeTargets?.isComplete === true &&
              !manifest.nativeTargets?.loadError
          ) {
              const variantNode = variantsConn.edges[0]?.node;
              const variantId = variantNode?.id;
              const nativeWeightMeta = getFieldMetadata("native_shipping_weight", manifest, currentId, currentApprovals, allConfigFields);
              if (
                  variantId &&
                  !nativeWeightMeta.isKeepOriginalSelected &&
                  !nativeWeightMeta.isBlockedAction &&
                  !nativeWeightMeta.hasTechnicalBlock &&
                  nativeWeightMeta.proposalExists
              ) {
                  const effectiveWeightStr = String(nativeWeightMeta.propVal ?? "").trim();
                  const proposedNum = Number(effectiveWeightStr);
                  if (!effectiveWeightStr || Number.isNaN(proposedNum) || proposedNum <= 0) {
                      return;
                  }
                  const w = variantNode?.inventoryItem?.measurement?.weight;
                  const hasWeightBaseline =
                      w !== null &&
                      w !== undefined &&
                      typeof w === "object" &&
                      w.value !== undefined &&
                      w.value !== null &&
                      typeof w.unit === "string";
                  const isWeightEqual =
                      hasWeightBaseline &&
                      Number(w.value) === proposedNum &&
                      w.unit === "OUNCES";
                  if (!isWeightEqual) {
                      nativeChanges.shippingWeight = {
                          variantId: variantId,
                          value: effectiveWeightStr,
                          unit: "OUNCES"
                      };
                  }
              }
          }
          return;
      }

      if (key === "native_description") {
          if (handledNativeDescription) return;
          handledNativeDescription = true;
          const nativeDescMeta = getFieldMetadata("native_description", manifest, currentId, currentApprovals, allConfigFields);
          const hasNativeDescBaseline = hasVerifiedLoadedDestinationBaseline("native_description", manifest, currentId);
          if (
              hasNativeDescBaseline &&
              !nativeDescMeta.isKeepOriginalSelected &&
              !nativeDescMeta.isBlockedAction &&
              !nativeDescMeta.hasTechnicalBlock &&
              nativeDescMeta.isApproved &&
              nativeDescMeta.proposalExists &&
              nativeDescMeta.propVal !== nativeDescMeta.currentVal
          ) {
              nativeChanges.description = nativeDescMeta.propVal;
          }
          return;
      }

      if (key === "custom.generated_description") {
          if (handledCustomDescription) return;
          handledCustomDescription = true;
          const customDescMeta = getFieldMetadata("custom.generated_description", manifest, currentId, currentApprovals, allConfigFields);
          const hasCustomDescBaseline = hasVerifiedLoadedDestinationBaseline("custom.generated_description", manifest, currentId);
          if (
              hasCustomDescBaseline &&
              !customDescMeta.isKeepOriginalSelected &&
              !customDescMeta.isBlockedAction &&
              !customDescMeta.hasTechnicalBlock &&
              customDescMeta.isApproved &&
              customDescMeta.proposalExists &&
              customDescMeta.propVal !== customDescMeta.currentVal
          ) {
              safePlan["custom.generated_description"] = customDescMeta.propVal;
          }
          return;
      }

      if (key === "native_seo_title") {
          if (handledNativeSeoTitle) return;
          handledNativeSeoTitle = true;
          const nativeSeoMeta = getFieldMetadata("native_seo_title", manifest, currentId, currentApprovals, allConfigFields);
          const hasNativeSeoBaseline = hasVerifiedLoadedDestinationBaseline("native_seo_title", manifest, currentId);
          if (
              hasNativeSeoBaseline &&
              !nativeSeoMeta.isKeepOriginalSelected &&
              !nativeSeoMeta.isBlockedAction &&
              !nativeSeoMeta.hasTechnicalBlock &&
              (nativeSeoMeta.isContentPreApproved || nativeSeoMeta.isApproved) &&
              nativeSeoMeta.proposalExists &&
              nativeSeoMeta.propVal !== nativeSeoMeta.currentVal
          ) {
              nativeChanges.seoTitle = nativeSeoMeta.propVal;
          }
          return;
      }

      if (key === "custom.seo_title") {
          if (handledCustomSeoTitle) return;
          handledCustomSeoTitle = true;
          const customSeoMeta = getFieldMetadata("custom.seo_title", manifest, currentId, currentApprovals, allConfigFields);
          const hasCustomSeoBaseline = hasVerifiedLoadedDestinationBaseline("custom.seo_title", manifest, currentId);
          if (
              hasCustomSeoBaseline &&
              !customSeoMeta.isKeepOriginalSelected &&
              !customSeoMeta.isBlockedAction &&
              !customSeoMeta.hasTechnicalBlock &&
              (customSeoMeta.isContentPreApproved || customSeoMeta.isApproved) &&
              customSeoMeta.proposalExists &&
              customSeoMeta.propVal !== customSeoMeta.currentVal
          ) {
              safePlan["custom.seo_title"] = customSeoMeta.propVal;
          }
          return;
      }

      if (key === "price" || key === "native_price") {
          if (handledPrice) return;
          handledPrice = true;
          const priceMeta = getFieldMetadata("native_price", manifest, currentId, currentApprovals, allConfigFields);
          if (
              priceMeta.isKeepOriginalSelected ||
              priceMeta.isBlockedAction ||
              priceMeta.hasTechnicalBlock ||
              !priceMeta.proposalExists
          ) return;
          const variantsConn = manifest.nativeTargets?.variants;
          const hasSingleVariantBaseline =
              variantsConn?.edges?.length === 1 &&
              variantsConn?.pageInfo?.hasNextPage === false &&
              manifest.nativeTargets?.isComplete === true &&
              !manifest.nativeTargets?.loadError &&
              typeof variantsConn.edges[0]?.node?.price === "string";
          if (!hasSingleVariantBaseline) return;
          if (priceMeta.propVal !== priceMeta.currentVal) {
              safePlan["price"] = priceMeta.propVal;
          }
          return;
      }

      if (key.startsWith("native_") || meta.owner === "native" || meta.namespace === "native") return;
      if (
          meta.isParkedExcluded ||
          meta.isKeepOriginalSelected ||
          meta.isPendingReadOnly ||
          meta.isStandardizedAttribute ||
          meta.hasExplicitStorageHold ||
          meta.hasExplicitProducerHold ||
          meta.isChannelFlagReadOnly ||
          meta.isVariantMetafieldHold ||
          meta.owner === "variant_metafield"
      ) return;
      if (!meta.isSupported || meta.isManualOnly || meta.hasTechnicalBlock || meta.isBlockedAction) return;
      if (HIDDEN_CONTEXT_FIELDS.includes(key) || RETIRED_KEYS.includes(key) || NON_ORDINARY_COMPAT_AND_EXCLUDED_SET.has(key)) return;
      if (!meta.proposalExists) return;

      const canonicalKey = key.includes(".") ? key : `custom.${key}`;
      if (
          HIDDEN_CONTEXT_FIELDS.includes(canonicalKey) ||
          RETIRED_KEYS.includes(canonicalKey) ||
          isParkedExcludedKey(canonicalKey) ||
          NON_ORDINARY_COMPAT_AND_EXCLUDED_SET.has(canonicalKey)
      ) return;
      if (canonicalKey === "custom.collection_date" && GENERIC_VALUES.includes(String(meta.propVal ?? "").trim())) {
          return;
      }

      const hasLoadedMetafieldsMap = Boolean(
        manifest.currentMetafields &&
        typeof manifest.currentMetafields === "object" &&
        !Array.isArray(manifest.currentMetafields)
      );
      if (!hasLoadedMetafieldsMap) return;

      if (meta.propVal !== meta.currentVal) {
          safePlan[canonicalKey] = serializeFieldValueByType(meta.propVal, meta.type, canonicalKey);
      }
  });

  const isMediaComplete = manifest.nativeTargets?.isComplete === true;
  const mediaLoadError = manifest.nativeTargets?.loadError;

  if (isMediaComplete && !mediaLoadError) {
      const imageAlts = [];
      (manifest.nativeTargets?.media?.edges || []).forEach(({ node }) => {
          if (node?.id && isExactMediaImageGidString(node.id)) {
              const key = `native_image_alts_${node.id}`;
              if (manifest.repairPlan && manifest.repairPlan[key] !== undefined) {
                  const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);
                  const hasMediaAltBaseline = typeof node.alt === "string";
                  if (
                      hasMediaAltBaseline &&
                      !meta.isKeepOriginalSelected &&
                      !meta.isBlockedAction &&
                      !meta.hasTechnicalBlock &&
                      meta.proposalExists &&
                      meta.propVal !== meta.currentVal
                  ) {
                      imageAlts.push({ imageId: node.id, altText: meta.propVal });
                  }
              }
          }
      });
      if (imageAlts.length > 0) {
          nativeChanges.imageAlts = imageAlts;
      }
  }
  
  return { safePlan, nativeChanges };
};
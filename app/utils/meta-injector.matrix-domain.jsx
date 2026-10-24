import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  PRODUCT_TEMPLATE_GROUPS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
  PROTECTED_DATA_ENTRIES
} from "./meta-injector.constants.jsx";
import {
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

export const BLOCKED_UNVERIFIED_PINS = [];

export const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "native_seo_title": 70,
  "native_seo_description": 160,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.alt_text": 100000,
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
  "custom.alt_text",
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
  "custom.seo_title"
]);

export const resolveApprovalStorageKey = (key) => {
  if (typeof key !== "string") return "";
  const trimmed = key.trim();
  if (!trimmed) return "";
  if (trimmed === "generated_description") return "custom.generated_description";
  if (trimmed === "seo_title") return "custom.seo_title";
  if (DESTINATION_SPECIFIC_APPROVAL_KEYS.has(trimmed)) {
    return trimmed;
  }
  return NATIVE_ALIAS_MAP[trimmed] || trimmed;
};

const isExactProductGidString = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/Product\/\d+$/.test(val.trim());

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

  return true;
};

const CANONICAL_READ_COMPANIONS = Object.freeze({
  "custom.material": ["custom.stone_family", "stone_family", "custom.primary_medium", "primary_medium"],
  "custom.is_one_of_a_kind": ["custom.is_ooak", "is_ooak"],
  "custom.origin_page_handle": ["custom.origin_handle", "origin_handle"],
  "custom.cut_and_shape": ["custom.cut_type", "cut_type"]
});

export const DESCRIPTION_REVIEW_EXCLUDED_KEYS = ["native_description", "custom.generated_description"];

// Used strictly for global telemetry tracking and source-context preservation. Do not render as a normal editor field.
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

export const resolveConfigFieldDestination = (f) => {
  if (!f) return "";
  if (f.owner === "native" || f.namespace === "native" || f.role === "native_control" || f.key?.startsWith("native_")) {
    return f.key;
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
    lower.startsWith("yes â€”")
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

export const getDynamicSections = (manifest) => {
  return PRODUCT_TEMPLATE_GROUPS.map(group => {
    let keys = [];
    group.fields.forEach(f => {
      if (RETIRED_KEYS.includes(f.key) || RETIRED_KEYS.includes(`custom.${f.key}`)) return;
      if (f.registryRole && f.registryRole !== "PRIMARY_CANDIDATE_DESTINATION" && f.registryRole !== "APPROVED_MEASUREMENT_ADDITION") return;
      if (f.key === "is_ooak" || f.key === "custom.is_ooak" || f.key === "cut_type" || f.key === "custom.cut_type") return;
      
      if (f.key === "native_image_alt") {
        const mediaEdges = manifest?.nativeTargets?.media?.edges;
        const mediaKeys = Array.isArray(mediaEdges)
          ? mediaEdges
              .filter(e => e?.node?.id && /^gid:\/\/shopify\/MediaImage\/\d+$/.test(String(e.node.id)))
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
    
    if (group.heading === "3. Origin, Story, and Collection" || group.heading === "Origin and collection") {
        if (!keys.includes("custom.origin_story")) keys.push("custom.origin_story");
    }

    return { title: group.heading, keys: keys, configFields: group.fields };
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

export const evaluateFieldMetadata = ({
  key,
  data,
  productId,
  currentApprovals,
  configFields = [],
  standardizedCandidatesByProduct = {},
  getStandardizedEvaluationForField
}) => {
  const safeData = data || {};
  const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
  const approvalStorageKey = resolveApprovalStorageKey(key);
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
  const isNativeImageAlt = key.startsWith("native_image_alts_");
  const isImageAltCapabilityPlaceholder = key === "native_image_alt";
  const isShippingWeightField = key === "native_shipping_weight" || key === "custom.shipping_weight_oz";
  const isCollectionDateField = key === "custom.collection_date" || key === "collection_date";
  
  const unprefixedKey = targetKeyForProposal.replace(/^custom\./, '');
  const allTemplateFields =
    Array.isArray(configFields) && configFields.length > 0
      ? configFields
      : PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);

  const templateConfig = allTemplateFields.find(f => {
    if (!f) return false;
    const resolvedDest = resolveConfigFieldDestination(f);
    if (resolvedDest === key || resolvedDest === targetKeyForProposal) return true;
    if (f.key === key || f.key === targetKeyForProposal) return true;
    if (
      f.role !== "standardized_attribute" &&
      f.namespace !== "shopify" &&
      f.owner !== "native" &&
      f.namespace !== "native" &&
      !key.startsWith("shopify.") &&
      f.key === unprefixedKey
    ) {
      return true;
    }
    return false;
  }) || (COMPATIBILITY_ADAPTER_FIELDS || []).find(f => {
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
              : key === "custom.honest_flaws_and_character" || key === "custom.origin_story" || key === "custom.generated_description"
                ? "multi_line_text_field"
                : "single_line_text_field"));

  const isStandardizedAttribute =
    templateConfig?.role === "standardized_attribute" ||
    templateConfig?.namespace === "shopify" ||
    key.startsWith("shopify.");
  const isVerifiedStdDest = isVerifiedStandardizedDestination(targetKeyForProposal);

  const standardizedDestKey = isStandardizedAttribute
    ? (targetKeyForProposal.startsWith("shopify.")
        ? targetKeyForProposal
        : (templateConfig?.metaKey ? `shopify.${templateConfig.metaKey}` : targetKeyForProposal))
    : targetKeyForProposal;

  // Evaluate technical and category eligibility for ALL standardized attributes
  const stdEvaluation = isStandardizedAttribute && typeof getStandardizedEvaluationForField === "function"
    ? getStandardizedEvaluationForField(productId, standardizedDestKey, safeData)
    : null;

  const isCategoryEligible = Boolean(stdEvaluation?.isCategoryEligible);
  const categoryEligibility = stdEvaluation?.categoryEligibility || null;

  // Distinguish actual zero-image placeholder state from per-image media targets only when state establishes it
  const mediaTargetsObj = safeData.nativeTargets?.media;
  const mediaEdgesList = Array.isArray(mediaTargetsObj?.edges)
    ? mediaTargetsObj.edges.filter(e => e?.node?.id && /^gid:\/\/shopify\/MediaImage\/\d+$/.test(String(e.node.id)))
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

  // Explicit contract/verification hold flags from constants.jsx (only when explicitly false/true; absent optional flags do NOT trigger holds)
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

  // Relax pending_read_only ONLY for the six verified standardized destinations when BOTH reference matching and category eligibility pass.
  // A native_image_alt placeholder (without an exact MediaImage ID) is always held read-only and never writable.
  const isPendingReadOnly = isImageAltCapabilityPlaceholder
    ? true
    : isVerifiedStdDest
      ? !(Boolean(stdEvaluation?.isTechnicallyEligible) && isCategoryEligible)
      : (isStandardizedAttribute
          ? true
          : (templateConfig?.mappingStatus === "pending_read_only" || hasExplicitStorageHold || isChannelFlagReadOnly));

  const hasContractOrOwnerHold =
    isImageAltCapabilityPlaceholder ||
    isPendingReadOnly ||
    hasExplicitStorageHold ||
    hasExplicitProducerHold ||
    isChannelFlagReadOnly ||
    isVariantMetafieldHold;

  let currentVal = "";
  const variants = safeData.nativeTargets?.variants?.edges || [];
  const isSingleVariant = variants.length === 1 && 
                          safeData.nativeTargets?.variants?.pageInfo?.hasNextPage === false && 
                          safeData.nativeTargets?.isComplete === true && 
                          !safeData.nativeTargets?.loadError;

  if (isImageAltCapabilityPlaceholder) {
      currentVal = "";
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
      if (isSingleVariant) {
          currentVal = variants[0].node?.price ?? "";
      } else if (variants.length !== 1 || safeData.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !safeData.nativeTargets?.isComplete || safeData.nativeTargets?.loadError) {
          currentVal = "Multiple variants / Incomplete data - review manually";
      }
  } else if (isShippingWeightField) {
      if (key === "native_shipping_weight") {
          if (isSingleVariant) {
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
      const hasCurrent = safeData.currentMetafields?.hasOwnProperty(key);
      let rawCurrent = hasCurrent ? safeData.currentMetafields[key] : "";
      if ((!hasCurrent || String(rawCurrent ?? "").trim() === "") && CANONICAL_READ_COMPANIONS[key]) {
          for (const companionKey of CANONICAL_READ_COMPANIONS[key]) {
              const compVal = safeData.currentMetafields?.[companionKey];
              if (compVal !== undefined && compVal !== null && String(compVal).trim() !== "") {
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

  if (isImageAltCapabilityPlaceholder) {
      isProposed = false;
      propVal = "";
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

  let fieldMeta = safeData.metadata?.[key] || safeData.metadata?.[targetKeyForProposal] || {};
  let source =
    fieldMeta.source ||
    (isVerifiedStdDest && isProposed
      ? "Vision"
      : shippingProposalState?.isDerived
        ? "Derived"
        : "Not reported");
  let stage =
    fieldMeta.stage ||
    (isVerifiedStdDest && isProposed
      ? "resolveStandardizedCandidates"
      : shippingProposalState?.isDerived
        ? "complete_product_weight_calculation"
        : "Not reported");

  let fieldStatus = "Unchanged";
  let proposalStatus = isProposed ? (propVal.trim() !== "" ? "Provided" : "Empty") : "Not provided";
  let isBlockedAction = false;
  let reasons = [];
  
  let isContentPreApproved = false;
  let preApprovalReason = "";

  const currentExists =
    currentVal.trim() !== "" &&
    currentVal.trim() !== "[]" &&
    !(isCollectionDateField && GENERIC_VALUES.includes(currentVal.trim()));
  const proposalExists =
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
    return currentVal === propVal;
  })();

  const isKnownKey =
    templateConfig !== undefined ||
    DESTINATION_SPECIFIC_APPROVAL_KEYS.has(key) ||
    DESTINATION_SPECIFIC_APPROVAL_KEYS.has(targetKeyForProposal) ||
    NATIVE_FIELDS.includes(key) ||
    isNativeImageAlt ||
    isImageAltCapabilityPlaceholder ||
    HIDDEN_CONTEXT_FIELDS.includes(key) ||
    key.startsWith("native_");

  const hasLoadedBaseline =
    (isDescriptionDestination || isSeoTitleDestination || key === "native_seo_description" || key === "native_title" || key === "shopify_title")
      ? hasVerifiedLoadedDestinationBaseline(approvalStorageKey, safeData, productId)
      : true;

  // Never auto-preapprove description destinations, standardized reference proposals, image-alt placeholders, or fields under contract/owner hold
  if (!hasContractOrOwnerHold && !isVerifiedStdDest && !isImageAltCapabilityPlaceholder && !isDescriptionDestination) {
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

  const isRequired = REQUIRED_FIELDS.includes(targetKeyForProposal);
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
  
  // Destination-specific approval lookup: native_description, custom.generated_description, native_seo_title, and custom.seo_title
  // require exact-value approval stored under their own destination key and never fall back across NATIVE_ALIAS_MAP.
  const exactApprovalVal = isDestinationSpecificApprovalField
    ? currentApprovals?.[productId]?.[approvalStorageKey]
    : (currentApprovals?.[productId]?.[key] !== undefined
        ? currentApprovals[productId][key]
        : currentApprovals?.[productId]?.[targetKeyForProposal]);

  const isApproved =
    !isImageAltCapabilityPlaceholder &&
    !hasContractOrOwnerHold &&
    hasLoadedBaseline &&
    (!isVerifiedStdDest || (Boolean(stdEvaluation?.isTechnicallyEligible) && isCategoryEligible)) &&
    exactApprovalVal !== undefined &&
    String(exactApprovalVal) === propVal &&
    propVal.trim() !== "";

  if (HIDDEN_CONTEXT_FIELDS.includes(key)) {
      return {
        currentVal, propVal, isProposed, fieldStatus: "Hidden Source", proposalStatus, source, stage,
        isBlockedAction: true, reasons: ["Hidden Context"], currentExists, proposalExists, isApproved: false,
        hasTechnicalBlock: true, contentNeedsReview: false, isContentPreApproved: false, preApprovalReason: "",
        isManualOnly: false, isActualBlockedProposal: false, isOperatorOwned: false, isSupported: true,
        isPendingReadOnly: false, isStandardizedAttribute: false, hasLoadedBaseline: true,
        approvalStorageKey,
        type: expectedType, owner: templateConfig?.owner || "metafield", namespace: templateConfig?.namespace || "custom",
        metaKey: templateConfig?.metaKey || unprefixedKey, label: templateConfig?.label || formatLabel(key),
        control: templateConfig?.control || "multiline"
      };
  }

  let hasTechnicalBlock = false;
  let contentNeedsReview = false;

  // Require explicit exact-value operator approval for native_description, custom.generated_description,
  // custom.jewelry_type, custom.wire_material, and native_seo_description proposals (including blank destinations).
  if (
    (isDescriptionDestination ||
      targetKeyForProposal === "custom.jewelry_type" ||
      targetKeyForProposal === "custom.wire_material" ||
      key === "native_seo_description") &&
    proposalExists
  ) {
      contentNeedsReview = true;
  }

  // Require demonstrably loaded baseline for the exact product and destination before authorizing any write
  if (!hasLoadedBaseline && (isDescriptionDestination || isSeoTitleDestination || key === "native_seo_description" || key === "native_title" || key === "shopify_title")) {
      hasTechnicalBlock = true;
      reasons.push(`Baseline not loaded or unverified for ${approvalStorageKey} — reload product data before saving`);
  }

  // Technical Verification Layer
  const isOverLimit = limit !== null && !isNativeImageAlt && !isImageAltCapabilityPlaceholder && (currentCount > limit || (isProposed && propCount > limit));
  if (isOverLimit) {
      hasTechnicalBlock = true;
      reasons.push("Over limit");
  }
  
  if (isIntegration) reasons.push("Integration owned");

  if (isImageAltCapabilityPlaceholder) {
      hasTechnicalBlock = true;
      reasons.push(imageAltPlaceholderReason);
  } else if (isVerifiedStdDest) {
      if (!stdEvaluation?.isTechnicallyEligible || !isCategoryEligible) {
          hasTechnicalBlock = true;
          reasons.push(stdEvaluation?.blockReason || "Standardized attribute awaiting valid reference match and category eligibility.");
      } else if (proposalExists) {
          const propValidation = validateProposedStandardizedGidList(propVal, stdEvaluation);
          if (!propValidation.valid) {
              hasTechnicalBlock = true;
              reasons.push(propValidation.reason);
          } else {
              // Require explicit exact-value approval for all standardized reference proposals
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

  if (hasExplicitProducerHold) {
      hasTechnicalBlock = true;
      reasons.push("Producer/writer definition alignment pending verification");
  }

  if (isVariantMetafieldHold) {
      hasTechnicalBlock = true;
      reasons.push("Variant-owned metafield (PRODUCTVARIANT) held: product-level writer route not applicable");
  }

  if ((BLOCKED_UNVERIFIED_PINS.includes(targetKeyForProposal) || BLOCKED_UNVERIFIED_PINS.includes(key)) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Type/destination unverified");
  }

  if (isHardware && GENERIC_VALUES.includes(propVal.trim()) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Generic hardware fill into blank");
  }

  if (isShippingWeightField && proposalExists) {
      const parsedShipping = Number(propVal);
      if (Number.isNaN(parsedShipping) || parsedShipping <= 0) {
          hasTechnicalBlock = true;
          reasons.push("Shipping weight must be a positive number in OUNCES.");
      } else if (!isSingleVariant) {
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
  const apiBlockReason = isDestinationSpecificApprovalField
    ? (safeData.blockedFields?.[key] ||
        (key.startsWith("custom.") ? safeData.blockedFields?.[unprefixedKey] : undefined))
    : (safeData.blockedFields?.[key] ||
        safeData.blockedFields?.[targetKeyForProposal] ||
        safeData.blockedFields?.[unprefixedKey]);

  if (apiBlockReason) {
      hasTechnicalBlock = true;
      reasons.push(`Backend Blocked: ${apiBlockReason}`);
  }

  let conflictData = isDestinationSpecificApprovalField
    ? (safeData.conflicts?.[key] ||
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
  if (currentExists) {
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
              if (!isContentPreApproved) fieldStatus = "Degrade";
              reasons.push(isContentPreApproved ? "Historical: Degrade (Pre-approved)" : "Degrade");
          } else {
              contentNeedsReview = true;
              if (!isContentPreApproved) fieldStatus = "Conflict";
              reasons.push(isContentPreApproved ? "Historical: Conflict (Pre-approved)" : "Conflict");
          }
      }
  } else {
      if (!proposalExists) {
          fieldStatus = isRequired ? "Required missing" : "Optional blank";
          if (isRequired) reasons.push("Required missing");
      } else {
          if (source === "Not reported") {
              contentNeedsReview = true;
              if (!isContentPreApproved) fieldStatus = "Unverified proposal";
              reasons.push(isContentPreApproved ? "Historical: Unverified proposal (Pre-approved)" : "Unverified proposal");
          } else {
              if (!isContentPreApproved) fieldStatus = "Proposed";
              reasons.push("Proposed");
          }
      }
  }

  const candidateMetaKeyForCheck = templateConfig?.metaKey || (key.startsWith("shopify.") ? key.slice(8) : "");
  const hasStagedCandidateForRow =
    isVerifiedStdDest &&
    Boolean(standardizedCandidatesByProduct[productId]?.[candidateMetaKeyForCheck]);

  // Apply baseline technical overrides
  if (isVerifiedStdDest && hasTechnicalBlock && hasStagedCandidateForRow) {
      fieldStatus = "Blocked";
  } else if (hasTechnicalBlock && fieldStatus !== "Unchanged" && fieldStatus !== "Optional blank" && fieldStatus !== "Required missing") {
      if (isOverLimit) {
          fieldStatus = "Over limit";
      } else if (isPendingReadOnly || hasTechnicalBlock || reasons.includes("Type/destination unverified") || reasons.includes("Generic hardware fill into blank")) {
          fieldStatus = "Blocked";
      } else if (isNativeImageAlt) {
          fieldStatus = "Blocked";
      }
  }
  
  // Apply read-back and block overrides strictly for UI display
  if (apiBlockReason) {
      fieldStatus = "API Error / Blocked";
  } else if (conflictData || nativeDescConflictData) {
      fieldStatus = "Save Conflict";
  }

  // React to Approvals & Pre-Approvals
  if (proposalExists && !isEqualToCurrent && !isManualOnly && !hasContractOrOwnerHold && !apiBlockReason && !conflictData && !nativeDescConflictData) {
      if (isContentPreApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Pre-approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Pre-approved, not saved";
              isBlockedAction = false;
          }
      } else if (isApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Approved, not saved";
              isBlockedAction = false;
          }
      } else {
          if (contentNeedsReview || hasTechnicalBlock) {
              isBlockedAction = true;
          } else {
              isBlockedAction = false; 
          }
      }
  } else {
      if (hasTechnicalBlock || hasContractOrOwnerHold || apiBlockReason || conflictData || nativeDescConflictData || fieldStatus === "Optional blank" || fieldStatus === "Required missing") {
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

  if (hasContractOrOwnerHold) {
      isBlockedAction = true;
  }

  const isActualBlockedProposal = isBlockedAction && 
                                  !isManualOnly && 
                                  !isImageAltCapabilityPlaceholder &&
                                  (!isPendingReadOnly || (isVerifiedStdDest && hasStagedCandidateForRow)) &&
                                  (!isStandardizedAttribute || isVerifiedStdDest) &&
                                  !HIDDEN_CONTEXT_FIELDS.includes(key) && 
                                  ((proposalExists && !isEqualToCurrent) || (isVerifiedStdDest && hasStagedCandidateForRow && hasTechnicalBlock));

  // Only report Applicable/Inapplicable when explicit existing evidence (e.g. category eligibility) proves it; never infer from blank/false/zero
  const applicabilityState =
    categoryEligibility && categoryEligibility.isComplete === true
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
    isBlockedAction, reasons, currentExists, proposalExists, isApproved, hasTechnicalBlock, contentNeedsReview,
    isContentPreApproved, preApprovalReason, isManualOnly, isOperatorOwned, isActualBlockedProposal,
    conflictData, nativeDescConflictData,
    isSupported: isKnownKey,
    hasLoadedBaseline,
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
    label: templateConfig?.label || formatLabel(key),
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
  getFieldMetadata
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
      total: 0,
      filled: 0,
      blank: 0,
      manualOnly: 0,
      unchangedFlagged: 0
  };

  const dynamicSections = getDynamicSections(data);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  dynamicSections.forEach(sec => {
      sec.keys.forEach(k => {
          stats.total++;
          const meta = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
          
          if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
          else stats.filled++;

          if (meta.isManualOnly) stats.manualOnly++;

          const eligibleForStats =
            !meta.isImageAltCapabilityPlaceholder &&
            !meta.isPendingReadOnly &&
            !meta.hasExplicitStorageHold &&
            !meta.hasExplicitProducerHold &&
            !meta.isChannelFlagReadOnly &&
            !meta.isVariantMetafieldHold &&
            (!meta.isStandardizedAttribute || meta.isVerifiedStdDest);

          if (eligibleForStats && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked")) stats.proposed++;
          
          if (meta.isActualBlockedProposal) {
              stats.blocked++;
          } else if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k) && !meta.isManualOnly && eligibleForStats && meta.proposalExists && meta.currentVal === meta.propVal) {
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
          if ((meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") && !meta.isBlockedAction && eligibleForStats && !HIDDEN_CONTEXT_FIELDS.includes(k)) stats.approvedWrite++;
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

  let handledTitle = false;
  let handledShippingWeight = false;
  let handledNativeDescription = false;
  let handledCustomDescription = false;
  let handledNativeSeoTitle = false;
  let handledCustomSeoTitle = false;
  let handledSeoDescription = false;
  let handledPrice = false;

  candidateKeys.forEach(key => {
      // Never serialize a zero-image native_image_alt placeholder or handle per-image alts in the metafield loop
      if (key.startsWith("native_image_alts_") || key === "native_image_alt") return; 
      if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
      if (key.startsWith("custom.std_") || key.startsWith("std_")) return;
      if (key.startsWith("shopify.") && !isVerifiedStandardizedDestination(key)) return;
      if (NON_ORDINARY_COMPAT_AND_EXCLUDED_SET.has(key)) {
          return;
      }
      
      const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);

      if (meta.isImageAltCapabilityPlaceholder) return;

      if (isVerifiedStandardizedDestination(key)) {
          if (
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
              if (variantId && !nativeWeightMeta.isBlockedAction && !nativeWeightMeta.hasTechnicalBlock && nativeWeightMeta.proposalExists) {
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
          if (node?.id && /^gid:\/\/shopify\/MediaImage\/\d+$/.test(node.id)) {
              const key = `native_image_alts_${node.id}`;
              if (manifest.repairPlan && manifest.repairPlan[key] !== undefined) {
                  const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);
                  const hasMediaAltBaseline = typeof node.alt === "string";
                  if (
                      hasMediaAltBaseline &&
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
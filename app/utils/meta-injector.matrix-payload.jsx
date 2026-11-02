// ==========================================================================
// ROCKHOUND STUDIO — MATRIX SECTION PROJECTION, TELEMETRY & PAYLOAD SERIALIZER
// File: app/utils/meta-injector.matrix-payload.jsx
// Pure browser-safe section projection, system status & diagnostics telemetry,
// and outbound repair payload serializer. Zero DB, zero network, zero server imports.
// ==========================================================================

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
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList
} from "./meta-injector.standardized.jsx";
import {
  isExactProductGidString,
  isExactMediaImageGidString,
  hasStoredNonBlankGeneralAltMetafield,
  hasVerifiedLoadedDestinationBaseline,
  resolveConfigFieldDestination,
  isParkedExcludedKey
} from "./meta-injector.matrix-baseline.jsx";

export const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  COMPLETE: "Repaired",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

export const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];

export const DESCRIPTION_REVIEW_EXCLUDED_KEYS = ["native_description", "custom.generated_description"];

// Used strictly for global telemetry tracking and source-context preservation in normal 62-slot projection.
export const HIDDEN_CONTEXT_FIELDS = ["custom.origin_story"];

export const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.primary_use"
];

export const NON_ORDINARY_COMPAT_AND_EXCLUDED_SET = (() => {
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
    lower.startsWith("yes \u2014") ||
    lower.startsWith("yes -") ||
    lower.startsWith("yes ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â")
  ) {
    return expectedType === "boolean" ? "true" : "Yes";
  }
  if (lower === "false" || lower === "no" || lower === "0") {
    return expectedType === "boolean" ? "false" : "No";
  }
  return trimmed;
};

export const serializeFieldValueByType = (rawVal, expectedType, targetKey = "") => {
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

          const isInspectableHeldSolidLength =
            (k === "custom.overall_solid_length_in" || k === "overall_solid_length_in") &&
            meta.proposalExists &&
            meta.currentVal !== meta.propVal;

          const eligibleForStats =
            !meta.isParkedExcluded &&
            !meta.isImageAltCapabilityPlaceholder &&
            ((!meta.isPendingReadOnly && !meta.hasExplicitStorageHold) || isInspectableHeldSolidLength) &&
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
              meta.fieldStatus === "Pre-approved, blocked" ||
              (isInspectableHeldSolidLength && meta.fieldStatus === "Blocked"))
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
            !meta.hasExplicitStorageHold &&
            !meta.isPendingReadOnly &&
            (!meta.isJsonCorrectionImportStaged || meta.isApproved) &&
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
              (!titleMeta.isJsonCorrectionImportStaged || titleMeta.isApproved) &&
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
              (nativeSeoMeta.isApproved || (!nativeSeoMeta.isJsonCorrectionImportStaged && nativeSeoMeta.isContentPreApproved)) &&
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
              (customSeoMeta.isApproved || (!customSeoMeta.isJsonCorrectionImportStaged && customSeoMeta.isContentPreApproved)) &&
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
      if (meta.isJsonCorrectionImportStaged && !meta.isApproved) return;
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
                      (!meta.isJsonCorrectionImportStaged || meta.isApproved) &&
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
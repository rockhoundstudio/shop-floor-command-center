// ==========================================================================
// ROCKHOUND STUDIO — PURE SEED PARSING & TITLE-PARSE DRAFT MERGE MODULE
// File: app/utils/meta-injector.intake-draft.jsx
// (Shared Pure Helpers for Tab 1 & Tab 3 Unselected Draft Intake)
// ==========================================================================

import {
  FIELD_CATALOG,
  CANONICAL_CAPABILITY_FIELDS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
  PROTECTED_DATA_ENTRIES,
  UNVERIFIED_PROPOSED_MEASUREMENT_KEYS,
  PRODUCER_ALIGNMENT_PENDING_KEYS,
  normalizeDropdownValue
} from "./meta-injector.constants.jsx";

export function hasMeaningfulValue(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return true;
  if (typeof val === "number") return !Number.isNaN(val);
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return false;
  return String(val).trim() !== "";
}

export function getDerivedMaterial(stoneFam) {
  if (!stoneFam || typeof stoneFam !== "string") return "";
  return stoneFam
    .replace(/^(Dragon's Eye|Green|Blue|Fire|Rufus|Rainbow|Yellow|Red|Black|Oregon)\s+/i, "")
    .trim();
}

export function splitThreePartSeed(rawVal) {
  if (typeof rawVal !== "string") return [];
  const normalized = rawVal
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, "—")
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—")
    .replace(/Ã¢â‚¬â€/g, "—")
    .replace(/ΓÇö/g, "—")
    .replace(/ΓÇô/g, "–")
    .trim();
  if (!normalized) return [];
  // Require whitespace around dash delimiters so internal hyphens in human IDs (e.g. BQH-1, BQH-2) are never split
  return normalized
    .split(/\s+[-—–]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isSegmentedMarketingTitle(val) {
  return splitThreePartSeed(val).length >= 3;
}

export function resolveIdentifierToPreserve(currentPieceName, parsedPieceName) {
  const existing = typeof currentPieceName === "string" ? currentPieceName.trim() : "";
  if (existing && !isSegmentedMarketingTitle(existing)) {
    return existing;
  }
  if (isSegmentedMarketingTitle(existing)) {
    const segs = splitThreePartSeed(existing);
    const tail = segs[segs.length - 1]?.trim() || "";
    if (tail) return tail;
  }
  const candidate = typeof parsedPieceName === "string" ? parsedPieceName.trim() : "";
  if (candidate && !isSegmentedMarketingTitle(candidate)) {
    return candidate;
  }
  return existing;
}

export function evaluateThreePartSeedBlur(rawSeedValue, lastAutofilledTitle = "") {
  const trimmed = typeof rawSeedValue === "string" ? rawSeedValue.trim() : "";
  const segments = splitThreePartSeed(trimmed);
  const lastTrimmed = typeof lastAutofilledTitle === "string" ? lastAutofilledTitle.trim() : "";

  if (segments.length !== 3) {
    return {
      shouldTrigger: false,
      isThreePartSeed: false,
      normalizedSeed: trimmed,
      extractedPieceId: resolveIdentifierToPreserve(trimmed, ""),
      segments
    };
  }

  const extractedPieceId = segments[2] || "";
  const shouldTrigger = trimmed !== "" && trimmed !== lastTrimmed;

  return {
    shouldTrigger,
    isThreePartSeed: true,
    normalizedSeed: trimmed,
    extractedPieceId,
    segments
  };
}

export function buildTitleParseFormData({
  pieceId = "",
  seedString = "",
  requestId = "",
  draftRevision = null
} = {}) {
  const fd = new FormData();
  fd.append("intent", "titleParse");
  if (pieceId !== undefined && pieceId !== null && String(pieceId).trim() !== "") {
    fd.append("pieceId", String(pieceId).trim());
  }
  fd.append("pieceName", typeof seedString === "string" ? seedString.trim() : "");
  if (requestId && typeof requestId === "string" && requestId.trim() !== "") {
    fd.append("requestId", requestId.trim());
  }
  if (draftRevision !== null && draftRevision !== undefined && Number.isFinite(Number(draftRevision))) {
    fd.append("draftRevision", String(draftRevision));
  }
  return fd;
}

const GEO_KEYS_FROM_PARSE = Object.freeze([
  "specific_gravity",
  "diaphaneity",
  "crystal_system",
  "geological_era",
  "mineral_class",
  "rock_composition",
  "rock_formation",
  "geological_age",
  "fracture_pattern",
  "mohs_hardness",
  "luster",
  "cleavage"
]);

function resolveGeoSourceLabelFromParsed(parsed) {
  const rawGeoSource = typeof parsed?.geoSource === "string" ? parsed.geoSource.trim().toLowerCase() : "";
  if (
    rawGeoSource === "library" ||
    rawGeoSource === "cache" ||
    rawGeoSource === "database" ||
    rawGeoSource === "mindat"
  ) {
    return "Geo Library";
  }
  return "Derived (titleParse)";
}

const TAB3_WRITABLE_PRODUCT_DESTINATIONS = (() => {
  const writable = new Set([
    "shopify_title",
    "native_title",
    "native_description",
    "custom.generated_description",
    "native_seo_title",
    "custom.seo_title",
    "native_seo_description",
    "price",
    "native_price",
    "native_shipping_weight",
    "custom.shipping_weight_oz"
  ]);

  const blocked = new Set([
    "native_image_alt",
    "mm-google-shopping.custom_product",
    "custom.origin_story",
    "origin_story",
    "custom.honest_flaws_and_character",
    "honest_flaws_and_character",
    "custom.character_marks",
    "character_marks",
    "custom.stone_story",
    "stone_story",
    "custom.rescued_by",
    "rescued_by",
    "custom.primary_use",
    "primary_use",
    "custom.rarity",
    "rarity",
    "custom.authenticity",
    "authenticity",
    "custom.age_group",
    "age_group",
    "custom.condition",
    "condition",
    "custom.target_gender",
    "target_gender",
    "custom.custom_product",
    "custom_product",
    "custom.is_ooak",
    "is_ooak",
    "custom.stone_family",
    "stone_family",
    "custom.primary_medium",
    "primary_medium",
    "custom.origin_handle",
    "origin_handle",
    "custom.cut_type",
    "cut_type",
    ...UNVERIFIED_PROPOSED_MEASUREMENT_KEYS,
    ...PRODUCER_ALIGNMENT_PENDING_KEYS
  ]);

  const registerBlockedEntry = (f) => {
    if (!f) return;
    if (f.key) {
      blocked.add(f.key);
      if (!f.key.includes(".") && (!f.namespace || f.namespace === "custom")) {
        blocked.add(`custom.${f.key}`);
      }
    }
    if (f.registryIdentity) {
      blocked.add(f.registryIdentity);
    }
  };

  (COMPATIBILITY_ADAPTER_FIELDS || []).forEach(registerBlockedEntry);
  (EXCLUDED_CATALOG_FIELDS || []).forEach(registerBlockedEntry);
  (DUPLICATE_ALIAS_CATALOG_FIELDS || []).forEach(registerBlockedEntry);
  (PROTECTED_DATA_ENTRIES || []).forEach((e) => {
    if (e?.identity) blocked.add(e.identity);
  });

  // Restore explicit companion staging keys used by Tab 3's NATIVE_ALIAS_MAP
  blocked.delete("shopify_title");
  blocked.delete("custom.generated_description");
  blocked.delete("custom.seo_title");
  blocked.delete("custom.shipping_weight_oz");
  blocked.delete("price");

  (CANONICAL_CAPABILITY_FIELDS || []).forEach((field) => {
    if (!field) return;
    const identity =
      field.registryIdentity ||
      (field.namespace === "native" ? field.key : `${field.namespace || "custom"}.${field.metaKey || field.key}`);

    const isHeld =
      field.mappingStatus === "pending_read_only" ||
      field.storageVerified === false ||
      field.writerVerified === false ||
      field.metaConfig?.definitionVerified === false ||
      field.producerAlignmentPending === true ||
      field.registryRole === "APPROVED_MEASUREMENT_ADDITION" ||
      field.owner === "variant_metafield" ||
      (field.registryOwner && field.registryOwner !== "PRODUCT" && field.owner !== "native") ||
      field.namespace === "shopify" ||
      identity === "mm-google-shopping.custom_product" ||
      identity === "native_image_alt";

    if (!isHeld && !blocked.has(identity)) {
      writable.add(identity);
    }
  });

  return writable;
})();

const MANUAL_EDIT_EQUIVALENT_GROUPS = Object.freeze({
  shopify_title: ["shopify_title", "native_title", "canonical_title"],
  native_title: ["shopify_title", "native_title", "canonical_title"],
  "custom.seo_title": ["custom.seo_title", "native_seo_title", "seo_title"],
  native_seo_title: ["custom.seo_title", "native_seo_title", "seo_title"],
  "custom.generated_description": ["custom.generated_description", "native_description", "generated_description"],
  native_description: ["custom.generated_description", "native_description", "generated_description"],
  "custom.piece_name": ["custom.piece_name", "piece_name"],
  "custom.material": ["custom.material", "material", "stone_family", "custom.stone_family"],
  "custom.origin_location": ["custom.origin_location", "origin_location"],
  "custom.origin_page_handle": ["custom.origin_page_handle", "origin_page_handle", "origin_handle", "custom.origin_handle"],
  "custom.collection_name": ["custom.collection_name", "collection_name"],
  "custom.collection_location": ["custom.collection_location", "collection_location"],
  "custom.is_one_of_a_kind": ["custom.is_one_of_a_kind", "is_one_of_a_kind", "is_ooak", "custom.is_ooak"],
  "custom.google_product_category": ["custom.google_product_category", "google_product_category"],
  "custom.mohs_hardness": ["custom.mohs_hardness", "mohs_hardness"],
  "custom.specific_gravity": ["custom.specific_gravity", "specific_gravity"],
  "custom.crystal_system": ["custom.crystal_system", "crystal_system"],
  "custom.luster": ["custom.luster", "luster"],
  "custom.cleavage": ["custom.cleavage", "cleavage"],
  "custom.fracture_pattern": ["custom.fracture_pattern", "fracture_pattern"],
  "custom.diaphaneity": ["custom.diaphaneity", "diaphaneity"],
  "custom.mineral_class": ["custom.mineral_class", "mineral_class"],
  "custom.rock_composition": ["custom.rock_composition", "rock_composition"],
  "custom.rock_formation": ["custom.rock_formation", "rock_formation"],
  "custom.geological_era": ["custom.geological_era", "geological_era"],
  "custom.geological_age": ["custom.geological_age", "geological_age"]
});

const APPROVAL_INVALIDATION_EQUIVALENTS = Object.freeze({
  shopify_title: ["shopify_title", "native_title"],
  native_title: ["shopify_title", "native_title"],
  "custom.seo_title": ["custom.seo_title", "native_seo_title"],
  native_seo_title: ["custom.seo_title", "native_seo_title"],
  "custom.generated_description": ["custom.generated_description", "native_description"],
  native_description: ["custom.generated_description", "native_description"]
});

function isKeyManuallyLocked(destKey, manualEditsMap = {}) {
  if (!manualEditsMap || typeof manualEditsMap !== "object") return false;
  const equivalents = MANUAL_EDIT_EQUIVALENT_GROUPS[destKey] || [
    destKey,
    destKey.replace(/^custom\./, "")
  ];
  return equivalents.some((k) => manualEditsMap[k] === true);
}

/**
 * Pure helper for merging a titleParse response into Tab 1's sharedFields and target piece.
 * Never invokes side-effect callbacks; returnssharedSourceUpdates and pieceSourceUpdates
 * so the caller can commit them cleanly.
 */
export function mergeTitleParseIntoTab1State({
  parsed,
  sharedFields = {},
  piece = {},
  manualSharedEdits = {},
  manualPieceEdits = null,
  explicitTitleOverride = ""
} = {}) {
  const safeParsed = parsed && typeof parsed === "object" ? parsed : {};
  const prevShared = sharedFields && typeof sharedFields === "object" ? sharedFields : {};
  const prevPiece = piece && typeof piece === "object" ? piece : {};
  const pieceManualMap =
    manualPieceEdits && typeof manualPieceEdits === "object"
      ? manualPieceEdits
      : (prevPiece.manualPieceEdits && typeof prevPiece.manualPieceEdits === "object"
          ? prevPiece.manualPieceEdits
          : {});
  const sharedManualMap =
    manualSharedEdits && typeof manualSharedEdits === "object" ? manualSharedEdits : {};

  const sharedSourceUpdates = [];
  const nextSharedFields = { ...prevShared };

  const rawParsedFamily = typeof safeParsed.stone_family === "string" ? safeParsed.stone_family.trim() : "";
  const normalizedFamily = rawParsedFamily
    ? normalizeDropdownValue("stone_family", rawParsedFamily)
    : "";
  const nextStoneFamily =
    (!sharedManualMap.stone_family && !hasMeaningfulValue(prevShared.stone_family) && normalizedFamily)
      ? normalizedFamily
      : (prevShared.stone_family || "");

  const candidateMaterial =
    (typeof safeParsed.material === "string" ? safeParsed.material.trim() : "") ||
    getDerivedMaterial(nextStoneFamily || rawParsedFamily);

  if (
    !sharedManualMap.material &&
    !sharedManualMap["custom.material"] &&
    !hasMeaningfulValue(prevShared.material) &&
    hasMeaningfulValue(candidateMaterial)
  ) {
    nextSharedFields.material = candidateMaterial;
    sharedSourceUpdates.push({
      key: "material",
      source: "Gemini / Geo Library",
      stage: "titleParse"
    });
  }

  if (
    !sharedManualMap.stone_family &&
    !hasMeaningfulValue(prevShared.stone_family) &&
    hasMeaningfulValue(nextStoneFamily)
  ) {
    nextSharedFields.stone_family = nextStoneFamily;
  }

  if (
    !sharedManualMap.collection_name &&
    !hasMeaningfulValue(prevShared.collection_name) &&
    hasMeaningfulValue(safeParsed.collection_name)
  ) {
    nextSharedFields.collection_name = String(safeParsed.collection_name).trim();
    sharedSourceUpdates.push({
      key: "collection_name",
      source: "Gemini / Dwell Web",
      stage: "titleParse"
    });
  }

  if (
    !sharedManualMap.collection_location &&
    !hasMeaningfulValue(prevShared.collection_location) &&
    hasMeaningfulValue(safeParsed.collection_location)
  ) {
    nextSharedFields.collection_location = String(safeParsed.collection_location).trim();
    sharedSourceUpdates.push({
      key: "collection_location",
      source: "Gemini / Dwell Web",
      stage: "titleParse"
    });
  }

  if (
    !sharedManualMap.origin_location &&
    !hasMeaningfulValue(prevShared.origin_location) &&
    hasMeaningfulValue(safeParsed.origin_location)
  ) {
    nextSharedFields.origin_location = String(safeParsed.origin_location).trim();
    sharedSourceUpdates.push({
      key: "origin_location",
      source: "Gemini / Dwell Web",
      stage: "titleParse"
    });
  }

  const incomingOriginHandle =
    (typeof safeParsed.origin_page_handle === "string" && safeParsed.origin_page_handle.trim()) ||
    (typeof safeParsed.origin_handle === "string" && safeParsed.origin_handle.trim()) ||
    "";

  if (
    !sharedManualMap.origin_page_handle &&
    !sharedManualMap.origin_handle &&
    !hasMeaningfulValue(prevShared.origin_page_handle) &&
    !hasMeaningfulValue(prevShared.origin_handle) &&
    incomingOriginHandle
  ) {
    nextSharedFields.origin_handle = incomingOriginHandle;
    nextSharedFields.origin_page_handle = incomingOriginHandle;
    sharedSourceUpdates.push({
      key: "origin_page_handle",
      source: "Gemini / Dwell Web",
      stage: "titleParse"
    });
  }

  // Preserve human-supplied origin_story; only populate shared AI source context when blank
  if (
    !sharedManualMap.origin_story &&
    !hasMeaningfulValue(prevShared.origin_story) &&
    hasMeaningfulValue(safeParsed.origin_story)
  ) {
    nextSharedFields.origin_story = String(safeParsed.origin_story).trim();
  }

  const geoSourceLabel = resolveGeoSourceLabelFromParsed(safeParsed);
  GEO_KEYS_FROM_PARSE.forEach((gk) => {
    const incomingGeoVal =
      gk === "fracture_pattern"
        ? (safeParsed.fracture_pattern ?? safeParsed.fracture)
        : safeParsed[gk];
    if (
      !sharedManualMap[gk] &&
      !sharedManualMap[`custom.${gk}`] &&
      !hasMeaningfulValue(prevShared[gk]) &&
      hasMeaningfulValue(incomingGeoVal)
    ) {
      nextSharedFields[gk] = String(incomingGeoVal).trim();
      sharedSourceUpdates.push({
        key: gk,
        source: geoSourceLabel,
        stage: "titleParse"
      });
    }
  });

  if (
    !sharedManualMap.google_product_category &&
    !hasMeaningfulValue(prevShared.google_product_category) &&
    hasMeaningfulValue(safeParsed.google_product_category)
  ) {
    nextSharedFields.google_product_category = String(safeParsed.google_product_category).trim();
  }

  const nextPieceSources = { ...(prevPiece.recordedSources || {}) };
  const nextPiece = {
    ...prevPiece,
    recordedSources: nextPieceSources
  };

  // Preserve human internal identifier separate from canonical_title
  if (!pieceManualMap.piece_name || isSegmentedMarketingTitle(prevPiece.piece_name)) {
    const preservedIdentifier = resolveIdentifierToPreserve(
      prevPiece.piece_name,
      safeParsed.piece_name
    );
    if (preservedIdentifier) {
      nextPiece.piece_name = preservedIdentifier;
    }
  }

  const hasExplicitTitleLock =
    hasMeaningfulValue(explicitTitleOverride) ||
    Boolean(pieceManualMap.canonical_title || pieceManualMap.native_title);
  const fullCustomerTitle =
    (typeof safeParsed.canonical_title === "string" && safeParsed.canonical_title.trim()) ||
    (typeof safeParsed.product_title === "string" && safeParsed.product_title.trim()) ||
    "";

  if (!hasExplicitTitleLock && fullCustomerTitle) {
    nextPiece.canonical_title = fullCustomerTitle;
    nextPiece.native_title = fullCustomerTitle;
    nextPieceSources.canonical_title = { source: "Gemini", stage: "titleParse" };
    nextPieceSources.native_title = { source: "Gemini", stage: "titleParse" };
  }

  const parsedSeoTitle =
    typeof safeParsed.seo_title === "string" ? safeParsed.seo_title.trim() : "";
  if (
    !pieceManualMap.seo_title &&
    !pieceManualMap.native_seo_title &&
    parsedSeoTitle
  ) {
    nextPiece.seo_title = parsedSeoTitle;
    nextPiece.native_seo_title = parsedSeoTitle;
    nextPieceSources.seo_title = { source: "Gemini", stage: "titleParse" };
    nextPieceSources.native_seo_title = { source: "Gemini", stage: "titleParse" };
  }

  if (typeof safeParsed.handle === "string" && safeParsed.handle.trim() && !nextPiece.handle) {
    nextPiece.handle = safeParsed.handle.trim();
  }

  return {
    nextSharedFields,
    nextPiece,
    sharedSourceUpdates
  };
}

/**
 * Pure helper for mapping a titleParse response into Tab 3's unselectedDraftManifest
 * and isolated sourceContext without side effects.
 *
 * Enforces:
 * - Strict request/revision correlation (rejects stale responses after reset, product switch, or seed edit).
 * - AI source-context isolation: origin_story and honest_flaws_and_character stay in sourceContext,
 *   never entering repairPlan["custom.origin_story"] or becoming save candidates.
 * - No fabricated verifiedGeoValues: geo proposals enter repairPlan["custom.<key>"] only, while
 *   verifiedGeoValues is preserved unchanged (never populated from AI/titleParse proposals).
 * - Evidence-based source attribution: only labels geo fields "Geo Library" when parsed.geoSource
 *   establishes a library/cache/database/mindat lookup.
 * - Full protection of manual edits and explicit title overrides across native/custom aliases.
 */
export function applyTitleParseToTab3Draft({
  parsed,
  requestCorrelation = null,
  currentCorrelation = null,
  draftManifest = null,
  manualEditsMap = {},
  sourceContext = {}
} = {}) {
  const safeDraft =
    draftManifest && typeof draftManifest === "object"
      ? draftManifest
      : {
          isUnselectedDraft: true,
          currentMetafields: {},
          nativeTargets: null,
          repairPlan: {},
          metadata: {},
          verifiedGeoValues: {}
        };
  const safeSourceContext =
    sourceContext && typeof sourceContext === "object"
      ? sourceContext
      : {
          rawSeedInput: "",
          explicitTitleOverride: "",
          primary_use: "",
          origin_story: "",
          honest_flaws_and_character: ""
        };

  // Stale-response guard: verify active unselected mode, requestId, draftRevision, and seed correlation
  if (requestCorrelation && typeof requestCorrelation === "object") {
    const curr = currentCorrelation && typeof currentCorrelation === "object" ? currentCorrelation : {};
    if (curr.selectedBenchId !== undefined && curr.selectedBenchId !== null) {
      return {
        staleRejected: true,
        staleReason: "bench_product_selected",
        nextDraftManifest: safeDraft,
        nextSourceContext: safeSourceContext,
        invalidatedApprovalKeys: []
      };
    }
    if (
      requestCorrelation.requestId &&
      curr.activeRequestId &&
      requestCorrelation.requestId !== curr.activeRequestId
    ) {
      return {
        staleRejected: true,
        staleReason: "request_id_mismatch",
        nextDraftManifest: safeDraft,
        nextSourceContext: safeSourceContext,
        invalidatedApprovalKeys: []
      };
    }
    if (
      requestCorrelation.draftEpoch !== undefined &&
      curr.draftEpoch !== undefined &&
      requestCorrelation.draftEpoch !== curr.draftEpoch
    ) {
      return {
        staleRejected: true,
        staleReason: "draft_epoch_reset",
        nextDraftManifest: safeDraft,
        nextSourceContext: safeSourceContext,
        invalidatedApprovalKeys: []
      };
    }
    if (
      typeof requestCorrelation.requestSeed === "string" &&
      typeof curr.currentSeedInput === "string" &&
      requestCorrelation.requestSeed.trim() !== curr.currentSeedInput.trim()
    ) {
      return {
        staleRejected: true,
        staleReason: "seed_input_changed",
        nextDraftManifest: safeDraft,
        nextSourceContext: safeSourceContext,
        invalidatedApprovalKeys: []
      };
    }
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      staleRejected: false,
      staleReason: null,
      nextDraftManifest: safeDraft,
      nextSourceContext: safeSourceContext,
      invalidatedApprovalKeys: []
    };
  }

  const nextRepairPlan = { ...(safeDraft.repairPlan || {}) };
  const nextMetadata = { ...(safeDraft.metadata || {}) };
  // Preserve existing verifiedGeoValues untouched; never populate from titleParse proposals
  const preservedVerifiedGeoValues = { ...(safeDraft.verifiedGeoValues || {}) };
  const nextSourceContext = { ...safeSourceContext };
  const invalidatedSet = new Set();

  const stageDraftField = (destKey, rawVal, sourceLabel, stageLabel = "titleParse") => {
    if (!destKey || !TAB3_WRITABLE_PRODUCT_DESTINATIONS.has(destKey)) {
      return;
    }
    if (!hasMeaningfulValue(rawVal)) {
      return;
    }
    if (isKeyManuallyLocked(destKey, manualEditsMap)) {
      return;
    }

    const cleanVal = String(rawVal).trim();
    if (!cleanVal) return;

    const prevVal = nextRepairPlan[destKey];
    if (prevVal === cleanVal) {
      return;
    }

    nextRepairPlan[destKey] = cleanVal;
    nextMetadata[destKey] = {
      source: sourceLabel || "Derived (titleParse)",
      stage: stageLabel
    };

    invalidatedSet.add(destKey);
    const eqList = APPROVAL_INVALIDATION_EQUIVALENTS[destKey];
    if (Array.isArray(eqList)) {
      eqList.forEach((eqKey) => invalidatedSet.add(eqKey));
    }
  };

  // 1. Preserve human identifier in custom.piece_name (never the 3-part marketing title)
  const currentPieceNameInPlan = nextRepairPlan["custom.piece_name"] || "";
  const seedFallback =
    typeof requestCorrelation?.requestSeed === "string"
      ? requestCorrelation.requestSeed
      : (nextSourceContext.rawSeedInput || "");
  const resolvedHumanId = resolveIdentifierToPreserve(
    currentPieceNameInPlan || seedFallback,
    parsed.piece_name
  );
  if (resolvedHumanId) {
    stageDraftField("custom.piece_name", resolvedHumanId, "Derived (3-Part Seed)", "titleParse");
  }

  // 2. Native Product Title proposal (shopify_title / native_title), respecting explicitTitleOverride and manual edits
  const explicitOverrideTrimmed =
    typeof nextSourceContext.explicitTitleOverride === "string"
      ? nextSourceContext.explicitTitleOverride.trim()
      : "";
  const fullCustomerTitle =
    (typeof parsed.canonical_title === "string" && parsed.canonical_title.trim()) ||
    (typeof parsed.product_title === "string" && parsed.product_title.trim()) ||
    "";

  if (!explicitOverrideTrimmed && fullCustomerTitle) {
    stageDraftField("shopify_title", fullCustomerTitle, "Gemini", "titleParse");
  }

  // 3. Canonical Stone Identity: custom.material (never primary_medium)
  const rawParsedFamily = typeof parsed.stone_family === "string" ? parsed.stone_family.trim() : "";
  const normalizedFamily = rawParsedFamily
    ? normalizeDropdownValue("stone_family", rawParsedFamily)
    : "";
  const candidateMaterial =
    (typeof parsed.material === "string" && parsed.material.trim()) ||
    getDerivedMaterial(normalizedFamily || rawParsedFamily) ||
    normalizedFamily;

  if (candidateMaterial) {
    stageDraftField("custom.material", candidateMaterial, "Gemini / Geo Library", "titleParse");
  }

  // 4. Origin & Collection canonical capabilities
  if (hasMeaningfulValue(parsed.origin_location)) {
    stageDraftField("custom.origin_location", parsed.origin_location, "Gemini / Dwell Web", "titleParse");
  }

  const resolvedOriginPageHandle =
    (typeof parsed.origin_page_handle === "string" && parsed.origin_page_handle.trim()) ||
    (typeof parsed.origin_handle === "string" && parsed.origin_handle.trim()) ||
    "";
  if (resolvedOriginPageHandle) {
    stageDraftField("custom.origin_page_handle", resolvedOriginPageHandle, "Gemini / Dwell Web", "titleParse");
  }

  if (hasMeaningfulValue(parsed.collection_name)) {
    stageDraftField("custom.collection_name", parsed.collection_name, "Gemini / Dwell Web", "titleParse");
  }

  if (hasMeaningfulValue(parsed.collection_location)) {
    stageDraftField("custom.collection_location", parsed.collection_location, "Gemini / Dwell Web", "titleParse");
  }

  // 5. Canonical OOAK (custom.is_one_of_a_kind) only when explicitly supplied in parsed output
  if (hasMeaningfulValue(parsed.is_one_of_a_kind)) {
    stageDraftField("custom.is_one_of_a_kind", parsed.is_one_of_a_kind, "Derived (titleParse)", "titleParse");
  }

  // 6. SEO Title proposal (shared proposal source custom.seo_title for native_seo_title / custom.seo_title)
  if (hasMeaningfulValue(parsed.seo_title)) {
    stageDraftField("custom.seo_title", parsed.seo_title, "Gemini", "titleParse");
  }

  // 7. Google Product Category (custom.google_product_category)
  if (hasMeaningfulValue(parsed.google_product_category)) {
    stageDraftField(
      "custom.google_product_category",
      parsed.google_product_category,
      "Derived (titleParse)",
      "titleParse"
    );
  }

  // 8. Geology fields -> staged in repairPlan only (never verifiedGeoValues), with evidence-based source label
  const geoSourceLabel = resolveGeoSourceLabelFromParsed(parsed);
  GEO_KEYS_FROM_PARSE.forEach((gk) => {
    const rawGeoVal =
      gk === "fracture_pattern"
        ? (parsed.fracture_pattern ?? parsed.fracture)
        : parsed[gk];
    if (hasMeaningfulValue(rawGeoVal)) {
      stageDraftField(`custom.${gk}`, rawGeoVal, geoSourceLabel, "titleParse");
    }
  });

  // 9. Source Context Isolation: keep origin_story strictly in nextSourceContext, never in repairPlan
  if (
    !hasMeaningfulValue(nextSourceContext.origin_story) &&
    hasMeaningfulValue(parsed.origin_story)
  ) {
    nextSourceContext.origin_story = String(parsed.origin_story).trim();
  }
  delete nextRepairPlan["custom.origin_story"];
  delete nextRepairPlan["origin_story"];

  const nextDraftManifest = {
    ...safeDraft,
    isUnselectedDraft: true,
    repairPlan: nextRepairPlan,
    metadata: nextMetadata,
    verifiedGeoValues: preservedVerifiedGeoValues
  };

  return {
    staleRejected: false,
    staleReason: null,
    nextDraftManifest,
    nextSourceContext,
    invalidatedApprovalKeys: Array.from(invalidatedSet)
  };
}
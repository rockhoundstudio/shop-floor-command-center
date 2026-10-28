// ==========================================================================
// ROCKHOUND STUDIO — TAB 3 JSON CORRECTION IMPORT PARSER, VALIDATOR & PLANNER
// File: app/utils/meta-injector.correction-import.jsx
// (Pure, Stateless Validation & Draft Patch Planner — Zero Side Effects)
// ==========================================================================

import {
  TAB3_INSPECTABLE_TEMPLATE_GROUPS,
  COMPATIBILITY_ADAPTER_FIELDS
} from "./meta-injector.constants.jsx";
import {
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  NATIVE_ALIAS_MAP,
  FIELD_LIMITS,
  HARDWARE_FIELDS,
  GENERIC_VALUES,
  resolveApprovalStorageKey,
  resolveConfigFieldDestination,
  isParkedExcludedKey,
  evaluateFieldMetadata
} from "./meta-injector.matrix-domain.jsx";
import {
  isExactProductGid,
  computeQuickTextDigest,
  inspectRawStoredFieldBaseline,
  buildMeasuredUiAuditSnapshot
} from "./meta-injector.live-bench-sync.jsx";

export const CORRECTION_PACKET_SCHEMA_VERSION = 1;
export const CORRECTION_PACKET_KIND = "tab3_draft_correction_packet";
export const MAX_CORRECTION_FILE_BYTES = 262144; // 256 KB
export const MAX_CORRECTIONS_PER_PACKET = 25;
export const MAX_PACKET_ID_LENGTH = 120;
export const MAX_SOURCE_REPORT_ID_LENGTH = 120;
export const MAX_FIELD_KEY_LENGTH = 200;
export const MAX_REASON_LENGTH = 500;
export const MAX_PROPOSED_VALUE_LENGTH = 65536;

export const SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS = Object.freeze({
  "custom.generated_description": ["native_description", "custom.generated_description"],
  "native_description": ["native_description", "custom.generated_description"],
  "custom.seo_title": ["native_seo_title", "custom.seo_title"],
  "native_seo_title": ["native_seo_title", "custom.seo_title"]
});

export const DISALLOWED_CORRECTION_FIELD_KEYS = Object.freeze(
  new Set([
    "price",
    "native_price",
    "custom.price",
    "native_shipping_weight",
    "custom.shipping_weight_oz",
    "shipping_weight_oz",
    "custom.overall_solid_length_in",
    "overall_solid_length_in",
    "custom.whole_product_weight_grams",
    "whole_product_weight_grams",
    "custom.chain_cord_length_in",
    "chain_cord_length_in",
    "custom.accessory_dimensions_mm",
    "accessory_dimensions_mm",
    "custom.fitting_opening_mm",
    "fitting_opening_mm",
    "mm-google-shopping.custom_product",
    "custom.custom_product",
    "native_image_alt",
    "standardized_candidates",
    "custom.standardized_candidates"
  ])
);

const ALLOWED_TOP_LEVEL_PACKET_KEYS = new Set([
  "schemaVersion",
  "packetKind",
  "packetId",
  "createdAt",
  "productId",
  "benchSessionId",
  "benchRevision",
  "sourceReportId",
  "corrections"
]);

const ALLOWED_CORRECTION_ITEM_KEYS = new Set([
  "fieldKey",
  "preconditions",
  "proposedValue",
  "reason"
]);

const ALLOWED_PRECONDITION_KEYS = new Set([
  "rawBaselineExists",
  "rawBaselineValue",
  "evaluatedBaselineExists",
  "evaluatedBaselineValue",
  "isProposed",
  "proposalExists",
  "proposalStatus",
  "currentProposedValue"
]);

const ALLOWED_PROPOSAL_STATUS_VALUES = new Set([
  "Provided",
  "Empty",
  "Not provided"
]);

const SUPPORTED_PROPOSED_VALUE_FIELD_TYPES = new Set([
  "single_line_text_field",
  "multi_line_text_field",
  "native",
  "number_decimal",
  "list.metaobject_reference"
]);

function isPlainRecord(val) {
  if (val === null || typeof val !== "object" || Array.isArray(val)) {
    return false;
  }
  const proto = Object.getPrototypeOf(val);
  return proto === Object.prototype || proto === null;
}

export function getUtf8ByteLength(str) {
  const text = typeof str === "string" ? str : String(str ?? "");
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text).byteLength;
  }
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code <= 0x7f) {
      bytes += 1;
    } else if (code <= 0x7ff) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

function canonicalizeJsonValue(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === "boolean" || typeof val === "number" || typeof val === "string") {
    return val;
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeJsonValue);
  }
  if (isPlainRecord(val)) {
    const sortedKeys = Object.keys(val).sort();
    const out = {};
    for (let i = 0; i < sortedKeys.length; i += 1) {
      const k = sortedKeys[i];
      if (val[k] !== undefined) {
        out[k] = canonicalizeJsonValue(val[k]);
      }
    }
    return out;
  }
  return String(val);
}

function areJsonValuesStrictlyEqual(a, b) {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!areJsonValuesStrictlyEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isPlainRecord(a) && isPlainRecord(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (let i = 0; i < keysA.length; i += 1) {
      const k = keysA[i];
      if (!Object.prototype.hasOwnProperty.call(b, k)) return false;
      if (!areJsonValuesStrictlyEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

export function buildSharedInvalidationKeySet(rawKey) {
  if (typeof rawKey !== "string" || !rawKey.trim()) return [];
  const trimmed = rawKey.trim();
  const targetKey =
    trimmed === "alt_text" || trimmed === "custom.alt_text"
      ? "custom.alt_text"
      : NATIVE_ALIAS_MAP[trimmed] || trimmed;
  const approvalKey = resolveApprovalStorageKey(trimmed);
  return Array.from(
    new Set(
      [
        trimmed,
        targetKey,
        approvalKey,
        ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[trimmed] || []),
        ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[targetKey] || []),
        ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[approvalKey] || [])
      ].filter(Boolean)
    )
  );
}

export function computeCorrectionsContentDigest(corrections) {
  if (!Array.isArray(corrections)) return "";
  return computeQuickTextDigest(JSON.stringify(canonicalizeJsonValue(corrections)));
}

export function buildImportReplayKey(benchSessionId, productId, packetId) {
  return `${String(benchSessionId || "").trim()}::${String(productId || "").trim()}::${String(packetId || "").trim()}`;
}

/**
 * Computes the exact live bench content digest for the currently selected product
 * using the identical input shape as `useLiveBenchTelemetrySync` in `meta-injector.live-bench-sync.jsx`.
 * This allows synchronous detection of local changes made during the 380ms debounce window
 * or before React's sync effect has fired.
 */
export function computeCurrentSelectedBenchLiveDigest({
  selectedBenchId,
  manifestData,
  productStates,
  approvals,
  keepOriginalDecisions,
  manualEdits,
  repairHistory,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  sectionAuditMeasurements
}) {
  if (!selectedBenchId || !isExactProductGid(selectedBenchId)) {
    return null;
  }
  const activeProductData = manifestData?.[selectedBenchId] || null;
  const isManifestLoaded = Boolean(activeProductData);
  const activeMeasurements =
    sectionAuditMeasurements &&
    typeof sectionAuditMeasurements === "object" &&
    sectionAuditMeasurements.productId === selectedBenchId
      ? sectionAuditMeasurements
      : null;

  const measuredUiAudit = isManifestLoaded
    ? buildMeasuredUiAuditSnapshot(selectedBenchId, activeMeasurements)
    : null;

  const activeQueueStatus = productStates?.[selectedBenchId]?.status || null;
  const activeHistory = repairHistory?.[selectedBenchId] || null;
  const activeSubmitted = submittedPayloads?.[selectedBenchId] || null;
  const activeCandidates = standardizedCandidatesByProduct?.[selectedBenchId] || null;
  const activeRefMatch = referenceMatchResultsByProduct?.[selectedBenchId] || null;
  const activeRefStatus = referenceMatchStatusByProduct?.[selectedBenchId] || null;

  return computeQuickTextDigest(
    JSON.stringify({
      selectionState: "selected",
      productId: selectedBenchId,
      manifestLoaded: isManifestLoaded,
      queueStatus: activeQueueStatus,
      currentMetafields: activeProductData?.currentMetafields || null,
      nativeTargets: activeProductData?.nativeTargets || null,
      repairPlan: activeProductData?.repairPlan || null,
      metadata: activeProductData?.metadata || null,
      draftSourceContext: null,
      diagnostics: activeProductData?.diagnostics || null,
      approvals: approvals?.[selectedBenchId] || null,
      keepOriginal: keepOriginalDecisions?.[selectedBenchId] || null,
      manualEdits: manualEdits?.[selectedBenchId] || null,
      historyCompletedAt: activeHistory?.completedAt || null,
      historyStatus: activeHistory?.status || null,
      submitted: activeSubmitted || null,
      candidates: activeCandidates || null,
      refMatchAt: activeRefMatch?.matchedAt || null,
      refStatusAt: activeRefStatus?.updatedAt || null,
      refStatusState: activeRefStatus?.state || null,
      uiAudit: measuredUiAudit
    })
  );
}

/**
 * Verifies whether all planned edits in a validated correction plan are actually present
 * in the committed React state (`manifestData`, `manualEdits`, `approvals`, `keepOriginalDecisions`).
 */
export function verifyCommittedCorrectionPatch({
  plan,
  selectedBenchId,
  benchSessionId,
  manifestData,
  manualEdits,
  approvals,
  keepOriginalDecisions
}) {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.validatedItems) || plan.validatedItems.length === 0) {
    return { committed: false, reason: "Invalid or empty correction plan." };
  }
  if (!selectedBenchId || selectedBenchId !== plan.productId) {
    return { committed: false, reason: "Active bench product changed before commit completed." };
  }
  if (!benchSessionId || benchSessionId !== plan.benchSessionId) {
    return { committed: false, reason: "Active bench session changed before commit completed." };
  }

  const activeManifest = manifestData?.[selectedBenchId];
  if (!activeManifest || typeof activeManifest !== "object") {
    return { committed: false, reason: "Product manifest is no longer loaded." };
  }

  const activeRepairPlan = activeManifest.repairPlan || {};
  const activeMetadata = activeManifest.metadata || {};
  const activeManualMap = manualEdits?.[selectedBenchId] || {};
  const activeApprovalsMap = approvals?.[selectedBenchId] || {};
  const activeKeepMap = keepOriginalDecisions?.[selectedBenchId] || {};

  for (let i = 0; i < plan.validatedItems.length; i += 1) {
    const item = plan.validatedItems[i];
    if (activeRepairPlan[item.targetKeyForProposal] !== item.normalizedValue) {
      return {
        committed: false,
        reason: `repairPlan["${item.targetKeyForProposal}"] has not committed expected value yet.`
      };
    }
    if (
      item.shouldSyncApprovalKeyInPlan &&
      activeRepairPlan[item.approvalStorageKey] !== item.normalizedValue
    ) {
      return {
        committed: false,
        reason: `repairPlan["${item.approvalStorageKey}"] has not synchronized expected value yet.`
      };
    }
    if (activeManualMap[item.targetKeyForProposal] !== true) {
      return {
        committed: false,
        reason: `manualEdits["${item.targetKeyForProposal}"] is not marked true yet.`
      };
    }
    if (
      item.approvalStorageKey &&
      item.approvalStorageKey !== item.targetKeyForProposal &&
      activeManualMap[item.approvalStorageKey] !== true
    ) {
      return {
        committed: false,
        reason: `manualEdits["${item.approvalStorageKey}"] is not marked true yet.`
      };
    }
    if (activeMetadata[item.targetKeyForProposal]?.stage !== "Tab3JsonCorrectionImport") {
      return {
        committed: false,
        reason: `metadata["${item.targetKeyForProposal}"] stage has not committed yet.`
      };
    }
    for (let j = 0; j < item.keysToInvalidate.length; j += 1) {
      const invKey = item.keysToInvalidate[j];
      if (activeApprovalsMap[invKey] !== undefined || activeKeepMap[invKey] !== undefined) {
        return {
          committed: false,
          reason: `Invalidated approval or Keep Original key "${invKey}" is still present.`
        };
      }
    }
  }

  return { committed: true, reason: null };
}

/**
 * Pure whole-packet parser, validator, and draft patch planner.
 * Never mutates input objects, never calls React state setters, and never claims a planned patch is applied.
 */
export function validateAndPlanTab3CorrectionImport({
  rawJsonText,
  fileByteSize = null,
  fileName = "",
  liveContext
}) {
  const safeFileName = typeof fileName === "string" && fileName.trim() ? fileName.trim() : "corrections.json";

  const buildRejection = (code, message, rejectedItems = [], extra = {}) => ({
    ok: false,
    status: "rejected",
    code,
    message,
    fileName: safeFileName,
    packetId: extra.packetId || null,
    productId: extra.productId || null,
    benchSessionId: extra.benchSessionId || null,
    benchRevision: extra.benchRevision ?? null,
    validatedCount: 0,
    rejectedCount: Array.isArray(rejectedItems) ? rejectedItems.length : 0,
    validatedItems: [],
    rejectedItems: Array.isArray(rejectedItems) ? rejectedItems : [],
    patchPlan: null
  });

  // 1. Validate caller liveContext contract
  if (!liveContext || typeof liveContext !== "object") {
    return buildRejection(
      "missing_caller_live_context",
      "Internal error: Caller did not provide the required Tab 3 liveContext snapshot."
    );
  }

  // 2. Validate file size & raw JSON string bounds
  if (
    typeof fileByteSize === "number" &&
    Number.isFinite(fileByteSize) &&
    fileByteSize > MAX_CORRECTION_FILE_BYTES
  ) {
    return buildRejection(
      "file_too_large",
      `Correction file "${safeFileName}" (${fileByteSize} bytes) exceeds the ${MAX_CORRECTION_FILE_BYTES}-byte (256 KB) limit.`
    );
  }

  if (typeof rawJsonText !== "string" || rawJsonText.trim().length === 0) {
    return buildRejection(
      "empty_file",
      `Correction file "${safeFileName}" is empty.`
    );
  }

  const utf8Bytes = getUtf8ByteLength(rawJsonText);
  if (utf8Bytes > MAX_CORRECTION_FILE_BYTES) {
    return buildRejection(
      "file_too_large",
      `Correction file "${safeFileName}" (${utf8Bytes} UTF-8 bytes) exceeds the ${MAX_CORRECTION_FILE_BYTES}-byte (256 KB) limit.`
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(rawJsonText);
  } catch (err) {
    return buildRejection(
      "invalid_json",
      `Correction file "${safeFileName}" is not valid JSON: ${err?.message || "parse failure"}.`
    );
  }

  if (!isPlainRecord(parsed)) {
    return buildRejection(
      "invalid_packet_root",
      "Correction file root must be a plain JSON object."
    );
  }

  // 3. Reject unknown top-level keys (explicitly blocks any caller `shop` override or unknown properties)
  const rootKeys = Object.keys(parsed);
  for (let i = 0; i < rootKeys.length; i += 1) {
    const rk = rootKeys[i];
    if (!ALLOWED_TOP_LEVEL_PACKET_KEYS.has(rk)) {
      return buildRejection(
        rk === "shop" ? "shop_override_forbidden" : "unsupported_top_level_key",
        rk === "shop"
          ? 'Top-level "shop" property is forbidden in correction packets; shop isolation is enforced from the authenticated bench session.'
          : `Unsupported top-level property "${rk}" in correction packet.`
      );
    }
  }

  if (parsed.schemaVersion !== CORRECTION_PACKET_SCHEMA_VERSION) {
    return buildRejection(
      "unsupported_schema_version",
      `schemaVersion must be ${CORRECTION_PACKET_SCHEMA_VERSION} (received ${String(parsed.schemaVersion)}).`
    );
  }

  if (parsed.packetKind !== CORRECTION_PACKET_KIND) {
    return buildRejection(
      "invalid_packet_kind",
      `packetKind must be "${CORRECTION_PACKET_KIND}" (received ${String(parsed.packetKind)}).`
    );
  }

  const packetId = typeof parsed.packetId === "string" ? parsed.packetId.trim() : "";
  if (!packetId || packetId.length > MAX_PACKET_ID_LENGTH) {
    return buildRejection(
      "invalid_packet_id",
      `packetId must be a non-empty string up to ${MAX_PACKET_ID_LENGTH} characters.`
    );
  }

  const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt.trim() : "";
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    return buildRejection(
      "invalid_created_at",
      "createdAt must be a valid ISO-8601 timestamp string.",
      [],
      { packetId }
    );
  }

  const packetProductId = typeof parsed.productId === "string" ? parsed.productId.trim() : "";
  if (!isExactProductGid(packetProductId)) {
    return buildRejection(
      "invalid_product_id",
      "productId must match gid://shopify/Product/<digits>.",
      [],
      { packetId }
    );
  }

  const packetSessionId =
    typeof parsed.benchSessionId === "string" ? parsed.benchSessionId.trim() : "";
  if (!packetSessionId || !packetSessionId.startsWith("bsess_")) {
    return buildRejection(
      "invalid_bench_session_id",
      'benchSessionId must be a non-empty Tab 3 session string starting with "bsess_".',
      [],
      { packetId, productId: packetProductId }
    );
  }

  const packetRevision = parsed.benchRevision;
  if (
    typeof packetRevision !== "number" ||
    !Number.isSafeInteger(packetRevision) ||
    packetRevision < 1
  ) {
    return buildRejection(
      "invalid_bench_revision",
      "benchRevision must be a positive safe integer.",
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId }
    );
  }

  let sourceReportId = null;
  if (parsed.sourceReportId !== undefined && parsed.sourceReportId !== null) {
    if (typeof parsed.sourceReportId !== "string") {
      return buildRejection(
        "invalid_source_report_id",
        "sourceReportId must be a string when provided.",
        [],
        { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
      );
    }
    const trimmedRepId = parsed.sourceReportId.trim();
    if (!trimmedRepId || trimmedRepId.length > MAX_SOURCE_REPORT_ID_LENGTH) {
      return buildRejection(
        "invalid_source_report_id",
        `sourceReportId must be 1..${MAX_SOURCE_REPORT_ID_LENGTH} characters when provided.`,
        [],
        { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
      );
    }
    sourceReportId = trimmedRepId;
  }

  if (!Array.isArray(parsed.corrections) || parsed.corrections.length === 0) {
    return buildRejection(
      "empty_corrections_array",
      "corrections must be a non-empty array of field correction objects.",
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  if (parsed.corrections.length > MAX_CORRECTIONS_PER_PACKET) {
    return buildRejection(
      "too_many_corrections",
      `corrections array (${parsed.corrections.length} items) exceeds the maximum of ${MAX_CORRECTIONS_PER_PACKET} items per packet.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  // 4. Busy state & active bench product/session identity checks
  if (
    liveContext.isLoadingData ||
    liveContext.isExecuting ||
    liveContext.pendingOperation !== null ||
    liveContext.batchFetcherState !== "idle" ||
    liveContext.referenceMatchFetcherState !== "idle" ||
    liveContext.pendingReferenceMatch !== null
  ) {
    return buildRejection(
      "bench_busy",
      "Cannot import corrections while Tab 3 is loading data, matching references, or executing an operation. Wait for idle state.",
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  const activeBenchId =
    typeof liveContext.selectedBenchId === "string" && liveContext.selectedBenchId.trim()
      ? liveContext.selectedBenchId.trim()
      : null;

  if (!activeBenchId || !isExactProductGid(activeBenchId)) {
    return buildRejection(
      "no_selected_product_on_bench",
      "No product is currently selected on the Tab 3 bench. Select and load the target product first.",
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  if (packetProductId !== activeBenchId) {
    return buildRejection(
      "product_id_mismatch",
      `Correction packet is for product ${packetProductId}, but the active Tab 3 bench product is ${activeBenchId}.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  const activeSessionId =
    typeof liveContext.benchSessionId === "string" ? liveContext.benchSessionId.trim() : "";
  if (!activeSessionId || packetSessionId !== activeSessionId) {
    return buildRejection(
      "bench_session_mismatch",
      `Correction packet benchSessionId (${packetSessionId}) does not match the active Tab 3 session (${activeSessionId || "none"}).`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  const liveManifest = liveContext.manifestData?.[activeBenchId];
  if (!liveManifest || typeof liveManifest !== "object") {
    return buildRejection(
      "product_manifest_not_loaded",
      `Manifest baseline for ${activeBenchId} is not loaded in browser state.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  const manifestPid =
    (typeof liveManifest.nativeTargets?.productId === "string" &&
      liveManifest.nativeTargets.productId.trim()) ||
    (typeof liveManifest.productId === "string" && liveManifest.productId.trim()) ||
    null;
  if (manifestPid !== activeBenchId) {
    return buildRejection(
      "manifest_product_identity_mismatch",
      `Loaded manifest productId (${manifestPid || "none"}) does not match ${activeBenchId}.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  // 5. Repeat-Import / Replay Check (Evaluated BEFORE revision & manual-edit locks so a packet's own applied state is recognized)
  const contentDigest = computeCorrectionsContentDigest(parsed.corrections);
  const replayKey = buildImportReplayKey(activeSessionId, activeBenchId, packetId);
  const importedPacketsMap =
    liveContext.importedPacketsMap instanceof Map ? liveContext.importedPacketsMap : null;

  if (importedPacketsMap && importedPacketsMap.has(replayKey)) {
    const priorRecord = importedPacketsMap.get(replayKey);
    if (!priorRecord || priorRecord.contentDigest !== contentDigest) {
      return buildRejection(
        "packet_id_reused_with_different_content",
        `Packet ID "${packetId}" was already imported in this session with different correction content. Use a new packetId for revised corrections.`,
        [],
        { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
      );
    }

    const currentPlanMap = liveManifest.repairPlan || {};
    const currentManualMap = liveContext.manualEdits?.[activeBenchId] || {};
    const appliedTargets = priorRecord.appliedTargets || {};
    const targetEntries = Object.entries(appliedTargets);

    const allStillIntact =
      targetEntries.length > 0 &&
      targetEntries.every(
        ([tKey, expectedVal]) =>
          currentPlanMap[tKey] === expectedVal && currentManualMap[tKey] === true
      );

    if (allStillIntact) {
      return {
        ok: true,
        status: "already_imported",
        code: "packet_already_imported",
        message: `Correction packet "${packetId}" (${targetEntries.length} field(s)) is already staged on ${activeBenchId}. No duplicate changes were applied.`,
        fileName: safeFileName,
        packetId,
        productId: activeBenchId,
        benchSessionId: activeSessionId,
        benchRevision: liveContext.lastLiveStateRevision,
        validatedCount: targetEntries.length,
        rejectedCount: 0,
        validatedItems: priorRecord.validatedItems || [],
        rejectedItems: [],
        patchPlan: null
      };
    }

    return buildRejection(
      "packet_already_imported_and_modified",
      `Packet "${packetId}" was already imported earlier in this session, and one or more of its target fields were subsequently modified or cleared. Generate a new packet with a new packetId from the latest bench state.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  // 6. Local Freshness & Acknowledged Sync Check (Recomputes live digest synchronously to catch changes inside the 380ms debounce window)
  const syncStatus = liveContext.liveBenchSyncStatus || {};
  const currentRevision = liveContext.lastLiveStateRevision;
  const lastStateDigest = liveContext.lastLiveStateDigest || "";
  const lastSyncedDigest = liveContext.lastLiveSyncedDigest || "";

  const currentComputedDigest = computeCurrentSelectedBenchLiveDigest({
    selectedBenchId: activeBenchId,
    manifestData: liveContext.manifestData,
    productStates: liveContext.productStates,
    approvals: liveContext.approvals,
    keepOriginalDecisions: liveContext.keepOriginalDecisions,
    manualEdits: liveContext.manualEdits,
    repairHistory: liveContext.repairHistory,
    submittedPayloads: liveContext.submittedPayloads,
    standardizedCandidatesByProduct: liveContext.standardizedCandidatesByProduct,
    referenceMatchResultsByProduct: liveContext.referenceMatchResultsByProduct,
    referenceMatchStatusByProduct: liveContext.referenceMatchStatusByProduct,
    sectionAuditMeasurements: liveContext.sectionAuditMeasurements
  });

  const isLocalStateSyncedAndAcknowledged = Boolean(
    currentComputedDigest &&
      lastStateDigest !== "" &&
      currentComputedDigest === lastStateDigest &&
      lastSyncedDigest === lastStateDigest &&
      syncStatus.lifecycle === "acknowledged" &&
      syncStatus.selectionState === "selected" &&
      syncStatus.productId === activeBenchId &&
      syncStatus.benchSessionId === activeSessionId &&
      syncStatus.benchRevision === currentRevision
  );

  if (!isLocalStateSyncedAndAcknowledged) {
    return buildRejection(
      "unsynced_local_changes_pending",
      "Tab 3 has unpublished local changes or an unacknowledged Sidekick Live Sync. Wait until 'Sidekick Live Sync: Yes (acknowledged)' is displayed before importing.",
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  if (typeof currentRevision !== "number" || packetRevision > currentRevision) {
    return buildRejection(
      "future_or_invalid_bench_revision",
      `Packet benchRevision (${packetRevision}) is ahead of the current Tab 3 revision (${String(currentRevision)}).`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  if (
    sourceReportId !== null &&
    packetRevision === currentRevision &&
    syncStatus.reportId &&
    sourceReportId !== syncStatus.reportId
  ) {
    return buildRejection(
      "source_report_id_mismatch",
      `Packet sourceReportId (${sourceReportId}) does not match the active acknowledged reportId (${syncStatus.reportId}) at revision ${currentRevision}.`,
      [],
      { packetId, productId: packetProductId, benchSessionId: packetSessionId, benchRevision: packetRevision }
    );
  }

  // 7. Whole-Packet Item Prevalidation
  const allConfigFields = [
    ...TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap((g) => g.fields || []),
    ...(COMPATIBILITY_ADAPTER_FIELDS || [])
  ];
  const prodManualEdits = validObj(liveContext.manualEdits?.[activeBenchId]);
  const prodApprovals = validObj(liveContext.approvals?.[activeBenchId]);
  const prodKeepOriginal = validObj(liveContext.keepOriginalDecisions?.[activeBenchId]);
  const hasIndependentDescriptions = Boolean(liveContext.hasIndependentDescriptionProposalsOnBench);

  const seenFieldKeys = new Set();
  const seenTargetKeys = new Set();
  const seenInvalidationKeys = new Set();
  const validatedItems = [];
  const rejectedItems = [];

  for (let i = 0; i < parsed.corrections.length; i += 1) {
    const rawItem = parsed.corrections[i];
    if (!isPlainRecord(rawItem)) {
      rejectedItems.push({
        index: i,
        fieldKey: null,
        code: "invalid_correction_item",
        reason: `Correction item at index ${i} must be a plain JSON object.`
      });
      continue;
    }

    const itemKeys = Object.keys(rawItem);
    let unknownItemKey = null;
    for (let kIdx = 0; kIdx < itemKeys.length; kIdx += 1) {
      if (!ALLOWED_CORRECTION_ITEM_KEYS.has(itemKeys[kIdx])) {
        unknownItemKey = itemKeys[kIdx];
        break;
      }
    }
    if (unknownItemKey) {
      rejectedItems.push({
        index: i,
        fieldKey: typeof rawItem.fieldKey === "string" ? rawItem.fieldKey : null,
        code: "unsupported_correction_item_key",
        reason: `Unsupported property "${unknownItemKey}" on correction item ${i}.`
      });
      continue;
    }

    const rawFieldKey = typeof rawItem.fieldKey === "string" ? rawItem.fieldKey.trim() : "";
    if (!rawFieldKey || rawFieldKey.length > MAX_FIELD_KEY_LENGTH) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey || null,
        code: "invalid_field_key",
        reason: `fieldKey at index ${i} must be a non-empty string up to ${MAX_FIELD_KEY_LENGTH} characters.`
      });
      continue;
    }

    const reason = typeof rawItem.reason === "string" ? rawItem.reason.trim() : "";
    if (!reason || reason.length > MAX_REASON_LENGTH) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        code: "invalid_reason",
        reason: `reason for "${rawFieldKey}" is required and must be 1..${MAX_REASON_LENGTH} characters.`
      });
      continue;
    }

    if (
      isParkedExcludedKey(rawFieldKey) ||
      DISALLOWED_CORRECTION_FIELD_KEYS.has(rawFieldKey)
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        code: "field_disallowed",
        reason: `Field "${rawFieldKey}" is parked, excluded, price/shipping, or held read-only.`
      });
      continue;
    }

    const targetKeyForProposal =
      rawFieldKey === "alt_text" || rawFieldKey === "custom.alt_text"
        ? "custom.alt_text"
        : NATIVE_ALIAS_MAP[rawFieldKey] || rawFieldKey;
    const approvalStorageKey = resolveApprovalStorageKey(rawFieldKey);

    if (
      !targetKeyForProposal ||
      !approvalStorageKey ||
      isParkedExcludedKey(targetKeyForProposal) ||
      isParkedExcludedKey(approvalStorageKey) ||
      DISALLOWED_CORRECTION_FIELD_KEYS.has(targetKeyForProposal) ||
      DISALLOWED_CORRECTION_FIELD_KEYS.has(approvalStorageKey)
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "destination_disallowed",
        reason: `Resolved destination "${targetKeyForProposal}" (${approvalStorageKey}) is parked, excluded, price/shipping, or held read-only.`
      });
      continue;
    }

    // Reject duplicate or overlapping shared destinations within the same packet
    const keysToInvalidate = buildSharedInvalidationKeySet(rawFieldKey);
    const hasOverlapInPacket =
      seenFieldKeys.has(rawFieldKey) ||
      seenTargetKeys.has(targetKeyForProposal) ||
      keysToInvalidate.some((k) => seenInvalidationKeys.has(k));

    if (hasOverlapInPacket) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "shared_destination_collision_in_packet",
        reason: `Field "${rawFieldKey}" collides with another item in the same packet targeting "${targetKeyForProposal}" or its shared destination group.`
      });
      continue;
    }
    seenFieldKeys.add(rawFieldKey);
    seenTargetKeys.add(targetKeyForProposal);
    keysToInvalidate.forEach((k) => seenInvalidationKeys.add(k));

    // Never collapse independent description proposals staged on the bench
    const isDescriptionField =
      rawFieldKey === "native_description" ||
      rawFieldKey === "custom.generated_description" ||
      targetKeyForProposal === "custom.generated_description";

    if (isDescriptionField && hasIndependentDescriptions) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "independent_description_proposals_active",
        reason:
          "native_description and custom.generated_description currently hold independent staged HTML proposals on this product. Resolve or clear them on the bench before importing a shared description edit."
      });
      continue;
    }

    const matchedConfig = allConfigFields.find(
      (f) =>
        resolveConfigFieldDestination(f) === approvalStorageKey ||
        resolveConfigFieldDestination(f) === rawFieldKey ||
        resolveConfigFieldDestination(f) === targetKeyForProposal ||
        f?.registryIdentity === approvalStorageKey ||
        f?.registryIdentity === rawFieldKey
    );

    if (
      matchedConfig?.registryRole === "EXCLUDED_INPUT" ||
      matchedConfig?.isParkedExcluded === true
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "excluded_input_field",
        reason: `Field "${rawFieldKey}" is an EXCLUDED_INPUT registry entry.`
      });
      continue;
    }

    const isNativeImageAlt = rawFieldKey.startsWith("native_image_alts_");
    if (isNativeImageAlt) {
      const imageId = rawFieldKey.replace("native_image_alts_", "");
      const mediaEdges = Array.isArray(liveManifest.nativeTargets?.media?.edges)
        ? liveManifest.nativeTargets.media.edges
        : [];
      const matchedEdge = mediaEdges.find((e) => e?.node?.id === imageId);
      if (
        !matchedEdge ||
        liveManifest.nativeTargets?.isComplete === false ||
        Boolean(liveManifest.nativeTargets?.loadError)
      ) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "invalid_or_unverified_media_target",
          reason: `MediaImage target "${imageId}" is not present or verified on ${activeBenchId}.`
        });
        continue;
      }
    } else if (!matchedConfig && rawFieldKey !== "native_seo_description") {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "unknown_or_unsupported_field",
        reason: `Field "${rawFieldKey}" is not a recognized Tab 3 working capability.`
      });
      continue;
    }

    // Evaluate live field metadata and raw baseline
    const fieldMeta = evaluateFieldMetadata({
      key: rawFieldKey,
      data: liveManifest,
      productId: activeBenchId,
      currentApprovals: liveContext.approvals,
      currentKeepOriginal: liveContext.keepOriginalDecisions,
      currentManualEdits: liveContext.manualEdits,
      configFields: allConfigFields,
      standardizedCandidatesByProduct: liveContext.standardizedCandidatesByProduct,
      getStandardizedEvaluationForField: liveContext.getStandardizedEvaluationForField,
      includeTab3InspectableInventory: true
    });

    const rawBaseline = inspectRawStoredFieldBaseline(rawFieldKey, liveManifest, fieldMeta);

    if (
      !fieldMeta.isSupported ||
      fieldMeta.isParkedExcluded ||
      fieldMeta.isImageAltCapabilityPlaceholder ||
      fieldMeta.isManualOnly ||
      fieldMeta.hasContractOrOwnerHold ||
      fieldMeta.isPendingReadOnly ||
      fieldMeta.hasExplicitStorageHold ||
      fieldMeta.hasExplicitProducerHold ||
      fieldMeta.isChannelFlagReadOnly ||
      fieldMeta.isVariantMetafieldHold ||
      !fieldMeta.hasLoadedBaseline ||
      !rawBaseline.rawEvidenceAvailable
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "field_held_or_baseline_unverified",
        reason:
          (Array.isArray(fieldMeta.reasons) && fieldMeta.reasons[0]) ||
          rawBaseline.rawNote ||
          `Field "${rawFieldKey}" is held read-only or lacks a verified baseline.`
      });
      continue;
    }

    if (!SUPPORTED_PROPOSED_VALUE_FIELD_TYPES.has(fieldMeta.type)) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "unsupported_field_type",
        reason: `Field type "${fieldMeta.type}" on "${rawFieldKey}" is not supported for JSON correction import.`
      });
      continue;
    }

    // Validate explicit preconditions object
    const pre = rawItem.preconditions;
    if (!isPlainRecord(pre)) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "missing_preconditions",
        reason: `Correction item for "${rawFieldKey}" is missing a plain preconditions object.`
      });
      continue;
    }

    const preKeys = Object.keys(pre);
    let unknownPreKey = null;
    for (let pIdx = 0; pIdx < preKeys.length; pIdx += 1) {
      if (!ALLOWED_PRECONDITION_KEYS.has(preKeys[pIdx])) {
        unknownPreKey = preKeys[pIdx];
        break;
      }
    }
    if (unknownPreKey) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "unsupported_precondition_key",
        reason: `Unsupported precondition property "${unknownPreKey}" on "${rawFieldKey}".`
      });
      continue;
    }

    for (const reqPreKey of ALLOWED_PRECONDITION_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(pre, reqPreKey)) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "incomplete_preconditions",
          reason: `Preconditions for "${rawFieldKey}" is missing required key "${reqPreKey}".`
        });
        unknownPreKey = reqPreKey;
        break;
      }
    }
    if (unknownPreKey) {
      continue;
    }

    if (
      typeof pre.rawBaselineExists !== "boolean" ||
      typeof pre.evaluatedBaselineExists !== "boolean" ||
      typeof pre.evaluatedBaselineValue !== "string" ||
      typeof pre.isProposed !== "boolean" ||
      typeof pre.proposalExists !== "boolean" ||
      !ALLOWED_PROPOSAL_STATUS_VALUES.has(pre.proposalStatus)
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "invalid_precondition_types",
        reason: `Preconditions for "${rawFieldKey}" contain invalid boolean/string/status types.`
      });
      continue;
    }

    // Enforce strict missing/null/empty distinctions in preconditions
    if (pre.isProposed === false) {
      if (pre.proposalExists !== false || pre.proposalStatus !== "Not provided" || pre.currentProposedValue !== null) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "inconsistent_absent_proposal_precondition",
          reason: `When preconditions.isProposed is false on "${rawFieldKey}", proposalExists must be false, proposalStatus must be "Not provided", and currentProposedValue must be null.`
        });
        continue;
      }
    } else {
      if (typeof pre.currentProposedValue !== "string") {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "inconsistent_present_proposal_precondition",
          reason: `When preconditions.isProposed is true on "${rawFieldKey}", currentProposedValue must be a string ("" when Empty, or non-empty when Provided).`
        });
        continue;
      }
      if (pre.proposalStatus === "Empty" && pre.proposalExists !== false) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "inconsistent_empty_proposal_precondition",
          reason: `When preconditions.proposalStatus is "Empty" on "${rawFieldKey}", proposalExists must be false.`
        });
        continue;
      }
    }

    // Compare packet preconditions against live field baseline & working state
    const liveRawExists = Boolean(rawBaseline.rawStoredExists);
    const liveRawValue = rawBaseline.rawStoredValue;
    const liveEvalExists = Boolean(fieldMeta.currentExists);
    const liveEvalValue = String(fieldMeta.currentVal ?? "");
    const liveIsProposed = Boolean(fieldMeta.isProposed);
    const liveProposalExists = Boolean(fieldMeta.proposalExists);
    const liveProposalStatus = fieldMeta.proposalStatus || "Not provided";
    const liveCurrentProposedValue = liveIsProposed ? String(fieldMeta.propVal ?? "") : null;

    if (
      pre.rawBaselineExists !== liveRawExists ||
      !areJsonValuesStrictlyEqual(pre.rawBaselineValue, liveRawValue)
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "stale_raw_baseline_precondition",
        reason: `Raw stored baseline for "${rawFieldKey}" (exists=${String(liveRawExists)}) does not match packet precondition (exists=${String(pre.rawBaselineExists)}).`
      });
      continue;
    }

    if (
      pre.evaluatedBaselineExists !== liveEvalExists ||
      pre.evaluatedBaselineValue !== liveEvalValue
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "stale_evaluated_baseline_precondition",
        reason: `Evaluated baseline for "${rawFieldKey}" ("${liveEvalValue}", exists=${String(liveEvalExists)}) does not match packet precondition ("${pre.evaluatedBaselineValue}", exists=${String(pre.evaluatedBaselineExists)}).`
      });
      continue;
    }

    if (
      pre.isProposed !== liveIsProposed ||
      pre.proposalExists !== liveProposalExists ||
      pre.proposalStatus !== liveProposalStatus ||
      pre.currentProposedValue !== liveCurrentProposedValue
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "stale_working_proposal_precondition",
        reason: `Current working proposal state for "${rawFieldKey}" (status="${liveProposalStatus}", value=${JSON.stringify(liveCurrentProposedValue)}) does not match packet precondition (status="${pre.proposalStatus}", value=${JSON.stringify(pre.currentProposedValue)}).`
      });
      continue;
    }

    // Protect operator manual edits, explicit approvals, and Keep Original decisions across all related/shared keys
    const hasProtectedManualEdit =
      Boolean(fieldMeta.isManuallyEdited) ||
      keysToInvalidate.some((k) => prodManualEdits[k] === true) ||
      (targetKeyForProposal === "custom.alt_text" && prodManualEdits.alt_text === true);

    const hasProtectedApproval =
      Boolean(fieldMeta.isApproved) ||
      keysToInvalidate.some((k) => prodApprovals[k] !== undefined);

    const hasProtectedKeepOriginal =
      Boolean(fieldMeta.isKeepOriginalSelected) ||
      keysToInvalidate.some((k) => prodKeepOriginal[k] !== undefined);

    if (hasProtectedManualEdit || hasProtectedApproval || hasProtectedKeepOriginal) {
      const lockKind = hasProtectedManualEdit
        ? "manual edit"
        : hasProtectedApproval
          ? "explicit approval"
          : "Keep Original decision";
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "operator_state_protected",
        reason: `Field "${rawFieldKey}" is protected by an existing operator ${lockKind} on the bench.`
      });
      continue;
    }

    // Validate proposedValue encoding & domain rules
    const rawPropVal = rawItem.proposedValue;
    if (typeof rawPropVal !== "string") {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "invalid_proposed_value_type",
        reason: `proposedValue for "${rawFieldKey}" must be a string.`
      });
      continue;
    }

    if (rawPropVal.length > MAX_PROPOSED_VALUE_LENGTH) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "proposed_value_too_large",
        reason: `proposedValue for "${rawFieldKey}" exceeds ${MAX_PROPOSED_VALUE_LENGTH} characters.`
      });
      continue;
    }

    const trimmedPropVal = rawPropVal.trim();
    if (trimmedPropVal === "" || trimmedPropVal === "[]") {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "empty_proposed_value",
        reason: `proposedValue for "${rawFieldKey}" cannot be empty.`
      });
      continue;
    }

    let normalizedValue = rawPropVal;

    if (isVerifiedStandardizedDestination(targetKeyForProposal)) {
      const stdEval = fieldMeta.stdEvaluation;
      if (!stdEval?.isTechnicallyEligible || !fieldMeta.isCategoryEligible) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "standardized_destination_ineligible",
          reason:
            stdEval?.blockReason ||
            `Standardized destination "${targetKeyForProposal}" is not technically or category eligible.`
        });
        continue;
      }
      const valCheck = validateProposedStandardizedGidList(trimmedPropVal, stdEval);
      if (!valCheck.valid) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "invalid_standardized_gid_list",
          reason:
            valCheck.reason ||
            `Invalid Metaobject GID list for "${targetKeyForProposal}".`
        });
        continue;
      }
      normalizedValue = JSON.stringify(valCheck.gids);
    } else if (
      matchedConfig?.namespace === "shopify" ||
      targetKeyForProposal.startsWith("shopify.")
    ) {
      rejectedItems.push({
        index: i,
        fieldKey: rawFieldKey,
        targetKey: targetKeyForProposal,
        approvalKey: approvalStorageKey,
        code: "unverified_standardized_attribute",
        reason: `Standardized attribute "${targetKeyForProposal}" is pending_read_only.`
      });
      continue;
    } else {
      if (fieldMeta.type === "number_decimal") {
        if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmedPropVal)) {
          rejectedItems.push({
            index: i,
            fieldKey: rawFieldKey,
            targetKey: targetKeyForProposal,
            approvalKey: approvalStorageKey,
            code: "invalid_decimal_number",
            reason: `Field "${rawFieldKey}" requires a positive decimal number string.`
          });
          continue;
        }
        const parsedNum = Number(trimmedPropVal);
        if (!Number.isFinite(parsedNum) || parsedNum <= 0) {
          rejectedItems.push({
            index: i,
            fieldKey: rawFieldKey,
            targetKey: targetKeyForProposal,
            approvalKey: approvalStorageKey,
            code: "invalid_decimal_number",
            reason: `Field "${rawFieldKey}" requires a finite positive number.`
          });
          continue;
        }
        normalizedValue = trimmedPropVal;
      }

      if (
        targetKeyForProposal === "custom.is_one_of_a_kind" &&
        trimmedPropVal !== "Yes" &&
        trimmedPropVal !== "No"
      ) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "invalid_ooak_value",
          reason: 'custom.is_one_of_a_kind requires exact string "Yes" or "No".'
        });
        continue;
      }

      const isHardwareField =
        HARDWARE_FIELDS.includes(targetKeyForProposal) ||
        HARDWARE_FIELDS.includes(rawFieldKey);
      if (isHardwareField && GENERIC_VALUES.includes(trimmedPropVal)) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "generic_hardware_value_rejected",
          reason: `Generic placeholder "${trimmedPropVal}" is not allowed for hardware field "${rawFieldKey}".`
        });
        continue;
      }

      if (
        (targetKeyForProposal === "custom.collection_date" ||
          rawFieldKey === "custom.collection_date") &&
        GENERIC_VALUES.includes(trimmedPropVal)
      ) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "generic_collection_date_rejected",
          reason: `Generic placeholder "${trimmedPropVal}" is not a valid collection_date.`
        });
        continue;
      }

      if (
        targetKeyForProposal === "custom.material" &&
        trimmedPropVal.toLowerCase() === "stone"
      ) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "generic_bare_stone_rejected",
          reason: 'Bare generic value "Stone" is not allowed for custom.material.'
        });
        continue;
      }

      const maxLen =
        FIELD_LIMITS[rawFieldKey] || FIELD_LIMITS[targetKeyForProposal] || null;
      if (maxLen !== null && !isNativeImageAlt && normalizedValue.length > maxLen) {
        rejectedItems.push({
          index: i,
          fieldKey: rawFieldKey,
          targetKey: targetKeyForProposal,
          approvalKey: approvalStorageKey,
          code: "exceeds_character_limit",
          reason: `Proposed value length (${normalizedValue.length}) exceeds maximum limit (${maxLen}) for "${rawFieldKey}".`
        });
        continue;
      }
    }

    const existingRepairPlan = liveManifest.repairPlan || {};
    const shouldSyncApprovalKeyInPlan = Boolean(
      approvalStorageKey &&
        approvalStorageKey !== targetKeyForProposal &&
        Object.prototype.hasOwnProperty.call(existingRepairPlan, approvalStorageKey)
    );

    validatedItems.push({
      index: i,
      fieldKey: rawFieldKey,
      fieldLabel: fieldMeta.label || rawFieldKey,
      targetKeyForProposal,
      approvalStorageKey,
      normalizedValue,
      previousProposedValue: liveCurrentProposedValue,
      evaluatedBaselineValue: liveEvalValue,
      reason,
      keysToInvalidate,
      shouldSyncApprovalKeyInPlan
    });
  }

  // Whole-packet atomic rejection if any item failed validation
  if (rejectedItems.length > 0) {
    return buildRejection(
      "packet_validation_failed",
      `Rejected correction packet "${packetId}": ${rejectedItems.length} of ${parsed.corrections.length} item(s) failed validation. No draft fields were modified.`,
      rejectedItems,
      { packetId, productId: activeBenchId, benchSessionId: activeSessionId, benchRevision: packetRevision }
    );
  }

  // Build deterministic patch descriptors for the caller to stage in React state
  const repairPlanPatch = {};
  const manualEditsPatch = {};
  const invalidatedApprovalAndKeepKeys = new Set();
  const appliedTargetsForReplay = {};

  validatedItems.forEach((item) => {
    repairPlanPatch[item.targetKeyForProposal] = item.normalizedValue;
    appliedTargetsForReplay[item.targetKeyForProposal] = item.normalizedValue;
    manualEditsPatch[item.targetKeyForProposal] = true;

    if (item.approvalStorageKey && item.approvalStorageKey !== item.targetKeyForProposal) {
      manualEditsPatch[item.approvalStorageKey] = true;
      if (item.shouldSyncApprovalKeyInPlan) {
        repairPlanPatch[item.approvalStorageKey] = item.normalizedValue;
        appliedTargetsForReplay[item.approvalStorageKey] = item.normalizedValue;
      }
    }

    item.keysToInvalidate.forEach((k) => invalidatedApprovalAndKeepKeys.add(k));
  });

  const patchPlan = {
    packetId,
    createdAt,
    fileName: safeFileName,
    productId: activeBenchId,
    benchSessionId: activeSessionId,
    packetBenchRevision: packetRevision,
    activeBenchRevision: currentRevision,
    sourceReportId,
    contentDigest,
    replayKey,
    validatedItems,
    repairPlanPatch,
    manualEditsPatch,
    invalidatedKeys: Array.from(invalidatedApprovalAndKeepKeys),
    appliedTargetsForReplay
  };

  return {
    ok: true,
    status: "planned",
    code: "correction_patch_planned",
    message: `Validated ${validatedItems.length} correction(s) from "${safeFileName}" (packet ${packetId}). Ready to stage for operator review.`,
    fileName: safeFileName,
    packetId,
    productId: activeBenchId,
    benchSessionId: activeSessionId,
    benchRevision: currentRevision,
    validatedCount: validatedItems.length,
    rejectedCount: 0,
    validatedItems,
    rejectedItems: [],
    patchPlan
  };
}

/**
 * Pure state-transition helper that computes the next manifest entry for `selectedBenchId`
 * from `patchPlan`, preserving all existing metadata keys and unrelated repairPlan entries.
 */
export function applyPlannedCorrectionPatchToManifest(existingManifest, patchPlan) {
  if (!existingManifest || typeof existingManifest !== "object" || !patchPlan) {
    return existingManifest;
  }

  const nextRepairPlan = { ...(existingManifest.repairPlan || {}) };
  const nextMetadata = { ...(existingManifest.metadata || {}) };

  (patchPlan.validatedItems || []).forEach((item) => {
    nextRepairPlan[item.targetKeyForProposal] = item.normalizedValue;
    if (
      item.approvalStorageKey &&
      item.approvalStorageKey !== item.targetKeyForProposal &&
      Object.prototype.hasOwnProperty.call(nextRepairPlan, item.approvalStorageKey)
    ) {
      nextRepairPlan[item.approvalStorageKey] = item.normalizedValue;
    }

    const prevTargetMeta = validObj(nextMetadata[item.targetKeyForProposal]);
    nextMetadata[item.targetKeyForProposal] = {
      ...prevTargetMeta,
      source: "Manual",
      stage: "Tab3JsonCorrectionImport",
      packetId: patchPlan.packetId,
      ...(item.targetKeyForProposal === "custom.generated_description" &&
      prevTargetMeta.destinationOnly === true
        ? { destinationOnly: false }
        : {})
    };

    if (
      item.approvalStorageKey &&
      item.approvalStorageKey !== item.targetKeyForProposal
    ) {
      const prevApprovalMeta = validObj(nextMetadata[item.approvalStorageKey]);
      nextMetadata[item.approvalStorageKey] = {
        ...prevApprovalMeta,
        source: "Manual",
        stage: "Tab3JsonCorrectionImport",
        packetId: patchPlan.packetId
      };
    }
  });

  return {
    ...existingManifest,
    repairPlan: nextRepairPlan,
    metadata: nextMetadata
  };
}
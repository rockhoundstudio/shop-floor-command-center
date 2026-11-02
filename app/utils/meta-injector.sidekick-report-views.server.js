// ==========================================================================
// ROCKHOUND STUDIO — SIDEKICK LIVE-BENCH ORGANIZED VIEW PROJECTIONS & CHUNKING
// File: app/utils/meta-injector.sidekick-report-views.server.js
// Pure, stateless organized view projection builders, UTF-8 code-point chunk
// splitting, and response finalization for Sidekick telemetry reports.
// Zero global cache state access, zero database/network imports.
// ==========================================================================

import { Buffer } from "node:buffer";

export const MAX_CHUNK_UTF8_BYTES = 2000;
export const MAX_ORGANIZED_VIEW_CHUNK_UTF8_BYTES = 1550;
export const MAX_RESPONSE_UTF8_BYTES = 3500;

export const LIVE_BENCH_MODE = "live_bench_state";
export const DESCRIPTION_REVIEW_DRAWER_TITLE = "Description Review";
export const DESCRIPTION_REVIEW_KEYS = Object.freeze([
  "native_description",
  "custom.generated_description",
]);

export const ALLOWED_READ_SECTIONS = Object.freeze(["report", "ui_audit"]);
export const ALLOWED_READ_VIEWS = Object.freeze([
  "chunk",
  "index",
  "header",
  "review",
  "drawer",
  "field",
]);

export const ALLOWED_READ_SECTIONS_SET = new Set(ALLOWED_READ_SECTIONS);
export const ALLOWED_READ_VIEWS_SET = new Set(ALLOWED_READ_VIEWS);

export function utf8ByteLength(str) {
  return Buffer.byteLength(String(str), "utf8");
}

export function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function deepFreeze(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      deepFreeze(value[i]);
    }
  } else {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      deepFreeze(value[keys[i]]);
    }
  }
  return value;
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function finalizeResponse(payload, fallbackErrorCode = "response_too_large") {
  const cloned = cloneJson(payload);
  const serialized = JSON.stringify(cloned);
  if (utf8ByteLength(serialized) <= MAX_RESPONSE_UTF8_BYTES) {
    return deepFreeze(cloned);
  }

  const conciseError = {
    ok: false,
    status: "error",
    code: fallbackErrorCode,
    message:
      "Response metadata exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
  };
  return deepFreeze(conciseError);
}

export function canonicalizeJsonValue(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeJsonValue);
  }
  const sortedKeys = Object.keys(value).sort();
  const result = {};
  for (let i = 0; i < sortedKeys.length; i += 1) {
    const key = sortedKeys[i];
    const fieldVal = value[key];
    if (fieldVal !== undefined) {
      result[key] = canonicalizeJsonValue(fieldVal);
    }
  }
  return result;
}

export function splitUtf8CodePoints(text, maxBytesPerChunk = MAX_CHUNK_UTF8_BYTES) {
  if (typeof text !== "string" || text.length === 0) {
    return Object.freeze([]);
  }

  const chunks = [];
  let chunkStartCodeUnit = 0;
  let currentBytes = 0;

  for (let i = 0; i < text.length; ) {
    const codePoint = text.codePointAt(i);
    const charCodeUnits = codePoint > 0xffff ? 2 : 1;
    const charUtf8Bytes =
      codePoint <= 0x7f
        ? 1
        : codePoint <= 0x7ff
          ? 2
          : codePoint <= 0xffff
            ? 3
            : 4;

    if (currentBytes + charUtf8Bytes > maxBytesPerChunk && i > chunkStartCodeUnit) {
      chunks.push(text.slice(chunkStartCodeUnit, i));
      chunkStartCodeUnit = i;
      currentBytes = 0;
    }

    currentBytes += charUtf8Bytes;
    i += charCodeUnits;
  }

  if (chunkStartCodeUnit < text.length) {
    chunks.push(text.slice(chunkStartCodeUnit));
  }

  return Object.freeze(chunks);
}

export function parseVerifiedLiveBenchSnapshot(record) {
  if (!record || !record.isLiveBenchState || record.mode !== LIVE_BENCH_MODE) {
    return {
      ok: false,
      status: "invalid_request",
      code: "organized_view_requires_live_bench_state",
      message:
        'Organized views (index, header, review, drawer, field) are only supported for mode="live_bench_state" snapshots. Use view="chunk" (default) for manual captures.',
    };
  }

  if (typeof record.fullText !== "string" || !record.fullText.trim().startsWith("{")) {
    return {
      ok: false,
      status: "invalid_request",
      code: "unsupported_live_bench_schema",
      message: "Snapshot fullText is not a JSON object.",
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(record.fullText);
  } catch {
    return {
      ok: false,
      status: "invalid_request",
      code: "unsupported_live_bench_schema",
      message: "Snapshot fullText could not be parsed as valid JSON.",
    };
  }

  if (
    !isPlainObject(parsed) ||
    parsed.schemaVersion !== 1 ||
    parsed.stateKind !== LIVE_BENCH_MODE ||
    !Array.isArray(parsed.sectionOrder) ||
    !isPlainObject(parsed.fieldsByKey)
  ) {
    return {
      ok: false,
      status: "invalid_request",
      code: "unsupported_live_bench_schema",
      message:
        'Snapshot does not match verified schemaVersion=1, stateKind="live_bench_state" with sectionOrder array and fieldsByKey object.',
    };
  }

  return {
    ok: true,
    snapshot: parsed,
  };
}

function normalizeComparableFieldValue(val) {
  if (val === null || val === undefined) {
    return "";
  }
  if (typeof val === "string") {
    return val.trim();
  }
  try {
    return JSON.stringify(val);
  } catch {
    return String(val);
  }
}

function hasNonEmptyConflictValue(val) {
  if (val === null || val === undefined || val === false) {
    return false;
  }
  if (typeof val === "string") {
    return val.trim().length > 0;
  }
  if (Array.isArray(val)) {
    return val.length > 0;
  }
  if (isPlainObject(val)) {
    return Object.keys(val).length > 0;
  }
  return true;
}

export function evaluateFieldAttentionFlags(key, fieldObj, saveEvidence) {
  const rawBase = isPlainObject(fieldObj?.rawStoredBaseline)
    ? fieldObj.rawStoredBaseline
    : {};
  const evalBase = isPlainObject(fieldObj?.evaluatedBaseline)
    ? fieldObj.evaluatedBaseline
    : {};
  const working = isPlainObject(fieldObj?.workingState)
    ? fieldObj.workingState
    : {};
  const statusHolds = isPlainObject(fieldObj?.statusAndHolds)
    ? fieldObj.statusAndHolds
    : {};
  const conflictsObj = isPlainObject(fieldObj?.conflictsAndSaveEvidence)
    ? fieldObj.conflictsAndSaveEvidence
    : {};

  const targetKey =
    typeof fieldObj?.targetKey === "string" && fieldObj.targetKey.trim()
      ? fieldObj.targetKey.trim()
      : key;
  const approvalKey =
    typeof fieldObj?.approvalKey === "string" && fieldObj.approvalKey.trim()
      ? fieldObj.approvalKey.trim()
      : key;

  const isParkedExcluded = Boolean(
    fieldObj?.isParkedExcluded ||
      statusHolds.isParkedExcluded ||
      fieldObj?.registryRole === "EXCLUDED_INPUT" ||
      statusHolds.registryRole === "EXCLUDED_INPUT"
  );

  const isDisplayPlaceholder = Boolean(
    evalBase.isDisplayOnlyPlaceholderOrNa || statusHolds.isImageAltCapabilityPlaceholder
  );

  let baselineComparable = "";
  if (!isDisplayPlaceholder) {
    if (evalBase.currentExists && evalBase.value !== null && evalBase.value !== undefined) {
      baselineComparable = normalizeComparableFieldValue(evalBase.value);
    } else if (rawBase.exists && rawBase.value !== null && rawBase.value !== undefined) {
      baselineComparable = normalizeComparableFieldValue(rawBase.value);
    }
  }

  const proposedComparable = normalizeComparableFieldValue(working.proposedValue);
  const hasNonEmptyProposal =
    !isParkedExcluded && proposedComparable !== "" && proposedComparable !== "[]";
  const hasActualValueDiff =
    !isParkedExcluded &&
    hasNonEmptyProposal &&
    proposedComparable !== baselineComparable;

  const fieldStatus =
    typeof statusHolds.fieldStatus === "string" ? statusHolds.fieldStatus.trim() : "";
  const proposalStatus =
    typeof working.proposalStatus === "string" ? working.proposalStatus.trim() : "";

  const isKeepOriginal = Boolean(
    !isParkedExcluded &&
      (working.isKeepOriginal === true ||
        fieldStatus === "Keep original (suggestion rejected)")
  );
  const keepOriginalDecision = isPlainObject(working.keepOriginalDecision)
    ? working.keepOriginalDecision
    : null;
  const canKeepOriginal = Boolean(!isParkedExcluded && working.canKeepOriginal);

  const isExplicitlyApproved = Boolean(
    !isParkedExcluded && !isKeepOriginal && working.isApproved
  );
  const isManualEdit = Boolean(!isParkedExcluded && working.isManualEdit);
  const isContentPreApproved = Boolean(
    !isParkedExcluded && !isKeepOriginal && working.isContentPreApproved
  );
  const isPreApprovedChanged = Boolean(isContentPreApproved && hasActualValueDiff);

  const isProposedStatus =
    !isParkedExcluded &&
    !isKeepOriginal &&
    (fieldStatus === "Proposed" ||
      fieldStatus === "Approved, not saved" ||
      fieldStatus === "Approved, blocked" ||
      fieldStatus === "Pre-approved, not saved" ||
      fieldStatus === "Pre-approved, blocked" ||
      fieldStatus === "Unverified proposal");

  // Active proposed change excludes rejected suggestions where Keep-Original is selected
  const isEffectiveProposedChange =
    !isParkedExcluded &&
    !isKeepOriginal &&
    (hasActualValueDiff ||
      isManualEdit ||
      isExplicitlyApproved ||
      isPreApprovedChanged ||
      isProposedStatus);

  const blockedSaveMap = isPlainObject(saveEvidence?.blockedFields)
    ? saveEvidence.blockedFields
    : {};
  const conflictsSaveMap = isPlainObject(saveEvidence?.conflicts)
    ? saveEvidence.conflicts
    : {};
  const unresolvedSaveMap = isPlainObject(saveEvidence?.unresolvedChanges)
    ? saveEvidence.unresolvedChanges
    : {};

  const matchesKeyInMap = (mapObj) =>
    Boolean(
      Object.prototype.hasOwnProperty.call(mapObj, key) ||
        Object.prototype.hasOwnProperty.call(mapObj, targetKey) ||
        Object.prototype.hasOwnProperty.call(mapObj, approvalKey)
    );

  const inSaveBlocked = matchesKeyInMap(blockedSaveMap);
  const inSaveConflicts = matchesKeyInMap(conflictsSaveMap);
  const inSaveUnresolved = matchesKeyInMap(unresolvedSaveMap);

  const hasFieldConflictData =
    hasNonEmptyConflictValue(conflictsObj.conflictData) ||
    hasNonEmptyConflictValue(conflictsObj.nativeDescConflictData);

  // Genuine save/read-back conflicts or API blocks remain visible even if a decision was recorded
  const hasGenuineSaveOrApiError = Boolean(
    hasFieldConflictData ||
      inSaveConflicts ||
      inSaveUnresolved ||
      inSaveBlocked ||
      fieldStatus === "Save Conflict" ||
      fieldStatus === "API Error / Blocked"
  );

  // Content-level Conflict/Degrade status is resolved when Keep-Original or Content Pre-Approval is active without a technical block
  const isUnresolvedContentConflictStatus =
    !isParkedExcluded &&
    !isKeepOriginal &&
    !isContentPreApproved &&
    !isExplicitlyApproved &&
    (fieldStatus === "Conflict" ||
      fieldStatus === "Degrade" ||
      proposalStatus === "conflict" ||
      proposalStatus === "degrade");

  const hasConflict = Boolean(
    hasFieldConflictData ||
      inSaveConflicts ||
      inSaveUnresolved ||
      fieldStatus === "Save Conflict" ||
      isUnresolvedContentConflictStatus
  );

  // Passive contract/owner holds on parked rows or untouched read-only rows are not actionable proposal blocks
  const hasTechnicalOrContractHoldFlag = Boolean(
    statusHolds.isActualBlockedProposal ||
      statusHolds.hasTechnicalBlock ||
      statusHolds.hasContractOrOwnerHold ||
      statusHolds.hasExplicitStorageHold ||
      statusHolds.hasExplicitProducerHold ||
      statusHolds.isVariantMetafieldHold ||
      statusHolds.isPendingReadOnly ||
      statusHolds.isChannelFlagReadOnly ||
      inSaveBlocked ||
      fieldStatus === "API Error / Blocked" ||
      fieldStatus === "Approved, blocked" ||
      fieldStatus === "Pre-approved, blocked"
  );

  // A retained (keep-original) field's write-prohibition alone is not an unresolved block or review error
  const isBlockedWhenRelevant = Boolean(
    hasGenuineSaveOrApiError ||
      (!isParkedExcluded &&
        !isKeepOriginal &&
        (Boolean(statusHolds.isActualBlockedProposal) ||
          fieldStatus === "Approved, blocked" ||
          fieldStatus === "Pre-approved, blocked" ||
          fieldStatus === "Over limit" ||
          (Boolean(statusHolds.hasTechnicalBlock) &&
            (hasActualValueDiff ||
              isManualEdit ||
              isExplicitlyApproved ||
              Boolean(working.isProposed) ||
              Boolean(working.proposalExists)))))
  );

  const isRequiredMissing = !isParkedExcluded && fieldStatus === "Required missing";
  const isUnverifiedProposal =
    !isParkedExcluded && !isKeepOriginal && fieldStatus === "Unverified proposal";

  // Clean Keep-Original, clean Approved, clean Content-Pre-Approved, and clean Parked rows do NOT need review
  const needsReview = Boolean(
    hasGenuineSaveOrApiError ||
      (!isParkedExcluded &&
        !isKeepOriginal &&
        (isRequiredMissing ||
          isUnverifiedProposal ||
          hasConflict ||
          isBlockedWhenRelevant ||
          (!isExplicitlyApproved &&
            !isContentPreApproved &&
            Boolean(working.contentNeedsReview) &&
            (hasActualValueDiff || isManualEdit || isProposedStatus))))
  );

  // Actionable for the review view: includes active proposals, approved/pre-approved writes,
  // keep-original decisions (so rejected suggestions and retained baselines remain inspectable),
  // manual edits, genuine conflicts/blocks, and submitted items, while excluding clean untouched parked/blank rows.
  const isActionableForReview = Boolean(
    isEffectiveProposedChange ||
      isKeepOriginal ||
      isManualEdit ||
      isExplicitlyApproved ||
      hasConflict ||
      isBlockedWhenRelevant ||
      needsReview ||
      Boolean(conflictsObj.wasSubmittedInLastRepair)
  );

  return {
    isParkedExcluded,
    hasActualValueDiff,
    isEffectiveProposedChange,
    isExplicitlyApproved,
    isContentPreApproved,
    isKeepOriginal,
    keepOriginalDecision,
    canKeepOriginal,
    isManualEdit,
    hasConflict,
    hasHoldFlag: hasTechnicalOrContractHoldFlag,
    isBlockedWhenRelevant,
    needsReview,
    isActionableForReview,
    inSaveBlocked,
    inSaveConflicts,
    inSaveUnresolved,
  };
}

function isUnselectedPreviewSnapshot(snapshot, record = null) {
  return Boolean(
    (snapshot && snapshot.selectionState === "unselected_preview") ||
      (record && record.selectionState === "unselected_preview")
  );
}

function buildOrderedDrawersList(snapshot, record = null) {
  const fieldsByKey = isPlainObject(snapshot?.fieldsByKey) ? snapshot.fieldsByKey : {};
  const sectionOrder = Array.isArray(snapshot?.sectionOrder) ? snapshot.sectionOrder : [];
  const drawers = [];
  const seenDrawerTitles = new Set();
  const isPreview = isUnselectedPreviewSnapshot(snapshot, record);

  // In unselected blank-template preview mode, preserve the exact 11 Tab 3 inspectable drawers (93 logical slots)
  // without prepending a separate Description Review bay (native_description is already inside
  // Native and Staging Roles, and DescriptionReviewSection is not mounted when no product is loaded).
  if (!isPreview) {
    const descKeys = DESCRIPTION_REVIEW_KEYS.filter((k) =>
      Object.prototype.hasOwnProperty.call(fieldsByKey, k)
    );
    if (descKeys.length > 0) {
      drawers.push({
        drawer: DESCRIPTION_REVIEW_DRAWER_TITLE,
        fieldKeys: descKeys,
      });
      seenDrawerTitles.add(DESCRIPTION_REVIEW_DRAWER_TITLE);
    }
  }

  for (let i = 0; i < sectionOrder.length; i += 1) {
    const entry = sectionOrder[i];
    if (!isPlainObject(entry) || typeof entry.sectionTitle !== "string") {
      continue;
    }
    const title = entry.sectionTitle.trim();
    if (!title || seenDrawerTitles.has(title)) {
      continue;
    }
    const rawKeys = Array.isArray(entry.fieldKeys) ? entry.fieldKeys : [];
    const validKeys = [];
    const seenKeys = new Set();
    for (let j = 0; j < rawKeys.length; j += 1) {
      const k = rawKeys[j];
      if (
        typeof k === "string" &&
        k.trim().length > 0 &&
        !seenKeys.has(k) &&
        Object.prototype.hasOwnProperty.call(fieldsByKey, k)
      ) {
        seenKeys.add(k);
        validKeys.push(k);
      }
    }
    drawers.push({
      drawer: title,
      fieldKeys: validKeys,
    });
    seenDrawerTitles.add(title);
  }

  return drawers;
}

function extractCompactUiAuditSummary(record) {
  if (!record || record.uiAuditState !== "measured" || !record.uiAuditCanonicalJson) {
    return null;
  }
  try {
    const parsed = JSON.parse(record.uiAuditCanonicalJson);
    if (!isPlainObject(parsed)) {
      return null;
    }
    return {
      activeFilter: typeof parsed.activeFilter === "string" ? parsed.activeFilter : null,
      measurementCoverage: parsed.measurementCoverage ?? null,
      measuredSectionCount:
        typeof parsed.measuredSectionCount === "number" ? parsed.measuredSectionCount : null,
      totalKnownTemplateGroups:
        typeof parsed.totalKnownTemplateGroups === "number"
          ? parsed.totalKnownTemplateGroups
          : null,
      unmeasuredSectionCount:
        typeof parsed.unmeasuredSectionCount === "number" ? parsed.unmeasuredSectionCount : null,
      expandedSectionCount:
        typeof parsed.expandedSectionCount === "number" ? parsed.expandedSectionCount : null,
      collapsedSectionCount:
        typeof parsed.collapsedSectionCount === "number" ? parsed.collapsedSectionCount : null,
      totalFullInventoryRows:
        typeof parsed.totalFullInventoryRows === "number"
          ? parsed.totalFullInventoryRows
          : (typeof parsed.totalRenderedRows === "number" ? parsed.totalRenderedRows : null),
      totalDescriptorRows:
        typeof parsed.totalDescriptorRows === "number"
          ? parsed.totalDescriptorRows
          : (typeof parsed.totalRenderedRows === "number" ? parsed.totalRenderedRows : null),
      totalMountedDomRows:
        typeof parsed.totalMountedDomRows === "number" ? parsed.totalMountedDomRows : null,
      fullInventoryMediaControlCount:
        typeof parsed.fullInventoryMediaControlCount === "number"
          ? parsed.fullInventoryMediaControlCount
          : (typeof parsed.mediaControlCount === "number" ? parsed.mediaControlCount : null),
      fullInventoryHasZeroImagePlaceholder:
        typeof parsed.fullInventoryHasZeroImagePlaceholder === "boolean"
          ? parsed.fullInventoryHasZeroImagePlaceholder
          : (typeof parsed.hasZeroImagePlaceholder === "boolean"
              ? parsed.hasZeroImagePlaceholder
              : null),
      mediaControlCount:
        typeof parsed.mediaControlCount === "number" ? parsed.mediaControlCount : null,
      hasZeroImagePlaceholder:
        typeof parsed.hasZeroImagePlaceholder === "boolean"
          ? parsed.hasZeroImagePlaceholder
          : null,
      devShowAllTemplateFieldsActive:
        typeof parsed.devShowAllTemplateFieldsActive === "boolean"
          ? parsed.devShowAllTemplateFieldsActive
          : null,
    };
  } catch {
    return null;
  }
}

export function buildIndexViewData(record, snapshot) {
  const fieldsByKey = isPlainObject(snapshot.fieldsByKey) ? snapshot.fieldsByKey : {};
  const saveEvidence = isPlainObject(snapshot.saveVerificationEvidence)
    ? snapshot.saveVerificationEvidence
    : {};
  const orderedDrawers = buildOrderedDrawersList(snapshot, record);
  const compactAuditSummary = extractCompactUiAuditSummary(record);

  const drawerSummaries = orderedDrawers.map((d) => {
    let proposed = 0;
    let approved = 0;
    let keepOriginal = 0;
    let manualEdit = 0;
    let blocked = 0;
    let conflicts = 0;
    let needsReview = 0;
    let parkedExcluded = 0;

    for (let i = 0; i < d.fieldKeys.length; i += 1) {
      const k = d.fieldKeys[i];
      const fieldObj = fieldsByKey[k];
      if (!isPlainObject(fieldObj)) {
        continue;
      }
      const flags = evaluateFieldAttentionFlags(k, fieldObj, saveEvidence);
      if (flags.isParkedExcluded) parkedExcluded += 1;
      if (flags.isEffectiveProposedChange) proposed += 1;
      if (flags.isExplicitlyApproved) approved += 1;
      if (flags.isKeepOriginal) keepOriginal += 1;
      if (flags.isManualEdit) manualEdit += 1;
      if (flags.isBlockedWhenRelevant) blocked += 1;
      if (flags.hasConflict) conflicts += 1;
      if (flags.needsReview) needsReview += 1;
    }

    return {
      drawer: d.drawer,
      fieldKeys: d.fieldKeys,
      counts: {
        total: d.fieldKeys.length,
        proposed,
        approved,
        keepOriginal,
        manualEdit,
        blocked,
        conflicts,
        needsReview,
        ...(parkedExcluded > 0 ? { parkedExcluded } : {}),
      },
    };
  });

  const allFieldKeys = Object.keys(fieldsByKey);
  let totalProposed = 0;
  let totalApproved = 0;
  let totalKeepOriginal = 0;
  let totalManualEdit = 0;
  let totalBlocked = 0;
  let totalConflicts = 0;
  let totalNeedsReview = 0;
  let totalParkedExcluded = 0;

  for (let i = 0; i < allFieldKeys.length; i += 1) {
    const k = allFieldKeys[i];
    const fieldObj = fieldsByKey[k];
    if (!isPlainObject(fieldObj)) {
      continue;
    }
    const flags = evaluateFieldAttentionFlags(k, fieldObj, saveEvidence);
    if (flags.isParkedExcluded) totalParkedExcluded += 1;
    if (flags.isEffectiveProposedChange) totalProposed += 1;
    if (flags.isExplicitlyApproved) totalApproved += 1;
    if (flags.isKeepOriginal) totalKeepOriginal += 1;
    if (flags.isManualEdit) totalManualEdit += 1;
    if (flags.isBlockedWhenRelevant) totalBlocked += 1;
    if (flags.hasConflict) totalConflicts += 1;
    if (flags.needsReview) totalNeedsReview += 1;
  }

  return {
    schemaVersion: snapshot.schemaVersion,
    stateKind: snapshot.stateKind,
    selectionState: snapshot.selectionState || record.selectionState || "selected",
    manifestLoaded: Boolean(snapshot.manifestLoaded),
    baselineState: snapshot.baselineState || null,
    baselineEventKind: snapshot.baselineEventKind || null,
    productQueueStatus: snapshot.productQueueStatus || null,
    uiAuditState: record.uiAuditState,
    uiAuditChunkCount: record.uiAuditChunks.length,
    ...(compactAuditSummary ? { uiAuditSummary: compactAuditSummary } : {}),
    totalFieldsInMap: allFieldKeys.length,
    totals: {
      drawers: drawerSummaries.length,
      fields: allFieldKeys.length,
      parkedExcluded: totalParkedExcluded,
      proposed: totalProposed,
      approved: totalApproved,
      keepOriginal: totalKeepOriginal,
      manualEdit: totalManualEdit,
      blocked: totalBlocked,
      conflicts: totalConflicts,
      needsReview: totalNeedsReview,
    },
    drawers: drawerSummaries,
  };
}

export function buildHeaderViewData(record, snapshot) {
  const stdState = isPlainObject(snapshot.standardizedReferenceState)
    ? snapshot.standardizedReferenceState
    : null;
  const stagedCandidatesObj = isPlainObject(stdState?.stagedCandidates)
    ? stdState.stagedCandidates
    : {};
  const compactAuditSummary = extractCompactUiAuditSummary(record);

  const compactStdState = stdState
    ? {
        readinessState: stdState.readinessState ?? null,
        readinessReason: stdState.readinessReason ?? null,
        stagedCandidateCount:
          typeof stdState.stagedCandidateCount === "number"
            ? stdState.stagedCandidateCount
            : Object.keys(stagedCandidatesObj).length,
        stagedCandidateKeys: Object.keys(stagedCandidatesObj),
        eligibleDestinationKeys: Array.isArray(stdState.eligibleDestinationKeys)
          ? stdState.eligibleDestinationKeys
          : [],
        blockedDestinationKeys: Array.isArray(stdState.blockedDestinationKeys)
          ? stdState.blockedDestinationKeys
          : [],
        lastMatchRequestId: stdState.lastMatchRequestId ?? null,
        lastMatchedAt: stdState.lastMatchedAt ?? null,
        lastMatchSuccess: stdState.lastMatchSuccess ?? null,
        lastMatchIsComplete: stdState.lastMatchIsComplete ?? null,
        productCategory: stdState.productCategory ?? null,
      }
    : null;

  return {
    schemaVersion: snapshot.schemaVersion,
    stateKind: snapshot.stateKind,
    selectionState: snapshot.selectionState || record.selectionState || "selected",
    manifestLoaded: Boolean(snapshot.manifestLoaded),
    baselineState: snapshot.baselineState || null,
    baselineEventKind: snapshot.baselineEventKind || null,
    productQueueStatus: snapshot.productQueueStatus || null,
    dataAuthorityNote: snapshot.dataAuthorityNote || null,
    runIdentity: snapshot.runIdentity ?? record.runIdentity ?? null,
    runTimestamp: snapshot.runTimestamp ?? record.runTimestamp ?? null,
    uiAuditState: record.uiAuditState,
    uiAuditChunkCount: record.uiAuditChunks.length,
    ...(compactAuditSummary ? { uiAuditSummary: compactAuditSummary } : {}),
    systemStatus: snapshot.systemStatus || null,
    diagnosticsStats: snapshot.diagnosticsStats || null,
    manualEditedKeys: Array.isArray(snapshot.manualEditedKeys)
      ? snapshot.manualEditedKeys
      : [],
    explicitlyApprovedKeys: Array.isArray(snapshot.explicitlyApprovedKeys)
      ? snapshot.explicitlyApprovedKeys
      : [],
    keepOriginalKeys: Array.isArray(snapshot.keepOriginalKeys)
      ? snapshot.keepOriginalKeys
      : [],
    standardizedReferenceState: compactStdState,
    saveVerificationEvidence: snapshot.saveVerificationEvidence || null,
  };
}

export function buildReviewViewData(snapshot, record = null) {
  const fieldsByKey = isPlainObject(snapshot.fieldsByKey) ? snapshot.fieldsByKey : {};
  const saveEvidence = isPlainObject(snapshot.saveVerificationEvidence)
    ? snapshot.saveVerificationEvidence
    : {};
  const orderedDrawers = buildOrderedDrawersList(snapshot, record);

  const keyToDrawersMap = new Map();
  for (let i = 0; i < orderedDrawers.length; i += 1) {
    const d = orderedDrawers[i];
    for (let j = 0; j < d.fieldKeys.length; j += 1) {
      const k = d.fieldKeys[j];
      let list = keyToDrawersMap.get(k);
      if (!list) {
        list = [];
        keyToDrawersMap.set(k, list);
      }
      if (!list.includes(d.drawer)) {
        list.push(d.drawer);
      }
    }
  }

  const orderedKeys = [];
  const visitedKeys = new Set();
  for (let i = 0; i < orderedDrawers.length; i += 1) {
    const d = orderedDrawers[i];
    for (let j = 0; j < d.fieldKeys.length; j += 1) {
      const k = d.fieldKeys[j];
      if (!visitedKeys.has(k) && Object.prototype.hasOwnProperty.call(fieldsByKey, k)) {
        visitedKeys.add(k);
        orderedKeys.push(k);
      }
    }
  }

  const allMapKeys = Object.keys(fieldsByKey);
  for (let i = 0; i < allMapKeys.length; i += 1) {
    const k = allMapKeys[i];
    if (!visitedKeys.has(k)) {
      visitedKeys.add(k);
      orderedKeys.push(k);
    }
  }

  const items = [];
  let proposedDiffCount = 0;
  let approvedCount = 0;
  let keepOriginalCount = 0;
  let manualEditCount = 0;
  let conflictCount = 0;
  let blockedOrHoldCount = 0;
  let needsReviewCount = 0;
  let parkedExcludedTotalCount = 0;

  for (let i = 0; i < orderedKeys.length; i += 1) {
    const k = orderedKeys[i];
    const fieldObj = fieldsByKey[k];
    if (!isPlainObject(fieldObj)) {
      continue;
    }

    const flags = evaluateFieldAttentionFlags(k, fieldObj, saveEvidence);
    if (flags.isParkedExcluded) {
      parkedExcludedTotalCount += 1;
    }
    if (!flags.isActionableForReview) {
      continue;
    }

    if (flags.isEffectiveProposedChange) proposedDiffCount += 1;
    if (flags.isExplicitlyApproved) approvedCount += 1;
    if (flags.isKeepOriginal) keepOriginalCount += 1;
    if (flags.isManualEdit) manualEditCount += 1;
    if (flags.hasConflict) conflictCount += 1;
    if (flags.isBlockedWhenRelevant) blockedOrHoldCount += 1;
    if (flags.needsReview) needsReviewCount += 1;

    const rawBase = isPlainObject(fieldObj.rawStoredBaseline)
      ? fieldObj.rawStoredBaseline
      : {};
    const evalBase = isPlainObject(fieldObj.evaluatedBaseline)
      ? fieldObj.evaluatedBaseline
      : {};
    const working = isPlainObject(fieldObj.workingState)
      ? fieldObj.workingState
      : {};
    const statusHolds = isPlainObject(fieldObj.statusAndHolds)
      ? fieldObj.statusAndHolds
      : {};
    const conflictsObj = isPlainObject(fieldObj.conflictsAndSaveEvidence)
      ? fieldObj.conflictsAndSaveEvidence
      : {};

    const drawersForField = keyToDrawersMap.get(k) || [
      typeof fieldObj.section === "string" && fieldObj.section.trim()
        ? fieldObj.section.trim()
        : "Unassigned",
    ];

    const holdFlags = [];
    if (statusHolds.isParkedExcluded || flags.isParkedExcluded) holdFlags.push("parkedExcluded");
    if (statusHolds.isActualBlockedProposal) holdFlags.push("actualBlockedProposal");
    if (statusHolds.hasTechnicalBlock) holdFlags.push("technicalBlock");
    if (statusHolds.hasContractOrOwnerHold) holdFlags.push("contractOrOwnerHold");
    if (statusHolds.hasExplicitStorageHold) holdFlags.push("explicitStorageHold");
    if (statusHolds.hasExplicitProducerHold) holdFlags.push("explicitProducerHold");
    if (statusHolds.isVariantMetafieldHold) holdFlags.push("variantMetafieldHold");
    if (statusHolds.isPendingReadOnly) holdFlags.push("pendingReadOnly");
    if (statusHolds.isChannelFlagReadOnly) holdFlags.push("channelFlagReadOnly");
    if (flags.inSaveBlocked) holdFlags.push("blockedInLastRepair");

    items.push({
      key: k,
      targetKey: fieldObj.targetKey || k,
      approvalKey: fieldObj.approvalKey || k,
      drawer: drawersForField[0],
      ...(drawersForField.length > 1 ? { drawers: drawersForField } : {}),
      label: fieldObj.label || k,
      registryOwner: fieldObj.registryOwner || statusHolds.registryOwner || "PRODUCT",
      registryIdentity: fieldObj.registryIdentity || statusHolds.registryIdentity || k,
      registryRole:
        fieldObj.registryRole ||
        statusHolds.registryRole ||
        (flags.isParkedExcluded ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION"),
      isParkedExcluded: flags.isParkedExcluded,
      fieldStatus: statusHolds.fieldStatus || null,
      applicability: statusHolds.applicability || null,
      rawBaselineEvidenceAvailable: Boolean(rawBase.evidenceAvailable),
      rawBaselineExists: Boolean(rawBase.exists),
      evaluatedBaselineExists: Boolean(evalBase.currentExists),
      isDisplayOnlyPlaceholderOrNa: Boolean(evalBase.isDisplayOnlyPlaceholderOrNa),
      hasActualValueDiff: flags.hasActualValueDiff,
      proposalStatus: working.proposalStatus || null,
      isManualEdit: flags.isManualEdit,
      isApproved: flags.isExplicitlyApproved,
      isKeepOriginal: flags.isKeepOriginal,
      keepOriginalDecision: flags.keepOriginalDecision,
      canKeepOriginal: flags.canKeepOriginal,
      isContentPreApproved: Boolean(working.isContentPreApproved),
      preApprovalReason: working.preApprovalReason || null,
      contentNeedsReview: flags.needsReview,
      source: working.source || null,
      stage: working.stage || null,
      isBlocked: flags.isBlockedWhenRelevant,
      holdFlags,
      reasons: Array.isArray(statusHolds.reasons) ? statusHolds.reasons : [],
      hasConflict: flags.hasConflict,
      conflictData: conflictsObj.conflictData || null,
      nativeDescConflictData: conflictsObj.nativeDescConflictData || null,
      wasSubmittedInLastRepair: Boolean(conflictsObj.wasSubmittedInLastRepair),
      inSaveConflicts: flags.inSaveConflicts,
      inSaveUnresolved: flags.inSaveUnresolved,
    });
  }

  return {
    selectionState: snapshot.selectionState || record?.selectionState || "selected",
    manifestLoaded: Boolean(snapshot.manifestLoaded),
    baselineState: snapshot.baselineState || null,
    summaryCounts: {
      totalFieldsEvaluated: orderedKeys.length,
      parkedExcludedCount: parkedExcludedTotalCount,
      actionableItemCount: items.length,
      proposedWithDiff: proposedDiffCount,
      explicitlyApproved: approvedCount,
      keepOriginal: keepOriginalCount,
      manualEdits: manualEditCount,
      conflicts: conflictCount,
      blockedOrHeld: blockedOrHoldCount,
      needsReview: needsReviewCount,
    },
    saveVerificationSummary: {
      hasRepairAttemptInSession: Boolean(saveEvidence.hasRepairAttemptInSession),
      lastRepairCompletedAt: saveEvidence.lastRepairCompletedAt || null,
      lastRepairStatus: saveEvidence.lastRepairStatus || null,
      lastRepairSuccess:
        saveEvidence.lastRepairSuccess !== undefined
          ? saveEvidence.lastRepairSuccess
          : null,
      readBackVerified:
        saveEvidence.readBackVerified !== undefined
          ? saveEvidence.readBackVerified
          : null,
      verifiedDestinations: Array.isArray(saveEvidence.verifiedDestinations)
        ? saveEvidence.verifiedDestinations
        : [],
      attemptedDestinations: Array.isArray(saveEvidence.attemptedDestinations)
        ? saveEvidence.attemptedDestinations
        : [],
      blockedFields: isPlainObject(saveEvidence.blockedFields)
        ? saveEvidence.blockedFields
        : {},
      conflicts: isPlainObject(saveEvidence.conflicts) ? saveEvidence.conflicts : {},
      unresolvedChanges: isPlainObject(saveEvidence.unresolvedChanges)
        ? saveEvidence.unresolvedChanges
        : {},
    },
    items,
  };
}

export function resolveDrawerTarget(snapshot, rawDrawerTitle, record = null) {
  const requested = typeof rawDrawerTitle === "string" ? rawDrawerTitle.trim() : "";
  const orderedDrawers = buildOrderedDrawersList(snapshot, record);
  const availableDrawers = orderedDrawers.map((d) => d.drawer);

  if (!requested) {
    return {
      ok: false,
      code: "missing_drawer",
      message: 'A nonempty "drawer" name is required when view="drawer".',
      availableDrawers,
    };
  }

  let matched = orderedDrawers.find((d) => d.drawer === requested);
  if (!matched) {
    const lowerReq = requested.toLowerCase();
    if (
      !isUnselectedPreviewSnapshot(snapshot, record) &&
      (lowerReq === "description review" ||
        lowerReq === "description_review" ||
        lowerReq === "description")
    ) {
      matched = orderedDrawers.find(
        (d) => d.drawer === DESCRIPTION_REVIEW_DRAWER_TITLE
      );
    } else if (
      lowerReq === "parked" ||
      lowerReq === "parked / excluded" ||
      lowerReq === "parked_excluded" ||
      lowerReq === "excluded" ||
      lowerReq === "parked / excluded inventory (read-only)"
    ) {
      matched = orderedDrawers.find((d) =>
        d.drawer.toLowerCase().startsWith("parked / excluded")
      );
    } else {
      matched = orderedDrawers.find((d) => d.drawer.toLowerCase() === lowerReq);
    }
  }

  if (!matched) {
    if (
      !isUnselectedPreviewSnapshot(snapshot, record) &&
      snapshot.manifestLoaded === false &&
      (requested === DESCRIPTION_REVIEW_DRAWER_TITLE ||
        requested.toLowerCase() === "description review" ||
        requested.toLowerCase() === "description_review")
    ) {
      return {
        ok: true,
        drawerTitle: DESCRIPTION_REVIEW_DRAWER_TITLE,
        fieldKeys: [],
        fields: {},
      };
    }

    return {
      ok: false,
      code: "drawer_not_found",
      message: `Drawer "${requested}" was not found in this snapshot.`,
      availableDrawers,
    };
  }

  const fieldsByKey = isPlainObject(snapshot.fieldsByKey) ? snapshot.fieldsByKey : {};
  const fields = {};
  for (let i = 0; i < matched.fieldKeys.length; i += 1) {
    const k = matched.fieldKeys[i];
    if (Object.prototype.hasOwnProperty.call(fieldsByKey, k)) {
      fields[k] = fieldsByKey[k];
    }
  }

  return {
    ok: true,
    drawerTitle: matched.drawer,
    fieldKeys: matched.fieldKeys,
    fields,
  };
}

export function resolveFieldTarget(snapshot, rawFieldKey, record = null) {
  const requested = typeof rawFieldKey === "string" ? rawFieldKey.trim() : "";
  const fieldsByKey = isPlainObject(snapshot.fieldsByKey) ? snapshot.fieldsByKey : {};

  if (!requested) {
    return {
      ok: false,
      code: "missing_field_key",
      message: 'A nonempty "fieldKey" is required when view="field".',
    };
  }

  if (Object.prototype.hasOwnProperty.call(fieldsByKey, requested)) {
    return {
      ok: true,
      fieldKey: requested,
      field: fieldsByKey[requested],
    };
  }

  const allKeys = Object.keys(fieldsByKey);
  for (let i = 0; i < allKeys.length; i += 1) {
    const k = allKeys[i];
    const candidate = fieldsByKey[k];
    if (
      isPlainObject(candidate) &&
      (candidate.targetKey === requested ||
        candidate.approvalKey === requested ||
        candidate.registryIdentity === requested ||
        `${candidate.registryOwner}:${candidate.registryIdentity}` === requested)
    ) {
      return {
        ok: true,
        fieldKey: k,
        requestedAlias: requested,
        field: candidate,
      };
    }
  }

  const isPreview = isUnselectedPreviewSnapshot(snapshot, record);
  return {
    ok: false,
    code:
      !isPreview && snapshot.manifestLoaded === false
        ? "manifest_not_loaded_for_field"
        : "field_not_found",
    message:
      !isPreview && snapshot.manifestLoaded === false
        ? `Field "${requested}" is unavailable because manifestLoaded=false for this selected product.`
        : `Field "${requested}" was not found in snapshot fieldsByKey.`,
  };
}

export function buildBoundedOrganizedViewEnvelope({
  record,
  snapshot,
  view,
  drawer = null,
  fieldKey = null,
  chunkIndex,
  viewPayloadObj,
  onVerifiedChunkRead,
}) {
  const canonicalText = JSON.stringify(viewPayloadObj);
  const totalUtf8Bytes = utf8ByteLength(canonicalText);

  let chunks = splitUtf8CodePoints(
    canonicalText,
    MAX_ORGANIZED_VIEW_CHUNK_UTF8_BYTES
  );
  if (chunks.length === 0) {
    chunks = Object.freeze([canonicalText]);
  }

  if (chunks.join("") !== canonicalText) {
    return finalizeResponse({
      ok: false,
      status: "error",
      code: "view_chunk_integrity_failure",
      message: "Failed lossless UTF-8 code-point chunk verification for organized view.",
    });
  }

  if (chunkIndex >= chunks.length) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "chunk_index_out_of_range",
      reportId: record.reportId,
      section: "report",
      view,
      ...(drawer !== null ? { drawer } : {}),
      ...(fieldKey !== null ? { fieldKey } : {}),
      chunkIndex,
      chunkCount: chunks.length,
      message: `chunkIndex ${chunkIndex} is out of bounds for view="${view}" with ${chunks.length} chunk(s).`,
    });
  }

  // All inputs, target existence, and chunk bounds are verified: invoke pin callback at the exact original point
  const pinContext =
    typeof onVerifiedChunkRead === "function"
      ? onVerifiedChunkRead(chunkIndex)
      : null;

  const isHistoricalSuperseded = Boolean(pinContext?.isSuperseded);
  const supersededByRevision = pinContext?.supersededByRevision ?? null;
  const pinExpiresAt = pinContext?.pinExpiresAt ?? null;

  const chunkText = chunks[chunkIndex];
  const hasMoreChunks = chunkIndex + 1 < chunks.length;

  const baseEnvelope = {
    ok: true,
    status: "ok",
    reportId: record.reportId,
    productId: record.productId,
    productTitle: record.productTitle,
    mode: record.mode,
    section: "report",
    view,
    ...(drawer !== null ? { drawer } : {}),
    ...(fieldKey !== null ? { fieldKey } : {}),
    benchSessionId: record.benchSessionId,
    benchRevision: record.benchRevision,
    selectionState: record.selectionState,
    manifestLoaded: Boolean(snapshot.manifestLoaded),
    baselineState: snapshot.baselineState || null,
    clientStateChangedAt: record.capturedAt,
    baselineLoadedAt: record.baselineLoadedAt,
    serverReceivedAt: record.storedAt,
    expiresAt: record.expiresAt,
    baselineSource: record.baselineSource,
    workingState: record.workingState,
    isHistoricalSuperseded,
    supersededByRevision,
    pinExpiresAt,
    uiAuditState: record.uiAuditState,
    chunkIndex,
    chunkCount: chunks.length,
    chunkUtf8Bytes: utf8ByteLength(chunkText),
    totalUtf8Bytes,
    hasMoreChunks,
    nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
  };

  if (chunks.length === 1) {
    const withInlineData = {
      ...baseEnvelope,
      data: viewPayloadObj,
      text: chunkText,
    };
    if (utf8ByteLength(JSON.stringify(withInlineData)) <= MAX_RESPONSE_UTF8_BYTES) {
      return finalizeResponse(withInlineData);
    }

    const withStructuredDataOnly = {
      ...baseEnvelope,
      data: viewPayloadObj,
    };
    if (
      utf8ByteLength(JSON.stringify(withStructuredDataOnly)) <= MAX_RESPONSE_UTF8_BYTES
    ) {
      return finalizeResponse(withStructuredDataOnly);
    }
  }

  const withTextChunk = {
    ...baseEnvelope,
    text: chunkText,
  };
  return finalizeResponse(withTextChunk);
}
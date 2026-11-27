// ============================================================================
// FILE: app/utils/sidekick-research-status.server.js
// ROCKHOUND STUDIO — SHARED PROCESS-LOCAL RESEARCH LOCK & READ-ONLY STATUS
//
// Pure/lightweight server module (zero React/Router/UI route imports, zero
// Shopify GraphQL queries/mutations, zero provider calls, zero hydration, and
// zero telemetry report-cache reads).
//
// Exports for later callers:
// - SIDEKICK_RESEARCH_IN_FLIGHT_GLOBAL_KEY
// - buildResearchLockCompositeKey
// - getResearchInFlightLockSet
// - isResearchInFlightLocally
// - buildSingleRequestStatusMetadata
// ============================================================================

import {
  SAVED_REPORT_FIELD_KEY,
  evaluateResearchRunEligibility,
  isSavedReportFieldGenuinelyEmpty,
  parseSavedReportField,
} from "./sidekick-research-storage.server.js";

export const SIDEKICK_RESEARCH_IN_FLIGHT_GLOBAL_KEY =
  "__ROCKHOUND_SIDEKICK_RESEARCH_IN_FLIGHT_LOCKS_V1__";

const METAOBJECT_GID_PATTERN = /^gid:\/\/shopify\/Metaobject\/\d+$/;
const MAX_SHORT_ID_CHARS = 64;
const MAX_REQUEST_KEY_CHARS = 160;
const MAX_STATUS_CODE_CHARS = 80;
const MAX_REASON_CHARS = 240;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function clampShortString(rawValue, maxChars, fallback = null) {
  if (typeof rawValue !== "string") {
    return fallback;
  }
  const cleaned = rawValue.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
}

function normalizeIsoObservationTime(rawObservedAt) {
  if (typeof rawObservedAt === "string" && rawObservedAt.trim()) {
    const trimmed = rawObservedAt.trim();
    const parsedMs = Date.parse(trimmed);
    if (Number.isFinite(parsedMs)) {
      return new Date(parsedMs).toISOString();
    }
  }
  return new Date().toISOString();
}

export function buildResearchLockCompositeKey(shop, metaobjectId) {
  const normalizedShop = typeof shop === "string" ? shop.trim().toLowerCase() : "";
  const normalizedMetaobjectId =
    typeof metaobjectId === "string" ? metaobjectId.trim() : "";
  return `${normalizedShop}::${normalizedMetaobjectId}`;
}

export function getResearchInFlightLockSet() {
  const existing = globalThis[SIDEKICK_RESEARCH_IN_FLIGHT_GLOBAL_KEY];
  if (existing instanceof Set) {
    return existing;
  }
  const lockSet = new Set();
  Object.defineProperty(globalThis, SIDEKICK_RESEARCH_IN_FLIGHT_GLOBAL_KEY, {
    value: lockSet,
    writable: false,
    enumerable: false,
    configurable: true,
  });
  return lockSet;
}

export function isResearchInFlightLocally(shop, metaobjectId) {
  const normalizedShop = typeof shop === "string" ? shop.trim().toLowerCase() : "";
  const normalizedMetaobjectId =
    typeof metaobjectId === "string" ? metaobjectId.trim() : "";
  if (!normalizedShop || !METAOBJECT_GID_PATTERN.test(normalizedMetaobjectId)) {
    return false;
  }
  const lockSet = getResearchInFlightLockSet();
  return lockSet.has(buildResearchLockCompositeKey(normalizedShop, normalizedMetaobjectId));
}

export function buildSingleRequestStatusMetadata(options = {}) {
  const opts = isPlainObject(options) ? options : {};
  const observedAt = normalizeIsoObservationTime(opts.observedAt);
  const normalizedShop =
    typeof opts.shop === "string" ? opts.shop.trim().toLowerCase() : "";
  const rawMetaobjectId =
    typeof opts.metaobjectId === "string" ? opts.metaobjectId.trim() : "";
  const validGid = METAOBJECT_GID_PATTERN.test(rawMetaobjectId);
  const metaobjectId = validGid
    ? rawMetaobjectId
    : clampShortString(rawMetaobjectId, 128, null);
  const shortId = validGid
    ? clampShortString(rawMetaobjectId.split("/").pop() || null, MAX_SHORT_ID_CHARS, null)
    : null;

  const fields = isPlainObject(opts.fields) ? opts.fields : {};

  const requestKey =
    clampShortString(fields.requestKey, MAX_REQUEST_KEY_CHARS, null) ??
    clampShortString(opts.requestKey, MAX_REQUEST_KEY_CHARS, null);

  const queryPresent =
    typeof fields.query === "string" && fields.query.trim().length > 0;
  const constraintsPresent =
    typeof fields.constraints === "string" && fields.constraints.trim().length > 0;

  const rawStatusTrimmed =
    typeof fields.status === "string" && fields.status.trim().length > 0
      ? clampShortString(fields.status.toLowerCase(), MAX_STATUS_CODE_CHARS, null)
      : null;
  const effectiveNormalizedStatus = rawStatusTrimmed || "queued";

  const claimIdStr = clampShortString(fields.claimId, 128, null);
  const reportIdStr = clampShortString(fields.reportId, 128, null);
  const executedAtStr = clampShortString(fields.executedAt, 80, null);
  const groundingSummaryPresent =
    typeof fields.groundingSummary === "string" &&
    fields.groundingSummary.trim().length > 0;
  const errorDetailPresent =
    typeof fields.errorDetail === "string" && fields.errorDetail.trim().length > 0;

  const rawSavedField = fields[SAVED_REPORT_FIELD_KEY];
  const savedReportEmpty = isSavedReportFieldGenuinelyEmpty(rawSavedField);
  const savedReportJsonPresent = !savedReportEmpty;

  let savedReportJsonValid = null;
  let parsedEnvelopeReportId = null;
  if (savedReportJsonPresent) {
    const parsedSaved = parseSavedReportField(rawSavedField);
    savedReportJsonValid = Boolean(parsedSaved && parsedSaved.valid === true);
    if (
      savedReportJsonValid &&
      parsedSaved.envelope &&
      typeof parsedSaved.envelope.reportId === "string" &&
      parsedSaved.envelope.reportId.trim()
    ) {
      parsedEnvelopeReportId = clampShortString(
        parsedSaved.envelope.reportId,
        128,
        null
      );
    }
  }

  const eligibilityEval = evaluateResearchRunEligibility(fields);
  const inCurrentProcess =
    Boolean(normalizedShop) && validGid
      ? isResearchInFlightLocally(normalizedShop, rawMetaobjectId)
      : false;

  const resolvedReportId = reportIdStr || parsedEnvelopeReportId || null;

  return {
    observedAt,
    request: {
      metaobjectId,
      shortId,
      validGid,
      requestKey,
      queryPresent,
      constraintsPresent,
      storedStatus: rawStatusTrimmed,
      normalizedStatus: effectiveNormalizedStatus,
    },
    savedEvidence: {
      claimIdPresent: Boolean(claimIdStr),
      claimId: claimIdStr,
      reportIdPresent: Boolean(reportIdStr),
      reportId: reportIdStr,
      executedAtPresent: Boolean(executedAtStr),
      executedAt: executedAtStr,
      groundingSummaryPresent,
      errorDetailPresent,
      savedReportJsonPresent,
      savedReportJsonValid,
    },
    eligibility: {
      eligible: Boolean(eligibilityEval.eligible),
      code: clampShortString(eligibilityEval.code, MAX_STATUS_CODE_CHARS, "unknown"),
      reason: clampShortString(
        eligibilityEval.message,
        MAX_REASON_CHARS,
        "Eligibility status evaluated."
      ),
      nullFieldsDoNotProveRetrySafety: true,
      eligibilityIsNotRunAuthorization: true,
    },
    localProcessLock: {
      inCurrentProcess,
      scope: "single_process_ram_only",
      globalInactivityProven: false,
      note: inCurrentProcess
        ? "Active in-flight lock observed in this responding worker process only."
        : "No in-flight lock observed in this responding worker process; this does not prove global inactivity across other workers or instances.",
    },
    answerAvailability: {
      reportIdPresent: Boolean(resolvedReportId),
      reportId: resolvedReportId,
      savedReportJsonPresent,
      savedReportJsonValid,
      ramCacheChecked: false,
    },
  };
}
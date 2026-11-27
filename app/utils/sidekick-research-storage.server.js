// ============================================================================
// FILE: app/utils/sidekick-research-storage.server.js
// ROCKHOUND STUDIO — PURE SERVER RESEARCH STORAGE, HYDRATION & CALM-VIEW MAPPER
//
// Zero Admin GraphQL mutations, zero external non-Shopify network calls, and
// zero new npm dependencies. Durable writes work strictly through injected
// existing queue callbacks (readResearchMetaobjectById /
// updateResearchMetaobjectFields), while read-only durable hydration uses a
// single bounded Shopify metaobject list query under authenticated shop
// isolation.
//
// Core Guarantees:
// - Enforces a strict 120,000 UTF-8 byte ceiling on "savedReportJson".
// - Preserves 100% of the grounded report intact (modelSynthesisAnswer,
//   webSearchQueries, sourcesByOriginalChunkIndex, modelAnswerSpanAttributions,
//   searchEntryPointHtml, and optional contextProvenance / inputAttachments
//   metadata). NEVER strips citation spans or searchEntryPoint, NEVER persists
//   or exposes raw image bytes or base64, and NEVER silently truncates answers.
// - Owns the single canonical publishGroundedResearchToTelemetryCache() and
//   hydrateDurableResearchReportsToCache() helpers shared by the queue route
//   and the telemetry reader route (no route-to-route imports).
// - Preserves deterministic report identity (reportId) across initial run,
//   manual reload, and cold-process hydration by retaining the immutable
//   executedAt timestamp as capturedAt/runTimestamp while verified against any
//   expected durable reportId without rewriting or aliasing mismatches.
// - Requires a fresh readback via injected readMetaobjectById and byte-exact /
//   deep canonical verification of answer text, source identities, citation
//   spans, search queries, and searchEntryPoint HTML before reporting
//   durablySaved = true ("Answer Saved").
// - Treats ANY nonempty, malformed, unverified, or non-string savedReportJson
//   value as strictly non-runnable pending review; never uses verification
//   failure to permit another paid Gemini run.
// - Never reruns paid Gemini research automatically.
// ============================================================================

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
  GEMINI_GROUNDED_RESEARCH_MODE,
  MIN_QUERY_CHARS,
  MAX_QUERY_CHARS,
  MAX_CONSTRAINTS_CHARS,
  MAX_REQUEST_KEY_CHARS,
  validateResearchInputs,
} from "./gemini-grounded-research.server.js";
import { storeTelemetryReport } from "./meta-injector.sidekick-report-cache.server.js";

export const RESEARCH_METAOBJECT_TYPE = "sidekick_research_request";
export const SAVED_REPORT_FIELD_KEY = "savedReportJson";
export const SAVED_REPORT_SCHEMA_VERSION = 1;
export const MAX_SAVED_REPORT_UTF8_BYTES = 120000;

export const DEFAULT_HYDRATION_WAIT_BUDGET_MS = 2500;
export const MIN_HYDRATION_WAIT_BUDGET_MS = 250;
export const MAX_HYDRATION_WAIT_BUDGET_MS = 4000;
export const HYDRATION_SCAN_PAGE_LIMIT = 20;

const HYDRATION_STATE_GLOBAL_KEY =
  "__ROCKHOUND_SIDEKICK_RESEARCH_HYDRATION_STATE_V1__";
const HYDRATION_CLEAN_EMPTY_COOLDOWN_MS = 5000;

const LENGTH_INPUT_ERROR_CODES = new Set([
  "missing_query",
  "query_too_short",
  "query_too_long",
  "constraints_too_long",
  "request_key_too_long",
]);

const FORBIDDEN_BINARY_ATTACHMENT_KEY_REGEX =
  /^(?:data|base64|inlinedata|rawbytes|buffer|bytes)$/i;

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

export const CALM_CARD_STATES = Object.freeze({
  READY_TO_RUN: "ready_to_run",
  RUNNING: "running",
  ANSWER_SAVED: "answer_saved",
  COMPLETED_NOT_SAVED: "completed_not_saved",
  NEEDS_ATTENTION: "needs_attention",
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function utf8ByteLength(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

function clampCleanSingleLine(value, maxChars, fallback = null) {
  if (typeof value !== "string") {
    return fallback;
  }
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
  if (!cleaned) {
    return fallback;
  }
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
}

function canonicalizeValue(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  const keys = Object.keys(value).sort();
  const out = {};
  for (let i = 0; i < keys.length; i += 1) {
    const k = keys[i];
    if (value[k] !== undefined) {
      out[k] = canonicalizeValue(value[k]);
    }
  }
  return out;
}

function sha256CanonicalJson(value) {
  const canonicalJson = JSON.stringify(canonicalizeValue(value));
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

function parseReportObjectFromRawJson(reportFullTextJson) {
  if (typeof reportFullTextJson !== "string" || !reportFullTextJson.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(reportFullTextJson);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseStrictIsoTimestampString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const isoPattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
  if (!isoPattern.test(trimmed)) {
    return null;
  }
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    return null;
  }
  return trimmed;
}

/**
 * True ONLY when a raw savedReportJson field value is genuinely absent or
 * whitespace-empty. Any nonempty string or unexpected non-string value returns
 * false so the request is treated as non-runnable pending review.
 */
export function isSavedReportFieldGenuinelyEmpty(rawFieldValue) {
  if (rawFieldValue === undefined || rawFieldValue === null) {
    return true;
  }
  if (typeof rawFieldValue === "string") {
    return rawFieldValue.trim().length === 0;
  }
  return false;
}

/**
 * Shared six-part run-eligibility contract for both server dispatch and calm UI
 * card state:
 * 1. status is "queued" or "failed_pre_dispatch" (empty defaults to "queued")
 * 2. claimId is empty
 * 3. executedAt is empty
 * 4. reportId is empty
 * 5. savedReportJson is genuinely empty (never nonempty, malformed, or non-string)
 * 6. validateResearchInputs({ query, constraints, requestKey }) passes
 */
export function evaluateResearchRunEligibility(rawFields = {}) {
  const f = isPlainObject(rawFields) ? rawFields : {};
  const rawStatus =
    typeof f.status === "string" && f.status.trim()
      ? f.status.trim().toLowerCase()
      : "queued";
  const claimId =
    typeof f.claimId === "string"
      ? f.claimId.trim()
      : String(f.claimId ?? "").trim();
  const executedAt =
    typeof f.executedAt === "string"
      ? f.executedAt.trim()
      : String(f.executedAt ?? "").trim();
  const reportId =
    typeof f.reportId === "string"
      ? f.reportId.trim()
      : String(f.reportId ?? "").trim();

  const rawSavedValue = f[SAVED_REPORT_FIELD_KEY];
  const savedReportEmpty = isSavedReportFieldGenuinelyEmpty(rawSavedValue);

  const queryStr = typeof f.query === "string" ? f.query : "";
  const constraintsVal =
    typeof f.constraints === "string"
      ? f.constraints
      : f.constraints === undefined || f.constraints === null
        ? null
        : String(f.constraints);
  const requestKeyVal =
    typeof f.requestKey === "string"
      ? f.requestKey
      : f.requestKey === undefined || f.requestKey === null
        ? null
        : String(f.requestKey);

  const inputCheck = validateResearchInputs({
    query: queryStr,
    constraints: constraintsVal,
    requestKey: requestKeyVal,
  });

  const isPreDispatchStatus =
    rawStatus === "queued" || rawStatus === "failed_pre_dispatch";
  const hasExecutionOrSaveEvidence =
    claimId !== "" ||
    executedAt !== "" ||
    reportId !== "" ||
    !savedReportEmpty;

  if (!savedReportEmpty) {
    return {
      eligible: false,
      code: "saved_report_field_present",
      rawStatus,
      hasExecutionOrSaveEvidence: true,
      inputCheck,
      message:
        "Request already contains savedReportJson data and cannot be dispatched again.",
    };
  }

  if (claimId !== "" || executedAt !== "" || reportId !== "") {
    return {
      eligible: false,
      code: "execution_evidence_present",
      rawStatus,
      hasExecutionOrSaveEvidence: true,
      inputCheck,
      message: `Request already has execution or claim evidence (status="${rawStatus}", claimId="${claimId || "none"}").`,
    };
  }

  if (!isPreDispatchStatus) {
    return {
      eligible: false,
      code: "non_runnable_status",
      rawStatus,
      hasExecutionOrSaveEvidence: false,
      inputCheck,
      message: `Request status "${rawStatus}" is not eligible for research dispatch.`,
    };
  }

  if (!inputCheck.ok) {
    return {
      eligible: false,
      code: inputCheck.code,
      rawStatus,
      hasExecutionOrSaveEvidence: false,
      inputCheck,
      message: inputCheck.message,
    };
  }

  return {
    eligible: true,
    code: "eligible_to_run",
    rawStatus,
    hasExecutionOrSaveEvidence: false,
    inputCheck,
    message: "Request is eligible for merchant-confirmed research execution.",
  };
}

function buildPreDispatchInputHelperMessage(inputCheck) {
  if (!inputCheck || inputCheck.ok) {
    return "";
  }
  switch (inputCheck.code) {
    case "missing_query":
      return `Question is empty. Enter ${MIN_QUERY_CHARS}–${MAX_QUERY_CHARS} characters in Shopify Admin and Save.`;
    case "query_too_short":
      return `Question is too short (minimum ${MIN_QUERY_CHARS} characters). Edit in Shopify Admin and Save.`;
    case "query_too_long":
      return `Question exceeds the ${MAX_QUERY_CHARS}-character limit. Shorten it in Shopify Admin and Save.`;
    case "constraints_too_long":
      return `Constraints exceed the ${MAX_CONSTRAINTS_CHARS}-character limit. Shorten Constraints in Shopify Admin and Save—this card will unlock automatically.`;
    case "request_key_too_long":
      return `Request Key exceeds the ${MAX_REQUEST_KEY_CHARS}-character limit. Shorten it in Shopify Admin and Save.`;
    default:
      return `${inputCheck.message} Edit in Shopify Admin and Save.`;
  }
}

function validateOptionalContextAndAttachmentFields(reportObj) {
  if (
    reportObj.contextProvenance !== undefined &&
    reportObj.contextProvenance !== null
  ) {
    if (
      !isPlainObject(reportObj.contextProvenance) ||
      typeof reportObj.contextProvenance.provided !== "boolean"
    ) {
      return {
        ok: false,
        code: "invalid_context_provenance",
        message:
          "Grounded report contextProvenance must be a plain object with boolean provided.",
      };
    }
  }

  if (
    reportObj.inputAttachments !== undefined &&
    reportObj.inputAttachments !== null
  ) {
    if (!isPlainObject(reportObj.inputAttachments)) {
      return {
        ok: false,
        code: "invalid_input_attachments",
        message: "Grounded report inputAttachments must be a plain object.",
      };
    }

    if (reportObj.inputAttachments.rawBinaryOrBase64Persisted !== false) {
      return {
        ok: false,
        code: "binary_or_base64_attachment_persistence_forbidden",
        message:
          "Saved research reports must never persist raw image bytes or base64 data.",
      };
    }

    const rawImages = reportObj.inputAttachments.imageAttachments;
    if (rawImages !== undefined && !Array.isArray(rawImages)) {
      return {
        ok: false,
        code: "invalid_image_attachments_metadata",
        message: "inputAttachments.imageAttachments must be an array when present.",
      };
    }

    if (Array.isArray(rawImages)) {
      for (let i = 0; i < rawImages.length; i += 1) {
        const item = rawImages[i];
        if (!isPlainObject(item)) {
          return {
            ok: false,
            code: "invalid_image_attachments_metadata",
            message: `inputAttachments.imageAttachments[${i}] must be a metadata object.`,
          };
        }
        const keys = Object.keys(item);
        for (let k = 0; k < keys.length; k += 1) {
          if (FORBIDDEN_BINARY_ATTACHMENT_KEY_REGEX.test(keys[k])) {
            return {
              ok: false,
              code: "binary_or_base64_attachment_persistence_forbidden",
              message: `inputAttachments.imageAttachments[${i}] contains forbidden binary/base64 property "${keys[k]}".`,
            };
          }
        }
      }
    }
  }

  return { ok: true };
}

/**
 * Validates that a reportObject contains the complete, unstripped grounded
 * structure produced by app/utils/gemini-grounded-research.server.js while
 * preserving full compatibility with legacy saved reports that predate
 * contextProvenance and inputAttachments.
 */
export function validateCompleteGroundedReportObject(reportObj) {
  if (!isPlainObject(reportObj)) {
    return {
      ok: false,
      code: "invalid_report_object",
      message: "Grounded report payload is not a valid JSON object.",
    };
  }

  if (reportObj.reportKind !== GEMINI_GROUNDED_RESEARCH_MODE) {
    return {
      ok: false,
      code: "unexpected_report_kind",
      message: `Expected reportKind="${GEMINI_GROUNDED_RESEARCH_MODE}".`,
    };
  }

  if (
    typeof reportObj.modelSynthesisAnswer !== "string" ||
    reportObj.modelSynthesisAnswer.trim().length === 0
  ) {
    return {
      ok: false,
      code: "missing_synthesis_answer",
      message: "Grounded report is missing non-empty modelSynthesisAnswer.",
    };
  }

  if (
    !Array.isArray(reportObj.sourcesByOriginalChunkIndex) ||
    reportObj.sourcesByOriginalChunkIndex.length === 0
  ) {
    return {
      ok: false,
      code: "missing_sources_array",
      message: "Grounded report is missing sourcesByOriginalChunkIndex.",
    };
  }

  if (
    !Array.isArray(reportObj.modelAnswerSpanAttributions) ||
    reportObj.modelAnswerSpanAttributions.length === 0
  ) {
    return {
      ok: false,
      code: "missing_span_attributions",
      message: "Grounded report is missing modelAnswerSpanAttributions.",
    };
  }

  if (!Array.isArray(reportObj.webSearchQueries)) {
    return {
      ok: false,
      code: "missing_web_search_queries",
      message: "Grounded report is missing webSearchQueries array.",
    };
  }

  return validateOptionalContextAndAttachmentFields(reportObj);
}

/**
 * Extracts an honest, concise context provenance summary from a grounded
 * reportObject (or optional RAM vault snapshot) without inventing complete/live
 * store coverage or hardcoded business facts.
 */
export function extractContextProvenanceSummary(
  reportObj,
  vaultSnapshot = null
) {
  const rawCtx = isPlainObject(reportObj?.contextProvenance)
    ? reportObj.contextProvenance
    : isPlainObject(reportObj?.contextSnapshot)
      ? reportObj.contextSnapshot
      : isPlainObject(vaultSnapshot?.contextProvenance)
        ? vaultSnapshot.contextProvenance
        : isPlainObject(vaultSnapshot?.contextSnapshot)
          ? vaultSnapshot.contextSnapshot
          : null;

  if (!rawCtx) {
    return {
      recorded: false,
      provided: false,
      version: null,
      source: null,
      capturedAt: null,
      coverage: "not_recorded",
      completenessNote:
        "Legacy report without contextProvenance metadata; missing store or project context is unavailable, not complete store access.",
      utf8Bytes: 0,
      sha256: null,
      verifiedCaptureCount: 0,
      missingOrUnverifiedCount: 0,
      summaryLine: null,
    };
  }

  if (rawCtx.provided !== true) {
    const source =
      clampCleanSingleLine(rawCtx.source, 160, null) || "none_supplied";
    const coverage =
      clampCleanSingleLine(rawCtx.coverage, 80, null) || "none_supplied";
    const completenessNote =
      clampCleanSingleLine(rawCtx.completenessNote, 320, null) ||
      "No store or project contextPackage was supplied for this research run; missing context is unavailable, not complete store access.";

    return {
      recorded: true,
      provided: false,
      version: null,
      source,
      capturedAt: parseStrictIsoTimestampString(rawCtx.capturedAt),
      coverage,
      completenessNote,
      utf8Bytes: 0,
      sha256: null,
      verifiedCaptureCount: 0,
      missingOrUnverifiedCount: 0,
      summaryLine: `Context: none supplied (coverage=${coverage}; missing context is unavailable, not complete store access)`,
    };
  }

  const version =
    typeof rawCtx.version === "number" && Number.isInteger(rawCtx.version)
      ? rawCtx.version
      : clampCleanSingleLine(rawCtx.version, 64, "unspecified");
  const source =
    clampCleanSingleLine(rawCtx.source, 160, null) || "unspecified_source";
  const capturedAt = parseStrictIsoTimestampString(rawCtx.capturedAt);
  const coverage =
    clampCleanSingleLine(rawCtx.coverage, 80, null) || "unspecified_coverage";
  const completenessNote =
    clampCleanSingleLine(rawCtx.completenessNote, 320, null) ||
    "Scoped point-in-time context metadata only; missing or omitted store data is unavailable, NOT complete store access.";
  const utf8Bytes =
    typeof rawCtx.utf8Bytes === "number" &&
    Number.isSafeInteger(rawCtx.utf8Bytes) &&
    rawCtx.utf8Bytes >= 0
      ? rawCtx.utf8Bytes
      : 0;
  const sha256 =
    typeof rawCtx.sha256 === "string" && SHA256_HEX_REGEX.test(rawCtx.sha256.trim())
      ? rawCtx.sha256.trim().toLowerCase()
      : null;
  const verifiedCaptureCount = Array.isArray(rawCtx.verifiedCaptures)
    ? rawCtx.verifiedCaptures.length
    : 0;
  const missingOrUnverifiedCount = Array.isArray(rawCtx.missingOrUnverified)
    ? rawCtx.missingOrUnverified.length
    : 0;

  const detailParts = [
    `version=${String(version)}`,
    `source=${source}`,
    `capturedAt=${capturedAt || "unknown"}`,
    `coverage=${coverage}`,
  ];
  if (verifiedCaptureCount > 0) {
    detailParts.push(`verifiedCaptures=${verifiedCaptureCount}`);
  }
  if (missingOrUnverifiedCount > 0) {
    detailParts.push(`missingOrUnverified=${missingOrUnverifiedCount}`);
  }

  return {
    recorded: true,
    provided: true,
    version,
    source,
    capturedAt,
    coverage,
    completenessNote,
    utf8Bytes,
    sha256,
    verifiedCaptureCount,
    missingOrUnverifiedCount,
    summaryLine: `Context: ${detailParts.join(" | ")} (scoped snapshot only, not live/complete store access)`,
  };
}

/**
 * Extracts strictly safe, byte-free attachment metadata from a grounded
 * reportObject (or optional RAM vault snapshot). Never copies or exposes raw
 * image bytes or base64 content.
 */
export function extractInputAttachmentsSummary(
  reportObj,
  vaultSnapshot = null
) {
  const rawAtt = isPlainObject(reportObj?.inputAttachments)
    ? reportObj.inputAttachments
    : isPlainObject(vaultSnapshot?.inputAttachments)
      ? vaultSnapshot.inputAttachments
      : null;

  if (!rawAtt) {
    return {
      recorded: false,
      hasExplicitInputs: false,
      rawBinaryOrBase64Persisted: false,
      publicPageUrlsRequestedCount: 0,
      publicPageUrlsRetrievedCount: 0,
      publicPageUrlRetrievals: [],
      imageAttachmentsCount: 0,
      imageAttachments: [],
      summaryLine: null,
    };
  }

  const rawPageRetrievals = Array.isArray(rawAtt.publicPageUrlRetrievals)
    ? rawAtt.publicPageUrlRetrievals
    : [];
  const publicPageUrlRetrievals = [];
  let retrievedOkCount = 0;

  for (let i = 0; i < rawPageRetrievals.length; i += 1) {
    const entry = rawPageRetrievals[i];
    if (!isPlainObject(entry)) {
      continue;
    }
    const retrievedUrl = clampCleanSingleLine(entry.retrievedUrl, 2048, null);
    const retrievalStatus =
      clampCleanSingleLine(entry.retrievalStatus, 120, null) ||
      "URL_RETRIEVAL_STATUS_UNSPECIFIED";
    const retrievedOk = Boolean(entry.retrievedOk === true);
    if (retrievedOk) {
      retrievedOkCount += 1;
    }
    publicPageUrlRetrievals.push({
      retrievedUrl,
      retrievalStatus,
      retrievedOk,
    });
  }

  const declaredPageCount =
    typeof rawAtt.publicPageUrlsRequestedCount === "number" &&
    Number.isSafeInteger(rawAtt.publicPageUrlsRequestedCount) &&
    rawAtt.publicPageUrlsRequestedCount >= 0
      ? rawAtt.publicPageUrlsRequestedCount
      : publicPageUrlRetrievals.length;
  const publicPageUrlsRequestedCount = Math.max(
    declaredPageCount,
    publicPageUrlRetrievals.length
  );

  const rawImages = Array.isArray(rawAtt.imageAttachments)
    ? rawAtt.imageAttachments
    : [];
  const imageAttachments = [];

  for (let i = 0; i < rawImages.length; i += 1) {
    const img = rawImages[i];
    if (!isPlainObject(img)) {
      continue;
    }
    const attachmentIndex =
      typeof img.attachmentIndex === "number" &&
      Number.isSafeInteger(img.attachmentIndex) &&
      img.attachmentIndex >= 0
        ? img.attachmentIndex
        : i;
    const url = clampCleanSingleLine(img.url, 2048, null);
    const hostname = clampCleanSingleLine(img.hostname, 255, null);
    const mimeType =
      clampCleanSingleLine(img.mimeType, 64, null) || "application/octet-stream";
    const byteLength =
      typeof img.byteLength === "number" &&
      Number.isSafeInteger(img.byteLength) &&
      img.byteLength >= 0
        ? img.byteLength
        : 0;
    const sha256 =
      typeof img.sha256 === "string" && SHA256_HEX_REGEX.test(img.sha256.trim())
        ? img.sha256.trim().toLowerCase()
        : null;
    const fetchedAt = parseStrictIsoTimestampString(img.fetchedAt);
    const deliveryStatus =
      clampCleanSingleLine(img.deliveryStatus, 120, null) ||
      "metadata_only_no_bytes_persisted";

    imageAttachments.push({
      attachmentIndex,
      kind: "verified_inline_image",
      url,
      hostname,
      mimeType,
      byteLength,
      sha256,
      fetchedAt,
      deliveryStatus,
    });
  }

  const declaredImageCount =
    typeof rawAtt.imageAttachmentsCount === "number" &&
    Number.isSafeInteger(rawAtt.imageAttachmentsCount) &&
    rawAtt.imageAttachmentsCount >= 0
      ? rawAtt.imageAttachmentsCount
      : imageAttachments.length;
  const imageAttachmentsCount = Math.max(
    declaredImageCount,
    imageAttachments.length
  );

  const hasExplicitInputs =
    publicPageUrlsRequestedCount > 0 || imageAttachmentsCount > 0;

  let summaryLine = null;
  if (hasExplicitInputs) {
    const parts = [];
    if (publicPageUrlsRequestedCount > 0) {
      parts.push(
        `pages=${retrievedOkCount}/${publicPageUrlsRequestedCount} retrieved`
      );
    }
    if (imageAttachmentsCount > 0) {
      const compactImgSpecs = imageAttachments
        .map((img) => `${img.mimeType} ${img.byteLength}B`)
        .join(", ");
      parts.push(
        `images=${imageAttachmentsCount} verified${compactImgSpecs ? ` (${compactImgSpecs})` : ""} [metadata only, no bytes persisted]`
      );
    }
    summaryLine = `Explicit Inputs: ${parts.join(" | ")}`;
  }

  return {
    recorded: true,
    hasExplicitInputs,
    rawBinaryOrBase64Persisted: false,
    publicPageUrlsRequestedCount,
    publicPageUrlsRetrievedCount: retrievedOkCount,
    publicPageUrlRetrievals,
    imageAttachmentsCount,
    imageAttachments,
    summaryLine,
  };
}

/**
 * Canonical server-owned publisher for mode="gemini_grounded_research".
 * Preserves the immutable execution timestamp as both packet.capturedAt and
 * packet.runTimestamp, uses canonical JSON.stringify(reportObject, null, 2)
 * formatting, and verifies any expectedReportId against the deterministic
 * cache reportId without rewriting saved IDs or aliasing mismatches.
 */
export function publishGroundedResearchToTelemetryCache({
  shop,
  metaobjectId,
  requestKey = null,
  query = "",
  executedAt = null,
  reportObject = null,
  reportFullTextJson = null,
  expectedReportId = null,
}) {
  const normalizedMetaobjectId =
    typeof metaobjectId === "string" ? metaobjectId.trim() : "";
  if (!normalizedMetaobjectId) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: "missing_metaobject_id",
      message:
        "A nonempty metaobjectId is required to publish grounded research to RAM cache.",
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: null,
    };
  }

  const resolvedReportObject = isPlainObject(reportObject)
    ? reportObject
    : parseReportObjectFromRawJson(reportFullTextJson);

  const reportCheck = validateCompleteGroundedReportObject(resolvedReportObject);
  if (!reportCheck.ok) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: reportCheck.code,
      message: reportCheck.message,
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: null,
    };
  }

  // Canonicalize hash-input fields from the immutable reportObject.request /
  // reportObject.execution values first so later edits to metaobject display
  // fields cannot silently drift deterministic reportId computation.
  const canonicalRequestKey =
    typeof resolvedReportObject?.request?.requestKey === "string" &&
    resolvedReportObject.request.requestKey.trim()
      ? resolvedReportObject.request.requestKey.trim()
      : typeof requestKey === "string" && requestKey.trim()
        ? requestKey.trim()
        : null;

  const canonicalQuery =
    typeof resolvedReportObject?.request?.query === "string" &&
    resolvedReportObject.request.query.trim()
      ? resolvedReportObject.request.query.trim()
      : typeof query === "string"
        ? query.trim()
        : "";

  if (!canonicalQuery) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: "missing_canonical_query",
      message: "Cannot publish grounded research report with an empty query.",
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: null,
    };
  }

  const immutableExecutedAt =
    parseStrictIsoTimestampString(resolvedReportObject?.execution?.executedAt) ||
    parseStrictIsoTimestampString(executedAt);

  if (!immutableExecutedAt) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: "missing_immutable_executed_at",
      message:
        "Grounded research report requires a valid immutable ISO-8601 executedAt timestamp for deterministic cache identity.",
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: null,
    };
  }

  let canonicalFullTextJson = "";
  try {
    canonicalFullTextJson = JSON.stringify(resolvedReportObject, null, 2);
  } catch {
    return {
      ok: false,
      idMatchesExpected: false,
      code: "report_serialization_failed",
      message: "Failed to serialize grounded research reportObject for RAM cache.",
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: null,
    };
  }

  const shortTitle =
    canonicalQuery.length > 120
      ? `${canonicalQuery.slice(0, 117)}...`
      : canonicalQuery;

  const runIdentity = canonicalRequestKey
    ? `${canonicalRequestKey} (${normalizedMetaobjectId.split("/").pop()})`
    : normalizedMetaobjectId;

  const storeResult = storeTelemetryReport({
    shop,
    packet: {
      productId: null,
      mode: GEMINI_GROUNDED_RESEARCH_MODE,
      sectionKey: "public_web_grounded_research",
      sectionLabel: "GEMINI GROUNDED PUBLIC WEB RESEARCH",
      productTitle: shortTitle,
      runIdentity,
      runTimestamp: immutableExecutedAt,
      capturedAt: immutableExecutedAt,
      fullText: canonicalFullTextJson,
    },
    uiAudit: null,
  });

  if (!storeResult || storeResult.ok !== true || !storeResult.report?.reportId) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: storeResult?.code || "cache_store_failed",
      message:
        storeResult?.message ||
        "Failed to store grounded research report in 30-minute RAM cache.",
      reportId: null,
      expectedReportId:
        typeof expectedReportId === "string" && expectedReportId.trim()
          ? expectedReportId.trim()
          : null,
      storeResult: storeResult || null,
    };
  }

  const actualReportId = storeResult.report.reportId;
  const trimmedExpectedId =
    typeof expectedReportId === "string" && expectedReportId.trim()
      ? expectedReportId.trim()
      : null;

  if (trimmedExpectedId && actualReportId !== trimmedExpectedId) {
    return {
      ok: false,
      idMatchesExpected: false,
      code: "republished_report_id_mismatch",
      message: `Republished cache ID (${actualReportId}) did not match expected durable reportId (${trimmedExpectedId}). Saved reportId was NOT overwritten.`,
      reportId: actualReportId,
      expectedReportId: trimmedExpectedId,
      report: storeResult.report,
      storeResult,
    };
  }

  return {
    ok: true,
    idMatchesExpected: true,
    code: storeResult.deduplicated ? "republished_deduplicated" : "published_ok",
    message: `Published grounded research report (${actualReportId}) to 30-minute RAM cache.`,
    reportId: actualReportId,
    expectedReportId: trimmedExpectedId,
    executedAt: immutableExecutedAt,
    reportFullTextJson: canonicalFullTextJson,
    report: storeResult.report,
    storeResult,
  };
}

function getHydrationCoordinatorState() {
  const existing = globalThis[HYDRATION_STATE_GLOBAL_KEY];
  if (
    existing &&
    typeof existing === "object" &&
    existing.inFlightByShop instanceof Map &&
    existing.lastCleanEmptyAtMsByShop instanceof Map
  ) {
    return existing;
  }

  const initialized = {
    inFlightByShop: new Map(),
    lastCleanEmptyAtMsByShop: new Map(),
  };

  Object.defineProperty(globalThis, HYDRATION_STATE_GLOBAL_KEY, {
    value: initialized,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return initialized;
}

function mapNodeFieldsToObject(fieldsArray) {
  if (!Array.isArray(fieldsArray)) {
    return {};
  }
  const out = {};
  for (let i = 0; i < fieldsArray.length; i += 1) {
    const item = fieldsArray[i];
    if (item && typeof item.key === "string") {
      out[item.key] = item.value ?? "";
    }
  }
  return out;
}

async function runSingleShopDurableHydrationPass(admin, normalizedShop) {
  const gqlResponse = await admin.graphql(
    `#graphql
      query HydrateSavedResearchReports($type: String!, $first: Int!) {
        metaobjects(type: $type, first: $first, reverse: true) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              type
              updatedAt
              fields {
                key
                value
              }
            }
          }
        }
      }
    `,
    {
      variables: {
        type: RESEARCH_METAOBJECT_TYPE,
        first: HYDRATION_SCAN_PAGE_LIMIT,
      },
    }
  );

  const payload = await gqlResponse.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return {
      ok: false,
      outcome: "error",
      complete: false,
      hasMoreBeyondScanWindow: false,
      scannedCount: 0,
      verifiedSavedCount: 0,
      hydratedCount: 0,
      idMismatchCount: 0,
      cachePublishErrorCount: 0,
      reason: "graphql_query_error",
      message:
        payload.errors[0]?.message ||
        "GraphQL query failed while reading durable research reports.",
    };
  }

  const connection = payload?.data?.metaobjects;
  if (!connection || !Array.isArray(connection.edges)) {
    return {
      ok: false,
      outcome: "error",
      complete: false,
      hasMoreBeyondScanWindow: false,
      scannedCount: 0,
      verifiedSavedCount: 0,
      hydratedCount: 0,
      idMismatchCount: 0,
      cachePublishErrorCount: 0,
      reason: "invalid_metaobjects_response",
      message:
        "Shopify GraphQL did not return a valid metaobjects connection during durable report hydration.",
    };
  }

  const edges = connection.edges;
  const hasMoreBeyondScanWindow = Boolean(connection.pageInfo?.hasNextPage);

  let scannedCount = 0;
  let verifiedSavedCount = 0;
  let hydratedCount = 0;
  let idMismatchCount = 0;
  let cachePublishErrorCount = 0;

  // Iterate oldest-to-newest among the fetched slice so newest entries stay
  // retained if manual shop cache capacity limits are ever approached.
  for (let i = edges.length - 1; i >= 0; i -= 1) {
    const node = edges[i]?.node;
    if (
      !node ||
      typeof node.id !== "string" ||
      node.type !== RESEARCH_METAOBJECT_TYPE
    ) {
      continue;
    }
    scannedCount += 1;

    const f = mapNodeFieldsToObject(node.fields);
    const rawSavedField = f[SAVED_REPORT_FIELD_KEY];
    if (isSavedReportFieldGenuinelyEmpty(rawSavedField)) {
      continue;
    }

    const parsedSaved = parseSavedReportField(rawSavedField);
    if (!parsedSaved.present || !parsedSaved.valid) {
      // Unverified or malformed savedReportJson is never hydrated into Sidekick cache.
      continue;
    }

    const envelopeMetaId =
      typeof parsedSaved.envelope?.metaobjectId === "string"
        ? parsedSaved.envelope.metaobjectId.trim()
        : "";
    if (envelopeMetaId && envelopeMetaId !== node.id) {
      // Guard against cross-record copy/paste mismatches.
      idMismatchCount += 1;
      continue;
    }

    verifiedSavedCount += 1;

    const metaFieldReportId =
      typeof f.reportId === "string" && f.reportId.trim()
        ? f.reportId.trim()
        : null;
    const envelopeReportId =
      typeof parsedSaved.envelope?.reportId === "string" &&
      parsedSaved.envelope.reportId.trim()
        ? parsedSaved.envelope.reportId.trim()
        : null;

    if (
      metaFieldReportId &&
      envelopeReportId &&
      metaFieldReportId !== envelopeReportId
    ) {
      idMismatchCount += 1;
      continue;
    }

    const expectedDurableReportId = envelopeReportId || metaFieldReportId || null;

    const pubResult = publishGroundedResearchToTelemetryCache({
      shop: normalizedShop,
      metaobjectId: node.id,
      requestKey:
        (typeof f.requestKey === "string" && f.requestKey.trim()) ||
        parsedSaved.envelope?.requestKey ||
        null,
      query:
        (typeof f.query === "string" && f.query.trim()) ||
        parsedSaved.envelope?.query ||
        "",
      executedAt:
        (typeof f.executedAt === "string" && f.executedAt.trim()) ||
        parsedSaved.envelope?.executedAt ||
        parsedSaved.reportObject?.execution?.executedAt ||
        null,
      reportObject: parsedSaved.reportObject,
      reportFullTextJson: parsedSaved.reportFullTextJson,
      expectedReportId: expectedDurableReportId,
    });

    if (pubResult.ok) {
      hydratedCount += 1;
    } else if (pubResult.code === "republished_report_id_mismatch") {
      idMismatchCount += 1;
    } else {
      cachePublishErrorCount += 1;
    }
  }

  const fullyHydratedScannedSet =
    idMismatchCount === 0 && cachePublishErrorCount === 0;
  const isCleanComplete = !hasMoreBeyondScanWindow && fullyHydratedScannedSet;

  let outcome = "clean_complete";
  let reason = "hydrated_all_available_records";
  let message = `Scanned ${scannedCount} research request(s); hydrated ${hydratedCount} verified saved report(s) into 30-minute RAM.`;

  if (!fullyHydratedScannedSet) {
    outcome = "partial";
    reason =
      idMismatchCount > 0
        ? "saved_report_id_mismatch_skipped"
        : "cache_publish_partial_failure";
    message = `Scanned ${scannedCount} research request(s); hydrated ${hydratedCount} of ${verifiedSavedCount} verified saved report(s) (${idMismatchCount} ID mismatch skipped, ${cachePublishErrorCount} cache publish error).`;
  } else if (hasMoreBeyondScanWindow) {
    outcome = "partial";
    reason = "scan_page_cap_reached";
    message = `Scanned newest ${scannedCount} research request(s) (hydrated ${hydratedCount}); older requests exist beyond the ${HYDRATION_SCAN_PAGE_LIMIT}-item hydration window.`;
  }

  return {
    ok: true,
    outcome,
    complete: isCleanComplete,
    hasMoreBeyondScanWindow,
    scannedCount,
    verifiedSavedCount,
    hydratedCount,
    idMismatchCount,
    cachePublishErrorCount,
    reason,
    message,
  };
}

/**
 * Hydrates verified durable savedReportJson answers from Shopify into the
 * 30-minute process RAM cache under strict shop isolation.
 * Uses per-shop single-flight coalescing and a bounded caller wait timer while
 * safely handling late background completion or errors without unhandled
 * rejections.
 *
 * Returned `outcome` values:
 * - "clean_complete" : All research records for this shop were scanned and all
 *                      verified durable answers were published cleanly.
 * - "partial"        : Hydration succeeded for scanned items, but older records
 *                      exist beyond HYDRATION_SCAN_PAGE_LIMIT or an item had an
 *                      ID mismatch / cache cap skip. Never infer global absence.
 * - "timed_out"      : Caller wait budget elapsed while background GraphQL read
 *                      is still running. Never return false not_found.
 * - "error"          : Admin client missing or Shopify GraphQL read failed.
 */
export async function hydrateDurableResearchReportsToCache({
  admin,
  shop,
  waitBudgetMs = DEFAULT_HYDRATION_WAIT_BUDGET_MS,
} = {}) {
  const normalizedShop =
    typeof shop === "string" ? shop.trim().toLowerCase() : "";
  if (!normalizedShop) {
    return {
      ok: false,
      outcome: "error",
      complete: false,
      hasMoreBeyondScanWindow: false,
      scannedCount: 0,
      verifiedSavedCount: 0,
      hydratedCount: 0,
      idMismatchCount: 0,
      cachePublishErrorCount: 0,
      reason: "invalid_shop",
      message:
        "Authenticated shop identity is required for durable report hydration.",
    };
  }

  if (!admin || typeof admin.graphql !== "function") {
    return {
      ok: false,
      outcome: "error",
      complete: false,
      hasMoreBeyondScanWindow: false,
      scannedCount: 0,
      verifiedSavedCount: 0,
      hydratedCount: 0,
      idMismatchCount: 0,
      cachePublishErrorCount: 0,
      reason: "missing_admin_graphql_client",
      message:
        "Shopify Admin GraphQL client was unavailable during cold report hydration.",
    };
  }

  const boundedWaitMs =
    typeof waitBudgetMs === "number" && Number.isFinite(waitBudgetMs)
      ? Math.min(
          Math.max(Math.trunc(waitBudgetMs), MIN_HYDRATION_WAIT_BUDGET_MS),
          MAX_HYDRATION_WAIT_BUDGET_MS
        )
      : DEFAULT_HYDRATION_WAIT_BUDGET_MS;

  const coord = getHydrationCoordinatorState();
  const nowMs = Date.now();
  const lastCleanEmptyMs = coord.lastCleanEmptyAtMsByShop.get(normalizedShop);

  if (
    !coord.inFlightByShop.has(normalizedShop) &&
    typeof lastCleanEmptyMs === "number" &&
    nowMs - lastCleanEmptyMs < HYDRATION_CLEAN_EMPTY_COOLDOWN_MS
  ) {
    return {
      ok: true,
      outcome: "clean_complete",
      complete: true,
      hasMoreBeyondScanWindow: false,
      scannedCount: 0,
      verifiedSavedCount: 0,
      hydratedCount: 0,
      idMismatchCount: 0,
      cachePublishErrorCount: 0,
      reason: "recent_clean_empty_cooldown",
      message:
        "Shop durable research list was verified empty within the last 5 seconds.",
    };
  }

  let sharedPromise = coord.inFlightByShop.get(normalizedShop);
  if (!sharedPromise) {
    sharedPromise = (async () => {
      try {
        const passResult = await runSingleShopDurableHydrationPass(
          admin,
          normalizedShop
        );
        if (
          passResult.ok &&
          passResult.outcome === "clean_complete" &&
          passResult.verifiedSavedCount === 0
        ) {
          coord.lastCleanEmptyAtMsByShop.set(normalizedShop, Date.now());
        } else {
          coord.lastCleanEmptyAtMsByShop.delete(normalizedShop);
        }
        return passResult;
      } catch (err) {
        coord.lastCleanEmptyAtMsByShop.delete(normalizedShop);
        const safeMsg =
          err instanceof Error && err.message
            ? err.message.slice(0, 240)
            : "Unexpected error during durable report hydration.";
        return {
          ok: false,
          outcome: "error",
          complete: false,
          hasMoreBeyondScanWindow: false,
          scannedCount: 0,
          verifiedSavedCount: 0,
          hydratedCount: 0,
          idMismatchCount: 0,
          cachePublishErrorCount: 0,
          reason: "hydration_exception",
          message: safeMsg,
        };
      } finally {
        if (coord.inFlightByShop.get(normalizedShop) === sharedPromise) {
          coord.inFlightByShop.delete(normalizedShop);
        }
      }
    })();

    coord.inFlightByShop.set(normalizedShop, sharedPromise);
  }

  let timerId = null;
  const timeoutSentinel = Symbol("hydration_wait_timeout");

  try {
    const raced = await Promise.race([
      sharedPromise,
      new Promise((resolve) => {
        timerId = setTimeout(() => resolve(timeoutSentinel), boundedWaitMs);
      }),
    ]);

    if (raced === timeoutSentinel) {
      return {
        ok: false,
        outcome: "timed_out",
        complete: false,
        hasMoreBeyondScanWindow: false,
        scannedCount: 0,
        verifiedSavedCount: 0,
        hydratedCount: 0,
        idMismatchCount: 0,
        cachePublishErrorCount: 0,
        reason: "hydration_wait_budget_exceeded",
        message: `Durable Shopify report hydration exceeded the ${boundedWaitMs}ms caller wait budget; background warm-up continues safely for this shop.`,
      };
    }

    return raced;
  } finally {
    if (timerId !== null) {
      clearTimeout(timerId);
    }
  }
}

/**
 * Builds the lossless durable envelope without dropping searchEntryPointHtml,
 * citation-span metadata, source entries, or safe provenance/attachment metadata,
 * and checks the 120,000 UTF-8 byte ceiling.
 */
export function buildDurableSavedReportEnvelope({
  metaobjectId,
  requestKey = null,
  query = "",
  constraints = null,
  executedAt = null,
  reportId = null,
  reportObject = null,
  reportFullTextJson = null,
  searchEntryPointHtml = null,
}) {
  const resolvedReportObject = isPlainObject(reportObject)
    ? reportObject
    : parseReportObjectFromRawJson(reportFullTextJson);

  const reportValidation =
    validateCompleteGroundedReportObject(resolvedReportObject);
  if (!reportValidation.ok) {
    return {
      ok: false,
      withinByteCeiling: false,
      code: reportValidation.code,
      message: reportValidation.message,
      utf8Bytes: 0,
      serializedJson: null,
      envelope: null,
    };
  }

  const normalizedSearchHtml =
    typeof searchEntryPointHtml === "string" &&
    searchEntryPointHtml.trim().length > 0
      ? searchEntryPointHtml
      : null;

  const envelope = {
    durableSchemaVersion: SAVED_REPORT_SCHEMA_VERSION,
    mode: GEMINI_GROUNDED_RESEARCH_MODE,
    metaobjectId: typeof metaobjectId === "string" ? metaobjectId.trim() : "",
    reportId:
      typeof reportId === "string" && reportId.trim() ? reportId.trim() : null,
    requestKey:
      typeof resolvedReportObject?.request?.requestKey === "string" &&
      resolvedReportObject.request.requestKey.trim()
        ? resolvedReportObject.request.requestKey.trim()
        : typeof requestKey === "string" && requestKey.trim()
          ? requestKey.trim()
          : null,
    query:
      typeof resolvedReportObject?.request?.query === "string" &&
      resolvedReportObject.request.query.trim()
        ? resolvedReportObject.request.query.trim()
        : typeof query === "string" && query.trim()
          ? query.trim()
          : "",
    constraints:
      typeof resolvedReportObject?.request?.constraints === "string" &&
      resolvedReportObject.request.constraints.trim()
        ? resolvedReportObject.request.constraints.trim()
        : typeof constraints === "string" && constraints.trim()
          ? constraints.trim()
          : null,
    executedAt:
      parseStrictIsoTimestampString(resolvedReportObject?.execution?.executedAt) ||
      parseStrictIsoTimestampString(executedAt) ||
      null,
    searchEntryPointHtml: normalizedSearchHtml,
    reportObject: resolvedReportObject,
  };

  let serializedJson = "";
  try {
    serializedJson = JSON.stringify(envelope);
  } catch {
    return {
      ok: false,
      withinByteCeiling: false,
      code: "durable_serialization_failed",
      message: "Failed to serialize intact grounded report envelope to JSON.",
      utf8Bytes: 0,
      serializedJson: null,
      envelope: null,
    };
  }

  const utf8Bytes = utf8ByteLength(serializedJson);
  if (utf8Bytes > MAX_SAVED_REPORT_UTF8_BYTES) {
    return {
      ok: false,
      withinByteCeiling: false,
      code: "exceeds_durable_byte_ceiling",
      message: `Complete intact grounded report is ${utf8Bytes} UTF-8 bytes, exceeding the ${MAX_SAVED_REPORT_UTF8_BYTES}-byte Shopify JSON ceiling. Report was preserved intact in RAM without truncation.`,
      utf8Bytes,
      serializedJson: null,
      envelope,
    };
  }

  return {
    ok: true,
    withinByteCeiling: true,
    code: "ready_for_durable_write",
    message: `Complete intact grounded report serialized (${utf8Bytes} UTF-8 bytes <= ${MAX_SAVED_REPORT_UTF8_BYTES}).`,
    utf8Bytes,
    serializedJson,
    envelope,
  };
}

function normalizeSourceProjection(sourcesArray) {
  if (!Array.isArray(sourcesArray)) {
    return [];
  }
  return sourcesArray.map((item) => ({
    chunkIndex: typeof item?.chunkIndex === "number" ? item.chunkIndex : null,
    sourceType: typeof item?.sourceType === "string" ? item.sourceType : null,
    usableWebSource: Boolean(item?.usableWebSource),
    uri: typeof item?.uri === "string" ? item.uri : null,
    title: typeof item?.title === "string" ? item.title : null,
    untrustedExternalSource: Boolean(item?.untrustedExternalSource),
  }));
}

function normalizeSpanProjection(spansArray) {
  if (!Array.isArray(spansArray)) {
    return [];
  }
  return spansArray.map((span) => ({
    supportIndex:
      typeof span?.supportIndex === "number" ? span.supportIndex : null,
    spanClassification:
      typeof span?.spanClassification === "string"
        ? span.spanClassification
        : null,
    isVerbatimSourceQuotation: Boolean(span?.isVerbatimSourceQuotation),
    modelAnswerSpanText:
      typeof span?.modelAnswerSpanText === "string"
        ? span.modelAnswerSpanText
        : null,
    spanTextResolution:
      typeof span?.spanTextResolution === "string"
        ? span.spanTextResolution
        : null,
    partIndex: typeof span?.partIndex === "number" ? span.partIndex : null,
    utf8StartByteOffset:
      typeof span?.utf8StartByteOffset === "number"
        ? span.utf8StartByteOffset
        : null,
    utf8EndByteOffset:
      typeof span?.utf8EndByteOffset === "number"
        ? span.utf8EndByteOffset
        : null,
    groundingChunkIndices: Array.isArray(span?.groundingChunkIndices)
      ? [...span.groundingChunkIndices]
      : [],
    nonWebOrUnusableChunkIndices: Array.isArray(
      span?.nonWebOrUnusableChunkIndices
    )
      ? [...span.nonWebOrUnusableChunkIndices]
      : [],
  }));
}

/**
 * Parses a raw savedReportJson value from a Shopify metaobject field and
 * validates that its grounded report content is structurally complete.
 * Explicitly flags unexpected non-string nonempty values as present=true,
 * valid=false so they are never treated as empty/runnable.
 */
export function parseSavedReportField(rawFieldValue) {
  if (rawFieldValue === undefined || rawFieldValue === null) {
    return {
      present: false,
      valid: false,
      code: "empty_saved_report_field",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  if (typeof rawFieldValue !== "string") {
    return {
      present: true,
      valid: false,
      code: "unexpected_non_string_saved_report",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  if (rawFieldValue.trim().length === 0) {
    return {
      present: false,
      valid: false,
      code: "empty_saved_report_field",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  let parsed = null;
  try {
    parsed = JSON.parse(rawFieldValue);
  } catch {
    return {
      present: true,
      valid: false,
      code: "malformed_saved_report_json",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      present: true,
      valid: false,
      code: "saved_report_not_object",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  const candidateReportObj = isPlainObject(parsed.reportObject)
    ? parsed.reportObject
    : parsed.reportKind === GEMINI_GROUNDED_RESEARCH_MODE
      ? parsed
      : null;

  const check = validateCompleteGroundedReportObject(candidateReportObj);
  if (!check.ok) {
    return {
      present: true,
      valid: false,
      code: check.code,
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  const resolvedExecutedAt =
    parseStrictIsoTimestampString(candidateReportObj?.execution?.executedAt) ||
    (isPlainObject(parsed.reportObject)
      ? parseStrictIsoTimestampString(parsed.executedAt)
      : null);

  if (!resolvedExecutedAt) {
    return {
      present: true,
      valid: false,
      code: "missing_valid_executed_at",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  let prettyReportFullTextJson = null;
  try {
    prettyReportFullTextJson = JSON.stringify(candidateReportObj, null, 2);
  } catch {
    return {
      present: true,
      valid: false,
      code: "report_reformat_failed",
      envelope: null,
      reportObject: null,
      reportFullTextJson: null,
    };
  }

  const normalizedEnvelope = isPlainObject(parsed.reportObject)
    ? {
        ...parsed,
        executedAt: resolvedExecutedAt,
      }
    : {
        durableSchemaVersion: SAVED_REPORT_SCHEMA_VERSION,
        mode: GEMINI_GROUNDED_RESEARCH_MODE,
        metaobjectId: "",
        reportId: null,
        requestKey: candidateReportObj?.request?.requestKey ?? null,
        query: candidateReportObj?.request?.query ?? "",
        constraints: candidateReportObj?.request?.constraints ?? null,
        executedAt: resolvedExecutedAt,
        searchEntryPointHtml: null,
        reportObject: candidateReportObj,
      };

  return {
    present: true,
    valid: true,
    code: "ok",
    envelope: normalizedEnvelope,
    reportObject: candidateReportObj,
    reportFullTextJson: prettyReportFullTextJson,
  };
}

/**
 * Verifies read-back savedReportJson content against the exact submitted
 * envelope across synthesis answer, every source URI/title/index, every
 * citation span mapping, webSearchQueries, searchEntryPointHtml, expected
 * reportId/metaobjectId, and full canonical reportObject digest (including
 * any contextProvenance and inputAttachments metadata).
 */
export function verifySavedReportReadback(expectedEnvelope, rawReadbackString) {
  if (
    !isPlainObject(expectedEnvelope) ||
    !isPlainObject(expectedEnvelope.reportObject)
  ) {
    return {
      verified: false,
      code: "missing_expected_envelope",
      message: "Expected report envelope was missing during readback check.",
    };
  }

  const parsedReadback = parseSavedReportField(rawReadbackString);
  if (!parsedReadback.present) {
    return {
      verified: false,
      code: "saved_report_missing_on_readback",
      message:
        'Readback did not return "savedReportJson". Confirm the "savedReportJson" (JSON) field exists on the "sidekick_research_request" metaobject definition in Shopify Admin.',
    };
  }

  if (!parsedReadback.valid) {
    return {
      verified: false,
      code: parsedReadback.code,
      message: `Readback "savedReportJson" failed integrity parsing (${parsedReadback.code}).`,
    };
  }

  const expectedReport = expectedEnvelope.reportObject;
  const actualEnvelope = parsedReadback.envelope;
  const actualReport = parsedReadback.reportObject;

  const expectedMetaId =
    typeof expectedEnvelope.metaobjectId === "string"
      ? expectedEnvelope.metaobjectId.trim()
      : "";
  const actualMetaId =
    typeof actualEnvelope.metaobjectId === "string"
      ? actualEnvelope.metaobjectId.trim()
      : "";
  if (expectedMetaId && actualMetaId !== expectedMetaId) {
    return {
      verified: false,
      code: "metaobject_id_mismatch_on_readback",
      message:
        "Readback envelope metaobjectId did not match submitted metaobjectId.",
    };
  }

  const expectedReportId =
    typeof expectedEnvelope.reportId === "string" &&
    expectedEnvelope.reportId.trim()
      ? expectedEnvelope.reportId.trim()
      : null;
  const actualReportId =
    typeof actualEnvelope.reportId === "string" && actualEnvelope.reportId.trim()
      ? actualEnvelope.reportId.trim()
      : null;
  if (expectedReportId !== actualReportId) {
    return {
      verified: false,
      code: "report_id_mismatch_on_readback",
      message: "Readback envelope reportId did not match submitted reportId.",
    };
  }

  if (expectedReport.modelSynthesisAnswer !== actualReport.modelSynthesisAnswer) {
    return {
      verified: false,
      code: "answer_mismatch_on_readback",
      message:
        "Readback modelSynthesisAnswer did not match the submitted answer byte-for-byte.",
    };
  }

  const expectedSourcesHash = sha256CanonicalJson(
    normalizeSourceProjection(expectedReport.sourcesByOriginalChunkIndex)
  );
  const actualSourcesHash = sha256CanonicalJson(
    normalizeSourceProjection(actualReport.sourcesByOriginalChunkIndex)
  );
  if (expectedSourcesHash !== actualSourcesHash) {
    return {
      verified: false,
      code: "sources_mismatch_on_readback",
      message:
        "Readback sourcesByOriginalChunkIndex identities, URIs, or titles did not match submitted sources.",
    };
  }

  const expectedSpansHash = sha256CanonicalJson(
    normalizeSpanProjection(expectedReport.modelAnswerSpanAttributions)
  );
  const actualSpansHash = sha256CanonicalJson(
    normalizeSpanProjection(actualReport.modelAnswerSpanAttributions)
  );
  if (expectedSpansHash !== actualSpansHash) {
    return {
      verified: false,
      code: "spans_mismatch_on_readback",
      message:
        "Readback modelAnswerSpanAttributions did not match submitted citation-span metadata.",
    };
  }

  const expectedQueriesHash = sha256CanonicalJson(
    expectedReport.webSearchQueries || []
  );
  const actualQueriesHash = sha256CanonicalJson(
    actualReport.webSearchQueries || []
  );
  if (expectedQueriesHash !== actualQueriesHash) {
    return {
      verified: false,
      code: "search_queries_mismatch_on_readback",
      message: "Readback webSearchQueries did not match submitted search queries.",
    };
  }

  const expectedHtml = expectedEnvelope.searchEntryPointHtml ?? null;
  const actualHtml = actualEnvelope.searchEntryPointHtml ?? null;
  if (expectedHtml !== actualHtml) {
    return {
      verified: false,
      code: "search_entry_point_mismatch_on_readback",
      message:
        "Readback searchEntryPointHtml did not match submitted provider HTML.",
    };
  }

  const fullExpectedHash = sha256CanonicalJson(expectedReport);
  const fullActualHash = sha256CanonicalJson(actualReport);
  if (fullExpectedHash !== fullActualHash) {
    return {
      verified: false,
      code: "report_object_digest_mismatch",
      message:
        "Readback reportObject canonical digest differed from submitted report.",
    };
  }

  return {
    verified: true,
    code: "verified_exact_match",
    message:
      "Readback verified exact answer, sources, citation spans, and metadata.",
  };
}

function isMissingSavedReportFieldDefinitionError(rawErrorMessage) {
  if (typeof rawErrorMessage !== "string" || !rawErrorMessage.trim()) {
    return false;
  }
  const msg = rawErrorMessage.toLowerCase();
  return (
    msg.includes(SAVED_REPORT_FIELD_KEY.toLowerCase()) &&
    (msg.includes("does not exist") ||
      msg.includes("not defined") ||
      msg.includes("unknown field") ||
      msg.includes("invalid") ||
      msg.includes("field definition"))
  );
}

/**
 * Persists metadata + complete intact savedReportJson (when <= 120,000 bytes)
 * using the caller's existing updateMetaobjectFields and readMetaobjectById
 * callbacks, without authoring or altering any Admin GraphQL mutations.
 *
 * If "savedReportJson" is not yet added to the Shopify metaobject definition,
 * safely falls back to updating the existing metadata fields so the run result
 * metadata is still recorded while flagging durablySaved = false.
 */
export async function writeAndVerifyDurableResearchReport({
  admin,
  metaobjectId,
  baseMetadataFields = {},
  envelopeResult,
  readMetaobjectById,
  updateMetaobjectFields,
}) {
  if (
    typeof readMetaobjectById !== "function" ||
    typeof updateMetaobjectFields !== "function"
  ) {
    return {
      metadataWriteOk: false,
      durablySaved: false,
      durableStateCode: "missing_injected_callbacks",
      statusWritten: null,
      message:
        "Internal configuration error: read/write metaobject callbacks were not supplied.",
    };
  }

  // Case 1: Report exceeded 120,000 UTF-8 bytes or failed envelope packaging.
  // Never truncate; write metadata only and mark completed_oversize_unsaved.
  if (!envelopeResult || !envelopeResult.ok || !envelopeResult.withinByteCeiling) {
    const isOversize =
      envelopeResult?.code === "exceeds_durable_byte_ceiling";
    const fallbackStatus = isOversize
      ? "completed_oversize_unsaved"
      : baseMetadataFields.status || "completed_unsaved";
    const oversizeNotice =
      envelopeResult?.message ||
      "Complete report could not be packaged for durable Shopify storage; held in 30-minute RAM.";

    const combinedErrorDetail = [
      baseMetadataFields.errorDetail || "",
      oversizeNotice,
    ]
      .map((s) => String(s).trim())
      .filter(Boolean)
      .join(" | ");

    const metaOnlyWrite = await updateMetaobjectFields(admin, metaobjectId, {
      ...baseMetadataFields,
      status: fallbackStatus,
      errorDetail: combinedErrorDetail,
    });

    return {
      metadataWriteOk: Boolean(metaOnlyWrite?.ok),
      durablySaved: false,
      durableStateCode: envelopeResult?.code || "not_packaged",
      statusWritten: metaOnlyWrite?.ok ? fallbackStatus : null,
      utf8Bytes: envelopeResult?.utf8Bytes || 0,
      message: metaOnlyWrite?.ok
        ? oversizeNotice
        : `${oversizeNotice} Metadata update also failed (${metaOnlyWrite?.message || "unknown error"}).`,
    };
  }

  // Case 2: Within 120,000 bytes — attempt single write including savedReportJson.
  const fullWriteAttempt = await updateMetaobjectFields(admin, metaobjectId, {
    ...baseMetadataFields,
    [SAVED_REPORT_FIELD_KEY]: envelopeResult.serializedJson,
  });

  if (!fullWriteAttempt?.ok) {
    const errText =
      fullWriteAttempt?.message || "Unknown metaobjectUpdate error.";
    const missingSchemaField = isMissingSavedReportFieldDefinitionError(errText);

    // Fallback: record standard metadata fields without savedReportJson so
    // status/reportId/summary are not lost, while clearly marking unsaved.
    const fallbackStatus = missingSchemaField
      ? "completed_missing_save_field"
      : "completed_unsaved";
    const fallbackNotice = missingSchemaField
      ? `Add JSON field "${SAVED_REPORT_FIELD_KEY}" to "sidekick_research_request" in Shopify Admin to keep answers past 30 minutes, then click Retry Save.`
      : `Could not save durable report JSON (${errText}). Full answer remains in 30-minute server RAM.`;

    const fallbackWrite = await updateMetaobjectFields(admin, metaobjectId, {
      ...baseMetadataFields,
      status: fallbackStatus,
      errorDetail: [baseMetadataFields.errorDetail || "", fallbackNotice]
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join(" | "),
    });

    return {
      metadataWriteOk: Boolean(fallbackWrite?.ok),
      durablySaved: false,
      durableStateCode: missingSchemaField
        ? "missing_saved_report_schema_field"
        : "durable_write_failed",
      statusWritten: fallbackWrite?.ok ? fallbackStatus : null,
      utf8Bytes: envelopeResult.utf8Bytes,
      message: fallbackNotice,
    };
  }

  // Case 3: Write succeeded — perform fresh independent readback verification.
  const freshReadback = await readMetaobjectById(admin, metaobjectId);
  if (!freshReadback?.ok || !isPlainObject(freshReadback.fields)) {
    return {
      metadataWriteOk: true,
      durablySaved: false,
      durableStateCode: "readback_query_failed",
      statusWritten: baseMetadataFields.status || "completed",
      utf8Bytes: envelopeResult.utf8Bytes,
      message: `Report write returned OK, but fresh readback failed (${freshReadback?.message || "read error"}). Treat as not yet verified; use Copy Answer or Retry Save.`,
    };
  }

  const verification = verifySavedReportReadback(
    envelopeResult.envelope,
    freshReadback.fields[SAVED_REPORT_FIELD_KEY]
  );

  if (!verification.verified) {
    const unverifiedNotice = `Durable readback verification did not pass (${verification.code}): ${verification.message}`;
    await updateMetaobjectFields(admin, metaobjectId, {
      status: "completed_unverified_save",
      errorDetail: [baseMetadataFields.errorDetail || "", unverifiedNotice]
        .map((s) => String(s).trim())
        .filter(Boolean)
        .join(" | "),
    });

    return {
      metadataWriteOk: true,
      durablySaved: false,
      durableStateCode: verification.code,
      statusWritten: "completed_unverified_save",
      utf8Bytes: envelopeResult.utf8Bytes,
      message: unverifiedNotice,
    };
  }

  return {
    metadataWriteOk: true,
    durablySaved: true,
    durableStateCode: "verified_saved",
    statusWritten: baseMetadataFields.status || "completed",
    utf8Bytes: envelopeResult.utf8Bytes,
    message:
      "Answer and cited sources saved to Shopify and verified by exact readback.",
  };
}

/**
 * Formats a clean, plain-text answer + numbered source list + concise optional
 * attachment metadata and context provenance for Bob's one-click "Copy Answer"
 * button (works from either durable Shopify JSON or 30-minute server RAM vault,
 * and never includes raw image bytes or base64).
 */
export function buildPlainTextCopyBlock({
  query = "",
  executedAt = "",
  reportId = "",
  answerText = "",
  sources = [],
  contextSummary = null,
  attachmentsSummary = null,
}) {
  const lines = [];
  if (query) {
    lines.push(`QUESTION: ${query.trim()}`);
    lines.push("");
  }
  if (answerText) {
    lines.push(
      "ANSWER (Grounded Synthesis — Verify Critical Claims Against Sources):"
    );
    lines.push(answerText.trim());
    lines.push("");
  }
  const usableSources = Array.isArray(sources)
    ? sources.filter((s) => s && s.uri)
    : [];
  if (usableSources.length > 0) {
    lines.push("CITED WEB SOURCES:");
    for (let i = 0; i < usableSources.length; i += 1) {
      const src = usableSources[i];
      const idxLabel =
        typeof src.chunkIndex === "number" ? src.chunkIndex : i;
      const title =
        typeof src.title === "string" && src.title.trim()
          ? src.title.trim()
          : "Web source";
      lines.push(`[${idxLabel}] ${title} — ${src.uri}`);
    }
    lines.push("");
  }

  if (
    isPlainObject(attachmentsSummary) &&
    attachmentsSummary.hasExplicitInputs === true
  ) {
    lines.push(
      "EXPLICIT INPUT ATTACHMENTS (Metadata Only — No Image Bytes Persisted):"
    );
    const pageRetrievals = Array.isArray(
      attachmentsSummary.publicPageUrlRetrievals
    )
      ? attachmentsSummary.publicPageUrlRetrievals
      : [];
    for (let i = 0; i < pageRetrievals.length; i += 1) {
      const p = pageRetrievals[i];
      if (isPlainObject(p)) {
        lines.push(
          `[Page ${i + 1}] ${p.retrievedUrl || "(unspecified URL)"} — ${p.retrievalStatus || "unknown"}`
        );
      }
    }
    const imgs = Array.isArray(attachmentsSummary.imageAttachments)
      ? attachmentsSummary.imageAttachments
      : [];
    for (let i = 0; i < imgs.length; i += 1) {
      const img = imgs[i];
      if (isPlainObject(img)) {
        const idx =
          typeof img.attachmentIndex === "number" ? img.attachmentIndex + 1 : i + 1;
        const shortHash =
          typeof img.sha256 === "string" && img.sha256.length >= 12
            ? `, sha256:${img.sha256.slice(0, 12)}`
            : "";
        lines.push(
          `[Image ${idx}] ${img.url || "(unspecified image URL)"} (${img.mimeType || "image"}, ${img.byteLength || 0} bytes${shortHash})`
        );
      }
    }
    lines.push("");
  }

  if (
    isPlainObject(contextSummary) &&
    contextSummary.recorded === true &&
    typeof contextSummary.summaryLine === "string" &&
    contextSummary.summaryLine.trim()
  ) {
    lines.push(contextSummary.summaryLine.trim());
    lines.push("");
  }

  const footerParts = [];
  if (reportId) footerParts.push(`Report ID: ${reportId}`);
  if (executedAt) footerParts.push(`Executed: ${executedAt}`);
  if (footerParts.length > 0) {
    lines.push(footerParts.join(" | "));
  }
  return lines.join("\n").trim();
}

function extractUsableSourcesFromReportObject(reportObj) {
  if (
    !isPlainObject(reportObj) ||
    !Array.isArray(reportObj.sourcesByOriginalChunkIndex)
  ) {
    return [];
  }
  return reportObj.sourcesByOriginalChunkIndex
    .filter(
      (c) => c && c.usableWebSource && typeof c.uri === "string" && c.uri.trim()
    )
    .map((c) => ({
      chunkIndex: c.chunkIndex,
      title: c.title || "Untitled web source",
      uri: c.uri,
    }));
}

function composeTechnicalGroundingSummaryLine({
  rawGroundingSummary,
  contextSummary,
  attachmentsSummary,
}) {
  const base =
    typeof rawGroundingSummary === "string" ? rawGroundingSummary.trim() : "";
  const extraParts = [];

  if (
    isPlainObject(attachmentsSummary) &&
    attachmentsSummary.hasExplicitInputs === true &&
    typeof attachmentsSummary.summaryLine === "string" &&
    attachmentsSummary.summaryLine.trim() &&
    !base.includes("Explicit Inputs:")
  ) {
    extraParts.push(attachmentsSummary.summaryLine.trim());
  }

  if (
    isPlainObject(contextSummary) &&
    contextSummary.recorded === true &&
    typeof contextSummary.summaryLine === "string" &&
    contextSummary.summaryLine.trim() &&
    !base.includes("Context:")
  ) {
    extraParts.push(contextSummary.summaryLine.trim());
  }

  if (!base && extraParts.length === 0) {
    return null;
  }
  if (!base) {
    return extraParts.join(" | ");
  }
  if (extraParts.length === 0) {
    return base;
  }
  return `${base} | ${extraParts.join(" | ")}`;
}

/**
 * Maps raw Shopify metaobject fields + optional 30-minute server repair-vault
 * snapshot + live RAM cache readability into a calm, dyslexia-friendly view
 * model for SidekickQueueCalmView.jsx, while keeping completed-but-unsaved
 * states and invalid/unverified saved data strictly non-runnable.
 */
export function buildCalmResearchCardModel({
  id,
  updatedAt = null,
  rawFields = {},
  cacheReadableNow = false,
  vaultSnapshot = null,
  fullVaultReportJson = null,
}) {
  const f = isPlainObject(rawFields) ? rawFields : {};
  const shortId = typeof id === "string" ? id.split("/").pop() : "";
  const requestKey = String(f.requestKey || "").trim();
  const query = String(f.query || "").trim();
  const constraints = String(f.constraints || "").trim();
  const rawStatus = String(f.status || "").trim().toLowerCase() || "queued";
  const claimId = String(f.claimId || "").trim();

  // Inspect durable savedReportJson field FIRST so any nonempty value (valid or
  // invalid) immediately blocks paid re-execution.
  const parsedDurable = parseSavedReportField(f[SAVED_REPORT_FIELD_KEY]);
  const hasAnySavedReportData = parsedDurable.present;
  const hasCorruptOrUnverifiedSavedField =
    parsedDurable.present && !parsedDurable.valid;

  const envelopeMetaId =
    parsedDurable.valid && typeof parsedDurable.envelope?.metaobjectId === "string"
      ? parsedDurable.envelope.metaobjectId.trim()
      : "";
  const fieldReportId = String(f.reportId || "").trim() || null;
  const envelopeReportId =
    parsedDurable.valid &&
    typeof parsedDurable.envelope?.reportId === "string" &&
    parsedDurable.envelope.reportId.trim()
      ? parsedDurable.envelope.reportId.trim()
      : null;

  const hasEnvelopeIdentityMismatch = Boolean(
    parsedDurable.valid &&
      ((envelopeMetaId && id && envelopeMetaId !== id) ||
        (fieldReportId && envelopeReportId && fieldReportId !== envelopeReportId))
  );

  const hasVerifiedDurableReport =
    parsedDurable.present &&
    parsedDurable.valid &&
    !hasEnvelopeIdentityMismatch &&
    rawStatus !== "completed_unverified_save";

  const reportId =
    fieldReportId || envelopeReportId || vaultSnapshot?.reportId || null;
  const executedAt =
    String(f.executedAt || "").trim() ||
    parsedDurable.envelope?.executedAt ||
    vaultSnapshot?.executedAt ||
    "";
  const groundingSummary = String(f.groundingSummary || "").trim();
  const errorDetail = String(f.errorDetail || "").trim();

  // Inspect server RAM vault fallback if verified durable save is absent
  const parsedVaultObj = !hasVerifiedDurableReport
    ? parseReportObjectFromRawJson(fullVaultReportJson)
    : null;
  const hasFullVaultReport = Boolean(
    validateCompleteGroundedReportObject(parsedVaultObj).ok
  );

  const activeReportObj = hasVerifiedDurableReport
    ? parsedDurable.reportObject
    : hasFullVaultReport
      ? parsedVaultObj
      : null;

  const contextSummary = extractContextProvenanceSummary(
    activeReportObj,
    vaultSnapshot
  );
  const attachmentsSummary = extractInputAttachmentsSummary(
    activeReportObj,
    vaultSnapshot
  );

  const executionModel =
    clampCleanSingleLine(
      activeReportObj?.execution?.providerModelVersion ||
        activeReportObj?.execution?.model,
      120,
      null
    ) || null;

  const fullAnswerText = activeReportObj
    ? activeReportObj.modelSynthesisAnswer
    : vaultSnapshot?.answerPreview || "";

  const isAnswerPreviewTruncated = Boolean(
    !activeReportObj &&
      vaultSnapshot?.answerPreview &&
      vaultSnapshot.answerPreview.length >= 900
  );

  const sources = activeReportObj
    ? extractUsableSourcesFromReportObject(activeReportObj)
    : Array.isArray(vaultSnapshot?.sources)
      ? vaultSnapshot.sources
      : [];

  const searchEntryPointHtml = hasVerifiedDurableReport
    ? parsedDurable.envelope?.searchEntryPointHtml ||
      vaultSnapshot?.searchEntryPointHtml ||
      null
    : vaultSnapshot?.searchEntryPointHtml || null;

  const webSearchQueries = activeReportObj
    ? activeReportObj.webSearchQueries || []
    : vaultSnapshot?.webSearchQueries || [];

  const copyPlainText = fullAnswerText
    ? buildPlainTextCopyBlock({
        query,
        executedAt,
        reportId: reportId || "",
        answerText: fullAnswerText,
        sources,
        contextSummary,
        attachmentsSummary,
      })
    : "";

  const effectiveTechnicalGroundingSummary = composeTechnicalGroundingSummaryLine(
    {
      rawGroundingSummary: groundingSummary,
      contextSummary,
      attachmentsSummary,
    }
  );

  const runEligibility = evaluateResearchRunEligibility(f);
  const isEligibleToRun =
    runEligibility.eligible &&
    !hasAnySavedReportData &&
    !vaultSnapshot &&
    !hasFullVaultReport;

  const isPreDispatchDraftWithInputIssue =
    !hasAnySavedReportData &&
    !vaultSnapshot &&
    !hasFullVaultReport &&
    !runEligibility.hasExecutionOrSaveEvidence &&
    (rawStatus === "queued" || rawStatus === "failed_pre_dispatch") &&
    !runEligibility.inputCheck.ok;

  const isCompletedWithoutVerifiedSave =
    !hasVerifiedDurableReport &&
    !hasCorruptOrUnverifiedSavedField &&
    !hasEnvelopeIdentityMismatch &&
    rawStatus !== "completed_unverified_save" &&
    (rawStatus.startsWith("completed") ||
      Boolean(vaultSnapshot) ||
      hasFullVaultReport);

  // Determine calm state & single clear primary action
  let calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
  let badgeLabel = "Needs Attention";
  let badgeTone = "critical";
  let statusHelperText = "";
  let primaryAction = null;
  let secondaryAction = null;

  if (rawStatus === "running") {
    calmState = CALM_CARD_STATES.RUNNING;
    badgeLabel = "Running...";
    badgeTone = "info";
    statusHelperText = "Searching public web sources now. Please wait.";
  } else if (hasVerifiedDurableReport) {
    calmState = CALM_CARD_STATES.ANSWER_SAVED;
    badgeLabel = cacheReadableNow
      ? "Answer Saved (Live for Sidekick)"
      : "Answer Saved";
    badgeTone = "success";
    statusHelperText = cacheReadableNow
      ? "Saved permanently in Shopify and active in 30-minute Sidekick cache."
      : "Saved permanently in Shopify. Copy anytime, or click Reload for Sidekick (zero cost).";
    primaryAction = {
      kind: "copy",
      label: "Copy Answer",
    };
    if (!cacheReadableNow || rawStatus !== "completed" || !fieldReportId) {
      secondaryAction = {
        kind: "republish",
        label: "Reload for Sidekick (Free)",
      };
    }
  } else if (
    hasCorruptOrUnverifiedSavedField ||
    hasEnvelopeIdentityMismatch ||
    rawStatus === "completed_unverified_save"
  ) {
    calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
    badgeLabel = "Saved Report Needs Check — Do Not Re-Run";
    badgeTone = "warning";
    statusHelperText = hasEnvelopeIdentityMismatch
      ? "Saved report ID or record ID did not match this request. Locked against duplicate paid runs; inspect Technical Details."
      : "Saved report JSON could not be verified intact. Locked against duplicate paid runs; copy available text or retry free save if still in 30-minute memory.";
    if (copyPlainText) {
      primaryAction = {
        kind: "copy",
        label: "Copy Answer",
      };
      if (hasFullVaultReport) {
        secondaryAction = {
          kind: "republish",
          label: "Retry Save from Memory (Free)",
        };
      }
    } else if (hasFullVaultReport) {
      primaryAction = {
        kind: "republish",
        label: "Retry Save from Memory (Free)",
      };
    }
  } else if (isCompletedWithoutVerifiedSave) {
    calmState = CALM_CARD_STATES.COMPLETED_NOT_SAVED;
    const hasRamCopyNow = Boolean(hasFullVaultReport || vaultSnapshot);

    if (rawStatus === "completed_oversize_unsaved") {
      badgeLabel = hasRamCopyNow
        ? "Completed — Over 120 KB (Copy Now)"
        : "Completed — Not Saved (RAM Expired)";
      badgeTone = hasRamCopyNow ? "attention" : "warning";
      statusHelperText = hasRamCopyNow
        ? "Answer is complete in temporary memory (too large for Shopify 120 KB field). Copy it now—do not lose it."
        : "Temporary 30-minute memory expired and report exceeded Shopify's 120 KB field limit.";
    } else if (hasRamCopyNow) {
      badgeLabel = "Completed — Not Saved Yet";
      badgeTone = "attention";
      statusHelperText =
        rawStatus === "completed_missing_save_field"
          ? 'Answer is in 30-minute memory. Click "Verify Research Definition" below (or add JSON field "savedReportJson" in Shopify Admin), then click Save Answer.'
          : "Answer is ready in 30-minute memory, but not permanently saved to Shopify yet.";
    } else {
      badgeLabel = "Completed Earlier (30-Min Memory Expired)";
      badgeTone = "warning";
      statusHelperText =
        "This search finished earlier before permanent Shopify answer saving was active. Summary is in Technical Details.";
    }

    if (copyPlainText) {
      primaryAction = {
        kind: "copy",
        label: "Copy Answer",
      };
      if (hasFullVaultReport && rawStatus !== "completed_oversize_unsaved") {
        secondaryAction = {
          kind: "republish",
          label: "Save Answer & Reload Cache (Free)",
        };
      } else if (hasFullVaultReport && !cacheReadableNow) {
        secondaryAction = {
          kind: "republish",
          label: "Reload for Sidekick (Free)",
        };
      }
    } else if (hasFullVaultReport) {
      primaryAction = {
        kind: "republish",
        label: "Save Answer & Reload Cache (Free)",
      };
    }
  } else if (isEligibleToRun) {
    calmState = CALM_CARD_STATES.READY_TO_RUN;
    badgeLabel = "Ready to Run";
    badgeTone = "warning";
    statusHelperText =
      rawStatus === "failed_pre_dispatch"
        ? "Inputs now pass checks (no API call was sent earlier). Click Run Research when ready."
        : "Reviewed in Shopify Admin. Click Run Research when ready.";
    primaryAction = {
      kind: "run",
      label: "Run Research",
    };
  } else if (isPreDispatchDraftWithInputIssue) {
    calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
    badgeLabel = LENGTH_INPUT_ERROR_CODES.has(runEligibility.inputCheck.code)
      ? "Edit Length in Admin First"
      : "Edit Input in Admin First";
    badgeTone = "warning";
    statusHelperText = buildPreDispatchInputHelperMessage(
      runEligibility.inputCheck
    );
  } else {
    calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
    badgeLabel =
      rawStatus === "uncertain_no_retry"
        ? "Timed Out — Do Not Auto-Retry"
        : "Stopped — Needs Check";
    badgeTone = "critical";
    statusHelperText =
      rawStatus === "uncertain_no_retry"
        ? "Connection dropped or timed out after sending. To prevent double charges, this record stays locked—create a new request if needed."
        : errorDetail ||
          "This request could not run. Open Technical Details for exact code.";
  }

  const durableDiagnosticCode = hasEnvelopeIdentityMismatch
    ? "envelope_identity_mismatch"
    : rawStatus === "completed_unverified_save" && parsedDurable.code === "ok"
      ? "marked_unverified_on_save"
      : parsedDurable.code;

  return {
    id,
    shortId,
    updatedAt,
    requestKey,
    query,
    constraints,
    rawStatus,
    calmState,
    badgeLabel,
    badgeTone,
    statusHelperText,
    durablySaved: hasVerifiedDurableReport,
    cacheReadableNow: Boolean(cacheReadableNow),
    hasRamVaultCopy: Boolean(hasFullVaultReport || vaultSnapshot),
    hasCompleteAnswerText: Boolean(activeReportObj),
    isAnswerPreviewTruncated,
    answerText: fullAnswerText,
    copyPlainText,
    sources,
    searchEntryPointHtml,
    webSearchQueries,
    primaryAction,
    secondaryAction,
    republishSourceReportJson: hasVerifiedDurableReport
      ? parsedDurable.reportFullTextJson
      : hasFullVaultReport
        ? fullVaultReportJson
        : null,
    technicalDetails: {
      metaobjectId: id,
      shortId,
      rawStatus,
      claimId: claimId || null,
      reportId,
      executedAt: executedAt || null,
      executionModel,
      durablySaved: hasVerifiedDurableReport,
      durableParseCode: durableDiagnosticCode,
      runEligibilityCode: runEligibility.code,
      cacheReadableNow: Boolean(cacheReadableNow),
      groundingSummary: effectiveTechnicalGroundingSummary,
      errorDetail: errorDetail || null,
      webSearchQueries,
      contextSnapshot: contextSummary,
      inputAttachments: attachmentsSummary,
    },
  };
}
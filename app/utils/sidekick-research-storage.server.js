// ============================================================================
// FILE: app/utils/sidekick-research-storage.server.js
// ROCKHOUND STUDIO — PURE SERVER RESEARCH STORAGE, READBACK & CALM-VIEW MAPPER
//
// Zero Admin GraphQL code, zero mutations, zero external network calls, and
// zero new npm dependencies. Works strictly through injected existing queue
// callbacks (readResearchMetaobjectById / updateResearchMetaobjectFields) and
// the existing RAM telemetry cache contracts.
//
// Core Guarantees:
// - Enforces a strict 120,000 UTF-8 byte ceiling on "savedReportJson".
// - Preserves 100% of the grounded report intact (modelSynthesisAnswer,
//   webSearchQueries, sourcesByOriginalChunkIndex, modelAnswerSpanAttributions,
//   and searchEntryPointHtml). NEVER strips citation spans or searchEntryPoint,
//   and NEVER silently truncates answers or sources.
// - If complete serialized payload exceeds 120,000 UTF-8 bytes, skips durable
//   Shopify field write, keeps the intact result in server RAM, and marks the
//   state explicitly as completed-but-not-durably-saved.
// - Requires a fresh readback via injected readMetaobjectById and byte-exact /
//   deep canonical verification of answer text, source identities, citation
//   spans, search queries, and searchEntryPoint HTML before reporting
//   durablySaved = true ("Answer Saved").
// - Never claims the "savedReportJson" metaobject field definition exists in
//   Shopify Admin until actual write + readback evidence proves it.
// - Never reruns paid Gemini research automatically.
// ============================================================================

import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { GEMINI_GROUNDED_RESEARCH_MODE } from "./gemini-grounded-research.server.js";

export const SAVED_REPORT_FIELD_KEY = "savedReportJson";
export const SAVED_REPORT_SCHEMA_VERSION = 1;
export const MAX_SAVED_REPORT_UTF8_BYTES = 120000;

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

/**
 * Validates that a reportObject contains the complete, unstripped grounded
 * structure produced by app/utils/gemini-grounded-research.server.js.
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

  return { ok: true };
}

/**
 * Builds the lossless durable envelope without dropping searchEntryPointHtml,
 * citation-span metadata, or source entries, and checks the 120,000 UTF-8 byte
 * ceiling.
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
      typeof requestKey === "string" && requestKey.trim()
        ? requestKey.trim()
        : resolvedReportObject?.request?.requestKey ?? null,
    query:
      typeof query === "string" && query.trim()
        ? query.trim()
        : resolvedReportObject?.request?.query ?? "",
    constraints:
      typeof constraints === "string" && constraints.trim()
        ? constraints.trim()
        : resolvedReportObject?.request?.constraints ?? null,
    executedAt:
      typeof executedAt === "string" && executedAt.trim()
        ? executedAt.trim()
        : resolvedReportObject?.execution?.executedAt ?? null,
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
 * Parses a raw savedReportJson string from a Shopify metaobject field and
 * validates that its grounded report content is structurally complete.
 */
export function parseSavedReportField(rawFieldValue) {
  if (typeof rawFieldValue !== "string" || rawFieldValue.trim().length === 0) {
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
    ? parsed
    : {
        durableSchemaVersion: SAVED_REPORT_SCHEMA_VERSION,
        mode: GEMINI_GROUNDED_RESEARCH_MODE,
        metaobjectId: "",
        reportId: null,
        requestKey: candidateReportObj?.request?.requestKey ?? null,
        query: candidateReportObj?.request?.query ?? "",
        constraints: candidateReportObj?.request?.constraints ?? null,
        executedAt: candidateReportObj?.execution?.executedAt ?? null,
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
 * citation span mapping, webSearchQueries, and searchEntryPointHtml.
 */
export function verifySavedReportReadback(expectedEnvelope, rawReadbackString) {
  if (!isPlainObject(expectedEnvelope) || !isPlainObject(expectedEnvelope.reportObject)) {
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

  if (expectedReport.modelSynthesisAnswer !== actualReport.modelSynthesisAnswer) {
    return {
      verified: false,
      code: "answer_mismatch_on_readback",
      message: "Readback modelSynthesisAnswer did not match the submitted answer byte-for-byte.",
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
      message: "Readback reportObject canonical digest differed from submitted report.",
    };
  }

  return {
    verified: true,
    code: "verified_exact_match",
    message: "Readback verified exact answer, sources, citation spans, and metadata.",
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
    const errText = fullWriteAttempt?.message || "Unknown metaobjectUpdate error.";
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
 * Formats a clean, plain-text answer + numbered source list for Bob's
 * one-click "Copy Answer" button (works from either durable Shopify JSON or
 * 30-minute server RAM vault).
 */
export function buildPlainTextCopyBlock({
  query = "",
  executedAt = "",
  reportId = "",
  answerText = "",
  sources = [],
}) {
  const lines = [];
  if (query) {
    lines.push(`QUESTION: ${query.trim()}`);
    lines.push("");
  }
  if (answerText) {
    lines.push("ANSWER (Grounded Synthesis — Verify Critical Claims Against Sources):");
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
  const footerParts = [];
  if (reportId) footerParts.push(`Report ID: ${reportId}`);
  if (executedAt) footerParts.push(`Executed: ${executedAt}`);
  if (footerParts.length > 0) {
    lines.push(footerParts.join(" | "));
  }
  return lines.join("\n").trim();
}

function extractUsableSourcesFromReportObject(reportObj) {
  if (!isPlainObject(reportObj) || !Array.isArray(reportObj.sourcesByOriginalChunkIndex)) {
    return [];
  }
  return reportObj.sourcesByOriginalChunkIndex
    .filter((c) => c && c.usableWebSource && typeof c.uri === "string" && c.uri.trim())
    .map((c) => ({
      chunkIndex: c.chunkIndex,
      title: c.title || "Untitled web source",
      uri: c.uri,
    }));
}

/**
 * Maps raw Shopify metaobject fields + optional 30-minute server repair-vault
 * snapshot + live RAM cache readability into a calm, dyslexia-friendly view
 * model for SidekickQueueCalmView.jsx, while keeping completed-but-unsaved
 * states strictly distinct from research failures.
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
  const reportId =
    String(f.reportId || "").trim() || vaultSnapshot?.reportId || null;
  const executedAt =
    String(f.executedAt || "").trim() || vaultSnapshot?.executedAt || "";
  const groundingSummary = String(f.groundingSummary || "").trim();
  const errorDetail = String(f.errorDetail || "").trim();

  // Inspect durable savedReportJson field if present on the Shopify record
  const parsedDurable = parseSavedReportField(f[SAVED_REPORT_FIELD_KEY]);
  const hasVerifiedDurableReport = parsedDurable.present && parsedDurable.valid;

  // Inspect server RAM vault fallback if durable save is absent
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
      })
    : "";

  const isEligibleToRun =
    rawStatus === "queued" && !claimId && !executedAt && !reportId;

  const isCompletedStatus =
    rawStatus.startsWith("completed") ||
    hasVerifiedDurableReport ||
    Boolean(vaultSnapshot);

  // Determine calm state & single clear primary action
  let calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
  let badgeLabel = "Needs Attention";
  let badgeTone = "critical";
  let statusHelperText = "";
  let primaryAction = null;
  let secondaryAction = null;

  if (isEligibleToRun) {
    calmState = CALM_CARD_STATES.READY_TO_RUN;
    badgeLabel = "Ready to Run";
    badgeTone = "warning";
    statusHelperText = "Reviewed in Shopify Admin. Click Run Research when ready.";
    primaryAction = {
      kind: "run",
      label: "Run Research",
    };
  } else if (rawStatus === "running") {
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
    if (!cacheReadableNow || rawStatus !== "completed" || !f.reportId) {
      secondaryAction = {
        kind: "republish",
        label: "Reload for Sidekick (Free)",
      };
    }
  } else if (isCompletedStatus) {
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
          ? 'Answer is in 30-minute memory. Add JSON field "savedReportJson" to Sidekick Research Request in Shopify Admin, then click Save Answer.'
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
  } else {
    calmState = CALM_CARD_STATES.NEEDS_ATTENTION;
    badgeLabel =
      rawStatus === "uncertain_no_retry"
        ? "Timed Out — Do Not Auto-Retry"
        : "Stopped — Needs Check";
    badgeTone = "critical";
    statusHelperText =
      rawStatus === "uncertain_no_retry"
        ? "Connection dropped after sending. To prevent double charges, it was not retried automatically."
        : errorDetail || "This request could not run. Open Technical Details for exact code.";
  }

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
      durablySaved: hasVerifiedDurableReport,
      durableParseCode: parsedDurable.code,
      cacheReadableNow: Boolean(cacheReadableNow),
      groundingSummary: groundingSummary || null,
      errorDetail: errorDetail || null,
      webSearchQueries,
    },
  };
}
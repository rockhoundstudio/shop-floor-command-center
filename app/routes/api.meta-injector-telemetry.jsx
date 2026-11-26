// FILE: app/routes/api.meta-injector-telemetry.jsx
import { Buffer } from "node:buffer";
import { authenticate } from "../shopify.server";
import { GEMINI_GROUNDED_RESEARCH_MODE } from "../utils/gemini-grounded-research.server.js";
import {
  storeTelemetryReport,
  listTelemetryReports,
  readTelemetryReport,
  ALLOWED_READ_SECTIONS,
  ALLOWED_READ_VIEWS,
} from "../utils/meta-injector.sidekick-report-cache.server.js";
import {
  hydrateDurableResearchReportsToCache,
  MIN_HYDRATION_WAIT_BUDGET_MS,
} from "../utils/sidekick-research-storage.server.js";

const MAX_POST_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_UTF8_BYTES = 3500;
const LIVE_BENCH_MODE = "live_bench_state";

// Extension caller (extensions/meta-injector-read-only/src/index.js) enforces a
// 4500ms total HTTP timeout. Deduct elapsed authentication/validation time and
// reserve headroom for post-hydration cache reads + JSON response serialization
// without claiming a fixed wait guarantees total network latency.
const EXTENSION_TOTAL_BUDGET_MS = 4500;
const POST_HYDRATION_RESPONSE_RESERVE_MS = 900;
const MAX_LOADER_HYDRATION_WAIT_MS = 2200;

const ALLOWED_QUERY_KEYS_LIST = new Set([
  "op",
  "productId",
  "mode",
  "limit",
  "afterReportId",
]);

const ALLOWED_QUERY_KEYS_READ = new Set([
  "op",
  "reportId",
  "section",
  "view",
  "drawer",
  "fieldKey",
  "chunkIndex",
]);

const ALLOWED_READ_SECTIONS_SET = new Set(ALLOWED_READ_SECTIONS);
const ALLOWED_READ_VIEWS_SET = new Set(ALLOWED_READ_VIEWS);

const ALLOWED_POST_KEYS = new Set(["packet", "uiAudit", "liveState"]);

const ALLOWED_LIVE_STATE_KEYS = new Set([
  "mode",
  "benchSessionId",
  "benchRevision",
  "selectionState",
  "productId",
  "clientStateChangedAt",
  "baselineLoadedAt",
]);

const STRICT_ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function parseStrictIsoTimestamp(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || !STRICT_ISO_TIMESTAMP_PATTERN.test(trimmed)) {
    return null;
  }
  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) {
    return null;
  }
  return { raw: trimmed, ms: parsedMs };
}

function isResponseInstance(err) {
  return (
    err instanceof Response ||
    (err !== null &&
      typeof err === "object" &&
      typeof err.status === "number" &&
      typeof err.headers === "object" &&
      typeof err.text === "function")
  );
}

function utf8ByteLength(value) {
  return Buffer.byteLength(String(value ?? ""), "utf8");
}

function buildJsonResponse(payload, status = 200, cors = null, extraHeaders = null) {
  let serialized = "";
  try {
    serialized = JSON.stringify(payload);
  } catch {
    status = 500;
    serialized = JSON.stringify({
      ok: false,
      status: "error",
      code: "serialization_failure",
      message: "Failed to serialize response payload.",
    });
  }

  if (Buffer.byteLength(serialized, "utf8") > MAX_RESPONSE_UTF8_BYTES) {
    status = 500;
    serialized = JSON.stringify({
      ok: false,
      status: "error",
      code: "response_too_large",
      message:
        "Response metadata exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
    });
  }

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (extraHeaders && typeof extraHeaders === "object") {
    for (const [key, value] of Object.entries(extraHeaders)) {
      headers.set(key, value);
    }
  }

  const response = new Response(serialized, { status, headers });
  return typeof cors === "function" ? cors(response) : response;
}

function mapCacheResultToHttpStatus(result, isWrite = false) {
  if (!result || typeof result !== "object") {
    return 500;
  }

  if (result.ok === true) {
    if (isWrite && result.status === "stored") {
      return result.deduplicated ? 200 : 201;
    }
    return 200;
  }

  switch (result.status) {
    case "invalid_request":
    case "invalid_cursor":
      if (
        result.code === "full_text_too_large" ||
        result.code === "ui_audit_too_large" ||
        result.code === "report_exceeds_cache_budget"
      ) {
        return 413;
      }
      if (result.code === "stale_bench_revision") {
        return 409;
      }
      return 400;
    case "not_found":
      return 404;
    case "unavailable":
      return 503;
    case "error":
    default:
      return 500;
  }
}

function computeRemainingHydrationWaitMs(loaderStartMs) {
  const elapsedMs = Math.max(0, Date.now() - loaderStartMs);
  const remainingBeforeExtensionCutoff =
    EXTENSION_TOTAL_BUDGET_MS - POST_HYDRATION_RESPONSE_RESERVE_MS - elapsedMs;
  if (remainingBeforeExtensionCutoff < MIN_HYDRATION_WAIT_BUDGET_MS) {
    return null;
  }
  return Math.min(MAX_LOADER_HYDRATION_WAIT_MS, remainingBeforeExtensionCutoff);
}

function buildCompactHydrationCompleteness(hydrationResult) {
  return {
    complete: Boolean(hydrationResult?.complete),
    outcome:
      typeof hydrationResult?.outcome === "string"
        ? hydrationResult.outcome
        : "error",
    reason:
      typeof hydrationResult?.reason === "string"
        ? hydrationResult.reason
        : "unknown_hydration_state",
    hasMoreBeyondScanWindow: Boolean(hydrationResult?.hasMoreBeyondScanWindow),
    scannedCount:
      typeof hydrationResult?.scannedCount === "number"
        ? hydrationResult.scannedCount
        : 0,
    hydratedCount:
      typeof hydrationResult?.hydratedCount === "number"
        ? hydrationResult.hydratedCount
        : 0,
  };
}

function mapIncompleteHydrationToUnavailableReason(hydrationResult) {
  const outcome = hydrationResult?.outcome;
  const reason = hydrationResult?.reason;
  if (outcome === "timed_out") {
    return "durable_hydration_timed_out";
  }
  if (outcome === "partial") {
    if (reason === "scan_page_cap_reached") {
      return "durable_hydration_scan_window_capped";
    }
    if (reason === "saved_report_id_mismatch_skipped") {
      return "durable_hydration_id_mismatch_skipped";
    }
    return "durable_hydration_partial_coverage";
  }
  return "durable_hydration_failed";
}

function attachEssentialHydrationCompletenessToListResult({
  listResult,
  hydrationResult,
  requestedLimit,
}) {
  if (!hydrationResult || hydrationResult.complete === true) {
    return listResult;
  }

  const completenessMeta = buildCompactHydrationCompleteness(hydrationResult);
  const unavailableReason =
    mapIncompleteHydrationToUnavailableReason(hydrationResult);

  // Case A: List returned zero matching active RAM items while durable hydration
  // was incomplete (timed out, errored, or partial). Never imply complete empty
  // coverage; report explicit unavailable reason + hydrationCompleteness.
  if (listResult && listResult.ok === true && listResult.status === "unavailable") {
    const updatedUnavailable = {
      ...listResult,
      reason: unavailableReason,
      message:
        hydrationResult.message ||
        "RAM cache had no matching active reports and durable Shopify report hydration did not complete cleanly.",
      hydrationCompleteness: completenessMeta,
    };

    if (utf8ByteLength(JSON.stringify(updatedUnavailable)) <= MAX_RESPONSE_UTF8_BYTES) {
      return updatedUnavailable;
    }

    if (Object.prototype.hasOwnProperty.call(updatedUnavailable, "liveSessions")) {
      const withoutSessions = { ...updatedUnavailable };
      delete withoutSessions.liveSessions;
      if (utf8ByteLength(JSON.stringify(withoutSessions)) <= MAX_RESPONSE_UTF8_BYTES) {
        return withoutSessions;
      }
    }

    return {
      ok: true,
      status: "unavailable",
      reason: unavailableReason,
      message:
        "Durable report hydration was incomplete; coverage cannot be treated as complete.",
      reports: [],
      pagination: listResult.pagination || {
        requestedLimit,
        returnedCount: 0,
        totalMatching: 0,
        hasNextPage: false,
        nextAfterReportId: null,
      },
      hydrationCompleteness: completenessMeta,
    };
  }

  // Case B: List failed cursor lookup while durable hydration was incomplete.
  // Never report definitive after_report_id_not_found when older/unhydrated
  // durable reports may own the cursor.
  if (
    listResult &&
    listResult.ok === false &&
    listResult.status === "invalid_cursor" &&
    listResult.code === "after_report_id_not_found"
  ) {
    return {
      ok: true,
      status: "unavailable",
      reason: unavailableReason,
      message:
        hydrationResult.message ||
        "Requested pagination cursor was not in active RAM and durable Shopify hydration was incomplete.",
      reports: [],
      pagination: {
        requestedLimit,
        returnedCount: 0,
        totalMatching: 0,
        hasNextPage: false,
        nextAfterReportId: null,
      },
      hydrationCompleteness: completenessMeta,
    };
  }

  // Case C: List returned >= 1 report items while durable hydration was partial,
  // timed out, or errored. Completeness metadata is essential output: NEVER
  // drop hydrationCompleteness to fit 3500 bytes. Trim optional liveSessions or
  // reduce returned page slice (setting hasNextPage=true) if needed, or fall
  // back to a compact compatible unavailable response with hydrationCompleteness.
  if (
    listResult &&
    listResult.ok === true &&
    listResult.status === "ok" &&
    Array.isArray(listResult.reports)
  ) {
    const candidateWithAll = {
      ...listResult,
      hydrationCompleteness: completenessMeta,
    };
    if (utf8ByteLength(JSON.stringify(candidateWithAll)) <= MAX_RESPONSE_UTF8_BYTES) {
      return candidateWithAll;
    }

    const baseWithoutSessions = { ...listResult };
    delete baseWithoutSessions.liveSessions;

    const candidateNoSessions = {
      ...baseWithoutSessions,
      hydrationCompleteness: completenessMeta,
    };
    if (utf8ByteLength(JSON.stringify(candidateNoSessions)) <= MAX_RESPONSE_UTF8_BYTES) {
      return candidateNoSessions;
    }

    const originalReports = listResult.reports;
    const totalMatching =
      typeof listResult.pagination?.totalMatching === "number"
        ? listResult.pagination.totalMatching
        : originalReports.length;

    for (let keepCount = originalReports.length - 1; keepCount >= 1; keepCount -= 1) {
      const slicedReports = originalReports.slice(0, keepCount);
      const shrunkEnvelope = {
        ok: true,
        status: "ok",
        reports: slicedReports,
        pagination: {
          requestedLimit,
          returnedCount: slicedReports.length,
          totalMatching,
          hasNextPage: true,
          nextAfterReportId: slicedReports[slicedReports.length - 1].reportId,
        },
        hydrationCompleteness: completenessMeta,
      };
      if (utf8ByteLength(JSON.stringify(shrunkEnvelope)) <= MAX_RESPONSE_UTF8_BYTES) {
        return shrunkEnvelope;
      }
    }

    return {
      ok: true,
      status: "unavailable",
      reason: "response_ceiling_with_incomplete_hydration",
      message:
        "Report metadata plus required hydrationCompleteness exceeded the 3500-byte response ceiling; retry with a narrower mode filter or limit=1.",
      reports: [],
      pagination: {
        requestedLimit,
        returnedCount: 0,
        totalMatching,
        hasNextPage: totalMatching > 0,
        nextAfterReportId: null,
      },
      hydrationCompleteness: completenessMeta,
    };
  }

  return listResult;
}

function buildIncompleteHydrationReadMissPayload({
  reportId,
  section,
  view,
  hydrationResult,
}) {
  const completenessMeta = buildCompactHydrationCompleteness(hydrationResult);
  const code = mapIncompleteHydrationToUnavailableReason(hydrationResult);

  return {
    ok: false,
    status: "unavailable",
    code,
    reportId,
    section,
    ...(view !== "chunk" ? { view } : {}),
    hydrationCompleteness: completenessMeta,
    message:
      hydrationResult?.message ||
      "Requested reportId was not in active RAM and durable Shopify report hydration was incomplete; report absence is not established.",
  };
}

function parseStrictNonNegativeInt(raw) {
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return null;
  }
  return parsed;
}

function parseStrictPositiveIntRange(raw, min, max) {
  const parsed = parseStrictNonNegativeInt(raw);
  if (parsed === null || parsed < min || parsed > max) {
    return null;
  }
  return parsed;
}

function verifyConfiguredAppOrigin(request) {
  const rawConfiguredUrl = process.env.SHOPIFY_APP_URL;
  if (typeof rawConfiguredUrl !== "string" || !rawConfiguredUrl.trim()) {
    return {
      ok: false,
      status: 500,
      code: "misconfigured_app_origin",
      message: "SHOPIFY_APP_URL is missing or not configured on the server.",
    };
  }

  let expectedOrigin = null;
  try {
    const parsedAppUrl = new URL(rawConfiguredUrl.trim());
    if (
      (parsedAppUrl.protocol !== "https:" && parsedAppUrl.protocol !== "http:") ||
      !parsedAppUrl.host
    ) {
      return {
        ok: false,
        status: 500,
        code: "misconfigured_app_origin",
        message: "SHOPIFY_APP_URL does not have a valid HTTP/HTTPS origin.",
      };
    }
    expectedOrigin = parsedAppUrl.origin;
  } catch {
    return {
      ok: false,
      status: 500,
      code: "misconfigured_app_origin",
      message: "SHOPIFY_APP_URL is not a valid URL.",
    };
  }

  const rawRequestOrigin = request.headers.get("origin");
  if (typeof rawRequestOrigin !== "string" || !rawRequestOrigin.trim()) {
    return {
      ok: false,
      status: 403,
      code: "missing_origin",
      message: "Origin header is required for telemetry report publishing.",
    };
  }

  const trimmedOrigin = rawRequestOrigin.trim();
  if (trimmedOrigin === "null") {
    return {
      ok: false,
      status: 403,
      code: "forbidden_origin",
      message: "Null Origin is not permitted to publish telemetry reports.",
    };
  }

  let normalizedRequestOrigin = null;
  try {
    normalizedRequestOrigin = new URL(trimmedOrigin).origin;
  } catch {
    return {
      ok: false,
      status: 403,
      code: "invalid_origin",
      message: "Origin header is malformed.",
    };
  }

  if (
    normalizedRequestOrigin.toLowerCase() === "https://extensions.shopifycdn.com" ||
    normalizedRequestOrigin !== expectedOrigin ||
    trimmedOrigin !== expectedOrigin
  ) {
    return {
      ok: false,
      status: 403,
      code: "forbidden_origin",
      message:
        "Origin is not authorized to publish telemetry reports. Only the exact SHOPIFY_APP_URL origin is allowed.",
    };
  }

  return { ok: true, origin: expectedOrigin };
}

function hasJsonContentType(request) {
  const contentType = request.headers.get("content-type");
  if (typeof contentType !== "string" || !contentType.trim()) {
    return false;
  }
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  return mediaType === "application/json";
}

async function readBoundedUtf8Body(request, maxBytes = MAX_POST_BODY_BYTES) {
  const contentLengthHeader = request.headers.get("content-length");
  if (typeof contentLengthHeader === "string" && contentLengthHeader.trim() !== "") {
    const declaredLength = Number.parseInt(contentLengthHeader.trim(), 10);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      return {
        ok: false,
        status: 413,
        code: "payload_too_large",
        message: `Request body exceeds the ${maxBytes}-byte limit.`,
      };
    }
  }

  if (!request.body) {
    return {
      ok: false,
      status: 400,
      code: "empty_body",
      message: "Request body is required.",
    };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }
      const chunkBuffer = Buffer.isBuffer(value)
        ? value
        : Buffer.from(value.buffer, value.byteOffset, value.byteLength);

      totalBytes += chunkBuffer.byteLength;
      if (totalBytes > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Ignore stream cancel errors on oversize abort
        }
        return {
          ok: false,
          status: 413,
          code: "payload_too_large",
          message: `Request body stream exceeded the ${maxBytes}-byte limit.`,
        };
      }
      chunks.push(chunkBuffer);
    }
  } catch {
    return {
      ok: false,
      status: 400,
      code: "body_read_error",
      message: "Failed to read request body stream.",
    };
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // Ignore lock release errors
    }
  }

  if (totalBytes === 0) {
    return {
      ok: false,
      status: 400,
      code: "empty_body",
      message: "Request body cannot be empty.",
    };
  }

  const combined = Buffer.concat(chunks, totalBytes);
  return {
    ok: true,
    text: combined.toString("utf8"),
    byteLength: totalBytes,
  };
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function validatePostEnvelopeAndLiveIdentity(parsedBody) {
  const hasPacketKey = Object.prototype.hasOwnProperty.call(parsedBody, "packet");
  const hasLiveStateKey = Object.prototype.hasOwnProperty.call(parsedBody, "liveState");
  const hasUiAuditKey = Object.prototype.hasOwnProperty.call(parsedBody, "uiAudit");

  const rawPacket = hasPacketKey ? parsedBody.packet : null;
  const rawLiveState = hasLiveStateKey ? parsedBody.liveState : null;
  const rawUiAudit = hasUiAuditKey ? parsedBody.uiAudit : null;

  if (hasPacketKey && rawPacket !== null && !isPlainObject(rawPacket)) {
    return {
      ok: false,
      code: "invalid_packet",
      message: '"packet" must be a plain JSON object or null.',
    };
  }

  if (isPlainObject(rawPacket) && Object.prototype.hasOwnProperty.call(rawPacket, "shop")) {
    return {
      ok: false,
      code: "shop_override_forbidden",
      message:
        "shop field is forbidden inside packet; shop is derived exclusively from the authenticated session.",
    };
  }

  if (hasLiveStateKey && rawLiveState !== null && !isPlainObject(rawLiveState)) {
    return {
      ok: false,
      code: "invalid_live_state",
      message: '"liveState" must be a plain JSON object or null.',
    };
  }

  if (isPlainObject(rawLiveState)) {
    if (Object.prototype.hasOwnProperty.call(rawLiveState, "shop")) {
      return {
        ok: false,
        code: "shop_override_forbidden",
        message:
          "shop field is forbidden inside liveState; shop is derived exclusively from the authenticated session.",
      };
    }

    const liveKeys = Object.keys(rawLiveState);
    for (let i = 0; i < liveKeys.length; i += 1) {
      const k = liveKeys[i];
      if (!ALLOWED_LIVE_STATE_KEYS.has(k)) {
        return {
          ok: false,
          code: "unexpected_live_state_field",
          message: `Unsupported field "${k}" inside liveState.`,
        };
      }
    }

    if (
      rawLiveState.mode !== undefined &&
      rawLiveState.mode !== null &&
      String(rawLiveState.mode).trim() !== LIVE_BENCH_MODE
    ) {
      return {
        ok: false,
        code: "invalid_live_state_mode",
        message: `liveState.mode must be "${LIVE_BENCH_MODE}" when provided.`,
      };
    }

    if (
      rawLiveState.clientStateChangedAt !== undefined &&
      rawLiveState.clientStateChangedAt !== null &&
      !parseStrictIsoTimestamp(rawLiveState.clientStateChangedAt)
    ) {
      return {
        ok: false,
        code: "invalid_client_state_changed_at",
        message:
          "liveState.clientStateChangedAt must be a valid ISO-8601 timestamp string.",
      };
    }
  }

  if (!isPlainObject(rawPacket) && !isPlainObject(rawLiveState)) {
    return {
      ok: false,
      code: "missing_packet",
      message:
        'Request body must include a "packet" object or a "liveState" object for live bench deselection.',
    };
  }

  // Validate live_bench_state timestamp declarations on packet even when top-level liveState is omitted
  const isLiveBenchPacket =
    (isPlainObject(rawPacket) &&
      typeof rawPacket.mode === "string" &&
      rawPacket.mode.trim() === LIVE_BENCH_MODE) ||
    isPlainObject(rawLiveState);

  if (isLiveBenchPacket && isPlainObject(rawPacket)) {
    let parsedPktChanged = null;
    if (
      rawPacket.clientStateChangedAt !== undefined &&
      rawPacket.clientStateChangedAt !== null
    ) {
      parsedPktChanged = parseStrictIsoTimestamp(rawPacket.clientStateChangedAt);
      if (!parsedPktChanged) {
        return {
          ok: false,
          code: "invalid_client_state_changed_at",
          message:
            "packet.clientStateChangedAt must be a valid ISO-8601 timestamp string when provided.",
        };
      }
    }

    if (rawPacket.capturedAt !== undefined && rawPacket.capturedAt !== null) {
      const parsedPktCaptured = parseStrictIsoTimestamp(rawPacket.capturedAt);
      if (!parsedPktCaptured) {
        return {
          ok: false,
          code: "invalid_captured_at",
          message: "packet.capturedAt must be a valid ISO-8601 timestamp string.",
        };
      }
      if (parsedPktChanged && parsedPktChanged.ms > parsedPktCaptured.ms) {
        return {
          ok: false,
          code: "client_state_after_capture",
          message:
            "clientStateChangedAt cannot be later than packet.capturedAt.",
        };
      }
    }
  }

  // Cross-check packet vs. liveState identity fields when both are supplied
  if (isPlainObject(rawPacket) && isPlainObject(rawLiveState)) {
    if (
      rawPacket.mode !== undefined &&
      rawPacket.mode !== null &&
      String(rawPacket.mode).trim() !== LIVE_BENCH_MODE
    ) {
      return {
        ok: false,
        code: "inconsistent_live_state_mode",
        message: `packet.mode must be "${LIVE_BENCH_MODE}" when liveState is provided.`,
      };
    }

    if (
      rawPacket.benchSessionId !== undefined &&
      rawLiveState.benchSessionId !== undefined &&
      String(rawPacket.benchSessionId).trim() !== String(rawLiveState.benchSessionId).trim()
    ) {
      return {
        ok: false,
        code: "inconsistent_bench_session_id",
        message: "packet.benchSessionId and liveState.benchSessionId must match.",
      };
    }

    if (
      rawPacket.benchRevision !== undefined &&
      rawLiveState.benchRevision !== undefined &&
      rawPacket.benchRevision !== rawLiveState.benchRevision
    ) {
      return {
        ok: false,
        code: "inconsistent_bench_revision",
        message: "packet.benchRevision and liveState.benchRevision must match.",
      };
    }

    if (
      rawPacket.selectionState !== undefined &&
      rawLiveState.selectionState !== undefined &&
      rawPacket.selectionState !== rawLiveState.selectionState
    ) {
      return {
        ok: false,
        code: "inconsistent_selection_state",
        message: "packet.selectionState and liveState.selectionState must match.",
      };
    }

    if (
      rawLiveState.productId !== undefined &&
      rawLiveState.productId !== null &&
      rawPacket.productId !== undefined &&
      rawPacket.productId !== null &&
      String(rawLiveState.productId).trim() !== String(rawPacket.productId).trim()
    ) {
      return {
        ok: false,
        code: "inconsistent_product_id",
        message: "packet.productId and liveState.productId must match.",
      };
    }

    const parsedLiveChanged =
      rawLiveState.clientStateChangedAt !== undefined &&
      rawLiveState.clientStateChangedAt !== null
        ? parseStrictIsoTimestamp(rawLiveState.clientStateChangedAt)
        : null;
    const parsedPacketChanged =
      rawPacket.clientStateChangedAt !== undefined &&
      rawPacket.clientStateChangedAt !== null
        ? parseStrictIsoTimestamp(rawPacket.clientStateChangedAt)
        : null;
    const parsedPacketCaptured =
      rawPacket.capturedAt !== undefined &&
      rawPacket.capturedAt !== null
        ? parseStrictIsoTimestamp(rawPacket.capturedAt)
        : null;

    if (
      parsedLiveChanged &&
      parsedPacketChanged &&
      parsedLiveChanged.raw !== parsedPacketChanged.raw
    ) {
      return {
        ok: false,
        code: "inconsistent_client_state_changed_at",
        message:
          "packet.clientStateChangedAt and liveState.clientStateChangedAt must match.",
      };
    }

    const effectiveChanged = parsedLiveChanged || parsedPacketChanged;
    if (
      effectiveChanged &&
      parsedPacketCaptured &&
      effectiveChanged.ms > parsedPacketCaptured.ms
    ) {
      return {
        ok: false,
        code: "client_state_after_capture",
        message:
          "clientStateChangedAt cannot be later than packet.capturedAt.",
      };
    }
  }

  const effectiveSelectionState =
    (isPlainObject(rawLiveState) ? rawLiveState.selectionState : undefined) ??
    (isPlainObject(rawPacket) ? rawPacket.selectionState : undefined);

  if (effectiveSelectionState === "none" && rawUiAudit !== null && rawUiAudit !== undefined) {
    return {
      ok: false,
      code: "inconsistent_deselection_ui_audit",
      message: 'uiAudit must be null or omitted when selectionState is "none".',
    };
  }

  return {
    ok: true,
    packet: rawPacket,
    uiAudit: rawUiAudit,
    liveState: rawLiveState,
  };
}

export async function loader({ request }) {
  const loaderStartMs = Date.now();

  let authContext;
  try {
    authContext = await authenticate.admin(request);
  } catch (err) {
    if (isResponseInstance(err)) {
      throw err;
    }
    return buildJsonResponse(
      {
        ok: false,
        status: "error",
        code: "authentication_failed",
        message: "Failed to authenticate admin request.",
      },
      401
    );
  }

  const cors = typeof authContext?.cors === "function" ? authContext.cors : null;
  const admin = authContext?.admin || null;
  const authenticatedShop =
    typeof authContext?.session?.shop === "string"
      ? authContext.session.shop.trim()
      : "";

  if (!authenticatedShop) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "missing_authenticated_shop",
        message: "Authenticated session did not provide a valid shop identity.",
      },
      401,
      cors
    );
  }

  const method = (request.method || "GET").toUpperCase();
  if (method !== "GET") {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "method_not_allowed",
        message: "Only GET is supported by this loader.",
      },
      405,
      cors,
      { Allow: "GET, POST" }
    );
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "invalid_url",
        message: "Malformed request URL.",
      },
      400,
      cors
    );
  }

  const params = url.searchParams;
  if (params.has("shop")) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "shop_override_forbidden",
        message:
          "shop parameter is not accepted in query parameters; shop is derived exclusively from the authenticated session.",
      },
      400,
      cors
    );
  }

  const opValues = params.getAll("op");
  if (opValues.length > 1) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "duplicate_parameter",
        message: "Multiple op parameters are not allowed.",
      },
      400,
      cors
    );
  }

  const rawOp = params.has("op") ? params.get("op") : "list";
  const op = typeof rawOp === "string" ? rawOp.trim() : "";

  if (op !== "list" && op !== "read") {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "invalid_op",
        message: 'op must be either "list" or "read".',
      },
      400,
      cors
    );
  }

  try {
    if (op === "list") {
      for (const key of params.keys()) {
        if (!ALLOWED_QUERY_KEYS_LIST.has(key)) {
          return buildJsonResponse(
            {
              ok: false,
              status: "invalid_request",
              code: "unsupported_query_parameter",
              message: `Unsupported query parameter "${key}" for op=list.`,
            },
            400,
            cors
          );
        }
        if (params.getAll(key).length > 1) {
          return buildJsonResponse(
            {
              ok: false,
              status: "invalid_request",
              code: "duplicate_parameter",
              message: `Duplicate query parameter "${key}" is not allowed.`,
            },
            400,
            cors
          );
        }
      }

      const productId = params.has("productId") ? params.get("productId") : null;
      const mode = params.has("mode") ? params.get("mode") : null;
      const afterReportId = params.has("afterReportId")
        ? params.get("afterReportId")
        : null;

      let limit = 3;
      if (params.has("limit")) {
        const parsedLimit = parseStrictPositiveIntRange(params.get("limit"), 1, 5);
        if (parsedLimit === null) {
          return buildJsonResponse(
            {
              ok: false,
              status: "invalid_request",
              code: "invalid_limit",
              message: "limit must be an integer between 1 and 5.",
            },
            400,
            cors
          );
        }
        limit = parsedLimit;
      }

      let result = listTelemetryReports({
        shop: authenticatedShop,
        productId,
        mode,
        limit,
        afterReportId,
      });

      // Cold-research hydration policy for op=list:
      // Grounded research reports are product-free (productId === null) and
      // match ONLY when productId is omitted and mode is either omitted or
      // "gemini_grounded_research". Preserve fast RAM hits without Shopify I/O
      // whenever active grounded research records already exist in RAM and any
      // requested pagination cursor resolved cleanly.
      const normalizedModeFilter =
        typeof mode === "string" && mode.trim() ? mode.trim() : null;
      const isProductFreeList = productId === null || productId === undefined;
      const listIncludesGroundedResearch =
        isProductFreeList &&
        (normalizedModeFilter === null ||
          normalizedModeFilter === GEMINI_GROUNDED_RESEARCH_MODE);

      if (listIncludesGroundedResearch && result.status !== "invalid_request") {
        const activeResearchProbe =
          normalizedModeFilter === GEMINI_GROUNDED_RESEARCH_MODE &&
          afterReportId === null
            ? result
            : listTelemetryReports({
                shop: authenticatedShop,
                productId: null,
                mode: GEMINI_GROUNDED_RESEARCH_MODE,
                limit: 1,
                afterReportId: null,
              });

        const hasActiveResearchInRam =
          activeResearchProbe.ok === true && activeResearchProbe.status === "ok";
        const cursorMissedInRam =
          result.ok === false &&
          result.status === "invalid_cursor" &&
          result.code === "after_report_id_not_found";

        if (!hasActiveResearchInRam || cursorMissedInRam) {
          const waitBudgetMs = computeRemainingHydrationWaitMs(loaderStartMs);
          const hydrationResult =
            waitBudgetMs === null
              ? {
                  ok: false,
                  outcome: "timed_out",
                  complete: false,
                  hasMoreBeyondScanWindow: false,
                  scannedCount: 0,
                  verifiedSavedCount: 0,
                  hydratedCount: 0,
                  idMismatchCount: 0,
                  cachePublishErrorCount: 0,
                  reason: "insufficient_remaining_request_budget",
                  message:
                    "Remaining request budget after authentication was too small to complete durable Shopify report hydration.",
                }
              : await hydrateDurableResearchReportsToCache({
                  admin,
                  shop: authenticatedShop,
                  waitBudgetMs,
                });

          if (hydrationResult.hydratedCount > 0) {
            result = listTelemetryReports({
              shop: authenticatedShop,
              productId,
              mode,
              limit,
              afterReportId,
            });
          }

          if (!hydrationResult.complete) {
            result = attachEssentialHydrationCompletenessToListResult({
              listResult: result,
              hydrationResult,
              requestedLimit: limit,
            });
          }
        }
      }

      const httpStatus = mapCacheResultToHttpStatus(result, false);
      return buildJsonResponse(result, httpStatus, cors);
    }

    // op === "read"
    for (const key of params.keys()) {
      if (!ALLOWED_QUERY_KEYS_READ.has(key)) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "unsupported_query_parameter",
            message: `Unsupported query parameter "${key}" for op=read.`,
          },
          400,
          cors
        );
      }
      if (params.getAll(key).length > 1) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "duplicate_parameter",
            message: `Duplicate query parameter "${key}" is not allowed.`,
          },
          400,
          cors
        );
      }
    }

    if (!params.has("reportId")) {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "missing_report_id",
          message: "reportId is required when op=read.",
        },
        400,
        cors
      );
    }

    const rawReportId = params.get("reportId");
    const reportId = typeof rawReportId === "string" ? rawReportId.trim() : "";
    if (!reportId) {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "invalid_report_id",
          message: "A nonempty reportId string is required.",
        },
        400,
        cors
      );
    }

    const rawSection = params.has("section") ? params.get("section") : "report";
    const section = typeof rawSection === "string" ? rawSection.trim() : "";
    if (!ALLOWED_READ_SECTIONS_SET.has(section)) {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "invalid_section",
          message: 'section must be either "report" or "ui_audit".',
        },
        400,
        cors
      );
    }

    const rawView = params.has("view") ? params.get("view") : "chunk";
    const view = typeof rawView === "string" ? rawView.trim() : "";
    if (!ALLOWED_READ_VIEWS_SET.has(view)) {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "invalid_view",
          message:
            'view must be one of "chunk", "index", "header", "review", "drawer", or "field".',
        },
        400,
        cors
      );
    }

    if (section === "ui_audit" && view !== "chunk") {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "incompatible_section_and_view",
          message: 'When section is "ui_audit", view must be "chunk" (or omitted).',
        },
        400,
        cors
      );
    }

    const hasDrawerParam = params.has("drawer");
    const hasFieldKeyParam = params.has("fieldKey");
    const rawDrawer = hasDrawerParam ? params.get("drawer") : null;
    const rawFieldKey = hasFieldKeyParam ? params.get("fieldKey") : null;
    const drawer = typeof rawDrawer === "string" ? rawDrawer.trim() : null;
    const fieldKey = typeof rawFieldKey === "string" ? rawFieldKey.trim() : null;

    if (view === "drawer") {
      if (!drawer || drawer.length > 200) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "missing_drawer",
            message:
              'A nonempty "drawer" string (up to 200 characters) is required when view="drawer".',
          },
          400,
          cors
        );
      }
      if (hasFieldKeyParam) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "unexpected_field_key",
            message: 'fieldKey is not accepted when view="drawer".',
          },
          400,
          cors
        );
      }
    } else if (view === "field") {
      if (!fieldKey || fieldKey.length > 200) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "missing_field_key",
            message:
              'A nonempty "fieldKey" string (up to 200 characters) is required when view="field".',
          },
          400,
          cors
        );
      }
      if (hasDrawerParam) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "unexpected_drawer",
            message: 'drawer is not accepted when view="field".',
          },
          400,
          cors
        );
      }
    } else {
      if (hasDrawerParam) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "unexpected_drawer",
            message: `drawer parameter is only supported when view="drawer" (received view="${view}").`,
          },
          400,
          cors
        );
      }
      if (hasFieldKeyParam) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "unexpected_field_key",
            message: `fieldKey parameter is only supported when view="field" (received view="${view}").`,
          },
          400,
          cors
        );
      }
    }

    let chunkIndex = 0;
    if (params.has("chunkIndex")) {
      const parsedChunkIndex = parseStrictNonNegativeInt(params.get("chunkIndex"));
      if (parsedChunkIndex === null) {
        return buildJsonResponse(
          {
            ok: false,
            status: "invalid_request",
            code: "invalid_chunk_index",
            message: "chunkIndex must be a non-negative integer.",
          },
          400,
          cors
        );
      }
      chunkIndex = parsedChunkIndex;
    }

    // Fast O(1) RAM lookup first (all warm reads and chunk continuations 1..N-1
    // resolve immediately without Shopify I/O).
    let result = readTelemetryReport({
      shop: authenticatedShop,
      reportId,
      section,
      view,
      drawer,
      fieldKey,
      chunkIndex,
    });

    // Durable research reports only support view="chunk" (organized views apply
    // exclusively to volatile live_bench_state snapshots). On a research-capable
    // RAM miss, run bounded durable hydration and re-query the exact original
    // reportId without rewriting IDs.
    const isResearchCapableRead = view === "chunk";
    if (result.ok === false && result.status === "not_found" && isResearchCapableRead) {
      const waitBudgetMs = computeRemainingHydrationWaitMs(loaderStartMs);
      const hydrationResult =
        waitBudgetMs === null
          ? {
              ok: false,
              outcome: "timed_out",
              complete: false,
              hasMoreBeyondScanWindow: false,
              scannedCount: 0,
              verifiedSavedCount: 0,
              hydratedCount: 0,
              idMismatchCount: 0,
              cachePublishErrorCount: 0,
              reason: "insufficient_remaining_request_budget",
              message:
                "Remaining request budget after authentication was too small to complete durable Shopify report hydration.",
            }
          : await hydrateDurableResearchReportsToCache({
              admin,
              shop: authenticatedShop,
              waitBudgetMs,
            });

      if (hydrationResult.hydratedCount > 0) {
        result = readTelemetryReport({
          shop: authenticatedShop,
          reportId,
          section,
          view,
          drawer,
          fieldKey,
          chunkIndex,
        });
      }

      // Never return a definitive not_found when durable hydration timed out,
      // errored, skipped an ID/cache cap, or stopped at the 20-record scan cap.
      if (
        result.ok === false &&
        result.status === "not_found" &&
        !hydrationResult.complete
      ) {
        result = buildIncompleteHydrationReadMissPayload({
          reportId,
          section,
          view,
          hydrationResult,
        });
      }
    }

    const httpStatus = mapCacheResultToHttpStatus(result, false);
    return buildJsonResponse(result, httpStatus, cors);
  } catch (err) {
    if (isResponseInstance(err)) {
      throw err;
    }
    return buildJsonResponse(
      {
        ok: false,
        status: "error",
        code: "internal_read_error",
        message: "An unexpected internal error occurred while reading telemetry cache.",
      },
      500,
      cors
    );
  }
}

export async function action({ request }) {
  const method = (request.method || "").toUpperCase();
  if (method !== "POST") {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "method_not_allowed",
        message: "Only POST is permitted to store telemetry reports.",
      },
      405,
      null,
      { Allow: "GET, POST" }
    );
  }

  const originCheck = verifyConfiguredAppOrigin(request);
  if (!originCheck.ok) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: originCheck.code,
        message: originCheck.message,
      },
      originCheck.status
    );
  }

  let authContext;
  try {
    authContext = await authenticate.admin(request);
  } catch (err) {
    if (isResponseInstance(err)) {
      throw err;
    }
    return buildJsonResponse(
      {
        ok: false,
        status: "error",
        code: "authentication_failed",
        message: "Failed to authenticate admin request.",
      },
      401
    );
  }

  const authenticatedShop =
    typeof authContext?.session?.shop === "string"
      ? authContext.session.shop.trim()
      : "";

  if (!authenticatedShop) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "missing_authenticated_shop",
        message: "Authenticated session did not provide a valid shop identity.",
      },
      401
    );
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "invalid_url",
        message: "Malformed request URL.",
      },
      400
    );
  }

  if (url.searchParams.has("shop")) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "shop_override_forbidden",
        message:
          "shop parameter is not accepted in query parameters; shop is derived exclusively from the authenticated session.",
      },
      400
    );
  }

  if (Array.from(url.searchParams.keys()).length > 0) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "unsupported_query_parameter",
        message: "Query parameters are not accepted on POST /api/meta-injector-telemetry.",
      },
      400
    );
  }

  if (!hasJsonContentType(request)) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "unsupported_media_type",
        message: "Content-Type must be application/json.",
      },
      415
    );
  }

  const bodyResult = await readBoundedUtf8Body(request, MAX_POST_BODY_BYTES);
  if (!bodyResult.ok) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: bodyResult.code,
        message: bodyResult.message,
      },
      bodyResult.status
    );
  }

  let parsedBody;
  try {
    parsedBody = JSON.parse(bodyResult.text);
  } catch {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "invalid_json",
        message: "Request body is not valid JSON.",
      },
      400
    );
  }

  if (!isPlainObject(parsedBody)) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "invalid_body_root",
        message: "Request JSON body must be a plain object.",
      },
      400
    );
  }

  if (Object.prototype.hasOwnProperty.call(parsedBody, "shop")) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: "shop_override_forbidden",
        message:
          "Top-level shop field is forbidden in request body; shop is derived exclusively from the authenticated session.",
      },
      400
    );
  }

  const bodyKeys = Object.keys(parsedBody);
  for (let i = 0; i < bodyKeys.length; i += 1) {
    const key = bodyKeys[i];
    if (!ALLOWED_POST_KEYS.has(key)) {
      return buildJsonResponse(
        {
          ok: false,
          status: "invalid_request",
          code: "unexpected_body_field",
          message: `Unexpected top-level field "${key}". Only "packet", optional "uiAudit", and optional "liveState" are accepted.`,
        },
        400
      );
    }
  }

  const envelopeCheck = validatePostEnvelopeAndLiveIdentity(parsedBody);
  if (!envelopeCheck.ok) {
    return buildJsonResponse(
      {
        ok: false,
        status: "invalid_request",
        code: envelopeCheck.code,
        message: envelopeCheck.message,
      },
      400
    );
  }

  try {
    const storeResult = storeTelemetryReport({
      shop: authenticatedShop,
      packet: envelopeCheck.packet,
      uiAudit: envelopeCheck.uiAudit,
      liveState: envelopeCheck.liveState,
    });

    const httpStatus = mapCacheResultToHttpStatus(storeResult, true);
    return buildJsonResponse(storeResult, httpStatus);
  } catch (err) {
    if (isResponseInstance(err)) {
      throw err;
    }
    return buildJsonResponse(
      {
        ok: false,
        status: "error",
        code: "internal_store_error",
        message: "An unexpected internal error occurred while storing telemetry report.",
      },
      500
    );
  }
}
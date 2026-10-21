import { Buffer } from "node:buffer";
import { authenticate } from "../shopify.server";
import {
  storeTelemetryReport,
  listTelemetryReports,
  readTelemetryReport,
} from "../utils/meta-injector.sidekick-report-cache.server.js";

const MAX_POST_BODY_BYTES = 2 * 1024 * 1024;
const MAX_RESPONSE_UTF8_BYTES = 3500;
const LIVE_BENCH_MODE = "live_bench_state";

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
  "chunkIndex",
]);

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
    case "error":
    default:
      return 500;
  }
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
  }

  if (!isPlainObject(rawPacket) && !isPlainObject(rawLiveState)) {
    return {
      ok: false,
      code: "missing_packet",
      message:
        'Request body must include a "packet" object or a "liveState" object for live bench deselection.',
    };
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

    if (
      rawLiveState.clientStateChangedAt !== undefined &&
      rawLiveState.clientStateChangedAt !== null &&
      rawPacket.capturedAt !== undefined &&
      rawPacket.capturedAt !== null &&
      String(rawLiveState.clientStateChangedAt).trim() !== String(rawPacket.capturedAt).trim()
    ) {
      return {
        ok: false,
        code: "inconsistent_captured_at",
        message: "liveState.clientStateChangedAt and packet.capturedAt must match.",
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

      const result = listTelemetryReports({
        shop: authenticatedShop,
        productId,
        mode,
        limit,
        afterReportId,
      });

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

    const reportId = params.get("reportId");
    const section = params.has("section") ? params.get("section") : "report";

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

    const result = readTelemetryReport({
      shop: authenticatedShop,
      reportId,
      section,
      chunkIndex,
    });

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
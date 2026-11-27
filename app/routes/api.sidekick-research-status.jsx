// ============================================================================
// FILE: app/routes/api.sidekick-research-status.jsx
// ROCKHOUND STUDIO — READ-ONLY SINGLE RESEARCH REQUEST STATUS ENDPOINT
//
// Maps to /api/sidekick-research-status via flatRoutes() in app/routes.js.
// Strictly read-only:
// - GET only for status reads (non-GET methods return 405).
// - Authenticates via authenticate.admin(request) and preserves SDK-thrown
//   Response / auth challenges and session CORS headers.
// - Derives shop exclusively from authenticated session (rejects client shop).
// - Reads exactly one Shopify Metaobject of type "sidekick_research_request"
//   via read-only GraphQL query; performs zero mutations, zero report-cache
//   calls, zero hydration, zero Gemini calls, and zero UI route imports.
// ============================================================================

import { Buffer } from "node:buffer";
import { authenticate } from "../shopify.server.js";
import {
  buildSingleRequestStatusMetadata,
  isResearchInFlightLocally,
} from "../utils/sidekick-research-status.server.js";

export const RESEARCH_METAOBJECT_TYPE = "sidekick_research_request";
const METAOBJECT_GID_REGEX = /^gid:\/\/shopify\/Metaobject\/\d+$/;
const MAX_RESPONSE_UTF8_BYTES = 3500;
const MAX_REQUEST_KEY_CHARS = 160;
const ALLOWED_QUERY_KEYS = new Set(["metaobjectId", "requestKey"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isResponseLike(err) {
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

function applyCorsIfAvailable(response, corsFn) {
  if (typeof corsFn === "function") {
    try {
      return corsFn(response);
    } catch {
      return response;
    }
  }
  return response;
}

function buildCompactErrorPayload(httpStatus, code, message, extra = null) {
  const safeMessage =
    typeof message === "string" && message.trim()
      ? message.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 240)
      : "Request could not be completed.";
  const payload = {
    ok: false,
    status: httpStatus === 404 ? "not_found" : httpStatus === 409 ? "conflict" : "invalid_request",
    code,
    message: safeMessage,
    observedAt: new Date().toISOString(),
  };
  if (isPlainObject(extra)) {
    for (const [key, val] of Object.entries(extra)) {
      if (!(key in payload)) {
        payload[key] = val;
      }
    }
  }
  return payload;
}

function buildBoundedJsonResponse(payload, status = 200, corsFn = null, extraHeaders = null) {
  let effectivePayload = isPlainObject(payload)
    ? payload
    : buildCompactErrorPayload(500, "invalid_payload", "Invalid status response payload.");
  let serialized = "";

  try {
    serialized = JSON.stringify(effectivePayload);
    if (typeof serialized !== "string") {
      throw new Error("non_string_json");
    }
  } catch {
    status = 500;
    effectivePayload = buildCompactErrorPayload(
      500,
      "serialization_error",
      "Failed to serialize status response safely."
    );
    serialized = JSON.stringify(effectivePayload);
  }

  if (utf8ByteLength(serialized) > MAX_RESPONSE_UTF8_BYTES) {
    status = status >= 400 ? status : 500;
    effectivePayload = buildCompactErrorPayload(
      status,
      "response_too_large",
      "Status response exceeded the 3500 UTF-8 byte ceiling; payload was not returned.",
      {
        localProcessLock: isPlainObject(effectivePayload.localProcessLock)
          ? {
              inCurrentProcess: Boolean(effectivePayload.localProcessLock.inCurrentProcess),
              scope: "single_process_ram_only",
              globalInactivityProven: false,
            }
          : undefined,
      }
    );
    serialized = JSON.stringify(effectivePayload);
    if (utf8ByteLength(serialized) > MAX_RESPONSE_UTF8_BYTES) {
      status = 500;
      effectivePayload = {
        ok: false,
        status: "error",
        code: "response_too_large",
        message: "Status payload exceeded 3500 UTF-8 bytes.",
        observedAt: new Date().toISOString(),
      };
      serialized = JSON.stringify(effectivePayload);
    }
  }

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });

  if (extraHeaders && typeof extraHeaders === "object") {
    for (const [k, v] of Object.entries(extraHeaders)) {
      headers.set(k, String(v));
    }
  }

  return applyCorsIfAvailable(new Response(serialized, { status, headers }), corsFn);
}

function mapFieldsArrayToObject(fieldsArray) {
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

async function readSingleResearchMetaobject(admin, metaobjectId) {
  const response = await admin.graphql(
    `#graphql
      query GetSingleResearchRequestStatus($id: ID!) {
        metaobject(id: $id) {
          id
          type
          updatedAt
          fields {
            key
            value
          }
        }
      }
    `,
    { variables: { id: metaobjectId } }
  );

  if (!response || typeof response.json !== "function") {
    return {
      ok: false,
      kind: "query_error",
      message: "Admin GraphQL client returned an invalid response.",
    };
  }

  const payload = await response.json();
  if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
    return {
      ok: false,
      kind: "query_error",
      message: "Shopify Admin GraphQL query failed while reading request status.",
    };
  }

  const node = payload?.data?.metaobject;
  if (!node || typeof node.id !== "string") {
    return {
      ok: false,
      kind: "not_found",
      message: "Requested research request metaobject was not found.",
    };
  }

  if (node.type !== RESEARCH_METAOBJECT_TYPE) {
    return {
      ok: false,
      kind: "wrong_type",
      actualType: typeof node.type === "string" ? node.type : "unknown",
      message: `Metaobject type mismatch: expected "${RESEARCH_METAOBJECT_TYPE}".`,
    };
  }

  return {
    ok: true,
    id: node.id,
    type: node.type,
    updatedAt: typeof node.updatedAt === "string" ? node.updatedAt : null,
    fields: mapFieldsArrayToObject(node.fields),
  };
}

export async function loader({ request }) {
  const observedAt = new Date().toISOString();

  let authContext;
  try {
    authContext = await authenticate.admin(request);
  } catch (err) {
    if (isResponseLike(err)) {
      throw err;
    }
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        401,
        "authentication_failed",
        "Failed to authenticate Shopify Admin session."
      ),
      401
    );
  }

  const corsFn = typeof authContext?.cors === "function" ? authContext.cors : null;
  const admin = authContext?.admin || null;
  const authenticatedShop =
    typeof authContext?.session?.shop === "string"
      ? authContext.session.shop.trim().toLowerCase()
      : "";

  if (!authenticatedShop) {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        401,
        "missing_authenticated_shop",
        "Authenticated session did not include a shop identity.",
        { observedAt }
      ),
      401,
      corsFn
    );
  }

  const method = (request.method || "GET").toUpperCase();
  if (method !== "GET") {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        405,
        "method_not_allowed",
        "Only GET is permitted on /api/sidekick-research-status.",
        { observedAt }
      ),
      405,
      corsFn,
      { Allow: "GET" }
    );
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        400,
        "invalid_url",
        "Malformed request URL.",
        { observedAt }
      ),
      400,
      corsFn
    );
  }

  if (url.searchParams.has("shop")) {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        400,
        "shop_override_forbidden",
        "Client shop parameter is not permitted; shop comes solely from authenticated session.",
        { observedAt }
      ),
      400,
      corsFn
    );
  }

  for (const key of url.searchParams.keys()) {
    if (!ALLOWED_QUERY_KEYS.has(key)) {
      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          400,
          "unsupported_query_parameter",
          `Unsupported query parameter "${key}".`,
          { observedAt }
        ),
        400,
        corsFn
      );
    }
    if (url.searchParams.getAll(key).length > 1) {
      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          400,
          "duplicate_query_parameter",
          `Duplicate query parameter "${key}" is not permitted.`,
          { observedAt }
        ),
        400,
        corsFn
      );
    }
  }

  const rawMetaobjectId = url.searchParams.get("metaobjectId");
  const metaobjectId =
    typeof rawMetaobjectId === "string" ? rawMetaobjectId.trim() : "";
  if (!METAOBJECT_GID_REGEX.test(metaobjectId)) {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        400,
        "invalid_metaobject_id",
        "metaobjectId is required and must match gid://shopify/Metaobject/<digits>.",
        { observedAt }
      ),
      400,
      corsFn
    );
  }

  let requestedKeyCrossCheck = null;
  if (url.searchParams.has("requestKey")) {
    const rawReqKey = url.searchParams.get("requestKey");
    if (typeof rawReqKey !== "string") {
      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          400,
          "invalid_request_key",
          "requestKey must be a non-empty string up to 160 characters.",
          { observedAt }
        ),
        400,
        corsFn
      );
    }
    const cleanedKey = rawReqKey.replace(/[\u0000-\u001F\u007F]/g, " ").trim();
    if (!cleanedKey || cleanedKey.length > MAX_REQUEST_KEY_CHARS) {
      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          400,
          "invalid_request_key",
          `requestKey must be between 1 and ${MAX_REQUEST_KEY_CHARS} characters.`,
          { observedAt }
        ),
        400,
        corsFn
      );
    }
    requestedKeyCrossCheck = cleanedKey;
  }

  if (!admin || typeof admin.graphql !== "function") {
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        500,
        "missing_admin_graphql_client",
        "Authenticated Shopify Admin GraphQL client is unavailable.",
        {
          observedAt,
          localProcessLock: {
            inCurrentProcess: isResearchInFlightLocally(authenticatedShop, metaobjectId),
            scope: "single_process_ram_only",
            globalInactivityProven: false,
          },
        }
      ),
      500,
      corsFn
    );
  }

  try {
    const readRes = await readSingleResearchMetaobject(admin, metaobjectId);
    if (!readRes.ok) {
      if (readRes.kind === "not_found") {
        return buildBoundedJsonResponse(
          buildCompactErrorPayload(
            404,
            "metaobject_not_found",
            readRes.message,
            {
              observedAt,
              metaobjectId,
              localProcessLock: {
                inCurrentProcess: isResearchInFlightLocally(authenticatedShop, metaobjectId),
                scope: "single_process_ram_only",
                globalInactivityProven: false,
              },
            }
          ),
          404,
          corsFn
        );
      }

      if (readRes.kind === "wrong_type") {
        return buildBoundedJsonResponse(
          buildCompactErrorPayload(
            400,
            "metaobject_type_mismatch",
            readRes.message,
            {
              observedAt,
              metaobjectId,
              expectedType: RESEARCH_METAOBJECT_TYPE,
            }
          ),
          400,
          corsFn
        );
      }

      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          500,
          "metaobject_read_failed",
          readRes.message,
          { observedAt }
        ),
        500,
        corsFn
      );
    }

    const storedRequestKey =
      typeof readRes.fields.requestKey === "string" && readRes.fields.requestKey.trim()
        ? readRes.fields.requestKey.replace(/[\u0000-\u001F\u007F]/g, " ").trim()
        : null;

    if (
      requestedKeyCrossCheck !== null &&
      storedRequestKey !== null &&
      storedRequestKey !== requestedKeyCrossCheck
    ) {
      return buildBoundedJsonResponse(
        buildCompactErrorPayload(
          409,
          "request_key_mismatch",
          "Supplied requestKey does not match the saved requestKey on the requested metaobject.",
          {
            observedAt,
            metaobjectId,
          }
        ),
        409,
        corsFn
      );
    }

    const statusMeta = buildSingleRequestStatusMetadata({
      shop: authenticatedShop,
      metaobjectId: readRes.id,
      requestKey: requestedKeyCrossCheck ?? storedRequestKey,
      fields: readRes.fields,
      observedAt,
    });

    return buildBoundedJsonResponse(
      {
        ok: true,
        status: "ok",
        ...statusMeta,
        metaobjectUpdatedAt: readRes.updatedAt,
      },
      200,
      corsFn
    );
  } catch (err) {
    if (isResponseLike(err)) {
      throw err;
    }
    return buildBoundedJsonResponse(
      buildCompactErrorPayload(
        500,
        "internal_status_read_error",
        "Unexpected error while reading research request status.",
        { observedAt }
      ),
      500,
      corsFn
    );
  }
}

export async function action({ request }) {
  const observedAt = new Date().toISOString();
  let corsFn = null;
  try {
    const authContext = await authenticate.admin(request);
    corsFn = typeof authContext?.cors === "function" ? authContext.cors : null;
  } catch (err) {
    if (isResponseLike(err)) {
      throw err;
    }
  }

  return buildBoundedJsonResponse(
    buildCompactErrorPayload(
      405,
      "method_not_allowed",
      "Status endpoint is strictly read-only and accepts GET only.",
      { observedAt }
    ),
    405,
    corsFn,
    { Allow: "GET" }
  );
}
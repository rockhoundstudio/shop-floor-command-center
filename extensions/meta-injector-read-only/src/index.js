const TELEMETRY_ENDPOINT =
  "https://shop-floor-command-center.onrender.com/api/meta-injector-telemetry";
const REQUEST_TIMEOUT_MS = 4500;
const MAX_RESPONSE_UTF8_BYTES = 3500;
const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;

const ALLOWED_LIST_KEYS = new Set([
  "productId",
  "mode",
  "limit",
  "afterReportId",
]);

const ALLOWED_READ_KEYS = new Set([
  "reportId",
  "section",
  "view",
  "drawer",
  "fieldKey",
  "chunkIndex",
]);

const ALLOWED_READ_SECTIONS = new Set(["report", "ui_audit"]);

const ALLOWED_READ_VIEWS = new Set([
  "chunk",
  "index",
  "header",
  "review",
  "drawer",
  "field",
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function getUtf8ByteLength(str) {
  const text = String(str);
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

function finalizeSafeOutput(payload) {
  if (
    !isPlainObject(payload) ||
    typeof payload.ok !== "boolean" ||
    typeof payload.status !== "string" ||
    payload.status.trim().length === 0
  ) {
    return {
      ok: false,
      status: "error",
      code: "invalid_backend_contract",
      message: "Backend response did not include required boolean ok and string status fields.",
    };
  }

  let serialized = "";
  try {
    serialized = JSON.stringify(payload);
  } catch {
    return {
      ok: false,
      status: "error",
      code: "serialization_failure",
      message: "Failed to serialize tool output safely.",
    };
  }

  if (
    typeof serialized !== "string" ||
    getUtf8ByteLength(serialized) > MAX_RESPONSE_UTF8_BYTES
  ) {
    return {
      ok: false,
      status: "error",
      code: "response_too_large",
      message:
        "Response exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
    };
  }

  return payload;
}

function buildErrorResult(status, code, message, extra = null) {
  const payload = {
    ok: false,
    status,
    code,
    message,
  };
  if (isPlainObject(extra)) {
    const keys = Object.keys(extra);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (
        key !== "ok" &&
        key !== "status" &&
        key !== "code" &&
        key !== "message"
      ) {
        payload[key] = extra[key];
      }
    }
  }
  return finalizeSafeOutput(payload);
}

function validateAllowedKeys(inputObj, allowedSet, opLabel) {
  const keys = Object.keys(inputObj);
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    if (!allowedSet.has(key)) {
      return buildErrorResult(
        "invalid_request",
        "unsupported_parameter",
        `Unsupported input property "${key}" for ${opLabel}.`
      );
    }
  }
  return null;
}

function buildListSearchParams(rawInput) {
  const input = rawInput === undefined || rawInput === null ? {} : rawInput;
  if (!isPlainObject(input)) {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "invalid_input",
        "Tool input must be a plain object."
      ),
    };
  }

  const keyError = validateAllowedKeys(
    input,
    ALLOWED_LIST_KEYS,
    "list_meta_injector_reports"
  );
  if (keyError) {
    return { ok: false, error: keyError };
  }

  const params = new URLSearchParams();
  params.set("op", "list");

  if (input.productId !== undefined && input.productId !== null) {
    if (typeof input.productId !== "string") {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_product_id",
          "productId filter must match gid://shopify/Product/<digits>."
        ),
      };
    }
    const trimmedProductId = input.productId.trim();
    if (!PRODUCT_GID_REGEX.test(trimmedProductId)) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_product_id",
          "productId filter must match gid://shopify/Product/<digits>."
        ),
      };
    }
    params.set("productId", trimmedProductId);
  }

  if (input.mode !== undefined && input.mode !== null) {
    if (typeof input.mode !== "string") {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_mode",
          "mode filter must be a nonempty string up to 120 characters when provided."
        ),
      };
    }
    const trimmedMode = input.mode.trim();
    if (trimmedMode.length === 0 || trimmedMode.length > 120) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_mode",
          "mode filter must be a nonempty string up to 120 characters when provided."
        ),
      };
    }
    params.set("mode", trimmedMode);
  }

  if (input.limit !== undefined && input.limit !== null) {
    if (
      typeof input.limit !== "number" ||
      !Number.isInteger(input.limit) ||
      input.limit < 1 ||
      input.limit > 5
    ) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_limit",
          "limit must be an integer between 1 and 5."
        ),
      };
    }
    params.set("limit", String(input.limit));
  }

  if (input.afterReportId !== undefined && input.afterReportId !== null) {
    if (typeof input.afterReportId !== "string") {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_cursor",
          "afterReportId must be a nonempty reportId string when provided."
        ),
      };
    }
    const trimmedCursor = input.afterReportId.trim();
    if (trimmedCursor.length === 0) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_cursor",
          "afterReportId must be a nonempty reportId string when provided."
        ),
      };
    }
    params.set("afterReportId", trimmedCursor);
  }

  return { ok: true, params };
}

function buildReadSearchParams(rawInput) {
  if (!isPlainObject(rawInput)) {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "invalid_input",
        "Tool input must be a plain object with a required reportId."
      ),
    };
  }

  const keyError = validateAllowedKeys(
    rawInput,
    ALLOWED_READ_KEYS,
    "read_meta_injector_report"
  );
  if (keyError) {
    return { ok: false, error: keyError };
  }

  if (typeof rawInput.reportId !== "string" || rawInput.reportId.trim().length === 0) {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "invalid_report_id",
        "A nonempty reportId string is required."
      ),
    };
  }

  const params = new URLSearchParams();
  params.set("op", "read");
  params.set("reportId", rawInput.reportId.trim());

  let effectiveSection = "report";
  if (rawInput.section !== undefined && rawInput.section !== null) {
    if (typeof rawInput.section !== "string") {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_section",
          'section must be either "report" or "ui_audit".'
        ),
      };
    }
    const trimmedSection = rawInput.section.trim();
    if (!ALLOWED_READ_SECTIONS.has(trimmedSection)) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_section",
          'section must be either "report" or "ui_audit".'
        ),
      };
    }
    effectiveSection = trimmedSection;
    params.set("section", effectiveSection);
  }

  let effectiveView = "chunk";
  if (rawInput.view !== undefined && rawInput.view !== null) {
    if (typeof rawInput.view !== "string") {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_view",
          'view must be one of "chunk", "index", "header", "review", "drawer", or "field".'
        ),
      };
    }
    const trimmedView = rawInput.view.trim();
    if (!ALLOWED_READ_VIEWS.has(trimmedView)) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_view",
          'view must be one of "chunk", "index", "header", "review", "drawer", or "field".'
        ),
      };
    }
    effectiveView = trimmedView;
    params.set("view", effectiveView);
  }

  if (effectiveSection === "ui_audit" && effectiveView !== "chunk") {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "incompatible_section_and_view",
        'When section is "ui_audit", view must be "chunk" (or omitted).'
      ),
    };
  }

  const hasDrawer = rawInput.drawer !== undefined && rawInput.drawer !== null;
  const hasFieldKey = rawInput.fieldKey !== undefined && rawInput.fieldKey !== null;

  if (hasDrawer && typeof rawInput.drawer !== "string") {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "invalid_drawer",
        "drawer must be a string when provided."
      ),
    };
  }

  if (hasFieldKey && typeof rawInput.fieldKey !== "string") {
    return {
      ok: false,
      error: buildErrorResult(
        "invalid_request",
        "invalid_field_key",
        "fieldKey must be a string when provided."
      ),
    };
  }

  const trimmedDrawer = hasDrawer ? rawInput.drawer.trim() : null;
  const trimmedFieldKey = hasFieldKey ? rawInput.fieldKey.trim() : null;

  if (effectiveView === "drawer") {
    if (!trimmedDrawer || trimmedDrawer.length > 200) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "missing_drawer",
          'A nonempty "drawer" string (up to 200 characters) is required when view="drawer".'
        ),
      };
    }
    if (hasFieldKey) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "unexpected_field_key",
          'fieldKey is not accepted when view="drawer".'
        ),
      };
    }
    params.set("drawer", trimmedDrawer);
  } else if (effectiveView === "field") {
    if (!trimmedFieldKey || trimmedFieldKey.length > 200) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "missing_field_key",
          'A nonempty "fieldKey" string (up to 200 characters) is required when view="field".'
        ),
      };
    }
    if (hasDrawer) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "unexpected_drawer",
          'drawer is not accepted when view="field".'
        ),
      };
    }
    params.set("fieldKey", trimmedFieldKey);
  } else {
    if (hasDrawer) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "unexpected_drawer",
          `drawer parameter is only supported when view="drawer" (received view="${effectiveView}").`
        ),
      };
    }
    if (hasFieldKey) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "unexpected_field_key",
          `fieldKey parameter is only supported when view="field" (received view="${effectiveView}").`
        ),
      };
    }
  }

  if (rawInput.chunkIndex !== undefined && rawInput.chunkIndex !== null) {
    if (
      typeof rawInput.chunkIndex !== "number" ||
      !Number.isSafeInteger(rawInput.chunkIndex) ||
      rawInput.chunkIndex < 0
    ) {
      return {
        ok: false,
        error: buildErrorResult(
          "invalid_request",
          "invalid_chunk_index",
          "chunkIndex must be a non-negative integer."
        ),
      };
    }
    params.set("chunkIndex", String(rawInput.chunkIndex));
  }

  return { ok: true, params };
}

async function fetchTelemetryGet(searchParams) {
  const controller = new AbortController();
  let timedOut = false;

  const timerId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  const requestUrl = `${TELEMETRY_ENDPOINT}?${searchParams.toString()}`;

  try {
    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      redirect: "manual",
      signal: controller.signal,
    });

    if (
      response.type === "opaqueredirect" ||
      response.redirected ||
      (response.status >= 300 && response.status < 400)
    ) {
      return buildErrorResult(
        "error",
        "authentication_redirect_blocked",
        "Telemetry endpoint returned a redirect instead of authenticated JSON; redirects are not followed."
      );
    }

    const rawText = await response.text();

    if (getUtf8ByteLength(rawText) > MAX_RESPONSE_UTF8_BYTES) {
      return buildErrorResult(
        "error",
        "response_too_large",
        "Response body exceeded the 3500 UTF-8 byte ceiling; report text was not truncated."
      );
    }

    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    const isJsonContentType = contentType.includes("application/json");

    let parsed = null;
    if (rawText.trim().length > 0) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (
      isPlainObject(parsed) &&
      typeof parsed.ok === "boolean" &&
      typeof parsed.status === "string" &&
      parsed.status.trim().length > 0
    ) {
      return finalizeSafeOutput(parsed);
    }

    if (response.status === 401 || response.status === 403) {
      return buildErrorResult(
        "error",
        "authentication_failed",
        `Telemetry endpoint rejected authentication or authorization (HTTP ${response.status}).`
      );
    }

    if (!isJsonContentType || parsed === null) {
      return buildErrorResult(
        "error",
        "non_json_response",
        `Telemetry endpoint returned a non-JSON or malformed response (HTTP ${response.status}).`
      );
    }

    return buildErrorResult(
      "error",
      "invalid_backend_contract",
      `Telemetry endpoint returned JSON without required ok/status fields (HTTP ${response.status}).`
    );
  } catch (err) {
    if (timedOut || (err && typeof err === "object" && err.name === "AbortError")) {
      return buildErrorResult(
        "error",
        "request_timeout",
        `Telemetry request timed out after ${REQUEST_TIMEOUT_MS}ms.`
      );
    }
    return buildErrorResult(
      "error",
      "network_error",
      "Network or CORS failure while contacting the telemetry endpoint."
    );
  } finally {
    clearTimeout(timerId);
  }
}

export default async function extension() {
  shopify.tools.register("list_meta_injector_reports", async (input) => {
    const built = buildListSearchParams(input);
    if (!built.ok) {
      return built.error;
    }
    return await fetchTelemetryGet(built.params);
  });

  shopify.tools.register("read_meta_injector_report", async (input) => {
    const built = buildReadSearchParams(input);
    if (!built.ok) {
      return built.error;
    }
    return await fetchTelemetryGet(built.params);
  });
}
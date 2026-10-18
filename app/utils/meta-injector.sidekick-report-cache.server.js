import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const CACHE_GLOBAL_KEY = "__ROCKHOUND_META_INJECTOR_SIDEKICK_REPORT_CACHE_V1__";
const CACHE_SCHEMA_VERSION = 1;

const TTL_MS = 30 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

const MAX_REPORTS_PER_SHOP = 20;
const MAX_REPORTS_GLOBAL = 200;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const MAX_FULL_TEXT_CODE_UNITS = 120000;
const MAX_FULL_TEXT_UTF8_BYTES = 512 * 1024;
const MAX_UI_AUDIT_UTF8_BYTES = 32 * 1024;

const MAX_CHUNK_UTF8_BYTES = 2000;
const MAX_RESPONSE_UTF8_BYTES = 3500;

const MIN_LIST_LIMIT = 1;
const DEFAULT_LIST_LIMIT = 3;
const MAX_LIST_LIMIT = 5;

const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;

const CREDENTIAL_PATTERNS = [
  /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/i,
  /\bshpat_[a-fA-F0-9]{32,}\b/,
  /\bshpca_[a-fA-F0-9]{32,}\b/,
  /\bshpss_[a-fA-F0-9]{32,}\b/,
  /\bshpua_[a-fA-F0-9]{32,}\b/,
  /\bshprt_[a-fA-F0-9]{32,}\b/,
  /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}\b/i,
  /\b(?:access_token|refresh_token|client_secret|private_key|api_key|authorization)\b\s*[:=]\s*["']?[A-Za-z0-9._~+/=-]{16,}/i,
];

const FORBIDDEN_AUDIT_KEY_REGEX =
  /^(?:authorization|cookie|set-cookie|session|session_id|sessionid|access_token|accesstoken|refresh_token|refreshtoken|client_secret|clientsecret|private_key|privatekey|api_key|apikey|secret|password|token)$/i;

function getCacheState() {
  const existing = globalThis[CACHE_GLOBAL_KEY];
  if (
    existing &&
    typeof existing === "object" &&
    existing.version === CACHE_SCHEMA_VERSION &&
    existing.recordsById instanceof Map &&
    existing.shopIndex instanceof Map &&
    existing.shopStats instanceof Map &&
    typeof existing.totalBytes === "number"
  ) {
    return existing;
  }

  const initialized = {
    version: CACHE_SCHEMA_VERSION,
    createdAtMs: Date.now(),
    totalBytes: 0,
    totalStoredCount: 0,
    totalEvictedCount: 0,
    recordsById: new Map(),
    shopIndex: new Map(),
    shopStats: new Map(),
  };

  Object.defineProperty(globalThis, CACHE_GLOBAL_KEY, {
    value: initialized,
    writable: false,
    enumerable: false,
    configurable: true,
  });

  return initialized;
}

function getShopStats(state, shop) {
  let stats = state.shopStats.get(shop);
  if (!stats) {
    stats = {
      storedCount: 0,
      expiredCount: 0,
      evictedCount: 0,
      lastCapturedAtMs: null,
    };
    state.shopStats.set(shop, stats);
  }
  return stats;
}

function utf8ByteLength(str) {
  return Buffer.byteLength(String(str), "utf8");
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function finalizeResponse(payload, fallbackErrorCode = "response_too_large") {
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

function validateShop(shop) {
  if (typeof shop !== "string") {
    return { ok: false, message: "A nonempty shop string is required." };
  }
  const normalized = shop.trim().toLowerCase();
  if (!normalized || normalized.length > 255 || /\s/.test(normalized)) {
    return { ok: false, message: "A valid nonempty shop identifier is required." };
  }
  if (containsRecognizableCredentials(normalized)) {
    return { ok: false, message: "Invalid shop identifier." };
  }
  return { ok: true, shop: normalized };
}

function containsRecognizableCredentials(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }
  for (let i = 0; i < CREDENTIAL_PATTERNS.length; i += 1) {
    if (CREDENTIAL_PATTERNS[i].test(text)) {
      return true;
    }
  }
  return false;
}

function inspectAuditValue(value, depth = 0) {
  if (depth > 24) {
    return { ok: false, reason: "uiAudit exceeds maximum nesting depth." };
  }
  if (value === null) {
    return { ok: true };
  }
  const valueType = typeof value;
  if (valueType === "boolean") {
    return { ok: true };
  }
  if (valueType === "number") {
    if (!Number.isFinite(value)) {
      return { ok: false, reason: "uiAudit contains non-finite numbers." };
    }
    return { ok: true };
  }
  if (valueType === "string") {
    if (containsRecognizableCredentials(value)) {
      return {
        ok: false,
        reason: "uiAudit contains recognizable credential or private-key material.",
      };
    }
    return { ok: true };
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const check = inspectAuditValue(value[i], depth + 1);
      if (!check.ok) {
        return check;
      }
    }
    return { ok: true };
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      if (FORBIDDEN_AUDIT_KEY_REGEX.test(key) || containsRecognizableCredentials(key)) {
        return {
          ok: false,
          reason: "uiAudit contains forbidden credential, session, or token properties.",
        };
      }
      const check = inspectAuditValue(value[key], depth + 1);
      if (!check.ok) {
        return check;
      }
    }
    return { ok: true };
  }
  return { ok: false, reason: "uiAudit must contain only strict JSON types." };
}

function canonicalizeJsonValue(value) {
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

function splitUtf8CodePoints(text, maxBytesPerChunk = MAX_CHUNK_UTF8_BYTES) {
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

function normalizeUiAudit(uiAudit) {
  if (uiAudit === null || uiAudit === undefined) {
    return {
      ok: true,
      state: "not_measured",
      canonicalJson: null,
      utf8Bytes: 0,
      chunks: Object.freeze([]),
    };
  }

  let parsed = null;
  if (typeof uiAudit === "string") {
    const trimmed = uiAudit.trim();
    if (!trimmed) {
      return {
        ok: false,
        code: "invalid_ui_audit",
        message: "uiAudit string cannot be empty when provided; pass null if not_measured.",
      };
    }
    if (utf8ByteLength(uiAudit) > MAX_UI_AUDIT_UTF8_BYTES) {
      return {
        ok: false,
        code: "ui_audit_too_large",
        message: "uiAudit exceeds maximum 32 KiB UTF-8 size.",
      };
    }
    try {
      parsed = JSON.parse(uiAudit);
    } catch {
      return {
        ok: false,
        code: "invalid_ui_audit",
        message: "uiAudit string is not valid JSON.",
      };
    }
  } else if (isPlainObject(uiAudit) || Array.isArray(uiAudit)) {
    try {
      const rawSerialized = JSON.stringify(uiAudit);
      if (typeof rawSerialized !== "string") {
        return {
          ok: false,
          code: "invalid_ui_audit",
          message: "uiAudit could not be serialized to JSON.",
        };
      }
      if (utf8ByteLength(rawSerialized) > MAX_UI_AUDIT_UTF8_BYTES) {
        return {
          ok: false,
          code: "ui_audit_too_large",
          message: "uiAudit exceeds maximum 32 KiB UTF-8 size.",
        };
      }
      parsed = JSON.parse(rawSerialized);
    } catch {
      return {
        ok: false,
        code: "invalid_ui_audit",
        message: "uiAudit is not valid JSON-serializable content.",
      };
    }
  } else {
    return {
      ok: false,
      code: "invalid_ui_audit",
      message: "uiAudit must be a JSON object, JSON array, valid JSON string, or null.",
    };
  }

  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      code: "invalid_ui_audit",
      message: "uiAudit root must be a JSON object or array representing measured UI state.",
    };
  }

  const inspection = inspectAuditValue(parsed, 0);
  if (!inspection.ok) {
    return {
      ok: false,
      code: "invalid_ui_audit",
      message: inspection.reason,
    };
  }

  const canonicalObj = canonicalizeJsonValue(parsed);
  const canonicalJson = JSON.stringify(canonicalObj);
  const utf8Bytes = utf8ByteLength(canonicalJson);

  if (utf8Bytes > MAX_UI_AUDIT_UTF8_BYTES) {
    return {
      ok: false,
      code: "ui_audit_too_large",
      message: "uiAudit exceeds maximum 32 KiB UTF-8 size.",
    };
  }

  const chunks = splitUtf8CodePoints(canonicalJson, MAX_CHUNK_UTF8_BYTES);
  if (chunks.join("") !== canonicalJson) {
    return {
      ok: false,
      code: "audit_chunk_integrity_failure",
      message: "Failed lossless UTF-8 code-point chunk verification for uiAudit.",
    };
  }

  return {
    ok: true,
    state: "measured",
    canonicalJson,
    utf8Bytes,
    chunks,
  };
}

function parseStrictIsoTimestamp(value) {
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
  const parsedMs = Date.parse(trimmed);
  if (!Number.isFinite(parsedMs)) {
    return null;
  }
  return { raw: trimmed, ms: parsedMs };
}

function sanitizeOptionalShortString(value, maxCodeUnits = 300) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  if (value.length > maxCodeUnits) {
    return null;
  }
  if (containsRecognizableCredentials(value)) {
    return { rejected: true };
  }
  return value;
}

function sanitizeOptionalNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function sanitizePartsMetadata(parts, activePartIndex) {
  if (!Array.isArray(parts)) {
    return {
      ok: true,
      partCount: 0,
      activePartIndex: sanitizeOptionalNumber(activePartIndex),
      partsMeta: Object.freeze([]),
    };
  }

  if (parts.length > 256) {
    return {
      ok: false,
      code: "invalid_packet",
      message: "packet.parts exceeds maximum allowed part count.",
    };
  }

  const partsMeta = [];
  for (let i = 0; i < parts.length; i += 1) {
    const item = parts[i];
    if (!item || typeof item !== "object") {
      continue;
    }
    const labelCheck = sanitizeOptionalShortString(item.label, 200);
    if (labelCheck && typeof labelCheck === "object" && labelCheck.rejected) {
      return {
        ok: false,
        code: "credential_material_rejected",
        message: "Packet part metadata contains recognizable credential material.",
      };
    }
    if (typeof item.text === "string" && containsRecognizableCredentials(item.text)) {
      return {
        ok: false,
        code: "credential_material_rejected",
        message: "Packet part text contains recognizable credential material.",
      };
    }
    partsMeta.push(
      Object.freeze({
        index: sanitizeOptionalNumber(item.index),
        partNumber: sanitizeOptionalNumber(item.partNumber),
        totalParts: sanitizeOptionalNumber(item.totalParts),
        label: typeof labelCheck === "string" ? labelCheck : null,
        charCount:
          sanitizeOptionalNumber(item.charCount) ??
          (typeof item.text === "string" ? item.text.length : null),
      })
    );
  }

  return {
    ok: true,
    partCount: partsMeta.length,
    activePartIndex: sanitizeOptionalNumber(activePartIndex),
    partsMeta: Object.freeze(partsMeta),
  };
}

function computeReportId({
  shop,
  productId,
  mode,
  sectionKey,
  sectionLabel,
  productTitle,
  runIdentity,
  runTimestamp,
  capturedAt,
  limitUsed,
  fullText,
  uiAuditState,
  uiAuditCanonicalJson,
}) {
  const hash = createHash("sha256");
  const updateField = (tag, val) => {
    const str = val === null || val === undefined ? "" : String(val);
    hash.update(`${tag}:${utf8ByteLength(str)}:${str}\n`, "utf8");
  };

  updateField("shop", shop);
  updateField("productId", productId);
  updateField("mode", mode);
  updateField("sectionKey", sectionKey);
  updateField("sectionLabel", sectionLabel);
  updateField("productTitle", productTitle);
  updateField("runIdentity", runIdentity);
  updateField("runTimestamp", runTimestamp);
  updateField("capturedAt", capturedAt);
  updateField("limitUsed", limitUsed);
  updateField("fullText", fullText);
  updateField("uiAuditState", uiAuditState);
  updateField("uiAuditJson", uiAuditCanonicalJson);

  return `srep_${hash.digest("hex")}`;
}

function removeRecordFromState(state, record, reason = "evicted") {
  if (!record || !state.recordsById.has(record.reportId)) {
    return;
  }

  state.recordsById.delete(record.reportId);
  state.totalBytes = Math.max(0, state.totalBytes - record.estimatedBytes);

  const shopSet = state.shopIndex.get(record.shop);
  if (shopSet) {
    shopSet.delete(record.reportId);
    if (shopSet.size === 0) {
      state.shopIndex.delete(record.shop);
    }
  }

  const stats = getShopStats(state, record.shop);
  if (reason === "expired") {
    stats.expiredCount += 1;
  } else {
    stats.evictedCount += 1;
    state.totalEvictedCount += 1;
  }
}

function purgeExpiredRecords(state, nowMs) {
  for (const record of state.recordsById.values()) {
    if (record.expiresAtMs <= nowMs) {
      removeRecordFromState(state, record, "expired");
    }
  }
}

function compareOldestFirst(a, b) {
  if (a.capturedAtMs !== b.capturedAtMs) {
    return a.capturedAtMs - b.capturedAtMs;
  }
  if (a.storedAtMs !== b.storedAtMs) {
    return a.storedAtMs - b.storedAtMs;
  }
  return a.reportId.localeCompare(b.reportId);
}

function compareNewestFirst(a, b) {
  if (a.capturedAtMs !== b.capturedAtMs) {
    return b.capturedAtMs - a.capturedAtMs;
  }
  if (a.storedAtMs !== b.storedAtMs) {
    return b.storedAtMs - a.storedAtMs;
  }
  return a.reportId.localeCompare(b.reportId);
}

function enforceCapacityLimits(state, targetShop, incomingBytes) {
  const shopSet = state.shopIndex.get(targetShop);
  if (shopSet && shopSet.size >= MAX_REPORTS_PER_SHOP) {
    const shopRecords = [];
    for (const id of shopSet) {
      const rec = state.recordsById.get(id);
      if (rec) {
        shopRecords.push(rec);
      }
    }
    shopRecords.sort(compareOldestFirst);
    const removeCount = shopRecords.length - MAX_REPORTS_PER_SHOP + 1;
    for (let i = 0; i < removeCount && i < shopRecords.length; i += 1) {
      removeRecordFromState(state, shopRecords[i], "evicted");
    }
  }

  if (state.recordsById.size >= MAX_REPORTS_GLOBAL) {
    const allRecords = Array.from(state.recordsById.values()).sort(compareOldestFirst);
    const removeCount = allRecords.length - MAX_REPORTS_GLOBAL + 1;
    for (let i = 0; i < removeCount && i < allRecords.length; i += 1) {
      removeRecordFromState(state, allRecords[i], "evicted");
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const allRecords = Array.from(state.recordsById.values()).sort(compareOldestFirst);
    for (let i = 0; i < allRecords.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeRecordFromState(state, allRecords[i], "evicted");
    }
  }
}

function formatRecordMetadata(record) {
  return {
    reportId: record.reportId,
    productId: record.productId,
    productTitle: record.productTitle,
    mode: record.mode,
    sectionKey: record.sectionKey,
    sectionLabel: record.sectionLabel,
    runIdentity: record.runIdentity,
    runTimestamp: record.runTimestamp,
    capturedAt: record.capturedAt,
    expiresAt: record.expiresAt,
    limitUsed: record.limitUsed,
    clipboardPartCount: record.clipboardPartCount,
    activePartIndex: record.activePartIndex,
    reportUtf8Bytes: record.reportUtf8Bytes,
    reportChunkCount: record.reportChunks.length,
    uiAuditState: record.uiAuditState,
    uiAuditUtf8Bytes: record.uiAuditUtf8Bytes,
    uiAuditChunkCount: record.uiAuditChunks.length,
  };
}

export function storeTelemetryReport(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_options",
      message: "storeTelemetryReport requires a single options object.",
    });
  }

  const { shop: rawShop, packet, uiAudit = null } = options;
  const shopCheck = validateShop(rawShop);
  if (!shopCheck.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_shop",
      message: shopCheck.message,
    });
  }
  const shop = shopCheck.shop;

  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_packet",
      message: "A valid packet object is required.",
    });
  }

  const productId = typeof packet.productId === "string" ? packet.productId.trim() : "";
  if (!PRODUCT_GID_REGEX.test(productId)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_product_id",
      message: "packet.productId must match gid://shopify/Product/<digits>.",
    });
  }

  if (typeof packet.fullText !== "string" || packet.fullText.trim().length === 0) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "empty_full_text",
      message: "packet.fullText must be a nonempty string.",
    });
  }

  const fullText = packet.fullText;
  if (fullText.length > MAX_FULL_TEXT_CODE_UNITS) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "full_text_too_large",
      message: `packet.fullText exceeds maximum ${MAX_FULL_TEXT_CODE_UNITS} UTF-16 code units.`,
    });
  }

  const reportUtf8Bytes = utf8ByteLength(fullText);
  if (reportUtf8Bytes > MAX_FULL_TEXT_UTF8_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "full_text_too_large",
      message: `packet.fullText exceeds maximum ${MAX_FULL_TEXT_UTF8_BYTES} UTF-8 bytes.`,
    });
  }

  if (containsRecognizableCredentials(fullText)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "credential_material_rejected",
      message: "packet.fullText contains recognizable credential or private-key material.",
    });
  }

  const parsedCapturedAt = parseStrictIsoTimestamp(packet.capturedAt);
  if (!parsedCapturedAt) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_captured_at",
      message: "packet.capturedAt must be a valid ISO-8601 timestamp string.",
    });
  }

  const nowMs = Date.now();
  const state = getCacheState();
  purgeExpiredRecords(state, nowMs);

  const ageMs = nowMs - parsedCapturedAt.ms;
  if (ageMs > TTL_MS) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "capture_expired",
      message: "packet.capturedAt is older than the 30-minute TTL.",
    });
  }

  if (parsedCapturedAt.ms - nowMs > MAX_FUTURE_SKEW_MS) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "capture_in_future",
      message: "packet.capturedAt cannot be more than 2 minutes in the future.",
    });
  }

  const modeCheck = sanitizeOptionalShortString(packet.mode, 120);
  const sectionKeyCheck = sanitizeOptionalShortString(packet.sectionKey, 120);
  const sectionLabelCheck = sanitizeOptionalShortString(packet.sectionLabel, 200);
  const productTitleCheck = sanitizeOptionalShortString(packet.productTitle, 300);
  const runIdentityCheck = sanitizeOptionalShortString(packet.runIdentity, 240);
  const runTimestampCheck = sanitizeOptionalShortString(packet.runTimestamp, 120);

  const fieldChecks = [
    modeCheck,
    sectionKeyCheck,
    sectionLabelCheck,
    productTitleCheck,
    runIdentityCheck,
    runTimestampCheck,
  ];
  for (let i = 0; i < fieldChecks.length; i += 1) {
    const check = fieldChecks[i];
    if (check && typeof check === "object" && check.rejected) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "credential_material_rejected",
        message: "Packet metadata contains recognizable credential or private-key material.",
      });
    }
  }

  const partsCheck = sanitizePartsMetadata(packet.parts, packet.activePartIndex);
  if (!partsCheck.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: partsCheck.code,
      message: partsCheck.message,
    });
  }

  const auditResult = normalizeUiAudit(uiAudit);
  if (!auditResult.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: auditResult.code,
      message: auditResult.message,
    });
  }

  const mode = typeof modeCheck === "string" && modeCheck.trim() ? modeCheck.trim() : null;
  const sectionKey =
    typeof sectionKeyCheck === "string" && sectionKeyCheck.trim()
      ? sectionKeyCheck.trim()
      : null;
  const sectionLabel =
    typeof sectionLabelCheck === "string" && sectionLabelCheck.trim()
      ? sectionLabelCheck.trim()
      : null;
  const productTitle =
    typeof productTitleCheck === "string" && productTitleCheck.trim()
      ? productTitleCheck.trim()
      : null;
  const runIdentity =
    typeof runIdentityCheck === "string" && runIdentityCheck.trim()
      ? runIdentityCheck.trim()
      : null;
  const runTimestamp =
    typeof runTimestampCheck === "string" && runTimestampCheck.trim()
      ? runTimestampCheck.trim()
      : null;
  const limitUsed = sanitizeOptionalNumber(packet.limitUsed);

  const reportId = computeReportId({
    shop,
    productId,
    mode,
    sectionKey,
    sectionLabel,
    productTitle,
    runIdentity,
    runTimestamp,
    capturedAt: parsedCapturedAt.raw,
    limitUsed,
    fullText,
    uiAuditState: auditResult.state,
    uiAuditCanonicalJson: auditResult.canonicalJson,
  });

  const existingRecord = state.recordsById.get(reportId);
  if (existingRecord && existingRecord.shop === shop) {
    return finalizeResponse({
      ok: true,
      status: "stored",
      deduplicated: true,
      report: formatRecordMetadata(existingRecord),
    });
  }

  const reportChunks = splitUtf8CodePoints(fullText, MAX_CHUNK_UTF8_BYTES);
  if (reportChunks.join("") !== fullText) {
    return finalizeResponse({
      ok: false,
      status: "error",
      code: "chunk_integrity_failure",
      message: "Failed lossless UTF-8 code-point chunk verification.",
    });
  }

  const metadataOverheadBytes =
    512 +
    utf8ByteLength(shop) +
    utf8ByteLength(productId) +
    utf8ByteLength(mode || "") +
    utf8ByteLength(sectionKey || "") +
    utf8ByteLength(sectionLabel || "") +
    utf8ByteLength(productTitle || "") +
    utf8ByteLength(runIdentity || "") +
    utf8ByteLength(runTimestamp || "");

  const estimatedBytes =
    reportUtf8Bytes * 2 + auditResult.utf8Bytes * 2 + metadataOverheadBytes;

  if (estimatedBytes > MAX_TOTAL_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "report_exceeds_cache_budget",
      message: "Report size exceeds total cache memory budget.",
    });
  }

  enforceCapacityLimits(state, shop, estimatedBytes);

  const expiresAtMs = parsedCapturedAt.ms + TTL_MS;
  const expiresAt = new Date(expiresAtMs).toISOString();

  const newRecord = Object.freeze({
    reportId,
    shop,
    productId,
    productTitle,
    mode,
    sectionKey,
    sectionLabel,
    runIdentity,
    runTimestamp,
    capturedAt: parsedCapturedAt.raw,
    capturedAtMs: parsedCapturedAt.ms,
    storedAt: new Date(nowMs).toISOString(),
    storedAtMs: nowMs,
    expiresAt,
    expiresAtMs,
    limitUsed,
    clipboardPartCount: partsCheck.partCount,
    activePartIndex: partsCheck.activePartIndex,
    partsMeta: partsCheck.partsMeta,
    fullText,
    reportUtf8Bytes,
    reportChunks,
    uiAuditState: auditResult.state,
    uiAuditCanonicalJson: auditResult.canonicalJson,
    uiAuditUtf8Bytes: auditResult.utf8Bytes,
    uiAuditChunks: auditResult.chunks,
    estimatedBytes,
  });

  state.recordsById.set(reportId, newRecord);
  state.totalBytes += estimatedBytes;
  state.totalStoredCount += 1;

  let shopSet = state.shopIndex.get(shop);
  if (!shopSet) {
    shopSet = new Set();
    state.shopIndex.set(shop, shopSet);
  }
  shopSet.add(reportId);

  const shopStats = getShopStats(state, shop);
  shopStats.storedCount += 1;
  shopStats.lastCapturedAtMs = parsedCapturedAt.ms;

  return finalizeResponse({
    ok: true,
    status: "stored",
    deduplicated: false,
    report: formatRecordMetadata(newRecord),
  });
}

export function listTelemetryReports(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_options",
      message: "listTelemetryReports requires a single options object.",
    });
  }

  const {
    shop: rawShop,
    productId = null,
    mode = null,
    limit = DEFAULT_LIST_LIMIT,
    afterReportId = null,
  } = options;

  const shopCheck = validateShop(rawShop);
  if (!shopCheck.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_shop",
      message: shopCheck.message,
    });
  }
  const shop = shopCheck.shop;

  let normalizedProductId = null;
  if (productId !== null && productId !== undefined) {
    if (typeof productId !== "string" || !PRODUCT_GID_REGEX.test(productId.trim())) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "invalid_product_id",
        message: "productId filter must match gid://shopify/Product/<digits>.",
      });
    }
    normalizedProductId = productId.trim();
  }

  let normalizedMode = null;
  if (mode !== null && mode !== undefined) {
    if (typeof mode !== "string" || !mode.trim() || mode.length > 120) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "invalid_mode",
        message: "mode filter must be a nonempty string when provided.",
      });
    }
    normalizedMode = mode.trim();
  }

  if (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_limit",
      message: "limit must be a positive integer.",
    });
  }
  const boundedLimit = Math.min(Math.max(limit, MIN_LIST_LIMIT), MAX_LIST_LIMIT);

  let normalizedCursor = null;
  if (afterReportId !== null && afterReportId !== undefined) {
    if (typeof afterReportId !== "string" || !afterReportId.trim()) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "invalid_cursor",
        message: "afterReportId must be a nonempty reportId string when provided.",
      });
    }
    normalizedCursor = afterReportId.trim();
  }

  const nowMs = Date.now();
  const state = getCacheState();
  purgeExpiredRecords(state, nowMs);

  const shopSet = state.shopIndex.get(shop);
  const shopStats = getShopStats(state, shop);

  const matchingRecords = [];
  if (shopSet) {
    for (const id of shopSet) {
      const rec = state.recordsById.get(id);
      if (!rec || rec.shop !== shop) {
        continue;
      }
      if (normalizedProductId && rec.productId !== normalizedProductId) {
        continue;
      }
      if (normalizedMode && rec.mode !== normalizedMode) {
        continue;
      }
      matchingRecords.push(rec);
    }
  }

  matchingRecords.sort(compareNewestFirst);

  let startIndex = 0;
  if (normalizedCursor !== null) {
    const cursorIndex = matchingRecords.findIndex(
      (rec) => rec.reportId === normalizedCursor
    );
    if (cursorIndex === -1) {
      return finalizeResponse({
        ok: false,
        status: "invalid_cursor",
        code: "after_report_id_not_found",
        message:
          "afterReportId cursor was not found in the active report set for this shop and filter scope; pagination was not restarted.",
        afterReportId: normalizedCursor,
      });
    }
    startIndex = cursorIndex + 1;
  }

  if (matchingRecords.length === 0) {
    const hadPriorShopActivity =
      shopStats.storedCount > 0 ||
      shopStats.expiredCount > 0 ||
      shopStats.evictedCount > 0;

    return finalizeResponse({
      ok: true,
      status: "unavailable",
      reason: hadPriorShopActivity
        ? "no_matching_active_reports_in_memory"
        : "cache_empty_or_process_restarted",
      message:
        "No matching captured Meta Injector reports are currently held in this process memory cache. Reports are volatile and do not persist across restarts or separate workers.",
      reports: [],
      pagination: {
        requestedLimit: boundedLimit,
        returnedCount: 0,
        totalMatching: 0,
        hasNextPage: false,
        nextAfterReportId: null,
      },
    });
  }

  const candidateSlice = matchingRecords.slice(
    startIndex,
    startIndex + boundedLimit
  );

  const selectedItems = [];
  for (let i = 0; i < candidateSlice.length; i += 1) {
    const formatted = formatRecordMetadata(candidateSlice[i]);
    const nextItems = [...selectedItems, formatted];
    const hasMore = startIndex + nextItems.length < matchingRecords.length;
    const nextCursor = hasMore
      ? candidateSlice[nextItems.length - 1].reportId
      : null;

    const testEnvelope = {
      ok: true,
      status: "ok",
      reports: nextItems,
      pagination: {
        requestedLimit: boundedLimit,
        returnedCount: nextItems.length,
        totalMatching: matchingRecords.length,
        hasNextPage: hasMore,
        nextAfterReportId: nextCursor,
      },
    };

    if (utf8ByteLength(JSON.stringify(testEnvelope)) <= MAX_RESPONSE_UTF8_BYTES) {
      selectedItems.push(formatted);
    } else {
      break;
    }
  }

  if (candidateSlice.length > 0 && selectedItems.length === 0) {
    return finalizeResponse({
      ok: false,
      status: "error",
      code: "metadata_exceeds_response_ceiling",
      message:
        "Single report metadata entry exceeds the 3500 UTF-8 byte response limit.",
    });
  }

  const hasNextPage = startIndex + selectedItems.length < matchingRecords.length;
  const nextAfterReportId =
    selectedItems.length > 0 && hasNextPage
      ? selectedItems[selectedItems.length - 1].reportId
      : null;

  return finalizeResponse({
    ok: true,
    status: "ok",
    reports: selectedItems,
    pagination: {
      requestedLimit: boundedLimit,
      returnedCount: selectedItems.length,
      totalMatching: matchingRecords.length,
      hasNextPage,
      nextAfterReportId,
    },
  });
}

export function readTelemetryReport(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_options",
      message: "readTelemetryReport requires a single options object.",
    });
  }

  const {
    shop: rawShop,
    reportId: rawReportId,
    section = "report",
    chunkIndex = 0,
  } = options;

  const shopCheck = validateShop(rawShop);
  if (!shopCheck.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_shop",
      message: shopCheck.message,
    });
  }
  const shop = shopCheck.shop;

  if (typeof rawReportId !== "string" || !rawReportId.trim()) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_report_id",
      message: "A nonempty reportId string is required.",
    });
  }
  const reportId = rawReportId.trim();

  if (section !== "report" && section !== "ui_audit") {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_section",
      message: 'section must be either "report" or "ui_audit".',
    });
  }

  if (typeof chunkIndex !== "number" || !Number.isInteger(chunkIndex) || chunkIndex < 0) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_chunk_index",
      message: "chunkIndex must be a non-negative integer.",
    });
  }

  const nowMs = Date.now();
  const state = getCacheState();
  purgeExpiredRecords(state, nowMs);

  const record = state.recordsById.get(reportId);
  if (!record || record.shop !== shop) {
    const shopStats = getShopStats(state, shop);
    const hadPriorShopActivity =
      shopStats.storedCount > 0 ||
      shopStats.expiredCount > 0 ||
      shopStats.evictedCount > 0;

    return finalizeResponse({
      ok: false,
      status: "not_found",
      code: hadPriorShopActivity ? "expired_or_not_found" : "cache_unavailable_or_not_found",
      reportId,
      section,
      message:
        "The requested reportId was not found for this shop. It may have expired after 30 minutes, been evicted, or been lost due to a server restart or separate worker process.",
    });
  }

  if (section === "ui_audit") {
    if (record.uiAuditState !== "measured" || !record.uiAuditCanonicalJson) {
      return finalizeResponse({
        ok: true,
        status: "not_measured",
        reportId: record.reportId,
        productId: record.productId,
        mode: record.mode,
        section: "ui_audit",
        uiAuditState: "not_measured",
        capturedAt: record.capturedAt,
        expiresAt: record.expiresAt,
        runIdentity: record.runIdentity,
        runTimestamp: record.runTimestamp,
        chunkIndex: 0,
        chunkCount: 0,
        hasMoreChunks: false,
        nextChunkIndex: null,
        text: null,
        message: "UI state was not_measured for this captured report.",
      });
    }

    const chunks = record.uiAuditChunks;
    if (chunkIndex >= chunks.length) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "chunk_index_out_of_range",
        reportId: record.reportId,
        section: "ui_audit",
        chunkIndex,
        chunkCount: chunks.length,
        message: `chunkIndex ${chunkIndex} is out of bounds for ui_audit with ${chunks.length} chunk(s).`,
      });
    }

    const chunkText = chunks[chunkIndex];
    const hasMoreChunks = chunkIndex + 1 < chunks.length;

    return finalizeResponse({
      ok: true,
      status: "ok",
      reportId: record.reportId,
      productId: record.productId,
      productTitle: record.productTitle,
      mode: record.mode,
      section: "ui_audit",
      uiAuditState: "measured",
      capturedAt: record.capturedAt,
      expiresAt: record.expiresAt,
      runIdentity: record.runIdentity,
      runTimestamp: record.runTimestamp,
      chunkIndex,
      chunkCount: chunks.length,
      chunkUtf8Bytes: utf8ByteLength(chunkText),
      totalUtf8Bytes: record.uiAuditUtf8Bytes,
      hasMoreChunks,
      nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
      text: chunkText,
    });
  }

  const chunks = record.reportChunks;
  if (chunkIndex >= chunks.length) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "chunk_index_out_of_range",
      reportId: record.reportId,
      section: "report",
      chunkIndex,
      chunkCount: chunks.length,
      message: `chunkIndex ${chunkIndex} is out of bounds for report with ${chunks.length} chunk(s).`,
    });
  }

  const chunkText = chunks[chunkIndex];
  const hasMoreChunks = chunkIndex + 1 < chunks.length;

  return finalizeResponse({
    ok: true,
    status: "ok",
    reportId: record.reportId,
    productId: record.productId,
    productTitle: record.productTitle,
    mode: record.mode,
    sectionKey: record.sectionKey,
    sectionLabel: record.sectionLabel,
    section: "report",
    uiAuditState: record.uiAuditState,
    capturedAt: record.capturedAt,
    expiresAt: record.expiresAt,
    runIdentity: record.runIdentity,
    runTimestamp: record.runTimestamp,
    limitUsed: record.limitUsed,
    clipboardPartCount: record.clipboardPartCount,
    activePartIndex: record.activePartIndex,
    chunkIndex,
    chunkCount: chunks.length,
    chunkUtf8Bytes: utf8ByteLength(chunkText),
    totalUtf8Bytes: record.reportUtf8Bytes,
    hasMoreChunks,
    nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
    text: chunkText,
  });
}
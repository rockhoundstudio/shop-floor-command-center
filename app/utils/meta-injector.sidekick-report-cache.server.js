// FILE: app/utils/meta-injector.sidekick-report-cache.server.js
import { createHash } from "node:crypto";
import { Buffer } from "node:buffer";

const CACHE_GLOBAL_KEY = "__ROCKHOUND_META_INJECTOR_SIDEKICK_REPORT_CACHE_V1__";
const CACHE_SCHEMA_VERSION = 3;

const TTL_MS = 30 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

const READ_PIN_IDLE_EXTENSION_MS = 3 * 60 * 1000;
const READ_PIN_MAX_LIFETIME_MS = 10 * 60 * 1000;
const MAX_PINNED_DETACHED_PER_SESSION = 2;
const MAX_PINNED_DETACHED_PER_SHOP = 4;

const MAX_REPORTS_PER_SHOP = 20;
const MAX_REPORTS_GLOBAL = 200;
const MAX_LIVE_SESSIONS_PER_SHOP = 8;
const MAX_LIVE_SESSIONS_GLOBAL = 64;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

const MAX_FULL_TEXT_CODE_UNITS = 400000;
const MAX_FULL_TEXT_UTF8_BYTES = 1024 * 1024;
const MAX_UI_AUDIT_UTF8_BYTES = 32 * 1024;

const MAX_CHUNK_UTF8_BYTES = 2000;
const MAX_ORGANIZED_VIEW_CHUNK_UTF8_BYTES = 1550;
const MAX_RESPONSE_UTF8_BYTES = 3500;

const MIN_LIST_LIMIT = 1;
const DEFAULT_LIST_LIMIT = 3;
const MAX_LIST_LIMIT = 5;

const LIVE_BENCH_MODE = "live_bench_state";
const DESCRIPTION_REVIEW_DRAWER_TITLE = "Description Review";
const DESCRIPTION_REVIEW_KEYS = Object.freeze([
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

const ALLOWED_READ_SECTIONS_SET = new Set(ALLOWED_READ_SECTIONS);
const ALLOWED_READ_VIEWS_SET = new Set(ALLOWED_READ_VIEWS);

const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const BENCH_SESSION_ID_REGEX = /^[A-Za-z0-9._:-]{6,120}$/;

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
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
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
    existing.recordMetaById instanceof Map &&
    existing.shopIndex instanceof Map &&
    existing.liveSessionsByKey instanceof Map &&
    existing.shopLiveSessions instanceof Map &&
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
    recordMetaById: new Map(),
    shopIndex: new Map(),
    liveSessionsByKey: new Map(),
    shopLiveSessions: new Map(),
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
      liveSyncCount: 0,
      liveClearedCount: 0,
      liveExpiredCount: 0,
    };
    state.shopStats.set(shop, stats);
  }
  return stats;
}

function createInitialRecordMeta() {
  return {
    isSuperseded: false,
    supersededAt: null,
    supersededReason: null,
    supersededByRevision: null,
    pinnedAtMs: null,
    pinHardExpiresAtMs: null,
    pinIdleExpiresAtMs: null,
  };
}

function getOrCreateRecordMeta(state, reportId) {
  let meta = state.recordMetaById.get(reportId);
  if (!meta) {
    meta = createInitialRecordMeta();
    state.recordMetaById.set(reportId, meta);
  }
  return meta;
}

function getEffectivePinExpiresAtMs(meta) {
  if (
    !meta ||
    typeof meta.pinnedAtMs !== "number" ||
    typeof meta.pinIdleExpiresAtMs !== "number" ||
    typeof meta.pinHardExpiresAtMs !== "number"
  ) {
    return null;
  }
  return Math.min(meta.pinIdleExpiresAtMs, meta.pinHardExpiresAtMs);
}

function hasActiveReadPin(meta, nowMs) {
  const effectivePinExp = getEffectivePinExpiresAtMs(meta);
  if (effectivePinExp === null) {
    return false;
  }
  return nowMs < effectivePinExp;
}

function isRecordSuperseded(state, record) {
  if (!record) {
    return false;
  }
  const meta = state.recordMetaById.get(record.reportId);
  return Boolean(meta && meta.isSuperseded === true);
}

function activateOrRenewLiveReadPin(state, record, section, chunkIndex, nowMs) {
  if (!record || !record.isLiveBenchState) {
    return null;
  }
  const meta = getOrCreateRecordMeta(state, record.reportId);

  if (hasActiveReadPin(meta, nowMs)) {
    meta.pinIdleExpiresAtMs = Math.min(
      nowMs + READ_PIN_IDLE_EXTENSION_MS,
      meta.pinHardExpiresAtMs
    );
    return meta;
  }

  // Expired pins are never revived; a new pin can only start on an active (non-superseded)
  // report within its base 30-minute TTL when reading section="report" at chunkIndex=0
  // (including valid organized views at chunkIndex=0).
  if (
    meta.pinnedAtMs === null &&
    !meta.isSuperseded &&
    nowMs < record.expiresAtMs &&
    section === "report" &&
    chunkIndex === 0
  ) {
    meta.pinnedAtMs = nowMs;
    meta.pinHardExpiresAtMs = nowMs + READ_PIN_MAX_LIFETIME_MS;
    meta.pinIdleExpiresAtMs = Math.min(
      nowMs + READ_PIN_IDLE_EXTENSION_MS,
      meta.pinHardExpiresAtMs
    );
  }

  return meta;
}

function compareDetachedPinnedOldestFirst(state, a, b) {
  const metaA = state.recordMetaById.get(a.reportId);
  const metaB = state.recordMetaById.get(b.reportId);
  const pinA = typeof metaA?.pinnedAtMs === "number" ? metaA.pinnedAtMs : a.storedAtMs;
  const pinB = typeof metaB?.pinnedAtMs === "number" ? metaB.pinnedAtMs : b.storedAtMs;
  if (pinA !== pinB) {
    return pinA - pinB;
  }
  return compareOldestFirst(a, b);
}

function enforceDetachedPinCaps(state, shop, benchSessionId, nowMs) {
  const shopSet = state.shopIndex.get(shop);
  if (!shopSet || shopSet.size === 0) {
    return;
  }

  const sessionDetached = [];
  for (const id of shopSet) {
    const rec = state.recordsById.get(id);
    if (!rec || !rec.isLiveBenchState) {
      continue;
    }
    const meta = state.recordMetaById.get(id);
    if (!meta || !meta.isSuperseded) {
      continue;
    }
    if (!hasActiveReadPin(meta, nowMs)) {
      removeRecordFromState(state, rec, "expired");
      continue;
    }
    if (benchSessionId && rec.benchSessionId === benchSessionId) {
      sessionDetached.push(rec);
    }
  }

  if (sessionDetached.length > MAX_PINNED_DETACHED_PER_SESSION) {
    sessionDetached.sort((a, b) => compareDetachedPinnedOldestFirst(state, a, b));
    const removeCount = sessionDetached.length - MAX_PINNED_DETACHED_PER_SESSION;
    for (let i = 0; i < removeCount && i < sessionDetached.length; i += 1) {
      removeRecordFromState(state, sessionDetached[i], "evicted");
    }
  }

  const remainingShopSet = state.shopIndex.get(shop);
  if (!remainingShopSet || remainingShopSet.size === 0) {
    return;
  }

  const shopDetached = [];
  for (const id of remainingShopSet) {
    const rec = state.recordsById.get(id);
    if (!rec || !rec.isLiveBenchState) {
      continue;
    }
    const meta = state.recordMetaById.get(id);
    if (meta && meta.isSuperseded && hasActiveReadPin(meta, nowMs)) {
      shopDetached.push(rec);
    }
  }

  if (shopDetached.length > MAX_PINNED_DETACHED_PER_SHOP) {
    shopDetached.sort((a, b) => compareDetachedPinnedOldestFirst(state, a, b));
    const removeCount = shopDetached.length - MAX_PINNED_DETACHED_PER_SHOP;
    for (let i = 0; i < removeCount && i < shopDetached.length; i += 1) {
      removeRecordFromState(state, shopDetached[i], "evicted");
    }
  }
}

function detachOrRemoveLiveRecord(
  state,
  record,
  reason,
  nowMs,
  supersededByRevision = null
) {
  if (!record || !state.recordsById.has(record.reportId)) {
    return;
  }
  const meta = state.recordMetaById.get(record.reportId);
  if (record.isLiveBenchState && hasActiveReadPin(meta, nowMs)) {
    meta.isSuperseded = true;
    meta.supersededAt = new Date(nowMs).toISOString();
    meta.supersededReason = reason;
    meta.supersededByRevision =
      typeof supersededByRevision === "number" &&
      Number.isSafeInteger(supersededByRevision)
        ? supersededByRevision
        : null;
    enforceDetachedPinCaps(state, record.shop, record.benchSessionId, nowMs);
    return;
  }
  removeRecordFromState(state, record, reason);
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
  benchSessionId = null,
  benchRevision = null,
  selectionState = null,
  baselineLoadedAt = null,
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

  if (mode === LIVE_BENCH_MODE) {
    updateField("benchSessionId", benchSessionId);
    updateField("benchRevision", benchRevision);
    updateField("selectionState", selectionState);
    updateField("baselineLoadedAt", baselineLoadedAt);
  }

  return `srep_${hash.digest("hex")}`;
}

function buildLiveSessionCompositeKey(shop, benchSessionId) {
  return `${shop}::${benchSessionId}`;
}

function removeRecordFromState(state, record, reason = "evicted") {
  if (!record || !state.recordsById.has(record.reportId)) {
    state.recordMetaById.delete(record?.reportId);
    return;
  }

  state.recordsById.delete(record.reportId);
  state.recordMetaById.delete(record.reportId);
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
  } else if (reason === "replaced_live" || reason === "cleared_live") {
    // In-place live session update or explicit deselection; not an eviction
  } else {
    stats.evictedCount += 1;
    state.totalEvictedCount += 1;
  }
}

function removeLiveSessionSlot(state, sessionEntry, reason = "expired", nowMs = Date.now()) {
  if (!sessionEntry) {
    return;
  }
  const compositeKey = buildLiveSessionCompositeKey(
    sessionEntry.shop,
    sessionEntry.benchSessionId
  );

  if (sessionEntry.activeReportId) {
    const activeRecord = state.recordsById.get(sessionEntry.activeReportId);
    if (activeRecord) {
      if (reason === "expired") {
        detachOrRemoveLiveRecord(state, activeRecord, "expired", nowMs, null);
      } else {
        removeRecordFromState(state, activeRecord, "evicted");
      }
    }
  }

  if (state.liveSessionsByKey.has(compositeKey)) {
    state.liveSessionsByKey.delete(compositeKey);
    state.totalBytes = Math.max(0, state.totalBytes - (sessionEntry.slotOverheadBytes || 0));
  }

  const shopSessionSet = state.shopLiveSessions.get(sessionEntry.shop);
  if (shopSessionSet) {
    shopSessionSet.delete(sessionEntry.benchSessionId);
    if (shopSessionSet.size === 0) {
      state.shopLiveSessions.delete(sessionEntry.shop);
    }
  }

  const stats = getShopStats(state, sessionEntry.shop);
  if (reason === "expired") {
    stats.liveExpiredCount += 1;
  }
}

function purgeExpiredRecords(state, nowMs) {
  for (const sessionEntry of state.liveSessionsByKey.values()) {
    if (sessionEntry.expiresAtMs <= nowMs) {
      removeLiveSessionSlot(state, sessionEntry, "expired", nowMs);
    }
  }

  for (const record of state.recordsById.values()) {
    const meta = state.recordMetaById.get(record.reportId);
    const pinActive = record.isLiveBenchState && hasActiveReadPin(meta, nowMs);

    if (meta && meta.isSuperseded) {
      if (!pinActive) {
        removeRecordFromState(state, record, "expired");
      }
      continue;
    }

    if (record.expiresAtMs <= nowMs) {
      if (record.isLiveBenchState && record.benchSessionId) {
        const compositeKey = buildLiveSessionCompositeKey(record.shop, record.benchSessionId);
        const sessionEntry = state.liveSessionsByKey.get(compositeKey);
        if (sessionEntry && sessionEntry.activeReportId === record.reportId) {
          removeLiveSessionSlot(state, sessionEntry, "expired", nowMs);
          continue;
        }
      }
      if (pinActive) {
        meta.isSuperseded = true;
        meta.supersededAt = new Date(nowMs).toISOString();
        meta.supersededReason = "expired";
        meta.supersededByRevision = null;
        enforceDetachedPinCaps(state, record.shop, record.benchSessionId, nowMs);
        continue;
      }
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

function compareLiveSessionsOldestFirst(a, b) {
  if (a.updatedAtMs !== b.updatedAtMs) {
    return a.updatedAtMs - b.updatedAtMs;
  }
  return a.benchSessionId.localeCompare(b.benchSessionId);
}

function compareLiveSessionsNewestFirst(a, b) {
  if (a.updatedAtMs !== b.updatedAtMs) {
    return b.updatedAtMs - a.updatedAtMs;
  }
  return a.benchSessionId.localeCompare(b.benchSessionId);
}

function enforceManualCapacityLimits(state, targetShop, incomingBytes, nowMs = Date.now()) {
  const shopSet = state.shopIndex.get(targetShop);
  if (shopSet) {
    const manualShopRecords = [];
    for (const id of shopSet) {
      const rec = state.recordsById.get(id);
      if (rec && !rec.isLiveBenchState) {
        manualShopRecords.push(rec);
      }
    }
    if (manualShopRecords.length >= MAX_REPORTS_PER_SHOP) {
      manualShopRecords.sort(compareOldestFirst);
      const removeCount = manualShopRecords.length - MAX_REPORTS_PER_SHOP + 1;
      for (let i = 0; i < removeCount && i < manualShopRecords.length; i += 1) {
        removeRecordFromState(state, manualShopRecords[i], "evicted");
      }
    }
  }

  const allManualRecords = Array.from(state.recordsById.values()).filter(
    (rec) => !rec.isLiveBenchState
  );
  if (allManualRecords.length >= MAX_REPORTS_GLOBAL) {
    allManualRecords.sort(compareOldestFirst);
    const removeCount = allManualRecords.length - MAX_REPORTS_GLOBAL + 1;
    for (let i = 0; i < removeCount && i < allManualRecords.length; i += 1) {
      removeRecordFromState(state, allManualRecords[i], "evicted");
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const evictableManual = Array.from(state.recordsById.values())
      .filter((rec) => !rec.isLiveBenchState)
      .sort(compareOldestFirst);
    for (let i = 0; i < evictableManual.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeRecordFromState(state, evictableManual[i], "evicted");
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const detachedPinned = Array.from(state.recordsById.values())
      .filter((rec) => rec.isLiveBenchState && isRecordSuperseded(state, rec))
      .sort((a, b) => compareDetachedPinnedOldestFirst(state, a, b));
    for (let i = 0; i < detachedPinned.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeRecordFromState(state, detachedPinned[i], "evicted");
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const evictableSessions = Array.from(state.liveSessionsByKey.values()).sort(
      compareLiveSessionsOldestFirst
    );
    for (let i = 0; i < evictableSessions.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeLiveSessionSlot(state, evictableSessions[i], "evicted", nowMs);
    }
  }
}

function enforceLiveSessionCapacityLimits(
  state,
  targetShop,
  targetSessionId,
  incomingBytes,
  nowMs = Date.now()
) {
  const shopSessionsSet = state.shopLiveSessions.get(targetShop);
  if (
    shopSessionsSet &&
    !shopSessionsSet.has(targetSessionId) &&
    shopSessionsSet.size >= MAX_LIVE_SESSIONS_PER_SHOP
  ) {
    const entries = [];
    for (const sid of shopSessionsSet) {
      const entry = state.liveSessionsByKey.get(buildLiveSessionCompositeKey(targetShop, sid));
      if (entry) {
        entries.push(entry);
      }
    }
    entries.sort(compareLiveSessionsOldestFirst);
    const removeCount = entries.length - MAX_LIVE_SESSIONS_PER_SHOP + 1;
    for (let i = 0; i < removeCount && i < entries.length; i += 1) {
      removeLiveSessionSlot(state, entries[i], "evicted", nowMs);
    }
  }

  const targetCompositeKey = buildLiveSessionCompositeKey(targetShop, targetSessionId);
  if (
    !state.liveSessionsByKey.has(targetCompositeKey) &&
    state.liveSessionsByKey.size >= MAX_LIVE_SESSIONS_GLOBAL
  ) {
    const allSessions = Array.from(state.liveSessionsByKey.values()).sort(
      compareLiveSessionsOldestFirst
    );
    const removeCount = allSessions.length - MAX_LIVE_SESSIONS_GLOBAL + 1;
    for (let i = 0; i < removeCount && i < allSessions.length; i += 1) {
      removeLiveSessionSlot(state, allSessions[i], "evicted", nowMs);
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const detachedPinned = Array.from(state.recordsById.values())
      .filter((rec) => rec.isLiveBenchState && isRecordSuperseded(state, rec))
      .sort((a, b) => compareDetachedPinnedOldestFirst(state, a, b));
    for (let i = 0; i < detachedPinned.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeRecordFromState(state, detachedPinned[i], "evicted");
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const otherSessions = Array.from(state.liveSessionsByKey.values())
      .filter((s) => !(s.shop === targetShop && s.benchSessionId === targetSessionId))
      .sort(compareLiveSessionsOldestFirst);
    for (let i = 0; i < otherSessions.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeLiveSessionSlot(state, otherSessions[i], "evicted", nowMs);
    }
  }

  if (state.totalBytes + incomingBytes > MAX_TOTAL_BYTES) {
    const manualRecords = Array.from(state.recordsById.values())
      .filter((rec) => !rec.isLiveBenchState)
      .sort(compareOldestFirst);
    for (let i = 0; i < manualRecords.length; i += 1) {
      if (state.totalBytes + incomingBytes <= MAX_TOTAL_BYTES) {
        break;
      }
      removeRecordFromState(state, manualRecords[i], "evicted");
    }
  }
}

function formatRecordMetadata(record) {
  const base = {
    reportId: record.reportId,
    productId: record.productId,
    productTitle: record.productTitle,
    mode: record.mode,
    sectionKey: record.sectionKey,
    sectionLabel: record.sectionLabel,
    runIdentity: record.runIdentity,
    runTimestamp: record.runTimestamp,
    capturedAt: record.capturedAt,
    storedAt: record.storedAt,
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

  if (record.isLiveBenchState) {
    base.benchSessionId = record.benchSessionId;
    base.benchRevision = record.benchRevision;
    base.selectionState = record.selectionState;
    base.clientStateChangedAt = record.capturedAt;
    base.baselineLoadedAt = record.baselineLoadedAt;
    base.serverReceivedAt = record.storedAt;
    base.baselineSource = record.baselineSource;
    base.workingState = record.workingState;
    base.freshnessNote =
      record.selectionState === "unselected_preview"
        ? "Snapshot reflects read-only unselected blank template preview at clientStateChangedAt (no product selected or loaded; productId is null). Server receipt time (serverReceivedAt) does not prove a Shopify GraphQL read or saved baseline."
        : "Snapshot reflects browser working state at clientStateChangedAt over last-loaded baseline (baselineLoadedAt). Server receipt time (serverReceivedAt) does not prove a fresh Shopify GraphQL read or currently active screen.";
  }

  return base;
}

function formatLiveSessionSlotSummary(sessionEntry) {
  return {
    benchSessionId: sessionEntry.benchSessionId,
    benchRevision: sessionEntry.highestRevision,
    selectionState: sessionEntry.selectionState,
    activeReportId: sessionEntry.activeReportId,
    activeProductId: sessionEntry.activeProductId,
    previousProductId: sessionEntry.previousProductId,
    clientStateChangedAt: sessionEntry.clientStateChangedAt,
    baselineLoadedAt: sessionEntry.baselineLoadedAt,
    serverReceivedAt: sessionEntry.updatedAt,
    expiresAt: sessionEntry.expiresAt,
    baselineSource: sessionEntry.baselineSource,
    workingState: sessionEntry.workingState,
  };
}

function validateAndExtractLiveBenchMetadata(packet, rawLiveState) {
  const candidateMeta = isPlainObject(rawLiveState)
    ? rawLiveState
    : isPlainObject(packet) && isPlainObject(packet.liveState)
      ? packet.liveState
      : null;

  let parsedFullTextObj = null;
  if (packet && typeof packet.fullText === "string" && packet.fullText.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(packet.fullText);
      if (isPlainObject(parsed)) {
        parsedFullTextObj = parsed;
      }
    } catch {
      parsedFullTextObj = null;
    }
  }

  const pickField = (key) => {
    if (candidateMeta && candidateMeta[key] !== undefined) {
      return candidateMeta[key];
    }
    if (isPlainObject(packet) && packet[key] !== undefined) {
      return packet[key];
    }
    if (parsedFullTextObj && parsedFullTextObj[key] !== undefined) {
      return parsedFullTextObj[key];
    }
    return undefined;
  };

  const rawSessionId = pickField("benchSessionId");
  if (typeof rawSessionId !== "string" || !BENCH_SESSION_ID_REGEX.test(rawSessionId.trim())) {
    return {
      ok: false,
      code: "invalid_bench_session_id",
      message:
        "live_bench_state requires a valid benchSessionId string (6-120 alphanumeric/._:- characters).",
    };
  }
  const benchSessionId = rawSessionId.trim();
  if (containsRecognizableCredentials(benchSessionId)) {
    return {
      ok: false,
      code: "credential_material_rejected",
      message: "benchSessionId contains recognizable credential material.",
    };
  }

  const rawRevision = pickField("benchRevision");
  if (
    typeof rawRevision !== "number" ||
    !Number.isSafeInteger(rawRevision) ||
    rawRevision < 1
  ) {
    return {
      ok: false,
      code: "invalid_bench_revision",
      message: "live_bench_state requires benchRevision as a positive safe integer (>= 1).",
    };
  }
  const benchRevision = rawRevision;

  const rawSelectionState = pickField("selectionState") ?? "selected";
  if (
    rawSelectionState !== "selected" &&
    rawSelectionState !== "none" &&
    rawSelectionState !== "unselected_preview"
  ) {
    return {
      ok: false,
      code: "invalid_selection_state",
      message:
        'selectionState must be "selected", "unselected_preview", or "none".',
    };
  }
  const selectionState = rawSelectionState;

  if (
    parsedFullTextObj &&
    parsedFullTextObj.benchSessionId !== undefined &&
    String(parsedFullTextObj.benchSessionId).trim() !== benchSessionId
  ) {
    return {
      ok: false,
      code: "inconsistent_bench_session_id",
      message: "benchSessionId in packet/liveState does not match serialized fullText JSON.",
    };
  }

  if (
    parsedFullTextObj &&
    parsedFullTextObj.benchRevision !== undefined &&
    parsedFullTextObj.benchRevision !== benchRevision
  ) {
    return {
      ok: false,
      code: "inconsistent_bench_revision",
      message: "benchRevision in packet/liveState does not match serialized fullText JSON.",
    };
  }

  if (
    parsedFullTextObj &&
    parsedFullTextObj.selectionState !== undefined &&
    parsedFullTextObj.selectionState !== selectionState
  ) {
    return {
      ok: false,
      code: "inconsistent_selection_state",
      message: "selectionState in packet/liveState does not match serialized fullText JSON.",
    };
  }

  const rawBaselineLoadedAt = pickField("baselineLoadedAt");
  let baselineLoadedAt = null;
  if (rawBaselineLoadedAt !== null && rawBaselineLoadedAt !== undefined && rawBaselineLoadedAt !== "") {
    if (selectionState === "unselected_preview") {
      return {
        ok: false,
        code: "inconsistent_preview_baseline_loaded_at",
        message: 'When selectionState is "unselected_preview", baselineLoadedAt must be null.',
      };
    }
    const parsedBaseline = parseStrictIsoTimestamp(rawBaselineLoadedAt);
    if (!parsedBaseline) {
      return {
        ok: false,
        code: "invalid_baseline_loaded_at",
        message: "baselineLoadedAt must be a valid ISO-8601 timestamp string or null.",
      };
    }
    baselineLoadedAt = parsedBaseline.raw;
  }

  const rawClientStateChangedAt =
    pickField("clientStateChangedAt") ??
    (isPlainObject(packet) ? packet.capturedAt : undefined);
  const parsedClientTime = parseStrictIsoTimestamp(rawClientStateChangedAt);
  if (!parsedClientTime) {
    return {
      ok: false,
      code: "invalid_captured_at",
      message:
        "live_bench_state requires a valid ISO-8601 clientStateChangedAt / packet.capturedAt timestamp.",
    };
  }

  return {
    ok: true,
    benchSessionId,
    benchRevision,
    selectionState,
    baselineLoadedAt,
    clientTime: parsedClientTime,
    parsedFullTextObj,
  };
}

function storeLiveBenchStateInternal({
  state,
  shop,
  packet,
  uiAudit,
  liveState,
  nowMs,
}) {
  const liveMeta = validateAndExtractLiveBenchMetadata(packet, liveState);
  if (!liveMeta.ok) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: liveMeta.code,
      message: liveMeta.message,
    });
  }

  const {
    benchSessionId,
    benchRevision,
    selectionState,
    baselineLoadedAt,
    clientTime,
    parsedFullTextObj,
  } = liveMeta;

  const ageMs = nowMs - clientTime.ms;
  if (ageMs > TTL_MS) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "capture_expired",
      message: "clientStateChangedAt / capturedAt is older than the 30-minute TTL.",
    });
  }

  if (clientTime.ms - nowMs > MAX_FUTURE_SKEW_MS) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "capture_in_future",
      message: "clientStateChangedAt / capturedAt cannot be more than 2 minutes in the future.",
    });
  }

  const compositeKey = buildLiveSessionCompositeKey(shop, benchSessionId);
  const existingSession = state.liveSessionsByKey.get(compositeKey);

  // Monotonic high-water revision guard across product switches, previews, and deselections
  if (existingSession && benchRevision <= existingSession.highestRevision) {
    if (
      benchRevision === existingSession.highestRevision &&
      existingSession.selectionState === selectionState
    ) {
      if (selectionState === "none") {
        return finalizeResponse({
          ok: true,
          status: "stored",
          deduplicated: true,
          selectionState: "none",
          liveSession: formatLiveSessionSlotSummary(existingSession),
        });
      }
      const existingRec = existingSession.activeReportId
        ? state.recordsById.get(existingSession.activeReportId)
        : null;
      const incomingProdId =
        selectionState === "unselected_preview"
          ? null
          : typeof packet?.productId === "string"
            ? packet.productId.trim()
            : null;
      if (
        existingRec &&
        !isRecordSuperseded(state, existingRec) &&
        existingRec.productId === incomingProdId &&
        existingRec.selectionState === selectionState
      ) {
        return finalizeResponse({
          ok: true,
          status: "stored",
          deduplicated: true,
          report: formatRecordMetadata(existingRec),
          liveSession: formatLiveSessionSlotSummary(existingSession),
        });
      }
    }

    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "stale_bench_revision",
      benchSessionId,
      benchRevision,
      highestRevision: existingSession.highestRevision,
      activeProductId: existingSession.activeProductId,
      selectionState: existingSession.selectionState,
      message: `Rejected stale or out-of-order live_bench_state revision ${benchRevision} for session ${benchSessionId} (current high-water revision is ${existingSession.highestRevision}).`,
    });
  }

  // Handle explicit selection clear / deselection tombstone
  if (selectionState === "none") {
    const packetProdId =
      isPlainObject(packet) && packet.productId !== undefined && packet.productId !== null
        ? String(packet.productId).trim()
        : "";
    if (packetProdId !== "") {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_deselection_product_id",
        message: 'When selectionState is "none", productId must be null or omitted.',
      });
    }

    const previousActiveProductId = existingSession?.activeProductId || null;
    if (existingSession && existingSession.activeReportId) {
      const oldRec = state.recordsById.get(existingSession.activeReportId);
      if (oldRec) {
        detachOrRemoveLiveRecord(state, oldRec, "cleared_live", nowMs, null);
      }
    }

    const slotOverheadBytes = 384 + utf8ByteLength(shop) + utf8ByteLength(benchSessionId);
    enforceLiveSessionCapacityLimits(state, shop, benchSessionId, slotOverheadBytes, nowMs);

    if (existingSession) {
      state.totalBytes = Math.max(
        0,
        state.totalBytes - (existingSession.slotOverheadBytes || 0)
      );
    }

    if (state.totalBytes + slotOverheadBytes > MAX_TOTAL_BYTES) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "report_exceeds_cache_budget",
        message: "Live bench session state exceeds total cache memory budget.",
      });
    }

    const storedAtIso = new Date(nowMs).toISOString();
    const expiresAtMs = clientTime.ms + TTL_MS;
    const expiresAtIso = new Date(expiresAtMs).toISOString();

    const updatedSession = Object.freeze({
      shop,
      benchSessionId,
      highestRevision: benchRevision,
      selectionState: "none",
      activeReportId: null,
      activeProductId: null,
      previousProductId: previousActiveProductId,
      clientStateChangedAt: clientTime.raw,
      clientStateChangedAtMs: clientTime.ms,
      baselineLoadedAt: null,
      updatedAt: storedAtIso,
      updatedAtMs: nowMs,
      expiresAt: expiresAtIso,
      expiresAtMs,
      baselineSource: "none_selected",
      workingState: "bench_deselected",
      slotOverheadBytes,
    });

    state.liveSessionsByKey.set(compositeKey, updatedSession);
    state.totalBytes += slotOverheadBytes;

    let shopSessionSet = state.shopLiveSessions.get(shop);
    if (!shopSessionSet) {
      shopSessionSet = new Set();
      state.shopLiveSessions.set(shop, shopSessionSet);
    }
    shopSessionSet.add(benchSessionId);

    const shopStats = getShopStats(state, shop);
    shopStats.liveClearedCount += 1;

    return finalizeResponse({
      ok: true,
      status: "stored",
      deduplicated: false,
      selectionState: "none",
      liveSession: formatLiveSessionSlotSummary(updatedSession),
    });
  }

  // selectionState === "selected" or selectionState === "unselected_preview"
  const isUnselectedPreview = selectionState === "unselected_preview";

  if (!isPlainObject(packet)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_packet",
      message: `A valid packet object is required when selectionState is "${selectionState}".`,
    });
  }

  let productId = null;
  if (isUnselectedPreview) {
    if (packet.productId !== null && packet.productId !== undefined) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_preview_product_id",
        message: 'When selectionState is "unselected_preview", packet.productId must be null.',
      });
    }
    if (
      isPlainObject(liveState) &&
      liveState.productId !== null &&
      liveState.productId !== undefined
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_preview_product_id",
        message: 'When selectionState is "unselected_preview", liveState.productId must be null.',
      });
    }
    if (
      parsedFullTextObj &&
      parsedFullTextObj.productId !== null &&
      parsedFullTextObj.productId !== undefined
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_preview_product_id",
        message:
          'When selectionState is "unselected_preview", productId inside serialized fullText JSON must be null.',
      });
    }
    if (
      isPlainObject(uiAudit) &&
      uiAudit.productId !== null &&
      uiAudit.productId !== undefined
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_ui_audit_product_id",
        message: 'When selectionState is "unselected_preview", uiAudit.productId must be null.',
      });
    }
    if (parsedFullTextObj && parsedFullTextObj.manifestLoaded === true) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_preview_manifest_loaded",
        message:
          'When selectionState is "unselected_preview", manifestLoaded inside serialized fullText JSON must be false.',
      });
    }
  } else {
    const rawProductId = typeof packet.productId === "string" ? packet.productId.trim() : "";
    if (!PRODUCT_GID_REGEX.test(rawProductId)) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "invalid_product_id",
        message: "packet.productId must match gid://shopify/Product/<digits>.",
      });
    }
    productId = rawProductId;

    if (
      isPlainObject(liveState) &&
      liveState.productId !== undefined &&
      (typeof liveState.productId !== "string" || liveState.productId.trim() !== productId)
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_product_id",
        message: "packet.productId and liveState.productId must match.",
      });
    }

    if (
      parsedFullTextObj &&
      parsedFullTextObj.productId !== undefined &&
      String(parsedFullTextObj.productId ?? "").trim() !== productId
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_product_id",
        message: "packet.productId does not match productId inside serialized fullText JSON.",
      });
    }

    if (
      isPlainObject(uiAudit) &&
      uiAudit.productId !== undefined &&
      String(uiAudit.productId ?? "").trim() !== productId
    ) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "inconsistent_ui_audit_product_id",
        message: "uiAudit.productId does not match packet.productId.",
      });
    }
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
      message: `packet.fullText (${fullText.length} UTF-16 code units) exceeds maximum ${MAX_FULL_TEXT_CODE_UNITS} UTF-16 code units.`,
    });
  }

  const reportUtf8Bytes = utf8ByteLength(fullText);
  if (reportUtf8Bytes > MAX_FULL_TEXT_UTF8_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "full_text_too_large",
      message: `packet.fullText (${reportUtf8Bytes} UTF-8 bytes) exceeds maximum ${MAX_FULL_TEXT_UTF8_BYTES} UTF-8 bytes.`,
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

  const sectionKeyCheck = sanitizeOptionalShortString(
    packet.sectionKey ?? LIVE_BENCH_MODE,
    120
  );
  const sectionLabelCheck = sanitizeOptionalShortString(
    packet.sectionLabel ??
      (isUnselectedPreview
        ? "LIVE BENCH BLANK TEMPLATE PREVIEW (NO PRODUCT SELECTED)"
        : "LIVE BENCH FIELD STATE"),
    200
  );
  const productTitleCheck = sanitizeOptionalShortString(packet.productTitle, 300);
  const runIdentityCheck = sanitizeOptionalShortString(packet.runIdentity, 240);
  const runTimestampCheck = sanitizeOptionalShortString(packet.runTimestamp, 120);

  const fieldChecks = [
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

  const sectionKey =
    typeof sectionKeyCheck === "string" && sectionKeyCheck.trim()
      ? sectionKeyCheck.trim()
      : LIVE_BENCH_MODE;
  const sectionLabel =
    typeof sectionLabelCheck === "string" && sectionLabelCheck.trim()
      ? sectionLabelCheck.trim()
      : isUnselectedPreview
        ? "LIVE BENCH BLANK TEMPLATE PREVIEW (NO PRODUCT SELECTED)"
        : "LIVE BENCH FIELD STATE";
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

  const reportChunks = splitUtf8CodePoints(fullText, MAX_CHUNK_UTF8_BYTES);
  if (reportChunks.join("") !== fullText) {
    return finalizeResponse({
      ok: false,
      status: "error",
      code: "chunk_integrity_failure",
      message: "Failed lossless UTF-8 code-point chunk verification.",
    });
  }

  const reportId = computeReportId({
    shop,
    productId,
    mode: LIVE_BENCH_MODE,
    sectionKey,
    sectionLabel,
    productTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientTime.raw,
    limitUsed,
    fullText,
    uiAuditState: auditResult.state,
    uiAuditCanonicalJson: auditResult.canonicalJson,
    benchSessionId,
    benchRevision,
    selectionState,
    baselineLoadedAt,
  });

  const metadataOverheadBytes =
    640 +
    utf8ByteLength(shop) +
    utf8ByteLength(productId || "") +
    utf8ByteLength(benchSessionId) +
    utf8ByteLength(sectionKey) +
    utf8ByteLength(sectionLabel) +
    utf8ByteLength(productTitle || "") +
    utf8ByteLength(runIdentity || "") +
    utf8ByteLength(runTimestamp || "") +
    utf8ByteLength(baselineLoadedAt || "");

  const estimatedBytes =
    reportUtf8Bytes * 2 + auditResult.utf8Bytes * 2 + metadataOverheadBytes;
  const slotOverheadBytes = 384 + utf8ByteLength(shop) + utf8ByteLength(benchSessionId);

  if (estimatedBytes + slotOverheadBytes > MAX_TOTAL_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "report_exceeds_cache_budget",
      message: "Live bench state size exceeds total cache memory budget.",
    });
  }

  // Replace or detach previous active live record for this exact (shop, benchSessionId) slot
  // so repeated field edits never accumulate unpinned reports or evict manual captures.
  const previousActiveProductId = existingSession?.activeProductId || null;
  if (existingSession && existingSession.activeReportId) {
    const oldRec = state.recordsById.get(existingSession.activeReportId);
    if (oldRec && oldRec.reportId !== reportId) {
      detachOrRemoveLiveRecord(state, oldRec, "replaced_live", nowMs, benchRevision);
    } else if (oldRec && oldRec.reportId === reportId) {
      removeRecordFromState(state, oldRec, "replaced_live");
    }
  }
  if (existingSession) {
    state.totalBytes = Math.max(
      0,
      state.totalBytes - (existingSession.slotOverheadBytes || 0)
    );
  }

  enforceLiveSessionCapacityLimits(
    state,
    shop,
    benchSessionId,
    estimatedBytes + slotOverheadBytes,
    nowMs
  );

  if (state.totalBytes + estimatedBytes + slotOverheadBytes > MAX_TOTAL_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "report_exceeds_cache_budget",
      message: "Live bench state size exceeds total cache memory budget.",
    });
  }

  const storedAtIso = new Date(nowMs).toISOString();
  const expiresAtMs = clientTime.ms + TTL_MS;
  const expiresAtIso = new Date(expiresAtMs).toISOString();

  const effectiveBaselineSource = isUnselectedPreview
    ? "unselected_blank_preview"
    : parsedFullTextObj && parsedFullTextObj.manifestLoaded === false
      ? "manifest_not_loaded"
      : "last_loaded_manifest";
  const effectiveWorkingState = isUnselectedPreview
    ? "read_only_template_preview"
    : parsedFullTextObj && parsedFullTextObj.manifestLoaded === false
      ? "unavailable_not_loaded"
      : "unsaved_browser_bench";

  const newRecord = Object.freeze({
    reportId,
    shop,
    productId,
    productTitle,
    mode: LIVE_BENCH_MODE,
    sectionKey,
    sectionLabel,
    runIdentity,
    runTimestamp,
    capturedAt: clientTime.raw,
    capturedAtMs: clientTime.ms,
    storedAt: storedAtIso,
    storedAtMs: nowMs,
    expiresAt: expiresAtIso,
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
    isLiveBenchState: true,
    benchSessionId,
    benchRevision,
    selectionState,
    baselineLoadedAt,
    baselineSource: effectiveBaselineSource,
    workingState: effectiveWorkingState,
  });

  const updatedSession = Object.freeze({
    shop,
    benchSessionId,
    highestRevision: benchRevision,
    selectionState,
    activeReportId: reportId,
    activeProductId: productId,
    previousProductId:
      previousActiveProductId && previousActiveProductId !== productId
        ? previousActiveProductId
        : existingSession?.previousProductId || null,
    clientStateChangedAt: clientTime.raw,
    clientStateChangedAtMs: clientTime.ms,
    baselineLoadedAt,
    updatedAt: storedAtIso,
    updatedAtMs: nowMs,
    expiresAt: expiresAtIso,
    expiresAtMs,
    baselineSource: effectiveBaselineSource,
    workingState: effectiveWorkingState,
    slotOverheadBytes,
  });

  state.recordsById.set(reportId, newRecord);
  state.recordMetaById.set(reportId, createInitialRecordMeta());
  state.liveSessionsByKey.set(compositeKey, updatedSession);
  state.totalBytes += estimatedBytes + slotOverheadBytes;
  state.totalStoredCount += 1;

  let shopSet = state.shopIndex.get(shop);
  if (!shopSet) {
    shopSet = new Set();
    state.shopIndex.set(shop, shopSet);
  }
  shopSet.add(reportId);

  let shopSessionSet = state.shopLiveSessions.get(shop);
  if (!shopSessionSet) {
    shopSessionSet = new Set();
    state.shopLiveSessions.set(shop, shopSessionSet);
  }
  shopSessionSet.add(benchSessionId);

  const shopStats = getShopStats(state, shop);
  shopStats.storedCount += 1;
  shopStats.liveSyncCount += 1;
  shopStats.lastCapturedAtMs = clientTime.ms;

  return finalizeResponse({
    ok: true,
    status: "stored",
    deduplicated: false,
    report: formatRecordMetadata(newRecord),
    liveSession: formatLiveSessionSlotSummary(updatedSession),
  });
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

  const { shop: rawShop, packet, uiAudit = null, liveState = null } = options;
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

  const nowMs = Date.now();
  const state = getCacheState();
  purgeExpiredRecords(state, nowMs);

  const packetMode =
    isPlainObject(packet) && typeof packet.mode === "string"
      ? packet.mode.trim()
      : "";
  const isLiveBenchCall =
    packetMode === LIVE_BENCH_MODE ||
    (isPlainObject(liveState) &&
      (liveState.mode === LIVE_BENCH_MODE ||
        liveState.selectionState !== undefined ||
        liveState.benchSessionId !== undefined));

  if (isLiveBenchCall) {
    return storeLiveBenchStateInternal({
      state,
      shop,
      packet,
      uiAudit,
      liveState,
      nowMs,
    });
  }

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
      message: `packet.fullText (${fullText.length} UTF-16 code units) exceeds maximum ${MAX_FULL_TEXT_CODE_UNITS} UTF-16 code units.`,
    });
  }

  const reportUtf8Bytes = utf8ByteLength(fullText);
  if (reportUtf8Bytes > MAX_FULL_TEXT_UTF8_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "full_text_too_large",
      message: `packet.fullText (${reportUtf8Bytes} UTF-8 bytes) exceeds maximum ${MAX_FULL_TEXT_UTF8_BYTES} UTF-8 bytes.`,
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
  if (
    existingRecord &&
    existingRecord.shop === shop &&
    !isRecordSuperseded(state, existingRecord)
  ) {
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

  enforceManualCapacityLimits(state, shop, estimatedBytes, nowMs);

  if (state.totalBytes + estimatedBytes > MAX_TOTAL_BYTES) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "report_exceeds_cache_budget",
      message: "Report size exceeds total cache memory budget.",
    });
  }

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
    isLiveBenchState: false,
    benchSessionId: null,
    benchRevision: null,
    selectionState: null,
    baselineLoadedAt: null,
    baselineSource: null,
    workingState: null,
  });

  state.recordsById.set(reportId, newRecord);
  state.recordMetaById.set(reportId, createInitialRecordMeta());
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

function getShopLiveSessionSummaries(state, shop, maxItems = 3) {
  const shopSessionSet = state.shopLiveSessions.get(shop);
  if (!shopSessionSet || shopSessionSet.size === 0) {
    return [];
  }
  const entries = [];
  for (const sid of shopSessionSet) {
    const entry = state.liveSessionsByKey.get(buildLiveSessionCompositeKey(shop, sid));
    if (entry && entry.shop === shop) {
      entries.push(entry);
    }
  }
  entries.sort(compareLiveSessionsNewestFirst);
  return entries.slice(0, maxItems).map(formatLiveSessionSlotSummary);
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
  const liveSessions = getShopLiveSessionSummaries(state, shop, 3);

  const matchingRecords = [];
  if (shopSet) {
    for (const id of shopSet) {
      const rec = state.recordsById.get(id);
      if (!rec || rec.shop !== shop) {
        continue;
      }
      // Never list detached/historical superseded snapshots as active reports
      if (isRecordSuperseded(state, rec)) {
        continue;
      }
      // Product-filtered lists must never match or substitute a product-free preview (productId === null)
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
      shopStats.evictedCount > 0 ||
      shopStats.liveSyncCount > 0 ||
      shopStats.liveClearedCount > 0 ||
      shopStats.liveExpiredCount > 0;

    const allSessionsDeselected =
      liveSessions.length > 0 &&
      liveSessions.every((s) => s.selectionState === "none");
    const hasUnselectedPreviewSession =
      liveSessions.length > 0 &&
      liveSessions.some((s) => s.selectionState === "unselected_preview");

    let unavailableReason = hadPriorShopActivity
      ? "no_matching_active_reports_in_memory"
      : "cache_empty_or_process_restarted";
    let unavailableMessage =
      "No matching captured Meta Injector reports or live bench states are currently held in this process memory cache. Cache is volatile and does not persist across restarts or separate workers.";

    if (allSessionsDeselected && (!normalizedMode || normalizedMode === LIVE_BENCH_MODE)) {
      unavailableReason = "bench_selection_cleared";
      unavailableMessage =
        'Active browser session has selectionState="none" (no product currently selected on the bench). Do not substitute a previous product.';
    } else if (
      normalizedProductId &&
      hasUnselectedPreviewSession &&
      !liveSessions.some((s) => s.selectionState === "selected")
    ) {
      unavailableReason = "unselected_preview_active_no_product_selected";
      unavailableMessage =
        'No matching report for the requested productId. Active browser session is in read-only unselected blank template preview mode (selectionState="unselected_preview", productId=null); never substitute the blank preview for a specific product.';
    } else if (
      normalizedProductId &&
      liveSessions.some(
        (s) => s.selectionState === "selected" && s.activeProductId !== normalizedProductId
      )
    ) {
      unavailableReason = "requested_product_not_active_on_bench";
      unavailableMessage =
        "No matching report for the requested productId. Another product is currently selected in the active browser session; never substitute another product.";
    }

    const baseUnavailable = {
      ok: true,
      status: "unavailable",
      reason: unavailableReason,
      message: unavailableMessage,
      reports: [],
      pagination: {
        requestedLimit: boundedLimit,
        returnedCount: 0,
        totalMatching: 0,
        hasNextPage: false,
        nextAfterReportId: null,
      },
    };

    if (liveSessions.length > 0) {
      const withSessions = { ...baseUnavailable, liveSessions };
      if (utf8ByteLength(JSON.stringify(withSessions)) <= MAX_RESPONSE_UTF8_BYTES) {
        return finalizeResponse(withSessions);
      }
    }

    return finalizeResponse(baseUnavailable);
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
      ...(liveSessions.length > 0 ? { liveSessions } : {}),
    };

    if (utf8ByteLength(JSON.stringify(testEnvelope)) <= MAX_RESPONSE_UTF8_BYTES) {
      selectedItems.push(formatted);
    } else {
      break;
    }
  }

  if (candidateSlice.length > 0 && selectedItems.length === 0) {
    const singleFormatted = formatRecordMetadata(candidateSlice[0]);
    const hasMoreSingle = startIndex + 1 < matchingRecords.length;
    const fallbackEnvelope = {
      ok: true,
      status: "ok",
      reports: [singleFormatted],
      pagination: {
        requestedLimit: boundedLimit,
        returnedCount: 1,
        totalMatching: matchingRecords.length,
        hasNextPage: hasMoreSingle,
        nextAfterReportId: hasMoreSingle ? singleFormatted.reportId : null,
      },
    };
    if (utf8ByteLength(JSON.stringify(fallbackEnvelope)) <= MAX_RESPONSE_UTF8_BYTES) {
      return finalizeResponse(fallbackEnvelope);
    }

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

  const finalPayload = {
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
  };

  if (liveSessions.length > 0) {
    const candidateWithSessions = { ...finalPayload, liveSessions };
    if (utf8ByteLength(JSON.stringify(candidateWithSessions)) <= MAX_RESPONSE_UTF8_BYTES) {
      return finalizeResponse(candidateWithSessions);
    }
  }

  return finalizeResponse(finalPayload);
}

function parseVerifiedLiveBenchSnapshot(record) {
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

function evaluateFieldAttentionFlags(key, fieldObj, saveEvidence) {
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

function buildIndexViewData(record, snapshot) {
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

function buildHeaderViewData(record, snapshot) {
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

function buildReviewViewData(snapshot, record = null) {
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

function resolveDrawerTarget(snapshot, rawDrawerTitle, record = null) {
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

function resolveFieldTarget(snapshot, rawFieldKey, record = null) {
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

function buildBoundedOrganizedViewEnvelope({
  record,
  snapshot,
  view,
  drawer = null,
  fieldKey = null,
  chunkIndex,
  viewPayloadObj,
  state,
  nowMs,
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

  // All inputs, target existence, and chunk bounds are verified: activate or renew read pin
  const updatedMeta = activateOrRenewLiveReadPin(
    state,
    record,
    "report",
    chunkIndex,
    nowMs
  );

  const effectivePinExpMs = getEffectivePinExpiresAtMs(updatedMeta);
  const pinExpiresAt =
    effectivePinExpMs !== null && nowMs < effectivePinExpMs
      ? new Date(effectivePinExpMs).toISOString()
      : null;

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
    isHistoricalSuperseded: Boolean(updatedMeta?.isSuperseded),
    supersededByRevision: updatedMeta?.supersededByRevision ?? null,
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
    section: rawSection = "report",
    view: rawView = "chunk",
    drawer: rawDrawer = null,
    fieldKey: rawFieldKey = null,
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

  const section =
    rawSection === null || rawSection === undefined
      ? "report"
      : typeof rawSection === "string"
        ? rawSection.trim()
        : "";

  if (!ALLOWED_READ_SECTIONS_SET.has(section)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_section",
      message: 'section must be either "report" or "ui_audit".',
    });
  }

  const view =
    rawView === null || rawView === undefined
      ? "chunk"
      : typeof rawView === "string"
        ? rawView.trim()
        : "";

  if (!ALLOWED_READ_VIEWS_SET.has(view)) {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_view",
      message:
        'view must be one of "chunk", "index", "header", "review", "drawer", or "field".',
    });
  }

  if (section === "ui_audit" && view !== "chunk") {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "incompatible_section_and_view",
      message: 'When section is "ui_audit", view must be "chunk" (or omitted).',
    });
  }

  const hasDrawerArg = rawDrawer !== null && rawDrawer !== undefined;
  const hasFieldKeyArg = rawFieldKey !== null && rawFieldKey !== undefined;

  if (hasDrawerArg && typeof rawDrawer !== "string") {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_drawer",
      message: "drawer must be a string when provided.",
    });
  }

  if (hasFieldKeyArg && typeof rawFieldKey !== "string") {
    return finalizeResponse({
      ok: false,
      status: "invalid_request",
      code: "invalid_field_key",
      message: "fieldKey must be a string when provided.",
    });
  }

  const trimmedDrawer = hasDrawerArg ? rawDrawer.trim() : null;
  const trimmedFieldKey = hasFieldKeyArg ? rawFieldKey.trim() : null;

  if (view === "drawer") {
    if (!trimmedDrawer || trimmedDrawer.length > 200) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "missing_drawer",
        message:
          'A nonempty "drawer" string (up to 200 characters) is required when view="drawer".',
      });
    }
    if (trimmedFieldKey !== null && trimmedFieldKey !== "") {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "unexpected_field_key",
        message: 'fieldKey is not accepted when view="drawer".',
      });
    }
  } else if (view === "field") {
    if (!trimmedFieldKey || trimmedFieldKey.length > 200) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "missing_field_key",
        message:
          'A nonempty "fieldKey" string (up to 200 characters) is required when view="field".',
      });
    }
    if (trimmedDrawer !== null && trimmedDrawer !== "") {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "unexpected_drawer",
        message: 'drawer is not accepted when view="field".',
      });
    }
  } else {
    if (trimmedDrawer !== null) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "unexpected_drawer",
        message: `drawer parameter is only supported when view="drawer" (received view="${view}").`,
      });
    }
    if (trimmedFieldKey !== null) {
      return finalizeResponse({
        ok: false,
        status: "invalid_request",
        code: "unexpected_field_key",
        message: `fieldKey parameter is only supported when view="field" (received view="${view}").`,
      });
    }
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
    const liveSessions = getShopLiveSessionSummaries(state, shop, 2);
    const hadPriorShopActivity =
      shopStats.storedCount > 0 ||
      shopStats.expiredCount > 0 ||
      shopStats.evictedCount > 0 ||
      shopStats.liveSyncCount > 0 ||
      shopStats.liveClearedCount > 0 ||
      shopStats.liveExpiredCount > 0;

    const notFoundPayload = {
      ok: false,
      status: "not_found",
      code: hadPriorShopActivity
        ? "expired_superseded_or_not_found"
        : "cache_unavailable_or_not_found",
      reportId,
      section,
      ...(view !== "chunk" ? { view } : {}),
      message:
        "The requested reportId was not found for this shop. It may have been superseded by a newer live bench revision, cleared on product switch/deselection, expired after 30 minutes, or lost due to a server restart or separate worker process.",
      ...(liveSessions.length > 0 ? { liveSessions } : {}),
    };

    return finalizeResponse(notFoundPayload);
  }

  const buildLiveReadMetadata = (metaObj) => {
    if (!record.isLiveBenchState) {
      return {};
    }
    const effectivePinExpMs = getEffectivePinExpiresAtMs(metaObj);
    const pinExpiresAt =
      effectivePinExpMs !== null && nowMs < effectivePinExpMs
        ? new Date(effectivePinExpMs).toISOString()
        : null;
    return {
      benchSessionId: record.benchSessionId,
      benchRevision: record.benchRevision,
      selectionState: record.selectionState,
      clientStateChangedAt: record.capturedAt,
      baselineLoadedAt: record.baselineLoadedAt,
      serverReceivedAt: record.storedAt,
      baselineSource: record.baselineSource,
      workingState: record.workingState,
      isHistoricalSuperseded: Boolean(metaObj?.isSuperseded),
      supersededByRevision: metaObj?.supersededByRevision ?? null,
      pinExpiresAt,
    };
  };

  if (section === "ui_audit") {
    if (record.uiAuditState !== "measured" || !record.uiAuditCanonicalJson) {
      const existingMeta = state.recordMetaById.get(record.reportId) || null;
      const liveMetaFields = buildLiveReadMetadata(existingMeta);
      return finalizeResponse({
        ok: true,
        status: "not_measured",
        reportId: record.reportId,
        productId: record.productId,
        mode: record.mode,
        section: "ui_audit",
        uiAuditState: "not_measured",
        capturedAt: record.capturedAt,
        storedAt: record.storedAt,
        expiresAt: record.expiresAt,
        runIdentity: record.runIdentity,
        runTimestamp: record.runTimestamp,
        ...liveMetaFields,
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

    // Valid ui_audit chunk bounds confirmed: renew an already active pin without starting a new pin
    const updatedMeta = activateOrRenewLiveReadPin(
      state,
      record,
      "ui_audit",
      chunkIndex,
      nowMs
    );
    const liveMetaFields = buildLiveReadMetadata(updatedMeta);

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
      storedAt: record.storedAt,
      expiresAt: record.expiresAt,
      runIdentity: record.runIdentity,
      runTimestamp: record.runTimestamp,
      ...liveMetaFields,
      chunkIndex,
      chunkCount: chunks.length,
      chunkUtf8Bytes: utf8ByteLength(chunkText),
      totalUtf8Bytes: record.uiAuditUtf8Bytes,
      hasMoreChunks,
      nextChunkIndex: hasMoreChunks ? chunkIndex + 1 : null,
      text: chunkText,
    });
  }

  // Handle organized views on verified schemaVersion=1 live_bench_state reports
  if (view !== "chunk") {
    const parsedCheck = parseVerifiedLiveBenchSnapshot(record);
    if (!parsedCheck.ok) {
      return finalizeResponse({
        ok: false,
        status: parsedCheck.status,
        code: parsedCheck.code,
        reportId: record.reportId,
        productId: record.productId,
        mode: record.mode,
        view,
        message: parsedCheck.message,
      });
    }

    const snapshot = parsedCheck.snapshot;

    if (view === "index") {
      const indexPayload = buildIndexViewData(record, snapshot);
      return buildBoundedOrganizedViewEnvelope({
        record,
        snapshot,
        view: "index",
        chunkIndex,
        viewPayloadObj: indexPayload,
        state,
        nowMs,
      });
    }

    if (view === "header") {
      const headerPayload = buildHeaderViewData(record, snapshot);
      return buildBoundedOrganizedViewEnvelope({
        record,
        snapshot,
        view: "header",
        chunkIndex,
        viewPayloadObj: headerPayload,
        state,
        nowMs,
      });
    }

    if (view === "review") {
      const reviewPayload = buildReviewViewData(snapshot, record);
      return buildBoundedOrganizedViewEnvelope({
        record,
        snapshot,
        view: "review",
        chunkIndex,
        viewPayloadObj: reviewPayload,
        state,
        nowMs,
      });
    }

    if (view === "drawer") {
      const drawerRes = resolveDrawerTarget(snapshot, trimmedDrawer, record);
      if (!drawerRes.ok) {
        return finalizeResponse({
          ok: false,
          status: "invalid_request",
          code: drawerRes.code,
          reportId: record.reportId,
          productId: record.productId,
          benchSessionId: record.benchSessionId,
          benchRevision: record.benchRevision,
          view: "drawer",
          drawer: trimmedDrawer,
          availableDrawers: drawerRes.availableDrawers || [],
          message: drawerRes.message,
        });
      }

      const drawerPayload = {
        drawer: drawerRes.drawerTitle,
        selectionState: snapshot.selectionState || record.selectionState || "selected",
        manifestLoaded: Boolean(snapshot.manifestLoaded),
        fieldCount: drawerRes.fieldKeys.length,
        fieldKeys: drawerRes.fieldKeys,
        fields: drawerRes.fields,
      };

      return buildBoundedOrganizedViewEnvelope({
        record,
        snapshot,
        view: "drawer",
        drawer: drawerRes.drawerTitle,
        chunkIndex,
        viewPayloadObj: drawerPayload,
        state,
        nowMs,
      });
    }

    if (view === "field") {
      const fieldRes = resolveFieldTarget(snapshot, trimmedFieldKey, record);
      if (!fieldRes.ok) {
        return finalizeResponse({
          ok: false,
          status: "invalid_request",
          code: fieldRes.code,
          reportId: record.reportId,
          productId: record.productId,
          benchSessionId: record.benchSessionId,
          benchRevision: record.benchRevision,
          view: "field",
          fieldKey: trimmedFieldKey,
          message: fieldRes.message,
        });
      }

      const fieldPayload = {
        fieldKey: fieldRes.fieldKey,
        ...(fieldRes.requestedAlias ? { requestedAlias: fieldRes.requestedAlias } : {}),
        selectionState: snapshot.selectionState || record.selectionState || "selected",
        manifestLoaded: Boolean(snapshot.manifestLoaded),
        field: fieldRes.field,
      };

      return buildBoundedOrganizedViewEnvelope({
        record,
        snapshot,
        view: "field",
        fieldKey: fieldRes.fieldKey,
        chunkIndex,
        viewPayloadObj: fieldPayload,
        state,
        nowMs,
      });
    }
  }

  // Default legacy chunk read (section === "report", view === "chunk")
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

  // Valid report chunk bounds confirmed: start pin on chunkIndex=0 or renew active pin
  const updatedMeta = activateOrRenewLiveReadPin(
    state,
    record,
    "report",
    chunkIndex,
    nowMs
  );
  const liveMetaFields = buildLiveReadMetadata(updatedMeta);

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
    storedAt: record.storedAt,
    expiresAt: record.expiresAt,
    runIdentity: record.runIdentity,
    runTimestamp: record.runTimestamp,
    ...liveMetaFields,
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
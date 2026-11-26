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

// Defensible upper bounds for mutable read-time metadata fields derived directly
// from cache enforcement in meta-injector.sidekick-report-cache.server.js:
// - supersededByRevision: validated by Number.isSafeInteger (>= 1, <= 9007199254740991) -> 16 ASCII digits max.
// - pinExpiresAt: generated strictly via new Date(effectivePinExpMs).toISOString()
//   for finite pin timestamps within 10 minutes of Date.now() -> standard 24-char
//   ISO-8601 format ("YYYY-MM-DDTHH:mm:ss.sssZ") or 27-char extended-year ISO
//   format ("+YYYYYY-MM-DDTHH:mm:ss.sssZ"), both <= 27 ASCII bytes + 2 JSON quotes.
const MAX_SAFE_INTEGER_BOUND = Number.MAX_SAFE_INTEGER;
const MAX_DATE_TO_ISO_STRING_BOUND = "+999999-12-31T23:59:59.999Z";

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

/**
 * Computes the exact UTF-16 code-unit step (1 or 2) and exact UTF-8 byte cost
 * inside a JSON-serialized string value (excluding the 2 outer `"` delimiters)
 * for the next Unicode scalar value or isolated surrogate at `str[index]`,
 * matching V8/ECMA-262 `JSON.stringify` RFC 8259 escaping rules:
 * - Short escapes (`"`, `\`, `\b`, `\f`, `\n`, `\r`, `\t`): 2 content bytes.
 * - Remaining ASCII control chars (`0x00..0x1F`): 6 content bytes (`\u00XX`).
 * - Isolated (unpaired) UTF-16 surrogates (`0xD800..0xDFFF`): 6 content bytes (`\udxxx`).
 * - Paired astral code points (`U+10000..U+10FFFF`): 2 code units, 4 UTF-8 bytes.
 * - Other BMP code points: 1 byte (`<= 0x7F`), 2 bytes (`<= 0x7FF`), or 3 bytes (`<= 0xFFFF`).
 */
export function measureJsonEscapedNextSymbol(str, index) {
  const firstUnit = str.charCodeAt(index);

  if (firstUnit >= 0xd800 && firstUnit <= 0xdbff) {
    if (index + 1 < str.length) {
      const secondUnit = str.charCodeAt(index + 1);
      if (secondUnit >= 0xdc00 && secondUnit <= 0xdfff) {
        return { codeUnits: 2, escapedUtf8Bytes: 4, rawUtf8Bytes: 4 };
      }
    }
    // Unpaired high surrogate: JSON.stringify emits \ud8xx..\udbxx (6 ASCII bytes);
    // Buffer.byteLength(slice, "utf8") emits U+FFFD replacement (3 UTF-8 bytes).
    return { codeUnits: 1, escapedUtf8Bytes: 6, rawUtf8Bytes: 3 };
  }

  if (firstUnit >= 0xdc00 && firstUnit <= 0xdfff) {
    // Unpaired low surrogate: JSON.stringify emits \udcxx..\udfff (6 ASCII bytes).
    return { codeUnits: 1, escapedUtf8Bytes: 6, rawUtf8Bytes: 3 };
  }

  if (
    firstUnit === 0x22 ||
    firstUnit === 0x5c ||
    firstUnit === 0x08 ||
    firstUnit === 0x09 ||
    firstUnit === 0x0a ||
    firstUnit === 0x0c ||
    firstUnit === 0x0d
  ) {
    return { codeUnits: 1, escapedUtf8Bytes: 2, rawUtf8Bytes: 1 };
  }

  if (firstUnit < 0x20) {
    return { codeUnits: 1, escapedUtf8Bytes: 6, rawUtf8Bytes: 1 };
  }

  if (firstUnit <= 0x7f) {
    return { codeUnits: 1, escapedUtf8Bytes: 1, rawUtf8Bytes: 1 };
  }

  if (firstUnit <= 0x7ff) {
    return { codeUnits: 1, escapedUtf8Bytes: 2, rawUtf8Bytes: 2 };
  }

  return { codeUnits: 1, escapedUtf8Bytes: 3, rawUtf8Bytes: 3 };
}

/**
 * Returns the exact UTF-8 byte length of `str` as serialized inside a JSON
 * string value (excluding the two surrounding `"` quotes), i.e.,
 * `utf8ByteLength(JSON.stringify(str)) - 2`.
 */
export function jsonEscapedContentUtf8Bytes(str) {
  if (typeof str !== "string" || str.length === 0) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < str.length; ) {
    const step = measureJsonEscapedNextSymbol(str, i);
    total += step.escapedUtf8Bytes;
    i += step.codeUnits;
  }
  return total;
}

/**
 * Splits `text` on Unicode scalar / isolated-surrogate boundaries so that EVERY
 * chunk's JSON-escaped content UTF-8 byte length is `<= maxEscapedContentBytes`
 * (and optionally its raw UTF-8 byte length is `<= maxRawUtf8Bytes` when finite).
 *
 * - Never guesses character minimum widths: checks the actual next symbol's
 *   `escapedUtf8Bytes` (1, 2, 3, 4, or 6 bytes) against `maxEscapedContentBytes`.
 * - Handles `text === ""` honestly via `preserveEmptyStringChunk`: when `false`
 *   (default for cache storage where empty text produces `[]`), returns `[]` if
 *   `maxEscapedContentBytes >= 0`; when `true` (if an envelope carries `text: ""`),
 *   returns `[""]` iff `maxEscapedContentBytes >= 0`.
 * - Rejects with `{ ok: false, code: "metadata_exceeds_response_ceiling" }` ONLY
 *   when `maxEscapedContentBytes < 0` or an actual symbol in `text` cannot fit.
 */
export function splitJsonEscapedUtf8Chunks(
  text,
  maxEscapedContentBytes,
  options = {}
) {
  if (typeof text !== "string") {
    return {
      ok: false,
      code: "invalid_chunk_source_text",
      message: "Chunk source text must be a string.",
      chunks: Object.freeze([]),
    };
  }

  if (
    typeof maxEscapedContentBytes !== "number" ||
    !Number.isFinite(maxEscapedContentBytes) ||
    maxEscapedContentBytes < 0
  ) {
    return {
      ok: false,
      code: "metadata_exceeds_response_ceiling",
      message:
        "Response metadata alone exceeds the 3500 UTF-8 byte ceiling; zero bytes remain for chunk text.",
      chunks: Object.freeze([]),
    };
  }

  const maxRawBytes =
    typeof options?.maxRawUtf8Bytes === "number" &&
    Number.isFinite(options.maxRawUtf8Bytes) &&
    options.maxRawUtf8Bytes > 0
      ? Math.trunc(options.maxRawUtf8Bytes)
      : Infinity;
  const preserveEmptyStringChunk = Boolean(options?.preserveEmptyStringChunk);

  const budget = Math.trunc(maxEscapedContentBytes);

  if (text.length === 0) {
    return {
      ok: true,
      chunks: preserveEmptyStringChunk ? Object.freeze([""]) : Object.freeze([]),
    };
  }

  const chunks = [];
  let chunkStart = 0;
  let currentEscapedBytes = 0;
  let currentRawBytes = 0;

  for (let i = 0; i < text.length; ) {
    const step = measureJsonEscapedNextSymbol(strOrText(text), i);

    if (step.escapedUtf8Bytes > budget || step.rawUtf8Bytes > maxRawBytes) {
      return {
        ok: false,
        code: "metadata_exceeds_response_ceiling",
        message:
          "Response metadata leaves insufficient UTF-8 byte budget to fit the next character without truncation.",
        chunks: Object.freeze([]),
      };
    }

    if (
      (currentEscapedBytes + step.escapedUtf8Bytes > budget ||
        currentRawBytes + step.rawUtf8Bytes > maxRawBytes) &&
      i > chunkStart
    ) {
      chunks.push(text.slice(chunkStart, i));
      chunkStart = i;
      currentEscapedBytes = 0;
      currentRawBytes = 0;
    }

    currentEscapedBytes += step.escapedUtf8Bytes;
    currentRawBytes += step.rawUtf8Bytes;
    i += step.codeUnits;
  }

  if (chunkStart < text.length) {
    chunks.push(text.slice(chunkStart));
  }

  if (chunks.join("") !== text) {
    return {
      ok: false,
      code: "chunk_integrity_failure",
      message: "Failed lossless UTF-8 code-point chunk reassembly check.",
      chunks: Object.freeze([]),
    };
  }

  return {
    ok: true,
    chunks: Object.freeze(chunks),
  };
}

function strOrText(val) {
  return val;
}

function maxDecimalMagnitudeForDigits(value) {
  const n = Math.max(0, Math.trunc(Number(value) || 0));
  const digits = String(n).length;
  // Return 9, 99, 999, ... with the exact same digit count as `n` (never exceeding MAX_SAFE_INTEGER)
  if (digits >= 16) {
    return MAX_SAFE_INTEGER_BOUND;
  }
  return Math.pow(10, digits) - 1;
}

/**
 * Terminating fixed-point envelope-aware chunk planner shared by organized views
 * and precomputed cache chunk builders (`reportChunks` and `uiAuditChunks`).
 *
 * Given:
 * - `text`: full string to split losslessly into 1..N chunks (or "" -> [] / [""]).
 * - `buildProbeEnvelope(counterBounds)`: callback returning the COMPLETE actual
 *   JSON response envelope for this exact record/view with `text: ""`, populated
 *   with exact immutable record strings, defensible mutable live-pin bounds
 *   (`isHistoricalSuperseded: false`, `supersededByRevision: Number.MAX_SAFE_INTEGER`,
 *   `pinExpiresAt: "+999999-12-31T23:59:59.999Z"` when `isLiveBenchState`), and
 *   the current upper-bound integers for `chunkIndex`, `chunkCount`,
 *   `chunkUtf8Bytes`, `totalUtf8Bytes`, `hasMoreChunks: false`, and `nextChunkIndex`.
 *
 * Guarantees termination in `<= 4` iterations because tightening or relaxing
 * digit widths of `chunkCount` (`1..text.length + 1`) is monotonic over at most
 * `1..7` decimal digits (`text.length <= 1,048,576`), and verifies every resulting
 * chunk against `MAX_RESPONSE_UTF8_BYTES` (`3500`) using exact `JSON.stringify`.
 */
export function buildEnvelopeBoundedTextChunks({
  text,
  buildProbeEnvelope,
  maxResponseUtf8Bytes = MAX_RESPONSE_UTF8_BYTES,
  maxRawChunkUtf8Bytes = Infinity,
  preserveEmptyStringChunk = false,
}) {
  if (typeof text !== "string") {
    return {
      ok: false,
      code: "invalid_chunk_source_text",
      message: "Chunk source text must be a string.",
    };
  }
  if (typeof buildProbeEnvelope !== "function") {
    return {
      ok: false,
      code: "invalid_envelope_builder",
      message: "A valid probe envelope builder function is required.",
    };
  }

  const totalUtf8Bytes = utf8ByteLength(text);

  if (text.length === 0) {
    const emptyProbe = buildProbeEnvelope({
      chunkIndex: 0,
      chunkCount: preserveEmptyStringChunk ? 1 : 0,
      chunkUtf8Bytes: 0,
      totalUtf8Bytes: 0,
      hasMoreChunks: false,
      nextChunkIndex: null,
    });
    let emptySerializedBytes = Infinity;
    try {
      emptySerializedBytes = utf8ByteLength(JSON.stringify(emptyProbe));
    } catch {
      return {
        ok: false,
        code: "serialization_failure",
        message: "Failed to serialize response metadata envelope.",
      };
    }
    if (emptySerializedBytes > maxResponseUtf8Bytes) {
      return {
        ok: false,
        code: "metadata_exceeds_response_ceiling",
        message:
          "Response metadata exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
      };
    }
    return {
      ok: true,
      chunks: preserveEmptyStringChunk ? Object.freeze([""]) : Object.freeze([]),
      totalUtf8Bytes: 0,
      maxEscapedContentBytes: maxResponseUtf8Bytes - emptySerializedBytes,
    };
  }

  // Initial lower-bound estimate on chunkCount is 1; fixed-point loop widens
  // counter digit widths strictly from actual split results until stable.
  let assumedMaxCount = 1;
  let assumedMaxRawChunkBytes = Math.min(
    totalUtf8Bytes,
    Number.isFinite(maxRawChunkUtf8Bytes) ? Math.trunc(maxRawChunkUtf8Bytes) : totalUtf8Bytes
  );

  for (let pass = 0; pass < 8; pass += 1) {
    const countMagnitudeBound = maxDecimalMagnitudeForDigits(assumedMaxCount);
    const indexMagnitudeBound = maxDecimalMagnitudeForDigits(
      Math.max(0, assumedMaxCount - 1)
    );
    // For nextChunkIndex: when chunkCount === 1, nextChunkIndex is always `null` (4 bytes);
    // when chunkCount > 1, non-final chunks have integer `1..chunkCount-1` and final chunk
    // has `null` (4 bytes), so max byte width is max(4, digits(chunkCount - 1)).
    const nextIndexRepresentative =
      assumedMaxCount <= 1
        ? null
        : String(indexMagnitudeBound).length >= 4
          ? indexMagnitudeBound
          : null;
    const rawBytesMagnitudeBound = maxDecimalMagnitudeForDigits(
      assumedMaxRawChunkBytes
    );

    const probeEnvelope = buildProbeEnvelope({
      chunkIndex: indexMagnitudeBound,
      chunkCount: countMagnitudeBound,
      chunkUtf8Bytes: rawBytesMagnitudeBound,
      totalUtf8Bytes,
      // "false" is 5 ASCII bytes vs "true" (4 bytes), so `false` strictly upper-bounds both!
      hasMoreChunks: false,
      nextChunkIndex: nextIndexRepresentative,
    });

    let emptyTextEnvelopeBytes = Infinity;
    try {
      emptyTextEnvelopeBytes = utf8ByteLength(JSON.stringify(probeEnvelope));
    } catch {
      return {
        ok: false,
        code: "serialization_failure",
        message: "Failed to serialize response metadata envelope.",
      };
    }

    const maxEscapedContentBytes = maxResponseUtf8Bytes - emptyTextEnvelopeBytes;
    if (maxEscapedContentBytes <= 0) {
      return {
        ok: false,
        code: "metadata_exceeds_response_ceiling",
        message:
          "Response metadata exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
      };
    }

    const splitRes = splitJsonEscapedUtf8Chunks(text, maxEscapedContentBytes, {
      maxRawUtf8Bytes: maxRawChunkUtf8Bytes,
      preserveEmptyStringChunk,
    });

    if (!splitRes.ok) {
      return splitRes;
    }

    const actualCount = splitRes.chunks.length;
    let actualMaxChunkRawBytes = 0;
    for (let c = 0; c < actualCount; c += 1) {
      const cRaw = utf8ByteLength(splitRes.chunks[c]);
      if (cRaw > actualMaxChunkRawBytes) {
        actualMaxChunkRawBytes = cRaw;
      }
    }

    const countDigitsgrew =
      String(actualCount).length > String(assumedMaxCount).length ||
      (assumedMaxCount === 1 && actualCount > 1);
    const rawDigitsGrew =
      String(actualMaxChunkRawBytes).length >
      String(assumedMaxRawChunkBytes).length;

    if (!countDigitsgrew && !rawDigitsGrew) {
      // Final exact verification across every produced chunk with its real counters
      // and worst-case mutable pin/superseded fields embedded in buildProbeEnvelope.
      let anyOverflow = false;
      for (let idx = 0; idx < actualCount; idx += 1) {
        const chunkStr = splitRes.chunks[idx];
        const hasMore = idx + 1 < actualCount;
        const verifyEnv = buildProbeEnvelope({
          chunkIndex: idx,
          chunkCount: actualCount,
          chunkUtf8Bytes: utf8ByteLength(chunkStr),
          totalUtf8Bytes,
          hasMoreChunks: hasMore,
          nextChunkIndex: hasMore ? idx + 1 : null,
        });
        verifyEnv.text = chunkStr;
        if (utf8ByteLength(JSON.stringify(verifyEnv)) > maxResponseUtf8Bytes) {
          anyOverflow = true;
          break;
        }
      }

      if (!anyOverflow) {
        return {
          ok: true,
          chunks: splitRes.chunks,
          totalUtf8Bytes,
          maxEscapedContentBytes,
        };
      }
    }

    assumedMaxCount = Math.max(assumedMaxCount + 1, actualCount);
    assumedMaxRawChunkBytes = Math.max(
      assumedMaxRawChunkBytes,
      actualMaxChunkRawBytes
    );
  }

  return {
    ok: false,
    code: "metadata_exceeds_response_ceiling",
    message:
      "Unable to fit complete metadata envelope and non-empty text chunk within the 3500 UTF-8 byte ceiling.",
  };
}

/**
 * Returns defensible upper-bound values for mutable live-bench read-pin and
 * supersession fields so chunk boundaries computed at write time or initial
 * organized-view read time NEVER overflow `3500` bytes if the record is later
 * pinned (`pinExpiresAt` ISO string) and superseded (`supersededByRevision`
 * positive safe integer).
 */
export function getMutableLivePinEnvelopeBounds() {
  return {
    isHistoricalSuperseded: false,
    supersededByRevision: MAX_SAFE_INTEGER_BOUND,
    pinExpiresAt: MAX_DATE_TO_ISO_STRING_BOUND,
  };
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
  let canonicalText = "";
  try {
    canonicalText = JSON.stringify(viewPayloadObj);
  } catch {
    return finalizeResponse({
      ok: false,
      status: "error",
      code: "serialization_failure",
      message: "Failed to serialize organized view payload.",
    });
  }

  const resolvedClientStateChangedAt =
    record.clientStateChangedAt ?? record.capturedAt;
  const mutablePinBounds = getMutableLivePinEnvelopeBounds();

  // Compute chunk boundaries against the COMPLETE actual organized-view envelope
  // using immutable record strings + defensible upper bounds on mutable pin/superseded
  // fields so chunk boundaries remain 100% deterministic across active, pinned, and
  // superseded reads while guaranteeing `utf8ByteLength(JSON.stringify(response)) <= 3500`.
  const chunkPlan = buildEnvelopeBoundedTextChunks({
    text: canonicalText,
    maxResponseUtf8Bytes: MAX_RESPONSE_UTF8_BYTES,
    maxRawChunkUtf8Bytes: MAX_ORGANIZED_VIEW_CHUNK_UTF8_BYTES,
    preserveEmptyStringChunk: true,
    buildProbeEnvelope: (counters) => ({
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
      clientStateChangedAt: resolvedClientStateChangedAt,
      baselineLoadedAt: record.baselineLoadedAt,
      serverReceivedAt: record.storedAt,
      expiresAt: record.expiresAt,
      baselineSource: record.baselineSource,
      workingState: record.workingState,
      isHistoricalSuperseded: mutablePinBounds.isHistoricalSuperseded,
      supersededByRevision: mutablePinBounds.supersededByRevision,
      pinExpiresAt: mutablePinBounds.pinExpiresAt,
      uiAuditState: record.uiAuditState,
      chunkIndex: counters.chunkIndex,
      chunkCount: counters.chunkCount,
      chunkUtf8Bytes: counters.chunkUtf8Bytes,
      totalUtf8Bytes: counters.totalUtf8Bytes,
      hasMoreChunks: counters.hasMoreChunks,
      nextChunkIndex: counters.nextChunkIndex,
      text: "",
    }),
  });

  if (!chunkPlan.ok) {
    return finalizeResponse(
      {
        ok: false,
        status: "error",
        code: chunkPlan.code || "metadata_exceeds_response_ceiling",
        reportId: record.reportId,
        section: "report",
        view,
        message:
          chunkPlan.message ||
          "Organized view metadata exceeded the 3500 UTF-8 byte ceiling; report text was not truncated.",
      },
      chunkPlan.code || "metadata_exceeds_response_ceiling"
    );
  }

  const chunks = chunkPlan.chunks;
  const totalUtf8Bytes = chunkPlan.totalUtf8Bytes;

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
    clientStateChangedAt: resolvedClientStateChangedAt,
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
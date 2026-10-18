import {
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  parseMetaobjectGidArray,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  formatErrorsList,
  validArray,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  HIDDEN_CONTEXT_FIELDS,
  INTEGRATION_PREFIXES,
  PROTECTED_FIELDS,
  REQUIRED_FIELDS,
  resolveConfigFieldDestination,
  getDynamicSections
} from "./meta-injector.matrix-domain.jsx";

// ==========================================================================
// ROCKHOUND STUDIO — MATRIX TELEMETRY & GROUPED REPORT ENGINE
// File: app/utils/meta-injector.telemetry.jsx
//
// INTERFACE CONTRACT (Backwards-Compatible):
// 1. buildAndCopyMatrixTelemetry({ mode = "full", options = {}, ...existingArgs })
//    - Supported modes:
//      * "summary"           (Sidekick < 6000 chars per part; no product text)
//      * "coverage"          (Sidekick < 6000 chars per part; no product values)
//      * "standardized"      (Sidekick < 6000 chars per part)
//      * "origin_collection" (Sidekick < 6000 chars per part; includes origin text)
//      * "description"       (Sidekick < 6000 chars per part; includes full current/proposed text)
//      * "photos_alt"        (Sidekick < 6000 chars per part; per-photo IDs & alts)
//      * "save_results"      (Sidekick < 6000 chars per part; attempts, errors, read-back)
//      * "drawer"            (Sidekick < 6000 chars per part; scoped to options.sectionTitle)
//      * "review"            (Legacy review telemetry; Sidekick < 6000 chars per part)
//      * "full"              (Legacy full report; Sidekick < 6000 chars per part)
//      * "gemini_all"        (Complete packet across all sections; 120000-char application guard)
//      * "download_full"     (Downloads complete untruncated .txt file; no clipboard overwrite)
//    - Optional options / top-level props:
//      * sectionTitle: string (used when mode === "drawer" or mode === "drawer:<title>")
//      * partIndex: number (0-based; when supplied with a cached packet, copies that exact part)
//      * existingPacket: object (previously captured packet so copying Part 2..N never recollects)
//      * onTelemetryPacketReady: (packet) => void (optional callback receiving the captured packet)
//    - Return value:
//      Returns the immutable captured packet:
//      {
//        mode, sectionKey, sectionLabel, productId, productTitle,
//        runIdentity, runTimestamp, capturedAt, limitUsed,
//        fullText, parts: [{ index, partNumber, totalParts, label, text, charCount }],
//        activePartIndex
//      }
// 2. copyCapturedTelemetryPart({ packet, partIndex, setSafetyError, setSafetyMessage })
//    - Copies a specific pre-captured part without re-reading or mutating product state.
// 3. downloadCapturedTelemetryReport({ packet, setSafetyError, setSafetyMessage })
//    - Triggers a browser .txt download of packet.fullText with safe filename & URL revocation.
// ==========================================================================

const SIDEKICK_MAX_HARD_LIMIT = 6000;
const SIDEKICK_TARGET_PART_LIMIT = 5800;
const GEMINI_PACKET_GUARD_LIMIT = 120000;
const GEMINI_TARGET_PART_LIMIT = 118000;

const SENSITIVE_TELEMETRY_KEY_REGEX = /token|secret|password|authorization|cookie|header|credential|api[_-]?key|session/i;

const sanitizeTelemetryText = (val) => {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str || str === "[object Object]") return "";
  return str
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/gi, "shpat_[REDACTED]")
    .replace(/shpca_[A-Za-z0-9_]+/gi, "shpca_[REDACTED]")
    .replace(/shpss_[A-Za-z0-9_]+/gi, "shpss_[REDACTED]");
};

// Preserves exact line breaks, whitespace, and Unicode for full-text blocks while redacting credentials
const sanitizeMultilineContentLossless = (val) => {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (!str || str === "[object Object]") return "";
  return str
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/gi, "shpat_[REDACTED]")
    .replace(/shpca_[A-Za-z0-9_]+/gi, "shpca_[REDACTED]")
    .replace(/shpss_[A-Za-z0-9_]+/gi, "shpss_[REDACTED]");
};

const formatTelemetryErrorRecord = (item) => {
  if (item === undefined || item === null) return "";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return sanitizeTelemetryText(item);
  }
  if (typeof item === "object") {
    const message = sanitizeTelemetryText(item.message ?? item.error ?? item.reason ?? "");
    const rawField = item.field ?? item.path ?? null;
    const field = Array.isArray(rawField)
      ? rawField.map(p => sanitizeTelemetryText(p)).filter(Boolean).join(".")
      : sanitizeTelemetryText(rawField);
    const code = sanitizeTelemetryText(item.code ?? "");
    const destination = sanitizeTelemetryText(item.destination ?? item.key ?? "");

    if (typeof item.formatted === "string" && sanitizeTelemetryText(item.formatted)) {
      return sanitizeTelemetryText(item.formatted);
    }

    let fallback = "";
    if (!message) {
      const pairs = [];
      Object.entries(item).forEach(([k, v]) => {
        if (SENSITIVE_TELEMETRY_KEY_REGEX.test(k)) return;
        if (v === undefined || v === null) return;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          const cleanV = sanitizeTelemetryText(v);
          if (cleanV) pairs.push(`${k}=${cleanV}`);
        } else if (Array.isArray(v)) {
          const joined = v.map(p => sanitizeTelemetryText(p)).filter(Boolean).join(".");
          if (joined) pairs.push(`${k}=${joined}`);
        }
      });
      fallback = pairs.join(", ");
    }

    const effectiveMsg = message || fallback;
    if (!effectiveMsg && !field && !code && !destination) return "";

    const metaParts = [];
    if (destination) metaParts.push(`dest: ${destination}`);
    if (field && field !== destination) metaParts.push(`field: ${field}`);
    if (code) metaParts.push(`code: ${code}`);

    const prefix = metaParts.length > 0 ? `[${metaParts.join(" | ")}] ` : "";
    return `${prefix}${effectiveMsg || "Unspecified backend error"}`.trim();
  }
  return "";
};

const collectDistinctPreservedBackendErrors = (history, diag) => {
  const distinct = [];
  const seen = new Set();

  const addFormatted = (rawEntry) => {
    const formatted = formatTelemetryErrorRecord(rawEntry);
    if (!formatted) return;
    if (seen.has(formatted)) return;
    seen.add(formatted);
    distinct.push(formatted);
  };

  validArray(history?.errors).forEach(addFormatted);
  validArray(history?.errorMessages).forEach(addFormatted);
  validArray(diag?.errors).forEach(addFormatted);

  return distinct;
};

// Safely slices a string without splitting a UTF-16 surrogate pair across boundaries
const sliceUtf16Safe = (str, start, maxEnd) => {
  if (start >= str.length) return { chunk: "", nextIndex: str.length };
  let end = Math.min(str.length, maxEnd);
  if (end < str.length && end > start) {
    const code = str.charCodeAt(end - 1);
    if (code >= 0xd800 && code <= 0xdbff) {
      end -= 1;
    }
  }
  return { chunk: str.slice(start, end), nextIndex: end };
};

// Splits a single oversized line or field losslessly with explicit continuation markers
const splitOversizedPieceLossless = (text, maxChunkBodyChars, fieldTag = "TEXT") => {
  if (text.length <= maxChunkBodyChars) return [text];

  // Reserve space for continuation prefixes/suffixes (up to 4-digit part counts)
  const wrapperOverhead = 64 + fieldTag.length;
  const safeSliceBudget = Math.max(200, maxChunkBodyChars - wrapperOverhead);

  const rawSlices = [];
  let cursor = 0;
  while (cursor < text.length) {
    let targetEnd = Math.min(text.length, cursor + safeSliceBudget);
    if (targetEnd < text.length) {
      // Prefer breaking after a newline or space if one exists in the last 25% of the slice
      const minBreakSearch = cursor + Math.floor(safeSliceBudget * 0.75);
      const newlineIdx = text.lastIndexOf("\n", targetEnd - 1);
      const spaceIdx = text.lastIndexOf(" ", targetEnd - 1);
      if (newlineIdx >= minBreakSearch) {
        targetEnd = newlineIdx + 1;
      } else if (spaceIdx >= minBreakSearch) {
        targetEnd = spaceIdx + 1;
      }
    }
    const { chunk, nextIndex } = sliceUtf16Safe(text, cursor, targetEnd);
    rawSlices.push(chunk);
    cursor = nextIndex;
  }

  const totalCont = rawSlices.length;
  return rawSlices.map((sliceStr, idx) => {
    const contNum = idx + 1;
    const prefix = idx > 0 ? `[${fieldTag} CONT. ${contNum}/${totalCont}]\n` : `[${fieldTag} PART ${contNum}/${totalCont}]\n`;
    const suffix = idx < totalCont - 1 ? `\n[END ${fieldTag} PART ${contNum}/${totalCont} — CONTINUES]` : `\n[END ${fieldTag} PART ${contNum}/${totalCont}]`;
    return `${prefix}${sliceStr}${suffix}`;
  });
};

// Packs body text into lossless numbered parts where every final part (including headers & multi-digit part numbers)
// is strictly < hardMaxChars (5999 max for Sidekick) and targets targetMaxChars (5800 for Sidekick).
export function splitReportIntoLosslessParts({
  productTitle,
  productId,
  runIdentity,
  runTimestamp,
  capturedAt,
  sectionLabel,
  bodyText,
  targetMaxChars = SIDEKICK_TARGET_PART_LIMIT,
  hardMaxChars = SIDEKICK_MAX_HARD_LIMIT
}) {
  const cleanTitle = sanitizeTelemetryText(productTitle || "Not recorded") || "Not recorded";
  const cleanGid = sanitizeTelemetryText(productId || "Not recorded") || "Not recorded";
  const cleanRunId = sanitizeTelemetryText(runIdentity || "Not recorded") || "Not recorded";
  const cleanRunTime = sanitizeTelemetryText(runTimestamp || "Not recorded") || "Not recorded";
  const cleanCapturedAt = sanitizeTelemetryText(capturedAt || new Date().toISOString());
  const cleanSection = sanitizeTelemetryText(sectionLabel || "TELEMETRY REPORT");

  const buildEnvelopeHeader = (partNum, totalParts) =>
    `=== ROCKHOUND STUDIO TELEMETRY — ${cleanSection} [PART ${partNum} OF ${totalParts}] ===\n` +
    `Product: ${cleanTitle}\n` +
    `GID: ${cleanGid}\n` +
    `Run Identity: ${cleanRunId} | Run Time: ${cleanRunTime}\n` +
    `Snapshot Captured: ${cleanCapturedAt}\n` +
    `-----------------------------------------`;

  const buildEnvelopeFooter = (partNum, totalParts) =>
    `\n========================================= [END PART ${partNum} OF ${totalParts}] ===`;

  // Iteratively stabilizes if digit length of totalParts grows (e.g. 9 -> 10 or 99 -> 100)
  let assumedDigits = 2;
  for (let pass = 0; pass < 3; pass++) {
    const maxNumberPlaceholder = "9".repeat(assumedDigits);
    const sampleHeader = buildEnvelopeHeader(maxNumberPlaceholder, maxNumberPlaceholder);
    const sampleFooter = buildEnvelopeFooter(maxNumberPlaceholder, maxNumberPlaceholder);
    const envelopeOverhead = sampleHeader.length + sampleFooter.length + 2; // +2 for newline after header

    const effectiveCap = Math.min(targetMaxChars, hardMaxChars - 1);
    const maxBodyPerPart = Math.max(400, effectiveCap - envelopeOverhead);

    // Split body into paragraphs/blocks first; preserve exact newlines
    const rawBlocks = String(bodyText ?? "").split("\n\n");
    const atomicPieces = [];

    rawBlocks.forEach((block) => {
      if (block.length <= maxBodyPerPart) {
        atomicPieces.push({ text: block, joiner: "\n\n" });
      } else {
        // Try line-by-line packing before splitting individual lines
        const lines = block.split("\n");
        let lineAccumulator = "";
        lines.forEach((line) => {
          if (line.length > maxBodyPerPart) {
            if (lineAccumulator) {
              atomicPieces.push({ text: lineAccumulator, joiner: "\n" });
              lineAccumulator = "";
            }
            const splitChunks = splitOversizedPieceLossless(line, maxBodyPerPart, cleanSection);
            splitChunks.forEach((sc) => {
              atomicPieces.push({ text: sc, joiner: "\n" });
            });
          } else if (!lineAccumulator) {
            lineAccumulator = line;
          } else if (lineAccumulator.length + 1 + line.length <= maxBodyPerPart) {
            lineAccumulator += "\n" + line;
          } else {
            atomicPieces.push({ text: lineAccumulator, joiner: "\n" });
            lineAccumulator = line;
          }
        });
        if (lineAccumulator) {
          atomicPieces.push({ text: lineAccumulator, joiner: "\n\n" });
        }
      }
    });

    const bodyParts = [];
    let currentBody = "";

    atomicPieces.forEach((piece, idx) => {
      if (!currentBody) {
        currentBody = piece.text;
      } else {
        const prevJoiner = atomicPieces[idx - 1]?.joiner || "\n\n";
        if (currentBody.length + prevJoiner.length + piece.text.length <= maxBodyPerPart) {
          currentBody += prevJoiner + piece.text;
        } else {
          bodyParts.push(currentBody);
          currentBody = piece.text;
        }
      }
    });

    if (currentBody || bodyParts.length === 0) {
      bodyParts.push(currentBody);
    }

    const totalParts = bodyParts.length;
    const actualDigits = String(totalParts).length;
    if (actualDigits > assumedDigits) {
      assumedDigits = actualDigits;
      continue;
    }

    const finalizedParts = bodyParts.map((bText, i) => {
      const partNumber = i + 1;
      const header = buildEnvelopeHeader(partNumber, totalParts);
      const footer = buildEnvelopeFooter(partNumber, totalParts);
      const fullPartText = `${header}\n${bText}${footer}`;
      return {
        index: i,
        partNumber,
        totalParts,
        label: totalParts > 1 ? `${cleanSection} (Part ${partNumber}/${totalParts})` : cleanSection,
        text: fullPartText,
        charCount: fullPartText.length
      };
    });

    // Final safety verification: ensure no part ever reaches hardMaxChars
    const anyExceedsHardMax = finalizedParts.some(p => p.charCount >= hardMaxChars);
    if (anyExceedsHardMax && targetMaxChars > 1000) {
      targetMaxChars = Math.max(1000, targetMaxChars - 300);
      continue;
    }

    return finalizedParts;
  }

  // Fallback single-part wrapper if loop exits
  const fallbackHeader = buildEnvelopeHeader(1, 1);
  const fallbackFooter = buildEnvelopeFooter(1, 1);
  const fallbackText = `${fallbackHeader}\n${String(bodyText ?? "")}${fallbackFooter}`;
  return [{
    index: 0,
    partNumber: 1,
    totalParts: 1,
    label: cleanSection,
    text: fallbackText,
    charCount: fallbackText.length
  }];
}

const copyTextToClipboardWithFeedback = ({
  textToCopy,
  toastLabel,
  bannerMessage,
  setSafetyError,
  setSafetyMessage
}) => {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    if (typeof setSafetyError === "function") {
      setSafetyError("Clipboard API is unavailable in this browser context.");
    }
    return;
  }

  navigator.clipboard.writeText(textToCopy)
    .then(() => {
      if (typeof window !== "undefined" && window.shopify?.toast) {
        window.shopify.toast.show(toastLabel);
      }
      if (typeof setSafetyMessage === "function") {
        setSafetyMessage(bannerMessage || toastLabel);
      }
    })
    .catch((err) => {
      console.error("Clipboard error:", err);
      if (typeof setSafetyError === "function") {
        setSafetyError(`Failed to copy telemetry to clipboard: ${err?.message || "Clipboard permission denied"}`);
      }
    });
};

export function copyCapturedTelemetryPart({
  packet,
  partIndex = 0,
  setSafetyError,
  setSafetyMessage
}) {
  if (!packet || !Array.isArray(packet.parts) || packet.parts.length === 0) {
    if (typeof setSafetyError === "function") {
      setSafetyError("No captured telemetry report part is available to copy.");
    }
    return null;
  }

  const boundedIdx = Math.max(0, Math.min(packet.parts.length - 1, Number(partIndex) || 0));
  const targetPart = packet.parts[boundedIdx];
  const totalParts = packet.parts.length;

  const toastMsg = totalParts > 1
    ? `Copied ${packet.sectionLabel} — Part ${targetPart.partNumber} of ${totalParts} (${targetPart.charCount} chars)`
    : `Copied ${packet.sectionLabel} (${targetPart.charCount} chars)`;

  const bannerMsg = totalParts > 1
    ? `Copied ${packet.sectionLabel} [Part ${targetPart.partNumber} of ${totalParts}] (${targetPart.charCount} chars, captured ${packet.capturedAt}). Use the part buttons to copy remaining parts from the same snapshot.`
    : `Copied ${packet.sectionLabel} (${targetPart.charCount} chars, captured ${packet.capturedAt}).`;

  copyTextToClipboardWithFeedback({
    textToCopy: targetPart.text,
    toastLabel: toastMsg,
    bannerMessage: bannerMsg,
    setSafetyError,
    setSafetyMessage
  });

  return {
    ...packet,
    activePartIndex: boundedIdx
  };
}

export function downloadCapturedTelemetryReport({
  packet,
  setSafetyError,
  setSafetyMessage
}) {
  if (!packet || typeof packet.fullText !== "string") {
    if (typeof setSafetyError === "function") {
      setSafetyError("Cannot download report: No captured telemetry packet is available.");
    }
    return false;
  }

  if (typeof window === "undefined" || typeof document === "undefined" || typeof Blob === "undefined" || !URL?.createObjectURL) {
    if (typeof setSafetyError === "function") {
      setSafetyError("Browser file download is unavailable in this environment.");
    }
    return false;
  }

  let objectUrl = null;
  let anchor = null;
  try {
    const numericGid = String(packet.productId || "product").split("/").pop().replace(/[^a-zA-Z0-9_-]/g, "") || "product";
    const safeTitleSlug = String(packet.productTitle || "item")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "item";
    const safeTimeSlug = String(packet.capturedAt || new Date().toISOString())
      .replace(/[:.]/g, "-")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    const filename = `rockhound-telemetry-${numericGid}-${safeTitleSlug}-${safeTimeSlug}.txt`;
    const blob = new Blob([packet.fullText], { type: "text/plain;charset=utf-8" });
    objectUrl = URL.createObjectURL(blob);

    anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();

    const msg = `Downloaded complete telemetry report: ${filename} (${packet.fullText.length} chars).`;
    if (window.shopify?.toast) {
      window.shopify.toast.show("Full report downloaded (.txt)");
    }
    if (typeof setSafetyMessage === "function") {
      setSafetyMessage(msg);
    }
    return true;
  } catch (err) {
    console.error("Telemetry download failed:", err);
    if (typeof setSafetyError === "function") {
      setSafetyError(`Failed to download telemetry report: ${err?.message || "Unknown download error"}`);
    }
    return false;
  } finally {
    if (anchor && anchor.parentNode) {
      anchor.parentNode.removeChild(anchor);
    }
    if (objectUrl) {
      setTimeout(() => {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
      }, 1000);
    }
  }
}

export function buildAndCopyMatrixTelemetry({
  mode = "full",
  options = {},
  sectionTitle: topLevelSectionTitle,
  partIndex: topLevelPartIndex,
  existingPacket: topLevelExistingPacket,
  onTelemetryPacketReady,
  selectedBenchId,
  manifestData,
  repairHistory,
  safeProducts,
  approvals,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  getSystemStatus,
  getFieldMetadata,
  setSafetyError,
  setSafetyMessage
}) {
  const effectiveOptions = validObj(options);
  const requestedPartIndex =
    effectiveOptions.partIndex !== undefined
      ? effectiveOptions.partIndex
      : topLevelPartIndex;
  const suppliedPacket =
    effectiveOptions.existingPacket || topLevelExistingPacket || null;

  // If caller is requesting a specific part of an already-captured snapshot for the same product & mode,
  // copy that exact part without recollecting or mutating report contents.
  if (
    suppliedPacket &&
    suppliedPacket.productId === selectedBenchId &&
    suppliedPacket.mode === mode &&
    requestedPartIndex !== undefined &&
    Array.isArray(suppliedPacket.parts) &&
    suppliedPacket.parts[requestedPartIndex]
  ) {
    const updatedPacket = copyCapturedTelemetryPart({
      packet: suppliedPacket,
      partIndex: requestedPartIndex,
      setSafetyError,
      setSafetyMessage
    });
    if (typeof onTelemetryPacketReady === "function" && updatedPacket) {
      onTelemetryPacketReady(updatedPacket);
    }
    return updatedPacket;
  }

  if (!selectedBenchId || !manifestData?.[selectedBenchId]) {
    if (typeof setSafetyError === "function") {
      setSafetyError("Cannot collect telemetry: No active bench item.");
    }
    return null;
  }

  const capturedAt = new Date().toISOString();
  const data = manifestData[selectedBenchId];
  const history = repairHistory?.[selectedBenchId];
  const product = (safeProducts || []).find(p => p.id === selectedBenchId) || {};
  const statusObj = getSystemStatus();
  const diag = data.diagnostics || {};
  const dynamicSections = getDynamicSections(data);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);
  const lastSubmitted = submittedPayloads?.[selectedBenchId];

  const unsupportedKeys = validArray(history?.unsupportedKeys);
  const verifiedDestinations = validArray(history?.verifiedDestinations);
  const blockedFields = validObj(history?.blockedFields);
  const conflicts = validObj(history?.conflicts);
  const unresolvedChanges = validObj(history?.unresolvedChanges);
  const preservedBackendErrors = collectDistinctPreservedBackendErrors(history, diag);

  const hasRepairAttempt = Boolean(history || diag.stage === "executeRepairPlan");
  const isFailedRepair = Boolean(
    history &&
      (history.success === false ||
        history.status === "REPAIR_FAILED" ||
        history.status === "REPAIR_BLOCKED" ||
        history.readBackVerified === false)
  );

  const canVerifySubmittedAgainstReadBack = Boolean(
    history &&
      history.readBackVerified !== undefined &&
      !(history.success === false && diag.readBack === "Not called")
  );
  const unverifiedNativeFields = validArray(data.nativeTargets?.unverifiedFields);

  // Evaluate standardized candidate & reference matching state strictly for the selected product
  const rawProductCandidates = standardizedCandidatesByProduct?.[selectedBenchId] || {};
  const candidateBundle = buildCanonicalCandidateBundle(rawProductCandidates);
  const stagedCandidateKeys = Object.keys(candidateBundle.ordered);
  const hasStagedCandidates = candidateBundle.hasSupported;

  const refMatchResult = referenceMatchResultsByProduct?.[selectedBenchId] || null;
  const refMatchStatus = referenceMatchStatusByProduct?.[selectedBenchId] || null;

  // Distinguish actual run identity/timestamp from snapshot capture time
  const runIdentity =
    refMatchResult?.workflowRunId ||
    refMatchStatus?.workflowRunId ||
    refMatchResult?.requestId ||
    refMatchStatus?.requestId ||
    (history?.status ? `repair:${history.status}` : null) ||
    (diag.stage && diag.stage !== "Not reported" ? `stage:${diag.stage}` : "manifest_loaded");

  const runTimestamp =
    history?.completedAt ||
    refMatchResult?.matchedAt ||
    refMatchStatus?.updatedAt ||
    "No repair/match timestamp recorded";

  let refMatchStateSummary = "No candidates staged";
  let hasUnresolvedReferenceMatching = false;
  const refMatchReadErrors = [];
  const categoryIneligibleCandidates = [];
  const incompleteCandidateResolutions = [];
  const entryBlockedCandidateResolutions = [];
  const resolvedLookupDiagnosticNotes = [];
  const unapprovedEligibleStandardizedKeys = [];
  const approvedEligibleStandardizedKeys = [];

  if (hasStagedCandidates) {
    if (!refMatchResult) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary =
        refMatchStatus?.state === "discarded_stale"
          ? `Stale / Discarded (${stagedCandidateKeys.length} candidate(s) awaiting fresh match)`
          : refMatchStatus?.state === "submitting" || refMatchStatus?.state === "awaiting_response"
            ? `In Progress (${refMatchStatus.state})`
            : refMatchStatus?.state === "failed"
              ? `Failed (${sanitizeTelemetryText(refMatchStatus.message || "Request failed")})`
              : `Missing / Not Run (${stagedCandidateKeys.length} staged candidate(s): ${stagedCandidateKeys.join(", ")})`;
    } else if (
      refMatchResult.pieceId !== selectedBenchId ||
      refMatchResult.intent !== "resolveStandardizedCandidates" ||
      refMatchResult.readOnly !== true
    ) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary = "Invalid contract / Product identity mismatch";
    } else if (refMatchResult.snapshot !== candidateBundle.snapshot) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary = "Stale (Candidate snapshot changed since last match)";
    } else {
      const topLevelErrors = formatErrorsList(refMatchResult.errors);
      topLevelErrors.forEach(errText => {
        const cleanErr = sanitizeTelemetryText(errText);
        if (cleanErr && !refMatchReadErrors.includes(cleanErr)) {
          refMatchReadErrors.push(cleanErr);
        }
      });

      if (!refMatchResult.success || !refMatchResult.isComplete || topLevelErrors.length > 0) {
        hasUnresolvedReferenceMatching = true;
        refMatchStateSummary = `Failed / Incomplete (success: ${String(Boolean(refMatchResult.success))}, isComplete: ${String(Boolean(refMatchResult.isComplete))}, topErrors: ${topLevelErrors.length})`;
      } else {
        refMatchStateSummary = "Completed";
      }

      const matchTimeMs = refMatchResult.matchedAt ? Date.parse(refMatchResult.matchedAt) : NaN;
      const repairTimeMs = history?.completedAt ? Date.parse(history.completedAt) : NaN;
      const wasRematchedAfterRepair =
        !Number.isNaN(matchTimeMs) &&
        !Number.isNaN(repairTimeMs) &&
        matchTimeMs > repairTimeMs;

      stagedCandidateKeys.forEach(metaKey => {
        const destKey = `shopify.${metaKey}`;
        const res = refMatchResult.resolutions?.[destKey] || null;
        if (!res || typeof res !== "object") {
          hasUnresolvedReferenceMatching = true;
          incompleteCandidateResolutions.push(`${destKey}: Missing backend resolution object.`);
          return;
        }

        const catElig = res.categoryEligibility || refMatchResult.categoryEligibility?.[destKey] || null;
        const isCatComplete = catElig ? catElig.isComplete === true : false;
        const isConfirmedCatIneligible = Boolean(
          (isCatComplete && catElig?.isEligible === false) ||
            res.isCategoryEligible === false ||
            res.status === "category_ineligible" ||
            catElig?.status === "category_ineligible" ||
            catElig?.status === "missing_product_category" ||
            catElig?.status === "empty_constraint_values"
        );

        const fieldErrors = formatErrorsList(res.errors || res.error);
        const catReasonText = sanitizeTelemetryText(catElig?.reason || "");

        // Keep confirmed category-ineligible proposals distinct from read errors
        const actualFieldReadErrors = fieldErrors.filter(eText => {
          if (!isConfirmedCatIneligible) return true;
          const trimmed = eText.trim();
          if (catReasonText && trimmed === catReasonText) return false;
          if (/^Category constraint mismatch on /i.test(trimmed)) return false;
          if (/^Product has no assigned taxonomy category/i.test(trimmed)) return false;
          return true;
        });

        actualFieldReadErrors.forEach(eText => {
          const cleanFieldErr = `[${destKey}] ${sanitizeTelemetryText(eText)}`;
          if (!refMatchReadErrors.includes(cleanFieldErr)) {
            refMatchReadErrors.push(cleanFieldErr);
          }
        });

        if (isConfirmedCatIneligible) {
          categoryIneligibleCandidates.push(
            `${destKey}: ${catReasonText || "Ineligible for this product's taxonomy category (candidate evidence preserved; write blocked)."}`
          );
          return;
        }

        if (res.isComplete !== true || !isCatComplete || actualFieldReadErrors.length > 0) {
          hasUnresolvedReferenceMatching = true;
          incompleteCandidateResolutions.push(
            `${destKey}: ${actualFieldReadErrors[0] || catReasonText || "Incomplete reference or category constraint enumeration."}`
          );
          return;
        }

        const entryStatus = sanitizeTelemetryText(res.entryMatchStatus || res.status || "");
        const meta = getFieldMetadata(destKey, data, selectedBenchId, approvals, allConfigFields);
        const stdEval = meta?.stdEvaluation || null;

        const activeSelectedList =
          typeof meta?.propVal === "string" && meta.propVal.trim() !== ""
            ? meta.propVal.trim()
            : typeof stdEval?.autoProposalSerialized === "string"
              ? stdEval.autoProposalSerialized.trim()
              : "";

        const selectedListValidation = validateProposedStandardizedGidList(activeSelectedList, stdEval);
        const isTechnicallyResolvedAndValid = Boolean(
          stdEval?.isTechnicallyEligible === true &&
          stdEval?.isCategoryEligible === true &&
          selectedListValidation.valid === true
        );

        if (!isTechnicallyResolvedAndValid) {
          const blockDetail = sanitizeTelemetryText(
            stdEval?.blockReason ||
            selectedListValidation.reason ||
            (entryStatus ? `Entry resolution status is "${entryStatus}".` : "Unresolved reference entry match.")
          );
          const rawLookupPrefix =
            entryStatus && !blockDetail.toLowerCase().includes(entryStatus.toLowerCase())
              ? `Entry resolution status is "${entryStatus}" (${blockDetail})`
              : blockDetail;
          entryBlockedCandidateResolutions.push(`${destKey}: ${rawLookupPrefix}`);
          return;
        }

        if (entryStatus === "ambiguous" || entryStatus === "missing_entry" || entryStatus === "blocked") {
          const canonicalSelectedStr = JSON.stringify(selectedListValidation.gids);
          const submittedStr =
            lastSubmitted && Object.prototype.hasOwnProperty.call(lastSubmitted, destKey)
              ? String(lastSubmitted[destKey] ?? "").trim()
              : "";
          const rawLoadedMetafield =
            data.currentMetafields && Object.prototype.hasOwnProperty.call(data.currentMetafields, destKey)
              ? data.currentMetafields[destKey]
              : undefined;
          const isRawLoadedSourceCompleteAndValid = !(
            rawLoadedMetafield &&
            typeof rawLoadedMetafield === "object" &&
            !Array.isArray(rawLoadedMetafield) &&
            (rawLoadedMetafield.readComplete === false ||
              rawLoadedMetafield.parseValid === false ||
              Boolean(rawLoadedMetafield.parseError))
          );
          const parsedLoadedGids = isRawLoadedSourceCompleteAndValid
            ? parseMetaobjectGidArray(
                rawLoadedMetafield && typeof rawLoadedMetafield === "object" && !Array.isArray(rawLoadedMetafield)
                  ? (rawLoadedMetafield.referenceIds ?? rawLoadedMetafield.rawValue)
                  : rawLoadedMetafield
              )
            : [];
          const canonicalLoadedAssignmentStr =
            parsedLoadedGids.length > 0 ? JSON.stringify(parsedLoadedGids) : "";
          const rawMetafieldObserved = canonicalLoadedAssignmentStr !== "";
          const currentReadBackStr = String(meta.currentVal ?? "").trim();

          const isDestinationSaveVerified = Boolean(
            history &&
            history.success === true &&
            history.readBackVerified === true &&
            canVerifySubmittedAgainstReadBack &&
            submittedStr !== "" &&
            submittedStr === canonicalSelectedStr &&
            rawMetafieldObserved &&
            canonicalLoadedAssignmentStr === submittedStr &&
            currentReadBackStr === submittedStr &&
            verifiedDestinations.includes(destKey) &&
            !blockedFields[destKey] &&
            !conflicts[destKey] &&
            !unresolvedChanges[destKey]
          );

          const isPriorSaveSupersededBySelection = Boolean(
            history &&
            history.success === true &&
            history.readBackVerified === true &&
            submittedStr !== "" &&
            submittedStr !== canonicalSelectedStr &&
            verifiedDestinations.includes(destKey)
          );

          const isAlreadyAssignedUnchanged = Boolean(
            rawMetafieldObserved && canonicalLoadedAssignmentStr === canonicalSelectedStr
          );

          const evalReasons = Array.isArray(stdEval?.labelEvaluations)
            ? stdEval.labelEvaluations.map(ev => sanitizeTelemetryText(ev?.reason || "")).filter(Boolean)
            : [];
          const resolutionBasis = evalReasons.length > 0 ? evalReasons.join("; ") : "Verified reference list validated";

          let lifecycleStateNote = "";
          if (isDestinationSaveVerified && !wasRematchedAfterRepair) {
            lifecycleStateNote = "State: Verified saved in Shopify (readBackVerified=true, destination confirmed)";
          } else if (isDestinationSaveVerified && wasRematchedAfterRepair) {
            lifecycleStateNote = `State: Historical save verified (${submittedStr}); reference matching re-run after save cleared fresh approval (Current Approval: ${meta.isApproved ? "Approved" : "Unapproved"})`;
          } else if (isPriorSaveSupersededBySelection) {
            lifecycleStateNote = `State: Historical save (${submittedStr}) superseded by changed selection ${canonicalSelectedStr} (Current Approval: ${meta.isApproved ? "Approved, not saved" : "Unapproved, not saved"})`;
          } else if (isAlreadyAssignedUnchanged) {
            lifecycleStateNote = "State: Already assigned; unchanged. No new repair verification recorded.";
          } else if (meta.isApproved) {
            lifecycleStateNote = "State: Exact GID list approved (not yet saved/verified)";
          } else {
            lifecycleStateNote = "State: Technically resolved proposal (awaiting exact-value approval; not saved)";
          }

          resolvedLookupDiagnosticNotes.push(
            `Historical Lookup Diagnostic [${destKey}]: Raw lookup status "${entryStatus}" technically resolved to ${canonicalSelectedStr} (${resolutionBasis}) | ${lifecycleStateNote}`
          );
        }
      });

      if (incompleteCandidateResolutions.length > 0 && refMatchStateSummary === "Completed") {
        hasUnresolvedReferenceMatching = true;
        refMatchStateSummary = `Incomplete (${incompleteCandidateResolutions.length} candidate resolution(s) incomplete)`;
      }
    }
  }

  let stats = {
    loaded: 0,
    blank: 0,
    proposed: 0,
    blocked: 0,
    protected: 0,
    conflicting: 0,
    updated: history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null ? history.fieldsUpdated : "Not recorded",
    errored: preservedBackendErrors.length > 0 ? preservedBackendErrors.length : (hasRepairAttempt ? (isFailedRepair ? "Unrecorded" : 0) : "Not recorded")
  };

  let approvedOrPreApprovedEligibleCount = 0;
  let approvedOrPreApprovedNonStdCount = 0;
  let unapprovedReviewRequiredCount = 0;
  let actualBlockedProposalCount = 0;

  const isGeologyField = (key) => {
    const normalized = key.replace(/^custom\./, "").replace(/-/g, "_").toLowerCase();
    const geoKeys = [
      "mohs_hardness", "specific_gravity", "crystal_system", "fracture_pattern",
      "cleavage", "luster", "diaphaneity", "mineral_class", "geological_age",
      "geological_era", "rock_formation", "rock_composition"
    ];
    return geoKeys.includes(normalized);
  };

  const isNarrativeBlock = (key) => {
    const normalized = key.replace(/^custom\./, "").replace(/-/g, "_").toLowerCase();
    return ["generated_description", "stone_story", "origin_story", "native_description", "native_descriptionhtml"].includes(normalized);
  };

  const isProtectedIntegration = (key) => {
    if (isVerifiedStandardizedDestination(key)) return false;
    return INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));
  };

  const truncateForTelemetry = (text, limit = 100) => {
    if (!text) return "";
    const str = sanitizeTelemetryText(String(text).replace(/\n/g, " "));
    if (str.length <= limit) return str;
    return `${str.substring(0, limit)}...`;
  };

  const isExplicitlyLooseOrUnmountedProduct = () => {
    const checkLoose = (v) => {
      if (v === undefined || v === null) return false;
      const s = String(v).trim().toLowerCase();
      return (
        s === "loose stone" ||
        s === "cabochon" ||
        s === "cabochon — setting ready" ||
        s === "cabochon - setting ready" ||
        s === "display specimen" ||
        s === "display piece" ||
        s === "collector specimen" ||
        s === "collector piece" ||
        s === "loose/unmounted"
      );
    };
    const primaryUseVal =
      data.repairPlan?.["custom.primary_use"] ??
      data.currentMetafields?.["custom.primary_use"] ??
      data.currentMetafields?.["primary_use"] ??
      product.productType ??
      "";
    const productFormatVal =
      data.repairPlan?.["custom.product_format"] ??
      data.currentMetafields?.["custom.product_format"] ??
      "";
    const settingReadyVal = String(
      data.repairPlan?.["custom.setting_ready"] ??
      data.currentMetafields?.["custom.setting_ready"] ??
      ""
    ).trim().toLowerCase();

    return (
      checkLoose(primaryUseVal) ||
      checkLoose(productFormatVal) ||
      settingReadyVal === "none" ||
      settingReadyVal === "no"
    );
  };

  const productIsLooseOrUnmounted = isExplicitlyLooseOrUnmountedProduct();

  const resolveCoverageRow = (key, meta, sectionConfigFields = []) => {
    const unprefixed = key.replace(/^custom\./, "");
    const cfg =
      (sectionConfigFields || []).find(f => resolveConfigFieldDestination(f) === key || f.key === key || f.key === unprefixed) ||
      allConfigFields.find(f => resolveConfigFieldDestination(f) === key || f.key === key || f.key === unprefixed) ||
      null;

    let displayLabel = meta.label || cfg?.label || key;
    if (key.startsWith("native_image_alts_")) {
      const mediaId = key.replace("native_image_alts_", "");
      displayLabel = `Native Image Alt (${mediaId.split("/").pop()})`;
    }

    if (HIDDEN_CONTEXT_FIELDS.includes(key)) {
      const hasSourceVal = meta.currentExists || meta.proposalExists;
      return {
        label: displayLabel,
        key,
        status: "Hidden Context",
        reason: hasSourceVal ? "Read-only source context (populated)" : "Read-only source context (not filled)"
      };
    }

    const rawCurr = String(meta.currentVal ?? "").trim();
    const rawProp = String(meta.propVal ?? "").trim();
    const isExplicitNaToken = (val) => /^(n\/a|none|not applicable)$/i.test(val);

    const catElig = meta.categoryEligibility;
    const isCatConfirmedIneligible = Boolean(
      (catElig && catElig.isComplete === true && catElig.isEligible === false) ||
      meta.stdEvaluation?.status === "category_ineligible"
    );

    const isConditionalHardwareField = cfg?.applicability === "optional_when_inapplicable";

    const hasExplicitNaEvidence =
      isCatConfirmedIneligible ||
      (meta.currentExists && isExplicitNaToken(rawCurr) && !meta.proposalExists) ||
      (meta.proposalExists && isExplicitNaToken(rawProp)) ||
      (!meta.currentExists && !meta.proposalExists && isConditionalHardwareField && productIsLooseOrUnmounted);

    if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") {
      if (hasExplicitNaEvidence) {
        let naRsn = "Inapplicable to current product form";
        if (isCatConfirmedIneligible) {
          naRsn = truncateForTelemetry(catElig?.reason || meta.stdEvaluation?.blockReason || "Ineligible for product category", 70);
        } else if (isConditionalHardwareField && productIsLooseOrUnmounted) {
          naRsn = "Conditional hardware/setting field (loose/unmounted form)";
        }
        return {
          label: displayLabel,
          key,
          status: "N/A",
          reason: naRsn
        };
      }

      const blankRsn =
        meta.fieldStatus === "Required missing"
          ? "Required field missing"
          : meta.isPendingReadOnly
            ? (meta.isVerifiedStdDest
                ? truncateForTelemetry(meta.stdEvaluation?.blockReason || "Standardized target awaiting reference match", 70)
                : "Read-only standardized target (not filled)")
            : "Not filled";

      return {
        label: displayLabel,
        key,
        status: meta.fieldStatus === "Required missing" ? "Required missing" : "Not filled",
        reason: blankRsn
      };
    }

    if (meta.currentExists && isExplicitNaToken(rawCurr) && (!meta.proposalExists || isExplicitNaToken(rawProp))) {
      return {
        label: displayLabel,
        key,
        status: "N/A",
        reason: `Explicitly set to ${rawCurr}`
      };
    }

    let primaryReason = "";
    if (Array.isArray(meta.reasons) && meta.reasons.length > 0) {
      primaryReason = truncateForTelemetry(meta.reasons[0], 70);
    } else if (meta.fieldStatus === "Unchanged") {
      primaryReason = "Populated in Shopify; unchanged";
    } else if (meta.preApprovalReason) {
      primaryReason = truncateForTelemetry(meta.preApprovalReason, 70);
    } else {
      primaryReason = `Source: ${meta.source || "Not reported"}`;
    }

    return {
      label: displayLabel,
      key,
      status: meta.fieldStatus,
      reason: primaryReason
    };
  };

  let reviewCandidates = [];
  const evaluatedEligibleKeys = new Set();

  dynamicSections.forEach(sec => {
    sec.keys.forEach(key => {
      const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
      const eligibleForStats = !meta.isPendingReadOnly && (!meta.isStandardizedAttribute || meta.isVerifiedStdDest);
      
      if (meta.currentExists) stats.loaded++;
      if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
      if (eligibleForStats && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked")) stats.proposed++;
      if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) stats.blocked++;
      if (PROTECTED_FIELDS.includes(key) || meta.isOperatorOwned) stats.protected++;
      if (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade" || meta.fieldStatus === "Save Conflict") stats.conflicting++;

      if (!HIDDEN_CONTEXT_FIELDS.includes(key)) {
        const hasGenuineDelta = meta.proposalExists && meta.currentVal !== meta.propVal;
        const isTechnicallyReadyToWrite =
          hasGenuineDelta &&
          !meta.isBlockedAction &&
          !meta.hasTechnicalBlock &&
          !meta.isPendingReadOnly &&
          !meta.isManualOnly &&
          meta.isSupported &&
          (!meta.isStandardizedAttribute || (meta.isVerifiedStdDest && meta.isCategoryEligible === true));

        const hasExplicitOrPolicyApproval = meta.isApproved === true || meta.isContentPreApproved === true;

        if (isTechnicallyReadyToWrite && hasExplicitOrPolicyApproval) {
          if (!evaluatedEligibleKeys.has(key)) {
            evaluatedEligibleKeys.add(key);
            approvedOrPreApprovedEligibleCount++;
            if (meta.isVerifiedStdDest) {
              approvedEligibleStandardizedKeys.push(key);
            } else {
              approvedOrPreApprovedNonStdCount++;
            }
          }
        } else if (hasGenuineDelta && meta.isVerifiedStdDest && !meta.isPendingReadOnly && !meta.hasTechnicalBlock && !meta.isApproved) {
          if (!unapprovedEligibleStandardizedKeys.includes(key)) {
            unapprovedEligibleStandardizedKeys.push(key);
          }
          unapprovedReviewRequiredCount++;
        } else if (hasGenuineDelta && !hasExplicitOrPolicyApproval && !meta.isPendingReadOnly && !meta.isManualOnly) {
          unapprovedReviewRequiredCount++;
        }

        if (meta.isActualBlockedProposal) {
          actualBlockedProposalCount++;
        }
      }

      const isGeo = isGeologyField(key);
      const isNarrative = isNarrativeBlock(key);
      const isProtectedInt = isProtectedIntegration(key);

      if (mode === "review") {
        let isUnapprovedProblem = false;
        let isOptionalConditional = false;
        
        if (!meta.isApproved && meta.proposalExists && meta.currentVal !== meta.propVal) isUnapprovedProblem = true;
        if (!meta.isApproved && meta.contentNeedsReview) isUnapprovedProblem = true;
        if (["Required missing", "Unverified proposal", "Conflict", "Degrade", "API Error / Blocked", "Save Conflict"].includes(meta.fieldStatus) || meta.fieldStatus.includes("Blocked")) {
          isUnapprovedProblem = true;
        }
        if (meta.fieldStatus === "Optional blank" || meta.proposalStatus === "Empty" || meta.fieldStatus === "Manual only") {
          isOptionalConditional = true;
        }

        const isRoutineMandatory = REQUIRED_FIELDS.includes(key) && (meta.isApproved || meta.currentVal === meta.propVal);

        if ((isUnapprovedProblem || isOptionalConditional) && !isRoutineMandatory) {
          reviewCandidates.push({
            key, meta, isGeo, isNarrative, isProtectedInt, priority: isUnapprovedProblem ? 1 : 2
          });
        }
      }
    });
  });

  const titleParseStatus = (diag.stage === "titleParse" || diag.stage === "tab3FullRescan" || diag.stage === "generateDescription" || diag.stage === "batchAuditItem") ? (diag.gemini || "Unknown") : "Not called";
  const visionStatus = diag.vision || "Not called";
  const geoStatus = diag.geoLibrary || "Not called";
  const descStatus = (data.repairPlan?.["custom.generated_description"] || data.currentMetafields?.["custom.generated_description"]) ? "Success" : (diag.stage === "generateDescription" ? (diag.gemini || "Unknown") : "Not called");

  const shopifyRead = statusObj.shopifyReadStatus;
  const readBack =
    history && history.success === false && diag.readBack === "Not called"
      ? "Not called (Write failed before read-back)"
      : history && history.readBackVerified !== undefined
        ? (history.readBackVerified ? "Success" : "Failed")
        : statusObj.readBackStatus;

  const pipelineBlock =
    `--- PIPELINE STATUS ---\n` +
    `[Shopify IO]\n` +
    `Read: ${shopifyRead}\n` +
    `Backend-reported updates: ${history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null ? history.fieldsUpdated : "Not recorded"}\n` +
    `Read-Back: ${readBack}\n\n` +
    `[AI Stages]\n` +
    `Title Parse: ${titleParseStatus}\n` +
    `Vision Scan: ${visionStatus}\n` +
    `Geo Library: ${geoStatus}\n` +
    `Story Gen: ${descStatus}\n\n` +
    `[Standardized Reference Matching]\n` +
    `Staged Candidates: ${hasStagedCandidates ? `${stagedCandidateKeys.length} (${stagedCandidateKeys.join(", ")})` : "None"}\n` +
    `Match State: ${refMatchStateSummary}\n` +
    `Approved Eligible Standardized Writes: ${approvedEligibleStandardizedKeys.length}\n` +
    `Unapproved Eligible Standardized Proposals: ${unapprovedEligibleStandardizedKeys.length}\n` +
    `Category-Ineligible Standardized Candidates: ${categoryIneligibleCandidates.length}`;

  const fieldSummaryBlock =
    `--- FIELD SUMMARY ---\n` +
    `Total Active Pool Targets: ${dynamicSections.reduce((acc, s) => acc + s.keys.length, 0)}\n` +
    `Loaded: ${stats.loaded}\n` +
    `Blank: ${stats.blank}\n` +
    `Proposed: ${stats.proposed}\n` +
    `Approved/Pre-Approved Eligible Writes: ${approvedOrPreApprovedEligibleCount}\n` +
    `Unapproved Proposals Requiring Review: ${unapprovedReviewRequiredCount}\n` +
    `Blocked: ${stats.blocked}\n` +
    `Protected: ${stats.protected}\n` +
    `Conflicting: ${stats.conflicting}\n` +
    `Updated: ${stats.updated}\n` +
    `Errored: ${stats.errored}`;

  let historyBlock = "";
  if (history) {
    const genericHistoryMessage = sanitizeTelemetryText(history.rawMessage ?? history.message ?? "Not recorded") || "Not recorded";
    const specificHistoryErrorCount = preservedBackendErrors.length;
    historyBlock =
      `--- LAST REPAIR HISTORY ---\n` +
      `Time: ${history.completedAt}\n` +
      `Status: ${history.status}\n` +
      `Generic Summary Message: ${genericHistoryMessage}\n` +
      `Specific Backend Errors Recorded: ${specificHistoryErrorCount}\n` +
      `Blocked: ${Object.keys(blockedFields).length}\n` +
      `Conflicts: ${Object.keys(conflicts).length}\n` +
      `Variant Target: ${history.variantTarget || "Not recorded"}`;
  } else {
    historyBlock = `--- LAST REPAIR HISTORY ---\nNot recorded`;
  }

  let detailExcludedCount = 0;
  let omissionsCount = 0;
  let unchangedCount = 0;
  let optionalBlankCount = 0;
  let verifiedMatchesCount = 0;

  let failures = [];

  if (preservedBackendErrors.length > 0) {
    preservedBackendErrors.forEach((errText, idx) => {
      failures.push(`Backend Repair Error [${idx + 1}]: ${errText}`);
    });
  } else if (
    isFailedRepair ||
    (diag.error && diag.stage === "executeRepairPlan")
  ) {
    const fallbackDiagError = sanitizeTelemetryText(diag.error);
    const genericMsg = sanitizeTelemetryText(history?.rawMessage ?? history?.message ?? "");
    if (fallbackDiagError && fallbackDiagError !== genericMsg) {
      failures.push(`Backend Repair Error [1]: ${fallbackDiagError}`);
    } else {
      failures.push("Detailed backend errors were not recorded.");
    }
  }

  if (hasStagedCandidates && hasUnresolvedReferenceMatching) {
    failures.push(`Standardized Reference Matching Unresolved: ${refMatchStateSummary}`);
  }
  refMatchReadErrors.forEach((readErr, idx) => {
    failures.push(`Reference Matching Read Error [${idx + 1}]: ${readErr}`);
  });
  incompleteCandidateResolutions.forEach((incMsg) => {
    failures.push(`Incomplete Candidate Resolution: ${incMsg}`);
  });
  entryBlockedCandidateResolutions.forEach((blkMsg) => {
    failures.push(`Blocked Candidate Resolution: ${blkMsg}`);
  });

  categoryIneligibleCandidates.forEach((catMsg) => {
    failures.push(`Category-Ineligible Standardized Candidate (Not a Read Error): ${catMsg}`);
  });

  if (unsupportedKeys.length > 0) failures.push(`Unsupported Keys: ${unsupportedKeys.join(", ")}`);

  Object.keys(blockedFields).forEach(k => failures.push(`Blocked [${k}]: ${sanitizeTelemetryText(blockedFields[k])}`));
  Object.keys(conflicts).forEach(k => {
    const expected = typeof conflicts[k] === "object" ? conflicts[k].expected : "unknown";
    const actual = typeof conflicts[k] === "object" ? conflicts[k].actual : conflicts[k];
    if (isNarrativeBlock(k)) {
      const metaForConflict = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
      const expLen = String(expected || "").length;
      const actLen = String(actual || "").length;
      failures.push(`Conflict [${k}]: Status: ${metaForConflict.fieldStatus} | Approved: ${String(metaForConflict.isApproved)} | Expected (${expLen} chars) -> Actual (${actLen} chars)`);
    } else {
      failures.push(`Conflict [${k}]: Expected [${truncateForTelemetry(expected, 60)}] -> Actual [${truncateForTelemetry(actual, 60)}]`);
    }
  });
  Object.keys(unresolvedChanges).forEach(k => {
    if (isNarrativeBlock(k)) {
      const metaForUnresolved = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
      const valLen = String(unresolvedChanges[k] || "").length;
      failures.push(`Unresolved [${k}]: Status: ${metaForUnresolved.fieldStatus} | Approved: ${String(metaForUnresolved.isApproved)} | Chars: ${valLen}`);
    } else {
      const rawUnres = unresolvedChanges[k];
      const formattedUnres = typeof rawUnres === "object" && rawUnres !== null
        ? sanitizeTelemetryText(rawUnres.reason || JSON.stringify(rawUnres))
        : truncateForTelemetry(rawUnres, 60);
      failures.push(`Unresolved [${k}]: ${formattedUnres}`);
    }
  });

  const executionMismatchLines = [];
  if (lastSubmitted) {
    Object.keys(lastSubmitted).forEach(submitKey => {
      const meta = getFieldMetadata(submitKey, data, selectedBenchId, approvals, allConfigFields);
      const intendedVal = String(lastSubmitted[submitKey] ?? "");
      const returnVal = String(meta.currentVal ?? "");

      const isGeo = isGeologyField(submitKey);
      const isNarrative = isNarrativeBlock(submitKey);
      const isProtectedInt = isProtectedIntegration(submitKey);

      const isNativeFieldUnverified =
        ((submitKey === "shopify_title" || submitKey === "native_title") && unverifiedNativeFields.includes("productTitle")) ||
        (submitKey === "native_description" && unverifiedNativeFields.includes("descriptionHtml")) ||
        (submitKey === "native_seo_title" && unverifiedNativeFields.includes("seo")) ||
        (submitKey.startsWith("native_image_alts_") && unverifiedNativeFields.includes("media"));

      if (!canVerifySubmittedAgainstReadBack || isNativeFieldUnverified) {
        const msg = `Execution Mismatch [${submitKey}]: Not verified (independent read-back unavailable; cached values are not treated as read-back)`;
        failures.push(msg);
        executionMismatchLines.push(msg);
      } else if (returnVal === intendedVal && returnVal !== "") {
        verifiedMatchesCount++;
      } else if (returnVal !== intendedVal && returnVal !== "") {
        if (isNarrative) {
          const msg = `Execution Mismatch [${submitKey}]: Status: ${meta.fieldStatus} | Approved: ${String(meta.isApproved)} | Intended (${intendedVal.length} chars) != Returned (${returnVal.length} chars)`;
          failures.push(msg);
          executionMismatchLines.push(msg);
          detailExcludedCount++;
        } else if (isGeo || isProtectedInt) {
          const msg = `Execution Mismatch [${submitKey}]: [Detail Excluded]`;
          failures.push(msg);
          executionMismatchLines.push(msg);
          detailExcludedCount++;
        } else {
          const msg = `Execution Mismatch [${submitKey}]:\n  Intended: [${truncateForTelemetry(intendedVal, 100)}]\n  Returned: [${truncateForTelemetry(returnVal, 100)}]\n  Outcome: Returned mismatch`;
          failures.push(msg);
          executionMismatchLines.push(msg);
        }
      } else if (returnVal === "") {
        const msg = `Execution Mismatch [${submitKey}]: Not verified (verification unavailable)`;
        failures.push(msg);
        executionMismatchLines.push(msg);
      }
    });
  }

  const reviewKeys = new Set(reviewCandidates.map(c => c.key));
  reviewCandidates.forEach(c => {
    const { key, meta, isGeo, isNarrative, isProtectedInt } = c;
    if (key === "custom.origin_story") {
      failures.push(`- ${key}: [Hidden Context] Status: ${meta.fieldStatus}`);
      detailExcludedCount++;
    } else if (isNarrative) {
      failures.push(`- ${key}: Status: ${meta.fieldStatus} | Approved: ${String(meta.isApproved)} | Chars: Current(${meta.currentVal.length}) / Proposed(${meta.propVal.length}) | Rsn: ${meta.reasons[0] || "None"}`);
      detailExcludedCount++;
    } else if (isGeo || isProtectedInt) {
      failures.push(`- ${key}: [Detail Excluded] Status: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"}`);
      detailExcludedCount++;
    } else {
      failures.push(`- ${key}: Stat: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"} | Curr: [${truncateForTelemetry(meta.currentVal, 60)}] | Prop: [${truncateForTelemetry(meta.propVal, 60)}]`);
    }
  });

  const otherOmissionItems = [];
  const coverageLines = [];

  dynamicSections.forEach(sec => {
    sec.keys.forEach(key => {
      const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
      const cov = resolveCoverageRow(key, meta, sec.configFields);
      let enteredOtherOmissions = false;

      if (!reviewKeys.has(key) && !blockedFields[key] && !conflicts[key] && !unresolvedChanges[key] && !unsupportedKeys.includes(key)) {
        if (meta.fieldStatus === "Unchanged" && meta.currentVal !== "") {
          unchangedCount++;
        } else if (meta.fieldStatus === "Optional blank") {
          optionalBlankCount++;
        } else {
          omissionsCount++;
          enteredOtherOmissions = true;
          otherOmissionItems.push(`${cov.key} (${cov.status})`);
        }
      }

      const omitTag = enteredOtherOmissions ? " [Other Omission]" : "";
      coverageLines.push(`${cov.label} | ${cov.key} | ${cov.status}${omitTag} | ${cov.reason}`);
    });
  });

  const summaryStatsBlock =
    `[SUMMARY STATS]\n` +
    (lastSubmitted ? `Verified Matches (Submitted vs Read-Back): ${verifiedMatchesCount} fields\n` : "") +
    `Unchanged Comparisons: ${unchangedCount} fields intact\n` +
    `Optional Blanks: ${optionalBlankCount} fields\n` +
    `Other Omissions: ${omissionsCount} fields${otherOmissionItems.length > 0 ? ` [${otherOmissionItems.join(", ")}]` : ""}\n` +
    `Detail Excluded (Geo/Narrative/Protected): ${detailExcludedCount} fields`;

  const hasMissingRequiredField =
    failures.some(f => f.includes("Required missing")) ||
    dynamicSections.some(sec =>
      sec.keys.some(k => getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields).fieldStatus === "Required missing")
    );

  const recommendations = [];
  if (preservedBackendErrors.length > 0 || isFailedRepair) {
    recommendations.push("1. DO NOT RETRY WRITE BLINDLY. Inspect the Backend Repair Error(s) above and perform an independent product read-back first.");
  } else if (Object.keys(blockedFields).length > 0 || hasMissingRequiredField) {
    recommendations.push("1. DO NOT WRITE. Review and manually resolve backend-blocked or required missing fields.");
  } else if (lastSubmitted && executionMismatchLines.length > 0) {
    recommendations.push("1. WARNING: Submitted change(s) remain unresolved or unverified after execution. Review the execution mismatch block.");
  } else if (!lastSubmitted && history && stats.proposed > 0) {
    recommendations.push("1. Exact execution payload unavailable. Some fields appear proposed post-save, but cannot be proven as failed writes. Review manually.");
  } else if (!history) {
    if (hasStagedCandidates && hasUnresolvedReferenceMatching) {
      const nonStdReadyNote = approvedOrPreApprovedNonStdCount > 0
        ? ` Note: ${approvedOrPreApprovedNonStdCount} non-standardized field(s) are approved/pre-approved and technically eligible, but standardized candidate proposals remain excluded until reference matching completes.`
        : " No approved standardized writes can be included until reference matching succeeds.";
      recommendations.push(`1. DO NOT ASSUME FULL PRODUCT READINESS: Standardized reference matching is unresolved (${refMatchStateSummary}). Click 'Match Reference Choices' and resolve read/enumeration issues before expecting standardized attribute writes.${nonStdReadyNote}`);
    } else if (approvedOrPreApprovedEligibleCount > 0) {
      const pendingNotes = [];
      if (unapprovedEligibleStandardizedKeys.length > 0) {
        pendingNotes.push(`${unapprovedEligibleStandardizedKeys.length} category-eligible standardized proposal(s) (${unapprovedEligibleStandardizedKeys.join(", ")}) are not yet approved and will be excluded unless checked`);
      }
      if (categoryIneligibleCandidates.length > 0) {
        pendingNotes.push(`${categoryIneligibleCandidates.length} category-ineligible standardized candidate(s) remain blocked by product category constraint`);
      }
      if (entryBlockedCandidateResolutions.length > 0) {
        pendingNotes.push(`${entryBlockedCandidateResolutions.length} standardized candidate(s) remain blocked by missing/ambiguous entry resolution`);
      }
      const unapprovedNonStdCount = Math.max(0, unapprovedReviewRequiredCount - unapprovedEligibleStandardizedKeys.length);
      if (unapprovedNonStdCount > 0) {
        pendingNotes.push(`${unapprovedNonStdCount} other proposed change(s) still require explicit operator approval and will be excluded`);
      }

      if (pendingNotes.length > 0) {
        recommendations.push(`1. PARTIAL WRITE READINESS: ${approvedOrPreApprovedEligibleCount} approved/pre-approved field delta(s) are technically eligible for 'Execute Single Repair'. However, ${pendingNotes.join("; ")}. Review remaining items if you intend to include them.`);
      } else {
        recommendations.push(`1. Content review complete: ${approvedOrPreApprovedEligibleCount} approved/pre-approved field delta(s) are technically eligible. Proceed with 'Execute Single Repair'.`);
      }
    } else if (stats.proposed > 0 || unapprovedReviewRequiredCount > 0 || actualBlockedProposalCount > 0 || hasStagedCandidates) {
      const holdReasons = [];
      if (unapprovedEligibleStandardizedKeys.length > 0) {
        holdReasons.push(`approve exact GID list(s) for ${unapprovedEligibleStandardizedKeys.join(", ")}`);
      }
      const unapprovedNonStdCount = Math.max(0, unapprovedReviewRequiredCount - unapprovedEligibleStandardizedKeys.length);
      if (unapprovedNonStdCount > 0) {
        holdReasons.push(`approve ${unapprovedNonStdCount} pending field proposal(s) requiring review`);
      }
      if (categoryIneligibleCandidates.length > 0) {
        holdReasons.push(`${categoryIneligibleCandidates.length} standardized candidate(s) are blocked by product category constraints`);
      }
      if (entryBlockedCandidateResolutions.length > 0) {
        holdReasons.push(`${entryBlockedCandidateResolutions.length} standardized candidate(s) have missing/ambiguous reference entries`);
      }
      const suffix = holdReasons.length > 0 ? ` (${holdReasons.join("; ")})` : "";
      recommendations.push(`1. DO NOT EXECUTE REPAIR YET: Zero approved or policy-pre-approved eligible field deltas are ready to write${suffix}. Review and approve eligible proposals first.`);
    } else {
      recommendations.push("1. Load data or run AI Auto-Fill to stage proposals.");
    }
  } else if (history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null) {
    recommendations.push("1. Backend request successful. Check live Shopify admin to confirm field updates.");
  } else {
    recommendations.push("1. Load data or generate a repair plan to begin.");
  }

  const recommendationsBlock = `--- RECOMMENDATIONS ---\n${recommendations.join("\n")}`;

  // ========================================================================
  // SECTION BUILDERS (All derived from the same captured product/run state)
  // ========================================================================

  // 1. SUMMARY (Counts, pipeline, next action; no product text)
  const buildSummarySectionText = () => {
    return [
      pipelineBlock,
      fieldSummaryBlock,
      historyBlock,
      summaryStatsBlock,
      recommendationsBlock
    ].join("\n\n");
  };

  // 2. FIELD COVERAGE (Retained field names, destinations, statuses, reasons; no product values)
  const buildCoverageSectionText = () => {
    return [
      `--- FIELD COVERAGE (${coverageLines.length} Active Pool Targets) ---\nFormat: Label | Key | Status | Reason\n${coverageLines.join("\n")}`,
      summaryStatsBlock
    ].join("\n\n");
  };

  // 3. STANDARDIZED FIELDS (Candidates, matches, approvals, category blocks & reasons)
  const buildStandardizedSectionText = () => {
    const stdLines = [];
    const prodCat = refMatchResult?.productCategory || data?.productCategory || null;
    const prodCatLabel = prodCat ? (prodCat.fullName ? prodCat.fullName : (prodCat.name ? prodCat.name : "Assigned")) : "";
    const prodCatId = prodCat ? (prodCat.id ? prodCat.id : "GID not reported") : "";
    stdLines.push(`Product Taxonomy Category: ${prodCat ? `${sanitizeTelemetryText(prodCatLabel)} (${sanitizeTelemetryText(prodCatId)})` : "Not reported"}`);
    stdLines.push(`Reference Matching State: ${refMatchStateSummary}`);
    stdLines.push(`Staged Vision Candidates (${stagedCandidateKeys.length}): ${stagedCandidateKeys.length > 0 ? stagedCandidateKeys.join(", ") : "None"}`);

    if (stagedCandidateKeys.length > 0) {
      stdLines.push(`\n[STAGED CANDIDATE EVIDENCE]`);
      stagedCandidateKeys.forEach(mk => {
        const entry = candidateBundle.ordered[mk];
        const labelsStr = Array.isArray(entry?.labels) ? entry.labels.map(sanitizeTelemetryText).join(", ") : "";
        const evStr = sanitizeTelemetryText(entry?.evidence || "");
        stdLines.push(`- shopify.${mk}: Labels=[${labelsStr}] | Evidence="${evStr}"`);
      });
    }

    if (refMatchReadErrors.length > 0) {
      stdLines.push(`\n[REFERENCE MATCHING READ ERRORS]\n${refMatchReadErrors.join("\n")}`);
    }
    if (incompleteCandidateResolutions.length > 0) {
      stdLines.push(`\n[INCOMPLETE CANDIDATE RESOLUTIONS]\n${incompleteCandidateResolutions.join("\n")}`);
    }
    if (entryBlockedCandidateResolutions.length > 0) {
      stdLines.push(`\n[ENTRY-BLOCKED CANDIDATE RESOLUTIONS]\n${entryBlockedCandidateResolutions.join("\n")}`);
    }
    if (categoryIneligibleCandidates.length > 0) {
      stdLines.push(`\n[CATEGORY-INELIGIBLE CANDIDATES]\n${categoryIneligibleCandidates.join("\n")}`);
    }
    if (resolvedLookupDiagnosticNotes.length > 0) {
      stdLines.push(`\n[PRESERVED LOOKUP DIAGNOSTICS]\n${resolvedLookupDiagnosticNotes.join("\n")}`);
    }

    const stdSection = dynamicSections.find(s => s.title === "Standardized Attributes" || s.keys.some(k => k.startsWith("shopify.")));
    if (stdSection) {
      stdLines.push(`\n[STANDARDIZED DESTINATION ROWS (${stdSection.keys.length})]`);
      stdSection.keys.forEach(k => {
        const m = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
        const modeTag = m.isVerifiedStdDest ? "Verified-6" : "Read-Only-15";
        const catTag = m.categoryEligibility
          ? (m.categoryEligibility.isComplete ? (m.categoryEligibility.isEligible ? "Cat:Eligible" : "Cat:Ineligible") : "Cat:Incomplete")
          : "Cat:Unchecked";
        const appTag = m.isApproved ? "Approved:Yes" : "Approved:No";
        const rsn = m.reasons?.[0] ? sanitizeTelemetryText(m.reasons[0]) : "None";
        stdLines.push(
          `- ${m.label} (${k}) [${modeTag} | ${catTag} | Status: ${m.fieldStatus} | ${appTag}]\n` +
          `  Current GIDs: ${sanitizeTelemetryText(m.currentVal) || "Blank"}\n` +
          `  Proposed GIDs: ${sanitizeTelemetryText(m.propVal) || "None"}\n` +
          `  Reason/Note: ${rsn}`
        );
      });
    }

    return `--- STANDARDIZED FIELDS REPORT ---\n${stdLines.join("\n")}`;
  };

  // 4. ORIGIN & COLLECTION (Source pages, handles, links, and full origin text)
  const buildOriginCollectionSectionText = () => {
    const originKeys = [
      "custom.origin_location",
      "custom.origin_page_handle",
      "custom.collection_name",
      "custom.collection_location",
      "custom.found_object",
      "custom.collection_date"
    ];

    const lines = [];
    lines.push(`[ORIGIN & COLLECTION METADATA]`);
    originKeys.forEach(k => {
      const m = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
      const appStr = m.isApproved ? "Yes" : (m.isContentPreApproved ? `Pre-approved (${m.preApprovalReason})` : "No");
      lines.push(
        `- ${m.label} (${k}): Status=${m.fieldStatus} | Source=${m.source} | Stage=${m.stage} | Approved=${appStr}\n` +
        `  Current: ${sanitizeTelemetryText(m.currentVal) || "Blank"}\n` +
        `  Proposed: ${sanitizeTelemetryText(m.propVal) || "Not provided"}`
      );
    });

    const resolvedOriginHandle =
      sanitizeTelemetryText(
        data.repairPlan?.["custom.origin_page_handle"] ??
        data.currentMetafields?.["custom.origin_page_handle"] ??
        data.currentMetafields?.["custom.origin_handle"] ??
        ""
      );
    const resolvedCollectionName =
      sanitizeTelemetryText(
        data.repairPlan?.["custom.collection_name"] ??
        data.currentMetafields?.["custom.collection_name"] ??
        ""
      );

    lines.push(`\n[RESOLVED LINKS & HANDLES]`);
    lines.push(`Origin Page Handle: ${resolvedOriginHandle || "None"}`);
    lines.push(`Origin Page Path: ${resolvedOriginHandle ? `/pages/${resolvedOriginHandle}` : "None"}`);
    lines.push(`Collection Name: ${resolvedCollectionName || "None"}`);

    const currentOriginStory = sanitizeMultilineContentLossless(
      data.currentMetafields?.["custom.origin_story"] ??
      data.canonicalFields?.["custom.origin_story"] ??
      ""
    );
    const proposedOriginStory = sanitizeMultilineContentLossless(
      data.repairPlan?.["custom.origin_story"] ?? ""
    );

    lines.push(`\n[ORIGIN STORY SOURCE CONTEXT (custom.origin_story — Hidden Read-Only Context)]`);
    lines.push(`Stored Origin Story Length: ${currentOriginStory.length} chars`);
    lines.push(`Stored Origin Story Text:\n${currentOriginStory || "[Blank / Not present on product]"}`);
    if (proposedOriginStory && proposedOriginStory !== currentOriginStory) {
      lines.push(`\nStaged Origin Story Context (${proposedOriginStory.length} chars):\n${proposedOriginStory}`);
    }

    return `--- ORIGIN & COLLECTION REPORT ---\n${lines.join("\n")}`;
  };

  // 5. DESCRIPTION (Current/proposed text, SEO hook, approval, save & read-back evidence)
  const buildDescriptionSectionText = () => {
    const nativeDescMeta = getFieldMetadata("native_description", data, selectedBenchId, approvals, allConfigFields);
    const customDescMeta = getFieldMetadata("custom.generated_description", data, selectedBenchId, approvals, allConfigFields);
    const seoTitleMeta = getFieldMetadata("native_seo_title", data, selectedBenchId, approvals, allConfigFields);
    const seoDescMeta = getFieldMetadata("native_seo_description", data, selectedBenchId, approvals, allConfigFields);

    const currNativeDesc = sanitizeMultilineContentLossless(nativeDescMeta.currentVal);
    const currCustomDesc = sanitizeMultilineContentLossless(customDescMeta.currentVal);
    const propDesc = sanitizeMultilineContentLossless(nativeDescMeta.propVal || customDescMeta.propVal);

    const lines = [];
    lines.push(`[DESCRIPTION STATUS & APPROVAL]`);
    lines.push(`Native Description Status: ${nativeDescMeta.fieldStatus} | Source: ${nativeDescMeta.source} | Stage: ${nativeDescMeta.stage}`);
    lines.push(`Custom Metafield (custom.generated_description) Status: ${customDescMeta.fieldStatus}`);
    lines.push(`Explicitly Approved: ${nativeDescMeta.isApproved || customDescMeta.isApproved ? "Yes" : "No"}`);
    lines.push(`Technical Block: ${nativeDescMeta.hasTechnicalBlock ? `Yes (${nativeDescMeta.reasons.join(", ")})` : "No"}`);
    lines.push(`Character Counts: NativeCurrent=${currNativeDesc.length} | MetafieldCurrent=${currCustomDesc.length} | Proposed=${propDesc.length}`);

    if (nativeDescMeta.nativeDescConflictData) {
      lines.push(
        `Read-Back Conflict (native_description): Expected ${String(nativeDescMeta.nativeDescConflictData.expected || "").length} chars != Actual ${String(nativeDescMeta.nativeDescConflictData.actual || "").length} chars`
      );
    }
    if (nativeDescMeta.conflictData || customDescMeta.conflictData) {
      const cd = nativeDescMeta.conflictData || customDescMeta.conflictData;
      lines.push(
        `Read-Back Conflict (custom.generated_description): Expected ${String(cd.expected || "").length} chars != Actual ${String(cd.actual || "").length} chars`
      );
    }

    lines.push(`\n[SEO TITLE & META DESCRIPTION (POETIC HOOK)]`);
    lines.push(`SEO Title Status: ${seoTitleMeta.fieldStatus} | Approved/Pre-Approved: ${seoTitleMeta.isApproved || seoTitleMeta.isContentPreApproved ? "Yes" : "No"}`);
    lines.push(`SEO Title Current: ${sanitizeTelemetryText(seoTitleMeta.currentVal) || "Blank"}`);
    lines.push(`SEO Title Proposed: ${sanitizeTelemetryText(seoTitleMeta.propVal) || "Not provided"}`);
    lines.push(`SEO Description Status: ${seoDescMeta.fieldStatus} | Approved: ${seoDescMeta.isApproved ? "Yes" : "No"}`);
    lines.push(`SEO Description Current: ${sanitizeMultilineContentLossless(seoDescMeta.currentVal) || "Blank"}`);
    lines.push(`SEO Description Proposed: ${sanitizeMultilineContentLossless(seoDescMeta.propVal) || "Not provided"}`);

    lines.push(`\n[CURRENT NATIVE DESCRIPTION (descriptionHtml — ${currNativeDesc.length} chars)]\n${currNativeDesc || "[Blank]"}`);
    if (currCustomDesc && currCustomDesc !== currNativeDesc) {
      lines.push(`\n[CURRENT CUSTOM.GENERATED_DESCRIPTION METAFIELD (${currCustomDesc.length} chars)]\n${currCustomDesc}`);
    }
    lines.push(`\n[PROPOSED DESCRIPTION (${propDesc.length} chars)]\n${propDesc || "[Not provided]"}`);

    return `--- DESCRIPTION REPORT ---\n${lines.join("\n")}`;
  };

  // 6. PHOTOS & ALT TEXT (Photo IDs, current/proposed alts, validation errors & save results)
  const buildPhotosAltSectionText = () => {
    const mediaEdges = validArray(data.nativeTargets?.media?.edges);
    const mediaComplete = data.nativeTargets?.isComplete === true;
    const mediaLoadError = sanitizeTelemetryText(data.nativeTargets?.loadError || "");
    const altValErrors = validArray(diag.altValidationErrors);

    const lines = [];
    lines.push(`Media Targets Complete: ${String(mediaComplete)}${mediaLoadError ? ` | Load Error: ${mediaLoadError}` : ""}`);
    lines.push(`Loaded Product Media Count: ${mediaEdges.length}`);

    if (altValErrors.length > 0) {
      lines.push(`\n[VISION ALT VALIDATION ERRORS (${altValErrors.length})]\n${altValErrors.map(e => `- ${sanitizeTelemetryText(e)}`).join("\n")}`);
    }

    const legacyAltMeta = getFieldMetadata("custom.alt_text", data, selectedBenchId, approvals, allConfigFields);
    if (legacyAltMeta.currentExists || legacyAltMeta.proposalExists) {
      lines.push(
        `\n[LEGACY CUSTOM.ALT_TEXT METAFIELD]\n` +
        `Status: ${legacyAltMeta.fieldStatus} | Current: "${sanitizeTelemetryText(legacyAltMeta.currentVal) || "Blank"}" | Proposed: "${sanitizeTelemetryText(legacyAltMeta.propVal) || "None"}"`
      );
    }

    lines.push(`\n[PER-PHOTO NATIVE IMAGE ALT TARGETS (${mediaEdges.length})]`);
    if (mediaEdges.length === 0) {
      lines.push("No media edges loaded on nativeTargets.");
    } else {
      mediaEdges.forEach((edge, idx) => {
        const node = edge?.node || {};
        const imageId = node.id || `Unknown_${idx}`;
        const key = `native_image_alts_${imageId}`;
        const m = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
        const submittedAlt = lastSubmitted && Object.prototype.hasOwnProperty.call(lastSubmitted, key)
          ? String(lastSubmitted[key] ?? "")
          : null;
        lines.push(
          `${idx + 1}. Image ID: ${sanitizeTelemetryText(imageId)}\n` +
          `   Status: ${m.fieldStatus} | Source: ${m.source} | Stage: ${m.stage} | Approved/Pre-Approved: ${m.isApproved || m.isContentPreApproved ? "Yes" : "No"}\n` +
          `   Current Alt (${m.currentVal.length} chars): ${sanitizeMultilineContentLossless(m.currentVal) || "[Blank]"}\n` +
          `   Proposed Alt (${m.propVal.length} chars): ${sanitizeMultilineContentLossless(m.propVal) || "[Not provided]"}\n` +
          (submittedAlt !== null ? `   Last Submitted Alt: ${sanitizeMultilineContentLossless(submittedAlt)}\n` : "") +
          (m.reasons?.length > 0 ? `   Reasons: ${m.reasons.map(sanitizeTelemetryText).join(", ")}` : "")
        );
      });
    }

    return `--- PHOTOS & ALT TEXT REPORT ---\n${lines.join("\n")}`;
  };

  // 7. SAVE RESULTS (Attempts, changes, failures, blocks, conflicts & read-back evidence)
  const buildSaveResultsSectionText = () => {
    const lines = [];
    lines.push(historyBlock);

    if (preservedBackendErrors.length > 0) {
      lines.push(`\n[PRESERVED BACKEND ERRORS (${preservedBackendErrors.length})]\n${preservedBackendErrors.map((e, i) => `${i + 1}.${e}`).join("\n")}`);
    }

    const attemptedList = validArray(history?.attemptedDestinations);
    lines.push(`\n[ATTEMPTED & VERIFIED DESTINATIONS]`);
    lines.push(`Attempted (${attemptedList.length}): ${attemptedList.length > 0 ? attemptedList.join(", ") : "Not recorded"}`);
    lines.push(`Verified (${verifiedDestinations.length}): ${verifiedDestinations.length > 0 ? verifiedDestinations.join(", ") : "None"}`);
    lines.push(`Read-Back Verified Flag: ${history?.readBackVerified !== undefined ? String(history.readBackVerified) : "Not recorded"}`);

    if (Object.keys(blockedFields).length > 0) {
      lines.push(`\n[BACKEND BLOCKED FIELDS (${Object.keys(blockedFields).length})]`);
      Object.entries(blockedFields).forEach(([k, v]) => {
        lines.push(`- ${k}: ${sanitizeTelemetryText(v)}`);
      });
    }

    if (Object.keys(conflicts).length > 0) {
      lines.push(`\n[READ-BACK / ALIAS CONFLICTS (${Object.keys(conflicts).length})]`);
      Object.entries(conflicts).forEach(([k, v]) => {
        const exp = typeof v === "object" ? v?.expected : "unknown";
        const act = typeof v === "object" ? v?.actual : v;
        if (isNarrativeBlock(k)) {
          lines.push(`- ${k}: Expected (${String(exp || "").length} chars) != Actual (${String(act || "").length} chars)`);
        } else {
          lines.push(`- ${k}: Expected [${sanitizeTelemetryText(exp)}] != Actual [${sanitizeTelemetryText(act)}]`);
        }
      });
    }

    if (Object.keys(unresolvedChanges).length > 0) {
      lines.push(`\n[UNRESOLVED CHANGES (${Object.keys(unresolvedChanges).length})]`);
      Object.entries(unresolvedChanges).forEach(([k, v]) => {
        const detail = typeof v === "object" && v !== null ? sanitizeTelemetryText(v.reason || JSON.stringify(v)) : sanitizeTelemetryText(v);
        lines.push(`- ${k}: ${detail}`);
      });
    }

    if (unsupportedKeys.length > 0) {
      lines.push(`\n[UNSUPPORTED KEYS (${unsupportedKeys.length})]\n${unsupportedKeys.join(", ")}`);
    }

    if (lastSubmitted && Object.keys(lastSubmitted).length > 0) {
      lines.push(`\n[LAST SUBMITTED PAYLOAD VS READ-BACK (${Object.keys(lastSubmitted).length} keys)]`);
      Object.entries(lastSubmitted).forEach(([subKey, subVal]) => {
        const m = getFieldMetadata(subKey, data, selectedBenchId, approvals, allConfigFields);
        const intended = String(subVal ?? "");
        const actual = String(m.currentVal ?? "");
        const matched = canVerifySubmittedAgainstReadBack && intended !== "" && intended === actual;
        if (isNarrativeBlock(subKey)) {
          lines.push(`- ${subKey}: ${matched ? "VERIFIED MATCH" : "UNVERIFIED / MISMATCH"} | Intended=${intended.length} chars | CurrentRead=${actual.length} chars`);
        } else {
          lines.push(`- ${subKey}: ${matched ? "VERIFIED MATCH" : "UNVERIFIED / MISMATCH"} | Intended=[${sanitizeTelemetryText(intended)}] | CurrentRead=[${sanitizeTelemetryText(actual)}]`);
        }
      });
    } else {
      lines.push(`\n[LAST SUBMITTED PAYLOAD]\nNo submitted payload recorded in this session.`);
    }

    return `--- SAVE RESULTS & VERIFICATION REPORT ---\n${lines.join("\n")}`;
  };

  // 8. SCOPED DRAWER REPORT (For any existing section drawer)
  const buildDrawerSectionText = (targetTitle) => {
    const cleanTarget = String(targetTitle || "").trim();
    if (!cleanTarget || cleanTarget === "Description Review") {
      return buildDescriptionSectionText();
    }
    if (cleanTarget === "Origin and collection" || cleanTarget === "3. Origin, Story, and Collection") {
      return buildOriginCollectionSectionText();
    }
    if (cleanTarget === "Standardized Attributes") {
      return buildStandardizedSectionText();
    }

    const matchedSec = dynamicSections.find(s => s.title.toLowerCase() === cleanTarget.toLowerCase());
    if (!matchedSec) {
      return `--- DRAWER REPORT: ${sanitizeTelemetryText(cleanTarget)} ---\nSection not found in active dynamic sections.`;
    }

    const lines = [];
    matchedSec.keys.forEach(k => {
      if (HIDDEN_CONTEXT_FIELDS.includes(k)) {
        lines.push(`- ${k}: [Hidden Context Field]`);
        return;
      }
      const m = getFieldMetadata(k, data, selectedBenchId, approvals, matchedSec.configFields);
      const cov = resolveCoverageRow(k, m, matchedSec.configFields);
      const appState = m.isApproved ? "Approved" : (m.isContentPreApproved ? `Pre-approved (${m.preApprovalReason})` : "Unapproved");
      lines.push(
        `- ${cov.label} (${k})\n` +
        `  Status: ${cov.status} | Source: ${m.source} | Stage: ${m.stage} | Approval: ${appState}\n` +
        `  Current: ${sanitizeMultilineContentLossless(m.currentVal) || "[Blank]"}\n` +
        `  Proposed: ${sanitizeMultilineContentLossless(m.propVal) || "[Not provided]"}\n` +
        `  Reason: ${cov.reason}`
      );
    });

    return `--- DRAWER REPORT: ${matchedSec.title} (${matchedSec.keys.length} fields) ---\n${lines.join("\n")}`;
  };

  // 9. LEGACY REVIEW / FULL DETAILS BLOCK
  const buildExecutionAndReviewDetailsBlock = () => {
    let body = "--- EXECUTION & REVIEW DETAILS ---\n";
    if (failures.length > 0) {
      body += "[FAILURES & ATTENTION NEEDED]\n" + failures.join("\n") + "\n";
    }
    if (resolvedLookupDiagnosticNotes.length > 0) {
      body += (failures.length > 0 ? "\n" : "") + "[PRESERVED LOOKUP DIAGNOSTICS]\n" + resolvedLookupDiagnosticNotes.join("\n") + "\n";
    }
    if (verifiedDestinations.length > 0) {
      body += `\n[VERIFIED DESTINATIONS]\nBackend Confirmed: ${verifiedDestinations.join(", ")}\n`;
    } else if (history) {
      body += `\n[VERIFIED DESTINATIONS]\nNot recorded\n`;
    }
    body += `\n${summaryStatsBlock}`;
    return body;
  };

  // 10. COMPLETE ALL-SECTIONS PACKET (Used by Copy All for Gemini & Download Full Report)
  const buildCompleteAllSectionsText = () => {
    const otherSectionBlocks = dynamicSections
      .filter(sec => !["Origin and collection", "Standardized Attributes"].includes(sec.title))
      .map(sec => buildDrawerSectionText(sec.title));

    return [
      buildSummarySectionText(),
      buildExecutionAndReviewDetailsBlock(),
      buildCoverageSectionText(),
      buildStandardizedSectionText(),
      buildOriginCollectionSectionText(),
      buildDescriptionSectionText(),
      buildPhotosAltSectionText(),
      ...otherSectionBlocks,
      buildSaveResultsSectionText()
    ].join("\n\n=========================================\n\n");
  };

  // Determine normalized mode and section title
  const rawMode = String(mode || "full").trim();
  const drawerPrefixMatch = rawMode.startsWith("drawer:") ? rawMode.slice(7).trim() : "";
  const effectiveDrawerTitle =
    drawerPrefixMatch ||
    effectiveOptions.sectionTitle ||
    topLevelSectionTitle ||
    "";

  let sectionKey = rawMode.startsWith("drawer:") ? "drawer" : rawMode;
  let sectionLabel = "FULL TELEMETRY REPORT";
  let compiledBodyText = "";
  let isGeminiAllMode = false;
  let isDownloadFullMode = false;

  switch (sectionKey) {
    case "summary":
      sectionLabel = "SUMMARY TELEMETRY";
      compiledBodyText = buildSummarySectionText();
      break;
    case "coverage":
      sectionLabel = "FIELD COVERAGE TELEMETRY";
      compiledBodyText = buildCoverageSectionText();
      break;
    case "standardized":
      sectionLabel = "STANDARDIZED FIELDS TELEMETRY";
      compiledBodyText = buildStandardizedSectionText();
      break;
    case "origin_collection":
      sectionLabel = "ORIGIN & COLLECTION TELEMETRY";
      compiledBodyText = buildOriginCollectionSectionText();
      break;
    case "description":
      sectionLabel = "DESCRIPTION TELEMETRY";
      compiledBodyText = buildDescriptionSectionText();
      break;
    case "photos_alt":
      sectionLabel = "PHOTOS & ALT TEXT TELEMETRY";
      compiledBodyText = buildPhotosAltSectionText();
      break;
    case "save_results":
      sectionLabel = "SAVE RESULTS TELEMETRY";
      compiledBodyText = buildSaveResultsSectionText();
      break;
    case "drawer":
      sectionLabel = `DRAWER TELEMETRY — ${sanitizeTelemetryText(effectiveDrawerTitle || "SECTION")}`;
      compiledBodyText = buildDrawerSectionText(effectiveDrawerTitle);
      break;
    case "review":
      sectionLabel = "REVIEW TELEMETRY";
      compiledBodyText = [
        pipelineBlock,
        fieldSummaryBlock,
        historyBlock,
        buildExecutionAndReviewDetailsBlock(),
        recommendationsBlock
      ].join("\n\n");
      break;
    case "gemini_all":
      sectionLabel = "COMPLETE GEMINI TELEMETRY PACKET";
      compiledBodyText = buildCompleteAllSectionsText();
      isGeminiAllMode = true;
      break;
    case "download_full":
      sectionLabel = "COMPLETE FULL TELEMETRY REPORT";
      compiledBodyText = buildCompleteAllSectionsText();
      isDownloadFullMode = true;
      break;
    case "full":
    default:
      sectionKey = "full";
      sectionLabel = "FULL TELEMETRY DUMP";
      compiledBodyText = [
        pipelineBlock,
        fieldSummaryBlock,
        historyBlock,
        buildExecutionAndReviewDetailsBlock(),
        buildCoverageSectionText(),
        recommendationsBlock
      ].join("\n\n");
      break;
  }

  const targetMaxChars = isGeminiAllMode ? GEMINI_TARGET_PART_LIMIT : SIDEKICK_TARGET_PART_LIMIT;
  const hardMaxChars = isGeminiAllMode ? GEMINI_PACKET_GUARD_LIMIT : SIDEKICK_MAX_HARD_LIMIT;

  const parts = splitReportIntoLosslessParts({
    productTitle: product.title || data.nativeTargets?.productTitle || "Not recorded",
    productId: selectedBenchId,
    runIdentity,
    runTimestamp,
    capturedAt,
    sectionLabel,
    bodyText: compiledBodyText,
    targetMaxChars,
    hardMaxChars
  });

  const fullUntruncatedEnvelope =
    `=== ROCKHOUND STUDIO TELEMETRY — ${sectionLabel} [COMPLETE SNAPSHOT] ===\n` +
    `Product: ${sanitizeTelemetryText(product.title || data.nativeTargets?.productTitle || "Not recorded")}\n` +
    `GID: ${sanitizeTelemetryText(selectedBenchId)}\n` +
    `Run Identity: ${sanitizeTelemetryText(runIdentity)} | Run Time: ${sanitizeTelemetryText(runTimestamp)}\n` +
    `Snapshot Captured: ${capturedAt}\n` +
    `-----------------------------------------\n` +
    `${compiledBodyText}\n` +
    `========================================= [END COMPLETE SNAPSHOT] ===`;

  const initialPartIdx =
    requestedPartIndex !== undefined
      ? Math.max(0, Math.min(parts.length - 1, Number(requestedPartIndex) || 0))
      : 0;

  const packet = {
    mode: rawMode,
    sectionKey,
    sectionLabel,
    productId: selectedBenchId,
    productTitle: product.title || data.nativeTargets?.productTitle || "Not recorded",
    runIdentity,
    runTimestamp,
    capturedAt,
    limitUsed: hardMaxChars,
    fullText: fullUntruncatedEnvelope,
    parts,
    activePartIndex: initialPartIdx
  };

  if (typeof onTelemetryPacketReady === "function") {
    onTelemetryPacketReady(packet);
  }

  if (isDownloadFullMode) {
    downloadCapturedTelemetryReport({
      packet,
      setSafetyError,
      setSafetyMessage
    });
    return packet;
  }

  copyCapturedTelemetryPart({
    packet,
    partIndex: initialPartIdx,
    setSafetyError,
    setSafetyMessage
  });

  return packet;
}
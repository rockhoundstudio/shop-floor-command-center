// FILE: app/routes/app.meta-injector.matrix.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { BlockStack, Card, Text, Banner, Button, InlineStack, Box, ProgressBar, Select, Badge } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  PRODUCT_TEMPLATE_GROUPS,
  computeTemplateAuditCounts
} from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  isExactMetaobjectGid,
  parseMetaobjectGidArray,
  evaluateStandardizedDestinationTechnicalStatus,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  buildCanonicalCandidateSnapshot,
  evaluateProductReferenceMatchReadiness,
  formatErrorsList,
  serializeStandardizedAssignmentForVision,
  validArray,
  validObj
} from "../utils/meta-injector.standardized.jsx";
import {
  STATUS,
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  RETIRED_KEYS,
  FILTER_OPTIONS,
  resolveConfigFieldDestination,
  getDynamicSections,
  getStatusTone,
  isMultilineKey,
  evaluateFieldMetadata,
  computeSystemStatus,
  computeDiagnosticsStats,
  buildRepairPayload
} from "../utils/meta-injector.matrix-domain.jsx";
import {
  buildAndCopyMatrixTelemetry,
  copyCapturedTelemetryPart,
  downloadCapturedTelemetryReport
} from "../utils/meta-injector.telemetry.jsx";
import { useMetaInjectorExecution } from "../utils/meta-injector.execution-hook.jsx";
import {
  InventorySelectionColumn,
  BenchDiagnosticHeader,
  DescriptionReviewSection
} from "../components/meta-injector.bench-chrome.jsx";
import { ManifestSectionCard } from "../components/meta-injector.manifest-section.jsx";

const INITIAL_EXPANDED_BAYS = Object.freeze({
  "Description Review": Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS),
  ...Object.fromEntries(
    PRODUCT_TEMPLATE_GROUPS.map((g) => [g.heading, Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS)])
  )
});

const EMPTY_DEV_PREVIEW_MANIFEST = Object.freeze({
  currentMetafields: {},
  nativeTargets: null,
  repairPlan: {},
  metadata: {},
  verifiedGeoValues: {}
});

const TELEMETRY_PUBLISH_ENDPOINT = "/api/meta-injector-telemetry";
const TELEMETRY_PUBLISH_TIMEOUT_MS = 8000;
const LIVE_BENCH_SYNC_DEBOUNCE_MS = 380;
const LIVE_BENCH_MODE = "live_bench_state";
const MAX_PUBLISHED_CAPTURE_SIGNATURES = 64;

const RAW_COMPANION_LOOKUP_KEYS = Object.freeze({
  "custom.material": ["custom.stone_family", "stone_family", "custom.primary_medium", "primary_medium"],
  "custom.is_one_of_a_kind": ["custom.is_ooak", "is_ooak"],
  "custom.origin_page_handle": ["custom.origin_handle", "origin_handle"],
  "custom.cut_and_shape": ["custom.cut_type", "cut_type"]
});

const isExactProductGid = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/Product\/[0-9]+$/.test(val.trim());

const isValidTelemetryPacketForProduct = (packet, targetProductId) =>
  Boolean(
    packet &&
    typeof packet === "object" &&
    typeof packet.productId === "string" &&
    (!targetProductId || packet.productId === targetProductId) &&
    typeof packet.fullText === "string" &&
    packet.fullText.length > 0 &&
    Array.isArray(packet.parts) &&
    packet.parts.length > 0
  );

function generateStableBenchSessionId() {
  const randA = Math.random().toString(36).slice(2, 10);
  const randB = Math.random().toString(36).slice(2, 10);
  return `bsess_${Date.now().toString(36)}_${randA}${randB}`;
}

function redactRecognizableCredentialStrings(val) {
  if (typeof val !== "string" || val.length === 0) return val;
  return val
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/\bshpat_[a-fA-F0-9]{32,}\b/g, "shpat_[REDACTED]")
    .replace(/\bshpca_[a-fA-F0-9]{32,}\b/g, "shpca_[REDACTED]")
    .replace(/\bshpss_[a-fA-F0-9]{32,}\b/g, "shpss_[REDACTED]")
    .replace(/\bshpua_[a-fA-F0-9]{32,}\b/g, "shpua_[REDACTED]")
    .replace(/\bshprt_[a-fA-F0-9]{32,}\b/g, "shprt_[REDACTED]");
}

function computeQuickTextDigest(text) {
  const str = typeof text === "string" ? text : "";
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${str.length}:${h1.toString(16)}:${h2.toString(16)}`;
}

function buildImmutableCaptureSignature(packet) {
  if (!packet || typeof packet !== "object") return "";
  return [
    typeof packet.productId === "string" ? packet.productId.trim() : "",
    typeof packet.capturedAt === "string" ? packet.capturedAt.trim() : "",
    typeof packet.mode === "string" ? packet.mode.trim() : "",
    typeof packet.sectionKey === "string" ? packet.sectionKey.trim() : "",
    typeof packet.sectionLabel === "string" ? packet.sectionLabel.trim() : "",
    typeof packet.runIdentity === "string" ? packet.runIdentity.trim() : "",
    typeof packet.runTimestamp === "string" ? packet.runTimestamp.trim() : "",
    computeQuickTextDigest(packet.fullText)
  ].join("|");
}

function sanitizeSafePublishMessage(rawMsg, fallbackMsg) {
  if (typeof rawMsg !== "string") return fallbackMsg;
  const trimmed = rawMsg.trim();
  if (!trimmed) return fallbackMsg;
  if (/<[a-z!/][\s\S]*>/i.test(trimmed)) return fallbackMsg;
  const redacted = redactRecognizableCredentialStrings(trimmed);
  const singleLine = redacted.replace(/\s+/g, " ");
  return singleLine.length > 220 ? `${singleLine.slice(0, 220)}...` : singleLine;
}

function inspectRawStoredFieldBaseline(key, data) {
  const safeData = data || {};
  const currentMetafields = validObj(safeData.currentMetafields);
  const nativeTargets = safeData.nativeTargets || null;
  const variants = Array.isArray(nativeTargets?.variants?.edges)
    ? nativeTargets.variants.edges
    : [];
  const isSingleVariantComplete =
    variants.length === 1 &&
    nativeTargets?.variants?.pageInfo?.hasNextPage === false &&
    nativeTargets?.isComplete === true &&
    !nativeTargets?.loadError;

  if (key === "native_image_alt") {
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: null,
      rawNote: "Zero-image capability placeholder; not a stored Shopify field."
    };
  }

  if (key.startsWith("native_image_alts_")) {
    const imageId = key.replace("native_image_alts_", "");
    const mediaEdges = Array.isArray(nativeTargets?.media?.edges)
      ? nativeTargets.media.edges
      : null;
    if (!mediaEdges) {
      return {
        rawEvidenceAvailable: false,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: imageId,
        rawNote: "nativeTargets.media.edges unavailable."
      };
    }
    const matchedEdge = mediaEdges.find((e) => e?.node?.id === imageId);
    if (!matchedEdge || !matchedEdge.node) {
      return {
        rawEvidenceAvailable: false,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: imageId,
        rawNote: "MediaImage node not found in loaded nativeTargets."
      };
    }
    const rawAlt =
      typeof matchedEdge.node.alt === "string"
        ? redactRecognizableCredentialStrings(matchedEdge.node.alt)
        : null;
    return {
      rawEvidenceAvailable: true,
      rawStoredExists: Boolean(rawAlt && rawAlt.trim() !== ""),
      rawStoredValue: rawAlt,
      rawSourceKey: imageId,
      rawNote: null
    };
  }

  if (key === "native_title" || key === "shopify_title") {
    if (typeof nativeTargets?.productTitle === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.productTitle);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.productTitle",
        rawNote: null
      };
    }
    if (typeof safeData.canonicalFields?.shopify_title === "string") {
      const cleanVal = redactRecognizableCredentialStrings(safeData.canonicalFields.shopify_title);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "canonicalFields.shopify_title",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.productTitle",
      rawNote: "Product title baseline not present on manifest."
    };
  }

  if (key === "native_description") {
    if (typeof nativeTargets?.descriptionHtml === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.descriptionHtml);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.descriptionHtml",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.descriptionHtml",
      rawNote: "nativeTargets.descriptionHtml not present on manifest."
    };
  }

  if (key === "native_seo_title") {
    if (nativeTargets?.seo && typeof nativeTargets.seo.title === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.seo.title);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.seo.title",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: Boolean(nativeTargets?.seo),
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.seo.title",
      rawNote: nativeTargets?.seo ? null : "nativeTargets.seo not present on manifest."
    };
  }

  if (key === "native_seo_description") {
    if (nativeTargets?.seo && typeof nativeTargets.seo.description === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.seo.description);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.seo.description",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: Boolean(nativeTargets?.seo),
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.seo.description",
      rawNote: nativeTargets?.seo ? null : "nativeTargets.seo not present on manifest."
    };
  }

  if (key === "native_price" || key === "price") {
    if (isSingleVariantComplete) {
      const rawPrice = variants[0]?.node?.price ?? null;
      const cleanPrice =
        rawPrice !== null && rawPrice !== undefined
          ? redactRecognizableCredentialStrings(String(rawPrice))
          : null;
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: Boolean(cleanPrice && cleanPrice.trim() !== ""),
        rawStoredValue: cleanPrice,
        rawSourceKey: "nativeTargets.variants[0].price",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.variants[0].price",
      rawNote: "Single complete variant baseline unavailable."
    };
  }

  if (key === "native_shipping_weight") {
    if (isSingleVariantComplete) {
      const w = variants[0]?.node?.inventoryItem?.measurement?.weight;
      if (w && w.value !== undefined && w.value !== null) {
        return {
          rawEvidenceAvailable: true,
          rawStoredExists: true,
          rawStoredValue: { value: w.value, unit: w.unit || null },
          rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
          rawNote: null
        };
      }
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
      rawNote: "Single complete variant weight baseline unavailable."
    };
  }

  const hasCurrentMetafieldsMap = Boolean(
    safeData.currentMetafields && typeof safeData.currentMetafields === "object"
  );
  if (!hasCurrentMetafieldsMap) {
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: key,
      rawNote: "currentMetafields map unavailable on manifest."
    };
  }

  let matchedKey = null;
  let rawVal = undefined;

  if (Object.prototype.hasOwnProperty.call(currentMetafields, key)) {
    matchedKey = key;
    rawVal = currentMetafields[key];
  }

  const rawStringTrimmed =
    rawVal === undefined || rawVal === null
      ? ""
      : typeof rawVal === "string"
        ? rawVal.trim()
        : JSON.stringify(rawVal);

  if ((!matchedKey || rawStringTrimmed === "" || rawStringTrimmed === "[]") && RAW_COMPANION_LOOKUP_KEYS[key]) {
    for (const compKey of RAW_COMPANION_LOOKUP_KEYS[key]) {
      if (Object.prototype.hasOwnProperty.call(currentMetafields, compKey)) {
        const compVal = currentMetafields[compKey];
        if (compVal !== undefined && compVal !== null && String(compVal).trim() !== "") {
          matchedKey = compKey;
          rawVal = compVal;
          break;
        }
      }
    }
  }

  if (rawVal === undefined || rawVal === null) {
    return {
      rawEvidenceAvailable: true,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: matchedKey,
      rawNote:
        key === "custom.collection_date"
          ? 'No stored metafield value in Shopify (UI displays "N/A" as a display convention, not a stored string).'
          : null
    };
  }

  const sanitizedRaw =
    typeof rawVal === "string"
      ? redactRecognizableCredentialStrings(rawVal)
      : rawVal;
  const nonBlank =
    typeof sanitizedRaw === "string"
      ? sanitizedRaw.trim() !== "" && sanitizedRaw.trim() !== "[]"
      : Array.isArray(sanitizedRaw)
        ? sanitizedRaw.length > 0
        : true;

  return {
    rawEvidenceAvailable: true,
    rawStoredExists: nonBlank,
    rawStoredValue: sanitizedRaw,
    rawSourceKey: matchedKey,
    rawNote: null
  };
}

function buildMeasuredUiAuditSnapshot(productId, measurementsState) {
  if (
    !productId ||
    !isExactProductGid(productId) ||
    !measurementsState ||
    typeof measurementsState !== "object" ||
    measurementsState.productId !== productId ||
    !measurementsState.bySection ||
    typeof measurementsState.bySection !== "object"
  ) {
    return null;
  }

  const bySection = measurementsState.bySection;
  const measuredEntries = {};
  let measuredSectionCount = 0;

  for (const [secTitle, rec] of Object.entries(bySection)) {
    if (
      !rec ||
      typeof rec !== "object" ||
      typeof rec.renderedCount !== "number" ||
      !Number.isFinite(rec.renderedCount) ||
      !Array.isArray(rec.renderedKeys)
    ) {
      continue;
    }

    const safeRenderedKeys = rec.renderedKeys.filter(
      (k) => typeof k === "string" && k.length > 0 && k.length <= 200
    );

    measuredEntries[secTitle] = {
      measurementStatus: "measured",
      logicalCount:
        typeof rec.logicalCount === "number" && Number.isFinite(rec.logicalCount)
          ? rec.logicalCount
          : null,
      renderedCount: rec.renderedCount,
      renderedKeys: safeRenderedKeys,
      mediaControlCount:
        typeof rec.mediaControlCount === "number" && Number.isFinite(rec.mediaControlCount)
          ? rec.mediaControlCount
          : 0,
      hasZeroImagePlaceholder: Boolean(rec.hasZeroImagePlaceholder)
    };
    measuredSectionCount += 1;
  }

  if (measuredSectionCount === 0) {
    return null;
  }

  const expectedSectionHeadings = PRODUCT_TEMPLATE_GROUPS.map((g) => g.heading).filter(
    (h) => typeof h === "string" && h.trim().length > 0
  );

  const sectionsReport = {};
  const unmeasuredSectionHeadings = [];
  let totalMeasuredRenderedRows = 0;
  let totalMeasuredMediaControls = 0;
  let anyZeroImagePlaceholder = false;

  for (let i = 0; i < expectedSectionHeadings.length; i += 1) {
    const heading = expectedSectionHeadings[i];
    if (Object.prototype.hasOwnProperty.call(measuredEntries, heading)) {
      const entry = measuredEntries[heading];
      sectionsReport[heading] = entry;
      totalMeasuredRenderedRows += entry.renderedCount;
      totalMeasuredMediaControls += entry.mediaControlCount;
      if (entry.hasZeroImagePlaceholder) {
        anyZeroImagePlaceholder = true;
      }
    } else {
      sectionsReport[heading] = {
        measurementStatus: "not_measured",
        renderedCount: null,
        renderedKeys: null,
        mediaControlCount: null,
        hasZeroImagePlaceholder: null
      };
      unmeasuredSectionHeadings.push(heading);
    }
  }

  for (const [secTitle, entry] of Object.entries(measuredEntries)) {
    if (!Object.prototype.hasOwnProperty.call(sectionsReport, secTitle)) {
      sectionsReport[secTitle] = entry;
      totalMeasuredRenderedRows += entry.renderedCount;
      totalMeasuredMediaControls += entry.mediaControlCount;
      if (entry.hasZeroImagePlaceholder) {
        anyZeroImagePlaceholder = true;
      }
    }
  }

  const totalKnownGroups = expectedSectionHeadings.length;
  const isComplete =
    totalKnownGroups > 0 &&
    unmeasuredSectionHeadings.length === 0 &&
    measuredSectionCount >= totalKnownGroups;

  return {
    productId,
    measurementCoverage: isComplete ? "complete" : "partial",
    measuredSectionCount,
    totalKnownTemplateGroups: totalKnownGroups,
    unmeasuredSectionCount: unmeasuredSectionHeadings.length,
    unmeasuredSections: unmeasuredSectionHeadings,
    totalRenderedRows: isComplete ? totalMeasuredRenderedRows : null,
    measuredRenderedRowsSubtotal: totalMeasuredRenderedRows,
    mediaControlCount: totalMeasuredMediaControls,
    hasZeroImagePlaceholder: anyZeroImagePlaceholder,
    devShowAllTemplateFieldsActive: Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS),
    sections: sectionsReport
  };
}

function buildSelectedUnloadedLiveBenchPayload({
  benchSessionId,
  benchRevision,
  clientStateChangedAt,
  productId,
  productTitle,
  productQueueStatus
}) {
  const cleanTitle = redactRecognizableCredentialStrings(productTitle || "Not recorded") || "Not recorded";
  const runIdentity = "selected_manifest_not_loaded";
  const runTimestamp = "Manifest not loaded in browser";

  const structuredPayload = {
    schemaVersion: 1,
    stateKind: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    productTitle: cleanTitle,
    clientStateChangedAt,
    baselineLoadedAt: null,
    baselineEventKind: "manifest_not_loaded",
    baselineState: "unavailable_not_loaded",
    manifestLoaded: false,
    productQueueStatus: productQueueStatus || null,
    dataAuthorityNote:
      "Product is selected on the Tab 3 bench, but its Shopify manifest baseline has NOT been loaded into browser state yet. No field values, proposals, or baseline timestamps exist for this product in the current browser session.",
    runIdentity,
    runTimestamp,
    systemStatus: {
      shopifyReadStatus: "Not loaded",
      geminiStatus: "Not called",
      visionStatus: "Not called",
      geoLibraryStatus: "Not called",
      readBackStatus: "Not called",
      currentStage: "manifest_not_loaded",
      finalStageDisplay: "Selected (Manifest Not Loaded)",
      fetcherStateDisplay: "idle",
      loadingStateDisplay: "Idle",
      errorMessageDisplay: "None"
    },
    diagnosticsStats: null,
    manualEditedKeys: [],
    explicitlyApprovedKeys: [],
    standardizedReferenceState: {
      readinessState: "manifest_not_loaded",
      readinessReason: "Product manifest baseline has not been loaded yet.",
      stagedCandidateCount: 0,
      stagedCandidates: {},
      eligibleDestinationKeys: [],
      blockedDestinationKeys: [],
      lastMatchRequestId: null,
      lastMatchedAt: null,
      lastMatchSuccess: null,
      lastMatchIsComplete: null,
      productCategory: null
    },
    saveVerificationEvidence: {
      hasRepairAttemptInSession: false,
      lastRepairCompletedAt: null,
      lastRepairStatus: null,
      lastRepairSuccess: null,
      readBackVerified: null,
      fieldsUpdatedCount: null,
      verifiedDestinations: [],
      attemptedDestinations: [],
      blockedFields: {},
      conflicts: {},
      unresolvedChanges: {},
      note: "Product manifest is not loaded; no baseline or working field values are available."
    },
    sectionOrder: [],
    fieldsByKey: {}
  };

  const fullText = JSON.stringify(structuredPayload);

  const packet = {
    mode: LIVE_BENCH_MODE,
    sectionKey: LIVE_BENCH_MODE,
    sectionLabel: "LIVE BENCH FIELD STATE (MANIFEST NOT LOADED)",
    productId,
    productTitle: cleanTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientStateChangedAt,
    limitUsed: 400000,
    fullText,
    parts: [
      {
        index: 0,
        partNumber: 1,
        totalParts: 1,
        label: "LIVE BENCH FIELD STATE (MANIFEST NOT LOADED)",
        charCount: fullText.length
      }
    ],
    activePartIndex: 0,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  const liveState = {
    mode: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  return { packet, liveState };
}

function buildPureLiveBenchPayload({
  benchSessionId,
  benchRevision,
  clientStateChangedAt,
  baselineLoadedAt,
  baselineEventKind,
  productId,
  productTitle,
  data,
  approvals,
  manualEdits,
  repairHistory,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  pendingReferenceMatch,
  getFieldMetadata,
  getSystemStatus,
  getDiagnosticsStats
}) {
  const safeData = data || {};
  const dynamicSections = getDynamicSections(safeData);
  const allConfigFields = dynamicSections.flatMap((sec) => sec.configFields || []);
  const productManualEdits = validObj(manualEdits?.[productId]);
  const productApprovals = validObj(approvals?.[productId]);
  const history = repairHistory?.[productId] || null;
  const lastSubmitted = submittedPayloads?.[productId] || null;
  const diag = validObj(safeData.diagnostics);

  const rawCandidates = standardizedCandidatesByProduct?.[productId] || {};
  const candidateBundle = buildCanonicalCandidateBundle(rawCandidates);
  const refMatchResult = referenceMatchResultsByProduct?.[productId] || null;
  const refMatchStatus = referenceMatchStatusByProduct?.[productId] || null;
  const refReadiness = evaluateProductReferenceMatchReadiness({
    productId,
    data: safeData,
    rawCandidates,
    refMatchResult,
    refMatchStatus,
    pendingReferenceMatch
  });

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

  const serializeSingleFieldRow = (key, sectionHeading, sectionConfigFields = []) => {
    const meta = getFieldMetadata(
      key,
      safeData,
      productId,
      approvals,
      sectionConfigFields.length > 0 ? sectionConfigFields : allConfigFields
    );
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    const rawBaseline = inspectRawStoredFieldBaseline(key, safeData);
    const isManualEdited = Boolean(
      productManualEdits[key] === true || productManualEdits[targetKey] === true
    );
    const isCollectionDateDisplayNa =
      (key === "custom.collection_date" || key === "collection_date") &&
      !rawBaseline.rawStoredExists &&
      meta.currentVal === "N/A";

    const verifiedMap = meta.stdEvaluation?.verifiedEntriesMap || null;
    let resolvedStandardizedLabels = null;
    if (meta.isStandardizedAttribute && verifiedMap instanceof Map && verifiedMap.size > 0) {
      const currentGids = parseMetaobjectGidArray(meta.currentVal);
      const proposedGids = parseMetaobjectGidArray(meta.propVal);
      resolvedStandardizedLabels = {
        currentEntries: currentGids.map((gid) => ({
          gid,
          label: verifiedMap.get(gid)?.displayName || verifiedMap.get(gid)?.label || null
        })),
        proposedEntries: proposedGids.map((gid) => ({
          gid,
          label: verifiedMap.get(gid)?.displayName || verifiedMap.get(gid)?.label || null
        }))
      };
    }

    const wasSubmittedInLastSave = Boolean(
      lastSubmitted &&
        (Object.prototype.hasOwnProperty.call(lastSubmitted, key) ||
          Object.prototype.hasOwnProperty.call(lastSubmitted, targetKey))
    );
    const lastSubmittedValue = wasSubmittedInLastSave
      ? redactRecognizableCredentialStrings(
          String(
            Object.prototype.hasOwnProperty.call(lastSubmitted, key)
              ? lastSubmitted[key]
              : lastSubmitted[targetKey]
          )
        )
      : null;

    return {
      key,
      targetKey,
      section: sectionHeading,
      label: meta.label,
      type: meta.type,
      owner: meta.owner,
      namespace: meta.namespace,
      metaKey: meta.metaKey,
      control: meta.control || null,
      rawStoredBaseline: {
        evidenceAvailable: rawBaseline.rawEvidenceAvailable,
        exists: rawBaseline.rawStoredExists,
        value: rawBaseline.rawStoredValue,
        sourceKey: rawBaseline.rawSourceKey,
        note: rawBaseline.rawNote
      },
      evaluatedBaseline: {
        currentExists: Boolean(meta.currentExists),
        value: redactRecognizableCredentialStrings(meta.currentVal ?? ""),
        isDisplayOnlyPlaceholderOrNa: Boolean(
          meta.isImageAltCapabilityPlaceholder || isCollectionDateDisplayNa
        )
      },
      workingState: {
        isProposed: Boolean(meta.isProposed),
        proposalExists: Boolean(meta.proposalExists),
        proposalStatus: meta.proposalStatus,
        proposedValue: redactRecognizableCredentialStrings(meta.propVal ?? ""),
        isManualEdit: isManualEdited,
        isApproved: Boolean(meta.isApproved),
        isContentPreApproved: Boolean(meta.isContentPreApproved),
        preApprovalReason: meta.preApprovalReason || null,
        contentNeedsReview: Boolean(meta.contentNeedsReview),
        source: meta.source || "Not reported",
        stage: meta.stage || "Not reported"
      },
      statusAndHolds: {
        fieldStatus: meta.fieldStatus,
        isSupported: Boolean(meta.isSupported),
        isBlockedAction: Boolean(meta.isBlockedAction),
        hasTechnicalBlock: Boolean(meta.hasTechnicalBlock),
        isActualBlockedProposal: Boolean(meta.isActualBlockedProposal),
        isManualOnly: Boolean(meta.isManualOnly),
        isOperatorOwned: Boolean(meta.isOperatorOwned),
        isPendingReadOnly: Boolean(meta.isPendingReadOnly),
        isStandardizedAttribute: Boolean(meta.isStandardizedAttribute),
        isVerifiedStdDest: Boolean(meta.isVerifiedStdDest),
        isCategoryEligible: Boolean(meta.isCategoryEligible),
        hasContractOrOwnerHold: Boolean(meta.hasContractOrOwnerHold),
        hasExplicitStorageHold: Boolean(meta.hasExplicitStorageHold),
        hasExplicitProducerHold: Boolean(meta.hasExplicitProducerHold),
        isChannelFlagReadOnly: Boolean(meta.isChannelFlagReadOnly),
        isVariantMetafieldHold: Boolean(meta.isVariantMetafieldHold),
        isImageAltCapabilityPlaceholder: Boolean(meta.isImageAltCapabilityPlaceholder),
        imageAltPlaceholderReason: meta.imageAltPlaceholderReason || null,
        applicability: meta.applicabilityState || null,
        reasons: Array.isArray(meta.reasons)
          ? meta.reasons.map((r) => redactRecognizableCredentialStrings(String(r)))
          : []
      },
      conflictsAndSaveEvidence: {
        conflictData: meta.conflictData || null,
        nativeDescConflictData: meta.nativeDescConflictData || null,
        wasSubmittedInLastRepair: wasSubmittedInLastSave,
        lastSubmittedValue
      },
      ...(resolvedStandardizedLabels ? { standardizedEntryLabels: resolvedStandardizedLabels } : {})
    };
  };

  const fieldsByKey = {};
  const sectionOrder = [];

  // Dedicated Description Review companion row (custom.generated_description) + native_description
  const customDescRow = serializeSingleFieldRow(
    "custom.generated_description",
    "Description Review",
    allConfigFields
  );
  fieldsByKey["custom.generated_description"] = customDescRow;

  for (let i = 0; i < dynamicSections.length; i += 1) {
    const sec = dynamicSections[i];
    const secKeys = Array.isArray(sec.keys) ? sec.keys : [];
    sectionOrder.push({
      sectionTitle: sec.title,
      fieldKeys: secKeys
    });
    for (let j = 0; j < secKeys.length; j += 1) {
      const k = secKeys[j];
      fieldsByKey[k] = serializeSingleFieldRow(k, sec.title, sec.configFields || []);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(fieldsByKey, "native_description")) {
    fieldsByKey["native_description"] = serializeSingleFieldRow(
      "native_description",
      "Description Review",
      allConfigFields
    );
  }

  const systemStatus = getSystemStatus();
  const diagnosticsStats = getDiagnosticsStats(safeData);

  const standardizedSummary = {
    readinessState: refReadiness.state,
    readinessReason: refReadiness.reason || null,
    stagedCandidateCount: candidateBundle.count,
    stagedCandidates: candidateBundle.ordered,
    eligibleDestinationKeys: refReadiness.eligibleDestinationKeys || [],
    blockedDestinationKeys: refReadiness.blockedDestinationKeys || [],
    lastMatchRequestId: refMatchResult?.requestId || refMatchStatus?.requestId || null,
    lastMatchedAt: refMatchResult?.matchedAt || null,
    lastMatchSuccess: refMatchResult ? Boolean(refMatchResult.success) : null,
    lastMatchIsComplete: refMatchResult ? Boolean(refMatchResult.isComplete) : null,
    productCategory: refMatchResult?.productCategory || safeData.productCategory || null
  };

  const saveVerificationSummary = {
    hasRepairAttemptInSession: Boolean(history),
    lastRepairCompletedAt: history?.completedAt || null,
    lastRepairStatus: history?.status || null,
    lastRepairSuccess: history?.success !== undefined ? Boolean(history.success) : null,
    readBackVerified:
      history?.readBackVerified !== undefined ? Boolean(history.readBackVerified) : null,
    fieldsUpdatedCount:
      history?.fieldsUpdated !== undefined ? history.fieldsUpdated : null,
    verifiedDestinations: validArray(history?.verifiedDestinations),
    attemptedDestinations: validArray(history?.attemptedDestinations),
    blockedFields: validObj(history?.blockedFields),
    conflicts: validObj(history?.conflicts),
    unresolvedChanges: validObj(history?.unresolvedChanges),
    note:
      "Live bench state synchronization to the Sidekick cache never saves changes to Shopify. Only verifiedDestinations with readBackVerified=true reflect confirmed Shopify writes."
  };

  const cleanTitle = redactRecognizableCredentialStrings(productTitle || "Not recorded") || "Not recorded";

  const structuredPayload = {
    schemaVersion: 1,
    stateKind: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    productTitle: cleanTitle,
    clientStateChangedAt,
    baselineLoadedAt: baselineLoadedAt || null,
    baselineEventKind: baselineEventKind || "last_loaded_manifest",
    baselineState: "loaded_in_browser",
    manifestLoaded: true,
    baselineSource: "last_loaded_manifest",
    workingState: "unsaved_browser_bench",
    dataAuthorityNote:
      "All field values are passive diagnostic data. rawStoredBaseline reflects the last manifest loaded into the browser (not a live Shopify GraphQL read at query time). workingState reflects unsaved browser proposals, manual edits, and approvals.",
    runIdentity,
    runTimestamp,
    systemStatus,
    diagnosticsStats,
    manualEditedKeys: Object.keys(productManualEdits).filter((k) => productManualEdits[k] === true),
    explicitlyApprovedKeys: Object.keys(productApprovals),
    standardizedReferenceState: standardizedSummary,
    saveVerificationEvidence: saveVerificationSummary,
    sectionOrder,
    fieldsByKey
  };

  const fullText = JSON.stringify(structuredPayload);

  const packet = {
    mode: LIVE_BENCH_MODE,
    sectionKey: LIVE_BENCH_MODE,
    sectionLabel: "LIVE BENCH FIELD STATE",
    productId,
    productTitle: cleanTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientStateChangedAt,
    limitUsed: 400000,
    fullText,
    parts: [
      {
        index: 0,
        partNumber: 1,
        totalParts: 1,
        label: "LIVE BENCH FIELD STATE",
        charCount: fullText.length
      }
    ],
    activePartIndex: 0,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    clientStateChangedAt,
    baselineLoadedAt: baselineLoadedAt || null
  };

  const liveState = {
    mode: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    clientStateChangedAt,
    baselineLoadedAt: baselineLoadedAt || null
  };

  return { packet, liveState };
}

export function OperationsMatrixTab({ products }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data Loading State
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadIndex, setLoadIndex] = useState(0);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState(null);
  const [executeIndex, setExecuteIndex] = useState(0);
  const [aiStep, setAiStep] = useState(0);
  
  const [pendingOperation, setPendingOperation] = useState(null); // { id, intent, token }
  const [aiData, setAiData] = useState({}); // Indexed by pieceId to isolate cross-contamination
  const [standardizedCandidatesByProduct, setStandardizedCandidatesByProduct] = useState({});

  // Dedicated Reference Matching State (Isolated per product GID)
  const [referenceMatchResultsByProduct, setReferenceMatchResultsByProduct] = useState({});
  const [referenceMatchStatusByProduct, setReferenceMatchStatusByProduct] = useState({});
  const [pendingReferenceMatch, setPendingReferenceMatch] = useState(null);
  const [releasedReferenceMatchRequest, setReleasedReferenceMatchRequest] = useState(null);
  const [releasedReferenceMatchIds, setReleasedReferenceMatchIds] = useState({});

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  const [lastProcessedData, setLastProcessedData] = useState(null);
  
  const [approvals, setApprovals] = useState({});
  const [manualEdits, setManualEdits] = useState({}); 
  const [submittedPayloads, setSubmittedPayloads] = useState({}); 
  
  const [repairHistory, setRepairHistory] = useState({});

  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [telemetryPacket, setTelemetryPacket] = useState(null);
  const [sectionAuditMeasurements, setSectionAuditMeasurements] = useState({
    productId: null,
    bySection: {}
  });
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");
  const [telemetryPublishNotice, setTelemetryPublishNotice] = useState(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedBays, setExpandedBays] = useState(INITIAL_EXPANDED_BAYS);

  const activeBenchIdRef = useRef(selectedBenchId);
  useEffect(() => {
    activeBenchIdRef.current = selectedBenchId;
  }, [selectedBenchId]);

  const sectionAuditMeasurementsRef = useRef(sectionAuditMeasurements);
  useEffect(() => {
    sectionAuditMeasurementsRef.current = sectionAuditMeasurements;
  }, [sectionAuditMeasurements]);

  // Manual capture deduplication and abort refs
  const publishDedupMapRef = useRef(new Map());
  const activePublishAbortRef = useRef(null);

  // Live bench session identity, monotonic revision counter, baseline timestamp tracker, and sync refs
  const benchSessionIdRef = useRef(null);
  if (!benchSessionIdRef.current) {
    benchSessionIdRef.current = generateStableBenchSessionId();
  }
  const benchRevisionRef = useRef(0);
  const nextBenchRevision = useCallback(() => {
    benchRevisionRef.current += 1;
    return benchRevisionRef.current;
  }, []);

  const [liveBenchSyncStatus, setLiveBenchSyncStatus] = useState(() => ({
    lifecycle: "unavailable",
    benchSessionId: benchSessionIdRef.current,
    benchRevision: null,
    selectionState: "none",
    productId: null,
    reportId: null,
    clientStateChangedAt: null,
    baselineLoadedAt: null,
    serverReceivedAt: null,
    errorCode: null,
    errorMessage: null
  }));

  const baselineMetaByProductRef = useRef({});
  const prevMetafieldsRefByProduct = useRef({});
  const prevNativeTargetsRefByProduct = useRef({});
  const prevRepairCompletedAtByProduct = useRef({});

  const liveSyncAbortRef = useRef(null);
  const liveSyncDebounceTimerRef = useRef(null);
  const lastLiveStateDigestRef = useRef("");
  const lastLiveSyncedDigestRef = useRef("");
  const lastLiveStateChangedAtRef = useRef(null);
  const lastLiveStateRevisionRef = useRef(0);
  const lastNotifiedSelectionClearRef = useRef(true);

  const batchFetcher = useFetcher();
  const referenceMatchFetcher = useFetcher();

  // Track actual baseline load and verified read-back timestamps when manifestData or repairHistory updates
  useEffect(() => {
    const nowIso = new Date().toISOString();
    const productIds = Object.keys(manifestData || {});
    for (let i = 0; i < productIds.length; i += 1) {
      const pid = productIds[i];
      const entry = manifestData[pid];
      if (!entry || typeof entry !== "object") continue;

      const prevMf = prevMetafieldsRefByProduct.current[pid];
      const prevNt = prevNativeTargetsRefByProduct.current[pid];
      const histCompletedAt = repairHistory?.[pid]?.completedAt || null;
      const prevHistCompletedAt = prevRepairCompletedAtByProduct.current[pid] || null;

      if (!baselineMetaByProductRef.current[pid]) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: histCompletedAt || nowIso,
          eventKind: histCompletedAt ? "repair_execution_response" : "manifest_loaded"
        };
      } else if (histCompletedAt && histCompletedAt !== prevHistCompletedAt) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: histCompletedAt,
          eventKind:
            repairHistory?.[pid]?.readBackVerified === true
              ? "verified_repair_readback"
              : "repair_execution_response"
        };
      } else if (
        (entry.currentMetafields && entry.currentMetafields !== prevMf) ||
        (entry.nativeTargets && entry.nativeTargets !== prevNt)
      ) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: nowIso,
          eventKind: "manifest_reloaded"
        };
      }

      prevMetafieldsRefByProduct.current[pid] = entry.currentMetafields;
      prevNativeTargetsRefByProduct.current[pid] = entry.nativeTargets;
      prevRepairCompletedAtByProduct.current[pid] = histCompletedAt;
    }
  }, [manifestData, repairHistory]);

  const sendLiveBenchSelectionClear = useCallback(
    (options = {}) => {
      const { useKeepalive = false } = options;
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
      if (liveSyncAbortRef.current) {
        try {
          liveSyncAbortRef.current.abort();
        } catch {
          // Ignore abort errors
        }
        liveSyncAbortRef.current = null;
      }

      const sessionId = benchSessionIdRef.current;
      const revision = nextBenchRevision();
      const clientStateChangedAt = new Date().toISOString();
      lastLiveStateDigestRef.current = `none:${revision}`;
      lastLiveSyncedDigestRef.current = "";
      lastLiveStateRevisionRef.current = revision;
      lastLiveStateChangedAtRef.current = clientStateChangedAt;
      lastNotifiedSelectionClearRef.current = true;

      if (!useKeepalive) {
        setLiveBenchSyncStatus({
          lifecycle: "pending",
          benchSessionId: sessionId,
          benchRevision: revision,
          selectionState: "none",
          productId: null,
          reportId: null,
          clientStateChangedAt,
          baselineLoadedAt: null,
          serverReceivedAt: null,
          errorCode: null,
          errorMessage: null
        });
      }

      const bodyStr = JSON.stringify({
        liveState: {
          mode: LIVE_BENCH_MODE,
          benchSessionId: sessionId,
          benchRevision: revision,
          selectionState: "none",
          clientStateChangedAt
        }
      });

      const controller = new AbortController();
      if (!useKeepalive) {
        liveSyncAbortRef.current = controller;
      }
      let timedOut = false;
      const timerId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Ignore abort timeout error
        }
      }, TELEMETRY_PUBLISH_TIMEOUT_MS);

      fetch(TELEMETRY_PUBLISH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: bodyStr,
        keepalive: Boolean(useKeepalive),
        signal: controller.signal
      })
        .then(async (response) => {
          if (useKeepalive) return;
          const rawText = await response.text();
          let parsed = null;
          if (rawText && rawText.trim().length > 0) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
          }

          if (
            benchSessionIdRef.current !== sessionId ||
            benchRevisionRef.current !== revision
          ) {
            return;
          }

          const liveSession =
            parsed && typeof parsed === "object" && parsed.liveSession && typeof parsed.liveSession === "object"
              ? parsed.liveSession
              : null;

          if (
            response.ok &&
            parsed &&
            parsed.ok === true &&
            parsed.status === "stored" &&
            parsed.selectionState === "none" &&
            liveSession &&
            liveSession.benchSessionId === sessionId &&
            liveSession.benchRevision === revision &&
            liveSession.selectionState === "none"
          ) {
            setLiveBenchSyncStatus({
              lifecycle: "cleared",
              benchSessionId: liveSession.benchSessionId,
              benchRevision: liveSession.benchRevision,
              selectionState: "none",
              productId: null,
              reportId: null,
              clientStateChangedAt:
                typeof liveSession.clientStateChangedAt === "string"
                  ? liveSession.clientStateChangedAt
                  : clientStateChangedAt,
              baselineLoadedAt: null,
              serverReceivedAt:
                typeof liveSession.serverReceivedAt === "string"
                  ? liveSession.serverReceivedAt
                  : null,
              errorCode: null,
              errorMessage: null
            });
            return;
          }

          if (
            parsed &&
            parsed.code === "stale_bench_revision" &&
            typeof parsed.highestRevision === "number" &&
            Number.isSafeInteger(parsed.highestRevision) &&
            parsed.highestRevision > benchRevisionRef.current
          ) {
            benchRevisionRef.current = parsed.highestRevision;
          }

          const backendCode =
            parsed && typeof parsed.code === "string" && parsed.code.trim()
              ? parsed.code.trim()
              : `http_${response.status}`;
          const backendMsg = sanitizeSafePublishMessage(
            parsed?.message,
            `Selection clear rejected (HTTP ${response.status}).`
          );

          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: sessionId,
            benchRevision: revision,
            selectionState: "none",
            productId: null,
            reportId: null,
            clientStateChangedAt,
            baselineLoadedAt: null,
            serverReceivedAt: null,
            errorCode: backendCode,
            errorMessage: backendMsg
          });
        })
        .catch(() => {
          if (useKeepalive) return;
          if (!timedOut && controller.signal.aborted) {
            return;
          }
          if (
            benchSessionIdRef.current !== sessionId ||
            benchRevisionRef.current !== revision
          ) {
            return;
          }
          const errCode = timedOut ? "request_timeout" : "network_error";
          const errMsg = timedOut
            ? `Selection clear timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
            : "Network or authentication error while clearing live bench state.";
          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: sessionId,
            benchRevision: revision,
            selectionState: "none",
            productId: null,
            reportId: null,
            clientStateChangedAt,
            baselineLoadedAt: null,
            serverReceivedAt: null,
            errorCode: errCode,
            errorMessage: errMsg
          });
        })
        .finally(() => {
          clearTimeout(timerId);
          if (liveSyncAbortRef.current === controller) {
            liveSyncAbortRef.current = null;
          }
        });
    },
    [nextBenchRevision]
  );

  useEffect(() => {
    return () => {
      if (activePublishAbortRef.current) {
        try {
          activePublishAbortRef.current.abort();
        } catch {
          // Ignore unmount abort errors
        }
        activePublishAbortRef.current = null;
      }
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
      if (!lastNotifiedSelectionClearRef.current) {
        sendLiveBenchSelectionClear({ useKeepalive: true });
      }
    };
  }, [sendLiveBenchSelectionClear]);

  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);
  
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = { status: status, logs: [...existingLogs, ...newLogs] };
      return updated;
    });
  }, []);

  const handleSelectBenchItem = useCallback((id) => {
    setSelectedBenchId((prevId) => {
      if (prevId !== id) {
        if (activePublishAbortRef.current) {
          try {
            activePublishAbortRef.current.abort();
          } catch {
            // Ignore abort errors on product switch
          }
          activePublishAbortRef.current = null;
        }
        if (liveSyncDebounceTimerRef.current) {
          clearTimeout(liveSyncDebounceTimerRef.current);
          liveSyncDebounceTimerRef.current = null;
        }
        if (liveSyncAbortRef.current) {
          try {
            liveSyncAbortRef.current.abort();
          } catch {
            // Ignore live sync abort on switch
          }
          liveSyncAbortRef.current = null;
        }
        // Immediately invalidate previous stone on switch or deselection so old stone is never exposed as current
        if (!id) {
          sendLiveBenchSelectionClear();
        } else if (prevId && prevId !== id) {
          sendLiveBenchSelectionClear();
        }
        setExpandedBays(INITIAL_EXPANDED_BAYS);
        setTelemetryPacket(null);
        setTelemetryPublishNotice(null);
        setSectionAuditMeasurements({ productId: id || null, bySection: {} });
      }
      return id;
    });
  }, [sendLiveBenchSelectionClear]);

  // Invalidate captured telemetry snapshot when a new load, AI pipeline, or repair execution starts,
  // or when the active product's repair history or reference match result changes, without clearing
  // the snapshot during ordinary part-copy notifications.
  const activeProductHistoryRef = selectedBenchId ? repairHistory[selectedBenchId]?.completedAt : null;
  const activeProductMatchTimeRef = selectedBenchId ? referenceMatchResultsByProduct[selectedBenchId]?.matchedAt : null;

  useEffect(() => {
    if (isLoadingData || isExecuting) {
      setTelemetryPacket(null);
      setTelemetryPublishNotice(null);
    }
    if (isLoadingData && !lastNotifiedSelectionClearRef.current) {
      sendLiveBenchSelectionClear();
    }
  }, [isLoadingData, isExecuting, sendLiveBenchSelectionClear]);

  useEffect(() => {
    setTelemetryPacket((prev) => {
      if (!prev) return null;
      if (!selectedBenchId || prev.productId !== selectedBenchId) {
        return null;
      }
      return null;
    });
    setTelemetryPublishNotice(null);
  }, [selectedBenchId, activeProductHistoryRef, activeProductMatchTimeRef]);

  const handleSectionRenderedCountChange = useCallback((payload) => {
    if (!payload || typeof payload.sectionTitle !== "string") return;
    const incomingProdId = payload.productId || null;
    const currentTargetProdId = activeBenchIdRef.current || null;
    if (incomingProdId !== currentTargetProdId) return;

    setSectionAuditMeasurements((prev) => {
      const baseBySection = prev.productId === incomingProdId ? prev.bySection : {};
      const existing = baseBySection[payload.sectionTitle];
      const nextKeys = Array.isArray(payload.renderedKeys) ? payload.renderedKeys : [];

      if (
        existing &&
        existing.logicalCount === payload.logicalCount &&
        existing.renderedCount === payload.renderedCount &&
        existing.mediaControlCount === payload.mediaControlCount &&
        existing.hasZeroImagePlaceholder === payload.hasZeroImagePlaceholder &&
        Array.isArray(existing.renderedKeys) &&
        existing.renderedKeys.length === nextKeys.length &&
        existing.renderedKeys.every((k, idx) => k === nextKeys[idx])
      ) {
        return prev;
      }

      return {
        productId: incomingProdId,
        bySection: {
          ...baseBySection,
          [payload.sectionTitle]: {
            logicalCount: payload.logicalCount,
            renderedCount: payload.renderedCount,
            renderedKeys: nextKeys,
            mediaControlCount: payload.mediaControlCount,
            hasZeroImagePlaceholder: payload.hasZeroImagePlaceholder
          }
        }
      };
    });
  }, []);

  const handleToggleProductSelection = useCallback((id) => {
    if (isLoadingData || isExecuting) return; 
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        return newStates;
      });
      return newIds;
    });
  }, [isLoadingData, isExecuting]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isLoadingData || isExecuting) return;
    setQueueIds(prev => {
      let newIds = [...prev];
      if (allFilteredSelected) {
        newIds = newIds.filter(id => !filteredProducts.find(p => p.id === id));
      } else {
        filteredProducts.forEach(p => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      }
      setProductStates(states => {
        const newStates = { ...states };
        newIds.forEach(id => { if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] }; });
        return newStates;
      });
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isLoadingData, isExecuting]);

  const clearBench = useCallback(() => {
    if (activePublishAbortRef.current) {
      try {
        activePublishAbortRef.current.abort();
      } catch {
        // Ignore abort errors on clearBench
      }
      activePublishAbortRef.current = null;
    }
    publishDedupMapRef.current.clear();
    baselineMetaByProductRef.current = {};
    prevMetafieldsRefByProduct.current = {};
    prevNativeTargetsRefByProduct.current = {};
    prevRepairCompletedAtByProduct.current = {};
    sendLiveBenchSelectionClear();

    if (pendingReferenceMatch) {
      const activeRel = pendingReferenceMatch;
      setReleasedReferenceMatchRequest({
        ...activeRel,
        releasedAt: new Date().toISOString(),
        clearedBench: true,
        fetcherWasBusy: referenceMatchFetcher.state !== "idle"
      });
      if (activeRel.requestId) {
        setReleasedReferenceMatchIds((prev) => ({
          ...prev,
          [activeRel.requestId]: {
            pieceId: activeRel.pieceId,
            snapshot: activeRel.snapshot,
            releasedAt: new Date().toISOString(),
            reason: "clear_bench"
          }
        }));
      }
    } else {
      setReleasedReferenceMatchRequest(null);
    }
    setQueueIds([]);
    setProductStates({});
    setManifestData({});
    setApprovals({});
    setManualEdits({});
    setSubmittedPayloads({});
    setRepairHistory({});
    setSelectedBenchId(null);
    setTelemetryPacket(null);
    setTelemetryPublishNotice(null);
    setSectionAuditMeasurements({ productId: null, bySection: {} });
    setExpandedBays(INITIAL_EXPANDED_BAYS);
    setIsLoadingData(false);
    setIsExecuting(false);
    setExecutionMode(null);
    setExecuteIndex(0);
    setAiStep(0);
    setAiData({});
    setStandardizedCandidatesByProduct({});
    setReferenceMatchResultsByProduct({});
    setReferenceMatchStatusByProduct({});
    setPendingReferenceMatch(null);
    setLoadIndex(0);
    setLastProcessedData(null);
    setPendingOperation(null);
    setSafetyMessage("Rack and Bench cleared. Repair history reset.");
    setSafetyError("");
  }, [pendingReferenceMatch, referenceMatchFetcher.state, sendLiveBenchSelectionClear]);

  const getStandardizedEvaluationForField = useCallback((productId, targetKey, dataOverride = null) => {
    if (!productId || typeof targetKey !== "string" || !targetKey.startsWith("shopify.")) return null;
    const data = dataOverride || manifestData[productId];
    const candidateBundle = buildCanonicalCandidateBundle(standardizedCandidatesByProduct[productId] || {});
    const rawRefMatchResult = referenceMatchResultsByProduct[productId] || null;
    const refMatchStatus = referenceMatchStatusByProduct[productId] || null;

    // Prevent an older completed match record from overriding a newer pending, failed, or cancelled attempt
    const readiness = evaluateProductReferenceMatchReadiness({
      productId,
      data,
      rawCandidates: standardizedCandidatesByProduct[productId] || {},
      refMatchResult: rawRefMatchResult,
      refMatchStatus,
      pendingReferenceMatch
    });
    const effectiveRefMatchResult =
      readiness.state === "pending" ||
      (readiness.state === "failed_or_incomplete" &&
        rawRefMatchResult &&
        refMatchStatus &&
        ((refMatchStatus.requestId &&
          rawRefMatchResult.requestId &&
          refMatchStatus.requestId !== rawRefMatchResult.requestId) ||
          (refMatchStatus.updatedAt &&
            rawRefMatchResult.matchedAt &&
            refMatchStatus.updatedAt > rawRefMatchResult.matchedAt)))
        ? null
        : rawRefMatchResult;

    return evaluateStandardizedDestinationTechnicalStatus({
      destinationKey: targetKey,
      productId,
      data,
      candidateBundle,
      refMatchResult: effectiveRefMatchResult,
      refMatchStatus
    });
  }, [
    manifestData,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    pendingReferenceMatch
  ]);

  const handleToggleApproval = useCallback((pieceId, key, propVal, isChecked) => {
    if (!pieceId || !isExactProductGid(pieceId) || !manifestData[pieceId]) return;
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    if (targetKey === "standardized_candidates" || targetKey === "custom.standardized_candidates" || targetKey === "native_image_alt") return;
    const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
    const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || resolveConfigFieldDestination(f) === key);

    if (isVerifiedStandardizedDestination(targetKey)) {
      const stdEval = getStandardizedEvaluationForField(pieceId, targetKey);
      const valCheck = validateProposedStandardizedGidList(propVal, stdEval);
      if (!valCheck.valid) return;
    } else if (
      matchedConfig?.mappingStatus === "pending_read_only" ||
      matchedConfig?.storageVerified === false ||
      matchedConfig?.writerVerified === false ||
      matchedConfig?.producerAlignmentPending === true ||
      matchedConfig?.owner === "variant_metafield" ||
      targetKey === "mm-google-shopping.custom_product"
    ) {
      return;
    }

    setApprovals(prev => {
      const next = { ...prev };
      if (!next[pieceId]) next[pieceId] = {};
      if (isChecked) {
        next[pieceId][targetKey] = propVal;
      } else {
        delete next[pieceId][targetKey];
      }
      return next;
    });
  }, [getStandardizedEvaluationForField, manifestData]);

  const handleReleasePendingReferenceMatch = useCallback(() => {
    if (!pendingReferenceMatch) {
      if (selectedBenchId) {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [selectedBenchId]: {
            state: "ready",
            tone: "info",
            message: "No active reference matching lock to release. Ready to match when supported Vision candidates exist.",
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return;
    }

    const released = pendingReferenceMatch;
    const nowIso = new Date().toISOString();
    setReleasedReferenceMatchRequest({
      ...released,
      releasedAt: nowIso,
      fetcherWasBusy: referenceMatchFetcher.state !== "idle"
    });
    if (released.requestId) {
      setReleasedReferenceMatchIds((prev) => ({
        ...prev,
        [released.requestId]: {
          pieceId: released.pieceId,
          snapshot: released.snapshot,
          source: released.source || "manual",
          workflowRunId: released.workflowRunId || null,
          releasedAt: nowIso,
          reason: "manual_release"
        }
      }));
    }
    setPendingReferenceMatch(null);

    const releaseMsg =
      referenceMatchFetcher.state !== "idle"
        ? `Released local pending lock for ${released.pieceId} (request ${released.requestId || "unknown"}) while fetcher is still [${referenceMatchFetcher.state}]. Any late response from that released request will be ignored. Wait for the fetcher to return to idle before starting another request.`
        : `Released stalled reference matching lock for ${released.pieceId} (request ${released.requestId || "unknown"}). Click 'Match Reference Choices' to retry.`;

    setReferenceMatchStatusByProduct((prev) => {
      const next = {
        ...prev,
        [released.pieceId]: {
          state: "cancelled",
          tone: "warning",
          requestId: released.requestId || null,
          snapshot: released.snapshot || null,
          source: released.source || "manual",
          workflowRunId: released.workflowRunId || null,
          message: releaseMsg,
          updatedAt: nowIso
        }
      };
      if (selectedBenchId && selectedBenchId !== released.pieceId) {
        next[selectedBenchId] = {
          state: "ready",
          tone: "info",
          message: `Released lock that was held by ${released.pieceId}. You can now click 'Match Reference Choices' for ${selectedBenchId}.`,
          updatedAt: nowIso
        };
      }
      return next;
    });
  }, [pendingReferenceMatch, referenceMatchFetcher.state, selectedBenchId]);

  const startReferenceMatchForProduct = useCallback((targetPieceId, options = {}) => {
    const cleanPieceId = typeof targetPieceId === "string" ? targetPieceId.trim() : "";
    const source = typeof options?.source === "string" && options.source.trim() !== "" ? options.source.trim() : "manual";
    const workflowRunId = typeof options?.workflowRunId === "string" && options.workflowRunId.trim() !== "" ? options.workflowRunId.trim() : null;

    if (!isExactProductGid(cleanPieceId)) {
      const invalidMsg = "Cannot match reference choices: A valid Shopify Product GID (gid://shopify/Product/...) is required.";
      if (source === "manual") {
        setSafetyError(
          !selectedBenchId
            ? "Cannot match reference choices: No product is selected on the bench. Select a product first."
            : invalidMsg
        );
      }
      return {
        started: false,
        reason: "invalid_product_id",
        requestId: null,
        snapshot: null,
        message: invalidMsg
      };
    }

    const rawProductCandidates =
      options?.candidatesOverride !== undefined && options?.candidatesOverride !== null
        ? options.candidatesOverride
        : (standardizedCandidatesByProduct[cleanPieceId] || {});
    const bundle = buildCanonicalCandidateBundle(rawProductCandidates);

    if (!bundle.hasSupported) {
      const noCandMsg =
        "Cannot match reference choices: No validated Vision standardized candidates exist for this product. Run 'Run AI (Single)' or 'EXECUTE AI AUTO-FILL (STAGE)' first so Vision stages candidate labels and evidence.";
      if (source === "manual") {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [cleanPieceId]: {
            state: "failed",
            tone: "warning",
            requestId: null,
            snapshot: bundle.snapshot,
            source,
            workflowRunId,
            message: noCandMsg,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return {
        started: false,
        reason: "no_candidates",
        requestId: null,
        snapshot: bundle.snapshot,
        message: noCandMsg
      };
    }

    if (pendingReferenceMatch !== null || referenceMatchFetcher.state !== "idle") {
      const lockedBy = pendingReferenceMatch?.pieceId || "an active fetcher request";
      const busyMsg = `Reference matching cannot start: Fetcher is currently [${referenceMatchFetcher.state}] and locked by [${lockedBy}]. Wait for completion, or click 'Release Stalled Match Lock' if the request is genuinely stuck.`;
      if (source === "manual") {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [cleanPieceId]: {
            state: pendingReferenceMatch?.pieceId === cleanPieceId ? "awaiting_response" : "failed",
            tone: "warning",
            requestId: pendingReferenceMatch?.pieceId === cleanPieceId ? (pendingReferenceMatch?.requestId || null) : null,
            snapshot: bundle.snapshot,
            source,
            workflowRunId,
            message: busyMsg,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return {
        started: false,
        reason: "busy",
        requestId: pendingReferenceMatch?.requestId || null,
        snapshot: bundle.snapshot,
        message: busyMsg
      };
    }

    const requestId =
      typeof options?.requestId === "string" && options.requestId.trim() !== ""
        ? options.requestId.trim()
        : `refmatch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const requestRecord = {
      requestId,
      pieceId: cleanPieceId,
      snapshot: bundle.snapshot,
      source,
      workflowRunId,
      baselineData: referenceMatchFetcher.data,
      sawNonIdle: false,
      startedAt: nowIso
    };

    setReleasedReferenceMatchRequest(null);
    setPendingReferenceMatch(requestRecord);
    setReferenceMatchStatusByProduct((prev) => ({
      ...prev,
      [cleanPieceId]: {
        state: "submitting",
        tone: "info",
        requestId,
        snapshot: bundle.snapshot,
        source,
        workflowRunId,
        message: `Submitting ${bundle.count} standardized candidate attribute(s) (${Object.keys(bundle.ordered).join(", ")}) for read-only reference matching (request ${requestId})...`,
        updatedAt: nowIso
      }
    }));

    try {
      const fd = new FormData();
      fd.append("intent", "resolveStandardizedCandidates");
      fd.append("pieceId", cleanPieceId);
      fd.append("standardized_candidates", bundle.snapshot);
      fd.append("requestId", requestId);

      referenceMatchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      return {
        started: true,
        reason: "submitted",
        requestId,
        snapshot: bundle.snapshot,
        message: `Submitted reference matching request ${requestId} for ${cleanPieceId}.`
      };
    } catch (err) {
      const errMsg = err?.message || String(err || "Unknown submission error");
      const failNow = new Date().toISOString();
      setPendingReferenceMatch((curr) => (curr === requestRecord ? null : curr));
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [cleanPieceId]: {
          state: "failed",
          tone: "critical",
          requestId,
          snapshot: bundle.snapshot,
          source,
          workflowRunId,
          message: `Failed to submit reference matching request (${requestId}): ${errMsg}. Check network/app connection and click 'Match Reference Choices' to retry.`,
          updatedAt: failNow
        }
      }));
      return {
        started: false,
        reason: "submit_error",
        requestId,
        snapshot: bundle.snapshot,
        message: errMsg
      };
    }
  }, [
    selectedBenchId,
    standardizedCandidatesByProduct,
    pendingReferenceMatch,
    referenceMatchFetcher
  ]);

  // Safe zero-argument adapter for the manual drawer button so a click event is never passed as targetPieceId
  const handleMatchReferenceChoices = useCallback(() => {
    if (!selectedBenchId || !manifestData[selectedBenchId]) {
      setSafetyError("Cannot match reference choices: No loaded product is selected on the bench. Load and select a product first.");
      return;
    }
    startReferenceMatchForProduct(selectedBenchId, { source: "manual", workflowRunId: null });
  }, [selectedBenchId, manifestData, startReferenceMatchForProduct]);

  useEffect(() => {
    const data = referenceMatchFetcher.data;

    // 1. If a released request finishes in the background, consume & ignore its late response so it cannot overwrite a later request.
    if (releasedReferenceMatchRequest) {
      if (referenceMatchFetcher.state !== "idle") {
        if (!releasedReferenceMatchRequest.sawNonIdle) {
          setReleasedReferenceMatchRequest((prev) => (prev ? { ...prev, sawNonIdle: true } : null));
        }
      } else {
        const dataChangedSinceReleaseStart = data !== releasedReferenceMatchRequest.baselineData;
        const matchesReleasedId =
          Boolean(data && typeof data === "object" && data.requestId && releasedReferenceMatchRequest.requestId) &&
          data.requestId === releasedReferenceMatchRequest.requestId;

        if (releasedReferenceMatchRequest.sawNonIdle || dataChangedSinceReleaseStart || matchesReleasedId) {
          const ignoredPieceId = releasedReferenceMatchRequest.pieceId;
          const ignoredReqId = releasedReferenceMatchRequest.requestId || null;
          const wasBenchCleared = Boolean(releasedReferenceMatchRequest.clearedBench);
          setReleasedReferenceMatchRequest(null);
          if (!pendingReferenceMatch && !wasBenchCleared && ignoredPieceId) {
            setReferenceMatchStatusByProduct((prev) => ({
              ...prev,
              [ignoredPieceId]: {
                state: "discarded_stale",
                tone: "warning",
                requestId: ignoredReqId,
                snapshot: releasedReferenceMatchRequest.snapshot || null,
                source: releasedReferenceMatchRequest.source || "manual",
                workflowRunId: releasedReferenceMatchRequest.workflowRunId || null,
                message: `Late response from previously released request${ignoredReqId ? ` (${ignoredReqId})` : ""} on ${ignoredPieceId} arrived and was safely ignored. Click 'Match Reference Choices' to run a fresh read-only match.`,
                updatedAt: new Date().toISOString()
              }
            }));
          }
          if (!pendingReferenceMatch) {
            return;
          }
        }
      }
    }

    if (!pendingReferenceMatch) return;

    // 2. Track transition into non-idle ("submitting" / "loading")
    if (referenceMatchFetcher.state !== "idle") {
      if (!pendingReferenceMatch.sawNonIdle) {
        setPendingReferenceMatch((prev) => (prev ? { ...prev, sawNonIdle: true } : null));
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [pendingReferenceMatch.pieceId]: {
            state: "awaiting_response",
            tone: "info",
            requestId: pendingReferenceMatch.requestId,
            snapshot: pendingReferenceMatch.snapshot,
            source: pendingReferenceMatch.source,
            workflowRunId: pendingReferenceMatch.workflowRunId,
            message: `Awaiting read-only reference matching response from Shopify for ${pendingReferenceMatch.pieceId} (request: ${pendingReferenceMatch.requestId}, fetcher state: ${referenceMatchFetcher.state})...`,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return;
    }

    // 3. Fetcher is idle. Ensure we do NOT consume old retained fetcher.data before the new submission actually completes.
    const hasCompletedCycle = pendingReferenceMatch.sawNonIdle || data !== pendingReferenceMatch.baselineData;
    if (!hasCompletedCycle) {
      return;
    }

    const activePending = pendingReferenceMatch;

    // 4. Guard against late responses belonging to a previously released/cancelled requestId
    if (data && typeof data === "object" && typeof data.requestId === "string" && releasedReferenceMatchIds[data.requestId]) {
      if (data.requestId !== activePending.requestId) {
        return;
      }
      setPendingReferenceMatch(null);
      return;
    }

    // 5. If fetcher completed a non-idle cycle without delivering a new payload, fail closed (do not infer success from idle)
    if (activePending.sawNonIdle && data === activePending.baselineData) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching request (${activePending.requestId}) for ${activePending.pieceId} returned to idle without delivering a response payload. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 6. Validate response structure before clearing or mutating state
    if (!data || typeof data !== "object") {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Malformed response received for ${activePending.pieceId} (request ${activePending.requestId}): Backend returned an empty or non-object payload. Existing diagnostics were preserved. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (data.intent !== "resolveStandardizedCandidates" || data.readOnly !== true) {
      setPendingReferenceMatch(null);
      const errDetail = data.error || data.message || `intent=${String(data.intent)}, readOnly=${String(data.readOnly)}`;
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Malformed or unexpected response contract for ${activePending.pieceId} (${errDetail}). Expected intent 'resolveStandardizedCandidates' with readOnly: true. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (!data.requestId || data.requestId !== activePending.requestId) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Request correlation mismatch for ${activePending.pieceId}: Expected requestId [${activePending.requestId}], but backend returned [${data.requestId || "None"}]. Response discarded to preserve strict request correlation. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (!data.pieceId || data.pieceId !== activePending.pieceId) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Product identity mismatch: Requested reference matching for [${activePending.pieceId}] (${activePending.requestId}), but backend returned pieceId [${data.pieceId || "None"}]. Response discarded to preserve product isolation. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 7. Response is proven to belong to activePending's exact requestId, product & completed cycle. Clear pending lock.
    setPendingReferenceMatch(null);

    const targetProductId = data.pieceId;
    const latestCandidates = standardizedCandidatesByProduct[targetProductId] || {};
    const currentBundle = buildCanonicalCandidateBundle(latestCandidates);
    const currentSnapshot = currentBundle.snapshot;

    if (currentSnapshot !== activePending.snapshot) {
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "discarded_stale",
          tone: "warning",
          requestId: activePending.requestId,
          snapshot: currentSnapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Discarded stale reference matching response (${activePending.requestId}) for ${targetProductId}: The product's Vision standardized candidates changed while the request was in flight. Click 'Match Reference Choices' to match the latest candidates.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    const rawResolutions = validObj(data.resolutions);
    const sanitizedResolutions = {};
    ALLOWED_VISION_CANDIDATE_KEYS.forEach((allowedKey) => {
      const fullKey = `shopify.${allowedKey}`;
      if (rawResolutions[fullKey] && typeof rawResolutions[fullKey] === "object") {
        sanitizedResolutions[fullKey] = rawResolutions[fullKey];
      } else if (rawResolutions[allowedKey] && typeof rawResolutions[allowedKey] === "object") {
        sanitizedResolutions[fullKey] = rawResolutions[allowedKey];
      }
    });

    const topErrors = formatErrorsList(data.errors || data.error);
    const resolutionCount = Object.keys(sanitizedResolutions).length;
    const isComplete = Boolean(data.isComplete);
    const isSuccess = Boolean(data.success);
    const returnedProductCategory =
      data.productCategory && typeof data.productCategory === "object"
        ? data.productCategory
        : null;
    const returnedCategoryEligibility = validObj(data.categoryEligibility);
    const matchedAtIso = new Date().toISOString();

    const matchRecord = {
      requestId: activePending.requestId,
      pieceId: targetProductId,
      intent: data.intent,
      readOnly: true,
      success: isSuccess,
      isComplete: isComplete,
      productCategory: returnedProductCategory,
      categoryEligibility: returnedCategoryEligibility,
      resolutions: sanitizedResolutions,
      currentReferenceLists: validObj(data.currentReferenceLists),
      errors: topErrors,
      snapshot: activePending.snapshot,
      source: activePending.source,
      workflowRunId: activePending.workflowRunId,
      matchedAt: matchedAtIso
    };

    const readinessCheck = evaluateProductReferenceMatchReadiness({
      productId: targetProductId,
      data: manifestData[targetProductId] || null,
      rawCandidates: latestCandidates,
      refMatchResult: matchRecord,
      refMatchStatus: null,
      pendingReferenceMatch: null,
      expectedRequestId: activePending.requestId
    });

    const isFullyCompleteMatch = readinessCheck.state === "matched_complete";
    const isCleanCompleteOutcome = isFullyCompleteMatch && isComplete && isSuccess && topErrors.length === 0;

    setReferenceMatchResultsByProduct((prev) => ({
      ...prev,
      [targetProductId]: matchRecord
    }));

    let eligibleProposalCount = 0;
    const categoryBlockedDestinations = [];

    VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
      const resEntry = sanitizedResolutions[destKey];
      if (!resEntry) return;
      if (resEntry.isCategoryEligible === false || resEntry.status === "category_ineligible") {
        categoryBlockedDestinations.push(destKey);
      } else if (resEntry.isCategoryEligible === true && resEntry.isComplete === true) {
        eligibleProposalCount++;
      }
    });

    // Stage technically verified proposals into manifestData.repairPlan for the 6 standardized destinations
    // and record diagnostics.stage = "resolveStandardizedCandidates" for accepted matching outcomes
    setManifestData((prevMan) => {
      const existingMan = prevMan[targetProductId];
      if (!existingMan) return prevMan;

      const updatedRepairPlan = { ...(existingMan.repairPlan || {}) };
      const updatedMetadata = { ...(existingMan.metadata || {}) };
      const existingDiag = existingMan.diagnostics || {};

      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (manualEdits[targetProductId]?.[destKey] === true) return;

        const evalRes = evaluateStandardizedDestinationTechnicalStatus({
          destinationKey: destKey,
          productId: targetProductId,
          data: existingMan,
          candidateBundle: currentBundle,
          refMatchResult: matchRecord,
          refMatchStatus: { state: isFullyCompleteMatch ? "completed" : "incomplete" }
        });

        if (evalRes.isTechnicallyEligible && evalRes.autoProposalSerialized) {
          updatedRepairPlan[destKey] = evalRes.autoProposalSerialized;
          updatedMetadata[destKey] = {
            source: "Vision",
            stage: "resolveStandardizedCandidates"
          };
        } else {
          delete updatedRepairPlan[destKey];
        }
      });

      const outcomeDiagError = isCleanCompleteOutcome
        ? null
        : (topErrors[0] || readinessCheck.reason || existingDiag.error || null);

      const updatedDiagnostics = {
        ...existingDiag,
        shopifyRead: isCleanCompleteOutcome
          ? (existingDiag.shopifyRead || "Success")
          : (existingDiag.shopifyRead || "Failed"),
        stage: "resolveStandardizedCandidates",
        error: outcomeDiagError,
        errors: isCleanCompleteOutcome
          ? validArray(existingDiag.errors)
          : (topErrors.length > 0 ? topErrors : validArray(existingDiag.errors))
      };

      return {
        ...prevMan,
        [targetProductId]: {
          ...existingMan,
          productCategory: returnedProductCategory || existingMan.productCategory || null,
          repairPlan: updatedRepairPlan,
          metadata: updatedMetadata,
          diagnostics: updatedDiagnostics
        }
      };
    });

    // Clear any prior approvals on standardized destinations that no longer match
    setApprovals((prevApp) => {
      if (!prevApp[targetProductId]) return prevApp;
      const nextProdApp = { ...prevApp[targetProductId] };
      let changed = false;
      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (nextProdApp[destKey] !== undefined) {
          delete nextProdApp[destKey];
          changed = true;
        }
      });
      if (!changed) return prevApp;
      return { ...prevApp, [targetProductId]: nextProdApp };
    });

    if (isCleanCompleteOutcome) {
      const blockedDestList = readinessCheck.blockedDestinationKeys || [];
      let detailSummary = " Technically verified and category-eligible proposals are staged for review and exact-value approval below.";
      if (categoryBlockedDestinations.length > 0 || blockedDestList.length > 0) {
        const blockedDisplay = blockedDestList.length > 0 ? blockedDestList : categoryBlockedDestinations;
        detailSummary = ` ${readinessCheck.eligibleDestinationKeys.length} proposal(s) unlocked; ${blockedDisplay.length} blocked by category or entry resolution (${blockedDisplay.join(", ")} â€” candidate evidence and matched entries preserved).`;
      }
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "completed",
          tone: "success",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching completed for ${resolutionCount} attribute(s).${detailSummary}`,
          updatedAt: matchedAtIso
        }
      }));
    } else {
      const incReason =
        !isFullyCompleteMatch && readinessCheck.reason
          ? ` ${readinessCheck.reason}`
          : "";
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "incomplete",
          tone: "warning",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching returned partial/incomplete read diagnostics (success: ${String(isSuccess)}, isComplete: ${String(isComplete)}, ${resolutionCount} attribute resolution(s), ${topErrors.length} top-level error(s)).${incReason} Incomplete enumeration remains blocked and is never treated as missing_entry or save-ready. Review read errors/continuation below or click 'Match Reference Choices' to retry.`,
          updatedAt: matchedAtIso
        }
      }));
    }
  }, [
    referenceMatchFetcher.state,
    referenceMatchFetcher.data,
    pendingReferenceMatch,
    releasedReferenceMatchRequest,
    releasedReferenceMatchIds,
    standardizedCandidatesByProduct,
    manifestData,
    manualEdits
  ]);

  const getFieldMetadata = (key, data, productId, currentApprovals, configFields = []) =>
    evaluateFieldMetadata({
      key,
      data,
      productId,
      currentApprovals,
      configFields,
      standardizedCandidatesByProduct,
      getStandardizedEvaluationForField
    });

  const {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  } = useMetaInjectorExecution({
    safeProducts,
    batchFetcher,
    referenceMatchFetcher,
    queueIds,
    selectedBenchId,
    isLoadingData,
    setIsLoadingData,
    loadIndex,
    setLoadIndex,
    isExecuting,
    setIsExecuting,
    executionMode,
    setExecutionMode,
    executeIndex,
    setExecuteIndex,
    aiStep,
    setAiStep,
    pendingOperation,
    setPendingOperation,
    aiData,
    setAiData,
    standardizedCandidatesByProduct,
    setStandardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    setReferenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    setReferenceMatchStatusByProduct,
    pendingReferenceMatch,
    startReferenceMatchForProduct,
    manifestData,
    setManifestData,
    lastProcessedData,
    setLastProcessedData,
    approvals,
    setApprovals,
    manualEdits,
    setManualEdits,
    setSubmittedPayloads,
    setRepairHistory,
    setSafetyMessage,
    setSafetyError,
    updateProductState,
    getStandardizedEvaluationForField,
    getFieldMetadata
  });

  const handleRepairPlanChange = (key, value) => {
    if (!selectedBenchId || !isExactProductGid(selectedBenchId) || !manifestData[selectedBenchId]) return;
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    if (targetKey === "standardized_candidates" || targetKey === "custom.standardized_candidates" || targetKey === "native_image_alt") return;
    const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
    const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || resolveConfigFieldDestination(f) === key);

    if (isVerifiedStandardizedDestination(targetKey)) {
      const stdEval = getStandardizedEvaluationForField(selectedBenchId, targetKey);
      const valCheck = validateProposedStandardizedGidList(value, stdEval);
      if (!valCheck.valid) return;
    } else if (
      matchedConfig?.mappingStatus === "pending_read_only" ||
      matchedConfig?.storageVerified === false ||
      matchedConfig?.writerVerified === false ||
      matchedConfig?.producerAlignmentPending === true ||
      matchedConfig?.owner === "variant_metafield" ||
      targetKey === "mm-google-shopping.custom_product"
    ) {
      return;
    }
    
    setManualEdits(prev => {
        const next = { ...prev };
        if (!next[selectedBenchId]) next[selectedBenchId] = {};
        next[selectedBenchId][targetKey] = true;
        return next;
    });
    
    setApprovals(prev => {
        if (prev[selectedBenchId] && prev[selectedBenchId][targetKey] !== undefined) {
            const next = { ...prev };
            delete next[selectedBenchId][targetKey];
            return next;
        }
        return prev;
    });

    setManifestData(prev => ({
       ...prev,
       [selectedBenchId]: {
          ...prev[selectedBenchId],
          repairPlan: {
             ...prev[selectedBenchId].repairPlan,
             [targetKey]: value
          }
       }
    }));
  };

  const handleStandardizedEntrySelectionChange = (destinationKey, currentPropVal, stdEval, replaceOrAddGid, previousSlotGid = null) => {
    if (!selectedBenchId || !manifestData[selectedBenchId] || !stdEval?.isTechnicallyEligible) return;
    if (!isExactMetaobjectGid(replaceOrAddGid) || !stdEval.verifiedEntriesMap.has(replaceOrAddGid)) return;

    const currentProposedList = parseMetaobjectGidArray(currentPropVal || stdEval.autoProposalSerialized);
    const existingSet = new Set(stdEval.existingGids || []);

    let updatedGids = [...stdEval.existingGids];
    currentProposedList.forEach((gid) => {
      if (existingSet.has(gid)) return;
      if (previousSlotGid && gid === previousSlotGid) {
        if (!updatedGids.includes(replaceOrAddGid)) {
          updatedGids.push(replaceOrAddGid);
        }
      } else if (!updatedGids.includes(gid)) {
        updatedGids.push(gid);
      }
    });

    if (!updatedGids.includes(replaceOrAddGid)) {
      updatedGids.push(replaceOrAddGid);
    }

    const serialized = JSON.stringify(updatedGids);
    handleRepairPlanChange(destinationKey, serialized);
  };

  const handleToggleVerifiedStandardizedEntry = (destinationKey, currentPropVal, stdEval, targetGid, shouldInclude) => {
    if (!selectedBenchId || !manifestData[selectedBenchId] || !stdEval?.isTechnicallyEligible) return;
    if (!isExactMetaobjectGid(targetGid) || !stdEval.verifiedEntriesMap.has(targetGid)) return;

    const existingSet = new Set(stdEval.existingGids || []);
    // Never allow removing an already-assigned entry
    if (!shouldInclude && existingSet.has(targetGid)) return;

    const currentProposedList = parseMetaobjectGidArray(currentPropVal || stdEval.autoProposalSerialized);
    let nextGids = [...stdEval.existingGids];

    currentProposedList.forEach((gid) => {
      if (!shouldInclude && gid === targetGid) return;
      if (!nextGids.includes(gid) && (existingSet.has(gid) || stdEval.verifiedEntriesMap.has(gid))) {
        nextGids.push(gid);
      }
    });

    if (shouldInclude && !nextGids.includes(targetGid)) {
      nextGids.push(targetGid);
    }

    if (nextGids.length === 0) return;
    handleRepairPlanChange(destinationKey, JSON.stringify(nextGids));
  };

  const matchesFilter = useCallback((m) => {
    if (DEV_SHOW_ALL_TEMPLATE_FIELDS) return true;
    if (activeFilter === "All") return true;
    if (activeFilter === "Blank" && (m.fieldStatus === "Optional blank" || m.fieldStatus === "Required missing")) return true;
    if (activeFilter === "Proposed changes" && (m.fieldStatus === "Proposed" || m.fieldStatus === "Approved, not saved" || m.fieldStatus === "Approved, blocked" || m.fieldStatus === "Pre-approved, not saved" || m.fieldStatus === "Pre-approved, blocked")) return true;
    if (activeFilter === "Conflicts" && (m.fieldStatus === "Conflict" || m.fieldStatus === "Degrade" || m.fieldStatus === "Save Conflict")) return true;
    if (activeFilter === "Needs review" && (m.fieldStatus === "Required missing" || m.fieldStatus === "Unverified proposal" || (m.contentNeedsReview && !m.isApproved && !m.isContentPreApproved) || m.fieldStatus === "API Error / Blocked")) return true;
    if (activeFilter === m.source) return true;
    return false;
  }, [activeFilter]);

  const getSystemStatus = () =>
    computeSystemStatus({
      data: manifestData[selectedBenchId],
      selectedBenchId,
      isLoadingData,
      isExecuting,
      executionMode,
      queueIds,
      loadIndex,
      executeIndex,
      aiStep,
      batchFetcherState: batchFetcher.state,
      batchFetcherFormData: batchFetcher.formData,
      referenceMatchFetcherState: referenceMatchFetcher.state,
      pendingReferenceMatch,
      referenceMatchStatusByProduct,
      safetyMessage,
      safetyError
    });

  const getDiagnosticsStats = (data) =>
    computeDiagnosticsStats({
      data,
      selectedBenchId,
      approvals,
      getFieldMetadata
    });

  // Automatic debounced live-bench-state synchronization (publishes both loaded and selected-unloaded states; surfaces non-aborted errors)
  const activeProductDataForLiveSync = selectedBenchId ? manifestData[selectedBenchId] : null;
  const activeProductApprovalsForLiveSync = selectedBenchId ? approvals[selectedBenchId] : null;
  const activeProductManualEditsForLiveSync = selectedBenchId ? manualEdits[selectedBenchId] : null;
  const activeProductHistoryForLiveSync = selectedBenchId ? repairHistory[selectedBenchId] : null;
  const activeProductSubmittedForLiveSync = selectedBenchId ? submittedPayloads[selectedBenchId] : null;
  const activeProductCandidatesForLiveSync = selectedBenchId ? standardizedCandidatesByProduct[selectedBenchId] : null;
  const activeProductRefMatchForLiveSync = selectedBenchId ? referenceMatchResultsByProduct[selectedBenchId] : null;
  const activeProductRefStatusForLiveSync = selectedBenchId ? referenceMatchStatusByProduct[selectedBenchId] : null;
  const activeProductQueueStateStatus = selectedBenchId ? (productStates[selectedBenchId]?.status || null) : null;
  const activeMeasurementsForLiveSync =
    sectionAuditMeasurements.productId === selectedBenchId
      ? sectionAuditMeasurements
      : null;

  useEffect(() => {
    if (!selectedBenchId || !isExactProductGid(selectedBenchId)) {
      if (!lastNotifiedSelectionClearRef.current) {
        sendLiveBenchSelectionClear();
      }
      return;
    }

    if (isLoadingData) {
      return;
    }

    const isManifestLoadedForSelected = Boolean(activeProductDataForLiveSync);
    const measuredUiAudit = isManifestLoadedForSelected
      ? buildMeasuredUiAuditSnapshot(selectedBenchId, activeMeasurementsForLiveSync)
      : null;

    const contentChangeDigest = computeQuickTextDigest(
      JSON.stringify({
        productId: selectedBenchId,
        manifestLoaded: isManifestLoadedForSelected,
        queueStatus: activeProductQueueStateStatus,
        currentMetafields: activeProductDataForLiveSync?.currentMetafields || null,
        nativeTargets: activeProductDataForLiveSync?.nativeTargets || null,
        repairPlan: activeProductDataForLiveSync?.repairPlan || null,
        metadata: activeProductDataForLiveSync?.metadata || null,
        diagnostics: activeProductDataForLiveSync?.diagnostics || null,
        approvals: activeProductApprovalsForLiveSync || null,
        manualEdits: activeProductManualEditsForLiveSync || null,
        historyCompletedAt: activeProductHistoryForLiveSync?.completedAt || null,
        historyStatus: activeProductHistoryForLiveSync?.status || null,
        submitted: activeProductSubmittedForLiveSync || null,
        candidates: activeProductCandidatesForLiveSync || null,
        refMatchAt: activeProductRefMatchForLiveSync?.matchedAt || null,
        refStatusAt: activeProductRefStatusForLiveSync?.updatedAt || null,
        refStatusState: activeProductRefStatusForLiveSync?.state || null,
        uiAudit: measuredUiAudit
      })
    );

    // If working state and measurements have not changed and are already synced, do nothing
    if (
      contentChangeDigest === lastLiveStateDigestRef.current &&
      contentChangeDigest === lastLiveSyncedDigestRef.current
    ) {
      return;
    }

    let stateRevision = lastLiveStateRevisionRef.current;
    let clientStateChangedAt = lastLiveStateChangedAtRef.current;

    if (contentChangeDigest !== lastLiveStateDigestRef.current || !clientStateChangedAt || stateRevision < 1) {
      stateRevision = nextBenchRevision();
      clientStateChangedAt = new Date().toISOString();
      lastLiveStateDigestRef.current = contentChangeDigest;
      lastLiveStateRevisionRef.current = stateRevision;
      lastLiveStateChangedAtRef.current = clientStateChangedAt;
      lastNotifiedSelectionClearRef.current = false;
    }

    const currentSessionId = benchSessionIdRef.current;
    const candidateBaselineLoadedAt = isManifestLoadedForSelected
      ? (baselineMetaByProductRef.current[selectedBenchId]?.loadedAt || null)
      : null;

    setLiveBenchSyncStatus({
      lifecycle: "pending",
      benchSessionId: currentSessionId,
      benchRevision: stateRevision,
      selectionState: "selected",
      productId: selectedBenchId,
      reportId: null,
      clientStateChangedAt,
      baselineLoadedAt: candidateBaselineLoadedAt,
      serverReceivedAt: null,
      errorCode: null,
      errorMessage: null
    });

    if (liveSyncDebounceTimerRef.current) {
      clearTimeout(liveSyncDebounceTimerRef.current);
      liveSyncDebounceTimerRef.current = null;
    }

    const targetProductId = selectedBenchId;
    const targetRevision = stateRevision;
    const targetChangedAt = clientStateChangedAt;
    const targetDigest = contentChangeDigest;

    liveSyncDebounceTimerRef.current = setTimeout(() => {
      liveSyncDebounceTimerRef.current = null;
      if (
        activeBenchIdRef.current !== targetProductId ||
        benchSessionIdRef.current !== currentSessionId ||
        benchRevisionRef.current !== targetRevision
      ) {
        return;
      }

      const productRecord = safeProducts.find((p) => p.id === targetProductId) || {};
      const productTitle =
        productRecord.title ||
        activeProductDataForLiveSync?.nativeTargets?.productTitle ||
        "Not recorded";

      let packet;
      let liveState;
      let latestUiAudit = null;
      let effectiveBaselineLoadedAt = null;

      if (activeProductDataForLiveSync) {
        const baselineInfo = baselineMetaByProductRef.current[targetProductId] || null;
        const baselineLoadedAt = baselineInfo?.loadedAt || null;
        const baselineEventKind = baselineInfo?.eventKind || "last_loaded_manifest";
        effectiveBaselineLoadedAt = baselineLoadedAt;

        const built = buildPureLiveBenchPayload({
          benchSessionId: currentSessionId,
          benchRevision: targetRevision,
          clientStateChangedAt: targetChangedAt,
          baselineLoadedAt,
          baselineEventKind,
          productId: targetProductId,
          productTitle,
          data: activeProductDataForLiveSync,
          approvals,
          manualEdits,
          repairHistory,
          submittedPayloads,
          standardizedCandidatesByProduct,
          referenceMatchResultsByProduct,
          referenceMatchStatusByProduct,
          pendingReferenceMatch,
          getFieldMetadata,
          getSystemStatus,
          getDiagnosticsStats
        });
        packet = built.packet;
        liveState = built.liveState;
        latestUiAudit = buildMeasuredUiAuditSnapshot(
          targetProductId,
          sectionAuditMeasurementsRef.current
        );
      } else {
        const builtUnloaded = buildSelectedUnloadedLiveBenchPayload({
          benchSessionId: currentSessionId,
          benchRevision: targetRevision,
          clientStateChangedAt: targetChangedAt,
          productId: targetProductId,
          productTitle,
          productQueueStatus: activeProductQueueStateStatus
        });
        packet = builtUnloaded.packet;
        liveState = builtUnloaded.liveState;
        latestUiAudit = null;
        effectiveBaselineLoadedAt = null;
      }

      const postBody =
        latestUiAudit !== null
          ? { packet, liveState, uiAudit: latestUiAudit }
          : { packet, liveState };

      if (liveSyncAbortRef.current) {
        try {
          liveSyncAbortRef.current.abort();
        } catch {
          // Ignore superseding abort
        }
        liveSyncAbortRef.current = null;
      }

      const controller = new AbortController();
      liveSyncAbortRef.current = controller;
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Ignore timeout abort
        }
      }, TELEMETRY_PUBLISH_TIMEOUT_MS);

      (async () => {
        try {
          const response = await fetch(TELEMETRY_PUBLISH_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify(postBody),
            signal: controller.signal
          });

          const rawText = await response.text();
          let parsed = null;
          if (rawText && rawText.trim().length > 0) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
          }

          if (
            activeBenchIdRef.current !== targetProductId ||
            benchSessionIdRef.current !== currentSessionId ||
            benchRevisionRef.current !== targetRevision
          ) {
            return;
          }

          const returnedReport =
            parsed && typeof parsed === "object" && parsed.report && typeof parsed.report === "object"
              ? parsed.report
              : null;
          const returnedSession =
            parsed && typeof parsed === "object" && parsed.liveSession && typeof parsed.liveSession === "object"
              ? parsed.liveSession
              : null;

          if (
            response.ok &&
            parsed &&
            parsed.ok === true &&
            parsed.status === "stored" &&
            returnedReport &&
            typeof returnedReport.reportId === "string" &&
            returnedReport.reportId.trim().length > 0 &&
            returnedReport.productId === targetProductId &&
            returnedReport.benchSessionId === currentSessionId &&
            returnedReport.benchRevision === targetRevision &&
            returnedReport.selectionState === "selected"
          ) {
            lastLiveSyncedDigestRef.current = targetDigest;
            setLiveBenchSyncStatus({
              lifecycle: "acknowledged",
              benchSessionId: returnedReport.benchSessionId,
              benchRevision: returnedReport.benchRevision,
              selectionState: returnedReport.selectionState,
              productId: returnedReport.productId,
              reportId: returnedReport.reportId.trim(),
              clientStateChangedAt:
                typeof returnedReport.clientStateChangedAt === "string"
                  ? returnedReport.clientStateChangedAt
                  : (typeof returnedReport.capturedAt === "string" ? returnedReport.capturedAt : targetChangedAt),
              baselineLoadedAt:
                typeof returnedReport.baselineLoadedAt === "string"
                  ? returnedReport.baselineLoadedAt
                  : effectiveBaselineLoadedAt,
              serverReceivedAt:
                typeof returnedReport.serverReceivedAt === "string"
                  ? returnedReport.serverReceivedAt
                  : (typeof returnedReport.storedAt === "string"
                      ? returnedReport.storedAt
                      : (typeof returnedSession?.serverReceivedAt === "string" ? returnedSession.serverReceivedAt : null)),
              errorCode: null,
              errorMessage: null
            });
            setTelemetryPublishNotice((prev) =>
              prev && prev.source === "live_sync_error" ? null : prev
            );
            return;
          }

          if (
            parsed &&
            parsed.code === "stale_bench_revision" &&
            typeof parsed.highestRevision === "number" &&
            Number.isSafeInteger(parsed.highestRevision) &&
            parsed.highestRevision > benchRevisionRef.current
          ) {
            benchRevisionRef.current = parsed.highestRevision;
            setLiveBenchSyncStatus({
              lifecycle: "error",
              benchSessionId: currentSessionId,
              benchRevision: targetRevision,
              selectionState: "selected",
              productId: targetProductId,
              reportId: null,
              clientStateChangedAt: targetChangedAt,
              baselineLoadedAt: effectiveBaselineLoadedAt,
              serverReceivedAt: null,
              errorCode: "stale_bench_revision",
              errorMessage: sanitizeSafePublishMessage(
                parsed?.message,
                `Revision ${targetRevision} superseded by server high-water revision ${parsed.highestRevision}.`
              )
            });
            return;
          }

          const backendCode =
            parsed && typeof parsed.code === "string" && parsed.code.trim()
              ? parsed.code.trim()
              : `http_${response.status}`;
          const backendMsg = sanitizeSafePublishMessage(
            parsed?.message,
            `Sidekick live bench sync rejected (HTTP ${response.status}).`
          );

          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: currentSessionId,
            benchRevision: targetRevision,
            selectionState: "selected",
            productId: targetProductId,
            reportId: null,
            clientStateChangedAt: targetChangedAt,
            baselineLoadedAt: effectiveBaselineLoadedAt,
            serverReceivedAt: null,
            errorCode: backendCode,
            errorMessage: backendMsg
          });
          setTelemetryPublishNotice({
            source: "live_sync_error",
            productId: targetProductId,
            capturedAt: targetChangedAt,
            tone: "warning",
            message: `Sidekick live bench sync failed (${backendCode}): ${backendMsg}`
          });
        } catch {
          if (!timedOut && controller.signal.aborted) {
            return;
          }
          if (
            activeBenchIdRef.current !== targetProductId ||
            benchSessionIdRef.current !== currentSessionId ||
            benchRevisionRef.current !== targetRevision
          ) {
            return;
          }
          const errCode = timedOut ? "request_timeout" : "network_error";
          const errDetail = timedOut
            ? `Request timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
            : "Network or authentication error while contacting /api/meta-injector-telemetry.";
          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: currentSessionId,
            benchRevision: targetRevision,
            selectionState: "selected",
            productId: targetProductId,
            reportId: null,
            clientStateChangedAt: targetChangedAt,
            baselineLoadedAt: effectiveBaselineLoadedAt,
            serverReceivedAt: null,
            errorCode: errCode,
            errorMessage: errDetail
          });
          setTelemetryPublishNotice({
            source: "live_sync_error",
            productId: targetProductId,
            capturedAt: targetChangedAt,
            tone: "warning",
            message: `Sidekick live bench sync failed: ${errDetail}`
          });
        } finally {
          clearTimeout(timeoutId);
          if (liveSyncAbortRef.current === controller) {
            liveSyncAbortRef.current = null;
          }
        }
      })();
    }, LIVE_BENCH_SYNC_DEBOUNCE_MS);

    return () => {
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
    };
  }, [
    selectedBenchId,
    isLoadingData,
    activeProductQueueStateStatus,
    activeProductDataForLiveSync,
    activeProductApprovalsForLiveSync,
    activeProductManualEditsForLiveSync,
    activeProductHistoryForLiveSync,
    activeProductSubmittedForLiveSync,
    activeProductCandidatesForLiveSync,
    activeProductRefMatchForLiveSync,
    activeProductRefStatusForLiveSync,
    activeMeasurementsForLiveSync,
    nextBenchRevision,
    sendLiveBenchSelectionClear
  ]);

  const publishCapturedPacketToSidekickCache = useCallback((capturedPacket, expectedProductId) => {
    if (!expectedProductId || activeBenchIdRef.current !== expectedProductId) {
      return;
    }
    if (!isValidTelemetryPacketForProduct(capturedPacket, expectedProductId)) {
      return;
    }

    const captureSignature = buildImmutableCaptureSignature(capturedPacket);
    if (!captureSignature) {
      return;
    }

    const dedupMap = publishDedupMapRef.current;
    const existingStatus = dedupMap.get(captureSignature);
    if (existingStatus === "inflight" || existingStatus === "stored") {
      return;
    }

    if (dedupMap.size >= MAX_PUBLISHED_CAPTURE_SIGNATURES) {
      for (const [k, v] of dedupMap.entries()) {
        if (v !== "inflight") {
          dedupMap.delete(k);
          if (dedupMap.size < MAX_PUBLISHED_CAPTURE_SIGNATURES) {
            break;
          }
        }
      }
      if (dedupMap.size >= MAX_PUBLISHED_CAPTURE_SIGNATURES) {
        const oldestKey = dedupMap.keys().next().value;
        if (oldestKey !== undefined) {
          dedupMap.delete(oldestKey);
        }
      }
    }

    dedupMap.set(captureSignature, "inflight");

    const measuredUiAudit = buildMeasuredUiAuditSnapshot(
      expectedProductId,
      sectionAuditMeasurementsRef.current
    );

    const requestBody = measuredUiAudit !== null
      ? { packet: capturedPacket, uiAudit: measuredUiAudit }
      : { packet: capturedPacket };

    if (activePublishAbortRef.current) {
      try {
        activePublishAbortRef.current.abort();
      } catch {
        // Ignore abort error on superseding manual capture
      }
      activePublishAbortRef.current = null;
    }

    const controller = new AbortController();
    activePublishAbortRef.current = controller;
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      try {
        controller.abort();
      } catch {
        // Ignore timeout abort error
      }
    }, TELEMETRY_PUBLISH_TIMEOUT_MS);

    if (activeBenchIdRef.current === expectedProductId) {
      setTelemetryPublishNotice({
        source: "manual_capture",
        productId: expectedProductId,
        capturedAt: capturedPacket.capturedAt || null,
        tone: "info",
        message: "Publishing captured telemetry report to temporary Sidekick memory cache..."
      });
    }

    (async () => {
      try {
        const response = await fetch(TELEMETRY_PUBLISH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        const rawText = await response.text();
        let parsed = null;
        if (rawText && rawText.trim().length > 0) {
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = null;
          }
        }

        const returnedReport =
          parsed && typeof parsed === "object" && parsed.report && typeof parsed.report === "object"
            ? parsed.report
            : null;

        const isVerifiedStored = Boolean(
          response.ok &&
          parsed &&
          parsed.ok === true &&
          parsed.status === "stored" &&
          returnedReport &&
          typeof returnedReport.reportId === "string" &&
          returnedReport.reportId.trim().length > 0 &&
          returnedReport.productId === capturedPacket.productId &&
          returnedReport.capturedAt === capturedPacket.capturedAt
        );

        if (isVerifiedStored) {
          dedupMap.set(captureSignature, "stored");
          if (activeBenchIdRef.current === expectedProductId) {
            const confirmedReportId = returnedReport.reportId.trim();
            const auditStateLabel =
              returnedReport.uiAuditState === "measured"
                ? "measured"
                : "not_measured";
            setTelemetryPublishNotice({
              source: "manual_capture",
              productId: expectedProductId,
              capturedAt: returnedReport.capturedAt,
              reportId: confirmedReportId,
              tone: "success",
              message: `Sidekick report published (${confirmedReportId}) for ${returnedReport.productId} at ${returnedReport.capturedAt} [UI audit: ${auditStateLabel}].`
            });
          }
          return;
        }

        dedupMap.delete(captureSignature);
        if (activeBenchIdRef.current === expectedProductId) {
          const backendCode =
            parsed && typeof parsed.code === "string" && parsed.code.trim()
              ? parsed.code.trim()
              : `http_${response.status}`;
          const backendMessage = sanitizeSafePublishMessage(
            parsed?.message,
            `Telemetry cache endpoint rejected publication (HTTP ${response.status}).`
          );
          setTelemetryPublishNotice({
            source: "manual_capture",
            productId: expectedProductId,
            capturedAt: capturedPacket.capturedAt || null,
            tone: "warning",
            message: `Local capture succeeded, but Sidekick report cache publication failed (${backendCode}): ${backendMessage}`
          });
        }
      } catch (err) {
        dedupMap.delete(captureSignature);
        if (!timedOut && controller.signal.aborted) {
          return;
        }
        if (activeBenchIdRef.current === expectedProductId) {
          const errSummary = timedOut
            ? `Request timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
            : "Network or authentication error while contacting /api/meta-injector-telemetry.";
          setTelemetryPublishNotice({
            source: "manual_capture",
            productId: expectedProductId,
            capturedAt: capturedPacket.capturedAt || null,
            tone: "warning",
            message: `Local capture succeeded, but Sidekick report cache publication failed: ${errSummary}`
          });
        }
      } finally {
        clearTimeout(timeoutId);
        if (activePublishAbortRef.current === controller) {
          activePublishAbortRef.current = null;
        }
      }
    })();
  }, []);

  const handleCollectTelemetry = useCallback((modeArg = "full", rawOptions = {}) => {
    const cleanMode = typeof modeArg === "string" && modeArg.trim() !== "" ? modeArg.trim() : "full";
    const safeOptions = validObj(rawOptions);
    const captureBenchId = selectedBenchId;

    if (!captureBenchId || !manifestData?.[captureBenchId]) {
      setTelemetryPacket(null);
      setSafetyError("Cannot capture telemetry: No active bench item is loaded.");
      return null;
    }

    const hasExplicitPartRequest = Boolean(
      safeOptions.partIndex !== undefined &&
      safeOptions.existingPacket &&
      isValidTelemetryPacketForProduct(safeOptions.existingPacket, captureBenchId)
    );
    const isFreshManualCapture = !hasExplicitPartRequest && !safeOptions.existingPacket;

    const commitCapturedPacket = (candidatePacket) => {
      if (!candidatePacket) return;
      // Guard against a late callback from a previous product overwriting the current bench product's packet
      if (activeBenchIdRef.current !== captureBenchId) return;
      if (!isValidTelemetryPacketForProduct(candidatePacket, captureBenchId)) return;
      setTelemetryPacket(candidatePacket);
      if (isFreshManualCapture) {
        publishCapturedPacketToSidekickCache(candidatePacket, captureBenchId);
      }
    };

    try {
      const maybeResult = buildAndCopyMatrixTelemetry({
        mode: cleanMode,
        options: safeOptions,
        sectionTitle: safeOptions.sectionTitle,
        partIndex: hasExplicitPartRequest ? safeOptions.partIndex : undefined,
        existingPacket: hasExplicitPartRequest ? safeOptions.existingPacket : undefined,
        onTelemetryPacketReady: commitCapturedPacket,
        selectedBenchId: captureBenchId,
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
      });

      if (maybeResult && typeof maybeResult.then === "function") {
        maybeResult
          .then((resolvedPacket) => {
            if (resolvedPacket) {
              commitCapturedPacket(resolvedPacket);
            }
          })
          .catch((err) => {
            setSafetyError(`Failed to capture telemetry report: ${err?.message || "Unknown telemetry error"}`);
          });
        return maybeResult;
      }

      if (maybeResult && isValidTelemetryPacketForProduct(maybeResult, captureBenchId)) {
        commitCapturedPacket(maybeResult);
        return maybeResult;
      }

      return null;
    } catch (err) {
      setSafetyError(`Failed to capture telemetry report: ${err?.message || "Unknown telemetry error"}`);
      return null;
    }
  }, [
    selectedBenchId,
    manifestData,
    repairHistory,
    safeProducts,
    approvals,
    submittedPayloads,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    batchFetcher.state,
    referenceMatchFetcher.state,
    pendingReferenceMatch,
    isLoadingData,
    safetyMessage,
    safetyError,
    aiStep,
    executionMode,
    getSystemStatus,
    getFieldMetadata,
    publishCapturedPacketToSidekickCache
  ]);

  const handleCopyTelemetryPart = useCallback((partArrayIndex) => {
    if (!selectedBenchId) {
      setSafetyError("Cannot copy telemetry part: No active product selected on the bench.");
      return;
    }
    if (!isValidTelemetryPacketForProduct(telemetryPacket, selectedBenchId)) {
      setSafetyError("Cannot copy telemetry part: No valid captured report snapshot exists for the active product. Click 'Capture Full Report' or 'Capture Review Report' first.");
      return;
    }

    const numericIndex = Number(partArrayIndex);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= telemetryPacket.parts.length) {
      setSafetyError(`Cannot copy telemetry part: Invalid part index (${String(partArrayIndex)}).`);
      return;
    }

    const updatedPacket = copyCapturedTelemetryPart({
      packet: telemetryPacket,
      partIndex: numericIndex,
      setSafetyError,
      setSafetyMessage
    });

    if (updatedPacket && isValidTelemetryPacketForProduct(updatedPacket, selectedBenchId)) {
      setTelemetryPacket(updatedPacket);
    }
  }, [selectedBenchId, telemetryPacket]);

  const handleDownloadTelemetry = useCallback((packetArg) => {
    const targetPacket = packetArg && isValidTelemetryPacketForProduct(packetArg, selectedBenchId)
      ? packetArg
      : telemetryPacket;

    if (!selectedBenchId || !isValidTelemetryPacketForProduct(targetPacket, selectedBenchId)) {
      setSafetyError("Cannot download captured report: No valid captured report snapshot exists for the active product. Click 'Capture Full Report' or 'Capture Review Report' first.");
      return false;
    }

    return downloadCapturedTelemetryReport({
      packet: targetPacket,
      setSafetyError,
      setSafetyMessage
    });
  }, [selectedBenchId, telemetryPacket]);

  const toggleBay = (title) => {
    setExpandedBays(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;
  const activeBenchData = selectedBenchId ? manifestData[selectedBenchId] : null;
  const isDevUnselectedPreview = Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS && (!selectedBenchId || !activeBenchData));
  const effectiveManifestForSections = activeBenchData || (DEV_SHOW_ALL_TEMPLATE_FIELDS ? EMPTY_DEV_PREVIEW_MANIFEST : null);

  const dynamicSections = effectiveManifestForSections
    ? getDynamicSections(effectiveManifestForSections)
    : getDynamicSections();
  const allDynamicConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  const activeBenchStats = activeBenchData ? getDiagnosticsStats(activeBenchData) : null;
  const activeBenchStatusObj = activeBenchData ? getSystemStatus() : null;
  const activeBenchHistory = selectedBenchId ? repairHistory[selectedBenchId] : null;

  // Compute read-only monitoring status for the orchestrator panel
  const isBenchSelectedBool = Boolean(selectedBenchId && isExactProductGid(selectedBenchId));
  const isBaselineLoadedBool = Boolean(isBenchSelectedBool && activeBenchData);
  const activeBaselineMeta = isBaselineLoadedBool ? (baselineMetaByProductRef.current[selectedBenchId] || null) : null;
  const activeManualEditsMap = isBenchSelectedBool ? validObj(manualEdits[selectedBenchId]) : {};
  const activeManualEditCount = Object.keys(activeManualEditsMap).filter((k) => activeManualEditsMap[k] === true).length;
  const activeExplicitApprovalCount = isBenchSelectedBool ? Object.keys(validObj(approvals[selectedBenchId])).length : 0;
  const activeProposedCount = typeof activeBenchStats?.proposed === "number" ? activeBenchStats.proposed : 0;
  const activeApprovedWriteCount = typeof activeBenchStats?.approvedWrite === "number" ? activeBenchStats.approvedWrite : 0;

  let unsavedWorkingChangesWord = "Not available";
  let unsavedWorkingChangesDetail = "No baseline loaded";
  if (isBaselineLoadedBool && activeBenchStats) {
    const hasUnsavedWorking =
      activeProposedCount > 0 ||
      activeManualEditCount > 0 ||
      activeExplicitApprovalCount > 0;
    unsavedWorkingChangesWord = hasUnsavedWorking ? "Yes" : "No";
    unsavedWorkingChangesDetail = `Proposals: ${activeProposedCount} | Manual edits: ${activeManualEditCount} | Explicit approvals: ${activeExplicitApprovalCount} | Approved for write: ${activeApprovedWriteCount}`;
  }

  let verifiedSavedWord = "No";
  let verifiedSavedDetail = isBenchSelectedBool ? "No repair executed in session" : "No product selected";
  if (isBenchSelectedBool && activeBenchHistory) {
    const verifiedDestCount = validArray(activeBenchHistory.verifiedDestinations).length;
    const attemptedDestCount = validArray(activeBenchHistory.attemptedDestinations).length;
    const blockedDestCount = Object.keys(validObj(activeBenchHistory.blockedFields)).length;
    const conflictDestCount = Object.keys(validObj(activeBenchHistory.conflicts)).length;
    const unresolvedDestCount = Object.keys(validObj(activeBenchHistory.unresolvedChanges)).length;
    const hasPartialOrUnresolved =
      activeBenchHistory.status === "PARTIAL_SUCCESS" ||
      blockedDestCount > 0 ||
      conflictDestCount > 0 ||
      unresolvedDestCount > 0 ||
      (attemptedDestCount > 0 && verifiedDestCount < attemptedDestCount);

    if (activeBenchHistory.readBackVerified === true && verifiedDestCount > 0) {
      verifiedSavedWord = "Yes";
      verifiedSavedDetail = hasPartialOrUnresolved
        ? `Partial (${verifiedDestCount}/${attemptedDestCount || verifiedDestCount} destinations verified at ${activeBenchHistory.completedAt || "Unknown"})`
        : `${verifiedDestCount} destination(s) verified at ${activeBenchHistory.completedAt || "Unknown"}`;
    } else if (activeBenchHistory.readBackVerified === false) {
      verifiedSavedWord = "No";
      verifiedSavedDetail = `Read-back not verified (${activeBenchHistory.status || "Unknown"} at ${activeBenchHistory.completedAt || "Unknown"})`;
    } else {
      verifiedSavedWord = "Unknown";
      verifiedSavedDetail = `Status: ${activeBenchHistory.status || "Unknown"} at ${activeBenchHistory.completedAt || "Unknown"}`;
    }
  }

  const isCurrentProductAckSynced = Boolean(
    isBenchSelectedBool &&
    liveBenchSyncStatus.lifecycle === "acknowledged" &&
    liveBenchSyncStatus.selectionState === "selected" &&
    liveBenchSyncStatus.productId === selectedBenchId &&
    liveBenchSyncStatus.benchSessionId === benchSessionIdRef.current &&
    liveBenchSyncStatus.benchRevision === lastLiveStateRevisionRef.current &&
    lastLiveStateDigestRef.current !== "" &&
    lastLiveSyncedDigestRef.current === lastLiveStateDigestRef.current
  );

  const isClearedAckSynced = Boolean(
    !isBenchSelectedBool &&
    liveBenchSyncStatus.lifecycle === "cleared" &&
    liveBenchSyncStatus.selectionState === "none" &&
    liveBenchSyncStatus.benchSessionId === benchSessionIdRef.current &&
    liveBenchSyncStatus.benchRevision === lastLiveStateRevisionRef.current
  );

  let sidekickLiveSyncWord = "Unknown";
  let sidekickLiveSyncTone = "info";
  let sidekickLiveSyncLifecycleLabel = liveBenchSyncStatus.lifecycle || "unavailable";

  if (isCurrentProductAckSynced) {
    sidekickLiveSyncWord = "Yes";
    sidekickLiveSyncTone = "success";
    sidekickLiveSyncLifecycleLabel = "acknowledged";
  } else if (isClearedAckSynced) {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "cleared (no product selected)";
  } else if (liveBenchSyncStatus.lifecycle === "pending") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "pending";
  } else if (liveBenchSyncStatus.lifecycle === "error") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "critical";
    sidekickLiveSyncLifecycleLabel = `error (${liveBenchSyncStatus.errorCode || "unknown"})`;
  } else if (liveBenchSyncStatus.lifecycle === "unavailable") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "unavailable";
  } else {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "superseded / awaiting sync";
  }

  const nativeDescriptionMeta = activeBenchData
    ? getFieldMetadata("native_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : null;
  const customDescriptionMeta = activeBenchData
    ? getFieldMetadata("custom.generated_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : null;

  // Guarded no-op callbacks for unselected DEV preview mode so preview controls can never mutate state or trigger requests
  const noopPreviewCallback = useCallback(() => {}, []);

  const getPreviewFieldMetadata = useCallback((key, data, productId, currentApprovals, configFields = []) => {
    const baseMeta = evaluateFieldMetadata({
      key,
      data: data || EMPTY_DEV_PREVIEW_MANIFEST,
      productId: null,
      currentApprovals: {},
      configFields,
      standardizedCandidatesByProduct: {},
      getStandardizedEvaluationForField: null
    });
    return {
      ...baseMeta,
      isPendingReadOnly: true,
      hasContractOrOwnerHold: true,
      isBlockedAction: true,
      isApproved: false,
      isContentPreApproved: false,
      reasons: [
        "DEV Preview Mode (No product loaded/selected on bench â€” read-only template audit view)",
        ...(Array.isArray(baseMeta.reasons) ? baseMeta.reasons : [])
      ]
    };
  }, []);

  // Build audit count summary strictly from reported section measurements for the current product (or null in preview)
  const currentAuditOwnerId = isDevUnselectedPreview ? null : (selectedBenchId || null);
  const activeSectionMeasurementsMap =
    sectionAuditMeasurements.productId === currentAuditOwnerId
      ? sectionAuditMeasurements.bySection
      : {};

  const renderedKeysByGroupForAudit = {};
  Object.entries(activeSectionMeasurementsMap).forEach(([secTitle, rec]) => {
    if (rec && Array.isArray(rec.renderedKeys)) {
      renderedKeysByGroupForAudit[secTitle] = rec.renderedKeys;
    }
  });

  const templateAuditSummary = computeTemplateAuditCounts(
    PRODUCT_TEMPLATE_GROUPS,
    Object.keys(renderedKeysByGroupForAudit).length > 0
      ? { renderedKeysByGroup: renderedKeysByGroupForAudit }
      : null
  );

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub â€” Accessible Diagnostic View</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "24px", alignItems: "start", boxSizing: "border-box", maxWidth: "100%" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <InventorySelectionColumn
          queueIds={queueIds}
          searchQuery={searchQuery}
          isLoadingData={isLoadingData}
          isExecuting={isExecuting}
          allFilteredSelected={allFilteredSelected}
          filteredProducts={filteredProducts}
          selectedBenchId={selectedBenchId}
          productStates={productStates}
          manifestData={manifestData}
          defaultQueuedStatus={STATUS.QUEUED}
          getStatusTone={getStatusTone}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          onToggleSelectAllFiltered={toggleSelectAllFiltered}
          onToggleProductSelection={handleToggleProductSelection}
          onSelectBenchItem={handleSelectBenchItem}
        />

        {/* RIGHT COLUMN: Repair Manifest Viewer */}
        <div style={{ minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <BlockStack gap="600">
            <Text variant="headingXl" as="h2">2. Repair Bench & Engine Diagnostics</Text>

            {safetyMessage && (
              <Banner tone="info" onDismiss={() => setSafetyMessage("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyMessage}</Text>
              </Banner>
            )}
            {safetyError && (
              <Banner tone="critical" onDismiss={() => setSafetyError("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyError}</Text>
              </Banner>
            )}
            {telemetryPublishNotice && telemetryPublishNotice.productId === selectedBenchId && (
              <Banner
                tone={telemetryPublishNotice.tone || "info"}
                onDismiss={() => setTelemetryPublishNotice(null)}
              >
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  {telemetryPublishNotice.message}
                </Text>
              </Banner>
            )}

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h3">Repair Engine Orchestrator</Text>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", minWidth: 0 }}>
                    <Button 
                      size="large" 
                      variant="secondary" 
                      icon={MagicIcon} 
                      onClick={generateRepairPlan} 
                      disabled={isLoadingData || isExecuting}
                      loading={isLoadingData}
                    >
                      GENERATE REPAIR PLAN (LOAD DATA)
                    </Button>
                    
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="critical" 
                      onClick={executeRepairs} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "REPAIR"}
                    >
                      EXECUTE REPAIRS (LIVE)
                    </Button>

                    <Button 
                      size="large" 
                      variant="primary" 
                      icon={MagicIcon}
                      onClick={executeAIFill} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "AI_BATCH_PIPELINE"}
                    >
                      EXECUTE AI AUTO-FILL (STAGE)
                    </Button>
                  </div>
                </InlineStack>

                <Banner tone="warning">
                  <Text as="p" variant="bodyLg"><strong>Structural Repairs</strong> writes your edited Local Repair Plan to Shopify. <strong>AI Auto-Fill</strong> spins up Gemini to generate missing data and stages it below for you to review before writing.</Text>
                </Banner>

                {(isExecuting || isLoadingData) && queueIds.length > 0 && (
                  <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" variant="headingMd">{isLoadingData ? "Fetching Live Data..." : "Live Execution Progress"}</Text>
                        <Text as="p" variant="headingMd">{isLoadingData ? loadIndex : executeIndex} of {queueIds.length} Processed</Text>
                      </InlineStack>
                      <ProgressBar progress={progressPercentage} color="primary" size="large" />
                    </BlockStack>
                  </Box>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px", minWidth: 0 }}>
                  <Button size="large" tone="critical" onClick={clearBench} disabled={isExecuting || isLoadingData}>Clear Rack & Reset Bench</Button>
                  
                  <Button
                    size="large"
                    icon={ClipboardIcon}
                    onClick={() => handleCollectTelemetry("full")}
                    disabled={!selectedBenchId || !activeBenchData}
                    aria-label="Capture Full Report snapshot and copy Part 1 to clipboard"
                  >
                    Capture Full Report
                  </Button>
                </div>

                <Box padding="300" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                  <BlockStack gap="150">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h4" variant="headingSm" fontWeight="bold">
                        Read-Only Sidekick Live Bench Monitoring Status
                      </Text>
                      <Badge tone={sidekickLiveSyncTone}>
                        {`Sidekick Live Sync: ${sidekickLiveSyncWord} (${sidekickLiveSyncLifecycleLabel})`}
                      </Badge>
                    </InlineStack>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 16px", fontSize: "13px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      <div>
                        <strong>Bench Selected:</strong> {isBenchSelectedBool ? "Yes" : "No"} ({isBenchSelectedBool ? selectedBenchId : "None"})
                      </div>
                      <div>
                        <strong>Baseline Loaded:</strong> {isBaselineLoadedBool ? "Yes" : "No"} ({activeBaselineMeta?.loadedAt || "Not available"})
                      </div>
                      <div>
                        <strong>Unsaved Working Changes:</strong> {unsavedWorkingChangesWord} ({unsavedWorkingChangesDetail})
                      </div>
                      <div>
                        <strong>Verified Saved in Session:</strong> {verifiedSavedWord} ({verifiedSavedDetail})
                      </div>
                    </div>

                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>Session:</strong> {liveBenchSyncStatus.benchSessionId || benchSessionIdRef.current || "Not available"} | <strong>Revision:</strong> {liveBenchSyncStatus.benchRevision !== null ? liveBenchSyncStatus.benchRevision : "Not available"} | <strong>Selection State:</strong> {liveBenchSyncStatus.selectionState || "Not available"} | <strong>Synced Product:</strong> {liveBenchSyncStatus.productId || "Not available"} | <strong>Report ID:</strong> {liveBenchSyncStatus.reportId || "Not available"}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>Client State Changed:</strong> {liveBenchSyncStatus.clientStateChangedAt || "Not available"} | <strong>Baseline Loaded At:</strong> {liveBenchSyncStatus.baselineLoadedAt || activeBaselineMeta?.loadedAt || "Not available"} | <strong>Server Received At:</strong> {liveBenchSyncStatus.serverReceivedAt || "Not available"}
                      {liveBenchSyncStatus.errorMessage ? ` | Error: ${liveBenchSyncStatus.errorMessage}` : ""}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

            {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
              <Card padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="warning">DEV: Show All Template Fields</Badge>
                      <Text as="h3" variant="headingMd" fontWeight="bold">
                        Template Capability & Rendered Row Audit ({isDevUnselectedPreview ? "Unselected Read-Only Preview" : `Active Product: ${selectedBenchId}`})
                      </Text>
                    </InlineStack>
                    <Badge tone={templateAuditSummary.measurementStatus === "complete" ? "success" : "attention"}>
                      {templateAuditSummary.measurementStatus === "complete"
                        ? `Measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups)`
                        : `Measuring (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
                    </Badge>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    <strong>Scope:</strong> Counts below measure only canonical template rows rendered inside the 10 <code>ManifestSectionCard</code> groups (excluding hidden <code>custom.origin_story</code> diagnostic context, compatibility adapters, and separate top-level cards/buttons). In DEV mode, all groups default open and status/applicability filters are bypassed so zero canonical capabilities can disappear.
                  </Text>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px" }}>Template Group</th>
                          <th style={{ padding: "8px 10px" }}>Logical Capabilities</th>
                          <th style={{ padding: "8px 10px" }}>Running Logical Subtotal</th>
                          <th style={{ padding: "8px 10px" }}>Measured Rendered Template Rows</th>
                          <th style={{ padding: "8px 10px" }}>Running Rendered Subtotal</th>
                          <th style={{ padding: "8px 10px" }}>Notes / Media Expansion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let runningLogical = 0;
                          let runningRendered = 0;
                          let allMeasuredSoFar = true;

                          return templateAuditSummary.groupSubtotals.map((grp) => {
                            runningLogical += grp.logicalCount;
                            const isGrpMeasured = grp.measurementStatus === "measured" && typeof grp.renderedCount === "number";
                            if (isGrpMeasured) {
                              runningRendered += grp.renderedCount;
                            } else {
                              allMeasuredSoFar = false;
                            }

                            let rowNote = "1:1 canonical rows";
                            if (!isGrpMeasured) {
                              rowNote = "Not measured";
                            } else if (grp.logicalImageAltCount > 0) {
                              if (templateAuditSummary.mediaControlCount > 0) {
                                rowNote = `Includes ${templateAuditSummary.mediaControlCount} per-image media alt control(s) from 1 logical native_image_alt capability`;
                              } else if (templateAuditSummary.hasZeroImagePlaceholder) {
                                rowNote = "Includes 1 read-only zero-image placeholder row for native_image_alt";
                              }
                            } else if (grp.nonMediaDiscrepancy !== null && grp.nonMediaDiscrepancy !== 0) {
                              rowNote = `Non-media row delta: ${grp.nonMediaDiscrepancy > 0 ? `+${grp.nonMediaDiscrepancy}` : grp.nonMediaDiscrepancy}`;
                            }

                            return (
                              <tr key={grp.heading} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "6px 10px", fontWeight: "600" }}>{grp.heading}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{grp.logicalCount}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>{runningLogical}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                                  {isGrpMeasured ? grp.renderedCount : "Not measured"}
                                </td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>
                                  {allMeasuredSoFar ? runningRendered : "Not measured (incomplete)"}
                                </td>
                                <td style={{ padding: "6px 10px", color: "#475569" }}>{rowNote}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                      <tfoot>
                        <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "700", borderTop: "2px solid #94a3b8" }}>
                          <td style={{ padding: "8px 10px" }}>GRAND TOTAL ({templateAuditSummary.totalGroupCount} Groups)</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                            {templateAuditSummary.totalRenderedRows !== null
                              ? templateAuditSummary.totalRenderedRows
                              : `Not measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
                          </td>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                            {templateAuditSummary.totalRenderedRows !== null
                              ? templateAuditSummary.totalRenderedRows
                              : "Not measured"}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            {templateAuditSummary.mediaControlCount !== null
                              ? `Per-Image Media Controls: ${templateAuditSummary.mediaControlCount} | Zero-Image Placeholder: ${templateAuditSummary.hasZeroImagePlaceholder ? "1 (Active)" : "0"}`
                              : "Media breakdown: Not measured"}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </BlockStack>
              </Card>
            )}

            {!selectedBenchId || !activeBenchData ? (
              <BlockStack gap="600">
                <Box padding="600" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                  <BlockStack gap="200">
                    <Text as="p" variant="headingLg" alignment="center" tone="subdued">
                      Load inventory, hit GENERATE REPAIR PLAN, then click "View Manifest on Bench" to unlock product diagnostics and editing.
                    </Text>
                    {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
                      <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                        <strong>DEV Show-All Unselected Preview:</strong> All approved template groups and rows are rendered below in read-only preview mode (with the zero-image <code>native_image_alt</code> placeholder) so the complete UI template can be inspected before selecting a product.
                      </Text>
                    )}
                  </BlockStack>
                </Box>

                {DEV_SHOW_ALL_TEMPLATE_FIELDS && dynamicSections.map(sec => (
                  <ManifestSectionCard
                    key={sec.title}
                    section={sec}
                    selectedBenchId={null}
                    data={EMPTY_DEV_PREVIEW_MANIFEST}
                    approvals={{}}
                    activeFilter="All"
                    expandedBays={expandedBays}
                    standardizedCandidatesByProduct={{}}
                    referenceMatchResultsByProduct={{}}
                    referenceMatchStatusByProduct={{}}
                    referenceMatchFetcherState="idle"
                    pendingReferenceMatch={null}
                    getFieldMetadata={getPreviewFieldMetadata}
                    matchesFilter={matchesFilter}
                    onToggleBay={toggleBay}
                    onReleasePendingReferenceMatch={noopPreviewCallback}
                    onMatchReferenceChoices={noopPreviewCallback}
                    onStandardizedEntrySelectionChange={noopPreviewCallback}
                    onToggleVerifiedStandardizedEntry={noopPreviewCallback}
                    onRepairPlanChange={noopPreviewCallback}
                    onToggleApproval={noopPreviewCallback}
                    onSectionRenderedCountChange={handleSectionRenderedCountChange}
                  />
                ))}
              </BlockStack>
            ) : (
              <BlockStack gap="600">
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "2px solid #22c55e", gap: "16px", minWidth: 0, boxSizing: "border-box" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <Text as="h3" variant="headingLg" fontWeight="bold" style={{ color: "#166534" }}>
                            <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>GID Lock: {selectedBenchId}</span>
                        </Text>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", minWidth: 0 }}>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={MagicIcon} 
                        onClick={handleExecuteSingleAI}
                        loading={(batchFetcher.state !== "idle" || referenceMatchFetcher.state !== "idle") && !isExecuting}
                      >
                        Run AI (Single)
                      </Button>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={SaveIcon} 
                        onClick={handleExecuteSingleRepair}
                        loading={(batchFetcher.state !== "idle" || referenceMatchFetcher.state !== "idle") && !isExecuting}
                        tone="success"
                      >
                        Execute Single Repair
                      </Button>
                    </div>
                </div>

                <BenchDiagnosticHeader
                  selectedBenchId={selectedBenchId}
                  data={activeBenchData}
                  stats={activeBenchStats}
                  statusObj={activeBenchStatusObj}
                  history={activeBenchHistory}
                  telemetryPacket={telemetryPacket}
                  onCollectTelemetry={handleCollectTelemetry}
                  onCopyTelemetryPart={handleCopyTelemetryPart}
                  onDownloadTelemetry={handleDownloadTelemetry}
                />

                <Card padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h3">Review Board Controls</Text>
                        <Select
                            label="Filter Fields"
                            labelInline
                            options={FILTER_OPTIONS}
                            onChange={(val) => setActiveFilter(val)}
                            value={activeFilter}
                        />
                    </InlineStack>
                    {DEV_SHOW_ALL_TEMPLATE_FIELDS && activeFilter !== "All" && (
                      <Text as="p" variant="bodySm" tone="caution">
                        DEV: Show All Template Fields override is active â€” filter selection (<code>{activeFilter}</code>) is bypassed so no canonical template rows or sections are hidden during audit.
                      </Text>
                    )}
                  </BlockStack>
                </Card>

                <DescriptionReviewSection
                  selectedBenchId={selectedBenchId}
                  data={activeBenchData}
                  meta={nativeDescriptionMeta}
                  customDescMeta={customDescriptionMeta}
                  expandedBays={expandedBays}
                  matchesFilter={matchesFilter}
                  isMultilineKey={isMultilineKey}
                  onToggleBay={toggleBay}
                  onRepairPlanChange={handleRepairPlanChange}
                  onToggleApproval={handleToggleApproval}
                />

                {dynamicSections.map(sec => (
                  <ManifestSectionCard
                    key={sec.title}
                    section={sec}
                    selectedBenchId={selectedBenchId}
                    data={activeBenchData}
                    approvals={approvals}
                    activeFilter={DEV_SHOW_ALL_TEMPLATE_FIELDS ? "All" : activeFilter}
                    expandedBays={expandedBays}
                    standardizedCandidatesByProduct={standardizedCandidatesByProduct}
                    referenceMatchResultsByProduct={referenceMatchResultsByProduct}
                    referenceMatchStatusByProduct={referenceMatchStatusByProduct}
                    referenceMatchFetcherState={referenceMatchFetcher.state}
                    pendingReferenceMatch={pendingReferenceMatch}
                    getFieldMetadata={getFieldMetadata}
                    matchesFilter={matchesFilter}
                    onToggleBay={toggleBay}
                    onReleasePendingReferenceMatch={handleReleasePendingReferenceMatch}
                    onMatchReferenceChoices={handleMatchReferenceChoices}
                    onStandardizedEntrySelectionChange={handleStandardizedEntrySelectionChange}
                    onToggleVerifiedStandardizedEntry={handleToggleVerifiedStandardizedEntry}
                    onRepairPlanChange={handleRepairPlanChange}
                    onToggleApproval={handleToggleApproval}
                    onSectionRenderedCountChange={handleSectionRenderedCountChange}
                  />
                ))}
                
              </BlockStack>
            )}
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
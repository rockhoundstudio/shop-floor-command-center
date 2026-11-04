// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 DRAWERS & FIELD CARDS PRESENTATION MODULE
// File: app/utils/bench-v2.drawers-view.jsx
// ==========================================================================

import React, { useState, useCallback } from "react";
import {
  isParkedOrProtectedDrawerId,
  isManualOnlyNoAiDestination
} from "./bench-v2.contract.jsx";
import {
  PLAIN_DRAWER_TITLES,
  formatRawBaselineValueForInspection,
  getShortPlainNotice,
  getDrawerConnectionSubtitle
} from "./bench-v2.field-filters.jsx";
import {
  splitReportIntoLosslessParts,
  copyCapturedTelemetryPart
} from "./meta-injector.telemetry.jsx";

export const SHORT_NOTICE_TONE_STYLES = Object.freeze({
  error: Object.freeze({
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fca5a5"
  }),
  warning: Object.freeze({
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fdba74"
  }),
  muted: Object.freeze({
    backgroundColor: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1"
  })
});

export function getShortNoticeBoxStyle(tone) {
  const palette =
    tone === "error"
      ? SHORT_NOTICE_TONE_STYLES.error
      : tone === "warning"
        ? SHORT_NOTICE_TONE_STYLES.warning
        : SHORT_NOTICE_TONE_STYLES.muted;
  return {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    ...palette
  };
}

export const DETAILS_PANEL_STYLE = Object.freeze({
  marginTop: "8px",
  padding: "10px 14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "6px"
});

const DRAWER_COPY_TARGET_CHARS = 5800;
const DRAWER_COPY_HARD_MAX_CHARS = 6000;

function formatExactLoadedBaselineForDrawerCopy(row) {
  const obs = row?.baselineObservation;
  const contract = row?.contract;
  if (!obs) return "[BASELINE OBSERVATION UNAVAILABLE]";

  if (contract?.destinationKey === "native_image_alt") {
    return "[DISPLAY CAPABILITY DESCRIPTOR — Expands per MediaImage GID below; not a direct single-value metafield]";
  }

  if (!obs.evidenceAvailable) {
    if (obs.presence === "unknown_incomplete_read") {
      return "[EVIDENCE UNAVAILABLE — INCOMPLETE READ (Cannot infer absence or blank value)]";
    }
    if (obs.presence === "multiple_variants_hold") {
      return "[EVIDENCE HELD — MULTIPLE VARIANTS (Single-variant target required)]";
    }
    if (obs.presence === "zero_variants_hold") {
      return "[EVIDENCE HELD — ZERO VARIANTS]";
    }
    return `[EVIDENCE UNAVAILABLE — ${obs.presence || "not_loaded"}]`;
  }

  if (obs.presence === "absent") {
    return "[ABSENT — Verified not set on owner]";
  }
  if (obs.presence === "null") {
    return "[NULL — Explicit null value]";
  }
  if (obs.presence === "empty_string") {
    return '[ACTUAL BLANK VALUE — Empty string ""]';
  }

  const rawText =
    typeof obs.rawValue === "object" && obs.rawValue !== null
      ? JSON.stringify(obs.rawValue)
      : String(obs.rawValue ?? "");

  const isShopifyReference = contract?.namespace === "shopify";
  const usesMeaningDisplay = Boolean(
    contract?.usesYesNoMeaningDisplay || isShopifyReference
  );
  const meaningText =
    usesMeaningDisplay &&
    typeof row.baselineDisplayValue === "string" &&
    row.baselineDisplayValue !== "" &&
    row.baselineDisplayValue !== rawText
      ? ` (Resolved Display: ${row.baselineDisplayValue})`
      : "";

  return `${rawText}${meaningText}`;
}

function formatDrawerFieldCopyBlock(row, indexNumber) {
  const {
    contract,
    baselineObservation: obs,
    typeAndCompleteness,
    referenceEvidence,
    hasProposalKey,
    proposedValue,
    proposedDisplayValue,
    proposalSource,
    proposalOrigin,
    heldAiAlternative,
    scanProposalMeta,
    validation,
    isApproved,
    isKeepOriginal,
    fidelityCheck,
    effectiveConnectionStatus,
    effectiveReviewStatus,
    effectiveStatusReason,
    plainLabel
  } = row;

  const isShopifyReference = contract.namespace === "shopify";
  const usesMeaningDisplay = Boolean(
    contract.usesYesNoMeaningDisplay || isShopifyReference
  );
  const isManualOnlyField = isManualOnlyNoAiDestination(
    contract.destinationKey,
    contract
  );

  const ownerLineParts = [
    `Owner: ${contract.owner}`,
    `Destination: ${contract.destinationKey}`
  ];
  if (contract.owner === "PRODUCTVARIANT") {
    ownerLineParts.push(
      `Variant GID: ${obs?.variantId || "unverified"} (${obs?.variantTargetStatus || "unverified"})`
    );
  }
  if (isShopifyReference) {
    ownerLineParts.push(
      `Restricted MetaobjectDef: ${obs?.restrictedMetaobjectDefinitionId || "none"}`
    );
    if (obs?.categoryEligibility?.status) {
      ownerLineParts.push(`Category Eligibility: ${obs.categoryEligibility.status}`);
    }
    if (referenceEvidence) {
      ownerLineParts.push(
        `Ref Choices: loaded=${String(Boolean(referenceEvidence.evidenceLoaded))}, complete=${String(Boolean(referenceEvidence.isComplete))}, count=${referenceEvidence.isComplete ? referenceEvidence.entriesByGid.size : 0}`
      );
    }
  }
  if (isManualOnlyField) {
    ownerLineParts.push("Manual-Only (No AI Scan)");
  }

  const loadedBaselineLine = `Loaded Baseline [presence=${obs?.presence || "unavailable"}, evidenceAvailable=${String(Boolean(obs?.evidenceAvailable))}]: ${formatExactLoadedBaselineForCopySafe(row)}`;

  let recommendationOrDraftLine = "Recommendation / Manual Draft: [NONE STAGED]";
  if (hasProposalKey) {
    if (proposedValue === "") {
      recommendationOrDraftLine = `Recommendation / Manual Draft [origin=${proposalOrigin || "Manual"}, source=${proposalSource || "Manual"}]: [EMPTY DRAFT INPUT "" — Not writable]`;
    } else {
      const meaningNote =
        usesMeaningDisplay &&
        typeof proposedDisplayValue === "string" &&
        proposedDisplayValue !== "" &&
        proposedDisplayValue !== proposedValue
          ? ` (Resolved Display: ${proposedDisplayValue})`
          : "";
      recommendationOrDraftLine = `Recommendation / Manual Draft [origin=${proposalOrigin || "Manual"}, source=${proposalSource || "None"}]: ${proposedValue}${meaningNote}`;
    }
  }

  const extraCandidateLines = [];
  if (heldAiAlternative && typeof heldAiAlternative.value === "string") {
    extraCandidateLines.push(
      `Held AI Alternative (Not overwriting draft): ${heldAiAlternative.value} (Source: ${heldAiAlternative.source || "Not reported"})`
    );
  }
  if (scanProposalMeta && typeof scanProposalMeta.value === "string") {
    extraCandidateLines.push(
      `Last AI Scan Outcome: [${scanProposalMeta.disposition || "Recorded"}] ${scanProposalMeta.value} (Source: ${scanProposalMeta.source || "Not reported"}${scanProposalMeta.reason ? ` | Reason: ${scanProposalMeta.reason}` : ""})`
    );
  }

  const decisionState = isApproved
    ? "APPROVED_EXACT_VALUE"
    : isKeepOriginal
      ? "KEEP_ORIGINAL"
      : hasProposalKey
        ? "UNAPPROVED_DRAFT"
        : "UNCHANGED_NO_DRAFT";

  const blockingReasons = [];
  if (effectiveStatusReason) {
    blockingReasons.push(effectiveStatusReason);
  }
  if (hasProposalKey && validation && !validation.valid && validation.reason) {
    if (!blockingReasons.includes(validation.reason)) {
      blockingReasons.push(validation.reason);
    }
  }
  if (hasProposalKey && fidelityCheck && !fidelityCheck.faithful && fidelityCheck.reason) {
    if (!blockingReasons.includes(fidelityCheck.reason)) {
      blockingReasons.push(fidelityCheck.reason);
    }
  }
  if (typeAndCompleteness && !typeAndCompleteness.ready && typeAndCompleteness.reason) {
    if (!blockingReasons.includes(typeAndCompleteness.reason)) {
      blockingReasons.push(typeAndCompleteness.reason);
    }
  }

  const typeSummary = `AllowedType=${(contract.allowedTypes || [contract.expectedType]).join("|")} | LiveDefType=${obs?.liveDefType || "none"} | StoredType=${obs?.storedType || "none"}${typeAndCompleteness?.verifiedActualType ? ` | ResolvedWriteType=${typeAndCompleteness.verifiedActualType} (${typeAndCompleteness.typeEvidenceSource || "verified"})` : ""}`;

  const blockLines = [
    `[${indexNumber}] ${plainLabel || contract.label} (${contract.destinationKey})`,
    `  ${ownerLineParts.join(" | ")}`,
    `  ${typeSummary}`,
    `  Connection Status: ${effectiveConnectionStatus}`,
    `  Review Status: ${effectiveReviewStatus} | Decision: ${decisionState}`,
    `  ${loadedBaselineLine}`,
    `  ${recommendationOrDraftLine}`,
    ...extraCandidateLines.map((l) => `  ${l}`),
    `  Reasons / Notes: ${blockingReasons.length > 0 ? blockingReasons.join(" ; ") : "None"}`
  ];

  if (contract.unresolvedPolicyQuestion) {
    blockLines.push(`  Policy Note: ${contract.unresolvedPolicyQuestion}`);
  }

  return blockLines.join("\n");
}

function formatExactLoadedBaselineForCopySafe(row) {
  return formatExactLoadedBaselineForDrawerCopy(row);
}

function buildMediaAltCopySection(currentBaseline) {
  if (!currentBaseline) {
    return "[PER-PHOTO NATIVE MEDIA ALTS]\nBaseline not loaded; cannot inspect MediaImage alt text.";
  }

  const mediaTargets = currentBaseline.nativeTargets?.media;
  const mediaComplete =
    currentBaseline.nativeTargets?.isComplete === true &&
    !currentBaseline.nativeTargets?.loadError &&
    !(
      Array.isArray(currentBaseline.nativeTargets?.unverifiedFields) &&
      currentBaseline.nativeTargets.unverifiedFields.includes("media")
    );

  const edges = Array.isArray(mediaTargets?.edges) ? mediaTargets.edges : [];
  if (!mediaComplete) {
    return `[PER-PHOTO NATIVE MEDIA ALTS]\n[EVIDENCE UNAVAILABLE — Media read incomplete (${currentBaseline.nativeTargets?.loadError || "unverified media targets"}); cannot infer photo alt absence]`;
  }

  if (edges.length === 0) {
    return "[PER-PHOTO NATIVE MEDIA ALTS (0 photos)]\nVerified 0 MediaImage nodes on product.";
  }

  const lines = [
    `[PER-PHOTO NATIVE MEDIA ALTS (${edges.length} photos — Read-Only in Batch 1)]`
  ];
  edges.forEach((edge, idx) => {
    const node = edge?.node || {};
    const mediaId = node.id || `unverified_media_${idx + 1}`;
    const rawAlt = typeof node.alt === "string" ? node.alt : null;
    const altState =
      rawAlt === null
        ? "[NULL]"
        : rawAlt === ""
          ? '[ACTUAL BLANK VALUE — Empty string ""]'
          : rawAlt;
    lines.push(
      `  Photo ${idx + 1} | Owner: MEDIAIMAGE | Destination: native_image_alts_${mediaId} | MediaImage GID: ${mediaId} | Saved Alt: ${altState}`
    );
  });

  return lines.join("\n");
}

function buildSingleDrawerCopyPacket({
  drawer,
  plainDrawerTitle,
  activeFilter,
  activeProductId,
  activeProductTitle,
  benchSessionId,
  telemetrySyncStatus,
  currentBaseline
}) {
  const capturedAt = new Date().toISOString();
  const evaluatedRows = Array.isArray(drawer.evaluatedRows) ? drawer.evaluatedRows : [];
  const visibleRows = Array.isArray(drawer.visibleRows) ? drawer.visibleRows : [];

  const resolvedProductId =
    activeProductId ||
    currentBaseline?.productId ||
    telemetrySyncStatus?.productId ||
    "Not recorded";
  const resolvedProductTitle =
    activeProductTitle ||
    currentBaseline?.productTitle ||
    "Not recorded";
  const resolvedSessionId =
    benchSessionId ||
    telemetrySyncStatus?.benchSessionId ||
    "Not recorded";
  const resolvedRevision =
    typeof telemetrySyncStatus?.benchRevision === "number" &&
    telemetrySyncStatus.benchRevision > 0
      ? String(telemetrySyncStatus.benchRevision)
      : "Not synced";
  const baselineLoadedAt =
    currentBaseline &&
    (!activeProductId || currentBaseline.productId === activeProductId) &&
    typeof currentBaseline.loadedAt === "string" &&
    currentBaseline.loadedAt.trim() !== ""
      ? currentBaseline.loadedAt.trim()
      : "Not loaded";

  const runIdentity = `session:${resolvedSessionId}|rev:${resolvedRevision}|drawer:${drawer.drawerId}`;
  const runTimestamp = baselineLoadedAt;
  const sectionLabel = `DRAWER ${drawer.drawerNumber || ""} (${drawer.drawerId}): ${plainDrawerTitle}`.trim();

  const isFilteredView = Boolean(activeFilter && activeFilter !== "All");
  const visibleDestKeySet = new Set(
    visibleRows.map((r) => r.contract.destinationKey)
  );
  const filteredOutDestKeys = isFilteredView
    ? evaluatedRows
        .filter((r) => !visibleDestKeySet.has(r.contract.destinationKey))
        .map((r) => r.contract.destinationKey)
    : [];

  const drawerApprovedCount = evaluatedRows.filter(
    (r) => r.isApproved && r.fidelityCheck.faithful
  ).length;
  const drawerStagedCount = evaluatedRows.filter((r) => r.hasProposalKey).length;
  const drawerKeepOriginalCount = evaluatedRows.filter((r) => r.isKeepOriginal).length;
  const drawerHeldAltCount = evaluatedRows.filter((r) => Boolean(r.heldAiAlternative)).length;

  const drawerIdentityBlock = [
    `--- DRAWER & SESSION IDENTITY ---`,
    `Drawer ID: ${drawer.drawerId} | Drawer Number: ${drawer.drawerNumber ?? "Not recorded"} | Title: ${plainDrawerTitle}`,
    `Drawer Subtitle: ${getDrawerConnectionSubtitle(drawer)}`,
    `Product Title: ${resolvedProductTitle} | Product GID: ${resolvedProductId}`,
    `Bench Session ID: ${resolvedSessionId} | Bench Revision: ${resolvedRevision} | Baseline Loaded At: ${baselineLoadedAt}`,
    `Row Scope: Complete drawer dataset (${evaluatedRows.length} evaluated contract row${evaluatedRows.length === 1 ? "" : "s"} included below; active UI filter="${activeFilter || "All"}", visible in UI=${visibleRows.length}/${evaluatedRows.length})`,
    ...(isFilteredView
      ? [
          `Filter Note: ${filteredOutDestKeys.length} row(s) are currently hidden by UI filter "${activeFilter}" (${filteredOutDestKeys.length > 0 ? filteredOutDestKeys.join(", ") : "none"}), NOT absent on product. All ${evaluatedRows.length} drawer rows are included below with their exact filter match flag.`
        ]
      : []),
    `Drawer Summary Counts: ${evaluatedRows.length} total | ${drawerStagedCount} staged | ${drawerApprovedCount} approved | ${drawerKeepOriginalCount} Keep Original | ${drawerHeldAltCount} held AI alternative`
  ].join("\n");

  const fieldBlocks = evaluatedRows.map((row, idx) => {
    const baseBlock = formatDrawerFieldCopyBlock(row, idx + 1);
    if (!isFilteredView) return baseBlock;
    const filterNote = visibleDestKeySet.has(row.contract.destinationKey)
      ? `Matches UI Filter "${activeFilter}": YES (Displayed)`
      : `Matches UI Filter "${activeFilter}": NO (Hidden by UI filter only; not absent)`;
    return `${baseBlock}\n  ${filterNote}`;
  });

  const hasMediaAltDescriptor = evaluatedRows.some(
    (r) => r.contract.destinationKey === "native_image_alt"
  );
  const mediaAltBlock = hasMediaAltDescriptor
    ? buildMediaAltCopySection(currentBaseline)
    : null;

  const bodySections = [
    drawerIdentityBlock,
    `--- DRAWER FIELDS (${evaluatedRows.length}) ---\n\n${fieldBlocks.join("\n\n")}`
  ];
  if (mediaAltBlock) {
    bodySections.push(mediaAltBlock);
  }

  const compiledBodyText = bodySections.join("\n\n");

  const parts = splitReportIntoLosslessParts({
    productTitle: resolvedProductTitle,
    productId: resolvedProductId,
    runIdentity,
    runTimestamp,
    capturedAt,
    sectionLabel,
    bodyText: compiledBodyText,
    targetMaxChars: DRAWER_COPY_TARGET_CHARS,
    hardMaxChars: DRAWER_COPY_HARD_MAX_CHARS
  });

  return {
    mode: `drawer:${drawer.drawerId}`,
    sectionKey: "drawer",
    sectionLabel,
    drawerId: drawer.drawerId,
    productId: resolvedProductId,
    productTitle: resolvedProductTitle,
    runIdentity,
    runTimestamp,
    capturedAt,
    limitUsed: DRAWER_COPY_HARD_MAX_CHARS,
    fullText: compiledBodyText,
    parts,
    activePartIndex: 0
  };
}

export function BenchV2DrawersView({
  activeFilter,
  setActiveFilter,
  totalVisibleFilteredRowCount,
  activeProductId,
  activeProductTitle,
  benchSessionId,
  telemetrySyncStatus,
  validApprovedRowsCount,
  keepOriginalRowsCount,
  visibleDrawerGroups,
  openDrawersById,
  canRetryRefChoicesForCurrentProduct,
  isAnyOperationBusy,
  currentBaseline,
  isRefChoicesBusy,
  isCurrentRefChoicesBoundAndFresh,
  currentRefChoicesRecord,
  handleToggleDrawer,
  handleLoadStandardizedReferenceChoices,
  handleFieldEditorFocus,
  handleFieldEditorBlur,
  handleSelectPresetOption,
  handleManualProposalChange,
  handleClearDraftProposal,
  handleAcceptAiAlternative,
  handleDismissAiAlternative,
  handleToggleApproval,
  handleToggleKeepOriginal
}) {
  const [capturedPacketsByDrawerId, setCapturedPacketsByDrawerId] = useState({});
  const [copyFeedbackByDrawerId, setCopyFeedbackByDrawerId] = useState({});

  const setDrawerCopyError = useCallback((drawerId, errMessage) => {
    setCopyFeedbackByDrawerId((prev) => ({
      ...prev,
      [drawerId]: {
        tone: "error",
        text: errMessage,
        updatedAt: new Date().toISOString()
      }
    }));
  }, []);

  const setDrawerCopySuccess = useCallback((drawerId, okMessage) => {
    setCopyFeedbackByDrawerId((prev) => ({
      ...prev,
      [drawerId]: {
        tone: "success",
        text: okMessage,
        updatedAt: new Date().toISOString()
      }
    }));
  }, []);

  const handleCopyDrawerSnapshot = useCallback(
    (e, drawer, plainDrawerTitle) => {
      if (e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }

      const packet = buildSingleDrawerCopyPacket({
        drawer,
        plainDrawerTitle,
        activeFilter,
        activeProductId,
        activeProductTitle,
        benchSessionId,
        telemetrySyncStatus,
        currentBaseline
      });

      const oversizePart = packet.parts.find(
        (p) => typeof p.text !== "string" || p.text.length >= 7000
      );
      if (oversizePart) {
        setDrawerCopyError(
          drawer.drawerId,
          `Copy aborted: Part ${oversizePart.partNumber} length (${oversizePart.text?.length || 0} chars) reached 7000-character limit.`
        );
        return;
      }

      setCapturedPacketsByDrawerId((prev) => ({
        ...prev,
        [drawer.drawerId]: packet
      }));

      setCopyFeedbackByDrawerId((prev) => ({
        ...prev,
        [drawer.drawerId]: {
          tone: "pending",
          text:
            packet.parts.length > 1
              ? `Copying Part 1 of ${packet.parts.length}...`
              : "Copying drawer to clipboard...",
          updatedAt: new Date().toISOString()
        }
      }));

      copyCapturedTelemetryPart({
        packet,
        partIndex: 0,
        setSafetyError: (errText) => setDrawerCopyError(drawer.drawerId, errText),
        setSafetyMessage: (msgText) => setDrawerCopySuccess(drawer.drawerId, msgText)
      });
    },
    [
      activeFilter,
      activeProductId,
      activeProductTitle,
      benchSessionId,
      telemetrySyncStatus,
      currentBaseline,
      setDrawerCopyError,
      setDrawerCopySuccess
    ]
  );

  const handleCopyDrawerPart = useCallback(
    (e, drawerId, partIdx) => {
      if (e && typeof e.stopPropagation === "function") {
        e.stopPropagation();
      }

      const existingPacket = capturedPacketsByDrawerId[drawerId];
      if (
        !existingPacket ||
        !Array.isArray(existingPacket.parts) ||
        !existingPacket.parts[partIdx]
      ) {
        setDrawerCopyError(
          drawerId,
          "No captured multi-part drawer snapshot found. Click Copy Drawer first."
        );
        return;
      }

      const targetPart = existingPacket.parts[partIdx];
      if (typeof targetPart.text !== "string" || targetPart.text.length >= 7000) {
        setDrawerCopyError(
          drawerId,
          `Copy aborted: Part ${targetPart.partNumber} length (${targetPart.text?.length || 0} chars) reached 7000-character limit.`
        );
        return;
      }

      setCopyFeedbackByDrawerId((prev) => ({
        ...prev,
        [drawerId]: {
          tone: "pending",
          text: `Copying Part ${targetPart.partNumber} of ${existingPacket.parts.length}...`,
          updatedAt: new Date().toISOString()
        }
      }));

      const updatedPacket = copyCapturedTelemetryPart({
        packet: existingPacket,
        partIndex: partIdx,
        setSafetyError: (errText) => setDrawerCopyError(drawerId, errText),
        setSafetyMessage: (msgText) => setDrawerCopySuccess(drawerId, msgText)
      });

      if (updatedPacket) {
        setCapturedPacketsByDrawerId((prev) => ({
          ...prev,
          [drawerId]: updatedPacket
        }));
      }
    },
    [capturedPacketsByDrawerId, setDrawerCopyError, setDrawerCopySuccess]
  );

  return (
    <>
      {/* HONEST EMPTY-FILTER NOTICE WITH ONE-CLICK RETURN TO ALL */}
      {activeFilter !== "All" && totalVisibleFilteredRowCount === 0 && (
        <div
          role="status"
          style={{
            backgroundColor: "#ffffff",
            border: "2px solid #2563eb",
            borderRadius: "10px",
            padding: "20px 24px",
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}
        >
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              No fields currently match the "{activeFilter}" filter on {activeProductTitle}
            </div>
            <div style={{ fontSize: "15px", color: "#334155", marginTop: "4px" }}>
              {activeFilter === "Needs review"
                ? `All review items in this view are resolved (${validApprovedRowsCount} approved to save, ${keepOriginalRowsCount} Keep Original). Review complete does not mean saved to Shopify.`
                : "All underlying fields, drafts, approvals, and Keep Original decisions remain intact."}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveFilter("All")}
            style={{
              padding: "10px 18px",
              fontSize: "16px",
              fontWeight: 700,
              backgroundColor: "#1d4ed8",
              color: "#ffffff",
              border: "2px solid #1e3a8a",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Show All Fields
          </button>
        </div>
      )}

      {/* ALL REORGANIZED DRAWERS — INITIALLY COLLAPSED, PLAIN NAMES, CLEAR EXPAND/COLLAPSE & COPY */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {visibleDrawerGroups.map((drawer) => {
          const isOpen = Boolean(openDrawersById[drawer.drawerId]);
          const plainDrawerTitle = PLAIN_DRAWER_TITLES[drawer.drawerId] || drawer.heading;

          const evaluatedRows = Array.isArray(drawer.evaluatedRows)
            ? drawer.evaluatedRows
            : [];
          const drawerApprovedCount = evaluatedRows.filter(
            (r) => r.isApproved && r.fidelityCheck.faithful
          ).length;
          const drawerStagedCount = evaluatedRows.filter(
            (r) => r.hasProposalKey
          ).length;
          const drawerHeldAltCount = evaluatedRows.filter(
            (r) => Boolean(r.heldAiAlternative)
          ).length;

          const isParkedProtectedDrawer = isParkedOrProtectedDrawerId(drawer.drawerId);
          const hasWritableShopifyRefInDrawer = evaluatedRows.some(
            (r) => r.contract.namespace === "shopify" && r.contract.isWritableInBatch1 === true
          );
          const hasMediaAltDescriptorInDrawer = evaluatedRows.some(
            (r) => r.contract.destinationKey === "native_image_alt"
          );

          const drawerSubtitleLabel = getDrawerConnectionSubtitle(drawer);

          const currentProductId =
            activeProductId ||
            currentBaseline?.productId ||
            telemetrySyncStatus?.productId ||
            null;
          const rawCachedPacket = capturedPacketsByDrawerId[drawer.drawerId] || null;
          const cachedPacket =
            rawCachedPacket &&
            (!currentProductId || rawCachedPacket.productId === currentProductId)
              ? rawCachedPacket
              : null;
          const copyFeedback = copyFeedbackByDrawerId[drawer.drawerId] || null;

          return (
            <section
              key={drawer.drawerId}
              aria-label={plainDrawerTitle}
              style={{
                backgroundColor: "#ffffff",
                border:
                  drawer.isImplementedInBatch1 && !isParkedProtectedDrawer
                    ? "2px solid #64748b"
                    : "1px solid #94a3b8",
                borderRadius: "10px",
                overflow: "hidden"
              }}
            >
              {/* DRAWER HEADER BAR */}
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: isOpen ? "#e2e8f0" : "#ffffff",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: isOpen ? "2px solid #94a3b8" : "none"
                }}
              >
                <div style={{ flex: "1 1 380px" }}>
                  <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                    {plainDrawerTitle}
                  </h2>
                  <div style={{ fontSize: "14px", color: "#334155", marginTop: "2px" }}>
                    {drawerSubtitleLabel} &bull;{" "}
                    {activeFilter === "All"
                      ? `${evaluatedRows.length} fields`
                      : `${drawer.visibleRows.length} of ${evaluatedRows.length} fields match "${activeFilter}"`}
                    {drawerStagedCount > 0 && ` • ${drawerStagedCount} staged`}
                    {drawerApprovedCount > 0 && ` • ${drawerApprovedCount} approved`}
                    {drawerHeldAltCount > 0 && ` • ${drawerHeldAltCount} AI alternative`}
                  </div>

                  {copyFeedback && (
                    <div
                      role="status"
                      style={{
                        marginTop: "6px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color:
                          copyFeedback.tone === "error"
                            ? "#991b1b"
                            : copyFeedback.tone === "success"
                              ? "#166534"
                              : "#334155"
                      }}
                    >
                      {copyFeedback.text}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center"
                  }}
                >
                  {hasWritableShopifyRefInDrawer &&
                    canRetryRefChoicesForCurrentProduct && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLoadStandardizedReferenceChoices();
                        }}
                        disabled={isAnyOperationBusy || !currentBaseline}
                        style={{
                          padding: "8px 14px",
                          fontSize: "15px",
                          fontWeight: 700,
                          backgroundColor:
                            isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#0f766e",
                          color:
                            isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                          border: "2px solid #115e59",
                          borderRadius: "8px",
                          cursor:
                            isAnyOperationBusy || !currentBaseline
                              ? "not-allowed"
                              : "pointer"
                        }}
                      >
                        Retry Reference Choices
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={(e) => handleCopyDrawerSnapshot(e, drawer, plainDrawerTitle)}
                    style={{
                      padding: "8px 14px",
                      fontSize: "14px",
                      fontWeight: 700,
                      backgroundColor: "#eff6ff",
                      color: "#1e3a8a",
                      border: "2px solid #2563eb",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {cachedPacket && cachedPacket.parts.length > 1
                      ? `Copy Drawer (${cachedPacket.parts.length} Parts)`
                      : "Copy Drawer"}
                  </button>

                  {cachedPacket &&
                    Array.isArray(cachedPacket.parts) &&
                    cachedPacket.parts.length > 1 &&
                    cachedPacket.parts.map((part, pIdx) => {
                      const isActivePart = cachedPacket.activePartIndex === pIdx;
                      return (
                        <button
                          key={`${drawer.drawerId}_part_${part.partNumber}`}
                          type="button"
                          onClick={(e) => handleCopyDrawerPart(e, drawer.drawerId, pIdx)}
                          style={{
                            padding: "6px 10px",
                            fontSize: "13px",
                            fontWeight: 700,
                            backgroundColor: isActivePart ? "#1d4ed8" : "#ffffff",
                            color: isActivePart ? "#ffffff" : "#1e3a8a",
                            border: "1px solid #1d4ed8",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          Copy Part {part.partNumber}/{cachedPacket.parts.length} ({part.charCount}c)
                        </button>
                      );
                    })}

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleDrawer(drawer.drawerId);
                    }}
                    style={{
                      padding: "8px 16px",
                      fontSize: "15px",
                      fontWeight: 700,
                      backgroundColor: isOpen ? "#0f172a" : "#f8fafc",
                      color: isOpen ? "#ffffff" : "#0f172a",
                      border: "2px solid #334155",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {isOpen ? "Close Drawer" : "Open Drawer"}
                  </button>
                </div>
              </div>

              {/* DRAWER BODY — VISIBLE FIELDS IN DRAWER */}
              {isOpen && (
                <div style={{ padding: "18px 20px", backgroundColor: "#f8fafc" }}>
                  {/* STANDARDIZED REFERENCE CHOICES STATUS BAR FOR ANY DRAWER WITH WRITABLE SHOPIFY.* FIELDS */}
                  {hasWritableShopifyRefInDrawer && (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        border: "2px solid #0f766e",
                        borderRadius: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <div style={{ flex: "1 1 480px" }}>
                        <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>
                          Standardized Reference Verification ({plainDrawerTitle})
                        </div>
                        <div style={{ fontSize: "14px", color: "#334155", marginTop: "4px" }}>
                          {isRefChoicesBusy
                            ? "Loading and verifying Metaobject reference choices from Shopify..."
                            : isCurrentRefChoicesBoundAndFresh && currentRefChoicesRecord
                              ? currentRefChoicesRecord.summary
                              : "Reference choices load automatically when the product baseline is ready."}
                        </div>
                      </div>
                      {canRetryRefChoicesForCurrentProduct && (
                        <button
                          type="button"
                          onClick={handleLoadStandardizedReferenceChoices}
                          disabled={isAnyOperationBusy || !currentBaseline}
                          style={{
                            padding: "9px 16px",
                            fontSize: "15px",
                            fontWeight: 700,
                            backgroundColor:
                              isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#0f766e",
                            color:
                              isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                            border: "2px solid #115e59",
                            borderRadius: "8px",
                            cursor:
                              isAnyOperationBusy || !currentBaseline
                                ? "not-allowed"
                                : "pointer"
                          }}
                        >
                          Retry Reference Choices
                        </button>
                      )}
                    </div>
                  )}

                  {/* PER-IMAGE NATIVE MEDIA ALT BASELINE INSPECTION IN DRAWER WITH native_image_alt */}
                  {hasMediaAltDescriptorInDrawer &&
                    Array.isArray(currentBaseline?.nativeTargets?.media?.edges) && (
                      <div
                        style={{
                          marginBottom: "16px",
                          padding: "14px 16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #94a3b8",
                          borderRadius: "8px"
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
                          Saved Photo Alt Text ({currentBaseline.nativeTargets.media.edges.length}{" "}
                          photos — Read-only in Batch 1)
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "10px"
                          }}
                        >
                          {currentBaseline.nativeTargets.media.edges.map(({ node }, idx) => (
                            <div
                              key={node.id || idx}
                              style={{
                                padding: "10px 12px",
                                backgroundColor: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "15px"
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>Photo {idx + 1}</div>
                              <div style={{ marginTop: "4px" }}>
                                {node.alt ? (
                                  <span>{node.alt}</span>
                                ) : (
                                  <span style={{ color: "#475569" }}>Not set</span>
                                )}
                              </div>
                              <details style={{ marginTop: "6px", fontSize: "13px" }}>
                                <summary style={{ cursor: "pointer", color: "#475569" }}>
                                  Photo ID
                                </summary>
                                <code>{node.id}</code>
                              </details>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* EMPTY DRAWER FILTER STATE */}
                  {drawer.visibleRows.length === 0 ? (
                    <div
                      style={{
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "15px",
                        color: "#334155"
                      }}
                    >
                      <span>
                        0 fields in {plainDrawerTitle} match the "{activeFilter}" filter.
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveFilter("All")}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          fontWeight: 700,
                          backgroundColor: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #475569",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        Show All Fields
                      </button>
                    </div>
                  ) : (
                    /* FIELD CARDS */
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {drawer.visibleRows.map((row) => {
                        const {
                          contract,
                          baselineObservation: obs,
                          typeAndCompleteness,
                          referenceEvidence,
                          options,
                          hasProposalKey,
                          proposedValue,
                          proposedDisplayValue,
                          proposalSource,
                          proposalOrigin,
                          heldAiAlternative,
                          scanProposalMeta,
                          validation,
                          isApproved,
                          isKeepOriginal,
                          fidelityCheck,
                          effectiveConnectionStatus,
                          effectiveReviewStatus,
                          effectiveStatusReason,
                          plainLabel,
                          readableSaved,
                          canSelectKeepOriginal
                        } = row;

                        const isShopifyReference = contract.namespace === "shopify";
                        const usesMeaningDisplay = Boolean(
                          contract.usesYesNoMeaningDisplay || isShopifyReference
                        );
                        const isManualOnlyField = isManualOnlyNoAiDestination(
                          contract.destinationKey,
                          contract
                        );
                        const isMultilineField = contract.control === "multiline";

                        const canEditDraftInBatch1 =
                          contract.isWritableInBatch1 &&
                          obs.evidenceAvailable &&
                          (!isShopifyReference || typeAndCompleteness?.ready === true);

                        const canApproveForSave =
                          contract.isWritableInBatch1 &&
                          hasProposalKey &&
                          Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
                          fidelityCheck.faithful;

                        const shortNotice = getShortPlainNotice(row, isRefChoicesBusy);

                        let inputPlaceholder = "Type proposed value...";
                        if (!canEditDraftInBatch1) {
                          inputPlaceholder =
                            contract.owner === "PRODUCTVARIANT"
                              ? "Editing locked until single-variant baseline loads"
                              : isShopifyReference
                                ? "Blocked by category or definition constraint on this product"
                                : "Editing locked until baseline loads";
                        } else if (isShopifyReference) {
                          inputPlaceholder =
                            'Select a verified reference choice above or enter canonical JSON GID array (e.g. ["gid://shopify/Metaobject/..."])...';
                        } else if (contract.destinationKey === "custom.dimensions_mm") {
                          inputPlaceholder = "Enter manual measurement (e.g. 38 x 24 x 6 mm)...";
                        } else if (contract.destinationKey === "custom.weight_grams") {
                          inputPlaceholder = "Enter manual scale weight in grams (e.g. 14.5)...";
                        }

                        let cardBorder = "1px solid #cbd5e1";
                        let cardBg = "#ffffff";
                        if (isApproved) {
                          cardBorder = "2px solid #15803d";
                          cardBg = "#f0fdf4";
                        } else if (
                          hasProposalKey &&
                          (!validation?.valid || !fidelityCheck.faithful)
                        ) {
                          cardBorder = "2px solid #b45309";
                          cardBg = "#fffbeb";
                        } else if (hasProposalKey && !isKeepOriginal) {
                          cardBorder = "2px solid #2563eb";
                        }

                        return (
                          <div
                            key={contract.destinationKey}
                            style={{
                              backgroundColor: cardBg,
                              border: cardBorder,
                              borderRadius: "8px",
                              padding: "16px 18px"
                            }}
                          >
                            {/* FIELD TITLE ROW */}
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: "8px",
                                marginBottom: "12px"
                              }}
                            >
                              <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                                {plainLabel}
                                {contract.destinationKey === "custom.is_ooak" && (
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 500,
                                      color: "#475569",
                                      marginLeft: "8px"
                                    }}
                                  >
                                    (Second OOAK field — custom.is_ooak)
                                  </span>
                                )}
                                {contract.destinationKey === "custom.is_one_of_a_kind" && (
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 500,
                                      color: "#475569",
                                      marginLeft: "8px"
                                    }}
                                  >
                                    (Primary OOAK field — custom.is_one_of_a_kind)
                                  </span>
                                )}
                                {contract.owner === "PRODUCTVARIANT" &&
                                  contract.isWritableInBatch1 && (
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "#1e3a8a",
                                        marginLeft: "8px"
                                      }}
                                    >
                                      (Single-Variant {contract.destinationKey} — manual/preset)
                                    </span>
                                  )}
                                {isShopifyReference && contract.isWritableInBatch1 && (
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 600,
                                      color: "#0f766e",
                                      marginLeft: "8px"
                                    }}
                                  >
                                    (Standardized Reference {contract.destinationKey})
                                  </span>
                                )}
                                {isManualOnlyField &&
                                  contract.isWritableInBatch1 &&
                                  contract.owner !== "PRODUCTVARIANT" &&
                                  !isShopifyReference && (
                                    <span
                                      style={{
                                        fontSize: "13px",
                                        fontWeight: 600,
                                        color: "#334155",
                                        marginLeft: "8px"
                                      }}
                                    >
                                      (Manual entry only — no AI scan)
                                    </span>
                                  )}
                              </div>

                              <div style={{ fontSize: "15px", fontWeight: 600, color: "#334155" }}>
                                {isApproved
                                  ? "Approved to save"
                                  : isKeepOriginal
                                    ? "Keeping original"
                                    : hasProposalKey
                                      ? proposalOrigin === "AI"
                                        ? "AI suggestion (unapproved)"
                                        : "Draft staged (unapproved)"
                                      : "Unchanged"}
                              </div>
                            </div>

                            {/* SAVED VS. PROPOSED SIDE-BY-SIDE */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                                gap: "16px",
                                alignItems: "stretch"
                              }}
                            >
                              {/* SAVED BOX */}
                              <div
                                style={{
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid #94a3b8",
                                  borderRadius: "6px",
                                  padding: "12px 14px"
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "6px"
                                  }}
                                >
                                  Saved
                                </div>
                                <div
                                  style={{
                                    fontSize: "16px",
                                    color:
                                      obs.presence === "present" ? "#0f172a" : "#475569",
                                    fontWeight: obs.presence === "present" ? 600 : 400,
                                    wordBreak: "break-word",
                                    whiteSpace: "pre-wrap"
                                  }}
                                >
                                  {readableSaved}
                                </div>
                                {isShopifyReference &&
                                  obs.presence === "present" &&
                                  typeof obs.rawValue === "string" &&
                                  obs.rawValue.trim() !== "" && (
                                    <div
                                      style={{
                                        marginTop: "6px",
                                        fontSize: "13px",
                                        color: "#475569",
                                        wordBreak: "break-all"
                                      }}
                                    >
                                      Raw JSON: <code>{obs.rawValue}</code>
                                    </div>
                                  )}
                              </div>

                              {/* PROPOSED BOX + NEARBY APPROVAL CONTROLS */}
                              <div
                                style={{
                                  backgroundColor: "#ffffff",
                                  border: "1px solid #94a3b8",
                                  borderRadius: "6px",
                                  padding: "12px 14px"
                                }}
                              >
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "baseline",
                                    gap: "8px",
                                    marginBottom: "6px"
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      color: "#334155"
                                    }}
                                  >
                                    Proposed
                                  </span>
                                  {hasProposalKey && proposalSource && proposalSource !== "None" && (
                                    <span style={{ fontSize: "13px", color: "#475569" }}>
                                      Source: {proposalSource}
                                    </span>
                                  )}
                                </div>

                                {contract.isWritableInBatch1 ? (
                                  <div>
                                    {Array.isArray(options) && options.length > 0 && (
                                      <select
                                        aria-label={`Preset options for ${contract.destinationKey}`}
                                        value={
                                          options.some(
                                            (o) =>
                                              (typeof o === "object" ? o.value : o) ===
                                              proposedValue
                                          )
                                            ? proposedValue
                                            : ""
                                        }
                                        disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
                                        onFocus={() =>
                                          handleFieldEditorFocus(contract.destinationKey)
                                        }
                                        onBlur={() =>
                                          handleFieldEditorBlur(contract.destinationKey)
                                        }
                                        onChange={(e) => {
                                          if (e.target.value === "") return;
                                          handleSelectPresetOption(row, e.target.value);
                                        }}
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          marginBottom: "8px",
                                          fontSize: "15px",
                                          border: "1px solid #475569",
                                          borderRadius: "6px",
                                          backgroundColor: "#ffffff",
                                          color: "#0f172a"
                                        }}
                                      >
                                        <option value="">
                                          {isShopifyReference
                                            ? `Choose verified Metaobject entry (${options.length} available)...`
                                            : "Choose an option..."}
                                        </option>
                                        {options.map((opt, idx) => {
                                          const optVal =
                                            typeof opt === "object"
                                              ? opt.value ?? opt.label
                                              : String(opt);
                                          const optLabel =
                                            typeof opt === "object" ? opt.label : String(opt);
                                          return (
                                            <option key={`${optVal}_${idx}`} value={optVal}>
                                              {optLabel}
                                            </option>
                                          );
                                        })}
                                      </select>
                                    )}

                                    <div
                                      style={{
                                        display: "flex",
                                        gap: "8px",
                                        alignItems: isMultilineField ? "flex-start" : "stretch"
                                      }}
                                    >
                                      {isMultilineField ? (
                                        <textarea
                                          aria-label={`Manual proposal for ${contract.destinationKey}`}
                                          value={proposedValue}
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
                                          placeholder={inputPlaceholder}
                                          rows={
                                            contract.destinationKey === "native_seo_description"
                                              ? 3
                                              : 6
                                          }
                                          onFocus={() =>
                                            handleFieldEditorFocus(contract.destinationKey)
                                          }
                                          onBlur={() =>
                                            handleFieldEditorBlur(contract.destinationKey)
                                          }
                                          onChange={(e) =>
                                            handleManualProposalChange(
                                              contract.destinationKey,
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            flex: 1,
                                            padding: "8px 10px",
                                            fontSize: "16px",
                                            lineHeight: 1.5,
                                            fontFamily: "inherit",
                                            border: "1px solid #475569",
                                            borderRadius: "6px",
                                            color: "#0f172a",
                                            resize: "vertical"
                                          }}
                                        />
                                      ) : (
                                        <input
                                          type="text"
                                          aria-label={`Manual proposal for ${contract.destinationKey}`}
                                          value={proposedValue}
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
                                          placeholder={inputPlaceholder}
                                          onFocus={() =>
                                            handleFieldEditorFocus(contract.destinationKey)
                                          }
                                          onBlur={() =>
                                            handleFieldEditorBlur(contract.destinationKey)
                                          }
                                          onChange={(e) =>
                                            handleManualProposalChange(
                                              contract.destinationKey,
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            flex: 1,
                                            padding: "8px 10px",
                                            fontSize: "16px",
                                            border: "1px solid #475569",
                                            borderRadius: "6px",
                                            color: "#0f172a"
                                          }}
                                        />
                                      )}
                                      {hasProposalKey && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleClearDraftProposal(contract.destinationKey)
                                          }
                                          disabled={isAnyOperationBusy}
                                          style={{
                                            padding: "8px 12px",
                                            fontSize: "14px",
                                            fontWeight: 600,
                                            backgroundColor: "#f1f5f9",
                                            color: "#0f172a",
                                            border: "1px solid #475569",
                                            borderRadius: "6px",
                                            cursor: "pointer"
                                          }}
                                        >
                                          Clear
                                        </button>
                                      )}
                                    </div>

                                    {usesMeaningDisplay &&
                                      hasProposalKey &&
                                      proposedValue.trim() !== "" &&
                                      proposedDisplayValue && (
                                        <div
                                          style={{
                                            fontSize: "14px",
                                            color: "#334155",
                                            marginTop: "6px",
                                            wordBreak: "break-word"
                                          }}
                                        >
                                          {isShopifyReference ? (
                                            <>
                                              Resolved Entries:{" "}
                                              <strong>{proposedDisplayValue}</strong>
                                              <div
                                                style={{
                                                  fontSize: "13px",
                                                  color: "#475569",
                                                  marginTop: "2px",
                                                  wordBreak: "break-all"
                                                }}
                                              >
                                                Raw JSON: <code>{proposedValue}</code>
                                              </div>
                                            </>
                                          ) : (
                                            <>
                                              Meaning: <strong>{proposedDisplayValue}</strong>
                                            </>
                                          )}
                                        </div>
                                      )}

                                    {/* HELD AI ALTERNATIVE CHOICE BOX */}
                                    {heldAiAlternative && !isManualOnlyField && (
                                      <div
                                        style={{
                                          marginTop: "10px",
                                          padding: "10px 12px",
                                          backgroundColor: "#eff6ff",
                                          border: "1px solid #93c5fd",
                                          borderRadius: "6px",
                                          fontSize: "14px",
                                          color: "#1e3a8a"
                                        }}
                                      >
                                        <div style={{ fontWeight: 700 }}>
                                          Separate AI Suggestion Available: "
                                          {heldAiAlternative.value}"
                                        </div>
                                        <div style={{ fontSize: "13px", marginTop: "2px" }}>
                                          Source:{" "}
                                          {typeof heldAiAlternative.source === "string" &&
                                          heldAiAlternative.source.trim() !== ""
                                            ? heldAiAlternative.source.trim()
                                            : "Source not reported"}{" "}
                                          (kept separate so your current draft or decision was not
                                          overwritten)
                                        </div>
                                        <div
                                          style={{
                                            display: "flex",
                                            gap: "8px",
                                            marginTop: "8px"
                                          }}
                                        >
                                          <button
                                            type="button"
                                            disabled={isAnyOperationBusy}
                                            onClick={() =>
                                              handleAcceptAiAlternative(contract.destinationKey)
                                            }
                                            style={{
                                              padding: "5px 10px",
                                              fontSize: "13px",
                                              fontWeight: 700,
                                              backgroundColor: "#1d4ed8",
                                              color: "#ffffff",
                                              border: "1px solid #1e3a8a",
                                              borderRadius: "5px",
                                              cursor: isAnyOperationBusy
                                                ? "not-allowed"
                                                : "pointer"
                                            }}
                                          >
                                            Use AI Suggestion
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isAnyOperationBusy}
                                            onClick={() =>
                                              handleDismissAiAlternative(contract.destinationKey)
                                            }
                                            style={{
                                              padding: "5px 10px",
                                              fontSize: "13px",
                                              fontWeight: 600,
                                              backgroundColor: "#ffffff",
                                              color: "#0f172a",
                                              border: "1px solid #64748b",
                                              borderRadius: "5px",
                                              cursor: isAnyOperationBusy
                                                ? "not-allowed"
                                                : "pointer"
                                            }}
                                          >
                                            Dismiss AI Suggestion
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    {/* PLAIN-LANGUAGE APPROVE & KEEP ORIGINAL CONTROLS */}
                                    <div
                                      style={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: "18px",
                                        marginTop: "12px",
                                        paddingTop: "10px",
                                        borderTop: "1px solid #e2e8f0"
                                      }}
                                    >
                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          fontSize: "16px",
                                          fontWeight: isApproved ? 700 : 600,
                                          color: isApproved ? "#15803d" : "#0f172a",
                                          cursor:
                                            (canApproveForSave || isApproved) &&
                                            !isAnyOperationBusy
                                              ? "pointer"
                                              : "not-allowed",
                                          opacity:
                                            canApproveForSave || isApproved ? 1 : 0.55
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={Boolean(isApproved)}
                                          disabled={
                                            isAnyOperationBusy ||
                                            (!canApproveForSave && !isApproved)
                                          }
                                          onChange={() =>
                                            handleToggleApproval(
                                              contract.destinationKey,
                                              Boolean(isApproved)
                                            )
                                          }
                                          style={{ width: "18px", height: "18px" }}
                                        />
                                        <span>Approve</span>
                                      </label>

                                      <label
                                        style={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: "8px",
                                          fontSize: "16px",
                                          fontWeight: isKeepOriginal ? 700 : 600,
                                          color: "#0f172a",
                                          cursor:
                                            (canSelectKeepOriginal || isKeepOriginal) &&
                                            !isAnyOperationBusy
                                              ? "pointer"
                                              : "not-allowed",
                                          opacity:
                                            canSelectKeepOriginal || isKeepOriginal ? 1 : 0.55
                                        }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={Boolean(isKeepOriginal)}
                                          disabled={
                                            isAnyOperationBusy ||
                                            (!canSelectKeepOriginal && !isKeepOriginal)
                                          }
                                          onChange={() =>
                                            handleToggleKeepOriginal(
                                              contract.destinationKey,
                                              Boolean(isKeepOriginal)
                                            )
                                          }
                                          style={{ width: "18px", height: "18px" }}
                                        />
                                        <span>Keep Original</span>
                                      </label>
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: "15px", color: "#475569" }}>
                                    {contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
                                      ? "Held read-only pending supported Shopify definition and writer evidence."
                                      : contract.writeCapability === "TASK_RESTRICTED_NO_WRITE"
                                        ? "Read-only baseline (price/shipping writes are task-restricted in this batch)."
                                        : "Read-only in this batch."}
                                  </div>
                                )}

                                {/* SHORT PLAIN-LANGUAGE VISIBLE REASON FOR HOLDS OR ERRORS */}
                                {shortNotice && contract.isWritableInBatch1 && (
                                  <div style={getShortNoticeBoxStyle(shortNotice.tone)}>
                                    {shortNotice.text}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* ACCESSIBLE PER-FIELD TECHNICAL DETAILS DISCLOSURE */}
                            <details
                              style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}
                            >
                              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                                Details for {plainLabel}
                              </summary>
                              <div
                                style={{
                                  ...DETAILS_PANEL_STYLE,
                                  padding: "10px 12px"
                                }}
                              >
                                <div>
                                  <strong>Destination Key:</strong>{" "}
                                  <code>{contract.destinationKey}</code> ({contract.owner})
                                  {contract.owner === "PRODUCTVARIANT" && (
                                    <>
                                      {" "}
                                      | <strong>Observed Variant GID:</strong>{" "}
                                      <code>{obs.variantId || "none"}</code>
                                      {obs.variantTargetStatus
                                        ? ` (${obs.variantTargetStatus})`
                                        : ""}
                                    </>
                                  )}
                                  {isShopifyReference && (
                                    <>
                                      {" "}
                                      | <strong>Restricted MetaobjectDef:</strong>{" "}
                                      <code>
                                        {obs.restrictedMetaobjectDefinitionId || "none"}
                                      </code>
                                      {obs.categoryEligibility?.status
                                        ? ` (Category Eligibility: ${obs.categoryEligibility.status})`
                                        : ""}
                                    </>
                                  )}
                                </div>
                                <div>
                                  <strong>Connection Status:</strong> {effectiveConnectionStatus}
                                </div>
                                <div>
                                  <strong>Review Status:</strong> {effectiveReviewStatus}
                                </div>
                                {hasProposalKey && (
                                  <div>
                                    <strong>Staged Draft Source:</strong>{" "}
                                    {proposalSource && proposalSource !== "None"
                                      ? proposalSource
                                      : "Source not reported"}{" "}
                                    | <strong>Exact Staged Value:</strong>{" "}
                                    <code>{proposedValue}</code>
                                  </div>
                                )}
                                {scanProposalMeta && (
                                  <div>
                                    <strong>Last AI Scan Suggestion:</strong> "
                                    {scanProposalMeta.value}" | <strong>Source:</strong>{" "}
                                    {typeof scanProposalMeta.source === "string" &&
                                    scanProposalMeta.source.trim() !== ""
                                      ? scanProposalMeta.source.trim()
                                      : "Source not reported"}{" "}
                                    | <strong>Outcome:</strong> {scanProposalMeta.disposition}
                                  </div>
                                )}
                                {effectiveStatusReason && (
                                  <div>
                                    <strong>Notes:</strong> {effectiveStatusReason}
                                  </div>
                                )}
                                <div>
                                  <strong>Allowed Type(s):</strong>{" "}
                                  <code>
                                    {(contract.allowedTypes || [contract.expectedType]).join(
                                      " | "
                                    )}
                                  </code>
                                  {contract.maxLength ? ` (max ${contract.maxLength} chars)` : ""}
                                </div>
                                <div>
                                  <strong>Observed Types:</strong> Live Definition={" "}
                                  <code>{obs.liveDefType || "none"}</code> | Stored={" "}
                                  <code>{obs.storedType || "none"}</code>
                                  {typeAndCompleteness?.typeEvidenceSource && (
                                    <>
                                      {" "}
                                      | <strong>Type Evidence Source:</strong>{" "}
                                      <code>{typeAndCompleteness.typeEvidenceSource}</code>
                                      {typeAndCompleteness.verifiedActualType
                                        ? ` (Resolved Write Type: ${typeAndCompleteness.verifiedActualType})`
                                        : ""}
                                    </>
                                  )}
                                </div>
                                <div>
                                  <strong>Completeness:</strong> Metafields={" "}
                                  {obs.metafieldsCompleteState} | Definitions={" "}
                                  {obs.defsCompleteState}
                                </div>
                                <div>
                                  <strong>Raw Baseline Inspection:</strong>{" "}
                                  <code>{formatRawBaselineValueForInspection(obs)}</code>
                                </div>
                                {contract.unresolvedPolicyQuestion && (
                                  <div style={{ marginTop: "4px", color: "#9a3412" }}>
                                    <strong>Policy Note:</strong>{" "}
                                    {contract.unresolvedPolicyQuestion}
                                  </div>
                                )}
                              </div>
                            </details>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
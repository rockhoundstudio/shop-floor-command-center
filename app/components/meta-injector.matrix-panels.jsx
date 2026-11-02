// ==========================================================================
// ROCKHOUND STUDIO — MATRIX ORCHESTRATOR & DIAGNOSTIC PRESENTATIONAL PANELS
// File: app/components/meta-injector.matrix-panels.jsx
// Pure browser-safe presentational components extracted from
// app/routes/app.meta-injector.matrix.jsx (Panels 1–4).
// Zero hooks, zero state ownership, zero server/DB/network imports.
// ==========================================================================

import React from "react";
import { BlockStack, Card, Text, Banner, Button, InlineStack, Box, Badge } from "@shopify/polaris";
import { validArray, validObj } from "../utils/meta-injector.standardized.jsx";

export function StockBezelCleanupPanel({
  loadedManifestCount,
  selectedBenchId,
  hasActiveBenchData,
  isLoadingData,
  isExecuting,
  stockCleanupPreview,
  stockCleanupSelectedMap,
  stockCleanupOutcomeReport,
  stockCleanupInlineFeedback,
  stockCleanupFeedbackRef,
  onCapturePreview,
  onCancelPreview,
  onToggleCandidateSelection,
  onSelectAllCandidates,
  onStageSelectedCandidates,
  onDismissFeedback
}) {
  const safeSelectedMap = validObj(stockCleanupSelectedMap);
  const totalCleanupCandidateCount = stockCleanupPreview?.candidates?.length || 0;
  const selectedCleanupCandidateCount = stockCleanupPreview?.candidates
    ? stockCleanupPreview.candidates.filter((c) => safeSelectedMap[c.candidateId] === true).length
    : 0;

  return (
    <Box padding="300" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
      <BlockStack gap="200">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="attention">One-Time Stock Cleanup</Badge>
            <Text as="h4" variant="headingSm" fontWeight="bold">
              Current-Stock Bezel Claim Cleanup (Glue-On w/ Loop; Pinch Bails Preserved)
            </Text>
          </InlineStack>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <Button
              size="slim"
              variant="secondary"
              onClick={() => onCapturePreview("loaded_all")}
              disabled={loadedManifestCount === 0 || isLoadingData || isExecuting}
            >
              {`Preview Loaded Stock (${loadedManifestCount})`}
            </Button>
            <Button
              size="slim"
              variant="secondary"
              onClick={() => onCapturePreview("active_bench")}
              disabled={!selectedBenchId || !hasActiveBenchData || isLoadingData || isExecuting}
            >
              Preview Active Bench Item Only
            </Button>
            {stockCleanupPreview && (
              <Button
                size="slim"
                tone="critical"
                variant="tertiary"
                onClick={onCancelPreview}
                disabled={isLoadingData || isExecuting}
              >
                Cancel / Clear Preview
              </Button>
            )}
          </div>
        </InlineStack>

        <details style={{ fontSize: "12px", color: "#475569" }}>
          <summary style={{ cursor: "pointer", fontWeight: "600" }}>
            Scope &amp; Safety Rules (Click to expand)
          </summary>
          <div style={{ marginTop: "6px", paddingLeft: "8px", lineHeight: "1.45" }}>
            Inspects only the fixed product IDs captured when you click Preview. Never runs on load or rescan, never converts pinch bails (pins through drilled holes) to glue-on, flags ambiguous/contradictory bezel wording instead of guessing, and stages selected replacements as unapproved review proposals. Existing approvals, manual edits, Keep Original choices, and diverging AI proposals are preserved and never overwritten.
          </div>
        </details>

        {/* ACCESSIBLE LIVE FEEDBACK IMMEDIATELY BESIDE CONTROLS */}
        <div
          ref={stockCleanupFeedbackRef}
          role={stockCleanupInlineFeedback?.tone === "critical" ? "alert" : "status"}
          aria-live={stockCleanupInlineFeedback?.tone === "critical" ? "assertive" : "polite"}
          aria-atomic="true"
        >
          {stockCleanupInlineFeedback && (
            <Banner
              tone={stockCleanupInlineFeedback.tone || "info"}
              title={stockCleanupInlineFeedback.title}
              onDismiss={onDismissFeedback}
            >
              <BlockStack gap="150">
                <Text as="p" variant="bodySm">
                  {stockCleanupInlineFeedback.message}
                </Text>
                {stockCleanupOutcomeReport && (
                  <InlineStack gap="200" wrap>
                    <Badge tone={stockCleanupOutcomeReport.stagedEntries.length > 0 ? "success" : "new"}>
                      {`Staged: ${stockCleanupOutcomeReport.stagedEntries.length}`}
                    </Badge>
                    <Badge tone={stockCleanupOutcomeReport.preservedOperatorEntries.length > 0 ? "warning" : "new"}>
                      {`Skipped (Preserved Existing): ${stockCleanupOutcomeReport.preservedOperatorEntries.length}`}
                    </Badge>
                    <Badge tone={stockCleanupOutcomeReport.rejectedStaleEntries.length > 0 ? "critical" : "new"}>
                      {`Rejected (Stale): ${stockCleanupOutcomeReport.rejectedStaleEntries.length}`}
                    </Badge>
                  </InlineStack>
                )}
              </BlockStack>
            </Banner>
          )}
        </div>

        {stockCleanupPreview && (
          <Box padding="300" background="bg-surface" borderRadius="200" borderColor="border" borderWidth="1">
            <BlockStack gap="250">
              {/* COMPACT ACTION BAR & SELECTION STATUS */}
              <InlineStack align="space-between" blockAlign="center" wrap>
                <InlineStack gap="150" blockAlign="center" wrap>
                  <Badge tone="info">
                    {`Captured: ${stockCleanupPreview.summary.capturedProductCount} product(s)`}
                  </Badge>
                  <Badge tone={totalCleanupCandidateCount > 0 ? "success" : "new"}>
                    {`Eligible: ${totalCleanupCandidateCount}`}
                  </Badge>
                  <Badge tone={selectedCleanupCandidateCount > 0 ? "attention" : "critical"}>
                    {selectedCleanupCandidateCount > 0
                      ? `Selected: ${selectedCleanupCandidateCount} of ${totalCleanupCandidateCount}`
                      : `Nothing selected (0 of ${totalCleanupCandidateCount})`}
                  </Badge>
                  {stockCleanupPreview.summary.flaggedCount > 0 && (
                    <Badge tone="warning">
                      {`Flagged: ${stockCleanupPreview.summary.flaggedCount}`}
                    </Badge>
                  )}
                  {stockCleanupPreview.summary.skippedCount > 0 && (
                    <Badge>
                      {`Preserved/Clean: ${stockCleanupPreview.summary.skippedCount}`}
                    </Badge>
                  )}
                </InlineStack>

                {totalCleanupCandidateCount > 0 && (
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    <Button
                      size="slim"
                      variant="tertiary"
                      onClick={() => onSelectAllCandidates(true)}
                      disabled={isLoadingData || isExecuting}
                    >
                      Select All Candidates
                    </Button>
                    <Button
                      size="slim"
                      variant="tertiary"
                      onClick={() => onSelectAllCandidates(false)}
                      disabled={isLoadingData || isExecuting}
                    >
                      Deselect All
                    </Button>
                    <Button
                      size="slim"
                      variant="primary"
                      onClick={onStageSelectedCandidates}
                      disabled={selectedCleanupCandidateCount === 0 || isLoadingData || isExecuting}
                    >
                      {`Stage Selected Proposals for Review (${selectedCleanupCandidateCount}/${totalCleanupCandidateCount})`}
                    </Button>
                  </div>
                )}
              </InlineStack>

              {/* EXPANDABLE SKIPPED / STAGED OUTCOME DETAILS RIGHT UNDER THE STAGE BUTTON */}
              {stockCleanupOutcomeReport && (
                <Box padding="200" background="bg-surface-secondary" borderRadius="150" borderColor="border" borderWidth="1">
                  <BlockStack gap="150">
                    {stockCleanupOutcomeReport.stagedEntries.length > 0 && (
                      <details>
                        <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "12px", color: "#166534" }}>
                          {`Staged for Review (${stockCleanupOutcomeReport.stagedEntries.length}) \u2014 Click to view destinations`}
                        </summary>
                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#166534" }}>
                          {stockCleanupOutcomeReport.stagedEntries.map((st, idx) => (
                            <div key={`staged-${idx}`} style={{ wordBreak: "break-word" }}>
                              {"\u2022"} <strong>{st.productTitle}</strong> (<code>{st.destinationKey}</code>) {"\u2014"} Staged for explicit approval below.
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {stockCleanupOutcomeReport.preservedOperatorEntries.length > 0 && (
                      <details open={stockCleanupOutcomeReport.stagedEntries.length === 0}>
                        <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "12px", color: "#854d0e" }}>
                          {`Skipped to Preserve Existing Approval / Edit / AI Proposal (${stockCleanupOutcomeReport.preservedOperatorEntries.length}) \u2014 Click to view reasons`}
                        </summary>
                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#713f12" }}>
                          {stockCleanupOutcomeReport.preservedOperatorEntries.map((p, idx) => (
                            <div key={`pres-${idx}`} style={{ wordBreak: "break-word" }}>
                              {"\u2022"} <strong>{p.productTitle}</strong> {"\u2014"} <code>{p.destinationKey}</code> ({p.fieldLabel}): {p.reason}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {stockCleanupOutcomeReport.rejectedStaleEntries.length > 0 && (
                      <details open={stockCleanupOutcomeReport.stagedEntries.length === 0}>
                        <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "12px", color: "#991b1b" }}>
                          {`Rejected Stale Candidates (${stockCleanupOutcomeReport.rejectedStaleEntries.length}) \u2014 Click to view reasons`}
                        </summary>
                        <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px", color: "#991b1b" }}>
                          {stockCleanupOutcomeReport.rejectedStaleEntries.map((r, idx) => (
                            <div key={`stale-${idx}`} style={{ wordBreak: "break-word" }}>
                              {"\u2022"} <strong>{r.productTitle}</strong> {"\u2014"} <code>{r.destinationKey}</code> ({r.fieldLabel}): {r.reason}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </BlockStack>
                </Box>
              )}

              {/* 1. EXPANDABLE CANDIDATE SELECTION & FULL BEFORE/AFTER REVIEW TABLE */}
              {totalCleanupCandidateCount > 0 ? (
                <details style={{ border: "1px solid #cbd5e1", borderRadius: "6px", padding: "8px 10px", backgroundColor: "#f8fafc" }}>
                  <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>
                    {`Review & Select Eligible Replacement Candidates (${selectedCleanupCandidateCount} of ${totalCleanupCandidateCount} selected \u2014 Click to expand Before/After table)`}
                  </summary>
                  <div style={{ marginTop: "10px", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", backgroundColor: "#ffffff" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                          <th style={{ padding: "6px 8px" }}>Stage?</th>
                          <th style={{ padding: "6px 8px" }}>Product</th>
                          <th style={{ padding: "6px 8px" }}>Destination</th>
                          <th style={{ padding: "6px 8px" }}>Before (Current Stored)</th>
                          <th style={{ padding: "6px 8px" }}>After (Proposed Replacement)</th>
                          <th style={{ padding: "6px 8px" }}>Rule / Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockCleanupPreview.candidates.map((cand) => {
                          const isChecked = safeSelectedMap[cand.candidateId] === true;
                          const isLongBefore = cand.beforeValue.length > 220;
                          const isLongAfter = cand.afterValue.length > 220;
                          return (
                            <tr key={cand.candidateId} style={{ borderBottom: "1px solid #e2e8f0", verticalAlign: "top" }}>
                              <td style={{ padding: "6px 8px" }}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) =>
                                    onToggleCandidateSelection(cand.candidateId, e.target.checked)
                                  }
                                  aria-label={`Select cleanup candidate ${cand.productTitle} ${cand.destinationKey}`}
                                />
                              </td>
                              <td style={{ padding: "6px 8px", wordBreak: "break-word" }}>
                                <div style={{ fontWeight: "600" }}>{cand.productTitle}</div>
                                <div style={{ fontFamily: "monospace", color: "#475569" }}>{cand.productId}</div>
                              </td>
                              <td style={{ padding: "6px 8px", fontFamily: "monospace" }}>
                                <div>{cand.destinationKey}</div>
                                <div style={{ color: "#475569", fontFamily: "sans-serif" }}>{cand.fieldLabel}</div>
                              </td>
                              <td style={{ padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", backgroundColor: "#fff5f5" }}>
                                {isLongBefore ? (
                                  <details>
                                    <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                                      {`${cand.beforeValue.slice(0, 180)}\u2026 (Click for full ${cand.beforeValue.length} chars)`}
                                    </summary>
                                    <div style={{ marginTop: "6px" }}>{cand.beforeValue}</div>
                                  </details>
                                ) : (
                                  cand.beforeValue
                                )}
                              </td>
                              <td style={{ padding: "6px 8px", whiteSpace: "pre-wrap", wordBreak: "break-word", backgroundColor: "#f0fdf4" }}>
                                {isLongAfter ? (
                                  <details>
                                    <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                                      {`${cand.afterValue.slice(0, 180)}\u2026 (Click for full ${cand.afterValue.length} chars)`}
                                    </summary>
                                    <div style={{ marginTop: "6px" }}>{cand.afterValue}</div>
                                  </details>
                                ) : (
                                  cand.afterValue
                                )}
                              </td>
                              <td style={{ padding: "6px 8px", color: "#334155" }}>{cand.reason}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              ) : (
                <Text as="p" variant="bodySm" tone="subdued">
                  No unambiguous false bezel replacement candidates were found in the captured product baselines.
                </Text>
              )}

              {/* 2. EXPANDABLE FLAGGED ITEMS, STONE-IDENTITY LIMITATIONS & CAPTURED GIDS */}
              {(stockCleanupPreview.flaggedItems.length > 0 ||
                stockCleanupPreview.stoneIdentityDiagnostics.length > 0 ||
                stockCleanupPreview.skippedItems.length > 0 ||
                stockCleanupPreview.unavailableProducts.length > 0 ||
                stockCleanupPreview.capturedProductIds.length > 0) && (
                <details style={{ border: "1px solid #e2e8f0", borderRadius: "6px", padding: "8px 10px", fontSize: "12px" }}>
                  <summary style={{ cursor: "pointer", fontWeight: "600", color: "#334155" }}>
                    {`Preview Diagnostics: Flagged (${stockCleanupPreview.flaggedItems.length}) | Stone-Identity Writer Limits (${stockCleanupPreview.stoneIdentityDiagnostics.length}) | Preserved/Clean (${stockCleanupPreview.skippedItems.length}) | Unavailable (${stockCleanupPreview.unavailableProducts.length})`}
                  </summary>
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ color: "#475569", wordBreak: "break-word" }}>
                      <strong>Fixed Captured Product GIDs ({stockCleanupPreview.capturedProductIds.length}):</strong>{" "}
                      <code>{stockCleanupPreview.capturedProductIds.join(", ") || "None"}</code>
                    </div>

                    {stockCleanupPreview.flaggedItems.length > 0 && (
                      <Box padding="200" background="bg-surface-warning" borderRadius="150" borderColor="border" borderWidth="1">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold" tone="critical">
                            Flagged Ambiguous or Contradictory Bezel Mentions ({stockCleanupPreview.flaggedItems.length} {"\u2014"} Not Staged; Resolve Manually):
                          </Text>
                          {stockCleanupPreview.flaggedItems.map((flg, idx) => (
                            <div key={`${flg.productId}-${flg.destinationKey}-${idx}`} style={{ fontSize: "12px", wordBreak: "break-word" }}>
                              {"\u2022"} <strong>{flg.productTitle}</strong> (<code>{flg.productId}</code>) {"\u2014"} <code>{flg.destinationKey}</code>: {flg.reason} [Current: &quot;{flg.beforeValue.length > 160 ? `${flg.beforeValue.slice(0, 160)}\u2026` : flg.beforeValue}&quot;]
                            </div>
                          ))}
                        </BlockStack>
                      </Box>
                    )}

                    {stockCleanupPreview.stoneIdentityDiagnostics.length > 0 && (
                      <Box padding="200" background="bg-surface-warning" borderRadius="150" borderColor="border" borderWidth="1">
                        <BlockStack gap="100">
                          <Text as="p" variant="bodySm" fontWeight="bold">
                            Saved Stone-Identity Compatibility Writer Limitation Diagnostics ({stockCleanupPreview.stoneIdentityDiagnostics.length}):
                          </Text>
                          {stockCleanupPreview.stoneIdentityDiagnostics.map((diag) => (
                            <div key={diag.productId} style={{ fontSize: "12px", wordBreak: "break-word" }}>
                              {"\u2022"} <strong>{diag.productTitle}</strong> (<code>{diag.productId}</code>) {"\u2014"} Saved <code>custom.material</code>: <code>{String(diag.savedMaterial ?? "blank")}</code> | Saved <code>custom.primary_medium</code>: <code>{String(diag.savedPrimaryMedium ?? "blank")}</code> | Saved <code>custom.stone_family</code>: <code>{String(diag.savedStoneFamily ?? "blank")}</code>. <strong>Unresolved Writer Limitation:</strong> {diag.compatibilityWriterLimitation}
                            </div>
                          ))}
                        </BlockStack>
                      </Box>
                    )}

                    {stockCleanupPreview.skippedItems.length > 0 && (
                      <div style={{ color: "#475569", wordBreak: "break-word" }}>
                        <strong>Preserved / Clean Products ({stockCleanupPreview.skippedItems.length}):</strong>{" "}
                        {stockCleanupPreview.skippedItems.map((sk) => `${sk.productTitle} (${sk.status}: ${sk.reason})`).join(" | ")}
                      </div>
                    )}

                    {stockCleanupPreview.unavailableProducts.length > 0 && (
                      <div style={{ color: "#991b1b", wordBreak: "break-word" }}>
                        <strong>Unavailable Baselines ({stockCleanupPreview.unavailableProducts.length}):</strong>{" "}
                        {stockCleanupPreview.unavailableProducts.map((un) => `${un.productTitle} (${un.productId}: ${un.reason})`).join(" | ")}
                      </div>
                    )}
                  </div>
                </details>
              )}
            </BlockStack>
          </Box>
        )}
      </BlockStack>
    </Box>
  );
}

export function SidekickLiveSyncStatusBox({
  isBenchSelectedBool,
  selectedBenchId,
  isUnselectedBlankPreviewActive,
  isBaselineLoadedBool,
  activeBaselineMeta,
  activeBenchStats,
  unselectedDraftStats,
  hasSeedOrContext,
  activeManualEditCount,
  activeExplicitApprovalCount,
  activeKeepOriginalCount,
  activeProposedCount,
  activeApprovedWriteCount,
  activeBenchHistory,
  liveBenchSyncStatus,
  benchSessionId,
  lastLiveStateRevision,
  lastLiveStateDigest,
  lastLiveSyncedDigest
}) {
  const safeSyncStatus = validObj(liveBenchSyncStatus);

  let unsavedWorkingChangesWord = "Not available";
  let unsavedWorkingChangesDetail = "No baseline loaded";
  if (isBaselineLoadedBool && activeBenchStats) {
    const hasUnsavedWorking =
      activeProposedCount > 0 ||
      activeManualEditCount > 0 ||
      activeExplicitApprovalCount > 0 ||
      activeKeepOriginalCount > 0;
    unsavedWorkingChangesWord = hasUnsavedWorking ? "Yes" : "No";
    unsavedWorkingChangesDetail = `Proposals: ${activeProposedCount} | Manual edits: ${activeManualEditCount} | Explicit approvals: ${activeExplicitApprovalCount} | Keep original: ${activeKeepOriginalCount} | Approved for write: ${activeApprovedWriteCount}`;
  } else if (isUnselectedBlankPreviewActive && unselectedDraftStats) {
    const hasUnsavedDraftWorking =
      activeProposedCount > 0 ||
      activeManualEditCount > 0 ||
      activeExplicitApprovalCount > 0 ||
      Boolean(hasSeedOrContext);
    unsavedWorkingChangesWord = hasUnsavedDraftWorking ? "Yes (Unsaved Draft)" : "No";
    unsavedWorkingChangesDetail = `Draft proposals: ${activeProposedCount} | Draft manual edits: ${activeManualEditCount} | Draft approvals: ${activeExplicitApprovalCount} (No product selected or saved)`;
  }

  let verifiedSavedWord = "No";
  let verifiedSavedDetail = isBenchSelectedBool
    ? "No repair executed in session"
    : isUnselectedBlankPreviewActive
      ? "Unsaved new-product draft (no product selected or saved)"
      : "No product selected";
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
    safeSyncStatus.lifecycle === "acknowledged" &&
    safeSyncStatus.selectionState === "selected" &&
    safeSyncStatus.productId === selectedBenchId &&
    safeSyncStatus.benchSessionId === benchSessionId &&
    safeSyncStatus.benchRevision === lastLiveStateRevision &&
    lastLiveStateDigest !== "" &&
    lastLiveSyncedDigest === lastLiveStateDigest
  );

  const isUnselectedPreviewAckSynced = Boolean(
    isUnselectedBlankPreviewActive &&
    safeSyncStatus.lifecycle === "acknowledged" &&
    safeSyncStatus.selectionState === "unselected_preview" &&
    safeSyncStatus.productId === null &&
    safeSyncStatus.benchSessionId === benchSessionId &&
    safeSyncStatus.benchRevision === lastLiveStateRevision &&
    lastLiveStateDigest !== "" &&
    lastLiveSyncedDigest === lastLiveStateDigest
  );

  const isClearedAckSynced = Boolean(
    !isBenchSelectedBool &&
    !isUnselectedBlankPreviewActive &&
    safeSyncStatus.lifecycle === "cleared" &&
    safeSyncStatus.selectionState === "none" &&
    safeSyncStatus.benchSessionId === benchSessionId &&
    safeSyncStatus.benchRevision === lastLiveStateRevision
  );

  let sidekickLiveSyncWord = "Unknown";
  let sidekickLiveSyncTone = "info";
  let sidekickLiveSyncLifecycleLabel = safeSyncStatus.lifecycle || "unavailable";

  if (isCurrentProductAckSynced) {
    sidekickLiveSyncWord = "Yes";
    sidekickLiveSyncTone = "success";
    sidekickLiveSyncLifecycleLabel = "acknowledged (selected product)";
  } else if (isUnselectedPreviewAckSynced) {
    sidekickLiveSyncWord = "Yes";
    sidekickLiveSyncTone = "success";
    sidekickLiveSyncLifecycleLabel = "acknowledged (unselected draft/preview)";
  } else if (isClearedAckSynced) {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "cleared (no product selected)";
  } else if (safeSyncStatus.lifecycle === "pending") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "pending";
  } else if (safeSyncStatus.lifecycle === "error") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "critical";
    sidekickLiveSyncLifecycleLabel = `error (${safeSyncStatus.errorCode || "unknown"})`;
  } else if (safeSyncStatus.lifecycle === "unavailable") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "unavailable";
  } else {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "superseded / awaiting sync";
  }

  return (
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
            <strong>Bench Selected:</strong>{" "}
            {isBenchSelectedBool
              ? `Yes (${selectedBenchId})`
              : isUnselectedBlankPreviewActive
                ? "No (Unselected New-Product Draft / Preview)"
                : "No (None)"}
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
          <strong>Session:</strong> {safeSyncStatus.benchSessionId || benchSessionId || "Not available"} | <strong>Revision:</strong> {safeSyncStatus.benchRevision !== null && safeSyncStatus.benchRevision !== undefined ? safeSyncStatus.benchRevision : "Not available"} | <strong>Selection State:</strong> {safeSyncStatus.selectionState || "Not available"} | <strong>Synced Product:</strong> {safeSyncStatus.productId || (safeSyncStatus.selectionState === "unselected_preview" ? "None (Unselected Draft)" : "Not available")} | <strong>Report ID:</strong> {safeSyncStatus.reportId || "Not available"}
        </Text>
        <Text as="p" variant="bodySm" tone="subdued">
          <strong>Client State Changed:</strong> {safeSyncStatus.clientStateChangedAt || "Not available"} | <strong>Baseline Loaded At:</strong> {safeSyncStatus.baselineLoadedAt || activeBaselineMeta?.loadedAt || "Not available"} | <strong>Server Received At:</strong> {safeSyncStatus.serverReceivedAt || "Not available"}
          {safeSyncStatus.errorMessage ? ` | Error: ${safeSyncStatus.errorMessage}` : ""}
        </Text>
      </BlockStack>
    </Box>
  );
}

export function DevTemplateAuditCard({
  show,
  isDevUnselectedPreview,
  selectedBenchId,
  activeFilter,
  parkedDrawerHeading,
  templateAuditSummary,
  filteredDescriptorAuditSummary,
  activeSectionMeasurementsMap
}) {
  if (!show || !templateAuditSummary || !filteredDescriptorAuditSummary) {
    return null;
  }

  const safeSectionMap = validObj(activeSectionMeasurementsMap);
  const groupSubtotals = validArray(templateAuditSummary.groupSubtotals);
  const filteredSubtotals = validArray(filteredDescriptorAuditSummary.groupSubtotals);

  return (
    <Card padding="400">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone="warning">DEV: Show All Template Fields</Badge>
            <Text as="h3" variant="headingMd" fontWeight="bold">
              Tab 3 Inspectable Inventory &amp; Rendered Row Audit ({isDevUnselectedPreview ? "Unselected New-Product Draft" : `Active Product: ${selectedBenchId}`} | Filter: {activeFilter})
            </Text>
          </InlineStack>
          <Badge tone={templateAuditSummary.measurementStatus === "complete" ? "success" : "attention"}>
            {templateAuditSummary.measurementStatus === "complete"
              ? `Measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups)`
              : `Measuring (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
          </Badge>
        </InlineStack>

        <Text as="p" variant="bodySm" tone="subdued">
          <strong>Scope:</strong> Counts below distinguish the complete 93-slot logical inventory (62 working capabilities + 31 parked/excluded entries across 11 drawers), full inventory rows (including per-image media expansion), filtered row descriptors matching <code>{activeFilter}</code>, bay expansion state, and scoped post-commit mounted DOM row elements. Collapsed drawers mount 0 DOM rows while preserving their full logical inventory.
        </Text>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "8px 10px" }}>Template Group</th>
                <th style={{ padding: "8px 10px" }}>Logical Slots</th>
                <th style={{ padding: "8px 10px" }}>Running Logical Subtotal</th>
                <th style={{ padding: "8px 10px" }}>Full Inventory Rows</th>
                <th style={{ padding: "8px 10px" }}>Filtered Descriptors ({activeFilter})</th>
                <th style={{ padding: "8px 10px" }}>Bay State</th>
                <th style={{ padding: "8px 10px" }}>Mounted DOM Rows</th>
                <th style={{ padding: "8px 10px" }}>Running Mounted DOM Subtotal</th>
                <th style={{ padding: "8px 10px" }}>Notes / Media Expansion</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let runningLogical = 0;
                let runningMountedDom = 0;
                let allDomMeasuredSoFar = true;

                return groupSubtotals.map((grp, idx) => {
                  runningLogical += grp.logicalCount;
                  const rawSecRec = safeSectionMap[grp.heading] || null;
                  const filteredGrp = filteredSubtotals[idx] || null;
                  const isGrpMeasured = grp.measurementStatus === "measured" && typeof grp.renderedCount === "number";
                  const isFilteredMeasured = filteredGrp && filteredGrp.measurementStatus === "measured" && typeof filteredGrp.renderedCount === "number";
                  const hasDomCount =
                    rawSecRec &&
                    typeof rawSecRec.mountedDomRowCount === "number" &&
                    Number.isFinite(rawSecRec.mountedDomRowCount);

                  if (isGrpMeasured && hasDomCount) {
                    runningMountedDom += rawSecRec.mountedDomRowCount;
                  } else {
                    allDomMeasuredSoFar = false;
                  }

                  const bayStateLabel =
                    !isGrpMeasured || typeof rawSecRec?.isExpanded !== "boolean"
                      ? "Not measured"
                      : rawSecRec.isExpanded
                        ? "Expanded"
                        : "Collapsed";

                  let rowNote = grp.heading === parkedDrawerHeading
                    ? "31 parked/excluded read-only registry slots"
                    : "1:1 canonical working rows";
                  if (!isGrpMeasured) {
                    rowNote = "Not measured";
                  } else if (grp.logicalImageAltCount > 0) {
                    const compatNote =
                      grp.compatibilityRenderedCount > 0
                        ? ` + ${grp.compatibilityRenderedCount} existing custom.alt_text compatibility row`
                        : "";
                    if (templateAuditSummary.mediaControlCount > 0) {
                      rowNote = `Includes ${templateAuditSummary.mediaControlCount} per-image media alt control(s) from 1 logical native_image_alt capability${compatNote}`;
                    } else if (templateAuditSummary.hasZeroImagePlaceholder) {
                      rowNote = `Includes 1 read-only zero-image placeholder row for native_image_alt${compatNote}`;
                    } else if (compatNote) {
                      rowNote = `Includes ${compatNote.slice(3)}`;
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
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                        {isFilteredMeasured ? filteredGrp.renderedCount : "Not measured"}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#475569" }}>
                        {bayStateLabel}
                      </td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                        {isGrpMeasured && hasDomCount ? rawSecRec.mountedDomRowCount : "Not measured"}
                      </td>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>
                        {allDomMeasuredSoFar ? runningMountedDom : "Not measured (incomplete)"}
                      </td>
                      <td style={{ padding: "6px 10px", color: "#475569" }}>{rowNote}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
            <tfoot>
              {(() => {
                let totalMountedDom = 0;
                let allGroupsHaveDomCount =
                  templateAuditSummary.measurementStatus === "complete" &&
                  templateAuditSummary.totalGroupCount > 0;
                if (allGroupsHaveDomCount) {
                  for (let i = 0; i < groupSubtotals.length; i += 1) {
                    const gHeading = groupSubtotals[i].heading;
                    const secRec = safeSectionMap[gHeading];
                    if (
                      secRec &&
                      typeof secRec.mountedDomRowCount === "number" &&
                      Number.isFinite(secRec.mountedDomRowCount)
                    ) {
                      totalMountedDom += secRec.mountedDomRowCount;
                    } else {
                      allGroupsHaveDomCount = false;
                      break;
                    }
                  }
                }
                return (
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
                      {filteredDescriptorAuditSummary.totalRenderedRows !== null
                        ? filteredDescriptorAuditSummary.totalRenderedRows
                        : `Not measured (${filteredDescriptorAuditSummary.measuredGroupCount}/${filteredDescriptorAuditSummary.totalGroupCount} groups reported)`}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {templateAuditSummary.measurementStatus === "complete" ? "Measured" : "Incomplete"}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                      {allGroupsHaveDomCount ? totalMountedDom : "Not measured"}
                    </td>
                    <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                      {allGroupsHaveDomCount ? totalMountedDom : "Not measured"}
                    </td>
                    <td style={{ padding: "8px 10px" }}>
                      {templateAuditSummary.mediaControlCount !== null
                        ? `Per-Image Media Controls: ${templateAuditSummary.mediaControlCount} | Zero-Image Placeholder: ${templateAuditSummary.hasZeroImagePlaceholder ? "1 (Active)" : "0"}${templateAuditSummary.compatibilityRowCount ? ` | Compat Rows: ${templateAuditSummary.compatibilityRowCount}` : ""}`
                        : "Media breakdown: Not measured"}
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </BlockStack>
    </Card>
  );
}

export function CorrectionImportFeedbackBanner({
  correctionImportFeedback,
  correctionImportFeedbackRef,
  onDismiss
}) {
  return (
    <div
      ref={correctionImportFeedbackRef}
      role={correctionImportFeedback?.tone === "critical" ? "alert" : "status"}
      aria-live={correctionImportFeedback?.tone === "critical" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {correctionImportFeedback && (
        <Banner
          tone={correctionImportFeedback.tone || "info"}
          title={correctionImportFeedback.title}
          onDismiss={onDismiss}
        >
          <BlockStack gap="150">
            <Text as="p" variant="bodySm">
              {correctionImportFeedback.message}
            </Text>

            {Array.isArray(correctionImportFeedback.appliedItems) &&
              correctionImportFeedback.appliedItems.length > 0 && (
                <details open>
                  <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "12px", color: "#166534" }}>
                    {`Staged Corrections (${correctionImportFeedback.appliedItems.length}) \u2014 Click to inspect field diffs`}
                  </summary>
                  <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#14532d" }}>
                    {correctionImportFeedback.appliedItems.map((item, idx) => (
                      <div key={`corr-app-${idx}`} style={{ wordBreak: "break-word" }}>
                        {"\u2022"} <strong>{item.fieldLabel || item.fieldKey}</strong> (<code>{item.fieldKey}</code> &rarr; <code>{item.targetKeyForProposal}</code>):{" "}
                        <strong>Proposed:</strong> &quot;{item.normalizedValue.length > 180 ? `${item.normalizedValue.slice(0, 180)}\u2026` : item.normalizedValue}&quot;{" "}
                        <span style={{ color: "#475569" }}>
                          [Reason: {item.reason}]
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

            {Array.isArray(correctionImportFeedback.rejectedItems) &&
              correctionImportFeedback.rejectedItems.length > 0 && (
                <details open>
                  <summary style={{ cursor: "pointer", fontWeight: "700", fontSize: "12px", color: "#991b1b" }}>
                    {`Rejected Items (${correctionImportFeedback.rejectedItems.length}) \u2014 Entire file rejected; 0 fields modified`}
                  </summary>
                  <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "#991b1b" }}>
                    {correctionImportFeedback.rejectedItems.map((rej, idx) => (
                      <div key={`corr-rej-${idx}`} style={{ wordBreak: "break-word" }}>
                        {"\u2022"} <strong>{rej.fieldKey || `Item #${rej.index ?? idx}`}</strong>{" "}
                        (<code>{rej.code}</code>): {rej.reason}
                      </div>
                    ))}
                  </div>
                </details>
              )}
          </BlockStack>
        </Banner>
      )}
    </div>
  );
}
// ============================================================================
// FILE: app/components/SidekickQueueCalmView.jsx
// ROCKHOUND STUDIO — CALM, DYSLEXIA-FRIENDLY RESEARCH & JOB QUEUE VIEW
//
// Pure presentation component using @shopify/polaris ^13.9.5 and React 18.3.1.
// Zero Admin GraphQL code, zero mutations, zero network calls, zero server-only
// imports, and zero new npm dependencies.
//
// Consumes the exact card models produced by:
//   app/utils/sidekick-research-storage.server.js -> buildCalmResearchCardModel
// and scopes active submission + actionData outcome overlays strictly to the
// matching card while preserving permanent client-side run locks once a card
// is claimed, executed, uncertain, or completed—except where current queue
// and storage projections explicitly permit a deliberate merchant retry of a
// confirmed completed failure.
// ============================================================================

import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
  Banner,
  Collapsible,
  Divider,
  EmptySearchResult,
  IndexTable,
} from "@shopify/polaris";

const PERMANENT_NO_RETRY_REQUEST_ID = "gid://shopify/Metaobject/668923920635";
const PERMANENT_NO_RETRY_CLAIM_ID = "claim_1795664331063_3bf19091";

const PRE_DISPATCH_ELIGIBLE_STATUSES = new Set([
  "queued",
  "failed_pre_dispatch",
]);

function normalizeCleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStatusString(value) {
  const cleaned = normalizeCleanString(value).toLowerCase();
  return cleaned || null;
}

function isPostDispatchOutcomeOrStatus(value) {
  const s = normalizeStatusString(value);
  if (!s) {
    return false;
  }
  return !PRE_DISPATCH_ELIGIBLE_STATUSES.has(s);
}

async function writeTextToClipboard(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea copy fallback for embedded iframe focus quirks
    }
  }
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    try {
      textarea.select();
      const succeeded = document.execCommand("copy");
      return Boolean(succeeded);
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
  return false;
}

/**
 * Evaluates whether a card already carries server-reported claim, execution,
 * uncertain, or completion evidence that forbids offering a first-run Run.
 */
function hasCardRunLockEvidence(card) {
  if (!card || typeof card !== "object") {
    return false;
  }
  const id = normalizeCleanString(card.id);
  const tech = card.technicalDetails || {};
  const claimId = normalizeCleanString(tech.claimId);
  const reportId = normalizeCleanString(tech.reportId);
  const executedAt = normalizeCleanString(tech.executedAt);
  const rawStatus =
    normalizeStatusString(tech.rawStatus || card.rawStatus) || "queued";

  if (
    id === PERMANENT_NO_RETRY_REQUEST_ID ||
    claimId === PERMANENT_NO_RETRY_CLAIM_ID
  ) {
    return true;
  }

  if (
    claimId ||
    reportId ||
    executedAt ||
    Boolean(card.durablySaved) ||
    Boolean(card.hasRamVaultCopy) ||
    Boolean(card.cacheReadableNow)
  ) {
    return true;
  }

  if (!PRE_DISPATCH_ELIGIBLE_STATUSES.has(rawStatus)) {
    return true;
  }

  return false;
}

/**
 * Evaluates whether an actionData payload for a specific card proves that the
 * card has been claimed, dispatched, uncertain, or completed—even if Shopify
 * status writeback failed (status === null, statusPersisted === false) or
 * loader revalidation is momentarily stale.
 */
function extractLatchFromActionData(actionData, cardId) {
  const targetId = normalizeCleanString(cardId);
  if (
    !targetId ||
    !actionData ||
    typeof actionData !== "object" ||
    normalizeCleanString(actionData.metaobjectId) !== targetId
  ) {
    return null;
  }

  const intent = normalizeCleanString(actionData.intent);
  const claimId = normalizeCleanString(actionData.claimId) || null;
  const executionOutcome = normalizeStatusString(actionData.executionOutcome);
  const confirmedStatus =
    typeof actionData.status === "string" && actionData.status.trim()
      ? actionData.status.trim().toLowerCase()
      : null;
  const statusPersisted =
    typeof actionData.statusPersisted === "boolean"
      ? actionData.statusPersisted
      : null;
  const reportId = normalizeCleanString(actionData.reportId) || null;
  const expectedReportId =
    normalizeCleanString(actionData.expectedReportId) || null;
  const durablySaved = actionData.durablySaved === true;
  const code = normalizeCleanString(actionData.code) || null;
  const eligibilityCode =
    normalizeCleanString(actionData.eligibilityCode) || null;
  const retryEligible =
    typeof actionData.retryEligible === "boolean"
      ? actionData.retryEligible
      : null;
  const retryEligibilityCode =
    normalizeCleanString(actionData.retryEligibilityCode) || null;
  const failureDiagnostics =
    actionData.failureDiagnostics &&
    typeof actionData.failureDiagnostics === "object"
      ? actionData.failureDiagnostics
      : null;

  const lockRunForever = Boolean(
    targetId === PERMANENT_NO_RETRY_REQUEST_ID ||
      claimId ||
      reportId ||
      expectedReportId ||
      durablySaved ||
      intent === "repairPublication" ||
      isPostDispatchOutcomeOrStatus(executionOutcome) ||
      isPostDispatchOutcomeOrStatus(confirmedStatus) ||
      eligibilityCode === "saved_report_field_present" ||
      eligibilityCode === "execution_evidence_present"
  );

  return {
    intent: intent || null,
    ok: Boolean(actionData.ok),
    warning: Boolean(actionData.warning),
    claimId,
    executionOutcome,
    confirmedStatus,
    statusPersisted,
    reportId,
    expectedReportId,
    durablySaved,
    code,
    eligibilityCode,
    retryEligible,
    retryEligibilityCode,
    failureDiagnostics,
    message: normalizeCleanString(actionData.message) || null,
    error: normalizeCleanString(actionData.error) || null,
    lockRunForever,
  };
}

/**
 * Merges server loader card state with scoped live submission state,
 * matching actionData overlay, and sticky session run-lock memory without
 * fabricating persistence or overwriting canonical report identity.
 */
function deriveEffectiveCardView({
  card,
  isSubmittingThisCard,
  submittingIntentForCard,
  cardActionOverlay,
  latchedRecord,
}) {
  const tech = card.technicalDetails || {};
  const id = normalizeCleanString(card.id);
  const isPinnedUncertainRecord =
    id === PERMANENT_NO_RETRY_REQUEST_ID ||
    normalizeCleanString(tech.claimId) === PERMANENT_NO_RETRY_CLAIM_ID ||
    latchedRecord?.claimId === PERMANENT_NO_RETRY_CLAIM_ID;

  const baseServerLocked = hasCardRunLockEvidence(card);
  const runPermanentlyLocked = Boolean(
    isPinnedUncertainRecord ||
      baseServerLocked ||
      cardActionOverlay?.lockRunForever ||
      latchedRecord?.lockRunForever
  );

  // Preserve original durable/expected report identity first; never overwrite
  // an existing card/expected reportId with a conflicting republished ID.
  const serverReportId = normalizeCleanString(tech.reportId) || null;
  const overlayExpectedReportId =
    cardActionOverlay?.expectedReportId ||
    latchedRecord?.expectedReportId ||
    null;
  const overlayActualReportId =
    cardActionOverlay?.reportId || latchedRecord?.reportId || null;

  const reportIdConflictDetected = Boolean(
    (cardActionOverlay?.code === "republished_report_id_mismatch" ||
      cardActionOverlay?.code === "saved_report_id_conflict") ||
      (overlayExpectedReportId &&
        overlayActualReportId &&
        overlayExpectedReportId !== overlayActualReportId) ||
      (serverReportId &&
        overlayActualReportId &&
        serverReportId !== overlayActualReportId)
  );

  const canonicalReportId =
    serverReportId ||
    overlayExpectedReportId ||
    (!reportIdConflictDetected ? overlayActualReportId : null) ||
    null;

  const effectiveClaimId =
    normalizeCleanString(tech.claimId) ||
    cardActionOverlay?.claimId ||
    latchedRecord?.claimId ||
    (isPinnedUncertainRecord ? PERMANENT_NO_RETRY_CLAIM_ID : null);

  // Answer Saved requires verified durable-save evidence ONLY—never inferred
  // from ok=true, status="completed", or RAM cache presence alone.
  const verifiedDurablySaved = Boolean(
    !isPinnedUncertainRecord &&
      (card.durablySaved === true ||
        cardActionOverlay?.durablySaved === true ||
        latchedRecord?.durablySaved === true)
  );

  const activeOverlay = cardActionOverlay || latchedRecord || null;

  // Confirmed stored Shopify status vs execution outcome
  const loaderRawStatus =
    normalizeStatusString(tech.rawStatus || card.rawStatus) || "queued";
  let confirmedSavedStatus = loaderRawStatus;
  let statusPersistedState = true;

  if (activeOverlay) {
    if (activeOverlay.statusPersisted === false) {
      statusPersistedState = false;
      confirmedSavedStatus = activeOverlay.confirmedStatus || null;
    } else if (activeOverlay.confirmedStatus) {
      confirmedSavedStatus = activeOverlay.confirmedStatus;
      statusPersistedState = activeOverlay.statusPersisted !== false;
    } else if (activeOverlay.statusPersisted === null && activeOverlay.error) {
      // E.g. 404 read failure where server explicitly returned status: null
      confirmedSavedStatus = null;
      statusPersistedState = false;
    }
  }

  const executionOutcome = activeOverlay?.executionOutcome || null;

  const isUncertainOrRunningCase = Boolean(
    isPinnedUncertainRecord ||
      confirmedSavedStatus === "running" ||
      executionOutcome === "running" ||
      confirmedSavedStatus === "uncertain_no_retry" ||
      executionOutcome === "uncertain_no_retry" ||
      String(confirmedSavedStatus || "").startsWith("uncertain") ||
      String(executionOutcome || "").startsWith("uncertain")
  );

  const overlayDisallowsRetry = Boolean(
    cardActionOverlay?.retryEligible === false ||
      (cardActionOverlay && !cardActionOverlay.ok && isUncertainOrRunningCase)
  );

  const isRetryEligibleCompletedFailure = Boolean(
    !isUncertainOrRunningCase &&
      !overlayDisallowsRetry &&
      card.retryEligibleCompletedFailure === true &&
      !verifiedDurablySaved &&
      !canonicalReportId &&
      !card.hasRamVaultCopy
  );

  // RAM cache readability: true from loader check, or when current action
  // cleanly published/reloaded cache without an ID mismatch.
  const ramCacheActive = Boolean(
    card.cacheReadableNow ||
      (activeOverlay?.ok &&
        !reportIdConflictDetected &&
        (activeOverlay.executionOutcome === "completed" ||
          activeOverlay.executionOutcome === "completed_unsaved"))
  );

  // Start from loader's presentation fields
  let badgeLabel = card.badgeLabel || "Needs Check";
  let badgeTone = card.badgeTone || "info";
  let statusHelperText = card.statusHelperText || "";
  let primaryAction = card.primaryAction ? { ...card.primaryAction } : null;
  let secondaryAction = card.secondaryAction
    ? { ...card.secondaryAction }
    : null;

  // Hard lock for uncertain_no_retry pin (668923920635) regardless of props
  if (isPinnedUncertainRecord) {
    badgeLabel = "Timed Out — Do Not Auto-Retry";
    badgeTone = "critical";
    statusHelperText =
      "Connection dropped or timed out after sending. To prevent double charges, this record stays locked—create a new request if needed.";
    primaryAction = card.copyPlainText
      ? { kind: "copy", label: "Copy Answer" }
      : null;
    secondaryAction = null;
  } else if (isSubmittingThisCard) {
    // Scoped in-flight submission state ONLY for this matching card
    if (submittingIntentForCard === "runResearch") {
      badgeLabel = "Running...";
      badgeTone = "info";
      statusHelperText =
        "Searching public web sources now. Please wait—do not close or resend.";
    } else if (submittingIntentForCard === "retryResearch") {
      badgeLabel = "Retrying...";
      badgeTone = "info";
      statusHelperText =
        "Sending one deliberate retry after preserving prior attempt details. Please wait—do not close or resend.";
    } else if (submittingIntentForCard === "repairPublication") {
      badgeLabel = "Saving / Reloading (Free)...";
      badgeTone = "info";
      statusHelperText =
        "Updating Shopify save or 30-minute Sidekick RAM cache with zero Gemini API calls.";
    }
  } else if (verifiedDurablySaved) {
    // Verified durable save evidence present
    badgeLabel = ramCacheActive
      ? "Answer Saved (Live for Sidekick)"
      : "Answer Saved";
    badgeTone = "success";
    if (statusPersistedState === false) {
      statusHelperText =
        "Saved report verified in Shopify and reloaded in 30-minute Sidekick RAM cache, though status metadata field update was not confirmed.";
    } else {
      statusHelperText = ramCacheActive
        ? "Saved permanently in Shopify (verified readback) and active in 30-minute Sidekick RAM cache."
        : "Saved permanently in Shopify (verified readback). Copy anytime, or click Reload for Sidekick (zero cost).";
    }
    if (!primaryAction || primaryAction.kind === "run") {
      primaryAction = card.copyPlainText
        ? { kind: "copy", label: "Copy Answer" }
        : null;
    }
    if (secondaryAction?.kind === "run") {
      secondaryAction = null;
    }
  } else if (
    activeOverlay &&
    (executionOutcome === "completed_unsaved" ||
      executionOutcome === "completed_cache_failed" ||
      (executionOutcome === "completed" && !verifiedDurablySaved))
  ) {
    // Executed in RAM, NOT verified durably saved in Shopify -> never show Answer Saved
    if (executionOutcome === "completed_cache_failed") {
      badgeLabel = "Completed in Memory — Cache & Save Pending";
      badgeTone = "warning";
      statusHelperText =
        "Research finished in temporary server memory, but permanent Shopify save and 30-minute Sidekick cache are not confirmed yet.";
    } else {
      badgeLabel = ramCacheActive
        ? "Temporary 30-Min RAM Only — Not Saved Yet"
        : "Completed — Not Permanently Saved";
      badgeTone = "attention";
      statusHelperText =
        "Active in temporary 30-minute Sidekick RAM only—permanent Shopify save is NOT verified yet. Copy or click Save Answer (Free).";
    }

    if (card.copyPlainText) {
      primaryAction = { kind: "copy", label: "Copy Answer" };
      secondaryAction = {
        kind: "republish",
        label: "Save Answer & Reload Cache (Free)",
      };
    } else {
      primaryAction = {
        kind: "republish",
        label: "Save Answer & Reload Cache (Free)",
      };
      secondaryAction = null;
    }
  } else if (isRetryEligibleCompletedFailure) {
    badgeLabel =
      confirmedSavedStatus === "failed_provider_http"
        ? "Provider Error — Retry Available"
        : "Ungrounded — Retry Available";
    badgeTone = "warning";
    statusHelperText =
      "Previous attempt did not produce a saved grounded answer. Click Retry Research only when ready to send one deliberate retry.";
    primaryAction = { kind: "retry", label: "Retry Research" };
    secondaryAction = null;
  } else if (
    activeOverlay &&
    !activeOverlay.ok &&
    runPermanentlyLocked &&
    !card.durablySaved
  ) {
    // Claimed, post-dispatch failed, uncertain, or conflict: strip Run permanently
    if (
      executionOutcome === "uncertain_no_retry" ||
      confirmedSavedStatus === "uncertain_no_retry"
    ) {
      badgeLabel =
        statusPersistedState === false
          ? "Timed Out — Locked (Status Write Unconfirmed)"
          : "Timed Out — Do Not Auto-Retry";
      badgeTone = "critical";
      statusHelperText =
        statusPersistedState === false
          ? "Request was already claimed before connection dropped, and Shopify status writeback failed. Locked against retry to prevent double charges."
          : "Connection dropped or timed out after sending. Locked against retry to prevent double charges.";
    } else if (reportIdConflictDetected) {
      badgeLabel = "Report ID Conflict — Locked";
      badgeTone = "warning";
      statusHelperText =
        "Saved Report ID did not match expected identity. Original ID preserved and paid reruns remain locked.";
    } else if (confirmedSavedStatus === "running") {
      badgeLabel = "Running...";
      badgeTone = "info";
      statusHelperText =
        "Already running in this server worker. Please wait for completion.";
    } else if (
      isPostDispatchOutcomeOrStatus(executionOutcome) ||
      effectiveClaimId
    ) {
      badgeLabel =
        statusPersistedState === false
          ? "Stopped After Claim — Status Unconfirmed"
          : "Stopped — Locked Against Re-Run";
      badgeTone = "critical";
      statusHelperText =
        statusPersistedState === false
          ? "Execution stopped after claim was issued, and Shopify status writeback was not confirmed. Record stays locked against duplicate API spend."
          : activeOverlay.error ||
            "This request already ran or holds a claim and cannot be dispatched again.";
    }
  } else if (
    activeOverlay &&
    !activeOverlay.ok &&
    executionOutcome === "failed_pre_dispatch" &&
    !runPermanentlyLocked
  ) {
    // Legitimate pre-dispatch check failure (e.g., missing env key or input length)
    if (activeOverlay.code === "missing_gemini_api_key") {
      badgeLabel = "Server Key Needed Before Run";
      badgeTone = "warning";
      statusHelperText =
        "No claim was written and no API call was sent. Configure GEMINI_API_KEY on the server, then click Run Research.";
    } else {
      badgeLabel = "Edit Input Before Running";
      badgeTone = "warning";
      statusHelperText =
        activeOverlay.error ||
        "Validation stopped before API dispatch. Edit in Shopify Admin and Save.";
      primaryAction = null;
      secondaryAction = null;
    }
  }

  // Final ironclad gate: if locked for ANY reason, first-run Run action can
  // NEVER survive stale loader props, failed writebacks, null statuses, or
  // navigation settles. Retry is allowed ONLY when explicitly projected as a
  // retry-eligible completed failure and never for uncertain/running cases.
  if (runPermanentlyLocked) {
    if (primaryAction?.kind === "run") {
      primaryAction = card.copyPlainText
        ? { kind: "copy", label: "Copy Answer" }
        : null;
    }
    if (secondaryAction?.kind === "run") {
      secondaryAction = null;
    }
    if (badgeLabel === "Ready to Run") {
      badgeLabel =
        confirmedSavedStatus === "running"
          ? "Running..."
          : "Locked — Already Claimed";
      badgeTone = confirmedSavedStatus === "running" ? "info" : "warning";
      statusHelperText =
        "This request has already been claimed or executed and cannot be run again.";
    }
  }

  if (primaryAction?.kind === "retry" && !isRetryEligibleCompletedFailure) {
    primaryAction = null;
  }
  if (secondaryAction?.kind === "retry" && !isRetryEligibleCompletedFailure) {
    secondaryAction = null;
  }

  // Never display an ungrounded failed attempt as a saved/grounded answer.
  const hasUngroundedFailureSignal = Boolean(
    !verifiedDurablySaved &&
      (confirmedSavedStatus === "failed_ungrounded" ||
        confirmedSavedStatus === "failed_provider_http" ||
        executionOutcome === "failed_ungrounded" ||
        executionOutcome === "failed_provider_http")
  );

  const attemptHistoryList = Array.isArray(card.attemptHistoryEntries)
    ? card.attemptHistoryEntries.filter(
        (entry) => typeof entry === "string" && entry.trim().length > 0
      )
    : [];

  const overlayDiagSummary =
    typeof cardActionOverlay?.failureDiagnostics?.summaryLine === "string" &&
    cardActionOverlay.failureDiagnostics.summaryLine.trim()
      ? cardActionOverlay.failureDiagnostics.summaryLine.trim()
      : null;
  const techGrounding = normalizeCleanString(tech.groundingSummary) || null;
  const techError = normalizeCleanString(tech.errorDetail) || null;

  const latestDiagnosticLine =
    overlayDiagSummary ||
    (hasUngroundedFailureSignal ? techGrounding || techError : techGrounding) ||
    null;

  return {
    isPinnedUncertainRecord,
    runPermanentlyLocked,
    isRetryEligibleCompletedFailure,
    isUncertainOrRunningCase,
    verifiedDurablySaved,
    hasUngroundedFailureSignal,
    ramCacheActive,
    badgeLabel,
    badgeTone,
    statusHelperText,
    primaryAction,
    secondaryAction,
    canonicalReportId,
    conflictingAttemptReportId: reportIdConflictDetected
      ? overlayActualReportId
      : null,
    expectedReportId: overlayExpectedReportId,
    effectiveClaimId,
    confirmedSavedStatus,
    statusPersistedState,
    executionOutcome,
    latestDiagnosticLine,
    attemptHistoryList,
  };
}

function ResearchRequestCalmCard({
  card,
  isSubmittingThisCard = false,
  submittingIntentForCard = null,
  isAnyActionSubmitting = false,
  cardActionData = null,
  latchedRecord = null,
  onRunResearch,
  onRetryResearch,
  onRepairOrRepublish,
}) {
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const detailsDomId = `research-tech-details-${card.shortId || "item"}`;

  const cardActionOverlay = extractLatchFromActionData(cardActionData, card.id);

  const view = deriveEffectiveCardView({
    card,
    isSubmittingThisCard,
    submittingIntentForCard,
    cardActionOverlay,
    latchedRecord,
  });

  const handleCopyClick = useCallback(async () => {
    if (!card.copyPlainText) {
      return;
    }
    const ok = await writeTextToClipboard(card.copyPlainText);
    setCopyFeedback(ok ? "Copied!" : "Copy blocked — select text below");
    setTimeout(() => {
      setCopyFeedback((prev) => (prev === "Copied!" ? null : prev));
    }, 3500);
  }, [card.copyPlainText]);

  const executeCardAction = useCallback(
    (actionSpec) => {
      if (!actionSpec) {
        return;
      }
      if (actionSpec.kind === "copy") {
        handleCopyClick();
        return;
      }
      if (actionSpec.kind === "run") {
        if (
          view.runPermanentlyLocked ||
          view.isPinnedUncertainRecord ||
          isAnyActionSubmitting
        ) {
          return;
        }
        if (typeof onRunResearch === "function") {
          onRunResearch(card.id);
        }
        return;
      }
      if (actionSpec.kind === "retry") {
        if (
          view.isUncertainOrRunningCase ||
          !view.isRetryEligibleCompletedFailure ||
          isAnyActionSubmitting
        ) {
          return;
        }
        if (typeof onRetryResearch === "function") {
          onRetryResearch(card.id);
        }
        return;
      }
      if (actionSpec.kind === "republish") {
        if (view.isPinnedUncertainRecord || isAnyActionSubmitting) {
          return;
        }
        if (typeof onRepairOrRepublish === "function") {
          onRepairOrRepublish(card.id);
        }
      }
    },
    [
      card.id,
      handleCopyClick,
      isAnyActionSubmitting,
      onRepairOrRepublish,
      onRetryResearch,
      onRunResearch,
      view.isPinnedUncertainRecord,
      view.isRetryEligibleCompletedFailure,
      view.isUncertainOrRunningCase,
      view.runPermanentlyLocked,
    ]
  );

  const isPrimaryLoading = Boolean(
    isSubmittingThisCard &&
      view.primaryAction &&
      view.primaryAction.kind !== "copy" &&
      ((view.primaryAction.kind === "run" &&
        submittingIntentForCard === "runResearch") ||
        (view.primaryAction.kind === "retry" &&
          submittingIntentForCard === "retryResearch") ||
        (view.primaryAction.kind === "republish" &&
          submittingIntentForCard === "repairPublication"))
  );

  const isSecondaryLoading = Boolean(
    isSubmittingThisCard &&
      view.secondaryAction &&
      view.secondaryAction.kind !== "copy" &&
      ((view.secondaryAction.kind === "run" &&
        submittingIntentForCard === "runResearch") ||
        (view.secondaryAction.kind === "retry" &&
          submittingIntentForCard === "retryResearch") ||
        (view.secondaryAction.kind === "republish" &&
          submittingIntentForCard === "repairPublication"))
  );

  const primaryBtnLabel =
    view.primaryAction?.kind === "copy" && copyFeedback === "Copied!"
      ? "Copied!"
      : view.primaryAction?.label || null;

  const primaryBtnTone =
    view.primaryAction?.kind === "run" || view.primaryAction?.kind === "retry"
      ? "success"
      : undefined;

  const tech = card.technicalDetails || {};
  const usableSources = Array.isArray(card.sources) ? card.sources : [];
  const searchQueries = Array.isArray(card.webSearchQueries)
    ? card.webSearchQueries
    : [];

  return (
    <Card padding="400">
      <BlockStack gap="400">
        {/* 1. CLEAR TOP BAR: PLAIN STATUS BADGE + EXPLICIT MERCHANT ACTIONS */}
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
          <InlineStack gap="200" blockAlign="center" wrap>
            <Badge tone={view.badgeTone}>{view.badgeLabel}</Badge>
            {card.requestKey && <Badge tone="info">{card.requestKey}</Badge>}
          </InlineStack>

          <InlineStack gap="200" blockAlign="center" wrap>
            {view.primaryAction && (
              <Button
                variant="primary"
                tone={primaryBtnTone}
                size="large"
                loading={isPrimaryLoading}
                disabled={
                  view.primaryAction.kind === "copy"
                    ? !card.copyPlainText
                    : Boolean(isAnyActionSubmitting) ||
                      (view.primaryAction.kind === "run" &&
                        view.runPermanentlyLocked) ||
                      (view.primaryAction.kind === "retry" &&
                        (!view.isRetryEligibleCompletedFailure ||
                          view.isUncertainOrRunningCase))
                }
                onClick={() => executeCardAction(view.primaryAction)}
              >
                {primaryBtnLabel}
              </Button>
            )}

            {view.secondaryAction && (
              <Button
                variant="secondary"
                loading={isSecondaryLoading}
                disabled={
                  view.secondaryAction.kind === "copy"
                    ? !card.copyPlainText
                    : Boolean(isAnyActionSubmitting) ||
                      (view.secondaryAction.kind === "run" &&
                        view.runPermanentlyLocked) ||
                      (view.secondaryAction.kind === "retry" &&
                        (!view.isRetryEligibleCompletedFailure ||
                          view.isUncertainOrRunningCase))
                }
                onClick={() => executeCardAction(view.secondaryAction)}
              >
                {view.secondaryAction.label}
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {/* SCOPED PER-CARD ACTION FEEDBACK (NEVER LEAKS ACROSS OTHER CARDS) */}
        {cardActionOverlay?.error && !isSubmittingThisCard && (
          <Banner tone="critical" title="Request update notice">
            <Text as="p" variant="bodyMd">
              {cardActionOverlay.error}
            </Text>
          </Banner>
        )}

        {cardActionOverlay?.ok &&
          cardActionOverlay?.message &&
          !isSubmittingThisCard && (
            <Banner
              tone={
                cardActionOverlay.warning || !view.verifiedDurablySaved
                  ? "warning"
                  : "success"
              }
              title={
                view.verifiedDurablySaved && !cardActionOverlay.warning
                  ? "Answer Saved"
                  : "Temporary RAM Update — Check Save Note"
              }
            >
              <Text as="p" variant="bodyMd">
                {cardActionOverlay.message}
              </Text>
            </Banner>
          )}

        {copyFeedback && copyFeedback !== "Copied!" && (
          <Banner tone="warning" onDismiss={() => setCopyFeedback(null)}>
            <Text as="p" variant="bodyMd">
              {copyFeedback}
            </Text>
          </Banner>
        )}

        {/* 2. PLAIN QUESTION + CONCISE CALM HELPER LINE + DIAGNOSTICS/HISTORY */}
        <BlockStack gap="150">
          <Text as="h3" variant="headingMd">
            {card.query || "(Empty question)"}
          </Text>
          {card.constraints && (
            <Text as="p" variant="bodyMd" tone="subdued">
              Scope: {card.constraints}
            </Text>
          )}
          {view.statusHelperText && (
            <Text as="p" variant="bodySm" tone="subdued">
              {view.statusHelperText}
            </Text>
          )}
          {view.latestDiagnosticLine && !view.verifiedDurablySaved && (
            <Text as="p" variant="bodySm" tone="subdued">
              Diagnostics: {view.latestDiagnosticLine}
            </Text>
          )}
          {view.attemptHistoryList.length > 0 && (
            <BlockStack gap="050">
              <Text as="p" variant="bodySm" tone="subdued">
                Previous attempts ({view.attemptHistoryList.length}):
              </Text>
              {view.attemptHistoryList.map((entry, idx) => (
                <Text
                  key={`${card.id}_attempt_${idx}`}
                  as="p"
                  variant="bodySm"
                  tone="subdued"
                >
                  • {entry}
                </Text>
              ))}
            </BlockStack>
          )}
        </BlockStack>

        {/* 3. READABLE ANSWER + ACCESSIBLE SOURCES + SANDBOXED SEARCH SUGGESTIONS */}
        {(card.answerText ||
          usableSources.length > 0 ||
          card.searchEntryPointHtml) && (
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" tone="subdued">
                {view.hasUngroundedFailureSignal
                  ? "Ungrounded attempt output — NOT a verified grounded answer."
                  : "Web synthesis — verify important facts against cited links. Highlighted spans are AI summaries, not direct quotes."}
              </Text>

              {card.answerText && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.65",
                    maxWidth: "74ch",
                  }}
                >
                  <Text as="p" variant="bodyMd">
                    {card.answerText}
                    {card.isAnswerPreviewTruncated
                      ? "... (Preview only — full answer was not durably saved)"
                      : ""}
                  </Text>
                </div>
              )}

              {usableSources.length > 0 && (
                <BlockStack gap="150">
                  <Divider />
                  <Text as="h4" variant="headingSm">
                    Web Sources ({usableSources.length})
                  </Text>
                  <BlockStack gap="100">
                    {usableSources.map((src, sIdx) => {
                      const labelIndex =
                        typeof src.chunkIndex === "number"
                          ? src.chunkIndex
                          : sIdx;
                      return (
                        <Text
                          key={`${card.id}_src_${labelIndex}`}
                          as="p"
                          variant="bodyMd"
                        >
                          [{labelIndex}]{" "}
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {src.title || src.uri}
                          </a>
                        </Text>
                      );
                    })}
                  </BlockStack>
                </BlockStack>
              )}

              {card.searchEntryPointHtml && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Google Search Suggestions (isolated preview):
                  </Text>
                  <iframe
                    title={`Google Search Suggestions ${card.shortId || ""}`}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                    srcDoc={card.searchEntryPointHtml}
                    style={{
                      width: "100%",
                      minHeight: "76px",
                      border: "1px solid #dfe3e8",
                      borderRadius: "8px",
                      background: "#ffffff",
                    }}
                  />
                </BlockStack>
              )}
            </BlockStack>
          </Box>
        )}

        {/* 4. COLLAPSED TECHNICAL DETAILS (IDs, EXECUTION VS CONFIRMED STATUS) */}
        <Box>
          <Button
            variant="plain"
            onClick={() => setTechDetailsOpen((open) => !open)}
            ariaExpanded={techDetailsOpen}
            ariaControls={detailsDomId}
          >
            {techDetailsOpen
              ? "Hide Technical Details"
              : "Show Technical Details"}
          </Button>

          <Collapsible
            open={techDetailsOpen}
            id={detailsDomId}
            transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
          >
            <Box
              padding="300"
              background="bg-surface-secondary"
              borderRadius="150"
            >
              <BlockStack gap="150">
                <Text as="p" variant="bodySm">
                  <strong>Request ID:</strong>{" "}
                  <code>{tech.metaobjectId || card.id}</code>
                </Text>
                <Text as="p" variant="bodySm">
                  <strong>Confirmed Stored Status:</strong>{" "}
                  <code>
                    {view.confirmedSavedStatus
                      ? view.confirmedSavedStatus
                      : "unconfirmed (null — Shopify status write not confirmed)"}
                  </code>
                  {view.statusPersistedState === false
                    ? " — writeback not confirmed"
                    : ""}
                </Text>
                {view.executionOutcome && (
                  <Text as="p" variant="bodySm">
                    <strong>Latest Execution Outcome:</strong>{" "}
                    <code>{view.executionOutcome}</code>
                  </Text>
                )}
                <Text as="p" variant="bodySm">
                  <strong>Durable Shopify Save Verified:</strong>{" "}
                  {view.verifiedDurablySaved
                    ? "Yes (exact readback match)"
                    : `No (${tech.durableParseCode || "not saved"})`}
                </Text>
                <Text as="p" variant="bodySm">
                  <strong>30-Minute Sidekick RAM Cache:</strong>{" "}
                  {view.ramCacheActive ? "Active" : "Not in RAM / Expired"}
                </Text>
                {view.canonicalReportId && (
                  <Text as="p" variant="bodySm">
                    <strong>Report ID:</strong>{" "}
                    <code>{view.canonicalReportId}</code>
                  </Text>
                )}
                {view.expectedReportId &&
                  view.expectedReportId !== view.canonicalReportId && (
                    <Text as="p" variant="bodySm">
                      <strong>Expected Durable Report ID:</strong>{" "}
                      <code>{view.expectedReportId}</code>
                    </Text>
                  )}
                {view.conflictingAttemptReportId && (
                  <Text as="p" variant="bodySm" tone="critical">
                    <strong>Rejected Conflicting Cache ID:</strong>{" "}
                    <code>{view.conflictingAttemptReportId}</code> (saved ID was
                    preserved)
                  </Text>
                )}
                {tech.executedAt && (
                  <Text as="p" variant="bodySm">
                    <strong>Executed At:</strong> {tech.executedAt}
                  </Text>
                )}
                {view.effectiveClaimId && (
                  <Text as="p" variant="bodySm">
                    <strong>Claim ID:</strong>{" "}
                    <code>{view.effectiveClaimId}</code>
                  </Text>
                )}
                {tech.groundingSummary && (
                  <Text as="p" variant="bodySm">
                    <strong>Grounding Summary:</strong> {tech.groundingSummary}
                  </Text>
                )}
                {view.attemptHistoryList.length > 0 && (
                  <BlockStack gap="050">
                    <Text as="p" variant="bodySm">
                      <strong>Attempt History:</strong>
                    </Text>
                    {view.attemptHistoryList.map((entry, idx) => (
                      <Text
                        key={`${card.id}_tech_attempt_${idx}`}
                        as="p"
                        variant="bodySm"
                      >
                        • <code>{entry}</code>
                      </Text>
                    ))}
                  </BlockStack>
                )}
                {searchQueries.length > 0 && (
                  <Text as="p" variant="bodySm">
                    <strong>Search Queries Used:</strong>{" "}
                    {searchQueries.join(" | ")}
                  </Text>
                )}
                {tech.errorDetail && (
                  <Text as="p" variant="bodySm" tone="critical">
                    <strong>System Note / Error:</strong> {tech.errorDetail}
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Collapsible>
        </Box>
      </BlockStack>
    </Card>
  );
}

export default function SidekickQueueCalmView({
  researchDefinitionReady = false,
  researchCards = [],
  jobs = [],
  queueError = null,
  researchLoaderError = null,
  actionData = null,
  revalidatorState = "idle",
  isSubmittingAction = false,
  submittingIntent = null,
  submittingMetaobjectId = null,
  onNavigateBack,
  onRefresh,
  onSetupDefinition,
  onRunResearch,
  onRetryResearch,
  onRepairOrRepublish,
}) {
  const [systemToolsOpen, setSystemToolsOpen] = useState(false);

  // Sticky client-side latch so any card that was claimed, executed, uncertain,
  // or completed during this browser session NEVER regains a first-run Run
  // button even if Shopify status writeback failed or loader data has not
  // caught up yet.
  const [latchedByCardId, setLatchedByCardId] = useState(() => ({
    [PERMANENT_NO_RETRY_REQUEST_ID]: {
      intent: "runResearch",
      ok: false,
      warning: false,
      claimId: PERMANENT_NO_RETRY_CLAIM_ID,
      executionOutcome: "uncertain_no_retry",
      confirmedStatus: "uncertain_no_retry",
      statusPersisted: true,
      reportId: null,
      expectedReportId: null,
      durablySaved: false,
      code: null,
      eligibilityCode: null,
      message: null,
      error: null,
      lockRunForever: true,
    },
  }));

  useEffect(() => {
    setLatchedByCardId((prev) => {
      let next = prev;

      // 1. Latch any card observed with server-side claim/execution/save evidence
      if (Array.isArray(researchCards)) {
        for (let i = 0; i < researchCards.length; i += 1) {
          const c = researchCards[i];
          const cid = normalizeCleanString(c?.id);
          if (!cid || !hasCardRunLockEvidence(c)) {
            continue;
          }
          const existing = next[cid];
          const cTech = c.technicalDetails || {};
          const nextDurablySaved = Boolean(
            existing?.durablySaved || c.durablySaved
          );
          const nextClaimId =
            normalizeCleanString(cTech.claimId) || existing?.claimId || null;
          const nextReportId =
            normalizeCleanString(cTech.reportId) || existing?.reportId || null;
          const rawStat = normalizeStatusString(cTech.rawStatus || c.rawStatus);

          if (
            !existing ||
            !existing.lockRunForever ||
            existing.durablySaved !== nextDurablySaved ||
            (nextClaimId && existing.claimId !== nextClaimId) ||
            (nextReportId && existing.reportId !== nextReportId)
          ) {
            if (next === prev) {
              next = { ...prev };
            }
            next[cid] = {
              ...(existing || {}),
              claimId: nextClaimId,
              confirmedStatus: rawStat || existing?.confirmedStatus || null,
              reportId: nextReportId,
              durablySaved: nextDurablySaved,
              lockRunForever: true,
            };
          }
        }
      }

      // 2. Latch matching card outcome from actionData (including null status /
      // failed writebacks after claim)
      const actionCardId = normalizeCleanString(actionData?.metaobjectId);
      if (actionCardId) {
        const extracted = extractLatchFromActionData(actionData, actionCardId);
        if (extracted) {
          const prevEntry = next[actionCardId];
          const mergedLock = Boolean(
            prevEntry?.lockRunForever || extracted.lockRunForever
          );
          const mergedDurable = Boolean(
            prevEntry?.durablySaved || extracted.durablySaved
          );
          const mergedExpectedId =
            prevEntry?.expectedReportId || extracted.expectedReportId || null;
          const mergedReportId =
            prevEntry?.reportId ||
            (extracted.code !== "republished_report_id_mismatch" &&
            extracted.code !== "saved_report_id_conflict"
              ? extracted.reportId
              : null) ||
            null;
          const mergedClaimId =
            prevEntry?.claimId || extracted.claimId || null;

          const changed =
            !prevEntry ||
            prevEntry.lockRunForever !== mergedLock ||
            prevEntry.durablySaved !== mergedDurable ||
            prevEntry.executionOutcome !== extracted.executionOutcome ||
            prevEntry.confirmedStatus !== extracted.confirmedStatus ||
            prevEntry.statusPersisted !== extracted.statusPersisted ||
            prevEntry.claimId !== mergedClaimId ||
            prevEntry.reportId !== mergedReportId ||
            prevEntry.expectedReportId !== mergedExpectedId ||
            prevEntry.error !== extracted.error ||
            prevEntry.message !== extracted.message;

          if (changed) {
            if (next === prev) {
              next = { ...prev };
            }
            next[actionCardId] = {
              ...extracted,
              claimId: mergedClaimId,
              reportId: mergedReportId,
              expectedReportId: mergedExpectedId,
              durablySaved: mergedDurable,
              lockRunForever: mergedLock,
            };
          }
        }
      }

      return next;
    });
  }, [researchCards, actionData]);

  const normalizedSubmittingId = normalizeCleanString(submittingMetaobjectId);
  const normalizedSubmittingIntent = normalizeCleanString(submittingIntent);
  const isSetupSubmitting = Boolean(
    isSubmittingAction &&
      normalizedSubmittingIntent === "setupResearchDefinition"
  );
  const isBusy = revalidatorState !== "idle" || Boolean(isSubmittingAction);

  // Page-level action banners apply ONLY when actionData is not scoped to a
  // visible research card (e.g. setupResearchDefinition or general errors).
  const actionMetaobjectId = normalizeCleanString(actionData?.metaobjectId);
  const actionMatchesRenderedCard = Boolean(
    actionMetaobjectId &&
      Array.isArray(researchCards) &&
      researchCards.some((c) => normalizeCleanString(c?.id) === actionMetaobjectId)
  );
  const showTopLevelActionBanner = Boolean(
    actionData && !actionMatchesRenderedCard
  );

  const legacyJobRows = jobs.map((job, index) => (
    <IndexTable.Row id={job.id} key={job.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {String(job.id || "").split("/").pop()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{String(job.productId || "").split("/").pop()}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {job.targetKey}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.targetValue}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={
            job.status === "pending"
              ? "warning"
              : job.status === "complete"
                ? "success"
                : "critical"
          }
        >
          {String(job.status || "pending").toUpperCase()}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Research & Sidekick Queue"
      subtitle="Run reviewed questions and copy saved answers anytime."
      backAction={
        typeof onNavigateBack === "function"
          ? { content: "Tools Launcher", onAction: onNavigateBack }
          : undefined
      }
      secondaryActions={
        typeof onRefresh === "function"
          ? [
              {
                content:
                  revalidatorState === "loading" ? "Refreshing..." : "Refresh",
                onAction: onRefresh,
                disabled: isBusy,
              },
            ]
          : []
      }
    >
      <BlockStack gap="500">
        {queueError && (
          <Banner tone="critical" title="Job queue read issue">
            <Text as="p">{queueError}</Text>
          </Banner>
        )}

        {researchLoaderError && (
          <Banner tone="critical" title="Research list read issue">
            <Text as="p">{researchLoaderError}</Text>
          </Banner>
        )}

        {showTopLevelActionBanner && actionData?.error && (
          <Banner tone="critical" title="Action did not complete">
            <Text as="p">{actionData.error}</Text>
          </Banner>
        )}

        {showTopLevelActionBanner && actionData?.ok && actionData?.message && (
          <Banner
            tone={actionData.warning ? "warning" : "success"}
            title={
              actionData.warning ? "Completed — check save note" : "Done"
            }
          >
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}

        {!researchDefinitionReady && (
          <Card padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Research Setup Needed
              </Text>
              <Text as="p" variant="bodyMd">
                Create the <code>sidekick_research_request</code> definition in
                Shopify Admin (Settings → Custom data → Metaobjects, including
                JSON field <code>savedReportJson</code>), or check setup below.
              </Text>
              {typeof onSetupDefinition === "function" && (
                <InlineStack>
                  <Button
                    variant="primary"
                    loading={isSetupSubmitting}
                    disabled={Boolean(isSubmittingAction)}
                    onClick={onSetupDefinition}
                  >
                    Check Research Setup
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        )}

        {researchDefinitionReady && researchCards.length === 0 && (
          <Card padding="500">
            <EmptySearchResult
              title="No research questions yet"
              description="Save a Sidekick Research Request in Shopify Admin, then come back here to click Run Research."
              withIllustration
            />
          </Card>
        )}

        {researchCards.length > 0 && (
          <BlockStack gap="400">
            {researchCards.map((card) => {
              const cardId = normalizeCleanString(card.id);
              const isThisCardSubmitting = Boolean(
                isSubmittingAction &&
                  normalizedSubmittingId &&
                  normalizedSubmittingId === cardId
              );
              const matchedCardActionData =
                actionMetaobjectId && actionMetaobjectId === cardId
                  ? actionData
                  : null;

              return (
                <ResearchRequestCalmCard
                  key={card.id}
                  card={card}
                  isSubmittingThisCard={isThisCardSubmitting}
                  submittingIntentForCard={
                    isThisCardSubmitting ? normalizedSubmittingIntent : null
                  }
                  isAnyActionSubmitting={Boolean(isSubmittingAction)}
                  cardActionData={matchedCardActionData}
                  latchedRecord={latchedByCardId[cardId] || null}
                  onRunResearch={onRunResearch}
                  onRetryResearch={onRetryResearch}
                  onRepairOrRepublish={onRepairOrRepublish}
                />
              );
            })}
          </BlockStack>
        )}

        {/* COLLAPSED WORKBENCH SECTION: LEGACY QUEUE, SETUP CHECK & RULES */}
        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingSm">
                  More Tools &amp; Product Job Queue ({jobs.length})
                </Text>
                <Badge tone={revalidatorState === "loading" ? "info" : "success"}>
                  {revalidatorState === "loading" ? "Syncing" : "Auto-Sync On"}
                </Badge>
              </InlineStack>

              <Button
                variant="secondary"
                onClick={() => setSystemToolsOpen((open) => !open)}
                ariaExpanded={systemToolsOpen}
                ariaControls="queue-more-tools-collapsible"
              >
                {systemToolsOpen
                  ? "Hide Legacy Queue & Rules"
                  : "Show Legacy Queue & Rules"}
              </Button>
            </InlineStack>

            <Collapsible
              open={systemToolsOpen}
              id="queue-more-tools-collapsible"
              transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
            >
              <BlockStack gap="400">
                <Divider />

                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Check or add missing fields on the{" "}
                    <code>sidekick_research_request</code> definition:
                  </Text>
                  {typeof onSetupDefinition === "function" && (
                    <Button
                      variant="secondary"
                      loading={isSetupSubmitting}
                      disabled={Boolean(isSubmittingAction)}
                      onClick={onSetupDefinition}
                    >
                      Verify Research Definition
                    </Button>
                  )}
                </InlineStack>

                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="150"
                >
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm">
                      <strong>How saving works:</strong> An answer shows{" "}
                      <strong>Answer Saved</strong> only after Shopify saves{" "}
                      <code>savedReportJson</code> (up to 120,000 bytes) and a
                      fresh readback verifies exact answer and source matches.
                      Temporary 30-minute Sidekick RAM publication is shown
                      separately until permanent save is verified; use{" "}
                      <strong>Copy Answer</strong> anytime to paste results
                      directly.
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      This page refreshes every 30 seconds while open, never
                      runs paid searches automatically, and never retries
                      dropped network requests on its own.
                    </Text>
                  </BlockStack>
                </Box>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Rockhound Studio — Product Metadata Job Queue (
                    <code>sidekick_queue</code>)
                  </Text>

                  {jobs.length === 0 ? (
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="150"
                    >
                      <Text as="p" variant="bodySm" tone="subdued">
                        No product metadata jobs in <code>sidekick_queue</code>.
                      </Text>
                    </Box>
                  ) : (
                    <Layout>
                      <Layout.Section>
                        <IndexTable
                          resourceName={{ singular: "job", plural: "jobs" }}
                          itemCount={jobs.length}
                          selectable={false}
                          headings={[
                            { title: "Job ID" },
                            { title: "Product ID" },
                            { title: "Metafield" },
                            { title: "Value" },
                            { title: "Status" },
                          ]}
                        >
                          {legacyJobRows}
                        </IndexTable>
                      </Layout.Section>
                    </Layout>
                  )}
                </BlockStack>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
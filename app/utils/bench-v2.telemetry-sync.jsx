// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 LIVE TELEMETRY PUBLISHER (CLIENT MODULE)
// File: app/utils/bench-v2.telemetry-sync.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (Step 1 of telemetry extraction).
// Contains catalog metadata & telemetry constants, UTF-8 byte measurement,
// session ID generation, actual event ordering, field registry/applicability
// metadata resolution, and the client-safe useBenchV2LiveTelemetryPublisher
// hook for building and single-flight publishing the read-only Sidekick live
// bench snapshot.
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  isManualMeasurementDestination,
  isManualOnlyNoAiDestination,
  isExactProductGid
} from "./bench-v2.contract.jsx";
import {
  evaluateActionableScanProposalMeta
} from "./bench-v2.field-filters.jsx";
import {
  REGISTRY_BY_OWNER_IDENTITY,
  FIELD_CATALOG
} from "./meta-injector.constants.jsx";

const CATALOG_META_BY_OWNER_IDENTITY = Object.freeze(
  (Array.isArray(FIELD_CATALOG) ? FIELD_CATALOG : []).reduce((acc, entry) => {
    if (entry && entry.registryOwner && entry.registryIdentity) {
      acc[`${entry.registryOwner}:${entry.registryIdentity}`] = entry;
    }
    return acc;
  }, {})
);

const TELEMETRY_ENDPOINT_PATH = "/api/meta-injector-telemetry";
const TELEMETRY_LIVE_BENCH_MODE = "live_bench_state";
const TELEMETRY_MAX_FULL_TEXT_CODE_UNITS = 1024 * 1024;
const TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES = 1024 * 1024;
const TELEMETRY_MAX_POST_BODY_BYTES = 2 * 1024 * 1024;

export function measureUtf8BytesClient(str) {
  if (typeof str !== "string" || str.length === 0) return 0;
  try {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(str).byteLength;
    }
  } catch {
    // Fallback below
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

export function generateBenchSessionId() {
  let randPart = "";
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      randPart = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "");
    }
  } catch {
    // Fallback below
  }
  if (!randPart) {
    randPart = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  }
  const candidate = `bv2_${Date.now()}_${randPart}`.replace(/[^A-Za-z0-9._:-]/g, "");
  return candidate.slice(0, 96);
}

export function resolveActualEventOrdering(aiScanReport, saveReport, refChoicesReport = null) {
  const candidates = [];

  if (aiScanReport && typeof aiScanReport.completedAt === "string") {
    const ms = Date.parse(aiScanReport.completedAt);
    if (Number.isFinite(ms)) {
      candidates.push({
        ms,
        runIdentity: aiScanReport.requestId || null,
        runTimestamp: aiScanReport.completedAt,
        latestEventKind: "ai_scan"
      });
    }
  }

  if (saveReport && typeof saveReport.completedAt === "string") {
    const ms = Date.parse(saveReport.completedAt);
    if (Number.isFinite(ms)) {
      candidates.push({
        ms,
        runIdentity: saveReport.submissionId || null,
        runTimestamp: saveReport.completedAt,
        latestEventKind: "save_attempt"
      });
    }
  }

  if (refChoicesReport && typeof refChoicesReport.completedAt === "string") {
    const ms = Date.parse(refChoicesReport.completedAt);
    if (Number.isFinite(ms)) {
      candidates.push({
        ms,
        runIdentity: refChoicesReport.requestId || null,
        runTimestamp: refChoicesReport.completedAt,
        latestEventKind: "reference_choices_load"
      });
    }
  }

  if (candidates.length === 0) {
    return {
      runIdentity: null,
      runTimestamp: null,
      latestEventKind: null
    };
  }

  candidates.sort((a, b) => b.ms - a.ms);
  return {
    runIdentity: candidates[0].runIdentity,
    runTimestamp: candidates[0].runTimestamp,
    latestEventKind: candidates[0].latestEventKind
  };
}

export function resolveFieldRegistryAndApplicabilityMeta(contract) {
  const owner = contract.owner || "PRODUCT";
  const destKey = contract.destinationKey;
  const compositeKey = `${owner}:${destKey}`;

  const regEntry = REGISTRY_BY_OWNER_IDENTITY?.[compositeKey] || null;
  const catEntry = CATALOG_META_BY_OWNER_IDENTITY?.[compositeKey] || null;

  let registryRole = regEntry?.role || catEntry?.registryRole || null;
  if (!registryRole) {
    if (contract.batchStage === "PROTECTED_READ_ONLY") {
      registryRole = "PROTECTED_DATA";
    } else if (contract.batchStage === "PARKED_EXCLUDED_READ_ONLY") {
      registryRole = "EXCLUDED_INPUT";
    } else if (contract.batchStage === "READ_ONLY_COMPATIBILITY") {
      registryRole = "COMPAT_REP";
    } else if (
      isManualMeasurementDestination(destKey) &&
      contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
    ) {
      registryRole = "APPROVED_MEASUREMENT_ADDITION";
    } else {
      registryRole = "PRIMARY_CANDIDATE_DESTINATION";
    }
  }

  const isProtectedAppData =
    registryRole === "PROTECTED_DATA" ||
    contract.batchStage === "PROTECTED_READ_ONLY" ||
    contract.writeCapability === "PROTECTED_NO_WRITE";

  const isParkedExcluded =
    !isProtectedAppData &&
    (registryRole === "EXCLUDED_INPUT" ||
      contract.batchStage === "PARKED_EXCLUDED_READ_ONLY" ||
      contract.writeCapability === "PARKED_EXCLUDED_NO_WRITE");

  const applicability =
    typeof catEntry?.applicability === "string" && catEntry.applicability.trim() !== ""
      ? catEntry.applicability.trim()
      : isProtectedAppData
        ? "protected_read_only"
        : isParkedExcluded
          ? "parked_excluded"
          : "not_evaluated";

  return {
    registryOwner: owner,
    registryIdentity: destKey,
    registryRole,
    isProtectedAppData,
    isParkedExcluded,
    applicability
  };
}

export function useBenchV2LiveTelemetryPublisher({
  benchSessionId,
  isSwitchingSelectedProduct,
  activeProductId,
  activeProductHeadline,
  activeProductPieceName,
  activeProductTitle,
  currentBaseline,
  evaluatedDrawerGroups,
  allEvaluatedRows,
  totalVisibleFilteredRowCount,
  stagedProposalRows,
  validApprovedRows,
  keepOriginalRows,
  heldAiAlternativesCount,
  activeProductMediaItems,
  currentApprovalsMap,
  currentKeepOriginalMap,
  currentAiScanReport,
  activeSaveReportForCurrentProduct,
  currentRefChoicesRecord,
  isCurrentRefChoicesBoundAndFresh,
  stagedVisionCandidatesByProduct,
  activeFilter,
  openDrawersById,
  isWriterBusy,
  isAiScanBusy,
  isRefChoicesBusy,
  isBaselineReloading,
  isPickerLoading,
  hasBaselineErrors,
  selectionError,
  loadError,
  clientPrevalidationBanner,
  plainDrawerTitles
}) {
  const isMountedRef = useRef(true);
  const benchSessionIdRef = useRef(benchSessionId);
  benchSessionIdRef.current = benchSessionId;

  const benchRevisionRef = useRef(0);
  const lastEnqueuedFingerprintRef = useRef(null);
  const latestQueuedSnapshotSpecRef = useRef(null);
  const isTelemetrySendInFlightRef = useRef(false);
  const [telemetrySyncStatus, setTelemetrySyncStatus] = useState(() => ({
    state: "idle",
    benchSessionId: benchSessionIdRef.current,
    benchRevision: 0,
    reportId: null,
    productId: null,
    clientStateChangedAt: null,
    serverReceivedAt: null,
    errorCode: null,
    message: "Waiting for initial bench state sync."
  }));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      latestQueuedSnapshotSpecRef.current = null;
    };
  }, []);

  // ==========================================================================
  // SIDEKICK LIVE BENCH SNAPSHOT BUILDER & SINGLE-FLIGHT PUBLISHER
  // ==========================================================================
  const drainTelemetryPublishQueue = useCallback(async () => {
    if (isTelemetrySendInFlightRef.current) return;
    isTelemetrySendInFlightRef.current = true;

    try {
      while (latestQueuedSnapshotSpecRef.current && isMountedRef.current) {
        const spec = latestQueuedSnapshotSpecRef.current;
        latestQueuedSnapshotSpecRef.current = null;

        let nextRevision = Math.max(1, benchRevisionRef.current + 1);
        benchRevisionRef.current = nextRevision;

        const attemptPublishWithRevision = async (revisionToUse) => {
          const fullSnapshotObj = {
            ...spec.snapshotBodyWithoutRevision,
            benchSessionId: spec.benchSessionId,
            benchRevision: revisionToUse,
            selectionState: spec.selectionState,
            productId: spec.productId,
            baselineLoadedAt: spec.baselineLoadedAt,
            clientStateChangedAt: spec.clientStateChangedAt
          };

          const fullText = JSON.stringify(fullSnapshotObj);
          const fullTextCodeUnits = fullText.length;
          const fullTextUtf8Bytes = measureUtf8BytesClient(fullText);

          if (
            fullTextCodeUnits > TELEMETRY_MAX_FULL_TEXT_CODE_UNITS ||
            fullTextUtf8Bytes > TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES
          ) {
            return {
              localOversize: true,
              message: `Snapshot payload (${fullTextUtf8Bytes} UTF-8 bytes / ${fullTextCodeUnits} chars) exceeds cache limit (${TELEMETRY_MAX_FULL_TEXT_CODE_UNITS} chars / ${TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES} bytes); refused to clip or truncate.`
            };
          }

          const postEnvelope = {
            packet: {
              productId: spec.productId,
              productTitle: spec.productTitle,
              mode: TELEMETRY_LIVE_BENCH_MODE,
              sectionKey: TELEMETRY_LIVE_BENCH_MODE,
              sectionLabel: "LIVE BENCH FIELD STATE",
              runIdentity: spec.runIdentity,
              runTimestamp: spec.runTimestamp,
              capturedAt: spec.clientStateChangedAt,
              benchSessionId: spec.benchSessionId,
              benchRevision: revisionToUse,
              selectionState: spec.selectionState,
              baselineLoadedAt: spec.baselineLoadedAt,
              fullText
            },
            uiAudit: null,
            liveState: {
              mode: TELEMETRY_LIVE_BENCH_MODE,
              benchSessionId: spec.benchSessionId,
              benchRevision: revisionToUse,
              selectionState: spec.selectionState,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              baselineLoadedAt: spec.baselineLoadedAt
            }
          };

          const serializedEnvelope = JSON.stringify(postEnvelope);
          const envelopeBytes = measureUtf8BytesClient(serializedEnvelope);
          if (envelopeBytes > TELEMETRY_MAX_POST_BODY_BYTES) {
            return {
              localOversize: true,
              message: `POST body (${envelopeBytes} bytes) exceeds ${TELEMETRY_MAX_POST_BODY_BYTES}-byte endpoint limit; refused to clip.`
            };
          }

          const response = await fetch(TELEMETRY_ENDPOINT_PATH, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: serializedEnvelope
          });

          const contentType = response.headers.get("content-type") || "";
          let parsedJson = null;
          if (contentType.toLowerCase().includes("application/json")) {
            try {
              parsedJson = await response.json();
            } catch {
              parsedJson = null;
            }
          }

          return {
            localOversize: false,
            httpStatus: response.status,
            redirected: response.redirected,
            parsedJson
          };
        };

        if (isMountedRef.current) {
          setTelemetrySyncStatus((prev) => ({
            ...prev,
            state: "syncing",
            benchRevision: nextRevision,
            productId: spec.productId,
            clientStateChangedAt: spec.clientStateChangedAt,
            errorCode: null,
            message: `Publishing revision ${nextRevision} to Sidekick cache...`
          }));
        }

        try {
          let result = await attemptPublishWithRevision(nextRevision);

          if (
            !result.localOversize &&
            result.httpStatus === 409 &&
            result.parsedJson?.code === "stale_bench_revision" &&
            typeof result.parsedJson?.highestRevision === "number" &&
            Number.isSafeInteger(result.parsedJson.highestRevision) &&
            !latestQueuedSnapshotSpecRef.current &&
            isMountedRef.current
          ) {
            nextRevision = result.parsedJson.highestRevision + 1;
            benchRevisionRef.current = nextRevision;
            result = await attemptPublishWithRevision(nextRevision);
          }

          if (!isMountedRef.current) break;

          if (result.localOversize) {
            setTelemetrySyncStatus({
              state: "error",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt: null,
              errorCode: "payload_too_large_unclipped",
              message: result.message
            });
            continue;
          }

          const { httpStatus, redirected, parsedJson } = result;
          if ((httpStatus === 200 || httpStatus === 201) && parsedJson?.ok === true) {
            const reportMeta = parsedJson.report || null;
            const sessionMeta = parsedJson.liveSession || null;
            setTelemetrySyncStatus({
              state: "stored",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: reportMeta?.reportId || sessionMeta?.activeReportId || null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt:
                reportMeta?.serverReceivedAt ||
                reportMeta?.storedAt ||
                sessionMeta?.serverReceivedAt ||
                null,
              errorCode: null,
              message: `Revision ${nextRevision} stored in process memory cache (volatile across server restarts or separate workers).`
            });
          } else {
            const errCode =
              parsedJson?.code ||
              (redirected || httpStatus === 401 || httpStatus === 403
                ? "auth_or_origin_rejected"
                : `http_${httpStatus}`);
            const errMsg =
              parsedJson?.message ||
              (redirected
                ? "Telemetry POST was redirected (session authentication required)."
                : `Telemetry POST returned HTTP ${httpStatus}.`);
            setTelemetrySyncStatus({
              state: "error",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt: null,
              errorCode: errCode,
              message: errMsg
            });
          }
        } catch (networkErr) {
          if (!isMountedRef.current) break;
          setTelemetrySyncStatus({
            state: "error",
            benchSessionId: spec.benchSessionId,
            benchRevision: nextRevision,
            reportId: null,
            productId: spec.productId,
            clientStateChangedAt: spec.clientStateChangedAt,
            serverReceivedAt: null,
            errorCode: "network_error",
            message: `Telemetry sync request failed: ${networkErr?.message || "Network error"}`
          });
        }
      }
    } finally {
      isTelemetrySendInFlightRef.current = false;
      if (latestQueuedSnapshotSpecRef.current && isMountedRef.current) {
        drainTelemetryPublishQueue();
      }
    }
  }, []);

  useEffect(() => {
    if (isSwitchingSelectedProduct) {
      return;
    }

    if (!isExactProductGid(activeProductId)) {
      return;
    }

    const hasMatchedBaseline = Boolean(
      currentBaseline && currentBaseline.productId === activeProductId
    );
    const isManifestFullyLoaded = Boolean(
      hasMatchedBaseline &&
        currentBaseline.metafieldsReadComplete === true &&
        currentBaseline.defsReadComplete === true
    );
    const baselineLoadedAt =
      hasMatchedBaseline &&
      typeof currentBaseline.loadedAt === "string" &&
      currentBaseline.loadedAt.trim() !== ""
        ? currentBaseline.loadedAt.trim()
        : null;

    const baselineState = !hasMatchedBaseline
      ? "not_loaded"
      : isManifestFullyLoaded
        ? "complete"
        : "incomplete_read";

    const baselineEventKind = isBaselineReloading
      ? "reloading"
      : isWriterBusy
        ? "saving"
        : isAiScanBusy
          ? "ai_scanning"
          : isRefChoicesBusy
            ? "loading_reference_choices"
            : "idle";

    const orderedEvents = resolveActualEventOrdering(
      currentAiScanReport,
      activeSaveReportForCurrentProduct,
      currentRefChoicesRecord
    );

    const fieldsByKey = {};
    const sectionOrder = [];

    for (let dIdx = 0; dIdx < evaluatedDrawerGroups.length; dIdx += 1) {
      const drawer = evaluatedDrawerGroups[dIdx];
      const sectionTitle = plainDrawerTitles?.[drawer.drawerId] || drawer.heading;
      const drawerFieldKeys = [];

      for (let rIdx = 0; rIdx < drawer.evaluatedRows.length; rIdx += 1) {
        const row = drawer.evaluatedRows[rIdx];
        const {
          contract,
          baselineObservation: obs,
          typeAndCompleteness,
          referenceEvidence,
          baselineDisplayValue,
          hasProposalKey,
          proposedValue,
          proposedDisplayValue,
          proposalSource,
          proposalOrigin,
          heldAiAlternative,
          scanProposalMeta,
          actionableScanMeta,
          validation,
          isApproved,
          isKeepOriginal,
          fidelityCheck,
          hasSaveErrorOrConflict,
          effectiveConnectionStatus,
          effectiveReviewStatus,
          effectiveStatusReason,
          plainLabel,
          readableSaved,
          canSelectKeepOriginal
        } = row;

        const destKey = contract.destinationKey;
        drawerFieldKeys.push(destKey);

        const regMeta = resolveFieldRegistryAndApplicabilityMeta(contract);
        const isMediaCapabilityDescriptor = destKey === "native_image_alt";
        const isShopifyReference = contract.namespace === "shopify";
        const usesMeaningDisplay = Boolean(
          contract.usesYesNoMeaningDisplay || isShopifyReference
        );

        const rawBaselineExists =
          obs.evidenceAvailable &&
          obs.presence === "present" &&
          obs.rawValue !== undefined &&
          obs.rawValue !== null &&
          String(obs.rawValue) !== "";

        const canKeepOriginal = canSelectKeepOriginal;

        const isExplicitlyApprovedValid = Boolean(
          isApproved && fidelityCheck.faithful
        );

        const wasSubmittedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.submittedDestinations?.includes(destKey)
        );
        const verifiedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.verifiedDestinations?.includes(destKey)
        );
        const blockedInLastRepair =
          activeSaveReportForCurrentProduct?.blockedFields?.[destKey] || null;
        const unconfirmedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.unconfirmedDestinations?.includes(destKey)
        );

        const resolvedActionableScanMeta =
          actionableScanMeta !== undefined
            ? actionableScanMeta
            : evaluateActionableScanProposalMeta({
                contract,
                baselineObservation: obs,
                hasProposalKey,
                proposedValue,
                scanProposalMeta,
                verifiedInLastSave: Boolean(!hasProposalKey && verifiedInLastRepair)
              });

        const hasActionableUnresolvedScanCandidate = Boolean(
          !regMeta.isParkedExcluded &&
            !regMeta.isProtectedAppData &&
            resolvedActionableScanMeta
        );

        const isActualBlockedProposal = Boolean(
          (hasProposalKey &&
            (!validation?.valid || !fidelityCheck.faithful)) ||
            hasActionableUnresolvedScanCandidate
        );

        const hasTechnicalBlock = Boolean(
          !obs.evidenceAvailable ||
            obs.metafieldsCompleteState !== "complete" ||
            obs.defsCompleteState !== "complete" ||
            Boolean(obs.destinationDefError) ||
            (contract.isWritableInBatch1 && typeAndCompleteness?.ready !== true)
        );

        const hasContractOrOwnerHold = Boolean(!contract.isWritableInBatch1);

        let mappedFieldStatus = "Unchanged";
        if (!obs.evidenceAvailable) {
          if (obs.presence === "unknown_incomplete_read") {
            mappedFieldStatus = "Incomplete Read";
          } else if (
            obs.presence === "multiple_variants_hold" ||
            obs.presence === "zero_variants_hold"
          ) {
            mappedFieldStatus = "Held (Variant Target)";
          } else {
            mappedFieldStatus = "Baseline Not Loaded";
          }
        } else if (hasSaveErrorOrConflict) {
          const isBlockedInSave = Boolean(
            activeSaveReportForCurrentProduct?.blockedFields &&
              Object.prototype.hasOwnProperty.call(
                activeSaveReportForCurrentProduct.blockedFields,
                destKey
              )
          );
          mappedFieldStatus = isBlockedInSave ? "API Error / Blocked" : "Save Conflict";
        } else if (isKeepOriginal && !hasActionableUnresolvedScanCandidate) {
          mappedFieldStatus = "Keep original (suggestion rejected)";
        } else if (
          isApproved &&
          (!fidelityCheck.faithful || !validation?.valid)
        ) {
          mappedFieldStatus = "Approved, blocked";
        } else if (isExplicitlyApprovedValid && !hasActionableUnresolvedScanCandidate) {
          mappedFieldStatus = "Approved, not saved";
        } else if (hasProposalKey && (!validation?.valid || !fidelityCheck.faithful)) {
          mappedFieldStatus =
            validation?.code === "exceeds_max_length"
              ? "Over limit"
              : "API Error / Blocked";
        } else if (hasProposalKey && !validation?.isUnchangedFromStored) {
          mappedFieldStatus = "Proposed";
        } else if (hasActionableUnresolvedScanCandidate) {
          mappedFieldStatus = "Unverified proposal";
        } else if (
          !regMeta.isParkedExcluded &&
          !regMeta.isProtectedAppData &&
          obs.evidenceAvailable &&
          (obs.presence === "absent" ||
            obs.presence === "null" ||
            obs.presence === "empty_string") &&
          (destKey === "native_title" || destKey === "native_price")
        ) {
          mappedFieldStatus = "Required missing";
        }

        const proposalStatus = !hasProposalKey
          ? hasActionableUnresolvedScanCandidate
            ? "blocked"
            : "none"
          : isKeepOriginal
            ? "rejected_keep_original"
            : !validation?.valid || !fidelityCheck.faithful
              ? "blocked"
              : validation?.isUnchangedFromStored
                ? "unchanged"
                : "proposed";

        const contentNeedsReview = Boolean(
          !regMeta.isParkedExcluded &&
            !regMeta.isProtectedAppData &&
            (hasSaveErrorOrConflict ||
              Boolean(heldAiAlternative) ||
              hasActionableUnresolvedScanCandidate ||
              (!isKeepOriginal &&
                hasProposalKey &&
                !isExplicitlyApprovedValid &&
                !validation?.isUnchangedFromStored))
        );

        const reasonsList = [];
        if (effectiveStatusReason) reasonsList.push(effectiveStatusReason);
        if (hasProposalKey && validation && !validation.valid && validation.reason) {
          if (!reasonsList.includes(validation.reason)) {
            reasonsList.push(validation.reason);
          }
        }
        if (hasProposalKey && !fidelityCheck.faithful && fidelityCheck.reason) {
          if (!reasonsList.includes(fidelityCheck.reason)) {
            reasonsList.push(fidelityCheck.reason);
          }
        }
        if (resolvedActionableScanMeta) {
          if (
            resolvedActionableScanMeta.summaryText &&
            !reasonsList.includes(resolvedActionableScanMeta.summaryText)
          ) {
            reasonsList.push(resolvedActionableScanMeta.summaryText);
          }
          if (
            resolvedActionableScanMeta.reason &&
            !reasonsList.some((r) => r.includes(resolvedActionableScanMeta.reason))
          ) {
            reasonsList.push(resolvedActionableScanMeta.reason);
          }
        }

        const saveConflictEntry =
          activeSaveReportForCurrentProduct?.conflicts?.[destKey] ||
          activeSaveReportForCurrentProduct?.unresolvedChanges?.[destKey] ||
          null;

        const combinedConflictData =
          heldAiAlternative && saveConflictEntry
            ? {
                heldAiAlternative,
                saveConflict: saveConflictEntry
              }
            : heldAiAlternative
              ? {
                  kind: "held_ai_alternative",
                  ...heldAiAlternative
                }
              : saveConflictEntry || null;

        const rawValueToStore = obs.rawValue !== undefined ? obs.rawValue : null;
        const readableBaselineStr =
          typeof baselineDisplayValue === "string" && baselineDisplayValue !== ""
            ? baselineDisplayValue
            : readableSaved;

        const rawStoredBaselineObj = {
          evidenceAvailable: obs.evidenceAvailable,
          exists: rawBaselineExists,
          presence: obs.presence,
          value: rawValueToStore,
          ...(obs.variantId ? { variantId: obs.variantId } : {}),
          ...(obs.variantTargetStatus
            ? { variantTargetStatus: obs.variantTargetStatus }
            : {}),
          ...(obs.storedType ? { storedType: obs.storedType } : {}),
          ...(obs.liveDefType ? { liveDefType: obs.liveDefType } : {}),
          ...(obs.restrictedMetaobjectDefinitionId
            ? { restrictedMetaobjectDefinitionId: obs.restrictedMetaobjectDefinitionId }
            : {}),
          ...(obs.metafieldsCompleteState !== "complete"
            ? { metafieldsCompleteState: obs.metafieldsCompleteState }
            : {}),
          ...(obs.defsCompleteState !== "complete"
            ? { defsCompleteState: obs.defsCompleteState }
            : {}),
          ...(obs.destinationDefError
            ? { destinationDefError: obs.destinationDefError }
            : {})
        };

        const evaluatedBaselineObj = {
          currentExists: rawBaselineExists,
          ...(readableBaselineStr !== rawValueToStore
            ? { displayValue: readableBaselineStr }
            : {}),
          ...(usesMeaningDisplay ? { usesYesNoMeaningDisplay: true } : {}),
          ...(isMediaCapabilityDescriptor
            ? { isDisplayOnlyPlaceholderOrNa: true }
            : {})
        };

        const effectiveSource =
          hasProposalKey && proposalSource && proposalSource !== "None"
            ? proposalSource
            : resolvedActionableScanMeta?.source || scanProposalMeta?.source || null;

        const workingStateObj = {
          proposalExists: hasProposalKey,
          isProposed: Boolean(
            hasProposalKey && !isKeepOriginal && !validation?.isUnchangedFromStored
          ),
          proposedValue: hasProposalKey ? proposedValue : null,
          ...(hasProposalKey &&
          proposedDisplayValue &&
          proposedDisplayValue !== proposedValue
            ? { proposedDisplayValue }
            : {}),
          ...(proposalStatus !== "none" ? { proposalStatus } : {}),
          ...(effectiveSource ? { source: effectiveSource } : {}),
          ...(proposalOrigin !== "None" ? { origin: proposalOrigin } : {}),
          ...(hasProposalKey && proposalOrigin === "Manual"
            ? { isManualEdit: true }
            : {}),
          ...(isExplicitlyApprovedValid ? { isApproved: true } : {}),
          ...(currentApprovalsMap?.[destKey]
            ? { approvalRecord: currentApprovalsMap[destKey] }
            : {}),
          ...(isKeepOriginal ? { isKeepOriginal: true } : {}),
          ...(currentKeepOriginalMap?.[destKey]
            ? { keepOriginalDecision: currentKeepOriginalMap[destKey] }
            : {}),
          ...(canKeepOriginal ? { canKeepOriginal: true } : {}),
          ...(contentNeedsReview ? { contentNeedsReview: true } : {}),
          ...(heldAiAlternative ? { heldAiAlternative } : {}),
          ...(scanProposalMeta ? { lastAiScanOutcome: scanProposalMeta } : {}),
          ...(resolvedActionableScanMeta
            ? {
                unresolvedAiCandidate: {
                  value: resolvedActionableScanMeta.candidateValue,
                  source: resolvedActionableScanMeta.source,
                  disposition: resolvedActionableScanMeta.disposition,
                  reason: resolvedActionableScanMeta.reason,
                  reviewStatusLabel: resolvedActionableScanMeta.reviewStatusLabel
                }
              }
            : {})
        };

        const isVariantOwner =
          contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
        const isVariantHold =
          isVariantOwner &&
          (!contract.isWritableInBatch1 || !obs.evidenceAvailable);
        const isExplicitStorageHold =
          contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD";
        const isChannelFlagHold =
          contract.destinationKey === "mm-google-shopping.custom_product";

        const statusAndHoldsObj = {
          fieldStatus: mappedFieldStatus,
          connectionStatus: effectiveConnectionStatus,
          ...(effectiveReviewStatus !== "Unchanged"
            ? { reviewStatus: effectiveReviewStatus }
            : {}),
          applicability: regMeta.applicability,
          writeCapability: contract.writeCapability,
          batchStage: contract.batchStage,
          expectedType: contract.expectedType,
          ...(Array.isArray(contract.allowedTypes) &&
          (contract.allowedTypes.length > 1 ||
            contract.allowedTypes[0] !== contract.expectedType)
            ? { allowedTypes: contract.allowedTypes }
            : {}),
          ...(contract.reviewedExactContractType
            ? { reviewedExactContractType: contract.reviewedExactContractType }
            : {}),
          ...(typeAndCompleteness?.typeEvidenceSource
            ? { typeEvidenceSource: typeAndCompleteness.typeEvidenceSource }
            : {}),
          ...(typeAndCompleteness?.verifiedActualType
            ? { verifiedActualType: typeAndCompleteness.verifiedActualType }
            : {}),
          ...(isShopifyReference
            ? {
                restrictedMetaobjectDefinitionId:
                  obs.restrictedMetaobjectDefinitionId || null,
                categoryEligibilityStatus: obs.categoryEligibility?.status || null,
                referenceChoicesLoaded: Boolean(referenceEvidence?.evidenceLoaded),
                referenceChoicesVerifiedComplete: Boolean(referenceEvidence?.isComplete),
                verifiedReferenceChoiceCount: referenceEvidence?.isComplete
                  ? referenceEvidence.entriesByGid.size
                  : 0
              }
            : {}),
          ...(contract.maxLength !== null ? { maxLength: contract.maxLength } : {}),
          ...(contract.canonicalTarget
            ? { canonicalTarget: contract.canonicalTarget }
            : {}),
          ...(regMeta.isParkedExcluded ? { isParkedExcluded: true } : {}),
          ...(regMeta.isProtectedAppData ? { isProtectedAppData: true } : {}),
          ...(isMediaCapabilityDescriptor
            ? { isImageAltCapabilityPlaceholder: true }
            : {}),
          ...(isActualBlockedProposal ? { isActualBlockedProposal: true } : {}),
          ...(hasActionableUnresolvedScanCandidate
            ? { hasExplicitProducerHold: true }
            : {}),
          ...(hasTechnicalBlock ? { hasTechnicalBlock: true } : {}),
          ...(hasContractOrOwnerHold ? { hasContractOrOwnerHold: true } : {}),
          ...(isExplicitStorageHold ? { hasExplicitStorageHold: true } : {}),
          ...(isVariantHold ? { isVariantMetafieldHold: true } : {}),
          ...(!contract.isWritableInBatch1 ? { isPendingReadOnly: true } : {}),
          ...(isChannelFlagHold ? { isChannelFlagReadOnly: true } : {}),
          ...(reasonsList.length > 0 ? { reasons: reasonsList } : {})
        };

        const hasAnySaveOrConflictEvidence = Boolean(
          combinedConflictData ||
            wasSubmittedInLastRepair ||
            verifiedInLastRepair ||
            blockedInLastRepair ||
            unconfirmedInLastRepair
        );

        const fieldEntry = {
          key: destKey,
          section: sectionTitle,
          drawerId: contract.drawerId,
          label: plainLabel || contract.label,
          registryOwner: regMeta.registryOwner,
          ...(obs.variantId ? { variantId: obs.variantId } : {}),
          ...(regMeta.registryIdentity !== destKey
            ? { registryIdentity: regMeta.registryIdentity }
            : {}),
          registryRole: regMeta.registryRole,
          ...(regMeta.isParkedExcluded ? { isParkedExcluded: true } : {}),
          ...(regMeta.isProtectedAppData ? { isProtectedAppData: true } : {}),
          ...(isManualOnlyNoAiDestination(destKey, contract)
            ? { isManualOnlyNoAi: true }
            : {}),
          rawStoredBaseline: rawStoredBaselineObj,
          evaluatedBaseline: evaluatedBaselineObj,
          workingState: workingStateObj,
          statusAndHolds: statusAndHoldsObj,
          ...(hasAnySaveOrConflictEvidence
            ? {
                conflictsAndSaveEvidence: {
                  ...(combinedConflictData ? { conflictData: combinedConflictData } : {}),
                  ...(wasSubmittedInLastRepair ? { wasSubmittedInLastRepair: true } : {}),
                  ...(verifiedInLastRepair ? { verifiedInLastRepair: true } : {}),
                  ...(blockedInLastRepair ? { blockedInLastRepair } : {}),
                  ...(unconfirmedInLastRepair ? { unconfirmedInLastRepair: true } : {})
                }
              }
            : {})
        };

        fieldsByKey[destKey] = fieldEntry;

        if (
          isMediaCapabilityDescriptor &&
          hasMatchedBaseline &&
          Array.isArray(currentBaseline?.nativeTargets?.media?.edges)
        ) {
          const mediaComplete =
            currentBaseline.nativeTargets?.isComplete === true &&
            !currentBaseline.nativeTargets?.loadError &&
            !(
              Array.isArray(currentBaseline.nativeTargets?.unverifiedFields) &&
              currentBaseline.nativeTargets.unverifiedFields.includes("media")
            );
          const mediaEdges = currentBaseline.nativeTargets.media.edges;

          for (let mIdx = 0; mIdx < mediaEdges.length; mIdx += 1) {
            const mediaNode = mediaEdges[mIdx]?.node;
            if (!mediaNode || typeof mediaNode.id !== "string" || !mediaNode.id.trim()) {
              continue;
            }
            const mediaGid = mediaNode.id.trim();
            const mediaKey = `native_image_alts_${mediaGid}`;
            const rawAlt =
              typeof mediaNode.alt === "string" ? mediaNode.alt : "";
            const hasAltText = rawAlt.trim() !== "";

            drawerFieldKeys.push(mediaKey);
            fieldsByKey[mediaKey] = {
              key: mediaKey,
              mediaImageGid: mediaGid,
              photoIndex: mIdx + 1,
              section: sectionTitle,
              drawerId: contract.drawerId,
              label: `Photo ${mIdx + 1} Alt Text (${mediaGid})`,
              registryOwner: "MEDIAIMAGE",
              registryIdentity: "native_image_alt",
              registryRole: "PRIMARY_CANDIDATE_DESTINATION",
              rawStoredBaseline: {
                evidenceAvailable: mediaComplete,
                exists: mediaComplete && hasAltText,
                presence: !mediaComplete
                  ? "unknown_incomplete_read"
                  : hasAltText
                    ? "present"
                    : "empty_string",
                value: mediaComplete ? rawAlt : null,
                storedType: "native_media_alt",
                liveDefType: "native_media_alt"
              },
              evaluatedBaseline: {
                currentExists: mediaComplete && hasAltText,
                ...(!mediaComplete
                  ? { displayValue: "Read incomplete" }
                  : !hasAltText
                    ? { displayValue: "Not set" }
                    : {})
              },
              workingState: {
                proposalExists: false,
                isProposed: false,
                proposedValue: null
              },
              statusAndHolds: {
                fieldStatus: !mediaComplete ? "Incomplete Read" : "Unchanged",
                connectionStatus: "Read-Only Descriptor (FUTURE_BATCH_3_DESCRIPTOR)",
                applicability: "all_products",
                writeCapability: contract.writeCapability,
                batchStage: contract.batchStage,
                expectedType: "single_line_text_field",
                maxLength: 125,
                ...(!mediaComplete ? { hasTechnicalBlock: true } : {}),
                hasContractOrOwnerHold: true,
                isPendingReadOnly: true,
                reasons: [
                  "Per-image media alt writes are scheduled for Future Batch 3; read-only in Batch 1."
                ]
              }
            };
          }
        }
      }

      sectionOrder.push({
        sectionTitle,
        drawerId: drawer.drawerId,
        fieldKeys: drawerFieldKeys
      });
    }

    const manualEditedKeys = allEvaluatedRows
      .filter((r) => r.hasProposalKey && r.proposalOrigin === "Manual")
      .map((r) => r.contract.destinationKey);

    const explicitlyApprovedKeys = validApprovedRows.map(
      (r) => r.contract.destinationKey
    );

    const keepOriginalKeys = keepOriginalRows.map(
      (r) => r.contract.destinationKey
    );

    // Aggregate across all 18 retained standardized reference rows (matching old Drawer 10 scope:
    // non-parked/excluded shopify.* reference rows, including both connected and any held rows).
    const drawer10Rows = allEvaluatedRows.filter(
      (r) =>
        r.contract.namespace === "shopify" &&
        r.contract.batchStage !== "PARKED_EXCLUDED_READ_ONLY" &&
        r.contract.writeCapability !== "PARKED_EXCLUDED_NO_WRITE" &&
        (BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(r.contract.destinationKey) ||
          r.contract.isWritableInBatch1 === true ||
          r.contract.writeCapability === "STANDARDIZED_REFERENCE_LOCKED")
    );
    const eligibleStandardizedDestKeys = drawer10Rows
      .filter(
        (r) =>
          r.contract.isWritableInBatch1 === true &&
          r.typeAndCompleteness?.ready === true
      )
      .map((r) => r.contract.destinationKey);
    const blockedStandardizedDestKeys = drawer10Rows
      .filter(
        (r) =>
          r.contract.isWritableInBatch1 !== true ||
          r.typeAndCompleteness?.ready !== true
      )
      .map((r) => r.contract.destinationKey);
    const verifiedChoiceReadyDestKeys = drawer10Rows
      .filter(
        (r) =>
          r.contract.isWritableInBatch1 === true &&
          r.typeAndCompleteness?.ready === true &&
          r.referenceEvidence?.isComplete === true &&
          r.referenceEvidence.entriesByGid.size > 0
      )
      .map((r) => r.contract.destinationKey);
    const emptyChoiceEligibleDestKeys = drawer10Rows
      .filter(
        (r) =>
          r.contract.isWritableInBatch1 === true &&
          r.typeAndCompleteness?.ready === true &&
          r.referenceEvidence?.isComplete === true &&
          r.referenceEvidence.entriesByGid.size === 0
      )
      .map((r) => r.contract.destinationKey);
    const incompleteChoiceDestKeys = drawer10Rows
      .filter(
        (r) =>
          (r.contract.isWritableInBatch1 === true &&
            r.typeAndCompleteness?.ready === true &&
            r.referenceEvidence?.evidenceLoaded === true &&
            r.referenceEvidence?.isComplete !== true) ||
          r.typeAndCompleteness?.code === "category_eligibility_incomplete" ||
          r.baselineObservation?.categoryEligibility?.isComplete === false ||
          (isCurrentRefChoicesBoundAndFresh &&
            currentRefChoicesRecord?.verifiedReferenceEntriesByDestination?.[
              r.contract.destinationKey
            ]?.status === "incomplete")
      )
      .map((r) => r.contract.destinationKey);

    const currentVisionCandidates =
      stagedVisionCandidatesByProduct?.[activeProductId] || {};

    let standardizedReadinessState = "choices_not_loaded";
    let standardizedReadinessReason =
      `${drawer10Rows.length} retained shopify.* reference attributes connected (${eligibleStandardizedDestKeys.length} category/definition-eligible on product, ${blockedStandardizedDestKeys.length} blocked by category/definition). Reference choices load automatically when the product baseline is ready.`;

    if (isRefChoicesBusy) {
      standardizedReadinessState = "loading_reference_choices";
      standardizedReadinessReason =
        "Loading and verifying Metaobject reference choices from Shopify...";
    } else if (currentRefChoicesRecord && !isCurrentRefChoicesBoundAndFresh) {
      standardizedReadinessState = "stale_reference_choices_discarded";
      standardizedReadinessReason =
        "Previously loaded reference choices were invalidated because the product baseline or category changed; reloading reference choices for the updated baseline.";
    } else if (isCurrentRefChoicesBoundAndFresh && currentRefChoicesRecord) {
      if (currentRefChoicesRecord.state === "failed_or_incomplete") {
        standardizedReadinessState = "failed_or_incomplete";
        standardizedReadinessReason =
          currentRefChoicesRecord.summary ||
          "Reference choices load was incomplete or reported errors.";
      } else if (!currentRefChoicesRecord.ok || incompleteChoiceDestKeys.length > 0) {
        standardizedReadinessState =
          verifiedChoiceReadyDestKeys.length > 0
            ? "partial_verified_choices_loaded"
            : "failed_or_incomplete";
        standardizedReadinessReason =
          currentRefChoicesRecord.summary ||
          "Reference choices load completed with partial or incomplete attributes.";
      } else if (verifiedChoiceReadyDestKeys.length > 0) {
        standardizedReadinessState = "verified_choices_loaded";
        standardizedReadinessReason = currentRefChoicesRecord.summary;
      } else {
        standardizedReadinessState = "no_verified_choices_available";
        standardizedReadinessReason = currentRefChoicesRecord.summary;
      }
    }

    const saveVerificationEvidence = {
      hasRepairAttemptInSession: Boolean(activeSaveReportForCurrentProduct),
      lastRepairSubmissionId: activeSaveReportForCurrentProduct?.submissionId || null,
      lastRepairVariantTargetId: activeSaveReportForCurrentProduct?.variantTargetId || null,
      lastRepairCompletedAt: activeSaveReportForCurrentProduct?.completedAt || null,
      lastRepairOverallOutcome: activeSaveReportForCurrentProduct?.overallOutcome || null,
      lastRepairStatus: activeSaveReportForCurrentProduct?.writerStatus || null,
      lastRepairMessage: activeSaveReportForCurrentProduct?.message || null,
      lastRepairSuccess: activeSaveReportForCurrentProduct
        ? activeSaveReportForCurrentProduct.overallOutcome ===
          "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
        : null,
      readBackVerified:
        activeSaveReportForCurrentProduct?.readBackVerified !== undefined
          ? activeSaveReportForCurrentProduct.readBackVerified
          : null,
      verifiedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.verifiedDestinations
      )
        ? activeSaveReportForCurrentProduct.verifiedDestinations
        : [],
      attemptedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.submittedDestinations
      )
        ? activeSaveReportForCurrentProduct.submittedDestinations
        : [],
      unconfirmedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.unconfirmedDestinations
      )
        ? activeSaveReportForCurrentProduct.unconfirmedDestinations
        : [],
      skippedKeys: Array.isArray(activeSaveReportForCurrentProduct?.skippedKeys)
        ? activeSaveReportForCurrentProduct.skippedKeys
        : [],
      unsupportedKeys: Array.isArray(activeSaveReportForCurrentProduct?.unsupportedKeys)
        ? activeSaveReportForCurrentProduct.unsupportedKeys
        : [],
      unchanged: Array.isArray(activeSaveReportForCurrentProduct?.unchanged)
        ? activeSaveReportForCurrentProduct.unchanged
        : [],
      blockedFields:
        activeSaveReportForCurrentProduct?.blockedFields &&
        typeof activeSaveReportForCurrentProduct.blockedFields === "object"
          ? activeSaveReportForCurrentProduct.blockedFields
          : {},
      conflicts:
        activeSaveReportForCurrentProduct?.conflicts &&
        typeof activeSaveReportForCurrentProduct.conflicts === "object"
          ? activeSaveReportForCurrentProduct.conflicts
          : {},
      unresolvedChanges:
        activeSaveReportForCurrentProduct?.unresolvedChanges &&
        typeof activeSaveReportForCurrentProduct.unresolvedChanges === "object"
          ? activeSaveReportForCurrentProduct.unresolvedChanges
          : {},
      errors: Array.isArray(activeSaveReportForCurrentProduct?.errors)
        ? activeSaveReportForCurrentProduct.errors
        : []
    };

    const snapshotBodyWithoutRevision = {
      schemaVersion: 1,
      stateKind: TELEMETRY_LIVE_BENCH_MODE,
      productTitle: activeProductHeadline,
      pieceName: activeProductPieceName,
      rawShopifyProductTitle: activeProductTitle,
      manifestLoaded: isManifestFullyLoaded,
      baselineState,
      baselineEventKind,
      productQueueStatus: null,
      dataAuthorityNote:
        "rawStoredBaseline reflects the last Shopify Admin GraphQL baseline read at baselineLoadedAt (not a fresh live Shopify query on snapshot read). workingState reflects unsaved browser drafts, exact approvals, and Keep Original decisions at clientStateChangedAt.",
      runIdentity: orderedEvents.runIdentity,
      runTimestamp: orderedEvents.runTimestamp,
      latestEventKind: orderedEvents.latestEventKind,
      systemStatus: {
        contractVersion: BENCH_V2_CONTRACT_VERSION,
        activeFilter,
        openDrawerIds: Object.entries(openDrawersById || {})
          .filter(([, isOpen]) => Boolean(isOpen))
          .map(([id]) => id),
        isWriterBusy,
        isAiScanBusy,
        isRefChoicesBusy,
        isBaselineReloading,
        isPickerLoading,
        hasBaselineErrors,
        metafieldsReadComplete: currentBaseline?.metafieldsReadComplete ?? null,
        defsReadComplete: currentBaseline?.defsReadComplete ?? null,
        variantsReadComplete: currentBaseline?.variantsReadComplete ?? null,
        primaryVariantId: currentBaseline?.primaryVariantId ?? null,
        variantCount: currentBaseline?.variantCount ?? null,
        variantTargetStatus: currentBaseline?.variantTargetStatus ?? null,
        variantMetafieldsReadComplete:
          currentBaseline?.variantMetafieldsReadComplete ?? null,
        variantDefsReadComplete: currentBaseline?.variantDefsReadComplete ?? null,
        nativeTargetsComplete: currentBaseline?.nativeTargets?.isComplete ?? null,
        selectionError: selectionError || null,
        loadError: loadError || null,
        baselineErrors: Array.isArray(currentBaseline?.errors)
          ? currentBaseline.errors
          : [],
        variantMetafieldsReadError:
          currentBaseline?.variantMetafieldsReadError || null,
        variantDefReadErrors: Array.isArray(currentBaseline?.variantDefReadErrors)
          ? currentBaseline.variantDefReadErrors
          : [],
        clientPrevalidationBanner: clientPrevalidationBanner || null
      },
      diagnosticsStats: {
        totalContractFields: allEvaluatedRows.length,
        totalFieldsInSnapshotMap: Object.keys(fieldsByKey).length,
        visibleFilteredRowCount: totalVisibleFilteredRowCount,
        stagedDraftCount: stagedProposalRows.length,
        approvedToSaveCount: validApprovedRows.length,
        keepOriginalCount: keepOriginalRows.length,
        heldAiAlternativesCount,
        mediaPhotoCount: activeProductMediaItems.length,
        lastAiScanSummary: currentAiScanReport
          ? {
              requestId: currentAiScanReport.requestId,
              completedAt: currentAiScanReport.completedAt,
              ok: currentAiScanReport.ok,
              summary: currentAiScanReport.summary,
              receivedCount: currentAiScanReport.receivedCount,
              stagedCount: currentAiScanReport.stagedCount,
              heldConflictCount: currentAiScanReport.heldConflictCount,
              unchangedSkippedCount: currentAiScanReport.unchangedSkippedCount,
              rejectedInvalidCount: currentAiScanReport.rejectedInvalidCount,
              ignoredManualOnlyCount: currentAiScanReport.ignoredManualOnlyCount,
              diagnostics: currentAiScanReport.diagnostics || {},
              details: Array.isArray(currentAiScanReport.details)
                ? currentAiScanReport.details
                : [],
              proposalsByDestination:
                currentAiScanReport.proposalsByDestination || {}
            }
          : null
      },
      manualEditedKeys,
      explicitlyApprovedKeys,
      keepOriginalKeys,
      standardizedReferenceState: {
        readinessState: standardizedReadinessState,
        readinessReason: standardizedReadinessReason,
        stagedCandidateCount: Object.keys(currentVisionCandidates).length,
        stagedCandidates: currentVisionCandidates,
        eligibleDestinationKeys: eligibleStandardizedDestKeys,
        verifiedChoiceReadyDestinationKeys: verifiedChoiceReadyDestKeys,
        emptyChoiceEligibleDestinationKeys: emptyChoiceEligibleDestKeys,
        incompleteChoiceDestinationKeys: incompleteChoiceDestKeys,
        blockedDestinationKeys: blockedStandardizedDestKeys,
        lastMatchRequestId: isCurrentRefChoicesBoundAndFresh
          ? currentRefChoicesRecord?.requestId || null
          : null,
        lastMatchedAt: isCurrentRefChoicesBoundAndFresh
          ? currentRefChoicesRecord?.completedAt || null
          : null,
        lastMatchSuccess: isCurrentRefChoicesBoundAndFresh
          ? Boolean(currentRefChoicesRecord?.ok)
          : null,
        lastMatchIsComplete: isCurrentRefChoicesBoundAndFresh
          ? Boolean(currentRefChoicesRecord?.rawResponse?.isComplete)
          : null,
        productCategory: currentBaseline?.productCategory || null
      },
      saveVerificationEvidence,
      sectionOrder,
      fieldsByKey
    };

    const fingerprintObj = {
      benchSessionId: benchSessionIdRef.current,
      selectionState: "selected",
      productId: activeProductId,
      baselineLoadedAt,
      snapshotBodyWithoutRevision
    };

    const contentFingerprint = JSON.stringify(fingerprintObj);
    if (contentFingerprint === lastEnqueuedFingerprintRef.current) {
      return;
    }

    lastEnqueuedFingerprintRef.current = contentFingerprint;
    const clientStateChangedAt = new Date().toISOString();

    latestQueuedSnapshotSpecRef.current = {
      benchSessionId: benchSessionIdRef.current,
      selectionState: "selected",
      productId: activeProductId,
      productTitle: activeProductHeadline,
      baselineLoadedAt,
      clientStateChangedAt,
      runIdentity: orderedEvents.runIdentity,
      runTimestamp: orderedEvents.runTimestamp,
      snapshotBodyWithoutRevision
    };

    drainTelemetryPublishQueue();
  });

  return { telemetrySyncStatus };
}
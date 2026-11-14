// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 AI SCAN & CANDIDATE RESOLUTION (CLIENT MODULE)
// File: app/utils/bench-v2.ai-scan-controller.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (File 1 of 2 for AI scan
// controller extraction). Contains producer-backed geology & Vision-backed
// standardized reference destination sets, candidate resolution against
// verified Metaobject reference entries, explicit AI Scan submission
// (including dynamic verified Color choices and both OOAK observed types),
// unapproved AI draft staging, held AI alternatives, and once-per-request
// deferred reference candidate resolution when reference choices arrive after
// AI Scan.
// ==========================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFetcher } from "react-router";
import {
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  isManualMeasurementDestination,
  isManualOnlyNoAiDestination,
  isExactMetaobjectDefinitionGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  inspectStoredReferenceListRawValue,
  inspectVerifiedReferenceEvidenceForDestination,
  validateBatch1ProposedValue,
  isExactValueApprovalValid,
  isKeepOriginalRecordValid
} from "./bench-v2.contract.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  isExactMetaobjectGid,
  collectVerifiedEntriesForResolution,
  areReferenceGidSetsSemanticallyEquivalent,
  evaluateCandidateLabelResolution
} from "./meta-injector.standardized.jsx";
import {
  buildStandardizedBaselineContextSignature
} from "./bench-v2.reference-loader.jsx";
import {
  RETIRED_ERA_DESTINATIONS,
  isRetiredParkedBenchDestination,
  getProposalValueString,
  hasExplicitReferenceReplacementFlag
} from "./bench-v2.json-draft-importer.jsx";

export const PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    "shopify.crystal-system",
    "shopify.mineral-class",
    "shopify.rock-composition",
    "shopify.rock-formation"
  ])
);

export const VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set(ALLOWED_VISION_CANDIDATE_KEYS.map((k) => `shopify.${k}`))
);

export const AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    ...PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS,
    ...VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS
  ])
);

export function resolveProducerBackedGeologyReferenceCandidate({
  productId,
  destKey,
  candidateLabels,
  targetBaseline,
  refChoicesRecord,
  isRefChoicesFreshForBaseline
}) {
  const cleanLabels = Array.isArray(candidateLabels)
    ? candidateLabels
        .filter((lbl) => typeof lbl === "string" && lbl.trim() !== "")
        .map((lbl) => lbl.trim())
    : [];
  const displayLabel = cleanLabels.join(", ");

  if (cleanLabels.length === 0) {
    return {
      status: "invalid_candidate",
      displayLabel: "",
      reason: `Empty standardized reference candidate label on ${destKey}.`
    };
  }

  if (isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
    return {
      status: "not_eligible_contract",
      displayLabel,
      reason: `Destination ${destKey} is retired and removed from the Bench V2 contract.`
    };
  }

  const contract = getFieldContractByDestination(destKey);
  if (
    !contract ||
    !contract.isWritableInBatch1 ||
    contract.namespace !== "shopify" ||
    !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
  ) {
    return {
      status: "not_eligible_contract",
      displayLabel,
      reason: `Destination ${destKey} is not an authorized producer-backed or Vision-backed standardized reference companion.`
    };
  }

  if (!targetBaseline || targetBaseline.productId !== productId) {
    return {
      status: "pending_reference_choices",
      displayLabel,
      reason: `Product baseline is not loaded for ${destKey}; retaining candidate "${displayLabel}" until reference choices are ready.`
    };
  }

  const baselineObs = buildBaselineObservation(targetBaseline, destKey);
  const typeCheck = evaluateDestinationTypeAndCompleteness({
    contract,
    baselineObs
  });

  if (!typeCheck.ready) {
    const isPendingBaselineRead =
      typeCheck.code === "metafields_read_not_complete" ||
      typeCheck.code === "definitions_read_not_complete" ||
      typeCheck.code === "product_category_read_not_complete" ||
      typeCheck.code === "category_eligibility_incomplete";
    return {
      status: isPendingBaselineRead ? "pending_reference_choices" : "held_ineligible_or_blocked",
      displayLabel,
      reason:
        typeCheck.reason ||
        `Destination ${destKey} is not eligible on this product.`
    };
  }

  const storedCheck = inspectStoredReferenceListRawValue(baselineObs.rawValue);
  if (!storedCheck.valid) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: `Existing stored reference list on ${destKey} could not be parsed safely: ${storedCheck.error}`
    };
  }

  const verifiedFieldRes =
    targetBaseline.verifiedReferenceEntriesByDestination?.[destKey] ||
    (isRefChoicesFreshForBaseline
      ? refChoicesRecord?.verifiedReferenceEntriesByDestination?.[destKey]
      : null) ||
    null;

  if (!verifiedFieldRes || typeof verifiedFieldRes !== "object") {
    return {
      status: "pending_reference_choices",
      displayLabel,
      reason: `Verified Metaobject reference choices for ${destKey} (${baselineObs.restrictedMetaobjectDefinitionId || "definition"}) are still loading or pending; retaining candidate "${displayLabel}".`
    };
  }

  if (
    verifiedFieldRes.status === "category_ineligible" ||
    verifiedFieldRes.isCategoryEligible === false ||
    verifiedFieldRes.categoryEligibility?.isEligible === false
  ) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason:
        verifiedFieldRes.categoryEligibility?.reason ||
        (Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors[0]) ||
        `Blocked by product category constraint on ${destKey}.`
    };
  }

  if (
    verifiedFieldRes.isComplete !== true ||
    !isExactMetaobjectDefinitionGid(verifiedFieldRes.restrictedMetaobjectDefinitionId) ||
    verifiedFieldRes.restrictedMetaobjectDefinitionId !==
      baselineObs.restrictedMetaobjectDefinitionId
  ) {
    const firstErr =
      Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors.length > 0
        ? verifiedFieldRes.errors[0]
        : `Incomplete or mismatched reference choice enumeration on ${destKey}.`;
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: firstErr
    };
  }

  const refAssignment = verifiedFieldRes.currentAssignment;
  if (
    !refAssignment ||
    typeof refAssignment !== "object" ||
    refAssignment.readComplete !== true ||
    refAssignment.parseValid !== true
  ) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason:
        refAssignment?.parseError ||
        `Existing assignment preservation cannot be established on ${destKey}.`
    };
  }

  const rawVerifiedEntriesMap = collectVerifiedEntriesForResolution(verifiedFieldRes);
  const strictVerifiedEntriesMap = new Map();
  rawVerifiedEntriesMap.forEach((entryObj, gid) => {
    if (
      isExactMetaobjectGid(gid) &&
      entryObj &&
      entryObj.definitionId === baselineObs.restrictedMetaobjectDefinitionId
    ) {
      strictVerifiedEntriesMap.set(gid, entryObj);
    }
  });

  if (strictVerifiedEntriesMap.size === 0) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason: `0 verified Metaobject entries exist in Shopify for ${baselineObs.restrictedMetaobjectDefinitionId} (${destKey}); held candidate "${displayLabel}".`
    };
  }

  const existingGids = [...storedCheck.gids];
  if (Array.isArray(refAssignment.referenceIds)) {
    for (const refGid of refAssignment.referenceIds) {
      if (typeof refGid === "string" && isExactMetaobjectGid(refGid.trim())) {
        const trimmedRefGid = refGid.trim();
        if (!existingGids.includes(trimmedRefGid)) {
          existingGids.push(trimmedRefGid);
        }
      }
    }
  }

  const labelEvaluations = cleanLabels.map((lbl) =>
    evaluateCandidateLabelResolution(
      lbl,
      verifiedFieldRes,
      strictVerifiedEntriesMap,
      existingGids
    )
  );

  const failedEval = labelEvaluations.find(
    (ev) =>
      ev.status === "missing_entry" ||
      ev.status === "ambiguous_blocked" ||
      ev.status === "blocked" ||
      !ev.selectedEntry ||
      !isExactMetaobjectGid(ev.selectedEntry.id) ||
      ev.selectedEntry.definitionId !== baselineObs.restrictedMetaobjectDefinitionId
  );

  if (failedEval) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason:
        failedEval.reason ||
        `Candidate "${displayLabel}" did not resolve to a unique/equivalent verified entry on ${destKey}.`
    };
  }

  const resolvedOnlyGids = [];
  const matchedLabelsList = [];
  for (const ev of labelEvaluations) {
    const selectedGid = ev.selectedEntry.id;
    if (!resolvedOnlyGids.includes(selectedGid)) {
      resolvedOnlyGids.push(selectedGid);
    }
    matchedLabelsList.push(
      `${ev.selectedEntry.label || displayLabel} (${selectedGid})`
    );
  }

  if (resolvedOnlyGids.length === 0) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason: `Candidate "${displayLabel}" resolved to 0 verified Metaobject entries on ${destKey}.`
    };
  }

  const isSemanticallyEquivalentToSaved = Boolean(
    baselineObs.presence === "present" &&
      storedCheck.gids.length > 0 &&
      areReferenceGidSetsSemanticallyEquivalent(
        resolvedOnlyGids,
        storedCheck.gids,
        strictVerifiedEntriesMap,
        baselineObs.restrictedMetaobjectDefinitionId
      )
  );

  if (isSemanticallyEquivalentToSaved) {
    const preservedStoredRaw =
      typeof baselineObs.rawValue === "string" && baselineObs.rawValue.trim() !== ""
        ? baselineObs.rawValue.trim()
        : JSON.stringify(storedCheck.gids);
    return {
      status: "unchanged_from_baseline",
      displayLabel,
      serializedValue: preservedStoredRaw,
      allowExplicitReferenceListReplacement: false,
      matchedSummary: matchedLabelsList.join(", "),
      reason: "Resolved reference candidate is canonically equivalent to the current saved reference list."
    };
  }

  const resolvedSet = new Set(resolvedOnlyGids);
  const omitsAnyStoredGid = existingGids.some((g) => !resolvedSet.has(g));
  const serializedGidArray = JSON.stringify(resolvedOnlyGids);

  const baselineWithVerifiedRef =
    targetBaseline.verifiedReferenceEntriesByDestination?.[destKey]
      ? targetBaseline
      : {
          ...targetBaseline,
          verifiedReferenceEntriesByDestination: {
            ...(targetBaseline.verifiedReferenceEntriesByDestination || {}),
            [destKey]: verifiedFieldRes
          }
        };

  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey: destKey,
    proposedValue: serializedGidArray,
    baselineSnapshot: baselineWithVerifiedRef,
    allowExplicitReferenceListReplacement: omitsAnyStoredGid
  });

  if (!validation.valid) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: validation.reason
    };
  }

  if (validation.isUnchangedFromStored) {
    return {
      status: "unchanged_from_baseline",
      displayLabel,
      serializedValue: validation.normalizedValue,
      allowExplicitReferenceListReplacement: false,
      matchedSummary: matchedLabelsList.join(", "),
      reason: validation.reason
    };
  }

  return {
    status: "resolved_valid_change",
    displayLabel,
    serializedValue: validation.normalizedValue,
    allowExplicitReferenceListReplacement: Boolean(
      omitsAnyStoredGid && validation.allowExplicitReferenceListReplacement === true
    ),
    matchedSummary: matchedLabelsList.join(", "),
    reason: null
  };
}

export function useBenchV2AiScanController({
  activeProductId,
  activeProductTitle,
  benchSessionIdRef,
  baselineByProductRef,
  currentBaselineRef,
  currentRefChoicesRecordRef,
  isCurrentRefChoicesBoundAndFreshRef,
  isAnyOperationBusyRef,
  isJsonImportBusy,
  proposedByProduct,
  proposedByProductRef,
  setProposedByProduct,
  approvalsByProduct,
  approvalsByProductRef,
  setApprovalsByProduct,
  keepOriginalByProduct,
  keepOriginalByProductRef,
  setKeepOriginalByProduct,
  setClientPrevalidationBanner,
  clearDecisionForDestination
}) {
  const aiScanFetcher = useFetcher();

  // Held AI Alternatives State
  const [aiAlternativesByProduct, setAiAlternativesByProduct] = useState({});

  // Explicit AI Scan Request Tracking & Honest Scan Report
  const [activeAiScanRequest, setActiveAiScanRequest] = useState(null);
  const [lastAiScanReportByProduct, setLastAiScanReportByProduct] = useState({});
  const processedAiScanRequestIdRef = useRef(null);
  const activeAiScanRequestRef = useRef(null);

  // Staged Vision Candidates State (Populated by AI Scan, read by Reference Loader & Telemetry)
  const [stagedVisionCandidatesByProduct, setStagedVisionCandidatesByProduct] = useState({});
  const stagedVisionCandidatesByProductRef = useRef(stagedVisionCandidatesByProduct);
  useEffect(() => {
    stagedVisionCandidatesByProductRef.current = stagedVisionCandidatesByProduct;
  }, [stagedVisionCandidatesByProduct]);

  // Pending Producer-Backed & Vision-Backed Standardized Reference Candidates State
  // Retains unresolved geology & Vision reference candidates when AI Scan arrives before
  // reference choices finish loading, so either arrival order resolves once without
  // rescanning, loops, or auto-approval.
  const [pendingGeologyRefCandidatesByProduct, setPendingGeologyRefCandidatesByProduct] =
    useState({});

  useEffect(() => {
    activeAiScanRequestRef.current = activeAiScanRequest;
  }, [activeAiScanRequest]);

  const isAiScanBusy = aiScanFetcher.state !== "idle" || Boolean(activeAiScanRequest);

  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentAiAlternativesMap = aiAlternativesByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};
  const currentAiScanReport = lastAiScanReportByProduct[activeProductId] || null;
  const currentScanProposalsMetaMap =
    currentAiScanReport?.proposalsByDestination &&
    typeof currentAiScanReport.proposalsByDestination === "object"
      ? currentAiScanReport.proposalsByDestination
      : {};

  const handleExplicitAiScanProduct = () => {
    setClientPrevalidationBanner(null);

    const currentBaseline = currentBaselineRef.current;
    const isCurrentRefChoicesBoundAndFresh = Boolean(
      isCurrentRefChoicesBoundAndFreshRef.current
    );
    const currentRefChoicesRecord = currentRefChoicesRecordRef.current;
    const isAnyOperationBusy = Boolean(isAnyOperationBusyRef.current) || isAiScanBusy;

    if (isAnyOperationBusy || isJsonImportBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Operation already in progress",
        reasons: ["Wait for the current operation to complete before starting an AI Scan."]
      });
      return;
    }

    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: Product baseline not loaded",
        reasons: [`Reload ${activeProductTitle} so its baseline and photos are available.`]
      });
      return;
    }

    if (
      currentBaseline.metafieldsReadComplete !== true ||
      currentBaseline.defsReadComplete !== true
    ) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: Baseline read incomplete",
        reasons: [
          "Product metafields or live definitions did not finish loading. Click Reload Product first."
        ]
      });
      return;
    }

    const mediaEdges = Array.isArray(currentBaseline.nativeTargets?.media?.edges)
      ? currentBaseline.nativeTargets.media.edges
      : [];
    const mediaInputs = mediaEdges
      .map((edge) => {
        const node = edge?.node;
        const url = node?.preview?.image?.url || "";
        const imageId = node?.id || "";
        return url && imageId ? { imageId, url } : null;
      })
      .filter(Boolean);

    if (mediaInputs.length === 0) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: No product photos found",
        reasons: [
          `No valid MediaImage URLs were found on ${activeProductTitle} for Gemini Vision.`
        ]
      });
      return;
    }

    const operatorLockedList = [];
    const passiveStoredList = [];
    const contextKeyValues = {};

    for (const bareKey of ENGINE_ALLOWED_PROVENANCE_BARE_KEYS) {
      if (CANCELLED_INERT_DESTINATIONS.has(bareKey)) continue;

      let destKey = `custom.${bareKey}`;
      if (bareKey === "price") destKey = "native_price";
      else if (bareKey === "poetic_hook") destKey = "native_seo_description";

      if (destKey.startsWith("custom.") && isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
        continue;
      }

      const isSeoTitleDualKey = bareKey === "seo_title";
      const candidateDestKeys = isSeoTitleDualKey
        ? ["custom.seo_title", "native_seo_title"]
        : [destKey];

      let lockedHumanVal = "";
      let hasLockedHumanOrKeepOriginal = false;

      for (const checkDest of candidateDestKeys) {
        const propEntry = currentProposedMap[checkDest];
        const propValStr = getProposalValueString(propEntry);
        const hasHumanDraft = Boolean(
          propEntry &&
            typeof propEntry === "object" &&
            propEntry.origin === "Manual" &&
            propValStr.trim() !== ""
        );

        const allowRepForCheck = hasExplicitReferenceReplacementFlag(
          propEntry,
          checkDest,
          propValStr
        );
        const approvalRec = currentApprovalsMap[checkDest];
        const hasValidApproval = Boolean(
          approvalRec &&
            propEntry &&
            isExactValueApprovalValid({
              approvalRecord: approvalRec,
              productId: activeProductId,
              destinationKey: checkDest,
              currentProposedValue: propValStr,
              baselineSnapshot: currentBaseline,
              allowExplicitReferenceListReplacement: allowRepForCheck
            })
        );

        const keepOrigRec = currentKeepOriginalMap[checkDest];
        const hasValidKeepOriginal = Boolean(
          keepOrigRec &&
            propEntry &&
            isKeepOriginalRecordValid({
              keepOriginalRecord: keepOrigRec,
              productId: activeProductId,
              destinationKey: checkDest,
              currentProposedValue: propValStr,
              baselineSnapshot: currentBaseline
            })
        );

        if (hasHumanDraft || hasValidApproval) {
          const humanVal = propValStr.trim();
          if (humanVal !== "") {
            lockedHumanVal = humanVal;
            hasLockedHumanOrKeepOriginal = true;
            break;
          }
        }

        if (hasValidKeepOriginal) {
          const storedForCheck =
            checkDest === "native_seo_title"
              ? String(currentBaseline.nativeTargets?.seo?.title ?? "").trim()
              : checkDest === "native_price"
                ? String(currentBaseline.nativeTargets?.price ?? "").trim()
                : checkDest === "native_seo_description"
                  ? String(currentBaseline.nativeTargets?.seo?.description ?? "").trim()
                  : String(currentBaseline.currentMetafields?.[checkDest] ?? "").trim();
          if (storedForCheck !== "") {
            lockedHumanVal = storedForCheck;
            hasLockedHumanOrKeepOriginal = true;
            break;
          }
        }
      }

      if (hasLockedHumanOrKeepOriginal && lockedHumanVal !== "") {
        operatorLockedList.push(bareKey);
        contextKeyValues[bareKey] = lockedHumanVal;
        continue;
      }

      let storedVal = "";
      if (bareKey === "price") {
        storedVal = currentBaseline.nativeTargets?.price || "";
      } else if (bareKey === "poetic_hook") {
        storedVal = currentBaseline.nativeTargets?.seo?.description || "";
      } else if (bareKey === "seo_title") {
        const rawCustomSeo = currentBaseline.currentMetafields?.["custom.seo_title"];
        const rawNativeSeo = currentBaseline.nativeTargets?.seo?.title;
        storedVal =
          rawCustomSeo !== undefined && rawCustomSeo !== null && String(rawCustomSeo).trim() !== ""
            ? String(rawCustomSeo).trim()
            : rawNativeSeo !== undefined && rawNativeSeo !== null
              ? String(rawNativeSeo).trim()
              : "";
      } else {
        const rawMf = currentBaseline.currentMetafields?.[`custom.${bareKey}`];
        storedVal = rawMf !== undefined && rawMf !== null ? String(rawMf).trim() : "";
      }

      if (storedVal !== "") {
        passiveStoredList.push(bareKey);
        contextKeyValues[bareKey] = storedVal;
      }
    }

    // Only populate observedDestinationTypes with genuinely observed Shopify types
    // (liveDefType || storedType), never claiming a reviewed_exact_contract type was observed.
    const observedDestinationTypes = {};
    for (const destKey of BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS) {
      const obs = buildBaselineObservation(currentBaseline, destKey);
      const contract = getFieldContractByDestination(destKey);
      const typeCheck = evaluateDestinationTypeAndCompleteness({
        contract,
        baselineObs: obs
      });
      if (typeCheck.ready && typeCheck.observedShopifyType) {
        observedDestinationTypes[destKey] = typeCheck.observedShopifyType;
      }
    }

    const ooak1Obs = buildBaselineObservation(currentBaseline, "custom.is_one_of_a_kind");
    const ooak1TypeCheck = evaluateDestinationTypeAndCompleteness({
      contract: getFieldContractByDestination("custom.is_one_of_a_kind"),
      baselineObs: ooak1Obs
    });
    const ooak1ObservedType =
      observedDestinationTypes["custom.is_one_of_a_kind"] ||
      (ooak1TypeCheck.ready && ooak1TypeCheck.observedShopifyType === "single_line_text_field"
        ? ooak1TypeCheck.observedShopifyType
        : "");
    const ooak2ObservedType = observedDestinationTypes["custom.is_ooak"] || "";

    // Extract live verified Color choices for shopify.color-pattern when bound, fresh,
    // eligible, and complete on the active product (transport prompt vocabulary only).
    let verifiedColorPatternChoicesJson = null;
    if (
      isCurrentRefChoicesBoundAndFresh &&
      currentRefChoicesRecord &&
      currentRefChoicesRecord.productId === activeProductId &&
      currentBaseline.productId === activeProductId
    ) {
      const colorPatternContract = getFieldContractByDestination("shopify.color-pattern");
      const colorPatternObs = buildBaselineObservation(
        currentBaseline,
        "shopify.color-pattern"
      );
      const colorPatternTypeCheck = evaluateDestinationTypeAndCompleteness({
        contract: colorPatternContract,
        baselineObs: colorPatternObs
      });

      if (
        colorPatternContract &&
        colorPatternContract.isWritableInBatch1 &&
        colorPatternTypeCheck.ready &&
        isExactMetaobjectDefinitionGid(colorPatternObs.restrictedMetaobjectDefinitionId)
      ) {
        const colorRefEvidence = inspectVerifiedReferenceEvidenceForDestination(
          currentBaseline,
          "shopify.color-pattern",
          colorPatternObs.restrictedMetaobjectDefinitionId
        );

        if (
          colorRefEvidence.evidenceLoaded &&
          colorRefEvidence.isComplete &&
          colorRefEvidence.restrictedMetaobjectDefinitionId ===
            colorPatternObs.restrictedMetaobjectDefinitionId &&
          colorRefEvidence.entriesByGid instanceof Map &&
          colorRefEvidence.entriesByGid.size > 0
        ) {
          const verifiedColorLabels = [];
          const seenLowerColorLabels = new Set();
          let hasInvalidChoiceEntry = false;

          colorRefEvidence.entriesByGid.forEach((entryObj, gid) => {
            if (hasInvalidChoiceEntry) return;
            if (
              !isExactMetaobjectGid(gid) ||
              !entryObj ||
              entryObj.definitionId !== colorPatternObs.restrictedMetaobjectDefinitionId ||
              typeof entryObj.label !== "string"
            ) {
              hasInvalidChoiceEntry = true;
              return;
            }
            const trimmedLabel = entryObj.label.trim();
            if (
              !trimmedLabel ||
              trimmedLabel === gid ||
              /^gid:\/\//i.test(trimmedLabel) ||
              (/metaobject/i.test(trimmedLabel) && /\d/.test(trimmedLabel))
            ) {
              hasInvalidChoiceEntry = true;
              return;
            }
            const lowerKey = trimmedLabel.replace(/\s+/g, " ").toLowerCase();
            if (!seenLowerColorLabels.has(lowerKey)) {
              seenLowerColorLabels.add(lowerKey);
              verifiedColorLabels.push(trimmedLabel);
            }
          });

          if (!hasInvalidChoiceEntry && verifiedColorLabels.length > 0) {
            verifiedColorPatternChoicesJson = JSON.stringify(verifiedColorLabels);
          }
        }
      }
    }

    const requestId = `bench_v2_aiscan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveAiScanRequest({
      requestId,
      productId: activeProductId,
      startedAt: new Date().toISOString()
    });

    const formData = new FormData();
    formData.append("intent", "tab3FullRescan");
    formData.append("benchV2OptIn", "true");
    formData.append("requestId", requestId);
    formData.append("pieceId", activeProductId);
    formData.append("productId", activeProductId);
    formData.append("productTitle", currentBaseline.productTitle || activeProductTitle || "");

    const humanPieceName =
      contextKeyValues.piece_name ||
      currentBaseline.currentMetafields?.["custom.piece_name"] ||
      "";
    if (humanPieceName) {
      formData.append("pieceName", String(humanPieceName));
      formData.append("humanPieceId", String(humanPieceName));
    }

    formData.append("mediaInputs", JSON.stringify(mediaInputs));
    if (mediaInputs[0]?.url) {
      formData.append("imageUrl", mediaInputs[0].url);
    }
    if (mediaInputs[0]?.imageId) {
      formData.append("imageId", mediaInputs[0].imageId);
    }

    formData.append("operator_locked_fields", JSON.stringify(operatorLockedList));
    formData.append("passive_stored_fields", JSON.stringify(passiveStoredList));
    formData.append("observed_destination_types", JSON.stringify(observedDestinationTypes));
    if (ooak1ObservedType) {
      formData.append("is_one_of_a_kind_observed_type", ooak1ObservedType);
    }
    if (ooak2ObservedType) {
      formData.append("is_ooak_observed_type", ooak2ObservedType);
    }
    if (verifiedColorPatternChoicesJson) {
      formData.append("verified_color_pattern_choices", verifiedColorPatternChoicesJson);
    }

    for (const [k, v] of Object.entries(contextKeyValues)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        formData.append(k, String(v));
      }
    }

    aiScanFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-autofill"
    });
  };

  useEffect(() => {
    if (aiScanFetcher.state !== "idle") return;
    const pendingScan = activeAiScanRequestRef.current;
    if (!pendingScan) return;

    if (processedAiScanRequestIdRef.current === pendingScan.requestId) {
      return;
    }
    processedAiScanRequestIdRef.current = pendingScan.requestId;

    const scannedProductId = pendingScan.productId;
    const rawResponse = aiScanFetcher.data;

    const recordFailedScan = (summary, diagnostics = {}) => {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary,
          receivedCount: 0,
          stagedCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics,
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
    };

    if (!rawResponse || typeof rawResponse !== "object") {
      recordFailedScan("AI Scan failed: no structured response returned by /app/meta-injector-autofill.");
      return;
    }

    const returnedRequestId = rawResponse.requestId || null;
    const returnedPieceId = rawResponse.pieceId || rawResponse.productId || null;

    if (returnedRequestId !== pendingScan.requestId || returnedPieceId !== scannedProductId) {
      recordFailedScan(
        `Ignored mismatched or stale AI Scan response (expected product ${scannedProductId} / request ${pendingScan.requestId}, got product ${String(
          returnedPieceId
        )} / request ${String(returnedRequestId)}).`
      );
      return;
    }

    if (rawResponse.success !== true) {
      recordFailedScan(
        rawResponse.error || "AI Scan returned an error.",
        rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
          ? rawResponse.producerDiagnostics
          : {}
      );
      return;
    }

    const rawVisionStandardizedCandidates =
      rawResponse.standardized_candidates &&
      typeof rawResponse.standardized_candidates === "object" &&
      !Array.isArray(rawResponse.standardized_candidates)
        ? rawResponse.standardized_candidates
        : null;

    if (rawVisionStandardizedCandidates) {
      setStagedVisionCandidatesByProduct((prev) => ({
        ...prev,
        [scannedProductId]: rawVisionStandardizedCandidates
      }));
    }

    const rawProducerProposals = rawResponse.producerProposals;
    if (
      !rawProducerProposals ||
      typeof rawProducerProposals !== "object" ||
      Array.isArray(rawProducerProposals)
    ) {
      recordFailedScan(
        "AI Scan response did not include producerProposals separation map; refused to stage tab3Data fallbacks."
      );
      return;
    }

    const combinedProducerAndVisionProposals = { ...rawProducerProposals };
    if (rawVisionStandardizedCandidates) {
      for (const visionAttrKey of ALLOWED_VISION_CANDIDATE_KEYS) {
        const destKey = `shopify.${visionAttrKey}`;
        if (isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
          continue;
        }
        if (Object.prototype.hasOwnProperty.call(combinedProducerAndVisionProposals, destKey)) {
          continue;
        }
        const candEntry =
          rawVisionStandardizedCandidates[visionAttrKey] ??
          rawVisionStandardizedCandidates[destKey];
        if (!candEntry || typeof candEntry !== "object" || Array.isArray(candEntry)) {
          continue;
        }
        const cleanVisionLabels = Array.isArray(candEntry.labels)
          ? candEntry.labels
              .filter((l) => typeof l === "string" && l.trim() !== "")
              .map((l) => l.trim())
          : [];
        if (cleanVisionLabels.length === 0) {
          continue;
        }
        const evidenceNote =
          typeof candEntry.evidence === "string" && candEntry.evidence.trim() !== ""
            ? candEntry.evidence.trim()
            : "";
        combinedProducerAndVisionProposals[destKey] = {
          candidateLabel: cleanVisionLabels.join(", "),
          labels: cleanVisionLabels,
          source: `Gemini Vision (standardized_candidates.${visionAttrKey})`,
          ...(evidenceNote ? { evidence: evidenceNote } : {})
        };
      }
    }

    const rawTargetBaseline = baselineByProductRef.current[scannedProductId] || null;
    const mergedActiveBaseline =
      currentBaselineRef.current &&
      currentBaselineRef.current.productId === scannedProductId
        ? currentBaselineRef.current
        : rawTargetBaseline;
    const isRefChoicesFreshForScannedProduct = Boolean(
      scannedProductId === activeProductId &&
        isCurrentRefChoicesBoundAndFreshRef.current &&
        currentRefChoicesRecordRef.current &&
        currentRefChoicesRecordRef.current.productId === scannedProductId
    );
    const targetBaseline = mergedActiveBaseline;
    const targetBaselineContextSig =
      buildStandardizedBaselineContextSignature(rawTargetBaseline);

    const existingProdProposals = { ...(proposedByProductRef.current[scannedProductId] || {}) };
    const existingProdApprovals = { ...(approvalsByProductRef.current[scannedProductId] || {}) };
    const existingProdKeepOriginal = keepOriginalByProductRef.current[scannedProductId] || {};
    const nextAiAlternativesForProd = {};
    const proposalsByDestination = {};
    const nextPendingGeologyRefForProd = {};

    const diagnosticsObj =
      rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
        ? { ...rawResponse.producerDiagnostics }
        : {};

    let receivedCount = 0;
    let stagedCount = 0;
    let heldConflictCount = 0;
    let unchangedSkippedCount = 0;
    let rejectedInvalidCount = 0;
    let ignoredManualOnlyCount = 0;
    const details = [];

    const stageOrHoldResolvedProposal = ({
      destKey,
      normalizedValue,
      reportedSource,
      displayNote = "",
      allowExplicitReferenceListReplacement = false
    }) => {
      const contractForDest = getFieldContractByDestination(destKey);
      const shouldBindReplacementIntent = Boolean(
        allowExplicitReferenceListReplacement === true &&
          contractForDest?.namespace === "shopify" &&
          contractForDest?.expectedType === "list.metaobject_reference" &&
          contractForDest?.isWritableInBatch1 === true &&
          typeof normalizedValue === "string" &&
          normalizedValue.trim() !== ""
      );

      const existingDraft = existingProdProposals[destKey];
      const existingDraftVal = getProposalValueString(existingDraft);
      const hasExistingDraft = Boolean(existingDraft && existingDraftVal.trim() !== "");
      const isManualDraft = Boolean(
        hasExistingDraft &&
          (typeof existingDraft !== "object" || existingDraft.origin !== "AI")
      );
      const existingAllowReplacement = hasExplicitReferenceReplacementFlag(
        existingDraft,
        destKey,
        existingDraftVal
      );

      const approvalRec = existingProdApprovals[destKey] || null;
      const hasValidApproval =
        hasExistingDraft &&
        isExactValueApprovalValid({
          approvalRecord: approvalRec,
          productId: scannedProductId,
          destinationKey: destKey,
          currentProposedValue: existingDraftVal,
          baselineSnapshot: targetBaseline,
          allowExplicitReferenceListReplacement: existingAllowReplacement
        });

      const keepOrigRec = existingProdKeepOriginal[destKey] || null;
      const hasValidKeepOriginal =
        hasExistingDraft &&
        isKeepOriginalRecordValid({
          keepOriginalRecord: keepOrigRec,
          productId: scannedProductId,
          destinationKey: destKey,
          currentProposedValue: existingDraftVal,
          baselineSnapshot: targetBaseline
        });

      const hasProtectedHumanState =
        isManualDraft || hasValidApproval || hasValidKeepOriginal;

      const formattedSuffix = displayNote ? ` [${displayNote}]` : "";

      if (hasProtectedHumanState) {
        if (
          existingDraftVal === normalizedValue &&
          existingAllowReplacement === shouldBindReplacementIntent &&
          !hasValidKeepOriginal
        ) {
          proposalsByDestination[destKey] = {
            value: normalizedValue,
            source: reportedSource,
            disposition: "Matches current draft"
          };
          details.push(
            `[${destKey}] AI suggestion matches your current draft ("${normalizedValue}"${formattedSuffix}) — Source: ${reportedSource}.`
          );
          return;
        }
        heldConflictCount++;
        nextAiAlternativesForProd[destKey] = {
          value: normalizedValue,
          source: reportedSource,
          ...(shouldBindReplacementIntent
            ? {
                allowExplicitReferenceListReplacement: true,
                explicitReplacementValue: normalizedValue
              }
            : {}),
          requestId: pendingScan.requestId,
          receivedAt: new Date().toISOString()
        };
        proposalsByDestination[destKey] = {
          value: normalizedValue,
          source: reportedSource,
          disposition: "Held as separate AI alternative"
        };
        details.push(
          `[${destKey}] Held AI alternative "${normalizedValue}"${formattedSuffix} (Source: ${reportedSource}) without overwriting your current draft or decision.`
        );
        return;
      }

      if (existingProdApprovals[destKey]) {
        delete existingProdApprovals[destKey];
      }

      existingProdProposals[destKey] = {
        value: normalizedValue,
        source: reportedSource,
        origin: "AI",
        ...(shouldBindReplacementIntent
          ? {
              allowExplicitReferenceListReplacement: true,
              explicitReplacementValue: normalizedValue
            }
          : {}),
        updatedAt: new Date().toISOString()
      };
      stagedCount++;
      proposalsByDestination[destKey] = {
        value: normalizedValue,
        source: reportedSource,
        disposition: "Staged as unapproved AI draft"
      };
      details.push(
        `[${destKey}] Staged unapproved AI draft "${normalizedValue}"${formattedSuffix} (Source: ${reportedSource}).`
      );
    };

    for (const [destKey, entry] of Object.entries(combinedProducerAndVisionProposals)) {
      if (
        CANCELLED_INERT_DESTINATIONS.has(destKey) ||
        RETIRED_ERA_DESTINATIONS.has(destKey) ||
        isRetiredParkedBenchDestination(destKey)
      ) {
        continue;
      }

      const contract = getFieldContractByDestination(destKey);
      const reportedSource =
        entry &&
        typeof entry === "object" &&
        typeof entry.source === "string" &&
        entry.source.trim() !== ""
          ? entry.source.trim()
          : "Source not reported";

      // Check for the 4 producer-backed geology reference companions and 7 Vision standardized candidates
      const isGeologyRefCandidateShape = Boolean(
        entry &&
          typeof entry === "object" &&
          typeof entry.value !== "string" &&
          (typeof entry.candidateLabel === "string" || Array.isArray(entry.labels))
      );

      if (isGeologyRefCandidateShape) {
        const candidateLabels =
          Array.isArray(entry.labels) && entry.labels.length > 0
            ? entry.labels
                .filter((l) => typeof l === "string" && l.trim() !== "")
                .map((l) => l.trim())
            : typeof entry.candidateLabel === "string" && entry.candidateLabel.trim() !== ""
              ? [entry.candidateLabel.trim()]
              : [];

        if (candidateLabels.length === 0) {
          continue;
        }

        const displayCandidateLabel = candidateLabels.join(", ");

        if (
          isManualOnlyNoAiDestination(destKey, contract) ||
          !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
        ) {
          ignoredManualOnlyCount++;
          const manualReason =
            "Manual-only or unauthorized standardized reference field — excluded from AI candidate staging.";
          proposalsByDestination[destKey] = {
            value: displayCandidateLabel,
            source: reportedSource,
            disposition: "Ignored (manual-only field — not staged)",
            reason: manualReason
          };
          details.push(
            `[${destKey}] Ignored standardized candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${manualReason}`
          );
          continue;
        }

        if (!BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey) || !contract || !contract.isWritableInBatch1) {
          continue;
        }

        receivedCount++;

        const resolution = resolveProducerBackedGeologyReferenceCandidate({
          productId: scannedProductId,
          destKey,
          candidateLabels,
          targetBaseline,
          refChoicesRecord: isRefChoicesFreshForScannedProduct
            ? currentRefChoicesRecordRef.current
            : null,
          isRefChoicesFreshForBaseline: isRefChoicesFreshForScannedProduct
        });

        if (resolution.status === "pending_reference_choices") {
          nextPendingGeologyRefForProd[destKey] = {
            destKey,
            candidateLabels,
            displayLabel: displayCandidateLabel,
            source: reportedSource,
            requestId: pendingScan.requestId,
            sessionId: benchSessionIdRef.current,
            productId: scannedProductId,
            baselineContextSig: targetBaselineContextSig
          };
          proposalsByDestination[destKey] = {
            value: displayCandidateLabel,
            source: reportedSource,
            disposition: "Pending verified reference choices (will resolve automatically when ready)",
            reason: resolution.reason
          };
          diagnosticsObj[destKey] = resolution.reason;
          details.push(
            `[${destKey}] Retained standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}) pending verified reference choices.`
          );
          continue;
        }

        if (resolution.status === "unchanged_from_baseline") {
          unchangedSkippedCount++;
          proposalsByDestination[destKey] = {
            value: resolution.serializedValue,
            source: reportedSource,
            disposition: "Matches saved value (not staged)"
          };
          details.push(
            `[${destKey}] Candidate "${displayCandidateLabel}" matches current saved reference list (${resolution.serializedValue}) — Source: ${reportedSource}; not staged.`
          );
          continue;
        }

        if (resolution.status === "resolved_valid_change") {
          stageOrHoldResolvedProposal({
            destKey,
            normalizedValue: resolution.serializedValue,
            reportedSource,
            displayNote: `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`,
            allowExplicitReferenceListReplacement: Boolean(
              resolution.allowExplicitReferenceListReplacement
            )
          });
          continue;
        }

        rejectedInvalidCount++;
        const holdDisposition =
          resolution.status === "held_unmatched_or_ambiguous"
            ? "Held (no unique/equivalent verified reference entry match)"
            : "Held (category-ineligible or incomplete reference evidence)";
        proposalsByDestination[destKey] = {
          value: displayCandidateLabel,
          source: reportedSource,
          disposition: holdDisposition,
          reason: resolution.reason
        };
        diagnosticsObj[destKey] = resolution.reason;
        details.push(
          `[${destKey}] Held standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${resolution.reason}`
        );
        continue;
      }

      const rawValue =
        entry && typeof entry === "object" && typeof entry.value === "string"
          ? entry.value
          : "";

      if (rawValue.trim() === "") {
        continue;
      }

      if (isManualOnlyNoAiDestination(destKey, contract)) {
        ignoredManualOnlyCount++;
        const manualReason = isManualMeasurementDestination(destKey)
          ? "Manual measurement field — excluded from AI staging; enter physical measurement manually."
          : destKey === "native_price" || destKey === "price"
            ? "Manual single-variant price field — excluded from AI staging; enter price manually."
            : contract?.owner === "PRODUCTVARIANT"
              ? "Manual/preset variant channel field — excluded from AI staging."
              : "Manual-only field — excluded from AI staging.";
        proposalsByDestination[destKey] = {
          value: rawValue,
          source: reportedSource,
          disposition: "Ignored (manual-only field — not staged)",
          reason: manualReason
        };
        details.push(
          `[${destKey}] Ignored AI suggestion "${rawValue}" (Source: ${reportedSource}): ${manualReason}`
        );
        continue;
      }

      if (!BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)) {
        continue;
      }

      if (!contract || !contract.isWritableInBatch1) {
        continue;
      }

      receivedCount++;

      let directProposalReplacementIntent = Boolean(
        entry &&
          typeof entry === "object" &&
          entry.allowExplicitReferenceListReplacement === true &&
          typeof entry.explicitReplacementValue === "string" &&
          entry.explicitReplacementValue === rawValue
      );

      if (
        contract.namespace === "shopify" &&
        contract.expectedType === "list.metaobject_reference" &&
        targetBaseline
      ) {
        const baselineObsForDirect = buildBaselineObservation(targetBaseline, destKey);
        const storedCheckForDirect = inspectStoredReferenceListRawValue(
          baselineObsForDirect.rawValue
        );
        const proposedCheckForDirect = inspectStoredReferenceListRawValue(rawValue);
        const refEvidenceForDirect = inspectVerifiedReferenceEvidenceForDestination(
          targetBaseline,
          destKey,
          baselineObsForDirect.restrictedMetaobjectDefinitionId
        );

        const isDirectEquivalentToSaved = Boolean(
          baselineObsForDirect.presence === "present" &&
            storedCheckForDirect.valid &&
            storedCheckForDirect.gids.length > 0 &&
            proposedCheckForDirect.valid &&
            proposedCheckForDirect.gids.length > 0 &&
            refEvidenceForDirect.evidenceLoaded &&
            refEvidenceForDirect.isComplete &&
            areReferenceGidSetsSemanticallyEquivalent(
              proposedCheckForDirect.gids,
              storedCheckForDirect.gids,
              refEvidenceForDirect.entriesByGid,
              baselineObsForDirect.restrictedMetaobjectDefinitionId
            )
        );

        if (isDirectEquivalentToSaved) {
          const preservedDirectRaw =
            typeof baselineObsForDirect.rawValue === "string" &&
            baselineObsForDirect.rawValue.trim() !== ""
              ? baselineObsForDirect.rawValue.trim()
              : JSON.stringify(storedCheckForDirect.gids);
          unchangedSkippedCount++;
          proposalsByDestination[destKey] = {
            value: preservedDirectRaw,
            source: reportedSource,
            disposition: "Matches saved value (not staged)"
          };
          details.push(
            `[${destKey}] Matches current saved reference list (${preservedDirectRaw}) — Source: ${reportedSource}; not staged.`
          );
          continue;
        }

        if (
          !directProposalReplacementIntent &&
          storedCheckForDirect.valid &&
          proposedCheckForDirect.valid &&
          proposedCheckForDirect.gids.length > 0
        ) {
          const proposedSetForDirect = new Set(proposedCheckForDirect.gids);
          directProposalReplacementIntent = storedCheckForDirect.gids.some(
            (g) => !proposedSetForDirect.has(g)
          );
        }
      }

      const validation = validateBatch1ProposedValue({
        productId: scannedProductId,
        destinationKey: destKey,
        proposedValue: rawValue,
        baselineSnapshot: targetBaseline,
        allowExplicitReferenceListReplacement: directProposalReplacementIntent
      });

      if (!validation.valid) {
        rejectedInvalidCount++;
        proposalsByDestination[destKey] = {
          value: rawValue,
          source: reportedSource,
          disposition: "Rejected (invalid)",
          reason: validation.reason
        };
        diagnosticsObj[destKey] = validation.reason;
        details.push(
          `[${destKey}] Rejected invalid AI suggestion "${rawValue}" (Source: ${reportedSource}): ${validation.reason}`
        );
        continue;
      }

      if (validation.isUnchangedFromStored) {
        unchangedSkippedCount++;
        proposalsByDestination[destKey] = {
          value: validation.normalizedValue,
          source: reportedSource,
          disposition: "Matches saved value (not staged)"
        };
        details.push(
          `[${destKey}] Matches current saved value ("${validation.normalizedValue}") — Source: ${reportedSource}; not staged.`
        );
        continue;
      }

      stageOrHoldResolvedProposal({
        destKey,
        normalizedValue: validation.normalizedValue,
        reportedSource,
        allowExplicitReferenceListReplacement: Boolean(
          directProposalReplacementIntent &&
            validation.allowExplicitReferenceListReplacement === true
        )
      });
    }

    proposedByProductRef.current = {
      ...proposedByProductRef.current,
      [scannedProductId]: existingProdProposals
    };
    setProposedByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdProposals
    }));

    approvalsByProductRef.current = {
      ...approvalsByProductRef.current,
      [scannedProductId]: existingProdApprovals
    };
    setApprovalsByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdApprovals
    }));

    setAiAlternativesByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        ...(prev[scannedProductId] || {}),
        ...nextAiAlternativesForProd
      }
    }));

    setPendingGeologyRefCandidatesByProduct((prev) => {
      const next = { ...prev };
      if (Object.keys(nextPendingGeologyRefForProd).length > 0) {
        next[scannedProductId] = {
          requestId: pendingScan.requestId,
          sessionId: benchSessionIdRef.current,
          productId: scannedProductId,
          baselineContextSig: targetBaselineContextSig,
          candidatesByDest: nextPendingGeologyRefForProd
        };
      } else {
        delete next[scannedProductId];
      }
      return next;
    });

    const manualIgnoredNote =
      ignoredManualOnlyCount > 0
        ? `, ${ignoredManualOnlyCount} manual-only suggestion${
            ignoredManualOnlyCount === 1 ? "" : "s"
          } ignored`
        : "";

    setLastAiScanReportByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        requestId: pendingScan.requestId,
        productId: scannedProductId,
        completedAt: new Date().toISOString(),
        ok: true,
        summary: `AI Scan complete: ${receivedCount} eligible suggestion${
          receivedCount === 1 ? "" : "s"
        } received (${stagedCount} staged as unapproved drafts, ${heldConflictCount} held as alternatives alongside your existing edits, ${unchangedSkippedCount} matched saved baseline${manualIgnoredNote}).`,
        receivedCount,
        stagedCount,
        heldConflictCount,
        unchangedSkippedCount,
        rejectedInvalidCount,
        ignoredManualOnlyCount,
        diagnostics: diagnosticsObj,
        details,
        proposalsByDestination
      }
    }));

    setActiveAiScanRequest(null);
  }, [
    aiScanFetcher.state,
    aiScanFetcher.data,
    activeProductId,
    baselineByProductRef,
    currentBaselineRef,
    isCurrentRefChoicesBoundAndFreshRef,
    currentRefChoicesRecordRef,
    proposedByProductRef,
    approvalsByProductRef,
    keepOriginalByProductRef,
    benchSessionIdRef,
    setProposedByProduct,
    setApprovalsByProduct
  ]);

  const handleAcceptAiAlternative = (destinationKey) => {
    setClientPrevalidationBanner(null);
    const altEntry = currentAiAlternativesMap[destinationKey];
    if (!altEntry || typeof altEntry.value !== "string") return;

    const contract = getFieldContractByDestination(destinationKey);
    if (isManualOnlyNoAiDestination(destinationKey, contract)) {
      return;
    }

    const exactVal = altEntry.value;
    let shouldBindReplacementIntent = Boolean(
      contract?.namespace === "shopify" &&
        contract?.expectedType === "list.metaobject_reference" &&
        contract?.isWritableInBatch1 === true &&
        altEntry.allowExplicitReferenceListReplacement === true &&
        typeof altEntry.explicitReplacementValue === "string" &&
        altEntry.explicitReplacementValue === exactVal
    );

    if (
      !shouldBindReplacementIntent &&
      contract?.namespace === "shopify" &&
      contract?.expectedType === "list.metaobject_reference" &&
      contract?.isWritableInBatch1 === true &&
      currentBaselineRef.current
    ) {
      const obs = buildBaselineObservation(currentBaselineRef.current, destinationKey);
      const storedCheck = inspectStoredReferenceListRawValue(obs.rawValue);
      const proposedCheck = inspectStoredReferenceListRawValue(exactVal);
      if (storedCheck.valid && proposedCheck.valid && proposedCheck.gids.length > 0) {
        const proposedSet = new Set(proposedCheck.gids);
        shouldBindReplacementIntent = storedCheck.gids.some((g) => !proposedSet.has(g));
      }
    }

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactVal,
        source:
          typeof altEntry.source === "string" && altEntry.source.trim() !== ""
            ? altEntry.source.trim()
            : "Source not reported",
        origin: "AI",
        ...(shouldBindReplacementIntent
          ? {
              allowExplicitReferenceListReplacement: true,
              explicitReplacementValue: exactVal
            }
          : {}),
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setAiAlternativesByProduct, activeProductId, destinationKey);
  };

  const handleDismissAiAlternative = (destinationKey) => {
    clearDecisionForDestination(setAiAlternativesByProduct, activeProductId, destinationKey);
  };

  const handleDismissAiScanReport = useCallback(() => {
    setLastAiScanReportByProduct((prev) => {
      const next = { ...prev };
      delete next[activeProductId];
      return next;
    });
  }, [activeProductId]);

  const deferredResolverContext = useMemo(
    () => ({
      pendingGeologyRefCandidatesByProduct,
      setPendingGeologyRefCandidatesByProduct,
      setAiAlternativesByProduct,
      setLastAiScanReportByProduct,
      setApprovalsByProduct
    }),
    [pendingGeologyRefCandidatesByProduct, setApprovalsByProduct]
  );

  return {
    isAiScanBusy,
    currentAiAlternativesMap,
    currentAiScanReport,
    currentScanProposalsMetaMap,
    stagedVisionCandidatesByProduct,
    stagedVisionCandidatesByProductRef,
    handleExplicitAiScanProduct,
    handleAcceptAiAlternative,
    handleDismissAiAlternative,
    handleDismissAiScanReport,
    deferredResolverContext
  };
}

// ==========================================================================
// DEFERRED GEOLOGY & VISION REFERENCE CANDIDATE RESOLUTION (WHEN REF CHOICES
// ARRIVE AFTER AI SCAN) — ONCE PER SCAN REQUEST, NO RESCAN, NO LOOPS, NO AUTO-APPROVE
// ==========================================================================
export function useBenchV2DeferredAiReferenceResolver({
  activeProductId,
  benchSessionIdRef,
  baselineByProductRef,
  proposedByProductRef,
  setProposedByProduct,
  approvalsByProductRef,
  keepOriginalByProductRef,
  isCurrentRefChoicesBoundAndFresh,
  currentRefChoicesRecord,
  currentBaseline,
  deferredResolverContext
}) {
  const pendingGeologyRefCandidatesByProduct =
    deferredResolverContext?.pendingGeologyRefCandidatesByProduct;
  const setPendingGeologyRefCandidatesByProduct =
    deferredResolverContext?.setPendingGeologyRefCandidatesByProduct;
  const setAiAlternativesByProduct =
    deferredResolverContext?.setAiAlternativesByProduct;
  const setLastAiScanReportByProduct =
    deferredResolverContext?.setLastAiScanReportByProduct;
  const setApprovalsByProduct =
    deferredResolverContext?.setApprovalsByProduct;

  useEffect(() => {
    if (
      !pendingGeologyRefCandidatesByProduct ||
      typeof setPendingGeologyRefCandidatesByProduct !== "function" ||
      typeof setAiAlternativesByProduct !== "function" ||
      typeof setLastAiScanReportByProduct !== "function"
    ) {
      return;
    }

    const pendingBundle = pendingGeologyRefCandidatesByProduct[activeProductId];
    if (!pendingBundle || typeof pendingBundle !== "object") return;

    const rawSnapForActive = baselineByProductRef.current[activeProductId] || null;
    const currentContextSig = buildStandardizedBaselineContextSignature(rawSnapForActive);

    // Discard stale pending candidates if session, product, or factual baseline changed
    if (
      pendingBundle.sessionId !== benchSessionIdRef.current ||
      pendingBundle.productId !== activeProductId ||
      !rawSnapForActive ||
      pendingBundle.baselineContextSig !== currentContextSig
    ) {
      setPendingGeologyRefCandidatesByProduct((prev) => {
        if (!prev[activeProductId]) return prev;
        const next = { ...prev };
        delete next[activeProductId];
        return next;
      });
      return;
    }

    // Wait until reference choices are bound and fresh for the current factual baseline
    if (
      !isCurrentRefChoicesBoundAndFresh ||
      !currentRefChoicesRecord ||
      currentRefChoicesRecord.productId !== activeProductId ||
      !currentBaseline ||
      currentBaseline.productId !== activeProductId
    ) {
      return;
    }

    const candidatesMap = pendingBundle.candidatesByDest || {};
    const destEntries = Object.entries(candidatesMap);

    // Consume pending bundle synchronously first so it never re-runs in a loop
    setPendingGeologyRefCandidatesByProduct((prev) => {
      if (!prev[activeProductId]) return prev;
      const next = { ...prev };
      delete next[activeProductId];
      return next;
    });

    if (destEntries.length === 0) return;

    const existingProdProposals = { ...(proposedByProductRef.current[activeProductId] || {}) };
    const existingProdApprovals = { ...(approvalsByProductRef.current[activeProductId] || {}) };
    const existingProdKeepOriginal = keepOriginalByProductRef.current[activeProductId] || {};
    const nextAiAlternativesForProd = {};

    let addedStaged = 0;
    let addedHeld = 0;
    let addedUnchanged = 0;
    let addedRejected = 0;
    let approvalsCleared = false;
    const updatedProposalsMeta = {};
    const updatedDiagnostics = {};
    const appendedDetails = [];

    for (const [destKey, candItem] of destEntries) {
      if (
        !candItem ||
        isRetiredParkedBenchDestination(destKey, "PRODUCT") ||
        !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
      ) {
        continue;
      }

      const reportedSource =
        candItem.source ||
        (PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(destKey)
          ? "Geo Library"
          : "Gemini Vision");
      const displayCandidateLabel =
        candItem.displayLabel ||
        (Array.isArray(candItem.candidateLabels) ? candItem.candidateLabels.join(", ") : "");

      const resolution = resolveProducerBackedGeologyReferenceCandidate({
        productId: activeProductId,
        destKey,
        candidateLabels: candItem.candidateLabels,
        targetBaseline: currentBaseline,
        refChoicesRecord: currentRefChoicesRecord,
        isRefChoicesFreshForBaseline: true
      });

      if (resolution.status === "unchanged_from_baseline") {
        addedUnchanged++;
        updatedProposalsMeta[destKey] = {
          value: resolution.serializedValue,
          source: reportedSource,
          disposition: "Matches saved value (not staged)"
        };
        updatedDiagnostics[destKey] = null;
        appendedDetails.push(
          `[${destKey}] Candidate "${displayCandidateLabel}" matches current saved reference list (${resolution.serializedValue}) — Source: ${reportedSource}; not staged.`
        );
        continue;
      }

      if (resolution.status === "resolved_valid_change") {
        const normalizedValue = resolution.serializedValue;
        const shouldBindReplacementIntent = Boolean(
          resolution.allowExplicitReferenceListReplacement === true &&
            typeof normalizedValue === "string" &&
            normalizedValue.trim() !== ""
        );
        const displayNote = `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`;
        updatedDiagnostics[destKey] = null;

        const existingDraft = existingProdProposals[destKey];
        const existingDraftVal = getProposalValueString(existingDraft);
        const hasExistingDraft = Boolean(existingDraft && existingDraftVal.trim() !== "");
        const isManualDraft = Boolean(
          hasExistingDraft &&
            (typeof existingDraft !== "object" || existingDraft.origin !== "AI")
        );
        const existingAllowReplacement = hasExplicitReferenceReplacementFlag(
          existingDraft,
          destKey,
          existingDraftVal
        );

        const approvalRec = existingProdApprovals[destKey] || null;
        const hasValidApproval =
          hasExistingDraft &&
          isExactValueApprovalValid({
            approvalRecord: approvalRec,
            productId: activeProductId,
            destinationKey: destKey,
            currentProposedValue: existingDraftVal,
            baselineSnapshot: currentBaseline,
            allowExplicitReferenceListReplacement: existingAllowReplacement
          });

        const keepOrigRec = existingProdKeepOriginal[destKey] || null;
        const hasValidKeepOriginal =
          hasExistingDraft &&
          isKeepOriginalRecordValid({
            keepOriginalRecord: keepOrigRec,
            productId: activeProductId,
            destinationKey: destKey,
            currentProposedValue: existingDraftVal,
            baselineSnapshot: currentBaseline
          });

        const hasProtectedHumanState =
          isManualDraft || hasValidApproval || hasValidKeepOriginal;

        if (hasProtectedHumanState) {
          if (
            existingDraftVal === normalizedValue &&
            existingAllowReplacement === shouldBindReplacementIntent &&
            !hasValidKeepOriginal
          ) {
            updatedProposalsMeta[destKey] = {
              value: normalizedValue,
              source: reportedSource,
              disposition: "Matches current draft"
            };
            appendedDetails.push(
              `[${destKey}] AI suggestion matches your current draft ("${normalizedValue}" [${displayNote}]) — Source: ${reportedSource}.`
            );
          } else {
            addedHeld++;
            nextAiAlternativesForProd[destKey] = {
              value: normalizedValue,
              source: reportedSource,
              ...(shouldBindReplacementIntent
                ? {
                    allowExplicitReferenceListReplacement: true,
                    explicitReplacementValue: normalizedValue
                  }
                : {}),
              requestId: pendingBundle.requestId,
              receivedAt: new Date().toISOString()
            };
            updatedProposalsMeta[destKey] = {
              value: normalizedValue,
              source: reportedSource,
              disposition: "Held as separate AI alternative"
            };
            appendedDetails.push(
              `[${destKey}] Held AI alternative "${normalizedValue}" [${displayNote}] (Source: ${reportedSource}) without overwriting your current draft or decision.`
            );
          }
        } else {
          if (existingProdApprovals[destKey]) {
            delete existingProdApprovals[destKey];
            approvalsCleared = true;
          }
          existingProdProposals[destKey] = {
            value: normalizedValue,
            source: reportedSource,
            origin: "AI",
            ...(shouldBindReplacementIntent
              ? {
                  allowExplicitReferenceListReplacement: true,
                  explicitReplacementValue: normalizedValue
                }
              : {}),
            updatedAt: new Date().toISOString()
          };
          addedStaged++;
          updatedProposalsMeta[destKey] = {
            value: normalizedValue,
            source: reportedSource,
            disposition: "Staged as unapproved AI draft"
          };
          appendedDetails.push(
            `[${destKey}] Staged unapproved AI draft "${normalizedValue}" [${displayNote}] (Source: ${reportedSource}).`
          );
        }
        continue;
      }

      addedRejected++;
      const holdDisposition =
        resolution.status === "held_unmatched_or_ambiguous"
          ? "Held (no unique/equivalent verified reference entry match)"
          : "Held (category-ineligible or incomplete reference evidence)";
      updatedProposalsMeta[destKey] = {
        value: displayCandidateLabel,
        source: reportedSource,
        disposition: holdDisposition,
        reason: resolution.reason
      };
      updatedDiagnostics[destKey] = resolution.reason;
      appendedDetails.push(
        `[${destKey}] Held standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${resolution.reason}`
      );
    }

    if (addedStaged > 0) {
      proposedByProductRef.current = {
        ...proposedByProductRef.current,
        [activeProductId]: existingProdProposals
      };
      setProposedByProduct((prev) => ({
        ...prev,
        [activeProductId]: existingProdProposals
      }));
    }

    if (approvalsCleared && typeof setApprovalsByProduct === "function") {
      approvalsByProductRef.current = {
        ...approvalsByProductRef.current,
        [activeProductId]: existingProdApprovals
      };
      setApprovalsByProduct((prev) => ({
        ...prev,
        [activeProductId]: existingProdApprovals
      }));
    }

    if (Object.keys(nextAiAlternativesForProd).length > 0) {
      setAiAlternativesByProduct((prev) => ({
        ...prev,
        [activeProductId]: {
          ...(prev[activeProductId] || {}),
          ...nextAiAlternativesForProd
        }
      }));
    }

    setLastAiScanReportByProduct((prev) => {
      const existingReport = prev[activeProductId];
      if (!existingReport || existingReport.requestId !== pendingBundle.requestId) {
        return prev;
      }
      const nextDiagnostics = { ...(existingReport.diagnostics || {}) };
      for (const [dKey, dReason] of Object.entries(updatedDiagnostics)) {
        if (dReason === null) {
          delete nextDiagnostics[dKey];
        } else if (typeof dReason === "string" && dReason.trim() !== "") {
          nextDiagnostics[dKey] = dReason;
        }
      }

      const nextStagedCount = (existingReport.stagedCount || 0) + addedStaged;
      const nextHeldCount = (existingReport.heldConflictCount || 0) + addedHeld;
      const nextUnchangedCount =
        (existingReport.unchangedSkippedCount || 0) + addedUnchanged;
      const nextRejectedCount =
        (existingReport.rejectedInvalidCount || 0) + addedRejected;
      const recCount = existingReport.receivedCount || 0;
      const ignCount = existingReport.ignoredManualOnlyCount || 0;
      const manualIgnoredNote =
        ignCount > 0
          ? `, ${ignCount} manual-only suggestion${ignCount === 1 ? "" : "s"} ignored`
          : "";

      return {
        ...prev,
        [activeProductId]: {
          ...existingReport,
          stagedCount: nextStagedCount,
          heldConflictCount: nextHeldCount,
          unchangedSkippedCount: nextUnchangedCount,
          rejectedInvalidCount: nextRejectedCount,
          summary: `AI Scan complete: ${recCount} eligible suggestion${
            recCount === 1 ? "" : "s"
          } received (${nextStagedCount} staged as unapproved drafts, ${nextHeldCount} held as alternatives alongside your existing edits, ${nextUnchangedCount} matched saved baseline${manualIgnoredNote}).`,
          diagnostics: nextDiagnostics,
          details: [...(existingReport.details || []), ...appendedDetails],
          proposalsByDestination: {
            ...(existingReport.proposalsByDestination || {}),
            ...updatedProposalsMeta
          }
        }
      };
    });
  }, [
    pendingGeologyRefCandidatesByProduct,
    setPendingGeologyRefCandidatesByProduct,
    setAiAlternativesByProduct,
    setLastAiScanReportByProduct,
    setApprovalsByProduct,
    activeProductId,
    benchSessionIdRef,
    baselineByProductRef,
    proposedByProductRef,
    setProposedByProduct,
    approvalsByProductRef,
    keepOriginalByProductRef,
    isCurrentRefChoicesBoundAndFresh,
    currentRefChoicesRecord,
    currentBaseline
  ]);
}
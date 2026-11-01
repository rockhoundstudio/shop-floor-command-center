// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 STANDARDIZED REFERENCE LOADER (CLIENT MODULE)
// File: app/utils/bench-v2.reference-loader.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (Step 1 of bounded extraction).
// Contains factual baseline context signature & attempt-key helpers plus the
// client-safe useBenchV2StandardizedReferenceLoader hook for automatic
// once-per-factual-context and explicit retry read-only standardized
// reference choice loading, freshness/identity verification, and per-destination
// evidence merging.
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFetcher } from "react-router";
import {
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  isExactProductGid,
  isExactMetaobjectDefinitionGid
} from "./bench-v2.contract.jsx";
import {
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS,
  isExactMetaobjectGid,
  extractEntryGid,
  extractEntryLabel,
  extractEntryDefinitionId
} from "./meta-injector.standardized.jsx";

export function buildStandardizedBaselineContextSignature(baselineSnap) {
  if (!baselineSnap || typeof baselineSnap !== "object") return "no_baseline";
  const productId =
    typeof baselineSnap.productId === "string" && baselineSnap.productId.trim() !== ""
      ? baselineSnap.productId.trim()
      : "no_product";
  const hasCatObj =
    baselineSnap.productCategory && typeof baselineSnap.productCategory === "object";
  const catState =
    baselineSnap.productCategory === undefined
      ? "cat_missing"
      : baselineSnap.productCategory === null
        ? "cat_null"
        : "cat_object";
  const catId =
    hasCatObj && typeof baselineSnap.productCategory.id === "string"
      ? baselineSnap.productCategory.id
      : "";
  const catFullName =
    hasCatObj && typeof baselineSnap.productCategory.fullName === "string"
      ? baselineSnap.productCategory.fullName
      : "";
  const mfComplete =
    baselineSnap.metafieldsReadComplete === true
      ? "complete"
      : baselineSnap.metafieldsReadComplete === false
        ? "incomplete"
        : "unknown";
  const defsComplete =
    baselineSnap.defsReadComplete === true
      ? "complete"
      : baselineSnap.defsReadComplete === false
        ? "incomplete"
        : "unknown";
  const catComplete =
    baselineSnap.productCategoryReadComplete === true
      ? "complete"
      : baselineSnap.productCategoryReadComplete === false
        ? "incomplete"
        : "unknown";
  const mfReadErr =
    typeof baselineSnap.metafieldsReadError === "string"
      ? baselineSnap.metafieldsReadError
      : "";
  const defReadErrs = Array.isArray(baselineSnap.defReadErrors)
    ? baselineSnap.defReadErrors.map((e) => String(e ?? "")).join(";")
    : "no_def_err_array";
  const topErrs = Array.isArray(baselineSnap.errors)
    ? baselineSnap.errors.map((e) => String(e ?? "")).join(";")
    : "no_top_err_array";

  const hasLiveDefsMap = Boolean(
    baselineSnap.liveDefinitions &&
      typeof baselineSnap.liveDefinitions === "object" &&
      !Array.isArray(baselineSnap.liveDefinitions)
  );
  const hasEligMap = Boolean(
    baselineSnap.categoryEligibilityByDestination &&
      typeof baselineSnap.categoryEligibilityByDestination === "object" &&
      !Array.isArray(baselineSnap.categoryEligibilityByDestination)
  );
  const hasConstraintErrMap = Boolean(
    baselineSnap.constraintErrorsByDestination &&
      typeof baselineSnap.constraintErrorsByDestination === "object" &&
      !Array.isArray(baselineSnap.constraintErrorsByDestination)
  );
  const hasMfMap = Boolean(
    baselineSnap.currentMetafields &&
      typeof baselineSnap.currentMetafields === "object" &&
      !Array.isArray(baselineSnap.currentMetafields)
  );
  const hasMfTypesMap = Boolean(
    baselineSnap.currentMetafieldTypes &&
      typeof baselineSnap.currentMetafieldTypes === "object" &&
      !Array.isArray(baselineSnap.currentMetafieldTypes)
  );

  const perDestParts = SUPPORTED_STANDARDIZED_REFERENCE_KEYS.map((k) => {
    const dest = `shopify.${k}`;
    const hasDef =
      hasLiveDefsMap &&
      Object.prototype.hasOwnProperty.call(baselineSnap.liveDefinitions, dest) &&
      baselineSnap.liveDefinitions[dest] !== undefined &&
      baselineSnap.liveDefinitions[dest] !== null;
    const def = hasDef ? baselineSnap.liveDefinitions[dest] : null;
    const defConstraints =
      def && def.constraints && typeof def.constraints === "object"
        ? def.constraints
        : null;
    const constraintVals = Array.isArray(defConstraints?.values)
      ? defConstraints.values.map((v) => String(v ?? "")).join(",")
      : "no_vals";

    const hasElig =
      hasEligMap &&
      Object.prototype.hasOwnProperty.call(
        baselineSnap.categoryEligibilityByDestination,
        dest
      ) &&
      baselineSnap.categoryEligibilityByDestination[dest] !== undefined &&
      baselineSnap.categoryEligibilityByDestination[dest] !== null;
    const elig = hasElig ? baselineSnap.categoryEligibilityByDestination[dest] : null;

    const constraintErr =
      hasConstraintErrMap &&
      Object.prototype.hasOwnProperty.call(
        baselineSnap.constraintErrorsByDestination,
        dest
      )
        ? String(baselineSnap.constraintErrorsByDestination[dest] ?? "")
        : "";

    const hasStoredMf =
      hasMfMap &&
      Object.prototype.hasOwnProperty.call(baselineSnap.currentMetafields, dest) &&
      baselineSnap.currentMetafields[dest] !== undefined;
    const rawStored = hasStoredMf ? baselineSnap.currentMetafields[dest] : undefined;
    const storedPresence = !hasMfMap
      ? "mf_map_missing"
      : !hasStoredMf
        ? "absent"
        : rawStored === null
          ? "null"
          : "present";
    const storedValStr =
      rawStored === undefined || rawStored === null ? "" : String(rawStored);
    const storedType =
      hasMfTypesMap &&
      Object.prototype.hasOwnProperty.call(baselineSnap.currentMetafieldTypes, dest) &&
      baselineSnap.currentMetafieldTypes[dest] !== undefined &&
      baselineSnap.currentMetafieldTypes[dest] !== null
        ? String(baselineSnap.currentMetafieldTypes[dest])
        : "";

    return JSON.stringify([
      dest,
      hasLiveDefsMap ? (hasDef ? "def_present" : "def_absent") : "defs_map_missing",
      def?.id || "",
      def?.type || "",
      def?.restrictedMetaobjectDefinitionId || def?.requiredDefinitionId || "",
      defConstraints
        ? `${String(defConstraints.hasConstraints)}:${defConstraints.key || ""}:${String(defConstraints.isComplete)}:${defConstraints.error || ""}:${constraintVals}`
        : "no_constraints_obj",
      hasEligMap ? (hasElig ? "elig_present" : "elig_absent") : "elig_map_missing",
      elig
        ? `${String(elig.isComplete)}:${String(elig.isEligible)}:${elig.status || ""}:${elig.matchedConstraintValue || ""}:${elig.reason || ""}`
        : "no_elig_obj",
      constraintErr,
      storedPresence,
      storedType,
      storedValStr
    ]);
  }).join("|");

  return `${productId}::${catState}:${catId}:${catFullName}::${mfComplete}::${defsComplete}::${catComplete}::${mfReadErr}::${defReadErrs}::${topErrs}::${perDestParts}`;
}

export function buildAutoRefChoicesAttemptKey(
  benchSessionId,
  productId,
  baselineContextSig
) {
  return `${String(benchSessionId || "")}::${String(productId || "")}::${String(baselineContextSig || "")}`;
}

export function useBenchV2StandardizedReferenceLoader({
  benchSessionId,
  activeProductId,
  activeProductTitle,
  isSwitchingSelectedProduct,
  rawCurrentBaseline,
  baselineByProductRef,
  stagedVisionCandidatesByProductRef,
  isWriterBusy,
  isAiScanBusy,
  isBaselineReloading,
  setClientPrevalidationBanner
}) {
  const refChoicesFetcher = useFetcher();

  const [activeRefChoicesRequest, setActiveRefChoicesRequest] = useState(null);
  const [refChoicesStateByProduct, setRefChoicesStateByProduct] = useState({});
  const processedRefChoicesRequestIdRef = useRef(null);
  const activeRefChoicesRequestRef = useRef(null);
  const autoRefChoicesAttemptedKeysRef = useRef(new Set());
  const refChoicesFetcherRef = useRef(refChoicesFetcher);
  refChoicesFetcherRef.current = refChoicesFetcher;

  const benchSessionIdRef = useRef(benchSessionId);
  benchSessionIdRef.current = benchSessionId;

  useEffect(() => {
    activeRefChoicesRequestRef.current = activeRefChoicesRequest;
  }, [activeRefChoicesRequest]);

  const currentRefChoicesRecord = refChoicesStateByProduct[activeProductId] || null;
  const currentBaselineContextSig = React.useMemo(
    () => buildStandardizedBaselineContextSignature(rawCurrentBaseline),
    [rawCurrentBaseline]
  );

  const isCurrentBaselineReadyForStandardizedLookup = Boolean(
    !isSwitchingSelectedProduct &&
      isExactProductGid(activeProductId) &&
      rawCurrentBaseline &&
      rawCurrentBaseline.productId === activeProductId &&
      rawCurrentBaseline.metafieldsReadComplete === true &&
      rawCurrentBaseline.defsReadComplete === true &&
      rawCurrentBaseline.productCategoryReadComplete === true
  );

  // Merge verified reference evidence into currentBaseline ONLY when bound to the
  // current bench session, current productId, current category, and current baseline context.
  const isCurrentRefChoicesBoundAndFresh = Boolean(
    rawCurrentBaseline &&
      currentRefChoicesRecord &&
      currentRefChoicesRecord.benchSessionId === benchSessionIdRef.current &&
      currentRefChoicesRecord.productId === activeProductId &&
      currentRefChoicesRecord.baselineContextSig === currentBaselineContextSig &&
      (currentRefChoicesRecord.productCategoryId || null) ===
        (rawCurrentBaseline.productCategory?.id || null)
  );

  const currentBaseline = React.useMemo(() => {
    if (!rawCurrentBaseline) return null;
    if (!isCurrentRefChoicesBoundAndFresh || !currentRefChoicesRecord) {
      return rawCurrentBaseline;
    }
    return {
      ...rawCurrentBaseline,
      verifiedReferenceEntriesByDestination:
        currentRefChoicesRecord.verifiedReferenceEntriesByDestination || {},
      standardizedReferenceResolutions:
        currentRefChoicesRecord.rawResponse || null
    };
  }, [rawCurrentBaseline, isCurrentRefChoicesBoundAndFresh, currentRefChoicesRecord]);

  const isRefChoicesBusy =
    refChoicesFetcher.state !== "idle" || Boolean(activeRefChoicesRequest);
  const isAnyOperationBusy =
    isWriterBusy || isAiScanBusy || isRefChoicesBusy || isBaselineReloading;

  // ==========================================================================
  // AUTOMATIC + EXPLICIT RETRY READ-ONLY STANDARDIZED REFERENCE CHOICES LOADER
  // ==========================================================================
  const submitStandardizedReferenceChoicesRequest = useCallback(
    ({ targetProductId, targetBaselineSnap, targetContextSig }) => {
      if (
        !targetBaselineSnap ||
        targetBaselineSnap.productId !== targetProductId ||
        targetBaselineSnap.metafieldsReadComplete !== true ||
        targetBaselineSnap.defsReadComplete !== true ||
        targetBaselineSnap.productCategoryReadComplete !== true
      ) {
        return false;
      }

      const attemptKey = buildAutoRefChoicesAttemptKey(
        benchSessionIdRef.current,
        targetProductId,
        targetContextSig
      );
      autoRefChoicesAttemptedKeysRef.current.add(attemptKey);

      const requestId = `bench_v2_refchoices_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const enumerateList = SUPPORTED_STANDARDIZED_REFERENCE_KEYS.map((k) => `shopify.${k}`);
      const stagedCandidatesForProduct =
        stagedVisionCandidatesByProductRef.current?.[targetProductId] || {};

      const reqMeta = {
        requestId,
        benchSessionId: benchSessionIdRef.current,
        productId: targetProductId,
        baselineContextSig: targetContextSig,
        productCategoryId: targetBaselineSnap.productCategory?.id || null,
        startedAt: new Date().toISOString()
      };

      activeRefChoicesRequestRef.current = reqMeta;
      setActiveRefChoicesRequest(reqMeta);

      const formData = new FormData();
      formData.append("intent", "resolveStandardizedCandidates");
      formData.append("pieceId", targetProductId);
      formData.append("requestId", requestId);
      formData.append("enumerate_destinations", JSON.stringify(enumerateList));
      formData.append("standardized_candidates", JSON.stringify(stagedCandidatesForProduct));

      refChoicesFetcherRef.current.submit(formData, {
        method: "POST",
        action: "/app/meta-injector-api"
      });
      return true;
    },
    [stagedVisionCandidatesByProductRef]
  );

  // Automatic read-only reference-choice loading:
  // Fires at most once per (benchSessionId, activeProductId, factual baselineContextSig)
  // when the selected product baseline is genuinely ready. Records the attempt key
  // synchronously before submitting so Strict Mode or revalidation cannot loop.
  useEffect(() => {
    if (!isCurrentBaselineReadyForStandardizedLookup || !rawCurrentBaseline) {
      return;
    }
    if (isCurrentRefChoicesBoundAndFresh) {
      return;
    }
    if (
      activeRefChoicesRequestRef.current ||
      refChoicesFetcherRef.current.state !== "idle" ||
      isWriterBusy ||
      isAiScanBusy
    ) {
      return;
    }

    const attemptKey = buildAutoRefChoicesAttemptKey(
      benchSessionIdRef.current,
      activeProductId,
      currentBaselineContextSig
    );
    if (autoRefChoicesAttemptedKeysRef.current.has(attemptKey)) {
      return;
    }

    submitStandardizedReferenceChoicesRequest({
      targetProductId: activeProductId,
      targetBaselineSnap: rawCurrentBaseline,
      targetContextSig: currentBaselineContextSig
    });
  }, [
    isCurrentBaselineReadyForStandardizedLookup,
    isCurrentRefChoicesBoundAndFresh,
    activeProductId,
    currentBaselineContextSig,
    rawCurrentBaseline,
    isWriterBusy,
    isAiScanBusy,
    isRefChoicesBusy,
    submitStandardizedReferenceChoicesRequest
  ]);

  const handleLoadStandardizedReferenceChoices = () => {
    setClientPrevalidationBanner(null);

    if (isAnyOperationBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Operation already in progress",
        reasons: [
          "Wait for the current operation to complete before retrying standardized reference choices."
        ]
      });
      return;
    }

    if (!rawCurrentBaseline || rawCurrentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot load reference choices: Product baseline not loaded",
        reasons: [`Reload ${activeProductTitle} so its baseline and definitions are available.`]
      });
      return;
    }

    if (
      rawCurrentBaseline.metafieldsReadComplete !== true ||
      rawCurrentBaseline.defsReadComplete !== true ||
      rawCurrentBaseline.productCategoryReadComplete !== true
    ) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot load reference choices: Baseline read incomplete",
        reasons: [
          "Product metafields, product category, or live PRODUCT definitions did not finish loading. Click Reload Product first."
        ]
      });
      return;
    }

    submitStandardizedReferenceChoicesRequest({
      targetProductId: activeProductId,
      targetBaselineSnap: rawCurrentBaseline,
      targetContextSig: currentBaselineContextSig
    });
  };

  useEffect(() => {
    if (refChoicesFetcher.state !== "idle") return;
    const pendingReq = activeRefChoicesRequestRef.current;
    if (!pendingReq) return;

    if (processedRefChoicesRequestIdRef.current === pendingReq.requestId) {
      return;
    }
    processedRefChoicesRequestIdRef.current = pendingReq.requestId;

    const reqProductId = pendingReq.productId;
    const rawResponse = refChoicesFetcher.data;
    const latestBaselineForProduct = baselineByProductRef.current?.[reqProductId] || null;
    const latestContextSig = buildStandardizedBaselineContextSignature(latestBaselineForProduct);

    const recordFailedOrStaleRefChoices = (stateTag, summary, errorsList = []) => {
      setRefChoicesStateByProduct((prev) => ({
        ...prev,
        [reqProductId]: {
          requestId: pendingReq.requestId,
          benchSessionId: pendingReq.benchSessionId,
          productId: reqProductId,
          baselineContextSig: pendingReq.baselineContextSig,
          productCategoryId: pendingReq.productCategoryId,
          completedAt: new Date().toISOString(),
          ok: false,
          state: stateTag,
          summary,
          errors: errorsList,
          verifiedReferenceEntriesByDestination: {},
          rawResponse: null
        }
      }));
      activeRefChoicesRequestRef.current = null;
      setActiveRefChoicesRequest(null);
    };

    if (!rawResponse || typeof rawResponse !== "object") {
      recordFailedOrStaleRefChoices(
        "failed_or_incomplete",
        "Reference choices load failed: no structured response returned by /app/meta-injector-api.",
        ["No structured response returned by /app/meta-injector-api."]
      );
      return;
    }

    if (
      rawResponse.intent !== "resolveStandardizedCandidates" ||
      rawResponse.readOnly !== true ||
      rawResponse.requestId !== pendingReq.requestId ||
      rawResponse.pieceId !== reqProductId ||
      pendingReq.benchSessionId !== benchSessionIdRef.current
    ) {
      recordFailedOrStaleRefChoices(
        "discarded_stale",
        `Ignored mismatched or stale reference choices response (expected product ${reqProductId} / request ${pendingReq.requestId}, got product ${String(
          rawResponse.pieceId
        )} / request ${String(rawResponse.requestId)}).`,
        ["Mismatched requestId, pieceId, or session."]
      );
      return;
    }

    const responseCategoryId = rawResponse.productCategory?.id || null;
    if (
      !latestBaselineForProduct ||
      latestContextSig !== pendingReq.baselineContextSig ||
      (latestBaselineForProduct.productCategory?.id || null) !== responseCategoryId
    ) {
      recordFailedOrStaleRefChoices(
        "discarded_stale",
        "Discarded stale reference choices response because the product baseline or category changed while the request was in flight.",
        ["Baseline or product category changed during reference enumeration."]
      );
      return;
    }

    const topErrors = Array.isArray(rawResponse.errors)
      ? rawResponse.errors.filter((e) => typeof e === "string" && e.trim() !== "")
      : [];
    if (
      typeof rawResponse.error === "string" &&
      rawResponse.error.trim() !== "" &&
      !topErrors.includes(rawResponse.error.trim())
    ) {
      topErrors.unshift(rawResponse.error.trim());
    }

    const hasResolutionsMap = Boolean(
      rawResponse.resolutions &&
        typeof rawResponse.resolutions === "object" &&
        !Array.isArray(rawResponse.resolutions)
    );
    const hasCurrentRefListsMap = Boolean(
      rawResponse.currentReferenceLists &&
        typeof rawResponse.currentReferenceLists === "object" &&
        !Array.isArray(rawResponse.currentReferenceLists)
    );
    const hasCategoryEligibilityMap = Boolean(
      rawResponse.categoryEligibility &&
        typeof rawResponse.categoryEligibility === "object" &&
        !Array.isArray(rawResponse.categoryEligibility)
    );

    const unscopedTopErrors = topErrors.filter((errText) => {
      const bracketMatch = /^\[([^\]]+)\]\s*(.+)$/.exec(errText.trim());
      if (!bracketMatch) return true;
      const scopedDest = bracketMatch[1].trim();
      return !BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(scopedDest);
    });

    const allDestRefListsReadComplete =
      hasCurrentRefListsMap &&
      SUPPORTED_STANDARDIZED_REFERENCE_KEYS.every((stdKey) => {
        const destKey = `shopify.${stdKey}`;
        const refListEntry = rawResponse.currentReferenceLists[destKey];
        return Boolean(
          refListEntry &&
            typeof refListEntry === "object" &&
            refListEntry.readComplete === true &&
            refListEntry.parseValid === true
        );
      });

    if (
      rawResponse.defsReadComplete !== true ||
      !hasResolutionsMap ||
      !hasCurrentRefListsMap ||
      !hasCategoryEligibilityMap ||
      !allDestRefListsReadComplete ||
      unscopedTopErrors.length > 0
    ) {
      const globalFailureReasons =
        unscopedTopErrors.length > 0
          ? unscopedTopErrors
          : topErrors.length > 0
            ? topErrors
            : [
                rawResponse.defsReadComplete !== true
                  ? "Live PRODUCT metafield definitions read did not complete."
                  : !allDestRefListsReadComplete
                    ? "Product standardized metafield reference list read or parse did not complete."
                    : "Top-level resolveStandardizedCandidates prerequisite evidence was missing or incomplete."
              ];

      recordFailedOrStaleRefChoices(
        "failed_or_incomplete",
        globalFailureReasons[0] ||
          "Reference choices enumeration failed global prerequisite checks.",
        globalFailureReasons
      );
      return;
    }

    const verifiedMapByDest = {};
    let eligibleWithChoicesCount = 0;
    let eligibleEmptyChoicesCount = 0;
    let categoryIneligibleCount = 0;
    let incompleteOrBlockedCount = 0;

    for (const stdKey of SUPPORTED_STANDARDIZED_REFERENCE_KEYS) {
      const destKey = `shopify.${stdKey}`;
      const resObj = rawResponse.resolutions[destKey];
      const refListEntry = rawResponse.currentReferenceLists[destKey];
      const catEligEntry =
        resObj?.categoryEligibility || rawResponse.categoryEligibility[destKey] || null;
      const baselineDef = latestBaselineForProduct.liveDefinitions?.[destKey] || null;
      const expectedDefId = baselineDef?.restrictedMetaobjectDefinitionId || null;

      const scopedTopErrorsForDest = topErrors.filter((errText) => {
        const bracketMatch = /^\[([^\]]+)\]/.exec(errText.trim());
        return Boolean(bracketMatch && bracketMatch[1].trim() === destKey);
      });

      if (!resObj || typeof resObj !== "object") {
        incompleteOrBlockedCount += 1;
        verifiedMapByDest[destKey] = {
          destination: destKey,
          status: "incomplete",
          isComplete: false,
          isCategoryEligible: false,
          restrictedMetaobjectDefinitionId: expectedDefId,
          availableEntries: [],
          errors:
            scopedTopErrorsForDest.length > 0
              ? scopedTopErrorsForDest
              : [`Missing resolution entry for ${destKey}.`]
        };
        continue;
      }

      const resolvedDefId =
        resObj.restrictedMetaobjectDefinitionId ||
        resObj.restrictedMetaobjectDefinition?.id ||
        resObj.metafieldDefinition?.restrictedMetaobjectDefinitionId ||
        null;

      const defMatchesBaseline = Boolean(
        isExactMetaobjectDefinitionGid(resolvedDefId) &&
          isExactMetaobjectDefinitionGid(expectedDefId) &&
          resolvedDefId === expectedDefId &&
          resObj.metafieldDefinition?.type === "list.metaobject_reference" &&
          baselineDef?.type === "list.metaobject_reference"
      );

      const hasContinuation = Boolean(
        resObj.continuation &&
          typeof resObj.continuation === "object" &&
          resObj.continuation.hasNextPage === true
      );

      const isCatEligComplete = Boolean(
        catEligEntry &&
          typeof catEligEntry === "object" &&
          catEligEntry.isComplete === true
      );
      const isCatEligible = Boolean(
        isCatEligComplete &&
          catEligEntry.isEligible === true &&
          resObj.isCategoryEligible === true &&
          resObj.status !== "category_ineligible"
      );

      const isRefListCompleteAndValid = Boolean(
        refListEntry &&
          typeof refListEntry === "object" &&
          refListEntry.readComplete === true &&
          refListEntry.parseValid === true
      );

      const rawFieldErrors = Array.isArray(resObj.errors)
        ? resObj.errors.filter((e) => typeof e === "string" && e.trim() !== "")
        : [];
      for (const scopedErr of scopedTopErrorsForDest) {
        if (!rawFieldErrors.includes(scopedErr)) {
          rawFieldErrors.push(scopedErr);
        }
      }

      const isCompleteCategoryIneligible = Boolean(
        resObj.isComplete === true &&
          !hasContinuation &&
          defMatchesBaseline &&
          isRefListCompleteAndValid &&
          isCatEligComplete &&
          (resObj.status === "category_ineligible" ||
            resObj.isCategoryEligible === false ||
            catEligEntry.isEligible === false)
      );

      const isFieldEligibleAndComplete = Boolean(
        resObj.isComplete === true &&
          !hasContinuation &&
          defMatchesBaseline &&
          isRefListCompleteAndValid &&
          isCatEligible &&
          resObj.status !== "incomplete" &&
          resObj.status !== "blocked" &&
          rawFieldErrors.length === 0
      );

      const rawAvailable = Array.isArray(resObj.availableEntries)
        ? resObj.availableEntries
        : [];
      const verifiedAvailable = [];
      if (isFieldEligibleAndComplete) {
        for (const item of rawAvailable) {
          if (!item || typeof item !== "object") continue;
          const gid = extractEntryGid(item);
          const entryDefId = extractEntryDefinitionId(item);
          if (!isExactMetaobjectGid(gid)) continue;
          if (!defMatchesBaseline || entryDefId !== resolvedDefId) continue;
          verifiedAvailable.push({
            id: gid,
            displayName: extractEntryLabel(item) || gid,
            definition: {
              id: entryDefId,
              type:
                item.definition?.type ||
                resObj.restrictedMetaobjectDefinition?.type ||
                null,
              name:
                item.definition?.name ||
                resObj.restrictedMetaobjectDefinition?.name ||
                null
            },
            taxonomy_reference: item.taxonomy_reference ?? null
          });
        }
      }

      if (isCompleteCategoryIneligible) {
        categoryIneligibleCount += 1;
      } else if (!isFieldEligibleAndComplete) {
        incompleteOrBlockedCount += 1;
      } else if (verifiedAvailable.length === 0) {
        eligibleEmptyChoicesCount += 1;
      } else {
        eligibleWithChoicesCount += 1;
      }

      const mergedFieldErrors = [...rawFieldErrors];
      if (!defMatchesBaseline) {
        mergedFieldErrors.push(
          `Restricted MetaobjectDefinition mismatch or invalid ID on ${destKey}.`
        );
      }
      if (!isRefListCompleteAndValid) {
        mergedFieldErrors.push(
          refListEntry?.parseError ||
            `Stored reference list read or parse was incomplete on ${destKey}.`
        );
      }
      if (
        !isCatEligComplete &&
        catEligEntry?.reason &&
        !mergedFieldErrors.includes(catEligEntry.reason)
      ) {
        mergedFieldErrors.push(catEligEntry.reason);
      }

      verifiedMapByDest[destKey] = {
        ...resObj,
        restrictedMetaobjectDefinitionId: defMatchesBaseline ? resolvedDefId : null,
        isComplete: isFieldEligibleAndComplete,
        availableEntries: isFieldEligibleAndComplete ? verifiedAvailable : [],
        errors: mergedFieldErrors
      };
    }

    const overallState =
      incompleteOrBlockedCount > 0 ? "partial_or_blocked" : "choices_loaded";

    const resolvedProdTitle =
      latestBaselineForProduct?.productTitle || activeProductTitle || reqProductId;

    const summaryText = `Reference choices loaded for ${resolvedProdTitle}: ${eligibleWithChoicesCount} eligible attribute${
      eligibleWithChoicesCount === 1 ? "" : "s"
    } with verified choices${
      eligibleEmptyChoicesCount > 0
        ? `, ${eligibleEmptyChoicesCount} eligible with 0 entries in Shopify`
        : ""
    }${
      categoryIneligibleCount > 0
        ? `, ${categoryIneligibleCount} ineligible for category`
        : ""
    }${
      incompleteOrBlockedCount > 0
        ? `, ${incompleteOrBlockedCount} incomplete or blocked`
        : ""
    }.`;

    setRefChoicesStateByProduct((prev) => ({
      ...prev,
      [reqProductId]: {
        requestId: pendingReq.requestId,
        benchSessionId: pendingReq.benchSessionId,
        productId: reqProductId,
        baselineContextSig: pendingReq.baselineContextSig,
        productCategoryId: responseCategoryId,
        completedAt: new Date().toISOString(),
        ok: incompleteOrBlockedCount === 0,
        state: overallState,
        summary: summaryText,
        eligibleWithChoicesCount,
        eligibleEmptyChoicesCount,
        categoryIneligibleCount,
        incompleteOrBlockedCount,
        errors: topErrors,
        verifiedReferenceEntriesByDestination: verifiedMapByDest,
        rawResponse
      }
    }));

    activeRefChoicesRequestRef.current = null;
    setActiveRefChoicesRequest(null);
  }, [refChoicesFetcher.state, refChoicesFetcher.data, activeProductTitle, baselineByProductRef]);

  const canRetryRefChoicesForCurrentProduct = Boolean(
    isCurrentBaselineReadyForStandardizedLookup &&
      !isRefChoicesBusy &&
      currentRefChoicesRecord &&
      (!isCurrentRefChoicesBoundAndFresh || !currentRefChoicesRecord.ok)
  );

  const dismissCurrentRefChoicesRecord = useCallback(() => {
    setRefChoicesStateByProduct((prev) => {
      const next = { ...prev };
      delete next[activeProductId];
      return next;
    });
  }, [activeProductId]);

  return {
    currentBaseline,
    currentRefChoicesRecord,
    isCurrentRefChoicesBoundAndFresh,
    isRefChoicesBusy,
    canRetryRefChoicesForCurrentProduct,
    handleLoadStandardizedReferenceChoices,
    dismissCurrentRefChoicesRecord
  };
}
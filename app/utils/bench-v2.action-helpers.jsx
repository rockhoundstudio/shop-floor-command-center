// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 ACTION, PAYLOAD & RECONCILIATION HELPERS
// File: app/utils/bench-v2.action-helpers.jsx
// ==========================================================================

import {
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  isManualOnlyNoAiDestination,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  isExactProductVariantGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  inspectStoredReferenceListRawValue,
  validateBatch1ProposedValue,
  isExactValueApprovalValid,
  isKeepOriginalRecordValid
} from "./bench-v2.contract.jsx";
import {
  isExactMetaobjectGid
} from "./meta-injector.standardized.jsx";

export function getProposalValueString(rawEntry) {
  return rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
    ? rawEntry.value
    : typeof rawEntry === "string"
      ? rawEntry
      : "";
}

export function mergeKnownProductsMap(prevMap, pageItems, snap) {
  const next = { ...prevMap };
  if (Array.isArray(pageItems)) {
    for (const item of pageItems) {
      if (item && isExactProductGid(item.id)) {
        const existing = next[item.id];
        next[item.id] = {
          id: item.id,
          title: typeof item.title === "string" ? item.title : existing?.title || item.id,
          pieceName:
            typeof item.pieceName === "string" && item.pieceName.trim() !== ""
              ? item.pieceName.trim()
              : existing?.pieceName || null
        };
      }
    }
  }
  if (snap && isExactProductGid(snap.productId)) {
    const existing = next[snap.productId];
    const snapPieceName =
      typeof snap.currentMetafields?.["custom.piece_name"] === "string" &&
      snap.currentMetafields["custom.piece_name"].trim() !== ""
        ? snap.currentMetafields["custom.piece_name"].trim()
        : existing?.pieceName || null;
    next[snap.productId] = {
      id: snap.productId,
      title: snap.productTitle || existing?.title || snap.productId,
      pieceName: snapPieceName
    };
  }
  return next;
}

/**
 * Preserves both existing saved Metaobject GIDs on the product AND any valid
 * Metaobject GIDs already staged in the current proposal when selecting a preset
 * reference option in Drawer 10, so selecting a second choice appends rather than
 * silently replacing a prior staged addition.
 */
export function computeMergedPresetOptionValue(row, selectedOptionValue) {
  if (row.contract.namespace !== "shopify") {
    return selectedOptionValue;
  }

  const storedCheck = inspectStoredReferenceListRawValue(
    row.baselineObservation?.rawValue
  );
  if (!storedCheck.valid) {
    return selectedOptionValue;
  }

  let selectedGids = [];
  try {
    const parsedOpt = JSON.parse(selectedOptionValue);
    if (Array.isArray(parsedOpt)) {
      selectedGids = parsedOpt.filter((g) => typeof g === "string" && isExactMetaobjectGid(g));
    }
  } catch {
    if (isExactMetaobjectGid(selectedOptionValue)) {
      selectedGids = [selectedOptionValue.trim()];
    }
  }

  if (selectedGids.length === 0) {
    return selectedOptionValue;
  }

  let currentStagedGids = [];
  if (row.hasProposalKey && typeof row.proposedValue === "string" && row.proposedValue.trim().startsWith("[")) {
    try {
      const parsedCurrent = JSON.parse(row.proposedValue.trim());
      if (Array.isArray(parsedCurrent)) {
        const verifiedMap = row.referenceEvidence?.entriesByGid || null;
        currentStagedGids = parsedCurrent.filter(
          (g) =>
            typeof g === "string" &&
            isExactMetaobjectGid(g) &&
            (storedCheck.gids.includes(g) || !verifiedMap || verifiedMap.has(g))
        );
      }
    } catch {
      currentStagedGids = [];
    }
  }

  const mergedGids = [];
  const pushUnique = (gid) => {
    if (isExactMetaobjectGid(gid) && !mergedGids.includes(gid)) {
      mergedGids.push(gid);
    }
  };

  storedCheck.gids.forEach(pushUnique);
  currentStagedGids.forEach(pushUnique);
  selectedGids.forEach(pushUnique);

  return JSON.stringify(mergedGids);
}

export function validateAiScanPreflight({
  isAnyOperationBusy,
  currentBaseline,
  activeProductId,
  activeProductTitle,
  currentProposedMap,
  currentApprovalsMap,
  currentKeepOriginalMap
}) {
  if (isAnyOperationBusy) {
    return {
      ok: false,
      banner: {
        tone: "warning",
        title: "Operation already in progress",
        reasons: ["Wait for the current operation to complete before starting an AI Scan."]
      }
    };
  }

  if (!currentBaseline || currentBaseline.productId !== activeProductId) {
    return {
      ok: false,
      banner: {
        tone: "error",
        title: "Cannot run AI Scan: Product baseline not loaded",
        reasons: [`Reload ${activeProductTitle} so its baseline and photos are available.`]
      }
    };
  }

  if (
    currentBaseline.metafieldsReadComplete !== true ||
    currentBaseline.defsReadComplete !== true
  ) {
    return {
      ok: false,
      banner: {
        tone: "error",
        title: "Cannot run AI Scan: Baseline read incomplete",
        reasons: [
          "Product metafields or live definitions did not finish loading. Click Reload Product first."
        ]
      }
    };
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
    return {
      ok: false,
      banner: {
        tone: "error",
        title: "Cannot run AI Scan: No product photos found",
        reasons: [
          `No valid MediaImage URLs were found on ${activeProductTitle} for Gemini Vision.`
        ]
      }
    };
  }

  const operatorLockedList = [];
  const passiveStoredList = [];
  const contextKeyValues = {};

  for (const bareKey of ENGINE_ALLOWED_PROVENANCE_BARE_KEYS) {
    if (CANCELLED_INERT_DESTINATIONS.has(bareKey)) continue;

    let destKey = `custom.${bareKey}`;
    if (bareKey === "price") destKey = "native_price";
    else if (bareKey === "poetic_hook") destKey = "native_seo_description";

    const propEntry = currentProposedMap[destKey];
    const hasHumanDraft = Boolean(
      propEntry &&
        typeof propEntry === "object" &&
        propEntry.origin === "Manual" &&
        typeof propEntry.value === "string" &&
        propEntry.value.trim() !== ""
    );

    const approvalRec = currentApprovalsMap[destKey];
    const hasValidApproval = Boolean(
      approvalRec &&
        propEntry &&
        isExactValueApprovalValid({
          approvalRecord: approvalRec,
          productId: activeProductId,
          destinationKey: destKey,
          currentProposedValue:
            typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
          baselineSnapshot: currentBaseline
        })
    );

    const keepOrigRec = currentKeepOriginalMap[destKey];
    const hasValidKeepOriginal = Boolean(
      keepOrigRec &&
        propEntry &&
        isKeepOriginalRecordValid({
          keepOriginalRecord: keepOrigRec,
          productId: activeProductId,
          destinationKey: destKey,
          currentProposedValue:
            typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
          baselineSnapshot: currentBaseline
        })
    );

    let storedVal = "";
    if (bareKey === "price") {
      storedVal = currentBaseline.nativeTargets?.price || "";
    } else if (bareKey === "poetic_hook") {
      storedVal = currentBaseline.nativeTargets?.seo?.description || "";
    } else {
      const rawMf = currentBaseline.currentMetafields?.[`custom.${bareKey}`];
      storedVal = rawMf !== undefined && rawMf !== null ? String(rawMf).trim() : "";
    }

    if (hasHumanDraft || hasValidApproval) {
      const humanVal =
        typeof propEntry === "object" ? propEntry.value.trim() : String(propEntry || "").trim();
      if (humanVal !== "") {
        operatorLockedList.push(bareKey);
        contextKeyValues[bareKey] = humanVal;
        continue;
      }
    }

    if (hasValidKeepOriginal && storedVal !== "") {
      operatorLockedList.push(bareKey);
      contextKeyValues[bareKey] = storedVal;
      continue;
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

  return {
    ok: true,
    mediaInputs,
    operatorLockedList,
    passiveStoredList,
    contextKeyValues,
    observedDestinationTypes,
    ooak1ObservedType,
    ooak2ObservedType
  };
}

export function buildAiScanFormData({
  requestId,
  activeProductId,
  activeProductTitle,
  currentBaseline,
  mediaInputs,
  operatorLockedList,
  passiveStoredList,
  contextKeyValues,
  observedDestinationTypes,
  ooak1ObservedType,
  ooak2ObservedType
}) {
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
    ("");
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

  for (const [k, v] of Object.entries(contextKeyValues)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      formData.append(k, String(v));
    }
  }

  return formData;
}

export function buildFailedAiScanReport({
  requestId,
  productId,
  completedAt,
  summary,
  diagnostics = {}
}) {
  return {
    requestId,
    productId,
    completedAt,
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
  };
}

export function checkAiScanResponseEnvelope(pendingScan, rawResponse) {
  const scannedProductId = pendingScan.productId;

  if (!rawResponse || typeof rawResponse !== "object") {
    return {
      ok: false,
      summary: "AI Scan failed: no structured response returned by /app/meta-injector-autofill.",
      diagnostics: {}
    };
  }

  const returnedRequestId = rawResponse.requestId || null;
  const returnedPieceId = rawResponse.pieceId || rawResponse.productId || null;

  if (returnedRequestId !== pendingScan.requestId || returnedPieceId !== scannedProductId) {
    return {
      ok: false,
      summary: `Ignored mismatched or stale AI Scan response (expected product ${scannedProductId} / request ${pendingScan.requestId}, got product ${String(
        returnedPieceId
      )} / request ${String(returnedRequestId)}).`,
      diagnostics: {}
    };
  }

  if (rawResponse.success !== true) {
    return {
      ok: false,
      summary: rawResponse.error || "AI Scan returned an error.",
      diagnostics:
        rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
          ? rawResponse.producerDiagnostics
          : {}
    };
  }

  const hasValidStandardizedCandidates = Boolean(
    rawResponse.standardized_candidates &&
      typeof rawResponse.standardized_candidates === "object" &&
      !Array.isArray(rawResponse.standardized_candidates)
  );
  const standardizedCandidates = hasValidStandardizedCandidates
    ? rawResponse.standardized_candidates
    : null;

  const rawProducerProposals = rawResponse.producerProposals;
  if (
    !rawProducerProposals ||
    typeof rawProducerProposals !== "object" ||
    Array.isArray(rawProducerProposals)
  ) {
    return {
      ok: false,
      hasValidStandardizedCandidates,
      standardizedCandidates,
      summary:
        "AI Scan response did not include producerProposals separation map; refused to stage tab3Data fallbacks.",
      diagnostics: {}
    };
  }

  return {
    ok: true,
    hasValidStandardizedCandidates,
    standardizedCandidates,
    rawProducerProposals,
    diagnosticsObj:
      rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
        ? rawResponse.producerDiagnostics
        : {}
  };
}

export function evaluateAiScanProducerProposals({
  pendingScan,
  rawProducerProposals,
  diagnosticsObj = {},
  targetBaseline,
  existingProdProposalsMap,
  existingProdApprovalsMap,
  existingProdKeepOriginalMap,
  createTimestamp = () => new Date().toISOString()
}) {
  const scannedProductId = pendingScan.productId;
  const existingProdProposals = { ...(existingProdProposalsMap || {}) };
  const existingProdApprovals = existingProdApprovalsMap || {};
  const existingProdKeepOriginal = existingProdKeepOriginalMap || {};
  const nextAiAlternativesForProd = {};
  const proposalsByDestination = {};

  let receivedCount = 0;
  let stagedCount = 0;
  let heldConflictCount = 0;
  let unchangedSkippedCount = 0;
  let rejectedInvalidCount = 0;
  let ignoredManualOnlyCount = 0;
  const details = [];

  for (const [destKey, entry] of Object.entries(rawProducerProposals)) {
    if (CANCELLED_INERT_DESTINATIONS.has(destKey)) {
      continue;
    }

    const contract = getFieldContractByDestination(destKey);
    const rawValue =
      entry && typeof entry === "object" && typeof entry.value === "string"
        ? entry.value
        : "";
    const reportedSource =
      entry &&
      typeof entry === "object" &&
      typeof entry.source === "string" &&
      entry.source.trim() !== ""
        ? entry.source.trim()
        : "Source not reported";

    if (rawValue.trim() === "") {
      continue;
    }

    if (isManualOnlyNoAiDestination(destKey, contract)) {
      ignoredManualOnlyCount++;
      const manualReason =
        contract?.drawerId === "manual_measurements"
          ? "Manual measurement field — excluded from AI staging; enter physical measurement manually."
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

    const validation = validateBatch1ProposedValue({
      productId: scannedProductId,
      destinationKey: destKey,
      proposedValue: rawValue,
      baselineSnapshot: targetBaseline
    });

    if (!validation.valid) {
      rejectedInvalidCount++;
      proposalsByDestination[destKey] = {
        value: rawValue,
        source: reportedSource,
        disposition: "Rejected (invalid)",
        reason: validation.reason
      };
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

    const existingDraft = existingProdProposals[destKey];
    const existingDraftVal =
      existingDraft && typeof existingDraft === "object"
        ? existingDraft.value
        : typeof existingDraft === "string"
          ? existingDraft
          : "";
    const hasExistingDraft = Boolean(existingDraft && existingDraftVal.trim() !== "");
    const isManualDraft = Boolean(
      hasExistingDraft &&
        (typeof existingDraft !== "object" || existingDraft.origin !== "AI")
    );

    const approvalRec = existingProdApprovals[destKey] || null;
    const hasValidApproval =
      hasExistingDraft &&
      isExactValueApprovalValid({
        approvalRecord: approvalRec,
        productId: scannedProductId,
        destinationKey: destKey,
        currentProposedValue: existingDraftVal,
        baselineSnapshot: targetBaseline
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

    if (hasProtectedHumanState) {
      if (existingDraftVal === validation.normalizedValue && !hasValidKeepOriginal) {
        proposalsByDestination[destKey] = {
          value: validation.normalizedValue,
          source: reportedSource,
          disposition: "Matches current draft"
        };
        details.push(
          `[${destKey}] AI suggestion matches your current draft ("${validation.normalizedValue}") — Source: ${reportedSource}.`
        );
        continue;
      }
      heldConflictCount++;
      nextAiAlternativesForProd[destKey] = {
        value: validation.normalizedValue,
        source: reportedSource,
        requestId: pendingScan.requestId,
        receivedAt: createTimestamp()
      };
      proposalsByDestination[destKey] = {
        value: validation.normalizedValue,
        source: reportedSource,
        disposition: "Held as separate AI alternative"
      };
      details.push(
        `[${destKey}] Held AI alternative "${validation.normalizedValue}" (Source: ${reportedSource}) without overwriting your current draft or decision.`
      );
      continue;
    }

    existingProdProposals[destKey] = {
      value: validation.normalizedValue,
      source: reportedSource,
      origin: "AI",
      updatedAt: createTimestamp()
    };
    stagedCount++;
    proposalsByDestination[destKey] = {
      value: validation.normalizedValue,
      source: reportedSource,
      disposition: "Staged as unapproved AI draft"
    };
    details.push(
      `[${destKey}] Staged unapproved AI draft "${validation.normalizedValue}" (Source: ${reportedSource}).`
    );
  }

  const manualIgnoredNote =
    ignoredManualOnlyCount > 0
      ? `, ${ignoredManualOnlyCount} manual-only suggestion${
          ignoredManualOnlyCount === 1 ? "" : "s"
        } ignored`
      : "";

  const completedReport = {
    requestId: pendingScan.requestId,
    productId: scannedProductId,
    completedAt: createTimestamp(),
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
  };

  return {
    existingProdProposals,
    nextAiAlternativesForProd,
    completedReport
  };
}

export function applyAiAlternativesForProduct(prevByProduct, productId, nextAiAlternativesForProd) {
  return {
    ...prevByProduct,
    [productId]: {
      ...(prevByProduct[productId] || {}),
      ...nextAiAlternativesForProd
    }
  };
}

export function validateSaveApprovedPreflight({
  isWriterBusy,
  isAiScanBusy,
  isRefChoicesBusy,
  currentBaseline,
  activeProductId,
  activeProductTitle,
  currentProposedMap,
  currentApprovalsMap,
  currentKeepOriginalMap
}) {
  if (isWriterBusy || isAiScanBusy || isRefChoicesBusy) {
    return {
      ok: false,
      banner: {
        tone: "warning",
        title: isWriterBusy
          ? "Save already in progress"
          : isAiScanBusy
            ? "AI Scan in progress"
            : "Reference choices load in progress",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before clicking Save again."
            : isAiScanBusy
              ? "Wait for the current AI Scan to finish before saving."
              : "Wait for the current reference choices load to finish before saving."
        ]
      }
    };
  }

  if (!currentBaseline || currentBaseline.productId !== activeProductId) {
    return {
      ok: false,
      banner: {
        tone: "error",
        title: "Cannot save: Product data not loaded",
        reasons: [`Live product baseline is not loaded for ${activeProductTitle}.`]
      }
    };
  }

  const approvalEntries = Object.entries(currentApprovalsMap || {});
  if (approvalEntries.length === 0) {
    return {
      ok: false,
      banner: {
        tone: "warning",
        title: "Nothing approved to save",
        reasons: [
          "No fields are approved for this product. Edit or review a connected field in Drawers 1 to 8 or Drawer 10 (where ready on this product) and check Approve before clicking Save."
        ]
      }
    };
  }

  const prevalidationErrors = [];
  const safePlanToSubmit = {};
  let requiredVariantTargetId = null;

  for (const [destKey, approvalRec] of approvalEntries) {
    const contract = getFieldContractByDestination(destKey);
    if (
      !contract ||
      !contract.isWritableInBatch1 ||
      !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)
    ) {
      prevalidationErrors.push(
        `[${destKey}] Not an eligible writable destination.`
      );
      continue;
    }

    const currentProposedValue = getProposalValueString(currentProposedMap[destKey]);

    const keepOrigRec = currentKeepOriginalMap[destKey] || null;
    if (
      keepOrigRec &&
      isKeepOriginalRecordValid({
        keepOriginalRecord: keepOrigRec,
        productId: activeProductId,
        destinationKey: destKey,
        currentProposedValue,
        baselineSnapshot: currentBaseline
      })
    ) {
      prevalidationErrors.push(
        `[${destKey}] Marked Keep Original; cannot be submitted for Save.`
      );
      continue;
    }

    const fidelity = checkExistingWriterStringFidelity(currentProposedValue);
    if (!fidelity.faithful) {
      prevalidationErrors.push(`[${destKey}] ${fidelity.reason}`);
      continue;
    }

    const validation = validateBatch1ProposedValue({
      productId: activeProductId,
      destinationKey: destKey,
      proposedValue: currentProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!validation.valid) {
      prevalidationErrors.push(`[${destKey}] ${validation.reason}`);
      continue;
    }

    if (validation.isUnchangedFromStored) {
      prevalidationErrors.push(
        `[${destKey}] Proposed value matches the saved value; uncheck Approve or enter a changed value.`
      );
      continue;
    }

    const stillValidApproval = isExactValueApprovalValid({
      approvalRecord: approvalRec,
      productId: activeProductId,
      destinationKey: destKey,
      currentProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!stillValidApproval) {
      prevalidationErrors.push(
        `[${destKey}] Approval record is out of date. Please review the value and check Approve again.`
      );
      continue;
    }

    if (contract.owner === "PRODUCTVARIANT") {
      const obsVariantId = validation.baselineObservation?.variantId || null;
      const baselinePrimaryVariantId = currentBaseline?.primaryVariantId || null;

      if (
        currentBaseline?.variantsReadComplete !== true ||
        currentBaseline?.variantTargetStatus !== "single_variant_verified" ||
        currentBaseline?.variantMetafieldsReadComplete !== true ||
        currentBaseline?.variantDefsReadComplete !== true ||
        !isExactProductVariantGid(baselinePrimaryVariantId) ||
        !isExactProductVariantGid(obsVariantId) ||
        obsVariantId !== baselinePrimaryVariantId ||
        approvalRec?.owner !== "PRODUCTVARIANT" ||
        approvalRec?.variantId !== baselinePrimaryVariantId
      ) {
        prevalidationErrors.push(
          `[${destKey}] Variant target identity or completeness is not verified for this approval. Reload product data and re-approve.`
        );
        continue;
      }

      if (requiredVariantTargetId && requiredVariantTargetId !== baselinePrimaryVariantId) {
        prevalidationErrors.push(
          `[${destKey}] Conflicting variantTargetId detected across approved variant fields (${requiredVariantTargetId} vs. ${baselinePrimaryVariantId}).`
        );
        continue;
      }
      requiredVariantTargetId = baselinePrimaryVariantId;
    }

    safePlanToSubmit[destKey] = validation.normalizedValue;
  }

  if (prevalidationErrors.length > 0) {
    return {
      ok: false,
      banner: {
        tone: "error",
        title: `Save stopped (${prevalidationErrors.length} issue${
          prevalidationErrors.length === 1 ? "" : "s"
        } found — nothing was sent)`,
        reasons: prevalidationErrors
      }
    };
  }

  const submittedDestinations = Object.keys(safePlanToSubmit);
  if (submittedDestinations.length === 0) {
    return {
      ok: false,
      banner: {
        tone: "warning",
        title: "No eligible approved changes",
        reasons: ["No valid approved changes remained after preflight checks."]
      }
    };
  }

  return {
    ok: true,
    safePlanToSubmit,
    submittedDestinations,
    requiredVariantTargetId
  };
}

export function buildSaveApprovedFormData({
  submissionId,
  startedAt,
  activeProductId,
  requiredVariantTargetId,
  submittedDestinations,
  safePlanToSubmit
}) {
  const submissionMeta = {
    submissionId,
    productId: activeProductId,
    variantTargetId: requiredVariantTargetId,
    submittedDestinations,
    submittedValuesByDestination: { ...safePlanToSubmit },
    startedAt
  };

  const formData = new FormData();
  formData.append("intent", "executeRepairPlan");
  formData.append("benchV2OptIn", "true");
  formData.append("pieceId", activeProductId);
  if (requiredVariantTargetId) {
    formData.append("variantTargetId", requiredVariantTargetId);
  }
  formData.append("repairPlan", JSON.stringify(safePlanToSubmit));
  formData.append("nativeChanges", JSON.stringify({}));
  formData.append("legacyKeysToRemove", JSON.stringify([]));

  return {
    submissionMeta,
    formData
  };
}

export function buildAbortedSaveReport({
  pendingSub,
  completedAt,
  overallOutcome,
  writerStatus,
  message,
  errors
}) {
  const submittedProductId = pendingSub.productId;
  const submittedVariantTargetId = pendingSub.variantTargetId || null;
  const submittedDestinations = pendingSub.submittedDestinations || [];

  return {
    submissionId: pendingSub.submissionId,
    productId: submittedProductId,
    variantTargetId: submittedVariantTargetId,
    completedAt,
    overallOutcome,
    writerStatus,
    message,
    submittedDestinations,
    verifiedDestinations: [],
    blockedFields: {},
    skippedKeys: [],
    unsupportedKeys: [],
    unchanged: [],
    unresolvedChanges: {},
    conflicts: {},
    errors,
    unconfirmedDestinations: [...submittedDestinations],
    readBackVerified: false
  };
}

export function evaluateWriterSaveOutcome({ pendingSub, rawResponse }) {
  const submittedProductId = pendingSub.productId;
  const submittedVariantTargetId = pendingSub.variantTargetId || null;
  const submittedDestinations = pendingSub.submittedDestinations || [];
  const submittedValuesByDest = pendingSub.submittedValuesByDestination || {};

  if (!rawResponse || typeof rawResponse !== "object") {
    return {
      aborted: true,
      overallOutcome: "UNCONFIRMED_NETWORK_OR_SERVER_FAILURE",
      writerStatus: "NO_RESPONSE_PAYLOAD",
      message:
        "The save request ended without a response. Do not assume zero writes occurred. Reloading live data from Shopify to check what was saved.",
      errors: [{ message: "No structured response returned by writer endpoint." }]
    };
  }

  const responsePieceId = rawResponse.pieceId || rawResponse.productId || null;
  if (responsePieceId && responsePieceId !== submittedProductId) {
    return {
      aborted: true,
      overallOutcome: "MISMATCHED_PRODUCT_RESPONSE_IGNORED",
      writerStatus: String(rawResponse.status || "MISMATCH"),
      message: `Writer response pieceId (${responsePieceId}) did not match submitted productId (${submittedProductId}). Keeping all drafts and reloading live baseline.`,
      errors: Array.isArray(rawResponse.errors) ? rawResponse.errors : []
    };
  }

  const verifiedList = Array.isArray(rawResponse.verifiedDestinations)
    ? rawResponse.verifiedDestinations
    : [];
  const verifiedSet = new Set(verifiedList);
  const blockedFields =
    rawResponse.blockedFields && typeof rawResponse.blockedFields === "object"
      ? rawResponse.blockedFields
      : {};
  const skippedKeys = Array.isArray(rawResponse.skippedKeys) ? rawResponse.skippedKeys : [];
  const unsupportedKeys = Array.isArray(rawResponse.unsupportedKeys)
    ? rawResponse.unsupportedKeys
    : [];
  const unchangedList = Array.isArray(rawResponse.unchanged) ? rawResponse.unchanged : [];
  const unresolvedChanges =
    rawResponse.unresolvedChanges && typeof rawResponse.unresolvedChanges === "object"
      ? rawResponse.unresolvedChanges
      : {};
  const conflicts =
    rawResponse.conflicts && typeof rawResponse.conflicts === "object"
      ? rawResponse.conflicts
      : {};
  const errorsList = Array.isArray(rawResponse.errors)
    ? rawResponse.errors
    : rawResponse.error
      ? [{ message: String(rawResponse.error) }]
      : [];
  const readBackVerified = rawResponse.readBackVerified === true;
  const responseVariantTarget =
    rawResponse.primaryVariantId || rawResponse.variantTarget || null;

  const unconfirmedDestinations = submittedDestinations.filter(
    (dest) =>
      !verifiedSet.has(dest) &&
      !Object.prototype.hasOwnProperty.call(blockedFields, dest) &&
      !skippedKeys.includes(dest) &&
      !unsupportedKeys.includes(dest) &&
      !unchangedList.includes(dest)
  );

  const hasReturnedProductMetafields = Boolean(
    rawResponse.currentMetafields &&
    typeof rawResponse.currentMetafields === "object" &&
    !Array.isArray(rawResponse.currentMetafields)
  );
  const hasReturnedVariantMetafields = Boolean(
    rawResponse.currentVariantMetafields &&
    typeof rawResponse.currentVariantMetafields === "object" &&
    !Array.isArray(rawResponse.currentVariantMetafields) &&
    rawResponse.variantMetafieldsReadComplete === true &&
    submittedVariantTargetId &&
    responseVariantTarget === submittedVariantTargetId
  );

  const canClearVerifiedDest = (vDest) => {
    const contract = getFieldContractByDestination(vDest);
    const isVariantDest =
      contract?.owner === "PRODUCTVARIANT" ||
      BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);
    if (isVariantDest) {
      return Boolean(
        submittedVariantTargetId &&
        responseVariantTarget === submittedVariantTargetId &&
        rawResponse.variantMetafieldsReadComplete === true
      );
    }
    return true;
  };

  return {
    aborted: false,
    submittedProductId,
    submittedVariantTargetId,
    submittedDestinations,
    submittedValuesByDest,
    verifiedList,
    verifiedSet,
    blockedFields,
    skippedKeys,
    unsupportedKeys,
    unchangedList,
    unresolvedChanges,
    conflicts,
    errorsList,
    readBackVerified,
    responseVariantTarget,
    unconfirmedDestinations,
    hasReturnedProductMetafields,
    hasReturnedVariantMetafields,
    canClearVerifiedDest
  };
}

export function applyVerifiedSaveToBaselineByProduct(
  prevByProduct,
  {
    submittedProductId,
    submittedVariantTargetId,
    verifiedList,
    rawResponse,
    hasReturnedProductMetafields,
    hasReturnedVariantMetafields,
    loadedAt
  }
) {
  const existingSnap = prevByProduct[submittedProductId];
  if (!existingSnap || existingSnap.productId !== submittedProductId) {
    return prevByProduct;
  }

  const updatedMetafields = { ...(existingSnap.currentMetafields || {}) };
  const updatedTypes = { ...(existingSnap.currentMetafieldTypes || {}) };

  let updatedVariantMetafields = existingSnap.currentVariantMetafields
    ? { ...existingSnap.currentVariantMetafields }
    : null;
  let updatedVariantTypes = existingSnap.currentVariantMetafieldTypes
    ? { ...existingSnap.currentVariantMetafieldTypes }
    : null;
  let updatedVariantIds = existingSnap.currentVariantMetafieldIds
    ? { ...existingSnap.currentVariantMetafieldIds }
    : null;
  let nextVariantReadComplete = existingSnap.variantMetafieldsReadComplete === true;

  for (const vDest of verifiedList) {
    const contract = getFieldContractByDestination(vDest);
    const isVariantDest =
      contract?.owner === "PRODUCTVARIANT" ||
      BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);

    if (isVariantDest) {
      if (
        hasReturnedVariantMetafields &&
        existingSnap.primaryVariantId === submittedVariantTargetId &&
        Object.prototype.hasOwnProperty.call(rawResponse.currentVariantMetafields, vDest)
      ) {
        if (!updatedVariantMetafields) updatedVariantMetafields = {};
        if (!updatedVariantTypes) updatedVariantTypes = {};
        updatedVariantMetafields[vDest] = rawResponse.currentVariantMetafields[vDest];
        const returnedVarType =
          rawResponse.currentVariantMetafieldTypes?.[vDest] ||
          existingSnap.liveVariantDefinitions?.[vDest]?.type ||
          null;
        if (returnedVarType) {
          updatedVariantTypes[vDest] = returnedVarType;
        }
        if (
          rawResponse.currentVariantMetafieldIds &&
          typeof rawResponse.currentVariantMetafieldIds === "object" &&
          rawResponse.currentVariantMetafieldIds[vDest]
        ) {
          if (!updatedVariantIds) updatedVariantIds = {};
          updatedVariantIds[vDest] = rawResponse.currentVariantMetafieldIds[vDest];
        }
        nextVariantReadComplete = rawResponse.variantMetafieldsReadComplete === true;
      }
    } else if (
      hasReturnedProductMetafields &&
      Object.prototype.hasOwnProperty.call(rawResponse.currentMetafields, vDest)
    ) {
      updatedMetafields[vDest] = rawResponse.currentMetafields[vDest];
      const returnedProdType =
        rawResponse.currentMetafieldTypes?.[vDest] ||
        existingSnap.liveDefinitions?.[vDest]?.type ||
        null;
      if (!updatedTypes[vDest] && returnedProdType) {
        updatedTypes[vDest] = returnedProdType;
      }
    }
  }

  return {
    ...prevByProduct,
    [submittedProductId]: {
      ...existingSnap,
      currentMetafields: updatedMetafields,
      currentMetafieldTypes: updatedTypes,
      currentVariantMetafields: updatedVariantMetafields,
      currentVariantMetafieldTypes: updatedVariantTypes,
      currentVariantMetafieldIds: updatedVariantIds,
      variantMetafieldsReadComplete: nextVariantReadComplete,
      loadedAt
    }
  };
}

export function pruneVerifiedProposalsByProduct(
  prevByProduct,
  {
    submittedProductId,
    verifiedSet,
    submittedValuesByDest,
    canClearVerifiedDest
  }
) {
  const prodMap = { ...(prevByProduct[submittedProductId] || {}) };
  for (const vDest of verifiedSet) {
    if (!canClearVerifiedDest(vDest)) continue;
    const currentEntry = prodMap[vDest];
    const currentVal =
      currentEntry && typeof currentEntry === "object"
        ? currentEntry.value
        : currentEntry;
    if (currentVal === submittedValuesByDest[vDest]) {
      delete prodMap[vDest];
    }
  }
  return { ...prevByProduct, [submittedProductId]: prodMap };
}

export function pruneVerifiedApprovalsByProduct(
  prevByProduct,
  {
    submittedProductId,
    verifiedSet,
    submittedValuesByDest,
    canClearVerifiedDest
  }
) {
  const prodApprovals = { ...(prevByProduct[submittedProductId] || {}) };
  for (const vDest of verifiedSet) {
    if (!canClearVerifiedDest(vDest)) continue;
    const rec = prodApprovals[vDest];
    if (rec && rec.approvedValue === submittedValuesByDest[vDest]) {
      delete prodApprovals[vDest];
    }
  }
  return { ...prevByProduct, [submittedProductId]: prodApprovals };
}

export function buildCompletedSaveReport({
  pendingSub,
  rawResponse,
  evaluatedOutcome,
  completedAt
}) {
  const {
    submittedProductId,
    submittedVariantTargetId,
    submittedDestinations,
    submittedValuesByDest,
    verifiedList,
    blockedFields,
    skippedKeys,
    unsupportedKeys,
    unchangedList,
    unresolvedChanges,
    conflicts,
    errorsList,
    readBackVerified,
    responseVariantTarget,
    unconfirmedDestinations
  } = evaluatedOutcome;

  return {
    submissionId: pendingSub.submissionId,
    productId: submittedProductId,
    variantTargetId: submittedVariantTargetId,
    responseVariantTarget,
    completedAt,
    overallOutcome:
      rawResponse.success === true &&
      rawResponse.status === "REPAIRED" &&
      readBackVerified &&
      unconfirmedDestinations.length === 0
        ? "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
        : verifiedList.length > 0
          ? "PARTIAL_OR_UNRESOLVED_WRITE_OUTCOME"
          : "WRITE_FAILED_OR_BLOCKED",
    writerStatus: String(rawResponse.status || (rawResponse.success ? "OK" : "FAILED")),
    message:
      rawResponse.message ||
      rawResponse.error ||
      "Save finished. Review the field results below.",
    submittedDestinations,
    submittedValuesByDestination: submittedValuesByDest,
    verifiedDestinations: verifiedList,
    blockedFields,
    skippedKeys,
    unsupportedKeys,
    unchanged: unchangedList,
    unresolvedChanges,
    conflicts,
    errors: errorsList,
    unconfirmedDestinations,
    readBackVerified
  };
}
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 SAVE CONTROLLER (CLIENT MODULE)
// File: app/utils/bench-v2.save-controller.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (File 1 of 2 for Save controller
// extraction). Owns writerFetcher, activeSaveSubmission, lastSaveReport,
// processedSubmissionIdRef, activeSaveSubmissionRef, derived isWriterBusy,
// explicit Save prevalidation & submission, and read-back verified baseline
// & draft/approval clearing.
// ==========================================================================

import { useState, useEffect, useRef } from "react";
import { useFetcher } from "react-router";
import {
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS,
  checkExistingWriterStringFidelity,
  isExactProductVariantGid,
  getFieldContractByDestination,
  validateBatch1ProposedValue,
  isExactValueApprovalValid,
  isKeepOriginalRecordValid
} from "./bench-v2.contract.jsx";
import {
  getProposalValueString,
  hasExplicitReferenceReplacementFlag
} from "./bench-v2.json-draft-importer.jsx";

export function useBenchV2SaveController({
  activeProductId,
  activeProductTitle,
  revalidator,
  currentBaselineRef,
  isAiScanBusyRef,
  isRefChoicesBusyRef,
  isJsonImportBusy,
  proposedByProduct,
  setProposedByProduct,
  approvalsByProduct,
  setApprovalsByProduct,
  keepOriginalByProduct,
  setBaselineByProduct,
  setKnownProductsById,
  setClientPrevalidationBanner
}) {
  const writerFetcher = useFetcher();

  // Save Request Tracking & Honest Outcome Reporting
  const [activeSaveSubmission, setActiveSaveSubmission] = useState(null);
  const [lastSaveReport, setLastSaveReport] = useState(null);
  const processedSubmissionIdRef = useRef(null);
  const activeSaveSubmissionRef = useRef(null);

  useEffect(() => {
    activeSaveSubmissionRef.current = activeSaveSubmission;
  }, [activeSaveSubmission]);

  const isWriterBusy = writerFetcher.state !== "idle" || Boolean(activeSaveSubmission);

  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};

  useEffect(() => {
    if (writerFetcher.state !== "idle") return;
    const pendingSub = activeSaveSubmissionRef.current;
    if (!pendingSub) return;

    const rawResponse = writerFetcher.data;
    if (processedSubmissionIdRef.current === pendingSub.submissionId) {
      return;
    }

    processedSubmissionIdRef.current = pendingSub.submissionId;

    const submittedProductId = pendingSub.productId;
    const submittedVariantTargetId = pendingSub.variantTargetId || null;
    const submittedDestinations = pendingSub.submittedDestinations || [];
    const submittedValuesByDest = pendingSub.submittedValuesByDestination || {};

    const recordAbortedSaveReport = (overallOutcome, writerStatus, message, errors) => {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        variantTargetId: submittedVariantTargetId,
        completedAt: new Date().toISOString(),
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
      });
      setActiveSaveSubmission(null);
      revalidator.revalidate();
    };

    if (!rawResponse || typeof rawResponse !== "object") {
      recordAbortedSaveReport(
        "UNCONFIRMED_NETWORK_OR_SERVER_FAILURE",
        "NO_RESPONSE_PAYLOAD",
        "The save request ended without a response. Do not assume zero writes occurred. Reloading live data from Shopify to check what was saved.",
        [{ message: "No structured response returned by writer endpoint." }]
      );
      return;
    }

    const responsePieceId = rawResponse.pieceId || rawResponse.productId || null;
    if (responsePieceId && responsePieceId !== submittedProductId) {
      recordAbortedSaveReport(
        "MISMATCHED_PRODUCT_RESPONSE_IGNORED",
        String(rawResponse.status || "MISMATCH"),
        `Writer response pieceId (${responsePieceId}) did not match submitted productId (${submittedProductId}). Keeping all drafts and reloading live baseline.`,
        Array.isArray(rawResponse.errors) ? rawResponse.errors : []
      );
      return;
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
    const returnedNativeTargets =
      rawResponse.nativeTargets &&
      typeof rawResponse.nativeTargets === "object" &&
      !Array.isArray(rawResponse.nativeTargets) &&
      (!rawResponse.nativeTargets.productId ||
        rawResponse.nativeTargets.productId === submittedProductId)
        ? rawResponse.nativeTargets
        : null;
    const hasVerifiedNativeDestination = verifiedList.some(
      (vDest) =>
        BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(vDest) ||
        vDest === "native_price"
    );

    if (
      hasReturnedProductMetafields ||
      hasReturnedVariantMetafields ||
      (hasVerifiedNativeDestination && returnedNativeTargets)
    ) {
      setBaselineByProduct((prev) => {
        const existingSnap = prev[submittedProductId];
        if (!existingSnap || existingSnap.productId !== submittedProductId) return prev;

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

        const existingNativeTargets =
          existingSnap.nativeTargets && typeof existingSnap.nativeTargets === "object"
            ? existingSnap.nativeTargets
            : {};
        let updatedNativeTargets = {
          ...existingNativeTargets,
          seo:
            existingNativeTargets.seo && typeof existingNativeTargets.seo === "object"
              ? { ...existingNativeTargets.seo }
              : { title: null, description: null }
        };
        let nextProductTitle = existingSnap.productTitle;

        for (const vDest of verifiedList) {
          const contract = getFieldContractByDestination(vDest);
          const isVariantMetafieldDest =
            (contract?.owner === "PRODUCTVARIANT" && contract?.namespace !== "native") ||
            BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);

          if (vDest === "native_price") {
            if (!returnedNativeTargets) continue;
            const unverifiedNativeList = Array.isArray(returnedNativeTargets.unverifiedFields)
              ? returnedNativeTargets.unverifiedFields
              : [];
            if (
              submittedVariantTargetId &&
              responseVariantTarget === submittedVariantTargetId &&
              existingSnap.primaryVariantId === submittedVariantTargetId &&
              !unverifiedNativeList.includes("price") &&
              typeof returnedNativeTargets.price === "string" &&
              returnedNativeTargets.price === submittedValuesByDest["native_price"]
            ) {
              const verifiedPriceStr = returnedNativeTargets.price;
              updatedNativeTargets.price = verifiedPriceStr;
              if (Array.isArray(updatedNativeTargets.variants?.edges)) {
                updatedNativeTargets.variants = {
                  ...updatedNativeTargets.variants,
                  edges: updatedNativeTargets.variants.edges.map((edge) =>
                    edge?.node?.id === submittedVariantTargetId
                      ? {
                          ...edge,
                          node: {
                            ...edge.node,
                            price: verifiedPriceStr
                          }
                        }
                      : edge
                  )
                };
              }
            }
          } else if (BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(vDest)) {
            if (!returnedNativeTargets) continue;
            const unverifiedNativeList = Array.isArray(returnedNativeTargets.unverifiedFields)
              ? returnedNativeTargets.unverifiedFields
              : [];

            if (
              vDest === "native_title" &&
              !unverifiedNativeList.includes("productTitle") &&
              typeof returnedNativeTargets.productTitle === "string"
            ) {
              updatedNativeTargets.productTitle = returnedNativeTargets.productTitle;
              nextProductTitle = returnedNativeTargets.productTitle;
            } else if (
              vDest === "native_description" &&
              !unverifiedNativeList.includes("descriptionHtml") &&
              typeof returnedNativeTargets.descriptionHtml === "string"
            ) {
              updatedNativeTargets.descriptionHtml = returnedNativeTargets.descriptionHtml;
            } else if (
              vDest === "native_seo_title" &&
              !unverifiedNativeList.includes("seo") &&
              returnedNativeTargets.seo &&
              typeof returnedNativeTargets.seo === "object" &&
              typeof returnedNativeTargets.seo.title === "string"
            ) {
              updatedNativeTargets.seo = {
                ...(updatedNativeTargets.seo || {}),
                title: returnedNativeTargets.seo.title
              };
            } else if (
              vDest === "native_seo_description" &&
              !unverifiedNativeList.includes("seo") &&
              returnedNativeTargets.seo &&
              typeof returnedNativeTargets.seo === "object" &&
              typeof returnedNativeTargets.seo.description === "string"
            ) {
              updatedNativeTargets.seo = {
                ...(updatedNativeTargets.seo || {}),
                description: returnedNativeTargets.seo.description
              };
            }
          } else if (isVariantMetafieldDest) {
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
          ...prev,
          [submittedProductId]: {
            ...existingSnap,
            productTitle: nextProductTitle,
            nativeTargets: updatedNativeTargets,
            currentMetafields: updatedMetafields,
            currentMetafieldTypes: updatedTypes,
            currentVariantMetafields: updatedVariantMetafields,
            currentVariantMetafieldTypes: updatedVariantTypes,
            currentVariantMetafieldIds: updatedVariantIds,
            variantMetafieldsReadComplete: nextVariantReadComplete,
            loadedAt: new Date().toISOString()
          }
        };
      });

      if (
        verifiedSet.has("native_title") &&
        returnedNativeTargets &&
        typeof returnedNativeTargets.productTitle === "string" &&
        returnedNativeTargets.productTitle.trim() !== ""
      ) {
        const verifiedTitle = returnedNativeTargets.productTitle;
        setKnownProductsById((prev) => {
          const existing = prev[submittedProductId] || {
            id: submittedProductId,
            title: verifiedTitle,
            pieceName: null
          };
          return {
            ...prev,
            [submittedProductId]: {
              ...existing,
              title: verifiedTitle
            }
          };
        });
      }
    }

    if (verifiedSet.size > 0) {
      const canClearVerifiedDest = (vDest) => {
        const contract = getFieldContractByDestination(vDest);
        if (vDest === "native_price") {
          if (!returnedNativeTargets) return false;
          const unverifiedNativeList = Array.isArray(returnedNativeTargets.unverifiedFields)
            ? returnedNativeTargets.unverifiedFields
            : [];
          return Boolean(
            submittedVariantTargetId &&
            responseVariantTarget === submittedVariantTargetId &&
            !unverifiedNativeList.includes("price") &&
            typeof returnedNativeTargets.price === "string" &&
            returnedNativeTargets.price === submittedValuesByDest["native_price"]
          );
        }
        const isVariantMetafieldDest =
          (contract?.owner === "PRODUCTVARIANT" && contract?.namespace !== "native") ||
          BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);
        if (isVariantMetafieldDest) {
          return Boolean(
            submittedVariantTargetId &&
            responseVariantTarget === submittedVariantTargetId &&
            rawResponse.variantMetafieldsReadComplete === true
          );
        }
        if (BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(vDest)) {
          if (!returnedNativeTargets) return false;
          const unverifiedNativeList = Array.isArray(returnedNativeTargets.unverifiedFields)
            ? returnedNativeTargets.unverifiedFields
            : [];
          if (vDest === "native_title") {
            return (
              !unverifiedNativeList.includes("productTitle") &&
              typeof returnedNativeTargets.productTitle === "string"
            );
          }
          if (vDest === "native_description") {
            return (
              !unverifiedNativeList.includes("descriptionHtml") &&
              typeof returnedNativeTargets.descriptionHtml === "string"
            );
          }
          if (vDest === "native_seo_title") {
            return (
              !unverifiedNativeList.includes("seo") &&
              typeof returnedNativeTargets.seo?.title === "string"
            );
          }
          if (vDest === "native_seo_description") {
            return (
              !unverifiedNativeList.includes("seo") &&
              typeof returnedNativeTargets.seo?.description === "string"
            );
          }
        }
        return true;
      };

      setProposedByProduct((prev) => {
        const prodMap = { ...(prev[submittedProductId] || {}) };
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
        return { ...prev, [submittedProductId]: prodMap };
      });

      setApprovalsByProduct((prev) => {
        const prodApprovals = { ...(prev[submittedProductId] || {}) };
        for (const vDest of verifiedSet) {
          if (!canClearVerifiedDest(vDest)) continue;
          const rec = prodApprovals[vDest];
          if (rec && rec.approvedValue === submittedValuesByDest[vDest]) {
            delete prodApprovals[vDest];
          }
        }
        return { ...prev, [submittedProductId]: prodApprovals };
      });
    }

    setLastSaveReport({
      submissionId: pendingSub.submissionId,
      productId: submittedProductId,
      variantTargetId: submittedVariantTargetId,
      responseVariantTarget,
      completedAt: new Date().toISOString(),
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
    });

    setActiveSaveSubmission(null);
    revalidator.revalidate();
  }, [
    writerFetcher.state,
    writerFetcher.data,
    revalidator,
    setBaselineByProduct,
    setKnownProductsById,
    setProposedByProduct,
    setApprovalsByProduct
  ]);

  const handleExplicitSaveApprovedChanges = () => {
    setClientPrevalidationBanner(null);

    const currentBaseline = currentBaselineRef.current;
    const isAiScanBusy = Boolean(isAiScanBusyRef.current);
    const isRefChoicesBusy = Boolean(isRefChoicesBusyRef.current);

    if (isWriterBusy || isAiScanBusy || isRefChoicesBusy || isJsonImportBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: isWriterBusy
          ? "Save already in progress"
          : isAiScanBusy
            ? "AI Scan in progress"
            : isJsonImportBusy
              ? "JSON draft import in progress"
              : "Reference choices load in progress",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before clicking Save again."
            : isAiScanBusy
              ? "Wait for the current AI Scan to finish before saving."
              : isJsonImportBusy
                ? "Wait for the current JSON draft import to finish before saving."
                : "Wait for the current reference choices load to finish before saving."
        ]
      });
      return;
    }

    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot save: Product data not loaded",
        reasons: [`Live product baseline is not loaded for ${activeProductTitle}.`]
      });
      return;
    }

    const approvalEntries = Object.entries(currentApprovalsMap || {});
    if (approvalEntries.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Nothing approved to save",
        reasons: [
          "No fields are approved for this product. Edit or review a connected field (where ready on this product) and check Approve before clicking Save."
        ]
      });
      return;
    }

    const prevalidationErrors = [];
    const safePlanToSubmit = {};
    const safeNativeChangesToSubmit = {};
    const safeExplicitReferenceReplacementsToSubmit = {};
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

      const rawPropEntry = currentProposedMap[destKey];
      const currentProposedValue = getProposalValueString(rawPropEntry);
      const allowExplicitReplacement = hasExplicitReferenceReplacementFlag(
        rawPropEntry,
        destKey,
        currentProposedValue
      );

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
        baselineSnapshot: currentBaseline,
        allowExplicitReferenceListReplacement: allowExplicitReplacement
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
        baselineSnapshot: currentBaseline,
        allowExplicitReferenceListReplacement: allowExplicitReplacement
      });

      if (!stillValidApproval) {
        prevalidationErrors.push(
          `[${destKey}] Approval record is out of date. Please review the value and check Approve again.`
        );
        continue;
      }

      if (
        contract.namespace === "shopify" &&
        validation.allowExplicitReferenceListReplacement === true &&
        Array.isArray(validation.removedStoredReferenceGids) &&
        validation.removedStoredReferenceGids.length > 0
      ) {
        if (
          approvalRec?.allowExplicitReferenceListReplacement !== true ||
          approvalRec?.approvedValue !== validation.normalizedValue ||
          approvalRec?.baselineSignature !== validation.baselineObservation?.signature ||
          approvalRec?.restrictedMetaobjectDefinitionId !==
            validation.baselineObservation?.restrictedMetaobjectDefinitionId
        ) {
          prevalidationErrors.push(
            `[${destKey}] Explicit reference list replacement approval does not match current baseline evidence. Please re-approve before saving.`
          );
          continue;
        }
        safeExplicitReferenceReplacementsToSubmit[destKey] = {
          allowExplicitReferenceListReplacement: true,
          productId: approvalRec.productId,
          destinationKey: approvalRec.destinationKey,
          approvedValue: approvalRec.approvedValue,
          baselineSignature: approvalRec.baselineSignature,
          restrictedMetaobjectDefinitionId: approvalRec.restrictedMetaobjectDefinitionId,
          productCategoryId: approvalRec.productCategoryId || null,
          categoryEligibilityStatus: approvalRec.categoryEligibilityStatus || null,
          removedStoredReferenceGids: Array.isArray(approvalRec.removedStoredReferenceGids)
            ? [...approvalRec.removedStoredReferenceGids]
            : [...validation.removedStoredReferenceGids]
        };
      }

      if (contract.owner === "PRODUCTVARIANT") {
        const obsVariantId = validation.baselineObservation?.variantId || null;
        const baselinePrimaryVariantId = currentBaseline?.primaryVariantId || null;
        const isNativeVariantPriceDest =
          contract.namespace === "native" && destKey === "native_price";

        if (isNativeVariantPriceDest) {
          if (
            currentBaseline?.variantsReadComplete !== true ||
            currentBaseline?.variantTargetStatus !== "single_variant_verified" ||
            !isExactProductVariantGid(baselinePrimaryVariantId) ||
            !isExactProductVariantGid(obsVariantId) ||
            obsVariantId !== baselinePrimaryVariantId ||
            approvalRec?.owner !== "PRODUCTVARIANT" ||
            approvalRec?.variantId !== baselinePrimaryVariantId
          ) {
            prevalidationErrors.push(
              `[${destKey}] Single-variant target identity is not verified for this price approval. Reload product data and re-approve.`
            );
            continue;
          }
        } else if (
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

      if (destKey === "native_title") {
        safeNativeChangesToSubmit.title = validation.normalizedValue;
      }

      safePlanToSubmit[destKey] = validation.normalizedValue;
    }

    if (prevalidationErrors.length > 0) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Save stopped (${prevalidationErrors.length} issue${
          prevalidationErrors.length === 1 ? "" : "s"
        } found — nothing was sent)`,
        reasons: prevalidationErrors
      });
      return;
    }

    const submittedDestinations = Object.keys(safePlanToSubmit);
    if (submittedDestinations.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "No eligible approved changes",
        reasons: ["No valid approved changes remained after preflight checks."]
      });
      return;
    }

    const submissionId = `bench_v2_save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const submissionMeta = {
      submissionId,
      productId: activeProductId,
      variantTargetId: requiredVariantTargetId,
      submittedDestinations,
      submittedValuesByDestination: { ...safePlanToSubmit },
      submittedNativeChanges: { ...safeNativeChangesToSubmit },
      submittedExplicitReferenceReplacements: { ...safeExplicitReferenceReplacementsToSubmit },
      startedAt: new Date().toISOString()
    };

    setActiveSaveSubmission(submissionMeta);

    const formData = new FormData();
    formData.append("intent", "executeRepairPlan");
    formData.append("benchV2OptIn", "true");
    formData.append("pieceId", activeProductId);
    if (requiredVariantTargetId) {
      formData.append("variantTargetId", requiredVariantTargetId);
    }
    formData.append("repairPlan", JSON.stringify(safePlanToSubmit));
    formData.append("nativeChanges", JSON.stringify(safeNativeChangesToSubmit));
    if (Object.keys(safeExplicitReferenceReplacementsToSubmit).length > 0) {
      formData.append(
        "explicitReferenceReplacements",
        JSON.stringify(safeExplicitReferenceReplacementsToSubmit)
      );
    }
    formData.append("legacyKeysToRemove", JSON.stringify([]));

    writerFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-api"
    });
  };

  return {
    isWriterBusy,
    lastSaveReport,
    setLastSaveReport,
    handleExplicitSaveApprovedChanges
  };
}
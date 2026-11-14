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

import { useState, useEffect, useRef, useCallback } from "react";
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

function collectDrawerIdsForDestinations(destinationList) {
  const drawerIds = new Set();
  if (!Array.isArray(destinationList)) return drawerIds;
  for (const destKey of destinationList) {
    if (typeof destKey !== "string" || !destKey.trim()) continue;
    const contract = getFieldContractByDestination(destKey.trim());
    if (contract && typeof contract.drawerId === "string" && contract.drawerId.trim() !== "") {
      drawerIds.add(contract.drawerId.trim());
    }
  }
  return drawerIds;
}

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
  setClientPrevalidationBanner,
  setOpenDrawersById = null
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

  const openDrawersForDestinations = useCallback(
    (destinationKeys) => {
      if (typeof setOpenDrawersById !== "function") return;
      const drawerIds = collectDrawerIdsForDestinations(destinationKeys);
      if (drawerIds.size === 0) return;
      setOpenDrawersById((prev) => {
        const baseMap = prev && typeof prev === "object" ? prev : {};
        let didChange = false;
        const nextMap = { ...baseMap };
        drawerIds.forEach((drawerId) => {
          if (nextMap[drawerId] !== true) {
            nextMap[drawerId] = true;
            didChange = true;
          }
        });
        return didChange ? nextMap : prev;
      });
    },
    [setOpenDrawersById]
  );

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
    const localBlockedFields =
      pendingSub.localBlockedFields &&
      typeof pendingSub.localBlockedFields === "object" &&
      !Array.isArray(pendingSub.localBlockedFields)
        ? { ...pendingSub.localBlockedFields }
        : {};
    const localBlockedKeys = Object.keys(localBlockedFields);

    const recordAbortedSaveReport = (overallOutcome, writerStatus, message, errors) => {
      const mergedErrors = [
        ...localBlockedKeys.map((dest) => ({
          destination: dest,
          message: `[Client Preflight Blocked — Not Sent] ${localBlockedFields[dest]}`
        })),
        ...(Array.isArray(errors) ? errors : [])
      ];

      openDrawersForDestinations([...submittedDestinations, ...localBlockedKeys]);

      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        variantTargetId: submittedVariantTargetId,
        completedAt: new Date().toISOString(),
        overallOutcome,
        writerStatus,
        message,
        submittedDestinations,
        submittedValuesByDestination: submittedValuesByDest,
        verifiedDestinations: [],
        blockedFields: localBlockedFields,
        skippedKeys: [],
        unsupportedKeys: [],
        unchanged: [],
        unresolvedChanges: {},
        conflicts: {},
        errors: mergedErrors,
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
    const serverBlockedFields =
      rawResponse.blockedFields && typeof rawResponse.blockedFields === "object"
        ? rawResponse.blockedFields
        : {};
    const blockedFields = {
      ...localBlockedFields,
      ...serverBlockedFields
    };
    const skippedKeys = Array.isArray(rawResponse.skippedKeys) ? rawResponse.skippedKeys : [];
    const unsupportedKeys = Array.isArray(rawResponse.unsupportedKeys)
      ? rawResponse.unsupportedKeys
      : [];
    const unchangedList = Array.isArray(rawResponse.unchanged) ? rawResponse.unchanged : [];
    const unresolvedChanges =
      rawResponse.unresolvedChanges && typeof rawResponse.unresolvedChanges === "object"
        ? { ...rawResponse.unresolvedChanges }
        : {};
    const conflicts =
      rawResponse.conflicts && typeof rawResponse.conflicts === "object"
        ? { ...rawResponse.conflicts }
        : {};
    const serverErrorsList = Array.isArray(rawResponse.errors)
      ? rawResponse.errors
      : rawResponse.error
        ? [{ message: String(rawResponse.error) }]
        : [];
    const errorsList = [
      ...localBlockedKeys.map((dest) => ({
        destination: dest,
        message: `[Client Preflight Blocked — Not Sent] ${localBlockedFields[dest]}`
      })),
      ...serverErrorsList
    ];
    const readBackVerified = rawResponse.readBackVerified === true;
    const responseVariantTarget =
      rawResponse.primaryVariantId || rawResponse.variantTarget || null;

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

    const canConfirmClientSideVerifiedDest = (vDest) => {
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
          rawResponse.variantMetafieldsReadComplete === true &&
          hasReturnedVariantMetafields &&
          Object.prototype.hasOwnProperty.call(rawResponse.currentVariantMetafields, vDest)
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
      return Boolean(
        hasReturnedProductMetafields &&
        rawResponse.metafieldsReadComplete === true &&
        Object.prototype.hasOwnProperty.call(rawResponse.currentMetafields, vDest)
      );
    };

    const confirmedVerifiedList = verifiedList.filter((vDest) =>
      canConfirmClientSideVerifiedDest(vDest)
    );
    const confirmedVerifiedSet = new Set(confirmedVerifiedList);

    const hasVerifiedNativeDestination = confirmedVerifiedList.some(
      (vDest) =>
        BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(vDest) ||
        vDest === "native_price"
    );

    const unconfirmedDestinations = submittedDestinations.filter(
      (dest) =>
        !confirmedVerifiedSet.has(dest) &&
        !Object.prototype.hasOwnProperty.call(blockedFields, dest) &&
        !Object.prototype.hasOwnProperty.call(unresolvedChanges, dest) &&
        !Object.prototype.hasOwnProperty.call(conflicts, dest) &&
        !skippedKeys.includes(dest) &&
        !unsupportedKeys.includes(dest) &&
        !unchangedList.includes(dest)
    );

    for (const unsupportedDest of unsupportedKeys) {
      if (
        typeof unsupportedDest === "string" &&
        unsupportedDest.trim() !== "" &&
        !Object.prototype.hasOwnProperty.call(blockedFields, unsupportedDest) &&
        !Object.prototype.hasOwnProperty.call(unresolvedChanges, unsupportedDest)
      ) {
        blockedFields[unsupportedDest] =
          "Destination reported as unsupported by the writer endpoint.";
      }
    }

    for (const skippedDest of skippedKeys) {
      if (
        typeof skippedDest === "string" &&
        skippedDest.trim() !== "" &&
        submittedDestinations.includes(skippedDest) &&
        !confirmedVerifiedSet.has(skippedDest) &&
        !Object.prototype.hasOwnProperty.call(blockedFields, skippedDest) &&
        !Object.prototype.hasOwnProperty.call(unresolvedChanges, skippedDest)
      ) {
        unresolvedChanges[skippedDest] = {
          reason: "Destination was skipped by the writer endpoint without saving.",
          expected: submittedValuesByDest[skippedDest] ?? "Submitted proposal",
          actual: "Skipped"
        };
      }
    }

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

        for (const vDest of confirmedVerifiedList) {
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
        confirmedVerifiedSet.has("native_title") &&
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

    if (confirmedVerifiedSet.size > 0) {
      setProposedByProduct((prev) => {
        const prodMap = { ...(prev[submittedProductId] || {}) };
        for (const vDest of confirmedVerifiedSet) {
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
        for (const vDest of confirmedVerifiedSet) {
          const rec = prodApprovals[vDest];
          if (rec && rec.approvedValue === submittedValuesByDest[vDest]) {
            delete prodApprovals[vDest];
          }
        }
        return { ...prev, [submittedProductId]: prodApprovals };
      });
    }

    const nonVerifiedProblemDestinations = [
      ...Object.keys(blockedFields),
      ...Object.keys(unresolvedChanges),
      ...Object.keys(conflicts),
      ...unconfirmedDestinations,
      ...unsupportedKeys,
      ...skippedKeys.filter((k) => submittedDestinations.includes(k) && !confirmedVerifiedSet.has(k))
    ];

    if (nonVerifiedProblemDestinations.length > 0) {
      openDrawersForDestinations(nonVerifiedProblemDestinations);
    }

    const hasAnyBlockedOrUnresolved =
      Object.keys(blockedFields).length > 0 ||
      Object.keys(unresolvedChanges).length > 0 ||
      Object.keys(conflicts).length > 0 ||
      unconfirmedDestinations.length > 0 ||
      unsupportedKeys.length > 0;

    const effectiveOverallOutcome =
      rawResponse.success === true &&
      rawResponse.status === "REPAIRED" &&
      readBackVerified &&
      !hasAnyBlockedOrUnresolved &&
      confirmedVerifiedList.length === submittedDestinations.length
        ? "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
        : confirmedVerifiedList.length > 0
          ? "PARTIAL_OR_UNRESOLVED_WRITE_OUTCOME"
          : "WRITE_FAILED_OR_BLOCKED";

    const effectiveWriterStatus =
      hasAnyBlockedOrUnresolved && confirmedVerifiedList.length > 0
        ? "PARTIAL_SUCCESS"
        : String(rawResponse.status || (rawResponse.success ? "OK" : "FAILED"));

    const serverBaseMsg =
      rawResponse.message ||
      rawResponse.error ||
      "Save finished. Review the field results below.";

    const combinedMessage =
      localBlockedKeys.length > 0
        ? `${serverBaseMsg} (${localBlockedKeys.length} locally blocked field${
            localBlockedKeys.length === 1 ? " was" : "s were"
          } not sent: ${localBlockedKeys.join(", ")}.)`
        : serverBaseMsg;

    setLastSaveReport({
      submissionId: pendingSub.submissionId,
      productId: submittedProductId,
      variantTargetId: submittedVariantTargetId,
      responseVariantTarget,
      completedAt: new Date().toISOString(),
      overallOutcome: effectiveOverallOutcome,
      writerStatus: effectiveWriterStatus,
      message: combinedMessage,
      submittedDestinations,
      submittedValuesByDestination: submittedValuesByDest,
      verifiedDestinations: confirmedVerifiedList,
      blockedFields,
      skippedKeys,
      unsupportedKeys,
      unchanged: unchangedList,
      unresolvedChanges,
      conflicts,
      errors: errorsList,
      unconfirmedDestinations,
      readBackVerified: Boolean(readBackVerified && localBlockedKeys.length === 0)
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
    setApprovalsByProduct,
    openDrawersForDestinations
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
    const localBlockedFields = {};
    const safePlanToSubmit = {};
    const safeNativeChangesToSubmit = {};
    const safeExplicitReferenceReplacementsToSubmit = {};
    let requiredVariantTargetId = null;

    const recordLocalPreflightBlock = (destKey, reasonText) => {
      const cleanReason =
        typeof reasonText === "string" && reasonText.trim() !== ""
          ? reasonText.trim()
          : "Blocked during client prevalidation.";
      localBlockedFields[destKey] = cleanReason;
      prevalidationErrors.push(`[${destKey}] ${cleanReason}`);
    };

    for (const [destKey, approvalRec] of approvalEntries) {
      const contract = getFieldContractByDestination(destKey);
      if (
        !contract ||
        !contract.isWritableInBatch1 ||
        !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)
      ) {
        recordLocalPreflightBlock(
          destKey,
          "Not an eligible writable destination."
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
        recordLocalPreflightBlock(
          destKey,
          "Marked Keep Original; cannot be submitted for Save."
        );
        continue;
      }

      const fidelity = checkExistingWriterStringFidelity(currentProposedValue);
      if (!fidelity.faithful) {
        recordLocalPreflightBlock(destKey, fidelity.reason);
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
        recordLocalPreflightBlock(destKey, validation.reason);
        continue;
      }

      if (validation.isUnchangedFromStored) {
        recordLocalPreflightBlock(
          destKey,
          "Proposed value matches the saved value; uncheck Approve or enter a changed value."
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
        recordLocalPreflightBlock(
          destKey,
          "Approval record is out of date. Please review the value and check Approve again."
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
          recordLocalPreflightBlock(
            destKey,
            "Explicit reference list replacement approval does not match current baseline evidence. Please re-approve before saving."
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
            recordLocalPreflightBlock(
              destKey,
              "Single-variant target identity is not verified for this price approval. Reload product data and re-approve."
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
          recordLocalPreflightBlock(
            destKey,
            "Variant target identity or completeness is not verified for this approval. Reload product data and re-approve."
          );
          continue;
        }

        if (requiredVariantTargetId && requiredVariantTargetId !== baselinePrimaryVariantId) {
          recordLocalPreflightBlock(
            destKey,
            `Conflicting variantTargetId detected across approved variant fields (${requiredVariantTargetId} vs. ${baselinePrimaryVariantId}).`
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

    const submittedDestinations = Object.keys(safePlanToSubmit);
    const localBlockedDestKeys = Object.keys(localBlockedFields);

    if (submittedDestinations.length === 0) {
      if (localBlockedDestKeys.length > 0) {
        const localOnlySubmissionId = `bench_v2_local_blocked_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 8)}`;

        openDrawersForDestinations(localBlockedDestKeys);

        setClientPrevalidationBanner({
          tone: "error",
          title: `Save stopped (${prevalidationErrors.length} issue${
            prevalidationErrors.length === 1 ? "" : "s"
          } found — nothing was sent)`,
          reasons: prevalidationErrors
        });

        setLastSaveReport({
          submissionId: localOnlySubmissionId,
          productId: activeProductId,
          variantTargetId: null,
          responseVariantTarget: null,
          completedAt: new Date().toISOString(),
          overallOutcome: "WRITE_FAILED_OR_BLOCKED",
          writerStatus: "REPAIR_BLOCKED",
          message: `No changes were sent to Shopify because ${localBlockedDestKeys.length} approved field${
            localBlockedDestKeys.length === 1 ? " was" : "s were"
          } blocked during preflight checks (${localBlockedDestKeys.join(", ")}).`,
          submittedDestinations: [],
          submittedValuesByDestination: {},
          verifiedDestinations: [],
          blockedFields: { ...localBlockedFields },
          skippedKeys: [],
          unsupportedKeys: [],
          unchanged: [],
          unresolvedChanges: {},
          conflicts: {},
          errors: localBlockedDestKeys.map((dest) => ({
            destination: dest,
            message: localBlockedFields[dest]
          })),
          unconfirmedDestinations: [],
          readBackVerified: true
        });
        return;
      }

      setClientPrevalidationBanner({
        tone: "warning",
        title: "No eligible approved changes",
        reasons: ["No valid approved changes remained after preflight checks."]
      });
      return;
    }

    if (localBlockedDestKeys.length > 0) {
      openDrawersForDestinations(localBlockedDestKeys);
      setClientPrevalidationBanner({
        tone: "warning",
        title: `Saving ${submittedDestinations.length} valid approved field${
          submittedDestinations.length === 1 ? "" : "s"
        }; ${localBlockedDestKeys.length} blocked field${
          localBlockedDestKeys.length === 1 ? " was" : "s were"
        } held back in Needs Review`,
        reasons: prevalidationErrors
      });
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
      localBlockedFields: { ...localBlockedFields },
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
// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2 (FIRST CONNECTED BATCH)
// File: app/routes/app.bench-v2.jsx
//
// Verified Current Sources Confirmed in Context:
// 1. app/utils/bench-v2.contract.jsx (112,497 chars, SHA256: F31EF4BC321AFC20A3696E53686EAD076D8583B8962D24EA667AC6D7DF144DBA)
// 2. app/utils/bench-v2.baseline.server.jsx (43,102 chars — exports loadSingleProductBaselineSnapshot)
// 3. app/routes/app.meta-injector-api.jsx (138,970 chars — action intent="executeRepairPlan")
// 4. app/routes/app.jsx & app/routes.js (@react-router/fs-routes flatRoutes, v7.16.0)
//
// Interface Verification:
// - loadSingleProductBaselineSnapshot(admin, productId) returns
//   { success, error, baselineSnapshot } where baselineSnapshot contains
//   exact fields consumed by buildBaselineObservation and
//   evaluateDestinationTypeAndCompleteness in bench-v2.contract.jsx:
//   productId, productTitle, productCategory, productCategoryReadComplete,
//   nativeTargets, currentMetafields, currentMetafieldTypes,
//   metafieldsReadComplete, currentVariantMetafields,
//   currentVariantMetafieldTypes, variantMetafieldsReadComplete,
//   liveDefinitions, defsReadComplete, defReadErrors,
//   constraintErrorsByDestination, loadedAt.
//
// Architectural & Safety Guarantees:
// - Sibling route at /app/bench-v2; never calls old whole-inventory loader.
// - Starts with Canyon Red only (gid://shopify/Product/9226849616123).
// - Strictly separates baselineByProduct, proposedByProduct,
//   approvalsByProduct, and keepOriginalByProduct.
// - All 11 drawers and 97 contract fields are inspectable without visibility filters.
// - Gemini connector is explicitly labeled NOT CONNECTED in this batch; zero
//   automatic AI calls or invented request payloads.
// - Reuses existing POST /app/meta-injector-api (intent: "executeRepairPlan").
// - Explicit writer-connection holds for the 4 Batch 1 destinations currently
//   skipped by app/routes/app.meta-injector-api.jsx (custom.is_ooak,
//   custom.cut_and_shape, custom.stone_shape, custom.color): they remain
//   distinct inspectable/draftable Batch 1 fields, but cannot be marked
//   save-ready or silently submitted to executeRepairPlan until the API
//   skip/retirement lists are unlocked in a dedicated step.
// - Prevalidates all approved destinations before submission; any blocked or
//   writer-held approved destination halts the entire save before network POST.
// - Never assumes a failed request meant zero writes; preserves unrelated
//   drafts and reconciles against returned writer evidence and fresh baseline.
// ==========================================================================

import React, { useState, useEffect, useRef } from "react";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { authenticate } from "../shopify.server";
import { loadSingleProductBaselineSnapshot } from "../utils/bench-v2.baseline.server.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_DRAWER_GROUPS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  isExactProductGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  validateBatch1ProposedValue,
  createExactValueApprovalRecord,
  isExactValueApprovalValid,
  createKeepOriginalRecord,
  isKeepOriginalRecordValid,
  evaluateBenchV2FieldRow
} from "../utils/bench-v2.contract.jsx";

export const CANYON_RED_PRODUCT_GID = "gid://shopify/Product/9226849616123";

// Explicit Writer-Connection Holds:
// Verified in retained app/routes/app.meta-injector-api.jsx:
// - custom.cut_and_shape, custom.stone_shape, and custom.color are in RETIRED_KEYS (lines 50-55)
//   and pushed to skippedKeys in executeRepairPlan (line 795).
// - custom.is_ooak is in the companion skip guard in executeRepairPlan (line 801)
//   and pushed to skippedKeys.
// Per scope rules, these 4 fields are NOT retired in the contract, and both OOAK
// destinations remain distinct, but they are held from save-ready status and
// blocked from submission until the shared writer endpoint is explicitly updated.
export const EXISTING_WRITER_CONNECTION_HOLDS = Object.freeze({
  "custom.is_ooak":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (executeRepairPlan line 801) currently pushes custom.is_ooak into skippedKeys. Held from Save until the writer skip guard is unlocked.",
  "custom.cut_and_shape":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.cut_and_shape into skippedKeys. Held from Save until the writer retirement list is updated.",
  "custom.stone_shape":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.stone_shape into skippedKeys. Held from Save until the writer retirement list is updated.",
  "custom.color":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.color into skippedKeys. Held from Save until the writer retirement list is updated."
});

export function isDestinationHeldByExistingWriter(destinationKey) {
  return Boolean(
    typeof destinationKey === "string" &&
      Object.prototype.hasOwnProperty.call(EXISTING_WRITER_CONNECTION_HOLDS, destinationKey)
  );
}

export function getExistingWriterHoldReason(destinationKey) {
  if (!isDestinationHeldByExistingWriter(destinationKey)) return null;
  return EXISTING_WRITER_CONNECTION_HOLDS[destinationKey];
}

// Existing executeRepairPlan in app/routes/app.meta-injector-api.jsx (line 822 & 935)
// applies String(val).trim() when comparing/writing values and strips leading "⚠️"
// via normalizeMetafieldValue (line 262). Since exact-value approval in Bench V2
// forbids silent value rewriting between approvedValue and what the writer stores,
// preflight blocks any proposal that would be altered by the existing writer's
// trim or warning-prefix strip.
export function checkExistingWriterStringFidelity(exactProposedValue) {
  if (typeof exactProposedValue !== "string") {
    return {
      faithful: false,
      reason: "Proposed value must be a string."
    };
  }
  if (exactProposedValue.trim() !== exactProposedValue) {
    return {
      faithful: false,
      reason:
        "Existing writer (executeRepairPlan) trims leading/trailing whitespace on save, which would alter your exact untrimmed value. Remove leading/trailing whitespace before approving for save."
    };
  }
  if (/^⚠️\s*/.test(exactProposedValue)) {
    return {
      faithful: false,
      reason:
        "Existing writer (normalizeMetafieldValue) strips leading '⚠️' prefixes, which would alter your exact approved value. Remove the prefix before approving for save."
    };
  }
  return {
    faithful: true,
    reason: null
  };
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const productId = CANYON_RED_PRODUCT_GID;
  const loadResult = await loadSingleProductBaselineSnapshot(admin, productId);

  return Response.json({
    contractVersion: BENCH_V2_CONTRACT_VERSION,
    targetProductId: productId,
    loadSuccess: Boolean(loadResult?.success),
    loadError: loadResult?.error || null,
    baselineSnapshot: loadResult?.baselineSnapshot || null,
    loadedAt: new Date().toISOString()
  });
};

function formatRawBaselineValueForInspection(baselineObs) {
  if (!baselineObs) return "Unavailable";
  if (!baselineObs.evidenceAvailable) {
    if (baselineObs.presence === "unknown_incomplete_read") {
      return "[UNKNOWN — INCOMPLETE READ (Cannot Infer Absence)]";
    }
    return `[UNAVAILABLE — ${baselineObs.presence}]`;
  }
  if (baselineObs.presence === "absent") {
    return "[ABSENT — Verified Not Set on Product]";
  }
  if (baselineObs.presence === "null") {
    return "[NULL]";
  }
  if (baselineObs.presence === "empty_string") {
    return '[EMPTY STRING ""]';
  }
  const raw = baselineObs.rawValue;
  if (typeof raw === "object" && raw !== null) {
    return JSON.stringify(raw);
  }
  return String(raw);
}

export default function BenchV2Route() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const writerFetcher = useFetcher();

  const activeProductId = CANYON_RED_PRODUCT_GID;

  // 1. Authoritative Baseline State (Strictly separated from proposals)
  const [baselineByProduct, setBaselineByProduct] = useState(() => {
    const initialSnap = loaderData?.baselineSnapshot;
    if (initialSnap && initialSnap.productId === CANYON_RED_PRODUCT_GID) {
      return { [CANYON_RED_PRODUCT_GID]: initialSnap };
    }
    return {};
  });

  // 2. Manual Proposals State (Never pre-seeded from baseline)
  const [proposedByProduct, setProposedByProduct] = useState({});

  // 3. Exact-Value Approval Records State
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 4. Keep Original Decision Records State
  const [keepOriginalByProduct, setKeepOriginalByProduct] = useState({});

  // 5. Save Request Tracking & Honest Outcome Reporting
  const [activeSaveSubmission, setActiveSaveSubmission] = useState(null);
  const [lastSaveReport, setLastSaveReport] = useState(null);
  const [clientPrevalidationBanner, setClientPrevalidationBanner] = useState(null);
  const processedSubmissionIdRef = useRef(null);
  const activeSaveSubmissionRef = useRef(null);

  useEffect(() => {
    activeSaveSubmissionRef.current = activeSaveSubmission;
  }, [activeSaveSubmission]);

  // Synchronize fresh loader baseline snapshots without erasing pending manual drafts.
  // Because approval/Keep Original records are bound to exact baselineSignature in
  // bench-v2.contract.jsx, any destination whose underlying Shopify baseline changed
  // will automatically invalidate its stale approval/Keep Original signature while
  // preserving untouched destinations' drafts and valid approvals.
  useEffect(() => {
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId)) {
      setBaselineByProduct((prev) => ({
        ...prev,
        [snap.productId]: snap
      }));
    }
  }, [loaderData?.baselineSnapshot, loaderData?.loadedAt]);

  const currentBaseline = baselineByProduct[activeProductId] || null;
  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};

  const isWriterBusy = writerFetcher.state !== "idle";
  const isBaselineReloading = revalidator.state !== "idle";

  // Handle writerFetcher completion: match exact productId & submissionId,
  // interpret only actual returned writer outcomes, preserve unrelated drafts,
  // and trigger a fresh baseline revalidation so types/definitions/signatures stay true.
  useEffect(() => {
    if (writerFetcher.state !== "idle") return;
    const pendingSub = activeSaveSubmissionRef.current;
    if (!pendingSub) return;

    const rawResponse = writerFetcher.data;
    if (processedSubmissionIdRef.current === pendingSub.submissionId) {
      return;
    }

    // Even if writerFetcher.data is undefined (e.g., network drop or unhandled 500),
    // never assume failed request means zero writes occurred on Shopify.
    processedSubmissionIdRef.current = pendingSub.submissionId;

    const submittedProductId = pendingSub.productId;
    const submittedDestinations = pendingSub.submittedDestinations || [];
    const submittedValuesByDest = pendingSub.submittedValuesByDestination || {};

    if (!rawResponse || typeof rawResponse !== "object") {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        completedAt: new Date().toISOString(),
        overallOutcome: "UNCONFIRMED_NETWORK_OR_SERVER_FAILURE",
        writerStatus: "NO_RESPONSE_PAYLOAD",
        message:
          "The save request ended without a structured JSON response from /app/meta-injector-api. Do NOT assume zero writes occurred. Reloading live baseline from Shopify to verify actual stored state.",
        submittedDestinations,
        verifiedDestinations: [],
        blockedFields: {},
        skippedKeys: [],
        unsupportedKeys: [],
        unchanged: [],
        unresolvedChanges: {},
        conflicts: {},
        errors: [{ message: "No structured response returned by writer endpoint." }],
        unconfirmedDestinations: [...submittedDestinations],
        readBackVerified: false
      });
      setActiveSaveSubmission(null);
      revalidator.revalidate();
      return;
    }

    const responsePieceId = rawResponse.pieceId || rawResponse.productId || null;
    if (responsePieceId && responsePieceId !== submittedProductId) {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        completedAt: new Date().toISOString(),
        overallOutcome: "MISMATCHED_PRODUCT_RESPONSE_IGNORED",
        writerStatus: String(rawResponse.status || "MISMATCH"),
        message: `Writer response pieceId (${responsePieceId}) did not match submitted productId (${submittedProductId}). Preserving all drafts and reloading live baseline.`,
        submittedDestinations,
        verifiedDestinations: [],
        blockedFields: {},
        skippedKeys: [],
        unsupportedKeys: [],
        unchanged: [],
        unresolvedChanges: {},
        conflicts: {},
        errors: Array.isArray(rawResponse.errors) ? rawResponse.errors : [],
        unconfirmedDestinations: [...submittedDestinations],
        readBackVerified: false
      });
      setActiveSaveSubmission(null);
      revalidator.revalidate();
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

    // Identify any submitted destination that was neither verified, blocked, skipped,
    // unsupported, nor unchanged (e.g. if a mutation failed mid-batch or read-back was incomplete).
    const unconfirmedDestinations = submittedDestinations.filter(
      (dest) =>
        !verifiedSet.has(dest) &&
        !Object.prototype.hasOwnProperty.call(blockedFields, dest) &&
        !skippedKeys.includes(dest) &&
        !unsupportedKeys.includes(dest) &&
        !unchangedList.includes(dest)
    );

    // Reconcile baseline currentMetafields for positively verified destinations
    // if returned by executeRepairPlan, while preserving existing types/definitions
    // and triggering a full loader revalidation for complete fresh evidence.
    if (
      rawResponse.currentMetafields &&
      typeof rawResponse.currentMetafields === "object" &&
      !Array.isArray(rawResponse.currentMetafields)
    ) {
      setBaselineByProduct((prev) => {
        const existingSnap = prev[submittedProductId];
        if (!existingSnap) return prev;
        const updatedMetafields = { ...(existingSnap.currentMetafields || {}) };
        const updatedTypes = { ...(existingSnap.currentMetafieldTypes || {}) };

        for (const vDest of verifiedList) {
          if (Object.prototype.hasOwnProperty.call(rawResponse.currentMetafields, vDest)) {
            updatedMetafields[vDest] = rawResponse.currentMetafields[vDest];
            const liveType = existingSnap.liveDefinitions?.[vDest]?.type || null;
            if (!updatedTypes[vDest] && liveType) {
              updatedTypes[vDest] = liveType;
            }
          }
        }

        return {
          ...prev,
          [submittedProductId]: {
            ...existingSnap,
            currentMetafields: updatedMetafields,
            currentMetafieldTypes: updatedTypes,
            loadedAt: new Date().toISOString()
          }
        };
      });
    }

    // Clear proposals and approvals ONLY for destinations that were positively
    // verified on read-back AND whose current draft still matches the exact value
    // that was submitted (preserving any unrelated drafts or newer edits).
    if (verifiedSet.size > 0) {
      setProposedByProduct((prev) => {
        const prodMap = { ...(prev[submittedProductId] || {}) };
        for (const vDest of verifiedSet) {
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
        "Writer returned response; inspect per-destination outcomes below.",
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
    // Trigger full single-product baseline revalidation so metafieldsReadComplete,
    // currentMetafieldTypes, and liveDefinitions are refreshed from Shopify.
    revalidator.revalidate();
  }, [writerFetcher.state, writerFetcher.data, revalidator]);

  // Manual Proposal Edit Handler:
  // Preserves exact untrimmed string in proposedByProduct and immediately
  // invalidates any prior Approval or Keep Original record for that destination.
  const handleManualProposalChange = (destinationKey, rawNewValue) => {
    setClientPrevalidationBanner(null);
    const exactString = typeof rawNewValue === "string" ? rawNewValue : String(rawNewValue ?? "");

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactString,
        source: "Manual",
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    // Changing a proposal immediately invalidates prior approval and Keep Original
    setApprovalsByProduct((prev) => {
      const prodApprovals = prev[activeProductId];
      if (!prodApprovals || !prodApprovals[destinationKey]) return prev;
      const nextApprovals = { ...prodApprovals };
      delete nextApprovals[destinationKey];
      return { ...prev, [activeProductId]: nextApprovals };
    });

    setKeepOriginalByProduct((prev) => {
      const prodKeep = prev[activeProductId];
      if (!prodKeep || !prodKeep[destinationKey]) return prev;
      const nextKeep = { ...prodKeep };
      delete nextKeep[destinationKey];
      return { ...prev, [activeProductId]: nextKeep };
    });
  };

  // Clear Staged Draft Proposal Handler (Restores row to Unchanged without touching saved baseline)
  const handleClearDraftProposal = (destinationKey) => {
    setClientPrevalidationBanner(null);

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      delete prodMap[destinationKey];
      return { ...prev, [activeProductId]: prodMap };
    });

    setApprovalsByProduct((prev) => {
      const prodApprovals = { ...(prev[activeProductId] || {}) };
      delete prodApprovals[destinationKey];
      return { ...prev, [activeProductId]: prodApprovals };
    });

    setKeepOriginalByProduct((prev) => {
      const prodKeep = { ...(prev[activeProductId] || {}) };
      delete prodKeep[destinationKey];
      return { ...prev, [activeProductId]: prodKeep };
    });
  };

  // Toggle Exact-Value Approval (Mutually exclusive with Keep Original)
  const handleToggleApproval = (destinationKey, currentlyApproved) => {
    setClientPrevalidationBanner(null);

    if (currentlyApproved) {
      setApprovalsByProduct((prev) => {
        const prodApprovals = { ...(prev[activeProductId] || {}) };
        delete prodApprovals[destinationKey];
        return { ...prev, [activeProductId]: prodApprovals };
      });
      return;
    }

    if (isDestinationHeldByExistingWriter(destinationKey)) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: `Cannot Approve Save-Held Destination (${destinationKey})`,
        reasons: [getExistingWriterHoldReason(destinationKey)]
      });
      return;
    }

    const rawEntry = currentProposedMap[destinationKey];
    const exactProposedValue =
      rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
        ? rawEntry.value
        : typeof rawEntry === "string"
          ? rawEntry
          : "";

    const fidelity = checkExistingWriterStringFidelity(exactProposedValue);
    if (!fidelity.faithful) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Exact-Value Fidelity Block on ${destinationKey}`,
        reasons: [fidelity.reason]
      });
      return;
    }

    const created = createExactValueApprovalRecord({
      productId: activeProductId,
      destinationKey,
      proposedValue: exactProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!created.ok || !created.record) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Approval Blocked for ${destinationKey}`,
        reasons: [created.error || "Proposal failed contract validation."]
      });
      return;
    }

    // Mutually exclude Keep Original when approving
    setKeepOriginalByProduct((prev) => {
      const prodKeep = prev[activeProductId];
      if (!prodKeep || !prodKeep[destinationKey]) return prev;
      const nextKeep = { ...prodKeep };
      delete nextKeep[destinationKey];
      return { ...prev, [activeProductId]: nextKeep };
    });

    setApprovalsByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  // Toggle Keep Original Decision (Mutually exclusive with Approve; binds rejected proposal & baseline signature)
  const handleToggleKeepOriginal = (destinationKey, currentlyKeepOriginal) => {
    setClientPrevalidationBanner(null);

    if (currentlyKeepOriginal) {
      setKeepOriginalByProduct((prev) => {
        const prodKeep = { ...(prev[activeProductId] || {}) };
        delete prodKeep[destinationKey];
        return { ...prev, [activeProductId]: prodKeep };
      });
      return;
    }

    const rawEntry = currentProposedMap[destinationKey];
    const exactProposedValue =
      rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
        ? rawEntry.value
        : typeof rawEntry === "string"
          ? rawEntry
          : "";

    const created = createKeepOriginalRecord({
      productId: activeProductId,
      destinationKey,
      rejectedProposedValue: exactProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!created.ok || !created.record) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Keep Original Blocked for ${destinationKey}`,
        reasons: [created.error || "Cannot bind Keep Original record."]
      });
      return;
    }

    // Mutually exclude Approve when selecting Keep Original
    setApprovalsByProduct((prev) => {
      const prodApprovals = prev[activeProductId];
      if (!prodApprovals || !prodApprovals[destinationKey]) return prev;
      const nextApprovals = { ...prodApprovals };
      delete nextApprovals[destinationKey];
      return { ...prev, [activeProductId]: nextApprovals };
    });

    setKeepOriginalByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  // Evaluate all rows across all 11 drawers without visibility filters
  const evaluatedDrawerGroups = BENCH_V2_DRAWER_GROUPS.map((drawer) => {
    const evaluatedRows = drawer.fields.map((fieldContract) => {
      const baseEval = evaluateBenchV2FieldRow({
        productId: activeProductId,
        destinationKey: fieldContract.destinationKey,
        baselineSnapshot: currentBaseline,
        proposedMapForProduct: currentProposedMap,
        approvalsMapForProduct: currentApprovalsMap,
        keepOriginalMapForProduct: currentKeepOriginalMap
      });

      const writerHoldReason = getExistingWriterHoldReason(fieldContract.destinationKey);
      const fidelityCheck =
        baseEval?.hasProposalKey && baseEval.proposedValue !== ""
          ? checkExistingWriterStringFidelity(baseEval.proposedValue)
          : { faithful: true, reason: null };

      // Override connectionStatus and save readiness if held by existing writer skip/retirement list
      let effectiveConnectionStatus = baseEval.connectionStatus;
      let effectiveReviewStatus = baseEval.reviewStatus;
      let effectiveStatusReason = baseEval.statusReason;

      if (fieldContract.isWritableInBatch1 && writerHoldReason) {
        effectiveConnectionStatus =
          "Held (Writer Connection Hold — Skipped by Current /app/meta-injector-api)";
        if (baseEval.hasProposalKey && !baseEval.isKeepOriginal) {
          effectiveReviewStatus = "Draft Staged (Held — Writer Skip Guard Active)";
          effectiveStatusReason = writerHoldReason;
        } else if (!baseEval.hasProposalKey) {
          effectiveStatusReason = `${writerHoldReason} ${fieldContract.purposeNote || ""}`.trim();
        }
      } else if (
        fieldContract.isWritableInBatch1 &&
        baseEval.hasProposalKey &&
        baseEval.validation?.valid &&
        !fidelityCheck.faithful
      ) {
        effectiveReviewStatus = "Blocked Proposal (Writer Trim/Prefix Fidelity)";
        effectiveStatusReason = fidelityCheck.reason;
      }

      return {
        ...baseEval,
        isWriterHeld: Boolean(writerHoldReason),
        writerHoldReason,
        fidelityCheck,
        effectiveConnectionStatus,
        effectiveReviewStatus,
        effectiveStatusReason
      };
    });

    return {
      ...drawer,
      evaluatedRows
    };
  });

  // Summarize current product's Batch 1 review state
  const allEvaluatedRows = evaluatedDrawerGroups.flatMap((d) => d.evaluatedRows);
  const stagedProposalRows = allEvaluatedRows.filter((r) => r.hasProposalKey);
  const validApprovedRows = allEvaluatedRows.filter(
    (r) => r.isApproved && !r.isWriterHeld && r.fidelityCheck.faithful
  );
  const keepOriginalRows = allEvaluatedRows.filter((r) => r.isKeepOriginal);

  // Explicit Save Handler:
  // - Never runs on mount, selection, or edit.
  // - Prevalidates every entry in currentApprovalsMap; if ANY approved entry is
  //   invalid, stale, writer-held, or fails writer string-fidelity, stops the
  //   entire submission rather than silently filtering it out.
  const handleExplicitSaveApprovedChanges = () => {
    setClientPrevalidationBanner(null);

    if (isWriterBusy || activeSaveSubmission) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Save Already in Progress",
        reasons: ["Wait for the current save request to complete before submitting another."]
      });
      return;
    }

    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Prevalidation Blocked: Baseline Not Loaded",
        reasons: ["Live product baseline snapshot is not loaded for Canyon Red."]
      });
      return;
    }

    const approvalEntries = Object.entries(currentApprovalsMap || {});
    if (approvalEntries.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Nothing Approved to Save",
        reasons: [
          "Zero fields have an active exact-value approval record. Edit a connected Batch 1 field and check Approve before clicking Save."
        ]
      });
      return;
    }

    const prevalidationErrors = [];
    const safePlanToSubmit = {};

    for (const [destKey, approvalRec] of approvalEntries) {
      const contract = getFieldContractByDestination(destKey);
      if (!contract || !contract.isWritableInBatch1 || !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)) {
        prevalidationErrors.push(
          `[${destKey}] Not an eligible Batch 1 writable destination.`
        );
        continue;
      }

      if (isDestinationHeldByExistingWriter(destKey)) {
        prevalidationErrors.push(
          `[${destKey}] ${getExistingWriterHoldReason(destKey)}`
        );
        continue;
      }

      const rawPropEntry = currentProposedMap[destKey];
      const currentProposedValue =
        rawPropEntry && typeof rawPropEntry === "object" && typeof rawPropEntry.value === "string"
          ? rawPropEntry.value
          : typeof rawPropEntry === "string"
            ? rawPropEntry
            : "";

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
          `[${destKey}] Proposed value matches the stored baseline value; uncheck Approve or enter a changed value.`
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
          `[${destKey}] Approval record is stale or no longer matches the current untrimmed proposal or baseline signature. Re-review and re-approve.`
        );
        continue;
      }

      safePlanToSubmit[destKey] = validation.normalizedValue;
    }

    // Complete prevalidation gate: if ANY approved entry failed preflight, stop
    // the entire submission (never silently drop a blocked approved field).
    if (prevalidationErrors.length > 0) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Prevalidation Blocked (${prevalidationErrors.length} Approved Field Issue${
          prevalidationErrors.length === 1 ? "" : "s"
        } — Zero Writes Sent)`,
        reasons: prevalidationErrors
      });
      return;
    }

    const submittedDestinations = Object.keys(safePlanToSubmit);
    if (submittedDestinations.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "No Eligible Approved Changes",
        reasons: ["No valid approved changes remained after preflight checks."]
      });
      return;
    }

    const submissionId = `bench_v2_save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const submissionMeta = {
      submissionId,
      productId: activeProductId,
      submittedDestinations,
      submittedValuesByDestination: { ...safePlanToSubmit },
      startedAt: new Date().toISOString()
    };

    setActiveSaveSubmission(submissionMeta);

    const formData = new FormData();
    formData.append("intent", "executeRepairPlan");
    formData.append("pieceId", activeProductId);
    formData.append("repairPlan", JSON.stringify(safePlanToSubmit));
    formData.append("nativeChanges", JSON.stringify({}));
    formData.append("legacyKeysToRemove", JSON.stringify([]));

    writerFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-api"
    });
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        minHeight: "100vh",
        padding: "20px 24px 64px 24px",
        lineHeight: 1.5
      }}
    >
      {/* TOP BENCH HEADER & SUB-HARNESS CONNECTION STATUS BAR */}
      <div
        style={{
          backgroundColor: "#ffffff",
          border: "2px solid #cbd5e1",
          borderRadius: "8px",
          padding: "16px 20px",
          marginBottom: "18px"
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "16px"
          }}
        >
          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 700 }}>
              Rockhound Studio — Replacement Bench V2 (Batch 1 Connected Harness)
            </h1>
            <div style={{ fontSize: "14px", color: "#334155" }}>
              <strong>Target Product:</strong>{" "}
              {currentBaseline?.productTitle
                ? `${currentBaseline.productTitle} (${activeProductId})`
                : `Canyon Red (${activeProductId})`}
            </div>
            <div style={{ fontSize: "13px", color: "#475569", marginTop: "4px" }}>
              <strong>Contract Version:</strong> {BENCH_V2_CONTRACT_VERSION} |{" "}
              <strong>Baseline Loaded At:</strong> {currentBaseline?.loadedAt || "Not loaded"} |{" "}
              <strong>Product Category:</strong>{" "}
              {currentBaseline?.productCategory?.fullName
                ? `${currentBaseline.productCategory.fullName} (${currentBaseline.productCategory.id})`
                : "None / Unassigned"}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => revalidator.revalidate()}
              disabled={isBaselineReloading || isWriterBusy}
              style={{
                padding: "8px 14px",
                fontSize: "14px",
                fontWeight: 600,
                backgroundColor: "#f1f5f9",
                color: "#0f172a",
                border: "1px solid #94a3b8",
                borderRadius: "6px",
                cursor: isBaselineReloading || isWriterBusy ? "not-allowed" : "pointer"
              }}
            >
              {isBaselineReloading ? "Reloading Live Baseline..." : "Reload Live Baseline"}
            </button>

            <button
              type="button"
              onClick={handleExplicitSaveApprovedChanges}
              disabled={isWriterBusy || isBaselineReloading || validApprovedRows.length === 0}
              style={{
                padding: "8px 16px",
                fontSize: "14px",
                fontWeight: 700,
                backgroundColor:
                  isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
                    ? "#cbd5e1"
                    : "#15803d",
                color:
                  isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
                    ? "#475569"
                    : "#ffffff",
                border: "1px solid #166534",
                borderRadius: "6px",
                cursor:
                  isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
                    ? "not-allowed"
                    : "pointer"
              }}
            >
              {isWriterBusy
                ? "Submitting to /app/meta-injector-api..."
                : `Save Approved Changes (${validApprovedRows.length})`}
            </button>
          </div>
        </div>

        {/* SUB-HARNESS & CONNECTOR STATUS PILLS */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "10px",
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: "1px solid #e2e8f0",
            fontSize: "13px"
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor:
                currentBaseline?.metafieldsReadComplete === true &&
                currentBaseline?.defsReadComplete === true
                  ? "#f0fdf4"
                  : "#fef2f2",
              border:
                currentBaseline?.metafieldsReadComplete === true &&
                currentBaseline?.defsReadComplete === true
                  ? "1px solid #86efac"
                  : "1px solid #fca5a5"
            }}
          >
            <strong>1. Single-Product Baseline Loader:</strong>{" "}
            {currentBaseline
              ? `metafieldsReadComplete=${String(
                  currentBaseline.metafieldsReadComplete
                )} | defsReadComplete=${String(
                  currentBaseline.defsReadComplete
                )} | nativeComplete=${String(currentBaseline.nativeTargets?.isComplete)}`
              : "Not Loaded"}
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: "#eff6ff",
              border: "1px solid #93c5fd"
            }}
          >
            <strong>2. Batch 1 Manual / Approval / Writer Spine:</strong> Connected to{" "}
            <code>POST /app/meta-injector-api</code> (<code>executeRepairPlan</code>).{" "}
            <span>
              Staged: <strong>{stagedProposalRows.length}</strong> | Approved Save-Ready:{" "}
              <strong>{validApprovedRows.length}</strong> | Keep Original:{" "}
              <strong>{keepOriginalRows.length}</strong>
            </span>
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: "#f8fafc",
              border: "1px solid #94a3b8",
              color: "#475569"
            }}
          >
            <strong>3. Gemini AI Autofill Connector:</strong>{" "}
            <span style={{ fontWeight: 700, color: "#b45309" }}>
              NOT CONNECTED IN THIS BATCH
            </span>{" "}
            (No automatic or manual AI requests are issued from this file yet.)
          </div>

          <div
            style={{
              padding: "8px 12px",
              borderRadius: "6px",
              backgroundColor: "#fffbeb",
              border: "1px solid #fde68a",
              color: "#92400e"
            }}
          >
            <strong>4. Reference Product Selector:</strong> Locked to{" "}
            <strong>Canyon Red</strong> (<code>{CANYON_RED_PRODUCT_GID}</code>) for Batch 1.
            Other reference products will be added only with verified GIDs.
          </div>
        </div>

        {/* EXPLICIT NOTICE OF WRITER-CONNECTION HOLDS & STONE FAMILY RULE CONTEXT */}
        <div
          style={{
            marginTop: "12px",
            padding: "10px 12px",
            backgroundColor: "#fff7ed",
            border: "1px solid #fdba74",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#7c2d12"
          }}
        >
          <div>
            <strong>Explicit Writer-Connection Holds (4 Batch 1 Fields):</strong>{" "}
            <code>custom.is_ooak</code>, <code>custom.cut_and_shape</code>,{" "}
            <code>custom.stone_shape</code>, and <code>custom.color</code> are active Batch 1
            contract fields (and <code>custom.is_ooak</code> +{" "}
            <code>custom.is_one_of_a_kind</code> remain distinct intentional OOAK destinations),
            but existing <code>/app/meta-injector-api</code> currently skips them in{" "}
            <code>executeRepairPlan</code>. They are explicitly held from Save-Ready status in
            this UI until the shared writer skip/retirement lists are unlocked.
          </div>
          <div style={{ marginTop: "4px" }}>
            <strong>Stone Family vs. Dominant Material Context:</strong>{" "}
            <code>custom.stone_family</code> (base family, e.g., <em>Red Jasper</em> &rarr;{" "}
            <em>Jasper</em>; held read-only in Batch 1) and <code>custom.material</code>{" "}
            (Dominant Material) are distinct facts. Stored baselines are displayed verbatim
            without rewriting or auto-populating <code>custom.material</code> from{" "}
            <code>custom.stone_family</code>.
          </div>
        </div>
      </div>

      {/* LOADER ERROR BANNER (IF ANY) */}
      {(loaderData?.loadError || (currentBaseline?.errors && currentBaseline.errors.length > 0)) && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "2px solid #ef4444",
            borderRadius: "8px",
            padding: "14px 18px",
            marginBottom: "18px",
            color: "#7f1d1d"
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>
            Baseline Read Warning / Incomplete Evidence Detected
          </div>
          {loaderData?.loadError && <div>{loaderData.loadError}</div>}
          {Array.isArray(currentBaseline?.errors) &&
            currentBaseline.errors.map((errMsg, idx) => (
              <div key={idx} style={{ fontSize: "13px", marginTop: "4px" }}>
                &bull; {errMsg}
              </div>
            ))}
        </div>
      )}

      {/* CLIENT PREVALIDATION BANNER */}
      {clientPrevalidationBanner && (
        <div
          style={{
            backgroundColor:
              clientPrevalidationBanner.tone === "error" ? "#fef2f2" : "#fffbeb",
            border:
              clientPrevalidationBanner.tone === "error"
                ? "2px solid #dc2626"
                : "2px solid #d97706",
            borderRadius: "8px",
            padding: "14px 18px",
            marginBottom: "18px",
            color: clientPrevalidationBanner.tone === "error" ? "#7f1d1d" : "#78350f"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <strong style={{ fontSize: "15px" }}>{clientPrevalidationBanner.title}</strong>
            <button
              type="button"
              onClick={() => setClientPrevalidationBanner(null)}
              style={{
                background: "transparent",
                border: "1px solid currentColor",
                borderRadius: "4px",
                padding: "2px 8px",
                cursor: "pointer",
                fontSize: "12px"
              }}
            >
              Dismiss
            </button>
          </div>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", fontSize: "13px" }}>
            {clientPrevalidationBanner.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* HONEST WRITER OUTCOME & READ-BACK REPORT */}
      {lastSaveReport && (
        <div
          style={{
            backgroundColor:
              lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                ? "#f0fdf4"
                : "#fef2f2",
            border:
              lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                ? "2px solid #16a34a"
                : "2px solid #dc2626",
            borderRadius: "8px",
            padding: "16px 20px",
            marginBottom: "18px",
            fontSize: "13px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px"
            }}
          >
            <div>
              <div style={{ fontSize: "15px", fontWeight: 700 }}>
                Last Save Outcome: {lastSaveReport.overallOutcome} (Writer Status:{" "}
                {lastSaveReport.writerStatus})
              </div>
              <div style={{ marginTop: "4px", color: "#334155" }}>
                <strong>Submission ID:</strong> {lastSaveReport.submissionId} |{" "}
                <strong>Completed At:</strong> {lastSaveReport.completedAt} |{" "}
                <strong>Read-Back Verified Flag:</strong>{" "}
                {String(lastSaveReport.readBackVerified)}
              </div>
              <div style={{ marginTop: "4px", fontWeight: 600 }}>{lastSaveReport.message}</div>
            </div>
            <button
              type="button"
              onClick={() => setLastSaveReport(null)}
              style={{
                padding: "4px 10px",
                fontSize: "12px",
                borderRadius: "4px",
                border: "1px solid #64748b",
                backgroundColor: "#ffffff",
                cursor: "pointer"
              }}
            >
              Close Report
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "10px",
              marginTop: "12px"
            }}
          >
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1"
              }}
            >
              <strong>Submitted ({lastSaveReport.submittedDestinations.length}):</strong>{" "}
              {lastSaveReport.submittedDestinations.length > 0
                ? lastSaveReport.submittedDestinations.join(", ")
                : "None"}
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #86efac"
              }}
            >
              <strong>
                Verified on Read-Back ({lastSaveReport.verifiedDestinations.length}):
              </strong>{" "}
              {lastSaveReport.verifiedDestinations.length > 0
                ? lastSaveReport.verifiedDestinations.join(", ")
                : "None"}
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #fca5a5"
              }}
            >
              <strong>
                Skipped by Writer ({lastSaveReport.skippedKeys.length}):
              </strong>{" "}
              {lastSaveReport.skippedKeys.length > 0
                ? lastSaveReport.skippedKeys.join(", ")
                : "None"}
            </div>

            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "8px 10px",
                borderRadius: "6px",
                border: "1px solid #fca5a5"
              }}
            >
              <strong>
                Unconfirmed ({lastSaveReport.unconfirmedDestinations.length}):
              </strong>{" "}
              {lastSaveReport.unconfirmedDestinations.length > 0
                ? lastSaveReport.unconfirmedDestinations.join(", ")
                : "None"}
            </div>
          </div>

          {Object.keys(lastSaveReport.blockedFields || {}).length > 0 && (
            <div style={{ marginTop: "10px", color: "#991b1b" }}>
              <strong>Blocked by Writer:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {Object.entries(lastSaveReport.blockedFields).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: {String(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(lastSaveReport.unresolvedChanges || {}).length > 0 && (
            <div style={{ marginTop: "10px", color: "#991b1b" }}>
              <strong>Unresolved / Read-Back Mismatches:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {Object.entries(lastSaveReport.unresolvedChanges).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: {JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(lastSaveReport.errors) && lastSaveReport.errors.length > 0 && (
            <div style={{ marginTop: "10px", color: "#991b1b" }}>
              <strong>Writer Errors:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {lastSaveReport.errors.map((errObj, i) => (
                  <li key={i}>
                    {errObj?.destination ? `[${errObj.destination}] ` : ""}
                    {errObj?.message || JSON.stringify(errObj)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ALL 11 DRAWERS — ALWAYS MOUNTED & INSPECTABLE WITHOUT VISIBILITY FILTERS */}
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {evaluatedDrawerGroups.map((drawer) => {
          const drawerApprovedCount = drawer.evaluatedRows.filter(
            (r) => r.isApproved && !r.isWriterHeld && r.fidelityCheck.faithful
          ).length;
          const drawerStagedCount = drawer.evaluatedRows.filter(
            (r) => r.hasProposalKey
          ).length;

          return (
            <details
              key={drawer.drawerId}
              open={drawer.drawerNumber <= 4}
              style={{
                backgroundColor: "#ffffff",
                border: drawer.isImplementedInBatch1
                  ? "2px solid #94a3b8"
                  : "1px solid #cbd5e1",
                borderRadius: "8px",
                overflow: "hidden"
              }}
            >
              <summary
                style={{
                  padding: "14px 18px",
                  backgroundColor: drawer.isImplementedInBatch1 ? "#f1f5f9" : "#f8fafc",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "16px",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: "1px solid #e2e8f0"
                }}
              >
                <div>
                  <span>{drawer.heading}</span>{" "}
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      marginLeft: "8px",
                      backgroundColor: drawer.isImplementedInBatch1 ? "#dcfce7" : "#e2e8f0",
                      color: drawer.isImplementedInBatch1 ? "#166534" : "#475569"
                    }}
                  >
                    {drawer.batchStage} ({drawer.evaluatedRows.length} fields)
                  </span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#334155" }}>
                  Staged: <strong>{drawerStagedCount}</strong> | Approved Save-Ready:{" "}
                  <strong>{drawerApprovedCount}</strong>
                </div>
              </summary>

              <div style={{ padding: "12px 18px" }}>
                <div
                  style={{
                    fontSize: "13px",
                    color: "#475569",
                    marginBottom: "12px"
                  }}
                >
                  {drawer.description}
                </div>

                {/* PER-IMAGE NATIVE MEDIA ALT BASELINE INSPECTION IN DRAWER 9 */}
                {drawer.drawerId === "native_seo_description_media" &&
                  Array.isArray(currentBaseline?.nativeTargets?.media?.edges) && (
                    <div
                      style={{
                        marginBottom: "14px",
                        padding: "10px 12px",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        fontSize: "13px"
                      }}
                    >
                      <strong>
                        Loaded Product MediaImage Baselines (
                        {currentBaseline.nativeTargets.media.edges.length} images — Read-Only
                        in Batch 1):
                      </strong>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                          gap: "8px",
                          marginTop: "8px"
                        }}
                      >
                        {currentBaseline.nativeTargets.media.edges.map(({ node }, idx) => (
                          <div
                            key={node.id || idx}
                            style={{
                              padding: "6px 8px",
                              backgroundColor: "#ffffff",
                              border: "1px solid #e2e8f0",
                              borderRadius: "4px"
                            }}
                          >
                            <div style={{ fontSize: "11px", color: "#64748b" }}>
                              <code>{node.id}</code>
                            </div>
                            <div style={{ marginTop: "2px" }}>
                              <strong>Saved Alt:</strong>{" "}
                              {node.alt ? (
                                <span>{node.alt}</span>
                              ) : (
                                <span style={{ color: "#94a3b8" }}>[Empty / None]</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "13px",
                      textAlign: "left"
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f8fafc",
                          borderBottom: "2px solid #cbd5e1"
                        }}
                      >
                        <th style={{ padding: "8px 10px", width: "22%" }}>
                          Field &amp; Destination Contract
                        </th>
                        <th style={{ padding: "8px 10px", width: "18%" }}>
                          Connection &amp; Type Evidence
                        </th>
                        <th style={{ padding: "8px 10px", width: "20%" }}>
                          Saved Baseline (Read-Only)
                        </th>
                        <th style={{ padding: "8px 10px", width: "22%" }}>
                          Staged Proposal (Manual Draft)
                        </th>
                        <th style={{ padding: "8px 10px", width: "18%" }}>
                          Explicit Decision &amp; Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {drawer.evaluatedRows.map((row) => {
                        const {
                          contract,
                          baselineObservation: obs,
                          baselineDisplayValue,
                          options,
                          hasProposalKey,
                          proposedValue,
                          proposedDisplayValue,
                          validation,
                          isApproved,
                          isKeepOriginal,
                          isWriterHeld,
                          fidelityCheck,
                          effectiveConnectionStatus,
                          effectiveReviewStatus,
                          effectiveStatusReason
                        } = row;

                        const isOoakRow =
                          contract.destinationKey === "custom.is_ooak" ||
                          contract.destinationKey === "custom.is_one_of_a_kind";

                        const canEditDraftInBatch1 =
                          contract.isWritableInBatch1 && obs.evidenceAvailable;

                        const canApproveForSave =
                          contract.isWritableInBatch1 &&
                          !isWriterHeld &&
                          hasProposalKey &&
                          Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
                          fidelityCheck.faithful;

                        const canSelectKeepOriginal =
                          contract.isWritableInBatch1 &&
                          hasProposalKey &&
                          obs.evidenceAvailable &&
                          proposedValue.trim() !== "" &&
                          !(obs.presence === "present" && obs.rawValue === proposedValue);

                        let rowBg = "#ffffff";
                        if (isApproved && !isWriterHeld) rowBg = "#f0fdf4";
                        else if (isKeepOriginal) rowBg = "#f8fafc";
                        else if (hasProposalKey && (!validation?.valid || !fidelityCheck.faithful || isWriterHeld))
                          rowBg = "#fff7ed";
                        else if (hasProposalKey) rowBg = "#eff6ff";

                        return (
                          <tr
                            key={contract.destinationKey}
                            style={{
                              borderBottom: "1px solid #e2e8f0",
                              backgroundColor: rowBg,
                              verticalAlign: "top"
                            }}
                          >
                            {/* 1. FIELD & DESTINATION CONTRACT */}
                            <td style={{ padding: "10px" }}>
                              <div style={{ fontWeight: 700, color: "#0f172a" }}>
                                {contract.label}
                              </div>
                              <div style={{ fontSize: "12px", color: "#475569" }}>
                                <code>{contract.destinationKey}</code> ({contract.owner})
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#64748b",
                                  marginTop: "2px"
                                }}
                              >
                                Allowed Type(s):{" "}
                                <code>{(contract.allowedTypes || [contract.expectedType]).join(" | ")}</code>
                                {contract.maxLength ? ` (max ${contract.maxLength} chars)` : ""}
                              </div>
                            </td>

                            {/* 2. CONNECTION & TYPE EVIDENCE */}
                            <td style={{ padding: "10px" }}>
                              <div
                                style={{
                                  fontWeight: 600,
                                  color: isWriterHeld
                                    ? "#b45309"
                                    : effectiveConnectionStatus.startsWith("Connected")
                                      ? "#15803d"
                                      : effectiveConnectionStatus.startsWith("Blocked")
                                        ? "#b91c1c"
                                        : "#475569"
                                }}
                              >
                                {effectiveConnectionStatus}
                              </div>
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "#475569",
                                  marginTop: "4px"
                                }}
                              >
                                <div>
                                  <strong>Live Def Type:</strong>{" "}
                                  <code>{obs.liveDefType || "none"}</code>
                                </div>
                                <div>
                                  <strong>Stored Type:</strong>{" "}
                                  <code>{obs.storedType || "none"}</code>
                                </div>
                                <div>
                                  <strong>Completeness:</strong> mf={obs.metafieldsCompleteState},
                                  defs={obs.defsCompleteState}
                                </div>
                              </div>
                            </td>

                            {/* 3. SAVED BASELINE (STRICTLY READ-ONLY) */}
                            <td style={{ padding: "10px" }}>
                              <div
                                style={{
                                  fontFamily: "monospace",
                                  fontSize: "12px",
                                  padding: "6px 8px",
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "4px",
                                  wordBreak: "break-word",
                                  whiteSpace: "pre-wrap"
                                }}
                              >
                                {formatRawBaselineValueForInspection(obs)}
                              </div>
                              {isOoakRow && obs.presence === "present" && (
                                <div
                                  style={{
                                    fontSize: "11px",
                                    color: "#334155",
                                    marginTop: "4px"
                                  }}
                                >
                                  <strong>Display Convention:</strong> {baselineDisplayValue}
                                </div>
                              )}
                            </td>

                            {/* 4. STAGED PROPOSAL (MANUAL DRAFT INPUT FOR BATCH 1) */}
                            <td style={{ padding: "10px" }}>
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
                                      disabled={!canEditDraftInBatch1 || isWriterBusy}
                                      onChange={(e) => {
                                        if (e.target.value === "") return;
                                        handleManualProposalChange(
                                          contract.destinationKey,
                                          e.target.value
                                        );
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "5px 6px",
                                        marginBottom: "6px",
                                        fontSize: "12px",
                                        border: "1px solid #94a3b8",
                                        borderRadius: "4px",
                                        backgroundColor: "#ffffff"
                                      }}
                                    >
                                      <option value="">
                                        -- Select Verified Option ({options.length}) --
                                      </option>
                                      {options.map((opt, idx) => {
                                        const optVal =
                                          typeof opt === "object"
                                            ? opt.value ?? opt.label
                                            : String(opt);
                                        const optLabel =
                                          typeof opt === "object"
                                            ? `${opt.label} (stores: "${opt.value}")`
                                            : String(opt);
                                        return (
                                          <option key={`${optVal}_${idx}`} value={optVal}>
                                            {optLabel}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  )}

                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <input
                                      type="text"
                                      aria-label={`Manual proposal for ${contract.destinationKey}`}
                                      value={proposedValue}
                                      disabled={!canEditDraftInBatch1 || isWriterBusy}
                                      placeholder={
                                        canEditDraftInBatch1
                                          ? "Enter exact proposed value..."
                                          : "Baseline evidence incomplete — editing locked"
                                      }
                                      onChange={(e) =>
                                        handleManualProposalChange(
                                          contract.destinationKey,
                                          e.target.value
                                        )
                                      }
                                      style={{
                                        flex: 1,
                                        padding: "6px 8px",
                                        fontSize: "13px",
                                        fontFamily: "monospace",
                                        border: "1px solid #64748b",
                                        borderRadius: "4px"
                                      }}
                                    />
                                    {hasProposalKey && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleClearDraftProposal(contract.destinationKey)
                                        }
                                        disabled={isWriterBusy}
                                        style={{
                                          padding: "4px 8px",
                                          fontSize: "12px",
                                          backgroundColor: "#f1f5f9",
                                          border: "1px solid #94a3b8",
                                          borderRadius: "4px",
                                          cursor: "pointer"
                                        }}
                                      >
                                        Clear Draft
                                      </button>
                                    )}
                                  </div>

                                  {isOoakRow && hasProposalKey && proposedValue !== "" && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#334155",
                                        marginTop: "4px"
                                      }}
                                    >
                                      <strong>Staged Display:</strong> {proposedDisplayValue} |{" "}
                                      <strong>Exact Stored Literal:</strong>{" "}
                                      <code>"{proposedValue}"</code>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div
                                  style={{
                                    fontSize: "12px",
                                    color: "#64748b",
                                    fontStyle: "italic"
                                  }}
                                >
                                  No editable control in Batch 1 ({contract.writeCapability})
                                </div>
                              )}
                            </td>

                            {/* 5. EXPLICIT DECISION (APPROVE / KEEP ORIGINAL) & STATUS */}
                            <td style={{ padding: "10px" }}>
                              {contract.isWritableInBatch1 ? (
                                <div
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "6px"
                                  }}
                                >
                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      cursor:
                                        (canApproveForSave || isApproved) && !isWriterBusy
                                          ? "pointer"
                                          : "not-allowed",
                                      opacity:
                                        canApproveForSave || isApproved ? 1 : 0.55,
                                      fontWeight: isApproved ? 700 : 500,
                                      color: isApproved ? "#15803d" : "#0f172a"
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(isApproved && !isWriterHeld)}
                                      disabled={
                                        isWriterBusy || (!canApproveForSave && !isApproved)
                                      }
                                      onChange={() =>
                                        handleToggleApproval(
                                          contract.destinationKey,
                                          Boolean(isApproved && !isWriterHeld)
                                        )
                                      }
                                    />
                                    <span>
                                      {isWriterHeld
                                        ? "Approve (Held — Writer Skip Guard)"
                                        : "Approve Exact Value"}
                                    </span>
                                  </label>

                                  <label
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      cursor:
                                        (canSelectKeepOriginal || isKeepOriginal) &&
                                        !isWriterBusy
                                          ? "pointer"
                                          : "not-allowed",
                                      opacity:
                                        canSelectKeepOriginal || isKeepOriginal ? 1 : 0.55,
                                      fontWeight: isKeepOriginal ? 700 : 500,
                                      color: isKeepOriginal ? "#334155" : "#0f172a"
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={Boolean(isKeepOriginal)}
                                      disabled={
                                        isWriterBusy ||
                                        (!canSelectKeepOriginal && !isKeepOriginal)
                                      }
                                      onChange={() =>
                                        handleToggleKeepOriginal(
                                          contract.destinationKey,
                                          Boolean(isKeepOriginal)
                                        )
                                      }
                                    />
                                    <span>Keep Original (Reject Proposal)</span>
                                  </label>

                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      marginTop: "2px",
                                      color:
                                        isApproved && !isWriterHeld
                                          ? "#15803d"
                                          : effectiveReviewStatus.startsWith("Blocked") ||
                                              isWriterHeld
                                            ? "#b45309"
                                            : "#334155"
                                    }}
                                  >
                                    {effectiveReviewStatus}
                                  </div>
                                  {effectiveStatusReason && (
                                    <div style={{ fontSize: "11px", color: "#475569" }}>
                                      {effectiveStatusReason}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 600,
                                      color: "#475569"
                                    }}
                                  >
                                    {effectiveReviewStatus}
                                  </div>
                                  {effectiveStatusReason && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#64748b",
                                        marginTop: "2px"
                                      }}
                                    >
                                      {effectiveStatusReason}
                                    </div>
                                  )}
                                  {contract.unresolvedPolicyQuestion && (
                                    <div
                                      style={{
                                        fontSize: "11px",
                                        color: "#b45309",
                                        marginTop: "4px"
                                      }}
                                    >
                                      <strong>Policy Note:</strong>{" "}
                                      {contract.unresolvedPolicyQuestion}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
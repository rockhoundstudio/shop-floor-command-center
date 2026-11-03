// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 STANDARDIZED REFERENCE LOADER (CLIENT MODULE)
// File: app/utils/bench-v2.reference-loader.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (Step 1 of bounded extraction).
// Contains factual baseline context signature & attempt-key helpers,
// authoritative destination-policy resolution, pure response evaluation,
// the reusable client-safe useStandardizedReferenceChoiceLoader hook, and the
// backward-compatible useBenchV2StandardizedReferenceLoader wrapper for
// automatic once-per-factual-context and explicit retry read-only standardized
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

const DEFAULT_REFERENCE_CHOICES_ACTION_PATH = "/app/meta-injector-api";
const DEFAULT_REFERENCE_CHOICES_REQUEST_PREFIX = "bench_v2_refchoices";

const AUTHORITATIVE_SUPPORTED_BARE_KEY_SET = new Set(
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS
);

/**
 * Resolves and validates requested standardized reference keys against the
 * authoritative supported destination policy.
 * - Omitted/null/undefined defaults to the full authoritative 18-key set.
 * - Provided arrays may only narrow the authoritative set; any empty or
 *   unsupported key is rejected (`ok: false`) and never broadens permissions.
 */
export function resolveSupportedDestinationKeys(requestedKeys = null) {
  if (requestedKeys === undefined || requestedKeys === null) {
    const bareKeys = [...SUPPORTED_STANDARDIZED_REFERENCE_KEYS];
    const destinationKeys = bareKeys.map((k) => `shopify.${k}`);
    return {
      ok: true,
      bareKeys,
      destinationKeys,
      destinationSet: new Set(destinationKeys),
      rejectedKeys: [],
      error: null
    };
  }

  if (!Array.isArray(requestedKeys) || requestedKeys.length === 0) {
    return {
      ok: false,
      bareKeys: [],
      destinationKeys: [],
      destinationSet: new Set(),
      rejectedKeys: [],
      error:
        "Requested standardized reference destinations must be a non-empty array of supported shopify.* keys."
    };
  }

  const requestedBareSet = new Set();
  const rejectedKeys = [];

  for (const rawItem of requestedKeys) {
    if (typeof rawItem !== "string" || rawItem.trim() === "") {
      rejectedKeys.push(String(rawItem));
      continue;
    }
    const trimmed = rawItem.trim();
    const bareKey = trimmed.startsWith("shopify.") ? trimmed.slice(8) : trimmed;
    const destKey = `shopify.${bareKey}`;

    if (
      !AUTHORITATIVE_SUPPORTED_BARE_KEY_SET.has(bareKey) ||
      !BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(destKey)
    ) {
      rejectedKeys.push(trimmed);
      continue;
    }
    requestedBareSet.add(bareKey);
  }

  if (rejectedKeys.length > 0 || requestedBareSet.size === 0) {
    return {
      ok: false,
      bareKeys: [],
      destinationKeys: [],
      destinationSet: new Set(),
      rejectedKeys,
      error:
        rejectedKeys.length > 0
          ? `Rejected unsupported standardized reference destination(s): ${rejectedKeys.join(", ")}.`
          : "No supported standardized reference destinations remained after filtering."
    };
  }

  const orderedBareKeys = SUPPORTED_STANDARDIZED_REFERENCE_KEYS.filter((k) =>
    requestedBareSet.has(k)
  );
  const orderedDestinationKeys = orderedBareKeys.map((k) => `shopify.${k}`);

  return {
    ok: true,
    bareKeys: orderedBareKeys,
    destinationKeys: orderedDestinationKeys,
    destinationSet: new Set(orderedDestinationKeys),
    rejectedKeys: [],
    error: null
  };
}

export function buildStandardizedBaselineContextSignature(
  baselineSnap,
  supportedBareKeys = SUPPORTED_STANDARDIZED_REFERENCE_KEYS
) {
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

  const keysToInspect =
    Array.isArray(supportedBareKeys) && supportedBareKeys.length > 0
      ? supportedBareKeys.filter((k) => AUTHORITATIVE_SUPPORTED_BARE_KEY_SET.has(k))
      : SUPPORTED_STANDARDIZED_REFERENCE_KEYS;

  const perDestParts = keysToInspect
    .map((k) => {
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
    })
    .join("|");

  return `${productId}::${catState}:${catId}:${catFullName}::${mfComplete}::${defsComplete}::${catComplete}::${mfReadErr}::${defReadErrs}::${topErrs}::${perDestParts}`;
}

export function buildAutoRefChoicesAttemptKey(
  benchSessionId,
  productId,
  baselineContextSig
) {
  return `${String(benchSessionId || "")}::${String(productId || "")}::${String(baselineContextSig || "")}`;
}

/**
 * Pure, deterministic evaluator for a completed `resolveStandardizedCandidates`
 * response. Enforces all mandatory request/session/product/category/baseline
 * freshness checks, global prerequisite checks, unscoped vs. scoped `[shopify.*]`
 * error partitioning, and per-destination restricted MetaobjectDefinition &
 * entry membership verification.
 */
export function evaluateStandardizedReferenceChoicesResponse({
  rawResponse,
  pendingReq,
  currentSessionId,
  latestBaseline,
  latestContextSig,
  productTitle,
  supportedKeys = null,
  actionPath = DEFAULT_REFERENCE_CHOICES_ACTION_PATH,
  completedAt = null
}) {
  const reqId = pendingReq?.requestId || null;
  const reqSessionId =
    pendingReq?.sessionId ?? pendingReq?.benchSessionId ?? null;
  const reqProductId = pendingReq?.productId || null;
  const reqBaselineContextSig = pendingReq?.baselineContextSig || null;
  const reqCategoryId = pendingReq?.productCategoryId ?? null;
  const finishedAt = completedAt || new Date().toISOString();

  const makeFailureRecord = (stateTag, summary, errorsList = []) => ({
    requestId: reqId,
    sessionId: reqSessionId,
    benchSessionId: reqSessionId,
    productId: reqProductId,
    baselineContextSig: reqBaselineContextSig,
    productCategoryId: reqCategoryId,
    completedAt: finishedAt,
    ok: false,
    state: stateTag,
    summary,
    errors: errorsList,
    verifiedReferenceEntriesByDestination: {},
    rawResponse: null
  });

  const policyResolution = resolveSupportedDestinationKeys(
    supportedKeys ?? pendingReq?.requestedDestinations ?? null
  );
  if (!policyResolution.ok) {
    return makeFailureRecord(
      "failed_or_incomplete",
      policyResolution.error,
      [policyResolution.error]
    );
  }

  const activeBareKeys = policyResolution.bareKeys;
  const activeDestinationSet = policyResolution.destinationSet;

  if (!rawResponse || typeof rawResponse !== "object") {
    return makeFailureRecord(
      "failed_or_incomplete",
      `Reference choices load failed: no structured response returned by ${actionPath}.`,
      [`No structured response returned by ${actionPath}.`]
    );
  }

  if (
    rawResponse.intent !== "resolveStandardizedCandidates" ||
    rawResponse.readOnly !== true ||
    rawResponse.requestId !== reqId ||
    rawResponse.pieceId !== reqProductId ||
    reqSessionId !== currentSessionId
  ) {
    return makeFailureRecord(
      "discarded_stale",
      `Ignored mismatched or stale reference choices response (expected product ${reqProductId} / request ${reqId}, got product ${String(
        rawResponse.pieceId
      )} / request ${String(rawResponse.requestId)}).`,
      ["Mismatched requestId, pieceId, or session."]
    );
  }

  const responseCategoryId = rawResponse.productCategory?.id || null;
  if (
    !latestBaseline ||
    latestBaseline.productId !== reqProductId ||
    latestContextSig !== reqBaselineContextSig ||
    (latestBaseline.productCategory?.id || null) !== responseCategoryId
  ) {
    return makeFailureRecord(
      "discarded_stale",
      "Discarded stale reference choices response because the product baseline or category changed while the request was in flight.",
      ["Baseline or product category changed during reference enumeration."]
    );
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
    return (
      !BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(scopedDest) ||
      !activeDestinationSet.has(scopedDest)
    );
  });

  if (
    rawResponse.defsReadComplete !== true ||
    !hasResolutionsMap ||
    !hasCurrentRefListsMap ||
    !hasCategoryEligibilityMap ||
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
                : "Top-level resolveStandardizedCandidates prerequisite evidence was missing or incomplete."
            ];

    return makeFailureRecord(
      "failed_or_incomplete",
      globalFailureReasons[0] ||
        "Reference choices enumeration failed global prerequisite checks.",
      globalFailureReasons
    );
  }

  const verifiedMapByDest = {};
  let eligibleWithChoicesCount = 0;
  let eligibleEmptyChoicesCount = 0;
  let categoryIneligibleCount = 0;
  let incompleteOrBlockedCount = 0;

  for (const stdKey of activeBareKeys) {
    const destKey = `shopify.${stdKey}`;
    const resObj = rawResponse.resolutions[destKey];
    const refListEntry = rawResponse.currentReferenceLists[destKey];
    const catEligEntry =
      resObj?.categoryEligibility || rawResponse.categoryEligibility[destKey] || null;
    const baselineDef = latestBaseline.liveDefinitions?.[destKey] || null;
    const expectedDefId = baselineDef?.restrictedMetaobjectDefinitionId || null;

    const scopedTopErrorsForDest = topErrors.filter((errText) => {
      const bracketMatch = /^\[([^\]]+)\]/.exec(errText.trim());
      return Boolean(bracketMatch && bracketMatch[1].trim() === destKey);
    });

    const isRefListEntryPresent = Boolean(
      refListEntry && typeof refListEntry === "object"
    );
    const isRefListCompleteAndValid = Boolean(
      isRefListEntryPresent &&
        refListEntry.readComplete === true &&
        refListEntry.parseValid === true
    );

    if (!resObj || typeof resObj !== "object") {
      const isCategoryIneligibleWithoutResObj = Boolean(
        isRefListCompleteAndValid &&
          catEligEntry &&
          typeof catEligEntry === "object" &&
          catEligEntry.isComplete === true &&
          catEligEntry.isEligible === false
      );

      if (isCategoryIneligibleWithoutResObj) {
        categoryIneligibleCount += 1;
        verifiedMapByDest[destKey] = {
          destination: destKey,
          attributeKey: stdKey,
          status: "category_ineligible",
          isComplete: true,
          isCategoryEligible: false,
          categoryEligibility: catEligEntry,
          currentAssignment: refListEntry,
          restrictedMetaobjectDefinitionId: expectedDefId,
          availableEntries: [],
          errors: catEligEntry.reason ? [catEligEntry.reason] : []
        };
        continue;
      }

      incompleteOrBlockedCount += 1;
      const missingResErrors =
        scopedTopErrorsForDest.length > 0
          ? [...scopedTopErrorsForDest]
          : [`Missing resolution entry for ${destKey}.`];
      if (!isRefListCompleteAndValid) {
        const refErrMsg = !isRefListEntryPresent
          ? `Missing currentReferenceLists entry for ${destKey}.`
          : refListEntry.parseError ||
            `Stored reference list read or parse was incomplete on ${destKey}.`;
        if (!missingResErrors.includes(refErrMsg)) {
          missingResErrors.push(refErrMsg);
        }
      }

      verifiedMapByDest[destKey] = {
        destination: destKey,
        attributeKey: stdKey,
        status: "incomplete",
        isComplete: false,
        isCategoryEligible: false,
        categoryEligibility: catEligEntry,
        currentAssignment: refListEntry || null,
        restrictedMetaobjectDefinitionId: expectedDefId,
        availableEntries: [],
        errors: missingResErrors
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
        !isRefListEntryPresent
          ? `Missing currentReferenceLists entry for ${destKey}.`
          : refListEntry.parseError ||
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
      currentAssignment: refListEntry || resObj.currentAssignment || null,
      restrictedMetaobjectDefinitionId: defMatchesBaseline ? resolvedDefId : null,
      isComplete: isFieldEligibleAndComplete,
      availableEntries: isFieldEligibleAndComplete ? verifiedAvailable : [],
      errors: mergedFieldErrors
    };
  }

  const overallState =
    incompleteOrBlockedCount > 0 ? "partial_or_blocked" : "choices_loaded";

  const resolvedProdTitle =
    latestBaseline?.productTitle || productTitle || reqProductId;

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

  return {
    requestId: reqId,
    sessionId: reqSessionId,
    benchSessionId: reqSessionId,
    productId: reqProductId,
    baselineContextSig: reqBaselineContextSig,
    productCategoryId: responseCategoryId,
    completedAt: finishedAt,
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
  };
}

function buildDefaultPrevalidationMessages(productTitle, reloadActionLabel = "Reload Product") {
  const safeTitle = productTitle || " the selected product";
  return {
    busyNotice: {
      tone: "warning",
      title: "Operation already in progress",
      reasons: [
        "Wait for the current operation to complete before retrying standardized reference choices."
      ]
    },
    baselineNotLoadedNotice: {
      tone: "error",
      title: "Cannot load reference choices: Product baseline not loaded",
      reasons: [`Reload ${safeTitle} so its baseline and definitions are available.`]
    },
    baselineIncompleteNotice: {
      tone: "error",
      title: "Cannot load reference choices: Baseline read incomplete",
      reasons: [
        `Product metafields, product category, or live PRODUCT definitions did not finish loading. Click ${reloadActionLabel} first.`
      ]
    }
  };
}

/**
 * Reusable client-safe hook for once-per-factual-context automatic and explicit
 * retry read-only standardized reference choice loading.
 */
export function useStandardizedReferenceChoiceLoader({
  sessionId,
  productId,
  productTitle,
  isSwitchingProduct = false,
  rawBaseline,
  getLatestBaselineForProduct,
  getStagedCandidatesForProduct,
  isExternalBusy = false,
  onPrevalidationNotice = null,
  onClearNotice = null,
  requestedDestinations = null,
  requestIdPrefix = DEFAULT_REFERENCE_CHOICES_REQUEST_PREFIX,
  actionPath = DEFAULT_REFERENCE_CHOICES_ACTION_PATH,
  messages = null
}) {
  const refChoicesFetcher = useFetcher();

  const [activeRefChoicesRequest, setActiveRefChoicesRequest] = useState(null);
  const [refChoicesStateByProduct, setRefChoicesStateByProduct] = useState({});
  const processedRefChoicesRequestIdRef = useRef(null);
  const activeRefChoicesRequestRef = useRef(null);
  const observedBusyRequestIdRef = useRef(null);
  const autoRefChoicesAttemptedKeysRef = useRef(new Set());
  const refChoicesFetcherRef = useRef(refChoicesFetcher);
  refChoicesFetcherRef.current = refChoicesFetcher;

  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const getLatestBaselineRef = useRef(getLatestBaselineForProduct);
  getLatestBaselineRef.current = getLatestBaselineForProduct;

  const getStagedCandidatesRef = useRef(getStagedCandidatesForProduct);
  getStagedCandidatesRef.current = getStagedCandidatesForProduct;

  useEffect(() => {
    activeRefChoicesRequestRef.current = activeRefChoicesRequest;
  }, [activeRefChoicesRequest]);

  const destinationPolicy = React.useMemo(
    () => resolveSupportedDestinationKeys(requestedDestinations),
    [requestedDestinations]
  );

  const currentRefChoicesRecord = refChoicesStateByProduct[productId] || null;
  const currentBaselineContextSig = React.useMemo(
    () =>
      buildStandardizedBaselineContextSignature(
        rawBaseline,
        destinationPolicy.ok
          ? destinationPolicy.bareKeys
          : SUPPORTED_STANDARDIZED_REFERENCE_KEYS
      ),
    [rawBaseline, destinationPolicy]
  );

  const isCurrentBaselineReadyForStandardizedLookup = Boolean(
    destinationPolicy.ok &&
      !isSwitchingProduct &&
      isExactProductGid(productId) &&
      rawBaseline &&
      rawBaseline.productId === productId &&
      rawBaseline.metafieldsReadComplete === true &&
      rawBaseline.defsReadComplete === true &&
      rawBaseline.productCategoryReadComplete === true
  );

  // Merge verified reference evidence into currentBaseline ONLY when bound to the
  // current session, current productId, current category, and current baseline context.
  const isCurrentRefChoicesBoundAndFresh = Boolean(
    rawBaseline &&
      currentRefChoicesRecord &&
      (currentRefChoicesRecord.sessionId ?? currentRefChoicesRecord.benchSessionId) ===
        sessionIdRef.current &&
      currentRefChoicesRecord.productId === productId &&
      currentRefChoicesRecord.baselineContextSig === currentBaselineContextSig &&
      (currentRefChoicesRecord.productCategoryId || null) ===
        (rawBaseline.productCategory?.id || null)
  );

  const currentBaseline = React.useMemo(() => {
    if (!rawBaseline) return null;
    if (!isCurrentRefChoicesBoundAndFresh || !currentRefChoicesRecord) {
      return rawBaseline;
    }
    return {
      ...rawBaseline,
      verifiedReferenceEntriesByDestination:
        currentRefChoicesRecord.verifiedReferenceEntriesByDestination || {},
      standardizedReferenceResolutions:
        currentRefChoicesRecord.rawResponse || null
    };
  }, [rawBaseline, isCurrentRefChoicesBoundAndFresh, currentRefChoicesRecord]);

  const isRefChoicesBusy =
    refChoicesFetcher.state !== "idle" || Boolean(activeRefChoicesRequest);
  const isAnyOperationBusy = Boolean(isExternalBusy || isRefChoicesBusy);

  const cleanPrefix =
    typeof requestIdPrefix === "string" && requestIdPrefix.trim() !== ""
      ? requestIdPrefix.trim().replace(/[^A-Za-z0-9_-]/g, "")
      : DEFAULT_REFERENCE_CHOICES_REQUEST_PREFIX;

  const resolvedActionPath =
    typeof actionPath === "string" && actionPath.trim() !== ""
      ? actionPath.trim()
      : DEFAULT_REFERENCE_CHOICES_ACTION_PATH;

  // ==========================================================================
  // AUTOMATIC + EXPLICIT RETRY READ-ONLY STANDARDIZED REFERENCE CHOICES LOADER
  // ==========================================================================
  const submitStandardizedReferenceChoicesRequest = useCallback(
    ({ targetProductId, targetBaselineSnap, targetContextSig }) => {
      if (
        !destinationPolicy.ok ||
        !isExactProductGid(targetProductId) ||
        !targetBaselineSnap ||
        targetBaselineSnap.productId !== targetProductId ||
        targetBaselineSnap.metafieldsReadComplete !== true ||
        targetBaselineSnap.defsReadComplete !== true ||
        targetBaselineSnap.productCategoryReadComplete !== true
      ) {
        return false;
      }

      const attemptKey = buildAutoRefChoicesAttemptKey(
        sessionIdRef.current,
        targetProductId,
        targetContextSig
      );
      autoRefChoicesAttemptedKeysRef.current.add(attemptKey);

      const requestId = `${cleanPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const enumerateList = destinationPolicy.destinationKeys;
      const rawCandidates =
        typeof getStagedCandidatesRef.current === "function"
          ? getStagedCandidatesRef.current(targetProductId)
          : {};
      const stagedCandidatesForProduct =
        rawCandidates && typeof rawCandidates === "object" && !Array.isArray(rawCandidates)
          ? rawCandidates
          : {};

      const reqMeta = {
        requestId,
        sessionId: sessionIdRef.current,
        benchSessionId: sessionIdRef.current,
        productId: targetProductId,
        baselineContextSig: targetContextSig,
        productCategoryId: targetBaselineSnap.productCategory?.id || null,
        requestedDestinations: enumerateList,
        startedAt: new Date().toISOString()
      };

      observedBusyRequestIdRef.current = null;
      activeRefChoicesRequestRef.current = reqMeta;
      setActiveRefChoicesRequest(reqMeta);

      const formData = new FormData();
      formData.append("intent", "resolveStandardizedCandidates");
      formData.append("pieceId", targetProductId);
      formData.append("requestId", requestId);
      formData.append("enumerate_destinations", JSON.stringify(enumerateList));
      formData.append(
        "standardized_candidates",
        JSON.stringify(stagedCandidatesForProduct)
      );

      refChoicesFetcherRef.current.submit(formData, {
        method: "POST",
        action: resolvedActionPath
      });
      return true;
    },
    [destinationPolicy, cleanPrefix, resolvedActionPath]
  );

  // Automatic read-only reference-choice loading:
  // Fires at most once per (sessionId, productId, factual baselineContextSig)
  // when the selected product baseline is genuinely ready. Records the attempt key
  // synchronously before submitting so Strict Mode or revalidation cannot loop.
  useEffect(() => {
    if (!isCurrentBaselineReadyForStandardizedLookup || !rawBaseline) {
      return;
    }
    if (isCurrentRefChoicesBoundAndFresh) {
      return;
    }
    if (
      activeRefChoicesRequestRef.current ||
      refChoicesFetcherRef.current.state !== "idle" ||
      isExternalBusy
    ) {
      return;
    }

    const attemptKey = buildAutoRefChoicesAttemptKey(
      sessionIdRef.current,
      productId,
      currentBaselineContextSig
    );
    if (autoRefChoicesAttemptedKeysRef.current.has(attemptKey)) {
      return;
    }

    submitStandardizedReferenceChoicesRequest({
      targetProductId: productId,
      targetBaselineSnap: rawBaseline,
      targetContextSig: currentBaselineContextSig
    });
  }, [
    isCurrentBaselineReadyForStandardizedLookup,
    isCurrentRefChoicesBoundAndFresh,
    productId,
    currentBaselineContextSig,
    rawBaseline,
    isExternalBusy,
    isRefChoicesBusy,
    submitStandardizedReferenceChoicesRequest
  ]);

  const handleLoadStandardizedReferenceChoices = () => {
    if (typeof onClearNotice === "function") {
      onClearNotice();
    }

    const defaultNotices = buildDefaultPrevalidationMessages(
      productTitle || productId,
      messages?.reloadActionLabel || "Reload Product"
    );

    if (!destinationPolicy.ok) {
      if (typeof onPrevalidationNotice === "function") {
        onPrevalidationNotice({
          tone: "error",
          title: "Cannot load reference choices: Unsupported destination filter",
          reasons: [destinationPolicy.error]
        });
      }
      return;
    }

    if (isAnyOperationBusy) {
      if (typeof onPrevalidationNotice === "function") {
        onPrevalidationNotice(messages?.busyNotice || defaultNotices.busyNotice);
      }
      return;
    }

    if (!rawBaseline || rawBaseline.productId !== productId) {
      if (typeof onPrevalidationNotice === "function") {
        const customNotLoaded =
          typeof messages?.buildBaselineNotLoadedNotice === "function"
            ? messages.buildBaselineNotLoadedNotice(productTitle || productId)
            : messages?.baselineNotLoadedNotice;
        onPrevalidationNotice(customNotLoaded || defaultNotices.baselineNotLoadedNotice);
      }
      return;
    }

    if (
      rawBaseline.metafieldsReadComplete !== true ||
      rawBaseline.defsReadComplete !== true ||
      rawBaseline.productCategoryReadComplete !== true
    ) {
      if (typeof onPrevalidationNotice === "function") {
        onPrevalidationNotice(
          messages?.baselineIncompleteNotice || defaultNotices.baselineIncompleteNotice
        );
      }
      return;
    }

    submitStandardizedReferenceChoicesRequest({
      targetProductId: productId,
      targetBaselineSnap: rawBaseline,
      targetContextSig: currentBaselineContextSig
    });
  };

  useEffect(() => {
    const pendingReq = activeRefChoicesRequestRef.current;
    if (!pendingReq) return;

    if (refChoicesFetcher.state !== "idle") {
      observedBusyRequestIdRef.current = pendingReq.requestId;
      return;
    }

    const rawResponse = refChoicesFetcher.data;
    const hasMatchingResponseForPendingReq = Boolean(
      rawResponse &&
        typeof rawResponse === "object" &&
        rawResponse.requestId === pendingReq.requestId
    );

    if (
      observedBusyRequestIdRef.current !== pendingReq.requestId &&
      !hasMatchingResponseForPendingReq
    ) {
      return;
    }

    if (processedRefChoicesRequestIdRef.current === pendingReq.requestId) {
      return;
    }
    processedRefChoicesRequestIdRef.current = pendingReq.requestId;

    const reqProductId = pendingReq.productId;
    const latestBaselineForProduct =
      typeof getLatestBaselineRef.current === "function"
        ? getLatestBaselineRef.current(reqProductId)
        : rawBaseline && rawBaseline.productId === reqProductId
          ? rawBaseline
          : null;

    const latestContextSig = buildStandardizedBaselineContextSignature(
      latestBaselineForProduct,
      destinationPolicy.ok
        ? destinationPolicy.bareKeys
        : SUPPORTED_STANDARDIZED_REFERENCE_KEYS
    );

    const evaluatedRecord = evaluateStandardizedReferenceChoicesResponse({
      rawResponse,
      pendingReq,
      currentSessionId: sessionIdRef.current,
      latestBaseline: latestBaselineForProduct,
      latestContextSig,
      productTitle,
      supportedKeys: pendingReq.requestedDestinations,
      actionPath: resolvedActionPath
    });

    setRefChoicesStateByProduct((prev) => ({
      ...prev,
      [reqProductId]: evaluatedRecord
    }));

    observedBusyRequestIdRef.current = null;
    activeRefChoicesRequestRef.current = null;
    setActiveRefChoicesRequest(null);
  }, [
    refChoicesFetcher.state,
    refChoicesFetcher.data,
    activeRefChoicesRequest,
    productTitle,
    rawBaseline,
    destinationPolicy,
    resolvedActionPath
  ]);

  const canRetryRefChoicesForCurrentProduct = Boolean(
    isCurrentBaselineReadyForStandardizedLookup &&
      !isRefChoicesBusy &&
      currentRefChoicesRecord &&
      (!isCurrentRefChoicesBoundAndFresh || !currentRefChoicesRecord.ok)
  );

  const dismissCurrentRefChoicesRecord = useCallback(() => {
    setRefChoicesStateByProduct((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, [productId]);

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

/**
 * Backward-compatible Bench V2 wrapper hook.
 * Preserves the exact call signature, ref adapters, prevalidation banner
 * behavior, record fields, and return values expected by `app/routes/app.bench-v2.jsx`.
 */
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
  const getLatestBaselineForProduct = useCallback(
    (targetProdId) => baselineByProductRef?.current?.[targetProdId] || null,
    [baselineByProductRef]
  );

  const getStagedCandidatesForProduct = useCallback(
    (targetProdId) =>
      stagedVisionCandidatesByProductRef?.current?.[targetProdId] || {},
    [stagedVisionCandidatesByProductRef]
  );

  const handleClearNotice = useCallback(() => {
    if (typeof setClientPrevalidationBanner === "function") {
      setClientPrevalidationBanner(null);
    }
  }, [setClientPrevalidationBanner]);

  const handlePrevalidationNotice = useCallback(
    (notice) => {
      if (typeof setClientPrevalidationBanner === "function") {
        setClientPrevalidationBanner(notice);
      }
    },
    [setClientPrevalidationBanner]
  );

  return useStandardizedReferenceChoiceLoader({
    sessionId: benchSessionId,
    productId: activeProductId,
    productTitle: activeProductTitle,
    isSwitchingProduct: isSwitchingSelectedProduct,
    rawBaseline: rawCurrentBaseline,
    getLatestBaselineForProduct,
    getStagedCandidatesForProduct,
    isExternalBusy: Boolean(isWriterBusy || isAiScanBusy || isBaselineReloading),
    onPrevalidationNotice: handlePrevalidationNotice,
    onClearNotice: handleClearNotice,
    requestIdPrefix: DEFAULT_REFERENCE_CHOICES_REQUEST_PREFIX,
    actionPath: DEFAULT_REFERENCE_CHOICES_ACTION_PATH
  });
}
// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2
// File: app/routes/app.bench-v2.jsx
//
// Connects the reorganized Bench V2 workflow drawers (manual measurements &
// manual single-variant USD price first alongside task-restricted shipping
// baselines, manual title & collection date, identity/material/OOAK +
// standardized companions, appearance/color + standardized companion,
// treatment, origin & provenance, setting/hardware + standardized companions,
// SEO & photo alts, substantive descriptions, physical/optical geology,
// composition/formation/deep-time geology, Google channel & demographic
// attributes, and split read-only parked/protected drawers), with per-drawer
// copy controls and Sidekick live bench snapshot sync.
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useFetcher, useRevalidator, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { loadSingleProductBaselineSnapshot } from "../utils/bench-v2.baseline.server.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_DRAWER_GROUPS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  isManualMeasurementDestination,
  isManualOnlyNoAiDestination,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  isExactProductVariantGid,
  isExactMetaobjectDefinitionGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  inspectStoredReferenceListRawValue,
  validateBatch1ProposedValue,
  createExactValueApprovalRecord,
  isExactValueApprovalValid,
  createKeepOriginalRecord,
  isKeepOriginalRecordValid
} from "../utils/bench-v2.contract.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  isExactMetaobjectGid,
  collectVerifiedEntriesForResolution,
  evaluateCandidateLabelResolution
} from "../utils/meta-injector.standardized.jsx";
import {
  buildStandardizedBaselineContextSignature,
  useBenchV2StandardizedReferenceLoader
} from "../utils/bench-v2.reference-loader.jsx";
import {
  generateBenchSessionId,
  useBenchV2LiveTelemetryPublisher
} from "../utils/bench-v2.telemetry-sync.jsx";
import {
  BENCH_V2_FILTER_OPTIONS,
  PLAIN_DRAWER_TITLES,
  matchesBenchV2Filter,
  evaluateAndFilterBenchV2Drawers
} from "../utils/bench-v2.field-filters.jsx";
import {
  BenchV2HeaderAndBannersView
} from "../utils/bench-v2.header-banners-view.jsx";
import {
  BenchV2DrawersView
} from "../utils/bench-v2.drawers-view.jsx";

export {
  checkExistingWriterStringFidelity,
  BENCH_V2_FILTER_OPTIONS,
  matchesBenchV2Filter
};

export const CANYON_RED_PRODUCT_GID = "gid://shopify/Product/9226849616123";

const PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    "shopify.crystal-system",
    "shopify.mineral-class",
    "shopify.rock-composition",
    "shopify.rock-formation"
  ])
);

const VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set(ALLOWED_VISION_CANDIDATE_KEYS.map((k) => `shopify.${k}`))
);

const AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    ...PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS,
    ...VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS
  ])
);

function getProposalValueString(rawEntry) {
  return rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
    ? rawEntry.value
    : typeof rawEntry === "string"
      ? rawEntry
      : "";
}

function resolveProducerBackedGeologyReferenceCandidate({
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

  const mergedGids = [...existingGids];
  const matchedLabelsList = [];
  for (const ev of labelEvaluations) {
    const selectedGid = ev.selectedEntry.id;
    if (!mergedGids.includes(selectedGid)) {
      mergedGids.push(selectedGid);
    }
    matchedLabelsList.push(
      `${ev.selectedEntry.label || displayLabel} (${selectedGid})`
    );
  }

  const serializedGidArray = JSON.stringify(mergedGids);

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
    baselineSnapshot: baselineWithVerifiedRef
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
      matchedSummary: matchedLabelsList.join(", "),
      reason: validation.reason
    };
  }

  return {
    status: "resolved_valid_change",
    displayLabel,
    serializedValue: validation.normalizedValue,
    matchedSummary: matchedLabelsList.join(", "),
    reason: null
  };
}

const GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY = `
  query GetLightweightProductsPage($cursor: String, $searchQuery: String) {
    products(first: 50, after: $cursor, query: $searchQuery) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          pieceName: metafield(namespace: "custom", key: "piece_name") {
            value
          }
        }
      }
    }
  }
`;

function buildShopifyProductTitleSearchQuery(rawSearch) {
  if (typeof rawSearch !== "string") return null;
  const trimmed = rawSearch.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `title:*${escaped}*`;
}

async function loadLightweightProductPage(admin, cursor = null, rawSearch = "") {
  const normalizedCursor =
    typeof cursor === "string" && cursor.trim() !== "" ? cursor.trim() : null;
  const cleanSearch =
    typeof rawSearch === "string" && rawSearch.trim() !== "" ? rawSearch.trim() : "";
  const graphqlSearchQuery = buildShopifyProductTitleSearchQuery(cleanSearch);

  try {
    const res = await admin.graphql(GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY, {
      variables: {
        cursor: normalizedCursor,
        searchQuery: graphqlSearchQuery
      }
    });
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }

    const conn = json?.data?.products;
    if (!conn || !Array.isArray(conn.edges) || typeof conn.pageInfo?.hasNextPage !== "boolean") {
      throw new Error("Malformed products connection response.");
    }

    const items = [];
    for (const edge of conn.edges) {
      const node = edge?.node;
      if (node && isExactProductGid(node.id)) {
        const rawPieceName =
          typeof node.pieceName?.value === "string" && node.pieceName.value.trim() !== ""
            ? node.pieceName.value.trim()
            : null;
        items.push({
          id: node.id,
          title: typeof node.title === "string" && node.title.trim() !== "" ? node.title : node.id,
          pieceName: rawPieceName
        });
      }
    }

    return {
      ok: true,
      items,
      pageInfo: {
        hasNextPage: Boolean(conn.pageInfo.hasNextPage),
        endCursor:
          typeof conn.pageInfo.endCursor === "string" && conn.pageInfo.endCursor.trim() !== ""
            ? conn.pageInfo.endCursor.trim()
            : null
      },
      requestedCursor: normalizedCursor,
      appliedSearch: cleanSearch,
      error: null
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      },
      requestedCursor: normalizedCursor,
      appliedSearch: cleanSearch,
      error: `Failed to load product search/picker page: ${err.message}`
    };
  }
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isPickerOnly = url.searchParams.get("pickerOnly") === "1";
  const requestedProductId = url.searchParams.get("productId");
  const requestedCursor = url.searchParams.get("cursor");
  const requestedSearch = url.searchParams.get("q") || "";

  if (isPickerOnly) {
    const selectorPageResult = await loadLightweightProductPage(
      admin,
      requestedCursor,
      requestedSearch
    );
    return Response.json({
      pickerOnly: true,
      selectorPage: selectorPageResult,
      loadedAt: new Date().toISOString()
    });
  }

  let targetProductId = CANYON_RED_PRODUCT_GID;
  let selectionError = null;

  if (requestedProductId !== null && requestedProductId.trim() !== "") {
    const candidateId = requestedProductId.trim();
    if (isExactProductGid(candidateId)) {
      targetProductId = candidateId;
    } else {
      selectionError = `Ignored invalid productId parameter "${candidateId}"; exact Shopify Product GID is required.`;
    }
  }

  const [selectorPageResult, loadResult] = await Promise.all([
    loadLightweightProductPage(admin, requestedCursor, requestedSearch),
    loadSingleProductBaselineSnapshot(admin, targetProductId)
  ]);

  return Response.json({
    pickerOnly: false,
    contractVersion: BENCH_V2_CONTRACT_VERSION,
    targetProductId,
    selectionError,
    selectorPage: selectorPageResult,
    loadSuccess: Boolean(loadResult?.success),
    loadError: loadResult?.error || null,
    baselineSnapshot: loadResult?.baselineSnapshot || null,
    loadedAt: new Date().toISOString()
  });
};

function mergeKnownProductsMap(prevMap, pageItems, snap) {
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

export default function BenchV2Route() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const writerFetcher = useFetcher();
  const aiScanFetcher = useFetcher();
  const pickerFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawUrlProductId = searchParams.get("productId");
  const requestedUrlProductId =
    rawUrlProductId && isExactProductGid(rawUrlProductId.trim())
      ? rawUrlProductId.trim()
      : null;

  const activeProductId = isExactProductGid(loaderData?.targetProductId)
    ? loaderData.targetProductId
    : CANYON_RED_PRODUCT_GID;

  const isSwitchingSelectedProduct = Boolean(
    requestedUrlProductId && requestedUrlProductId !== activeProductId
  );

  // 1. Authoritative Baseline State (Strictly separated from proposals, keyed by Product GID)
  const [baselineByProduct, setBaselineByProduct] = useState(() => {
    const initialSnap = loaderData?.baselineSnapshot;
    if (initialSnap && isExactProductGid(initialSnap.productId)) {
      return { [initialSnap.productId]: initialSnap };
    }
    return {};
  });

  // 2. Known Product Metadata Cache
  const [knownProductsById, setKnownProductsById] = useState(() =>
    mergeKnownProductsMap(
      {
        [CANYON_RED_PRODUCT_GID]: {
          id: CANYON_RED_PRODUCT_GID,
          title: "Canyon Red",
          pieceName: null
        }
      },
      loaderData?.selectorPage?.items,
      loaderData?.baselineSnapshot
    )
  );

  // 3. Dedicated Product Search & Paginated Picker State
  const [pickerPageState, setPickerPageState] = useState(() => {
    return (
      loaderData?.selectorPage || {
        ok: false,
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        requestedCursor: null,
        appliedSearch: "",
        error: null
      }
    );
  });
  const [searchInputText, setSearchInputText] = useState(
    () => loaderData?.selectorPage?.appliedSearch || ""
  );
  const [committedSearchQuery, setCommittedSearchQuery] = useState(
    () => loaderData?.selectorPage?.appliedSearch || ""
  );
  const [pickerCursorHistory, setPickerCursorHistory] = useState([]);
  const [currentPickerCursor, setCurrentPickerCursor] = useState(null);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // 4. Staged Proposals State (Never pre-seeded from baseline, preserved per productId)
  const [proposedByProduct, setProposedByProduct] = useState({});

  // 5. Held AI Alternatives State
  const [aiAlternativesByProduct, setAiAlternativesByProduct] = useState({});

  // 6. Exact-Value Approval Records State
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 7. Keep Original Decision Records State
  const [keepOriginalByProduct, setKeepOriginalByProduct] = useState({});

  // 8. Save Request Tracking & Honest Outcome Reporting
  const [activeSaveSubmission, setActiveSaveSubmission] = useState(null);
  const [lastSaveReport, setLastSaveReport] = useState(null);
  const [clientPrevalidationBanner, setClientPrevalidationBanner] = useState(null);
  const processedSubmissionIdRef = useRef(null);
  const activeSaveSubmissionRef = useRef(null);

  // 9. Explicit AI Scan Request Tracking & Honest Scan Report
  const [activeAiScanRequest, setActiveAiScanRequest] = useState(null);
  const [lastAiScanReportByProduct, setLastAiScanReportByProduct] = useState({});
  const processedAiScanRequestIdRef = useRef(null);
  const activeAiScanRequestRef = useRef(null);

  // 9B. Staged Vision Candidates State (Populated by AI Scan, read by Reference Loader & Telemetry)
  const [stagedVisionCandidatesByProduct, setStagedVisionCandidatesByProduct] = useState({});

  // 9C. Pending Producer-Backed & Vision-Backed Standardized Reference Candidates State
  // Retains unresolved geology & Vision reference candidates when AI Scan arrives before
  // reference choices finish loading, so either arrival order resolves once without
  // rescanning, loops, or auto-approval.
  const [pendingGeologyRefCandidatesByProduct, setPendingGeologyRefCandidatesByProduct] =
    useState({});

  // 10. Presentation-Only State: All drawers initially collapsed + View-Only Drawer Filter
  const [openDrawersById, setOpenDrawersById] = useState(() =>
    BENCH_V2_DRAWER_GROUPS.reduce((acc, drawer) => {
      acc[drawer.drawerId] = false;
      return acc;
    }, {})
  );
  const [activeFilter, setActiveFilter] = useState("All");

  // 11. Focus Retention State for Filtered Views
  const [retainedFieldEditorsByProduct, setRetainedFieldEditorsByProduct] = useState({});
  const blurClearTimersRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // 12. Shared Bench Session Identity (Owned by Bench, shared by Reference Loader & Telemetry)
  const benchSessionIdRef = useRef(null);
  if (!benchSessionIdRef.current) {
    benchSessionIdRef.current = generateBenchSessionId();
  }

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      for (const timerId of blurClearTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      blurClearTimersRef.current.clear();
    };
  }, []);

  const handleFieldEditorFocus = useCallback(
    (destinationKey) => {
      if (typeof destinationKey !== "string" || !destinationKey.trim()) return;
      const timerKey = `${activeProductId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        blurClearTimersRef.current.delete(timerKey);
      }
      setRetainedFieldEditorsByProduct((prev) => {
        const prodMap = prev[activeProductId] || {};
        if (prodMap[destinationKey] === true) return prev;
        return {
          ...prev,
          [activeProductId]: {
            ...prodMap,
            [destinationKey]: true
          }
        };
      });
    },
    [activeProductId]
  );

  const handleFieldEditorBlur = useCallback(
    (destinationKey) => {
      if (typeof destinationKey !== "string" || !destinationKey.trim()) return;
      const timerKey = `${activeProductId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timerId = setTimeout(() => {
        blurClearTimersRef.current.delete(timerKey);
        if (!isMountedRef.current) return;
        setRetainedFieldEditorsByProduct((prev) => {
          const prodMap = prev[activeProductId];
          if (!prodMap || prodMap[destinationKey] === undefined) return prev;
          const nextProdMap = { ...prodMap };
          delete nextProdMap[destinationKey];
          return {
            ...prev,
            [activeProductId]: nextProdMap
          };
        });
      }, 200);
      blurClearTimersRef.current.set(timerKey, timerId);
    },
    [activeProductId]
  );

  const releaseRetainedFieldEditor = useCallback(
    (productId, destinationKey) => {
      if (!productId || !destinationKey) return;
      const timerKey = `${productId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        blurClearTimersRef.current.delete(timerKey);
      }
      setRetainedFieldEditorsByProduct((prev) => {
        const prodMap = prev[productId];
        if (!prodMap || prodMap[destinationKey] === undefined) return prev;
        const nextProdMap = { ...prodMap };
        delete nextProdMap[destinationKey];
        return {
          ...prev,
          [productId]: nextProdMap
        };
      });
    },
    []
  );

  const clearDecisionForDestination = useCallback((setter, productId, destinationKey) => {
    setter((prev) => {
      const prodMap = prev[productId];
      if (!prodMap || !prodMap[destinationKey]) return prev;
      const nextMap = { ...prodMap };
      delete nextMap[destinationKey];
      return { ...prev, [productId]: nextMap };
    });
  }, []);

  const handleToggleDrawer = (drawerId) => {
    setOpenDrawersById((prev) => ({
      ...prev,
      [drawerId]: !prev[drawerId]
    }));
  };

  const handleSetAllDrawers = (isOpen) => {
    setOpenDrawersById(
      BENCH_V2_DRAWER_GROUPS.reduce((acc, drawer) => {
        acc[drawer.drawerId] = Boolean(isOpen);
        return acc;
      }, {})
    );
  };

  useEffect(() => {
    activeSaveSubmissionRef.current = activeSaveSubmission;
  }, [activeSaveSubmission]);

  useEffect(() => {
    activeAiScanRequestRef.current = activeAiScanRequest;
  }, [activeAiScanRequest]);

  const baselineByProductRef = useRef(baselineByProduct);
  useEffect(() => {
    baselineByProductRef.current = baselineByProduct;
  }, [baselineByProduct]);

  const proposedByProductRef = useRef(proposedByProduct);
  useEffect(() => {
    proposedByProductRef.current = proposedByProduct;
  }, [proposedByProduct]);

  const approvalsByProductRef = useRef(approvalsByProduct);
  useEffect(() => {
    approvalsByProductRef.current = approvalsByProduct;
  }, [approvalsByProduct]);

  const keepOriginalByProductRef = useRef(keepOriginalByProduct);
  useEffect(() => {
    keepOriginalByProductRef.current = keepOriginalByProduct;
  }, [keepOriginalByProduct]);

  const stagedVisionCandidatesByProductRef = useRef(stagedVisionCandidatesByProduct);
  useEffect(() => {
    stagedVisionCandidatesByProductRef.current = stagedVisionCandidatesByProduct;
  }, [stagedVisionCandidatesByProduct]);

  useEffect(() => {
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId)) {
      setBaselineByProduct((prev) => ({
        ...prev,
        [snap.productId]: snap
      }));
    }

    if (loaderData?.selectorPage && !loaderData?.pickerOnly) {
      setPickerPageState((prev) => {
        if (
          prev.appliedSearch === (loaderData.selectorPage.appliedSearch || "") &&
          prev.requestedCursor === (loaderData.selectorPage.requestedCursor || null)
        ) {
          return loaderData.selectorPage;
        }
        return prev;
      });
    }

    setKnownProductsById((prev) =>
      mergeKnownProductsMap(prev, loaderData?.selectorPage?.items, snap)
    );
  }, [loaderData?.baselineSnapshot, loaderData?.selectorPage, loaderData?.loadedAt, loaderData?.pickerOnly]);

  useEffect(() => {
    if (pickerFetcher.state !== "idle" || !pickerFetcher.data) return;
    const fetchedPage = pickerFetcher.data.selectorPage;
    if (!fetchedPage || typeof fetchedPage !== "object") return;

    setPickerPageState(fetchedPage);
    if (Array.isArray(fetchedPage.items) && fetchedPage.items.length > 0) {
      setKnownProductsById((prev) =>
        mergeKnownProductsMap(prev, fetchedPage.items, null)
      );
    }
  }, [pickerFetcher.state, pickerFetcher.data]);

  const rawCurrentBaseline =
    baselineByProduct[activeProductId] &&
    baselineByProduct[activeProductId].productId === activeProductId
      ? baselineByProduct[activeProductId]
      : loaderData?.baselineSnapshot?.productId === activeProductId
        ? loaderData.baselineSnapshot
        : null;

  const isWriterBusy = writerFetcher.state !== "idle" || Boolean(activeSaveSubmission);
  const isAiScanBusy = aiScanFetcher.state !== "idle" || Boolean(activeAiScanRequest);
  const isBaselineReloading = revalidator.state !== "idle";
  const isPickerLoading = pickerFetcher.state !== "idle";

  const activeProductKnownEntry = knownProductsById[activeProductId] || null;
  const activeProductTitle =
    rawCurrentBaseline?.productTitle ||
    activeProductKnownEntry?.title ||
    (activeProductId === CANYON_RED_PRODUCT_GID ? "Canyon Red" : activeProductId);

  const {
    currentBaseline,
    currentRefChoicesRecord,
    isCurrentRefChoicesBoundAndFresh,
    isRefChoicesBusy,
    canRetryRefChoicesForCurrentProduct,
    handleLoadStandardizedReferenceChoices,
    dismissCurrentRefChoicesRecord
  } = useBenchV2StandardizedReferenceLoader({
    benchSessionId: benchSessionIdRef.current,
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
  });

  const currentBaselineRef = useRef(currentBaseline);
  currentBaselineRef.current = currentBaseline;
  const currentRefChoicesRecordRef = useRef(currentRefChoicesRecord);
  currentRefChoicesRecordRef.current = currentRefChoicesRecord;
  const isCurrentRefChoicesBoundAndFreshRef = useRef(isCurrentRefChoicesBoundAndFresh);
  isCurrentRefChoicesBoundAndFreshRef.current = isCurrentRefChoicesBoundAndFresh;

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

  const isAnyOperationBusy =
    isWriterBusy || isAiScanBusy || isRefChoicesBusy || isBaselineReloading;

  const activeProductPieceName =
    (typeof currentBaseline?.currentMetafields?.["custom.piece_name"] === "string" &&
      currentBaseline.currentMetafields["custom.piece_name"].trim() !== ""
      ? currentBaseline.currentMetafields["custom.piece_name"].trim()
      : null) ||
    activeProductKnownEntry?.pieceName ||
    null;

  const activeProductHeadline =
    activeProductPieceName && activeProductPieceName !== activeProductTitle
      ? `${activeProductPieceName} — ${activeProductTitle}`
      : activeProductTitle;

  const activeProductMediaItems = React.useMemo(() => {
    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      return [];
    }
    const edges = currentBaseline.nativeTargets?.media?.edges;
    if (!Array.isArray(edges)) return [];
    const list = [];
    for (let i = 0; i < edges.length; i++) {
      const node = edges[i]?.node;
      const url = node?.preview?.image?.url;
      if (node && typeof url === "string" && url.trim() !== "") {
        list.push({
          id: node.id || `media_${i}`,
          url: url.trim(),
          alt: typeof node.alt === "string" ? node.alt : ""
        });
      }
    }
    return list;
  }, [currentBaseline, activeProductId]);

  const submitPickerQuery = (targetSearch, targetCursor) => {
    const params = new URLSearchParams();
    params.set("pickerOnly", "1");
    if (typeof targetSearch === "string" && targetSearch.trim() !== "") {
      params.set("q", targetSearch.trim());
    }
    if (typeof targetCursor === "string" && targetCursor.trim() !== "") {
      params.set("cursor", targetCursor.trim());
    }
    pickerFetcher.load(`/app/bench-v2?${params.toString()}`);
  };

  const handleSearchFormSubmit = (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isAnyOperationBusy || isPickerLoading) return;
    const cleanQuery = searchInputText.trim();
    setCommittedSearchQuery(cleanQuery);
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    setIsProductPickerOpen(true);
    submitPickerQuery(cleanQuery, null);
  };

  const handleClearProductSearch = () => {
    if (isAnyOperationBusy || isPickerLoading) return;
    setSearchInputText("");
    setCommittedSearchQuery("");
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    submitPickerQuery("", null);
  };

  const handleNextProductPage = () => {
    if (isAnyOperationBusy || isPickerLoading) return;
    const nextCursor = pickerPageState?.pageInfo?.endCursor;
    if (!pickerPageState?.pageInfo?.hasNextPage || !nextCursor) return;

    setPickerCursorHistory((prev) => [...prev, currentPickerCursor]);
    setCurrentPickerCursor(nextCursor);
    submitPickerQuery(committedSearchQuery, nextCursor);
  };

  const handlePreviousProductPage = () => {
    if (isAnyOperationBusy || isPickerLoading || pickerCursorHistory.length === 0) return;
    const prevCursor = pickerCursorHistory[pickerCursorHistory.length - 1] ?? null;
    setPickerCursorHistory((prev) => prev.slice(0, -1));
    setCurrentPickerCursor(prevCursor);
    submitPickerQuery(committedSearchQuery, prevCursor);
  };

  const handleSelectProductGid = (nextProductGid) => {
    if (isWriterBusy || isAiScanBusy || isRefChoicesBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: isWriterBusy
          ? "Cannot switch products while saving"
          : isAiScanBusy
            ? "Cannot switch products while AI Scan is running"
            : "Cannot switch products while loading reference choices",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before switching products."
            : isAiScanBusy
              ? "Wait for the current AI Scan to finish before switching products."
              : "Wait for the current reference choices request to finish before switching products."
        ]
      });
      return;
    }

    if (!isExactProductGid(nextProductGid)) {
      return;
    }

    if (nextProductGid === activeProductId) {
      setIsProductPickerOpen(false);
      return;
    }

    setClientPrevalidationBanner(null);
    setIsProductPickerOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("productId", nextProductGid);
    if (committedSearchQuery) {
      nextParams.set("q", committedSearchQuery);
    } else {
      nextParams.delete("q");
    }
    if (currentPickerCursor) {
      nextParams.set("cursor", currentPickerCursor);
    } else {
      nextParams.delete("cursor");
    }
    setSearchParams(nextParams);
  };

  const handleExplicitAiScanProduct = () => {
    setClientPrevalidationBanner(null);

    if (isAnyOperationBusy) {
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

      const isSeoTitleDualKey = bareKey === "seo_title";
      const candidateDestKeys = isSeoTitleDualKey
        ? ["custom.seo_title", "native_seo_title"]
        : [destKey];

      let lockedHumanVal = "";
      let hasLockedHumanOrKeepOriginal = false;

      for (const checkDest of candidateDestKeys) {
        const propEntry = currentProposedMap[checkDest];
        const hasHumanDraft = Boolean(
          propEntry &&
            typeof propEntry === "object" &&
            propEntry.origin === "Manual" &&
            typeof propEntry.value === "string" &&
            propEntry.value.trim() !== ""
        );

        const approvalRec = currentApprovalsMap[checkDest];
        const hasValidApproval = Boolean(
          approvalRec &&
            propEntry &&
            isExactValueApprovalValid({
              approvalRecord: approvalRec,
              productId: activeProductId,
              destinationKey: checkDest,
              currentProposedValue:
                typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
              baselineSnapshot: currentBaseline
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
              currentProposedValue:
                typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
              baselineSnapshot: currentBaseline
            })
        );

        if (hasHumanDraft || hasValidApproval) {
          const humanVal =
            typeof propEntry === "object" ? propEntry.value.trim() : String(propEntry || "").trim();
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
    const existingProdApprovals = approvalsByProductRef.current[scannedProductId] || {};
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
      displayNote = ""
    }) => {
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

      const formattedSuffix = displayNote ? ` [${displayNote}]` : "";

      if (hasProtectedHumanState) {
        if (existingDraftVal === normalizedValue && !hasValidKeepOriginal) {
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

      existingProdProposals[destKey] = {
        value: normalizedValue,
        source: reportedSource,
        origin: "AI",
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
      if (CANCELLED_INERT_DESTINATIONS.has(destKey)) {
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

      // Check for the 4 producer-backed geology reference companions and 6 Vision standardized candidates
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
            displayNote: `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`
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

      stageOrHoldResolvedProposal({
        destKey,
        normalizedValue: validation.normalizedValue,
        reportedSource
      });
    }

    setProposedByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdProposals
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
  }, [aiScanFetcher.state, aiScanFetcher.data, activeProductId]);

  // ==========================================================================
  // DEFERRED GEOLOGY & VISION REFERENCE CANDIDATE RESOLUTION (WHEN REF CHOICES
  // ARRIVE AFTER AI SCAN) — ONCE PER SCAN REQUEST, NO RESCAN, NO LOOPS, NO AUTO-APPROVE
  // ==========================================================================
  useEffect(() => {
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
    const existingProdApprovals = approvalsByProductRef.current[activeProductId] || {};
    const existingProdKeepOriginal = keepOriginalByProductRef.current[activeProductId] || {};
    const nextAiAlternativesForProd = {};

    let addedStaged = 0;
    let addedHeld = 0;
    let addedUnchanged = 0;
    let addedRejected = 0;
    const updatedProposalsMeta = {};
    const updatedDiagnostics = {};
    const appendedDetails = [];

    for (const [destKey, candItem] of destEntries) {
      if (!candItem || !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)) {
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
        const displayNote = `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`;
        updatedDiagnostics[destKey] = null;

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
            productId: activeProductId,
            destinationKey: destKey,
            currentProposedValue: existingDraftVal,
            baselineSnapshot: currentBaseline
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
          if (existingDraftVal === normalizedValue && !hasValidKeepOriginal) {
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
          existingProdProposals[destKey] = {
            value: normalizedValue,
            source: reportedSource,
            origin: "AI",
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
      setProposedByProduct((prev) => ({
        ...prev,
        [activeProductId]: existingProdProposals
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
    activeProductId,
    isCurrentRefChoicesBoundAndFresh,
    currentRefChoicesRecord,
    currentBaseline
  ]);

  const handleAcceptAiAlternative = (destinationKey) => {
    setClientPrevalidationBanner(null);
    const altEntry = currentAiAlternativesMap[destinationKey];
    if (!altEntry || typeof altEntry.value !== "string") return;

    const contract = getFieldContractByDestination(destinationKey);
    if (isManualOnlyNoAiDestination(destinationKey, contract)) {
      return;
    }

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: altEntry.value,
        source:
          typeof altEntry.source === "string" && altEntry.source.trim() !== ""
            ? altEntry.source.trim()
            : "Source not reported",
        origin: "AI",
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

  const handleReloadProduct = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

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
  }, [writerFetcher.state, writerFetcher.data, revalidator]);

  const handleManualProposalChange = (destinationKey, rawNewValue) => {
    setClientPrevalidationBanner(null);
    const exactString = typeof rawNewValue === "string" ? rawNewValue : String(rawNewValue ?? "");

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactString,
        source: "Manual",
        origin: "Manual",
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
  };

  /**
   * Preserves both existing saved Metaobject GIDs on the product AND any valid
   * Metaobject GIDs already staged in the current proposal when selecting a preset
   * reference option, so selecting a second choice appends rather than
   * silently replacing a prior staged addition.
   */
  const handleSelectPresetOption = (row, selectedOptionValue) => {
    const destKey = row.contract.destinationKey;
    if (row.contract.namespace !== "shopify") {
      handleManualProposalChange(destKey, selectedOptionValue);
      return;
    }

    const storedCheck = inspectStoredReferenceListRawValue(
      row.baselineObservation?.rawValue
    );
    if (!storedCheck.valid) {
      handleManualProposalChange(destKey, selectedOptionValue);
      return;
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
      handleManualProposalChange(destKey, selectedOptionValue);
      return;
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

    handleManualProposalChange(destKey, JSON.stringify(mergedGids));
  };

  const handleClearDraftProposal = (destinationKey) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    clearDecisionForDestination(setProposedByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
  };

  const handleToggleApproval = (destinationKey, currentlyApproved) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyApproved) {
      clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
      return;
    }

    const exactProposedValue = getProposalValueString(currentProposedMap[destinationKey]);

    const fidelity = checkExistingWriterStringFidelity(exactProposedValue);
    if (!fidelity.faithful) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot approve ${destinationKey} yet`,
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
        title: `Cannot approve ${destinationKey}`,
        reasons: [created.error || "Proposal failed validation."]
      });
      return;
    }

    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);

    setApprovalsByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  const handleToggleKeepOriginal = (destinationKey, currentlyKeepOriginal) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyKeepOriginal) {
      clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
      return;
    }

    const exactProposedValue = getProposalValueString(currentProposedMap[destinationKey]);

    const created = createKeepOriginalRecord({
      productId: activeProductId,
      destinationKey,
      rejectedProposedValue: exactProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!created.ok || !created.record) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot mark Keep Original for ${destinationKey}`,
        reasons: [created.error || "Cannot bind Keep Original record."]
      });
      return;
    }

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);

    setKeepOriginalByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  const {
    activeSaveReportForCurrentProduct,
    evaluatedDrawerGroups,
    visibleDrawerGroups,
    allEvaluatedRows,
    totalVisibleFilteredRowCount,
    stagedProposalRows,
    validApprovedRows,
    keepOriginalRows,
    heldAiAlternativesCount
  } = evaluateAndFilterBenchV2Drawers({
    activeProductId,
    currentBaseline,
    currentProposedMap,
    currentAiAlternativesMap,
    currentApprovalsMap,
    currentKeepOriginalMap,
    currentScanProposalsMetaMap,
    retainedFieldEditorsByProduct,
    lastSaveReport,
    activeFilter,
    isRefChoicesBusy,
    drawerGroups: BENCH_V2_DRAWER_GROUPS
  });

  const hasBaselineErrors = Boolean(
    loaderData?.selectionError ||
      pickerPageState?.error ||
      loaderData?.loadError ||
      (Array.isArray(currentBaseline?.errors) && currentBaseline.errors.length > 0) ||
      currentBaseline?.metafieldsReadComplete !== true ||
      currentBaseline?.defsReadComplete !== true
  );

  // ==========================================================================
  // SIDEKICK LIVE BENCH SNAPSHOT BUILDER & SINGLE-FLIGHT PUBLISHER
  // ==========================================================================
  const { telemetrySyncStatus } = useBenchV2LiveTelemetryPublisher({
    benchSessionId: benchSessionIdRef.current,
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
    selectionError: loaderData?.selectionError || null,
    loadError: loaderData?.loadError || null,
    clientPrevalidationBanner,
    plainDrawerTitles: PLAIN_DRAWER_TITLES
  });

  const handleExplicitSaveApprovedChanges = () => {
    setClientPrevalidationBanner(null);

    if (isWriterBusy || isAiScanBusy || isRefChoicesBusy) {
      setClientPrevalidationBanner({
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
    formData.append("legacyKeysToRemove", JSON.stringify([]));

    writerFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-api"
    });
  };

  const pickerItems = Array.isArray(pickerPageState?.items) ? pickerPageState.items : [];
  const isSelectedProductInCurrentPickerPage = pickerItems.some(
    (item) => item.id === activeProductId
  );

  const prevPageDisabled =
    isAnyOperationBusy || isPickerLoading || pickerCursorHistory.length === 0;
  const nextPageDisabled =
    isAnyOperationBusy ||
    isPickerLoading ||
    !pickerPageState?.pageInfo?.hasNextPage ||
    !pickerPageState?.pageInfo?.endCursor;

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#f1f5f9",
        color: "#0f172a",
        minHeight: "100vh",
        padding: "24px 20px 80px 20px",
        fontSize: "16px",
        lineHeight: 1.6
      }}
    >
      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        <BenchV2HeaderAndBannersView
          activeProductId={activeProductId}
          activeProductTitle={activeProductTitle}
          activeProductPieceName={activeProductPieceName}
          activeProductHeadline={activeProductHeadline}
          activeProductMediaItems={activeProductMediaItems}
          stagedProposalRowsCount={stagedProposalRows.length}
          validApprovedRowsCount={validApprovedRows.length}
          keepOriginalRowsCount={keepOriginalRows.length}
          heldAiAlternativesCount={heldAiAlternativesCount}
          totalVisibleFilteredRowCount={totalVisibleFilteredRowCount}
          allEvaluatedRowsCount={allEvaluatedRows.length}
          isAnyOperationBusy={isAnyOperationBusy}
          isAiScanBusy={isAiScanBusy}
          isWriterBusy={isWriterBusy}
          isBaselineReloading={isBaselineReloading}
          isPickerLoading={isPickerLoading}
          isRefChoicesBusy={isRefChoicesBusy}
          currentBaseline={currentBaseline}
          canRetryRefChoicesForCurrentProduct={canRetryRefChoicesForCurrentProduct}
          isCurrentRefChoicesBoundAndFresh={isCurrentRefChoicesBoundAndFresh}
          searchInputText={searchInputText}
          setSearchInputText={setSearchInputText}
          committedSearchQuery={committedSearchQuery}
          isProductPickerOpen={isProductPickerOpen}
          setIsProductPickerOpen={setIsProductPickerOpen}
          pickerItems={pickerItems}
          pickerCursorHistoryLength={pickerCursorHistory.length}
          isSelectedProductInCurrentPickerPage={isSelectedProductInCurrentPickerPage}
          prevPageDisabled={prevPageDisabled}
          nextPageDisabled={nextPageDisabled}
          proposedByProduct={proposedByProduct}
          approvalsByProduct={approvalsByProduct}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          telemetrySyncStatus={telemetrySyncStatus}
          hasBaselineErrors={hasBaselineErrors}
          selectionError={loaderData?.selectionError || null}
          pickerPageError={pickerPageState?.error || null}
          loadError={loaderData?.loadError || null}
          currentRefChoicesRecord={currentRefChoicesRecord}
          currentAiScanReport={currentAiScanReport}
          clientPrevalidationBanner={clientPrevalidationBanner}
          setClientPrevalidationBanner={setClientPrevalidationBanner}
          lastSaveReport={lastSaveReport}
          setLastSaveReport={setLastSaveReport}
          handleExplicitAiScanProduct={handleExplicitAiScanProduct}
          handleLoadStandardizedReferenceChoices={handleLoadStandardizedReferenceChoices}
          handleReloadProduct={handleReloadProduct}
          handleExplicitSaveApprovedChanges={handleExplicitSaveApprovedChanges}
          handleSearchFormSubmit={handleSearchFormSubmit}
          handleClearProductSearch={handleClearProductSearch}
          handlePreviousProductPage={handlePreviousProductPage}
          handleNextProductPage={handleNextProductPage}
          handleSelectProductGid={handleSelectProductGid}
          handleSetAllDrawers={handleSetAllDrawers}
          dismissCurrentRefChoicesRecord={dismissCurrentRefChoicesRecord}
          handleDismissAiScanReport={handleDismissAiScanReport}
        />

        <BenchV2DrawersView
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          totalVisibleFilteredRowCount={totalVisibleFilteredRowCount}
          activeProductId={activeProductId}
          activeProductTitle={activeProductTitle}
          benchSessionId={benchSessionIdRef.current}
          telemetrySyncStatus={telemetrySyncStatus}
          validApprovedRowsCount={validApprovedRows.length}
          keepOriginalRowsCount={keepOriginalRows.length}
          visibleDrawerGroups={visibleDrawerGroups}
          openDrawersById={openDrawersById}
          canRetryRefChoicesForCurrentProduct={canRetryRefChoicesForCurrentProduct}
          isAnyOperationBusy={isAnyOperationBusy}
          currentBaseline={currentBaseline}
          isRefChoicesBusy={isRefChoicesBusy}
          isCurrentRefChoicesBoundAndFresh={isCurrentRefChoicesBoundAndFresh}
          currentRefChoicesRecord={currentRefChoicesRecord}
          handleToggleDrawer={handleToggleDrawer}
          handleLoadStandardizedReferenceChoices={handleLoadStandardizedReferenceChoices}
          handleFieldEditorFocus={handleFieldEditorFocus}
          handleFieldEditorBlur={handleFieldEditorBlur}
          handleSelectPresetOption={handleSelectPresetOption}
          handleManualProposalChange={handleManualProposalChange}
          handleClearDraftProposal={handleClearDraftProposal}
          handleAcceptAiAlternative={handleAcceptAiAlternative}
          handleDismissAiAlternative={handleDismissAiAlternative}
          handleToggleApproval={handleToggleApproval}
          handleToggleKeepOriginal={handleToggleKeepOriginal}
        />
      </div>
    </div>
  );
}
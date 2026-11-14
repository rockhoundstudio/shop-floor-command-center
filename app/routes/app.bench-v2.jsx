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
// copy controls, atomic JSON draft packet staging, and Sidekick live bench
// snapshot sync.
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useFetcher, useRevalidator, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { loadSingleProductBaselineSnapshot } from "../utils/bench-v2.baseline.server.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_DRAWER_GROUPS,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  getFieldContractByDestination,
  inspectStoredReferenceListRawValue,
  createExactValueApprovalRecord,
  createKeepOriginalRecord
} from "../utils/bench-v2.contract.jsx";
import {
  isExactMetaobjectGid
} from "../utils/meta-injector.standardized.jsx";
import {
  useBenchV2StandardizedReferenceLoader
} from "../utils/bench-v2.reference-loader.jsx";
import {
  getProposalValueString,
  hasExplicitReferenceReplacementFlag,
  useBenchV2JsonDraftImporter
} from "../utils/bench-v2.json-draft-importer.jsx";
import {
  useBenchV2AiScanController,
  useBenchV2DeferredAiReferenceResolver
} from "../utils/bench-v2.ai-scan-controller.jsx";
import {
  useBenchV2SaveController
} from "../utils/bench-v2.save-controller.jsx";
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

  // 6. Exact-Value Approval Records State
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 7. Keep Original Decision Records State
  const [keepOriginalByProduct, setKeepOriginalByProduct] = useState({});

  // 8. Client Prevalidation Notice Banner State
  const [clientPrevalidationBanner, setClientPrevalidationBanner] = useState(null);

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

  // 12. Shared Bench Session Identity (Owned by Bench, shared by Reference Loader, Importer, AI Controller & Telemetry)
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

  const isBaselineReloading = revalidator.state !== "idle";
  const isPickerLoading = pickerFetcher.state !== "idle";

  const activeProductKnownEntry = knownProductsById[activeProductId] || null;
  const activeProductTitle =
    rawCurrentBaseline?.productTitle ||
    activeProductKnownEntry?.title ||
    (activeProductId === CANYON_RED_PRODUCT_GID ? "Canyon Red" : activeProductId);

  // Declare shared live-state refs prior to hooks and synchronize immediately after
  // each hook so neither hook experiences temporal-dead-zone reads or circular busy state.
  const activeProductIdRef = useRef(activeProductId);
  activeProductIdRef.current = activeProductId;
  const isSwitchingSelectedProductRef = useRef(isSwitchingSelectedProduct);
  isSwitchingSelectedProductRef.current = isSwitchingSelectedProduct;
  const rawCurrentBaselineRef = useRef(rawCurrentBaseline);
  rawCurrentBaselineRef.current = rawCurrentBaseline;
  const currentBaselineRef = useRef(rawCurrentBaseline);
  const currentRefChoicesRecordRef = useRef(null);
  const isCurrentRefChoicesBoundAndFreshRef = useRef(false);
  const isAiScanBusyRef = useRef(false);
  const isRefChoicesBusyRef = useRef(false);
  const isAnyOperationBusyRef = useRef(false);

  // 9D. Atomic JSON Draft Importer Hook & Replay Protection
  const {
    isJsonImportPanelOpen,
    setIsJsonImportPanelOpen,
    jsonImportPasteText,
    setJsonImportPasteText,
    isJsonImportBusy,
    currentJsonImportReport,
    handleJsonDraftFileSelect,
    handleApplyPastedJsonDraftPacket,
    handleClearJsonImportPasteText,
    handleDismissJsonImportReport
  } = useBenchV2JsonDraftImporter({
    activeProductId,
    activeProductIdRef,
    benchSessionIdRef,
    baselineByProductRef,
    rawCurrentBaselineRef,
    currentBaselineRef,
    isCurrentRefChoicesBoundAndFreshRef,
    isSwitchingSelectedProductRef,
    isAnyOperationBusyRef,
    proposedByProductRef,
    setProposedByProduct,
    approvalsByProductRef,
    keepOriginalByProductRef,
    setClientPrevalidationBanner
  });

  // 8. Save Request Tracking, Prevalidation & Verified-Only Readback Controller Hook
  const {
    isWriterBusy,
    lastSaveReport,
    setLastSaveReport,
    handleExplicitSaveApprovedChanges
  } = useBenchV2SaveController({
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
    setOpenDrawersById
  });

  // 9. Explicit AI Scan Request, Candidate Resolution & Held Alternatives Controller Hook
  const {
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
  } = useBenchV2AiScanController({
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
  });

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
    isWriterBusy: isWriterBusy || isJsonImportBusy,
    isAiScanBusy,
    isBaselineReloading,
    setClientPrevalidationBanner
  });

  currentBaselineRef.current = currentBaseline;
  currentRefChoicesRecordRef.current = currentRefChoicesRecord;
  isCurrentRefChoicesBoundAndFreshRef.current = isCurrentRefChoicesBoundAndFresh;
  isAiScanBusyRef.current = isAiScanBusy;
  isRefChoicesBusyRef.current = isRefChoicesBusy;

  const isAnyOperationBusy =
    isWriterBusy || isAiScanBusy || isRefChoicesBusy || isBaselineReloading;

  isAnyOperationBusyRef.current = isAnyOperationBusy;

  // 9C. Deferred Geology & Vision Reference Candidate Resolution Hook (Reactive)
  useBenchV2DeferredAiReferenceResolver({
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
  });

  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};

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
    if (isAnyOperationBusy || isJsonImportBusy || isPickerLoading) return;
    const cleanQuery = searchInputText.trim();
    setCommittedSearchQuery(cleanQuery);
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    setIsProductPickerOpen(true);
    submitPickerQuery(cleanQuery, null);
  };

  const handleClearProductSearch = () => {
    if (isAnyOperationBusy || isJsonImportBusy || isPickerLoading) return;
    setSearchInputText("");
    setCommittedSearchQuery("");
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    submitPickerQuery("", null);
  };

  const handleNextProductPage = () => {
    if (isAnyOperationBusy || isJsonImportBusy || isPickerLoading) return;
    const nextCursor = pickerPageState?.pageInfo?.endCursor;
    if (!pickerPageState?.pageInfo?.hasNextPage || !nextCursor) return;

    setPickerCursorHistory((prev) => [...prev, currentPickerCursor]);
    setCurrentPickerCursor(nextCursor);
    submitPickerQuery(committedSearchQuery, nextCursor);
  };

  const handlePreviousProductPage = () => {
    if (
      isAnyOperationBusy ||
      isJsonImportBusy ||
      isPickerLoading ||
      pickerCursorHistory.length === 0
    ) {
      return;
    }
    const prevCursor = pickerCursorHistory[pickerCursorHistory.length - 1] ?? null;
    setPickerCursorHistory((prev) => prev.slice(0, -1));
    setCurrentPickerCursor(prevCursor);
    submitPickerQuery(committedSearchQuery, prevCursor);
  };

  const handleSelectProductGid = (nextProductGid) => {
    if (isWriterBusy || isAiScanBusy || isRefChoicesBusy || isJsonImportBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: isWriterBusy
          ? "Cannot switch products while saving"
          : isAiScanBusy
            ? "Cannot switch products while AI Scan is running"
            : isJsonImportBusy
              ? "Cannot switch products while reading JSON draft packet"
              : "Cannot switch products while loading reference choices",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before switching products."
            : isAiScanBusy
              ? "Wait for the current AI Scan to finish before switching products."
              : isJsonImportBusy
                ? "Wait for the current JSON draft import to finish before switching products."
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
    setIsJsonImportPanelOpen(false);
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

  const handleReloadProduct = useCallback(() => {
    revalidator.revalidate();
  }, [revalidator]);

  const stageManualProposalForDestination = (
    destinationKey,
    rawNewValue,
    allowExplicitReplacement = false
  ) => {
    setClientPrevalidationBanner(null);
    const exactString = typeof rawNewValue === "string" ? rawNewValue : String(rawNewValue ?? "");
    const contract = getFieldContractByDestination(destinationKey);
    const shouldBindExplicitReplacement = Boolean(
      allowExplicitReplacement === true &&
        contract?.namespace === "shopify" &&
        contract?.expectedType === "list.metaobject_reference" &&
        exactString.trim() !== ""
    );

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactString,
        source: "Manual",
        origin: "Manual",
        ...(shouldBindExplicitReplacement
          ? {
              allowExplicitReferenceListReplacement: true,
              explicitReplacementValue: exactString
            }
          : {}),
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
  };

  const handleManualProposalChange = (destinationKey, rawNewValue) => {
    stageManualProposalForDestination(destinationKey, rawNewValue, false);
  };

  /**
   * Stages an unapproved Manual draft that removes a single Metaobject GID
   * from a writable `shopify.*` (`list.metaobject_reference`) field's active
   * selection (current draft when present, otherwise saved baseline).
   * Requires a valid non-empty active list with > 1 entries.
   */
  const handleRemoveReferenceChoiceGid = (row, gidToRemove) => {
    if (!row || !row.contract) return;
    const { contract, baselineObservation: obs } = row;
    const destKey = contract.destinationKey;

    if (
      !contract.isWritableInBatch1 ||
      contract.namespace !== "shopify" ||
      contract.expectedType !== "list.metaobject_reference"
    ) {
      return;
    }

    if (isAnyOperationBusy || isJsonImportBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Cannot edit reference list while an operation is busy",
        reasons: ["Wait for the current operation to finish before removing a reference choice."]
      });
      return;
    }

    if (!isExactMetaobjectGid(gidToRemove)) {
      return;
    }
    const cleanGidToRemove = gidToRemove.trim();

    const storedCheck = inspectStoredReferenceListRawValue(obs?.rawValue);
    if (!storedCheck.valid) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot remove reference choice on ${destKey}`,
        reasons: [
          storedCheck.error || "Stored baseline reference list could not be parsed safely."
        ]
      });
      return;
    }

    let activeGids = [];
    if (row.hasProposalKey) {
      const rawDraft = typeof row.proposedValue === "string" ? row.proposedValue : "";
      let parsedDraft = null;
      try {
        parsedDraft = JSON.parse(rawDraft);
      } catch {
        parsedDraft = null;
      }
      const draftCheck = inspectStoredReferenceListRawValue(rawDraft);
      const isDraftCanonicalValid = Boolean(
        Array.isArray(parsedDraft) &&
          parsedDraft.length > 0 &&
          draftCheck.valid &&
          draftCheck.gids.length === parsedDraft.length &&
          JSON.stringify(parsedDraft) === rawDraft &&
          (!row.validation || row.validation.valid === true)
      );

      if (!isDraftCanonicalValid) {
        setClientPrevalidationBanner({
          tone: "error",
          title: `Cannot remove reference choice on ${destKey}: active draft is invalid`,
          reasons: [
            row.validation?.reason ||
              draftCheck.error ||
              "Fix the active draft or click Reset to Saved before removing an entry."
          ]
        });
        return;
      }
      activeGids = draftCheck.gids;
    } else {
      activeGids = storedCheck.gids;
    }

    if (!activeGids.includes(cleanGidToRemove)) {
      return;
    }

    if (activeGids.length <= 1) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: `Cannot remove the last remaining reference entry on ${destKey}`,
        reasons: [
          "Removing the last remaining reference entry is disabled because this app's current validation and writer do not support clearing a reference list to empty. Use Reset to Saved or Keep Original to abandon unsaved draft changes."
        ]
      });
      return;
    }

    const nextGids = activeGids.filter((g) => g !== cleanGidToRemove);
    if (nextGids.length === 0) {
      return;
    }

    const nextSerialized = JSON.stringify(nextGids);
    const nextSet = new Set(nextGids);
    const omitsAnyStoredGid = storedCheck.gids.some((g) => !nextSet.has(g));

    stageManualProposalForDestination(destKey, nextSerialized, omitsAnyStoredGid);
  };

  /**
   * Handles selecting a preset option from the dropdown.
   * - For non-reference preset dropdowns: if no draft is currently staged and the
   *   selected option matches the verified stored baseline value, does not stage
   *   a redundant no-change draft and shows an info banner ("Already saved on product
   *   (no change to approve)"); if an existing draft is returned to the stored baseline,
   *   clears only that destination's draft and obsolete approval while preserving any
   *   Keep Original decision.
   * - For `shopify.*` (`list.metaobject_reference`):
   *   * When a draft is active (`row.hasProposalKey`), requires the active draft
   *     to be a valid non-empty canonical GID list (never silently falling back to
   *     `storedCheck.gids` on invalid/empty drafts) and appends `selectedGids` to
   *     the active draft list without re-seeding removed saved GIDs.
   *   * When no draft is active, seeds from `storedCheck.gids` and appends `selectedGids`.
   *   * When the resulting `nextSerialized` equals the stored baseline (`!stillOmitsStoredGid`
   *     and identical GID sequence/raw JSON): if no draft is active, omits redundant
   *     staging and displays an info notice; if a draft was active, clears that draft
   *     and its now-obsolete approval while preserving any Keep Original record.
   *   * Preserves `allowExplicitReferenceListReplacement` when the resulting list
   *     still omits a saved baseline GID from an explicit operator removal.
   */
  const handleSelectPresetOption = (row, selectedOptionValue) => {
    const destKey = row.contract.destinationKey;
    const obs = row.baselineObservation;

    if (
      row.contract.namespace !== "shopify" ||
      row.contract.expectedType !== "list.metaobject_reference"
    ) {
      const exactOptionStr =
        typeof selectedOptionValue === "string"
          ? selectedOptionValue
          : String(selectedOptionValue ?? "");
      const matchesStoredNonRefBaseline = Boolean(
        obs?.evidenceAvailable &&
          obs.presence === "present" &&
          typeof obs.rawValue === "string" &&
          obs.rawValue === exactOptionStr
      );

      if (matchesStoredNonRefBaseline) {
        if (!row.hasProposalKey) {
          setClientPrevalidationBanner({
            tone: "info",
            title: `Already saved on product (no change to approve): ${row.plainLabel || destKey}`,
            reasons: [
              `The selected value "${exactOptionStr}" is already saved on ${activeProductTitle} for ${destKey}. No new draft was staged.`
            ]
          });
          return;
        }
        setClientPrevalidationBanner(null);
        releaseRetainedFieldEditor(activeProductId, destKey);
        clearDecisionForDestination(setProposedByProduct, activeProductId, destKey);
        clearDecisionForDestination(setApprovalsByProduct, activeProductId, destKey);
        return;
      }

      handleManualProposalChange(destKey, selectedOptionValue);
      return;
    }

    const storedCheck = inspectStoredReferenceListRawValue(obs?.rawValue);
    if (!storedCheck.valid) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot select reference choice on ${destKey}`,
        reasons: [
          storedCheck.error || "Stored baseline reference list could not be parsed safely."
        ]
      });
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
      return;
    }

    let baseGids = [];
    const rawPropEntry = currentProposedMap[destKey];
    const priorWasExplicitReplacement = Boolean(
      row.allowExplicitReferenceListReplacement === true ||
        hasExplicitReferenceReplacementFlag(rawPropEntry, destKey, row.proposedValue)
    );

    if (row.hasProposalKey) {
      const rawDraft = typeof row.proposedValue === "string" ? row.proposedValue : "";
      let parsedCurrent = null;
      try {
        parsedCurrent = JSON.parse(rawDraft);
      } catch {
        parsedCurrent = null;
      }
      const draftCheck = inspectStoredReferenceListRawValue(rawDraft);
      const verifiedMap =
        row.referenceEvidence?.isComplete &&
        row.referenceEvidence.entriesByGid instanceof Map
          ? row.referenceEvidence.entriesByGid
          : null;
      const allDraftMembersVerified = Boolean(
        draftCheck.valid &&
          draftCheck.gids.length > 0 &&
          (!verifiedMap || draftCheck.gids.every((g) => verifiedMap.has(g)))
      );
      const isDraftValidForAppend = Boolean(
        Array.isArray(parsedCurrent) &&
          parsedCurrent.length > 0 &&
          draftCheck.valid &&
          draftCheck.gids.length === parsedCurrent.length &&
          JSON.stringify(parsedCurrent) === rawDraft &&
          allDraftMembersVerified &&
          (!row.validation || row.validation.valid === true)
      );

      if (!isDraftValidForAppend) {
        setClientPrevalidationBanner({
          tone: "error",
          title: `Cannot append reference choice on ${destKey}: active draft is invalid or empty`,
          reasons: [
            row.validation?.reason ||
              draftCheck.error ||
              "Fix the active draft or click Reset to Saved before selecting another option."
          ]
        });
        return;
      }

      baseGids = draftCheck.gids;
    } else {
      baseGids = storedCheck.gids;
    }

    const mergedGids = [];
    const pushUnique = (gid) => {
      if (isExactMetaobjectGid(gid) && !mergedGids.includes(gid)) {
        mergedGids.push(gid);
      }
    };

    baseGids.forEach(pushUnique);
    selectedGids.forEach(pushUnique);

    const nextSerialized = JSON.stringify(mergedGids);
    const mergedSet = new Set(mergedGids);
    const stillOmitsStoredGid = storedCheck.gids.some((g) => !mergedSet.has(g));

    const isIdenticalToStoredRefBaseline = Boolean(
      !stillOmitsStoredGid &&
        obs?.evidenceAvailable &&
        obs.presence === "present" &&
        storedCheck.gids.length === mergedGids.length &&
        storedCheck.gids.every((g, idx) => g === mergedGids[idx]) &&
        typeof obs.rawValue === "string" &&
        obs.rawValue === nextSerialized
    );

    if (isIdenticalToStoredRefBaseline) {
      if (!row.hasProposalKey) {
        setClientPrevalidationBanner({
          tone: "info",
          title: `Already saved on product (no change to approve): ${row.plainLabel || destKey}`,
          reasons: [
            `The selected reference choice is already saved in ${destKey} on ${activeProductTitle} (${row.readableSaved || nextSerialized}). No new draft was staged.`
          ]
        });
        return;
      }
      setClientPrevalidationBanner(null);
      releaseRetainedFieldEditor(activeProductId, destKey);
      clearDecisionForDestination(setProposedByProduct, activeProductId, destKey);
      clearDecisionForDestination(setApprovalsByProduct, activeProductId, destKey);
      return;
    }

    stageManualProposalForDestination(
      destKey,
      nextSerialized,
      Boolean(priorWasExplicitReplacement && stillOmitsStoredGid)
    );
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

    const rawPropEntry = currentProposedMap[destinationKey];
    const exactProposedValue = getProposalValueString(rawPropEntry);
    const allowExplicitReplacement = hasExplicitReferenceReplacementFlag(
      rawPropEntry,
      destinationKey,
      exactProposedValue
    );

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
      baselineSnapshot: currentBaseline,
      allowExplicitReferenceListReplacement: allowExplicitReplacement
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
    isWriterBusy: isWriterBusy || isJsonImportBusy,
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

  const pickerItems = Array.isArray(pickerPageState?.items) ? pickerPageState.items : [];
  const isSelectedProductInCurrentPickerPage = pickerItems.some(
    (item) => item.id === activeProductId
  );

  const prevPageDisabled =
    isAnyOperationBusy || isJsonImportBusy || isPickerLoading || pickerCursorHistory.length === 0;
  const nextPageDisabled =
    isAnyOperationBusy ||
    isJsonImportBusy ||
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
          isJsonImportPanelOpen={isJsonImportPanelOpen}
          setIsJsonImportPanelOpen={setIsJsonImportPanelOpen}
          jsonImportPasteText={jsonImportPasteText}
          setJsonImportPasteText={setJsonImportPasteText}
          isJsonImportBusy={isJsonImportBusy}
          currentJsonImportReport={currentJsonImportReport}
          handleJsonDraftFileSelect={handleJsonDraftFileSelect}
          handleApplyPastedJsonDraftPacket={handleApplyPastedJsonDraftPacket}
          handleClearJsonImportPasteText={handleClearJsonImportPasteText}
          handleDismissJsonImportReport={handleDismissJsonImportReport}
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
          isAnyOperationBusy={isAnyOperationBusy || isJsonImportBusy}
          currentBaseline={currentBaseline}
          isRefChoicesBusy={isRefChoicesBusy}
          isCurrentRefChoicesBoundAndFresh={isCurrentRefChoicesBoundAndFresh}
          currentRefChoicesRecord={currentRefChoicesRecord}
          handleToggleDrawer={handleToggleDrawer}
          handleLoadStandardizedReferenceChoices={handleLoadStandardizedReferenceChoices}
          handleFieldEditorFocus={handleFieldEditorFocus}
          handleFieldEditorBlur={handleFieldEditorBlur}
          handleSelectPresetOption={handleSelectPresetOption}
          handleRemoveReferenceChoiceGid={handleRemoveReferenceChoiceGid}
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
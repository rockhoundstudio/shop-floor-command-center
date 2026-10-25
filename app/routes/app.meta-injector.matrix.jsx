import { UnselectedDraftManualInputs } from "../components/meta-injector.manual-intake.jsx";
// FILE: app/routes/app.meta-injector.matrix.jsx
import React, { useState, useCallback, useEffect, useRef } from "react";
import { BlockStack, Card, Text, Banner, Button, InlineStack, Box, ProgressBar, Select, Badge } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  TAB3_PARKED_DRAWER_HEADING,
  TAB3_INSPECTABLE_TEMPLATE_GROUPS,
  COMPATIBILITY_ADAPTER_FIELDS,
  computeTemplateAuditCounts
} from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  isExactMetaobjectGid,
  parseMetaobjectGidArray,
  evaluateStandardizedDestinationTechnicalStatus,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  evaluateProductReferenceMatchReadiness,
  formatErrorsList,
  validArray,
  validObj
} from "../utils/meta-injector.standardized.jsx";
import {
  STATUS,
  UNSELECTED_DRAFT_STORAGE_KEY,
  NATIVE_ALIAS_MAP,
  FILTER_OPTIONS,
  resolveApprovalStorageKey,
  resolveConfigFieldDestination,
  isParkedExcludedKey,
  createKeepOriginalDecisionRecord,
  getDynamicSections,
  getStatusTone,
  isMultilineKey,
  evaluateFieldMetadata,
  computeSystemStatus,
  computeDiagnosticsStats
} from "../utils/meta-injector.matrix-domain.jsx";
import {
  hasMeaningfulValue,
  isSegmentedMarketingTitle,
  resolveIdentifierToPreserve,
  applyTitleParseToTab3Draft
} from "../utils/meta-injector.intake-draft.jsx";
import {
  createInitialUnselectedDraftManifest,
  createInitialDraftSourceContext,
  isExactProductGid,
  isValidTelemetryPacketForProduct,
  useLiveBenchTelemetrySync
} from "../utils/meta-injector.live-bench-sync.jsx";
import {
  buildAndCopyMatrixTelemetry,
  copyCapturedTelemetryPart,
  downloadCapturedTelemetryReport
} from "../utils/meta-injector.telemetry.jsx";
import { useMetaInjectorExecution } from "../utils/meta-injector.execution-hook.jsx";
import {
  InventorySelectionColumn,
  BenchDiagnosticHeader,
  DescriptionReviewSection
} from "../components/meta-injector.bench-chrome.jsx";
import { ManifestSectionCard } from "../components/meta-injector.manifest-section.jsx";
import { UnselectedDraftSeedIntakeCard } from "../components/meta-injector.draft-intake.jsx";

// Every drawer (including Description Review and the 11th Parked / Excluded drawer) starts collapsed (false).
const INITIAL_EXPANDED_BAYS = Object.freeze({
  "Description Review": false,
  ...Object.fromEntries(
    TAB3_INSPECTABLE_TEMPLATE_GROUPS.map((g) => [g.heading, false])
  )
});

const SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS = Object.freeze({
  "custom.generated_description": ["native_description", "custom.generated_description"],
  "native_description": ["native_description", "custom.generated_description"],
  "custom.seo_title": ["native_seo_title", "custom.seo_title"],
  "native_seo_title": ["native_seo_title", "custom.seo_title"]
});

export function OperationsMatrixTab({ products }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data Loading State
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadIndex, setLoadIndex] = useState(0);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState(null);
  const [executeIndex, setExecuteIndex] = useState(0);
  const [aiStep, setAiStep] = useState(0);
  
  const [pendingOperation, setPendingOperation] = useState(null); // { id, intent, token }
  const [aiData, setAiData] = useState({}); // Indexed by pieceId to isolate cross-contamination
  const [standardizedCandidatesByProduct, setStandardizedCandidatesByProduct] = useState({});

  // Dedicated Reference Matching State (Isolated per product GID)
  const [referenceMatchResultsByProduct, setReferenceMatchResultsByProduct] = useState({});
  const [referenceMatchStatusByProduct, setReferenceMatchStatusByProduct] = useState({});
  const [pendingReferenceMatch, setPendingReferenceMatch] = useState(null);
  const [releasedReferenceMatchRequest, setReleasedReferenceMatchRequest] = useState(null);
  const [releasedReferenceMatchIds, setReleasedReferenceMatchIds] = useState({});

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  const [unselectedDraftManifest, setUnselectedDraftManifest] = useState(() =>
    createInitialUnselectedDraftManifest()
  );
  const [draftSourceContext, setDraftSourceContext] = useState(() =>
    createInitialDraftSourceContext()
  );
  const [draftEpoch, setDraftEpoch] = useState(0);
  const [lastProcessedData, setLastProcessedData] = useState(null);
  
  const [approvals, setApprovals] = useState({});
  const [keepOriginalDecisions, setKeepOriginalDecisions] = useState({});
  const [manualEdits, setManualEdits] = useState({}); 
  const [submittedPayloads, setSubmittedPayloads] = useState({}); 
  
  const [repairHistory, setRepairHistory] = useState({});

  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [telemetryPacket, setTelemetryPacket] = useState(null);
  const [sectionAuditMeasurements, setSectionAuditMeasurements] = useState({
    productId: null,
    bySection: {}
  });
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");
  const [telemetryPublishNotice, setTelemetryPublishNotice] = useState(null);

  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedBays, setExpandedBays] = useState(INITIAL_EXPANDED_BAYS);

  const isComponentMountedRef = useRef(true);
  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  const activeBenchIdRef = useRef(selectedBenchId);
  useEffect(() => {
    activeBenchIdRef.current = selectedBenchId;
  }, [selectedBenchId]);

  const unselectedDraftManifestRef = useRef(unselectedDraftManifest);
  useEffect(() => {
    unselectedDraftManifestRef.current = unselectedDraftManifest;
  }, [unselectedDraftManifest]);

  const draftSourceContextRef = useRef(draftSourceContext);
  useEffect(() => {
    draftSourceContextRef.current = draftSourceContext;
  }, [draftSourceContext]);

  const draftEpochRef = useRef(draftEpoch);
  useEffect(() => {
    draftEpochRef.current = draftEpoch;
  }, [draftEpoch]);

  const activeDraftSeedRequestIdRef = useRef(null);

  const manualEditsRef = useRef(manualEdits);
  useEffect(() => {
    manualEditsRef.current = manualEdits;
  }, [manualEdits]);

  const sectionAuditMeasurementsRef = useRef(sectionAuditMeasurements);
  useEffect(() => {
    sectionAuditMeasurementsRef.current = sectionAuditMeasurements;
  }, [sectionAuditMeasurements]);

  const batchFetcher = useFetcher();
  const referenceMatchFetcher = useFetcher();

  // Guarded no-op callbacks for operations not available in unselected draft mode (e.g. reference matching, keep-original)
  const noopPreviewCallback = useCallback(() => {}, []);

  // Prune any stale keep-original decisions when a product's baseline or proposal materially changes
  useEffect(() => {
    setKeepOriginalDecisions((prev) => {
      const productIds = Object.keys(prev || {});
      if (productIds.length === 0) return prev;
      let anyMutated = false;
      const next = { ...prev };
      const allConfigFields = [
        ...TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap((g) => g.fields || []),
        ...(COMPATIBILITY_ADAPTER_FIELDS || [])
      ];

      for (let i = 0; i < productIds.length; i += 1) {
        const pid = productIds[i];
        const prodMap = prev[pid];
        if (!prodMap || typeof prodMap !== "object") continue;
        const manifest = manifestData?.[pid];
        if (!manifest) {
          delete next[pid];
          anyMutated = true;
          continue;
        }
        const destKeys = Object.keys(prodMap);
        if (destKeys.length === 0) continue;
        let prodMutated = false;
        const nextProdMap = { ...prodMap };

        for (let j = 0; j < destKeys.length; j += 1) {
          const destKey = destKeys[j];
          const rec = prodMap[destKey];
          const evalMeta = evaluateFieldMetadata({
            key: rec?.fieldKey || destKey,
            data: manifest,
            productId: pid,
            currentApprovals: approvals,
            currentKeepOriginal: prev,
            currentManualEdits: manualEdits,
            configFields: allConfigFields,
            standardizedCandidatesByProduct,
            getStandardizedEvaluationForField: null,
            includeTab3InspectableInventory: true
          });
          if (!evalMeta.isKeepOriginalSelected) {
            delete nextProdMap[destKey];
            prodMutated = true;
          }
        }

        if (prodMutated) {
          anyMutated = true;
          if (Object.keys(nextProdMap).length === 0) {
            delete next[pid];
          } else {
            next[pid] = nextProdMap;
          }
        }
      }

      return anyMutated ? next : prev;
    });
  }, [manifestData, approvals, manualEdits, standardizedCandidatesByProduct]);

  const getStandardizedEvaluationForField = useCallback((productId, targetKey, dataOverride = null) => {
    if (!productId || typeof targetKey !== "string" || !targetKey.startsWith("shopify.")) return null;
    if (isParkedExcludedKey(targetKey)) return null;
    const data = dataOverride || manifestData[productId];
    const candidateBundle = buildCanonicalCandidateBundle(standardizedCandidatesByProduct[productId] || {});
    const rawRefMatchResult = referenceMatchResultsByProduct[productId] || null;
    const refMatchStatus = referenceMatchStatusByProduct[productId] || null;

    // Prevent an older completed match record from overriding a newer pending, failed, or cancelled attempt
    const readiness = evaluateProductReferenceMatchReadiness({
      productId,
      data,
      rawCandidates: standardizedCandidatesByProduct[productId] || {},
      refMatchResult: rawRefMatchResult,
      refMatchStatus,
      pendingReferenceMatch
    });
    const effectiveRefMatchResult =
      readiness.state === "pending" ||
      (readiness.state === "failed_or_incomplete" &&
        rawRefMatchResult &&
        refMatchStatus &&
        ((refMatchStatus.requestId &&
          rawRefMatchResult.requestId &&
          refMatchStatus.requestId !== rawRefMatchResult.requestId) ||
          (refMatchStatus.updatedAt &&
            rawRefMatchResult.matchedAt &&
            refMatchStatus.updatedAt > rawRefMatchResult.matchedAt)))
        ? null
        : rawRefMatchResult;

    return evaluateStandardizedDestinationTechnicalStatus({
      destinationKey: targetKey,
      productId,
      data,
      candidateBundle,
      refMatchResult: effectiveRefMatchResult,
      refMatchStatus
    });
  }, [
    manifestData,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    pendingReferenceMatch
  ]);

  const getFieldMetadata = (key, data, productId, currentApprovals, configFields = []) =>
    evaluateFieldMetadata({
      key,
      data,
      productId,
      currentApprovals,
      currentKeepOriginal: keepOriginalDecisions,
      currentManualEdits: manualEdits,
      configFields,
      standardizedCandidatesByProduct,
      getStandardizedEvaluationForField,
      includeTab3InspectableInventory: true
    });

  const getSystemStatus = () =>
    computeSystemStatus({
      data: manifestData[selectedBenchId],
      selectedBenchId,
      isLoadingData,
      isExecuting,
      executionMode,
      queueIds,
      loadIndex,
      executeIndex,
      aiStep,
      batchFetcherState: batchFetcher.state,
      batchFetcherFormData: batchFetcher.formData,
      referenceMatchFetcherState: referenceMatchFetcher.state,
      pendingReferenceMatch,
      referenceMatchStatusByProduct,
      safetyMessage,
      safetyError
    });

  const getDiagnosticsStats = (data, benchIdOverride = selectedBenchId) =>
    computeDiagnosticsStats({
      data,
      selectedBenchId: benchIdOverride,
      approvals,
      getFieldMetadata,
      includeTab3InspectableInventory: true
    });

  const {
    benchSessionIdRef,
    lastLiveStateRevisionRef,
    lastLiveStateDigestRef,
    lastLiveSyncedDigestRef,
    lastNotifiedSelectionClearRef,
    baselineMetaByProductRef,
    liveBenchSyncStatus,
    sendLiveBenchSelectionClear,
    handleLiveSyncOnProductSwitch,
    handleLiveSyncOnClearBench,
    publishCapturedPacketToSidekickCache
  } = useLiveBenchTelemetrySync({
    isComponentMountedRef,
    activeBenchIdRef,
    sectionAuditMeasurementsRef,
    safeProducts,
    selectedBenchId,
    isLoadingData,
    productStates,
    manifestData,
    unselectedDraftManifest,
    draftSourceContext,
    approvals,
    keepOriginalDecisions,
    manualEdits,
    repairHistory,
    submittedPayloads,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    pendingReferenceMatch,
    sectionAuditMeasurements,
    setTelemetryPublishNotice,
    getFieldMetadata,
    getSystemStatus,
    getDiagnosticsStats
  });

  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);
  
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = { status: status, logs: [...existingLogs, ...newLogs] };
      return updated;
    });
  }, []);

  const handleSelectBenchItem = useCallback((id) => {
    setSelectedBenchId((prevId) => {
      if (prevId !== id) {
        activeDraftSeedRequestIdRef.current = null;
        handleLiveSyncOnProductSwitch(prevId, id);
        setExpandedBays(INITIAL_EXPANDED_BAYS);
        setTelemetryPacket(null);
        setTelemetryPublishNotice(null);
        setSectionAuditMeasurements({ productId: id || null, bySection: {} });
      }
      return id;
    });
  }, [handleLiveSyncOnProductSwitch]);

  // Invalidate captured telemetry snapshot when a new load, AI pipeline, or repair execution starts,
  // or when the active product's repair history or reference match result changes.
  const activeProductHistoryRef = selectedBenchId ? repairHistory[selectedBenchId]?.completedAt : null;
  const activeProductMatchTimeRef = selectedBenchId ? referenceMatchResultsByProduct[selectedBenchId]?.matchedAt : null;

  useEffect(() => {
    if (isLoadingData || isExecuting) {
      setTelemetryPacket(null);
      setTelemetryPublishNotice(null);
    }
    if (isLoadingData) {
      setKeepOriginalDecisions({});
    }
    if (isLoadingData && !lastNotifiedSelectionClearRef.current) {
      sendLiveBenchSelectionClear();
    }
  }, [isLoadingData, isExecuting, lastNotifiedSelectionClearRef, sendLiveBenchSelectionClear]);

  useEffect(() => {
    setTelemetryPacket((prev) => {
      if (!prev) return null;
      if (!selectedBenchId || prev.productId !== selectedBenchId) {
        return null;
      }
      return null;
    });
    setTelemetryPublishNotice(null);
  }, [selectedBenchId, activeProductHistoryRef, activeProductMatchTimeRef]);

  const handleSectionRenderedCountChange = useCallback((payload) => {
    if (!payload || typeof payload.sectionTitle !== "string") return;
    const incomingProdId = payload.productId || null;
    const currentTargetProdId = activeBenchIdRef.current || null;
    if (incomingProdId !== currentTargetProdId) return;

    setSectionAuditMeasurements((prev) => {
      const baseBySection = prev.productId === incomingProdId ? prev.bySection : {};
      const existing = baseBySection[payload.sectionTitle];
      const nextDescriptorKeys = Array.isArray(payload.descriptorKeys)
        ? payload.descriptorKeys
        : Array.isArray(payload.renderedKeys)
          ? payload.renderedKeys
          : [];
      const nextDescriptorCount =
        typeof payload.descriptorCount === "number" && Number.isFinite(payload.descriptorCount)
          ? payload.descriptorCount
          : typeof payload.renderedCount === "number" && Number.isFinite(payload.renderedCount)
            ? payload.renderedCount
            : nextDescriptorKeys.length;
      const nextFullInventoryKeys = Array.isArray(payload.fullInventoryKeys)
        ? payload.fullInventoryKeys
        : nextDescriptorKeys;
      const nextFullInventoryRowCount =
        typeof payload.fullInventoryRowCount === "number" && Number.isFinite(payload.fullInventoryRowCount)
          ? payload.fullInventoryRowCount
          : nextFullInventoryKeys.length;
      const nextFullInventoryMediaCount =
        typeof payload.fullInventoryMediaControlCount === "number" &&
        Number.isFinite(payload.fullInventoryMediaControlCount)
          ? payload.fullInventoryMediaControlCount
          : (typeof payload.mediaControlCount === "number" ? payload.mediaControlCount : 0);
      const nextFullInventoryHasZeroPlaceholder =
        typeof payload.fullInventoryHasZeroImagePlaceholder === "boolean"
          ? payload.fullInventoryHasZeroImagePlaceholder
          : Boolean(payload.hasZeroImagePlaceholder);
      const nextMountedDomKeys = Array.isArray(payload.mountedDomKeys)
        ? payload.mountedDomKeys
        : [];
      const nextMountedDomRowCount =
        typeof payload.mountedDomRowCount === "number" && Number.isFinite(payload.mountedDomRowCount)
          ? payload.mountedDomRowCount
          : null;
      const nextIsExpanded =
        typeof payload.isExpanded === "boolean" ? payload.isExpanded : null;
      const nextIsParkedGroup = Boolean(payload.isParkedGroup);
      const nextActiveFilter = typeof payload.activeFilter === "string" ? payload.activeFilter : "All";
      const nextSectionDomMounted =
        typeof payload.sectionDomMounted === "boolean" ? payload.sectionDomMounted : null;
      const nextRowsContainerDomMounted =
        typeof payload.rowsContainerDomMounted === "boolean"
          ? payload.rowsContainerDomMounted
          : null;
      const nextMountedDomMediaCount =
        typeof payload.mountedDomMediaControlCount === "number" &&
        Number.isFinite(payload.mountedDomMediaControlCount)
          ? payload.mountedDomMediaControlCount
          : null;
      const nextMountedDomHasZeroPlaceholder =
        typeof payload.mountedDomHasZeroImagePlaceholder === "boolean"
          ? payload.mountedDomHasZeroImagePlaceholder
          : null;
      const nextMeasurementKind =
        typeof payload.measurementKind === "string"
          ? payload.measurementKind
          : "scoped_dom_ref_and_descriptor_audit";
      const nextCssVisibilityMeasured = Boolean(payload.cssVisibilityMeasured);
      const nextViewportVisibilityMeasured = Boolean(payload.viewportVisibilityMeasured);

      if (
        existing &&
        existing.logicalCount === payload.logicalCount &&
        existing.isParkedGroup === nextIsParkedGroup &&
        existing.activeFilter === nextActiveFilter &&
        existing.fullInventoryRowCount === nextFullInventoryRowCount &&
        existing.fullInventoryMediaControlCount === nextFullInventoryMediaCount &&
        existing.fullInventoryHasZeroImagePlaceholder === nextFullInventoryHasZeroPlaceholder &&
        existing.descriptorCount === nextDescriptorCount &&
        existing.renderedCount === nextDescriptorCount &&
        existing.mountedDomRowCount === nextMountedDomRowCount &&
        existing.isExpanded === nextIsExpanded &&
        existing.sectionDomMounted === nextSectionDomMounted &&
        existing.rowsContainerDomMounted === nextRowsContainerDomMounted &&
        existing.mediaControlCount === payload.mediaControlCount &&
        existing.hasZeroImagePlaceholder === payload.hasZeroImagePlaceholder &&
        existing.mountedDomMediaControlCount === nextMountedDomMediaCount &&
        existing.mountedDomHasZeroImagePlaceholder === nextMountedDomHasZeroPlaceholder &&
        existing.measurementKind === nextMeasurementKind &&
        existing.cssVisibilityMeasured === nextCssVisibilityMeasured &&
        existing.viewportVisibilityMeasured === nextViewportVisibilityMeasured &&
        Array.isArray(existing.fullInventoryKeys) &&
        existing.fullInventoryKeys.length === nextFullInventoryKeys.length &&
        existing.fullInventoryKeys.every((k, idx) => k === nextFullInventoryKeys[idx]) &&
        Array.isArray(existing.descriptorKeys) &&
        existing.descriptorKeys.length === nextDescriptorKeys.length &&
        existing.descriptorKeys.every((k, idx) => k === nextDescriptorKeys[idx]) &&
        Array.isArray(existing.mountedDomKeys) &&
        existing.mountedDomKeys.length === nextMountedDomKeys.length &&
        existing.mountedDomKeys.every((k, idx) => k === nextMountedDomKeys[idx])
      ) {
        return prev;
      }

      return {
        productId: incomingProdId,
        bySection: {
          ...baseBySection,
          [payload.sectionTitle]: {
            isParkedGroup: nextIsParkedGroup,
            activeFilter: nextActiveFilter,
            logicalCount: payload.logicalCount,
            fullInventoryRowCount: nextFullInventoryRowCount,
            fullInventoryKeys: nextFullInventoryKeys,
            fullInventoryMediaControlCount: nextFullInventoryMediaCount,
            fullInventoryHasZeroImagePlaceholder: nextFullInventoryHasZeroPlaceholder,
            renderedCount: nextDescriptorCount,
            renderedKeys: nextDescriptorKeys,
            descriptorCount: nextDescriptorCount,
            descriptorKeys: nextDescriptorKeys,
            mountedDomRowCount: nextMountedDomRowCount,
            mountedDomKeys: nextMountedDomKeys,
            isExpanded: nextIsExpanded,
            sectionDomMounted: nextSectionDomMounted,
            rowsContainerDomMounted: nextRowsContainerDomMounted,
            mediaControlCount: payload.mediaControlCount,
            hasZeroImagePlaceholder: payload.hasZeroImagePlaceholder,
            mountedDomMediaControlCount: nextMountedDomMediaCount,
            mountedDomHasZeroImagePlaceholder: nextMountedDomHasZeroPlaceholder,
            measurementKind: nextMeasurementKind,
            cssVisibilityMeasured: nextCssVisibilityMeasured,
            viewportVisibilityMeasured: nextViewportVisibilityMeasured
          }
        }
      };
    });
  }, []);

  const handleToggleProductSelection = useCallback((id) => {
    if (isLoadingData || isExecuting) return; 
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        return newStates;
      });
      return newIds;
    });
  }, [isLoadingData, isExecuting]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isLoadingData || isExecuting) return;
    setQueueIds(prev => {
      let newIds = [...prev];
      if (allFilteredSelected) {
        newIds = newIds.filter(id => !filteredProducts.find(p => p.id === id));
      } else {
        filteredProducts.forEach(p => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      }
      setProductStates(states => {
        const newStates = { ...states };
        newIds.forEach(id => { if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] }; });
        return newStates;
      });
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isLoadingData, isExecuting]);

  const clearBench = useCallback(() => {
    activeDraftSeedRequestIdRef.current = null;
    handleLiveSyncOnClearBench();

    if (pendingReferenceMatch) {
      const activeRel = pendingReferenceMatch;
      setReleasedReferenceMatchRequest({
        ...activeRel,
        releasedAt: new Date().toISOString(),
        clearedBench: true,
        fetcherWasBusy: referenceMatchFetcher.state !== "idle"
      });
      if (activeRel.requestId) {
        setReleasedReferenceMatchIds((prev) => ({
          ...prev,
          [activeRel.requestId]: {
            pieceId: activeRel.pieceId,
            snapshot: activeRel.snapshot,
            releasedAt: new Date().toISOString(),
            reason: "clear_bench"
          }
        }));
      }
    } else {
      setReleasedReferenceMatchRequest(null);
    }
    setQueueIds([]);
    setProductStates({});
    setManifestData({});
    setUnselectedDraftManifest(createInitialUnselectedDraftManifest());
    setDraftSourceContext(createInitialDraftSourceContext());
    setDraftEpoch((prev) => prev + 1);
    setApprovals({});
    setKeepOriginalDecisions({});
    setManualEdits({});
    setSubmittedPayloads({});
    setRepairHistory({});
    setSelectedBenchId(null);
    setTelemetryPacket(null);
    setTelemetryPublishNotice(null);
    setSectionAuditMeasurements({ productId: null, bySection: {} });
    setExpandedBays(INITIAL_EXPANDED_BAYS);
    setIsLoadingData(false);
    setIsExecuting(false);
    setExecutionMode(null);
    setExecuteIndex(0);
    setAiStep(0);
    setAiData({});
    setStandardizedCandidatesByProduct({});
    setReferenceMatchResultsByProduct({});
    setReferenceMatchStatusByProduct({});
    setPendingReferenceMatch(null);
    setLoadIndex(0);
    setLastProcessedData(null);
    setPendingOperation(null);
    setSafetyMessage("Rack and Bench cleared. Repair history and draft inputs reset.");
    setSafetyError("");
  }, [pendingReferenceMatch, referenceMatchFetcher.state, handleLiveSyncOnClearBench]);

  const handleToggleApproval = useCallback((pieceId, key, propVal, isChecked) => {
    const isUnselectedDraftTarget =
      pieceId === null &&
      selectedBenchId === null &&
      Boolean(unselectedDraftManifest && unselectedDraftManifest.isUnselectedDraft === true);

    if (!isUnselectedDraftTarget) {
      if (!pieceId || !isExactProductGid(pieceId) || !manifestData[pieceId]) return;
    }

    if (typeof key !== "string" || !key.trim()) return;
    if (isParkedExcludedKey(key)) return;

    const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
    const approvalStorageKey = resolveApprovalStorageKey(key);
    if (
      !approvalStorageKey ||
      isParkedExcludedKey(approvalStorageKey) ||
      targetKeyForProposal === "standardized_candidates" ||
      targetKeyForProposal === "custom.standardized_candidates" ||
      targetKeyForProposal === "native_image_alt" ||
      approvalStorageKey === "native_image_alt"
    ) {
      return;
    }

    const allConfigFields = [
      ...TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap(g => g.fields || []),
      ...(COMPATIBILITY_ADAPTER_FIELDS || [])
    ];
    const matchedConfig = allConfigFields.find(
      f =>
        resolveConfigFieldDestination(f) === approvalStorageKey ||
        resolveConfigFieldDestination(f) === key ||
        resolveConfigFieldDestination(f) === targetKeyForProposal ||
        f?.registryIdentity === approvalStorageKey ||
        f?.registryIdentity === key
    );

    if (matchedConfig?.registryRole === "EXCLUDED_INPUT" || matchedConfig?.isParkedExcluded === true) {
      return;
    }

    if (isVerifiedStandardizedDestination(targetKeyForProposal)) {
      if (isUnselectedDraftTarget) return;
      const stdEval = getStandardizedEvaluationForField(pieceId, targetKeyForProposal);
      const valCheck = validateProposedStandardizedGidList(propVal, stdEval);
      if (!valCheck.valid) return;
    } else if (
      matchedConfig?.mappingStatus === "pending_read_only" ||
      matchedConfig?.storageVerified === false ||
      matchedConfig?.writerVerified === false ||
      matchedConfig?.producerAlignmentPending === true ||
      matchedConfig?.owner === "variant_metafield" ||
      matchedConfig?.namespace === "shopify" ||
      targetKeyForProposal.startsWith("shopify.") ||
      targetKeyForProposal === "mm-google-shopping.custom_product" ||
      approvalStorageKey === "mm-google-shopping.custom_product"
    ) {
      return;
    }

    const storageOwnerKey = isUnselectedDraftTarget ? UNSELECTED_DRAFT_STORAGE_KEY : pieceId;

    if (isChecked) {
      if (propVal === undefined || propVal === null || String(propVal).trim() === "") {
        return;
      }
      if (!isUnselectedDraftTarget) {
        // Mutual exclusivity: checking Approve clears any Keep-Original decision on this exact destination key
        setKeepOriginalDecisions((prevKeep) => {
          const prodKeep = prevKeep?.[pieceId];
          if (!prodKeep || prodKeep[approvalStorageKey] === undefined) return prevKeep;
          const nextProdKeep = { ...prodKeep };
          delete nextProdKeep[approvalStorageKey];
          const nextKeep = { ...prevKeep };
          if (Object.keys(nextProdKeep).length === 0) {
            delete nextKeep[pieceId];
          } else {
            nextKeep[pieceId] = nextProdKeep;
          }
          return nextKeep;
        });
      }
    }

    setApprovals(prev => {
      const next = { ...prev };
      const prodApp = { ...(next[storageOwnerKey] || {}) };
      if (isChecked) {
        // Store approval strictly under the destination-specific approval key (e.g. native_description stays native_description,
        // never auto-approving custom.generated_description or vice versa).
        prodApp[approvalStorageKey] = String(propVal);
      } else {
        delete prodApp[approvalStorageKey];
      }
      if (Object.keys(prodApp).length === 0) {
        delete next[storageOwnerKey];
      } else {
        next[storageOwnerKey] = prodApp;
      }
      return next;
    });
  }, [getStandardizedEvaluationForField, manifestData, selectedBenchId, unselectedDraftManifest]);

  const handleToggleKeepOriginal = useCallback((pieceId, key, propVal, isChecked) => {
    if (!pieceId || !isExactProductGid(pieceId) || !manifestData[pieceId]) return;
    if (typeof key !== "string" || !key.trim()) return;
    if (isParkedExcludedKey(key)) return;

    const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
    const approvalStorageKey = resolveApprovalStorageKey(key);
    if (
      !approvalStorageKey ||
      isParkedExcludedKey(approvalStorageKey) ||
      targetKeyForProposal === "standardized_candidates" ||
      targetKeyForProposal === "custom.standardized_candidates" ||
      targetKeyForProposal === "native_image_alt" ||
      approvalStorageKey === "native_image_alt"
    ) {
      return;
    }

    const allConfigFields = [
      ...TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap((g) => g.fields || []),
      ...(COMPATIBILITY_ADAPTER_FIELDS || [])
    ];
    const matchedConfig = allConfigFields.find(
      (f) =>
        resolveConfigFieldDestination(f) === approvalStorageKey ||
        resolveConfigFieldDestination(f) === key ||
        resolveConfigFieldDestination(f) === targetKeyForProposal ||
        f?.registryIdentity === approvalStorageKey ||
        f?.registryIdentity === key
    );

    if (matchedConfig?.registryRole === "EXCLUDED_INPUT" || matchedConfig?.isParkedExcluded === true) {
      return;
    }

    if (!isChecked) {
      // Unchecking returns the destination to undecided without auto-selecting Approve
      setKeepOriginalDecisions((prev) => {
        const prodKeep = prev?.[pieceId];
        if (!prodKeep || prodKeep[approvalStorageKey] === undefined) return prev;
        const nextProdKeep = { ...prodKeep };
        delete nextProdKeep[approvalStorageKey];
        const next = { ...prev };
        if (Object.keys(nextProdKeep).length === 0) {
          delete next[pieceId];
        } else {
          next[pieceId] = nextProdKeep;
        }
        return next;
      });
      return;
    }

    const currentMeta = evaluateFieldMetadata({
      key,
      data: manifestData[pieceId],
      productId: pieceId,
      currentApprovals: approvals,
      currentKeepOriginal: keepOriginalDecisions,
      currentManualEdits: manualEdits,
      configFields: allConfigFields,
      standardizedCandidatesByProduct,
      getStandardizedEvaluationForField,
      includeTab3InspectableInventory: true
    });

    if (!currentMeta.canKeepOriginal) {
      return;
    }

    const decisionRecord = createKeepOriginalDecisionRecord({
      productId: pieceId,
      key,
      data: manifestData[pieceId],
      propVal: currentMeta.propVal,
      templateConfig: matchedConfig || null
    });

    if (!decisionRecord) {
      return;
    }

    // Mutual exclusivity: checking Keep-Original clears any Approval on this exact destination key
    setApprovals((prevApp) => {
      const prodApp = prevApp?.[pieceId];
      if (!prodApp || prodApp[approvalStorageKey] === undefined) return prevApp;
      const nextProdApp = { ...prodApp };
      delete nextProdApp[approvalStorageKey];
      return {
        ...prevApp,
        [pieceId]: nextProdApp
      };
    });

    setKeepOriginalDecisions((prevKeep) => ({
      ...prevKeep,
      [pieceId]: {
        ...(prevKeep[pieceId] || {}),
        [approvalStorageKey]: decisionRecord
      }
    }));
  }, [
    manifestData,
    approvals,
    keepOriginalDecisions,
    manualEdits,
    standardizedCandidatesByProduct,
    getStandardizedEvaluationForField
  ]);

  const handleReleasePendingReferenceMatch = useCallback(() => {
    if (!pendingReferenceMatch) {
      if (selectedBenchId) {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [selectedBenchId]: {
            state: "ready",
            tone: "info",
            message: "No active reference matching lock to release. Ready to match when supported Vision candidates exist.",
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return;
    }

    const released = pendingReferenceMatch;
    const nowIso = new Date().toISOString();
    setReleasedReferenceMatchRequest({
      ...released,
      releasedAt: nowIso,
      fetcherWasBusy: referenceMatchFetcher.state !== "idle"
    });
    if (released.requestId) {
      setReleasedReferenceMatchIds((prev) => ({
        ...prev,
        [released.requestId]: {
          pieceId: released.pieceId,
          snapshot: released.snapshot,
          source: released.source || "manual",
          workflowRunId: released.workflowRunId || null,
          releasedAt: nowIso,
          reason: "manual_release"
        }
      }));
    }
    setPendingReferenceMatch(null);

    const releaseMsg =
      referenceMatchFetcher.state !== "idle"
        ? `Released local pending lock for ${released.pieceId} (request ${released.requestId || "unknown"}) while fetcher is still [${referenceMatchFetcher.state}]. Any late response from that released request will be ignored. Wait for the fetcher to return to idle before starting another request.`
        : `Released stalled reference matching lock for ${released.pieceId} (request ${released.requestId || "unknown"}). Click 'Match Reference Choices' to retry.`;

    setReferenceMatchStatusByProduct((prev) => {
      const next = {
        ...prev,
        [released.pieceId]: {
          state: "cancelled",
          tone: "warning",
          requestId: released.requestId || null,
          snapshot: released.snapshot || null,
          source: released.source || "manual",
          workflowRunId: released.workflowRunId || null,
          message: releaseMsg,
          updatedAt: nowIso
        }
      };
      if (selectedBenchId && selectedBenchId !== released.pieceId) {
        next[selectedBenchId] = {
          state: "ready",
          tone: "info",
          message: `Released lock that was held by ${released.pieceId}. You can now click 'Match Reference Choices' for ${selectedBenchId}.`,
          updatedAt: nowIso
        };
      }
      return next;
    });
  }, [pendingReferenceMatch, referenceMatchFetcher.state, selectedBenchId]);

  const startReferenceMatchForProduct = useCallback((targetPieceId, options = {}) => {
    const cleanPieceId = typeof targetPieceId === "string" ? targetPieceId.trim() : "";
    const source = typeof options?.source === "string" && options.source.trim() !== "" ? options.source.trim() : "manual";
    const workflowRunId = typeof options?.workflowRunId === "string" && options.workflowRunId.trim() !== "" ? options.workflowRunId.trim() : null;

    if (!isExactProductGid(cleanPieceId)) {
      const invalidMsg = "Cannot match reference choices: A valid Shopify Product GID (gid://shopify/Product/...) is required.";
      if (source === "manual") {
        setSafetyError(
          !selectedBenchId
            ? "Cannot match reference choices: No product is selected on the bench. Select a product first."
            : invalidMsg
        );
      }
      return {
        started: false,
        reason: "invalid_product_id",
        requestId: null,
        snapshot: null,
        message: invalidMsg
      };
    }

    const rawProductCandidates =
      options?.candidatesOverride !== undefined && options?.candidatesOverride !== null
        ? options.candidatesOverride
        : (standardizedCandidatesByProduct[cleanPieceId] || {});
    const bundle = buildCanonicalCandidateBundle(rawProductCandidates);

    if (!bundle.hasSupported) {
      const noCandMsg =
        "Cannot match reference choices: No validated Vision standardized candidates exist for this product. Run 'Run AI (Single)' or 'EXECUTE AI AUTO-FILL (STAGE)' first so Vision stages candidate labels and evidence.";
      if (source === "manual") {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [cleanPieceId]: {
            state: "failed",
            tone: "warning",
            requestId: null,
            snapshot: bundle.snapshot,
            source,
            workflowRunId,
            message: noCandMsg,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return {
        started: false,
        reason: "no_candidates",
        requestId: null,
        snapshot: bundle.snapshot,
        message: noCandMsg
      };
    }

    if (pendingReferenceMatch !== null || referenceMatchFetcher.state !== "idle") {
      const lockedBy = pendingReferenceMatch?.pieceId || "an active fetcher request";
      const busyMsg = `Reference matching cannot start: Fetcher is currently [${referenceMatchFetcher.state}] and locked by [${lockedBy}]. Wait for completion, or click 'Release Stalled Match Lock' if the request is genuinely stuck.`;
      if (source === "manual") {
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [cleanPieceId]: {
            state: pendingReferenceMatch?.pieceId === cleanPieceId ? "awaiting_response" : "failed",
            tone: "warning",
            requestId: pendingReferenceMatch?.pieceId === cleanPieceId ? (pendingReferenceMatch?.requestId || null) : null,
            snapshot: bundle.snapshot,
            source,
            workflowRunId,
            message: busyMsg,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return {
        started: false,
        reason: "busy",
        requestId: pendingReferenceMatch?.requestId || null,
        snapshot: bundle.snapshot,
        message: busyMsg
      };
    }

    const requestId =
      typeof options?.requestId === "string" && options.requestId.trim() !== ""
        ? options.requestId.trim()
        : `refmatch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const nowIso = new Date().toISOString();

    const requestRecord = {
      requestId,
      pieceId: cleanPieceId,
      snapshot: bundle.snapshot,
      source,
      workflowRunId,
      baselineData: referenceMatchFetcher.data,
      sawNonIdle: false,
      startedAt: nowIso
    };

    setReleasedReferenceMatchRequest(null);
    setPendingReferenceMatch(requestRecord);
    setReferenceMatchStatusByProduct((prev) => ({
      ...prev,
      [cleanPieceId]: {
        state: "submitting",
        tone: "info",
        requestId,
        snapshot: bundle.snapshot,
        source,
        workflowRunId,
        message: `Submitting ${bundle.count} standardized candidate attribute(s) (${Object.keys(bundle.ordered).join(", ")}) for read-only reference matching (request ${requestId})...`,
        updatedAt: nowIso
      }
    }));

    try {
      const fd = new FormData();
      fd.append("intent", "resolveStandardizedCandidates");
      fd.append("pieceId", cleanPieceId);
      fd.append("standardized_candidates", bundle.snapshot);
      fd.append("requestId", requestId);

      referenceMatchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      return {
        started: true,
        reason: "submitted",
        requestId,
        snapshot: bundle.snapshot,
        message: `Submitted reference matching request ${requestId} for ${cleanPieceId}.`
      };
    } catch (err) {
      const errMsg = err?.message || String(err || "Unknown submission error");
      const failNow = new Date().toISOString();
      setPendingReferenceMatch((curr) => (curr === requestRecord ? null : curr));
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [cleanPieceId]: {
          state: "failed",
          tone: "critical",
          requestId,
          snapshot: bundle.snapshot,
          source,
          workflowRunId,
          message: `Failed to submit reference matching request (${requestId}): ${errMsg}. Check network/app connection and click 'Match Reference Choices' to retry.`,
          updatedAt: failNow
        }
      }));
      return {
        started: false,
        reason: "submit_error",
        requestId,
        snapshot: bundle.snapshot,
        message: errMsg
      };
    }
  }, [
    selectedBenchId,
    standardizedCandidatesByProduct,
    pendingReferenceMatch,
    referenceMatchFetcher
  ]);

  // Safe zero-argument adapter for the manual drawer button so a click event is never passed as targetPieceId
  const handleMatchReferenceChoices = useCallback(() => {
    if (!selectedBenchId || !manifestData[selectedBenchId]) {
      setSafetyError("Cannot match reference choices: No loaded product is selected on the bench. Load and select a product first.");
      return;
    }
    startReferenceMatchForProduct(selectedBenchId, { source: "manual", workflowRunId: null });
  }, [selectedBenchId, manifestData, startReferenceMatchForProduct]);

  useEffect(() => {
    const data = referenceMatchFetcher.data;

    // 1. If a released request finishes in the background, consume & ignore its late response so it cannot overwrite a later request.
    if (releasedReferenceMatchRequest) {
      if (referenceMatchFetcher.state !== "idle") {
        if (!releasedReferenceMatchRequest.sawNonIdle) {
          setReleasedReferenceMatchRequest((prev) => (prev ? { ...prev, sawNonIdle: true } : null));
        }
      } else {
        const dataChangedSinceReleaseStart = data !== releasedReferenceMatchRequest.baselineData;
        const matchesReleasedId =
          Boolean(data && typeof data === "object" && data.requestId && releasedReferenceMatchRequest.requestId) &&
          data.requestId === releasedReferenceMatchRequest.requestId;

        if (releasedReferenceMatchRequest.sawNonIdle || dataChangedSinceReleaseStart || matchesReleasedId) {
          const ignoredPieceId = releasedReferenceMatchRequest.pieceId;
          const ignoredReqId = releasedReferenceMatchRequest.requestId || null;
          const wasBenchCleared = Boolean(releasedReferenceMatchRequest.clearedBench);
          setReleasedReferenceMatchRequest(null);
          if (!pendingReferenceMatch && !wasBenchCleared && ignoredPieceId) {
            setReferenceMatchStatusByProduct((prev) => ({
              ...prev,
              [ignoredPieceId]: {
                state: "discarded_stale",
                tone: "warning",
                requestId: ignoredReqId,
                snapshot: releasedReferenceMatchRequest.snapshot || null,
                source: releasedReferenceMatchRequest.source || "manual",
                workflowRunId: releasedReferenceMatchRequest.workflowRunId || null,
                message: `Late response from previously released request${ignoredReqId ? ` (${ignoredReqId})` : ""} on ${ignoredPieceId} arrived and was safely ignored. Click 'Match Reference Choices' to run a fresh read-only match.`,
                updatedAt: new Date().toISOString()
              }
            }));
          }
          if (!pendingReferenceMatch) {
            return;
          }
        }
      }
    }

    if (!pendingReferenceMatch) return;

    // 2. Track transition into non-idle ("submitting" / "loading")
    if (referenceMatchFetcher.state !== "idle") {
      if (!pendingReferenceMatch.sawNonIdle) {
        setPendingReferenceMatch((prev) => (prev ? { ...prev, sawNonIdle: true } : null));
        setReferenceMatchStatusByProduct((prev) => ({
          ...prev,
          [pendingReferenceMatch.pieceId]: {
            state: "awaiting_response",
            tone: "info",
            requestId: pendingReferenceMatch.requestId,
            snapshot: pendingReferenceMatch.snapshot,
            source: pendingReferenceMatch.source,
            workflowRunId: pendingReferenceMatch.workflowRunId,
            message: `Awaiting read-only reference matching response from Shopify for ${pendingReferenceMatch.pieceId} (request: ${pendingReferenceMatch.requestId}, fetcher state: ${referenceMatchFetcher.state})...`,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return;
    }

    // 3. Fetcher is idle. Ensure we do NOT consume old retained fetcher.data before the new submission actually completes.
    const hasCompletedCycle = pendingReferenceMatch.sawNonIdle || data !== pendingReferenceMatch.baselineData;
    if (!hasCompletedCycle) {
      return;
    }

    const activePending = pendingReferenceMatch;

    // 4. Guard against late responses belonging to a previously released/cancelled requestId
    if (data && typeof data === "object" && typeof data.requestId === "string" && releasedReferenceMatchIds[data.requestId]) {
      if (data.requestId !== activePending.requestId) {
        return;
      }
      setPendingReferenceMatch(null);
      return;
    }

    // 5. If fetcher completed a non-idle cycle without delivering a new payload, fail closed (do not infer success from idle)
    if (activePending.sawNonIdle && data === activePending.baselineData) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching request (${activePending.requestId}) for ${activePending.pieceId} returned to idle without delivering a response payload. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 6. Validate response structure before clearing or mutating state
    if (!data || typeof data !== "object") {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Malformed response received for ${activePending.pieceId} (request ${activePending.requestId}): Backend returned an empty or non-object payload. Existing diagnostics were preserved. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (data.intent !== "resolveStandardizedCandidates" || data.readOnly !== true) {
      setPendingReferenceMatch(null);
      const errDetail = data.error || data.message || `intent=${String(data.intent)}, readOnly=${String(data.readOnly)}`;
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Malformed or unexpected response contract for ${activePending.pieceId} (${errDetail}). Expected intent 'resolveStandardizedCandidates' with readOnly: true. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (!data.requestId || data.requestId !== activePending.requestId) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Request correlation mismatch for ${activePending.pieceId}: Expected requestId [${activePending.requestId}], but backend returned [${data.requestId || "None"}]. Response discarded to preserve strict request correlation. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (!data.pieceId || data.pieceId !== activePending.pieceId) {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Product identity mismatch: Requested reference matching for [${activePending.pieceId}] (${activePending.requestId}), but backend returned pieceId [${data.pieceId || "None"}]. Response discarded to preserve product isolation. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 7. Response is proven to belong to activePending's exact requestId, product & completed cycle. Clear pending lock.
    setPendingReferenceMatch(null);

    const targetProductId = data.pieceId;
    const latestCandidates = standardizedCandidatesByProduct[targetProductId] || {};
    const currentBundle = buildCanonicalCandidateBundle(latestCandidates);
    const currentSnapshot = currentBundle.snapshot;

    if (currentSnapshot !== activePending.snapshot) {
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "discarded_stale",
          tone: "warning",
          requestId: activePending.requestId,
          snapshot: currentSnapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Discarded stale reference matching response (${activePending.requestId}) for ${targetProductId}: The product's Vision standardized candidates changed while the request was in flight. Click 'Match Reference Choices' to match the latest candidates.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    const rawResolutions = validObj(data.resolutions);
    const sanitizedResolutions = {};
    ALLOWED_VISION_CANDIDATE_KEYS.forEach((allowedKey) => {
      const fullKey = `shopify.${allowedKey}`;
      if (rawResolutions[fullKey] && typeof rawResolutions[fullKey] === "object") {
        sanitizedResolutions[fullKey] = rawResolutions[fullKey];
      } else if (rawResolutions[allowedKey] && typeof rawResolutions[allowedKey] === "object") {
        sanitizedResolutions[fullKey] = rawResolutions[allowedKey];
      }
    });

    const topErrors = formatErrorsList(data.errors || data.error);
    const resolutionCount = Object.keys(sanitizedResolutions).length;
    const isComplete = Boolean(data.isComplete);
    const isSuccess = Boolean(data.success);
    const returnedProductCategory =
      data.productCategory && typeof data.productCategory === "object"
        ? data.productCategory
        : null;
    const returnedCategoryEligibility = validObj(data.categoryEligibility);
    const matchedAtIso = new Date().toISOString();

    const matchRecord = {
      requestId: activePending.requestId,
      pieceId: targetProductId,
      intent: data.intent,
      readOnly: true,
      success: isSuccess,
      isComplete: isComplete,
      productCategory: returnedProductCategory,
      categoryEligibility: returnedCategoryEligibility,
      resolutions: sanitizedResolutions,
      currentReferenceLists: validObj(data.currentReferenceLists),
      errors: topErrors,
      snapshot: activePending.snapshot,
      source: activePending.source,
      workflowRunId: activePending.workflowRunId,
      matchedAt: matchedAtIso
    };

    const readinessCheck = evaluateProductReferenceMatchReadiness({
      productId: targetProductId,
      data: manifestData[targetProductId] || null,
      rawCandidates: latestCandidates,
      refMatchResult: matchRecord,
      refMatchStatus: null,
      pendingReferenceMatch: null,
      expectedRequestId: activePending.requestId
    });

    const isFullyCompleteMatch = readinessCheck.state === "matched_complete";
    const isCleanCompleteOutcome = isFullyCompleteMatch && isComplete && isSuccess && topErrors.length === 0;

    setReferenceMatchResultsByProduct((prev) => ({
      ...prev,
      [targetProductId]: matchRecord
    }));

    let eligibleProposalCount = 0;
    const categoryBlockedDestinations = [];

    VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
      const resEntry = sanitizedResolutions[destKey];
      if (!resEntry) return;
      if (resEntry.isCategoryEligible === false || resEntry.status === "category_ineligible") {
        categoryBlockedDestinations.push(destKey);
      } else if (resEntry.isCategoryEligible === true && resEntry.isComplete === true) {
        eligibleProposalCount++;
      }
    });

    // Stage technically verified proposals into manifestData.repairPlan for the 6 standardized destinations
    // and record diagnostics.stage = "resolveStandardizedCandidates" for accepted matching outcomes
    setManifestData((prevMan) => {
      const existingMan = prevMan[targetProductId];
      if (!existingMan) return prevMan;

      const updatedRepairPlan = { ...(existingMan.repairPlan || {}) };
      const updatedMetadata = { ...(existingMan.metadata || {}) };
      const existingDiag = existingMan.diagnostics || {};

      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (manualEdits[targetProductId]?.[destKey] === true) return;

        const evalRes = evaluateStandardizedDestinationTechnicalStatus({
          destinationKey: destKey,
          productId: targetProductId,
          data: existingMan,
          candidateBundle: currentBundle,
          refMatchResult: matchRecord,
          refMatchStatus: { state: isFullyCompleteMatch ? "completed" : "incomplete" }
        });

        if (evalRes.isTechnicallyEligible && evalRes.autoProposalSerialized) {
          updatedRepairPlan[destKey] = evalRes.autoProposalSerialized;
          updatedMetadata[destKey] = {
            source: "Vision",
            stage: "resolveStandardizedCandidates"
          };
        } else {
          delete updatedRepairPlan[destKey];
        }
      });

      const outcomeDiagError = isCleanCompleteOutcome
        ? null
        : (topErrors[0] || readinessCheck.reason || existingDiag.error || null);

      const updatedDiagnostics = {
        ...existingDiag,
        shopifyRead: isCleanCompleteOutcome
          ? (existingDiag.shopifyRead || "Success")
          : (existingDiag.shopifyRead || "Failed"),
        stage: "resolveStandardizedCandidates",
        error: outcomeDiagError,
        errors: isCleanCompleteOutcome
          ? validArray(existingDiag.errors)
          : (topErrors.length > 0 ? topErrors : validArray(existingDiag.errors))
      };

      return {
        ...prevMan,
        [targetProductId]: {
          ...existingMan,
          productCategory: returnedProductCategory || existingMan.productCategory || null,
          repairPlan: updatedRepairPlan,
          metadata: updatedMetadata,
          diagnostics: updatedDiagnostics
        }
      };
    });

    // Clear any prior approvals or keep-original decisions on standardized destinations when new reference matches arrive
    setApprovals((prevApp) => {
      if (!prevApp[targetProductId]) return prevApp;
      const nextProdApp = { ...prevApp[targetProductId] };
      let changed = false;
      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (nextProdApp[destKey] !== undefined) {
          delete nextProdApp[destKey];
          changed = true;
        }
      });
      if (!changed) return prevApp;
      return { ...prevApp, [targetProductId]: nextProdApp };
    });

    setKeepOriginalDecisions((prevKeep) => {
      if (!prevKeep[targetProductId]) return prevKeep;
      const nextProdKeep = { ...prevKeep[targetProductId] };
      let changed = false;
      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (nextProdKeep[destKey] !== undefined) {
          delete nextProdKeep[destKey];
          changed = true;
        }
      });
      if (!changed) return prevKeep;
      const nextKeep = { ...prevKeep };
      if (Object.keys(nextProdKeep).length === 0) {
        delete nextKeep[targetProductId];
      } else {
        nextKeep[targetProductId] = nextProdKeep;
      }
      return nextKeep;
    });

    if (isCleanCompleteOutcome) {
      const blockedDestList = readinessCheck.blockedDestinationKeys || [];
      let detailSummary = " Technically verified and category-eligible proposals are staged for review and exact-value approval below.";
      if (categoryBlockedDestinations.length > 0 || blockedDestList.length > 0) {
        const blockedDisplay = blockedDestList.length > 0 ? blockedDestList : categoryBlockedDestinations;
        detailSummary = ` ${readinessCheck.eligibleDestinationKeys.length} proposal(s) unlocked; ${blockedDisplay.length} blocked by category or entry resolution (${blockedDisplay.join(", ")} — candidate evidence and matched entries preserved).`;
      }
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "completed",
          tone: "success",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching completed for ${resolutionCount} attribute(s).${detailSummary}`,
          updatedAt: matchedAtIso
        }
      }));
    } else {
      const incReason =
        !isFullyCompleteMatch && readinessCheck.reason
          ? ` ${readinessCheck.reason}`
          : "";
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "incomplete",
          tone: "warning",
          requestId: activePending.requestId,
          snapshot: activePending.snapshot,
          source: activePending.source,
          workflowRunId: activePending.workflowRunId,
          message: `Reference matching returned partial/incomplete read diagnostics (success: ${String(isSuccess)}, isComplete: ${String(isComplete)}, ${resolutionCount} attribute resolution(s), ${topErrors.length} top-level error(s)).${incReason} Incomplete enumeration remains blocked and is never treated as missing_entry or save-ready. Review read errors/continuation below or click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
    }
  }, [
    referenceMatchFetcher.state,
    referenceMatchFetcher.data,
    pendingReferenceMatch,
    releasedReferenceMatchRequest,
    releasedReferenceMatchIds,
    standardizedCandidatesByProduct,
    manifestData,
    manualEdits
  ]);

  const {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  } = useMetaInjectorExecution({
    safeProducts,
    batchFetcher,
    referenceMatchFetcher,
    queueIds,
    selectedBenchId,
    isLoadingData,
    setIsLoadingData,
    loadIndex,
    setLoadIndex,
    isExecuting,
    setIsExecuting,
    executionMode,
    setExecutionMode,
    executeIndex,
    setExecuteIndex,
    aiStep,
    setAiStep,
    pendingOperation,
    setPendingOperation,
    aiData,
    setAiData,
    standardizedCandidatesByProduct,
    setStandardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    setReferenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    setReferenceMatchStatusByProduct,
    pendingReferenceMatch,
    startReferenceMatchForProduct,
    manifestData,
    setManifestData,
    lastProcessedData,
    setLastProcessedData,
    approvals,
    setApprovals,
    manualEdits,
    setManualEdits,
    setSubmittedPayloads,
    setRepairHistory,
    setSafetyMessage,
    setSafetyError,
    updateProductState,
    getStandardizedEvaluationForField,
    getFieldMetadata
  });

  const handleRepairPlanChange = (key, value) => {
    const isUnselectedDraftTarget =
      selectedBenchId === null &&
      Boolean(unselectedDraftManifest && unselectedDraftManifest.isUnselectedDraft === true);

    if (!isUnselectedDraftTarget) {
      if (!selectedBenchId || !isExactProductGid(selectedBenchId) || !manifestData[selectedBenchId]) return;
    }

    if (typeof key !== "string" || !key.trim()) return;
    if (isParkedExcludedKey(key)) return;

    const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
    const approvalStorageKey = resolveApprovalStorageKey(key);
    if (
      (isParkedExcludedKey(approvalStorageKey) && !(key === "native_price" && approvalStorageKey === "price")) ||
      targetKeyForProposal === "standardized_candidates" ||
      targetKeyForProposal === "custom.standardized_candidates" ||
      targetKeyForProposal === "native_image_alt" ||
      approvalStorageKey === "native_image_alt"
    ) {
      return;
    }

    const allConfigFields = [
      ...TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap(g => g.fields || []),
      ...(COMPATIBILITY_ADAPTER_FIELDS || [])
    ];
    const matchedConfig = allConfigFields.find(
      f =>
        resolveConfigFieldDestination(f) === approvalStorageKey ||
        resolveConfigFieldDestination(f) === key ||
        resolveConfigFieldDestination(f) === targetKeyForProposal ||
        f?.registryIdentity === approvalStorageKey ||
        f?.registryIdentity === key
    );

    if (matchedConfig?.registryRole === "EXCLUDED_INPUT" || matchedConfig?.isParkedExcluded === true) {
      return;
    }

    if (isVerifiedStandardizedDestination(targetKeyForProposal)) {
      if (isUnselectedDraftTarget) return;
      const stdEval = getStandardizedEvaluationForField(selectedBenchId, targetKeyForProposal);
      const valCheck = validateProposedStandardizedGidList(value, stdEval);
      if (!valCheck.valid) return;
    } else if (
      matchedConfig?.mappingStatus === "pending_read_only" ||
      matchedConfig?.storageVerified === false ||
      matchedConfig?.writerVerified === false ||
      matchedConfig?.producerAlignmentPending === true ||
      matchedConfig?.owner === "variant_metafield" ||
      matchedConfig?.namespace === "shopify" ||
      targetKeyForProposal.startsWith("shopify.") ||
      targetKeyForProposal === "mm-google-shopping.custom_product" ||
      approvalStorageKey === "mm-google-shopping.custom_product"
    ) {
      return;
    }

    const storageOwnerKey = isUnselectedDraftTarget ? UNSELECTED_DRAFT_STORAGE_KEY : selectedBenchId;

    // Record manual edit on the shared proposal-source key (so AI/load locking in execution-hook works)
    // as well as the specific destination key when distinct, without creating disconnected proposal keys.
    setManualEdits(prev => {
      const next = { ...prev };
      const prodEdits = { ...(next[storageOwnerKey] || {}) };
      prodEdits[targetKeyForProposal] = true;
      if (approvalStorageKey && approvalStorageKey !== targetKeyForProposal) {
        prodEdits[approvalStorageKey] = true;
      }
      next[storageOwnerKey] = prodEdits;
      return next;
    });

    // Invalidate approvals AND keep-original decisions for all destinations whose proposal value is affected by this edit
    const keysToInvalidate = new Set([
      key,
      targetKeyForProposal,
      approvalStorageKey,
      ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[key] || []),
      ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[targetKeyForProposal] || []),
      ...(SHARED_PROPOSAL_APPROVAL_INVALIDATION_GROUPS[approvalStorageKey] || [])
    ].filter(Boolean));

    setApprovals(prev => {
      const prodApp = prev[storageOwnerKey];
      if (!prodApp) return prev;
      let changed = false;
      const nextProdApp = { ...prodApp };
      keysToInvalidate.forEach(kToDel => {
        if (nextProdApp[kToDel] !== undefined) {
          delete nextProdApp[kToDel];
          changed = true;
        }
      });
      if (!changed) return prev;
      const next = { ...prev };
      if (Object.keys(nextProdApp).length === 0) {
        delete next[storageOwnerKey];
      } else {
        next[storageOwnerKey] = nextProdApp;
      }
      return next;
    });

    if (!isUnselectedDraftTarget) {
      setKeepOriginalDecisions(prevKeep => {
        const prodKeep = prevKeep[selectedBenchId];
        if (!prodKeep) return prevKeep;
        let changed = false;
        const nextProdKeep = { ...prodKeep };
        keysToInvalidate.forEach(kToDel => {
          if (nextProdKeep[kToDel] !== undefined) {
            delete nextProdKeep[kToDel];
            changed = true;
          }
        });
        if (!changed) return prevKeep;
        const nextKeep = { ...prevKeep };
        if (Object.keys(nextProdKeep).length === 0) {
          delete nextKeep[selectedBenchId];
        } else {
          nextKeep[selectedBenchId] = nextProdKeep;
        }
        return nextKeep;
      });

      // Update the single canonical proposal-source entry in repairPlan and synchronize any existing
      // destination-specific key if present so native and custom never read stale diverging proposal strings.
      setManifestData(prev => {
        const existingManifest = prev[selectedBenchId];
        if (!existingManifest) return prev;
        const nextRepairPlan = {
          ...(existingManifest.repairPlan || {}),
          [targetKeyForProposal]: value
        };
        if (
          approvalStorageKey &&
          approvalStorageKey !== targetKeyForProposal &&
          Object.prototype.hasOwnProperty.call(nextRepairPlan, approvalStorageKey)
        ) {
          nextRepairPlan[approvalStorageKey] = value;
        }
        return {
          ...prev,
          [selectedBenchId]: {
            ...existingManifest,
            repairPlan: nextRepairPlan
          }
        };
      });
    } else {
      setUnselectedDraftManifest(prevDraft => {
        const baseDraft =
          prevDraft && typeof prevDraft === "object"
            ? prevDraft
            : createInitialUnselectedDraftManifest();
        const nextRepairPlan = {
          ...(baseDraft.repairPlan || {}),
          [targetKeyForProposal]: value
        };
        if (
          approvalStorageKey &&
          approvalStorageKey !== targetKeyForProposal &&
          Object.prototype.hasOwnProperty.call(nextRepairPlan, approvalStorageKey)
        ) {
          nextRepairPlan[approvalStorageKey] = value;
        }
        const manualMetaEntry = { source: "Manual", stage: "Tab3UnselectedDraft" };
        const nextMetadata = {
          ...(baseDraft.metadata || {}),
          [targetKeyForProposal]: manualMetaEntry,
          ...(key !== targetKeyForProposal ? { [key]: manualMetaEntry } : {}),
          ...(approvalStorageKey && approvalStorageKey !== targetKeyForProposal
            ? { [approvalStorageKey]: manualMetaEntry }
            : {})
        };
        return {
          ...baseDraft,
          isUnselectedDraft: true,
          repairPlan: nextRepairPlan,
          metadata: nextMetadata
        };
      });
    }
  };

  // Thin connectors for UnselectedDraftSeedIntakeCard
  const handleDraftSeedInputChange = useCallback((rawVal) => {
    if (activeBenchIdRef.current !== null) return;
    const cleanVal = typeof rawVal === "string" ? rawVal : "";
    activeDraftSeedRequestIdRef.current = null;

    setDraftSourceContext((prev) => ({
      ...(prev || createInitialDraftSourceContext()),
      rawSeedInput: cleanVal
    }));

    const trimmed = cleanVal.trim();
    const isThreePart = isSegmentedMarketingTitle(trimmed);
    const currentManualMap = validObj(manualEditsRef.current?.[UNSELECTED_DRAFT_STORAGE_KEY]);
    const isPieceNameManuallyLocked =
      currentManualMap["custom.piece_name"] === true ||
      currentManualMap.piece_name === true;

    // When typing a standalone 1-segment human ID (not a 3-part seed) and custom.piece_name
    // was not separately locked in the drawer, keep custom.piece_name synchronized in the draft
    // without locking out 3-part seed blur parsing.
    if (!isThreePart && !isPieceNameManuallyLocked) {
      setUnselectedDraftManifest((prevDraft) => {
        const baseDraft =
          prevDraft && typeof prevDraft === "object"
            ? prevDraft
            : createInitialUnselectedDraftManifest();
        const prevPieceId = baseDraft.repairPlan?.["custom.piece_name"] ?? "";
        if (prevPieceId === trimmed) return baseDraft;

        const nextRepairPlan = {
          ...(baseDraft.repairPlan || {}),
          "custom.piece_name": trimmed
        };
        const nextMetadata = {
          ...(baseDraft.metadata || {}),
          "custom.piece_name": {
            source: "Manual",
            stage: "Tab3DraftSeedInput"
          }
        };
        return {
          ...baseDraft,
          isUnselectedDraft: true,
          repairPlan: nextRepairPlan,
          metadata: nextMetadata
        };
      });

      setApprovals((prevApp) => {
        const draftApp = prevApp?.[UNSELECTED_DRAFT_STORAGE_KEY];
        if (!draftApp || draftApp["custom.piece_name"] === undefined) return prevApp;
        const nextDraftApp = { ...draftApp };
        delete nextDraftApp["custom.piece_name"];
        const next = { ...prevApp };
        if (Object.keys(nextDraftApp).length === 0) {
          delete next[UNSELECTED_DRAFT_STORAGE_KEY];
        } else {
          next[UNSELECTED_DRAFT_STORAGE_KEY] = nextDraftApp;
        }
        return next;
      });
    }
  }, []);

  const handleDraftExplicitTitleOverrideChange = useCallback((rawVal) => {
    if (activeBenchIdRef.current !== null) return;
    const cleanVal = typeof rawVal === "string" ? rawVal : "";
    const trimmed = cleanVal.trim();

    setDraftSourceContext((prev) => ({
      ...(prev || createInitialDraftSourceContext()),
      explicitTitleOverride: cleanVal
    }));

    if (trimmed !== "") {
      setManualEdits((prev) => {
        const next = { ...prev };
        const draftEdits = { ...(next[UNSELECTED_DRAFT_STORAGE_KEY] || {}) };
        draftEdits.shopify_title = true;
        draftEdits.native_title = true;
        next[UNSELECTED_DRAFT_STORAGE_KEY] = draftEdits;
        return next;
      });

      setApprovals((prev) => {
        const draftApp = prev?.[UNSELECTED_DRAFT_STORAGE_KEY];
        if (!draftApp) return prev;
        if (draftApp.shopify_title === undefined && draftApp.native_title === undefined) {
          return prev;
        }
        const nextDraftApp = { ...draftApp };
        delete nextDraftApp.shopify_title;
        delete nextDraftApp.native_title;
        const next = { ...prev };
        if (Object.keys(nextDraftApp).length === 0) {
          delete next[UNSELECTED_DRAFT_STORAGE_KEY];
        } else {
          next[UNSELECTED_DRAFT_STORAGE_KEY] = nextDraftApp;
        }
        return next;
      });

      setUnselectedDraftManifest((prevDraft) => {
        const baseDraft =
          prevDraft && typeof prevDraft === "object"
            ? prevDraft
            : createInitialUnselectedDraftManifest();
        const nextRepairPlan = {
          ...(baseDraft.repairPlan || {}),
          shopify_title: cleanVal
        };
        if (Object.prototype.hasOwnProperty.call(nextRepairPlan, "native_title")) {
          nextRepairPlan.native_title = cleanVal;
        }
        const overrideMeta = { source: "Manual", stage: "Tab3ExplicitTitleOverride" };
        const nextMetadata = {
          ...(baseDraft.metadata || {}),
          shopify_title: overrideMeta,
          native_title: overrideMeta
        };
        return {
          ...baseDraft,
          isUnselectedDraft: true,
          repairPlan: nextRepairPlan,
          metadata: nextMetadata
        };
      });
    } else {
      // Clearing the explicit title override unlocks title for subsequent 3-part seed parses
      setManualEdits((prev) => {
        const draftEdits = prev?.[UNSELECTED_DRAFT_STORAGE_KEY];
        if (!draftEdits) return prev;
        if (!draftEdits.shopify_title && !draftEdits.native_title) return prev;
        const nextDraftEdits = { ...draftEdits };
        delete nextDraftEdits.shopify_title;
        delete nextDraftEdits.native_title;
        const next = { ...prev };
        if (Object.keys(nextDraftEdits).length === 0) {
          delete next[UNSELECTED_DRAFT_STORAGE_KEY];
        } else {
          next[UNSELECTED_DRAFT_STORAGE_KEY] = nextDraftEdits;
        }
        return next;
      });
    }
  }, []);

  const handleDraftSeedBlurCommit = useCallback(
    ({ normalizedSeed, extractedPieceId, requestCorrelation } = {}) => {
      if (activeBenchIdRef.current !== null) return;
      if (
        requestCorrelation &&
        requestCorrelation.draftEpoch !== undefined &&
        requestCorrelation.draftEpoch !== draftEpochRef.current
      ) {
        return;
      }

      if (requestCorrelation?.requestId) {
        activeDraftSeedRequestIdRef.current = requestCorrelation.requestId;
      }

      const cleanSeed = typeof normalizedSeed === "string" ? normalizedSeed.trim() : "";
      const cleanId =
        typeof extractedPieceId === "string" && extractedPieceId.trim()
          ? extractedPieceId.trim()
          : resolveIdentifierToPreserve(cleanSeed, "");

      setDraftSourceContext((prev) => ({
        ...(prev || createInitialDraftSourceContext()),
        rawSeedInput: cleanSeed
      }));

      const currentManualMap = validObj(manualEditsRef.current?.[UNSELECTED_DRAFT_STORAGE_KEY]);
      const isPieceNameLocked =
        currentManualMap["custom.piece_name"] === true ||
        currentManualMap.piece_name === true;
      const explicitOverrideStr =
        typeof draftSourceContextRef.current?.explicitTitleOverride === "string"
          ? draftSourceContextRef.current.explicitTitleOverride.trim()
          : "";
      const isTitleLocked =
        hasMeaningfulValue(explicitOverrideStr) ||
        currentManualMap.shopify_title === true ||
        currentManualMap.native_title === true;

      const invalidatedKeys = new Set();

      setUnselectedDraftManifest((prevDraft) => {
        const baseDraft =
          prevDraft && typeof prevDraft === "object"
            ? prevDraft
            : createInitialUnselectedDraftManifest();
        const nextRepairPlan = { ...(baseDraft.repairPlan || {}) };
        const nextMetadata = { ...(baseDraft.metadata || {}) };
        const blurMeta = {
          source: "Derived (3-Part Seed)",
          stage: "handlePieceNameBlur"
        };

        if (cleanId && !isPieceNameLocked) {
          if (nextRepairPlan["custom.piece_name"] !== cleanId) {
            invalidatedKeys.add("custom.piece_name");
          }
          nextRepairPlan["custom.piece_name"] = cleanId;
          nextMetadata["custom.piece_name"] = blurMeta;
        }

        if (cleanSeed && !isTitleLocked) {
          if (nextRepairPlan.shopify_title !== cleanSeed) {
            invalidatedKeys.add("shopify_title");
            invalidatedKeys.add("native_title");
          }
          nextRepairPlan.shopify_title = cleanSeed;
          if (Object.prototype.hasOwnProperty.call(nextRepairPlan, "native_title")) {
            nextRepairPlan.native_title = cleanSeed;
          }
          nextMetadata.shopify_title = blurMeta;
          nextMetadata.native_title = blurMeta;
        }

        return {
          ...baseDraft,
          isUnselectedDraft: true,
          repairPlan: nextRepairPlan,
          metadata: nextMetadata
        };
      });

      if (invalidatedKeys.size > 0) {
        setApprovals((prevApp) => {
          const draftApp = prevApp?.[UNSELECTED_DRAFT_STORAGE_KEY];
          if (!draftApp) return prevApp;
          let mutated = false;
          const nextDraftApp = { ...draftApp };
          invalidatedKeys.forEach((k) => {
            if (nextDraftApp[k] !== undefined) {
              delete nextDraftApp[k];
              mutated = true;
            }
          });
          if (!mutated) return prevApp;
          const next = { ...prevApp };
          if (Object.keys(nextDraftApp).length === 0) {
            delete next[UNSELECTED_DRAFT_STORAGE_KEY];
          } else {
            next[UNSELECTED_DRAFT_STORAGE_KEY] = nextDraftApp;
          }
          return next;
        });
      }
    },
    []
  );

  const handleApplyDraftTitleParseResult = useCallback((parsed, requestCorrelation) => {
    const currentCorrelation = {
      selectedBenchId: activeBenchIdRef.current,
      activeRequestId: activeDraftSeedRequestIdRef.current,
      draftEpoch: draftEpochRef.current,
      currentSeedInput:
        typeof draftSourceContextRef.current?.rawSeedInput === "string"
          ? draftSourceContextRef.current.rawSeedInput
          : ""
    };

    const currentManualMap = validObj(manualEditsRef.current?.[UNSELECTED_DRAFT_STORAGE_KEY]);

    const mergeResult = applyTitleParseToTab3Draft({
      parsed,
      requestCorrelation,
      currentCorrelation,
      draftManifest: unselectedDraftManifestRef.current,
      manualEditsMap: currentManualMap,
      sourceContext: draftSourceContextRef.current
    });

    if (mergeResult.staleRejected) {
      return;
    }

    setUnselectedDraftManifest(mergeResult.nextDraftManifest);
    setDraftSourceContext(mergeResult.nextSourceContext);

    if (
      Array.isArray(mergeResult.invalidatedApprovalKeys) &&
      mergeResult.invalidatedApprovalKeys.length > 0
    ) {
      setApprovals((prevApp) => {
        const draftApp = prevApp?.[UNSELECTED_DRAFT_STORAGE_KEY];
        if (!draftApp) return prevApp;
        let changed = false;
        const nextDraftApp = { ...draftApp };
        mergeResult.invalidatedApprovalKeys.forEach((k) => {
          if (nextDraftApp[k] !== undefined) {
            delete nextDraftApp[k];
            changed = true;
          }
        });
        if (!changed) return prevApp;
        const next = { ...prevApp };
        if (Object.keys(nextDraftApp).length === 0) {
          delete next[UNSELECTED_DRAFT_STORAGE_KEY];
        } else {
          next[UNSELECTED_DRAFT_STORAGE_KEY] = nextDraftApp;
        }
        return next;
      });
    }
  }, []);

  const handleStandardizedEntrySelectionChange = (destinationKey, currentPropVal, stdEval, replaceOrAddGid, previousSlotGid = null) => {
    if (!selectedBenchId || !manifestData[selectedBenchId] || !stdEval?.isTechnicallyEligible) return;
    if (!isExactMetaobjectGid(replaceOrAddGid) || !stdEval.verifiedEntriesMap.has(replaceOrAddGid)) return;

    const currentProposedList = parseMetaobjectGidArray(currentPropVal || stdEval.autoProposalSerialized);
    const existingSet = new Set(stdEval.existingGids || []);

    let updatedGids = [...stdEval.existingGids];
    currentProposedList.forEach((gid) => {
      if (existingSet.has(gid)) return;
      if (previousSlotGid && gid === previousSlotGid) {
        if (!updatedGids.includes(replaceOrAddGid)) {
          updatedGids.push(replaceOrAddGid);
        }
      } else if (!updatedGids.includes(gid)) {
        updatedGids.push(gid);
      }
    });

    if (!updatedGids.includes(replaceOrAddGid)) {
      updatedGids.push(replaceOrAddGid);
    }

    const serialized = JSON.stringify(updatedGids);
    handleRepairPlanChange(destinationKey, serialized);
  };

  const handleToggleVerifiedStandardizedEntry = (destinationKey, currentPropVal, stdEval, targetGid, shouldInclude) => {
    if (!selectedBenchId || !manifestData[selectedBenchId] || !stdEval?.isTechnicallyEligible) return;
    if (!isExactMetaobjectGid(targetGid) || !stdEval.verifiedEntriesMap.has(targetGid)) return;

    const existingSet = new Set(stdEval.existingGids || []);
    // Never allow removing an already-assigned entry
    if (!shouldInclude && existingSet.has(targetGid)) return;

    const currentProposedList = parseMetaobjectGidArray(currentPropVal || stdEval.autoProposalSerialized);
    let nextGids = [...stdEval.existingGids];

    currentProposedList.forEach((gid) => {
      if (!shouldInclude && gid === targetGid) return;
      if (!nextGids.includes(gid) && (existingSet.has(gid) || stdEval.verifiedEntriesMap.has(gid))) {
        nextGids.push(gid);
      }
    });

    if (shouldInclude && !nextGids.includes(targetGid)) {
      nextGids.push(targetGid);
    }

    if (nextGids.length === 0) return;
    handleRepairPlanChange(destinationKey, JSON.stringify(nextGids));
  };

  const matchesFilter = useCallback((m) => {
    if (!m || typeof m !== "object") return false;
    if (activeFilter === "All") return true;
    if (activeFilter === "Blank") {
      return m.fieldStatus === "Optional blank" || m.fieldStatus === "Required missing";
    }
    if (activeFilter === "Proposed changes") {
      return (
        m.fieldStatus === "Proposed" ||
        m.fieldStatus === "Approved, not saved" ||
        m.fieldStatus === "Approved, blocked" ||
        m.fieldStatus === "Pre-approved, not saved" ||
        m.fieldStatus === "Pre-approved, blocked" ||
        m.fieldStatus === "Keep original (suggestion rejected)"
      );
    }
    if (activeFilter === "Conflicts") {
      return (
        m.fieldStatus === "Conflict" ||
        m.fieldStatus === "Degrade" ||
        m.fieldStatus === "Save Conflict" ||
        Boolean(m.conflictData) ||
        Boolean(m.nativeDescConflictData)
      );
    }
    if (activeFilter === "Needs review") {
      // Genuine save conflicts or backend API errors always stay visible in Needs review
      const hasRealConflictOrApiError = Boolean(
        m.conflictData ||
          m.nativeDescConflictData ||
          m.fieldStatus === "Save Conflict" ||
          m.fieldStatus === "API Error / Blocked"
      );
      if (hasRealConflictOrApiError) return true;

      // Parked/excluded inventory rows without a real conflict/API error do not require review
      if (m.isParkedExcluded) return false;

      // Required missing fields always need operator attention
      if (m.fieldStatus === "Required missing") return true;

      // Clean Keep-Original decisions leave Needs review (their write-prohibition is intentional retention, not an error)
      if (m.isKeepOriginalSelected) return false;

      // Clean explicitly approved or content-pre-approved items without technical blocks leave Needs review
      if ((m.isApproved || m.isContentPreApproved) && !m.hasTechnicalBlock) {
        return false;
      }

      // Retain an actively edited field whose input was temporarily cleared mid-edit so the row does not vanish
      if (m.isTemporarilyClearedManualEdit) {
        return true;
      }

      // Actionable blocked proposals, over-limit fields, unverified proposals, and unapproved review-required proposals stay in Needs review
      if (
        m.isActualBlockedProposal ||
        m.fieldStatus === "Unverified proposal" ||
        m.fieldStatus === "Over limit" ||
        m.fieldStatus === "Approved, blocked" ||
        m.fieldStatus === "Pre-approved, blocked" ||
        (m.contentNeedsReview && !m.isApproved && !m.isContentPreApproved)
      ) {
        return true;
      }

      return false;
    }
    if (activeFilter === m.source) return true;
    return false;
  }, [activeFilter]);

  const handleCollectTelemetry = useCallback((modeArg = "full", rawOptions = {}) => {
    const cleanMode = typeof modeArg === "string" && modeArg.trim() !== "" ? modeArg.trim() : "full";
    const safeOptions = validObj(rawOptions);
    const captureBenchId = selectedBenchId;

    if (!captureBenchId || !manifestData?.[captureBenchId]) {
      setTelemetryPacket(null);
      setSafetyError("Cannot capture telemetry: No active bench item is loaded.");
      return null;
    }

    const hasExplicitPartRequest = Boolean(
      safeOptions.partIndex !== undefined &&
      safeOptions.existingPacket &&
      isValidTelemetryPacketForProduct(safeOptions.existingPacket, captureBenchId)
    );
    const isFreshManualCapture = !hasExplicitPartRequest && !safeOptions.existingPacket;

    const commitCapturedPacket = (candidatePacket) => {
      if (!candidatePacket || !isComponentMountedRef.current) return;
      // Guard against a late callback from a previous product overwriting the current bench product's packet
      if (activeBenchIdRef.current !== captureBenchId) return;
      if (!isValidTelemetryPacketForProduct(candidatePacket, captureBenchId)) return;
      setTelemetryPacket(candidatePacket);
      if (isFreshManualCapture) {
        publishCapturedPacketToSidekickCache(candidatePacket, captureBenchId);
      }
    };

    try {
      const maybeResult = buildAndCopyMatrixTelemetry({
        mode: cleanMode,
        options: safeOptions,
        sectionTitle: safeOptions.sectionTitle,
        partIndex: hasExplicitPartRequest ? safeOptions.partIndex : undefined,
        existingPacket: hasExplicitPartRequest ? safeOptions.existingPacket : undefined,
        onTelemetryPacketReady: commitCapturedPacket,
        selectedBenchId: captureBenchId,
        manifestData,
        repairHistory,
        safeProducts,
        approvals,
        submittedPayloads,
        standardizedCandidatesByProduct,
        referenceMatchResultsByProduct,
        referenceMatchStatusByProduct,
        getSystemStatus,
        getFieldMetadata,
        setSafetyError,
        setSafetyMessage
      });

      if (maybeResult && typeof maybeResult.then === "function") {
        maybeResult
          .then((resolvedPacket) => {
            if (resolvedPacket) {
              commitCapturedPacket(resolvedPacket);
            }
          })
          .catch((err) => {
            if (isComponentMountedRef.current) {
              setSafetyError(`Failed to capture telemetry report: ${err?.message || "Unknown telemetry error"}`);
            }
          });
        return maybeResult;
      }

      if (maybeResult && isValidTelemetryPacketForProduct(maybeResult, captureBenchId)) {
        commitCapturedPacket(maybeResult);
        return maybeResult;
      }

      return null;
    } catch (err) {
      setSafetyError(`Failed to capture telemetry report: ${err?.message || "Unknown telemetry error"}`);
      return null;
    }
  }, [
    selectedBenchId,
    manifestData,
    repairHistory,
    safeProducts,
    approvals,
    keepOriginalDecisions,
    manualEdits,
    submittedPayloads,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    batchFetcher.state,
    referenceMatchFetcher.state,
    pendingReferenceMatch,
    isLoadingData,
    safetyMessage,
    safetyError,
    aiStep,
    executionMode,
    getSystemStatus,
    getFieldMetadata,
    publishCapturedPacketToSidekickCache
  ]);

  const handleCopyTelemetryPart = useCallback((partArrayIndex) => {
    if (!selectedBenchId) {
      setSafetyError("Cannot copy telemetry part: No active product selected on the bench.");
      return;
    }
    if (!isValidTelemetryPacketForProduct(telemetryPacket, selectedBenchId)) {
      setSafetyError("Cannot copy telemetry part: No valid captured report snapshot exists for the active product. Click 'Capture Full Report' or 'Capture Review Report' first.");
      return;
    }

    const numericIndex = Number(partArrayIndex);
    if (!Number.isInteger(numericIndex) || numericIndex < 0 || numericIndex >= telemetryPacket.parts.length) {
      setSafetyError(`Cannot copy telemetry part: Invalid part index (${String(partArrayIndex)}).`);
      return;
    }

    const updatedPacket = copyCapturedTelemetryPart({
      packet: telemetryPacket,
      partIndex: numericIndex,
      setSafetyError,
      setSafetyMessage
    });

    if (updatedPacket && isValidTelemetryPacketForProduct(updatedPacket, selectedBenchId)) {
      setTelemetryPacket(updatedPacket);
    }
  }, [selectedBenchId, telemetryPacket]);

  const handleDownloadTelemetry = useCallback((packetArg) => {
    const targetPacket = packetArg && isValidTelemetryPacketForProduct(packetArg, selectedBenchId)
      ? packetArg
      : telemetryPacket;

    if (!selectedBenchId || !isValidTelemetryPacketForProduct(targetPacket, selectedBenchId)) {
      setSafetyError("Cannot download captured report: No valid captured report snapshot exists for the active product. Click 'Capture Full Report' or 'Capture Review Report' first.");
      return false;
    }

    return downloadCapturedTelemetryReport({
      packet: targetPacket,
      setSafetyError,
      setSafetyMessage
    });
  }, [selectedBenchId, telemetryPacket]);

  const toggleBay = (title) => {
    setExpandedBays(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;
  const activeBenchData = selectedBenchId ? manifestData[selectedBenchId] : null;
  const isSelectedProductUnloaded = Boolean(selectedBenchId && !activeBenchData);
  const isDevUnselectedPreview = Boolean(
    DEV_SHOW_ALL_TEMPLATE_FIELDS &&
    selectedBenchId === null &&
    unselectedDraftManifest?.isUnselectedDraft === true
  );
  const isUnselectedBlankPreviewActive = Boolean(!selectedBenchId && DEV_SHOW_ALL_TEMPLATE_FIELDS);
  const effectiveManifestForSections = activeBenchData || (isDevUnselectedPreview ? unselectedDraftManifest : null);

  const dynamicSections = effectiveManifestForSections
    ? getDynamicSections(effectiveManifestForSections, { includeTab3InspectableInventory: true })
    : getDynamicSections(null, { includeTab3InspectableInventory: true });
  const allDynamicConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  const activeBenchStats = activeBenchData ? getDiagnosticsStats(activeBenchData, selectedBenchId) : null;
  const unselectedDraftStats = isDevUnselectedPreview ? getDiagnosticsStats(unselectedDraftManifest, null) : null;
  const activeBenchStatusObj = activeBenchData ? getSystemStatus() : null;
  const activeBenchHistory = selectedBenchId ? repairHistory[selectedBenchId] : null;

  // Compute read-only monitoring status for the orchestrator panel
  const isBenchSelectedBool = Boolean(selectedBenchId && isExactProductGid(selectedBenchId));
  const isBaselineLoadedBool = Boolean(isBenchSelectedBool && activeBenchData);
  const activeBaselineMeta = isBaselineLoadedBool ? (baselineMetaByProductRef.current[selectedBenchId] || null) : null;
  const activeManualEditsMap = isBenchSelectedBool
    ? validObj(manualEdits[selectedBenchId])
    : (isUnselectedBlankPreviewActive ? validObj(manualEdits[UNSELECTED_DRAFT_STORAGE_KEY]) : {});
  const activeManualEditCount = Object.keys(activeManualEditsMap).filter((k) => activeManualEditsMap[k] === true).length;
  const activeExplicitApprovalCount = isBenchSelectedBool
    ? Object.keys(validObj(approvals[selectedBenchId])).length
    : (isUnselectedBlankPreviewActive ? Object.keys(validObj(approvals[UNSELECTED_DRAFT_STORAGE_KEY])).length : 0);
  const effectiveStatsForSummary = isBaselineLoadedBool ? activeBenchStats : unselectedDraftStats;
  const activeKeepOriginalCount = typeof effectiveStatsForSummary?.keepOriginal === "number" ? effectiveStatsForSummary.keepOriginal : 0;
  const activeProposedCount = typeof effectiveStatsForSummary?.proposed === "number" ? effectiveStatsForSummary.proposed : 0;
  const activeApprovedWriteCount = typeof effectiveStatsForSummary?.approvedWrite === "number" ? effectiveStatsForSummary.approvedWrite : 0;

  let unsavedWorkingChangesWord = "Not available";
  let unsavedWorkingChangesDetail = "No baseline loaded";
  if (isBaselineLoadedBool && activeBenchStats) {
    const hasUnsavedWorking =
      activeProposedCount > 0 ||
      activeManualEditCount > 0 ||
      activeExplicitApprovalCount > 0 ||
      activeKeepOriginalCount > 0;
    unsavedWorkingChangesWord = hasUnsavedWorking ? "Yes" : "No";
    unsavedWorkingChangesDetail = `Proposals: ${activeProposedCount} | Manual edits: ${activeManualEditCount} | Explicit approvals: ${activeExplicitApprovalCount} | Keep original: ${activeKeepOriginalCount} | Approved for write: ${activeApprovedWriteCount}`;
  } else if (isUnselectedBlankPreviewActive && unselectedDraftStats) {
    const hasSeedOrContext =
      hasMeaningfulValue(draftSourceContext?.rawSeedInput) ||
      hasMeaningfulValue(draftSourceContext?.explicitTitleOverride) ||
      hasMeaningfulValue(draftSourceContext?.origin_story);
    const hasUnsavedDraftWorking =
      activeProposedCount > 0 ||
      activeManualEditCount > 0 ||
      activeExplicitApprovalCount > 0 ||
      hasSeedOrContext;
    unsavedWorkingChangesWord = hasUnsavedDraftWorking ? "Yes (Unsaved Draft)" : "No";
    unsavedWorkingChangesDetail = `Draft proposals: ${activeProposedCount} | Draft manual edits: ${activeManualEditCount} | Draft approvals: ${activeExplicitApprovalCount} (No product selected or saved)`;
  }

  let verifiedSavedWord = "No";
  let verifiedSavedDetail = isBenchSelectedBool
    ? "No repair executed in session"
    : isUnselectedBlankPreviewActive
      ? "Unsaved new-product draft (no product selected or saved)"
      : "No product selected";
  if (isBenchSelectedBool && activeBenchHistory) {
    const verifiedDestCount = validArray(activeBenchHistory.verifiedDestinations).length;
    const attemptedDestCount = validArray(activeBenchHistory.attemptedDestinations).length;
    const blockedDestCount = Object.keys(validObj(activeBenchHistory.blockedFields)).length;
    const conflictDestCount = Object.keys(validObj(activeBenchHistory.conflicts)).length;
    const unresolvedDestCount = Object.keys(validObj(activeBenchHistory.unresolvedChanges)).length;
    const hasPartialOrUnresolved =
      activeBenchHistory.status === "PARTIAL_SUCCESS" ||
      blockedDestCount > 0 ||
      conflictDestCount > 0 ||
      unresolvedDestCount > 0 ||
      (attemptedDestCount > 0 && verifiedDestCount < attemptedDestCount);

    if (activeBenchHistory.readBackVerified === true && verifiedDestCount > 0) {
      verifiedSavedWord = "Yes";
      verifiedSavedDetail = hasPartialOrUnresolved
        ? `Partial (${verifiedDestCount}/${attemptedDestCount || verifiedDestCount} destinations verified at ${activeBenchHistory.completedAt || "Unknown"})`
        : `${verifiedDestCount} destination(s) verified at ${activeBenchHistory.completedAt || "Unknown"}`;
    } else if (activeBenchHistory.readBackVerified === false) {
      verifiedSavedWord = "No";
      verifiedSavedDetail = `Read-back not verified (${activeBenchHistory.status || "Unknown"} at ${activeBenchHistory.completedAt || "Unknown"})`;
    } else {
      verifiedSavedWord = "Unknown";
      verifiedSavedDetail = `Status: ${activeBenchHistory.status || "Unknown"} at ${activeBenchHistory.completedAt || "Unknown"}`;
    }
  }

  const isCurrentProductAckSynced = Boolean(
    isBenchSelectedBool &&
    liveBenchSyncStatus.lifecycle === "acknowledged" &&
    liveBenchSyncStatus.selectionState === "selected" &&
    liveBenchSyncStatus.productId === selectedBenchId &&
    liveBenchSyncStatus.benchSessionId === benchSessionIdRef.current &&
    liveBenchSyncStatus.benchRevision === lastLiveStateRevisionRef.current &&
    lastLiveStateDigestRef.current !== "" &&
    lastLiveSyncedDigestRef.current === lastLiveStateDigestRef.current
  );

  const isUnselectedPreviewAckSynced = Boolean(
    isUnselectedBlankPreviewActive &&
    liveBenchSyncStatus.lifecycle === "acknowledged" &&
    liveBenchSyncStatus.selectionState === "unselected_preview" &&
    liveBenchSyncStatus.productId === null &&
    liveBenchSyncStatus.benchSessionId === benchSessionIdRef.current &&
    liveBenchSyncStatus.benchRevision === lastLiveStateRevisionRef.current &&
    lastLiveStateDigestRef.current !== "" &&
    lastLiveSyncedDigestRef.current === lastLiveStateDigestRef.current
  );

  const isClearedAckSynced = Boolean(
    !isBenchSelectedBool &&
    !isUnselectedBlankPreviewActive &&
    liveBenchSyncStatus.lifecycle === "cleared" &&
    liveBenchSyncStatus.selectionState === "none" &&
    liveBenchSyncStatus.benchSessionId === benchSessionIdRef.current &&
    liveBenchSyncStatus.benchRevision === lastLiveStateRevisionRef.current
  );

  let sidekickLiveSyncWord = "Unknown";
  let sidekickLiveSyncTone = "info";
  let sidekickLiveSyncLifecycleLabel = liveBenchSyncStatus.lifecycle || "unavailable";

  if (isCurrentProductAckSynced) {
    sidekickLiveSyncWord = "Yes";
    sidekickLiveSyncTone = "success";
    sidekickLiveSyncLifecycleLabel = "acknowledged (selected product)";
  } else if (isUnselectedPreviewAckSynced) {
    sidekickLiveSyncWord = "Yes";
    sidekickLiveSyncTone = "success";
    sidekickLiveSyncLifecycleLabel = "acknowledged (unselected draft/preview)";
  } else if (isClearedAckSynced) {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "cleared (no product selected)";
  } else if (liveBenchSyncStatus.lifecycle === "pending") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "pending";
  } else if (liveBenchSyncStatus.lifecycle === "error") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "critical";
    sidekickLiveSyncLifecycleLabel = `error (${liveBenchSyncStatus.errorCode || "unknown"})`;
  } else if (liveBenchSyncStatus.lifecycle === "unavailable") {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "info";
    sidekickLiveSyncLifecycleLabel = "unavailable";
  } else {
    sidekickLiveSyncWord = "No";
    sidekickLiveSyncTone = "attention";
    sidekickLiveSyncLifecycleLabel = "superseded / awaiting sync";
  }

  const nativeDescriptionMeta = activeBenchData
    ? getFieldMetadata("native_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : (isDevUnselectedPreview
        ? getFieldMetadata("native_description", unselectedDraftManifest, null, approvals, allDynamicConfigFields)
        : null);
  const customDescriptionMeta = activeBenchData
    ? getFieldMetadata("custom.generated_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : (isDevUnselectedPreview
        ? getFieldMetadata("custom.generated_description", unselectedDraftManifest, null, approvals, allDynamicConfigFields)
        : null);

  // Build audit count summary from reported section measurements for the current product (or null in unselected draft),
  // keeping full 93-slot inventory counts distinct from filtered descriptor counts and mounted DOM rows.
  const currentAuditOwnerId = isDevUnselectedPreview ? null : (selectedBenchId || null);
  const activeSectionMeasurementsMap =
    sectionAuditMeasurements.productId === currentAuditOwnerId
      ? sectionAuditMeasurements.bySection
      : {};

  const fullInventoryKeysByGroupForAudit = {};
  const renderedKeysByGroupForAudit = {};
  Object.entries(activeSectionMeasurementsMap).forEach(([secTitle, rec]) => {
    const fullKeys = Array.isArray(rec?.fullInventoryKeys)
      ? rec.fullInventoryKeys
      : Array.isArray(rec?.descriptorKeys)
        ? rec.descriptorKeys
        : Array.isArray(rec?.renderedKeys)
          ? rec.renderedKeys
          : null;
    if (fullKeys) {
      fullInventoryKeysByGroupForAudit[secTitle] = fullKeys;
    }
    const descKeys = Array.isArray(rec?.descriptorKeys)
      ? rec.descriptorKeys
      : Array.isArray(rec?.renderedKeys)
        ? rec.renderedKeys
        : null;
    if (descKeys) {
      renderedKeysByGroupForAudit[secTitle] = descKeys;
    }
  });

  const templateAuditSummary = computeTemplateAuditCounts(
    TAB3_INSPECTABLE_TEMPLATE_GROUPS,
    Object.keys(fullInventoryKeysByGroupForAudit).length > 0
      ? { renderedKeysByGroup: fullInventoryKeysByGroupForAudit }
      : null
  );

  const filteredDescriptorAuditSummary = computeTemplateAuditCounts(
    TAB3_INSPECTABLE_TEMPLATE_GROUPS,
    Object.keys(renderedKeysByGroupForAudit).length > 0
      ? { renderedKeysByGroup: renderedKeysByGroupForAudit }
      : null
  );

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub — Accessible Diagnostic View</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "24px", alignItems: "start", boxSizing: "border-box", maxWidth: "100%" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <InventorySelectionColumn
          queueIds={queueIds}
          searchQuery={searchQuery}
          isLoadingData={isLoadingData}
          isExecuting={isExecuting}
          allFilteredSelected={allFilteredSelected}
          filteredProducts={filteredProducts}
          selectedBenchId={selectedBenchId}
          productStates={productStates}
          manifestData={manifestData}
          defaultQueuedStatus={STATUS.QUEUED}
          getStatusTone={getStatusTone}
          onSearchChange={handleSearchChange}
          onClearSearch={handleClearSearch}
          onToggleSelectAllFiltered={toggleSelectAllFiltered}
          onToggleProductSelection={handleToggleProductSelection}
          onSelectBenchItem={handleSelectBenchItem}
        />

        {/* RIGHT COLUMN: Repair Manifest Viewer */}
        <div style={{ minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <BlockStack gap="600">
            <Text variant="headingXl" as="h2">2. Repair Bench & Engine Diagnostics</Text>

            {safetyMessage && (
              <Banner tone="info" onDismiss={() => setSafetyMessage("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyMessage}</Text>
              </Banner>
            )}
            {safetyError && (
              <Banner tone="critical" onDismiss={() => setSafetyError("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyError}</Text>
              </Banner>
            )}
            {telemetryPublishNotice && (telemetryPublishNotice.productId ?? null) === (selectedBenchId ?? null) && (
              <Banner
                tone={telemetryPublishNotice.tone || "info"}
                onDismiss={() => setTelemetryPublishNotice(null)}
              >
                <Text as="p" variant="bodyMd" fontWeight="medium">
                  {telemetryPublishNotice.message}
                </Text>
              </Banner>
            )}

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h3">Repair Engine Orchestrator</Text>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", minWidth: 0 }}>
                    <Button 
                      size="large" 
                      variant="secondary" 
                      icon={MagicIcon} 
                      onClick={generateRepairPlan} 
                      disabled={isLoadingData || isExecuting}
                      loading={isLoadingData}
                    >
                      GENERATE REPAIR PLAN (LOAD DATA)
                    </Button>
                    
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="critical" 
                      onClick={executeRepairs} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "REPAIR"}
                    >
                      EXECUTE REPAIRS (LIVE)
                    </Button>

                    <Button 
                      size="large" 
                      variant="primary" 
                      icon={MagicIcon}
                      onClick={executeAIFill} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "AI_BATCH_PIPELINE"}
                    >
                      EXECUTE AI AUTO-FILL (STAGE)
                    </Button>
                  </div>
                </InlineStack>

                <Banner tone="warning">
                  <Text as="p" variant="bodyLg"><strong>Structural Repairs</strong> writes your edited Local Repair Plan to Shopify. <strong>AI Auto-Fill</strong> spins up Gemini to generate missing data and stages it below for you to review before writing.</Text>
                </Banner>

                {(isExecuting || isLoadingData) && queueIds.length > 0 && (
                  <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" variant="headingMd">{isLoadingData ? "Fetching Live Data..." : "Live Execution Progress"}</Text>
                        <Text as="p" variant="headingMd">{isLoadingData ? loadIndex : executeIndex} of {queueIds.length} Processed</Text>
                      </InlineStack>
                      <ProgressBar progress={progressPercentage} color="primary" size="large" />
                    </BlockStack>
                  </Box>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px", minWidth: 0 }}>
                  <Button size="large" tone="critical" onClick={clearBench} disabled={isExecuting || isLoadingData}>Clear Rack & Reset Bench</Button>
                  
                  <Button
                    size="large"
                    icon={ClipboardIcon}
                    onClick={() => handleCollectTelemetry("full")}
                    disabled={!selectedBenchId || !activeBenchData}
                    aria-label="Capture Full Report snapshot and copy Part 1 to clipboard"
                  >
                    Capture Full Report
                  </Button>
                </div>

                <Box padding="300" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                  <BlockStack gap="150">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h4" variant="headingSm" fontWeight="bold">
                        Read-Only Sidekick Live Bench Monitoring Status
                      </Text>
                      <Badge tone={sidekickLiveSyncTone}>
                        {`Sidekick Live Sync: ${sidekickLiveSyncWord} (${sidekickLiveSyncLifecycleLabel})`}
                      </Badge>
                    </InlineStack>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 16px", fontSize: "13px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      <div>
                        <strong>Bench Selected:</strong>{" "}
                        {isBenchSelectedBool
                          ? `Yes (${selectedBenchId})`
                          : isUnselectedBlankPreviewActive
                            ? "No (Unselected New-Product Draft / Preview)"
                            : "No (None)"}
                      </div>
                      <div>
                        <strong>Baseline Loaded:</strong> {isBaselineLoadedBool ? "Yes" : "No"} ({activeBaselineMeta?.loadedAt || "Not available"})
                      </div>
                      <div>
                        <strong>Unsaved Working Changes:</strong> {unsavedWorkingChangesWord} ({unsavedWorkingChangesDetail})
                      </div>
                      <div>
                        <strong>Verified Saved in Session:</strong> {verifiedSavedWord} ({verifiedSavedDetail})
                      </div>
                    </div>

                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>Session:</strong> {liveBenchSyncStatus.benchSessionId || benchSessionIdRef.current || "Not available"} | <strong>Revision:</strong> {liveBenchSyncStatus.benchRevision !== null ? liveBenchSyncStatus.benchRevision : "Not available"} | <strong>Selection State:</strong> {liveBenchSyncStatus.selectionState || "Not available"} | <strong>Synced Product:</strong> {liveBenchSyncStatus.productId || (liveBenchSyncStatus.selectionState === "unselected_preview" ? "None (Unselected Draft)" : "Not available")} | <strong>Report ID:</strong> {liveBenchSyncStatus.reportId || "Not available"}
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      <strong>Client State Changed:</strong> {liveBenchSyncStatus.clientStateChangedAt || "Not available"} | <strong>Baseline Loaded At:</strong> {liveBenchSyncStatus.baselineLoadedAt || activeBaselineMeta?.loadedAt || "Not available"} | <strong>Server Received At:</strong> {liveBenchSyncStatus.serverReceivedAt || "Not available"}
                      {liveBenchSyncStatus.errorMessage ? ` | Error: ${liveBenchSyncStatus.errorMessage}` : ""}
                    </Text>
                  </BlockStack>
                </Box>
              </BlockStack>
            </Card>

            {DEV_SHOW_ALL_TEMPLATE_FIELDS && (isDevUnselectedPreview || Boolean(activeBenchData)) && (
              <Card padding="400">
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone="warning">DEV: Show All Template Fields</Badge>
                      <Text as="h3" variant="headingMd" fontWeight="bold">
                        Tab 3 Inspectable Inventory &amp; Rendered Row Audit ({isDevUnselectedPreview ? "Unselected New-Product Draft" : `Active Product: ${selectedBenchId}`} | Filter: {activeFilter})
                      </Text>
                    </InlineStack>
                    <Badge tone={templateAuditSummary.measurementStatus === "complete" ? "success" : "attention"}>
                      {templateAuditSummary.measurementStatus === "complete"
                        ? `Measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups)`
                        : `Measuring (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
                    </Badge>
                  </InlineStack>

                  <Text as="p" variant="bodySm" tone="subdued">
                    <strong>Scope:</strong> Counts below distinguish the complete 93-slot logical inventory (62 working capabilities + 31 parked/excluded entries across 11 drawers), full inventory rows (including per-image media expansion), filtered row descriptors matching <code>{activeFilter}</code>, bay expansion state, and scoped post-commit mounted DOM row elements. Collapsed drawers mount 0 DOM rows while preserving their full logical inventory.
                  </Text>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                          <th style={{ padding: "8px 10px" }}>Template Group</th>
                          <th style={{ padding: "8px 10px" }}>Logical Slots</th>
                          <th style={{ padding: "8px 10px" }}>Running Logical Subtotal</th>
                          <th style={{ padding: "8px 10px" }}>Full Inventory Rows</th>
                          <th style={{ padding: "8px 10px" }}>Filtered Descriptors ({activeFilter})</th>
                          <th style={{ padding: "8px 10px" }}>Bay State</th>
                          <th style={{ padding: "8px 10px" }}>Mounted DOM Rows</th>
                          <th style={{ padding: "8px 10px" }}>Running Mounted DOM Subtotal</th>
                          <th style={{ padding: "8px 10px" }}>Notes / Media Expansion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          let runningLogical = 0;
                          let runningMountedDom = 0;
                          let allDomMeasuredSoFar = true;

                          return templateAuditSummary.groupSubtotals.map((grp, idx) => {
                            runningLogical += grp.logicalCount;
                            const rawSecRec = activeSectionMeasurementsMap[grp.heading] || null;
                            const filteredGrp = filteredDescriptorAuditSummary.groupSubtotals[idx] || null;
                            const isGrpMeasured = grp.measurementStatus === "measured" && typeof grp.renderedCount === "number";
                            const isFilteredMeasured = filteredGrp && filteredGrp.measurementStatus === "measured" && typeof filteredGrp.renderedCount === "number";
                            const hasDomCount =
                              rawSecRec &&
                              typeof rawSecRec.mountedDomRowCount === "number" &&
                              Number.isFinite(rawSecRec.mountedDomRowCount);

                            if (isGrpMeasured && hasDomCount) {
                              runningMountedDom += rawSecRec.mountedDomRowCount;
                            } else {
                              allDomMeasuredSoFar = false;
                            }

                            const bayStateLabel =
                              !isGrpMeasured || typeof rawSecRec?.isExpanded !== "boolean"
                                ? "Not measured"
                                : rawSecRec.isExpanded
                                  ? "Expanded"
                                  : "Collapsed";

                            let rowNote = grp.heading === TAB3_PARKED_DRAWER_HEADING
                              ? "31 parked/excluded read-only registry slots"
                              : "1:1 canonical working rows";
                            if (!isGrpMeasured) {
                              rowNote = "Not measured";
                            } else if (grp.logicalImageAltCount > 0) {
                              if (templateAuditSummary.mediaControlCount > 0) {
                                rowNote = `Includes ${templateAuditSummary.mediaControlCount} per-image media alt control(s) from 1 logical native_image_alt capability`;
                              } else if (templateAuditSummary.hasZeroImagePlaceholder) {
                                rowNote = "Includes 1 read-only zero-image placeholder row for native_image_alt";
                              }
                            } else if (grp.nonMediaDiscrepancy !== null && grp.nonMediaDiscrepancy !== 0) {
                              rowNote = `Non-media row delta: ${grp.nonMediaDiscrepancy > 0 ? `+${grp.nonMediaDiscrepancy}` : grp.nonMediaDiscrepancy}`;
                            }

                            return (
                              <tr key={grp.heading} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                <td style={{ padding: "6px 10px", fontWeight: "600" }}>{grp.heading}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{grp.logicalCount}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>{runningLogical}</td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                                  {isGrpMeasured ? grp.renderedCount : "Not measured"}
                                </td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                                  {isFilteredMeasured ? filteredGrp.renderedCount : "Not measured"}
                                </td>
                                <td style={{ padding: "6px 10px", color: "#475569" }}>
                                  {bayStateLabel}
                                </td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                                  {isGrpMeasured && hasDomCount ? rawSecRec.mountedDomRowCount : "Not measured"}
                                </td>
                                <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>
                                  {allDomMeasuredSoFar ? runningMountedDom : "Not measured (incomplete)"}
                                </td>
                                <td style={{ padding: "6px 10px", color: "#475569" }}>{rowNote}</td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                      <tfoot>
                        {(() => {
                          let totalMountedDom = 0;
                          let allGroupsHaveDomCount =
                            templateAuditSummary.measurementStatus === "complete" &&
                            templateAuditSummary.totalGroupCount > 0;
                          if (allGroupsHaveDomCount) {
                            for (let i = 0; i < templateAuditSummary.groupSubtotals.length; i += 1) {
                              const gHeading = templateAuditSummary.groupSubtotals[i].heading;
                              const secRec = activeSectionMeasurementsMap[gHeading];
                              if (
                                secRec &&
                                typeof secRec.mountedDomRowCount === "number" &&
                                Number.isFinite(secRec.mountedDomRowCount)
                              ) {
                                totalMountedDom += secRec.mountedDomRowCount;
                              } else {
                                allGroupsHaveDomCount = false;
                                break;
                              }
                            }
                          }
                          return (
                            <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "700", borderTop: "2px solid #94a3b8" }}>
                              <td style={{ padding: "8px 10px" }}>GRAND TOTAL ({templateAuditSummary.totalGroupCount} Groups)</td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                                {templateAuditSummary.totalRenderedRows !== null
                                  ? templateAuditSummary.totalRenderedRows
                                  : `Not measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
                              </td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                                {filteredDescriptorAuditSummary.totalRenderedRows !== null
                                  ? filteredDescriptorAuditSummary.totalRenderedRows
                                  : `Not measured (${filteredDescriptorAuditSummary.measuredGroupCount}/${filteredDescriptorAuditSummary.totalGroupCount} groups reported)`}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                {templateAuditSummary.measurementStatus === "complete" ? "Measured" : "Incomplete"}
                              </td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                                {allGroupsHaveDomCount ? totalMountedDom : "Not measured"}
                              </td>
                              <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                                {allGroupsHaveDomCount ? totalMountedDom : "Not measured"}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                {templateAuditSummary.mediaControlCount !== null
                                  ? `Per-Image Media Controls: ${templateAuditSummary.mediaControlCount} | Zero-Image Placeholder: ${templateAuditSummary.hasZeroImagePlaceholder ? "1 (Active)" : "0"}`
                                  : "Media breakdown: Not measured"}
                              </td>
                            </tr>
                          );
                        })()}
                      </tfoot>
                    </table>
                  </div>
                </BlockStack>
              </Card>
            )}

            {!selectedBenchId || !activeBenchData ? (
              <BlockStack gap="600">
                <Box padding="600" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                  <BlockStack gap="200">
                    {isSelectedProductUnloaded ? (
                      <>
                        <Text as="p" variant="headingLg" alignment="center" tone="subdued">
                          Selected product ({selectedBenchId}) is not loaded into browser state yet. Hit GENERATE REPAIR PLAN (LOAD DATA) to load its live Shopify baseline before editing or saving.
                        </Text>
                        <div style={{ display: "flex", justifyContent: "center", marginTop: "8px" }}>
                          <Button size="medium" onClick={() => handleSelectBenchItem(null)}>
                            Deselect Product &amp; Return to Unselected Draft
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Text as="p" variant="headingLg" alignment="center" tone="subdued">
                          Load inventory, hit GENERATE REPAIR PLAN, then click &quot;View Manifest on Bench&quot; to repair an existing product, or enter a 3-part seed / starting data below in New-Product Draft mode.
                        </Text>
                        {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
                          <Text as="p" variant="bodyMd" alignment="center" tone="subdued">
                            <strong>Unselected New-Product Draft Mode:</strong> Enter a human ID or 3-part seed in the intake card below, or expand any of the 11 Tab 3 inspectable drawers (93 logical slots = 62 working + 31 parked/excluded, starting collapsed) plus Description Review. Eligible working fields accept unsaved starting data and suggestion approvals in browser state while preserving all parked, storage, producer, variant-owner, standardized-reference, and zero-image placeholder holds. Draft inputs are never treated as saved Shopify baselines.
                          </Text>
                        )}
                      </>
                    )}
                  </BlockStack>
                </Box>

                {isDevUnselectedPreview && (
                  <>
                    <UnselectedDraftSeedIntakeCard
                      selectedBenchId={selectedBenchId}
                      draftEpoch={draftEpoch}
                      draftManifest={unselectedDraftManifest}
                      manualEditsMap={validObj(manualEdits[UNSELECTED_DRAFT_STORAGE_KEY])}
                      sourceContext={draftSourceContext}
                      onSeedInputChange={handleDraftSeedInputChange}
                      onExplicitTitleOverrideChange={handleDraftExplicitTitleOverrideChange}
                      onSeedBlurCommit={handleDraftSeedBlurCommit}
                      onApplyTitleParseResult={handleApplyDraftTitleParseResult}
                    />

                    <UnselectedDraftManualInputs
                      selectedBenchId={selectedBenchId}
                      draftManifest={unselectedDraftManifest}
                      currentApprovals={approvals}
                      configFields={TAB3_INSPECTABLE_TEMPLATE_GROUPS.flatMap(g => g.fields || [])}
                      getFieldMetadata={getFieldMetadata}
                      onRepairPlanChange={handleRepairPlanChange}
                    />

                    <Card padding="400">
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingLg" as="h3">Unselected Draft Filter Controls</Text>
                          <Select
                            label="Filter Fields"
                            labelInline
                            options={FILTER_OPTIONS}
                            onChange={(val) => setActiveFilter(val)}
                            value={activeFilter}
                          />
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          Filtering changes which rows are displayed in open drawers without clearing draft inputs or approvals. Select <code>All</code> to inspect all 93 logical slots (62 working + 31 parked/excluded). Use &quot;Clear Rack &amp; Reset Bench&quot; above to reset draft inputs.
                        </Text>
                      </BlockStack>
                    </Card>

                    <DescriptionReviewSection
                      selectedBenchId={null}
                      data={unselectedDraftManifest}
                      meta={nativeDescriptionMeta}
                      customDescMeta={customDescriptionMeta}
                      keepOriginal={{}}
                      activeFilter={activeFilter}
                      expandedBays={expandedBays}
                      matchesFilter={matchesFilter}
                      isMultilineKey={isMultilineKey}
                      onToggleBay={toggleBay}
                      onRepairPlanChange={handleRepairPlanChange}
                      onToggleApproval={handleToggleApproval}
                      onToggleKeepOriginal={noopPreviewCallback}
                    />

                    {dynamicSections.map(sec => (
                      <ManifestSectionCard
                        key={sec.title}
                        section={sec}
                        selectedBenchId={null}
                        data={unselectedDraftManifest}
                        approvals={approvals}
                        keepOriginal={{}}
                        activeFilter={activeFilter}
                        expandedBays={expandedBays}
                        standardizedCandidatesByProduct={{}}
                        referenceMatchResultsByProduct={{}}
                        referenceMatchStatusByProduct={{}}
                        referenceMatchFetcherState="idle"
                        pendingReferenceMatch={null}
                        getFieldMetadata={getFieldMetadata}
                        matchesFilter={matchesFilter}
                        onToggleBay={toggleBay}
                        onReleasePendingReferenceMatch={noopPreviewCallback}
                        onMatchReferenceChoices={noopPreviewCallback}
                        onStandardizedEntrySelectionChange={noopPreviewCallback}
                        onToggleVerifiedStandardizedEntry={noopPreviewCallback}
                        onRepairPlanChange={handleRepairPlanChange}
                        onToggleApproval={handleToggleApproval}
                        onToggleKeepOriginal={noopPreviewCallback}
                        onSectionRenderedCountChange={handleSectionRenderedCountChange}
                      />
                    ))}
                  </>
                )}
              </BlockStack>
            ) : (
              <BlockStack gap="600">
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "2px solid #22c55e", gap: "16px", minWidth: 0, boxSizing: "border-box" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <Text as="h3" variant="headingLg" fontWeight="bold" style={{ color: "#166534" }}>
                            <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>GID Lock: {selectedBenchId}</span>
                        </Text>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", minWidth: 0 }}>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={MagicIcon} 
                        onClick={handleExecuteSingleAI}
                        loading={(batchFetcher.state !== "idle" || referenceMatchFetcher.state !== "idle") && !isExecuting}
                      >
                        Run AI (Single)
                      </Button>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={SaveIcon} 
                        onClick={handleExecuteSingleRepair}
                        loading={(batchFetcher.state !== "idle" || referenceMatchFetcher.state !== "idle") && !isExecuting}
                        tone="success"
                      >
                        Execute Single Repair
                      </Button>
                    </div>
                </div>

                <BenchDiagnosticHeader
                  selectedBenchId={selectedBenchId}
                  data={activeBenchData}
                  stats={activeBenchStats}
                  statusObj={activeBenchStatusObj}
                  history={activeBenchHistory}
                  telemetryPacket={telemetryPacket}
                  onCollectTelemetry={handleCollectTelemetry}
                  onCopyTelemetryPart={handleCopyTelemetryPart}
                  onDownloadTelemetry={handleDownloadTelemetry}
                />

                <Card padding="400">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h3">Review Board Controls</Text>
                        <Select
                            label="Filter Fields"
                            labelInline
                            options={FILTER_OPTIONS}
                            onChange={(val) => setActiveFilter(val)}
                            value={activeFilter}
                        />
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Filtering changes which rows are displayed in open drawers without clearing approvals, keep-original decisions, or save eligibility. Select <code>All</code> to inspect all 93 logical slots (62 working + 31 parked/excluded).
                    </Text>
                  </BlockStack>
                </Card>

                <DescriptionReviewSection
                  selectedBenchId={selectedBenchId}
                  data={activeBenchData}
                  meta={nativeDescriptionMeta}
                  customDescMeta={customDescriptionMeta}
                  keepOriginal={keepOriginalDecisions}
                  activeFilter={activeFilter}
                  expandedBays={expandedBays}
                  matchesFilter={matchesFilter}
                  isMultilineKey={isMultilineKey}
                  onToggleBay={toggleBay}
                  onRepairPlanChange={handleRepairPlanChange}
                  onToggleApproval={handleToggleApproval}
                  onToggleKeepOriginal={handleToggleKeepOriginal}
                />

                {dynamicSections.map(sec => (
                  <ManifestSectionCard
                    key={sec.title}
                    section={sec}
                    selectedBenchId={selectedBenchId}
                    data={activeBenchData}
                    approvals={approvals}
                    keepOriginal={keepOriginalDecisions}
                    activeFilter={activeFilter}
                    expandedBays={expandedBays}
                    standardizedCandidatesByProduct={standardizedCandidatesByProduct}
                    referenceMatchResultsByProduct={referenceMatchResultsByProduct}
                    referenceMatchStatusByProduct={referenceMatchStatusByProduct}
                    referenceMatchFetcherState={referenceMatchFetcher.state}
                    pendingReferenceMatch={pendingReferenceMatch}
                    getFieldMetadata={getFieldMetadata}
                    matchesFilter={matchesFilter}
                    onToggleBay={toggleBay}
                    onReleasePendingReferenceMatch={handleReleasePendingReferenceMatch}
                    onMatchReferenceChoices={handleMatchReferenceChoices}
                    onStandardizedEntrySelectionChange={handleStandardizedEntrySelectionChange}
                    onToggleVerifiedStandardizedEntry={handleToggleVerifiedStandardizedEntry}
                    onRepairPlanChange={handleRepairPlanChange}
                    onToggleApproval={handleToggleApproval}
                    onToggleKeepOriginal={handleToggleKeepOriginal}
                    onSectionRenderedCountChange={handleSectionRenderedCountChange}
                  />
                ))}
                
              </BlockStack>
            )}
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
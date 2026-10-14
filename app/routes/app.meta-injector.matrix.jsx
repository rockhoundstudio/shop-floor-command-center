import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, Button, InlineStack, Box, ProgressBar, Select } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { PRODUCT_TEMPLATE_GROUPS } from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  isExactMetaobjectGid,
  parseMetaobjectGidArray,
  evaluateStandardizedDestinationTechnicalStatus,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  buildCanonicalCandidateSnapshot,
  formatErrorsList,
  serializeStandardizedAssignmentForVision,
  validArray,
  validObj
} from "../utils/meta-injector.standardized.jsx";
import {
  STATUS,
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  RETIRED_KEYS,
  FILTER_OPTIONS,
  resolveConfigFieldDestination,
  getDynamicSections,
  getStatusTone,
  isMultilineKey,
  evaluateFieldMetadata,
  computeSystemStatus,
  computeDiagnosticsStats,
  buildRepairPayload
} from "../utils/meta-injector.matrix-domain.jsx";
import { buildAndCopyMatrixTelemetry } from "../utils/meta-injector.telemetry.jsx";
import { useMetaInjectorExecution } from "../utils/meta-injector.execution-hook.jsx";
import {
  InventorySelectionColumn,
  BenchDiagnosticHeader,
  DescriptionReviewSection
} from "../components/meta-injector.bench-chrome.jsx";
import { ManifestSectionCard } from "../components/meta-injector.manifest-section.jsx";

const INITIAL_EXPANDED_BAYS = {
  "Description Review": false,
  "1. Identity and Merchandising": false,
  "2. Stone Facts and Physical Details": false,
  "3. Origin, Story, and Collection": false,
  "4. Jewelry and Setting": false,
  "5. Search, Sales, and Media": false,
  "6. Standardized Attributes (Read-Only)": false
};

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

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  const [lastProcessedData, setLastProcessedData] = useState(null);
  
  const [approvals, setApprovals] = useState({});
  const [manualEdits, setManualEdits] = useState({}); 
  const [submittedPayloads, setSubmittedPayloads] = useState({}); 
  
  const [repairHistory, setRepairHistory] = useState({});

  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedBays, setExpandedBays] = useState(INITIAL_EXPANDED_BAYS);

  const batchFetcher = useFetcher();
  const referenceMatchFetcher = useFetcher();

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
        setExpandedBays(INITIAL_EXPANDED_BAYS);
      }
      return id;
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
    setQueueIds([]);
    setProductStates({});
    setManifestData({});
    setApprovals({});
    setManualEdits({});
    setSubmittedPayloads({});
    setRepairHistory({});
    setSelectedBenchId(null);
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
    setReleasedReferenceMatchRequest(null);
    setLoadIndex(0);
    setLastProcessedData(null);
    setPendingOperation(null);
    setSafetyMessage("Rack and Bench cleared. Repair history reset.");
    setSafetyError("");
  }, []);

  const getStandardizedEvaluationForField = useCallback((productId, targetKey, dataOverride = null) => {
    if (!isVerifiedStandardizedDestination(targetKey) || !productId) return null;
    const data = dataOverride || manifestData[productId];
    const candidateBundle = buildCanonicalCandidateBundle(standardizedCandidatesByProduct[productId] || {});
    const refMatchResult = referenceMatchResultsByProduct[productId] || null;
    const refMatchStatus = referenceMatchStatusByProduct[productId] || null;
    return evaluateStandardizedDestinationTechnicalStatus({
      destinationKey: targetKey,
      productId,
      data,
      candidateBundle,
      refMatchResult,
      refMatchStatus
    });
  }, [manifestData, standardizedCandidatesByProduct, referenceMatchResultsByProduct, referenceMatchStatusByProduct]);

  const handleToggleApproval = useCallback((pieceId, key, propVal, isChecked) => {
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    if (targetKey === "standardized_candidates" || targetKey === "custom.standardized_candidates") return;
    const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
    const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || resolveConfigFieldDestination(f) === key);

    if (isVerifiedStandardizedDestination(targetKey)) {
      const stdEval = getStandardizedEvaluationForField(pieceId, targetKey);
      const valCheck = validateProposedStandardizedGidList(propVal, stdEval);
      if (!valCheck.valid) return;
    } else if (matchedConfig?.mappingStatus === "pending_read_only") {
      return;
    }

    setApprovals(prev => {
      const next = { ...prev };
      if (!next[pieceId]) next[pieceId] = {};
      if (isChecked) {
        next[pieceId][targetKey] = propVal;
      } else {
        delete next[pieceId][targetKey];
      }
      return next;
    });
  }, [getStandardizedEvaluationForField]);

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
    setReleasedReferenceMatchRequest({
      ...released,
      releasedAt: new Date().toISOString(),
      fetcherWasBusy: referenceMatchFetcher.state !== "idle"
    });
    setPendingReferenceMatch(null);

    const releaseMsg =
      referenceMatchFetcher.state !== "idle"
        ? `Released local pending lock for ${released.pieceId} while fetcher is still [${referenceMatchFetcher.state}]. Any late response from that released request will be ignored. Note: Because the backend contract does not echo a request token, wait for the fetcher to return to idle before starting another request on the same product, or ask to add server token echo for strict overlapping request correlation.`
        : `Released stalled reference matching lock for ${released.pieceId}. Click 'Match Reference Choices' to retry.`;

    setReferenceMatchStatusByProduct((prev) => {
      const next = {
        ...prev,
        [released.pieceId]: {
          state: "failed",
          tone: "warning",
          message: releaseMsg,
          updatedAt: new Date().toISOString()
        }
      };
      if (selectedBenchId && selectedBenchId !== released.pieceId) {
        next[selectedBenchId] = {
          state: "ready",
          tone: "info",
          message: `Released lock that was held by ${released.pieceId}. You can now click 'Match Reference Choices' for ${selectedBenchId}.`,
          updatedAt: new Date().toISOString()
        };
      }
      return next;
    });
  }, [pendingReferenceMatch, referenceMatchFetcher.state, selectedBenchId]);

  const handleMatchReferenceChoices = useCallback(() => {
    if (!selectedBenchId) {
      setSafetyError("Cannot match reference choices: No product is selected on the bench. Select a product first.");
      return;
    }

    const rawProductCandidates = standardizedCandidatesByProduct[selectedBenchId] || {};
    const bundle = buildCanonicalCandidateBundle(rawProductCandidates);

    if (!bundle.hasSupported) {
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [selectedBenchId]: {
          state: "failed",
          tone: "warning",
          message: "Cannot match reference choices: No validated Vision standardized candidates exist for this product. Run 'Run AI (Single)' or 'EXECUTE AI AUTO-FILL (STAGE)' first so Vision stages candidate labels and evidence.",
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    if (pendingReferenceMatch !== null || referenceMatchFetcher.state !== "idle") {
      const lockedBy = pendingReferenceMatch?.pieceId || "an active fetcher request";
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [selectedBenchId]: {
          state: pendingReferenceMatch?.pieceId === selectedBenchId ? "awaiting_response" : "failed",
          tone: "warning",
          message: `Reference matching cannot start: Fetcher is currently [${referenceMatchFetcher.state}] and locked by [${lockedBy}]. Wait for completion, or click 'Release Stalled Match Lock' if the request is genuinely stuck.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    const requestRecord = {
      pieceId: selectedBenchId,
      snapshot: bundle.snapshot,
      baselineData: referenceMatchFetcher.data,
      sawNonIdle: false,
      startedAt: new Date().toISOString()
    };

    setReleasedReferenceMatchRequest(null);
    setPendingReferenceMatch(requestRecord);
    setReferenceMatchStatusByProduct((prev) => ({
      ...prev,
      [selectedBenchId]: {
        state: "submitting",
        tone: "info",
        message: `Submitting ${bundle.count} standardized candidate attribute(s) (${ Object.keys(bundle.ordered).join(", ") }) for read-only reference matching...`,
        updatedAt: new Date().toISOString()
      }
    }));

    try {
      const fd = new FormData();
      fd.append("intent", "resolveStandardizedCandidates");
      fd.append("pieceId", selectedBenchId);
      fd.append("standardized_candidates", bundle.snapshot);

      referenceMatchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    } catch (err) {
      const errMsg = err?.message || String(err || "Unknown submission error");
      setPendingReferenceMatch((curr) => (curr === requestRecord ? null : curr));
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [selectedBenchId]: {
          state: "failed",
          tone: "critical",
          message: `Failed to submit reference matching request: ${errMsg}. Check network/app connection and click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
    }
  }, [selectedBenchId, referenceMatchFetcher, pendingReferenceMatch, standardizedCandidatesByProduct]);

  useEffect(() => {
    // 1. If a released request finishes in the background, consume & ignore its late response so it cannot overwrite a later request.
    if (releasedReferenceMatchRequest) {
      if (referenceMatchFetcher.state !== "idle") {
        if (!releasedReferenceMatchRequest.sawNonIdle) {
          setReleasedReferenceMatchRequest((prev) => (prev ? { ...prev, sawNonIdle: true } : null));
        }
      } else {
        const dataChangedSinceReleaseStart = referenceMatchFetcher.data !== releasedReferenceMatchRequest.baselineData;
        if (releasedReferenceMatchRequest.sawNonIdle || dataChangedSinceReleaseStart) {
          const ignoredPieceId = releasedReferenceMatchRequest.pieceId;
          setReleasedReferenceMatchRequest(null);
          if (!pendingReferenceMatch) {
            setReferenceMatchStatusByProduct((prev) => ({
              ...prev,
              [ignoredPieceId]: {
                state: "discarded_stale",
                tone: "warning",
                message: `Late response from previously released request on ${ignoredPieceId} arrived and was safely ignored. Click 'Match Reference Choices' to run a fresh read-only match.`,
                updatedAt: new Date().toISOString()
              }
            }));
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
            message: `Awaiting read-only reference matching response from Shopify for ${pendingReferenceMatch.pieceId} (fetcher state: ${referenceMatchFetcher.state})...`,
            updatedAt: new Date().toISOString()
          }
        }));
      }
      return;
    }

    // 3. Fetcher is idle. Ensure we do NOT consume old retained fetcher.data before the new submission actually completes.
    const data = referenceMatchFetcher.data;
    const hasCompletedCycle = pendingReferenceMatch.sawNonIdle || data !== pendingReferenceMatch.baselineData;
    if (!hasCompletedCycle) {
      return;
    }

    const activePending = pendingReferenceMatch;

    // 4. Validate response structure before clearing or mutating state
    if (!data || typeof data !== "object") {
      setPendingReferenceMatch(null);
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [activePending.pieceId]: {
          state: "failed",
          tone: "critical",
          message: `Malformed response received for ${activePending.pieceId}: Backend returned an empty or non-object payload. Existing diagnostics were preserved. Click 'Match Reference Choices' to retry.`,
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
          message: `Malformed or unexpected response contract for ${activePending.pieceId} (${errDetail}). Expected intent 'resolveStandardizedCandidates' with readOnly: true. Click 'Match Reference Choices' to retry.`,
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
          message: `Product identity mismatch: Requested reference matching for [${activePending.pieceId}], but backend returned pieceId [${data.pieceId || "None"}]. Response discarded to preserve product isolation. Click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
      return;
    }

    // 5. Response is proven to belong to activePending's product & completed cycle. Clear pending lock.
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
          message: `Discarded stale reference matching response for ${targetProductId}: The product's Vision standardized candidates changed while the request was in flight. Click 'Match Reference Choices' to match the latest candidates.`,
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

    const matchRecord = {
      pieceId: targetProductId,
      intent: data.intent,
      readOnly: true,
      success: isSuccess,
      isComplete: isComplete,
      resolutions: sanitizedResolutions,
      currentReferenceLists: validObj(data.currentReferenceLists),
      errors: topErrors,
      snapshot: activePending.snapshot,
      matchedAt: new Date().toISOString()
    };

    setReferenceMatchResultsByProduct((prev) => ({
      ...prev,
      [targetProductId]: matchRecord
    }));

    // Stage technically verified proposals into manifestData.repairPlan for the 6 standardized destinations
    setManifestData((prevMan) => {
      const existingMan = prevMan[targetProductId];
      if (!existingMan) return prevMan;

      const updatedRepairPlan = { ...(existingMan.repairPlan || {}) };
      const updatedMetadata = { ...(existingMan.metadata || {}) };

      VERIFIED_STANDARDIZED_DESTINATIONS.forEach((destKey) => {
        if (manualEdits[targetProductId]?.[destKey] === true) return;

        const evalRes = evaluateStandardizedDestinationTechnicalStatus({
          destinationKey: destKey,
          productId: targetProductId,
          data: existingMan,
          candidateBundle: currentBundle,
          refMatchResult: matchRecord,
          refMatchStatus: { state: isComplete && isSuccess ? "completed" : "incomplete" }
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

      return {
        ...prevMan,
        [targetProductId]: {
          ...existingMan,
          repairPlan: updatedRepairPlan,
          metadata: updatedMetadata
        }
      };
    });

    // Clear any prior approvals on standardized destinations that no longer match
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

    if (isComplete && isSuccess && topErrors.length === 0) {
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "completed",
          tone: "success",
          message: `Reference matching completed for ${resolutionCount} attribute(s). Technically verified proposals are staged for review and exact-value approval below.`,
          updatedAt: new Date().toISOString()
        }
      }));
    } else {
      setReferenceMatchStatusByProduct((prev) => ({
        ...prev,
        [targetProductId]: {
          state: "incomplete",
          tone: "warning",
          message: `Reference matching returned partial/incomplete read diagnostics (success: ${String(isSuccess)}, isComplete: ${String(isComplete)}, ${resolutionCount} attribute resolution(s), ${topErrors.length} top-level error(s)). Incomplete enumeration remains blocked and is never treated as missing_entry or save-ready. Review read errors/continuation below or click 'Match Reference Choices' to retry.`,
          updatedAt: new Date().toISOString()
        }
      }));
    }
  }, [
    referenceMatchFetcher.state,
    referenceMatchFetcher.data,
    pendingReferenceMatch,
    releasedReferenceMatchRequest,
    standardizedCandidatesByProduct,
    manualEdits
  ]);

  const getFieldMetadata = (key, data, productId, currentApprovals, configFields = []) =>
    evaluateFieldMetadata({
      key,
      data,
      productId,
      currentApprovals,
      configFields,
      standardizedCandidatesByProduct,
      getStandardizedEvaluationForField
    });

  const {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  } = useMetaInjectorExecution({
    safeProducts,
    batchFetcher,
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
    setReferenceMatchResultsByProduct,
    setReferenceMatchStatusByProduct,
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
    if (!selectedBenchId) return;
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    if (targetKey === "standardized_candidates" || targetKey === "custom.standardized_candidates") return;
    const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
    const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || resolveConfigFieldDestination(f) === key);

    if (isVerifiedStandardizedDestination(targetKey)) {
      const stdEval = getStandardizedEvaluationForField(selectedBenchId, targetKey);
      const valCheck = validateProposedStandardizedGidList(value, stdEval);
      if (!valCheck.valid) return;
    } else if (matchedConfig?.mappingStatus === "pending_read_only") {
      return;
    }
    
    setManualEdits(prev => {
        const next = { ...prev };
        if (!next[selectedBenchId]) next[selectedBenchId] = {};
        next[selectedBenchId][targetKey] = true;
        return next;
    });
    
    setApprovals(prev => {
        if (prev[selectedBenchId] && prev[selectedBenchId][targetKey] !== undefined) {
            const next = { ...prev };
            delete next[selectedBenchId][targetKey];
            return next;
        }
        return prev;
    });

    setManifestData(prev => ({
       ...prev,
       [selectedBenchId]: {
          ...prev[selectedBenchId],
          repairPlan: {
             ...prev[selectedBenchId].repairPlan,
             [targetKey]: value
          }
       }
    }));
  };

  const handleStandardizedEntrySelectionChange = (destinationKey, currentPropVal, stdEval, replaceOrAddGid, previousSlotGid = null) => {
    if (!selectedBenchId || !stdEval?.isTechnicallyEligible) return;
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
    if (!selectedBenchId || !stdEval?.isTechnicallyEligible) return;
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
    if (activeFilter === "All") return true;
    if (activeFilter === "Blank" && (m.fieldStatus === "Optional blank" || m.fieldStatus === "Required missing")) return true;
    if (activeFilter === "Proposed changes" && (m.fieldStatus === "Proposed" || m.fieldStatus === "Approved, not saved" || m.fieldStatus === "Approved, blocked" || m.fieldStatus === "Pre-approved, not saved" || m.fieldStatus === "Pre-approved, blocked")) return true;
    if (activeFilter === "Conflicts" && (m.fieldStatus === "Conflict" || m.fieldStatus === "Degrade" || m.fieldStatus === "Save Conflict")) return true;
    if (activeFilter === "Needs review" && (m.fieldStatus === "Required missing" || m.fieldStatus === "Unverified proposal" || (m.contentNeedsReview && !m.isApproved && !m.isContentPreApproved) || m.fieldStatus === "API Error / Blocked")) return true;
    if (activeFilter === m.source) return true;
    return false;
  }, [activeFilter]);

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
      safetyError
    });

  const getDiagnosticsStats = (data) =>
    computeDiagnosticsStats({
      data,
      selectedBenchId,
      approvals,
      getFieldMetadata
    });

  const handleCollectTelemetry = useCallback((mode = 'full') => {
    buildAndCopyMatrixTelemetry({
      mode,
      selectedBenchId,
      manifestData,
      repairHistory,
      safeProducts,
      approvals,
      submittedPayloads,
      getSystemStatus,
      getFieldMetadata,
      setSafetyError,
      setSafetyMessage
    });
  }, [selectedBenchId, manifestData, repairHistory, safeProducts, approvals, batchFetcher.state, isLoadingData, safetyError, aiStep, executionMode, getSystemStatus, submittedPayloads]);

  const toggleBay = (title) => {
    setExpandedBays(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;
  const activeBenchData = selectedBenchId ? manifestData[selectedBenchId] : null;
  const dynamicSections = activeBenchData ? getDynamicSections(activeBenchData) : getDynamicSections();
  const allDynamicConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  const activeBenchStats = activeBenchData ? getDiagnosticsStats(activeBenchData) : null;
  const activeBenchStatusObj = activeBenchData ? getSystemStatus() : null;
  const activeBenchHistory = selectedBenchId ? repairHistory[selectedBenchId] : null;

  const nativeDescriptionMeta = activeBenchData
    ? getFieldMetadata("native_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : null;
  const customDescriptionMeta = activeBenchData
    ? getFieldMetadata("custom.generated_description", activeBenchData, selectedBenchId, approvals, allDynamicConfigFields)
    : null;

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
                  
                  <Button size="large" icon={ClipboardIcon} onClick={() => handleCollectTelemetry('full')}>
                    Global Telemetry Dump
                  </Button>
                </div>
              </BlockStack>
            </Card>

            {!selectedBenchId || !activeBenchData ? (
              <Box padding="800" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                <Text as="p" variant="headingLg" alignment="center" tone="subdued">Load inventory, hit GENERATE REPAIR PLAN, then drop a piece on the bench to view its diagnostic readout.</Text>
              </Box>
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
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                      >
                        Run AI (Single)
                      </Button>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={SaveIcon} 
                        onClick={handleExecuteSingleRepair}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                        tone="success"
                      >
                        Execute Single Repair
                      </Button>
                    </div>
                </div>

                <BenchDiagnosticHeader
                  data={activeBenchData}
                  stats={activeBenchStats}
                  statusObj={activeBenchStatusObj}
                  history={activeBenchHistory}
                  onCollectTelemetry={handleCollectTelemetry}
                />

                <Card padding="400">
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
                </Card>

                <DescriptionReviewSection
                  selectedBenchId={selectedBenchId}
                  data={activeBenchData}
                  meta={nativeDescriptionMeta}
                  customDescMeta={customDescriptionMeta}
                  expandedBays={expandedBays}
                  matchesFilter={matchesFilter}
                  isMultilineKey={isMultilineKey}
                  onToggleBay={toggleBay}
                  onRepairPlanChange={handleRepairPlanChange}
                  onToggleApproval={handleToggleApproval}
                />

                {dynamicSections.map(sec => (
                  <ManifestSectionCard
                    key={sec.title}
                    section={sec}
                    selectedBenchId={selectedBenchId}
                    data={activeBenchData}
                    approvals={approvals}
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
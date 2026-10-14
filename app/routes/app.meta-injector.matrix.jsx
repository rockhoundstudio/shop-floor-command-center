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
import {
  InventorySelectionColumn,
  BenchDiagnosticHeader,
  DescriptionReviewSection
} from "../components/meta-injector.bench-chrome.jsx";
import { ManifestSectionCard } from "../components/meta-injector.manifest-section.jsx";

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
  const [expandedBays, setExpandedBays] = useState({
    "Description Review": true,
    "1. Identity and Merchandising": true,
    "2. Stone Facts and Physical Details": true,
    "3. Origin, Story, and Collection": true,
    "4. Jewelry and Setting": true,
    "5. Search, Sales, and Media": true,
    "6. Standardized Attributes (Read-Only)": true
  });

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

  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot generate plan: No inventory selected. Please check items in the left column first.");
       return;
    }
    setApprovals({}); 
    setManualEdits({}); 
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

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

  const executeRepairs = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot execute: No items loaded on the bench.");
       return;
    }
    
    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
       setSafetyError("Cannot execute: You must click 'GENERATE REPAIR PLAN' first to load data.");
       return;
    }
    
    if (readyItems.length < queueIds.length) {
        if (!window.confirm(`WARNING: LIVE RUN.\n\nOnly ${readyItems.length} of ${queueIds.length} queued items have loaded manifests. The others will be skipped.\n\nProceed?`)) {
            return;
        }
    } else {
        if (!window.confirm("WARNING: LIVE RUN.\n\nThis will execute structural repairs (edits and deletions) on the live Shopify database for all queued items. Proceed?")) {
            return;
        }
    }
    
    setSafetyError("");
    setSafetyMessage("Structural Repair Engine engaged. Mutating live data...");
    setExecutionMode("REPAIR");
    setIsExecuting(true);
    setExecuteIndex(0);
  }, [queueIds, manifestData]);

  const executeAIFill = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot run AI: No items loaded on the bench.");
       return;
    }
    
    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
       setSafetyError("Cannot run AI: You must click 'GENERATE REPAIR PLAN' first to load data.");
       return;
    }
    
    setApprovals({}); 
    setSafetyError("");
    setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
    setExecutionMode("AI_BATCH_PIPELINE");
    setIsExecuting(true);
    setExecuteIndex(0);
    setAiStep(1);
  }, [queueIds, manifestData]);

  // Unified Dispatch Loop Driver
  useEffect(() => {
    const isProcessing = isLoadingData || isExecuting;
    if (!isProcessing) return;
    if (batchFetcher.state !== "idle" || pendingOperation !== null) return;

    if (isLoadingData && loadIndex >= queueIds.length) {
      setIsLoadingData(false);
      setSafetyMessage(`Data loaded and manifests built for ${queueIds.length} items.`);
      return;
    }

    if (isExecuting) {
      if (executionMode === "REPAIR" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
      if (executionMode === "AI_SINGLE_PIPELINE" && aiStep > 4) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Single AI Run Complete. Data staged for review.`);
        return;
      }
      if (executionMode === "AI_BATCH_PIPELINE" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
    }

    const currentId = isLoadingData ? queueIds[loadIndex] : (executionMode === "AI_SINGLE_PIPELINE" ? selectedBenchId : queueIds[executeIndex]);
    if (!currentId) return;

    const manifest = manifestData[currentId];
    const product = safeProducts.find(p => p.id === currentId);

    if (!isLoadingData && (!manifest || !product)) {
      updateProductState(currentId, STATUS.SKIPPED, ["No manifest or product data built."]);
      if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
      else setExecuteIndex(i => i + 1);
      return;
    }

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    if (isLoadingData) {
      setPendingOperation({ id: currentId, intent: "loadProductData", token });
      updateProductState(currentId, STATUS.SCANNING, ["Fetching live metafields by GID..."]);
      const fd = new FormData();
      fd.append("intent", "loadProductData");
      fd.append("pieceId", currentId);
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    }
    else if (executionMode === "REPAIR") {
      const pieceAi = aiData[currentId] || {};
      if (!pieceAi.repairRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, repairRequested: true } }));
        setPendingOperation({ id: currentId, intent: "executeRepairPlan", token });
        updateProductState(currentId, STATUS.SCANNING, ["Executing structural repairs..."]);
        
        const fd = new FormData();
        fd.append("intent", "executeRepairPlan");
        fd.append("pieceId", currentId);
        
        const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, currentId, approvals, getFieldMetadata);

        const snapshot = { ...safePlan };
        if (nativeChanges.title) snapshot.shopify_title = nativeChanges.title;
        (nativeChanges.imageAlts || []).forEach(alt => {
            snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
        });
        setSubmittedPayloads(prev => ({ ...prev, [currentId]: snapshot }));

        fd.append("repairPlan", JSON.stringify(safePlan));
        fd.append("nativeChanges", JSON.stringify(nativeChanges));
        fd.append("legacyKeysToRemove", JSON.stringify([]));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      }
    } 
    else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
      const pieceAi = aiData[currentId] || {};

      if (aiStep === 1 && !pieceAi.titleParseRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, titleParseRequested: true } }));
        setPendingOperation({ id: currentId, intent: "titleParse", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 1: Parsing Title & Origin (Gemini + Render DB)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const fd = new FormData();
        fd.append("intent", "titleParse");
        fd.append("pieceName", titleToParse);
        fd.append("pieceId", currentId);
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 2 && !pieceAi.fullRescanRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, fullRescanRequested: true } }));
        setPendingOperation({ id: currentId, intent: "tab3FullRescan", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 2: Vision API Deep Scan (Gemini)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const fd = new FormData();
        fd.append("intent", "tab3FullRescan");
        fd.append("pieceId", currentId);
        fd.append("productTitle", titleToParse);
        
        const mediaEdges = manifest.nativeTargets?.media?.edges || [];
        if (mediaEdges.length > 0) {
            const mediaInputs = mediaEdges.map(e => ({
                imageId: e.node.id,
                url: e.node.preview?.image?.url,
                currentAltText: e.node.alt || ""
            })).filter(m => m.imageId && m.url);
            fd.append("mediaInputs", JSON.stringify(mediaInputs));
        } else {
            const imageUrl = product.images?.edges?.[0]?.node?.url || product.featuredImage?.url || product.media?.edges?.[0]?.node?.image?.url || "";
            fd.append("imageUrl", imageUrl);
        }

        fd.append("stone_family", pieceAi.titleParse?.stone_family || "");
        const currentOriginStory = manifest.currentMetafields["custom.origin_story"] || manifest.canonicalFields["custom.origin_story"] || "";
        fd.append("origin_story", currentOriginStory || pieceAi.titleParse?.origin_story || "");
        fd.append("honest_flaws_and_character", manifest.currentMetafields["custom.honest_flaws_and_character"] || "");
        fd.append("weight_grams", manifest.currentMetafields["custom.weight_grams"] || "");
        fd.append("dimensions_mm", manifest.currentMetafields["custom.dimensions_mm"] || "");

        const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
        allConfigFields.forEach(f => {
            if (f.role === "standardized_attribute" && f.namespace === "shopify" && f.metaKey) {
                const stdKey = `shopify.${f.metaKey}`;
                const rawStdVal = manifest.currentMetafields?.[stdKey];
                const serializedStd = serializeStandardizedAssignmentForVision(rawStdVal);
                if (serializedStd !== "") {
                    fd.set(stdKey, serializedStd);
                }
            }
        });

        const hardwareKeys = [
            "bail_included", "secondary_medium", "jewelry_finding_type",
            "primary_use", "jewelry_type", "setting_ready",
            "chain_material", "chain_link_type", "character_marks",
            "primary_color", "color_pattern", "surface_finish",
            "treatment_status", "treated", "necklace_design"
        ];
        hardwareKeys.forEach(k => {
            const fullKey = `custom.${k}`;
            let val = "";
            if (manualEdits[currentId]?.[fullKey] === true &&
                manifest.repairPlan?.[fullKey] !== undefined) {
                val = manifest.repairPlan[fullKey];
            } else if (approvals[currentId]?.[fullKey] !== undefined) {
                val = approvals[currentId][fullKey];
            } else if (manifest.currentMetafields?.[fullKey] !== undefined) {
                val = manifest.currentMetafields[fullKey];
            }
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                fd.set(k, String(val));
            }
        });

        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 3 && !pieceAi.generateDescRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, generateDescRequested: true } }));
        setPendingOperation({ id: currentId, intent: "generateDescription", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 3: Generating Story Narrative (Gemini)..."]);
        
        const fd = new FormData();
        fd.append("intent", "generateDescription");
        fd.append("pieceId", currentId);
        const descriptionFacts = {};
        const mergeDescriptionFacts = (source) => {
            Object.entries(source || {}).forEach(([key, value]) => {
                if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
                if (key.includes(".") && !key.startsWith("custom.")) return;
                const factKey = key.startsWith("custom.") ? key.slice(7) : key;
                if (["intent", "success", "error", "errors", "logs", "debug_origin", "standardized_candidates"].includes(factKey)) return;
                if (value !== undefined && value !== null && typeof value !== "object" && String(value).trim() !== "") {
                    descriptionFacts[factKey] = value;
                }
            });
        };

        mergeDescriptionFacts(manifest.currentMetafields);
        mergeDescriptionFacts(pieceAi.titleParse);
        mergeDescriptionFacts(pieceAi.tab3Data);

        Object.entries(manualEdits[currentId] || {}).forEach(([key, edited]) => {
            if (edited === true && key.startsWith("custom.") && key !== "custom.standardized_candidates" &&
                manifest.repairPlan?.[key] !== undefined) {
                descriptionFacts[key.slice(7)] = manifest.repairPlan[key];
            }
        });

        Object.entries(approvals[currentId] || {}).forEach(([key, value]) => {
            if (key.startsWith("custom.") && key !== "custom.standardized_candidates" && manualEdits[currentId]?.[key] !== true) {
                descriptionFacts[key.slice(7)] = value;
            }
        });

        descriptionFacts.pieceId = currentId;
        fd.append("sharedFields", JSON.stringify({
            stone_family: descriptionFacts.stone_family || descriptionFacts.material || "",
            origin_location: descriptionFacts.origin_location || ""
        }));
        fd.append("pieceData", JSON.stringify(descriptionFacts));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
    }
  }, [isLoadingData, isExecuting, batchFetcher.state, pendingOperation, executionMode, loadIndex, executeIndex, aiStep, queueIds, selectedBenchId, manifestData, safeProducts, aiData, approvals]);

  // Unified Response Receiver
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data && batchFetcher.data !== lastProcessedData) {
      const data = batchFetcher.data;
      setLastProcessedData(data);

      const targetId = data.pieceId || data.productId;
      const intent = data.intent;
      const success = data.success;

      if (intent === "resolveStandardizedCandidates") {
        return;
      }

      if (pendingOperation) {
          const productIntents = ["loadProductData", "executeRepairPlan", "batchAuditItem", "saveMetafields", "titleParse", "tab3FullRescan", "generateDescription"];
          if (productIntents.includes(intent)) {
              if (!targetId || targetId !== pendingOperation.id) {
                  setSafetyError(`Identity Guard Failed. Response intent: [${intent}], returned ID: [${targetId || 'None'}], expected ID: [${pendingOperation.id}], pending stage: [${isLoadingData ? 'Manifest Load' : 'AI/Repair'}], processed state: [${success ? 'Success' : 'Failed'}]. Result discarded.`);
                  setIsExecuting(false);
                  setIsLoadingData(false);
                  setPendingOperation(null);
                  return;
              }
          }
          if (intent !== pendingOperation.intent) {
             if (!productIntents.includes(intent)) {
                 setPendingOperation(null);
             } else {
                 return; 
             }
          }
      }

      if (!intent) {
          if (pendingOperation) {
              setSafetyError(`Unrecognized Response. No intent provided by backend. Expected ID: [${pendingOperation.id}], pending stage: [${isLoadingData ? 'Manifest Load' : 'AI/Repair'}]. Result discarded.`);
              setIsExecuting(false);
              setIsLoadingData(false);
              setPendingOperation(null);
          }
          return;
      }

      const {
          message, error, errors, logs, status, finalStatus, titleParse, tab3Data, generated_description, fieldsUpdated, legacyKeysRemoved, verifiedGeoValues, readBackVerified, proposedChanges, variantTarget, imageAlts, altValidationErrors,
          standardized_candidates: topLevelStdCandidates,
          unsupportedKeys: rawUnsupportedKeys,
          attemptedDestinations: rawAttemptedDestinations,
          verifiedDestinations: rawVerifiedDestinations,
          unresolvedChanges: rawUnresolvedChanges,
          blockedFields: rawBlockedFields,
          conflicts: rawConflicts
      } = data;

      const unsupportedKeys = validArray(rawUnsupportedKeys);
      const attemptedDestinations = validArray(rawAttemptedDestinations);
      const verifiedDestinations = validArray(rawVerifiedDestinations);
      const unresolvedChanges = validObj(rawUnresolvedChanges);
      const blockedFields = validObj(rawBlockedFields);
      const conflicts = validObj(rawConflicts);
      
      if (intent === "loadProductData" && targetId) {
         if (!success) {
            updateProductState(targetId, STATUS.FAILED, [error || message || "Failed to load data"]);
            setApprovals(prev => { const n = {...prev}; delete n[targetId]; return n; });
            setManualEdits(prev => { const n = {...prev}; delete n[targetId]; return n; });
         } else {
            setManualEdits(prev => {
                const n = {...prev};
                if (n[targetId]) {
                    const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
                    Object.keys(n[targetId]).forEach(k => {
                        if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
                    });
                }
                return n;
            });
            setApprovals(prev => {
                const n = {...prev};
                if (n[targetId]) {
                    const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
                    Object.keys(n[targetId]).forEach(k => {
                        if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
                    });
                }
                return n;
            });

            setManifestData(prev => {
                const prevDiag = prev[targetId]?.diagnostics || {};
                const cleanedRepairPlan = { ...(data.repairPlan || {}) };
                delete cleanedRepairPlan.standardized_candidates;
                delete cleanedRepairPlan["custom.standardized_candidates"];
                return {
                    ...prev,
                    [targetId]: {
                        ...data,
                        repairPlan: cleanedRepairPlan,
                        diagnostics: {
                            shopifyRead: success ? "Success" : "Failed",
                            gemini: prevDiag.gemini === "Success" ? "Success" : "Not called",
                            vision: prevDiag.vision === "Success" ? "Success" : "Not called",
                            geoLibrary: prevDiag.geoLibrary === "Success" ? "Success" : "Not called",
                            readBack: "Not called",
                            stage: "loadProductData"
                        }
                    }
                };
            });
            updateProductState(targetId, STATUS.VALIDATED, ["Data Loaded. Manifest Built."]);
         }
      }

      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && targetId && (!pendingOperation || pendingOperation.intent === intent)) {
        
        if (intent === "executeRepairPlan") {
            const ts = new Date().toISOString();
            setRepairHistory(prev => ({
                ...prev,
                [targetId]: {
                    status,
                    success,
                    message,
                    fieldsUpdated,
                    legacyKeysRemoved,
                    unsupportedKeys,
                    attemptedDestinations,
                    verifiedDestinations,
                    unresolvedChanges,
                    blockedFields,
                    conflicts,
                    readBackVerified,
                    proposedChanges,
                    completedAt: ts,
                    variantTarget: variantTarget || null
                }
            }));
            
            if (data.currentMetafields) {
                 setManifestData(prev => {
                    const existing = prev[targetId];
                    if (!existing) return prev;
                    return {
                        ...prev,
                        [targetId]: {
                            ...existing,
                            currentMetafields: data.currentMetafields,
                            fieldsUpdated: data.fieldsUpdated !== undefined ? data.fieldsUpdated : existing.fieldsUpdated,
                            legacyKeysRemoved: data.legacyKeysRemoved !== undefined ? data.legacyKeysRemoved : existing.legacyKeysRemoved,
                            blockedFields: blockedFields,
                            conflicts: conflicts,
                            diagnostics: {
                                ...existing.diagnostics,
                                shopifyRead: "Success",
                                readBack: data.readBackVerified === true ? "Success" : (data.readBackVerified === false ? "Failed" : "Not called"),
                                stage: "executeRepairPlan"
                            }
                        }
                    };
                });
            }
        }

        if (!success) {
           console.error("Execute Error from Backend:", data);
           const errMsg = message || error || (errors ? errors[0]?.message : "Unknown Error");
           setSafetyError(`Engine halted on ${targetId}. Error: ${errMsg}`);
           updateProductState(targetId, STATUS.FAILED, errors ? errors.map(e => e.message) : (logs || [errMsg]));
        } else {
           if (intent === "batchAuditItem") {
               updateProductState(targetId, STATUS.SCANNING, ["AI Run complete. Fetching fresh data..."]);
               setSafetyMessage("Single AI Run complete. Reloading manifest to display new data...");
               setManifestData(prev => {
                   const existing = prev[targetId];
                   if (!existing) return prev;
                   return {
                       ...prev,
                       [targetId]: {
                           ...existing,
                           diagnostics: {
                               ...existing.diagnostics, gemini: "Success", vision: "Success", stage: "batchAuditItem"
                           }
                       }
                   };
               });
               
               let loadLockActive = true;
               if (!pendingOperation) {
                  setPendingOperation({ id: targetId, intent: "loadProductData", token: "audit-reload" });
               } else {
                  loadLockActive = false; 
               }

               setTimeout(() => {
                   if (loadLockActive) {
                       const fd = new FormData();
                       fd.append("intent", "loadProductData");
                       fd.append("pieceId", targetId);
                       batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
                   }
               }, 500);
           }

           const successLogs = logs || [message || "Operation applied successfully."];
           let statusToSet = STATUS.COMPLETE;
           if (status === "NO_CHANGES_REQUIRED" || message === "No changes required." || (fieldsUpdated === 0 && Object.keys(blockedFields).length === 0)) {
              statusToSet = STATUS.SKIPPED;
              successLogs.push("No changes required.");
           } else if (finalStatus === "Needs Review" || status === "REPAIR_FAILED" || readBackVerified === false) {
              statusToSet = STATUS.FAILED;
           }
           
           if (Object.keys(blockedFields).length > 0) successLogs.push(`Partial API block: ${Object.keys(blockedFields).length} fields rejected by Shopify.`);
           if (Object.keys(conflicts).length > 0) successLogs.push(`Read-back error: ${Object.keys(conflicts).length} fields failed to save properly.`);

           updateProductState(targetId, statusToSet, successLogs);
        }
      }

      if (["titleParse", "tab3FullRescan", "generateDescription"].includes(intent) && (!pendingOperation || pendingOperation.intent === intent)) {
          if (!success) {
              updateProductState(targetId, STATUS.FAILED, [error || `Gemini failed at ${intent}`]);
              setSafetyError(`Engine halted on piece ${targetId}. Error: ${error || "Unknown Gemini API Error"}`);
              setManifestData(prev => {
                  const existing = prev[targetId];
                  if (!existing) return prev;
                  const diagnostics = { ...existing.diagnostics, error: error || `Gemini failed at ${intent}` };
                  if (intent === "titleParse" || intent === "generateDescription") diagnostics.gemini = "Failed";
                  if (intent === "tab3FullRescan") { diagnostics.vision = "Failed"; diagnostics.gemini = "Failed"; }
                  return { ...prev, [targetId]: { ...existing, diagnostics } };
              });
          } else {
              if (intent === "titleParse") {
                  setAiData(prev => ({ ...prev, [targetId]: { ...prev[targetId], titleParse } }));
              } 
              else if (intent === "tab3FullRescan") {
                  const rawCandidatesSource =
                      (tab3Data && typeof tab3Data === "object" && tab3Data.standardized_candidates !== undefined)
                          ? tab3Data.standardized_candidates
                          : topLevelStdCandidates;
                  const newBundle = buildCanonicalCandidateBundle(rawCandidatesSource);
                  const validatedCandidates = newBundle.ordered;
                  const newSnapshot = newBundle.snapshot;

                  setStandardizedCandidatesByProduct(prev => {
                      const prevSnapshot = buildCanonicalCandidateSnapshot(prev[targetId]);
                      if (prevSnapshot !== newSnapshot) {
                          setReferenceMatchResultsByProduct(prevRes => {
                              if (!prevRes[targetId]) return prevRes;
                              const nextRes = { ...prevRes };
                              delete nextRes[targetId];
                              return nextRes;
                          });
                          setApprovals(prevApp => {
                              if (!prevApp[targetId]) return prevApp;
                              const nextProdApp = { ...prevApp[targetId] };
                              VERIFIED_STANDARDIZED_DESTINATIONS.forEach(dk => delete nextProdApp[dk]);
                              return { ...prevApp, [targetId]: nextProdApp };
                          });
                          setReferenceMatchStatusByProduct(prevStat => ({
                              ...prevStat,
                              [targetId]: {
                                  state: newBundle.hasSupported ? "ready" : "failed",
                                  tone: newBundle.hasSupported ? "info" : "warning",
                                  message: newBundle.hasSupported
                                      ? `Vision staged ${newBundle.count} standardized candidate attribute(s) (${Object.keys(validatedCandidates).join(", ")}). Previous matching results (if any) were invalidated. Click 'Match Reference Choices' to validate reference entries.`
                                      : "Vision scan completed, but no supported standardized attribute candidates were returned for the 6 allowed keys.",
                                  updatedAt: new Date().toISOString()
                              }
                          }));
                      } else if (!prev[targetId]) {
                          setReferenceMatchStatusByProduct(prevStat => ({
                              ...prevStat,
                              [targetId]: {
                                  state: newBundle.hasSupported ? "ready" : "failed",
                                  tone: newBundle.hasSupported ? "info" : "warning",
                                  message: newBundle.hasSupported
                                      ? `Vision staged ${newBundle.count} standardized candidate attribute(s). Click 'Match Reference Choices' to validate reference entries.`
                                      : "Vision scan completed, but no supported standardized attribute candidates were returned for the 6 allowed keys.",
                                  updatedAt: new Date().toISOString()
                              }
                          }));
                      }
                      return {
                          ...prev,
                          [targetId]: validatedCandidates
                      };
                  });

                  const cleanedTab3Data = validObj(tab3Data) ? { ...tab3Data } : {};
                  delete cleanedTab3Data.standardized_candidates;
                  delete cleanedTab3Data["custom.standardized_candidates"];

                  setAiData(prev => ({ 
                      ...prev, 
                      [targetId]: { 
                          ...prev[targetId], 
                          tab3Data: cleanedTab3Data, 
                          verifiedGeoValues,
                          imageAlts,
                          altValidationErrors 
                      } 
                  }));
              } 
              else if (intent === "generateDescription") {
                  setAiData(prevAi => {
                      const updatedPieceAi = { ...prevAi[targetId], generated_description };
                      setManifestData(prevMan => {
                          const existing = prevMan[targetId];
                          if (!existing) return prevMan;
                          const newPlan = { ...existing.repairPlan };
                          delete newPlan.standardized_candidates;
                          delete newPlan["custom.standardized_candidates"];
                          const diagnostics = { ...(existing.diagnostics || {}) };
                          
                          const titleData = updatedPieceAi.titleParse || {};
                          const visionData = updatedPieceAi.tab3Data || {};
                          const descData = updatedPieceAi.generated_description || "";
                          const verifiedGeo = updatedPieceAi.verifiedGeoValues || {};

                          if (updatedPieceAi.titleParseRequested) {
                              diagnostics.gemini = "Success";
                              diagnostics.geoLibrary = titleData?.geoSource === "library" ? "Success" : (titleData?.geoSource || "Not reported");
                              diagnostics.stage = "titleParse";
                          }
                          if (updatedPieceAi.fullRescanRequested) {
                              diagnostics.vision = "Success"; diagnostics.gemini = "Success"; diagnostics.stage = "tab3FullRescan";
                          }
                          if (updatedPieceAi.generateDescRequested) {
                              diagnostics.gemini = "Success"; diagnostics.stage = "generateDescription";
                          }

                          const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);

                          const safeApply = (keyName, aiValue) => {
                              const targetKey = NATIVE_ALIAS_MAP[keyName] || keyName;
                              if (targetKey === "standardized_candidates" || targetKey === "custom.standardized_candidates") return;
                              if (RETIRED_KEYS.includes(targetKey)) return; 
                              if (targetKey.startsWith("custom.std_") || targetKey.startsWith("std_")) return;
                              if (targetKey.startsWith("shopify.") && !isVerifiedStandardizedDestination(targetKey)) return;

                              const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || f.key === targetKey);
                              if (isVerifiedStandardizedDestination(targetKey)) {
                                  const stdEval = getStandardizedEvaluationForField(targetId, targetKey, existing);
                                  const valCheck = validateProposedStandardizedGidList(aiValue, stdEval);
                                  if (!valCheck.valid) return;
                                  if (manualEdits[targetId] && manualEdits[targetId][targetKey] === true) return;
                                  newPlan[targetKey] = JSON.stringify(valCheck.gids);
                                  return;
                              }

                              if (matchedConfig?.mappingStatus === "pending_read_only" || matchedConfig?.role === "standardized_attribute") return;
                              if (manualEdits[targetId] && manualEdits[targetId][targetKey] === true) return; 
                              newPlan[targetKey] = aiValue;
                          };

                          Object.keys(visionData).forEach(k => {
                              if (k !== "generated_description" && k !== "pieceId" && k !== "debug_origin" && k !== "intent" && k !== "success" && k !== "origin_story" && k !== "standardized_candidates" && k !== "custom.standardized_candidates") {
                                  if (k.startsWith("std_") || k.startsWith("custom.std_") || k.startsWith("shopify.")) return;
                                  safeApply(NATIVE_FIELDS.includes(k) || k.includes('.') || k.startsWith('native_') ? k : `custom.${k}`, visionData[k]);
                              }
                          });
                          
                          Object.keys(titleData).forEach(k => {
                              if (k !== "pieceId" && k !== "intent" && k !== "success" && k !== "geoSource" && k !== "origin_story" && k !== "standardized_candidates" && k !== "custom.standardized_candidates") {
                                  if (k.startsWith("std_") || k.startsWith("custom.std_") || k.startsWith("shopify.")) return;
                                  const targetKey = NATIVE_FIELDS.includes(k) || k.includes('.') || k.startsWith('native_') ? k : `custom.${k}`;
                                  const bareKey = targetKey.startsWith("custom.") ? targetKey.slice(7) : k;
                                  const visionHasValue = [k, targetKey, bareKey].some(candidate =>
                                      Object.prototype.hasOwnProperty.call(visionData, candidate) &&
                                      visionData[candidate] !== undefined &&
                                      visionData[candidate] !== null &&
                                      String(visionData[candidate]).trim() !== ""
                                  );
                                  if (!visionHasValue) safeApply(targetKey, titleData[k]);
                              }
                          });

                          const enrichedSeo = visionData.seo_title || visionData["custom.seo_title"] || titleData.seo_title || "";
                          if (enrichedSeo.trim() !== "") safeApply("custom.seo_title", enrichedSeo.trim());
                          if (descData) safeApply("custom.generated_description", descData);

                          const stoneGrams = parseFloat(existing.currentMetafields?.["custom.weight_grams"]) || 0;
                          if (stoneGrams > 0) {
                              safeApply("custom.shipping_weight_oz", String(Math.ceil((stoneGrams / 28.3495) + 0.5)));
                          }
                          
                          if (visionData.poetic_hook) {
                              safeApply("native_seo_description", visionData.poetic_hook);
                          }

                          if (updatedPieceAi.imageAlts) {
                              updatedPieceAi.imageAlts.forEach(altObj => {
                                  if (altObj.imageId && altObj.altText) safeApply(`native_image_alts_${altObj.imageId}`, altObj.altText);
                              });
                          }
                          if (updatedPieceAi.altValidationErrors) diagnostics.altValidationErrors = updatedPieceAi.altValidationErrors;

                          return { ...prevMan, [targetId]: { ...existing, repairPlan: newPlan, diagnostics, verifiedGeoValues: verifiedGeo } };
                      });
                      return { ...prevAi, [targetId]: updatedPieceAi };
                  });
                  updateProductState(targetId, STATUS.VALIDATED, ["AI Pipeline Complete. Data staged."]);
              }
          }
      }

      if (pendingOperation) {
          const op = pendingOperation;
          setPendingOperation(null);
          
          if (!success) {
              setIsExecuting(false);
              setIsLoadingData(false);
              return;
          }

          if (isLoadingData) {
              setLoadIndex(i => i + 1);
          } else if (isExecuting) {
              if (executionMode === "REPAIR") {
                  setExecuteIndex(i => i + 1);
              } else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
                  if (op.intent === "titleParse") {
                      setAiStep(2);
                  } else if (op.intent === "tab3FullRescan") {
                      setAiStep(3);
                  } else if (op.intent === "generateDescription") {
                      if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
                      else { setAiStep(1); setExecuteIndex(i => i + 1); }
                  }
              }
          }
      }
    }
  }, [batchFetcher.state, batchFetcher.data, lastProcessedData, pendingOperation, executionMode, isLoadingData, isExecuting, manualEdits, updateProductState, getStandardizedEvaluationForField]);

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

  const handleExecuteSingleRepair = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
       setSafetyError("Generate Repair Plan for this item first.");
       return;
    }
    
    const product = safeProducts.find(p => p.id === selectedBenchId);
    if (!product) {
       setSafetyError("Product data not found in inventory.");
       return;
    }

    const fd = new FormData();
    fd.append("intent", "executeRepairPlan");
    fd.append("pieceId", selectedBenchId);
    
    const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, selectedBenchId, approvals, getFieldMetadata);

    const snapshot = { ...safePlan };
    if (nativeChanges.title) snapshot.shopify_title = nativeChanges.title;
    (nativeChanges.imageAlts || []).forEach(alt => {
        snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
    });
    setSubmittedPayloads(prev => ({ ...prev, [selectedBenchId]: snapshot }));

    fd.append("repairPlan", JSON.stringify(safePlan));
    fd.append("nativeChanges", JSON.stringify(nativeChanges));
    fd.append("legacyKeysToRemove", JSON.stringify([]));

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setPendingOperation({ id: selectedBenchId, intent: "executeRepairPlan", token });
    updateProductState(selectedBenchId, STATUS.SCANNING, ["Executing single structural repair..."]);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedBenchId, manifestData, approvals, batchFetcher, updateProductState, safeProducts, standardizedCandidatesByProduct, getStandardizedEvaluationForField]);

  const handleExecuteSingleAI = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
       setSafetyError("Cannot run AI: Generate Repair Plan for this item first to load live data.");
       return;
    }

    setApprovals(prev => {
        const next = { ...prev };
        delete next[selectedBenchId];
        return next;
    });
    
    setSafetyError("");
    setSafetyMessage(`Single-Pass AI Pipeline engaged for ${selectedBenchId}...`);
    setExecutionMode("AI_SINGLE_PIPELINE");
    setIsExecuting(true);
    setAiStep(1);
    setAiData({});
  }, [selectedBenchId, manifestData]);

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
          onSelectBenchItem={setSelectedBenchId}
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
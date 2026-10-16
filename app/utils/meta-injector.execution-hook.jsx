import { useCallback, useEffect } from "react";
import { PRODUCT_TEMPLATE_GROUPS } from "./meta-injector.constants.jsx";
import {
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  buildCanonicalCandidateSnapshot,
  serializeStandardizedAssignmentForVision,
  validArray,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  STATUS,
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  RETIRED_KEYS,
  resolveConfigFieldDestination,
  buildRepairPayload
} from "./meta-injector.matrix-domain.jsx";

const SENSITIVE_DIAG_KEY_REGEX = /token|secret|password|authorization|cookie|header|credential|api[_-]?key|session/i;

const sanitizeDiagString = (val) => {
  if (typeof val !== "string") return "";
  const trimmed = val.trim();
  if (!trimmed || trimmed === "[object Object]") return "";
  return trimmed
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/gi, "shpat_[REDACTED]")
    .replace(/shpca_[A-Za-z0-9_]+/gi, "shpca_[REDACTED]")
    .replace(/shpss_[A-Za-z0-9_]+/gi, "shpss_[REDACTED]");
};

const normalizeFieldOrPath = (rawField) => {
  if (rawField === undefined || rawField === null) return "";
  if (Array.isArray(rawField)) {
    return rawField
      .map((part) => (typeof part === "string" || typeof part === "number" ? sanitizeDiagString(String(part)) : ""))
      .filter(Boolean)
      .join(".");
  }
  if (typeof rawField === "string" || typeof rawField === "number") {
    return sanitizeDiagString(String(rawField));
  }
  return "";
};

const normalizeReturnedErrorEntry = (rawItem) => {
  if (rawItem === undefined || rawItem === null) return null;

  if (typeof rawItem === "string" || typeof rawItem === "number" || typeof rawItem === "boolean") {
    const cleanMsg = sanitizeDiagString(String(rawItem));
    if (!cleanMsg) return null;
    return {
      message: cleanMsg,
      field: null,
      code: null,
      destination: null,
      formatted: cleanMsg
    };
  }

  if (typeof rawItem === "object") {
    const rawMsg =
      typeof rawItem.message === "string"
        ? rawItem.message
        : typeof rawItem.error === "string"
          ? rawItem.error
          : typeof rawItem.reason === "string"
            ? rawItem.reason
            : "";
    const message = sanitizeDiagString(rawMsg);
    const field = normalizeFieldOrPath(rawItem.field ?? rawItem.path ?? null) || null;
    const code =
      typeof rawItem.code === "string" || typeof rawItem.code === "number"
        ? sanitizeDiagString(String(rawItem.code)) || null
        : null;
    const destination =
      typeof rawItem.destination === "string"
        ? sanitizeDiagString(rawItem.destination) || null
        : typeof rawItem.key === "string"
          ? sanitizeDiagString(rawItem.key) || null
          : null;

    let fallbackSummary = "";
    if (!message) {
      const safePairs = [];
      Object.entries(rawItem).forEach(([k, v]) => {
        if (SENSITIVE_DIAG_KEY_REGEX.test(k)) return;
        if (v === undefined || v === null) return;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          const sv = sanitizeDiagString(String(v));
          if (sv) safePairs.push(`${k}=${sv}`);
        } else if (Array.isArray(v)) {
          const joined = normalizeFieldOrPath(v);
          if (joined) safePairs.push(`${k}=${joined}`);
        }
      });
      fallbackSummary = safePairs.join(", ");
    }

    const effectiveMessage = message || fallbackSummary;
    if (!effectiveMessage && !field && !code && !destination) return null;

    const metaParts = [];
    if (destination) metaParts.push(`dest: ${destination}`);
    if (field && field !== destination) metaParts.push(`field: ${field}`);
    if (code) metaParts.push(`code: ${code}`);

    const prefix = metaParts.length > 0 ? `[${metaParts.join(" | ")}] ` : "";
    const formatted = `${prefix}${effectiveMessage || "Unspecified backend error"}`.trim();

    return {
      message: effectiveMessage || "Unspecified backend error",
      field,
      code,
      destination,
      formatted
    };
  }

  return null;
};

const extractNormalizedErrors = (rawErrors, singleError) => {
  const list = [];
  const seen = new Set();

  const pushCandidate = (item) => {
    const norm = normalizeReturnedErrorEntry(item);
    if (!norm || !norm.formatted) return;
    if (seen.has(norm.formatted)) return;
    seen.add(norm.formatted);
    list.push(norm);
  };

  if (Array.isArray(rawErrors)) {
    rawErrors.forEach(pushCandidate);
  } else if (rawErrors !== undefined && rawErrors !== null) {
    pushCandidate(rawErrors);
  }

  if (singleError !== undefined && singleError !== null) {
    pushCandidate(singleError);
  }

  return list;
};

const mergeReadBackNativeTargets = (existingNativeTargets, rbNativeTargets) => {
  const prev = validObj(existingNativeTargets);
  if (!rbNativeTargets || typeof rbNativeTargets !== "object" || Array.isArray(rbNativeTargets)) {
    return prev;
  }

  const unverifiedFields = validArray(rbNativeTargets.unverifiedFields);
  const next = {
    ...prev,
    productId: rbNativeTargets.productId || prev.productId,
    isComplete: rbNativeTargets.isComplete === true,
    loadError: rbNativeTargets.loadError ?? null,
    unverifiedFields
  };

  if (unverifiedFields.includes("productTitle") || typeof rbNativeTargets.productTitle !== "string") {
    next.productTitle = undefined;
  } else {
    next.productTitle = rbNativeTargets.productTitle;
  }

  if (unverifiedFields.includes("descriptionHtml") || typeof rbNativeTargets.descriptionHtml !== "string") {
    next.descriptionHtml = undefined;
  } else {
    next.descriptionHtml = rbNativeTargets.descriptionHtml;
  }

  if (unverifiedFields.includes("seo") || !rbNativeTargets.seo || typeof rbNativeTargets.seo !== "object") {
    next.seo = undefined;
  } else {
    next.seo = {
      title: typeof rbNativeTargets.seo.title === "string" ? rbNativeTargets.seo.title : undefined,
      description: typeof rbNativeTargets.seo.description === "string" ? rbNativeTargets.seo.description : undefined
    };
  }

  if (unverifiedFields.includes("media") || !Array.isArray(rbNativeTargets.media?.edges)) {
    if (prev.media && typeof prev.media === "object" && Array.isArray(prev.media.edges)) {
      next.media = {
        ...prev.media,
        edges: prev.media.edges.map((e) =>
          e && e.node
            ? {
                ...e,
                node: {
                  ...e.node,
                  alt: undefined
                }
              }
            : e
        )
      };
    } else {
      next.media = undefined;
    }
  } else {
    const prevEdges = Array.isArray(prev.media?.edges) ? prev.media.edges : [];
    const prevById = new Map();
    prevEdges.forEach((edge) => {
      if (edge?.node?.id) {
        prevById.set(edge.node.id, edge.node);
      }
    });

    const mergedEdges = rbNativeTargets.media.edges
      .filter((edge) => edge && edge.node && edge.node.id)
      .map((edge) => {
        const rbNode = edge.node;
        const priorNode = prevById.get(rbNode.id);
        return {
          node: {
            ...(priorNode ? { preview: priorNode.preview } : {}),
            id: rbNode.id,
            alt: typeof rbNode.alt === "string" ? rbNode.alt : undefined
          }
        };
      });

    next.media = {
      ...(prev.media && typeof prev.media === "object" ? prev.media : {}),
      edges: mergedEdges
    };
  }

  return next;
};

const prepareAndSubmitRepairPlan = ({
  targetId,
  manifest,
  product,
  approvals,
  getFieldMetadata,
  token,
  scanLogMessage,
  setPendingOperation,
  updateProductState,
  setSubmittedPayloads,
  batchFetcher
}) => {
  setPendingOperation({ id: targetId, intent: "executeRepairPlan", token });
  updateProductState(targetId, STATUS.SCANNING, [scanLogMessage]);

  const fd = new FormData();
  fd.append("intent", "executeRepairPlan");
  fd.append("pieceId", targetId);

  const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, targetId, approvals, getFieldMetadata);

  const snapshot = { ...safePlan };
  if (nativeChanges.title !== undefined) snapshot.shopify_title = nativeChanges.title;
  (nativeChanges.imageAlts || []).forEach(alt => {
    snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
  });
  setSubmittedPayloads(prev => ({ ...prev, [targetId]: snapshot }));

  fd.append("repairPlan", JSON.stringify(safePlan));
  fd.append("nativeChanges", JSON.stringify(nativeChanges));
  fd.append("legacyKeysToRemove", JSON.stringify([]));
  batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
};

export function useMetaInjectorExecution({
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
}) {
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
        prepareAndSubmitRepairPlan({
          targetId: currentId,
          manifest,
          product,
          approvals,
          getFieldMetadata,
          token,
          scanLogMessage: "Executing structural repairs...",
          setPendingOperation,
          updateProductState,
          setSubmittedPayloads,
          batchFetcher
        });
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
        nativeTargets: returnedNativeTargets,
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

      const normalizedErrorObjects = extractNormalizedErrors(errors, error);
      const formattedErrorStrings = normalizedErrorObjects.map(e => e.formatted);
      const specificErrorSummary = formattedErrorStrings.join(" | ");
      const safeGenericMessage = sanitizeDiagString(typeof message === "string" ? message : "");

      if (intent === "loadProductData" && targetId) {
        if (!success) {
          const loadErrText = specificErrorSummary || safeGenericMessage || "Failed to load data";
          updateProductState(targetId, STATUS.FAILED, formattedErrorStrings.length > 0 ? formattedErrorStrings : [loadErrText]);
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
                  stage: "loadProductData",
                  error: prevDiag.error || null,
                  errors: validArray(prevDiag.errors)
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
          const isFailedOrPartial = !success || status === "REPAIR_FAILED" || status === "REPAIR_BLOCKED" || status === "PARTIAL_SUCCESS" || finalStatus === "PARTIAL_SUCCESS" || readBackVerified === false;

          setRepairHistory(prev => {
            const priorHistory = prev[targetId] || {};
            const preservedErrors = normalizedErrorObjects.length > 0
              ? normalizedErrorObjects
              : (isFailedOrPartial ? validArray(priorHistory.errors) : []);
            const preservedErrorStrings = formattedErrorStrings.length > 0
              ? formattedErrorStrings
              : (isFailedOrPartial ? validArray(priorHistory.errorMessages) : []);
            const effectiveMessage = specificErrorSummary
              ? (safeGenericMessage && safeGenericMessage !== specificErrorSummary
                  ? `${specificErrorSummary} (${safeGenericMessage})`
                  : specificErrorSummary)
              : (safeGenericMessage || priorHistory.message || null);

            return {
              ...prev,
              [targetId]: {
                status,
                success,
                message: effectiveMessage,
                rawMessage: safeGenericMessage || null,
                errors: preservedErrors,
                errorMessages: preservedErrorStrings,
                fieldsUpdated: !success ? (fieldsUpdated !== undefined ? fieldsUpdated : null) : fieldsUpdated,
                legacyKeysRemoved: !success ? (legacyKeysRemoved !== undefined ? legacyKeysRemoved : null) : legacyKeysRemoved,
                unsupportedKeys,
                attemptedDestinations,
                verifiedDestinations,
                unresolvedChanges,
                blockedFields,
                conflicts,
                readBackVerified: !success ? false : readBackVerified,
                proposedChanges,
                completedAt: ts,
                variantTarget: variantTarget || null
              }
            };
          });

          if (data.currentMetafields || returnedNativeTargets || !success || isFailedOrPartial || normalizedErrorObjects.length > 0) {
            setManifestData(prev => {
              const existing = prev[targetId];
              if (!existing) return prev;

              const existingDiag = existing.diagnostics || {};
              const updatedNativeTargets = returnedNativeTargets
                ? mergeReadBackNativeTargets(existing.nativeTargets, returnedNativeTargets)
                : existing.nativeTargets;

              const updatedCanonicalFields = { ...(existing.canonicalFields || {}) };
              if (returnedNativeTargets) {
                const unverifiedNative = validArray(returnedNativeTargets.unverifiedFields);
                if (unverifiedNative.includes("productTitle") || typeof returnedNativeTargets.productTitle !== "string") {
                  delete updatedCanonicalFields.shopify_title;
                } else {
                  updatedCanonicalFields.shopify_title = returnedNativeTargets.productTitle;
                }
              }

              const preservedDiagErrors = normalizedErrorObjects.length > 0
                ? normalizedErrorObjects
                : (isFailedOrPartial ? validArray(existingDiag.errors) : []);
              const preservedDiagErrorText = specificErrorSummary
                || (isFailedOrPartial ? (safeGenericMessage || existingDiag.error || null) : null);

              const readBackDiagStatus = !success
                ? (returnedNativeTargets ? "Failed" : "Not called")
                : (data.readBackVerified === true ? "Success" : (data.readBackVerified === false ? "Failed" : "Not called"));

              return {
                ...prev,
                [targetId]: {
                  ...existing,
                  currentMetafields: (success && data.currentMetafields) ? data.currentMetafields : existing.currentMetafields,
                  nativeTargets: updatedNativeTargets,
                  canonicalFields: updatedCanonicalFields,
                  productTitle:
                    returnedNativeTargets && typeof returnedNativeTargets.productTitle === "string"
                      ? returnedNativeTargets.productTitle
                      : existing.productTitle,
                  descriptionHtml:
                    returnedNativeTargets && typeof returnedNativeTargets.descriptionHtml === "string"
                      ? returnedNativeTargets.descriptionHtml
                      : existing.descriptionHtml,
                  seo:
                    returnedNativeTargets && returnedNativeTargets.seo && typeof returnedNativeTargets.seo === "object"
                      ? returnedNativeTargets.seo
                      : existing.seo,
                  fieldsUpdated: success && data.fieldsUpdated !== undefined ? data.fieldsUpdated : existing.fieldsUpdated,
                  legacyKeysRemoved: success && data.legacyKeysRemoved !== undefined ? data.legacyKeysRemoved : existing.legacyKeysRemoved,
                  blockedFields: blockedFields,
                  conflicts: conflicts,
                  diagnostics: {
                    ...existingDiag,
                    shopifyRead: existingDiag.shopifyRead || "Success",
                    readBack: readBackDiagStatus,
                    stage: "executeRepairPlan",
                    error: preservedDiagErrorText,
                    errors: preservedDiagErrors
                  }
                }
              };
            });
          }
        }

        if (!success) {
          console.error("Execute Error from Backend:", data);
          const primaryErrorDisplay = specificErrorSummary
            ? (safeGenericMessage && safeGenericMessage !== specificErrorSummary
                ? `${specificErrorSummary} (${safeGenericMessage})`
                : specificErrorSummary)
            : (safeGenericMessage || "Unknown Error");
          setSafetyError(`Engine halted on ${targetId}. Error: ${primaryErrorDisplay}`);
          const failureLogs = formattedErrorStrings.length > 0
            ? formattedErrorStrings
            : (Array.isArray(logs) && logs.length > 0 ? logs.map(l => sanitizeDiagString(String(l))).filter(Boolean) : [primaryErrorDisplay]);
          updateProductState(targetId, STATUS.FAILED, failureLogs);
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

          const successLogs = Array.isArray(logs) && logs.length > 0
            ? [...logs]
            : [safeGenericMessage || "Operation applied successfully."];
          if (formattedErrorStrings.length > 0) {
            formattedErrorStrings.forEach(errLine => {
              if (!successLogs.includes(errLine)) successLogs.push(errLine);
            });
          }

          let statusToSet = STATUS.COMPLETE;
          if (status === "NO_CHANGES_REQUIRED" || safeGenericMessage === "No changes required." || (fieldsUpdated === 0 && Object.keys(blockedFields).length === 0 && formattedErrorStrings.length === 0 && Object.keys(unresolvedChanges).length === 0)) {
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
          const aiErrDisplay = specificErrorSummary || safeGenericMessage || `Gemini failed at ${intent}`;
          updateProductState(targetId, STATUS.FAILED, formattedErrorStrings.length > 0 ? formattedErrorStrings : [aiErrDisplay]);
          setSafetyError(`Engine halted on piece ${targetId}. Error: ${aiErrDisplay}`);
          setManifestData(prev => {
            const existing = prev[targetId];
            if (!existing) return prev;
            const existingDiag = existing.diagnostics || {};
            const diagnostics = {
              ...existingDiag,
              error: aiErrDisplay,
              errors: normalizedErrorObjects.length > 0 ? normalizedErrorObjects : validArray(existingDiag.errors)
            };
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

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    prepareAndSubmitRepairPlan({
      targetId: selectedBenchId,
      manifest,
      product,
      approvals,
      getFieldMetadata,
      token,
      scanLogMessage: "Executing single structural repair...",
      setPendingOperation,
      updateProductState,
      setSubmittedPayloads,
      batchFetcher
    });
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

  return {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  };
}
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

  return {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  };
}
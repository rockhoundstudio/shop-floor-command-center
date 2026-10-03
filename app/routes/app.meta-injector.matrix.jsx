// ==========================================================================
// ROCKHOUND STUDIO — TAB 3: OPERATIONS MATRIX
// File: app/routes/app.meta-injector.matrix.jsx
// ==========================================================================
import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar, Select } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";

const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  COMPLETE: "Repaired",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

const SECTIONS = [
  {
    title: "1. Identity and Merchandising",
    keys: [
      "shopify_title",
      "custom.piece_name",
      "custom.is_ooak",
      "custom.product_format",
      "custom.craftsmanship",
      "custom.poetic_hook",
      "custom.seo_title"
    ]
  },
  {
    title: "2. Stone Facts and Physical Details",
    keys: [
      "custom.weight_grams",
      "custom.shipping_weight_oz",
      "custom.dimensions_mm",
      "custom.cut_and_shape",
      "custom.surface_finish",
      "custom.primary_color",
      "custom.color_pattern",
      "custom.honest_flaws_and_character",
      "custom.bench_notes",
      "custom.mohs_hardness",
      "custom.specific_gravity",
      "custom.crystal_system",
      "custom.fracture_pattern",
      "custom.cleavage",
      "custom.luster",
      "custom.diaphaneity",
      "custom.mineral_class",
      "custom.geological_era",
      "custom.rock_formation"
    ]
  },
  {
    title: "3. Origin, Story, and Collection",
    keys: [
      "custom.stone_family",
      "custom.origin_location",
      "custom.origin_handle",
      "custom.collection_name",
      "custom.collection_location",
      "custom.origin_story" // Hidden context field, maintained for 45-pin count
    ]
  },
  {
    title: "4. Jewelry and Setting",
    keys: [
      "custom.primary_use",
      "custom.jewelry_type",
      "custom.primary_medium",
      "custom.secondary_medium",
      "custom.setting_ready",
      "custom.bail_included",
      "custom.chain_material",
      "custom.jewelry_finding_type"
    ]
  },
  {
    title: "5. Search, Sales, and Media",
    keys: [
      "price",
      "custom.alt_text",
      "custom.google_product_category",
      "custom.authenticity",
      "custom.rarity"
    ]
  }
];

const BLOCKED_UNVERIFIED_PINS = [
  "custom.jewelry_type"
];

const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.bench_notes": 100000,
  "custom.alt_text": 100000,
  "custom.honest_flaws_and_character": 255,
  "custom.poetic_hook": 160
};

const PROTECTED_FIELDS = [
  "custom.stone_family", "custom.cut_and_shape", "custom.surface_finish",
  "custom.color_pattern", "custom.google_product_category", "custom.setting_ready",
  "custom.bail_included", "custom.chain_material", "custom.jewelry_finding_type",
  "shopify_title", "custom.bench_notes"
];

const HARDWARE_FIELDS = [
  "custom.setting_ready", "custom.bail_included", "custom.chain_material",
  "custom.jewelry_finding_type"
];

const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];
const REQUIRED_FIELDS = ["shopify_title", "price"];
const INTEGRATION_PREFIXES = ["google.", "shopify.", "mm-google", "mc-facebook"];
const NATIVE_FIELDS = ["price", "shopify_title"];

// Used strictly for global telemetry tracking to preserve 45-count. Do not render.
const HIDDEN_CONTEXT_FIELDS = ["custom.origin_story"]; 

const formatLabel = (key) => {
  const parts = key.split('.');
  const name = parts[parts.length - 1];
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
  const [tempAiData, setTempAiData] = useState({});

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  const [lastProcessedData, setLastProcessedData] = useState(null);
  const [approvals, setApprovals] = useState({}); // Stores exact text approvals by pieceId and key
  
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  // UI States for Accessibility & Review
  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedBays, setExpandedBays] = useState({
    "1. Identity and Merchandising": true,
    "2. Stone Facts and Physical Details": true,
    "3. Origin, Story, and Collection": true,
    "4. Jewelry and Setting": true,
    "5. Search, Sales, and Media": true
  });

  const batchFetcher = useFetcher();

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
    setSelectedBenchId(null);
    setIsLoadingData(false);
    setIsExecuting(false);
    setExecutionMode(null);
    setExecuteIndex(0);
    setAiStep(0);
    setTempAiData({});
    setLoadIndex(0);
    setLastProcessedData(null);
    setSafetyMessage("Rack and Bench cleared.");
    setSafetyError("");
  }, []);

  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot generate plan: No inventory selected. Please check items in the left column first.");
       return;
    }
    setApprovals({}); // Clear approvals on new overall run
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

  const handleToggleApproval = useCallback((pieceId, key, propVal, isChecked) => {
    setApprovals(prev => {
      const next = { ...prev };
      if (!next[pieceId]) next[pieceId] = {};
      if (isChecked) {
        next[pieceId][key] = propVal;
      } else {
        delete next[pieceId][key];
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isLoadingData) return;
    if (batchFetcher.state !== "idle") return;

    if (loadIndex >= queueIds.length) {
      setIsLoadingData(false);
      setSafetyMessage(`Data loaded and manifests built for ${queueIds.length} items.`);
      return;
    }

    const currentId = queueIds[loadIndex];
    updateProductState(currentId, STATUS.SCANNING, ["Fetching live metafields by GID..."]);

    const fd = new FormData();
    fd.append("intent", "loadProductData");
    fd.append("pieceId", currentId);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [isLoadingData, loadIndex, queueIds, batchFetcher.state, updateProductState]);

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
    setTempAiData({});
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
    
    if (readyItems.length < queueIds.length) {
        if (!window.confirm(`WARNING: AI MULTI-STAGE PIPELINE.\n\nOnly ${readyItems.length} of ${queueIds.length} queued items have loaded manifests. The others will be skipped.\n\nProceed?`)) {
            return;
        }
    } else {
        if (!window.confirm("WARNING: AI MULTI-STAGE PIPELINE.\n\nThis will trigger title parsing, vision scanning, and description generation sequentially for all queued items. The results will be staged locally on the bench for review. Proceed?")) {
            return;
        }
    }
    
    setApprovals({}); // Switching to new AI run globally clears approvals
    setSafetyError("");
    setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
    setExecutionMode("AI_BATCH_PIPELINE");
    setIsExecuting(true);
    setExecuteIndex(0);
    setAiStep(1);
    setTempAiData({});
  }, [queueIds, manifestData]);

  const getFieldMetadata = (key, data, productId, currentApprovals) => {
    const hasCurrent = data.currentMetafields?.hasOwnProperty(key);
    let currentVal = hasCurrent ? String(data.currentMetafields[key] || "") : "";

    if (key === "shopify_title") {
        currentVal = String(data.canonicalFields?.["shopify_title"] || currentVal || ""); 
    }

    const isProposed = data.repairPlan !== undefined && data.repairPlan.hasOwnProperty(key);
    const propVal = isProposed ? String(data.repairPlan[key] ?? "") : "";

    let fieldMeta = data.metadata?.[key] || {};
    let source = fieldMeta.source || "Not reported";
    let stage = fieldMeta.stage || "Not reported";

    let fieldStatus = "Unchanged";
    let proposalStatus = isProposed ? (propVal.trim() !== "" ? "Provided" : "Empty") : "Not provided";
    let isBlockedAction = false;
    let reasons = [];

    const isRequired = REQUIRED_FIELDS.includes(key);
    const isProtected = PROTECTED_FIELDS.includes(key);
    const isHardware = HARDWARE_FIELDS.includes(key);
    const isIntegration = INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));

    const currentCount = currentVal.length;
    const propCount = propVal.length;
    const limit = FIELD_LIMITS[key] || null;
    
    const currentExists = currentVal.trim() !== "";
    const proposalExists = isProposed && propVal.trim() !== "";

    const isManualOnly = (key === "price" || key === "shopify_title");
    const exactApprovalVal = currentApprovals?.[productId]?.[key];
    const isApproved = exactApprovalVal !== undefined && exactApprovalVal === propVal && propVal.trim() !== "";

    if (HIDDEN_CONTEXT_FIELDS.includes(key)) {
        return { currentVal, propVal, isProposed, fieldStatus: "Hidden Source", proposalStatus, source, stage, isBlockedAction: true, reasons: ["Hidden Context"], currentExists, proposalExists, isApproved: false, hasTechnicalBlock: true, contentNeedsReview: false };
    }

    let hasTechnicalBlock = false;
    let contentNeedsReview = false;

    // Technical Verification Layer
    const isOverLimit = limit !== null && (currentCount > limit || (isProposed && propCount > limit));
    if (isOverLimit) {
        hasTechnicalBlock = true;
        reasons.push("Over limit");
    }
    
    if (isIntegration) reasons.push("Integration owned");

    if (BLOCKED_UNVERIFIED_PINS.includes(key) && proposalExists) {
        hasTechnicalBlock = true;
        reasons.push("Type/destination unverified");
    }

    if (isHardware && GENERIC_VALUES.includes(propVal.trim()) && proposalExists) {
        hasTechnicalBlock = true;
        reasons.push("Generic hardware fill into blank");
    }

    // Content Review Status Evaluation
    if (currentExists) {
        if (!proposalExists) {
            fieldStatus = "Unchanged";
        } else if (currentVal === propVal) {
            fieldStatus = "Unchanged";
        } else {
            if (isProtected) {
                contentNeedsReview = true;
                fieldStatus = "Degrade";
                reasons.push("Degrade");
            } else {
                contentNeedsReview = true;
                fieldStatus = "Conflict";
                reasons.push("Conflict");
            }
        }
    } else {
        if (!proposalExists) {
            fieldStatus = isRequired ? "Required missing" : "Optional blank";
            if (isRequired) reasons.push("Required missing");
        } else {
            if (source === "Not reported") {
                contentNeedsReview = true;
                fieldStatus = "Unverified proposal";
                reasons.push("Unverified proposal");
            } else {
                fieldStatus = "Proposed";
                reasons.push("Proposed");
            }
        }
    }

    // Apply baseline technical overrides
    if (hasTechnicalBlock && fieldStatus !== "Unchanged" && fieldStatus !== "Optional blank" && fieldStatus !== "Required missing") {
        if (isOverLimit) {
            fieldStatus = "Over limit";
        } else if (reasons.includes("Type/destination unverified") || reasons.includes("Generic hardware fill into blank")) {
            fieldStatus = "Blocked";
        }
    }

    // React to Approvals
    if (proposalExists && currentVal !== propVal && !isManualOnly) {
        if (isApproved) {
            if (hasTechnicalBlock) {
                fieldStatus = "Approved, blocked";
                isBlockedAction = true;
            } else {
                fieldStatus = "Approved, not saved";
                isBlockedAction = false;
            }
        } else {
            // If not manually approved, content blocks stop saves
            if (contentNeedsReview || hasTechnicalBlock) {
                isBlockedAction = true;
            } else {
                // "Proposed" fields are inherently safe when not blocked technically
                isBlockedAction = false; 
            }
        }
    } else {
        // Enforce blocks on Unchanged, Blanks, Missing
        if (hasTechnicalBlock || fieldStatus === "Optional blank" || fieldStatus === "Required missing") {
            isBlockedAction = true;
        }
    }

    // Absolute enforcements for manual only (prices and shopify titles)
    if (isManualOnly) {
        isBlockedAction = true;
        hasTechnicalBlock = true;
        if (proposalExists && currentVal !== propVal) {
            fieldStatus = "Manual only";
            if (!reasons.includes("Manual only")) reasons.push("Manual only");
        }
    }

    return { 
      currentVal, propVal, isProposed, fieldStatus, proposalStatus, source, stage, 
      isBlockedAction, reasons, currentExists, proposalExists, isApproved, hasTechnicalBlock, contentNeedsReview 
    };
  };

  useEffect(() => {
    if (!isExecuting) return;
    if (batchFetcher.state !== "idle") return;

    if (executeIndex >= queueIds.length) {
      setIsExecuting(false);
      setExecutionMode(null);
      setAiStep(0);
      setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
      return;
    }

    const currentId = queueIds[executeIndex];
    const manifest = manifestData[currentId];
    const product = safeProducts.find(p => p.id === currentId);

    if (!manifest || !product) {
      updateProductState(currentId, STATUS.SKIPPED, ["No manifest or product data built."]);
      setTimeout(() => setExecuteIndex(i => i + 1), 500);
      return;
    }

    if (executionMode === "REPAIR") {
      if (!tempAiData.repairRequested) {
        setTempAiData({ repairRequested: true });
        updateProductState(currentId, STATUS.SCANNING, ["Executing structural repairs..."]);
        
        const fd = new FormData();
        fd.append("intent", "executeRepairPlan");
        fd.append("pieceId", currentId);
        
        // Save execution utilizes the derived metadata to determine safety
        const safePlan = {};
        Object.keys(manifest.repairPlan).forEach(key => {
            const meta = getFieldMetadata(key, manifest, currentId, approvals);
            if (!meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) {
                safePlan[key] = manifest.repairPlan[key];
            }
        });

        fd.append("repairPlan", JSON.stringify(safePlan));
        fd.append("legacyKeysToRemove", JSON.stringify([]));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      }
    } 
    else if (executionMode === "AI_BATCH_PIPELINE") {
      if (aiStep === 1 && !tempAiData.titleParseRequested) {
        setTempAiData(prev => ({ ...prev, titleParseRequested: true }));
        updateProductState(currentId, STATUS.SCANNING, ["Stage 1: Parsing Title & Origin (Gemini + Render DB)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const fd = new FormData();
        fd.append("intent", "titleParse");
        fd.append("pieceName", titleToParse);
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 2 && !tempAiData.fullRescanRequested) {
        setTempAiData(prev => ({ ...prev, fullRescanRequested: true }));
        updateProductState(currentId, STATUS.SCANNING, ["Stage 2: Vision API Deep Scan (Gemini)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const imageUrl = product.images?.edges?.[0]?.node?.url || product.featuredImage?.url || product.media?.edges?.[0]?.node?.image?.url || "";
        
        const fd = new FormData();
        fd.append("intent", "tab3FullRescan");
        fd.append("pieceId", currentId);
        fd.append("productTitle", titleToParse);
        fd.append("imageUrl", imageUrl);
        fd.append("stone_family", tempAiData.titleParse?.stone_family || "");
        
        fd.append("origin_story", tempAiData.titleParse?.origin_story || "");
        
        fd.append("honest_flaws_and_character", manifest.currentMetafields["custom.honest_flaws_and_character"] || "");
        fd.append("weight_grams", manifest.currentMetafields["custom.weight_grams"] || "");
        fd.append("dimensions_mm", manifest.currentMetafields["custom.dimensions_mm"] || "");
        
        fd.append("stone_shape", manifest.currentMetafields["custom.stone_shape"] || manifest.canonicalFields["custom.stone_shape"] || "");
        fd.append("cut_and_shape", manifest.currentMetafields["custom.cut_and_shape"] || manifest.canonicalFields["custom.cut_and_shape"] || "");

        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 3 && !tempAiData.generateDescRequested) {
        setTempAiData(prev => ({ ...prev, generateDescRequested: true }));
        updateProductState(currentId, STATUS.SCANNING, ["Stage 3: Generating Story Narrative (Gemini)..."]);
        
        const fd = new FormData();
        fd.append("intent", "generateDescription");
        fd.append("sharedFields", JSON.stringify({
            stone_family: tempAiData.tab3Data?.stone_family || tempAiData.titleParse?.stone_family,
            origin_location: tempAiData.tab3Data?.origin_location || tempAiData.titleParse?.origin_location
        }));
        fd.append("pieceData", JSON.stringify(tempAiData.tab3Data || {}));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 4) {
        updateProductState(currentId, STATUS.VALIDATED, ["AI Pipeline Complete. Data staged."]);
        
        setManifestData(prev => {
            const existing = prev[currentId];
            const newPlan = { ...existing.repairPlan };
            const diagnostics = { ...(existing.diagnostics || {}) };
            
            const titleData = tempAiData.titleParse || {};
            const visionData = tempAiData.tab3Data || {};
            const descData = tempAiData.generated_description || "";

            // Record stage success
            if (tempAiData.titleParseRequested) {
                diagnostics.gemini = "Success";
                diagnostics.geoLibrary = titleData?.geoSource === "library" ? "Success" : (titleData?.geoSource || "Not reported");
                diagnostics.stage = "titleParse";
            }
            if (tempAiData.fullRescanRequested) {
                diagnostics.vision = "Success";
                diagnostics.gemini = "Success";
                diagnostics.stage = "tab3FullRescan";
            }
            if (tempAiData.generateDescRequested) {
                diagnostics.gemini = "Success";
                diagnostics.stage = "generateDescription";
            }

            Object.keys(visionData).forEach(k => {
                if (k !== "generated_description" && k !== "pieceId" && k !== "debug_origin" && k !== "intent" && k !== "success") {
                    if (NATIVE_FIELDS.includes(k) || k.includes('.')) {
                        newPlan[k] = visionData[k];
                    } else {
                        newPlan[`custom.${k}`] = visionData[k];
                    }
                }
            });
            
            Object.keys(titleData).forEach(k => {
                if (k !== "pieceId" && k !== "intent" && k !== "success" && k !== "geoSource") {
                    if (NATIVE_FIELDS.includes(k) || k.includes('.')) {
                        newPlan[k] = titleData[k];
                    } else {
                        newPlan[`custom.${k}`] = titleData[k];
                    }
                }
            });

            if (descData) newPlan["custom.generated_description"] = descData;

            return { ...prev, [currentId]: { ...existing, repairPlan: newPlan, diagnostics } };
        });
        
        setTempAiData({});
        setAiStep(1); 
        setTimeout(() => setExecuteIndex(i => i + 1), 500);
      }
    }
  }, [isExecuting, executionMode, executeIndex, queueIds, manifestData, batchFetcher.state, updateProductState, aiStep, tempAiData, safeProducts, approvals]);

  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data && batchFetcher.data !== lastProcessedData) {
      setLastProcessedData(batchFetcher.data);
      const { intent, success, pieceId, productId, message, error, errors, logs, status, finalStatus, titleParse, tab3Data, generated_description, fieldsUpdated } = batchFetcher.data;
      
      const targetId = pieceId || productId;
      
      if (intent === "loadProductData" && targetId) {
         if (!success) {
            updateProductState(targetId, STATUS.FAILED, [error || message || "Failed to load data"]);
         } else {
            setManifestData(prev => {
                const prevDiag = prev[targetId]?.diagnostics || {};
                return {
                    ...prev,
                    [targetId]: {
                        ...batchFetcher.data,
                        diagnostics: {
                            shopifyRead: batchFetcher.data.success ? "Success" : "Failed",
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
         if (isLoadingData) setTimeout(() => setLoadIndex(i => i + 1), 100);
      }

      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && targetId && executionMode !== "AI_BATCH_PIPELINE") {
        if (!success) {
           console.error("Execute Error from Backend:", batchFetcher.data);
           setIsExecuting(false);
           const errMsg = errors ? errors[0]?.message : (error || (logs && logs[logs.length-1]) || "Unknown Error");
           setSafetyError(`Engine halted on ${targetId}. Error: ${errMsg}`);
           updateProductState(targetId, STATUS.FAILED, errors ? errors.map(e => e.message) : (logs || ["Unknown Backend Error"]));
           return;
        }
        
        if (intent === "batchAuditItem" && success) {
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
                            ...existing.diagnostics,
                            gemini: "Success",
                            vision: "Success",
                            stage: "batchAuditItem"
                        }
                    }
                };
            });
            setTimeout(() => {
                const fd = new FormData();
                fd.append("intent", "loadProductData");
                fd.append("pieceId", targetId);
                batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
            }, 500);
            return;
        }

        if (intent === "executeRepairPlan" && success) {
            setManifestData(prev => {
                const existing = prev[targetId];
                if (!existing) return prev;
                return {
                    ...prev,
                    [targetId]: {
                        ...existing,
                        diagnostics: {
                            ...existing.diagnostics,
                            shopifyRead: "Success",
                            readBack: "Not called",
                            stage: "executeRepairPlan"
                        }
                    }
                };
            });
        }

        const successLogs = logs || [message || "Operation applied successfully."];
        
        let statusToSet = STATUS.COMPLETE;
        if (status === "NO_CHANGES_REQUIRED" || message === "No changes required." || fieldsUpdated === 0) {
            statusToSet = STATUS.SKIPPED;
            successLogs.push("No changes required.");
        } else if (finalStatus === "Needs Review" || status === "REPAIR_FAILED") {
            statusToSet = STATUS.FAILED;
        }

        updateProductState(targetId, statusToSet, successLogs);
        
        if (isExecuting) {
           setTempAiData({});
           setTimeout(() => setExecuteIndex(i => i + 1), 500);
        }
      }

      if (executionMode === "AI_BATCH_PIPELINE") {
        const currentId = queueIds[executeIndex];
        
        const isExpectedResponse = 
            (aiStep === 1 && intent === "titleParse") ||
            (aiStep === 2 && intent === "tab3FullRescan") ||
            (aiStep === 3 && intent === "generateDescription");
        
        if (isExpectedResponse) {
            if (!success) {
                updateProductState(currentId, STATUS.FAILED, [error || `Gemini failed at ${intent}`]);
                setIsExecuting(false);
                setSafetyError(`Engine halted on item ${executeIndex + 1}. Error: ${error || "Unknown Gemini API Error"}`);
                setManifestData(prev => {
                    const existing = prev[currentId];
                    if (!existing) return prev;
                    const diagnostics = { ...existing.diagnostics, error: error || `Gemini failed at ${intent}` };
                    if (intent === "titleParse" || intent === "generateDescription") diagnostics.gemini = "Failed";
                    if (intent === "tab3FullRescan") { diagnostics.vision = "Failed"; diagnostics.gemini = "Failed"; }
                    return { ...prev, [currentId]: { ...existing, diagnostics } };
                });
                return;
            }

            if (intent === "titleParse") {
                setTempAiData(prev => ({ ...prev, titleParse: titleParse }));
                setAiStep(2); 
            } 
            else if (intent === "tab3FullRescan") {
                setTempAiData(prev => ({ ...prev, tab3Data: tab3Data }));
                setAiStep(3); 
            } 
            else if (intent === "generateDescription") {
                setTempAiData(prev => ({ ...prev, generated_description: generated_description }));
                setAiStep(4); 
            }
        }
      }
    }
  }, [batchFetcher.state, batchFetcher.data, lastProcessedData, executionMode, aiStep, executeIndex, queueIds, updateProductState, isLoadingData, isExecuting]);

  const handleRepairPlanChange = (key, value) => {
    if (!selectedBenchId) return;
    
    // Clear previously approved value if the proposal text is modified manually
    setApprovals(prev => {
        if (prev[selectedBenchId] && prev[selectedBenchId][key] !== undefined) {
            const next = { ...prev };
            delete next[selectedBenchId][key];
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
             [key]: value
          }
       }
    }));
  };

  const handleExecuteSingleRepair = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
       setSafetyError("Generate Repair Plan for this item first.");
       return;
    }
    
    const fd = new FormData();
    fd.append("intent", "executeRepairPlan");
    fd.append("pieceId", selectedBenchId);
    
    const safePlan = {};
    Object.keys(manifest.repairPlan).forEach(key => {
        const meta = getFieldMetadata(key, manifest, selectedBenchId, approvals);
        if (!meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) {
            safePlan[key] = manifest.repairPlan[key];
        }
    });

    fd.append("repairPlan", JSON.stringify(safePlan));
    fd.append("legacyKeysToRemove", JSON.stringify([]));

    updateProductState(selectedBenchId, STATUS.SCANNING, ["Executing single structural repair..."]);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedBenchId, manifestData, approvals, batchFetcher, updateProductState]);

  const handleExecuteSingleAI = useCallback(() => {
    if (!selectedBenchId) return;
    
    setApprovals(prev => {
        const next = { ...prev };
        delete next[selectedBenchId];
        return next;
    });
    
    const fd = new FormData();
    fd.append("intent", "batchAuditItem");
    fd.append("pieceId", selectedBenchId);
    fd.append("runMode", "LIVE_RUN");
    fd.append("explicitConfirm", "true");

    updateProductState(selectedBenchId, STATUS.SCANNING, ["Spinning up single Gemini AI run..."]);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
  }, [selectedBenchId, batchFetcher, updateProductState]);

  const getStatusTone = (status) => {
    switch(status) {
      case STATUS.VALIDATED: return "success";
      case STATUS.COMPLETE: return "success";
      case STATUS.SCANNING: return "magic";
      case STATUS.FAILED: return "critical";
      case STATUS.QUEUED: return "info";
      default: return undefined;
    }
  };

  const isMultilineKey = (k) => [
    "custom.generated_description", "custom.stone_story", 
    "custom.bench_notes", "custom.character_marks", "custom.honest_flaws_and_character", 
    "custom.artist_notes"
  ].includes(k);

  const getSystemStatus = () => {
      const data = manifestData[selectedBenchId];
      let diag = data?.diagnostics || {
          shopifyRead: "Not reported",
          gemini: "Not reported",
          vision: "Not reported",
          geoLibrary: "Not reported",
          readBack: "Not called",
          stage: "Not reported",
          error: null
      };

      let shopifyReadStatus = diag.shopifyRead;
      let geminiStatus = diag.gemini;
      let visionStatus = diag.vision;
      let geoLibraryStatus = diag.geoLibrary;
      let readBackStatus = diag.readBack;
      let currentStage = diag.stage || "Not reported";

      const isCurrentlyProcessing = (isLoadingData && queueIds[loadIndex] === selectedBenchId) ||
                                    (isExecuting && queueIds[executeIndex] === selectedBenchId);
      
      let finalStageDisplay = executionMode || "Not reported";
      let fetcherStateDisplay = batchFetcher.state;
      let loadingStateDisplay = isLoadingData ? "Loading" : "Idle";
      let errorMessageDisplay = safetyError || diag.error || "None";

      if (isCurrentlyProcessing) {
          if (isLoadingData) {
              shopifyReadStatus = "Running";
          } else if (executionMode === "AI_BATCH_PIPELINE") {
              if (aiStep === 1) { geminiStatus = "Running"; currentStage = "titleParse"; }
              if (aiStep === 2) { geminiStatus = "Running"; visionStatus = "Running"; currentStage = "tab3FullRescan"; }
              if (aiStep === 3) { geminiStatus = "Running"; currentStage = "generateDescription"; }
          } else if (executionMode === "REPAIR") {
              shopifyReadStatus = "Running"; 
              currentStage = "executeRepairPlan";
          }
      }

      if (batchFetcher.state !== "idle" && batchFetcher.formData?.get("pieceId") === selectedBenchId) {
          const intent = batchFetcher.formData?.get("intent");
          if (intent === "batchAuditItem") {
              geminiStatus = "Running";
              visionStatus = "Running";
              currentStage = "batchAuditItem";
          }
          if (intent === "executeRepairPlan") {
              shopifyReadStatus = "Running";
              currentStage = "executeRepairPlan";
          }
      }

      return {
          shopifyReadStatus, geminiStatus, visionStatus, geoLibraryStatus, readBackStatus,
          currentStage, finalStageDisplay, fetcherStateDisplay, loadingStateDisplay, errorMessageDisplay
      };
  };

  const getDiagnosticsStats = (data) => {
    if (!data) return null;
    let stats = {
        proposed: 0,
        blocked: 0,
        degraded: 0,
        conflicts: 0,
        unverified: 0,
        optionalBlanks: 0,
        requiredMissing: 0,
        approvedWrite: 0,
        total: 0,
        filled: 0,
        blank: 0
    };

    SECTIONS.forEach(sec => {
        sec.keys.forEach(k => {
            stats.total++;
            const meta = getFieldMetadata(k, data, selectedBenchId, approvals);
            
            if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
            else stats.filled++;

            if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked") stats.proposed++;
            if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k)) stats.blocked++;
            if (meta.fieldStatus === "Degrade") stats.degraded++;
            if (meta.fieldStatus === "Conflict") stats.conflicts++;
            if (meta.fieldStatus === "Unverified proposal") stats.unverified++;
            if (meta.fieldStatus === "Optional blank") stats.optionalBlanks++;
            if (meta.fieldStatus === "Required missing") stats.requiredMissing++;
            if ((meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved") && !meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k)) stats.approvedWrite++;
        });
    });

    return stats;
  };

  const handleCollectTelemetry = useCallback(() => {
      if (!selectedBenchId || !manifestData[selectedBenchId]) {
          setSafetyError("Cannot collect telemetry: No active bench item.");
          return;
      }

      const data = manifestData[selectedBenchId];
      const product = safeProducts.find(p => p.id === selectedBenchId) || {};
      const statusObj = getSystemStatus();
      const diag = data.diagnostics || {};

      let stats = {
          loaded: 0,
          blank: 0,
          proposed: 0,
          blocked: 0,
          protected: 0,
          conflicting: 0,
          updated: data.fieldsUpdated !== undefined ? data.fieldsUpdated : "Not recorded",
          errored: "Not recorded"
      };

      const pinRows = [];
      let hasBlockersForWrite = false;

      // Process all 45 pins in SECTIONS
      SECTIONS.forEach(sec => {
          sec.keys.forEach(key => {
              const meta = getFieldMetadata(key, data, selectedBenchId, approvals);
              
              if (meta.currentExists) stats.loaded++;
              if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
              if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked") stats.proposed++;
              if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) stats.blocked++;
              if (PROTECTED_FIELDS.includes(key)) stats.protected++;
              if (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade") stats.conflicting++;

              if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) {
                  hasBlockersForWrite = true;
              }

              if (key === "custom.origin_story") {
                  const sourceAvailable = (meta.currentExists || meta.proposalExists) ? "Yes" : "No";
                  pinRows.push(`- ${key}: [Hidden Context] Source Available: ${sourceAvailable}`);
              } else {
                  const cleanText = (str) => {
                      if (!str) return "";
                      const cleaned = String(str).replace(/\n/g, " ").trim();
                      return cleaned.length > 40 ? cleaned.substring(0, 37) + "..." : cleaned;
                  };
                  
                  const curr = cleanText(meta.currentVal);
                  const prop = cleanText(meta.propVal);
                  let row = `- ${key}: Current: [${curr}], Proposed: [${prop}], Status: [${meta.fieldStatus}]`;
                  if (meta.reasons.length > 0) {
                      row += `, Reason: [${meta.reasons.join(", ")}]`;
                  }
                  pinRows.push(row);
              }
          });
      });

      const genDescVal = data.repairPlan?.["custom.generated_description"] || data.currentMetafields?.["custom.generated_description"] || "";
      const descExists = !!genDescVal;
      const descPreview = descExists ? String(genDescVal).substring(0, 80).replace(/\n/g, " ") + "..." : "None";

      const titleParseStatus = (diag.stage === "titleParse" || diag.stage === "tab3FullRescan" || diag.stage === "generateDescription" || diag.stage === "batchAuditItem") ? (diag.gemini || "Unknown") : "Not called";
      const visionStatus = diag.vision || "Not called";
      const geoStatus = diag.geoLibrary || "Not called";
      const descStatus = descExists && data.repairPlan?.["custom.generated_description"] ? "Success" : (diag.stage === "generateDescription" ? (diag.gemini || "Unknown") : "Not called");

      const shopifyRead = statusObj.shopifyReadStatus;
      const shopifyWrite = data.fieldsUpdated !== undefined ? (data.fieldsUpdated > 0 ? "Success" : "Success (0 changes)") : "Not called";
      const readBack = statusObj.readBackStatus;

      const recommendations = [];
      if (hasBlockersForWrite) {
          recommendations.push("1. DO NOT WRITE. Review and manually resolve blocked, conflicting, or unverified pins listed above. Approve suggestions where applicable.");
          recommendations.push("2. Verify Shopify Metafield definitions for any 'Unverified proposal' pins before approving.");
      } else if (stats.proposed > 0 && shopifyWrite === "Not called") {
          recommendations.push("1. Data is staged and validated. Proceed with 'Execute Single Repair'.");
      } else if (shopifyWrite.includes("Success")) {
          recommendations.push("1. Write successful. Verify live changes in Shopify admin if necessary.");
      } else {
          recommendations.push("1. Load data or generate a repair plan to begin.");
      }

      const report = `=== ROCKHOUND STUDIO TELEMETRY REPORT ===
Product: ${product.title || "Unknown"}
GID: ${selectedBenchId}
Run Time: ${new Date().toISOString()}

--- PIPELINE STATUS ---
[Shopify IO]
Read: ${shopifyRead}
Write: ${shopifyWrite}
Read-Back: ${readBack}

[AI Stages]
Title Parse: ${titleParseStatus}
Vision Scan: ${visionStatus}
Geo Library: ${geoStatus}
Story Gen: ${descStatus}

--- 45-PIN SUMMARY ---
Loaded: ${stats.loaded}
Blank: ${stats.blank}
Proposed: ${stats.proposed}
Blocked: ${stats.blocked}
Protected: ${stats.protected}
Conflicting: ${stats.conflicting}
Updated: ${stats.updated}
Errored: ${stats.errored}

--- GENERATED DESCRIPTION ---
Status: ${descStatus}
Preview: ${descPreview}

--- PIN DETAILS ---
${pinRows.join("\n")}

--- RECOMMENDATIONS ---
${recommendations.join("\n")}
=========================================`;

      navigator.clipboard.writeText(report)
          .then(() => {
              if (window.shopify && window.shopify.toast) {
                  window.shopify.toast.show("Telemetry report copied");
              } else {
                  setSafetyMessage("Telemetry report copied to clipboard.");
              }
          })
          .catch(err => {
              console.error("Clipboard error", err);
              setSafetyError("Failed to copy telemetry to clipboard.");
          });
  }, [selectedBenchId, manifestData, safeProducts, approvals, batchFetcher.state, isLoadingData, safetyError, aiStep, executionMode, getSystemStatus]);

  const renderDiagnosticHeader = () => {
    const data = manifestData[selectedBenchId];
    if (!data) return null;

    const stats = getDiagnosticsStats(data);
    const statusObj = getSystemStatus();

    return (
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingLg" as="h3">Diagnostic Header</Text>
            <Button size="large" variant="primary" icon={ClipboardIcon} onClick={handleCollectTelemetry}>
              Collect Telemetry
            </Button>
          </InlineStack>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            
            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">System Status</Text>
                <BlockStack gap="100" align="start">
                  <Text as="p" fontWeight="bold">Shopify Read: <Badge tone={statusObj.shopifyReadStatus === "Success" ? "success" : (statusObj.shopifyReadStatus === "Running" ? "magic" : "critical")}>{statusObj.shopifyReadStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Gemini API: <Badge tone={statusObj.geminiStatus === "Running" ? "magic" : "info"}>{statusObj.geminiStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Vision API: <Badge tone={statusObj.visionStatus === "Running" ? "magic" : "info"}>{statusObj.visionStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Geo Library: <Badge tone="info">{statusObj.geoLibraryStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Read-back: <Badge tone="info">{statusObj.readBackStatus}</Badge></Text>
                </BlockStack>
              </div>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">Repair Engine</Text>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="bold">Proposed changes: {stats.proposed}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Blocked changes: {stats.blocked}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Degraded fields: {stats.degraded}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Conflicts: {stats.conflicts}</Text>
                  <Text as="p" fontWeight="bold" color="attention">Unverified proposals: {stats.unverified}</Text>
                  <Text as="p" fontWeight="bold" color="success">Fields approved for write: {stats.approvedWrite}</Text>
                </BlockStack>
              </div>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">Field Metrics</Text>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="bold">Total Fields: {stats.total}</Text>
                  <Text as="p" fontWeight="bold">Filled: <span style={{ color: "#22c55e" }}>{stats.filled}</span></Text>
                  <Text as="p" fontWeight="bold">Optional blanks: <span style={{ color: "#eab308" }}>{stats.optionalBlanks}</span></Text>
                  <Text as="p" fontWeight="bold" color="critical">Required missing fields: {stats.requiredMissing}</Text>
                  <Text as="p" fontWeight="bold">Fields Updated (Last Run): {data.fieldsUpdated !== undefined ? data.fieldsUpdated : "Not reported"}</Text>
                </BlockStack>
              </div>
            </Box>

          </div>
        </BlockStack>
      </Card>
    );
  };

  const toggleBay = (title) => {
    setExpandedBays(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const renderManifestTable = (section) => {
    const data = manifestData[selectedBenchId];
    if (!data) return null;

    const filteredKeys = section.keys.filter(k => {
      if (HIDDEN_CONTEXT_FIELDS.includes(k)) return false;
      
      if (activeFilter === "All") return true;
      const meta = getFieldMetadata(k, data, selectedBenchId, approvals);
      
      if (activeFilter === "Blank" && (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing")) return true;
      if (activeFilter === "Proposed changes" && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked")) return true;
      if (activeFilter === "Conflicts" && (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade")) return true;
      if (activeFilter === "Needs review" && (meta.fieldStatus === "Required missing" || meta.fieldStatus === "Unverified proposal" || (meta.contentNeedsReview && !meta.isApproved))) return true;
      if (activeFilter === meta.source) return true;
      return false;
    });

    if (filteredKeys.length === 0) return null;
    const isExpanded = expandedBays[section.title];

    return (
      <Card padding="0" key={section.title}>
        <div 
            onClick={() => toggleBay(section.title)} 
            style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
        >
          <div style={{ minWidth: 0 }}>
            <Text as="h3" variant="headingLg" fontWeight="bold">{section.title} ({filteredKeys.length} fields)</Text>
          </div>
          <Button variant="plain" icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
        </div>
        
        {isExpanded && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, boxSizing: "border-box" }}>
            {filteredKeys.map((key) => {
              const meta = getFieldMetadata(key, data, selectedBenchId, approvals);
              const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";
              
              let statusTone = undefined;
              if (meta.fieldStatus === "Optional blank") statusTone = "attention";
              if (["Required missing", "Conflict", "Degrade", "Blocked", "Over limit", "Failed", "Unverified proposal", "Manual only"].includes(meta.fieldStatus)) statusTone = "critical";
              if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved") statusTone = "success";
              if (meta.fieldStatus === "Unchanged") statusTone = "new";
              if (meta.fieldStatus === "Approved, blocked") statusTone = "warning";

              const isManualOnly = key === "price" || key === "shopify_title";
              const canApprove = meta.proposalExists && meta.currentVal !== meta.propVal && !isManualOnly;
              
              let boxBg = "#f8f9fa";
              let boxBorder = "#dee2e6";
              let textColor = "#212529";
              let statusText = "Ready for review";

              if (meta.isApproved && !meta.hasTechnicalBlock) {
                  boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
                  statusText = "Approved and technically eligible.";
              } else if (meta.isApproved && meta.hasTechnicalBlock) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  statusText = "Suggestion approved. Cannot save until field destination/type is verified or limits resolved.";
              } else if (!meta.isApproved && meta.hasTechnicalBlock) {
                  boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
                  statusText = "Blocked by technical error. Review needed.";
              } else if (!meta.isApproved && meta.contentNeedsReview) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  statusText = "Review needed to verify content explicitly before write can occur.";
              } else if (!meta.isApproved && meta.fieldStatus === "Proposed") {
                  boxBg = "#e2e3e5"; boxBorder = "#d3d6d8"; textColor = "#41464c";
                  statusText = "Safe suggestion. Approval optional but recorded if checked.";
              }

              return (
                <Box key={key} padding="300" background={isBlank ? "bg-surface-warning" : "bg-surface"} borderColor="border" borderWidth="1" borderRadius="200">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", boxSizing: "border-box", minWidth: 0 }}>
                    
                    {/* Left Panel: Labels & Metadata */}
                    <div style={{ flex: "1 1 250px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                      <BlockStack gap="100">
                        <div style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            <Text as="h4" variant="headingMd" fontWeight="bold">{formatLabel(key)}</Text>
                            <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{key}</Text>
                        </div>
                        
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
                        </div>
                      </BlockStack>
                    </div>

                    {/* Right Panel: Current & Proposal Values */}
                    <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: "12px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                        <div style={{ padding: "12px", backgroundColor: "#f4f6f8", borderRadius: "8px", border: "1px solid #d2d5d8", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", boxSizing: "border-box" }}>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value</Text>
                            <div style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                                <Text as="p" variant="bodyLg">{meta.currentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
                            </div>
                        </div>
                        
                        <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Bench Proposal Value</Text>
                            <TextField
                                value={meta.propVal}
                                onChange={(val) => handleRepairPlanChange(key, val)}
                                autoComplete="off"
                                multiline={isMultilineKey(key) ? 3 : undefined}
                                placeholder={meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : "")}
                            />
                        </div>

                        {canApprove && (
                            <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                    <input
                                        type="checkbox"
                                        id={`approve-${key}`}
                                        checked={meta.isApproved || false}
                                        onChange={(e) => handleToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked)}
                                        style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: textColor, marginTop: "2px" }}
                                        aria-label={`Approve suggestion for ${formatLabel(key)}: ${meta.propVal}`}
                                    />
                                    <label htmlFor={`approve-${key}`} style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                        Approve this suggestion: <span style={{ fontWeight: "normal", whiteSpace: "pre-wrap" }}>"{meta.propVal}"</span>
                                    </label>
                                </div>
                                <div style={{ marginTop: "8px", marginLeft: "36px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    <Text as="p" tone={(!meta.isApproved && meta.hasTechnicalBlock) || (meta.isApproved && meta.hasTechnicalBlock) ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor }}>
                                        {statusText}
                                    </Text>
                                </div>
                            </div>
                        )}

                    </div>
                  </div>
                </Box>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;

  const filterOptions = [
    {label: 'All', value: 'All'},
    {label: 'Needs review', value: 'Needs review'},
    {label: 'Proposed changes', value: 'Proposed changes'},
    {label: 'Conflicts', value: 'Conflicts'},
    {label: 'Blank', value: 'Blank'},
    {label: 'Shopify', value: 'Shopify'},
    {label: 'Gemini', value: 'Gemini'},
    {label: 'Vision', value: 'Vision'},
    {label: 'Geo Library', value: 'Geo Library'},
    {label: 'Derived', value: 'Derived'},
    {label: 'Manual', value: 'Manual'}
  ];

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub — Accessible Diagnostic View</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "24px", alignItems: "start", boxSizing: "border-box", maxWidth: "100%" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <div>
          <Card padding="300">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">1. Select Raw Inventory ({queueIds.length})</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search inventory..."
                disabled={isLoadingData || isExecuting}
              />

              <Button 
                size="large" 
                fullWidth 
                onClick={toggleSelectAllFiltered}
                disabled={isLoadingData || isExecuting}
              >
                {allFilteredSelected ? `Unload (${filteredProducts.length})` : `Load (${filteredProducts.length})`}
              </Button>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", height: "70vh", paddingRight: "4px", minWidth: 0 }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const isSelectedForBench = selectedBenchId === p.id;
                  const currentStatus = productStates[p.id]?.status || STATUS.QUEUED;
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleProductSelection(p.id)}
                      style={{ 
                        flexShrink: 0, 
                        border: isSelectedForBench ? "3px solid #005bd3" : "2px solid #c9cccf", 
                        borderRadius: "8px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isLoadingData || isExecuting ? "not-allowed" : "pointer", 
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        minWidth: 0
                      }} 
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
                          {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <Text as="p" variant="bodyLg" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                          <div style={{ marginTop: "4px" }}>
                            <Badge tone={getStatusTone(currentStatus)} size="medium">{currentStatus}</Badge>
                          </div>
                        </div>
                      </div>

                      <Button 
                        size="medium" 
                        fullWidth
                        variant={isSelectedForBench ? "primary" : "secondary"}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (manifestData[p.id]) setSelectedBenchId(p.id);
                          else alert("Hit GENERATE REPAIR PLAN (Load Data) first to fetch this item's live data.");
                        }}
                      >
                        View Manifest on Bench
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

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
                  
                  <Button size="large" icon={ClipboardIcon} onClick={handleCollectTelemetry}>
                    Global Telemetry Dump
                  </Button>
                </div>
              </BlockStack>
            </Card>

            {!selectedBenchId || !manifestData[selectedBenchId] ? (
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

                {renderDiagnosticHeader()}

                <Card padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h3">Review Board Controls</Text>
                        <Select
                            label="Filter Fields"
                            labelInline
                            options={filterOptions}
                            onChange={(val) => setActiveFilter(val)}
                            value={activeFilter}
                        />
                    </InlineStack>
                </Card>

                {SECTIONS.map(sec => renderManifestTable(sec))}
                
              </BlockStack>
            )}
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
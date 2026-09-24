// ==========================================================================
// ROCKHOUND STUDIO — TAB 3: OPERATIONS MATRIX
// File: app/routes/app.meta-injector.matrix.jsx
// ==========================================================================
import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar, Select, Divider } from "@shopify/polaris";
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
      "global.title_tag", "global.description_tag", "custom.shopify_title",
      "custom.piece_name", "custom.official_name", "custom.seo_title",
      "custom.is_ooak", "custom.is_one_of_a_kind", "custom.handcrafted_by", 
      "custom.rescued_by"
    ]
  },
  {
    title: "2. Stone Facts and Physical Details",
    keys: [
      "custom.dimensions_mm", "custom.weight_grams", "custom.shipping_weight_oz", 
      "custom.stone_shape", "custom.cut_type", "custom.cut_and_shape", 
      "custom.surface_finish", "custom.color", "custom.primary_color", 
      "custom.secondary_colors", "custom.color_pattern", "custom.treatment_status", 
      "custom.treated", "custom.character_marks", "custom.honest_flaws_and_character", 
      "custom.bench_notes", "custom.artist_notes", "custom.alt_text",
      "custom.mohs_hardness", "custom.moh_hardness", "custom.specific_gravity", 
      "custom.crystal_system", "custom.crystal-system", "custom.luster", 
      "custom.cleavage", "custom.fracture_pattern", "custom.diaphaneity", 
      "custom.tenacity", "custom.mineral_class", "custom.mineral-class", 
      "custom.rock_composition", "custom.rock-composition", "custom.rock_formation", 
      "custom.rock-formation", "custom.geological_era", "custom.geological-era", 
      "custom.geological_age"
    ]
  },
  {
    title: "3. Origin, Story, and Collection",
    keys: [
      "custom.stone_family", "custom.origin_location", "custom.origin_page_handle", 
      "custom.origin_handle", "custom.collection_name", "custom.collection_location", 
      "custom.origin_story", "custom.stone_story", "custom.generated_description"
    ]
  },
  {
    title: "4. Jewelry and Setting",
    keys: [
      "custom.primary_use", "custom.primary_medium", "custom.secondary_medium", 
      "custom.material", "custom.jewelry_type", "custom.necklace_design", 
      "custom.necklace-design", "custom.setting_ready", "custom.wire_material", 
      "custom.bail_included", "custom.chain_material", "custom.chain_link_type", 
      "custom.chain-link-type", "custom.jewelry_finding_type"
    ]
  },
  {
    title: "5. Search, Sales, and Media",
    keys: [
      "custom.price", "custom.google_product_category", "custom.age_group", "custom.target_gender", 
      "custom.condition", "custom.authenticity", "custom.rarity", 
      "custom.custom_product", "custom.found_object",
      "google.age_group", "google.condition", "google.target_gender",
      "shopify.age-group", "shopify.condition", "shopify.target-gender",
      "shopify.authenticity", "shopify.chain-link-type", "shopify.color-pattern",
      "shopify.crystal-system", "shopify.geological-era",
      "shopify.jewelry-finding-type", "shopify.jewelry-material",
      "shopify.jewelry-type", "shopify.material", "shopify.material-origin",
      "shopify.mineral-class", "shopify.necklace-design",
      "shopify.rarity", "shopify.rock-composition", "shopify.rock-formation",
      "custom.badge", "custom.widget", "custom.review_widget_data"
    ]
  }
];

const LEGACY_MAP = {
  "crystal-system": "crystal_system",
  "mineral-class": "mineral_class",
  "rock-composition": "rock_composition",
  "geological-era": "geological_era",
  "rock-formation": "rock_formation",
  "necklace-design": "necklace_design",
  "is_one_of_a_kind": "is_ooak",
  "chain-link-type": "chain_link_type",
  "moh_hardness": "mohs_hardness"
};

const FIELD_LIMITS = {
  "global.title_tag": 70,
  "custom.seo_title": 70,
  "global.description_tag": 320,
  "custom.shopify_title": 255,
  "custom.piece_name": 255,
  "custom.official_name": 255,
  "custom.origin_story": 100000,
  "custom.stone_story": 100000,
  "custom.generated_description": 100000,
  "custom.artist_notes": 100000,
  "custom.bench_notes": 100000,
  "custom.alt_text": 100000,
  "custom.character_marks": 255,
  "custom.honest_flaws_and_character": 255
};

const PROTECTED_FIELDS = [
  "custom.stone_family", "custom.stone_shape", "custom.cut_and_shape",
  "custom.surface_finish", "custom.color_pattern", "custom.google_product_category",
  "custom.setting_ready", "custom.wire_material", "custom.bail_included",
  "custom.chain_material", "custom.jewelry_finding_type", "custom.shopify_title",
  "global.title_tag", "custom.artist_notes", "custom.bench_notes"
];

const HARDWARE_FIELDS = [
  "custom.setting_ready", "custom.wire_material", "custom.bail_included",
  "custom.chain_material", "custom.jewelry_finding_type"
];

const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];
const REQUIRED_FIELDS = ["global.title_tag", "custom.shopify_title", "custom.price"];
const INTEGRATION_PREFIXES = ["google.", "shopify.", "mm-google", "mc-facebook"];

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
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

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
    
    setSafetyError("");
    setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
    setExecutionMode("AI_BATCH_PIPELINE");
    setIsExecuting(true);
    setExecuteIndex(0);
    setAiStep(1);
    setTempAiData({});
  }, [queueIds, manifestData]);

  const getFieldMetadata = (key, data) => {
    const hasCurrent = data.currentMetafields?.hasOwnProperty(key);
    let currentVal = hasCurrent ? String(data.currentMetafields[key] || "") : "";

    if (key === "custom.shopify_title" || key === "shopify_title") {
        currentVal = String(data.canonicalFields?.["shopify_title"] || currentVal || ""); 
    }

    const isProposed = data.repairPlan !== undefined && data.repairPlan.hasOwnProperty(key);
    const propVal = isProposed ? String(data.repairPlan[key] ?? "") : "";

    let fieldMeta = data.metadata?.[key] || {};
    let source = fieldMeta.source || "Not reported";
    let stage = fieldMeta.stage || "Not reported";

    let fieldStatus = "Unchanged";
    let isBlockedAction = false;
    let reasons = [];

    const isRequired = REQUIRED_FIELDS.includes(key);
    const isProtected = PROTECTED_FIELDS.includes(key);
    const isHardware = HARDWARE_FIELDS.includes(key);
    const isIntegration = INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));
    
    const rawKey = key.split('.')[1] || key;
    const isAlias = Object.keys(LEGACY_MAP).includes(rawKey) || Object.values(LEGACY_MAP).includes(rawKey);

    const currentCount = currentVal.length;
    const propCount = propVal.length;
    const limit = FIELD_LIMITS[key] || null;
    const isOverLimit = limit !== null && (currentCount > limit || (isProposed && propCount > limit));

    if (isOverLimit) {
        reasons.push("Over limit");
    }
    if (isAlias) reasons.push("Alias");
    if (isIntegration) reasons.push("Integration owned");

    const currentExists = currentVal.trim() !== "";
    const proposalExists = isProposed && propVal.trim() !== "";

    if (currentExists) {
        if (!isProposed || !proposalExists) {
            fieldStatus = "Proposal not provided";
        } else if (currentVal === propVal) {
            fieldStatus = "Unchanged";
        } else {
            if (isProtected) {
                fieldStatus = "Degrade";
                reasons.push("Degrade");
                isBlockedAction = true;
            } else {
                fieldStatus = "Conflict";
                reasons.push("Conflict");
                isBlockedAction = true;
            }
        }
    } else {
        if (!proposalExists) {
            fieldStatus = isRequired ? "Required missing" : "Optional blank";
            if (isRequired) reasons.push("Required missing");
        } else {
            if (source === "Not reported") {
                fieldStatus = "Unverified proposal";
                reasons.push("Unverified proposal");
                isBlockedAction = true;
            } else if (isHardware && GENERIC_VALUES.includes(propVal.trim())) {
                fieldStatus = "Blocked";
                reasons.push("Generic hardware fill into blank");
                isBlockedAction = true;
            } else {
                fieldStatus = "Proposed";
                reasons.push("Proposed");
            }
        }
    }

    if (isOverLimit && !isBlockedAction) {
        fieldStatus = "Over limit";
        isBlockedAction = true;
    }

    return { currentVal, propVal, isProposed, fieldStatus, source, stage, isBlockedAction, reasons, currentExists, proposalExists };
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
        
        // Filter out Blocked, Degraded, Conflict, Unverified, Generic Hardware writes
        const safePlan = {};
        Object.keys(manifest.repairPlan).forEach(key => {
            const meta = getFieldMetadata(key, manifest);
            if (!meta.isBlockedAction) {
                safePlan[key] = manifest.repairPlan[key];
            }
        });

        fd.append("repairPlan", JSON.stringify(safePlan));
        fd.append("legacyKeysToRemove", JSON.stringify(Object.keys(manifest.legacyFields || {})));
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
        fd.append("intent", "fullRescan");
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
            stone_family: tempAiData.tab2Data?.stone_family || tempAiData.titleParse?.stone_family,
            origin_location: tempAiData.tab2Data?.origin_location || tempAiData.titleParse?.origin_location
        }));
        fd.append("pieceData", JSON.stringify(tempAiData.tab2Data || {}));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 4) {
        updateProductState(currentId, STATUS.VALIDATED, ["AI Pipeline Complete. Data staged."]);
        
        setManifestData(prev => {
            const existing = prev[currentId];
            const newPlan = { ...existing.repairPlan };
            
            const titleData = tempAiData.titleParse || {};
            const visionData = tempAiData.tab2Data || {};
            const descData = tempAiData.generated_description || "";

            Object.keys(visionData).forEach(k => {
                if (k !== "generated_description" && k !== "pieceId" && k !== "debug_origin" && k !== "intent" && k !== "success") {
                    newPlan[k.includes('.') ? k : `custom.${k}`] = visionData[k];
                }
            });
            
            Object.keys(titleData).forEach(k => {
                if (k !== "pieceId" && k !== "intent" && k !== "success") {
                    newPlan[k.includes('.') ? k : `custom.${k}`] = titleData[k];
                }
            });

            if (descData) newPlan["custom.generated_description"] = descData;

            return { ...prev, [currentId]: { ...existing, repairPlan: newPlan } };
        });
        
        setTempAiData({});
        setAiStep(1); 
        setTimeout(() => setExecuteIndex(i => i + 1), 500);
      }
    }
  }, [isExecuting, executionMode, executeIndex, queueIds, manifestData, batchFetcher.state, updateProductState, aiStep, tempAiData, safeProducts]);

  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data && batchFetcher.data !== lastProcessedData) {
      setLastProcessedData(batchFetcher.data);
      const { intent, success, pieceId, productId, message, error, errors, logs, status, finalStatus, titleParse, tab2Data, generated_description, fieldsUpdated } = batchFetcher.data;
      
      const targetId = pieceId || productId;
      
      if (intent === "loadProductData" && targetId) {
         if (!success) {
            updateProductState(targetId, STATUS.FAILED, [error || message || "Failed to load data"]);
         } else {
            setManifestData(prev => ({ ...prev, [targetId]: batchFetcher.data }));
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
            setTimeout(() => {
                const fd = new FormData();
                fd.append("intent", "loadProductData");
                fd.append("pieceId", targetId);
                batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
            }, 500);
            return;
        }

        const successLogs = logs || [message || "Operation applied successfully."];
        
        let statusToSet = STATUS.COMPLETE;
        // Zero-change repairs must be skipped, specifically checking fieldsUpdated
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
            (aiStep === 2 && intent === "fullRescan") ||
            (aiStep === 3 && intent === "generateDescription");
        
        if (isExpectedResponse) {
            if (!success) {
                updateProductState(currentId, STATUS.FAILED, [error || `Gemini failed at ${intent}`]);
                setIsExecuting(false);
                setSafetyError(`Engine halted on item ${executeIndex + 1}. Error: ${error || "Unknown Gemini API Error"}`);
                return;
            }

            if (intent === "titleParse") {
                setTempAiData(prev => ({ ...prev, titleParse: titleParse }));
                setAiStep(2); 
            } 
            else if (intent === "fullRescan") {
                setTempAiData(prev => ({ ...prev, tab2Data: tab2Data }));
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
        const meta = getFieldMetadata(key, manifest);
        if (!meta.isBlockedAction) {
            safePlan[key] = manifest.repairPlan[key];
        }
    });

    fd.append("repairPlan", JSON.stringify(safePlan));
    fd.append("legacyKeysToRemove", JSON.stringify(Object.keys(manifest.legacyFields || {})));

    updateProductState(selectedBenchId, STATUS.SCANNING, ["Executing single structural repair..."]);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedBenchId, manifestData, batchFetcher, updateProductState]);

  const handleExecuteSingleAI = useCallback(() => {
    if (!selectedBenchId) return;
    
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
    "custom.generated_description", "custom.origin_story", "custom.stone_story", 
    "custom.bench_notes", "custom.character_marks", "custom.honest_flaws_and_character", 
    "custom.artist_notes"
  ].includes(k);

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
        approvedWrite: 0
    };

    SECTIONS.forEach(sec => {
        sec.keys.forEach(k => {
            const meta = getFieldMetadata(k, data);
            if (meta.fieldStatus === "Proposed") stats.proposed++;
            if (meta.isBlockedAction) stats.blocked++;
            if (meta.fieldStatus === "Degrade") stats.degraded++;
            if (meta.fieldStatus === "Conflict") stats.conflicts++;
            if (meta.fieldStatus === "Unverified proposal") stats.unverified++;
            if (meta.fieldStatus === "Optional blank") stats.optionalBlanks++;
            if (meta.fieldStatus === "Required missing") stats.requiredMissing++;
            if (meta.fieldStatus === "Proposed" && !meta.isBlockedAction) stats.approvedWrite++;
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
      const productState = productStates[selectedBenchId];
      const product = safeProducts.find(p => p.id === selectedBenchId) || {};

      const longTextFields = [
          "global.description_tag", "custom.generated_description", "custom.origin_story"
      ];

      const noteFields = [
          "custom.artist_notes", "custom.bench_notes"
      ];

      let summary = {
          "standardFields": 62,
          "observedIntegrationFields": 0,
          "aliasFields": 0,
          "totalObservedFields": 0,
          "loaded": 0,
          "blank": 0,
          "proposed": 0,
          "conflicts": 0,
          "optional blanks": 0,
          "required missing": 0,
          "integration-owned": 0,
          "over-limit": 0,
          "fields updated": data.fieldsUpdated !== undefined ? data.fieldsUpdated : 0,
          "legacy fields removed": Object.keys(data.legacyFields || {}).length,
          "read-back status": data.metadata?.read_back || "Not reported"
      };

      const issuesAndNotes = [];

      SECTIONS.forEach(sec => {
          sec.keys.forEach(key => {
              summary["totalObservedFields"]++;
              const meta = getFieldMetadata(key, data);
              
              const isLong = longTextFields.includes(key);
              const isNote = noteFields.includes(key);
              const limit = FIELD_LIMITS[key] || null;

              const isIntegrationOwned = INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));
              const rawKey = key.split('.')[1] || key;
              const isAlias = Object.keys(LEGACY_MAP).includes(rawKey) || Object.values(LEGACY_MAP).includes(rawKey);

              if (meta.reasons.includes("Over limit")) summary["over-limit"]++;
              if (isIntegrationOwned) {
                  summary["observedIntegrationFields"]++;
                  summary["integration-owned"]++;
              }
              if (isAlias) summary["aliasFields"]++;

              if (meta.currentExists) summary["loaded"]++;
              
              if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") {
                  summary["blank"]++;
                  if (meta.fieldStatus === "Required missing") summary["required missing"]++;
                  else summary["optional blanks"]++;
              }
              
              if (meta.fieldStatus === "Proposed") summary["proposed"]++;
              if (meta.fieldStatus === "Conflict") summary["conflicts"]++;

              let proposalStatus = "Not provided";
              if (meta.isProposed) {
                  proposalStatus = meta.propVal.trim().length > 0 ? "Provided" : "Empty";
              }

              const isIssue = meta.reasons.length > 0 || meta.isBlockedAction || meta.fieldStatus === "Proposed";
              const isPresentNote = isNote && (meta.currentExists || meta.proposalExists);

              if (isIssue || isPresentNote) {
                  const record = {
                      "namespace/key": key,
                      "current value present": meta.currentExists,
                      "proposed value present": meta.proposalExists,
                      "current character count": meta.currentVal.length,
                      "proposed character count": meta.isProposed ? meta.propVal.length : 0,
                      "status": meta.fieldStatus,
                      "proposal status": proposalStatus,
                      "source": meta.source,
                      "stage": meta.stage
                  };

                  if (meta.reasons.length > 0) record.reason = meta.reasons.join(", ");
                  if (meta.reasons.includes("Over limit")) record["over-limit"] = true;

                  if (!isLong) {
                      const getPreview = (text) => text.length > 255 ? text.substring(0, 252) + "..." : text;
                      record["current value"] = isNote ? getPreview(meta.currentVal) : meta.currentVal;
                      if (meta.isProposed) {
                          record["proposed value"] = isNote ? getPreview(meta.propVal) : meta.propVal;
                      }
                  }

                  issuesAndNotes.push(record);
              }
          });
      });

      const payload = {
          product: {
              "product GID": selectedBenchId,
              "product title": product.title || "Unknown",
              "selected bench ID": selectedBenchId,
              "scan status": productState?.status || "Unknown"
          },
          pipeline: {
              "Shopify read status": data.success ? "Success" : "Failed",
              "Gemini status": data.metadata?.gemini_status || "Not reported",
              "Vision status": data.metadata?.vision_status || "Not reported",
              "Geo Library status": data.metadata?.geo_status || "Not reported",
              "current stage": aiStep,
              "final stage": executionMode || "Not reported",
              "fetcher state": batchFetcher.state,
              "loading state": isLoadingData ? "Loading" : "Idle",
              "error message": safetyError || null
          },
          summary,
          issuesAndNotes
      };

      navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
          .then(() => {
              if (window.shopify && window.shopify.toast) {
                  window.shopify.toast.show("Telemetry copied");
              } else {
                  setSafetyMessage("Telemetry copied");
              }
          })
          .catch(err => {
              console.error("Clipboard error", err);
              setSafetyError("Failed to copy telemetry to clipboard.");
          });
  }, [selectedBenchId, manifestData, productStates, safeProducts, batchFetcher.state, isLoadingData, safetyError, aiStep, executionMode]);

  const renderDiagnosticHeader = () => {
    const data = manifestData[selectedBenchId];
    if (!data) return null;

    const stats = getDiagnosticsStats(data);
    const shopifyReadStatus = data.success ? "Success" : "Failed";
    const geminiStatus = data.metadata?.gemini_status || "Not reported";
    const visionStatus = data.metadata?.vision_status || "Not reported";
    const geoLibraryStatus = data.metadata?.geo_status || "Not reported";
    const readBackStatus = data.metadata?.read_back || "Not reported";

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
              <Text as="p" variant="headingSm" tone="subdued">System Status</Text>
              <BlockStack gap="100" align="start">
                <Text as="p" fontWeight="bold">Shopify Read: <Badge tone={shopifyReadStatus === "Success" ? "success" : "critical"}>{shopifyReadStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Gemini API: <Badge tone="info">{geminiStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Vision API: <Badge tone="info">{visionStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Geo Library: <Badge tone="info">{geoLibraryStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Read-back: <Badge tone="info">{readBackStatus}</Badge></Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <Text as="p" variant="headingSm" tone="subdued">Repair Engine</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Proposed changes: {stats.proposed}</Text>
                <Text as="p" fontWeight="bold" color="critical">Blocked changes: {stats.blocked}</Text>
                <Text as="p" fontWeight="bold" color="critical">Degraded fields: {stats.degraded}</Text>
                <Text as="p" fontWeight="bold" color="critical">Conflicts: {stats.conflicts}</Text>
                <Text as="p" fontWeight="bold" color="attention">Unverified proposals: {stats.unverified}</Text>
                <Text as="p" fontWeight="bold" color="success">Fields approved for write: {stats.approvedWrite}</Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <Text as="p" variant="headingSm" tone="subdued">Field Metrics</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Total Fields: {stats.total}</Text>
                <Text as="p" fontWeight="bold">Filled: <span style={{ color: "#22c55e" }}>{stats.filled}</span></Text>
                <Text as="p" fontWeight="bold">Optional blanks: <span style={{ color: "#eab308" }}>{stats.optionalBlanks}</span></Text>
                <Text as="p" fontWeight="bold" color="critical">Required missing fields: {stats.requiredMissing}</Text>
                <Text as="p" fontWeight="bold">Fields Updated (Last Run): {data.fieldsUpdated !== undefined ? data.fieldsUpdated : "Not reported"}</Text>
              </BlockStack>
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
      if (activeFilter === "All") return true;
      const meta = getFieldMetadata(k, data);
      if (activeFilter === "Blank" && (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing")) return true;
      if (activeFilter === "Proposed changes" && meta.fieldStatus === "Proposed") return true;
      if (activeFilter === "Conflicts" && (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade")) return true;
      if (activeFilter === "Needs review" && (meta.fieldStatus === "Required missing" || meta.fieldStatus === "Unverified proposal")) return true;
      if (activeFilter === meta.source) return true;
      return false;
    });

    if (filteredKeys.length === 0) return null;
    const isExpanded = expandedBays[section.title];

    return (
      <Card padding="0" key={section.title}>
        <div 
            onClick={() => toggleBay(section.title)} 
            style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none" }}
        >
          <Text as="h3" variant="headingLg" fontWeight="bold">{section.title} ({filteredKeys.length} fields)</Text>
          <Button variant="plain" icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
        </div>
        
        {isExpanded && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {filteredKeys.map((key) => {
              const meta = getFieldMetadata(key, data);
              const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";
              
              let statusTone = "info";
              if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Unverified proposal") statusTone = "attention";
              if (["Required missing", "Conflict", "Degrade", "Blocked", "Over limit", "Failed"].includes(meta.fieldStatus)) statusTone = "critical";
              if (meta.fieldStatus === "Proposed") statusTone = "success";
              if (meta.fieldStatus === "Unchanged") statusTone = "new";

              return (
                <Box key={key} padding="300" background={isBlank ? "bg-surface-warning" : "bg-surface"} borderColor="border" borderWidth="1" borderRadius="200">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                    
                    {/* Left Panel: Labels & Metadata */}
                    <div style={{ flex: "1 1 300px", minWidth: "300px" }}>
                      <BlockStack gap="100">
                        <Text as="h4" variant="headingMd" fontWeight="bold">{formatLabel(key)}</Text>
                        <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{key}</Text>
                        
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                            <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
                        </div>
                      </BlockStack>
                    </div>

                    {/* Right Panel: Current & Proposal Values */}
                    <div style={{ flex: "2 1 400px", display: "flex", flexDirection: "column", gap: "12px" }}>
                        <div style={{ padding: "12px", backgroundColor: "#f4f6f8", borderRadius: "8px", border: "1px solid #d2d5d8" }}>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value</Text>
                            <Text as="p" variant="bodyLg">{meta.currentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
                        </div>
                        
                        <div>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Bench Proposal Value</Text>
                            <TextField
                                value={meta.propVal}
                                onChange={(val) => handleRepairPlanChange(key, val)}
                                autoComplete="off"
                                multiline={isMultilineKey(key) ? 3 : undefined}
                                placeholder={meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : "")}
                            />
                        </div>
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

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "24px", alignItems: "start" }}>
        
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

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", height: "70vh", paddingRight: "4px" }}>
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
                        gap: "12px"
                      }} 
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
        <div>
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
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px" }}>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "2px solid #22c55e" }}>
                    <Text as="h3" variant="headingLg" fontWeight="bold" style={{ color: "#166534" }}>GID Lock: {selectedBenchId}</Text>
                    <div style={{ display: "flex", gap: "16px" }}>
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
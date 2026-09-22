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
    setSafetyMessage("Rack and Bench cleared.");
    setSafetyError("");
  }, []);

  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) return;
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
    if (queueIds.length === 0) return;
    if (Object.keys(manifestData).length !== queueIds.length) {
       setSafetyError("You must Generate Repair Plan (Load Data) for all queued items before executing.");
       return;
    }
    if (window.confirm("WARNING: LIVE RUN.\n\nThis will execute structural repairs (edits and deletions) on the live Shopify database for all queued items. Proceed?")) {
       setSafetyError("");
       setSafetyMessage("Structural Repair Engine engaged. Mutating live data...");
       setExecutionMode("REPAIR");
       setIsExecuting(true);
       setExecuteIndex(0);
       setTempAiData({});
    }
  }, [queueIds, manifestData]);

  const executeAIFill = useCallback(() => {
    if (queueIds.length === 0) return;
    if (Object.keys(manifestData).length !== queueIds.length) {
       setSafetyError("You must Generate Repair Plan for all queued items before running AI Batch Fill.");
       return;
    }
    if (window.confirm("WARNING: AI MULTI-STAGE PIPELINE.\n\nThis will trigger title parsing, vision scanning, and description generation sequentially for all queued items. The results will be staged locally on the bench for review. Proceed?")) {
       setSafetyError("");
       setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
       setExecutionMode("AI_BATCH_PIPELINE");
       setIsExecuting(true);
       setExecuteIndex(0);
       setAiStep(1);
       setTempAiData({});
    }
  }, [queueIds, manifestData]);

  useEffect(() => {
    if (!isExecuting) return;
    if (batchFetcher.state !== "idle") return;

    if (executeIndex >= queueIds.length) {
      setIsExecuting(false);
      setExecutionMode(null);
      setAiStep(0);
      setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items.`);
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
        fd.append("repairPlan", JSON.stringify(manifest.repairPlan));
        fd.append("legacyKeysToRemove", JSON.stringify(Object.keys(manifest.legacyFields || {})));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      }
    } 
    else if (executionMode === "AI_BATCH_PIPELINE") {
      if (aiStep === 1 && !tempAiData.titleParseRequested) {
        setTempAiData(prev => ({ ...prev, titleParseRequested: true }));
        updateProductState(currentId, STATUS.SCANNING, ["Stage 1: Parsing Title & Origin (Gemini)..."]);
        
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
                    newPlan[`custom.${k}`] = visionData[k];
                }
            });
            
            if (titleData.stone_family) newPlan["custom.stone_family"] = titleData.stone_family;
            if (titleData.piece_name) newPlan["custom.piece_name"] = titleData.piece_name;
            if (titleData.origin_handle) newPlan["custom.origin_handle"] = titleData.origin_handle;
            if (titleData.origin_page_handle) newPlan["custom.origin_page_handle"] = titleData.origin_page_handle;
            if (titleData.origin_location) newPlan["custom.origin_location"] = titleData.origin_location;
            if (titleData.collection_name) newPlan["custom.collection_name"] = titleData.collection_name;
            if (titleData.collection_location) newPlan["custom.collection_location"] = titleData.collection_location;
            if (titleData.seo_title) newPlan["custom.seo_title"] = titleData.seo_title;
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
    if (batchFetcher.state === "idle" && batchFetcher.data) {
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
  }, [batchFetcher.state, batchFetcher.data, executionMode, aiStep, executeIndex, queueIds, updateProductState, isLoadingData, isExecuting]);

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
       alert("Generate Repair Plan for this item first.");
       return;
    }
    
    const fd = new FormData();
    fd.append("intent", "executeRepairPlan");
    fd.append("pieceId", selectedBenchId);
    fd.append("repairPlan", JSON.stringify(manifest.repairPlan));
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

  const getFieldMetadata = (key, data) => {
    const hasCurrent = data.currentMetafields.hasOwnProperty(key);
    let currentVal = hasCurrent ? String(data.currentMetafields[key] || "") : "";

    if (key === "global.title_tag" || key === "shopify_title" || key === "custom.shopify_title") {
        currentVal = String(data.canonicalFields["shopify_title"] || currentVal || ""); 
    }

    const propVal = data.repairPlan[key] ?? "";
    
    let legacyKeyForCanonical = null;
    Object.entries(LEGACY_MAP).forEach(([leg, can]) => { if (can === key) legacyKeyForCanonical = leg; });
    const hasConflict = legacyKeyForCanonical && data.legacyFields[legacyKeyForCanonical] && 
                        data.legacyFields[legacyKeyForCanonical].value && currentVal && 
                        data.legacyFields[legacyKeyForCanonical].value !== currentVal;

    let fieldStatus = "Unchanged";
    if (currentVal.trim() === "" && String(propVal).trim() === "") {
        fieldStatus = "Blank";
    } else if (hasConflict) {
        fieldStatus = "Conflict";
    } else if (currentVal !== propVal && String(propVal).trim() !== "") {
        fieldStatus = "Proposed change";
    }

    const fieldMeta = data.metadata?.[key] || {};
    const source = fieldMeta.source || "Not reported";
    const stage = fieldMeta.stage || "Not reported";

    return { currentVal, propVal, fieldStatus, source, stage, hasConflict };
  };

  const getDiagnosticsStats = (data) => {
    if (!data) return null;
    let filledCount = 0;
    let blankCount = 0;
    let changesCount = 0;
    let conflictsCount = 0;
    let totalCount = 0;

    SECTIONS.forEach(sec => {
        sec.keys.forEach(k => {
            totalCount++;
            const meta = getFieldMetadata(k, data);
            if (meta.fieldStatus === "Blank") blankCount++;
            else filledCount++;

            if (meta.fieldStatus === "Proposed change") changesCount++;
            if (meta.fieldStatus === "Conflict") conflictsCount++;
        });
    });

    return {
        total: totalCount,
        filled: filledCount,
        blank: blankCount,
        changes: changesCount,
        conflicts: conflictsCount
    };
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
          "global.description_tag", "custom.origin_story", "custom.generated_description",
          "custom.artist_notes", "custom.bench_notes", "custom.alt_text"
      ];

      let summary = {
          "total fields": 0,
          "loaded fields": 0,
          "blank fields": 0,
          "proposed changes": 0,
          "conflicts": 0,
          "aliases": 0,
          "optional blanks": 0,
          "required missing fields": 0,
          "over-limit text fields": 0,
          "integration-owned fields": 0,
          "fields updated": data.fieldsUpdated !== undefined ? data.fieldsUpdated : 0,
          "legacy fields removed": Object.keys(data.legacyFields || {}).length,
          "read-back status": data.metadata?.read_back || "Not reported"
      };

      const fieldsByStatus = {
          unchanged: [],
          proposed: [],
          conflict: [],
          optionalBlank: [],
          requiredMissing: [],
          alias: [],
          integrationOwned: [],
          overLimit: []
      };

      const fieldsBySource = {
          "Shopify": [],
          "Gemini": [],
          "Vision": [],
          "Geo Library": [],
          "Derived": [],
          "Manual": [],
          "Not reported": []
      };

      SECTIONS.forEach(sec => {
          sec.keys.forEach(key => {
              summary["total fields"]++;
              const meta = getFieldMetadata(key, data);
              
              const isLong = longTextFields.includes(key);
              const currentStr = meta.currentVal || "";
              const propStr = meta.propVal || "";
              const currentCount = currentStr.length;
              const propCount = propStr.length;
              
              const isOverLimit = isLong ? (currentCount > 100000 || propCount > 100000) : (currentCount > 255 || propCount > 255);
              const isBlank = meta.fieldStatus === "Blank";
              const isRequired = ["global.title_tag", "custom.shopify_title", "custom.price"].includes(key);
              const isIntegrationOwned = key.startsWith("google.") || key.startsWith("shopify.");
              const isAlias = Object.keys(LEGACY_MAP).includes(key) || Object.values(LEGACY_MAP).includes(key);

              if (isOverLimit) summary["over-limit text fields"]++;
              if (isIntegrationOwned) summary["integration-owned fields"]++;
              if (isAlias) summary["aliases"]++;

              const record = {
                  "namespace/key": key,
                  "status": meta.fieldStatus,
                  "source": meta.source,
                  "stage": meta.stage,
                  "current value present": currentStr.trim().length > 0,
                  "proposed value present": propStr.trim().length > 0,
                  "current character count": currentCount,
                  "proposed character count": propCount,
                  "over-limit": isOverLimit
              };

              if (!isLong) {
                  record["current value"] = currentStr;
                  record["proposed value"] = propStr;
              }

              if (meta.fieldStatus === "Unchanged") fieldsByStatus.unchanged.push(record);
              if (meta.fieldStatus === "Proposed change") {
                  fieldsByStatus.proposed.push(record);
                  summary["proposed changes"]++;
              }
              if (meta.fieldStatus === "Conflict") {
                  fieldsByStatus.conflict.push(record);
                  summary["conflicts"]++;
              }
              
              if (isBlank) {
                  summary["blank fields"]++;
                  if (isRequired) {
                      fieldsByStatus.requiredMissing.push(record);
                      summary["required missing fields"]++;
                  } else {
                      fieldsByStatus.optionalBlank.push(record);
                      summary["optional blanks"]++;
                  }
              } else {
                  summary["loaded fields"]++;
              }

              if (isAlias) fieldsByStatus.alias.push(record);
              if (isIntegrationOwned) fieldsByStatus.integrationOwned.push(record);
              if (isOverLimit) fieldsByStatus.overLimit.push(record);

              const srcBucket = fieldsBySource[meta.source] ? meta.source : "Not reported";
              fieldsBySource[srcBucket].push(record);
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
          fieldsByStatus,
          fieldsBySource
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
    
    // Attempting to extract global API status from data if available
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
              <Text as="p" variant="headingSm" tone="subdued">Field Metrics</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Total Fields: {stats.total}</Text>
                <Text as="p" fontWeight="bold">Filled: <span style={{ color: "#22c55e" }}>{stats.filled}</span></Text>
                <Text as="p" fontWeight="bold">Blank: <span style={{ color: "#eab308" }}>{stats.blank}</span></Text>
              </BlockStack>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <Text as="p" variant="headingSm" tone="subdued">Repair Engine</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Proposed Changes: <span style={{ color: "#005bd3" }}>{stats.changes}</span></Text>
                <Text as="p" fontWeight="bold">Conflicts Detected: <span style={{ color: "#ef4444" }}>{stats.conflicts}</span></Text>
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
      if (activeFilter === "Blank" && meta.fieldStatus === "Blank") return true;
      if (activeFilter === "Proposed changes" && meta.fieldStatus === "Proposed change") return true;
      if (activeFilter === "Conflicts" && meta.fieldStatus === "Conflict") return true;
      if (activeFilter === "Needs review" && meta.fieldStatus === "Needs review") return true;
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
              const isBlank = meta.fieldStatus === "Blank";
              
              let statusTone = "info";
              if (isBlank) statusTone = "attention";
              if (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Failed") statusTone = "critical";
              if (meta.fieldStatus === "Proposed change") statusTone = "success";
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
                                placeholder={isBlank ? "Blank" : ""}
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
                      disabled={queueIds.length === 0 || isExecuting || isLoadingData}
                      loading={isLoadingData}
                    >
                      GENERATE REPAIR PLAN (LOAD DATA)
                    </Button>
                    
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="critical" 
                      onClick={executeRepairs} 
                      disabled={queueIds.length === 0 || Object.keys(manifestData).length === 0 || isLoadingData}
                      loading={isExecuting && executionMode === "REPAIR"}
                    >
                      EXECUTE REPAIRS (LIVE)
                    </Button>

                    <Button 
                      size="large" 
                      variant="primary" 
                      icon={MagicIcon}
                      onClick={executeAIFill} 
                      disabled={queueIds.length === 0 || Object.keys(manifestData).length === 0 || isLoadingData}
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
                  
                  <Button size="large" icon={ClipboardIcon} onClick={() => {
                    const payload = {
                      selectedBenchId,
                      productStates,
                      fetcherState: batchFetcher.state,
                      fetcherData: batchFetcher.data,
                    };
                    navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
                      .then(() => {
                        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Global Telemetry Copied!");
                        else alert("Global Telemetry Copied!");
                      })
                      .catch(err => console.error(err));
                  }}>
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
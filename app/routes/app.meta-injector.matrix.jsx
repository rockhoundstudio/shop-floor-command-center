import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon } from "@shopify/polaris-icons";
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
    title: "Section 1 — Core Ignition (GREEN)",
    keys: [
      "global.title_tag", "global.description_tag", "custom.seo_title",
      "custom.is_ooak", "custom.is_one_of_a_kind", "custom.handcrafted_by", 
      "custom.piece_name", "custom.origin_story", "custom.origin_location", 
      "custom.origin_page_handle", "custom.origin_handle", "custom.honest_flaws_and_character", 
      "custom.collection_name", "custom.collection_location", "custom.collection_date"
    ]
  },
  {
    title: "Section 2 — Maker, Collector & Geo-Vault (BLUE)",
    keys: [
      "custom.mohs_hardness", "custom.rock_composition", "custom.rock-composition",
      "custom.rock_formation", "custom.rock-formation", "custom.geological_era",
      "custom.geological-era", "custom.geological_age", "custom.crystal_system",
      "custom.crystal-system", "custom.specific_gravity", "custom.cleavage",
      "custom.diaphaneity", "custom.fracture_pattern", "custom.mineral_class",
      "custom.mineral-class", "custom.stone_family", "custom.stone_shape",
      "custom.surface_finish", "custom.cut_and_shape", "custom.dimensions_mm",
      "custom.weight_grams", "custom.shipping_weight_oz", "custom.treatment_status",
      "custom.treated", "custom.color", "custom.color_pattern", "custom.primary_color", 
      "custom.primary_medium", "custom.secondary_medium", "custom.material", 
      "custom.primary_use", "custom.setting_ready", "custom.wire_material", 
      "custom.bail_included", "custom.chain_link_type", "custom.necklace_design", 
      "custom.necklace-design", "custom.jewelry_type", "custom.jewelry_finding_type", 
      "custom.custom_product", "custom.found_object", "custom.rescued_by", 
      "custom.authenticity", "custom.rarity", "custom.luster", "custom.character_marks", 
      "custom.artist_notes", "custom.generated_description", "custom.price", 
      "custom.alt_text"
    ]
  },
  {
    title: "Section 3 — Shopify & Google Channels (GRAY)",
    keys: [
      "google.age_group", "google.condition", "google.target_gender",
      "shopify.age-group", "shopify.condition", "shopify.target-gender",
      "shopify.authenticity", "shopify.chain-link-type", "shopify.color-pattern",
      "shopify.construction", "shopify.crystal-system", "shopify.geological-era",
      "shopify.jewelry-finding-type", "shopify.jewelry-material",
      "shopify.jewelry-type", "shopify.material", "shopify.material-origin",
      "shopify.mineral-class", "shopify.necklace-design",
      "shopify.product-classification", "shopify.product-use", "shopify.rarity",
      "shopify.rock-composition", "shopify.rock-formation",
      "custom.google_product_category", "custom.target_gender",
      "mc-facebook.google_product_category", "mm-google-shopping.age_group",
      "mm-google-shopping.condition", "mm-google-shopping.custom_product",
      "mm-google-shopping.google_product_category",
      "app--3890849--eligibility.eligibility_details"
    ]
  },
  {
    title: "Section 4 — Internal Bench & Legacy (BLACK)",
    keys: [
      "custom.bench_notes", "custom.badge", "custom.widget",
      "custom.review_widget_data", "judgeme.badge", "judgeme.widget",
      "judgeme.review_widget_data"
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
  "is_one_of_a_kind": "is_ooak"
};

export function OperationsMatrixTab({ products }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data Loading State
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadIndex, setLoadIndex] = useState(0);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState(null); // "REPAIR" or "AI_BATCH_PIPELINE"
  const [executeIndex, setExecuteIndex] = useState(0);
  const [aiStep, setAiStep] = useState(0); // 0 = Idle, 1 = Title, 2 = Vision, 3 = Desc, 4 = Stage
  const [tempAiData, setTempAiData] = useState({});

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

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

  // --- THE FETCH / MANIFEST BUILDER ---
  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) return;
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

  // Load Loop
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

  // --- LIVE EXECUTION LOOPS ---
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

  // Primary Execution Loop (Repairs & AI Pipeline)
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
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
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
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
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
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
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

  // --- FETCHER RESPONSE HANDLER (LOAD OR EXECUTE) ---
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data) {
      const { intent, success, pieceId, message, error, errors, logs, finalStatus, titleParse, tab2Data, generated_description } = batchFetcher.data;
      
      // 1. Load Data Response
      if (intent === "loadProductData" && pieceId) {
         if (!success) {
            updateProductState(pieceId, STATUS.FAILED, [error || message || "Failed to load data"]);
         } else {
            setManifestData(prev => ({ ...prev, [pieceId]: batchFetcher.data }));
            updateProductState(pieceId, STATUS.VALIDATED, ["Data Loaded. Manifest Built."]);
         }
         if (isLoadingData) setTimeout(() => setLoadIndex(i => i + 1), 100);
      }

      // 2. Legacy / Repair Executions
      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && pieceId && executionMode !== "AI_BATCH_PIPELINE") {
        if (!success) {
           console.error("Execute Error from Backend:", batchFetcher.data);
           setIsExecuting(false);
           const errMsg = errors ? errors[0]?.message : (error || (logs && logs[logs.length-1]) || "Unknown Error");
           setSafetyError(`Engine halted on ${pieceId}. Error: ${errMsg}`);
           updateProductState(pieceId, STATUS.FAILED, errors ? errors.map(e => e.message) : (logs || ["Unknown Backend Error"]));
           return;
        }
        
        const successLogs = logs || [message || "Operation applied successfully."];
        const statusToSet = finalStatus === "Needs Review" ? STATUS.FAILED : STATUS.COMPLETE;
        updateProductState(pieceId, statusToSet, successLogs);
        
        if (isExecuting) {
           setTempAiData({});
           setTimeout(() => setExecuteIndex(i => i + 1), 500);
        }
      }

      // 3. Multi-Stage AI Batch Pipeline Handler
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

  // --- MANUAL OVERRIDES & GLOBAL TELEMETRY ---
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
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
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

  const getIndicatorColor = (status) => {
    if (status === "LOADED") return "#22c55e";
    if (status === "EMPTY") return "#eab308";
    if (status === "MISSING" || status === "CONFLICT") return "#ef4444";
    return "transparent";
  };

  const renderManifestTable = (sectionTitle, sectionKeys) => {
    const data = manifestData[selectedBenchId];
    if (!data || !sectionKeys || sectionKeys.length === 0) return null;

    const items = sectionKeys.map(k => {
       let status = "MISSING";
       
       const hasCurrent = data.currentMetafields.hasOwnProperty(k);
       let currentVal = hasCurrent ? String(data.currentMetafields[k] || "") : "";

       if (k === "global.title_tag" || k === "shopify_title") {
           currentVal = String(data.canonicalFields["shopify_title"] || currentVal || ""); 
           status = currentVal.trim() === "" ? "EMPTY" : "LOADED";
       } else if (hasCurrent) {
           status = currentVal.trim() === "" ? "EMPTY" : "LOADED";
       }

       let legacyKeyForCanonical = null;
       Object.entries(LEGACY_MAP).forEach(([leg, can]) => { if (can === k) legacyKeyForCanonical = leg; });

       if (legacyKeyForCanonical && data.legacyFields[legacyKeyForCanonical]) {
          const legacyVal = data.legacyFields[legacyKeyForCanonical].value;
          if (legacyVal && currentVal && legacyVal !== currentVal) {
             status = "CONFLICT";
          }
       }

       return {
          key: k,
          current: currentVal,
          status: status,
          propVal: data.repairPlan[k] ?? ""
       };
    });

    return (
      <BlockStack gap="300" key={sectionTitle}>
        <Text as="h4" variant="headingSm" fontWeight="bold" tone="subdued" style={{ borderBottom: "2px solid #e1e3e5", paddingBottom: "4px" }}>
          {sectionTitle}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 100px 2fr', gap: '10px', padding: '0 8px', fontWeight: 'bold', fontSize: '12px', color: '#5c5f62' }}>
            <div></div>
            <div>Field Key</div>
            <div>Current Value</div>
            <div>Status</div>
            <div>Repair Plan (Editable)</div>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 100px 2fr', gap: '10px', padding: '8px', backgroundColor: (item.status === "MISSING" || item.status === "CONFLICT") ? "#fef2f2" : item.status === "EMPTY" ? "#fefce8" : "#f0fdf4", border: `1px solid ${getIndicatorColor(item.status)}`, borderRadius: '6px', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill={getIndicatorColor(item.status)} />
              </svg>
              <Text as="span" variant="bodySm" fontWeight="bold">{item.key}</Text>
              
              <div style={{ maxHeight: "60px", overflowY: "auto" }}>
                 <Text as="span" variant="bodySm">{item.current || "—"}</Text>
              </div>

              <Badge tone={item.status === "MISSING" || item.status === "CONFLICT" ? "critical" : item.status === "EMPTY" ? "attention" : "success"}>
                {item.status}
              </Badge>

              <TextField
                 value={item.propVal}
                 onChange={(val) => handleRepairPlanChange(item.key, val)}
                 autoComplete="off"
                 multiline={item.key === "custom.generated_description" || item.key === "custom.origin_story" ? 2 : undefined}
              />
            </div>
          ))}
        </div>
      </BlockStack>
    );
  };

  const renderLegacyTable = () => {
    const data = manifestData[selectedBenchId];
    if (!data || !data.legacyFields || Object.keys(data.legacyFields).length === 0) return null;

    return (
      <BlockStack gap="300">
        <Text as="h4" variant="headingSm" fontWeight="bold" tone="subdued" style={{ borderBottom: "2px solid #e1e3e5", paddingBottom: "4px" }}>
          Legacy Keys (Marked for Deletion)
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 100px 2fr', gap: '10px', padding: '0 8px', fontWeight: 'bold', fontSize: '12px', color: '#5c5f62' }}>
            <div></div>
            <div>Legacy Key</div>
            <div>Legacy Value</div>
            <div>Status</div>
            <div>Target Canonical</div>
          </div>
          {Object.entries(data.legacyFields).map(([legKey, legData], i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 100px 2fr', gap: '10px', padding: '8px', backgroundColor: "#fefce8", border: "1px solid #eab308", borderRadius: '6px', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill="#eab308" />
              </svg>
              <Text as="span" variant="bodySm" fontWeight="bold">{legKey}</Text>
              <Text as="span" variant="bodySm" truncate>{legData.value}</Text>
              <Badge tone="attention">LEGACY</Badge>
              <Text as="span" variant="bodySm" tone="subdued">Moves to: {legData.canonicalTarget}</Text>
            </div>
          ))}
        </div>
      </BlockStack>
    );
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <div>
          <Card padding="300">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory ({queueIds.length})</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search..."
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
                        border: isSelectedForBench ? "2px solid #005bd3" : "1px solid #c9cccf", 
                        borderRadius: "6px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isLoadingData || isExecuting ? "not-allowed" : "pointer", 
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }} 
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <div style={{ width: "40px", height: "40px", backgroundColor: "#2a2a2a", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                          {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <Text as="p" variant="bodySm" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                          <Badge tone={getStatusTone(currentStatus)} size="small">{currentStatus}</Badge>
                        </div>
                      </div>

                      <Button 
                        size="micro" 
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
            <Text variant="headingLg" as="h2">2. Repair Bench & Engine Diagnostics</Text>

            {safetyMessage && (
              <Banner tone="info" onDismiss={() => setSafetyMessage("")}>
                <Text as="p">{safetyMessage}</Text>
              </Banner>
            )}
            {safetyError && (
              <Banner tone="critical" onDismiss={() => setSafetyError("")}>
                <Text as="p">{safetyError}</Text>
              </Banner>
            )}

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Repair Engine Orchestrator</Text>
                  <div style={{ display: "flex", gap: "8px" }}>
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
                      EXECUTE AI AUTO-FILL (STAGE ON BENCH)
                    </Button>
                  </div>
                </InlineStack>

                <Banner tone="warning">
                  <Text as="p"><strong>Structural Repairs</strong> writes your edited Local Repair Plan to Shopify. <strong>AI Auto-Fill</strong> spins up Gemini to generate missing data and stages it below for you to review before writing.</Text>
                </Banner>

                {(isExecuting || isLoadingData) && queueIds.length > 0 && (
                  <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" fontWeight="bold">{isLoadingData ? "Fetching Live Data..." : "Live Execution Progress"}</Text>
                        <Text as="p">{isLoadingData ? loadIndex : executeIndex} of {queueIds.length} Processed</Text>
                      </InlineStack>
                      <ProgressBar progress={progressPercentage} color="primary" />
                    </BlockStack>
                  </Box>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
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

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Text variant="headingLg" as="h2">Diagnostic Manifest Readout</Text>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="#22c55e" /></svg><Text variant="bodySm">Loaded</Text>
                      <svg width="12" height="12" style={{ marginLeft: "8px" }}><circle cx="6" cy="6" r="6" fill="#eab308" /></svg><Text variant="bodySm">Empty</Text>
                      <svg width="12" height="12" style={{ marginLeft: "8px" }}><circle cx="6" cy="6" r="6" fill="#ef4444" /></svg><Text variant="bodySm">Missing / Conflict</Text>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {selectedBenchId && (
                      <Button 
                        size="medium" 
                        variant="primary" 
                        icon={MagicIcon} 
                        onClick={handleExecuteSingleAI}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                      >
                        Run AI (Legacy Single)
                      </Button>
                    )}
                    {selectedBenchId && (
                      <Button 
                        size="medium" 
                        variant="primary" 
                        icon={SaveIcon} 
                        onClick={handleExecuteSingleRepair}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                        tone="success"
                      >
                        Execute Structural Repair
                      </Button>
                    )}
                  </div>

                </InlineStack>
                
                {!selectedBenchId || !manifestData[selectedBenchId] ? (
                  <Box padding="800" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" alignment="center" tone="subdued">Load inventory, hit GENERATE REPAIR PLAN, then drop a piece on the bench to view its diagnostic readout.</Text>
                  </Box>
                ) : (
                  <BlockStack gap="600">
                    <Text as="h3" variant="headingMd" color="success">GID Lock: {selectedBenchId}</Text>
                    
                    {renderLegacyTable()}
                    {SECTIONS.map(sec => renderManifestTable(sec.title, sec.keys))}
                    
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
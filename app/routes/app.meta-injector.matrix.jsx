import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon, SparklesIcon } from "@shopify/polaris-icons";
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
  { title: "Section 1 — Core Ignition", keys: ["shopify_title", "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_ooak", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price", "character_marks", "bench_notes", "alt_text", "found_object", "stone_family", "treatment_status"] },
  { title: "Section 2 — Human Engine", keys: ["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character", "origin_location", "origin_page_handle"] },
  { title: "Section 3 — Google Machine", keys: ["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "target_gender", "age_group", "condition", "custom_product", "seo_title", "google_product_category", "primary_color", "rarity", "authenticity", "jewelry_finding_type", "chain_link_type"] },
  { title: "Section 4 — Geo-Vault", keys: ["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"] }
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
  const [executionMode, setExecutionMode] = useState(null); // "REPAIR" or "AI_FILL"
  const [executeIndex, setExecuteIndex] = useState(0);

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
    }
  }, [queueIds, manifestData]);

  const executeAIFill = useCallback(() => {
    if (queueIds.length === 0) return;
    if (Object.keys(manifestData).length !== queueIds.length) {
       setSafetyError("You must Generate Repair Plan for all queued items before running AI Batch Fill.");
       return;
    }
    if (window.confirm("WARNING: AI BATCH RUN.\n\nThis will trigger the Gemini AI vision scan for all queued items to fill MISSING fields. Proceed?")) {
       setSafetyError("");
       setSafetyMessage("AI Engine engaged. Generating missing data...");
       setExecutionMode("AI_FILL");
       setIsExecuting(true);
       setExecuteIndex(0);
    }
  }, [queueIds, manifestData]);

  useEffect(() => {
    if (!isExecuting) return;
    if (batchFetcher.state !== "idle") return;

    if (executeIndex >= queueIds.length) {
      setIsExecuting(false);
      setExecutionMode(null);
      setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items.`);
      return;
    }

    const currentId = queueIds[executeIndex];
    const manifest = manifestData[currentId];

    if (!manifest) {
      updateProductState(currentId, STATUS.SKIPPED, ["No manifest built."]);
      setTimeout(() => setExecuteIndex(i => i + 1), 500);
      return;
    }

    if (executionMode === "REPAIR") {
      updateProductState(currentId, STATUS.SCANNING, ["Executing structural repairs..."]);
      const fd = new FormData();
      fd.append("intent", "executeRepairPlan");
      fd.append("pieceId", currentId);
      fd.append("repairPlan", JSON.stringify(manifest.repairPlan));
      fd.append("legacyKeysToRemove", JSON.stringify(Object.keys(manifest.legacyFields || {})));
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    } else if (executionMode === "AI_FILL") {
      updateProductState(currentId, STATUS.SCANNING, ["Spinning up Gemini AI..."]);
      const fd = new FormData();
      fd.append("intent", "batchAuditItem");
      fd.append("pieceId", currentId);
      fd.append("runMode", "LIVE_RUN");
      fd.append("explicitConfirm", "true");
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    }

  }, [isExecuting, executionMode, executeIndex, queueIds, manifestData, batchFetcher.state, updateProductState]);

  // --- FETCHER RESPONSE HANDLER (LOAD OR EXECUTE) ---
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data) {
      const { intent, success, pieceId, message, error, errors, logs, finalStatus } = batchFetcher.data;
      
      if (intent === "loadProductData" && pieceId) {
         if (!success) {
            updateProductState(pieceId, STATUS.FAILED, [error || message || "Failed to load data"]);
         } else {
            setManifestData(prev => ({
               ...prev,
               [pieceId]: batchFetcher.data
            }));
            updateProductState(pieceId, STATUS.VALIDATED, ["Data Loaded. Manifest Built."]);
         }
         if (isLoadingData) {
            setTimeout(() => setLoadIndex(i => i + 1), 100);
         }
      }

      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && pieceId) {
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
           setTimeout(() => setExecuteIndex(i => i + 1), 500);
        }
      }
    }
  }, [batchFetcher.state, batchFetcher.data, updateProductState, isLoadingData, isExecuting]);

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

    updateProductState(selectedBenchId, STATUS.SCANNING, ["Spinning up Gemini AI..."]);
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
       
       // Handle namespacing check
       const nsKeyGlobal = `global.${k}`;
       const nsKeyGoogle = `google.${k}`;
       const nsKeyCustom = `custom.${k}`;
       
       const hasCustom = data.currentMetafields.hasOwnProperty(nsKeyCustom);
       const hasGlobal = data.currentMetafields.hasOwnProperty(nsKeyGlobal);
       const hasGoogle = data.currentMetafields.hasOwnProperty(nsKeyGoogle);

       const hasCurrent = hasCustom || hasGlobal || hasGoogle;
       
       // Priority read: global/google -> custom
       let currentVal = "";
       if (hasGlobal) currentVal = String(data.currentMetafields[nsKeyGlobal]);
       else if (hasGoogle) currentVal = String(data.currentMetafields[nsKeyGoogle]);
       else if (hasCustom) currentVal = String(data.currentMetafields[nsKeyCustom]);
       else if (k === "shopify_title" || k === "price") {
           currentVal = data.canonicalFields[k]; 
       }

       if (hasCurrent || k === "shopify_title" || k === "price") {
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
                 multiline={item.key === "generated_description" || item.key === "origin_story" ? 2 : undefined}
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
                      icon={SparklesIcon}
                      onClick={executeAIFill} 
                      disabled={queueIds.length === 0 || Object.keys(manifestData).length === 0 || isLoadingData}
                      loading={isExecuting && executionMode === "AI_FILL"}
                    >
                      EXECUTE AI AUTO-FILL (LIVE)
                    </Button>
                  </div>
                </InlineStack>

                <Banner tone="warning">
                  <Text as="p"><strong>Structural Repairs</strong> writes your edited Local Repair Plan to Shopify. <strong>AI Auto-Fill</strong> spins up Gemini to permanently generate and write new data for fields marked as MISSING.</Text>
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
                        icon={SparklesIcon} 
                        onClick={handleExecuteSingleAI}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                      >
                        Run AI (Fill Missing)
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
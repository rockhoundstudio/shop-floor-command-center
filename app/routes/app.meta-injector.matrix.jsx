import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
import { useFetcher } from "react-router";
import { MagicIcon } from "@shopify/polaris-icons";
import { FULL_META_GROUPS, DROPDOWN_OPTIONS } from "../utils/meta-injector.constants.jsx";

const CUSTOM_FIELDS = [
  { key: "shopify_title", label: "MASTER SHOPIFY TITLE (Edit Here)", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field" },
  { key: "color", label: "Color", type: "single_line_text_field" }, 
  { key: "surface_finish", label: "Surface Finish", type: "single_line_text_field" }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", type: "single_line_text_field" }, 
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "origin_story", label: "The Origin Story", type: "multi_line_text_field" },
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut / Shape", type: "single_line_text_field" }, 
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "single_line_text_field" },
  { key: "honest_flaws_and_character", label: "Character Marks (Honest Flaws)", type: "multi_line_text_field" },
  { key: "price", label: "Price", type: "single_line_text_field" },
  { key: "generated_description", label: "Generated Description", type: "multi_line_text_field" }
];

const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  NEEDS_REVIEW: "Needs Review",
  VALIDATED: "Validated",
  COMPLETE: "Complete",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

const VERIFIED_SKIP_LIST = [
  { id: "gid://shopify/Product/REPLACE_WITH_CREEK_FIND_GID", reason: "The Creek Find is permanently set to photos-check-only." },
  { id: "gid://shopify/Product/REPLACE_WITH_SUNRISE_GID", reason: "The Sunrise is locked pending structural state bug fix." }
];

const SECTIONS = [
  { title: "Section 1 — Core Ignition", keys: ["shopify_title", "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_ooak", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price", "character_marks", "bench_notes", "alt_text", "found_object", "stone_family", "treatment_status"] },
  { title: "Section 2 — Human Engine", keys: ["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character", "origin_location", "origin_page_handle"] },
  { title: "Section 3 — Google Machine", keys: ["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "target_gender", "age_group", "condition", "custom_product", "seo_title", "google_product_category", "primary_color", "rarity", "authenticity", "jewelry_finding_type", "chain_link_type"] },
  { title: "Section 4 — Geo-Vault", keys: ["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"] }
];

export function OperationsMatrixTab({ products, fetcher }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- Batch Orchestrator State ---
  const [runMode, setRunMode] = useState("DRY_RUN"); 
  const [isOrchestratorActive, setIsOrchestratorActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [queueIds, setQueueIds] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [productStates, setProductStates] = useState({}); 
  
  // --- Visual Bench (Mass Formatter) State ---
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [benchState, setBenchState] = useState({}); // Holds the editable text values
  const [pushKeys, setPushKeys] = useState([]); // Holds the keys of the checked boxes

  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  const batchFetcher = useFetcher();

  // --- Visual Bench Data Extractor ---
  const extractCurrentMeta = useCallback((product, key) => {
    if (key === "shopify_title") return product?.title || "";
    if (!product) return "";
    
    const allEdges = [
      ...(product?.customMeta?.edges || []),
      ...(product?.rockhoundMeta?.edges || []),
      ...(product?.geoMeta?.edges || []),
      ...(product?.metafields?.edges || [])
    ];
    
    const node = allEdges.find(e => e.node.key === key)?.node;
    if (!node || node.value === null || node.value === undefined) return "";
    
    let val = String(node.value);
    if (val.includes("gid://")) val = "See Shopify metaobject";
    if (val.startsWith("[")) {
      try {
        const arr = JSON.parse(val);
        val = Array.isArray(arr) ? arr[0] : val;
      } catch (e) { }
    }
    return val;
  }, []);

  // --- Load a product to the Editable Bench ---
  const loadToBench = useCallback((id) => {
    setSelectedBenchId(id);
    const product = safeProducts.find(p => p.id === id);
    const newBenchState = {};
    SECTIONS.forEach(sec => {
      sec.keys.forEach(key => {
        newBenchState[key] = extractCurrentMeta(product, key);
      });
    });
    setBenchState(newBenchState);
    setPushKeys([]); // Clear checkboxes so you don't accidentally push old fields
  }, [safeProducts, extractCurrentMeta]);

  const clearBench = useCallback(() => {
    setQueueIds([]);
    setQueueIndex(0);
    setProductStates({});
    setSelectedBenchId(null);
    setBenchState({});
    setPushKeys([]);
    setIsOrchestratorActive(false);
    setIsPaused(false);
    setSafetyMessage("Rack & Bench cleared.");
  }, []);

  // --- Telemetry Diagnostics ---
  const handleCopyTelemetry = useCallback(() => {
    if (!selectedBenchId) return;
    const product = safeProducts.find(p => p.id === selectedBenchId);
    navigator.clipboard.writeText(JSON.stringify(product, null, 2))
      .then(() => {
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Telemetry copied to clipboard!");
        } else {
          alert("Telemetry copied to clipboard!");
        }
      })
      .catch(err => console.error("Failed to copy:", err));
  }, [selectedBenchId, safeProducts]);

  // --- Search & Filtering ---
  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  // --- Rack Queue Selection ---
  const handleToggleProductSelection = useCallback((id) => {
    if (isOrchestratorActive && !isPaused) return; 
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        return newStates;
      });
      return newIds;
    });
  }, [isOrchestratorActive, isPaused]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isOrchestratorActive && !isPaused) return;
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
  }, [allFilteredSelected, filteredProducts, isOrchestratorActive, isPaused]);

  // --- The Batch State Machine ---
  const startBatch = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("No products loaded on the rack.");
      return;
    }
    if (pushKeys.length === 0) {
      setSafetyError("No fields checked. You must check the boxes next to the fields you want to mass-format.");
      return;
    }
    if (runMode === "LIVE_RUN") {
      setSafetyError("LIVE RUN is locked pending API verification. Switching to Dry Run.");
      setRunMode("DRY_RUN");
      return;
    }
    
    setSafetyError("");
    setSafetyMessage(`Mass Formatter started in ${runMode} mode.`);
    setIsOrchestratorActive(true);
    setIsPaused(false);
  }, [queueIds.length, pushKeys.length, runMode]);

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = { status: status, logs: [...existingLogs, ...newLogs] };
      return updated;
    });
  }, []);

  // --- Core Processing Loop ---
  useEffect(() => {
    if (!isOrchestratorActive || isPaused) return;
    if (batchFetcher.state !== "idle") return; 

    if (queueIndex >= queueIds.length) {
      setIsOrchestratorActive(false);
      setIsPaused(false);
      setSafetyMessage(`Mass Format (${runMode}) Complete.`);
      return;
    }

    const currentId = queueIds[queueIndex];
    const currentProduct = safeProducts.find(p => p.id === currentId);
    const currentState = productStates[currentId]?.status;

    if (currentState === STATUS.QUEUED) {
      const skipRule = VERIFIED_SKIP_LIST.find(skip => skip.id === currentId);
      if (skipRule) {
        updateProductState(currentId, STATUS.SKIPPED, [`Skipped: ${skipRule.reason}`]);
        setTimeout(() => setQueueIndex(i => i + 1), 500);
        return;
      }
      
      updateProductState(currentId, STATUS.SCANNING, ["Applying template fields..."]);
      
      // In a real live run, this would compile the benchState[keys] in pushKeys and send it to the save intent.
      // For now, it acts as a Dry Run diagnostic simulator.
      const fd = new FormData();
      fd.append("intent", "standardizeBatchItem"); 
      fd.append("pieceId", currentId);
      fd.append("runMode", runMode); 
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      return;
    }
  }, [isOrchestratorActive, isPaused, queueIndex, queueIds, productStates, batchFetcher.state, safeProducts, runMode, updateProductState, pushKeys, benchState]);

  // --- Listen to API Responses ---
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data) {
      const { intent, success, pieceId, finalStatus, logs = [] } = batchFetcher.data;
      if (intent === "standardizeBatchItem" && pieceId) {
        const appliedStatus = finalStatus || (success ? STATUS.VALIDATED : STATUS.FAILED);
        updateProductState(pieceId, appliedStatus, logs);
        setTimeout(() => setQueueIndex(prev => prev + 1), 800);
      }
    }
  }, [batchFetcher.state, batchFetcher.data, updateProductState]);

  // --- Visual Bench Field Renderer ---
  const renderVisualBenchField = (key) => {
    if (!selectedBenchId) return null;
    
    let fieldConfig = null;
    for (const group of FULL_META_GROUPS || []) {
      const found = group.fields.find(f => f.key === key);
      if (found) { fieldConfig = found; break; }
    }
    if (!fieldConfig) fieldConfig = CUSTOM_FIELDS?.find(f => f.key === key);
    if (!fieldConfig) fieldConfig = { key, label: key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), type: 'text' };

    const isChecked = pushKeys.includes(key);
    const val = benchState[key] || "";

    const labelNode = (
      <div style={{ display: 'flex', alignItems: 'center', paddingBottom: "4px" }} onClick={(e) => e.stopPropagation()}>
        <input 
          type="checkbox" 
          checked={isChecked}
          onChange={(e) => {
            if (e.target.checked) setPushKeys(prev => [...prev, key]);
            else setPushKeys(prev => prev.filter(k => k !== key));
          }}
          style={{ width: "18px", height: "18px", marginRight: "8px", cursor: "pointer", accentColor: "#005bd3" }}
        />
        <span style={{ fontSize: '13px', fontWeight: 'bold', color: isChecked ? "#005bd3" : "#202223" }}>
          {fieldConfig.label}
        </span>
      </div>
    );

    return (
      <div key={key} style={{ backgroundColor: isChecked ? "#e8f4fc" : "transparent", padding: "8px", borderRadius: "6px", border: isChecked ? "2px solid #005bd3" : "1px solid transparent" }}>
        {fieldConfig.type !== "text" && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[key] && DROPDOWN_OPTIONS[key].length > 0 ? (
          <Select 
            label={labelNode} 
            options={[{ label: "Select...", value: "" }, ...DROPDOWN_OPTIONS[key]]} 
            value={val} 
            onChange={(v) => setBenchState(prev => ({ ...prev, [key]: v }))} 
          />
        ) : (
          <TextField 
            label={labelNode} 
            value={val} 
            onChange={(v) => setBenchState(prev => ({ ...prev, [key]: v }))} 
            multiline={fieldConfig.multiline || key.includes("story") || key.includes("notes") || key.includes("character") ? 3 : false} 
            autoComplete="off" 
          />
        )}
      </div>
    );
  };

  const getStatusTone = (status) => {
    switch(status) {
      case STATUS.COMPLETE:
      case STATUS.VALIDATED: return "success";
      case STATUS.FAILED: return "critical";
      case STATUS.NEEDS_REVIEW: return "warning";
      case STATUS.SKIPPED: return "info";
      case STATUS.SCANNING:
      case STATUS.SAVING: return "magic";
      default: return undefined;
    }
  };

  const progressPercentage = queueIds.length > 0 ? Math.round((queueIndex / queueIds.length) * 100) : 0;

  return (
    <BlockStack gap="600">
      {/* SHRUNK RACK COLUMN TO 260px TO FIT SIDEKICK */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: The Rack */}
        <div>
          <Card padding="300">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">The Rack ({queueIds.length})</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search..."
                disabled={isOrchestratorActive && !isPaused}
              />

              <Button 
                size="large" 
                fullWidth 
                onClick={toggleSelectAllFiltered}
                disabled={isOrchestratorActive && !isPaused}
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
                        cursor: isOrchestratorActive && !isPaused ? "not-allowed" : "pointer", 
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
                        onClick={(e) => { e.stopPropagation(); loadToBench(p.id); }}
                      >
                        Drop on Bench
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Standardizer Controls & Editable Bench */}
        <div>
          <BlockStack gap="600">
            
            {/* The Wrench (Orchestrator Controls) */}
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Mass Formatter Engine</Text>
                
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

                <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold">Format Progress</Text>
                      <Text as="p">{queueIndex} of {queueIds.length} Processed</Text>
                    </InlineStack>
                    <ProgressBar progress={progressPercentage} color="primary" />
                  </BlockStack>
                </Box>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {!isOrchestratorActive && (
                    <Button size="large" variant="primary" icon={MagicIcon} onClick={startBatch} disabled={queueIds.length === 0 || pushKeys.length === 0}>
                      {`Push ${pushKeys.length} Checked Fields to ${queueIds.length} Pieces (Dry Run)`}
                    </Button>
                  )}
                  {isOrchestratorActive && !isPaused && (
                    <Button size="large" onClick={() => setIsPaused(true)}>Pause</Button>
                  )}
                  {isOrchestratorActive && isPaused && (
                    <Button size="large" variant="primary" onClick={() => setIsPaused(false)}>Resume</Button>
                  )}
                  <Button size="large" tone="critical" onClick={clearBench}>
                    Clear Rack & Reset
                  </Button>
                </div>
              </BlockStack>
            </Card>

            {/* Editable Template Bench */}
            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h2">The Formatter Template</Text>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    {selectedBenchId && (
                      <Button size="micro" onClick={handleCopyTelemetry}>
                        Copy Telemetry
                      </Button>
                    )}
                    <Badge tone={pushKeys.length > 0 ? "success" : "attention"}>
                      {pushKeys.length} Fields Checked for Mass Update
                    </Badge>
                  </div>
                </InlineStack>
                
                {!selectedBenchId ? (
                  <Box padding="800" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" alignment="center" tone="subdued">Drop a piece on the bench to load its data. Edit the fields, then check the boxes next to the ones you want to stamp across the Rack.</Text>
                  </Box>
                ) : (
                  <BlockStack gap="600">
                    <Text as="h3" variant="headingMd" color="success">Base Loaded: {safeProducts.find(p => p.id === selectedBenchId)?.title}</Text>
                    
                    {SECTIONS.map((section, idx) => (
                      <BlockStack key={idx} gap="300">
                        <Text as="h4" variant="headingSm" fontWeight="bold" tone="subdued" style={{ borderBottom: "2px solid #e1e3e5", paddingBottom: "4px" }}>
                          {section.title}
                        </Text>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '16px' }}>
                          {section.keys.map(key => renderVisualBenchField(key))}
                        </div>
                      </BlockStack>
                    ))}
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
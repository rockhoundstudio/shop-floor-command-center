import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
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

// --- Strict Allowed Statuses ---
const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  NEEDS_REVIEW: "Needs Review",
  VALIDATED: "Validated",
  COMPLETE: "Complete",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

// 🔴 IMPORTANT: Replace these placeholder GIDs with actual Shopify GIDs for protected products
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
  const [runMode, setRunMode] = useState("DRY_RUN"); // Restricted to DRY_RUN for now
  const [isOrchestratorActive, setIsOrchestratorActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [queueIds, setQueueIds] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [productStates, setProductStates] = useState({}); // Record<GID, { status, logs: [] }>
  
  // --- Visual Bench State ---
  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [dryRunResults, setDryRunResults] = useState({}); // Record<GID, { proposedChanges: {}, proposedDeletions: [] }>

  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  const batchFetcher = useFetcher();

  // --- Resumability: Browser LocalStorage Checkpoints ---
  useEffect(() => {
    try {
      const savedState = localStorage.getItem("rockhound_standardizer_checkpoint");
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.queueIds && parsed.queueIds.length > 0) {
          setQueueIds(parsed.queueIds);
          setQueueIndex(parsed.queueIndex || 0);
          setProductStates(parsed.productStates || {});
          setDryRunResults(parsed.dryRunResults || {});
          setRunMode("DRY_RUN"); // Force Dry Run for safety
          setIsPaused(true);
          setSafetyMessage("Browser checkpoint found. Standardizer is paused.");
        }
      }
    } catch (e) {
      console.warn("Could not load checkpoint", e);
    }
  }, []);

  const saveCheckpoint = useCallback((ids, index, states, results) => {
    try {
      localStorage.setItem("rockhound_standardizer_checkpoint", JSON.stringify({
        queueIds: ids,
        queueIndex: index,
        productStates: states,
        dryRunResults: results
      }));
    } catch (e) {
      console.warn("Could not save checkpoint", e);
    }
  }, []);

  const clearCheckpoint = useCallback(() => {
    localStorage.removeItem("rockhound_standardizer_checkpoint");
    setQueueIds([]);
    setQueueIndex(0);
    setProductStates({});
    setDryRunResults({});
    setSelectedBenchId(null);
    setIsOrchestratorActive(false);
    setIsPaused(false);
    setSafetyMessage("Bench cleared.");
  }, []);

  // --- Search & Filtering ---
  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  const filteredProducts = safeProducts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  // --- Left Column: Queue Selection ---
  const handleToggleProductSelection = useCallback((id) => {
    if (isOrchestratorActive && !isPaused) return; 
    
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        return newStates;
      });
      saveCheckpoint(newIds, queueIndex, productStates, dryRunResults);
      return newIds;
    });
  }, [isOrchestratorActive, isPaused, queueIndex, productStates, dryRunResults, saveCheckpoint]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isOrchestratorActive && !isPaused) return;
    setQueueIds(prev => {
      let newIds = [...prev];
      if (allFilteredSelected) {
        newIds = newIds.filter(id => !filteredProducts.find(p => p.id === id));
      } else {
        filteredProducts.forEach(p => {
          if (!newIds.includes(p.id)) newIds.push(p.id);
        });
      }
      setProductStates(states => {
        const newStates = { ...states };
        newIds.forEach(id => {
          if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        });
        return newStates;
      });
      saveCheckpoint(newIds, queueIndex, productStates, dryRunResults);
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isOrchestratorActive, isPaused, queueIndex, productStates, dryRunResults, saveCheckpoint]);

  // --- The Batch State Machine ---
  const startBatch = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("No products loaded on the rack.");
      return;
    }
    if (runMode === "LIVE_RUN") {
      setSafetyError("LIVE RUN is locked out pending API verification. Dry Run only.");
      setRunMode("DRY_RUN");
      return;
    }
    
    setSafetyError("");
    setSafetyMessage(`Standardizer started in ${runMode} mode.`);
    setIsOrchestratorActive(true);
    setIsPaused(false);
  }, [queueIds.length, runMode]);

  const pauseBatch = useCallback(() => {
    setIsPaused(true);
    setSafetyMessage("Standardizer paused.");
  }, []);

  const resumeBatch = useCallback(() => {
    setIsPaused(false);
    setSafetyMessage(`Standardizer resumed in ${runMode} mode.`);
  }, [runMode]);

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = { status: status, logs: [...existingLogs, ...newLogs] };
      saveCheckpoint(queueIds, queueIndex, updated, dryRunResults);
      return updated;
    });
  }, [queueIds, queueIndex, dryRunResults, saveCheckpoint]);

  // --- Core Processing Loop ---
  useEffect(() => {
    if (!isOrchestratorActive || isPaused) return;
    if (batchFetcher.state !== "idle") return; 

    if (queueIndex >= queueIds.length) {
      setIsOrchestratorActive(false);
      setIsPaused(false);
      setSafetyMessage("Diagnostic Sweep Complete. Review the Visual Bench for proposed changes.");
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
      
      const productType = currentProduct?.productType?.toLowerCase() || "";
      if (productType.includes("accessory") || productType === "chain" || productType === "cord") {
        updateProductState(currentId, STATUS.SKIPPED, ["Skipped: Accessory detected."]);
        setTimeout(() => setQueueIndex(i => i + 1), 500);
        return;
      }
      
      updateProductState(currentId, STATUS.SCANNING, ["Running chassis diagnostic..."]);
      
      const fd = new FormData();
      fd.append("intent", "standardizeBatchItem"); 
      fd.append("pieceId", currentId);
      fd.append("runMode", runMode); 
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      return;
    }
  }, [isOrchestratorActive, isPaused, queueIndex, queueIds, productStates, batchFetcher.state, safeProducts, runMode, updateProductState]);

  // --- Listen to API Responses ---
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data) {
      const { intent, success, pieceId, finalStatus, logs = [], proposedChanges = {}, proposedDeletions = [] } = batchFetcher.data;
      
      if (intent === "standardizeBatchItem" && pieceId) {
        const appliedStatus = finalStatus || (success ? STATUS.VALIDATED : STATUS.FAILED);
        
        setDryRunResults(prev => {
          const next = { ...prev, [pieceId]: { proposedChanges, proposedDeletions } };
          saveCheckpoint(queueIds, queueIndex, productStates, next);
          return next;
        });

        updateProductState(pieceId, appliedStatus, logs);
        
        setTimeout(() => {
          setQueueIndex(prev => prev + 1);
        }, 800);
      }
    }
  }, [batchFetcher.state, batchFetcher.data, updateProductState, queueIds, queueIndex, productStates, saveCheckpoint]);

  // --- Visual Bench Data Extractor ---
  const extractCurrentMeta = (product, key) => {
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
  };

  const renderVisualBenchField = (key) => {
    if (!selectedBenchId) return null;
    const product = safeProducts.find(p => p.id === selectedBenchId);
    
    let fieldConfig = null;
    for (const group of FULL_META_GROUPS || []) {
      const found = group.fields.find(f => f.key === key);
      if (found) { fieldConfig = found; break; }
    }
    if (!fieldConfig) fieldConfig = CUSTOM_FIELDS?.find(f => f.key === key);
    if (!fieldConfig) fieldConfig = { key, label: key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') };

    const currentValue = extractCurrentMeta(product, key);
    const isFilled = currentValue.trim() !== "";
    
    const benchResults = dryRunResults[selectedBenchId] || { proposedChanges: {}, proposedDeletions: [] };
    const proposedChange = benchResults.proposedChanges[key];
    const isProposedForDeletion = benchResults.proposedDeletions.includes(key);

    const dotFillColor = isFilled ? "#22c55e" : "#ef4444"; 

    return (
      <div key={key} style={{ backgroundColor: isFilled ? "transparent" : "#FFF5F5", minHeight: "48px", padding: "8px", borderRadius: "4px", borderBottom: "1px solid #f0f0f0" }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: "4px" }}>
          <svg width="14" height="14" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '14px', marginRight: '8px' }}>
            <circle cx="9" cy="9" r="9" fill={dotFillColor} />
          </svg>
          <span style={{ fontSize: '13px', fontWeight: 'bold', color: "#202223" }}>{fieldConfig.label}</span>
        </div>
        
        <Text as="p" variant="bodyMd" color={isFilled ? "default" : "subdued"}>
          {isFilled ? currentValue : "— Blank —"}
        </Text>

        {/* DRY RUN PROPOSAL RENDERERS */}
        {proposedChange && (
          <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#e3f1df", borderRadius: "4px", borderLeft: "4px solid #22c55e" }}>
            <Text as="p" variant="bodySm" fontWeight="bold" tone="success">🔧 Proposed Fill/Update:</Text>
            <Text as="p" variant="bodyMd">{proposedChange}</Text>
          </div>
        )}
        
        {isProposedForDeletion && (
          <div style={{ marginTop: "8px", padding: "8px", backgroundColor: "#fbeae5", borderRadius: "4px", borderLeft: "4px solid #ef4444" }}>
            <Text as="p" variant="bodySm" fontWeight="bold" tone="critical">🗑️ Proposed for Rust Removal (Deletion)</Text>
          </div>
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
      <div style={{ display: "grid", gridTemplateColumns: "350px 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: The Rack */}
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">The Rack ({queueIds.length} loaded)</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search inventory..."
                disabled={isOrchestratorActive && !isPaused}
              />

              <Button 
                size="large" 
                fullWidth 
                onClick={toggleSelectAllFiltered}
                disabled={isOrchestratorActive && !isPaused}
              >
                {allFilteredSelected ? `Unload All (${filteredProducts.length})` : `Load All (${filteredProducts.length})`}
              </Button>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", height: "70vh", paddingRight: "8px" }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const isSelectedForBench = selectedBenchId === p.id;
                  const pState = productStates[p.id];
                  const currentStatus = pState?.status || STATUS.QUEUED;
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleProductSelection(p.id)}
                      style={{ 
                        overflow: "hidden", 
                        flexShrink: 0, 
                        border: isSelectedForBench ? "2px solid #005bd3" : "1px solid #c9cccf", 
                        borderRadius: "8px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isOrchestratorActive && !isPaused ? "not-allowed" : "pointer", 
                        padding: "8px",
                        display: "flex",
                        gap: "12px"
                      }} 
                    >
                      <div style={{ width: "60px", height: "60px", backgroundColor: "#2a2a2a", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                        {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      </div>
                      
                      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, minWidth: 0, justifyContent: "center" }}>
                        <Text as="p" variant="bodyMd" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                        <div style={{ marginTop: "4px" }}>
                          <Badge tone={getStatusTone(currentStatus)} size="small">{currentStatus}</Badge>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center" }}>
                        <Button 
                          size="micro" 
                          variant={isSelectedForBench ? "primary" : "secondary"}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setSelectedBenchId(p.id); 
                          }}
                        >
                          Bench
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Standardizer Controls & Visual Bench */}
        <div>
          <BlockStack gap="600">
            
            {/* Orchestrator Controls */}
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Standardization Engine</Text>
                
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

                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Safety Mode (Locked)</Text>
                    <div style={{ display: "flex", gap: "12px" }}>
                      <Button size="large" variant="primary" disabled>DRY RUN ACTIVE</Button>
                      <Button size="large" disabled tone="critical">LIVE RUN (LOCKED)</Button>
                    </div>
                    <Text as="p" variant="bodySm" tone="subdued">Live Run is disabled pending API deployment and allowlist verification. Diagnostics only.</Text>
                  </BlockStack>
                </Box>

                <Box padding="400" border="1px solid #E1E3E5" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold">Diagnostic Progress</Text>
                      <Text as="p">{queueIndex} of {queueIds.length} Scanned</Text>
                    </InlineStack>
                    <ProgressBar progress={progressPercentage} color="primary" />
                  </BlockStack>
                </Box>

                <div style={{ display: "flex", gap: "12px" }}>
                  {!isOrchestratorActive && (
                    <Button size="large" variant="primary" icon={MagicIcon} onClick={startBatch} disabled={queueIds.length === 0}>
                      Run Diagnostics
                    </Button>
                  )}
                  {isOrchestratorActive && !isPaused && (
                    <Button size="large" onClick={pauseBatch}>Pause</Button>
                  )}
                  {isOrchestratorActive && isPaused && (
                    <Button size="large" variant="primary" onClick={resumeBatch}>Resume</Button>
                  )}
                  <Button size="large" tone="critical" onClick={clearCheckpoint} disabled={queueIds.length === 0 && !isOrchestratorActive}>
                    Clear Rack & Reset
                  </Button>
                </div>
              </BlockStack>
            </Card>

            {/* Visual Bench */}
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">The Visual Bench</Text>
                
                {!selectedBenchId ? (
                  <Box padding="800" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" alignment="center" tone="subdued">Select "Bench" on any piece in the rack to drop it here for inspection.</Text>
                  </Box>
                ) : (
                  <BlockStack gap="600">
                    <Text as="h3" variant="headingMd">{safeProducts.find(p => p.id === selectedBenchId)?.title}</Text>
                    
                    {SECTIONS.map((section, idx) => (
                      <BlockStack key={idx} gap="300">
                        <Text as="h4" variant="headingSm" fontWeight="bold" tone="subdued" style={{ borderBottom: "2px solid #e1e3e5", paddingBottom: "4px" }}>
                          {section.title}
                        </Text>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
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
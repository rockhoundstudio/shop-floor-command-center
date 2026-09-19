import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar, Modal } from "@shopify/polaris";
import { useFetcher } from "react-router";

// --- Strict Allowed Statuses ---
const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  NEEDS_REVIEW: "Needs Review",
  VALIDATED: "Validated",
  SAVING: "Saving",
  VERIFYING: "Verifying",
  COMPLETE: "Complete",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

// 🔴 IMPORTANT: Replace these placeholder GIDs with the actual verified Shopify GIDs for the protected products
const VERIFIED_SKIP_LIST = [
  { id: "gid://shopify/Product/REPLACE_WITH_CREEK_FIND_GID", reason: "The Creek Find is permanently set to photos-check-only." },
  { id: "gid://shopify/Product/REPLACE_WITH_SUNRISE_GID", reason: "The Sunrise is locked pending structural state bug fix." }
];

export function OperationsMatrixTab({ products, fetcher }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // --- Batch Orchestrator State ---
  const [runMode, setRunMode] = useState("DRY_RUN"); // "DRY_RUN" | "LIVE_RUN"
  const [isOrchestratorActive, setIsOrchestratorActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  const [queueIds, setQueueIds] = useState([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [productStates, setProductStates] = useState({}); // Record<GID, { status, logs: [] }>
  
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");
  
  // --- Telemetry State ---
  const [telemetryData, setTelemetryData] = useState(null);

  const statusFetcher = useFetcher();
  const batchFetcher = useFetcher();

  // --- Resumability: Browser LocalStorage Checkpoints ---
  useEffect(() => {
    try {
      const savedState = localStorage.getItem("rockhound_batch_checkpoint");
      if (savedState) {
        const parsed = JSON.parse(savedState);
        if (parsed.queueIds && parsed.queueIds.length > 0) {
          setQueueIds(parsed.queueIds);
          setQueueIndex(parsed.queueIndex || 0);
          setProductStates(parsed.productStates || {});
          setRunMode(parsed.runMode || "DRY_RUN");
          setIsPaused(true); // Always load in a paused state for safety
          setSafetyMessage("Browser-resumable checkpoint found. The batch can resume after a page reload. Server-side durable job storage will be added only if the API requires it.");
        }
      }
    } catch (e) {
      console.warn("Could not load batch checkpoint", e);
    }
  }, []);

  const saveCheckpoint = useCallback((ids, index, states, mode) => {
    try {
      localStorage.setItem("rockhound_batch_checkpoint", JSON.stringify({
        queueIds: ids,
        queueIndex: index,
        productStates: states,
        runMode: mode
      }));
    } catch (e) {
      console.warn("Could not save batch checkpoint", e);
    }
  }, []);

  const clearCheckpoint = useCallback(() => {
    localStorage.removeItem("rockhound_batch_checkpoint");
    setQueueIds([]);
    setQueueIndex(0);
    setProductStates({});
    setIsOrchestratorActive(false);
    setIsPaused(false);
    setSafetyMessage("Batch cleared.");
  }, []);

  // --- Search & Filtering Logic ---
  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  const filteredProducts = safeProducts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  // --- Left Column: Queue Selection ---
  const handleToggleProductSelection = useCallback((id) => {
    if (isOrchestratorActive && !isPaused) return; // Prevent selection changes while running
    
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      
      // Initialize state for new selections
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) {
          newStates[id] = { status: STATUS.QUEUED, logs: [] };
        }
        return newStates;
      });
      
      saveCheckpoint(newIds, queueIndex, productStates, runMode);
      return newIds;
    });
  }, [isOrchestratorActive, isPaused, queueIndex, productStates, runMode, saveCheckpoint]);

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

      saveCheckpoint(newIds, queueIndex, productStates, runMode);
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isOrchestratorActive, isPaused, queueIndex, productStates, runMode, saveCheckpoint]);

  // --- The Batch State Machine ---
  const startBatch = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("No products selected in the queue.");
      return;
    }
    if (runMode === "LIVE_RUN") {
      const confirm = window.confirm("WARNING: LIVE RUN ACTIVE.\n\nThis will write data directly to Shopify for the queued products. Have you completed a Dry Run first?\n\nClick OK to proceed with Live Injection.");
      if (!confirm) return;
    }
    
    setSafetyError("");
    setSafetyMessage(`Batch started in ${runMode} mode.`);
    setIsOrchestratorActive(true);
    setIsPaused(false);
  }, [queueIds.length, runMode]);

  const pauseBatch = useCallback(() => {
    setIsPaused(true);
    setSafetyMessage("Batch paused. You can resume when ready.");
  }, []);

  const resumeBatch = useCallback(() => {
    setIsPaused(false);
    setSafetyMessage(`Batch resumed in ${runMode} mode.`);
  }, [runMode]);

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = {
        status: status,
        logs: [...existingLogs, ...newLogs]
      };
      saveCheckpoint(queueIds, queueIndex, updated, runMode);
      return updated;
    });
  }, [queueIds, queueIndex, runMode, saveCheckpoint]);

  // --- Core Processing Loop ---
  useEffect(() => {
    if (!isOrchestratorActive || isPaused) return;
    if (batchFetcher.state !== "idle") return; // Wait for current network call

    if (queueIndex >= queueIds.length) {
      setIsOrchestratorActive(false);
      setIsPaused(false);
      setSafetyMessage("Batch processing complete! Review the statuses below or export the report.");
      return;
    }

    const currentId = queueIds[queueIndex];
    const currentProduct = safeProducts.find(p => p.id === currentId);
    const currentState = productStates[currentId]?.status;

    // 1. HARD GATES (Skip Logic using explicit GIDs and strict types)
    if (currentState === STATUS.QUEUED) {
      // Check explicit GID skip list
      const skipRule = VERIFIED_SKIP_LIST.find(skip => skip.id === currentId);
      if (skipRule) {
        updateProductState(currentId, STATUS.SKIPPED, [`Skipped: ${skipRule.reason}`]);
        setTimeout(() => setQueueIndex(i => i + 1), 500);
        return;
      }
      
      // Accessory Check (Using productType, not just title)
      const productType = currentProduct?.productType?.toLowerCase() || "";
      if (productType.includes("accessory") || productType.includes("accessories") || productType === "chain" || productType === "cord") {
        updateProductState(currentId, STATUS.SKIPPED, ["Skipped: Accessories are excluded automatically."]);
        setTimeout(() => setQueueIndex(i => i + 1), 500);
        return;
      }
      
      // If passing hard gates, move to Scanning and fire the API intent
      updateProductState(currentId, STATUS.SCANNING, ["Initiating AI Autofill service..."]);
      
      const fd = new FormData();
      fd.append("intent", "batchAuditItem"); 
      fd.append("pieceId", currentId);
      fd.append("runMode", runMode); 
      
      if (runMode === "LIVE_RUN") {
        fd.append("explicitConfirm", "true");
      }

      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      return;
    }

  }, [isOrchestratorActive, isPaused, queueIndex, queueIds, productStates, batchFetcher.state, safeProducts, runMode, updateProductState]);

  // --- Listen to API Responses ---
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data) {
      const { intent, success, pieceId, finalStatus, logs = [] } = batchFetcher.data;
      
      if (intent === "batchAuditItem" && pieceId) {
        const appliedStatus = finalStatus || (success ? STATUS.COMPLETE : STATUS.FAILED);
        updateProductState(pieceId, appliedStatus, logs);
        
        setTimeout(() => {
          setQueueIndex(prev => prev + 1);
        }, 1500);
      }
    }
  }, [batchFetcher.state, batchFetcher.data, updateProductState]);

  // --- Batch Visibility Controls ---
  const handleVisibilityChange = useCallback((action) => {
    if (queueIds.length === 0) return;
    
    // Safety check for live operations
    if (runMode !== "LIVE_RUN") {
      setSafetyError(`Cannot execute ${action}. You must switch to LIVE RUN to alter Shopify status.`);
      return;
    }

    const confirm = window.confirm(`WARNING: You are about to execute ${action} on ${queueIds.length} queued pieces.\n\nAre you sure you want to alter their live Shopify state?`);
    if (!confirm) return;

    setSafetyError("");
    setSafetyMessage(`Dispatching ${action} command for ${queueIds.length} products...`);
    
    const fd = new FormData();
    fd.append("intent", "batchVisibilityUpdate");
    fd.append("action", action); // DRAFT, ACTIVE, PUBLISH
    fd.append("pieceIds", JSON.stringify(queueIds));
    
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [queueIds, runMode, batchFetcher]);

  // --- Export Reports ---
  const handleExportAuditReport = useCallback(() => {
    try {
      let csv = "Product ID,Title,Final Status,Logs\n";
      
      queueIds.forEach(id => {
        const product = safeProducts.find(p => p.id === id);
        const state = productStates[id] || { status: "Unknown", logs: [] };
        const title = product ? product.title.replace(/"/g, '""') : "Unknown";
        const combinedLogs = state.logs.join(" | ").replace(/"/g, '""');
        
        csv += `"${id}","${title}","${state.status}","${combinedLogs}"\n`;
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `rockhound_batch_audit_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSafetyMessage("Audit Report downloaded successfully.");
    } catch (e) {
      setSafetyError("Failed to compile Audit Report.");
    }
  }, [queueIds, safeProducts, productStates]);

  const getStatusTone = (status) => {
    switch(status) {
      case STATUS.COMPLETE: return "success";
      case STATUS.FAILED: return "critical";
      case STATUS.NEEDS_REVIEW: return "warning";
      case STATUS.SKIPPED: return "info";
      case STATUS.QUEUED: return undefined;
      case STATUS.SCANNING:
      case STATUS.VALIDATED:
      case STATUS.SAVING:
      case STATUS.VERIFYING: return "magic";
      default: return undefined;
    }
  };

  const progressPercentage = queueIds.length > 0 ? Math.round((queueIndex / queueIds.length) * 100) : 0;

  return (
    <BlockStack gap="600">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: Queue Selection */}
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Batch Queue ({queueIds.length} queued)</Text>
              
              <div style={{ minHeight: "54px" }}>
                <TextField
                  value={searchQuery}
                  onChange={handleSearchChange}
                  clearButton
                  onClearButtonClick={handleClearSearch}
                  autoComplete="off"
                  placeholder="Search products by title..."
                  disabled={isOrchestratorActive && !isPaused}
                />
              </div>

              <div style={{ minHeight: "54px" }}>
                <Button 
                  size="large" 
                  fullWidth 
                  onClick={toggleSelectAllFiltered}
                  disabled={isOrchestratorActive && !isPaused}
                >
                  {allFilteredSelected ? `Deselect All (${filteredProducts.length})` : `Select All (${filteredProducts.length})`}
                </Button>
              </div>

              {/* Exact Tab 2 scrolling container format */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", height: "600px", paddingRight: "8px" }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const pState = productStates[p.id];
                  const currentStatus = pState?.status || STATUS.QUEUED;
                  
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  // Read true Shopify status
                  const trueStatus = p.status || "UNKNOWN";
                  const statusTone = trueStatus === 'ACTIVE' ? 'success' : 'attention';
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleProductSelection(p.id)}
                      style={{ 
                        minHeight: "140px", 
                        overflow: "hidden", 
                        flexShrink: 0, 
                        border: "1px solid #c9cccf", 
                        borderRadius: "8px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isOrchestratorActive && !isPaused ? "not-allowed" : "pointer", 
                        padding: "12px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                        display: "flex",
                        flexDirection: "column"
                      }} 
                    >
                      {/* Top section: Checkbox, Image, Badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                        <div style={{ display: "flex", gap: "12px" }}>
                          <input 
                            type="checkbox" 
                            checked={isChecked} 
                            readOnly 
                            style={{ width: "20px", height: "20px", marginTop: "4px", pointerEvents: "none" }} 
                          />
                          <div style={{ width: "120px", height: "120px", minWidth: "120px", minHeight: "120px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0, overflow: "hidden" }}>
                            {imageUrl && (
                              <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            )}
                          </div>
                        </div>
                        
                        {/* Dual Status Indicators: Engine Pipeline & Shopify Reality */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                          <Badge tone={getStatusTone(currentStatus)} size="large">{currentStatus}</Badge>
                          <Badge tone={statusTone} size="small">{trueStatus}</Badge>
                        </div>
                      </div>

                      {/* Bottom section: Tab 2 Text Wrapping Format & Telemetry */}
                      <div style={{ width: "100%", borderTop: "1px solid rgba(150, 150, 150, 0.3)", paddingTop: "8px" }}>
                        {p.title.split(" — ").map((part, idx) => (
                          <span key={idx} style={{ display: "block", marginBottom: "4px", whiteSpace: "normal", wordBreak: "break-word", fontWeight: idx === 0 ? "bold" : "normal", color: "#202223" }}>
                            {part}
                          </span>
                        ))}
                        
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                          <span style={{ whiteSpace: "normal", opacity: 0.8, fontSize: "12px", color: "#6d7175" }}>
                            {p.id.replace('gid://shopify/Product/', '')}
                          </span>
                          <Button 
                            size="micro" 
                            onClick={(e) => { 
                              e.stopPropagation(); // Prevents checkbox from toggling when inspecting
                              setTelemetryData(p); 
                            }}
                          >
                            Telemetry
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Orchestrator Controls */}
        <div>
          <BlockStack gap="600">
            
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Orchestrator Controls</Text>
                
                {safetyMessage && (
                  <Banner tone="success" onDismiss={() => setSafetyMessage("")}>
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
                    <Text as="h3" variant="headingMd">Safety Mode</Text>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                      <div style={{ flexGrow: 1, minWidth: "120px" }}>
                        <Button 
                          size="large" 
                          fullWidth 
                          variant={runMode === "DRY_RUN" ? "primary" : "secondary"}
                          onClick={() => setRunMode("DRY_RUN")}
                          disabled={isOrchestratorActive}
                        >
                          DRY RUN
                        </Button>
                      </div>
                      <div style={{ flexGrow: 1, minWidth: "120px" }}>
                        <Button 
                          size="large" 
                          fullWidth 
                          variant={runMode === "LIVE_RUN" ? "primary" : "secondary"}
                          tone={runMode === "LIVE_RUN" ? "critical" : undefined}
                          onClick={() => setRunMode("LIVE_RUN")}
                          disabled={isOrchestratorActive}
                        >
                          LIVE RUN
                        </Button>
                      </div>
                    </div>
                  </BlockStack>
                </Box>

                <Box padding="400" border="1px solid #E1E3E5" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold">Batch Progress</Text>
                      <Text as="p">{queueIndex} of {queueIds.length} Processed</Text>
                    </InlineStack>
                    <ProgressBar progress={progressPercentage} color={runMode === "LIVE_RUN" ? "critical" : "primary"} />
                    
                    {queueIds.length > 0 && queueIndex < queueIds.length && (
                      <div style={{ marginTop: "12px", minWidth: 0, overflow: "hidden" }}>
                        <Text as="p" tone="subdued">Current Target:</Text>
                        <Text as="p" fontWeight="bold">{safeProducts.find(p => p.id === queueIds[queueIndex])?.title || "Unknown"}</Text>
                      </div>
                    )}
                  </BlockStack>
                </Box>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  {!isOrchestratorActive && (
                    <div style={{ flexGrow: 1, minWidth: "120px" }}>
                      <Button size="large" fullWidth variant="primary" onClick={startBatch} disabled={queueIds.length === 0}>
                        Start Batch
                      </Button>
                    </div>
                  )}
                  
                  {isOrchestratorActive && !isPaused && (
                    <div style={{ flexGrow: 1, minWidth: "120px" }}>
                      <Button size="large" fullWidth onClick={pauseBatch}>
                        Pause Batch
                      </Button>
                    </div>
                  )}
                  
                  {isOrchestratorActive && isPaused && (
                    <div style={{ flexGrow: 1, minWidth: "120px" }}>
                      <Button size="large" fullWidth variant="primary" onClick={resumeBatch}>
                        Resume Batch
                      </Button>
                    </div>
                  )}

                  <div style={{ flexGrow: 1, minWidth: "120px" }}>
                    <Button size="large" fullWidth tone="critical" onClick={clearCheckpoint} disabled={queueIds.length === 0 && !isOrchestratorActive}>
                      Clear Queue & Stop
                    </Button>
                  </div>
                </div>

              </BlockStack>
            </Card>

            {/* NEW: Batch State Controls */}
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Live Store Status</Text>
                <Text as="p" tone="subdued">These actions apply to all currently queued items and require LIVE RUN mode.</Text>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ flexGrow: 1, minWidth: "100px" }}>
                    <Button fullWidth onClick={() => handleVisibilityChange("DRAFT")} disabled={queueIds.length === 0 || isOrchestratorActive}>
                      Set to Draft
                    </Button>
                  </div>
                  <div style={{ flexGrow: 1, minWidth: "100px" }}>
                    <Button fullWidth onClick={() => handleVisibilityChange("ACTIVE")} disabled={queueIds.length === 0 || isOrchestratorActive}>
                      Set to Active
                    </Button>
                  </div>
                  <div style={{ flexGrow: 1, minWidth: "120px" }}>
                    <Button fullWidth tone="success" variant="primary" onClick={() => handleVisibilityChange("PUBLISH")} disabled={queueIds.length === 0 || isOrchestratorActive}>
                      Publish (All Channels)
                    </Button>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Data & Auditing</Text>
                
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
                  <div style={{ flexGrow: 1 }}>
                    <Button size="large" fullWidth onClick={handleExportAuditReport} disabled={queueIds.length === 0}>
                      Export Error/Audit Report
                    </Button>
                  </div>
                </div>
              </BlockStack>
            </Card>

          </BlockStack>
        </div>
      </div>

      {/* Telemetry Modal for Raw Data Inspections */}
      {telemetryData && (
        <Modal
          open={!!telemetryData}
          onClose={() => setTelemetryData(null)}
          title={`Telemetry Diagnostics: ${telemetryData.title}`}
          size="large"
        >
          <Modal.Section>
            <Text as="p" tone="subdued" style={{ marginBottom: "16px" }}>
              Raw object mapping direct from the GraphQL index. Use this to verify internal tags, metafields, and structural integrity.
            </Text>
            <div style={{ 
              backgroundColor: "#1a1a1a", 
              padding: "16px", 
              borderRadius: "6px",
              maxHeight: "60vh",
              overflowY: "auto"
            }}>
              <pre style={{ 
                margin: 0, 
                color: "#00ff00", 
                whiteSpace: "pre-wrap", 
                wordBreak: "break-word",
                fontFamily: "monospace",
                fontSize: "13px"
              }}>
                {JSON.stringify(telemetryData, null, 2)}
              </pre>
            </div>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}
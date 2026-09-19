import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
import { useFetcher } from "react-router";
import { ROCKHOUND_FIELDS } from "../utils/meta-injector.constants.jsx";

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
      fd.append("intent", "batchAuditItem"); // This is just an intent until the API is implemented
      fd.append("pieceId", currentId);
      fd.append("runMode", runMode); // DRY_RUN or LIVE_RUN
      
      // Strict server-side verification: The API must reject live saves without this explicitly set
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
        // Update the piece with the exact pipeline status from the server
        const appliedStatus = finalStatus || (success ? STATUS.COMPLETE : STATUS.FAILED);
        updateProductState(pieceId, appliedStatus, logs);
        
        // Move to next item after a small governor delay to respect rate limits
        setTimeout(() => {
          setQueueIndex(prev => prev + 1);
        }, 1500);
      }
    }
  }, [batchFetcher.state, batchFetcher.data, updateProductState]);


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

  // Helper for UI styling
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
                  label="Search Products"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  clearButton
                  onClearButtonClick={handleClearSearch}
                  autoComplete="off"
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

              <div style={{ maxHeight: "65vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const pState = productStates[p.id];
                  const currentStatus = pState?.status || STATUS.QUEUED;
                  
                  // Extract image safely based on Shopify GraphQL format
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "16px", minHeight: "64px", padding: "12px", border: "1px solid #E1E3E5", borderRadius: "8px", backgroundColor: isChecked ? "#F4F6F8" : "transparent" }}>
                      
                      {/* Checkbox (No shrinking) */}
                      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", height: "100%" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleProductSelection(p.id)}
                          disabled={isOrchestratorActive && !isPaused}
                          style={{ width: "24px", height: "24px", cursor: "pointer" }}
                        />
                      </div>

                      {/* Thumbnail (40x40 fixed) */}
                      <div style={{ width: "40px", height: "40px", flexShrink: 0, backgroundColor: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
                        {imageUrl && (
                          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        )}
                      </div>

                      {/* Title & Subtitle (minWidth: 0 prevents flex blowouts, truncate prevents wrapping) */}
                      <div style={{ flexGrow: 1, minWidth: 0, overflow: "hidden" }}>
                        <Text as="p" fontWeight="bold" truncate>{p.title}</Text>
                        <Text as="p" tone="subdued" variant="bodySm" truncate>{p.id.replace('gid://shopify/Product/', '')}</Text>
                      </div>

                      {/* Badge Container (Fixed width to prevent squeezing) */}
                      <div style={{ flexShrink: 0, width: "110px", textAlign: "right" }}>
                        <Badge tone={getStatusTone(currentStatus)} size="large">{currentStatus}</Badge>
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

                {/* Mode Toggle */}
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">Safety Mode</Text>
                    <InlineStack gap="300">
                      <div style={{ flexGrow: 1 }}>
                        <Button 
                          size="large" 
                          fullWidth 
                          variant={runMode === "DRY_RUN" ? "primary" : "secondary"}
                          onClick={() => setRunMode("DRY_RUN")}
                          disabled={isOrchestratorActive}
                        >
                          DRY RUN (Scan Only)
                        </Button>
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <Button 
                          size="large" 
                          fullWidth 
                          variant={runMode === "LIVE_RUN" ? "primary" : "secondary"}
                          tone={runMode === "LIVE_RUN" ? "critical" : undefined}
                          onClick={() => setRunMode("LIVE_RUN")}
                          disabled={isOrchestratorActive}
                        >
                          LIVE RUN (Write to Store)
                        </Button>
                      </div>
                    </InlineStack>
                  </BlockStack>
                </Box>

                {/* Progress Dashboard */}
                <Box padding="400" border="1px solid #E1E3E5" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold">Batch Progress</Text>
                      <Text as="p">{queueIndex} of {queueIds.length} Processed</Text>
                    </InlineStack>
                    <ProgressBar progress={progressPercentage} color={runMode === "LIVE_RUN" ? "critical" : "primary"} />
                    
                    {queueIds.length > 0 && queueIndex < queueIds.length && (
                      <div style={{ marginTop: "12px" }}>
                        <Text as="p" tone="subdued">Current Target:</Text>
                        <Text as="p" fontWeight="bold">{safeProducts.find(p => p.id === queueIds[queueIndex])?.title || "Unknown"}</Text>
                      </div>
                    )}
                  </BlockStack>
                </Box>

                {/* Engine Controls */}
                <InlineStack gap="300">
                  {!isOrchestratorActive && (
                    <div style={{ flexGrow: 1 }}>
                      <Button size="large" fullWidth variant="primary" onClick={startBatch} disabled={queueIds.length === 0}>
                        Start Batch
                      </Button>
                    </div>
                  )}
                  
                  {isOrchestratorActive && !isPaused && (
                    <div style={{ flexGrow: 1 }}>
                      <Button size="large" fullWidth onClick={pauseBatch}>
                        Pause Batch
                      </Button>
                    </div>
                  )}
                  
                  {isOrchestratorActive && isPaused && (
                    <div style={{ flexGrow: 1 }}>
                      <Button size="large" fullWidth variant="primary" onClick={resumeBatch}>
                        Resume Batch
                      </Button>
                    </div>
                  )}

                  <div style={{ flexGrow: 1 }}>
                    <Button size="large" fullWidth tone="critical" onClick={clearCheckpoint} disabled={queueIds.length === 0 && !isOrchestratorActive}>
                      Clear Queue & Stop
                    </Button>
                  </div>
                </InlineStack>

              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Data & Auditing</Text>
                
                <InlineStack gap="300">
                  <div style={{ flexGrow: 1 }}>
                    <Button size="large" fullWidth onClick={handleExportAuditReport} disabled={queueIds.length === 0}>
                      Export Error/Audit Report
                    </Button>
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>

          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}
import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box } from "@shopify/polaris";
import { ROCKHOUND_FIELDS } from "../utils/meta-injector.constants.jsx";

export function OperationsMatrixTab({ products, fetcher }) {
  const safeProducts = products || [];
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());

  // --- Section 1: AI Forge State ---
  const [aiPrompt, setAiPrompt] = useState("You are a gritty, mechanic-style copywriter for a lapidary and handcrafted stone jewelry studio. Write a 160-character SEO meta description for this product. Be specific, earthy, and direct. No fluff.");
  const [productTitle, setProductTitle] = useState("");
  const [generatedOutput, setGeneratedOutput] = useState("");

  // --- Section 2: Global Sweeps State ---
  const [batchState, setBatchState] = useState({
    isActive: false,
    type: "",
    chunks: [],
    currentIndex: 0,
    status: "idle",
    message: "",
    error: ""
  });

  // --- Section 3: Safety Nets State ---
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  // --- Handlers: Left Column Selection ---
  const handleSelectProduct = useCallback((id, title) => {
    setSelectedProductId(id);
    setProductTitle(title);
    setGeneratedOutput("");
  }, []);

  const handleToggleProductSelection = useCallback((id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      const isSelected = newSet.has(id);
      if (isSelected) {
        newSet.delete(id);
      }
      if (!isSelected) {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const allIds = safeProducts.map(p => p.id);
    setSelectedIds(new Set(allIds));
  }, [safeProducts]);

  const handleClearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // --- Handlers: AI Forge ---
  const handleGenerateSEO = useCallback(() => {
    if (!productTitle) return;
    setGeneratedOutput("");
    const payload = JSON.stringify({ title: productTitle, instructions: aiPrompt });
    fetcher.submit({ intent: "generateSEO", formData: payload }, { method: "post" });
  }, [productTitle, aiPrompt, fetcher]);

  const handleCopyOutput = useCallback(() => {
    if (!generatedOutput) return;
    navigator.clipboard.writeText(generatedOutput);
  }, [generatedOutput]);

  // --- Handlers: Global Sweeps ---
  const startBatchSweep = useCallback((type) => {
    const hasSelectedProducts = selectedIds.size > 0;
    const targetProducts = hasSelectedProducts 
      ? safeProducts.filter(p => selectedIds.has(p.id)) 
      : safeProducts;

    const newChunks = [];
    for (let i = 0; i < targetProducts.length; i += 10) {
      newChunks.push(targetProducts.slice(i, i + 10));
    }
    
    setBatchState({
      isActive: true,
      type: type,
      chunks: newChunks,
      currentIndex: 0,
      status: "processing",
      message: "",
      error: ""
    });
  }, [safeProducts, selectedIds]);

  // Handle batch processing steps
  useEffect(() => {
    const isProcessing = batchState.isActive && batchState.status === "processing";
    
    if (isProcessing) {
      const currentChunk = batchState.chunks[batchState.currentIndex];
      
      if (currentChunk) {
        setBatchState(prev => ({ ...prev, status: "waiting_for_network" }));
        const payload = [];

        const isOoak = batchState.type === "ooak";
        const isOrigins = batchState.type === "origins";

        if (isOoak) {
          currentChunk.forEach(p => {
            const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
            payload.push({
              ownerId: formatId,
              namespace: "custom",
              key: "is_one_of_a_kind",
              value: "Yes — one of a kind",
              type: "single_line_text_field"
            });
          });
        }

        if (isOrigins) {
          currentChunk.forEach(p => {
            const parts = p.title.split(" — ");
            const hasOriginPart = parts.length >= 3;
            if (hasOriginPart) {
              const origin = parts[1].trim();
              const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
              payload.push({
                ownerId: formatId,
                namespace: "custom",
                key: "collection_location",
                value: origin,
                type: "single_line_text_field"
              });
            }
          });
        }

        const hasUpdates = payload.length > 0;
        if (hasUpdates) {
          fetcher.submit({ intent: "saveProduct", payload: JSON.stringify(payload) }, { method: "post" });
        }
        
        if (!hasUpdates) {
          setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
        }
      }
      
      if (!currentChunk) {
        setBatchState(prev => ({ ...prev, isActive: false, status: "complete", message: "Sweep completed successfully across target products." }));
      }
    }
  }, [batchState, fetcher]);

  // Handle network lock for batch processor
  useEffect(() => {
    const isWaitingForNetwork = batchState.status === "waiting_for_network";
    const isFetcherActive = fetcher.state !== "idle";
    
    if (isWaitingForNetwork && isFetcherActive) {
      setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
    }
  }, [batchState.status, fetcher.state]);

  // Handle 10-product governor pause between chunks
  useEffect(() => {
    const isWaitingForIdle = batchState.status === "waiting_for_idle";
    const isFetcherIdle = fetcher.state === "idle";
    
    if (isWaitingForIdle && isFetcherIdle) {
      setBatchState(prev => ({ ...prev, status: "paused" }));
      setTimeout(() => {
        setBatchState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, status: "processing" }));
      }, 1000); // 1-second pause limits server hammering
    }
  }, [batchState.status, fetcher.state]);

  // --- Listeners: AI Forge Fetcher Responses ---
  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;

    if (isIdle && hasData) {
      const isGenerateSEO = fetcher.data.intent === "generateSEO";
      const isSuccess = fetcher.data.success === true;
      
      if (isGenerateSEO && isSuccess) {
        setGeneratedOutput(fetcher.data.seoDescription || fetcher.data.text || "");
      }
    }
  }, [fetcher.state, fetcher.data]);

  // --- Handlers: Safety Nets ---
  const handleExportCSV = useCallback(() => {
    setSafetyMessage("");
    setSafetyError("");
    try {
      const headers = ["Product ID", "Title", ...ROCKHOUND_FIELDS.map(f => f.key)];
      let csv = headers.join(",") + "\n";
      
      safeProducts.forEach(p => {
        const row = [`"${p.id}"`, `"${p.title.replace(/"/g, '""')}"`];
        const fieldMap = {};
        
        const hasMetafields = p.metafields && p.metafields.edges;
        if (hasMetafields) {
          p.metafields.edges.forEach(({ node }) => {
            const isRockhound = node.namespace === "rockhound";
            if (isRockhound) {
              fieldMap[node.key] = node.value;
            }
          });
        }
        
        ROCKHOUND_FIELDS.forEach(f => {
          const val = fieldMap[f.key] || "";
          row.push(`"${val.toString().replace(/"/g, '""')}"`);
        });
        
        csv += row.join(",") + "\n";
      });
      
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `rockhound_inventory_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSafetyMessage("CSV Export compiled and downloaded successfully.");
    } catch (e) {
      setSafetyError("Failed to compile CSV export.");
    }
  }, [safeProducts]);

  const handleJSONSnapshot = useCallback(() => {
    setSafetyMessage("");
    setSafetyError("");
    try {
      const data = safeProducts.map(p => {
        const fields = {};
        const hasMetafields = p.metafields && p.metafields.edges;
        
        if (hasMetafields) {
          p.metafields.edges.forEach(({ node }) => {
            const isRockhound = node.namespace === "rockhound";
            if (isRockhound) {
              fields[node.key] = node.value;
            }
          });
        }
        return { id: p.id, title: p.title, fields: fields };
      });
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `rockhound_snapshot_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSafetyMessage("Full JSON snapshot compiled and downloaded successfully.");
    } catch (e) {
      setSafetyError("Failed to compile JSON snapshot.");
    }
  }, [safeProducts]);

  const isGeneratingSEO = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "generateSEO";

  return (
    <BlockStack gap="600">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Target Product Selection</Text>
              <Text as="p" tone="subdued">{selectedIds.size} of {safeProducts.length} selected for sweeps</Text>
              
              <InlineStack gap="300">
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button size="large" fullWidth onClick={handleSelectAll} accessibilityLabel="Select all products for batch operations">Select All</Button>
                </div>
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button size="large" fullWidth onClick={handleClearAll} accessibilityLabel="Clear product selection">Clear All</Button>
                </div>
              </InlineStack>

              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {safeProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  const isChecked = selectedIds.has(p.id);
                  return (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "54px" }}>
                      <div style={{ display: "flex", alignItems: "center", height: "54px" }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleProductSelection(p.id)}
                          aria-label={`Select product ${p.title} for batch sweeps`}
                          style={{ width: "24px", height: "24px", cursor: "pointer" }}
                        />
                      </div>
                      <div style={{ flexGrow: 1, minHeight: "54px" }}>
                        <Button
                          fullWidth
                          size="large"
                          textAlign="left"
                          variant={isSelected ? "primary" : "secondary"}
                          onClick={() => handleSelectProduct(p.id, p.title)}
                          accessibilityLabel={`Load product ${p.title} into AI Forge`}
                        >
                          {p.title}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <BlockStack gap="600">
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Section 1: AI Forge</Text>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="AI Persona Prompt"
                    value={aiPrompt}
                    onChange={setAiPrompt}
                    multiline={3}
                    accessibilityLabel="Edit AI Persona Prompt"
                    autoComplete="off"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Product Title"
                    value={productTitle}
                    onChange={setProductTitle}
                    accessibilityLabel="Enter Product Title for SEO generation"
                    autoComplete="off"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <Button
                    size="large"
                    variant="primary"
                    onClick={handleGenerateSEO}
                    accessibilityLabel="Generate Description"
                    loading={isGeneratingSEO}
                    disabled={!productTitle}
                  >
                    Generate Description
                  </Button>
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Generated Output"
                    value={generatedOutput}
                    multiline={4}
                    readOnly
                    accessibilityLabel="Generated SEO Description Output"
                    autoComplete="off"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <Button
                    size="large"
                    onClick={handleCopyOutput}
                    accessibilityLabel="Copy output to clipboard"
                    disabled={!generatedOutput}
                  >
                    Copy to Clipboard
                  </Button>
                </div>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Section 2: Global Sweeps</Text>
                
                {batchState.message !== "" && (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="success" title="Sweep Complete">
                      <Text as="p">{batchState.message}</Text>
                    </Banner>
                  </div>
                )}

                {batchState.error !== "" && (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="critical" title="Sweep Error">
                      <Text as="p">{batchState.error}</Text>
                    </Banner>
                  </div>
                )}

                {batchState.isActive && (
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="bold">Processing Batch {batchState.currentIndex + 1} of {batchState.chunks.length}</Text>
                      <Text as="p" tone="subdued">System Governor active. Status: {batchState.status}</Text>
                      <div style={{ width: "100%", height: "12px", backgroundColor: "#E1E3E5", borderRadius: "6px", overflow: "hidden", marginTop: "8px" }}>
                        <div style={{ width: `${((batchState.currentIndex) / batchState.chunks.length) * 100}%`, height: "100%", backgroundColor: "#2C6ECB", transition: "width 0.3s ease" }}></div>
                      </div>
                    </BlockStack>
                  </Box>
                )}

                <InlineStack gap="300">
                  <div style={{ minHeight: "54px", flexGrow: 1 }}>
                    <Button
                      size="large"
                      fullWidth
                      onClick={() => startBatchSweep("ooak")}
                      accessibilityLabel="Standardize OOAK across target products"
                      disabled={batchState.isActive}
                    >
                      Standardize OOAK
                    </Button>
                  </div>
                  <div style={{ minHeight: "54px", flexGrow: 1 }}>
                    <Button
                      size="large"
                      fullWidth
                      onClick={() => startBatchSweep("origins")}
                      accessibilityLabel="Sweep Origins across target products"
                      disabled={batchState.isActive}
                    >
                      Sweep Origins
                    </Button>
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Section 3: Safety Nets</Text>
                
                {safetyMessage !== "" && (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="success" title="File Download Started">
                      <Text as="p">{safetyMessage}</Text>
                    </Banner>
                  </div>
                )}

                {safetyError !== "" && (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="critical" title="File Creation Failed">
                      <Text as="p">{safetyError}</Text>
                    </Banner>
                  </div>
                )}

                <InlineStack gap="300">
                  <div style={{ minHeight: "54px", flexGrow: 1 }}>
                    <Button
                      size="large"
                      fullWidth
                      onClick={handleExportCSV}
                      accessibilityLabel="Export CSV of all Metafields"
                    >
                      Export CSV
                    </Button>
                  </div>
                  <div style={{ minHeight: "54px", flexGrow: 1 }}>
                    <Button
                      size="large"
                      fullWidth
                      onClick={handleJSONSnapshot}
                      accessibilityLabel="Download JSON Snapshot"
                    >
                      JSON Snapshot
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


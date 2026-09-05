import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Select } from "@shopify/polaris";
import { ROCKHOUND_FIELDS } from "../utils/meta-injector.constants.jsx";

export function OperationsMatrixTab({ products, fetcher }) {
  const safeProducts = products ? products : [];
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // --- Section 1: AI Forge State ---
  const [aiPrompt, setAiPrompt] = useState("You are a gritty, mechanic-style copywriter for a lapidary and handcrafted stone jewelry studio. Write a 160-character SEO meta description for this product. Be specific, earthy, and direct. No fluff.");
  const [productTitle, setProductTitle] = useState("");
  const [generatedOutput, setGeneratedOutput] = useState("");

  // --- Section 3: Schema Expander State ---
  const [schemaNamespace, setSchemaNamespace] = useState("custom");
  const [schemaKey, setSchemaKey] = useState("");
  const [schemaType, setSchemaType] = useState("single_line_text_field");
  const [schemaValue, setSchemaValue] = useState("");

  // --- Section 4: Global Re-Forge State ---
  const [reforgeSafetyOff, setReforgeSafetyOff] = useState(false);

  // --- Section 2 & 4: Global Sweeps & Re-Forge Engine State ---
  const [batchState, setBatchState] = useState({
    isActive: false,
    type: "",
    chunks: [],
    currentIndex: 0,
    status: "idle",
    message: "",
    error: "",
    schemaConfig: {}
  });

  // --- Section 5: Safety Nets State ---
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  // --- Search & Filtering Logic ---
  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);

  const filteredProducts = safeProducts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allFilteredSelected = filteredProducts.length > 0 ? filteredProducts.every(p => selectedIds.has(p.id)) : false;

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
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const toggleSelectAllFiltered = useCallback(() => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (allFilteredSelected) {
        filteredProducts.forEach(p => newSet.delete(p.id));
      } else {
        filteredProducts.forEach(p => newSet.add(p.id));
      }
      return newSet;
    });
  }, [filteredProducts, allFilteredSelected]);

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

  // --- Handlers: Global Sweeps & Schema Engine ---
  const startBatchSweep = useCallback((type) => {
    const hasSelectedProducts = selectedIds.size > 0;
    const targetProducts = hasSelectedProducts 
      ? safeProducts.filter(p => selectedIds.has(p.id)) 
      : safeProducts;

    const chunkSize = type === "reforge" ? 1 : 10;
    const newChunks = [];
    for (let i = 0; i < targetProducts.length; i += chunkSize) {
      newChunks.push(targetProducts.slice(i, i + chunkSize));
    }
    
    setBatchState({
      isActive: true,
      type: type,
      chunks: newChunks,
      currentIndex: 0,
      status: "processing",
      message: "",
      error: "",
      schemaConfig: type === "schema" ? {
        namespace: schemaNamespace,
        key: schemaKey,
        type: schemaType,
        value: schemaValue
      } : {}
    });
  }, [safeProducts, selectedIds, schemaNamespace, schemaKey, schemaType, schemaValue]);

  // Handle batch processing steps (Payload Assembly)
  useEffect(() => {
    const isProcessing = batchState.isActive ? (batchState.status === "processing") : false;
    
    if (isProcessing) {
      const currentChunk = batchState.chunks[batchState.currentIndex];
      
      if (currentChunk) {
        setBatchState(prev => ({ ...prev, status: "waiting_for_network" }));
        
        const isOoak = batchState.type === "ooak";
        const isOrigins = batchState.type === "origins";
        const isSchema = batchState.type === "schema";
        const isReforge = batchState.type === "reforge";

        if (isOoak || isOrigins || isSchema) {
          const payload = [];

          if (isOoak) {
            currentChunk.forEach(p => {
              const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
              payload.push({ ownerId: formatId, namespace: "custom", key: "is_one_of_a_kind", value: "Yes — one of a kind", type: "single_line_text_field" });
            });
          }

          if (isOrigins) {
            currentChunk.forEach(p => {
              const parts = p.title.split(" — ");
              const hasOriginPart = parts.length >= 3;
              if (hasOriginPart) {
                const origin = parts[1].trim();
                const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
                payload.push({ ownerId: formatId, namespace: "custom", key: "collection_location", value: origin, type: "single_line_text_field" });
              }
            });
          }

          if (isSchema) {
            currentChunk.forEach(p => {
              const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
              payload.push({
                ownerId: formatId,
                namespace: batchState.schemaConfig.namespace ? batchState.schemaConfig.namespace : "custom",
                key: batchState.schemaConfig.key,
                value: batchState.schemaConfig.value,
                type: batchState.schemaConfig.type ? batchState.schemaConfig.type : "single_line_text_field"
              });
            });
          }

          const hasUpdates = payload.length > 0;
          if (hasUpdates) {
            fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post", action: "/app/meta-injector-api" });
          } else {
            setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
          }
        } else if (isReforge) {
          const p = currentChunk[0];
          const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
          
          const titleSegments = p.title.split(/\s+[-—–]\s+/);
          const derivedFamily = titleSegments[0] ? titleSegments[0].trim() : "";
          const derivedOrigin = titleSegments[1] ? titleSegments[1].trim() : "";
          const pieceName = titleSegments[2] ? titleSegments[2].trim() : "New Piece";

          const getMeta = (k) => {
            const edge = p.metafields?.edges ? p.metafields.edges.find(e => e.node.key === k) : null;
            return edge ? edge.node.value : "";
          };

          const imageUrl = p.images?.edges?.[0]?.node?.url ? p.images.edges[0].node.url : (p.featuredImage?.url ? p.featuredImage.url : "");

          const formData = new FormData();
          formData.append("intent", "fullRescan");
          formData.append("productId", formatId);
          formData.append("stone_family", getMeta("stone_family") ? getMeta("stone_family") : derivedFamily);
          formData.append("origin_handle", getMeta("origin_handle"));
          formData.append("piece_name", getMeta("piece_name") ? getMeta("piece_name") : pieceName);
          formData.append("productTitle", p.title);
          formData.append("imageUrl", imageUrl);
          formData.append("origin_story", getMeta("origin_story"));
          formData.append("honest_flaws_and_character", getMeta("honest_flaws_and_character"));
          formData.append("price", getMeta("price"));

          fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
        }
      } else {
        setBatchState(prev => ({ ...prev, isActive: false, status: "complete", message: "Operation completed successfully across all target products." }));
      }
    }
  }, [batchState, fetcher]);

  // Handle network lock for batch processor
  useEffect(() => {
    const isWaitingForNetwork = batchState.status === "waiting_for_network";
    const isFetcherActive = fetcher.state !== "idle";
    
    if (isWaitingForNetwork ? isFetcherActive : false) {
      setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
    }
  }, [batchState.status, fetcher.state]);

  // --- System Governor: Listeners & Pipeline Handlers ---
  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined ? (fetcher.data !== null) : false;

    if (isIdle ? hasData : false) {
      const data = fetcher.data;
      
      // Standalone AI Forge listener
      if (data.intent === "generateSEO" ? data.success === true : false) {
        setGeneratedOutput(data.seoDescription ? data.seoDescription : (data.text ? data.text : ""));
      }

      // Batch Operation Listeners
      if (batchState.isActive) {
        const isAutofillResponse = data.intent === "fullRescan" ? true : (data.intent === "visionScan" ? true : (data.intent === "tab2AutoFill" ? true : false));
        const isSaveResponse = data.intent === "saveMetafields" ? true : (data.intent === "saveProduct" ? true : false);

        if (isAutofillResponse) {
          if (data.success ? data.tab2Data : false) {
            const p = batchState.chunks[batchState.currentIndex][0];
            const formatId = p.id.includes("gid://") ? p.id : `gid://shopify/Product/${p.id}`;
            const savePayload = [];
            
            Object.entries(data.tab2Data).forEach(([key, val]) => {
              if (key === "shopify_title" ? true : (key === "debug_origin" ? true : (key === "pieceId" ? true : false))) return;
              
              if (val !== undefined ? (val !== null ? (String(val).trim() !== "") : false) : false) {
                const isMulti = ["honest_flaws_and_character", "origin_story", "generated_description", "artist_notes"].includes(key);
                const type = isMulti ? "multi_line_text_field" : "single_line_text_field";
                savePayload.push({
                  ownerId: formatId,
                  namespace: "custom",
                  key: key,
                  type: type,
                  value: String(val).replace(/\\[rn]/g, " ").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim()
                });
              }
            });

            if (savePayload.length > 0) {
              const descHtml = data.tab2Data.generated_description ? data.tab2Data.generated_description : "";
              fetcher.submit({ 
                intent: "saveMetafields", 
                payload: JSON.stringify(savePayload),
                productId: formatId,
                productTitle: p.title,
                descriptionHtml: descHtml
              }, { method: "post", action: "/app/meta-injector-api" });
              setBatchState(prev => ({ ...prev, status: "waiting_for_network" }));
            } else {
              setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
            }
          } else {
            setBatchState(prev => ({ ...prev, isActive: false, error: "Re-Forge halted: AI Engine failed to return valid data." }));
          }
        } else if (isSaveResponse) {
          if (data.success) {
            setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
          } else {
            setBatchState(prev => ({ ...prev, isActive: false, error: "Operation halted: Save failed. " + (data.error ? data.error : data.message) }));
          }
        }
      }
    }
  }, [fetcher.state, fetcher.data, batchState.isActive, batchState.chunks, batchState.currentIndex]);

  // Handle governor pause between chunks
  useEffect(() => {
    const isWaitingForIdle = batchState.status === "waiting_for_idle";
    const isFetcherIdle = fetcher.state === "idle";
    
    if (isWaitingForIdle ? isFetcherIdle : false) {
      setBatchState(prev => ({ ...prev, status: "paused" }));
      setTimeout(() => {
        setBatchState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, status: "processing" }));
      }, 1000); // 1-second pause protects the API
    }
  }, [batchState.status, fetcher.state]);

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
        
        const hasMetafields = p.metafields ? p.metafields.edges : false;
        if (hasMetafields) {
          p.metafields.edges.forEach(({ node }) => {
            const isRockhound = node.namespace === "rockhound" ? true : (node.namespace === "custom" ? true : false);
            if (isRockhound) {
              fieldMap[node.key] = node.value;
            }
          });
        }
        
        ROCKHOUND_FIELDS.forEach(f => {
          const val = fieldMap[f.key] ? fieldMap[f.key] : "";
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
        const hasMetafields = p.metafields ? p.metafields.edges : false;
        
        if (hasMetafields) {
          p.metafields.edges.forEach(({ node }) => {
            const isRockhound = node.namespace === "rockhound" ? true : (node.namespace === "custom" ? true : false);
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

  const isGeneratingSEO = fetcher.state !== "idle" ? (fetcher.formData?.get("intent") === "generateSEO") : false;

  const getProductImage = (p) => {
    if (p.featuredImage?.url) return p.featuredImage.url;
    if (p.images?.edges?.[0]?.node?.url) return p.images.edges[0].node.url;
    if (p.image?.url) return p.image.url;
    if (p.image?.src) return p.image.src;
    if (Array.isArray(p.images) ? p.images.length > 0 : false) {
      return p.images[0].url ? p.images[0].url : (p.images[0].src ? p.images[0].src : (typeof p.images[0] === 'string' ? p.images[0] : null));
    }
    return null;
  };

  return (
    <BlockStack gap="600">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Target Product Selection</Text>
              <Text as="p" tone="subdued">{selectedIds.size} of {safeProducts.length} total selected</Text>
              
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label="Search Products"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  clearButton
                  onClearButtonClick={handleClearSearch}
                  autoComplete="off"
                />
              </div>

              <div style={{ minHeight: "54px" }}>
                <Button size="large" fullWidth onClick={toggleSelectAllFiltered}>
                  {allFilteredSelected 
                    ? `Deselect All (${filteredProducts.length})` 
                    : `Select All (${filteredProducts.length})`}
                </Button>
              </div>

              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  const isChecked = selectedIds.has(p.id);
                  const imageUrl = getProductImage(p);
                  
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
                      <div style={{ width: "40px", height: "40px", flexShrink: 0, backgroundColor: "#e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : null}
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
                
                {batchState.message !== "" ? (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="success" title="Sweep Complete">
                      <Text as="p">{batchState.message}</Text>
                    </Banner>
                  </div>
                ) : null}

                {batchState.error !== "" ? (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="critical" title="Sweep Error">
                      <Text as="p">{batchState.error}</Text>
                    </Banner>
                  </div>
                ) : null}

                {batchState.isActive ? (
                  <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                    <BlockStack gap="200">
                      <Text as="p" fontWeight="bold">Processing Batch {batchState.currentIndex + 1} of {batchState.chunks.length}</Text>
                      <Text as="p" tone="subdued">System Governor active. Status: {batchState.status}</Text>
                      <div style={{ width: "100%", height: "12px", backgroundColor: "#E1E3E5", borderRadius: "6px", overflow: "hidden", marginTop: "8px" }}>
                        <div style={{ width: `${((batchState.currentIndex) / batchState.chunks.length) * 100}%`, height: "100%", backgroundColor: "#2C6ECB", transition: "width 0.3s ease" }}></div>
                      </div>
                    </BlockStack>
                  </Box>
                ) : null}

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
                <Text variant="headingLg" as="h2">Section 3: Schema Expander</Text>
                <Text tone="subdued" as="p">Inject a new metafield key and default value globally into selected inventory.</Text>
                <InlineStack gap="300">
                  <div style={{ flexGrow: 1 }}>
                    <TextField label="Namespace" value={schemaNamespace} onChange={setSchemaNamespace} autoComplete="off" />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <TextField label="Key" value={schemaKey} onChange={setSchemaKey} placeholder="e.g. uv_reactivity" autoComplete="off" />
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <Select 
                      label="Type" 
                      options={[
                        {label: "Single Line Text", value: "single_line_text_field"}, 
                        {label: "Multi Line Text", value: "multi_line_text_field"}, 
                        {label: "Number (Decimal)", value: "number_decimal"}, 
                        {label: "Boolean", value: "boolean"}
                      ]} 
                      value={schemaType} 
                      onChange={setSchemaType} 
                    />
                  </div>
                </InlineStack>
                <TextField label="Default Value" value={schemaValue} onChange={setSchemaValue} placeholder="e.g. Not Tested" autoComplete="off" />
                <Button size="large" fullWidth onClick={() => startBatchSweep("schema")} disabled={!schemaKey ? true : (!schemaValue ? true : batchState.isActive)}>
                  Inject New Schema Globally
                </Button>
              </BlockStack>
            </Card>

            <Card padding="400" background="bg-surface-warning">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Section 4: Global Re-Forge (The Anvil)</Text>
                <Text tone="subdued" as="p">WARNING: This feeds raw stone data for every selected product back through the AI Engine to mass-rewrite descriptions to the new 7-block format. Runs 1 product per cycle to protect the API.</Text>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "54px" }}>
                   <input type="checkbox" checked={reforgeSafetyOff} onChange={(e) => setReforgeSafetyOff(e.target.checked)} style={{ width: "24px", height: "24px", cursor: "pointer" }} />
                   <Text as="span" fontWeight="bold">Disengage Safety (Enable Re-Forge)</Text>
                </div>
                <Button size="large" tone="critical" fullWidth onClick={() => startBatchSweep("reforge")} disabled={!reforgeSafetyOff ? true : batchState.isActive}>
                  Initiate Global Re-Forge
                </Button>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Section 5: Safety Nets</Text>
                
                {safetyMessage !== "" ? (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="success" title="File Download Started">
                      <Text as="p">{safetyMessage}</Text>
                    </Banner>
                  </div>
                ) : null}

                {safetyError !== "" ? (
                  <div style={{ minHeight: "54px" }}>
                    <Banner tone="critical" title="File Creation Failed">
                      <Text as="p">{safetyError}</Text>
                    </Banner>
                  </div>
                ) : null}

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
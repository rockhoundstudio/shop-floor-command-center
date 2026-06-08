import React, { useState, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, InlineStack, Icon
} from "@shopify/polaris";
import { MagicIcon, SaveIcon, PlusIcon } from "@shopify/polaris-icons";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

const ROCKHOUND_FIELDS = [
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "primary_medium", label: "Primary Medium", type: "single_line_text_field" },
  { key: "secondary_medium", label: "Secondary Medium", type: "single_line_text_field" },
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "material", label: "Material", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field" },
  { key: "color", label: "Color", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut and Shape", type: "single_line_text_field" },
  { key: "surface_finish", label: "Surface Finish", isDropdown: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "collection_name", label: "Collection Name", type: "single_line_text_field" },
  { key: "collection_location", label: "Collection Location", type: "single_line_text_field" },
  { key: "collection_date", label: "Collection Date", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", isDropdown: true },
  { key: "setting_ready", label: "Setting Ready", isDropdown: true },
  { key: "bail_included", label: "Bail Included", isDropdown: true },
  { key: "is_one_of_a_kind", label: "Is One of a Kind", isDropdown: true },
  { key: "treated", label: "Treated", isDropdown: true },
  { key: "found_object", label: "Found Object", isDropdown: true },
  { key: "wire_material", label: "Wire Material", isDropdown: true },
  { key: "artist_notes", label: "Artist Notes", type: "single_line_text_field", multiline: true }
];

const DEFAULT_DROPDOWNS = {
  surface_finish: ["High polish lapidary finish", "Satin lapidary finish", "Raw natural surface", "Partial polish", "Tumble polished", "Hand rubbed finish"],
  primary_use: ["Wearable pendant", "Lapidary cabochon for setting", "Wire wrapped jewelry", "Display specimen", "Collector piece", "Freeform stone art", "Bezel setting ready", "Rockhound specimen"],
  setting_ready: ["Yes — bezel ready", "Yes — prong ready", "Needs evaluation", "No — display only"],
  bail_included: ["No bail", "Pinch bail included", "Custom copper wire bail", "Custom gold plated bail", "Soldered bail"],
  is_one_of_a_kind: ["Yes — one of a kind", "No — series piece"],
  treated: ["Untreated — natural", "Stabilized", "Dyed", "Coated", "Heat treated"],
  found_object: ["Wild collected — Bob and Janyce", "Customer submission", "Purchased rough", "Gifted specimen", "Rescued material"],
  wire_material: ["Copper wire", "Brass wire", "Sterling silver wire", "Gold plated wire", "Copper and brass mixed"]
};

// --- TAB 1: NEW PRODUCT INTAKE ---
function NewProductIntakeTab({ fetcher }) {
  const [sharedFields, setSharedFields] = useState({
    material: "",
    collection_location: "",
    collection_date: "",
    origin_story: "",
    treated: "",
    stone_family: ""
  });

  const [pieces, setPieces] = useState([
    { id: Date.now().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }
  ]);

  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  }, []);

  const handleAddRow = useCallback(() => {
    setPieces(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }
    ]);
  }, []);

  const handleRemoveRow = useCallback((id) => {
    setPieces(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    const payload = {
      sharedFields,
      rows: pieces
    };

    fetcher.submit(
      { intent: "createProduct", pieces: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [sharedFields, pieces, fetcher]);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;

    if (isIdle && hasData) {
      const isCreate = fetcher.data.intent === "createProduct";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if (isCreate && isSuccess) {
        setStatusMessage(`Successfully created ${fetcher.data.createdCount || 0} pieces.`);
        setPieces([{ id: Date.now().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }]);
      }

      if (isCreate && isError) {
        setErrorMessage(fetcher.data.error || "An error occurred during product creation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const isSubmitting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct";
  const safeTreatedVal = DEFAULT_DROPDOWNS.treated.includes(sharedFields.treated) ? sharedFields.treated : "";
  const treatedOptions = [
    { label: safeTreatedVal !== "" ? safeTreatedVal : "Select...", value: safeTreatedVal },
    ...DEFAULT_DROPDOWNS.treated.filter(o => o !== safeTreatedVal).map(o => ({ label: o, value: o }))
  ];

  return (
    <BlockStack gap="600">
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section A: Shared Batch Fields</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label="Material"
                value={sharedFields.material}
                onChange={(v) => handleSharedFieldChange("material", v)}
                autoComplete="off"
                accessibilityLabel="Enter shared material"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label="Stone Family"
                value={sharedFields.stone_family}
                onChange={(v) => handleSharedFieldChange("stone_family", v)}
                autoComplete="off"
                accessibilityLabel="Enter shared stone family"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label="Collection Location"
                value={sharedFields.collection_location}
                onChange={(v) => handleSharedFieldChange("collection_location", v)}
                autoComplete="off"
                accessibilityLabel="Enter shared collection location"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label="Collection Date"
                value={sharedFields.collection_date}
                onChange={(v) => handleSharedFieldChange("collection_date", v)}
                autoComplete="off"
                accessibilityLabel="Enter shared collection date"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label="Origin Story"
                value={sharedFields.origin_story}
                onChange={(v) => handleSharedFieldChange("origin_story", v)}
                autoComplete="off"
                multiline={2}
                accessibilityLabel="Enter shared origin story"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <Select
                label="Treated"
                options={treatedOptions}
                value={DEFAULT_DROPDOWNS.treated?.includes(sharedFields.treated) ? sharedFields.treated : ""}
                onChange={(v) => handleSharedFieldChange("treated", v)}
                accessibilityLabel="Select shared treated status"
              />
            </div>
          </div>
        </BlockStack>
      </Card>

      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section B: Per-Piece Rows</Text>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {pieces.map((piece, index) => (
              <div key={piece.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "16px", alignItems: "end" }}>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Piece Name"
                    value={piece.piece_name}
                    onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Dimensions (mm)"
                    value={piece.dimensions_mm}
                    onChange={(v) => handlePieceChange(piece.id, "dimensions_mm", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Dimensions for row ${index + 1}`}
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Cut & Shape"
                    value={piece.cut_and_shape}
                    onChange={(v) => handlePieceChange(piece.id, "cut_and_shape", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Cut and Shape for row ${index + 1}`}
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label="Price"
                    value={piece.price}
                    onChange={(v) => handlePieceChange(piece.id, "price", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Price for row ${index + 1}`}
                  />
                </div>
                <div style={{ minHeight: "54px", width: "120px" }}>
                  <Button
                    size="large"
                    tone="critical"
                    fullWidth
                    onClick={() => handleRemoveRow(piece.id)}
                    disabled={pieces.length <= 1}
                    accessibilityLabel={`Remove row ${index + 1}`}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div style={{ minHeight: "54px", marginTop: "16px" }}>
            <Button
              icon={PlusIcon}
              size="large"
              onClick={handleAddRow}
              accessibilityLabel="Add new piece row"
            >
              Add Row
            </Button>
          </div>
        </BlockStack>
      </Card>

      {statusMessage !== "" && (
        <div style={{ minHeight: "54px" }}>
          <Banner tone="success" title="Operation Successful">
            <Text as="p">{statusMessage}</Text>
          </Banner>
        </div>
      )}

      {errorMessage !== "" && (
        <div style={{ minHeight: "54px" }}>
          <Banner tone="critical" title="Operation Failed">
            <Text as="p">{errorMessage}</Text>
          </Banner>
        </div>
      )}

      <div style={{ minHeight: "54px" }}>
        <Button
          size="large"
          variant="primary"
          tone="success"
          fullWidth
          onClick={handleCreateAll}
          loading={isSubmitting}
          accessibilityLabel="Submit and Create All Pieces"
        >
          Create All Pieces
        </Button>
      </div>
    </BlockStack>
  );
}

// --- TAB 2: THE INTAKE BENCH ---
function IntakeBenchTab({ products, fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    const product = products.find(p => p.id === id);
    const newForm = {};
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      product.metafields.edges.forEach(({ node }) => {
        const isRockhound = node.namespace === "rockhound";
        const hasValue = node.value !== null && node.value !== undefined;
        if (isRockhound && hasValue) {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);

    fetcher.submit(
      { intent: "smartAutoFill", productId: id },
      { method: "post" }
    );
  }, [products, fetcher]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    fetcher.submit(
      { intent: "autoFill", productId: selectedProductId },
      { method: "post" }
    );
  }, [selectedProductId, fetcher]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    
    const payload = [];
    const entries = Object.entries(formState);
    
    entries.forEach(([key, value]) => {
      const isPopulated = value !== undefined && value !== null && value.toString().trim() !== "";
      
      if (isPopulated) {
        const config = ROCKHOUND_FIELDS.find(f => f.key === key);
        let fieldType = "single_line_text_field";
        if (config && config.type) {
          fieldType = config.type;
        }
        
        let formatId = `gid://shopify/Product/${selectedProductId}`;
        if (selectedProductId.includes("gid://")) {
          formatId = selectedProductId;
        }

        payload.push({
          ownerId: formatId,
          namespace: "rockhound",
          key: key,
          value: value.toString().trim(),
          type: fieldType 
        });
      }
    });

    if (payload.length === 0) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedProductId, formState, fetcher]);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;
    
    if (isIdle && hasData) {
      const isAutoFill = fetcher.data.intent === "autoFill";
      const isSmartAutoFill = fetcher.data.intent === "smartAutoFill";
      const isSaveProduct = fetcher.data.intent === "saveProduct";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if ((isAutoFill || isSmartAutoFill) && isSuccess) {
        setFormState(prev => {
          const updatedState = { ...prev };
          if (fetcher.data.autoFillData) {
            Object.entries(fetcher.data.autoFillData).forEach(([key, val]) => {
              const isMissing = !updatedState[key] || updatedState[key].toString().trim() === "";
              const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "";
              if (isMissing && hasNewValue) {
                updatedState[key] = val;
              }
            });
          }
          return updatedState;
        });

        if (isSmartAutoFill) {
          setStatusMessage("Smart Auto-Fill complete — fields populated from all available data sources.");
        }
        
        if (isAutoFill) {
          setStatusMessage("Title and tags successfully parsed and loaded into fields.");
        }
      }

      if (isSaveProduct && isSuccess) {
        setStatusMessage("Metafields injected cleanly into Shopify database.");
      }

      if (isError) {
        setErrorMessage(fetcher.data.error || "An unknown error occurred during the operation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const safeProducts = products || [];
  const isAutoFilling = fetcher.state !== "idle" && (fetcher.formData?.get("intent") === "autoFill" || fetcher.formData?.get("intent") === "smartAutoFill");
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct";

  return (
    <BlockStack gap="400">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory</Text>
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {safeProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  return (
                    <div key={p.id} style={{ minHeight: "54px" }}>
                      <Button
                        fullWidth
                        size="large"
                        textAlign="left"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => handleSelectProduct(p.id)}
                        accessibilityLabel={`Select product ${p.title}`}
                      >
                        {p.title}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">2. Data Sieve & Injection</Text>
              
              {statusMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{statusMessage}</Text>
                  </Banner>
                </div>
              )}

              {errorMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{errorMessage}</Text>
                  </Banner>
                </div>
              )}

              <InlineStack gap="300" align="space-between">
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={MagicIcon} 
                    onClick={handleAutoFill}
                    accessibilityLabel="Re-Run Auto-Fill Fields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isAutoFilling}
                  >
                    Re-Run Auto-Fill
                  </Button>
                </div>
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={SaveIcon} 
                    tone="success" 
                    variant="primary" 
                    onClick={handleInject}
                    accessibilityLabel="Inject Metafields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isSaving}
                  >
                    Inject Metafields
                  </Button>
                </div>
              </InlineStack>

              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {ROCKHOUND_FIELDS.map(field => {
                  const val = formState[field.key] || "";
                  const isDropdown = field.isDropdown === true;
                  const isText = !field.isDropdown;
                  
                  let safeVal = val;
                  let options = [];

                  if (isDropdown) {
                    const dropdownOptions = DEFAULT_DROPDOWNS[field.key] || [];
                    safeVal = dropdownOptions.includes(val) ? val : "";
                    options = [
                      { label: safeVal !== "" ? safeVal : "Select...", value: safeVal },
                      ...dropdownOptions.filter(o => o !== safeVal).map(o => ({ label: o, value: o }))
                    ];
                  }
                  
                  return (
                    <div key={field.key} style={{ minHeight: "54px" }}>
                      {isDropdown && (
                        <Select
                          label={field.label}
                          options={options}
                          value={DEFAULT_DROPDOWNS[field.key]?.includes(val) ? val : ""}
                          onChange={(v) => updateFormState(field.key, v)}
                          accessibilityLabel={`Select value for ${field.label}`}
                          disabled={!selectedProductId}
                        />
                      )}

                      {isText && (
                        <TextField
                          label={field.label}
                          value={val}
                          onChange={(v) => updateFormState(field.key, v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter text for ${field.label}`}
                          multiline={field.multiline && 3}
                          disabled={!selectedProductId}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>
      </div>
    </BlockStack>
  );
}

// --- TAB 3: OPERATIONS MATRIX ---
function OperationsMatrixTab({ products, fetcher }) {
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
              namespace: "rockhound",
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
                namespace: "rockhound",
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

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const navigate = useNavigate();
  const primaryFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'new-intake', content: '1. New Product Intake', accessibilityLabel: 'New Product Intake Tab' },
    { id: 'intake', content: '2. Intake Bench (Janyce)', accessibilityLabel: 'Intake Bench Tab' },
    { id: 'ops', content: '3. Operations Matrix', accessibilityLabel: 'Operations Matrix Tab' }
  ];

  const hasErrors = primaryFetcher.data && primaryFetcher.data.errors && primaryFetcher.data.errors.length > 0;
  const isTabOne = selectedTab === 0;
  const isTabTwo = selectedTab === 1;
  const isTabThree = selectedTab === 2;

  return (
    <Frame>
      <Page
        fullWidth
        title="Shop Floor Command Center"
        subtitle="Data Integrity & Operations Hub"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {hasErrors && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {primaryFetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="600" background="bg-surface-secondary">
                  {isTabOne && <NewProductIntakeTab fetcher={primaryFetcher} />}
                  {isTabTwo && <IntakeBenchTab products={products} fetcher={primaryFetcher} />}
                  {isTabThree && <OperationsMatrixTab products={products} fetcher={primaryFetcher} />}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
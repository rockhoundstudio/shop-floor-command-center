import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate, Form } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, InlineStack, DataTable, Badge, Icon
} from "@shopify/polaris";
import { MagicIcon, ExportIcon, SaveIcon, DatabaseIcon, SearchIcon } from "@shopify/polaris-icons";

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

// --- TAB 1: FIELD MATRIX ---
function FieldMatrixTab({ products }) {
  const fetcher = useFetcher();
  const [filterMissing, setFilterMissing] = useState(false);
  const [enrichedProducts, setEnrichedProducts] = useState([]);
  
  const [batchState, setBatchState] = useState({
    isActive: true,
    currentIndex: 0,
    status: "idle"
  });

  const chunks = useMemo(() => {
    if (!products) return [];
    const arr = [];
    for (let i = 0; i < products.length; i += 10) {
      arr.push(products.slice(i, i + 10));
    }
    return arr;
  }, [products]);

  useEffect(() => {
    if (products && enrichedProducts.length === 0) {
      setEnrichedProducts(products);
    }
  }, [products, enrichedProducts.length]);

  // Phase 1: Fire Chunk Fetch
  useEffect(() => {
    if (batchState.isActive && batchState.status === "idle" && chunks.length > 0) {
      const currentChunk = chunks[batchState.currentIndex];
      if (currentChunk) {
        setBatchState(prev => ({ ...prev, status: "submitting" }));
        const ids = currentChunk.map(p => p.id);
        fetcher.submit(
          { intent: "fetchMetafieldsBatch", productIds: JSON.stringify(ids) },
          { method: "post" }
        );
      }
      if (!currentChunk) {
        setBatchState(prev => ({ ...prev, isActive: false, status: "complete" }));
      }
    }
  }, [batchState, chunks, fetcher]);

  // Phase 2: Wait for fetcher
  useEffect(() => {
    if (batchState.status === "submitting" && fetcher.state !== "idle") {
      setBatchState(prev => ({ ...prev, status: "waiting_for_idle" }));
    }
  }, [batchState.status, fetcher.state]);

  // Phase 3: Process payload & pause governor
  useEffect(() => {
    if (batchState.status === "waiting_for_idle" && fetcher.state === "idle") {
      if (fetcher.data && fetcher.data.intent === "fetchMetafieldsBatch" && fetcher.data.success && fetcher.data.products) {
        setEnrichedProducts(prev => {
          const updated = [...prev];
          fetcher.data.products.forEach(fetchedProd => {
            const idx = updated.findIndex(p => p.id === fetchedProd.id);
            if (idx !== -1) {
              updated[idx] = { ...updated[idx], metafields: fetchedProd.metafields };
            }
          });
          return updated;
        });
      }
      
      setTimeout(() => {
        setBatchState(prev => ({ 
          ...prev, 
          currentIndex: prev.currentIndex + 1, 
          status: "idle" 
        }));
      }, 500); 
    }
  }, [batchState.status, fetcher.state, fetcher.data]);

  const tableData = useMemo(() => {
    let filtered = enrichedProducts || [];
    
    if (filterMissing) {
      filtered = filtered.filter(p => {
        let hasEmpty = false;
        ROCKHOUND_FIELDS.forEach(f => {
          let val = null;
          if (p.metafields && p.metafields.edges) {
            const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
            if (edge) val = edge.node.value;
          }
          if (!val) hasEmpty = true;
        });
        return hasEmpty;
      });
    }

    return filtered.map(p => {
      const row = [p.title];
      ROCKHOUND_FIELDS.forEach(f => {
        let valStr = "";
        if (p.metafields && p.metafields.edges) {
          const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
          if (edge && edge.node.value) valStr = edge.node.value.toString().trim().toLowerCase();
        }

        let dotColor = "#C62828";
        let ariaText = "Critical Empty";
        
        if (valStr !== "") {
          dotColor = "#2E7D32";
          ariaText = "Success Verified";
        }
        if (valStr === "n/a" || valStr === "bulk") {
          dotColor = "#F9A825";
          ariaText = "Warning Unverified";
        }

        row.push(
          <div style={{ display: 'flex', justifyContent: 'center' }} aria-label={ariaText}>
            <svg width="14" height="14" viewBox="0 0 14 14" role="img" aria-label={ariaText}>
              <circle cx="7" cy="7" r="7" fill={dotColor} />
            </svg>
          </div>
        );
      });
      return row;
    });
  }, [enrichedProducts, filterMissing]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Field Health Matrix</Text>
            <div style={{ minHeight: "54px" }}>
              <Button 
                onClick={() => setFilterMissing(!filterMissing)}
                accessibilityLabel="Filter by missing data"
                size="large"
              >
                {filterMissing && "Show All"}
                {!filterMissing && "Filter Missing Data"}
              </Button>
            </div>
          </InlineStack>

          {batchState.isActive && (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  Fetching product data (Batch {batchState.currentIndex + 1} of {chunks.length})...
                </Text>
                <div style={{ width: "100%", height: "8px", backgroundColor: "#E1E3E5", borderRadius: "4px", overflow: "hidden" }}>
                  <div style={{ width: `${((batchState.currentIndex) / chunks.length) * 100}%`, height: "100%", backgroundColor: "#2C6ECB", transition: "width 0.3s ease" }}></div>
                </div>
              </BlockStack>
            </Box>
          )}

          <Box paddingBlockStart="200">
            <InlineStack gap="400">
              <Badge tone="success">Success (Verified)</Badge>
              <Badge tone="warning">Warning (Bulk/Unverified)</Badge>
              <Badge tone="critical">Critical (Empty)</Badge>
              <Text tone="subdued" as="span">| Google Required vs Store OOAK Fields mapped below</Text>
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>
      <Card padding="0">
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "60vh" }}>
          <DataTable
            columnContentTypes={["text", ...ROCKHOUND_FIELDS.map(() => "text")]}
            headings={["Product", ...ROCKHOUND_FIELDS.map(f => f.label)]}
            rows={tableData}
            stickyHeader
          />
        </div>
      </Card>
    </BlockStack>
  );
}

// --- TAB 2: PRODUCT EDITOR ---
function ProductEditorTab({ products, fetcher, shopify }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState({});
  const [dropdownLists] = useState(DEFAULT_DROPDOWNS);

  const filteredProducts = useMemo(() => {
    const safeProducts = products || [];
    if (!searchQuery) return safeProducts;
    return safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  useEffect(() => {
    if (selectedProductId && searchQuery) {
      const selected = products?.find(p => p.id === selectedProductId);
      if (selected && !selected.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        setSelectedProductId("");
        setFormState({});
      }
    }
  }, [searchQuery, selectedProductId, products]);

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    const product = products.find(p => p.id === id);
    const newForm = {};
    if (product && product.metafields && product.metafields.edges) {
      product.metafields.edges.forEach(({ node }) => {
        if (node.namespace === "rockhound" && node.value) {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);
  }, [products]);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    fetcher.submit(
      { intent: "autoFill", productId: selectedProductId },
      { method: "post" }
    );
  }, [selectedProductId, fetcher]);

  const handleSave = useCallback(() => {
    if (!selectedProductId) return;
    const payload = [];
    const validEntries = Object.entries(formState).filter(([key, value]) => value !== undefined && value.toString().trim() !== "");
    
    validEntries.forEach(([key, value]) => {
      const config = ROCKHOUND_FIELDS.find(f => f.key === key);
      const fieldType = config && config.type ? config.type : "single_line_text_field";
      const formatId = selectedProductId.includes("gid://") ? selectedProductId : `gid://shopify/Product/${selectedProductId}`;

      payload.push({
        ownerId: formatId,
        namespace: "rockhound",
        key,
        value: value.toString(),
        type: fieldType 
      });
    });

    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedProductId, formState, fetcher]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "autoFill" && fetcher.data.success) {
      setFormState(prev => ({ ...prev, ...fetcher.data.autoFillData }));
      if (shopify) shopify.toast.show("Auto-filled from Shopify data");
    }
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "saveProduct" && fetcher.data.success) {
      if (shopify) shopify.toast.show("Metafields saved successfully");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ minHeight: "54px" }}>
            <TextField
              label="Search / Filter Products"
              value={searchQuery}
              onChange={setSearchQuery}
              prefix={<Icon source={SearchIcon} />}
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
              autoComplete="off"
              accessibilityLabel="Search products to filter the list below"
              placeholder="Start typing a product name..."
            />
          </div>

          <Box paddingBlockStart="200">
            <Text variant="headingSm" as="h3">Target Roster ({filteredProducts.length})</Text>
            <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid #E1E3E5", padding: "8px", borderRadius: "8px", marginTop: "8px" }}>
              {filteredProducts.map(p => {
                const isSelected = selectedProductId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProduct(p.id)}
                    style={{
                      padding: "12px",
                      borderBottom: "1px solid #F0F2F4",
                      cursor: "pointer",
                      backgroundColor: isSelected ? "#F3F4F6" : "transparent",
                      fontWeight: isSelected ? "bold" : "normal",
                      borderRadius: "4px"
                    }}
                  >
                    {p.title}
                  </div>
                );
              })}
              {filteredProducts.length === 0 && (
                <Box padding="200">
                  <Text tone="subdued" as="p">No products match your search.</Text>
                </Box>
              )}
            </div>
          </Box>
          
          {selectedProductId !== "" && (
            <InlineStack gap="300" align="end">
              <div style={{ minHeight: "54px" }}>
                <Button 
                  icon={MagicIcon} 
                  onClick={handleAutoFill}
                  accessibilityLabel="Auto-Fill Fields"
                  size="large"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoFill"}
                >
                  Auto-Fill Title & Tags
                </Button>
              </div>
              <div style={{ minHeight: "54px" }}>
                <Button 
                  icon={SaveIcon} 
                  tone="success" 
                  variant="primary" 
                  onClick={handleSave}
                  accessibilityLabel="Save to Shopify"
                  size="large"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct"}
                >
                  Save to Shopify
                </Button>
              </div>
            </InlineStack>
          )}
        </BlockStack>
      </Card>

      {selectedProductId !== "" && (
        <Card padding="400">
          <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {ROCKHOUND_FIELDS.map(field => {
              const val = formState[field.key] || "";
              
              return (
                <React.Fragment key={field.key}>
                  {field.isDropdown && (
                    <div style={{ minHeight: "54px" }}>
                      <Select
                        label={field.label}
                        options={[{ label: "Select...", value: "" }, ...(dropdownLists[field.key] || []).map(o => ({ label: o, value: o }))]}
                        value={val}
                        onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                        accessibilityLabel={field.label}
                      />
                    </div>
                  )}

                  {!field.isDropdown && (
                    <div style={{ minHeight: "54px" }}>
                      <TextField
                        label={field.label}
                        value={val}
                        onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                        autoComplete="off"
                        accessibilityLabel={field.label}
                        multiline={field.multiline && 3}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </Card>
      )}
    </BlockStack>
  );
}

// --- TAB 3: BULK TOOLS (BATCH PRESS) ---
function BulkToolsTab({ products, fetcher, shopify }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [formState, setFormState] = useState({});
  const [dropdownLists] = useState(DEFAULT_DROPDOWNS);
  const [batchState, setBatchState] = useState({
    isActive: false,
    productChunks: [],
    currentIndex: 0,
    status: "idle"
  });

  const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
      chunked.push(array.slice(i, i + size));
    }
    return chunked;
  };

  const toggleProduct = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => {
    const allIds = (products || []).map(p => p.id);
    setSelectedIds(allIds);
  };

  const clearAll = () => {
    setSelectedIds([]);
  };

  const updateFormState = (key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  };

  const handleStartBatch = () => {
    const validEntries = Object.entries(formState).filter(([k, v]) => v !== undefined && v.toString().trim() !== "");
    if (validEntries.length === 0) return;
    if (selectedIds.length === 0) return;

    const chunks = chunkArray(selectedIds, 10);
    setBatchState({
      isActive: true,
      productChunks: chunks,
      currentIndex: 0,
      status: "processing"
    });
  };

  useEffect(() => {
    if (batchState.isActive && batchState.status === "processing") {
      const currentChunk = batchState.productChunks[batchState.currentIndex];
      
      if (currentChunk) {
        setBatchState(prev => ({ ...prev, status: "waiting_for_submitting_state" }));

        const payload = [];
        const validEntries = Object.entries(formState).filter(([k, v]) => v !== undefined && v.toString().trim() !== "");

        current
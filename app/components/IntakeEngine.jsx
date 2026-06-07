import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Card, BlockStack, InlineStack, Text, Box, TextField, Select, 
  Button, Icon, Checkbox, Collapsible, Divider 
} from "@shopify/polaris";
import { SearchIcon, MagicIcon, SaveIcon, PlusIcon } from "@shopify/polaris-icons";

// --- THE FIELD DICTIONARY ---
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

export default function IntakeEngine({ products, fetcher, shopify }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState({});
  const [isFieldManagerOpen, setIsFieldManagerOpen] = useState(false);
  
  // Field Manager State
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");

  // --- TRAY LOGIC ---
  const filteredProducts = useMemo(() => {
    const safeProducts = products || [];
    if (!searchQuery) return safeProducts;
    return safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  const toggleProduct = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectAll = () => setSelectedIds(filteredProducts.map(p => p.id));
  const clearAll = () => {
    setSelectedIds([]);
    setFormState({}); // Clear form when dropping selection
  };

  // --- SINGLE VS BULK FORM LOGIC ---
  // If exactly ONE stone is selected, auto-load its current database values.
  // If MULTIPLE stones are selected, present a blank form for batch stamping.
  useEffect(() => {
    if (selectedIds.length === 1) {
      const product = products.find(p => p.id === selectedIds[0]);
      const newForm = {};
      if (product && product.metafields && product.metafields.edges) {
        product.metafields.edges.forEach(({ node }) => {
          if (node.namespace === "rockhound" && node.value) {
            newForm[node.key] = node.value;
          }
        });
      }
      setFormState(newForm);
    } else if (selectedIds.length > 1) {
      setFormState({}); // Switch to Batch Mode (clean slate)
    }
  }, [selectedIds, products]);

  // --- ENGINE FIRING ---
  const handleAutoFill = useCallback(() => {
    if (selectedIds.length !== 1) {
      if (shopify) shopify.toast.show("Auto-fill requires exactly 1 stone selected.");
      return;
    }
    fetcher.submit(
      { intent: "autoFill", productId: selectedIds[0] },
      { method: "post" }
    );
  }, [selectedIds, fetcher, shopify]);

  const handleSave = useCallback(() => {
    if (selectedIds.length === 0) return;
    
    const payload = [];
    const validEntries = Object.entries(formState).filter(([key, value]) => value !== undefined && value.toString().trim() !== "");
    
    // Build payload for ALL selected products (Single or Bulk)
    selectedIds.forEach(productId => {
      validEntries.forEach(([key, value]) => {
        const config = ROCKHOUND_FIELDS.find(f => f.key === key);
        const fieldType = config && config.type ? config.type : "single_line_text_field";
        const formatId = productId.includes("gid://") ? productId : `gid://shopify/Product/${productId}`;

        payload.push({
          ownerId: formatId,
          namespace: "rockhound",
          key,
          value: value.toString(),
          type: fieldType 
        });
      });
    });

    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedIds, formState, fetcher]);

  const handleAddField = useCallback(() => {
    if (!newKey || !newName) return;
    fetcher.submit(
      { intent: "addFieldDefinition", key: newKey, name: newName, type: "single_line_text_field" }, 
      { method: "post" }
    );
    setNewKey("");
    setNewName("");
    setIsFieldManagerOpen(false);
  }, [newKey, newName, fetcher]);

  // --- FEEDBACK LISTENERS ---
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.intent === "autoFill" && fetcher.data.success) {
        setFormState(prev => ({ ...prev, ...fetcher.data.autoFillData }));
        if (shopify) shopify.toast.show("Title parsed & tags pulled.");
      }
      if (fetcher.data.intent === "saveProduct" && fetcher.data.success) {
        if (shopify) shopify.toast.show(`Saved ${selectedIds.length} product(s) to Shopify.`);
      }
      if (fetcher.data.intent === "addFieldDefinition" && fetcher.data.success) {
        if (shopify) shopify.toast.show("New Metafield added to schema.");
      }
    }
  }, [fetcher.state, fetcher.data, shopify, selectedIds.length]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h2">Master Intake Bench</Text>

          <InlineStack gap="400" align="start" blockAlign="stretch">
            {/* TRAY COLUMN (Left) */}
            <div style={{ flex: "1 1 40%", minWidth: "300px" }}>
              <BlockStack gap="300">
                <TextField
                  value={searchQuery}
                  onChange={setSearchQuery}
                  prefix={<Icon source={SearchIcon} />}
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                  autoComplete="off"
                  placeholder="Filter tray..."
                />
                
                <InlineStack gap="200" align="space-between">
                  <Text tone="subdued">{selectedIds.length} Selected</Text>
                  <InlineStack gap="200">
                    <Button onClick={selectAll} size="micro">All</Button>
                    <Button onClick={clearAll} size="micro">Clear</Button>
                  </InlineStack>
                </InlineStack>

                <div style={{ maxHeight: "400px", overflowY: "auto", border: "1px solid #E1E3E5", borderRadius: "8px", padding: "8px" }}>
                  {filteredProducts.map(p => {
                    const isChecked = selectedIds.includes(p.id);
                    return (
                      <div key={p.id} onClick={() => toggleProduct(p.id)} style={{
                        display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", 
                        borderBottom: "1px solid #F0F2F4", cursor: "pointer",
                        backgroundColor: isChecked ? "#F3F4F6" : "transparent",
                        borderRadius: "4px"
                      }}>
                        <Checkbox checked={isChecked} onChange={() => {}} />
                        <Text fontWeight={isChecked ? "bold" : "regular"}>{p.title}</Text>
                      </div>
                    );
                  })}
                </div>
              </BlockStack>
            </div>

            {/* FORM COLUMN (Right) */}
            <div style={{ flex: "1 1 60%", minWidth: "400px" }}>
              {selectedIds.length === 0 ? (
                <Box padding="600" background="bg-surface-secondary" borderRadius="200">
                  <Text alignment="center" tone="subdued">Select one or more stones from the tray to begin intake.</Text>
                </Box>
              ) : (
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h3">
                      {selectedIds.length === 1 ? "Single Intake Mode" : `Batch Mode: ${selectedIds.length} Stones`}
                    </Text>
                    <InlineStack gap="200">
                      {selectedIds.length === 1 && (
                        <Button icon={MagicIcon} onClick={handleAutoFill} loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoFill"}>
                          Parse Title
                        </Button>
                      )}
                      <Button icon={SaveIcon} tone="success" variant="primary" onClick={handleSave} loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct"}>
                        Save
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  {selectedIds.length > 1 && (
                    <Box padding="200" background="bg-surface-warning" borderRadius="100">
                      <Text tone="warning" fontWeight="bold">Batch Mode Active: Only populated fields will overwrite the selected stones.</Text>
                    </Box>
                  )}

                  <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "12px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    {ROCKHOUND_FIELDS.map(field => {
                      const val = formState[field.key] || "";
                      return (
                        <div key={field.key} style={{ minHeight: "54px" }}>
                          {field.isDropdown ? (
                            <Select
                              label={field.label}
                              options={[{ label: "Select...", value: "" }, ...(DEFAULT_DROPDOWNS[field.key] || []).map(o => ({ label: o, value: o }))]}
                              value={val}
                              onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                            />
                          ) : (
                            <TextField
                              label={field.label}
                              value={val}
                              onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                              autoComplete="off"
                              multiline={field.multiline && 3}
                            />
                          )}
                        </div>
                      );
                    })}

                    <Divider />
                    
                    {/* INLINE FIELD MANAGER */}
                    <Box paddingBlockStart="200">
                      <Button plain icon={PlusIcon} onClick={() => setIsFieldManagerOpen(!isFieldManagerOpen)}>
                        Add Custom Metafield
                      </Button>
                      <Collapsible open={isFieldManagerOpen} id="inline-field-manager">
                        <Box paddingBlockStart="400" padding="400" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm">New Shopify Metafield Definition</Text>
                            <InlineStack gap="300" blockAlign="end">
                              <TextField label="Key (e.g. mohs_hardness)" value={newKey} onChange={setNewKey} autoComplete="off" />
                              <TextField label="Display Name" value={newName} onChange={setNewName} autoComplete="off" />
                              <Button onClick={handleAddField} loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "addFieldDefinition"}>
                                Register Field
                              </Button>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      </Collapsible>
                    </Box>

                  </div>
                </BlockStack>
              )}
            </div>
          </InlineStack>

        </BlockStack>
      </Card>
    </BlockStack>
  );
}
import React, { useState, useCallback } from "react";
import {
  Box,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Checkbox,
  ChoiceList,
  Divider,
  Select,
  Scrollable,
  Modal,
  DataTable
} from "@shopify/polaris";
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

export function InjectorTab({ products, fetcher, shopify, dbProfiles = [], dynamicMetaobjectOptions = {} }) {
  const [bulkMode, setBulkMode] = useState("fill");
  const [bulkFormData, setBulkFormData] = useState({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dynamicCustomFields, setDynamicCustomFields] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });
  // PHASE 4 STATE: Controls the inline text box for creating new terms
  const [inlineAddState, setInlineAddState] = useState({ fieldKey: null, metaobjectType: null, value: "", loading: false });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    return mf ? mf.node.value : "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    // PHASE 3 UPGRADE: Checks metaobjectType instead of options
    if (fieldConfig.metaobjectType) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue ? /[\-–—]/.test(newValue) : false;
    return isNumberType ? (containsDash ? "single_line_text_field" : fieldConfig.type) : fieldConfig.type;
  }, []);

  const toggleProduct = (id) => {
    setBulkSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAutoFill = () => {
    const baseStoneType = bulkFormData["official_name"] || bulkFormData["base_stone_type"] || "";

    if (!baseStoneType.trim()) {
      if (shopify && shopify.toast) shopify.toast.show("Please type a stone name (e.g., 'Jasper') into 'Official Name' first!", { isError: true });
      return;
    }

    const profile = dbProfiles.find(db => 
      baseStoneType.toLowerCase().includes((db.title || db.stoneName || "").toLowerCase()) || 
      (db.title || db.stoneName || "").toLowerCase().includes(baseStoneType.toLowerCase())
    );
    
    if (!profile) {
      if (shopify && shopify.toast) shopify.toast.show(`No dictionary entry found for "${baseStoneType}".`, { isError: true });
      return;
    }

    let updates = { ...bulkFormData };

    METAFIELD_CONFIG.forEach(field => {
      if (!field.key) return;
      const key = field.key.toLowerCase();
      
      // Google Science Fields
      if (key.includes('authenticity')) updates[field.key] = profile.googleAuthenticity || updates[field.key] || "";
      if (key.includes('rarity')) updates[field.key] = profile.googleRarity || updates[field.key] || "";
      if (key.includes('crystal_system') || key.includes('crystal-system')) updates[field.key] = profile.googleCrystalSystem || updates[field.key] || "";
      if (key.includes('geological_era') || key.includes('geological-era')) updates[field.key] = profile.googleGeologicalEra || updates[field.key] || "";
      if (key.includes('mineral_class') || key.includes('mineral-class')) updates[field.key] = profile.googleMineralClass || updates[field.key] || "";
      if (key.includes('rock_composition') || key.includes('rock-composition')) updates[field.key] = profile.googleRockComposition || updates[field.key] || "";
      if (key.includes('rock_formation') || key.includes('rock-formation')) updates[field.key] = profile.googleRockFormation || updates[field.key] || "";
      
      // Store/Stone Hard Science Fields
      if (key.includes('hardness')) updates[field.key] = profile.stoneHardness || updates[field.key] || "";
      if (key.includes('luster')) updates[field.key] = profile.stoneLuster || updates[field.key] || "";
      if (key.includes('fracture')) updates[field.key] = profile.stoneFracture || updates[field.key] || "";
      if (key.includes('cleavage')) updates[field.key] = profile.stoneCleavage || updates[field.key] || "";
      if (key.includes('specific_gravity') || key.includes('specificgravity')) updates[field.key] = profile.stoneSpecificGravity || updates[field.key] || "";
      if (key.includes('diaphaneity')) updates[field.key] = profile.stoneDiaphaneity || updates[field.key] || "";
    });

    // PHASE 3 UPGRADE: Translate Dictionary Text to Shopify GIDs for Dropdowns
    METAFIELD_CONFIG.forEach(field => {
      if (field.metaobjectType && updates[field.key]) {
        const rawValue = updates[field.key];
        if (!rawValue.includes("gid://")) {
          const liveOptions = dynamicMetaobjectOptions[field.metaobjectType] || [];
          const matchedOption = liveOptions.find(opt => opt.label.toLowerCase() === rawValue.toLowerCase());
          if (matchedOption) {
            updates[field.key] = matchedOption.value;
          } else {
            updates[field.key] = ""; // Keep blank if the term doesn't exist in Shopify yet
          }
        }
      }
    });

    setBulkFormData(updates);

    if (shopify && shopify.toast) shopify.toast.show(`${profile.title || profile.stoneName} science successfully loaded from dictionary!`, { isError: false });
  };

  const handleBulkSubmit = () => {
    const selectedProducts = products.filter(p => bulkSelectedProductIds.includes(p.id));
    if (selectedProducts.length === 0) {
      if (shopify && shopify.toast) shopify.toast.show("Select at least one product.", { isError: true });
      return;
    }

    const payload = [];
    const diffSummary = [];
    let changesCount = 0;

    selectedProducts.forEach(product => {
      const statusStr = getMetafieldValue(product, "meta_status");
      let statusObj = {};
      try { 
        statusObj = statusStr ? JSON.parse(statusStr) : {}; 
      } catch(e) {}
      
      let productChanged = false;

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const newVal = bulkFormData[field.key] || "";
        if (!newVal) return;

        const currentVal = getMetafieldValue(product, field.key);
        if (bulkMode === "fill" && currentVal) return;
        if (currentVal === newVal) return;

        const resolvedType = resolveMetafieldType(product, field, newVal);
        
        let finalValue = newVal;
        if (resolvedType.includes("list.")) {
          try {
            const parsed = JSON.parse(newVal);
            if (Array.isArray(parsed)) {
              finalValue = newVal; 
            } else {
              finalValue = JSON.stringify([newVal]); 
            }
          } catch {
            finalValue = JSON.stringify([newVal]);
          }
        }

        payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: finalValue });
        statusObj[field.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      dynamicCustomFields.forEach(df => {
        if (!df.key || !df.value) return;
        const currentVal = getMetafieldValue(product, df.key);
        if (bulkMode === "fill" && currentVal) return;
        if (currentVal === df.value) return;

        payload.push({ ownerId: product.id, namespace: "custom", key: df.key, type: "single_line_text_field", value: df.value });
        statusObj[df.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      if (productChanged) {
        payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      }
    });

    if (payload.length === 0) {
      if (shopify && shopify.toast) shopify.toast.show("No changes to apply based on current mode and inputs.", { isError: false });
      return;
    }

    diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} updates across ${selectedProducts.length} products` });

    setModalConfig({
      active: true, 
      title: `Confirm Bulk Injection (${bulkMode.toUpperCase()})`,
      body: bulkMode === "overwrite" ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
      diffs: diffSummary, 
      payload: payload
    });
  };

  const executeBulkSubmit = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
    setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] });
  };

  let visibleProducts = products;
  if (bulkSearchQuery.trim() !== "") {
    const lowerQuery = bulkSearchQuery.toLowerCase();
    visibleProducts = products.filter(p => p.title.toLowerCase().includes(lowerQuery));
  }

  return (
    <BlockStack gap="500">
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">
          Preview & Run Bulk Inject
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Targets ({bulkSelectedProductIds.length})</Text>
              
              <div style={inputTapTargetStyle}>
                <TextField
                  placeholder="Search products..."
                  value={bulkSearchQuery}
                  onChange={setBulkSearchQuery}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setBulkSearchQuery("")}
                  accessibilityLabel="Search products"
                />
              </div>

              {bulkSearchQuery.trim() !== "" && (
                <Text variant="bodySm" color="subdued">
                  Showing {visibleProducts.length} of {products.length} products
                </Text>
              )}

              <div style={tapTargetStyle}>
                <Button onClick={() => setBulkSelectedProductIds(bulkSelectedProductIds.length === visibleProducts.length ? [] : visibleProducts.map(p => p.id))} accessibilityLabel="Select all or none">
                  {bulkSelectedProductIds.length === visibleProducts.length && visibleProducts.length > 0 ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {visibleProducts.length === 0 && (
                     <Box padding="400">
                       <Text as="p" color="subdued" alignment="center">No products match your search.</Text>
                     </Box>
                  )}
                  {visibleProducts.map(p => (
                    <div style={inputTapTargetStyle} key={p.id}>
                      <Checkbox 
                        label={p.title} 
                        checked={bulkSelectedProductIds.includes(p.id)} 
                        onChange={() => toggleProduct(p.id)} 
                        accessibilityLabel={`Select ${p.title}`} 
                      />
                    </div>
                  ))}
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </Box>
        </div>

        <div style={{ flex: 1 }}>
          <Box padding="400" background="bg-surface" borderRadius="200" shadow="100">
            <BlockStack gap="400">
              <Text variant="headingSm" as="h3">2. Define Injection Data</Text>
              <Box paddingBlockEnd="200">
                <InlineStack gap="400">
                  <Text as="span">🔵 <strong style={{ fontWeight: 600 }}>Google</strong> = Required for Google Shopping</Text>
                  <Text as="span">🪨 <strong style={{ fontWeight: 600 }}>Stone</strong> = Your OOAK storefront data</Text>
                </InlineStack>
              </Box>
              <div style={inputTapTargetStyle}>
                <ChoiceList 
                  title="Injection Mode" 
                  choices={[
                    { label: 'FILL ONLY: Skip products that already have data', value: 'fill' }, 
                    { label: 'OVERWRITE: Force data (Dangerous)', value: 'overwrite' }
                  ]} 
                  selected={[bulkMode]} 
                  onChange={(val) => setBulkMode(val[0])} 
                />
              </div>
              
              <Divider />

              <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd">
                    <strong>Dictionary Auto-Fill:</strong> Type a stone name (e.g., "Jasper") into the <strong>Official Name</strong> field below, then click this button to load its hard science data.
                  </Text>
                  <div style={tapTargetStyle}>
                    <Button size="large" variant="primary" tone="success" onClick={handleAutoFill}>
                      ⭐ Auto-Fill Science from Dictionary
                    </Button>
                  </div>
                </BlockStack>
              </Box>
              
              <Divider />
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
                  const isGoogle = field.namespace === "shopify";
                  const rawLabelText = field.name || field.label || "";
                  
                  let cleanName = rawLabelText
                    .replace(/🔵/g, '')
                    .replace(/🪨/g, '')
                    .replace(/Google/gi, '')
                    .replace(/Store/gi, '')
                    .replace(/Stone/gi, '')
                    .trim();

                  const label = isGoogle ? `🔵 Google ${cleanName}` : `🪨 Stone ${cleanName}`;

                  // PHASE 4 UPGRADE: The Dropdown + Auto-Mint UI
                  if (field.metaobjectType) {
                    const liveOptions = dynamicMetaobjectOptions[field.metaobjectType] || [];
                    const dropdownOptions = [
                      { label: "Select...", value: "" },
                      ...liveOptions
                    ];

                    // Check if this specific field is currently in "Add New" mode
                    const isAddingNew = inlineAddState.fieldKey === field.key;

                    return (
                      <div style={{ ...inputTapTargetStyle, minHeight: 'auto' }} key={field.key}>
                        {isAddingNew ? (
                          <BlockStack gap="200">
                            <TextField
                              label={`➕ New ${cleanName}`}
                              value={inlineAddState.value}
                              onChange={(val) => setInlineAddState(prev => ({ ...prev, value: val }))}
                              placeholder="e.g., Dragonstone"
                              autoComplete="off"
                              disabled={inlineAddState.loading}
                            />
                            <InlineStack gap="200">
                              <Button 
                                tone="success" 
                                variant="primary"
                                loading={inlineAddState.loading}
                                onClick={() => {
                                  if (!inlineAddState.value.trim()) return;
                                  setInlineAddState(prev => ({ ...prev, loading: true }));
                                  
                                  // Fire Push 1 (The Dictionary Push)
                                  const formData = new FormData();
                                  formData.append("intent", "createMetaobject");
                                  formData.append("type", field.metaobjectType);
                                  formData.append("value", inlineAddState.value);
                                  
                                  fetcher.submit(formData, { method: "post" });
                                  
                                  // The Remix fetcher automatically re-runs the loader, 
                                  // so the new word will appear in the dropdown in ~1 second.
                                  setTimeout(() => {
                                    setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false });
                                    if (shopify && shopify.toast) shopify.toast.show(`Added to Dictionary!`, { isError: false });
                                  }, 1500); 
                                }}
                              >
                                Save to Dictionary
                              </Button>
                              <Button onClick={() => setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false })}>
                                Cancel
                              </Button>
                            </InlineStack>
                          </BlockStack>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <Select 
                                label={label} 
                                options={dropdownOptions} 
                                value={bulkFormData[field.key] || ""} 
                                onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} 
                                accessibilityLabel={`Bulk input for ${cleanName}`} 
                              />
                            </div>
                            <Button 
                              accessibilityLabel={`Add new ${cleanName}`}
                              onClick={() => setInlineAddState({ fieldKey: field.key, metaobjectType: field.metaobjectType, value: "", loading: false })}
                            >
                              ➕
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  
                  return (
                    <div style={inputTapTargetStyle} key={field.key}>
                      <TextField 
                        label={label} 
                        value={bulkFormData[field.key] || ""} 
                        onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} 
                        placeholder="Leave blank to skip" 
                        autoComplete="off" 
                        type="text" 
                        accessibilityLabel={`Bulk input for ${cleanName}`} 
                      />
                    </div>
                  );
                })}
              </div>

              {dynamicCustomFields.length > 0 && (
                <BlockStack gap="300">
                  <Divider />
                  <Text variant="headingSm" as="h4">Custom Stone Fields</Text>
                  {dynamicCustomFields.map((df, idx) => (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px' }} key={`dynamic-${idx}`}>
                      <div style={inputTapTargetStyle}>
                        <TextField 
                          label="🪨 Stone Field Key" 
                          value={df.key} 
                          onChange={(val) => {
                            const newFields = [...dynamicCustomFields];
                            newFields[idx].key = val;
                            setDynamicCustomFields(newFields);
                          }} 
                          placeholder="e.g. mine_name" 
                          autoComplete="off" 
                          type="text" 
                          accessibilityLabel="Custom stone field key" 
                        />
                      </div>
                      <div style={inputTapTargetStyle}>
                        <TextField 
                          label="Value" 
                          value={df.value} 
                          onChange={(val) => {
                            const newFields = [...dynamicCustomFields];
                            newFields[idx].value = val;
                            setDynamicCustomFields(newFields);
                          }} 
                          placeholder="Value" 
                          autoComplete="off" 
                          type="text" 
                          accessibilityLabel="Custom stone field value" 
                        />
                      </div>
                      <div style={tapTargetStyle}>
                        <Button tone="critical" onClick={() => {
                          const newFields = [...dynamicCustomFields];
                          newFields.splice(idx, 1);
                          setDynamicCustomFields(newFields);
                        }} accessibilityLabel="Remove custom field">X</Button>
                      </div>
                    </div>
                  ))}
                </BlockStack>
              )}
              
              <div style={tapTargetStyle}>
                <Button onClick={() => setDynamicCustomFields([...dynamicCustomFields, { key: '', value: '' }])} accessibilityLabel="Add custom stone field">
                  Add Custom Field
                </Button>
              </div>

            </BlockStack>
          </Box>
        </div>

        {modalConfig.active && (
          <Modal
            open={true} 
            onClose={() => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] })} 
            title={modalConfig.title}
            primaryAction={{ content: "Confirm & Execute", onAction: executeBulkSubmit, tone: "success", accessibilityLabel: "Confirm and execute action" }}
            secondaryActions={[{ content: "Cancel", onAction: () => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] }), accessibilityLabel: "Cancel action" }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                {modalConfig.body && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
                {modalConfig.diffs.length > 0 && (
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <DataTable 
                      columnContentTypes={["text", "text", "text"]} 
                      headings={["Field", "Old Value", "New Value"]} 
                      rows={modalConfig.diffs.map(d => [d.field, d.old, d.new])} 
                    />
                  </Box>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </div>
    </BlockStack>
  );
}
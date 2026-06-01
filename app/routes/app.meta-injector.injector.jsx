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
    if (mf) return mf.node.value;
    return "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    if (fieldConfig.metaobjectType) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue && /[\-–—]/.test(newValue);
    if (isNumberType && containsDash) return "single_line_text_field";
    if (isNumberType && !containsDash) return fieldConfig.type;
    return fieldConfig.type;
  }, []);

  const toggleProduct = (id) => {
    setBulkSelectedProductIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) return prev.filter(x => x !== id);
      if (!isSelected) return [...prev, id];
      return prev;
    });
  };

  const handleAutoFill = () => {
    const baseStoneType = bulkFormData["official_name"] || bulkFormData["base_stone_type"] || "";

    const isMissingStoneType = baseStoneType.trim() === "";
    if (isMissingStoneType) {
      if (shopify && shopify.toast) shopify.toast.show("Please type a stone name (e.g., 'Jasper') into 'Official Name' first!", { isError: true });
      return;
    }

    const profile = dbProfiles.find(db => 
      baseStoneType.toLowerCase().includes((db.title || db.stoneName || "").toLowerCase()) || 
      (db.title || db.stoneName || "").toLowerCase().includes(baseStoneType.toLowerCase())
    );
    
    const isMissingProfile = !profile;
    if (isMissingProfile) {
      if (shopify && shopify.toast) shopify.toast.show(`No dictionary entry found for "${baseStoneType}".`, { isError: true });
      return;
    }

    let updates = { ...bulkFormData };

    METAFIELD_CONFIG.forEach(field => {
      if (!field.key) return;
      const key = field.key.toLowerCase();
      
      // Strict mapping to Shopify keys per METAFIELD KEY LAW
      if (key === 'google_authenticity') updates[field.key] = profile.authenticity || profile.google_authenticity || updates[field.key] || "";
      if (key === 'google_rarity') updates[field.key] = profile.rarity || profile.google_rarity || updates[field.key] || "";
      if (key === 'google_crystal_system') updates[field.key] = profile.google_crystal_system || updates[field.key] || "";
      if (key === 'google_geological_era') updates[field.key] = profile.google_geological_era || updates[field.key] || "";
      if (key === 'google_mineral_class') updates[field.key] = profile.google_mineral_class || updates[field.key] || "";
      if (key === 'google_rock_composition') updates[field.key] = profile.google_rock_composition || updates[field.key] || "";
      if (key === 'google_rock_formation') updates[field.key] = profile.google_rock_formation || updates[field.key] || "";
      
      if (key === 'store_hardness') updates[field.key] = profile.store_hardness || updates[field.key] || "";
      if (key === 'store_luster') updates[field.key] = profile.store_luster || updates[field.key] || "";
      if (key === 'store_fracture') updates[field.key] = profile.store_fracture || updates[field.key] || "";
      if (key === 'store_cleavage') updates[field.key] = profile.store_cleavage || updates[field.key] || "";
      if (key === 'store_specific_gravity') updates[field.key] = profile.store_specific_gravity || updates[field.key] || "";
      if (key === 'store_diaphaneity') updates[field.key] = profile.store_diaphaneity || updates[field.key] || "";
    });

    // Translate Dictionary Text to Shopify GIDs for Dropdowns
    METAFIELD_CONFIG.forEach(field => {
      const hasMetaobjectTypeAndValue = field.metaobjectType && updates[field.key];
      if (hasMetaobjectTypeAndValue) {
        const rawValue = updates[field.key];
        const isNotGid = !rawValue.includes("gid://");
        if (isNotGid) {
          const liveOptions = dynamicMetaobjectOptions[field.metaobjectType] || [];
          const matchedOption = liveOptions.find(opt => opt.label.toLowerCase() === rawValue.toLowerCase());
          if (matchedOption) {
            updates[field.key] = matchedOption.value;
          }
          if (!matchedOption) {
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
    const isNoProductsSelected = selectedProducts.length === 0;
    if (isNoProductsSelected) {
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
        if (statusStr) {
          statusObj = JSON.parse(statusStr); 
        }
      } catch(e) {}
      
      let productChanged = false;

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const newVal = bulkFormData[field.key] || "";
        if (!newVal) return;

        const currentVal = getMetafieldValue(product, field.key);
        const isFillModeAndHasValue = bulkMode === "fill" && currentVal !== "";
        if (isFillModeAndHasValue) return;
        const isSameValue = currentVal === newVal;
        if (isSameValue) return;

        const resolvedType = resolveMetafieldType(product, field, newVal);
        
        let finalValue = newVal;
        const isListType = resolvedType.includes("list.");
        if (isListType) {
          try {
            const parsed = JSON.parse(newVal);
            const isArray = Array.isArray(parsed);
            if (isArray) {
              finalValue = newVal; 
            }
            if (!isArray) {
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
        const isInvalidCustomField = !df.key || !df.value;
        if (isInvalidCustomField) return;
        
        const currentVal = getMetafieldValue(product, df.key);
        const isFillModeAndHasValue = bulkMode === "fill" && currentVal !== "";
        if (isFillModeAndHasValue) return;
        const isSameValue = currentVal === df.value;
        if (isSameValue) return;

        payload.push({ ownerId: product.id, namespace: "custom", key: df.key, type: "single_line_text_field", value: df.value });
        statusObj[df.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      if (productChanged) {
        payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      }
    });

    const isPayloadEmpty = payload.length === 0;
    if (isPayloadEmpty) {
      if (shopify && shopify.toast) shopify.toast.show("No changes to apply based on current mode and inputs.", { isError: false });
      return;
    }

    diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} updates across ${selectedProducts.length} products` });

    const isOverwriteMode = bulkMode === "overwrite";
    
    setModalConfig({
      active: true, 
      title: `Confirm Bulk Injection (${bulkMode.toUpperCase()})`,
      body: isOverwriteMode ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
      diffs: diffSummary, 
      payload: payload
    });
  };

  const executeBulkSubmit = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
    setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] });
  };

  let visibleProducts = products;
  const hasSearchQuery = bulkSearchQuery.trim() !== "";
  if (hasSearchQuery) {
    const lowerQuery = bulkSearchQuery.toLowerCase();
    visibleProducts = products.filter(p => p.title.toLowerCase().includes(lowerQuery));
  }

  const allVisibleSelected = bulkSelectedProductIds.length === visibleProducts.length && visibleProducts.length > 0;

  return (
    <BlockStack gap="500">
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={tapTargetStyle}>
          <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">
            Preview & Run Bulk Inject
          </Button>
        </div>
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

              {hasSearchQuery && (
                <Text variant="bodySm" tone="subdued" as="p">
                  Showing {visibleProducts.length} of {products.length} products
                </Text>
              )}

              <div style={tapTargetStyle}>
                <Button 
                  onClick={() => setBulkSelectedProductIds(allVisibleSelected ? [] : visibleProducts.map(p => p.id))} 
                  accessibilityLabel="Select all or none"
                >
                  {allVisibleSelected && "Deselect All"}
                  {!allVisibleSelected && "Select All"}
                </Button>
              </div>

              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {visibleProducts.length === 0 && (
                     <Box padding="400">
                       <Text as="p" tone="subdued" alignment="center">No products match your search.</Text>
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
                    <Button size="large" variant="primary" tone="success" onClick={handleAutoFill} accessibilityLabel="Auto-Fill Science from Dictionary">
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
                  const hasMetaobjectType = !!field.metaobjectType;
                  const isAddingNew = inlineAddState.fieldKey === field.key;

                  return (
                    <div style={{ ...inputTapTargetStyle, minHeight: 'auto' }} key={field.key}>
                      {hasMetaobjectType && isAddingNew && (
                        <BlockStack gap="200">
                          <TextField
                            label={`➕ New ${cleanName}`}
                            value={inlineAddState.value}
                            onChange={(val) => setInlineAddState(prev => ({ ...prev, value: val }))}
                            placeholder="e.g., Dragonstone"
                            autoComplete="off"
                            disabled={inlineAddState.loading}
                            accessibilityLabel={`Type new ${cleanName} value`}
                          />
                          <InlineStack gap="200">
                            <div style={tapTargetStyle}>
                              <Button 
                                tone="success" 
                                variant="primary"
                                loading={inlineAddState.loading}
                                accessibilityLabel="Save new dictionary term"
                                onClick={() => {
                                  const isInvalidValue = !inlineAddState.value.trim();
                                  if (isInvalidValue) return;
                                  
                                  setInlineAddState(prev => ({ ...prev, loading: true }));
                                  
                                  const formData = new FormData();
                                  formData.append("intent", "createMetaobject");
                                  formData.append("type", field.metaobjectType);
                                  formData.append("value", inlineAddState.value);
                                  
                                  fetcher.submit(formData, { method: "post" });
                                  
                                  setTimeout(() => {
                                    setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false });
                                    if (shopify && shopify.toast) shopify.toast.show(`Added to Dictionary!`, { isError: false });
                                  }, 1500); 
                                }}
                              >
                                Save to Dictionary
                              </Button>
                            </div>
                            <div style={tapTargetStyle}>
                              <Button onClick={() => setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false })} accessibilityLabel="Cancel adding term">
                                Cancel
                              </Button>
                            </div>
                          </InlineStack>
                        </BlockStack>
                      )}

                      {hasMetaobjectType && !isAddingNew && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <Select 
                              label={label} 
                              options={[{ label: "Select...", value: "" }, ...(dynamicMetaobjectOptions[field.metaobjectType] || [])]} 
                              value={bulkFormData[field.key] || ""} 
                              onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} 
                              accessibilityLabel={`Bulk input for ${cleanName}`} 
                            />
                          </div>
                          <div style={tapTargetStyle}>
                            <Button 
                              accessibilityLabel={`Add new ${cleanName}`}
                              onClick={() => setInlineAddState({ fieldKey: field.key, metaobjectType: field.metaobjectType, value: "", loading: false })}
                            >
                              ➕
                            </Button>
                          </div>
                        </div>
                      )}

                      {!hasMetaobjectType && (
                        <TextField 
                          label={label} 
                          value={bulkFormData[field.key] || ""} 
                          onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} 
                          placeholder="Leave blank to skip" 
                          autoComplete="off" 
                          type="text" 
                          accessibilityLabel={`Bulk input for ${cleanName}`} 
                        />
                      )}
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
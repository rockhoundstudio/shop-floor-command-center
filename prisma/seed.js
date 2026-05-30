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
  Scrollable,
  Modal
} from "@shopify/polaris";
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

export function InjectorTab({ products, fetcher, shopify, dbProfiles = [] }) {
  const [bulkMode, setBulkMode] = useState("fill");
  const [bulkFormData, setBulkFormData] = useState({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dynamicCustomFields, setDynamicCustomFields] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    return mf ? mf.node.value : "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    if (fieldConfig.options) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue ? /[\-–—]/.test(newValue) : false;
    return isNumberType ? (containsDash ? "single_line_text_field" : fieldConfig.type) : fieldConfig.type;
  }, []);

  const toggleProduct = (id) => {
    setBulkSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // --- UPGRADED: AUTO-FILL FROM OFFICIAL NAME ---
  const handleAutoFill = () => {
    const baseStoneType = bulkFormData["official_name"] || "";

    if (!baseStoneType.trim()) {
      if (shopify && shopify.toast) shopify.toast.show("Please type a base stone into 'Store Official Name' first!", { isError: true });
      return;
    }

    // Find the matching dictionary profile based on what she typed (case-insensitive)
    const profile = dbProfiles.find(db => 
      baseStoneType.toLowerCase().includes(db.title.toLowerCase()) || 
      db.title.toLowerCase().includes(baseStoneType.toLowerCase())
    );
    
    if (!profile) {
      if (shopify && shopify.toast) shopify.toast.show(`No dictionary entry found for "${baseStoneType}".`, { isError: true });
      return;
    }

    // Map database fields to the UI form (leaving color/origin alone)
    setBulkFormData(prev => ({
      ...prev,
      crystal_system: profile.googleCrystalSystem || prev.crystal_system || "",
      geological_era: profile.googleGeologicalEra || prev.geological_era || "",
      mineral_class: profile.googleMineralClass || prev.mineral_class || "",
      rock_composition: profile.googleRockComposition || prev.rock_composition || "",
      rock_formation: profile.googleRockFormation || prev.rock_formation || "",
      hardness_mohs: profile.storeHardness || prev.hardness_mohs || "",
      luster: profile.storeLuster || prev.luster || "",
      fracture: profile.storeFracture || prev.fracture || "",
      cleavage: profile.storeCleavage || prev.cleavage || "",
      specific_gravity: profile.storeSpecificGravity || prev.specific_gravity || "",
      diaphaneity: profile.storeDiaphaneity || prev.diaphaneity || ""
    }));

    if (shopify && shopify.toast) shopify.toast.show(`${profile.title} science loaded successfully!`, { isError: false });
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
      try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e) {}
      
      let productChanged = false;

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const newVal = bulkFormData[field.key] || "";
        if (!newVal) return;

        const currentVal = getMetafieldValue(product, field.key);
        if (bulkMode === "fill" && currentVal) return;
        if (currentVal === newVal) return;

        const resolvedType = resolveMetafieldType(product, field, newVal);
        payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: newVal });
        statusObj[field.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      if (productChanged) {
        payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      }
    });

    if (payload.length === 0) {
      if (shopify && shopify.toast) shopify.toast.show("No changes to apply.", { isError: false });
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
              />
            </div>

            {bulkSearchQuery.trim() !== "" && (
              <Text variant="bodySm" color="subdued">Showing {visibleProducts.length} of {products.length} products</Text>
            )}

            <div style={tapTargetStyle}>
              <Button onClick={() => setBulkSelectedProductIds(bulkSelectedProductIds.length === visibleProducts.length ? [] : visibleProducts.map(p => p.id))}>
                {bulkSelectedProductIds.length === visibleProducts.length && visibleProducts.length > 0 ? "Deselect All" : "Select All"}
              </Button>
            </div>

            <Scrollable style={{ height: '500px' }}>
              <BlockStack gap="100">
                {visibleProducts.length === 0 && (
                   <Box padding="400"><Text as="p" color="subdued" alignment="center">No products match your search.</Text></Box>
                )}
                {visibleProducts.map(p => (
                  <div style={inputTapTargetStyle} key={p.id}>
                    <Checkbox 
                      label={p.title} 
                      checked={bulkSelectedProductIds.includes(p.id)} 
                      onChange={() => toggleProduct(p.id)} 
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
                <Text as="span">🪨 <strong style={{ fontWeight: 600 }}>Store</strong> = Your OOAK storefront data</Text>
              </InlineStack>
            </Box>

            <Divider />

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

            <InlineStack gap="300" align="start">
                <Text as="p" variant="bodyMd">Type a base stone (e.g., "Jasper") into the Official Name field, then click Auto-Fill.</Text>
                <Button variant="primary" onClick={handleAutoFill}>
                   Auto-Fill Science from Dictionary
                </Button>
            </InlineStack>

            <Divider />

            {METAFIELD_CONFIG.map(field => {
               if (field.hidden) return null;
               return (
                 <div style={inputTapTargetStyle} key={field.key}>
                    <TextField
                       label={`${field.namespace === 'google' ? '🔵' : '🪨'} ${field.name || field.key}`}
                       value={bulkFormData[field.key] || ""}
                       onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))}
                       autoComplete="off"
                    />
                 </div>
               );
            })}

            <Divider />

            <Button size="large" variant="primary" onClick={handleBulkSubmit}>
               Review & Inject Metafields
            </Button>

          </BlockStack>
        </Box>
      </div>

      <Modal open={modalConfig.active} onClose={() => setModalConfig({ ...modalConfig, active: false })} title={modalConfig.title} primaryAction={{ content: 'Inject Data', onAction: executeBulkSubmit, destructive: bulkMode === "overwrite" }} secondaryActions={[{ content: 'Cancel', onAction: () => setModalConfig({ ...modalConfig, active: false }) }]}>
        <Modal.Section>
          <Text as="p" variant="bodyMd" color={bulkMode === "overwrite" ? "critical" : "default"}>{modalConfig.body}</Text>
        </Modal.Section>
      </Modal>

    </div>
  );
}
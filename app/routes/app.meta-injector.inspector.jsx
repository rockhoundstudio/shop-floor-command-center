import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, InlineStack, Box, Select, TextField, Button, EmptySearchResult, Spinner, Divider, Modal, DataTable, Toast, Text
} from "@shopify/polaris";
import { METAFIELD_CONFIG, getLabelForValue } from "./app.meta-injector.constants";

export function InspectorTab({ products, fetcher }) {
  const [activeProductId, setActiveProductId] = useState("");
  const [inspectorLocalData, setInspectorLocalData] = useState({});
  const [inspectorFieldErrors, setInspectorFieldErrors] = useState({});
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", diffs: [], payload: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });

  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };
  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", diffs: [], payload: [] }), []);

  const isInspectorLoading = fetcher.state !== "idle";
  const activeProduct = fetcher.data?.product || products.find(p => p.id === activeProductId);

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
    const containsDash = newValue && /[\-–—]/.test(newValue);
    if (isNumberType && containsDash) return "single_line_text_field";
    return fieldConfig.type;
  }, []);

  useEffect(() => {
    if (activeProductId) {
      fetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
    }
  }, [activeProductId, fetcher]);

  useEffect(() => {
    if (activeProduct) {
      const initial = {};
      const errors = {};
      METAFIELD_CONFIG.forEach(f => {
        const val = getMetafieldValue(activeProduct, f.key);
        initial[f.key] = val;
        const isInvalidNumber = f.type.includes("number") && val && !/^[\d\.\s\-–—]+$/.test(val);
        if (isInvalidNumber) {
          errors[f.key] = "Only numbers and ranges allowed.";
        }
      });
      setInspectorLocalData(initial);
      setInspectorFieldErrors(errors);
    }
  }, [activeProduct, getMetafieldValue]);

  useEffect(() => {
    if (fetcher.data && fetcher.data.message) {
      setToastState({ active: true, message: fetcher.data.message, isError: !fetcher.data.success });
      if (fetcher.data.success) {
        closeModal();
      }
    }
  }, [fetcher.data, closeModal]);

  const handleFieldChange = (key, val, isNumeric) => {
    setInspectorLocalData(prev => ({ ...prev, [key]: val }));
    if (isNumeric) {
      if (val) {
        const isValid = /^[\d\.\s\-–—]+$/.test(val);
        setInspectorFieldErrors(prev => {
          const newE = { ...prev };
          if (!isValid) newE[key] = "Only numbers and ranges allowed (e.g. 7 or 6.5-7).";
          if (isValid) delete newE[key];
          return newE;
        });
      }
      if (!val) {
        setInspectorFieldErrors(prev => { 
          const newE = { ...prev }; 
          delete newE[key]; 
          return newE; 
        });
      }
    }
  };

  const handleSaveSingle = () => {
    const hasErrors = Object.keys(inspectorFieldErrors).length > 0;
    if (hasErrors) {
      setToastState({ active: true, message: "Please fix validation errors before saving.", isError: true });
      return;
    }

    const payload = [];
    const diffs = [];
    const statusStr = getMetafieldValue(activeProduct, "meta_status");
    let statusObj = {};
    try { 
      if (statusStr) statusObj = JSON.parse(statusStr); 
    } catch(e) {}

    METAFIELD_CONFIG.forEach(field => {
      if (field.hidden) return;
      const currentVal = getMetafieldValue(activeProduct, field.key);
      const newVal = inspectorLocalData[field.key] || "";
      
      if (currentVal !== newVal) {
        diffs.push({ field: field.label, old: getLabelForValue(field.key, currentVal) || "(empty)", new: getLabelForValue(field.key, newVal) || "(empty)" });
        const resolvedType = resolveMetafieldType(activeProduct, field, newVal);
        payload.push({ ownerId: activeProduct.id, namespace: field.namespace, key: field.key, type: resolvedType, value: newVal });
        statusObj[field.key] = "verified";
      }
    });

    if (diffs.length === 0) {
      setToastState({ active: true, message: "No changes detected.", isError: false });
      return;
    }

    payload.push({ ownerId: activeProduct.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });

    setModalConfig({
      active: true, 
      title: `Confirm changes for ${activeProduct.title}`, 
      diffs,
      payload
    });
  };

  const executeSave = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };

  return (
    <Box>
      {!activeProductId && (
        <BlockStack gap="400">
          <div style={inputTapTargetStyle}>
            <Select 
              label="Select a product to inspect" 
              options={[{ label: "Select...", value: "" }, ...products.map(p => ({ label: p.title, value: p.id }))]} 
              value={activeProductId} 
              onChange={setActiveProductId} 
              accessibilityLabel="Select product for inspector" 
            />
          </div>
          <EmptySearchResult title="No product selected" description="Select a product to fetch fresh data and edit." withIllustration />
        </BlockStack>
      )}

      {activeProductId && (
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <InlineStack gap="300" blockAlign="center">
              <Box width="400px">
                <div style={inputTapTargetStyle}>
                  <Select 
                    label="Select Product" 
                    options={products.map(p => ({ label: p.title, value: p.id }))} 
                    value={activeProductId} 
                    onChange={setActiveProductId} 
                    accessibilityLabel="Change product in inspector" 
                  />
                </div>
              </Box>
              {isInspectorLoading && <Spinner size="small" accessibilityLabel="Loading product data" />}
            </InlineStack>
            <div style={tapTargetStyle}>
              <Button 
                tone="success" 
                onClick={handleSaveSingle} 
                disabled={isInspectorLoading} 
                accessibilityLabel={`Save changes for ${activeProduct?.title || 'selected product'}`}
              >
                Verify & Save Changes
              </Button>
            </div>
          </InlineStack>
          <Divider />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
              const hasOptions = !!field.options;
              const isNumber = field.type.includes("number");
              
              return (
                <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                  {hasOptions && (
                    <div style={inputTapTargetStyle}>
                      <Select 
                        label={field.label} 
                        options={field.options} 
                        value={inspectorLocalData[field.key] || ""} 
                        onChange={(val) => handleFieldChange(field.key, val, false)} 
                        accessibilityLabel={`Select ${field.label}`} 
                        disabled={isInspectorLoading} 
                      />
                    </div>
                  )}
                  {!hasOptions && (
                    <div style={inputTapTargetStyle}>
                      <TextField 
                        label={field.label} 
                        value={inspectorLocalData[field.key] || ""} 
                        onChange={(val) => handleFieldChange(field.key, val, isNumber)} 
                        autoComplete="off" 
                        type="text" 
                        error={inspectorFieldErrors[field.key]} 
                        helpText={(isNumber && !inspectorFieldErrors[field.key]) && "Numbers and ranges allowed (e.g. 7, 6.5-7.5)"} 
                        accessibilityLabel={`Edit ${field.label}`} 
                        disabled={isInspectorLoading} 
                      />
                    </div>
                  )}
                </Box>
              );
            })}
          </div>
        </BlockStack>
      )}

      {modalConfig.active && (
        <Modal
          open={true} 
          onClose={closeModal} 
          title={modalConfig.title}
          primaryAction={{ content: "Confirm & Execute", onAction: executeSave, tone: "success", accessibilityLabel: "Confirm and execute action" }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel action" }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
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

      {toastState.active && (
        <Toast 
          content={toastState.message} 
          error={toastState.isError} 
          onDismiss={closeToast} 
        />
      )}
    </Box>
  );
}
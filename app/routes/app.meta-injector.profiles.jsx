import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, Box, Text, Scrollable, Checkbox, Select, Card, Button, Modal, Toast, EmptySearchResult
} from "@shopify/polaris";
import { METAFIELD_CONFIG, getLabelForValue } from "./app.meta-injector.constants";

export function ProfilesTab({ fetcher, products = [], dbProfiles = [] }) {
  const [profileSelectedIndex, setProfileSelectedIndex] = useState(0);
  const [profileSelectedProductIds, setProfileSelectedProductIds] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [stagedPayload, setStagedPayload] = useState([]);

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] }), []);

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    if (mf) return mf.node.value;
    return "";
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

  const activeProfile = dbProfiles[profileSelectedIndex];

  useEffect(() => {
    const data = fetcher.data;
    if (data && data.isValid !== undefined) {
      if (!data.isValid) {
        setToastState({ active: true, message: "Profile contains a deleted taxonomy entry — update the profile before applying.", isError: true });
      }
      if (data.isValid) {
        const selectedProducts = products.filter(p => profileSelectedProductIds.includes(p.id));
        setModalConfig({
          active: true,
          title: `Apply ${activeProfile?.name} Profile`,
          body: `Injecting validated data into empty fields across ${selectedProducts.length} products. Existing data is safe.`,
          diffs: [],
          payload: stagedPayload
        });
      }
    }
    if (data && data.message && data.isValid === undefined) {
      setToastState({ active: true, message: data.message, isError: !data.success });
      if (data.success) {
        closeModal();
      }
    }
  }, [fetcher.data, activeProfile, products, profileSelectedProductIds, stagedPayload, closeModal]);

  const handleApplyProfile = () => {
    const hasNoProducts = profileSelectedProductIds.length === 0;
    if (hasNoProducts) {
      setToastState({ active: true, message: "Select products from the list on the left first.", isError: true });
      return;
    }
    
    const selectedProducts = products.filter(p => profileSelectedProductIds.includes(p.id));
    const payload = [];
    const gidsToCheck = [];

    selectedProducts.forEach(product => {
      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const profileVal = activeProfile.data[field.key];
        const currentVal = getMetafieldValue(product, field.key);
        if (!profileVal) return;
        if (currentVal) return;

        const resolvedType = resolveMetafieldType(product, field, profileVal);
        payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: profileVal });
        
        const isReference = resolvedType === "list.metaobject_reference";
        if (isReference) {
          try { 
            const g = JSON.parse(profileVal); 
            if (g[0]) gidsToCheck.push(g[0]); 
          } catch(e) {}
        }
      });
    });

    const hasNoPayload = payload.length === 0;
    if (hasNoPayload) {
      setToastState({ active: true, message: "No empty fields to fill. Profiles operate in FILL ONLY mode.", isError: false });
      return;
    }

    const hasGids = gidsToCheck.length > 0;
    if (hasGids) {
      setStagedPayload(payload);
      fetcher.submit({ intent: "validateGIDs", gids: JSON.stringify([...new Set(gidsToCheck)]) }, { method: "post" });
    }
    if (!hasGids) {
      setModalConfig({
        active: true, 
        title: `Apply ${activeProfile.name} Profile`,
        body: `Injecting data into ${payload.length} empty fields across ${selectedProducts.length} products.`,
        diffs: [], 
        payload
      });
    }
  };

  const executeApply = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };

  const toggleProductSelection = (id) => {
    setProfileSelectedProductIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  return (
    <Box>
      {dbProfiles.length === 0 && (
        <Box padding="800">
          <EmptySearchResult title="No Profiles Found" description="Could not load profiles from the Render DB." withIllustration />
        </Box>
      )}

      {dbProfiles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
          <div style={{ flex: '0 0 350px' }}>
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <BlockStack gap="300">
                <Text variant="headingSm" as="h3">1. Select Target Products ({profileSelectedProductIds.length})</Text>
                <Scrollable style={{ height: '500px' }}>
                  <BlockStack gap="100">
                    {products.map(p => (
                      <div style={inputTapTargetStyle} key={p.id}>
                        <Checkbox 
                          label={p.title} 
                          checked={profileSelectedProductIds.includes(p.id)} 
                          onChange={() => toggleProductSelection(p.id)} 
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
            <BlockStack gap="400">
              <div style={inputTapTargetStyle}>
                <Select
                  label="Select Mineral Profile (From Render DB)"
                  options={dbProfiles.map((p, i) => ({ label: p.name, value: i.toString() }))}
                  value={profileSelectedIndex.toString()} 
                  onChange={(v) => setProfileSelectedIndex(parseInt(v, 10))} 
                  accessibilityLabel="Select mineral profile template"
                />
              </div>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h3">{activeProfile.name} Data Points</Text>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {Object.entries(activeProfile.data).map(([key, val]) => {
                      const matchConfig = METAFIELD_CONFIG.find(f => f.key === key);
                      const label = matchConfig?.label || key;
                      const displayVal = getLabelForValue(key, val);
                      return (
                        <Text key={key} as="p">
                          <span style={{ fontWeight: "bold" }}>{label}:</span> {displayVal}
                        </Text>
                      );
                    })}
                  </div>
                  <div style={tapTargetStyle}>
                    <Button 
                      tone="success" 
                      onClick={handleApplyProfile} 
                      loading={fetcher.state !== "idle"} 
                      accessibilityLabel={`Apply ${activeProfile.name} profile`}
                    >
                      Apply Profile (Fill Only)
                    </Button>
                  </div>
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </div>
      )}

      {modalConfig.active && (
        <Modal
          open={true} 
          onClose={closeModal} 
          title={modalConfig.title}
          primaryAction={{ content: "Confirm & Execute", onAction: executeApply, tone: "success", accessibilityLabel: "Confirm and execute profile application" }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel action" }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {modalConfig.body && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
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
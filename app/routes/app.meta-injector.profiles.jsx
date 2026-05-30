import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, Box, Text, Scrollable, Checkbox, Select, Card, Button, Modal, Toast, EmptySearchResult, InlineStack, FormLayout, TextField
} from "@shopify/polaris";
import { METAFIELD_CONFIG, getLabelForValue } from "./app.meta-injector.constants";

export function ProfilesTab({ fetcher, products = [], dbProfiles = [] }) {
  const [profileSelectedIndex, setProfileSelectedIndex] = useState(0);
  const [profileSelectedProductIds, setProfileSelectedProductIds] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [stagedPayload, setStagedPayload] = useState([]);
  
  // --- NEW STATE: Add Stone Modal ---
  const [isAddStoneModalOpen, setIsAddStoneModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    stoneName: "", authenticity: "100% Natural Earth-Mined", rarity: "Common", crystalSystem: "", geologicalEra: "", mineralClass: "", rockComposition: "", rockFormation: "", hardness: "", luster: "", fracture: "", cleavage: "", specificGravity: "", diaphaneity: ""
  });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] }), []);
  
  const handleTextChange = useCallback((value, id) => setFormData((prev) => ({ ...prev, [id]: value })), []);

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
          title: `Apply ${activeProfile?.title} Profile`,
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
        
        // Map UI keys to DB profile keys
        const profileKeyMap = {
          hardness_mohs: 'storeHardness',
          luster: 'storeLuster',
          fracture: 'storeFracture',
          cleavage: 'storeCleavage',
          specific_gravity: 'storeSpecificGravity',
          diaphaneity: 'storeDiaphaneity',
          crystal_system: 'googleCrystalSystem',
          geological_era: 'googleGeologicalEra',
          mineral_class: 'googleMineralClass',
          rock_composition: 'googleRockComposition',
          rock_formation: 'googleRockFormation'
        };

        const dbKey = profileKeyMap[field.key];
        const profileVal = activeProfile[dbKey];
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
        title: `Apply ${activeProfile.title} Profile`,
        body: `Injecting data into ${payload.length} empty fields across ${selectedProducts.length} products.`,
        diffs: [], 
        payload
      });
    }
  };

  const executeApply = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };
  
  // --- NEW: Execute Add Stone ---
  const handleSaveNewStone = () => {
    if (!formData.stoneName) {
      setToastState({ active: true, message: "Stone Name is required", isError: true });
      return;
    }
    fetcher.submit({ intent: "createStoneProfile", payload: JSON.stringify(formData) }, { method: "post" });
    setIsAddStoneModalOpen(false);
    setFormData({
      stoneName: "", authenticity: "100% Natural Earth-Mined", rarity: "Common", crystalSystem: "", geologicalEra: "", mineralClass: "", rockComposition: "", rockFormation: "", hardness: "", luster: "", fracture: "", cleavage: "", specificGravity: "", diaphaneity: ""
    });
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
      <InlineStack align="end" blockAlign="center">
         <div style={tapTargetStyle}>
           <Button variant="primary" onClick={() => setIsAddStoneModalOpen(true)}>
             + Add New Stone to Dictionary
           </Button>
         </div>
      </InlineStack>

      <Box paddingBlockStart="400">
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
                    options={dbProfiles.map((p, i) => ({ label: p.title, value: i.toString() }))}
                    value={profileSelectedIndex.toString()} 
                    onChange={(v) => setProfileSelectedIndex(parseInt(v, 10))} 
                    accessibilityLabel="Select mineral profile template"
                  />
                </div>
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingMd" as="h3">{activeProfile.title} Data Points</Text>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Hardness:</span> {activeProfile.storeHardness || "-"}</Text>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Crystal System:</span> {activeProfile.googleCrystalSystem || "-"}</Text>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Mineral Class:</span> {activeProfile.googleMineralClass || "-"}</Text>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Rock Comp:</span> {activeProfile.googleRockComposition || "-"}</Text>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Luster:</span> {activeProfile.storeLuster || "-"}</Text>
                      <Text as="p"><span style={{ fontWeight: "bold" }}>Cleavage:</span> {activeProfile.storeCleavage || "-"}</Text>
                    </div>
                    <div style={tapTargetStyle}>
                      <Button 
                        tone="success" 
                        onClick={handleApplyProfile} 
                        loading={fetcher.state !== "idle"} 
                        accessibilityLabel={`Apply ${activeProfile.title} profile`}
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
      </Box>

      {/* --- NEW UI: Add Stone Modal --- */}
      <Modal
        open={isAddStoneModalOpen}
        onClose={() => setIsAddStoneModalOpen(false)}
        title="Add New Stone to Dictionary"
        primaryAction={{ content: 'Save to Database', onAction: handleSaveNewStone }}
        secondaryActions={[{ content: 'Cancel', onAction: () => setIsAddStoneModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <FormLayout.Group>
              <TextField label="Stone Name (e.g. Jasper)" id="stoneName" value={formData.stoneName} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Mohs Hardness" id="hardness" value={formData.hardness} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Authenticity" id="authenticity" value={formData.authenticity} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Rarity" id="rarity" value={formData.rarity} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Crystal System" id="crystalSystem" value={formData.crystalSystem} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Mineral Class" id="mineralClass" value={formData.mineralClass} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Geological Era" id="geologicalEra" value={formData.geologicalEra} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Rock Formation" id="rockFormation" value={formData.rockFormation} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Rock Composition" id="rockComposition" value={formData.rockComposition} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Luster" id="luster" value={formData.luster} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Fracture" id="fracture" value={formData.fracture} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Cleavage" id="cleavage" value={formData.cleavage} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField label="Specific Gravity" id="specificGravity" value={formData.specificGravity} onChange={handleTextChange} autoComplete="off" />
              <TextField label="Diaphaneity (Transparency)" id="diaphaneity" value={formData.diaphaneity} onChange={handleTextChange} autoComplete="off" />
            </FormLayout.Group>
          </FormLayout>
        </Modal.Section>
      </Modal>

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
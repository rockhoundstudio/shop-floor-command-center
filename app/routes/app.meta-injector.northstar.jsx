import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, InlineStack, Box, DataTable, Badge, Text, Button, EmptySearchResult, Modal, Toast
} from "@shopify/polaris";
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

export function NorthStarTab({ fetcher, products = [], dbProfiles = [] }) {
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, payload: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, payload: [] }), []);

  useEffect(() => {
    if (fetcher.data && fetcher.data.message) {
      setToastState({ active: true, message: fetcher.data.message, isError: !fetcher.data.success });
      if (fetcher.data.success) {
        closeModal();
      }
    }
  }, [fetcher.data, closeModal]);

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

  // --- Translation Map for the New Prisma Database ---
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

  const matchedProducts = [];
  
  products.forEach(p => {
    // FIX: Properly anchor to base_stone_type
    const baseStone = getMetafieldValue(p, "base_stone_type");
    if (baseStone) {
      const profileMatch = dbProfiles.find(prof => prof.title && prof.title.toLowerCase() === baseStone.toLowerCase());
      
      if (profileMatch) {
        let fieldsToFill = 0;
        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const dbKey = profileKeyMap[field.key];
          const profileVal = dbKey ? profileMatch[dbKey] : null;
          
          if (profileVal && !getMetafieldValue(p, field.key)) fieldsToFill++;
        });
        if (fieldsToFill > 0) {
          matchedProducts.push({ product: p, profile: profileMatch, fillCount: fieldsToFill, matchedStoneName: baseStone });
        }
      }
    }
  });

  const handleCascadeData = () => {
    if (matchedProducts.length === 0) {
      setToastState({ active: true, message: "No matched products require filling.", isError: false });
      return;
    }

    const payload = [];
    const relevantProducts = [];
    
    matchedProducts.forEach(match => {
      relevantProducts.push(match.product);
      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const dbKey = profileKeyMap[field.key];
        const profileVal = dbKey ? match.profile[dbKey] : null;
        
        if (profileVal && !getMetafieldValue(match.product, field.key)) {
          const resolvedType = resolveMetafieldType(match.product, field, profileVal);
          payload.push({ ownerId: match.product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: profileVal });
        }
      });
    });

    setModalConfig({
      active: true, 
      title: "Cascade North Star Data",
      body: `Injecting data into ${payload.length} empty fields across ${relevantProducts.length} products using DB profiles. Existing data will not be overwritten.`,
      payload
    });
  };

  const executeCascade = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };

  return (
    <Box>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">North Star Auto-Fill Engine</Text>
            <Text variant="bodyMd" as="p" color="subdued">Matches the "Base Stone Type" metafield to your Render DB profiles and automatically fills in blank geological data.</Text>
          </BlockStack>
          <div style={tapTargetStyle}>
            <Button 
              tone="success" 
              onClick={handleCascadeData} 
              disabled={matchedProducts.length === 0} 
              accessibilityLabel="Cascade data from DB to matching products"
            >
              Cascade Data to Products
            </Button>
          </div>
        </InlineStack>
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <DataTable
            columnContentTypes={["text", "text", "numeric"]}
            headings={["Product", "Base Stone (Matched Profile)", "Empty Fields to Fill"]}
            rows={matchedProducts.map(m => [ 
              m.product.title, 
              <Badge tone="info" key={`badge-${m.product.id}`}>{m.profile.title}</Badge>, 
              m.fillCount.toString() 
            ])}
          />
          {matchedProducts.length === 0 && (
            <Box padding="400">
              <EmptySearchResult title="All caught up" description="No products found that need profile data filled." withIllustration={false} />
            </Box>
          )}
        </Box>
      </BlockStack>

      {modalConfig.active && (
        <Modal
          open={true} 
          onClose={closeModal} 
          title={modalConfig.title}
          primaryAction={{ content: "Confirm & Execute", onAction: executeCascade, tone: "success", accessibilityLabel: "Confirm and execute cascade" }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel cascade" }]}
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
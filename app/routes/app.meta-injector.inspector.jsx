import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, InlineStack, Box, Select, Button, EmptySearchResult, Spinner, Divider, Toast, Text, Card
} from "@shopify/polaris";

export function InspectorTab({ products, fetcher }) {
  const [activeProductId, setActiveProductId] = useState("");
  const [localData, setLocalData] = useState({});
  const [originalData, setOriginalData] = useState({});
  const [fieldTypes, setFieldTypes] = useState({});
  const [parsedGroups, setParsedGroups] = useState({});
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  
  const isInspectorLoading = fetcher.state !== "idle";
  const activeProduct = fetcher.data?.product || products.find(p => p.id === activeProductId);

  // Fetch complete product data when dropdown changes
  useEffect(() => {
    if (activeProductId) {
      fetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
    }
  }, [activeProductId]);

  // Parse ALL metafields dynamically from Shopify response
  useEffect(() => {
    if (activeProduct && activeProduct.metafields && activeProduct.metafields.edges) {
      const groups = {};
      const orig = {};
      const types = {};

      // First pass: catalogue everything present
      activeProduct.metafields.edges.forEach(({ node }) => {
        const { namespace, key, value, type } = node;
        if (!groups[namespace]) groups[namespace] = new Set();
        groups[namespace].add(key);
        
        const compositeKey = `${namespace}.${key}`;
        orig[compositeKey] = value || "";
        types[compositeKey] = type;
      });

      // Second pass: Mirror custom keys into rockhound namespace for cross-referencing
      if (groups['custom']) {
        if (!groups['rockhound']) groups['rockhound'] = new Set();
        groups['custom'].forEach(key => {
          groups['rockhound'].add(key);
          const compositeKey = `rockhound.${key}`;
          if (orig[compositeKey] === undefined) {
            orig[compositeKey] = "";
            types[compositeKey] = "single_line_text_field"; // Safe default for new fields
          }
        });
      }

      // Convert Sets to sorted Arrays, forcing rockhound to the top
      const sortedGroups = {};
      if (groups['rockhound']) {
        sortedGroups['rockhound'] = Array.from(groups['rockhound']).sort();
      }
      
      Object.keys(groups).sort().forEach(ns => {
        if (ns !== 'rockhound') {
          sortedGroups[ns] = Array.from(groups[ns]).sort();
        }
      });

      setParsedGroups(sortedGroups);
      setOriginalData(orig);
      setLocalData(orig); // Initialize editable state
      setFieldTypes(types);
    } else {
      setParsedGroups({});
      setOriginalData({});
      setLocalData({});
      setFieldTypes({});
    }
  }, [activeProduct]);

  // Handle Save Notifications
  useEffect(() => {
    if (fetcher.data && fetcher.data.message) {
      setToastState({ active: true, message: fetcher.data.message, isError: !fetcher.data.success });
      
      // If successful save, lock in the new localData as originalData to reset the diff state
      if (fetcher.data.success && fetcher.data.intent === "saveMetafields") {
        setOriginalData(localData);
      }
    }
  }, [fetcher.data]);

  const handleFieldChange = (compositeKey, val) => {
    setLocalData(prev => ({ ...prev, [compositeKey]: val }));
  };

  const handleSaveAll = () => {
    const payload = [];
    
    // Check what actually changed
    Object.keys(localData).forEach(compositeKey => {
      if (localData[compositeKey] !== originalData[compositeKey]) {
        const [namespace, key] = compositeKey.split(".");
        payload.push({
          ownerId: activeProduct.id,
          namespace: namespace,
          key: key,
          type: fieldTypes[compositeKey] || "single_line_text_field",
          value: localData[compositeKey]
        });
      }
    });

    if (payload.length === 0) {
      setToastState({ active: true, message: "No changes detected.", isError: false });
      return;
    }

    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
  };

  // Check if any fields differ from original to enable save button
  const hasUnsavedChanges = Object.keys(localData).some(k => localData[k] !== originalData[k]);

  return (
    <Box padding="400">
      <BlockStack gap="500">
        
        {/* Header & Product Selector */}
        <Card padding="400">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="200">
              <Text variant="headingLg" as="h2">Live Metafield Inspector</Text>
              <Box width="400px">
                <Select 
                  label="Select Product to Inspect" 
                  labelHidden
                  options={[{ label: "Select a product...", value: "" }, ...products.map(p => ({ label: p.title, value: p.id }))]} 
                  value={activeProductId} 
                  onChange={setActiveProductId} 
                  accessibilityLabel="Search and select product for inspector" 
                  disabled={isInspectorLoading}
                />
              </Box>
            </BlockStack>

            {isInspectorLoading && <Spinner size="large" accessibilityLabel="Loading data" />}

            {activeProductId && hasUnsavedChanges && (
              <Button 
                size="large" 
                tone="success" 
                variant="primary"
                onClick={handleSaveAll} 
                disabled={isInspectorLoading} 
                accessibilityLabel="Save all changed fields to Shopify"
              >
                Save Changes
              </Button>
            )}
          </InlineStack>
        </Card>

        {/* Empty State */}
        {!activeProductId && (
          <Box paddingBlockStart="800">
            <EmptySearchResult 
              title="No product selected" 
              description="Select a product from the dropdown above to load all live metafields across all namespaces." 
              withIllustration 
            />
          </Box>
        )}

        {/* Dynamic Metafield Render */}
        {activeProductId && Object.keys(parsedGroups).length > 0 && (
          <BlockStack gap="600">
            {Object.keys(parsedGroups).map(namespace => (
              <Card key={namespace} padding="500">
                <BlockStack gap="400">
                  
                  <Box borderBottom="1px solid #E1E3E5" paddingBlockEnd="200">
                    <Text variant="headingLg" as="h3" fontWeight="bold" textTransform="uppercase">
                      {namespace} Namespace
                    </Text>
                  </Box>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {parsedGroups[namespace].map(key => {
                      const compositeKey = `${namespace}.${key}`;
                      const val = localData[compositeKey] || "";
                      const isBlank = val.trim() === "";
                      const hasCustomEquivalent = !!originalData[`custom.${key}`];
                      
                      // Glaucoma & Contrast Visual Logic
                      let borderColor = "transparent";
                      if (!isBlank) {
                        borderColor = "#2E7D32"; // Green: Contains Data
                      } else if (namespace === "rockhound" && hasCustomEquivalent) {
                        borderColor = "#FBC02D"; // Yellow: Missing in rockhound but exists in custom
                      }

                      const bgColor = isBlank ? "#FFEBEE" : "#FFFFFF"; // Red background for empty

                      return (
                        <Box key={compositeKey}>
                          <div style={{
                            borderLeft: `6px solid ${borderColor}`,
                            paddingLeft: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                          }}>
                            <Text as="span" variant="bodySm" tone="subdued" fontWeight="bold">
                              {namespace}.{key}
                            </Text>
                            
                            {/* Native textarea ensures 100% control over styling, backgrounds, and accessibility sizes */}
                            <textarea
                              value={val}
                              onChange={(e) => handleFieldChange(compositeKey, e.target.value)}
                              aria-label={`Edit metafield ${namespace} ${key}`}
                              disabled={isInspectorLoading}
                              style={{
                                width: '100%',
                                minHeight: '60px', /* Massive tap target */
                                fontSize: '16px', /* Minimum 14px as requested, larger for accessibility */
                                padding: '12px',
                                backgroundColor: bgColor,
                                color: '#202223',
                                border: '1px solid #8C9196',
                                borderRadius: '4px',
                                resize: 'vertical',
                                fontFamily: 'inherit'
                              }}
                            />
                          </div>
                        </Box>
                      );
                    })}
                  </div>

                </BlockStack>
              </Card>
            ))}
          </BlockStack>
        )}

        {/* Global Toast Notifier */}
        {toastState.active && (
          <Toast 
            content={toastState.message} 
            error={toastState.isError} 
            onDismiss={closeToast} 
          />
        )}
      </BlockStack>
    </Box>
  );
}
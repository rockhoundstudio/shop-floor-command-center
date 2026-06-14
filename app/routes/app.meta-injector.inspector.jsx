import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack } from "@shopify/polaris";
import { MagicIcon, SaveIcon } from "@shopify/polaris-icons";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS } from "../utils/meta-injector.constants.jsx";

const FULL_META_GROUPS = [
  {
    heading: "Always Fill",
    color: "#2E7D32",
    fields: [
      { key: "piece_name", label: "Piece Name", type: "text" },
      { key: "primary_medium", label: "Primary Medium", type: "text" },
      { key: "handcrafted_by", label: "Handcrafted By", type: "select", options: ["Bob and Janyce", "Bob", "Janyce", "Guest Artist"] },
      { key: "is_one_of_a_kind", label: "Is One of a Kind", type: "select", options: ["Yes", "No"] },
      { key: "treated", label: "Treated", type: "select", options: ["Yes", "No"] }
    ]
  },
  {
    heading: "Stone Fields",
    color: "#1565C0",
    fields: [
      { key: "material", label: "Material", type: "text" },
      { key: "stone_family", label: "Stone Family", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "cut_and_shape", label: "Cut and Shape", type: "text" },
      { key: "surface_finish", label: "Surface Finish", type: "select", options: ["Polished", "Matte", "Natural", "High Polish"] },
      { key: "dimensions_mm", label: "Dimensions (mm)", type: "text" },
      { key: "weight_grams", label: "Weight (grams)", type: "text" }
    ]
  },
  {
    heading: "Story & Lore",
    color: "#E65100",
    fields: [
      { key: "origin_story", label: "Origin Story", type: "text", multiline: 4 },
      { key: "trip_or_series", label: "Trip or Series", type: "text" },
      { key: "honest_flaws_and_character", label: "Honest Flaws and Character", type: "text", multiline: 4 },
      { key: "artist_notes", label: "Artist Notes", type: "text", multiline: 4 },
      { key: "collection_name", label: "Collection Name", type: "text" }
    ]
  },
  {
    heading: "Mixed Media",
    color: "#6A1B9A",
    fields: [
      { key: "secondary_medium", label: "Secondary Medium", type: "text" },
      { key: "found_object", label: "Found Object", type: "select", options: ["Yes", "No"] }
    ]
  },
  {
    heading: "Google / SEO",
    color: "#F9A825",
    fields: [
      { key: "primary_use", label: "Primary Use", type: "text" },
      { key: "setting_ready", label: "Setting Ready", type: "select", options: ["Yes", "No"] },
      { key: "bail_included", label: "Bail Included", type: "select", options: ["Yes", "No"] }
    ]
  }
];

export function IntakeBenchTab({ products, fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const originalMetaRef = useRef({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptStyle, setPromptStyle] = useState("");

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    const product = products.find(p => p.id === id);
    const newForm = {};
    const newFullForm = {};
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        
        if (node.namespace === "rockhound" && hasValue) {
          newForm[node.key] = node.value;
        }
        if (node.namespace === "custom" && hasValue) {
          newFullForm[node.key] = node.value;
        }
      });
    }
    
    setFormState(newForm);
    setFullMetaState(newFullForm);
    originalMetaRef.current = { ...newFullForm };

    fetcher.submit(
      { intent: "smartAutoFill", productId: id },
      { method: "post" }
    );
  }, [products, fetcher]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFullMetaState = useCallback((key, value) => {
    setFullMetaState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");

    const product = products.find(p => p.id === selectedProductId) || {};
    const title = product.title || "";
    const description = product.descriptionHtml || product.description || "";

    fetcher.submit(
      { 
        intent: "autoFill", 
        productId: selectedProductId,
        productTitle: title,
        productDescription: description,
        promptStyle: promptStyle
      },
      { method: "post" }
    );
  }, [selectedProductId, fetcher, products, promptStyle]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    
    const payload = [];
    const entries = Object.entries(formState);
    
    entries.forEach(([key, value]) => {
      const isPopulated = value !== undefined && value !== null && value.toString().trim() !== "";
      
      if (isPopulated) {
        const config = ROCKHOUND_FIELDS.find(f => f.key === key);
        let fieldType = "single_line_text_field";
        if (config && config.type) {
          fieldType = config.type;
        }
        
        let formatId = `gid://shopify/Product/${selectedProductId}`;
        if (selectedProductId.includes("gid://")) {
          formatId = selectedProductId;
        }

        payload.push({
          ownerId: formatId,
          namespace: "rockhound",
          key: key,
          value: value.toString().trim(),
          type: fieldType 
        });
      }
    });

    if (payload.length === 0) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedProductId, formState, fetcher]);

  const handleSaveFullMeta = useCallback(() => {
    if (!selectedProductId) return;
    const changes = [];
    
    Object.entries(fullMetaState).forEach(([key, value]) => {
      const originalValue = originalMetaRef.current[key] || "";
      const newValue = value || "";
      if (originalValue !== newValue) {
        changes.push({
          namespace: "custom",
          key: key,
          value: newValue,
          type: "single_line_text_field"
        });
      }
    });

    if (changes.length > 0) {
      fetcher.submit(
        { intent: "saveMetafields", productId: selectedProductId, metafields: JSON.stringify(changes) },
        { method: "post" }
      );
    }
  }, [selectedProductId, fullMetaState, fetcher]);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;
    
    if (isIdle && hasData) {
      const isAutoFill = fetcher.data.intent === "autoFill";
      const isSmartAutoFill = fetcher.data.intent === "smartAutoFill";
      const isSaveProduct = fetcher.data.intent === "saveProduct";
      const isSaveMetafields = fetcher.data.intent === "saveMetafields";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if ((isAutoFill || isSmartAutoFill) && isSuccess && fetcher.data.fields) {
        setFormState(prev => {
          const updatedState = { ...prev };
          Object.entries(fetcher.data.fields).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "";
            if (hasNewValue) {
              updatedState[key] = val;
            }
          });
          return updatedState;
        });

        if (isSmartAutoFill) {
          setStatusMessage("Smart Auto-Fill complete — fields populated from all available data sources.");
        }
        
        if (isAutoFill) {
          setStatusMessage("Title and tags successfully parsed and loaded into fields.");
        }
      }

      if (isSaveProduct && isSuccess) {
        setStatusMessage("Metafields injected cleanly into Shopify database.");
      }

      if (isSaveMetafields && isSuccess) {
        originalMetaRef.current = { ...fullMetaState };
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Changes saved!");
        }
      }

      if (isError) {
        setErrorMessage(fetcher.data.error || "An unknown error occurred during the operation.");
      }
    }
  }, [fetcher.state, fetcher.data, fullMetaState]);

  const safeProducts = products || [];
  const isAutoFilling = fetcher.state !== "idle" && (fetcher.formData?.get("intent") === "autoFill" || fetcher.formData?.get("intent") === "smartAutoFill");
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct";
  const isSavingMetafields = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveMetafields";

  return (
    <BlockStack gap="400">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory</Text>
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {safeProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  return (
                    <div key={p.id} style={{ minHeight: "54px" }}>
                      <Button
                        fullWidth
                        size="large"
                        textAlign="left"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => handleSelectProduct(p.id)}
                        accessibilityLabel={`Select product ${p.title}`}
                      >
                        {p.title}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">2. Data Sieve & Injection</Text>
              
              {statusMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{statusMessage}</Text>
                  </Banner>
                </div>
              )}

              {errorMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{errorMessage}</Text>
                  </Banner>
                </div>
              )}

              <div style={{ minHeight: "54px" }}>
                <TextField
                  label="Gemini Presentation Style"
                  placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy. No corporate language."
                  value={promptStyle}
                  onChange={setPromptStyle}
                  multiline={3}
                  autoComplete="off"
                  disabled={!selectedProductId}
                  accessibilityLabel="Enter Gemini Presentation Style instructions"
                />
              </div>

              <InlineStack gap="300" align="space-between">
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={MagicIcon} 
                    onClick={handleAutoFill}
                    accessibilityLabel="Re-Run Auto-Fill Fields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isAutoFilling}
                  >
                    Re-Run Auto-Fill
                  </Button>
                </div>
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={SaveIcon} 
                    tone="success" 
                    variant="primary" 
                    onClick={handleInject}
                    accessibilityLabel="Inject Metafields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isSaving}
                  >
                    Inject Metafields
                  </Button>
                </div>
              </InlineStack>

              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {ROCKHOUND_FIELDS.map(field => {
                  const val = formState[field.key] || "";
                  const isDropdown = field.isDropdown === true;
                  const isText = !field.isDropdown;
                  
                  let safeVal = val;
                  let options = [];

                  if (isDropdown) {
                    const dropdownOptions = DEFAULT_DROPDOWNS[field.key] || [];
                    safeVal = dropdownOptions.includes(val) ? val : "";
                    options = [
                      { label: safeVal !== "" ? safeVal.replace(/ΓÇö/g, '—') : "Select...", value: safeVal },
                      ...dropdownOptions.filter(o => o !== safeVal).map(o => ({ label: o.replace(/ΓÇö/g, '—'), value: o }))
                    ];
                  }
                  
                  return (
                    <div key={field.key} style={{ minHeight: "54px" }}>
                      {isDropdown && (
                        <Select
                          label={field.label}
                          options={options}
                          value={DEFAULT_DROPDOWNS[field.key]?.includes(val) ? val : ""}
                          onChange={(v) => updateFormState(field.key, v)}
                          accessibilityLabel={`Select value for ${field.label}`}
                          disabled={!selectedProductId}
                        />
                      )}

                      {isText && (
                        <TextField
                          label={field.label}
                          value={val}
                          onChange={(v) => updateFormState(field.key, v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter text for ${field.label}`}
                          multiline={field.multiline && 3}
                          disabled={!selectedProductId}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>
      </div>

      {selectedProductId !== "" && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingLg" as="h3">Full Meta Report</Text>
              
              {FULL_META_GROUPS.map(group => (
                <BlockStack key={group.heading} gap="300">
                  <Text variant="headingMd" as="h4">
                    <span style={{ color: group.color, fontWeight: 'bold' }}>{group.heading}</span>
                  </Text>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {group.fields.map(field => {
                      const val = fullMetaState[field.key] || "";
                      const isNa = val === "n/a" || val === "N/A" || val === "N/a";
                      const isFilled = !isNa && val && val.trim() !== "";
                      const isEmpty = !isNa && (!val || val.trim() === "");
                      
                      const labelNode = (
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px', marginRight: '8px' }}>
                            {isEmpty && <circle cx="9" cy="9" r="9" fill="#C62828" />}
                            {isFilled && <circle cx="9" cy="9" r="9" fill="#2E7D32" />}
                            {isNa && <circle cx="9" cy="9" r="9" fill="#F9A825" />}
                          </svg>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{field.label}</span>
                        </div>
                      );

                      const isSelect = field.type === "select";
                      const isText = field.type === "text";

                      const selectOptions = [
                        { label: "Select...", value: "" },
                        ...(field.options || []).map(opt => ({ label: opt, value: opt }))
                      ];

                      return (
                        <div key={field.key}>
                          {isEmpty && (
                            <div style={{ backgroundColor: "#FFF5F5", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
                              {isSelect && (
                                <Select
                                  label={labelNode}
                                  options={selectOptions}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                />
                              )}
                              {isText && (
                                <TextField
                                  label={labelNode}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                  multiline={field.multiline}
                                  autoComplete="off"
                                />
                              )}
                            </div>
                          )}
                          {!isEmpty && (
                            <div style={{ backgroundColor: "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
                              {isSelect && (
                                <Select
                                  label={labelNode}
                                  options={selectOptions}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                />
                              )}
                              {isText && (
                                <TextField
                                  label={labelNode}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                  multiline={field.multiline}
                                  autoComplete="off"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </BlockStack>
              ))}

              <div style={{ marginTop: "16px", minHeight: "48px" }}>
                <Button
                  variant="primary"
                  size="large"
                  onClick={handleSaveFullMeta}
                  accessibilityLabel="Save all changed metafields to Shopify"
                  loading={isSavingMetafields}
                >
                  Save Changes
                </Button>
              </div>

            </BlockStack>
          </Card>
        </div>
      )}
    </BlockStack>
  );
}
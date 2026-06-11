import React, { useState, useEffect, useCallback } from "react";
import { useFetcher } from "react-router";
import { Card, Text, BlockStack, Box, TextField, Select, Button, InlineStack, Banner } from "@shopify/polaris";
import { MagicIcon, SaveIcon } from "@shopify/polaris-icons";
import { METAFIELD_CONFIG } from "../utils/meta-injector.constants.jsx";

const { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS } = METAFIELD_CONFIG;

export function IntakeBenchTab({ products, fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptStyle, setPromptStyle] = useState("");

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    const product = products.find(p => p.id === id);
    const newForm = {};
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      product.metafields.edges.forEach(({ node }) => {
        const isRockhound = node.namespace === "rockhound";
        const hasValue = node.value !== null && node.value !== undefined;
        if (isRockhound && hasValue) {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);

    fetcher.submit(
      { intent: "smartAutoFill", productId: id },
      { method: "post" }
    );
  }, [products, fetcher]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
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

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;
    
    if (isIdle && hasData) {
      const isAutoFill = fetcher.data.intent === "autoFill";
      const isSmartAutoFill = fetcher.data.intent === "smartAutoFill";
      const isSaveProduct = fetcher.data.intent === "saveProduct";
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

      if (isError) {
        setErrorMessage(fetcher.data.error || "An unknown error occurred during the operation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const safeProducts = products || [];
  const isAutoFilling = fetcher.state !== "idle" && (fetcher.formData?.get("intent") === "autoFill" || fetcher.formData?.get("intent") === "smartAutoFill");
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct";

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
                  accessibilityLabel="Enter Gemini Presentation Style"
                />
              </div>

              <fetcher.Form method="post" style={{ width: "100%" }}>
                <input type="hidden" name="intent" value="saveProduct" />
                {selectedProductId !== "" && (
                  <input type="hidden" name="productId" value={selectedProductId} />
                )}
                {Object.entries(formState).map(([key, value]) =>
                  value && value.toString().trim() !== "" && (
                    <input key={key} type="hidden" name={key} value={value.toString().trim()} />
                  )
                )}

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
                      submit
                      icon={SaveIcon} 
                      tone="success" 
                      variant="primary" 
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

                <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px", marginTop: "16px" }}>
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
                        { label: safeVal !== "" ? safeVal : "Select...", value: safeVal },
                        ...dropdownOptions.filter(o => o !== safeVal).map(o => ({ label: o, value: o }))
                      ];
                    }
                    
                    return (
                      <div key={field.key} style={{ minHeight: "54px" }}>
                        {isDropdown && (
                          <Select
                            name={field.key}
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
                            name={field.key}
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
              </fetcher.Form>

            </BlockStack>
          </Card>
        </div>
      </div>
    </BlockStack>
  );
}

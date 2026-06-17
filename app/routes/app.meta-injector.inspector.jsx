import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, Collapsible } from "@shopify/polaris";
import { MagicIcon, SaveIcon } from "@shopify/polaris-icons";
import { normalizeDropdownValue, DROPDOWN_OPTIONS } from "../utils/meta-injector.constants.jsx";

const ROCKHOUND_FIELDS = [
  // ==========================================
  // SECTION A: SHARED BATCH FIELDS (The Story & Material)
  // ==========================================
  { key: "stone_family", label: "Stone Family", isDropdown: true, isShared: true },
  { key: "color", label: "Color", isDropdown: true, isShared: true }, 
  { key: "surface_finish", label: "Surface Finish", isDropdown: true, isShared: true }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field", isShared: true },
  { key: "primary_use", label: "Primary Use", isDropdown: true, isShared: true }, 
  { key: "inspiration", label: "Whisper Theme / Inspiration", isDropdown: true, isShared: true }, 
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field", isShared: true },
  { key: "origin_story", label: "The Origin Story", type: "single_line_text_field", multiline: true, isShared: true },

  // ==========================================
  // SECTION B: PER-PIECE ROWS (The Hard Specs)
  // ==========================================
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_and_shape", label: "Cut / Shape", isDropdown: true, isPerPiece: true }, 
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field", isPerPiece: true },
  { key: "honest_flaws", label: "Character Marks (Honest Flaws)", type: "single_line_text_field", multiline: true, isPerPiece: true },
  { key: "price", label: "Price", type: "single_line_text_field", isPerPiece: true }
];

const FULL_META_GROUPS = [
  {
    heading: "Always Fill",
    color: "#2E7D32",
    fields: [
      { key: "piece_name", label: "Piece Name", type: "text" },
      { key: "primary_medium", label: "Primary Medium", type: "text" },
      { key: "handcrafted_by", label: "Handcrafted By", type: "select" },
      { key: "is_one_of_a_kind", label: "Is One of a Kind", type: "select" },
      { key: "treated", label: "Treated", type: "select" }
    ]
  },
  {
    heading: "Stone Fields",
    color: "#1565C0",
    fields: [
      { key: "material", label: "Material", type: "text" },
      { key: "stone_family", label: "Stone Family", type: "select" },
      { key: "color", label: "Color", type: "select" },
      { key: "cut_and_shape", label: "Cut and Shape", type: "select" },
      { key: "surface_finish", label: "Surface Finish", type: "select" },
      { key: "dimensions_mm", label: "Dimensions (mm)", type: "text" },
      { key: "weight_grams", label: "Weight (grams)", type: "text" }
    ]
  },
  {
    heading: "Story & Lore",
    color: "#E65100",
    fields: [
      { key: "origin_story", label: "Origin Story", type: "text", multiline: true },
      { key: "trip_or_series", label: "Trip or Series", type: "text" },
      { key: "honest_flaws_and_character", label: "Honest Flaws and Character", type: "text", multiline: true },
      { key: "artist_notes", label: "Artist Notes", type: "text", multiline: true },
      { key: "collection_name", label: "Collection Name", type: "text" }
    ]
  },
  {
    heading: "Mixed Media",
    color: "#6A1B9A",
    fields: [
      { key: "secondary_medium", label: "Secondary Medium", type: "text" },
      { key: "found_object", label: "Found Object", type: "select" }
    ]
  },
  {
    heading: "Google / SEO",
    color: "#F9A825",
    fields: [
      { key: "primary_use", label: "Primary Use", type: "select" },
      { key: "setting_ready", label: "Setting Ready", type: "select" },
      { key: "bail_included", label: "Bail Included", type: "select" }
    ]
  }
];

const NAMESPACE_MAP = {
  rockhound: [
    "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", 
    "material", "stone_family", "color", "cut_and_shape", "surface_finish", 
    "dimensions_mm", "weight_grams", "collection_name", "collection_location", 
    "collection_date", "primary_use", "setting_ready", "bail_included", 
    "is_one_of_a_kind", "treated", "found_object", "wire_material", 
    "artist_notes", "origin_story", "honest_flaws_and_character", "trip_or_series"
  ],
  geo: [
    "hardness", "luster", "fracture", "cleavage", "specificGravity", 
    "diaphaneity", "crystalSystem", "geologicalEra", "mineralClass", 
    "rockComposition", "rockFormation", "authenticity", "rarity"
  ]
};

const getNamespaceForKey = (key) => {
  if (NAMESPACE_MAP.rockhound.includes(key)) return "rockhound";
  if (NAMESPACE_MAP.geo.includes(key)) return "geo";
  return "custom";
};

export function IntakeBenchTab({ products, fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const originalMetaRef = useRef({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  
  // Debug State
  const [rawMetafields, setRawMetafields] = useState([]);
  const [isDebugOpen, setIsDebugOpen] = useState(true);

  // Tab 2 Auto-Fill State
  const [tab2StatusMessage, setTab2StatusMessage] = useState("");
  const [tab2ErrorMessage, setTab2ErrorMessage] = useState("");

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    setTab2StatusMessage("");
    setTab2ErrorMessage("");
    const product = products.find(p => p.id === id);
    const newForm = {};
    const newFullForm = {};
    const debugArray = [];
    
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      // Pass 1 — custom namespace only:
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        if (hasValue && node.namespace === "custom") {
          newForm[node.key] = node.value;
          newFullForm[node.key] = node.value;
          debugArray.push({ namespace: node.namespace, key: node.key, value: node.value });
        }
      });

      // Pass 2 — geo namespace only:
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        if (hasValue && node.namespace === "geo") {
          newForm[node.key] = node.value;
          newFullForm[node.key] = node.value;
          debugArray.push({ namespace: node.namespace, key: node.key, value: node.value });
        }
      });

      // Pass 3 — rockhound namespace (wins all conflicts):
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        if (hasValue && node.namespace === "rockhound") {
          let parsedValue = node.value;
          if (parsedValue.includes("gid://") || parsedValue.startsWith("[")) {
            parsedValue = "See Shopify metaobject";
          }
          newForm[node.key] = parsedValue;
          newFullForm[node.key] = parsedValue;
          debugArray.push({ namespace: node.namespace, key: node.key, value: node.value });
        }
      });
    }

    if (!newFullForm.handcrafted_by || newFullForm.handcrafted_by.trim() === "") {
        newFullForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
    }
    
    setRawMetafields(debugArray);
    setFormState(newForm);
    setFullMetaState(newFullForm);
    originalMetaRef.current = { ...newFullForm };
  }, [products]);

  // Seed formState from existing rockhound metafields when a product is selected
  useEffect(() => {
    if (selectedProductId && products && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product && product.metafields && product.metafields.edges) {
        setFormState(prev => {
          const updatedState = { ...prev };
          const dropdownFields = [
            "handcrafted_by", "is_one_of_a_kind", "treated", "found_object", 
            "primary_use", "setting_ready", "bail_included", "stone_family", 
            "color", "cut_and_shape", "surface_finish"
          ];
          const textFields = [
            "piece_name", "primary_medium", "material", "dimensions_mm", 
            "weight_grams", "origin_story", "trip_or_series", 
            "honest_flaws_and_character", "artist_notes", "collection_name", 
            "secondary_medium"
          ];

          product.metafields.edges.forEach(({ node }) => {
            if (node.namespace === "rockhound" && node.value && node.value.trim() !== "") {
              if (true) {
                if (dropdownFields.includes(node.key)) {
                  updatedState[node.key] = normalizeDropdownValue(node.key, node.value);
                } else if (textFields.includes(node.key)) {
                  updatedState[node.key] = node.value;
                }
              }
            }
          });
          return updatedState;
        });
      }
    }
  }, [selectedProductId, products]);

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

  const handleTab2AutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const product = products.find(p => p.id === selectedProductId) || {};
    const title = product.title || "";
    const description = product.descriptionHtml || product.description || "";
    
    // Attempt to extract image URL. If your product query doesn't pull images, this will be blank.
    let imageUrl = "";
    if (product.images && product.images.edges && product.images.edges.length > 0) {
        imageUrl = product.images.edges[0].node.url || "";
    }

    const promptText = `You are extracting structured product data for a gemstone jewelry store. Parse the following product title, description, and image and return a JSON object with these exact keys:

piece_name — the stone name after the last dash in the title
primary_medium — the stone type from the title (first segment before first dash)
collection_location — the location from the title (second segment between dashes)
color — primary color observed in the image, plain text
secondary_colors — any secondary colors observed in the image, plain text
cut_and_shape — the cabochon shape, from image and description
surface_finish — polish level from description or image
character_marks — any inclusions, matrix, anomalies, natural flaws observed in image or description, plain text
dimensions_mm — dimensions from description, plain text
weight_grams — weight if mentioned, plain text or empty string
origin_story — the full narrative story paragraphs from the description, preserve line breaks
artist_notes — any craft process notes or personal reflections from the description
trip_or_series — any collection or series link mentioned (e.g. The Yakima Collection, The Frankenstein Build)
collection_name — the named collection if mentioned
is_one_of_a_kind — Yes or No based on description
treated — No if description says natural or untreated, Yes if treated
found_object — Yes if purchased or found, No if raw material
setting_ready — Yes if already set or mounted, No if loose stone
bail_included — Yes if bail or wrap mentioned, No if not
handcrafted_by — always Bob & Janyce, Rockhound Studio

Return only valid JSON. No markdown. No explanation.

Title: ${title}
Description: ${description}
Image URL: ${imageUrl}`;

    fetcher.submit(
      { 
        intent: "tab2AutoFill", 
        productId: selectedProductId,
        prompt: promptText,
        imageUrl: imageUrl
      },
      { method: "post" }
    );
    console.log("Tab2 AutoFill imageUrl sent:", imageUrl);
  }, [selectedProductId, fetcher, products]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    
    const payload = [];
    const entries = Object.entries(formState);
    
    entries.forEach(([key, value]) => {
      const isPopulated = value !== undefined && value !== null && value.toString().trim() !== "";
      
      if (isPopulated && value !== "See Shopify metaobject") {
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
          namespace: "rockhound",
          key: key,
          type: fieldType,
          value: value,
          ownerId: formatId
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
      
      if (originalValue !== newValue && newValue !== "See Shopify metaobject") {
        changes.push({
          namespace: getNamespaceForKey(key),
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
      const isTab2AutoFill = fetcher.data.intent === "tab2AutoFill";
      const isSaveProduct = fetcher.data.intent === "saveProduct";
      const isSaveMetafields = fetcher.data.intent === "saveMetafields";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if ((isAutoFill || isSmartAutoFill) && isSuccess && fetcher.data.fields) {
        setFormState(prev => {
          const updatedState = { ...prev };
          Object.entries(fetcher.data.fields).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "";
            
            // Only fill if currently empty in fullMetaState
            const currentlyEmpty = !fullMetaState[key] || (typeof fullMetaState[key] === 'string' && fullMetaState[key].trim() === "");
            
            if (hasNewValue && currentlyEmpty && val !== "See Shopify metaobject") {
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

      if (isTab2AutoFill) {
        if (isSuccess && fetcher.data.fields) {
            setFullMetaState(prev => {
                const updatedState = { ...prev };
                Object.entries(fetcher.data.fields).forEach(([key, val]) => {
                    const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "";
                    // Only fill if currently empty
                    const currentlyEmpty = !updatedState[key] || updatedState[key].trim() === "";
                    
                    if (hasNewValue && currentlyEmpty && val !== "See Shopify metaobject") {
                        updatedState[key] = val;
                    }
                });
                return updatedState;
            });
            setTab2StatusMessage("Auto-Fill complete — review fields before saving");
        } else if (isError) {
            setTab2ErrorMessage(fetcher.data.error || "Gemini extraction failed.");
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

      if (isError && !isTab2AutoFill) {
        setErrorMessage(fetcher.data.error || "An unknown error occurred during the operation.");
      }
    }
  }, [fetcher.state, fetcher.data, fullMetaState]);

  const safeProducts = products || [];
  const isAutoFilling = fetcher.state !== "idle" && (fetcher.formData?.get("intent") === "autoFill" || fetcher.formData?.get("intent") === "smartAutoFill");
  const isTab2AutoFilling = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "tab2AutoFill";
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

                  if (isDropdown) {
                    safeVal = DROPDOWN_OPTIONS[field.key]?.some(opt => opt.value === val) ? val : "";
                  }
                  
                  return (
                    <div key={field.key} style={{ minHeight: "54px" }}>
                      {isDropdown && (
                        <Select
                          label={field.label}
                          options={[{ label: safeVal !== "" ? safeVal : "Select...", value: safeVal }, ...(DROPDOWN_OPTIONS[field.key] || []).filter(opt => opt.value !== safeVal)]}
                          value={DROPDOWN_OPTIONS[field.key]?.some(opt => opt.value === val) ? val : ""}
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
                          disabled={!selectedProductId || val === "See Shopify metaobject"}
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
              
              <div style={{ marginBottom: "16px" }}>
                <Button 
                    onClick={() => setIsDebugOpen(!isDebugOpen)} 
                    ariaExpanded={isDebugOpen} 
                    ariaControls="debug-panel"
                    variant="plain"
                >
                    RAW METAFIELD DEBUG — ALL NAMESPACES {isDebugOpen ? '(Hide)' : '(Show)'}
                </Button>
                
                <Collapsible 
                    open={isDebugOpen} 
                    id="debug-panel" 
                    transition={{ duration: '200ms', timingFunction: 'ease-in-out' }}
                >
                    <div style={{ 
                        backgroundColor: "#1C2226", 
                        color: "#E3E5E7", 
                        padding: "16px", 
                        borderRadius: "8px", 
                        fontFamily: "monospace", 
                        fontSize: "14px",
                        marginTop: "8px",
                        maxHeight: "300px",
                        overflowY: "auto",
                        border: "1px solid #4A5157"
                    }}>
                        {rawMetafields.length > 0 ? (
                            rawMetafields.map((meta, index) => (
                                <div key={index} style={{ marginBottom: "4px", borderBottom: "1px solid #31383D", paddingBottom: "4px" }}>
                                    <span style={{ color: "#4BB543" }}>{meta.namespace}</span> | <span style={{ color: "#2E96FF" }}>{meta.key}</span> | <span>{meta.value}</span>
                                </div>
                            ))
                        ) : (
                            <div style={{ color: "#A6B0B7" }}>No metafields found for this product.</div>
                        )}
                    </div>
                </Collapsible>
              </div>

              {tab2StatusMessage !== "" && (
                <div style={{ minHeight: "54px", marginBottom: "16px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{tab2StatusMessage}</Text>
                  </Banner>
                </div>
              )}

              {tab2ErrorMessage !== "" && (
                <div style={{ minHeight: "54px", marginBottom: "16px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{tab2ErrorMessage}</Text>
                  </Banner>
                </div>
              )}

              <div style={{ marginBottom: "24px" }}>
                <Button 
                    icon={MagicIcon}
                    size="large"
                    fullWidth
                    onClick={handleTab2AutoFill}
                    accessibilityLabel="Extract fields from product description and image"
                    loading={isTab2AutoFilling}
                    disabled={!selectedProductId}
                >
                    Extract from Description & Image
                </Button>
              </div>

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

                      return (
                        <div key={field.key}>
                          {isEmpty && (
                            <div style={{ backgroundColor: "#FFF5F5", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
                              {DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
                                <Select
                                  label={labelNode}
                                  options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]}
                                  value={fullMetaState[field.key] || ""}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                />
                              ) : (
                                <TextField
                                  label={labelNode}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                  multiline={field.multiline ? true : false}
                                  autoComplete="off"
                                />
                              )}
                            </div>
                          )}
                          {!isEmpty && (
                            <div style={{ backgroundColor: "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
                              {DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
                                <Select
                                  label={labelNode}
                                  options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]}
                                  value={fullMetaState[field.key] || ""}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                />
                              ) : (
                                <TextField
                                  label={labelNode}
                                  value={val}
                                  onChange={(v) => updateFullMetaState(field.key, v)}
                                  accessibilityLabel={field.label}
                                  multiline={field.multiline ? true : false}
                                  autoComplete="off"
                                  disabled={val === "See Shopify metaobject"}
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
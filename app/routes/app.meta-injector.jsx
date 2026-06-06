import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, Icon, InlineStack, Checkbox, Modal
} from "@shopify/polaris";
import { SearchIcon, MagicIcon } from "@shopify/polaris-icons";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";

// --- IMPORT THE CONSTANTS ---
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

// --- IMPORT THE TABS ---
import { MatrixTab } from "./app.meta-injector.matrix";
import { InspectorTab } from "./app.meta-injector.inspector";
import { OriginsTab } from "./app.meta-injector.origins";
import { ProfilesTab } from "./app.meta-injector.profiles";
import { SnapshotsTab } from "./app.meta-injector.snapshots";
import { CsvTab } from "./app.meta-injector.csv";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

const EXACT_METAFIELDS = [
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "primary_medium", label: "Primary Medium", type: "single_line_text_field" },
  { key: "secondary_medium", label: "Secondary Medium", type: "single_line_text_field" },
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "material", label: "Material", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field" },
  { key: "color", label: "Color", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut and Shape", type: "single_line_text_field" },
  { key: "surface_finish", label: "Surface Finish", isDropdown: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "trip_or_series", label: "Trip or Series", type: "single_line_text_field" },
  { key: "collection_name", label: "Collection Name", type: "single_line_text_field" },
  { key: "collection_location", label: "Collection Location", type: "single_line_text_field" },
  { key: "collection_date", label: "Collection Date", type: "single_line_text_field" },
  { key: "inspired_by", label: "Inspired By", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", isDropdown: true },
  { key: "setting_ready", label: "Setting Ready", isDropdown: true },
  { key: "bail_included", label: "Bail Included", isDropdown: true },
  { key: "is_one_of_a_kind", label: "Is One of a Kind", isDropdown: true },
  { key: "treated", label: "Treated", isDropdown: true },
  { key: "found_object", label: "Found Object", isDropdown: true },
  { key: "wire_material", label: "Wire Material", isDropdown: true },
  { key: "submitted_by", label: "Submitted By", type: "single_line_text_field" },
  { key: "origin_story", label: "Origin Story", type: "single_line_text_field", multiline: true },
  { key: "honest_flaws_and_character", label: "Honest Flaws and Character", type: "single_line_text_field", multiline: true },
  { key: "artist_notes", label: "Artist Notes", type: "single_line_text_field", multiline: true }
];

const DEFAULT_DROPDOWNS = {
  surface_finish: ["High polish lapidary finish", "Satin lapidary finish", "Raw natural surface", "Partial polish", "Tumble polished", "Hand rubbed finish"],
  primary_use: ["Wearable pendant", "Lapidary cabochon for setting", "Wire wrapped jewelry", "Display specimen", "Collector piece", "Freeform stone art", "Bezel setting ready", "Rockhound specimen"],
  setting_ready: ["Yes — bezel ready", "Yes — prong ready", "Needs evaluation", "No — display only"],
  bail_included: ["No bail", "Pinch bail included", "Custom copper wire bail", "Custom gold plated bail", "Soldered bail"],
  is_one_of_a_kind: ["Yes — one of a kind", "No — series piece"],
  treated: ["Untreated — natural", "Stabilized", "Dyed", "Coated", "Heat treated"],
  found_object: ["Wild collected — Bob and Janyce", "Customer submission", "Purchased rough", "Gifted specimen", "Rescued material"],
  wire_material: ["Copper wire", "Brass wire", "Sterling silver wire", "Gold plated wire", "Copper and brass mixed"]
};

const StatusIcon = ({ value }) => {
  const valStr = (value || "").toString().trim().toLowerCase();
  
  let color = "#C62828";
  let label = "Empty field";
  
  if (valStr === "n/a" || valStr === "n/a") {
    color = "#F9A825";
    label = "N/A value";
  } else if (valStr !== "") {
    color = "#2E7D32";
    label = "Field complete";
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '24px', minHeight: '24px' }}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        aria-label={label}
        role="img"
        style={{ flexShrink: 0 }}
      >
        <circle cx="7" cy="7" r="7" fill={color} />
      </svg>
    </div>
  );
};

function InjectorUI({ fetcher, products, shopify, pageInfo, metafieldDefinitions = [] }) {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState({});
  const [dropdownLists, setDropdownLists] = useState(DEFAULT_DROPDOWNS);
  
  const [selectedProductId, setSelectedProductId] = useState("");
  const [currentProductTitle, setCurrentProductTitle] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  
  const [addingNewTermFor, setAddingNewTermFor] = useState(null);
  const [newTermValue, setNewTermValue] = useState("");

  const [isTrendModalOpen, setIsTrendModalOpen] = useState(false);
  const [trendTargetDropdowns, setTrendTargetDropdowns] = useState({});

  const [newSchemaKey, setNewSchemaKey] = useState("");
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaType, setNewSchemaType] = useState("single_line_text_field");

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  const handleModeToggle = useCallback((bulk) => {
    setIsBulkMode(bulk);
    setFormState({});
    setSelectedProductId("");
    setSelectedProductIds([]);
    setCurrentProductTitle("");
  }, []);

  const performLocalAutoFill = useCallback((productToFill) => {
    const newForm = {};

    // 1. Title Parser
    if (productToFill && productToFill.title) {
      const parts = productToFill.title.split(" — ");
      if (parts.length === 1) {
        newForm.piece_name = parts[0];
      } else if (parts.length === 2) {
        newForm.material = parts[0];
        newForm.piece_name = parts[1];
      } else if (parts.length >= 3) {
        newForm.material = parts[0];
        newForm.collection_location = parts[1];
        newForm.piece_name = parts[parts.length - 1];
      }
    }

    // 2. Description Parser
    if (productToFill && productToFill.descriptionHtml) {
      const strippedHtml = productToFill.descriptionHtml.replace(/<[^>]*>?/gm, '');
      const lines = strippedHtml.split('\n');
      
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith("Dimensions:")) {
          newForm.dimensions_mm = trimmed.replace("Dimensions:", "").trim();
        } else if (trimmed.startsWith("Finish:")) {
          newForm.surface_finish = trimmed.replace("Finish:", "").trim();
        } else if (trimmed.startsWith("Mohs:")) {
          newForm.artist_notes = `Mohs: ${trimmed.replace("Mohs:", "").trim()}`;
        } else if (trimmed.startsWith("One of a Kind:")) {
           const val = trimmed.replace("One of a Kind:", "").trim();
           if(val.toLowerCase() === "yes"){
              newForm.is_one_of_a_kind = "true";
           }
        }
      });
    }

    // 3. Existing Metafields (overwrites parsed title and description data)
    if (productToFill && productToFill.metafields && productToFill.metafields.edges) {
      productToFill.metafields.edges.forEach(({ node }) => {
        if (node.namespace === "rockhound" && node.value) {
          newForm[node.key] = node.value;
        }
      });
    }

    // 4. Smart Defaults
    if (!newForm.is_one_of_a_kind) {
      newForm.is_one_of_a_kind = "Yes — one of a kind";
    }
    if (!newForm.handcrafted_by) {
      newForm.handcrafted_by = "Robert";
    }

    return newForm;
  }, []);

  const handleSingleSelect = useCallback((product) => {
    setSelectedProductId(product.id);
    setCurrentProductTitle(product.title);
    
    const autoFilledForm = performLocalAutoFill(product);
    setFormState(autoFilledForm);
    
    if (shopify) shopify.toast.show(`Loaded fields for ${product.title}`);
  }, [shopify, performLocalAutoFill]);

  const toggleBulkSelection = useCallback((id) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  }, []);

  const handleFieldChange = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClear = useCallback(() => {
    setFormState({});
    if (!isBulkMode) {
      setSelectedProductId("");
      setCurrentProductTitle("");
    } else {
      setSelectedProductIds([]);
    }
    if (shopify) shopify.toast.show("Form cleared");
  }, [isBulkMode, shopify]);

  const handleAutoFill = useCallback(() => {
    if (isBulkMode) return;
    
    if (!selectedProductId) {
      if (shopify) shopify.toast.show("Please select a product first", { isError: true });
      return;
    }

    const product = products.find(p => p.id === selectedProductId);
    if (product) {
      const autoFilledForm = performLocalAutoFill(product);
      setFormState(autoFilledForm);
      if (shopify) shopify.toast.show("Auto-filled from title, description, and defaults");
    }
  }, [selectedProductId, isBulkMode, products, performLocalAutoFill, shopify]);

  const handleInject = useCallback(() => {
    const targetIds = isBulkMode ? selectedProductIds : (selectedProductId ? [selectedProductId] : []);

    if (targetIds.length === 0) {
      if (shopify) shopify.toast.show(`Please select ${isBulkMode ? 'at least one' : 'a'} product first`, { isError: true });
      return;
    }

    const validEntries = Object.entries(formState).filter(([key, value]) => value !== undefined && value.toString().trim() !== "");

    if (validEntries.length === 0) {
      if (shopify) shopify.toast.show("No fields filled out to save.", { isError: true });
      return;
    }

    const payload = [];
    
    targetIds.forEach(id => {
      validEntries.forEach(([key, value]) => {
        const config = EXACT_METAFIELDS.find(f => f.key === key);
        const fieldType = config && config.type ? config.type : "single_line_text_field";

        payload.push({
          ownerId: id,
          namespace: "rockhound",
          key,
          value: value.toString(),
          type: fieldType 
        });
      });
    });

    const formData = new FormData();
    formData.append("intent", "saveMetafields");
    formData.append("payload", JSON.stringify(payload));

    fetcher.submit(formData, { method: "post" });
  }, [selectedProductId, selectedProductIds, isBulkMode, formState, fetcher, shopify]);

  const confirmNewTerm = useCallback((fieldKey) => {
    if (!newTermValue.trim()) return;
    setDropdownLists(prev => ({
      ...prev,
      [fieldKey]: [...(prev[fieldKey] || []), newTermValue.trim()]
    }));
    handleFieldChange(fieldKey, newTermValue.trim());
    setAddingNewTermFor(null);
    setNewTermValue("");
    if (shopify) shopify.toast.show("Term added permanently");
  }, [newTermValue, handleFieldChange, shopify]);

  const handleTrendWatchCall = useCallback(() => {
    const prompt = "You are an SEO expert in the handcrafted stone jewelry, lapidary, rockhound, wire wrapped jewelry, and artisan gemstone communities. Review these dropdown terms currently in use and suggest 3-5 hot trending alternatives or additions that real buyers are searching right now. Be specific — no generic terms.";
    
    const payload = {
      intent: "geminiTrendWatch",
      prompt,
      currentLists: dropdownLists
    };
    fetcher.submit({ payload: JSON.stringify(payload) }, { method: "post" });
  }, [dropdownLists, fetcher]);

  const handleAddTrend = useCallback((term, dropdownKey) => {
    setDropdownLists(prev => ({
      ...prev,
      [dropdownKey]: [...(prev[dropdownKey] || []), term]
    }));
    if (shopify) shopify.toast.show(`Added "${term}" to ${dropdownKey}`);
  }, [shopify]);

  const handleCreateDefinition = useCallback(() => {
    if (!newSchemaKey || !newSchemaName) {
      if (shopify) shopify.toast.show("Key and Display Name are required", { isError: true });
      return;
    }
    const payload = {
      intent: "createMetafieldDefinition",
      namespace: "rockhound",
      key: newSchemaKey,
      name: newSchemaName,
      type: newSchemaType
    };
    fetcher.submit({ payload: JSON.stringify(payload) }, { method: "post" });
    setNewSchemaKey("");
    setNewSchemaName("");
  }, [newSchemaKey, newSchemaName, newSchemaType, fetcher, shopify]);

  const handleRemoveDefinition = useCallback((definitionId) => {
    const payload = {
      intent: "deleteMetafieldDefinition",
      id: definitionId
    };
    fetcher.submit({ payload: JSON.stringify(payload) }, { method: "post" });
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (shopify && fetcher.data.intent === "saveMetafields") shopify.toast.show("Metafields securely updated");
        if (isBulkMode && fetcher.data.intent === "saveMetafields") {
            setFormState({});
            setSelectedProductIds([]);
        }
      }
      if (fetcher.data.geminiFillSuccess && fetcher.data.autoFillData) {
        setFormState(prev => ({ ...prev, ...fetcher.data.autoFillData }));
        if (shopify) shopify.toast.show("Gemini applied auto-fill values");
      }
    }
  }, [fetcher.state, fetcher.data, isBulkMode, shopify]);

  const trendSuggestions = (fetcher.data && fetcher.data.trendSuggestions) ? fetcher.data.trendSuggestions : [];
  const dropdownKeys = Object.keys(dropdownLists);

  return (
    <BlockStack gap="600">
      <Card padding="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" as="h2">Database Injector</Text>
          <InlineStack gap="300">
            <div style={{ minHeight: "48px" }}>
              <Button 
                size="large" 
                pressed={!isBulkMode} 
                onClick={() => handleModeToggle(false)}
                accessibilityLabel="Switch to Single Product Mode"
              >
                Single Product
              </Button>
            </div>
            <div style={{ minHeight: "48px" }}>
              <Button 
                size="large" 
                pressed={isBulkMode} 
                onClick={() => handleModeToggle(true)}
                accessibilityLabel="Switch to Bulk Edit Mode"
              >
                Bulk Edit
              </Button>
            </div>
            <div style={{ minHeight: "48px" }}>
              <Button 
                size="large" 
                tone="magic"
                onClick={() => setIsTrendModalOpen(true)}
                accessibilityLabel="Open SEO Trend Watch Modal"
              >
                Trend Watch
              </Button>
            </div>
          </InlineStack>
        </InlineStack>
      </Card>

      <div style={{ display: "flex", width: "100%", gap: "24px", alignItems: "flex-start" }}>
        
        {/* LEFT COLUMN - 50% */}
        <div style={{ flex: "0 0 calc(50% - 12px)", width: "calc(50% - 12px)" }}>
          <Card padding="400">
            <BlockStack gap="400">
              <div style={{ minHeight: '48px' }}>
                <TextField
                  prefix={<Icon source={SearchIcon} />}
                  onChange={setSearchQuery}
                  label="Search Products"
                  labelHidden
                  value={searchQuery}
                  placeholder="Search inventory..."
                  autoComplete="off"
                  accessibilityLabel="Search inventory"
                />
              </div>
              
              <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                {filteredProducts.map(p => {
                  const isSelected = isBulkMode ? selectedProductIds.includes(p.id) : selectedProductId === p.id;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => isBulkMode ? toggleBulkSelection(p.id) : handleSingleSelect(p)}
                      style={{
                        padding: "16px 20px",
                        minHeight: "48px",
                        border: isSelected ? "2px solid #2E7D32" : "1px solid #E1E3E5",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "#F3F8F4" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        transition: "all 0.15s ease-in-out"
                      }}
                      role="button"
                      aria-label={`Select ${p.title}`}
                      aria-pressed={isSelected}
                    >
                      {isBulkMode && (
                        <div style={{ pointerEvents: "none", minHeight: '48px', display: 'flex', alignItems: 'center' }}>
                          <Checkbox checked={isSelected} onChange={() => {}} label={p.title} labelHidden ariaDescribedBy={`Select ${p.title}`} />
                        </div>
                      )}
                      <Text fontWeight={isSelected ? "bold" : "regular"} as="span">{p.title}</Text>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <Box padding="400">
                    <Text tone="subdued" alignment="center">No products found</Text>
                  </Box>
                )}
                {pageInfo && pageInfo.hasNextPage && (
                  <div style={{ minHeight: '48px', marginTop: '16px' }}>
                     <Button 
                       fullWidth 
                       size="large" 
                       onClick={() => fetcher.submit({ intent: "loadMoreProducts" }, { method: "post" })}
                       accessibilityLabel="Load more products"
                     >
                       Load More
                     </Button>
                  </div>
                )}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN - 50% */}
        <div style={{ flex: "0 0 calc(50% - 12px)", width: "calc(50% - 12px)", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <Card padding="400">
            <BlockStack gap="400">
              {(!isBulkMode && selectedProductId) && (
                <InlineStack align="end">
                  <div style={{ minHeight: '48px' }}>
                    <Button 
                      icon={MagicIcon} 
                      onClick={handleAutoFill} 
                      accessibilityLabel="Auto-Fill Empty Fields"
                      tone="success"
                      size="large"
                    >
                      Auto-Fill
                    </Button>
                  </div>
                </InlineStack>
              )}

              {isBulkMode && (
                <Banner tone="info" title="Bulk Edit Mode Active">
                  <p>Fields left empty will be safely skipped. Filling a field will overwrite that data on <b>all {selectedProductIds.length} selected products</b>.</p>
                </Banner>
              )}

              <div style={{ maxHeight: "55vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px" }}>
                {EXACT_METAFIELDS.map(field => {
                  const value = formState[field.key] || "";
                  
                  const labelWithIcon = (
                    <span style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: '32px' }}>
                      <StatusIcon value={value} />
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{field.label}</Text>
                    </span>
                  );
                  
                  if (field.isDropdown) {
                    const options = [...(dropdownLists[field.key] || []), "Add New..."];
                    const uniqueOptions = [{ label: "Select...", value: "" }, ...options.map(o => ({ label: o, value: o }))];

                    if (addingNewTermFor === field.key) {
                      return (
                        <BlockStack gap="200" key={field.key}>
                          {labelWithIcon}
                          <InlineStack gap="200" blockAlign="center">
                            <div style={{ flexGrow: 1, minHeight: '48px' }}>
                              <TextField
                                value={newTermValue}
                                onChange={setNewTermValue}
                                accessibilityLabel={`New term for ${field.label}`}
                                placeholder="Type new term..."
                                autoComplete="off"
                              />
                            </div>
                            <div style={{ minHeight: '48px' }}>
                              <Button size="large" tone="success" onClick={() => confirmNewTerm(field.key)} accessibilityLabel={`Confirm new term for ${field.label}`}>Confirm</Button>
                            </div>
                            <div style={{ minHeight: '48px' }}>
                              <Button size="large" onClick={() => setAddingNewTermFor(null)} accessibilityLabel={`Cancel adding new term for ${field.label}`}>Cancel</Button>
                            </div>
                          </InlineStack>
                        </BlockStack>
                      );
                    }

                    return (
                      <div key={field.key} style={{ minHeight: '48px' }}>
                        <Select
                          label={labelWithIcon}
                          options={uniqueOptions}
                          value={value}
                          onChange={(val) => {
                            if (val === "Add New...") {
                              setAddingNewTermFor(field.key);
                              setNewTermValue("");
                            } else {
                              handleFieldChange(field.key, val);
                            }
                          }}
                          accessibilityLabel={field.label}
                        />
                      </div>
                    );
                  }
                  
                  return (
                    <div key={field.key} style={{ minHeight: '48px' }}>
                      <TextField
                        label={labelWithIcon}
                        value={value}
                        onChange={(val) => handleFieldChange(field.key, val)}
                        autoComplete="off"
                        accessibilityLabel={field.label}
                        multiline={field.multiline ? 3 : false}
                      />
                    </div>
                  );
                })}
              </div>

              <InlineStack gap="400" align="end">
                <div style={{ minHeight: '52px', minWidth: '140px' }}>
                  <Button size="large" onClick={handleClear} accessibilityLabel="Clear all fields">Clear Form</Button>
                </div>
                <div style={{ minHeight: '52px', minWidth: '180px' }}>
                  <Button 
                    size="large" 
                    variant="primary" 
                    onClick={handleInject} 
                    accessibilityLabel="Save to Shopify" 
                    loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveMetafields"}
                  >
                    {isBulkMode ? `Save to ${selectedProductIds.length} Products` : "Save to Shopify"}
                  </Button>
                </div>
              </InlineStack>
            </BlockStack>
          </Card>

          {/* SCHEMA MANAGER SECTION */}
          <Card padding="400">
             <BlockStack gap="400">
                <Text variant="headingLg" as="h3">Manage Fields</Text>
                <Text tone="subdued">Current metafield definitions in the <b>rockhound</b> namespace.</Text>
                
                {metafieldDefinitions.length > 0 && (
                   <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {metafieldDefinitions.map(def => (
                         <div key={def.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid #E1E3E5', borderRadius: '8px' }}>
                            <Text>{def.name} ({def.key})</Text>
                            <div style={{ minHeight: '48px' }}>
                              <Button 
                                tone="critical" 
                                onClick={() => handleRemoveDefinition(def.id)}
                                accessibilityLabel={`Remove field definition for ${def.name}`}
                              >
                                Remove
                              </Button>
                            </div>
                         </div>
                      ))}
                   </div>
                )}

                <div style={{ padding: '16px', backgroundColor: '#F4F6F8', borderRadius: '8px', marginTop: '16px' }}>
                   <BlockStack gap="400">
                      <Text variant="headingMd">Add Field Definition</Text>
                      <InlineStack gap="400" blockAlign="end">
                         <div style={{ flexGrow: 1, minHeight: '48px' }}>
                            <TextField 
                               label="Field Key" 
                               value={newSchemaKey} 
                               onChange={setNewSchemaKey} 
                               autoComplete="off" 
                               accessibilityLabel="New field key" 
                            />
                         </div>
                         <div style={{ flexGrow: 1, minHeight: '48px' }}>
                            <TextField 
                               label="Display Name" 
                               value={newSchemaName} 
                               onChange={setNewSchemaName} 
                               autoComplete="off" 
                               accessibilityLabel="New field display name" 
                            />
                         </div>
                         <div style={{ flexGrow: 1, minHeight: '48px' }}>
                            <Select 
                               label="Type" 
                               options={[{ label: 'Single Line Text', value: 'single_line_text_field' }]} 
                               value={newSchemaType} 
                               onChange={setNewSchemaType} 
                               accessibilityLabel="New field type" 
                            />
                         </div>
                         <div style={{ minHeight: '48px' }}>
                            <Button size="large" onClick={handleCreateDefinition} accessibilityLabel="Create new metafield definition">Add Field</Button>
                         </div>
                      </InlineStack>
                   </BlockStack>
                </div>
             </BlockStack>
          </Card>

        </div>
      </div>

      <Modal
        open={isTrendModalOpen}
        onClose={() => setIsTrendModalOpen(false)}
        title="SEO Trend Watch"
        primaryAction={{
          content: "Ask Gemini for Trends",
          onAction: handleTrendWatchCall,
          loading: fetcher.state !== "idle" && fetcher.formData?.get("intent") === "geminiTrendWatch",
          accessibilityLabel: "Ask Gemini for SEO Trends"
        }}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text>Submit your current dropdown terminology to Gemini to discover what real buyers are searching for right now.</Text>
            
            {trendSuggestions && trendSuggestions.length > 0 && (
              <BlockStack gap="400">
                <Text variant="headingMd">Gemini Suggestions</Text>
                {trendSuggestions.map((suggestion, index) => (
                  <div key={index} style={{ padding: '16px', border: '1px solid #E1E3E5', borderRadius: '8px' }}>
                    <BlockStack gap="200">
                      <Text variant="bodyLg" fontWeight="bold">{suggestion}</Text>
                      <InlineStack gap="300" blockAlign="center">
                        <div style={{ flexGrow: 1, minHeight: '48px' }}>
                          <Select
                            label="Target Dropdown"
                            labelHidden
                            options={dropdownKeys.map(k => ({ label: k, value: k }))}
                            value={trendTargetDropdowns[index] || dropdownKeys[0]}
                            onChange={(val) => setTrendTargetDropdowns(prev => ({ ...prev, [index]: val }))}
                            accessibilityLabel={`Select target dropdown for ${suggestion}`}
                          />
                        </div>
                        <div style={{ minHeight: '48px' }}>
                          <Button 
                            onClick={() => handleAddTrend(suggestion, trendTargetDropdowns[index] || dropdownKeys[0])}
                            accessibilityLabel={`Add ${suggestion} to list`}
                          >
                            Add to List
                          </Button>
                        </div>
                      </InlineStack>
                    </BlockStack>
                  </div>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        </Modal.Section>
      </Modal>

    </BlockStack>
  );
}

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products, snapshots = [], dbProfiles = [], metaobjectHandles = {}, dynamicMetaobjectOptions = {}, metafieldDefinitions = [], pageInfo } = useLoaderData();
  const navigate = useNavigate();

  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'northstar', content: '⭐ Command Center', panelID: 'panel-northstar' },
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'DB Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
  ];

  return (
    <Frame>
      <Page
        fullWidth
        title="Meta Injector v2"
        subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {actionFetcher.data && actionFetcher.data.errors && actionFetcher.data.errors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionFetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="600">
                  {selectedTab === 0 && (
                    <InjectorUI
                      fetcher={actionFetcher}
                      products={products}
                      shopify={shopify}
                      pageInfo={pageInfo}
                      metafieldDefinitions={metafieldDefinitions}
                    />
                  )}
                  {selectedTab === 1 && (
                    <MatrixTab
                      fetcher={actionFetcher}
                      products={products}
                      metaobjectHandles={metaobjectHandles}
                      onInspectProduct={() => setSelectedTab(2)}
                    />
                  )}
                  {selectedTab === 2 && (
                    <InspectorTab
                      fetcher={inspectorFetcher}
                      products={products}
                    />
                  )}
                  {selectedTab === 3 && (
                    <OriginsTab
                      fetcher={originFetcher}
                    />
                  )}
                  {selectedTab === 4 && (
                    <ProfilesTab
                      fetcher={profileFetcher}
                      products={products}
                      dbProfiles={dbProfiles}
                      shopify={shopify}
                    />
                  )}
                  {selectedTab === 5 && (
                    <SnapshotsTab
                      fetcher={snapshotFetcher}
                      snapshots={snapshots}
                    />
                  )}
                  {selectedTab === 6 && (
                    <CsvTab
                      fetcher={actionFetcher}
                      products={products}
                    />
                  )}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
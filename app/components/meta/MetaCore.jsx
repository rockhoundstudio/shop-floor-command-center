import { 
  TextField, BlockStack, Card, Text, Badge, Button, Banner, 
  InlineStack, Page, Select, Box, ResourceList, ResourceItem, Thumbnail, Checkbox, Tag,
  IndexTable, useIndexResourceState, FormLayout
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { useFetcher, useSubmit } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ImageIcon } from "@shopify/polaris-icons";

import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";
import { TAXONOMY_GIDS, wrapGid } from "../../utils/taxonomyMap";
import DictationButton from "../DictationButton";

const LIST_TEXT_FIELDS = ["character_marks"];

const SEED_OPTIONS = {
  story_theme: ["River Find", "Road Trip", "Rescue", "Canyon Run", "First Cut", "Commission", "Ranch Find", "Mine Pull"],
  cut_type: ["Oval", "Teardrop", "Marquise", "Freeform", "Cabochon", "Round", "Cushion", "Trillion", "Heart", "Pear"],
  stone_shape: ["Oval", "Teardrop", "Marquise", "Freeform", "Round", "Rectangular", "Irregular", "Heart"],
  surface_finish: ["High Polish", "Matte", "Raw", "Satin", "Semi-Polish"],
  treatment_status: ["Untreated — Natural", "Stabilized", "Dyed", "Heated", "Irradiated", "Coated"],
  primary_color: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Black", "White", "Grey", "Multicolor", "Cream", "Gold", "Silver"],
  secondary_colors: ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Black", "White", "Grey", "Multicolor", "Cream", "Gold", "Silver"],
  luster: ["Vitreous", "Waxy", "Resinous", "Silky", "Pearly", "Dull", "Adamantine", "Subvitreous"],
  diaphaneity: ["Opaque", "Translucent", "Transparent", "Sub-translucent"]
};

function formatMetafieldValue(key, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim();
  const safeKey = key.replace(/-/g, "_");
  if (TAXONOMY_GIDS[safeKey] && TAXONOMY_GIDS[safeKey][cleanValue]) {
    return { value: wrapGid(TAXONOMY_GIDS[safeKey][cleanValue]), type: "list.metaobject_reference" };
  }
  if (TAXONOMY_GIDS[safeKey]) return null;
  const isListField = LIST_TEXT_FIELDS.includes(safeKey);
  return {
    value: isListField ? JSON.stringify([String(value).trim()]) : String(value).trim(),
    type: isListField ? "list.single_line_text_field" : "single_line_text_field"
  };
}

export default function MetaCore({ mode, products = [] }) {
  const shopify = useAppBridge();
  const submit = useSubmit();

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(products);
  const [bulkStatus, setBulkStatus] = useState("");
  const [selectedFields, setSelectedFields] = useState({});

  const [selectedIds, setSelectedIds] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [search, setSearch] = useState("");
  const [vocabulary, setVocabulary] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  const saveFetcher = useFetcher();
  const vocabFetcher = useFetcher();
  const addCustomFetcher = useFetcher();

  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));
  const selectedProduct = selectedIds.length === 1 ? products.find(p => p.id === selectedIds[0]) : null;

  const isSaving = saveFetcher.state !== "idle";
  const saveSuccess = saveFetcher.state === "idle" && saveFetcher.data?.ok === true;
  const saveError = saveFetcher.state === "idle" && saveFetcher.data?.error;

  useEffect(() => {
    vocabFetcher.submit(
      { intent: "loadVocabulary" },
      { method: "post", action: "/app/meta-injector" }
    );
  }, []);

  useEffect(() => {
    if (vocabFetcher.data?.vocabulary) {
      setVocabulary(vocabFetcher.data.vocabulary);
    }
  }, [vocabFetcher.data]);

  const handleFieldToggle = (key, checked) => {
    setSelectedFields(prev => ({ ...prev, [key]: checked }));
  };

  const handleBulkSave = (e) => {
    e.preventDefault();
    if (selectedResources.length === 0) return alert("Select at least one product.");
    const fd = new FormData(e.target);
    const updates = {};
    TARGET_KEYS.forEach(k => {
      if (selectedFields[k]) {
        const val = fd.get(`mf_${k}`);
        if (val && val.trim() !== "") updates[k] = val.trim();
      }
    });
    const submitData = new FormData();
    submitData.append("intent", "bulk_edit_new");
    submitData.append("ids", JSON.stringify(selectedResources));
    submitData.append("updates", JSON.stringify(updates));
    submitData.append("ooakText", fd.get("ooakText") || "");
    submitData.append("bulkStatus", bulkStatus);
    submit(submitData, { method: "post" });
  };

  function handleSave() {
    if (selectedIds.length === 0) {
      shopify.toast.show("Please select at least one product to update.");
      return;
    }
    const hasAnyValue = TARGET_KEYS.some(key => fieldValues[key] && String(fieldValues[key]).trim() !== "");
    if (!hasAnyValue) {
      shopify.toast.show("Fill in at least one field before saving.");
      return;
    }
    const updates = {};
    TARGET_KEYS.forEach(key => {
      const val = fieldValues[key];
      if (val && String(val).trim() !== "") updates[key] = String(val).trim();
    });
    const currentStories = {};
    selectedIds.forEach(id => {
      const p = products.find(pr => pr.id === id);
      if (p?.metafields?.stone_story) currentStories[id] = p.metafields.stone_story;
    });
    saveFetcher.submit(
      { intent: "bulk_edit_new", ids: JSON.stringify(selectedIds), updates: JSON.stringify(updates), ooakText: "", currentStories: JSON.stringify(currentStories) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  // ==========================================
  // BULK EDIT MODE
  // ==========================================
  if (mode === "bulk") {
    const rowMarkup = products.map(({ id, title, status, image }, index) => {
      const normalizedStatus = String(status || "").replace(/[^a-zA-Z\s]/g, "").trim().toLowerCase();
      const badgeTone = normalizedStatus.includes("complete") ? "success" : normalizedStatus.includes("partial") ? "warning" : "critical";

      return (
        <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
          <IndexTable.Cell>
            <Thumbnail source={image || ImageIcon} alt={title} size="small" />
          </IndexTable.Cell>
          <IndexTable.Cell><Text fontWeight="bold">{title}</Text></IndexTable.Cell>
          <IndexTable.Cell>
            <Box display={{xs: 'none', sm: 'block'}}>
              <Badge tone={badgeTone}>{status || "Unknown"}</Badge>
            </Box>
          </IndexTable.Cell>
        </IndexTable.Row>
      );
    });

    return (
      <form onSubmit={handleBulkSave}>
        <BlockStack gap="400">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Apply Data Fields</Text>
              <Text tone="subdued">Check the fields you want to override and apply to all selected stones.</Text>
              <div style={{ maxHeight: "30vh", overflowY: "auto", padding: "10px" }}>
                <FormLayout>
                  <Select
                    label="Set Product Status"
                    name="bulkStatus"
                    options={[
                      {label: 'No change', value: ''},
                      {label: 'ACTIVE', value: 'ACTIVE'},
                      {label: 'DRAFT', value: 'DRAFT'},
                      {label: 'ARCHIVED', value: 'ARCHIVED'},
                    ]}
                    value={bulkStatus}
                    onChange={setBulkStatus}
                  />
                  <TextField label="OOAK Features (Appended to Story)" name="ooakText" autoComplete="off"/>
                  <Box paddingBlockStart="200">
                    <Text variant="headingSm">Metafield Overrides</Text>
                  </Box>
                  {TARGET_KEYS.map(key => (
                    <BlockStack key={key} gap="200">
                      <Checkbox
                        label={FIELD_LABELS[key] || key.replace(/_/g, " ").toUpperCase()}
                        checked={selectedFields[key] || false}
                        onChange={(newChecked) => handleFieldToggle(key, newChecked)}
                      />
                      {selectedFields[key] && (
                        <TextField
                          labelHidden
                          label={key}
                          name={`mf_${key}`}
                          autoComplete="off"
                          placeholder={`Enter new ${key.replace(/_/g, " ")}`}
                        />
                      )}
                    </BlockStack>
                  ))}
                </FormLayout>
              </div>
              <Button submit variant="primary" disabled={selectedResources.length === 0}>
                Apply Updates
              </Button>
            </BlockStack>
          </Card>

          <Card padding="0">
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              <IndexTable
                resourceName={{ singular: 'product', plural: 'products' }}
                itemCount={products.length}
                selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: '' },
                  { title: 'Title' },
                  { title: <Box display={{xs: 'none', sm: 'block'}}>Completeness</Box> }
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </div>
          </Card>
        </BlockStack>
      </form>
    );
  }

  // ==========================================
  // STANDARD / INJECT MODE
  // ==========================================
  return (
    <Page title="Bulk Inject Lapidary Data">
      <BlockStack gap="600">
        {saveSuccess && (
          <Banner tone="success">
            Bulk update saved to Shopify across {selectedIds.length} stone{selectedIds.length !== 1 ? "s" : ""}.
          </Banner>
        )}
        {saveError && (
          <Banner tone="critical">Bulk save failed: {saveError}</Banner>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column" }}>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Select Stones ({selectedIds.length} selected)</Text>
              <TextField
                value={search} onChange={setSearch} autoComplete="off" placeholder="Search title..."
                clearButton onClearButtonClick={() => setSearch("")} prefix="🔍"
              />
              <Card padding="0" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <Box padding="300" borderBlockEndWidth="025" borderColor="border">
                  <Checkbox
                    label="Select all visible"
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onChange={(checked) => {
                      if (checked) setSelectedIds(filtered.map(p => p.id));
                      else setSelectedIds([]);
                    }}
                  />
                </Box>
                <div style={{ overflowY: "auto", flex: 1 }}>
                  <ResourceList
                    items={filtered}
                    renderItem={(p) => {
                      const isSelected = selectedIds.includes(p.id);
                      return (
                        <ResourceItem
                          id={p.id}
                          onClick={() => {
                            setSelectedIds(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                          }}
                          media={<Thumbnail source={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} alt={p.title} size="small" />}
                        >
                          <InlineStack wrap={false} align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                              <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                                {p.status}
                              </Badge>
                            </BlockStack>
                            <Checkbox checked={isSelected} onChange={() => {}} />
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                </div>
              </Card>
            </BlockStack>
          </div>

          <div style={{ flex: "1 1 400px", maxWidth: "680px", width: "100%", minWidth: 0 }}>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Apply Data Fields</Text>
                <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={selectedIds.length === 0}>
                  Save to Shopify
                </Button>
              </InlineStack>
              <Card roundedAbove="sm">
                <BlockStack gap="600">
                  <Banner tone="info">
                    Any field you leave blank will be ignored. Only filled fields will overwrite existing data on the selected stones.
                  </Banner>
                  <BlockStack gap="400">
                    {TARGET_KEYS.map(key => {
                      const savedValue = selectedProduct?.metafields?.[key.replace(/-/g, "_")];
                      const placeholderText = savedValue ? `Current: ${String(savedValue).replace(/[✅⚠️]/g, "").trim()}` : "";

                      if (key === "stone_story") {
                        return (
                          <BlockStack gap="200" key={key}>
                            <TextField
                              label={FIELD_LABELS[key] || key}
                              value={fieldValues[key] || ""}
                              onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                              autoComplete="off"
                              placeholder={placeholderText}
                              multiline={4}
                            />
                            <InlineStack align="start">
                              <DictationButton
                                placeholder="🎤 Dictate Bulk Story"
                                onResult={(text) => {
                                  setFieldValues(prev => ({
                                    ...prev,
                                    [key]: prev[key] ? prev[key] + " " + text : text
                                  }));
                                }}
                              />
                            </InlineStack>
                          </BlockStack>
                        );
                      }

                      if (SEED_OPTIONS[key]) {
                        const opts = [...new Set([...(SEED_OPTIONS[key] || []), ...(vocabulary[key] || [])])];
                        const isMulti = key === "secondary_colors";
                        const currentVal = fieldValues[key] || "";
                        const selectOptions = [{ label: placeholderText || "— select —", value: "" }];
                        opts.forEach(o => selectOptions.push({ label: o, value: o }));
                        if (!isMulti && currentVal && currentVal !== "__custom__" && !opts.includes(currentVal)) {
                          selectOptions.push({ label: currentVal, value: currentVal });
                        }
                        selectOptions.push({ label: "➕ Add Custom...", value: "__custom__" });
                        const selectValue = showCustomInput[key] ? "__custom__" : (isMulti ? "" : currentVal);

                        return (
                          <BlockStack gap="200" key={key}>
                            {isMulti && currentVal && (
                              <InlineStack gap="200" wrap>
                                {currentVal.split(",").map(c => c.trim()).filter(Boolean).map(color => (
                                  <Tag key={color} onRemove={() => {
                                    const newColors = currentVal.split(",").map(s => s.trim()).filter(Boolean).filter(c => c !== color);
                                    setFieldValues(prev => ({ ...prev, [key]: newColors.join(", ") }));
                                  }}>{color}</Tag>
                                ))}
                              </InlineStack>
                            )}
                            <Select
                              label={FIELD_LABELS[key] || key}
                              options={selectOptions}
                              value={selectValue}
                              onChange={(v) => {
                                if (v === "__custom__") {
                                  setShowCustomInput(prev => ({ ...prev, [key]: true }));
                                } else {
                                  setShowCustomInput(prev => ({ ...prev, [key]: false }));
                                  if (isMulti) {
                                    if (!v) return;
                                    const curr = currentVal ? currentVal.split(",").map(s => s.trim()).filter(Boolean) : [];
                                    if (!curr.includes(v)) curr.push(v);
                                    setFieldValues(prev => ({ ...prev, [key]: curr.join(", ") }));
                                  } else {
                                    setFieldValues(prev => ({ ...prev, [key]: v }));
                                  }
                                }
                              }}
                            />
                            {showCustomInput[key] && (
                              <div style={{ paddingLeft: "8px", borderLeft: "2px solid #e1e3e5", marginTop: "4px" }}>
                                <BlockStack gap="300">
                                  <TextField
                                    label="New custom value" placeholder="Enter new custom option..."
                                    value={customInputs[key] || ""} onChange={v => setCustomInputs(p => ({ ...p, [key]: v }))} autoComplete="off"
                                  />
                                  <InlineStack gap="300" blockAlign="center" wrap={false}>
                                    <Button variant="primary" onClick={() => {
                                      const v = customInputs[key]?.trim();
                                      if (v) {
                                        addCustomFetcher.submit({ intent: "saveVocabularyEntry", field_key: key, new_value: v }, { method: "post", action: "/app/meta-injector" });
                                        setVocabulary(prev => {
                                          const curr = prev[key] || [];
                                          if (!curr.includes(v)) return { ...prev, [key]: [...curr, v] };
                                          return prev;
                                        });
                                        if (isMulti) {
                                          const currVals = currentVal ? currentVal.split(",").map(s => s.trim()).filter(Boolean) : [];
                                          if (!currVals.includes(v)) currVals.push(v);
                                          setFieldValues(prev => ({ ...prev, [key]: currVals.join(", ") }));
                                        } else {
                                          setFieldValues(prev => ({ ...prev, [key]: v }));
                                        }
                                        setShowCustomInput(p => ({ ...p, [key]: false }));
                                        setCustomInputs(p => ({ ...p, [key]: "" }));
                                      }
                                    }}>Save & Select</Button>
                                    <Button onClick={() => setShowCustomInput(p => ({ ...p, [key]: false }))}>Cancel</Button>
                                  </InlineStack>
                                </BlockStack>
                              </div>
                            )}
                          </BlockStack>
                        );
                      } else {
                        return (
                          <BlockStack gap="200" key={key}>
                            <TextField
                              label={FIELD_LABELS[key] || key}
                              value={fieldValues[key] || ""}
                              onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                              autoComplete="off"
                              placeholder={placeholderText}
                              multiline={["bench_notes", "character_marks", "rock_composition"].includes(key) ? 4 : undefined}
                            />
                          </BlockStack>
                        );
                      }
                    })}
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </div>
      </BlockStack>
    </Page>
  );
}
import { 
  TextField, BlockStack, Card, Text, Badge, Button, Banner, 
  InlineStack, Page, Select, Box, ResourceList, ResourceItem, Thumbnail, Checkbox, Tag, Divider
} from "@shopify/polaris";
import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { TARGET_KEYS, FIELD_LABELS, MANUAL_KEYS } from "../../utils/metaScan";
import { TAXONOMY_GIDS, wrapGid } from "../../utils/taxonomyMap";

const LIST_TEXT_FIELDS = [
  "character_marks"
];

const availableStones = [
  "Agate", "Amethyst", "Aventurine", "Azurite", "Bloodstone", "Carnelian",
  "Chalcedony", "Chrysocolla", "Conglomerate", "Fluorite", "Garnet",
  "Gneiss", "Hematite", "Howlite", "Jade", "Jasper", "Labradorite",
  "Lapis Lazuli", "Malachite", "Moonstone", "Obsidian", "Onyx", "Opal",
  "Pyrite", "Quartz", "Rhodochrosite", "Rhodonite", "Rose Quartz",
  "Serpentine", "Siltstone", "Smoky Quartz", "Sodalite", "Sunstone",
  "Tiger's Eye", "Tourmaline", "Turquoise", "Variscite"
];

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
    return {
      value: wrapGid(TAXONOMY_GIDS[safeKey][cleanValue]),
      type: "list.metaobject_reference"
    };
  }
  if (TAXONOMY_GIDS[safeKey]) {
    return null;
  }
  const isListField = LIST_TEXT_FIELDS.includes(safeKey);
  return {
    value: isListField ? JSON.stringify([String(value).trim()]) : String(value).trim(),
    type: isListField ? "list.single_line_text_field" : "single_line_text_field"
  };
}

export default function MetaCore({ products = [] }) {
  const shopify = useAppBridge();

  const [selectedIds, setSelectedIds] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [customName, setCustomName] = useState("");
  const [search, setSearch] = useState("");
  
  const [vocabulary, setVocabulary] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  const saveFetcher = useFetcher();
  const vocabFetcher = useFetcher();
  const addCustomFetcher = useFetcher();

  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (vocabFetcher.state === "idle" && !vocabFetcher.data) {
      vocabFetcher.submit({ intent: "loadVocabulary" }, { method: "post", action: "/app/meta-injector" });
    }
  }, [vocabFetcher]);

  useEffect(() => {
    if (vocabFetcher.data?.vocabulary) {
      setVocabulary(vocabFetcher.data.vocabulary);
    }
  }, [vocabFetcher.data]);

  function handleSave() {
    if (selectedIds.length === 0) {
      shopify.toast.show("Please select at least one product to update.");
      return;
    }

    const metafields = TARGET_KEYS
      .filter(key => fieldValues[key] && String(fieldValues[key]).trim() !== "")
      .map(key => {
        const safeKey = key.replace(/-/g, "_");
        const rawValue = key === "official_name" && fieldValues[key] === "__custom__"
          ? customName
          : fieldValues[key] || "";
        const formatted = formatMetafieldValue(safeKey, rawValue);
        if (!formatted) return null;
        return {
          namespace: TAXONOMY_GIDS[safeKey] ? "shopify" : "custom",
          key:       TAXONOMY_GIDS[safeKey] ? key.replace(/_/g, "-") : key,
          value:     formatted.value,
          type:      formatted.type,
        };
      }).filter(Boolean);

    saveFetcher.submit(
      { 
        intent: "bulkSaveMetafields", 
        productIds: JSON.stringify(selectedIds),
        metafields: JSON.stringify(metafields) 
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  const isSaving = saveFetcher.state !== "idle";
  const saveSuccess = saveFetcher.state === "idle" && saveFetcher.data?.success;
  const saveError = saveFetcher.state === "idle" && saveFetcher.data?.error;

  return (
    <Page title="Bulk Inject Lapidary Data">
      <BlockStack gap="600">
        
        {saveSuccess && <Banner tone="success">Bulk update completed successfully across {saveFetcher.data.updatedCount} stones.</Banner>}
        {saveError && <Banner tone="critical">Bulk save failed: {saveFetcher.data?.error}</Banner>}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "flex-start" }}>
          
          {/* Left Panel: Product Selection */}
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Select Stones ({selectedIds.length} selected)</Text>
              
              <TextField
                value={search} onChange={setSearch} autoComplete="off" placeholder="Search title..."
                clearButton onClearButtonClick={() => setSearch("")} prefix="🔍"
              />

              <Card padding="0">
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
                <div style={{ maxHeight: "600px", overflowY: "auto" }}>
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
                              <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>{p.status}</Badge>
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

          {/* Right Panel: Fields List */}
          <div style={{ flex: "1 1 400px", maxWidth: "680px", width: "100%", minWidth: 0 }}>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Apply Data Fields</Text>
                <Button variant="primary" onClick={handleSave} loading={isSaving} disabled={selectedIds.length === 0}>
                  Inject Selected
                </Button>
              </InlineStack>

              <Card roundedAbove="sm">
                <BlockStack gap="600">
                  <Banner tone="info">
                    Any field you leave blank will be ignored. Only filled fields will overwrite existing data on the selected products.
                  </Banner>

                  <Box paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
                    <BlockStack gap="400">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="bold">Official Name</Text>
                        <select
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #c9cccf", fontSize: "14px" }}
                          value={fieldValues["official_name"] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, official_name: e.target.value })}
                        >
                          <option value="">-- Do Not Change --</option>
                          {availableStones.map(stone => (
                            <option key={stone} value={stone}>{stone}</option>
                          ))}
                          <option value="__custom__">➕ Add New Stone...</option>
                        </select>
                      </BlockStack>

                      {fieldValues["official_name"] === "__custom__" && (
                        <TextField
                          label="Type new stone name"
                          value={customName}
                          onChange={setCustomName}
                          autoComplete="off"
                          placeholder="e.g. Rhodochrosite"
                        />
                      )}
                    </BlockStack>
                  </Box>

                  <BlockStack gap="400">
                    {MANUAL_KEYS.filter(key => key !== "official_name").map(key => {
                      if (SEED_OPTIONS[key]) {
                        const opts = [...new Set([...(SEED_OPTIONS[key] || []), ...(vocabulary[key] || [])])];
                        const isMulti = key === "secondary_colors";
                        const currentVal = fieldValues[key] || "";

                        const selectOptions = isMulti 
                          ? [{label: "-- Do Not Change --", value: ""}]
                          : [{label: "-- Do Not Change --", value: ""}];

                        opts.forEach(o => selectOptions.push({label: o, value: o}));

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
                                     setFieldValues(prev => ({...prev, [key]: newColors.join(", ")}));
                                   }}>
                                     {color}
                                   </Tag>
                                 ))}
                               </InlineStack>
                             )}

                             <Select
                               label={FIELD_LABELS[key] || key}
                               options={selectOptions}
                               value={selectValue}
                               onChange={(v) => {
                                 if (v === "__custom__") {
                                   setShowCustomInput(prev => ({...prev, [key]: true}));
                                 } else {
                                   setShowCustomInput(prev => ({...prev, [key]: false}));
                                   if (isMulti) {
                                     if (!v) return;
                                     const curr = currentVal ? currentVal.split(",").map(s => s.trim()).filter(Boolean) : [];
                                     if (!curr.includes(v)) curr.push(v);
                                     setFieldValues(prev => ({...prev, [key]: curr.join(", ")}));
                                   } else {
                                     setFieldValues(prev => ({...prev, [key]: v}));
                                   }
                                 }
                               }}
                             />

                             {showCustomInput[key] && (
                               <div style={{ paddingLeft: "8px", borderLeft: "2px solid #e1e3e5", marginTop: "4px" }}>
                                 <BlockStack gap="300">
                                   <TextField
                                     label="New custom value"
                                     placeholder="Enter new custom option..."
                                     value={customInputs[key] || ""}
                                     onChange={v => setCustomInputs(p => ({...p, [key]: v}))}
                                     autoComplete="off"
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
                                             setFieldValues(prev => ({...prev, [key]: currVals.join(", ")}));
                                           } else {
                                             setFieldValues(prev => ({...prev, [key]: v}));
                                           }
                                           setShowCustomInput(p => ({...p, [key]: false}));
                                           setCustomInputs(p => ({...p, [key]: ""}));
                                        }
                                     }}>
                                       Save & Select
                                     </Button>
                                     <Button onClick={() => setShowCustomInput(p => ({...p, [key]: false}))}>Cancel</Button>
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
                              placeholder="-- Do Not Change --"
                              multiline={["stone_story", "bench_notes", "character_marks", "rock_composition"].includes(key) ? 3 : undefined}
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
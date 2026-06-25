import { 
  TextField, BlockStack, Card, Text, Badge, Grid, Button, Banner, 
  InlineStack, Page, Select, Box, ButtonGroup, 
  ResourceList, ResourceItem, Thumbnail, Divider, Tag
} from "@shopify/polaris";
import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";

// --- LOCAL IMPORTS ---
import { TARGET_KEYS, FIELD_LABELS, MANUAL_KEYS } from "../../utils/metaScan";
import { TAXONOMY_GIDS, wrapGid } from "../../utils/taxonomyMap";
import DictationButton from "../DictationButton"; // The new Voice Module

// --- CONSTANTS & CONFIG ---
const LIST_TEXT_FIELDS = ["character_marks"];

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

// --- HELPER FUNCTIONS ---
function toShopifyStatus(val) {
  const map = {
    "ACTIVE": "ACTIVE", "DRAFT": "DRAFT", "ARCHIVED": "ARCHIVED", "UNLISTED": "UNLISTED",
    "✅ Complete": "ACTIVE", "🟡 Partial": "DRAFT", "⬜ Empty": "DRAFT",
    "🔴 Empty": "DRAFT", "Active (Live)": "ACTIVE", "Draft (Hidden)": "DRAFT"
  };
  return map[val] ?? "DRAFT";
}

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

// ==========================================
// MAIN COMPONENT: ProductsTab
// ==========================================
export default function ProductsTab({ products = [] }) {
  const shopify = useAppBridge();

  // --- STATE ---
  const [viewMode, setViewMode] = useState("list");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  
  // Editor State
  const [fieldValues, setFieldValues] = useState({});
  const [customName, setCustomName] = useState("");
  const [baseFields, setBaseFields] = useState({ title: "", description: "", status: "DRAFT", price: "0.00", inventory: "1" });
  
  // Bulk & Custom Logic State
  const [bulkSaveStatus, setBulkSaveStatus] = useState(null);
  const [bulkSaveCount, setBulkSaveCount] = useState(0);
  const [vocabulary, setVocabulary] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  // --- REFS ---
  const mergedApplied = useRef(false);

  // --- FETCHERS ---
  const saveFetcher      = useFetcher();
  const baseFetcher      = useFetcher();
  const autoFetcher      = useFetcher();
  const bulkFetcher      = useFetcher();
  const bulkSaveFetcher  = useFetcher();
  const vocabFetcher     = useFetcher();
  const addCustomFetcher = useFetcher();

  // --- DERIVED DATA ---
  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  const isSaving     = saveFetcher.state !== "idle" || baseFetcher.state !== "idle";
  const isAutoFill   = autoFetcher.state !== "idle";
  const isBulk       = bulkFetcher.state !== "idle";
  const isBulkSaving = bulkSaveFetcher.state !== "idle";
  const saveSuccess  = saveFetcher.state === "idle" && saveFetcher.data?.success && baseFetcher.state === "idle" && !baseFetcher.data?.error;
  const saveError    = (saveFetcher.state === "idle" && saveFetcher.data?.error) || (baseFetcher.state === "idle" && baseFetcher.data?.error);
  
  const conflicts    = autoFetcher.data?.conflicts || [];
  const mindatError  = autoFetcher.data?.mindatError;
  const bulkDone     = bulkFetcher.state === "idle" && bulkFetcher.data?.ok;
  const bulkFailed   = bulkFetcher.data?.failed || [];
  const bulkTotal    = bulkFetcher.data?.total || 0;

  // --- EFFECTS ---
  useEffect(() => {
    if (selected && vocabFetcher.state === "idle" && !vocabFetcher.data) {
      vocabFetcher.submit({ intent: "loadVocabulary" }, { method: "post", action: "/app/meta-injector" });
    }
  }, [selected, vocabFetcher]);

  useEffect(() => {
    if (vocabFetcher.data?.vocabulary) setVocabulary(vocabFetcher.data.vocabulary);
  }, [vocabFetcher.data]);

  if (autoFetcher.state === "idle" && autoFetcher.data?.merged && !mergedApplied.current) {
    const merged = autoFetcher.data.merged;
    const hasNew = Object.keys(merged).some(k => merged[k] !== fieldValues[k]);
    if (hasNew) {
      mergedApplied.current = true;
      setFieldValues(prev => ({ ...prev, ...merged }));
    }
  }

  // --- ACTION HANDLERS ---
  function openEditor(product) {
    const initial = {};
    TARGET_KEYS.forEach(key => { initial[key] = product.metafields?.[key] || ""; });
    
    const existingName = initial.official_name || product.title || "";
    if (existingName && !availableStones.includes(existingName)) {
      initial.official_name = "__custom__";
      setCustomName(existingName);
    } else {
      initial.official_name = existingName;
    }
    
    if (!initial.stone_story) initial.stone_story = product.description || "";
    
    setBaseFields({
      title: product.title || "",
      description: product.description || "",
      status: toShopifyStatus(product.shopifyStatus || product.status),
      price: product.price || "0.00",
      inventory: "1"
    });
    
    setFieldValues(initial);
    setShowCustomInput({});
    setCustomInputs({});
    setSelected(product);
    mergedApplied.current = false;
  }

  function handleSave() {
    const metafields = TARGET_KEYS
      .filter(key => fieldValues[key] && String(fieldValues[key]).trim() !== "")
      .map(key => {
        const safeKey = key.replace(/-/g, "_");
        const rawValue = key === "official_name" && fieldValues[key] === "__custom__" ? customName : fieldValues[key] || "";
        const formatted = formatMetafieldValue(safeKey, rawValue);
        if (!formatted) return null;
        return {
          ownerId: selected.id,
          namespace: TAXONOMY_GIDS[safeKey] ? "shopify" : "custom",
          key: TAXONOMY_GIDS[safeKey] ? key.replace(/_/g, "-") : key,
          value: formatted.value,
          type: formatted.type,
        };
      }).filter(Boolean);

    saveFetcher.submit(
      { intent: "saveMetafields", metafields: JSON.stringify(metafields) },
      { method: "post", action: "/app/meta-injector" }
    );

    baseFetcher.submit(
      {
        intent: "saveProductBase",
        productId: selected.id,
        title: baseFields.title,
        status: toShopifyStatus(baseFields.status),
        price: baseFields.price,
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleAutoFill() {
    mergedApplied.current = false;
    const finalName = fieldValues.official_name === "__custom__" ? customName : fieldValues.official_name;
    autoFetcher.submit(
      { intent: "autoFill", title: baseFields.title, description: baseFields.description || "", existingMeta: JSON.stringify({ ...fieldValues, official_name: finalName }) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleBulkFill() {
    setBulkSaveStatus(null);
    setBulkSaveCount(0);
    const payload = products.map(p => ({ id: p.id, title: p.title, description: p.description || "", metafields: p.metafields || {} }));
    bulkFetcher.submit(
      { intent: "bulkAutoFill", products: JSON.stringify(payload) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleBulkSave() {
    const results = bulkFetcher.data?.results || [];
    if (!results.length) return;
    setBulkSaveStatus("saving");
    
    const allMetafields = [];
    results.forEach(({ id, merged }) => {
      if (!merged) return;
      TARGET_KEYS.forEach(key => {
        const val = merged[key];
        if (!val || String(val).trim() === "") return;
        const safeKey = key.replace(/-/g, "_");
        const formatted = formatMetafieldValue(safeKey, val);
        if (!formatted) return;
        allMetafields.push({
          ownerId: id,
          namespace: TAXONOMY_GIDS[safeKey] ? "shopify" : "custom",
          key: TAXONOMY_GIDS[safeKey] ? key.replace(/_/g, "-") : key,
          value: formatted.value,
          type: formatted.type,
        });
      });
    });
    
    setBulkSaveCount(results.length);
    bulkSaveFetcher.submit(
      { intent: "saveMetafields", metafields: JSON.stringify(allMetafields) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  // ==========================================
  // RENDER: INDIVIDUAL STONE EDITOR
  // ==========================================
  if (selected) {
    return (
      <Page
        backAction={{ content: "Back", onAction: () => setSelected(null) }}
        title={baseFields.title || "Edit Stone"}
        primaryAction={{ content: "Save Stone", onAction: handleSave, loading: isSaving, disabled: isAutoFill }}
        secondaryActions={[{ content: "🔍 Auto-Fill", onAction: handleAutoFill, loading: isAutoFill, disabled: isSaving }]}
      >
        <div style={{ maxWidth: "680px", width: "100%", margin: "0 auto", padding: "0 0 80px 0" }}>
          <BlockStack gap="500">

            {saveSuccess && <Banner tone="success">Saved successfully to Shopify.</Banner>}
            {saveError   && <Banner tone="critical">Save failed: {saveFetcher.data?.error || baseFetcher.data?.error}</Banner>}
            {mindatError === "missing_name" && <Banner tone="warning">Mindat skipped: Please select an Official Name first.</Banner>}
            {mindatError && mindatError !== "missing_name" && <Banner tone="critical">Mindat API Error: {mindatError}. Filled from local geo library only.</Banner>}
            {conflicts.length > 0 && (
              <Banner tone="warning">
                {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} — Mindat data prioritized.{" "}
                {conflicts.map(c => `${FIELD_LABELS[c.key] || c.key}: library="${c.library}" vs mindat="${c.mindat}"`).join(" | ")}
              </Banner>
            )}

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <TextField label="Product Title" value={baseFields.title} onChange={val => setBaseFields(p => ({...p, title: val}))} autoComplete="off" />
                <TextField label="Public Description" value={baseFields.description} onChange={val => setBaseFields(p => ({...p, description: val}))} multiline={4} autoComplete="off" />
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <Select
                  label="Store Status"
                  options={[{label: "Active (Live)", value: "ACTIVE"}, {label: "Draft (Hidden)", value: "DRAFT"}]}
                  value={baseFields.status}
                  onChange={val => setBaseFields(p => ({...p, status: val}))}
                />
                <TextField
                  label="Price" type="number" prefix="$" autoComplete="off"
                  value={baseFields.price} onChange={val => setBaseFields(p => ({...p, price: val}))}
                />
                <TextField
                  label="Available Inventory" type="number" autoComplete="off"
                  value={baseFields.inventory} onChange={val => setBaseFields(p => ({...p, inventory: val}))}
                />
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">Media & Pictures</Text>
                  <Button size="micro">Add Media</Button>
                </InlineStack>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
                  <div style={{ width: "100px", height: "100px", background: "#fff", borderRadius: "8px", overflow: "hidden", border: "1px solid #e1e3e5", flexShrink: 0 }}>
                    <img src={selected.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Hero" />
                  </div>
                  <div style={{ width: "70px", height: "70px", backgroundColor: "#f4f6f8", borderRadius: "8px", flexShrink: 0 }} />
                  <div style={{ width: "70px", height: "70px", border: "1px dashed #8c9196", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                    <Text tone="subdued">+</Text>
                  </div>
                </div>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="400">
                <Text as="h2" variant="headingSm">Lapidary Data (Meta Injector)</Text>

                <BlockStack gap="200">
                  <Text variant="bodyMd" fontWeight="bold">Official Name (Required for Mindat)</Text>
                  <select
                    style={{ width: "100%", padding: "10px", borderRadius: "4px", border: "1px solid #c9cccf", fontSize: "16px" }}
                    value={fieldValues["official_name"] || ""}
                    onChange={(e) => setFieldValues({ ...fieldValues, official_name: e.target.value })}
                  >
                    <option value="">-- Select Valid Mindat Stone --</option>
                    {availableStones.map(stone => <option key={stone} value={stone}>{stone}</option>)}
                    <option value="__custom__">➕ Add New Stone...</option>
                  </select>
                </BlockStack>

                {fieldValues["official_name"] === "__custom__" && (
                  <TextField label="Type new stone name" value={customName} onChange={setCustomName} autoComplete="off" placeholder="e.g. Rhodochrosite" />
                )}

                <BlockStack gap="200">
                  <TextField
                    label="Dimensions (mm)" value={fieldValues.dimensions_mm || ""}
                    onChange={val => setFieldValues(prev => ({ ...prev, dimensions_mm: val }))}
                    autoComplete="off" placeholder="e.g. 22mm x 15mm x 6mm"
                  />
                </BlockStack>

                <BlockStack gap="400">
                  {MANUAL_KEYS.filter(key => key !== "official_name" && key !== "dimensions_mm").map(key => {
                    
                    // --- THE CHROME: VOICE MODULE FOR STONE STORY ---
                    if (key === "stone_story") {
                      return (
                        <BlockStack gap="200" key={key}>
                          <TextField
                            label={FIELD_LABELS[key] || key}
                            value={fieldValues[key] || ""}
                            onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                            autoComplete="off"
                            multiline={4}
                          />
                          <InlineStack align="start">
                            <DictationButton 
                              placeholder="🎤 Dictate Story" 
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

                    // --- DROPDOWN/MULTI-SELECT FIELDS ---
                    if (SEED_OPTIONS[key]) {
                      const opts = [...new Set([...(SEED_OPTIONS[key] || []), ...(vocabulary[key] || [])])];
                      const isMulti = key === "secondary_colors";
                      const currentVal = fieldValues[key] || "";
                      const selectOptions = isMulti ? [{label: "-- Add Color --", value: ""}] : [{label: "-- Select --", value: ""}];
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
                                  label="New custom value" placeholder="Enter new custom option..." autoComplete="off"
                                  value={customInputs[key] || ""} onChange={v => setCustomInputs(p => ({...p, [key]: v}))}
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
                                  }}>Save & Select</Button>
                                  <Button onClick={() => setShowCustomInput(p => ({...p, [key]: false}))}>Cancel</Button>
                                </InlineStack>
                              </BlockStack>
                            </div>
                          )}
                        </BlockStack>
                      );
                    } else {
                      
                      // --- STANDARD TEXT FIELDS ---
                      return (
                        <BlockStack gap="200" key={key}>
                          <TextField
                            label={FIELD_LABELS[key] || key}
                            value={fieldValues[key] || ""}
                            onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                            autoComplete="off"
                            multiline={["bench_notes", "character_marks", "rock_composition"].includes(key) ? 3 : undefined}
                          />
                        </BlockStack>
                      );
                    }
                  })}
                </BlockStack>

              </BlockStack>
            </Card>

            <div style={{ position: "sticky", bottom: "16px", zIndex: 10 }}>
              <Button variant="primary" size="large" fullWidth onClick={handleSave} loading={isSaving} disabled={isAutoFill}>
                💾 Save Stone
              </Button>
            </div>

          </BlockStack>
        </div>
      </Page>
    );
  }

  // ==========================================
  // RENDER: MAIN LIST/GRID VIEW
  // ==========================================
  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingMd" as="h2">Inventory ({products.length} Stones)</Text>
        <ButtonGroup segmented>
          <Button pressed={viewMode === "list"} onClick={() => setViewMode("list")}>List</Button>
          <Button pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>Grid</Button>
        </ButtonGroup>
      </InlineStack>

      <TextField
        value={search} onChange={setSearch} autoComplete="off" placeholder="Search gemstone title..."
        clearButton onClearButtonClick={() => setSearch("")} prefix="🔍"
      />

      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text variant="headingSm" fontWeight="bold">⚡ 1. Auto-Fill All Products</Text>
            <Text variant="bodySm" tone="subdued">Uses Official Names to pull geological data from Mindat.</Text>
          </BlockStack>
          <Button variant="primary" onClick={handleBulkFill} loading={isBulk} disabled={isBulk} fullWidth>
            {isBulk ? "Filling all products…" : "Auto-Fill All"}
          </Button>

          {isBulk && <Banner tone="info">Running — this may take 1–2 minutes. Do not close the tab.</Banner>}

          {bulkDone && (
            <Banner tone={bulkFailed.length > 0 ? "warning" : "success"}>
              {bulkFailed.length === 0
                ? `All ${bulkTotal} products filled successfully.`
                : `Done — ${bulkTotal - bulkFailed.length} filled, ${bulkFailed.length} issue(s).`}
            </Banner>
          )}

          {bulkDone && bulkSaveStatus !== "done" && (
            <>
              <Divider />
              <BlockStack gap="100">
                <Text variant="headingSm" fontWeight="bold">💾 2. Save All to Shopify</Text>
                <Text variant="bodySm" tone="subdued">Writes filled data permanently to Shopify metafields.</Text>
              </BlockStack>
              <Button variant="primary" tone="success" onClick={handleBulkSave} loading={isBulkSaving} disabled={isBulkSaving} fullWidth>
                {isBulkSaving ? "Saving to Shopify…" : "Save All to Shopify"}
              </Button>
            </>
          )}

          {bulkSaveStatus === "done" && <Banner tone="success">✅ All {bulkSaveCount} products saved to Shopify successfully.</Banner>}
          {bulkSaveStatus === "error" && <Banner tone="critical">Save failed: {bulkSaveFetcher.data?.error}</Banner>}
        </BlockStack>
      </Card>

      {filtered.length === 0 && <Text tone="subdued">No products match your search.</Text>}

      {viewMode === "list" ? (
        <Card padding="0">
          <ResourceList
            items={filtered}
            renderItem={(p) => (
              <ResourceItem
                id={p.id}
                onClick={() => openEditor(p)}
                media={<Thumbnail source={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} alt={p.title} size="small" />}
              >
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                  <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                    {p.status}
                  </Badge>
                </BlockStack>
              </ResourceItem>
            )}
          />
        </Card>
      ) : (
        <Grid>
          {filtered.map((p) => (
            <Grid.Cell key={p.id} columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3 }}>
              <div onClick={() => openEditor(p)} style={{ cursor: "pointer" }}>
                <Card padding="200">
                  <BlockStack gap="200">
                    <div style={{ height: "140px", background: "#f1f1f1", borderRadius: "8px", overflow: "hidden" }}>
                      <img src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={p.title} />
                    </div>
                    <Text variant="bodySm" fontWeight="bold" truncate>{p.title}</Text>
                    <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>{p.status}</Badge>
                    <Text variant="bodyXs" tone="subdued">{p.filledCount} / {TARGET_KEYS.length} fields filled</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
          ))}
        </Grid>
      )}
    </BlockStack>
  );
}


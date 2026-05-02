import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Card, TextField, Text, BlockStack, InlineStack, Button,
  Checkbox, Scrollable, Box, Select, Banner,
  Divider, ActionList, Icon, Badge
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";
import { lookupStone } from "../../utils/geoLibrary"; 

const DROPDOWN_FIELDS = ["luster", "diaphaneity", "fracture_pattern", "cleavage", "crystal_system", "rock_formation", "mineral_class", "geological_era", "tenacity"];
const FREE_TEXT_FIELDS = ["origin_location", "rescued_by", "stone_story", "bench_notes", "dimensions_mm", "carat_weight", "cut_type", "moh_hardness", "specific_gravity"];

const SEO_DICTIONARY = {
  luster: {
    global: ["Vitreous", "Waxy", "Resinous", "Silky", "Pearly", "Dull", "Submetallic"],
    labradorite: ["Labradorescent", "Vitreous", "Pearly"],
    obsidian: ["Vitreous", "Sheen", "Chatoyant"],
  },
  diaphaneity: {
    global: ["Opaque", "Translucent", "Transparent", "Semi-Translucent"],
    agate: ["Highly Translucent", "Banded Translucent", "Semi-Translucent"],
  },
  fracture_pattern: {
    global: ["Conchoidal", "Uneven", "Splintery", "Hackly", "Granular"],
  },
  cleavage: {
    global: ["None", "Indistinct", "Perfect", "Good"],
    labradorite: ["Perfect in two directions"],
  },
  crystal_system: {
    global: ["Trigonal", "Cryptocrystalline", "Amorphous", "Monoclinic", "Triclinic", "Orthorhombic", "Hexagonal"],
  },
  rock_formation: {
    global: ["Igneous", "Sedimentary", "Metamorphic"],
  },
  mineral_class: {
    global: ["Silicates", "Oxides", "Carbonates", "Sulfates", "Phosphates"],
  },
};

const availableStones = [
  "Agate", "Amethyst", "Aventurine", "Azurite", "Bloodstone", "Carnelian",
  "Chalcedony", "Chrysocolla", "Fluorite", "Garnet", "Hematite", "Howlite",
  "Jade", "Jasper", "Labradorite", "Lapis Lazuli", "Malachite", "Moonstone",
  "Obsidian", "Onyx", "Opal", "Pyrite", "Quartz", "Rhodochrosite",
  "Rhodonite", "Rose Quartz", "Serpentine", "Smoky Quartz", "Sodalite",
  "Sunstone", "Tiger's Eye", "Tourmaline", "Turquoise"
];

export default function MetaCore({ products = [], mode }) {
  const fetcher = useFetcher();

  const [checkedIds, setCheckedIds] = useState([]);
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [customInputs, setCustomInputs] = useState({});
  const [ooakText, setOoakText] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [injectProduct, setInjectProduct] = useState("");
  const [payload, setPayload] = useState("");

  const [mindatQuery, setMindatQuery] = useState("");

  const getOptionsForField = (fieldKey) => {
    const currentStone = fieldValues["official_name"] === "__custom__" 
      ? (customInputs["official_name"] || "").toLowerCase()
      : (fieldValues["official_name"] || "").toLowerCase();
      
    let opts = SEO_DICTIONARY[fieldKey]?.global || [];
    if (currentStone && SEO_DICTIONARY[fieldKey]?.[currentStone]) {
      opts = SEO_DICTIONARY[fieldKey][currentStone];
    }
    return opts;
  };

  const autoSuggestFields = async () => {
    if (checkedIds.length === 0) return;
    setIsSuggesting(true);

    const firstStone = products.find(p => p.id === checkedIds[0]);
    if (!firstStone) { setIsSuggesting(false); return; }

    let suggestedName = fieldValues["official_name"] === "__custom__" 
      ? customInputs["official_name"] 
      : fieldValues["official_name"];

    if (!suggestedName) {
      suggestedName = firstStone.metafields?.official_name || firstStone.title;
    }

    // 🐛 FIXED: Completely abort Mindat fetch if name is still empty to prevent crash
    if (!suggestedName || suggestedName.trim() === "") {
      setIsSuggesting(false);
      return; 
    }
    
    const libraryData = lookupStone(suggestedName) || {};
    if (libraryData.official_name) suggestedName = libraryData.official_name;

    const newValues = { ...fieldValues };
    const newTicked = { ...tickedFields };
    const newCustom = { ...customInputs };

    const applySuggestion = (key, value) => {
      if (!value) return;
      const opts = getOptionsForField(key);
      
      if (opts.length === 0 || FREE_TEXT_FIELDS.includes(key)) {
         newValues[key] = value;
      } else {
         const match = opts.find(opt => opt.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(opt.toLowerCase()));
         if (match) {
           newValues[key] = match;
         } else {
           newValues[key] = "__custom__";
           newCustom[key] = value;
         }
      }
      newTicked[key] = true;
    };

    const fd = new FormData();
    fd.append("intent", "mindat_lookup");
    fd.append("query", suggestedName);
    
    try {
      const res = await fetch("?index", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok && data.found) {
          const m = data.result;
          const hardness = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
          const density = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";
          
          applySuggestion("moh_hardness", hardness);
          applySuggestion("specific_gravity", density);
          applySuggestion("crystal_system", m.crystal_system);
          applySuggestion("luster", m.lustre);
          applySuggestion("cleavage", m.cleavage);
          applySuggestion("fracture_pattern", m.fracture);
          applySuggestion("diaphaneity", m.diaphaneity);
      }
    } catch (e) {
        console.error("Mindat fetch failed");
    }

    if (fieldValues["official_name"] !== "__custom__") {
      newValues["official_name"] = suggestedName;
    }
    newTicked["official_name"] = true;
    
    if (libraryData.crystal_system) applySuggestion("crystal_system", libraryData.crystal_system);
    if (libraryData.luster) applySuggestion("luster", libraryData.luster);
    if (libraryData.diaphaneity) applySuggestion("diaphaneity", libraryData.diaphaneity);
    if (libraryData.fracture_pattern) applySuggestion("fracture_pattern", libraryData.fracture_pattern);
    if (libraryData.cleavage) applySuggestion("cleavage", libraryData.cleavage);
    if (libraryData.rock_formation) applySuggestion("rock_formation", libraryData.rock_formation);
    if (libraryData.mineral_class) applySuggestion("mineral_class", libraryData.mineral_class);

    setFieldValues(newValues);
    setCustomInputs(newCustom);
    setTickedFields(newTicked);
    setIsSuggesting(false);
  };

  const processBulkQueue = async () => {
    if (checkedIds.length === 0 || (!Object.values(tickedFields).some(Boolean) && !ooakText)) return;
    setIsProcessing(true);

    const updates = {};
    TARGET_KEYS.forEach(k => {
      if (tickedFields[k]) {
        updates[k] = fieldValues[k] === "__custom__" ? (customInputs[k] || "") : (fieldValues[k] || "");
      }
    });

    const currentStories = {};
    if (ooakText) {
      checkedIds.forEach(id => {
        const product = products.find(p => p.id === id);
        currentStories[id] = product?.metafields?.stone_story || "";
      });
    }

    const fd = new FormData();
    fd.append("intent", "bulk_edit_new");
    fd.append("ids", JSON.stringify(checkedIds));
    fd.append("updates", JSON.stringify(updates));
    fd.append("ooakText", ooakText || "");
    fd.append("currentStories", JSON.stringify(currentStories));

    try {
      await fetch("?index", { method: "POST", body: fd });
    } catch (e) {
      console.error("Save failed", e);
    }

    setIsProcessing(false);
    window.location.reload();
  };

  useEffect(() => {
    if (fetcher.data?.payload !== undefined) {
      setPayload(fetcher.data.payload);
    }
  }, [fetcher.data]);

  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()));

  // ==========================================
  // VIEW 1: BULK EDIT
  // ==========================================
  if (mode === "bulk") {
    const allChecked = checkedIds.length === filteredProducts.length && filteredProducts.length > 0;
    const indeterminate = checkedIds.length > 0 && checkedIds.length < filteredProducts.length;

    return (
      <BlockStack gap="400">
        {isProcessing && <Banner tone="info">Saving data to Shopify. This may take a moment...</Banner>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
          
          <BlockStack gap="300">
            <Card padding="0">
              <Box padding="300" borderBlockEndWidth="025" borderColor="border">
                <BlockStack gap="300">
                  <TextField
                    value={productSearch}
                    onChange={setProductSearch}
                    placeholder="Search products..."
                    prefix={<Icon source={SearchIcon} />}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setProductSearch("")}
                  />
                  <Checkbox
                    label={`Select All Visible (${filteredProducts.length})`}
                    checked={indeterminate ? "indeterminate" : allChecked}
                    onChange={(checked) => setCheckedIds(checked ? filteredProducts.map(p => p.id) : [])}
                  />
                </BlockStack>
              </Box>
              <Scrollable style={{ height: "550px" }}>
                {filteredProducts.length === 0 ? (
                  <Box padding="400"><Text tone="subdued" alignment="center">No products found.</Text></Box>
                ) : (
                  <ActionList
                    actionRole="menuitem"
                    items={filteredProducts.map(p => ({
                      content: (
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <Checkbox checked={checkedIds.includes(p.id)} onChange={() => {}} label="" />
                          <span style={{ fontSize: "13px", fontWeight: checkedIds.includes(p.id) ? "bold" : "normal" }}>
                            {p.title.length > 40 ? p.title.substring(0, 40) + "..." : p.title}
                          </span>
                        </div>
                      ),
                      onAction: () => setCheckedIds(prev =>
                        prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                      ),
                    }))}
                  />
                )}
              </Scrollable>
            </Card>
          </BlockStack>

          <BlockStack gap="300">
            <Banner tone="info">Fields are mapped to Shopify Metaobjects. Values adapt to the Official Name.</Banner>
            <Card padding="0">
              <Scrollable style={{ height: "550px" }}>
                <BlockStack gap="400" padding="400">

                  <Text variant="headingSm" tone="subdued">CORE IDENTIFICATION</Text>
                  
                  <BlockStack gap="200" style={{ background: "#e4f0f6", padding: "12px", borderRadius: "6px", border: "1px solid #005bd3" }}>
                    <Checkbox
                      label="Official Name (Required for Mindat)"
                      checked={tickedFields["official_name"] || false}
                      onChange={() => setTickedFields(prev => ({ ...prev, official_name: !prev.official_name }))}
                    />
                    {tickedFields["official_name"] && (
                      <BlockStack gap="200">
                        <select
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #c9cccf", fontSize: "14px", fontWeight: "bold" }}
                          value={fieldValues["official_name"] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, official_name: e.target.value })}
                        >
                          <option value="">-- Select Valid Mindat Stone --</option>
                          {availableStones.map(stone => (
                            <option key={stone} value={stone}>{stone}</option>
                          ))}
                          <option value="__custom__">➕ Add New Stone...</option>
                        </select>
                        
                        {fieldValues["official_name"] === "__custom__" && (
                          <TextField
                            label="Type new stone name"
                            value={customInputs["official_name"] || ""}
                            onChange={(v) => setCustomInputs({ ...customInputs, official_name: v })}
                            autoComplete="off"
                            placeholder="e.g. Rhodochrosite"
                            helpText="Mindat will attempt to look this up when you Auto-Suggest."
                          />
                        )}
                      </BlockStack>
                    )}
                  </BlockStack>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {FREE_TEXT_FIELDS.map(key => (
                      <BlockStack key={key} gap="100">
                        <Checkbox
                          label={FIELD_LABELS[key] || key}
                          checked={tickedFields[key] || false}
                          onChange={() => setTickedFields(prev => ({ ...prev, [key]: !prev[key] }))}
                        />
                        {tickedFields[key] && (
                          <TextField
                            label=""
                            value={fieldValues[key] || ""}
                            onChange={(v) => setFieldValues({ ...fieldValues, [key]: v })}
                            autoComplete="off"
                          />
                        )}
                      </BlockStack>
                    ))}
                  </div>

                  <Divider />

                  <Text variant="headingSm" tone="subdued">GEOLOGY & SEO (SMART SELECT)</Text>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {DROPDOWN_FIELDS.map(key => (
                      <BlockStack key={key} gap="100" style={{ background: "#f9fafb", padding: "8px", borderRadius: "6px" }}>
                        <Checkbox
                          label={FIELD_LABELS[key] || key}
                          checked={tickedFields[key] || false}
                          onChange={() => setTickedFields(prev => ({ ...prev, [key]: !prev[key] }))}
                        />
                        {tickedFields[key] && (
                          <BlockStack gap="200">
                            <select
                              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #c9cccf" }}
                              value={fieldValues[key] || ""}
                              onChange={(e) => setFieldValues({ ...fieldValues, [key]: e.target.value })}
                            >
                              <option value="">-- Select --</option>
                              {getOptionsForField(key).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                              <option value="__custom__">+ Add Custom...</option>
                            </select>
                            {fieldValues[key] === "__custom__" && (
                              <TextField
                                label="Enter custom term"
                                value={customInputs[key] || ""}
                                onChange={(v) => setCustomInputs({ ...customInputs, [key]: v })}
                                autoComplete="off"
                              />
                            )}
                          </BlockStack>
                        )}
                      </BlockStack>
                    ))}
                  </div>

                  <Divider />

                  <BlockStack gap="200" style={{ background: "#fff8e6", padding: "12px", borderRadius: "8px", border: "1px solid #e1b878" }}>
                    <Text variant="headingSm">✨ OOAK Special Features</Text>
                    <Text variant="bodySm" tone="subdued">Text entered here appends to the Stone Story without overwriting it.</Text>
                    <TextField
                      label=""
                      value={ooakText}
                      onChange={setOoakText}
                      multiline={3}
                      placeholder="e.g. Features a striking hematite inclusion..."
                    />
                  </BlockStack>

                </BlockStack>
              </Scrollable>
            </Card>

            <BlockStack gap="300">
              <Button onClick={autoSuggestFields} disabled={checkedIds.length === 0 || isSuggesting} icon={() => <span>🪄</span>}>
                {isSuggesting ? "Fetching from Mindat..." : "Auto-Suggest SEO Fields"}
              </Button>
              <Button variant="primary" size="large" onClick={processBulkQueue} disabled={checkedIds.length === 0 || isProcessing}>
                Apply Updates to {checkedIds.length} Stone(s)
              </Button>
            </BlockStack>
            
          </BlockStack>
        </div>
      </BlockStack>
    );
  }

  // ==========================================
  // VIEW 2: INJECT PAYLOAD (With Dashboard)
  // ==========================================
  if (mode === "inject") {
    const product = products.find((p) => p.id === injectProduct);

    return (
      <BlockStack gap="400">
        <Text variant="headingMd">Auto-build payload from product + Mindat</Text>
        <Select
          label="Select a stone to review its Metafield Health"
          options={[{ label: "-- Pick a stone --", value: "" }, ...products.map((p) => ({ label: p.title, value: p.id }))]}
          value={injectProduct}
          onChange={setInjectProduct}
        />

        {/* 🚀 NEW: METAFIELD HEALTH CHECK DASHBOARD */}
        {product && (
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingSm">Live Shopify Data</Text>
                <Badge tone={product.filledCount === TARGET_KEYS.length ? "success" : "warning"}>
                  {product.filledCount} / {TARGET_KEYS.length} Complete
                </Badge>
              </InlineStack>
              <Divider />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {TARGET_KEYS.map(key => {
                   const val = product.metafields?.[key];
                   const isEmpty = !val || String(val).trim() === "";
                   const isWarning = String(val).includes("⚠️");
                   
                   let statusTone = "critical";
                   let statusIcon = "❌";
                   let displayVal = "(empty)";

                   if (!isEmpty) {
                     if (isWarning) {
                       statusTone = "attention";
                       statusIcon = "⚠️";
                       displayVal = String(val).replace("⚠️", "").trim();
                     } else {
                       statusTone = "success";
                       statusIcon = "✅";
                       displayVal = String(val).replace("✅", "").trim();
                     }
                   }

                   return (
                     <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f4f6f8', padding: '6px 12px', borderRadius: '6px' }}>
                       <Text variant="bodySm" fontWeight="bold" tone="subdued">{FIELD_LABELS[key] || key}</Text>
                       <InlineStack gap="200" blockAlign="center" wrap={false}>
                         <div style={{ maxWidth: '110px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                           <Text variant="bodySm" tone={isEmpty ? "subdued" : "base"}>{displayVal}</Text>
                         </div>
                         <Badge tone={statusTone} size="small">{statusIcon}</Badge>
                       </InlineStack>
                     </div>
                   );
                })}
              </div>
            </BlockStack>
          </Card>
        )}

        <Button variant="primary" onClick={() => {
          if (!product) return;
          const fd = new FormData();
          fd.append("intent", "build_payload");
          fd.append("productId", product.id);
          fd.append("title", product.title);
          fd.append("description", product.description);
          fd.append("existingMeta", JSON.stringify(product.metafields));
          fetcher.submit(fd, { method: "post" });
        }} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "build_payload"} disabled={!injectProduct}>
          🔄 Build JSON Payload
        </Button>
        {fetcher.data?.payload !== undefined && <Banner tone="success">Payload built — review and edit below, then inject.</Banner>}
        <TextField
          label="JSON Payload (one object per line — edit before injecting)"
          value={payload}
          onChange={setPayload}
          multiline={12}
          autoComplete="off"
        />
        <Button variant="primary" onClick={() => {
          const fd = new FormData();
          fd.append("intent", "inject");
          fd.append("payload", payload);
          fetcher.submit(fd, { method: "post" });
        }} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "inject"} disabled={!payload}>
          💉 Inject Directly to Shopify
        </Button>
        {fetcher.data?.injected !== undefined && (
          <Banner tone="success">Injected {fetcher.data.injected} metafield(s) successfully!</Banner>
        )}
      </BlockStack>
    );
  }

  // ==========================================
  // VIEW 3: MINDAT EXPLORER
  // ==========================================
  if (mode === "mindat") {
    const isFetchingMindat = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "mindat_lookup";
    const mindatResult = fetcher.data?.intent === "mindat_lookup" ? fetcher.data : null;

    return (
      <BlockStack gap="400">
        <Text variant="headingMd">🌍 Mindat Database Explorer</Text>
        <Text variant="bodyMd" tone="subdued">Query the live Mindat API to research geological data before adding it to your library.</Text>
        
        <Card>
          <BlockStack gap="400">
            <InlineStack gap="300" blockAlign="end">
              <div style={{ flex: 1 }}>
                <TextField
                  label="Search Mineral/Rock Name"
                  value={mindatQuery}
                  onChange={setMindatQuery}
                  placeholder="e.g., Lapis Lazuli, Quartz, Obsidian..."
                  autoComplete="off"
                  prefix={<Icon source={SearchIcon} />}
                />
              </div>
              <Button 
                variant="primary" 
                onClick={() => {
                  const fd = new FormData();
                  fd.append("intent", "mindat_lookup");
                  fd.append("query", mindatQuery.trim());
                  fetcher.submit(fd, { method: "post" });
                }} 
                disabled={!mindatQuery.trim()}
                loading={isFetchingMindat}
              >
                Search Database
              </Button>
            </InlineStack>

            {mindatResult && (
              <Box paddingBlockStart="400">
                <Divider />
                <Box paddingBlockStart="400">
                  {mindatResult.found ? (
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm">Results for "{mindatQuery}"</Text>
                        <Badge tone="success">Match Found</Badge>
                      </InlineStack>
                      <div style={{ background: "#202124", color: "#e8eaed", padding: "16px", borderRadius: "8px", overflowX: "auto", fontFamily: "monospace", fontSize: "13px" }}>
                        <pre style={{ margin: 0 }}>
                          {JSON.stringify(mindatResult.result, null, 2)}
                        </pre>
                      </div>
                    </BlockStack>
                  ) : (
                    <Banner tone="warning">No results found for "{mindatQuery}". Try a different spelling or a broader mineral family.</Banner>
                  )}
                </Box>
              </Box>
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    );
  }

  return null;
}
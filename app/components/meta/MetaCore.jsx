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
  const suggestFetcher = useFetcher();
  const saveFetcher = useFetcher();

  const [checkedIds, setCheckedIds] = useState([]);
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [customInputs, setCustomInputs] = useState({});
  const [ooakText, setOoakText] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [saveStatus, setSaveStatus] = useState(null); 

  // QA & Inject Tab State
  const [injectProduct, setInjectProduct] = useState("");
  const [payload, setPayload] = useState("");
  const [qaEdits, setQaEdits] = useState({});

  const [mindatQuery, setMindatQuery] = useState("");
  const [mindatSearched, setMindatSearched] = useState("");

  useEffect(() => {
    if (checkedIds.length === 1) {
      const p = products.find(prod => prod.id === checkedIds[0]);
      if (!p) return;

      const mfs = p.metafields || {};
      const newVals = {};
      const newTicked = {};
      const newCustom = {};

      const offName = mfs["official_name"] ? String(mfs["official_name"]).replace(/[✅⚠️]/g, "").trim() : "";
      if (offName) {
        newTicked["official_name"] = true;
        const stoneMatch = availableStones.find(s => s.toLowerCase() === offName.toLowerCase());
        if (stoneMatch) {
          newVals["official_name"] = stoneMatch;
        } else {
          newVals["official_name"] = "__custom__";
          newCustom["official_name"] = offName;
        }
      }

      const getOpts = (key, stoneName) => {
        let opts = SEO_DICTIONARY[key]?.global || [];
        if (stoneName && SEO_DICTIONARY[key]?.[stoneName.toLowerCase()]) {
          opts = SEO_DICTIONARY[key][stoneName.toLowerCase()];
        }
        return opts;
      };

      TARGET_KEYS.forEach(key => {
        if (key === "official_name") return;
        const rawVal = mfs[key];
        if (!rawVal) return;
        
        const cleanVal = String(rawVal).replace(/[✅⚠️]/g, "").trim();
        newTicked[key] = true;

        if (FREE_TEXT_FIELDS.includes(key)) {
          newVals[key] = cleanVal;
        } else if (DROPDOWN_FIELDS.includes(key)) {
          const opts = getOpts(key, offName);
          const match = opts.find(o => o.toLowerCase() === cleanVal.toLowerCase());
          if (match) {
            newVals[key] = match;
          } else {
            newVals[key] = "__custom__";
            newCustom[key] = cleanVal;
          }
        }
      });

      setFieldValues(newVals);
      setCustomInputs(newCustom);
      setTickedFields(newTicked);
      setOoakText("");
    }
  }, [checkedIds, products]);

  // Load selected product's exact data into QA Edit State
  useEffect(() => {
    if (injectProduct) {
      const p = products.find(prod => prod.id === injectProduct);
      if (p) {
        const cleanedMeta = {};
        if (p.metafields?.official_name) {
          cleanedMeta["official_name"] = String(p.metafields.official_name).replace(/[✅⚠️]/g, "").trim();
        }
        TARGET_KEYS.forEach(k => {
          cleanedMeta[k] = p.metafields?.[k] ? String(p.metafields[k]).replace(/[✅⚠️]/g, "").trim() : "";
        });
        setQaEdits(cleanedMeta);
      }
    } else {
      setQaEdits({});
      setPayload("");
    }
  }, [injectProduct, products]);

  const handleQaEdit = (key, val) => {
    setQaEdits(prev => ({ ...prev, [key]: val }));
  };

  const getOptionsForField = (fieldKey, explicitStoneName) => {
    const currentStone = explicitStoneName !== undefined
      ? explicitStoneName.toLowerCase()
      : (fieldValues["official_name"] === "__custom__" 
        ? (customInputs["official_name"] || "").toLowerCase()
        : (fieldValues["official_name"] || "").toLowerCase());
      
    let opts = SEO_DICTIONARY[fieldKey]?.global || [];
    if (currentStone && SEO_DICTIONARY[fieldKey]?.[currentStone]) {
      opts = SEO_DICTIONARY[fieldKey][currentStone];
    }
    return opts;
  };

  // --- HANDLE BULK SAVE RESPONSE ---
  useEffect(() => {
    if (isProcessing && saveFetcher.state === "idle" && saveFetcher.data) {
      setIsProcessing(false);
      if (saveFetcher.data.ok) {
        setSaveStatus("success");
      } else {
        setSaveStatus("error");
      }
    }
  }, [saveFetcher.state, saveFetcher.data, isProcessing]);

  // --- TRIGGER ENGINE: Auto Populate on Selection ---
  const triggerAutoSuggest = (stoneName) => {
    if (!stoneName || stoneName.trim() === "") return;
    setIsSuggesting(true);
    const fd = new FormData();
    fd.append("intent", "mindat_lookup");
    fd.append("query", stoneName);
    suggestFetcher.submit(fd, { method: "POST", action: "/app/meta-injector" });
  };

  // --- HANDLE MINDAT SUGGESTION RESPONSE ---
  useEffect(() => {
    if (isSuggesting && suggestFetcher.state === "idle" && suggestFetcher.data) {
      setIsSuggesting(false);
      const data = suggestFetcher.data;

      const firstStone = products.find(p => p.id === checkedIds[0]);
      let suggestedName = fieldValues["official_name"] === "__custom__" 
        ? customInputs["official_name"] 
        : fieldValues["official_name"];

      if (!suggestedName && firstStone) {
        suggestedName = firstStone.metafields?.official_name || firstStone.title;
      }
      
      const libraryData = lookupStone(suggestedName) || {};
      if (libraryData.official_name) suggestedName = libraryData.official_name;

      const newValues = { ...fieldValues };
      const newTicked = { ...tickedFields };
      const newCustom = { ...customInputs };

      const applySuggestion = (key, value) => {
        if (!value) return;
        const currentStone = newValues["official_name"] === "__custom__" 
          ? (newCustom["official_name"] || "").toLowerCase()
          : (newValues["official_name"] || "").toLowerCase();
          
        let opts = SEO_DICTIONARY[key]?.global || [];
        if (currentStone && SEO_DICTIONARY[key]?.[currentStone]) {
          opts = SEO_DICTIONARY[key][currentStone];
        }
        
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
    }
  }, [suggestFetcher.state, suggestFetcher.data, isSuggesting, checkedIds, products, fieldValues, customInputs, tickedFields]);

  const autoSuggestFields = () => {
    if (checkedIds.length === 0) return;
    const firstStone = products.find(p => p.id === checkedIds[0]);
    if (!firstStone) return;

    let suggestedName = fieldValues["official_name"] === "__custom__" 
      ? customInputs["official_name"] 
      : fieldValues["official_name"];

    if (!suggestedName) {
      suggestedName = firstStone.metafields?.official_name || firstStone.title;
    }
    triggerAutoSuggest(suggestedName);
  };

  const processBulkQueue = () => {
    if (checkedIds.length === 0 || (!Object.values(tickedFields).some(Boolean) && !ooakText)) return;
    setIsProcessing(true);
    setSaveStatus(null);

    const updates = {};

    // Explicitly add official_name payload hook
    if (tickedFields["official_name"]) {
      updates["official_name"] = fieldValues["official_name"] === "__custom__" ? (customInputs["official_name"] || "") : (fieldValues["official_name"] || "");
    }

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

    saveFetcher.submit(fd, { method: "POST", action: "/app/meta-injector" });
  };

  // Direct Save Action for QA Edit Tab
  const saveDirectQa = () => {
    setIsProcessing(true);
    setSaveStatus(null);

    const payloadObj = Object.keys(qaEdits)
      .map(k => ({
        ownerId: injectProduct,
        key: k,
        value: qaEdits[k]
      }))
      .filter(mf => mf.value.trim() !== "");

    const fd = new FormData();
    fd.append("intent", "saveMetafields");
    fd.append("metafields", JSON.stringify(payloadObj));
    saveFetcher.submit(fd, { method: "POST", action: "/app/meta-injector" });
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

        {/* ── TOP ACTION BAR ── */}
        <InlineStack gap="300" blockAlign="center">
          <Button
            onClick={autoSuggestFields}
            disabled={checkedIds.length === 0 || isSuggesting}
            icon={() => <span>🪄</span>}
          >
            {isSuggesting ? "Fetching from Mindat..." : "Auto-Suggest SEO Fields"}
          </Button>
          <Button
            variant="primary"
            size="large"
            onClick={processBulkQueue}
            disabled={checkedIds.length === 0 || isProcessing}
          >
            {isProcessing ? "Saving..." : `Apply Updates to ${checkedIds.length} Stone(s)`}
          </Button>
        </InlineStack>

        {/* ── SAVE STATUS BANNERS ── */}
        {saveStatus === "success" && (
          <Banner tone="success" onDismiss={() => setSaveStatus(null)}>
            Saved successfully to Shopify!
          </Banner>
        )}
        {saveStatus === "error" && (
          <Banner tone="critical" onDismiss={() => setSaveStatus(null)}>
            Save failed. Check your connection and try again.
          </Banner>
        )}
        {isProcessing && (
          <Banner tone="info">Saving data to Shopify. This may take a moment...</Banner>
        )}

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
                          onChange={(e) => {
                            const val = e.target.value;
                            setFieldValues({ ...fieldValues, official_name: val });
                            if (val !== "__custom__" && val !== "") {
                              triggerAutoSuggest(val);
                            }
                          }}
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
        <Text variant="headingMd">QA / Direct Editor</Text>
        <Select
          label="Select a stone to review and edit its Metafield Data"
          options={[{ label: "-- Pick a stone --", value: "" }, ...products.map((p) => ({ label: p.title, value: p.id }))]}
          value={injectProduct}
          onChange={setInjectProduct}
        />

        {saveStatus === "success" && (
          <Banner tone="success" onDismiss={() => setSaveStatus(null)}>
            Direct Edits Saved successfully to Shopify!
          </Banner>
        )}
        {saveStatus === "error" && (
          <Banner tone="critical" onDismiss={() => setSaveStatus(null)}>
            Save failed. Check your connection and try again.
          </Banner>
        )}

        {product && (
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingSm">QA Edit Data</Text>
                <InlineStack gap="300" blockAlign="center">
                  <Badge tone={product.filledCount === TARGET_KEYS.length ? "success" : "warning"}>
                    {product.filledCount} / {TARGET_KEYS.length} Complete
                  </Badge>
                  <Button variant="primary" onClick={saveDirectQa} loading={isProcessing}>
                    Save Direct to Shopify
                  </Button>
                </InlineStack>
              </InlineStack>
              <Divider />
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                
                {/* Official Name Field (Explicit) */}
                <div style={{ background: '#f4f6f8', padding: '12px', borderRadius: '6px' }}>
                  <BlockStack gap="100">
                    <InlineStack align="space-between">
                      <Text variant="bodySm" fontWeight="bold" tone="subdued">Official Name</Text>
                      <Badge tone={qaEdits["official_name"] ? "success" : "attention"}>{qaEdits["official_name"] ? "✅" : "⚠️"}</Badge>
                    </InlineStack>
                    <Select
                      label=""
                      options={[
                        {label: "-- Pick a stone --", value: ""},
                        ...availableStones.map(s => ({label: s, value: s})),
                        {label: "Custom Value...", value: "__custom__"}
                      ]}
                      value={availableStones.includes(qaEdits["official_name"]) ? qaEdits["official_name"] : (qaEdits["official_name"] ? "__custom__" : "")}
                      onChange={(v) => { if (v !== "__custom__") handleQaEdit("official_name", v); }}
                    />
                    {(!availableStones.includes(qaEdits["official_name"]) && qaEdits["official_name"]) || qaEdits["official_name"] === "__custom__" ? (
                      <TextField
                        label=""
                        value={qaEdits["official_name"] || ""}
                        onChange={(v) => handleQaEdit("official_name", v)}
                        autoComplete="off"
                        placeholder="Custom Official Name"
                      />
                    ) : null}
                  </BlockStack>
                </div>

                {/* Target Keys Array */}
                {TARGET_KEYS.filter(k => k !== 'official_name').map(key => {
                  const options = DROPDOWN_FIELDS.includes(key) ? getOptionsForField(key, qaEdits["official_name"] || "") : [];
                  const isCustomDropdown = DROPDOWN_FIELDS.includes(key) && qaEdits[key] && !options.includes(qaEdits[key]);

                  return (
                    <div key={key} style={{ background: '#f4f6f8', padding: '12px', borderRadius: '6px' }}>
                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodySm" fontWeight="bold" tone="subdued">{FIELD_LABELS[key] || key}</Text>
                          <Badge tone={qaEdits[key] ? "success" : "attention"}>{qaEdits[key] ? "✅" : "⚠️"}</Badge>
                        </InlineStack>
                        
                        {DROPDOWN_FIELDS.includes(key) ? (
                          <BlockStack gap="200">
                            <Select
                              label=""
                              options={[
                                {label: "-- Select --", value: ""}, 
                                ...options.map(o => ({label: o, value: o})),
                                {label: "+ Custom Value...", value: "__custom__"}
                              ]}
                              value={isCustomDropdown ? "__custom__" : (qaEdits[key] || "")}
                              onChange={(v) => { if (v !== "__custom__") handleQaEdit(key, v); }}
                            />
                            {isCustomDropdown && (
                              <TextField
                                label=""
                                value={qaEdits[key] || ""}
                                onChange={(v) => handleQaEdit(key, v)}
                                autoComplete="off"
                                placeholder="Custom dropdown value"
                              />
                            )}
                          </BlockStack>
                        ) : (
                          <TextField
                            label=""
                            value={qaEdits[key] || ""}
                            onChange={(v) => handleQaEdit(key, v)}
                            autoComplete="off"
                            multiline={key === "stone_story" || key === "bench_notes" ? 2 : false}
                          />
                        )}
                      </BlockStack>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        )}

        <Divider />
        <Text variant="headingSm" tone="subdued">Advanced: JSON Payload Injector</Text>

        <Button onClick={() => {
          if (!product) return;
          const fd = new FormData();
          fd.append("intent", "build_payload");
          fd.append("productId", product.id);
          fd.append("title", product.title);
          fd.append("description", product.description);
          fd.append("existingMeta", JSON.stringify(qaEdits)); // Uses your live QA edits!
          fetcher.submit(fd, { method: "post", action: "/app/meta-injector" });
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
          fetcher.submit(fd, { method: "post", action: "/app/meta-injector" });
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
    const isFetchingMindat = fetcher.state === "submitting";
    const hasResult = fetcher.state === "idle" && fetcher.data?.ok !== undefined && mindatSearched !== "";

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
                  setMindatSearched(mindatQuery.trim());
                  const fd = new FormData();
                  fd.append("intent", "mindat_lookup");
                  fd.append("query", mindatQuery.trim());
                  fetcher.submit(fd, { method: "post", action: "/app/meta-injector" });
                }} 
                disabled={!mindatQuery.trim()}
                loading={isFetchingMindat}
              >
                Search Database
              </Button>
            </InlineStack>

            {hasResult && (
              <Box paddingBlockStart="400">
                <Divider />
                <Box paddingBlockStart="400">
                  {fetcher.data.found ? (
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingSm">Results for "{mindatSearched}"</Text>
                        <Badge tone="success">Match Found</Badge>
                      </InlineStack>
                      <div style={{ background: "#202124", color: "#e8eaed", padding: "16px", borderRadius: "8px", overflowX: "auto", fontFamily: "monospace", fontSize: "13px" }}>
                        <pre style={{ margin: 0 }}>
                          {JSON.stringify(fetcher.data.result, null, 2)}
                        </pre>
                      </div>
                    </BlockStack>
                  ) : (
                    <Banner tone="warning">No results found for "{mindatSearched}". Try a different spelling or a broader mineral family.</Banner>
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
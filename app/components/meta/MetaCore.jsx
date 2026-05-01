import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Card, TextField, Text, BlockStack, InlineStack, Button,
  Checkbox, Scrollable, ProgressBar, Box, Select, Banner,
  Divider, ActionList
} from "@shopify/polaris";
import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";

const DROPDOWN_FIELDS = ["luster", "diaphaneity", "fracture_pattern", "cleavage", "crystal_structure", "rock_formation", "mineral_class", "geological_era", "tenacity"];
const FREE_TEXT_FIELDS = ["official_name", "origin_location", "rescued_by", "stone_story", "bench_notes", "dimensions", "carat_weight", "cut_type", "moh_hardness", "specific_gravity"];

const SEO_DICTIONARY = {
  luster: {
    global: ["Vitreous (Glassy)", "Waxy", "Resinous", "Silky", "Pearly", "Dull / Earthy", "Submetallic"],
    labradorite: ["Labradorescent (Schiller)", "Vitreous", "Pearly on cleavages"],
    obsidian: ["Vitreous (Glassy)", "Sheen (Gold/Silver)", "Chatoyant"],
  },
  diaphaneity: {
    global: ["Opaque", "Translucent", "Transparent", "Semi-Translucent"],
    agate: ["Highly Translucent", "Banded Translucent", "Semi-Translucent"],
  },
  fracture_pattern: {
    global: ["Conchoidal (Shell-like)", "Uneven", "Splintery", "Hackly", "Granular"],
  },
  cleavage: {
    global: ["None (Perfect for cabbing)", "Indistinct", "Perfect in one direction", "Good"],
    labradorite: ["Perfect in two directions (Requires care)"],
  },
  crystal_structure: {
    global: ["Trigonal", "Cryptocrystalline", "Amorphous (Non-crystalline)", "Monoclinic", "Triclinic", "Orthorhombic"],
  },
  rock_formation: {
    global: ["Igneous (Volcanic)", "Sedimentary", "Metamorphic", "Hydrothermal Vein", "Pegmatite"],
  },
  mineral_class: {
    global: ["Silicate", "Tectosilicate", "Oxide", "Carbonate", "Sulfate", "Phosphate"],
  },
};

export default function MetaCore({ products = [], mode }) {
  const fetcher = useFetcher();

  const [checkedIds, setCheckedIds] = useState([]);
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, title: "" });
  const [customInputs, setCustomInputs] = useState({});
  const [ooakText, setOoakText] = useState("");

  const [injectProduct, setInjectProduct] = useState("");
  const [payload, setPayload] = useState("");
  const [mindatName, setMindatName] = useState("");

  const getOptionsForField = (fieldKey) => {
    const currentStone = (fieldValues["official_name"] || "").toLowerCase();
    let options = SEO_DICTIONARY[fieldKey]?.global || [];
    if (currentStone && SEO_DICTIONARY[fieldKey]?.[currentStone]) {
      options = SEO_DICTIONARY[fieldKey][currentStone];
    }
    return options;
  };

  const processBulkQueue = async () => {
    if (checkedIds.length === 0 || !Object.values(tickedFields).some(Boolean)) return;
    setIsProcessing(true);

    const updates = {};
    TARGET_KEYS.forEach(k => {
      if (tickedFields[k]) {
        updates[k] = fieldValues[k] === "__custom__" ? (customInputs[k] || "") : (fieldValues[k] || "");
      }
    });
    if (ooakText && updates["stone_story"]) {
      updates["stone_story"] = updates["stone_story"] + " " + ooakText;
    } else if (ooakText) {
      updates["stone_story"] = ooakText;
    }

    for (let i = 0; i < checkedIds.length; i++) {
      const pId = checkedIds[i];
      const pObj = products.find(p => p.id === pId);
      setProgress({ current: i + 1, total: checkedIds.length, title: pObj?.title || "Unknown" });

      const fd = new FormData();
      fd.append("intent", "bulk_edit_new");
      fd.append("ids", JSON.stringify([pId]));
      fd.append("updates", JSON.stringify(updates));
      await fetcher.submit(fd, { method: "post" });
    }

    setIsProcessing(false);
    setProgress({ current: 0, total: 0, title: "" });
    fetcher.submit({}, { method: "get" });
  };

  useEffect(() => {
    if (fetcher.data?.payload !== undefined) {
      setPayload(fetcher.data.payload);
    }
  }, [fetcher.data]);

  if (mode === "bulk") {
    const allChecked = checkedIds.length === products.length && products.length > 0;
    const indeterminate = checkedIds.length > 0 && checkedIds.length < products.length;

    return (
      <BlockStack gap="400">
        {isProcessing && (
          <Banner tone="info">
            <BlockStack gap="200">
              <Text variant="bodyMd" as="p">
                Processing {progress.current} of {progress.total} — {progress.title}...
              </Text>
              <ProgressBar progress={(progress.current / progress.total) * 100} size="small" tone="primary" />
            </BlockStack>
          </Banner>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
          {/* LEFT COLUMN: Product Selection */}
          <BlockStack gap="300">
            <Card padding="0">
              <Box padding="300">
                <Checkbox
                  label={`Select All (${products.length})`}
                  checked={indeterminate ? "indeterminate" : allChecked}
                  onChange={(checked) => setCheckedIds(checked ? products.map(p => p.id) : [])}
                />
              </Box>
              <Divider />
              <Scrollable style={{ height: "550px" }}>
                <ActionList
                  actionRole="menuitem"
                  items={products.map(p => ({
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
              </Scrollable>
            </Card>
          </BlockStack>

          {/* RIGHT COLUMN: Smart Questionnaire */}
          <BlockStack gap="300">
            <Banner tone="info">Fields are mapped to 2026 SEO trends. Values adapt to the Official Name.</Banner>
            <Card padding="0">
              <Scrollable style={{ height: "550px" }}>
                <BlockStack gap="400" padding="400">

                  {/* Section 1: Free Text */}
                  <Text variant="headingSm" tone="subdued">CORE IDENTIFICATION (FREE TEXT)</Text>
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

                  {/* Section 2: Smart Dropdowns */}
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

                  {/* Section 3: OOAK */}
                  <BlockStack gap="200" style={{ background: "#fff8e6", padding: "12px", borderRadius: "8px", border: "1px solid #e1b878" }}>
                    <Text variant="headingSm">✨ OOAK Special Features</Text>
                    <Text variant="bodySm" tone="subdued">Text entered here appends to the Stone Story without overwriting it.</Text>
                    <TextField
                      label=""
                      value={ooakText}
                      onChange={setOoakText}
                      multiline={3}
                      placeholder="e.g. Features a striking hematite inclusion resembling a lightning bolt..."
                    />
                  </BlockStack>

                </BlockStack>
              </Scrollable>
            </Card>

            <Button variant="primary" size="large" onClick={processBulkQueue} disabled={checkedIds.length === 0 || isProcessing}>
              Apply SEO Updates to {checkedIds.length} Stone(s)
            </Button>
          </BlockStack>
        </div>
      </BlockStack>
    );
  }

  if (mode === "inject") {
    const product = products.find((p) => p.id === injectProduct);

    return (
      <BlockStack gap="400">
        <Text variant="headingMd">Auto-build payload from product + Mindat</Text>
        <Select
          label="Select a stone"
          options={[{ label: "-- Pick a stone --", value: "" }, ...products.map((p) => ({ label: p.title, value: p.id }))]}
          value={injectProduct}
          onChange={setInjectProduct}
        />
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
          🔄 Build Payload
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
          💉 Inject
        </Button>
        {fetcher.data?.injected !== undefined && (
          <Banner tone="success">Injected {fetcher.data.injected} metafield(s) successfully!</Banner>
        )}
      </BlockStack>
    );
  }

  if (mode === "mindat") {
    return (
      <BlockStack gap="400">
        <Text variant="headingMd">Pull verified geological data from Mindat.org.</Text>
        <TextField
          label="Stone name"
          value={mindatName}
          onChange={setMindatName}
          placeholder="e.g. Amethyst"
          autoComplete="off"
        />
        <Button variant="primary" onClick={() => {
          const fd = new FormData();
          fd.append("intent", "mindat_lookup");
          fd.append("query", mindatName);
          fetcher.submit(fd, { method: "post" });
        }} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "mindat_lookup"}>
          🌍 Lookup
        </Button>
        {fetcher.data?.found === true && (
          <Banner tone="success">
            <Text>Found Results!</Text>
            <Text>Hardness: {fetcher.data.result?.hardness || "N/A"}</Text>
            <Text>Where Found: {fetcher.data.result?.localities || "N/A"}</Text>
            <Text>Geological Age: {fetcher.data.result?.geological_age || "N/A"}</Text>
          </Banner>
        )}
        {fetcher.data?.found === false && (
          <Banner tone="warning">No results found for "{mindatName}".</Banner>
        )}
        <Banner tone="info">Requires a Mindat.org API token mapped to process.env.MINDAT_API_KEY.</Banner>
      </BlockStack>
    );
  }

  return null;
}

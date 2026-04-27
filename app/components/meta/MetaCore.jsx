import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Card, TextField, Text, BlockStack, InlineStack, Button, 
  Checkbox, Scrollable, ProgressBar, Box, Select, Banner
} from "@shopify/polaris";

const METAFIELDS = [
  { key: "crystal_structure", name: "Crystal Structure" },
  { key: "mineral_class", name: "Mineral Class" },
  { key: "rock_formation", name: "Rock Formation" },
  { key: "geological_era", name: "Geological Era" },
  { key: "rock_composition", name: "Rock Composition" },
  { key: "hardness", name: "Hardness" },
  { key: "where_found", name: "Where Found" },
  { key: "geological_age", name: "Geological Age" },
  { key: "character_marks", name: "Character Marks" },
  { key: "stone_story", name: "Stone Story" },
  { key: "rescued_by", name: "Rescued By" },
  { key: "origin_location", name: "Origin Location" }
];

export default function MetaCore({ products, mode }) {
  const fetcher = useFetcher();
  const [selectedIds, setSelectedIds] = useState([]);
  const [ticked, setTicked] = useState({});
  const [values, setValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ cur: 0, total: 0, title: "" });
  const [payload, setPayload] = useState("");

  const runBulk = async () => {
    setIsProcessing(true);
    const updates = {};
    Object.keys(ticked).forEach(k => { if (ticked[k]) updates[k] = values[k] || ""; });
    
    for (let i = 0; i < selectedIds.length; i++) {
      const p = products.find(x => x.id === selectedIds[i]);
      setProgress({ cur: i + 1, total: selectedIds.length, title: p?.title || "Unknown" });
      const fd = new FormData();
      fd.append("intent", "bulk_edit_new");
      fd.append("ids", JSON.stringify([selectedIds[i]]));
      fd.append("updates", JSON.stringify(updates));
      await fetch(".", { method: "POST", body: fd });
    }
    setIsProcessing(false);
    setProgress({ cur: 0, total: 0, title: "" });
    fetcher.submit({}, { method: "get" });
  };

  if (mode === "bulk") return (
    <BlockStack gap="400">
      {isProcessing && (
        <Banner tone="info">
          <BlockStack gap="200">
            <Text>Processing {progress.cur} of {progress.total} — {progress.title}...</Text>
            <ProgressBar progress={(progress.cur / progress.total) * 100} size="small" />
          </BlockStack>
        </Banner>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "20px" }}>
        <Card>
          <Text variant="headingMd">1. Select Stock Items</Text>
          <Scrollable style={{ height: "500px" }}>
            {products.map(p => (
              <Box key={p.id} padding="200">
                <Checkbox 
                  label={p.title} 
                  checked={selectedIds.includes(p.id)} 
                  onChange={(v) => v ? setSelectedIds([...selectedIds, p.id]) : setSelectedIds(selectedIds.filter(id => id !== p.id))} 
                />
              </Box>
            ))}
          </Scrollable>
        </Card>
        <Card>
          <Text variant="headingMd">2. Field Overrides (Tick to Edit)</Text>
          <Scrollable style={{ height: "500px" }}>
            <BlockStack gap="400" padding="200">
              {METAFIELDS.map(f => (
                <div key={f.key}>
                  <Checkbox label={f.name} checked={!!ticked[f.key]} onChange={(v) => setTicked({...ticked, [f.key]: v})} />
                  {ticked[f.key] && (
                    <Box paddingBlockStart="100">
                      <TextField value={values[f.key] || ""} onChange={(v) => setValues({...values, [f.key]: v})} autoComplete="off" placeholder={`Set ${f.name}...`} />
                    </Box>
                  )}
                </div>
              ))}
            </BlockStack>
          </Scrollable>
          <Box paddingBlockStart="400">
            <Button variant="primary" fullWidth onClick={runBulk} disabled={selectedIds.length === 0 || !Object.values(ticked).some(Boolean)}>
              Update {selectedIds.length} Stones
            </Button>
          </Box>
        </Card>
      </div>
    </BlockStack>
  );

  if (mode === "inject") return (
    <BlockStack gap="400">
      <Select 
        label="Select Target Stone" 
        options={[{label: "Choose stone...", value: ""}, ...products.map(p => ({label: p.title, value: p.id}))]} 
        onChange={(v) => {
          const p = products.find(x => x.id === v);
          const fd = new FormData();
          fd.append("intent", "build_payload");
          fd.append("productId", p.id);
          fd.append("title", p.title);
          fd.append("description", p.description);
          fd.append("existingMeta", JSON.stringify(p.metafields));
          fetcher.submit(fd, { method: "post" });
        }} 
      />
      <TextField 
        label="JSON Verified Payload" 
        value={payload || fetcher.data?.payload || ""} 
        onChange={setPayload} 
        multiline={12} 
        autoComplete="off" 
      />
      <Button variant="primary" onClick={() => {
        const fd = new FormData();
        fd.append("intent", "inject");
        fd.append("payload", payload || fetcher.data?.payload);
        fetcher.submit(fd, { method: "post" });
      }} disabled={!(payload || fetcher.data?.payload)}>
        Inject Verified Data
      </Button>
      {fetcher.data?.injected && <Banner tone="success">Injected {fetcher.data.injected} fields successfully.</Banner>}
    </BlockStack>
  );

  return (
    <BlockStack gap="400">
      <Text variant="headingMd">Manual Mindat Geological Lookup</Text>
      <InlineStack gap="300" blockAlign="end">
        <div style={{ flex: 1 }}>
          <TextField label="Mineral/Gem Name" placeholder="e.g. Botswana Agate" autoComplete="off" />
        </div>
        <Button variant="primary">Search API</Button>
      </InlineStack>
      <Banner tone="info">This tool allows for manual lookup when automatic parsing fails.</Banner>
    </BlockStack>
  );
}
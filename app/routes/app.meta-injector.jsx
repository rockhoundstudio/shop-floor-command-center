import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Card, TextField, Text, BlockStack, InlineStack, Button, 
  Checkbox, Scrollable, ProgressBar, Box, Select, Banner
} from "@shopify/polaris";
import { TARGET_KEYS, FIELD_LABELS } from "../utils/metaScan";

export default function MetaCore({ products, mode }) {
  const fetcher = useFetcher();
  
  const [checkedIds, setCheckedIds] = useState([]);
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, title: "" });
  
  const [injectProduct, setInjectProduct] = useState("");
  const [payload, setPayload] = useState("");
  const [mindatName, setMindatName] = useState("");

  const processBulkQueue = async () => {
    if (checkedIds.length === 0 || !Object.values(tickedFields).some(Boolean)) return;
    setIsProcessing(true);

    const updates = {};
    TARGET_KEYS.forEach(k => {
      if (tickedFields[k]) updates[k] = fieldValues[k] || "";
    });

    for (let i = 0; i < checkedIds.length; i++) {
      const pId = checkedIds[i];
      const pObj = products.find(p => p.id === pId);
      
      setProgress({ current: i + 1, total: checkedIds.length, title: pObj?.title || "Unknown" });

      const fd = new FormData();
      fd.append("intent", "bulk_edit_new");
      fd.append("ids", JSON.stringify([pId]));
      fd.append("updates", JSON.stringify(updates));
      
      await fetch(".", { method: "POST", body: fd });
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
    const allChecked = products.length > 0 && checkedIds.length === products.length;

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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          <BlockStack gap="300">
            <InlineStack gap="200" blockAlign="center">
              <Button onClick={() => setCheckedIds(allChecked ? [] : products.map(p => p.id))}>
                {allChecked ? "Deselect All" : "Select All"}
              </Button>
              <Text>{checkedIds.length} selected</Text>
            </InlineStack>
            <Card padding="0">
              <Scrollable style={{ height: "600px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                   <tbody>
                      {products.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #ebebeb", cursor: "pointer" }} onClick={() => {
                            if (checkedIds.includes(p.id)) setCheckedIds(checkedIds.filter(id => id !== p.id));
                            else setCheckedIds([...checkedIds, p.id]);
                        }}>
                          <td style={{ padding: "8px 12px", width: "40px" }} onClick={e => e.stopPropagation()}>
                            <Checkbox
                              label=""
                              checked={checkedIds.includes(p.id)}
                              onChange={(checked) => {
                                if (checked) setCheckedIds([...checkedIds, p.id]);
                                else setCheckedIds(checkedIds.filter((id) => id !== p.id));
                              }}
                            />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <InlineStack gap="300" blockAlign="center">
                              <img src={p.featuredImage?.url || ""} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                              <Text variant="bodySm" fontWeight="500">{p.title}</Text>
                            </InlineStack>
                          </td>
                        </tr>
                      ))}
                   </tbody>
                </table>
              </Scrollable>
            </Card>
          </BlockStack>
          
          <BlockStack gap="300">
            <Banner tone="info">Tick a box to open the input. Only ticked fields will be written.</Banner>
            <Card padding="0">
              <Scrollable style={{ height: "550px" }}>
                 <BlockStack gap="300" padding="400">
                    {TARGET_KEYS.map(key => (
                       <BlockStack key={key} gap="100">
                          <Checkbox 
                             label={FIELD_LABELS[key]} 
                             checked={tickedFields[key] || false} 
                             onChange={() => setTickedFields(prev => ({...prev, [key]: !prev[key]}))} 
                          />
                          {tickedFields[key] && (
                              <TextField
                                 label=""
                                 value={fieldValues[key] || ""}
                                 onChange={(v) => setFieldValues({ ...fieldValues, [key]: v })}
                                 placeholder={`Enter ${FIELD_LABELS[key]}...`}
                                 autoComplete="off"
                              />
                          )}
                       </BlockStack>
                    ))}
                 </BlockStack>
              </Scrollable>
            </Card>
            <Button variant="primary" onClick={processBulkQueue} disabled={checkedIds.length === 0 || isProcessing || !Object.values(tickedFields).some(Boolean)}>
              Save Ticked Fields to {checkedIds.length} Stone(s)
            </Button>
          </BlockStack>
        </div>
      </BlockStack>
    );
  }

  if (mode === "inject") {
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
          const product = products.find((p) => p.id === injectProduct);
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
        {fetcher.data?.intent === "mindat_lookup" && fetcher.data?.found && (
           <Banner tone="success">
              <Text>Found Results!</Text>
              <Text>Hardness: {fetcher.data.result.hardness || "N/A"}</Text>
              <Text>Where Found: {fetcher.data.result.localities || "N/A"}</Text>
              <Text>Geological Age: {fetcher.data.result.geological_age || "N/A"}</Text>
           </Banner>
        )}
        {fetcher.data?.intent === "mindat_lookup" && !fetcher.data?.found && (
           <Banner tone="warning">No results found for "{mindatName}".</Banner>
        )}
        <Banner tone="info">Requires a Mindat.org API token mapped to process.env.MINDAT_API_KEY.</Banner>
      </BlockStack>
    );
  }

  return null;
}

import { 
  TextField, BlockStack, Card, Text, Badge, Button, Banner, 
  InlineStack, Page, Select, Box, ResourceList, ResourceItem, Thumbnail, Checkbox, Tag
} from "@shopify/polaris";
import { ArrowLeftIcon } from "@shopify/polaris-icons";
import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, data, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";

import { TARGET_KEYS, FIELD_LABELS, stripHtml, evaluateProductStatus } from "../utils/metaScan";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";
import DictationButton from "../components/DictationButton";

const LIST_TEXT_FIELDS = ["character_marks", "stone_story"];
const BOOLEAN_FIELDS = ["is_ooak", "custom_product"];

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

function unwrapListValue(value) {
  let val = String(value).trim();
  while (val.startsWith("[") && val.endsWith("]")) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        val = String(parsed[0]).trim();
      } else { break; }
    } catch { break; }
  }
  return val;
}

function formatMetafieldValue(originalKey, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim();
  const mapKey = originalKey.replace(/-/g, "_");

  if (TAXONOMY_GIDS[mapKey] && TAXONOMY_GIDS[mapKey][cleanValue]) {
    return {
      value: wrapGid(TAXONOMY_GIDS[mapKey][cleanValue]),
      type: "list.metaobject_reference",
      namespace: "shopify",
      key: originalKey.replace(/_/g, "-")
    };
  }

  const isListField = LIST_TEXT_FIELDS.includes(mapKey);
  const isBooleanField = BOOLEAN_FIELDS.includes(mapKey);

  let finalValue = String(value).trim();
  let finalType = "single_line_text_field";

  if (isListField) {
    finalValue = JSON.stringify([finalValue]);
    finalType = "list.single_line_text_field";
  } else if (isBooleanField) {
    const truthy = ["true", "yes", "1", "✅ true"];
    finalValue = truthy.some(t => finalValue.toLowerCase().includes(t)) ? "true" : "false";
    finalType = "boolean";
  }

  return { value: finalValue, type: finalType, namespace: "custom", key: mapKey };
}

function extractShopifyError(errors, chunk) {
  if (!errors || errors.length === 0) return null;
  let failingKey = "UNKNOWN";
  try {
    if (errors[0].field && typeof errors[0].field[1] === "number") {
      failingKey = chunk[errors[0].field[1]]?.key || "UNKNOWN";
    }
  } catch (e) {}
  return `[FIELD: ${failingKey}] ${errors[0].message} | RAW: ${JSON.stringify(errors)} | CHUNK: [${chunk.map(c => c.key).join(", ")}]`;
}

// --- LOADER ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const productsRes = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id title descriptionHtml status
              variants(first: 1) { edges { node { id price } } }
              featuredImage { url altText }
              customMeta: metafields(first: 100, namespace: "custom") {
                edges { node { key value } }
              }
              shopifyMeta: metafields(first: 100, namespace: "shopify") {
                edges { node { key value } }
              }
            }
          }
        }
      }
    `);

    const pData = await productsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const customMfs = Object.fromEntries(
        (node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const shopifyMfs = Object.fromEntries(
        (node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const rawMfs = { ...shopifyMfs, ...customMfs };

      const mfs = Object.fromEntries(
        Object.entries(rawMfs).map(([k, v]) => {
          let finalVal = unwrapListValue(String(v));
          const dictKey = k.replace(/_/g, "-");
          if (TAXONOMY_GIDS[dictKey]) {
            for (const [word, mappedGid] of Object.entries(TAXONOMY_GIDS[dictKey])) {
              if (finalVal.includes(String(mappedGid))) { finalVal = word; break; }
            }
          }
          return [k.replace(/-/g, "_"), finalVal];
        })
      );

      const { status, filledCount } = evaluateProductStatus(mfs);
      const missing = TARGET_KEYS.filter(k => !mfs || !mfs[k] || String(mfs[k]).trim() === "");
      const price = node.variants?.edges?.[0]?.node?.price || "0.00";

      return {
        id: node.id,
        title: node.title,
        price,
        shopifyStatus: node.status,
        description: stripHtml(node.descriptionHtml),
        image: node.featuredImage?.url || null,
        metafields: mfs,
        status,
        filledCount,
        missing
      };
    });

    return data({ products, loaderError: null });
  } catch (error) {
    return data({ products: [], loaderError: error.message });
  }
};

// --- ACTION ---
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  // --- STANDARD SAVE ---
  if (intent === "save_standard_edit") {
    const ids = JSON.parse(formData.get("ids") || "[]");
    const updates = JSON.parse(formData.get("updates") || "{}");

    const results = [];

    for (const productId of ids) {
      const metafields = Object.entries(updates)
        .map(([key, value]) => {
          if (!value || String(value).trim() === "") return null;
          const formatted = formatMetafieldValue(key, value);
          if (!formatted) return null;
          return {
            ownerId: productId,
            namespace: formatted.namespace,
            key: formatted.key,
            value: formatted.value,
            type: formatted.type
          };
        })
        .filter(Boolean);

      if (metafields.length === 0) {
        results.push({ id: productId, ok: false, error: "no fields to save" });
        continue;
      }

      let saveError = null;
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));

      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) { saveError = errorMsg; break; }
      }

      results.push({ id: productId, ok: !saveError, error: saveError || null });
    }

    const anyFailed = results.some(r => !r.ok);
    return data({ ok: !anyFailed, results, error: anyFailed ? results.find(r => r.error)?.error : null });
  }

  // --- VOCABULARY ---
  if (intent === "loadVocabulary") {
    return data({ vocabulary: {} });
  }

  if (intent === "saveVocabularyEntry") {
    return data({ ok: true });
  }

  return data({ ok: false, error: "Unknown intent: " + intent });
};

// --- VIEW ---
export default function MetaInjector() {`n  const navigate = useNavigate();
  const { products, loaderError } = useLoaderData();
  const shopify = useAppBridge();

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

  function handleSave() {
    if (selectedIds.length === 0) {
      shopify.toast.show("Please select at least one product to update.");
      return;
    }
    const hasAnyValue = TARGET_KEYS.some(
      key => fieldValues[key] && String(fieldValues[key]).trim() !== ""
    );
    if (!hasAnyValue) {
      shopify.toast.show("Fill in at least one field before saving.");
      return;
    }
    const updates = {};
    TARGET_KEYS.forEach(key => {
      const val = fieldValues[key];
      if (val && String(val).trim() !== "") updates[key] = String(val).trim();
    });

    saveFetcher.submit(
      {
        intent: "save_standard_edit",
        ids: JSON.stringify(selectedIds),
        updates: JSON.stringify(updates),
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  return (
    <>
      <Box paddingBlockStart="400" paddingInlineStart="400">
        <Button onClick={() => navigate("/app")} icon={ArrowLeftIcon}>Back</Button>
      </Box>
      <Page title="Standard Data Injector" fullWidth>
        <BlockStack gap="600">

          {loaderError && <Banner tone="critical">Loader error: {loaderError}</Banner>}
          {saveSuccess && (
            <Banner tone="success">
              Update saved to Shopify across {selectedIds.length} stone{selectedIds.length !== 1 ? "s" : ""}.
            </Banner>
          )}
          {saveError && <Banner tone="critical">Save failed: {saveError}</Banner>}

          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "stretch" }}>

            {/* LEFT — Product List */}
            <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column" }}>
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
                  <div style={{ height: "500px", overflowY: "auto" }}>
                    <ResourceList
                      items={filtered}
                      renderItem={(p) => {
                        const isSelected = selectedIds.includes(p.id);
                        const cleanStatus = String(p.status || "").replace(/[^\w\s]/gi, "").trim().toLowerCase();
                        const badgeTone = cleanStatus === "complete" ? "success" : cleanStatus === "partial" ? "warning" : "critical";
                        return (
                          <ResourceItem
                            id={p.id}
                            onClick={() => {
                              setSelectedIds(prev => isSelected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                            }}
                            media={<Thumbnail source={p.image || ""} alt={p.title} size="small" />}
                          >
                            <InlineStack wrap={false} align="space-between" blockAlign="center">
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                                <Badge tone={badgeTone}>{p.status}</Badge>
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

            {/* RIGHT — Data Entry */}
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
                          const selectOptions = [{ label: "— select —", value: "" }];
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
    </>
  );
}




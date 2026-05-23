import { useState, useEffect } from "react";
import { useLoaderData, useFetcher, data, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import { useAppBridge } from "@shopify/app-bridge-react";
import {
  Page, Card, Button, Box, Banner, Text, Badge, TextField, BlockStack,
  InlineStack, Grid, FormLayout, Thumbnail, Checkbox, Tag, Select, IndexTable, useIndexResourceState
} from "@shopify/polaris";
import { ImageIcon, ArrowLeftIcon } from "@shopify/polaris-icons";

// --- EXTERNAL IMPORTS ---
import { TARGET_KEYS, FIELD_LABELS, evaluateProductStatus, autoLinkStory } from "../utils/metaScan";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";
import DictationButton from "../components/DictationButton";

// --- CONSTANTS & HELPERS ---
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
  return `[FIELD: ${failingKey}] ${errors[0].message}`;
}

// --- SERVER LOADER ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const productsRes = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id title status
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
      const customMfs = Object.fromEntries((node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value]));
      const shopifyMfs = Object.fromEntries((node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value]));
      const rawMfs = { ...shopifyMfs, ...customMfs };

      const mfs = Object.fromEntries(
        Object.entries(rawMfs).map(([k, v]) => {
          let finalVal = unwrapListValue(String(v));
          const dictKey = k.replace(/_/g, "-");
          if (TAXONOMY_GIDS[dictKey]) {
            for (const [word, mappedGid] of Object.entries(TAXONOMY_GIDS[dictKey])) {
              if (finalVal.includes(String(mappedGid))) {
                finalVal = word;
                break;
              }
            }
          }
          return [k.replace(/-/g, "_"), finalVal];
        })
      );

      const { status } = evaluateProductStatus(mfs);

      return {
        id: node.id,
        title: node.title,
        image: node.featuredImage?.url || null,
        metafields: mfs,
        status,
      };
    });

    return data({ products, loaderError: null });
  } catch (error) {
    return data({ products: [], loaderError: error.message });
  }
};

// --- SERVER ACTION ---
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const ooakText = formData.get("ooakText") || "";
    const bulkStatus = formData.get("bulkStatus") || "";
    
    const metafields = [];
    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (updates[key] && updates[key].trim() !== "") {
          let finalValue = updates[key];
          if (key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);
          const formatted = formatMetafieldValue(key, finalValue);
          if (formatted) {
            metafields.push({ ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
          }
        }
      });
      if (ooakText && ooakText.trim() !== "") {
        const linkedStory = autoLinkStory(`✨ Unique Features: ${ooakText}`);
        const formatted = formatMetafieldValue("stone_story", linkedStory);
        if (formatted) {
          metafields.push({ ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
        }
      }
    });

    if (metafields.length === 0 && bulkStatus.trim() === "") {
      return data({ ok: false, error: "No data to save." });
    }

    if (metafields.length > 0) {
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        try {
          const res = await admin.graphql(`
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { userErrors { field message } }
            }
          `, { variables: { metafields: chunk } });
          const json = await res.json();
          const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
          if (errorMsg) return data({ ok: false, error: errorMsg });
        } catch (e) {
          return data({ ok: false, error: e.message });
        }
      }
    }

    if (bulkStatus && ["ACTIVE", "DRAFT", "ARCHIVED"].includes(bulkStatus.toUpperCase())) {
      for (const id of ids) {
        try {
          await admin.graphql(`
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) { userErrors { field message } }
            }
          `, { variables: { input: { id, status: bulkStatus.toUpperCase() } } });
        } catch (e) {
          console.error(`Failed to update status for ${id}:`, e.message);
        }
      }
    }

    return data({ ok: true });
  }

  return data({ ok: false });
};

// ==========================================
// VIEW COMPONENT
// ==========================================
export default function BulkEditRoute() {`n  const navigate = useNavigate();
  const { products, loaderError } = useLoaderData();
  const shopify = useAppBridge();

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(products);
  const [bulkStatus, setBulkStatus] = useState("");
  const [selectedFields, setSelectedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  
  const [vocabulary, setVocabulary] = useState({});
  const [showCustomInput, setShowCustomInput] = useState({});
  const [customInputs, setCustomInputs] = useState({});

  const saveFetcher = useFetcher();
  const vocabFetcher = useFetcher();
  const addCustomFetcher = useFetcher();

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
        const val = fieldValues[k] !== undefined ? fieldValues[k] : fd.get(`mf_${k}`);
        if (val && String(val).trim() !== "") updates[k] = String(val).trim();
      }
    });
    
    const submitData = new FormData();
    submitData.append("intent", "bulk_edit_new");
    submitData.append("ids", JSON.stringify(selectedResources));
    submitData.append("updates", JSON.stringify(updates));
    submitData.append("ooakText", fd.get("ooakText") || "");
    
    const finalBulkStatus = bulkStatus === "NO_CHANGE" ? "" : bulkStatus;
    submitData.append("bulkStatus", finalBulkStatus);
    
    saveFetcher.submit(submitData, { method: "post" });
  };

  const rowMarkup = products.map(({ id, title, status, image }, index) => {
    const cleanStatus = String(status || "").replace(/[^\w\s]/gi, '').trim().toLowerCase();
    const badgeTone = cleanStatus === "complete" ? "success" : cleanStatus === "partial" ? "warning" : "critical";
    
    return (
      <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
        <IndexTable.Cell>
          <Thumbnail source={image || ImageIcon} alt={title} size="small" />
        </IndexTable.Cell>
        <IndexTable.Cell><Text fontWeight="bold">{title}</Text></IndexTable.Cell>
        <IndexTable.Cell>
          <Box display={{xs: 'none', sm: 'block'}}>
            <Badge tone={badgeTone}>
              {status || "Unknown"}
            </Badge>
          </Box>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Bulk Edit Data" fullWidth>
      <BlockStack gap="600">`n        <Button icon={ArrowLeftIcon} onClick={() => navigate("/app")}>Back</Button>
        {loaderError && <Banner tone="critical">Loader error: {loaderError}</Banner>}
        {saveSuccess && <Banner tone="success">Bulk update saved to Shopify successfully.</Banner>}
        {saveError && <Banner tone="critical">Bulk save failed: {saveError}</Banner>}

        <form onSubmit={handleBulkSave}>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Apply Data Fields</Text>
                <Text tone="subdued">Check the fields you want to override and apply to all selected stones.</Text>
                
                <div style={{ maxHeight: "30vh", overflowY: "auto", padding: "4px" }}>
                  <FormLayout>
                    <Select
                      label="Set Product Status"
                      name="bulkStatus"
                      options={[
                        {label: 'No change', value: 'NO_CHANGE'},
                        {label: 'ACTIVE', value: 'ACTIVE'},
                        {label: 'DRAFT', value: 'DRAFT'},
                        {label: 'ARCHIVED', value: 'ARCHIVED'},
                      ]}
                      value={bulkStatus || 'NO_CHANGE'}
                      onChange={(val) => setBulkStatus(val === 'NO_CHANGE' ? '' : val)}
                    />
                    
                    <TextField label="OOAK Features (Appended to Story)" name="ooakText" autoComplete="off"/>
                    
                    <Box paddingBlockStart="200">
                      <Text variant="headingSm">Metafield Overrides</Text>
                    </Box>

                    {TARGET_KEYS.map(key => {
                      const isChecked = selectedFields[key] || false;
                      
                      return (
                        <BlockStack key={key} gap="200">
                          <Checkbox 
                            label={FIELD_LABELS[key] || key.replace(/_/g, " ").toUpperCase()}
                            checked={isChecked}
                            onChange={(newChecked) => handleFieldToggle(key, newChecked)}
                          />
                          {isChecked && (
                            <Box paddingInlineStart="400" paddingBlockEnd="200">
                              {(() => {
                                const placeholderText = `Enter new ${key.replace(/_/g, " ")}...`;

                                if (key === "stone_story") {
                                  return (
                                    <BlockStack gap="200">
                                      <TextField
                                        labelHidden
                                        label={key}
                                        name={`mf_${key}`}
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
                                    <BlockStack gap="200">
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
                                        labelHidden
                                        label={key}
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
                                }

                                return (
                                  <BlockStack gap="200">
                                    <TextField
                                      labelHidden
                                      label={key}
                                      name={`mf_${key}`}
                                      value={fieldValues[key] || ""}
                                      onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                                      autoComplete="off"
                                      placeholder={placeholderText}
                                      multiline={["bench_notes", "character_marks", "rock_composition"].includes(key) ? 4 : undefined}
                                    />
                                  </BlockStack>
                                );
                              })()}
                            </Box>
                          )}
                        </BlockStack>
                      );
                    })}
                  </FormLayout>
                </div>
                
                <Button submit variant="primary" loading={isSaving} disabled={selectedResources.length === 0}>
                  Apply Updates
                </Button>
              </BlockStack>
            </Card>

            <Card padding="0">
              <div style={{ height: "400px", overflowY: "auto" }}>
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
      </BlockStack>
    </Page>
  );
}




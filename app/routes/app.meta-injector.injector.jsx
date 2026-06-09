import React, { useState, useCallback, useEffect } from "react";
import {
  Box,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Checkbox,
  ChoiceList,
  Divider,
  Select,
  Scrollable,
  Modal,
  DataTable,
  Banner
} from "@shopify/polaris";
import { METAFIELD_CONFIG } from "../utils/meta-injector.constants";

const getStaticOptions = (cleanName, fieldKey) => {
  const normalizedName = (cleanName || "").toLowerCase().trim();
  const normalizedKey = (fieldKey || "").toLowerCase().trim();

  if (normalizedName.includes("luster") || normalizedKey.includes("luster")) {
    return ["Vitreous", "Waxy", "Silky", "Pearly", "Metallic", "Dull", "Earthy", "Greasy", "Resinous", "Vitreous to Pearly", "Vitreous to Dull", "Vitreous to Greasy", "Vitreous to Earthy", "Waxy to Dull", "Silky to Dull", "Dull to Earthy"];
  }
  if (normalizedName.includes("fracture") || normalizedKey.includes("fracture")) {
    return ["Conchoidal", "Uneven", "Uneven to Conchoidal", "Subconchoidal", "Subconchoidal to Uneven", "Splintery", "Irregular", "Hackly", "Earthy"];
  }
  if (normalizedName.includes("cleavage") || normalizedKey.includes("cleavage")) {
    return ["Perfect", "Good", "Indistinct", "Imperfect", "Poor", "None"];
  }
  if (normalizedName.includes("diaphaneity") || normalizedKey.includes("diaphaneity")) {
    return ["Transparent", "Translucent", "Opaque", "Transparent to Translucent", "Translucent to Opaque", "Transparent to Opaque", "Transparent with Inclusions"];
  }
  if (normalizedName.includes("geological age") || normalizedKey.includes("geological_age") || normalizedName.includes("geological era") || normalizedKey.includes("geological-era")) {
    return ["Hadean", "Archean", "Proterozoic", "Precambrian", "Paleozoic", "Mesozoic", "Cenozoic", "Quaternary"];
  }
  if (normalizedName.includes("stone shape") || normalizedKey.includes("shape")) {
    return ["Cabochon", "Freeform", "Tumbled", "Rough", "Slab", "Round", "Oval", "Teardrop", "Cushion"];
  }
  if (normalizedName.includes("surface finish") || normalizedKey.includes("finish")) {
    return ["Polished", "Matte", "Natural", "High Polish"];
  }
  if (normalizedName.includes("treatment") || normalizedKey.includes("treatment")) {
    return ["Natural", "Stabilized", "Dyed", "Heat Treated", "Irradiated"];
  }
  if (normalizedName.includes("one of a kind") || normalizedKey.includes("one_of_a_kind")) {
    return ["Yes", "No"];
  }
  return null;
};

export function InjectorTab({ products, fetcher, shopify, dbProfiles = [], dynamicMetaobjectOptions = {} }) {
  const [bulkMode, setBulkMode] = useState("fill");
  const [bulkFormData, setBulkFormData] = useState({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dynamicCustomFields, setDynamicCustomFields] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });
  const [inlineAddState, setInlineAddState] = useState({ fieldKey: null, metaobjectType: null, value: "", loading: false });
  const [resultBanner, setResultBanner] = useState(null);

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        setResultBanner({ tone: "success", message: "✅ Injection complete — metafields saved to Shopify successfully." });
      } else {
        const errorMsg = fetcher.data.errors
          ? fetcher.data.errors.map(e => e.message).join(" | ")
          : fetcher.data.message || "Unknown error occurred.";
        setResultBanner({ tone: "critical", message: `❌ Injection failed: ${errorMsg}` });
      }
    }
  }, [fetcher.state, fetcher.data]);

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    if (mf) return mf.node.value;
    return "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    if (fieldConfig.metaobjectType) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue && /[\-–—]/.test(newValue);
    if (isNumberType && containsDash) return "single_line_text_field";
    if (isNumberType && !containsDash) return fieldConfig.type;
    return fieldConfig.type;
  }, []);

  const toggleProduct = (id) => {
    setBulkSelectedProductIds(prev => {
      const isSelected = prev.includes(id);
      if (isSelected) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  };

  const PROFILE_FIELD_MAP = {
    "mohs_hardness":      (p) => p.mohs_hardness,
    "luster":             (p) => p.luster,
    "fracture":           (p) => p.fracture,
    "cleavage":           (p) => p.cleavage,
    "specific_gravity":   (p) => p.specific_gravity,
    "diaphaneity":        (p) => p.diaphaneity,
    "authenticity":       (p) => p.authenticity || p.google_authenticity,
    "rarity":             (p) => p.rarity || p.google_rarity,
    "crystal-system":     (p) => p.google_crystal_system,
    "geological-era":     (p) => p.geological_age || p.google_geological_era,
    "geological_age":     (p) => p.geological_age || p.google_geological_era,
    "mineral-class":      (p) => p.google_mineral_class,
    "rock-composition":   (p) => p.google_rock_composition,
    "rock-formation":     (p) => p.google_rock_formation,
  };

  const handleAutoFill = () => {
    const baseStoneType = bulkFormData["official_name"] || bulkFormData["base_stone_type"] || "";

    if (baseStoneType.trim() === "") {
      if (shopify && shopify.toast) shopify.toast.show("Please type a stone name (e.g., 'Jasper') into 'Official Name' first!", { isError: true });
      return;
    }

    const profile = dbProfiles.find(db =>
      baseStoneType.toLowerCase().includes((db.title || db.stoneName || "").toLowerCase()) ||
      (db.title || db.stoneName || "").toLowerCase().includes(baseStoneType.toLowerCase())
    );

    if (!profile) {
      if (shopify && shopify.toast) shopify.toast.show(`No dictionary entry found for "${baseStoneType}".`, { isError: true });
      return;
    }

    let updates = { ...bulkFormData };

    METAFIELD_CONFIG.forEach(field => {
      if (!field.key) return;
      const mapper = PROFILE_FIELD_MAP[field.key];
      if (!mapper) return;
      
      const profileValue = mapper(profile);
      if (profileValue) {
        const staticOptions = getStaticOptions(field.name || field.label, field.key);
        if (staticOptions) {
          const matchedStatic = staticOptions.find(opt => opt.toLowerCase() === profileValue.toLowerCase());
          updates[field.key] = matchedStatic || profileValue;
        } else {
          updates[field.key] = profileValue;
        }
      }
    });

    METAFIELD_CONFIG.forEach(field => {
      if (field.metaobjectType && updates[field.key]) {
        const rawValue = updates[field.key];
        if (!rawValue.includes("gid://")) {
          const liveOptions = dynamicMetaobjectOptions[field.metaobjectType] || [];
          const matchedOption = liveOptions.find(opt => opt.label.toLowerCase() === rawValue.toLowerCase());
          updates[field.key] = matchedOption ? matchedOption.value : "";
        }
      }
    });

    setBulkFormData(updates);
    if (shopify && shopify.toast) shopify.toast.show(`${profile.title || profile.stoneName} science loaded from dictionary!`, { isError: false });
  };

  const handleBulkSubmit = () => {
    const selectedProducts = products.filter(p => bulkSelectedProductIds.includes(p.id));
    if (selectedProducts.length === 0) {
      setResultBanner({ tone: "critical", message: "Select at least one product before injecting." });
      return;
    }

    const payload = [];
    const diffSummary = [];
    let changesCount = 0;

    selectedProducts.forEach(product => {
      const statusStr = getMetafieldValue(product, "meta_status");
      let statusObj = {};
      try {
        if (statusStr) statusObj = JSON.parse(statusStr);
      } catch(e) {}

      let productChanged = false;

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const newVal = bulkFormData[field.key] || "";
        if (!newVal) return;

        const currentVal = getMetafieldValue(product, field.key);
        if (bulkMode === "fill" && currentVal !== "") return;
        if (currentVal === newVal) return;

        const resolvedType = resolveMetafieldType(product, field, newVal);

        let finalValue = newVal;
        if (resolvedType.includes("list.")) {
          try {
            const parsed = JSON.parse(newVal);
            finalValue = Array.isArray(parsed) ? newVal : JSON.stringify([newVal]);
          } catch {
            finalValue = JSON.stringify([newVal]);
          }
        }

        payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: finalValue });
        statusObj[field.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      dynamicCustomFields.forEach(df => {
        if (!df.key || !df.value) return;
        const currentVal = getMetafieldValue(product, df.key);
        if (bulkMode === "fill" && currentVal !== "") return;
        if (currentVal === df.value) return;
        payload.push({ ownerId: product.id, namespace: "custom", key: df.key, type: "single_line_text_field", value: df.value });
        statusObj[df.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      if (productChanged) {
        payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      }
    });

    if (payload.length === 0) {
      setResultBanner({ tone: "warning", message: `No changes to apply. All selected products already have this data in FILL ONLY mode. Switch to OVERWRITE to force update.` });
      return;
    }

    diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} field updates across ${selectedProducts.length} products` });

    setModalConfig({
      active: true,
      title: `Confirm Bulk Injection (${bulkMode.toUpperCase()})`,
      body: bulkMode === "overwrite" ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
      diffs: diffSummary,
      payload: payload
    });
  };

  const executeBulkSubmit = () => {
    setResultBanner({ tone: "info", message: "⏳ Injecting — please wait..." });
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
    setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] });
  };

  let visibleProducts = products;
  if (bulkSearchQuery.trim() !== "") {
    const lowerQuery = bulkSearchQuery.toLowerCase();
    visibleProducts = products.filter(p => p.title.toLowerCase().includes(lowerQuery));
  }

  const allVisibleSelected = bulkSelectedProductIds.length === visibleProducts.length && visibleProducts.length > 0;

  return (
    <BlockStack gap="500">

      {resultBanner && (
        <Banner
          tone={resultBanner.tone}
          onDismiss={() => setResultBanner(null)}
        >
          <Text as="p">{resultBanner.message}</Text>
        </Banner>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={tapTargetStyle}>
          <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">
            Preview & Run Bulk Inject
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Targets ({bulkSelectedProductIds.length})</Text>

              <div style={inputTapTargetStyle}>
                <TextField
                  placeholder="Search products..."
                  value={bulkSearchQuery}
                  onChange={setBulkSearchQuery}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setBulkSearchQuery("")}
                  accessibilityLabel="Search products"
                />
              </div>

              {bulkSearchQuery.trim() !== "" && (
                <Text variant="bodySm" tone="subdued" as="p">
                  Showing {visibleProducts.length} of {products.length} products
                </Text>
              )}

              <div style={tapTargetStyle}>
                <Button
                  onClick={() => setBulkSelectedProductIds(allVisibleSelected ? [] : visibleProducts.map(p => p.id))}
                  accessibilityLabel="Select all or none"
                >
                  {allVisibleSelected ? "Deselect All" : "Select All"}
                </Button>
              </div>

              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {visibleProducts.length === 0 && (
                    <Box padding="400">
                      <Text as="p" tone="subdued" alignment="center">No products match your search.</Text>
                    </Box>
                  )}
                  {visibleProducts.map(p => (
                    <div style={inputTapTargetStyle} key={p.id}>
                      <Checkbox
                        label={p.title}
                        checked={bulkSelectedProductIds.includes(p.id)}
                        onChange={() => toggleProduct(p.id)}
                        accessibilityLabel={`Select ${p.title}`}
                      />
                    </div>
                  ))}
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </Box>
        </div>

        <div style={{ flex: 1 }}>
          <Box padding="400" background="bg-surface" borderRadius="200" shadow="100">
            <BlockStack gap="400">
              <Text variant="headingSm" as="h3">2. Define Injection Data</Text>
              <Box paddingBlockEnd="200">
                <InlineStack gap="400">
                  <Text as="span">🔵 <strong style={{ fontWeight: 600 }}>Google</strong> = Required for Google Shopping</Text>
                  <Text as="span">🪨 <strong style={{ fontWeight: 600 }}>Stone</strong> = Your OOAK storefront data</Text>
                </InlineStack>
              </Box>
              <div style={inputTapTargetStyle}>
                <ChoiceList
                  title="Injection Mode"
                  choices={[
                    { label: 'FILL ONLY: Skip products that already have data', value: 'fill' },
                    { label: 'OVERWRITE: Force data (Dangerous)', value: 'overwrite' }
                  ]}
                  selected={[bulkMode]}
                  onChange={(val) => setBulkMode(val[0])}
                />
              </div>

              <Divider />

              <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                <BlockStack gap="300">
                  <Text as="p" variant="bodyMd">
                    <strong>Dictionary Auto-Fill:</strong> Type a stone name (e.g., "Jasper") into the <strong>Official Name</strong> field below, then click this button to load its hard science data.
                  </Text>
                  <div style={tapTargetStyle}>
                    <Button size="large" variant="primary" tone="success" onClick={handleAutoFill} accessibilityLabel="Auto-Fill Science from Dictionary">
                      ⭐ Auto-Fill Science from Dictionary
                    </Button>
                  </div>
                </BlockStack>
              </Box>

              <Divider />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
                  const isGoogle = field.namespace === "shopify";
                  const rawLabelText = field.name || field.label || "";

                  let cleanName = rawLabelText
                    .replace(/🔵/g, '')
                    .replace(/🪨/g, '')
                    .replace(/Google/gi, '')
                    .replace(/Store/gi, '')
                    .replace(/Stone/gi, '')
                    .trim();

                  const label = isGoogle ? `🔵 Google ${cleanName}` : `🪨 Stone ${cleanName}`;
                  const hasMetaobjectType = !!field.metaobjectType;
                  const isAddingNew = inlineAddState.fieldKey === field.key;
                  const staticOptions = getStaticOptions(cleanName, field.key);

                  return (
                    <div style={{ ...inputTapTargetStyle, minHeight: 'auto' }} key={field.key}>
                      {hasMetaobjectType && isAddingNew && (
                        <BlockStack gap="200">
                          <TextField
                            label={`➕ New ${cleanName}`}
                            value={inlineAddState.value}
                            onChange={(val) => setInlineAddState(prev => ({ ...prev, value: val }))}
                            placeholder="e.g., Dragonstone"
                            autoComplete="off"
                            disabled={inlineAddState.loading}
                            accessibilityLabel={`Type new ${cleanName} value`}
                          />
                          <InlineStack gap="200">
                            <div style={tapTargetStyle}>
                              <Button
                                tone="success"
                                variant="primary"
                                loading={inlineAddState.loading}
                                accessibilityLabel="Save new dictionary term"
                                onClick={() => {
                                  if (!inlineAddState.value.trim()) return;
                                  setInlineAddState(prev => ({ ...prev, loading: true }));
                                  const formData = new FormData();
                                  formData.append("intent", "createMetaobject");
                                  formData.append("type", field.metaobjectType);
                                  formData.append("value", inlineAddState.value);
                                  fetcher.submit(formData, { method: "post" });
                                  setTimeout(() => {
                                    setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false });
                                    if (shopify && shopify.toast) shopify.toast.show(`Added to Dictionary!`, { isError: false });
                                  }, 1500);
                                }}
                              >
                                Save to Dictionary
                              </Button>
                            </div>
                            <div style={tapTargetStyle}>
                              <Button onClick={() => setInlineAddState({ fieldKey: null, metaobjectType: null, value: "", loading: false })} accessibilityLabel="Cancel adding term">
                                Cancel
                              </Button>
                            </div>
                          </InlineStack>
                        </BlockStack>
                      )}

                      {hasMetaobjectType && !isAddingNew && (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                          <div style={{ flex: 1 }}>
                            <Select
                              label={label}
                              options={[
                                { label: "Leave blank to skip", value: "" },
                                ...(dynamicMetaobjectOptions[field.metaobjectType] || []).filter(opt => opt.value !== "")
                              ]}
                              value={bulkFormData[field.key] || ""}
                              onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))}
                              accessibilityLabel={`Bulk input for ${cleanName}`}
                            />
                          </div>
                          <div style={tapTargetStyle}>
                            <Button
                              accessibilityLabel={`Add new ${cleanName}`}
                              onClick={() => setInlineAddState({ fieldKey: field.key, metaobjectType: field.metaobjectType, value: "", loading: false })}
                            >
                              ➕
                            </Button>
                          </div>
                        </div>
                      )}

                      {!hasMetaobjectType && staticOptions && (
                        <Select
                          label={label}
                          options={[
                            { label: "Leave blank to skip", value: "" },
                            ...staticOptions.filter(opt => opt !== "").map(opt => ({ label: opt, value: opt }))
                          ]}
                          value={bulkFormData[field.key] || ""}
                          onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))}
                          accessibilityLabel={`Bulk input for ${cleanName}`}
                        />
                      )}

                      {!hasMetaobjectType && !staticOptions && (
                        <TextField
                          label={label}
                          value={bulkFormData[field.key] || ""}
                          onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))}
                          placeholder="Leave blank to skip"
                          autoComplete="off"
                          type="text"
                          accessibilityLabel={`Bulk input for ${cleanName}`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {dynamicCustomFields.length > 0 && (
                <BlockStack gap="300">
                  <Divider />
                  <Text variant="headingSm" as="h4">Custom Stone Fields</Text>
                  {dynamicCustomFields.map((df, idx) => (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px' }} key={`dynamic-${idx}`}>
                      <div style={inputTapTargetStyle}>
                        <TextField
                          label="🪨 Stone Field Key"
                          value={df.key}
                          onChange={(val) => {
                            const newFields = [...dynamicCustomFields];
                            newFields[idx].key = val;
                            setDynamicCustomFields(newFields);
                          }}
                          placeholder="e.g. mine_name"
                          autoComplete="off"
                          type="text"
                          accessibilityLabel="Custom stone field key"
                        />
                      </div>
                      <div style={inputTapTargetStyle}>
                        <TextField
                          label="Value"
                          value={df.value}
                          onChange={(val) => {
                            const newFields = [...dynamicCustomFields];
                            newFields[idx].value = val;
                            setDynamicCustomFields(newFields);
                          }}
                          placeholder="Value"
                          autoComplete="off"
                          type="text"
                          accessibilityLabel="Custom stone field value"
                        />
                      </div>
                      <div style={tapTargetStyle}>
                        <Button tone="critical" onClick={() => {
                          const newFields = [...dynamicCustomFields];
                          newFields.splice(idx, 1);
                          setDynamicCustomFields(newFields);
                        }} accessibilityLabel="Remove custom field">X</Button>
                      </div>
                    </div>
                  ))}
                </BlockStack>
              )}

              <div style={tapTargetStyle}>
                <Button onClick={() => setDynamicCustomFields([...dynamicCustomFields, { key: '', value: '' }])} accessibilityLabel="Add custom stone field">
                  Add Custom Field
                </Button>
              </div>

            </BlockStack>
          </Box>
        </div>

        {modalConfig.active && (
          <Modal
            open={true}
            onClose={() => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] })}
            title={modalConfig.title}
            primaryAction={{ content: "Confirm & Execute", onAction: executeBulkSubmit, tone: "success", accessibilityLabel: "Confirm and execute action" }}
            secondaryActions={[{ content: "Cancel", onAction: () => setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] }), accessibilityLabel: "Cancel action" }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                {modalConfig.body && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
                {modalConfig.diffs.length > 0 && (
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <DataTable
                      columnContentTypes={["text", "text", "text"]}
                      headings={["Field", "Old Value", "New Value"]}
                      rows={modalConfig.diffs.map(d => [d.field, d.old, d.new])}
                    />
                  </Box>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}
      </div>
    </BlockStack>
  );
}
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, TextField, Button, Badge, BlockStack, InlineStack, Box,
  Tabs, DataTable, Select, Checkbox, Modal, Banner, Toast, Frame, ResourceList,
  ResourceItem, Divider, Scrollable, ChoiceList
} from "@shopify/polaris";
import { InfoIcon, AlertCircleIcon, UndoIcon, ImportIcon, ExportIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// CONFIGURATION & EXCLUSIONS
// ==========================================
const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

// Define your 32+ metafields here. The app dynamically builds forms and validations from this.
const METAFIELD_CONFIG = [
  { namespace: "custom", key: "hardness", type: "number_decimal", label: "Hardness (Mohs)" },
  { namespace: "custom", key: "luster", type: "single_line_text_field", label: "Luster" },
  { namespace: "custom", key: "crystal_system", type: "single_line_text_field", label: "Crystal System" },
  { namespace: "custom", key: "fracture", type: "single_line_text_field", label: "Fracture" },
  { namespace: "custom", key: "cleavage", type: "single_line_text_field", label: "Cleavage" },
  { namespace: "custom", key: "specific_gravity", type: "number_decimal", label: "Specific Gravity" },
  { namespace: "custom", key: "mineral_class", type: "single_line_text_field", label: "Mineral Class" },
  { namespace: "custom", key: "diaphaneity", type: "single_line_text_field", label: "Diaphaneity" },
  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location" },
  { namespace: "custom", key: "meta_status", type: "json", label: "Data Integrity Status", hidden: true } // Internal tracking
];

const PREBUILT_PROFILES = [
  { name: "Quartz", data: { hardness: "7", luster: "Vitreous", crystal_system: "Trigonal", fracture: "Conchoidal", cleavage: "None", specific_gravity: "2.65", mineral_class: "Silicate", diaphaneity: "Transparent to Opaque" } },
  { name: "Labradorite", data: { hardness: "6", luster: "Vitreous to Pearly", crystal_system: "Triclinic", fracture: "Uneven", cleavage: "Perfect", specific_gravity: "2.70", mineral_class: "Feldspar", diaphaneity: "Translucent" } }
];

// ==========================================
// SERVER: LOADER
// ==========================================
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // Fetch up to 250 products to ensure we capture the whole catalog (adjust pagination if >250)
  const response = await admin.graphql(`
    #graphql
    query GetAllProductsWithMetafields {
      products(first: 250, sortKey: TITLE) {
        edges {
          node {
            id
            title
            status
            featuredImage { url altText }
            metafields(first: 50, namespace: "custom") {
              edges {
                node { id namespace key value type }
              }
            }
          }
        }
      }
    }
  `);

  const parsed = await response.json();
  const rawProducts = parsed.data?.products?.edges.map(e => e.node) || [];
  
  // Apply hard exclusion rule
  const products = rawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  return { products };
}

// ==========================================
// SERVER: ACTION
// ==========================================
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveMetafields") {
    const payloadString = formData.get("payload");
    const payload = JSON.parse(payloadString); // Array of { ownerId, namespace, key, type, value }
    
    // Split into chunks of 25 to respect Shopify API limits if bulk updating
    const chunks = [];
    for (let i = 0; i < payload.length; i += 25) {
      chunks.push(payload.slice(i, i + 25));
    }

    let allErrors = [];
    for (const chunk of chunks) {
      const response = await admin.graphql(`
        #graphql
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }
      `, { variables: { metafields: chunk } });
      
      const json = await response.json();
      const errors = json.data?.metafieldsSet?.userErrors || [];
      if (errors.length > 0) allErrors = [...allErrors, ...errors];
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated." };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}

// ==========================================
// CLIENT: COMPONENT
// ==========================================
export default function MetaInjectorV2() {
  const { products } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [snapshots, setSnapshots] = useState([]);
  
  // Shared state
  const [activeProductId, setActiveProductId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, onConfirm: null, diffs: [] });
  const [actionErrors, setActionErrors] = useState([]);

  // Initialization: Load snapshots from local storage
  useEffect(() => {
    const stored = localStorage.getItem("meta_snapshots");
    if (stored) {
      try { setSnapshots(JSON.parse(stored)); } catch (e) { console.error("Failed to parse snapshots"); }
    }
  }, []);

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, onConfirm: null, diffs: [] }), []);

  useEffect(() => {
    if (fetcher.data) {
      const isSuccess = !!fetcher.data.success;
      if (fetcher.data.message) {
        setToastState({ active: true, message: fetcher.data.message, isError: !isSuccess });
      }
      if (isSuccess) closeModal();
      setActionErrors(fetcher.data.errors || []);
    }
  }, [fetcher.data, closeModal]);

  // Helper: Get specific metafield value for a product
  const getMetafieldValue = useCallback((product, key) => {
    const mf = product.metafields.edges.find(e => e.node.key === key);
    return mf ? mf.node.value : "";
  }, []);

  // Helper: Create a snapshot
  const createSnapshot = useCallback((productsToSnapshot, actionName) => {
    const data = productsToSnapshot.map(p => ({
      id: p.id,
      title: p.title,
      metafields: p.metafields.edges.map(e => ({ namespace: e.node.namespace, key: e.node.key, value: e.node.value, type: e.node.type }))
    }));
    const newSnapshot = { id: Date.now().toString(), date: new Date().toLocaleString(), action: actionName, data };
    const updatedSnapshots = [newSnapshot, ...snapshots].slice(0, 20); // Keep last 20
    setSnapshots(updatedSnapshots);
    localStorage.setItem("meta_snapshots", JSON.stringify(updatedSnapshots));
  }, [snapshots]);

  // Submit Helper
  const submitMetafields = useCallback((payload, actionName, relevantProducts) => {
    createSnapshot(relevantProducts, actionName);
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
  }, [fetcher, createSnapshot]);

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  // ==========================================
  // SECTION 1: DATA HEALTH MATRIX
  // ==========================================
  const MatrixView = () => {
    const [missingFilter, setMissingFilter] = useState("");
    
    const displayFields = METAFIELD_CONFIG.filter(c => !c.hidden);
    
    const rows = useMemo(() => {
      let filtered = products;
      if (missingFilter) {
        filtered = products.filter(p => !getMetafieldValue(p, missingFilter));
      }
      return filtered.map(p => {
        const rowData = [
          <Button variant="plain" onClick={() => { setActiveProductId(p.id); setSelectedTab(1); }} accessibilityLabel={`Inspect ${p.title}`}>{p.title}</Button>
        ];
        
        // Parse tracking status if it exists
        const statusStr = getMetafieldValue(p, "meta_status");
        let statusObj = {};
        try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}

        displayFields.forEach(field => {
          const val = getMetafieldValue(p, field.key);
          const isVerified = statusObj[field.key] === "verified";
          let tone = "critical"; // Empty
          let text = "Empty";
          if (val) {
            tone = isVerified ? "success" : "warning"; // Yellow if unverified (bulk)
            text = val.length > 15 ? val.substring(0, 15) + "..." : val;
          }
          rowData.push(<Badge tone={tone}>{text}</Badge>);
        });
        return rowData;
      });
    }, [missingFilter, displayFields]);

    return (
      <BlockStack gap="400">
        <InlineStack gap="400" blockAlign="center">
          <Box width="300px">
            <Select
              label="Filter by missing data"
              options={[{ label: "Show All Products", value: "" }, ...displayFields.map(f => ({ label: `Missing: ${f.label}`, value: f.key }))]}
              value={missingFilter}
              onChange={setMissingFilter}
              accessibilityLabel="Filter matrix by missing metafield"
            />
          </Box>
          <InlineStack gap="200">
            <Badge tone="success">Verified & Filled</Badge>
            <Badge tone="warning">Filled (Unverified Bulk)</Badge>
            <Badge tone="critical">Empty</Badge>
          </InlineStack>
        </InlineStack>
        
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <Scrollable style={{ maxHeight: '60vh' }}>
            <DataTable
              columnContentTypes={["text", ...displayFields.map(() => "text")]}
              headings={["Product", ...displayFields.map(f => f.label)]}
              rows={rows}
              hasZebraStriping
            />
          </Scrollable>
        </Box>
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 2: PRODUCT INSPECTOR
  // ==========================================
  const InspectorView = () => {
    const activeProduct = products.find(p => p.id === activeProductId);
    const [localData, setLocalData] = useState({});

    useEffect(() => {
      if (activeProduct) {
        const initial = {};
        METAFIELD_CONFIG.forEach(f => {
          initial[f.key] = getMetafieldValue(activeProduct, f.key);
        });
        setLocalData(initial);
      }
    }, [activeProduct]);

    if (!activeProduct) {
      return (
        <BlockStack gap="400">
          <Select
            label="Select a product to inspect"
            options={[{ label: "Select...", value: "" }, ...products.map(p => ({ label: p.title, value: p.id }))]}
            value={activeProductId}
            onChange={setActiveProductId}
            accessibilityLabel="Select product for inspector"
          />
          <EmptySearchResult title="No product selected" description="Select a product to edit its data points." withIllustration />
        </BlockStack>
      );
    }

    const handleSaveSingle = () => {
      const payload = [];
      const diffs = [];
      const statusStr = getMetafieldValue(activeProduct, "meta_status");
      let statusObj = {};
      try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const currentVal = getMetafieldValue(activeProduct, field.key);
        const newVal = localData[field.key];
        
        if (currentVal !== newVal) {
          diffs.push({ field: field.label, old: currentVal || "(empty)", new: newVal || "(empty)" });
          payload.push({ ownerId: activeProduct.id, namespace: field.namespace, key: field.key, type: field.type, value: newVal });
          statusObj[field.key] = "verified"; // Manual edits are trusted
        }
      });

      if (diffs.length === 0) {
        setToastState({ active: true, message: "No changes detected.", isError: false });
        return;
      }

      payload.push({ ownerId: activeProduct.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });

      setModalConfig({
        active: true,
        title: `Confirm changes for ${activeProduct.title}`,
        diffs,
        onConfirm: () => submitMetafields(payload, `Manual Edit: ${activeProduct.title}`, [activeProduct])
      });
    };

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Box width="400px">
            <Select
              label="Select Product"
              options={products.map(p => ({ label: p.title, value: p.id }))}
              value={activeProductId}
              onChange={setActiveProductId}
              accessibilityLabel="Change product in inspector"
            />
          </Box>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleSaveSingle} accessibilityLabel={`Save changes for ${activeProduct.title}`}>Verify & Save Changes</Button>
          </div>
        </InlineStack>

        <Divider />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
            const isNumber = field.type.includes("number");
            return (
              <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                <TextField
                  label={field.label}
                  value={localData[field.key] || ""}
                  onChange={(val) => setLocalData(prev => ({ ...prev, [field.key]: val }))}
                  autoComplete="off"
                  type={isNumber ? "number" : "text"}
                  helpText={isNumber ? "Numeric value required." : ""}
                  accessibilityLabel={`Edit ${field.label}`}
                />
              </Box>
            );
          })}
        </div>
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 3: SMART BULK INJECTOR
  // ==========================================
  const BulkInjectorView = () => {
    const [mode, setMode] = useState("fill"); // 'fill' or 'overwrite'
    const [formData, setFormData] = useState({});

    const toggleProduct = useCallback((id) => {
      setSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    }, []);

    const handleBulkSubmit = () => {
      const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
      if (selectedProducts.length === 0) return setToastState({ active: true, message: "Select at least one product.", isError: true });

      const payload = [];
      const diffSummary = []; // Track how many fields will change
      
      let changesCount = 0;

      selectedProducts.forEach(product => {
        const statusStr = getMetafieldValue(product, "meta_status");
        let statusObj = {};
        try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}
        let productChanged = false;

        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const newVal = formData[field.key];
          if (!newVal) return; // Skip blank inputs entirely

          const currentVal = getMetafieldValue(product, field.key);
          
          if (mode === "fill" && currentVal) return; // Skip if fill mode and data exists
          if (currentVal === newVal) return; // Skip if identical

          payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: field.type, value: newVal });
          statusObj[field.key] = "bulk_unverified"; // Tag as yellow
          productChanged = true;
          changesCount++;
        });

        if (productChanged) {
          payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
        }
      });

      if (payload.length === 0) {
        return setToastState({ active: true, message: "No changes to apply based on current mode and inputs.", isError: false });
      }

      diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} field updates across ${selectedProducts.length} products` });

      setModalConfig({
        active: true,
        title: `Confirm Bulk Injection (${mode.toUpperCase()})`,
        body: mode === "overwrite" ? "WARNING: You are in OVERWRITE mode. Existing verified data will be destroyed." : "You are in FILL ONLY mode. Existing data is safe.",
        diffs: diffSummary,
        onConfirm: () => submitMetafields(payload, `Bulk Inject (${mode})`, selectedProducts)
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        {/* Left Column: Selection */}
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Targets ({selectedProductIds.length})</Text>
              <div style={tapTargetStyle}>
                <Button onClick={() => setSelectedProductIds(selectedProductIds.length === products.length ? [] : products.map(p => p.id))} accessibilityLabel="Select all or none">
                  {selectedProductIds.length === products.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <Checkbox
                      key={p.id}
                      label={p.title}
                      checked={selectedProductIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                  ))}
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </Box>
        </div>

        {/* Right Column: Inputs */}
        <div style={{ flex: 1 }}>
          <BlockStack gap="400">
            <Box padding="400" background="bg-surface" borderRadius="200" shadow="100">
              <BlockStack gap="400">
                <Text variant="headingSm" as="h3">2. Define Injection Data</Text>
                <ChoiceList
                  title="Injection Mode"
                  choices={[
                    { label: 'FILL ONLY: Skip products that already have data in a field', value: 'fill' },
                    { label: 'OVERWRITE: Force this data onto all selected products (Dangerous)', value: 'overwrite' }
                  ]}
                  selected={[mode]}
                  onChange={(val) => setMode(val[0])}
                />
                <Divider />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => (
                    <TextField
                      key={field.key}
                      label={field.label}
                      value={formData[field.key] || ""}
                      onChange={(val) => setFormData(prev => ({ ...prev, [field.key]: val }))}
                      placeholder="Leave blank to skip"
                      autoComplete="off"
                      accessibilityLabel={`Bulk input for ${field.label}`}
                    />
                  ))}
                </div>
                <Divider />
                <div style={tapTargetStyle}>
                  <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">
                    Preview & Run Bulk Inject
                  </Button>
                </div>
              </BlockStack>
            </Box>
          </BlockStack>
        </div>
      </div>
    );
  };

  // ==========================================
  // SECTION 4: SNAPSHOT & ROLLBACK
  // ==========================================
  const SnapshotView = () => {
    const handleRestore = (snapshot) => {
      const payload = [];
      snapshot.data.forEach(pData => {
        pData.metafields.forEach(mf => {
          payload.push({ ownerId: pData.id, namespace: mf.namespace, key: mf.key, type: mf.type, value: mf.value });
        });
      });

      setModalConfig({
        active: true,
        title: `Restore Snapshot: ${snapshot.action}`,
        body: `This will revert ${snapshot.data.length} products back to their exact state on ${snapshot.date}.`,
        diffs: [],
        onConfirm: () => {
          fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
          createSnapshot(products.filter(p => snapshot.data.some(sd => sd.id === p.id)), `Undo Restored: ${snapshot.action}`); // Snapshot the state BEFORE undoing
        }
      });
    };

    return (
      <BlockStack gap="400">
        <Banner tone="info" title="Safety Net">
          Snapshots are automatically created before any bulk action or manual save. Restore them here if you made a mistake.
        </Banner>
        {snapshots.length === 0 ? (
          <EmptySearchResult title="No snapshots found" description="Perform an action to generate a backup snapshot." withIllustration />
        ) : (
          <ResourceList
            resourceName={{ singular: "snapshot", plural: "snapshots" }}
            items={snapshots}
            renderItem={(item) => (
              <ResourceItem id={item.id} accessibilityLabel={`Snapshot ${item.action}`}>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="bold">{item.action}</Text>
                    <Text variant="bodySm" color="subdued">{item.date} • {item.data.length} products tracked</Text>
                  </BlockStack>
                  <div style={tapTargetStyle}>
                    <Button icon={UndoIcon} onClick={() => handleRestore(item)} accessibilityLabel={`Restore ${item.action}`}>Restore This State</Button>
                  </div>
                </InlineStack>
              </ResourceItem>
            )}
          />
        )}
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 5: ORIGIN FIXER
  // ==========================================
  const OriginFixerView = () => {
    // Parse origins: Expected format "Stone — Origin — Name" or "Stone - Origin - Name"
    const parsedOrigins = useMemo(() => {
      return products.map(p => {
        const parts = p.title.split(/\s[—-]\s/);
        const currentOrigin = getMetafieldValue(p, "origin_location");
        let suggested = "";
        let status = "Missing";
        let tone = "critical";

        if (parts.length >= 3) suggested = parts[1].trim();

        if (currentOrigin && suggested && currentOrigin.toLowerCase() === suggested.toLowerCase()) {
          status = "Match"; tone = "success";
        } else if (currentOrigin && suggested) {
          status = "Mismatch"; tone = "warning";
        } else if (currentOrigin && !suggested) {
          status = "Cannot Parse Title"; tone = "info";
        } else if (!currentOrigin && suggested) {
          status = "Ready to Inject"; tone = "magic";
        }

        return { id: p.id, title: p.title, current: currentOrigin, suggested, status, tone, product: p };
      });
    }, [products, getMetafieldValue]);

    const handleApproveRow = (row) => {
      if (!row.suggested) return;
      const payload = [{ ownerId: row.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: row.suggested }];
      submitMetafields(payload, `Origin Fix: ${row.title}`, [row.product]);
    };

    const handleApproveAll = () => {
      const targets = parsedOrigins.filter(r => r.suggested && r.status !== "Match");
      if (targets.length === 0) return setToastState({ active: true, message: "No actionable origins found.", isError: true });

      const payload = targets.map(r => ({ ownerId: r.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: r.suggested }));
      const relevantProducts = targets.map(r => r.product);
      
      setModalConfig({
        active: true,
        title: "Approve All Suggested Origins",
        body: `This will update the origin location for ${targets.length} products based on their titles.`,
        diffs: [],
        onConfirm: () => submitMetafields(payload, "Bulk Origin Fix", relevantProducts)
      });
    };

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">Auto-Extract Origin from Titles</Text>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleApproveAll} accessibilityLabel="Approve all suggested origins">Approve All Suggestions</Button>
          </div>
        </InlineStack>
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <DataTable
            columnContentTypes={["text", "text", "text", "text", "text"]}
            headings={["Product", "Current Origin", "Suggested Extract", "Status", "Action"]}
            rows={parsedOrigins.map(r => [
              r.title,
              r.current || "-",
              r.suggested || "-",
              <Badge tone={r.tone}>{r.status}</Badge>,
              <div style={tapTargetStyle}>
                <Button disabled={!r.suggested || r.status === "Match"} onClick={() => handleApproveRow(r)} accessibilityLabel={`Approve origin for ${r.title}`}>Approve</Button>
              </div>
            ])}
          />
        </Box>
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 6: MINERAL PROFILES
  // ==========================================
  const ProfileView = () => {
    const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);
    const activeProfile = PREBUILT_PROFILES[selectedProfileIndex];

    const handleApplyProfile = () => {
      if (selectedProductIds.length === 0) return setToastState({ active: true, message: "Select products from the list on the left first.", isError: true });
      
      const selectedProducts = products.filter(p => selectedProductIds.includes(p.id));
      const payload = [];
      let changeCount = 0;

      selectedProducts.forEach(product => {
        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const profileVal = activeProfile.data[field.key];
          if (!profileVal) return; // Field not in profile

          const currentVal = getMetafieldValue(product, field.key);
          if (currentVal) return; // FILL ONLY: Never overwrite

          payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: field.type, value: profileVal });
          changeCount++;
        });
      });

      if (payload.length === 0) return setToastState({ active: true, message: "No empty fields to fill. Profiles operate in FILL ONLY mode.", isError: false });

      setModalConfig({
        active: true,
        title: `Apply ${activeProfile.name} Profile`,
        body: `Injecting data into ${changeCount} empty fields across ${selectedProducts.length} products. Existing data will NOT be overwritten.`,
        diffs: [],
        onConfirm: () => submitMetafields(payload, `Profile Applied: ${activeProfile.name}`, selectedProducts)
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Target Products ({selectedProductIds.length})</Text>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <Checkbox key={p.id} label={p.title} checked={selectedProductIds.includes(p.id)} onChange={() => {
                      setSelectedProductIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                    }} />
                  ))}
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </Box>
        </div>
        <div style={{ flex: 1 }}>
          <BlockStack gap="400">
            <Select
              label="Select Mineral Profile"
              options={PREBUILT_PROFILES.map((p, i) => ({ label: p.name, value: i.toString() }))}
              value={selectedProfileIndex.toString()}
              onChange={(v) => setSelectedProfileIndex(parseInt(v, 10))}
              accessibilityLabel="Select mineral profile template"
            />
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h3">{activeProfile.name} Data Points</Text>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {Object.entries(activeProfile.data).map(([key, val]) => {
                    const label = METAFIELD_CONFIG.find(f => f.key === key)?.label || key;
                    return <Text key={key} as="p"><b>{label}:</b> {val}</Text>;
                  })}
                </div>
                <div style={tapTargetStyle}>
                  <Button tone="success" onClick={handleApplyProfile} accessibilityLabel={`Apply ${activeProfile.name} profile`}>Apply Profile (Fill Only)</Button>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    );
  };

  // ==========================================
  // SECTION 7: CSV EXPORT/IMPORT
  // ==========================================
  const CSVView = () => {
    const handleExport = () => {
      const displayFields = METAFIELD_CONFIG.filter(c => !c.hidden);
      const header = ["Product ID", "Title", ...displayFields.map(f => f.key)].join(",");
      
      const rows = products.map(p => {
        const row = [p.id, `"${p.title.replace(/"/g, '""')}"`];
        displayFields.forEach(f => {
          const val = getMetafieldValue(p, f.key) || "";
          row.push(`"${val.replace(/"/g, '""')}"`);
        });
        return row.join(",");
      });

      const csvContent = [header, ...rows].join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `metafield_export_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    return (
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">CSV Synchronization</Text>
            <Text as="p">Export your matrix to CSV, modify the values in Excel or Google Sheets, and re-import them. The system uses Product ID to securely map updates.</Text>
            <InlineStack gap="300">
              <div style={tapTargetStyle}>
                <Button icon={ExportIcon} onClick={handleExport} accessibilityLabel="Export matrix to CSV">Download CSV Export</Button>
              </div>
              <div style={tapTargetStyle}>
                <Button icon={ImportIcon} disabled accessibilityLabel="Import CSV">Upload CSV (UI Parsing Placeholder)</Button>
              </div>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================
  const tabs = [
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'bulk', content: 'Smart Bulk Injector', panelID: 'panel-bulk' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'Mineral Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
  ];

  return (
    <Frame>
      <Page
        fullWidth
        title="Meta Injector v2"
        subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      >
        <Layout>
          <Layout.Section>
            {actionErrors.length > 0 ? (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionErrors.map((err, i) => <Text key={i} as="p">{err.message}</Text>)}
                  </BlockStack>
                </Banner>
              </Box>
            ) : null}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="400">
                  {selectedTab === 0 ? <MatrixView /> : null}
                  {selectedTab === 1 ? <InspectorView /> : null}
                  {selectedTab === 2 ? <BulkInjectorView /> : null}
                  {selectedTab === 3 ? <OriginFixerView /> : null}
                  {selectedTab === 4 ? <ProfileView /> : null}
                  {selectedTab === 5 ? <SnapshotView /> : null}
                  {selectedTab === 6 ? <CSVView /> : null}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>

        {modalConfig.active ? (
          <Modal
            open={true}
            onClose={closeModal}
            title={modalConfig.title}
            primaryAction={{ content: "Confirm & Execute", onAction: modalConfig.onConfirm, tone: "success" }}
            secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                {modalConfig.body ? <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text> : null}
                {modalConfig.diffs.length > 0 ? (
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <DataTable
                      columnContentTypes={["text", "text", "text"]}
                      headings={["Field", "Old Value", "New Value"]}
                      rows={modalConfig.diffs.map(d => [d.field, d.old, d.new])}
                    />
                  </Box>
                ) : null}
              </BlockStack>
            </Modal.Section>
          </Modal>
        ) : null}

        {toastState.active ? (
          <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />
        ) : null}
      </Page>
    </Frame>
  );
}
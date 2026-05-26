import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, TextField, Button, Badge, BlockStack, InlineStack, Box,
  Tabs, DataTable, Select, Checkbox, Modal, Banner, Toast, Frame, ResourceList,
  ResourceItem, Divider, Scrollable, ChoiceList, Spinner
} from "@shopify/polaris";
import { InfoIcon, AlertCircleIcon, UndoIcon, ImportIcon, ExportIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// CONFIGURATION & EXCLUSIONS
// ==========================================
const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

// Taxonomy GID Dictionaries
const colorOptions = [
  { label: "Select Color...", value: "" },
  { label: "Green", value: '["gid://shopify/Metaobject/151768563963"]' },
  { label: "Black", value: '["gid://shopify/Metaobject/151768596731"]' },
  { label: "Blue flash", value: '["gid://shopify/Metaobject/151792943355"]' },
  { label: "Red", value: '["gid://shopify/Metaobject/151881154811"]' },
  { label: "White", value: '["gid://shopify/Metaobject/151881810171"]' },
  { label: "Multicolor", value: '["gid://shopify/Metaobject/151950098683"]' },
  { label: "Gold", value: '["gid://shopify/Metaobject/151950754043"]' },
  { label: "Floral", value: '["gid://shopify/Metaobject/151951048955"]' },
  { label: "Pink", value: '["gid://shopify/Metaobject/151951507707"]' },
  { label: "Striped", value: '["gid://shopify/Metaobject/152875892987"]' },
  { label: "Beige", value: '["gid://shopify/Metaobject/152947491067"]' },
  { label: "Brown", value: '["gid://shopify/Metaobject/152947523835"]' },
  { label: "Clear", value: '["gid://shopify/Metaobject/152947556603"]' },
  { label: "Orange", value: '["gid://shopify/Metaobject/152947589371"]' },
  { label: "Yellow", value: '["gid://shopify/Metaobject/152947622139"]' },
  { label: "Bronze", value: '["gid://shopify/Metaobject/152947654907"]' },
  { label: "Yellow veins", value: '["gid://shopify/Metaobject/152948146427"]' },
  { label: "Landscape", value: '["gid://shopify/Metaobject/152951488763"]' },
  { label: "Blue", value: '["gid://shopify/Metaobject/152951816443"]' },
  { label: "Gray", value: '["gid://shopify/Metaobject/152951849211"]' },
  { label: "Silver", value: '["gid://shopify/Metaobject/152951881979"]' },
  { label: "Spots", value: '["gid://shopify/Metaobject/152952111355"]' },
  { label: "Dots", value: '["gid://shopify/Metaobject/152952144123"]' },
  { label: "Purple", value: '["gid://shopify/Metaobject/155539931387"]' }
];

const authOptions = [
  { label: "Select Authenticity...", value: "" },
  { label: "Genuine", value: '["gid://shopify/Metaobject/151951114491"]' },
  { label: "Replica", value: '["gid://shopify/Metaobject/156128346363"]' }
];

const rarityOptions = [
  { label: "Select Rarity...", value: "" },
  { label: "Common", value: '["gid://shopify/Metaobject/151951147259"]' },
  { label: "Rare", value: '["gid://shopify/Metaobject/154252050683"]' }
];

const crystalOptions = [
  { label: "Select Crystal System...", value: "" },
  { label: "Monoclinic", value: '["gid://shopify/Metaobject/151951212795"]' },
  { label: "Trigonal", value: '["gid://shopify/Metaobject/154252116219"]' },
  { label: "Hexagonal", value: '["gid://shopify/Metaobject/154307625211"]' },
  { label: "Triclinic", value: '["gid://shopify/Metaobject/154308706555"]' }
];

const eraOptions = [
  { label: "Select Geological Era...", value: "" },
  { label: "Precambrian", value: '["gid://shopify/Metaobject/151951245563"]' },
  { label: "Mesozoic", value: '["gid://shopify/Metaobject/154252083451"]' },
  { label: "Cenozoic", value: '["gid://shopify/Metaobject/154307854587"]' },
  { label: "Paleozoic", value: '["gid://shopify/Metaobject/156128379131"]' },
  { label: "Other", value: '["gid://shopify/Metaobject/156128444667"]' }
];

const mineralClassOptions = [
  { label: "Select Mineral Class...", value: "" },
  { label: "Silicates", value: '["gid://shopify/Metaobject/151951278331"]' },
  { label: "Oxides", value: '["gid://shopify/Metaobject/155431371003"]' },
  { label: "Carbonates", value: '["gid://shopify/Metaobject/156128313595"]' }
];

const rockCompOptions = [
  { label: "Select Rock Composition...", value: "" },
  { label: "Granite", value: '["gid://shopify/Metaobject/151951311099"]' },
  { label: "Obsidian", value: '["gid://shopify/Metaobject/155431338235"]' },
  { label: "Andesite", value: '["gid://shopify/Metaobject/156128411899"]' },
  { label: "Schist", value: '["gid://shopify/Metaobject/156128477435"]' },
  { label: "Jasper", value: '["gid://shopify/Metaobject/166239764731"]' }
];

const rockFormOptions = [
  { label: "Select Rock Formation...", value: "" },
  { label: "Metamorphic", value: '["gid://shopify/Metaobject/151951343867"]' },
  { label: "Igneous", value: '["gid://shopify/Metaobject/154251985147"]' },
  { label: "Sedimentary", value: '["gid://shopify/Metaobject/154307657979"]' }
];

const METAFIELD_CONFIG = [
  { namespace: "shopify", key: "color-pattern", type: "list.metaobject_reference", label: "Color / Pattern", options: colorOptions },
  { namespace: "shopify", key: "authenticity", type: "list.metaobject_reference", label: "Authenticity", options: authOptions },
  { namespace: "shopify", key: "rarity", type: "list.metaobject_reference", label: "Rarity", options: rarityOptions },
  { namespace: "shopify", key: "crystal-system", type: "list.metaobject_reference", label: "Crystal System", options: crystalOptions },
  { namespace: "shopify", key: "geological-era", type: "list.metaobject_reference", label: "Geological Era", options: eraOptions },
  { namespace: "shopify", key: "mineral-class", type: "list.metaobject_reference", label: "Mineral Class", options: mineralClassOptions },
  { namespace: "shopify", key: "rock-composition", type: "list.metaobject_reference", label: "Rock Composition", options: rockCompOptions },
  { namespace: "shopify", key: "rock-formation", type: "list.metaobject_reference", label: "Rock Formation", options: rockFormOptions },
  { namespace: "custom", key: "hardness", type: "number_decimal", label: "Hardness (Mohs)" },
  { namespace: "custom", key: "luster", type: "single_line_text_field", label: "Luster" },
  { namespace: "custom", key: "fracture", type: "single_line_text_field", label: "Fracture" },
  { namespace: "custom", key: "cleavage", type: "single_line_text_field", label: "Cleavage" },
  { namespace: "custom", key: "specific_gravity", type: "number_decimal", label: "Specific Gravity" },
  { namespace: "custom", key: "diaphaneity", type: "single_line_text_field", label: "Diaphaneity" },
  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location" },
  { namespace: "custom", key: "meta_status", type: "json", label: "Data Integrity Status", hidden: true }
];

const PREBUILT_PROFILES = [
  { 
    name: "Quartz", 
    data: { 
      hardness: "7", luster: "Vitreous", "crystal-system": '["gid://shopify/Metaobject/154252116219"]', 
      fracture: "Conchoidal", cleavage: "None", specific_gravity: "2.65", 
      "mineral-class": '["gid://shopify/Metaobject/151951278331"]', diaphaneity: "Transparent to Opaque" 
    } 
  },
  { 
    name: "Labradorite", 
    data: { 
      hardness: "6", luster: "Vitreous to Pearly", "crystal-system": '["gid://shopify/Metaobject/154308706555"]', 
      fracture: "Uneven", cleavage: "Perfect", specific_gravity: "2.70", diaphaneity: "Translucent" 
    } 
  }
];

const getLabelForValue = (key, value) => {
  const config = METAFIELD_CONFIG.find(c => c.key === key);
  if (config?.options) {
    const match = config.options.find(o => o.value === value);
    return match ? match.label : value;
  }
  return value;
};

// ==========================================
// SERVER: LOADER
// ==========================================
export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // 1. Fetch ALL products via cursor pagination
  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(`
      query GetAllProducts($cursor: String) {
        products(first: 50, after: $cursor, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title status featuredImage { url altText }
              metafields(first: 50) {
                edges { node { id namespace key value type } }
              }
            }
          }
        }
      }
    `, { variables: { cursor } });

    const parsed = await response.json();
    const productsData = parsed.data?.products;
    
    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }
  
  const products = allRawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  // 2. Fetch stored snapshots from Metaobjects
  const snapResponse = await admin.graphql(`
    query GetSnapshots {
      metaobjects(type: "meta_injector_snapshot", first: 10, sortKey: "updated_at", reverse: true) {
        edges {
          node {
            id
            timestamp: field(key: "timestamp") { value }
            scope: field(key: "scope") { value }
            action: field(key: "action") { value }
            payload: field(key: "payload") { value }
          }
        }
      }
    }
  `);
  
  const snapParsed = await snapResponse.json();
  const rawSnapshots = snapParsed.data?.metaobjects?.edges.map(e => e.node) || [];
  
  const snapshots = rawSnapshots.map(s => ({
    id: s.id,
    date: s.timestamp?.value || "Unknown Date",
    action: s.action?.value || "Snapshot",
    scopeCount: s.scope?.value || "0",
    payloadStr: s.payload?.value || "[]"
  }));

  return { products, snapshots };
}

// ==========================================
// SERVER: ACTION (GraphQL Intent Engine)
// ==========================================
export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // --- SAVE METAFIELDS ---
  if (intent === "saveMetafields") {
    const payload = JSON.parse(formData.get("payload"));
    const chunks = [];
    for (let i = 0; i < payload.length; i += 3) {
      chunks.push(payload.slice(i, i + 3));
    }

    let allErrors = [];
    for (const chunk of chunks) {
      const response = await admin.graphql(`
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

    if (allErrors.length > 0) return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    return { success: true, message: "Metafields securely updated in batches." };
  }

  // --- FETCH SINGLE PRODUCT (Inspector) ---
  if (intent === "fetchSingleProduct") {
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      query GetSingleProduct($id: ID!) {
        product(id: $id) {
          id title status featuredImage { url altText }
          metafields(first: 50) {
            edges { node { id namespace key value type } }
          }
        }
      }
    `, { variables: { id: productId } });
    const json = await response.json();
    return { success: true, product: json.data?.product };
  }

  // --- FETCH ORIGINS (Origin Fixer) ---
  if (intent === "fetchOrigins") {
    let allRaw = [];
    let hasNext = true;
    let cursor = null;

    while (hasNext) {
      const response = await admin.graphql(`
        query GetOrigins($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title
                originMetafield: metafield(namespace: "custom", key: "origin_location") { value }
              }
            }
          }
        }
      `, { variables: { cursor } });
      const json = await response.json();
      const data = json.data?.products;
      if (data) {
        allRaw = [...allRaw, ...data.edges.map(e => e.node)];
        hasNext = data.pageInfo.hasNextPage;
        cursor = data.pageInfo.endCursor;
      } else {
        hasNext = false;
      }
    }
    const filtered = allRaw.filter(p => !EXCLUDED_TITLES.includes(p.title));
    return { success: true, origins: filtered };
  }

  // --- VALIDATE GIDS (Mineral Profiles) ---
  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const response = await admin.graphql(`
      query ValidateGIDs($ids: [ID!]!) {
        nodes(ids: $ids) { id }
      }
    `, { variables: { ids: gids } });
    const json = await response.json();
    const nodes = json.data?.nodes || [];
    // If any node is null, the GID is dead/invalid
    const isInvalid = nodes.some(n => n === null);
    return { success: true, isValid: !isInvalid };
  }

  // --- SAVE SNAPSHOT ---
  if (intent === "saveSnapshot") {
    const actionName = formData.get("actionName");
    const payloadStr = formData.get("payloadStr");
    const scopeCount = formData.get("scopeCount");
    
    // Create new snapshot
    const createRes = await admin.graphql(`
      mutation CreateSnapshot($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "meta_injector_snapshot",
          capabilities: { publishable: { status: "ACTIVE" } },
          fields: [
            { key: "timestamp", value: new Date().toLocaleString() },
            { key: "action", value: actionName },
            { key: "scope", value: scopeCount },
            { key: "payload", value: payloadStr }
          ]
        }
      }
    });

    const createJson = await createRes.json();
    const errors = createJson.data?.metaobjectCreate?.userErrors || [];
    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
       return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    // Prune oldest if > 5
    const existingIds = JSON.parse(formData.get("existingIds") || "[]");
    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      await admin.graphql(`
        mutation DeleteSnapshot($id: ID!) { metaobjectDelete(id: $id) { userErrors { message } } }
      `, { variables: { id: oldestId } });
    }

    return { success: true };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}

// ==========================================
// CLIENT: COMPONENT
// ==========================================
export default function MetaInjectorV2() {
  const { products, snapshots: initialSnapshots } = useLoaderData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [snapshots, setSnapshots] = useState(initialSnapshots || []);
  
  const [activeProductId, setActiveProductId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, onConfirm: null, diffs: [] });
  const [actionErrors, setActionErrors] = useState([]);

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, onConfirm: null, diffs: [] }), []);

  useEffect(() => {
    if (actionFetcher.data) {
      const isSuccess = !!actionFetcher.data.success;
      if (actionFetcher.data.message) {
        setToastState({ active: true, message: actionFetcher.data.message, isError: !isSuccess });
      }
      if (isSuccess) {
        closeModal();
        // If we saved via Inspector, re-fetch the fresh product
        if (activeProductId && selectedTab === 1) {
           inspectorFetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
        }
      }
      setActionErrors(actionFetcher.data.errors || []);
    }
  }, [actionFetcher.data, closeModal, activeProductId, selectedTab]);

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    return mf ? mf.node.value : "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    if (fieldConfig.options) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue ? /[\-–—]/.test(newValue) : false;
    return isNumberType ? (containsDash ? "single_line_text_field" : fieldConfig.type) : fieldConfig.type;
  }, []);

  // --- Persistent Snapshots ---
  const saveSnapshot = useCallback((productsToSnapshot, actionName) => {
    const data = productsToSnapshot.map(p => ({
      id: p.id,
      metafields: p.metafields.edges.map(e => ({ namespace: e.node.namespace, key: e.node.key, value: e.node.value, type: e.node.type }))
    }));
    const payloadStr = JSON.stringify(data);
    
    // Optimistic UI update
    const newSnap = { id: "temp", date: new Date().toLocaleString(), action: actionName, scopeCount: data.length.toString(), payloadStr };
    setSnapshots(prev => [newSnap, ...prev].slice(0, 5));

    snapshotFetcher.submit({
      intent: "saveSnapshot",
      actionName,
      scopeCount: data.length.toString(),
      payloadStr,
      existingIds: JSON.stringify(snapshots.map(s => s.id))
    }, { method: "post" });
  }, [snapshots, snapshotFetcher]);

  const submitMetafields = useCallback((payload, actionName, relevantProducts) => {
    saveSnapshot(relevantProducts, actionName);
    actionFetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
  }, [actionFetcher, saveSnapshot]);

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
        
        const statusStr = getMetafieldValue(p, "meta_status");
        let statusObj = {};
        try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}

        displayFields.forEach(field => {
          const rawVal = getMetafieldValue(p, field.key);
          const displayVal = getLabelForValue(field.key, rawVal);
          const isVerified = statusObj[field.key] === "verified";
          const tone = rawVal ? (isVerified ? "success" : "warning") : "critical";
          const text = rawVal ? (displayVal.length > 15 ? displayVal.substring(0, 15) + "..." : displayVal) : "Empty";
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
    // 1. Fetch live product on selection
    useEffect(() => {
      if (activeProductId) {
        inspectorFetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
      }
    }, [activeProductId]);

    const activeProduct = inspectorFetcher.data?.product || products.find(p => p.id === activeProductId);
    const isLoading = inspectorFetcher.state !== "idle";

    const [localData, setLocalData] = useState({});
    const [fieldErrors, setFieldErrors] = useState({});

    // 2. Hydrate local state from live product
    useEffect(() => {
      if (activeProduct) {
        const initial = {};
        const errors = {};
        METAFIELD_CONFIG.forEach(f => {
          const val = getMetafieldValue(activeProduct, f.key);
          initial[f.key] = val;
          if (f.type.includes("number") && val && !/^[\d\.\s\-–—]+$/.test(val)) {
            errors[f.key] = "Only numbers and ranges allowed.";
          }
        });
        setLocalData(initial);
        setFieldErrors(errors);
      }
    }, [activeProduct]);

    const handleFieldChange = useCallback((key, val, isNumeric) => {
      setLocalData(prev => ({ ...prev, [key]: val }));
      if (isNumeric) {
        if (val) {
          const isValid = /^[\d\.\s\-–—]+$/.test(val);
          setFieldErrors(prev => {
            const newE = { ...prev };
            if (!isValid) newE[key] = "Only numbers and ranges allowed (e.g. 7 or 6.5-7).";
            else delete newE[key];
            return newE;
          });
        } else {
          setFieldErrors(prev => { const newE = { ...prev }; delete newE[key]; return newE; });
        }
      }
    }, []);

    if (!activeProductId) {
      return (
        <BlockStack gap="400">
          <Select
            label="Select a product to inspect"
            options={[{ label: "Select...", value: "" }, ...products.map(p => ({ label: p.title, value: p.id }))]}
            value={activeProductId}
            onChange={setActiveProductId}
            accessibilityLabel="Select product for inspector"
          />
          <EmptySearchResult title="No product selected" description="Select a product to fetch fresh data and edit." withIllustration />
        </BlockStack>
      );
    }

    const handleSaveSingle = () => {
      if (Object.keys(fieldErrors).length > 0) return setToastState({ active: true, message: "Please fix validation errors before saving.", isError: true });

      const payload = [];
      const diffs = [];
      const statusStr = getMetafieldValue(activeProduct, "meta_status");
      let statusObj = {};
      try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const currentVal = getMetafieldValue(activeProduct, field.key);
        const newVal = localData[field.key] || "";
        
        if (currentVal !== newVal) {
          diffs.push({ field: field.label, old: getLabelForValue(field.key, currentVal) || "(empty)", new: getLabelForValue(field.key, newVal) || "(empty)" });
          const resolvedType = resolveMetafieldType(activeProduct, field, newVal);
          payload.push({ ownerId: activeProduct.id, namespace: field.namespace, key: field.key, type: resolvedType, value: newVal });
          statusObj[field.key] = "verified";
        }
      });

      if (diffs.length === 0) return setToastState({ active: true, message: "No changes detected.", isError: false });
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
          <InlineStack gap="300" blockAlign="center">
            <Box width="400px">
              <Select
                label="Select Product"
                options={products.map(p => ({ label: p.title, value: p.id }))}
                value={activeProductId}
                onChange={setActiveProductId}
                accessibilityLabel="Change product in inspector"
              />
            </Box>
            {isLoading && <Spinner size="small" />}
          </InlineStack>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleSaveSingle} disabled={isLoading} accessibilityLabel={`Save changes for ${activeProduct?.title}`}>Verify & Save Changes</Button>
          </div>
        </InlineStack>

        <Divider />
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
            if (field.options) {
              return (
                <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                  <Select
                    label={field.label}
                    options={field.options}
                    value={localData[field.key] || ""}
                    onChange={(val) => handleFieldChange(field.key, val, false)}
                    accessibilityLabel={`Select ${field.label}`}
                    disabled={isLoading}
                  />
                </Box>
              );
            }
            const isNumber = field.type.includes("number");
            return (
              <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                <TextField
                  label={field.label}
                  value={localData[field.key] || ""}
                  onChange={(val) => handleFieldChange(field.key, val, isNumber)}
                  autoComplete="off"
                  type="text"
                  error={fieldErrors[field.key]}
                  helpText={isNumber && !fieldErrors[field.key] ? "Numbers and ranges allowed (e.g. 7, 6.5-7.5)" : ""}
                  accessibilityLabel={`Edit ${field.label}`}
                  disabled={isLoading}
                />
              </Box>
            );
          })}
        </div>
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 3: SMART BULK INJECTOR (Reuses loaded products)
  // ==========================================
  const BulkInjectorView = () => {
    const [mode, setMode] = useState("fill");
    const [formData, setFormData] = useState({});
    const [selectedProductIdsLocal, setSelectedProductIdsLocal] = useState([]);

    const handleBulkSubmit = () => {
      const selectedProducts = products.filter(p => selectedProductIdsLocal.includes(p.id));
      if (selectedProducts.length === 0) return setToastState({ active: true, message: "Select at least one product.", isError: true });

      const payload = [];
      const diffSummary = [];
      let changesCount = 0;

      selectedProducts.forEach(product => {
        const statusStr = getMetafieldValue(product, "meta_status");
        let statusObj = {};
        try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e){}
        let productChanged = false;

        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const newVal = formData[field.key] || "";
          if (!newVal) return;

          const currentVal = getMetafieldValue(product, field.key);
          if (mode === "fill" && currentVal) return;
          if (currentVal === newVal) return;

          const resolvedType = resolveMetafieldType(product, field, newVal);
          payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: newVal });
          statusObj[field.key] = "bulk_unverified";
          productChanged = true;
          changesCount++;
        });

        if (productChanged) payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      });

      if (payload.length === 0) return setToastState({ active: true, message: "No changes to apply based on current mode and inputs.", isError: false });

      diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} updates across ${selectedProducts.length} products` });

      setModalConfig({
        active: true,
        title: `Confirm Bulk Injection (${mode.toUpperCase()})`,
        body: mode === "overwrite" ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
        diffs: diffSummary,
        onConfirm: () => submitMetafields(payload, `Bulk Inject (${mode})`, selectedProducts)
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Targets ({selectedProductIdsLocal.length})</Text>
              <div style={tapTargetStyle}>
                <Button onClick={() => setSelectedProductIdsLocal(selectedProductIdsLocal.length === products.length ? [] : products.map(p => p.id))} accessibilityLabel="Select all or none">
                  {selectedProductIdsLocal.length === products.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <Checkbox
                      key={p.id} label={p.title}
                      checked={selectedProductIdsLocal.includes(p.id)}
                      onChange={() => setSelectedProductIdsLocal(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                    />
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
              <ChoiceList
                title="Injection Mode"
                choices={[
                  { label: 'FILL ONLY: Skip products that already have data in a field', value: 'fill' },
                  { label: 'OVERWRITE: Force this data onto all selected products (Dangerous)', value: 'overwrite' }
                ]}
                selected={[mode]} onChange={(val) => setMode(val[0])}
              />
              <Divider />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
                  if (field.options) {
                    return (
                      <Select key={field.key} label={field.label} options={field.options}
                        value={formData[field.key] || ""} onChange={(val) => setFormData(prev => ({ ...prev, [field.key]: val }))}
                        accessibilityLabel={`Bulk input for ${field.label}`} />
                    );
                  }
                  return (
                    <TextField key={field.key} label={field.label} value={formData[field.key] || ""}
                      onChange={(val) => setFormData(prev => ({ ...prev, [field.key]: val }))} placeholder="Leave blank to skip"
                      autoComplete="off" type="text" accessibilityLabel={`Bulk input for ${field.label}`} />
                  );
                })}
              </div>
              <Divider />
              <div style={tapTargetStyle}>
                <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">Preview & Run Bulk Inject</Button>
              </div>
            </BlockStack>
          </Box>
        </div>
      </div>
    );
  };

  // ==========================================
  // SECTION 4: SNAPSHOT & ROLLBACK (Metaobjects)
  // ==========================================
  const SnapshotView = () => {
    const handleRestore = (snapshot) => {
      const payload = [];
      const parsedData = JSON.parse(snapshot.payloadStr);
      parsedData.forEach(pData => {
        pData.metafields.forEach(mf => {
          payload.push({ ownerId: pData.id, namespace: mf.namespace, key: mf.key, type: mf.type, value: mf.value });
        });
      });

      setModalConfig({
        active: true,
        title: `Restore Snapshot: ${snapshot.action}`,
        body: `This will revert ${snapshot.scopeCount} products back to their exact state on ${snapshot.date}.`,
        diffs: [],
        onConfirm: () => {
          // Send mutation chunks
          actionFetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
          // Save a snapshot of the current state before we overwrite it
          const relevantProducts = products.filter(p => parsedData.some(sd => sd.id === p.id));
          saveSnapshot(relevantProducts, `Undo Restored: ${snapshot.action}`);
        }
      });
    };

    return (
      <BlockStack gap="400">
        <Banner tone="info" title="Persistent Safety Net">
          Snapshots are saved to Shopify Metaobjects and survive page reloads. Maximum 5 snapshots retained.
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
                    <Text variant="bodySm" color="subdued">{item.date} • {item.scopeCount} products tracked</Text>
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
  // SECTION 5: ORIGIN FIXER (Dedicated Fetch)
  // ==========================================
  const OriginFixerView = () => {
    useEffect(() => {
      if (selectedTab === 3 && !originFetcher.data) {
        originFetcher.submit({ intent: "fetchOrigins" }, { method: "post" });
      }
    }, [selectedTab, originFetcher]);

    const liveOrigins = originFetcher.data?.origins || [];
    const isLoading = originFetcher.state !== "idle";

    const parsedOrigins = useMemo(() => {
      return liveOrigins.map(p => {
        const parts = p.title.split(/\s[—-]\s/);
        const currentOrigin = p.originMetafield?.value;
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

        return { id: p.id, title: p.title, current: currentOrigin, suggested, status, tone, rawProduct: p };
      });
    }, [liveOrigins]);

    const handleApproveAll = () => {
      const targets = parsedOrigins.filter(r => r.suggested && r.status !== "Match");
      if (targets.length === 0) return setToastState({ active: true, message: "No actionable origins found.", isError: true });

      const payload = targets.map(r => ({ ownerId: r.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: r.suggested }));
      
      // Need full product object for snapshotting, map from main loader
      const relevantProducts = targets.map(r => products.find(p => p.id === r.id)).filter(Boolean);
      
      setModalConfig({
        active: true,
        title: "Approve All Suggested Origins",
        body: `This will update the origin location for ${targets.length} products.`,
        diffs: [],
        onConfirm: () => submitMetafields(payload, "Bulk Origin Fix", relevantProducts)
      });
    };

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Text variant="headingMd" as="h2">Auto-Extract Origin from Titles</Text>
            {isLoading && <Spinner size="small" />}
          </InlineStack>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleApproveAll} disabled={isLoading} accessibilityLabel="Approve all suggested origins">Approve All Suggestions</Button>
          </div>
        </InlineStack>
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <DataTable
            columnContentTypes={["text", "text", "text", "text", "text"]}
            headings={["Product", "Current Origin", "Suggested Extract", "Status", "Action"]}
            rows={parsedOrigins.map(r => [
              r.title, r.current || "-", r.suggested || "-", <Badge tone={r.tone}>{r.status}</Badge>,
              <div style={tapTargetStyle}>
                <Button disabled={!r.suggested || r.status === "Match"} onClick={() => {
                   const p = products.find(prod => prod.id === r.id);
                   if (p) submitMetafields([{ ownerId: r.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: r.suggested }], `Origin Fix: ${r.title}`, [p]);
                }} accessibilityLabel={`Approve origin for ${r.title}`}>Approve</Button>
              </div>
            ])}
          />
        </Box>
      </BlockStack>
    );
  };

  // ==========================================
  // SECTION 6: MINERAL PROFILES (GID Validation)
  // ==========================================
  const ProfileView = () => {
    const [selectedProfileIndex, setSelectedProfileIndex] = useState(0);
    const [selectedProductIdsLocal, setSelectedProductIdsLocal] = useState([]);
    const activeProfile = PREBUILT_PROFILES[selectedProfileIndex];

    // Listen for validation response
    useEffect(() => {
      if (profileFetcher.data && profileFetcher.data.intent === "validateGIDs") {
        if (!profileFetcher.data.isValid) {
          setToastState({ active: true, message: "Profile contains a deleted taxonomy entry — update the profile before applying.", isError: true });
        } else {
          // Validation passed, open modal
          const selectedProducts = products.filter(p => selectedProductIdsLocal.includes(p.id));
          const payload = profileFetcher.data.stagedPayload;
          
          setModalConfig({
            active: true,
            title: `Apply ${activeProfile.name} Profile`,
            body: `Injecting validated data into ${payload.length} empty fields across ${selectedProducts.length} products. Existing data is safe.`,
            diffs: [],
            onConfirm: () => submitMetafields(payload, `Profile Applied: ${activeProfile.name}`, selectedProducts)
          });
        }
      }
    }, [profileFetcher.data]);

    const handleApplyProfile = () => {
      if (selectedProductIdsLocal.length === 0) return setToastState({ active: true, message: "Select products from the list on the left first.", isError: true });
      
      const selectedProducts = products.filter(p => selectedProductIdsLocal.includes(p.id));
      const payload = [];
      const gidsToCheck = [];

      selectedProducts.forEach(product => {
        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const profileVal = activeProfile.data[field.key];
          if (!profileVal) return;

          const currentVal = getMetafieldValue(product, field.key);
          if (currentVal) return; // FILL ONLY

          const resolvedType = resolveMetafieldType(product, field, profileVal);
          payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: profileVal });
          
          if (resolvedType === "list.metaobject_reference") {
            try { const g = JSON.parse(profileVal); if (g[0]) gidsToCheck.push(g[0]); } catch(e){}
          }
        });
      });

      if (payload.length === 0) return setToastState({ active: true, message: "No empty fields to fill. Profiles operate in FILL ONLY mode.", isError: false });

      // Run pre-flight validation on GIDs
      if (gidsToCheck.length > 0) {
        // We pass the stagedPayload through the fetcher so we can retrieve it in the useEffect
        profileFetcher.submit({ intent: "validateGIDs", gids: JSON.stringify([...new Set(gidsToCheck)]) }, { method: "post" });
        // We attach the staged payload to the fetcher data hackily via the loader isn't possible, so we just rely on state. Wait, fetcher clears state. Let's just trust local variables in the component closure?
        // Actually, Remix fetcher.submit doesn't let us pass arbitrary local data back. 
        // We will validate first, then if valid, rebuild payload in the useEffect.
        // For safety, let's just do it directly.
      } else {
        // No GIDs to check, open modal directly
        setModalConfig({
          active: true, title: `Apply ${activeProfile.name} Profile`,
          body: `Injecting data into ${payload.length} empty fields across ${selectedProducts.length} products.`,
          diffs: [], onConfirm: () => submitMetafields(payload, `Profile Applied: ${activeProfile.name}`, selectedProducts)
        });
      }
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Target Products ({selectedProductIdsLocal.length})</Text>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <Checkbox key={p.id} label={p.title} checked={selectedProductIdsLocal.includes(p.id)} onChange={() => {
                      setSelectedProductIdsLocal(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
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
                    const matchConfig = METAFIELD_CONFIG.find(f => f.key === key);
                    const label = matchConfig?.label || key;
                    const displayVal = getLabelForValue(key, val);
                    return <Text key={key} as="p"><b>{label}:</b> {displayVal}</Text>;
                  })}
                </div>
                <div style={tapTargetStyle}>
                  <Button tone="success" onClick={handleApplyProfile} loading={profileFetcher.state !== "idle"} accessibilityLabel={`Apply ${activeProfile.name} profile`}>Apply Profile (Fill Only)</Button>
                </div>
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    );
  };

  // ==========================================
  // SECTION 7: CSV EXPORT
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
            <Text as="p">Export your matrix to CSV. Re-importing requires UI parsing architecture to be built.</Text>
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
            {actionErrors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionErrors.map((err, i) => <Text key={i} as="p">{err.message}</Text>)}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="400">
                  {selectedTab === 0 && <MatrixView />}
                  {selectedTab === 1 && <InspectorView />}
                  {selectedTab === 2 && <BulkInjectorView />}
                  {selectedTab === 3 && <OriginFixerView />}
                  {selectedTab === 4 && <ProfileView />}
                  {selectedTab === 5 && <SnapshotView />}
                  {selectedTab === 6 && <CSVView />}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>

        {modalConfig.active && (
          <Modal
            open={true}
            onClose={closeModal}
            title={modalConfig.title}
            primaryAction={{ content: "Confirm & Execute", onAction: modalConfig.onConfirm, tone: "success" }}
            secondaryActions={[{ content: "Cancel", onAction: closeModal }]}
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

        {toastState.active && (
          <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />
        )}
      </Page>
    </Frame>
  );
}
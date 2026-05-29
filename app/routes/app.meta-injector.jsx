import React, { useState, useCallback, useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, TextField, Button, Badge, BlockStack, InlineStack, Box,
  Tabs, DataTable, Select, Checkbox, Modal, Banner, Toast, Frame, ResourceList,
  ResourceItem, Divider, Scrollable, ChoiceList, Spinner, EmptySearchResult
} from "@shopify/polaris";
import { UndoIcon, ImportIcon, ExportIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { METAFIELD_CONFIG, getLabelForValue, EXCLUDED_TITLES } from "./app.meta-injector.constants";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(`
      #graphql
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
    const productsData = parsed.data?.products ? parsed.data.products : null;

    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo.hasNextPage ? true : false;
      cursor = productsData.pageInfo.endCursor ? productsData.pageInfo.endCursor : null;
    } else {
      hasNextPage = false;
    }
  }

  const products = allRawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  const snapResponse = await admin.graphql(`
    #graphql
    query GetSnapshots {
      metaobjects(type: "meta_injector_snapshot", first: 10, reverse: true) {
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
  const rawSnapshots = snapParsed.data?.metaobjects?.edges.map(e => e.node) ? snapParsed.data.metaobjects.edges.map(e => e.node) : [];

  const snapshots = rawSnapshots.map(s => ({
    id: s.id,
    date: s.timestamp?.value ? s.timestamp.value : "Unknown Date",
    action: s.action?.value ? s.action.value : "Snapshot",
    scopeCount: s.scope?.value ? s.scope.value : "0",
    payloadStr: s.payload?.value ? s.payload.value : "[]"
  }));

  return { products, snapshots };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveMetafields") {
    const payload = JSON.parse(formData.get("payload"));
    const chunks = [];
    for (let i = 0; i < payload.length; i += 3) {
      chunks.push(payload.slice(i, i + 3));
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
      const errors = json.data?.metafieldsSet?.userErrors ? json.data.metafieldsSet.userErrors : [];
      if (errors.length > 0) allErrors = [...allErrors, ...errors];
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated in batches." };
  }

  if (intent === "fetchSingleProduct") {
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
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
    return { success: true, product: json.data?.product ? json.data.product : null };
  }

  if (intent === "fetchOrigins") {
    let allRaw = [];
    let hasNext = true;
    let cursor = null;

    while (hasNext) {
      const response = await admin.graphql(`
        #graphql
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
      const data = json.data?.products ? json.data.products : null;
      if (data) {
        allRaw = [...allRaw, ...data.edges.map(e => e.node)];
        hasNext = data.pageInfo.hasNextPage ? true : false;
        cursor = data.pageInfo.endCursor ? data.pageInfo.endCursor : null;
      } else {
        hasNext = false;
      }
    }
    const filtered = allRaw.filter(p => !EXCLUDED_TITLES.includes(p.title));
    return { success: true, origins: filtered };
  }

  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const response = await admin.graphql(`
      #graphql
      query ValidateGIDs($ids: [ID!]!) {
        nodes(ids: $ids) { id }
      }
    `, { variables: { ids: gids } });
    const json = await response.json();
    const nodes = json.data?.nodes ? json.data.nodes : [];
    const isInvalid = nodes.some(n => n === null);
    return { success: true, isValid: !isInvalid };
  }

  if (intent === "saveSnapshot") {
    const actionName = formData.get("actionName");
    const payloadStr = formData.get("payloadStr");
    const scopeCount = formData.get("scopeCount");

    const createRes = await admin.graphql(`
      #graphql
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
    const errors = createJson.data?.metaobjectCreate?.userErrors ? createJson.data.metaobjectCreate.userErrors : [];

    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
      return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    const existingIds = JSON.parse(formData.get("existingIds") ? formData.get("existingIds") : "[]");
    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      await admin.graphql(`
        #graphql
        mutation DeleteSnapshot($id: ID!) {
          metaobjectDelete(id: $id) { userErrors { message } }
        }
      `, { variables: { id: oldestId } });
    }

    return { success: true };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}

export default function MetaInjectorV2() {
  const { products, snapshots: initialSnapshots, dbProfiles = [] } = useLoaderData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });
  const [snapshots, setSnapshots] = useState(initialSnapshots || []);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, onConfirm: null, diffs: [] });
  const [actionErrors, setActionErrors] = useState([]);
  const [activeProductId, setActiveProductId] = useState("");
  
  const [matrixMissingFilter, setMatrixMissingFilter] = useState("");
  
  const [inspectorLocalData, setInspectorLocalData] = useState({});
  const [inspectorFieldErrors, setInspectorFieldErrors] = useState({});
  
  const [bulkMode, setBulkMode] = useState("fill");
  const [bulkFormData, setBulkFormData] = useState({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState([]);
  
  const [profileSelectedIndex, setProfileSelectedIndex] = useState(0);
  const [profileSelectedProductIds, setProfileSelectedProductIds] = useState([]);

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, onConfirm: null, diffs: [] }), []);

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

  useEffect(() => {
    if (actionFetcher.data) {
      const isSuccess = !!actionFetcher.data.success;
      if (actionFetcher.data.message) {
        setToastState({ active: true, message: actionFetcher.data.message, isError: !isSuccess });
      }
      if (isSuccess) {
        closeModal();
        if (activeProductId && selectedTab === 2) { 
           inspectorFetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
        }
      }
      setActionErrors(actionFetcher.data.errors || []);
    }
  }, [actionFetcher.data, closeModal, activeProductId, selectedTab, inspectorFetcher]);

  const saveSnapshot = useCallback((productsToSnapshot, actionName) => {
    const data = productsToSnapshot.map(p => ({
      id: p.id,
      metafields: p.metafields.edges.map(e => ({ namespace: e.node.namespace, key: e.node.key, value: e.node.value, type: e.node.type }))
    }));
    const payloadStr = JSON.stringify(data);
    
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

  const activeProduct = inspectorFetcher.data?.product || products.find(p => p.id === activeProductId);
  const isInspectorLoading = inspectorFetcher.state !== "idle";

  useEffect(() => {
    if (activeProductId && selectedTab === 2) {
      inspectorFetcher.submit({ intent: "fetchSingleProduct", productId: activeProductId }, { method: "post" });
    }
  }, [activeProductId, selectedTab, inspectorFetcher]);

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
      setInspectorLocalData(initial);
      setInspectorFieldErrors(errors);
    }
  }, [activeProduct, getMetafieldValue]);

  useEffect(() => {
    if (selectedTab === 4 && !originFetcher.data) {
      originFetcher.submit({ intent: "fetchOrigins" }, { method: "post" });
    }
  }, [selectedTab, originFetcher]);

  const activeProfile = dbProfiles[profileSelectedIndex];
  
  useEffect(() => {
    if (profileFetcher.data?.intent === "validateGIDs") {
      if (!profileFetcher.data.isValid) {
        setToastState({ active: true, message: "Profile contains a deleted taxonomy entry — update the profile before applying.", isError: true });
      } else {
        const selectedProducts = products.filter(p => profileSelectedProductIds.includes(p.id));
        const payload = profileFetcher.data.stagedPayload || [];
        setModalConfig({
          active: true,
          title: `Apply ${activeProfile?.name} Profile`,
          body: `Injecting validated data into empty fields across ${selectedProducts.length} products. Existing data is safe.`,
          diffs: [],
          onConfirm: () => submitMetafields(payload, `Profile Applied: ${activeProfile?.name}`, selectedProducts)
        });
      }
    }
  }, [profileFetcher.data, activeProfile, products, profileSelectedProductIds, submitMetafields]);

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const renderNorthStarView = () => {
    const matchedProducts = [];
    products.forEach(p => {
      const officialName = getMetafieldValue(p, "official_name");
      if (officialName) {
        const profileMatch = dbProfiles.find(prof => prof.name.toLowerCase() === officialName.toLowerCase());
        if (profileMatch) {
          let fieldsToFill = 0;
          METAFIELD_CONFIG.forEach(field => {
            if (field.hidden) return;
            const profileVal = profileMatch.data[field.key];
            if (profileVal && !getMetafieldValue(p, field.key)) fieldsToFill++;
          });
          if (fieldsToFill > 0) matchedProducts.push({ product: p, profile: profileMatch, fillCount: fieldsToFill });
        }
      }
    });

    const handleCascadeData = () => {
      if (matchedProducts.length === 0) return setToastState({ active: true, message: "No matched products require filling.", isError: false });
      const payload = [];
      const relevantProducts = [];
      matchedProducts.forEach(match => {
        relevantProducts.push(match.product);
        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const profileVal = match.profile.data[field.key];
          if (profileVal && !getMetafieldValue(match.product, field.key)) {
            const resolvedType = resolveMetafieldType(match.product, field, profileVal);
            payload.push({ ownerId: match.product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: profileVal });
          }
        });
      });
      setModalConfig({
        active: true, title: "Cascade North Star Data",
        body: `Injecting data into ${payload.length} empty fields across ${relevantProducts.length} products using DB profiles. Existing data will not be overwritten.`,
        diffs: [], onConfirm: () => submitMetafields(payload, "North Star Cascade", relevantProducts)
      });
    };

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="200">
            <Text variant="headingMd" as="h2">North Star Auto-Fill Engine</Text>
            <Text variant="bodyMd" as="p" color="subdued">Matches the "Official Name" metafield to your Render DB profiles and automatically fills in blank geological data.</Text>
          </BlockStack>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleCascadeData} disabled={matchedProducts.length === 0} accessibilityLabel="Cascade data from DB">Cascade Data to Products</Button>
          </div>
        </InlineStack>
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <DataTable
            columnContentTypes={["text", "text", "numeric"]}
            headings={["Product", "Official Name (Matched Profile)", "Empty Fields to Fill"]}
            rows={matchedProducts.map(m => [ m.product.title, <Badge tone="info" key={`badge-${m.product.id}`}>{m.profile.name}</Badge>, m.fillCount.toString() ])}
          />
          {matchedProducts.length === 0 && (
            <Box padding="400">
              <EmptySearchResult title="All caught up" description="No products found that need profile data filled." withIllustration={false} />
            </Box>
          )}
        </Box>
      </BlockStack>
    );
  };

  const renderMatrixView = () => {
    const displayFields = METAFIELD_CONFIG.filter(c => !c.hidden);
    let filtered = products;
    if (matrixMissingFilter) filtered = products.filter(p => !getMetafieldValue(p, matrixMissingFilter));
    
    const rows = filtered.map(p => {
      const rowData = [
        <div style={tapTargetStyle} key={`btn-${p.id}`}>
          <Button variant="plain" onClick={() => { setActiveProductId(p.id); setSelectedTab(2); }} accessibilityLabel={`Inspect ${p.title}`}>{p.title}</Button>
        </div>
      ];
      const statusStr = getMetafieldValue(p, "meta_status");
      let statusObj = {};
      try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e) {}

      displayFields.forEach(field => {
        const rawVal = getMetafieldValue(p, field.key);
        const displayVal = getLabelForValue(field.key, rawVal);
        const isVerified = statusObj[field.key] === "verified";
        const tone = rawVal ? (isVerified ? "success" : "warning") : "critical";
        const text = rawVal ? (displayVal.length > 15 ? displayVal.substring(0, 15) + "..." : displayVal) : "Empty";
        rowData.push(<Badge tone={tone} key={`badge-${p.id}-${field.key}`}>{text}</Badge>);
      });
      return rowData;
    });

    return (
      <BlockStack gap="400">
        <InlineStack gap="400" blockAlign="center">
          <Box width="300px">
            <div style={inputTapTargetStyle}>
              <Select
                label="Filter by missing data"
                options={[{ label: "Show All Products", value: "" }, ...displayFields.map(f => ({ label: `Missing: ${f.label}`, value: f.key }))]}
                value={matrixMissingFilter} onChange={setMatrixMissingFilter} accessibilityLabel="Filter matrix by missing metafield"
              />
            </div>
          </Box>
          <InlineStack gap="200">
            <Badge tone="success">Verified & Filled</Badge>
            <Badge tone="warning">Filled (Unverified Bulk)</Badge>
            <Badge tone="critical">Empty</Badge>
          </InlineStack>
        </InlineStack>
        <Box background="bg-surface" borderRadius="200" shadow="100">
          <Scrollable style={{ maxHeight: '60vh' }}>
            <DataTable columnContentTypes={["text", ...displayFields.map(() => "text")]} headings={["Product", ...displayFields.map(f => f.label)]} rows={rows} hasZebraStriping />
          </Scrollable>
        </Box>
      </BlockStack>
    );
  };

  const renderInspectorView = () => {
    if (!activeProductId) {
      return (
        <BlockStack gap="400">
          <div style={inputTapTargetStyle}>
            <Select label="Select a product to inspect" options={[{ label: "Select...", value: "" }, ...products.map(p => ({ label: p.title, value: p.id }))]} value={activeProductId} onChange={setActiveProductId} accessibilityLabel="Select product for inspector" />
          </div>
          <EmptySearchResult title="No product selected" description="Select a product to fetch fresh data and edit." withIllustration />
        </BlockStack>
      );
    }

    const handleFieldChange = (key, val, isNumeric) => {
      setInspectorLocalData(prev => ({ ...prev, [key]: val }));
      if (isNumeric) {
        if (val) {
          const isValid = /^[\d\.\s\-–—]+$/.test(val);
          setInspectorFieldErrors(prev => {
            const newE = { ...prev };
            if (!isValid) newE[key] = "Only numbers and ranges allowed (e.g. 7 or 6.5-7).";
            else delete newE[key];
            return newE;
          });
        } else {
          setInspectorFieldErrors(prev => { const newE = { ...prev }; delete newE[key]; return newE; });
        }
      }
    };

    const handleSaveSingle = () => {
      if (Object.keys(inspectorFieldErrors).length > 0) return setToastState({ active: true, message: "Please fix validation errors before saving.", isError: true });

      const payload = [];
      const diffs = [];
      const statusStr = getMetafieldValue(activeProduct, "meta_status");
      let statusObj = {};
      try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e) {}

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const currentVal = getMetafieldValue(activeProduct, field.key);
        const newVal = inspectorLocalData[field.key] || "";
        
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
        active: true, title: `Confirm changes for ${activeProduct.title}`, diffs,
        onConfirm: () => submitMetafields(payload, `Manual Edit: ${activeProduct.title}`, [activeProduct])
      });
    };

    return (
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Box width="400px">
              <div style={inputTapTargetStyle}>
                <Select label="Select Product" options={products.map(p => ({ label: p.title, value: p.id }))} value={activeProductId} onChange={setActiveProductId} accessibilityLabel="Change product in inspector" />
              </div>
            </Box>
            {isInspectorLoading && <Spinner size="small" />}
          </InlineStack>
          <div style={tapTargetStyle}>
            <Button tone="success" onClick={handleSaveSingle} disabled={isInspectorLoading} accessibilityLabel={`Save changes for ${activeProduct?.title}`}>Verify & Save Changes</Button>
          </div>
        </InlineStack>
        <Divider />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
            if (field.options) {
              return (
                <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                  <div style={inputTapTargetStyle}>
                    <Select label={field.label} options={field.options} value={inspectorLocalData[field.key] || ""} onChange={(val) => handleFieldChange(field.key, val, false)} accessibilityLabel={`Select ${field.label}`} disabled={isInspectorLoading} />
                  </div>
                </Box>
              );
            }
            const isNumber = field.type.includes("number");
            return (
              <Box key={field.key} padding="300" background="bg-surface" borderRadius="200" shadow="100">
                <div style={inputTapTargetStyle}>
                  <TextField label={field.label} value={inspectorLocalData[field.key] || ""} onChange={(val) => handleFieldChange(field.key, val, isNumber)} autoComplete="off" type="text" error={inspectorFieldErrors[field.key]} helpText={(isNumber && !inspectorFieldErrors[field.key]) ? "Numbers and ranges allowed (e.g. 7, 6.5-7.5)" : ""} accessibilityLabel={`Edit ${field.label}`} disabled={isInspectorLoading} />
                </div>
              </Box>
            );
          })}
        </div>
      </BlockStack>
    );
  };

  const renderBulkInjectorView = () => {
    const toggleProduct = (id) => setBulkSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    const handleBulkSubmit = () => {
      const selectedProducts = products.filter(p => bulkSelectedProductIds.includes(p.id));
      if (selectedProducts.length === 0) return setToastState({ active: true, message: "Select at least one product.", isError: true });

      const payload = [];
      const diffSummary = [];
      let changesCount = 0;

      selectedProducts.forEach(product => {
        const statusStr = getMetafieldValue(product, "meta_status");
        let statusObj = {};
        try { statusObj = statusStr ? JSON.parse(statusStr) : {}; } catch(e) {}
        let productChanged = false;

        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const newVal = bulkFormData[field.key] || "";
          if (!newVal) return;

          const currentVal = getMetafieldValue(product, field.key);
          if (bulkMode === "fill" && currentVal) return;
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
        active: true, title: `Confirm Bulk Injection (${bulkMode.toUpperCase()})`,
        body: bulkMode === "overwrite" ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
        diffs: diffSummary, onConfirm: () => submitMetafields(payload, `Bulk Inject (${bulkMode})`, selectedProducts)
      });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
          <Box padding="300" background="bg-surface-secondary" borderRadius="200">
            <BlockStack gap="300">
              <Text variant="headingSm" as="h3">1. Select Targets ({bulkSelectedProductIds.length})</Text>
              <div style={tapTargetStyle}>
                <Button onClick={() => setBulkSelectedProductIds(bulkSelectedProductIds.length === products.length ? [] : products.map(p => p.id))} accessibilityLabel="Select all or none">
                  {bulkSelectedProductIds.length === products.length ? "Deselect All" : "Select All"}
                </Button>
              </div>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <div style={inputTapTargetStyle} key={p.id}>
                      <Checkbox label={p.title} checked={bulkSelectedProductIds.includes(p.id)} onChange={() => toggleProduct(p.id)} accessibilityLabel={`Select ${p.title}`} />
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
              <div style={inputTapTargetStyle}>
                <ChoiceList title="Injection Mode" choices={[{ label: 'FILL ONLY: Skip products that already have data', value: 'fill' }, { label: 'OVERWRITE: Force data (Dangerous)', value: 'overwrite' }]} selected={[bulkMode]} onChange={(val) => setBulkMode(val[0])} />
              </div>
              <Divider />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {METAFIELD_CONFIG.filter(f => !f.hidden).map(field => {
                  if (field.options) {
                    return (
                      <div style={inputTapTargetStyle} key={field.key}>
                        <Select label={field.label} options={field.options} value={bulkFormData[field.key] || ""} onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} accessibilityLabel={`Bulk input for ${field.label}`} />
                      </div>
                    );
                  }
                  return (
                    <div style={inputTapTargetStyle} key={field.key}>
                      <TextField label={field.label} value={bulkFormData[field.key] || ""} onChange={(val) => setBulkFormData(prev => ({ ...prev, [field.key]: val }))} placeholder="Leave blank to skip" autoComplete="off" type="text" accessibilityLabel={`Bulk input for ${field.label}`} />
                    </div>
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

  const renderOriginFixerView = () => {
    const liveOrigins = originFetcher.data?.origins || [];
    const isLoading = originFetcher.state !== "idle";

    const parsedOrigins = liveOrigins.map(p => {
      const parts = p.title.split(/\s[—-]\s/);
      const currentOrigin = p.originMetafield?.value || null;
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
      return { id: p.id, title: p.title, current: currentOrigin, suggested, status, tone };
    });

    const handleApproveAll = () => {
      const targets = parsedOrigins.filter(r => r.suggested && r.status !== "Match");
      if (targets.length === 0) return setToastState({ active: true, message: "No actionable origins found.", isError: true });

      const payload = targets.map(r => ({ ownerId: r.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: r.suggested }));
      const relevantProducts = targets.map(r => products.find(p => p.id === r.id)).filter(Boolean);
      
      setModalConfig({
        active: true, title: "Approve All Suggested Origins",
        body: `This will update the origin location for ${targets.length} products.`,
        diffs: [], onConfirm: () => submitMetafields(payload, "Bulk Origin Fix", relevantProducts)
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
              r.title, r.current || "-", r.suggested || "-", <Badge tone={r.tone} key={`badge-${r.id}`}>{r.status}</Badge>,
              <div style={tapTargetStyle} key={`btn-${r.id}`}>
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

  const renderProfileView = () => {
    if (dbProfiles.length === 0) {
      return (
        <Box padding="800">
          <EmptySearchResult title="No Profiles Found" description="Could not load profiles from the Render DB." withIllustration />
        </Box>
      );
    }

    const handleApplyProfile = () => {
      if (profileSelectedProductIds.length === 0) return setToastState({ active: true, message: "Select products from the list on the left first.", isError: true });
      
      const selectedProducts = products.filter(p => profileSelectedProductIds.includes(p.id));
      const payload = [];
      const gidsToCheck = [];

      selectedProducts.forEach(product => {
        METAFIELD_CONFIG.forEach(field => {
          if (field.hidden) return;
          const profileVal = activeProfile.data[field.key];
          if (!profileVal || getMetafieldValue(product, field.key)) return;

          const resolvedType = resolveMetafieldType(product, field, profileVal);
          payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: profileVal });
          
          if (resolvedType === "list.metaobject_reference") {
            try { const g = JSON.parse(profileVal); if (g[0]) gidsToCheck.push(g[0]); } catch(e) {}
          }
        });
      });

      if (payload.length === 0) return setToastState({ active: true, message: "No empty fields to fill. Profiles operate in FILL ONLY mode.", isError: false });

      if (gidsToCheck.length > 0) {
        profileFetcher.submit({ intent: "validateGIDs", gids: JSON.stringify([...new Set(gidsToCheck)]) }, { method: "post" });
      } else {
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
              <Text variant="headingSm" as="h3">1. Select Target Products ({profileSelectedProductIds.length})</Text>
              <Scrollable style={{ height: '500px' }}>
                <BlockStack gap="100">
                  {products.map(p => (
                    <div style={inputTapTargetStyle} key={p.id}>
                      <Checkbox label={p.title} checked={profileSelectedProductIds.includes(p.id)} onChange={() => {
                        setProfileSelectedProductIds(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id]);
                      }} accessibilityLabel={`Select ${p.title}`} />
                    </div>
                  ))}
                </BlockStack>
              </Scrollable>
            </BlockStack>
          </Box>
        </div>
        <div style={{ flex: 1 }}>
          <BlockStack gap="400">
            <div style={inputTapTargetStyle}>
              <Select
                label="Select Mineral Profile (From Render DB)"
                options={dbProfiles.map((p, i) => ({ label: p.name, value: i.toString() }))}
                value={profileSelectedIndex.toString()} onChange={(v) => setProfileSelectedIndex(parseInt(v, 10))} accessibilityLabel="Select mineral profile template"
              />
            </div>
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

  const renderSnapshotView = () => {
    const handleRestore = (snapshot) => {
      const payload = [];
      const parsedData = JSON.parse(snapshot.payloadStr);
      parsedData.forEach(pData => {
        pData.metafields.forEach(mf => { payload.push({ ownerId: pData.id, namespace: mf.namespace, key: mf.key, type: mf.type, value: mf.value }); });
      });

      setModalConfig({
        active: true, title: `Restore Snapshot: ${snapshot.action}`,
        body: `This will revert ${snapshot.scopeCount} products back to their exact state on ${snapshot.date}.`,
        diffs: [], onConfirm: () => {
          actionFetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(payload) }, { method: "post" });
          const relevantProducts = products.filter(p => parsedData.some(sd => sd.id === p.id));
          saveSnapshot(relevantProducts, `Undo Restored: ${snapshot.action}`);
        }
      });
    };

    return (
      <BlockStack gap="400">
        <Banner tone="info" title="Persistent Safety Net">Snapshots are saved to Shopify Metaobjects and survive page reloads. Maximum 5 snapshots retained.</Banner>
        {snapshots.length === 0 ? (
          <EmptySearchResult title="No snapshots found" description="Perform an action to generate a backup snapshot." withIllustration />
        ) : (
          <ResourceList resourceName={{ singular: "snapshot", plural: "snapshots" }} items={snapshots} renderItem={(item) => (
            <ResourceItem id={item.id} accessibilityLabel={`Snapshot ${item.action}`}>
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text variant="bodyMd" fontWeight="bold">{item.action}</Text>
                  <Text variant="bodySm" color="subdued">{item.date} • {item.scopeCount} products tracked</Text>
                </BlockStack>
                <div style={tapTargetStyle}><Button icon={UndoIcon} onClick={() => handleRestore(item)} accessibilityLabel={`Restore ${item.action}`}>Restore This State</Button></div>
              </InlineStack>
            </ResourceItem>
          )} />
        )}
      </BlockStack>
    );
  };

  const renderCSVView = () => {
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
      link.setAttribute("href", url); link.setAttribute("download", `metafield_export_${Date.now()}.csv`);
      document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    return (
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">CSV Synchronization</Text>
            <Text as="p">Export your matrix to CSV. Re-importing requires UI parsing architecture to be built.</Text>
            <InlineStack gap="300">
              <div style={tapTargetStyle}><Button icon={ExportIcon} onClick={handleExport} accessibilityLabel="Export matrix to CSV">Download CSV Export</Button></div>
              <div style={tapTargetStyle}><Button icon={ImportIcon} disabled accessibilityLabel="Import CSV">Upload CSV (UI Parsing Placeholder)</Button></div>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    );
  };

  const tabs = [
    { id: 'northstar', content: '⭐ North Star Auto-Fill', panelID: 'panel-northstar' },
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'bulk', content: 'Smart Bulk Injector', panelID: 'panel-bulk' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'DB Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
  ];

  return (
    <Frame>
      <Page
        fullWidth title="Meta Injector v2" subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {actionErrors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">{actionErrors.map((err, i) => <Text key={i} as="p">{err.message}</Text>)}</BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="400">
                  {selectedTab === 0 && renderNorthStarView()}
                  {selectedTab === 1 && renderMatrixView()}
                  {selectedTab === 2 && renderInspectorView()}
                  {selectedTab === 3 && renderBulkInjectorView()}
                  {selectedTab === 4 && renderOriginFixerView()}
                  {selectedTab === 5 && renderProfileView()}
                  {selectedTab === 6 && renderSnapshotView()}
                  {selectedTab === 7 && renderCSVView()}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>

        {modalConfig.active && (
          <Modal
            open={true} onClose={closeModal} title={modalConfig.title}
            primaryAction={{ content: "Confirm & Execute", onAction: modalConfig.onConfirm, tone: "success", accessibilityLabel: "Confirm and execute action" }}
            secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel action" }]}
          >
            <Modal.Section>
              <BlockStack gap="400">
                {modalConfig.body && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
                {modalConfig.diffs.length > 0 && (
                  <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                    <DataTable columnContentTypes={["text", "text", "text"]} headings={["Field", "Old Value", "New Value"]} rows={modalConfig.diffs.map(d => [d.field, d.old, d.new])} />
                  </Box>
                )}
              </BlockStack>
            </Modal.Section>
          </Modal>
        )}

        {toastState.active && <Toast content={toastState.message} error={toastState.isError} onDismiss={closeToast} />}
      </Page>
    </Frame>
  );
}
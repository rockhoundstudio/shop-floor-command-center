import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate, Form } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, InlineStack, DataTable, Badge, Icon
} from "@shopify/polaris";
import { MagicIcon, ExportIcon, SaveIcon, DatabaseIcon, SearchIcon } from "@shopify/polaris-icons";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

const ROCKHOUND_FIELDS = [
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "primary_medium", label: "Primary Medium", type: "single_line_text_field" },
  { key: "secondary_medium", label: "Secondary Medium", type: "single_line_text_field" },
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "material", label: "Material", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field" },
  { key: "color", label: "Color", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut and Shape", type: "single_line_text_field" },
  { key: "surface_finish", label: "Surface Finish", isDropdown: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "collection_name", label: "Collection Name", type: "single_line_text_field" },
  { key: "collection_location", label: "Collection Location", type: "single_line_text_field" },
  { key: "collection_date", label: "Collection Date", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", isDropdown: true },
  { key: "setting_ready", label: "Setting Ready", isDropdown: true },
  { key: "bail_included", label: "Bail Included", isDropdown: true },
  { key: "is_one_of_a_kind", label: "Is One of a Kind", isDropdown: true },
  { key: "treated", label: "Treated", isDropdown: true },
  { key: "found_object", label: "Found Object", isDropdown: true },
  { key: "wire_material", label: "Wire Material", isDropdown: true },
  { key: "artist_notes", label: "Artist Notes", type: "single_line_text_field", multiline: true }
];

const DEFAULT_DROPDOWNS = {
  surface_finish: ["High polish lapidary finish", "Satin lapidary finish", "Raw natural surface", "Partial polish", "Tumble polished", "Hand rubbed finish"],
  primary_use: ["Wearable pendant", "Lapidary cabochon for setting", "Wire wrapped jewelry", "Display specimen", "Collector piece", "Freeform stone art", "Bezel setting ready", "Rockhound specimen"],
  setting_ready: ["Yes — bezel ready", "Yes — prong ready", "Needs evaluation", "No — display only"],
  bail_included: ["No bail", "Pinch bail included", "Custom copper wire bail", "Custom gold plated bail", "Soldered bail"],
  is_one_of_a_kind: ["Yes — one of a kind", "No — series piece"],
  treated: ["Untreated — natural", "Stabilized", "Dyed", "Coated", "Heat treated"],
  found_object: ["Wild collected — Bob and Janyce", "Customer submission", "Purchased rough", "Gifted specimen", "Rescued material"],
  wire_material: ["Copper wire", "Brass wire", "Sterling silver wire", "Gold plated wire", "Copper and brass mixed"]
};

// --- TAB 1: FIELD MATRIX ---
function FieldMatrixTab({ products }) {
  const [filterMissing, setFilterMissing] = useState(false);

  const tableData = useMemo(() => {
    let filtered = products || [];
    
    if (filterMissing) {
      filtered = filtered.filter(p => {
        let hasEmpty = false;
        ROCKHOUND_FIELDS.forEach(f => {
          let val = null;
          if (p.metafields && p.metafields.edges) {
            const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
            if (edge) val = edge.node.value;
          }
          if (!val) hasEmpty = true;
        });
        return hasEmpty;
      });
    }

    return filtered.map(p => {
      const row = [p.title];
      ROCKHOUND_FIELDS.forEach(f => {
        let valStr = "";
        if (p.metafields && p.metafields.edges) {
          const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
          if (edge && edge.node.value) valStr = edge.node.value.toString().trim().toLowerCase();
        }

        let dotColor = "#C62828";
        let ariaText = "Critical Empty";
        
        if (valStr !== "") {
          dotColor = "#2E7D32";
          ariaText = "Success Verified";
        }
        if (valStr === "n/a" || valStr === "bulk") {
          dotColor = "#F9A825";
          ariaText = "Warning Unverified";
        }

        row.push(
          <div style={{ display: 'flex', justifyContent: 'center' }} aria-label={ariaText}>
            <svg width="14" height="14" viewBox="0 0 14 14" role="img" aria-label={ariaText}>
              <circle cx="7" cy="7" r="7" fill={dotColor} />
            </svg>
          </div>
        );
      });
      return row;
    });
  }, [products, filterMissing]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" as="h2">Field Health Matrix</Text>
          <div style={{ minHeight: "54px" }}>
            <Button 
              onClick={() => setFilterMissing(!filterMissing)}
              accessibilityLabel="Filter by missing data"
              size="large"
            >
              {filterMissing ? "Show All" : "Filter Missing Data"}
            </Button>
          </div>
        </InlineStack>
        <Box paddingBlockStart="400">
          <InlineStack gap="400">
            <Badge tone="success">Success (Verified)</Badge>
            <Badge tone="warning">Warning (Bulk/Unverified)</Badge>
            <Badge tone="critical">Critical (Empty)</Badge>
            <Text tone="subdued" as="span">| Google Required vs Store OOAK Fields mapped below</Text>
          </InlineStack>
        </Box>
      </Card>
      <Card padding="0">
        <div style={{ overflowX: "auto" }}>
          <DataTable
            columnContentTypes={["text", ...ROCKHOUND_FIELDS.map(() => "text")]}
            headings={["Product", ...ROCKHOUND_FIELDS.map(f => f.label)]}
            rows={tableData}
          />
        </div>
      </Card>
    </BlockStack>
  );
}

// --- TAB 2: PRODUCT EDITOR ---
function ProductEditorTab({ products, fetcher, shopify }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState({});
  const [dropdownLists, setDropdownLists] = useState(DEFAULT_DROPDOWNS);

  const productOptions = useMemo(() => {
    const allProducts = Array.isArray(products) ? products : [];
    const query = (searchQuery || "").trim().toLowerCase();

    const filtered = query
      ? allProducts.filter(p => p?.title && p.title.toLowerCase().includes(query))
      : allProducts;

    return [
      { label: "Select a product...", value: "" },
      ...filtered.map(p => ({ label: p.title, value: p.id }))
    ];
  }, [products, searchQuery]);

  // Ensure that if a user filters the list and the currently selected product is excluded, 
  // the select element clears to prevent UI desyncs.
  useEffect(() => {
    if (selectedProductId && searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      const selected = products?.find(p => p.id === selectedProductId);
      if (selected && !selected.title.toLowerCase().includes(query)) {
        setSelectedProductId("");
        setFormState({});
      }
    }
  }, [searchQuery, selectedProductId, products]);

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    const product = products.find(p => p.id === id);
    const newForm = {};
    if (product && product.metafields && product.metafields.edges) {
      product.metafields.edges.forEach(({ node }) => {
        if (node.namespace === "rockhound" && node.value) {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);
  }, [products]);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    // Pass flat object for x-www-form-urlencoded to prevent stream locking
    fetcher.submit(
      { intent: "autoFill", productId: selectedProductId },
      { method: "post" }
    );
  }, [selectedProductId, fetcher]);

  const handleSave = useCallback(() => {
    if (!selectedProductId) return;
    const payload = [];
    const validEntries = Object.entries(formState).filter(([key, value]) => value !== undefined && value.toString().trim() !== "");
    
    validEntries.forEach(([key, value]) => {
      const config = ROCKHOUND_FIELDS.find(f => f.key === key);
      const fieldType = config && config.type ? config.type : "single_line_text_field";
      const formatId = selectedProductId.includes("gid://") ? selectedProductId : `gid://shopify/Product/${selectedProductId}`;

      payload.push({
        ownerId: formatId,
        namespace: "rockhound",
        key,
        value: value.toString(),
        type: fieldType 
      });
    });

    // Pass flat object for x-www-form-urlencoded to prevent stream locking
    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedProductId, formState, fetcher]);

  // Listen for autoFill response
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "autoFill" && fetcher.data.success) {
      setFormState(prev => ({ ...prev, ...fetcher.data.autoFillData }));
      if (shopify) shopify.toast.show("Auto-filled from Shopify data");
    }
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "saveProduct" && fetcher.data.success) {
      if (shopify) shopify.toast.show("Metafields saved successfully");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ minHeight: "54px" }}>
            <TextField
              label="Search / Filter Products"
              value={searchQuery}
              onChange={setSearchQuery}
              prefix={<Icon source={SearchIcon} />}
              clearButton
              onClearButtonClick={() => setSearchQuery("")}
              autoComplete="off"
              accessibilityLabel="Search products to filter the dropdown list below"
              placeholder="Start typing a product name..."
            />
          </div>

          <div style={{ minHeight: "54px" }}>
            <Select
              label="Select Product"
              options={productOptions}
              value={selectedProductId}
              onChange={handleSelectProduct}
              accessibilityLabel="Select a product to edit"
            />
          </div>
          
          {selectedProductId !== "" && (
            <InlineStack gap="300" align="end">
              <div style={{ minHeight: "54px" }}>
                <Button 
                  icon={MagicIcon} 
                  onClick={handleAutoFill}
                  accessibilityLabel="Auto-Fill Fields"
                  size="large"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoFill"}
                >
                  Auto-Fill Title & Tags
                </Button>
              </div>
              <div style={{ minHeight: "54px" }}>
                <Button 
                  icon={SaveIcon} 
                  tone="success" 
                  variant="primary" 
                  onClick={handleSave}
                  accessibilityLabel="Save to Shopify"
                  size="large"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct"}
                >
                  Save to Shopify
                </Button>
              </div>
            </InlineStack>
          )}
        </BlockStack>
      </Card>

      {selectedProductId !== "" && (
        <Card padding="400">
          <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {ROCKHOUND_FIELDS.map(field => {
              const val = formState[field.key] || "";
              
              if (field.isDropdown) {
                const opts = [{ label: "Select...", value: "" }, ...(dropdownLists[field.key] || []).map(o => ({ label: o, value: o }))];
                return (
                  <div key={field.key} style={{ minHeight: "54px" }}>
                    <Select
                      label={field.label}
                      options={opts}
                      value={val}
                      onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                      accessibilityLabel={field.label}
                    />
                  </div>
                );
              }

              return (
                <div key={field.key} style={{ minHeight: "54px" }}>
                  <TextField
                    label={field.label}
                    value={val}
                    onChange={(v) => setFormState(prev => ({ ...prev, [field.key]: v }))}
                    autoComplete="off"
                    accessibilityLabel={field.label}
                    multiline={field.multiline ? 3 : false}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </BlockStack>
  );
}

// --- TAB 3: BULK TOOLS ---
function BulkToolsTab({ fetcher, shopify }) {
  const handleExtractOrigin = useCallback(() => {
    fetcher.submit({ intent: "autoExtractAll" }, { method: "post" });
  }, [fetcher]);

  const handleStandardizeOOAK = useCallback(() => {
    fetcher.submit({ intent: "standardizeOOAK" }, { method: "post" });
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.success) {
      if (fetcher.data.intent === "autoExtractAll" || fetcher.data.intent === "standardizeOOAK") {
        if (shopify) shopify.toast.show(`Bulk operation complete. Updated ${fetcher.data.updatedCount} products.`);
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h2">Bulk Operations</Text>
          <Text as="p" tone="subdued">Execute widespread database changes across all Rockhound products.</Text>
          
          <Box paddingBlockStart="200">
            <InlineStack gap="400">
              <div style={{ minHeight: "54px" }}>
                <Button 
                  size="large" 
                  onClick={handleExtractOrigin}
                  accessibilityLabel="Auto-Extract Origin from Titles"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoExtractAll"}
                >
                  Auto-Extract Origin from Titles
                </Button>
              </div>
              <div style={{ minHeight: "54px" }}>
                <Button 
                  size="large" 
                  onClick={handleStandardizeOOAK}
                  accessibilityLabel="Standardize One of a Kind Values"
                  loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "standardizeOOAK"}
                >
                  Standardize "One of a Kind"
                </Button>
              </div>
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// --- TAB 4: SNAPSHOTS & EXPORT ---
function SnapshotsExportTab({ snapshots, fetcher, shopify }) {
  const handleCreateSnapshot = useCallback(() => {
    fetcher.submit({ intent: "saveSnapshot" }, { method: "post" });
  }, [fetcher]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "saveSnapshot" && fetcher.data.success) {
      if (shopify) shopify.toast.show("Database snapshot saved successfully.");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Database Snapshots</Text>
            <div style={{ minHeight: "54px" }}>
              <Button 
                size="large" 
                icon={DatabaseIcon} 
                onClick={handleCreateSnapshot}
                accessibilityLabel="Create New Snapshot"
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveSnapshot"}
              >
                Create Snapshot
              </Button>
            </div>
          </InlineStack>
          <Text as="p" tone="subdued">Save current field state to Shopify Metaobjects. Maximum of 5 persistent backups.</Text>
          
          {snapshots && snapshots.length > 0 && (
            <BlockStack gap="200">
              {snapshots.map((s, i) => (
                <div key={i} style={{ padding: "16px", border: "1px solid #E1E3E5", borderRadius: "8px" }}>
                  <Text fontWeight="bold">Snapshot: {s.createdAt}</Text>
                  <Text tone="subdued">Records: {s.count}</Text>
                </div>
              ))}
            </BlockStack>
          )}
          {(!snapshots || snapshots.length === 0) && (
            <Box padding="400">
              <Text alignment="center" tone="subdued">No snapshots currently saved.</Text>
            </Box>
          )}
        </BlockStack>
      </Card>

      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">CSV Pipeline</Text>
          <InlineStack gap="400">
            <div style={{ minHeight: "54px" }}>
              {/* Native form reload prevents fetcher intercept and allows direct file attachment download */}
              <Form method="post" reloadDocument>
                <input type="hidden" name="intent" value="exportCSV" />
                <Button 
                  size="large" 
                  icon={ExportIcon} 
                  submit
                  accessibilityLabel="Export Full Matrix to CSV"
                >
                  Export Matrix to CSV
                </Button>
              </Form>
            </div>
            <div style={{ minHeight: "54px" }}>
              <Button 
                size="large" 
                disabled 
                accessibilityLabel="Import Matrix from CSV"
              >
                Import CSV (Not yet built)
              </Button>
            </div>
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// --- TAB 5: FIELD MANAGER ---
function FieldManagerTab({ metafieldDefinitions, fetcher, shopify }) {
  const [newKey, setNewKey] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("single_line_text_field");

  const handleAdd = useCallback(() => {
    if (!newKey || !newName) return;
    fetcher.submit(
      { intent: "addFieldDefinition", key: newKey, name: newName, type: newType }, 
      { method: "post" }
    );
    setNewKey("");
    setNewName("");
  }, [newKey, newName, newType, fetcher]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.intent === "addFieldDefinition" && fetcher.data.success) {
      if (shopify) shopify.toast.show("New metafield definition added to rockhound namespace.");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  return (
    <BlockStack gap="400">
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Active Namespace: rockhound</Text>
          
          {metafieldDefinitions && metafieldDefinitions.length > 0 && (
            <BlockStack gap="200">
              {metafieldDefinitions.map((def, idx) => (
                <div key={idx} style={{ padding: "12px", border: "1px solid #E1E3E5", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text fontWeight="bold">{def.name} <Text as="span" tone="subdued">({def.key})</Text></Text>
                  <Text tone="subdued">{def.type.name}</Text>
                </div>
              ))}
            </BlockStack>
          )}
          {(!metafieldDefinitions || metafieldDefinitions.length === 0) && (
            <Text tone="subdued">No definitions found.</Text>
          )}
        </BlockStack>
      </Card>

      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">Add New Definition</Text>
          <InlineStack gap="400" blockAlign="end">
            <div style={{ flexGrow: 1, minHeight: "54px" }}>
              <TextField 
                label="Key" 
                value={newKey} 
                onChange={setNewKey} 
                autoComplete="off" 
                accessibilityLabel="New field key" 
              />
            </div>
            <div style={{ flexGrow: 1, minHeight: "54px" }}>
              <TextField 
                label="Display Name" 
                value={newName} 
                onChange={setNewName} 
                autoComplete="off" 
                accessibilityLabel="New field display name" 
              />
            </div>
            <div style={{ flexGrow: 1, minHeight: "54px" }}>
              <Select 
                label="Type" 
                options={[{ label: 'Single Line Text', value: 'single_line_text_field' }]} 
                value={newType} 
                onChange={setNewType} 
                accessibilityLabel="New field type" 
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <Button 
                size="large" 
                onClick={handleAdd} 
                accessibilityLabel="Create new metafield definition" 
                variant="primary"
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "addFieldDefinition"}
              >
                Add Field
              </Button>
            </div>
          </InlineStack>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products, snapshots = [], metafieldDefinitions = [] } = useLoaderData() || {};
  const navigate = useNavigate();

  const primaryFetcher = useFetcher();

  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'matrix', content: 'Field Matrix', accessibilityLabel: 'Field Matrix Tab' },
    { id: 'editor', content: 'Product Editor', accessibilityLabel: 'Product Editor Tab' },
    { id: 'bulk', content: 'Bulk Tools', accessibilityLabel: 'Bulk Tools Tab' },
    { id: 'snapshots', content: 'Snapshots & Export', accessibilityLabel: 'Snapshots and Export Tab' },
    { id: 'manager', content: 'Field Manager', accessibilityLabel: 'Field Manager Tab' }
  ];

  return (
    <Frame>
      <Page
        fullWidth
        title="Meta Injector v2"
        subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {primaryFetcher.data && primaryFetcher.data.errors && primaryFetcher.data.errors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {primaryFetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="600">
                  {selectedTab === 0 && (
                    <FieldMatrixTab 
                      products={products} 
                    />
                  )}
                  {selectedTab === 1 && (
                    <ProductEditorTab 
                      products={products} 
                      fetcher={primaryFetcher} 
                      shopify={shopify} 
                    />
                  )}
                  {selectedTab === 2 && (
                    <BulkToolsTab 
                      fetcher={primaryFetcher} 
                      shopify={shopify}
                    />
                  )}
                  {selectedTab === 3 && (
                    <SnapshotsExportTab 
                      snapshots={snapshots} 
                      fetcher={primaryFetcher} 
                      shopify={shopify}
                    />
                  )}
                  {selectedTab === 4 && (
                    <FieldManagerTab 
                      metafieldDefinitions={metafieldDefinitions} 
                      fetcher={primaryFetcher} 
                      shopify={shopify}
                    />
                  )}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
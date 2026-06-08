import React, { useState, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, InlineStack, Icon
} from "@shopify/polaris";
import { MagicIcon, SaveIcon } from "@shopify/polaris-icons";

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

// --- TAB 1: THE INTAKE BENCH ---
function IntakeBenchTab({ products, fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    const product = products.find(p => p.id === id);
    const newForm = {};
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      product.metafields.edges.forEach(({ node }) => {
        const isRockhound = node.namespace === "rockhound";
        const hasValue = node.value !== null && node.value !== undefined;
        if (isRockhound && hasValue) {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);
  }, [products]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    fetcher.submit(
      { intent: "autoFill", productId: selectedProductId },
      { method: "post" }
    );
  }, [selectedProductId, fetcher]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");
    
    const payload = [];
    const entries = Object.entries(formState);
    
    entries.forEach(([key, value]) => {
      const isPopulated = value !== undefined && value !== null && value.toString().trim() !== "";
      
      if (isPopulated) {
        const config = ROCKHOUND_FIELDS.find(f => f.key === key);
        let fieldType = "single_line_text_field";
        if (config && config.type) {
          fieldType = config.type;
        }
        
        let formatId = `gid://shopify/Product/${selectedProductId}`;
        if (selectedProductId.includes("gid://")) {
          formatId = selectedProductId;
        }

        payload.push({
          ownerId: formatId,
          namespace: "rockhound",
          key: key,
          value: value.toString().trim(),
          type: fieldType 
        });
      }
    });

    if (payload.length === 0) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    fetcher.submit(
      { intent: "saveProduct", payload: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [selectedProductId, formState, fetcher]);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;
    
    if (isIdle && hasData) {
      const isAutoFill = fetcher.data.intent === "autoFill";
      const isSaveProduct = fetcher.data.intent === "saveProduct";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if (isAutoFill && isSuccess) {
        setFormState(prev => ({ ...prev, ...fetcher.data.autoFillData }));
        setStatusMessage("Title and tags successfully parsed and loaded into fields.");
      }

      if (isSaveProduct && isSuccess) {
        setStatusMessage("Metafields injected cleanly into Shopify database.");
      }

      if (isError) {
        setErrorMessage(fetcher.data.error || "An unknown error occurred during the operation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const safeProducts = products || [];
  const isAutoFilling = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoFill";
  const isSaving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveProduct";

  return (
    <BlockStack gap="400">
      <Layout>
        <Layout.Section variant="oneHalf">
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory</Text>
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {safeProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  return (
                    <div key={p.id} style={{ minHeight: "54px" }}>
                      <Button
                        fullWidth
                        size="large"
                        textAlign="left"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => handleSelectProduct(p.id)}
                        accessibilityLabel={`Select product ${p.title}`}
                      >
                        {p.title}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneHalf">
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">2. Data Sieve & Injection</Text>
              
              {statusMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{statusMessage}</Text>
                  </Banner>
                </div>
              )}

              {errorMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{errorMessage}</Text>
                  </Banner>
                </div>
              )}

              <InlineStack gap="300" align="space-between">
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={MagicIcon} 
                    onClick={handleAutoFill}
                    accessibilityLabel="Auto-Fill Fields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isAutoFilling}
                  >
                    Auto-Fill From Title
                  </Button>
                </div>
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={SaveIcon} 
                    tone="success" 
                    variant="primary" 
                    onClick={handleInject}
                    accessibilityLabel="Inject Metafields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isSaving}
                  >
                    Inject Metafields
                  </Button>
                </div>
              </InlineStack>

              <div style={{ maxHeight: "60vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "16px" }}>
                {ROCKHOUND_FIELDS.map(field => {
                  const val = formState[field.key] || "";
                  const isDropdown = field.isDropdown === true;
                  const isText = !field.isDropdown;
                  
                  return (
                    <div key={field.key} style={{ minHeight: "54px" }}>
                      {isDropdown && (
                        <Select
                          label={field.label}
                          options={[{ label: "Select...", value: "" }, ...(DEFAULT_DROPDOWNS[field.key] || []).map(o => ({ label: o, value: o }))]}
                          value={val}
                          onChange={(v) => updateFormState(field.key, v)}
                          accessibilityLabel={`Select value for ${field.label}`}
                          disabled={!selectedProductId}
                        />
                      )}

                      {isText && (
                        <TextField
                          label={field.label}
                          value={val}
                          onChange={(v) => updateFormState(field.key, v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter text for ${field.label}`}
                          multiline={field.multiline && 3}
                          disabled={!selectedProductId}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );
}

// --- TAB 2: OPERATIONS MATRIX (PLACEHOLDER) ---
function OperationsMatrixTab() {
  return (
    <BlockStack gap="400">
      <Card padding="600">
        <BlockStack gap="400" align="center" inlineAlign="center">
          <Text variant="headingLg" as="h2" alignment="center">Operations Matrix</Text>
          <Text variant="bodyLg" as="p" alignment="center" tone="subdued">Coming Soon</Text>
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const navigate = useNavigate();
  const primaryFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'intake', content: '1. Intake Bench (Janyce)', accessibilityLabel: 'Intake Bench Tab' },
    { id: 'ops', content: '2. Operations Matrix', accessibilityLabel: 'Operations Matrix Tab' }
  ];

  const hasErrors = primaryFetcher.data && primaryFetcher.data.errors && primaryFetcher.data.errors.length > 0;
  const isTabOne = selectedTab === 0;
  const isTabTwo = selectedTab === 1;

  return (
    <Frame>
      <Page
        fullWidth
        title="Shop Floor Command Center"
        subtitle="Data Integrity & Operations Hub"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {hasErrors && (
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
                <Box padding="600" background="bg-surface-secondary">
                  {isTabOne && <IntakeBenchTab products={products} fetcher={primaryFetcher} />}
                  {isTabTwo && <OperationsMatrixTab />}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
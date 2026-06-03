import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, Combobox, Listbox, Icon, InlineStack, FormLayout
} from "@shopify/polaris";
import { SearchIcon, MagicIcon } from "@shopify/polaris-icons";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";

// --- IMPORT THE CONSTANTS ---
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

// --- IMPORT THE TABS ---
import { MatrixTab } from "./app.meta-injector.matrix";
import { InspectorTab } from "./app.meta-injector.inspector";
import { OriginsTab } from "./app.meta-injector.origins";
import { ProfilesTab } from "./app.meta-injector.profiles";
import { SnapshotsTab } from "./app.meta-injector.snapshots";
import { CsvTab } from "./app.meta-injector.csv";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

// --- INJECTOR UI (Replaces standard import to ensure Janyce-proof architecture) ---
function InjectorUI({ fetcher, products, shopify }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [comboboxValue, setComboboxValue] = useState("");
  const [formState, setFormState] = useState({});
  const [currentProductTitle, setCurrentProductTitle] = useState("");

  const filteredProducts = useMemo(() => {
    if (!comboboxValue) return products;
    return products.filter(p => p.title.toLowerCase().includes(comboboxValue.toLowerCase()));
  }, [products, comboboxValue]);

  const handleProductSelect = useCallback((value) => {
    setSelectedProductId(value);
    const product = products.find(p => p.id === value);
    if (product) {
      setComboboxValue(product.title);
      setCurrentProductTitle(product.title);
      const newForm = {};
      if (product.metafields && product.metafields.edges) {
        product.metafields.edges.forEach(({ node }) => {
          if (node.namespace === "custom") {
            newForm[node.key] = node.value;
          }
        });
      }
      setFormState(newForm);
      if (shopify) shopify.toast.show(`Loaded fields for ${product.title}`);
    }
  }, [products, shopify]);

  const handleFieldChange = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClear = useCallback(() => {
    setFormState({});
    setSelectedProductId("");
    setComboboxValue("");
    setCurrentProductTitle("");
    if (shopify) shopify.toast.show("Form cleared");
  }, [shopify]);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) {
      if (shopify) shopify.toast.show("Please select a product first", { isError: true });
      return;
    }

    setFormState(prev => {
      const newState = { ...prev };
      
      const setIfEmpty = (key, value) => {
        if (!newState[key] || newState[key].trim() === "") {
          newState[key] = value;
        }
      };

      setIfEmpty("handcrafted_by", "Bob and Janyce");
      setIfEmpty("is_one_of_a_kind", "Yes");
      setIfEmpty("treated", "No");
      setIfEmpty("found_object", "Yes");
      setIfEmpty("surface_finish", "Polished");

      const titleLower = currentProductTitle.toLowerCase();
      
      const stoneFamilies = ["Jasper", "Agate", "Obsidian", "Opal", "Labradorite", "Serpentine", "Chert", "Quartz", "Chalcedony", "Petrified Wood", "Breccia"];
      for (const family of stoneFamilies) {
        if (titleLower.includes(family.toLowerCase())) {
          setIfEmpty("stone_family", family);
          setIfEmpty("material", family);
          break;
        }
      }

      const colors = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "Pink", "Brown", "Black", "White", "Grey", "Gray", "Cream", "Tan", "Gold", "Silver", "Multi"];
      for (const color of colors) {
        if (titleLower.includes(color.toLowerCase())) {
          setIfEmpty("color", color);
          break;
        }
      }

      const product = products.find(p => p.id === selectedProductId);
      if (product && product.collections && product.collections.edges) {
        const collectionTitles = product.collections.edges.map(e => e.node.title);
        
        if (collectionTitles.length > 0) {
          setIfEmpty("collection_name", collectionTitles.join(", "));
          
          const knownTrips = ["Richardson Strike", "3000-Mile Run", "Nickel Back Collection", "Yakima River", "Spencer Opal Mine"];
          for (const trip of knownTrips) {
            if (collectionTitles.some(title => title.toLowerCase().includes(trip.toLowerCase()))) {
              setIfEmpty("trip_or_series", trip);
              break;
            }
          }
        }
      }

      return newState;
    });

    if (shopify) shopify.toast.show("Auto-Fill applied to empty fields");
  }, [selectedProductId, currentProductTitle, products, shopify]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) {
      if (shopify) shopify.toast.show("Please select a product first", { isError: true });
      return;
    }

    const payload = Object.entries(formState).map(([key, value]) => ({
      ownerId: selectedProductId,
      namespace: "custom",
      key,
      value: value.toString(),
      type: "single_line_text_field" 
    })).filter(mf => mf.value !== "");

    const formData = new FormData();
    formData.append("intent", "saveMetafields");
    formData.append("payload", JSON.stringify(payload));

    fetcher.submit(formData, { method: "post" });
  }, [selectedProductId, formState, fetcher, shopify]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (shopify) shopify.toast.show(fetcher.data.message || "Metafields securely updated");
      } else if (fetcher.data.errors && fetcher.data.errors.length > 0) {
        if (shopify) shopify.toast.show("Failed to save some fields. Check errors above.", { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const UI_GROUPS = [
    { id: "green", title: "Always Fill", hex: "#2E7D32", keys: ["piece_name", "primary_medium", "handcrafted_by", "is_one_of_a_kind", "treated"] },
    { id: "blue", title: "Stone Fields", hex: "#1565C0", keys: ["material", "stone_family", "color", "cut_and_shape", "surface_finish", "dimensions_mm", "weight_grams"] },
    { id: "orange", title: "Story & Lore", hex: "#E65100", keys: ["origin_story", "trip_or_series", "honest_flaws_and_character", "artist_notes", "collection_name"] },
    { id: "purple", title: "Mixed Media", hex: "#6A1B9A", keys: ["secondary_medium", "found_object"] },
    { id: "yellow", title: "Google / SEO", hex: "#F9A825", keys: ["primary_use", "setting_ready", "bail_included"] }
  ];

  return (
    <BlockStack gap="600">
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingLg" as="h2">Select a Piece</Text>
            {selectedProductId && (
              <Button 
                icon={MagicIcon} 
                onClick={handleAutoFill} 
                accessibilityLabel="Auto-Fill Empty Fields"
                tone="success"
              >
                Auto-Fill
              </Button>
            )}
          </InlineStack>
          <Combobox
            allowMultiple={false}
            activator={
              <Combobox.TextField
                prefix={<Icon source={SearchIcon} />}
                onChange={setComboboxValue}
                label="Search Products"
                labelHidden
                value={comboboxValue}
                placeholder="Search for a piece to inject..."
                autoComplete="off"
                accessibilityLabel="Search Products"
              />
            }
          >
            {filteredProducts.length > 0 && (
              <Listbox onSelect={handleProductSelect}>
                {filteredProducts.map(p => (
                  <Listbox.Option key={p.id} value={p.id} selected={selectedProductId === p.id} accessibilityLabel={p.title}>
                    {p.title}
                  </Listbox.Option>
                ))}
              </Listbox>
            )}
          </Combobox>
        </BlockStack>
      </Card>

      {UI_GROUPS.map(group => {
        const groupFields = METAFIELD_CONFIG.filter(f => group.keys.includes(f.key));
        if (groupFields.length === 0) return null;

        return (
          <Box key={group.id} paddingBlockEnd="400">
            <div style={{ backgroundColor: group.hex, padding: "16px", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
              <Text variant="headingMd" as="h3" tone="textInverse">{group.title}</Text>
            </div>
            <div style={{ backgroundColor: "#FFFFFF", padding: "24px", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", border: "1px solid #E1E3E5", borderTop: "none" }}>
              <FormLayout>
                {groupFields.map(field => {
                  const value = formState[field.key] || "";
                  const isLargeField = ["origin_story", "honest_flaws_and_character", "artist_notes"].includes(field.key);
                  
                  if (field.options && field.options.length > 0) {
                    const uniqueOptions = [{ label: "Select...", value: "" }, ...field.options.map(o => (typeof o === 'string' ? { label: o, value: o } : o))];
                    return (
                      <Select
                        key={field.key}
                        label={field.label}
                        options={uniqueOptions}
                        value={value}
                        onChange={(val) => handleFieldChange(field.key, val)}
                        accessibilityLabel={field.label}
                      />
                    );
                  }
                  
                  return (
                    <TextField
                      key={field.key}
                      label={field.label}
                      value={value}
                      onChange={(val) => handleFieldChange(field.key, val)}
                      autoComplete="off"
                      accessibilityLabel={field.label}
                      multiline={isLargeField ? 3 : false}
                    />
                  );
                })}
              </FormLayout>
            </div>
          </Box>
        );
      })}

      <InlineStack gap="400" align="end">
        <div style={{ minHeight: '52px', minWidth: '140px' }}>
          <Button size="large" onClick={handleClear} accessibilityLabel="Clear all fields">Clear Form</Button>
        </div>
        <div style={{ minHeight: '52px', minWidth: '180px' }}>
          <Button size="large" variant="primary" onClick={handleInject} accessibilityLabel="Save to Shopify" loading={fetcher.state !== "idle"}>Save to Shopify</Button>
        </div>
      </InlineStack>
    </BlockStack>
  );
}

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products, snapshots = [], dbProfiles = [], metaobjectHandles = {}, dynamicMetaobjectOptions = {} } = useLoaderData();
  const navigate = useNavigate();

  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'northstar', content: '⭐ North Star Auto-Fill', panelID: 'panel-northstar' },
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'DB Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
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
            {actionFetcher.data && actionFetcher.data.errors && actionFetcher.data.errors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionFetcher.data.errors.map((err, i) => (
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
                    <InjectorUI
                      fetcher={actionFetcher}
                      products={products}
                      shopify={shopify}
                    />
                  )}
                  {selectedTab === 1 && (
                    <MatrixTab
                      fetcher={actionFetcher}
                      products={products}
                      metaobjectHandles={metaobjectHandles}
                      onInspectProduct={() => setSelectedTab(2)}
                    />
                  )}
                  {selectedTab === 2 && (
                    <InspectorTab
                      fetcher={inspectorFetcher}
                      products={products}
                    />
                  )}
                  {selectedTab === 3 && (
                    <OriginsTab
                      fetcher={originFetcher}
                    />
                  )}
                  {selectedTab === 4 && (
                    <ProfilesTab
                      fetcher={profileFetcher}
                      products={products}
                      dbProfiles={dbProfiles}
                      shopify={shopify}
                    />
                  )}
                  {selectedTab === 5 && (
                    <SnapshotsTab
                      fetcher={snapshotFetcher}
                      snapshots={snapshots}
                    />
                  )}
                  {selectedTab === 6 && (
                    <CsvTab
                      fetcher={actionFetcher}
                      products={products}
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
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame,
  TextField, Select, Button, Icon, InlineStack, Checkbox
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

const StatusIcon = ({ value }) => {
  const valStr = (value || "").toString().trim().toLowerCase();
  
  let color = "#C62828"; // 🔴 Red: Completely empty
  let label = "Empty field";
  
  if (valStr === "n/a") {
    color = "#F9A825"; // 🟡 Yellow: N/A acknowledged
    label = "N/A value";
  } else if (valStr !== "") {
    color = "#2E7D32"; // 🟢 Green: Has real value
    label = "Field complete";
  }

  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      aria-label={label}
      role="img"
      style={{ flexShrink: 0 }}
    >
      <circle cx="7" cy="7" r="7" fill={color} />
    </svg>
  );
};

// --- INJECTOR UI (2-Column Architecture) ---
function InjectorUI({ fetcher, products, shopify }) {
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [formState, setFormState] = useState({});
  
  // Single Mode State
  const [selectedProductId, setSelectedProductId] = useState("");
  const [currentProductTitle, setCurrentProductTitle] = useState("");
  
  // Bulk Mode State
  const [selectedProductIds, setSelectedProductIds] = useState([]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    return products.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [products, searchQuery]);

  const handleModeToggle = useCallback((bulk) => {
    setIsBulkMode(bulk);
    setFormState({});
    setSelectedProductId("");
    setSelectedProductIds([]);
    setCurrentProductTitle("");
  }, []);

  const handleSingleSelect = useCallback((product) => {
    setSelectedProductId(product.id);
    setCurrentProductTitle(product.title);
    
    const newForm = {};
    if (product.metafields && product.metafields.edges) {
      product.metafields.edges.forEach(({ node }) => {
        if (node.namespace === "rockhound") {
          newForm[node.key] = node.value;
        }
      });
    }
    setFormState(newForm);
    if (shopify) shopify.toast.show(`Loaded fields for ${product.title}`);
  }, [shopify]);

  const toggleBulkSelection = useCallback((id) => {
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  }, []);

  const handleFieldChange = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleClear = useCallback(() => {
    setFormState({});
    if (!isBulkMode) {
      setSelectedProductId("");
      setCurrentProductTitle("");
    } else {
      setSelectedProductIds([]);
    }
    if (shopify) shopify.toast.show("Form cleared");
  }, [isBulkMode, shopify]);

  const handleAutoFill = useCallback(() => {
    if (isBulkMode) return; // Auto-fill disabled in bulk mode
    
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
  }, [selectedProductId, currentProductTitle, products, isBulkMode, shopify]);

  const handleInject = useCallback(() => {
    const targetIds = isBulkMode ? selectedProductIds : (selectedProductId ? [selectedProductId] : []);

    if (targetIds.length === 0) {
      if (shopify) shopify.toast.show(`Please select ${isBulkMode ? 'at least one' : 'a'} product first`, { isError: true });
      return;
    }

    const validEntries = Object.entries(formState).filter(([key, value]) => value !== undefined && value.toString().trim() !== "");

    if (validEntries.length === 0) {
      if (shopify) shopify.toast.show("No fields filled out to save.", { isError: true });
      return;
    }

    const payload = [];
    
    targetIds.forEach(id => {
      validEntries.forEach(([key, value]) => {
        const config = METAFIELD_CONFIG.find(f => f.key === key);
        const fieldType = config && config.type ? config.type : "single_line_text_field";

        payload.push({
          ownerId: id,
          namespace: "rockhound",
          key,
          value: value.toString(),
          type: fieldType 
        });
      });
    });

    const formData = new FormData();
    formData.append("intent", "saveMetafields");
    formData.append("payload", JSON.stringify(payload));

    fetcher.submit(formData, { method: "post" });
  }, [selectedProductId, selectedProductIds, isBulkMode, formState, fetcher, shopify]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.success) {
        if (shopify) shopify.toast.show(fetcher.data.message || "Metafields securely updated");
        // Clear form immediately after successful bulk save to prevent accidental overwrites
        if (isBulkMode) {
            setFormState({});
            setSelectedProductIds([]);
        }
      } else if (fetcher.data.errors && fetcher.data.errors.length > 0) {
        if (shopify) shopify.toast.show("Failed to save some fields. Check errors above.", { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data, isBulkMode, shopify]);

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
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" as="h2">Database Injector</Text>
          <InlineStack gap="300">
            <div style={{ minHeight: "44px" }}>
              <Button 
                size="large" 
                pressed={!isBulkMode} 
                onClick={() => handleModeToggle(false)}
                accessibilityLabel="Switch to Single Product Mode"
              >
                Single Product
              </Button>
            </div>
            <div style={{ minHeight: "44px" }}>
              <Button 
                size="large" 
                pressed={isBulkMode} 
                onClick={() => handleModeToggle(true)}
                accessibilityLabel="Switch to Bulk Edit Mode"
              >
                Bulk Edit
              </Button>
            </div>
          </InlineStack>
        </InlineStack>
      </Card>

      <Layout>
        <Layout.Section variant="oneThird">
          <Card padding="400">
            <BlockStack gap="400">
              <TextField
                prefix={<Icon source={SearchIcon} />}
                onChange={setSearchQuery}
                label="Search Products"
                labelHidden
                value={searchQuery}
                placeholder="Search inventory..."
                autoComplete="off"
                accessibilityLabel="Search inventory"
              />
              
              <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
                {filteredProducts.map(p => {
                  const isSelected = isBulkMode ? selectedProductIds.includes(p.id) : selectedProductId === p.id;
                  
                  return (
                    <div
                      key={p.id}
                      onClick={() => isBulkMode ? toggleBulkSelection(p.id) : handleSingleSelect(p)}
                      style={{
                        padding: "16px 20px",
                        minHeight: "64px",
                        border: isSelected ? "2px solid #2E7D32" : "1px solid #E1E3E5",
                        borderRadius: "8px",
                        cursor: "pointer",
                        backgroundColor: isSelected ? "#F3F8F4" : "#FFFFFF",
                        display: "flex",
                        alignItems: "center",
                        gap: "16px",
                        transition: "all 0.15s ease-in-out"
                      }}
                      role="button"
                      aria-label={`Select ${p.title}`}
                      aria-pressed={isSelected}
                    >
                      {isBulkMode && (
                        <div style={{ pointerEvents: "none" }}>
                          <Checkbox checked={isSelected} onChange={() => {}} ariaDescribedBy={`Select ${p.title}`} />
                        </div>
                      )}
                      <Text fontWeight={isSelected ? "bold" : "regular"} as="span">{p.title}</Text>
                    </div>
                  );
                })}
                {filteredProducts.length === 0 && (
                  <Box padding="400">
                    <Text tone="subdued" alignment="center">No products found matching "{searchQuery}"</Text>
                  </Box>
                )}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="400">
            {(!isBulkMode && selectedProductId) && (
              <InlineStack align="end">
                <Button 
                  icon={MagicIcon} 
                  onClick={handleAutoFill} 
                  accessibilityLabel="Auto-Fill Empty Fields"
                  tone="success"
                  size="large"
                >
                  Auto-Fill
                </Button>
              </InlineStack>
            )}

            {isBulkMode && (
              <Banner tone="info" title="Bulk Edit Mode Active">
                <p>Fields left empty will be safely skipped. Filling a field will overwrite that data on <b>all {selectedProductIds.length} selected products</b>.</p>
              </Banner>
            )}

            <div style={{ maxHeight: "65vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px" }}>
              {UI_GROUPS.map(group => {
                const groupFields = METAFIELD_CONFIG.filter(f => group.keys.includes(f.key));
                if (groupFields.length === 0) return null;

                const totalInGroup = groupFields.length;
                const completedCount = groupFields.filter(f => {
                  const valStr = (formState[f.key] || "").toString().trim().toLowerCase();
                  return valStr !== "" && valStr !== "n/a";
                }).length;

                return (
                  <Box key={group.id}>
                    <div style={{ backgroundColor: group.hex, padding: "16px", borderTopLeftRadius: "8px", borderTopRightRadius: "8px" }}>
                      <Text variant="headingMd" as="h3" tone="textInverse">
                        {group.title} {!isBulkMode && `— ${completedCount} / ${totalInGroup} active`}
                      </Text>
                    </div>
                    <div style={{ backgroundColor: "#FFFFFF", padding: "24px", borderBottomLeftRadius: "8px", borderBottomRightRadius: "8px", border: "1px solid #E1E3E5", borderTop: "none" }}>
                      <BlockStack gap="400">
                        {groupFields.map(field => {
                          const value = formState[field.key] || "";
                          const isLargeField = ["origin_story", "honest_flaws_and_character", "artist_notes"].includes(field.key);
                          
                          const labelWithIcon = (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                              <StatusIcon value={value} />
                              {field.label}
                            </span>
                          );
                          
                          if (field.options && field.options.length > 0) {
                            const uniqueOptions = [{ label: "Select...", value: "" }, ...field.options.map(o => (typeof o === 'string' ? { label: o, value: o } : o))];
                            return (
                              <Select
                                key={field.key}
                                label={labelWithIcon}
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
                              label={labelWithIcon}
                              value={value}
                              onChange={(val) => handleFieldChange(field.key, val)}
                              autoComplete="off"
                              accessibilityLabel={field.label}
                              multiline={isLargeField ? 3 : false}
                            />
                          );
                        })}
                      </BlockStack>
                    </div>
                  </Box>
                );
              })}
            </div>

            <InlineStack gap="400" align="end">
              <div style={{ minHeight: '52px', minWidth: '140px' }}>
                <Button size="large" onClick={handleClear} accessibilityLabel="Clear all fields">Clear Form</Button>
              </div>
              <div style={{ minHeight: '52px', minWidth: '180px' }}>
                <Button size="large" variant="primary" onClick={handleInject} accessibilityLabel="Save to Shopify" loading={fetcher.state !== "idle"}>
                  {isBulkMode ? `Save to ${selectedProductIds.length} Products` : "Save to Shopify"}
                </Button>
              </div>
            </InlineStack>

          </BlockStack>
        </Layout.Section>
      </Layout>
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
    { id: 'northstar', content: '⭐ Command Center', panelID: 'panel-northstar' },
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
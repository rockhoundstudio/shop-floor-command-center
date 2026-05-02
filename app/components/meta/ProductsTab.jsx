import { 
  TextField, BlockStack, Card, Text, Badge, Grid, Button, Banner, 
  InlineStack, Page, Layout, Select, Box, ButtonGroup, 
  ResourceList, ResourceItem, Thumbnail, Divider
} from "@shopify/polaris";
import { useState, useRef } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";

const availableStones = [
  "Agate", "Amethyst", "Aventurine", "Azurite", "Bloodstone", "Carnelian",
  "Chalcedony", "Chrysocolla", "Fluorite", "Garnet", "Hematite", "Howlite",
  "Jade", "Jasper", "Labradorite", "Lapis Lazuli", "Malachite", "Moonstone",
  "Obsidian", "Onyx", "Opal", "Pyrite", "Quartz", "Rhodochrosite",
  "Rhodonite", "Rose Quartz", "Serpentine", "Smoky Quartz", "Sodalite",
  "Sunstone", "Tiger's Eye", "Tourmaline", "Turquoise"
];

export default function ProductsTab({ products = [] }) {
  const shopify = useAppBridge();

  // --- UI STATE ---
  const [viewMode, setViewMode] = useState("list"); 
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  // --- DATA STATE ---
  const [fieldValues, setFieldValues] = useState({});
  const [customName, setCustomName] = useState(""); 
  const [baseFields, setBaseFields] = useState({ title: "", description: "", status: "DRAFT", price: "0.00", inventory: "1" });
  const mergedApplied = useRef(false);

  // --- FETCHERS ---
  const saveFetcher  = useFetcher();
  const autoFetcher  = useFetcher();
  const bulkFetcher  = useFetcher();
  const seedFetcher  = useFetcher();

  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  // --- FUNCTIONS ---
  function openEditor(product) {
    const initial = {};
    TARGET_KEYS.forEach(key => {
      initial[key] = product.metafields?.[key] || "";
    });
    
    const existingName = initial.official_name || product.title || "";
    if (existingName && !availableStones.includes(existingName)) {
      initial.official_name = "__custom__";
      setCustomName(existingName);
    } else {
      initial.official_name = existingName;
    }
    
    if (!initial.stone_story) initial.stone_story = product.description || "";
    
    setBaseFields({
      title: product.title || "",
      description: product.description || "",
      status: product.status || "DRAFT",
      price: product.price || "0.00", 
      inventory: "1" 
    });

    setFieldValues(initial);
    setSelected(product);
    mergedApplied.current = false;
  }

  function handleSave() {
    const metafields = TARGET_KEYS.map(key => ({
      ownerId: selected.id,
      namespace: "custom", 
      key,
      value: key === "official_name" && fieldValues[key] === "__custom__" ? customName : (fieldValues[key] || ""),
      type: "single_line_text_field", 
    }));
    saveFetcher.submit(
      { intent: "saveMetafields", metafields: JSON.stringify(metafields) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleAutoFill() {
    mergedApplied.current = false;
    const finalName = fieldValues.official_name === "__custom__" ? customName : fieldValues.official_name;
    
    autoFetcher.submit(
      {
        intent: "autoFill",
        title: baseFields.title,
        description: baseFields.description || "",
        existingMeta: JSON.stringify({ ...fieldValues, official_name: finalName }),
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  if (autoFetcher.state === "idle" && autoFetcher.data?.merged && !mergedApplied.current) {
    const merged = autoFetcher.data.merged;
    const hasNew = Object.keys(merged).some(k => merged[k] !== fieldValues[k]);
    if (hasNew) {
      mergedApplied.current = true;
      setFieldValues(prev => ({ ...prev, ...merged }));
    }
  }

  function handleBulkFill() {
    const payload = products.map(p => ({
      id:          p.id,
      title:       p.title,
      description: p.description || "",
      metafields:  p.metafields  || {},
    }));
    bulkFetcher.submit(
      { intent: "bulkAutoFill", products: JSON.stringify(payload) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleSeed() {
    seedFetcher.submit(
      { 
        intent: "seed_names", 
        ids: JSON.stringify(products.map(p => p.id)) 
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  // --- STATUS TRACKERS ---
  const isSaving    = saveFetcher.state  !== "idle";
  const isAutoFill  = autoFetcher.state  !== "idle";
  const isBulk      = bulkFetcher.state  !== "idle";
  const saveSuccess = saveFetcher.state === "idle" && saveFetcher.data?.success;
  const saveError   = saveFetcher.state === "idle" && saveFetcher.data?.error;
  const conflicts   = autoFetcher.data?.conflicts  || [];
  const mindatError = autoFetcher.data?.mindatError;

  const bulkDone    = bulkFetcher.state === "idle" && bulkFetcher.data?.ok;
  const bulkFailed  = bulkFetcher.data?.failed     || [];
  const bulkTotal   = bulkFetcher.data?.total      || 0;

  // ==========================================
  // VIEW 1: THE DETAIL EDITOR (Single Stone)
  // ==========================================
  if (selected) {
    return (
      <Page 
        backAction={{ content: 'Back to Shop Floor', onAction: () => setSelected(null) }}
        title={baseFields.title || "Edit Stone"}
        primaryAction={{ content: 'Save Stone', onAction: handleSave, loading: isSaving, disabled: isAutoFill }}
        secondaryActions={[{ content: '🔍 Auto-Fill (Mindat)', onAction: handleAutoFill, loading: isAutoFill, disabled: isSaving }]}
      >
        <BlockStack gap="600">
          
          {saveSuccess && <Banner tone="success">Saved successfully to Shopify.</Banner>}
          {saveError   && <Banner tone="critical">Save failed: {saveFetcher.data?.error}</Banner>}
          {mindatError && <Banner tone="warning">Mindat unavailable: {mindatError}. Filled from geo library only.</Banner>}
          {conflicts.length > 0 && (
            <Banner tone="warning">
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} — Mindat data prioritized.{" "}
              {conflicts.map(c => `${FIELD_LABELS[c.key] || c.key}: library="${c.library}" vs mindat="${c.mindat}"`).join(" | ")}
            </Banner>
          )}

          <Layout>
            <Layout.Section>
              <BlockStack gap="500">
                
                <Card roundedAbove="sm">
                  <BlockStack gap="500">
                    <TextField 
                      label="Product Title" 
                      value={baseFields.title} 
                      onChange={val => setBaseFields(p => ({...p, title: val}))} 
                      autoComplete="off" 
                    />
                    <TextField 
                      label="Public Description & Story" 
                      value={baseFields.description} 
                      onChange={val => setBaseFields(p => ({...p, description: val}))} 
                      multiline={8} 
                      autoComplete="off" 
                    />
                  </BlockStack>
                </Card>

                <Card roundedAbove="sm">
                  <BlockStack gap="400">
                    <InlineStack align="space-between">
                      <Text as="h2" variant="headingSm">Media & Pictures</Text>
                      <Button size="micro">Add Media</Button>
                    </InlineStack>
                    <Box padding="400" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="025">
                      <InlineStack gap="400" wrap={false} blockAlign="center">
                        <div style={{ width: '120px', height: '120px', background: "#fff", borderRadius: '8px', overflow: 'hidden', border: '1px solid #e1e3e5' }}>
                          <img src={selected.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Hero" />
                        </div>
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#f4f6f8', borderRadius: '8px' }}></div>
                        <div style={{ width: '80px', height: '80px', border: '1px dashed #8c9196', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Text tone="subdued">+</Text></div>
                      </InlineStack>
                    </Box>
                  </BlockStack>
                </Card>

                <Card roundedAbove="sm">
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingSm">Lapidary Data (Meta Injector)</Text>
                    
                    <Box paddingBlockEnd="400" borderBlockEndWidth="025" borderColor="border">
                       <BlockStack gap="200">
                        <Text variant="bodyMd" fontWeight="bold">Official Name (Required for Mindat)</Text>
                        <select
                          style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #c9cccf", fontSize: "14px" }}
                          value={fieldValues["official_name"] || ""}
                          onChange={(e) => setFieldValues({ ...fieldValues, official_name: e.target.value })}
                        >
                          <option value="">-- Select Valid Mindat Stone --</option>
                          {availableStones.map(stone => (
                            <option key={stone} value={stone}>{stone}</option>
                          ))}
                          <option value="__custom__">➕ Add New Stone...</option>
                        </select>
                        
                        {fieldValues["official_name"] === "__custom__" && (
                          <TextField
                            label="Type new stone name"
                            value={customName}
                            onChange={setCustomName}
                            autoComplete="off"
                            placeholder="e.g. Rhodochrosite"
                          />
                        )}
                      </BlockStack>
                    </Box>

                    <BlockStack gap="300">
                      {TARGET_KEYS.filter(key => key !== "official_name").map(key => (
                        <TextField
                          key={key}
                          label={FIELD_LABELS[key] || key}
                          value={fieldValues[key] || ""}
                          onChange={val => setFieldValues(prev => ({ ...prev, [key]: val }))}
                          autoComplete="off"
                          multiline={["stone_story", "bench_notes", "character_marks", "rock_composition"].includes(key) ? 3 : undefined}
                        />
                      ))}
                    </BlockStack>
                  </BlockStack>
                </Card>

              </BlockStack>
            </Layout.Section>

            {/* RIGHT COLUMN: Quick Toggles */}
            <Layout.Section variant="oneThird">
              <BlockStack gap="500">
                <Card roundedAbove="sm">
                  <BlockStack gap="400">
                    <Select 
                      label="Store Status" 
                      options={[{label: 'Active (Live)', value: 'ACTIVE'}, {label: 'Draft (Hidden)', value: 'DRAFT'}]} 
                      value={baseFields.status} 
                      onChange={val => setBaseFields(p => ({...p, status: val}))} 
                    />
                  </BlockStack>
                </Card>
                <Card roundedAbove="sm">
                  <BlockStack gap="400">
                    <TextField 
                      label="Price" 
                      type="number" 
                      value={baseFields.price} 
                      onChange={val => setBaseFields(p => ({...p, price: val}))} 
                      autoComplete="off" prefix="$" 
                    />
                  </BlockStack>
                </Card>
                <Card roundedAbove="sm">
                  <BlockStack gap="400">
                    <TextField 
                      label="Available Inventory" 
                      type="number" 
                      value={baseFields.inventory} 
                      onChange={val => setBaseFields(p => ({...p, inventory: val}))} 
                      autoComplete="off" 
                    />
                  </BlockStack>
                </Card>
              </BlockStack>
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>
    );
  }

  // ==========================================
  // VIEW 2: THE MASTER GALLERY (Inventory)
  // ==========================================
  return (
    <BlockStack gap="400">
      <InlineStack align="space-between" blockAlign="center">
        <Text variant="headingMd" as="h2">Inventory ({products.length} Stones)</Text>
        <ButtonGroup segmented>
          <Button pressed={viewMode === "list"} onClick={() => setViewMode("list")}>List View</Button>
          <Button pressed={viewMode === "grid"} onClick={() => setViewMode("grid")}>Icon View</Button>
        </ButtonGroup>
      </InlineStack>

      <TextField
        value={search} onChange={setSearch} autoComplete="off" placeholder="Search gemstone title..."
        clearButton onClearButtonClick={() => setSearch("")} prefix="🔍"
      />

      <Card>
        <BlockStack gap="400">
          
          {/* SEEDER ROW */}
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingSm" fontWeight="bold">🌱 1. Seed Official Names</Text>
              <Text variant="bodySm" tone="subdued">Matches GIDs from officialNames.json and saves them safely to Shopify.</Text>
            </BlockStack>
            <Button onClick={handleSeed} loading={seedFetcher.state !== "idle"} disabled={seedFetcher.state !== "idle" || isBulk}>
              Seed Official Names
            </Button>
          </InlineStack>
          
          {seedFetcher.data?.ok && seedFetcher.state === "idle" && (
            <Banner tone="success">Seeded {seedFetcher.data.seededCount} of {products.length} products successfully.</Banner>
          )}

          <Divider />

          {/* BULK AUTO-FILL ROW */}
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text variant="headingSm" fontWeight="bold">⚡ 2. Auto-Fill All Products</Text>
              <Text variant="bodySm" tone="subdued">Uses the seeded Official Names to pull geological data from Mindat.</Text>
            </BlockStack>
            <Button variant="primary" onClick={handleBulkFill} loading={isBulk} disabled={isBulk || seedFetcher.state !== "idle"}>
              {isBulk ? "Filling all products…" : "Auto-Fill All"}
            </Button>
          </InlineStack>
          
          {isBulk && <Banner tone="info">Running — this may take 1–2 minutes. Do not close the tab.</Banner>}
          {bulkDone && (
            <Banner tone={bulkFailed.length > 0 ? "warning" : "success"}>
              {bulkFailed.length === 0
                ? `All ${bulkTotal} products filled successfully.`
                : `Done — ${bulkTotal - bulkFailed.length} filled, ${bulkFailed.length} issue(s).`}
            </Banner>
          )}

        </BlockStack>
      </Card>

      {filtered.length === 0 && <Text tone="subdued">No products match your search.</Text>}

      {viewMode === "list" ? (
        <Card padding="0">
          <ResourceList
            items={filtered}
            renderItem={(p) => (
              <ResourceItem id={p.id} onClick={() => openEditor(p)} media={<Thumbnail source={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} alt={p.title} size="small" />}>
                <InlineStack align="space-between">
                  <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                  <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                    {p.status}
                  </Badge>
                </InlineStack>
              </ResourceItem>
            )}
          />
        </Card>
      ) : (
        <Grid>
          {filtered.map((p) => (
            <Grid.Cell key={p.id} columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3 }}>
              <div onClick={() => openEditor(p)} style={{ cursor: "pointer" }}>
                <Card padding="200">
                  <BlockStack gap="200">
                    <div style={{ height: "140px", background: "#f1f1f1", borderRadius: "4px", overflow: "hidden" }}>
                      <img src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt={p.title} />
                    </div>
                    <Text variant="bodySm" fontWeight="bold" truncate>{p.title}</Text>
                    <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>{p.status}</Badge>
                    <Text variant="bodyXs" tone="subdued">{p.filledCount} / {TARGET_KEYS.length} fields filled</Text>
                  </BlockStack>
                </Card>
              </div>
            </Grid.Cell>
          ))}
        </Grid>
      )}
    </BlockStack>
  );
}
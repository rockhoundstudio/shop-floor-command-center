import { TextField, BlockStack, Card, Text, Badge, Grid, Button, Banner, InlineStack, Spinner } from "@shopify/polaris";
import { useState } from "react";
import { useFetcher } from "react-router";
import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";

export default function ProductsTab({ products = [] }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [fieldValues, setFieldValues] = useState({});
  const saveFetcher  = useFetcher();
  const autoFetcher  = useFetcher();

  const filtered = products.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  function openEditor(product) {
    const initial = {};
    TARGET_KEYS.forEach(key => {
      initial[key] = product.metafields?.[key] || "";
    });
    if (!initial.official_name) initial.official_name = product.title || "";
    if (!initial.stone_story)   initial.stone_story   = product.description || "";
    setFieldValues(initial);
    setSelected(product);
  }

  function handleSave() {
    const metafields = TARGET_KEYS.map(key => ({
      ownerId: selected.id,
      namespace: "custom",
      key,
      value: fieldValues[key] || "",
      type: "single_line_text_field",
    }));
    saveFetcher.submit(
      { intent: "saveMetafields", metafields: JSON.stringify(metafields) },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  function handleAutoFill() {
    autoFetcher.submit(
      {
        intent: "autoFill",
        title: selected.title,
        description: selected.description || "",
        existingMeta: JSON.stringify(fieldValues),
      },
      { method: "post", action: "/app/meta-injector" }
    );
  }

  // Apply auto-fill results when they come back
  if (autoFetcher.state === "idle" && autoFetcher.data?.merged) {
    const merged = autoFetcher.data.merged;
    // Only apply if we haven't already applied this result
    const hasNew = Object.keys(merged).some(k => merged[k] !== fieldValues[k]);
    if (hasNew) {
      setFieldValues(prev => ({ ...prev, ...merged }));
      autoFetcher.data = null; // clear to prevent re-apply loop
    }
  }

  const isSaving   = saveFetcher.state !== "idle";
  const isAutoFill = autoFetcher.state !== "idle";
  const saveSuccess = saveFetcher.state === "idle" && saveFetcher.data?.success;
  const saveError   = saveFetcher.state === "idle" && saveFetcher.data?.error;
  const conflicts   = autoFetcher.data?.conflicts || [];

  // ── EDIT STONE VIEW ──────────────────────────────────────────────
  if (selected) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "80vh" }}>

        {/* Sticky header */}
        <div style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "#fff", paddingBottom: "12px",
          borderBottom: "1px solid #e1e3e5", marginBottom: "16px"
        }}>
          <InlineStack align="space-between" blockAlign="center">
            <Button variant="plain" onClick={() => setSelected(null)}>
              ← Back
            </Button>
            <Text variant="headingMd" fontWeight="bold">{selected.title}</Text>
            <InlineStack gap="200">
              <Button
                onClick={handleAutoFill}
                loading={isAutoFill}
                disabled={isAutoFill || isSaving}
              >
                🔍 Auto-Fill
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={isSaving}
                disabled={isSaving || isAutoFill}
              >
                Save Stone
              </Button>
            </InlineStack>
          </InlineStack>

          {saveSuccess && <Banner tone="success">Saved successfully.</Banner>}
          {saveError   && <Banner tone="critical">Save failed: {saveFetcher.data.error}</Banner>}

          {conflicts.length > 0 && (
            <Banner tone="warning">
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} found — Mindat data used.{" "}
              {conflicts.map(c => `${FIELD_LABELS[c.key] || c.key}: library="${c.library}" vs mindat="${c.mindat}"`).join(" | ")}
            </Banner>
          )}
        </div>

        {/* Scrollable fields */}
        <div style={{ overflowY: "auto", flex: 1, paddingRight: "8px" }}>
          <Card>
            <BlockStack gap="300">
              {TARGET_KEYS.map(key => (
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
          </Card>
        </div>
      </div>
    );
  }

  // ── PRODUCTS GRID ────────────────────────────────────────────────
  return (
    <BlockStack gap="400">
      <TextField
        label="Search Shop Floor"
        value={search}
        onChange={setSearch}
        autoComplete="off"
        placeholder="Search gemstone title..."
        clearButton
        onClearButtonClick={() => setSearch("")}
      />
      {filtered.length === 0 && <Text tone="subdued">No products match your search.</Text>}
      <Grid>
        {filtered.map((p) => (
          <Grid.Cell key={p.id} columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3 }}>
            <div
              onClick={() => openEditor(p)}
              style={{ cursor: "pointer" }}
              role="button" tabIndex={0}
              onKeyDown={e => e.key === "Enter" && openEditor(p)}
            >
              <Card padding="200">
                <BlockStack gap="200">
                  <div style={{ height: "140px", background: "#f1f1f1", borderRadius: "4px", overflow: "hidden" }}>
                    <img
                      src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      alt={p.title}
                    />
                  </div>
                  <Text variant="bodySm" fontWeight="bold" truncate>{p.title}</Text>
                  <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                    {p.status}
                  </Badge>
                  <Text variant="bodyXs" tone="subdued">{p.filledCount} / {TARGET_KEYS.length} fields filled</Text>
                </BlockStack>
              </Card>
            </div>
          </Grid.Cell>
        ))}
      </Grid>
    </BlockStack>
  );
}

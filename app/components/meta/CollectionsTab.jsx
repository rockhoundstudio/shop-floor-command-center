import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider, Banner, Grid, Badge, Icon, Tag } from "@shopify/polaris";
import { FolderIcon, SearchIcon } from "@shopify/polaris-icons";

export default function CollectionsTab({ products = [], collections = [], onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCollections = collections.filter(c =>
    c.title.toLowerCase() !== "all collections"
  );

  const handleCreate = () => {
    if (!newCollTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "createCollection");
    fd.append("title", newCollTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setNewCollTitle("");
  };

  const handleAssign = (productId, collectionId) => {
    if (!collectionId) return;
    const fd = new FormData();
    fd.append("intent", "assignCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post" });
  };

  const handleRemove = (productId, collectionId) => {
    const fd = new FormData();
    fd.append("intent", "removeCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post" });
  };

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Detect mobile via window width
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <BlockStack gap="500">
      <InlineStack align="start">
        <Button onClick={onBack}>⬅️ Back to Shop Floor</Button>
      </InlineStack>

      {fetcher.data?.ok && fetcher.state === "idle" && (
        <Banner tone="success">Action completed successfully.</Banner>
      )}

      <Grid>
        {/* LEFT: Manage Collections */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
          <BlockStack gap="400">
            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <Text variant="headingMd">➕ New Collection</Text>
                <Text variant="bodySm" tone="subdued">Create a new category for your shop.</Text>
                <BlockStack gap="200">
                  <TextField
                    value={newCollTitle}
                    onChange={setNewCollTitle}
                    placeholder="e.g. Rare Jaspers"
                    autoComplete="off"
                  />
                  <Button
                    variant="primary"
                    fullWidth
                    onClick={handleCreate}
                    disabled={!newCollTitle.trim()}
                    loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "createCollection"}
                  >
                    Create Collection
                  </Button>
                </BlockStack>
              </BlockStack>
            </Card>

            <Card roundedAbove="sm">
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd">🗂️ Active Collections</Text>
                  <Badge tone="info">{filteredCollections.length}</Badge>
                </InlineStack>
                <Divider />
                {filteredCollections.length === 0 && (
                  <Box paddingBlock="400">
                    <Text tone="subdued" alignment="center">No collections yet.</Text>
                  </Box>
                )}
                <BlockStack gap="200">
                  {filteredCollections.map((c) => (
                    <Box key={c.id} padding="200" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="025">
                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        <InlineStack gap="200" wrap={false} blockAlign="center">
                          <Icon source={FolderIcon} tone="base" />
                          <Text variant="bodyMd" fontWeight="bold" truncate>{c.title}</Text>
                        </InlineStack>
                        <Button size="micro" tone="critical" onClick={() => setDeleteTarget(c)}>
                          Delete
                        </Button>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </BlockStack>
            </Card>

            {deleteTarget && (
              <Banner tone="critical">
                <BlockStack gap="200">
                  <Text>Delete <strong>{deleteTarget.title}</strong>? Keeps your stones safe.</Text>
                  <InlineStack gap="200">
                    <Button tone="critical" variant="primary" onClick={() => {
                      const fd = new FormData();
                      fd.append("intent", "deleteCollection");
                      fd.append("id", deleteTarget.id);
                      fetcher.submit(fd, { method: "post" });
                      setDeleteTarget(null);
                    }}>Yes, Delete</Button>
                    <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
                  </InlineStack>
                </BlockStack>
              </Banner>
            )}
          </BlockStack>
        </Grid.Cell>

        {/* RIGHT: Assign Stones */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8 }}>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">🪨 Assign Stones</Text>
                <Badge>{filteredProducts.length} Stones</Badge>
              </InlineStack>

              <TextField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search stones by name..."
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
                prefix={<Icon source={SearchIcon} tone="base" />}
              />

              <Divider />

              {/* Column headers — desktop only */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: "12px", padding: "0 4px" }}
                className="hide-on-mobile">
                <Text variant="bodySm" fontWeight="bold" tone="subdued">STONE</Text>
                <Text variant="bodySm" fontWeight="bold" tone="subdued">COLLECTIONS</Text>
                <Text variant="bodySm" fontWeight="bold" tone="subdued">ADD TO</Text>
              </div>

              <Divider />

              {filteredProducts.length === 0 && (
                <Box paddingBlock="400">
                  <Text tone="subdued" alignment="center">No stones match your search.</Text>
                </Box>
              )}

              <Box style={{ maxHeight: "600px", overflowY: "auto" }}>
                <BlockStack gap="0">
                  {filteredProducts.map((p, index) => {
                    const stoneCols = (p.currentCollections ?? []).filter(c =>
                      c.title.toLowerCase() !== "all collections"
                    );
                    return (
                      <div
                        key={p.id}
                        style={{
                          padding: "12px 4px",
                          borderBottom: index !== filteredProducts.length - 1 ? "1px solid #e1e3e5" : "none",
                        }}
                      >
                        {/* Desktop: 3-column grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr", gap: "12px", alignItems: "center" }}
                          className="desktop-row">
                          <Text fontWeight="semibold" truncate>{p.title}</Text>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {stoneCols.length > 0
                              ? stoneCols.map(c => (
                                  <Tag key={c.id} onRemove={() => handleRemove(p.id, c.id)}>{c.title}</Tag>
                                ))
                              : <Text variant="bodyXs" tone="subdued">No Collections</Text>
                            }
                          </div>
                          <Select
                            options={[{ label: "Add to...", value: "" }, ...filteredCollections.map(c => ({ label: c.title, value: c.id }))]}
                            value=""
                            onChange={(val) => handleAssign(p.id, val)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </BlockStack>
              </Box>

            </BlockStack>
          </Card>
        </Grid.Cell>
      </Grid>

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 767px) {
          .desktop-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>

    </BlockStack>
  );
}

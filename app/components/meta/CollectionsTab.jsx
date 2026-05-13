import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider, Banner, Grid, Badge, Icon, Tag, Modal, Thumbnail } from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";

export default function CollectionsTab({ products = [], collections = [], onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCollection, setExpandedCollection] = useState(null);
  const [addingTo, setAddingTo] = useState(null);

  const filteredCollections = collections.filter(c =>
    c.title.toLowerCase() !== "all collections"
  );

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    if (!newCollTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "createCollection");
    fd.append("title", newCollTitle.trim());
    fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
    setNewCollTitle("");
  };

  const handleAssign = (productId, collectionId) => {
    if (!collectionId) return;
    const fd = new FormData();
    fd.append("intent", "assignCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
    setAddingTo(null);
  };

  const handleRemove = (productId, collectionId) => {
    const fd = new FormData();
    fd.append("intent", "removeCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
  };

  const handleDeleteConfirm = () => {
    const fd = new FormData();
    fd.append("intent", "deleteCollection");
    fd.append("id", deleteTarget.id);
    fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
    if (expandedCollection === deleteTarget.id) setExpandedCollection(null);
    setDeleteTarget(null);
  };

  return (
    <BlockStack gap="500">
      <InlineStack align="start">
        <Button onClick={onBack}>⬅️ Back to Shop Floor</Button>
      </InlineStack>

      {fetcher.data?.ok && fetcher.state === "idle" && (
        <Banner tone="success">Action completed successfully.</Banner>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Collection?"
        primaryAction={{
          content: "Yes, Delete",
          destructive: true,
          onAction: handleDeleteConfirm,
        }}
        secondaryActions={[{
          content: "Cancel",
          onAction: () => setDeleteTarget(null),
        }]}
      >
        <Modal.Section>
          <Text>Delete <strong>{deleteTarget?.title}</strong>? Your stones stay safe — they just leave this collection.</Text>
        </Modal.Section>
      </Modal>

      <Grid>
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
                <Text variant="bodySm" tone="subdued">Click a collection to see its stones.</Text>
                <Divider />
                {filteredCollections.length === 0 && (
                  <Box paddingBlock="400">
                    <Text tone="subdued" alignment="center">No collections yet.</Text>
                  </Box>
                )}
                <BlockStack gap="0">
                  {filteredCollections.map((c) => {
                    const isExpanded = expandedCollection === c.id;
                    const isAdding = addingTo === c.id;
                    const stonesInCollection = products.filter(p =>
                      (p.currentCollections ?? []).some(col => col.id === c.id)
                    );
                    const stonesNotInCollection = products.filter(p =>
                      !(p.currentCollections ?? []).some(col => col.id === c.id)
                    );
                    const stoneCount = stonesInCollection.length;

                    return (
                      <Box key={c.id}>
                        {/* COLLECTION ROW */}
                        <Box
                          padding="200"
                          background={isExpanded ? "bg-surface-selected" : "bg-surface-secondary"}
                          borderRadius="100"
                          borderColor={isExpanded ? "border-focus" : "border"}
                          borderWidth="025"
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: "8px" }}>
                            {/* TITLE — expand toggle */}
                            <button
                              onClick={() => setExpandedCollection(isExpanded ? null : c.id)}
                              style={{
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                padding: 0,
                                margin: 0,
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                textAlign: "left",
                                flex: 1,
                              }}
                            >
                              <span style={{ fontSize: "10px", flexShrink: 0, lineHeight: 1 }}>{isExpanded ? "▲" : "▼"}</span>
                              <div>
                                <div style={{ fontWeight: "700", fontSize: "14px", lineHeight: "1.3" }}>{c.title}</div>
                                <div style={{ fontSize: "11px", color: "#6d7175" }}>{stoneCount} stone{stoneCount !== 1 ? "s" : ""}</div>
                              </div>
                            </button>
                            {/* ADD + DELETE BUTTONS */}
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                              <Button
                                size="micro"
                                onClick={() => setAddingTo(isAdding ? null : c.id)}
                              >
                                {isAdding ? "Cancel" : "Add"}
                              </Button>
                              <Button size="micro" tone="critical" onClick={() => setDeleteTarget(c)}>
                                Delete
                              </Button>
                            </div>
                          </div>

                          {/* INLINE ADD DROPDOWN — appears under the row when Add is clicked */}
                          {isAdding && (
                            <Box paddingBlockStart="200">
                              <Select
                                options={[
                                  { label: "Select a stone...", value: "" },
                                  ...stonesNotInCollection.map(p => ({ label: p.title, value: p.id }))
                                ]}
                                value=""
                                onChange={(val) => handleAssign(val, c.id)}
                              />
                            </Box>
                          )}
                        </Box>

                        {/* EXPANDED STONE LIST */}
                        {isExpanded && (
                          <Box padding="300" background="bg-surface" borderColor="border" borderWidth="025">
                            {stonesInCollection.length === 0 ? (
                              <Text tone="subdued" variant="bodyXs">No stones in this collection yet.</Text>
                            ) : (
                              <BlockStack gap="0">
                                {stonesInCollection.map((p, i) => (
                                  <div
                                    key={p.id}
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "center",
                                      padding: "6px 4px",
                                      borderBottom: i !== stonesInCollection.length - 1 ? "1px solid #e1e3e5" : "none",
                                      gap: "8px",
                                    }}
                                  >
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                      {p.featuredImage?.url && (
                                        <Thumbnail source={p.featuredImage.url} alt={p.title} size="small" />
                                      )}
                                      <div style={{ fontSize: "12px", fontWeight: "500" }}>{p.title}</div>
                                    </div>
                                    <button
                                      onClick={() => handleRemove(p.id, c.id)}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "#d72c0d",
                                        fontWeight: "bold",
                                        fontSize: "14px",
                                        padding: "0 4px",
                                        flexShrink: 0,
                                      }}
                                    >
                                      ✕
                                    </button>
                                  </div>
                                ))}
                              </BlockStack>
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  })}
                </BlockStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Grid.Cell>

        {/* RIGHT: All Stones */}
        <Grid.Cell columnSpan={{ xs: 6, sm: 6, md: 8, lg: 8 }}>
          <Card roundedAbove="sm">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">🪨 All Stones</Text>
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

              <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 1fr", gap: "12px", padding: "0 4px" }}
                className="hide-on-mobile">
                <Text variant="bodySm" fontWeight="bold" tone="subdued"> </Text>
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
                          padding: "10px 4px",
                          borderBottom: index !== filteredProducts.length - 1 ? "1px solid #e1e3e5" : "none",
                        }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "40px 2fr 2fr 1fr", gap: "12px", alignItems: "center" }}
                          className="desktop-row">
                          {p.featuredImage?.url ? (
                            <Thumbnail source={p.featuredImage.url} alt={p.title} size="small" />
                          ) : (
                            <div style={{ width: "40px", height: "40px", background: "#f1f1f1", borderRadius: "4px" }} />
                          )}
                          <Text fontWeight="semibold">{p.title}</Text>
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

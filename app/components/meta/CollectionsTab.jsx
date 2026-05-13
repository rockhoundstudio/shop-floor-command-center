import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider, Banner, Badge, Icon, Tag } from "@shopify/polaris";
import { SearchIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";

export default function CollectionsTab({ products = [], collections = [], onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCollection, setExpandedCollection] = useState(null);

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
  };

  const handleRemove = (productId, collectionId) => {
    const fd = new FormData();
    fd.append("intent", "removeCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
  };

  return (
    <BlockStack gap="500">
      <InlineStack align="start">
        <Button onClick={onBack}>⬅️ Back to Shop Floor</Button>
      </InlineStack>

      {fetcher.data?.ok && fetcher.state === "idle" && (
        <Banner tone="success">Action completed successfully.</Banner>
      )}

      {deleteTarget && (
        <Banner tone="critical">
          <BlockStack gap="200">
            <Text>Delete <strong>{deleteTarget.title}</strong>? Keeps your stones safe.</Text>
            <InlineStack gap="200">
              <Button tone="critical" variant="primary" onClick={() => {
                const fd = new FormData();
                fd.append("intent", "deleteCollection");
                fd.append("id", deleteTarget.id);
                fetcher.submit(fd, { method: "post", action: "/app/collection-manager" });
                if (expandedCollection === deleteTarget.id) setExpandedCollection(null);
                setDeleteTarget(null);
              }}>Yes, Delete</Button>
              <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Banner>
      )}

      {/* NEW COLLECTION */}
      <Card roundedAbove="sm">
        <BlockStack gap="300">
          <Text variant="headingMd">➕ New Collection</Text>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flex: 1 }}>
              <TextField
                label="Collection title"
                labelHidden
                value={newCollTitle}
                onChange={setNewCollTitle}
                placeholder="e.g. Rare Jaspers"
                autoComplete="off"
              />
            </div>
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!newCollTitle.trim()}
              loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "createCollection"}
            >
              Create
            </Button>
          </InlineStack>
        </BlockStack>
      </Card>

      {/* ACTIVE COLLECTIONS */}
      <Card roundedAbove="sm">
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd">🗂️ Active Collections</Text>
            <Badge tone="info">{filteredCollections.length}</Badge>
          </InlineStack>
          <Divider />

          {/* COLUMN HEADERS - Using Flexbox instead of Grid */}
          <div style={{ display: "flex", flexDirection: "row", gap: "12px", padding: "0 8px" }} className="hide-on-mobile">
            <div style={{ flex: "1 1 200px" }}><Text variant="bodySm" fontWeight="bold" tone="subdued">COLLECTION</Text></div>
            <div style={{ flex: "0 0 180px" }}><Text variant="bodySm" fontWeight="bold" tone="subdued">ADD STONE</Text></div>
            <div style={{ flex: "0 0 80px" }}><Text variant="bodySm" fontWeight="bold" tone="subdued"> </Text></div>
          </div>
          <Divider />

          <BlockStack gap="0">
            {filteredCollections.map((c, index) => {
              const isExpanded = expandedCollection === c.id;
              const stonesInCollection = products.filter(p =>
                (p.currentCollections ?? []).some(col => col.id === c.id)
              );
              const stoneCount = stonesInCollection.length;

              return (
                <Box key={c.id}>
                  {/* COLLECTION ROW - Using Flexbox to force horizontal row */}
                  <div style={{
                    display: "flex",
                    flexDirection: "row",
                    gap: "12px",
                    alignItems: "center",
                    padding: "10px 8px",
                    borderBottom: !isExpanded && index !== filteredCollections.length - 1 ? "1px solid #e1e3e5" : "none",
                    background: isExpanded ? "#f6f6f7" : "transparent",
                  }} className="desktop-row">

                    {/* 1. TITLE (Takes up left side) */}
                    <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                      <button
                        onClick={() => setExpandedCollection(isExpanded ? null : c.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left", width: "100%" }}
                      >
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={isExpanded ? ChevronUpIcon : ChevronDownIcon} tone="base" />
                          <BlockStack gap="0">
                            <Text variant="bodyMd" fontWeight="bold" truncate>{c.title}</Text>
                            <Text variant="bodyXs" tone="subdued">{stoneCount} stone{stoneCount !== 1 ? "s" : ""}</Text>
                          </BlockStack>
                        </InlineStack>
                      </button>
                    </div>

                    {/* 2. ADD STONE DROPDOWN (Fixed width in middle) */}
                    <div style={{ flex: "0 0 180px" }}>
                      <Select
                        label="Add stone to collection"
                        labelHidden
                        options={[{ label: "Add stone...", value: "" }, ...filteredProducts.map(p => ({ label: p.title, value: p.id }))]}
                        value=""
                        onChange={(val) => handleAssign(val, c.id)}
                      />
                    </div>

                    {/* 3. DELETE (Fixed width on right) */}
                    <div style={{ flex: "0 0 80px", textAlign: "right" }}>
                      <Button size="micro" tone="critical" onClick={() => setDeleteTarget(c)}>
                        Delete
                      </Button>
                    </div>
                  </div>

                  {/* EXPANDED STONE LIST */}
                  {isExpanded && (
                    <Box padding="300" background="bg-surface">
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
                                padding: "6px 8px",
                                borderBottom: i !== stonesInCollection.length - 1 ? "1px solid #e1e3e5" : "none",
                              }}
                            >
                              <div style={{ fontSize: "13px", fontWeight: "500" }}>{p.title}</div>
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
                                }}
                                title="Remove from collection"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </BlockStack>
                      )}
                    </Box>
                  )}

                  {isExpanded && <Divider />}
                </Box>
              );
            })}
          </BlockStack>
        </BlockStack>
      </Card>

      {/* ASSIGN STONES */}
      <Card roundedAbove="sm">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd">🪨 All Stones</Text>
            <Badge>{filteredProducts.length} Stones</Badge>
          </InlineStack>

          <TextField
            label="Search stones"
            labelHidden
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search stones by name..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery("")}
            prefix={<Icon source={SearchIcon} tone="base" />}
          />

          <Divider />

          {/* ALL STONES HEADERS - Flexbox */}
          <div style={{ display: "flex", flexDirection: "row", gap: "12px", padding: "0 4px" }} className="hide-on-mobile">
            <div style={{ flex: "2 1 0" }}><Text variant="bodySm" fontWeight="bold" tone="subdued">STONE</Text></div>
            <div style={{ flex: "2 1 0" }}><Text variant="bodySm" fontWeight="bold" tone="subdued">COLLECTIONS</Text></div>
            <div style={{ flex: "1 1 180px", maxWidth: "180px" }}><Text variant="bodySm" fontWeight="bold" tone="subdued">ADD TO</Text></div>
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
                    {/* ALL STONES ROW - Flexbox row layout */}
                    <div style={{ display: "flex", flexDirection: "row", gap: "12px", alignItems: "center" }} className="desktop-row">
                      
                      {/* 1. STONE TITLE */}
                      <div style={{ flex: "2 1 0", minWidth: 0 }}>
                        <Text fontWeight="semibold" truncate>{p.title}</Text>
                      </div>
                      
                      {/* 2. COLLECTIONS TAGS */}
                      <div style={{ flex: "2 1 0", minWidth: 0, display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {stoneCols.length > 0
                          ? stoneCols.map(c => (
                              <Tag key={c.id} onRemove={() => handleRemove(p.id, c.id)}>{c.title}</Tag>
                            ))
                          : <Text variant="bodyXs" tone="subdued">No Collections</Text>
                        }
                      </div>

                      {/* 3. ADD TO DROPDOWN */}
                      <div style={{ flex: "1 1 180px", maxWidth: "180px" }}>
                        <Select
                          label="Assign to collection"
                          labelHidden
                          options={[{ label: "Add to...", value: "" }, ...filteredCollections.map(c => ({ label: c.title, value: c.id }))]}
                          value=""
                          onChange={(val) => handleAssign(p.id, val)}
                        />
                      </div>
                      
                    </div>
                  </div>
                );
              })}
            </BlockStack>
          </Box>
        </BlockStack>
      </Card>

      {/* MOBILE STYLES: This forces the flex rows to stack vertically only on small phone screens */}
      <style>{`
        @media (max-width: 767px) {
          .desktop-row {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .hide-on-mobile {
            display: none !important;
          }
        }
      `}</style>

    </BlockStack>
  );
}
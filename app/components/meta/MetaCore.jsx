import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider, Banner } from "@shopify/polaris";

export default function CollectionsTab({ products, collections, onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  return (
    <BlockStack gap="500">
      <InlineStack align="start">
        <Button onClick={onBack}>⬅️ Back to Products</Button>
      </InlineStack>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">➕ New Collection</Text>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flex: 1 }}>
              <TextField label="Title" value={newCollTitle} onChange={setNewCollTitle} placeholder="e.g. Rare Jaspers" autoComplete="off" />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={!newCollTitle.trim()}>Create</Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">🗂️ Active Collections</Text>
          {collections.map((c) => (
            <InlineStack key={c.id} align="space-between" blockAlign="center" gap="300">
              <Text variant="bodyMd">{c.title}</Text>
              <Button size="slim" tone="critical" onClick={() => setDeleteTarget(c)}>Delete</Button>
            </InlineStack>
          ))}
        </BlockStack>
      </Card>

      {deleteTarget && (
        <Banner tone="critical">
          <BlockStack gap="200">
            <Text>Delete "{deleteTarget.title}"? This cannot be undone.</Text>
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

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd">🪨 Assign Stones</Text>
          <Divider />
          {products.map((p) => (
            <Box key={p.id} paddingBlock="200">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <img src={p.featuredImage?.url || ""} alt="" style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                  <BlockStack>
                    <Text fontWeight="bold">{p.title}</Text>
                    <Text variant="bodySm" tone="subdued">Current: {p.currentCollections.map(c => c.title).join(", ") || "None"}</Text>
                  </BlockStack>
                </InlineStack>
                <div style={{ width: "220px" }}>
                  <Select
                    options={[{ label: "-- Assign --", value: "" }, ...collections.map(c => ({ label: c.title, value: c.id }))]}
                    value=""
                    onChange={(val) => handleAssign(p.id, val)}
                  />
                </div>
              </InlineStack>
            </Box>
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
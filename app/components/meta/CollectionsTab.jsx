import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider } from "@shopify/polaris";

export default function CollectionsTab({ products, collections, onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");

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
      <InlineStack>
        <Button onClick={onBack} size="large">⬅️ Back to Products</Button>
      </InlineStack>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">➕ Create New Collection</Text>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flex: 1 }}>
              <TextField label="Collection name" value={newCollTitle} onChange={setNewCollTitle} placeholder="e.g. Rare Agates" autoComplete="off" />
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
              <Button size="slim" tone="critical" onClick={() => {
                const fd = new FormData();
                fd.append("intent", "deleteCollection");
                fd.append("id", c.id);
                fetcher.submit(fd, { method: "post" });
              }}>Delete</Button>
            </InlineStack>
          ))}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd">🪨 Quick Assign Floor Stock</Text>
          <Divider />
          {products.map((p) => (
            <Box key={p.id} paddingBlock="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text>{p.title}</Text>
                <div style={{ width: "220px" }}>
                  <Select
                    options={[{ label: "-- Assign --", value: "" }, ...collections.map(c => ({ label: c.title, value: c.id }))]}
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
import { useState } from "react";
import { useFetcher } from "react-router";
import { Card, TextField, Text, BlockStack, InlineStack, Button, Select, Box, Divider, Banner, Grid, Badge, Icon } from "@shopify/polaris";
import { SearchIcon, FolderIcon } from "@shopify/polaris-icons";

export default function CollectionsTab({ products = [], collections = [], onBack }) {
  const fetcher = useFetcher();
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  // Filter products based on search
  const filteredProducts = products.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <BlockStack gap="500">
      <InlineStack align="start">
        <Button onClick={onBack}>⬅️ Back to Shop Floor</Button>
      </InlineStack>

      {fetcher.data?.ok && fetcher.state === "idle" && (
        <Banner tone="success">Action completed successfully.</Banner>
      )}

      <Grid>
        {/* LEFT COLUMN: Manage Collections */}
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
                  <Badge tone="info">{collections.length}</Badge>
                </InlineStack>
                <Divider />
                
                {collections.length === 0 && (
                  <Box paddingBlock="400">
                    <Text tone="subdued" alignment="center">No collections yet.</Text>
                  </Box>
                )}
                
                <BlockStack gap="200">
                  {collections.map((c) => (
                    <Box key={c.id} padding="200" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="025">
                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        <InlineStack gap="200" wrap={false} blockAlign="center">
                          <Icon source={FolderIcon} tone="base" />
                          <Text variant="bodyMd" fontWeight="bold" truncate>{c.title}</Text>
                        </InlineStack>
                        <Button 
                          size="micro" 
                          tone="critical" 
                          onClick={() => setDeleteTarget(c)}
                        >
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
                  <Text>Delete <strong>{deleteTarget.title}</strong>? This removes the collection, but keeps your stones safe.</Text>
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

        {/* RIGHT COLUMN: Assign Stones */}
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
                placeholder="Search stones by name to assign..."
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
                prefix={<Icon source={SearchIcon} tone="base" />}
              />
              
              <Divider />
              
              {products.length === 0 && (
                <Box paddingBlock="400">
                  <Text tone="subdued" alignment="center">No products loaded.</Text>
                </Box>
              )}

              {products.length > 0 && filteredProducts.length === 0 && (
                <Box paddingBlock="400">
                  <Text tone="subdued" alignment="center">No stones match your search.</Text>
                </Box>
              )}

              <Box style={{ maxHeight: "600px", overflowY: "auto" }}>
                <BlockStack gap="0">
                  {filteredProducts.map((p, index) => (
                    <Box key={p.id} paddingBlock="300" borderBlockEndWidth={index !== filteredProducts.length - 1 ? "025" : "0"} borderColor="border">
                      <InlineStack align="space-between" blockAlign="center" wrap={false}>
                        
                        <InlineStack gap="300" blockAlign="center" wrap={false} style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ width: '40px', height: '40px', background: "#f4f6f8", borderRadius: '6px', overflow: 'hidden', flexShrink: 0 }}>
                            <img 
                              src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} 
                              alt={p.title} 
                              style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                            />
                          </div>
                          <BlockStack gap="0" style={{ minWidth: 0 }}>
                            <Text fontWeight="bold" truncate>{p.title}</Text>
                            <Text variant="bodyXs" tone="subdued" truncate>
                              In: {(p.currentCollections ?? []).map(c => c.title).join(", ") || "No Collections"}
                            </Text>
                          </BlockStack>
                        </InlineStack>

                        <div style={{ width: "180px", flexShrink: 0, marginLeft: "12px" }}>
                          <Select
                            options={[{ label: "Move to...", value: "" }, ...collections.map(c => ({ label: c.title, value: c.id }))]}
                            value=""
                            onChange={(val) => handleAssign(p.id, val)}
                          />
                        </div>

                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              </Box>

            </BlockStack>
          </Card>
        </Grid.Cell>
      </Grid>

    </BlockStack>
  );
}
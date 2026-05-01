import { useState } from "react";
import { useFetcher } from "react-router";
import {
  Card, ResourceList, ResourceItem, Text, BlockStack,
  TextField, Button, Thumbnail, Box, Banner
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

export default function ProductsTab({ products = [] }) {
  const fetcher = useFetcher();
  const [selectedId, setSelectedId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const selectedProduct = products.find(p => p.id === selectedId);

  const handleSelect = (product) => {
    setSelectedId(product.id);
    setEditTitle(product.title);
    setEditDesc(product.description || "");
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append("intent", "update_product");
    fd.append("id", selectedId);
    fd.append("title", editTitle);
    fd.append("description", editDesc);
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px" }}>
      {/* LEFT COLUMN: Product List */}
      <Card padding="0">
        <Box padding="300" borderBottom="1px solid #e1e3e5">
          <Text variant="headingSm">Select a Stone to Edit</Text>
        </Box>
        <div style={{ height: "600px", overflowY: "auto" }}>
          <ResourceList
            items={products}
            renderItem={(item) => {
              const media = <Thumbnail source={item.featuredImage?.url || ImageIcon} alt={item.title} size="small" />;
              return (
                <ResourceItem
                  id={item.id}
                  media={media}
                  onClick={() => handleSelect(item)}
                  verticalAlignment="center"
                >
                  <Text variant="bodyMd" fontWeight={selectedId === item.id ? "bold" : "regular"}>
                    {item.title.length > 45 ? item.title.substring(0, 45) + "..." : item.title}
                  </Text>
                </ResourceItem>
              );
            }}
          />
        </div>
      </Card>

      {/* RIGHT COLUMN: The Polisher / Editor */}
      <BlockStack gap="400">
        {!selectedProduct ? (
          <Card>
            <Box padding="400" textAlign="center">
              <Text tone="subdued">Select a stone from the list on the left to edit its details.</Text>
            </Box>
          </Card>
        ) : (
          <Card>
            <BlockStack gap="400">
              <Text variant="headingLg">Product Details</Text>
              
              {selectedProduct.featuredImage && (
                <div style={{ background: "#f4f6f8", padding: "16px", borderRadius: "8px", textAlign: "center" }}>
                  <img
                    src={selectedProduct.featuredImage.url}
                    alt="Stone"
                    style={{ maxHeight: "200px", borderRadius: "4px", border: "1px solid #c9cccf", objectFit: "contain" }}
                  />
                </div>
              )}

              <TextField
                label="Product Title"
                value={editTitle}
                onChange={setEditTitle}
                autoComplete="off"
              />

              <TextField
                label="Product Description"
                value={editDesc}
                onChange={setEditDesc}
                multiline={8}
                autoComplete="off"
                helpText="This is the main text that appears on your storefront."
              />

              <Button variant="primary" onClick={handleSave} loading={fetcher.state === "submitting"}>
                Save Changes to Shopify
              </Button>
              
              {fetcher.data?.updated === true && (
                <Banner tone="success">Product updated successfully!</Banner>
              )}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </div>
  );
}
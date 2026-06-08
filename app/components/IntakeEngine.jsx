import React, { useState, useEffect } from "react";
import { Card, ResourceList, ResourceItem, Text, TextField, Button, BlockStack, InlineStack, Badge, Box, Layout } from "@shopify/polaris";

export default function IntakeEngine({ products, fetcher, shopify }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [material, setMaterial] = useState("");
  const [origin, setOrigin] = useState("");
  const [pieceName, setPieceName] = useState("");
  const [color, setColor] = useState("");

  const isSaving = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "saveProduct";
  const isAutoFilling = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "autoFill";

  // Watch for successful Auto-Fill transmissions from the backend loader
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.intent === "autoFill") {
      const data = fetcher.data.autoFillData;
      setMaterial(data.material || "");
      setOrigin(data.collection_location || "");
      setPieceName(data.piece_name || "");
      if (data.color) setColor(data.color);
      
      if (shopify) {
        shopify.toast.show("Title data parsed cleanly");
      }
    }
  }, [fetcher.data, shopify]);

  const handleAutoFillClick = () => {
    if (selectedItems.length === 0) return;
    const formData = new FormData();
    formData.append("intent", "autoFill");
    formData.append("productId", selectedItems[0]); // Extract based on first selected stone
    fetcher.submit(formData, { method: "post" });
  };

  const handleInjectFields = () => {
    if (selectedItems.length === 0) return;

    // Package data for transmission across the structural loops
    const payload = selectedItems.flatMap(id => [
      { ownerId: id, key: "material", value: material, type: "single_line_text_field" },
      { ownerId: id, key: "collection_location", value: origin, type: "single_line_text_field" },
      { ownerId: id, key: "piece_name", value: pieceName, type: "single_line_text_field" },
      { ownerId: id, key: "color", value: color, type: "single_line_text_field" },
      { ownerId: id, key: "is_one_of_a_kind", value: "Yes — one of a kind", type: "single_line_text_field" }
    ]);

    const formData = new FormData();
    formData.append("intent", "saveProduct");
    formData.append("payload", JSON.stringify(payload));
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <BlockStack gap="400">
      <Text variant="headingLg" as="h1">Master Intake Bench</Text>
      
      <Layout>
        {/* COLUMN 1: THE TRAY (50% Split) */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Intake Intake Tray ({products?.length || 0} Blanks)</Text>
                <Button 
                  onClick={handleAutoFillClick} 
                  disabled={selectedItems.length === 0} 
                  loading={isAutoFilling}
                  variant="secondary"
                >
                  Auto-Fill from Title
                </Button>
              </InlineStack>
              
              <ResourceList
                resourceName={{ singular: 'stone', plural: 'stones' }}
                items={products || []}
                selectedItems={selectedItems}
                onSelectionChange={setSelectedItems}
                selectable
                renderItem={(item) => (
                  <ResourceItem id={item.id} name={item.title}>
                    <Text variant="bodyMd" fontWeight="bold" as="h3">{item.title}</Text>
                  </ResourceItem>
                )}
              />
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* COLUMN 2: THE CONTROLS (Remaining Split) */}
        <Layout.Section variant="oneHalf">
          <Card>
            <BlockStack gap="500">
              <Text variant="headingMd" as="h2">Mechanical Specifications</Text>
              
              <BlockStack gap="400">
                <TextField label="Material" value={material} onChange={setMaterial} autoComplete="off" helpText="Raw material signature (e.g. Fire Obsidian)" />
                <TextField label="Origin / Collection Location" value={origin} onChange={setOrigin} autoComplete="off" helpText="Geological origin coordinates" />
                <TextField label="Piece Name" value={pieceName} onChange={setPieceName} autoComplete="off" helpText="The unique artistic story title" />
                <TextField label="Color Profile" value={color} onChange={setColor} autoComplete="off" helpText="Dominant color patterns" />
              </BlockStack>

              <Box paddingBlockStart="400">
                <Button 
                  variant="primary" 
                  size="large" 
                  fullWidth 
                  onClick={handleInjectFields} 
                  loading={isSaving}
                  disabled={selectedItems.length === 0}
                >
                  Inject Metafields into {selectedItems.length} Selected Stones
                </Button>
              </Box>

              <InlineStack gap="200">
                <Badge tone="info">Freeform Revolution</Badge>
                <Badge tone="success">Honesty Over Perfection</Badge>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </BlockStack>
  );
}
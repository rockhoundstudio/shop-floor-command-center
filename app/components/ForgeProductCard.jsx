import { useState } from "react";
import {
  Card,
  Text,
  Button,
  TextField,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  Checkbox,
} from "@shopify/polaris";

export default function ForgeProductCard({
  product,
  activeSuggestion,
  isSuggesting,
  isSavingAlt,
  isSavingSeo,
  onSuggest,
  onSaveAlt,
  onSaveSeo,
  onUpdateSuggestionField,
}) {
  const [customHook, setCustomHook] = useState("");
  const [isPolishingTarget, setIsPolishingTarget] = useState(false);

  const currentAlt = product.images.length > 0 ? product.images[0].altText : "";
  const currentSeoTitle = product.seo?.title || "";
  const currentSeoDesc = product.seo?.description || "";

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingMd" fontWeight="bold">{product.title}</Text>
          <Box minWidth="300px">
            <BlockStack gap="200">
              <TextField 
                label="Direct instructions for AI (Optional)" 
                placeholder="e.g., Mention the hidden quartz pocket..." 
                value={customHook} 
                onChange={(val) => setCustomHook(val)} 
                autoComplete="off" 
              />
              <Checkbox
                label="Custom Polishing Service page"
                checked={isPolishingTarget}
                onChange={(checked) => setIsPolishingTarget(checked)}
              />
              <Button 
                variant="primary" 
                onClick={() => onSuggest(product, customHook, isPolishingTarget)} 
                loading={isSuggesting}
              >
                ⚡ Suggest Content
              </Button>
            </BlockStack>
          </Box>
        </InlineStack>
        <Divider />
        <InlineStack align="start" gap="800">
          <Box style={{ flex: 1 }}>
            <BlockStack gap="300">
              <Text variant="headingSm" tone="subdued">Current Configuration</Text>
              <BlockStack gap="100">
                <Text fontWeight="bold">Alt Text (Applied to {product.images.length} images):</Text>
                <Text tone={currentAlt ? "base" : "subdued"}>{currentAlt || "None applied."}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text fontWeight="bold">SEO Title:</Text>
                <Text tone={currentSeoTitle ? "base" : "subdued"}>{currentSeoTitle || "None applied."}</Text>
              </BlockStack>
              <BlockStack gap="100">
                <Text fontWeight="bold">Meta Description:</Text>
                <Text tone={currentSeoDesc ? "base" : "subdued"}>{currentSeoDesc || "None applied."}</Text>
              </BlockStack>
            </BlockStack>
          </Box>
          <Box style={{ flex: 1 }}>
            {activeSuggestion ? (
              <BlockStack gap="400">
                <Box background="bg-surface-success" padding="300" borderRadius="200">
                  <BlockStack gap="300">
                    <Text variant="headingSm" tone="success">✨ Forged Suggestions</Text>
                    <BlockStack gap="200">
                      <TextField 
                        label={`Premium Alt Text (${(activeSuggestion.altText || "").length} chars)`} 
                        value={activeSuggestion.altText || ""} 
                        onChange={(val) => onUpdateSuggestionField(product.id, "altText", val)} 
                        multiline={2} 
                        autoComplete="off" 
                      />
                      <Button 
                        size="slim" 
                        onClick={() => onSaveAlt(product)} 
                        loading={isSavingAlt} 
                        disabled={!activeSuggestion.altText || product.images.length === 0}
                      >
                        Apply Alt to All {product.images.length} Images
                      </Button>
                    </BlockStack>
                    <Divider />
                    <BlockStack gap="200">
                      <TextField 
                        label={`SEO Title (${(activeSuggestion.seoTitle || "").length} chars)`} 
                        value={activeSuggestion.seoTitle || ""} 
                        onChange={(val) => onUpdateSuggestionField(product.id, "seoTitle", val)} 
                        autoComplete="off" 
                      />
                      <TextField 
                        label={`Meta Description (${(activeSuggestion.metaDescription || "").length} chars)`} 
                        value={activeSuggestion.metaDescription || ""} 
                        onChange={(val) => onUpdateSuggestionField(product.id, "metaDescription", val)} 
                        multiline={3} 
                        autoComplete="off" 
                      />
                      <Button 
                        size="slim" 
                        onClick={() => onSaveSeo(product)} 
                        loading={isSavingSeo} 
                        disabled={!activeSuggestion.seoTitle || !activeSuggestion.metaDescription}
                      >
                        Save SEO Data
                      </Button>
                    </BlockStack>
                  </BlockStack>
                </Box>
              </BlockStack>
            ) : (
              <Box background="bg-surface-secondary" padding="400" borderRadius="200" style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Text tone="subdued" alignment="center">Add an optional instruction hook above, then click "Suggest Content".</Text>
              </Box>
            )}
          </Box>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
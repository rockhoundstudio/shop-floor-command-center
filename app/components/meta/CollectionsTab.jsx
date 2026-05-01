import { useState } from "react";
import { useFetcher } from "react-router";
import {
  Card, ResourceList, ResourceItem, Text, BlockStack,
  Thumbnail, Badge, Banner, Box, InlineStack
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

export default function CollectionsTab({ collections = [] }) {
  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <Text variant="bodyMd">
          <strong>Prestige V11.1 Gatekeeper:</strong> Collections require a standard Shopify Collection Image to use as the rotating/static hero banner on the live storefront. 
        </Text>
      </Banner>

      <Card padding="0">
        <Box padding="300" borderBottom="1px solid #e1e3e5">
          <Text variant="headingSm">Storefront Collections</Text>
        </Box>
        <div style={{ height: "600px", overflowY: "auto" }}>
          <ResourceList
            items={collections}
            renderItem={(item) => {
              const hasImage = !!item.image;
              const media = <Thumbnail source={item.image?.url || ImageIcon} alt={item.title} size="large" />;
              
              return (
                <ResourceItem
                  id={item.id}
                  media={media}
                  onClick={() => {
                    // Opens the standard Shopify Collection editor in a new tab so they can upload the hero image
                    window.open(`shopify://admin/collections/${item.id.split('/').pop()}`, '_blank');
                  }}
                >
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="headingMd" fontWeight="bold">
                        {item.title}
                      </Text>
                      <Text tone="subdued">
                        Click to open Shopify editor and upload hero image
                      </Text>
                    </BlockStack>
                    
                    {hasImage ? (
                      <Badge tone="success">✅ Ready for Live Site</Badge>
                    ) : (
                      <Badge tone="warning">⚠️ Missing Hero Image</Badge>
                    )}
                  </InlineStack>
                </ResourceItem>
              );
            }}
          />
        </div>
      </Card>
    </BlockStack>
  );
}
import { TextField, BlockStack, Card, Text, Badge, Grid, Box } from "@shopify/polaris";
import { useState } from "react";

export default function ProductsTab({ products }) {
  const [search, setSearch] = useState("");
  const filtered = products.filter(p => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <BlockStack gap="400">
      <TextField 
        label="Search Shop Floor" 
        value={search} 
        onChange={setSearch} 
        autoComplete="off" 
        placeholder="Search gemstone title..."
        clearButton 
        onClearButtonClick={() => setSearch("")} 
      />
      <Grid>
        {filtered.map((p) => (
          <Grid.Cell key={p.id} columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3 }}>
            <Card padding="200">
              <BlockStack gap="200">
                <Box style={{ height: "120px", background: "#f1f1f1", borderRadius: "4px", overflow: "hidden" }}>
                  <img 
                    src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                    alt={p.title} 
                  />
                </Box>
                <Text variant="bodySm" fontWeight="bold" truncate>{p.title}</Text>
                <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                  {p.status}
                </Badge>
                <Text variant="bodyXs" tone="subdued">{p.filledCount} / 12 fields filled</Text>
              </BlockStack>
            </Card>
          </Grid.Cell>
        ))}
      </Grid>
    </BlockStack>
  );
}
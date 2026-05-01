import { useState } from "react";
import { useFetcher } from "react-router";
import { BlockStack, Text, TextField, Button, Banner } from "@shopify/polaris";

export default function MindatTab() {
  const fetcher = useFetcher();
  const [mindatName, setMindatName] = useState("");

  return (
    <BlockStack gap="400">
      <Text variant="headingMd">The Lab: Pull verified geological data from Mindat.org</Text>
      
      <TextField
        label="Enter Stone Name"
        value={mindatName}
        onChange={setMindatName}
        placeholder="e.g. Amethyst, Labradorite, Obsidian"
        autoComplete="off"
      />
      
      <Button 
        variant="primary" 
        onClick={() => {
          const fd = new FormData();
          fd.append("intent", "mindat_lookup");
          fd.append("query", mindatName);
          fetcher.submit(fd, { method: "post" });
        }} 
        loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "mindat_lookup"}
      >
        🌍 Lookup Stone
      </Button>

      {fetcher.data?.found === true && (
        <Banner tone="success">
          <Text>Found Results!</Text>
          <Text><strong>Hardness:</strong> {fetcher.data.result?.hardness || "N/A"}</Text>
          <Text><strong>Where Found:</strong> {fetcher.data.result?.localities || "N/A"}</Text>
          <Text><strong>Geological Age:</strong> {fetcher.data.result?.geological_age || "N/A"}</Text>
        </Banner>
      )}

      {fetcher.data?.found === false && (
        <Banner tone="warning">No results found for "{mindatName}". Try checking your spelling or using a broader term.</Banner>
      )}

      <Banner tone="info">Requires a Mindat.org API token mapped to process.env.MINDAT_API_KEY on your Render server.</Banner>
    </BlockStack>
  );
}
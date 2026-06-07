import React, { useState, useMemo, useEffect, useCallback } from "react";
import { 
  Card, BlockStack, InlineStack, Text, Box, DataTable, Badge, Button, Form 
} from "@shopify/polaris";
import { ExportIcon, DatabaseIcon, MagicIcon } from "@shopify/polaris-icons";

// --- THE FIELD DICTIONARY (For Matrix Columns) ---
const ROCKHOUND_FIELDS = [
  { key: "piece_name", label: "Piece Name" },
  { key: "material", label: "Material" },
  { key: "stone_family", label: "Stone Family" },
  { key: "color", label: "Color" },
  { key: "cut_and_shape", label: "Cut and Shape" },
  { key: "surface_finish", label: "Surface Finish" },
  { key: "dimensions_mm", label: "Dimensions (mm)" },
  { key: "weight_grams", label: "Weight (grams)" },
  { key: "collection_name", label: "Collection Name" },
  { key: "collection_location", label: "Collection Location" },
  { key: "primary_use", label: "Primary Use" },
  { key: "is_one_of_a_kind", label: "Is One of a Kind" },
  { key: "treated", label: "Treated" }
];

export default function OperationsMatrix({ products, fetcher, shopify }) {
  const [filterMissing, setFilterMissing] = useState(false);
  const [enrichedProducts, setEnrichedProducts] = useState([]);

  // Load products into state
  useEffect(() => {
    if (products && enrichedProducts.length === 0) {
      setEnrichedProducts(products);
    }
  }, [products, enrichedProducts.length]);

  // --- SWEEP & EXPORT HANDLERS ---
  const handleExtractOrigin = useCallback(() => {
    fetcher.submit({ intent: "autoExtractAll" }, { method: "post" });
  }, [fetcher]);

  const handleStandardizeOOAK = useCallback(() => {
    fetcher.submit({ intent: "standardizeOOAK" }, { method: "post" });
  }, [fetcher]);

  const handleCreateSnapshot = useCallback(() => {
    fetcher.submit({ intent: "saveSnapshot" }, { method: "post" });
  }, [fetcher]);

  // --- FEEDBACK LISTENERS ---
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.success) {
      if (fetcher.data.intent === "autoExtractAll" || fetcher.data.intent === "standardizeOOAK") {
        if (shopify) shopify.toast.show(`Sweep complete. Updated ${fetcher.data.updatedCount} products.`);
      }
      if (fetcher.data.intent === "saveSnapshot") {
        if (shopify) shopify.toast.show("Database snapshot saved successfully.");
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  // --- MATRIX TABLE LOGIC ---
  const tableData = useMemo(() => {
    let filtered = enrichedProducts || [];
    
    if (filterMissing) {
      filtered = filtered.filter(p => {
        let hasEmpty = false;
        ROCKHOUND_FIELDS.forEach(f => {
          let val = null;
          if (p.metafields && p.metafields.edges) {
            const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
            if (edge) val = edge.node.value;
          }
          if (!val) hasEmpty = true;
        });
        return hasEmpty;
      });
    }

    return filtered.map(p => {
      const row = [p.title];
      ROCKHOUND_FIELDS.forEach(f => {
        let valStr = "";
        if (p.metafields && p.metafields.edges) {
          const edge = p.metafields.edges.find(({ node }) => node.key === f.key && node.namespace === "rockhound");
          if (edge && edge.node.value) valStr = edge.node.value.toString().trim().toLowerCase();
        }

        let dotColor = "#C62828"; // Critical (Red)
        let ariaText = "Critical Empty";
        
        if (valStr !== "") {
          dotColor = "#2E7D32"; // Success (Green)
          ariaText = "Success Verified";
        }
        if (valStr === "n/a" || valStr === "bulk") {
          dotColor = "#F9A825"; // Warning (Yellow)
          ariaText = "Warning Unverified";
        }

        row.push(
          <div style={{ display: 'flex', justifyContent: 'center' }} aria-label={ariaText}>
            <svg width="14" height="14" viewBox="0 0 14 14" role="img">
              <circle cx="7" cy="7" r="7" fill={dotColor} />
            </svg>
          </div>
        );
      });
      return row;
    });
  }, [enrichedProducts, filterMissing]);

  return (
    <BlockStack gap="600">
      
      {/* SECTION 1: GLOBAL SWEEPS & BACKUPS */}
      <InlineStack gap="400" align="start">
        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Database Sweeps</Text>
            <Text as="p" tone="subdued">Execute logic across all 37 stones simultaneously.</Text>
            <InlineStack gap="300">
              <Button 
                icon={MagicIcon} 
                onClick={handleExtractOrigin}
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "autoExtractAll"}
              >
                Extract Origins from Titles
              </Button>
              <Button 
                icon={MagicIcon} 
                onClick={handleStandardizeOOAK}
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "standardizeOOAK"}
              >
                Standardize "OOAK" Field
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h3">Data Export & Backup</Text>
            <Text as="p" tone="subdued">Download the current matrix or save a snapshot to Metaobjects.</Text>
            <InlineStack gap="300">
              <Form method="post" reloadDocument>
                <input type="hidden" name="intent" value="exportCSV" />
                <Button icon={ExportIcon} submit>
                  Export CSV
                </Button>
              </Form>
              <Button 
                icon={DatabaseIcon} 
                onClick={handleCreateSnapshot}
                loading={fetcher.state !== "idle" && fetcher.formData?.get("intent") === "saveSnapshot"}
              >
                Create Snapshot
              </Button>
            </InlineStack>
          </BlockStack>
        </Card>
      </InlineStack>

      {/* SECTION 2: THE FIELD MATRIX */}
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingMd" as="h2">Store Health Matrix</Text>
            <Button onClick={() => setFilterMissing(!filterMissing)}>
              {filterMissing ? "Show All Stones" : "Filter Missing Data"}
            </Button>
          </InlineStack>

          <Box paddingBlockStart="200" paddingBlockEnd="200">
            <InlineStack gap="400">
              <Badge tone="success">Success (Populated)</Badge>
              <Badge tone="warning">Warning (Needs Verify)</Badge>
              <Badge tone="critical">Critical (Empty)</Badge>
            </InlineStack>
          </Box>

          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: "50vh", border: "1px solid #E1E3E5", borderRadius: "8px" }}>
            <DataTable
              columnContentTypes={["text", ...ROCKHOUND_FIELDS.map(() => "text")]}
              headings={["Product", ...ROCKHOUND_FIELDS.map(f => f.label)]}
              rows={tableData}
              stickyHeader
            />
          </div>
        </BlockStack>
      </Card>

    </BlockStack>
  );
}
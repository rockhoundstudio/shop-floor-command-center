import React, { useCallback } from "react";
import { BlockStack, Card, Text, InlineStack, Button, Box } from "@shopify/polaris";
import { ExportIcon, ImportIcon } from "@shopify/polaris-icons";
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

export function CsvTab({ fetcher, products = [] }) {
  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    if (mf) return mf.node.value;
    return "";
  }, []);

  const handleExport = () => {
    const displayFields = METAFIELD_CONFIG.filter(c => !c.hidden);
    const header = ["Product ID", "Title", ...displayFields.map(f => f.key)].join(",");
    
    const rows = products.map(p => {
      const row = [p.id, `"${p.title.replace(/"/g, '""')}"`];
      displayFields.forEach(f => {
        const val = getMetafieldValue(p, f.key) || "";
        row.push(`"${val.replace(/"/g, '""')}"`);
      });
      return row.join(",");
    });
    
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    
    link.setAttribute("href", url); 
    link.setAttribute("download", `metafield_export_${Date.now()}.csv`);
    document.body.appendChild(link); 
    link.click(); 
    document.body.removeChild(link);
  };

  return (
    <Box>
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2">CSV Synchronization</Text>
            <Text as="p">Export your matrix to CSV. Re-importing requires UI parsing architecture to be built.</Text>
            <InlineStack gap="300">
              <div style={tapTargetStyle}>
                <Button 
                  icon={ExportIcon} 
                  onClick={handleExport} 
                  accessibilityLabel="Export matrix to CSV"
                >
                  Download CSV Export
                </Button>
              </div>
              <div style={tapTargetStyle}>
                <Button 
                  icon={ImportIcon} 
                  disabled 
                  accessibilityLabel="Import CSV (UI Parsing Placeholder)"
                >
                  Upload CSV (UI Parsing Placeholder)
                </Button>
              </div>
            </InlineStack>
          </BlockStack>
        </Card>
      </BlockStack>
    </Box>
  );
}
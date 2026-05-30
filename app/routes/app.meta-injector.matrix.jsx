import React, { useState, useCallback } from "react";
import {
  BlockStack,
  InlineStack,
  Box,
  Select,
  Badge,
  DataTable,
  Scrollable,
  Text,
  Button
} from "@shopify/polaris";
import { METAFIELD_CONFIG, getLabelForValue } from "./app.meta-injector.constants";

export function MatrixTab({ fetcher, products = [], metaobjectHandles = {}, onInspectProduct }) {
  const [matrixMissingFilter, setMatrixMissingFilter] = useState("");

  const getMetafieldValue = useCallback((product, key) => {
    if (!product) return "";
    if (!product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    if (mf) return mf.node.value;
    return "";
  }, []);

  const displayFields = METAFIELD_CONFIG.filter(c => !c.hidden);

  const filtered = products.filter(p => {
    const val = getMetafieldValue(p, matrixMissingFilter);
    if (!matrixMissingFilter) return true;
    if (!val) return true;
    return false;
  });

  const rows = filtered.map(p => {
    const rowData = [
      <div style={{ minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} key={`btn-${p.id}`}>
        <Button 
          variant="plain" 
          onClick={() => {
            const hasCallback = typeof onInspectProduct === "function";
            if (hasCallback) onInspectProduct(p.id);
          }} 
          accessibilityLabel={`Inspect ${p.title}`}
        >
          {p.title}
        </Button>
      </div>
    ];

    const statusStr = getMetafieldValue(p, "meta_status");
    let statusObj = {};
    try { 
      if (statusStr) statusObj = JSON.parse(statusStr); 
    } catch(e) {}

    displayFields.forEach(field => {
      const rawVal = getMetafieldValue(p, field.key);
      let displayVal = getLabelForValue(field.key, rawVal);

      let mfNode = null;
      if (p.metafields && p.metafields.edges) {
        const edge = p.metafields.edges.find(e => e.node.key === field.key);
        if (edge) mfNode = edge.node;
      }

      const isRef = mfNode && (mfNode.type === "list.metaobject_reference" || mfNode.type === "metaobject_reference");
      
      if (isRef) {
        let gids = [];
        try {
          const parsed = JSON.parse(rawVal);
          const isArray = Array.isArray(parsed);
          const isString = typeof parsed === "string";
          
          if (isArray) gids = parsed;
          if (isString && !isArray) gids = [parsed];
        } catch(e) {
          const hasGid = rawVal && rawVal.includes("gid://shopify");
          if (hasGid) gids = [rawVal];
        }

        const hasGids = gids.length > 0;
        
        if (hasGids) {
          const handles = gids.map(gid => metaobjectHandles[gid] || gid).filter(Boolean);
          displayVal = handles.join(", ");
        }
        
        if (!hasGids) {
          displayVal = "—";
        }
        
        const stillHasGid = displayVal.includes("gid://shopify");
        if (stillHasGid) displayVal = "—";
      } 
      
      const isStringVal = displayVal && typeof displayVal === "string";
      if (!isRef && isStringVal && /gid:\/\/shopify/.test(displayVal)) {
         displayVal = "—";
      }

      const isVerified = statusObj[field.key] === "verified";
      
      let tone = "critical";
      if (rawVal && isVerified) tone = "success";
      if (rawVal && !isVerified) tone = "warning";

      let text = "Empty";
      if (rawVal && displayVal.length > 15) text = displayVal.substring(0, 15) + "...";
      if (rawVal && displayVal.length <= 15) text = displayVal;
      
      rowData.push(<Badge tone={tone} key={`badge-${p.id}-${field.key}`}>{text}</Badge>);
    });
    
    return rowData;
  });

  const matrixHeadings = [
    "Product",
    ...displayFields.map(f => {
      const isGoogle = f.namespace === "shopify";
      
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }} key={f.key}>
          {f.label}
          {isGoogle && (
            <span style={{ backgroundColor: '#005BD3', color: '#FFFFFF', fontSize: '10px', borderRadius: '4px', padding: '2px 4px', lineHeight: '1' }}>G</span>
          )}
        </span>
      );
    })
  ];

  return (
    <BlockStack gap="400">
      <Box paddingBlockEnd="200">
        <InlineStack gap="400">
          <Text as="span">🔵 <strong style={{ fontWeight: 600 }}>Google</strong> = Required for Google Shopping</Text>
          <Text as="span">🪨 <strong style={{ fontWeight: 600 }}>Store</strong> = Your OOAK storefront data</Text>
        </InlineStack>
      </Box>
      <InlineStack gap="400" blockAlign="center">
        <Box width="300px">
          <div style={{ minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Select
              label="Filter by missing data"
              options={[{ label: "Show All Products", value: "" }, ...displayFields.map(f => ({ label: `Missing: ${f.label}`, value: f.key }))]}
              value={matrixMissingFilter} 
              onChange={setMatrixMissingFilter} 
              accessibilityLabel="Filter matrix by missing metafield"
            />
          </div>
        </Box>
        <InlineStack gap="200">
          <Badge tone="success">Verified & Filled</Badge>
          <Badge tone="warning">Filled (Unverified Bulk)</Badge>
          <Badge tone="critical">Empty</Badge>
        </InlineStack>
      </InlineStack>
      <Box background="bg-surface" borderRadius="200" shadow="100">
        <Scrollable style={{ maxHeight: '60vh' }}>
          <DataTable 
            columnContentTypes={["text", ...displayFields.map(() => "text")]} 
            headings={matrixHeadings} 
            rows={rows} 
            hasZebraStriping 
          />
        </Scrollable>
      </Box>
    </BlockStack>
  );
}
import React, { useState, useCallback } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar } from "@shopify/polaris";
import { MagicIcon } from "@shopify/polaris-icons";

const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  SKIPPED: "Skipped"
};

const REQUIRED_KEYS = [
  "piece_name", "price", "weight_grams", "material", "stone_family", 
  "collection_name", "origin_handle", "rescued_by", "treatment_status", 
  "origin_story", "primary_use", "seo_title"
];

const SECTIONS = [
  { title: "Section 1 — Core Ignition", keys: ["shopify_title", "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_ooak", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price", "character_marks", "bench_notes", "alt_text", "found_object", "stone_family", "treatment_status"] },
  { title: "Section 2 — Human Engine", keys: ["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character", "origin_location", "origin_page_handle"] },
  { title: "Section 3 — Google Machine", keys: ["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "target_gender", "age_group", "condition", "custom_product", "seo_title", "google_product_category", "primary_color", "rarity", "authenticity", "jewelry_finding_type", "chain_link_type"] },
  { title: "Section 4 — Geo-Vault", keys: ["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"] }
];

const LEGACY_MAP = {
  "crystal-system": "crystal_system",
  "mineral-class": "mineral_class",
  "rock-composition": "rock_composition",
  "geological-era": "geological_era",
  "rock-formation": "rock_formation",
  "necklace-design": "necklace_design"
};

const BOOLEAN_KEYS = ["found_object", "bail_included", "setting_ready", "treated", "custom_product", "is_ooak"];

function normalizeBoolean(val) {
  if (!val) return "CONFLICT";
  const lower = String(val).toLowerCase().trim();
  if (["true", "yes", "1", "[true]", "[\"yes\"]"].includes(lower)) return "true";
  if (["false", "no", "0", "[false]", "[\"no\"]"].includes(lower)) return "false";
  return "CONFLICT";
}

export function OperationsMatrixTab({ products }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  const [isEngineActive, setIsEngineActive] = useState(false);
  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); // Stores the manifest array per GID
  
  const [selectedBenchId, setSelectedBenchId] = useState(null);

  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);
  
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  const handleToggleProductSelection = useCallback((id) => {
    if (isEngineActive) return; 
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED };
        return newStates;
      });
      return newIds;
    });
  }, [isEngineActive]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isEngineActive) return;
    setQueueIds(prev => {
      let newIds = [...prev];
      if (allFilteredSelected) {
        newIds = newIds.filter(id => !filteredProducts.find(p => p.id === id));
      } else {
        filteredProducts.forEach(p => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      }
      setProductStates(states => {
        const newStates = { ...states };
        newIds.forEach(id => { if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED }; });
        return newStates;
      });
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isEngineActive]);

  const clearBench = useCallback(() => {
    setQueueIds([]);
    setProductStates({});
    setManifestData({});
    setSelectedBenchId(null);
    setIsEngineActive(false);
  }, []);

  // --- THE MANIFEST BUILDER ---
  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) return;
    setIsEngineActive(true);

    const newManifests = { ...manifestData };
    const newStates = { ...productStates };

    queueIds.forEach(id => {
      const product = safeProducts.find(p => p.id === id);
      if (!product) return;

      const isAccessory = product.title.toLowerCase().includes("cord") || product.title.toLowerCase().includes("bail");
      const manifest = [];
      const processedKeys = new Set();
      const meta = {};

      if (product.title) meta["shopify_title"] = product.title;
      if (product.variants?.edges?.[0]?.node?.price) meta["price"] = product.variants.edges[0].node.price;

      const allEdges = [
        ...(product?.customMeta?.edges || []),
        ...(product?.rockhoundMeta?.edges || []),
        ...(product?.geoMeta?.edges || []),
        ...(product?.metafields?.edges || [])
      ];

      allEdges.forEach(({ node }) => {
        if (node && node.namespace === "custom") {
          meta[node.key] = String(node.value);
        }
      });

      // 1. LEGACY MAPPING CONFLICT RESOLUTION
      Object.entries(LEGACY_MAP).forEach(([legacy, canonical]) => {
        const hasLeg = meta.hasOwnProperty(legacy);
        const hasCan = meta.hasOwnProperty(canonical);

        if (hasLeg && hasCan) {
          if (meta[legacy] === meta[canonical]) {
            manifest.push({ key: legacy, current: meta[legacy], propKey: "-", propVal: "-", class: "REMOVE AFTER VERIFICATION", status: "yellow", section: "Legacy Diagnostics" });
          } else {
            manifest.push({ key: legacy, current: meta[legacy], propKey: canonical, propVal: "???", class: "CONFLICT", status: "red", section: "Legacy Diagnostics" });
            manifest.push({ key: canonical, current: meta[canonical], propKey: canonical, propVal: "???", class: "CONFLICT", status: "red", section: "Legacy Diagnostics" });
            processedKeys.add(canonical);
          }
          processedKeys.add(legacy);
        } else if (hasLeg && !hasCan) {
          manifest.push({ key: legacy, current: meta[legacy], propKey: canonical, propVal: meta[legacy], class: "COPY TO CANONICAL KEY", status: "yellow", section: "Legacy Diagnostics" });
          processedKeys.add(legacy);
          processedKeys.add(canonical); 
        }
      });

      // 2. SEMANTIC DUPLICATE REVIEW (is_one_of_a_kind vs is_ooak)
      const hasOneOfKind = meta.hasOwnProperty("is_one_of_a_kind");
      const hasOoak = meta.hasOwnProperty("is_ooak");
      if (hasOneOfKind && hasOoak) {
        manifest.push({ key: "is_one_of_a_kind", current: meta["is_one_of_a_kind"], propKey: "is_ooak", propVal: "???", class: "CONFLICT", status: "red", section: "Legacy Diagnostics" });
        manifest.push({ key: "is_ooak", current: meta["is_ooak"], propKey: "is_ooak", propVal: "???", class: "CONFLICT", status: "red", section: "Legacy Diagnostics" });
        processedKeys.add("is_one_of_a_kind");
        processedKeys.add("is_ooak");
      } else if (hasOneOfKind && !hasOoak) {
        manifest.push({ key: "is_one_of_a_kind", current: meta["is_one_of_a_kind"], propKey: "is_ooak", propVal: normalizeBoolean(meta["is_one_of_a_kind"]), class: "COPY TO CANONICAL KEY", status: "yellow", section: "Legacy Diagnostics" });
        processedKeys.add("is_one_of_a_kind");
        processedKeys.add("is_ooak");
      }

      // 3. MAIN SECTION PROCESSING
      SECTIONS.forEach(sec => {
        sec.keys.forEach(k => {
          if (processedKeys.has(k)) return;

          const isReq = REQUIRED_KEYS.includes(k);
          
          if (meta.hasOwnProperty(k)) {
            const currentVal = meta[k];
            let proposedVal = currentVal;
            let classification = "KEEP";
            let status = "green";

            if (BOOLEAN_KEYS.includes(k)) {
              const norm = normalizeBoolean(currentVal);
              if (norm === "CONFLICT") {
                classification = "CONFLICT"; status = "red"; proposedVal = "???";
              } else if (norm !== currentVal) {
                classification = "NORMALIZE VALUE"; status = "yellow"; proposedVal = norm;
              }
            }

            manifest.push({ key: k, current: currentVal, propKey: k, propVal: proposedVal, class: classification, status: status, section: sec.title });
          } else {
            if (isAccessory && (sec.title === "Section 4 — Geo-Vault" || sec.title === "Section 1 — Core Ignition")) {
              manifest.push({ key: k, current: "N/A", propKey: k, propVal: "N/A", class: "KEEP", status: "green", section: sec.title });
            } else {
              manifest.push({ key: k, current: "None", propKey: k, propVal: "None", class: "MISSING", status: isReq ? "red" : "yellow", section: sec.title });
            }
          }
          processedKeys.add(k);
        });
      });

      // 4. UNKNOWN KEYS
      Object.keys(meta).forEach(k => {
        if (!processedKeys.has(k) && k !== "shopify_title" && k !== "price") {
          manifest.push({ key: k, current: meta[k], propKey: "???", propVal: "???", class: "UNKNOWN KEY", status: "yellow", section: "Unknown Variables" });
        }
      });

      newManifests[id] = manifest;
      newStates[id] = { status: STATUS.VALIDATED };
    });

    setManifestData(newManifests);
    setProductStates(newStates);
    setIsEngineActive(false);
  }, [queueIds, safeProducts, manifestData, productStates]);

  const getStatusTone = (status) => {
    switch(status) {
      case STATUS.VALIDATED: return "success";
      case STATUS.SCANNING: return "magic";
      case STATUS.QUEUED: return "info";
      default: return undefined;
    }
  };

  const getIndicatorColor = (status) => {
    if (status === "green") return "#22c55e";
    if (status === "yellow") return "#eab308";
    if (status === "red") return "#ef4444";
    return "transparent";
  };

  const renderManifestTable = (sectionTitle, items) => {
    if (!items || items.length === 0) return null;
    return (
      <BlockStack gap="300" key={sectionTitle}>
        <Text as="h4" variant="headingSm" fontWeight="bold" tone="subdued" style={{ borderBottom: "2px solid #e1e3e5", paddingBottom: "4px" }}>
          {sectionTitle}
        </Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 1.5fr 1.5fr 1fr', gap: '10px', padding: '0 8px', fontWeight: 'bold', fontSize: '12px', color: '#5c5f62' }}>
            <div></div>
            <div>Current Key</div>
            <div>Current Value</div>
            <div>Proposed Key</div>
            <div>Proposed Value</div>
            <div>Action</div>
          </div>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '15px 1.5fr 1.5fr 1.5fr 1.5fr 1fr', gap: '10px', padding: '8px', backgroundColor: item.status === "red" ? "#fef2f2" : item.status === "yellow" ? "#fefce8" : "#f0fdf4", border: `1px solid ${getIndicatorColor(item.status)}`, borderRadius: '6px', alignItems: 'center' }}>
              <svg width="12" height="12" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <circle cx="9" cy="9" r="9" fill={getIndicatorColor(item.status)} />
              </svg>
              <Text as="span" variant="bodySm" fontWeight="bold">{item.key}</Text>
              <Text as="span" variant="bodySm" truncate>{item.current}</Text>
              <Text as="span" variant="bodySm" fontWeight="bold">{item.propKey}</Text>
              <Text as="span" variant="bodySm" truncate>{item.propVal}</Text>
              <Badge tone={item.status === "red" ? "critical" : item.status === "yellow" ? "attention" : "success"}>
                {item.class}
              </Badge>
            </div>
          ))}
        </div>
      </BlockStack>
    );
  };

  const activeManifest = selectedBenchId ? manifestData[selectedBenchId] : null;

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <div>
          <Card padding="300">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory ({queueIds.length})</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search..."
                disabled={isEngineActive}
              />

              <Button 
                size="large" 
                fullWidth 
                onClick={toggleSelectAllFiltered}
                disabled={isEngineActive}
              >
                {allFilteredSelected ? `Unload (${filteredProducts.length})` : `Load (${filteredProducts.length})`}
              </Button>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", height: "70vh", paddingRight: "4px" }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const isSelectedForBench = selectedBenchId === p.id;
                  const currentStatus = productStates[p.id]?.status || STATUS.QUEUED;
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleProductSelection(p.id)}
                      style={{ 
                        flexShrink: 0, 
                        border: isSelectedForBench ? "2px solid #005bd3" : "1px solid #c9cccf", 
                        borderRadius: "6px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isEngineActive ? "not-allowed" : "pointer", 
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }} 
                    >
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <div style={{ width: "40px", height: "40px", backgroundColor: "#2a2a2a", borderRadius: "4px", overflow: "hidden", flexShrink: 0 }}>
                          {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <Text as="p" variant="bodySm" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                          <Badge tone={getStatusTone(currentStatus)} size="small">{currentStatus}</Badge>
                        </div>
                      </div>

                      <Button 
                        size="micro" 
                        fullWidth
                        variant={isSelectedForBench ? "primary" : "secondary"}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (manifestData[p.id]) setSelectedBenchId(p.id);
                          else alert("Generate Repair Plan first to view this item's manifest.");
                        }}
                      >
                        View Manifest on Bench
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Repair Manifest Viewer */}
        <div>
          <BlockStack gap="600">
            <Text variant="headingLg" as="h2">2. Repair Bench & Dry Run Diagnostics</Text>

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">Dry Run Orchestrator</Text>
                  <Button 
                    size="large" 
                    variant="primary" 
                    icon={MagicIcon} 
                    onClick={generateRepairPlan} 
                    disabled={queueIds.length === 0}
                    loading={isEngineActive}
                  >
                    GENERATE REPAIR PLAN
                  </Button>
                </InlineStack>

                <Banner tone="info">
                  <Text as="p">This bench is running in strictly isolated <strong>Dry Run</strong> mode. No live Shopify mutations, overrides, or deletions will occur. The plan operates safely off the product GID.</Text>
                </Banner>

                {queueIds.length > 0 && (
                  <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" fontWeight="bold">Diagnostic Generation</Text>
                        <Text as="p">{Object.keys(manifestData).length} of {queueIds.length} Manifests Built</Text>
                      </InlineStack>
                      <ProgressBar progress={Object.keys(manifestData).length > 0 ? Math.round((Object.keys(manifestData).length / queueIds.length) * 100) : 0} color="primary" />
                    </BlockStack>
                  </Box>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <Button size="large" tone="critical" onClick={clearBench}>Clear Rack & Reset Bench</Button>
                </div>
              </BlockStack>
            </Card>

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <Text variant="headingLg" as="h2">Diagnostic Manifest Readout</Text>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <svg width="12" height="12"><circle cx="6" cy="6" r="6" fill="#22c55e" /></svg><Text variant="bodySm">Consistent / Keep</Text>
                      <svg width="12" height="12" style={{ marginLeft: "8px" }}><circle cx="6" cy="6" r="6" fill="#eab308" /></svg><Text variant="bodySm">Review Required</Text>
                      <svg width="12" height="12" style={{ marginLeft: "8px" }}><circle cx="6" cy="6" r="6" fill="#ef4444" /></svg><Text variant="bodySm">Conflict / Required Empty</Text>
                    </div>
                  </div>
                </InlineStack>
                
                {!activeManifest ? (
                  <Box padding="800" background="bg-surface-secondary" borderRadius="200">
                    <Text as="p" alignment="center" tone="subdued">Load inventory, hit GENERATE REPAIR PLAN, then drop a piece on the bench to view its diagnostic readout.</Text>
                  </Box>
                ) : (
                  <BlockStack gap="600">
                    <Text as="h3" variant="headingMd" color="success">GID Lock: {selectedBenchId}</Text>
                    
                    {renderManifestTable("Legacy Diagnostics", activeManifest.filter(m => m.section === "Legacy Diagnostics"))}
                    {renderManifestTable("Section 1 — Core Ignition", activeManifest.filter(m => m.section === "Section 1 — Core Ignition"))}
                    {renderManifestTable("Section 2 — Human Engine", activeManifest.filter(m => m.section === "Section 2 — Human Engine"))}
                    {renderManifestTable("Section 3 — Google Machine", activeManifest.filter(m => m.section === "Section 3 — Google Machine"))}
                    {renderManifestTable("Section 4 — Geo-Vault", activeManifest.filter(m => m.section === "Section 4 — Geo-Vault"))}
                    {renderManifestTable("Unknown Variables", activeManifest.filter(m => m.section === "Unknown Variables"))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
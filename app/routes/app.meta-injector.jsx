import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button, 
  Badge, Banner, Box, Icon, TextField, Divider
} from "@shopify/polaris";
import { AlertTriangleIcon, CheckCircleIcon, SearchIcon, MagicIcon, DeleteIcon } from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    // Pull products, their descriptions, and existing custom metafields
    const res = await admin.graphql(`
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              descriptionHtml
              metafields(first: 10, namespace: "custom") {
                edges {
                  node { id key value }
                }
              }
            }
          }
        }
      }
    `);
    const json = await res.json();
    const products = (json.data?.products?.edges || []).map(e => {
      const p = e.node;
      // Map existing metafields into a clean object
      const currentMeta = {};
      p.metafields.edges.forEach(m => {
        currentMeta[m.node.key] = m.node.value;
      });
      return { ...p, currentMeta };
    });
    return data({ products });
  } catch (error) {
    return data({ products: [] });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const productId = formData.get("productId");
  const hardness = formData.get("hardness");
  const crystal_system = formData.get("crystal_system");

  const metafields = [];
  if (hardness) metafields.push({ ownerId: productId, namespace: "custom", key: "hardness", type: "single_line_text_field", value: hardness });
  if (crystal_system) metafields.push({ ownerId: productId, namespace: "custom", key: "crystal_system", type: "single_line_text_field", value: crystal_system });

  try {
    const res = await admin.graphql(`
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key value }
          userErrors { field message }
        }
      }
    `, { variables: { metafields } });
    
    const json = await res.json();
    if (json.data?.metafieldsSet?.userErrors?.length) {
      return data({ ok: false, error: json.data.metafieldsSet.userErrors[0].message });
    }
    return data({ ok: true, message: "Geological Data Verified and Injected!" });
  } catch (err) {
    return data({ ok: false, error: "Server disconnected." });
  }
};

// --- MOCK MINDAT DATABASE (While waiting for API Key) ---
const mockMindat = {
  "agate": { hardness: "6.5 - 7", crystal_system: "Trigonal" },
  "amethyst": { hardness: "7", crystal_system: "Trigonal" },
  "jasper": { hardness: "6.5 - 7", crystal_system: "Trigonal" },
  "pyrite": { hardness: "6 - 6.5", crystal_system: "Isometric" },
  "fluorite": { hardness: "4", crystal_system: "Isometric" }
};

export default function MetaInjector() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const [activeProduct, setActiveProduct] = useState(null);
  const [scannedData, setScannedData] = useState(null);
  const [mindatData, setMindatData] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const handleSelectProduct = (product) => {
    setActiveProduct(product);
    setScannedData(null);
    setMindatData(null);
  };

  const runVerificationScan = () => {
    setIsScanning(true);
    
    // 1. Description Scanner Engine
    const html = activeProduct.descriptionHtml.toLowerCase();
    const foundColors = [];
    if (html.includes("blue")) foundColors.push("Blue");
    if (html.includes("red")) foundColors.push("Red");
    if (html.includes("purple")) foundColors.push("Purple");

    setScannedData({ colors: foundColors.length ? foundColors.join(", ") : "None detected" });

    // 2. Mock Mindat Uplink (Searches title for stone type)
    const title = activeProduct.title.toLowerCase();
    let verifiedData = { hardness: "Unknown", crystal_system: "Unknown" };
    
    for (const [stone, data] of Object.entries(mockMindat)) {
      if (title.includes(stone)) {
        verifiedData = data;
        break;
      }
    }
    
    setTimeout(() => {
      setMindatData(verifiedData);
      setIsScanning(false);
    }, 600); // Fake delay for the "uplink" feel
  };

  const handleOverrideAndInject = () => {
    const fd = new FormData();
    fd.append("productId", activeProduct.id);
    fd.append("hardness", mindatData.hardness !== "Unknown" ? mindatData.hardness : activeProduct.currentMeta.hardness || "");
    fd.append("crystal_system", mindatData.crystal_system !== "Unknown" ? mindatData.crystal_system : activeProduct.currentMeta.crystal_system || "");
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <Page title="Meta Injector & Auditor 💎" subtitle="Scan, Verify, and Inject Geological Truth." backAction={{ content: "Command Center", url: "/app" }}>
      <Layout>
        
        {/* INVENTORY LEFT COLUMN */}
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd">Inventory ({products.length})</Text>
              <div style={{ maxHeight: "600px", overflowY: "auto" }}>
                <BlockStack gap="200">
                  {products.map(p => (
                    <Box key={p.id} padding="200" background={activeProduct?.id === p.id ? "bg-surface-active" : "bg-surface-secondary"}
                      borderRadius="100" onClick={() => handleSelectProduct(p)} style={{ cursor: "pointer" }}>
                      <Text fontWeight={activeProduct?.id === p.id ? "bold" : "regular"}>{p.title}</Text>
                      {p.currentMeta?.hardness ? <Badge tone="success">Has Data</Badge> : <Badge tone="warning">Needs Audit</Badge>}
                    </Box>
                  ))}
                </BlockStack>
              </div>
            </Card>
          </Layout.Section>

        {/* AUDITOR RIGHT COLUMN */}
        <Layout.Section>
          {!activeProduct ? (
            <Card><Box padding="800" textAlign="center"><Text variant="headingLg" tone="subdued">Select a product to begin the audit.</Text></Box></Card>
          ) : (
            <BlockStack gap="400">
              
              <Card background="bg-surface-secondary">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="200">
                    <Text variant="headingLg">{activeProduct.title}</Text>
                    <Badge tone="info">Mindat Connection: MOCK MODE ENABLED</Badge>
                  </BlockStack>
                  <Button icon={SearchIcon} size="large" variant="primary" onClick={runVerificationScan} loading={isScanning}>
                    Run Verification Scan
                  </Button>
                </InlineStack>
              </Card>

              {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
              {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}

              {mindatData && (
                <BlockStack gap="400">
                  
                  {/* THREE-WAY VERIFICATION GRID */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                    
                    {/* 1. Shopify Data */}
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingSm" tone="subdued">1. Current Shopify Data</Text>
                        <Divider />
                        <Text fontWeight="bold">Hardness:</Text>
                        <Text>{activeProduct.currentMeta?.hardness || "Empty"}</Text>
                        <Text fontWeight="bold">Crystal System:</Text>
                        <Text>{activeProduct.currentMeta?.crystal_system || "Empty"}</Text>
                        {(activeProduct.currentMeta?.hardness && activeProduct.currentMeta?.hardness !== mindatData.hardness) && (
                           <Banner tone="critical">Potential Bad Data Detected!</Banner>
                        )}
                      </BlockStack>
                    </Card>

                    {/* 2. Text Scanner */}
                    <Card>
                      <BlockStack gap="300">
                        <Text variant="headingSm" tone="subdued">2. Description Scanner</Text>
                        <Divider />
                        <Text fontWeight="bold">Detected Colors:</Text>
                        <Text>{scannedData?.colors || "None"}</Text>
                        <Text tone="subdued" variant="bodySm">Pulled from product description HTML.</Text>
                      </BlockStack>
                    </Card>

                    {/* 3. Mindat Truth */}
                    <Card background="bg-surface-info">
                      <BlockStack gap="300">
                        <Text variant="headingSm">3. Mindat Truth</Text>
                        <Divider />
                        <Text fontWeight="bold">Hardness:</Text>
                        <Text>{mindatData.hardness}</Text>
                        <Text fontWeight="bold">Crystal System:</Text>
                        <Text>{mindatData.crystal_system}</Text>
                        {mindatData.hardness !== "Unknown" && <Badge tone="success" icon={CheckCircleIcon}>Verified</Badge>}
                      </BlockStack>
                    </Card>

                  </div>

                  {/* ACTION PANEL */}
                  <Card>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingSm">Fix & Inject Data</Text>
                      <Button variant="primary" tone="critical" size="large" onClick={handleOverrideAndInject} loading={fetcher.state === "submitting"}>
                        Overwrite with Mindat Truth
                      </Button>
                    </InlineStack>
                  </Card>

                </BlockStack>
              )}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Badge, 
  Box, Divider, Banner, Checkbox, Scrollable, EmptySearchResult, TextField, ChoiceList
} from "@shopify/polaris";
import { MagicIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH PRODUCTS LACKING CONTENT
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.graphql(`
      #graphql
      query GetProductsForContentForge {
        products(first: 100, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              descriptionHtml
              status
              seo {
                title
                description
              }
            }
          }
        }
      }
    `);
    
    const parsed = await response.json();
    if (parsed.errors) throw new Error(parsed.errors[0].message);

    const rawProducts = parsed.data?.products?.edges.map(e => e.node) || [];
    
    // Adapter: Filter for products that need some form of content
    const products = rawProducts.map(p => ({
      id: p.id,
      title: p.title,
      status: p.status,
      hasDescription: !!p.descriptionHtml && p.descriptionHtml.trim().length > 10,
      hasSEO: !!p.seo?.description && p.seo.description.trim().length > 10,
      currentDescription: p.descriptionHtml || "",
    }));

    return Response.json({ products });
  } catch (error) {
    console.error("Content Forge Loader Error:", error);
    return Response.json({ products: [], error: error.message });
  }
};

// ==========================================
// 2. TRANSMISSION: GEMINI AI BATCH PROCESSOR
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    // --- INTENT: BULK FORGE ---
    // Handles multiple products server-side to prevent client React loops
    if (intent === "bulkForge") {
      const targetIds = JSON.parse(formData.get("targetIds"));
      const targetTitles = JSON.parse(formData.get("targetTitles"));
      const generationType = formData.get("generationType"); // 'description' or 'seo'
      const brandVoice = formData.get("brandVoice");
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is missing from environment variables.");

      // 1. Ask Gemini to generate JSON array for all targets in one shot
      const prompt = `You are a premium e-commerce copywriter. Write highly engaging ${generationType === 'seo' ? 'SEO meta descriptions (max 155 chars)' : 'product descriptions (1-2 short paragraphs with HTML <p> tags)'} for the following products. The brand voice should be: ${brandVoice}.
      
      Return ONLY a raw, valid JSON array of objects with "title" and "generated_content" keys. Do not include markdown formatting or backticks.
      
      Products:
      ${targetTitles.join(", ")}
      `;

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const aiData = await aiRes.json();
      let rawResponse = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";
      
      // Clean potential markdown backticks from Gemini response
      rawResponse = rawResponse.replace(/^```json/g, '').replace(/```$/g, '').trim();
      const generatedItems = JSON.parse(rawResponse);

      let successCount = 0;
      let errors = [];

      // 2. Loop and save via Shopify GraphQL safely on the server
      for (let i = 0; i < targetIds.length; i++) {
        const productId = targetIds[i];
        const title = targetTitles[i];
        const match = generatedItems.find(item => item.title.toLowerCase() === title.toLowerCase());
        
        if (match && match.generated_content) {
          const mutation = generationType === 'seo' 
            ? `mutation { productUpdate(input: { id: "${productId}", seo: { description: ${JSON.stringify(match.generated_content)} } }) { userErrors { message } } }`
            : `mutation { productUpdate(input: { id: "${productId}", descriptionHtml: ${JSON.stringify(match.generated_content)} }) { userErrors { message } } }`;

          const updateRes = await admin.graphql(mutation);
          const updateData = await updateRes.json();

          if (updateData.data?.productUpdate?.userErrors?.length > 0) {
            errors.push(`Failed on ${title}: ${updateData.data.productUpdate.userErrors[0].message}`);
          } else {
            successCount++;
          }
        } else {
          errors.push(`Gemini failed to generate content for: ${title}`);
        }
      }

      return Response.json({ 
        intent, 
        success: true, 
        message: `Successfully forged ${successCount} ${generationType}(s).`,
        errors: errors.length > 0 ? errors : null 
      });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    console.error("Action Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI FRAMEWORK
// ==========================================
export default function AIContentForgeTab() {
  const { products = [], error } = useLoaderData() || {};
  const fetcher = useFetcher();
  const navigate = useNavigate();

  // --- STATE ---
  const [selectedIds, setSelectedIds] = useState([]);
  const [generationType, setGenerationType] = useState(["description"]);
  const [brandVoice, setBrandVoice] = useState("Premium, descriptive, focusing on handcrafted gemstone quality and unique geological features.");
  const [toastMessage, setToastMessage] = useState("");

  const isForging = fetcher.state !== "idle";

  // --- HELPERS ---
  const toggleSelection = useCallback((id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback((filteredProducts) => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]); // Deselect all
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  }, [selectedIds]);

  // --- MUTATION HANDLING ---
  useEffect(() => {
    if (fetcher.data) {
      if (fetcher.data.message) {
        shopify.toast.show(fetcher.data.message);
        setSelectedIds([]); // Clear selection on success
      }
      if (fetcher.data.error) {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
      if (fetcher.data.errors && fetcher.data.errors.length > 0) {
        setToastMessage(`Partial failure: ${fetcher.data.errors.join(" | ")}`);
      }
    }
  }, [fetcher.data]);

  // --- ACTIONS ---
  const handleBulkForge = () => {
    if (selectedIds.length === 0) {
      shopify.toast.show("Please select at least one product.", { isError: true });
      return;
    }
    if (selectedIds.length > 15) {
      shopify.toast.show("Please select 15 or fewer products at a time to prevent AI timeouts.", { isError: true });
      return;
    }

    const selectedTitles = selectedIds.map(id => products.find(p => p.id === id)?.title);

    fetcher.submit(
      {
        intent: "bulkForge",
        targetIds: JSON.stringify(selectedIds),
        targetTitles: JSON.stringify(selectedTitles),
        generationType: generationType[0],
        brandVoice: brandVoice
      },
      { method: "post" }
    );
  };

  // --- RENDER HELPERS ---
  const filteredProducts = products.filter(p => 
    generationType[0] === "description" ? !p.hasDescription : !p.hasSEO
  );

  return (
    <Page
      title="AI Content Forge"
      subtitle="Batch generate premium descriptions and SEO metadata safely."
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        {/* ALERTS */}
        {error && <Banner tone="critical">{error}</Banner>}
        {toastMessage && <Banner tone="warning" onDismiss={() => setToastMessage("")}>{toastMessage}</Banner>}

        <Layout>
          {/* LEFT PANE: CONFIGURATION */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card padding="400">
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Forge Settings</Text>
                  <Divider />
                  
                  <ChoiceList
                    title="What needs generating?"
                    choices={[
                      { label: 'Missing Product Descriptions', value: 'description' },
                      { label: 'Missing SEO Meta Descriptions', value: 'seo' },
                    ]}
                    selected={generationType}
                    onChange={setGenerationType}
                  />

                  <TextField
                    label="Brand Voice Prompt"
                    value={brandVoice}
                    onChange={setBrandVoice}
                    multiline={4}
                    autoComplete="off"
                    helpText="Tell Gemini how to sound. E.g. 'Luxurious, mysterious, focusing on crystal healing'."
                  />

                  <Divider />
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button
                      size="large"
                      variant="primary"
                      tone="success"
                      icon={MagicIcon}
                      loading={isForging}
                      onClick={handleBulkForge}
                      disabled={selectedIds.length === 0}
                      accessibilityLabel="Forge content for selected products"
                    >
                      Forge {selectedIds.length} Products
                    </Button>
                  </div>
                  {selectedIds.length > 15 && (
                    <Text tone="critical" variant="bodySm">Max 15 products per batch recommended.</Text>
                  )}
                </BlockStack>
              </Card>

              <Banner tone="info" title="Loop-Free Guarantee">
                This tool has been rebuilt to process batches securely on the server. You will no longer experience browser crashes or infinite loops!
              </Banner>
            </BlockStack>
          </Layout.Section>

          {/* RIGHT PANE: PRODUCT SELECTION */}
          <Layout.Section>
            <Card padding="0">
              <Box padding="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h2">
                      Target Roster ({filteredProducts.length} missing {generationType[0]})
                    </Text>
                  </BlockStack>
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button 
                      onClick={() => selectAll(filteredProducts)}
                      accessibilityLabel="Select or deselect all items"
                    >
                      {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? "Deselect All" : "Select All"}
                    </Button>
                  </div>
                </InlineStack>
              </Box>

              {filteredProducts.length === 0 && (
                <Box padding="800">
                  <EmptySearchResult
                    title={`No missing ${generationType[0]}s`}
                    description="All your scanned products currently have this content filled out!"
                    withIllustration
                  />
                </Box>
              )}

              {filteredProducts.length > 0 && (
                <Scrollable style={{ height: "65vh" }} focusable>
                  <Box padding="400">
                    <BlockStack gap="200">
                      {filteredProducts.map((product) => (
                        <Box key={product.id} padding="300" background="bg-surface-secondary" borderRadius="200">
                          <InlineStack wrap={false} align="space-between" blockAlign="center">
                            <InlineStack gap="400" wrap={false} blockAlign="center">
                              <Checkbox
                                labelHidden
                                label={`Select ${product.title}`}
                                checked={selectedIds.includes(product.id)}
                                onChange={() => toggleSelection(product.id)}
                              />
                              <BlockStack gap="100">
                                <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
                                <InlineStack gap="200">
                                  <Badge tone={product.status === "ACTIVE" ? "success" : "info"}>
                                    {product.status}
                                  </Badge>
                                  {!product.hasDescription && generationType[0] === 'description' && (
                                    <Badge tone="critical">Empty Description</Badge>
                                  )}
                                  {!product.hasSEO && generationType[0] === 'seo' && (
                                    <Badge tone="critical">Empty SEO</Badge>
                                  )}
                                </InlineStack>
                              </BlockStack>
                            </InlineStack>
                          </InlineStack>
                        </Box>
                      ))}
                    </BlockStack>
                  </Box>
                </Scrollable>
              )}
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
}

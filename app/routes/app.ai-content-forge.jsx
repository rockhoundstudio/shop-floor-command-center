import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  Banner,
  BlockStack,
  InlineStack,
  Divider,
  Box,
} from "@shopify/polaris";

// ─── ERROR BOUNDARY (The Diagnostic Screen) ───────────────────────────────────
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Engine Fault">
      <Card background="bg-surface-critical">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h1" fontWeight="bold">AI Forge Crashed</Text>
          <Text>
            {isRouteErrorResponse(error)
              ? `${error.status} ${error.statusText} - ${error.data}`
              : error instanceof Error
              ? error.message
              : "Unknown engine failure."}
          </Text>
        </BlockStack>
      </Card>
    </Page>
  );
}

// ─── LOADER (With Timeout Governor & Media API Adapter) ───────────────────────
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;
    let cycleCount = 0; // Safety breaker

    while (hasNextPage && cycleCount < 20) {
      const query = `
        query GetProducts($cursor: String) {
          products(first: 100, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                description
                seo { title description }
                media(first: 50) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                        alt
                        image { url }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(query, { variables: { cursor } });
      const json = await res.json();

      if (json.errors) {
        throw new Error(json.errors[0].message);
      }

      const page = json.data?.products;
      if (!page) break;

      // Adapter: Map the new Media nodes back into a flat array for the UI
      const formattedNodes = page.edges.map((e) => {
        const node = e.node;
        const mappedImages = (node.media?.edges || [])
          .filter(mediaEdge => mediaEdge.node.image) 
          .map(mediaEdge => ({
            id: mediaEdge.node.id, 
            url: mediaEdge.node.image?.url || "",
            altText: mediaEdge.node.alt || ""
          }));

        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          description: node.description,
          seo: node.seo,
          images: mappedImages
        };
      });

      allProducts = allProducts.concat(formattedNodes);
      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
      cycleCount++;
    }

    return { products: allProducts };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    throw new Response(error.message || String(error), {
      status: 500,
      statusText: "Loader Engine Fault",
    });
  }
};

// ─── ACTION (The Engine with Gemini API & Chunking Governor) ──────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    const body = await request.formData();
    const intent = body.get("intent");

    // 1. Call Gemini AI API
    if (intent === "ai_suggest") {
      const productId = body.get("productId");
      const productTitle = body.get("productTitle");
      const productDescription = body.get("productDescription");
      const origin = body.get("origin") || "Pacific Northwest region";
      
      if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

      const prompt = `You write content for Rockhound Studio, a premium handcrafted stone art store in Spokane Valley WA run by Bob and Janyce. Return ONLY valid JSON with exactly these three fields:
{
  "altText": "...",
  "seoTitle": "...",
  "metaDescription": "..."
}

Rules:
- altText formula: [Visual Beauty/Color] + [Finished Art Type] + [OOAK Indicator] + [Material] + [Origin region only, never exact location] + "Rockhound Studio". Max 125 chars.
- seoTitle formula: [Stone Name] + [Finished Type] + "One-of-a-Kind" + "Rockhound Studio". Max 70 chars.
- metaDescription formula: Story hook + handcrafted indicator + origin thread + call to feel something. Max 160 chars.
- Never use grit stages, technical specs, or maker jargon
- Speak to everyday gift buyers and OOAK art collectors
- Origin: region only (e.g. "Yakima River Canyon region") — never exact coordinates or ranch names

Product Title: ${productTitle}
Product Description: ${productDescription}
Origin Context: ${origin}`;

      // FIX: Appended "-latest" to the model name so Google's router can find it
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt }
                ]
              }
            ]
          })
        }
      );

      // OBD2 SCANNER: Read the raw error text from Google
      if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        throw new Error(`API Fault ${geminiRes.status}: ${errorText}`);
      }

      const data = await geminiRes.json();
      let rawText = data.candidates[0].content.parts[0].text;
      
      // Strip markdown JSON wrappers if Gemini includes them
      rawText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
      
      let parsedData;
      try {
        parsedData = JSON.parse(rawText);
      } catch (e) {
        throw new Error("Gemini returned invalid JSON format.");
      }

      return { ok: true, intent, productId, suggestion: parsedData };
    }

    // 2. Bulk Save Alt Text to all product images
    if (intent === "save_alt") {
      const productId = body.get("productId");
      const pairs = JSON.parse(body.get("pairs")); 
      
      // THE CHUNKING GOVERNOR: Process in batches of 10
      const chunkSize = 10;
      for (let i = 0; i < pairs.length; i += chunkSize) {
        const chunk = pairs.slice(i, i + chunkSize);
        
        const filesInput = chunk.map(({ id, alt }) => ({ id: id, alt: alt }));
        
        const res = await admin.graphql(
          `mutation fileUpdate($files: [FileUpdateInput!]!) {
            fileUpdate(files: $files) {
              files {
                ... on MediaImage { id alt }
              }
              userErrors { field message }
            }
          }`,
          { variables: { files: filesInput } }
        );
        
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        if (json.data.fileUpdate.userErrors.length > 0) {
           throw new Error(json.data.fileUpdate.userErrors[0].message);
        }
        
        if (i + chunkSize < pairs.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      return { ok: true, intent, productId };
    }

    // 3. Save Product SEO Data
    if (intent === "save_seo") {
      const productId = body.get("productId");
      const seoTitle = body.get("seoTitle");
      const seoDescription = body.get("seoDescription");
      
      const res = await admin.graphql(
        `mutation UpdateSEO($productId: ID!, $seoTitle: String!, $seoDescription: String!) {
          productUpdate(input: { id: $productId, seo: { title: $seoTitle, description: $seoDescription } }) {
            product { id seo { title description } }
            userErrors { field message }
          }
        }`,
        { variables: { productId, seoTitle, seoDescription } }
      );
      
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      if (json.data.productUpdate.userErrors.length > 0) {
         throw new Error(json.data.productUpdate.userErrors[0].message);
      }
      
      return { ok: true, intent, productId, seo: { title: seoTitle, description: seoDescription } };
    }

    return { ok: false, error: "Unknown intent" };
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return { ok: false, error: error.message || "An internal engine fault occurred." };
  }
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function AiContentForgeTab() {
  const { products: initialProducts } = useLoaderData();
  const fetcher = useFetcher();

  const [products, setProducts] = useState(initialProducts);
  const [suggestions, setSuggestions] = useState({});
  
  // Track specific loading states
  const [suggestingId, setSuggestingId] = useState(null);
  const [savingAltId, setSavingAltId] = useState(null);
  const [savingSeoId, setSavingSeoId] = useState(null);
  
  const [toast, setToast] = useState(null); 
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setSuggestingId(null);
      setSavingAltId(null);
      setSavingSeoId(null);

      if (!fetcher.data.ok) {
        setPageError(`❌ Fault: ${fetcher.data.error}`);
        return;
      }

      setPageError(null);

      const { intent, productId } = fetcher.data;

      if (intent === "ai_suggest") {
        setSuggestions((prev) => ({
          ...prev,
          [productId]: fetcher.data.suggestion
        }));
        setToast({ message: "✨ AI Forged Content Generated", tone: "success" });
      } 
      else if (intent === "save_alt") {
        const updatedAlt = suggestions[productId]?.altText || "";
        setProducts((prev) =>
          prev.map((p) => {
            if (p.id === productId) {
              return {
                ...p,
                images: p.images.map((img) => ({ ...img, altText: updatedAlt }))
              };
            }
            return p;
          })
        );
        setToast({ message: "✓ Alt Text Bulk Updated", tone: "success" });
      }
      else if (intent === "save_seo") {
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? { ...p, seo: fetcher.data.seo } : p))
        );
        setToast({ message: "✓ SEO Data Saved", tone: "success" });
      }
      
      setTimeout(() => setToast(null), 3000);
    }
  }, [fetcher.state, fetcher.data]);

  const handleSuggest = (product) => {
    setSuggestingId(product.id);
    const fd = new FormData();
    fd.append("intent", "ai_suggest");
    fd.append("productId", product.id);
    fd.append("productTitle", product.title);
    fd.append("productDescription", product.description || "");
    fetcher.submit(fd, { method: "post" });
  };

  const handleSaveAlt = (product) => {
    setSavingAltId(product.id);
    const altText = suggestions[product.id]?.altText;
    
    const pairs = product.images.map((img) => ({
      id: img.id,
      alt: altText
    }));

    const fd = new FormData();
    fd.append("intent", "save_alt");
    fd.append("productId", product.id);
    fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
  };

  const handleSaveSeo = (product) => {
    setSavingSeoId(product.id);
    const seoTitle = suggestions[product.id]?.seoTitle;
    const seoDesc = suggestions[product.id]?.metaDescription;

    const fd = new FormData();
    fd.append("intent", "save_seo");
    fd.append("productId", product.id);
    fd.append("seoTitle", seoTitle);
    fd.append("seoDescription", seoDesc);
    fetcher.submit(fd, { method: "post" });
  };

  const updateSuggestionField = (productId, field, value) => {
    setSuggestions((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  return (
    <Page
      title="⚡ AI Content Forge"
      subtitle="Generate premium, story-driven Alt Text and SEO descriptions powered by Gemini."
    >
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Banner tone={toast.tone}>{toast.message}</Banner>
        </div>
      )}

      <Layout>
        <Layout.Section>
          <InlineStack gap="300">
            <Button url="/app" variant="secondary">Home</Button>
            <Button url="/app/meta-injector" variant="secondary">Meta Injector</Button>
            <Button url="/app/menu-manager" variant="secondary">Menu Manager</Button>
            <Button url="/app/collection-manager" variant="secondary">Collection Manager</Button>
            <Button url="/app/bulk-edit" variant="secondary">Bulk Edit</Button>
            <Button url="/app/seo-alt-text" variant="secondary">SEO & Alt Text</Button>
            <Button url="/app/ai-content-forge" variant="primary">⚡ AI Content Forge</Button>
          </InlineStack>
        </Layout.Section>

        {pageError && (
          <Layout.Section>
            <Banner 
              tone="critical" 
              title="Action Failed" 
              onDismiss={() => setPageError(null)}
            >
              <Text as="p">{pageError}</Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Divider />
        </Layout.Section>

        <Layout.Section>
          <BlockStack gap="500">
            {products.map((product) => {
              const currentAlt = product.images.length > 0 ? product.images[0].altText : "";
              const currentSeoTitle = product.seo?.title || "";
              const currentSeoDesc = product.seo?.description || "";
              
              const activeSuggestion = suggestions[product.id];

              return (
                <Card key={product.id}>
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text variant="headingMd" fontWeight="bold">
                        {product.title}
                      </Text>
                      <Button 
                        variant="primary" 
                        onClick={() => handleSuggest(product)}
                        loading={suggestingId === product.id}
                      >
                        ⚡ Suggest Content
                      </Button>
                    </InlineStack>

                    <Divider />

                    <InlineStack align="start" gap="800">
                      <Box style={{ flex: 1 }}>
                        <BlockStack gap="300">
                          <Text variant="headingSm" tone="subdued">Current Configuration</Text>
                          
                          <BlockStack gap="100">
                            <Text fontWeight="bold">Alt Text (Applied to {product.images.length} images):</Text>
                            <Text tone={currentAlt ? "base" : "subdued"}>
                              {currentAlt || "None applied."}
                            </Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text fontWeight="bold">SEO Title:</Text>
                            <Text tone={currentSeoTitle ? "base" : "subdued"}>
                              {currentSeoTitle || "None applied."}
                            </Text>
                          </BlockStack>

                          <BlockStack gap="100">
                            <Text fontWeight="bold">Meta Description:</Text>
                            <Text tone={currentSeoDesc ? "base" : "subdued"}>
                              {currentSeoDesc || "None applied."}
                            </Text>
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
                                    onChange={(val) => updateSuggestionField(product.id, "altText", val)}
                                    multiline={2}
                                    autoComplete="off"
                                  />
                                  <Button 
                                    size="slim" 
                                    onClick={() => handleSaveAlt(product)}
                                    loading={savingAltId === product.id}
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
                                    onChange={(val) => updateSuggestionField(product.id, "seoTitle", val)}
                                    autoComplete="off"
                                  />
                                  <TextField
                                    label={`Meta Description (${(activeSuggestion.metaDescription || "").length} chars)`}
                                    value={activeSuggestion.metaDescription || ""}
                                    onChange={(val) => updateSuggestionField(product.id, "metaDescription", val)}
                                    multiline={3}
                                    autoComplete="off"
                                  />
                                  <Button 
                                    size="slim" 
                                    onClick={() => handleSaveSeo(product)}
                                    loading={savingSeoId === product.id}
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
                            <Text tone="subdued" alignment="center">
                              Click "Suggest Content" to forge premium, story-driven text for this product using Gemini AI.
                            </Text>
                          </Box>
                        )}
                      </Box>
                    </InlineStack>

                  </BlockStack>
                </Card>
              );
            })}

            {products.length === 0 && (
              <Banner tone="info">
                <Text>No products found to forge content for.</Text>
              </Banner>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
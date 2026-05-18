import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import ForgeProductCard from "../components/ForgeProductCard";

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

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;
    let cycleCount = 0;
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
                originMetafield: metafield(namespace: "custom", key: "origin") { value }
                seo { title description }
                media(first: 50) {
                  edges { node { ... on MediaImage { id alt image { url } } } }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(query, { variables: { cursor } });
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      const page = json.data?.products;
      if (!page) break;
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
          origin: node.originMetafield?.value || "",
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
    if (error instanceof Response) throw error;
    throw new Response(error.message || String(error), { status: 500, statusText: "Loader Engine Fault" });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "ai_suggest") {
      const productId = body.get("productId");
      const productTitle = body.get("productTitle");
      const productDescription = body.get("productDescription");
      const origin = body.get("origin") || "Pacific Northwest region";
      const customHook = body.get("customHook") || "";
      const isPolishingTarget = body.get("isPolishingTarget") === "true";
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

      const polishingInstruction = isPolishingTarget 
        ? `\n  CRITICAL SEO: You MUST naturally and organically weave these three exact phrases into the story without feeling stuffed: "custom stone polishing service", "heirloom rock polishing", and "turn your found rock into art".`
        : "";

      const prompt = `Generate SEO-optimized alt text and meta descriptions for Rockhound Studio that match how buyers search. Load natural keyword phrases: material type, color, shape, finish, origin location, "one of a kind", "handcrafted", "handmade stone", "gemstone pendant", "polished stone".

Return ONLY valid JSON with exactly these three fields:
{ "altText": "...", "seoTitle": "...", "metaDescription": "..." }

RULES:
- UNIQUE STONE MANDATE: Stones may share origin and material. Alt text must describe only the unique visual characteristics of this specific stone — color zones, pattern, finish, setting. Meta descriptions may reference shared origin locations as a story thread, but the visual description and bench truth must be unique to this stone. Never duplicate another stone's description.

- altText: Visual description of true colors from the image only (ignore title color words) + keywords. End with "Rockhound Studio". Max 125 chars.

- seoTitle: [Stone Name] + [Finished Type] + "One-of-a-Kind" + "Rockhound Studio". Max 70 chars.

- metaDescription: Material + origin + "one of a kind". Load natural keyword phrases. Max 150 chars STRICT. ${polishingInstruction}

Foreman's Direct Note: ${customHook}
Product Title: ${productTitle}
Product Description: ${productDescription}
Origin Context: ${origin}`;

      let parts = [{ text: prompt }];

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
        const options = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: parts }] })
        };

        const makeGeminiRequest = async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000); // 45-second fuse
          try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeout);
            return res;
          } catch (e) {
            clearTimeout(timeout);
            console.error("RAW FETCH FAULT:", e);
            if (e.name === "AbortError") {
              throw new Error("Timeout: Google took longer than 45 seconds to respond.");
            }
            throw new Error(`Network Fault: ${e.message}`);
          }
        };

        let geminiRes = await makeGeminiRequest();

        if (geminiRes.status === 429) {
          await new Promise(resolve => setTimeout(resolve, 8000));
          geminiRes = await makeGeminiRequest();
          if (geminiRes.status === 429) {
            throw new Error("Rate limited — Google rejected the request after retry.");
          }
        }

        if (!geminiRes.ok) {
          const errorText = await geminiRes.text();
          throw new Error(`API Fault ${geminiRes.status}: ${errorText}`);
        }

        const data = await geminiRes.json();
        console.log("RAW GEMINI RESPONSE:", JSON.stringify(data));

        let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Bulletproof string cleaning: bypassing copy-paste mangling by building characters dynamically
        const t = String.fromCharCode(96);
        const jsonWrapper = t + t + t + "json";
        const codeWrapper = t + t + t;
        
        rawText = rawText.replace(new RegExp(jsonWrapper, "gi"), "");
        rawText = rawText.replace(new RegExp(codeWrapper, "gi"), "");
        rawText = rawText.trim();
        
        let parsedData;
        try { 
          parsedData = JSON.parse(rawText); 
        } catch (e) { 
          throw new Error("Gemini returned invalid JSON format."); 
        }

        if (!parsedData || !parsedData.altText || !parsedData.seoTitle || !parsedData.metaDescription) {
          throw new Error("Gemini returned empty response — try again");
        }

        return { ok: true, intent, productId, suggestion: parsedData };

      } catch (geminiError) {
        return { ok: false, error: geminiError.message };
      }
    }

    if (intent === "save_alt") {
      const productId = body.get("productId");
      const pairs = JSON.parse(body.get("pairs")); 
      const chunkSize = 10;
      for (let i = 0; i < pairs.length; i += chunkSize) {
        const chunk = pairs.slice(i, i + chunkSize);
        const filesInput = chunk.map(({ id, alt }) => ({ id: id, alt: alt }));
        const res = await admin.graphql(
          `mutation fileUpdate($files: [FileUpdateInput!]!) {
            fileUpdate(files: $files) {
              files { ... on MediaImage { id alt } }
              userErrors { field message }
            }
          }`, { variables: { files: filesInput } }
        );
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        if (json.data.fileUpdate.userErrors.length > 0) throw new Error(json.data.fileUpdate.userErrors[0].message);
        if (i + chunkSize < pairs.length) await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return { ok: true, intent, productId };
    }

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
        }`, { variables: { productId, seoTitle, seoDescription } }
      );
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      if (json.data.productUpdate.userErrors.length > 0) throw new Error(json.data.productUpdate.userErrors[0].message);
      return { ok: true, intent, productId, seo: { title: seoTitle, description: seoDescription } };
    }

    return { ok: false, error: "Unknown intent" };
  } catch (error) {
    if (error instanceof Response) throw error;
    return { ok: false, error: error.message || "An internal engine fault occurred." };
  }
};

export default function AiContentForgeTab() {
  const { products: initialProducts } = useLoaderData();
  const fetcher = useFetcher();
  const [products, setProducts] = useState(initialProducts);
  const [suggestions, setSuggestions] = useState({});
  const [suggestingId, setSuggestingId] = useState(null);
  const [savingAltId, setSavingAltId] = useState(null);
  const [savingSeoId, setSavingSeoId] = useState(null);
  const [toast, setToast] = useState(null); 
  const [pageError, setPageError] = useState(null);
  const [globalCooldown, setGlobalCooldown] = useState(0);

  // Global Cooldown Timer
  useEffect(() => {
    if (globalCooldown <= 0) return;
    const timer = setInterval(() => {
      setGlobalCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [globalCooldown]);

  // Clean Toast Timer
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setSuggestingId(null); setSavingAltId(null); setSavingSeoId(null);
      if (!fetcher.data.ok) {
        setPageError(`❌ Fault: ${fetcher.data.error}`);
        return;
      }
      setPageError(null);
      const { intent, productId } = fetcher.data;
      if (intent === "ai_suggest") {
        setSuggestions((prev) => ({ ...prev, [productId]: fetcher.data.suggestion }));
        setToast({ message: "✨ AI Forged Content Generated", tone: "success" });
      } 
      else if (intent === "save_alt") {
        const updatedAlt = suggestions[productId]?.altText || "";
        setProducts((prev) => prev.map((p) => {
            if (p.id === productId) return { ...p, images: p.images.map((img) => ({ ...img, altText: updatedAlt })) };
            return p;
        }));
        setToast({ message: "✓ Alt Text Bulk Updated", tone: "success" });
      }
      else if (intent === "save_seo") {
        setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, seo: fetcher.data.seo } : p)));
        setToast({ message: "✓ SEO Data Saved", tone: "success" });
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleSuggest = (product, customHook, isPolishingTarget) => {
    setPageError(null);
    setSuggestingId(product.id);
    setGlobalCooldown(120); // Trigger Master Lock
    const fd = new FormData();
    fd.append("intent", "ai_suggest");
    fd.append("productId", product.id);
    fd.append("productTitle", product.title);
    fd.append("productDescription", product.description || "");
    fd.append("origin", product.origin || ""); 
    fd.append("customHook", customHook || "");
    fd.append("isPolishingTarget", isPolishingTarget ? "true" : "false");
    fetcher.submit(fd, { method: "post" });
  };

  const handleSaveAlt = (product) => {
    setSavingAltId(product.id);
    const altText = suggestions[product.id]?.altText;
    const pairs = product.images.map((img) => ({ id: img.id, alt: altText }));
    const fd = new FormData();
    fd.append("intent", "save_alt"); fd.append("productId", product.id); fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
  };

  const handleSaveSeo = (product) => {
    setSavingSeoId(product.id);
    const seoTitle = suggestions[product.id]?.seoTitle;
    const seoDesc = suggestions[product.id]?.metaDescription;
    const fd = new FormData();
    fd.append("intent", "save_seo"); fd.append("productId", product.id);
    fd.append("seoTitle", seoTitle); fd.append("seoDescription", seoDesc);
    fetcher.submit(fd, { method: "post" });
  };

  const updateSuggestionField = (productId, field, value) => {
    setSuggestions((prev) => ({ ...prev, [productId]: { ...prev[productId], [field]: value } }));
  };

  return (
    <Page title="⚡ AI Content Forge" subtitle="Generate premium, story-driven Alt Text and SEO descriptions powered by Gemini.">
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Banner tone={toast.tone}>{toast.message}</Banner>
        </div>
      )}
      <Layout>
        {pageError && (
          <Layout.Section>
            <Banner tone="critical" title="Action Failed" onDismiss={() => setPageError(null)}>
              <Text as="p">{pageError}</Text>
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <BlockStack gap="500">
            {products.map((product) => (
              <ForgeProductCard
                key={product.id}
                product={product}
                activeSuggestion={suggestions[product.id]}
                isSuggesting={suggestingId === product.id}
                isSavingAlt={savingAltId === product.id}
                isSavingSeo={savingSeoId === product.id}
                globalCooldown={globalCooldown}
                onSuggest={handleSuggest}
                onSaveAlt={handleSaveAlt}
                onSaveSeo={handleSaveSeo}
                onUpdateSuggestionField={updateSuggestionField}
              />
            ))}
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
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
          id: node.id, title: node.title, handle: node.handle,
          description: node.description, seo: node.seo, images: mappedImages
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
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is not set in Render environment variables.");

      const prompt = `You are Bob, a gritty, passionate lapidary artist running Rockhound Studio in Spokane Valley, WA. You are talking directly to a customer. Return ONLY valid JSON with exactly these three fields:
{ "altText": "...", "seoTitle": "...", "metaDescription": "..." }

Rules:
- altText formula: [Visual Beauty/Color] + [Finished Art Type] + [OOAK Indicator] + [Material] + [Origin region only] + "Rockhound Studio". Max 125 chars.
- seoTitle formula: [Stone Name] + [Finished Type] + "One-of-a-Kind" + "Rockhound Studio". Max 70 chars.
- metaDescription formula: Sound like a human craftsman. Describe the stone's visual beauty, then emphasize extreme rarity using the "dirt haul" concept naturally. Example: "We hauled a heavy bucket out of the canyon, but only found this one perfect piece. Cut by hand in our PNW shop. Once it's gone, it's gone." Do NOT repeat words. Max 150 chars STRICT.

Product Title: ${productTitle}
Product Description: ${productDescription}
Origin Context: ${origin}`;

      // Live 2.5-flash engine block
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );

      if (!geminiRes.ok) {
        const errorText = await geminiRes.text();
        throw new Error(`API Fault ${geminiRes.status}: ${errorText}`);
      }

      const data = await geminiRes.json();
      let rawText = data.candidates[0].content.parts[0].text;
      rawText = rawText.replace(/```json/gi, "").replace(/```/gi, "").trim();
      
      let parsedData;
      try { parsedData = JSON.parse(rawText); } 
      catch (e) { throw new Error("Gemini returned invalid JSON format."); }

      return { ok: true, intent, productId, suggestion: parsedData };
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
  const [savingAltId
import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Button, TextField, Banner, Thumbnail, Box, Divider, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH PRODUCTS & IMAGES
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const response = await admin.graphql(
      `#graphql
      query {
        products(first: 20, sortKey: UPDATED_AT, reverse: true) {
          edges {
            node {
              id
              title
              images(first: 5) {
                edges {
                  node {
                    id
                    url
                    altText
                  }
                }
              }
            }
          }
        }
      }`
    );
    const data = await response.json();
    return Response.json({ products: data.data?.products?.edges || [] });
  } catch (error) {
    console.error("Failed to load products:", error);
    return Response.json({ products: [], error: "Failed to load products." });
  }
};

// ==========================================
// 2. TRANSMISSION: SAVE OR GENERATE AI TEXT
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  try {
    // Intent A: Save to Shopify
    if (intent === "saveAltText") {
      const imageId = formData.get("imageId");
      const altText = formData.get("altText");
      const productId = formData.get("productId");

      const response = await admin.graphql(
        `#graphql
        mutation productImageUpdate($image: ImageInput!, $productId: ID!) {
          productImageUpdate(image: $image, productId: $productId) {
            image { id altText }
            userErrors { field message }
          }
        }`,
        { variables: { productId, image: { id: imageId, altText } } }
      );
      const data = await response.json();
      
      if (data.data?.productImageUpdate?.userErrors?.length > 0) {
        throw new Error(data.data.productImageUpdate.userErrors[0].message);
      }
      return Response.json({ intent, success: true, message: "SEO Alt Text locked in." });
    }

    // Intent B: Generate with Gemini
    if (intent === "generateAI") {
      const productTitle = formData.get("productTitle");
      const apiKey = process.env.GEMINI_API_KEY;
      
      const prompt = `You are an expert Shopify SEO copywriter. Write a highly optimized, descriptive alt text (under 100 characters) for a product image of: "${productTitle}". Return ONLY the alt text, no quotes or explanations.`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );
      
      const geminiData = await geminiRes.json();
      const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      
      return Response.json({ intent, success: true, imageId: formData.get("imageId"), generatedText });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI FRAMEWORK
// ==========================================
export default function SeoAltTextTab() {
  const { products = [], error } = useLoaderData() || {};
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  useEffect(() => {
    if (actionData?.message) shopify.toast.show(actionData.message);
    if (actionData?.error) shopify.toast.show(actionData.error, { isError: true });
  }, [actionData]);

  return (
    <Page title="SEO Alt Text Command" subtitle="Manage and auto-generate image alt text" fullWidth>
      {error && <Banner tone="critical">{error}</Banner>}
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <Text variant="headingMd" as="h2">Product Image Roster</Text>
            </Box>
            <Box padding="400">
              {products.length === 0 ? (
                <Text tone="subdued">No products found on the shop floor.</Text>
              ) : (
                <BlockStack gap="600">
                  {products.map(({ node: product }) => (
                    <Box key={product.id}>
                      <InlineStack gap="300" blockAlign="center">
                        <Text variant="headingSm" as="h3" fontWeight="bold">{product.title}</Text>
                        <Badge tone="info">{product.images.edges.length} Images</Badge>
                      </InlineStack>
                      <Box paddingBlockStart="200">
                        {product.images.edges.length === 0 ? (
                          <Text tone="subdued">No images for this product.</Text>
                        ) : (
                          <BlockStack gap="400">
                            {product.images.edges.map(({ node: image }) => (
                              <ImageRow 
                                key={image.id} 
                                product={product} 
                                image={image} 
                                submit={submit} 
                                navigation={navigation} 
                                actionData={actionData}
                              />
                            ))}
                          </BlockStack>
                        )}
                      </Box>
                      <Box paddingBlockStart="400"><Divider /></Box>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Sub-component for the individual rows
function ImageRow({ product, image, submit, navigation, actionData }) {
  const [altText, setAltText] = useState(image.altText || "");
  
  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") === "saveAltText" && navigation.formData?.get("imageId") === image.id;
  const isGenerating = navigation.state === "submitting" && navigation.formData?.get("intent") === "generateAI" && navigation.formData?.get("imageId") === image.id;

  // Listen for AI generation
  useEffect(() => {
    if (actionData?.intent === "generateAI" && actionData?.imageId === image.id && actionData?.generatedText) {
      setAltText(actionData.generatedText);
      shopify.toast.show("AI Alt Text Generated! Click Save to lock it in.");
    }
  }, [actionData, image.id]);

  const handleSave = () => {
    submit({ intent: "saveAltText", productId: product.id, imageId: image.id, altText }, { method: "post" });
  };

  const handleGenerateAI = () => {
    submit({ intent: "generateAI", productTitle: product.title, imageId: image.id }, { method: "post" });
  };

  return (
    <InlineStack wrap={false} gap="400" blockAlign="center">
      <Thumbnail source={image.url} alt={altText} size="large" />
      <Box width="100%">
        <TextField 
          value={altText} 
          onChange={setAltText} 
          placeholder="Enter SEO Alt Text or hit Generate..." 
          autoComplete="off" 
        />
      </Box>
      <InlineStack gap="200" wrap={false}>
        <Button onClick={handleGenerateAI} loading={isGenerating}>Gemini AI</Button>
        <Button onClick={handleSave} loading={isSaving} variant="primary" tone="success">Save</Button>
      </InlineStack>
    </InlineStack>
  );
}
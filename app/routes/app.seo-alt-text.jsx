import { useState, useEffect } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Button, TextField, Banner, Thumbnail, Box, Divider, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH PRODUCTS & IMAGES
// FIX: Rewired from images → media connection
// Returns MediaImage GIDs required by fileUpdate
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
              media(first: 5) {
                edges {
                  node {
                    ... on MediaImage {
                      id
                      image {
                        url
                        altText
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }`
    );
    const data = await response.json();

    // Adapter: map media shape back to frontend image shape
    const products = (data.data?.products?.edges || []).map(({ node: product }) => ({
      node: {
        ...product,
        images: {
          edges: product.media.edges
            .filter(({ node }) => node.id) // MediaImage only
            .map(({ node: mediaNode }) => ({
              node: {
                id: mediaNode.id, // gid://shopify/MediaImage/...
                url: mediaNode.image?.url,
                altText: mediaNode.image?.altText,
              }
            }))
        }
      }
    }));

    return Response.json({ products });
  } catch (error) {
    console.error("Failed to load products:", error);
    return Response.json({ products: [], error: "Failed to load products." });
  }
};

// ==========================================
// 2. TRANSMISSION: SAVE OR GENERATE AI TEXT
// FIX: productImageUpdate → fileUpdate (alt field)
// FIX: gemini-2.5-pro → gemini-2.5-flash on v1beta
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    // Intent A: Save to Shopify
    if (intent === "saveAltText") {
      const imageId = formData.get("imageId"); // MediaImage GID
      const altText = formData.get("altText");

      const response = await admin.graphql(
        `#graphql
        mutation fileUpdate($files: [FileUpdateInput!]!) {
          fileUpdate(files: $files) {
            files {
              ... on MediaImage {
                id
                image { altText }
              }
            }
            userErrors { field message }
          }
        }`,
        { variables: { files: [{ id: imageId, alt: altText }] } }
      );
      const data = await response.json();

      if (data.data?.fileUpdate?.userErrors?.length > 0) {
        throw new Error(data.data.fileUpdate.userErrors[0].message);
      }
      return Response.json({ intent, success: true, message: "SEO Alt Text locked in." });
    }

    // Intent B: Generate with AI
    if (intent === "generateAI") {
      const productTitle = formData.get("productTitle");
      const apiKey = process.env.GEMINI_API_KEY;

      const prompt = `You are an expert Shopify SEO copywriter specializing in premium handcrafted gemstone art. Write a highly optimized, descriptive alt text (under 100 characters) for a product image of: "${productTitle}". Follow this formula: [Visual Beauty/Color] + [Finished Art Type] + [OOAK Indicator] + [Material] + [Region hint]. Return ONLY the alt text, no quotes or explanations.`;

      const aiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      );

      const aiData = await aiRes.json();
      const generatedText = aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      return Response.json({ intent, success: true, imageId: formData.get("imageId"), generatedText });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI FRAMEWORK
// FIX: Added back button to /app
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
    <Page
      title="SEO Alt Text Command"
      subtitle="Manage and auto-generate image alt text"
      fullWidth
      backAction={{ content: "Home", url: "/app" }}
    >
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

// Sub-component for individual image rows
function ImageRow({ product, image, submit, navigation, actionData }) {
  const [altText, setAltText] = useState(image.altText || "");

  const isSaving = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "saveAltText" &&
    navigation.formData?.get("imageId") === image.id;

  const isGenerating = navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "generateAI" &&
    navigation.formData?.get("imageId") === image.id;

  useEffect(() => {
    if (actionData?.intent === "generateAI" && actionData?.imageId === image.id && actionData?.generatedText) {
      setAltText(actionData.generatedText);
      shopify.toast.show("AI Alt Text generated — click Save to lock it in.");
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

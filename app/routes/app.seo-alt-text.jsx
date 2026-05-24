import { useState, useEffect } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation, useNavigate } from "@remix-run/react";
import { Page, Layout, Card, BlockStack, InlineStack, Text, Button, TextField, Banner, Thumbnail, Box, Divider, Badge } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: FETCH ALL IMAGES
// Returns a flat array of all images across all products
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    let allImages = [];
    let cursor = null;
    let hasNextPage = true;
    let cycleCount = 0;

    while (hasNextPage && cycleCount < 20) {
      const response = await admin.graphql(
        `#graphql
        query GetProductsWithImages($cursor: String) {
          products(first: 100, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                media(first: 50) {
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
        }`,
        { variables: { cursor } }
      );
      
      const data = await response.json();
      
      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      const page = data.data?.products;
      if (!page) {
        break;
      }

      // Adapter: Flatten products and media into a single images array
      page.edges.forEach(({ node: product }) => {
        const productImages = (product.media?.edges || [])
          .filter(({ node }) => node.id) // MediaImage only
          .map(({ node: mediaNode }) => ({
            id: mediaNode.id, // gid://shopify/MediaImage/...
            url: mediaNode.image?.url || "",
            altText: mediaNode.image?.altText || "",
            productTitle: product.title,
            productHandle: product.handle,
            needsAltText: !mediaNode.image?.altText || mediaNode.image?.altText.trim() === ""
          }));
        
        allImages = allImages.concat(productImages);
      });

      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
      cycleCount++;
    }

    return Response.json({ images: allImages });
  } catch (error) {
    console.error("Failed to load images:", error);
    return Response.json({ images: [], error: "Failed to load images." });
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
// ==========================================
export default function SeoAltTextTab() {
  const { images = [], error } = useLoaderData() || {};
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  useEffect(() => {
    if (actionData?.message) shopify.toast.show(actionData.message);
    if (actionData?.error) shopify.toast.show(actionData.error, { isError: true });
  }, [actionData]);

  return (
    <Page
      title="SEO Alt Text Command"
      subtitle="Manage and auto-generate image alt text across all products"
      fullWidth
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      {error && <Banner tone="critical">{error}</Banner>}
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Master Image Roster</Text>
                <Badge tone="info">{images.length} Total Images</Badge>
              </InlineStack>
            </Box>
            <Box padding="400">
              {images.length === 0 && (
                <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                  <Text tone="subdued">No images found on the shop floor.</Text>
                </div>
              )}
              
              {images.length > 0 && (
                <BlockStack gap="600">
                  {images.map((image) => (
                    <Box key={image.id}>
                      <ImageRow
                        image={image}
                        submit={submit}
                        navigation={navigation}
                        actionData={actionData}
                      />
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

// ==========================================
// 4. SUB-COMPONENT: IMAGE ROW MANAGER
// ==========================================
function ImageRow({ image, submit, navigation, actionData }) {
  const [altText, setAltText] = useState(image.altText);

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
    submit({ intent: "saveAltText", imageId: image.id, altText }, { method: "post" });
  };

  const handleGenerateAI = () => {
    submit({ intent: "generateAI", productTitle: image.productTitle, imageId: image.id }, { method: "post" });
  };

  return (
    <div style={{ minHeight: "48px", display: "flex", flexDirection: "column", width: "100%", gap: "12px" }}>
      <InlineStack gap="300" blockAlign="center">
        <Text variant="headingSm" as="h3" fontWeight="bold">{image.productTitle}</Text>
        {image.needsAltText && <Badge tone="critical">Missing Alt Text</Badge>}
      </InlineStack>
      
      <InlineStack wrap={false} gap="400" blockAlign="center" style={{ width: "100%" }}>
        <Thumbnail source={image.url} alt={altText} size="large" />
        <Box width="100%">
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center", width: "100%" }}>
            <TextField
              label={`Alt text for ${image.productTitle}`}
              labelHidden
              value={altText}
              onChange={setAltText}
              placeholder="Enter SEO Alt Text or hit Generate..."
              autoComplete="off"
            />
          </div>
        </Box>
        <InlineStack gap="200" wrap={false}>
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
            <Button
              size="large"
              accessibilityLabel={`Generate AI alt text for ${image.productTitle}`}
              onClick={handleGenerateAI}
              loading={isGenerating}
            >
              Gemini AI
            </Button>
          </div>
          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
            <Button
              size="large"
              accessibilityLabel={`Save alt text for ${image.productTitle}`}
              onClick={handleSave}
              loading={isSaving}
              variant="primary"
              tone="success"
            >
              Save
            </Button>
          </div>
        </InlineStack>
      </InlineStack>
    </div>
  );
}
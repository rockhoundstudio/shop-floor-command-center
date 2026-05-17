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
  Thumbnail
} from "@shopify/polaris";

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Engine Fault">
      <Card background="bg-surface-critical">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h1" fontWeight="bold">Manual Editor Crashed</Text>
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
                seo { title description }
                media(first: 10) {
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
          id: node.id, title: node.title,
          seo: node.seo, images: mappedImages
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

export default function SeoAltTextManager() {
  const { products: initialProducts } = useLoaderData();
  const fetcher = useFetcher();
  const [products, setProducts] = useState(initialProducts);
  const [savingAltId, setSavingAltId] = useState(null);
  const [savingSeoId, setSavingSeoId] = useState(null);
  const [toast, setToast] = useState(null);
  const [pageError, setPageError] = useState(null);

  // Local state for manual edits
  const [altEdits, setAltEdits] = useState({});
  const [seoEdits, setSeoEdits] = useState({});

  useEffect(() => {
    // Initialize state with current shop data
    const initialAlt = {};
    const initialSeo = {};
    initialProducts.forEach(p => {
      initialAlt[p.id] = p.images.map(img => ({ id: img.id, altText: img.altText || "" }));
      initialSeo[p.id] = { title: p.seo?.title || "", description: p.seo?.description || "" };
    });
    setAltEdits(initialAlt);
    setSeoEdits(initialSeo);
  }, [initialProducts]);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setSavingAltId(null); setSavingSeoId(null);
      if (!fetcher.data.ok) {
        setPageError(`❌ Fault: ${fetcher.data.error}`);
        return;
      }
      setPageError(null);
      const { intent } = fetcher.data;
      if (intent === "save_alt") {
        setToast({ message: "✓ Manual Alt Text Saved", tone: "success" });
      } else if (intent === "save_seo") {
        setToast({ message: "✓ Manual SEO Data Saved", tone: "success" });
      }
      setTimeout(() => setToast(null), 3000);
    }
  }, [fetcher.state, fetcher.data]);

  const handleAltChange = (productId, imageIndex, value) => {
    setAltEdits(prev => {
      const productAlts = [...(prev[productId] || [])];
      if (productAlts[imageIndex]) {
        productAlts[imageIndex].altText = value;
      }
      return { ...prev, [productId]: productAlts };
    });
  };

  const handleSeoChange = (productId, field, value) => {
    setSeoEdits(prev => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [field]: value }
    }));
  };

  const handleSaveAlt = (productId) => {
    setSavingAltId(productId);
    const pairs = altEdits[productId].map(img => ({ id: img.id, alt: img.altText }));
    const fd = new FormData();
    fd.append("intent", "save_alt");
    fd.append("productId", productId);
    fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
  };

  const handleSaveSeo = (productId) => {
    setSavingSeoId(productId);
    const seoData = seoEdits[productId] || {};
    const fd = new FormData();
    fd.append("intent", "save_seo");
    fd.append("productId", productId);
    fd.append("seoTitle", seoData.title || "");
    fd.append("seoDescription", seoData.description || "");
    fetcher.submit(fd, { method: "post" });
  };

  return (
    <Page title="Manual SEO & Alt Text" subtitle="Direct manual control over product SEO and image Alt Text.">
      {toast && <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}><Banner tone={toast.tone}>{toast.message}</Banner></div>}
      <Layout>
        {pageError && (
          <Layout.Section>
            <Banner tone="critical" title="Action Failed" onDismiss={() => setPageError(null)}><Text as="p">{pageError}</Text></Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <BlockStack gap="500">
            {products.map((product) => (
              <Card key={product.id}>
                <BlockStack gap="400">
                  <Text variant="headingMd" fontWeight="bold">{product.title}</Text>
                  <Divider />
                  <InlineStack align="start" gap="800">
                    
                    {/* LEFT COLUMN: MANUAL ALT TEXT */}
                    <Box style={{ flex: 1 }}>
                      <BlockStack gap="300">
                        <Text variant="headingSm" fontWeight="bold">Image Alt Text</Text>
                        {product.images.length === 0 ? (
                          <Text tone="subdued">No images for this product.</Text>
                        ) : (
                          <BlockStack gap="300">
                            {altEdits[product.id]?.map((img, index) => (
                              <InlineStack key={img.id} align="start" gap="300" blockAlign="center">
                                <Thumbnail source={product.images[index]?.url || ""} alt="Thumbnail" size="small" />
                                <Box style={{ flex: 1 }}>
                                  <TextField
                                    labelHidden
                                    label="Alt Text"
                                    value={img.altText}
                                    onChange={(val) => handleAltChange(product.id, index, val)}
                                    autoComplete="off"
                                  />
                                </Box>
                              </InlineStack>
                            ))}
                            <Box paddingBlockStart="200">
                              <Button size="slim" onClick={() => handleSaveAlt(product.id)} loading={savingAltId === product.id}>
                                Save Alt Text
                              </Button>
                            </Box>
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Box>
                    
                    {/* RIGHT COLUMN: MANUAL SEO */}
                    <Box style={{ flex: 1 }}>
                      <BlockStack gap="300">
                        <Text variant="headingSm" fontWeight="bold">SEO Metadata</Text>
                        <BlockStack gap="200">
                          <TextField
                            label="SEO Title"
                            value={seoEdits[product.id]?.title || ""}
                            onChange={(val) => handleSeoChange(product.id, "title", val)}
                            autoComplete="off"
                          />
                          <TextField
                            label="Meta Description"
                            value={seoEdits[product.id]?.description || ""}
                            onChange={(val) => handleSeoChange(product.id, "description", val)}
                            multiline={3}
                            autoComplete="off"
                          />
                          <Box paddingBlockStart="200">
                            <Button size="slim" onClick={() => handleSaveSeo(product.id)} loading={savingSeoId === product.id}>
                              Save SEO Data
                            </Button>
                          </Box>
                        </BlockStack>
                      </BlockStack>
                    </Box>

                  </InlineStack>
                </BlockStack>
              </Card>
            ))}
            {products.length === 0 && <Banner tone="info"><Text>No products found.</Text></Banner>}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
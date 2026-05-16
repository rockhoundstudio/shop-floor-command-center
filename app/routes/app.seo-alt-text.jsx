import { useState, useCallback, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError, isRouteErrorResponse } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Badge,
  TextField,
  Thumbnail,
  Banner,
  Select,
  Spinner,
  BlockStack,
  InlineStack,
  Divider,
  Box,
  Checkbox,
} from "@shopify/polaris";

// ─── ERROR BOUNDARY (The Diagnostic Screen) ───────────────────────────────────
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Engine Fault">
      <Card background="bg-surface-critical">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h1" fontWeight="bold">Dashboard Crashed</Text>
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
  try {
    const { admin } = await authenticate.admin(request);

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
                seo { title description }
                media(first: 10) {
                  edges {
                    node {
                      ... on MediaImage {
                        id
                        alt
                        image {
                          url
                        }
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

      // Adapter: Map the new Media nodes back into the old images shape for the UI
      const formattedNodes = page.edges.map((e) => {
        const node = e.node;
        const mappedImages = (node.media?.edges || [])
          .filter(mediaEdge => mediaEdge.node.image) 
          .map(mediaEdge => ({
            node: {
              id: mediaEdge.node.id, 
              src: mediaEdge.node.image?.url || "",
              altText: mediaEdge.node.alt || ""
            }
          }));

        return {
          id: node.id,
          title: node.title,
          handle: node.handle,
          seo: node.seo,
          images: { edges: mappedImages }
        };
      });

      allProducts = allProducts.concat(formattedNodes);
      hasNextPage = page.pageInfo.hasNextPage;
      cursor = page.pageInfo.endCursor;
      cycleCount++;
    }

    return { products: allProducts };
  } catch (error) {
    throw new Response(error.message || "Failed to load product map.", {
      status: 500,
      statusText: "Loader Engine Fault",
    });
  }
};

// ─── ACTION (The Engine with Chunking Governor) ───────────────────────────────
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    // Save single image alt text
    if (intent === "save_alt") {
      const imageId = body.get("imageId");
      const altText = body.get("altText");
      
      const res = await admin.graphql(
        `mutation fileUpdate($files: [FileUpdateInput!]!) {
          fileUpdate(files: $files) {
            files {
              ... on MediaImage {
                id
                alt
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { files: [{ id: imageId, alt: altText }] } }
      );
      
      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);
      if (json.data.fileUpdate.userErrors.length > 0) {
         throw new Error(json.data.fileUpdate.userErrors[0].message);
      }
      
      return { ok: true, result: { image: { id: imageId, altText } } };
    }

    // Bulk/Group auto-fill alt text
    if (intent === "bulk_alt") {
      const pairs = JSON.parse(body.get("pairs")); 
      const results = [];
      
      // THE CHUNKING GOVERNOR: Process in batches of 10
      const chunkSize = 10;
      for (let i = 0; i < pairs.length; i += chunkSize) {
        const chunk = pairs.slice(i, i + chunkSize);
        
        const filesInput = chunk.map(({ imageId, title }) => ({ id: imageId, alt: title }));
        
        const res = await admin.graphql(
          `mutation fileUpdate($files: [FileUpdateInput!]!) {
            fileUpdate(files: $files) {
              files {
                ... on MediaImage {
                  id
                  alt
                }
              }
              userErrors {
                field
                message
              }
            }
          }`,
          { variables: { files: filesInput } }
        );
        
        const json = await res.json();
        if (json.errors) throw new Error(json.errors[0].message);
        if (json.data.fileUpdate.userErrors.length > 0) {
           throw new Error(json.data.fileUpdate.userErrors[0].message);
        }
        
        const formatted = filesInput.map(f => ({ image: { id: f.id, altText: f.alt } }));
        results.push(...formatted);
        
        if (i + chunkSize < pairs.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      return { ok: true, results };
    }

    // Save single product SEO
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
      return { ok: true, result: json.data.productUpdate };
    }

    return { ok: false, error: "Unknown intent" };
  } catch (error) {
    return { ok: false, error: error.message || "An internal engine fault occurred." };
  }
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function seoStatus(title, description) {
  const tLen = (title || "").length;
  const dLen = (description || "").length;
  if (!tLen && !dLen) return "red";
  if (tLen < 30 || dLen < 100) return "yellow";
  if (tLen >= 50 && tLen <= 60 && dLen >= 150 && dLen <= 160) return "green";
  if (tLen > 0 && dLen > 0) return "yellow";
  return "red";
}

function altStatus(images) {
  if (!images || images.length === 0) return "green"; 
  const missing = images.filter((img) => !img.altText || img.altText.trim() === "");
  if (missing.length === 0) return "green";
  return "red";
}

function StatusDot({ status }) {
  const map = { green: "🟢", yellow: "🟡", red: "🔴" };
  return <span>{map[status] || "⚪"}</span>;
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SeoAltTextTab() {
  const { products: initialProducts } = useLoaderData();
  const fetcher = useFetcher();

  const [activeTab, setActiveTab] = useState("alt"); 
  const [filter, setFilter] = useState("all"); 
  const [products, setProducts] = useState(initialProducts);
  const [editAlt, setEditAlt] = useState({}); 
  const [editSeo, setEditSeo] = useState({}); 
  const [saving, setSaving] = useState(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [toast, setToast] = useState(null); 

  // THE MULTI-FIRE JIG STATE
  const [selectedImages, setSelectedImages] = useState([]);
  const [groupText, setGroupText] = useState({});

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (!fetcher.data.ok) {
        setSaving(null);
        setBulkRunning(false);
        setToast({ message: `❌ Fault: ${fetcher.data.error}`, tone: "critical" });
        setTimeout(() => setToast(null), 5000);
        return;
      }

      setSaving(null);
      setBulkRunning(false);
      
      // Clear selections on successful save
      setSelectedImages([]);
      setGroupText({});
      
      setToast({ message: "Saved ✓", tone: "success" });
      setTimeout(() => setToast(null), 2500);

      if (fetcher.data.result?.image) {
        const img = fetcher.data.result.image;
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            images: {
              edges: p.images.edges.map((e) =>
                e.node.id === img.id ? { node: { ...e.node, altText: img.altText } } : e
              ),
            },
          }))
        );
      }
      if (fetcher.data.result?.product) {
        const prod = fetcher.data.result.product;
        setProducts((prev) =>
          prev.map((p) => (p.id === prod.id ? { ...p, seo: prod.seo } : p))
        );
      }
      if (fetcher.data.results) {
        const updated = {};
        fetcher.data.results.forEach((r) => {
          if (r?.image) updated[r.image.id] = r.image.altText;
        });
        setProducts((prev) =>
          prev.map((p) => ({
            ...p,
            images: {
              edges: p.images.edges.map((e) =>
                updated[e.node.id] !== undefined
                  ? { node: { ...e.node, altText: updated[e.node.id] } }
                  : e
              ),
            },
          }))
        );
      }
    }
  }, [fetcher.state, fetcher.data]);

  const allImages = products.flatMap((p) =>
    (p.images?.edges || []).map((e) => ({
      productId: p.id,
      productTitle: p.title,
      imageId: e.node.id,
      src: e.node.src,
      altText: e.node.altText || "",
    }))
  );

  const filteredProducts = products.filter((p) => {
    if (activeTab === "alt") {
      const status = altStatus((p.images?.edges || []).map((e) => e.node));
      if (filter === "missing") return status === "red";
      if (filter === "good") return status === "green";
      return true;
    } else {
      const status = seoStatus(p.seo?.title, p.seo?.description);
      if (filter === "missing") return status === "red";
      if (filter === "weak") return status === "yellow";
      if (filter === "good") return status === "green";
      return true;
    }
  });

  const handleSaveAlt = (productId, imageId) => {
    const altText = editAlt[imageId] ?? allImages.find((i) => i.imageId === imageId)?.altText ?? "";
    setSaving(imageId);
    const fd = new FormData();
    fd.append("intent", "save_alt");
    fd.append("productId", productId);
    fd.append("imageId", imageId);
    fd.append("altText", altText);
    fetcher.submit(fd, { method: "post" });
  };

  // MULTI-FIRE JIG EXECUTOR
  const handleGroupSaveAlt = (productId, selectedImgIds) => {
    const textToApply = groupText[productId] || "";
    if (!textToApply.trim()) return;

    setBulkRunning(productId);
    const pairs = selectedImgIds.map((id) => ({
      imageId: id,
      title: textToApply, 
    }));
    
    const fd = new FormData();
    fd.append("intent", "bulk_alt");
    fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
  };

  const toggleSelection = (imageId) => {
    setSelectedImages((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId]
    );
  };

  const handleSaveSeo = (productId) => {
    const current = products.find((p) => p.id === productId)?.seo || {};
    const title = editSeo[productId]?.title ?? current.title ?? "";
    const description = editSeo[productId]?.description ?? current.description ?? "";
    setSaving(productId);
    const fd = new FormData();
    fd.append("intent", "save_seo");
    fd.append("productId", productId);
    fd.append("seoTitle", title);
    fd.append("seoDescription", description);
    fetcher.submit(fd, { method: "post" });
  };

  // ⚡ TASK 1: PREMIUM BULK FILL DEFAULT
  const handleBulkAlt = () => {
    setBulkRunning(true);
    const pairs = allImages
      .filter((img) => !img.altText || img.altText.trim() === "")
      .map((img) => ({ 
        productId: img.productId, 
        imageId: img.imageId, 
        // Generates: "[Visual Beauty] [Stone Name], one-of-a-kind handcrafted art, Rockhound Studio"
        title: `[Visual Beauty/Color] polished ${img.productTitle}, one-of-a-kind handcrafted art, Rockhound Studio` 
      }));
    const fd = new FormData();
    fd.append("intent", "bulk_alt");
    fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
  };

  // ⚡ TASK 4: ADD CUSTOM POLISHING CHIPS
  const injectChip = (productId, phrase) => {
    setEditSeo((prev) => {
      const currentDesc = prev[productId]?.description ?? products.find(p => p.id === productId)?.seo?.description ?? "";
      const newDesc = currentDesc ? `${currentDesc} ${phrase}` : phrase;
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          description: newDesc,
        },
      };
    });
  };

  // AUTO-INJECT HELPERS FOR SEO
  const injectSeoTitleTemplate = (productId, productTitle) => {
    setEditSeo((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        title: `${productTitle} — One-of-a-Kind | Rockhound Studio`,
      },
    }));
  };

  const injectSeoDescTemplate = (productId, productTitle) => {
    setEditSeo((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        description: `This ${productTitle} found its way from the [Origin] to Bob and Janyce's bench in Spokane Valley. Polished by hand. One of a kind. Read its story.`,
      },
    }));
  };

  const altFilterOptions = [
    { label: "All", value: "all" },
    { label: "🔴 Missing Alt", value: "missing" },
    { label: "🟢 Good", value: "good" },
  ];
  const seoFilterOptions = [
    { label: "All", value: "all" },
    { label: "🔴 Missing", value: "missing" },
    { label: "🟡 Weak", value: "weak" },
    { label: "🟢 Good", value: "good" },
  ];

  return (
    <Page
      title="SEO & Alt Text Diagnostics"
      subtitle="Group select images to tag premium, story-driven details for everyday buyers."
    >
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Banner tone={toast.tone}>{toast.message}</Banner>
        </div>
      )}

      <Layout>
        <Layout.Section>
          <InlineStack gap="300">
            <Button
              variant={activeTab === "alt" ? "primary" : "secondary"}
              onClick={() => { setActiveTab("alt"); setFilter("all"); }}
            >
              🖼 Premium Story Alt Text
            </Button>
            <Button
              variant={activeTab === "seo" ? "primary" : "secondary"}
              onClick={() => { setActiveTab("seo"); setFilter("all"); }}
            >
              🔍 Premium SEO
            </Button>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <InlineStack gap="400" align="space-between">
            <div style={{ minWidth: 220 }}>
              <Select
                label="Filter"
                options={activeTab === "alt" ? altFilterOptions : seoFilterOptions}
                value={filter}
                onChange={(v) => setFilter(v)}
              />
            </div>
            {activeTab === "alt" && (
              <Button
                onClick={handleBulkAlt}
                loading={bulkRunning}
                disabled={altMissing === 0}
              >
                ⚡ Bulk Fill All Missing Alt (Premium Template)
              </Button>
            )}
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          <Divider />
        </Layout.Section>

        {activeTab === "alt" && (
          <Layout.Section>
            <BlockStack gap="400">
              {filteredProducts.map((product) => {
                const images = (product.images?.edges || []).map((e) => e.node);
                const status = altStatus(images);
                const prodSelected = images.filter((img) => selectedImages.includes(img.id));

                return (
                  <Card key={product.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <InlineStack gap="200">
                          <StatusDot status={status} />
                          <Text variant="headingSm" fontWeight="bold">
                            {product.title}
                          </Text>
                        </InlineStack>
                        <Text tone="subdued" variant="bodySm">
                          {images.length} image{images.length !== 1 ? "s" : ""}
                        </Text>
                      </InlineStack>

                      {images.length === 0 && (
                        <Text tone="subdued">No images on this product.</Text>
                      )}

                      {/* GROUP TICK BATCH COMMAND PANEL */}
                      {prodSelected.length > 0 && (
                        <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                          <BlockStack gap="300">
                            <Text fontWeight="bold">
                              Apply to {prodSelected.length} Selected View(s)
                            </Text>
                            <InlineStack gap="300" align="start">
                              <div style={{ flex: 1 }}>
                                <TextField
                                  value={groupText[product.id] || ""}
                                  onChange={(val) =>
                                    setGroupText((prev) => ({ ...prev, [product.id]: val }))
                                  }
                                  placeholder="e.g. Deep red flash polished fire obsidian pocket stone, one-of-a-kind handcrafted art..."
                                  autoComplete="off"
                                />
                              </div>
                              <Button
                                variant="primary"
                                onClick={() => handleGroupSaveAlt(product.id, prodSelected.map(i => i.id))}
                                loading={bulkRunning === product.id}
                                disabled={!(groupText[product.id] || "").trim()}
                              >
                                Fire Batch
                              </Button>
                            </InlineStack>
                          </BlockStack>
                        </Box>
                      )}

                      <InlineStack gap="400" wrap>
                        {images.map((img) => {
                          const currentAlt = editAlt[img.id] ?? img.altText ?? "";
                          const hasAlt = img.altText && img.altText.trim() !== "";
                          const isChecked = selectedImages.includes(img.id);

                          return (
                            <Box
                              key={img.id}
                              padding="300"
                              background={hasAlt ? "bg-surface-success" : "bg-surface-critical"}
                              borderRadius="200"
                              style={{ width: "100%", maxWidth: "450px" }}
                            >
                              <InlineStack gap="400" align="start" blockAlign="start">
                                <Box paddingBlockStart="100">
                                  <Checkbox
                                    checked={isChecked}
                                    onChange={() => toggleSelection(img.id)}
                                  />
                                </Box>
                                <Thumbnail
                                  source={img.src}
                                  alt={img.altText || "No alt text"}
                                  size="large"
                                />
                                <BlockStack gap="200" style={{ flex: 1 }}>
                                  <TextField
                                    label={hasAlt ? "🟢 Tagged" : "🔴 Missing Tag"}
                                    value={currentAlt}
                                    onChange={(val) =>
                                      setEditAlt((prev) => ({ ...prev, [img.id]: val }))
                                    }
                                    placeholder="e.g. Deep red flash polished fire obsidian pocket stone..."
                                    autoComplete="off"
                                  />
                                  <InlineStack gap="200">
                                    <Button
                                      size="slim"
                                      onClick={() => {
                                        // Auto-inject template for single image
                                        setEditAlt((prev) => ({ 
                                          ...prev, 
                                          [img.id]: `[Visual Beauty/Color] polished ${product.title}, one-of-a-kind handcrafted art, Rockhound Studio` 
                                        }));
                                      }}
                                    >
                                      Load Template
                                    </Button>
                                    <Button
                                      size="slim"
                                      variant="primary"
                                      onClick={() => handleSaveAlt(product.id, img.id)}
                                      loading={saving === img.id}
                                      disabled={prodSelected.length > 0} 
                                    >
                                      Save Single
                                    </Button>
                                  </InlineStack>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                          );
                        })}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                );
              })}
            </BlockStack>
          </Layout.Section>
        )}

        {activeTab === "seo" && (
          <Layout.Section>
            <BlockStack gap="400">
              {filteredProducts.map((product) => {
                const seo = product.seo || {};
                const editedTitle = editSeo[product.id]?.title ?? seo.title ?? "";
                const editedDesc = editSeo[product.id]?.description ?? seo.description ?? "";
                const status = seoStatus(editedTitle, editedDesc);
                const tLen = editedTitle.length;
                const dLen = editedDesc.length;

                return (
                  <Card key={product.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <InlineStack gap="200">
                          <StatusDot status={status} />
                          <Text variant="headingSm" fontWeight="bold">
                            {product.title}
                          </Text>
                        </InlineStack>
                      </InlineStack>

                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" fontWeight="bold">SEO Title</Text>
                          <Button size="slim" onClick={() => injectSeoTitleTemplate(product.id, product.title)}>
                            ⚡ Auto-Fill Template
                          </Button>
                        </InlineStack>
                        <TextField
                          label={`SEO Title — ${tLen} chars (target: 50–60)`}
                          value={editedTitle}
                          onChange={(val) =>
                            setEditSeo((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...prev[product.id],
                                title: val,
                              },
                            }))
                          }
                          placeholder="e.g. Fire Obsidian Display Stone — One-of-a-Kind | Rockhound Studio"
                          autoComplete="off"
                          error={
                            tLen > 60 ? "Too long (over 60 chars)" : tLen > 0 && tLen < 30 ? "Too short (under 30 chars)" : undefined
                          }
                        />
                        <Text tone="subdued" variant="bodySm">
                          {tLen === 0 ? "🔴 Missing" : tLen >= 50 && tLen <= 60 ? "🟢 Good length" : "🟡 Adjust length"}
                        </Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" fontWeight="bold">Meta Description</Text>
                          <Button size="slim" onClick={() => injectSeoDescTemplate(product.id, product.title)}>
                            ⚡ Auto-Fill Template
                          </Button>
                        </InlineStack>
                        <TextField
                          label={`Meta Description — ${dLen} chars (target: 150–160)`}
                          value={editedDesc}
                          onChange={(val) =>
                            setEditSeo((prev) => ({
                              ...prev,
                              [product.id]: {
                                ...prev[product.id],
                                description: val,
                              },
                            }))
                          }
                          placeholder="e.g. This fire obsidian found its way from the high desert to Bob and Janyce's bench in Spokane Valley. Polished by hand. One of a kind..."
                          multiline={3}
                          autoComplete="off"
                          error={
                            dLen > 160 ? "Too long (over 160 chars)" : dLen > 0 && dLen < 100 ? "Too short (under 100 chars)" : undefined
                          }
                        />
                        <Text tone="subdued" variant="bodySm">
                          {dLen === 0 ? "🔴 Missing" : dLen >= 150 && dLen <= 160 ? "🟢 Good length" : "🟡 Adjust length"}
                        </Text>
                        
                        {/* ⚡ TASK 4: CUSTOM POLISHING CHIPS */}
                        <InlineStack gap="200" wrap>
                          <Button size="slim" onClick={() => injectChip(product.id, "custom stone polishing service")}>
                            + Custom Stone Polishing
                          </Button>
                          <Button size="slim" onClick={() => injectChip(product.id, "heirloom rock polishing")}>
                            + Heirloom Rock Polishing
                          </Button>
                          <Button size="slim" onClick={() => injectChip(product.id, "turn your found rock into art")}>
                            + Turn Found Rock Into Art
                          </Button>
                        </InlineStack>
                      </BlockStack>

                      <Button
                        variant="primary"
                        onClick={() => handleSaveSeo(product.id)}
                        loading={saving === product.id}
                      >
                        Save SEO Data
                      </Button>
                    </BlockStack>
                  </Card>
                );
              })}
            </BlockStack>
          </Layout.Section>
        )}

        {filteredProducts.length === 0 && (
          <Layout.Section>
            <Banner tone="success">
              <Text>No products match this filter. You're clean. 🟢</Text>
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
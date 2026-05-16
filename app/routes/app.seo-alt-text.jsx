import { useState, useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  TextField,
  Thumbnail,
  Banner,
  Select,
  BlockStack,
  InlineStack,
  Divider,
  Box,
} from "@shopify/polaris";

// ─── LOADER ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  let allProducts = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const res = await admin.graphql(
      `query GetProducts($cursor: String) {
        products(first: 25, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id
              title
              handle
              seo { title description }
              images(first: 10) {
                edges {
                  node {
                    id
                    src
                    altText
                  }
                }
              }
            }
          }
        }
      }`,
      { variables: { cursor } }
    );
    const json = await res.json();
    const page = json.data.products;
    allProducts = allProducts.concat(page.edges.map((e) => e.node));
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return { products: allProducts };
};

// ─── ACTION ───────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.formData();
  const intent = body.get("intent");

  if (intent === "save_alt") {
    const imageId = body.get("imageId");
    const productId = body.get("productId");
    const altText = body.get("altText");
    const res = await admin.graphql(
      `mutation UpdateImageAlt($productId: ID!, $imageId: ID!, $altText: String!) {
        productImageUpdate(productId: $productId, image: { id: $imageId, altText: $altText }) {
          image { id altText }
          userErrors { field message }
        }
      }`,
      { variables: { productId, imageId, altText } }
    );
    const json = await res.json();
    return { ok: true, result: json.data.productImageUpdate };
  }

  if (intent === "bulk_alt") {
    const pairs = JSON.parse(body.get("pairs"));
    const results = [];
    const CHUNK = 20;

    for (let i = 0; i < pairs.length; i += CHUNK) {
      const batch = pairs.slice(i, i + CHUNK);
      for (const { productId, imageId, title } of batch) {
        const res = await admin.graphql(
          `mutation UpdateImageAlt($productId: ID!, $imageId: ID!, $altText: String!) {
            productImageUpdate(productId: $productId, image: { id: $imageId, altText: $altText }) {
              image { id altText }
              userErrors { field message }
            }
          }`,
          { variables: { productId, imageId, altText: title } }
        );
        const json = await res.json();
        results.push(json.data.productImageUpdate);
      }
      if (i + CHUNK < pairs.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    return { ok: true, results };
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
      }`,
      { variables: { productId, seoTitle, seoDescription } }
    );
    const json = await res.json();
    return { ok: true, result: json.data.productUpdate };
  }

  return { ok: false, error: "Unknown intent" };
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

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      setSaving(null);
      setBulkRunning(false);
      setToast("Saved ✓");
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
          if (r.image) updated[r.image.id] = r.image.altText;
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

  const altMissing = products.filter(
    (p) => altStatus((p.images?.edges || []).map((e) => e.node)) === "red"
  ).length;
  const seoRed = products.filter((p) => seoStatus(p.seo?.title, p.seo?.description) === "red").length;
  const seoYellow = products.filter((p) => seoStatus(p.seo?.title, p.seo?.description) === "yellow").length;

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

  const handleBulkAlt = () => {
    setBulkRunning(true);
    const pairs = allImages
      .filter((img) => !img.altText || img.altText.trim() === "")
      .map((img) => ({ productId: img.productId, imageId: img.imageId, title: img.productTitle }));
    const fd = new FormData();
    fd.append("intent", "bulk_alt");
    fd.append("pairs", JSON.stringify(pairs));
    fetcher.submit(fd, { method: "post" });
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
      title="SEO & Alt Text"
      subtitle="Scan, fix, and optimize product images and SEO metadata"
    >
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Banner tone="success">{toast}</Banner>
        </div>
      )}

      <Layout>
        <Layout.Section>
          <InlineStack gap="300">
            <Button
              variant={activeTab === "alt" ? "primary" : "secondary"}
              onClick={() => { setActiveTab("alt"); setFilter("all"); }}
            >
              🖼 Alt Text
            </Button>
            <Button
              variant={activeTab === "seo" ? "primary" : "secondary"}
              onClick={() => { setActiveTab("seo"); setFilter("all"); }}
            >
              🔍 SEO
            </Button>
          </InlineStack>
        </Layout.Section>

        <Layout.Section>
          {activeTab === "alt" ? (
            <Banner tone={altMissing > 0 ? "warning" : "success"}>
              <Text>
                {altMissing === 0
                  ? `✅ All products have alt text on their images.`
                  : `⚠️ ${altMissing} product(s) have images missing alt text.`}
              </Text>
            </Banner>
          ) : (
            <Banner tone={seoRed > 0 ? "critical" : seoYellow > 0 ? "warning" : "success"}>
              <Text>
                {seoRed > 0 ? `🔴 ${seoRed} product(s) missing SEO. ` : ""}
                {seoYellow > 0 ? `🟡 ${seoYellow} product(s) with weak SEO. ` : ""}
                {seoRed === 0 && seoYellow === 0 ? "✅ All products have strong SEO metadata." : ""}
              </Text>
            </Banner>
          )}
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
                ⚡ Bulk Fill Missing Alt from Title
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

                      {images.map((img) => {
                        const currentAlt = editAlt[img.id] ?? img.altText ?? "";
                        const hasAlt = img.altText && img.altText.trim() !== "";
                        return (
                          <Box
                            key={img.id}
                            padding="300"
                            background={hasAlt ? "bg-surface-success" : "bg-surface-critical"}
                            borderRadius="200"
                          >
                            <InlineStack gap="400" align="start" blockAlign="start">
                              <Thumbnail
                                source={img.src}
                                alt={img.altText || "No alt text"}
                                size="large"
                              />
                              <BlockStack gap="200" style={{ flex: 1 }}>
                                <TextField
                                  label={hasAlt ? "🟢 Alt text" : "🔴 Alt text (missing)"}
                                  value={currentAlt}
                                  onChange={(val) =>
                                    setEditAlt((prev) => ({ ...prev, [img.id]: val }))
                                  }
                                  placeholder={`e.g. ${product.title}`}
                                  autoComplete="off"
                                />
                                <Button
                                  size="slim"
                                  onClick={() => handleSaveAlt(product.id, img.id)}
                                  loading={saving === img.id}
                                >
                                  Save Alt Text
                                </Button>
                              </BlockStack>
                            </InlineStack>
                          </Box>
                        );
                      })}
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
                        <TextField
                          label={`SEO Title — ${tLen} chars (target: 50–60)`}
                          value={editedTitle}
                          onChange={(val) =>
                            setEditSeo((prev) => ({
                              ...prev,
                              [product.id]: { ...prev[product.id], title: val },
                            }))
                          }
                          placeholder="SEO title..."
                          autoComplete="off"
                          error={
                            tLen > 60
                              ? "Too long (over 60 chars)"
                              : tLen > 0 && tLen < 30
                              ? "Too short (under 30 chars)"
                              : undefined
                          }
                        />
                        <Text tone="subdued" variant="bodySm">
                          {tLen === 0 ? "🔴 Missing" : tLen >= 50 && tLen <= 60 ? "🟢 Good length" : "🟡 Adjust length"}
                        </Text>
                      </BlockStack>

                      <BlockStack gap="100">
                        <TextField
                          label={`Meta Description — ${dLen} chars (target: 150–160)`}
                          value={editedDesc}
                          onChange={(val) =>
                            setEditSeo((prev) => ({
                              ...prev,
                              [product.id]: { ...prev[product.id], description: val },
                            }))
                          }
                          placeholder="Meta description..."
                          multiline={3}
                          autoComplete="off"
                          error={
                            dLen > 160
                              ? "Too long (over 160 chars)"
                              : dLen > 0 && dLen < 100
                              ? "Too short (under 100 chars)"
                              : undefined
                          }
                        />
                        <Text tone="subdued" variant="bodySm">
                          {dLen === 0 ? "🔴 Missing" : dLen >= 150 && dLen <= 160 ? "🟢 Good length" : "🟡 Adjust length"}
                        </Text>
                      </BlockStack>

                      <Button
                        onClick={() => handleSaveSeo(product.id)}
                        loading={saving === product.id}
                      >
                        Save SEO
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

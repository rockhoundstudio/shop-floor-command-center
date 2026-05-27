import { useState, useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, 
  ProgressBar, Grid, List, Icon, Banner, Box, Link, Divider, Button
} from "@shopify/polaris";
import { InfoIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: LIVE CRAWLER & API SCANNER (LOADER)
// ==========================================
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop } = session;

  try {
    let allProducts = [];
    let hasNext = true;
    let cursor = null;
    let cycleCount = 0;

    // Upgraded GraphQL: Fetch all products with required fields
    while (hasNext && cycleCount < 20) {
      const prodQuery = `#graphql
        query($cursor: String) {
          products(first: 50, after: $cursor, sortKey: UPDATED_AT, reverse: true) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                status
                descriptionHtml
                images(first: 5) { 
                  edges { node { id url altText } } 
                }
                seo { title description }
                variants(first: 1) { 
                  edges { node { price } } 
                }
                collections(first: 5) {
                  edges { node { id title } }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(prodQuery, { variables: { cursor } });
      const data = await res.json();

      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      const pageProducts = (data.data?.products?.edges || []).map(e => {
        const p = e.node;
        return {
          id: p.id,
          title: p.title,
          handle: p.handle,
          status: p.status,
          description: p.descriptionHtml || "",
          price: p.variants?.edges?.[0]?.node?.price || "0",
          seo: p.seo,
          images: p.images?.edges?.map(img => img.node) || [],
          collections: p.collections?.edges?.map(c => c.node) || []
        };
      });

      allProducts = allProducts.concat(pageProducts);
      hasNext = data.data?.products?.pageInfo?.hasNextPage || false;
      cursor = data.data?.products?.pageInfo?.endCursor || null;
      cycleCount++;
    }

    // Fetch Pages
    let allPages = [];
    hasNext = true;
    cursor = null;
    while (hasNext) {
      const pageQuery = `#graphql
        query($cursor: String) {
          pages(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges { node { id title handle publishedAt } }
          }
        }
      `;
      const res = await admin.graphql(pageQuery, { variables: { cursor } });
      const data = await res.json();
      allPages.push(...(data.data?.pages?.edges || []).map(e => e.node));
      hasNext = data.data?.pages?.pageInfo?.hasNextPage;
      cursor = data.data?.pages?.pageInfo?.endCursor;
    }

    // Fetch Collections
    let allCollections = [];
    hasNext = true;
    cursor = null;
    while (hasNext) {
      const collQuery = `#graphql
        query($cursor: String) {
          collections(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges { node { id title handle } }
          }
        }
      `;
      const res = await admin.graphql(collQuery, { variables: { cursor } });
      const data = await res.json();
      allCollections.push(...(data.data?.collections?.edges || []).map(e => e.node));
      hasNext = data.data?.collections?.pageInfo?.hasNextPage;
      cursor = data.data?.collections?.pageInfo?.endCursor;
    }

    // Fetch Menus
    let rawMenuUrls = [];
    hasNext = true;
    cursor = null;
    while (hasNext) {
      const menuQuery = `#graphql
        query($cursor: String) {
          menus(first: 10, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                items {
                  url
                  items {
                    url
                    items { url }
                  }
                }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(menuQuery, { variables: { cursor } });
      const data = await res.json();
      
      const menus = data.data?.menus?.edges || [];
      menus.forEach(({ node }) => {
        const extractUrls = (items) => {
          if (!items) return;
          items.forEach(item => {
            if (item.url) rawMenuUrls.push(item.url);
            if (item.items && item.items.length > 0) extractUrls(item.items);
          });
        };
        extractUrls(node.items);
      });
      
      hasNext = data.data?.menus?.pageInfo?.hasNextPage;
      cursor = data.data?.menus?.pageInfo?.endCursor;
    }

    // Status Parsing
    const draftProducts = allProducts.filter(p => p.status === "DRAFT");
    const archivedProducts = allProducts.filter(p => p.status === "ARCHIVED");
    const draftPages = allPages.filter(p => !p.publishedAt);
    
    const liveProducts = allProducts.filter(p => p.status === "ACTIVE");
    const livePages = allPages.filter(p => p.publishedAt);
    const liveCollections = allCollections;

    // Content Penalty Calculation (Internal)
    const missingContent = liveProducts.map(p => {
      const missingImages = p.images.length === 0;
      const missingAltText = p.images.some(img => !img.altText || img.altText.trim() === "");
      const missingDesc = !p.description || p.description.trim() === "";
      const missingSEO = !p.seo?.title || !p.seo?.description;
      const missingPrice = parseFloat(p.price) === 0;
      const noCollection = p.collections.length === 0;

      const errors = [];
      if (missingImages) errors.push("No Image");
      if (missingAltText) errors.push("Missing Alt Text");
      if (missingDesc) errors.push("No Description");
      if (missingSEO) errors.push("Missing SEO");
      if (missingPrice) errors.push("Price is $0");
      if (noCollection) errors.push("No Collection");

      if (errors.length > 0) {
        return { id: p.id, title: p.title, errors };
      }
      return null;
    }).filter(Boolean);

    // URL CRAWLER
    const baseUrl = "https://rockhoundstudio.com";
    let urlsToCrawl = [
      ...liveProducts.map(p => `${baseUrl}/products/${p.handle}`),
      ...livePages.map(p => `${baseUrl}/pages/${p.handle}`),
      ...liveCollections.map(c => `${baseUrl}/collections/${c.handle}`),
      ...rawMenuUrls
    ];

    urlsToCrawl = [...new Set(urlsToCrawl)];

    const checkUrl = async (url) => {
      let targetUrl = url;
      
      if (targetUrl.includes("account.rockhoundstudio.com")) return { url: targetUrl, status: "SKIPPED" };
      
      if (targetUrl.includes(".myshopify.com")) {
        targetUrl = targetUrl.replace(/https?:\/\/[^/]+\.myshopify\.com/, baseUrl);
      }
      if (targetUrl.startsWith("/")) targetUrl = baseUrl + targetUrl;

      if (!targetUrl.startsWith(baseUrl)) return { url: targetUrl, status: "SKIPPED (External)" };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(targetUrl, { 
          method: "HEAD", 
          signal: controller.signal,
          headers: { "User-Agent": "Rockhound-Diagnostic-Bot/1.0" }
        });
        clearTimeout(timeoutId);
        
        return { url: targetUrl, ok: response.ok, status: response.status };
      } catch (error) {
        clearTimeout(timeoutId);
        return { url: targetUrl, ok: false, status: error.name === "AbortError" ? "TIMEOUT" : "ERROR" };
      }
    };

    const crawlResults = await Promise.allSettled(urlsToCrawl.map(checkUrl));
    
    const brokenLinks = crawlResults
      .filter(r => r.status === "fulfilled" && !r.value.ok && r.value.status !== "SKIPPED")
      .map(r => r.value);

    const validPaths = [
      ...liveProducts.map(p => `/products/${p.handle}`),
      ...livePages.map(p => `/pages/${p.handle}`),
      ...liveCollections.map(c => `/collections/${c.handle}`)
    ];
    
    const ghostLinks = brokenLinks.filter(link => {
      const path = link.url.replace(baseUrl, "");
      return !validPaths.includes(path);
    });

    // Score Assembly
    let totalScore = 100;
    const brokenLinkPenalty = Math.min(40, brokenLinks.length * 5);
    totalScore -= brokenLinkPenalty;
    const totalMissingFields = missingContent.reduce((sum, item) => sum + item.errors.length, 0);
    const missingContentPenalty = Math.min(20, totalMissingFields * 2);
    totalScore -= missingContentPenalty;

    return Response.json({
      shop,
      score: Math.max(0, totalScore),
      brokenLinks,
      ghostLinks,
      products: allProducts, // Passes full updated array to the component
      drafts: {
        products: draftProducts.length,
        archived: archivedProducts.length,
        pages: draftPages.length
      }
    });

  } catch (error) {
    console.error("HARD MISFIRE IN LOADER:", error.message);
    return Response.json({ error: `Diagnostic scanner failed: ${error.message}` });
  }
};


// ==========================================
// 2. CHASSIS: POLARIS UI DASHBOARD
// ==========================================
export default function StoreHealthCheckTab() {
  const data = useLoaderData();
  const navigate = useNavigate();

  if (data.error) {
    return (
      <Page
        title="Diagnostic Bay: Store Health Check"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
      >
        <Banner tone="critical">{data.error}</Banner>
      </Page>
    );
  }

  const getTone = (score) => {
    if (score >= 90) return "success";
    if (score >= 70) return "warning";
    return "critical";
  };
  const tone = getTone(data.score);

  return (
    <Page
      title="Diagnostic Bay: Store Health Check"
      subtitle="Live URL Crawler & Content Audit"
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        <Card padding="400">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h2">Polish & Shine Score</Text>
              <Badge tone={tone} size="large">{data.score} / 100</Badge>
            </InlineStack>
            <ProgressBar progress={data.score} tone={tone} size="medium" />
            <Text tone="subdued">
              Score starts at 100. Deductions: -5 per broken link (max -40), -2 per missing content field (max -20). Drafts do not penalize.
            </Text>
          </BlockStack>
        </Card>

        <Grid>
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Broken Links (Crawler)</Text>
                  <Badge tone={data.brokenLinks.length > 0 ? "critical" : "success"}>
                    {data.brokenLinks.length} Found
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.brokenLinks.length === 0 && (
                  <Text tone="success">🟢 All live routes returned 200 OK.</Text>
                )}
                {data.brokenLinks.length > 0 && (
                  <BlockStack gap="300">
                    {data.brokenLinks.map((link, i) => (
                      <div key={i} style={{ minHeight: "48px", display: "flex", alignItems: "center", width: "100%" }}>
                        <InlineStack align="space-between" blockAlign="center" style={{ width: "100%" }}>
                          <Link url={link.url} target="_blank">{link.url.replace("https://rockhoundstudio.com", "")}</Link>
                          <Badge tone="critical">HTTP {link.status}</Badge>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Drafts & Archived</Text>
                  <Badge tone="info">No Score Penalty</Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                <List type="bullet">
                  <List.Item>
                    <InlineStack gap="200">
                      <Icon source={InfoIcon} tone="base"/>
                      <Text><strong>{data.drafts.products}</strong> Products marked DRAFT</Text>
                    </InlineStack>
                  </List.Item>
                  <List.Item>
                    <InlineStack gap="200">
                      <Icon source={InfoIcon} tone="base"/>
                      <Text><strong>{data.drafts.archived}</strong> Products marked ARCHIVED</Text>
                    </InlineStack>
                  </List.Item>
                  <List.Item>
                    <InlineStack gap="200">
                      <Icon source={InfoIcon} tone="base"/>
                      <Text><strong>{data.drafts.pages}</strong> Pages with Null PublishedAt</Text>
                    </InlineStack>
                  </List.Item>
                </List>
              </Box>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Ghost Links</Text>
                  <Badge tone={data.ghostLinks.length > 0 ? "critical" : "success"}>
                    {data.ghostLinks.length} Found
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.ghostLinks.length === 0 && (
                  <Text tone="success">🟢 No deleted products/pages found in live menus.</Text>
                )}
                {data.ghostLinks.length > 0 && (
                  <BlockStack gap="300">
                    <Text tone="subdued">These URLs returned 404 and do not exist in your active handles.</Text>
                    {data.ghostLinks.map((link, i) => (
                      <div key={i} style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Text tone="critical">{link.url.replace("https://rockhoundstudio.com", "")}</Text>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>
        </Grid>

        <Layout.Section>
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">Master Product Content Audit</Text>
                <Badge tone="info">{data.products.length} Products Scanned</Badge>
              </InlineStack>
            </Box>
            <Box padding="400">
              {data.products.length === 0 && (
                <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                  <Text tone="subdued">No products found on the shop floor.</Text>
                </div>
              )}

              {data.products.length > 0 && (
                <BlockStack gap="600">
                  {data.products.map((product) => {
                    const missingImages = product.images.length === 0;
                    const missingDesc = !product.description || product.description.trim() === "";
                    const missingPrice = !product.price || parseFloat(product.price) === 0;
                    const isDraft = product.status === "DRAFT";
                    const missingAltText = product.images.length > 0 && product.images.some(img => !img.altText || img.altText.trim() === "");
                    const noCollection = product.collections.length === 0;

                    const hasIssues = missingImages || missingDesc || missingPrice || missingAltText || noCollection;

                    return (
                      <Box key={product.id}>
                        <InlineStack align="space-between" blockAlign="center" wrap={false}>
                          <BlockStack gap="200">
                            <Text variant="headingSm" as="h4" fontWeight="bold">
                              {product.title}
                            </Text>
                            <InlineStack gap="200" wrap>
                              {!hasIssues && !isDraft && <Badge tone="success">Healthy</Badge>}
                              {isDraft && <Badge tone="info">DRAFT</Badge>}
                              {missingImages && <Badge tone="critical">Missing Images</Badge>}
                              {missingDesc && <Badge tone="critical">Missing Description</Badge>}
                              {missingPrice && <Badge tone="critical">Missing Price</Badge>}
                              {missingAltText && <Badge tone="warning">Empty Alt Text</Badge>}
                              {noCollection && <Badge tone="warning">No Collection Assigned</Badge>}
                            </InlineStack>
                          </BlockStack>
                          
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button
                              accessibilityLabel={`View ${product.title} in Shopify Admin`}
                              url={`shopify:admin/products/${product.id.split("/").pop()}`}
                              target="_blank"
                            >
                              View
                            </Button>
                          </div>
                        </InlineStack>
                        <Box paddingBlockStart="400"><Divider /></Box>
                      </Box>
                    );
                  })}
                </BlockStack>
              )}
            </Box>
          </Card>
        </Layout.Section>

      </BlockStack>
    </Page>
  );
}

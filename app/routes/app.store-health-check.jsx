import { useState, useEffect } from "react";
import { useLoaderData, useNavigation } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, 
  ProgressBar, Grid, List, Icon, Banner, Box, Link
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
    // --- API SCANNERS ---
    
    // A. Fetch Products
    let allProducts = [];
    let hasNext = true;
    let cursor = null;
    while (hasNext) {
      const prodQuery = `#graphql
        query($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title handle status
                descriptionHtml
                images(first: 5) { edges { node { id altText } } }
                seo { title description }
                variants(first: 1) { edges { node { price } } }
              }
            }
          }
        }
      `;
      const res = await admin.graphql(prodQuery, { variables: { cursor } });
      const data = await res.json();
      allProducts.push(...(data.data?.products?.edges || []).map(e => e.node));
      hasNext = data.data?.products?.pageInfo?.hasNextPage;
      cursor = data.data?.products?.pageInfo?.endCursor;
    }

    // B. Fetch Pages
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

    // C. Fetch Collections
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

    // D. Fetch Menus (Dynamic Extraction)
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
        // Recursive extraction for nested menus
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

    // --- DATA SORTING BUCKETS ---
    
    // Buckets: Drafts & Archives (Unpublished - DO NOT CRAWL)
    const draftProducts = allProducts.filter(p => p.status === "DRAFT");
    const archivedProducts = allProducts.filter(p => p.status === "ARCHIVED");
    const draftPages = allPages.filter(p => !p.publishedAt);
    
    // Buckets: Live (Published)
    const liveProducts = allProducts.filter(p => p.status === "ACTIVE");
    const livePages = allPages.filter(p => p.publishedAt);
    const liveCollections = allCollections;

    // --- PRODUCT CONTENT AUDIT (Live Only) ---
    const missingContent = liveProducts.map(p => {
      const missingImages = p.images?.edges?.length === 0;
      const missingAltText = p.images?.edges?.some(img => !img.node.altText);
      const missingDesc = !p.descriptionHtml || p.descriptionHtml.trim() === "";
      const missingSEO = !p.seo?.title || !p.seo?.description;
      const missingPrice = p.variants?.edges?.some(v => parseFloat(v.node.price) === 0);

      const errors = [];
      if (missingImages) errors.push("No Image");
      if (missingAltText) errors.push("Missing Alt Text");
      if (missingDesc) errors.push("No Description");
      if (missingSEO) errors.push("Missing SEO");
      if (missingPrice) errors.push("Price is $0");

      if (errors.length > 0) {
        return { id: p.id, title: p.title, errors };
      }
      return null;
    }).filter(Boolean);

    // --- THE LIVE CRAWLER ---
    
    // 1. Build URL list to crawl
    const baseUrl = "https://rockhoundstudio.com";
    let urlsToCrawl = [
      ...liveProducts.map(p => `${baseUrl}/products/${p.handle}`),
      ...livePages.map(p => `${baseUrl}/pages/${p.handle}`),
      ...liveCollections.map(c => `${baseUrl}/collections/${c.handle}`),
      ...rawMenuUrls
    ];

    urlsToCrawl = [...new Set(urlsToCrawl)]; // Deduplicate everything

    // 2. Crawler Logic with 15s Timeout and Whitelist Rules
    const checkUrl = async (url) => {
      let targetUrl = url;
      
      // Rule: Whitelist Account
      if (targetUrl.includes("account.rockhoundstudio.com")) return { url: targetUrl, status: "SKIPPED" };
      
      // Rule: Normalize myshopify domains
      if (targetUrl.includes(".myshopify.com")) {
        targetUrl = targetUrl.replace(/https?:\/\/[^/]+\.myshopify\.com/, baseUrl);
      }
      // Rule: Handle relative paths
      if (targetUrl.startsWith("/")) targetUrl = baseUrl + targetUrl;

      // Ensure we only hit rockhoundstudio
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
        
        return { 
          url: targetUrl, 
          ok: response.ok, 
          status: response.status 
        };
      } catch (error) {
        clearTimeout(timeoutId);
        return { url: targetUrl, ok: false, status: error.name === "AbortError" ? "TIMEOUT" : "ERROR" };
      }
    };

    // 3. Fire all requests concurrently
    const crawlResults = await Promise.allSettled(urlsToCrawl.map(checkUrl));
    
    const brokenLinks = crawlResults
      .filter(r => r.status === "fulfilled" && !r.value.ok && r.value.status !== "SKIPPED")
      .map(r => r.value);

    // Identify Deleted Products Still Linked (404s from menuUrls not in active handles)
    const validPaths = [
      ...liveProducts.map(p => `/products/${p.handle}`),
      ...livePages.map(p => `/pages/${p.handle}`),
      ...liveCollections.map(c => `/collections/${c.handle}`)
    ];
    
    const ghostLinks = brokenLinks.filter(link => {
      const path = link.url.replace(baseUrl, "");
      return !validPaths.includes(path);
    });

    // --- SCORE CALCULATION ---
    let totalScore = 100;
    
    // -5 per broken link (Max -40)
    const brokenLinkPenalty = Math.min(40, brokenLinks.length * 5);
    totalScore -= brokenLinkPenalty;

    // -2 per missing content field (Max -20)
    const totalMissingFields = missingContent.reduce((sum, item) => sum + item.errors.length, 0);
    const missingContentPenalty = Math.min(20, totalMissingFields * 2);
    totalScore -= missingContentPenalty;

    return Response.json({
      shop,
      score: Math.max(0, totalScore),
      brokenLinks,
      ghostLinks,
      missingContent,
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

  if (data.error) {
    return (
      <Page title="Diagnostic Bay: Store Health Check">
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
    <Page title="Diagnostic Bay: Store Health Check" subtitle="Live URL Crawler & Content Audit" fullWidth>
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
                {data.brokenLinks.length === 0 ? (
                  <Text tone="success">🟢 All live routes returned 200 OK.</Text>
                ) : (
                  <BlockStack gap="300">
                    {data.brokenLinks.map((link, i) => (
                      <InlineStack key={i} align="space-between" blockAlign="center">
                        <Link url={link.url} target="_blank">{link.url.replace("https://rockhoundstudio.com", "")}</Link>
                        <Badge tone="critical">HTTP {link.status}</Badge>
                      </InlineStack>
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
                  <Text variant="headingMd" as="h3">Product Content Audit</Text>
                  <Badge tone={data.missingContent.length > 0 ? "warning" : "success"}>
                    {data.missingContent.length} Products Missing Data
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.missingContent.length === 0 ? (
                  <Text tone="success">🟢 All active products fully loaded.</Text>
                ) : (
                  <BlockStack gap="300">
                    {data.missingContent.slice(0, 10).map((p) => (
                      <BlockStack key={p.id} gap="100">
                        <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                        <InlineStack gap="200">
                          {p.errors.map((err, i) => (
                            <Badge key={i} tone="critical">{err}</Badge>
                          ))}
                        </InlineStack>
                      </BlockStack>
                    ))}
                    {data.missingContent.length > 10 && <Text tone="subdued">+{data.missingContent.length - 10} more...</Text>}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>

          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Drafts & Archived (Skipped by Crawler)</Text>
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
                  <Text variant="headingMd" as="h3">Ghost Links (Deleted but Linked)</Text>
                  <Badge tone={data.ghostLinks.length > 0 ? "critical" : "success"}>
                    {data.ghostLinks.length} Found
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.ghostLinks.length === 0 ? (
                  <Text tone="success">🟢 No deleted products/pages found in live menus.</Text>
                ) : (
                  <BlockStack gap="300">
                    <Text tone="subdued">These URLs returned 404 and do not exist in your active handles.</Text>
                    {data.ghostLinks.map((link, i) => (
                      <InlineStack key={i} align="space-between" blockAlign="center">
                        <Text tone="critical">{link.url.replace("https://rockhoundstudio.com", "")}</Text>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>

        </Grid>
      </BlockStack>
    </Page>
  );
}
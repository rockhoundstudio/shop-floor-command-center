import { useState } from "react";
import { useLoaderData } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button,
  ProgressBar, Banner, Box, DataTable, Spinner
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

// ==========================================
// LOADER — CRAWLER ENGINE
// ==========================================
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  const baseUrl = `https://rockhoundstudio.com`;

  try {
    // 1. Pull all nav menu links
    const menuQuery = `#graphql
      query {
        menus(first: 10) {
          edges {
            node {
              title
              items {
                title
                url
                items {
                  title
                  url
                }
              }
            }
          }
        }
      }
    `;
    const menuRes = await admin.graphql(menuQuery);
    const menuData = await menuRes.json();
    const menus = menuData.data?.menus?.edges || [];

    let urlsToCheck = new Set();

    // Extract all menu URLs — normalize myshopify URLs to primary domain
    for (const menu of menus) {
      for (const item of menu.node.items || []) {
        if (item.url) {
          const normalized = item.url.replace(/https:\/\/[^/]*myshopify\.com/, baseUrl);
          urlsToCheck.add(normalized);
        }
        for (const sub of item.items || []) {
          if (sub.url) {
            const normalized = sub.url.replace(/https:\/\/[^/]*myshopify\.com/, baseUrl);
            urlsToCheck.add(normalized);
          }
        }
      }
    }

    // 2. Pull all pages
    const pageQuery = `#graphql
      query {
        pages(first: 50) {
          edges { node { title handle } }
        }
      }
    `;
    const pageRes = await admin.graphql(pageQuery);
    const pageData = await pageRes.json();
    for (const edge of pageData.data?.pages?.edges || []) {
      urlsToCheck.add(`${baseUrl}/pages/${edge.node.handle}`);
    }

    // 3. Pull all collections
    const collQuery = `#graphql
      query {
        collections(first: 50) {
          edges { node { title handle } }
        }
      }
    `;
    const collRes = await admin.graphql(collQuery);
    const collData = await collRes.json();
    for (const edge of collData.data?.collections?.edges || []) {
      urlsToCheck.add(`${baseUrl}/collections/${edge.node.handle}`);
    }

    // 4. Pull all products
    const prodQuery = `#graphql
      query {
        products(first: 50) {
          edges { node { title handle } }
        }
      }
    `;
    const prodRes = await admin.graphql(prodQuery);
    const prodData = await prodRes.json();
    for (const edge of prodData.data?.products?.edges || []) {
      urlsToCheck.add(`${baseUrl}/products/${edge.node.handle}`);
    }

    // 5. Crawl every URL — check status
    const urlArray = Array.from(urlsToCheck).filter(u => u.startsWith("http"));
    const results = await Promise.all(
      urlArray.map(async (url) => {
        try {
          const res = await fetch(url, {
            method: "GET",
            redirect: "follow",
            headers: { "User-Agent": "RockhoundStudio-HealthCheck/1.0" },
            signal: AbortSignal.timeout(15000)
          });
          return { url, status: res.status, ok: res.status < 400 };
        } catch (e) {
          return { url, status: "TIMEOUT", ok: false };
        }
      })
    );

    const brokenLinks = results.filter(r => !r.ok);
    const passedLinks = results.filter(r => r.ok);

    // 6. Product content audit
    let products = [];
    let hasNextPage = true;
    let cursor = null;
    while (hasNextPage) {
      const res = await admin.graphql(`#graphql
        query getProducts($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title handle descriptionHtml
                images(first: 5) { edges { node { id altText } } }
                seo { title description }
                variants(first: 1) { edges { node { price } } }
              }
            }
          }
        }
      `, { variables: { cursor } });
      const d = await res.json();
      products.push(...(d.data?.products?.edges || []).map(e => e.node));
      hasNextPage = d.data?.products?.pageInfo?.hasNextPage;
      cursor = d.data?.products?.pageInfo?.endCursor;
    }

    const missingContent = products.map(p => {
      const missingImages = p.images?.edges?.length === 0;
      const missingAltText = p.images?.edges?.some(img => !img.node.altText);
      const missingDesc = !p.descriptionHtml || p.descriptionHtml.trim() === "";
      const missingSEO = !p.seo?.title || !p.seo?.description;
      const missingPrice = p.variants?.edges?.some(v => parseFloat(v.node.price) === 0);
      if (missingImages || missingAltText || missingDesc || missingSEO || missingPrice) {
        return { id: p.id, title: p.title, missingImages, missingAltText, missingDesc, missingSEO, missingPrice };
      }
      return null;
    }).filter(Boolean);

    // 7. Score
    let score = 100;
    if (brokenLinks.length > 0) score -= Math.min(40, brokenLinks.length * 5);
    if (missingContent.length > 0) score -= Math.min(20, missingContent.length * 2);

    return Response.json({
      shop,
      score: Math.max(0, score),
      totalChecked: results.length,
      brokenLinks,
      passedLinks: passedLinks.length,
      missingContent,
    });

  } catch (err) {
    console.error("Health check loader error:", err);
    return Response.json({
      shop: "",
      score: 0,
      totalChecked: 0,
      brokenLinks: [],
      passedLinks: 0,
      missingContent: [],
      error: "Crawler failed. Check terminal."
    });
  }
};

// ==========================================
// UI
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
    <Page title="Diagnostic Bay: Store Health Check" subtitle="Live crawler — every link, every page, every product." fullWidth>
      <BlockStack gap="600">

        {/* SCORE */}
        <Card padding="400">
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h2">Polish & Shine Score</Text>
              <Badge tone={tone} size="large">{data.score} / 100</Badge>
            </InlineStack>
            <ProgressBar progress={data.score} tone={tone} size="medium" />
            <Text tone="subdued">
              {`Crawled ${data.totalChecked} URLs — ${data.passedLinks} passed, ${data.brokenLinks.length} broken.`}
            </Text>
          </BlockStack>
        </Card>

        {/* BROKEN LINKS */}
        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">Broken Links</Text>
              <Badge tone={data.brokenLinks.length === 0 ? "success" : "critical"}>
                {data.brokenLinks.length === 0 ? "All Clear" : `${data.brokenLinks.length} Broken`}
              </Badge>
            </InlineStack>
            {data.brokenLinks.length === 0 ? (
              <Text tone="subdued">🟢 No broken links found.</Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "text"]}
                headings={["URL", "Status"]}
                rows={data.brokenLinks.map(l => [l.url, String(l.status)])}
              />
            )}
          </BlockStack>
        </Card>

        {/* PRODUCT CONTENT AUDIT */}
        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingMd" as="h3">Product Content Audit</Text>
              <Badge tone={data.missingContent.length === 0 ? "success" : "warning"}>
                {data.missingContent.length === 0 ? "All Good" : `${data.missingContent.length} Issues`}
              </Badge>
            </InlineStack>
            {data.missingContent.length === 0 ? (
              <Text tone="subdued">🟢 All products fully loaded.</Text>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                headings={["Product", "Images", "Alt Text", "Description", "SEO", "Price"]}
                rows={data.missingContent.map(p => [
                  p.title,
                  p.missingImages ? "❌" : "✅",
                  p.missingAltText ? "❌" : "✅",
                  p.missingDesc ? "❌" : "✅",
                  p.missingSEO ? "❌" : "✅",
                  p.missingPrice ? "❌" : "✅",
                ])}
              />
            )}
          </BlockStack>
        </Card>

      </BlockStack>
    </Page>
  );
}

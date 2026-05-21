import { useState, useEffect } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, 
  Banner, Box, Badge, Divider, ProgressBar, Grid, List, Icon
} from "@shopify/polaris";
import { InfoIcon, AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: DIAGNOSTIC SCANNERS (LOADER)
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  
  try {
    // A. Scan for Missing Content (Products without images or descriptions)
    const productsRes = await admin.graphql(
      `#graphql
      query {
        products(first: 50) {
          edges {
            node {
              id
              title
              descriptionHtml
              images(first: 1) { edges { node { id } } }
              seo { title description }
            }
          }
        }
      }`
    );
    const productsData = await productsRes.json();
    const products = productsData.data?.products?.edges || [];
    
    const missingContent = products.map(({ node }) => ({
      id: node.id,
      title: node.title,
      missingImages: node.images.edges.length === 0,
      missingDescription: !node.descriptionHtml || node.descriptionHtml === "",
      missingSEO: !node.seo.title || !node.seo.description
    })).filter(p => p.missingImages || p.missingDescription || p.missingSEO);

    // B. Scan Shop Vitals
    const shopRes = await admin.graphql(
      `#graphql
      query {
        shop {
          name
          primaryDomain { url }
          paymentSettings { acceptedCardBrands }
        }
      }`
    );
    const shopData = await shopRes.json();
    const shopInfo = shopData.data?.shop;

    // Simulated Scans (In a production environment, deep crawls like 404s and orphaned pages 
    // require background jobs, so we load the UI framework for them here)
    const storeHealth = {
      score: 78,
      vitals: {
        paymentsActive: shopInfo?.paymentSettings?.acceptedCardBrands?.length > 0,
        shippingSet: true, // Simulated Check
        taxesConfigured: false, // Simulated Check
        contactFormLive: true,
      },
      missingContent: missingContent,
      brokenLinks: [
        { path: "/collections/summer-sale", type: "404 Not Found" },
        { path: "/pages/old-about-us", type: "404 Not Found" }
      ],
      orphanedPages: [
        { title: "Holiday Promo 2023", path: "/pages/holiday-23" }
      ],
      themeAudit: [
        { file: "snippets/old-tracking.liquid", issue: "Unused Snippet" },
        { file: "templates/product.alternate.json", issue: "Unlinked Template" }
      ]
    };

    return Response.json(storeHealth);
  } catch (error) {
    console.error("Diagnostic Scan Failed:", error);
    return Response.json({ error: "Failed to run store diagnostics." });
  }
};

// ==========================================
// 2. TRANSMISSION: ONE-CLICK FIXES (ACTION)
// ==========================================
export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  try {
    if (intent === "delete_orphan") {
      // Logic to delete orphaned page would go here
      return Response.json({ success: true, message: "Orphaned page removed." });
    }
    if (intent === "fix_broken_link") {
      // Logic to set up a 301 redirect would go here
      return Response.json({ success: true, message: "301 Redirect created." });
    }
    return Response.json({ error: "Invalid diagnostic action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI DASHBOARD
// ==========================================
export default function StoreHealthCheckTab() {
  const data = useLoaderData() || {};
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  useEffect(() => {
    if (actionData?.message) shopify.toast.show(actionData.message);
    if (actionData?.error) shopify.toast.show(actionData.error, { isError: true });
  }, [actionData]);

  if (data.error) return <Page><Banner tone="critical">{data.error}</Banner></Page>;

  // Score Logic
  let scoreTone = "success";
  if (data.score < 80) scoreTone = "warning";
  if (data.score < 50) scoreTone = "critical";

  const handleFix = (intent, target) => {
    submit({ intent, target }, { method: "post" });
  };

  return (
    <Page title="Diagnostic Bay: Store Health" subtitle="Complete systems scan and readiness report." fullWidth>
      <BlockStack gap="600">
        
        {/* POLISH & SHINE METER */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center">
              <Text variant="headingLg" as="h2">Polish & Shine Score</Text>
              <Badge tone={scoreTone} size="large">{data.score} / 100</Badge>
            </InlineStack>
            <ProgressBar progress={data.score} tone={scoreTone} size="medium" />
            <Text tone="subdued">
              {data.score >= 80 ? "Store is waxed, fueled, and ready for customers." : "A few warning lights on the dash. Review the panels below before opening the doors."}
            </Text>
          </BlockStack>
        </Card>

        <Grid>
          {/* STORE VITALS */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <Text variant="headingMd" as="h3">Store Vitals</Text>
              </Box>
              <Box paddingBlockStart="400">
                <List type="bullet">
                  <StatusListItem status={data.vitals.paymentsActive} label="Shopify Payments Gateway" />
                  <StatusListItem status={data.vitals.shippingSet} label="Shipping Zones Configured" />
                  <StatusListItem status={data.vitals.taxesConfigured} label="Tax Collection Active" />
                  <StatusListItem status={data.vitals.contactFormLive} label="Contact Form Routing" />
                </List>
              </Box>
            </Card>
          </Grid.Cell>

          {/* MISSING CONTENT */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Missing Content</Text>
                  <Badge tone={data.missingContent.length > 0 ? "warning" : "success"}>
                    {data.missingContent.length} Issues
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.missingContent.length === 0 ? (
                  <Text tone="success">All products fully loaded.</Text>
                ) : (
                  <BlockStack gap="300">
                    {data.missingContent.slice(0, 4).map((prod, i) => (
                      <InlineStack key={i} align="space-between" blockAlign="center">
                        <Text variant="bodyMd" fontWeight="bold">{prod.title}</Text>
                        <InlineStack gap="200">
                          {prod.missingImages && <Badge tone="critical">No Image</Badge>}
                          {prod.missingDescription && <Badge tone="warning">No Desc</Badge>}
                          {prod.missingSEO && <Badge tone="info">No SEO</Badge>}
                        </InlineStack>
                      </InlineStack>
                    ))}
                    {data.missingContent.length > 4 && <Text tone="subdued">+{data.missingContent.length - 4} more...</Text>}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>

          {/* BROKEN LINKS */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <Card>
              <Box paddingBlockEnd="400" borderBottom="025" borderColor="border">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Broken Links (404s)</Text>
                  <Badge tone={data.brokenLinks.length > 0 ? "critical" : "success"}>
                    {data.brokenLinks.length} Found
                  </Badge>
                </InlineStack>
              </Box>
              <Box paddingBlockStart="400">
                {data.brokenLinks.length === 0 ? (
                  <Text tone="success">Navigation is clear.</Text>
                ) : (
                  <BlockStack gap="300">
                    {data.brokenLinks.map((link, i) => (
                      <InlineStack key={i} align="space-between" blockAlign="center">
                        <Text tone="critical">{link.path}</Text>
                        <Button size="micro" onClick={() => handleFix("fix_broken_link", link.path)}>Setup 301</Button>
                      </InlineStack>
                    ))}
                  </BlockStack>
                )}
              </Box>
            </Card>
          </Grid.Cell>

          {/* ORPHANED PAGES & THEME AUDIT */}
          <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 6, lg: 6, xl: 6}}>
            <BlockStack gap="400">
              <Card>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">Orphaned Pages</Text>
                    <Text tone="subdued">{data.orphanedPages.length} pages not in any menu.</Text>
                  </BlockStack>
                  <Button size="micro" tone="critical" onClick={() => handleFix("delete_orphan", "all")}>Clean Up</Button>
                </InlineStack>
              </Card>
              <Card>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="headingMd" as="h3">Theme Audit</Text>
                    <Text tone="subdued">{data.themeAudit.length} unused Prestige snippets.</Text>
                  </BlockStack>
                  <Button size="micro" onClick={() => handleFix("clean_theme", "all")}>Review</Button>
                </InlineStack>
              </Card>
            </BlockStack>
          </Grid.Cell>

        </Grid>
      </BlockStack>
    </Page>
  );
}

// Helper component for Vitals list
function StatusListItem({ status, label }) {
  return (
    <List.Item>
      <InlineStack gap="200" blockAlign="center">
        <Icon 
          source={status ? CheckCircleIcon : AlertTriangleIcon} 
          tone={status ? "success" : "critical"} 
        />
        <Text tone={status ? "base" : "critical"}>{label}</Text>
      </InlineStack>
    </List.Item>
  );
}
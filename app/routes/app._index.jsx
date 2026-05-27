import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Link } from "@remix-run/react";
import { Page, Layout, Card, Text, BlockStack, Grid } from "@shopify/polaris";

// ==========================================
// 1. ENGINE: AUTHENTICATION
// ==========================================
export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

// ==========================================
// 2. CHASSIS: MASTER DASHBOARD
// ==========================================
export default function Index() {
  
  // The complete roster of Command Center Tools
  const tools = [
    { title: "Meta Injector", desc: "Inject geological metafields into stone products.", path: "/app/meta-injector", icon: "💎" },
    { title: "Menu Manager", desc: "Build and edit your store navigation menus.", path: "/app/menu-manager", icon: "🗂️" },
    { title: "Collection Manager", desc: "Organize and manage your store collections.", path: "/app/collection-manager", icon: "📁" },
    { title: "Dwell Web Manager", desc: "Manage dwell time and internal link loops.", path: "/app/dwell-web-manager", icon: "🕸️" },
    { title: "SEO & Alt Text", desc: "Scan and fix product SEO and image alt text.", path: "/app/seo-alt-text", icon: "🔍" },
    { title: "Theme Editor", desc: "Read and edit Prestige theme files directly.", path: "/app/theme-editor", icon: "🎨" },
    { title: "Image Extractor", desc: "Build the story slideshow image pool from page content.", path: "/app/image-extractor", icon: "🖼️" },
    { title: "Store Operator", desc: "Advanced store operations and data management.", path: "/app/operator", icon: "⚙️" },
    { title: "AI Content Forge", desc: "Batch generate premium descriptions and SEO metadata safely.", path: "/app/ai-content-forge", icon: "🤖" },
    { title: "Bulk Editor", desc: "Rapidly mutate product statuses and tags.", path: "/app/bulk-edit", icon: "📦" },
    { title: "Sidekick Queue", desc: "Live feed of AI jobs sent by Sidekick.", path: "/app/sidekick-queue", icon: "⚡" },
    { title: "Custom Polishing", desc: "Manage your dedicated service page blueprint.", path: "/app/additional", icon: "✨" },
  ];

  return (
    <Page 
      title="🪨 Rockhound Studio: Command Center" 
      subtitle="Shop Floor operations and Shopify data governance."
      fullWidth
    >
      <Layout>
        <Layout.Section>
          <Grid>
            {tools.map((tool, index) => (
              <Grid.Cell key={index} columnSpan={{ xs: 6, sm: 6, md: 4, lg: 3, xl: 3 }}>
                <Link 
                  to={tool.path} 
                  style={{ textDecoration: "none", color: "inherit", display: "block", height: "100%" }}
                  aria-label={`Open the ${tool.title} tool`}
                >
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <Text variant="headingLg" as="h3">{tool.icon} {tool.title}</Text>
                      <Text tone="subdued" as="p">{tool.desc}</Text>
                    </BlockStack>
                  </Card>
                </Link>
              </Grid.Cell>
            ))}
          </Grid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

// Ensure Shopify error boundaries are respected
export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

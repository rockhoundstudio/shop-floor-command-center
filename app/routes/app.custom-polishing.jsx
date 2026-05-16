import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError, isRouteErrorResponse } from "@remix-run/react";
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
  Badge
} from "@shopify/polaris";

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Engine Fault">
      <Card background="bg-surface-critical">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h1" fontWeight="bold">Tool Crashed</Text>
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

// ─── LOADER (Find existing page) ──────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // Search for a page that might already be our Custom Polishing page
    const res = await admin.graphql(
      `query getPages {
        pages(first: 10, query: "title:*Polishing* OR title:*Custom*") {
          edges {
            node {
              id
              title
              handle
              bodySummary
              seo {
                title
                description
              }
            }
          }
        }
      }`
    );
    const json = await res.json();
    if (json.errors) throw new Error(json.errors[0].message);

    const pages = json.data.pages.edges.map(e => e.node);
    
    return { pages };
  } catch (error) {
    if (error instanceof Response) throw error;
    throw new Response(error.message, { status: 500 });
  }
};

// ─── ACTION (Create or Update Page) ───────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.formData();
  
  const intent = body.get("intent");
  const pageId = body.get("pageId"); // empty if creating new
  const title = body.get("title");
  const htmlBody = body.get("htmlBody");
  const seoTitle = body.get("seoTitle");
  const seoDescription = body.get("seoDescription");

  try {
    if (intent === "save_page") {
      const pageInput = {
        title: title,
        body: htmlBody,
        seo: {
          title: seoTitle,
          description: seoDescription
        }
      };

      let mutation = "";
      let variables = {};

      if (pageId) {
        // Update existing
        mutation = `
          mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              page { id title handle seo { title description } }
              userErrors { field message }
            }
          }
        `;
        variables = { id: pageId, page: pageInput };
      } else {
        // Create new
        mutation = `
          mutation pageCreate($page: PageCreateInput!) {
            pageCreate(page: $page) {
              page { id title handle seo { title description } }
              userErrors { field message }
            }
          }
        `;
        variables = { page: pageInput };
      }

      const res = await admin.graphql(mutation, { variables });
      const json = await res.json();

      if (json.errors) throw new Error(json.errors[0].message);
      
      const payload = pageId ? json.data.pageUpdate : json.data.pageCreate;
      if (payload.userErrors.length > 0) {
        throw new Error(payload.userErrors[0].message);
      }

      return { ok: true, page: payload.page };
    }

    return { ok: false, error: "Unknown command" };
  } catch (error) {
    if (error instanceof Response) throw error;
    return { ok: false, error: error.message };
  }
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CustomPolishingTab() {
  const { pages } = useLoaderData();
  const fetcher = useFetcher();

  // Try to find the specific page in the loader data, otherwise default to empty
  const targetPage = pages.find(p => p.title.toLowerCase().includes("polishing")) || null;

  const [title, setTitle] = useState(targetPage?.title || "");
  const [htmlBody, setHtmlBody] = useState(targetPage?.bodySummary || "");
  const [seoTitle, setSeoTitle] = useState(targetPage?.seo?.title || "");
  const [seoDescription, setSeoDescription] = useState(targetPage?.seo?.description || "");
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (!fetcher.data.ok) {
        setToast({ message: `❌ Fault: ${fetcher.data.error}`, tone: "critical" });
        setTimeout(() => setToast(null), 5000);
      } else {
        setToast({ message: "Page Saved Successfully ✓", tone: "success" });
        setTimeout(() => setToast(null), 3000);
      }
    }
  }, [fetcher.state, fetcher.data]);

  const handleSave = () => {
    const fd = new FormData();
    fd.append("intent", "save_page");
    if (targetPage?.id) fd.append("pageId", targetPage.id);
    fd.append("title", title);
    fd.append("htmlBody", htmlBody);
    fd.append("seoTitle", seoTitle);
    fd.append("seoDescription", seoDescription);
    fetcher.submit(fd, { method: "post" });
  };

  // ⚡ AUTO-INJECT TEMPLATES
  const loadTemplates = () => {
    setTitle("Custom Stone Polishing Service");
    setHtmlBody("Have a special stone you found on a hike or a piece of rough material with sentimental value? Bob and Janyce operate a full lapidary workshop in Spokane Valley and can turn your found rock into a finished piece of wearable art or a polished display stone. \n\nEvery piece is hand-cut and polished to reveal its true inner beauty. Contact us to start your custom project.");
    setSeoTitle("Custom Stone Polishing Service | Heirloom Rock Art | Rockhound Studio");
    setSeoDescription("Turn your found rock into art. Bob and Janyce offer a premium custom stone polishing service in Spokane Valley. Heirloom rock polishing and OOAK creations.");
  };

  const injectSeoChip = (phrase) => {
    setSeoDescription((prev) => prev ? `${prev} ${phrase}` : phrase);
  };

  return (
    <Page
      title="Custom Polishing Service Forger"
      subtitle="Manage your dedicated service page and target premium everyday buyers."
    >
      {toast && (
        <div style={{ position: "fixed", top: 16, right: 16, zIndex: 9999 }}>
          <Banner tone={toast.tone}>{toast.message}</Banner>
        </div>
      )}

      <Layout>
        <Layout.Section>
          {targetPage ? (
            <Banner tone="success">
              <Text>🟢 Page detected on storefront: <strong>{targetPage.title}</strong></Text>
            </Banner>
          ) : (
            <Banner tone="warning">
              <Text>⚠️ No Custom Polishing page detected on the storefront. Use the Auto-Fill button below to generate one.</Text>
            </Banner>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingLg" as="h2">Page Blueprint</Text>
                <Button variant="primary" tone="success" onClick={loadTemplates}>
                  ⚡ Auto-Fill Premium Blueprint
                </Button>
              </InlineStack>

              <Divider />

              <TextField
                label="Storefront Page Title"
                value={title}
                onChange={setTitle}
                autoComplete="off"
              />

              <TextField
                label="Page Content (Text/HTML)"
                value={htmlBody}
                onChange={setHtmlBody}
                multiline={6}
                autoComplete="off"
                helpText="This is what the customer reads on the page."
              />

              <Divider />

              <Text variant="headingMd" as="h3">SEO & Metadata (Google Traffic)</Text>
              
              <TextField
                label={`SEO Title — ${seoTitle.length} chars`}
                value={seoTitle}
                onChange={setSeoTitle}
                autoComplete="off"
              />

              <BlockStack gap="200">
                <TextField
                  label={`Meta Description — ${seoDescription.length} chars`}
                  value={seoDescription}
                  onChange={setSeoDescription}
                  multiline={3}
                  autoComplete="off"
                />
                
                <InlineStack gap="200" wrap>
                  <Button size="slim" onClick={() => injectSeoChip("custom stone polishing service")}>
                    + Custom Stone Polishing
                  </Button>
                  <Button size="slim" onClick={() => injectSeoChip("heirloom rock polishing")}>
                    + Heirloom Rock Polishing
                  </Button>
                  <Button size="slim" onClick={() => injectSeoChip("turn your found rock into art")}>
                    + Turn Found Rock Into Art
                  </Button>
                </InlineStack>
              </BlockStack>

              <Box paddingBlockStart="400">
                <Button 
                  size="large" 
                  variant="primary" 
                  onClick={handleSave} 
                  loading={fetcher.state === "submitting"}
                >
                  {targetPage ? "Update Live Page" : "Create Storefront Page"}
                </Button>
              </Box>

            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
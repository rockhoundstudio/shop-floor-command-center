import { useState, useEffect } from "react";
import { useFetcher, useLoaderData, useRouteError, isRouteErrorResponse, useNavigate } from "@remix-run/react";
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
  Box
} from "@shopify/polaris";

// ─── ERROR BOUNDARY ───────────────────────────────────────────────────────────
export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <Page title="Engine Fault">
      <Card background="bg-surface-critical">
        <BlockStack gap="400">
          <Text variant="headingLg" as="h1" fontWeight="bold">Tool Crashed</Text>
          <Text as="p">
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
    const res = await admin.graphql(
      `#graphql
      query getPages {
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
    
    return Response.json({ pages });
  } catch (error) {
    console.error("Loader Error:", error.message);
    return Response.json({ pages: [], error: error.message });
  }
};

// ─── ACTION (Create or Update Page) ───────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.formData();
  
  const intent = body.get("intent");
  const rawPageId = body.get("pageId"); 
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

      if (rawPageId) {
        // Enforce GID standard
        const safePageId = rawPageId.includes("gid://shopify/") 
          ? rawPageId 
          : `gid://shopify/Page/${rawPageId.split('/').pop()}`;

        mutation = `#graphql
          mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              page { id title handle seo { title description } }
              userErrors { field message }
            }
          }
        `;
        variables = { id: safePageId, page: pageInput };
      } else {
        mutation = `#graphql
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
      
      const payload = rawPageId ? json.data.pageUpdate : json.data.pageCreate;
      if (payload.userErrors.length > 0) {
        throw new Error(payload.userErrors[0].message);
      }

      return Response.json({ ok: true, page: payload.page });
    }

    return Response.json({ ok: false, error: "Unknown command" }, { status: 400 });
  } catch (error) {
    console.error("Action Error:", error.message);
    return Response.json({ ok: false, error: error.message }, { status: 500 });
  }
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function CustomPolishingTab() {
  const { pages, error } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();

  const targetPage = pages?.find(p => p.title.toLowerCase().includes("polishing")) || null;

  const [title, setTitle] = useState(targetPage?.title || "");
  const [htmlBody, setHtmlBody] = useState(targetPage?.bodySummary || "");
  const [seoTitle, setSeoTitle] = useState(targetPage?.seo?.title || "");
  const [seoDescription, setSeoDescription] = useState(targetPage?.seo?.description || "");

  // Handle native Shopify toasts
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (!fetcher.data.ok) {
        shopify.toast.show(`Fault: ${fetcher.data.error}`, { isError: true });
      } else {
        shopify.toast.show("Page Saved Successfully ✓");
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
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        {error && <Banner tone="critical">{error}</Banner>}

        <Layout>
          <Layout.Section>
            {targetPage && (
              <Banner tone="success">
                <Text as="p">🟢 Page detected on storefront: <strong>{targetPage.title}</strong></Text>
              </Banner>
            )}
            
            {!targetPage && (
              <Banner tone="warning">
                <Text as="p">⚠️ No Custom Polishing page detected on the storefront. Use the Auto-Fill button below to generate one.</Text>
              </Banner>
            )}
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingLg" as="h2">Page Blueprint</Text>
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button 
                      variant="primary" 
                      tone="success" 
                      onClick={loadTemplates}
                      accessibilityLabel="Auto-fill the page fields with the premium custom polishing blueprint"
                    >
                      ⚡ Auto-Fill Premium Blueprint
                    </Button>
                  </div>
                </InlineStack>

                <Divider />

                <TextField
                  label="Storefront Page Title"
                  value={title}
                  onChange={setTitle}
                  autoComplete="off"
                  // Polaris TextFields automatically link the 'label' prop to the input for ARIA standards
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
                    <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                      <Button 
                        onClick={() => injectSeoChip("custom stone polishing service")}
                        accessibilityLabel="Append 'custom stone polishing service' to SEO description"
                      >
                        + Custom Stone Polishing
                      </Button>
                    </div>
                    <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                      <Button 
                        onClick={() => injectSeoChip("heirloom rock polishing")}
                        accessibilityLabel="Append 'heirloom rock polishing' to SEO description"
                      >
                        + Heirloom Rock Polishing
                      </Button>
                    </div>
                    <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                      <Button 
                        onClick={() => injectSeoChip("turn your found rock into art")}
                        accessibilityLabel="Append 'turn your found rock into art' to SEO description"
                      >
                        + Turn Found Rock Into Art
                      </Button>
                    </div>
                  </InlineStack>
                </BlockStack>

                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button 
                      size="large" 
                      variant="primary" 
                      onClick={handleSave} 
                      loading={fetcher.state === "submitting"}
                      accessibilityLabel={targetPage ? "Update Live Storefront Page" : "Create New Storefront Page"}
                    >
                      {targetPage ? "Update Live Page" : "Create Storefront Page"}
                    </Button>
                  </div>
                </Box>

              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

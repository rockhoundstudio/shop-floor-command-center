import { useNavigate } from "react-router";
import { Page, Layout, Card, Button, Text, BlockStack } from "@shopify/polaris";

export default function Index() {
  const navigate = useNavigate();

  return (
    <Page title="Shop Floor Command Center">
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Tools</Text>
                <Button onClick={() => navigate("/app/meta-injector")} size="large" aria-label="Open Meta Injector">Meta Injector</Button>
                <Button onClick={() => navigate("/app/menu-manager")} size="large" aria-label="Open Menu Manager">Menu Manager</Button>
                <Button onClick={() => navigate("/app/collection-manager")} size="large" aria-label="Open Collection Manager">Collection Manager</Button>
                <Button onClick={() => navigate("/app/bulk-edit")} size="large" aria-label="Open Bulk Edit">Bulk Edit</Button>
                <Button onClick={() => navigate("/app/ai-content-forge")} size="large" aria-label="Open AI Content Forge">AI Content Forge</Button>
                <Button onClick={() => navigate("/app/theme-editor")} size="large" aria-label="Open Theme Editor">Theme Editor</Button>
                <Button onClick={() => navigate("/app/store-health-check")} size="large" aria-label="Open Store Health Check">Store Health Check</Button>
                <Button onClick={() => navigate("/app/image-extractor")} size="large" aria-label="Open Image Extractor">Image Extractor</Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

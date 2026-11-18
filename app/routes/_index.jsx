import { useNavigate } from "react-router";
import { Page, Layout, Card, Button, Text, BlockStack } from "@shopify/polaris";

export default function Index() {
  const navigate = useNavigate();

  const tools = [
    ["Open Bench2", "/app/bench-v2"],
    ["Meta Injector", "/app/meta-injector"],
    ["Menu Manager", "/app/menu-manager"],
    ["Collection Manager", "/app/collection-manager"],
    ["Bulk Edit", "/app/bulk-edit"],
    ["AI Content Forge", "/app/ai-content-forge"],
    ["Theme Editor", "/app/theme-editor"],
    ["Store Health Check", "/app/store-health-check"],
    ["Image Extractor", "/app/image-extractor"],
  ];

  return (
    <Page title="Shop Floor Command Center">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">
                Tools
              </Text>
              {tools.map(([label, path]) => (
                <Button
                  key={path}
                  onClick={() => navigate(path)}
                  size="large"
                  aria-label={label === "Open Bench2" ? label : `Open ${label}`}
                >
                  {label}
                </Button>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
``` [!Loading](#)

[sidekick-reference-anchor]: <#>

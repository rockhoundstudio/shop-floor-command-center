import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Button,
  Divider
} from "@shopify/polaris";

export default function Index() {
  return (
    <Page title="Shop Floor Command Center">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Welcome to the Shop Floor 🛠️
                </Text>
                <Text as="p" variant="bodyMd">
                  Select a machine below to manage your store data.
                </Text>
                <Divider />
                <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
                  
                  {/* Tool 1: Menu Maker */}
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">🗂️ Menu Maker</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Build and automate the Prestige mega-menus.</Text>
                      <Button variant="primary" url="/app/menu-manager">Open Menu Maker</Button>
                    </BlockStack>
                  </Card>

                  {/* Tool 2: Meta Injector */}
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">💎 Meta Injector</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Scan, audit, and inject geological data.</Text>
                      <Button variant="primary" url="/app/meta-injector">Open Meta Injector</Button>
                    </BlockStack>
                  </Card>

                  {/* Tool 3: Dwell Web Manager */}
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <Text as="h3" variant="headingMd">🕸️ Dwell Web</Text>
                      <Text as="p" variant="bodySm" tone="subdued">Manage collection structures and SEO.</Text>
                      <Button variant="primary" url="/app/collection-manager">Open Dwell Web</Button>
                    </BlockStack>
                  </Card>

                </InlineGrid>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
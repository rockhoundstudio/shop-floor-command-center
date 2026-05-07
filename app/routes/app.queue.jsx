import { Page, Layout, Card, Text, BlockStack } from "@shopify/polaris";

export default function SidekickQueueTab() {
  return (
    <Page title="Sidekick Queue">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">The Workshop is Safe</Text>
              <Text as="p">Bob and Janyce, if you can read this text, your Command Center is perfectly fine.</Text>
              <Text as="p">The white screen you just saw was simply a 'Page Not Found' error because we deleted the file, but your browser was still trying to look at it.</Text>
              <Text as="p">We are back at square one, and the app is alive. Let Gemini know you can see this!</Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

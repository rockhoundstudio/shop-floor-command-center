import { Page, Layout, Card, Text } from "@shopify/polaris";

export default function MetaInjector() {
  return (
    <Page title="Meta Injector">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p">Meta Injector coming soon.</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong loading Meta Injector.</div>;
}

// FILE 1: app.meta-injector.jsx
import React, { useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame
} from "@shopify/polaris";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "../utils/meta-injector.loader.jsx";

// --- IMPORT TABS ---
import { NewProductIntakeTab } from "./app.meta-injector.injector.jsx";
import { IntakeBenchTab } from "./app.meta-injector.inspector.jsx";
import { OperationsMatrixTab } from "./app.meta-injector.matrix.jsx";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const productCount = products ? products.length : 0;
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const autoFillFetcher = useFetcher();
  const injectFetcher = useFetcher();

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'new-intake', content: '1. New Product Intake', accessibilityLabel: 'New Product Intake Tab' },
    { id: 'intake', content: '2. Intake Bench (Janyce)', accessibilityLabel: 'Intake Bench Tab' },
    { id: 'ops', content: '3. Operations Matrix', accessibilityLabel: 'Operations Matrix Tab' }
  ];

  const hasErrors = fetcher.data && fetcher.data.errors && fetcher.data.errors.length > 0;
  const isTabOne = selectedTab === 0;
  const isTabTwo = selectedTab === 1;
  const isTabThree = selectedTab === 2;

  return (
    <Frame>
      <Page
        fullWidth
        title="Meta Injector"
        subtitle="Data Integrity & Operations Hub"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            <Banner tone="info" title={`DEBUG: Loader returned ${productCount} products`} />
          </Layout.Section>
          <Layout.Section>
            {hasErrors && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {fetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="600" background="bg-surface-secondary">
                  {isTabOne && <NewProductIntakeTab fetcher={fetcher} />}
                  {isTabTwo && <IntakeBenchTab products={products} autoFillFetcher={autoFillFetcher} injectFetcher={injectFetcher} />}
                  {isTabThree && <OperationsMatrixTab products={products} fetcher={fetcher} />}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
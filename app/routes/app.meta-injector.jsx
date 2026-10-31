// FILE 1: app.meta-injector.jsx
import React from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Frame
} from "@shopify/polaris";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "../utils/meta-injector.loader.jsx";

// --- IMPORT OPERATIONS MATRIX ---
import { OperationsMatrixTab } from "./app.meta-injector.matrix.jsx";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

// --- MAIN SHELL COMPONENT ---
export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const navigate = useNavigate();

  const fetcher = useFetcher();

  const hasErrors = fetcher.data && fetcher.data.errors && fetcher.data.errors.length > 0;

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
              <Box padding="600" background="bg-surface-secondary">
                <OperationsMatrixTab products={products} fetcher={fetcher} />
              </Box>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
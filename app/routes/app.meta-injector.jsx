import React, { useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { Page, Layout, Card, Box, Tabs, Banner, BlockStack, Text } from "@shopify/polaris";

// --- IMPORT THE PLUMBING & COMPONENTS ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";
import IntakeEngine from "../components/IntakeEngine";
import OperationsMatrix from "../components/OperationsMatrix";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

export default function MetaInjectorV2() {
  const { products } = useLoaderData() || {};
  const navigate = useNavigate();
  const primaryFetcher = useFetcher();
  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;

  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'intake', content: '1. Intake Bench (Janyce)', accessibilityLabel: 'Daily Intake Workflow' },
    { id: 'operations', content: '2. Sweeps & Matrix (Bob)', accessibilityLabel: 'Global Operations' }
  ];

  return (
    <Page
      fullWidth
      title="Shop Floor Command Center"
      subtitle="Master Intake & Operations"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <Layout>
        <Layout.Section>
          
          {/* Global Error Catching */}
          {primaryFetcher.data?.errors && primaryFetcher.data.errors.length > 0 && (
            <Box paddingBlockEnd="400">
              <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                <BlockStack gap="200">
                  {primaryFetcher.data.errors.map((err, i) => (
                    <Text key={i} as="p">{err.message}</Text>
                  ))}
                </BlockStack>
              </Banner>
            </Box>
          )}

          <Card padding="0">
            <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
              <Box padding="600" background="bg-surface-secondary">
                
                {/* STATION 1: JANYCE'S WORKBENCH */}
                {selectedTab === 0 && (
                  <IntakeEngine 
                    products={products} 
                    fetcher={primaryFetcher} 
                    shopify={shopify} 
                  />
                )}

                {/* STATION 2: BOB'S ENGINE ROOM */}
                {selectedTab === 1 && (
                  <OperationsMatrix 
                    products={products} 
                    fetcher={primaryFetcher} 
                    shopify={shopify} 
                  />
                )}

              </Box>
            </Tabs>
          </Card>
          
        </Layout.Section>
      </Layout>
    </Page>
  );
}
import React, { useState } from "react";
import { useLoaderData, useActionData, useFetcher, useNavigate } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Banner, BlockStack, Box, Tabs, Frame
} from "@shopify/polaris";

// --- IMPORT THE ENGINE (Loader & Action) ---
import { loader as engineLoader, action as engineAction } from "./app.meta-injector.loader";

// --- IMPORT THE TABS ---
import { NorthStarTab } from "./app.meta-injector.northstar";
import { MatrixTab } from "./app.meta-injector.matrix";
import { InspectorTab } from "./app.meta-injector.inspector";
import { InjectorTab } from "./app.meta-injector.injector";
import { OriginsTab } from "./app.meta-injector.origins";
import { ProfilesTab } from "./app.meta-injector.profiles";
import { SnapshotsTab } from "./app.meta-injector.snapshots";
import { CsvTab } from "./app.meta-injector.csv";

// --- EXPORT THE ENGINE FOR REMIX TO RUN ---
export const loader = engineLoader;
export const action = engineAction;

export default function MetaInjectorV2() {
  const { products, snapshots = [], dbProfiles = [], metaobjectHandles = {}, dynamicMetaobjectOptions = {} } = useLoaderData();
  const actionData = useActionData();
  const navigate = useNavigate();
  
  const actionFetcher = useFetcher();
  const inspectorFetcher = useFetcher();
  const originFetcher = useFetcher();
  const profileFetcher = useFetcher();
  const snapshotFetcher = useFetcher();

  const shopify = typeof window !== 'undefined' ? window.shopify : undefined;
  const [selectedTab, setSelectedTab] = useState(0);

  const tabs = [
    { id: 'northstar', content: '⭐ North Star Auto-Fill', panelID: 'panel-northstar' },
    { id: 'health', content: 'Data Health Matrix', panelID: 'panel-health' },
    { id: 'inspector', content: 'Product Inspector', panelID: 'panel-inspector' },
    { id: 'bulk', content: 'Smart Bulk Injector', panelID: 'panel-bulk' },
    { id: 'origin', content: 'Origin Fixer', panelID: 'panel-origin' },
    { id: 'profiles', content: 'DB Profiles', panelID: 'panel-profiles' },
    { id: 'snapshots', content: 'Snapshots', panelID: 'panel-snapshots' },
    { id: 'csv', content: 'CSV Sync', panelID: 'panel-csv' }
  ];

  return (
    <Frame>
      <Page
        fullWidth 
        title="Meta Injector v2" 
        subtitle="Data Integrity Command Center"
        backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
      >
        <Layout>
          <Layout.Section>
            {actionFetcher.data?.errors && actionFetcher.data.errors.length > 0 && (
              <Box paddingBlockEnd="400">
                <Banner tone="critical" title="GraphQL Mutation Errors Detected">
                  <BlockStack gap="200">
                    {actionFetcher.data.errors.map((err, i) => (
                      <Text key={i} as="p">{err.message}</Text>
                    ))}
                  </BlockStack>
                </Banner>
              </Box>
            )}

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
                <Box padding="400">
                  {selectedTab === 0 && (
                    <NorthStarTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      dbProfiles={dbProfiles} shopify={shopify} 
                    />
                  )}
                  {selectedTab === 1 && (
                    <MatrixTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      metaobjectHandles={metaobjectHandles} 
                      onInspectProduct={() => setSelectedTab(2)} 
                    />
                  )}
                  {selectedTab === 2 && (
                    <InspectorTab 
                      fetcher={inspectorFetcher} 
                      products={products} 
                    />
                  )}
                  {selectedTab === 3 && (
                    <InjectorTab 
                      fetcher={actionFetcher} 
                      products={products} 
                      shopify={shopify} 
                      dbProfiles={dbProfiles}
                      dynamicMetaobjectOptions={dynamicMetaobjectOptions} 
                    />
                  )}
                  {selectedTab === 4 && (
                    <OriginsTab 
                      fetcher={originFetcher} 
                    />
                  )}
                  {selectedTab === 5 && (
                    <ProfilesTab 
                      fetcher={profileFetcher} 
                      products={products} 
                      dbProfiles={dbProfiles} shopify={shopify} 
                    />
                  )}
                  {selectedTab === 6 && (
                    <SnapshotsTab 
                      fetcher={snapshotFetcher} 
                      snapshots={snapshots} 
                    />
                  )}
                  {selectedTab === 7 && (
                    <CsvTab 
                      fetcher={actionFetcher} 
                      products={products} 
                    />
                  )}
                </Box>
              </Tabs>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    </Frame>
  );
}
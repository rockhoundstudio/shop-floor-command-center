import { useState, useCallback } from "react";
import { useLoaderData, useNavigate, useRevalidator } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, 
  Banner, IndexTable, Badge, Box
} from "@shopify/polaris";
import { ClipboardIcon, RefreshIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// 1. ENGINE: EXACT CANDIDATE ALLOWLIST
// ==========================================
const CANDIDATE_LEDGER = {
  "gid://shopify/Product/9226462232827": ["found_object", "custom_product"],
  "gid://shopify/Product/9226849616123": ["found_object", "custom_product"],
  "gid://shopify/Product/9226859315451": ["found_object", "custom_product"],
  "gid://shopify/Product/9226864165115": ["found_object"],
  "gid://shopify/Product/9227361091835": ["found_object", "custom_product"],
  "gid://shopify/Product/9227362435323": ["found_object"],
  "gid://shopify/Product/9227363254523": ["found_object"],
  "gid://shopify/Product/9227363713275": ["found_object"],
  "gid://shopify/Product/9227366564091": ["found_object"],
  "gid://shopify/Product/9227387273467": ["found_object"],
  "gid://shopify/Product/9227389796603": ["found_object"],
  "gid://shopify/Product/9249075429627": ["found_object"],
  "gid://shopify/Product/9249103380731": ["is_ooak", "treated", "found_object", "custom_product"],
  "gid://shopify/Product/9249162199291": ["custom_product"],
  "gid://shopify/Product/9249166196987": ["is_ooak", "treated", "custom_product"],
  "gid://shopify/Product/9249166491899": ["is_ooak", "treated", "found_object", "custom_product"],
  "gid://shopify/Product/9249170555131": ["found_object"],
  "gid://shopify/Product/9249209942267": ["is_ooak", "custom_product", "treated", "found_object"],
  "gid://shopify/Product/9249261617403": ["is_ooak", "custom_product", "treated", "found_object"],
  "gid://shopify/Product/9249266860283": ["found_object"],
  "gid://shopify/Product/9249274593531": ["is_ooak", "custom_product", "treated", "found_object"],
  "gid://shopify/Product/9254148112635": ["custom_product"],
  "gid://shopify/Product/9386403561723": ["found_object"],
  "gid://shopify/Product/9386410934523": ["found_object"],
  "gid://shopify/Product/9387496341755": ["treated", "found_object"],
  "gid://shopify/Product/9392517316859": ["found_object"],
  "gid://shopify/Product/9393337106683": ["found_object"],
  "gid://shopify/Product/9393344545019": ["found_object"],
  "gid://shopify/Product/9393353064699": ["found_object"],
  "gid://shopify/Product/9397434450171": ["found_object"],
  "gid://shopify/Product/9397437038843": ["found_object"],
  "gid://shopify/Product/9397464432891": ["found_object"],
  "gid://shopify/Product/9397664252155": ["found_object"],
  "gid://shopify/Product/9399379722491": ["found_object"]
};

// ==========================================
// 2. TRANSMISSION: DRY RUN BATCH READ
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const targetIds = Object.keys(CANDIDATE_LEDGER);
  
  let expectedPairs = 0;
  for (const keys of Object.values(CANDIDATE_LEDGER)) {
    expectedPairs += keys.length;
  }

  const report = [];
  const stats = {
    expected: expectedPairs,
    read: 0,
    eligible: 0,
    skipped: 0,
    failed: 0
  };

  try {
    const response = await admin.graphql(
      `#graphql
      query getProductsForNormalization($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            metafields(first: 100) {
              edges {
                node {
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }`,
      { variables: { ids: targetIds } }
    );

    const parsed = await response.json();
    if (parsed.errors) throw new Error(parsed.errors[0].message);

    const products = parsed.data?.nodes || [];

    // Evaluate each exact expected pair
    targetIds.forEach(gid => {
      const product = products.find(p => p && p.id === gid);
      const allowedKeys = CANDIDATE_LEDGER[gid];

      allowedKeys.forEach(targetKey => {
        const row = {
          gid,
          title: "Unknown",
          namespace: "custom",
          key: targetKey,
          actualType: "N/A",
          currentValue: "N/A",
          proposedValue: "N/A",
          eligibility: "FAILED",
          reason: "Read failed"
        };

        if (!product) {
          row.reason = "Product not found in read";
          stats.failed++;
          report.push(row);
          return;
        }

        row.title = product.title;
        stats.read++;

        const metafields = product.metafields?.edges.map(e => e.node) || [];
        const targetMetafield = metafields.find(m => m.namespace === "custom" && m.key === targetKey);

        if (!targetMetafield) {
          row.eligibility = "FAILED";
          row.reason = "Metafield completely missing";
          stats.failed++;
          report.push(row);
          return;
        }

        row.actualType = targetMetafield.type;
        row.currentValue = targetMetafield.value;

        if (targetMetafield.type !== "single_line_text_field") {
          row.eligibility = "SKIPPED";
          row.reason = "Type is not single_line_text_field";
          stats.skipped++;
          report.push(row);
          return;
        }

        if (targetMetafield.value !== "true" && targetMetafield.value !== "false") {
          row.eligibility = "SKIPPED";
          row.reason = `Value is not "true" or "false"`;
          stats.skipped++;
          report.push(row);
          return;
        }

        row.eligibility = "ELIGIBLE";
        row.proposedValue = targetMetafield.value === "true" ? "Yes" : "No";
        row.reason = "Ready for normalization";
        stats.eligible++;
        
        report.push(row);
      });
    });

    return Response.json({ report, stats });
  } catch (error) {
    console.error("Normalizer Loader Error:", error);
    return Response.json({ report: [], stats, error: error.message });
  }
};

// ==========================================
// 3. CHASSIS: POLARIS UI FRAMEWORK
// ==========================================
export default function RepairNormalizerTab() {
  const { report = [], stats = {}, error } = useLoaderData() || {};
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const [toastMessage, setToastMessage] = useState("");

  const handleCopyReport = useCallback(() => {
    let text = `ROCKHOUND STUDIO — NORMALIZATION PREFLIGHT REPORT\n`;
    text += `Run Date: ${new Date().toLocaleString()}\n`;
    text += `Expected Pairs: ${stats.expected} | Read: ${stats.read} | Eligible: ${stats.eligible} | Skipped: ${stats.skipped} | Failed: ${stats.failed}\n\n`;
    
    text += `GID | PRODUCT | NAMESPACE | KEY | TYPE | CURRENT | PROPOSED | STATUS | REASON\n`;
    text += `--------------------------------------------------------------------------------\n`;

    report.forEach(r => {
      text += `${r.gid} | ${r.title} | ${r.namespace} | ${r.key} | ${r.actualType} | ${r.currentValue} | ${r.proposedValue} | ${r.eligibility} | ${r.reason}\n`;
    });

    navigator.clipboard.writeText(text)
      .then(() => {
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Report copied to clipboard");
        } else {
          setToastMessage("Report copied to clipboard.");
        }
      })
      .catch(err => {
        console.error("Clipboard error", err);
        setToastMessage("Failed to copy report.");
      });
  }, [report, stats]);

  const getTone = (eligibility) => {
    if (eligibility === "ELIGIBLE") return "success";
    if (eligibility === "SKIPPED") return "warning";
    return "critical";
  };

  const rowMarkup = report.map(
    ({ gid, title, namespace, key, actualType, currentValue, proposedValue, eligibility, reason }, index) => (
      <IndexTable.Row id={`${gid}-${key}`} key={`${gid}-${key}`} position={index}>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">{title}</Text>
          <Text variant="bodySm" tone="subdued" as="p">{gid.replace("gid://shopify/Product/", "")}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">{namespace}.{key}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">{actualType}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" as="span">{currentValue}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">{proposedValue}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={getTone(eligibility)} size="medium">{eligibility}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodyMd" tone={eligibility === "ELIGIBLE" ? "success" : "subdued"} as="span">
            {reason}
          </Text>
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Yes/No Normalization Preflight"
      subtitle="Strict evaluation of targeted single_line_text_field values."
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      <BlockStack gap="600">
        
        {/* SAFETY BANNER */}
        <Banner tone="info">
          <Text as="p" variant="headingMd" fontWeight="bold">READ ONLY — NO PRODUCTS CHANGED.</Text>
          <Text as="p" variant="bodyLg">This is a dry-run visualization. The executable write logic is completely decoupled from this deployment.</Text>
        </Banner>

        {/* ALERTS */}
        {error && <Banner tone="critical">{error}</Banner>}
        {toastMessage && <Banner tone="warning" onDismiss={() => setToastMessage("")}>{toastMessage}</Banner>}

        <Layout>
          {/* CONTROL PANEL */}
          <Layout.Section variant="oneThird">
            <Card padding="400">
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2" fontWeight="bold">Preflight Telemetry</Text>
                
                <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold">Total Expected Pairs:</Text>
                      <Text as="p" fontWeight="bold">{stats.expected}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p" tone="subdued">Successfully Read:</Text>
                      <Text as="p" tone="subdued">{stats.read}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold" tone="success">Eligible Changes:</Text>
                      <Text as="p" fontWeight="bold" tone="success">{stats.eligible}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold" tone="warning">Skipped (Type/Value):</Text>
                      <Text as="p" fontWeight="bold" tone="warning">{stats.skipped}</Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="p" fontWeight="bold" tone="critical">Read Failures:</Text>
                      <Text as="p" fontWeight="bold" tone="critical">{stats.failed}</Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                <Button
                  size="large"
                  variant="primary"
                  icon={RefreshIcon}
                  onClick={() => revalidator.revalidate()}
                  loading={revalidator.state === "loading"}
                  accessibilityLabel="Re-scan live Shopify data"
                >
                  Refresh Live Scan
                </Button>

                <Button
                  size="large"
                  variant="secondary"
                  icon={ClipboardIcon}
                  onClick={handleCopyReport}
                  accessibilityLabel="Copy plain-text report to clipboard"
                >
                  Copy Diagnostics Report
                </Button>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* TABLE */}
          <Layout.Section>
            <Card padding="0">
              <IndexTable
                resourceName={{ singular: 'pair', plural: 'pairs' }}
                itemCount={report.length}
                selectable={false}
                headings={[
                  { title: 'Product & GID' },
                  { title: 'Target Key' },
                  { title: 'Actual Type' },
                  { title: 'Current Value' },
                  { title: 'Proposed' },
                  { title: 'Eligibility' },
                  { title: 'Reason' }
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
// ============================================================================
// FILE: app/components/SidekickQueueCalmView.jsx
// ROCKHOUND STUDIO — CALM, DYSLEXIA-FRIENDLY RESEARCH & JOB QUEUE VIEW
//
// Pure presentation component using @shopify/polaris ^13.9.5 and React 18.3.1.
// Zero Admin GraphQL code, zero mutations, zero network calls, zero timers,
// and zero new npm dependencies.
//
// Consumes the exact card models produced by:
//   app/utils/sidekick-research-storage.server.js -> buildCalmResearchCardModel
// and exposes existing queue actions strictly through caller callbacks.
// ============================================================================

import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Box,
  Banner,
  Collapsible,
  Divider,
  EmptySearchResult,
  IndexTable,
} from "@shopify/polaris";

async function writeTextToClipboard(text) {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to textarea copy fallback for embedded iframe focus quirks
    }
  }
  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    try {
      textarea.select();
      const succeeded = document.execCommand("copy");
      return Boolean(succeeded);
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
  return false;
}

function ResearchRequestCalmCard({
  card,
  isSubmittingAction,
  onRunResearch,
  onRepairOrRepublish,
}) {
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(null);

  const detailsDomId = `research-tech-details-${card.shortId || "item"}`;

  const handleCopyClick = useCallback(async () => {
    if (!card.copyPlainText) {
      return;
    }
    const ok = await writeTextToClipboard(card.copyPlainText);
    setCopyFeedback(ok ? "Copied!" : "Copy blocked — select text below");
    setTimeout(() => {
      setCopyFeedback((prev) => (prev === "Copied!" ? null : prev));
    }, 3500);
  }, [card.copyPlainText]);

  const executeCardAction = useCallback(
    (actionSpec) => {
      if (!actionSpec) {
        return;
      }
      if (actionSpec.kind === "run" && typeof onRunResearch === "function") {
        onRunResearch(card.id);
        return;
      }
      if (actionSpec.kind === "copy") {
        handleCopyClick();
        return;
      }
      if (
        actionSpec.kind === "republish" &&
        typeof onRepairOrRepublish === "function"
      ) {
        onRepairOrRepublish(card.id);
      }
    },
    [card.id, handleCopyClick, onRepairOrRepublish, onRunResearch]
  );

  const primaryBtnLabel =
    card.primaryAction?.kind === "copy" && copyFeedback === "Copied!"
      ? "Copied!"
      : card.primaryAction?.label || null;

  const primaryBtnTone =
    card.primaryAction?.kind === "run" ? "success" : undefined;

  const tech = card.technicalDetails || {};
  const usableSources = Array.isArray(card.sources) ? card.sources : [];
  const searchQueries = Array.isArray(card.webSearchQueries)
    ? card.webSearchQueries
    : [];

  return (
    <Card padding="400">
      <BlockStack gap="400">
        {/* 1. CLEAR TOP BAR: PLAIN STATUS BADGE + ONE PRIMARY ACTION */}
        <InlineStack align="space-between" blockAlign="center" gap="300" wrap>
          <InlineStack gap="200" blockAlign="center" wrap>
            <Badge tone={card.badgeTone || "info"}>
              {card.badgeLabel || "Needs Check"}
            </Badge>
            {card.requestKey && <Badge tone="info">{card.requestKey}</Badge>}
          </InlineStack>

          <InlineStack gap="200" blockAlign="center" wrap>
            {card.primaryAction && (
              <Button
                variant="primary"
                tone={primaryBtnTone}
                size="large"
                loading={
                  card.primaryAction.kind !== "copy" &&
                  Boolean(isSubmittingAction)
                }
                disabled={
                  card.primaryAction.kind === "copy"
                    ? !card.copyPlainText
                    : Boolean(isSubmittingAction)
                }
                onClick={() => executeCardAction(card.primaryAction)}
              >
                {primaryBtnLabel}
              </Button>
            )}

            {card.secondaryAction && (
              <Button
                variant="secondary"
                loading={
                  card.secondaryAction.kind !== "copy" &&
                  Boolean(isSubmittingAction)
                }
                disabled={Boolean(isSubmittingAction)}
                onClick={() => executeCardAction(card.secondaryAction)}
              >
                {card.secondaryAction.label}
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {copyFeedback && copyFeedback !== "Copied!" && (
          <Banner tone="warning" onDismiss={() => setCopyFeedback(null)}>
            <Text as="p" variant="bodyMd">
              {copyFeedback}
            </Text>
          </Banner>
        )}

        {/* 2. PLAIN QUESTION */}
        <BlockStack gap="150">
          <Text as="h3" variant="headingMd">
            {card.query || "(Empty question)"}
          </Text>
          {card.constraints && (
            <Text as="p" variant="bodyMd" tone="subdued">
              Scope: {card.constraints}
            </Text>
          )}
          {card.statusHelperText && (
            <Text as="p" variant="bodySm" tone="subdued">
              {card.statusHelperText}
            </Text>
          )}
        </BlockStack>

        {/* 3. READABLE ANSWER + ACCESSIBLE SOURCES + SANDBOXED SEARCH SUGGESTIONS */}
        {(card.answerText ||
          usableSources.length > 0 ||
          card.searchEntryPointHtml) && (
          <Box
            padding="400"
            background="bg-surface-secondary"
            borderRadius="200"
          >
            <BlockStack gap="300">
              <Text as="p" variant="bodySm" tone="subdued">
                Web synthesis — verify important facts against cited links.
                Highlighted spans are AI summaries, not direct quotes.
              </Text>

              {card.answerText && (
                <div
                  style={{
                    whiteSpace: "pre-wrap",
                    lineHeight: "1.65",
                    maxWidth: "74ch",
                  }}
                >
                  <Text as="p" variant="bodyMd">
                    {card.answerText}
                    {card.isAnswerPreviewTruncated
                      ? "... (Preview only — full answer was not durably saved)"
                      : ""}
                  </Text>
                </div>
              )}

              {usableSources.length > 0 && (
                <BlockStack gap="150">
                  <Divider />
                  <Text as="h4" variant="headingSm">
                    Web Sources ({usableSources.length})
                  </Text>
                  <BlockStack gap="100">
                    {usableSources.map((src, sIdx) => {
                      const labelIndex =
                        typeof src.chunkIndex === "number"
                          ? src.chunkIndex
                          : sIdx;
                      return (
                        <Text
                          key={`${card.id}_src_${labelIndex}`}
                          as="p"
                          variant="bodyMd"
                        >
                          [{labelIndex}]{" "}
                          <a
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {src.title || src.uri}
                          </a>
                        </Text>
                      );
                    })}
                  </BlockStack>
                </BlockStack>
              )}

              {card.searchEntryPointHtml && (
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Google Search Suggestions (isolated preview):
                  </Text>
                  <iframe
                    title={`Google Search Suggestions ${card.shortId || ""}`}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    referrerPolicy="no-referrer"
                    srcDoc={card.searchEntryPointHtml}
                    style={{
                      width: "100%",
                      minHeight: "76px",
                      border: "1px solid #dfe3e8",
                      borderRadius: "8px",
                      background: "#ffffff",
                    }}
                  />
                </BlockStack>
              )}
            </BlockStack>
          </Box>
        )}

        {/* 4. COLLAPSED TECHNICAL DETAILS (IDs, TIMESTAMPS, DIAGNOSTICS) */}
        <Box>
          <Button
            variant="plain"
            onClick={() => setTechDetailsOpen((open) => !open)}
            ariaExpanded={techDetailsOpen}
            ariaControls={detailsDomId}
          >
            {techDetailsOpen
              ? "Hide Technical Details"
              : "Show Technical Details"}
          </Button>

          <Collapsible
            open={techDetailsOpen}
            id={detailsDomId}
            transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
          >
            <Box
              padding="300"
              background="bg-surface-secondary"
              borderRadius="150"
            >
              <BlockStack gap="150">
                <Text as="p" variant="bodySm">
                  <strong>Request ID:</strong>{" "}
                  <code>{tech.metaobjectId || card.id}</code>
                </Text>
                <Text as="p" variant="bodySm">
                  <strong>Raw Status:</strong>{" "}
                  <code>{tech.rawStatus || card.rawStatus}</code>
                </Text>
                <Text as="p" variant="bodySm">
                  <strong>Durable Shopify Save Verified:</strong>{" "}
                  {card.durablySaved
                    ? "Yes (exact readback match)"
                    : `No (${tech.durableParseCode || "not saved"})`}
                </Text>
                <Text as="p" variant="bodySm">
                  <strong>30-Minute Sidekick RAM Cache:</strong>{" "}
                  {card.cacheReadableNow ? "Active" : "Not in RAM / Expired"}
                </Text>
                {tech.reportId && (
                  <Text as="p" variant="bodySm">
                    <strong>Report ID:</strong> <code>{tech.reportId}</code>
                  </Text>
                )}
                {tech.executedAt && (
                  <Text as="p" variant="bodySm">
                    <strong>Executed At:</strong> {tech.executedAt}
                  </Text>
                )}
                {tech.claimId && (
                  <Text as="p" variant="bodySm">
                    <strong>Claim ID:</strong> <code>{tech.claimId}</code>
                  </Text>
                )}
                {tech.groundingSummary && (
                  <Text as="p" variant="bodySm">
                    <strong>Grounding Summary:</strong> {tech.groundingSummary}
                  </Text>
                )}
                {searchQueries.length > 0 && (
                  <Text as="p" variant="bodySm">
                    <strong>Search Queries Used:</strong>{" "}
                    {searchQueries.join(" | ")}
                  </Text>
                )}
                {tech.errorDetail && (
                  <Text as="p" variant="bodySm" tone="critical">
                    <strong>System Note / Error:</strong> {tech.errorDetail}
                  </Text>
                )}
              </BlockStack>
            </Box>
          </Collapsible>
        </Box>
      </BlockStack>
    </Card>
  );
}

export default function SidekickQueueCalmView({
  researchDefinitionReady = false,
  researchCards = [],
  jobs = [],
  queueError = null,
  researchLoaderError = null,
  actionData = null,
  revalidatorState = "idle",
  isSubmittingAction = false,
  onNavigateBack,
  onRefresh,
  onSetupDefinition,
  onRunResearch,
  onRepairOrRepublish,
}) {
  const [systemToolsOpen, setSystemToolsOpen] = useState(false);

  const isBusy = revalidatorState !== "idle" || Boolean(isSubmittingAction);

  const legacyJobRows = jobs.map((job, index) => (
    <IndexTable.Row id={job.id} key={job.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {String(job.id || "").split("/").pop()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{String(job.productId || "").split("/").pop()}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" tone="subdued">
          {job.targetKey}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span">{job.targetValue}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge
          tone={
            job.status === "pending"
              ? "warning"
              : job.status === "complete"
                ? "success"
                : "critical"
          }
        >
          {String(job.status || "pending").toUpperCase()}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Research & Sidekick Queue"
      subtitle="Run reviewed questions and copy saved answers anytime."
      backAction={
        typeof onNavigateBack === "function"
          ? { content: "Tools Launcher", onAction: onNavigateBack }
          : undefined
      }
      secondaryActions={
        typeof onRefresh === "function"
          ? [
              {
                content:
                  revalidatorState === "loading" ? "Refreshing..." : "Refresh",
                onAction: onRefresh,
                disabled: isBusy,
              },
            ]
          : []
      }
    >
      <BlockStack gap="500">
        {queueError && (
          <Banner tone="critical" title="Job queue read issue">
            <Text as="p">{queueError}</Text>
          </Banner>
        )}

        {researchLoaderError && (
          <Banner tone="critical" title="Research list read issue">
            <Text as="p">{researchLoaderError}</Text>
          </Banner>
        )}

        {actionData?.error && (
          <Banner tone="critical" title="Action did not complete">
            <Text as="p">{actionData.error}</Text>
          </Banner>
        )}

        {actionData?.ok && actionData?.message && (
          <Banner
            tone={actionData.warning ? "warning" : "success"}
            title={
              actionData.warning ? "Completed — check save note" : "Done"
            }
          >
            <Text as="p">{actionData.message}</Text>
          </Banner>
        )}

        {!researchDefinitionReady && (
          <Card padding="400">
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Research Setup Needed
              </Text>
              <Text as="p" variant="bodyMd">
                Create the <code>sidekick_research_request</code> definition in
                Shopify Admin (Settings → Custom data → Metaobjects, including
                JSON field <code>savedReportJson</code>), or check setup below.
              </Text>
              {typeof onSetupDefinition === "function" && (
                <InlineStack>
                  <Button
                    variant="primary"
                    loading={Boolean(isSubmittingAction)}
                    onClick={onSetupDefinition}
                  >
                    Check Research Setup
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        )}

        {researchDefinitionReady && researchCards.length === 0 && (
          <Card padding="500">
            <EmptySearchResult
              title="No research questions yet"
              description="Save a Sidekick Research Request in Shopify Admin, then come back here to click Run Research."
              withIllustration
            />
          </Card>
        )}

        {researchCards.length > 0 && (
          <BlockStack gap="400">
            {researchCards.map((card) => (
              <ResearchRequestCalmCard
                key={card.id}
                card={card}
                isSubmittingAction={isSubmittingAction}
                onRunResearch={onRunResearch}
                onRepairOrRepublish={onRepairOrRepublish}
              />
            ))}
          </BlockStack>
        )}

        {/* COLLAPSED WORKBENCH SECTION: LEGACY QUEUE, SETUP CHECK & RULES */}
        <Card padding="400">
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center" wrap>
              <InlineStack gap="200" blockAlign="center">
                <Text as="h2" variant="headingSm">
                  More Tools &amp; Product Job Queue ({jobs.length})
                </Text>
                <Badge tone={revalidatorState === "loading" ? "info" : "success"}>
                  {revalidatorState === "loading" ? "Syncing" : "Auto-Sync On"}
                </Badge>
              </InlineStack>

              <Button
                variant="secondary"
                onClick={() => setSystemToolsOpen((open) => !open)}
                ariaExpanded={systemToolsOpen}
                ariaControls="queue-more-tools-collapsible"
              >
                {systemToolsOpen
                  ? "Hide Legacy Queue & Rules"
                  : "Show Legacy Queue & Rules"}
              </Button>
            </InlineStack>

            <Collapsible
              open={systemToolsOpen}
              id="queue-more-tools-collapsible"
              transition={{ duration: "150ms", timingFunction: "ease-in-out" }}
            >
              <BlockStack gap="400">
                <Divider />

                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Check or add missing fields on the{" "}
                    <code>sidekick_research_request</code> definition:
                  </Text>
                  {typeof onSetupDefinition === "function" && (
                    <Button
                      variant="secondary"
                      loading={Boolean(isSubmittingAction)}
                      onClick={onSetupDefinition}
                    >
                      Verify Research Definition
                    </Button>
                  )}
                </InlineStack>

                <Box
                  padding="300"
                  background="bg-surface-secondary"
                  borderRadius="150"
                >
                  <BlockStack gap="100">
                    <Text as="p" variant="bodySm">
                      <strong>How saving works:</strong> An answer shows{" "}
                      <strong>Answer Saved</strong> only after Shopify saves{" "}
                      <code>savedReportJson</code> (up to 120,000 bytes) and a
                      fresh readback verifies exact answer and source matches.
                      Direct Sidekick app-tool access is separate from this
                      page; use <strong>Copy Answer</strong> anytime to paste
                      results directly.
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      This page refreshes every 30 seconds while open, never
                      runs paid searches automatically, and never retries
                      dropped network requests on its own.
                    </Text>
                  </BlockStack>
                </Box>

                <BlockStack gap="200">
                  <Text as="h3" variant="headingSm">
                    Rockhound Studio — Product Metadata Job Queue (
                    <code>sidekick_queue</code>)
                  </Text>

                  {jobs.length === 0 ? (
                    <Box
                      padding="400"
                      background="bg-surface-secondary"
                      borderRadius="150"
                    >
                      <Text as="p" variant="bodySm" tone="subdued">
                        No product metadata jobs in <code>sidekick_queue</code>.
                      </Text>
                    </Box>
                  ) : (
                    <Layout>
                      <Layout.Section>
                        <IndexTable
                          resourceName={{ singular: "job", plural: "jobs" }}
                          itemCount={jobs.length}
                          selectable={false}
                          headings={[
                            { title: "Job ID" },
                            { title: "Product ID" },
                            { title: "Metafield" },
                            { title: "Value" },
                            { title: "Status" },
                          ]}
                        >
                          {legacyJobRows}
                        </IndexTable>
                      </Layout.Section>
                    </Layout>
                  )}
                </BlockStack>
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
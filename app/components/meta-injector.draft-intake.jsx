// ==========================================================================
// ROCKHOUND STUDIO — TAB 3 UNSELECTED DRAFT SEED INTAKE COMPONENT
// File: app/components/meta-injector.draft-intake.jsx
// (Isolated 3-Part Seed / Human ID & Explicit Title Override Intake Card)
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, BlockStack, InlineStack, Text, TextField, Banner, Badge, Box, Spinner } from "@shopify/polaris";
import { useFetcher } from "react-router";
import {
  hasMeaningfulValue,
  evaluateThreePartSeedBlur,
  buildTitleParseFormData
} from "../utils/meta-injector.intake-draft.jsx";

export function UnselectedDraftSeedIntakeCard({
  selectedBenchId = null,
  draftEpoch = 0,
  draftManifest = null,
  manualEditsMap = {},
  sourceContext = {},
  onSeedInputChange,
  onExplicitTitleOverrideChange,
  onSeedBlurCommit,
  onApplyTitleParseResult
}) {
  const titleParseFetcher = useFetcher();

  const [parseNotice, setParseNotice] = useState(null);
  const [parseError, setParseError] = useState("");

  const isMountedRef = useRef(true);
  const requestSeqRef = useRef(0);
  const lastCompletedSeedRef = useRef("");
  const activeRequestCorrelationRef = useRef(null);

  const latestSelectedBenchIdRef = useRef(selectedBenchId);
  const latestDraftEpochRef = useRef(draftEpoch);
  const latestRawSeedInputRef = useRef(
    typeof sourceContext?.rawSeedInput === "string" ? sourceContext.rawSeedInput : ""
  );

  latestSelectedBenchIdRef.current = selectedBenchId;
  latestDraftEpochRef.current = draftEpoch;
  latestRawSeedInputRef.current =
    typeof sourceContext?.rawSeedInput === "string" ? sourceContext.rawSeedInput : "";

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeRequestCorrelationRef.current = null;
    };
  }, []);

  // Invalidate any active correlation and reset completed-seed lock when bench resets (draftEpoch)
  // or when a product GID is selected on the bench.
  useEffect(() => {
    activeRequestCorrelationRef.current = null;
    lastCompletedSeedRef.current = "";
    setParseNotice(null);
    setParseError("");
  }, [draftEpoch, selectedBenchId]);

  const rawSeedInput =
    typeof sourceContext?.rawSeedInput === "string" ? sourceContext.rawSeedInput : "";
  const explicitTitleOverride =
    typeof sourceContext?.explicitTitleOverride === "string"
      ? sourceContext.explicitTitleOverride
      : "";

  const handleLocalSeedInputChange = useCallback(
    (nextVal) => {
      if (selectedBenchId !== null) return;
      const cleanVal = typeof nextVal === "string" ? nextVal : "";

      // Invalidate any in-flight request correlation immediately on seed edit
      if (activeRequestCorrelationRef.current) {
        activeRequestCorrelationRef.current = null;
      }
      // If the user edits the seed away from the last completed seed, allow future blur to re-parse
      if (cleanVal.trim() !== lastCompletedSeedRef.current) {
        lastCompletedSeedRef.current = "";
      }
      if (parseError) {
        setParseError("");
      }

      if (typeof onSeedInputChange === "function") {
        onSeedInputChange(cleanVal);
      }
    },
    [selectedBenchId, parseError, onSeedInputChange]
  );

  const handleLocalExplicitTitleOverrideChange = useCallback(
    (nextVal) => {
      if (selectedBenchId !== null) return;
      const cleanVal = typeof nextVal === "string" ? nextVal : "";
      if (typeof onExplicitTitleOverrideChange === "function") {
        onExplicitTitleOverrideChange(cleanVal);
      }
    },
    [selectedBenchId, onExplicitTitleOverrideChange]
  );

  const handleLocalSeedBlur = useCallback(() => {
    if (selectedBenchId !== null) return;

    const currentSeed = latestRawSeedInputRef.current;
    const evalResult = evaluateThreePartSeedBlur(currentSeed, lastCompletedSeedRef.current);

    if (!evalResult.shouldTrigger) {
      return;
    }

    const { normalizedSeed, extractedPieceId } = evalResult;
    requestSeqRef.current += 1;
    const seq = requestSeqRef.current;
    // The /app/meta-injector-autofill titleParse endpoint echoes pieceId (body.get("pieceId")).
    // Use a unique per-request correlation token in pieceId (never a fake Shopify Product GID)
    // so the response can be verified against the exact request that initiated it.
    const requestToken = `t3draft_tp_${draftEpoch}_${seq}_${Date.now()}`;

    const correlationRecord = {
      requestId: requestToken,
      pieceIdToken: requestToken,
      draftEpoch,
      requestSeed: normalizedSeed,
      extractedPieceId,
      baselineFetcherData: titleParseFetcher.data,
      sawNonIdle: false,
      startedAt: new Date().toISOString()
    };

    activeRequestCorrelationRef.current = correlationRecord;
    setParseNotice(null);
    setParseError("");

    if (typeof onSeedBlurCommit === "function") {
      onSeedBlurCommit({
        normalizedSeed,
        extractedPieceId,
        requestCorrelation: {
          requestId: requestToken,
          pieceIdToken: requestToken,
          draftEpoch,
          requestSeed: normalizedSeed,
          extractedPieceId
        }
      });
    }

    const fd = buildTitleParseFormData({
      pieceId: requestToken,
      seedString: normalizedSeed,
      requestId: requestToken,
      draftRevision: draftEpoch
    });

    titleParseFetcher.submit(fd, {
      method: "post",
      action: "/app/meta-injector-autofill"
    });
  }, [selectedBenchId, draftEpoch, titleParseFetcher, onSeedBlurCommit]);

  useEffect(() => {
    const activeReq = activeRequestCorrelationRef.current;
    if (!activeReq) return;

    if (titleParseFetcher.state !== "idle") {
      if (!activeReq.sawNonIdle) {
        activeReq.sawNonIdle = true;
      }
      return;
    }

    const data = titleParseFetcher.data;
    const hasCompletedCycle =
      activeReq.sawNonIdle || data !== activeReq.baselineFetcherData;

    if (!hasCompletedCycle) {
      return;
    }

    // Consume the active request slot now that fetcher has returned to idle for this cycle
    activeRequestCorrelationRef.current = null;

    if (!isMountedRef.current) {
      return;
    }

    // Reject if a product was selected, draft epoch changed, or seed input changed while in flight
    if (
      latestSelectedBenchIdRef.current !== null ||
      latestDraftEpochRef.current !== activeReq.draftEpoch ||
      latestRawSeedInputRef.current.trim() !== activeReq.requestSeed
    ) {
      return;
    }

    // Fail closed if fetcher returned to idle without delivering a new payload
    if (activeReq.sawNonIdle && data === activeReq.baselineFetcherData) {
      lastCompletedSeedRef.current = "";
      setParseError(
        "Title seed parse returned no response payload. Edit or tab out of Piece Name to retry."
      );
      setParseNotice(null);
      return;
    }

    if (!data || typeof data !== "object" || data.intent !== "titleParse") {
      lastCompletedSeedRef.current = "";
      setParseError(
        data?.error ||
          "Unexpected or malformed response from titleParse endpoint. Edit or blur Piece Name to retry."
      );
      setParseNotice(null);
      return;
    }

    // Verify exact echoed pieceId token correlation from executeAutofill("titleParse")
    if (
      typeof data.pieceId !== "string" ||
      data.pieceId.trim() !== activeReq.pieceIdToken
    ) {
      return;
    }

    if (data.success !== true || !data.titleParse || typeof data.titleParse !== "object") {
      lastCompletedSeedRef.current = "";
      setParseError(
        data.error ||
          "Title seed parse failed. Verify the 3-part seed format (Stone - Origin - Piece Name) and blur to retry."
      );
      setParseNotice(null);
      return;
    }

    const parsed = data.titleParse;

    if (typeof onApplyTitleParseResult === "function") {
      onApplyTitleParseResult(parsed, {
        requestId: activeReq.requestId,
        pieceIdToken: activeReq.pieceIdToken,
        draftEpoch: activeReq.draftEpoch,
        requestSeed: activeReq.requestSeed,
        extractedPieceId: activeReq.extractedPieceId
      });
    }

    // Mark this exact 3-part seed as completed only after verified success
    lastCompletedSeedRef.current = activeReq.requestSeed;

    if (parsed.needs_new_origin_page) {
      setParseNotice({
        tone: "warning",
        title: "3-Part Seed Parsed (Origin Page Warning)",
        message: `Staged working draft suggestions from seed "${activeReq.requestSeed}". Warning: No live origin page found for "${parsed.origin_name || parsed.origin_location || "this origin"}" (not saved to Shopify).`
      });
    } else {
      setParseNotice({
        tone: "info",
        title: "3-Part Seed Parsed into Unsaved Draft",
        message: `Staged working draft suggestions from "${activeReq.requestSeed}". Human piece ID "${activeReq.extractedPieceId}" is preserved in custom.piece_name. Review or edit suggestions in the drawers below (not saved to Shopify).`
      });
    }
    setParseError("");
  }, [
    titleParseFetcher.state,
    titleParseFetcher.data,
    onApplyTitleParseResult
  ]);

  if (selectedBenchId !== null) {
    return null;
  }

  const isParsingSeed =
    Boolean(activeRequestCorrelationRef.current) &&
    (titleParseFetcher.state !== "idle" ||
      activeRequestCorrelationRef.current?.sawNonIdle === false);

  const stagedPieceIdPreview =
    draftManifest?.repairPlan?.["custom.piece_name"] || "";
  const stagedNativeTitlePreview =
    draftManifest?.repairPlan?.["shopify_title"] ||
    draftManifest?.repairPlan?.["native_title"] ||
    "";
  const hasOriginStoryContext = hasMeaningfulValue(sourceContext?.origin_story);
  const isTitleManuallyLocked = Boolean(
    hasMeaningfulValue(explicitTitleOverride) ||
      manualEditsMap?.shopify_title === true ||
      manualEditsMap?.native_title === true
  );

  return (
    <Card padding="400">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingLg" fontWeight="bold">
              New-Product Draft Seed &amp; Identity Intake
            </Text>
            <Badge tone="info">Unsaved Browser Draft — No Product Selected</Badge>
          </InlineStack>
          {isParsingSeed && (
            <InlineStack gap="150" blockAlign="center">
              <Spinner size="small" />
              <Text as="span" variant="bodySm" fontWeight="bold">
                Parsing 3-part seed...
              </Text>
            </InlineStack>
          )}
        </InlineStack>

        <Text as="p" variant="bodySm" tone="subdued">
          Enter a standalone human identifier (e.g. <code>BQH-1</code>, <code>BQH-2</code>, <code>bob</code>) or a 3-part seed (<code>Stone - Origin - Piece Name</code>, e.g. <code>jas - yak - test product</code>) and tab out to stage working suggestions into the Tab 3 drawers below. Single human IDs never trigger a parse. Suggestions remain unsaved working data until explicitly approved or edited.
        </Text>

        {parseError !== "" && (
          <Banner
            tone="critical"
            title="Seed Parse Failed"
            onDismiss={() => setParseError("")}
          >
            <Text as="p" variant="bodyMd">
              {parseError}
            </Text>
          </Banner>
        )}

        {parseNotice && (
          <Banner
            tone={parseNotice.tone || "info"}
            title={parseNotice.title || "Seed Parsed"}
            onDismiss={() => setParseNotice(null)}
          >
            <Text as="p" variant="bodyMd">
              {parseNotice.message}
            </Text>
          </Banner>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "16px",
            alignItems: "start"
          }}
        >
          <TextField
            label="Piece Name (Human Identifier or 3-Part Title Seed)"
            value={rawSeedInput}
            onChange={handleLocalSeedInputChange}
            onBlur={handleLocalSeedBlur}
            autoComplete="off"
            placeholder="e.g. BQH-1 or jas - yak - test product"
            helpText="Tab out of a 3-part seed (Stone - Origin - Piece Name) to parse identity, origin, collection, and geology suggestions into the draft."
          />

          <TextField
            label="Native Product Title (Explicit Override)"
            value={explicitTitleOverride}
            onChange={handleLocalExplicitTitleOverrideChange}
            autoComplete="off"
            placeholder="Leave blank to use assembled 3-part title proposal"
            helpText="Optional explicit override for Native Title (shopify_title / native_title). Protects title against later seed parse overwrites."
          />
        </div>

        <Box
          padding="300"
          background="bg-surface-secondary"
          borderRadius="200"
          borderColor="border"
          borderWidth="1"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "8px 16px",
              fontSize: "13px",
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}
          >
            <div>
              <strong>Staged Human Piece ID (<code>custom.piece_name</code>):</strong>{" "}
              {stagedPieceIdPreview ? (
                <code>{stagedPieceIdPreview}</code>
              ) : (
                <span style={{ color: "#6d7175", fontStyle: "italic" }}>Blank</span>
              )}
            </div>
            <div>
              <strong>Staged Native Title Proposal (<code>native_title</code>):</strong>{" "}
              {stagedNativeTitlePreview ? (
                <code>{stagedNativeTitlePreview}</code>
              ) : (
                <span style={{ color: "#6d7175", fontStyle: "italic" }}>Blank</span>
              )}{" "}
              {isTitleManuallyLocked && <Badge tone="info">Manual / Override Locked</Badge>}
            </div>
            <div>
              <strong>AI Source Context (<code>origin_story</code>):</strong>{" "}
              {hasOriginStoryContext
                ? `Loaded in isolated source context (${String(sourceContext.origin_story).length} chars — excluded from repairPlan)`
                : "None loaded"}
            </div>
          </div>
        </Box>
      </BlockStack>
    </Card>
  );
}

export default UnselectedDraftSeedIntakeCard;
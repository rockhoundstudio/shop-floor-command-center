import React from "react";
import { BlockStack, Text, Banner, TextField, Button, InlineStack, Box, Badge, Select } from "@shopify/polaris";
import {
  VERIFIED_STANDARDIZED_DESTINATIONS,
  parseMetaobjectGidArray,
  formatStructuredDiagValue,
  formatErrorsList
} from "../utils/meta-injector.standardized.jsx";

export const LIFECYCLE_BADGE_LABEL_MAP = {
  ready: "Ready",
  submitting: "Submitting",
  awaiting_response: "Awaiting Response",
  completed: "Completed",
  incomplete: "Incomplete (Partial)",
  failed: "Failed",
  discarded_stale: "Discarded Stale Response"
};

export const deriveStandardizedLifecycle = ({
  selectedBenchId,
  candidateBundle,
  referenceMatchFetcherState,
  pendingReferenceMatch,
  validRefMatchResult,
  productMatchStatusRecord
}) => {
  const hasSupportedCandidates = Boolean(candidateBundle?.hasSupported);
  const isFetcherBusy = referenceMatchFetcherState !== "idle";
  const isPendingForCurrentProduct = pendingReferenceMatch?.pieceId === selectedBenchId;
  const isPendingForOtherProduct = pendingReferenceMatch !== null && pendingReferenceMatch?.pieceId !== selectedBenchId;

  const isMatchButtonDisabled =
    !selectedBenchId ||
    !hasSupportedCandidates ||
    pendingReferenceMatch !== null ||
    isFetcherBusy;
  const isMatchButtonLoading = isPendingForCurrentProduct || (isFetcherBusy && !isPendingForOtherProduct);

  let derivedLifecycleState = "ready";
  let derivedLifecycleTone = "info";
  let derivedLifecycleMessage = "";

  if (isPendingForCurrentProduct) {
    derivedLifecycleState = pendingReferenceMatch.sawNonIdle ? "awaiting_response" : "submitting";
    derivedLifecycleTone = "info";
    derivedLifecycleMessage =
      productMatchStatusRecord?.message ||
      `Reference matching in progress for ${selectedBenchId} (fetcher state: ${referenceMatchFetcherState}). Please wait for the response...`;
  } else if (isPendingForOtherProduct) {
    derivedLifecycleState = "awaiting_response";
    derivedLifecycleTone = "warning";
    derivedLifecycleMessage = `Reference matching button is locked because a request for another product (${pendingReferenceMatch.pieceId}) is currently pending (fetcher state: ${referenceMatchFetcherState}). Wait for it to finish, or click 'Release Stalled Match Lock' if that request is genuinely stuck.`;
  } else if (isFetcherBusy) {
    derivedLifecycleState = "awaiting_response";
    derivedLifecycleTone = "warning";
    derivedLifecycleMessage = `Reference matching fetcher is currently busy (${referenceMatchFetcherState}). Wait for it to return to idle before starting a new request.`;
  } else if (!hasSupportedCandidates) {
    derivedLifecycleState = productMatchStatusRecord?.state === "failed" ? "failed" : "ready";
    derivedLifecycleTone = "warning";
    derivedLifecycleMessage =
      productMatchStatusRecord?.message ||
      "Match Reference Choices is disabled because no validated Vision standardized candidates exist for this product yet. Click 'Run AI (Single)' above (or 'EXECUTE AI AUTO-FILL (STAGE)') so Vision stages candidate labels and evidence first.";
  } else if (productMatchStatusRecord) {
    derivedLifecycleState = productMatchStatusRecord.state;
    derivedLifecycleTone = productMatchStatusRecord.tone || "info";
    derivedLifecycleMessage = productMatchStatusRecord.message;
  } else if (validRefMatchResult) {
    derivedLifecycleState = validRefMatchResult.isComplete && validRefMatchResult.success ? "completed" : "incomplete";
    derivedLifecycleTone = validRefMatchResult.isComplete && validRefMatchResult.success ? "success" : "warning";
    derivedLifecycleMessage =
      validRefMatchResult.isComplete && validRefMatchResult.success
        ? "Reference matching completed. Review and approve verified proposals beside each candidate row below."
        : "Reference matching returned partial/incomplete read diagnostics. Review partial results and errors below, or click 'Match Reference Choices' to retry.";
  } else {
    derivedLifecycleState = "ready";
    derivedLifecycleTone = "info";
    derivedLifecycleMessage = `Ready to match ${candidateBundle.count} validated Vision candidate attribute(s) (${Object.keys(candidateBundle.ordered).join(", ")}). Click 'Match Reference Choices' to query Shopify reference resolutions.`;
  }

  return {
    hasSupportedCandidates,
    isPendingForCurrentProduct,
    isMatchButtonDisabled,
    isMatchButtonLoading,
    derivedLifecycleState,
    derivedLifecycleTone,
    derivedLifecycleMessage
  };
};

export function StandardizedSectionBanner({
  selectedBenchId,
  candidateBundle,
  referenceMatchFetcherState,
  pendingReferenceMatch,
  validRefMatchResult,
  productMatchStatusRecord,
  onReleasePendingMatch,
  onMatchReferenceChoices
}) {
  const {
    hasSupportedCandidates,
    isMatchButtonDisabled,
    isMatchButtonLoading,
    derivedLifecycleState,
    derivedLifecycleTone,
    derivedLifecycleMessage
  } = deriveStandardizedLifecycle({
    selectedBenchId,
    candidateBundle,
    referenceMatchFetcherState,
    pendingReferenceMatch,
    validRefMatchResult,
    productMatchStatusRecord
  });

  return (
    <Box padding="300" background="bg-surface-secondary" borderColor="border" borderWidth="1" borderRadius="200">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="300">
          <BlockStack gap="100">
            <InlineStack gap="200" blockAlign="center">
              <Text as="h4" variant="headingSm" fontWeight="bold">
                Standardized Reference Matching & Verified Proposal Connection
              </Text>
              <Badge tone={derivedLifecycleTone}>
                {LIFECYCLE_BADGE_LABEL_MAP[derivedLifecycleState] || derivedLifecycleState}
              </Badge>
            </InlineStack>
            <Text as="p" variant="bodySm" tone="subdued">
              Supported candidate destinations: {VERIFIED_STANDARDIZED_DESTINATIONS.join(", ")}. All other standardized rows remain read-only.
            </Text>
          </BlockStack>
          <InlineStack gap="200" blockAlign="center">
            {pendingReferenceMatch !== null && (
              <Button
                size="medium"
                variant="secondary"
                tone="critical"
                onClick={onReleasePendingMatch}
              >
                Release Stalled Match Lock
              </Button>
            )}
            <Button
              size="medium"
              variant="primary"
              onClick={onMatchReferenceChoices}
              disabled={isMatchButtonDisabled}
              loading={isMatchButtonLoading}
            >
              {validRefMatchResult || derivedLifecycleState === "failed" || derivedLifecycleState === "incomplete" || derivedLifecycleState === "discarded_stale"
                ? "Match Reference Choices (Retry)"
                : "Match Reference Choices"}
            </Button>
          </InlineStack>
        </InlineStack>

        <Banner
          tone={derivedLifecycleTone}
          title={`Reference Matching Lifecycle: ${LIFECYCLE_BADGE_LABEL_MAP[derivedLifecycleState] || derivedLifecycleState}`}
        >
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" fontWeight="medium">
              {derivedLifecycleMessage}
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              <strong>Product GID:</strong> {selectedBenchId} | <strong>Staged Candidate Keys:</strong>{" "}
              {hasSupportedCandidates ? Object.keys(candidateBundle.ordered).join(", ") : "None"} |{" "}
              <strong>Dedicated Fetcher State:</strong> {referenceMatchFetcherState}
              {pendingReferenceMatch ? ` | Pending Lock: ${pendingReferenceMatch.pieceId}` : ""}
            </Text>
          </BlockStack>
        </Banner>

        {validRefMatchResult && (
          <Banner
            tone={validRefMatchResult.isComplete && validRefMatchResult.success && validRefMatchResult.errors.length === 0 ? "success" : "warning"}
            title={
              validRefMatchResult.isComplete && validRefMatchResult.success
                ? "Reference Matching Read Summary — Verified Candidates Ready for Exact-List Review & Approval"
                : "Reference Matching Incomplete / Partial Read Enumeration (Blocked — Not Save-Ready)"
            }
          >
            <BlockStack gap="100">
              <Text as="p" variant="bodySm">
                <strong>Overall Status:</strong> {validRefMatchResult.success ? "Complete" : "Incomplete / Partial Diagnostics"} |{" "}
                <strong>isComplete:</strong> {String(validRefMatchResult.isComplete)} |{" "}
                <strong>Matched At:</strong> {new Date(validRefMatchResult.matchedAt).toLocaleTimeString()}
              </Text>
              {!validRefMatchResult.isComplete && (
                <Text as="p" variant="bodySm" fontWeight="medium">
                  Partial enumeration detected. Incomplete results remain blocked and are never treated as missing_entry or save-ready.
                </Text>
              )}
              {validRefMatchResult.errors.length > 0 && (
                <BlockStack gap="050">
                  <Text as="p" variant="bodySm" tone="critical" fontWeight="bold">
                    Top-Level Read Errors:
                  </Text>
                  {validRefMatchResult.errors.map((errText, idx) => (
                    <Text key={idx} as="p" variant="bodySm" tone="critical">
                      • {errText}
                    </Text>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Banner>
        )}
      </BlockStack>
    </Box>
  );
}

export function StandardizedProposalControl({
  keyName,
  meta,
  displayPropVal,
  visionCandidateEntry,
  onSelectEntry,
  onToggleEntry
}) {
  const verifiedMapForDisplay = meta.stdEvaluation?.verifiedEntriesMap || null;
  const currentProposedGids = parseMetaobjectGidArray(meta.propVal);
  const existingAssignedSet = new Set(meta.stdEvaluation?.existingGids || []);
  const verifiedEntriesArray = verifiedMapForDisplay ? Array.from(verifiedMapForDisplay.values()) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <TextField
        value={meta.isSupported ? (meta.propVal || "") : "Connection pending."}
        onChange={() => {}}
        autoComplete="off"
        placeholder={
          meta.isPendingReadOnly
            ? (meta.stdEvaluation?.blockReason || "Blocked until reference matching succeeds")
            : "No proposal staged"
        }
        disabled={true}
        readOnly={true}
        helpText={
          meta.proposalExists
            ? `Readable Selection: ${displayPropVal}`
            : (meta.stdEvaluation?.blockReason || "Run 'Match Reference Choices' to resolve verified Metaobject GIDs.")
        }
      />

      {/* Verified Entry Selector Controls (Strictly restricted to returned verified entries) */}
      {!meta.isPendingReadOnly && meta.stdEvaluation?.isTechnicallyEligible && verifiedEntriesArray.length > 0 && (
        <div style={{ padding: "12px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "10px" }}>
          <Text as="p" variant="headingSm" fontWeight="bold" style={{ color: "#166534" }}>
            Editable Verified Reference Selection (Returned Verified Metaobject Entries Only)
          </Text>

          {meta.stdEvaluation.labelEvaluations.map((ev, evIdx) => {
            const candLbl = visionCandidateEntry?.labels?.[evIdx] || `Candidate ${evIdx + 1}`;
            const selectedGidForSlot = ev.selectedEntry?.id || "";
            const activeSlotGid =
              currentProposedGids.find((g) => ev.matchingEntries.some((me) => me.id === g)) ||
              selectedGidForSlot;

            const selectOptions = verifiedEntriesArray.map((ve) => ({
              label: `${ve.label || "Entry"} — ${ve.id}${existingAssignedSet.has(ve.id) ? " [Already Assigned]" : ""}`,
              value: ve.id
            }));

            return (
              <div key={evIdx} style={{ padding: "8px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #dcfce7" }}>
                <Select
                  label={`Candidate "${candLbl}" (${ev.status})`}
                  options={selectOptions}
                  value={activeSlotGid}
                  onChange={(newGid) =>
                    onSelectEntry(
                      keyName,
                      meta.propVal,
                      meta.stdEvaluation,
                      newGid,
                      activeSlotGid
                    )
                  }
                />
                <Text as="p" variant="bodySm" tone="subdued" style={{ marginTop: "4px" }}>
                  {ev.reason}
                </Text>
              </div>
            );
          })}

          <div style={{ borderTop: "1px solid #bbf7d0", paddingTop: "8px" }}>
            <Text as="p" variant="bodySm" fontWeight="bold" style={{ marginBottom: "6px", color: "#166534" }}>
              Complete Reference List Builder (Existing assignments are locked to prevent deletion):
            </Text>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflowY: "auto" }}>
              {verifiedEntriesArray.map((ve) => {
                const isChecked = currentProposedGids.includes(ve.id);
                const isExistingLocked = existingAssignedSet.has(ve.id);
                return (
                  <label
                    key={ve.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "12px",
                      cursor: isExistingLocked ? "not-allowed" : "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      disabled={isExistingLocked}
                      onChange={(e) =>
                        onToggleEntry(
                          keyName,
                          meta.propVal,
                          meta.stdEvaluation,
                          ve.id,
                          e.target.checked
                        )
                      }
                    />
                    <span>
                      <strong>{ve.label || "Unnamed"}</strong> ({ve.id})
                      {ve.definitionId ? ` | Def: ${ve.definitionId}` : ""}
                      {ve.taxonomyRef ? ` | Tax: ${ve.taxonomyRef}` : ""}
                      {isExistingLocked ? " [Existing Assignment — Preserved]" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function StandardizedRowDiagnostics({
  selectedBenchId,
  candidateBundle,
  referenceMatchFetcherState,
  pendingReferenceMatch,
  validRefMatchResult,
  productMatchStatusRecord,
  candidateMetaKey,
  meta,
  displayPropVal,
  visionCandidateEntry
}) {
  const {
    isPendingForCurrentProduct,
    derivedLifecycleState,
    derivedLifecycleTone,
    derivedLifecycleMessage
  } = deriveStandardizedLifecycle({
    selectedBenchId,
    candidateBundle,
    referenceMatchFetcherState,
    pendingReferenceMatch,
    validRefMatchResult,
    productMatchStatusRecord
  });

  const fieldResolution =
    validRefMatchResult
      ? validRefMatchResult.resolutions?.[`shopify.${candidateMetaKey}`] || null
      : null;
  const fieldResolutionErrors = fieldResolution ? formatErrorsList(fieldResolution.errors || fieldResolution.error) : [];
  const availableEntriesList = Array.isArray(fieldResolution?.availableEntries) ? fieldResolution.availableEntries : [];
  const formattedLabelResolutions =
    fieldResolution && fieldResolution.labelResolutions !== undefined && fieldResolution.labelResolutions !== null
      ? formatStructuredDiagValue(fieldResolution.labelResolutions)
      : "";
  const formattedContinuation =
    fieldResolution && fieldResolution.continuation !== undefined && fieldResolution.continuation !== null
      ? formatStructuredDiagValue(fieldResolution.continuation)
      : "";

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
      <div style={{ flex: "1 1 260px", padding: "12px", backgroundColor: "#eef2ff", borderRadius: "8px", border: "1px solid #c7d2fe", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", boxSizing: "border-box" }}>
        <Text as="p" variant="headingSm" fontWeight="bold" style={{ marginBottom: "6px", color: "#1e3a8a" }}>
          Vision Standardized Candidate ({candidateMetaKey})
        </Text>
        {visionCandidateEntry && Array.isArray(visionCandidateEntry.labels) && visionCandidateEntry.labels.length > 0 ? (
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              <strong>Candidate Labels:</strong> {visionCandidateEntry.labels.join(", ")}
            </Text>
            <Text as="p" variant="bodySm">
              <strong>Evidence:</strong> {visionCandidateEntry.evidence}
            </Text>
            {meta.isPendingReadOnly ? (
              <Text as="p" variant="bodySm" tone="critical" fontWeight="medium">
                <strong>Blocked:</strong> {meta.stdEvaluation?.blockReason || "Run 'Match Reference Choices' to validate."}
              </Text>
            ) : (
              <Text as="p" variant="bodySm" tone="success" fontWeight="medium">
                <strong>Resolved Proposal:</strong> {displayPropVal}
              </Text>
            )}
          </BlockStack>
        ) : (
          <BlockStack gap="100">
            <Text as="p" variant="bodySm" tone="subdued">
              No supported Vision candidate returned for this attribute.
            </Text>
          </BlockStack>
        )}
      </div>

      <div style={{ flex: "1 1 280px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #cbd5e1", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", boxSizing: "border-box" }}>
        <Text as="p" variant="headingSm" fontWeight="bold" style={{ marginBottom: "6px", color: "#0f172a" }}>
          Reference Matching Diagnostics (shopify.{candidateMetaKey})
        </Text>
        {isPendingForCurrentProduct ? (
          <BlockStack gap="100">
            <Text as="p" variant="bodySm">
              <strong>Request State:</strong>{" "}
              <Badge tone="info">
                {pendingReferenceMatch.sawNonIdle ? "Awaiting Response" : "Submitting"}
              </Badge>
            </Text>
            <Text as="p" variant="bodySm">
              Matching reference choices against Shopify definitions...
            </Text>
          </BlockStack>
        ) : fieldResolution ? (
          <BlockStack gap="150">
            <Text as="p" variant="bodySm">
              <strong>Backend Status:</strong>{" "}
              <Badge tone={fieldResolution.isComplete === false ? "warning" : "info"}>
                {typeof fieldResolution.status === "string" && fieldResolution.status.trim() !== ""
                  ? fieldResolution.status
                  : "Reported"}
              </Badge>{" "}
              | <strong>Completeness:</strong>{" "}
              <Badge tone={fieldResolution.isComplete === true ? "success" : "warning"}>
                {fieldResolution.isComplete === true
                  ? "Complete"
                  : "Incomplete (Blocked / Not save-ready)"}
              </Badge>
            </Text>

            {fieldResolution.destination && (
              <Text as="p" variant="bodySm">
                <strong>Destination:</strong> {String(fieldResolution.destination)}
              </Text>
            )}

            {meta.stdEvaluation?.labelEvaluations?.length > 0 && (
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Resolution Evaluation:
                </Text>
                {meta.stdEvaluation.labelEvaluations.map((ev, idx) => (
                  <Text
                    key={idx}
                    as="p"
                    variant="bodySm"
                    tone={ev.selectedEntry ? "success" : "critical"}
                  >
                    • {ev.reason}
                  </Text>
                ))}
              </BlockStack>
            )}

            {formattedLabelResolutions && (
              <div style={{ minWidth: 0 }}>
                <Text as="p" variant="bodySm" fontWeight="bold">
                  Label Resolutions (Raw Backend Diagnostic):
                </Text>
                <pre style={{ margin: "4px 0 0 0", padding: "8px", backgroundColor: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "4px", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere", maxHeight: "220px", overflowY: "auto" }}>
                  {formattedLabelResolutions}
                </pre>
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <Text as="p" variant="bodySm" fontWeight="bold">
                Available Reference Entries ({availableEntriesList.length}):
              </Text>
              {availableEntriesList.length > 0 ? (
                <div style={{ marginTop: "4px", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "180px", overflowY: "auto", padding: "6px", backgroundColor: "#f1f5f9", borderRadius: "4px", border: "1px solid #e2e8f0" }}>
                  {availableEntriesList.map((entry, idx) => {
                    if (!entry || typeof entry !== "object") {
                      return (
                        <Text key={idx} as="p" variant="bodySm">
                          • {String(entry ?? "")}
                        </Text>
                      );
                    }
                    const disp = typeof entry.displayName === "string" ? entry.displayName : "";
                    const idStr = typeof entry.id === "string" ? entry.id : "";
                    const defStr = typeof entry.definition === "string" ? entry.definition : formatStructuredDiagValue(entry.definition);
                    const taxStr = typeof entry.taxonomy_reference === "string" ? entry.taxonomy_reference : formatStructuredDiagValue(entry.taxonomy_reference);
                    return (
                      <div key={idStr || idx} style={{ fontSize: "12px", borderBottom: idx < availableEntriesList.length - 1 ? "1px solid #e2e8f0" : "none", paddingBottom: "4px" }}>
                        <strong>{disp || "Unnamed Entry"}</strong>
                        {idStr ? ` | ID: ${idStr}` : ""}
                        {defStr ? ` | Def: ${defStr}` : ""}
                        {taxStr ? ` | Taxonomy: ${taxStr}` : ""}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Text as="p" variant="bodySm" tone="subdued">
                  No availableEntries returned in this read pass.
                </Text>
              )}
            </div>

            {formattedContinuation && formattedContinuation !== "null" && formattedContinuation !== "{}" && (
              <div style={{ minWidth: 0 }}>
                <Text as="p" variant="bodySm" fontWeight="bold" tone="caution">
                  Pending Continuation:
                </Text>
                <pre style={{ margin: "4px 0 0 0", padding: "6px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "4px", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  {formattedContinuation}
                </pre>
              </div>
            )}

            {fieldResolutionErrors.length > 0 && (
              <BlockStack gap="050">
                <Text as="p" variant="bodySm" tone="critical" fontWeight="bold">
                  Read Errors:
                </Text>
                {fieldResolutionErrors.map((errItem, eIdx) => (
                  <Text key={eIdx} as="p" variant="bodySm" tone="critical">
                    • {errItem}
                  </Text>
                ))}
              </BlockStack>
            )}
          </BlockStack>
        ) : (
          <BlockStack gap="100">
            <Text as="p" variant="bodySm">
              <strong>Lifecycle State:</strong>{" "}
              <Badge tone={derivedLifecycleTone}>
                {LIFECYCLE_BADGE_LABEL_MAP[derivedLifecycleState] || derivedLifecycleState}
              </Badge>
            </Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {validRefMatchResult
                ? visionCandidateEntry
                  ? "Backend response did not include a resolution object for this candidate key. Check top-level read errors or click 'Match Reference Choices (Retry)'."
                  : "No candidate was submitted for this attribute key."
                : derivedLifecycleMessage}
            </Text>
          </BlockStack>
        )}
      </div>
    </div>
  );
}
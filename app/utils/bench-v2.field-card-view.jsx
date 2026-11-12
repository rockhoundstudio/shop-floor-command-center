// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 FIELD CARD PRESENTATION MODULE
// File: app/utils/bench-v2.field-card-view.jsx
// ==========================================================================

import React from "react";
import {
  isManualOnlyNoAiDestination,
  inspectStoredReferenceListRawValue
} from "./bench-v2.contract.jsx";
import {
  formatRawBaselineValueForInspection,
  getShortPlainNotice
} from "./bench-v2.field-filters.jsx";
import {
  BenchV2FieldProposedEditorBox
} from "./bench-v2.field-controls-view.jsx";

export const SHORT_NOTICE_TONE_STYLES = Object.freeze({
  error: Object.freeze({
    backgroundColor: "#fef2f2",
    color: "#991b1b",
    border: "1px solid #fca5a5"
  }),
  warning: Object.freeze({
    backgroundColor: "#fff7ed",
    color: "#9a3412",
    border: "1px solid #fdba74"
  }),
  muted: Object.freeze({
    backgroundColor: "#f1f5f9",
    color: "#334155",
    border: "1px solid #cbd5e1"
  })
});

export function getShortNoticeBoxStyle(tone) {
  const palette =
    tone === "error"
      ? SHORT_NOTICE_TONE_STYLES.error
      : tone === "warning"
        ? SHORT_NOTICE_TONE_STYLES.warning
        : SHORT_NOTICE_TONE_STYLES.muted;
  return {
    marginTop: "10px",
    padding: "8px 10px",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: 600,
    ...palette
  };
}

export const DETAILS_PANEL_STYLE = Object.freeze({
  marginTop: "8px",
  padding: "10px 14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "6px"
});

export function inspectActiveReferenceSelectionForCard({
  row,
  isShopifyReference,
  isRefEvidenceCompleteForRow
}) {
  if (!isShopifyReference || !row?.contract?.isWritableInBatch1) {
    return null;
  }

  const obs = row.baselineObservation;
  const referenceEvidence = row.referenceEvidence;
  const entriesByGid =
    isRefEvidenceCompleteForRow && referenceEvidence?.entriesByGid instanceof Map
      ? referenceEvidence.entriesByGid
      : null;

  const storedCheck = inspectStoredReferenceListRawValue(obs?.rawValue);
  const storedGids = storedCheck.valid ? storedCheck.gids : [];
  const storedSet = new Set(storedGids);

  const mapGidToItem = (gid) => {
    const verifiedEntry = entriesByGid ? entriesByGid.get(gid) : null;
    return {
      gid,
      label:
        verifiedEntry && typeof verifiedEntry.label === "string" && verifiedEntry.label.trim() !== ""
          ? verifiedEntry.label.trim()
          : null,
      isVerifiedMember: Boolean(verifiedEntry),
      isSavedInBaseline: storedSet.has(gid)
    };
  };

  if (row.hasProposalKey) {
    const rawDraft = typeof row.proposedValue === "string" ? row.proposedValue : "";
    const trimmedDraft = rawDraft.trim();

    if (trimmedDraft === "") {
      return {
        mode: "draft_empty",
        valid: false,
        items: [],
        removedSavedItems: [],
        error: "Active draft is empty. Enter a valid reference list or click Reset to Saved."
      };
    }

    let parsedDraft;
    try {
      parsedDraft = JSON.parse(rawDraft);
    } catch {
      return {
        mode: "draft_invalid",
        valid: false,
        items: [],
        removedSavedItems: [],
        error:
          row.validation?.reason ||
          "Active draft is not a canonical JSON array of Metaobject GIDs. Fix the draft or click Reset to Saved."
      };
    }

    if (!Array.isArray(parsedDraft)) {
      return {
        mode: "draft_invalid",
        valid: false,
        items: [],
        removedSavedItems: [],
        error:
          row.validation?.reason ||
          "Active draft is not a JSON array of Metaobject GIDs. Fix the draft or click Reset to Saved."
      };
    }

    if (parsedDraft.length === 0) {
      return {
        mode: "draft_empty_array",
        valid: false,
        items: [],
        removedSavedItems: storedGids.map(mapGidToItem),
        error:
          row.validation?.reason ||
          "Clearing the last reference entry to an empty list is not supported by the current app validation and writer. Click Reset to Saved to restore the saved selection."
      };
    }

    const draftCheck = inspectStoredReferenceListRawValue(rawDraft);
    const hasDuplicateOrNonCanonical =
      !draftCheck.valid ||
      draftCheck.gids.length !== parsedDraft.length ||
      JSON.stringify(parsedDraft) !== rawDraft;

    if (hasDuplicateOrNonCanonical) {
      return {
        mode: "draft_invalid",
        valid: false,
        items: [],
        removedSavedItems: [],
        error:
          row.validation?.reason ||
          draftCheck.error ||
          "Active draft contains duplicate, untrimmed, or invalid Metaobject GIDs. Fix the draft or click Reset to Saved."
      };
    }

    const activeSet = new Set(draftCheck.gids);
    const items = draftCheck.gids.map(mapGidToItem);
    const removedSavedItems = storedGids
      .filter((g) => !activeSet.has(g))
      .map(mapGidToItem);

    const isDraftValidForRemoval = Boolean(
      !row.validation || row.validation.valid === true
    );

    return {
      mode: "draft",
      valid: isDraftValidForRemoval,
      items,
      removedSavedItems,
      error: !isDraftValidForRemoval ? row.validation?.reason || null : null
    };
  }

  if (!storedCheck.valid) {
    return {
      mode: "baseline_invalid",
      valid: false,
      items: [],
      removedSavedItems: [],
      error: storedCheck.error || "Saved reference list could not be parsed safely."
    };
  }

  return {
    mode: "baseline",
    valid: true,
    items: storedGids.map(mapGidToItem),
    removedSavedItems: [],
    error: null
  };
}

export function BenchV2FieldCard({
  row,
  isAnyOperationBusy,
  isRefChoicesBusy,
  isCurrentRefChoicesBoundAndFresh,
  currentRefChoicesRecord,
  handleFieldEditorFocus,
  handleFieldEditorBlur,
  handleSelectPresetOption,
  handleRemoveReferenceChoiceGid = null,
  handleManualProposalChange,
  handleClearDraftProposal,
  handleAcceptAiAlternative,
  handleDismissAiAlternative,
  handleToggleApproval,
  handleToggleKeepOriginal
}) {
  const {
    contract,
    baselineObservation: obs,
    typeAndCompleteness,
    referenceEvidence,
    options,
    hasProposalKey,
    proposedValue,
    proposedDisplayValue,
    proposalSource,
    proposalOrigin,
    heldAiAlternative,
    scanProposalMeta,
    actionableScanMeta,
    validation,
    isApproved,
    isKeepOriginal,
    fidelityCheck,
    effectiveConnectionStatus,
    effectiveReviewStatus,
    effectiveStatusReason,
    plainLabel,
    readableSaved,
    canSelectKeepOriginal
  } = row;

  const isShopifyReference = contract.namespace === "shopify";
  const isListReferenceContract =
    isShopifyReference &&
    contract.expectedType === "list.metaobject_reference";
  const isNativeVariantPrice =
    contract.owner === "PRODUCTVARIANT" &&
    contract.namespace === "native" &&
    contract.destinationKey === "native_price";
  const isDecimalInputModeField =
    isNativeVariantPrice ||
    contract.expectedType === "number_decimal";
  const usesMeaningDisplay = Boolean(
    contract.usesYesNoMeaningDisplay || isShopifyReference
  );
  const isManualOnlyField = isManualOnlyNoAiDestination(
    contract.destinationKey,
    contract
  );
  const isMultilineField = contract.control === "multiline";

  const canEditDraftInBatch1 =
    contract.isWritableInBatch1 &&
    obs.evidenceAvailable &&
    (!isShopifyReference || typeAndCompleteness?.ready === true);

  const hasAvailableOptions =
    Array.isArray(options) && options.length > 0;
  const shouldRenderPresetSelect =
    contract.isWritableInBatch1 &&
    (isShopifyReference || hasAvailableOptions);

  const isRefEvidenceCompleteForRow = Boolean(
    referenceEvidence && referenceEvidence.isComplete === true
  );
  const isRefEvidenceVerifiedEmpty = Boolean(
    isRefEvidenceCompleteForRow &&
      referenceEvidence.entriesByGid instanceof Map &&
      referenceEvidence.entriesByGid.size === 0
  );

  const canSelectReferenceOptionInBatch1 = isShopifyReference
    ? Boolean(
        canEditDraftInBatch1 &&
          !isAnyOperationBusy &&
          !isRefChoicesBusy &&
          isRefEvidenceCompleteForRow &&
          hasAvailableOptions
      )
    : Boolean(
        canEditDraftInBatch1 &&
          !isAnyOperationBusy &&
          hasAvailableOptions
      );

  const canEditManualInputInBatch1 = isShopifyReference
    ? Boolean(
        canEditDraftInBatch1 &&
          isRefEvidenceCompleteForRow &&
          !isRefEvidenceVerifiedEmpty
      )
    : canEditDraftInBatch1;

  const canApproveForSave =
    contract.isWritableInBatch1 &&
    hasProposalKey &&
    Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
    fidelityCheck.faithful;

  const isCategoryIneligibleRow = Boolean(
    isShopifyReference &&
      contract.isWritableInBatch1 &&
      obs.evidenceAvailable &&
      typeAndCompleteness?.ready !== true &&
      obs.categoryEligibility?.status === "category_ineligible"
  );

  const isUnchangedStagedDraft = Boolean(
    hasProposalKey && validation?.isUnchangedFromStored === true
  );

  let rowHeaderStatusLabel = "Unchanged";
  let rowHeaderStatusColor = "#334155";
  if (isApproved) {
    rowHeaderStatusLabel =
      proposalOrigin === "Manual"
        ? "Approved to save (exact manual replacement)"
        : "Approved to save";
    rowHeaderStatusColor = "#15803d";
  } else if (isKeepOriginal) {
    rowHeaderStatusLabel = "Keeping original";
  } else if (hasProposalKey) {
    if (isUnchangedStagedDraft) {
      rowHeaderStatusLabel = "Already saved on product (no change to approve)";
    } else if (!validation?.valid || !fidelityCheck.faithful) {
      rowHeaderStatusLabel = "Blocked draft (cannot approve)";
      rowHeaderStatusColor = "#991b1b";
    } else if (proposalOrigin === "AI") {
      rowHeaderStatusLabel = "AI suggestion (unapproved)";
      rowHeaderStatusColor = "#1e3a8a";
    } else {
      rowHeaderStatusLabel = "Manual replacement staged (unapproved)";
      rowHeaderStatusColor = "#1e3a8a";
    }
  } else if (isCategoryIneligibleRow) {
    rowHeaderStatusLabel = "Ineligible for product category (write blocked)";
    rowHeaderStatusColor = "#991b1b";
  } else if (actionableScanMeta) {
    rowHeaderStatusLabel = "Unresolved AI candidate (no valid draft staged)";
    rowHeaderStatusColor =
      actionableScanMeta.tone === "error"
        ? "#991b1b"
        : actionableScanMeta.tone === "warning"
          ? "#9a3412"
          : "#334155";
  } else if (obs.evidenceAvailable && obs.presence === "present") {
    rowHeaderStatusLabel = "Already saved on product (no change to approve)";
  }

  const shortNotice = getShortPlainNotice(row, isRefChoicesBusy);
  const showSeparateActionableScanNotice = Boolean(
    contract.isWritableInBatch1 &&
      actionableScanMeta &&
      actionableScanMeta.summaryText &&
      (!shortNotice ||
        shortNotice.text !== actionableScanMeta.summaryText)
  );

  const activeReferenceSelection = isListReferenceContract
    ? inspectActiveReferenceSelectionForCard({
        row,
        isShopifyReference,
        isRefEvidenceCompleteForRow
      })
    : null;

  const hasRemoveHandlerAvailable =
    typeof handleRemoveReferenceChoiceGid === "function";

  const canTriggerIndividualReferenceRemove = Boolean(
    isListReferenceContract &&
      canEditManualInputInBatch1 &&
      !isAnyOperationBusy &&
      !isRefChoicesBusy &&
      hasRemoveHandlerAvailable &&
      activeReferenceSelection?.valid === true &&
      activeReferenceSelection.items.length > 1
  );

  let selectPlaceholderLabel = "Choose an option...";
  if (isShopifyReference) {
    if (!obs.evidenceAvailable) {
      selectPlaceholderLabel =
        "Product baseline not loaded — reload product first";
    } else if (typeAndCompleteness?.ready !== true) {
      selectPlaceholderLabel =
        obs.categoryEligibility?.status === "category_ineligible"
          ? "Ineligible for this product category (blocked)"
          : "Blocked by category or definition constraint on this product";
    } else if (isRefChoicesBusy) {
      selectPlaceholderLabel = `Loading verified Metaobject choices (${obs.restrictedMetaobjectDefinitionId || "definition"})...`;
    } else if (!referenceEvidence || !referenceEvidence.evidenceLoaded) {
      selectPlaceholderLabel =
        !isCurrentRefChoicesBoundAndFresh && currentRefChoicesRecord
          ? "Reference choices out of date — click Retry Reference Choices"
          : "Verified reference choices not loaded — click Retry Reference Choices";
    } else if (!referenceEvidence.isComplete) {
      selectPlaceholderLabel =
        "Reference choice verification incomplete — click Retry Reference Choices";
    } else if (isRefEvidenceVerifiedEmpty) {
      selectPlaceholderLabel = `0 verified Metaobject entries exist in Shopify (${obs.restrictedMetaobjectDefinitionId || "definition"})`;
    } else if (
      hasProposalKey &&
      activeReferenceSelection &&
      !activeReferenceSelection.valid
    ) {
      selectPlaceholderLabel =
        "Active draft list is invalid or empty — fix or click Reset to Saved";
    } else if (!hasAvailableOptions) {
      selectPlaceholderLabel =
        "Stored reference list invalid — inspect details before editing";
    } else {
      selectPlaceholderLabel = `Choose verified Metaobject entry (${options.length} available)...`;
    }
  }

  let inputPlaceholder = "Type proposed value...";
  if (!canEditDraftInBatch1) {
    inputPlaceholder =
      contract.owner === "PRODUCTVARIANT"
        ? "Editing locked until single-variant baseline loads"
        : isShopifyReference
          ? "Blocked by category or definition constraint on this product"
          : "Editing locked until baseline loads";
  } else if (isShopifyReference) {
    if (isRefChoicesBusy) {
      inputPlaceholder =
        "Waiting for verified Metaobject reference choices to finish loading...";
    } else if (!isRefEvidenceCompleteForRow) {
      inputPlaceholder =
        "Load or retry verified reference choices before staging a reference GID list...";
    } else if (isRefEvidenceVerifiedEmpty) {
      inputPlaceholder =
        "0 verified Metaobject entries exist in Shopify for this definition...";
    } else {
      inputPlaceholder =
        'Select a verified reference choice above or enter canonical JSON GID array (e.g. ["gid://shopify/Metaobject/..."])...';
    }
  } else if (isNativeVariantPrice) {
    inputPlaceholder = "Enter price in USD, e.g. 45.00";
  } else if (contract.destinationKey === "custom.dimensions_mm") {
    inputPlaceholder = "Enter manual measurement (e.g. 38 x 24 x 6 mm)...";
  } else if (contract.destinationKey === "custom.weight_grams") {
    inputPlaceholder = "Enter manual scale weight in grams (e.g. 14.5)...";
  }

  const showReferenceDraftHelper = Boolean(
    isShopifyReference &&
      contract.isWritableInBatch1 &&
      canEditDraftInBatch1 &&
      isRefEvidenceCompleteForRow &&
      hasAvailableOptions &&
      !hasProposalKey
  );

  let cardBorder = "1px solid #cbd5e1";
  let cardBg = "#ffffff";
  if (isApproved) {
    cardBorder = "2px solid #15803d";
    cardBg = "#f0fdf4";
  } else if (
    hasProposalKey &&
    (!validation?.valid || !fidelityCheck.faithful)
  ) {
    cardBorder = "2px solid #b45309";
    cardBg = "#fffbeb";
  } else if (hasProposalKey && !isKeepOriginal) {
    cardBorder = "2px solid #2563eb";
  }

  return (
    <div
      style={{
        backgroundColor: cardBg,
        border: cardBorder,
        borderRadius: "8px",
        padding: "16px 18px"
      }}
    >
      {/* FIELD TITLE ROW */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "12px"
        }}
      >
        <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
          {plainLabel}
          {contract.destinationKey === "custom.is_ooak" && (
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#475569",
                marginLeft: "8px"
              }}
            >
              (Second OOAK field — custom.is_ooak)
            </span>
          )}
          {contract.destinationKey === "custom.is_one_of_a_kind" && (
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "#475569",
                marginLeft: "8px"
              }}
            >
              (Primary OOAK field — custom.is_one_of_a_kind)
            </span>
          )}
          {contract.owner === "PRODUCTVARIANT" &&
            contract.isWritableInBatch1 && (
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1e3a8a",
                  marginLeft: "8px"
                }}
              >
                {isNativeVariantPrice
                  ? "(Single-Variant USD price — manual entry only, no AI price suggestions)"
                  : `(Single-Variant ${contract.destinationKey} — manual/preset)`}
              </span>
            )}
          {isShopifyReference && contract.isWritableInBatch1 && (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#0f766e",
                marginLeft: "8px"
              }}
            >
              (Standardized Reference {contract.destinationKey})
            </span>
          )}
          {isManualOnlyField &&
            contract.isWritableInBatch1 &&
            contract.owner !== "PRODUCTVARIANT" &&
            !isShopifyReference && (
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#334155",
                  marginLeft: "8px"
                }}
              >
                (Manual entry only — no AI scan)
              </span>
            )}
        </div>

        <div
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: rowHeaderStatusColor
          }}
        >
          {rowHeaderStatusLabel}
        </div>
      </div>

      {/* SAVED VS. PROPOSED SIDE-BY-SIDE */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
          gap: "16px",
          alignItems: "stretch"
        }}
      >
        {/* SAVED BOX */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #94a3b8",
            borderRadius: "6px",
            padding: "12px 14px"
          }}
        >
          <div
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#334155",
              marginBottom: "6px"
            }}
          >
            Saved
          </div>
          <div
            style={{
              fontSize: "16px",
              color:
                obs.presence === "present" ? "#0f172a" : "#475569",
              fontWeight: obs.presence === "present" ? 600 : 400,
              wordBreak: "break-word",
              whiteSpace: "pre-wrap"
            }}
          >
            {readableSaved}
          </div>
          {isShopifyReference &&
            obs.presence === "present" &&
            typeof obs.rawValue === "string" &&
            obs.rawValue.trim() !== "" && (
              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#475569",
                  wordBreak: "break-all"
                }}
              >
                Raw JSON: <code>{obs.rawValue}</code>
              </div>
            )}
        </div>

        {/* PROPOSED BOX + NEARBY APPROVAL CONTROLS */}
        <BenchV2FieldProposedEditorBox
          row={row}
          contract={contract}
          options={options}
          hasProposalKey={hasProposalKey}
          proposedValue={proposedValue}
          proposedDisplayValue={proposedDisplayValue}
          proposalSource={proposalSource}
          heldAiAlternative={heldAiAlternative}
          actionableScanMeta={actionableScanMeta}
          isApproved={isApproved}
          isKeepOriginal={isKeepOriginal}
          canSelectKeepOriginal={canSelectKeepOriginal}
          isShopifyReference={isShopifyReference}
          isListReferenceContract={isListReferenceContract}
          isDecimalInputModeField={isDecimalInputModeField}
          usesMeaningDisplay={usesMeaningDisplay}
          isManualOnlyField={isManualOnlyField}
          isMultilineField={isMultilineField}
          hasAvailableOptions={hasAvailableOptions}
          shouldRenderPresetSelect={shouldRenderPresetSelect}
          isRefEvidenceCompleteForRow={isRefEvidenceCompleteForRow}
          canSelectReferenceOptionInBatch1={canSelectReferenceOptionInBatch1}
          canEditManualInputInBatch1={canEditManualInputInBatch1}
          canApproveForSave={canApproveForSave}
          shortNotice={shortNotice}
          showSeparateActionableScanNotice={showSeparateActionableScanNotice}
          activeReferenceSelection={activeReferenceSelection}
          canTriggerIndividualReferenceRemove={canTriggerIndividualReferenceRemove}
          selectPlaceholderLabel={selectPlaceholderLabel}
          inputPlaceholder={inputPlaceholder}
          showReferenceDraftHelper={showReferenceDraftHelper}
          isAnyOperationBusy={isAnyOperationBusy}
          getShortNoticeBoxStyle={getShortNoticeBoxStyle}
          handleFieldEditorFocus={handleFieldEditorFocus}
          handleFieldEditorBlur={handleFieldEditorBlur}
          handleSelectPresetOption={handleSelectPresetOption}
          handleRemoveReferenceChoiceGid={handleRemoveReferenceChoiceGid}
          handleManualProposalChange={handleManualProposalChange}
          handleClearDraftProposal={handleClearDraftProposal}
          handleAcceptAiAlternative={handleAcceptAiAlternative}
          handleDismissAiAlternative={handleDismissAiAlternative}
          handleToggleApproval={handleToggleApproval}
          handleToggleKeepOriginal={handleToggleKeepOriginal}
        />
      </div>

      {/* ACCESSIBLE PER-FIELD TECHNICAL DETAILS DISCLOSURE */}
      <details
        style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}
      >
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          Details for {plainLabel}
        </summary>
        <div
          style={{
            ...DETAILS_PANEL_STYLE,
            padding: "10px 12px"
          }}
        >
          <div>
            <strong>Destination Key:</strong>{" "}
            <code>{contract.destinationKey}</code> ({contract.owner})
            {contract.owner === "PRODUCTVARIANT" && (
              <>
                {" "}
                | <strong>Observed Variant GID:</strong>{" "}
                <code>{obs.variantId || "none"}</code>
                {obs.variantTargetStatus
                  ? ` (${obs.variantTargetStatus})`
                  : ""}
              </>
            )}
            {isShopifyReference && (
              <>
                {" "}
                | <strong>Restricted MetaobjectDef:</strong>{" "}
                <code>
                  {obs.restrictedMetaobjectDefinitionId || "none"}
                </code>
                {obs.categoryEligibility?.status
                  ? ` (Category Eligibility: ${obs.categoryEligibility.status})`
                  : ""}
              </>
            )}
          </div>
          <div>
            <strong>Connection Status:</strong> {effectiveConnectionStatus}
          </div>
          <div>
            <strong>Review Status:</strong> {effectiveReviewStatus}
          </div>
          {hasProposalKey && (
            <div>
              <strong>Staged Draft Source:</strong>{" "}
              {proposalSource && proposalSource !== "None"
                ? proposalSource
                : "Source not reported"}{" "}
              | <strong>Exact Staged Value:</strong>{" "}
              <code>{proposedValue}</code>
            </div>
          )}
          {scanProposalMeta && (
            <div>
              <strong>Last AI Scan Suggestion:</strong> "
              {scanProposalMeta.value}" | <strong>Source:</strong>{" "}
              {typeof scanProposalMeta.source === "string" &&
              scanProposalMeta.source.trim() !== ""
                ? scanProposalMeta.source.trim()
                : "Source not reported"}{" "}
              | <strong>Outcome:</strong> {scanProposalMeta.disposition}
            </div>
          )}
          {actionableScanMeta && (
            <div>
              <strong>Unresolved AI Candidate Diagnostic:</strong>{" "}
              {actionableScanMeta.summaryText}
            </div>
          )}
          {effectiveStatusReason && (
            <div>
              <strong>Notes:</strong> {effectiveStatusReason}
            </div>
          )}
          <div>
            <strong>Allowed Type(s):</strong>{" "}
            <code>
              {(contract.allowedTypes || [contract.expectedType]).join(
                " | "
              )}
            </code>
            {contract.maxLength ? ` (max ${contract.maxLength} chars)` : ""}
          </div>
          <div>
            <strong>Observed Types:</strong> Live Definition={" "}
            <code>{obs.liveDefType || "none"}</code> | Stored={" "}
            <code>{obs.storedType || "none"}</code>
            {typeAndCompleteness?.typeEvidenceSource && (
              <>
                {" "}
                | <strong>Type Evidence Source:</strong>{" "}
                <code>{typeAndCompleteness.typeEvidenceSource}</code>
                {typeAndCompleteness.verifiedActualType
                  ? ` (Resolved Write Type: ${typeAndCompleteness.verifiedActualType})`
                  : ""}
              </>
            )}
          </div>
          <div>
            <strong>Completeness:</strong> Metafields={" "}
            {obs.metafieldsCompleteState} | Definitions={" "}
            {obs.defsCompleteState}
          </div>
          <div>
            <strong>Raw Baseline Inspection:</strong>{" "}
            <code>{formatRawBaselineValueForInspection(obs)}</code>
          </div>
          {contract.unresolvedPolicyQuestion && (
            <div style={{ marginTop: "4px", color: "#9a3412" }}>
              <strong>Policy Note:</strong>{" "}
              {contract.unresolvedPolicyQuestion}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
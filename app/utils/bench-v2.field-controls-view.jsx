// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 FIELD EDITOR & REFERENCE CONTROLS MODULE
// File: app/utils/bench-v2.field-controls-view.jsx
// ==========================================================================

import React from "react";

export function BenchV2FieldReferenceSelectionList({
  row,
  contract,
  hasProposalKey,
  isListReferenceContract,
  activeReferenceSelection,
   isRefEvidenceCompleteForRow,
  canTriggerIndividualReferenceRemove,
  handleFieldEditorFocus,
  handleFieldEditorBlur,
  handleRemoveReferenceChoiceGid
}) {
  if (!isListReferenceContract || !activeReferenceSelection) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: "10px",
        padding: "10px 12px",
        backgroundColor: activeReferenceSelection.valid
          ? "#f8fafc"
          : "#fff7ed",
        border: activeReferenceSelection.valid
          ? "1px solid #cbd5e1"
          : "1px solid #fdba74",
        borderRadius: "6px"
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: "6px"
        }}
      >
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#0f172a"
          }}
        >
          {hasProposalKey
            ? `Active Staged Selection (${activeReferenceSelection.items.length})`
            : `Current Saved Selection (${activeReferenceSelection.items.length})`}
        </div>
        {hasProposalKey && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "#1e3a8a"
            }}
          >
            Unsaved draft — use Reset to Saved or Keep Original to abandon
          </span>
        )}
      </div>

      {!activeReferenceSelection.valid ? (
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "#9a3412"
          }}
        >
          {activeReferenceSelection.error ||
            "Active draft list is invalid or empty; individual entry removal is disabled until fixed or Reset to Saved."}
        </div>
      ) : activeReferenceSelection.items.length === 0 ? (
        <div style={{ fontSize: "14px", color: "#475569" }}>
          No reference entries currently assigned. Select a verified choice above to stage an addition.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}
          >
            {activeReferenceSelection.items.map((item) => {
              const isLastEntry =
                activeReferenceSelection.items.length <= 1;
              const removeDisabled =
                !canTriggerIndividualReferenceRemove ||
                isLastEntry;

              return (
                <div
                  key={item.gid}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 10px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #94a3b8",
                    borderRadius: "6px"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "baseline",
                      gap: "6px",
                      wordBreak: "break-word"
                    }}
                  >
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 700,
                        color: "#0f172a"
                      }}
                    >
                      {item.label ||
                        (isRefEvidenceCompleteForRow
                          ? `Unverified stored entry (${item.gid})`
                          : item.gid)}
                    </span>
                    {item.label && (
                      <code
                        style={{
                          fontSize: "12px",
                          color: "#475569"
                        }}
                      >
                        ({item.gid})
                      </code>
                    )}
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: item.isSavedInBaseline
                          ? "#334155"
                          : "#1d4ed8"
                      }}
                    >
                      {item.isSavedInBaseline
                        ? "[Saved on product]"
                        : "[Added in draft]"}
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove ${item.label || item.gid} from ${contract.destinationKey}`}
                    disabled={removeDisabled}
                    onFocus={() =>
                      handleFieldEditorFocus(
                        contract.destinationKey
                      )
                    }
                    onBlur={() =>
                      handleFieldEditorBlur(
                        contract.destinationKey
                      )
                    }
                    onClick={() => {
                      if (
                        typeof handleRemoveReferenceChoiceGid ===
                        "function"
                      ) {
                        handleRemoveReferenceChoiceGid(
                          row,
                          item.gid
                        );
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "13px",
                      fontWeight: 700,
                      backgroundColor: removeDisabled
                        ? "#e2e8f0"
                        : "#fef2f2",
                      color: removeDisabled
                        ? "#64748b"
                        : "#991b1b",
                      border: removeDisabled
                        ? "1px solid #cbd5e1"
                        : "1px solid #dc2626",
                      borderRadius: "5px",
                      cursor: removeDisabled
                        ? "not-allowed"
                        : "pointer"
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>

          {activeReferenceSelection.items.length === 1 && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "13px",
                color: "#475569"
              }}
            >
              Removing the last remaining reference entry is disabled because this app's current validation and writer do not support clearing a reference list to empty.{hasProposalKey ? " To abandon unsaved draft changes, click Reset to Saved below." : " Add another verified choice first if you want to replace this entry."}
            </div>
          )}
        </>
      )}

      {activeReferenceSelection.removedSavedItems.length > 0 && (
        <div
          style={{
            marginTop: "8px",
            paddingTop: "6px",
            borderTop: "1px dashed #cbd5e1",
            fontSize: "13px",
            color: "#9a3412",
            fontWeight: 600
          }}
        >
          Staged for removal from saved list (will not be written until you check Approve and click Save):{" "}
          {activeReferenceSelection.removedSavedItems
            .map((rm) =>
              rm.label ? `${rm.label} (${rm.gid})` : rm.gid
            )
            .join(", ")}
        </div>
      )}
    </div>
  );
}

export function BenchV2FieldProposedEditorBox({
  row,
  contract,
  options,
  hasProposalKey,
  proposedValue,
  proposedDisplayValue,
  proposalSource,
  heldAiAlternative,
  actionableScanMeta,
  isApproved,
  isKeepOriginal,
  canSelectKeepOriginal,
  isShopifyReference,
  isListReferenceContract,
  isDecimalInputModeField,
  usesMeaningDisplay,
  isManualOnlyField,
  isMultilineField,
  hasAvailableOptions,
  shouldRenderPresetSelect,
  isRefEvidenceCompleteForRow,
  canSelectReferenceOptionInBatch1,
  canEditManualInputInBatch1,
  canApproveForSave,
  shortNotice,
  showSeparateActionableScanNotice,
  activeReferenceSelection,
  canTriggerIndividualReferenceRemove,
  selectPlaceholderLabel,
  inputPlaceholder,
  showReferenceDraftHelper,
  isAnyOperationBusy,
  getShortNoticeBoxStyle,
  handleFieldEditorFocus,
  handleFieldEditorBlur,
  handleSelectPresetOption,
  handleRemoveReferenceChoiceGid,
  handleManualProposalChange,
  handleClearDraftProposal,
  handleAcceptAiAlternative,
  handleDismissAiAlternative,
  handleToggleApproval,
  handleToggleKeepOriginal
}) {
  return (
    /* PROPOSED BOX + NEARBY APPROVAL CONTROLS */
    <div
      style={{
        backgroundColor: "#ffffff",
        border: "1px solid #94a3b8",
        borderRadius: "6px",
        padding: "12px 14px"
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: "8px",
          marginBottom: "6px"
        }}
      >
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#334155"
          }}
        >
          Proposed
        </span>
        {hasProposalKey && proposalSource && proposalSource !== "None" && (
          <span style={{ fontSize: "13px", color: "#475569" }}>
            Source: {proposalSource}
          </span>
        )}
      </div>

      {contract.isWritableInBatch1 ? (
        <div>
          {shouldRenderPresetSelect && (
            <select
              aria-label={`Preset options for ${contract.destinationKey}`}
              value={
                hasAvailableOptions &&
                options.some(
                  (o) =>
                    (typeof o === "object" ? o.value : o) ===
                    proposedValue
                )
                  ? proposedValue
                  : ""
              }
              disabled={!canSelectReferenceOptionInBatch1}
              onFocus={() =>
                handleFieldEditorFocus(contract.destinationKey)
              }
              onBlur={() =>
                handleFieldEditorBlur(contract.destinationKey)
              }
              onChange={(e) => {
                if (e.target.value === "") return;
                handleSelectPresetOption(row, e.target.value);
              }}
              style={{
                width: "100%",
                padding: "8px 10px",
                marginBottom: "8px",
                fontSize: "15px",
                border: "1px solid #475569",
                borderRadius: "6px",
                backgroundColor: canSelectReferenceOptionInBatch1
                  ? "#ffffff"
                  : "#f1f5f9",
                color: canSelectReferenceOptionInBatch1
                  ? "#0f172a"
                  : "#475569",
                cursor: canSelectReferenceOptionInBatch1
                  ? "pointer"
                  : "not-allowed"
              }}
            >
              <option value="">{selectPlaceholderLabel}</option>
              {hasAvailableOptions &&
                options.map((opt, idx) => {
                  const optVal =
                    typeof opt === "object"
                      ? opt.value ?? opt.label
                      : String(opt);
                  const optLabel =
                    typeof opt === "object" ? opt.label : String(opt);
                  return (
                    <option key={`${optVal}_${idx}`} value={optVal}>
                      {optLabel}
                    </option>
                  );
                })}
            </select>
          )}

          {/* REUSABLE LIST-REFERENCE SELECTION & INDIVIDUAL REMOVE TOOLS */}
          <BenchV2FieldReferenceSelectionList
            row={row}
            contract={contract}
            hasProposalKey={hasProposalKey}
            isListReferenceContract={isListReferenceContract}
            activeReferenceSelection={activeReferenceSelection}
            isRefEvidenceCompleteForRow={isRefEvidenceCompleteForRow}
            canTriggerIndividualReferenceRemove={canTriggerIndividualReferenceRemove}
            handleFieldEditorFocus={handleFieldEditorFocus}
            handleFieldEditorBlur={handleFieldEditorBlur}
            handleRemoveReferenceChoiceGid={handleRemoveReferenceChoiceGid}
          />

          <div
            style={{
              display: "flex",
              gap: "8px",
              alignItems: isMultilineField ? "flex-start" : "stretch"
            }}
          >
            {isMultilineField ? (
              <textarea
                aria-label={`Manual proposal for ${contract.destinationKey}`}
                value={proposedValue}
                disabled={!canEditManualInputInBatch1 || isAnyOperationBusy}
                placeholder={inputPlaceholder}
                rows={
                  contract.destinationKey === "native_seo_description"
                    ? 3
                    : 6
                }
                onFocus={() =>
                  handleFieldEditorFocus(contract.destinationKey)
                }
                onBlur={() =>
                  handleFieldEditorBlur(contract.destinationKey)
                }
                onChange={(e) =>
                  handleManualProposalChange(
                    contract.destinationKey,
                    e.target.value
                  )
                }
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  fontSize: "16px",
                  lineHeight: 1.5,
                  fontFamily: "inherit",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  color: "#0f172a",
                  resize: "vertical"
                }}
              />
            ) : (
              <input
                type="text"
                inputMode={isDecimalInputModeField ? "decimal" : undefined}
                aria-label={`Manual proposal for ${contract.destinationKey}`}
                value={proposedValue}
                disabled={!canEditManualInputInBatch1 || isAnyOperationBusy}
                placeholder={inputPlaceholder}
                onFocus={() =>
                  handleFieldEditorFocus(contract.destinationKey)
                }
                onBlur={() =>
                  handleFieldEditorBlur(contract.destinationKey)
                }
                onChange={(e) =>
                  handleManualProposalChange(
                    contract.destinationKey,
                    e.target.value
                  )
                }
                style={{
                  flex: 1,
                  padding: "8px 10px",
                  fontSize: "16px",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  color: "#0f172a"
                }}
              />
            )}
            {hasProposalKey && (
              <button
                type="button"
                title={
                  isListReferenceContract
                    ? "Abandon unsaved draft and restore saved baseline selection"
                    : "Clear unsaved draft proposal"
                }
                onClick={() =>
                  handleClearDraftProposal(contract.destinationKey)
                }
                disabled={isAnyOperationBusy}
                style={{
                  padding: "8px 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  backgroundColor: "#f1f5f9",
                  color: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                {isListReferenceContract ? "Reset to Saved" : "Clear"}
              </button>
            )}
          </div>

          {usesMeaningDisplay &&
            hasProposalKey &&
            proposedValue.trim() !== "" &&
            proposedDisplayValue && (
              <div
                style={{
                  fontSize: "14px",
                  color: "#334155",
                  marginTop: "6px",
                  wordBreak: "break-word"
                }}
              >
                {isShopifyReference ? (
                  <>
                    Resolved Entries:{" "}
                    <strong>{proposedDisplayValue}</strong>
                    <div
                      style={{
                        fontSize: "13px",
                        color: "#475569",
                        marginTop: "2px",
                        wordBreak: "break-all"
                      }}
                    >
                      Raw JSON: <code>{proposedValue}</code>
                    </div>
                  </>
                ) : (
                  <>
                    Meaning: <strong>{proposedDisplayValue}</strong>
                  </>
                )}
              </div>
            )}

          {showReferenceDraftHelper && (
            <div
              style={{
                marginTop: "8px",
                fontSize: "14px",
                color: "#334155"
              }}
            >
              Select a verified choice above{activeReferenceSelection && activeReferenceSelection.items.length > 1 ? " or click Remove on a saved entry" : ""} to stage a draft before{" "}
              <strong>Approve</strong> or <strong>Keep Original</strong>{" "}
              becomes available.
            </div>
          )}

          {/* HELD AI ALTERNATIVE CHOICE BOX */}
          {heldAiAlternative && !isManualOnlyField && (
            <div
              style={{
                marginTop: "10px",
                padding: "10px 12px",
                backgroundColor: "#eff6ff",
                border: "1px solid #93c5fd",
                borderRadius: "6px",
                fontSize: "14px",
                color: "#1e3a8a"
              }}
            >
              <div style={{ fontWeight: 700 }}>
                Separate AI Suggestion Available: "
                {heldAiAlternative.value}"
              </div>
              <div style={{ fontSize: "13px", marginTop: "2px" }}>
                Source:{" "}
                {typeof heldAiAlternative.source === "string" &&
                heldAiAlternative.source.trim() !== ""
                  ? heldAiAlternative.source.trim()
                  : "Source not reported"}{" "}
                (kept separate so your current draft or decision was not
                overwritten)
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  marginTop: "8px"
                }}
              >
                <button
                  type="button"
                  disabled={isAnyOperationBusy}
                  onClick={() =>
                    handleAcceptAiAlternative(contract.destinationKey)
                  }
                  style={{
                    padding: "5px 10px",
                    fontSize: "13px",
                    fontWeight: 700,
                    backgroundColor: "#1d4ed8",
                    color: "#ffffff",
                    border: "1px solid #1e3a8a",
                    borderRadius: "5px",
                    cursor: isAnyOperationBusy
                      ? "not-allowed"
                      : "pointer"
                  }}
                >
                  Use AI Suggestion
                </button>
                <button
                  type="button"
                  disabled={isAnyOperationBusy}
                  onClick={() =>
                    handleDismissAiAlternative(contract.destinationKey)
                  }
                  style={{
                    padding: "5px 10px",
                    fontSize: "13px",
                    fontWeight: 600,
                    backgroundColor: "#ffffff",
                    color: "#0f172a",
                    border: "1px solid #64748b",
                    borderRadius: "5px",
                    cursor: isAnyOperationBusy
                      ? "not-allowed"
                      : "pointer"
                  }}
                >
                  Dismiss AI Suggestion
                </button>
              </div>
            </div>
          )}

          {/* PLAIN-LANGUAGE APPROVE & KEEP ORIGINAL CONTROLS */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "18px",
              marginTop: "12px",
              paddingTop: "10px",
              borderTop: "1px solid #e2e8f0"
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "16px",
                fontWeight: isApproved ? 700 : 600,
                color: isApproved ? "#15803d" : "#0f172a",
                cursor:
                  (canApproveForSave || isApproved) &&
                  !isAnyOperationBusy
                    ? "pointer"
                    : "not-allowed",
                opacity:
                  canApproveForSave || isApproved ? 1 : 0.55
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(isApproved)}
                disabled={
                  isAnyOperationBusy ||
                  (!canApproveForSave && !isApproved)
                }
                onChange={() =>
                  handleToggleApproval(
                    contract.destinationKey,
                    Boolean(isApproved)
                  )
                }
                style={{ width: "18px", height: "18px" }}
              />
              <span>Approve</span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "16px",
                fontWeight: isKeepOriginal ? 700 : 600,
                color: "#0f172a",
                cursor:
                  (canSelectKeepOriginal || isKeepOriginal) &&
                  !isAnyOperationBusy
                    ? "pointer"
                    : "not-allowed",
                opacity:
                  canSelectKeepOriginal || isKeepOriginal ? 1 : 0.55
              }}
            >
              <input
                type="checkbox"
                checked={Boolean(isKeepOriginal)}
                disabled={
                  isAnyOperationBusy ||
                  (!canSelectKeepOriginal && !isKeepOriginal)
                }
                onChange={() =>
                  handleToggleKeepOriginal(
                    contract.destinationKey,
                    Boolean(isKeepOriginal)
                  )
                }
                style={{ width: "18px", height: "18px" }}
              />
              <span>Keep Original</span>
            </label>
          </div>
        </div>
      ) : (
        <div style={{ fontSize: "15px", color: "#475569" }}>
          {contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
            ? "Held read-only pending supported Shopify definition and writer evidence."
            : contract.writeCapability === "TASK_RESTRICTED_NO_WRITE"
              ? "Read-only baseline (shipping weight writes are task-restricted in this batch)."
              : "Read-only in this batch."}
        </div>
      )}

      {/* SHORT PLAIN-LANGUAGE VISIBLE REASON FOR HOLDS OR ERRORS */}
      {shortNotice && contract.isWritableInBatch1 && (
        <div style={getShortNoticeBoxStyle(shortNotice.tone)}>
          {shortNotice.text}
        </div>
      )}

      {/* INDEPENDENT AI CANDIDATE DIAGNOSTIC WHEN SEPARATE FROM PRIMARY DRAFT / BASELINE NOTICE */}
      {showSeparateActionableScanNotice && (
        <div style={getShortNoticeBoxStyle(actionableScanMeta.tone)}>
          {actionableScanMeta.summaryText}
        </div>
      )}
    </div>
  );
}
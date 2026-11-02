// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 DRAWERS & FIELD CARDS PRESENTATION MODULE
// File: app/utils/bench-v2.drawers-view.jsx
// ==========================================================================

import React from "react";
import {
  isManualOnlyNoAiDestination
} from "./bench-v2.contract.jsx";
import {
  PLAIN_DRAWER_TITLES,
  formatRawBaselineValueForInspection,
  getShortPlainNotice,
  getDrawerConnectionSubtitle
} from "./bench-v2.field-filters.jsx";

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

export function BenchV2DrawersView({
  activeFilter,
  setActiveFilter,
  totalVisibleFilteredRowCount,
  activeProductTitle,
  validApprovedRowsCount,
  keepOriginalRowsCount,
  visibleDrawerGroups,
  openDrawersById,
  canRetryRefChoicesForCurrentProduct,
  isAnyOperationBusy,
  currentBaseline,
  isRefChoicesBusy,
  isCurrentRefChoicesBoundAndFresh,
  currentRefChoicesRecord,
  handleToggleDrawer,
  handleLoadStandardizedReferenceChoices,
  handleFieldEditorFocus,
  handleFieldEditorBlur,
  handleSelectPresetOption,
  handleManualProposalChange,
  handleClearDraftProposal,
  handleAcceptAiAlternative,
  handleDismissAiAlternative,
  handleToggleApproval,
  handleToggleKeepOriginal
}) {
  return (
    <>
      {/* HONEST EMPTY-FILTER NOTICE WITH ONE-CLICK RETURN TO ALL */}
      {activeFilter !== "All" && totalVisibleFilteredRowCount === 0 && (
        <div
          role="status"
          style={{
            backgroundColor: "#ffffff",
            border: "2px solid #2563eb",
            borderRadius: "10px",
            padding: "20px 24px",
            marginBottom: "20px",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}
        >
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
              No fields currently match the "{activeFilter}" filter on {activeProductTitle}
            </div>
            <div style={{ fontSize: "15px", color: "#334155", marginTop: "4px" }}>
              {activeFilter === "Needs review"
                ? `All review items in this view are resolved (${validApprovedRowsCount} approved to save, ${keepOriginalRowsCount} Keep Original). Review complete does not mean saved to Shopify.`
                : "All underlying fields, drafts, approvals, and Keep Original decisions remain intact."}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveFilter("All")}
            style={{
              padding: "10px 18px",
              fontSize: "16px",
              fontWeight: 700,
              backgroundColor: "#1d4ed8",
              color: "#ffffff",
              border: "2px solid #1e3a8a",
              borderRadius: "8px",
              cursor: "pointer"
            }}
          >
            Show All Fields
          </button>
        </div>
      )}

      {/* ALL 11 DRAWERS — INITIALLY COLLAPSED, PLAIN NAMES, CLEAR EXPAND/COLLAPSE */}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {visibleDrawerGroups.map((drawer) => {
          const isOpen = Boolean(openDrawersById[drawer.drawerId]);
          const plainDrawerTitle = PLAIN_DRAWER_TITLES[drawer.drawerId] || drawer.heading;

          const drawerApprovedCount = drawer.evaluatedRows.filter(
            (r) => r.isApproved && r.fidelityCheck.faithful
          ).length;
          const drawerStagedCount = drawer.evaluatedRows.filter(
            (r) => r.hasProposalKey
          ).length;
          const drawerHeldAltCount = drawer.evaluatedRows.filter(
            (r) => Boolean(r.heldAiAlternative)
          ).length;

          const isParkedProtectedDrawer = drawer.drawerId === "parked_excluded_protected";
          const drawerSubtitleLabel = getDrawerConnectionSubtitle(drawer);

          return (
            <section
              key={drawer.drawerId}
              aria-label={plainDrawerTitle}
              style={{
                backgroundColor: "#ffffff",
                border:
                  drawer.isImplementedInBatch1 && !isParkedProtectedDrawer
                    ? "2px solid #64748b"
                    : "1px solid #94a3b8",
                borderRadius: "10px",
                overflow: "hidden"
              }}
            >
              {/* DRAWER HEADER BAR */}
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: isOpen ? "#e2e8f0" : "#ffffff",
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  borderBottom: isOpen ? "2px solid #94a3b8" : "none"
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                    {plainDrawerTitle}
                  </h2>
                  <div style={{ fontSize: "14px", color: "#334155", marginTop: "2px" }}>
                    {drawerSubtitleLabel} &bull;{" "}
                    {activeFilter === "All"
                      ? `${drawer.evaluatedRows.length} fields`
                      : `${drawer.visibleRows.length} of ${drawer.evaluatedRows.length} fields match "${activeFilter}"`}
                    {drawerStagedCount > 0 && ` • ${drawerStagedCount} staged`}
                    {drawerApprovedCount > 0 && ` • ${drawerApprovedCount} approved`}
                    {drawerHeldAltCount > 0 && ` • ${drawerHeldAltCount} AI alternative`}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  {drawer.drawerId === "standardized_attributes" &&
                    canRetryRefChoicesForCurrentProduct && (
                      <button
                        type="button"
                        onClick={handleLoadStandardizedReferenceChoices}
                        disabled={isAnyOperationBusy || !currentBaseline}
                        style={{
                          padding: "8px 14px",
                          fontSize: "15px",
                          fontWeight: 700,
                          backgroundColor:
                            isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#0f766e",
                          color:
                            isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                          border: "2px solid #115e59",
                          borderRadius: "8px",
                          cursor:
                            isAnyOperationBusy || !currentBaseline
                              ? "not-allowed"
                              : "pointer"
                        }}
                      >
                        Retry Reference Choices
                      </button>
                    )}

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => handleToggleDrawer(drawer.drawerId)}
                    style={{
                      padding: "8px 16px",
                      fontSize: "15px",
                      fontWeight: 700,
                      backgroundColor: isOpen ? "#0f172a" : "#f8fafc",
                      color: isOpen ? "#ffffff" : "#0f172a",
                      border: "2px solid #334155",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {isOpen ? "Close Drawer" : "Open Drawer"}
                  </button>
                </div>
              </div>

              {/* DRAWER BODY — VISIBLE FIELDS IN DRAWER */}
              {isOpen && (
                <div style={{ padding: "18px 20px", backgroundColor: "#f8fafc" }}>
                  {/* DRAWER 10 REFERENCE CHOICES STATUS BAR */}
                  {drawer.drawerId === "standardized_attributes" && (
                    <div
                      style={{
                        marginBottom: "16px",
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        border: "2px solid #0f766e",
                        borderRadius: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px"
                      }}
                    >
                      <div style={{ flex: "1 1 480px" }}>
                        <div style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}>
                          Standardized Reference Verification (Drawer 10)
                        </div>
                        <div style={{ fontSize: "14px", color: "#334155", marginTop: "4px" }}>
                          {isRefChoicesBusy
                            ? "Loading and verifying Metaobject reference choices from Shopify..."
                            : isCurrentRefChoicesBoundAndFresh && currentRefChoicesRecord
                              ? currentRefChoicesRecord.summary
                              : "Reference choices load automatically when the product baseline is ready."}
                        </div>
                      </div>
                      {canRetryRefChoicesForCurrentProduct && (
                        <button
                          type="button"
                          onClick={handleLoadStandardizedReferenceChoices}
                          disabled={isAnyOperationBusy || !currentBaseline}
                          style={{
                            padding: "9px 16px",
                            fontSize: "15px",
                            fontWeight: 700,
                            backgroundColor:
                              isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#0f766e",
                            color:
                              isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                            border: "2px solid #115e59",
                            borderRadius: "8px",
                            cursor:
                              isAnyOperationBusy || !currentBaseline
                                ? "not-allowed"
                                : "pointer"
                          }}
                        >
                          Retry Reference Choices
                        </button>
                      )}
                    </div>
                  )}

                  {/* PER-IMAGE NATIVE MEDIA ALT BASELINE INSPECTION IN DRAWER 9 */}
                  {drawer.drawerId === "native_seo_description_media" &&
                    Array.isArray(currentBaseline?.nativeTargets?.media?.edges) && (
                      <div
                        style={{
                          marginBottom: "16px",
                          padding: "14px 16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #94a3b8",
                          borderRadius: "8px"
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
                          Saved Photo Alt Text ({currentBaseline.nativeTargets.media.edges.length}{" "}
                          photos — Read-only in Batch 1)
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "10px"
                          }}
                        >
                          {currentBaseline.nativeTargets.media.edges.map(({ node }, idx) => (
                            <div
                              key={node.id || idx}
                              style={{
                                padding: "10px 12px",
                                backgroundColor: "#f8fafc",
                                border: "1px solid #cbd5e1",
                                borderRadius: "6px",
                                fontSize: "15px"
                              }}
                            >
                              <div style={{ fontWeight: 600 }}>Photo {idx + 1}</div>
                              <div style={{ marginTop: "4px" }}>
                                {node.alt ? (
                                  <span>{node.alt}</span>
                                ) : (
                                  <span style={{ color: "#475569" }}>Not set</span>
                                )}
                              </div>
                              <details style={{ marginTop: "6px", fontSize: "13px" }}>
                                <summary style={{ cursor: "pointer", color: "#475569" }}>
                                  Photo ID
                                </summary>
                                <code>{node.id}</code>
                              </details>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* EMPTY DRAWER FILTER STATE */}
                  {drawer.visibleRows.length === 0 ? (
                    <div
                      style={{
                        padding: "14px 16px",
                        backgroundColor: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        display: "flex",
                        flexWrap: "wrap",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        fontSize: "15px",
                        color: "#334155"
                      }}
                    >
                      <span>
                        0 fields in {plainDrawerTitle} match the "{activeFilter}" filter.
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveFilter("All")}
                        style={{
                          padding: "6px 12px",
                          fontSize: "14px",
                          fontWeight: 700,
                          backgroundColor: "#f1f5f9",
                          color: "#0f172a",
                          border: "1px solid #475569",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        Show All Fields
                      </button>
                    </div>
                  ) : (
                    /* FIELD CARDS */
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {drawer.visibleRows.map((row) => {
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

                        const canApproveForSave =
                          contract.isWritableInBatch1 &&
                          hasProposalKey &&
                          Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
                          fidelityCheck.faithful;

                        const shortNotice = getShortPlainNotice(row, isRefChoicesBusy);

                        let inputPlaceholder = "Type proposed value...";
                        if (!canEditDraftInBatch1) {
                          inputPlaceholder =
                            contract.owner === "PRODUCTVARIANT"
                              ? "Editing locked until single-variant baseline loads"
                              : isShopifyReference
                                ? "Blocked by category or definition constraint on this product"
                                : "Editing locked until baseline loads";
                        } else if (isShopifyReference) {
                          inputPlaceholder =
                            'Select a verified reference choice above or enter canonical JSON GID array (e.g. ["gid://shopify/Metaobject/..."])...';
                        } else if (contract.destinationKey === "custom.dimensions_mm") {
                          inputPlaceholder = "Enter manual measurement (e.g. 38 x 24 x 6 mm)...";
                        } else if (contract.destinationKey === "custom.weight_grams") {
                          inputPlaceholder = "Enter manual scale weight in grams (e.g. 14.5)...";
                        }

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
                            key={contract.destinationKey}
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
                                      (Single-Variant {contract.destinationKey} — manual/preset)
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

                              <div style={{ fontSize: "15px", fontWeight: 600, color: "#334155" }}>
                                {isApproved
                                  ? "Approved to save"
                                  : isKeepOriginal
                                    ? "Keeping original"
                                    : hasProposalKey
                                      ? proposalOrigin === "AI"
                                        ? "AI suggestion (unapproved)"
                                        : "Draft staged (unapproved)"
                                      : "Unchanged"}
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
                                    {Array.isArray(options) && options.length > 0 && (
                                      <select
                                        aria-label={`Preset options for ${contract.destinationKey}`}
                                        value={
                                          options.some(
                                            (o) =>
                                              (typeof o === "object" ? o.value : o) ===
                                              proposedValue
                                          )
                                            ? proposedValue
                                            : ""
                                        }
                                        disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
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
                                          backgroundColor: "#ffffff",
                                          color: "#0f172a"
                                        }}
                                      >
                                        <option value="">
                                          {isShopifyReference
                                            ? `Choose verified Metaobject entry (${options.length} available)...`
                                            : "Choose an option..."}
                                        </option>
                                        {options.map((opt, idx) => {
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
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
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
                                          aria-label={`Manual proposal for ${contract.destinationKey}`}
                                          value={proposedValue}
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
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
                                            cursor: "pointer"
                                          }}
                                        >
                                          Clear
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
                                      : "Read-only in this batch."}
                                  </div>
                                )}

                                {/* SHORT PLAIN-LANGUAGE VISIBLE REASON FOR HOLDS OR ERRORS */}
                                {shortNotice && contract.isWritableInBatch1 && (
                                  <div style={getShortNoticeBoxStyle(shortNotice.tone)}>
                                    {shortNotice.text}
                                  </div>
                                )}
                              </div>
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
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
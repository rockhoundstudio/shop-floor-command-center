// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 HEADER, PICKER & BANNERS PRESENTATION MODULE
// File: app/utils/bench-v2.header-banners-view.jsx
// ==========================================================================

import React from "react";
import {
  BENCH_V2_CONTRACT_VERSION
} from "./bench-v2.contract.jsx";
import {
  BENCH_V2_FILTER_OPTIONS
} from "./bench-v2.field-filters.jsx";
import {
  DETAILS_PANEL_STYLE
} from "./bench-v2.drawers-view.jsx";

export const BANNER_TONE_PALETTES = Object.freeze({
  error: Object.freeze({
    backgroundColor: "#fef2f2",
    border: "2px solid #b91c1c",
    color: "#7f1d1d"
  }),
  warning: Object.freeze({
    backgroundColor: "#fffbeb",
    border: "2px solid #b45309",
    color: "#78350f"
  }),
  info: Object.freeze({
    backgroundColor: "#eff6ff",
    border: "2px solid #1d4ed8",
    color: "#1e3a8a"
  }),
  successNoColor: Object.freeze({
    backgroundColor: "#f0fdf4",
    border: "2px solid #15803d"
  }),
  errorNoColor: Object.freeze({
    backgroundColor: "#fef2f2",
    border: "2px solid #b91c1c"
  })
});

export function getBannerBoxStyle(tone, padding = "16px 20px") {
  const palette = BANNER_TONE_PALETTES[tone] || BANNER_TONE_PALETTES.error;
  return {
    ...palette,
    borderRadius: "10px",
    padding,
    marginBottom: "20px"
  };
}

export const DISMISS_BTN_STYLE = Object.freeze({
  backgroundColor: "#ffffff",
  color: "#0f172a",
  border: "1px solid #475569",
  borderRadius: "6px",
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600
});

export const DRAWER_BULK_BTN_STYLE = Object.freeze({
  padding: "8px 14px",
  fontSize: "15px",
  fontWeight: 600,
  backgroundColor: "#f8fafc",
  color: "#0f172a",
  border: "1px solid #64748b",
  borderRadius: "6px",
  cursor: "pointer"
});

export const THUMBNAIL_WRAPPER_STYLE = Object.freeze({
  width: "120px",
  height: "120px",
  minWidth: "120px",
  minHeight: "120px",
  flex: "0 0 120px",
  flexShrink: 0,
  borderRadius: "8px",
  border: "2px solid #94a3b8",
  backgroundColor: "#f8fafc",
  overflow: "hidden",
  boxSizing: "border-box"
});

export const THUMBNAIL_IMG_STYLE = Object.freeze({
  width: "120px",
  height: "120px",
  minWidth: "120px",
  minHeight: "120px",
  objectFit: "cover",
  objectPosition: "center",
  display: "block"
});

export function getPagerButtonStyle(disabled) {
  return {
    padding: "8px 14px",
    fontSize: "15px",
    fontWeight: 600,
    backgroundColor: disabled ? "#e2e8f0" : "#ffffff",
    color: disabled ? "#64748b" : "#0f172a",
    border: "2px solid #64748b",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer"
  };
}

export function BenchV2HeaderAndBannersView({
  activeProductId,
  activeProductTitle,
  activeProductPieceName,
  activeProductHeadline,
  activeProductMediaItems,
  stagedProposalRowsCount,
  validApprovedRowsCount,
  keepOriginalRowsCount,
  heldAiAlternativesCount,
  totalVisibleFilteredRowCount,
  allEvaluatedRowsCount,
  isAnyOperationBusy,
  isAiScanBusy,
  isWriterBusy,
  isBaselineReloading,
  isPickerLoading,
  isRefChoicesBusy,
  currentBaseline,
  canRetryRefChoicesForCurrentProduct,
  isCurrentRefChoicesBoundAndFresh,
  searchInputText,
  setSearchInputText,
  committedSearchQuery,
  isProductPickerOpen,
  setIsProductPickerOpen,
  pickerItems,
  pickerCursorHistoryLength,
  isSelectedProductInCurrentPickerPage,
  prevPageDisabled,
  nextPageDisabled,
  proposedByProduct,
  approvalsByProduct,
  activeFilter,
  setActiveFilter,
  telemetrySyncStatus,
  hasBaselineErrors,
  selectionError,
  pickerPageError,
  loadError,
  currentRefChoicesRecord,
  currentAiScanReport,
  clientPrevalidationBanner,
  setClientPrevalidationBanner,
  lastSaveReport,
  setLastSaveReport,
  handleExplicitAiScanProduct,
  handleLoadStandardizedReferenceChoices,
  handleReloadProduct,
  handleExplicitSaveApprovedChanges,
  handleSearchFormSubmit,
  handleClearProductSearch,
  handlePreviousProductPage,
  handleNextProductPage,
  handleSelectProductGid,
  handleSetAllDrawers,
  dismissCurrentRefChoicesRecord,
  handleDismissAiScanReport
}) {
  return (
    <>
      {/* TOP SUMMARY BAR + ACCESSIBLE PRODUCT SEARCH / PICKER + 120x120 THUMBNAILS + DRAWER FILTER */}
      <header
        style={{
          backgroundColor: "#ffffff",
          border: "2px solid #94a3b8",
          borderRadius: "10px",
          padding: "20px 24px",
          marginBottom: "20px"
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 420px" }}>
            <div
              style={{
                fontSize: "14px",
                fontWeight: 700,
                color: "#15803d",
                marginBottom: "2px"
              }}
            >
              Selected Product on Bench
            </div>
            <h1
              style={{
                margin: "0 0 6px 0",
                fontSize: "24px",
                fontWeight: 700,
                wordBreak: "break-word"
              }}
            >
              {activeProductHeadline}
            </h1>
            <div style={{ fontSize: "16px", color: "#1e293b" }}>
              Drafts staged: <strong>{stagedProposalRowsCount}</strong> &nbsp;|&nbsp; Approved
              to save: <strong>{validApprovedRowsCount}</strong>
              {keepOriginalRowsCount > 0 && (
                <span>
                  {" "}
                  &nbsp;|&nbsp; Keep Original: <strong>{keepOriginalRowsCount}</strong>
                </span>
              )}
              {heldAiAlternativesCount > 0 && (
                <span>
                  {" "}
                  &nbsp;|&nbsp; AI Alternatives Held:{" "}
                  <strong>{heldAiAlternativesCount}</strong>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
            <button
              type="button"
              onClick={handleExplicitAiScanProduct}
              disabled={isAnyOperationBusy || !currentBaseline}
              style={{
                padding: "10px 18px",
                fontSize: "16px",
                fontWeight: 700,
                backgroundColor:
                  isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#1d4ed8",
                color: isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                border: "2px solid #1e3a8a",
                borderRadius: "8px",
                cursor: isAnyOperationBusy || !currentBaseline ? "not-allowed" : "pointer"
              }}
            >
              {isAiScanBusy ? "Scanning Photos with Gemini..." : "AI Scan Product"}
            </button>

            {canRetryRefChoicesForCurrentProduct && (
              <button
                type="button"
                onClick={handleLoadStandardizedReferenceChoices}
                disabled={isAnyOperationBusy || !currentBaseline}
                style={{
                  padding: "10px 18px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor:
                    isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#0f766e",
                  color: isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                  border: "2px solid #115e59",
                  borderRadius: "8px",
                  cursor: isAnyOperationBusy || !currentBaseline ? "not-allowed" : "pointer"
                }}
              >
                Retry Reference Choices
              </button>
            )}

            <button
              type="button"
              onClick={handleReloadProduct}
              disabled={isAnyOperationBusy}
              style={{
                padding: "10px 18px",
                fontSize: "16px",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "2px solid #475569",
                borderRadius: "8px",
                cursor: isAnyOperationBusy ? "not-allowed" : "pointer"
              }}
            >
              {isBaselineReloading ? "Loading..." : "Reload Product"}
            </button>

            <button
              type="button"
              onClick={handleExplicitSaveApprovedChanges}
              disabled={isAnyOperationBusy || validApprovedRowsCount === 0}
              style={{
                padding: "10px 22px",
                fontSize: "16px",
                fontWeight: 700,
                backgroundColor:
                  isAnyOperationBusy || validApprovedRowsCount === 0
                    ? "#cbd5e1"
                    : "#15803d",
                color:
                  isAnyOperationBusy || validApprovedRowsCount === 0
                    ? "#334155"
                    : "#ffffff",
                border: "2px solid #14532d",
                borderRadius: "8px",
                cursor:
                  isAnyOperationBusy || validApprovedRowsCount === 0
                    ? "not-allowed"
                    : "pointer"
              }}
            >
              {isWriterBusy
                ? "Saving..."
                : `Save Approved (${validApprovedRowsCount})`}
            </button>
          </div>
        </div>

        {/* 120px BY 120px PRODUCT THUMBNAIL STRIP NEAR PRODUCT CONTROLS */}
        <div
          aria-label="Selected Product Photos"
          style={{
            marginTop: "14px",
            paddingTop: "14px",
            borderTop: "1px solid #cbd5e1"
          }}
        >
          {!currentBaseline || currentBaseline.productId !== activeProductId ? (
            <div style={{ fontSize: "15px", color: "#475569" }}>
              Loading photos for selected product...
            </div>
          ) : activeProductMediaItems.length === 0 ? (
            <div style={{ fontSize: "15px", color: "#475569" }}>
              No product photos available on this product.
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                alignItems: "center"
              }}
            >
              {activeProductMediaItems.map((mediaItem, idx) => {
                const accessibleAlt =
                  mediaItem.alt && mediaItem.alt.trim() !== ""
                    ? mediaItem.alt.trim()
                    : `${activeProductTitle} — Photo ${idx + 1}`;
                return (
                  <div
                    key={`${activeProductId}_${mediaItem.id}_${idx}`}
                    style={THUMBNAIL_WRAPPER_STYLE}
                  >
                    <img
                      src={mediaItem.url}
                      alt={accessibleAlt}
                      title={accessibleAlt}
                      width={120}
                      height={120}
                      style={THUMBNAIL_IMG_STYLE}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ACCESSIBLE PRODUCT SEARCH & READABLE PICKER */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "16px",
            borderTop: "2px solid #cbd5e1"
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <form
              onSubmit={handleSearchFormSubmit}
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px",
                flex: "1 1 520px"
              }}
            >
              <label
                htmlFor="bench-v2-product-search-input"
                style={{ fontWeight: 700, fontSize: "17px", color: "#0f172a" }}
              >
                Find Product:
              </label>

              <input
                id="bench-v2-product-search-input"
                type="text"
                value={searchInputText}
                disabled={isAnyOperationBusy}
                placeholder="Type product or stone name, then press Enter or Search..."
                onChange={(e) => setSearchInputText(e.target.value)}
                style={{
                  flex: "1 1 260px",
                  padding: "10px 14px",
                  fontSize: "16px",
                  border: "2px solid #475569",
                  borderRadius: "8px",
                  backgroundColor: "#ffffff",
                  color: "#0f172a"
                }}
              />

              <button
                type="submit"
                disabled={isAnyOperationBusy || isPickerLoading}
                style={{
                  padding: "10px 18px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor:
                    isAnyOperationBusy || isPickerLoading ? "#cbd5e1" : "#0f172a",
                  color: isAnyOperationBusy || isPickerLoading ? "#334155" : "#ffffff",
                  border: "2px solid #0f172a",
                  borderRadius: "8px",
                  cursor:
                    isAnyOperationBusy || isPickerLoading ? "not-allowed" : "pointer"
                }}
              >
                {isPickerLoading ? "Searching..." : "Search"}
              </button>

              {(searchInputText !== "" || committedSearchQuery !== "") && (
                <button
                  type="button"
                  onClick={handleClearProductSearch}
                  disabled={isAnyOperationBusy || isPickerLoading}
                  style={{
                    padding: "10px 16px",
                    fontSize: "16px",
                    fontWeight: 600,
                    backgroundColor: "#f8fafc",
                    color: "#0f172a",
                    border: "2px solid #64748b",
                    borderRadius: "8px",
                    cursor:
                      isAnyOperationBusy || isPickerLoading ? "not-allowed" : "pointer"
                  }}
                >
                  Clear Search
                </button>
              )}
            </form>

            <button
              type="button"
              aria-expanded={isProductPickerOpen}
              onClick={() => setIsProductPickerOpen((prev) => !prev)}
              style={{
                padding: "10px 16px",
                fontSize: "16px",
                fontWeight: 700,
                backgroundColor: isProductPickerOpen ? "#334155" : "#f1f5f9",
                color: isProductPickerOpen ? "#ffffff" : "#0f172a",
                border: "2px solid #334155",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              {isProductPickerOpen
                ? "Hide Product List"
                : `Browse Product List (${pickerItems.length} on Page ${
                    pickerCursorHistoryLength + 1
                  })`}
            </button>
          </div>

          {!isSelectedProductInCurrentPickerPage && (
            <div
              style={{
                marginTop: "10px",
                padding: "10px 14px",
                backgroundColor: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: "8px",
                fontSize: "15px",
                color: "#14532d"
              }}
            >
              <strong>Currently Selected on Bench:</strong>{" "}
              {activeProductPieceName ? (
                <>
                  <strong>{activeProductPieceName}</strong> ({activeProductTitle})
                </>
              ) : (
                <strong>{activeProductTitle}</strong>
              )}{" "}
              — stays loaded while you search or browse other pages.
            </div>
          )}

          {isProductPickerOpen && (
            <div
              role="region"
              aria-label="Product Search Results"
              style={{
                marginTop: "14px",
                padding: "16px",
                backgroundColor: "#f8fafc",
                border: "2px solid #94a3b8",
                borderRadius: "10px"
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px"
                }}
              >
                <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                  {committedSearchQuery
                    ? `Search Results for "${committedSearchQuery}" (${pickerItems.length} shown on Page ${
                        pickerCursorHistoryLength + 1
                      })`
                    : `Product Inventory — Page ${pickerCursorHistoryLength + 1} (${pickerItems.length} products)`}
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={handlePreviousProductPage}
                    disabled={prevPageDisabled}
                    style={getPagerButtonStyle(prevPageDisabled)}
                  >
                    Previous 50
                  </button>

                  <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                    Page {pickerCursorHistoryLength + 1}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextProductPage}
                    disabled={nextPageDisabled}
                    style={getPagerButtonStyle(nextPageDisabled)}
                  >
                    Next 50
                  </button>
                </div>
              </div>

              {pickerItems.length === 0 ? (
                <div
                  style={{
                    padding: "18px",
                    backgroundColor: "#ffffff",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    fontSize: "16px",
                    color: "#334155"
                  }}
                >
                  No products matched{" "}
                  {committedSearchQuery ? `"${committedSearchQuery}"` : "this page"}. Click{" "}
                  <strong>Clear Search</strong> to browse all products.
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    maxHeight: "420px",
                    overflowY: "auto",
                    paddingRight: "4px"
                  }}
                >
                  {pickerItems.map((item) => {
                    const isCurrent = item.id === activeProductId;
                    const stagedCountForItem = Object.keys(
                      proposedByProduct[item.id] || {}
                    ).length;
                    const approvedCountForItem = Object.keys(
                      approvalsByProduct[item.id] || {}
                    ).length;
                    const hasDistinctPieceName = Boolean(
                      item.pieceName && item.pieceName !== item.title
                    );
                    const primaryDisplayLabel = item.pieceName || item.title;

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          padding: "12px 16px",
                          backgroundColor: isCurrent ? "#f0fdf4" : "#ffffff",
                          border: isCurrent
                            ? "2px solid #15803d"
                            : "1px solid #94a3b8",
                          borderRadius: "8px"
                        }}
                      >
                        <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                          <div
                            style={{
                              fontSize: "18px",
                              fontWeight: 700,
                              color: "#0f172a",
                              wordBreak: "break-word"
                            }}
                          >
                            {primaryDisplayLabel}
                            {isCurrent && (
                              <span
                                style={{
                                  marginLeft: "10px",
                                  fontSize: "14px",
                                  fontWeight: 700,
                                  color: "#15803d"
                                }}
                              >
                                (Selected on Bench)
                              </span>
                            )}
                            {stagedCountForItem > 0 && (
                              <span
                                style={{
                                  marginLeft: "10px",
                                  fontSize: "14px",
                                  fontWeight: 600,
                                  color: "#1d4ed8"
                                }}
                              >
                                • {stagedCountForItem} draft
                                {stagedCountForItem === 1 ? "" : "s"}
                                {approvedCountForItem > 0
                                  ? ` (${approvedCountForItem} approved)`
                                  : ""}
                              </span>
                            )}
                          </div>

                          {hasDistinctPieceName && (
                            <div
                              style={{
                                fontSize: "15px",
                                color: "#334155",
                                marginTop: "4px",
                                wordBreak: "break-word"
                              }}
                            >
                              Full Product Title: {item.title}
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={isAnyOperationBusy || isCurrent}
                          onClick={() => handleSelectProductGid(item.id)}
                          style={{
                            padding: "9px 18px",
                            fontSize: "16px",
                            fontWeight: 700,
                            backgroundColor: isCurrent
                              ? "#15803d"
                              : isAnyOperationBusy
                                ? "#cbd5e1"
                                : "#0f172a",
                            color:
                              isCurrent || !isAnyOperationBusy ? "#ffffff" : "#334155",
                            border: isCurrent
                              ? "2px solid #14532d"
                              : "2px solid #0f172a",
                            borderRadius: "8px",
                            cursor:
                              isAnyOperationBusy || isCurrent
                                ? "not-allowed"
                                : "pointer",
                            flexShrink: 0
                          }}
                        >
                          {isCurrent ? "Selected" : "Select Product"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* RESTORED TAB 3 DRAWER FILTER BAR + DRAWER EXPAND/COLLAPSE CONTROLS */}
        <div
          style={{
            marginTop: "16px",
            paddingTop: "14px",
            borderTop: "1px solid #cbd5e1",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "14px"
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "10px"
            }}
          >
            <label
              htmlFor="bench-v2-field-filter"
              style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}
            >
              Filter Fields:
            </label>

            <select
              id="bench-v2-field-filter"
              aria-label="Filter Fields"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                fontSize: "16px",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "2px solid #475569",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              {BENCH_V2_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {activeFilter !== "All" && (
              <button
                type="button"
                onClick={() => setActiveFilter("All")}
                style={{
                  padding: "8px 14px",
                  fontSize: "15px",
                  fontWeight: 700,
                  backgroundColor: "#eff6ff",
                  color: "#1e3a8a",
                  border: "2px solid #1d4ed8",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                Return to All Fields
              </button>
            )}

            <span style={{ fontSize: "15px", color: "#334155" }}>
              Showing <strong>{totalVisibleFilteredRowCount}</strong> of{" "}
              <strong>{allEvaluatedRowsCount}</strong> fields
            </span>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => handleSetAllDrawers(true)}
              style={DRAWER_BULK_BTN_STYLE}
            >
              Open All Drawers
            </button>
            <button
              type="button"
              onClick={() => handleSetAllDrawers(false)}
              style={DRAWER_BULK_BTN_STYLE}
            >
              Close All Drawers
            </button>
          </div>
        </div>

        <div
          style={{
            marginTop: "10px",
            fontSize: "15px",
            color: "#334155"
          }}
        >
          Connected fields in Drawers 1 to 8 and Drawer 10 unlock for manual edit and
          exact-value approval only when live Shopify owner/type/completeness evidence (or
          an explicit reviewed exact PRODUCT text contract on custom.*) is verified. In Drawer 5
          (Manual Measurements), <strong>Dimensions (mm)</strong> and{" "}
          <strong>Weight (grams)</strong> are manual-only, while 4 unverified measurement
          keepers stay on hold. In Drawer 7 (Geology), 12 detailed <code>custom.*</code>{" "}
          paths are connected, and legacy <code>custom.geological_era</code> is read-only. In
          Drawer 8 (Channel Attributes), <code>custom.google_product_category</code> (PRODUCT)
          and manual/preset single-variant <code>mm-google-shopping.age_group</code>,{" "}
          <code>condition</code>, and <code>gender</code> (PRODUCTVARIANT) are wired when
          single-variant readiness passes, while <code>mm-google-shopping.custom_product</code>{" "}
          remains held. In Drawer 10 (Standardized Attributes), all 18 retained{" "}
          <code>shopify.*</code> reference attributes (including{" "}
          <code>shopify.jewelry-type</code>, <code>shopify.geological-era</code>,{" "}
          <code>shopify.material</code>, and <code>shopify.color-pattern</code>) are connected
          with automatic read-only reference choice loading, product category constraint
          eligibility, and verified Metaobject definition membership.
        </div>

        <details style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>
            System and Product Details
          </summary>
          <div style={DETAILS_PANEL_STYLE}>
            <div>
              <strong>Product GID:</strong> <code>{activeProductId}</code>
            </div>
            {activeProductPieceName && (
              <div>
                <strong>Saved Piece Name (custom.piece_name):</strong>{" "}
                <code>{activeProductPieceName}</code>
              </div>
            )}
            <div>
              <strong>Category:</strong>{" "}
              {currentBaseline?.productCategory?.fullName
                ? `${currentBaseline.productCategory.fullName} (${currentBaseline.productCategory.id})`
                : "None / Unassigned"}
            </div>
            <div>
              <strong>Single-Variant Target:</strong>{" "}
              {currentBaseline?.primaryVariantId ? (
                <code>{currentBaseline.primaryVariantId}</code>
              ) : (
                <span>None ({currentBaseline?.variantTargetStatus || "unknown"})</span>
              )}{" "}
              | <strong>Variant Count:</strong>{" "}
              {currentBaseline?.variantCount !== null &&
              currentBaseline?.variantCount !== undefined
                ? String(currentBaseline.variantCount)
                : "Unknown"}
            </div>
            <div>
              <strong>Read Completeness:</strong> Product Metafields={" "}
              {String(currentBaseline?.metafieldsReadComplete)} | Product Definitions={" "}
              {String(currentBaseline?.defsReadComplete)} | Variants={" "}
              {String(currentBaseline?.variantsReadComplete)} | Variant Metafields={" "}
              {String(currentBaseline?.variantMetafieldsReadComplete)} | Variant Definitions={" "}
              {String(currentBaseline?.variantDefsReadComplete)} | Native={" "}
              {String(currentBaseline?.nativeTargets?.isComplete)}
            </div>
            <div>
              <strong>Loaded At:</strong> {currentBaseline?.loadedAt || "Not loaded"} |{" "}
              <strong>Contract:</strong> {BENCH_V2_CONTRACT_VERSION}
            </div>
            <div style={{ marginTop: "4px", paddingTop: "4px", borderTop: "1px solid #e2e8f0" }}>
              <strong>Sidekick Live Snapshot Sync:</strong>{" "}
              {telemetrySyncStatus.state === "stored"
                ? `Stored (rev ${telemetrySyncStatus.benchRevision})`
                : telemetrySyncStatus.state === "syncing"
                  ? `Syncing (rev ${telemetrySyncStatus.benchRevision})...`
                  : telemetrySyncStatus.state === "error"
                    ? `Error (${telemetrySyncStatus.errorCode || "failed"})`
                    : "Idle"}{" "}
              | <strong>Session:</strong> <code>{telemetrySyncStatus.benchSessionId}</code>
              {telemetrySyncStatus.reportId && (
                <>
                  {" "}
                  | <strong>Report ID:</strong> <code>{telemetrySyncStatus.reportId}</code>
                </>
              )}
              {telemetrySyncStatus.clientStateChangedAt && (
                <>
                  {" "}
                  | <strong>State Changed At:</strong>{" "}
                  {telemetrySyncStatus.clientStateChangedAt}
                </>
              )}
              {telemetrySyncStatus.serverReceivedAt && (
                <>
                  {" "}
                  | <strong>Server Received At:</strong>{" "}
                  {telemetrySyncStatus.serverReceivedAt}
                </>
              )}
              <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                {telemetrySyncStatus.message}
              </div>
            </div>
          </div>
        </details>
      </header>

      {/* IMPORTANT BASELINE / SELECTOR ERRORS */}
      {hasBaselineErrors && (
        <div
          role="alert"
          style={getBannerBoxStyle("error", "16px 20px")}
        >
          <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>
            Product Read Warning
          </div>
          {selectionError && <div>{selectionError}</div>}
          {pickerPageError && <div>{pickerPageError}</div>}
          {loadError && <div>{loadError}</div>}
          {Array.isArray(currentBaseline?.errors) &&
            currentBaseline.errors.map((errMsg, idx) => (
              <div key={idx} style={{ marginTop: "4px" }}>
                &bull; {errMsg}
              </div>
            ))}
        </div>
      )}

      {/* HONEST STANDARDIZED REFERENCE CHOICES STATUS BANNER */}
      {(isRefChoicesBusy || currentRefChoicesRecord) && (
        <div
          role="region"
          aria-label="Standardized Reference Choices Status"
          style={getBannerBoxStyle(
            isRefChoicesBusy
              ? "info"
              : !isCurrentRefChoicesBoundAndFresh
                ? "warning"
                : currentRefChoicesRecord.ok
                  ? "info"
                  : currentRefChoicesRecord.eligibleWithChoicesCount > 0
                    ? "warning"
                    : "error",
            "16px 20px"
          )}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px"
            }}
          >
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700 }}>
                {isRefChoicesBusy
                  ? "Loading Standardized Reference Choices..."
                  : !isCurrentRefChoicesBoundAndFresh
                    ? "Reference Choices Out of Date (Baseline Changed)"
                    : currentRefChoicesRecord.ok
                      ? "Standardized Reference Choices Loaded"
                      : currentRefChoicesRecord.eligibleWithChoicesCount > 0
                        ? "Standardized Reference Choices Partially Loaded (Some Attributes Held)"
                        : "Standardized Reference Choices Warning"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "15px", color: "#0f172a" }}>
                {isRefChoicesBusy
                  ? `Querying live Shopify Metaobject definitions and verifying allowed reference entries for ${activeProductTitle}...`
                  : !isCurrentRefChoicesBoundAndFresh
                    ? "Product baseline or category changed since reference choices were loaded."
                    : currentRefChoicesRecord.summary}
              </div>
            </div>
            {!isRefChoicesBusy && currentRefChoicesRecord && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {canRetryRefChoicesForCurrentProduct && (
                  <button
                    type="button"
                    onClick={handleLoadStandardizedReferenceChoices}
                    disabled={isAnyOperationBusy || !currentBaseline}
                    style={{
                      padding: "4px 12px",
                      fontSize: "14px",
                      fontWeight: 700,
                      backgroundColor: "#0f766e",
                      color: "#ffffff",
                      border: "1px solid #115e59",
                      borderRadius: "6px",
                      cursor: isAnyOperationBusy || !currentBaseline ? "not-allowed" : "pointer"
                    }}
                  >
                    Retry Reference Choices
                  </button>
                )}
                <button
                  type="button"
                  onClick={dismissCurrentRefChoicesRecord}
                  style={DISMISS_BTN_STYLE}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
          {!isRefChoicesBusy &&
            currentRefChoicesRecord &&
            Array.isArray(currentRefChoicesRecord.errors) &&
            currentRefChoicesRecord.errors.length > 0 && (
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px", fontSize: "14px" }}>
                {currentRefChoicesRecord.errors.map((errText, idx) => (
                  <li key={idx}>{errText}</li>
                ))}
              </ul>
            )}
        </div>
      )}

      {/* HONEST COMPACT AI SCAN REPORT BANNER */}
      {currentAiScanReport && (
        <div
          role="region"
          aria-label="AI Scan Result"
          style={getBannerBoxStyle(
            currentAiScanReport.ok ? "info" : "error",
            "16px 20px"
          )}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px"
            }}
          >
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700 }}>
                {currentAiScanReport.ok ? "AI Scan Result" : "AI Scan Error"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "15px", color: "#0f172a" }}>
                {currentAiScanReport.summary}
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismissAiScanReport}
              style={DISMISS_BTN_STYLE}
            >
              Dismiss
            </button>
          </div>

          {currentAiScanReport.diagnostics &&
            Object.keys(currentAiScanReport.diagnostics).length > 0 && (
              <div style={{ marginTop: "8px", fontSize: "14px", color: "#9a3412" }}>
                {Object.entries(currentAiScanReport.diagnostics).map(([k, msg]) => (
                  <div key={k}>
                    &bull; <strong>{k}:</strong> {String(msg)}
                  </div>
                ))}
              </div>
            )}

          {Array.isArray(currentAiScanReport.details) &&
            currentAiScanReport.details.length > 0 && (
              <details style={{ marginTop: "8px", fontSize: "14px", color: "#334155" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                  AI Scan Field Breakdown ({currentAiScanReport.details.length})
                </summary>
                <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                  {currentAiScanReport.details.map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
        </div>
      )}

      {/* ACTIONABLE PREVALIDATION / APPROVAL MESSAGE BANNER */}
      {clientPrevalidationBanner && (
        <div
          role="alert"
          style={getBannerBoxStyle(
            clientPrevalidationBanner.tone === "error" ? "error" : "warning",
            "16px 20px"
          )}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <strong style={{ fontSize: "17px" }}>{clientPrevalidationBanner.title}</strong>
            <button
              type="button"
              onClick={() => setClientPrevalidationBanner(null)}
              style={DISMISS_BTN_STYLE}
            >
              Dismiss
            </button>
          </div>
          <ul style={{ margin: "8px 0 0 0", paddingLeft: "22px", fontSize: "15px" }}>
            {clientPrevalidationBanner.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {/* SAVE RESULT BANNER */}
      {lastSaveReport && (
        <div
          role="region"
          aria-label="Last Save Result"
          style={getBannerBoxStyle(
            lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
              ? "successNoColor"
              : "errorNoColor",
            "18px 22px"
          )}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "12px"
            }}
          >
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700 }}>
                {lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                  ? `Saved and verified (${lastSaveReport.verifiedDestinations.length} field${
                      lastSaveReport.verifiedDestinations.length === 1 ? "" : "s"
                    })`
                  : "Save needs attention"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "15px" }}>{lastSaveReport.message}</div>
            </div>
            <button
              type="button"
              onClick={() => setLastSaveReport(null)}
              style={{
                ...DISMISS_BTN_STYLE,
                padding: "6px 12px"
              }}
            >
              Close
            </button>
          </div>

          {Object.keys(lastSaveReport.blockedFields || {}).length > 0 && (
            <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
              <strong>Blocked:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {Object.entries(lastSaveReport.blockedFields).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: {String(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Object.keys(lastSaveReport.unresolvedChanges || {}).length > 0 && (
            <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
              <strong>Unresolved on read-back:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {Object.entries(lastSaveReport.unresolvedChanges).map(([k, v]) => (
                  <li key={k}>
                    <code>{k}</code>: {JSON.stringify(v)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {Array.isArray(lastSaveReport.errors) && lastSaveReport.errors.length > 0 && (
            <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
              <strong>Errors:</strong>
              <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                {lastSaveReport.errors.map((errObj, i) => (
                  <li key={i}>
                    {errObj?.destination ? `[${errObj.destination}] ` : ""}
                    {errObj?.message || JSON.stringify(errObj)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details style={{ marginTop: "10px", fontSize: "14px" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              Save Technical Details
            </summary>
            <div style={{ marginTop: "6px", color: "#334155" }}>
              <div>
                <strong>Product GID:</strong> <code>{lastSaveReport.productId}</code>
                {lastSaveReport.variantTargetId && (
                  <>
                    {" "}
                    | <strong>Submitted Variant GID:</strong>{" "}
                    <code>{lastSaveReport.variantTargetId}</code>
                  </>
                )}{" "}
                | <strong>Submission ID:</strong> {lastSaveReport.submissionId} |{" "}
                <strong>Writer Status:</strong> {lastSaveReport.writerStatus} |{" "}
                <strong>Read-Back Verified:</strong> {String(lastSaveReport.readBackVerified)}
              </div>
              <div>
                <strong>Submitted:</strong>{" "}
                {lastSaveReport.submittedDestinations.join(", ") || "None"}
              </div>
              <div>
                <strong>Verified:</strong>{" "}
                {lastSaveReport.verifiedDestinations.join(", ") || "None"}
              </div>
              <div>
                <strong>Skipped:</strong> {lastSaveReport.skippedKeys.join(", ") || "None"}
              </div>
              <div>
                <strong>Unconfirmed:</strong>{" "}
                {lastSaveReport.unconfirmedDestinations.join(", ") || "None"}
              </div>
            </div>
          </details>
        </div>
      )}
    </>
  );
}
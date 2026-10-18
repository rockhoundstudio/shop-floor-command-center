import React, { useState, useEffect, useRef } from "react";
import { BlockStack, Card, Text, TextField, Button, Box, Badge } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  computeTemplateAuditCounts
} from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  buildCanonicalCandidateBundle,
  formatDisplayFieldValue
} from "../utils/meta-injector.standardized.jsx";
import {
  DESCRIPTION_REVIEW_EXCLUDED_KEYS,
  HIDDEN_CONTEXT_FIELDS,
  NATIVE_ALIAS_MAP,
  resolveConfigFieldDestination,
  isMultilineKey
} from "../utils/meta-injector.matrix-domain.jsx";
import {
  StandardizedSectionBanner,
  StandardizedProposalControl,
  StandardizedRowDiagnostics
} from "./meta-injector.standardized-review.jsx";

const formatCompactDiagPreview = (val, maxLen = 140) => {
  if (val === undefined || val === null) return "Blank (not recorded)";
  const str = String(val);
  if (str.trim() === "") return "Blank";
  const singleLine = str.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen)}… (${str.length} chars total)`;
};

export function ManifestSectionCard({
  section,
  selectedBenchId,
  data,
  approvals,
  activeFilter,
  expandedBays,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  referenceMatchFetcherState,
  pendingReferenceMatch,
  getFieldMetadata,
  matchesFilter,
  onReleasePendingReferenceMatch,
  onMatchReferenceChoices,
  onStandardizedEntrySelectionChange,
  onToggleVerifiedStandardizedEntry,
  onRepairPlanChange,
  onToggleApproval,
  onToggleBay,
  onSectionRenderedCountChange
}) {
  const [openApprovalDiagnostics, setOpenApprovalDiagnostics] = useState({});
  const lastReportedSignatureRef = useRef("");

  const hasValidSection = Boolean(data && section && Array.isArray(section.keys));
  const rawSectionKeys = hasValidSection ? section.keys : [];
  const sectionConfigFields = hasValidSection && Array.isArray(section.configFields) ? section.configFields : [];

  // Build the exact rendered row descriptor list first so UI rendering and subtotal measurements use the identical array
  const renderedRowDescriptors = hasValidSection
    ? rawSectionKeys
        .filter((k) => {
          // Always keep noncanonical hidden source context (custom.origin_story) and compatibility custom.generated_description out of normal template rows
          if (HIDDEN_CONTEXT_FIELDS.includes(k)) return false;
          if (k === "custom.generated_description") return false;

          if (DEV_SHOW_ALL_TEMPLATE_FIELDS) {
            // In DEV Show-All mode, keep native_description and all approved canonical rows visible regardless of activeFilter
            return true;
          }

          if (DESCRIPTION_REVIEW_EXCLUDED_KEYS.includes(k)) return false;
          if (activeFilter === "All") return true;
          const meta = getFieldMetadata(k, data, selectedBenchId, approvals, sectionConfigFields);
          return matchesFilter(meta);
        })
        .map((key) => {
          const meta = getFieldMetadata(key, data, selectedBenchId, approvals, sectionConfigFields);
          const isPerImageMediaRow = key.startsWith("native_image_alts_");
          const isZeroImagePlaceholderRow = key === "native_image_alt" || Boolean(meta.isImageAltCapabilityPlaceholder);
          const isDedicatedDescriptionMirrorRow = key === "native_description";
          const targetKeyForLookup = NATIVE_ALIAS_MAP[key] || key;
          const unprefixedLookup = targetKeyForLookup.replace(/^custom\./, "");

          const matchedFieldConfig =
            sectionConfigFields.find((f) => {
              if (!f) return false;
              if (isPerImageMediaRow || isZeroImagePlaceholderRow) {
                return f.key === "native_image_alt" || f.registryIdentity === "native_image_alt";
              }
              const resolvedDest = resolveConfigFieldDestination(f);
              return (
                resolvedDest === key ||
                resolvedDest === targetKeyForLookup ||
                f.key === key ||
                f.key === targetKeyForLookup ||
                f.key === unprefixedLookup
              );
            }) || null;

          return {
            key,
            meta,
            matchedFieldConfig,
            isPerImageMediaRow,
            isZeroImagePlaceholderRow,
            isDedicatedDescriptionMirrorRow
          };
        })
    : [];

  const renderedKeysList = renderedRowDescriptors.map((r) => r.key);
  const renderedMediaControlCount = renderedRowDescriptors.filter((r) => r.isPerImageMediaRow).length;
  const renderedHasZeroImagePlaceholder = renderedRowDescriptors.some((r) => r.isZeroImagePlaceholderRow);

  const sectionAuditSummary = hasValidSection
    ? computeTemplateAuditCounts(
        [{ heading: section.title, fields: sectionConfigFields }],
        {
          renderedKeysByGroup: { [section.title]: renderedKeysList },
          mediaControlCount: renderedMediaControlCount,
          hasZeroImagePlaceholder: renderedHasZeroImagePlaceholder
        }
      )
    : null;

  const groupSubtotalRecord = sectionAuditSummary?.groupSubtotals?.[0] || null;
  const logicalCapabilityCount = groupSubtotalRecord ? groupSubtotalRecord.logicalCount : sectionConfigFields.length;
  const actualRenderedRowCount = renderedRowDescriptors.length;

  useEffect(() => {
    if (!hasValidSection || typeof onSectionRenderedCountChange !== "function") return;
    const signature = JSON.stringify({
      productId: selectedBenchId || "",
      sectionTitle: section.title,
      logicalCount: logicalCapabilityCount,
      renderedCount: actualRenderedRowCount,
      renderedKeys: renderedKeysList,
      mediaControlCount: renderedMediaControlCount,
      hasZeroImagePlaceholder: renderedHasZeroImagePlaceholder
    });

    if (lastReportedSignatureRef.current === signature) return;
    lastReportedSignatureRef.current = signature;

    onSectionRenderedCountChange({
      productId: selectedBenchId || null,
      sectionTitle: section.title,
      logicalCount: logicalCapabilityCount,
      renderedCount: actualRenderedRowCount,
      renderedKeys: renderedKeysList,
      mediaControlCount: renderedMediaControlCount,
      hasZeroImagePlaceholder: renderedHasZeroImagePlaceholder
    });
  }, [
    hasValidSection,
    onSectionRenderedCountChange,
    selectedBenchId,
    section?.title,
    logicalCapabilityCount,
    actualRenderedRowCount,
    renderedKeysList,
    renderedMediaControlCount,
    renderedHasZeroImagePlaceholder
  ]);

  if (!hasValidSection) return null;

  // In normal mode, hide sections when filtered keys are empty.
  // In DEV mode, never hide a canonical template section; only skip genuinely empty non-template sections.
  if (renderedRowDescriptors.length === 0 && (!DEV_SHOW_ALL_TEMPLATE_FIELDS || sectionConfigFields.length === 0)) {
    return null;
  }

  // In DEV_SHOW_ALL_TEMPLATE_FIELDS mode, keep groups expanded unless the operator explicitly toggled the bay closed
  const isExpanded = DEV_SHOW_ALL_TEMPLATE_FIELDS
    ? (expandedBays?.[section.title] !== undefined ? Boolean(expandedBays[section.title]) : true)
    : (expandedBays?.[section.title] ?? false);

  const groupColorTone = sectionConfigFields?.[0]?.color === "success" ? "success" : undefined;

  const isStandardizedSection =
    sectionConfigFields.some((f) => f.role === "standardized_attribute") ||
    rawSectionKeys.some((k) => k.startsWith("shopify."));

  const candidateBundle = buildCanonicalCandidateBundle(standardizedCandidatesByProduct?.[selectedBenchId] || {});
  const currentSnapshot = candidateBundle.snapshot;

  const storedRefMatchForProduct = referenceMatchResultsByProduct?.[selectedBenchId];
  const validRefMatchResult =
    storedRefMatchForProduct &&
    storedRefMatchForProduct.pieceId === selectedBenchId &&
    storedRefMatchForProduct.readOnly === true &&
    storedRefMatchForProduct.intent === "resolveStandardizedCandidates" &&
    storedRefMatchForProduct.snapshot === currentSnapshot
      ? storedRefMatchForProduct
      : null;

  const productMatchStatusRecord = referenceMatchStatusByProduct?.[selectedBenchId] || null;

  const toggleApprovalDiagnostic = (key) => {
    setOpenApprovalDiagnostics((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  let mediaExpansionDetailText = "";
  if (groupSubtotalRecord?.logicalImageAltCount > 0) {
    if (renderedMediaControlCount > 0) {
      mediaExpansionDetailText = ` | Image Alt: 1 logical capability → ${renderedMediaControlCount} per-image media ${renderedMediaControlCount === 1 ? "row" : "rows"}`;
    } else if (renderedHasZeroImagePlaceholder) {
      mediaExpansionDetailText = " | Image Alt: 1 logical capability → 1 zero-image placeholder row (non-writable)";
    }
  }

  return (
    <Card padding="0">
      <div 
          onClick={() => onToggleBay(section.title)} 
          style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
      >
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <Text as="h3" variant="headingLg" fontWeight="bold" tone={groupColorTone}>
              {DEV_SHOW_ALL_TEMPLATE_FIELDS
                ? `${section.title} (${logicalCapabilityCount} logical / ${actualRenderedRowCount} rendered template ${actualRenderedRowCount === 1 ? "row" : "rows"})`
                : `${section.title} (${actualRenderedRowCount} fields)`}
            </Text>
            {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
              <Badge tone="info">DEV: Show All Template Fields</Badge>
            )}
          </div>
          {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
            <Text as="p" variant="bodySm" tone="subdued">
              {`Scope: Template rows rendered in this group (${actualRenderedRowCount}) vs. logical capabilities (${logicalCapabilityCount})${mediaExpansionDetailText}.`}
            </Text>
          )}
        </div>
        <Button variant="plain" icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
      </div>
      
      {isExpanded && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, boxSizing: "border-box" }}>
          {isStandardizedSection && (
            <StandardizedSectionBanner
              selectedBenchId={selectedBenchId}
              candidateBundle={candidateBundle}
              referenceMatchFetcherState={referenceMatchFetcherState}
              pendingReferenceMatch={pendingReferenceMatch}
              validRefMatchResult={validRefMatchResult}
              productMatchStatusRecord={productMatchStatusRecord}
              onReleasePendingMatch={onReleasePendingReferenceMatch}
              onMatchReferenceChoices={onMatchReferenceChoices}
            />
          )}

          {renderedRowDescriptors.map(({ key, meta, matchedFieldConfig, isPerImageMediaRow, isZeroImagePlaceholderRow, isDedicatedDescriptionMirrorRow }) => {
            const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";

            // In DEV mode, native_description is displayed here as an identifiable read-only audit row
            // pointing to the dedicated Description Review editor above so it does not create a competing save path.
            const isHeldReadOnly = Boolean(
              isZeroImagePlaceholderRow ||
              isDedicatedDescriptionMirrorRow ||
              meta.isImageAltCapabilityPlaceholder ||
              meta.isPendingReadOnly ||
              meta.hasContractOrOwnerHold ||
              meta.hasExplicitStorageHold ||
              meta.hasExplicitProducerHold ||
              meta.isChannelFlagReadOnly ||
              meta.isVariantMetafieldHold
            );
            
            let statusTone = undefined;
            if (meta.fieldStatus === "Optional blank") statusTone = "attention";
            if (["Required missing", "Conflict", "Degrade", "Blocked", "API Error / Blocked", "Over limit", "Failed", "Unverified proposal", "Save Conflict"].includes(meta.fieldStatus)) statusTone = "critical";
            if (meta.fieldStatus === "Manual only") statusTone = "info";
            if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") statusTone = "success";
            if (meta.fieldStatus === "Unchanged") statusTone = "new";
            if (meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, blocked") statusTone = "warning";

            const candidateMetaKey = meta.metaKey || (key.startsWith("shopify.") ? key.slice(8) : "");
            const isVisionCandidateRow = meta.isStandardizedAttribute && ALLOWED_VISION_CANDIDATE_KEYS.includes(candidateMetaKey);
            const productVisionCandidates = candidateBundle.ordered;
            const visionCandidateEntry = isVisionCandidateRow ? productVisionCandidates[candidateMetaKey] : null;

            const canApprove =
              !isZeroImagePlaceholderRow &&
              !isDedicatedDescriptionMirrorRow &&
              !meta.isImageAltCapabilityPlaceholder &&
              meta.proposalExists &&
              meta.currentVal !== meta.propVal &&
              !meta.isManualOnly &&
              !isHeldReadOnly &&
              !meta.isContentPreApproved &&
              meta.fieldStatus !== "API Error / Blocked" &&
              meta.fieldStatus !== "Save Conflict" &&
              meta.isSupported;
            const isPreApprovedDisplay =
              !isZeroImagePlaceholderRow &&
              !isDedicatedDescriptionMirrorRow &&
              meta.isContentPreApproved &&
              meta.proposalExists &&
              meta.currentVal !== meta.propVal;

            let holdModeBadgeTone = "info";
            let holdModeBadgeLabel = "Read-Only (Pending)";
            let holdPlaceholderText = "Read-only field (writes disabled)";
            let holdStatusText = "Field contract read-only (pending_read_only). Read-only display; writes disabled.";

            if (isZeroImagePlaceholderRow || meta.isImageAltCapabilityPlaceholder) {
              const placeholderMsg =
                meta.imageAltPlaceholderReason ||
                "Display placeholder for native_image_alt capability (placeholder is never a writable media target).";
              holdModeBadgeTone = "warning";
              holdModeBadgeLabel = "Read-Only (No Media Target)";
              holdPlaceholderText = placeholderMsg;
              holdStatusText = placeholderMsg;
            } else if (isDedicatedDescriptionMirrorRow) {
              holdModeBadgeTone = "info";
              holdModeBadgeLabel = "Edited in Description Review Bay";
              holdPlaceholderText = "Edited in the dedicated Description Review section above (read-only audit mirror here)";
              holdStatusText = "Visible in DEV Show-All mode to account for capability #132 (PRODUCT:native_description). Edit and approve proposals in the dedicated Description Review section above.";
            } else if (meta.isStandardizedAttribute) {
              holdModeBadgeTone = isVisionCandidateRow && visionCandidateEntry ? "warning" : "info";
              holdModeBadgeLabel = isVisionCandidateRow ? "Blocked (Awaiting Match / Ambiguous)" : "Read-Only (Pending)";
              holdPlaceholderText = "Read-only standardized attribute (writes disabled)";
              holdStatusText = meta.isVerifiedStdDest
                ? (meta.stdEvaluation?.blockReason || "Awaiting complete reference matching before unlocking proposal.")
                : "Standardized attribute (pending_read_only). Read-only display; writes disabled.";
            } else if (meta.hasExplicitStorageHold) {
              holdModeBadgeTone = "info";
              holdModeBadgeLabel = "Read-Only (Storage Unverified)";
              holdPlaceholderText = "Read-only: measurement storage/writer contract unverified (writes disabled)";
              holdStatusText = "Measurement storage/writer contract unverified. Read-only display; writes disabled.";
            } else if (meta.hasExplicitProducerHold) {
              holdModeBadgeTone = "warning";
              holdModeBadgeLabel = "Read-Only (Producer Alignment Pending)";
              holdPlaceholderText = "Read-only: producer/writer definition alignment pending (writes disabled)";
              holdStatusText = "Producer/writer definition alignment pending verification. Read-only display; writes disabled.";
            } else if (meta.isChannelFlagReadOnly) {
              holdModeBadgeTone = "info";
              holdModeBadgeLabel = "Read-Only (Channel Rule Pending)";
              holdPlaceholderText = "Read-only: channel boolean rules pending verification (writes disabled)";
              holdStatusText = "Channel boolean flag read-only pending verified rules (mm-google-shopping.custom_product). Writes disabled.";
            } else if (meta.isVariantMetafieldHold) {
              holdModeBadgeTone = "warning";
              holdModeBadgeLabel = "Read-Only (Variant Owner Hold)";
              holdPlaceholderText = "Read-only: variant-owned metafield (PRODUCTVARIANT) held from product writer";
              holdStatusText = "Variant-owned metafield (PRODUCTVARIANT) held: product-level writer route not applicable. Writes disabled.";
            }
            
            let boxBg = "#f8f9fa";
            let boxBorder = "#dee2e6";
            let textColor = "#212529";
            let statusText = "Ready for review";

            if (!meta.isSupported) {
                boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                statusText = "Connection pending.";
            } else if (isHeldReadOnly) {
                boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                statusText = holdStatusText;
            } else if (meta.reasons.includes("SEO description save connection pending.")) {
                boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                statusText = "SEO description save connection pending. Draft is staged but write is disabled.";
            } else if (meta.isManualOnly) {
                boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                statusText = "Manual only field. Excluded from automated writes.";
            } else if (meta.fieldStatus === "API Error / Blocked" || meta.fieldStatus === "Save Conflict") {
                boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
                statusText = "Previous save attempt failed API validation or read-back. Review specific error.";
            } else if (meta.isContentPreApproved && !meta.hasTechnicalBlock) {
                boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
                statusText = "Pre-approved, not saved.";
            } else if (meta.isContentPreApproved && meta.hasTechnicalBlock) {
                boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                const technicalBlockers = meta.reasons.filter(r => !["Proposed", "Category pre-approved", "Verified Geo Library", "Pre-approved by operator policy", "Native Image Alt pre-approved by policy", "Historical: Conflict (Pre-approved)", "Historical: Degrade (Pre-approved)", "Historical: Unverified proposal (Pre-approved)"].includes(r)).join(", ");
                statusText = `Pre-approved. Cannot save until field destination/type is verified or limits resolved. (${technicalBlockers})`;
            } else if (meta.isApproved && !meta.hasTechnicalBlock) {
                boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
                statusText = "Approved for exact serialized list and technically eligible. Not yet saved to Shopify.";
            } else if (meta.isApproved && meta.hasTechnicalBlock) {
                boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                statusText = "Suggestion approved. Cannot save until field destination/type is verified or limits resolved.";
            } else if (!meta.isApproved && meta.hasTechnicalBlock) {
                boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
                statusText = "Blocked by technical error. Review needed.";
            } else if (!meta.isApproved && meta.contentNeedsReview) {
                boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                statusText = meta.isVerifiedStdDest
                  ? "Exact serialized Metaobject GID list requires explicit approval before write can occur. Changing any selection invalidates approval."
                  : "Review needed to verify content explicitly before write can occur.";
            } else if (!meta.isApproved && meta.fieldStatus === "Proposed") {
                boxBg = "#e2e3e5"; boxBorder = "#d3d6d8"; textColor = "#41464c";
                statusText = "Safe suggestion. Approval optional but recorded if checked.";
            }

            let customLabel = meta.label;
            let thumbnailUrl = null;
            if (isPerImageMediaRow) {
                const id = key.replace("native_image_alts_", "");
                customLabel = `Native Image Alt (${id.split('/').pop()})`;
                thumbnailUrl = data.nativeTargets?.media?.edges?.find(e => e.node?.id === id)?.node?.preview?.image?.url;
            } else if (isZeroImagePlaceholderRow) {
                customLabel = "Native Image Alt Text (Zero-Image Capability Placeholder)";
            } else if (isDedicatedDescriptionMirrorRow) {
                customLabel = "Native Description (Audit Row — Edited in Description Review Section)";
            }

            const verifiedMapForDisplay = meta.stdEvaluation?.verifiedEntriesMap || null;
            const displayCurrentVal = formatDisplayFieldValue(meta.currentVal, meta.isStandardizedAttribute, data, verifiedMapForDisplay);
            const displayPropVal = formatDisplayFieldValue(meta.propVal, meta.isStandardizedAttribute, data, verifiedMapForDisplay);

            const applicabilityObj = meta.applicabilityState || {
              status: "Not evaluated",
              tone: "info",
              reason: "Applicability not evaluated"
            };

            // Diagnostic strip metadata derived strictly from existing field metadata, config, and manifest state
            const targetKeyForDiag = NATIVE_ALIAS_MAP[key] || key;
            const explicitMetaRecord = data?.metadata?.[key] || data?.metadata?.[targetKeyForDiag] || null;
            const explicitSourceStr =
              explicitMetaRecord && typeof explicitMetaRecord.source === "string" && explicitMetaRecord.source.trim() !== "" && explicitMetaRecord.source !== "Not reported"
                ? explicitMetaRecord.source.trim()
                : (typeof meta.source === "string" && meta.source.trim() !== "" && meta.source !== "Not reported"
                    ? meta.source.trim()
                    : "Source not recorded");
            const explicitStageStr =
              explicitMetaRecord && typeof explicitMetaRecord.stage === "string" && explicitMetaRecord.stage.trim() !== "" && explicitMetaRecord.stage !== "Not reported"
                ? explicitMetaRecord.stage.trim()
                : (typeof meta.stage === "string" && meta.stage.trim() !== "" && meta.stage !== "Not reported"
                    ? meta.stage.trim()
                    : "Stage not recorded");

            const destNamespace = matchedFieldConfig?.namespace || meta.namespace || "Not recorded";
            const destMetaKey = isPerImageMediaRow
              ? key
              : (matchedFieldConfig?.metaKey || meta.metaKey || key);
            const destIdentity = isPerImageMediaRow
              ? `MEDIAIMAGE:${key.replace("native_image_alts_", "")} (alt)`
              : (matchedFieldConfig?.registryIdentity || (destNamespace === "native" ? destMetaKey : `${destNamespace}.${destMetaKey}`));
            const destOwner = matchedFieldConfig?.registryOwner || matchedFieldConfig?.owner || meta.owner || "Not recorded";
            const destDataType = matchedFieldConfig?.type || meta.type || "Not recorded";

            const isEditableControl = Boolean(
              meta.isSupported &&
              !isHeldReadOnly &&
              !meta.isManualOnly &&
              !isZeroImagePlaceholderRow &&
              !isDedicatedDescriptionMirrorRow
            );

            const editabilitySummary = isEditableControl
              ? "Editable (Proposal input active)"
              : `Read-only (${isDedicatedDescriptionMirrorRow ? "Edited in Description Review section above" : (isZeroImagePlaceholderRow ? holdModeBadgeLabel : (meta.isManualOnly ? "Manual only" : (!meta.isSupported ? "Connection pending" : holdModeBadgeLabel)))})`;

            const holdOrBlockReasonText =
              Array.isArray(meta.reasons) && meta.reasons.length > 0
                ? meta.reasons.join(" | ")
                : (isHeldReadOnly ? holdStatusText : "None recorded");

            const evaluationEligibilitySummary = !meta.isSupported
              ? "Evaluation only: Connection pending (not eligible)"
              : isHeldReadOnly
                ? `Evaluation only: Held / Read-only (${holdModeBadgeLabel})`
                : meta.hasTechnicalBlock
                  ? "Evaluation only: Blocked by technical/contract check"
                  : !meta.proposalExists
                    ? "Evaluation only: No proposal staged"
                    : meta.currentVal === meta.propVal
                      ? "Evaluation only: Proposed value matches current value (no delta)"
                      : (meta.isApproved || meta.isContentPreApproved)
                        ? `Evaluation only: Eligible in domain evaluation (${meta.isApproved ? "Explicitly approved" : meta.preApprovalReason}) — Not yet saved or read-back verified`
                        : meta.contentNeedsReview
                          ? "Evaluation only: Awaiting explicit operator approval before write eligibility"
                          : "Evaluation only: Proposal staged (unapproved)";

            const saveReadBackEvidenceSummary =
              meta.conflictData || meta.nativeDescConflictData
                ? "Read-back mismatch recorded on previous save attempt (see conflict block above)"
                : (Array.isArray(meta.reasons) && meta.reasons.some((r) => r.includes("Backend Blocked"))
                    ? "Backend block recorded on previous save attempt"
                    : "Save / read-back verification: Not recorded in this section component");

            return (
              <Box key={key} padding="300" background={isBlank && meta.isSupported ? "bg-surface-warning" : "bg-surface"} borderColor="border" borderWidth="1" borderRadius="200">
                <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", boxSizing: "border-box", minWidth: 0 }}>
                  
                  {/* Left Panel: Labels & Metadata */}
                  <div style={{ flex: "1 1 250px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                    <BlockStack gap="100">
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                          {thumbnailUrl && (
                              <div style={{ width: "48px", height: "48px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, border: "1px solid #d2d5d8" }}>
                                  <img src={thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              </div>
                          )}
                          <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
                              <Text as="h4" variant="headingMd" fontWeight="bold">{customLabel}</Text>
                              <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{key}</Text>
                          </div>
                      </div>
                      
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                          {meta.isSupported ? (
                            <>
                              <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                              <Text as="p" variant="bodySm" tone="subdued" fontWeight="bold">
                                Applicability: <Badge tone={applicabilityObj.tone}>{applicabilityObj.status}</Badge>
                              </Text>
                              {isHeldReadOnly ? (
                                <Text as="p" variant="bodySm" tone="subdued" fontWeight="bold">
                                  Mode: <Badge tone={holdModeBadgeTone}>
                                    {holdModeBadgeLabel}
                                  </Badge>
                                </Text>
                              ) : isVisionCandidateRow ? (
                                <Text as="p" variant="bodySm" tone="subdued" fontWeight="bold">
                                  Mode: <Badge tone="success">Verified Reference Proposal Unlocked</Badge>
                                </Text>
                              ) : null}
                              <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{explicitSourceStr}</Text></Text>
                              <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{explicitStageStr}</Text></Text>
                              {Array.isArray(meta.reasons) && meta.reasons.length > 0 && (
                                <Text as="p" variant="bodySm" tone="subdued">
                                  <strong>Reason:</strong> {meta.reasons.join(" | ")}
                                </Text>
                              )}
                            </>
                          ) : (
                            <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone="info">Connection pending.</Badge></Text>
                          )}
                      </div>
                    </BlockStack>
                  </div>

                  {/* Right Panel: Current & Proposal Values */}
                  <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: "12px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                      <div style={{ padding: "12px", backgroundColor: "#f4f6f8", borderRadius: "8px", border: "1px solid #d2d5d8", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", boxSizing: "border-box" }}>
                          <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value</Text>
                          <div style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                              <Text as="p" variant="bodyLg">
                                {isZeroImagePlaceholderRow
                                  ? <span style={{ color: "#6d7175", fontStyle: "italic" }}>{holdStatusText}</span>
                                  : (displayCurrentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>)}
                              </Text>
                              {isVisionCandidateRow && meta.currentExists && (
                                <Text as="p" variant="bodySm" tone="subdued" style={{ marginTop: "4px", fontFamily: "monospace" }}>
                                  Serialized Current GIDs: {meta.currentVal}
                                </Text>
                              )}
                          </div>
                      </div>
                      
                      <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                          <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>
                            {isVisionCandidateRow ? "Bench Proposal Value (Readable Labels + Underlying Metaobject GIDs)" : "Bench Proposal Value"}
                          </Text>
                          {isVisionCandidateRow ? (
                            <StandardizedProposalControl
                              keyName={key}
                              meta={meta}
                              displayPropVal={displayPropVal}
                              visionCandidateEntry={visionCandidateEntry}
                              onSelectEntry={(...args) => {
                                if (!meta.isSupported || isHeldReadOnly || meta.isManualOnly) return;
                                if (typeof onStandardizedEntrySelectionChange === "function") {
                                  onStandardizedEntrySelectionChange(...args);
                                }
                              }}
                              onToggleEntry={(...args) => {
                                if (!meta.isSupported || isHeldReadOnly || meta.isManualOnly) return;
                                if (typeof onToggleVerifiedStandardizedEntry === "function") {
                                  onToggleVerifiedStandardizedEntry(...args);
                                }
                              }}
                            />
                          ) : (
                            <TextField
                                value={meta.isSupported ? displayPropVal : "Connection pending."}
                                onChange={(val) => {
                                  if (meta.isSupported && !isHeldReadOnly && !meta.isManualOnly && !isZeroImagePlaceholderRow && !isDedicatedDescriptionMirrorRow) {
                                    onRepairPlanChange(key, val);
                                  }
                                }}
                                autoComplete="off"
                                multiline={isMultilineKey(key, meta.control) ? 3 : undefined}
                                placeholder={
                                  isHeldReadOnly
                                    ? holdPlaceholderText
                                    : (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing"
                                        ? "Blank"
                                        : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : ""))
                                }
                                helpText={
                                  isDedicatedDescriptionMirrorRow
                                    ? holdStatusText
                                    : isZeroImagePlaceholderRow
                                      ? holdStatusText
                                      : undefined
                                }
                                disabled={!meta.isSupported || isHeldReadOnly || meta.isManualOnly}
                                readOnly={!meta.isSupported || isHeldReadOnly || meta.isManualOnly}
                            />
                          )}
                      </div>

                      {isVisionCandidateRow && (
                          <StandardizedRowDiagnostics
                            selectedBenchId={selectedBenchId}
                            candidateBundle={candidateBundle}
                            referenceMatchFetcherState={referenceMatchFetcherState}
                            pendingReferenceMatch={pendingReferenceMatch}
                            validRefMatchResult={validRefMatchResult}
                            productMatchStatusRecord={productMatchStatusRecord}
                            candidateMetaKey={candidateMetaKey}
                            meta={meta}
                            displayPropVal={displayPropVal}
                            visionCandidateEntry={visionCandidateEntry}
                          />
                      )}

                      {/* Standard Metafield Conflict Display */}
                      {meta.conflictData && (
                          <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                              <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: Field Value</Text>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px", whiteSpace: "pre-wrap", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                                  <div><strong>Expected:</strong><br/>{meta.conflictData.expected}</div>
                                  <div style={{ borderTop: "1px dashed #f5c2c7", paddingTop: "8px" }}><strong>Actual:</strong><br/>{meta.conflictData.actual}</div>
                              </div>
                          </div>
                      )}

                      {canApprove && (
                          <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                  <input
                                      type="checkbox"
                                      id={`approve-${key}`}
                                      checked={meta.isApproved || false}
                                      disabled={!canApprove || isHeldReadOnly || meta.isManualOnly}
                                      onChange={(e) => {
                                        if (!canApprove || isHeldReadOnly || meta.isManualOnly || !meta.isSupported) return;
                                        onToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked);
                                      }}
                                      style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: textColor, marginTop: "2px" }}
                                      aria-label={`Approve suggestion for ${customLabel}: ${meta.propVal}`}
                                  />
                                  <label htmlFor={`approve-${key}`} style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                      Approve this suggestion: <span style={{ fontWeight: "normal", whiteSpace: "pre-wrap" }}>{isVisionCandidateRow ? `${displayPropVal} → ${meta.propVal}` : `"${meta.propVal}"`}</span>
                                  </label>
                              </div>
                              <div style={{ marginTop: "8px", marginLeft: "36px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                  <Text as="p" tone={(!meta.isApproved && meta.hasTechnicalBlock) || (meta.isApproved && meta.hasTechnicalBlock) ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor }}>
                                      {statusText}
                                  </Text>
                              </div>
                          </div>
                      )}

                      {isPreApprovedDisplay && (
                          <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                  <Text as="p" fontWeight="bold" style={{ color: textColor }}>
                                      {meta.preApprovalReason}
                                  </Text>
                                  <Text as="p" tone={meta.hasTechnicalBlock ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor, marginTop: "4px" }}>
                                      {statusText}
                                  </Text>
                              </div>
                          </div>
                      )}

                      {/* COMPACT DEV FIELD-LEVEL DIAGNOSTIC STRIP */}
                      {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
                        <div
                          style={{
                            marginTop: "6px",
                            padding: "10px 12px",
                            backgroundColor: "#f1f5f9",
                            border: "1px solid #cbd5e1",
                            borderRadius: "6px",
                            fontSize: "12px",
                            lineHeight: "1.45",
                            color: "#1e293b",
                            wordBreak: "break-word",
                            overflowWrap: "anywhere",
                            boxSizing: "border-box"
                          }}
                        >
                          <div style={{ fontWeight: "700", marginBottom: "4px", color: "#0f172a" }}>
                            DEV FIELD DIAGNOSTIC STRIP (Evaluation Only — Not Save or Read-Back Proof)
                          </div>
                          <div>
                            <strong>Destination:</strong> <code>{destIdentity}</code> | <strong>Namespace/Key:</strong> <code>{destNamespace}.{destMetaKey}</code> | <strong>Owner:</strong> <code>{destOwner}</code> | <strong>Type:</strong> <code>{destDataType}</code>
                          </div>
                          <div>
                            <strong>Current Stored Value:</strong>{" "}
                            <code>
                              {isZeroImagePlaceholderRow
                                ? "None (zero-image capability placeholder)"
                                : (meta.currentExists ? formatCompactDiagPreview(meta.currentVal) : "Blank (not recorded)")}
                            </code>
                          </div>
                          <div>
                            <strong>Proposed / Staged Plan Value:</strong>{" "}
                            <code>
                              {isZeroImagePlaceholderRow
                                ? "Not applicable (placeholder is non-writable)"
                                : (meta.isProposed
                                    ? (meta.proposalExists ? formatCompactDiagPreview(meta.propVal) : "Empty proposal staged")
                                    : "Not recorded in repairPlan")}
                            </code>
                            {" | "}
                            <strong>Separate Manual/Draft State in Component:</strong> <code>Not tracked separately in ManifestSectionCard (edits update repairPlan directly)</code>
                          </div>
                          <div>
                            <strong>Recorded Value Source:</strong> <code>{explicitSourceStr}</code> | <strong>Recorded Stage:</strong> <code>{explicitStageStr}</code>
                          </div>
                          <div>
                            <strong>Control Mode:</strong> <code>{editabilitySummary}</code> | <strong>Hold / Block Reason:</strong> <code>{holdOrBlockReasonText}</code>
                          </div>
                          <div>
                            <strong>Evaluation Status:</strong> <code>{evaluationEligibilitySummary}</code>
                          </div>
                          <div>
                            <strong>Save / Read-Back Evidence:</strong> <code>{saveReadBackEvidenceSummary}</code>
                          </div>
                        </div>
                      )}

                      {/* APPROVAL DIAGNOSTIC BLOCK (Behind Keyboard-Accessible Disclosure, Closed by Default) */}
                      {["custom.origin_location", "custom.collection_name", "custom.collection_location"].includes(key) && (() => {
                          const isDiagOpen = Boolean(openApprovalDiagnostics[key]);
                          const blockReason = !meta.proposalExists
                            ? "No proposal"
                            : (meta.currentVal === meta.propVal)
                              ? "Values match"
                              : meta.isManualOnly
                                ? "Manual only"
                                : isHeldReadOnly
                                  ? "Held read-only"
                                  : meta.isContentPreApproved
                                    ? "Pre-approved"
                                    : (meta.fieldStatus === "API Error / Blocked")
                                      ? "API Blocked"
                                      : (meta.fieldStatus === "Save Conflict")
                                        ? "Save Conflict"
                                        : "None";
                          return (
                              <div style={{ marginTop: "8px" }}>
                                  <Button
                                      size="slim"
                                      variant="tertiary"
                                      onClick={() => toggleApprovalDiagnostic(key)}
                                      ariaExpanded={isDiagOpen}
                                  >
                                      {isDiagOpen ? "Hide Diagnostics" : "Diagnostics"}
                                  </Button>
                                  {isDiagOpen && (
                                      <div style={{ marginTop: "8px", backgroundColor: "#000", border: "2px solid #0f0", borderRadius: "4px", padding: "10px", color: "#0f0", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", userSelect: "all" }}>
                                          <strong style={{fontSize:"13px", color:"#fff"}}>APPROVAL DIAGNOSTIC</strong><br/>
                                          Key: {key} | ID: {selectedBenchId}<br/>
                                          fieldStatus: {meta.fieldStatus}<br/>
                                          proposalExists: {String(meta.proposalExists)} | isDiff: {String(meta.currentVal !== meta.propVal)}<br/>
                                          isManualOnly: {String(meta.isManualOnly)} | isHeldReadOnly: {String(isHeldReadOnly)} | isContentPreApproved: {String(meta.isContentPreApproved)} | isApproved: {String(meta.isApproved)}<br/>
                                          hasTechnicalBlock: {String(meta.hasTechnicalBlock)} | apiBlockReason: {String(meta.reasons.some(r => r.includes("Backend Blocked")))}<br/>
                                          conflictData: {String(!!meta.conflictData)} | nativeDescConflictData: {String(!!meta.nativeDescConflictData)}<br/>
                                          canApprove: {String(canApprove)} | Blocker: {blockReason}<br/>
                                          Chars: Current({meta.currentVal.length}) / Proposed({meta.propVal.length})
                                      </div>
                                  )}
                              </div>
                          );
                      })()}

                  </div>
                </div>
              </Box>
            );
          })}
        </div>
      )}
    </Card>
  );
}
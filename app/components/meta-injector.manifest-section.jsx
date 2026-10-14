import React from "react";
import { BlockStack, Card, Text, TextField, Button, Box, Badge } from "@shopify/polaris";
import { ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  buildCanonicalCandidateBundle,
  formatDisplayFieldValue
} from "../utils/meta-injector.standardized.jsx";
import {
  DESCRIPTION_REVIEW_EXCLUDED_KEYS,
  HIDDEN_CONTEXT_FIELDS,
  isMultilineKey
} from "../utils/meta-injector.matrix-domain.jsx";
import {
  StandardizedSectionBanner,
  StandardizedProposalControl,
  StandardizedRowDiagnostics
} from "./meta-injector.standardized-review.jsx";

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
  onToggleBay,
  onReleasePendingReferenceMatch,
  onMatchReferenceChoices,
  onStandardizedEntrySelectionChange,
  onToggleVerifiedStandardizedEntry,
  onRepairPlanChange,
  onToggleApproval
}) {
  if (!data || !section) return null;

  const filteredKeys = section.keys.filter(k => {
    if (HIDDEN_CONTEXT_FIELDS.includes(k)) return false;
    if (DESCRIPTION_REVIEW_EXCLUDED_KEYS.includes(k)) return false;
    
    if (activeFilter === "All") return true;
    const meta = getFieldMetadata(k, data, selectedBenchId, approvals, section.configFields);
    return matchesFilter(meta);
  });

  if (filteredKeys.length === 0) return null;
  const isExpanded = expandedBays[section.title] ?? true;
  const groupColorTone = section.configFields?.[0]?.color === "success" ? "success" : undefined;

  const isStandardizedSection =
    section.configFields?.some(f => f.role === "standardized_attribute") ||
    section.keys.some(k => k.startsWith("shopify."));

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

  return (
    <Card padding="0">
      <div 
          onClick={() => onToggleBay(section.title)} 
          style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
      >
        <div style={{ minWidth: 0 }}>
          <Text as="h3" variant="headingLg" fontWeight="bold" tone={groupColorTone}>{section.title} ({filteredKeys.length} fields)</Text>
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

          {filteredKeys.map((key) => {
            const meta = getFieldMetadata(key, data, selectedBenchId, approvals, section.configFields);
            const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";
            
            let statusTone = undefined;
            if (meta.fieldStatus === "Optional blank") statusTone = "attention";
            if (["Required missing", "Conflict", "Degrade", "Blocked", "API Error / Blocked", "Over limit", "Failed", "Unverified proposal", "Save Conflict"].includes(meta.fieldStatus)) statusTone = "critical";
            if (meta.fieldStatus === "Manual only") statusTone = "info";
            if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") statusTone = "success";
            if (meta.fieldStatus === "Unchanged") statusTone = "new";
            if (meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, blocked") statusTone = "warning";

            const canApprove = meta.proposalExists && meta.currentVal !== meta.propVal && !meta.isManualOnly && !meta.isPendingReadOnly && !meta.isContentPreApproved && meta.fieldStatus !== "API Error / Blocked" && meta.fieldStatus !== "Save Conflict" && meta.isSupported;
            const isPreApprovedDisplay = meta.isContentPreApproved && meta.proposalExists && meta.currentVal !== meta.propVal;
            
            let boxBg = "#f8f9fa";
            let boxBorder = "#dee2e6";
            let textColor = "#212529";
            let statusText = "Ready for review";

            if (!meta.isSupported) {
                boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                statusText = "Connection pending.";
            } else if (meta.isPendingReadOnly) {
                boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                statusText = meta.isVerifiedStdDest
                  ? (meta.stdEvaluation?.blockReason || "Awaiting complete reference matching before unlocking proposal.")
                  : "Standardized attribute (pending_read_only). Read-only display; writes disabled.";
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
            if (key.startsWith("native_image_alts_")) {
                const id = key.replace("native_image_alts_", "");
                customLabel = `Native Image Alt (${id.split('/').pop()})`;
                thumbnailUrl = data.nativeTargets?.media?.edges?.find(e => e.node?.id === id)?.node?.preview?.image?.url;
            }

            const verifiedMapForDisplay = meta.stdEvaluation?.verifiedEntriesMap || null;
            const displayCurrentVal = formatDisplayFieldValue(meta.currentVal, meta.isStandardizedAttribute, data, verifiedMapForDisplay);
            const displayPropVal = formatDisplayFieldValue(meta.propVal, meta.isStandardizedAttribute, data, verifiedMapForDisplay);

            const candidateMetaKey = meta.metaKey || (key.startsWith("shopify.") ? key.slice(8) : "");
            const isVisionCandidateRow = meta.isStandardizedAttribute && ALLOWED_VISION_CANDIDATE_KEYS.includes(candidateMetaKey);
            const productVisionCandidates = candidateBundle.ordered;
            const visionCandidateEntry = isVisionCandidateRow ? productVisionCandidates[candidateMetaKey] : null;

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
                              {meta.isPendingReadOnly ? (
                                <Text as="p" variant="bodySm" tone="subdued" fontWeight="bold">
                                  Mode: <Badge tone={isVisionCandidateRow && visionCandidateEntry ? "warning" : "info"}>
                                    {isVisionCandidateRow ? "Blocked (Awaiting Match / Ambiguous)" : "Read-Only (Pending)"}
                                  </Badge>
                                </Text>
                              ) : isVisionCandidateRow ? (
                                <Text as="p" variant="bodySm" tone="subdued" fontWeight="bold">
                                  Mode: <Badge tone="success">Verified Reference Proposal Unlocked</Badge>
                                </Text>
                              ) : null}
                              <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                              <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
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
                              <Text as="p" variant="bodyLg">{displayCurrentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
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
                              onSelectEntry={onStandardizedEntrySelectionChange}
                              onToggleEntry={onToggleVerifiedStandardizedEntry}
                            />
                          ) : (
                            <TextField
                                value={meta.isSupported ? displayPropVal : "Connection pending."}
                                onChange={(val) => { if (meta.isSupported && !meta.isPendingReadOnly) onRepairPlanChange(key, val) }}
                                autoComplete="off"
                                multiline={isMultilineKey(key, meta.control) ? 3 : undefined}
                                placeholder={meta.isPendingReadOnly ? "Read-only standardized attribute (writes disabled)" : (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : ""))}
                                disabled={!meta.isSupported || meta.isPendingReadOnly}
                                readOnly={!meta.isSupported || meta.isPendingReadOnly}
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
                                      onChange={(e) => onToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked)}
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

                      {/* APPROVAL DIAGNOSTIC BLOCK */}
                      {["custom.origin_location", "custom.collection_name", "custom.collection_location"].includes(key) && (() => {
                          const blockReason = !meta.proposalExists ? "No proposal" : (meta.currentVal === meta.propVal) ? "Values match" : meta.isManualOnly ? "Manual only" : meta.isContentPreApproved ? "Pre-approved" : (meta.fieldStatus === "API Error / Blocked") ? "API Blocked" : (meta.fieldStatus === "Save Conflict") ? "Save Conflict" : "None";
                          return (
                              <div style={{ marginTop: "12px", backgroundColor: "#000", border: "2px solid #0f0", borderRadius: "4px", padding: "10px", color: "#0f0", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", userSelect: "all" }}>
                                  <strong style={{fontSize:"13px", color:"#fff"}}>APPROVAL DIAGNOSTIC</strong><br/>
                                  Key: {key} | ID: {selectedBenchId}<br/>
                                  fieldStatus: {meta.fieldStatus}<br/>
                                  proposalExists: {String(meta.proposalExists)} | isDiff: {String(meta.currentVal !== meta.propVal)}<br/>
                                  isManualOnly: {String(meta.isManualOnly)} | isContentPreApproved: {String(meta.isContentPreApproved)} | isApproved: {String(meta.isApproved)}<br/>
                                  hasTechnicalBlock: {String(meta.hasTechnicalBlock)} | apiBlockReason: {String(meta.reasons.some(r => r.includes("Backend Blocked")))}<br/>
                                  conflictData: {String(!!meta.conflictData)} | nativeDescConflictData: {String(!!meta.nativeDescConflictData)}<br/>
                                  canApprove: {String(canApprove)} | Blocker: {blockReason}<br/>
                                  Chars: Current({meta.currentVal.length}) / Proposed({meta.propVal.length})
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
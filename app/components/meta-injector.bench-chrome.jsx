import React from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge } from "@shopify/polaris";
import { ClipboardIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { formatDisplayFieldValue, validArray, validObj } from "../utils/meta-injector.standardized.jsx";

export function InventorySelectionColumn({
  queueIds,
  searchQuery,
  isLoadingData,
  isExecuting,
  allFilteredSelected,
  filteredProducts,
  selectedBenchId,
  productStates,
  manifestData,
  defaultQueuedStatus,
  getStatusTone,
  onSearchChange,
  onClearSearch,
  onToggleSelectAllFiltered,
  onToggleProductSelection,
  onSelectBenchItem
}) {
  return (
    <div>
      <Card padding="300">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2" fontWeight="bold">1. Select Raw Inventory ({queueIds.length})</Text>
          
          <TextField
            value={searchQuery}
            onChange={onSearchChange}
            clearButton
            onClearButtonClick={onClearSearch}
            autoComplete="off"
            placeholder="Search inventory..."
            disabled={isLoadingData || isExecuting}
          />

          <Button 
            size="large" 
            fullWidth 
            onClick={onToggleSelectAllFiltered}
            disabled={isLoadingData || isExecuting}
          >
            {allFilteredSelected ? `Unload (${filteredProducts.length})` : `Load (${filteredProducts.length})`}
          </Button>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", height: "70vh", paddingRight: "4px", minWidth: 0 }}>
            {filteredProducts.map(p => {
              const isChecked = queueIds.includes(p.id);
              const isSelectedForBench = selectedBenchId === p.id;
              const currentStatus = productStates[p.id]?.status || defaultQueuedStatus;
              const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
              
              return (
                <div 
                  key={p.id} 
                  onClick={() => onToggleProductSelection(p.id)}
                  style={{ 
                    flexShrink: 0, 
                    border: isSelectedForBench ? "3px solid #005bd3" : "2px solid #c9cccf", 
                    borderRadius: "8px", 
                    backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                    cursor: isLoadingData || isExecuting ? "not-allowed" : "pointer", 
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    minWidth: 0
                  }} 
                >
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                    <div style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
                      {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    </div>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <Text as="p" variant="bodyLg" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                      <div style={{ marginTop: "4px" }}>
                        <Badge tone={getStatusTone(currentStatus)} size="medium">{currentStatus}</Badge>
                      </div>
                    </div>
                  </div>

                  <Button 
                    size="medium" 
                    fullWidth
                    variant={isSelectedForBench ? "primary" : "secondary"}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (manifestData[p.id]) onSelectBenchItem(p.id);
                      else alert("Hit GENERATE REPAIR PLAN (Load Data) first to fetch this item's live data.");
                    }}
                  >
                    View Manifest on Bench
                  </Button>
                </div>
              );
            })}
          </div>
        </BlockStack>
      </Card>
    </div>
  );
}

export function BenchDiagnosticHeader({
  data,
  stats,
  statusObj,
  history,
  onCollectTelemetry
}) {
  if (!data) return null;

  return (
    <Card padding="400">
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <Text variant="headingLg" as="h3">Diagnostic Header</Text>
          <InlineStack gap="300">
            <Button size="large" onClick={() => onCollectTelemetry('review')}>
              Copy review telemetry
            </Button>
            <Button size="large" variant="primary" icon={ClipboardIcon} onClick={() => onCollectTelemetry('full')}>
              Copy full report
            </Button>
          </InlineStack>
        </InlineStack>
        
        {data.diagnostics?.altValidationErrors && data.diagnostics.altValidationErrors.length > 0 && (
            <Banner tone="warning" title="Vision Alt Validation Errors">
                <BlockStack gap="100">
                    {data.diagnostics.altValidationErrors.map((err, i) => (
                        <Text key={i} as="p" variant="bodyMd">{err}</Text>
                    ))}
                </BlockStack>
            </Banner>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          
          <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
            <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <Text as="p" variant="headingSm" tone="subdued">System Status</Text>
              <BlockStack gap="100" align="start">
                <Text as="p" fontWeight="bold">Shopify Read: <Badge tone={statusObj.shopifyReadStatus === "Success" ? "success" : (statusObj.shopifyReadStatus === "Running" ? "magic" : "critical")}>{statusObj.shopifyReadStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Gemini API: <Badge tone={statusObj.geminiStatus === "Running" ? "magic" : "info"}>{statusObj.geminiStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Vision API: <Badge tone={statusObj.visionStatus === "Running" ? "magic" : "info"}>{statusObj.visionStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Geo Library: <Badge tone="info">{statusObj.geoLibraryStatus}</Badge></Text>
                <Text as="p" fontWeight="bold">Read-back: <Badge tone={statusObj.readBackStatus === "Success" ? "success" : (statusObj.readBackStatus === "Failed" ? "critical" : "info")}>{statusObj.readBackStatus}</Badge></Text>
              </BlockStack>
            </div>
          </Box>

          <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
            <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <Text as="p" variant="headingSm" tone="subdued">Repair Engine</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Proposed changes: {stats.proposed}</Text>
                <Text as="p" fontWeight="bold" color="critical">Blocked changes: {stats.blocked}</Text>
                <Text as="p" fontWeight="bold" color="critical">Degraded fields: {stats.degraded}</Text>
                <Text as="p" fontWeight="bold" color="critical">Conflicts: {stats.conflicts}</Text>
                <Text as="p" fontWeight="bold" color="attention">Unverified proposals: {stats.unverified}</Text>
                <Text as="p" fontWeight="bold" tone="subdued">Manual exclusions: {stats.manualOnly}</Text>
                <Text as="p" fontWeight="bold" tone="subdued">Unchanged w/ flags: {stats.unchangedFlagged}</Text>
                <Text as="p" fontWeight="bold" color="success">Fields approved for write: {stats.approvedWrite}</Text>
              </BlockStack>
            </div>
          </Box>

          <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
            <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
              <Text as="p" variant="headingSm" tone="subdued">Field Metrics</Text>
              <BlockStack gap="100">
                <Text as="p" fontWeight="bold">Total Fields: {stats.total}</Text>
                <Text as="p" fontWeight="bold">Filled: <span style={{ color: "#22c55e" }}>{stats.filled}</span></Text>
                <Text as="p" fontWeight="bold">Optional blanks: <span style={{ color: "#eab308" }}>{stats.optionalBlanks}</span></Text>
                <Text as="p" fontWeight="bold" color="critical">Required missing fields: {stats.requiredMissing}</Text>
                <Text as="p" fontWeight="bold">Fields Updated: {data.fieldsUpdated !== undefined ? data.fieldsUpdated : "Not reported"}</Text>
              </BlockStack>
            </div>
          </Box>

        </div>

        {history && (
          <Card padding="300" background="bg-surface-secondary">
            <BlockStack gap="200">
               <Text as="h4" variant="headingSm" tone="subdued">Last Repair Results</Text>
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                 <BlockStack gap="100">
                   <Text as="p" variant="bodySm"><strong>Time:</strong> {new Date(history.completedAt).toLocaleTimeString()}</Text>
                   <Text as="p" variant="bodySm"><strong>Status:</strong> {history.status}</Text>
                   <Text as="p" variant="bodySm"><strong>Message:</strong> {history.message}</Text>
                 </BlockStack>
                 <BlockStack gap="100">
                   <Text as="p" variant="bodySm"><strong>Updated:</strong> {history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not reported"}</Text>
                   <Text as="p" variant="bodySm"><strong>Verified Destinations:</strong> {validArray(history.verifiedDestinations).length}</Text>
                   <Text as="p" variant="bodySm"><strong>Blocked:</strong> {Object.keys(validObj(history.blockedFields)).length}</Text>
                 </BlockStack>
                 <BlockStack gap="100">
                   <Text as="p" variant="bodySm"><strong>Conflicts:</strong> {Object.keys(validObj(history.conflicts)).length}</Text>
                   <Text as="p" variant="bodySm"><strong>Unresolved:</strong> {Object.keys(validObj(history.unresolvedChanges)).length}</Text>
                   <Text as="p" variant="bodySm"><strong>Unsupported:</strong> {validArray(history.unsupportedKeys).length}</Text>
                   <Text as="p" variant="bodySm"><strong>Read-Back:</strong> {history.readBackVerified !== undefined ? (history.readBackVerified ? "Verified" : "Failed") : "Not reported"}</Text>
                 </BlockStack>
               </div>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Card>
  );
}

export function DescriptionReviewSection({
  selectedBenchId,
  data,
  meta,
  customDescMeta,
  expandedBays,
  matchesFilter,
  isMultilineKey,
  onToggleBay,
  onRepairPlanChange,
  onToggleApproval
}) {
  if (!data || !meta || !customDescMeta) return null;

  const key = "native_description";

  if (!matchesFilter(meta) && !matchesFilter(customDescMeta)) return null;

  const sectionTitle = "Description Review";
  const isExpanded = expandedBays[sectionTitle] ?? true;
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
      statusText = "Standardized attribute (pending_read_only). Read-only display; writes disabled.";
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
      statusText = "Approved and technically eligible.";
  } else if (meta.isApproved && meta.hasTechnicalBlock) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      statusText = "Suggestion approved. Cannot save until field destination/type is verified or limits resolved.";
  } else if (!meta.isApproved && meta.hasTechnicalBlock) {
      boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
      statusText = "Blocked by technical error. Review needed.";
  } else if (!meta.isApproved && meta.contentNeedsReview) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      statusText = "Review needed to verify content explicitly before write can occur.";
  } else if (!meta.isApproved && meta.fieldStatus === "Proposed") {
      boxBg = "#e2e3e5"; boxBorder = "#d3d6d8"; textColor = "#41464c";
      statusText = "Safe suggestion. Approval optional but recorded if checked.";
  }

  const displayCurrentVal = formatDisplayFieldValue(meta.currentVal, meta.isStandardizedAttribute, data);
  const displayPropVal = formatDisplayFieldValue(meta.propVal, meta.isStandardizedAttribute, data);

  return (
    <Card padding="0" key={sectionTitle}>
      <div 
          onClick={() => onToggleBay(sectionTitle)} 
          style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
      >
        <div style={{ minWidth: 0 }}>
          <Text as="h3" variant="headingLg" fontWeight="bold">{sectionTitle}</Text>
        </div>
        <Button variant="plain" icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
      </div>

      {isExpanded && (
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, boxSizing: "border-box" }}>
          <Box padding="300" background={isBlank && meta.isSupported ? "bg-surface-warning" : "bg-surface"} borderColor="border" borderWidth="1" borderRadius="200">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", boxSizing: "border-box", minWidth: 0 }}>
              
              {/* Left Panel: Labels & Metadata */}
              <div style={{ flex: "1 1 250px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                <BlockStack gap="100">
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                      <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
                          <Text as="h4" variant="headingMd" fontWeight="bold">{meta.label}</Text>
                          <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">native_description → custom.generated_description</Text>
                      </div>
                  </div>
                  
                  <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                      {meta.isSupported ? (
                        <>
                          <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                          <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                          <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
                          <Text as="p" variant="bodySm" tone="subdued">Metafield Status: {customDescMeta.fieldStatus} ({customDescMeta.currentVal.length} chars)</Text>
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
                      <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value (Native Description)</Text>
                      <div style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                          <Text as="p" variant="bodyLg">{displayCurrentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
                      </div>
                  </div>
                  
                  <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                      <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Bench Proposal Value</Text>
                      <TextField
                          value={meta.isSupported ? displayPropVal : "Connection pending."}
                          onChange={(val) => { if (meta.isSupported && !meta.isPendingReadOnly) onRepairPlanChange(key, val) }}
                          autoComplete="off"
                          multiline={isMultilineKey("custom.generated_description", meta.control) ? 6 : 3}
                          placeholder={meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : "")}
                          disabled={!meta.isSupported || meta.isPendingReadOnly}
                          readOnly={!meta.isSupported || meta.isPendingReadOnly}
                      />
                  </div>

                  {meta.nativeDescConflictData && (
                      <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: Native product descriptionHtml</Text>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                              <div><strong>Status:</strong> {meta.fieldStatus} | <strong>Approved:</strong> {meta.isApproved ? "Yes" : "No"}</div>
                              <div><strong>Expected Length:</strong> {String(meta.nativeDescConflictData.expected || "").length} chars | <strong>Actual Read-Back Length:</strong> {String(meta.nativeDescConflictData.actual || "").length} chars</div>
                          </div>
                      </div>
                  )}

                  {meta.conflictData && (
                      <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: custom.generated_description Metafield</Text>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                              <div><strong>Status:</strong> {customDescMeta.fieldStatus} | <strong>Approved:</strong> {meta.isApproved ? "Yes" : "No"}</div>
                              <div><strong>Expected Length:</strong> {String(meta.conflictData.expected || "").length} chars | <strong>Actual Read-Back Length:</strong> {String(meta.conflictData.actual || "").length} chars</div>
                          </div>
                      </div>
                  )}

                  {canApprove && (
                      <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
                              <input
                                  type="checkbox"
                                  id="approve-custom.generated_description"
                                  checked={meta.isApproved || false}
                                  onChange={(e) => onToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked)}
                                  style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: textColor, marginTop: "2px" }}
                                  aria-label={`Approve description proposal (${meta.propVal.length} characters)`}
                              />
                              <label htmlFor="approve-custom.generated_description" style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                  Approve description proposal <span style={{ fontWeight: "normal" }}>(Status: {meta.fieldStatus} | Approval: {meta.isApproved ? "Approved" : "Pending"} | Current: {meta.currentVal.length} chars → Proposed: {meta.propVal.length} chars)</span>
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
                  {(() => {
                      const blockReason = !meta.proposalExists ? "No proposal" : (meta.currentVal === meta.propVal) ? "Values match" : meta.isManualOnly ? "Manual only" : meta.isContentPreApproved ? "Pre-approved" : (meta.fieldStatus === "API Error / Blocked") ? "API Blocked" : (meta.fieldStatus === "Save Conflict") ? "Save Conflict" : "None";
                      return (
                          <div style={{ marginTop: "12px", backgroundColor: "#000", border: "2px solid #0f0", borderRadius: "4px", padding: "10px", color: "#0f0", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", userSelect: "all" }}>
                              <strong style={{fontSize:"13px", color:"#fff"}}>APPROVAL DIAGNOSTIC</strong><br/>
                              Key: custom.generated_description (Native Baseline: native_description) | ID: {selectedBenchId}<br/>
                              fieldStatus: {meta.fieldStatus} | metafieldStatus: {customDescMeta.fieldStatus}<br/>
                              proposalExists: {String(meta.proposalExists)} | isDiff: {String(meta.currentVal !== meta.propVal)}<br/>
                              isManualOnly: {String(meta.isManualOnly)} | isContentPreApproved: {String(meta.isContentPreApproved)} | isApproved: {String(meta.isApproved)}<br/>
                              hasTechnicalBlock: {String(meta.hasTechnicalBlock)} | apiBlockReason: {String(meta.reasons.some(r => r.includes("Backend Blocked")))}<br/>
                              conflictData: {String(!!meta.conflictData)} | nativeDescConflictData: {String(!!meta.nativeDescConflictData)}<br/>
                              canApprove: {String(canApprove)} | Blocker: {blockReason}<br/>
                              Chars: NativeCurrent({meta.currentVal.length}) / MetafieldCurrent({customDescMeta.currentVal.length}) / Proposed({meta.propVal.length})
                          </div>
                      );
                  })()}

              </div>
            </div>
          </Box>
        </div>
      )}
    </Card>
  );
}
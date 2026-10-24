import React, { useState } from "react";
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
                    disabled={isLoadingData || isExecuting}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (!isLoadingData && !isExecuting) onSelectBenchItem(p.id);
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
  selectedBenchId,
  data,
  stats,
  statusObj,
  history,
  telemetryPacket = null,
  onCollectTelemetry,
  onCopyTelemetryPart,
  onDownloadTelemetry
}) {
  if (!data) return null;

  const activeProductId = selectedBenchId || data?.nativeTargets?.productId || data?.productId || null;
  const hasMatchingCapturedPacket = Boolean(
    telemetryPacket &&
    typeof telemetryPacket === "object" &&
    Array.isArray(telemetryPacket.parts) &&
    telemetryPacket.parts.length > 0 &&
    (!activeProductId || telemetryPacket.productId === activeProductId)
  );

  const capturedParts = hasMatchingCapturedPacket ? telemetryPacket.parts : [];
  const totalCapturedParts = capturedParts.length;
  const canCopyCapturedParts = hasMatchingCapturedPacket && typeof onCopyTelemetryPart === "function";
  const canDownloadCapturedReport =
    hasMatchingCapturedPacket &&
    typeof telemetryPacket.fullText === "string" &&
    telemetryPacket.fullText.length > 0 &&
    typeof onDownloadTelemetry === "function";

  return (
    <Card padding="400">
      <BlockStack gap="400">
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingLg" as="h3">Diagnostic Header</Text>
            <InlineStack gap="300">
              <Button
                size="large"
                onClick={() => onCollectTelemetry && onCollectTelemetry("review")}
                aria-label="Capture Review Report snapshot and copy Part 1 to clipboard"
              >
                Capture Review Report
              </Button>
              <Button
                size="large"
                variant="primary"
                icon={ClipboardIcon}
                onClick={() => onCollectTelemetry && onCollectTelemetry("full")}
                aria-label="Capture Full Report snapshot and copy Part 1 to clipboard"
              >
                Capture Full Report
              </Button>
            </InlineStack>
          </InlineStack>
          <Text as="p" variant="bodySm" tone="subdued">
            Capturing creates a frozen report snapshot for this product and copies Part 1 to your clipboard. When a report spans multiple parts, use the numbered Copy Part X of N buttons below to copy the remaining parts from that same snapshot without rebuilding it.
          </Text>
        </BlockStack>

        {hasMatchingCapturedPacket && (
          <Box padding="300" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                  <Text as="h4" variant="headingSm" fontWeight="bold">
                    Captured Telemetry Snapshot: {telemetryPacket.sectionLabel || "Telemetry Report"} ({totalCapturedParts} {totalCapturedParts === 1 ? "Part" : "Parts"})
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Captured: {telemetryPacket.capturedAt || "Recorded"} | Run: {telemetryPacket.runIdentity || "Not recorded"} | Part 1 was copied on capture; use the buttons below to copy any part from this exact snapshot without regenerating.
                  </Text>
                </div>
                {canDownloadCapturedReport && (
                  <Button
                    size="large"
                    variant="secondary"
                    onClick={() => onDownloadTelemetry(telemetryPacket)}
                    aria-label="Download the existing captured report snapshot as a text file"
                  >
                    Download Captured Report
                  </Button>
                )}
              </InlineStack>

              {canCopyCapturedParts && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", minWidth: 0 }}>
                  {capturedParts.map((part, arrayIdx) => {
                    const partNum = arrayIdx + 1;
                    const isActivePart = telemetryPacket.activePartIndex === arrayIdx;
                    return (
                      <Button
                        key={`telemetry-part-${arrayIdx}`}
                        size="large"
                        variant={isActivePart ? "primary" : "secondary"}
                        icon={ClipboardIcon}
                        onClick={() => onCopyTelemetryPart(arrayIdx)}
                        aria-label={`Copy Part ${partNum} of ${totalCapturedParts} from captured snapshot${typeof part?.charCount === "number" ? ` (${part.charCount} characters)` : ""}`}
                      >
                        {`Copy Part ${partNum} of ${totalCapturedParts}`}
                      </Button>
                    );
                  })}
                </div>
              )}
            </BlockStack>
          </Box>
        )}
        
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
                {stats.keepOriginal !== undefined && (
                  <Text as="p" fontWeight="bold" tone="subdued">Keep original (rejected): {stats.keepOriginal}</Text>
                )}
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
  keepOriginal = {},
  activeFilter = "All",
  expandedBays,
  matchesFilter,
  isMultilineKey,
  onToggleBay,
  onRepairPlanChange,
  onToggleApproval,
  onToggleKeepOriginal
}) {
  const [diagOpen, setDiagOpen] = useState(false);

  if (!data || !meta || !customDescMeta) return null;

  const key = "native_description";
  const customKey = "custom.generated_description";

  // Honor activeFilter / matchesFilter for both native_description and custom.generated_description
  // while keeping All always visible so original and rejected suggestions can be inspected.
  if (
    activeFilter !== "All" &&
    typeof matchesFilter === "function" &&
    !matchesFilter(meta) &&
    !matchesFilter(customDescMeta)
  ) {
    return null;
  }

  const sectionTitle = "Description Review";
  // Collapsed by default unless explicitly opened in expandedBays
  const isExpanded = Boolean(expandedBays?.[sectionTitle]);
  const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";

  const getStatusBadgeTone = (fieldStatus) => {
    if (fieldStatus === "Optional blank") return "attention";
    if (
      [
        "Required missing",
        "Conflict",
        "Degrade",
        "Blocked",
        "API Error / Blocked",
        "Over limit",
        "Failed",
        "Unverified proposal",
        "Save Conflict"
      ].includes(fieldStatus)
    ) {
      return "critical";
    }
    if (fieldStatus === "Manual only" || fieldStatus === "Keep original (suggestion rejected)") {
      return "info";
    }
    if (
      fieldStatus === "Proposed" ||
      fieldStatus === "Approved, not saved" ||
      fieldStatus === "Pre-approved, not saved"
    ) {
      return "success";
    }
    if (fieldStatus === "Unchanged") return "new";
    if (fieldStatus === "Approved, blocked" || fieldStatus === "Pre-approved, blocked") {
      return "warning";
    }
    return undefined;
  };

  const statusTone = getStatusBadgeTone(meta.fieldStatus);
  const customStatusTone = getStatusBadgeTone(customDescMeta.fieldStatus);

  const isHeldReadOnly = Boolean(
    meta.isPendingReadOnly ||
    meta.hasContractOrOwnerHold ||
    meta.hasExplicitStorageHold ||
    meta.hasExplicitProducerHold ||
    meta.isChannelFlagReadOnly ||
    meta.isVariantMetafieldHold
  );

  const canApprove =
    meta.proposalExists &&
    meta.currentVal !== meta.propVal &&
    !meta.isManualOnly &&
    !isHeldReadOnly &&
    !meta.isContentPreApproved &&
    meta.fieldStatus !== "API Error / Blocked" &&
    meta.fieldStatus !== "Save Conflict" &&
    meta.isSupported;

  const canKeepOriginal = Boolean(meta.canKeepOriginal);
  const showNativeDecisionBox = canApprove || canKeepOriginal;

  const isPreApprovedDisplay =
    !meta.isKeepOriginalSelected &&
    meta.isContentPreApproved &&
    meta.proposalExists &&
    meta.currentVal !== meta.propVal;

  // Destination-isolated companion controls for custom.generated_description (compatibility metafield)
  const isCustomHeldReadOnly = Boolean(
    customDescMeta.isPendingReadOnly ||
    customDescMeta.hasContractOrOwnerHold ||
    customDescMeta.hasExplicitStorageHold ||
    customDescMeta.hasExplicitProducerHold ||
    customDescMeta.isChannelFlagReadOnly ||
    customDescMeta.isVariantMetafieldHold
  );

  const canApproveCustom =
    customDescMeta.proposalExists &&
    customDescMeta.currentVal !== customDescMeta.propVal &&
    !customDescMeta.isManualOnly &&
    !isCustomHeldReadOnly &&
    !customDescMeta.isContentPreApproved &&
    customDescMeta.fieldStatus !== "API Error / Blocked" &&
    customDescMeta.fieldStatus !== "Save Conflict" &&
    customDescMeta.isSupported;

  const canKeepOriginalCustom = Boolean(customDescMeta.canKeepOriginal);
  const showCustomDecisionControls =
    canApproveCustom ||
    canKeepOriginalCustom ||
    Boolean(customDescMeta.isApproved) ||
    Boolean(customDescMeta.isKeepOriginalSelected);

  let boxBg = "#f8f9fa";
  let boxBorder = "#dee2e6";
  let textColor = "#212529";
  let statusText = "Ready for review";

  if (!meta.isSupported) {
      boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
      statusText = "Connection pending.";
  } else if (isHeldReadOnly) {
      boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
      statusText = "Read-only display; writes disabled.";
  } else if (meta.reasons.includes("SEO description save connection pending.")) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      statusText = "SEO description save connection pending. Draft is staged but write is disabled.";
  } else if (meta.isManualOnly) {
      boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
      statusText = "Manual only field. Excluded from automated writes.";
  } else if (meta.fieldStatus === "API Error / Blocked" || meta.fieldStatus === "Save Conflict") {
      boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
      statusText = "Previous save attempt failed API validation or read-back. Review specific error.";
  } else if (meta.isKeepOriginalSelected) {
      boxBg = "#cff4fc"; boxBorder = "#9eeaf9"; textColor = "#055160";
      statusText = "Original saved native_description retained. Suggestion is rejected as non-submitted review data and omitted from the save payload.";
  } else if (meta.isContentPreApproved && !meta.hasTechnicalBlock) {
      boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
      statusText = "Pre-approved, not saved.";
  } else if (meta.isContentPreApproved && meta.hasTechnicalBlock) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      const technicalBlockers = meta.reasons.filter(r => !["Proposed", "Category pre-approved", "Verified Geo Library", "Pre-approved by operator policy", "Native Image Alt pre-approved by policy", "Historical: Conflict (Pre-approved)", "Historical: Degrade (Pre-approved)", "Historical: Unverified proposal (Pre-approved)"].includes(r)).join(", ");
      statusText = `Pre-approved. Cannot save until field destination/type is verified or limits resolved. (${technicalBlockers})`;
  } else if (meta.isApproved && !meta.hasTechnicalBlock) {
      boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
      statusText = "Approved for native_description and technically eligible. Not yet saved to Shopify.";
  } else if (meta.isApproved && meta.hasTechnicalBlock) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      statusText = "Suggestion approved. Cannot save until field destination/type is verified or limits resolved.";
  } else if (!meta.isApproved && meta.hasTechnicalBlock) {
      boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
      statusText = "Blocked by technical error. Review needed.";
  } else if (!meta.isApproved && meta.contentNeedsReview) {
      boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
      statusText = "Review needed: approve description proposal to write to native_description, or select 'Use original saved value' to keep the current stored baseline.";
  } else if (!meta.isApproved && meta.fieldStatus === "Proposed") {
      boxBg = "#e2e3e5"; boxBorder = "#d3d6d8"; textColor = "#41464c";
      statusText = "Safe suggestion. Approval optional, or select 'Use original saved value' to reject suggestion.";
  }

  const displayCurrentVal = formatDisplayFieldValue(meta.currentVal, meta.isStandardizedAttribute, data);
  const displayPropVal = formatDisplayFieldValue(meta.propVal, meta.isStandardizedAttribute, data);

  const buildBaselineOriginalSummary = (targetMeta) => {
    const bd = targetMeta?.baselineDescriptor;
    if (!bd || !bd.evidenceAvailable) return "Unavailable";
    if (!bd.propertyPresent) return "Absent / Blank in Shopify (no write will be sent)";
    if (bd.rawValue === "") return 'Empty string "" (retained without write)';
    return `${targetMeta.currentVal.length} chars stored (retained without write)`;
  };

  const nativeBaselineSummaryLabel = buildBaselineOriginalSummary(meta);
  const customBaselineSummaryLabel = buildBaselineOriginalSummary(customDescMeta);

  return (
    <Card padding="0" key={sectionTitle}>
      <div 
          onClick={() => onToggleBay(sectionTitle)} 
          style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
      >
        <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Text as="h3" variant="headingLg" fontWeight="bold">{sectionTitle}</Text>
          <Badge tone={statusTone}>{meta.fieldStatus}</Badge>
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
                          <Text as="p" variant="bodyMd" fontWeight="bold">Native Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                          <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                          <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            Metafield Status (<code>custom.generated_description</code>): <Badge tone={customStatusTone}>{customDescMeta.fieldStatus}</Badge> ({customDescMeta.currentVal.length} chars)
                          </Text>
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
                      <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value (Native Description)</Text>
                      <div style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                          <Text as="p" variant="bodyLg">{displayCurrentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
                      </div>
                  </div>
                  
                  <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                      <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Bench Proposal Value</Text>
                      <TextField
                          value={meta.isSupported ? displayPropVal : "Connection pending."}
                          onChange={(val) => { if (meta.isSupported && !isHeldReadOnly && !meta.isManualOnly) onRepairPlanChange(key, val); }}
                          autoComplete="off"
                          multiline={isMultilineKey("custom.generated_description", meta.control) ? 6 : 3}
                          placeholder={meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : "")}
                          disabled={!meta.isSupported || isHeldReadOnly || meta.isManualOnly}
                          readOnly={!meta.isSupported || isHeldReadOnly || meta.isManualOnly}
                      />
                  </div>

                  {meta.nativeDescConflictData && (
                      <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: Native product descriptionHtml</Text>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                              <div><strong>Status:</strong> {meta.fieldStatus} | <strong>Approved:</strong> {meta.isApproved ? "Yes" : "No"} | <strong>Keep Original:</strong> {meta.isKeepOriginalSelected ? "Yes" : "No"}</div>
                              <div><strong>Expected Length:</strong> {String(meta.nativeDescConflictData.expected || "").length} chars | <strong>Actual Read-Back Length:</strong> {String(meta.nativeDescConflictData.actual || "").length} chars</div>
                          </div>
                      </div>
                  )}

                  {(meta.conflictData || customDescMeta.conflictData) && (() => {
                      const customConflictObj = customDescMeta.conflictData || meta.conflictData;
                      return (
                        <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                            <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: custom.generated_description Metafield</Text>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                                <div><strong>Status:</strong> {customDescMeta.fieldStatus} | <strong>Approved:</strong> {customDescMeta.isApproved ? "Yes" : "No"} | <strong>Keep Original:</strong> {customDescMeta.isKeepOriginalSelected ? "Yes" : "No"}</div>
                                <div><strong>Expected Length:</strong> {String(customConflictObj.expected || "").length} chars | <strong>Actual Read-Back Length:</strong> {String(customConflictObj.actual || "").length} chars</div>
                            </div>
                        </div>
                      );
                  })()}

                  {showNativeDecisionBox && (
                      <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0, boxSizing: "border-box" }}>
                              {canApprove && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                      <input
                                          type="checkbox"
                                          id="approve-native_description"
                                          checked={Boolean(meta.isApproved)}
                                          disabled={!canApprove || isHeldReadOnly || meta.isManualOnly}
                                          onChange={(e) => {
                                            if (!canApprove || isHeldReadOnly || meta.isManualOnly || !meta.isSupported) return;
                                            onToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked);
                                          }}
                                          style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: textColor, marginTop: "2px" }}
                                          aria-label={`Approve description proposal for native_description (${meta.propVal.length} characters)`}
                                      />
                                      <label htmlFor="approve-native_description" style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                          Approve description proposal (<code>native_description</code>) <span style={{ fontWeight: "normal" }}>(Status: {meta.fieldStatus} | Approval: {meta.isApproved ? "Approved" : "Pending"} | Current: {meta.currentVal.length} chars → Proposed: {meta.propVal.length} chars)</span>
                                      </label>
                                  </div>
                              )}

                              {canKeepOriginal && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box", borderTop: canApprove ? `1px dashed ${boxBorder}` : "none", paddingTop: canApprove ? "10px" : "0" }}>
                                      <input
                                          type="checkbox"
                                          id="keep-original-native_description"
                                          checked={Boolean(meta.isKeepOriginalSelected)}
                                          disabled={!canKeepOriginal || isHeldReadOnly || meta.isManualOnly || typeof onToggleKeepOriginal !== "function"}
                                          onChange={(e) => {
                                            if (!canKeepOriginal || isHeldReadOnly || meta.isManualOnly || !meta.isSupported) return;
                                            if (typeof onToggleKeepOriginal === "function") {
                                              onToggleKeepOriginal(selectedBenchId, key, meta.propVal, e.target.checked);
                                            }
                                          }}
                                          style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: "#055160", marginTop: "2px" }}
                                          aria-label="Use original saved value for native_description and reject description proposal"
                                      />
                                      <label htmlFor="keep-original-native_description" style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                          Use original saved value (<code>native_description</code>): <span style={{ fontWeight: "normal" }}>{nativeBaselineSummaryLabel} (reject suggestion &amp; omit from save)</span>
                                      </label>
                                  </div>
                              )}
                          </div>
                          <div style={{ marginTop: "8px", marginLeft: "36px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                              <Text as="p" tone={(!meta.isKeepOriginalSelected && ((!meta.isApproved && meta.hasTechnicalBlock) || (meta.isApproved && meta.hasTechnicalBlock))) ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor }}>
                                  {statusText}
                              </Text>
                          </div>
                      </div>
                  )}

                  {/* Destination-Isolated Companion Decision Block for custom.generated_description */}
                  {showCustomDecisionControls && (
                      <div style={{ marginTop: "8px", backgroundColor: "#f8f9fa", border: "1px solid #dee2e6", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                          <Text as="p" variant="bodySm" fontWeight="bold" style={{ marginBottom: "8px", color: "#334155" }}>
                            Companion Metafield Decision (<code>custom.generated_description</code> — Isolated Destination | Status: {customDescMeta.fieldStatus} | Current: {customDescMeta.currentVal.length} chars)
                          </Text>
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0, boxSizing: "border-box" }}>
                              {canApproveCustom && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0, boxSizing: "border-box" }}>
                                      <input
                                          type="checkbox"
                                          id="approve-custom.generated_description"
                                          checked={Boolean(customDescMeta.isApproved)}
                                          disabled={!canApproveCustom || isCustomHeldReadOnly || customDescMeta.isManualOnly}
                                          onChange={(e) => {
                                            if (!canApproveCustom || isCustomHeldReadOnly || customDescMeta.isManualOnly || !customDescMeta.isSupported) return;
                                            onToggleApproval(selectedBenchId, customKey, customDescMeta.propVal, e.target.checked);
                                          }}
                                          style={{ width: "20px", height: "20px", flexShrink: 0, cursor: "pointer", marginTop: "2px" }}
                                          aria-label={`Approve description proposal for custom.generated_description (${customDescMeta.propVal.length} characters)`}
                                      />
                                      <label htmlFor="approve-custom.generated_description" style={{ fontWeight: "bold", fontSize: "14px", cursor: "pointer", color: "#1e293b", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                          Approve for <code>custom.generated_description</code> metafield <span style={{ fontWeight: "normal" }}>(Approval: {customDescMeta.isApproved ? "Approved" : "Pending"} | Current: {customDescMeta.currentVal.length} chars → Proposed: {customDescMeta.propVal.length} chars)</span>
                                      </label>
                                  </div>
                              )}

                              {canKeepOriginalCustom && (
                                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", minWidth: 0, boxSizing: "border-box", borderTop: canApproveCustom ? "1px dashed #cbd5e1" : "none", paddingTop: canApproveCustom ? "8px" : "0" }}>
                                      <input
                                          type="checkbox"
                                          id="keep-original-custom.generated_description"
                                          checked={Boolean(customDescMeta.isKeepOriginalSelected)}
                                          disabled={!canKeepOriginalCustom || isCustomHeldReadOnly || customDescMeta.isManualOnly || typeof onToggleKeepOriginal !== "function"}
                                          onChange={(e) => {
                                            if (!canKeepOriginalCustom || isCustomHeldReadOnly || customDescMeta.isManualOnly || !customDescMeta.isSupported) return;
                                            if (typeof onToggleKeepOriginal === "function") {
                                              onToggleKeepOriginal(selectedBenchId, customKey, customDescMeta.propVal, e.target.checked);
                                            }
                                          }}
                                          style={{ width: "20px", height: "20px", flexShrink: 0, cursor: "pointer", accentColor: "#055160", marginTop: "2px" }}
                                          aria-label="Use original saved value for custom.generated_description and reject suggestion"
                                      />
                                      <label htmlFor="keep-original-custom.generated_description" style={{ fontWeight: "bold", fontSize: "14px", cursor: "pointer", color: "#1e293b", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                          Use original saved value (<code>custom.generated_description</code>): <span style={{ fontWeight: "normal" }}>{customBaselineSummaryLabel} (reject suggestion &amp; omit from save)</span>
                                      </label>
                                  </div>
                              )}
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

                  {/* APPROVAL DIAGNOSTIC BLOCK (Behind Keyboard-Accessible Disclosure, Closed by Default) */}
                  {(() => {
                      const blockReason = !meta.proposalExists
                        ? "No proposal"
                        : (meta.currentVal === meta.propVal)
                          ? "Values match"
                          : meta.isManualOnly
                            ? "Manual only"
                            : isHeldReadOnly
                              ? "Held read-only"
                              : meta.isKeepOriginalSelected
                                ? "Keep original selected"
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
                                  onClick={() => setDiagOpen(prev => !prev)}
                                  ariaExpanded={diagOpen}
                              >
                                  {diagOpen ? "Hide Diagnostics" : "Diagnostics"}
                              </Button>
                              {diagOpen && (
                                  <div style={{ marginTop: "8px", backgroundColor: "#000", border: "2px solid #0f0", borderRadius: "4px", padding: "10px", color: "#0f0", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", userSelect: "all" }}>
                                      <strong style={{fontSize:"13px", color:"#fff"}}>APPROVAL DIAGNOSTIC</strong><br/>
                                      Key: native_description (Companion Metafield: custom.generated_description) | ID: {selectedBenchId}<br/>
                                      fieldStatus: {meta.fieldStatus} | metafieldStatus: {customDescMeta.fieldStatus}<br/>
                                      proposalExists: {String(meta.proposalExists)} | isDiff: {String(meta.currentVal !== meta.propVal)}<br/>
                                      isManualOnly: {String(meta.isManualOnly)} | isContentPreApproved: {String(meta.isContentPreApproved)} | nativeApproved: {String(Boolean(meta.isApproved))} | nativeKeepOriginal: {String(Boolean(meta.isKeepOriginalSelected))}<br/>
                                      customApproved: {String(Boolean(customDescMeta.isApproved))} | customKeepOriginal: {String(Boolean(customDescMeta.isKeepOriginalSelected))}<br/>
                                      hasTechnicalBlock: {String(meta.hasTechnicalBlock)} | apiBlockReason: {String(meta.reasons.some(r => r.includes("Backend Blocked")))}<br/>
                                      conflictData: {String(!!meta.conflictData)} | nativeDescConflictData: {String(!!meta.nativeDescConflictData)}<br/>
                                      canApprove: {String(canApprove)} | canKeepOriginal: {String(canKeepOriginal)} | Blocker: {blockReason}<br/>
                                      Chars: NativeCurrent({meta.currentVal.length}) / MetafieldCurrent({customDescMeta.currentVal.length}) / Proposed({meta.propVal.length})
                                  </div>
                              )}
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
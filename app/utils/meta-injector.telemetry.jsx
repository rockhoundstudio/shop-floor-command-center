import {
  isVerifiedStandardizedDestination,
  validArray,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  HIDDEN_CONTEXT_FIELDS,
  INTEGRATION_PREFIXES,
  PROTECTED_FIELDS,
  REQUIRED_FIELDS,
  getDynamicSections
} from "./meta-injector.matrix-domain.jsx";

export function buildAndCopyMatrixTelemetry({
  mode = "full",
  selectedBenchId,
  manifestData,
  repairHistory,
  safeProducts,
  approvals,
  submittedPayloads,
  getSystemStatus,
  getFieldMetadata,
  setSafetyError,
  setSafetyMessage
}) {
  if (!selectedBenchId || !manifestData?.[selectedBenchId]) {
    setSafetyError(`Cannot collect telemetry: No active bench item.`);
    return;
  }

  const data = manifestData[selectedBenchId];
  const history = repairHistory?.[selectedBenchId];
  const product = (safeProducts || []).find(p => p.id === selectedBenchId) || {};
  const statusObj = getSystemStatus();
  const diag = data.diagnostics || {};
  const dynamicSections = getDynamicSections(data);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);
  const lastSubmitted = submittedPayloads?.[selectedBenchId];

  const unsupportedKeys = validArray(history?.unsupportedKeys);
  const verifiedDestinations = validArray(history?.verifiedDestinations);
  const blockedFields = validObj(history?.blockedFields);
  const conflicts = validObj(history?.conflicts);
  const unresolvedChanges = validObj(history?.unresolvedChanges);

  let stats = {
    loaded: 0,
    blank: 0,
    proposed: 0,
    blocked: 0,
    protected: 0,
    conflicting: 0,
    updated: history && history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not recorded",
    errored: "Not recorded"
  };

  const isGeologyField = (key) => {
    const normalized = key.replace(/^custom\./, '').replace(/-/g, '_').toLowerCase();
    const geoKeys = [
      "mohs_hardness", "specific_gravity", "crystal_system", "fracture_pattern",
      "cleavage", "luster", "diaphaneity", "mineral_class", "geological_age",
      "geological_era", "rock_formation", "rock_composition"
    ];
    return geoKeys.includes(normalized);
  };

  const isNarrativeBlock = (key) => {
    const normalized = key.replace(/^custom\./, '').replace(/-/g, '_').toLowerCase();
    return ["generated_description", "stone_story", "origin_story", "native_description", "native_descriptionhtml"].includes(normalized);
  };

  const isProtectedIntegration = (key) => {
    if (isVerifiedStandardizedDestination(key)) return false;
    return INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));
  };

  const truncateForTelemetry = (text, limit = 100) => {
    if (!text) return "";
    const str = String(text).replace(/\n/g, " ").trim();
    if (str.length <= limit) return str;
    return `${str.substring(0, limit)}...`;
  };

  let reviewCandidates = [];

  dynamicSections.forEach(sec => {
    sec.keys.forEach(key => {
      const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
      const eligibleForStats = !meta.isPendingReadOnly && (!meta.isStandardizedAttribute || meta.isVerifiedStdDest);
      
      if (meta.currentExists) stats.loaded++;
      if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
      if (eligibleForStats && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked")) stats.proposed++;
      if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) stats.blocked++;
      if (PROTECTED_FIELDS.includes(key) || meta.isOperatorOwned) stats.protected++;
      if (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade" || meta.fieldStatus === "Save Conflict") stats.conflicting++;

      const isGeo = isGeologyField(key);
      const isNarrative = isNarrativeBlock(key);
      const isProtectedInt = isProtectedIntegration(key);

      if (mode === 'review') {
        let isUnapprovedProblem = false;
        let isOptionalConditional = false;
        
        if (!meta.isApproved && meta.proposalExists && meta.currentVal !== meta.propVal) isUnapprovedProblem = true;
        if (!meta.isApproved && meta.contentNeedsReview) isUnapprovedProblem = true;
        if (["Required missing", "Unverified proposal", "Conflict", "Degrade", "API Error / Blocked", "Save Conflict"].includes(meta.fieldStatus) || meta.fieldStatus.includes("Blocked")) {
          isUnapprovedProblem = true;
        }
        if (meta.fieldStatus === "Optional blank" || meta.proposalStatus === "Empty" || meta.fieldStatus === "Manual only") {
          isOptionalConditional = true;
        }

        const isRoutineMandatory = REQUIRED_FIELDS.includes(key) && (meta.isApproved || meta.currentVal === meta.propVal);

        if ((isUnapprovedProblem || isOptionalConditional) && !isRoutineMandatory) {
          reviewCandidates.push({
            key, meta, isGeo, isNarrative, isProtectedInt, priority: isUnapprovedProblem ? 1 : 2
          });
        }
      }
    });
  });

  let reportBlocks = [];
  let reportType = mode === 'review' ? 'REVIEW TELEMETRY' : 'FULL TELEMETRY DUMP';

  reportBlocks.push(`=== ROCKHOUND STUDIO ${reportType} ===\nProduct: ${product.title || "Not recorded"}\nGID: ${selectedBenchId || "Not recorded"}\nRun Time: ${new Date().toISOString()}`);

  const titleParseStatus = (diag.stage === "titleParse" || diag.stage === "tab3FullRescan" || diag.stage === "generateDescription" || diag.stage === "batchAuditItem") ? (diag.gemini || "Unknown") : "Not called";
  const visionStatus = diag.vision || "Not called";
  const geoStatus = diag.geoLibrary || "Not called";
  const descStatus = (data.repairPlan?.["custom.generated_description"] || data.currentMetafields?.["custom.generated_description"]) ? "Success" : (diag.stage === "generateDescription" ? (diag.gemini || "Unknown") : "Not called");

  const shopifyRead = statusObj.shopifyReadStatus;
  const readBack = history && history.readBackVerified !== undefined ? (history.readBackVerified ? "Success" : "Failed") : statusObj.readBackStatus;

  reportBlocks.push(`--- PIPELINE STATUS ---\n[Shopify IO]\nRead: ${shopifyRead}\nBackend-reported updates: ${history && history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not recorded"}\nRead-Back: ${readBack}\n\n[AI Stages]\nTitle Parse: ${titleParseStatus}\nVision Scan: ${visionStatus}\nGeo Library: ${geoStatus}\nStory Gen: ${descStatus}`);

  reportBlocks.push(`--- FIELD SUMMARY ---\nLoaded: ${stats.loaded}\nBlank: ${stats.blank}\nProposed: ${stats.proposed}\nBlocked: ${stats.blocked}\nProtected: ${stats.protected}\nConflicting: ${stats.conflicting}\nUpdated: ${stats.updated}\nErrored: ${stats.errored}`);

  if (history) {
    reportBlocks.push(`--- LAST REPAIR HISTORY ---\nTime: ${history.completedAt}\nStatus: ${history.status}\nMessage: ${history.message}\nBlocked: ${Object.keys(blockedFields).length}\nConflicts: ${Object.keys(conflicts).length}\nVariant Target: ${history.variantTarget || 'Not recorded'}`);
  } else {
    reportBlocks.push(`--- LAST REPAIR HISTORY ---\nNot recorded`);
  }

  let telemetryBody = "--- EXECUTION & REVIEW DETAILS ---\n";
  let detailExcludedCount = 0;
  let omissionsCount = 0;
  let unchangedCount = 0;
  let optionalBlankCount = 0;
  let verifiedMatchesCount = 0;

  let failures = [];
  if (unsupportedKeys.length > 0) failures.push(`Unsupported Keys: ${unsupportedKeys.join(", ")}`);

  Object.keys(blockedFields).forEach(k => failures.push(`Blocked [${k}]: ${blockedFields[k]}`));
  Object.keys(conflicts).forEach(k => {
    const expected = typeof conflicts[k] === 'object' ? conflicts[k].expected : 'unknown';
    const actual = typeof conflicts[k] === 'object' ? conflicts[k].actual : conflicts[k];
    if (isNarrativeBlock(k)) {
      const metaForConflict = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
      const expLen = String(expected || "").length;
      const actLen = String(actual || "").length;
      failures.push(`Conflict [${k}]: Status: ${metaForConflict.fieldStatus} | Approved: ${String(metaForConflict.isApproved)} | Expected (${expLen} chars) -> Actual (${actLen} chars)`);
    } else {
      failures.push(`Conflict [${k}]: Expected [${truncateForTelemetry(expected, 60)}] -> Actual [${truncateForTelemetry(actual, 60)}]`);
    }
  });
  Object.keys(unresolvedChanges).forEach(k => {
    if (isNarrativeBlock(k)) {
      const metaForUnresolved = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
      const valLen = String(unresolvedChanges[k] || "").length;
      failures.push(`Unresolved [${k}]: Status: ${metaForUnresolved.fieldStatus} | Approved: ${String(metaForUnresolved.isApproved)} | Chars: ${valLen}`);
    } else {
      failures.push(`Unresolved [${k}]: ${truncateForTelemetry(unresolvedChanges[k], 60)}`);
    }
  });

  if (lastSubmitted) {
    Object.keys(lastSubmitted).forEach(submitKey => {
      const meta = getFieldMetadata(submitKey, data, selectedBenchId, approvals, allConfigFields);
      const intendedVal = String(lastSubmitted[submitKey] || "");
      const returnVal = String(meta.currentVal || "");

      const isGeo = isGeologyField(submitKey);
      const isNarrative = isNarrativeBlock(submitKey);
      const isProtectedInt = isProtectedIntegration(submitKey);

      if (returnVal === intendedVal && returnVal !== "") {
        verifiedMatchesCount++;
      } else if (returnVal !== intendedVal && returnVal !== "") {
        if (isNarrative) {
          failures.push(`Execution Mismatch [${submitKey}]: Status: ${meta.fieldStatus} | Approved: ${String(meta.isApproved)} | Intended (${intendedVal.length} chars) != Returned (${returnVal.length} chars)`);
          detailExcludedCount++;
        } else if (isGeo || isProtectedInt) {
          failures.push(`Execution Mismatch [${submitKey}]: [Detail Excluded]`);
          detailExcludedCount++;
        } else {
          failures.push(`Execution Mismatch [${submitKey}]:\n  Intended: [${truncateForTelemetry(intendedVal, 100)}]\n  Returned: [${truncateForTelemetry(returnVal, 100)}]\n  Outcome: Returned mismatch`);
        }
      } else if (returnVal === "") {
        failures.push(`Execution Mismatch [${submitKey}]: Not verified (verification unavailable)`);
      }
    });
  }

  const reviewKeys = new Set(reviewCandidates.map(c => c.key));
  reviewCandidates.forEach(c => {
    const { key, meta, isGeo, isNarrative, isProtectedInt } = c;
    if (key === "custom.origin_story") {
      failures.push(`- ${key}: [Hidden Context] Status: ${meta.fieldStatus}`);
      detailExcludedCount++;
    } else if (isNarrative) {
      failures.push(`- ${key}: Status: ${meta.fieldStatus} | Approved: ${String(meta.isApproved)} | Chars: Current(${meta.currentVal.length}) / Proposed(${meta.propVal.length}) | Rsn: ${meta.reasons[0] || "None"}`);
      detailExcludedCount++;
    } else if (isGeo || isProtectedInt) {
      failures.push(`- ${key}: [Detail Excluded] Status: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"}`);
      detailExcludedCount++;
    } else {
      failures.push(`- ${key}: Stat: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"} | Curr: [${truncateForTelemetry(meta.currentVal, 60)}] | Prop: [${truncateForTelemetry(meta.propVal, 60)}]`);
    }
  });

  if (failures.length > 0) {
    telemetryBody += "[FAILURES & ATTENTION NEEDED]\n" + failures.join("\n") + "\n";
  }

  if (verifiedDestinations.length > 0) {
    telemetryBody += `\n[VERIFIED DESTINATIONS]\nBackend Confirmed: ${verifiedDestinations.join(", ")}\n`;
  } else if (history) {
    telemetryBody += `\n[VERIFIED DESTINATIONS]\nNot recorded\n`;
  }

  dynamicSections.forEach(sec => {
    sec.keys.forEach(key => {
      const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
      if (!reviewKeys.has(key) && !blockedFields[key] && !conflicts[key] && !unresolvedChanges[key] && !unsupportedKeys.includes(key)) {
        if (meta.fieldStatus === "Unchanged" && meta.currentVal !== "") unchangedCount++;
        else if (meta.fieldStatus === "Optional blank") optionalBlankCount++;
        else omissionsCount++;
      }
    });
  });

  telemetryBody += `\n[SUMMARY STATS]\n`;
  if (lastSubmitted) telemetryBody += `Verified Matches (Submitted vs Read-Back): ${verifiedMatchesCount} fields\n`;
  telemetryBody += `Unchanged Comparisons: ${unchangedCount} fields intact\n`;
  telemetryBody += `Optional Blanks: ${optionalBlankCount} fields\n`;
  telemetryBody += `Other Omissions: ${omissionsCount} fields\n`;
  telemetryBody += `Detail Excluded (Geo/Narrative/Protected): ${detailExcludedCount} fields`;

  reportBlocks.push(telemetryBody);

  const recommendations = [];
  if (Object.keys(blockedFields).length > 0 || failures.some(f => f.includes("Required missing"))) {
    recommendations.push("1. DO NOT WRITE. Review and manually resolve blocked or required fields.");
  } else if (lastSubmitted && (failures.some(f => f.includes("Execution Mismatch")))) {
    recommendations.push(`1. WARNING: Submitted change(s) remain unresolved or unverified after execution. Review the execution mismatch block.`);
  } else if (!lastSubmitted && history && stats.proposed > 0) {
    recommendations.push("1. Exact execution payload unavailable. Some fields appear proposed post-save, but cannot be proven as failed writes. Review manually.");
  } else if (stats.proposed > 0 && !history) {
    recommendations.push("1. Content review complete. Technically eligible proposals are staged. Proceed with 'Execute Single Repair'.");
  } else if (history && history.fieldsUpdated !== undefined) {
    recommendations.push("1. Backend request successful. Check live Shopify admin to confirm field updates.");
  } else {
    recommendations.push("1. Load data or generate a repair plan to begin.");
  }

  reportBlocks.push(`--- RECOMMENDATIONS ---\n${recommendations.join("\n")}\n=========================================`);

  let finalReport = "";
  let maxLimit = mode === 'review' ? 6000 : 10000;

  for (let i = 0; i < reportBlocks.length; i++) {
    if (finalReport.length + reportBlocks[i].length + 2 > maxLimit) {
      finalReport += `\n\n[WARNING: Cutoff reached. Exceeded limit by ${finalReport.length + reportBlocks[i].length + 2 - maxLimit} characters.]`;
      break;
    }
    finalReport += (i > 0 ? "\n\n" : "") + reportBlocks[i];
  }

  navigator.clipboard.writeText(finalReport)
    .then(() => {
      if (window.shopify && window.shopify.toast) {
        window.shopify.toast.show(`${mode === 'review' ? 'Review telemetry' : 'Full report'} copied`);
      } else {
        setSafetyMessage(`${mode === 'review' ? 'Review telemetry' : 'Full report'} copied to clipboard.`);
      }
    })
    .catch(err => {
      console.error("Clipboard error", err);
      setSafetyError("Failed to copy telemetry to clipboard.");
    });
}
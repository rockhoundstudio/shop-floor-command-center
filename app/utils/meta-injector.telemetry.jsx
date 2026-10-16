import {
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  parseMetaobjectGidArray,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  formatErrorsList,
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

const SENSITIVE_TELEMETRY_KEY_REGEX = /token|secret|password|authorization|cookie|header|credential|api[_-]?key|session/i;

const sanitizeTelemetryText = (val) => {
  if (val === undefined || val === null) return "";
  const str = String(val).trim();
  if (!str || str === "[object Object]") return "";
  return str
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/gi, "shpat_[REDACTED]")
    .replace(/shpca_[A-Za-z0-9_]+/gi, "shpca_[REDACTED]")
    .replace(/shpss_[A-Za-z0-9_]+/gi, "shpss_[REDACTED]");
};

const formatTelemetryErrorRecord = (item) => {
  if (item === undefined || item === null) return "";
  if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
    return sanitizeTelemetryText(item);
  }
  if (typeof item === "object") {
    const message = sanitizeTelemetryText(item.message ?? item.error ?? item.reason ?? "");
    const rawField = item.field ?? item.path ?? null;
    const field = Array.isArray(rawField)
      ? rawField.map(p => sanitizeTelemetryText(p)).filter(Boolean).join(".")
      : sanitizeTelemetryText(rawField);
    const code = sanitizeTelemetryText(item.code ?? "");
    const destination = sanitizeTelemetryText(item.destination ?? item.key ?? "");

    if (typeof item.formatted === "string" && sanitizeTelemetryText(item.formatted)) {
      return sanitizeTelemetryText(item.formatted);
    }

    let fallback = "";
    if (!message) {
      const pairs = [];
      Object.entries(item).forEach(([k, v]) => {
        if (SENSITIVE_TELEMETRY_KEY_REGEX.test(k)) return;
        if (v === undefined || v === null) return;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          const cleanV = sanitizeTelemetryText(v);
          if (cleanV) pairs.push(`${k}=${cleanV}`);
        } else if (Array.isArray(v)) {
          const joined = v.map(p => sanitizeTelemetryText(p)).filter(Boolean).join(".");
          if (joined) pairs.push(`${k}=${joined}`);
        }
      });
      fallback = pairs.join(", ");
    }

    const effectiveMsg = message || fallback;
    if (!effectiveMsg && !field && !code && !destination) return "";

    const metaParts = [];
    if (destination) metaParts.push(`dest: ${destination}`);
    if (field && field !== destination) metaParts.push(`field: ${field}`);
    if (code) metaParts.push(`code: ${code}`);

    const prefix = metaParts.length > 0 ? `[${metaParts.join(" | ")}] ` : "";
    return `${prefix}${effectiveMsg || "Unspecified backend error"}`.trim();
  }
  return "";
};

const collectDistinctPreservedBackendErrors = (history, diag) => {
  const distinct = [];
  const seen = new Set();

  const addFormatted = (rawEntry) => {
    const formatted = formatTelemetryErrorRecord(rawEntry);
    if (!formatted) return;
    if (seen.has(formatted)) return;
    seen.add(formatted);
    distinct.push(formatted);
  };

  validArray(history?.errors).forEach(addFormatted);
  validArray(history?.errorMessages).forEach(addFormatted);
  validArray(diag?.errors).forEach(addFormatted);

  return distinct;
};

export function buildAndCopyMatrixTelemetry({
  mode = "full",
  selectedBenchId,
  manifestData,
  repairHistory,
  safeProducts,
  approvals,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
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
  const preservedBackendErrors = collectDistinctPreservedBackendErrors(history, diag);

  const hasRepairAttempt = Boolean(history || diag.stage === "executeRepairPlan");
  const isFailedRepair = Boolean(
    history &&
      (history.success === false ||
        history.status === "REPAIR_FAILED" ||
        history.status === "REPAIR_BLOCKED" ||
        history.readBackVerified === false)
  );

  const canVerifySubmittedAgainstReadBack = Boolean(
    history &&
      history.readBackVerified !== undefined &&
      !(history.success === false && diag.readBack === "Not called")
  );
  const unverifiedNativeFields = validArray(data.nativeTargets?.unverifiedFields);

  // Evaluate standardized candidate & reference matching state strictly for the selected product
  const rawProductCandidates = standardizedCandidatesByProduct?.[selectedBenchId] || {};
  const candidateBundle = buildCanonicalCandidateBundle(rawProductCandidates);
  const stagedCandidateKeys = Object.keys(candidateBundle.ordered);
  const hasStagedCandidates = candidateBundle.hasSupported;

  const refMatchResult = referenceMatchResultsByProduct?.[selectedBenchId] || null;
  const refMatchStatus = referenceMatchStatusByProduct?.[selectedBenchId] || null;

  let refMatchStateSummary = "No candidates staged";
  let hasUnresolvedReferenceMatching = false;
  const refMatchReadErrors = [];
  const categoryIneligibleCandidates = [];
  const incompleteCandidateResolutions = [];
  const entryBlockedCandidateResolutions = [];
  const resolvedLookupDiagnosticNotes = [];
  const unapprovedEligibleStandardizedKeys = [];
  const approvedEligibleStandardizedKeys = [];

  if (hasStagedCandidates) {
    if (!refMatchResult) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary =
        refMatchStatus?.state === "discarded_stale"
          ? `Stale / Discarded (${stagedCandidateKeys.length} candidate(s) awaiting fresh match)`
          : refMatchStatus?.state === "submitting" || refMatchStatus?.state === "awaiting_response"
            ? `In Progress (${refMatchStatus.state})`
            : refMatchStatus?.state === "failed"
              ? `Failed (${sanitizeTelemetryText(refMatchStatus.message || "Request failed")})`
              : `Missing / Not Run (${stagedCandidateKeys.length} staged candidate(s): ${stagedCandidateKeys.join(", ")})`;
    } else if (
      refMatchResult.pieceId !== selectedBenchId ||
      refMatchResult.intent !== "resolveStandardizedCandidates" ||
      refMatchResult.readOnly !== true
    ) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary = "Invalid contract / Product identity mismatch";
    } else if (refMatchResult.snapshot !== candidateBundle.snapshot) {
      hasUnresolvedReferenceMatching = true;
      refMatchStateSummary = "Stale (Candidate snapshot changed since last match)";
    } else {
      const topLevelErrors = formatErrorsList(refMatchResult.errors);
      topLevelErrors.forEach(errText => {
        const cleanErr = sanitizeTelemetryText(errText);
        if (cleanErr && !refMatchReadErrors.includes(cleanErr)) {
          refMatchReadErrors.push(cleanErr);
        }
      });

      if (!refMatchResult.success || !refMatchResult.isComplete || topLevelErrors.length > 0) {
        hasUnresolvedReferenceMatching = true;
        refMatchStateSummary = `Failed / Incomplete (success: ${String(Boolean(refMatchResult.success))}, isComplete: ${String(Boolean(refMatchResult.isComplete))}, topErrors: ${topLevelErrors.length})`;
      } else {
        refMatchStateSummary = "Completed";
      }

      const matchTimeMs = refMatchResult.matchedAt ? Date.parse(refMatchResult.matchedAt) : NaN;
      const repairTimeMs = history?.completedAt ? Date.parse(history.completedAt) : NaN;
      const wasRematchedAfterRepair =
        !Number.isNaN(matchTimeMs) &&
        !Number.isNaN(repairTimeMs) &&
        matchTimeMs > repairTimeMs;

      stagedCandidateKeys.forEach(metaKey => {
        const destKey = `shopify.${metaKey}`;
        const res = refMatchResult.resolutions?.[destKey] || null;
        if (!res || typeof res !== "object") {
          hasUnresolvedReferenceMatching = true;
          incompleteCandidateResolutions.push(`${destKey}: Missing backend resolution object.`);
          return;
        }

        const catElig = res.categoryEligibility || refMatchResult.categoryEligibility?.[destKey] || null;
        const isCatComplete = catElig ? catElig.isComplete === true : false;
        const isConfirmedCatIneligible = Boolean(
          (isCatComplete && catElig?.isEligible === false) ||
            res.isCategoryEligible === false ||
            res.status === "category_ineligible" ||
            catElig?.status === "category_ineligible" ||
            catElig?.status === "missing_product_category" ||
            catElig?.status === "empty_constraint_values"
        );

        const fieldErrors = formatErrorsList(res.errors || res.error);
        const catReasonText = sanitizeTelemetryText(catElig?.reason || "");

        // Keep confirmed category-ineligible proposals distinct from read errors
        const actualFieldReadErrors = fieldErrors.filter(eText => {
          if (!isConfirmedCatIneligible) return true;
          const trimmed = eText.trim();
          if (catReasonText && trimmed === catReasonText) return false;
          if (/^Category constraint mismatch on /i.test(trimmed)) return false;
          if (/^Product has no assigned taxonomy category/i.test(trimmed)) return false;
          return true;
        });

        actualFieldReadErrors.forEach(eText => {
          const cleanFieldErr = `[${destKey}] ${sanitizeTelemetryText(eText)}`;
          if (!refMatchReadErrors.includes(cleanFieldErr)) {
            refMatchReadErrors.push(cleanFieldErr);
          }
        });

        if (isConfirmedCatIneligible) {
          categoryIneligibleCandidates.push(
            `${destKey}: ${catReasonText || "Ineligible for this product's taxonomy category (candidate evidence preserved; write blocked)."}`
          );
          return;
        }

        if (res.isComplete !== true || !isCatComplete || actualFieldReadErrors.length > 0) {
          hasUnresolvedReferenceMatching = true;
          incompleteCandidateResolutions.push(
            `${destKey}: ${actualFieldReadErrors[0] || catReasonText || "Incomplete reference or category constraint enumeration."}`
          );
          return;
        }

        const entryStatus = sanitizeTelemetryText(res.entryMatchStatus || res.status || "");
        const meta = getFieldMetadata(destKey, data, selectedBenchId, approvals, allConfigFields);
        const stdEval = meta?.stdEvaluation || null;

        const activeSelectedList =
          typeof meta?.propVal === "string" && meta.propVal.trim() !== ""
            ? meta.propVal.trim()
            : typeof stdEval?.autoProposalSerialized === "string"
              ? stdEval.autoProposalSerialized.trim()
              : "";

        const selectedListValidation = validateProposedStandardizedGidList(activeSelectedList, stdEval);
        const isTechnicallyResolvedAndValid = Boolean(
          stdEval?.isTechnicallyEligible === true &&
          stdEval?.isCategoryEligible === true &&
          selectedListValidation.valid === true
        );

        if (!isTechnicallyResolvedAndValid) {
          const blockDetail = sanitizeTelemetryText(
            stdEval?.blockReason ||
            selectedListValidation.reason ||
            (entryStatus ? `Entry resolution status is "${entryStatus}".` : "Unresolved reference entry match.")
          );
          const rawLookupPrefix =
            entryStatus && !blockDetail.toLowerCase().includes(entryStatus.toLowerCase())
              ? `Entry resolution status is "${entryStatus}" (${blockDetail})`
              : blockDetail;
          entryBlockedCandidateResolutions.push(`${destKey}: ${rawLookupPrefix}`);
          return;
        }

        if (entryStatus === "ambiguous" || entryStatus === "missing_entry" || entryStatus === "blocked") {
          const canonicalSelectedStr = JSON.stringify(selectedListValidation.gids);
          const submittedStr =
            lastSubmitted && Object.prototype.hasOwnProperty.call(lastSubmitted, destKey)
              ? String(lastSubmitted[destKey] ?? "").trim()
              : "";
          const rawLoadedMetafield =
            data.currentMetafields && Object.prototype.hasOwnProperty.call(data.currentMetafields, destKey)
              ? data.currentMetafields[destKey]
              : undefined;
          const isRawLoadedSourceCompleteAndValid = !(
            rawLoadedMetafield &&
            typeof rawLoadedMetafield === "object" &&
            !Array.isArray(rawLoadedMetafield) &&
            (rawLoadedMetafield.readComplete === false ||
              rawLoadedMetafield.parseValid === false ||
              Boolean(rawLoadedMetafield.parseError))
          );
          const parsedLoadedGids = isRawLoadedSourceCompleteAndValid
            ? parseMetaobjectGidArray(
                rawLoadedMetafield && typeof rawLoadedMetafield === "object" && !Array.isArray(rawLoadedMetafield)
                  ? (rawLoadedMetafield.referenceIds ?? rawLoadedMetafield.rawValue)
                  : rawLoadedMetafield
              )
            : [];
          const canonicalLoadedAssignmentStr =
            parsedLoadedGids.length > 0 ? JSON.stringify(parsedLoadedGids) : "";
          const rawMetafieldObserved = canonicalLoadedAssignmentStr !== "";
          const currentReadBackStr = String(meta.currentVal ?? "").trim();

          const isDestinationSaveVerified = Boolean(
            history &&
            history.success === true &&
            history.readBackVerified === true &&
            canVerifySubmittedAgainstReadBack &&
            submittedStr !== "" &&
            submittedStr === canonicalSelectedStr &&
            rawMetafieldObserved &&
            canonicalLoadedAssignmentStr === submittedStr &&
            currentReadBackStr === submittedStr &&
            verifiedDestinations.includes(destKey) &&
            !blockedFields[destKey] &&
            !conflicts[destKey] &&
            !unresolvedChanges[destKey]
          );

          const isPriorSaveSupersededBySelection = Boolean(
            history &&
            history.success === true &&
            history.readBackVerified === true &&
            submittedStr !== "" &&
            submittedStr !== canonicalSelectedStr &&
            verifiedDestinations.includes(destKey)
          );

          const isAlreadyAssignedUnchanged = Boolean(
            rawMetafieldObserved && canonicalLoadedAssignmentStr === canonicalSelectedStr
          );

          const evalReasons = Array.isArray(stdEval?.labelEvaluations)
            ? stdEval.labelEvaluations.map(ev => sanitizeTelemetryText(ev?.reason || "")).filter(Boolean)
            : [];
          const resolutionBasis = evalReasons.length > 0 ? evalReasons.join("; ") : "Verified reference list validated";

          let lifecycleStateNote = "";
          if (isDestinationSaveVerified && !wasRematchedAfterRepair) {
            lifecycleStateNote = "State: Verified saved in Shopify (readBackVerified=true, destination confirmed)";
          } else if (isDestinationSaveVerified && wasRematchedAfterRepair) {
            lifecycleStateNote = `State: Historical save verified (${submittedStr}); reference matching re-run after save cleared fresh approval (Current Approval: ${meta.isApproved ? "Approved" : "Unapproved"})`;
          } else if (isPriorSaveSupersededBySelection) {
            lifecycleStateNote = `State: Historical save (${submittedStr}) superseded by changed selection ${canonicalSelectedStr} (Current Approval: ${meta.isApproved ? "Approved, not saved" : "Unapproved, not saved"})`;
          } else if (isAlreadyAssignedUnchanged) {
            lifecycleStateNote = "State: Already assigned; unchanged. No new repair verification recorded.";
          } else if (meta.isApproved) {
            lifecycleStateNote = "State: Exact GID list approved (not yet saved/verified)";
          } else {
            lifecycleStateNote = "State: Technically resolved proposal (awaiting exact-value approval; not saved)";
          }

          resolvedLookupDiagnosticNotes.push(
            `Historical Lookup Diagnostic [${destKey}]: Raw lookup status "${entryStatus}" technically resolved to ${canonicalSelectedStr} (${resolutionBasis}) | ${lifecycleStateNote}`
          );
        }
      });

      if (incompleteCandidateResolutions.length > 0 && refMatchStateSummary === "Completed") {
        hasUnresolvedReferenceMatching = true;
        refMatchStateSummary = `Incomplete (${incompleteCandidateResolutions.length} candidate resolution(s) incomplete)`;
      }
    }
  }

  let stats = {
    loaded: 0,
    blank: 0,
    proposed: 0,
    blocked: 0,
    protected: 0,
    conflicting: 0,
    updated: history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null ? history.fieldsUpdated : "Not recorded",
    errored: preservedBackendErrors.length > 0 ? preservedBackendErrors.length : (hasRepairAttempt ? (isFailedRepair ? "Unrecorded" : 0) : "Not recorded")
  };

  let approvedOrPreApprovedEligibleCount = 0;
  let approvedOrPreApprovedNonStdCount = 0;
  let unapprovedReviewRequiredCount = 0;
  let actualBlockedProposalCount = 0;

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
    const str = sanitizeTelemetryText(String(text).replace(/\n/g, " "));
    if (str.length <= limit) return str;
    return `${str.substring(0, limit)}...`;
  };

  let reviewCandidates = [];
  const evaluatedEligibleKeys = new Set();

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

      if (!HIDDEN_CONTEXT_FIELDS.includes(key)) {
        const hasGenuineDelta = meta.proposalExists && meta.currentVal !== meta.propVal;
        const isTechnicallyReadyToWrite =
          hasGenuineDelta &&
          !meta.isBlockedAction &&
          !meta.hasTechnicalBlock &&
          !meta.isPendingReadOnly &&
          !meta.isManualOnly &&
          meta.isSupported &&
          (!meta.isStandardizedAttribute || (meta.isVerifiedStdDest && meta.isCategoryEligible === true));

        const hasExplicitOrPolicyApproval = meta.isApproved === true || meta.isContentPreApproved === true;

        if (isTechnicallyReadyToWrite && hasExplicitOrPolicyApproval) {
          if (!evaluatedEligibleKeys.has(key)) {
            evaluatedEligibleKeys.add(key);
            approvedOrPreApprovedEligibleCount++;
            if (meta.isVerifiedStdDest) {
              approvedEligibleStandardizedKeys.push(key);
            } else {
              approvedOrPreApprovedNonStdCount++;
            }
          }
        } else if (hasGenuineDelta && meta.isVerifiedStdDest && !meta.isPendingReadOnly && !meta.hasTechnicalBlock && !meta.isApproved) {
          if (!unapprovedEligibleStandardizedKeys.includes(key)) {
            unapprovedEligibleStandardizedKeys.push(key);
          }
          unapprovedReviewRequiredCount++;
        } else if (hasGenuineDelta && !hasExplicitOrPolicyApproval && !meta.isPendingReadOnly && !meta.isManualOnly) {
          unapprovedReviewRequiredCount++;
        }

        if (meta.isActualBlockedProposal) {
          actualBlockedProposalCount++;
        }
      }

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
  const readBack =
    history && history.success === false && diag.readBack === "Not called"
      ? "Not called (Write failed before read-back)"
      : history && history.readBackVerified !== undefined
        ? (history.readBackVerified ? "Success" : "Failed")
        : statusObj.readBackStatus;

  reportBlocks.push(`--- PIPELINE STATUS ---\n[Shopify IO]\nRead: ${shopifyRead}\nBackend-reported updates: ${history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null ? history.fieldsUpdated : "Not recorded"}\nRead-Back: ${readBack}\n\n[AI Stages]\nTitle Parse: ${titleParseStatus}\nVision Scan: ${visionStatus}\nGeo Library: ${geoStatus}\nStory Gen: ${descStatus}\n\n[Standardized Reference Matching]\nStaged Candidates: ${hasStagedCandidates ? `${stagedCandidateKeys.length} (${stagedCandidateKeys.join(", ")})` : "None"}\nMatch State: ${refMatchStateSummary}\nApproved Eligible Standardized Writes: ${approvedEligibleStandardizedKeys.length}\nUnapproved Eligible Standardized Proposals: ${unapprovedEligibleStandardizedKeys.length}\nCategory-Ineligible Standardized Candidates: ${categoryIneligibleCandidates.length}`);

  reportBlocks.push(`--- FIELD SUMMARY ---\nLoaded: ${stats.loaded}\nBlank: ${stats.blank}\nProposed: ${stats.proposed}\nApproved/Pre-Approved Eligible Writes: ${approvedOrPreApprovedEligibleCount}\nUnapproved Proposals Requiring Review: ${unapprovedReviewRequiredCount}\nBlocked: ${stats.blocked}\nProtected: ${stats.protected}\nConflicting: ${stats.conflicting}\nUpdated: ${stats.updated}\nErrored: ${stats.errored}`);

  if (history) {
    const genericHistoryMessage = sanitizeTelemetryText(history.rawMessage ?? history.message ?? "Not recorded") || "Not recorded";
    const specificHistoryErrorCount = preservedBackendErrors.length;
    reportBlocks.push(`--- LAST REPAIR HISTORY ---\nTime: ${history.completedAt}\nStatus: ${history.status}\nGeneric Summary Message: ${genericHistoryMessage}\nSpecific Backend Errors Recorded: ${specificHistoryErrorCount}\nBlocked: ${Object.keys(blockedFields).length}\nConflicts: ${Object.keys(conflicts).length}\nVariant Target: ${history.variantTarget || 'Not recorded'}`);
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

  // 1. Put actual backend repair errors first before verbose comparison details so report limits cannot hide the root cause
  if (preservedBackendErrors.length > 0) {
    preservedBackendErrors.forEach((errText, idx) => {
      failures.push(`Backend Repair Error [${idx + 1}]: ${errText}`);
    });
  } else if (
    isFailedRepair ||
    (diag.error && diag.stage === "executeRepairPlan")
  ) {
    const fallbackDiagError = sanitizeTelemetryText(diag.error);
    const genericMsg = sanitizeTelemetryText(history?.rawMessage ?? history?.message ?? "");
    if (fallbackDiagError && fallbackDiagError !== genericMsg) {
      failures.push(`Backend Repair Error [1]: ${fallbackDiagError}`);
    } else {
      failures.push("Detailed backend errors were not recorded.");
    }
  }

  // 2. Report missing, stale, failed, or incomplete standardized reference matching explicitly
  if (hasStagedCandidates && hasUnresolvedReferenceMatching) {
    failures.push(`Standardized Reference Matching Unresolved: ${refMatchStateSummary}`);
  }
  refMatchReadErrors.forEach((readErr, idx) => {
    failures.push(`Reference Matching Read Error [${idx + 1}]: ${readErr}`);
  });
  incompleteCandidateResolutions.forEach((incMsg) => {
    failures.push(`Incomplete Candidate Resolution: ${incMsg}`);
  });
  entryBlockedCandidateResolutions.forEach((blkMsg) => {
    failures.push(`Blocked Candidate Resolution: ${blkMsg}`);
  });

  // 3. Report confirmed category-ineligible standardized candidates distinctly from read errors
  categoryIneligibleCandidates.forEach((catMsg) => {
    failures.push(`Category-Ineligible Standardized Candidate (Not a Read Error): ${catMsg}`);
  });

  if (unsupportedKeys.length > 0) failures.push(`Unsupported Keys: ${unsupportedKeys.join(", ")}`);

  Object.keys(blockedFields).forEach(k => failures.push(`Blocked [${k}]: ${sanitizeTelemetryText(blockedFields[k])}`));
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
      const rawUnres = unresolvedChanges[k];
      const formattedUnres = typeof rawUnres === "object" && rawUnres !== null
        ? sanitizeTelemetryText(rawUnres.reason || JSON.stringify(rawUnres))
        : truncateForTelemetry(rawUnres, 60);
      failures.push(`Unresolved [${k}]: ${formattedUnres}`);
    }
  });

  if (lastSubmitted) {
    Object.keys(lastSubmitted).forEach(submitKey => {
      const meta = getFieldMetadata(submitKey, data, selectedBenchId, approvals, allConfigFields);
      const intendedVal = String(lastSubmitted[submitKey] ?? "");
      const returnVal = String(meta.currentVal ?? "");

      const isGeo = isGeologyField(submitKey);
      const isNarrative = isNarrativeBlock(submitKey);
      const isProtectedInt = isProtectedIntegration(submitKey);

      const isNativeFieldUnverified =
        ((submitKey === "shopify_title" || submitKey === "native_title") && unverifiedNativeFields.includes("productTitle")) ||
        (submitKey === "native_description" && unverifiedNativeFields.includes("descriptionHtml")) ||
        (submitKey === "native_seo_title" && unverifiedNativeFields.includes("seo")) ||
        (submitKey.startsWith("native_image_alts_") && unverifiedNativeFields.includes("media"));

      if (!canVerifySubmittedAgainstReadBack || isNativeFieldUnverified) {
        failures.push(`Execution Mismatch [${submitKey}]: Not verified (independent read-back unavailable; cached values are not treated as read-back)`);
      } else if (returnVal === intendedVal && returnVal !== "") {
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

  if (resolvedLookupDiagnosticNotes.length > 0) {
    telemetryBody += (failures.length > 0 ? "\n" : "") + "[PRESERVED LOOKUP DIAGNOSTICS]\n" + resolvedLookupDiagnosticNotes.join("\n") + "\n";
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

  const hasMissingRequiredField = failures.some(f => f.includes("Required missing"));
  const recommendations = [];

  if (preservedBackendErrors.length > 0 || isFailedRepair) {
    recommendations.push("1. DO NOT RETRY WRITE BLINDLY. Inspect the Backend Repair Error(s) above and perform an independent product read-back first.");
  } else if (Object.keys(blockedFields).length > 0 || hasMissingRequiredField) {
    recommendations.push("1. DO NOT WRITE. Review and manually resolve backend-blocked or required missing fields.");
  } else if (lastSubmitted && failures.some(f => f.includes("Execution Mismatch"))) {
    recommendations.push("1. WARNING: Submitted change(s) remain unresolved or unverified after execution. Review the execution mismatch block.");
  } else if (!lastSubmitted && history && stats.proposed > 0) {
    recommendations.push("1. Exact execution payload unavailable. Some fields appear proposed post-save, but cannot be proven as failed writes. Review manually.");
  } else if (!history) {
    if (hasStagedCandidates && hasUnresolvedReferenceMatching) {
      const nonStdReadyNote = approvedOrPreApprovedNonStdCount > 0
        ? ` Note: ${approvedOrPreApprovedNonStdCount} non-standardized field(s) are approved/pre-approved and technically eligible, but standardized candidate proposals remain excluded until reference matching completes.`
        : " No approved standardized writes can be included until reference matching succeeds.";
      recommendations.push(`1. DO NOT ASSUME FULL PRODUCT READINESS: Standardized reference matching is unresolved (${refMatchStateSummary}). Click 'Match Reference Choices' and resolve read/enumeration issues before expecting standardized attribute writes.${nonStdReadyNote}`);
    } else if (approvedOrPreApprovedEligibleCount > 0) {
      const pendingNotes = [];
      if (unapprovedEligibleStandardizedKeys.length > 0) {
        pendingNotes.push(`${unapprovedEligibleStandardizedKeys.length} category-eligible standardized proposal(s) (${unapprovedEligibleStandardizedKeys.join(", ")}) are not yet approved and will be excluded unless checked`);
      }
      if (categoryIneligibleCandidates.length > 0) {
        pendingNotes.push(`${categoryIneligibleCandidates.length} category-ineligible standardized candidate(s) remain blocked by product category constraint`);
      }
      if (entryBlockedCandidateResolutions.length > 0) {
        pendingNotes.push(`${entryBlockedCandidateResolutions.length} standardized candidate(s) remain blocked by missing/ambiguous entry resolution`);
      }
      const unapprovedNonStdCount = Math.max(0, unapprovedReviewRequiredCount - unapprovedEligibleStandardizedKeys.length);
      if (unapprovedNonStdCount > 0) {
        pendingNotes.push(`${unapprovedNonStdCount} other proposed change(s) still require explicit operator approval and will be excluded`);
      }

      if (pendingNotes.length > 0) {
        recommendations.push(`1. PARTIAL WRITE READINESS: ${approvedOrPreApprovedEligibleCount} approved/pre-approved field delta(s) are technically eligible for 'Execute Single Repair'. However, ${pendingNotes.join("; ")}. Review remaining items if you intend to include them.`);
      } else {
        recommendations.push(`1. Content review complete: ${approvedOrPreApprovedEligibleCount} approved/pre-approved field delta(s) are technically eligible. Proceed with 'Execute Single Repair'.`);
      }
    } else if (stats.proposed > 0 || unapprovedReviewRequiredCount > 0 || actualBlockedProposalCount > 0 || hasStagedCandidates) {
      const holdReasons = [];
      if (unapprovedEligibleStandardizedKeys.length > 0) {
        holdReasons.push(`approve exact GID list(s) for ${unapprovedEligibleStandardizedKeys.join(", ")}`);
      }
      const unapprovedNonStdCount = Math.max(0, unapprovedReviewRequiredCount - unapprovedEligibleStandardizedKeys.length);
      if (unapprovedNonStdCount > 0) {
        holdReasons.push(`approve ${unapprovedNonStdCount} pending field proposal(s) requiring review`);
      }
      if (categoryIneligibleCandidates.length > 0) {
        holdReasons.push(`${categoryIneligibleCandidates.length} standardized candidate(s) are blocked by product category constraints`);
      }
      if (entryBlockedCandidateResolutions.length > 0) {
        holdReasons.push(`${entryBlockedCandidateResolutions.length} standardized candidate(s) have missing/ambiguous reference entries`);
      }
      const suffix = holdReasons.length > 0 ? ` (${holdReasons.join("; ")})` : "";
      recommendations.push(`1. DO NOT EXECUTE REPAIR YET: Zero approved or policy-pre-approved eligible field deltas are ready to write${suffix}. Review and approve eligible proposals first.`);
    } else {
      recommendations.push("1. Load data or run AI Auto-Fill to stage proposals.");
    }
  } else if (history && history.fieldsUpdated !== undefined && history.fieldsUpdated !== null) {
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
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 FIELD FILTERING & DRAWER EVALUATION MODULE
// File: app/utils/bench-v2.field-filters.jsx
// ==========================================================================

import {
  BENCH_V2_DRAWER_GROUPS,
  isParkedOrProtectedDrawerId,
  isManualOnlyNoAiDestination,
  checkExistingWriterStringFidelity,
  evaluateDestinationTypeAndCompleteness,
  evaluateBenchV2FieldRow
} from "./bench-v2.contract.jsx";

export const BENCH_V2_FILTER_OPTIONS = Object.freeze([
  { label: "All Fields (Default)", value: "All" },
  { label: "Needs Review", value: "Needs review" },
  { label: "Proposed Changes", value: "Proposed changes" },
  { label: "Conflicts & Held Alternatives", value: "Conflicts" },
  { label: "Blank / Not Set", value: "Blank" },
  { label: "Source: Shopify (Saved)", value: "Shopify" },
  { label: "Source: Gemini", value: "Gemini" },
  { label: "Source: Vision", value: "Vision" },
  { label: "Source: Geo Library", value: "Geo Library" },
  { label: "Source: Derived", value: "Derived" },
  { label: "Source: Manual", value: "Manual" }
]);

const ACTIONABLE_UNRESOLVED_SCAN_DISPOSITIONS = Object.freeze(
  new Set([
    "Rejected (invalid)",
    "Held (no unique/equivalent verified reference entry match)",
    "Held (category-ineligible or incomplete reference evidence)",
    "Pending verified reference choices (will resolve automatically when ready)"
  ])
);

export function evaluateActionableScanProposalMeta({
  contract,
  baselineObservation,
  hasProposalKey,
  proposedValue,
  scanProposalMeta,
  verifiedInLastSave = false
}) {
  if (!contract || isParkedOrProtectedDrawerId(contract.drawerId)) {
    return null;
  }
  if (isManualOnlyNoAiDestination(contract.destinationKey, contract)) {
    return null;
  }
  if (!scanProposalMeta || typeof scanProposalMeta !== "object" || Array.isArray(scanProposalMeta)) {
    return null;
  }

  const disposition =
    typeof scanProposalMeta.disposition === "string"
      ? scanProposalMeta.disposition.trim()
      : "";
  if (!ACTIONABLE_UNRESOLVED_SCAN_DISPOSITIONS.has(disposition)) {
    return null;
  }

  if (verifiedInLastSave) {
    return null;
  }

  const candidateValue =
    typeof scanProposalMeta.value === "string" ? scanProposalMeta.value.trim() : "";
  const source =
    typeof scanProposalMeta.source === "string" && scanProposalMeta.source.trim() !== ""
      ? scanProposalMeta.source.trim()
      : "Source not reported";
  const reason =
    typeof scanProposalMeta.reason === "string" && scanProposalMeta.reason.trim() !== ""
      ? scanProposalMeta.reason.trim()
      : disposition;

  // Exclude if the candidate value already matches the saved baseline value
  if (
    baselineObservation?.evidenceAvailable &&
    baselineObservation.presence === "present" &&
    typeof baselineObservation.rawValue === "string" &&
    candidateValue !== "" &&
    baselineObservation.rawValue.trim() === candidateValue
  ) {
    return null;
  }

  // Exclude if the current staged draft is the exact same value (already represented as a staged proposal)
  if (
    hasProposalKey &&
    typeof proposedValue === "string" &&
    candidateValue !== "" &&
    proposedValue.trim() === candidateValue
  ) {
    return null;
  }

  const isPendingRefChoices =
    disposition ===
    "Pending verified reference choices (will resolve automatically when ready)";
  const isRejectedInvalid = disposition === "Rejected (invalid)";

  const reviewStatusLabel = isPendingRefChoices
    ? "AI Candidate Pending Reference Choices"
    : isRejectedInvalid
      ? "Rejected AI Suggestion (Not Staged)"
      : "Held AI Reference Candidate (Not Staged)";

  const tone = isPendingRefChoices
    ? "muted"
    : isRejectedInvalid
      ? "error"
      : "warning";

  const candidateQuote = candidateValue ? ` "${candidateValue}"` : "";
  const summaryText = isPendingRefChoices
    ? `AI candidate${candidateQuote} (${source}) pending verified reference choices: ${reason}`
    : isRejectedInvalid
      ? `AI suggestion${candidateQuote} (${source}) rejected and not staged: ${reason}`
      : `AI reference candidate${candidateQuote} (${source}) held and not staged: ${reason}`;

  return Object.freeze({
    isActionable: true,
    disposition,
    candidateValue,
    source,
    reason,
    reviewStatusLabel,
    tone,
    summaryText
  });
}

export function formatRawBaselineValueForInspection(baselineObs) {
  if (!baselineObs) return "Unavailable";
  if (!baselineObs.evidenceAvailable) {
    if (baselineObs.presence === "unknown_incomplete_read") {
      return "[UNKNOWN — INCOMPLETE READ (Cannot Infer Absence)]";
    }
    if (baselineObs.presence === "multiple_variants_hold") {
      return "[HELD — MULTIPLE VARIANTS (Single-Variant Target Required)]";
    }
    if (baselineObs.presence === "zero_variants_hold") {
      return "[HELD — ZERO VARIANTS]";
    }
    return `[UNAVAILABLE — ${baselineObs.presence}]`;
  }
  if (baselineObs.presence === "absent") {
    return "[ABSENT — Verified Not Set on Owner]";
  }
  if (baselineObs.presence === "null") {
    return "[NULL]";
  }
  if (baselineObs.presence === "empty_string") {
    return '[EMPTY STRING ""]';
  }
  const raw = baselineObs.rawValue;
  if (typeof raw === "object" && raw !== null) {
    return JSON.stringify(raw);
  }
  return String(raw);
}

export function formatReadableSavedValue(baselineObs, usesMeaningDisplay, baselineDisplayValue) {
  if (!baselineObs) return "Not loaded";
  if (!baselineObs.evidenceAvailable) {
    if (baselineObs.presence === "unknown_incomplete_read") {
      return "Read incomplete (cannot confirm if empty)";
    }
    if (baselineObs.presence === "multiple_variants_hold") {
      return "Held (multiple variants on product)";
    }
    if (baselineObs.presence === "zero_variants_hold") {
      return "Held (zero variants on product)";
    }
    return "Not available";
  }
  if (baselineObs.presence === "absent") {
    return "Not set";
  }
  if (baselineObs.presence === "null" || baselineObs.presence === "empty_string") {
    return "Empty";
  }
  if (usesMeaningDisplay && typeof baselineDisplayValue === "string" && baselineDisplayValue !== "") {
    return baselineDisplayValue;
  }
  const raw = baselineObs.rawValue;
  if (typeof raw === "object" && raw !== null) {
    return JSON.stringify(raw);
  }
  return String(raw);
}

export const PLAIN_DRAWER_TITLES = Object.freeze({
  manual_stone_scale_price: "1. Manual Stone Measurements & Price Baseline",
  manual_fit_and_chain_measurements: "2. Manual Chain, Fit & Opening Measurements",
  manual_title_and_collection_date: "3. Manual Product Title & Collection Date",
  identity_and_classification: "4. Piece Identity, Material & OOAK",
  appearance_color_and_shape: "5. Appearance, Cut, Color & Finish",
  treatment_and_disclosure: "6. Treatment & Disclosure",
  origin_and_provenance: "7. Origin, Collection & Provenance",
  setting_and_hardware: "8. Setting, Chain & Hardware",
  seo_and_media_alts: "9. SEO Titles, Meta Description & Photo Alts",
  descriptions_and_narrative: "10. Product Descriptions (Substantive Text)",
  geology_physical_properties: "11. Geology: Physical & Optical Properties",
  geology_composition_and_time: "12. Geology: Class, Composition, Formation & Deep Time",
  channel_and_demographic: "13. Google Channel & Demographic Attributes",
  parked_story_and_bench_notes: "14. Parked Story, Character & Studio Notes (Read-Only)",
  parked_legacy_product_exclusions: "15. Parked Legacy Product & Taxonomy Exclusions (Read-Only)",
  parked_variant_and_protected_apps: "16. Parked Variant Customs/MPN & Protected App Fields (Read-Only)"
});

export function cleanFieldHeading(rawLabel) {
  if (typeof rawLabel !== "string") return "";
  return rawLabel
    .replace(/\s*\(custom\.[^)]+\)/gi, "")
    .replace(/\s*\(mm-google-shopping\.[^)]+\)/gi, "")
    .replace(/\s*\(Saved Compatibility\s*—\s*Read-Only\)/gi, "")
    .replace(/\s*\(Legacy Variant Compatibility\s*—\s*Read-Only\)/gi, "")
    .replace(/\s*\(Read-Only in Batch 1\)/gi, "")
    .replace(/\s*\(Unverified Hold\)/gi, "")
    .replace(/\s*\(Variant-Owned Hold\)/gi, "")
    .replace(/\s*\(Read-Only Hold\)/gi, "")
    .replace(/\s*\(Custom Compatibility\s*—\s*Read-Only\)/gi, "")
    .replace(/\s*\(Task-Restricted Read-Only\)/gi, "")
    .replace(/\s*\(Parked\s*—\s*Read-Only\)/gi, "")
    .replace(/\s*\(Parked \/ Source Context\s*—\s*Read-Only\)/gi, "")
    .replace(/\s*\(Parked Variant[^)]*\)/gi, "")
    .replace(/\s*\(Excluded Variant[^)]*\)/gi, "")
    .replace(/\s*\(Protected\s*—\s*Read-Only\)/gi, "")
    .trim();
}

export function getShortPlainNotice(row, isRefChoicesBusy = false) {
  const {
    contract,
    baselineObservation: obs,
    typeAndCompleteness,
    referenceEvidence,
    hasProposalKey,
    proposedValue,
    scanProposalMeta,
    actionableScanMeta,
    validation,
    fidelityCheck
  } = row;

  const resolvedActionableScanMeta =
    actionableScanMeta !== undefined
      ? actionableScanMeta
      : evaluateActionableScanProposalMeta({
          contract,
          baselineObservation: obs,
          hasProposalKey,
          proposedValue,
          scanProposalMeta,
          verifiedInLastSave: false
        });

  if (!obs.evidenceAvailable) {
    if (obs.presence === "unknown_incomplete_read") {
      return {
        tone: "error",
        text:
          contract.owner === "PRODUCTVARIANT"
            ? "Variant read incomplete — reload before editing."
            : "Read incomplete — reload before editing."
      };
    }
    if (obs.presence === "multiple_variants_hold") {
      return {
        tone: "warning",
        text: "Held read-only: product has multiple variants (single-variant target required)."
      };
    }
    if (obs.presence === "zero_variants_hold") {
      return {
        tone: "error",
        text: "Held read-only: product has zero variants."
      };
    }
    return {
      tone: "error",
      text:
        contract.owner === "PRODUCTVARIANT"
          ? "Variant baseline not loaded."
          : "Baseline not loaded."
    };
  }

  if (!contract.isWritableInBatch1) {
    if (contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD") {
      return {
        tone: "muted",
        text: "Held read-only pending supported Shopify definition and writer evidence."
      };
    }
    return {
      tone: "muted",
      text: "Read-only in this batch."
    };
  }

  const resolvedTypeCheck =
    typeAndCompleteness ||
    evaluateDestinationTypeAndCompleteness({
      contract,
      baselineObs: obs
    });

  if (!resolvedTypeCheck.ready) {
    if (
      resolvedTypeCheck.code === "metafields_read_not_complete" ||
      resolvedTypeCheck.code === "variant_metafields_read_not_complete" ||
      resolvedTypeCheck.code === "definitions_read_not_complete" ||
      resolvedTypeCheck.code === "variant_definitions_read_not_complete" ||
      resolvedTypeCheck.code === "product_category_read_not_complete" ||
      resolvedTypeCheck.code === "category_eligibility_incomplete"
    ) {
      return {
        tone: "error",
        text: resolvedTypeCheck.reason || "Read incomplete — reload before saving."
      };
    }
    if (resolvedTypeCheck.code === "destination_definition_error") {
      if (contract.namespace === "shopify" && resolvedTypeCheck.reason) {
        return {
          tone: "error",
          text: resolvedTypeCheck.reason
        };
      }
      return {
        tone: "error",
        text: "Definition or category error — see Details."
      };
    }
    if (resolvedTypeCheck.code === "missing_restricted_metaobject_definition") {
      return {
        tone: "error",
        text:
          resolvedTypeCheck.reason ||
          "Missing restricted MetaobjectDefinition on live PRODUCT definition."
      };
    }
    if (resolvedTypeCheck.code === "missing_type_evidence") {
      return {
        tone: "error",
        text: "Missing Shopify type evidence — cannot save yet."
      };
    }
    if (resolvedTypeCheck.code === "live_vs_stored_type_conflict") {
      return {
        tone: "error",
        text: "Shopify type conflict — see Details."
      };
    }
    if (resolvedTypeCheck.code === "contract_type_mismatch") {
      const observedType = obs.liveDefType || obs.storedType;
      const allowedTypes =
        Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
          ? contract.allowedTypes
          : [contract.expectedType];
      return {
        tone: "error",
        text: observedType
          ? `Shopify type mismatch (observed ${observedType}, expected ${allowedTypes.join(" or ")}) — see Details.`
          : "Shopify type mismatch — see Details."
      };
    }
    return {
      tone: "error",
      text: resolvedTypeCheck.reason || "Field not ready to save — see Details."
    };
  }

  // When a proposal is staged (`hasProposalKey`), keep the primary short notice
  // strictly faithful to the active proposal's own fidelity, validation, or
  // unchanged-from-baseline status. Never let `resolvedActionableScanMeta`
  // overwrite a valid human/staged draft or unchanged selection notice;
  // `row.actionableScanMeta` is rendered independently when present.
  if (hasProposalKey) {
    if (!fidelityCheck.faithful) {
      return {
        tone: "error",
        text: "Remove leading/trailing spaces or warning icon before approving."
      };
    }
    if (validation && !validation.valid) {
      return {
        tone: "error",
        text: validation.reason
      };
    }
    if (validation && validation.isUnchangedFromStored) {
      return {
        tone: "muted",
        text: "Already saved on product — no changed value to approve."
      };
    }
    return null;
  }

  if (contract.namespace === "shopify") {
    if (!referenceEvidence || !referenceEvidence.evidenceLoaded) {
      if (resolvedActionableScanMeta) {
        return {
          tone: resolvedActionableScanMeta.tone,
          text: resolvedActionableScanMeta.summaryText
        };
      }
      return {
        tone: "muted",
        text: isRefChoicesBusy
          ? `Loading verified Metaobject reference choices for ${obs.restrictedMetaobjectDefinitionId}...`
          : `Eligible on this product (Def: ${obs.restrictedMetaobjectDefinitionId}) — reference choices load automatically when the product baseline is ready.`
      };
    }
    if (!referenceEvidence.isComplete) {
      return {
        tone: "error",
        text:
          referenceEvidence.error ||
          "Reference entry enumeration failed or is incomplete — use Retry Reference Choices if needed."
      };
    }
    if (referenceEvidence.entriesByGid.size === 0) {
      if (resolvedActionableScanMeta) {
        return {
          tone: resolvedActionableScanMeta.tone,
          text: resolvedActionableScanMeta.summaryText
        };
      }
      return {
        tone: "warning",
        text: `0 Metaobject entries exist in Shopify for ${obs.restrictedMetaobjectDefinitionId} — nothing can be approved until entries exist.`
      };
    }
  }

  if (resolvedActionableScanMeta) {
    return {
      tone: resolvedActionableScanMeta.tone,
      text: resolvedActionableScanMeta.summaryText
    };
  }

  return null;
}

export function matchesBenchV2Filter(row, activeFilter) {
  if (!row || typeof row !== "object") return false;
  if (!activeFilter || activeFilter === "All") return true;

  const {
    contract,
    baselineObservation: obs,
    hasProposalKey,
    proposedValue,
    proposalSource,
    proposalOrigin,
    heldAiAlternative,
    scanProposalMeta,
    actionableScanMeta,
    validation,
    isApproved,
    isKeepOriginal,
    fidelityCheck,
    hasSaveErrorOrConflict
  } = row;

  const isBlankBaseline =
    obs.evidenceAvailable &&
    (obs.presence === "absent" || obs.presence === "null" || obs.presence === "empty_string");
  const isSavedPresent = obs.evidenceAvailable && obs.presence === "present";
  const isRequiredMissing =
    isBlankBaseline &&
    (contract.destinationKey === "shopify_title" || contract.destinationKey === "native_price");

  const hasChangedProposal =
    hasProposalKey &&
    proposedValue.trim() !== "" &&
    !validation?.isUnchangedFromStored;

  const isTemporarilyClearedManualEdit =
    hasProposalKey && proposalOrigin === "Manual" && proposedValue.trim() === "";

  const isBlockedOrInvalidProposal =
    hasProposalKey &&
    (!validation?.valid ||
      !fidelityCheck.faithful ||
      obs.metafieldsCompleteState !== "complete" ||
      obs.defsCompleteState !== "complete" ||
      Boolean(obs.destinationDefError));

  const resolvedActionableScanMeta =
    actionableScanMeta !== undefined
      ? actionableScanMeta
      : evaluateActionableScanProposalMeta({
          contract,
          baselineObservation: obs,
          hasProposalKey,
          proposedValue,
          scanProposalMeta,
          verifiedInLastSave: false
        });

  if (activeFilter === "Blank") {
    return isBlankBaseline;
  }

  if (activeFilter === "Proposed changes") {
    return (
      hasChangedProposal ||
      Boolean(isApproved) ||
      Boolean(isKeepOriginal) ||
      Boolean(heldAiAlternative)
    );
  }

  if (activeFilter === "Conflicts") {
    const DisagreesWithStored =
      isSavedPresent && hasChangedProposal && !isKeepOriginal;
    return (
      DisagreesWithStored ||
      Boolean(heldAiAlternative) ||
      Boolean(hasSaveErrorOrConflict)
    );
  }

  if (activeFilter === "Needs review") {
    if (hasSaveErrorOrConflict) return true;
    if (isParkedOrProtectedDrawerId(contract.drawerId)) return false;
    if (isRequiredMissing) return true;
    if (Boolean(heldAiAlternative)) return true;
    if (Boolean(resolvedActionableScanMeta)) return true;
    if (isKeepOriginal) return false;
    if (isApproved && !isBlockedOrInvalidProposal) return false;
    if (isTemporarilyClearedManualEdit) return true;
    if (hasChangedProposal && (!isApproved || isBlockedOrInvalidProposal)) {
      return true;
    }
    return false;
  }

  const activeSourceStr =
    hasProposalKey && typeof proposalSource === "string" && proposalSource !== "None"
      ? proposalSource
      : heldAiAlternative && typeof heldAiAlternative.source === "string"
        ? heldAiAlternative.source
        : scanProposalMeta && typeof scanProposalMeta.source === "string"
          ? scanProposalMeta.source
          : "";

  if (activeFilter === "Shopify") {
    return isSavedPresent && !hasChangedProposal;
  }

  if (activeFilter === "Manual") {
    return (
      (hasProposalKey && (proposalOrigin === "Manual" || activeSourceStr === "Manual")) ||
      isTemporarilyClearedManualEdit
    );
  }

  if (activeFilter === "Vision") {
    return /vision/i.test(activeSourceStr);
  }

  if (activeFilter === "Gemini") {
    return (
      /gemini/i.test(activeSourceStr) ||
      (hasProposalKey && proposalOrigin === "AI") ||
      Boolean(heldAiAlternative)
    );
  }

  if (activeFilter === "Derived") {
    return /title segment parse|store page directory|store collection directory|location mapping|derived/i.test(
      activeSourceStr
    );
  }

  if (activeFilter === "Geo Library") {
    return /geo\s*library|geodata|mindat/i.test(activeSourceStr);
  }

  return activeSourceStr === activeFilter;
}

export function getDrawerConnectionSubtitle(drawer) {
  if (!drawer) return "Read-only in Batch 1";

  const rows = Array.isArray(drawer.evaluatedRows) ? drawer.evaluatedRows : [];

  if (isParkedOrProtectedDrawerId(drawer.drawerId)) {
    const parkedCount = rows.filter(
      (r) =>
        r.contract.batchStage === "PARKED_EXCLUDED_READ_ONLY" ||
        r.contract.writeCapability === "PARKED_EXCLUDED_NO_WRITE"
    ).length;
    const protectedCount = rows.filter(
      (r) =>
        r.contract.batchStage === "PROTECTED_READ_ONLY" ||
        r.contract.writeCapability === "PROTECTED_NO_WRITE"
    ).length;

    if (parkedCount > 0 && protectedCount > 0) {
      return `Read-only parked (${parkedCount}) and protected app (${protectedCount}) fields — zero writes`;
    }
    if (protectedCount > 0) {
      return `Read-only protected third-party app fields (${protectedCount}) — zero writes`;
    }
    return `Read-only parked and excluded fields (${parkedCount || rows.length}) — zero writes`;
  }

  const writableRows = rows.filter((r) => r.contract.isWritableInBatch1 === true);
  const readOnlyRows = rows.filter((r) => r.contract.isWritableInBatch1 !== true);

  const nonRefWritableRows = writableRows.filter((r) => r.contract.namespace !== "shopify");
  const refWritableRows = writableRows.filter((r) => r.contract.namespace === "shopify");

  const nonRefReadyCount = nonRefWritableRows.filter(
    (r) => r.typeAndCompleteness?.ready === true
  ).length;
  const nonRefManualOnlyCount = nonRefWritableRows.filter((r) =>
    isManualOnlyNoAiDestination(r.contract.destinationKey, r.contract)
  ).length;
  const variantWritableCount = nonRefWritableRows.filter(
    (r) => r.contract.owner === "PRODUCTVARIANT"
  ).length;

  const refEligibleRows = refWritableRows.filter(
    (r) => r.typeAndCompleteness?.ready === true
  );
  const refVerifiedChoiceRows = refEligibleRows.filter(
    (r) =>
      r.referenceEvidence?.isComplete === true &&
      r.referenceEvidence.entriesByGid.size > 0
  );
  const refEmptyChoiceRows = refEligibleRows.filter(
    (r) =>
      r.referenceEvidence?.isComplete === true &&
      r.referenceEvidence.entriesByGid.size === 0
  );
  const refBlockedByCategoryCount = refWritableRows.length - refEligibleRows.length;

  const taskRestrictedRows = readOnlyRows.filter(
    (r) =>
      r.contract.batchStage === "TASK_RESTRICTED_READ_ONLY" ||
      r.contract.writeCapability === "TASK_RESTRICTED_NO_WRITE"
  );
  const compatRows = readOnlyRows.filter(
    (r) =>
      r.contract.batchStage === "READ_ONLY_COMPATIBILITY" ||
      r.contract.writeCapability === "COMPATIBILITY_INSPECTION_ONLY"
  );
  const holdRows = readOnlyRows.filter(
    (r) =>
      r.contract.batchStage === "READ_ONLY_HOLD" ||
      r.contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
  );
  const futureDescriptorRows = readOnlyRows.filter(
    (r) =>
      r.contract.batchStage === "FUTURE_BATCH_2_DESCRIPTOR" ||
      r.contract.batchStage === "FUTURE_BATCH_3_DESCRIPTOR"
  );

  const segments = [];

  if (nonRefWritableRows.length > 0) {
    const allNonRefManual = nonRefManualOnlyCount === nonRefWritableRows.length;
    const modeLabel = allNonRefManual
      ? "manual-only"
      : nonRefManualOnlyCount > 0
        ? `direct (${nonRefManualOnlyCount} manual-only)`
        : "direct";
    const variantNote =
      variantWritableCount > 0 ? `, ${variantWritableCount} single-variant` : "";
    segments.push(
      `${nonRefReadyCount}/${nonRefWritableRows.length} ${modeLabel} ready${variantNote}`
    );
  }

  if (refWritableRows.length > 0) {
    const emptyNote =
      refEmptyChoiceRows.length > 0 ? `, ${refEmptyChoiceRows.length} with 0 entries` : "";
    segments.push(
      `${refWritableRows.length} shopify.* ref (${refEligibleRows.length} eligible, ${refVerifiedChoiceRows.length} verified choices${emptyNote}, ${refBlockedByCategoryCount} blocked)`
    );
  }

  const roNotes = [];
  if (taskRestrictedRows.length > 0) {
    roNotes.push(`${taskRestrictedRows.length} price/shipping task-restricted read-only`);
  }
  if (compatRows.length > 0) {
    roNotes.push(`${compatRows.length} compat read-only`);
  }
  if (holdRows.length > 0) {
    roNotes.push(`${holdRows.length} on hold`);
  }
  if (futureDescriptorRows.length > 0) {
    roNotes.push(`${futureDescriptorRows.length} photo-alt descriptor read-only`);
  }

  if (roNotes.length > 0) {
    segments.push(roNotes.join(", "));
  }

  if (segments.length > 0) {
    return segments.join(" • ");
  }

  if (drawer.isImplementedInBatch1) {
    return "Connected in Batch 1";
  }
  return "Read-only in Batch 1";
}

export function evaluateAndFilterBenchV2Drawers({
  activeProductId,
  currentBaseline,
  currentProposedMap,
  currentAiAlternativesMap,
  currentApprovalsMap,
  currentKeepOriginalMap,
  currentScanProposalsMetaMap,
  retainedFieldEditorsByProduct,
  lastSaveReport,
  activeFilter,
  isRefChoicesBusy,
  drawerGroups = BENCH_V2_DRAWER_GROUPS
}) {
  const activeRetainedEditorsMap = retainedFieldEditorsByProduct[activeProductId] || {};
  const activeSaveReportForCurrentProduct =
    lastSaveReport && lastSaveReport.productId === activeProductId ? lastSaveReport : null;

  const evaluatedDrawerGroups = drawerGroups.map((drawer) => {
    const evaluatedRows = drawer.fields.map((fieldContract) => {
      const destKey = fieldContract.destinationKey;
      const baseEval = evaluateBenchV2FieldRow({
        productId: activeProductId,
        destinationKey: destKey,
        baselineSnapshot: currentBaseline,
        proposedMapForProduct: currentProposedMap,
        approvalsMapForProduct: currentApprovalsMap,
        keepOriginalMapForProduct: currentKeepOriginalMap
      });

      const rawPropEntry = currentProposedMap[destKey];
      const proposalOrigin =
        rawPropEntry && typeof rawPropEntry === "object" && rawPropEntry.origin === "AI"
          ? "AI"
          : baseEval.hasProposalKey
            ? "Manual"
            : "None";

      const heldAiAlternative = currentAiAlternativesMap[destKey] || null;
      const scanProposalMeta = currentScanProposalsMetaMap[destKey] || null;

      const fidelityCheck =
        baseEval?.hasProposalKey && baseEval.proposedValue !== ""
          ? checkExistingWriterStringFidelity(baseEval.proposedValue)
          : { faithful: true, reason: null };

      const hasSaveErrorOrConflict = Boolean(
        activeSaveReportForCurrentProduct &&
          (Object.prototype.hasOwnProperty.call(
            activeSaveReportForCurrentProduct.blockedFields || {},
            destKey
          ) ||
            Object.prototype.hasOwnProperty.call(
              activeSaveReportForCurrentProduct.unresolvedChanges || {},
              destKey
            ) ||
            Object.prototype.hasOwnProperty.call(
              activeSaveReportForCurrentProduct.conflicts || {},
              destKey
            ) ||
            (Array.isArray(activeSaveReportForCurrentProduct.unconfirmedDestinations) &&
              activeSaveReportForCurrentProduct.unconfirmedDestinations.includes(destKey)))
      );

      const verifiedInLastSave = Boolean(
        !baseEval.hasProposalKey &&
          activeSaveReportForCurrentProduct &&
          Array.isArray(activeSaveReportForCurrentProduct.verifiedDestinations) &&
          activeSaveReportForCurrentProduct.verifiedDestinations.includes(destKey)
      );

      const actionableScanMeta = evaluateActionableScanProposalMeta({
        contract: fieldContract,
        baselineObservation: baseEval.baselineObservation,
        hasProposalKey: baseEval.hasProposalKey,
        proposedValue: baseEval.proposedValue,
        scanProposalMeta,
        verifiedInLastSave
      });

      let effectiveConnectionStatus = baseEval.connectionStatus;
      let effectiveReviewStatus = baseEval.reviewStatus;
      let effectiveStatusReason = baseEval.statusReason;

      const obs = baseEval.baselineObservation;
      const isShopifyReference = fieldContract.namespace === "shopify";
      const isCategoryIneligibleBlocked = Boolean(
        isShopifyReference &&
          fieldContract.isWritableInBatch1 &&
          obs.evidenceAvailable &&
          baseEval.typeAndCompleteness?.ready !== true &&
          obs.categoryEligibility?.status === "category_ineligible"
      );

      if (isCategoryIneligibleBlocked && !baseEval.hasProposalKey) {
        effectiveReviewStatus = "Ineligible for Product Category (Read-Only)";
      }

      if (
        fieldContract.namespace === "shopify" &&
        fieldContract.isWritableInBatch1 &&
        baseEval.typeAndCompleteness?.ready === true &&
        (!baseEval.referenceEvidence || !baseEval.referenceEvidence.evidenceLoaded)
      ) {
        effectiveConnectionStatus = isRefChoicesBusy
          ? `Connected (Standardized Reference Eligible — Loading Verified ${baseEval.baselineObservation.restrictedMetaobjectDefinitionId} Choices...)`
          : `Connected (Standardized Reference Eligible — Reference Choices Load Automatically for ${baseEval.baselineObservation.restrictedMetaobjectDefinitionId})`;
        if (!baseEval.hasProposalKey) {
          effectiveStatusReason = isRefChoicesBusy
            ? `Loading verified Metaobject entries for ${baseEval.baselineObservation.restrictedMetaobjectDefinitionId}...`
            : `Verified Metaobject entries for ${baseEval.baselineObservation.restrictedMetaobjectDefinitionId} load automatically when the product baseline is ready.`;
        }
      }

      if (
        fieldContract.isWritableInBatch1 &&
        baseEval.hasProposalKey &&
        baseEval.validation?.valid &&
        !fidelityCheck.faithful
      ) {
        effectiveReviewStatus = "Blocked Proposal (Writer Trim/Prefix Fidelity)";
        effectiveStatusReason = fidelityCheck.reason;
      }

      // Keep `effectiveReviewStatus` and `effectiveStatusReason` faithful to the
      // active valid human/staged draft, exact approval, or unchanged baseline.
      // Only promote `actionableScanMeta` to `effectiveReviewStatus` when NO draft
      // is staged (`!baseEval.hasProposalKey`) and the field is not already marked
      // category-ineligible; `actionableScanMeta` remains attached on the row for
      // independent rendering in `BenchV2DrawersView` and telemetry.
      if (actionableScanMeta && !baseEval.hasProposalKey) {
        if (!isCategoryIneligibleBlocked) {
          effectiveReviewStatus = actionableScanMeta.reviewStatusLabel;
        }
        if (
          effectiveStatusReason &&
          !effectiveStatusReason.includes(actionableScanMeta.reason)
        ) {
          effectiveStatusReason = `${effectiveStatusReason} | ${actionableScanMeta.summaryText}`;
        } else if (!effectiveStatusReason) {
          effectiveStatusReason = actionableScanMeta.summaryText;
        }
      }

      const usesMeaningDisplay = Boolean(
        fieldContract.usesYesNoMeaningDisplay || isShopifyReference
      );
      const plainLabel = cleanFieldHeading(fieldContract.label);
      const readableSaved = formatReadableSavedValue(
        obs,
        usesMeaningDisplay,
        baseEval.baselineDisplayValue
      );
      const canSelectKeepOriginal = Boolean(
        fieldContract.isWritableInBatch1 &&
          baseEval.hasProposalKey &&
          obs.evidenceAvailable &&
          baseEval.proposedValue.trim() !== "" &&
          !(obs.presence === "present" && obs.rawValue === baseEval.proposedValue)
      );

      const enrichedRow = {
        ...baseEval,
        proposalOrigin,
        heldAiAlternative,
        scanProposalMeta,
        actionableScanMeta,
        hasSaveErrorOrConflict,
        fidelityCheck,
        effectiveConnectionStatus,
        effectiveReviewStatus,
        effectiveStatusReason,
        plainLabel,
        readableSaved,
        canSelectKeepOriginal
      };

      const isEditorRetained = activeRetainedEditorsMap[destKey] === true;
      const matchesCurrentFilter =
        activeFilter === "All" ||
        isEditorRetained ||
        matchesBenchV2Filter(enrichedRow, activeFilter);

      return {
        ...enrichedRow,
        isEditorRetained,
        matchesCurrentFilter
      };
    });

    const visibleRows =
      activeFilter === "All"
        ? evaluatedRows
        : evaluatedRows.filter((r) => r.matchesCurrentFilter);

    return {
      ...drawer,
      evaluatedRows,
      visibleRows
    };
  });

  const visibleDrawerGroups =
    activeFilter === "All"
      ? evaluatedDrawerGroups
      : evaluatedDrawerGroups.filter((d) => d.visibleRows.length > 0);

  const allEvaluatedRows = evaluatedDrawerGroups.flatMap((d) => d.evaluatedRows);
  const totalVisibleFilteredRowCount = evaluatedDrawerGroups.reduce(
    (acc, d) => acc + d.visibleRows.length,
    0
  );
  const stagedProposalRows = allEvaluatedRows.filter((r) => r.hasProposalKey);
  const validApprovedRows = allEvaluatedRows.filter(
    (r) => r.isApproved && r.fidelityCheck.faithful
  );
  const keepOriginalRows = allEvaluatedRows.filter((r) => r.isKeepOriginal);
  const heldAiAlternativesCount = Object.keys(currentAiAlternativesMap).length;

  return {
    activeRetainedEditorsMap,
    activeSaveReportForCurrentProduct,
    evaluatedDrawerGroups,
    visibleDrawerGroups,
    allEvaluatedRows,
    totalVisibleFilteredRowCount,
    stagedProposalRows,
    validApprovedRows,
    keepOriginalRows,
    heldAiAlternativesCount
  };
}
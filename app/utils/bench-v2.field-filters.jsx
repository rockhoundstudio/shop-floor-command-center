// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 FIELD FILTERING & DRAWER EVALUATION MODULE
// File: app/utils/bench-v2.field-filters.jsx
// ==========================================================================

import {
  BENCH_V2_DRAWER_GROUPS,
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
  identity: "1. Identity",
  origin_and_collection: "2. Origin and Collection",
  treatment: "3. Treatment",
  appearance_and_character: "4. Appearance and Character",
  manual_measurements: "5. Manual Measurements",
  conditional_setting_accessory: "6. Setting and Hardware",
  geology: "7. Geology",
  other_channel: "8. Channel Attributes",
  native_seo_description_media: "9. Title, Description, SEO and Photo Alts",
  standardized_attributes: "10. Standardized Attributes",
  parked_excluded_protected: "11. Parked and Protected Fields"
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
    validation,
    fidelityCheck
  } = row;

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
        text: "Matches saved value."
      };
    }
  }

  if (contract.namespace === "shopify") {
    if (!referenceEvidence || !referenceEvidence.evidenceLoaded) {
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
      return {
        tone: "warning",
        text: `0 Metaobject entries exist in Shopify for ${obs.restrictedMetaobjectDefinitionId} — nothing can be approved until entries exist.`
      };
    }
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
    if (contract.drawerId === "parked_excluded_protected") return false;
    if (isRequiredMissing) return true;
    if (Boolean(heldAiAlternative)) return true;
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
  if (drawer.drawerId === "parked_excluded_protected") {
    return "Read-only parked and protected fields (includes excluded custom & standardized authenticity/rarity)";
  }
  if (drawer.drawerId === "identity") {
    return "Detailed custom.* identity fields connected (standardized companion shopify.material in Drawer 10 is connected with live reference verification)";
  }
  if (drawer.drawerId === "appearance_and_character") {
    return "Detailed custom.* appearance fields connected (standardized companion shopify.color-pattern in Drawer 10 is connected with live reference verification)";
  }
  if (drawer.drawerId === "manual_measurements") {
    const writableCount = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1).length;
    const heldCount = drawer.evaluatedRows.length - writableCount;
    return `Manual-only (${writableCount} connected for manual entry, ${heldCount} unverified on hold — no AI scan staging)`;
  }
  if (drawer.drawerId === "conditional_setting_accessory") {
    return "Connected for manual entry, AI Scan hardware suggestions & exact approval";
  }
  if (drawer.drawerId === "geology") {
    const writableRows = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1);
    const readyCount = writableRows.filter((r) => r.typeAndCompleteness?.ready === true).length;
    return `Detailed custom.* geology paths connected (${readyCount}/${writableRows.length} ready on product; legacy custom.geological_era is read-only; authoritative ERA dropdown shopify.geological-era + 4 standardized geology reference companions are connected in Drawer 10)`;
  }
  if (drawer.drawerId === "other_channel") {
    const writableRows = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1);
    const readyCount = writableRows.filter((r) => r.typeAndCompleteness?.ready === true).length;
    return `4 channel destinations wired (${readyCount}/${writableRows.length} ready on current product: PRODUCT custom.google_product_category + manual/preset single-variant PRODUCTVARIANT mm-google-shopping.age_group, condition, gender; mm-google-shopping.custom_product held; legacy google.* variant slots & custom.target_gender read-only)`;
  }
  if (drawer.drawerId === "standardized_attributes") {
    const writableRows = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1);
    const categoryEligibleRows = writableRows.filter(
      (r) => r.typeAndCompleteness?.ready === true
    );
    const verifiedChoiceRows = categoryEligibleRows.filter(
      (r) => r.referenceEvidence?.isComplete === true && r.referenceEvidence.entriesByGid.size > 0
    );
    const emptyChoiceRows = categoryEligibleRows.filter(
      (r) => r.referenceEvidence?.isComplete === true && r.referenceEvidence.entriesByGid.size === 0
    );
    const blockedByCategoryCount = writableRows.length - categoryEligibleRows.length;
    return `18 retained shopify.* reference attributes wired (${categoryEligibleRows.length}/${writableRows.length} category/definition-eligible on product, ${blockedByCategoryCount} blocked by category/definition, ${verifiedChoiceRows.length} with verified choices ready for approval${emptyChoiceRows.length > 0 ? `, ${emptyChoiceRows.length} with 0 entries` : ""})`;
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

      let effectiveConnectionStatus = baseEval.connectionStatus;
      let effectiveReviewStatus = baseEval.reviewStatus;
      let effectiveStatusReason = baseEval.statusReason;

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

      const obs = baseEval.baselineObservation;
      const isShopifyReference = fieldContract.namespace === "shopify";
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
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 PURE FIELD & DRAWER CONTRACT
// File: app/utils/bench-v2.contract.jsx
// Pure browser-safe contract module: zero React hooks/effects, zero storage,
// zero GraphQL/network calls, zero server-only imports.
// ==========================================================================

import {
  isExactMetaobjectGid
} from "./meta-injector.standardized.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_REFERENCE_PRODUCTS,
  BENCH_V2_BATCH_STAGE,
  BENCH_V2_WRITE_CAPABILITY,
  CANCELLED_INERT_DESTINATIONS,
  TASK_RESTRICTED_READ_ONLY_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_UNHELD_BARE_KEYS,
  BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS,
  REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  BENCH_V2_DRAWERS,
  BENCH_V2_OPTIONS_BY_KEY,
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_CONTRACTS_BY_DESTINATION,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
  MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS,
  isManualOnlyNoAiDestination,
  BENCH_V2_DRAWER_GROUPS,
  getFieldContractByDestination
} from "./bench-v2.registry.jsx";
import {
  isExactProductGid,
  isExactProductVariantGid,
  isExactMetaobjectDefinitionGid,
  isExactMediaImageGid,
  inspectStoredReferenceListRawValue,
  inspectVerifiedReferenceEvidenceForDestination,
  formatBenchV2ValueDisplay,
  formatOoakDisplayConvention,
  getContractOptionsForObservation,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness
} from "./bench-v2.observation.jsx";

export {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_REFERENCE_PRODUCTS,
  BENCH_V2_BATCH_STAGE,
  BENCH_V2_WRITE_CAPABILITY,
  CANCELLED_INERT_DESTINATIONS,
  TASK_RESTRICTED_READ_ONLY_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_UNHELD_BARE_KEYS,
  BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS,
  REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  BENCH_V2_DRAWERS,
  BENCH_V2_OPTIONS_BY_KEY,
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_CONTRACTS_BY_DESTINATION,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
  MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS,
  isManualOnlyNoAiDestination,
  BENCH_V2_DRAWER_GROUPS,
  getFieldContractByDestination,
  isExactProductGid,
  isExactProductVariantGid,
  isExactMetaobjectDefinitionGid,
  isExactMediaImageGid,
  inspectStoredReferenceListRawValue,
  inspectVerifiedReferenceEvidenceForDestination,
  formatBenchV2ValueDisplay,
  formatOoakDisplayConvention,
  getContractOptionsForObservation,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness
};

// ==========================================================================
// PURE VALIDATION, BASELINE, APPROVAL & KEEP-ORIGINAL HELPERS
// ==========================================================================

const COLLECTION_DATE_PLACEHOLDER_REGEX = /^(n\/a|none|unknown)$/i;
const CANONICAL_DECIMAL_NUMBER_REGEX = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const isBlankOrWhitespaceOnly = (str) =>
  typeof str !== "string" || str.trim() === "";

export function checkExistingWriterStringFidelity(exactProposedValue) {
  if (typeof exactProposedValue !== "string") {
    return {
      faithful: false,
      reason: "Proposed value must be a string."
    };
  }
  if (exactProposedValue.trim() !== exactProposedValue) {
    return {
      faithful: false,
      reason:
        "Existing writer (executeRepairPlan) trims leading/trailing whitespace on save, which would alter your exact untrimmed value. Remove leading/trailing whitespace before approving for save."
    };
  }
  if (/^⚠️\s*/.test(exactProposedValue)) {
    return {
      faithful: false,
      reason:
        "Existing writer (normalizeMetafieldValue) strips leading '⚠️' prefixes, which would alter your exact approved value. Remove the prefix before approving for save."
    };
  }
  return {
    faithful: true,
    reason: null
  };
}

export function validateBatch1ProposedValue({
  productId,
  destinationKey,
  proposedValue,
  baselineSnapshot
}) {
  if (!isExactProductGid(productId)) {
    return { valid: false, code: "invalid_product_gid", reason: "Exact Shopify Product GID is required." };
  }

  if (CANCELLED_INERT_DESTINATIONS.has(destinationKey)) {
    return { valid: false, code: "cancelled_destination", reason: "custom.overall_solid_length_in is cancelled and permanently inert." };
  }

  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return { valid: false, code: "unknown_destination", reason: `Destination "${destinationKey}" is not in the Bench V2 contract.` };
  }

  if (!contract.isWritableInBatch1 || !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(contract.destinationKey)) {
    return {
      valid: false,
      code: "not_writable_in_batch_1",
      reason: `Destination "${contract.destinationKey}" has capability "${contract.writeCapability}" (${contract.batchStage}) and is not writable in Batch 1.`
    };
  }

  const baselineObs = buildBaselineObservation(baselineSnapshot, contract.destinationKey);
  const typeAndCompleteness = evaluateDestinationTypeAndCompleteness({
    contract,
    baselineObs
  });

  if (!typeAndCompleteness.ready) {
    return {
      valid: false,
      code: typeAndCompleteness.code,
      reason: typeAndCompleteness.reason
    };
  }

  const verifiedActualType = typeAndCompleteness.verifiedActualType;

  if (typeof proposedValue !== "string") {
    return {
      valid: false,
      code: "non_string_proposal",
      reason: `Proposed value for "${contract.destinationKey}" must be a string (no implicit coercion).`
    };
  }

  if (isBlankOrWhitespaceOnly(proposedValue)) {
    return {
      valid: false,
      code: "blank_clear_forbidden",
      reason: `Blank or whitespace-only proposals are rejected for "${contract.destinationKey}" (silent clearing/deletion is forbidden).`
    };
  }

  const exactValue = proposedValue;

  if (verifiedActualType === "list.metaobject_reference") {
    let parsedArray;
    try {
      parsedArray = JSON.parse(exactValue);
    } catch {
      return {
        valid: false,
        code: "invalid_reference_json_array",
        reason: `Destination "${contract.destinationKey}" requires a canonical JSON array of Metaobject GIDs (e.g. ["gid://shopify/Metaobject/123"]).`
      };
    }

    if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
      return {
        valid: false,
        code: "empty_or_non_array_reference_list",
        reason: `Destination "${contract.destinationKey}" requires a non-empty JSON array of Metaobject GIDs.`
      };
    }

    const seenGids = new Set();
    for (const item of parsedArray) {
      if (typeof item !== "string" || item.trim() !== item || !isExactMetaobjectGid(item)) {
        return {
          valid: false,
          code: "invalid_metaobject_gid_element",
          reason: `Invalid reference element "${String(item)}" for "${contract.destinationKey}": every item must be an exact "gid://shopify/Metaobject/<id>" string.`
        };
      }
      if (seenGids.has(item)) {
        return {
          valid: false,
          code: "duplicate_metaobject_gid_element",
          reason: `Duplicate Metaobject GID "${item}" in proposal for "${contract.destinationKey}".`
        };
      }
      seenGids.add(item);
    }

    const canonicalSerialized = JSON.stringify(parsedArray);
    if (canonicalSerialized !== exactValue) {
      return {
        valid: false,
        code: "non_canonical_reference_json_serialization",
        reason: `Existing writer serializes this reference list as ${canonicalSerialized}. Use ${canonicalSerialized} so your exact approved value is stored without alteration.`
      };
    }

    const storedCheck = inspectStoredReferenceListRawValue(baselineObs.rawValue);
    if (!storedCheck.valid) {
      return {
        valid: false,
        code: "invalid_stored_reference_list",
        reason: `Existing stored reference list on "${contract.destinationKey}" could not be parsed safely: ${storedCheck.error}`
      };
    }

    for (const existingGid of storedCheck.gids) {
      if (!seenGids.has(existingGid)) {
        return {
          valid: false,
          code: "existing_reference_assignment_dropped",
          reason: `Proposal for "${contract.destinationKey}" is missing existing assigned Metaobject ${existingGid}. Existing reference assignments are preserved and never silently removed.`
        };
      }
    }

    const isUnchangedRefList =
      baselineObs.presence === "present" &&
      storedCheck.gids.length === parsedArray.length &&
      storedCheck.gids.every((g, idx) => g === parsedArray[idx]) &&
      typeof baselineObs.rawValue === "string" &&
      baselineObs.rawValue === exactValue;

    if (isUnchangedRefList) {
      return {
        valid: true,
        code: "unchanged_from_baseline",
        normalizedValue: exactValue,
        isUnchangedFromStored: true,
        verifiedActualType,
        observedShopifyType: typeAndCompleteness.observedShopifyType,
        typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
        baselineObservation: baselineObs,
        reason: "Proposed value is identical to the current stored baseline."
      };
    }

    const refEvidence = inspectVerifiedReferenceEvidenceForDestination(
      baselineSnapshot,
      contract.destinationKey,
      baselineObs.restrictedMetaobjectDefinitionId
    );

    if (!refEvidence.evidenceLoaded || !refEvidence.isComplete) {
      return {
        valid: false,
        code: "reference_entries_not_verified",
        reason:
          refEvidence.error ||
          `Verified Metaobject entries for "${contract.destinationKey}" have not been loaded. Click "Load Reference Choices" in Drawer 10 before approving.`
      };
    }

    for (const proposedGid of parsedArray) {
      const verifiedEntry = refEvidence.entriesByGid.get(proposedGid);
      if (!verifiedEntry) {
        return {
          valid: false,
          code: "unverified_metaobject_entry_membership",
          reason: `Metaobject "${proposedGid}" is not a verified entry of required definition "${baselineObs.restrictedMetaobjectDefinitionId}" for "${contract.destinationKey}".`
        };
      }
      if (verifiedEntry.definitionId !== baselineObs.restrictedMetaobjectDefinitionId) {
        return {
          valid: false,
          code: "metaobject_definition_mismatch",
          reason: `Metaobject "${proposedGid}" belongs to definition "${verifiedEntry.definitionId}", but "${contract.destinationKey}" requires "${baselineObs.restrictedMetaobjectDefinitionId}".`
        };
      }
    }

    return {
      valid: true,
      code: "valid_change",
      normalizedValue: exactValue,
      isUnchangedFromStored: false,
      verifiedActualType,
      observedShopifyType: typeAndCompleteness.observedShopifyType,
      typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
      baselineObservation: baselineObs,
      reason: "Valid Batch 1 standardized reference proposed change."
    };
  } else if (verifiedActualType === "boolean") {
    if (exactValue !== "true" && exactValue !== "false") {
      return {
        valid: false,
        code: "invalid_boolean_literal",
        reason: `Destination "${contract.destinationKey}" has observed Shopify type "boolean" on this product and requires exact "true" or "false" (received "${exactValue}").`
      };
    }
  } else if (verifiedActualType === "number_decimal") {
    if (!CANONICAL_DECIMAL_NUMBER_REGEX.test(exactValue)) {
      return {
        valid: false,
        code: "invalid_decimal_number",
        reason: `Destination "${contract.destinationKey}" requires a non-negative decimal number without units, spaces, or leading zeros (e.g. "14.5" or "28"; received "${exactValue}").`
      };
    }
    const parsedNum = Number(exactValue);
    const writerSerialized = String(parseFloat(exactValue));
    if (!Number.isFinite(parsedNum) || parsedNum < 0) {
      return {
        valid: false,
        code: "non_finite_or_negative_decimal",
        reason: `Destination "${contract.destinationKey}" requires a finite non-negative decimal number (received "${exactValue}").`
      };
    }
    if (writerSerialized !== exactValue) {
      return {
        valid: false,
        code: "non_canonical_decimal_representation",
        reason: `Existing writer serializes "${exactValue}" as "${writerSerialized}" on save. Enter "${writerSerialized}" so your exact approved value is stored without alteration.`
      };
    }
  } else if (verifiedActualType === "single_line_text_field") {
    if (contract.maxLength !== null && exactValue.length > contract.maxLength) {
      return {
        valid: false,
        code: "exceeds_max_length",
        reason: `Value for "${contract.destinationKey}" (${exactValue.length} chars) exceeds the ${contract.maxLength}-character limit.`
      };
    }

    const trimmedForShapeCheck = exactValue.trim();
    if (
      exactValue === "[object Object]" ||
      trimmedForShapeCheck === "[object Object]" ||
      /^gid:\/\//i.test(trimmedForShapeCheck) ||
      /gid:\/\/shopify\//i.test(exactValue) ||
      /^shopify:\/\/metaobject/i.test(trimmedForShapeCheck) ||
      /^metaobject[:/]/i.test(trimmedForShapeCheck) ||
      ((trimmedForShapeCheck.startsWith("[") && trimmedForShapeCheck.endsWith("]")) ||
        (trimmedForShapeCheck.startsWith("{") && trimmedForShapeCheck.endsWith("}")))
    ) {
      return {
        valid: false,
        code: "invalid_plain_text_shape",
        reason: `Rejected reference, GID, or JSON-container shape for plain-text destination "${contract.destinationKey}".`
      };
    }
  }

  if (
    contract.destinationKey === "custom.collection_date" &&
    (COLLECTION_DATE_PLACEHOLDER_REGEX.test(exactValue) || COLLECTION_DATE_PLACEHOLDER_REGEX.test(exactValue.trim()))
  ) {
    return {
      valid: false,
      code: "placeholder_date_rejected",
      reason: `Placeholder value "${exactValue}" is not a valid collection_date and cannot be written to Shopify.`
    };
  }

  const storedRaw = baselineObs.rawValue;
  const isUnchangedFromStored =
    baselineObs.presence === "present" &&
    typeof storedRaw === "string" &&
    storedRaw === exactValue;

  return {
    valid: true,
    code: isUnchangedFromStored ? "unchanged_from_baseline" : "valid_change",
    normalizedValue: exactValue,
    isUnchangedFromStored,
    verifiedActualType,
    observedShopifyType: typeAndCompleteness.observedShopifyType,
    typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
    baselineObservation: baselineObs,
    reason: isUnchangedFromStored
      ? "Proposed value is identical to the current stored baseline."
      : "Valid Batch 1 proposed change."
  };
}

export function createExactValueApprovalRecord({
  productId,
  destinationKey,
  proposedValue,
  baselineSnapshot
}) {
  const contract = getFieldContractByDestination(destinationKey);
  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue,
    baselineSnapshot
  });

  if (!validation.valid || !contract) {
    return {
      ok: false,
      error: validation.reason || "Invalid destination contract.",
      code: validation.code || "unknown_destination",
      record: null
    };
  }

  if (validation.isUnchangedFromStored) {
    return {
      ok: false,
      error: `Cannot approve "${destinationKey}": proposed value is identical to the stored Shopify value.`,
      code: "unchanged_from_baseline",
      record: null
    };
  }

  const obs = validation.baselineObservation;
  const isVariantOwner = contract.owner === "PRODUCTVARIANT";
  if (isVariantOwner && !isExactProductVariantGid(obs.variantId)) {
    return {
      ok: false,
      error: `Cannot approve "${destinationKey}": exact Shopify ProductVariant GID is not verified.`,
      code: "invalid_variant_gid",
      record: null
    };
  }

  const isShopifyReference = contract.namespace === "shopify";
  if (
    isShopifyReference &&
    !isExactMetaobjectDefinitionGid(obs.restrictedMetaobjectDefinitionId)
  ) {
    return {
      ok: false,
      error: `Cannot approve "${destinationKey}": restricted MetaobjectDefinition GID is not verified.`,
      code: "missing_restricted_metaobject_definition",
      record: null
    };
  }

  const record = Object.freeze({
    kind: "exact_value_approval",
    productId,
    owner: contract.owner,
    variantId: isVariantOwner ? obs.variantId : null,
    restrictedMetaobjectDefinitionId: isShopifyReference
      ? obs.restrictedMetaobjectDefinitionId
      : null,
    productCategoryId: isShopifyReference ? (obs.productCategoryId || null) : null,
    categoryEligibilityStatus: isShopifyReference
      ? (obs.categoryEligibility?.status || null)
      : null,
    destinationKey: obs.destinationKey,
    approvedValue: validation.normalizedValue,
    verifiedType: validation.verifiedActualType,
    typeEvidenceSource: validation.typeEvidenceSource || null,
    baselineSignature: obs.signature,
    approvedAt: new Date().toISOString()
  });

  return { ok: true, error: null, code: "approved", record };
}

export function isExactValueApprovalValid({
  approvalRecord,
  productId,
  destinationKey,
  currentProposedValue,
  baselineSnapshot
}) {
  if (!approvalRecord || typeof approvalRecord !== "object") return false;
  if (approvalRecord.kind !== "exact_value_approval") return false;
  if (!isExactProductGid(productId) || approvalRecord.productId !== productId) return false;
  if (typeof destinationKey !== "string" || approvalRecord.destinationKey !== destinationKey) return false;
  if (typeof currentProposedValue !== "string") return false;

  if (isBlankOrWhitespaceOnly(currentProposedValue) || approvalRecord.approvedValue !== currentProposedValue) {
    return false;
  }

  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) return false;

  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue: currentProposedValue,
    baselineSnapshot
  });
  if (!validation.valid || validation.isUnchangedFromStored) return false;
  if (approvalRecord.verifiedType !== validation.verifiedActualType) return false;
  if (approvalRecord.baselineSignature !== validation.baselineObservation.signature) return false;

  if (contract.owner === "PRODUCTVARIANT") {
    if (approvalRecord.owner !== "PRODUCTVARIANT") return false;
    if (
      !isExactProductVariantGid(approvalRecord.variantId) ||
      approvalRecord.variantId !== validation.baselineObservation.variantId
    ) {
      return false;
    }
  } else {
    if (approvalRecord.owner !== undefined && approvalRecord.owner !== contract.owner) {
      return false;
    }
    if (approvalRecord.variantId !== undefined && approvalRecord.variantId !== null) {
      return false;
    }
  }

  if (contract.namespace === "shopify") {
    const obs = validation.baselineObservation;
    if (
      !isExactMetaobjectDefinitionGid(approvalRecord.restrictedMetaobjectDefinitionId) ||
      approvalRecord.restrictedMetaobjectDefinitionId !== obs.restrictedMetaobjectDefinitionId
    ) {
      return false;
    }
    if ((approvalRecord.productCategoryId || null) !== (obs.productCategoryId || null)) {
      return false;
    }
    if (
      (approvalRecord.categoryEligibilityStatus || null) !==
      (obs.categoryEligibility?.status || null)
    ) {
      return false;
    }
  }

  return true;
}

export function createKeepOriginalRecord({
  productId,
  destinationKey,
  rejectedProposedValue,
  baselineSnapshot
}) {
  if (!isExactProductGid(productId)) {
    return { ok: false, error: "Exact Shopify Product GID is required.", record: null };
  }
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return { ok: false, error: `Unknown destination "${destinationKey}".`, record: null };
  }
  if (isBlankOrWhitespaceOnly(rejectedProposedValue)) {
    return { ok: false, error: "Keep Original requires a non-empty staged proposal to reject.", record: null };
  }

  const baselineObs = buildBaselineObservation(baselineSnapshot, contract.destinationKey);
  if (!baselineObs.evidenceAvailable) {
    const isVariantOwner = contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
    let errText = `Baseline evidence is not loaded for "${contract.destinationKey}".`;
    if (baselineObs.presence === "unknown_incomplete_read") {
      errText = isVariantOwner
        ? `Variant baseline read is incomplete for "${contract.destinationKey}"; cannot bind Keep Original until variantMetafieldsReadComplete === true.`
        : `Baseline read is incomplete for "${contract.destinationKey}"; cannot bind Keep Original until metafieldsReadComplete === true.`;
    } else if (baselineObs.presence === "multiple_variants_hold") {
      errText = `Product has multiple variants; "${contract.destinationKey}" is held read-only.`;
    } else if (baselineObs.presence === "zero_variants_hold") {
      errText = `Product has zero variants; "${contract.destinationKey}" is held read-only.`;
    }
    return {
      ok: false,
      error: errText,
      record: null
    };
  }

  const isVariantOwner = contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
  if (isVariantOwner && !isExactProductVariantGid(baselineObs.variantId)) {
    return {
      ok: false,
      error: `Exact Shopify ProductVariant GID is required to bind Keep Original on "${contract.destinationKey}".`,
      record: null
    };
  }

  const exactRejectedProposal = rejectedProposedValue;
  if (baselineObs.presence === "present" && baselineObs.rawValue === exactRejectedProposal) {
    return { ok: false, error: "Proposal already matches the stored value.", record: null };
  }

  const record = Object.freeze({
    kind: "keep_original_decision",
    productId,
    owner: contract.owner,
    variantId: isVariantOwner ? baselineObs.variantId : null,
    destinationKey: contract.destinationKey,
    rejectedProposalValue: exactRejectedProposal,
    baselinePresence: baselineObs.presence,
    baselineRawValue: baselineObs.rawValue,
    baselineSignature: baselineObs.signature,
    decidedAt: new Date().toISOString()
  });

  return { ok: true, error: null, record };
}

export function isKeepOriginalRecordValid({
  keepOriginalRecord,
  productId,
  destinationKey,
  currentProposedValue,
  baselineSnapshot
}) {
  if (!keepOriginalRecord || typeof keepOriginalRecord !== "object") return false;
  if (keepOriginalRecord.kind !== "keep_original_decision") return false;
  if (!isExactProductGid(productId) || keepOriginalRecord.productId !== productId) return false;
  if (typeof destinationKey !== "string" || keepOriginalRecord.destinationKey !== destinationKey) return false;
  if (typeof currentProposedValue !== "string") return false;

  if (isBlankOrWhitespaceOnly(currentProposedValue) || keepOriginalRecord.rejectedProposalValue !== currentProposedValue) {
    return false;
  }

  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) return false;

  const baselineObs = buildBaselineObservation(baselineSnapshot, contract.destinationKey);
  if (!baselineObs.evidenceAvailable) return false;
  if (keepOriginalRecord.baselineSignature !== baselineObs.signature) return false;

  const isVariantOwner = contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
  if (isVariantOwner) {
    if (keepOriginalRecord.owner !== "PRODUCTVARIANT") return false;
    if (
      !isExactProductVariantGid(keepOriginalRecord.variantId) ||
      keepOriginalRecord.variantId !== baselineObs.variantId
    ) {
      return false;
    }
  } else {
    if (keepOriginalRecord.owner !== undefined && keepOriginalRecord.owner !== contract.owner) {
      return false;
    }
    if (keepOriginalRecord.variantId !== undefined && approvalOrKeepHasVariantId(keepOriginalRecord)) {
      return false;
    }
  }

  return true;
}

function approvalOrKeepHasVariantId(rec) {
  return rec.variantId !== undefined && rec.variantId !== null;
}

export function evaluateBenchV2FieldRow({
  productId,
  destinationKey,
  baselineSnapshot,
  proposedMapForProduct,
  approvalsMapForProduct,
  keepOriginalMapForProduct
}) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return null;
  }

  const baselineObs = buildBaselineObservation(baselineSnapshot, contract.destinationKey);
  const typeAndCompleteness = contract.isWritableInBatch1
    ? evaluateDestinationTypeAndCompleteness({ contract, baselineObs })
    : null;

  const observedType = baselineObs.liveDefType || baselineObs.storedType || null;
  const isShopifyReference = contract.namespace === "shopify";
  const usesMeaningDisplay = Boolean(contract.usesYesNoMeaningDisplay || isShopifyReference);

  const refEvidence = isShopifyReference
    ? inspectVerifiedReferenceEvidenceForDestination(
        baselineSnapshot,
        contract.destinationKey,
        baselineObs.restrictedMetaobjectDefinitionId
      )
    : null;

  const verifiedEntriesMap =
    refEvidence && refEvidence.isComplete ? refEvidence.entriesByGid : null;

  const hasProposalKey = Boolean(
    proposedMapForProduct &&
    typeof proposedMapForProduct === "object" &&
    Object.prototype.hasOwnProperty.call(proposedMapForProduct, contract.destinationKey)
  );
  const rawPropEntry = hasProposalKey ? proposedMapForProduct[contract.destinationKey] : undefined;
  const proposedValue =
    rawPropEntry && typeof rawPropEntry === "object" && typeof rawPropEntry.value === "string"
      ? rawPropEntry.value
      : typeof rawPropEntry === "string"
        ? rawPropEntry
        : "";
  const proposalSource =
    rawPropEntry && typeof rawPropEntry === "object" && typeof rawPropEntry.source === "string"
      ? rawPropEntry.source
      : hasProposalKey
        ? "Manual"
        : "None";

  const hasNonEmptyProposal = hasProposalKey && !isBlankOrWhitespaceOnly(proposedValue);

  const approvalRec = approvalsMapForProduct?.[contract.destinationKey] || null;
  const keepOrigRec = keepOriginalMapForProduct?.[contract.destinationKey] || null;

  const isKeepOriginal =
    hasNonEmptyProposal &&
    isKeepOriginalRecordValid({
      keepOriginalRecord: keepOrigRec,
      productId,
      destinationKey: contract.destinationKey,
      currentProposedValue: proposedValue,
      baselineSnapshot
    });

  const validation = hasNonEmptyProposal
    ? validateBatch1ProposedValue({
        productId,
        destinationKey: contract.destinationKey,
        proposedValue,
        baselineSnapshot
      })
    : null;

  const isApproved =
    !isKeepOriginal &&
    hasNonEmptyProposal &&
    Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
    isExactValueApprovalValid({
      approvalRecord: approvalRec,
      productId,
      destinationKey: contract.destinationKey,
      currentProposedValue: proposedValue,
      baselineSnapshot
    });

  let connectionStatus = "Read-Only";
  if (contract.isWritableInBatch1) {
    if (!baselineObs.evidenceAvailable) {
      if (baselineObs.presence === "multiple_variants_hold") {
        connectionStatus = "Held (Multiple Variants — Single-Variant Target Required)";
      } else if (baselineObs.presence === "zero_variants_hold") {
        connectionStatus = "Blocked (Product Has Zero Variants)";
      } else if (baselineObs.presence === "invalid_variant_gid") {
        connectionStatus = "Blocked (Missing or Invalid Variant GID)";
      } else if (baselineObs.presence === "unknown_incomplete_read") {
        connectionStatus =
          contract.owner === "PRODUCTVARIANT"
            ? `Blocked (Variant Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`
            : `Blocked (Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`;
      } else {
        connectionStatus =
          contract.owner === "PRODUCTVARIANT"
            ? "Blocked (Variant Baseline Not Loaded)"
            : "Blocked (Baseline Not Loaded)";
      }
    } else if (!typeAndCompleteness?.ready) {
      if (
        typeAndCompleteness?.code === "metafields_read_not_complete" ||
        typeAndCompleteness?.code === "variant_metafields_read_not_complete"
      ) {
        connectionStatus = `Blocked (Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`;
      } else if (
        typeAndCompleteness?.code === "definitions_read_not_complete" ||
        typeAndCompleteness?.code === "variant_definitions_read_not_complete"
      ) {
        connectionStatus = `Blocked (Definitions Read Incomplete: ${baselineObs.defsCompleteState})`;
      } else if (
        typeAndCompleteness?.code === "destination_definition_error" ||
        typeAndCompleteness?.code === "category_eligibility_incomplete" ||
        typeAndCompleteness?.code === "product_category_read_not_complete" ||
        typeAndCompleteness?.code === "missing_restricted_metaobject_definition"
      ) {
        connectionStatus = isShopifyReference
          ? `Blocked (${baselineObs.categoryEligibility?.status === "category_ineligible" ? "Category Constraint Ineligible" : "Definition / Category Constraint Error"})`
          : "Blocked (Definition / Constraint Error)";
      } else if (typeAndCompleteness?.code === "missing_type_evidence") {
        connectionStatus = "Blocked (Missing Live Definition / Stored Type Evidence)";
      } else if (
        typeAndCompleteness?.code === "live_vs_stored_type_conflict" ||
        typeAndCompleteness?.code === "contract_type_mismatch"
      ) {
        connectionStatus = "Blocked (Type Conflict)";
      } else {
        connectionStatus = "Blocked (Eligibility Check Failed)";
      }
    } else if (isShopifyReference) {
      if (refEvidence && refEvidence.isComplete) {
        connectionStatus = `Connected (Standardized Reference Writable — Verified Def: ${baselineObs.restrictedMetaobjectDefinitionId}; ${refEvidence.entriesByGid.size} Verified Choice${refEvidence.entriesByGid.size === 1 ? "" : "s"})`;
      } else {
        connectionStatus = `Connected (Standardized Reference Eligible — Load Reference Choices to Verify ${baselineObs.restrictedMetaobjectDefinitionId} Entries)`;
      }
    } else if (typeAndCompleteness.typeEvidenceSource === "reviewed_exact_contract") {
      connectionStatus = `Connected (Batch 1 Writable — Reviewed Contract Type: ${typeAndCompleteness.verifiedActualType}; No Live Definition / Stored Type on Product)`;
    } else {
      connectionStatus =
        contract.owner === "PRODUCTVARIANT"
          ? `Connected (Single-Variant Writable — Verified Type: ${typeAndCompleteness.verifiedActualType})`
          : `Connected (Batch 1 Writable — Verified Type: ${typeAndCompleteness.verifiedActualType})`;
    }
  } else if (
    contract.batchStage === BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR ||
    contract.batchStage === BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR
  ) {
    connectionStatus = `Read-Only Descriptor (${contract.batchStage})`;
  } else if (contract.batchStage === BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY) {
    connectionStatus = "Read-Only (Task-Restricted: No Price/Shipping Writes)";
  } else if (contract.batchStage === BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY) {
    connectionStatus = contract.canonicalTarget
      ? `Read-Only Compatibility (Canonical: ${contract.canonicalTarget})`
      : "Read-Only in Batch 1 (Distinct Fact)";
  } else if (contract.batchStage === BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD) {
    connectionStatus = `Read-Only Hold (${contract.writeCapability})`;
  } else if (contract.batchStage === BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY) {
    connectionStatus = "Protected App Data (Read-Only)";
  } else {
    connectionStatus = "Parked / Excluded (Read-Only)";
  }

  let reviewStatus = "Unchanged";
  let statusReason = contract.purposeNote || null;

  if (!baselineObs.evidenceAvailable) {
    if (baselineObs.presence === "unknown_incomplete_read") {
      reviewStatus = "Incomplete Baseline Read (Cannot Infer Absence)";
      statusReason =
        contract.owner === "PRODUCTVARIANT"
          ? `Variant metafield read completeness is "${baselineObs.metafieldsCompleteState}"; absence is never inferred from partial or unflagged reads.`
          : `Metafield read completeness is "${baselineObs.metafieldsCompleteState}"; absence is never inferred from partial or unflagged reads.`;
    } else if (baselineObs.presence === "multiple_variants_hold") {
      reviewStatus = "Held (Multiple Variants)";
      statusReason = `Product has multiple variants; "${contract.destinationKey}" is held read-only unless a single unambiguous variant is present.`;
    } else if (baselineObs.presence === "zero_variants_hold") {
      reviewStatus = "Held (Zero Variants)";
      statusReason = `Product has zero variants; "${contract.destinationKey}" cannot target a variant.`;
    } else {
      reviewStatus = "Baseline Unavailable";
      statusReason = `Baseline state: ${baselineObs.presence}`;
    }
  } else if (isKeepOriginal) {
    reviewStatus = "Keep Original (Proposal Rejected)";
    statusReason = "Bound to current baseline signature; omitted from save payload.";
  } else if (isApproved) {
    reviewStatus = "Approved for Save (Exact Value Bound)";
    statusReason =
      contract.owner === "PRODUCTVARIANT" && baselineObs.variantId
        ? `Approved exact value (${validation.verifiedActualType}) bound to variant ${baselineObs.variantId}.`
        : isShopifyReference
          ? `Approved exact Metaobject GID list (${validation.verifiedActualType}) bound to definition ${baselineObs.restrictedMetaobjectDefinitionId}.`
          : validation.typeEvidenceSource === "reviewed_exact_contract"
            ? `Approved exact value (${validation.verifiedActualType} via reviewed exact contract).`
            : `Approved exact value (${validation.verifiedActualType}).`;
  } else if (hasNonEmptyProposal) {
    if (!validation.valid) {
      reviewStatus = "Blocked Proposal";
      statusReason = validation.reason;
    } else if (validation.isUnchangedFromStored) {
      reviewStatus = "Unchanged (Matches Stored Value)";
      statusReason = validation.reason;
    } else {
      reviewStatus = "Proposed (Requires Exact Approval)";
      statusReason = "Unapproved change; check Approve to include in explicit Save.";
    }
  } else if (hasProposalKey && isBlankOrWhitespaceOnly(proposedValue)) {
    reviewStatus = "Empty Draft Input (Not Writable)";
    statusReason = "Blank input cannot be approved or written; clear draft edit or enter a valid value.";
  } else if (contract.isWritableInBatch1 && typeAndCompleteness && !typeAndCompleteness.ready) {
    statusReason = typeAndCompleteness.reason;
  } else if (isShopifyReference && typeAndCompleteness?.ready && (!refEvidence || !refEvidence.isComplete)) {
    statusReason =
      refEvidence?.error ||
      `Click "Load Reference Choices" in Drawer 10 to verify allowed Metaobject entries for ${baselineObs.restrictedMetaobjectDefinitionId}.`;
  }

  const baselineDisplayValue = usesMeaningDisplay
    ? formatBenchV2ValueDisplay(
        contract.destinationKey,
        baselineObs.rawValue,
        observedType,
        verifiedEntriesMap
      )
    : (baselineObs.rawValue ?? "");

  const proposedDisplayValue = usesMeaningDisplay && hasNonEmptyProposal
    ? formatBenchV2ValueDisplay(
        contract.destinationKey,
        proposedValue,
        observedType,
        verifiedEntriesMap
      )
    : proposedValue;

  return Object.freeze({
    contract,
    baselineObservation: baselineObs,
    typeAndCompleteness,
    referenceEvidence: refEvidence,
    baselineDisplayValue,
    options: getContractOptionsForObservation(contract, baselineObs, baselineSnapshot),
    hasProposalKey,
    proposedValue,
    proposedDisplayValue,
    proposalSource,
    validation,
    isApproved,
    isKeepOriginal,
    connectionStatus,
    reviewStatus,
    statusReason
  });
}
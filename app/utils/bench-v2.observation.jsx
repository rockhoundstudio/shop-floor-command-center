// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 BASELINE OBSERVATION & REFERENCE EVIDENCE
// File: app/utils/bench-v2.observation.jsx
// Pure browser-safe observation module: zero React hooks/effects, zero storage,
// zero GraphQL/network calls, zero server-only imports.
// ==========================================================================

import {
  isExactMetaobjectGid,
  extractEntryGid,
  extractEntryLabel,
  extractEntryDefinitionId,
  formatDisplayFieldValue
} from "./meta-injector.standardized.jsx";
import {
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  BENCH_V2_OPTIONS_BY_KEY,
  getFieldContractByDestination
} from "./bench-v2.registry.jsx";

const EXACT_PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const EXACT_PRODUCT_VARIANT_GID_REGEX = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const EXACT_METAOBJECT_DEF_GID_REGEX = /^gid:\/\/shopify\/MetaobjectDefinition\/\d+$/;
const EXACT_MEDIA_IMAGE_GID_REGEX = /^gid:\/\/shopify\/MediaImage\/\d+$/;
const MULTILINE_SCOPED_DESTINATION_ERROR_REGEX = /^\[([^\]]+)\]\s*([\s\S]+)$/;

export function isExactProductGid(value) {
  return typeof value === "string" && EXACT_PRODUCT_GID_REGEX.test(value);
}

export function isExactProductVariantGid(value) {
  return typeof value === "string" && EXACT_PRODUCT_VARIANT_GID_REGEX.test(value);
}

export function isExactMetaobjectDefinitionGid(value) {
  return typeof value === "string" && EXACT_METAOBJECT_DEF_GID_REGEX.test(value);
}

export function isExactMediaImageGid(value) {
  return typeof value === "string" && EXACT_MEDIA_IMAGE_GID_REGEX.test(value);
}

/**
 * Inspects and normalizes a stored `list.metaobject_reference` raw value.
 * Never treats malformed or non-GID values as empty.
 */
export function inspectStoredReferenceListRawValue(rawVal) {
  if (rawVal === undefined || rawVal === null) {
    return { valid: true, gids: [], error: null };
  }
  if (typeof rawVal !== "string") {
    return {
      valid: false,
      gids: [],
      error: "Stored reference value is not a string."
    };
  }
  const trimmed = rawVal.trim();
  if (trimmed === "") {
    return { valid: true, gids: [], error: null };
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) {
      return {
        valid: false,
        gids: [],
        error: "Stored reference value is not a JSON array."
      };
    }
    const gids = [];
    for (const item of parsed) {
      if (typeof item !== "string" || !isExactMetaobjectGid(item.trim())) {
        return {
          valid: false,
          gids: [],
          error: `Stored reference array contains non-Metaobject GID item "${String(item)}".`
        };
      }
      const cleanGid = item.trim();
      if (!gids.includes(cleanGid)) {
        gids.push(cleanGid);
      }
    }
    return { valid: true, gids, error: null };
  } catch {
    if (isExactMetaobjectGid(trimmed)) {
      return { valid: true, gids: [trimmed], error: null };
    }
    return {
      valid: false,
      gids: [],
      error: "Stored reference value is not a valid JSON array of Metaobject GIDs."
    };
  }
}

/**
 * Extracts verified reference entry evidence for a `shopify.*` destination from
 * `baselineSnapshot` (`verifiedReferenceEntriesByDestination[destinationKey]` or
 * `standardizedReferenceResolutions.resolutions[destinationKey]`).
 *
 * Returns a uniform evidence descriptor:
 * - `evidenceLoaded`: true when a read-only resolution payload for the active product is present
 * - `isComplete`: true when enumeration and category/definition checks completed without error
 * - `restrictedMetaobjectDefinitionId`: verified MetaobjectDefinition GID
 * - `entriesByGid`: Map of verified Metaobject GID -> `{ id, label, definitionId }` where `definitionId === restrictedMetaobjectDefinitionId`
 */
export function inspectVerifiedReferenceEvidenceForDestination(
  baselineSnapshot,
  destinationKey,
  expectedRestrictedDefId = null
) {
  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return {
      evidenceLoaded: false,
      isComplete: false,
      restrictedMetaobjectDefinitionId: null,
      entriesByGid: new Map(),
      error: "Baseline snapshot is not loaded."
    };
  }

  const productGid = baselineSnapshot.productId;
  const directMap =
    baselineSnapshot.verifiedReferenceEntriesByDestination &&
    typeof baselineSnapshot.verifiedReferenceEntriesByDestination === "object" &&
    !Array.isArray(baselineSnapshot.verifiedReferenceEntriesByDestination)
      ? baselineSnapshot.verifiedReferenceEntriesByDestination[destinationKey]
      : null;

  const topResEnvelope =
    baselineSnapshot.standardizedReferenceResolutions &&
    typeof baselineSnapshot.standardizedReferenceResolutions === "object" &&
    !Array.isArray(baselineSnapshot.standardizedReferenceResolutions)
      ? baselineSnapshot.standardizedReferenceResolutions
      : null;

  if (!directMap && !topResEnvelope) {
    return {
      evidenceLoaded: false,
      isComplete: false,
      restrictedMetaobjectDefinitionId: expectedRestrictedDefId || null,
      entriesByGid: new Map(),
      error: `Verified Metaobject reference choices have not been loaded for "${destinationKey}". Click "Retry Reference Choices" in this drawer to verify allowed entries.`
    };
  }

  if (topResEnvelope) {
    const topRawErrors = Array.isArray(topResEnvelope.errors)
      ? topResEnvelope.errors.filter((e) => typeof e === "string" && e.trim() !== "")
      : [];
    if (
      typeof topResEnvelope.error === "string" &&
      topResEnvelope.error.trim() !== "" &&
      !topRawErrors.includes(topResEnvelope.error.trim())
    ) {
      topRawErrors.unshift(topResEnvelope.error.trim());
    }

    const hasResolutionsMap = Boolean(
      topResEnvelope.resolutions &&
        typeof topResEnvelope.resolutions === "object" &&
        !Array.isArray(topResEnvelope.resolutions)
    );
    const hasCurrentRefListsMap = Boolean(
      topResEnvelope.currentReferenceLists &&
        typeof topResEnvelope.currentReferenceLists === "object" &&
        !Array.isArray(topResEnvelope.currentReferenceLists)
    );
    const hasCategoryEligibilityMap = Boolean(
      topResEnvelope.categoryEligibility &&
        typeof topResEnvelope.categoryEligibility === "object" &&
        !Array.isArray(topResEnvelope.categoryEligibility)
    );

    const unscopedOrMatchingTopErrors = topRawErrors.filter((errText) => {
      const bracketMatch = MULTILINE_SCOPED_DESTINATION_ERROR_REGEX.exec(
        errText.trim()
      );
      if (!bracketMatch) return true;
      const scopedDest = bracketMatch[1].trim();
      if (!BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(scopedDest)) {
        return true;
      }
      return scopedDest === destinationKey;
    });

    const baselineCatId = baselineSnapshot.productCategory?.id || null;
    const responseCatId = topResEnvelope.productCategory?.id || null;
    const categoryMatchesBaseline =
      topResEnvelope.productCategory === undefined || baselineCatId === responseCatId;

    if (
      topResEnvelope.intent !== "resolveStandardizedCandidates" ||
      topResEnvelope.pieceId !== productGid ||
      topResEnvelope.readOnly !== true ||
      topResEnvelope.defsReadComplete !== true ||
      !hasResolutionsMap ||
      !hasCurrentRefListsMap ||
      !hasCategoryEligibilityMap ||
      !categoryMatchesBaseline ||
      unscopedOrMatchingTopErrors.length > 0
    ) {
      const topErr =
        unscopedOrMatchingTopErrors[0] ||
        (!categoryMatchesBaseline
          ? "Product category changed since reference resolution was loaded."
          : topResEnvelope.defsReadComplete !== true
            ? "Live PRODUCT metafield definitions read did not complete."
            : "Top-level standardized reference resolution failed prerequisite or identity checks.");
      return {
        evidenceLoaded: true,
        isComplete: false,
        restrictedMetaobjectDefinitionId: expectedRestrictedDefId || null,
        entriesByGid: new Map(),
        error: topErr
      };
    }

    const destRefListEntry =
      topResEnvelope.currentReferenceLists[destinationKey] ||
      (directMap &&
      typeof directMap === "object" &&
      directMap.currentAssignment &&
      typeof directMap.currentAssignment === "object"
        ? directMap.currentAssignment
        : null);
    const isDestRefListCompleteAndValid = Boolean(
      destRefListEntry &&
        typeof destRefListEntry === "object" &&
        destRefListEntry.readComplete === true &&
        destRefListEntry.parseValid === true
    );

    if (!isDestRefListCompleteAndValid) {
      const destRefErr = !destRefListEntry || typeof destRefListEntry !== "object"
        ? `Missing currentReferenceLists entry for "${destinationKey}".`
        : destRefListEntry.parseError ||
          `Stored reference list read or parse was incomplete for "${destinationKey}".`;
      return {
        evidenceLoaded: true,
        isComplete: false,
        restrictedMetaobjectDefinitionId: expectedRestrictedDefId || null,
        entriesByGid: new Map(),
        error: destRefErr
      };
    }
  }

  const resolutionEntry =
    directMap ||
    (topResEnvelope &&
    topResEnvelope.resolutions &&
    typeof topResEnvelope.resolutions === "object"
      ? topResEnvelope.resolutions[destinationKey]
      : null);

  if (!resolutionEntry || typeof resolutionEntry !== "object") {
    return {
      evidenceLoaded: Boolean(topResEnvelope),
      isComplete: false,
      restrictedMetaobjectDefinitionId: expectedRestrictedDefId || null,
      entriesByGid: new Map(),
      error: topResEnvelope
        ? `Missing resolution entry for "${destinationKey}" in standardized reference response.`
        : `Verified Metaobject reference choices have not been loaded for "${destinationKey}". Click "Retry Reference Choices" in this drawer to verify allowed entries.`
    };
  }

  const refAssignmentObj =
    topResEnvelope?.currentReferenceLists?.[destinationKey] ||
    resolutionEntry.currentAssignment ||
    null;

  if (
    !refAssignmentObj ||
    typeof refAssignmentObj !== "object" ||
    refAssignmentObj.readComplete !== true ||
    refAssignmentObj.parseValid !== true
  ) {
    return {
      evidenceLoaded: true,
      isComplete: false,
      restrictedMetaobjectDefinitionId: expectedRestrictedDefId || null,
      entriesByGid: new Map(),
      error:
        refAssignmentObj?.parseError ||
        `Stored reference list read or parse was incomplete for "${destinationKey}".`
    };
  }

  const resolvedDefId =
    resolutionEntry.restrictedMetaobjectDefinitionId ||
    resolutionEntry.restrictedMetaobjectDefinition?.id ||
    resolutionEntry.metafieldDefinition?.restrictedMetaobjectDefinitionId ||
    null;

  if (!isExactMetaobjectDefinitionGid(resolvedDefId)) {
    return {
      evidenceLoaded: true,
      isComplete: false,
      restrictedMetaobjectDefinitionId: null,
      entriesByGid: new Map(),
      error:
        (Array.isArray(resolutionEntry.errors) && resolutionEntry.errors[0]) ||
        `Missing or invalid restricted MetaobjectDefinition GID on "${destinationKey}".`
    };
  }

  if (
    expectedRestrictedDefId &&
    isExactMetaobjectDefinitionGid(expectedRestrictedDefId) &&
    resolvedDefId !== expectedRestrictedDefId
  ) {
    return {
      evidenceLoaded: true,
      isComplete: false,
      restrictedMetaobjectDefinitionId: resolvedDefId,
      entriesByGid: new Map(),
      error: `Restricted MetaobjectDefinition mismatch on "${destinationKey}": baseline expects "${expectedRestrictedDefId}" but resolution reported "${resolvedDefId}".`
    };
  }

  const catEligObj =
    resolutionEntry.categoryEligibility ||
    topResEnvelope?.categoryEligibility?.[destinationKey] ||
    baselineSnapshot.categoryEligibilityByDestination?.[destinationKey] ||
    null;

  if (
    !catEligObj ||
    typeof catEligObj !== "object" ||
    catEligObj.isComplete !== true ||
    catEligObj.isEligible !== true ||
    resolutionEntry.isCategoryEligible === false ||
    resolutionEntry.status === "category_ineligible"
  ) {
    return {
      evidenceLoaded: true,
      isComplete: false,
      restrictedMetaobjectDefinitionId: resolvedDefId,
      entriesByGid: new Map(),
      error:
        catEligObj?.reason ||
        (Array.isArray(resolutionEntry.errors) && resolutionEntry.errors[0]) ||
        `Category eligibility is not verified for "${destinationKey}".`
    };
  }

  const fieldErrors = Array.isArray(resolutionEntry.errors)
    ? resolutionEntry.errors.filter((e) => typeof e === "string" && e.trim() !== "")
    : [];
  const hasContinuation = Boolean(
    resolutionEntry.continuation &&
      typeof resolutionEntry.continuation === "object" &&
      resolutionEntry.continuation.hasNextPage === true
  );

  if (
    resolutionEntry.isComplete !== true ||
    resolutionEntry.status === "incomplete" ||
    resolutionEntry.status === "blocked" ||
    resolutionEntry.status === "category_ineligible" ||
    hasContinuation ||
    fieldErrors.length > 0
  ) {
    return {
      evidenceLoaded: true,
      isComplete: false,
      restrictedMetaobjectDefinitionId: resolvedDefId,
      entriesByGid: new Map(),
      error:
        fieldErrors[0] ||
        `Reference entry enumeration for "${destinationKey}" is not complete (status: ${resolutionEntry.status || "incomplete"}).`
    };
  }

  const entriesByGid = new Map();
  const rawEntries = Array.isArray(resolutionEntry.availableEntries)
    ? resolutionEntry.availableEntries
    : Array.isArray(resolutionEntry.entries)
      ? resolutionEntry.entries
      : [];

  for (const item of rawEntries) {
    if (!item || typeof item !== "object") continue;
    const gid = extractEntryGid(item);
    const defId = extractEntryDefinitionId(item);
    if (!isExactMetaobjectGid(gid)) continue;
    if (!isExactMetaobjectDefinitionGid(defId) || defId !== resolvedDefId) continue;
    const label = extractEntryLabel(item) || gid;
    entriesByGid.set(gid, {
      id: gid,
      label,
      definitionId: defId
    });
  }

  if (
    resolutionEntry.entriesByGid instanceof Map
  ) {
    resolutionEntry.entriesByGid.forEach((val, key) => {
      const gid = typeof key === "string" ? key.trim() : extractEntryGid(val);
      const defId = extractEntryDefinitionId(val);
      if (isExactMetaobjectGid(gid) && defId === resolvedDefId) {
        entriesByGid.set(gid, {
          id: gid,
          label: extractEntryLabel(val) || gid,
          definitionId: defId
        });
      }
    });
  }

  return {
    evidenceLoaded: true,
    isComplete: true,
    restrictedMetaobjectDefinitionId: resolvedDefId,
    entriesByGid,
    error: null
  };
}

export function formatBenchV2ValueDisplay(
  destinationKey,
  rawVal,
  observedType = null,
  verifiedEntriesMap = null
) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return "";
  }
  const strVal = String(rawVal);

  if (
    (typeof destinationKey === "string" && destinationKey.startsWith("shopify.")) ||
    observedType === "list.metaobject_reference"
  ) {
    return formatDisplayFieldValue(strVal, true, null, verifiedEntriesMap);
  }

  const lower = strVal.trim().toLowerCase();

  if (
    destinationKey === "custom.is_ooak" ||
    destinationKey === "custom.is_one_of_a_kind"
  ) {
    if (lower === "true" || lower === "yes" || lower === "yes — one of a kind") {
      return "Yes — one of a kind";
    }
    if (lower === "false" || lower === "no" || lower === "no — not one of a kind") {
      return "No — not one of a kind";
    }
    return strVal;
  }

  if (destinationKey === "custom.found_object") {
    if (lower === "true" || lower === "yes" || lower === "yes — found in the wild") {
      return "Yes — found in the wild";
    }
    if (lower === "no — purchased rough") {
      return "No — purchased rough";
    }
    if (lower === "false" || lower === "no") {
      return "No — not wild-collected (purchased)";
    }
    return strVal;
  }

  if (destinationKey === "custom.treated") {
    if (lower === "untreated — natural" || lower === "untreated - natural") {
      return "No — untreated (Untreated — Natural)";
    }
    if (lower === "false" || lower === "no") {
      return "No — untreated";
    }
    if (lower === "true" || lower === "yes") {
      return "Yes — treated";
    }
    if (
      lower === "stabilized" ||
      lower === "dyed" ||
      lower === "resined" ||
      lower === "enhanced"
    ) {
      return `Yes — treated (${strVal})`;
    }
    return strVal;
  }

  if (destinationKey === "custom.treatment_status") {
    if (lower === "false" || lower === "no") {
      return "No — untreated";
    }
    if (lower === "true" || lower === "yes") {
      return "Yes — treated";
    }
    return strVal;
  }

  if (destinationKey === "custom.setting_ready") {
    if (lower === "true" || lower === "yes") {
      return "Yes — setting ready";
    }
    if (lower === "false" || lower === "no") {
      return "No — not setting ready";
    }
    return strVal;
  }

  if (destinationKey === "custom.bail_included") {
    if (lower === "true" || lower === "yes") {
      return "Yes — bail included";
    }
    if (lower === "false" || lower === "no") {
      return "No — no bail included";
    }
    return strVal;
  }

  if (observedType === "boolean") {
    if (strVal === "true") return "Yes";
    if (strVal === "false") return "No";
  }

  return strVal;
}

export function formatOoakDisplayConvention(rawVal, observedType = null) {
  return formatBenchV2ValueDisplay("custom.is_ooak", rawVal, observedType);
}

export function getContractOptionsForObservation(
  contract,
  baselineObs = null,
  baselineSnapshot = null
) {
  if (!contract) return [];

  if (contract.namespace === "shopify" && contract.isWritableInBatch1) {
    const refEvidence = inspectVerifiedReferenceEvidenceForDestination(
      baselineSnapshot,
      contract.destinationKey,
      baselineObs?.restrictedMetaobjectDefinitionId || null
    );
    if (!refEvidence.isComplete || refEvidence.entriesByGid.size === 0) {
      return [];
    }
    const storedCheck = inspectStoredReferenceListRawValue(baselineObs?.rawValue);
    if (!storedCheck.valid) {
      return [];
    }
    const existingGids = storedCheck.gids;
    const options = [];
    refEvidence.entriesByGid.forEach((entry) => {
      const mergedGids = [...existingGids];
      if (!mergedGids.includes(entry.id)) {
        mergedGids.push(entry.id);
      }
      const serializedValue = JSON.stringify(mergedGids);
      const displayLabel =
        existingGids.length > 0 && !existingGids.includes(entry.id)
          ? `${entry.label} (${entry.id}) — append to [${existingGids.length} existing]`
          : `${entry.label} (${entry.id})`;
      options.push(
        Object.freeze({
          label: displayLabel,
          value: serializedValue
        })
      );
    });
    return Object.freeze(options);
  }

  if (!contract.optionsKey) return [];
  if (contract.destinationKey === "custom.is_ooak") {
    const resolvedType = baselineObs?.liveDefType || baselineObs?.storedType || null;
    if (resolvedType === "boolean") {
      return BENCH_V2_OPTIONS_BY_KEY.is_ooak_boolean || [];
    }
    if (resolvedType === "single_line_text_field") {
      return BENCH_V2_OPTIONS_BY_KEY.is_ooak_text || [];
    }
  }
  return BENCH_V2_OPTIONS_BY_KEY[contract.optionsKey] || [];
}

function inspectSnapshotCompleteness(baselineSnapshot, destinationKey) {
  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return {
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      productCategoryCompleteState: "unknown",
      productCategoryId: null,
      restrictedMetaobjectDefinitionId: null,
      categoryEligibility: null,
      destinationDefError: null
    };
  }

  const mfFlag = baselineSnapshot.metafieldsReadComplete;
  const metafieldsCompleteState =
    mfFlag === true ? "complete" : mfFlag === false ? "incomplete" : "unknown";

  const defsFlag = baselineSnapshot.defsReadComplete;
  const defsCompleteState =
    defsFlag === true ? "complete" : defsFlag === false ? "incomplete" : "unknown";

  const catCompleteFlag = baselineSnapshot.productCategoryReadComplete;
  const productCategoryCompleteState =
    catCompleteFlag === true
      ? "complete"
      : catCompleteFlag === false
        ? "incomplete"
        : baselineSnapshot.productCategory !== undefined
          ? "complete"
          : "unknown";

  const productCategoryId =
    typeof baselineSnapshot.productCategory?.id === "string" &&
    baselineSnapshot.productCategory.id.trim() !== ""
      ? baselineSnapshot.productCategory.id.trim()
      : null;

  const liveDefEntry =
    baselineSnapshot.liveDefinitions &&
    typeof baselineSnapshot.liveDefinitions === "object" &&
    !Array.isArray(baselineSnapshot.liveDefinitions)
      ? baselineSnapshot.liveDefinitions[destinationKey]
      : null;

  const restrictedMetaobjectDefinitionId =
    typeof liveDefEntry?.restrictedMetaobjectDefinitionId === "string" &&
    liveDefEntry.restrictedMetaobjectDefinitionId.trim() !== ""
      ? liveDefEntry.restrictedMetaobjectDefinitionId.trim()
      : typeof liveDefEntry?.requiredDefinitionId === "string" &&
          liveDefEntry.requiredDefinitionId.trim() !== ""
        ? liveDefEntry.requiredDefinitionId.trim()
        : null;

  const categoryEligibility =
    baselineSnapshot.categoryEligibilityByDestination &&
    typeof baselineSnapshot.categoryEligibilityByDestination === "object"
      ? baselineSnapshot.categoryEligibilityByDestination[destinationKey] || null
      : null;

  const destinationConstraintErr =
    (baselineSnapshot.constraintErrorsByDestination &&
    typeof baselineSnapshot.constraintErrorsByDestination === "object"
      ? baselineSnapshot.constraintErrorsByDestination[destinationKey]
      : null) ||
    liveDefEntry?.constraints?.error ||
    liveDefEntry?.error ||
    null;

  const topDefReadErrors = Array.isArray(baselineSnapshot.defReadErrors)
    ? baselineSnapshot.defReadErrors.filter((e) => typeof e === "string" && e.trim() !== "")
    : [];

  const destinationDefError = destinationConstraintErr
    ? String(destinationConstraintErr)
    : topDefReadErrors.length > 0 && defsCompleteState !== "complete"
      ? topDefReadErrors.join("; ")
      : null;

  return {
    metafieldsCompleteState,
    defsCompleteState,
    productCategoryCompleteState,
    productCategoryId,
    restrictedMetaobjectDefinitionId,
    categoryEligibility,
    destinationDefError
  };
}

function inspectVariantSnapshotCompleteness(baselineSnapshot, destinationKey) {
  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return {
      variantsCompleteState: "unknown",
      variantTargetStatus: "unknown",
      variantId: null,
      variantCount: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null
    };
  }

  const variantsFlag = baselineSnapshot.variantsReadComplete;
  const variantsCompleteState =
    variantsFlag === true ? "complete" : variantsFlag === false ? "incomplete" : "unknown";

  const variantEdges = Array.isArray(baselineSnapshot.nativeTargets?.variants?.edges)
    ? baselineSnapshot.nativeTargets.variants.edges
    : null;
  const rawVariantCount =
    typeof baselineSnapshot.variantCount === "number" && Number.isFinite(baselineSnapshot.variantCount)
      ? baselineSnapshot.variantCount
      : variantEdges
        ? variantEdges.length
        : null;

  const candidateVariantId =
    typeof baselineSnapshot.primaryVariantId === "string" && baselineSnapshot.primaryVariantId.trim() !== ""
      ? baselineSnapshot.primaryVariantId.trim()
      : variantsCompleteState === "complete" && rawVariantCount === 1 && variantEdges?.[0]?.node?.id
        ? String(variantEdges[0].node.id).trim()
        : null;

  const hasValidSingleVariantId = isExactProductVariantGid(candidateVariantId);

  let variantTargetStatus = "unknown";
  if (variantsCompleteState !== "complete") {
    variantTargetStatus = "variants_read_incomplete";
  } else if (rawVariantCount === 0) {
    variantTargetStatus = "zero_variants";
  } else if (rawVariantCount !== null && rawVariantCount > 1) {
    variantTargetStatus = "multiple_variants_ambiguous";
  } else if (rawVariantCount === 1 && hasValidSingleVariantId) {
    variantTargetStatus = "single_variant_verified";
  } else {
    variantTargetStatus = "invalid_or_missing_variant_gid";
  }

  const varMfFlag = baselineSnapshot.variantMetafieldsReadComplete;
  const metafieldsCompleteState =
    varMfFlag === true ? "complete" : varMfFlag === false ? "incomplete" : "unknown";

  const varDefsFlag = baselineSnapshot.variantDefsReadComplete;
  const defsCompleteState =
    varDefsFlag === true ? "complete" : varDefsFlag === false ? "incomplete" : "unknown";

  const liveVarDefEntry =
    baselineSnapshot.liveVariantDefinitions &&
    typeof baselineSnapshot.liveVariantDefinitions === "object" &&
    !Array.isArray(baselineSnapshot.liveVariantDefinitions)
      ? baselineSnapshot.liveVariantDefinitions[destinationKey]
      : null;

  const destinationConstraintErr =
    (baselineSnapshot.variantConstraintErrorsByDestination &&
    typeof baselineSnapshot.variantConstraintErrorsByDestination === "object"
      ? baselineSnapshot.variantConstraintErrorsByDestination[destinationKey]
      : null) ||
    liveVarDefEntry?.constraints?.error ||
    liveVarDefEntry?.error ||
    null;

  const topVarDefReadErrors = Array.isArray(baselineSnapshot.variantDefReadErrors)
    ? baselineSnapshot.variantDefReadErrors.filter((e) => typeof e === "string" && e.trim() !== "")
    : [];

  const varMfReadError =
    typeof baselineSnapshot.variantMetafieldsReadError === "string" &&
    baselineSnapshot.variantMetafieldsReadError.trim() !== ""
      ? baselineSnapshot.variantMetafieldsReadError.trim()
      : null;

  const destinationDefError = destinationConstraintErr
    ? String(destinationConstraintErr)
    : topVarDefReadErrors.length > 0 && defsCompleteState !== "complete"
      ? topVarDefReadErrors.join("; ")
      : varMfReadError && metafieldsCompleteState !== "complete"
        ? varMfReadError
        : null;

  return {
    variantsCompleteState,
    variantTargetStatus,
    variantId: variantTargetStatus === "single_variant_verified" ? candidateVariantId : null,
    variantCount: rawVariantCount,
    metafieldsCompleteState,
    defsCompleteState,
    destinationDefError
  };
}

function makeUnavailableObservation({
  destinationKey,
  owner = null,
  variantId = null,
  variantTargetStatus = null,
  presence,
  storedType = null,
  liveDefType = null,
  restrictedMetaobjectDefinitionId = null,
  productCategoryCompleteState = "unknown",
  productCategoryId = null,
  categoryEligibility = null,
  metafieldsCompleteState = "unknown",
  defsCompleteState = "unknown",
  destinationDefError = null,
  signature
}) {
  return Object.freeze({
    destinationKey,
    owner,
    variantId,
    variantTargetStatus,
    evidenceAvailable: false,
    positiveEvidenceObserved: false,
    presence,
    rawValue: undefined,
    storedType,
    liveDefType,
    restrictedMetaobjectDefinitionId,
    productCategoryCompleteState,
    productCategoryId,
    categoryEligibility,
    metafieldsCompleteState,
    defsCompleteState,
    destinationDefError,
    signature
  });
}

export function buildBaselineObservation(baselineSnapshot, destinationKey) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return makeUnavailableObservation({
      destinationKey: String(destinationKey || ""),
      presence: "unknown_contract",
      signature: "unavailable:unknown_contract"
    });
  }

  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "baseline_not_loaded",
      signature: `unavailable:not_loaded:${contract.owner}::${contract.destinationKey}`
    });
  }

  const productGid = baselineSnapshot.productId;
  if (!isExactProductGid(productGid)) {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "invalid_product_gid",
      signature: `unavailable:invalid_gid:${contract.owner}::${contract.destinationKey}`
    });
  }

  const completeness = inspectSnapshotCompleteness(baselineSnapshot, contract.destinationKey);

  // Variant-owned metafield baselines
  if (contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native") {
    const varCompleteness = inspectVariantSnapshotCompleteness(
      baselineSnapshot,
      contract.destinationKey
    );
    const liveVarDefType =
      baselineSnapshot.liveVariantDefinitions?.[contract.destinationKey]?.type || null;

    const makeVarUnavailable = (presence, sigTag, varId = null, storedT = null) =>
      makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: varId,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        presence,
        storedType: storedT,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: varId
          ? `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${varId}::${contract.destinationKey}`
          : `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });

    if (varCompleteness.variantTargetStatus === "variants_read_incomplete") {
      return makeVarUnavailable("unknown_incomplete_read", "variants_incomplete_read");
    }
    if (varCompleteness.variantTargetStatus === "zero_variants") {
      return makeVarUnavailable("zero_variants_hold", "zero_variants");
    }
    if (varCompleteness.variantTargetStatus === "multiple_variants_ambiguous") {
      return makeVarUnavailable("multiple_variants_hold", "multiple_variants");
    }
    if (
      varCompleteness.variantTargetStatus !== "single_variant_verified" ||
      !isExactProductVariantGid(varCompleteness.variantId)
    ) {
      return makeVarUnavailable("invalid_variant_gid", "invalid_variant_gid");
    }

    const verifiedVariantId = varCompleteness.variantId;
    const varMap = baselineSnapshot.currentVariantMetafields;

    if (!varMap || typeof varMap !== "object" || Array.isArray(varMap)) {
      return makeVarUnavailable("variant_baseline_unavailable", "variant", verifiedVariantId);
    }

    const hasProp = Object.prototype.hasOwnProperty.call(varMap, contract.destinationKey);
    const rawVal = hasProp ? varMap[contract.destinationKey] : undefined;
    const positiveEvidenceObserved = hasProp && rawVal !== undefined;
    const storedType =
      baselineSnapshot.currentVariantMetafieldTypes?.[contract.destinationKey] || null;

    if (!positiveEvidenceObserved && varCompleteness.metafieldsCompleteState !== "complete") {
      return makeVarUnavailable("unknown_incomplete_read", "variant_incomplete_read", verifiedVariantId, storedType);
    }

    const presence = !positiveEvidenceObserved
      ? "absent"
      : rawVal === null
        ? "null"
        : rawVal === ""
          ? "empty_string"
          : "present";

    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: verifiedVariantId,
      variantTargetStatus: varCompleteness.variantTargetStatus,
      evidenceAvailable: true,
      positiveEvidenceObserved,
      presence,
      rawValue: rawVal,
      storedType,
      liveDefType: liveVarDefType,
      restrictedMetaobjectDefinitionId: null,
      productCategoryCompleteState: completeness.productCategoryCompleteState,
      productCategoryId: completeness.productCategoryId,
      categoryEligibility: null,
      metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
      defsCompleteState: varCompleteness.defsCompleteState,
      destinationDefError: varCompleteness.destinationDefError,
      signature: `${productGid}::PRODUCTVARIANT::${verifiedVariantId}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${liveVarDefType || "no_def_type"}::${varCompleteness.metafieldsCompleteState}::${varCompleteness.defsCompleteState}::${rawVal ?? ""}`
    });
  }

  if (contract.namespace === "native") {
    const nt = baselineSnapshot.nativeTargets;

    // Single-variant native price (PRODUCTVARIANT native_price)
    if (contract.owner === "PRODUCTVARIANT" && contract.destinationKey === "native_price") {
      const varCompleteness = inspectVariantSnapshotCompleteness(
        baselineSnapshot,
        contract.destinationKey
      );

      const makeNativePriceUnavailable = (presence, sigTag, varId = null) =>
        makeUnavailableObservation({
          destinationKey: contract.destinationKey,
          owner: contract.owner,
          variantId: varId,
          variantTargetStatus: varCompleteness.variantTargetStatus,
          presence,
          storedType: "native",
          liveDefType: "native",
          metafieldsCompleteState: completeness.metafieldsCompleteState,
          defsCompleteState: completeness.defsCompleteState,
          destinationDefError: nt?.loadError ? String(nt.loadError) : completeness.destinationDefError,
          signature: varId
            ? `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${varId}::${contract.destinationKey}`
            : `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
        });

      if (!nt || typeof nt !== "object") {
        return makeNativePriceUnavailable("native_baseline_unavailable", "native");
      }
      if (varCompleteness.variantTargetStatus === "variants_read_incomplete") {
        return makeNativePriceUnavailable("unknown_incomplete_read", "variants_incomplete_read");
      }
      if (varCompleteness.variantTargetStatus === "zero_variants") {
        return makeNativePriceUnavailable("zero_variants_hold", "zero_variants");
      }
      if (varCompleteness.variantTargetStatus === "multiple_variants_ambiguous") {
        return makeNativePriceUnavailable("multiple_variants_hold", "multiple_variants");
      }
      if (
        varCompleteness.variantTargetStatus !== "single_variant_verified" ||
        !isExactProductVariantGid(varCompleteness.variantId)
      ) {
        return makeNativePriceUnavailable("invalid_variant_gid", "invalid_variant_gid");
      }

      const verifiedVariantId = varCompleteness.variantId;
      const unverifiedNative = Array.isArray(nt.unverifiedFields) ? nt.unverifiedFields : [];
      const variantEdges = Array.isArray(nt.variants?.edges) ? nt.variants.edges : [];
      const singleVariantEdgeNode =
        variantEdges.length === 1 && variantEdges[0]?.node?.id === verifiedVariantId
          ? variantEdges[0].node
          : null;

      const rawNativePrice =
        nt.price !== undefined
          ? nt.price
          : singleVariantEdgeNode?.price !== undefined
            ? singleVariantEdgeNode.price
            : undefined;

      const isNativePriceUnverified =
        nt.isComplete !== true ||
        Boolean(nt.loadError) ||
        unverifiedNative.includes("price") ||
        unverifiedNative.includes("variants");

      if (isNativePriceUnverified || rawNativePrice === undefined) {
        return makeNativePriceUnavailable(
          isNativePriceUnverified ? "unknown_incomplete_read" : "absent",
          "native_unverified",
          verifiedVariantId
        );
      }

      const presence = rawNativePrice === null
        ? "null"
        : rawNativePrice === ""
          ? "empty_string"
          : "present";

      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: verifiedVariantId,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: true,
        positiveEvidenceObserved: true,
        presence,
        rawValue: rawNativePrice,
        storedType: "native",
        liveDefType: "native",
        restrictedMetaobjectDefinitionId: null,
        productCategoryCompleteState: completeness.productCategoryCompleteState,
        productCategoryId: completeness.productCategoryId,
        categoryEligibility: null,
        metafieldsCompleteState: completeness.metafieldsCompleteState,
        defsCompleteState: completeness.defsCompleteState,
        destinationDefError: completeness.destinationDefError,
        signature: `${productGid}::PRODUCTVARIANT::${verifiedVariantId}::${contract.destinationKey}::${presence}::${typeof rawNativePrice === "object" ? JSON.stringify(rawNativePrice) : (rawNativePrice ?? "")}`
      });
    }

    if (!nt || typeof nt !== "object") {
      return makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        presence: "native_baseline_unavailable",
        storedType: "native",
        liveDefType: "native",
        metafieldsCompleteState: completeness.metafieldsCompleteState,
        defsCompleteState: completeness.defsCompleteState,
        destinationDefError: completeness.destinationDefError,
        signature: `unavailable:native:${contract.destinationKey}`
      });
    }

    const unverifiedNative = Array.isArray(nt.unverifiedFields) ? nt.unverifiedFields : [];
    let isNativeFieldUnverified = false;
    let rawNative = undefined;

    if (contract.destinationKey === "native_title") {
      isNativeFieldUnverified = unverifiedNative.includes("productTitle");
      rawNative = nt.productTitle;
    } else if (contract.destinationKey === "native_description") {
      isNativeFieldUnverified = unverifiedNative.includes("descriptionHtml");
      rawNative = nt.descriptionHtml;
    } else if (contract.destinationKey === "native_seo_title") {
      isNativeFieldUnverified = unverifiedNative.includes("seo");
      rawNative = nt.seo?.title;
    } else if (contract.destinationKey === "native_seo_description") {
      isNativeFieldUnverified = unverifiedNative.includes("seo");
      rawNative = nt.seo?.description;
    } else if (contract.destinationKey === "native_shipping_weight") {
      isNativeFieldUnverified = nt.isComplete !== true || Boolean(nt.loadError);
      rawNative = nt.shippingWeight;
    }

    if (isNativeFieldUnverified || rawNative === undefined) {
      return makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        presence: isNativeFieldUnverified ? "unknown_incomplete_read" : "absent",
        storedType: "native",
        liveDefType: "native",
        metafieldsCompleteState: completeness.metafieldsCompleteState,
        defsCompleteState: completeness.defsCompleteState,
        destinationDefError: completeness.destinationDefError,
        signature: `unavailable:native_unverified:${contract.destinationKey}`
      });
    }

    const presence = rawNative === null
      ? "null"
      : rawNative === ""
        ? "empty_string"
        : "present";

    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: true,
      positiveEvidenceObserved: true,
      presence,
      rawValue: rawNative,
      storedType: "native",
      liveDefType: "native",
      restrictedMetaobjectDefinitionId: null,
      productCategoryCompleteState: completeness.productCategoryCompleteState,
      productCategoryId: completeness.productCategoryId,
      categoryEligibility: null,
      metafieldsCompleteState: completeness.metafieldsCompleteState,
      defsCompleteState: completeness.defsCompleteState,
      destinationDefError: completeness.destinationDefError,
      signature: `${productGid}::${contract.destinationKey}::${presence}::${typeof rawNative === "object" ? JSON.stringify(rawNative) : (rawNative ?? "")}`
    });
  }

  const cm = baselineSnapshot.currentMetafields;
  if (!cm || typeof cm !== "object" || Array.isArray(cm)) {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "metafields_not_loaded",
      restrictedMetaobjectDefinitionId: completeness.restrictedMetaobjectDefinitionId,
      productCategoryCompleteState: completeness.productCategoryCompleteState,
      productCategoryId: completeness.productCategoryId,
      categoryEligibility: completeness.categoryEligibility,
      metafieldsCompleteState: completeness.metafieldsCompleteState,
      defsCompleteState: completeness.defsCompleteState,
      destinationDefError: completeness.destinationDefError,
      signature: `unavailable:metafields:${contract.destinationKey}`
    });
  }

  const hasProp = Object.prototype.hasOwnProperty.call(cm, contract.destinationKey);
  const rawVal = hasProp ? cm[contract.destinationKey] : undefined;
  const positiveEvidenceObserved = hasProp && rawVal !== undefined;
  const storedType = baselineSnapshot.currentMetafieldTypes?.[contract.destinationKey] || null;
  const liveDefType = baselineSnapshot.liveDefinitions?.[contract.destinationKey]?.type || null;

  if (!positiveEvidenceObserved && completeness.metafieldsCompleteState !== "complete") {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "unknown_incomplete_read",
      storedType,
      liveDefType,
      restrictedMetaobjectDefinitionId: completeness.restrictedMetaobjectDefinitionId,
      productCategoryCompleteState: completeness.productCategoryCompleteState,
      productCategoryId: completeness.productCategoryId,
      categoryEligibility: completeness.categoryEligibility,
      metafieldsCompleteState: completeness.metafieldsCompleteState,
      defsCompleteState: completeness.defsCompleteState,
      destinationDefError: completeness.destinationDefError,
      signature: `unavailable:incomplete_metafield_read:${productGid}::${contract.destinationKey}`
    });
  }

  const presence = !positiveEvidenceObserved
    ? "absent"
    : rawVal === null
      ? "null"
      : rawVal === ""
        ? "empty_string"
        : "present";

  const isShopifyReference = contract.namespace === "shopify";
  const categorySignatureSegment = isShopifyReference
    ? `::cat=${completeness.productCategoryId || "unassigned"}::elig=${completeness.categoryEligibility?.status || "unknown"}::moDef=${completeness.restrictedMetaobjectDefinitionId || "no_mo_def"}`
    : "";

  return Object.freeze({
    destinationKey: contract.destinationKey,
    owner: contract.owner,
    variantId: null,
    variantTargetStatus: null,
    evidenceAvailable: true,
    positiveEvidenceObserved,
    presence,
    rawValue: rawVal,
    storedType,
    liveDefType,
    restrictedMetaobjectDefinitionId: completeness.restrictedMetaobjectDefinitionId,
    productCategoryCompleteState: completeness.productCategoryCompleteState,
    productCategoryId: completeness.productCategoryId,
    categoryEligibility: completeness.categoryEligibility,
    metafieldsCompleteState: completeness.metafieldsCompleteState,
    defsCompleteState: completeness.defsCompleteState,
    destinationDefError: completeness.destinationDefError,
    signature: `${productGid}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${liveDefType || "no_def_type"}::${completeness.metafieldsCompleteState}::${completeness.defsCompleteState}${categorySignatureSegment}::${rawVal ?? ""}`
  });
}

export function evaluateDestinationTypeAndCompleteness({
  contract,
  baselineObs
}) {
  if (!contract || !baselineObs) {
    return {
      ready: false,
      code: "missing_contract_or_observation",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: "Missing field contract or baseline observation."
    };
  }

  const isVariantMetafieldOwner =
    contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
  const isNativeVariantPrice =
    contract.owner === "PRODUCTVARIANT" &&
    contract.namespace === "native" &&
    contract.destinationKey === "native_price";
  const isShopifyReference = contract.owner === "PRODUCT" && contract.namespace === "shopify";

  if (!baselineObs.evidenceAvailable) {
    if (isVariantMetafieldOwner || isNativeVariantPrice) {
      if (baselineObs.presence === "multiple_variants_hold") {
        return {
          ready: false,
          code: "multiple_variants_hold",
          verifiedActualType: null,
          observedShopifyType: null,
          typeEvidenceSource: null,
          reason: `Product has multiple variants; "${contract.destinationKey}" is held read-only to prevent ambiguous variant targeting.`
        };
      }
      if (baselineObs.presence === "zero_variants_hold") {
        return {
          ready: false,
          code: "zero_variants_hold",
          verifiedActualType: null,
          observedShopifyType: null,
          typeEvidenceSource: null,
          reason: `Product has zero variants; "${contract.destinationKey}" cannot target a ProductVariant.`
        };
      }
      if (baselineObs.presence === "invalid_variant_gid") {
        return {
          ready: false,
          code: "invalid_variant_gid",
          verifiedActualType: null,
          observedShopifyType: null,
          typeEvidenceSource: null,
          reason: `Exact Shopify ProductVariant GID is required before authorizing writes on "${contract.destinationKey}".`
        };
      }
      if (baselineObs.presence === "unknown_incomplete_read") {
        return {
          ready: false,
          code: isNativeVariantPrice ? "incomplete_native_price_read" : "incomplete_variant_metafield_read",
          verifiedActualType: null,
          observedShopifyType: null,
          typeEvidenceSource: null,
          reason: isNativeVariantPrice
            ? `Single-variant price baseline or variant enumeration is incomplete for "${contract.destinationKey}"; reload product data before editing.`
            : `Variant metafield or variant enumeration completeness is "${baselineObs.metafieldsCompleteState}" for "${contract.destinationKey}"; cannot infer absence or authorize writes until variantMetafieldsReadComplete === true.`
        };
      }
      return {
        ready: false,
        code: "missing_variant_baseline_evidence",
        verifiedActualType: null,
        observedShopifyType: null,
        typeEvidenceSource: null,
        reason: `Loaded single-variant baseline evidence is required for "${contract.destinationKey}" (current state: ${baselineObs.presence}).`
      };
    }

    const isUnknownRead = baselineObs.presence === "unknown_incomplete_read";
    return {
      ready: false,
      code: isUnknownRead ? "incomplete_metafield_read" : "missing_baseline_evidence",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: isUnknownRead
        ? `Metafield read completeness is "${baselineObs.metafieldsCompleteState}" for "${contract.destinationKey}"; cannot infer absence or authorize writes until metafieldsReadComplete === true.`
        : `Loaded baseline evidence is required for "${contract.destinationKey}" (current state: ${baselineObs.presence}).`
    };
  }

  if (isVariantMetafieldOwner || isNativeVariantPrice) {
    if (
      baselineObs.variantTargetStatus !== "single_variant_verified" ||
      !isExactProductVariantGid(baselineObs.variantId)
    ) {
      return {
        ready: false,
        code: "unverified_single_variant_target",
        verifiedActualType: null,
        observedShopifyType: null,
        typeEvidenceSource: null,
        reason: `Single-variant target GID is not verified for "${contract.destinationKey}" (status: ${baselineObs.variantTargetStatus || "unknown"}).`
      };
    }
  }

  if (isNativeVariantPrice) {
    if (
      baselineObs.presence !== "present" ||
      typeof baselineObs.rawValue !== "string" ||
      baselineObs.rawValue.trim() === ""
    ) {
      return {
        ready: false,
        code: "missing_variant_baseline_evidence",
        verifiedActualType: null,
        observedShopifyType: null,
        typeEvidenceSource: null,
        reason: `Complete single-variant price baseline string is required before authorizing writes on "${contract.destinationKey}".`
      };
    }
  }

  if (baselineObs.metafieldsCompleteState !== "complete") {
    return {
      ready: false,
      code: isVariantMetafieldOwner ? "variant_metafields_read_not_complete" : "metafields_read_not_complete",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: isVariantMetafieldOwner
        ? `Variant metafield enumeration is "${baselineObs.metafieldsCompleteState}" (requires variantMetafieldsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
        : `Product metafield enumeration is "${baselineObs.metafieldsCompleteState}" (requires metafieldsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
    };
  }

  if (baselineObs.destinationDefError) {
    return {
      ready: false,
      code: "destination_definition_error",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: `Definition/constraint error on "${contract.destinationKey}": ${baselineObs.destinationDefError}`
    };
  }

  if (baselineObs.defsCompleteState !== "complete") {
    return {
      ready: false,
      code: isVariantMetafieldOwner ? "variant_definitions_read_not_complete" : "definitions_read_not_complete",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: isVariantMetafieldOwner
        ? `Live PRODUCTVARIANT metafield definition read is "${baselineObs.defsCompleteState}" (requires variantDefsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
        : `Live PRODUCT metafield definition read is "${baselineObs.defsCompleteState}" (requires defsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
    };
  }

  const liveDefType = baselineObs.liveDefType;
  const storedType = baselineObs.storedType;

  if (isShopifyReference) {
    if (baselineObs.productCategoryCompleteState !== "complete") {
      return {
        ready: false,
        code: "product_category_read_not_complete",
        verifiedActualType: null,
        observedShopifyType: null,
        typeEvidenceSource: null,
        reason: `Product category read is "${baselineObs.productCategoryCompleteState}" for "${contract.destinationKey}"; cannot verify category constraint eligibility.`
      };
    }

    if (!liveDefType) {
      return {
        ready: false,
        code: "missing_type_evidence",
        verifiedActualType: null,
        observedShopifyType: null,
        typeEvidenceSource: null,
        reason: `Missing live PRODUCT metafield definition for "${contract.destinationKey}". Standardized reference attributes require a live PRODUCT definition (never inferred from static contracts or stored values alone).`
      };
    }

    if (liveDefType !== "list.metaobject_reference") {
      return {
        ready: false,
        code: "contract_type_mismatch",
        verifiedActualType: null,
        observedShopifyType: liveDefType,
        typeEvidenceSource: null,
        reason: `Type mismatch on "${contract.destinationKey}": expected live definition "list.metaobject_reference", but Shopify reports "${liveDefType}".`
      };
    }

    if (storedType && storedType !== "list.metaobject_reference") {
      return {
        ready: false,
        code: "live_vs_stored_type_conflict",
        verifiedActualType: null,
        observedShopifyType: storedType,
        typeEvidenceSource: null,
        reason: `Type conflict on "${contract.destinationKey}": live definition is "list.metaobject_reference" but stored metafield is "${storedType}".`
      };
    }

    const catElig = baselineObs.categoryEligibility;
    if (!catElig || catElig.isComplete !== true) {
      return {
        ready: false,
        code: "category_eligibility_incomplete",
        verifiedActualType: null,
        observedShopifyType: liveDefType,
        typeEvidenceSource: null,
        reason:
          catElig?.reason ||
          `Category constraint eligibility check did not complete for "${contract.destinationKey}".`
      };
    }

    if (catElig.isEligible !== true) {
      return {
        ready: false,
        code: "destination_definition_error",
        verifiedActualType: null,
        observedShopifyType: liveDefType,
        typeEvidenceSource: null,
        reason:
          catElig.reason ||
          `Product category is not eligible for standardized attribute "${contract.destinationKey}".`
      };
    }

    if (!isExactMetaobjectDefinitionGid(baselineObs.restrictedMetaobjectDefinitionId)) {
      return {
        ready: false,
        code: "missing_restricted_metaobject_definition",
        verifiedActualType: null,
        observedShopifyType: liveDefType,
        typeEvidenceSource: null,
        reason: `Live PRODUCT definition for "${contract.destinationKey}" is missing a valid metaobject_definition_id restriction.`
      };
    }

    if (baselineObs.presence === "present") {
      const storedCheck = inspectStoredReferenceListRawValue(baselineObs.rawValue);
      if (!storedCheck.valid) {
        return {
          ready: false,
          code: "invalid_stored_reference_list",
          verifiedActualType: null,
          observedShopifyType: liveDefType,
          typeEvidenceSource: null,
          reason: `Existing stored reference list on "${contract.destinationKey}" could not be parsed safely: ${storedCheck.error}`
        };
      }
    }

    return {
      ready: true,
      code: "type_and_completeness_verified",
      verifiedActualType: "list.metaobject_reference",
      observedShopifyType: "list.metaobject_reference",
      typeEvidenceSource: storedType
        ? "live_definition_and_stored"
        : "live_definition",
      restrictedMetaobjectDefinitionId: baselineObs.restrictedMetaobjectDefinitionId,
      reason: null
    };
  }

  const reviewedExactContractType =
    !isVariantMetafieldOwner &&
    !isNativeVariantPrice &&
    contract.owner === "PRODUCT" &&
    contract.namespace === "custom" &&
    contract.isWritableInBatch1 === true &&
    contract.destinationKey !== "custom.is_ooak"
      ? contract.reviewedExactContractType || null
      : null;

  if (!liveDefType && !storedType) {
    if (reviewedExactContractType) {
      const allowedTypesForContract =
        Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
          ? contract.allowedTypes
          : [contract.expectedType];
      if (!allowedTypesForContract.includes(reviewedExactContractType)) {
        return {
          ready: false,
          code: "contract_type_mismatch",
          verifiedActualType: null,
          observedShopifyType: null,
          typeEvidenceSource: null,
          reason: `Type mismatch on "${contract.destinationKey}": contract allows [${allowedTypesForContract.join(", ")}], but reviewed contract specifies "${reviewedExactContractType}".`
        };
      }
      return {
        ready: true,
        code: "type_and_completeness_verified",
        verifiedActualType: reviewedExactContractType,
        observedShopifyType: null,
        typeEvidenceSource: "reviewed_exact_contract",
        reason: null
      };
    }

    return {
      ready: false,
      code: "missing_type_evidence",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: `Neither live ${contract.owner} metafield definition nor stored metafield type is present for "${contract.destinationKey}". Guessing a type or creating a definition is forbidden.`
    };
  }

  if (liveDefType && storedType && liveDefType !== storedType) {
    return {
      ready: false,
      code: "live_vs_stored_type_conflict",
      verifiedActualType: null,
      observedShopifyType: null,
      typeEvidenceSource: null,
      reason: `Type conflict on "${contract.destinationKey}": live definition is "${liveDefType}" but stored metafield is "${storedType}".`
    };
  }

  const observedShopifyType = liveDefType || storedType;

  if (reviewedExactContractType && observedShopifyType !== reviewedExactContractType) {
    return {
      ready: false,
      code: "contract_type_mismatch",
      verifiedActualType: null,
      observedShopifyType,
      typeEvidenceSource: null,
      reason: `Type conflict on "${contract.destinationKey}": observed Shopify type is "${observedShopifyType}", which conflicts with reviewed destination contract "${reviewedExactContractType}".`
    };
  }

  const allowedTypes = Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
    ? contract.allowedTypes
    : [contract.expectedType];

  if (!allowedTypes.includes(observedShopifyType)) {
    return {
      ready: false,
      code: "contract_type_mismatch",
      verifiedActualType: null,
      observedShopifyType,
      typeEvidenceSource: null,
      reason: `Type mismatch on "${contract.destinationKey}": contract allows [${allowedTypes.join(", ")}], but Shopify reports "${observedShopifyType}".`
    };
  }

  const typeEvidenceSource =
    liveDefType && storedType
      ? "live_definition_and_stored"
      : liveDefType
        ? "live_definition"
        : "stored_metafield";

  return {
    ready: true,
    code: "type_and_completeness_verified",
    verifiedActualType: observedShopifyType,
    observedShopifyType,
    typeEvidenceSource,
    reason: null
  };
}
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 AI SCAN & CANDIDATE RESOLUTION (CLIENT MODULE)
// File: app/utils/bench-v2.ai-scan-controller.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (File 1 of 2 for AI scan
// controller extraction). Contains producer-backed geology & Vision-backed
// standardized reference destination sets, candidate resolution against
// verified Metaobject reference entries, explicit AI Scan submission
// (including dynamic verified Color choices and both OOAK observed types),
// unapproved AI draft staging, trusted DB geology exact-value preapproval,
// held AI alternatives, and once-per-request deferred reference candidate
// resolution when reference choices arrive after AI Scan.
// ==========================================================================

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useFetcher } from "react-router";
import {
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  KNOWN_STUDIO_HARDWARE_LENGTH_IN,
  isLegacyGenericStudioCordLabel,
  resolveKnownStudioHardwareOptionLength,
  areHardwareOptionsCompatibleForKnownStudioLength,
  evaluateAiHardwareLengthSupport,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  isManualMeasurementDestination,
  isManualOnlyNoAiDestination,
  isExactMetaobjectDefinitionGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  inspectStoredReferenceListRawValue,
  inspectVerifiedReferenceEvidenceForDestination,
  validateBatch1ProposedValue,
  createExactValueApprovalRecord,
  isExactValueApprovalValid,
  isKeepOriginalRecordValid
} from "./bench-v2.contract.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  isExactMetaobjectGid,
  isGeneratedReferenceId,
  sanitizeStandardizedCandidates,
  collectVerifiedEntriesForResolution,
  areReferenceGidSetsSemanticallyEquivalent,
  evaluateCandidateLabelResolution
} from "./meta-injector.standardized.jsx";
import {
  buildStandardizedBaselineContextSignature
} from "./bench-v2.reference-loader.jsx";
import {
  RETIRED_ERA_DESTINATIONS,
  isRetiredParkedBenchDestination,
  getProposalValueString,
  hasExplicitReferenceReplacementFlag
} from "./bench-v2.json-draft-importer.jsx";

export const PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    "shopify.crystal-system",
    "shopify.mineral-class",
    "shopify.rock-composition",
    "shopify.rock-formation"
  ])
);

export const VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set(
    ALLOWED_VISION_CANDIDATE_KEYS
      .map((k) => `shopify.${k}`)
      .filter(
        (destKey) =>
          BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(destKey) &&
          !isRetiredParkedBenchDestination(destKey, "PRODUCT")
      )
  )
);

export const AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS = Object.freeze(
  new Set([
    ...PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS,
    ...VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS
  ])
);

// Reuse the authoritative Bench V2 field catalog for Drawers 11 & 12
// (geology_physical_properties & geology_composition_and_time) rather than
// duplicating geology destination lists.
export const AUTHORITATIVE_GEOLOGY_PREAPPROVAL_DESTINATIONS = Object.freeze(
  new Set(
    BENCH_V2_FIELD_CONTRACTS
      .filter(
        (c) =>
          c &&
          c.isWritableInBatch1 === true &&
          (c.drawerId === "geology_physical_properties" ||
            c.drawerId === "geology_composition_and_time")
      )
      .map((c) => c.destinationKey)
  )
);

const isConfirmedBlankBaselinePresence = (presence) =>
  presence === "absent" || presence === "null" || presence === "empty_string";

function filterAndValidateBenchV2VisionCandidates(rawContainer) {
  const activeSanitized = {};
  const malformedActiveEntries = [];

  if (!rawContainer || typeof rawContainer !== "object" || Array.isArray(rawContainer)) {
    return { activeSanitized, malformedActiveEntries };
  }

  const sharedSanitized = sanitizeStandardizedCandidates(rawContainer);

  for (const [rawKey, rawEntry] of Object.entries(rawContainer)) {
    if (typeof rawKey !== "string" || !rawKey.trim()) continue;
    const trimmedKey = rawKey.trim();
    const bareKey = trimmedKey.startsWith("shopify.")
      ? trimmedKey.slice(8)
      : trimmedKey;
    const destKey = `shopify.${bareKey}`;

    if (
      CANCELLED_INERT_DESTINATIONS.has(destKey) ||
      RETIRED_ERA_DESTINATIONS.has(destKey) ||
      isRetiredParkedBenchDestination(destKey, "PRODUCT") ||
      !BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(destKey) ||
      !VISION_BACKED_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
    ) {
      continue;
    }

    const sanitizedEntry = sharedSanitized[bareKey];
    if (sanitizedEntry) {
      if (!Object.prototype.hasOwnProperty.call(activeSanitized, bareKey)) {
        activeSanitized[bareKey] = {
          labels: [...sanitizedEntry.labels],
          evidence: sanitizedEntry.evidence
        };
      }
      continue;
    }

    let rawValueSummary = "";
    let malformedReason = `Malformed Vision standardized_candidates entry for ${destKey}.`;

    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      rawValueSummary = rawEntry === undefined || rawEntry === null ? "" : String(rawEntry);
      malformedReason = `Vision candidate "${bareKey}" must be an object containing non-empty labels and evidence.`;
    } else {
      const rawLabels = Array.isArray(rawEntry.labels) ? rawEntry.labels : [];
      const stringLabels = rawLabels
        .filter((l) => typeof l === "string" && l.trim() !== "")
        .map((l) => l.trim());
      rawValueSummary = stringLabels.join(", ");

      const hasGeneratedOrIdLabel = stringLabels.some((l) => isGeneratedReferenceId(l));
      const hasNonStringOrBlankLabel =
        Array.isArray(rawEntry.labels) &&
        rawEntry.labels.some((l) => typeof l !== "string" || l.trim() === "");
      const validEvidence =
        typeof rawEntry.evidence === "string" &&
        rawEntry.evidence.trim() !== "" &&
        rawEntry.evidence.trim() !== "[object Object]";

      if (!Array.isArray(rawEntry.labels) || stringLabels.length === 0) {
        malformedReason = `Vision candidate "${bareKey}" is missing a non-empty string array of candidate labels.`;
      } else if (hasGeneratedOrIdLabel) {
        malformedReason = `Vision candidate "${bareKey}" contains a generated ID or disallowed identifier in labels (${rawValueSummary}).`;
      } else if (hasNonStringOrBlankLabel) {
        malformedReason = `Vision candidate "${bareKey}" contains an empty or non-string label element.`;
      } else if (!validEvidence) {
        malformedReason = `Vision candidate "${bareKey}" is missing required non-empty evidence text for "${rawValueSummary}".`;
      }
    }

    malformedActiveEntries.push({
      bareKey,
      destKey,
      valueSummary: rawValueSummary,
      source: `Gemini Vision (standardized_candidates.${bareKey})`,
      reason: malformedReason
    });
  }

  return { activeSanitized, malformedActiveEntries };
}

function verifyTrustedGeologyDbProvenanceForProposal({
  rawProvenance,
  productId,
  requestId,
  destKey,
  expectedEmittedValue = null,
  expectedCandidateLabels = null
}) {
  if (!rawProvenance || typeof rawProvenance !== "object" || Array.isArray(rawProvenance)) {
    return null;
  }
  if (!isExactProductGid(productId) || rawProvenance.productId !== productId) {
    return null;
  }
  if (
    typeof requestId !== "string" ||
    requestId.trim() === "" ||
    rawProvenance.requestId !== requestId
  ) {
    return null;
  }
  if (
    typeof destKey !== "string" ||
    !AUTHORITATIVE_GEOLOGY_PREAPPROVAL_DESTINATIONS.has(destKey) ||
    rawProvenance.destinationKey !== destKey
  ) {
    return null;
  }
  if (
    rawProvenance.verified !== true ||
    rawProvenance.dbLookupComplete !== true ||
    rawProvenance.stoneIdentityMatched !== true
  ) {
    return null;
  }
  if (rawProvenance.geoSource !== "cache" && rawProvenance.geoSource !== "database") {
    return null;
  }
  if (
    typeof rawProvenance.geoKey !== "string" ||
    rawProvenance.geoKey.trim() === "" ||
    typeof rawProvenance.dbMatchedStoneName !== "string" ||
    rawProvenance.dbMatchedStoneName.trim() === "" ||
    typeof rawProvenance.matchedBaseFamily !== "string" ||
    rawProvenance.matchedBaseFamily.trim() === ""
  ) {
    return null;
  }

  const isShopifyReferenceCompanion =
    PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(destKey);

  if (isShopifyReferenceCompanion) {
    if (
      typeof rawProvenance.emittedCandidateLabel !== "string" ||
      rawProvenance.emittedCandidateLabel.trim() === "" ||
      typeof rawProvenance.rawDbValue !== "string" ||
      rawProvenance.rawDbValue.trim() === ""
    ) {
      return null;
    }
    if (Array.isArray(expectedCandidateLabels)) {
      if (
        expectedCandidateLabels.length !== 1 ||
        expectedCandidateLabels[0] !== rawProvenance.emittedCandidateLabel
      ) {
        return null;
      }
    }
  } else {
    if (
      !destKey.startsWith("custom.") ||
      destKey !== `custom.${rawProvenance.geoKey}` ||
      typeof rawProvenance.emittedValue !== "string" ||
      rawProvenance.emittedValue.trim() === ""
    ) {
      return null;
    }
    if (
      expectedEmittedValue !== null &&
      rawProvenance.emittedValue !== expectedEmittedValue
    ) {
      return null;
    }
  }

  return Object.freeze({
    verified: true,
    productId: rawProvenance.productId,
    requestId: rawProvenance.requestId,
    destinationKey: rawProvenance.destinationKey,
    geoKey: rawProvenance.geoKey,
    ...(isShopifyReferenceCompanion
      ? {
          rawDbValue: rawProvenance.rawDbValue,
          emittedCandidateLabel: rawProvenance.emittedCandidateLabel
        }
      : {
          emittedValue: rawProvenance.emittedValue
        }),
    geoSource: rawProvenance.geoSource,
    dbLookupComplete: true,
    dbMatchedStoneName: rawProvenance.dbMatchedStoneName.trim().toLowerCase(),
    matchedBaseFamily: rawProvenance.matchedBaseFamily.trim(),
    stoneIdentityMatched: true
  });
}

/**
 * Independently verifies the narrow current-scan known-studio-stock `"18"`
 * proposal on PRODUCT `custom.chain_cord_length_in`.
 *
 * A `verified: true` flag alone is NEVER treated as verification:
 * - Validates exact `productId`, `requestId`, `destinationKey === "custom.chain_cord_length_in"`,
 *   `rawValue === "18"`, `emittedValue === "18"`, `basis === "vision_photo_match_known_studio_stock"`,
 *   and non-empty evidence-labelled `source`.
 * - Resolves `matchedHardwareOption` against the shared `resolveKnownStudioHardwareOptionLength`
 *   catalog and verifies exact canonical option + `hardwareCategory` match.
 * - Cross-checks the current scan response (`combinedProducerAndVisionProposals["custom.chain_material"]`
 *   when unlocked, or compatible current human/saved `custom.chain_material` when locked).
 * - Confirms live baseline for `custom.chain_cord_length_in` is complete and genuinely blank
 *   (`presence` in `{"absent", "null", "empty_string"}`), and that NO human/manual draft
 *   (including a temporarily empty manual draft), valid approval, or Keep Original decision
 *   exists on `custom.chain_cord_length_in`.
 * - Verifies live sibling `custom.chain_material` compatibility (supporting passive or kept
 *   legacy `"Cord"` only for `"studio_cord_stock"` without overwriting saved `"Cord"`, and
 *   confirming via `evaluateAiHardwareLengthSupport` that the resulting `aiKnownStudioHardwareBasis`
 *   entry is supported under the live state).
 */
function verifyCurrentScanKnownStudioHardwareLengthProposal({
  entry,
  rawValue,
  reportedSource,
  productId,
  requestId,
  destKey,
  contract,
  targetBaseline,
  combinedProducerAndVisionProposals,
  existingProdProposals,
  existingProdApprovals,
  existingProdKeepOriginal
}) {
  if (
    destKey !== "custom.chain_cord_length_in" ||
    !contract ||
    contract.owner !== "PRODUCT" ||
    contract.namespace !== "custom" ||
    contract.destinationKey !== "custom.chain_cord_length_in" ||
    contract.isWritableInBatch1 !== true
  ) {
    return { eligible: false, basis: null, normalizedSource: null, holdReason: null };
  }

  if (
    !entry ||
    typeof entry !== "object" ||
    Array.isArray(entry) ||
    !entry.trustedKnownHardwareLengthProvenance ||
    typeof entry.trustedKnownHardwareLengthProvenance !== "object" ||
    Array.isArray(entry.trustedKnownHardwareLengthProvenance)
  ) {
    return { eligible: false, basis: null, normalizedSource: null, holdReason: null };
  }

  const rawProv = entry.trustedKnownHardwareLengthProvenance;
  if (!isExactProductGid(productId) || rawProv.productId !== productId) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason: "Rejected AI chain/cord length proposal: product GID mismatch in hardware provenance."
    };
  }
  if (
    typeof requestId !== "string" ||
    requestId.trim() === "" ||
    rawProv.requestId !== requestId
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason: "Rejected AI chain/cord length proposal: scan requestId mismatch in hardware provenance."
    };
  }
  if (
    rawProv.verified !== true ||
    rawProv.destinationKey !== "custom.chain_cord_length_in" ||
    rawValue !== KNOWN_STUDIO_HARDWARE_LENGTH_IN ||
    rawProv.emittedValue !== KNOWN_STUDIO_HARDWARE_LENGTH_IN ||
    rawProv.basis !== "vision_photo_match_known_studio_stock"
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason: "Rejected AI chain/cord length proposal: unverified value or basis in hardware provenance."
    };
  }

  const rawMatchedOpt =
    typeof rawProv.matchedHardwareOption === "string"
      ? rawProv.matchedHardwareOption.trim()
      : "";
  const resolvedHw = resolveKnownStudioHardwareOptionLength(rawMatchedOpt);
  if (
    !resolvedHw.matched ||
    resolvedHw.canonicalOption !== rawMatchedOpt ||
    resolvedHw.lengthIn !== KNOWN_STUDIO_HARDWARE_LENGTH_IN ||
    rawProv.hardwareCategory !== resolvedHw.category
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason: `Rejected AI chain/cord length proposal: "${rawMatchedOpt}" is not a confirmed ${KNOWN_STUDIO_HARDWARE_LENGTH_IN}-inch studio hardware stock option.`
    };
  }

  // Confirm live baseline on custom.chain_cord_length_in is complete and genuinely blank.
  const lengthBaselineObs = buildBaselineObservation(
    targetBaseline,
    "custom.chain_cord_length_in"
  );
  if (
    !lengthBaselineObs.evidenceAvailable ||
    lengthBaselineObs.metafieldsCompleteState !== "complete"
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        "Held AI 18 in studio length proposal: saved baseline read for custom.chain_cord_length_in is incomplete."
    };
  }
  if (lengthBaselineObs.presence === "present") {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        "Held AI 18 in studio length proposal: a saved chain/cord length already exists on this product and is preserved."
    };
  }
  if (!isConfirmedBlankBaselinePresence(lengthBaselineObs.presence)) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        "Held AI 18 in studio length proposal: custom.chain_cord_length_in baseline could not be confirmed blank."
    };
  }

  // Confirm ZERO human length state on custom.chain_cord_length_in (including temporarily empty manual drafts,
  // valid approvals, or valid Keep Original records). Never stage an AI alternative against human length edits.
  const hasExistingLengthKey = Boolean(
    existingProdProposals &&
      Object.prototype.hasOwnProperty.call(existingProdProposals, "custom.chain_cord_length_in")
  );
  const existingLengthEntry = hasExistingLengthKey
    ? existingProdProposals["custom.chain_cord_length_in"]
    : undefined;
  const existingLengthVal = getProposalValueString(existingLengthEntry);
  const isExistingManualLengthDraft = Boolean(
    hasExistingLengthKey &&
      (typeof existingLengthEntry !== "object" ||
        existingLengthEntry === null ||
        existingLengthEntry.origin !== "AI")
  );
  const existingLengthApproval = existingProdApprovals?.["custom.chain_cord_length_in"] || null;
  const hasValidExistingLengthApproval = Boolean(
    hasExistingLengthKey &&
      existingLengthVal.trim() !== "" &&
      isExactValueApprovalValid({
        approvalRecord: existingLengthApproval,
        productId,
        destinationKey: "custom.chain_cord_length_in",
        currentProposedValue: existingLengthVal,
        baselineSnapshot: targetBaseline,
        rawProposalEntry: existingLengthEntry,
        proposedMapForProduct: existingProdProposals,
        keepOriginalMapForProduct: existingProdKeepOriginal
      })
  );
  const existingLengthKeepOrig = existingProdKeepOriginal?.["custom.chain_cord_length_in"] || null;
  const hasValidExistingLengthKeepOrig = Boolean(
    hasExistingLengthKey &&
      existingLengthVal.trim() !== "" &&
      isKeepOriginalRecordValid({
        keepOriginalRecord: existingLengthKeepOrig,
        productId,
        destinationKey: "custom.chain_cord_length_in",
        currentProposedValue: existingLengthVal,
        baselineSnapshot: targetBaseline
      })
  );

  if (
    isExistingManualLengthDraft ||
    hasValidExistingLengthApproval ||
    hasValidExistingLengthKeepOrig
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        "Preserved existing operator draft or decision on custom.chain_cord_length_in without staging an AI studio-stock override."
    };
  }

  // Verify live baseline and sibling state on custom.chain_material and custom.chain_link_type.
  const chainMatBaselineObs = buildBaselineObservation(
    targetBaseline,
    "custom.chain_material"
  );
  if (
    !chainMatBaselineObs.evidenceAvailable ||
    chainMatBaselineObs.metafieldsCompleteState !== "complete"
  ) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        "Held AI 18 in studio length proposal: saved baseline read for custom.chain_material is incomplete."
    };
  }
  const savedChainMat =
    chainMatBaselineObs.presence === "present" && typeof chainMatBaselineObs.rawValue === "string"
      ? chainMatBaselineObs.rawValue.trim()
      : "";

  // Check operator lock on chain_link_type === "None"
  const existingChainLinkEntry = existingProdProposals?.["custom.chain_link_type"];
  const existingChainLinkVal = getProposalValueString(existingChainLinkEntry).trim();
  const isManualChainLinkNone = Boolean(
    existingChainLinkEntry &&
      (typeof existingChainLinkEntry !== "object" || existingChainLinkEntry.origin !== "AI") &&
      /^none$/i.test(existingChainLinkVal)
  );
  if (isManualChainLinkNone) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        'Held AI 18 in studio length proposal: custom.chain_link_type has a manual draft of "None".'
    };
  }

  // Cross-check sibling custom.chain_material in the current scan response and live human state.
  const hasExistingChainMatKey = Boolean(
    existingProdProposals &&
      Object.prototype.hasOwnProperty.call(existingProdProposals, "custom.chain_material")
  );
  const existingChainMatEntry = hasExistingChainMatKey
    ? existingProdProposals["custom.chain_material"]
    : undefined;
  const existingChainMatVal = getProposalValueString(existingChainMatEntry);
  const isManualChainMatDraft = Boolean(
    hasExistingChainMatKey &&
      (typeof existingChainMatEntry !== "object" ||
        existingChainMatEntry === null ||
        existingChainMatEntry.origin !== "AI")
  );
  const existingChainMatApproval = existingProdApprovals?.["custom.chain_material"] || null;
  const hasValidChainMatApproval = Boolean(
    hasExistingChainMatKey &&
      existingChainMatVal.trim() !== "" &&
      isExactValueApprovalValid({
        approvalRecord: existingChainMatApproval,
        productId,
        destinationKey: "custom.chain_material",
        currentProposedValue: existingChainMatVal,
        baselineSnapshot: targetBaseline
      })
  );
  const existingChainMatKeepOrig = existingProdKeepOriginal?.["custom.chain_material"] || null;
  const hasValidChainMatKeepOrig = Boolean(
    hasExistingChainMatKey &&
      existingChainMatVal.trim() !== "" &&
      isKeepOriginalRecordValid({
        keepOriginalRecord: existingChainMatKeepOrig,
        productId,
        destinationKey: "custom.chain_material",
        currentProposedValue: existingChainMatVal,
        baselineSnapshot: targetBaseline
      })
  );

  const isChainMatHumanLocked =
    isManualChainMatDraft || hasValidChainMatApproval || hasValidChainMatKeepOrig;

  const responseChainMatProposal =
    combinedProducerAndVisionProposals?.["custom.chain_material"];
  const responseChainMatVal =
    responseChainMatProposal &&
    typeof responseChainMatProposal === "object" &&
    typeof responseChainMatProposal.value === "string"
      ? responseChainMatProposal.value.trim()
      : "";

  const projectedProposalsForSupportCheck = { ...(existingProdProposals || {}) };

  if (isChainMatHumanLocked) {
    if (hasValidChainMatKeepOrig) {
      if (savedChainMat === "") {
        return {
          eligible: false,
          basis: null,
          normalizedSource: null,
          holdReason:
            "Held AI 18 in studio length proposal: custom.chain_material is marked Keep Original (Not set)."
        };
      }
      const compatibleKept = areHardwareOptionsCompatibleForKnownStudioLength({
        matchedOption: resolvedHw.canonicalOption,
        candidateOrSavedChainMaterial: savedChainMat,
        allowLegacyGenericCord: true
      });
      if (!compatibleKept) {
        return {
          eligible: false,
          basis: null,
          normalizedSource: null,
          holdReason: `Held AI 18 in studio length proposal: custom.chain_material is marked Keep Original ("${savedChainMat}"), which conflicts with "${resolvedHw.canonicalOption}".`
        };
      }
    } else {
      const trimmedHumanMat = existingChainMatVal.trim();
      if (trimmedHumanMat === "") {
        return {
          eligible: false,
          basis: null,
          normalizedSource: null,
          holdReason:
            "Held AI 18 in studio length proposal: custom.chain_material currently has an empty manual draft."
        };
      }
      const compatibleHumanDraft = areHardwareOptionsCompatibleForKnownStudioLength({
        matchedOption: resolvedHw.canonicalOption,
        candidateOrSavedChainMaterial: trimmedHumanMat,
        allowLegacyGenericCord: isLegacyGenericStudioCordLabel(trimmedHumanMat)
      });
      // Note: if human drafted legacy "Cord" manually as plain text, evaluateAiHardwareLengthSupport
      // requires an active draft to be one of the 12 confirmed studio stock options.
      const humanDraftKnown = resolveKnownStudioHardwareOptionLength(trimmedHumanMat);
      if (!compatibleHumanDraft || !humanDraftKnown.matched) {
        return {
          eligible: false,
          basis: null,
          normalizedSource: null,
          holdReason: `Held AI 18 in studio length proposal: current human custom.chain_material ("${trimmedHumanMat}") is not compatible with "${resolvedHw.canonicalOption}".`
        };
      }
    }
  } else {
    // When custom.chain_material is NOT human-locked, the same scan response must carry
    // the exact matching studio hardware proposal on custom.chain_material, and any
    // passive saved chain_material must be compatible (allowing passive legacy "Cord"
    // for studio_cord_stock).
    const respKnown = resolveKnownStudioHardwareOptionLength(responseChainMatVal);
    if (!respKnown.matched || respKnown.canonicalOption !== resolvedHw.canonicalOption) {
      return {
        eligible: false,
        basis: null,
        normalizedSource: null,
        holdReason:
          "Rejected AI 18 in studio length proposal: current scan response did not include the matching custom.chain_material studio stock proposal."
      };
    }

    const compatibleSaved = areHardwareOptionsCompatibleForKnownStudioLength({
      matchedOption: resolvedHw.canonicalOption,
      candidateOrSavedChainMaterial: savedChainMat,
      allowLegacyGenericCord: true
    });
    if (!compatibleSaved) {
      return {
        eligible: false,
        basis: null,
        normalizedSource: null,
        holdReason: `Held AI 18 in studio length proposal: saved custom.chain_material ("${savedChainMat}") conflicts with photo match "${resolvedHw.canonicalOption}".`
      };
    }

    projectedProposalsForSupportCheck["custom.chain_material"] = {
      value: respKnown.canonicalOption,
      source:
        typeof responseChainMatProposal.source === "string" &&
        responseChainMatProposal.source.trim() !== ""
          ? responseChainMatProposal.source.trim()
          : "Gemini Vision (chain_material)",
      origin: "AI"
    };
  }

  const normalizedEvidenceSource =
    typeof reportedSource === "string" &&
    reportedSource.trim() !== "" &&
    reportedSource !== "Source not reported"
      ? reportedSource.trim()
      : `Known Studio Hardware Stock (${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in confirmed for ${resolvedHw.canonicalOption}; Gemini Vision photo match)`;

  const stampedBasis = Object.freeze({
    kind: "ai_known_studio_hardware_length_basis",
    productId,
    requestId,
    destinationKey: "custom.chain_cord_length_in",
    matchedHardwareOption: resolvedHw.canonicalOption,
    hardwareCategory: resolvedHw.category,
    emittedValue: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
    basis: "vision_photo_match_known_studio_stock",
    verifiedAt: new Date().toISOString()
  });

  const candidateAiLengthEntry = {
    value: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
    source: normalizedEvidenceSource,
    origin: "AI",
    aiKnownStudioHardwareBasis: stampedBasis
  };
  projectedProposalsForSupportCheck["custom.chain_cord_length_in"] = candidateAiLengthEntry;

  const contractSupportCheck = evaluateAiHardwareLengthSupport({
    productId,
    rawLengthPropEntry: candidateAiLengthEntry,
    baselineSnapshot: targetBaseline,
    proposedMapForProduct: projectedProposalsForSupportCheck,
    keepOriginalMapForProduct: existingProdKeepOriginal
  });

  if (!contractSupportCheck.isAiHardwareDerived || !contractSupportCheck.supported) {
    return {
      eligible: false,
      basis: null,
      normalizedSource: null,
      holdReason:
        contractSupportCheck.reason ||
        "Held AI 18 in studio length proposal: live hardware support check did not pass."
    };
  }

  return {
    eligible: true,
    basis: stampedBasis,
    normalizedSource: normalizedEvidenceSource,
    holdReason: null
  };
}

function buildBaselineWithVerifiedReferenceForDestination(
  targetBaseline,
  destKey,
  refChoicesRecord,
  isRefChoicesFreshForBaseline
) {
  if (!targetBaseline || typeof targetBaseline !== "object") {
    return targetBaseline;
  }
  const contract = getFieldContractByDestination(destKey);
  if (!contract || contract.namespace !== "shopify") {
    return targetBaseline;
  }
  if (targetBaseline.verifiedReferenceEntriesByDestination?.[destKey]) {
    return targetBaseline;
  }
  const verifiedFieldRes = isRefChoicesFreshForBaseline
    ? refChoicesRecord?.verifiedReferenceEntriesByDestination?.[destKey] || null
    : null;
  if (!verifiedFieldRes || typeof verifiedFieldRes !== "object") {
    return targetBaseline;
  }
  return {
    ...targetBaseline,
    verifiedReferenceEntriesByDestination: {
      ...(targetBaseline.verifiedReferenceEntriesByDestination || {}),
      [destKey]: verifiedFieldRes
    }
  };
}

function formatAiScanSummaryText({
  receivedCount,
  stagedCount,
  preapprovedGeologyCount = 0,
  heldConflictCount,
  unchangedSkippedCount,
  ignoredManualOnlyCount
}) {
  const manualIgnoredNote =
    ignoredManualOnlyCount > 0
      ? `, ${ignoredManualOnlyCount} manual-only suggestion${
          ignoredManualOnlyCount === 1 ? "" : "s"
        } ignored`
      : "";

  const unapprovedStagedCount = Math.max(0, stagedCount - preapprovedGeologyCount);
  const stagedBreakdownText =
    preapprovedGeologyCount > 0
      ? `${unapprovedStagedCount} staged as unapproved draft${
          unapprovedStagedCount === 1 ? "" : "s"
        }, ${preapprovedGeologyCount} trusted DB geology suggestion${
          preapprovedGeologyCount === 1 ? "" : "s"
        } preapproved for explicit Save`
      : `${stagedCount} staged as unapproved draft${stagedCount === 1 ? "" : "s"}`;

  return `AI Scan complete: ${receivedCount} eligible suggestion${
    receivedCount === 1 ? "" : "s"
  } received (${stagedBreakdownText}, ${heldConflictCount} held as alternatives alongside your existing edits, ${unchangedSkippedCount} matched saved baseline${manualIgnoredNote}).`;
}

function evaluateAndRecordResolvedAiProposal({
  productId,
  destKey,
  normalizedValue,
  reportedSource,
  displayNote = "",
  allowExplicitReferenceListReplacement = false,
  trustedGeologyDbProvenance = null,
  aiKnownStudioHardwareBasis = null,
  requestId,
  targetBaseline,
  existingProdProposals,
  existingProdApprovals,
  existingProdKeepOriginal,
  nextAiAlternativesForProd,
  proposalsByDestination,
  details
}) {
  const contractForDest = getFieldContractByDestination(destKey);
  const shouldBindReplacementIntent = Boolean(
    allowExplicitReferenceListReplacement === true &&
      contractForDest?.namespace === "shopify" &&
      contractForDest?.expectedType === "list.metaobject_reference" &&
      contractForDest?.isWritableInBatch1 === true &&
      typeof normalizedValue === "string" &&
      normalizedValue.trim() !== ""
  );

  const hasValidKnownHardwareBasis = Boolean(
    destKey === "custom.chain_cord_length_in" &&
      normalizedValue === KNOWN_STUDIO_HARDWARE_LENGTH_IN &&
      aiKnownStudioHardwareBasis &&
      typeof aiKnownStudioHardwareBasis === "object" &&
      !Array.isArray(aiKnownStudioHardwareBasis) &&
      aiKnownStudioHardwareBasis.productId === productId &&
      aiKnownStudioHardwareBasis.requestId === requestId &&
      aiKnownStudioHardwareBasis.destinationKey === "custom.chain_cord_length_in" &&
      aiKnownStudioHardwareBasis.emittedValue === KNOWN_STUDIO_HARDWARE_LENGTH_IN
  );

  const hasExistingKey = Object.prototype.hasOwnProperty.call(
    existingProdProposals,
    destKey
  );
  const existingDraft = hasExistingKey ? existingProdProposals[destKey] : undefined;
  const existingDraftVal = getProposalValueString(existingDraft);
  const hasExistingDraft = Boolean(existingDraft && existingDraftVal.trim() !== "");
  const isManualDraft = Boolean(
    hasExistingKey &&
      (typeof existingDraft !== "object" ||
        existingDraft === null ||
        existingDraft.origin !== "AI") &&
      (hasExistingDraft || destKey === "custom.chain_cord_length_in")
  );
  const existingAllowReplacement = hasExplicitReferenceReplacementFlag(
    existingDraft,
    destKey,
    existingDraftVal
  );

  const approvalRec = existingProdApprovals[destKey] || null;
  const hasValidApproval =
    hasExistingDraft &&
    isExactValueApprovalValid({
      approvalRecord: approvalRec,
      productId,
      destinationKey: destKey,
      currentProposedValue: existingDraftVal,
      baselineSnapshot: targetBaseline,
      allowExplicitReferenceListReplacement: existingAllowReplacement,
      rawProposalEntry: existingDraft,
      proposedMapForProduct: existingProdProposals,
      keepOriginalMapForProduct: existingProdKeepOriginal
    });

  const keepOrigRec = existingProdKeepOriginal[destKey] || null;
  const hasValidKeepOriginal =
    hasExistingDraft &&
    isKeepOriginalRecordValid({
      keepOriginalRecord: keepOrigRec,
      productId,
      destinationKey: destKey,
      currentProposedValue: existingDraftVal,
      baselineSnapshot: targetBaseline
    });

  const hasProtectedHumanState =
    isManualDraft || hasValidApproval || hasValidKeepOriginal;

  const formattedSuffix = displayNote ? ` [${displayNote}]` : "";

  if (hasProtectedHumanState) {
    if (
      existingDraftVal === normalizedValue &&
      existingAllowReplacement === shouldBindReplacementIntent &&
      !hasValidKeepOriginal
    ) {
      proposalsByDestination[destKey] = {
        value: normalizedValue,
        source: reportedSource,
        disposition: "Matches current draft"
      };
      details.push(
        `[${destKey}] AI suggestion matches your current draft ("${normalizedValue}"${formattedSuffix}) — Source: ${reportedSource}.`
      );
      return {
        dispositionOutcome: "matched_draft",
        approvalCleared: false,
        preapprovedGeology: false
      };
    }

    // Never stage a held AI alternative against protected human state on custom.chain_cord_length_in.
    if (destKey === "custom.chain_cord_length_in") {
      proposalsByDestination[destKey] = {
        value: normalizedValue,
        source: reportedSource,
        disposition: "Preserved human measurement / decision (not staged)"
      };
      details.push(
        `[${destKey}] Preserved your existing measurement or decision without staging AI studio-stock "${normalizedValue}" (Source: ${reportedSource}).`
      );
      return {
        dispositionOutcome: "matched_draft",
        approvalCleared: false,
        preapprovedGeology: false
      };
    }

    nextAiAlternativesForProd[destKey] = {
      value: normalizedValue,
      source: reportedSource,
      ...(shouldBindReplacementIntent
        ? {
            allowExplicitReferenceListReplacement: true,
            explicitReplacementValue: normalizedValue
          }
        : {}),
      requestId,
      receivedAt: new Date().toISOString()
    };
    proposalsByDestination[destKey] = {
      value: normalizedValue,
      source: reportedSource,
      disposition: "Held as separate AI alternative"
    };
    details.push(
      `[${destKey}] Held AI alternative "${normalizedValue}"${formattedSuffix} (Source: ${reportedSource}) without overwriting your current draft or decision.`
    );
    return {
      dispositionOutcome: "held_conflict",
      approvalCleared: false,
      preapprovedGeology: false
    };
  }

  let approvalCleared = false;
  if (existingProdApprovals[destKey]) {
    delete existingProdApprovals[destKey];
    approvalCleared = true;
  }

  const verifiedTrustedGeoProvenance =
    !hasValidKnownHardwareBasis && destKey !== "custom.chain_cord_length_in"
      ? verifyTrustedGeologyDbProvenanceForProposal({
          rawProvenance: trustedGeologyDbProvenance,
          productId,
          requestId,
          destKey,
          expectedEmittedValue: PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(destKey)
            ? null
            : normalizedValue
        })
      : null;

  existingProdProposals[destKey] = {
    value: normalizedValue,
    source: reportedSource,
    origin: "AI",
    ...(shouldBindReplacementIntent
      ? {
          allowExplicitReferenceListReplacement: true,
          explicitReplacementValue: normalizedValue
        }
      : {}),
    ...(verifiedTrustedGeoProvenance
      ? {
          trustedGeologyDbProvenance: verifiedTrustedGeoProvenance
        }
      : {}),
    ...(hasValidKnownHardwareBasis
      ? {
          aiKnownStudioHardwareBasis
        }
      : {}),
    updatedAt: new Date().toISOString()
  };

  if (verifiedTrustedGeoProvenance) {
    const fidelityCheck = checkExistingWriterStringFidelity(normalizedValue);
    if (fidelityCheck.faithful) {
      const createdApproval = createExactValueApprovalRecord({
        productId,
        destinationKey: destKey,
        proposedValue: normalizedValue,
        baselineSnapshot: targetBaseline,
        allowExplicitReferenceListReplacement: shouldBindReplacementIntent
      });

      if (
        createdApproval.ok &&
        createdApproval.record &&
        isExactValueApprovalValid({
          approvalRecord: createdApproval.record,
          productId,
          destinationKey: destKey,
          currentProposedValue: normalizedValue,
          baselineSnapshot: targetBaseline,
          allowExplicitReferenceListReplacement: shouldBindReplacementIntent
        })
      ) {
        existingProdApprovals[destKey] = createdApproval.record;
        proposalsByDestination[destKey] = {
          value: normalizedValue,
          source: reportedSource,
          disposition: `Staged and preapproved (verified DB geology for "${verifiedTrustedGeoProvenance.dbMatchedStoneName}")`,
          trustedGeologyDbProvenance: verifiedTrustedGeoProvenance
        };
        details.push(
          `[${destKey}] Staged and preapproved trusted DB geology "${normalizedValue}"${formattedSuffix} (Matched stone: "${verifiedTrustedGeoProvenance.dbMatchedStoneName}" — Source: ${reportedSource}; requires explicit Save Approved).`
        );
        return {
          dispositionOutcome: "staged",
          approvalCleared: false,
          preapprovedGeology: true
        };
      }
    }
  }

  proposalsByDestination[destKey] = {
    value: normalizedValue,
    source: reportedSource,
    disposition: "Staged as unapproved AI draft",
    ...(hasValidKnownHardwareBasis
      ? {
          aiKnownStudioHardwareBasis
        }
      : {})
  };
  details.push(
    `[${destKey}] Staged unapproved AI draft "${normalizedValue}"${formattedSuffix} (Source: ${reportedSource}).`
  );
  return {
    dispositionOutcome: "staged",
    approvalCleared,
    preapprovedGeology: false
  };
}

export function resolveProducerBackedGeologyReferenceCandidate({
  productId,
  destKey,
  candidateLabels,
  targetBaseline,
  refChoicesRecord,
  isRefChoicesFreshForBaseline
}) {
  const cleanLabels = Array.isArray(candidateLabels)
    ? candidateLabels
        .filter((lbl) => typeof lbl === "string" && lbl.trim() !== "")
        .map((lbl) => lbl.trim())
    : [];
  const displayLabel = cleanLabels.join(", ");

  if (cleanLabels.length === 0) {
    return {
      status: "invalid_candidate",
      displayLabel: "",
      reason: `Empty standardized reference candidate label on ${destKey}.`
    };
  }

  if (isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
    return {
      status: "not_eligible_contract",
      displayLabel,
      reason: `Destination ${destKey} is retired and removed from the Bench V2 contract.`
    };
  }

  const contract = getFieldContractByDestination(destKey);
  if (
    !contract ||
    !contract.isWritableInBatch1 ||
    contract.namespace !== "shopify" ||
    !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
  ) {
    return {
      status: "not_eligible_contract",
      displayLabel,
      reason: `Destination ${destKey} is not an authorized producer-backed or Vision-backed standardized reference companion.`
    };
  }

  if (!targetBaseline || targetBaseline.productId !== productId) {
    return {
      status: "pending_reference_choices",
      displayLabel,
      reason: `Product baseline is not loaded for ${destKey}; retaining candidate "${displayLabel}" until reference choices are ready.`
    };
  }

  const baselineObs = buildBaselineObservation(targetBaseline, destKey);
  const typeCheck = evaluateDestinationTypeAndCompleteness({
    contract,
    baselineObs
  });

  if (!typeCheck.ready) {
    const isPendingBaselineRead =
      typeCheck.code === "metafields_read_not_complete" ||
      typeCheck.code === "definitions_read_not_complete" ||
      typeCheck.code === "product_category_read_not_complete" ||
      typeCheck.code === "category_eligibility_incomplete";
    return {
      status: isPendingBaselineRead ? "pending_reference_choices" : "held_ineligible_or_blocked",
      displayLabel,
      reason:
        typeCheck.reason ||
        `Destination ${destKey} is not eligible on this product.`
    };
  }

  const storedCheck = inspectStoredReferenceListRawValue(baselineObs.rawValue);
  if (!storedCheck.valid) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: `Existing stored reference list on ${destKey} could not be parsed safely: ${storedCheck.error}`
    };
  }

  const verifiedFieldRes =
    targetBaseline.verifiedReferenceEntriesByDestination?.[destKey] ||
    (isRefChoicesFreshForBaseline
      ? refChoicesRecord?.verifiedReferenceEntriesByDestination?.[destKey]
      : null) ||
    null;

  if (!verifiedFieldRes || typeof verifiedFieldRes !== "object") {
    return {
      status: "pending_reference_choices",
      displayLabel,
      reason: `Verified Metaobject reference choices for ${destKey} (${baselineObs.restrictedMetaobjectDefinitionId || "definition"}) are still loading or pending; retaining candidate "${displayLabel}".`
    };
  }

  if (
    verifiedFieldRes.status === "category_ineligible" ||
    verifiedFieldRes.isCategoryEligible === false ||
    verifiedFieldRes.categoryEligibility?.isEligible === false
  ) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason:
        verifiedFieldRes.categoryEligibility?.reason ||
        (Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors[0]) ||
        `Blocked by product category constraint on ${destKey}.`
    };
  }

  const rawResolvedDefId =
    verifiedFieldRes.restrictedMetaobjectDefinitionId ||
    verifiedFieldRes.restrictedMetaobjectDefinition?.id ||
    verifiedFieldRes.metafieldDefinition?.restrictedMetaobjectDefinitionId ||
    null;

  const hasDefTypeMismatch = Boolean(
    verifiedFieldRes.metafieldDefinition &&
      typeof verifiedFieldRes.metafieldDefinition === "object" &&
      verifiedFieldRes.metafieldDefinition.type &&
      verifiedFieldRes.metafieldDefinition.type !== "list.metaobject_reference"
  );

  const hasDefIdMismatch = Boolean(
    rawResolvedDefId !== null &&
      (!isExactMetaobjectDefinitionGid(rawResolvedDefId) ||
        rawResolvedDefId !== baselineObs.restrictedMetaobjectDefinitionId)
  );

  const hasDefMismatchError = Boolean(
    Array.isArray(verifiedFieldRes.errors) &&
      verifiedFieldRes.errors.some(
        (e) =>
          typeof e === "string" &&
          /Restricted MetaobjectDefinition mismatch or invalid ID/i.test(e)
      )
  );

  if (
    hasDefTypeMismatch ||
    hasDefIdMismatch ||
    hasDefMismatchError ||
    verifiedFieldRes.status === "blocked"
  ) {
    const firstDefErr =
      Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors.length > 0
        ? verifiedFieldRes.errors[0]
        : `Restricted MetaobjectDefinition mismatch or blocked definition on ${destKey}.`;
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: firstDefErr
    };
  }

  const refAssignment = verifiedFieldRes.currentAssignment;
  if (
    refAssignment &&
    typeof refAssignment === "object" &&
    refAssignment.parseValid === false
  ) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason:
        refAssignment.parseError ||
        `Existing assignment preservation cannot be established on ${destKey}.`
    };
  }

  if (verifiedFieldRes.isComplete !== true) {
    const pendingReason =
      Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors.length > 0
        ? verifiedFieldRes.errors[0]
        : `Verified Metaobject reference choices for ${destKey} (${baselineObs.restrictedMetaobjectDefinitionId || "definition"}) did not finish loading; retaining candidate "${displayLabel}" for retry.`;
    return {
      status: "pending_reference_choices",
      displayLabel,
      reason: pendingReason
    };
  }

  if (
    !isExactMetaobjectDefinitionGid(verifiedFieldRes.restrictedMetaobjectDefinitionId) ||
    verifiedFieldRes.restrictedMetaobjectDefinitionId !==
      baselineObs.restrictedMetaobjectDefinitionId
  ) {
    const firstErr =
      Array.isArray(verifiedFieldRes.errors) && verifiedFieldRes.errors.length > 0
        ? verifiedFieldRes.errors[0]
        : `Incomplete or mismatched reference choice enumeration on ${destKey}.`;
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: firstErr
    };
  }

  if (
    !refAssignment ||
    typeof refAssignment !== "object" ||
    refAssignment.readComplete !== true ||
    refAssignment.parseValid !== true
  ) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason:
        refAssignment?.parseError ||
        `Existing assignment preservation cannot be established on ${destKey}.`
    };
  }

  const rawVerifiedEntriesMap = collectVerifiedEntriesForResolution(verifiedFieldRes);
  const strictVerifiedEntriesMap = new Map();
  rawVerifiedEntriesMap.forEach((entryObj, gid) => {
    if (
      isExactMetaobjectGid(gid) &&
      entryObj &&
      entryObj.definitionId === baselineObs.restrictedMetaobjectDefinitionId
    ) {
      strictVerifiedEntriesMap.set(gid, entryObj);
    }
  });

  if (strictVerifiedEntriesMap.size === 0) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason: `0 verified Metaobject entries exist in Shopify for ${baselineObs.restrictedMetaobjectDefinitionId} (${destKey}); held candidate "${displayLabel}".`
    };
  }

  const existingGids = [...storedCheck.gids];
  if (Array.isArray(refAssignment.referenceIds)) {
    for (const refGid of refAssignment.referenceIds) {
      if (typeof refGid === "string" && isExactMetaobjectGid(refGid.trim())) {
        const trimmedRefGid = refGid.trim();
        if (!existingGids.includes(trimmedRefGid)) {
          existingGids.push(trimmedRefGid);
        }
      }
    }
  }

  const labelEvaluations = cleanLabels.map((lbl) =>
    evaluateCandidateLabelResolution(
      lbl,
      verifiedFieldRes,
      strictVerifiedEntriesMap,
      existingGids
    )
  );

  const failedEval = labelEvaluations.find(
    (ev) =>
      ev.status === "missing_entry" ||
      ev.status === "ambiguous_blocked" ||
      ev.status === "blocked" ||
      !ev.selectedEntry ||
      !isExactMetaobjectGid(ev.selectedEntry.id) ||
      ev.selectedEntry.definitionId !== baselineObs.restrictedMetaobjectDefinitionId
  );

  if (failedEval) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason:
        failedEval.reason ||
        `Candidate "${displayLabel}" did not resolve to a unique/equivalent verified entry on ${destKey}.`
    };
  }

  const resolvedOnlyGids = [];
  const matchedLabelsList = [];
  for (const ev of labelEvaluations) {
    const selectedGid = ev.selectedEntry.id;
    if (!resolvedOnlyGids.includes(selectedGid)) {
      resolvedOnlyGids.push(selectedGid);
    }
    matchedLabelsList.push(
      `${ev.selectedEntry.label || displayLabel} (${selectedGid})`
    );
  }

  if (resolvedOnlyGids.length === 0) {
    return {
      status: "held_unmatched_or_ambiguous",
      displayLabel,
      reason: `Candidate "${displayLabel}" resolved to 0 verified Metaobject entries on ${destKey}.`
    };
  }

  const isSemanticallyEquivalentToSaved = Boolean(
    baselineObs.presence === "present" &&
      storedCheck.gids.length > 0 &&
      areReferenceGidSetsSemanticallyEquivalent(
        resolvedOnlyGids,
        storedCheck.gids,
        strictVerifiedEntriesMap,
        baselineObs.restrictedMetaobjectDefinitionId
      )
  );

  if (isSemanticallyEquivalentToSaved) {
    const preservedStoredRaw =
      typeof baselineObs.rawValue === "string" && baselineObs.rawValue.trim() !== ""
        ? baselineObs.rawValue.trim()
        : JSON.stringify(storedCheck.gids);
    return {
      status: "unchanged_from_baseline",
      displayLabel,
      serializedValue: preservedStoredRaw,
      allowExplicitReferenceListReplacement: false,
      matchedSummary: matchedLabelsList.join(", "),
      reason: "Resolved reference candidate is canonically equivalent to the current saved reference list."
    };
  }

  const resolvedSet = new Set(resolvedOnlyGids);
  const omitsAnyStoredGid = existingGids.some((g) => !resolvedSet.has(g));
  const serializedGidArray = JSON.stringify(resolvedOnlyGids);

  const baselineWithVerifiedRef =
    targetBaseline.verifiedReferenceEntriesByDestination?.[destKey]
      ? targetBaseline
      : {
          ...targetBaseline,
          verifiedReferenceEntriesByDestination: {
            ...(targetBaseline.verifiedReferenceEntriesByDestination || {}),
            [destKey]: verifiedFieldRes
          }
        };

  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey: destKey,
    proposedValue: serializedGidArray,
    baselineSnapshot: baselineWithVerifiedRef,
    allowExplicitReferenceListReplacement: omitsAnyStoredGid
  });

  if (!validation.valid) {
    return {
      status: "held_ineligible_or_blocked",
      displayLabel,
      reason: validation.reason
    };
  }

  if (validation.isUnchangedFromStored) {
    return {
      status: "unchanged_from_baseline",
      displayLabel,
      serializedValue: validation.normalizedValue,
      allowExplicitReferenceListReplacement: false,
      matchedSummary: matchedLabelsList.join(", "),
      reason: validation.reason
    };
  }

  return {
    status: "resolved_valid_change",
    displayLabel,
    serializedValue: validation.normalizedValue,
    allowExplicitReferenceListReplacement: Boolean(
      omitsAnyStoredGid && validation.allowExplicitReferenceListReplacement === true
    ),
    matchedSummary: matchedLabelsList.join(", "),
    reason: null
  };
}

export function useBenchV2AiScanController({
  activeProductId,
  activeProductIdRef: externalActiveProductIdRef = null,
  activeProductTitle,
  benchSessionIdRef,
  baselineByProductRef,
  currentBaselineRef,
  currentRefChoicesRecordRef,
  isCurrentRefChoicesBoundAndFreshRef,
  isAnyOperationBusyRef,
  isScanBlockingBusyRef = null,
  ensureStandardizedReferenceChoicesLoadedOrInFlightRef = null,
  isJsonImportBusy,
  proposedByProduct,
  proposedByProductRef,
  setProposedByProduct,
  approvalsByProduct,
  approvalsByProductRef,
  setApprovalsByProduct,
  keepOriginalByProduct,
  keepOriginalByProductRef,
  setKeepOriginalByProduct,
  setClientPrevalidationBanner,
  clearDecisionForDestination
}) {
  const aiScanFetcher = useFetcher();
  const aiScanFetcherRef = useRef(aiScanFetcher);
  aiScanFetcherRef.current = aiScanFetcher;

  const internalActiveProductIdRef = useRef(activeProductId);
  internalActiveProductIdRef.current = activeProductId;
  const activeProductIdRef = externalActiveProductIdRef || internalActiveProductIdRef;

  // Held AI Alternatives State
  const [aiAlternativesByProduct, setAiAlternativesByProduct] = useState({});

  // Explicit AI Scan Request Tracking & Honest Scan Report
  const [activeAiScanRequest, setActiveAiScanRequest] = useState(null);
  const [lastAiScanReportByProduct, setLastAiScanReportByProduct] = useState({});
  const processedAiScanRequestIdRef = useRef(null);
  const activeAiScanRequestRef = useRef(null);
  const observedBusyAiScanRequestIdRef = useRef(null);

  // Staged Vision Candidates State (Populated by AI Scan, read by Reference Loader & Telemetry)
  const [stagedVisionCandidatesByProduct, setStagedVisionCandidatesByProduct] = useState({});
  const stagedVisionCandidatesByProductRef = useRef(stagedVisionCandidatesByProduct);
  useEffect(() => {
    stagedVisionCandidatesByProductRef.current = stagedVisionCandidatesByProduct;
  }, [stagedVisionCandidatesByProduct]);

  // Pending Producer-Backed & Vision-Backed Standardized Reference Candidates State
  // Retains unresolved geology & Vision reference candidates when AI Scan arrives before
  // reference choices finish loading, so either arrival order resolves once without
  // rescanning, loops, or unverified auto-approval.
  const [pendingGeologyRefCandidatesByProduct, setPendingGeologyRefCandidatesByProduct] =
    useState({});

  useEffect(() => {
    activeAiScanRequestRef.current = activeAiScanRequest;
  }, [activeAiScanRequest]);

  const isAiScanBusy = aiScanFetcher.state !== "idle" || Boolean(activeAiScanRequest);

  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentAiAlternativesMap = aiAlternativesByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};
  const currentAiScanReport = lastAiScanReportByProduct[activeProductId] || null;
  const currentScanProposalsMetaMap =
    currentAiScanReport?.proposalsByDestination &&
    typeof currentAiScanReport.proposalsByDestination === "object"
      ? currentAiScanReport.proposalsByDestination
      : {};

  const handleExplicitAiScanProduct = () => {
    setClientPrevalidationBanner(null);

    const currentBaseline = currentBaselineRef.current;
    const isCurrentRefChoicesBoundAndFresh = Boolean(
      isCurrentRefChoicesBoundAndFreshRef.current
    );
    const currentRefChoicesRecord = currentRefChoicesRecordRef.current;
    const isExclusiveBlockingBusy = isScanBlockingBusyRef
      ? Boolean(isScanBlockingBusyRef.current)
      : Boolean(isAnyOperationBusyRef?.current);
    const isSelfScanBusy =
      Boolean(activeAiScanRequestRef.current) ||
      aiScanFetcherRef.current.state !== "idle" ||
      isAiScanBusy;

    if (isExclusiveBlockingBusy || isSelfScanBusy || isJsonImportBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Operation already in progress",
        reasons: ["Wait for the current operation to complete before starting an AI Scan."]
      });
      return;
    }

    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: Product baseline not loaded",
        reasons: [`Reload ${activeProductTitle} so its baseline and photos are available.`]
      });
      return;
    }

    if (
      currentBaseline.metafieldsReadComplete !== true ||
      currentBaseline.defsReadComplete !== true
    ) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: Baseline read incomplete",
        reasons: [
          "Product metafields or live definitions did not finish loading. Click Reload Product first."
        ]
      });
      return;
    }

    const rawBaselineForScan =
      baselineByProductRef.current?.[activeProductId] || currentBaseline;
    if (
      !rawBaselineForScan ||
      rawBaselineForScan.productId !== activeProductId ||
      rawBaselineForScan.metafieldsReadComplete !== true ||
      rawBaselineForScan.defsReadComplete !== true
    ) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: Baseline read incomplete",
        reasons: [
          "Product metafields or live definitions did not finish loading. Click Reload Product first."
        ]
      });
      return;
    }

    const mediaEdges = Array.isArray(currentBaseline.nativeTargets?.media?.edges)
      ? currentBaseline.nativeTargets.media.edges
      : [];
    const mediaInputs = mediaEdges
      .map((edge) => {
        const node = edge?.node;
        const url = node?.preview?.image?.url || "";
        const imageId = node?.id || "";
        return url && imageId ? { imageId, url } : null;
      })
      .filter(Boolean);

    if (mediaInputs.length === 0) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot run AI Scan: No product photos found",
        reasons: [
          `No valid MediaImage URLs were found on ${activeProductTitle} for Gemini Vision.`
        ]
      });
      return;
    }

    const startedSessionId = benchSessionIdRef.current;
    const startedBaselineContextSig =
      buildStandardizedBaselineContextSignature(rawBaselineForScan);

    const operatorLockedList = [];
    const passiveStoredList = [];
    const contextKeyValues = {};

    for (const bareKey of ENGINE_ALLOWED_PROVENANCE_BARE_KEYS) {
      if (CANCELLED_INERT_DESTINATIONS.has(bareKey)) continue;

      let destKey = `custom.${bareKey}`;
      if (bareKey === "price") destKey = "native_price";
      else if (bareKey === "poetic_hook") destKey = "native_seo_description";

      if (destKey.startsWith("custom.") && isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
        continue;
      }

      const isSeoTitleDualKey = bareKey === "seo_title";
      const candidateDestKeys = isSeoTitleDualKey
        ? ["custom.seo_title", "native_seo_title"]
        : [destKey];

      let lockedHumanVal = "";
      let hasLockedHumanOrKeepOriginal = false;
      let hasEmptyManualDraftLock = false;

      for (const checkDest of candidateDestKeys) {
        const hasPropEntryKey = Object.prototype.hasOwnProperty.call(
          currentProposedMap,
          checkDest
        );
        const propEntry = hasPropEntryKey ? currentProposedMap[checkDest] : undefined;
        const propValStr = getProposalValueString(propEntry);
        const isManualOriginEntry = Boolean(
          hasPropEntryKey &&
            (typeof propEntry !== "object" ||
              propEntry === null ||
              propEntry.origin !== "AI")
        );
        const hasHumanDraft = Boolean(
          isManualOriginEntry && propValStr.trim() !== ""
        );
        if (isManualOriginEntry && propValStr.trim() === "") {
          hasEmptyManualDraftLock = true;
        }

        const allowRepForCheck = hasExplicitReferenceReplacementFlag(
          propEntry,
          checkDest,
          propValStr
        );
        const approvalRec = currentApprovalsMap[checkDest];
        const hasValidApproval = Boolean(
          approvalRec &&
            propEntry &&
            isExactValueApprovalValid({
              approvalRecord: approvalRec,
              productId: activeProductId,
              destinationKey: checkDest,
              currentProposedValue: propValStr,
              baselineSnapshot: currentBaseline,
              allowExplicitReferenceListReplacement: allowRepForCheck,
              rawProposalEntry: propEntry,
              proposedMapForProduct: currentProposedMap,
              keepOriginalMapForProduct: currentKeepOriginalMap
            })
        );

        const keepOrigRec = currentKeepOriginalMap[checkDest];
        const hasValidKeepOriginal = Boolean(
          keepOrigRec &&
            propEntry &&
            isKeepOriginalRecordValid({
              keepOriginalRecord: keepOrigRec,
              productId: activeProductId,
              destinationKey: checkDest,
              currentProposedValue: propValStr,
              baselineSnapshot: currentBaseline
            })
        );

        if (hasHumanDraft || hasValidApproval) {
          const humanVal = propValStr.trim();
          if (humanVal !== "") {
            lockedHumanVal = humanVal;
            hasLockedHumanOrKeepOriginal = true;
            break;
          }
        }

        if (hasValidKeepOriginal) {
          const storedForCheck =
            checkDest === "native_seo_title"
              ? String(currentBaseline.nativeTargets?.seo?.title ?? "").trim()
              : checkDest === "native_price"
                ? String(currentBaseline.nativeTargets?.price ?? "").trim()
                : checkDest === "native_seo_description"
                  ? String(currentBaseline.nativeTargets?.seo?.description ?? "").trim()
                  : String(currentBaseline.currentMetafields?.[checkDest] ?? "").trim();
          if (storedForCheck !== "") {
            lockedHumanVal = storedForCheck;
            hasLockedHumanOrKeepOriginal = true;
            break;
          }
          if (checkDest === "custom.chain_cord_length_in" || checkDest === "custom.chain_material") {
            hasEmptyManualDraftLock = true;
          }
        }
      }

      if (hasLockedHumanOrKeepOriginal && lockedHumanVal !== "") {
        operatorLockedList.push(bareKey);
        contextKeyValues[bareKey] = lockedHumanVal;
        continue;
      }

      // If the operator currently has a temporarily empty manual draft or Keep Original (Not set)
      // on chain_cord_length_in, lock chain_cord_length_in in operator_locked_fields so the server
      // knows human editing is active without inventing a fake nonblank value.
      if (hasEmptyManualDraftLock && bareKey === "chain_cord_length_in") {
        operatorLockedList.push(bareKey);
        continue;
      }

      let storedVal = "";
      if (bareKey === "price") {
        storedVal = currentBaseline.nativeTargets?.price || "";
      } else if (bareKey === "poetic_hook") {
        storedVal = currentBaseline.nativeTargets?.seo?.description || "";
      } else if (bareKey === "seo_title") {
        const rawCustomSeo = currentBaseline.currentMetafields?.["custom.seo_title"];
        const rawNativeSeo = currentBaseline.nativeTargets?.seo?.title;
        storedVal =
          rawCustomSeo !== undefined && rawCustomSeo !== null && String(rawCustomSeo).trim() !== ""
            ? String(rawCustomSeo).trim()
            : rawNativeSeo !== undefined && rawNativeSeo !== null
              ? String(rawNativeSeo).trim()
              : "";
      } else {
        const rawMf = currentBaseline.currentMetafields?.[`custom.${bareKey}`];
        storedVal = rawMf !== undefined && rawMf !== null ? String(rawMf).trim() : "";
      }

      if (storedVal !== "") {
        passiveStoredList.push(bareKey);
        contextKeyValues[bareKey] = storedVal;
      }
    }

    // Only populate observedDestinationTypes with genuinely observed Shopify types
    // (liveDefType || storedType), never claiming a reviewed_exact_contract type was observed.
    const observedDestinationTypes = {};
    for (const destKey of BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS) {
      const obs = buildBaselineObservation(currentBaseline, destKey);
      const contract = getFieldContractByDestination(destKey);
      const typeCheck = evaluateDestinationTypeAndCompleteness({
        contract,
        baselineObs: obs
      });
      if (typeCheck.ready && typeCheck.observedShopifyType) {
        observedDestinationTypes[destKey] = typeCheck.observedShopifyType;
      }
    }

    const ooak1Obs = buildBaselineObservation(currentBaseline, "custom.is_one_of_a_kind");
    const ooak1TypeCheck = evaluateDestinationTypeAndCompleteness({
      contract: getFieldContractByDestination("custom.is_one_of_a_kind"),
      baselineObs: ooak1Obs
    });
    const ooak1ObservedType =
      observedDestinationTypes["custom.is_one_of_a_kind"] ||
      (ooak1TypeCheck.ready && ooak1TypeCheck.observedShopifyType === "single_line_text_field"
        ? ooak1TypeCheck.observedShopifyType
        : "");
    const ooak2ObservedType = observedDestinationTypes["custom.is_ooak"] || "";

    // Extract live verified Color choices for shopify.color-pattern when bound, fresh,
    // eligible, and complete on the active product (transport prompt vocabulary only).
    let verifiedColorPatternChoicesJson = null;
    if (
      isCurrentRefChoicesBoundAndFresh &&
      currentRefChoicesRecord &&
      currentRefChoicesRecord.productId === activeProductId &&
      currentBaseline.productId === activeProductId
    ) {
      const colorPatternContract = getFieldContractByDestination("shopify.color-pattern");
      const colorPatternObs = buildBaselineObservation(
        currentBaseline,
        "shopify.color-pattern"
      );
      const colorPatternTypeCheck = evaluateDestinationTypeAndCompleteness({
        contract: colorPatternContract,
        baselineObs: colorPatternObs
      });

      if (
        colorPatternContract &&
        colorPatternContract.isWritableInBatch1 &&
        colorPatternTypeCheck.ready &&
        isExactMetaobjectDefinitionGid(colorPatternObs.restrictedMetaobjectDefinitionId)
      ) {
        const colorRefEvidence = inspectVerifiedReferenceEvidenceForDestination(
          currentBaseline,
          "shopify.color-pattern",
          colorPatternObs.restrictedMetaobjectDefinitionId
        );

        if (
          colorRefEvidence.evidenceLoaded &&
          colorRefEvidence.isComplete &&
          colorRefEvidence.restrictedMetaobjectDefinitionId ===
            colorPatternObs.restrictedMetaobjectDefinitionId &&
          colorRefEvidence.entriesByGid instanceof Map &&
          colorRefEvidence.entriesByGid.size > 0
        ) {
          const verifiedColorLabels = [];
          const seenLowerColorLabels = new Set();
          let hasInvalidChoiceEntry = false;

          colorRefEvidence.entriesByGid.forEach((entryObj, gid) => {
            if (hasInvalidChoiceEntry) return;
            if (
              !isExactMetaobjectGid(gid) ||
              !entryObj ||
              entryObj.definitionId !== colorPatternObs.restrictedMetaobjectDefinitionId ||
              typeof entryObj.label !== "string"
            ) {
              hasInvalidChoiceEntry = true;
              return;
            }
            const trimmedLabel = entryObj.label.trim();
            if (
              !trimmedLabel ||
              trimmedLabel === gid ||
              /^gid:\/\//i.test(trimmedLabel) ||
              (/metaobject/i.test(trimmedLabel) && /\d/.test(trimmedLabel))
            ) {
              hasInvalidChoiceEntry = true;
              return;
            }
            const lowerKey = trimmedLabel.replace(/\s+/g, " ").toLowerCase();
            if (!seenLowerColorLabels.has(lowerKey)) {
              seenLowerColorLabels.add(lowerKey);
              verifiedColorLabels.push(trimmedLabel);
            }
          });

          if (!hasInvalidChoiceEntry && verifiedColorLabels.length > 0) {
            verifiedColorPatternChoicesJson = JSON.stringify(verifiedColorLabels);
          }
        }
      }
    }

    // Coordinate reference choice loading in parallel after all AI Scan preflight
    // validations succeed (never aborts a valid AI scan if reference start returns false).
    if (
      typeof ensureStandardizedReferenceChoicesLoadedOrInFlightRef?.current ===
      "function"
    ) {
      try {
        ensureStandardizedReferenceChoicesLoadedOrInFlightRef.current();
      } catch {
        // Reference loader manages its own diagnostics; never block AI Scan submission.
      }
    }

    const requestId = `bench_v2_aiscan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const scanReqMeta = {
      requestId,
      sessionId: startedSessionId,
      productId: activeProductId,
      baselineContextSig: startedBaselineContextSig,
      startedAt: new Date().toISOString()
    };

    observedBusyAiScanRequestIdRef.current = null;
    activeAiScanRequestRef.current = scanReqMeta;
    setActiveAiScanRequest(scanReqMeta);

    const formData = new FormData();
    formData.append("intent", "tab3FullRescan");
    formData.append("benchV2OptIn", "true");
    formData.append("requestId", requestId);
    formData.append("pieceId", activeProductId);
    formData.append("productId", activeProductId);
    formData.append("productTitle", currentBaseline.productTitle || activeProductTitle || "");

    const humanPieceName =
      contextKeyValues.piece_name ||
      currentBaseline.currentMetafields?.["custom.piece_name"] ||
      "";
    if (humanPieceName) {
      formData.append("pieceName", String(humanPieceName));
      formData.append("humanPieceId", String(humanPieceName));
    }

    formData.append("mediaInputs", JSON.stringify(mediaInputs));
    if (mediaInputs[0]?.url) {
      formData.append("imageUrl", mediaInputs[0].url);
    }
    if (mediaInputs[0]?.imageId) {
      formData.append("imageId", mediaInputs[0].imageId);
    }

    formData.append("operator_locked_fields", JSON.stringify(operatorLockedList));
    formData.append("passive_stored_fields", JSON.stringify(passiveStoredList));
    formData.append("observed_destination_types", JSON.stringify(observedDestinationTypes));
    if (ooak1ObservedType) {
      formData.append("is_one_of_a_kind_observed_type", ooak1ObservedType);
    }
    if (ooak2ObservedType) {
      formData.append("is_ooak_observed_type", ooak2ObservedType);
    }
    if (verifiedColorPatternChoicesJson) {
      formData.append("verified_color_pattern_choices", verifiedColorPatternChoicesJson);
    }

    for (const [k, v] of Object.entries(contextKeyValues)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        formData.append(k, String(v));
      }
    }

    try {
      aiScanFetcherRef.current.submit(formData, {
        method: "POST",
        action: "/app/meta-injector-autofill"
      });
    } catch (submitErr) {
      const errMessage =
        submitErr && typeof submitErr.message === "string" && submitErr.message.trim() !== ""
          ? submitErr.message.trim()
          : "Failed to submit AI Scan request to /app/meta-injector-autofill.";
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [activeProductId]: {
          requestId,
          productId: activeProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary: `AI Scan failed: ${errMessage}`,
          receivedCount: 0,
          stagedCount: 0,
          preapprovedGeologyCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics: {},
          details: [],
          proposalsByDestination: {}
        }
      }));
      if (activeAiScanRequestRef.current?.requestId === requestId) {
        observedBusyAiScanRequestIdRef.current = null;
        activeAiScanRequestRef.current = null;
        setActiveAiScanRequest((prevReq) =>
          prevReq?.requestId === requestId ? null : prevReq
        );
      }
    }
  };

  useEffect(() => {
    const pendingScan = activeAiScanRequestRef.current;
    if (!pendingScan) return;

    if (aiScanFetcher.state !== "idle") {
      observedBusyAiScanRequestIdRef.current = pendingScan.requestId;
      return;
    }

    const rawResponse = aiScanFetcher.data;
    const hasMatchingResponseForPendingScan = Boolean(
      rawResponse &&
        typeof rawResponse === "object" &&
        rawResponse.requestId === pendingScan.requestId
    );

    if (
      observedBusyAiScanRequestIdRef.current !== pendingScan.requestId &&
      !hasMatchingResponseForPendingScan
    ) {
      return;
    }

    const returnedRequestId =
      rawResponse && typeof rawResponse === "object"
        ? rawResponse.requestId || null
        : null;
    const returnedPieceId =
      rawResponse && typeof rawResponse === "object"
        ? rawResponse.pieceId || rawResponse.productId || null
        : null;

    // If a prior scan's echoed requestId is still in fetcher.data before the current
    // request's response arrives, ignore the old payload without clearing or failing
    // the active request.
    if (
      returnedRequestId &&
      returnedRequestId !== pendingScan.requestId &&
      observedBusyAiScanRequestIdRef.current !== pendingScan.requestId
    ) {
      return;
    }

    if (processedAiScanRequestIdRef.current === pendingScan.requestId) {
      return;
    }
    processedAiScanRequestIdRef.current = pendingScan.requestId;

    const scannedProductId = pendingScan.productId;

    const releaseOwnActiveRequest = () => {
      if (activeAiScanRequestRef.current?.requestId === pendingScan.requestId) {
        observedBusyAiScanRequestIdRef.current = null;
        activeAiScanRequestRef.current = null;
        setActiveAiScanRequest((prevReq) =>
          prevReq?.requestId === pendingScan.requestId ? null : prevReq
        );
      }
    };

    const recordFailedScan = (summary, diagnostics = {}) => {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary,
          receivedCount: 0,
          stagedCount: 0,
          preapprovedGeologyCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics,
          details: [],
          proposalsByDestination: {}
        }
      }));
      releaseOwnActiveRequest();
    };

    if (!rawResponse || typeof rawResponse !== "object") {
      recordFailedScan("AI Scan failed: no structured response returned by /app/meta-injector-autofill.");
      return;
    }

    if (returnedRequestId !== pendingScan.requestId || returnedPieceId !== scannedProductId) {
      if (returnedRequestId === null && rawResponse.success === false && rawResponse.error) {
        recordFailedScan(
          rawResponse.error,
          rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
            ? rawResponse.producerDiagnostics
            : {}
        );
        return;
      }
      recordFailedScan(
        `Ignored mismatched or stale AI Scan response (expected product ${scannedProductId} / request ${pendingScan.requestId}, got product ${String(
          returnedPieceId
        )} / request ${String(returnedRequestId)}).`
      );
      return;
    }

    const rawTargetBaseline = baselineByProductRef.current?.[scannedProductId] || null;
    const targetBaselineContextSig =
      buildStandardizedBaselineContextSignature(rawTargetBaseline);

    if (
      pendingScan.sessionId !== benchSessionIdRef.current ||
      scannedProductId !== activeProductIdRef.current ||
      !rawTargetBaseline ||
      rawTargetBaseline.productId !== scannedProductId ||
      rawTargetBaseline.metafieldsReadComplete !== true ||
      rawTargetBaseline.defsReadComplete !== true ||
      targetBaselineContextSig !== pendingScan.baselineContextSig
    ) {
      recordFailedScan(
        "Discarded stale AI Scan response because the active product, bench session, or factual baseline changed while the scan was in flight."
      );
      return;
    }

    if (rawResponse.success !== true) {
      recordFailedScan(
        rawResponse.error || "AI Scan returned an error.",
        rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
          ? rawResponse.producerDiagnostics
          : {}
      );
      return;
    }

    const rawProducerProposals = rawResponse.producerProposals;
    if (
      !rawProducerProposals ||
      typeof rawProducerProposals !== "object" ||
      Array.isArray(rawProducerProposals)
    ) {
      recordFailedScan(
        "AI Scan response did not include producerProposals separation map; refused to stage tab3Data fallbacks."
      );
      return;
    }

    const hasVisionCandidatesProperty = Object.prototype.hasOwnProperty.call(
      rawResponse,
      "standardized_candidates"
    );
    const rawVisionStandardizedCandidates =
      rawResponse.standardized_candidates &&
      typeof rawResponse.standardized_candidates === "object" &&
      !Array.isArray(rawResponse.standardized_candidates)
        ? rawResponse.standardized_candidates
        : null;

    const {
      activeSanitized: activeBenchV2VisionCandidates,
      malformedActiveEntries: malformedVisionCandidateEntries
    } = filterAndValidateBenchV2VisionCandidates(rawVisionStandardizedCandidates);

    if (hasVisionCandidatesProperty) {
      stagedVisionCandidatesByProductRef.current = {
        ...stagedVisionCandidatesByProductRef.current,
        [scannedProductId]: activeBenchV2VisionCandidates
      };
      setStagedVisionCandidatesByProduct((prev) => ({
        ...prev,
        [scannedProductId]: activeBenchV2VisionCandidates
      }));
    }

    const combinedProducerAndVisionProposals = { ...rawProducerProposals };
    for (const [visionAttrKey, candEntry] of Object.entries(activeBenchV2VisionCandidates)) {
      const destKey = `shopify.${visionAttrKey}`;
      if (isRetiredParkedBenchDestination(destKey, "PRODUCT")) {
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(combinedProducerAndVisionProposals, destKey)) {
        continue;
      }
      combinedProducerAndVisionProposals[destKey] = {
        candidateLabel: candEntry.labels.join(", "),
        labels: [...candEntry.labels],
        source: `Gemini Vision (standardized_candidates.${visionAttrKey})`,
        evidence: candEntry.evidence
      };
    }

    const mergedActiveBaseline =
      currentBaselineRef.current &&
      currentBaselineRef.current.productId === scannedProductId
        ? currentBaselineRef.current
        : rawTargetBaseline;
    const isRefChoicesFreshForScannedProduct = Boolean(
      scannedProductId === activeProductIdRef.current &&
        isCurrentRefChoicesBoundAndFreshRef.current &&
        currentRefChoicesRecordRef.current &&
        currentRefChoicesRecordRef.current.productId === scannedProductId
    );
    const activeRefChoicesRecordForScan = isRefChoicesFreshForScannedProduct
      ? currentRefChoicesRecordRef.current
      : null;
    const targetBaseline = mergedActiveBaseline;

    const existingProdProposals = { ...(proposedByProductRef.current[scannedProductId] || {}) };
    const existingProdApprovals = { ...(approvalsByProductRef.current[scannedProductId] || {}) };
    const existingProdKeepOriginal = keepOriginalByProductRef.current[scannedProductId] || {};
    const nextAiAlternativesForProd = {};
    const proposalsByDestination = {};
    const nextPendingGeologyRefForProd = {};

    const diagnosticsObj =
      rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
        ? { ...rawResponse.producerDiagnostics }
        : {};

    let receivedCount = 0;
    let stagedCount = 0;
    let preapprovedGeologyCount = 0;
    let heldConflictCount = 0;
    let unchangedSkippedCount = 0;
    let rejectedInvalidCount = 0;
    let ignoredManualOnlyCount = 0;
    const details = [];

    for (const malformedItem of malformedVisionCandidateEntries) {
      if (Object.prototype.hasOwnProperty.call(combinedProducerAndVisionProposals, malformedItem.destKey)) {
        continue;
      }
      const malformedContract = getFieldContractByDestination(malformedItem.destKey);
      if (
        !malformedContract ||
        !malformedContract.isWritableInBatch1 ||
        !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(malformedItem.destKey) ||
        isManualOnlyNoAiDestination(malformedItem.destKey, malformedContract)
      ) {
        continue;
      }
      receivedCount++;
      rejectedInvalidCount++;
      proposalsByDestination[malformedItem.destKey] = {
        value: malformedItem.valueSummary,
        source: malformedItem.source,
        disposition: "Rejected (invalid)",
        reason: malformedItem.reason
      };
      diagnosticsObj[malformedItem.destKey] = malformedItem.reason;
      details.push(
        `[${malformedItem.destKey}] Rejected invalid Vision candidate${
          malformedItem.valueSummary ? ` "${malformedItem.valueSummary}"` : ""
        } (Source: ${malformedItem.source}): ${malformedItem.reason}`
      );
    }

    const stageOrHoldResolvedProposal = ({
      destKey,
      normalizedValue,
      reportedSource,
      displayNote = "",
      allowExplicitReferenceListReplacement = false,
      trustedGeologyDbProvenance = null,
      aiKnownStudioHardwareBasis = null,
      baselineForDest = targetBaseline
    }) => {
      const outcome = evaluateAndRecordResolvedAiProposal({
        productId: scannedProductId,
        destKey,
        normalizedValue,
        reportedSource,
        displayNote,
        allowExplicitReferenceListReplacement,
        trustedGeologyDbProvenance,
        aiKnownStudioHardwareBasis,
        requestId: pendingScan.requestId,
        targetBaseline: baselineForDest,
        existingProdProposals,
        existingProdApprovals,
        existingProdKeepOriginal,
        nextAiAlternativesForProd,
        proposalsByDestination,
        details
      });

      if (outcome.dispositionOutcome === "held_conflict") {
        heldConflictCount++;
      } else if (outcome.dispositionOutcome === "staged") {
        stagedCount++;
        if (outcome.preapprovedGeology) {
          preapprovedGeologyCount++;
        }
      }
    };

    for (const [destKey, entry] of Object.entries(combinedProducerAndVisionProposals)) {
      if (
        CANCELLED_INERT_DESTINATIONS.has(destKey) ||
        RETIRED_ERA_DESTINATIONS.has(destKey) ||
        isRetiredParkedBenchDestination(destKey)
      ) {
        continue;
      }

      const contract = getFieldContractByDestination(destKey);
      const reportedSource =
        entry &&
        typeof entry === "object" &&
        typeof entry.source === "string" &&
        entry.source.trim() !== ""
          ? entry.source.trim()
          : "Source not reported";

      // Check for the 4 producer-backed geology reference companions and active Vision standardized candidates
      const isGeologyRefCandidateShape = Boolean(
        entry &&
          typeof entry === "object" &&
          typeof entry.value !== "string" &&
          (typeof entry.candidateLabel === "string" || Array.isArray(entry.labels))
      );

      if (isGeologyRefCandidateShape) {
        const candidateLabels =
          Array.isArray(entry.labels) && entry.labels.length > 0
            ? entry.labels
                .filter((l) => typeof l === "string" && l.trim() !== "")
                .map((l) => l.trim())
            : typeof entry.candidateLabel === "string" && entry.candidateLabel.trim() !== ""
              ? [entry.candidateLabel.trim()]
              : [];

        if (candidateLabels.length === 0) {
          continue;
        }

        const displayCandidateLabel = candidateLabels.join(", ");

        if (
          isManualOnlyNoAiDestination(destKey, contract) ||
          !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
        ) {
          ignoredManualOnlyCount++;
          const manualReason =
            "Manual-only or unauthorized standardized reference field — excluded from AI candidate staging.";
          proposalsByDestination[destKey] = {
            value: displayCandidateLabel,
            source: reportedSource,
            disposition: "Ignored (manual-only field — not staged)",
            reason: manualReason
          };
          details.push(
            `[${destKey}] Ignored standardized candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${manualReason}`
          );
          continue;
        }

        if (!BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey) || !contract || !contract.isWritableInBatch1) {
          continue;
        }

        receivedCount++;

        const verifiedRefProvenance = PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(destKey)
          ? verifyTrustedGeologyDbProvenanceForProposal({
              rawProvenance: entry.trustedGeologyDbProvenance,
              productId: scannedProductId,
              requestId: pendingScan.requestId,
              destKey,
              expectedCandidateLabels: candidateLabels
            })
          : null;

        const resolution = resolveProducerBackedGeologyReferenceCandidate({
          productId: scannedProductId,
          destKey,
          candidateLabels,
          targetBaseline,
          refChoicesRecord: activeRefChoicesRecordForScan,
          isRefChoicesFreshForBaseline: isRefChoicesFreshForScannedProduct
        });

        if (resolution.status === "pending_reference_choices") {
          nextPendingGeologyRefForProd[destKey] = {
            destKey,
            candidateLabels,
            displayLabel: displayCandidateLabel,
            source: reportedSource,
            ...(verifiedRefProvenance
              ? { trustedGeologyDbProvenance: verifiedRefProvenance }
              : {}),
            requestId: pendingScan.requestId,
            sessionId: benchSessionIdRef.current,
            productId: scannedProductId,
            baselineContextSig: targetBaselineContextSig
          };
          proposalsByDestination[destKey] = {
            value: displayCandidateLabel,
            source: reportedSource,
            disposition: "Pending verified reference choices (will resolve automatically when ready)",
            reason: resolution.reason,
            ...(verifiedRefProvenance
              ? { trustedGeologyDbProvenance: verifiedRefProvenance }
              : {})
          };
          diagnosticsObj[destKey] = resolution.reason;
          details.push(
            `[${destKey}] Retained standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}) pending verified reference choices.`
          );
          continue;
        }

        if (resolution.status === "unchanged_from_baseline") {
          unchangedSkippedCount++;
          proposalsByDestination[destKey] = {
            value: resolution.serializedValue,
            source: reportedSource,
            disposition: "Matches saved value (not staged)"
          };
          details.push(
            `[${destKey}] Candidate "${displayCandidateLabel}" matches current saved reference list (${resolution.serializedValue}) — Source: ${reportedSource}; not staged.`
          );
          continue;
        }

        if (resolution.status === "resolved_valid_change") {
          const baselineWithVerifiedRef = buildBaselineWithVerifiedReferenceForDestination(
            targetBaseline,
            destKey,
            activeRefChoicesRecordForScan,
            isRefChoicesFreshForScannedProduct
          );

          stageOrHoldResolvedProposal({
            destKey,
            normalizedValue: resolution.serializedValue,
            reportedSource,
            displayNote: `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`,
            allowExplicitReferenceListReplacement: Boolean(
              resolution.allowExplicitReferenceListReplacement
            ),
            trustedGeologyDbProvenance: verifiedRefProvenance,
            baselineForDest: baselineWithVerifiedRef
          });
          continue;
        }

        rejectedInvalidCount++;
        const holdDisposition =
          resolution.status === "held_unmatched_or_ambiguous"
            ? "Held (no unique/equivalent verified reference entry match)"
            : "Held (category-ineligible or incomplete reference evidence)";
        proposalsByDestination[destKey] = {
          value: displayCandidateLabel,
          source: reportedSource,
          disposition: holdDisposition,
          reason: resolution.reason
        };
        diagnosticsObj[destKey] = resolution.reason;
        details.push(
          `[${destKey}] Held standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${resolution.reason}`
        );
        continue;
      }

      const rawValue =
        entry && typeof entry === "object" && typeof entry.value === "string"
          ? entry.value
          : "";

      if (rawValue.trim() === "") {
        continue;
      }

      // Narrow current-scan exception BEFORE generic manual-only rejection:
      // Allows ONLY verified current-scan known studio hardware stock `"18"` on
      // PRODUCT `custom.chain_cord_length_in` when baseline is confirmed blank,
      // human length state is untouched, and live hardware is compatible.
      let verifiedKnownHardwareLength = null;
      if (destKey === "custom.chain_cord_length_in") {
        const hwLengthCheck = verifyCurrentScanKnownStudioHardwareLengthProposal({
          entry,
          rawValue,
          reportedSource,
          productId: scannedProductId,
          requestId: pendingScan.requestId,
          destKey,
          contract,
          targetBaseline,
          combinedProducerAndVisionProposals,
          existingProdProposals,
          existingProdApprovals,
          existingProdKeepOriginal
        });
        if (hwLengthCheck.eligible && hwLengthCheck.basis) {
          verifiedKnownHardwareLength = hwLengthCheck;
        } else if (hwLengthCheck.holdReason) {
          diagnosticsObj["custom.chain_cord_length_in"] = hwLengthCheck.holdReason;
        }
      }

      if (!verifiedKnownHardwareLength && isManualOnlyNoAiDestination(destKey, contract)) {
        ignoredManualOnlyCount++;
        const manualReason = isManualMeasurementDestination(destKey)
          ? diagnosticsObj[destKey] ||
            "Manual measurement field — excluded from AI staging; enter physical measurement manually."
          : destKey === "native_price" || destKey === "price"
            ? "Manual single-variant price field — excluded from AI staging; enter price manually."
            : contract?.owner === "PRODUCTVARIANT"
              ? "Manual/preset variant channel field — excluded from AI staging."
              : "Manual-only field — excluded from AI staging.";
        proposalsByDestination[destKey] = {
          value: rawValue,
          source: reportedSource,
          disposition: "Ignored (manual-only field — not staged)",
          reason: manualReason
        };
        details.push(
          `[${destKey}] Ignored AI suggestion "${rawValue}" (Source: ${reportedSource}): ${manualReason}`
        );
        continue;
      }

      if (!BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)) {
        continue;
      }

      if (!contract || !contract.isWritableInBatch1) {
        continue;
      }

      receivedCount++;

      let directProposalReplacementIntent = Boolean(
        entry &&
          typeof entry === "object" &&
          entry.allowExplicitReferenceListReplacement === true &&
          typeof entry.explicitReplacementValue === "string" &&
          entry.explicitReplacementValue === rawValue
      );

      if (
        contract.namespace === "shopify" &&
        contract.expectedType === "list.metaobject_reference" &&
        targetBaseline
      ) {
        const baselineObsForDirect = buildBaselineObservation(targetBaseline, destKey);
        const storedCheckForDirect = inspectStoredReferenceListRawValue(
          baselineObsForDirect.rawValue
        );
        const proposedCheckForDirect = inspectStoredReferenceListRawValue(rawValue);
        const refEvidenceForDirect = inspectVerifiedReferenceEvidenceForDestination(
          targetBaseline,
          destKey,
          baselineObsForDirect.restrictedMetaobjectDefinitionId
        );

        const isDirectEquivalentToSaved = Boolean(
          baselineObsForDirect.presence === "present" &&
            storedCheckForDirect.valid &&
            storedCheckForDirect.gids.length > 0 &&
            proposedCheckForDirect.valid &&
            proposedCheckForDirect.gids.length > 0 &&
            refEvidenceForDirect.evidenceLoaded &&
            refEvidenceForDirect.isComplete &&
            areReferenceGidSetsSemanticallyEquivalent(
              proposedCheckForDirect.gids,
              storedCheckForDirect.gids,
              refEvidenceForDirect.entriesByGid,
              baselineObsForDirect.restrictedMetaobjectDefinitionId
            )
        );

        if (isDirectEquivalentToSaved) {
          const preservedDirectRaw =
            typeof baselineObsForDirect.rawValue === "string" &&
            baselineObsForDirect.rawValue.trim() !== ""
              ? baselineObsForDirect.rawValue.trim()
              : JSON.stringify(storedCheckForDirect.gids);
          unchangedSkippedCount++;
          proposalsByDestination[destKey] = {
            value: preservedDirectRaw,
            source: reportedSource,
            disposition: "Matches saved value (not staged)"
          };
          details.push(
            `[${destKey}] Matches current saved reference list (${preservedDirectRaw}) — Source: ${reportedSource}; not staged.`
          );
          continue;
        }

        if (
          !directProposalReplacementIntent &&
          storedCheckForDirect.valid &&
          proposedCheckForDirect.valid &&
          proposedCheckForDirect.gids.length > 0
        ) {
          const proposedSetForDirect = new Set(proposedCheckForDirect.gids);
          directProposalReplacementIntent = storedCheckForDirect.gids.some(
            (g) => !proposedSetForDirect.has(g)
          );
        }
      }

      const validation = validateBatch1ProposedValue({
        productId: scannedProductId,
        destinationKey: destKey,
        proposedValue: rawValue,
        baselineSnapshot: targetBaseline,
        allowExplicitReferenceListReplacement: directProposalReplacementIntent
      });

      if (!validation.valid) {
        rejectedInvalidCount++;
        proposalsByDestination[destKey] = {
          value: rawValue,
          source: reportedSource,
          disposition: "Rejected (invalid)",
          reason: validation.reason
        };
        diagnosticsObj[destKey] = validation.reason;
        details.push(
          `[${destKey}] Rejected invalid AI suggestion "${rawValue}" (Source: ${reportedSource}): ${validation.reason}`
        );
        continue;
      }

      if (validation.isUnchangedFromStored) {
        unchangedSkippedCount++;
        proposalsByDestination[destKey] = {
          value: validation.normalizedValue,
          source: reportedSource,
          disposition: "Matches saved value (not staged)"
        };
        details.push(
          `[${destKey}] Matches current saved value ("${validation.normalizedValue}") — Source: ${reportedSource}; not staged.`
        );
        continue;
      }

      const verifiedCustomGeoProvenance =
        !verifiedKnownHardwareLength &&
        destKey.startsWith("custom.") &&
        AUTHORITATIVE_GEOLOGY_PREAPPROVAL_DESTINATIONS.has(destKey)
          ? verifyTrustedGeologyDbProvenanceForProposal({
              rawProvenance: entry?.trustedGeologyDbProvenance,
              productId: scannedProductId,
              requestId: pendingScan.requestId,
              destKey,
              expectedEmittedValue: validation.normalizedValue
            })
          : null;

      stageOrHoldResolvedProposal({
        destKey,
        normalizedValue: validation.normalizedValue,
        reportedSource: verifiedKnownHardwareLength
          ? verifiedKnownHardwareLength.normalizedSource
          : reportedSource,
        displayNote: verifiedKnownHardwareLength
          ? `Confirmed ${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in studio stock (${verifiedKnownHardwareLength.basis.matchedHardwareOption})`
          : "",
        allowExplicitReferenceListReplacement: Boolean(
          directProposalReplacementIntent &&
            validation.allowExplicitReferenceListReplacement === true
        ),
        trustedGeologyDbProvenance: verifiedCustomGeoProvenance,
        aiKnownStudioHardwareBasis: verifiedKnownHardwareLength
          ? verifiedKnownHardwareLength.basis
          : null,
        baselineForDest: targetBaseline
      });
    }

    // Post-loop safety check: if custom.chain_cord_length_in was staged earlier in key order
    // (or alongside custom.chain_material), re-verify evaluateAiHardwareLengthSupport against
    // the finalized existingProdProposals map so any sibling change or hold is honored.
    const stagedLengthEntryAfterLoop = existingProdProposals["custom.chain_cord_length_in"];
    if (
      stagedLengthEntryAfterLoop &&
      typeof stagedLengthEntryAfterLoop === "object" &&
      stagedLengthEntryAfterLoop.origin === "AI" &&
      stagedLengthEntryAfterLoop.aiKnownStudioHardwareBasis &&
      stagedLengthEntryAfterLoop.aiKnownStudioHardwareBasis.requestId === pendingScan.requestId
    ) {
      const postLoopSupport = evaluateAiHardwareLengthSupport({
        productId: scannedProductId,
        rawLengthPropEntry: stagedLengthEntryAfterLoop,
        baselineSnapshot: targetBaseline,
        proposedMapForProduct: existingProdProposals,
        keepOriginalMapForProduct: existingProdKeepOriginal
      });
      if (!postLoopSupport.isAiHardwareDerived || !postLoopSupport.supported) {
        delete existingProdProposals["custom.chain_cord_length_in"];
        delete existingProdApprovals["custom.chain_cord_length_in"];
        stagedCount = Math.max(0, stagedCount - 1);
        rejectedInvalidCount++;
        const holdMsg =
          postLoopSupport.reason ||
          "Held AI 18 in studio length proposal: final hardware state did not support 18 in.";
        proposalsByDestination["custom.chain_cord_length_in"] = {
          value: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
          source: stagedLengthEntryAfterLoop.source || "Known Studio Hardware Stock",
          disposition: "Held (hardware basis not supported)",
          reason: holdMsg
        };
        diagnosticsObj["custom.chain_cord_length_in"] = holdMsg;
        details.push(
          `[custom.chain_cord_length_in] Held AI studio-stock length proposal: ${holdMsg}`
        );
      }
    }

    proposedByProductRef.current = {
      ...proposedByProductRef.current,
      [scannedProductId]: existingProdProposals
    };
    setProposedByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdProposals
    }));

    approvalsByProductRef.current = {
      ...approvalsByProductRef.current,
      [scannedProductId]: existingProdApprovals
    };
    setApprovalsByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdApprovals
    }));

    setAiAlternativesByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        ...(prev[scannedProductId] || {}),
        ...nextAiAlternativesForProd
      }
    }));

    const evaluatedWithRefRequestId = isRefChoicesFreshForScannedProduct
      ? currentRefChoicesRecordRef.current?.requestId || null
      : null;

    setPendingGeologyRefCandidatesByProduct((prev) => {
      const next = { ...prev };
      if (Object.keys(nextPendingGeologyRefForProd).length > 0) {
        next[scannedProductId] = {
          requestId: pendingScan.requestId,
          sessionId: benchSessionIdRef.current,
          productId: scannedProductId,
          baselineContextSig: targetBaselineContextSig,
          lastAttemptedRefRequestId: evaluatedWithRefRequestId,
          candidatesByDest: nextPendingGeologyRefForProd
        };
      } else {
        delete next[scannedProductId];
      }
      return next;
    });

    setLastAiScanReportByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        requestId: pendingScan.requestId,
        productId: scannedProductId,
        completedAt: new Date().toISOString(),
        ok: true,
        summary: formatAiScanSummaryText({
          receivedCount,
          stagedCount,
          preapprovedGeologyCount,
          heldConflictCount,
          unchangedSkippedCount,
          ignoredManualOnlyCount
        }),
        receivedCount,
        stagedCount,
        preapprovedGeologyCount,
        heldConflictCount,
        unchangedSkippedCount,
        rejectedInvalidCount,
        ignoredManualOnlyCount,
        diagnostics: diagnosticsObj,
        details,
        proposalsByDestination
      }
    }));

    releaseOwnActiveRequest();
  }, [
    aiScanFetcher.state,
    aiScanFetcher.data,
    activeProductId,
    activeProductIdRef,
    baselineByProductRef,
    currentBaselineRef,
    isCurrentRefChoicesBoundAndFreshRef,
    currentRefChoicesRecordRef,
    proposedByProductRef,
    approvalsByProductRef,
    keepOriginalByProductRef,
    benchSessionIdRef,
    setProposedByProduct,
    setApprovalsByProduct
  ]);

  const handleAcceptAiAlternative = (destinationKey) => {
    setClientPrevalidationBanner(null);
    const altEntry = currentAiAlternativesMap[destinationKey];
    if (!altEntry || typeof altEntry.value !== "string") return;

    const contract = getFieldContractByDestination(destinationKey);
    const currentBaseline = currentBaselineRef.current;

    let validAltHardwareBasis = null;
    if (
      destinationKey === "custom.chain_cord_length_in" &&
      altEntry.value === KNOWN_STUDIO_HARDWARE_LENGTH_IN &&
      altEntry.aiKnownStudioHardwareBasis &&
      typeof altEntry.aiKnownStudioHardwareBasis === "object" &&
      !Array.isArray(altEntry.aiKnownStudioHardwareBasis) &&
      altEntry.aiKnownStudioHardwareBasis.productId === activeProductId &&
      altEntry.aiKnownStudioHardwareBasis.destinationKey === "custom.chain_cord_length_in" &&
      altEntry.aiKnownStudioHardwareBasis.emittedValue === KNOWN_STUDIO_HARDWARE_LENGTH_IN &&
      currentBaseline &&
      currentBaseline.productId === activeProductId
    ) {
      const candidateAcceptEntry = {
        value: altEntry.value,
        source:
          typeof altEntry.source === "string" && altEntry.source.trim() !== ""
            ? altEntry.source.trim()
            : "Known Studio Hardware Stock",
        origin: "AI",
        aiKnownStudioHardwareBasis: altEntry.aiKnownStudioHardwareBasis
      };
      const projectedMap = {
        ...(proposedByProductRef.current?.[activeProductId] || {}),
        [destinationKey]: candidateAcceptEntry
      };
      const supportCheck = evaluateAiHardwareLengthSupport({
        productId: activeProductId,
        rawLengthPropEntry: candidateAcceptEntry,
        baselineSnapshot: currentBaseline,
        proposedMapForProduct: projectedMap,
        keepOriginalMapForProduct: keepOriginalByProductRef.current?.[activeProductId] || {}
      });
      if (supportCheck.isAiHardwareDerived && supportCheck.supported) {
        validAltHardwareBasis = altEntry.aiKnownStudioHardwareBasis;
      }
    }

    if (!validAltHardwareBasis && isManualOnlyNoAiDestination(destinationKey, contract)) {
      return;
    }

    const exactVal = altEntry.value;
    let shouldBindReplacementIntent = Boolean(
      contract?.namespace === "shopify" &&
        contract?.expectedType === "list.metaobject_reference" &&
        contract?.isWritableInBatch1 === true &&
        altEntry.allowExplicitReferenceListReplacement === true &&
        typeof altEntry.explicitReplacementValue === "string" &&
        altEntry.explicitReplacementValue === exactVal
    );

    if (
      !shouldBindReplacementIntent &&
      contract?.namespace === "shopify" &&
      contract?.expectedType === "list.metaobject_reference" &&
      contract?.isWritableInBatch1 === true &&
      currentBaseline
    ) {
      const obs = buildBaselineObservation(currentBaseline, destinationKey);
      const storedCheck = inspectStoredReferenceListRawValue(obs.rawValue);
      const proposedCheck = inspectStoredReferenceListRawValue(exactVal);
      if (storedCheck.valid && proposedCheck.valid && proposedCheck.gids.length > 0) {
        const proposedSet = new Set(proposedCheck.gids);
        shouldBindReplacementIntent = storedCheck.gids.some((g) => !proposedSet.has(g));
      }
    }

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactVal,
        source:
          typeof altEntry.source === "string" && altEntry.source.trim() !== ""
            ? altEntry.source.trim()
            : "Source not reported",
        origin: "AI",
        ...(shouldBindReplacementIntent
          ? {
              allowExplicitReferenceListReplacement: true,
              explicitReplacementValue: exactVal
            }
          : {}),
        ...(validAltHardwareBasis
          ? {
              aiKnownStudioHardwareBasis: validAltHardwareBasis
            }
          : {}),
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setAiAlternativesByProduct, activeProductId, destinationKey);
  };

  const handleDismissAiAlternative = (destinationKey) => {
    clearDecisionForDestination(setAiAlternativesByProduct, activeProductId, destinationKey);
  };

  const handleDismissAiScanReport = useCallback(() => {
    setLastAiScanReportByProduct((prev) => {
      const next = { ...prev };
      delete next[activeProductId];
      return next;
    });
  }, [activeProductId]);

  const deferredResolverContext = useMemo(
    () => ({
      pendingGeologyRefCandidatesByProduct,
      setPendingGeologyRefCandidatesByProduct,
      setAiAlternativesByProduct,
      setLastAiScanReportByProduct,
      setApprovalsByProduct
    }),
    [pendingGeologyRefCandidatesByProduct, setApprovalsByProduct]
  );

  return {
    isAiScanBusy,
    currentAiAlternativesMap,
    currentAiScanReport,
    currentScanProposalsMetaMap,
    stagedVisionCandidatesByProduct,
    stagedVisionCandidatesByProductRef,
    handleExplicitAiScanProduct,
    handleAcceptAiAlternative,
    handleDismissAiAlternative,
    handleDismissAiScanReport,
    deferredResolverContext
  };
}

// ==========================================================================
// DEFERRED GEOLOGY & VISION REFERENCE CANDIDATE RESOLUTION (WHEN REF CHOICES
// ARRIVE AFTER AI SCAN) — ONCE PER REF REQUEST PER SCAN BUNDLE, NO RESCAN,
// NO LOOPS, PREAPPROVES ONLY VERIFIED TRUSTED GEOLOGY DB COMPANIONS
// ==========================================================================
export function useBenchV2DeferredAiReferenceResolver({
  activeProductId,
  benchSessionIdRef,
  baselineByProductRef,
  proposedByProductRef,
  setProposedByProduct,
  approvalsByProductRef,
  keepOriginalByProductRef,
  isCurrentRefChoicesBoundAndFresh,
  currentRefChoicesRecord,
  currentBaseline,
  deferredResolverContext
}) {
  const pendingGeologyRefCandidatesByProduct =
    deferredResolverContext?.pendingGeologyRefCandidatesByProduct;
  const setPendingGeologyRefCandidatesByProduct =
    deferredResolverContext?.setPendingGeologyRefCandidatesByProduct;
  const setAiAlternativesByProduct =
    deferredResolverContext?.setAiAlternativesByProduct;
  const setLastAiScanReportByProduct =
    deferredResolverContext?.setLastAiScanReportByProduct;
  const setApprovalsByProduct =
    deferredResolverContext?.setApprovalsByProduct;

  const processedRefAttemptKeysRef = useRef(new Set());

  useEffect(() => {
    if (
      !pendingGeologyRefCandidatesByProduct ||
      typeof setPendingGeologyRefCandidatesByProduct !== "function" ||
      typeof setAiAlternativesByProduct !== "function" ||
      typeof setLastAiScanReportByProduct !== "function"
    ) {
      return;
    }

    const pendingBundle = pendingGeologyRefCandidatesByProduct[activeProductId];
    if (!pendingBundle || typeof pendingBundle !== "object") return;

    const bundleRequestId = pendingBundle.requestId || null;
    const bundleSessionId = pendingBundle.sessionId || null;
    const bundleProductId = pendingBundle.productId || null;
    const bundleContextSig = pendingBundle.baselineContextSig || null;

    const rawSnapForActive = baselineByProductRef.current[activeProductId] || null;
    const currentContextSig = buildStandardizedBaselineContextSignature(rawSnapForActive);

    // Discard stale pending candidates if session, product, or factual baseline changed
    if (
      bundleSessionId !== benchSessionIdRef.current ||
      bundleProductId !== activeProductId ||
      !rawSnapForActive ||
      bundleContextSig !== currentContextSig
    ) {
      setPendingGeologyRefCandidatesByProduct((prev) => {
        const currentForProd = prev[activeProductId];
        if (!currentForProd || currentForProd.requestId !== bundleRequestId) {
          return prev;
        }
        const next = { ...prev };
        delete next[activeProductId];
        return next;
      });
      return;
    }

    // Wait until reference choices are bound and fresh for the current factual baseline
    if (
      !isCurrentRefChoicesBoundAndFresh ||
      !currentRefChoicesRecord ||
      currentRefChoicesRecord.productId !== activeProductId ||
      !currentBaseline ||
      currentBaseline.productId !== activeProductId
    ) {
      return;
    }

    const currentRefReqId = currentRefChoicesRecord.requestId || null;
    if (!currentRefReqId) {
      return;
    }

    // Process each reference-choices requestId at most once per scan bundle
    const attemptDedupKey = `${bundleProductId}::${bundleRequestId}::${bundleContextSig}::${currentRefReqId}`;
    if (
      pendingBundle.lastAttemptedRefRequestId === currentRefReqId ||
      processedRefAttemptKeysRef.current.has(attemptDedupKey)
    ) {
      return;
    }
    processedRefAttemptKeysRef.current.add(attemptDedupKey);

    const candidatesMap = pendingBundle.candidatesByDest || {};
    const destEntries = Object.entries(candidatesMap);

    if (destEntries.length === 0) {
      setPendingGeologyRefCandidatesByProduct((prev) => {
        const currentForProd = prev[activeProductId];
        if (!currentForProd || currentForProd.requestId !== bundleRequestId) {
          return prev;
        }
        const next = { ...prev };
        delete next[activeProductId];
        return next;
      });
      return;
    }

    const existingProdProposals = { ...(proposedByProductRef.current[activeProductId] || {}) };
    const existingProdApprovals = { ...(approvalsByProductRef.current[activeProductId] || {}) };
    const existingProdKeepOriginal = keepOriginalByProductRef.current[activeProductId] || {};
    const nextAiAlternativesForProd = {};
    const remainingRetryableByDest = {};

    let addedStaged = 0;
    let addedPreapprovedGeology = 0;
    let addedHeld = 0;
    let addedUnchanged = 0;
    let addedRejected = 0;
    let approvalsMutated = false;
    const updatedProposalsMeta = {};
    const updatedDiagnostics = {};
    const appendedDetails = [];

    for (const [destKey, candItem] of destEntries) {
      if (
        !candItem ||
        isRetiredParkedBenchDestination(destKey, "PRODUCT") ||
        !AUTHORIZED_AI_SCAN_STANDARDIZED_REFERENCE_DESTINATIONS.has(destKey)
      ) {
        continue;
      }

      const reportedSource =
        typeof candItem.source === "string" && candItem.source.trim() !== ""
          ? candItem.source.trim()
          : PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(destKey)
            ? "Geo Library"
            : "Gemini Vision";
      const displayCandidateLabel =
        candItem.displayLabel ||
        (Array.isArray(candItem.candidateLabels) ? candItem.candidateLabels.join(", ") : "");

      const verifiedDeferredProvenance = PRODUCER_BACKED_GEOLOGY_REFERENCE_DESTINATIONS.has(
        destKey
      )
        ? verifyTrustedGeologyDbProvenanceForProposal({
            rawProvenance: candItem.trustedGeologyDbProvenance,
            productId: activeProductId,
            requestId: bundleRequestId,
            destKey,
            expectedCandidateLabels: candItem.candidateLabels
          })
        : null;

      const resolution = resolveProducerBackedGeologyReferenceCandidate({
        productId: activeProductId,
        destKey,
        candidateLabels: candItem.candidateLabels,
        targetBaseline: currentBaseline,
        refChoicesRecord: currentRefChoicesRecord,
        isRefChoicesFreshForBaseline: true
      });

      if (resolution.status === "pending_reference_choices") {
        remainingRetryableByDest[destKey] = candItem;
        updatedProposalsMeta[destKey] = {
          value: displayCandidateLabel,
          source: reportedSource,
          disposition: "Pending verified reference choices (will resolve automatically when ready)",
          reason: resolution.reason,
          ...(verifiedDeferredProvenance
            ? { trustedGeologyDbProvenance: verifiedDeferredProvenance }
            : {})
        };
        updatedDiagnostics[destKey] = resolution.reason;
        continue;
      }

      if (resolution.status === "unchanged_from_baseline") {
        addedUnchanged++;
        updatedProposalsMeta[destKey] = {
          value: resolution.serializedValue,
          source: reportedSource,
          disposition: "Matches saved value (not staged)"
        };
        updatedDiagnostics[destKey] = null;
        appendedDetails.push(
          `[${destKey}] Candidate "${displayCandidateLabel}" matches current saved reference list (${resolution.serializedValue}) — Source: ${reportedSource}; not staged.`
        );
        continue;
      }

      if (resolution.status === "resolved_valid_change") {
        const displayNote = `Candidate "${displayCandidateLabel}" -> ${resolution.matchedSummary}`;
        updatedDiagnostics[destKey] = null;

        const baselineWithVerifiedRef = buildBaselineWithVerifiedReferenceForDestination(
          currentBaseline,
          destKey,
          currentRefChoicesRecord,
          true
        );

        const outcome = evaluateAndRecordResolvedAiProposal({
          productId: activeProductId,
          destKey,
          normalizedValue: resolution.serializedValue,
          reportedSource,
          displayNote,
          allowExplicitReferenceListReplacement: Boolean(
            resolution.allowExplicitReferenceListReplacement
          ),
          trustedGeologyDbProvenance: verifiedDeferredProvenance,
          requestId: bundleRequestId,
          targetBaseline: baselineWithVerifiedRef,
          existingProdProposals,
          existingProdApprovals,
          existingProdKeepOriginal,
          nextAiAlternativesForProd,
          proposalsByDestination: updatedProposalsMeta,
          details: appendedDetails
        });

        if (outcome.dispositionOutcome === "held_conflict") {
          addedHeld++;
        } else if (outcome.dispositionOutcome === "staged") {
          addedStaged++;
          if (outcome.preapprovedGeology) {
            addedPreapprovedGeology++;
            approvalsMutated = true;
          } else if (outcome.approvalCleared) {
            approvalsMutated = true;
          }
        }
        continue;
      }

      addedRejected++;
      const holdDisposition =
        resolution.status === "held_unmatched_or_ambiguous"
          ? "Held (no unique/equivalent verified reference entry match)"
          : "Held (category-ineligible or incomplete reference evidence)";
      updatedProposalsMeta[destKey] = {
        value: displayCandidateLabel,
        source: reportedSource,
        disposition: holdDisposition,
        reason: resolution.reason
      };
      updatedDiagnostics[destKey] = resolution.reason;
      appendedDetails.push(
        `[${destKey}] Held standardized reference candidate "${displayCandidateLabel}" (Source: ${reportedSource}): ${resolution.reason}`
      );
    }

    // Update or clear the pending bundle scoped to the exact scan requestId/session/product/context
    setPendingGeologyRefCandidatesByProduct((prev) => {
      const currentForProd = prev[activeProductId];
      if (
        !currentForProd ||
        currentForProd.requestId !== bundleRequestId ||
        currentForProd.sessionId !== bundleSessionId ||
        currentForProd.productId !== bundleProductId ||
        currentForProd.baselineContextSig !== bundleContextSig
      ) {
        return prev;
      }
      const next = { ...prev };
      if (Object.keys(remainingRetryableByDest).length > 0) {
        next[activeProductId] = {
          ...currentForProd,
          lastAttemptedRefRequestId: currentRefReqId,
          candidatesByDest: remainingRetryableByDest
        };
      } else {
        delete next[activeProductId];
      }
      return next;
    });

    if (addedStaged > 0) {
      proposedByProductRef.current = {
        ...proposedByProductRef.current,
        [activeProductId]: existingProdProposals
      };
      setProposedByProduct((prev) => ({
        ...prev,
        [activeProductId]: existingProdProposals
      }));
    }

    if (approvalsMutated && typeof setApprovalsByProduct === "function") {
      approvalsByProductRef.current = {
        ...approvalsByProductRef.current,
        [activeProductId]: existingProdApprovals
      };
      setApprovalsByProduct((prev) => ({
        ...prev,
        [activeProductId]: existingProdApprovals
      }));
    }

    if (Object.keys(nextAiAlternativesForProd).length > 0) {
      setAiAlternativesByProduct((prev) => ({
        ...prev,
        [activeProductId]: {
          ...(prev[activeProductId] || {}),
          ...nextAiAlternativesForProd
        }
      }));
    }

    const hasReportChanges =
      addedStaged > 0 ||
      addedPreapprovedGeology > 0 ||
      addedHeld > 0 ||
      addedUnchanged > 0 ||
      addedRejected > 0 ||
      appendedDetails.length > 0 ||
      Object.keys(updatedProposalsMeta).length > 0 ||
      Object.keys(updatedDiagnostics).length > 0;

    if (hasReportChanges) {
      setLastAiScanReportByProduct((prev) => {
        const existingReport = prev[activeProductId];
        if (
          !existingReport ||
          existingReport.requestId !== bundleRequestId ||
          existingReport.productId !== bundleProductId
        ) {
          return prev;
        }
        const nextDiagnostics = { ...(existingReport.diagnostics || {}) };
        for (const [dKey, dReason] of Object.entries(updatedDiagnostics)) {
          if (dReason === null) {
            delete nextDiagnostics[dKey];
          } else if (typeof dReason === "string" && dReason.trim() !== "") {
            nextDiagnostics[dKey] = dReason;
          }
        }

        const nextStagedCount = (existingReport.stagedCount || 0) + addedStaged;
        const nextPreapprovedGeologyCount =
          (existingReport.preapprovedGeologyCount || 0) + addedPreapprovedGeology;
        const nextHeldCount = (existingReport.heldConflictCount || 0) + addedHeld;
        const nextUnchangedCount =
          (existingReport.unchangedSkippedCount || 0) + addedUnchanged;
        const nextRejectedCount =
          (existingReport.rejectedInvalidCount || 0) + addedRejected;
        const recCount = existingReport.receivedCount || 0;
        const ignCount = existingReport.ignoredManualOnlyCount || 0;

        return {
          ...prev,
          [activeProductId]: {
            ...existingReport,
            stagedCount: nextStagedCount,
            preapprovedGeologyCount: nextPreapprovedGeologyCount,
            heldConflictCount: nextHeldCount,
            unchangedSkippedCount: nextUnchangedCount,
            rejectedInvalidCount: nextRejectedCount,
            summary: formatAiScanSummaryText({
              receivedCount: recCount,
              stagedCount: nextStagedCount,
              preapprovedGeologyCount: nextPreapprovedGeologyCount,
              heldConflictCount: nextHeldCount,
              unchangedSkippedCount: nextUnchangedCount,
              ignoredManualOnlyCount: ignCount
            }),
            diagnostics: nextDiagnostics,
            details: [...(existingReport.details || []), ...appendedDetails],
            proposalsByDestination: {
              ...(existingReport.proposalsByDestination || {}),
              ...updatedProposalsMeta
            }
          }
        };
      });
    }
  }, [
    pendingGeologyRefCandidatesByProduct,
    setPendingGeologyRefCandidatesByProduct,
    setAiAlternativesByProduct,
    setLastAiScanReportByProduct,
    setApprovalsByProduct,
    activeProductId,
    benchSessionIdRef,
    baselineByProductRef,
    proposedByProductRef,
    setProposedByProduct,
    approvalsByProductRef,
    keepOriginalByProductRef,
    isCurrentRefChoicesBoundAndFresh,
    currentRefChoicesRecord,
    currentBaseline
  ]);
}
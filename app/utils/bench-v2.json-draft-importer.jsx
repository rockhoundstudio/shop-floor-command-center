// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 JSON DRAFT PACKET IMPORTER (CLIENT MODULE)
// File: app/utils/bench-v2.json-draft-importer.jsx
//
// Extracted from app/routes/app.bench-v2.jsx (File 1 of 2 for JSON importer
// module extraction). Contains shared retirement/proposal helpers, packet
// key/bound allowlists, atomic JSON draft packet validation & unapproved
// draft staging, replay protection, and FileReader lifecycle guards.
// ==========================================================================

import { useState, useEffect, useRef, useCallback } from "react";
import {
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES,
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  isExactProductVariantGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  inspectVerifiedReferenceEvidenceForDestination,
  validateBatch1ProposedValue,
  isExactValueApprovalValid,
  isKeepOriginalRecordValid
} from "./bench-v2.contract.jsx";
import {
  buildStandardizedBaselineContextSignature
} from "./bench-v2.reference-loader.jsx";
import {
  BENCH_V2_JSON_DRAFT_PACKET_SCHEMA,
  BENCH_V2_JSON_DRAFT_MAX_BYTES
} from "./bench-v2.header-banners-view.jsx";

export const RETIRED_ERA_DESTINATIONS = Object.freeze(
  new Set([
    "geological_era",
    "geological-era",
    "custom.geological_era",
    "custom.geological-era",
    "shopify.geological-era",
    "shopify.geological_era"
  ])
);

export function isRetiredParkedBenchDestination(rawDestKey, explicitOwner = null) {
  if (typeof rawDestKey !== "string" || !rawDestKey.trim()) return false;
  const trimmed = rawDestKey.trim();
  const normalizedOwner =
    typeof explicitOwner === "string" && explicitOwner.trim() !== ""
      ? explicitOwner.trim()
      : null;

  if (
    REMOVED_PARKED_DESTINATIONS.has(trimmed) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${trimmed}`) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCTVARIANT:${trimmed}`) ||
    (normalizedOwner && REMOVED_PARKED_CANONICAL_IDENTITIES.has(`${normalizedOwner}:${trimmed}`))
  ) {
    return true;
  }

  if (!trimmed.includes(".") && REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(trimmed)) {
    return true;
  }

  if (REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(trimmed)) {
    return true;
  }

  return false;
}

const ALLOWED_TOP_LEVEL_JSON_PACKET_KEYS = Object.freeze(
  new Set([
    "schema",
    "contractVersion",
    "packetId",
    "productId",
    "benchSessionId",
    "variantId",
    "productCategoryId",
    "entries",
    "expectedBlocks"
  ])
);

const ALLOWED_JSON_PACKET_ENTRY_KEYS = Object.freeze(
  new Set([
    "destinationKey",
    "owner",
    "proposedValue",
    "source",
    "expectedPresence",
    "expectedRawValue"
  ])
);

const ALLOWED_JSON_PACKET_EXPECTED_BLOCK_KEYS = Object.freeze(
  new Set([
    "destinationKey",
    "expectedCategory"
  ])
);

const ALLOWED_EXPECTED_PRESENCE_VALUES = Object.freeze(
  new Set(["absent", "null", "empty_string", "present"])
);

const ALLOWED_EXPECTED_BLOCK_CATEGORIES = Object.freeze(
  new Set(["read_only_or_parked", "category_ineligible", "held_contract"])
);

const MAX_JSON_PACKET_ENTRIES = BENCH_V2_FIELD_CONTRACTS.length;
const MAX_JSON_PACKET_EXPECTED_BLOCKS = BENCH_V2_FIELD_CONTRACTS.length;

export function measureUtf8Bytes(str) {
  if (typeof str !== "string") return 0;
  try {
    if (typeof TextEncoder === "function") {
      return new TextEncoder().encode(str).length;
    }
  } catch {
    // Fallback below
  }
  return str.length;
}

export function getProposalValueString(rawEntry) {
  return rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
    ? rawEntry.value
    : typeof rawEntry === "string"
      ? rawEntry
      : "";
}

export function hasExplicitReferenceReplacementFlag(rawEntry, destinationKey, exactProposedValue) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract || contract.namespace !== "shopify") return false;
  return Boolean(
    rawEntry &&
      typeof rawEntry === "object" &&
      rawEntry.origin === "Manual" &&
      rawEntry.allowExplicitReferenceListReplacement === true &&
      typeof rawEntry.explicitReplacementValue === "string" &&
      rawEntry.explicitReplacementValue === exactProposedValue
  );
}

export function useBenchV2JsonDraftImporter({
  activeProductId,
  activeProductIdRef: externalActiveProductIdRef = null,
  benchSessionIdRef,
  baselineByProductRef,
  rawCurrentBaselineRef,
  currentBaselineRef,
  isCurrentRefChoicesBoundAndFreshRef,
  isSwitchingSelectedProductRef,
  isAnyOperationBusyRef,
  proposedByProductRef,
  setProposedByProduct,
  approvalsByProductRef,
  keepOriginalByProductRef,
  setClientPrevalidationBanner
}) {
  const [isJsonImportPanelOpen, setIsJsonImportPanelOpen] = useState(false);
  const [jsonImportPasteText, setJsonImportPasteText] = useState("");
  const [isJsonImportBusy, setIsJsonImportBusy] = useState(false);
  const [lastJsonImportReportByProduct, setLastJsonImportReportByProduct] = useState({});
  const importedPacketIdsByProductRef = useRef(new Map());
  const activeJsonFileReadIdRef = useRef(null);
  const isJsonImportBusyRef = useRef(false);
  const isMountedRef = useRef(true);

  const internalActiveProductIdRef = useRef(activeProductId);
  internalActiveProductIdRef.current = activeProductId;
  const activeProductIdRef = externalActiveProductIdRef || internalActiveProductIdRef;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeJsonFileReadIdRef.current = null;
      isJsonImportBusyRef.current = false;
    };
  }, []);

  const currentJsonImportReport = lastJsonImportReportByProduct[activeProductId] || null;

  // ==========================================================================
  // ATOMIC JSON DRAFT PACKET VALIDATOR & UNAPPROVED DRAFT STAGER
  // ==========================================================================
  const validateAndApplyBenchV2JsonDraftPacket = useCallback(
    ({
      rawJsonText,
      sourceName = "Pasted JSON",
      expectedProductIdAtStart = null,
      expectedSessionIdAtStart = null,
      expectedContextSigAtStart = null
    }) => {
      if (typeof setClientPrevalidationBanner === "function") {
        setClientPrevalidationBanner(null);
      }

      const liveProductId = activeProductIdRef.current;
      const liveSessionId = benchSessionIdRef.current;
      const liveRawBaseline =
        baselineByProductRef.current[liveProductId] || rawCurrentBaselineRef.current || null;
      const liveMergedBaseline = currentBaselineRef.current;
      const liveIsRefChoicesFresh = Boolean(isCurrentRefChoicesBoundAndFreshRef.current);
      const liveContextSig = buildStandardizedBaselineContextSignature(liveRawBaseline);

      const recordRejectedImport = (summary, rejectionReasons = [], packetId = null) => {
        const targetReportProductId =
          isExactProductGid(liveProductId) ? liveProductId : activeProductId;
        setLastJsonImportReportByProduct((prev) => ({
          ...prev,
          [targetReportProductId]: {
            ok: false,
            packetId: typeof packetId === "string" && packetId.trim() !== "" ? packetId.trim() : null,
            productId: targetReportProductId,
            sourceName,
            completedAt: new Date().toISOString(),
            stagedCount: 0,
            summary,
            rejectionReasons:
              Array.isArray(rejectionReasons) && rejectionReasons.length > 0
                ? rejectionReasons
                : [summary],
            stagedDetails: [],
            confirmedExpectedBlocks: []
          }
        }));
        return false;
      };

      if (
        isAnyOperationBusyRef.current ||
        isSwitchingSelectedProductRef.current
      ) {
        return recordRejectedImport(
          "Rejected JSON draft import: another operation or product switch is currently in progress.",
          [
            "Wait for Save, AI Scan, Reference Choices, or Product Reload to finish before importing a JSON draft packet."
          ]
        );
      }

      if (
        (expectedProductIdAtStart && expectedProductIdAtStart !== liveProductId) ||
        (expectedSessionIdAtStart && expectedSessionIdAtStart !== liveSessionId) ||
        (expectedContextSigAtStart && expectedContextSigAtStart !== liveContextSig)
      ) {
        return recordRejectedImport(
          "Aborted JSON draft import because the active product, bench session, or factual baseline changed while reading the file.",
          [
            "Live state recheck after file read detected a product, session, or baseline change; 0 drafts were staged."
          ]
        );
      }

      if (typeof rawJsonText !== "string" || rawJsonText.trim() === "") {
        return recordRejectedImport(
          "Rejected JSON draft import: packet text is empty.",
          ["Provide a non-empty bench_v2_json_draft_packet_v1 JSON object."]
        );
      }

      const byteLength = measureUtf8Bytes(rawJsonText);
      if (byteLength > BENCH_V2_JSON_DRAFT_MAX_BYTES) {
        return recordRejectedImport(
          `Rejected JSON draft import: payload size (${byteLength} bytes) exceeds the ${BENCH_V2_JSON_DRAFT_MAX_BYTES}-byte (256 KB) maximum before parsing.`,
          [
            `JSON payload is ${byteLength} bytes; maximum allowed size is ${BENCH_V2_JSON_DRAFT_MAX_BYTES} bytes.`
          ]
        );
      }

      let parsedPacket;
      try {
        parsedPacket = JSON.parse(rawJsonText);
      } catch (parseErr) {
        return recordRejectedImport(
          `Rejected JSON draft import: malformed JSON syntax (${parseErr.message}).`,
          [`JSON.parse failed: ${parseErr.message}`]
        );
      }

      if (!parsedPacket || typeof parsedPacket !== "object" || Array.isArray(parsedPacket)) {
        return recordRejectedImport(
          "Rejected JSON draft import: top-level payload must be a JSON object.",
          ["Top-level JSON value must be a plain object."]
        );
      }

      const rawPacketId =
        typeof parsedPacket.packetId === "string" ? parsedPacket.packetId.trim() : "";

      const rejectionReasons = [];

      for (const topKey of Object.keys(parsedPacket)) {
        if (!ALLOWED_TOP_LEVEL_JSON_PACKET_KEYS.has(topKey)) {
          rejectionReasons.push(
            `Unknown top-level key "${topKey}" in JSON draft packet.`
          );
        }
      }

      if (parsedPacket.schema !== BENCH_V2_JSON_DRAFT_PACKET_SCHEMA) {
        rejectionReasons.push(
          `Invalid packet schema "${String(parsedPacket.schema ?? "")}"; expected "${BENCH_V2_JSON_DRAFT_PACKET_SCHEMA}".`
        );
      }

      if (parsedPacket.contractVersion !== BENCH_V2_CONTRACT_VERSION) {
        rejectionReasons.push(
          `Invalid contractVersion "${String(parsedPacket.contractVersion ?? "")}"; expected "${BENCH_V2_CONTRACT_VERSION}".`
        );
      }

      if (!rawPacketId || parsedPacket.packetId !== rawPacketId) {
        rejectionReasons.push(
          "Missing, blank, or untrimmed packetId; every JSON draft packet requires a non-empty trimmed packetId string."
        );
      }

      if (
        typeof parsedPacket.productId !== "string" ||
        !isExactProductGid(parsedPacket.productId)
      ) {
        rejectionReasons.push(
          `Invalid packet productId "${String(parsedPacket.productId ?? "")}"; exact Shopify Product GID is required.`
        );
      } else if (parsedPacket.productId !== liveProductId) {
        rejectionReasons.push(
          `Wrong product: packet targets ${parsedPacket.productId}, but the active product on the bench is ${liveProductId}.`
        );
      }

      if (
        parsedPacket.benchSessionId !== undefined &&
        parsedPacket.benchSessionId !== null
      ) {
        if (
          typeof parsedPacket.benchSessionId !== "string" ||
          parsedPacket.benchSessionId.trim() === "" ||
          parsedPacket.benchSessionId !== liveSessionId
        ) {
          rejectionReasons.push(
            `Mismatched benchSessionId: packet specifies "${String(parsedPacket.benchSessionId)}", but current session is "${liveSessionId}".`
          );
        }
      }

      if (!liveMergedBaseline || liveMergedBaseline.productId !== liveProductId) {
        rejectionReasons.push(
          `Product baseline is not loaded for ${liveProductId}; reload product data before importing JSON drafts.`
        );
      } else if (
        liveMergedBaseline.metafieldsReadComplete !== true ||
        liveMergedBaseline.defsReadComplete !== true
      ) {
        rejectionReasons.push(
          "Product metafields or live PRODUCT definitions read is incomplete; click Reload Product before importing JSON drafts."
        );
      }

      const appliedSetForProduct =
        importedPacketIdsByProductRef.current.get(liveProductId) || new Set();
      if (rawPacketId && appliedSetForProduct.has(rawPacketId)) {
        rejectionReasons.push(
          `Duplicate packet replay rejected: packetId "${rawPacketId}" has already been imported for product ${liveProductId}.`
        );
      }

      if (!Array.isArray(parsedPacket.entries) || parsedPacket.entries.length === 0) {
        rejectionReasons.push(
          "Packet entries must be a non-empty array of writable field proposals."
        );
      } else if (parsedPacket.entries.length > MAX_JSON_PACKET_ENTRIES) {
        rejectionReasons.push(
          `Packet entries length (${parsedPacket.entries.length}) exceeds maximum bound (${MAX_JSON_PACKET_ENTRIES}).`
        );
      }

      const rawExpectedBlocks =
        parsedPacket.expectedBlocks === undefined ? [] : parsedPacket.expectedBlocks;
      if (!Array.isArray(rawExpectedBlocks)) {
        rejectionReasons.push(
          "Packet expectedBlocks must be an array when provided."
        );
      } else if (rawExpectedBlocks.length > MAX_JSON_PACKET_EXPECTED_BLOCKS) {
        rejectionReasons.push(
          `Packet expectedBlocks length (${rawExpectedBlocks.length}) exceeds maximum bound (${MAX_JSON_PACKET_EXPECTED_BLOCKS}).`
        );
      }

      if (rejectionReasons.length > 0) {
        return recordRejectedImport(
          `JSON draft packet rejected (${rejectionReasons.length} envelope/precondition issue${
            rejectionReasons.length === 1 ? "" : "s"
          }) — 0 drafts staged.`,
          rejectionReasons,
          rawPacketId
        );
      }

      const seenEntryDestinations = new Set();
      const seenExpectedBlockDestinations = new Set();
      let hasVariantEntry = false;
      let hasVariantMetafieldEntry = false;
      let hasShopifyReferenceEntry = false;

      const liveProposedMap = proposedByProductRef.current[liveProductId] || {};
      const liveApprovalsMap = approvalsByProductRef.current[liveProductId] || {};
      const liveKeepOriginalMap = keepOriginalByProductRef.current[liveProductId] || {};

      const validatedEntriesToStage = [];
      const confirmedExpectedBlocks = [];

      for (let i = 0; i < parsedPacket.entries.length; i++) {
        const entry = parsedPacket.entries[i];
        const entryPrefix = `entries[${i}]`;

        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          rejectionReasons.push(`${entryPrefix}: Entry must be a plain object.`);
          continue;
        }

        for (const eKey of Object.keys(entry)) {
          if (!ALLOWED_JSON_PACKET_ENTRY_KEYS.has(eKey)) {
            rejectionReasons.push(
              `${entryPrefix}: Unknown property "${eKey}".`
            );
          }
        }

        const destKey =
          typeof entry.destinationKey === "string" ? entry.destinationKey.trim() : "";
        if (!destKey || entry.destinationKey !== destKey) {
          rejectionReasons.push(
            `${entryPrefix}: Missing or untrimmed destinationKey.`
          );
          continue;
        }

        if (CANCELLED_INERT_DESTINATIONS.has(destKey)) {
          rejectionReasons.push(
            `[${destKey}] Cancelled destination cannot be imported or staged.`
          );
          continue;
        }

        if (RETIRED_ERA_DESTINATIONS.has(destKey)) {
          rejectionReasons.push(
            `[${destKey}] Retired Geological Era destination is removed from Bench V2 and cannot be imported.`
          );
          continue;
        }

        if (isRetiredParkedBenchDestination(destKey, entry.owner)) {
          rejectionReasons.push(
            `[${destKey}] Retired parked destination is removed from Bench V2 and cannot be imported or staged.`
          );
          continue;
        }

        if (seenEntryDestinations.has(destKey)) {
          rejectionReasons.push(
            `[${destKey}] Duplicate destinationKey in packet entries.`
          );
          continue;
        }
        seenEntryDestinations.add(destKey);

        const contract = getFieldContractByDestination(destKey);
        if (!contract) {
          rejectionReasons.push(
            `[${destKey}] Unknown or non-active destinationKey in Bench V2 registry.`
          );
          continue;
        }

        if (
          !contract.isWritableInBatch1 ||
          !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(contract.destinationKey)
        ) {
          rejectionReasons.push(
            `[${destKey}] Destination is not writable in Batch 1 (${contract.writeCapability}); move read-only or parked fields to expectedBlocks.`
          );
          continue;
        }

        if (typeof entry.owner !== "string" || entry.owner !== contract.owner) {
          rejectionReasons.push(
            `[${destKey}] Owner mismatch: entry specifies "${String(entry.owner ?? "")}", but contract owner is "${contract.owner}".`
          );
          continue;
        }

        if (contract.owner === "PRODUCTVARIANT") {
          hasVariantEntry = true;
          if (contract.namespace !== "native") {
            hasVariantMetafieldEntry = true;
          }
        }

        if (contract.namespace === "shopify") {
          hasShopifyReferenceEntry = true;
        }

        if (typeof entry.proposedValue !== "string") {
          rejectionReasons.push(
            `[${destKey}] proposedValue must be a string (no implicit coercion).`
          );
          continue;
        }

        if (
          typeof entry.expectedPresence !== "string" ||
          !ALLOWED_EXPECTED_PRESENCE_VALUES.has(entry.expectedPresence)
        ) {
          rejectionReasons.push(
            `[${destKey}] Invalid or missing expectedPresence "${String(entry.expectedPresence ?? "")}"; must be one of: absent, null, empty_string, present.`
          );
          continue;
        }

        if (entry.expectedPresence === "present") {
          if (typeof entry.expectedRawValue !== "string") {
            rejectionReasons.push(
              `[${destKey}] expectedRawValue (string) is required when expectedPresence === "present".`
            );
            continue;
          }
        } else if (
          entry.expectedRawValue !== undefined &&
          entry.expectedRawValue !== null
        ) {
          rejectionReasons.push(
            `[${destKey}] expectedRawValue must be omitted or null when expectedPresence is "${entry.expectedPresence}".`
          );
          continue;
        }

        if (entry.source !== undefined && entry.source !== null) {
          if (typeof entry.source !== "string" || entry.source.trim() === "") {
            rejectionReasons.push(
              `[${destKey}] Optional source must be a non-empty string when provided.`
            );
            continue;
          }
        }

        const obs = buildBaselineObservation(liveMergedBaseline, destKey);
        if (!obs.evidenceAvailable) {
          rejectionReasons.push(
            `[${destKey}] Live baseline observation is not available (${obs.presence}).`
          );
          continue;
        }

        if (obs.presence !== entry.expectedPresence) {
          rejectionReasons.push(
            `[${destKey}] Stale baseline precondition: packet expected presence "${entry.expectedPresence}", but live baseline presence is "${obs.presence}".`
          );
          continue;
        }

        if (
          entry.expectedPresence === "present" &&
          obs.rawValue !== entry.expectedRawValue
        ) {
          rejectionReasons.push(
            `[${destKey}] Stale baseline precondition: packet expectedRawValue "${entry.expectedRawValue}" does not match live stored rawValue "${String(obs.rawValue ?? "")}".`
          );
          continue;
        }

        // Protect existing human drafts, exact approvals, and Keep Original decisions
        const existingDraftEntry = liveProposedMap[destKey];
        const existingDraftVal = getProposalValueString(existingDraftEntry);
        const hasExistingDraft = Boolean(
          existingDraftEntry !== undefined && existingDraftVal.trim() !== ""
        );
        const existingAllowReplacement = hasExplicitReferenceReplacementFlag(
          existingDraftEntry,
          destKey,
          existingDraftVal
        );
        const existingApprovalRec = liveApprovalsMap[destKey] || null;
        const hasValidExistingApproval =
          hasExistingDraft &&
          isExactValueApprovalValid({
            approvalRecord: existingApprovalRec,
            productId: liveProductId,
            destinationKey: destKey,
            currentProposedValue: existingDraftVal,
            baselineSnapshot: liveMergedBaseline,
            allowExplicitReferenceListReplacement: existingAllowReplacement
          });
        const existingKeepOrigRec = liveKeepOriginalMap[destKey] || null;
        const hasValidExistingKeepOriginal =
          hasExistingDraft &&
          isKeepOriginalRecordValid({
            keepOriginalRecord: existingKeepOrigRec,
            productId: liveProductId,
            destinationKey: destKey,
            currentProposedValue: existingDraftVal,
            baselineSnapshot: liveMergedBaseline
          });

        if (hasValidExistingKeepOriginal) {
          rejectionReasons.push(
            `[${destKey}] Protected operator decision: destination is currently marked Keep Original.`
          );
          continue;
        }

        if (hasValidExistingApproval) {
          rejectionReasons.push(
            `[${destKey}] Protected operator decision: destination already has a valid Exact-Value Approval.`
          );
          continue;
        }

        if (hasExistingDraft && existingDraftVal !== entry.proposedValue) {
          rejectionReasons.push(
            `[${destKey}] Protected draft conflict: destination already has a staged draft ("${existingDraftVal}") that differs from packet proposedValue ("${entry.proposedValue}"). Clear or resolve the existing draft first.`
          );
          continue;
        }

        const fidelity = checkExistingWriterStringFidelity(entry.proposedValue);
        if (!fidelity.faithful) {
          rejectionReasons.push(`[${destKey}] ${fidelity.reason}`);
          continue;
        }

        const validation = validateBatch1ProposedValue({
          productId: liveProductId,
          destinationKey: destKey,
          proposedValue: entry.proposedValue,
          baselineSnapshot: liveMergedBaseline
        });

        if (!validation.valid) {
          rejectionReasons.push(`[${destKey}] ${validation.reason}`);
          continue;
        }

        if (validation.isUnchangedFromStored) {
          rejectionReasons.push(
            `[${destKey}] Unchanged value rejected: proposedValue ("${validation.normalizedValue}") is identical to the stored baseline value and cannot be staged as a write test.`
          );
          continue;
        }

        validatedEntriesToStage.push({
          destinationKey: destKey,
          owner: contract.owner,
          normalizedValue: validation.normalizedValue,
          verifiedActualType: validation.verifiedActualType,
          baselinePresence: obs.presence,
          baselineRawValue: obs.rawValue
        });
      }

      if (hasVariantEntry) {
        if (
          liveMergedBaseline.variantsReadComplete !== true ||
          liveMergedBaseline.variantTargetStatus !== "single_variant_verified" ||
          !isExactProductVariantGid(liveMergedBaseline.primaryVariantId)
        ) {
          rejectionReasons.push(
            `Packet includes PRODUCTVARIANT entries, but single-variant target is not verified on ${liveProductId} (status: ${liveMergedBaseline.variantTargetStatus || "unknown"}).`
          );
        } else if (
          typeof parsedPacket.variantId !== "string" ||
          parsedPacket.variantId !== liveMergedBaseline.primaryVariantId
        ) {
          rejectionReasons.push(
            `Packet variantId "${String(parsedPacket.variantId ?? "")}" does not match the product's verified single-variant GID "${liveMergedBaseline.primaryVariantId}".`
          );
        }

        if (
          hasVariantMetafieldEntry &&
          (liveMergedBaseline.variantMetafieldsReadComplete !== true ||
            liveMergedBaseline.variantDefsReadComplete !== true)
        ) {
          rejectionReasons.push(
            "Packet includes PRODUCTVARIANT metafield entries, but variant metafields or live PRODUCTVARIANT definitions read is incomplete."
          );
        }
      } else if (
        parsedPacket.variantId !== undefined &&
        parsedPacket.variantId !== null
      ) {
        if (
          typeof parsedPacket.variantId !== "string" ||
          !isExactProductVariantGid(parsedPacket.variantId) ||
          (liveMergedBaseline.primaryVariantId &&
            parsedPacket.variantId !== liveMergedBaseline.primaryVariantId)
        ) {
          rejectionReasons.push(
            `Packet variantId "${String(parsedPacket.variantId)}" does not match the product's verified single-variant GID "${String(liveMergedBaseline.primaryVariantId ?? "none")}".`
          );
        }
      }

      const liveCategoryId = liveMergedBaseline.productCategory?.id || null;
      if (hasShopifyReferenceEntry) {
        if (liveMergedBaseline.productCategoryReadComplete !== true) {
          rejectionReasons.push(
            "Packet includes shopify.* standardized reference entries, but product category read is incomplete."
          );
        }
        if (!liveIsRefChoicesFresh) {
          rejectionReasons.push(
            "Packet includes shopify.* standardized reference entries, but verified reference choices are not loaded and fresh for the current baseline."
          );
        }
        const packetCatId =
          parsedPacket.productCategoryId === undefined
            ? undefined
            : parsedPacket.productCategoryId;
        if (packetCatId === undefined || packetCatId !== liveCategoryId) {
          rejectionReasons.push(
            `Packet productCategoryId (${String(packetCatId ?? "omitted")}) does not match the product's live taxonomy category ID (${String(liveCategoryId ?? "null")}).`
          );
        }
      } else if (parsedPacket.productCategoryId !== undefined) {
        if ((parsedPacket.productCategoryId || null) !== liveCategoryId) {
          rejectionReasons.push(
            `Packet productCategoryId (${String(parsedPacket.productCategoryId)}) does not match the product's live taxonomy category ID (${String(liveCategoryId ?? "null")}).`
          );
        }
      }

      for (let j = 0; j < rawExpectedBlocks.length; j++) {
        const blk = rawExpectedBlocks[j];
        const blkPrefix = `expectedBlocks[${j}]`;

        if (!blk || typeof blk !== "object" || Array.isArray(blk)) {
          rejectionReasons.push(`${blkPrefix}: Item must be a plain object.`);
          continue;
        }

        for (const bKey of Object.keys(blk)) {
          if (!ALLOWED_JSON_PACKET_EXPECTED_BLOCK_KEYS.has(bKey)) {
            rejectionReasons.push(
              `${blkPrefix}: Unknown property "${bKey}".`
            );
          }
        }

        const blkDestKey =
          typeof blk.destinationKey === "string" ? blk.destinationKey.trim() : "";
        if (!blkDestKey || blk.destinationKey !== blkDestKey) {
          rejectionReasons.push(
            `${blkPrefix}: Missing or untrimmed destinationKey.`
          );
          continue;
        }

        if (CANCELLED_INERT_DESTINATIONS.has(blkDestKey)) {
          rejectionReasons.push(
            `[${blkDestKey}] Cancelled destination cannot be listed in expectedBlocks.`
          );
          continue;
        }

        if (RETIRED_ERA_DESTINATIONS.has(blkDestKey)) {
          rejectionReasons.push(
            `[${blkDestKey}] Retired Geological Era destination is removed from Bench V2 and cannot be listed in expectedBlocks.`
          );
          continue;
        }

        if (isRetiredParkedBenchDestination(blkDestKey)) {
          rejectionReasons.push(
            `[${blkDestKey}] Retired parked destination is removed from Bench V2 and cannot be listed in expectedBlocks.`
          );
          continue;
        }

        if (seenEntryDestinations.has(blkDestKey)) {
          rejectionReasons.push(
            `[${blkDestKey}] Destination cannot appear in both entries and expectedBlocks.`
          );
          continue;
        }

        if (seenExpectedBlockDestinations.has(blkDestKey)) {
          rejectionReasons.push(
            `[${blkDestKey}] Duplicate destinationKey in expectedBlocks.`
          );
          continue;
        }
        seenExpectedBlockDestinations.add(blkDestKey);

        if (
          typeof blk.expectedCategory !== "string" ||
          !ALLOWED_EXPECTED_BLOCK_CATEGORIES.has(blk.expectedCategory)
        ) {
          rejectionReasons.push(
            `[${blkDestKey}] Invalid expectedCategory "${String(blk.expectedCategory ?? "")}"; must be read_only_or_parked, category_ineligible, or held_contract.`
          );
          continue;
        }

        const blkContract = getFieldContractByDestination(blkDestKey);
        if (!blkContract) {
          rejectionReasons.push(
            `[${blkDestKey}] Unknown destinationKey in expectedBlocks.`
          );
          continue;
        }

        const blkObs = buildBaselineObservation(liveMergedBaseline, blkDestKey);

        if (!blkContract.isWritableInBatch1) {
          const isHeldCapability =
            blkContract.batchStage === "READ_ONLY_HOLD" ||
            blkContract.writeCapability === "UNVERIFIED_CONTRACT_HOLD";
          if (
            blk.expectedCategory === "category_ineligible"
          ) {
            rejectionReasons.push(
              `[${blkDestKey}] Expected block category mismatch: field is non-writable (${blkContract.writeCapability}), not category_ineligible.`
            );
            continue;
          }
          if (blk.expectedCategory === "held_contract" && !isHeldCapability) {
            rejectionReasons.push(
              `[${blkDestKey}] Expected block category mismatch: field has capability ${blkContract.writeCapability}, not held_contract.`
            );
            continue;
          }
          confirmedExpectedBlocks.push(
            `[${blkDestKey}] Confirmed ${blk.expectedCategory} (${blkContract.writeCapability} / ${blkContract.batchStage}) — protected read-only, not staged.`
          );
          continue;
        }

        const blkTypeCheck = evaluateDestinationTypeAndCompleteness({
          contract: blkContract,
          baselineObs: blkObs
        });

        if (!blkTypeCheck.ready) {
          const isCategoryIneligibleBlock =
            blkContract.namespace === "shopify" &&
            blkObs.categoryEligibility?.isComplete === true &&
            blkObs.categoryEligibility?.isEligible === false;

          if (blk.expectedCategory === "category_ineligible" && !isCategoryIneligibleBlock) {
            rejectionReasons.push(
              `[${blkDestKey}] Expected block category mismatch: field is blocked with code "${blkTypeCheck.code}" (${blkTypeCheck.reason}), not a completed category_ineligible check.`
            );
            continue;
          }

          if (blk.expectedCategory === "read_only_or_parked") {
            rejectionReasons.push(
              `[${blkDestKey}] Expected block category mismatch: field is a Batch 1 writable contract currently held/blocked (${blkTypeCheck.code}), not read_only_or_parked.`
            );
            continue;
          }

          confirmedExpectedBlocks.push(
            `[${blkDestKey}] Confirmed ${blk.expectedCategory}: ${
              blkTypeCheck.reason || `Blocked (${blkTypeCheck.code})`
            } — not staged.`
          );
          continue;
        }

        if (blkContract.namespace === "shopify") {
          const refEv = inspectVerifiedReferenceEvidenceForDestination(
            liveMergedBaseline,
            blkDestKey,
            blkObs.restrictedMetaobjectDefinitionId
          );
          if (refEv.evidenceLoaded && refEv.isComplete && refEv.entriesByGid.size === 0) {
            if (blk.expectedCategory !== "held_contract") {
              rejectionReasons.push(
                `[${blkDestKey}] Field has 0 Metaobject entries in Shopify; use expectedCategory "held_contract" in expectedBlocks.`
              );
              continue;
            }
            confirmedExpectedBlocks.push(
              `[${blkDestKey}] Confirmed held_contract: 0 Metaobject entries exist in Shopify for ${blkObs.restrictedMetaobjectDefinitionId} — not staged.`
            );
            continue;
          }
        }

        rejectionReasons.push(
          `[${blkDestKey}] Unexpected writable & ready destination in expectedBlocks: field is eligible and ready on ${liveProductId} and cannot be classified as blocked.`
        );
      }

      if (rejectionReasons.length > 0) {
        return recordRejectedImport(
          `JSON draft packet rejected (${rejectionReasons.length} validation issue${
            rejectionReasons.length === 1 ? "" : "s"
          }) — 0 drafts staged.`,
          rejectionReasons,
          rawPacketId
        );
      }

      // Final live state recheck right before committing state
      if (
        activeProductIdRef.current !== liveProductId ||
        benchSessionIdRef.current !== liveSessionId ||
        buildStandardizedBaselineContextSignature(
          baselineByProductRef.current[liveProductId] || rawCurrentBaselineRef.current
        ) !== liveContextSig
      ) {
        return recordRejectedImport(
          "Aborted JSON draft import because live product/session/baseline state changed during validation.",
          ["State changed before commit; 0 drafts were staged."],
          rawPacketId
        );
      }

      const importedAt = new Date().toISOString();
      const nextProposalsForProduct = {
        ...(proposedByProductRef.current[liveProductId] || {})
      };
      const stagedDetails = [];

      for (const item of validatedEntriesToStage) {
        nextProposalsForProduct[item.destinationKey] = {
          value: item.normalizedValue,
          source: "Manual",
          origin: "Manual",
          updatedAt: importedAt
        };
        const fromSummary =
          item.baselinePresence === "present"
            ? `"${String(item.baselineRawValue ?? "")}"`
            : `[${item.baselinePresence}]`;
        stagedDetails.push(
          `[${item.destinationKey}] (${item.owner}, ${item.verifiedActualType}) Staged unapproved draft ${fromSummary} -> "${item.normalizedValue}"`
        );
      }

      // Record packetId in replay set ONLY on committed staging
      const updatedReplaySet = new Set(
        importedPacketIdsByProductRef.current.get(liveProductId) || []
      );
      updatedReplaySet.add(rawPacketId);
      importedPacketIdsByProductRef.current.set(liveProductId, updatedReplaySet);

      proposedByProductRef.current = {
        ...proposedByProductRef.current,
        [liveProductId]: nextProposalsForProduct
      };
      setProposedByProduct((prev) => ({
        ...prev,
        [liveProductId]: nextProposalsForProduct
      }));

      const expectedBlocksNote =
        confirmedExpectedBlocks.length > 0
          ? `, ${confirmedExpectedBlocks.length} expected read-only/category block${
              confirmedExpectedBlocks.length === 1 ? "" : "s"
            } confirmed and not staged`
          : "";

      setLastJsonImportReportByProduct((prev) => ({
        ...prev,
        [liveProductId]: {
          ok: true,
          packetId: rawPacketId,
          productId: liveProductId,
          sourceName,
          completedAt: importedAt,
          stagedCount: validatedEntriesToStage.length,
          summary: `Staged ${validatedEntriesToStage.length} changed unapproved draft${
            validatedEntriesToStage.length === 1 ? "" : "s"
          } from packet "${rawPacketId}" (${sourceName})${expectedBlocksNote}. Review and check Approve on the fields you want to save.`,
          rejectionReasons: [],
          stagedDetails,
          confirmedExpectedBlocks
        }
      }));

      return true;
    },
    [
      activeProductId,
      activeProductIdRef,
      benchSessionIdRef,
      baselineByProductRef,
      rawCurrentBaselineRef,
      currentBaselineRef,
      isCurrentRefChoicesBoundAndFreshRef,
      isSwitchingSelectedProductRef,
      isAnyOperationBusyRef,
      proposedByProductRef,
      setProposedByProduct,
      approvalsByProductRef,
      keepOriginalByProductRef,
      setClientPrevalidationBanner
    ]
  );

  const handleJsonDraftFileSelect = useCallback(
    (e) => {
      const fileInput = e?.target;
      const selectedFile = fileInput?.files?.[0] || null;
      if (!selectedFile) return;

      const fileName = selectedFile.name || "uploaded.json";
      const fileSize = typeof selectedFile.size === "number" ? selectedFile.size : 0;

      if (fileInput && typeof fileInput.value === "string") {
        fileInput.value = "";
      }

      if (isAnyOperationBusyRef.current || isJsonImportBusyRef.current) {
        if (typeof setClientPrevalidationBanner === "function") {
          setClientPrevalidationBanner({
            tone: "warning",
            title: "Cannot import JSON file while another operation is busy",
            reasons: ["Wait for the current operation to finish before importing a JSON packet."]
          });
        }
        return;
      }

      const startProductId = activeProductIdRef.current;
      const startSessionId = benchSessionIdRef.current;
      const startRawBaseline =
        baselineByProductRef.current[startProductId] || rawCurrentBaselineRef.current || null;
      const startContextSig = buildStandardizedBaselineContextSignature(startRawBaseline);

      if (fileSize > BENCH_V2_JSON_DRAFT_MAX_BYTES) {
        setLastJsonImportReportByProduct((prev) => ({
          ...prev,
          [startProductId]: {
            ok: false,
            packetId: null,
            productId: startProductId,
            sourceName: `File: ${fileName}`,
            completedAt: new Date().toISOString(),
            stagedCount: 0,
            summary: `Rejected JSON file "${fileName}": file size (${fileSize} bytes) exceeds the ${BENCH_V2_JSON_DRAFT_MAX_BYTES}-byte (256 KB) limit before reading.`,
            rejectionReasons: [
              `File "${fileName}" is ${fileSize} bytes; maximum allowed size is ${BENCH_V2_JSON_DRAFT_MAX_BYTES} bytes.`
            ],
            stagedDetails: [],
            confirmedExpectedBlocks: []
          }
        }));
        return;
      }

      const readId = `json_file_read_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      activeJsonFileReadIdRef.current = readId;
      isJsonImportBusyRef.current = true;
      setIsJsonImportBusy(true);

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        if (!isMountedRef.current || activeJsonFileReadIdRef.current !== readId) {
          return;
        }
        activeJsonFileReadIdRef.current = null;
        isJsonImportBusyRef.current = false;
        setIsJsonImportBusy(false);

        const textContent =
          typeof loadEvt?.target?.result === "string" ? loadEvt.target.result : "";
        setJsonImportPasteText(textContent);

        validateAndApplyBenchV2JsonDraftPacket({
          rawJsonText: textContent,
          sourceName: `File: ${fileName}`,
          expectedProductIdAtStart: startProductId,
          expectedSessionIdAtStart: startSessionId,
          expectedContextSigAtStart: startContextSig
        });
      };

      reader.onerror = () => {
        if (!isMountedRef.current || activeJsonFileReadIdRef.current !== readId) {
          return;
        }
        activeJsonFileReadIdRef.current = null;
        isJsonImportBusyRef.current = false;
        setIsJsonImportBusy(false);

        setLastJsonImportReportByProduct((prev) => ({
          ...prev,
          [startProductId]: {
            ok: false,
            packetId: null,
            productId: startProductId,
            sourceName: `File: ${fileName}`,
            completedAt: new Date().toISOString(),
            stagedCount: 0,
            summary: `Failed to read JSON file "${fileName}".`,
            rejectionReasons: [
              reader.error?.message || `FileReader failed while reading "${fileName}".`
            ],
            stagedDetails: [],
            confirmedExpectedBlocks: []
          }
        }));
      };

      reader.readAsText(selectedFile);
    },
    [
      activeProductIdRef,
      benchSessionIdRef,
      baselineByProductRef,
      rawCurrentBaselineRef,
      isAnyOperationBusyRef,
      setClientPrevalidationBanner,
      validateAndApplyBenchV2JsonDraftPacket
    ]
  );

  const handleApplyPastedJsonDraftPacket = useCallback(() => {
    if (isAnyOperationBusyRef.current || isJsonImportBusyRef.current) {
      return;
    }
    const startProductId = activeProductIdRef.current;
    const startSessionId = benchSessionIdRef.current;
    const startRawBaseline =
      baselineByProductRef.current[startProductId] || rawCurrentBaselineRef.current || null;
    const startContextSig = buildStandardizedBaselineContextSignature(startRawBaseline);

    validateAndApplyBenchV2JsonDraftPacket({
      rawJsonText: jsonImportPasteText,
      sourceName: "Pasted JSON",
      expectedProductIdAtStart: startProductId,
      expectedSessionIdAtStart: startSessionId,
      expectedContextSigAtStart: startContextSig
    });
  }, [
    activeProductIdRef,
    benchSessionIdRef,
    baselineByProductRef,
    rawCurrentBaselineRef,
    isAnyOperationBusyRef,
    jsonImportPasteText,
    validateAndApplyBenchV2JsonDraftPacket
  ]);

  const handleClearJsonImportPasteText = useCallback(() => {
    setJsonImportPasteText("");
  }, []);

  const handleDismissJsonImportReport = useCallback(() => {
    setLastJsonImportReportByProduct((prev) => {
      const next = { ...prev };
      delete next[activeProductId];
      return next;
    });
  }, [activeProductId]);

  return {
    isJsonImportPanelOpen,
    setIsJsonImportPanelOpen,
    jsonImportPasteText,
    setJsonImportPasteText,
    isJsonImportBusy,
    currentJsonImportReport,
    handleJsonDraftFileSelect,
    handleApplyPastedJsonDraftPacket,
    handleClearJsonImportPasteText,
    handleDismissJsonImportReport
  };
}
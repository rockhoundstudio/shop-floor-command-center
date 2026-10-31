// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2
// File: app/routes/app.bench-v2.jsx
//
// Connects Drawers 1 to 8 (Identity, Origin & Collection, Treatment,
// Appearance & Character, Manual Measurements [dimensions_mm, weight_grams],
// Conditional Setting & Hardware, Geology [12 active custom.* destinations +
// read-only compatibility custom.geological_era], and Channel Attributes
// [PRODUCT custom.google_product_category + single-variant PRODUCTVARIANT
// mm-google-shopping.age_group, condition, gender]), plus read-only Drawers 9,
// 10 (shopify.* reference attributes including authoritative ERA dropdown
// shopify.geological-era), and 11 (Parked & Protected inventory), with
// Sidekick live bench snapshot sync.
// ==========================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLoaderData, useFetcher, useRevalidator, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { loadSingleProductBaselineSnapshot } from "../utils/bench-v2.baseline.server.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_DRAWER_GROUPS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  CANCELLED_INERT_DESTINATIONS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS,
  isManualOnlyNoAiDestination,
  checkExistingWriterStringFidelity,
  isExactProductGid,
  isExactProductVariantGid,
  getFieldContractByDestination,
  buildBaselineObservation,
  evaluateDestinationTypeAndCompleteness,
  validateBatch1ProposedValue,
  createExactValueApprovalRecord,
  isExactValueApprovalValid,
  createKeepOriginalRecord,
  isKeepOriginalRecordValid,
  evaluateBenchV2FieldRow
} from "../utils/bench-v2.contract.jsx";
import {
  REGISTRY_BY_OWNER_IDENTITY,
  FIELD_CATALOG
} from "../utils/meta-injector.constants.jsx";

export { checkExistingWriterStringFidelity };

export const CANYON_RED_PRODUCT_GID = "gid://shopify/Product/9226849616123";

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

const CATALOG_META_BY_OWNER_IDENTITY = Object.freeze(
  (Array.isArray(FIELD_CATALOG) ? FIELD_CATALOG : []).reduce((acc, entry) => {
    if (entry && entry.registryOwner && entry.registryIdentity) {
      acc[`${entry.registryOwner}:${entry.registryIdentity}`] = entry;
    }
    return acc;
  }, {})
);

const TELEMETRY_ENDPOINT_PATH = "/api/meta-injector-telemetry";
const TELEMETRY_LIVE_BENCH_MODE = "live_bench_state";
const TELEMETRY_MAX_FULL_TEXT_CODE_UNITS = 1024 * 1024;
const TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES = 1024 * 1024;
const TELEMETRY_MAX_POST_BODY_BYTES = 2 * 1024 * 1024;

function measureUtf8BytesClient(str) {
  if (typeof str !== "string" || str.length === 0) return 0;
  try {
    if (typeof TextEncoder !== "undefined") {
      return new TextEncoder().encode(str).byteLength;
    }
  } catch {
    // Fallback below
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function generateBenchSessionId() {
  let randPart = "";
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      randPart = crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "");
    }
  } catch {
    // Fallback below
  }
  if (!randPart) {
    randPart = `${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 10)}`;
  }
  const candidate = `bv2_${Date.now()}_${randPart}`.replace(/[^A-Za-z0-9._:-]/g, "");
  return candidate.slice(0, 96);
}

function resolveActualEventOrdering(aiScanReport, saveReport) {
  const aiCompletedAt =
    aiScanReport && typeof aiScanReport.completedAt === "string"
      ? aiScanReport.completedAt
      : null;
  const saveCompletedAt =
    saveReport && typeof saveReport.completedAt === "string"
      ? saveReport.completedAt
      : null;

  const aiMs = aiCompletedAt ? Date.parse(aiCompletedAt) : NaN;
  const saveMs = saveCompletedAt ? Date.parse(saveCompletedAt) : NaN;
  const hasValidAiMs = Number.isFinite(aiMs);
  const hasValidSaveMs = Number.isFinite(saveMs);

  if (hasValidAiMs && hasValidSaveMs) {
    if (saveMs >= aiMs) {
      return {
        runIdentity: saveReport.submissionId || null,
        runTimestamp: saveCompletedAt,
        latestEventKind: "save_attempt"
      };
    }
    return {
      runIdentity: aiScanReport.requestId || null,
      runTimestamp: aiCompletedAt,
      latestEventKind: "ai_scan"
    };
  }
  if (hasValidSaveMs) {
    return {
      runIdentity: saveReport.submissionId || null,
      runTimestamp: saveCompletedAt,
      latestEventKind: "save_attempt"
    };
  }
  if (hasValidAiMs) {
    return {
      runIdentity: aiScanReport.requestId || null,
      runTimestamp: aiCompletedAt,
      latestEventKind: "ai_scan"
    };
  }
  return {
    runIdentity: null,
    runTimestamp: null,
    latestEventKind: null
  };
}

function resolveFieldRegistryAndApplicabilityMeta(contract) {
  const owner = contract.owner || "PRODUCT";
  const destKey = contract.destinationKey;
  const compositeKey = `${owner}:${destKey}`;

  const regEntry = REGISTRY_BY_OWNER_IDENTITY?.[compositeKey] || null;
  const catEntry = CATALOG_META_BY_OWNER_IDENTITY?.[compositeKey] || null;

  let registryRole = regEntry?.role || catEntry?.registryRole || null;
  if (!registryRole) {
    if (contract.batchStage === "PROTECTED_READ_ONLY") {
      registryRole = "PROTECTED_DATA";
    } else if (contract.batchStage === "PARKED_EXCLUDED_READ_ONLY") {
      registryRole = "EXCLUDED_INPUT";
    } else if (contract.batchStage === "READ_ONLY_COMPATIBILITY") {
      registryRole = "COMPAT_REP";
    } else if (
      contract.drawerId === "manual_measurements" &&
      contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
    ) {
      registryRole = "APPROVED_MEASUREMENT_ADDITION";
    } else {
      registryRole = "PRIMARY_CANDIDATE_DESTINATION";
    }
  }

  const isProtectedAppData =
    registryRole === "PROTECTED_DATA" ||
    contract.batchStage === "PROTECTED_READ_ONLY" ||
    contract.writeCapability === "PROTECTED_NO_WRITE";

  const isParkedExcluded =
    !isProtectedAppData &&
    (registryRole === "EXCLUDED_INPUT" ||
      contract.batchStage === "PARKED_EXCLUDED_READ_ONLY" ||
      contract.writeCapability === "PARKED_EXCLUDED_NO_WRITE");

  const applicability =
    typeof catEntry?.applicability === "string" && catEntry.applicability.trim() !== ""
      ? catEntry.applicability.trim()
      : isProtectedAppData
        ? "protected_read_only"
        : isParkedExcluded
          ? "parked_excluded"
          : "not_evaluated";

  return {
    registryOwner: owner,
    registryIdentity: destKey,
    registryRole,
    isProtectedAppData,
    isParkedExcluded,
    applicability
  };
}

const GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY = `
  query GetLightweightProductsPage($cursor: String, $searchQuery: String) {
    products(first: 50, after: $cursor, query: $searchQuery) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
          pieceName: metafield(namespace: "custom", key: "piece_name") {
            value
          }
        }
      }
    }
  }
`;

function buildShopifyProductTitleSearchQuery(rawSearch) {
  if (typeof rawSearch !== "string") return null;
  const trimmed = rawSearch.trim();
  if (!trimmed) return null;
  const escaped = trimmed.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `title:*${escaped}*`;
}

async function loadLightweightProductPage(admin, cursor = null, rawSearch = "") {
  const normalizedCursor =
    typeof cursor === "string" && cursor.trim() !== "" ? cursor.trim() : null;
  const cleanSearch =
    typeof rawSearch === "string" && rawSearch.trim() !== "" ? rawSearch.trim() : "";
  const graphqlSearchQuery = buildShopifyProductTitleSearchQuery(cleanSearch);

  try {
    const res = await admin.graphql(GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY, {
      variables: {
        cursor: normalizedCursor,
        searchQuery: graphqlSearchQuery
      }
    });
    const json = await res.json();
    if (json.errors?.length) {
      throw new Error(json.errors.map((e) => e.message).join("; "));
    }

    const conn = json?.data?.products;
    if (!conn || !Array.isArray(conn.edges) || typeof conn.pageInfo?.hasNextPage !== "boolean") {
      throw new Error("Malformed products connection response.");
    }

    const items = [];
    for (const edge of conn.edges) {
      const node = edge?.node;
      if (node && isExactProductGid(node.id)) {
        const rawPieceName =
          typeof node.pieceName?.value === "string" && node.pieceName.value.trim() !== ""
            ? node.pieceName.value.trim()
            : null;
        items.push({
          id: node.id,
          title: typeof node.title === "string" && node.title.trim() !== "" ? node.title : node.id,
          pieceName: rawPieceName
        });
      }
    }

    return {
      ok: true,
      items,
      pageInfo: {
        hasNextPage: Boolean(conn.pageInfo.hasNextPage),
        endCursor:
          typeof conn.pageInfo.endCursor === "string" && conn.pageInfo.endCursor.trim() !== ""
            ? conn.pageInfo.endCursor.trim()
            : null
      },
      requestedCursor: normalizedCursor,
      appliedSearch: cleanSearch,
      error: null
    };
  } catch (err) {
    return {
      ok: false,
      items: [],
      pageInfo: {
        hasNextPage: false,
        endCursor: null
      },
      requestedCursor: normalizedCursor,
      appliedSearch: cleanSearch,
      error: `Failed to load product search/picker page: ${err.message}`
    };
  }
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isPickerOnly = url.searchParams.get("pickerOnly") === "1";
  const requestedProductId = url.searchParams.get("productId");
  const requestedCursor = url.searchParams.get("cursor");
  const requestedSearch = url.searchParams.get("q") || "";

  if (isPickerOnly) {
    const selectorPageResult = await loadLightweightProductPage(
      admin,
      requestedCursor,
      requestedSearch
    );
    return Response.json({
      pickerOnly: true,
      selectorPage: selectorPageResult,
      loadedAt: new Date().toISOString()
    });
  }

  let targetProductId = CANYON_RED_PRODUCT_GID;
  let selectionError = null;

  if (requestedProductId !== null && requestedProductId.trim() !== "") {
    const candidateId = requestedProductId.trim();
    if (isExactProductGid(candidateId)) {
      targetProductId = candidateId;
    } else {
      selectionError = `Ignored invalid productId parameter "${candidateId}"; exact Shopify Product GID is required.`;
    }
  }

  const [selectorPageResult, loadResult] = await Promise.all([
    loadLightweightProductPage(admin, requestedCursor, requestedSearch),
    loadSingleProductBaselineSnapshot(admin, targetProductId)
  ]);

  return Response.json({
    pickerOnly: false,
    contractVersion: BENCH_V2_CONTRACT_VERSION,
    targetProductId,
    selectionError,
    selectorPage: selectorPageResult,
    loadSuccess: Boolean(loadResult?.success),
    loadError: loadResult?.error || null,
    baselineSnapshot: loadResult?.baselineSnapshot || null,
    loadedAt: new Date().toISOString()
  });
};

function formatRawBaselineValueForInspection(baselineObs) {
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

function formatReadableSavedValue(baselineObs, usesMeaningDisplay, baselineDisplayValue) {
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

const PLAIN_DRAWER_TITLES = Object.freeze({
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

function cleanFieldHeading(rawLabel) {
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

function getShortPlainNotice(row) {
  const {
    contract,
    baselineObservation: obs,
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

  if (obs.metafieldsCompleteState !== "complete" || obs.defsCompleteState !== "complete") {
    return {
      tone: "error",
      text: "Read incomplete — reload before saving."
    };
  }

  if (obs.destinationDefError) {
    return {
      tone: "error",
      text: "Definition or category error — see Details."
    };
  }

  if (!obs.liveDefType && !obs.storedType) {
    return {
      tone: "error",
      text: "Missing Shopify type evidence — cannot save yet."
    };
  }

  if (obs.liveDefType && obs.storedType && obs.liveDefType !== obs.storedType) {
    return {
      tone: "error",
      text: "Shopify type conflict — see Details."
    };
  }

  const verifiedActualType = obs.liveDefType || obs.storedType;
  const allowedTypes =
    Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
      ? contract.allowedTypes
      : [contract.expectedType];
  if (verifiedActualType && !allowedTypes.includes(verifiedActualType)) {
    return {
      tone: "error",
      text: `Shopify type mismatch (observed ${verifiedActualType}, expected ${allowedTypes.join(" or ")}) — see Details.`
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

function getDrawerConnectionSubtitle(drawer) {
  if (!drawer) return "Read-only in Batch 1";
  if (drawer.drawerId === "parked_excluded_protected") {
    return "Read-only parked and protected fields (includes excluded custom & standardized authenticity/rarity)";
  }
  if (drawer.drawerId === "identity") {
    return "Detailed custom.* identity fields connected (standardized companion shopify.material in Drawer 10 remains locked pending reference wiring)";
  }
  if (drawer.drawerId === "appearance_and_character") {
    return "Detailed custom.* appearance fields connected (standardized companion shopify.color-pattern in Drawer 10 remains locked pending reference wiring)";
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
    const readyCount = writableRows.filter(
      (r) =>
        r.baselineObservation.evidenceAvailable &&
        r.baselineObservation.metafieldsCompleteState === "complete" &&
        r.baselineObservation.defsCompleteState === "complete" &&
        Boolean(r.baselineObservation.liveDefType || r.baselineObservation.storedType)
    ).length;
    return `Detailed custom.* geology paths connected (${readyCount}/${writableRows.length} ready on product; 12 had scan-delivery evidence on Canyon, only AGE custom.geological_age has independently verified Save/readback; legacy custom.geological_era is read-only; authoritative ERA dropdown shopify.geological-era + 4 standardized geology reference companions in Drawer 10 remain locked)`;
  }
  if (drawer.drawerId === "other_channel") {
    const writableRows = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1);
    const readyCount = writableRows.filter(
      (r) =>
        r.baselineObservation.evidenceAvailable &&
        r.baselineObservation.metafieldsCompleteState === "complete" &&
        r.baselineObservation.defsCompleteState === "complete" &&
        Boolean(r.baselineObservation.liveDefType || r.baselineObservation.storedType) &&
        !r.baselineObservation.destinationDefError
    ).length;
    return `4 channel destinations wired (${readyCount}/${writableRows.length} ready on current product: PRODUCT custom.google_product_category + manual/preset single-variant PRODUCTVARIANT mm-google-shopping.age_group, condition, gender; mm-google-shopping.custom_product held; legacy google.* variant slots & custom.target_gender read-only)`;
  }
  if (drawer.drawerId === "standardized_attributes") {
    return "Locked in this batch (all 18 non-excluded shopify.* reference attributes — including authoritative ERA dropdown shopify.geological-era, 4 standardized geology companions, shopify.material, and shopify.color-pattern — remain read-only pending reference wiring)";
  }
  if (drawer.isImplementedInBatch1) {
    return "Connected in Batch 1";
  }
  return "Read-only in Batch 1";
}

function mergeKnownProductsMap(prevMap, pageItems, snap) {
  const next = { ...prevMap };
  if (Array.isArray(pageItems)) {
    for (const item of pageItems) {
      if (item && isExactProductGid(item.id)) {
        const existing = next[item.id];
        next[item.id] = {
          id: item.id,
          title: typeof item.title === "string" ? item.title : existing?.title || item.id,
          pieceName:
            typeof item.pieceName === "string" && item.pieceName.trim() !== ""
              ? item.pieceName.trim()
              : existing?.pieceName || null
        };
      }
    }
  }
  if (snap && isExactProductGid(snap.productId)) {
    const existing = next[snap.productId];
    const snapPieceName =
      typeof snap.currentMetafields?.["custom.piece_name"] === "string" &&
      snap.currentMetafields["custom.piece_name"].trim() !== ""
        ? snap.currentMetafields["custom.piece_name"].trim()
        : existing?.pieceName || null;
    next[snap.productId] = {
      id: snap.productId,
      title: snap.productTitle || existing?.title || snap.productId,
      pieceName: snapPieceName
    };
  }
  return next;
}

const DISMISS_BTN_STYLE = Object.freeze({
  backgroundColor: "#ffffff",
  color: "#0f172a",
  border: "1px solid #475569",
  borderRadius: "6px",
  padding: "4px 12px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 600
});

const DRAWER_BULK_BTN_STYLE = Object.freeze({
  padding: "8px 14px",
  fontSize: "15px",
  fontWeight: 600,
  backgroundColor: "#f8fafc",
  color: "#0f172a",
  border: "1px solid #64748b",
  borderRadius: "6px",
  cursor: "pointer"
});

const DETAILS_PANEL_STYLE = Object.freeze({
  marginTop: "8px",
  padding: "10px 14px",
  backgroundColor: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "6px"
});

const THUMBNAIL_WRAPPER_STYLE = Object.freeze({
  width: "120px",
  height: "120px",
  minWidth: "120px",
  minHeight: "120px",
  flex: "0 0 120px",
  flexShrink: 0,
  borderRadius: "8px",
  border: "2px solid #94a3b8",
  backgroundColor: "#f8fafc",
  overflow: "hidden",
  boxSizing: "border-box"
});

const THUMBNAIL_IMG_STYLE = Object.freeze({
  width: "120px",
  height: "120px",
  minWidth: "120px",
  minHeight: "120px",
  objectFit: "cover",
  objectPosition: "center",
  display: "block"
});

export default function BenchV2Route() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const writerFetcher = useFetcher();
  const aiScanFetcher = useFetcher();
  const pickerFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const rawUrlProductId = searchParams.get("productId");
  const requestedUrlProductId =
    rawUrlProductId && isExactProductGid(rawUrlProductId.trim())
      ? rawUrlProductId.trim()
      : null;

  const activeProductId = isExactProductGid(loaderData?.targetProductId)
    ? loaderData.targetProductId
    : CANYON_RED_PRODUCT_GID;

  const isSwitchingSelectedProduct = Boolean(
    requestedUrlProductId && requestedUrlProductId !== activeProductId
  );

  // 1. Authoritative Baseline State (Strictly separated from proposals, keyed by Product GID)
  const [baselineByProduct, setBaselineByProduct] = useState(() => {
    const initialSnap = loaderData?.baselineSnapshot;
    if (initialSnap && isExactProductGid(initialSnap.productId)) {
      return { [initialSnap.productId]: initialSnap };
    }
    return {};
  });

  // 2. Known Product Metadata Cache
  const [knownProductsById, setKnownProductsById] = useState(() =>
    mergeKnownProductsMap(
      {
        [CANYON_RED_PRODUCT_GID]: {
          id: CANYON_RED_PRODUCT_GID,
          title: "Canyon Red",
          pieceName: null
        }
      },
      loaderData?.selectorPage?.items,
      loaderData?.baselineSnapshot
    )
  );

  // 3. Dedicated Product Search & Paginated Picker State
  const [pickerPageState, setPickerPageState] = useState(() => {
    return (
      loaderData?.selectorPage || {
        ok: false,
        items: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        requestedCursor: null,
        appliedSearch: "",
        error: null
      }
    );
  });
  const [searchInputText, setSearchInputText] = useState(
    () => loaderData?.selectorPage?.appliedSearch || ""
  );
  const [committedSearchQuery, setCommittedSearchQuery] = useState(
    () => loaderData?.selectorPage?.appliedSearch || ""
  );
  const [pickerCursorHistory, setPickerCursorHistory] = useState([]);
  const [currentPickerCursor, setCurrentPickerCursor] = useState(null);
  const [isProductPickerOpen, setIsProductPickerOpen] = useState(false);

  // 4. Staged Proposals State (Never pre-seeded from baseline, preserved per productId)
  const [proposedByProduct, setProposedByProduct] = useState({});

  // 5. Held AI Alternatives State
  const [aiAlternativesByProduct, setAiAlternativesByProduct] = useState({});

  // 6. Exact-Value Approval Records State
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 7. Keep Original Decision Records State
  const [keepOriginalByProduct, setKeepOriginalByProduct] = useState({});

  // 8. Save Request Tracking & Honest Outcome Reporting
  const [activeSaveSubmission, setActiveSaveSubmission] = useState(null);
  const [lastSaveReport, setLastSaveReport] = useState(null);
  const [clientPrevalidationBanner, setClientPrevalidationBanner] = useState(null);
  const processedSubmissionIdRef = useRef(null);
  const activeSaveSubmissionRef = useRef(null);

  // 9. Explicit AI Scan Request Tracking & Honest Scan Report
  const [activeAiScanRequest, setActiveAiScanRequest] = useState(null);
  const [lastAiScanReportByProduct, setLastAiScanReportByProduct] = useState({});
  const processedAiScanRequestIdRef = useRef(null);
  const activeAiScanRequestRef = useRef(null);

  // 10. Presentation-Only State: All drawers initially collapsed + View-Only Drawer Filter
  const [openDrawersById, setOpenDrawersById] = useState(() =>
    BENCH_V2_DRAWER_GROUPS.reduce((acc, drawer) => {
      acc[drawer.drawerId] = false;
      return acc;
    }, {})
  );
  const [activeFilter, setActiveFilter] = useState("All");

  // 11. Focus Retention State for Filtered Views
  const [retainedFieldEditorsByProduct, setRetainedFieldEditorsByProduct] = useState({});
  const blurClearTimersRef = useRef(new Map());
  const isMountedRef = useRef(true);

  // 12. Read-Only Sidekick Live Snapshot Publication State
  const benchSessionIdRef = useRef(null);
  if (!benchSessionIdRef.current) {
    benchSessionIdRef.current = generateBenchSessionId();
  }
  const benchRevisionRef = useRef(0);
  const lastEnqueuedFingerprintRef = useRef(null);
  const latestQueuedSnapshotSpecRef = useRef(null);
  const isTelemetrySendInFlightRef = useRef(false);
  const [telemetrySyncStatus, setTelemetrySyncStatus] = useState(() => ({
    state: "idle",
    benchSessionId: benchSessionIdRef.current,
    benchRevision: 0,
    reportId: null,
    productId: null,
    clientStateChangedAt: null,
    serverReceivedAt: null,
    errorCode: null,
    message: "Waiting for initial bench state sync."
  }));

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      latestQueuedSnapshotSpecRef.current = null;
      for (const timerId of blurClearTimersRef.current.values()) {
        clearTimeout(timerId);
      }
      blurClearTimersRef.current.clear();
    };
  }, []);

  const handleFieldEditorFocus = useCallback(
    (destinationKey) => {
      if (typeof destinationKey !== "string" || !destinationKey.trim()) return;
      const timerKey = `${activeProductId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        blurClearTimersRef.current.delete(timerKey);
      }
      setRetainedFieldEditorsByProduct((prev) => {
        const prodMap = prev[activeProductId] || {};
        if (prodMap[destinationKey] === true) return prev;
        return {
          ...prev,
          [activeProductId]: {
            ...prodMap,
            [destinationKey]: true
          }
        };
      });
    },
    [activeProductId]
  );

  const handleFieldEditorBlur = useCallback(
    (destinationKey) => {
      if (typeof destinationKey !== "string" || !destinationKey.trim()) return;
      const timerKey = `${activeProductId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      const timerId = setTimeout(() => {
        blurClearTimersRef.current.delete(timerKey);
        if (!isMountedRef.current) return;
        setRetainedFieldEditorsByProduct((prev) => {
          const prodMap = prev[activeProductId];
          if (!prodMap || prodMap[destinationKey] === undefined) return prev;
          const nextProdMap = { ...prodMap };
          delete nextProdMap[destinationKey];
          return {
            ...prev,
            [activeProductId]: nextProdMap
          };
        });
      }, 200);
      blurClearTimersRef.current.set(timerKey, timerId);
    },
    [activeProductId]
  );

  const releaseRetainedFieldEditor = useCallback(
    (productId, destinationKey) => {
      if (!productId || !destinationKey) return;
      const timerKey = `${productId}::${destinationKey}`;
      const existingTimer = blurClearTimersRef.current.get(timerKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
        blurClearTimersRef.current.delete(timerKey);
      }
      setRetainedFieldEditorsByProduct((prev) => {
        const prodMap = prev[productId];
        if (!prodMap || prodMap[destinationKey] === undefined) return prev;
        const nextProdMap = { ...prodMap };
        delete nextProdMap[destinationKey];
        return {
          ...prev,
          [productId]: nextProdMap
        };
      });
    },
    []
  );

  const clearDecisionForDestination = useCallback((setter, productId, destinationKey) => {
    setter((prev) => {
      const prodMap = prev[productId];
      if (!prodMap || !prodMap[destinationKey]) return prev;
      const nextMap = { ...prodMap };
      delete nextMap[destinationKey];
      return { ...prev, [productId]: nextMap };
    });
  }, []);

  const handleToggleDrawer = (drawerId) => {
    setOpenDrawersById((prev) => ({
      ...prev,
      [drawerId]: !prev[drawerId]
    }));
  };

  const handleSetAllDrawers = (isOpen) => {
    setOpenDrawersById(
      BENCH_V2_DRAWER_GROUPS.reduce((acc, drawer) => {
        acc[drawer.drawerId] = Boolean(isOpen);
        return acc;
      }, {})
    );
  };

  useEffect(() => {
    activeSaveSubmissionRef.current = activeSaveSubmission;
  }, [activeSaveSubmission]);

  useEffect(() => {
    activeAiScanRequestRef.current = activeAiScanRequest;
  }, [activeAiScanRequest]);

  const baselineByProductRef = useRef(baselineByProduct);
  useEffect(() => {
    baselineByProductRef.current = baselineByProduct;
  }, [baselineByProduct]);

  const proposedByProductRef = useRef(proposedByProduct);
  useEffect(() => {
    proposedByProductRef.current = proposedByProduct;
  }, [proposedByProduct]);

  const approvalsByProductRef = useRef(approvalsByProduct);
  useEffect(() => {
    approvalsByProductRef.current = approvalsByProduct;
  }, [approvalsByProduct]);

  const keepOriginalByProductRef = useRef(keepOriginalByProduct);
  useEffect(() => {
    keepOriginalByProductRef.current = keepOriginalByProduct;
  }, [keepOriginalByProduct]);

  useEffect(() => {
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId)) {
      setBaselineByProduct((prev) => ({
        ...prev,
        [snap.productId]: snap
      }));
    }

    if (loaderData?.selectorPage && !loaderData?.pickerOnly) {
      setPickerPageState((prev) => {
        if (
          prev.appliedSearch === (loaderData.selectorPage.appliedSearch || "") &&
          prev.requestedCursor === (loaderData.selectorPage.requestedCursor || null)
        ) {
          return loaderData.selectorPage;
        }
        return prev;
      });
    }

    setKnownProductsById((prev) =>
      mergeKnownProductsMap(prev, loaderData?.selectorPage?.items, snap)
    );
  }, [loaderData?.baselineSnapshot, loaderData?.selectorPage, loaderData?.loadedAt, loaderData?.pickerOnly]);

  useEffect(() => {
    if (pickerFetcher.state !== "idle" || !pickerFetcher.data) return;
    const fetchedPage = pickerFetcher.data.selectorPage;
    if (!fetchedPage || typeof fetchedPage !== "object") return;

    setPickerPageState(fetchedPage);
    if (Array.isArray(fetchedPage.items) && fetchedPage.items.length > 0) {
      setKnownProductsById((prev) =>
        mergeKnownProductsMap(prev, fetchedPage.items, null)
      );
    }
  }, [pickerFetcher.state, pickerFetcher.data]);

  const currentBaseline =
    baselineByProduct[activeProductId] &&
    baselineByProduct[activeProductId].productId === activeProductId
      ? baselineByProduct[activeProductId]
      : loaderData?.baselineSnapshot?.productId === activeProductId
        ? loaderData.baselineSnapshot
        : null;

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

  const isWriterBusy = writerFetcher.state !== "idle" || Boolean(activeSaveSubmission);
  const isAiScanBusy = aiScanFetcher.state !== "idle" || Boolean(activeAiScanRequest);
  const isBaselineReloading = revalidator.state !== "idle";
  const isPickerLoading = pickerFetcher.state !== "idle";
  const isAnyOperationBusy = isWriterBusy || isAiScanBusy || isBaselineReloading;

  const activeProductKnownEntry = knownProductsById[activeProductId] || null;
  const activeProductPieceName =
    (typeof currentBaseline?.currentMetafields?.["custom.piece_name"] === "string" &&
      currentBaseline.currentMetafields["custom.piece_name"].trim() !== ""
      ? currentBaseline.currentMetafields["custom.piece_name"].trim()
      : null) ||
    activeProductKnownEntry?.pieceName ||
    null;

  const activeProductTitle =
    currentBaseline?.productTitle ||
    activeProductKnownEntry?.title ||
    (activeProductId === CANYON_RED_PRODUCT_GID ? "Canyon Red" : activeProductId);

  const activeProductHeadline =
    activeProductPieceName && activeProductPieceName !== activeProductTitle
      ? `${activeProductPieceName} — ${activeProductTitle}`
      : activeProductTitle;

  const activeProductMediaItems = React.useMemo(() => {
    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      return [];
    }
    const edges = currentBaseline.nativeTargets?.media?.edges;
    if (!Array.isArray(edges)) return [];
    const list = [];
    for (let i = 0; i < edges.length; i++) {
      const node = edges[i]?.node;
      const url = node?.preview?.image?.url;
      if (node && typeof url === "string" && url.trim() !== "") {
        list.push({
          id: node.id || `media_${i}`,
          url: url.trim(),
          alt: typeof node.alt === "string" ? node.alt : ""
        });
      }
    }
    return list;
  }, [currentBaseline, activeProductId]);

  const submitPickerQuery = (targetSearch, targetCursor) => {
    const params = new URLSearchParams();
    params.set("pickerOnly", "1");
    if (typeof targetSearch === "string" && targetSearch.trim() !== "") {
      params.set("q", targetSearch.trim());
    }
    if (typeof targetCursor === "string" && targetCursor.trim() !== "") {
      params.set("cursor", targetCursor.trim());
    }
    pickerFetcher.load(`/app/bench-v2?${params.toString()}`);
  };

  const handleSearchFormSubmit = (e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
    }
    if (isAnyOperationBusy || isPickerLoading) return;
    const cleanQuery = searchInputText.trim();
    setCommittedSearchQuery(cleanQuery);
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    setIsProductPickerOpen(true);
    submitPickerQuery(cleanQuery, null);
  };

  const handleClearProductSearch = () => {
    if (isAnyOperationBusy || isPickerLoading) return;
    setSearchInputText("");
    setCommittedSearchQuery("");
    setPickerCursorHistory([]);
    setCurrentPickerCursor(null);
    submitPickerQuery("", null);
  };

  const handleNextProductPage = () => {
    if (isAnyOperationBusy || isPickerLoading) return;
    const nextCursor = pickerPageState?.pageInfo?.endCursor;
    if (!pickerPageState?.pageInfo?.hasNextPage || !nextCursor) return;

    setPickerCursorHistory((prev) => [...prev, currentPickerCursor]);
    setCurrentPickerCursor(nextCursor);
    submitPickerQuery(committedSearchQuery, nextCursor);
  };

  const handlePreviousProductPage = () => {
    if (isAnyOperationBusy || isPickerLoading || pickerCursorHistory.length === 0) return;
    const prevCursor = pickerCursorHistory[pickerCursorHistory.length - 1] ?? null;
    setPickerCursorHistory((prev) => prev.slice(0, -1));
    setCurrentPickerCursor(prevCursor);
    submitPickerQuery(committedSearchQuery, prevCursor);
  };

  const handleSelectProductGid = (nextProductGid) => {
    if (isWriterBusy || isAiScanBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: isWriterBusy
          ? "Cannot switch products while saving"
          : "Cannot switch products while AI Scan is running",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before switching products."
            : "Wait for the current AI Scan to finish before switching products."
        ]
      });
      return;
    }

    if (!isExactProductGid(nextProductGid)) {
      return;
    }

    if (nextProductGid === activeProductId) {
      setIsProductPickerOpen(false);
      return;
    }

    setClientPrevalidationBanner(null);
    setIsProductPickerOpen(false);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("productId", nextProductGid);
    if (committedSearchQuery) {
      nextParams.set("q", committedSearchQuery);
    } else {
      nextParams.delete("q");
    }
    if (currentPickerCursor) {
      nextParams.set("cursor", currentPickerCursor);
    } else {
      nextParams.delete("cursor");
    }
    setSearchParams(nextParams);
  };

  const handleExplicitAiScanProduct = () => {
    setClientPrevalidationBanner(null);

    if (isWriterBusy || isAiScanBusy || isBaselineReloading) {
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

    const operatorLockedList = [];
    const passiveStoredList = [];
    const contextKeyValues = {};

    for (const bareKey of ENGINE_ALLOWED_PROVENANCE_BARE_KEYS) {
      if (CANCELLED_INERT_DESTINATIONS.has(bareKey)) continue;

      let destKey = `custom.${bareKey}`;
      if (bareKey === "price") destKey = "native_price";
      else if (bareKey === "poetic_hook") destKey = "native_seo_description";

      const propEntry = currentProposedMap[destKey];
      const hasHumanDraft = Boolean(
        propEntry &&
          typeof propEntry === "object" &&
          propEntry.origin === "Manual" &&
          typeof propEntry.value === "string" &&
          propEntry.value.trim() !== ""
      );

      const approvalRec = currentApprovalsMap[destKey];
      const hasValidApproval = Boolean(
        approvalRec &&
          propEntry &&
          isExactValueApprovalValid({
            approvalRecord: approvalRec,
            productId: activeProductId,
            destinationKey: destKey,
            currentProposedValue:
              typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
            baselineSnapshot: currentBaseline
          })
      );

      const keepOrigRec = currentKeepOriginalMap[destKey];
      const hasValidKeepOriginal = Boolean(
        keepOrigRec &&
          propEntry &&
          isKeepOriginalRecordValid({
            keepOriginalRecord: keepOrigRec,
            productId: activeProductId,
            destinationKey: destKey,
            currentProposedValue:
              typeof propEntry === "object" ? propEntry.value : String(propEntry || ""),
            baselineSnapshot: currentBaseline
          })
      );

      let storedVal = "";
      if (bareKey === "price") {
        storedVal = currentBaseline.nativeTargets?.price || "";
      } else if (bareKey === "poetic_hook") {
        storedVal = currentBaseline.nativeTargets?.seo?.description || "";
      } else {
        const rawMf = currentBaseline.currentMetafields?.[`custom.${bareKey}`];
        storedVal = rawMf !== undefined && rawMf !== null ? String(rawMf).trim() : "";
      }

      if (hasHumanDraft || hasValidApproval) {
        const humanVal =
          typeof propEntry === "object" ? propEntry.value.trim() : String(propEntry || "").trim();
        if (humanVal !== "") {
          operatorLockedList.push(bareKey);
          contextKeyValues[bareKey] = humanVal;
          continue;
        }
      }

      if (hasValidKeepOriginal && storedVal !== "") {
        operatorLockedList.push(bareKey);
        contextKeyValues[bareKey] = storedVal;
        continue;
      }

      if (storedVal !== "") {
        passiveStoredList.push(bareKey);
        contextKeyValues[bareKey] = storedVal;
      }
    }

    const observedDestinationTypes = {};
    for (const destKey of BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS) {
      const obs = buildBaselineObservation(currentBaseline, destKey);
      const contract = getFieldContractByDestination(destKey);
      const typeCheck = evaluateDestinationTypeAndCompleteness({
        contract,
        baselineObs: obs
      });
      if (typeCheck.ready && typeCheck.verifiedActualType) {
        observedDestinationTypes[destKey] = typeCheck.verifiedActualType;
      }
    }

    const ooak1ObservedType = observedDestinationTypes["custom.is_one_of_a_kind"] || "";
    const ooak2ObservedType = observedDestinationTypes["custom.is_ooak"] || "";

    const requestId = `bench_v2_aiscan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setActiveAiScanRequest({
      requestId,
      productId: activeProductId,
      startedAt: new Date().toISOString()
    });

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

    for (const [k, v] of Object.entries(contextKeyValues)) {
      if (v !== undefined && v !== null && String(v).trim() !== "") {
        formData.append(k, String(v));
      }
    }

    aiScanFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-autofill"
    });
  };

  useEffect(() => {
    if (aiScanFetcher.state !== "idle") return;
    const pendingScan = activeAiScanRequestRef.current;
    if (!pendingScan) return;

    if (processedAiScanRequestIdRef.current === pendingScan.requestId) {
      return;
    }
    processedAiScanRequestIdRef.current = pendingScan.requestId;

    const scannedProductId = pendingScan.productId;
    const rawResponse = aiScanFetcher.data;

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
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics,
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
    };

    if (!rawResponse || typeof rawResponse !== "object") {
      recordFailedScan("AI Scan failed: no structured response returned by /app/meta-injector-autofill.");
      return;
    }

    const returnedRequestId = rawResponse.requestId || null;
    const returnedPieceId = rawResponse.pieceId || rawResponse.productId || null;

    if (returnedRequestId !== pendingScan.requestId || returnedPieceId !== scannedProductId) {
      recordFailedScan(
        `Ignored mismatched or stale AI Scan response (expected product ${scannedProductId} / request ${pendingScan.requestId}, got product ${String(
          returnedPieceId
        )} / request ${String(returnedRequestId)}).`
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

    const targetBaseline = baselineByProductRef.current[scannedProductId] || null;
    const existingProdProposals = { ...(proposedByProductRef.current[scannedProductId] || {}) };
    const existingProdApprovals = approvalsByProductRef.current[scannedProductId] || {};
    const existingProdKeepOriginal = keepOriginalByProductRef.current[scannedProductId] || {};
    const nextAiAlternativesForProd = {};
    const proposalsByDestination = {};

    let receivedCount = 0;
    let stagedCount = 0;
    let heldConflictCount = 0;
    let unchangedSkippedCount = 0;
    let rejectedInvalidCount = 0;
    let ignoredManualOnlyCount = 0;
    const details = [];

    for (const [destKey, entry] of Object.entries(rawProducerProposals)) {
      if (CANCELLED_INERT_DESTINATIONS.has(destKey)) {
        continue;
      }

      const contract = getFieldContractByDestination(destKey);
      const rawValue =
        entry && typeof entry === "object" && typeof entry.value === "string"
          ? entry.value
          : "";
      const reportedSource =
        entry &&
        typeof entry === "object" &&
        typeof entry.source === "string" &&
        entry.source.trim() !== ""
          ? entry.source.trim()
          : "Source not reported";

      if (rawValue.trim() === "") {
        continue;
      }

      if (isManualOnlyNoAiDestination(destKey, contract)) {
        ignoredManualOnlyCount++;
        const manualReason =
          contract?.drawerId === "manual_measurements"
            ? "Manual measurement field — excluded from AI staging; enter physical measurement manually."
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

      const validation = validateBatch1ProposedValue({
        productId: scannedProductId,
        destinationKey: destKey,
        proposedValue: rawValue,
        baselineSnapshot: targetBaseline
      });

      if (!validation.valid) {
        rejectedInvalidCount++;
        proposalsByDestination[destKey] = {
          value: rawValue,
          source: reportedSource,
          disposition: "Rejected (invalid)",
          reason: validation.reason
        };
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

      const existingDraft = existingProdProposals[destKey];
      const existingDraftVal =
        existingDraft && typeof existingDraft === "object"
          ? existingDraft.value
          : typeof existingDraft === "string"
            ? existingDraft
            : "";
      const hasExistingDraft = Boolean(existingDraft && existingDraftVal.trim() !== "");
      const isManualDraft = Boolean(
        hasExistingDraft &&
          (typeof existingDraft !== "object" || existingDraft.origin !== "AI")
      );

      const approvalRec = existingProdApprovals[destKey] || null;
      const hasValidApproval =
        hasExistingDraft &&
        isExactValueApprovalValid({
          approvalRecord: approvalRec,
          productId: scannedProductId,
          destinationKey: destKey,
          currentProposedValue: existingDraftVal,
          baselineSnapshot: targetBaseline
        });

      const keepOrigRec = existingProdKeepOriginal[destKey] || null;
      const hasValidKeepOriginal =
        hasExistingDraft &&
        isKeepOriginalRecordValid({
          keepOriginalRecord: keepOrigRec,
          productId: scannedProductId,
          destinationKey: destKey,
          currentProposedValue: existingDraftVal,
          baselineSnapshot: targetBaseline
        });

      const hasProtectedHumanState =
        isManualDraft || hasValidApproval || hasValidKeepOriginal;

      if (hasProtectedHumanState) {
        if (existingDraftVal === validation.normalizedValue && !hasValidKeepOriginal) {
          proposalsByDestination[destKey] = {
            value: validation.normalizedValue,
            source: reportedSource,
            disposition: "Matches current draft"
          };
          details.push(
            `[${destKey}] AI suggestion matches your current draft ("${validation.normalizedValue}") — Source: ${reportedSource}.`
          );
          continue;
        }
        heldConflictCount++;
        nextAiAlternativesForProd[destKey] = {
          value: validation.normalizedValue,
          source: reportedSource,
          requestId: pendingScan.requestId,
          receivedAt: new Date().toISOString()
        };
        proposalsByDestination[destKey] = {
          value: validation.normalizedValue,
          source: reportedSource,
          disposition: "Held as separate AI alternative"
        };
        details.push(
          `[${destKey}] Held AI alternative "${validation.normalizedValue}" (Source: ${reportedSource}) without overwriting your current draft or decision.`
        );
        continue;
      }

      existingProdProposals[destKey] = {
        value: validation.normalizedValue,
        source: reportedSource,
        origin: "AI",
        updatedAt: new Date().toISOString()
      };
      stagedCount++;
      proposalsByDestination[destKey] = {
        value: validation.normalizedValue,
        source: reportedSource,
        disposition: "Staged as unapproved AI draft"
      };
      details.push(
        `[${destKey}] Staged unapproved AI draft "${validation.normalizedValue}" (Source: ${reportedSource}).`
      );
    }

    setProposedByProduct((prev) => ({
      ...prev,
      [scannedProductId]: existingProdProposals
    }));

    setAiAlternativesByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        ...(prev[scannedProductId] || {}),
        ...nextAiAlternativesForProd
      }
    }));

    const diagnosticsObj =
      rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
        ? rawResponse.producerDiagnostics
        : {};

    const manualIgnoredNote =
      ignoredManualOnlyCount > 0
        ? `, ${ignoredManualOnlyCount} manual-only suggestion${
            ignoredManualOnlyCount === 1 ? "" : "s"
          } ignored`
        : "";

    setLastAiScanReportByProduct((prev) => ({
      ...prev,
      [scannedProductId]: {
        requestId: pendingScan.requestId,
        productId: scannedProductId,
        completedAt: new Date().toISOString(),
        ok: true,
        summary: `AI Scan complete: ${receivedCount} eligible suggestion${
          receivedCount === 1 ? "" : "s"
        } received (${stagedCount} staged as unapproved drafts, ${heldConflictCount} held as alternatives alongside your existing edits, ${unchangedSkippedCount} matched saved baseline${manualIgnoredNote}).`,
        receivedCount,
        stagedCount,
        heldConflictCount,
        unchangedSkippedCount,
        rejectedInvalidCount,
        ignoredManualOnlyCount,
        diagnostics: diagnosticsObj,
        details,
        proposalsByDestination
      }
    }));

    setActiveAiScanRequest(null);
  }, [aiScanFetcher.state, aiScanFetcher.data]);

  const handleAcceptAiAlternative = (destinationKey) => {
    setClientPrevalidationBanner(null);
    const altEntry = currentAiAlternativesMap[destinationKey];
    if (!altEntry || typeof altEntry.value !== "string") return;

    const contract = getFieldContractByDestination(destinationKey);
    if (isManualOnlyNoAiDestination(destinationKey, contract)) {
      return;
    }

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: altEntry.value,
        source:
          typeof altEntry.source === "string" && altEntry.source.trim() !== ""
            ? altEntry.source.trim()
            : "Source not reported",
        origin: "AI",
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

  useEffect(() => {
    if (writerFetcher.state !== "idle") return;
    const pendingSub = activeSaveSubmissionRef.current;
    if (!pendingSub) return;

    const rawResponse = writerFetcher.data;
    if (processedSubmissionIdRef.current === pendingSub.submissionId) {
      return;
    }

    processedSubmissionIdRef.current = pendingSub.submissionId;

    const submittedProductId = pendingSub.productId;
    const submittedVariantTargetId = pendingSub.variantTargetId || null;
    const submittedDestinations = pendingSub.submittedDestinations || [];
    const submittedValuesByDest = pendingSub.submittedValuesByDestination || {};

    if (!rawResponse || typeof rawResponse !== "object") {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        variantTargetId: submittedVariantTargetId,
        completedAt: new Date().toISOString(),
        overallOutcome: "UNCONFIRMED_NETWORK_OR_SERVER_FAILURE",
        writerStatus: "NO_RESPONSE_PAYLOAD",
        message:
          "The save request ended without a response. Do not assume zero writes occurred. Reloading live data from Shopify to check what was saved.",
        submittedDestinations,
        verifiedDestinations: [],
        blockedFields: {},
        skippedKeys: [],
        unsupportedKeys: [],
        unchanged: [],
        unresolvedChanges: {},
        conflicts: {},
        errors: [{ message: "No structured response returned by writer endpoint." }],
        unconfirmedDestinations: [...submittedDestinations],
        readBackVerified: false
      });
      setActiveSaveSubmission(null);
      revalidator.revalidate();
      return;
    }

    const responsePieceId = rawResponse.pieceId || rawResponse.productId || null;
    if (responsePieceId && responsePieceId !== submittedProductId) {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
        variantTargetId: submittedVariantTargetId,
        completedAt: new Date().toISOString(),
        overallOutcome: "MISMATCHED_PRODUCT_RESPONSE_IGNORED",
        writerStatus: String(rawResponse.status || "MISMATCH"),
        message: `Writer response pieceId (${responsePieceId}) did not match submitted productId (${submittedProductId}). Keeping all drafts and reloading live baseline.`,
        submittedDestinations,
        verifiedDestinations: [],
        blockedFields: {},
        skippedKeys: [],
        unsupportedKeys: [],
        unchanged: [],
        unresolvedChanges: {},
        conflicts: {},
        errors: Array.isArray(rawResponse.errors) ? rawResponse.errors : [],
        unconfirmedDestinations: [...submittedDestinations],
        readBackVerified: false
      });
      setActiveSaveSubmission(null);
      revalidator.revalidate();
      return;
    }

    const verifiedList = Array.isArray(rawResponse.verifiedDestinations)
      ? rawResponse.verifiedDestinations
      : [];
    const verifiedSet = new Set(verifiedList);
    const blockedFields =
      rawResponse.blockedFields && typeof rawResponse.blockedFields === "object"
        ? rawResponse.blockedFields
        : {};
    const skippedKeys = Array.isArray(rawResponse.skippedKeys) ? rawResponse.skippedKeys : [];
    const unsupportedKeys = Array.isArray(rawResponse.unsupportedKeys)
      ? rawResponse.unsupportedKeys
      : [];
    const unchangedList = Array.isArray(rawResponse.unchanged) ? rawResponse.unchanged : [];
    const unresolvedChanges =
      rawResponse.unresolvedChanges && typeof rawResponse.unresolvedChanges === "object"
        ? rawResponse.unresolvedChanges
        : {};
    const conflicts =
      rawResponse.conflicts && typeof rawResponse.conflicts === "object"
        ? rawResponse.conflicts
        : {};
    const errorsList = Array.isArray(rawResponse.errors)
      ? rawResponse.errors
      : rawResponse.error
        ? [{ message: String(rawResponse.error) }]
        : [];
    const readBackVerified = rawResponse.readBackVerified === true;
    const responseVariantTarget =
      rawResponse.primaryVariantId || rawResponse.variantTarget || null;

    const unconfirmedDestinations = submittedDestinations.filter(
      (dest) =>
        !verifiedSet.has(dest) &&
        !Object.prototype.hasOwnProperty.call(blockedFields, dest) &&
        !skippedKeys.includes(dest) &&
        !unsupportedKeys.includes(dest) &&
        !unchangedList.includes(dest)
    );

    const hasReturnedProductMetafields = Boolean(
      rawResponse.currentMetafields &&
      typeof rawResponse.currentMetafields === "object" &&
      !Array.isArray(rawResponse.currentMetafields)
    );
    const hasReturnedVariantMetafields = Boolean(
      rawResponse.currentVariantMetafields &&
      typeof rawResponse.currentVariantMetafields === "object" &&
      !Array.isArray(rawResponse.currentVariantMetafields) &&
      rawResponse.variantMetafieldsReadComplete === true &&
      submittedVariantTargetId &&
      responseVariantTarget === submittedVariantTargetId
    );

    if (hasReturnedProductMetafields || hasReturnedVariantMetafields) {
      setBaselineByProduct((prev) => {
        const existingSnap = prev[submittedProductId];
        if (!existingSnap || existingSnap.productId !== submittedProductId) return prev;

        const updatedMetafields = { ...(existingSnap.currentMetafields || {}) };
        const updatedTypes = { ...(existingSnap.currentMetafieldTypes || {}) };

        let updatedVariantMetafields = existingSnap.currentVariantMetafields
          ? { ...existingSnap.currentVariantMetafields }
          : null;
        let updatedVariantTypes = existingSnap.currentVariantMetafieldTypes
          ? { ...existingSnap.currentVariantMetafieldTypes }
          : null;
        let updatedVariantIds = existingSnap.currentVariantMetafieldIds
          ? { ...existingSnap.currentVariantMetafieldIds }
          : null;
        let nextVariantReadComplete = existingSnap.variantMetafieldsReadComplete === true;

        for (const vDest of verifiedList) {
          const contract = getFieldContractByDestination(vDest);
          const isVariantDest =
            contract?.owner === "PRODUCTVARIANT" ||
            BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);

          if (isVariantDest) {
            if (
              hasReturnedVariantMetafields &&
              existingSnap.primaryVariantId === submittedVariantTargetId &&
              Object.prototype.hasOwnProperty.call(rawResponse.currentVariantMetafields, vDest)
            ) {
              if (!updatedVariantMetafields) updatedVariantMetafields = {};
              if (!updatedVariantTypes) updatedVariantTypes = {};
              updatedVariantMetafields[vDest] = rawResponse.currentVariantMetafields[vDest];
              const returnedVarType =
                rawResponse.currentVariantMetafieldTypes?.[vDest] ||
                existingSnap.liveVariantDefinitions?.[vDest]?.type ||
                null;
              if (returnedVarType) {
                updatedVariantTypes[vDest] = returnedVarType;
              }
              if (
                rawResponse.currentVariantMetafieldIds &&
                typeof rawResponse.currentVariantMetafieldIds === "object" &&
                rawResponse.currentVariantMetafieldIds[vDest]
              ) {
                if (!updatedVariantIds) updatedVariantIds = {};
                updatedVariantIds[vDest] = rawResponse.currentVariantMetafieldIds[vDest];
              }
              nextVariantReadComplete = rawResponse.variantMetafieldsReadComplete === true;
            }
          } else if (
            hasReturnedProductMetafields &&
            Object.prototype.hasOwnProperty.call(rawResponse.currentMetafields, vDest)
          ) {
            updatedMetafields[vDest] = rawResponse.currentMetafields[vDest];
            const returnedProdType =
              rawResponse.currentMetafieldTypes?.[vDest] ||
              existingSnap.liveDefinitions?.[vDest]?.type ||
              null;
            if (!updatedTypes[vDest] && returnedProdType) {
              updatedTypes[vDest] = returnedProdType;
            }
          }
        }

        return {
          ...prev,
          [submittedProductId]: {
            ...existingSnap,
            currentMetafields: updatedMetafields,
            currentMetafieldTypes: updatedTypes,
            currentVariantMetafields: updatedVariantMetafields,
            currentVariantMetafieldTypes: updatedVariantTypes,
            currentVariantMetafieldIds: updatedVariantIds,
            variantMetafieldsReadComplete: nextVariantReadComplete,
            loadedAt: new Date().toISOString()
          }
        };
      });
    }

    if (verifiedSet.size > 0) {
      const canClearVerifiedDest = (vDest) => {
        const contract = getFieldContractByDestination(vDest);
        const isVariantDest =
          contract?.owner === "PRODUCTVARIANT" ||
          BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(vDest);
        if (isVariantDest) {
          return Boolean(
            submittedVariantTargetId &&
            responseVariantTarget === submittedVariantTargetId &&
            rawResponse.variantMetafieldsReadComplete === true
          );
        }
        return true;
      };

      setProposedByProduct((prev) => {
        const prodMap = { ...(prev[submittedProductId] || {}) };
        for (const vDest of verifiedSet) {
          if (!canClearVerifiedDest(vDest)) continue;
          const currentEntry = prodMap[vDest];
          const currentVal =
            currentEntry && typeof currentEntry === "object"
              ? currentEntry.value
              : currentEntry;
          if (currentVal === submittedValuesByDest[vDest]) {
            delete prodMap[vDest];
          }
        }
        return { ...prev, [submittedProductId]: prodMap };
      });

      setApprovalsByProduct((prev) => {
        const prodApprovals = { ...(prev[submittedProductId] || {}) };
        for (const vDest of verifiedSet) {
          if (!canClearVerifiedDest(vDest)) continue;
          const rec = prodApprovals[vDest];
          if (rec && rec.approvedValue === submittedValuesByDest[vDest]) {
            delete prodApprovals[vDest];
          }
        }
        return { ...prev, [submittedProductId]: prodApprovals };
      });
    }

    setLastSaveReport({
      submissionId: pendingSub.submissionId,
      productId: submittedProductId,
      variantTargetId: submittedVariantTargetId,
      responseVariantTarget,
      completedAt: new Date().toISOString(),
      overallOutcome:
        rawResponse.success === true &&
        rawResponse.status === "REPAIRED" &&
        readBackVerified &&
        unconfirmedDestinations.length === 0
          ? "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
          : verifiedList.length > 0
            ? "PARTIAL_OR_UNRESOLVED_WRITE_OUTCOME"
            : "WRITE_FAILED_OR_BLOCKED",
      writerStatus: String(rawResponse.status || (rawResponse.success ? "OK" : "FAILED")),
      message:
        rawResponse.message ||
        rawResponse.error ||
        "Save finished. Review the field results below.",
      submittedDestinations,
      submittedValuesByDestination: submittedValuesByDest,
      verifiedDestinations: verifiedList,
      blockedFields,
      skippedKeys,
      unsupportedKeys,
      unchanged: unchangedList,
      unresolvedChanges,
      conflicts,
      errors: errorsList,
      unconfirmedDestinations,
      readBackVerified
    });

    setActiveSaveSubmission(null);
    revalidator.revalidate();
  }, [writerFetcher.state, writerFetcher.data, revalidator]);

  const handleManualProposalChange = (destinationKey, rawNewValue) => {
    setClientPrevalidationBanner(null);
    const exactString = typeof rawNewValue === "string" ? rawNewValue : String(rawNewValue ?? "");

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactString,
        source: "Manual",
        origin: "Manual",
        updatedAt: new Date().toISOString()
      };
      return { ...prev, [activeProductId]: prodMap };
    });

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
  };

  const handleClearDraftProposal = (destinationKey) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    clearDecisionForDestination(setProposedByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
  };

  const handleToggleApproval = (destinationKey, currentlyApproved) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyApproved) {
      clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);
      return;
    }

    const rawEntry = currentProposedMap[destinationKey];
    const exactProposedValue =
      rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
        ? rawEntry.value
        : typeof rawEntry === "string"
          ? rawEntry
          : "";

    const fidelity = checkExistingWriterStringFidelity(exactProposedValue);
    if (!fidelity.faithful) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot approve ${destinationKey} yet`,
        reasons: [fidelity.reason]
      });
      return;
    }

    const created = createExactValueApprovalRecord({
      productId: activeProductId,
      destinationKey,
      proposedValue: exactProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!created.ok || !created.record) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot approve ${destinationKey}`,
        reasons: [created.error || "Proposal failed validation."]
      });
      return;
    }

    clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);

    setApprovalsByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  const handleToggleKeepOriginal = (destinationKey, currentlyKeepOriginal) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyKeepOriginal) {
      clearDecisionForDestination(setKeepOriginalByProduct, activeProductId, destinationKey);
      return;
    }

    const rawEntry = currentProposedMap[destinationKey];
    const exactProposedValue =
      rawEntry && typeof rawEntry === "object" && typeof rawEntry.value === "string"
        ? rawEntry.value
        : typeof rawEntry === "string"
          ? rawEntry
          : "";

    const created = createKeepOriginalRecord({
      productId: activeProductId,
      destinationKey,
      rejectedProposedValue: exactProposedValue,
      baselineSnapshot: currentBaseline
    });

    if (!created.ok || !created.record) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Cannot mark Keep Original for ${destinationKey}`,
        reasons: [created.error || "Cannot bind Keep Original record."]
      });
      return;
    }

    clearDecisionForDestination(setApprovalsByProduct, activeProductId, destinationKey);

    setKeepOriginalByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  const activeRetainedEditorsMap = retainedFieldEditorsByProduct[activeProductId] || {};
  const activeSaveReportForCurrentProduct =
    lastSaveReport && lastSaveReport.productId === activeProductId ? lastSaveReport : null;

  const evaluatedDrawerGroups = BENCH_V2_DRAWER_GROUPS.map((drawer) => {
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

      const effectiveConnectionStatus = baseEval.connectionStatus;
      let effectiveReviewStatus = baseEval.reviewStatus;
      let effectiveStatusReason = baseEval.statusReason;

      if (
        fieldContract.isWritableInBatch1 &&
        baseEval.hasProposalKey &&
        baseEval.validation?.valid &&
        !fidelityCheck.faithful
      ) {
        effectiveReviewStatus = "Blocked Proposal (Writer Trim/Prefix Fidelity)";
        effectiveStatusReason = fidelityCheck.reason;
      }

      const enrichedRow = {
        ...baseEval,
        proposalOrigin,
        heldAiAlternative,
        scanProposalMeta,
        hasSaveErrorOrConflict,
        fidelityCheck,
        effectiveConnectionStatus,
        effectiveReviewStatus,
        effectiveStatusReason
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

  const hasBaselineErrors = Boolean(
    loaderData?.selectionError ||
      pickerPageState?.error ||
      loaderData?.loadError ||
      (Array.isArray(currentBaseline?.errors) && currentBaseline.errors.length > 0) ||
      currentBaseline?.metafieldsReadComplete !== true ||
      currentBaseline?.defsReadComplete !== true
  );

  // ==========================================================================
  // SIDEKICK LIVE BENCH SNAPSHOT BUILDER & SINGLE-FLIGHT PUBLISHER
  // ==========================================================================
  const drainTelemetryPublishQueue = useCallback(async () => {
    if (isTelemetrySendInFlightRef.current) return;
    isTelemetrySendInFlightRef.current = true;

    try {
      while (latestQueuedSnapshotSpecRef.current && isMountedRef.current) {
        const spec = latestQueuedSnapshotSpecRef.current;
        latestQueuedSnapshotSpecRef.current = null;

        let nextRevision = Math.max(1, benchRevisionRef.current + 1);
        benchRevisionRef.current = nextRevision;

        const attemptPublishWithRevision = async (revisionToUse) => {
          const fullSnapshotObj = {
            ...spec.snapshotBodyWithoutRevision,
            benchSessionId: spec.benchSessionId,
            benchRevision: revisionToUse,
            selectionState: spec.selectionState,
            productId: spec.productId,
            baselineLoadedAt: spec.baselineLoadedAt,
            clientStateChangedAt: spec.clientStateChangedAt
          };

          const fullText = JSON.stringify(fullSnapshotObj);
          const fullTextCodeUnits = fullText.length;
          const fullTextUtf8Bytes = measureUtf8BytesClient(fullText);

          if (
            fullTextCodeUnits > TELEMETRY_MAX_FULL_TEXT_CODE_UNITS ||
            fullTextUtf8Bytes > TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES
          ) {
            return {
              localOversize: true,
              message: `Snapshot payload (${fullTextUtf8Bytes} UTF-8 bytes / ${fullTextCodeUnits} chars) exceeds cache limit (${TELEMETRY_MAX_FULL_TEXT_CODE_UNITS} chars / ${TELEMETRY_MAX_FULL_TEXT_UTF8_BYTES} bytes); refused to clip or truncate.`
            };
          }

          const postEnvelope = {
            packet: {
              productId: spec.productId,
              productTitle: spec.productTitle,
              mode: TELEMETRY_LIVE_BENCH_MODE,
              sectionKey: TELEMETRY_LIVE_BENCH_MODE,
              sectionLabel: "LIVE BENCH FIELD STATE",
              runIdentity: spec.runIdentity,
              runTimestamp: spec.runTimestamp,
              capturedAt: spec.clientStateChangedAt,
              benchSessionId: spec.benchSessionId,
              benchRevision: revisionToUse,
              selectionState: spec.selectionState,
              baselineLoadedAt: spec.baselineLoadedAt,
              fullText
            },
            uiAudit: null,
            liveState: {
              mode: TELEMETRY_LIVE_BENCH_MODE,
              benchSessionId: spec.benchSessionId,
              benchRevision: revisionToUse,
              selectionState: spec.selectionState,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              baselineLoadedAt: spec.baselineLoadedAt
            }
          };

          const serializedEnvelope = JSON.stringify(postEnvelope);
          const envelopeBytes = measureUtf8BytesClient(serializedEnvelope);
          if (envelopeBytes > TELEMETRY_MAX_POST_BODY_BYTES) {
            return {
              localOversize: true,
              message: `POST body (${envelopeBytes} bytes) exceeds ${TELEMETRY_MAX_POST_BODY_BYTES}-byte endpoint limit; refused to clip.`
            };
          }

          const response = await fetch(TELEMETRY_ENDPOINT_PATH, {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: serializedEnvelope
          });

          const contentType = response.headers.get("content-type") || "";
          let parsedJson = null;
          if (contentType.toLowerCase().includes("application/json")) {
            try {
              parsedJson = await response.json();
            } catch {
              parsedJson = null;
            }
          }

          return {
            localOversize: false,
            httpStatus: response.status,
            redirected: response.redirected,
            parsedJson
          };
        };

        if (isMountedRef.current) {
          setTelemetrySyncStatus((prev) => ({
            ...prev,
            state: "syncing",
            benchRevision: nextRevision,
            productId: spec.productId,
            clientStateChangedAt: spec.clientStateChangedAt,
            errorCode: null,
            message: `Publishing revision ${nextRevision} to Sidekick cache...`
          }));
        }

        try {
          let result = await attemptPublishWithRevision(nextRevision);

          if (
            !result.localOversize &&
            result.httpStatus === 409 &&
            result.parsedJson?.code === "stale_bench_revision" &&
            typeof result.parsedJson?.highestRevision === "number" &&
            Number.isSafeInteger(result.parsedJson.highestRevision) &&
            !latestQueuedSnapshotSpecRef.current &&
            isMountedRef.current
          ) {
            nextRevision = result.parsedJson.highestRevision + 1;
            benchRevisionRef.current = nextRevision;
            result = await attemptPublishWithRevision(nextRevision);
          }

          if (!isMountedRef.current) break;

          if (result.localOversize) {
            setTelemetrySyncStatus({
              state: "error",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt: null,
              errorCode: "payload_too_large_unclipped",
              message: result.message
            });
            continue;
          }

          const { httpStatus, redirected, parsedJson } = result;
          if ((httpStatus === 200 || httpStatus === 201) && parsedJson?.ok === true) {
            const reportMeta = parsedJson.report || null;
            const sessionMeta = parsedJson.liveSession || null;
            setTelemetrySyncStatus({
              state: "stored",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: reportMeta?.reportId || sessionMeta?.activeReportId || null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt:
                reportMeta?.serverReceivedAt ||
                reportMeta?.storedAt ||
                sessionMeta?.serverReceivedAt ||
                null,
              errorCode: null,
              message: `Revision ${nextRevision} stored in process memory cache (volatile across server restarts or separate workers).`
            });
          } else {
            const errCode =
              parsedJson?.code ||
              (redirected || httpStatus === 401 || httpStatus === 403
                ? "auth_or_origin_rejected"
                : `http_${httpStatus}`);
            const errMsg =
              parsedJson?.message ||
              (redirected
                ? "Telemetry POST was redirected (session authentication required)."
                : `Telemetry POST returned HTTP ${httpStatus}.`);
            setTelemetrySyncStatus({
              state: "error",
              benchSessionId: spec.benchSessionId,
              benchRevision: nextRevision,
              reportId: null,
              productId: spec.productId,
              clientStateChangedAt: spec.clientStateChangedAt,
              serverReceivedAt: null,
              errorCode: errCode,
              message: errMsg
            });
          }
        } catch (networkErr) {
          if (!isMountedRef.current) break;
          setTelemetrySyncStatus({
            state: "error",
            benchSessionId: spec.benchSessionId,
            benchRevision: nextRevision,
            reportId: null,
            productId: spec.productId,
            clientStateChangedAt: spec.clientStateChangedAt,
            serverReceivedAt: null,
            errorCode: "network_error",
            message: `Telemetry sync request failed: ${networkErr?.message || "Network error"}`
          });
        }
      }
    } finally {
      isTelemetrySendInFlightRef.current = false;
      if (latestQueuedSnapshotSpecRef.current && isMountedRef.current) {
        drainTelemetryPublishQueue();
      }
    }
  }, []);

  useEffect(() => {
    if (isSwitchingSelectedProduct) {
      return;
    }

    if (!isExactProductGid(activeProductId)) {
      return;
    }

    const hasMatchedBaseline = Boolean(
      currentBaseline && currentBaseline.productId === activeProductId
    );
    const isManifestFullyLoaded = Boolean(
      hasMatchedBaseline &&
        currentBaseline.metafieldsReadComplete === true &&
        currentBaseline.defsReadComplete === true
    );
    const baselineLoadedAt =
      hasMatchedBaseline &&
      typeof currentBaseline.loadedAt === "string" &&
      currentBaseline.loadedAt.trim() !== ""
        ? currentBaseline.loadedAt.trim()
        : null;

    const baselineState = !hasMatchedBaseline
      ? "not_loaded"
      : isManifestFullyLoaded
        ? "complete"
        : "incomplete_read";

    const baselineEventKind = isBaselineReloading
      ? "reloading"
      : isWriterBusy
        ? "saving"
        : isAiScanBusy
          ? "ai_scanning"
          : "idle";

    const orderedEvents = resolveActualEventOrdering(
      currentAiScanReport,
      activeSaveReportForCurrentProduct
    );

    const fieldsByKey = {};
    const sectionOrder = [];

    for (let dIdx = 0; dIdx < evaluatedDrawerGroups.length; dIdx += 1) {
      const drawer = evaluatedDrawerGroups[dIdx];
      const sectionTitle = PLAIN_DRAWER_TITLES[drawer.drawerId] || drawer.heading;
      const drawerFieldKeys = [];

      for (let rIdx = 0; rIdx < drawer.evaluatedRows.length; rIdx += 1) {
        const row = drawer.evaluatedRows[rIdx];
        const {
          contract,
          baselineObservation: obs,
          baselineDisplayValue,
          hasProposalKey,
          proposedValue,
          proposedDisplayValue,
          proposalSource,
          proposalOrigin,
          heldAiAlternative,
          scanProposalMeta,
          validation,
          isApproved,
          isKeepOriginal,
          fidelityCheck,
          hasSaveErrorOrConflict,
          effectiveConnectionStatus,
          effectiveReviewStatus,
          effectiveStatusReason
        } = row;

        const destKey = contract.destinationKey;
        drawerFieldKeys.push(destKey);

        const regMeta = resolveFieldRegistryAndApplicabilityMeta(contract);
        const isMediaCapabilityDescriptor = destKey === "native_image_alt";
        const usesMeaningDisplay = Boolean(contract.usesYesNoMeaningDisplay);

        const rawBaselineExists =
          obs.evidenceAvailable &&
          obs.presence === "present" &&
          obs.rawValue !== undefined &&
          obs.rawValue !== null &&
          String(obs.rawValue) !== "";

        const canKeepOriginal = Boolean(
          contract.isWritableInBatch1 &&
            hasProposalKey &&
            obs.evidenceAvailable &&
            proposedValue.trim() !== "" &&
            !(obs.presence === "present" && obs.rawValue === proposedValue)
        );

        const isExplicitlyApprovedValid = Boolean(
          isApproved && fidelityCheck.faithful
        );

        const isActualBlockedProposal = Boolean(
          hasProposalKey &&
            (!validation?.valid || !fidelityCheck.faithful)
        );

        const hasTechnicalBlock = Boolean(
          !obs.evidenceAvailable ||
            obs.metafieldsCompleteState !== "complete" ||
            obs.defsCompleteState !== "complete" ||
            Boolean(obs.destinationDefError) ||
            (contract.isWritableInBatch1 &&
              ((!obs.liveDefType && !obs.storedType) ||
                (obs.liveDefType &&
                  obs.storedType &&
                  obs.liveDefType !== obs.storedType)))
        );

        const hasContractOrOwnerHold = Boolean(!contract.isWritableInBatch1);

        let mappedFieldStatus = "Unchanged";
        if (!obs.evidenceAvailable) {
          if (obs.presence === "unknown_incomplete_read") {
            mappedFieldStatus = "Incomplete Read";
          } else if (
            obs.presence === "multiple_variants_hold" ||
            obs.presence === "zero_variants_hold"
          ) {
            mappedFieldStatus = "Held (Variant Target)";
          } else {
            mappedFieldStatus = "Baseline Not Loaded";
          }
        } else if (hasSaveErrorOrConflict) {
          const isBlockedInSave = Boolean(
            activeSaveReportForCurrentProduct?.blockedFields &&
              Object.prototype.hasOwnProperty.call(
                activeSaveReportForCurrentProduct.blockedFields,
                destKey
              )
          );
          mappedFieldStatus = isBlockedInSave ? "API Error / Blocked" : "Save Conflict";
        } else if (isKeepOriginal) {
          mappedFieldStatus = "Keep original (suggestion rejected)";
        } else if (
          isApproved &&
          (!fidelityCheck.faithful || !validation?.valid)
        ) {
          mappedFieldStatus = "Approved, blocked";
        } else if (isExplicitlyApprovedValid) {
          mappedFieldStatus = "Approved, not saved";
        } else if (isActualBlockedProposal) {
          mappedFieldStatus =
            validation?.code === "exceeds_max_length"
              ? "Over limit"
              : "API Error / Blocked";
        } else if (hasProposalKey && !validation?.isUnchangedFromStored) {
          mappedFieldStatus = "Proposed";
        } else if (
          !regMeta.isParkedExcluded &&
          !regMeta.isProtectedAppData &&
          obs.evidenceAvailable &&
          (obs.presence === "absent" ||
            obs.presence === "null" ||
            obs.presence === "empty_string") &&
          (destKey === "native_title" || destKey === "native_price")
        ) {
          mappedFieldStatus = "Required missing";
        }

        const proposalStatus = !hasProposalKey
          ? "none"
          : isKeepOriginal
            ? "rejected_keep_original"
            : isActualBlockedProposal
              ? "blocked"
              : validation?.isUnchangedFromStored
                ? "unchanged"
                : "proposed";

        const contentNeedsReview = Boolean(
          !regMeta.isParkedExcluded &&
            !regMeta.isProtectedAppData &&
            !isKeepOriginal &&
            ((hasProposalKey &&
              !isExplicitlyApprovedValid &&
              !validation?.isUnchangedFromStored) ||
              Boolean(heldAiAlternative) ||
              hasSaveErrorOrConflict)
        );

        const reasonsList = [];
        if (effectiveStatusReason) reasonsList.push(effectiveStatusReason);
        if (hasProposalKey && validation && !validation.valid && validation.reason) {
          if (!reasonsList.includes(validation.reason)) {
            reasonsList.push(validation.reason);
          }
        }
        if (hasProposalKey && !fidelityCheck.faithful && fidelityCheck.reason) {
          if (!reasonsList.includes(fidelityCheck.reason)) {
            reasonsList.push(fidelityCheck.reason);
          }
        }

        const saveConflictEntry =
          activeSaveReportForCurrentProduct?.conflicts?.[destKey] ||
          activeSaveReportForCurrentProduct?.unresolvedChanges?.[destKey] ||
          null;

        const combinedConflictData =
          heldAiAlternative && saveConflictEntry
            ? {
                heldAiAlternative,
                saveConflict: saveConflictEntry
              }
            : heldAiAlternative
              ? {
                  kind: "held_ai_alternative",
                  ...heldAiAlternative
                }
              : saveConflictEntry || null;

        const rawValueToStore = obs.rawValue !== undefined ? obs.rawValue : null;
        const readableBaselineStr =
          typeof baselineDisplayValue === "string" && baselineDisplayValue !== ""
            ? baselineDisplayValue
            : formatReadableSavedValue(obs, usesMeaningDisplay, baselineDisplayValue);

        const rawStoredBaselineObj = {
          evidenceAvailable: obs.evidenceAvailable,
          exists: rawBaselineExists,
          presence: obs.presence,
          value: rawValueToStore,
          ...(obs.variantId ? { variantId: obs.variantId } : {}),
          ...(obs.variantTargetStatus
            ? { variantTargetStatus: obs.variantTargetStatus }
            : {}),
          ...(obs.storedType ? { storedType: obs.storedType } : {}),
          ...(obs.liveDefType ? { liveDefType: obs.liveDefType } : {}),
          ...(obs.metafieldsCompleteState !== "complete"
            ? { metafieldsCompleteState: obs.metafieldsCompleteState }
            : {}),
          ...(obs.defsCompleteState !== "complete"
            ? { defsCompleteState: obs.defsCompleteState }
            : {}),
          ...(obs.destinationDefError
            ? { destinationDefError: obs.destinationDefError }
            : {})
        };

        const evaluatedBaselineObj = {
          currentExists: rawBaselineExists,
          ...(readableBaselineStr !== rawValueToStore
            ? { displayValue: readableBaselineStr }
            : {}),
          ...(usesMeaningDisplay ? { usesYesNoMeaningDisplay: true } : {}),
          ...(isMediaCapabilityDescriptor
            ? { isDisplayOnlyPlaceholderOrNa: true }
            : {})
        };

        const effectiveSource =
          hasProposalKey && proposalSource && proposalSource !== "None"
            ? proposalSource
            : scanProposalMeta?.source || null;

        const workingStateObj = {
          proposalExists: hasProposalKey,
          isProposed: Boolean(
            hasProposalKey && !isKeepOriginal && !validation?.isUnchangedFromStored
          ),
          proposedValue: hasProposalKey ? proposedValue : null,
          ...(hasProposalKey &&
          proposedDisplayValue &&
          proposedDisplayValue !== proposedValue
            ? { proposedDisplayValue }
            : {}),
          ...(proposalStatus !== "none" ? { proposalStatus } : {}),
          ...(effectiveSource ? { source: effectiveSource } : {}),
          ...(proposalOrigin !== "None" ? { origin: proposalOrigin } : {}),
          ...(hasProposalKey && proposalOrigin === "Manual"
            ? { isManualEdit: true }
            : {}),
          ...(isExplicitlyApprovedValid ? { isApproved: true } : {}),
          ...(currentApprovalsMap[destKey]
            ? { approvalRecord: currentApprovalsMap[destKey] }
            : {}),
          ...(isKeepOriginal ? { isKeepOriginal: true } : {}),
          ...(currentKeepOriginalMap[destKey]
            ? { keepOriginalDecision: currentKeepOriginalMap[destKey] }
            : {}),
          ...(canKeepOriginal ? { canKeepOriginal: true } : {}),
          ...(contentNeedsReview ? { contentNeedsReview: true } : {}),
          ...(heldAiAlternative ? { heldAiAlternative } : {}),
          ...(scanProposalMeta ? { lastAiScanOutcome: scanProposalMeta } : {})
        };

        const isVariantOwner =
          contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";
        const isVariantHold =
          isVariantOwner &&
          (!contract.isWritableInBatch1 || !obs.evidenceAvailable);
        const isExplicitStorageHold =
          contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD";
        const isChannelFlagHold =
          contract.destinationKey === "mm-google-shopping.custom_product";

        const statusAndHoldsObj = {
          fieldStatus: mappedFieldStatus,
          connectionStatus: effectiveConnectionStatus,
          ...(effectiveReviewStatus !== "Unchanged"
            ? { reviewStatus: effectiveReviewStatus }
            : {}),
          applicability: regMeta.applicability,
          writeCapability: contract.writeCapability,
          batchStage: contract.batchStage,
          expectedType: contract.expectedType,
          ...(Array.isArray(contract.allowedTypes) &&
          (contract.allowedTypes.length > 1 ||
            contract.allowedTypes[0] !== contract.expectedType)
            ? { allowedTypes: contract.allowedTypes }
            : {}),
          ...(contract.maxLength !== null ? { maxLength: contract.maxLength } : {}),
          ...(contract.canonicalTarget
            ? { canonicalTarget: contract.canonicalTarget }
            : {}),
          ...(regMeta.isParkedExcluded ? { isParkedExcluded: true } : {}),
          ...(regMeta.isProtectedAppData ? { isProtectedAppData: true } : {}),
          ...(isMediaCapabilityDescriptor
            ? { isImageAltCapabilityPlaceholder: true }
            : {}),
          ...(isActualBlockedProposal ? { isActualBlockedProposal: true } : {}),
          ...(hasTechnicalBlock ? { hasTechnicalBlock: true } : {}),
          ...(hasContractOrOwnerHold ? { hasContractOrOwnerHold: true } : {}),
          ...(isExplicitStorageHold ? { hasExplicitStorageHold: true } : {}),
          ...(isVariantHold ? { isVariantMetafieldHold: true } : {}),
          ...(!contract.isWritableInBatch1 ? { isPendingReadOnly: true } : {}),
          ...(isChannelFlagHold ? { isChannelFlagReadOnly: true } : {}),
          ...(reasonsList.length > 0 ? { reasons: reasonsList } : {})
        };

        const wasSubmittedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.submittedDestinations?.includes(destKey)
        );
        const verifiedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.verifiedDestinations?.includes(destKey)
        );
        const blockedInLastRepair =
          activeSaveReportForCurrentProduct?.blockedFields?.[destKey] || null;
        const unconfirmedInLastRepair = Boolean(
          activeSaveReportForCurrentProduct?.unconfirmedDestinations?.includes(destKey)
        );

        const hasAnySaveOrConflictEvidence = Boolean(
          combinedConflictData ||
            wasSubmittedInLastRepair ||
            verifiedInLastRepair ||
            blockedInLastRepair ||
            unconfirmedInLastRepair
        );

        const fieldEntry = {
          key: destKey,
          section: sectionTitle,
          drawerId: contract.drawerId,
          label: cleanFieldHeading(contract.label) || contract.label,
          registryOwner: regMeta.registryOwner,
          ...(obs.variantId ? { variantId: obs.variantId } : {}),
          ...(regMeta.registryIdentity !== destKey
            ? { registryIdentity: regMeta.registryIdentity }
            : {}),
          registryRole: regMeta.registryRole,
          ...(regMeta.isParkedExcluded ? { isParkedExcluded: true } : {}),
          ...(regMeta.isProtectedAppData ? { isProtectedAppData: true } : {}),
          ...(isManualOnlyNoAiDestination(destKey, contract)
            ? { isManualOnlyNoAi: true }
            : {}),
          rawStoredBaseline: rawStoredBaselineObj,
          evaluatedBaseline: evaluatedBaselineObj,
          workingState: workingStateObj,
          statusAndHolds: statusAndHoldsObj,
          ...(hasAnySaveOrConflictEvidence
            ? {
                conflictsAndSaveEvidence: {
                  ...(combinedConflictData ? { conflictData: combinedConflictData } : {}),
                  ...(wasSubmittedInLastRepair ? { wasSubmittedInLastRepair: true } : {}),
                  ...(verifiedInLastRepair ? { verifiedInLastRepair: true } : {}),
                  ...(blockedInLastRepair ? { blockedInLastRepair } : {}),
                  ...(unconfirmedInLastRepair ? { unconfirmedInLastRepair: true } : {})
                }
              }
            : {})
        };

        fieldsByKey[destKey] = fieldEntry;

        if (
          isMediaCapabilityDescriptor &&
          hasMatchedBaseline &&
          Array.isArray(currentBaseline?.nativeTargets?.media?.edges)
        ) {
          const mediaComplete =
            currentBaseline.nativeTargets?.isComplete === true &&
            !currentBaseline.nativeTargets?.loadError &&
            !(
              Array.isArray(currentBaseline.nativeTargets?.unverifiedFields) &&
              currentBaseline.nativeTargets.unverifiedFields.includes("media")
            );
          const mediaEdges = currentBaseline.nativeTargets.media.edges;

          for (let mIdx = 0; mIdx < mediaEdges.length; mIdx += 1) {
            const mediaNode = mediaEdges[mIdx]?.node;
            if (!mediaNode || typeof mediaNode.id !== "string" || !mediaNode.id.trim()) {
              continue;
            }
            const mediaGid = mediaNode.id.trim();
            const mediaKey = `native_image_alts_${mediaGid}`;
            const rawAlt =
              typeof mediaNode.alt === "string" ? mediaNode.alt : "";
            const hasAltText = rawAlt.trim() !== "";

            drawerFieldKeys.push(mediaKey);
            fieldsByKey[mediaKey] = {
              key: mediaKey,
              mediaImageGid: mediaGid,
              photoIndex: mIdx + 1,
              section: sectionTitle,
              drawerId: contract.drawerId,
              label: `Photo ${mIdx + 1} Alt Text (${mediaGid})`,
              registryOwner: "MEDIAIMAGE",
              registryIdentity: "native_image_alt",
              registryRole: "PRIMARY_CANDIDATE_DESTINATION",
              rawStoredBaseline: {
                evidenceAvailable: mediaComplete,
                exists: mediaComplete && hasAltText,
                presence: !mediaComplete
                  ? "unknown_incomplete_read"
                  : hasAltText
                    ? "present"
                    : "empty_string",
                value: mediaComplete ? rawAlt : null,
                storedType: "native_media_alt",
                liveDefType: "native_media_alt"
              },
              evaluatedBaseline: {
                currentExists: mediaComplete && hasAltText,
                ...(!mediaComplete
                  ? { displayValue: "Read incomplete" }
                  : !hasAltText
                    ? { displayValue: "Not set" }
                    : {})
              },
              workingState: {
                proposalExists: false,
                isProposed: false,
                proposedValue: null
              },
              statusAndHolds: {
                fieldStatus: !mediaComplete ? "Incomplete Read" : "Unchanged",
                connectionStatus: "Read-Only Descriptor (FUTURE_BATCH_3_DESCRIPTOR)",
                applicability: "all_products",
                writeCapability: contract.writeCapability,
                batchStage: contract.batchStage,
                expectedType: "single_line_text_field",
                maxLength: 125,
                ...(!mediaComplete ? { hasTechnicalBlock: true } : {}),
                hasContractOrOwnerHold: true,
                isPendingReadOnly: true,
                reasons: [
                  "Per-image media alt writes are scheduled for Future Batch 3; read-only in Batch 1."
                ]
              }
            };
          }
        }
      }

      sectionOrder.push({
        sectionTitle,
        drawerId: drawer.drawerId,
        fieldKeys: drawerFieldKeys
      });
    }

    const manualEditedKeys = allEvaluatedRows
      .filter((r) => r.hasProposalKey && r.proposalOrigin === "Manual")
      .map((r) => r.contract.destinationKey);

    const explicitlyApprovedKeys = validApprovedRows.map(
      (r) => r.contract.destinationKey
    );

    const keepOriginalKeys = keepOriginalRows.map(
      (r) => r.contract.destinationKey
    );

    const saveVerificationEvidence = {
      hasRepairAttemptInSession: Boolean(activeSaveReportForCurrentProduct),
      lastRepairSubmissionId: activeSaveReportForCurrentProduct?.submissionId || null,
      lastRepairVariantTargetId: activeSaveReportForCurrentProduct?.variantTargetId || null,
      lastRepairCompletedAt: activeSaveReportForCurrentProduct?.completedAt || null,
      lastRepairOverallOutcome: activeSaveReportForCurrentProduct?.overallOutcome || null,
      lastRepairStatus: activeSaveReportForCurrentProduct?.writerStatus || null,
      lastRepairMessage: activeSaveReportForCurrentProduct?.message || null,
      lastRepairSuccess: activeSaveReportForCurrentProduct
        ? activeSaveReportForCurrentProduct.overallOutcome ===
          "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
        : null,
      readBackVerified:
        activeSaveReportForCurrentProduct?.readBackVerified !== undefined
          ? activeSaveReportForCurrentProduct.readBackVerified
          : null,
      verifiedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.verifiedDestinations
      )
        ? activeSaveReportForCurrentProduct.verifiedDestinations
        : [],
      attemptedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.submittedDestinations
      )
        ? activeSaveReportForCurrentProduct.submittedDestinations
        : [],
      unconfirmedDestinations: Array.isArray(
        activeSaveReportForCurrentProduct?.unconfirmedDestinations
      )
        ? activeSaveReportForCurrentProduct.unconfirmedDestinations
        : [],
      skippedKeys: Array.isArray(activeSaveReportForCurrentProduct?.skippedKeys)
        ? activeSaveReportForCurrentProduct.skippedKeys
        : [],
      unsupportedKeys: Array.isArray(activeSaveReportForCurrentProduct?.unsupportedKeys)
        ? activeSaveReportForCurrentProduct.unsupportedKeys
        : [],
      unchanged: Array.isArray(activeSaveReportForCurrentProduct?.unchanged)
        ? activeSaveReportForCurrentProduct.unchanged
        : [],
      blockedFields:
        activeSaveReportForCurrentProduct?.blockedFields &&
        typeof activeSaveReportForCurrentProduct.blockedFields === "object"
          ? activeSaveReportForCurrentProduct.blockedFields
          : {},
      conflicts:
        activeSaveReportForCurrentProduct?.conflicts &&
        typeof activeSaveReportForCurrentProduct.conflicts === "object"
          ? activeSaveReportForCurrentProduct.conflicts
          : {},
      unresolvedChanges:
        activeSaveReportForCurrentProduct?.unresolvedChanges &&
        typeof activeSaveReportForCurrentProduct.unresolvedChanges === "object"
          ? activeSaveReportForCurrentProduct.unresolvedChanges
          : {},
      errors: Array.isArray(activeSaveReportForCurrentProduct?.errors)
        ? activeSaveReportForCurrentProduct.errors
        : []
    };

    const snapshotBodyWithoutRevision = {
      schemaVersion: 1,
      stateKind: TELEMETRY_LIVE_BENCH_MODE,
      productTitle: activeProductHeadline,
      pieceName: activeProductPieceName,
      rawShopifyProductTitle: activeProductTitle,
      manifestLoaded: isManifestFullyLoaded,
      baselineState,
      baselineEventKind,
      productQueueStatus: null,
      dataAuthorityNote:
        "rawStoredBaseline reflects the last Shopify Admin GraphQL baseline read at baselineLoadedAt (not a fresh live Shopify query on snapshot read). workingState reflects unsaved browser drafts, exact approvals, and Keep Original decisions at clientStateChangedAt.",
      runIdentity: orderedEvents.runIdentity,
      runTimestamp: orderedEvents.runTimestamp,
      latestEventKind: orderedEvents.latestEventKind,
      systemStatus: {
        contractVersion: BENCH_V2_CONTRACT_VERSION,
        activeFilter,
        openDrawerIds: Object.entries(openDrawersById)
          .filter(([, isOpen]) => Boolean(isOpen))
          .map(([id]) => id),
        isWriterBusy,
        isAiScanBusy,
        isBaselineReloading,
        isPickerLoading,
        hasBaselineErrors,
        metafieldsReadComplete: currentBaseline?.metafieldsReadComplete ?? null,
        defsReadComplete: currentBaseline?.defsReadComplete ?? null,
        variantsReadComplete: currentBaseline?.variantsReadComplete ?? null,
        primaryVariantId: currentBaseline?.primaryVariantId ?? null,
        variantCount: currentBaseline?.variantCount ?? null,
        variantTargetStatus: currentBaseline?.variantTargetStatus ?? null,
        variantMetafieldsReadComplete:
          currentBaseline?.variantMetafieldsReadComplete ?? null,
        variantDefsReadComplete: currentBaseline?.variantDefsReadComplete ?? null,
        nativeTargetsComplete: currentBaseline?.nativeTargets?.isComplete ?? null,
        selectionError: loaderData?.selectionError || null,
        loadError: loaderData?.loadError || null,
        baselineErrors: Array.isArray(currentBaseline?.errors)
          ? currentBaseline.errors
          : [],
        variantMetafieldsReadError:
          currentBaseline?.variantMetafieldsReadError || null,
        variantDefReadErrors: Array.isArray(currentBaseline?.variantDefReadErrors)
          ? currentBaseline.variantDefReadErrors
          : [],
        clientPrevalidationBanner: clientPrevalidationBanner || null
      },
      diagnosticsStats: {
        totalContractFields: allEvaluatedRows.length,
        totalFieldsInSnapshotMap: Object.keys(fieldsByKey).length,
        visibleFilteredRowCount: totalVisibleFilteredRowCount,
        stagedDraftCount: stagedProposalRows.length,
        approvedToSaveCount: validApprovedRows.length,
        keepOriginalCount: keepOriginalRows.length,
        heldAiAlternativesCount,
        mediaPhotoCount: activeProductMediaItems.length,
        lastAiScanSummary: currentAiScanReport
          ? {
              requestId: currentAiScanReport.requestId,
              completedAt: currentAiScanReport.completedAt,
              ok: currentAiScanReport.ok,
              summary: currentAiScanReport.summary,
              receivedCount: currentAiScanReport.receivedCount,
              stagedCount: currentAiScanReport.stagedCount,
              heldConflictCount: currentAiScanReport.heldConflictCount,
              unchangedSkippedCount: currentAiScanReport.unchangedSkippedCount,
              rejectedInvalidCount: currentAiScanReport.rejectedInvalidCount,
              ignoredManualOnlyCount: currentAiScanReport.ignoredManualOnlyCount,
              diagnostics: currentAiScanReport.diagnostics || {},
              details: Array.isArray(currentAiScanReport.details)
                ? currentAiScanReport.details
                : [],
              proposalsByDestination:
                currentAiScanReport.proposalsByDestination || {}
            }
          : null
      },
      manualEditedKeys,
      explicitlyApprovedKeys,
      keepOriginalKeys,
      standardizedReferenceState: {
        readinessState: "locked_in_batch_1",
        readinessReason:
          "Standardized shopify.* taxonomy reference attributes (including authoritative ERA dropdown shopify.geological-era, 4 standardized geology reference companions, shopify.material, and shopify.color-pattern) are read-only in this batch; no candidate matching or reference write is active yet.",
        stagedCandidateCount: 0,
        stagedCandidates: {},
        eligibleDestinationKeys: [],
        blockedDestinationKeys: [],
        lastMatchRequestId: null,
        lastMatchedAt: null,
        lastMatchSuccess: null,
        lastMatchIsComplete: null,
        productCategory: currentBaseline?.productCategory || null
      },
      saveVerificationEvidence,
      sectionOrder,
      fieldsByKey
    };

    const fingerprintObj = {
      benchSessionId: benchSessionIdRef.current,
      selectionState: "selected",
      productId: activeProductId,
      baselineLoadedAt,
      snapshotBodyWithoutRevision
    };

    const contentFingerprint = JSON.stringify(fingerprintObj);
    if (contentFingerprint === lastEnqueuedFingerprintRef.current) {
      return;
    }

    lastEnqueuedFingerprintRef.current = contentFingerprint;
    const clientStateChangedAt = new Date().toISOString();

    latestQueuedSnapshotSpecRef.current = {
      benchSessionId: benchSessionIdRef.current,
      selectionState: "selected",
      productId: activeProductId,
      productTitle: activeProductHeadline,
      baselineLoadedAt,
      clientStateChangedAt,
      runIdentity: orderedEvents.runIdentity,
      runTimestamp: orderedEvents.runTimestamp,
      snapshotBodyWithoutRevision
    };

    drainTelemetryPublishQueue();
  });

  const handleExplicitSaveApprovedChanges = () => {
    setClientPrevalidationBanner(null);

    if (isWriterBusy || isAiScanBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: isWriterBusy ? "Save already in progress" : "AI Scan in progress",
        reasons: [
          isWriterBusy
            ? "Wait for the current save request to finish before clicking Save again."
            : "Wait for the current AI Scan to finish before saving."
        ]
      });
      return;
    }

    if (!currentBaseline || currentBaseline.productId !== activeProductId) {
      setClientPrevalidationBanner({
        tone: "error",
        title: "Cannot save: Product data not loaded",
        reasons: [`Live product baseline is not loaded for ${activeProductTitle}.`]
      });
      return;
    }

    const approvalEntries = Object.entries(currentApprovalsMap || {});
    if (approvalEntries.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Nothing approved to save",
        reasons: [
          "No fields are approved for this product. Edit or review a connected field in Drawers 1 to 8 (where ready on this product) and check Approve before clicking Save."
        ]
      });
      return;
    }

    const prevalidationErrors = [];
    const safePlanToSubmit = {};
    let requiredVariantTargetId = null;

    for (const [destKey, approvalRec] of approvalEntries) {
      const contract = getFieldContractByDestination(destKey);
      if (
        !contract ||
        !contract.isWritableInBatch1 ||
        !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(destKey)
      ) {
        prevalidationErrors.push(
          `[${destKey}] Not an eligible writable destination.`
        );
        continue;
      }

      const rawPropEntry = currentProposedMap[destKey];
      const currentProposedValue =
        rawPropEntry && typeof rawPropEntry === "object" && typeof rawPropEntry.value === "string"
          ? rawPropEntry.value
          : typeof rawPropEntry === "string"
            ? rawPropEntry
            : "";

      const keepOrigRec = currentKeepOriginalMap[destKey] || null;
      if (
        keepOrigRec &&
        isKeepOriginalRecordValid({
          keepOriginalRecord: keepOrigRec,
          productId: activeProductId,
          destinationKey: destKey,
          currentProposedValue,
          baselineSnapshot: currentBaseline
        })
      ) {
        prevalidationErrors.push(
          `[${destKey}] Marked Keep Original; cannot be submitted for Save.`
        );
        continue;
      }

      const fidelity = checkExistingWriterStringFidelity(currentProposedValue);
      if (!fidelity.faithful) {
        prevalidationErrors.push(`[${destKey}] ${fidelity.reason}`);
        continue;
      }

      const validation = validateBatch1ProposedValue({
        productId: activeProductId,
        destinationKey: destKey,
        proposedValue: currentProposedValue,
        baselineSnapshot: currentBaseline
      });

      if (!validation.valid) {
        prevalidationErrors.push(`[${destKey}] ${validation.reason}`);
        continue;
      }

      if (validation.isUnchangedFromStored) {
        prevalidationErrors.push(
          `[${destKey}] Proposed value matches the saved value; uncheck Approve or enter a changed value.`
        );
        continue;
      }

      const stillValidApproval = isExactValueApprovalValid({
        approvalRecord: approvalRec,
        productId: activeProductId,
        destinationKey: destKey,
        currentProposedValue,
        baselineSnapshot: currentBaseline
      });

      if (!stillValidApproval) {
        prevalidationErrors.push(
          `[${destKey}] Approval record is out of date. Please review the value and check Approve again.`
        );
        continue;
      }

      if (contract.owner === "PRODUCTVARIANT") {
        const obsVariantId = validation.baselineObservation?.variantId || null;
        const baselinePrimaryVariantId = currentBaseline?.primaryVariantId || null;

        if (
          currentBaseline?.variantsReadComplete !== true ||
          currentBaseline?.variantTargetStatus !== "single_variant_verified" ||
          currentBaseline?.variantMetafieldsReadComplete !== true ||
          currentBaseline?.variantDefsReadComplete !== true ||
          !isExactProductVariantGid(baselinePrimaryVariantId) ||
          !isExactProductVariantGid(obsVariantId) ||
          obsVariantId !== baselinePrimaryVariantId ||
          approvalRec?.owner !== "PRODUCTVARIANT" ||
          approvalRec?.variantId !== baselinePrimaryVariantId
        ) {
          prevalidationErrors.push(
            `[${destKey}] Variant target identity or completeness is not verified for this approval. Reload product data and re-approve.`
          );
          continue;
        }

        if (requiredVariantTargetId && requiredVariantTargetId !== baselinePrimaryVariantId) {
          prevalidationErrors.push(
            `[${destKey}] Conflicting variantTargetId detected across approved variant fields (${requiredVariantTargetId} vs. ${baselinePrimaryVariantId}).`
          );
          continue;
        }
        requiredVariantTargetId = baselinePrimaryVariantId;
      }

      safePlanToSubmit[destKey] = validation.normalizedValue;
    }

    if (prevalidationErrors.length > 0) {
      setClientPrevalidationBanner({
        tone: "error",
        title: `Save stopped (${prevalidationErrors.length} issue${
          prevalidationErrors.length === 1 ? "" : "s"
        } found — nothing was sent)`,
        reasons: prevalidationErrors
      });
      return;
    }

    const submittedDestinations = Object.keys(safePlanToSubmit);
    if (submittedDestinations.length === 0) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "No eligible approved changes",
        reasons: ["No valid approved changes remained after preflight checks."]
      });
      return;
    }

    const submissionId = `bench_v2_save_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const submissionMeta = {
      submissionId,
      productId: activeProductId,
      variantTargetId: requiredVariantTargetId,
      submittedDestinations,
      submittedValuesByDestination: { ...safePlanToSubmit },
      startedAt: new Date().toISOString()
    };

    setActiveSaveSubmission(submissionMeta);

    const formData = new FormData();
    formData.append("intent", "executeRepairPlan");
    formData.append("benchV2OptIn", "true");
    formData.append("pieceId", activeProductId);
    if (requiredVariantTargetId) {
      formData.append("variantTargetId", requiredVariantTargetId);
    }
    formData.append("repairPlan", JSON.stringify(safePlanToSubmit));
    formData.append("nativeChanges", JSON.stringify({}));
    formData.append("legacyKeysToRemove", JSON.stringify([]));

    writerFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-api"
    });
  };

  const pickerItems = Array.isArray(pickerPageState?.items) ? pickerPageState.items : [];
  const isSelectedProductInCurrentPickerPage = pickerItems.some(
    (item) => item.id === activeProductId
  );

  const prevPageDisabled =
    isAnyOperationBusy || isPickerLoading || pickerCursorHistory.length === 0;
  const nextPageDisabled =
    isAnyOperationBusy ||
    isPickerLoading ||
    !pickerPageState?.pageInfo?.hasNextPage ||
    !pickerPageState?.pageInfo?.endCursor;

  const getPagerButtonStyle = (disabled) => ({
    padding: "8px 14px",
    fontSize: "15px",
    fontWeight: 600,
    backgroundColor: disabled ? "#e2e8f0" : "#ffffff",
    color: disabled ? "#64748b" : "#0f172a",
    border: "2px solid #64748b",
    borderRadius: "6px",
    cursor: disabled ? "not-allowed" : "pointer"
  });

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#f1f5f9",
        color: "#0f172a",
        minHeight: "100vh",
        padding: "24px 20px 80px 20px",
        fontSize: "16px",
        lineHeight: 1.6
      }}
    >
      <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
        {/* TOP SUMMARY BAR + ACCESSIBLE PRODUCT SEARCH / PICKER + 120x120 THUMBNAILS + DRAWER FILTER */}
        <header
          style={{
            backgroundColor: "#ffffff",
            border: "2px solid #94a3b8",
            borderRadius: "10px",
            padding: "20px 24px",
            marginBottom: "20px"
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div style={{ minWidth: 0, flex: "1 1 420px" }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 700,
                  color: "#15803d",
                  marginBottom: "2px"
                }}
              >
                Selected Product on Bench
              </div>
              <h1
                style={{
                  margin: "0 0 6px 0",
                  fontSize: "24px",
                  fontWeight: 700,
                  wordBreak: "break-word"
                }}
              >
                {activeProductHeadline}
              </h1>
              <div style={{ fontSize: "16px", color: "#1e293b" }}>
                Drafts staged: <strong>{stagedProposalRows.length}</strong> &nbsp;|&nbsp; Approved
                to save: <strong>{validApprovedRows.length}</strong>
                {keepOriginalRows.length > 0 && (
                  <span>
                    {" "}
                    &nbsp;|&nbsp; Keep Original: <strong>{keepOriginalRows.length}</strong>
                  </span>
                )}
                {heldAiAlternativesCount > 0 && (
                  <span>
                    {" "}
                    &nbsp;|&nbsp; AI Alternatives Held:{" "}
                    <strong>{heldAiAlternativesCount}</strong>
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleExplicitAiScanProduct}
                disabled={isAnyOperationBusy || !currentBaseline}
                style={{
                  padding: "10px 18px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor:
                    isAnyOperationBusy || !currentBaseline ? "#cbd5e1" : "#1d4ed8",
                  color: isAnyOperationBusy || !currentBaseline ? "#334155" : "#ffffff",
                  border: "2px solid #1e3a8a",
                  borderRadius: "8px",
                  cursor: isAnyOperationBusy || !currentBaseline ? "not-allowed" : "pointer"
                }}
              >
                {isAiScanBusy ? "Scanning Photos with Gemini..." : "AI Scan Product"}
              </button>

              <button
                type="button"
                onClick={() => revalidator.revalidate()}
                disabled={isAnyOperationBusy}
                style={{
                  padding: "10px 18px",
                  fontSize: "16px",
                  fontWeight: 600,
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "2px solid #475569",
                  borderRadius: "8px",
                  cursor: isAnyOperationBusy ? "not-allowed" : "pointer"
                }}
              >
                {isBaselineReloading ? "Loading..." : "Reload Product"}
              </button>

              <button
                type="button"
                onClick={handleExplicitSaveApprovedChanges}
                disabled={isAnyOperationBusy || validApprovedRows.length === 0}
                style={{
                  padding: "10px 22px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor:
                    isAnyOperationBusy || validApprovedRows.length === 0
                      ? "#cbd5e1"
                      : "#15803d",
                  color:
                    isAnyOperationBusy || validApprovedRows.length === 0
                      ? "#334155"
                      : "#ffffff",
                  border: "2px solid #14532d",
                  borderRadius: "8px",
                  cursor:
                    isAnyOperationBusy || validApprovedRows.length === 0
                      ? "not-allowed"
                      : "pointer"
                }}
              >
                {isWriterBusy
                  ? "Saving..."
                  : `Save Approved (${validApprovedRows.length})`}
              </button>
            </div>
          </div>

          {/* 120px BY 120px PRODUCT THUMBNAIL STRIP NEAR PRODUCT CONTROLS */}
          <div
            aria-label="Selected Product Photos"
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: "1px solid #cbd5e1"
            }}
          >
            {!currentBaseline || currentBaseline.productId !== activeProductId ? (
              <div style={{ fontSize: "15px", color: "#475569" }}>
                Loading photos for selected product...
              </div>
            ) : activeProductMediaItems.length === 0 ? (
              <div style={{ fontSize: "15px", color: "#475569" }}>
                No product photos available on this product.
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "12px",
                  alignItems: "center"
                }}
              >
                {activeProductMediaItems.map((mediaItem, idx) => {
                  const accessibleAlt =
                    mediaItem.alt && mediaItem.alt.trim() !== ""
                      ? mediaItem.alt.trim()
                      : `${activeProductTitle} — Photo ${idx + 1}`;
                  return (
                    <div
                      key={`${activeProductId}_${mediaItem.id}_${idx}`}
                      style={THUMBNAIL_WRAPPER_STYLE}
                    >
                      <img
                        src={mediaItem.url}
                        alt={accessibleAlt}
                        title={accessibleAlt}
                        width={120}
                        height={120}
                        style={THUMBNAIL_IMG_STYLE}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACCESSIBLE PRODUCT SEARCH & READABLE PICKER */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "16px",
              borderTop: "2px solid #cbd5e1"
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <form
                onSubmit={handleSearchFormSubmit}
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "10px",
                  flex: "1 1 520px"
                }}
              >
                <label
                  htmlFor="bench-v2-product-search-input"
                  style={{ fontWeight: 700, fontSize: "17px", color: "#0f172a" }}
                >
                  Find Product:
                </label>

                <input
                  id="bench-v2-product-search-input"
                  type="text"
                  value={searchInputText}
                  disabled={isAnyOperationBusy}
                  placeholder="Type product or stone name, then press Enter or Search..."
                  onChange={(e) => setSearchInputText(e.target.value)}
                  style={{
                    flex: "1 1 260px",
                    padding: "10px 14px",
                    fontSize: "16px",
                    border: "2px solid #475569",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    color: "#0f172a"
                  }}
                />

                <button
                  type="submit"
                  disabled={isAnyOperationBusy || isPickerLoading}
                  style={{
                    padding: "10px 18px",
                    fontSize: "16px",
                    fontWeight: 700,
                    backgroundColor:
                      isAnyOperationBusy || isPickerLoading ? "#cbd5e1" : "#0f172a",
                    color: isAnyOperationBusy || isPickerLoading ? "#334155" : "#ffffff",
                    border: "2px solid #0f172a",
                    borderRadius: "8px",
                    cursor:
                      isAnyOperationBusy || isPickerLoading ? "not-allowed" : "pointer"
                  }}
                >
                  {isPickerLoading ? "Searching..." : "Search"}
                </button>

                {(searchInputText !== "" || committedSearchQuery !== "") && (
                  <button
                    type="button"
                    onClick={handleClearProductSearch}
                    disabled={isAnyOperationBusy || isPickerLoading}
                    style={{
                      padding: "10px 16px",
                      fontSize: "16px",
                      fontWeight: 600,
                      backgroundColor: "#f8fafc",
                      color: "#0f172a",
                      border: "2px solid #64748b",
                      borderRadius: "8px",
                      cursor:
                        isAnyOperationBusy || isPickerLoading ? "not-allowed" : "pointer"
                    }}
                  >
                    Clear Search
                  </button>
                )}
              </form>

              <button
                type="button"
                aria-expanded={isProductPickerOpen}
                onClick={() => setIsProductPickerOpen((prev) => !prev)}
                style={{
                  padding: "10px 16px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor: isProductPickerOpen ? "#334155" : "#f1f5f9",
                  color: isProductPickerOpen ? "#ffffff" : "#0f172a",
                  border: "2px solid #334155",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                {isProductPickerOpen
                  ? "Hide Product List"
                  : `Browse Product List (${pickerItems.length} on Page ${
                      pickerCursorHistory.length + 1
                    })`}
              </button>
            </div>

            {!isSelectedProductInCurrentPickerPage && (
              <div
                style={{
                  marginTop: "10px",
                  padding: "10px 14px",
                  backgroundColor: "#f0fdf4",
                  border: "1px solid #86efac",
                  borderRadius: "8px",
                  fontSize: "15px",
                  color: "#14532d"
                }}
              >
                <strong>Currently Selected on Bench:</strong>{" "}
                {activeProductPieceName ? (
                  <>
                    <strong>{activeProductPieceName}</strong> ({activeProductTitle})
                  </>
                ) : (
                  <strong>{activeProductTitle}</strong>
                )}{" "}
                — stays loaded while you search or browse other pages.
              </div>
            )}

            {isProductPickerOpen && (
              <div
                role="region"
                aria-label="Product Search Results"
                style={{
                  marginTop: "14px",
                  padding: "16px",
                  backgroundColor: "#f8fafc",
                  border: "2px solid #94a3b8",
                  borderRadius: "10px"
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "12px"
                  }}
                >
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                    {committedSearchQuery
                      ? `Search Results for "${committedSearchQuery}" (${pickerItems.length} shown on Page ${
                          pickerCursorHistory.length + 1
                        })`
                      : `Product Inventory — Page ${pickerCursorHistory.length + 1} (${pickerItems.length} products)`}
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <button
                      type="button"
                      onClick={handlePreviousProductPage}
                      disabled={prevPageDisabled}
                      style={getPagerButtonStyle(prevPageDisabled)}
                    >
                      Previous 50
                    </button>

                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                      Page {pickerCursorHistory.length + 1}
                    </span>

                    <button
                      type="button"
                      onClick={handleNextProductPage}
                      disabled={nextPageDisabled}
                      style={getPagerButtonStyle(nextPageDisabled)}
                    >
                      Next 50
                    </button>
                  </div>
                </div>

                {pickerItems.length === 0 ? (
                  <div
                    style={{
                      padding: "18px",
                      backgroundColor: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      fontSize: "16px",
                      color: "#334155"
                    }}
                  >
                    No products matched{" "}
                    {committedSearchQuery ? `"${committedSearchQuery}"` : "this page"}. Click{" "}
                    <strong>Clear Search</strong> to browse all products.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      maxHeight: "420px",
                      overflowY: "auto",
                      paddingRight: "4px"
                    }}
                  >
                    {pickerItems.map((item) => {
                      const isCurrent = item.id === activeProductId;
                      const stagedCountForItem = Object.keys(
                        proposedByProduct[item.id] || {}
                      ).length;
                      const approvedCountForItem = Object.keys(
                        approvalsByProduct[item.id] || {}
                      ).length;
                      const hasDistinctPieceName = Boolean(
                        item.pieceName && item.pieceName !== item.title
                      );
                      const primaryDisplayLabel = item.pieceName || item.title;

                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "12px",
                            padding: "12px 16px",
                            backgroundColor: isCurrent ? "#f0fdf4" : "#ffffff",
                            border: isCurrent
                              ? "2px solid #15803d"
                              : "1px solid #94a3b8",
                            borderRadius: "8px"
                          }}
                        >
                          <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                            <div
                              style={{
                                fontSize: "18px",
                                fontWeight: 700,
                                color: "#0f172a",
                                wordBreak: "break-word"
                              }}
                            >
                              {primaryDisplayLabel}
                              {isCurrent && (
                                <span
                                  style={{
                                    marginLeft: "10px",
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#15803d"
                                  }}
                                >
                                  (Selected on Bench)
                                </span>
                              )}
                              {stagedCountForItem > 0 && (
                                <span
                                  style={{
                                    marginLeft: "10px",
                                    fontSize: "14px",
                                    fontWeight: 600,
                                    color: "#1d4ed8"
                                  }}
                                >
                                  • {stagedCountForItem} draft
                                  {stagedCountForItem === 1 ? "" : "s"}
                                  {approvedCountForItem > 0
                                    ? ` (${approvedCountForItem} approved)`
                                    : ""}
                                </span>
                              )}
                            </div>

                            {hasDistinctPieceName && (
                              <div
                                style={{
                                  fontSize: "15px",
                                  color: "#334155",
                                  marginTop: "4px",
                                  wordBreak: "break-word"
                                }}
                              >
                                Full Product Title: {item.title}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            disabled={isAnyOperationBusy || isCurrent}
                            onClick={() => handleSelectProductGid(item.id)}
                            style={{
                              padding: "9px 18px",
                              fontSize: "16px",
                              fontWeight: 700,
                              backgroundColor: isCurrent
                                ? "#15803d"
                                : isAnyOperationBusy
                                  ? "#cbd5e1"
                                  : "#0f172a",
                              color:
                                isCurrent || !isAnyOperationBusy ? "#ffffff" : "#334155",
                              border: isCurrent
                                ? "2px solid #14532d"
                                : "2px solid #0f172a",
                              borderRadius: "8px",
                              cursor:
                                isAnyOperationBusy || isCurrent
                                  ? "not-allowed"
                                  : "pointer",
                              flexShrink: 0
                            }}
                          >
                            {isCurrent ? "Selected" : "Select Product"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RESTORED TAB 3 DRAWER FILTER BAR + DRAWER EXPAND/COLLAPSE CONTROLS */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid #cbd5e1",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px"
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "10px"
              }}
            >
              <label
                htmlFor="bench-v2-field-filter"
                style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}
              >
                Filter Fields:
              </label>

              <select
                id="bench-v2-field-filter"
                aria-label="Filter Fields"
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                style={{
                  padding: "8px 12px",
                  fontSize: "16px",
                  fontWeight: 600,
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "2px solid #475569",
                  borderRadius: "8px",
                  cursor: "pointer"
                }}
              >
                {BENCH_V2_FILTER_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {activeFilter !== "All" && (
                <button
                  type="button"
                  onClick={() => setActiveFilter("All")}
                  style={{
                    padding: "8px 14px",
                    fontSize: "15px",
                    fontWeight: 700,
                    backgroundColor: "#eff6ff",
                    color: "#1e3a8a",
                    border: "2px solid #1d4ed8",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  Return to All Fields
                </button>
              )}

              <span style={{ fontSize: "15px", color: "#334155" }}>
                Showing <strong>{totalVisibleFilteredRowCount}</strong> of{" "}
                <strong>{allEvaluatedRows.length}</strong> fields
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => handleSetAllDrawers(true)}
                style={DRAWER_BULK_BTN_STYLE}
              >
                Open All Drawers
              </button>
              <button
                type="button"
                onClick={() => handleSetAllDrawers(false)}
                style={DRAWER_BULK_BTN_STYLE}
              >
                Close All Drawers
              </button>
            </div>
          </div>

          <div
            style={{
              marginTop: "10px",
              fontSize: "15px",
              color: "#334155"
            }}
          >
            Connected fields in Drawers 1 to 8 unlock for manual edit and exact-value approval
            only when live Shopify owner/type/completeness evidence is verified. In Drawer 5
            (Manual Measurements), <strong>Dimensions (mm)</strong> and{" "}
            <strong>Weight (grams)</strong> are manual-only, while 4 unverified measurement
            keepers stay on hold. In Drawer 7 (Geology), 12 detailed <code>custom.*</code>{" "}
            paths are connected (12 had scan-delivery evidence on Canyon Red; only AGE{" "}
            <code>custom.geological_age</code> has independently verified actual Save/readback),
            legacy <code>custom.geological_era</code> is read-only, and authoritative ERA
            dropdown <code>shopify.geological-era</code> plus its 4 standardized geology
            reference companions in Drawer 10 (as well as <code>shopify.material</code> and{" "}
            <code>shopify.color-pattern</code>) remain locked pending reference wiring. In
            Drawer 8 (Channel Attributes), <code>custom.google_product_category</code> (PRODUCT)
            and manual/preset single-variant <code>mm-google-shopping.age_group</code>,{" "}
            <code>condition</code>, and <code>gender</code> (PRODUCTVARIANT) are wired when
            single-variant readiness passes, while <code>mm-google-shopping.custom_product</code>{" "}
            remains held and legacy <code>google.*</code> variant slots +{" "}
            <code>custom.target_gender</code> remain read-only.
          </div>

          <details style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              System and Product Details
            </summary>
            <div style={DETAILS_PANEL_STYLE}>
              <div>
                <strong>Product GID:</strong> <code>{activeProductId}</code>
              </div>
              {activeProductPieceName && (
                <div>
                  <strong>Saved Piece Name (custom.piece_name):</strong>{" "}
                  <code>{activeProductPieceName}</code>
                </div>
              )}
              <div>
                <strong>Category:</strong>{" "}
                {currentBaseline?.productCategory?.fullName
                  ? `${currentBaseline.productCategory.fullName} (${currentBaseline.productCategory.id})`
                  : "None / Unassigned"}
              </div>
              <div>
                <strong>Single-Variant Target:</strong>{" "}
                {currentBaseline?.primaryVariantId ? (
                  <code>{currentBaseline.primaryVariantId}</code>
                ) : (
                  <span>None ({currentBaseline?.variantTargetStatus || "unknown"})</span>
                )}{" "}
                | <strong>Variant Count:</strong>{" "}
                {currentBaseline?.variantCount !== null &&
                currentBaseline?.variantCount !== undefined
                  ? String(currentBaseline.variantCount)
                  : "Unknown"}
              </div>
              <div>
                <strong>Read Completeness:</strong> Product Metafields={" "}
                {String(currentBaseline?.metafieldsReadComplete)} | Product Definitions={" "}
                {String(currentBaseline?.defsReadComplete)} | Variants={" "}
                {String(currentBaseline?.variantsReadComplete)} | Variant Metafields={" "}
                {String(currentBaseline?.variantMetafieldsReadComplete)} | Variant Definitions={" "}
                {String(currentBaseline?.variantDefsReadComplete)} | Native={" "}
                {String(currentBaseline?.nativeTargets?.isComplete)}
              </div>
              <div>
                <strong>Loaded At:</strong> {currentBaseline?.loadedAt || "Not loaded"} |{" "}
                <strong>Contract:</strong> {BENCH_V2_CONTRACT_VERSION}
              </div>
              <div style={{ marginTop: "4px", paddingTop: "4px", borderTop: "1px solid #e2e8f0" }}>
                <strong>Sidekick Live Snapshot Sync:</strong>{" "}
                {telemetrySyncStatus.state === "stored"
                  ? `Stored (rev ${telemetrySyncStatus.benchRevision})`
                  : telemetrySyncStatus.state === "syncing"
                    ? `Syncing (rev ${telemetrySyncStatus.benchRevision})...`
                    : telemetrySyncStatus.state === "error"
                      ? `Error (${telemetrySyncStatus.errorCode || "failed"})`
                      : "Idle"}{" "}
                | <strong>Session:</strong> <code>{telemetrySyncStatus.benchSessionId}</code>
                {telemetrySyncStatus.reportId && (
                  <>
                    {" "}
                    | <strong>Report ID:</strong> <code>{telemetrySyncStatus.reportId}</code>
                  </>
                )}
                {telemetrySyncStatus.clientStateChangedAt && (
                  <>
                    {" "}
                    | <strong>State Changed At:</strong>{" "}
                    {telemetrySyncStatus.clientStateChangedAt}
                  </>
                )}
                {telemetrySyncStatus.serverReceivedAt && (
                  <>
                    {" "}
                    | <strong>Server Received At:</strong>{" "}
                    {telemetrySyncStatus.serverReceivedAt}
                  </>
                )}
                <div style={{ fontSize: "13px", color: "#475569", marginTop: "2px" }}>
                  {telemetrySyncStatus.message}
                </div>
              </div>
            </div>
          </details>
        </header>

        {/* IMPORTANT BASELINE / SELECTOR ERRORS */}
        {hasBaselineErrors && (
          <div
            role="alert"
            style={{
              backgroundColor: "#fef2f2",
              border: "2px solid #b91c1c",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "20px",
              color: "#7f1d1d"
            }}
          >
            <div style={{ fontWeight: 700, fontSize: "17px", marginBottom: "6px" }}>
              Product Read Warning
            </div>
            {loaderData?.selectionError && <div>{loaderData.selectionError}</div>}
            {pickerPageState?.error && <div>{pickerPageState.error}</div>}
            {loaderData?.loadError && <div>{loaderData.loadError}</div>}
            {Array.isArray(currentBaseline?.errors) &&
              currentBaseline.errors.map((errMsg, idx) => (
                <div key={idx} style={{ marginTop: "4px" }}>
                  &bull; {errMsg}
                </div>
              ))}
          </div>
        )}

        {/* HONEST COMPACT AI SCAN REPORT BANNER */}
        {currentAiScanReport && (
          <div
            role="region"
            aria-label="AI Scan Result"
            style={{
              backgroundColor: currentAiScanReport.ok ? "#eff6ff" : "#fef2f2",
              border: currentAiScanReport.ok ? "2px solid #1d4ed8" : "2px solid #b91c1c",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "20px",
              color: currentAiScanReport.ok ? "#1e3a8a" : "#7f1d1d"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px"
              }}
            >
              <div>
                <div style={{ fontSize: "17px", fontWeight: 700 }}>
                  {currentAiScanReport.ok ? "AI Scan Result" : "AI Scan Error"}
                </div>
                <div style={{ marginTop: "4px", fontSize: "15px", color: "#0f172a" }}>
                  {currentAiScanReport.summary}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setLastAiScanReportByProduct((prev) => {
                    const next = { ...prev };
                    delete next[activeProductId];
                    return next;
                  })
                }
                style={DISMISS_BTN_STYLE}
              >
                Dismiss
              </button>
            </div>

            {currentAiScanReport.diagnostics &&
              Object.keys(currentAiScanReport.diagnostics).length > 0 && (
                <div style={{ marginTop: "8px", fontSize: "14px", color: "#9a3412" }}>
                  {Object.entries(currentAiScanReport.diagnostics).map(([k, msg]) => (
                    <div key={k}>
                      &bull; <strong>{k}:</strong> {String(msg)}
                    </div>
                  ))}
                </div>
              )}

            {Array.isArray(currentAiScanReport.details) &&
              currentAiScanReport.details.length > 0 && (
                <details style={{ marginTop: "8px", fontSize: "14px", color: "#334155" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                    AI Scan Field Breakdown ({currentAiScanReport.details.length})
                  </summary>
                  <ul style={{ margin: "6px 0 0 0", paddingLeft: "20px" }}>
                    {currentAiScanReport.details.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ul>
                </details>
              )}
          </div>
        )}

        {/* ACTIONABLE PREVALIDATION / APPROVAL MESSAGE BANNER */}
        {clientPrevalidationBanner && (
          <div
            role="alert"
            style={{
              backgroundColor:
                clientPrevalidationBanner.tone === "error" ? "#fef2f2" : "#fffbeb",
              border:
                clientPrevalidationBanner.tone === "error"
                  ? "2px solid #b91c1c"
                  : "2px solid #b45309",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "20px",
              color: clientPrevalidationBanner.tone === "error" ? "#7f1d1d" : "#78350f"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px"
              }}
            >
              <strong style={{ fontSize: "17px" }}>{clientPrevalidationBanner.title}</strong>
              <button
                type="button"
                onClick={() => setClientPrevalidationBanner(null)}
                style={DISMISS_BTN_STYLE}
              >
                Dismiss
              </button>
            </div>
            <ul style={{ margin: "8px 0 0 0", paddingLeft: "22px", fontSize: "15px" }}>
              {clientPrevalidationBanner.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* SAVE RESULT BANNER */}
        {lastSaveReport && (
          <div
            role="region"
            aria-label="Last Save Result"
            style={{
              backgroundColor:
                lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                  ? "#f0fdf4"
                  : "#fef2f2",
              border:
                lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                  ? "2px solid #15803d"
                  : "2px solid #b91c1c",
              borderRadius: "10px",
              padding: "18px 22px",
              marginBottom: "20px"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "12px"
              }}
            >
              <div>
                <div style={{ fontSize: "18px", fontWeight: 700 }}>
                  {lastSaveReport.overallOutcome === "ALL_SUBMITTED_DESTINATIONS_VERIFIED"
                    ? `Saved and verified (${lastSaveReport.verifiedDestinations.length} field${
                        lastSaveReport.verifiedDestinations.length === 1 ? "" : "s"
                      })`
                    : "Save needs attention"}
                </div>
                <div style={{ marginTop: "4px", fontSize: "15px" }}>{lastSaveReport.message}</div>
              </div>
              <button
                type="button"
                onClick={() => setLastSaveReport(null)}
                style={{
                  ...DISMISS_BTN_STYLE,
                  padding: "6px 12px"
                }}
              >
                Close
              </button>
            </div>

            {Object.keys(lastSaveReport.blockedFields || {}).length > 0 && (
              <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
                <strong>Blocked:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                  {Object.entries(lastSaveReport.blockedFields).map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code>: {String(v)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(lastSaveReport.unresolvedChanges || {}).length > 0 && (
              <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
                <strong>Unresolved on read-back:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                  {Object.entries(lastSaveReport.unresolvedChanges).map(([k, v]) => (
                    <li key={k}>
                      <code>{k}</code>: {JSON.stringify(v)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(lastSaveReport.errors) && lastSaveReport.errors.length > 0 && (
              <div style={{ marginTop: "10px", color: "#7f1d1d" }}>
                <strong>Errors:</strong>
                <ul style={{ margin: "4px 0 0 0", paddingLeft: "20px" }}>
                  {lastSaveReport.errors.map((errObj, i) => (
                    <li key={i}>
                      {errObj?.destination ? `[${errObj.destination}] ` : ""}
                      {errObj?.message || JSON.stringify(errObj)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details style={{ marginTop: "10px", fontSize: "14px" }}>
              <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                Save Technical Details
              </summary>
              <div style={{ marginTop: "6px", color: "#334155" }}>
                <div>
                  <strong>Product GID:</strong> <code>{lastSaveReport.productId}</code>
                  {lastSaveReport.variantTargetId && (
                    <>
                      {" "}
                      | <strong>Submitted Variant GID:</strong>{" "}
                      <code>{lastSaveReport.variantTargetId}</code>
                    </>
                  )}{" "}
                  | <strong>Submission ID:</strong> {lastSaveReport.submissionId} |{" "}
                  <strong>Writer Status:</strong> {lastSaveReport.writerStatus} |{" "}
                  <strong>Read-Back Verified:</strong> {String(lastSaveReport.readBackVerified)}
                </div>
                <div>
                  <strong>Submitted:</strong>{" "}
                  {lastSaveReport.submittedDestinations.join(", ") || "None"}
                </div>
                <div>
                  <strong>Verified:</strong>{" "}
                  {lastSaveReport.verifiedDestinations.join(", ") || "None"}
                </div>
                <div>
                  <strong>Skipped:</strong> {lastSaveReport.skippedKeys.join(", ") || "None"}
                </div>
                <div>
                  <strong>Unconfirmed:</strong>{" "}
                  {lastSaveReport.unconfirmedDestinations.join(", ") || "None"}
                </div>
              </div>
            </details>
          </div>
        )}

        {/* HONEST EMPTY-FILTER NOTICE WITH ONE-CLICK RETURN TO ALL */}
        {activeFilter !== "All" && totalVisibleFilteredRowCount === 0 && (
          <div
            role="status"
            style={{
              backgroundColor: "#ffffff",
              border: "2px solid #2563eb",
              borderRadius: "10px",
              padding: "20px 24px",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px"
            }}
          >
            <div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                No fields currently match the "{activeFilter}" filter on {activeProductTitle}
              </div>
              <div style={{ fontSize: "15px", color: "#334155", marginTop: "4px" }}>
                {activeFilter === "Needs review"
                  ? `All review items in this view are resolved (${validApprovedRows.length} approved to save, ${keepOriginalRows.length} Keep Original). Review complete does not mean saved to Shopify.`
                  : "All underlying fields, drafts, approvals, and Keep Original decisions remain intact."}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveFilter("All")}
              style={{
                padding: "10px 18px",
                fontSize: "16px",
                fontWeight: 700,
                backgroundColor: "#1d4ed8",
                color: "#ffffff",
                border: "2px solid #1e3a8a",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Show All Fields
            </button>
          </div>
        )}

        {/* ALL 11 DRAWERS — INITIALLY COLLAPSED, PLAIN NAMES, CLEAR EXPAND/COLLAPSE */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {evaluatedDrawerGroups.map((drawer) => {
            const isOpen = Boolean(openDrawersById[drawer.drawerId]);
            const plainDrawerTitle = PLAIN_DRAWER_TITLES[drawer.drawerId] || drawer.heading;

            const drawerApprovedCount = drawer.evaluatedRows.filter(
              (r) => r.isApproved && r.fidelityCheck.faithful
            ).length;
            const drawerStagedCount = drawer.evaluatedRows.filter(
              (r) => r.hasProposalKey
            ).length;
            const drawerHeldAltCount = drawer.evaluatedRows.filter(
              (r) => Boolean(r.heldAiAlternative)
            ).length;

            const isParkedProtectedDrawer = drawer.drawerId === "parked_excluded_protected";
            const drawerSubtitleLabel = getDrawerConnectionSubtitle(drawer);

            return (
              <section
                key={drawer.drawerId}
                aria-label={plainDrawerTitle}
                style={{
                  backgroundColor: "#ffffff",
                  border:
                    drawer.isImplementedInBatch1 && !isParkedProtectedDrawer
                      ? "2px solid #64748b"
                      : "1px solid #94a3b8",
                  borderRadius: "10px",
                  overflow: "hidden"
                }}
              >
                {/* DRAWER HEADER BAR */}
                <div
                  style={{
                    padding: "16px 20px",
                    backgroundColor: isOpen ? "#e2e8f0" : "#ffffff",
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "12px",
                    borderBottom: isOpen ? "2px solid #94a3b8" : "none"
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: "19px", fontWeight: 700, color: "#0f172a" }}>
                      {plainDrawerTitle}
                    </h2>
                    <div style={{ fontSize: "14px", color: "#334155", marginTop: "2px" }}>
                      {drawerSubtitleLabel} &bull;{" "}
                      {activeFilter === "All"
                        ? `${drawer.evaluatedRows.length} fields`
                        : `${drawer.visibleRows.length} of ${drawer.evaluatedRows.length} fields match "${activeFilter}"`}
                      {drawerStagedCount > 0 && ` • ${drawerStagedCount} staged`}
                      {drawerApprovedCount > 0 && ` • ${drawerApprovedCount} approved`}
                      {drawerHeldAltCount > 0 && ` • ${drawerHeldAltCount} AI alternative`}
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => handleToggleDrawer(drawer.drawerId)}
                    style={{
                      padding: "8px 16px",
                      fontSize: "15px",
                      fontWeight: 700,
                      backgroundColor: isOpen ? "#0f172a" : "#f8fafc",
                      color: isOpen ? "#ffffff" : "#0f172a",
                      border: "2px solid #334155",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {isOpen ? "Close Drawer" : "Open Drawer"}
                  </button>
                </div>

                {/* DRAWER BODY — VISIBLE FIELDS IN DRAWER */}
                {isOpen && (
                  <div style={{ padding: "18px 20px", backgroundColor: "#f8fafc" }}>
                    {/* PER-IMAGE NATIVE MEDIA ALT BASELINE INSPECTION IN DRAWER 9 */}
                    {drawer.drawerId === "native_seo_description_media" &&
                      Array.isArray(currentBaseline?.nativeTargets?.media?.edges) && (
                        <div
                          style={{
                            marginBottom: "16px",
                            padding: "14px 16px",
                            backgroundColor: "#ffffff",
                            border: "1px solid #94a3b8",
                            borderRadius: "8px"
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "8px" }}>
                            Saved Photo Alt Text ({currentBaseline.nativeTargets.media.edges.length}{" "}
                            photos — Read-only in Batch 1)
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                              gap: "10px"
                            }}
                          >
                            {currentBaseline.nativeTargets.media.edges.map(({ node }, idx) => (
                              <div
                                key={node.id || idx}
                                style={{
                                  padding: "10px 12px",
                                  backgroundColor: "#f8fafc",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  fontSize: "15px"
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>Photo {idx + 1}</div>
                                <div style={{ marginTop: "4px" }}>
                                  {node.alt ? (
                                    <span>{node.alt}</span>
                                  ) : (
                                    <span style={{ color: "#475569" }}>Not set</span>
                                  )}
                                </div>
                                <details style={{ marginTop: "6px", fontSize: "13px" }}>
                                  <summary style={{ cursor: "pointer", color: "#475569" }}>
                                    Photo ID
                                  </summary>
                                  <code>{node.id}</code>
                                </details>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* EMPTY DRAWER FILTER STATE */}
                    {drawer.visibleRows.length === 0 ? (
                      <div
                        style={{
                          padding: "14px 16px",
                          backgroundColor: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "8px",
                          display: "flex",
                          flexWrap: "wrap",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "12px",
                          fontSize: "15px",
                          color: "#334155"
                        }}
                      >
                        <span>
                          0 fields in {plainDrawerTitle} match the "{activeFilter}" filter.
                        </span>
                        <button
                          type="button"
                          onClick={() => setActiveFilter("All")}
                          style={{
                            padding: "6px 12px",
                            fontSize: "14px",
                            fontWeight: 700,
                            backgroundColor: "#f1f5f9",
                            color: "#0f172a",
                            border: "1px solid #475569",
                            borderRadius: "6px",
                            cursor: "pointer"
                          }}
                        >
                          Show All Fields
                        </button>
                      </div>
                    ) : (
                      /* FIELD CARDS */
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {drawer.visibleRows.map((row) => {
                          const {
                            contract,
                            baselineObservation: obs,
                            baselineDisplayValue,
                            options,
                            hasProposalKey,
                            proposedValue,
                            proposedDisplayValue,
                            proposalSource,
                            proposalOrigin,
                            heldAiAlternative,
                            scanProposalMeta,
                            validation,
                            isApproved,
                            isKeepOriginal,
                            fidelityCheck,
                            effectiveConnectionStatus,
                            effectiveReviewStatus,
                            effectiveStatusReason
                          } = row;

                          const usesMeaningDisplay = Boolean(contract.usesYesNoMeaningDisplay);
                          const isManualOnlyField = isManualOnlyNoAiDestination(
                            contract.destinationKey,
                            contract
                          );

                          const canEditDraftInBatch1 =
                            contract.isWritableInBatch1 && obs.evidenceAvailable;

                          const canApproveForSave =
                            contract.isWritableInBatch1 &&
                            hasProposalKey &&
                            Boolean(validation?.valid && !validation?.isUnchangedFromStored) &&
                            fidelityCheck.faithful;

                          const canSelectKeepOriginal =
                            contract.isWritableInBatch1 &&
                            hasProposalKey &&
                            obs.evidenceAvailable &&
                            proposedValue.trim() !== "" &&
                            !(obs.presence === "present" && obs.rawValue === proposedValue);

                          const plainLabel = cleanFieldHeading(contract.label);
                          const readableSaved = formatReadableSavedValue(
                            obs,
                            usesMeaningDisplay,
                            baselineDisplayValue
                          );
                          const shortNotice = getShortPlainNotice(row);

                          let inputPlaceholder = "Type proposed value...";
                          if (!canEditDraftInBatch1) {
                            inputPlaceholder =
                              contract.owner === "PRODUCTVARIANT"
                                ? "Editing locked until single-variant baseline loads"
                                : "Editing locked until baseline loads";
                          } else if (contract.destinationKey === "custom.dimensions_mm") {
                            inputPlaceholder = "Enter manual measurement (e.g. 38 x 24 x 6 mm)...";
                          } else if (contract.destinationKey === "custom.weight_grams") {
                            inputPlaceholder = "Enter manual scale weight in grams (e.g. 14.5)...";
                          }

                          let cardBorder = "1px solid #cbd5e1";
                          let cardBg = "#ffffff";
                          if (isApproved) {
                            cardBorder = "2px solid #15803d";
                            cardBg = "#f0fdf4";
                          } else if (
                            hasProposalKey &&
                            (!validation?.valid || !fidelityCheck.faithful)
                          ) {
                            cardBorder = "2px solid #b45309";
                            cardBg = "#fffbeb";
                          } else if (hasProposalKey && !isKeepOriginal) {
                            cardBorder = "2px solid #2563eb";
                          }

                          return (
                            <div
                              key={contract.destinationKey}
                              style={{
                                backgroundColor: cardBg,
                                border: cardBorder,
                                borderRadius: "8px",
                                padding: "16px 18px"
                              }}
                            >
                              {/* FIELD TITLE ROW */}
                              <div
                                style={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  justifyContent: "space-between",
                                  alignItems: "baseline",
                                  gap: "8px",
                                  marginBottom: "12px"
                                }}
                              >
                                <div style={{ fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                                  {plainLabel}
                                  {contract.destinationKey === "custom.is_ooak" && (
                                    <span
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 500,
                                        color: "#475569",
                                        marginLeft: "8px"
                                      }}
                                    >
                                      (Second OOAK field — custom.is_ooak)
                                    </span>
                                  )}
                                  {contract.destinationKey === "custom.is_one_of_a_kind" && (
                                    <span
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 500,
                                        color: "#475569",
                                        marginLeft: "8px"
                                      }}
                                    >
                                      (Primary OOAK field — custom.is_one_of_a_kind)
                                    </span>
                                  )}
                                  {contract.owner === "PRODUCTVARIANT" &&
                                    contract.isWritableInBatch1 && (
                                      <span
                                        style={{
                                          fontSize: "13px",
                                          fontWeight: 600,
                                          color: "#1e3a8a",
                                          marginLeft: "8px"
                                        }}
                                      >
                                        (Single-Variant {contract.destinationKey} — manual/preset)
                                      </span>
                                    )}
                                  {isManualOnlyField &&
                                    contract.isWritableInBatch1 &&
                                    contract.owner !== "PRODUCTVARIANT" && (
                                      <span
                                        style={{
                                          fontSize: "13px",
                                          fontWeight: 600,
                                          color: "#334155",
                                          marginLeft: "8px"
                                        }}
                                      >
                                        (Manual entry only — no AI scan)
                                      </span>
                                    )}
                                </div>

                                <div style={{ fontSize: "15px", fontWeight: 600, color: "#334155" }}>
                                  {isApproved
                                    ? "Approved to save"
                                    : isKeepOriginal
                                      ? "Keeping original"
                                      : hasProposalKey
                                        ? proposalOrigin === "AI"
                                          ? "AI suggestion (unapproved)"
                                          : "Draft staged (unapproved)"
                                        : "Unchanged"}
                                </div>
                              </div>

                              {/* SAVED VS. PROPOSED SIDE-BY-SIDE */}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))",
                                  gap: "16px",
                                  alignItems: "stretch"
                                }}
                              >
                                {/* SAVED BOX */}
                                <div
                                  style={{
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #94a3b8",
                                    borderRadius: "6px",
                                    padding: "12px 14px"
                                  }}
                                >
                                  <div
                                    style={{
                                      fontSize: "14px",
                                      fontWeight: 700,
                                      color: "#334155",
                                      marginBottom: "6px"
                                    }}
                                  >
                                    Saved
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "16px",
                                      color:
                                        obs.presence === "present" ? "#0f172a" : "#475569",
                                      fontWeight: obs.presence === "present" ? 600 : 400,
                                      wordBreak: "break-word",
                                      whiteSpace: "pre-wrap"
                                    }}
                                  >
                                    {readableSaved}
                                  </div>
                                </div>

                                {/* PROPOSED BOX + NEARBY APPROVAL CONTROLS */}
                                <div
                                  style={{
                                    backgroundColor: "#ffffff",
                                    border: "1px solid #94a3b8",
                                    borderRadius: "6px",
                                    padding: "12px 14px"
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      justifyContent: "space-between",
                                      alignItems: "baseline",
                                      gap: "8px",
                                      marginBottom: "6px"
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "14px",
                                        fontWeight: 700,
                                        color: "#334155"
                                      }}
                                    >
                                      Proposed
                                    </span>
                                    {hasProposalKey && proposalSource && proposalSource !== "None" && (
                                      <span style={{ fontSize: "13px", color: "#475569" }}>
                                        Source: {proposalSource}
                                      </span>
                                    )}
                                  </div>

                                  {contract.isWritableInBatch1 ? (
                                    <div>
                                      {Array.isArray(options) && options.length > 0 && (
                                        <select
                                          aria-label={`Preset options for ${contract.destinationKey}`}
                                          value={
                                            options.some(
                                              (o) =>
                                                (typeof o === "object" ? o.value : o) ===
                                                proposedValue
                                            )
                                              ? proposedValue
                                              : ""
                                          }
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
                                          onFocus={() =>
                                            handleFieldEditorFocus(contract.destinationKey)
                                          }
                                          onBlur={() =>
                                            handleFieldEditorBlur(contract.destinationKey)
                                          }
                                          onChange={(e) => {
                                            if (e.target.value === "") return;
                                            handleManualProposalChange(
                                              contract.destinationKey,
                                              e.target.value
                                            );
                                          }}
                                          style={{
                                            width: "100%",
                                            padding: "8px 10px",
                                            marginBottom: "8px",
                                            fontSize: "15px",
                                            border: "1px solid #475569",
                                            borderRadius: "6px",
                                            backgroundColor: "#ffffff",
                                            color: "#0f172a"
                                          }}
                                        >
                                          <option value="">Choose an option...</option>
                                          {options.map((opt, idx) => {
                                            const optVal =
                                              typeof opt === "object"
                                                ? opt.value ?? opt.label
                                                : String(opt);
                                            const optLabel =
                                              typeof opt === "object" ? opt.label : String(opt);
                                            return (
                                              <option key={`${optVal}_${idx}`} value={optVal}>
                                                {optLabel}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      )}

                                      <div style={{ display: "flex", gap: "8px" }}>
                                        <input
                                          type="text"
                                          aria-label={`Manual proposal for ${contract.destinationKey}`}
                                          value={proposedValue}
                                          disabled={!canEditDraftInBatch1 || isAnyOperationBusy}
                                          placeholder={inputPlaceholder}
                                          onFocus={() =>
                                            handleFieldEditorFocus(contract.destinationKey)
                                          }
                                          onBlur={() =>
                                            handleFieldEditorBlur(contract.destinationKey)
                                          }
                                          onChange={(e) =>
                                            handleManualProposalChange(
                                              contract.destinationKey,
                                              e.target.value
                                            )
                                          }
                                          style={{
                                            flex: 1,
                                            padding: "8px 10px",
                                            fontSize: "16px",
                                            border: "1px solid #475569",
                                            borderRadius: "6px",
                                            color: "#0f172a"
                                          }}
                                        />
                                        {hasProposalKey && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleClearDraftProposal(contract.destinationKey)
                                            }
                                            disabled={isAnyOperationBusy}
                                            style={{
                                              padding: "8px 12px",
                                              fontSize: "14px",
                                              fontWeight: 600,
                                              backgroundColor: "#f1f5f9",
                                              color: "#0f172a",
                                              border: "1px solid #475569",
                                              borderRadius: "6px",
                                              cursor: "pointer"
                                            }}
                                          >
                                            Clear
                                          </button>
                                        )}
                                      </div>

                                      {usesMeaningDisplay &&
                                        hasProposalKey &&
                                        proposedValue.trim() !== "" &&
                                        proposedDisplayValue && (
                                          <div
                                            style={{
                                              fontSize: "14px",
                                              color: "#334155",
                                              marginTop: "6px"
                                            }}
                                          >
                                            Meaning: <strong>{proposedDisplayValue}</strong>
                                          </div>
                                        )}

                                      {/* HELD AI ALTERNATIVE CHOICE BOX */}
                                      {heldAiAlternative && !isManualOnlyField && (
                                        <div
                                          style={{
                                            marginTop: "10px",
                                            padding: "10px 12px",
                                            backgroundColor: "#eff6ff",
                                            border: "1px solid #93c5fd",
                                            borderRadius: "6px",
                                            fontSize: "14px",
                                            color: "#1e3a8a"
                                          }}
                                        >
                                          <div style={{ fontWeight: 700 }}>
                                            Separate AI Suggestion Available: "
                                            {heldAiAlternative.value}"
                                          </div>
                                          <div style={{ fontSize: "13px", marginTop: "2px" }}>
                                            Source:{" "}
                                            {typeof heldAiAlternative.source === "string" &&
                                            heldAiAlternative.source.trim() !== ""
                                              ? heldAiAlternative.source.trim()
                                              : "Source not reported"}{" "}
                                            (kept separate so your current draft or decision was not
                                            overwritten)
                                          </div>
                                          <div
                                            style={{
                                              display: "flex",
                                              gap: "8px",
                                              marginTop: "8px"
                                            }}
                                          >
                                            <button
                                              type="button"
                                              disabled={isAnyOperationBusy}
                                              onClick={() =>
                                                handleAcceptAiAlternative(contract.destinationKey)
                                              }
                                              style={{
                                                padding: "5px 10px",
                                                fontSize: "13px",
                                                fontWeight: 700,
                                                backgroundColor: "#1d4ed8",
                                                color: "#ffffff",
                                                border: "1px solid #1e3a8a",
                                                borderRadius: "5px",
                                                cursor: isAnyOperationBusy
                                                  ? "not-allowed"
                                                  : "pointer"
                                              }}
                                            >
                                              Use AI Suggestion
                                            </button>
                                            <button
                                              type="button"
                                              disabled={isAnyOperationBusy}
                                              onClick={() =>
                                                handleDismissAiAlternative(contract.destinationKey)
                                              }
                                              style={{
                                                padding: "5px 10px",
                                                fontSize: "13px",
                                                fontWeight: 600,
                                                backgroundColor: "#ffffff",
                                                color: "#0f172a",
                                                border: "1px solid #64748b",
                                                borderRadius: "5px",
                                                cursor: isAnyOperationBusy
                                                  ? "not-allowed"
                                                  : "pointer"
                                              }}
                                            >
                                              Dismiss AI Suggestion
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* PLAIN-LANGUAGE APPROVE & KEEP ORIGINAL CONTROLS */}
                                      <div
                                        style={{
                                          display: "flex",
                                          flexWrap: "wrap",
                                          gap: "18px",
                                          marginTop: "12px",
                                          paddingTop: "10px",
                                          borderTop: "1px solid #e2e8f0"
                                        }}
                                      >
                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "16px",
                                            fontWeight: isApproved ? 700 : 600,
                                            color: isApproved ? "#15803d" : "#0f172a",
                                            cursor:
                                              (canApproveForSave || isApproved) &&
                                              !isAnyOperationBusy
                                                ? "pointer"
                                                : "not-allowed",
                                            opacity:
                                              canApproveForSave || isApproved ? 1 : 0.55
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={Boolean(isApproved)}
                                            disabled={
                                              isAnyOperationBusy ||
                                              (!canApproveForSave && !isApproved)
                                            }
                                            onChange={() =>
                                              handleToggleApproval(
                                                contract.destinationKey,
                                                Boolean(isApproved)
                                              )
                                            }
                                            style={{ width: "18px", height: "18px" }}
                                          />
                                          <span>Approve</span>
                                        </label>

                                        <label
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "8px",
                                            fontSize: "16px",
                                            fontWeight: isKeepOriginal ? 700 : 600,
                                            color: "#0f172a",
                                            cursor:
                                              (canSelectKeepOriginal || isKeepOriginal) &&
                                              !isAnyOperationBusy
                                                ? "pointer"
                                                : "not-allowed",
                                            opacity:
                                              canSelectKeepOriginal || isKeepOriginal ? 1 : 0.55
                                          }}
                                        >
                                          <input
                                            type="checkbox"
                                            checked={Boolean(isKeepOriginal)}
                                            disabled={
                                              isAnyOperationBusy ||
                                              (!canSelectKeepOriginal && !isKeepOriginal)
                                            }
                                            onChange={() =>
                                              handleToggleKeepOriginal(
                                                contract.destinationKey,
                                                Boolean(isKeepOriginal)
                                              )
                                            }
                                            style={{ width: "18px", height: "18px" }}
                                          />
                                          <span>Keep Original</span>
                                        </label>
                                      </div>
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: "15px", color: "#475569" }}>
                                      {contract.writeCapability === "UNVERIFIED_CONTRACT_HOLD"
                                        ? "Held read-only pending supported Shopify definition and writer evidence."
                                        : "Read-only in this batch."}
                                    </div>
                                  )}

                                  {/* SHORT PLAIN-LANGUAGE VISIBLE REASON FOR HOLDS OR ERRORS */}
                                  {shortNotice && contract.isWritableInBatch1 && (
                                    <div
                                      style={{
                                        marginTop: "10px",
                                        padding: "8px 10px",
                                        borderRadius: "6px",
                                        fontSize: "14px",
                                        fontWeight: 600,
                                        backgroundColor:
                                          shortNotice.tone === "error"
                                            ? "#fef2f2"
                                            : shortNotice.tone === "warning"
                                              ? "#fff7ed"
                                              : "#f1f5f9",
                                        color:
                                          shortNotice.tone === "error"
                                            ? "#991b1b"
                                            : shortNotice.tone === "warning"
                                              ? "#9a3412"
                                              : "#334155",
                                        border:
                                          shortNotice.tone === "error"
                                            ? "1px solid #fca5a5"
                                            : shortNotice.tone === "warning"
                                              ? "1px solid #fdba74"
                                              : "1px solid #cbd5e1"
                                      }}
                                    >
                                      {shortNotice.text}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* ACCESSIBLE PER-FIELD TECHNICAL DETAILS DISCLOSURE */}
                              <details
                                style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}
                              >
                                <summary style={{ cursor: "pointer", fontWeight: 600 }}>
                                  Details for {plainLabel}
                                </summary>
                                <div
                                  style={{
                                    ...DETAILS_PANEL_STYLE,
                                    padding: "10px 12px"
                                  }}
                                >
                                  <div>
                                    <strong>Destination Key:</strong>{" "}
                                    <code>{contract.destinationKey}</code> ({contract.owner})
                                    {contract.owner === "PRODUCTVARIANT" && (
                                      <>
                                        {" "}
                                        | <strong>Observed Variant GID:</strong>{" "}
                                        <code>{obs.variantId || "none"}</code>
                                        {obs.variantTargetStatus
                                          ? ` (${obs.variantTargetStatus})`
                                          : ""}
                                      </>
                                    )}
                                  </div>
                                  <div>
                                    <strong>Connection Status:</strong> {effectiveConnectionStatus}
                                  </div>
                                  <div>
                                    <strong>Review Status:</strong> {effectiveReviewStatus}
                                  </div>
                                  {hasProposalKey && (
                                    <div>
                                      <strong>Staged Draft Source:</strong>{" "}
                                      {proposalSource && proposalSource !== "None"
                                        ? proposalSource
                                        : "Source not reported"}{" "}
                                      | <strong>Exact Staged Value:</strong>{" "}
                                      <code>{proposedValue}</code>
                                    </div>
                                  )}
                                  {scanProposalMeta && (
                                    <div>
                                      <strong>Last AI Scan Suggestion:</strong> "
                                      {scanProposalMeta.value}" | <strong>Source:</strong>{" "}
                                      {typeof scanProposalMeta.source === "string" &&
                                      scanProposalMeta.source.trim() !== ""
                                        ? scanProposalMeta.source.trim()
                                        : "Source not reported"}{" "}
                                      | <strong>Outcome:</strong> {scanProposalMeta.disposition}
                                    </div>
                                  )}
                                  {effectiveStatusReason && (
                                    <div>
                                      <strong>Notes:</strong> {effectiveStatusReason}
                                    </div>
                                  )}
                                  <div>
                                    <strong>Allowed Type(s):</strong>{" "}
                                    <code>
                                      {(contract.allowedTypes || [contract.expectedType]).join(
                                        " | "
                                      )}
                                    </code>
                                    {contract.maxLength ? ` (max ${contract.maxLength} chars)` : ""}
                                  </div>
                                  <div>
                                    <strong>Observed Types:</strong> Live Definition={" "}
                                    <code>{obs.liveDefType || "none"}</code> | Stored={" "}
                                    <code>{obs.storedType || "none"}</code>
                                  </div>
                                  <div>
                                    <strong>Completeness:</strong> Metafields={" "}
                                    {obs.metafieldsCompleteState} | Definitions={" "}
                                    {obs.defsCompleteState}
                                  </div>
                                  <div>
                                    <strong>Raw Baseline Inspection:</strong>{" "}
                                    <code>{formatRawBaselineValueForInspection(obs)}</code>
                                  </div>
                                  {contract.unresolvedPolicyQuestion && (
                                    <div style={{ marginTop: "4px", color: "#9a3412" }}>
                                      <strong>Policy Note:</strong>{" "}
                                      {contract.unresolvedPolicyQuestion}
                                    </div>
                                  )}
                                </div>
                              </details>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
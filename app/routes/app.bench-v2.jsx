// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2 (BATCH 1 + MANUAL MEASUREMENTS + SETTING & HARDWARE)
// File: app/routes/app.bench-v2.jsx
//
// Verified Current Sources Confirmed in Context:
// 1. app/utils/bench-v2.contract.jsx (120,942 chars, SHA256: AF1820B2565627F83DFEA26BE343B447B6949EB1A20AE9615995379092CABEEB)
// 2. app/utils/bench-v2.baseline.server.jsx (43,102 chars, SHA256: 81590D25E0923983958813D4EC9E323EFD1B6C247711642770A1A378C5894CCA)
// 3. app/routes/app.meta-injector-api.jsx (SHA256: 929294D30480065ECA192AC1DCB7A128642FFA89879BEE5D97BAF6DA92296C75 — action intent="executeRepairPlan" with benchV2OptIn="true")
// 4. app/routes/app.meta-injector-autofill.jsx (698 chars — action delegates to executeAutofill)
// 5. app/utils/meta-injector.autofill.server.jsx (168,616 chars, SHA256: 039F7B2F8DED1E385A02A2640F540821B1638A8A95DAAC547AF83BC93C9E3AEF)
// 6. app/routes/app.bench-v2.jsx (Retained Route, SHA256: 47413FBEC6D29F931C52F498A83A7EDE07DD1D98A4487BC8788349653B77EBF2)
// 7. app/routes/app.meta-injector.matrix.jsx (231,797 chars — filter behavior reference only; never imported)
// 8. app/utils/meta-injector.matrix-domain.jsx (164,101 chars — FILTER_OPTIONS & predicate reference only; never imported)
//
// Authorized Connected Manual Measurements + Setting & Hardware Route Update:
// - Uses saved contract exports/interfaces (BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
//   contract.isManualOnlyNoAi, contract.usesYesNoMeaningDisplay, baselineDisplayValue,
//   proposedDisplayValue, and number_decimal validation).
// - Enables manual controls for custom.dimensions_mm and custom.weight_grams in Drawer 5
//   plus the 8 mapped Setting & Hardware destinations in Drawer 6, while keeping the
//   4 unverified measurement keepers on read-only hold and custom.overall_solid_length_in
//   permanently excluded.
// - Explicitly blocks ALL manual-measurement / manual-only destinations (including
//   dimensions_mm, weight_grams, collection_date, and the 4 held measurement keepers)
//   from AI Scan staging with a clear reported reason.
// - Renders user-facing Yes/No + actual meaning in ordinary Saved/Proposed displays and
//   option labels via the contract formatter while keeping exact raw values/types
//   internally for validation, exact approvals, Keep Original, save payloads, and Details.
// - Preserves Product Search & Picker, 11 Tab 3 FILTER_OPTIONS, fixed 120px by 120px
//   thumbnails, initially collapsed drawers, per-product drafts, exact approvals,
//   Keep Original, and explicit Save/AI Scan interfaces verbatim.
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
  CANCELLED_INERT_DESTINATIONS,
  isExactProductGid,
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

export const CANYON_RED_PRODUCT_GID = "gid://shopify/Product/9226849616123";

// Exact 11 FILTER_OPTIONS from app/utils/meta-injector.matrix-domain.jsx (lines 483-495)
// with readable labels and "All" as default.
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

// Exact 42 bare provenance keys allowed by parseProvenanceFieldSet in
// app/utils/meta-injector.autofill.server.jsx (lines 433-444).
// Any key outside this set causes parseProvenanceFieldSet to mark provenance invalid!
const ENGINE_ALLOWED_PROVENANCE_BARE_KEYS = Object.freeze([
  "color_pattern",
  "primary_color",
  "secondary_colors",
  "color",
  "dimensions_mm",
  "weight_grams",
  "shipping_weight_oz",
  "price",
  "honest_flaws_and_character",
  "character_marks",
  "surface_finish",
  "cut_type",
  "cut_and_shape",
  "stone_shape",
  "jewelry_finding_type",
  "bail_included",
  "chain_material",
  "wire_material",
  "secondary_medium",
  "primary_medium",
  "primary_use",
  "product_format",
  "jewelry_type",
  "necklace_design",
  "chain_link_type",
  "setting_ready",
  "craftsmanship",
  "poetic_hook",
  "seo_title",
  "alt_text",
  "google_product_category",
  "treated",
  "treatment_status",
  "stone_family",
  "material",
  "origin_location",
  "origin_handle",
  "origin_page_handle",
  "collection_name",
  "collection_location",
  "collection_date",
  "found_object",
  "is_one_of_a_kind",
  "is_ooak"
]);

// Explicit guard set for all manual-measurement and manual-only destinations
// (including held measurement keepers) so AI Scan never stages proposals into them.
const MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS = Object.freeze(
  new Set([
    ...(BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS || []),
    "custom.dimensions_mm",
    "custom.weight_grams",
    "custom.whole_product_weight_grams",
    "custom.chain_cord_length_in",
    "custom.accessory_dimensions_mm",
    "custom.fitting_opening_mm",
    "custom.collection_date"
  ])
);

function isManualOnlyNoAiDestination(destinationKey, contract = null) {
  if (!destinationKey || typeof destinationKey !== "string") return false;
  if (MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS.has(destinationKey)) return true;
  if (contract && (contract.isManualOnlyNoAi === true || contract.drawerId === "manual_measurements")) {
    return true;
  }
  return false;
}

// Lightweight single-page product list query patterned from Shopify Admin GraphQL
// products(first: 50, after: $cursor, query: $searchQuery), fetching ONLY id, title,
// and the single custom.piece_name metafield (zero whole-inventory manifest loading).
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

// Explicit Writer-Connection Holds:
// The five previously held Batch 1 custom destinations (custom.is_ooak,
// custom.stone_family, custom.cut_and_shape, custom.stone_shape, custom.color)
// plus custom.dimensions_mm, custom.weight_grams, and the 8 Drawer 6 Setting & Hardware
// destinations are supported by saved app/routes/app.meta-injector-api.jsx when
// executeRepairPlan is submitted with benchV2OptIn="true".
// Approval and save readiness still require all live definition, stored type,
// completeness, baseline, string-fidelity, and exact-value approval checks.
export const EXISTING_WRITER_CONNECTION_HOLDS = Object.freeze({});

export function isDestinationHeldByExistingWriter(destinationKey) {
  return Boolean(
    typeof destinationKey === "string" &&
      Object.prototype.hasOwnProperty.call(EXISTING_WRITER_CONNECTION_HOLDS, destinationKey)
  );
}

export function getExistingWriterHoldReason(destinationKey) {
  if (!isDestinationHeldByExistingWriter(destinationKey)) return null;
  return EXISTING_WRITER_CONNECTION_HOLDS[destinationKey];
}

// Existing executeRepairPlan in app/routes/app.meta-injector-api.jsx (line 822 & 935)
// applies String(val).trim() when comparing/writing values and strips leading "⚠️"
// via normalizeMetafieldValue (line 262). Since exact-value approval in Bench V2
// forbids silent value rewriting between approvedValue and what the writer stores,
// preflight blocks any proposal that would be altered by the existing writer's
// trim or warning-prefix strip.
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

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const isPickerOnly = url.searchParams.get("pickerOnly") === "1";
  const requestedProductId = url.searchParams.get("productId");
  const requestedCursor = url.searchParams.get("cursor");
  const requestedSearch = url.searchParams.get("q") || "";

  // Dedicated lightweight picker-only read path:
  // When searching or paging the product picker via pickerFetcher, load ONLY the
  // lightweight 50-item page without re-fetching the selected product's full baseline.
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
    return `[UNAVAILABLE — ${baselineObs.presence}]`;
  }
  if (baselineObs.presence === "absent") {
    return "[ABSENT — Verified Not Set on Product]";
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
    .replace(/\s*\(Saved Compatibility\s*—\s*Read-Only\)/gi, "")
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
    isWriterHeld,
    fidelityCheck
  } = row;

  if (!obs.evidenceAvailable) {
    if (obs.presence === "unknown_incomplete_read") {
      return {
        tone: "error",
        text: "Read incomplete — reload before editing."
      };
    }
    return {
      tone: "error",
      text: "Baseline not loaded."
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

  if (isWriterHeld) {
    return {
      tone: "warning",
      text: "Save on hold: current writer skips this field. Drafts stay in bench."
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

// Evaluates whether a Bench V2 evaluated row matches the selected Tab 3 filter
// option from app/utils/meta-injector.matrix-domain.jsx + app/routes/app.meta-injector.matrix.jsx,
// adapted honestly to Bench V2's actual row state and producerProposals source labels.
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
    isWriterHeld,
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
      isWriterHeld ||
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

  // Source-based filter options ("Shopify", "Gemini", "Vision", "Geo Library", "Derived", "Manual")
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
    return "Read-only parked and protected fields";
  }
  if (drawer.drawerId === "manual_measurements") {
    const writableCount = drawer.evaluatedRows.filter((r) => r.contract.isWritableInBatch1).length;
    const heldCount = drawer.evaluatedRows.length - writableCount;
    return `Manual-only (${writableCount} connected for manual entry, ${heldCount} unverified on hold — no AI scan staging)`;
  }
  if (drawer.drawerId === "conditional_setting_accessory") {
    return "Connected for manual entry & exact approval (AI Scan hardware suggestions pending producer map)";
  }
  if (drawer.isImplementedInBatch1) {
    return "Connected in Batch 1";
  }
  return "Read-only in Batch 1";
}

export default function BenchV2Route() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const writerFetcher = useFetcher();
  const aiScanFetcher = useFetcher();
  const pickerFetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeProductId = isExactProductGid(loaderData?.targetProductId)
    ? loaderData.targetProductId
    : CANYON_RED_PRODUCT_GID;

  // 1. Authoritative Baseline State (Strictly separated from proposals, keyed by Product GID)
  const [baselineByProduct, setBaselineByProduct] = useState(() => {
    const initialSnap = loaderData?.baselineSnapshot;
    if (initialSnap && isExactProductGid(initialSnap.productId)) {
      return { [initialSnap.productId]: initialSnap };
    }
    return {};
  });

  // 2. Known Product Metadata Cache (Keyed by exact Product GID so selected product
  // remains clearly identified with pieceName + full title even when absent from search results)
  const [knownProductsById, setKnownProductsById] = useState(() => {
    const map = {
      [CANYON_RED_PRODUCT_GID]: {
        id: CANYON_RED_PRODUCT_GID,
        title: "Canyon Red",
        pieceName: null
      }
    };
    const pageItems = loaderData?.selectorPage?.items;
    if (Array.isArray(pageItems)) {
      for (const item of pageItems) {
        if (item && isExactProductGid(item.id)) {
          map[item.id] = {
            id: item.id,
            title: typeof item.title === "string" ? item.title : item.id,
            pieceName:
              typeof item.pieceName === "string" && item.pieceName.trim() !== ""
                ? item.pieceName.trim()
                : null
          };
        }
      }
    }
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId)) {
      const snapPieceName =
        typeof snap.currentMetafields?.["custom.piece_name"] === "string" &&
        snap.currentMetafields["custom.piece_name"].trim() !== ""
          ? snap.currentMetafields["custom.piece_name"].trim()
          : map[snap.productId]?.pieceName || null;
      map[snap.productId] = {
        id: snap.productId,
        title: snap.productTitle || map[snap.productId]?.title || snap.productId,
        pieceName: snapPieceName
      };
    }
    return map;
  });

  // 3. Dedicated Product Search & Paginated Picker State
  // Searching/paging uses pickerFetcher so it NEVER switches the selected product or reloads its baseline.
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
  // Each entry: { value, source, origin: "Manual" | "AI", updatedAt }
  const [proposedByProduct, setProposedByProduct] = useState({});

  // 5. Held AI Alternatives State (Preserved per productId when an AI suggestion
  // conflicts with an existing human draft, approval, or Keep Original decision)
  const [aiAlternativesByProduct, setAiAlternativesByProduct] = useState({});

  // 6. Exact-Value Approval Records State (Preserved per productId)
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 7. Keep Original Decision Records State (Preserved per productId)
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

  // 11. Focus Retention State for Filtered Views (so a row being edited does not vanish mid-edit)
  const [retainedFieldEditorsByProduct, setRetainedFieldEditorsByProduct] = useState({});
  const blurClearTimersRef = useRef(new Map());
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
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

  // Keep latest state refs for safe asynchronous AI Scan reconciliation
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

  // Synchronize fresh loader baseline snapshots and initial selector page items
  // without erasing pending manual drafts, AI alternatives, or approvals for any product.
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
        // Only initialize from loaderData if picker hasn't already navigated to a custom search/page
        if (
          prev.appliedSearch === (loaderData.selectorPage.appliedSearch || "") &&
          prev.requestedCursor === (loaderData.selectorPage.requestedCursor || null)
        ) {
          return loaderData.selectorPage;
        }
        return prev;
      });
    }

    setKnownProductsById((prev) => {
      const next = { ...prev };
      const pageItems = loaderData?.selectorPage?.items;
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
    });
  }, [loaderData?.baselineSnapshot, loaderData?.selectorPage, loaderData?.loadedAt, loaderData?.pickerOnly]);

  // Synchronize pickerFetcher results when searching or paging product inventory
  useEffect(() => {
    if (pickerFetcher.state !== "idle" || !pickerFetcher.data) return;
    const fetchedPage = pickerFetcher.data.selectorPage;
    if (!fetchedPage || typeof fetchedPage !== "object") return;

    setPickerPageState(fetchedPage);
    if (Array.isArray(fetchedPage.items) && fetchedPage.items.length > 0) {
      setKnownProductsById((prev) => {
        const next = { ...prev };
        for (const item of fetchedPage.items) {
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
        return next;
      });
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

  // Selected product display metadata (pieceName when available, plus full title)
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

  // Extract selected product's loaded MediaImage items strictly from currentBaseline
  // (where currentBaseline is already verified to match activeProductId).
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

  // ==========================================================================
  // LIGHTWEIGHT PRODUCT SEARCH & PAGINATION HANDLERS (via pickerFetcher)
  // - Never switches activeProductId or reloads full baseline.
  // - Resets cursor history when search changes.
  // - Retains committed search query when paging.
  // ==========================================================================
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

  // Product Selection Handler:
  // - Blocks switching during an active Save or active AI Scan.
  // - Selects strictly by exact Product GID.
  // - Preserves all drafts, AI alternatives, approvals, and Keep Original records across products.
  // - Never triggers Save, approval, proposal generation, or AI calls.
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

  // ==========================================================================
  // EXPLICIT AI SCAN HANDLER (Calls existing /app/meta-injector-autofill
  // with intent="tab3FullRescan" and benchV2OptIn="true")
  // ==========================================================================
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

    // Build operator_locked_fields and passive_stored_fields using ONLY the 42
    // bare keys accepted by parseProvenanceFieldSet in meta-injector.autofill.server.jsx.
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

    // Build observed_destination_types and explicit OOAK observed type parameters
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

  // ==========================================================================
  // AI SCAN COMPLETION EFFECT:
  // - Validates exact requestId and pieceId before accepting any result.
  // - Consumes ONLY rawResponse.producerProposals (never tab3Data fallbacks).
  // - Explicitly ignores/blocks any proposal for manual-measurement or manual-only
  //   destinations (including held measurement keepers) and reports a clear reason.
  // - Carries actual producerProposals[destKey].source metadata into both
  //   breakdown lines and per-destination scan metadata (using "Source not reported"
  //   when absent, never inferring provenance from baseline equality or field name).
  // - Preserves manual drafts, approvals, Keep Original, and other products' state.
  // - Conflicting AI proposals are stored in aiAlternativesByProduct[productId]
  //   for explicit operator choice rather than overwriting human work.
  // ==========================================================================
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

    if (!rawResponse || typeof rawResponse !== "object") {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary: "AI Scan failed: no structured response returned by /app/meta-injector-autofill.",
          receivedCount: 0,
          stagedCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics: {},
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
      return;
    }

    const returnedRequestId = rawResponse.requestId || null;
    const returnedPieceId = rawResponse.pieceId || rawResponse.productId || null;

    if (returnedRequestId !== pendingScan.requestId || returnedPieceId !== scannedProductId) {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary: `Ignored mismatched or stale AI Scan response (expected product ${scannedProductId} / request ${pendingScan.requestId}, got product ${String(
            returnedPieceId
          )} / request ${String(returnedRequestId)}).`,
          receivedCount: 0,
          stagedCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics: {},
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
      return;
    }

    if (rawResponse.success !== true) {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary: rawResponse.error || "AI Scan returned an error.",
          receivedCount: 0,
          stagedCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics:
            rawResponse.producerDiagnostics && typeof rawResponse.producerDiagnostics === "object"
              ? rawResponse.producerDiagnostics
              : {},
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
      return;
    }

    const rawProducerProposals = rawResponse.producerProposals;
    if (
      !rawProducerProposals ||
      typeof rawProducerProposals !== "object" ||
      Array.isArray(rawProducerProposals)
    ) {
      setLastAiScanReportByProduct((prev) => ({
        ...prev,
        [scannedProductId]: {
          requestId: pendingScan.requestId,
          productId: scannedProductId,
          completedAt: new Date().toISOString(),
          ok: false,
          summary:
            "AI Scan response did not include producerProposals separation map; refused to stage tab3Data fallbacks.",
          receivedCount: 0,
          stagedCount: 0,
          heldConflictCount: 0,
          unchangedSkippedCount: 0,
          rejectedInvalidCount: 0,
          ignoredManualOnlyCount: 0,
          diagnostics: {},
          details: [],
          proposalsByDestination: {}
        }
      }));
      setActiveAiScanRequest(null);
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

      // Explicit Manual Measurement / Manual-Only AI Exclusion Gate:
      // Never stage AI suggestions into any manual measurement or manual-only destination
      // (including custom.dimensions_mm, custom.weight_grams, custom.collection_date,
      // and the 4 held measurement keepers). Report a clear reason in the scan breakdown.
      if (isManualOnlyNoAiDestination(destKey, contract)) {
        ignoredManualOnlyCount++;
        const manualReason =
          contract?.drawerId === "manual_measurements"
            ? "Manual measurement field — excluded from AI staging; enter physical measurement manually."
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

      // Check if this field already has a human draft, active approval, or active Keep Original decision
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

      // Field is untouched (or only had an unapproved prior AI draft): stage as an unapproved AI draft
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
        ? `, ${ignoredManualOnlyCount} manual-only measurement suggestion${
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

  // Explicit Handler to Accept a Held AI Alternative on a Field
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

    // Accepting the new value invalidates any prior approval or Keep Original on that field
    // so the new AI draft starts strictly unapproved
    setApprovalsByProduct((prev) => {
      const prodApprovals = prev[activeProductId];
      if (!prodApprovals || !prodApprovals[destinationKey]) return prev;
      const nextApprovals = { ...prodApprovals };
      delete nextApprovals[destinationKey];
      return { ...prev, [activeProductId]: nextApprovals };
    });

    setKeepOriginalByProduct((prev) => {
      const prodKeep = prev[activeProductId];
      if (!prodKeep || !prodKeep[destinationKey]) return prev;
      const nextKeep = { ...prodKeep };
      delete nextKeep[destinationKey];
      return { ...prev, [activeProductId]: nextKeep };
    });

    setAiAlternativesByProduct((prev) => {
      const prodAlts = { ...(prev[activeProductId] || {}) };
      delete prodAlts[destinationKey];
      return { ...prev, [activeProductId]: prodAlts };
    });
  };

  const handleDismissAiAlternative = (destinationKey) => {
    setAiAlternativesByProduct((prev) => {
      const prodAlts = { ...(prev[activeProductId] || {}) };
      delete prodAlts[destinationKey];
      return { ...prev, [activeProductId]: prodAlts };
    });
  };

  // Handle writerFetcher completion: match exact productId & submissionId,
  // interpret only actual returned writer outcomes, preserve unrelated drafts,
  // and trigger a fresh baseline revalidation so types/definitions/signatures stay true.
  useEffect(() => {
    if (writerFetcher.state !== "idle") return;
    const pendingSub = activeSaveSubmissionRef.current;
    if (!pendingSub) return;

    const rawResponse = writerFetcher.data;
    if (processedSubmissionIdRef.current === pendingSub.submissionId) {
      return;
    }

    // Even if writerFetcher.data is undefined (e.g., network drop or unhandled 500),
    // never assume failed request means zero writes occurred on Shopify.
    processedSubmissionIdRef.current = pendingSub.submissionId;

    const submittedProductId = pendingSub.productId;
    const submittedDestinations = pendingSub.submittedDestinations || [];
    const submittedValuesByDest = pendingSub.submittedValuesByDestination || {};

    if (!rawResponse || typeof rawResponse !== "object") {
      setLastSaveReport({
        submissionId: pendingSub.submissionId,
        productId: submittedProductId,
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

    // Identify any submitted destination that was neither verified, blocked, skipped,
    // unsupported, nor unchanged (e.g. if a mutation failed mid-batch or read-back was incomplete).
    const unconfirmedDestinations = submittedDestinations.filter(
      (dest) =>
        !verifiedSet.has(dest) &&
        !Object.prototype.hasOwnProperty.call(blockedFields, dest) &&
        !skippedKeys.includes(dest) &&
        !unsupportedKeys.includes(dest) &&
        !unchangedList.includes(dest)
    );

    // Reconcile baseline currentMetafields for positively verified destinations
    // ONLY on submittedProductId, while preserving existing types/definitions
    // and triggering a full loader revalidation for complete fresh evidence.
    if (
      rawResponse.currentMetafields &&
      typeof rawResponse.currentMetafields === "object" &&
      !Array.isArray(rawResponse.currentMetafields)
    ) {
      setBaselineByProduct((prev) => {
        const existingSnap = prev[submittedProductId];
        if (!existingSnap || existingSnap.productId !== submittedProductId) return prev;
        const updatedMetafields = { ...(existingSnap.currentMetafields || {}) };
        const updatedTypes = { ...(existingSnap.currentMetafieldTypes || {}) };

        for (const vDest of verifiedList) {
          if (Object.prototype.hasOwnProperty.call(rawResponse.currentMetafields, vDest)) {
            updatedMetafields[vDest] = rawResponse.currentMetafields[vDest];
            const liveType = existingSnap.liveDefinitions?.[vDest]?.type || null;
            if (!updatedTypes[vDest] && liveType) {
              updatedTypes[vDest] = liveType;
            }
          }
        }

        return {
          ...prev,
          [submittedProductId]: {
            ...existingSnap,
            currentMetafields: updatedMetafields,
            currentMetafieldTypes: updatedTypes,
            loadedAt: new Date().toISOString()
          }
        };
      });
    }

    // Clear proposals and approvals ONLY on submittedProductId for destinations
    // that were positively verified on read-back AND whose current draft still
    // matches the exact value that was submitted.
    if (verifiedSet.size > 0) {
      setProposedByProduct((prev) => {
        const prodMap = { ...(prev[submittedProductId] || {}) };
        for (const vDest of verifiedSet) {
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
    // Trigger full single-product baseline revalidation so metafieldsReadComplete,
    // currentMetafieldTypes, and liveDefinitions are refreshed from Shopify.
    revalidator.revalidate();
  }, [writerFetcher.state, writerFetcher.data, revalidator]);

  // Manual Proposal Edit Handler:
  // Preserves exact untrimmed string in proposedByProduct[activeProductId] with
  // origin="Manual" and immediately invalidates any prior Approval or Keep Original
  // record for that destination.
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

    // Changing a proposal immediately invalidates prior approval and Keep Original
    setApprovalsByProduct((prev) => {
      const prodApprovals = prev[activeProductId];
      if (!prodApprovals || !prodApprovals[destinationKey]) return prev;
      const nextApprovals = { ...prodApprovals };
      delete nextApprovals[destinationKey];
      return { ...prev, [activeProductId]: nextApprovals };
    });

    setKeepOriginalByProduct((prev) => {
      const prodKeep = prev[activeProductId];
      if (!prodKeep || !prodKeep[destinationKey]) return prev;
      const nextKeep = { ...prodKeep };
      delete nextKeep[destinationKey];
      return { ...prev, [activeProductId]: nextKeep };
    });
  };

  // Clear Staged Draft Proposal Handler (Restores row to Unchanged without touching saved baseline)
  const handleClearDraftProposal = (destinationKey) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      delete prodMap[destinationKey];
      return { ...prev, [activeProductId]: prodMap };
    });

    setApprovalsByProduct((prev) => {
      const prodApprovals = { ...(prev[activeProductId] || {}) };
      delete prodApprovals[destinationKey];
      return { ...prev, [activeProductId]: prodApprovals };
    });

    setKeepOriginalByProduct((prev) => {
      const prodKeep = { ...(prev[activeProductId] || {}) };
      delete prodKeep[destinationKey];
      return { ...prev, [activeProductId]: prodKeep };
    });
  };

  // Toggle Exact-Value Approval (Mutually exclusive with Keep Original)
  const handleToggleApproval = (destinationKey, currentlyApproved) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyApproved) {
      setApprovalsByProduct((prev) => {
        const prodApprovals = { ...(prev[activeProductId] || {}) };
        delete prodApprovals[destinationKey];
        return { ...prev, [activeProductId]: prodApprovals };
      });
      return;
    }

    if (isDestinationHeldByExistingWriter(destinationKey)) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: `Save on hold for ${destinationKey}`,
        reasons: [getExistingWriterHoldReason(destinationKey)]
      });
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

    // Mutually exclude Keep Original when approving
    setKeepOriginalByProduct((prev) => {
      const prodKeep = prev[activeProductId];
      if (!prodKeep || !prodKeep[destinationKey]) return prev;
      const nextKeep = { ...prodKeep };
      delete nextKeep[destinationKey];
      return { ...prev, [activeProductId]: nextKeep };
    });

    setApprovalsByProduct((prev) => ({
      ...prev,
      [activeProductId]: {
        ...(prev[activeProductId] || {}),
        [destinationKey]: created.record
      }
    }));
  };

  // Toggle Keep Original Decision (Mutually exclusive with Approve; binds rejected proposal & baseline signature)
  const handleToggleKeepOriginal = (destinationKey, currentlyKeepOriginal) => {
    setClientPrevalidationBanner(null);
    releaseRetainedFieldEditor(activeProductId, destinationKey);

    if (currentlyKeepOriginal) {
      setKeepOriginalByProduct((prev) => {
        const prodKeep = { ...(prev[activeProductId] || {}) };
        delete prodKeep[destinationKey];
        return { ...prev, [activeProductId]: prodKeep };
      });
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

    // Mutually exclude Approve when selecting Keep Original
    setApprovalsByProduct((prev) => {
      const prodApprovals = prev[activeProductId];
      if (!prodApprovals || !prodApprovals[destinationKey]) return prev;
      const nextApprovals = { ...prodApprovals };
      delete nextApprovals[destinationKey];
      return { ...prev, [activeProductId]: nextApprovals };
    });

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

  // Evaluate all rows across all 11 drawers for the selected product, then compute
  // view-only filter matches (never mutating underlying rows, drafts, or decisions).
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

      const writerHoldReason = getExistingWriterHoldReason(destKey);
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

      // Override connectionStatus and save readiness if held by existing writer skip/retirement list
      let effectiveConnectionStatus = baseEval.connectionStatus;
      let effectiveReviewStatus = baseEval.reviewStatus;
      let effectiveStatusReason = baseEval.statusReason;

      if (fieldContract.isWritableInBatch1 && writerHoldReason) {
        effectiveConnectionStatus =
          "Held (Writer Connection Hold — Skipped by Current /app/meta-injector-api)";
        if (baseEval.hasProposalKey && !baseEval.isKeepOriginal) {
          effectiveReviewStatus = "Draft Staged (Held — Writer Skip Guard Active)";
          effectiveStatusReason = writerHoldReason;
        } else if (!baseEval.hasProposalKey) {
          effectiveStatusReason = `${writerHoldReason} ${fieldContract.purposeNote || ""}`.trim();
        }
      } else if (
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
        isWriterHeld: Boolean(writerHoldReason),
        writerHoldReason,
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

  // Summarize selected product's review state across ALL rows (never reduced by view filter)
  const allEvaluatedRows = evaluatedDrawerGroups.flatMap((d) => d.evaluatedRows);
  const totalVisibleFilteredRowCount = evaluatedDrawerGroups.reduce(
    (acc, d) => acc + d.visibleRows.length,
    0
  );
  const stagedProposalRows = allEvaluatedRows.filter((r) => r.hasProposalKey);
  const validApprovedRows = allEvaluatedRows.filter(
    (r) => r.isApproved && !r.isWriterHeld && r.fidelityCheck.faithful
  );
  const keepOriginalRows = allEvaluatedRows.filter((r) => r.isKeepOriginal);
  const heldAiAlternativesCount = Object.keys(currentAiAlternativesMap).length;

  // Explicit Save Handler:
  // - Never runs on mount, selection, AI scan, or edit.
  // - Prevalidates every entry in currentApprovalsMap for activeProductId; if ANY
  //   approved entry is invalid, stale, writer-held, or fails writer string-fidelity,
  //   stops the entire submission rather than silently filtering it out.
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
          "No fields are approved for this product. Edit or review a connected field in Drawers 1 to 6 and check Approve before clicking Save."
        ]
      });
      return;
    }

    const prevalidationErrors = [];
    const safePlanToSubmit = {};

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

      if (isDestinationHeldByExistingWriter(destKey)) {
        prevalidationErrors.push(
          `[${destKey}] ${getExistingWriterHoldReason(destKey)}`
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

      safePlanToSubmit[destKey] = validation.normalizedValue;
    }

    // Complete prevalidation gate: if ANY approved entry failed preflight, stop
    // the entire submission (never silently drop a blocked approved field).
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
      submittedDestinations,
      submittedValuesByDestination: { ...safePlanToSubmit },
      startedAt: new Date().toISOString()
    };

    setActiveSaveSubmission(submissionMeta);

    const formData = new FormData();
    formData.append("intent", "executeRepairPlan");
    formData.append("benchV2OptIn", "true");
    formData.append("pieceId", activeProductId);
    formData.append("repairPlan", JSON.stringify(safePlanToSubmit));
    formData.append("nativeChanges", JSON.stringify({}));
    formData.append("legacyKeysToRemove", JSON.stringify([]));

    writerFetcher.submit(formData, {
      method: "POST",
      action: "/app/meta-injector-api"
    });
  };

  const hasBaselineErrors = Boolean(
    loaderData?.selectionError ||
      pickerPageState?.error ||
      loaderData?.loadError ||
      (Array.isArray(currentBaseline?.errors) && currentBaseline.errors.length > 0) ||
      currentBaseline?.metafieldsReadComplete !== true ||
      currentBaseline?.defsReadComplete !== true
  );

  const pickerItems = Array.isArray(pickerPageState?.items) ? pickerPageState.items : [];
  const isSelectedProductInCurrentPickerPage = pickerItems.some(
    (item) => item.id === activeProductId
  );

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
                      style={{
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
                      }}
                    >
                      <img
                        src={mediaItem.url}
                        alt={accessibleAlt}
                        title={accessibleAlt}
                        width={120}
                        height={120}
                        style={{
                          width: "120px",
                          height: "120px",
                          minWidth: "120px",
                          minHeight: "120px",
                          objectFit: "cover",
                          objectPosition: "center",
                          display: "block"
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ACCESSIBLE PRODUCT SEARCH & READABLE PICKER (REPLACES DENSE SELECT DROPDOWN) */}
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

            {/* ALWAYS-VISIBLE CURRENTLY SELECTED PRODUCT SUMMARY WHEN ABSENT FROM RESULTS PAGE */}
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

            {/* READABLE PRODUCT RESULTS LIST (LARGE MIXED-CASE LABELS, COMFORTABLE SPACING) */}
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
                      disabled={
                        isAnyOperationBusy ||
                        isPickerLoading ||
                        pickerCursorHistory.length === 0
                      }
                      style={{
                        padding: "8px 14px",
                        fontSize: "15px",
                        fontWeight: 600,
                        backgroundColor:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          pickerCursorHistory.length === 0
                            ? "#e2e8f0"
                            : "#ffffff",
                        color:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          pickerCursorHistory.length === 0
                            ? "#64748b"
                            : "#0f172a",
                        border: "2px solid #64748b",
                        borderRadius: "6px",
                        cursor:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          pickerCursorHistory.length === 0
                            ? "not-allowed"
                            : "pointer"
                      }}
                    >
                      Previous 50
                    </button>

                    <span style={{ fontSize: "15px", fontWeight: 700, color: "#1e293b" }}>
                      Page {pickerCursorHistory.length + 1}
                    </span>

                    <button
                      type="button"
                      onClick={handleNextProductPage}
                      disabled={
                        isAnyOperationBusy ||
                        isPickerLoading ||
                        !pickerPageState?.pageInfo?.hasNextPage ||
                        !pickerPageState?.pageInfo?.endCursor
                      }
                      style={{
                        padding: "8px 14px",
                        fontSize: "15px",
                        fontWeight: 600,
                        backgroundColor:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          !pickerPageState?.pageInfo?.hasNextPage ||
                          !pickerPageState?.pageInfo?.endCursor
                            ? "#e2e8f0"
                            : "#ffffff",
                        color:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          !pickerPageState?.pageInfo?.hasNextPage ||
                          !pickerPageState?.pageInfo?.endCursor
                            ? "#64748b"
                            : "#0f172a",
                        border: "2px solid #64748b",
                        borderRadius: "6px",
                        cursor:
                          isAnyOperationBusy ||
                          isPickerLoading ||
                          !pickerPageState?.pageInfo?.hasNextPage ||
                          !pickerPageState?.pageInfo?.endCursor
                            ? "not-allowed"
                            : "pointer"
                      }}
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
                style={{
                  padding: "8px 14px",
                  fontSize: "15px",
                  fontWeight: 600,
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #64748b",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
              >
                Open All Drawers
              </button>
              <button
                type="button"
                onClick={() => handleSetAllDrawers(false)}
                style={{
                  padding: "8px 14px",
                  fontSize: "15px",
                  fontWeight: 600,
                  backgroundColor: "#f8fafc",
                  color: "#0f172a",
                  border: "1px solid #64748b",
                  borderRadius: "6px",
                  cursor: "pointer"
                }}
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
            Drawers 1 to 6 are connected for manual edits and exact-value approval where
            Shopify type/completeness evidence is verified. In Drawer 5 (Manual Measurements),{" "}
            <strong>Dimensions (mm)</strong> and <strong>Weight (grams)</strong> are manual-only
            (excluded from AI Scan staging), while the 4 unverified measurement keepers remain on
            read-only hold. Drawer 6 (Setting and Hardware) is connected for manual edits and
            ready for AI Scan suggestions once the server producer map includes Drawer 6 keys.
            Filtering is view-only and never clears drafts or decisions.
          </div>

          <details style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              System and Product Details
            </summary>
            <div
              style={{
                marginTop: "8px",
                padding: "10px 14px",
                backgroundColor: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "6px"
              }}
            >
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
                <strong>Read Completeness:</strong> Metafields={" "}
                {String(currentBaseline?.metafieldsReadComplete)} | Definitions={" "}
                {String(currentBaseline?.defsReadComplete)} | Native={" "}
                {String(currentBaseline?.nativeTargets?.isComplete)}
              </div>
              <div>
                <strong>Loaded At:</strong> {currentBaseline?.loadedAt || "Not loaded"} |{" "}
                <strong>Contract:</strong> {BENCH_V2_CONTRACT_VERSION}
              </div>
            </div>
          </details>
        </header>

        {/* IMPORTANT BASELINE / SELECTOR ERRORS (SHOWN ONLY WHEN PRESENT) */}
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
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}
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
                style={{
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "1px solid #475569",
                  borderRadius: "6px",
                  padding: "4px 12px",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600
                }}
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
                  padding: "6px 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                  borderRadius: "6px",
                  border: "1px solid #475569",
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  cursor: "pointer"
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
                  <strong>Product GID:</strong> <code>{lastSaveReport.productId}</code> |{" "}
                  <strong>Submission ID:</strong> {lastSaveReport.submissionId} |{" "}
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
              (r) => r.isApproved && !r.isWriterHeld && r.fidelityCheck.faithful
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
                            isWriterHeld,
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
                            !isWriterHeld &&
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
                            inputPlaceholder = "Editing locked until baseline loads";
                          } else if (contract.destinationKey === "custom.dimensions_mm") {
                            inputPlaceholder = "Enter manual measurement (e.g. 38 x 24 x 6 mm)...";
                          } else if (contract.destinationKey === "custom.weight_grams") {
                            inputPlaceholder = "Enter manual scale weight in grams (e.g. 14.5)...";
                          }

                          let cardBorder = "1px solid #cbd5e1";
                          let cardBg = "#ffffff";
                          if (isApproved && !isWriterHeld) {
                            cardBorder = "2px solid #15803d";
                            cardBg = "#f0fdf4";
                          } else if (
                            hasProposalKey &&
                            (!validation?.valid || !fidelityCheck.faithful || isWriterHeld)
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
                                  {isManualOnlyField && contract.isWritableInBatch1 && (
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
                                  {isApproved && !isWriterHeld
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

                              {/* SAVED VS. PROPOSED SIDE-BY-SIDE (STACKS ON NARROW SCREENS) */}
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

                                      {/* HELD AI ALTERNATIVE CHOICE BOX (WHEN AI SUGGESTION CONFLICTS WITH HUMAN DRAFT/DECISION) */}
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
                                            checked={Boolean(isApproved && !isWriterHeld)}
                                            disabled={
                                              isAnyOperationBusy ||
                                              (!canApproveForSave && !isApproved)
                                            }
                                            onChange={() =>
                                              handleToggleApproval(
                                                contract.destinationKey,
                                                Boolean(isApproved && !isWriterHeld)
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
                                    marginTop: "8px",
                                    padding: "10px 12px",
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px"
                                  }}
                                >
                                  <div>
                                    <strong>Destination Key:</strong>{" "}
                                    <code>{contract.destinationKey}</code> ({contract.owner})
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
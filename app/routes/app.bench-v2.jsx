// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2 (FIRST CONNECTED BATCH)
// File: app/routes/app.bench-v2.jsx
//
// Verified Current Sources Confirmed in Context:
// 1. app/utils/bench-v2.contract.jsx (112,497 chars, SHA256: F31EF4BC321AFC20A3696E53686EAD076D8583B8962D24EA667AC6D7DF144DBA)
// 2. app/utils/bench-v2.baseline.server.jsx (43,102 chars, SHA256: 81590D25E0923983958813D4EC9E323EFD1B6C247711642770A1A378C5894CCA)
// 3. app/routes/app.meta-injector-api.jsx (138,970 chars — action intent="executeRepairPlan")
// 4. app/routes/app.bench-v2.jsx (86,970 chars — saved accessible route)
// 5. app/utils/meta-injector.loader.jsx (36,750 chars — reference for products(first: 50, after: $cursor) read pattern only; never imported)
//
// Inventory Selector & Accessibility Guarantees:
// - Restores a compact, accessible top Product Selector using lightweight
//   paginated product IDs and titles (products(first: 50, after: $cursor)).
// - Zero fetchAllProducts loop and zero whole-inventory manifest loading.
// - Selects strictly by exact Shopify Product GID; Canyon Red
//   (gid://shopify/Product/9226849616123) is the initial default when no
//   productId query parameter is supplied.
// - Loads full baseline ONLY for the single selected product via
//   loadSingleProductBaselineSnapshot(admin, targetProductId).
// - Preserves per-product drafts, exact-value approvals, and Keep Original
//   decisions across product switches without clearing or cross-contaminating.
// - Blocks product switching and page navigation while a Save is in flight.
// - Preserves all dyslexia/glaucoma accessibility improvements: initially
//   collapsed drawers, plain titles, side-by-side Saved/Proposed boxes,
//   nearby Approve/Keep Original checkboxes, short plain-language notices,
//   and per-field Details disclosures.
// ==========================================================================

import React, { useState, useEffect, useRef } from "react";
import { useLoaderData, useFetcher, useRevalidator, useSearchParams } from "react-router";
import { authenticate } from "../shopify.server";
import { loadSingleProductBaselineSnapshot } from "../utils/bench-v2.baseline.server.jsx";
import {
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_DRAWER_GROUPS,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
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

// Lightweight single-page product list query patterned directly from
// GET_PRODUCTS_QUERY in app/utils/meta-injector.loader.jsx, stripped to
// id and title only (no fetchAllProducts loop, no metafield/variant preload).
const GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY = `
  query GetLightweightProductsPage($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

async function loadLightweightProductPage(admin, cursor = null) {
  const normalizedCursor =
    typeof cursor === "string" && cursor.trim() !== "" ? cursor.trim() : null;

  try {
    const res = await admin.graphql(GET_LIGHTWEIGHT_PRODUCT_PAGE_QUERY, {
      variables: { cursor: normalizedCursor }
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
        items.push({
          id: node.id,
          title: typeof node.title === "string" && node.title.trim() !== "" ? node.title : node.id
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
      error: `Failed to load product selector page: ${err.message}`
    };
  }
}

// Explicit Writer-Connection Holds:
// Verified in retained app/routes/app.meta-injector-api.jsx:
// - custom.cut_and_shape, custom.stone_shape, and custom.color are in RETIRED_KEYS (lines 50-55)
//   and pushed to skippedKeys in executeRepairPlan (line 795).
// - custom.is_ooak is in the companion skip guard in executeRepairPlan (line 801)
//   and pushed to skippedKeys.
// Per scope rules, these 4 fields are NOT retired in the contract, and both OOAK
// destinations remain distinct, but they are held from save-ready status and
// blocked from submission until the shared writer endpoint is explicitly updated.
export const EXISTING_WRITER_CONNECTION_HOLDS = Object.freeze({
  "custom.is_ooak":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (executeRepairPlan line 801) currently pushes custom.is_ooak into skippedKeys. Held from Save until the writer skip guard is unlocked.",
  "custom.cut_and_shape":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.cut_and_shape into skippedKeys. Held from Save until the writer retirement list is updated.",
  "custom.stone_shape":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.stone_shape into skippedKeys. Held from Save until the writer retirement list is updated.",
  "custom.color":
    "Writer Connection Hold: Existing POST /app/meta-injector-api (RETIRED_KEYS line 50 / executeRepairPlan line 795) currently pushes custom.color into skippedKeys. Held from Save until the writer retirement list is updated."
});

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
  const requestedProductId = url.searchParams.get("productId");
  const requestedCursor = url.searchParams.get("cursor");

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
    loadLightweightProductPage(admin, requestedCursor),
    loadSingleProductBaselineSnapshot(admin, targetProductId)
  ]);

  return Response.json({
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

function formatReadableSavedValue(baselineObs, isOoakRow, baselineDisplayValue) {
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
  if (isOoakRow && baselineDisplayValue) {
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

export default function BenchV2Route() {
  const loaderData = useLoaderData();
  const revalidator = useRevalidator();
  const writerFetcher = useFetcher();
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

  // 2. Known Product Titles Cache (Keyed by exact Product GID so selected product
  // remains visible in the selector even when browsing another cursor page)
  const [knownProductsById, setKnownProductsById] = useState(() => {
    const map = {
      [CANYON_RED_PRODUCT_GID]: "Canyon Red"
    };
    const pageItems = loaderData?.selectorPage?.items;
    if (Array.isArray(pageItems)) {
      for (const item of pageItems) {
        if (item && isExactProductGid(item.id) && typeof item.title === "string") {
          map[item.id] = item.title;
        }
      }
    }
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId) && snap.productTitle) {
      map[snap.productId] = snap.productTitle;
    }
    return map;
  });

  // 3. Cursor History Stack for Plain Previous / Next Page Navigation
  const [cursorHistory, setCursorHistory] = useState([]);

  // 4. Manual Proposals State (Never pre-seeded from baseline, preserved per productId)
  const [proposedByProduct, setProposedByProduct] = useState({});

  // 5. Exact-Value Approval Records State (Preserved per productId)
  const [approvalsByProduct, setApprovalsByProduct] = useState({});

  // 6. Keep Original Decision Records State (Preserved per productId)
  const [keepOriginalByProduct, setKeepOriginalByProduct] = useState({});

  // 7. Save Request Tracking & Honest Outcome Reporting
  const [activeSaveSubmission, setActiveSaveSubmission] = useState(null);
  const [lastSaveReport, setLastSaveReport] = useState(null);
  const [clientPrevalidationBanner, setClientPrevalidationBanner] = useState(null);
  const processedSubmissionIdRef = useRef(null);
  const activeSaveSubmissionRef = useRef(null);

  // 8. Presentation-Only State: All drawers initially collapsed
  const [openDrawersById, setOpenDrawersById] = useState(() =>
    BENCH_V2_DRAWER_GROUPS.reduce((acc, drawer) => {
      acc[drawer.drawerId] = false;
      return acc;
    }, {})
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

  // Synchronize fresh loader baseline snapshots and selector page titles
  // without erasing pending manual drafts or approvals for any product.
  useEffect(() => {
    const snap = loaderData?.baselineSnapshot;
    if (snap && isExactProductGid(snap.productId)) {
      setBaselineByProduct((prev) => ({
        ...prev,
        [snap.productId]: snap
      }));
    }

    setKnownProductsById((prev) => {
      const next = { ...prev };
      const pageItems = loaderData?.selectorPage?.items;
      if (Array.isArray(pageItems)) {
        for (const item of pageItems) {
          if (item && isExactProductGid(item.id) && typeof item.title === "string") {
            next[item.id] = item.title;
          }
        }
      }
      if (snap && isExactProductGid(snap.productId) && snap.productTitle) {
        next[snap.productId] = snap.productTitle;
      }
      return next;
    });
  }, [loaderData?.baselineSnapshot, loaderData?.selectorPage, loaderData?.loadedAt]);

  const currentBaseline =
    baselineByProduct[activeProductId] &&
    baselineByProduct[activeProductId].productId === activeProductId
      ? baselineByProduct[activeProductId]
      : loaderData?.baselineSnapshot?.productId === activeProductId
        ? loaderData.baselineSnapshot
        : null;

  const currentProposedMap = proposedByProduct[activeProductId] || {};
  const currentApprovalsMap = approvalsByProduct[activeProductId] || {};
  const currentKeepOriginalMap = keepOriginalByProduct[activeProductId] || {};

  const isWriterBusy = writerFetcher.state !== "idle" || Boolean(activeSaveSubmission);
  const isBaselineReloading = revalidator.state !== "idle";

  const currentSelectorCursor = searchParams.get("cursor") || null;
  const selectorPage = loaderData?.selectorPage || {
    ok: false,
    items: [],
    pageInfo: { hasNextPage: false, endCursor: null },
    requestedCursor: null,
    error: null
  };

  // Build dropdown options from the current page of products, plus ensure the
  // currently active product is always present as an option by exact GID.
  const selectorOptions = React.useMemo(() => {
    const pageItems = Array.isArray(selectorPage.items) ? selectorPage.items : [];
    const hasActiveInPage = pageItems.some((item) => item.id === activeProductId);
    const list = [...pageItems];

    if (!hasActiveInPage && isExactProductGid(activeProductId)) {
      const fallbackTitle =
        currentBaseline?.productTitle ||
        knownProductsById[activeProductId] ||
        (activeProductId === CANYON_RED_PRODUCT_GID ? "Canyon Red" : activeProductId);
      list.unshift({
        id: activeProductId,
        title: fallbackTitle
      });
    }
    return list;
  }, [selectorPage.items, activeProductId, currentBaseline?.productTitle, knownProductsById]);

  const activeProductTitle =
    currentBaseline?.productTitle ||
    knownProductsById[activeProductId] ||
    (activeProductId === CANYON_RED_PRODUCT_GID ? "Canyon Red" : activeProductId);

  // Product Selection Handler:
  // - Blocks switching during an active save.
  // - Selects strictly by exact Product GID.
  // - Preserves all drafts, approvals, and Keep Original records across products.
  // - Never triggers Save, approval, proposal generation, or AI calls.
  const handleSelectProductGid = (nextProductGid) => {
    if (isWriterBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Cannot switch products while saving",
        reasons: ["Wait for the current save request to finish before switching products."]
      });
      return;
    }

    if (!isExactProductGid(nextProductGid) || nextProductGid === activeProductId) {
      return;
    }

    setClientPrevalidationBanner(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("productId", nextProductGid);
    setSearchParams(nextParams);
  };

  // Pagination Handlers for Lightweight Product Selector (50 products per page)
  const handleNextProductPage = () => {
    if (isWriterBusy) return;
    const nextCursor = selectorPage?.pageInfo?.endCursor;
    if (!selectorPage?.pageInfo?.hasNextPage || !nextCursor) return;

    setCursorHistory((prev) => [...prev, currentSelectorCursor]);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("productId", activeProductId);
    nextParams.set("cursor", nextCursor);
    setSearchParams(nextParams);
  };

  const handlePreviousProductPage = () => {
    if (isWriterBusy || cursorHistory.length === 0) return;
    const prevCursor = cursorHistory[cursorHistory.length - 1] ?? null;
    setCursorHistory((prev) => prev.slice(0, -1));

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("productId", activeProductId);
    if (prevCursor) {
      nextParams.set("cursor", prevCursor);
    } else {
      nextParams.delete("cursor");
    }
    setSearchParams(nextParams);
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
  // Preserves exact untrimmed string in proposedByProduct[activeProductId] and
  // immediately invalidates any prior Approval or Keep Original record for that destination.
  const handleManualProposalChange = (destinationKey, rawNewValue) => {
    setClientPrevalidationBanner(null);
    const exactString = typeof rawNewValue === "string" ? rawNewValue : String(rawNewValue ?? "");

    setProposedByProduct((prev) => {
      const prodMap = { ...(prev[activeProductId] || {}) };
      prodMap[destinationKey] = {
        value: exactString,
        source: "Manual",
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

  // Evaluate all rows across all 11 drawers for the selected product without visibility filters
  const evaluatedDrawerGroups = BENCH_V2_DRAWER_GROUPS.map((drawer) => {
    const evaluatedRows = drawer.fields.map((fieldContract) => {
      const baseEval = evaluateBenchV2FieldRow({
        productId: activeProductId,
        destinationKey: fieldContract.destinationKey,
        baselineSnapshot: currentBaseline,
        proposedMapForProduct: currentProposedMap,
        approvalsMapForProduct: currentApprovalsMap,
        keepOriginalMapForProduct: currentKeepOriginalMap
      });

      const writerHoldReason = getExistingWriterHoldReason(fieldContract.destinationKey);
      const fidelityCheck =
        baseEval?.hasProposalKey && baseEval.proposedValue !== ""
          ? checkExistingWriterStringFidelity(baseEval.proposedValue)
          : { faithful: true, reason: null };

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

      return {
        ...baseEval,
        isWriterHeld: Boolean(writerHoldReason),
        writerHoldReason,
        fidelityCheck,
        effectiveConnectionStatus,
        effectiveReviewStatus,
        effectiveStatusReason
      };
    });

    return {
      ...drawer,
      evaluatedRows
    };
  });

  // Summarize selected product's Batch 1 review state
  const allEvaluatedRows = evaluatedDrawerGroups.flatMap((d) => d.evaluatedRows);
  const stagedProposalRows = allEvaluatedRows.filter((r) => r.hasProposalKey);
  const validApprovedRows = allEvaluatedRows.filter(
    (r) => r.isApproved && !r.isWriterHeld && r.fidelityCheck.faithful
  );
  const keepOriginalRows = allEvaluatedRows.filter((r) => r.isKeepOriginal);

  // Explicit Save Handler:
  // - Never runs on mount, selection, or edit.
  // - Prevalidates every entry in currentApprovalsMap for activeProductId; if ANY
  //   approved entry is invalid, stale, writer-held, or fails writer string-fidelity,
  //   stops the entire submission rather than silently filtering it out.
  const handleExplicitSaveApprovedChanges = () => {
    setClientPrevalidationBanner(null);

    if (isWriterBusy) {
      setClientPrevalidationBanner({
        tone: "warning",
        title: "Save already in progress",
        reasons: ["Wait for the current save request to finish before clicking Save again."]
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
          "No fields are approved for this product. Edit a field in Drawers 1 to 4 and check Approve before clicking Save."
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
          `[${destKey}] Not an eligible Batch 1 writable destination.`
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
      loaderData?.selectorPage?.error ||
      loaderData?.loadError ||
      (Array.isArray(currentBaseline?.errors) && currentBaseline.errors.length > 0) ||
      currentBaseline?.metafieldsReadComplete !== true ||
      currentBaseline?.defsReadComplete !== true
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
        {/* SHORT TOP SUMMARY BAR + COMPACT PAGINATED PRODUCT SELECTOR */}
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
            <div>
              <h1 style={{ margin: "0 0 6px 0", fontSize: "24px", fontWeight: 700 }}>
                Product Bench: {activeProductTitle}
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
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => revalidator.revalidate()}
                disabled={isBaselineReloading || isWriterBusy}
                style={{
                  padding: "10px 18px",
                  fontSize: "16px",
                  fontWeight: 600,
                  backgroundColor: "#ffffff",
                  color: "#0f172a",
                  border: "2px solid #475569",
                  borderRadius: "8px",
                  cursor: isBaselineReloading || isWriterBusy ? "not-allowed" : "pointer"
                }}
              >
                {isBaselineReloading ? "Loading..." : "Reload Product"}
              </button>

              <button
                type="button"
                onClick={handleExplicitSaveApprovedChanges}
                disabled={isWriterBusy || isBaselineReloading || validApprovedRows.length === 0}
                style={{
                  padding: "10px 22px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor:
                    isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
                      ? "#cbd5e1"
                      : "#15803d",
                  color:
                    isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
                      ? "#334155"
                      : "#ffffff",
                  border: "2px solid #14532d",
                  borderRadius: "8px",
                  cursor:
                    isWriterBusy || isBaselineReloading || validApprovedRows.length === 0
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

          {/* COMPACT LIGHTWEIGHT PAGINATED INVENTORY SELECTOR */}
          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "1px solid #cbd5e1",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "12px"
            }}
          >
            <label
              htmlFor="bench-v2-product-selector"
              style={{ fontWeight: 700, fontSize: "16px", color: "#0f172a" }}
            >
              Select Product:
            </label>

            <select
              id="bench-v2-product-selector"
              aria-label="Select Product"
              value={activeProductId}
              disabled={isWriterBusy || isBaselineReloading}
              onChange={(e) => handleSelectProductGid(e.target.value)}
              style={{
                flex: "1 1 320px",
                padding: "9px 12px",
                fontSize: "16px",
                fontWeight: 600,
                backgroundColor: "#ffffff",
                color: "#0f172a",
                border: "2px solid #475569",
                borderRadius: "8px",
                cursor: isWriterBusy || isBaselineReloading ? "not-allowed" : "pointer"
              }}
            >
              {selectorOptions.map((item) => {
                const draftCountForItem = Object.keys(proposedByProduct[item.id] || {}).length;
                const suffix = draftCountForItem > 0 ? ` (${draftCountForItem} staged)` : "";
                return (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {suffix}
                  </option>
                );
              })}
            </select>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={handlePreviousProductPage}
                disabled={isWriterBusy || isBaselineReloading || cursorHistory.length === 0}
                style={{
                  padding: "8px 14px",
                  fontSize: "15px",
                  fontWeight: 600,
                  backgroundColor:
                    isWriterBusy || isBaselineReloading || cursorHistory.length === 0
                      ? "#f1f5f9"
                      : "#ffffff",
                  color:
                    isWriterBusy || isBaselineReloading || cursorHistory.length === 0
                      ? "#64748b"
                      : "#0f172a",
                  border: "1px solid #64748b",
                  borderRadius: "6px",
                  cursor:
                    isWriterBusy || isBaselineReloading || cursorHistory.length === 0
                      ? "not-allowed"
                      : "pointer"
                }}
              >
                Previous 50
              </button>

              <span style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>
                Page {cursorHistory.length + 1}
              </span>

              <button
                type="button"
                onClick={handleNextProductPage}
                disabled={
                  isWriterBusy ||
                  isBaselineReloading ||
                  !selectorPage?.pageInfo?.hasNextPage ||
                  !selectorPage?.pageInfo?.endCursor
                }
                style={{
                  padding: "8px 14px",
                  fontSize: "15px",
                  fontWeight: 600,
                  backgroundColor:
                    isWriterBusy ||
                    isBaselineReloading ||
                    !selectorPage?.pageInfo?.hasNextPage ||
                    !selectorPage?.pageInfo?.endCursor
                      ? "#f1f5f9"
                      : "#ffffff",
                  color:
                    isWriterBusy ||
                    isBaselineReloading ||
                    !selectorPage?.pageInfo?.hasNextPage ||
                    !selectorPage?.pageInfo?.endCursor
                      ? "#64748b"
                      : "#0f172a",
                  border: "1px solid #64748b",
                  borderRadius: "6px",
                  cursor:
                    isWriterBusy ||
                    isBaselineReloading ||
                    !selectorPage?.pageInfo?.hasNextPage ||
                    !selectorPage?.pageInfo?.endCursor
                      ? "not-allowed"
                      : "pointer"
                }}
              >
                Next 50
              </button>
            </div>
          </div>

          {/* BRIEF CONNECTION NOTE & DRAWER EXPAND/COLLAPSE CONTROLS */}
          <div
            style={{
              marginTop: "14px",
              paddingTop: "14px",
              borderTop: "1px solid #cbd5e1",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              fontSize: "15px",
              color: "#334155"
            }}
          >
            <div>
              Drawers 1 to 4 are connected for manual edits. Gemini AI is not connected in this
              step. Four fields (Is OOAK, Cut and Shape, Stone Shape, Color) are on writer hold.
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => handleSetAllDrawers(true)}
                style={{
                  padding: "6px 12px",
                  fontSize: "14px",
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
                  padding: "6px 12px",
                  fontSize: "14px",
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
            {loaderData?.selectorPage?.error && <div>{loaderData.selectorPage.error}</div>}
            {loaderData?.loadError && <div>{loaderData.loadError}</div>}
            {Array.isArray(currentBaseline?.errors) &&
              currentBaseline.errors.map((errMsg, idx) => (
                <div key={idx} style={{ marginTop: "4px" }}>
                  &bull; {errMsg}
                </div>
              ))}
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

            return (
              <section
                key={drawer.drawerId}
                aria-label={plainDrawerTitle}
                style={{
                  backgroundColor: "#ffffff",
                  border: drawer.isImplementedInBatch1
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
                      {drawer.isImplementedInBatch1
                        ? "Connected in Batch 1"
                        : "Read-only in Batch 1"}{" "}
                      &bull; {drawer.evaluatedRows.length} fields
                      {drawerStagedCount > 0 && ` • ${drawerStagedCount} staged`}
                      {drawerApprovedCount > 0 && ` • ${drawerApprovedCount} approved`}
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

                {/* DRAWER BODY — ALL FIELDS IN DRAWER */}
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

                    {/* FIELD CARDS */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                      {drawer.evaluatedRows.map((row) => {
                        const {
                          contract,
                          baselineObservation: obs,
                          baselineDisplayValue,
                          options,
                          hasProposalKey,
                          proposedValue,
                          proposedDisplayValue,
                          validation,
                          isApproved,
                          isKeepOriginal,
                          isWriterHeld,
                          fidelityCheck,
                          effectiveConnectionStatus,
                          effectiveReviewStatus,
                          effectiveStatusReason
                        } = row;

                        const isOoakRow =
                          contract.destinationKey === "custom.is_ooak" ||
                          contract.destinationKey === "custom.is_one_of_a_kind";

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
                          isOoakRow,
                          baselineDisplayValue
                        );
                        const shortNotice = getShortPlainNotice(row);

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
                                    (Legacy OOAK field)
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
                                    (Primary OOAK field)
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: "15px", fontWeight: 600, color: "#334155" }}>
                                {isApproved && !isWriterHeld
                                  ? "Approved to save"
                                  : isKeepOriginal
                                    ? "Keeping original"
                                    : hasProposalKey
                                      ? "Draft staged"
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
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "#334155",
                                    marginBottom: "6px"
                                  }}
                                >
                                  Proposed
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
                                        disabled={!canEditDraftInBatch1 || isWriterBusy}
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
                                        disabled={!canEditDraftInBatch1 || isWriterBusy}
                                        placeholder={
                                          canEditDraftInBatch1
                                            ? "Type proposed value..."
                                            : "Editing locked until baseline loads"
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
                                          disabled={isWriterBusy}
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

                                    {isOoakRow && hasProposalKey && proposedValue !== "" && (
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
                                            (canApproveForSave || isApproved) && !isWriterBusy
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
                                            isWriterBusy || (!canApproveForSave && !isApproved)
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
                                            !isWriterBusy
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
                                            isWriterBusy ||
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
                                    Read-only in this batch.
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
                            <details style={{ marginTop: "10px", fontSize: "14px", color: "#334155" }}>
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
                                {effectiveStatusReason && (
                                  <div>
                                    <strong>Notes:</strong> {effectiveStatusReason}
                                  </div>
                                )}
                                <div>
                                  <strong>Allowed Type(s):</strong>{" "}
                                  <code>
                                    {(contract.allowedTypes || [contract.expectedType]).join(" | ")}
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
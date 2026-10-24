import { useCallback, useEffect, useRef } from "react";
import { PRODUCT_TEMPLATE_GROUPS } from "./meta-injector.constants.jsx";
import {
  VERIFIED_STANDARDIZED_DESTINATIONS,
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList,
  buildCanonicalCandidateBundle,
  buildCanonicalCandidateSnapshot,
  evaluateProductReferenceMatchReadiness,
  serializeStandardizedAssignmentForVision,
  validArray,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  STATUS,
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  DESTINATION_SPECIFIC_APPROVAL_KEYS,
  RETIRED_KEYS,
  resolveApprovalStorageKey,
  resolveConfigFieldDestination,
  buildRepairPayload
} from "./meta-injector.matrix-domain.jsx";

const SENSITIVE_DIAG_KEY_REGEX = /token|secret|password|authorization|cookie|header|credential|api[_-]?key|session/i;
const EXACT_PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;

const CANONICAL_INCOMING_ALIAS_MAP = Object.freeze({
  stone_family: "custom.material",
  "custom.stone_family": "custom.material",
  primary_medium: "custom.material",
  "custom.primary_medium": "custom.material",
  is_ooak: "custom.is_one_of_a_kind",
  "custom.is_ooak": "custom.is_one_of_a_kind",
  origin_handle: "custom.origin_page_handle",
  "custom.origin_handle": "custom.origin_page_handle",
  canonical_title: "shopify_title",
  "custom.canonical_title": "shopify_title",
  product_title: "shopify_title",
  "custom.product_title": "shopify_title"
});

const ALIAS_COMPANION_LOOKUP = Object.freeze({
  "custom.material": ["stone_family", "custom.stone_family", "primary_medium", "custom.primary_medium"],
  "custom.is_one_of_a_kind": ["is_ooak", "custom.is_ooak"],
  "custom.origin_page_handle": ["origin_handle", "custom.origin_page_handle"],
  "shopify_title": ["native_title", "canonical_title", "product_title"],
  "custom.generated_description": ["native_description", "generated_description"],
  "custom.seo_title": ["native_seo_title", "seo_title"],
  "custom.shipping_weight_oz": ["native_shipping_weight", "shipping_weight_oz"],
  "price": ["native_price"]
});

const OPERATOR_AUTHORITATIVE_DESTINATIONS = new Set([
  "price",
  "custom.weight_grams",
  "custom.dimensions_mm",
  "custom.shipping_weight_oz",
  "native_shipping_weight",
  "custom.treated",
  "custom.treatment_status"
]);

const CLASSIFICATION_PRECEDENCE_KEYS = new Set([
  "primary_use",
  "jewelry_type",
  "product_format",
  "necklace_design"
]);

const isEffectiveRetiredKey = (key) => {
  if (key === "wire_material" || key === "custom.wire_material") return false;
  return RETIRED_KEYS.includes(key);
};

const normalizeOoakEquivalentValue = (rawVal, expectedType = "single_line_text_field") => {
  if (rawVal === undefined || rawVal === null) return "";
  if (typeof rawVal === "boolean") {
    if (expectedType === "boolean") return rawVal ? "true" : "false";
    return rawVal ? "Yes" : "No";
  }
  const trimmed = String(rawVal).trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (
    lower === "true" ||
    lower === "yes" ||
    lower === "1" ||
    lower === "one-of-a-kind" ||
    lower === "one of a kind" ||
    lower.startsWith("yes —") ||
    lower.startsWith("yes -") ||
    lower.startsWith("yes â€”")
  ) {
    return expectedType === "boolean" ? "true" : "Yes";
  }
  if (lower === "false" || lower === "no" || lower === "0") {
    return expectedType === "boolean" ? "false" : "No";
  }
  return trimmed;
};

const sanitizeDiagString = (val) => {
  if (typeof val !== "string") return "";
  const trimmed = val.trim();
  if (!trimmed || trimmed === "[object Object]") return "";
  return trimmed
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]")
    .replace(/shpat_[A-Za-z0-9_]+/gi, "shpat_[REDACTED]")
    .replace(/shpca_[A-Za-z0-9_]+/gi, "shpca_[REDACTED]")
    .replace(/shpss_[A-Za-z0-9_]+/gi, "shpss_[REDACTED]");
};

const normalizeFieldOrPath = (rawField) => {
  if (rawField === undefined || rawField === null) return "";
  if (Array.isArray(rawField)) {
    return rawField
      .map((part) => (typeof part === "string" || typeof part === "number" ? sanitizeDiagString(String(part)) : ""))
      .filter(Boolean)
      .join(".");
  }
  if (typeof rawField === "string" || typeof rawField === "number") {
    return sanitizeDiagString(String(rawField));
  }
  return "";
};

const normalizeReturnedErrorEntry = (rawItem) => {
  if (rawItem === undefined || rawItem === null) return null;

  if (typeof rawItem === "string" || typeof rawItem === "number" || typeof rawItem === "boolean") {
    const cleanMsg = sanitizeDiagString(String(rawItem));
    if (!cleanMsg) return null;
    return {
      message: cleanMsg,
      field: null,
      code: null,
      destination: null,
      formatted: cleanMsg
    };
  }

  if (typeof rawItem === "object") {
    const rawMsg =
      typeof rawItem.message === "string"
        ? rawItem.message
        : typeof rawItem.error === "string"
          ? rawItem.error
          : typeof rawItem.reason === "string"
            ? rawItem.reason
            : "";
    const message = sanitizeDiagString(rawMsg);
    const field = normalizeFieldOrPath(rawItem.field ?? rawItem.path ?? null) || null;
    const code =
      typeof rawItem.code === "string" || typeof rawItem.code === "number"
        ? sanitizeDiagString(String(rawItem.code)) || null
        : null;
    const destination =
      typeof rawItem.destination === "string"
        ? sanitizeDiagString(rawItem.destination) || null
        : typeof rawItem.key === "string"
          ? sanitizeDiagString(rawItem.key) || null
          : null;

    let fallbackSummary = "";
    if (!message) {
      const safePairs = [];
      Object.entries(rawItem).forEach(([k, v]) => {
        if (SENSITIVE_DIAG_KEY_REGEX.test(k)) return;
        if (v === undefined || v === null) return;
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
          const sv = sanitizeDiagString(String(v));
          if (sv) safePairs.push(`${k}=${sv}`);
        } else if (Array.isArray(v)) {
          const joined = normalizeFieldOrPath(v);
          if (joined) safePairs.push(`${k}=${joined}`);
        }
      });
      fallbackSummary = safePairs.join(", ");
    }

    const effectiveMessage = message || fallbackSummary;
    if (!effectiveMessage && !field && !code && !destination) return null;

    const metaParts = [];
    if (destination) metaParts.push(`dest: ${destination}`);
    if (field && field !== destination) metaParts.push(`field: ${field}`);
    if (code) metaParts.push(`code: ${code}`);

    const prefix = metaParts.length > 0 ? `[${metaParts.join(" | ")}] ` : "";
    const formatted = `${prefix}${effectiveMessage || "Unspecified backend error"}`.trim();

    return {
      message: effectiveMessage || "Unspecified backend error",
      field,
      code,
      destination,
      formatted
    };
  }

  return null;
};

const extractNormalizedErrors = (rawErrors, singleError) => {
  const list = [];
  const seen = new Set();

  const pushCandidate = (item) => {
    const norm = normalizeReturnedErrorEntry(item);
    if (!norm || !norm.formatted) return;
    if (seen.has(norm.formatted)) return;
    seen.add(norm.formatted);
    list.push(norm);
  };

  if (Array.isArray(rawErrors)) {
    rawErrors.forEach(pushCandidate);
  } else if (rawErrors !== undefined && rawErrors !== null) {
    pushCandidate(rawErrors);
  }

  if (singleError !== undefined && singleError !== null) {
    pushCandidate(singleError);
  }

  return list;
};

const hasNonBlankValue = (val) => {
  if (val === undefined || val === null) return false;
  if (Array.isArray(val)) {
    return val.some(item => item !== undefined && item !== null && String(item).trim() !== "");
  }
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  const trimmed = str.trim();
  return trimmed !== "" && trimmed !== "[]" && trimmed !== "{}";
};

const formatComparableValue = (val, expectedType, targetKey = "") => {
  if (val === undefined || val === null) return "";
  if (targetKey === "custom.is_one_of_a_kind" || targetKey === "custom.is_ooak") {
    return normalizeOoakEquivalentValue(val, expectedType);
  }
  if (targetKey === "custom.treated" && expectedType === "single_line_text_field") {
    if (typeof val === "boolean") {
      return val ? "Yes" : "No";
    }
    const trimmed = String(val).trim();
    if (!trimmed) return "";
    const lower = trimmed.toLowerCase();
    if (lower === "true") return "Yes";
    if (lower === "false") return "No";
    return trimmed;
  }
  if (expectedType === "list.single_line_text_field") {
    if (Array.isArray(val)) {
      const cleaned = val
        .map(item => (item !== undefined && item !== null ? String(item).trim() : ""))
        .filter(Boolean);
      return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
    }
    const str = typeof val === "object" ? JSON.stringify(val) : String(val);
    const trimmed = str.trim();
    if (!trimmed || trimmed === "[]") return "";
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map(item => (item !== undefined && item !== null ? String(item).trim() : ""))
            .filter(Boolean);
          return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
        }
      } catch (e) {
        // Keep raw string when not a valid JSON array
      }
    }
    return trimmed;
  }
  if (Array.isArray(val)) {
    return val.length > 0 ? JSON.stringify(val) : "";
  }
  if (typeof val === "object") {
    return JSON.stringify(val);
  }
  return String(val).trim();
};

const normalizeIncomingTargetKey = (rawKey) => {
  if (typeof rawKey !== "string") return "";
  const trimmed = rawKey.trim();
  if (!trimmed) return "";
  if (Object.prototype.hasOwnProperty.call(CANONICAL_INCOMING_ALIAS_MAP, trimmed)) {
    return CANONICAL_INCOMING_ALIAS_MAP[trimmed];
  }
  if (Object.prototype.hasOwnProperty.call(NATIVE_ALIAS_MAP, trimmed)) {
    return NATIVE_ALIAS_MAP[trimmed];
  }
  if (trimmed.startsWith("native_image_alts_")) {
    return trimmed;
  }
  if (NATIVE_FIELDS.includes(trimmed) || trimmed.includes(".") || trimmed.startsWith("native_")) {
    return trimmed;
  }
  const prefixed = `custom.${trimmed}`;
  if (Object.prototype.hasOwnProperty.call(CANONICAL_INCOMING_ALIAS_MAP, prefixed)) {
    return CANONICAL_INCOMING_ALIAS_MAP[prefixed];
  }
  return prefixed;
};

const extractPieceNameOnly = (rawPieceName, fullTitleCandidate) => {
  if (typeof rawPieceName !== "string") return "";
  const trimmed = rawPieceName.trim();
  if (!trimmed) return "";
  const segments = trimmed.split(/\s+[—–-]\s+/);
  if (segments.length >= 3) {
    return segments[segments.length - 1].trim();
  }
  if (typeof fullTitleCandidate === "string" && fullTitleCandidate.trim() === trimmed) {
    const titleSegs = fullTitleCandidate.trim().split(/\s+[—–-]\s+/);
    if (titleSegs.length >= 3) {
      return titleSegs[titleSegs.length - 1].trim();
    }
  }
  return trimmed;
};

const resolveLockedProposalFromApprovals = (canonicalKey, productApprovals = {}) => {
  if (!productApprovals || typeof productApprovals !== "object") return undefined;
  if (productApprovals[canonicalKey] !== undefined) {
    return productApprovals[canonicalKey];
  }
  if (canonicalKey === "custom.generated_description" && productApprovals["native_description"] !== undefined) {
    return productApprovals["native_description"];
  }
  if (canonicalKey === "custom.seo_title" && productApprovals["native_seo_title"] !== undefined) {
    return productApprovals["native_seo_title"];
  }
  return undefined;
};

const normalizeLoadedPlanAndAliases = (rawPlan, currentMetafields = {}, manualProductEdits = {}, productApprovals = {}, allConfigFields = []) => {
  const incomingPlan = validObj(rawPlan);
  const cleanedPlan = {};
  const aliasConflicts = {};

  const getFieldExpectedType = (destKey) => {
    const cfg = allConfigFields.find(f => resolveConfigFieldDestination(f) === destKey || f.key === destKey);
    if (cfg?.type) return cfg.type;
    if (destKey === "custom.character_marks" || destKey === "custom.stone_story") return "list.single_line_text_field";
    if (destKey === "custom.weight_grams" || destKey === "custom.shipping_weight_oz") return "number_decimal";
    if (destKey === "custom.honest_flaws_and_character" || destKey === "custom.origin_story" || destKey === "custom.generated_description") return "multi_line_text_field";
    return "single_line_text_field";
  };

  const isKeyManuallyLocked = (destKey) => {
    const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
    if (manualProductEdits?.[destKey] === true || productApprovals?.[destKey] !== undefined) return true;
    return companions.some(aliasKey => manualProductEdits?.[aliasKey] === true || productApprovals?.[aliasKey] !== undefined);
  };

  const canonicalCandidatesFromPlan = {};

  Object.entries(incomingPlan).forEach(([rawKey, rawVal]) => {
    if (rawKey === "standardized_candidates" || rawKey === "custom.standardized_candidates") return;
    if (isEffectiveRetiredKey(rawKey)) return;

    const canonicalKey = normalizeIncomingTargetKey(rawKey);
    if (!canonicalKey || isEffectiveRetiredKey(canonicalKey)) return;

    const isDirectCanonical = rawKey === canonicalKey;
    if (!canonicalCandidatesFromPlan[canonicalKey]) {
      canonicalCandidatesFromPlan[canonicalKey] = {
        canonicalRaw: undefined,
        hasCanonicalKey: false,
        aliasEntries: []
      };
    }

    if (isDirectCanonical) {
      canonicalCandidatesFromPlan[canonicalKey].canonicalRaw = rawVal;
      canonicalCandidatesFromPlan[canonicalKey].hasCanonicalKey = true;
    } else {
      canonicalCandidatesFromPlan[canonicalKey].aliasEntries.push({ aliasKey: rawKey, value: rawVal });
    }
  });

  // Also check stored metafields for canonical vs alias values when loading
  Object.entries(ALIAS_COMPANION_LOOKUP).forEach(([canonicalKey, aliasKeys]) => {
    if (!canonicalKey.startsWith("custom.")) return;
    const storedCanonical = currentMetafields?.[canonicalKey];
    aliasKeys.forEach(aliasKey => {
      const fullAliasKey = aliasKey.includes(".") ? aliasKey : `custom.${aliasKey}`;
      const storedAlias = currentMetafields?.[fullAliasKey] ?? currentMetafields?.[aliasKey];
      if (hasNonBlankValue(storedAlias)) {
        if (!canonicalCandidatesFromPlan[canonicalKey]) {
          canonicalCandidatesFromPlan[canonicalKey] = {
            canonicalRaw: storedCanonical,
            hasCanonicalKey: storedCanonical !== undefined,
            aliasEntries: []
          };
        }
        const alreadyRecorded = canonicalCandidatesFromPlan[canonicalKey].aliasEntries.some(
          e => e.aliasKey === fullAliasKey || e.aliasKey === aliasKey
        );
        if (!alreadyRecorded) {
          canonicalCandidatesFromPlan[canonicalKey].aliasEntries.push({
            aliasKey: fullAliasKey,
            value: storedAlias
          });
        }
      }
    });
  });

  Object.entries(canonicalCandidatesFromPlan).forEach(([canonicalKey, group]) => {
    const expectedType = getFieldExpectedType(canonicalKey);
    const canonicalFormatted = group.hasCanonicalKey
      ? formatComparableValue(group.canonicalRaw, expectedType, canonicalKey)
      : "";
    const nonBlankAliases = group.aliasEntries
      .map(e => ({
        aliasKey: e.aliasKey,
        raw: e.value,
        formatted: formatComparableValue(e.value, expectedType, canonicalKey)
      }))
      .filter(e => e.formatted !== "");

    if (isKeyManuallyLocked(canonicalKey)) {
      if (
        (manualProductEdits?.[canonicalKey] === true ||
          (ALIAS_COMPANION_LOOKUP[canonicalKey] || []).some(ak => manualProductEdits?.[ak] === true)) &&
        incomingPlan[canonicalKey] !== undefined
      ) {
        cleanedPlan[canonicalKey] = formatComparableValue(incomingPlan[canonicalKey], expectedType, canonicalKey);
        return;
      }
      const lockedApprovalVal = resolveLockedProposalFromApprovals(canonicalKey, productApprovals);
      if (lockedApprovalVal !== undefined) {
        cleanedPlan[canonicalKey] = formatComparableValue(lockedApprovalVal, expectedType, canonicalKey);
        return;
      }
    }

    if (canonicalFormatted !== "") {
      cleanedPlan[canonicalKey] = canonicalFormatted;
      const conflictingAlias = nonBlankAliases.find(a => a.formatted !== canonicalFormatted);
      if (conflictingAlias) {
        aliasConflicts[canonicalKey] = {
          expected: canonicalFormatted,
          actual: `${conflictingAlias.aliasKey}: ${conflictingAlias.formatted}`
        };
      }
    } else if (nonBlankAliases.length > 0) {
      const distinctAliasVals = Array.from(new Set(nonBlankAliases.map(a => a.formatted)));
      cleanedPlan[canonicalKey] = nonBlankAliases[0].formatted;
      if (distinctAliasVals.length > 1) {
        aliasConflicts[canonicalKey] = {
          expected: nonBlankAliases[0].formatted,
          actual: nonBlankAliases.slice(1).map(a => `${a.aliasKey}: ${a.formatted}`).join(" | ")
        };
      }
    } else if (group.hasCanonicalKey) {
      cleanedPlan[canonicalKey] = "";
    }
  });

  return { cleanedPlan, aliasConflicts };
};

const mergeReadBackNativeTargets = (existingNativeTargets, rbNativeTargets) => {
  const prev = validObj(existingNativeTargets);
  if (!rbNativeTargets || typeof rbNativeTargets !== "object" || Array.isArray(rbNativeTargets)) {
    return prev;
  }

  const unverifiedFields = validArray(rbNativeTargets.unverifiedFields);
  const next = {
    ...prev,
    productId: rbNativeTargets.productId || prev.productId,
    isComplete: rbNativeTargets.isComplete === true,
    loadError: rbNativeTargets.loadError ?? null,
    unverifiedFields
  };

  if (unverifiedFields.includes("productTitle") || typeof rbNativeTargets.productTitle !== "string") {
    next.productTitle = undefined;
  } else {
    next.productTitle = rbNativeTargets.productTitle;
  }

  if (unverifiedFields.includes("descriptionHtml") || typeof rbNativeTargets.descriptionHtml !== "string") {
    next.descriptionHtml = undefined;
  } else {
    next.descriptionHtml = rbNativeTargets.descriptionHtml;
  }

  if (unverifiedFields.includes("seo") || !rbNativeTargets.seo || typeof rbNativeTargets.seo !== "object") {
    next.seo = undefined;
  } else {
    const rbSeo = rbNativeTargets.seo;
    const nextSeo = {};
    if (Object.prototype.hasOwnProperty.call(rbSeo, "title")) {
      nextSeo.title = typeof rbSeo.title === "string" || rbSeo.title === null ? rbSeo.title : undefined;
    }
    if (Object.prototype.hasOwnProperty.call(rbSeo, "description")) {
      nextSeo.description = typeof rbSeo.description === "string" || rbSeo.description === null ? rbSeo.description : undefined;
    }
    next.seo = nextSeo;
  }

  if (unverifiedFields.includes("media") || !Array.isArray(rbNativeTargets.media?.edges)) {
    if (prev.media && typeof prev.media === "object" && Array.isArray(prev.media.edges)) {
      next.media = {
        ...prev.media,
        edges: prev.media.edges.map((e) =>
          e && e.node
            ? {
                ...e,
                node: {
                  ...e.node,
                  alt: undefined
                }
              }
            : e
        )
      };
    } else {
      next.media = undefined;
    }
  } else {
    const prevEdges = Array.isArray(prev.media?.edges) ? prev.media.edges : [];
    const prevById = new Map();
    prevEdges.forEach((edge) => {
      if (edge?.node?.id) {
        prevById.set(edge.node.id, edge.node);
      }
    });

    const mergedEdges = rbNativeTargets.media.edges
      .filter((edge) => edge && edge.node && edge.node.id)
      .map((edge) => {
        const rbNode = edge.node;
        const priorNode = prevById.get(rbNode.id);
        return {
          node: {
            ...(priorNode ? { preview: priorNode.preview } : {}),
            id: rbNode.id,
            alt: typeof rbNode.alt === "string" ? rbNode.alt : undefined
          }
        };
      });

    next.media = {
      ...(prev.media && typeof prev.media === "object" ? prev.media : {}),
      edges: mergedEdges
    };
  }

  return next;
};

const buildExactSubmittedSnapshot = (safePlan = {}, nativeChanges = {}) => {
  const snapshot = {};

  Object.entries(validObj(safePlan)).forEach(([destKey, val]) => {
    if (val === undefined) return;
    snapshot[destKey] = val;
    if (destKey === "price") {
      snapshot.native_price = val;
    }
  });

  if (nativeChanges && typeof nativeChanges === "object") {
    if (nativeChanges.title !== undefined) {
      snapshot.native_title = nativeChanges.title;
      snapshot.shopify_title = nativeChanges.title;
    }
    if (nativeChanges.description !== undefined) {
      snapshot.native_description = nativeChanges.description;
    }
    if (nativeChanges.seoTitle !== undefined) {
      snapshot.native_seo_title = nativeChanges.seoTitle;
    }
    if (nativeChanges.seoDescription !== undefined) {
      snapshot.native_seo_description = nativeChanges.seoDescription;
    }
    if (nativeChanges.shippingWeight?.value !== undefined) {
      snapshot.native_shipping_weight = `${nativeChanges.shippingWeight.value} ${nativeChanges.shippingWeight.unit || "OUNCES"}`;
    }
    if (Array.isArray(nativeChanges.imageAlts)) {
      nativeChanges.imageAlts.forEach((alt) => {
        if (alt && typeof alt.imageId === "string" && alt.altText !== undefined) {
          snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
        }
      });
    }
  }

  return snapshot;
};

const prepareAndSubmitRepairPlan = ({
  targetId,
  manifest,
  product,
  approvals,
  getFieldMetadata,
  token,
  scanLogMessage,
  setPendingOperation,
  updateProductState,
  setSubmittedPayloads,
  batchFetcher
}) => {
  const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, targetId, approvals, getFieldMetadata);
  const snapshot = buildExactSubmittedSnapshot(safePlan, nativeChanges);

  setSubmittedPayloads(prev => ({ ...prev, [targetId]: snapshot }));
  setPendingOperation({
    id: targetId,
    intent: "executeRepairPlan",
    token,
    submittedSnapshot: snapshot
  });
  updateProductState(targetId, STATUS.SCANNING, [scanLogMessage]);

  const fd = new FormData();
  fd.append("intent", "executeRepairPlan");
  fd.append("pieceId", targetId);
  fd.append("repairPlan", JSON.stringify(safePlan));
  fd.append("nativeChanges", JSON.stringify(nativeChanges));
  fd.append("legacyKeysToRemove", JSON.stringify([]));
  batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
};

export function useMetaInjectorExecution({
  safeProducts,
  batchFetcher,
  referenceMatchFetcher,
  queueIds,
  selectedBenchId,
  isLoadingData,
  setIsLoadingData,
  loadIndex,
  setLoadIndex,
  isExecuting,
  setIsExecuting,
  executionMode,
  setExecutionMode,
  executeIndex,
  setExecuteIndex,
  aiStep,
  setAiStep,
  pendingOperation,
  setPendingOperation,
  aiData,
  setAiData,
  standardizedCandidatesByProduct,
  setStandardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  setReferenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  setReferenceMatchStatusByProduct,
  pendingReferenceMatch,
  startReferenceMatchForProduct,
  manifestData,
  setManifestData,
  lastProcessedData,
  setLastProcessedData,
  approvals,
  setApprovals,
  manualEdits,
  setManualEdits,
  setSubmittedPayloads,
  setRepairHistory,
  setSafetyMessage,
  setSafetyError,
  updateProductState,
  getStandardizedEvaluationForField,
  getFieldMetadata
}) {
  // Per-product automatic read-only selection-load tracker (isolated from manual batch Generate Repair Plan)
  // Shape per GID: { status: "inflight" | "loaded" | "failed", token: string, error?: string }
  const autoSelectionLoadGuardRef = useRef({});
  const activeOperationCycleRef = useRef(null);

  // Reset per-product automatic load guards when Clear Rack & Reset Bench clears all state
  useEffect(() => {
    if (
      selectedBenchId === null &&
      queueIds.length === 0 &&
      Object.keys(manifestData || {}).length === 0 &&
      !isLoadingData &&
      !isExecuting &&
      pendingOperation === null
    ) {
      autoSelectionLoadGuardRef.current = {};
      activeOperationCycleRef.current = null;
    }
  }, [selectedBenchId, queueIds.length, manifestData, isLoadingData, isExecuting, pendingOperation]);

  // Mark any product that already has a loaded manifest as "loaded" so it is never re-fetched on incidental renders
  useEffect(() => {
    const loadedIds = Object.keys(manifestData || {});
    for (let i = 0; i < loadedIds.length; i += 1) {
      const pid = loadedIds[i];
      if (manifestData[pid]) {
        autoSelectionLoadGuardRef.current[pid] = {
          status: "loaded",
          token: autoSelectionLoadGuardRef.current[pid]?.token || "manifest_present"
        };
      }
    }
  }, [manifestData]);

  // Track batchFetcher lifecycle transitions for the active pendingOperation so retained fetcher.data is never misconsumed
  useEffect(() => {
    if (!pendingOperation) {
      activeOperationCycleRef.current = null;
      return;
    }
    if (
      !activeOperationCycleRef.current ||
      activeOperationCycleRef.current.token !== pendingOperation.token
    ) {
      activeOperationCycleRef.current = {
        id: pendingOperation.id,
        intent: pendingOperation.intent,
        token: pendingOperation.token,
        source: pendingOperation.source || "manual_or_batch",
        submittedSnapshot: pendingOperation.submittedSnapshot || null,
        baselineData: batchFetcher.data,
        sawNonIdle: batchFetcher.state !== "idle"
      };
      return;
    }
    if (batchFetcher.state !== "idle" && !activeOperationCycleRef.current.sawNonIdle) {
      activeOperationCycleRef.current.sawNonIdle = true;
    }
  }, [pendingOperation, batchFetcher.state, batchFetcher.data]);

  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("Cannot generate plan: No inventory selected. Please check items in the left column first.");
      return;
    }
    autoSelectionLoadGuardRef.current = {};
    setApprovals({});
    setManualEdits({});
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

  const executeRepairs = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("Cannot execute: No items loaded on the bench.");
      return;
    }

    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
      setSafetyError("Cannot execute: You must click 'GENERATE REPAIR PLAN' first to load data.");
      return;
    }

    if (readyItems.length < queueIds.length) {
      if (!window.confirm(`WARNING: LIVE RUN.\n\nOnly ${readyItems.length} of ${queueIds.length} queued items have loaded manifests. The others will be skipped.\n\nProceed?`)) {
        return;
      }
    } else {
      if (!window.confirm("WARNING: LIVE RUN.\n\nThis will execute structural repairs (edits and deletions) on the live Shopify database for all queued items. Proceed?")) {
        return;
      }
    }

    const runId = `repair_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setAiData(prev => {
      const next = { ...prev };
      queueIds.forEach(id => {
        next[id] = {
          ...(next[id] || {}),
          repairWorkflowRunId: runId,
          repairRequested: false,
          repairPreflightAttemptKey: null,
          repairPreflightRequestId: null,
          repairPreflightSnapshot: null
        };
      });
      return next;
    });

    setSafetyError("");
    setSafetyMessage("Structural Repair Engine engaged. Mutating live data...");
    setExecutionMode("REPAIR");
    setIsExecuting(true);
    setExecuteIndex(0);
  }, [queueIds, manifestData]);

  const executeAIFill = useCallback(() => {
    if (queueIds.length === 0) {
      setSafetyError("Cannot run AI: No items loaded on the bench.");
      return;
    }

    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
      setSafetyError("Cannot run AI: You must click 'GENERATE REPAIR PLAN' first to load data.");
      return;
    }

    const runId = `ai_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setAiData(prev => {
      const next = { ...prev };
      queueIds.forEach(id => {
        next[id] = {
          ...(next[id] || {}),
          workflowRunId: runId,
          titleParseRequested: false,
          fullRescanRequested: false,
          generateDescRequested: false,
          autoMatchAttemptKey: null,
          autoMatchRequestId: null,
          autoMatchSnapshot: null
        };
      });
      return next;
    });

    setSafetyError("");
    setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
    setExecutionMode("AI_BATCH_PIPELINE");
    setIsExecuting(true);
    setExecuteIndex(0);
    setAiStep(1);
  }, [queueIds, manifestData]);

  // Automatic Read-Only Selection Baseline Loader
  // Triggers when a valid Product GID is selected on Tab 3 and its manifest baseline is not yet loaded in browser state.
  // Never calls generateRepairPlan, never touches queueIds/loadIndex/isLoadingData, and never clears approvals or manualEdits.
  useEffect(() => {
    const cleanSelectedId = typeof selectedBenchId === "string" ? selectedBenchId.trim() : "";
    if (!cleanSelectedId || !EXACT_PRODUCT_GID_REGEX.test(cleanSelectedId)) {
      return;
    }

    // Do not overwrite an already-loaded manifest on incidental renders
    if (manifestData && manifestData[cleanSelectedId]) {
      autoSelectionLoadGuardRef.current[cleanSelectedId] = {
        status: "loaded",
        token: autoSelectionLoadGuardRef.current[cleanSelectedId]?.token || "manifest_present"
      };
      return;
    }

    // Serialize safely against batch/manual operations and busy fetcher state
    if (isLoadingData || isExecuting || pendingOperation !== null || batchFetcher.state !== "idle") {
      return;
    }

    // Per-product in-flight / attempt / failure guard prevents duplicate submits and infinite retry loops
    const existingGuard = autoSelectionLoadGuardRef.current[cleanSelectedId];
    if (
      existingGuard &&
      (existingGuard.status === "inflight" ||
        existingGuard.status === "loaded" ||
        existingGuard.status === "failed")
    ) {
      return;
    }

    const token = `autoload_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    autoSelectionLoadGuardRef.current[cleanSelectedId] = {
      status: "inflight",
      token
    };
    activeOperationCycleRef.current = {
      id: cleanSelectedId,
      intent: "loadProductData",
      token,
      source: "auto_selection_load",
      submittedSnapshot: null,
      baselineData: batchFetcher.data,
      sawNonIdle: false
    };

    setPendingOperation({
      id: cleanSelectedId,
      intent: "loadProductData",
      token,
      source: "auto_selection_load"
    });
    updateProductState(cleanSelectedId, STATUS.SCANNING, [
      "Auto-loading read-only product baseline for selected bench item..."
    ]);

    try {
      const fd = new FormData();
      fd.append("intent", "loadProductData");
      fd.append("pieceId", cleanSelectedId);
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    } catch (submitErr) {
      const errMsg = sanitizeDiagString(
        submitErr?.message || String(submitErr || "Failed to submit automatic baseline load.")
      ) || "Failed to submit automatic baseline load.";
      autoSelectionLoadGuardRef.current[cleanSelectedId] = {
        status: "failed",
        token,
        error: errMsg
      };
      activeOperationCycleRef.current = null;
      setPendingOperation(null);
      updateProductState(cleanSelectedId, STATUS.FAILED, [errMsg]);
      setSafetyError(`Automatic baseline load failed for ${cleanSelectedId}: ${errMsg}`);
    }
  }, [
    selectedBenchId,
    manifestData,
    isLoadingData,
    isExecuting,
    pendingOperation,
    batchFetcher,
    batchFetcher.state,
    batchFetcher.data,
    updateProductState,
    setPendingOperation,
    setSafetyError
  ]);

  // Unified Dispatch Loop Driver
  useEffect(() => {
    const isProcessing = isLoadingData || isExecuting;
    if (!isProcessing) return;
    if (batchFetcher.state !== "idle" || pendingOperation !== null) return;

    if (isLoadingData && loadIndex >= queueIds.length) {
      setIsLoadingData(false);
      setSafetyMessage(`Data loaded and manifests built for ${queueIds.length} items.`);
      return;
    }

    if (isExecuting) {
      if (executionMode === "REPAIR" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
      if (executionMode === "AI_SINGLE_PIPELINE" && aiStep > 4) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Single AI Run Complete. Data staged for review.`);
        return;
      }
      if (executionMode === "AI_BATCH_PIPELINE" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
    }

    const currentId = isLoadingData ? queueIds[loadIndex] : (executionMode === "AI_SINGLE_PIPELINE" ? selectedBenchId : queueIds[executeIndex]);
    if (!currentId) return;

    const manifest = manifestData[currentId];
    const product = safeProducts.find(p => p.id === currentId);

    if (!isLoadingData && (!manifest || !product)) {
      updateProductState(currentId, STATUS.SKIPPED, ["No manifest or product data built."]);
      if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
      else setExecuteIndex(i => i + 1);
      return;
    }

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    if (isLoadingData) {
      autoSelectionLoadGuardRef.current[currentId] = {
        status: "inflight",
        token
      };
      setPendingOperation({ id: currentId, intent: "loadProductData", token, source: "batch_load" });
      updateProductState(currentId, STATUS.SCANNING, ["Fetching live metafields by GID..."]);
      const fd = new FormData();
      fd.append("intent", "loadProductData");
      fd.append("pieceId", currentId);
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    }
    else if (executionMode === "REPAIR") {
      const pieceAi = aiData[currentId] || {};
      const repairRunId = pieceAi.repairWorkflowRunId || "repair_batch_default";
      const rawCandidates = standardizedCandidatesByProduct[currentId] || {};
      const candidateBundle = buildCanonicalCandidateBundle(rawCandidates);
      const currentSnapshot = candidateBundle.snapshot;
      const attemptKey = `${repairRunId}::${currentId}::${currentSnapshot}`;
      const hasAttemptedPreflight = pieceAi.repairPreflightAttemptKey === attemptKey;

      const readiness = evaluateProductReferenceMatchReadiness({
        productId: currentId,
        data: manifest,
        rawCandidates,
        refMatchResult: referenceMatchResultsByProduct?.[currentId] || null,
        refMatchStatus: referenceMatchStatusByProduct?.[currentId] || null,
        pendingReferenceMatch,
        expectedRequestId: hasAttemptedPreflight ? (pieceAi.repairPreflightRequestId || null) : null
      });

      if (readiness.state === "pending") {
        return;
      }

      if (readiness.requiresMatching) {
        // Hard stop on repair preflight: if we already submitted preflight in this repair invocation, stop now and never fall through to writing
        if (hasAttemptedPreflight) {
          const terminalMsg =
            readiness.state === "failed_or_incomplete"
              ? `Repair preflight reference matching for ${currentId} did not complete cleanly (${readiness.reason}). Repair stopped without writing any fields. Resolve matching diagnostics and click Repair again.`
              : `Repair preflight reference matching for ${currentId} did not complete. Repair stopped without writing any fields.`;
          updateProductState(currentId, STATUS.FAILED, [terminalMsg]);
          setSafetyError(terminalMsg);
          setIsExecuting(false);
          setExecutionMode(null);
          return;
        }

        if (referenceMatchFetcher?.state !== "idle" || pendingReferenceMatch !== null) {
          return;
        }

        const preflightReqId = `refmatch_preflight_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        setAiData(prev => ({
          ...prev,
          [currentId]: {
            ...(prev[currentId] || {}),
            repairPreflightAttemptKey: attemptKey,
            repairPreflightRequestId: preflightReqId,
            repairPreflightSnapshot: currentSnapshot
          }
        }));
        updateProductState(currentId, STATUS.SCANNING, [
          "Repair preflight: Running read-only reference matching for staged Vision candidates (repair halted pending review)..."
        ]);

        const startRes = startReferenceMatchForProduct(currentId, {
          source: "repair_preflight",
          workflowRunId: repairRunId,
          requestId: preflightReqId,
          candidatesOverride: rawCandidates
        });

        if (!startRes.started) {
          const startErr = `Repair halted on ${currentId}: Could not start required reference matching preflight (${startRes.message}). No writes were executed.`;
          updateProductState(currentId, STATUS.FAILED, [startErr]);
          setSafetyError(startErr);
          setIsExecuting(false);
          setExecutionMode(null);
        }
        return;
      }

      // If preflight matching was triggered during this repair invocation and just finished, STOP the repair invocation so the operator can review before any write occurs
      if (hasAttemptedPreflight) {
        const stopMsg = readiness.hasLegitimateBlocks
          ? `Repair preflight matching completed for ${currentId} (${readiness.eligibleDestinationKeys.length} proposal(s) staged for review, ${readiness.blockedDestinationKeys.length} blocked by category/entry rules: ${readiness.blockedDestinationKeys.join(", ")}). Repair stopped before writing. Review and approve any desired standardized proposals, then click Repair again.`
          : `Repair preflight matching completed for ${currentId} (${readiness.eligibleDestinationKeys.length} proposal(s) staged for review). Repair stopped before writing. Review and approve any desired standardized proposals, then click Repair again.`;
        updateProductState(currentId, STATUS.VALIDATED, [stopMsg]);
        setSafetyMessage(stopMsg);
        setIsExecuting(false);
        setExecutionMode(null);
        return;
      }

      if (!pieceAi.repairRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, repairRequested: true } }));
        prepareAndSubmitRepairPlan({
          targetId: currentId,
          manifest,
          product,
          approvals,
          getFieldMetadata,
          token,
          scanLogMessage: "Executing structural repairs...",
          setPendingOperation,
          updateProductState,
          setSubmittedPayloads,
          batchFetcher
        });
      }
    }
    else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
      const pieceAi = aiData[currentId] || {};

      if (aiStep === 1 && !pieceAi.titleParseRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, titleParseRequested: true } }));
        setPendingOperation({ id: currentId, intent: "titleParse", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 1: Parsing Title & Origin (Gemini + Render DB)..."]);

        const titleToParse =
          (manualEdits[currentId]?.shopify_title === true && manifest.repairPlan?.shopify_title) ||
          manifest.nativeTargets?.productTitle ||
          manifest.canonicalFields?.shopify_title ||
          product.title;
        const fd = new FormData();
        fd.append("intent", "titleParse");
        fd.append("pieceName", titleToParse);
        fd.append("pieceId", currentId);
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 2 && !pieceAi.fullRescanRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, fullRescanRequested: true } }));
        setPendingOperation({ id: currentId, intent: "tab3FullRescan", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 2: Vision API Deep Scan (Gemini)..."]);

        const titleToParse =
          (manualEdits[currentId]?.shopify_title === true && manifest.repairPlan?.shopify_title) ||
          manifest.nativeTargets?.productTitle ||
          manifest.canonicalFields?.shopify_title ||
          product.title;
        const fd = new FormData();
        fd.append("intent", "tab3FullRescan");
        fd.append("pieceId", currentId);
        fd.append("productTitle", titleToParse);

        const mediaEdges = manifest.nativeTargets?.media?.edges || [];
        if (mediaEdges.length > 0) {
          const mediaInputs = mediaEdges.map(e => ({
            imageId: e.node.id,
            url: e.node.preview?.image?.url,
            currentAltText: e.node.alt || ""
          })).filter(m => m.imageId && m.url);
          fd.append("mediaInputs", JSON.stringify(mediaInputs));
        } else {
          const imageUrl = product.images?.edges?.[0]?.node?.url || product.featuredImage?.url || product.media?.edges?.[0]?.node?.image?.url || "";
          fd.append("imageUrl", imageUrl);
        }

        const resolvedStoneFamily =
          (manualEdits[currentId]?.["custom.material"] === true ? manifest.repairPlan?.["custom.material"] : undefined) ||
          approvals[currentId]?.["custom.material"] ||
          manifest.currentMetafields?.["custom.material"] ||
          manifest.currentMetafields?.["custom.stone_family"] ||
          manifest.currentMetafields?.["custom.primary_medium"] ||
          pieceAi.titleParse?.material ||
          pieceAi.titleParse?.stone_family ||
          pieceAi.titleParse?.primary_medium ||
          "";
        fd.append("stone_family", resolvedStoneFamily);

        const currentOriginStory =
          manifest.currentMetafields?.["custom.origin_story"] ||
          manifest.canonicalFields?.["custom.origin_story"] ||
          "";
        fd.append("origin_story", currentOriginStory || pieceAi.titleParse?.origin_story || "");
        fd.append(
          "honest_flaws_and_character",
          (manualEdits[currentId]?.["custom.honest_flaws_and_character"] === true
            ? manifest.repairPlan?.["custom.honest_flaws_and_character"]
            : manifest.currentMetafields?.["custom.honest_flaws_and_character"]) || ""
        );
        fd.append(
          "weight_grams",
          (manualEdits[currentId]?.["custom.weight_grams"] === true
            ? manifest.repairPlan?.["custom.weight_grams"]
            : manifest.currentMetafields?.["custom.weight_grams"]) || ""
        );
        fd.append(
          "dimensions_mm",
          (manualEdits[currentId]?.["custom.dimensions_mm"] === true
            ? manifest.repairPlan?.["custom.dimensions_mm"]
            : manifest.currentMetafields?.["custom.dimensions_mm"]) || ""
        );

        const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
        allConfigFields.forEach(f => {
          if (f.role === "standardized_attribute" && f.namespace === "shopify" && f.metaKey) {
            const stdKey = `shopify.${f.metaKey}`;
            const rawStdVal = manifest.currentMetafields?.[stdKey];
            const serializedStd = serializeStandardizedAssignmentForVision(rawStdVal);
            if (serializedStd !== "") {
              fd.set(stdKey, serializedStd);
            }
          }
        });

        const hardwareKeys = [
          "bail_included", "secondary_medium", "jewelry_finding_type",
          "primary_use", "jewelry_type", "setting_ready",
          "chain_material", "chain_link_type", "wire_material", "character_marks",
          "primary_color", "secondary_colors", "color_pattern", "cut_type", "surface_finish",
          "treatment_status", "treated", "necklace_design"
        ];
        const operatorLockedKeys = [];
        const passiveStoredKeys = [];

        hardwareKeys.forEach(k => {
          const fullKey = `custom.${k}`;
          let val = "";
          let chosenSource = null;

          const hasManualEditFlag =
            manualEdits[currentId]?.[fullKey] === true ||
            manualEdits[currentId]?.[k] === true;
          const manualPlanVal =
            manifest.repairPlan?.[fullKey] !== undefined
              ? manifest.repairPlan[fullKey]
              : manifest.repairPlan?.[k];

          const approvalVal =
            approvals[currentId]?.[fullKey] !== undefined
              ? approvals[currentId][fullKey]
              : approvals[currentId]?.[k];

          if (hasManualEditFlag && manualPlanVal !== undefined) {
            val = manualPlanVal;
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              chosenSource = "operator_locked";
            }
          } else if (approvalVal !== undefined) {
            val = approvalVal;
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              chosenSource = "operator_locked";
            }
          } else if (manifest.currentMetafields?.[fullKey] !== undefined) {
            val = manifest.currentMetafields[fullKey];
            if (val !== undefined && val !== null && String(val).trim() !== "") {
              // If an unusable manual edit marker or approval marker exists without a usable value, keep conservative operator lock rather than marking passive
              chosenSource = (hasManualEditFlag || approvalVal !== undefined)
                ? "operator_locked"
                : "passive_stored";
            }
          }

          if (val !== undefined && val !== null && String(val).trim() !== "") {
            fd.set(k, String(val));
            if (chosenSource === "operator_locked") {
              operatorLockedKeys.push(k);
            } else if (chosenSource === "passive_stored") {
              passiveStoredKeys.push(k);
            }
          }
        });

        fd.append("operator_locked_fields", JSON.stringify(operatorLockedKeys));
        fd.append("passive_stored_fields", JSON.stringify(passiveStoredKeys));

        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 3 && !pieceAi.generateDescRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, generateDescRequested: true } }));
        setPendingOperation({ id: currentId, intent: "generateDescription", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 3: Generating Story Narrative (Gemini)..."]);

        const fd = new FormData();
        fd.append("intent", "generateDescription");
        fd.append("pieceId", currentId);
        const descriptionFacts = {};
        const tab3DataObj = validObj(pieceAi.tab3Data);

        const isFactKeyOperatorLocked = (factKey) => {
          const fullKey = `custom.${factKey}`;
          if (manualEdits[currentId]?.[fullKey] === true && manifest.repairPlan?.[fullKey] !== undefined && hasNonBlankValue(manifest.repairPlan[fullKey])) {
            return true;
          }
          if (manualEdits[currentId]?.[factKey] === true && manifest.repairPlan?.[factKey] !== undefined && hasNonBlankValue(manifest.repairPlan[factKey])) {
            return true;
          }
          if (approvals[currentId]?.[fullKey] !== undefined && hasNonBlankValue(approvals[currentId][fullKey])) {
            return true;
          }
          if (approvals[currentId]?.[factKey] !== undefined && hasNonBlankValue(approvals[currentId][factKey])) {
            return true;
          }
          return false;
        };

        const hasFreshTab3Classification = (factKey) => {
          if (!CLASSIFICATION_PRECEDENCE_KEYS.has(factKey)) return false;
          const rawTab3Val = tab3DataObj[factKey] ?? tab3DataObj[`custom.${factKey}`];
          return hasNonBlankValue(rawTab3Val);
        };

        const mergeDescriptionFacts = (source, isAuthoritative = false, isPassiveStoredSource = false) => {
          Object.entries(source || {}).forEach(([key, value]) => {
            if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
            if (key === "operator_locked_fields" || key === "passive_stored_fields") return;
            if (key === "canonical_title" || key === "custom.canonical_title" || key === "product_title") return;
            if (key.includes(".") && !key.startsWith("custom.")) return;

            const canonicalTarget = normalizeIncomingTargetKey(key);
            const factKey = canonicalTarget.startsWith("custom.") ? canonicalTarget.slice(7) : (key.startsWith("custom.") ? key.slice(7) : key);
            if (["intent", "success", "error", "errors", "logs", "debug_origin", "standardized_candidates", "shopify_title", "operator_locked_fields", "passive_stored_fields"].includes(factKey)) return;

            if (value !== undefined && value !== null && typeof value !== "object" && String(value).trim() !== "") {
              let cleanVal = String(value).trim();
              if (factKey === "piece_name") {
                cleanVal = extractPieceNameOnly(cleanVal, manifest.nativeTargets?.productTitle || product.title);
              }
              if (
                isPassiveStoredSource &&
                CLASSIFICATION_PRECEDENCE_KEYS.has(factKey) &&
                hasFreshTab3Classification(factKey) &&
                !isFactKeyOperatorLocked(factKey) &&
                hasNonBlankValue(descriptionFacts[factKey])
              ) {
                return;
              }
              if (isAuthoritative || !hasNonBlankValue(descriptionFacts[factKey])) {
                descriptionFacts[factKey] = cleanVal;
              }
              if (factKey === "material" && (isAuthoritative || !hasNonBlankValue(descriptionFacts.stone_family))) {
                descriptionFacts.stone_family = cleanVal;
              }
              if (factKey === "material" && (isAuthoritative || !hasNonBlankValue(descriptionFacts.primary_medium))) {
                descriptionFacts.primary_medium = cleanVal;
              }
            }
          });
        };

        // Merge in order so stored merchant facts and explicit edits/approvals take precedence over AI draft outputs,
        // while preserving freshly evidenced tab3Data classification values over passive stored classification labels
        mergeDescriptionFacts(pieceAi.titleParse, false, false);
        mergeDescriptionFacts(pieceAi.tab3Data, false, false);
        mergeDescriptionFacts(manifest.currentMetafields, true, true);

        Object.entries(approvals[currentId] || {}).forEach(([key, value]) => {
          if (
            key.startsWith("custom.") &&
            key !== "custom.standardized_candidates" &&
            key !== "custom.generated_description" &&
            manualEdits[currentId]?.[key] !== true
          ) {
            const fk = key.slice(7);
            if (fk === "operator_locked_fields" || fk === "passive_stored_fields") return;
            if (!hasNonBlankValue(value)) return;
            descriptionFacts[fk] = fk === "piece_name" ? extractPieceNameOnly(String(value ?? ""), manifest.nativeTargets?.productTitle || product.title) : value;
            if (fk === "material") {
              descriptionFacts.stone_family = value;
              descriptionFacts.primary_medium = value;
            }
          }
        });

        Object.entries(manualEdits[currentId] || {}).forEach(([key, edited]) => {
          if (
            edited === true &&
            key.startsWith("custom.") &&
            key !== "custom.standardized_candidates" &&
            key !== "custom.generated_description" &&
            manifest.repairPlan?.[key] !== undefined
          ) {
            const fk = key.slice(7);
            if (fk === "operator_locked_fields" || fk === "passive_stored_fields") return;
            const editVal = manifest.repairPlan[key];
            if (!hasNonBlankValue(editVal)) return;
            descriptionFacts[fk] = fk === "piece_name" ? extractPieceNameOnly(String(editVal ?? ""), manifest.nativeTargets?.productTitle || product.title) : editVal;
            if (fk === "material") {
              descriptionFacts.stone_family = editVal;
              descriptionFacts.primary_medium = editVal;
            }
          }
        });

        descriptionFacts.pieceId = currentId;
        fd.append("sharedFields", JSON.stringify({
          stone_family: descriptionFacts.material || descriptionFacts.stone_family || "",
          origin_location: descriptionFacts.origin_location || ""
        }));
        fd.append("pieceData", JSON.stringify(descriptionFacts));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 4) {
        const workflowRunId = pieceAi.workflowRunId || "ai_pipeline_default";
        const rawCandidates =
          pieceAi.stagedStandardizedCandidates !== undefined
            ? pieceAi.stagedStandardizedCandidates
            : (standardizedCandidatesByProduct[currentId] || {});
        const candidateBundle = buildCanonicalCandidateBundle(rawCandidates);
        const currentSnapshot = candidateBundle.snapshot;
        const attemptKey = `${workflowRunId}::${currentId}::${currentSnapshot}`;
        const hasAttemptedInScope = pieceAi.autoMatchAttemptKey === attemptKey;

        const readiness = evaluateProductReferenceMatchReadiness({
          productId: currentId,
          data: manifest,
          rawCandidates,
          refMatchResult: referenceMatchResultsByProduct?.[currentId] || null,
          refMatchStatus: referenceMatchStatusByProduct?.[currentId] || null,
          pendingReferenceMatch,
          expectedRequestId: hasAttemptedInScope ? (pieceAi.autoMatchRequestId || null) : null
        });

        if (readiness.state === "pending") {
          return;
        }

        const advanceAfterStage4 = () => {
          if (executionMode === "AI_SINGLE_PIPELINE") {
            setAiStep(5);
          } else {
            setAiStep(1);
            setExecuteIndex(i => i + 1);
          }
        };

        if (readiness.state === "no_candidates") {
          setManifestData(prevMan => {
            const existing = prevMan[currentId];
            if (!existing) return prevMan;
            return {
              ...prevMan,
              [currentId]: {
                ...existing,
                diagnostics: {
                  ...(existing.diagnostics || {}),
                  stage: "resolveStandardizedCandidates"
                }
              }
            };
          });
          updateProductState(currentId, STATUS.VALIDATED, [
            "Stage 4: No supported standardized Vision candidates staged; reference matching not required. AI Pipeline Complete."
          ]);
          advanceAfterStage4();
          return;
        }

        if (readiness.state === "matched_complete") {
          setManifestData(prevMan => {
            const existing = prevMan[currentId];
            if (!existing) return prevMan;
            const updatedRepairPlan = { ...(existing.repairPlan || {}) };
            const updatedMetadata = { ...(existing.metadata || {}) };

            VERIFIED_STANDARDIZED_DESTINATIONS.forEach(destKey => {
              if (manualEdits[currentId]?.[destKey] === true) return;
              const evalRes = readiness.destinationEvaluations?.[destKey];
              if (evalRes?.isTechnicallyEligible && evalRes.autoProposalSerialized) {
                updatedRepairPlan[destKey] = evalRes.autoProposalSerialized;
                updatedMetadata[destKey] = {
                  source: "Vision",
                  stage: "resolveStandardizedCandidates"
                };
              } else {
                delete updatedRepairPlan[destKey];
              }
            });

            return {
              ...prevMan,
              [currentId]: {
                ...existing,
                repairPlan: updatedRepairPlan,
                metadata: updatedMetadata,
                diagnostics: {
                  ...(existing.diagnostics || {}),
                  shopifyRead: "Success",
                  stage: "resolveStandardizedCandidates"
                }
              }
            };
          });

          const stage4CompleteMsg = readiness.hasLegitimateBlocks
            ? `Stage 4: Reference matching completed with blocks (${readiness.eligibleDestinationKeys.length} proposal(s) staged for review; ${readiness.blockedDestinationKeys.length} blocked by category/entry rules: ${readiness.blockedDestinationKeys.join(", ")} — not save-ready).`
            : `Stage 4: Reference matching completed (${readiness.eligibleDestinationKeys.length} proposal(s) staged for review; explicit approval required before saving).`;

          updateProductState(currentId, STATUS.VALIDATED, [stage4CompleteMsg]);
          advanceAfterStage4();
          return;
        }

        // At most one automatic attempt per (workflowRunId, product, snapshot)
        if (!hasAttemptedInScope) {
          if (referenceMatchFetcher?.state !== "idle" || pendingReferenceMatch !== null) {
            return;
          }

          const reqId = `refmatch_ai4_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
          setAiData(prev => ({
            ...prev,
            [currentId]: {
              ...(prev[currentId] || {}),
              autoMatchAttemptKey: attemptKey,
              autoMatchRequestId: reqId,
              autoMatchSnapshot: currentSnapshot
            }
          }));
          updateProductState(currentId, STATUS.SCANNING, [
            `Stage 4: Matching Standardized Reference Choices (request ${reqId})...`
          ]);

          const startRes = startReferenceMatchForProduct(currentId, {
            source: "ai_stage_4",
            workflowRunId,
            requestId: reqId,
            candidatesOverride: rawCandidates
          });

          if (!startRes.started) {
            const failMsg = `Stage 4 reference matching failed to start for ${currentId}: ${startRes.message}`;
            setManifestData(prevMan => {
              const existing = prevMan[currentId];
              if (!existing) return prevMan;
              return {
                ...prevMan,
                [currentId]: {
                  ...existing,
                  diagnostics: {
                    ...(existing.diagnostics || {}),
                    stage: "resolveStandardizedCandidates",
                    error: failMsg
                  }
                }
              };
            });
            updateProductState(currentId, STATUS.FAILED, [failMsg]);
            setSafetyError(failMsg);
            advanceAfterStage4();
          }
          return;
        }

        // Attempt was already dispatched in this scope; wait if fetcher is still transitioning
        if (referenceMatchFetcher?.state !== "idle") {
          return;
        }

        const latestStatus = referenceMatchStatusByProduct?.[currentId] || null;
        if (
          latestStatus &&
          latestStatus.requestId === pieceAi.autoMatchRequestId &&
          (latestStatus.state === "submitting" || latestStatus.state === "awaiting_response")
        ) {
          return;
        }

        const failReason =
          readiness.reason ||
          latestStatus?.message ||
          `Reference matching did not complete cleanly for ${currentId} (request ${pieceAi.autoMatchRequestId || "unknown"}).`;
        const failDetail = `Stage 4 reference matching ${latestStatus?.state || "failed/incomplete"}: ${failReason}`;

        setManifestData(prevMan => {
          const existing = prevMan[currentId];
          if (!existing) return prevMan;
          return {
            ...prevMan,
            [currentId]: {
              ...existing,
              diagnostics: {
                ...(existing.diagnostics || {}),
                stage: "resolveStandardizedCandidates",
                error: failDetail
              }
            }
          };
        });
        updateProductState(currentId, STATUS.FAILED, [failDetail]);
        setSafetyError(failDetail);
        advanceAfterStage4();
      }
    }
  }, [
    isLoadingData,
    isExecuting,
    batchFetcher.state,
    referenceMatchFetcher?.state,
    pendingOperation,
    pendingReferenceMatch,
    executionMode,
    loadIndex,
    executeIndex,
    aiStep,
    queueIds,
    selectedBenchId,
    manifestData,
    safeProducts,
    aiData,
    approvals,
    manualEdits,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    startReferenceMatchForProduct,
    updateProductState,
    getFieldMetadata
  ]);

  // Unified Response Receiver
  useEffect(() => {
    if (batchFetcher.state !== "idle") {
      return;
    }

    // Handle fetcher returning to idle without delivering new data after a non-idle submission cycle
    if (
      pendingOperation &&
      activeOperationCycleRef.current &&
      activeOperationCycleRef.current.token === pendingOperation.token &&
      activeOperationCycleRef.current.sawNonIdle &&
      batchFetcher.data === activeOperationCycleRef.current.baselineData
    ) {
      const stalledOp = pendingOperation;
      const isAutoSelectionOp = stalledOp.source === "auto_selection_load";
      const emptyPayloadMsg = `Request [${stalledOp.intent}] for ${stalledOp.id} returned to idle without delivering a response payload.`;
      if (stalledOp.intent === "loadProductData" && stalledOp.id) {
        autoSelectionLoadGuardRef.current[stalledOp.id] = {
          status: "failed",
          token: stalledOp.token,
          error: emptyPayloadMsg
        };
      }
      activeOperationCycleRef.current = null;
      setPendingOperation(null);
      updateProductState(stalledOp.id, STATUS.FAILED, [emptyPayloadMsg]);
      setSafetyError(emptyPayloadMsg);
      if (!isAutoSelectionOp) {
        setIsExecuting(false);
        setIsLoadingData(false);
      }
      return;
    }

    if (batchFetcher.data && batchFetcher.data !== lastProcessedData) {
      const data = batchFetcher.data;
      setLastProcessedData(data);

      const targetId = data.pieceId || data.productId;
      const intent = data.intent;
      const success = data.success;
      const isAutoSelectionOp = pendingOperation?.source === "auto_selection_load";
      const pendingStageLabel = isAutoSelectionOp
        ? "Auto Selection Load"
        : isLoadingData
          ? "Manifest Load"
          : "AI/Repair";

      if (intent === "resolveStandardizedCandidates") {
        return;
      }

      if (pendingOperation) {
        const productIntents = ["loadProductData", "executeRepairPlan", "batchAuditItem", "saveMetafields", "titleParse", "tab3FullRescan", "generateDescription"];
        if (productIntents.includes(intent)) {
          if (!targetId || targetId !== pendingOperation.id) {
            if (pendingOperation.intent === "loadProductData" && pendingOperation.id) {
              const idErr = !success
                ? (sanitizeDiagString(typeof data.message === "string" ? data.message : "") ||
                   sanitizeDiagString(typeof data.error === "string" ? data.error : "") ||
                   "Load request failed without matching productId.")
                : `Identity Guard Failed: expected [${pendingOperation.id}], received [${targetId || "None"}].`;
              autoSelectionLoadGuardRef.current[pendingOperation.id] = {
                status: "failed",
                token: pendingOperation.token,
                error: idErr
              };
              updateProductState(pendingOperation.id, STATUS.FAILED, [idErr]);
            }
            const backendErrDetail = !success
              ? (sanitizeDiagString(typeof data.message === "string" ? data.message : "") ||
                 sanitizeDiagString(typeof data.error === "string" ? data.error : ""))
              : "";
            setSafetyError(
              `Identity Guard Failed. Response intent: [${intent}], returned ID: [${targetId || "None"}], expected ID: [${pendingOperation.id}], pending stage: [${pendingStageLabel}], processed state: [${success ? "Success" : "Failed"}]${backendErrDetail ? ` (${backendErrDetail})` : ""}. Result discarded.`
            );
            if (!isAutoSelectionOp) {
              setIsExecuting(false);
              setIsLoadingData(false);
            }
            activeOperationCycleRef.current = null;
            setPendingOperation(null);
            return;
          }
        }
        if (intent !== pendingOperation.intent) {
          if (!productIntents.includes(intent)) {
            if (pendingOperation.intent === "loadProductData" && pendingOperation.id) {
              autoSelectionLoadGuardRef.current[pendingOperation.id] = {
                status: "failed",
                token: pendingOperation.token,
                error: `Unexpected response intent [${intent || "unknown"}].`
              };
              updateProductState(pendingOperation.id, STATUS.FAILED, [
                `Unexpected response intent [${intent || "unknown"}] while loading product data.`
              ]);
            }
            activeOperationCycleRef.current = null;
            setPendingOperation(null);
          } else {
            return;
          }
        }
      }

      if (!intent) {
        if (pendingOperation) {
          if (pendingOperation.intent === "loadProductData" && pendingOperation.id) {
            autoSelectionLoadGuardRef.current[pendingOperation.id] = {
              status: "failed",
              token: pendingOperation.token,
              error: "Unrecognized response (no intent provided by backend)."
            };
            updateProductState(pendingOperation.id, STATUS.FAILED, [
              "Unrecognized response: no intent provided by backend."
            ]);
          }
          setSafetyError(`Unrecognized Response. No intent provided by backend. Expected ID: [${pendingOperation.id}], pending stage: [${pendingStageLabel}]. Result discarded.`);
          if (!isAutoSelectionOp) {
            setIsExecuting(false);
            setIsLoadingData(false);
          }
          activeOperationCycleRef.current = null;
          setPendingOperation(null);
        }
        return;
      }

      const {
        message, error, errors, logs, status, finalStatus, titleParse, tab3Data, generated_description, fieldsUpdated, legacyKeysRemoved, verifiedGeoValues, readBackVerified, proposedChanges, variantTarget, imageAlts, altValidationErrors,
        nativeTargets: returnedNativeTargets,
        standardized_candidates: topLevelStdCandidates,
        unsupportedKeys: rawUnsupportedKeys,
        attemptedDestinations: rawAttemptedDestinations,
        verifiedDestinations: rawVerifiedDestinations,
        unresolvedChanges: rawUnresolvedChanges,
        blockedFields: rawBlockedFields,
        conflicts: rawConflicts,
        unchanged: rawUnchanged
      } = data;

      const unsupportedKeys = validArray(rawUnsupportedKeys);
      const attemptedDestinations = validArray(rawAttemptedDestinations);
      const verifiedDestinations = validArray(rawVerifiedDestinations);
      const unchangedDestinations = validArray(rawUnchanged);
      const unresolvedChanges = { ...validObj(rawUnresolvedChanges) };
      const blockedFields = { ...validObj(rawBlockedFields) };
      const conflicts = { ...validObj(rawConflicts) };

      const normalizedErrorObjects = extractNormalizedErrors(errors, error);
      const formattedErrorStrings = normalizedErrorObjects.map(e => e.formatted);

      if (intent === "loadProductData" && targetId) {
        const specificErrorSummary = formattedErrorStrings.join(" | ");
        const safeGenericMessage = sanitizeDiagString(typeof message === "string" ? message : "");

        if (!success) {
          const loadErrText = specificErrorSummary || safeGenericMessage || "Failed to load data";
          autoSelectionLoadGuardRef.current[targetId] = {
            status: "failed",
            token: pendingOperation?.token || "load_failed",
            error: loadErrText
          };
          updateProductState(targetId, STATUS.FAILED, formattedErrorStrings.length > 0 ? formattedErrorStrings : [loadErrText]);
          if (isAutoSelectionOp) {
            setSafetyError(`Failed to load baseline for ${targetId}: ${loadErrText}`);
          } else {
            setApprovals(prev => { const n = {...prev}; delete n[targetId]; return n; });
            setManualEdits(prev => { const n = {...prev}; delete n[targetId]; return n; });
          }
        } else {
          autoSelectionLoadGuardRef.current[targetId] = {
            status: "loaded",
            token: pendingOperation?.token || "load_succeeded"
          };

          setManualEdits(prev => {
            const n = {...prev};
            if (n[targetId]) {
              const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
              Object.keys(n[targetId]).forEach(k => {
                if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
              });
            }
            return n;
          });
          setApprovals(prev => {
            const n = {...prev};
            if (n[targetId]) {
              const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
              Object.keys(n[targetId]).forEach(k => {
                if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
              });
            }
            return n;
          });

          setManifestData(prev => {
            const existingManifest = prev[targetId];
            // If automatic selection load resolves after a manifest was already populated for this product, preserve existing manifest & unsaved state
            if (isAutoSelectionOp && existingManifest) {
              return prev;
            }

            const prevDiag = existingManifest?.diagnostics || {};
            const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);
            const productManualEdits = manualEdits[targetId] || {};
            const productApprovals = approvals[targetId] || {};

            const { cleanedPlan, aliasConflicts } = normalizeLoadedPlanAndAliases(
              data.repairPlan || {},
              data.currentMetafields || {},
              productManualEdits,
              productApprovals,
              allConfigFields
            );

            // Preserve any existing unsaved manual edits or explicit approvals in repairPlan without creating disconnected native proposal keys
            if (existingManifest?.repairPlan && typeof existingManifest.repairPlan === "object") {
              Object.keys(productManualEdits).forEach(editedKey => {
                if (productManualEdits[editedKey] !== true) return;
                const proposalStorageKey = NATIVE_ALIAS_MAP[editedKey] || editedKey;
                const existingEditedVal =
                  existingManifest.repairPlan[proposalStorageKey] !== undefined
                    ? existingManifest.repairPlan[proposalStorageKey]
                    : existingManifest.repairPlan[editedKey];
                if (existingEditedVal !== undefined) {
                  cleanedPlan[proposalStorageKey] = existingEditedVal;
                }
              });
            }
            Object.entries(productApprovals).forEach(([approvedKey, approvedVal]) => {
              if (approvedVal === undefined) return;
              const proposalStorageKey = NATIVE_ALIAS_MAP[approvedKey] || approvedKey;
              if (
                productManualEdits[approvedKey] !== true &&
                productManualEdits[proposalStorageKey] !== true &&
                cleanedPlan[proposalStorageKey] === undefined
              ) {
                cleanedPlan[proposalStorageKey] = approvedVal;
              }
            });

            // Ensure piece_name in repairPlan holds only the piece name if it was seeded with a 3-part title
            if (hasNonBlankValue(cleanedPlan["custom.piece_name"])) {
              cleanedPlan["custom.piece_name"] = extractPieceNameOnly(
                cleanedPlan["custom.piece_name"],
                data.nativeTargets?.productTitle || data.productTitle || ""
              );
            }

            const mergedConflicts = {
              ...validObj(data.conflicts),
              ...aliasConflicts
            };

            return {
              ...prev,
              [targetId]: {
                ...data,
                ...(existingManifest?.metadata ? { metadata: existingManifest.metadata } : {}),
                ...(existingManifest?.verifiedGeoValues ? { verifiedGeoValues: existingManifest.verifiedGeoValues } : {}),
                repairPlan: cleanedPlan,
                conflicts: mergedConflicts,
                diagnostics: {
                  shopifyRead: success ? "Success" : "Failed",
                  gemini: prevDiag.gemini === "Success" ? "Success" : "Not called",
                  vision: prevDiag.vision === "Success" ? "Success" : "Not called",
                  geoLibrary: prevDiag.geoLibrary === "Success" ? "Success" : "Not called",
                  readBack: "Not called",
                  stage: "loadProductData",
                  error: prevDiag.error || null,
                  errors: validArray(prevDiag.errors)
                }
              }
            };
          });
          updateProductState(targetId, STATUS.VALIDATED, ["Data Loaded. Manifest Built."]);
        }
      }

      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && targetId && (!pendingOperation || pendingOperation.intent === intent)) {
        const submittedSnapForOp =
          validObj(pendingOperation?.submittedSnapshot || activeOperationCycleRef.current?.submittedSnapshot);

        // Verify that any decoupled native destinations actually submitted in this request (e.g. native_seo_title, native_description)
        // were processed by the backend rather than silently ignored or falsely treated as "NO_CHANGES_REQUIRED".
        if (intent === "executeRepairPlan") {
          const decoupledNativeKeysToVerify = [
            "native_description",
            "native_seo_title",
            "native_seo_description",
            "native_title",
            "native_shipping_weight"
          ];
          decoupledNativeKeysToVerify.forEach((nKey) => {
            if (!Object.prototype.hasOwnProperty.call(submittedSnapForOp, nKey)) return;
            const submittedVal = submittedSnapForOp[nKey];
            const wasAttempted = attemptedDestinations.includes(nKey);
            const wasVerified = verifiedDestinations.includes(nKey);
            const wasUnchanged = unchangedDestinations.includes(nKey);
            const wasBlocked = Object.prototype.hasOwnProperty.call(blockedFields, nKey);
            const wasUnresolved = Object.prototype.hasOwnProperty.call(unresolvedChanges, nKey);
            const wasConflict = Object.prototype.hasOwnProperty.call(conflicts, nKey);

            if (!wasAttempted && !wasVerified && !wasUnchanged && !wasBlocked && !wasUnresolved && !wasConflict) {
              const unrecMsg = `Submitted native destination '${nKey}' was not processed or verified by backend executeRepairPlan handler.`;
              unresolvedChanges[nKey] = {
                reason: unrecMsg,
                expected: submittedVal,
                actual: "Unprocessed by backend"
              };
              conflicts[nKey] = {
                expected: submittedVal,
                actual: "Unprocessed by backend"
              };
              const unrecEntry = normalizeReturnedErrorEntry({
                destination: nKey,
                code: "UNPROCESSED_NATIVE_DESTINATION",
                message: unrecMsg
              });
              if (unrecEntry && !formattedErrorStrings.includes(unrecEntry.formatted)) {
                normalizedErrorObjects.push(unrecEntry);
                formattedErrorStrings.push(unrecEntry.formatted);
              }
            }
          });
        }

        const specificErrorSummary = formattedErrorStrings.join(" | ");
        const safeGenericMessage = sanitizeDiagString(typeof message === "string" ? message : "");

        // Reconcile verified changed count from verifiedDestinations (which only includes attempted changes that passed read-back,
        // never unchanged matches) so a verified native-only save (e.g. native_seo_title or native_description) is never counted as 0.
        const rawNumericUpdated =
          typeof fieldsUpdated === "number" && Number.isFinite(fieldsUpdated)
            ? Math.max(0, Math.floor(fieldsUpdated))
            : 0;
        const verifiedChangedDestinationsCount = verifiedDestinations.filter(
          (dest) => !unchangedDestinations.includes(dest)
        ).length;
        const effectiveFieldsUpdated = Math.max(rawNumericUpdated, verifiedChangedDestinationsCount);

        const hasExplicitConfirmationEvidence =
          intent === "executeRepairPlan" &&
          (typeof readBackVerified === "boolean" ||
            verifiedDestinations.length > 0 ||
            attemptedDestinations.length > 0 ||
            status === "NO_CHANGES_REQUIRED" ||
            status === "REPAIRED" ||
            status === "PARTIAL_SUCCESS" ||
            status === "REPAIR_BLOCKED" ||
            status === "REPAIR_FAILED");

        const isUnverifiedNoOpResponse =
          intent === "saveMetafields" ||
          (intent === "executeRepairPlan" && !hasExplicitConfirmationEvidence);

        const hasUnresolvedOrConflicts =
          Object.keys(unresolvedChanges).length > 0 ||
          Object.keys(conflicts).length > 0;
        const hasBlockedOrUnsupported =
          Object.keys(blockedFields).length > 0 ||
          unsupportedKeys.length > 0;

        const effectiveReadBackVerified =
          Boolean(readBackVerified === true) &&
          !hasUnresolvedOrConflicts &&
          !isUnverifiedNoOpResponse;

        if (intent === "executeRepairPlan" || intent === "saveMetafields") {
          const ts = new Date().toISOString();
          const isFailedOrPartial =
            !success ||
            isUnverifiedNoOpResponse ||
            hasUnresolvedOrConflicts ||
            hasBlockedOrUnsupported ||
            status === "REPAIR_FAILED" ||
            status === "REPAIR_BLOCKED" ||
            status === "PARTIAL_SUCCESS" ||
            finalStatus === "PARTIAL_SUCCESS" ||
            effectiveReadBackVerified === false;

          const effectiveHistoryStatus = isUnverifiedNoOpResponse
            ? "UNVERIFIED_RESPONSE"
            : hasUnresolvedOrConflicts || (hasBlockedOrUnsupported && effectiveFieldsUpdated > 0)
              ? "PARTIAL_SUCCESS"
              : (status === "NO_CHANGES_REQUIRED" && effectiveFieldsUpdated > 0
                  ? "REPAIRED"
                  : status);

          const effectiveHistorySuccess =
            Boolean(success) &&
            !isUnverifiedNoOpResponse &&
            !hasUnresolvedOrConflicts &&
            effectiveHistoryStatus !== "REPAIR_FAILED" &&
            effectiveHistoryStatus !== "REPAIR_BLOCKED";

          setRepairHistory(prev => {
            const priorHistory = prev[targetId] || {};
            const unverifiedMsg = isUnverifiedNoOpResponse
              ? `Missing persistence confirmation: Backend returned generic response for '${intent}' without verified destinations or read-back evidence.`
              : null;
            const preservedErrors = normalizedErrorObjects.length > 0
              ? normalizedErrorObjects
              : (unverifiedMsg
                  ? [{ message: unverifiedMsg, field: null, code: "UNVERIFIED_PERSISTENCE", destination: null, formatted: unverifiedMsg }]
                  : (isFailedOrPartial ? validArray(priorHistory.errors) : []));
            const preservedErrorStrings = formattedErrorStrings.length > 0
              ? formattedErrorStrings
              : (unverifiedMsg
                  ? [unverifiedMsg]
                  : (isFailedOrPartial ? validArray(priorHistory.errorMessages) : []));
            const effectiveMessage = unverifiedMsg
              || (specificErrorSummary
                ? (safeGenericMessage && safeGenericMessage !== specificErrorSummary
                    ? `${specificErrorSummary} (${safeGenericMessage})`
                    : specificErrorSummary)
                : (safeGenericMessage || priorHistory.message || null));

            return {
              ...prev,
              [targetId]: {
                status: effectiveHistoryStatus,
                success: effectiveHistorySuccess,
                message: effectiveMessage,
                rawMessage: safeGenericMessage || null,
                errors: preservedErrors,
                errorMessages: preservedErrorStrings,
                fieldsUpdated: (!effectiveHistorySuccess && effectiveFieldsUpdated === 0) ? 0 : effectiveFieldsUpdated,
                legacyKeysRemoved: (!effectiveHistorySuccess || isUnverifiedNoOpResponse) ? (legacyKeysRemoved !== undefined ? legacyKeysRemoved : 0) : legacyKeysRemoved,
                unsupportedKeys,
                attemptedDestinations,
                verifiedDestinations,
                unresolvedChanges,
                blockedFields,
                conflicts,
                readBackVerified: effectiveHistorySuccess ? effectiveReadBackVerified : false,
                proposedChanges,
                completedAt: ts,
                variantTarget: variantTarget || null
              }
            };
          });

          if (data.currentMetafields || returnedNativeTargets || !success || isFailedOrPartial || normalizedErrorObjects.length > 0) {
            setManifestData(prev => {
              const existing = prev[targetId];
              if (!existing) return prev;

              const existingDiag = existing.diagnostics || {};
              const updatedNativeTargets = returnedNativeTargets
                ? mergeReadBackNativeTargets(existing.nativeTargets, returnedNativeTargets)
                : existing.nativeTargets;

              const updatedCanonicalFields = { ...(existing.canonicalFields || {}) };
              if (returnedNativeTargets) {
                const unverifiedNative = validArray(returnedNativeTargets.unverifiedFields);
                if (unverifiedNative.includes("productTitle") || typeof returnedNativeTargets.productTitle !== "string") {
                  delete updatedCanonicalFields.shopify_title;
                } else {
                  updatedCanonicalFields.shopify_title = returnedNativeTargets.productTitle;
                }
              }

              const unverifiedMsg = isUnverifiedNoOpResponse
                ? `Missing persistence confirmation for '${intent}': No verified destinations or read-back evidence returned.`
                : null;
              const preservedDiagErrors = normalizedErrorObjects.length > 0
                ? normalizedErrorObjects
                : (unverifiedMsg
                    ? [{ message: unverifiedMsg, field: null, code: "UNVERIFIED_PERSISTENCE", destination: null, formatted: unverifiedMsg }]
                    : (isFailedOrPartial ? validArray(existingDiag.errors) : []));
              const preservedDiagErrorText = unverifiedMsg
                || specificErrorSummary
                || (isFailedOrPartial ? (safeGenericMessage || existingDiag.error || null) : null);

              const readBackDiagStatus = (!success || isUnverifiedNoOpResponse || hasUnresolvedOrConflicts)
                ? (returnedNativeTargets || hasUnresolvedOrConflicts ? "Failed" : "Not called")
                : (effectiveReadBackVerified ? "Success" : (data.readBackVerified === false ? "Failed" : "Not called"));

              // Replace conflicts for destinations that succeeded on read-back while preserving alias conflicts on unattempted fields
              const nextConflicts = { ...(existing.conflicts || {}) };
              verifiedDestinations.forEach((vKey) => {
                delete nextConflicts[vKey];
              });
              Object.assign(nextConflicts, conflicts);

              return {
                ...prev,
                [targetId]: {
                  ...existing,
                  currentMetafields: (success && !isUnverifiedNoOpResponse && data.currentMetafields) ? data.currentMetafields : existing.currentMetafields,
                  nativeTargets: updatedNativeTargets,
                  canonicalFields: updatedCanonicalFields,
                  productTitle:
                    returnedNativeTargets && typeof returnedNativeTargets.productTitle === "string"
                      ? returnedNativeTargets.productTitle
                      : existing.productTitle,
                  descriptionHtml:
                    returnedNativeTargets && typeof returnedNativeTargets.descriptionHtml === "string"
                      ? returnedNativeTargets.descriptionHtml
                      : existing.descriptionHtml,
                  seo:
                    returnedNativeTargets && returnedNativeTargets.seo && typeof returnedNativeTargets.seo === "object"
                      ? returnedNativeTargets.seo
                      : existing.seo,
                  fieldsUpdated: (!isUnverifiedNoOpResponse && (effectiveFieldsUpdated > 0 || data.fieldsUpdated !== undefined))
                    ? effectiveFieldsUpdated
                    : existing.fieldsUpdated,
                  legacyKeysRemoved: (success && !isUnverifiedNoOpResponse && data.legacyKeysRemoved !== undefined) ? data.legacyKeysRemoved : existing.legacyKeysRemoved,
                  blockedFields: blockedFields,
                  conflicts: nextConflicts,
                  diagnostics: {
                    ...existingDiag,
                    shopifyRead: existingDiag.shopifyRead || "Success",
                    readBack: readBackDiagStatus,
                    stage: intent,
                    error: preservedDiagErrorText,
                    errors: preservedDiagErrors
                  }
                }
              };
            });
          }
        }

        if (!success || isUnverifiedNoOpResponse || hasUnresolvedOrConflicts) {
          console.error("Execute Error or Unverified Persistence from Backend:", data);
          const unverifiedMsg = isUnverifiedNoOpResponse
            ? `Missing persistence confirmation for '${intent}': No verified destinations or read-back evidence returned.`
            : null;
          const primaryErrorDisplay = unverifiedMsg
            || (specificErrorSummary
              ? (safeGenericMessage && safeGenericMessage !== specificErrorSummary
                  ? `${specificErrorSummary} (${safeGenericMessage})`
                  : specificErrorSummary)
              : (safeGenericMessage || "Unknown Error"));
          setSafetyError(`Engine halted on ${targetId}. Error: ${primaryErrorDisplay}`);
          const failureLogs = formattedErrorStrings.length > 0
            ? formattedErrorStrings
            : (Array.isArray(logs) && logs.length > 0 ? logs.map(l => sanitizeDiagString(String(l))).filter(Boolean) : [primaryErrorDisplay]);
          if (Object.keys(blockedFields).length > 0) {
            failureLogs.push(`Partial API block: ${Object.keys(blockedFields).length} destination(s) blocked.`);
          }
          if (Object.keys(conflicts).length > 0) {
            failureLogs.push(`Read-back conflict: ${Object.keys(conflicts).length} destination(s) failed verification.`);
          }
          updateProductState(targetId, STATUS.FAILED, failureLogs);
        } else {
          if (intent === "batchAuditItem") {
            updateProductState(targetId, STATUS.SCANNING, ["AI Run complete. Fetching fresh data..."]);
            setSafetyMessage("Single AI Run complete. Reloading manifest to display new data...");
            setManifestData(prev => {
              const existing = prev[targetId];
              if (!existing) return prev;
              return {
                ...prev,
                [targetId]: {
                  ...existing,
                  diagnostics: {
                    ...existing.diagnostics, gemini: "Success", vision: "Success", stage: "batchAuditItem"
                  }
                }
              };
            });

            let loadLockActive = true;
            if (!pendingOperation) {
              setPendingOperation({ id: targetId, intent: "loadProductData", token: "audit-reload" });
            } else {
              loadLockActive = false;
            }

            setTimeout(() => {
              if (loadLockActive) {
                const fd = new FormData();
                fd.append("intent", "loadProductData");
                fd.append("pieceId", targetId);
                batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
              }
            }, 500);
          }

          const successLogs = Array.isArray(logs) && logs.length > 0
            ? [...logs]
            : [safeGenericMessage || "Operation applied successfully."];
          if (formattedErrorStrings.length > 0) {
            formattedErrorStrings.forEach(errLine => {
              if (!successLogs.includes(errLine)) successLogs.push(errLine);
            });
          }

          let statusToSet = STATUS.COMPLETE;
          const isGenuineNoOp =
            effectiveFieldsUpdated === 0 &&
            verifiedDestinations.length === 0 &&
            !hasBlockedOrUnsupported &&
            !hasUnresolvedOrConflicts &&
            formattedErrorStrings.length === 0 &&
            (status === "NO_CHANGES_REQUIRED" || safeGenericMessage === "No changes required." || safeGenericMessage === "No intended changes required.");

          if (isGenuineNoOp) {
            statusToSet = STATUS.SKIPPED;
            if (!successLogs.includes("No changes required.")) {
              successLogs.push("No changes required.");
            }
          } else if (
            finalStatus === "Needs Review" ||
            status === "REPAIR_FAILED" ||
            status === "REPAIR_BLOCKED" ||
            status === "PARTIAL_SUCCESS" ||
            finalStatus === "PARTIAL_SUCCESS" ||
            hasBlockedOrUnsupported ||
            hasUnresolvedOrConflicts ||
            effectiveReadBackVerified !== true
          ) {
            statusToSet = STATUS.FAILED;
            if (effectiveReadBackVerified !== true && !successLogs.some(l => l.includes("Read-back"))) {
              successLogs.push("Missing read-back confirmation from backend.");
            }
          }

          if (Object.keys(blockedFields).length > 0) successLogs.push(`Partial API block: ${Object.keys(blockedFields).length} fields rejected by Shopify.`);
          if (Object.keys(conflicts).length > 0) successLogs.push(`Read-back error: ${Object.keys(conflicts).length} fields failed to save properly.`);

          updateProductState(targetId, statusToSet, successLogs);
        }
      }

      if (["titleParse", "tab3FullRescan", "generateDescription"].includes(intent) && (!pendingOperation || pendingOperation.intent === intent)) {
        const specificErrorSummary = formattedErrorStrings.join(" | ");
        const safeGenericMessage = sanitizeDiagString(typeof message === "string" ? message : "");

        if (!success) {
          const aiErrDisplay = specificErrorSummary || safeGenericMessage || `Gemini failed at ${intent}`;
          updateProductState(targetId, STATUS.FAILED, formattedErrorStrings.length > 0 ? formattedErrorStrings : [aiErrDisplay]);
          setSafetyError(`Engine halted on piece ${targetId}. Error: ${aiErrDisplay}`);
          setManifestData(prev => {
            const existing = prev[targetId];
            if (!existing) return prev;
            const existingDiag = existing.diagnostics || {};
            const diagnostics = {
              ...existingDiag,
              error: aiErrDisplay,
              errors: normalizedErrorObjects.length > 0 ? normalizedErrorObjects : validArray(existingDiag.errors)
            };
            if (intent === "titleParse" || intent === "generateDescription") diagnostics.gemini = "Failed";
            if (intent === "tab3FullRescan") { diagnostics.vision = "Failed"; diagnostics.gemini = "Failed"; }
            return { ...prev, [targetId]: { ...existing, diagnostics } };
          });
        } else {
          if (intent === "titleParse") {
            setAiData(prev => ({ ...prev, [targetId]: { ...prev[targetId], titleParse } }));
          }
          else if (intent === "tab3FullRescan") {
            const rawCandidatesSource =
              (tab3Data && typeof tab3Data === "object" && tab3Data.standardized_candidates !== undefined)
                ? tab3Data.standardized_candidates
                : topLevelStdCandidates;
            const newBundle = buildCanonicalCandidateBundle(rawCandidatesSource);
            const validatedCandidates = newBundle.ordered;
            const newSnapshot = newBundle.snapshot;

            setStandardizedCandidatesByProduct(prev => {
              const prevSnapshot = buildCanonicalCandidateSnapshot(prev[targetId]);
              if (prevSnapshot !== newSnapshot) {
                setReferenceMatchResultsByProduct(prevRes => {
                  if (!prevRes[targetId]) return prevRes;
                  const nextRes = { ...prevRes };
                  delete nextRes[targetId];
                  return nextRes;
                });
                setApprovals(prevApp => {
                  if (!prevApp[targetId]) return prevApp;
                  const nextProdApp = { ...prevApp[targetId] };
                  VERIFIED_STANDARDIZED_DESTINATIONS.forEach(dk => delete nextProdApp[dk]);
                  return { ...prevApp, [targetId]: nextProdApp };
                });
                setReferenceMatchStatusByProduct(prevStat => ({
                  ...prevStat,
                  [targetId]: {
                    state: newBundle.hasSupported ? "ready" : "failed",
                    tone: newBundle.hasSupported ? "info" : "warning",
                    snapshot: newSnapshot,
                    message: newBundle.hasSupported
                      ? `Vision staged ${newBundle.count} standardized candidate attribute(s) (${Object.keys(validatedCandidates).join(", ")}). Previous matching results (if any) were invalidated. Automatic Stage 4 matching will validate reference entries.`
                      : "Vision scan completed, but no supported standardized attribute candidates were returned for the 6 allowed keys.",
                    updatedAt: new Date().toISOString()
                  }
                }));
              } else if (!prev[targetId]) {
                setReferenceMatchStatusByProduct(prevStat => ({
                  ...prevStat,
                  [targetId]: {
                    state: newBundle.hasSupported ? "ready" : "failed",
                    tone: newBundle.hasSupported ? "info" : "warning",
                    snapshot: newSnapshot,
                    message: newBundle.hasSupported
                      ? `Vision staged ${newBundle.count} standardized candidate attribute(s). Automatic Stage 4 matching will validate reference entries.`
                      : "Vision scan completed, but no supported standardized attribute candidates were returned for the 6 allowed keys.",
                    updatedAt: new Date().toISOString()
                  }
                }));
              }
              return {
                ...prev,
                [targetId]: validatedCandidates
              };
            });

            const cleanedTab3Data = validObj(tab3Data) ? { ...tab3Data } : {};
            delete cleanedTab3Data.standardized_candidates;
            delete cleanedTab3Data["custom.standardized_candidates"];
            delete cleanedTab3Data.operator_locked_fields;
            delete cleanedTab3Data.passive_stored_fields;
            delete cleanedTab3Data["custom.operator_locked_fields"];
            delete cleanedTab3Data["custom.passive_stored_fields"];

            setAiData(prev => ({
              ...prev,
              [targetId]: {
                ...prev[targetId],
                tab3Data: cleanedTab3Data,
                stagedStandardizedCandidates: validatedCandidates,
                verifiedGeoValues,
                imageAlts,
                altValidationErrors
              }
            }));
          }
          else if (intent === "generateDescription") {
            setAiData(prevAi => {
              const updatedPieceAi = { ...prevAi[targetId], generated_description };
              setManifestData(prevMan => {
                const existing = prevMan[targetId];
                if (!existing) return prevMan;
                const newPlan = { ...(existing.repairPlan || {}) };
                const newMetadata = { ...(existing.metadata || {}) };
                const newConflicts = { ...(existing.conflicts || {}) };
                delete newPlan.standardized_candidates;
                delete newPlan["custom.standardized_candidates"];
                delete newPlan.operator_locked_fields;
                delete newPlan.passive_stored_fields;
                delete newPlan["custom.operator_locked_fields"];
                delete newPlan["custom.passive_stored_fields"];
                delete newPlan["custom.stone_family"];
                delete newPlan["stone_family"];
                delete newPlan["custom.primary_medium"];
                delete newPlan["primary_medium"];
                delete newPlan["custom.is_ooak"];
                delete newPlan["is_ooak"];
                delete newPlan["custom.origin_handle"];
                delete newPlan["origin_handle"];
                delete newPlan["custom.canonical_title"];
                delete newPlan["canonical_title"];
                const diagnostics = { ...(existing.diagnostics || {}) };

                const titleData = validObj(updatedPieceAi.titleParse);
                const visionData = validObj(updatedPieceAi.tab3Data);
                const descData = updatedPieceAi.generated_description || "";
                const rawVerifiedGeo = validObj(updatedPieceAi.verifiedGeoValues);

                const geoSourceName = titleData?.geoSource || visionData?.geoSource || null;
                const isVerifiedDbOrLibraryGeo =
                  geoSourceName === "library" || geoSourceName === "database" || geoSourceName === "cache";

                if (updatedPieceAi.titleParseRequested) {
                  diagnostics.gemini = "Success";
                  diagnostics.geoLibrary = geoSourceName === "library" ? "Success" : (geoSourceName || "Not reported");
                  diagnostics.stage = "titleParse";
                }
                if (updatedPieceAi.fullRescanRequested) {
                  diagnostics.vision = "Success"; diagnostics.gemini = "Success"; diagnostics.stage = "tab3FullRescan";
                }
                if (updatedPieceAi.generateDescRequested) {
                  diagnostics.gemini = "Success"; diagnostics.stage = "generateDescription";
                }

                const allConfigFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);

                // Build sanitized verifiedGeoValues: never label generated defaults or copied era-as-age as verified database facts
                const sanitizedVerifiedGeo = {};
                Object.entries(rawVerifiedGeo).forEach(([gk, gv]) => {
                  if (!hasNonBlankValue(gv)) return;
                  const cleanGeoKey = gk.replace(/^custom\./, "");
                  if (cleanGeoKey === "geological_age") {
                    const eraVal = rawVerifiedGeo.geological_era ?? titleData.geological_era ?? visionData.geological_era;
                    if (eraVal !== undefined && String(gv).trim() === String(eraVal).trim()) {
                      return;
                    }
                  }
                  sanitizedVerifiedGeo[cleanGeoKey] = gv;
                });

                const getExpectedFieldType = (destKey) => {
                  const cfg = allConfigFields.find(f => resolveConfigFieldDestination(f) === destKey || f.key === destKey);
                  if (cfg?.type) return cfg.type;
                  if (destKey === "custom.character_marks" || destKey === "custom.stone_story") return "list.single_line_text_field";
                  if (destKey === "custom.weight_grams" || destKey === "custom.shipping_weight_oz") return "number_decimal";
                  if (destKey === "custom.honest_flaws_and_character" || destKey === "custom.origin_story" || destKey === "custom.generated_description") return "multi_line_text_field";
                  return "single_line_text_field";
                };

                const isLockedByOperator = (destKey) => {
                  if (manualEdits[targetId]?.[destKey] === true) return true;
                  if (approvals[targetId]?.[destKey] !== undefined) return true;
                  const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
                  return companions.some(ak => manualEdits[targetId]?.[ak] === true || approvals[targetId]?.[ak] !== undefined);
                };

                const hasExistingMerchantValue = (destKey) => {
                  if (destKey === "shopify_title" || destKey === "native_title") {
                    return hasNonBlankValue(existing.nativeTargets?.productTitle);
                  }
                  if (destKey === "price" || destKey === "native_price") {
                    return hasNonBlankValue(existing.nativeTargets?.variants?.edges?.[0]?.node?.price);
                  }
                  if (destKey === "custom.shipping_weight_oz" || destKey === "native_shipping_weight") {
                    const w = existing.nativeTargets?.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
                    return (w?.value !== undefined && w?.value !== null && Number(w.value) > 0) ||
                           hasNonBlankValue(existing.currentMetafields?.["custom.shipping_weight_oz"]);
                  }
                  if (hasNonBlankValue(existing.currentMetafields?.[destKey])) return true;
                  const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
                  return companions.some(ak => {
                    const fullAk = ak.includes(".") ? ak : `custom.${ak}`;
                    return hasNonBlankValue(existing.currentMetafields?.[fullAk]) || hasNonBlankValue(existing.currentMetafields?.[ak]);
                  });
                };

                const hasStoredConflictForCanonical = (destKey) => {
                  return Boolean(newConflicts?.[destKey]);
                };

                const stagedByCanonicalInThisPass = {};

                const safeApply = (rawKeyName, rawAiValue, sourceMeta = { source: "Gemini", stage: "AI_PIPELINE" }) => {
                  if (!hasNonBlankValue(rawAiValue)) return;
                  if (rawKeyName === "origin_story" || rawKeyName === "custom.origin_story") return;
                  if (rawKeyName === "standardized_candidates" || rawKeyName === "custom.standardized_candidates") return;
                  if (rawKeyName === "operator_locked_fields" || rawKeyName === "passive_stored_fields" || rawKeyName === "custom.operator_locked_fields" || rawKeyName === "custom.passive_stored_fields") return;
                  if (rawKeyName.startsWith("custom.std_") || rawKeyName.startsWith("std_")) return;
                  if (rawKeyName === "canonical_title" || rawKeyName === "custom.canonical_title" || rawKeyName === "product_title" || rawKeyName === "custom.product_title" || rawKeyName === "shopify_title" || rawKeyName === "native_title") {
                    return;
                  }

                  const targetKey = normalizeIncomingTargetKey(rawKeyName);
                  if (!targetKey || isEffectiveRetiredKey(targetKey) || isEffectiveRetiredKey(rawKeyName)) return;
                  if (targetKey === "custom.origin_story" || targetKey === "shopify_title" || targetKey === "native_title") return;
                  if (targetKey === "custom.operator_locked_fields" || targetKey === "custom.passive_stored_fields") return;
                  if (targetKey.startsWith("shopify.") && !isVerifiedStandardizedDestination(targetKey)) return;

                  // Never allow generated drafts to overwrite operator manual edits or explicit approvals
                  if (isLockedByOperator(targetKey)) return;

                  // Never silently overwrite an unresolved canonical/alias conflict
                  if (hasStoredConflictForCanonical(targetKey)) return;

                  // Preserve existing nonblank custom.treated and custom.treatment_status verbatim
                  if (
                    (targetKey === "custom.treated" || targetKey === "custom.treatment_status") &&
                    hasExistingMerchantValue(targetKey)
                  ) {
                    newPlan[targetKey] = String(existing.currentMetafields[targetKey]);
                    return;
                  }

                  // Never allow generated drafts to overwrite existing merchant measurements, price, or shipping weights
                  if (OPERATOR_AUTHORITATIVE_DESTINATIONS.has(targetKey) && hasExistingMerchantValue(targetKey)) {
                    return;
                  }

                  const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || f.key === targetKey);
                  if (isVerifiedStandardizedDestination(targetKey)) {
                    const stdEval = getStandardizedEvaluationForField(targetId, targetKey, existing);
                    const valCheck = validateProposedStandardizedGidList(rawAiValue, stdEval);
                    if (!valCheck.valid) return;
                    newPlan[targetKey] = JSON.stringify(valCheck.gids);
                    newMetadata[targetKey] = {
                      source: sourceMeta.source || "Vision",
                      stage: sourceMeta.stage || "resolveStandardizedCandidates"
                    };
                    return;
                  }

                  if (matchedConfig?.mappingStatus === "pending_read_only" || matchedConfig?.role === "standardized_attribute" || matchedConfig?.namespace === "shopify") {
                    return;
                  }

                  // Enforce piece_name contains only the piece name segment, never the 3-part canonical title
                  let normalizedValue = rawAiValue;
                  if (targetKey === "custom.piece_name") {
                    normalizedValue = extractPieceNameOnly(
                      String(rawAiValue),
                      titleData.canonical_title || existing.nativeTargets?.productTitle || ""
                    );
                    if (!hasNonBlankValue(normalizedValue)) return;
                  }

                  // Do not substitute geological_era for geological_age when an independent age was not provided
                  if (targetKey === "custom.geological_age") {
                    const eraCandidate =
                      visionData.geological_era ??
                      visionData["custom.geological_era"] ??
                      titleData.geological_era ??
                      titleData["custom.geological_era"] ??
                      existing.currentMetafields?.["custom.geological_era"];
                    const existingAge = existing.currentMetafields?.["custom.geological_age"];
                    if (
                      eraCandidate !== undefined &&
                      String(normalizedValue).trim() === String(eraCandidate).trim() &&
                      (!hasNonBlankValue(existingAge) || String(existingAge).trim() !== String(normalizedValue).trim())
                    ) {
                      return;
                    }
                  }

                  const expectedType = getExpectedFieldType(targetKey);
                  const formattedVal = formatComparableValue(normalizedValue, expectedType, targetKey);
                  if (!formattedVal) return;

                  const isDirectCanonicalKey =
                    rawKeyName === targetKey ||
                    `custom.${rawKeyName}` === targetKey ||
                    NATIVE_ALIAS_MAP[rawKeyName] === targetKey;

                  // Detect alias vs canonical conflicts within the incoming AI payloads
                  if (stagedByCanonicalInThisPass[targetKey] !== undefined) {
                    const priorStaged = stagedByCanonicalInThisPass[targetKey];
                    if (priorStaged.value !== formattedVal) {
                      if (isDirectCanonicalKey && !priorStaged.isDirectCanonical) {
                        newConflicts[targetKey] = {
                          expected: formattedVal,
                          actual: `${priorStaged.rawKey}: ${priorStaged.value}`
                        };
                        stagedByCanonicalInThisPass[targetKey] = {
                          value: formattedVal,
                          rawKey: rawKeyName,
                          isDirectCanonical: true
                        };
                        newPlan[targetKey] = formattedVal;
                        newMetadata[targetKey] = {
                          source: sourceMeta.source || "Not reported",
                          stage: sourceMeta.stage || "Not reported"
                        };
                      } else {
                        newConflicts[targetKey] = {
                          expected: priorStaged.value,
                          actual: `${rawKeyName}: ${formattedVal}`
                        };
                      }
                    }
                    return;
                  }

                  stagedByCanonicalInThisPass[targetKey] = {
                    value: formattedVal,
                    rawKey: rawKeyName,
                    isDirectCanonical: isDirectCanonicalKey
                  };

                  newPlan[targetKey] = formattedVal;
                  newMetadata[targetKey] = {
                    source: sourceMeta.source || "Not reported",
                    stage: sourceMeta.stage || "Not reported"
                  };
                };

                // Order keys so canonical keys (e.g. material, is_one_of_a_kind, origin_page_handle) are processed before legacy aliases
                const sortCanonicalFirst = (keys) =>
                  [...keys].sort((a, b) => {
                    const aIsAlias = Object.prototype.hasOwnProperty.call(CANONICAL_INCOMING_ALIAS_MAP, a) ? 1 : 0;
                    const bIsAlias = Object.prototype.hasOwnProperty.call(CANONICAL_INCOMING_ALIAS_MAP, b) ? 1 : 0;
                    return aIsAlias - bIsAlias;
                  });

                const GEOLOGY_FIELD_KEYS = new Set([
                  "mohs_hardness", "specific_gravity", "crystal_system", "luster",
                  "cleavage", "fracture_pattern", "diaphaneity", "mineral_class",
                  "rock_composition", "rock_formation", "geological_era", "geological_age", "tenacity"
                ]);

                const resolveFieldSourceMeta = (rawKey, defaultSource, defaultStage) => {
                  const bare = rawKey.replace(/^custom\./, "");
                  if (GEOLOGY_FIELD_KEYS.has(bare)) {
                    if (isVerifiedDbOrLibraryGeo && Object.prototype.hasOwnProperty.call(sanitizedVerifiedGeo, bare)) {
                      return { source: geoSourceName === "library" ? "Geo Library" : "Database", stage: defaultStage };
                    }
                    return { source: geoSourceName === "mindat" ? "Mindat" : defaultSource, stage: defaultStage };
                  }
                  return { source: defaultSource, stage: defaultStage };
                };

                sortCanonicalFirst(Object.keys(visionData)).forEach(k => {
                  if (
                    k !== "generated_description" &&
                    k !== "pieceId" &&
                    k !== "debug_origin" &&
                    k !== "intent" &&
                    k !== "success" &&
                    k !== "geoSource" &&
                    k !== "origin_story" &&
                    k !== "standardized_candidates" &&
                    k !== "custom.standardized_candidates" &&
                    k !== "operator_locked_fields" &&
                    k !== "passive_stored_fields" &&
                    k !== "poetic_hook"
                  ) {
                    if (k.startsWith("std_") || k.startsWith("custom.std_") || k.startsWith("shopify.")) return;
                    safeApply(k, visionData[k], resolveFieldSourceMeta(k, "Vision", "tab3FullRescan"));
                  }
                });

                sortCanonicalFirst(Object.keys(titleData)).forEach(k => {
                  if (
                    k !== "pieceId" &&
                    k !== "intent" &&
                    k !== "success" &&
                    k !== "geoSource" &&
                    k !== "origin_story" &&
                    k !== "standardized_candidates" &&
                    k !== "custom.standardized_candidates" &&
                    k !== "operator_locked_fields" &&
                    k !== "passive_stored_fields"
                  ) {
                    if (k.startsWith("std_") || k.startsWith("custom.std_") || k.startsWith("shopify.")) return;
                    const targetKey = normalizeIncomingTargetKey(k);
                    if (stagedByCanonicalInThisPass[targetKey] === undefined) {
                      safeApply(k, titleData[k], resolveFieldSourceMeta(k, "Gemini", "titleParse"));
                    }
                  }
                });

                const enrichedSeo = visionData.seo_title || visionData["custom.seo_title"] || titleData.seo_title || "";
                if (enrichedSeo.trim() !== "") {
                  safeApply("custom.seo_title", enrichedSeo.trim(), {
                    source: visionData.seo_title || visionData["custom.seo_title"] ? "Vision" : "Gemini",
                    stage: visionData.seo_title || visionData["custom.seo_title"] ? "tab3FullRescan" : "titleParse"
                  });
                }
                if (descData) {
                  safeApply("custom.generated_description", descData, {
                    source: "Gemini",
                    stage: "generateDescription"
                  });
                }

                if (visionData.poetic_hook) {
                  safeApply("native_seo_description", visionData.poetic_hook, {
                    source: "Vision",
                    stage: "tab3FullRescan"
                  });
                }

                if (updatedPieceAi.imageAlts) {
                  updatedPieceAi.imageAlts.forEach(altObj => {
                    if (altObj.imageId && altObj.altText) {
                      safeApply(`native_image_alts_${altObj.imageId}`, altObj.altText, {
                        source: "Vision",
                        stage: "tab3FullRescan"
                      });
                    }
                  });
                }
                if (updatedPieceAi.altValidationErrors) diagnostics.altValidationErrors = updatedPieceAi.altValidationErrors;

                return {
                  ...prevMan,
                  [targetId]: {
                    ...existing,
                    repairPlan: newPlan,
                    metadata: newMetadata,
                    conflicts: newConflicts,
                    diagnostics,
                    verifiedGeoValues: isVerifiedDbOrLibraryGeo ? sanitizedVerifiedGeo : {}
                  }
                };
              });
              return { ...prevAi, [targetId]: updatedPieceAi };
            });
            updateProductState(targetId, STATUS.SCANNING, [
              "Stage 3 complete. Proceeding to Stage 4: Standardized Reference Matching..."
            ]);
          }
        }
      }

      if (pendingOperation) {
        const op = pendingOperation;
        const wasAutoSelectionLoad = op.source === "auto_selection_load";
        activeOperationCycleRef.current = null;
        setPendingOperation(null);

        if (wasAutoSelectionLoad) {
          return;
        }

        if (!success) {
          setIsExecuting(false);
          setIsLoadingData(false);
          return;
        }

        if (isLoadingData) {
          setLoadIndex(i => i + 1);
        } else if (isExecuting) {
          if (executionMode === "REPAIR") {
            setExecuteIndex(i => i + 1);
          } else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
            if (op.intent === "titleParse") {
              setAiStep(2);
            } else if (op.intent === "tab3FullRescan") {
              setAiStep(3);
            } else if (op.intent === "generateDescription") {
              setAiStep(4);
            }
          }
        }
      }
    }
  }, [batchFetcher.state, batchFetcher.data, lastProcessedData, pendingOperation, executionMode, isLoadingData, isExecuting, manualEdits, approvals, updateProductState, getStandardizedEvaluationForField]);

  const handleExecuteSingleRepair = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
      setSafetyError("Generate Repair Plan for this item first.");
      return;
    }

    const product = safeProducts.find(p => p.id === selectedBenchId);
    if (!product) {
      setSafetyError("Product data not found in inventory.");
      return;
    }

    const rawCandidates = standardizedCandidatesByProduct[selectedBenchId] || {};
    const readiness = evaluateProductReferenceMatchReadiness({
      productId: selectedBenchId,
      data: manifest,
      rawCandidates,
      refMatchResult: referenceMatchResultsByProduct?.[selectedBenchId] || null,
      refMatchStatus: referenceMatchStatusByProduct?.[selectedBenchId] || null,
      pendingReferenceMatch
    });

    if (readiness.state === "pending") {
      setSafetyError(`Cannot execute repair for ${selectedBenchId}: Reference matching is currently in flight. Wait for matching to complete, review staged proposals, and click Execute Single Repair again.`);
      return;
    }

    if (readiness.requiresMatching) {
      const singleRepairRunId = `single_repair_preflight_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const preflightReqId = `refmatch_single_preflight_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      setAiData(prev => ({
        ...prev,
        [selectedBenchId]: {
          ...(prev[selectedBenchId] || {}),
          repairWorkflowRunId: singleRepairRunId,
          repairRequested: false,
          repairPreflightAttemptKey: `${singleRepairRunId}::${selectedBenchId}::${readiness.snapshot}`,
          repairPreflightRequestId: preflightReqId,
          repairPreflightSnapshot: readiness.snapshot
        }
      }));

      const startRes = startReferenceMatchForProduct(selectedBenchId, {
        source: "repair_preflight",
        workflowRunId: singleRepairRunId,
        requestId: preflightReqId,
        candidatesOverride: rawCandidates
      });

      if (startRes.started) {
        const haltMsg = `Repair preflight started read-only reference matching (${preflightReqId}) for ${selectedBenchId}. Repair stopped before writing any fields. Wait for matching to complete, review any staged proposals, and click 'Execute Single Repair' again.`;
        updateProductState(selectedBenchId, STATUS.SCANNING, [haltMsg]);
        setSafetyMessage(haltMsg);
        setSafetyError("");
      } else {
        const errMsg = `Repair halted on ${selectedBenchId}: Required reference matching preflight could not start (${startRes.message}). No writes were executed.`;
        updateProductState(selectedBenchId, STATUS.FAILED, [errMsg]);
        setSafetyError(errMsg);
      }
      return;
    }

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    prepareAndSubmitRepairPlan({
      targetId: selectedBenchId,
      manifest,
      product,
      approvals,
      getFieldMetadata,
      token,
      scanLogMessage: "Executing single structural repair...",
      setPendingOperation,
      updateProductState,
      setSubmittedPayloads,
      batchFetcher
    });
  }, [
    selectedBenchId,
    manifestData,
    approvals,
    batchFetcher,
    updateProductState,
    safeProducts,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    pendingReferenceMatch,
    startReferenceMatchForProduct,
    getFieldMetadata
  ]);

  const handleExecuteSingleAI = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
      setSafetyError("Cannot run AI: Generate Repair Plan for this item first to load live data.");
      return;
    }

    const runId = `ai_single_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setAiData(prev => ({
      ...prev,
      [selectedBenchId]: {
        ...(prev[selectedBenchId] || {}),
        workflowRunId: runId,
        titleParseRequested: false,
        fullRescanRequested: false,
        generateDescRequested: false,
        autoMatchAttemptKey: null,
        autoMatchRequestId: null,
        autoMatchSnapshot: null
      }
    }));

    setSafetyError("");
    setSafetyMessage(`Single-Pass AI Pipeline engaged for ${selectedBenchId}...`);
    setExecutionMode("AI_SINGLE_PIPELINE");
    setIsExecuting(true);
    setAiStep(1);
  }, [selectedBenchId, manifestData]);

  return {
    generateRepairPlan,
    executeRepairs,
    executeAIFill,
    handleExecuteSingleRepair,
    handleExecuteSingleAI
  };
}
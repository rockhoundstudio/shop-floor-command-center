// ==========================================================================
// ROCKHOUND STUDIO — EXECUTION ALIAS, PROVENANCE & AI PLAN RECONCILIATION
// File: app/utils/meta-injector.execution-reconcile.jsx
// Pure, stateless, browser-safe alias normalization, bench provenance packet
// construction, Stage 3 description fact assembly, and post-AI manifest plan
// reconciliation. Zero React hooks, zero FormData, zero network/server imports.
// ==========================================================================

import {
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES
} from "./meta-injector.constants.jsx";
import {
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList,
  isGenericBareStoneToken,
  isSettingOrHardwareMediumToken,
  classifyFoundObjectPolarityClient,
  hasRiverOrFieldCollectionClaimClient,
  buildSafePurchasedSeoTitleClient,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  resolveConfigFieldDestination
} from "./meta-injector.matrix-baseline.jsx";
import {
  RETIRED_KEYS
} from "./meta-injector.matrix-payload.jsx";

const CANONICAL_INCOMING_ALIAS_MAP = Object.freeze({
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
  "custom.material": ["primary_medium", "custom.primary_medium"],
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
  "custom.overall_solid_length_in",
  "custom.shipping_weight_oz",
  "native_shipping_weight",
  "custom.treated",
  "custom.treatment_status"
]);

const CLASSIFICATION_PRECEDENCE_KEYS = new Set([
  "jewelry_type",
  "product_format"
]);

const PASSIVE_CONSTRUCTION_PRECEDENCE_KEYS = new Set([
  "setting_ready",
  "bail_included",
  "jewelry_finding_type",
  "secondary_medium",
  "wire_material",
  "alt_text"
]);

const PASSIVE_PROVENANCE_AND_SEO_KEYS = new Set([
  "origin_location",
  "origin_handle",
  "origin_page_handle",
  "collection_location",
  "seo_title",
  "poetic_hook"
]);

const parseStrictCompletePositiveSolidLengthInClient = (rawVal) => {
  if (typeof rawVal !== "number" && typeof rawVal !== "string") return "";
  let num;
  if (typeof rawVal === "number") {
    num = rawVal;
  } else {
    const trimmed = rawVal.trim();
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return "";
    num = Number(trimmed);
  }
  if (!Number.isFinite(num) || num <= 0) return "";
  const rounded = Number(num.toFixed(4));
  if (rounded <= 0) return "";
  return String(rounded);
};

const isEffectiveRetiredKey = (key) => {
  if (typeof key !== "string" || !key.trim()) return false;
  const trimmed = key.trim();
  if (trimmed === "wire_material" || trimmed === "custom.wire_material") return false;
  if (
    RETIRED_KEYS.includes(trimmed) ||
    REMOVED_PARKED_DESTINATIONS.has(trimmed) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${trimmed}`) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCTVARIANT:${trimmed}`)
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
    lower.startsWith("yes \u2014") ||
    lower.startsWith("yes -") ||
    lower.startsWith("yes ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â") ||
    lower.startsWith("yes ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â")
  ) {
    return expectedType === "boolean" ? "true" : "Yes";
  }
  if (lower === "false" || lower === "no" || lower === "0") {
    return expectedType === "boolean" ? "false" : "No";
  }
  return trimmed;
};

export const hasNonBlankValue = (val) => {
  if (val === undefined || val === null) return false;
  if (Array.isArray(val)) {
    return val.some(item => item !== undefined && item !== null && String(item).trim() !== "");
  }
  const str = typeof val === "object" ? JSON.stringify(val) : String(val);
  const trimmed = str.trim();
  return trimmed !== "" && trimmed !== "[]" && trimmed !== "{}";
};

export const hasExistingStoredGeneralAlt = (currentMetafields = {}) => {
  if (!currentMetafields || typeof currentMetafields !== "object" || Array.isArray(currentMetafields)) {
    return false;
  }
  const raw = Object.prototype.hasOwnProperty.call(currentMetafields, "custom.alt_text")
    ? currentMetafields["custom.alt_text"]
    : currentMetafields["alt_text"];
  return hasNonBlankValue(raw);
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
    const str = typeof val === "object" ? JSON.stringify(val) : String(rawValToStr(val));
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

const rawValToStr = (val) => String(val);

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

export const extractPieceNameOnly = (rawPieceName, fullTitleCandidate) => {
  if (typeof rawPieceName !== "string") return "";
  const trimmed = rawPieceName.trim();
  if (!trimmed) return "";
  const segments = trimmed.split(/\s+[\u2014\u2013-]\s+/);
  if (segments.length >= 3) {
    return segments[segments.length - 1].trim();
  }
  if (typeof fullTitleCandidate === "string" && fullTitleCandidate.trim() === trimmed) {
    const titleSegs = fullTitleCandidate.trim().split(/\s+[\u2014\u2013-]\s+/);
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

/**
 * Resolves provenance & bench facts for a product, strictly separating human/operator-locked
 * values (manual edits or explicit approvals) from passive stored metafield values.
 * Only emits bare keys accepted by ALLOWED_PROVENANCE_FIELD_KEYS in app/routes/app.meta-injector-autofill.jsx.
 */
export const buildProductBenchProvenancePacket = (manifest, productManualEdits = {}, productApprovals = {}) => {
  const safeMan = validObj(manifest);
  const edits = validObj(productManualEdits);
  const apps = validObj(productApprovals);
  const productHasExistingGeneralAlt = hasExistingStoredGeneralAlt(safeMan.currentMetafields);

  const inspectableKeys = [
    "material", "primary_medium", "stone_family",
    "bail_included", "secondary_medium", "jewelry_finding_type",
    "jewelry_type", "setting_ready",
    "chain_material", "chain_link_type", "wire_material",
    "primary_color", "secondary_colors", "color_pattern", "cut_type", "surface_finish",
    "overall_solid_length_in",
    "treatment_status", "treated",
    "found_object", "origin_location", "origin_page_handle",
    "collection_name", "collection_location", "collection_date",
    "is_one_of_a_kind", "seo_title", "alt_text"
  ];

  const operatorLockedKeys = [];
  const passiveStoredKeys = [];
  const valuesByBareKey = {};
  const isStoneIdentityField = (bareKey) =>
    bareKey === "material" || bareKey === "primary_medium" || bareKey === "stone_family";

  inspectableKeys.forEach((k) => {
    if (k === "alt_text" && !productHasExistingGeneralAlt) {
      return;
    }

    const fullKey = `custom.${k}`;
    // Keep custom.alt_text independent from per-photo native_image_alts_*;
    // keep stone_family independent from material/primary_medium.
    const companionAliases =
      k === "alt_text" || k === "stone_family"
        ? []
        : k === "primary_medium"
          ? ["material", "custom.material"]
          : (ALIAS_COMPANION_LOOKUP[fullKey] || []);

    const hasDirectEditFlag = edits[fullKey] === true || edits[k] === true;
    const hasCompanionEditFlag = companionAliases.some((ak) => edits[ak] === true);
    const hasManualEditFlag = hasDirectEditFlag || hasCompanionEditFlag;

    let manualPlanVal =
      safeMan.repairPlan?.[fullKey] !== undefined
        ? safeMan.repairPlan[fullKey]
        : safeMan.repairPlan?.[k];
    if (manualPlanVal === undefined && hasCompanionEditFlag) {
      for (const ak of companionAliases) {
        if (safeMan.repairPlan?.[ak] !== undefined) {
          const candVal = safeMan.repairPlan[ak];
          if (isStoneIdentityField(k) && isSettingOrHardwareMediumToken(candVal)) {
            continue;
          }
          manualPlanVal = candVal;
          break;
        }
      }
    }

    let approvalVal =
      apps[fullKey] !== undefined
        ? apps[fullKey]
        : apps[k];
    if (approvalVal === undefined) {
      for (const ak of companionAliases) {
        if (apps[ak] !== undefined) {
          const candApp = apps[ak];
          if (isStoneIdentityField(k) && isSettingOrHardwareMediumToken(candApp)) {
            continue;
          }
          approvalVal = candApp;
          break;
        }
      }
    }

    let storedVal = safeMan.currentMetafields?.[fullKey];
    if (isStoneIdentityField(k) && isSettingOrHardwareMediumToken(storedVal)) {
      storedVal = undefined;
    }
    if (!hasNonBlankValue(storedVal)) {
      for (const ak of companionAliases) {
        const fullAk = ak.includes(".") ? ak : `custom.${ak}`;
        const cand = safeMan.currentMetafields?.[fullAk] ?? safeMan.currentMetafields?.[ak];
        if (hasNonBlankValue(cand)) {
          // Never promote a setting/metal/plating string from primary_medium or material via companion fallback
          if (isStoneIdentityField(k) && isSettingOrHardwareMediumToken(cand)) {
            continue;
          }
          storedVal = cand;
          break;
        }
      }
    }
    if (k === "seo_title" && !hasNonBlankValue(storedVal)) {
      if (hasNonBlankValue(safeMan.nativeTargets?.seo?.title)) {
        storedVal = safeMan.nativeTargets.seo.title;
      }
    }

    let val = "";
    let chosenSource = null;

    if (hasManualEditFlag && manualPlanVal !== undefined) {
      const candStr = String(manualPlanVal ?? "").trim();
      if (candStr !== "" && !(isStoneIdentityField(k) && isSettingOrHardwareMediumToken(candStr))) {
        val = candStr;
        chosenSource = "operator_locked";
      }
    }
    if (!chosenSource && approvalVal !== undefined) {
      const candStr = String(approvalVal ?? "").trim();
      if (candStr !== "" && !(isStoneIdentityField(k) && isSettingOrHardwareMediumToken(candStr))) {
        val = candStr;
        chosenSource = "operator_locked";
      }
    }
    if (!chosenSource && storedVal !== undefined && storedVal !== null && String(storedVal).trim() !== "") {
      const candStr = String(storedVal).trim();
      if (!(isStoneIdentityField(k) && isSettingOrHardwareMediumToken(candStr))) {
        val = candStr;
        chosenSource = "passive_stored";
      }
    }

    if (val !== undefined && val !== null && String(val).trim() !== "") {
      const strVal = String(val).trim();
      valuesByBareKey[k] = strVal;
      if (chosenSource === "operator_locked") {
        if (!operatorLockedKeys.includes(k)) operatorLockedKeys.push(k);
        if (k === "origin_page_handle" && !operatorLockedKeys.includes("origin_handle")) {
          operatorLockedKeys.push("origin_handle");
          valuesByBareKey.origin_handle = strVal;
        }
        if (k === "material" && !isSettingOrHardwareMediumToken(strVal) && !operatorLockedKeys.includes("primary_medium")) {
          operatorLockedKeys.push("primary_medium");
          if (!hasNonBlankValue(valuesByBareKey.primary_medium)) {
            valuesByBareKey.primary_medium = strVal;
          }
        }
      } else if (chosenSource === "passive_stored") {
        if (!passiveStoredKeys.includes(k)) passiveStoredKeys.push(k);
        if (k === "origin_page_handle" && !passiveStoredKeys.includes("origin_handle")) {
          passiveStoredKeys.push("origin_handle");
          valuesByBareKey.origin_handle = strVal;
        }
        if (
          k === "material" &&
          !isSettingOrHardwareMediumToken(strVal) &&
          !operatorLockedKeys.includes("primary_medium") &&
          !passiveStoredKeys.includes("primary_medium")
        ) {
          passiveStoredKeys.push("primary_medium");
          if (!hasNonBlankValue(valuesByBareKey.primary_medium)) {
            valuesByBareKey.primary_medium = strVal;
          }
        }
      }
    }
  });

  // Also check native_seo_description (mapped to poetic_hook in server ALLOWED_PROVENANCE_FIELD_KEYS)
  const hasSeoDescManualEdit = edits.native_seo_description === true;
  const seoDescManualVal = safeMan.repairPlan?.native_seo_description;
  const seoDescApprovalVal = apps.native_seo_description;
  const seoDescStoredVal = safeMan.nativeTargets?.seo?.description;

  if (hasSeoDescManualEdit && seoDescManualVal !== undefined && String(seoDescManualVal).trim() !== "") {
    valuesByBareKey.poetic_hook = String(seoDescManualVal).trim();
    if (!operatorLockedKeys.includes("poetic_hook")) operatorLockedKeys.push("poetic_hook");
  } else if (seoDescApprovalVal !== undefined && String(seoDescApprovalVal).trim() !== "") {
    valuesByBareKey.poetic_hook = String(seoDescApprovalVal).trim();
    if (!operatorLockedKeys.includes("poetic_hook")) operatorLockedKeys.push("poetic_hook");
  } else if (seoDescStoredVal !== undefined && seoDescStoredVal !== null && String(seoDescStoredVal).trim() !== "") {
    valuesByBareKey.poetic_hook = String(seoDescStoredVal).trim();
    if (!passiveStoredKeys.includes("poetic_hook")) passiveStoredKeys.push("poetic_hook");
  }

  const foundObjectPolarity = classifyFoundObjectPolarityClient(valuesByBareKey.found_object);
  const isPurchasedProvenance = foundObjectPolarity === "purchased";
  const isOriginOperatorLocked = operatorLockedKeys.includes("origin_location") && Boolean(valuesByBareKey.origin_location);

  return {
    operatorLockedKeys,
    passiveStoredKeys,
    valuesByBareKey,
    foundObjectPolarity,
    isPurchasedProvenance,
    isOriginOperatorLocked
  };
};

export const normalizeLoadedPlanAndAliases = (
  rawPlan,
  currentMetafields = {},
  manualProductEdits = {},
  productApprovals = {},
  allConfigFields = []
) => {
  const incomingPlan = validObj(rawPlan);
  const cleanedPlan = {};
  const aliasConflicts = {};
  const productHasExistingGeneralAlt = hasExistingStoredGeneralAlt(currentMetafields);

  const getFieldExpectedType = (destKey) => {
    const cfg = allConfigFields.find(f => resolveConfigFieldDestination(f) === destKey || f.key === destKey);
    if (cfg?.type) return cfg.type;
    if (destKey === "custom.weight_grams" || destKey === "custom.shipping_weight_oz" || destKey === "custom.overall_solid_length_in") return "number_decimal";
    if (destKey === "custom.honest_flaws_and_character" || destKey === "custom.origin_story" || destKey === "custom.generated_description") return "multi_line_text_field";
    return "single_line_text_field";
  };

  const isKeyManuallyLocked = (destKey) => {
    if (destKey === "custom.alt_text") {
      return (
        manualProductEdits?.["custom.alt_text"] === true ||
        manualProductEdits?.["alt_text"] === true ||
        productApprovals?.["custom.alt_text"] !== undefined ||
        productApprovals?.["alt_text"] !== undefined
      );
    }
    const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
    if (manualProductEdits?.[destKey] === true || productApprovals?.[destKey] !== undefined) return true;
    return companions.some(aliasKey => manualProductEdits?.[aliasKey] === true || productApprovals?.[aliasKey] !== undefined);
  };

  const canonicalCandidatesFromPlan = {};

  Object.entries(incomingPlan).forEach(([rawKey, rawVal]) => {
    if (rawKey === "standardized_candidates" || rawKey === "custom.standardized_candidates") return;
    if (rawKey === "stone_family" || rawKey === "custom.stone_family") return;
    if (isEffectiveRetiredKey(rawKey)) return;

    const canonicalKey = normalizeIncomingTargetKey(rawKey);
    if (!canonicalKey || canonicalKey === "custom.stone_family" || isEffectiveRetiredKey(canonicalKey)) return;

    // Never stage custom.alt_text on products that do not already carry custom.alt_text in Shopify
    if (canonicalKey === "custom.alt_text" && !productHasExistingGeneralAlt) {
      return;
    }

    const isDirectCanonical = rawKey === canonicalKey || (canonicalKey === "custom.alt_text" && rawKey === "alt_text");

    // Prevent an unlocked AI/load generic "Stone" proposal from staging into custom.material
    if (
      canonicalKey === "custom.material" &&
      isGenericBareStoneToken(rawVal) &&
      !isKeyManuallyLocked("custom.material")
    ) {
      return;
    }

    // Never allow an alias (primary_medium) containing a setting/metal/plating value to stage into custom.material
    if (
      canonicalKey === "custom.material" &&
      !isDirectCanonical &&
      isSettingOrHardwareMediumToken(rawVal)
    ) {
      return;
    }

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

  // Ensure existing custom.alt_text is seeded from its own stored metafield value on load when not already in incomingPlan
  if (productHasExistingGeneralAlt && !canonicalCandidatesFromPlan["custom.alt_text"]) {
    const storedGenAlt = currentMetafields?.["custom.alt_text"] ?? currentMetafields?.["alt_text"];
    if (hasNonBlankValue(storedGenAlt)) {
      canonicalCandidatesFromPlan["custom.alt_text"] = {
        canonicalRaw: storedGenAlt,
        hasCanonicalKey: true,
        aliasEntries: []
      };
    }
  }

  // Also check stored metafields for canonical vs alias values when loading
  Object.entries(ALIAS_COMPANION_LOOKUP).forEach(([canonicalKey, aliasKeys]) => {
    if (!canonicalKey.startsWith("custom.")) return;
    const storedCanonical = currentMetafields?.[canonicalKey];
    aliasKeys.forEach(aliasKey => {
      const fullAliasKey = aliasKey.includes(".") ? aliasKey : `custom.${aliasKey}`;
      const storedAlias = currentMetafields?.[fullAliasKey] ?? currentMetafields?.[aliasKey];
      if (hasNonBlankValue(storedAlias)) {
        // Do not promote or create a fake save/alias conflict from a setting/metal value stored in custom.primary_medium
        if (canonicalKey === "custom.material" && isSettingOrHardwareMediumToken(storedAlias)) {
          return;
        }
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
          (canonicalKey === "custom.alt_text" && manualProductEdits?.["alt_text"] === true) ||
          (ALIAS_COMPANION_LOOKUP[canonicalKey] || []).some(ak => manualProductEdits?.[ak] === true)) &&
        (incomingPlan[canonicalKey] !== undefined || (canonicalKey === "custom.alt_text" && incomingPlan["alt_text"] !== undefined))
      ) {
        const rawEditVal = incomingPlan[canonicalKey] !== undefined ? incomingPlan[canonicalKey] : incomingPlan["alt_text"];
        cleanedPlan[canonicalKey] = formatComparableValue(rawEditVal, expectedType, canonicalKey);
        return;
      }
      const lockedApprovalVal = resolveLockedProposalFromApprovals(canonicalKey, productApprovals);
      if (lockedApprovalVal !== undefined) {
        cleanedPlan[canonicalKey] = formatComparableValue(lockedApprovalVal, expectedType, canonicalKey);
        return;
      }
    }

    if (canonicalFormatted !== "") {
      // If custom.material itself stored a setting/metal value and a valid stone alias or stone_family exists, do not promote the hardware string over valid stone identity
      if (
        canonicalKey === "custom.material" &&
        isSettingOrHardwareMediumToken(canonicalFormatted) &&
        !isKeyManuallyLocked("custom.material")
      ) {
        const validStoneAlias = nonBlankAliases.find(a => !isSettingOrHardwareMediumToken(a.formatted));
        const fallbackStoredFamily = formatComparableValue(
          currentMetafields?.["custom.stone_family"],
          expectedType,
          "custom.material"
        );
        if (validStoneAlias) {
          cleanedPlan[canonicalKey] = validStoneAlias.formatted;
          return;
        }
        if (fallbackStoredFamily && !isSettingOrHardwareMediumToken(fallbackStoredFamily)) {
          cleanedPlan[canonicalKey] = fallbackStoredFamily;
          return;
        }
      }

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

/**
 * Pure Stage 3 (`generateDescription`) fact merger & sharedFields builder.
 * Preserves exact operator-locked precedence, fresh tab3Data classification/construction
 * precedence over passive stored labels, and purchased-provenance river-origin guards.
 */
export const buildStage3DescriptionFacts = ({
  currentId,
  manifest,
  productTitle = "",
  pieceAi = {},
  provenancePacket,
  approvalsForProduct = {},
  manualEditsForProduct = {}
}) => {
  const safeManifest = validObj(manifest);
  const safePieceAi = validObj(pieceAi);
  const safeProvenance = validObj(provenancePacket);
  const operatorLockedList = Array.isArray(safeProvenance.operatorLockedKeys)
    ? safeProvenance.operatorLockedKeys
    : [];
  const safeApprovals = validObj(approvalsForProduct);
  const safeManualEdits = validObj(manualEditsForProduct);

  const descriptionFacts = {};
  const tab3DataObj = validObj(safePieceAi.tab3Data);
  const productHasExistingGeneralAlt = hasExistingStoredGeneralAlt(safeManifest.currentMetafields);
  const fallbackTitle = safeManifest.nativeTargets?.productTitle || productTitle || "";

  const isFactKeyOperatorLocked = (factKey) => {
    if (operatorLockedList.includes(factKey)) return true;
    const fullKey = `custom.${factKey}`;
    if (
      safeManualEdits[fullKey] === true &&
      safeManifest.repairPlan?.[fullKey] !== undefined &&
      hasNonBlankValue(safeManifest.repairPlan[fullKey])
    ) {
      return true;
    }
    if (
      safeManualEdits[factKey] === true &&
      safeManifest.repairPlan?.[factKey] !== undefined &&
      hasNonBlankValue(safeManifest.repairPlan[factKey])
    ) {
      return true;
    }
    if (safeApprovals[fullKey] !== undefined && hasNonBlankValue(safeApprovals[fullKey])) {
      return true;
    }
    if (safeApprovals[factKey] !== undefined && hasNonBlankValue(safeApprovals[factKey])) {
      return true;
    }
    return false;
  };

  const hasFreshTab3Classification = (factKey) => {
    if (!CLASSIFICATION_PRECEDENCE_KEYS.has(factKey)) return false;
    const rawTab3Val = tab3DataObj[factKey] ?? tab3DataObj[`custom.${factKey}`];
    return hasNonBlankValue(rawTab3Val);
  };

  const hasFreshTab3Construction = (factKey) => {
    if (!PASSIVE_CONSTRUCTION_PRECEDENCE_KEYS.has(factKey)) return false;
    const rawTab3Val = tab3DataObj[factKey] ?? tab3DataObj[`custom.${factKey}`];
    return hasNonBlankValue(rawTab3Val);
  };

  const mergeDescriptionFacts = (source, isAuthoritative = false, isPassiveStoredSource = false) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
      if (key === "operator_locked_fields" || key === "passive_stored_fields") return;
      if (key === "canonical_title" || key === "custom.canonical_title" || key === "product_title") return;
      if (key.includes(".") && !key.startsWith("custom.")) return;

      const isStoneFamilyKey = key === "stone_family" || key === "custom.stone_family";
      const isPrimaryMediumKey = key === "primary_medium" || key === "custom.primary_medium";
      const canonicalTarget = isStoneFamilyKey ? "custom.stone_family" : normalizeIncomingTargetKey(key);
      const factKey = isStoneFamilyKey
        ? "stone_family"
        : canonicalTarget.startsWith("custom.")
          ? canonicalTarget.slice(7)
          : (key.startsWith("custom.") ? key.slice(7) : key);
      if (
        [
          "intent",
          "success",
          "error",
          "errors",
          "logs",
          "debug_origin",
          "standardized_candidates",
          "shopify_title",
          "operator_locked_fields",
          "passive_stored_fields"
        ].includes(factKey)
      ) {
        return;
      }

      if (factKey === "alt_text" && !productHasExistingGeneralAlt) return;

      if (value !== undefined && value !== null && typeof value !== "object" && String(value).trim() !== "") {
        let cleanVal = String(value).trim();

        // Never promote a setting, metal, plating, or bare "Stone" token into stone identity fields
        if (
          (factKey === "material" || factKey === "primary_medium" || factKey === "stone_family") &&
          (isGenericBareStoneToken(cleanVal) || isSettingOrHardwareMediumToken(cleanVal))
        ) {
          return;
        }

        // Do not let passive stored custom.primary_medium overwrite an already-established distinct custom.material variety
        if (isPrimaryMediumKey && isPassiveStoredSource && hasNonBlankValue(descriptionFacts.material)) {
          if (!hasNonBlankValue(descriptionFacts.primary_medium)) {
            descriptionFacts.primary_medium = cleanVal;
          }
          return;
        }

        if (factKey === "piece_name") {
          cleanVal = extractPieceNameOnly(cleanVal, fallbackTitle);
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
        // Keep fresh tab3Data construction facts ahead of passive stored hardware metafields when not operator-locked,
        // while retaining valid same-product stored hardware context when tab3Data did not supply a replacement.
        if (
          isPassiveStoredSource &&
          PASSIVE_CONSTRUCTION_PRECEDENCE_KEYS.has(factKey) &&
          !isFactKeyOperatorLocked(factKey) &&
          hasFreshTab3Construction(factKey) &&
          hasNonBlankValue(descriptionFacts[factKey])
        ) {
          return;
        }
        // When purchased provenance is active, do not let passive stored AI provenance/SEO fields
        // (such as an earlier AI river origin_location or collection_location) override purchased provenance
        if (
          isPassiveStoredSource &&
          safeProvenance.isPurchasedProvenance &&
          PASSIVE_PROVENANCE_AND_SEO_KEYS.has(factKey) &&
          !isFactKeyOperatorLocked(factKey)
        ) {
          return;
        }
        if (isAuthoritative || !hasNonBlankValue(descriptionFacts[factKey])) {
          descriptionFacts[factKey] = cleanVal;
        }
        if (factKey === "material" && !hasNonBlankValue(descriptionFacts.stone_family) && !isSettingOrHardwareMediumToken(cleanVal)) {
          descriptionFacts.stone_family = cleanVal;
        }
        if (factKey === "material" && (isAuthoritative || !hasNonBlankValue(descriptionFacts.primary_medium)) && !isSettingOrHardwareMediumToken(cleanVal)) {
          descriptionFacts.primary_medium = cleanVal;
        }
      }
    });
  };

  // Merge in order so stored merchant facts and explicit edits/approvals take precedence over AI draft outputs,
  // while preserving freshly evidenced tab3Data classification & construction values over passive stored labels
  // and preventing passive stored river origins or setting/metal values from overriding verified facts.
  mergeDescriptionFacts(safePieceAi.titleParse, false, false);
  mergeDescriptionFacts(safePieceAi.tab3Data, false, false);
  mergeDescriptionFacts(safeManifest.currentMetafields, true, true);

  Object.entries(safeApprovals).forEach(([key, value]) => {
    if (
      key.startsWith("custom.") &&
      key !== "custom.standardized_candidates" &&
      key !== "custom.generated_description" &&
      safeManualEdits[key] !== true
    ) {
      const fk = key.slice(7);
      if (fk === "operator_locked_fields" || fk === "passive_stored_fields") return;
      if (fk === "alt_text" && !productHasExistingGeneralAlt) return;
      if (!hasNonBlankValue(value)) return;
      const cleanApproved = String(value ?? "").trim();
      if (
        (fk === "material" || fk === "primary_medium" || fk === "stone_family") &&
        isSettingOrHardwareMediumToken(cleanApproved)
      ) {
        return;
      }
      descriptionFacts[fk] = fk === "piece_name" ? extractPieceNameOnly(cleanApproved, fallbackTitle) : cleanApproved;
      if (fk === "material") {
        if (!hasNonBlankValue(descriptionFacts.stone_family)) {
          descriptionFacts.stone_family = cleanApproved;
        }
        descriptionFacts.primary_medium = cleanApproved;
      }
    }
  });

  Object.entries(safeManualEdits).forEach(([key, edited]) => {
    if (
      edited === true &&
      key.startsWith("custom.") &&
      key !== "custom.standardized_candidates" &&
      key !== "custom.generated_description" &&
      safeManifest.repairPlan?.[key] !== undefined
    ) {
      const fk = key.slice(7);
      if (fk === "operator_locked_fields" || fk === "passive_stored_fields") return;
      if (fk === "alt_text" && !productHasExistingGeneralAlt) return;
      const editVal = safeManifest.repairPlan[key];
      if (!hasNonBlankValue(editVal)) return;
      const cleanEdited = String(editVal ?? "").trim();
      if (
        (fk === "material" || fk === "primary_medium" || fk === "stone_family") &&
        isSettingOrHardwareMediumToken(cleanEdited)
      ) {
        return;
      }
      descriptionFacts[fk] = fk === "piece_name" ? extractPieceNameOnly(cleanEdited, fallbackTitle) : cleanEdited;
      if (fk === "material") {
        if (!hasNonBlankValue(descriptionFacts.stone_family)) {
          descriptionFacts.stone_family = cleanEdited;
        }
        descriptionFacts.primary_medium = cleanEdited;
      }
    }
  });

  // If purchased provenance is established and origin_location was not operator-locked,
  // ensure an unconfirmed titleParse river origin does not leak into generateDescription.
  const effectiveDescFoundPolarity = classifyFoundObjectPolarityClient(descriptionFacts.found_object);
  if (effectiveDescFoundPolarity === "purchased" && !isFactKeyOperatorLocked("origin_location")) {
    const tab3Origin = tab3DataObj.origin_location ?? tab3DataObj["custom.origin_location"] ?? "";
    descriptionFacts.origin_location = hasNonBlankValue(tab3Origin) ? String(tab3Origin).trim() : "";
  }

  const safeSharedStoneFamily =
    (!isSettingOrHardwareMediumToken(descriptionFacts.stone_family) && descriptionFacts.stone_family) ||
    (!isSettingOrHardwareMediumToken(descriptionFacts.material) && descriptionFacts.material) ||
    "";

  descriptionFacts.pieceId = currentId;

  const sharedFields = {
    stone_family: safeSharedStoneFamily,
    origin_location: descriptionFacts.origin_location || "",
    ...(descriptionFacts.found_object !== undefined ? { found_object: descriptionFacts.found_object } : {})
  };

  return {
    descriptionFacts,
    sharedFields
  };
};

/**
 * Pure post-Stage-3 manifest plan reconciliation.
 * Merges `titleParse`, `tab3Data`, and `generated_description` into a copy of `existingManifest`
 * while preserving all operator locks, merchant measurement/price/treatment authority,
 * purchased-provenance guards, secondary_colors validation, and per-image alt boundaries.
 */
export const reconcileCompletedAiPipelineIntoManifest = ({
  targetId,
  existingManifest,
  updatedPieceAi = {},
  manualEditsForProduct = {},
  approvalsForProduct = {},
  allConfigFields = [],
  getStandardizedEvaluationForField
}) => {
  if (!existingManifest || typeof existingManifest !== "object") {
    return existingManifest;
  }

  const safeManualEdits = validObj(manualEditsForProduct);
  const safeApprovals = validObj(approvalsForProduct);
  const newPlan = { ...(existingManifest.repairPlan || {}) };
  const newMetadata = { ...(existingManifest.metadata || {}) };
  const newConflicts = { ...(existingManifest.conflicts || {}) };
  const productHasExistingGeneralAlt = hasExistingStoredGeneralAlt(existingManifest.currentMetafields);

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
  if (!productHasExistingGeneralAlt) {
    delete newPlan["custom.alt_text"];
    delete newPlan["alt_text"];
  }

  const diagnostics = { ...(existingManifest.diagnostics || {}) };

  const titleData = validObj(updatedPieceAi.titleParse);
  const visionData = validObj(updatedPieceAi.tab3Data);
  const descData = updatedPieceAi.generated_description || "";
  const rawVerifiedGeo = validObj(updatedPieceAi.verifiedGeoValues);

  if (visionData.review_proposals && typeof visionData.review_proposals === "object") {
    diagnostics.review_proposals = visionData.review_proposals;
    if (visionData.review_proposals.stone_identity_warning) {
      diagnostics.stone_identity_warning = visionData.review_proposals.stone_identity_warning;
    }
  }

  const mergeProvenancePacket = buildProductBenchProvenancePacket(
    existingManifest,
    safeManualEdits,
    safeApprovals
  );
  const effectiveFoundPolarityForMerge = (() => {
    const lockedOrCurrent = mergeProvenancePacket.foundObjectPolarity;
    if (lockedOrCurrent !== "unknown") return lockedOrCurrent;
    const visPol = classifyFoundObjectPolarityClient(
      visionData.found_object ?? visionData["custom.found_object"]
    );
    if (visPol !== "unknown") return visPol;
    return classifyFoundObjectPolarityClient(
      titleData.found_object ?? titleData["custom.found_object"]
    );
  })();
  const isPurchasedForMerge = effectiveFoundPolarityForMerge === "purchased";

  const geoSourceName = titleData?.geoSource || visionData?.geoSource || null;
  const isVerifiedDbOrLibraryGeo =
    geoSourceName === "library" || geoSourceName === "database" || geoSourceName === "cache";

  if (updatedPieceAi.titleParseRequested) {
    diagnostics.gemini = "Success";
    diagnostics.geoLibrary = geoSourceName === "library" ? "Success" : (geoSourceName || "Not reported");
    diagnostics.stage = "titleParse";
  }
  if (updatedPieceAi.fullRescanRequested) {
    diagnostics.vision = "Success";
    diagnostics.gemini = "Success";
    diagnostics.stage = "tab3FullRescan";
  }
  if (updatedPieceAi.generateDescRequested) {
    diagnostics.gemini = "Success";
    diagnostics.stage = "generateDescription";
  }

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
    if (destKey === "custom.weight_grams" || destKey === "custom.shipping_weight_oz" || destKey === "custom.overall_solid_length_in") return "number_decimal";
    if (destKey === "custom.honest_flaws_and_character" || destKey === "custom.origin_story" || destKey === "custom.generated_description") return "multi_line_text_field";
    return "single_line_text_field";
  };

  const isLockedByOperator = (destKey) => {
    if (destKey === "custom.alt_text") {
      return (
        safeManualEdits["custom.alt_text"] === true ||
        safeManualEdits["alt_text"] === true ||
        safeApprovals["custom.alt_text"] !== undefined ||
        safeApprovals["alt_text"] !== undefined
      );
    }
    if (destKey === "custom.overall_solid_length_in") {
      return (
        safeManualEdits["custom.overall_solid_length_in"] === true ||
        safeManualEdits["overall_solid_length_in"] === true ||
        safeApprovals["custom.overall_solid_length_in"] !== undefined ||
        safeApprovals["overall_solid_length_in"] !== undefined
      );
    }
    if (safeManualEdits[destKey] === true) return true;
    if (safeApprovals[destKey] !== undefined) return true;
    const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
    return companions.some(ak => safeManualEdits[ak] === true || safeApprovals[ak] !== undefined);
  };

  const hasExistingMerchantValue = (destKey) => {
    if (destKey === "shopify_title" || destKey === "native_title") {
      return hasNonBlankValue(existingManifest.nativeTargets?.productTitle);
    }
    if (destKey === "price" || destKey === "native_price") {
      return hasNonBlankValue(existingManifest.nativeTargets?.variants?.edges?.[0]?.node?.price);
    }
    if (destKey === "custom.shipping_weight_oz" || destKey === "native_shipping_weight") {
      const w = existingManifest.nativeTargets?.variants?.edges?.[0]?.node?.inventoryItem?.measurement?.weight;
      return (w?.value !== undefined && w?.value !== null && Number(w.value) > 0) ||
             hasNonBlankValue(existingManifest.currentMetafields?.["custom.shipping_weight_oz"]);
    }
    if (destKey === "custom.alt_text") {
      return productHasExistingGeneralAlt;
    }
    if (destKey === "custom.overall_solid_length_in") {
      return (
        hasNonBlankValue(existingManifest.currentMetafields?.["custom.overall_solid_length_in"]) ||
        hasNonBlankValue(existingManifest.currentMetafields?.["overall_solid_length_in"])
      );
    }
    if (hasNonBlankValue(existingManifest.currentMetafields?.[destKey])) return true;
    const companions = ALIAS_COMPANION_LOOKUP[destKey] || [];
    return companions.some(ak => {
      const fullAk = ak.includes(".") ? ak : `custom.${ak}`;
      return hasNonBlankValue(existingManifest.currentMetafields?.[fullAk]) || hasNonBlankValue(existingManifest.currentMetafields?.[ak]);
    });
  };

  const hasStoredConflictForCanonical = (destKey) => {
    return Boolean(newConflicts?.[destKey]);
  };

  const stagedByCanonicalInThisPass = {};

  const safeApply = (rawKeyName, rawAiValue, sourceMeta = { source: "Gemini", stage: "AI_PIPELINE" }) => {
    if (!hasNonBlankValue(rawAiValue)) return;
    if (rawKeyName === "origin_story" || rawKeyName === "custom.origin_story") return;
    if (rawKeyName === "stone_family" || rawKeyName === "custom.stone_family") return;
    if (rawKeyName === "standardized_candidates" || rawKeyName === "custom.standardized_candidates") return;
    if (rawKeyName === "review_proposals" || rawKeyName === "custom.review_proposals") return;
    if (rawKeyName === "operator_locked_fields" || rawKeyName === "passive_stored_fields" || rawKeyName === "custom.operator_locked_fields" || rawKeyName === "custom.passive_stored_fields") return;
    if (rawKeyName.startsWith("custom.std_") || rawKeyName.startsWith("std_")) return;
    if (rawKeyName === "canonical_title" || rawKeyName === "custom.canonical_title" || rawKeyName === "product_title" || rawKeyName === "custom.product_title" || rawKeyName === "shopify_title" || rawKeyName === "native_title") {
      return;
    }

    const targetKey = normalizeIncomingTargetKey(rawKeyName);
    if (!targetKey || isEffectiveRetiredKey(targetKey) || isEffectiveRetiredKey(rawKeyName)) return;
    if (targetKey === "custom.origin_story" || targetKey === "custom.stone_family" || targetKey === "shopify_title" || targetKey === "native_title") return;
    if (targetKey === "custom.operator_locked_fields" || targetKey === "custom.passive_stored_fields" || targetKey === "custom.review_proposals") return;
    if (targetKey.startsWith("shopify.") && !isVerifiedStandardizedDestination(targetKey)) return;

    // Never create or stage custom.alt_text when the compatibility field does not already exist on this product
    if (targetKey === "custom.alt_text" && !productHasExistingGeneralAlt) {
      return;
    }

    // Never allow generated drafts to overwrite operator manual edits or explicit approvals
    if (isLockedByOperator(targetKey)) return;

    // Prevent bare generic "Stone" or setting/metal/plating terms from staging into custom.material
    if (
      targetKey === "custom.material" &&
      (isGenericBareStoneToken(rawAiValue) || isSettingOrHardwareMediumToken(rawAiValue))
    ) {
      return;
    }

    // Never silently overwrite an unresolved canonical/alias conflict
    if (hasStoredConflictForCanonical(targetKey)) return;

    // Preserve existing nonblank custom.treated and custom.treatment_status verbatim
    if (
      (targetKey === "custom.treated" || targetKey === "custom.treatment_status") &&
      hasExistingMerchantValue(targetKey)
    ) {
      newPlan[targetKey] = String(existingManifest.currentMetafields[targetKey]);
      return;
    }

    // Never allow generated drafts to overwrite existing merchant measurements, price, or shipping weights
    if (OPERATOR_AUTHORITATIVE_DESTINATIONS.has(targetKey) && hasExistingMerchantValue(targetKey)) {
      return;
    }

    // Preserve actual stored found_object type & polarity when already present in Shopify
    if (targetKey === "custom.found_object" && hasExistingMerchantValue("custom.found_object")) {
      newPlan["custom.found_object"] = String(existingManifest.currentMetafields["custom.found_object"]);
      return;
    }

    const matchedConfig = allConfigFields.find(f => resolveConfigFieldDestination(f) === targetKey || f.key === targetKey);
    if (isVerifiedStandardizedDestination(targetKey)) {
      const stdEval =
        typeof getStandardizedEvaluationForField === "function"
          ? getStandardizedEvaluationForField(targetId, targetKey, existingManifest)
          : null;
      const valCheck = validateProposedStandardizedGidList(rawAiValue, stdEval);
      if (!valCheck.valid) return;
      newPlan[targetKey] = JSON.stringify(valCheck.gids);
      newMetadata[targetKey] = {
        source: sourceMeta.source || "Vision",
        stage: sourceMeta.stage || "resolveStandardizedCandidates"
      };
      return;
    }

    // Dedicated photo-measurement staging branch for custom.overall_solid_length_in:
    // Only stages into an eligible blank destination when a complete finite positive numeric value in inches
    // is supplied by the photo measurement pass (while preserving writer/storage holds in constants/matrix-domain).
    if (targetKey === "custom.overall_solid_length_in") {
      const strictPhotoInches = parseStrictCompletePositiveSolidLengthInClient(rawAiValue);
      if (!strictPhotoInches) return;
      if (stagedByCanonicalInThisPass[targetKey] !== undefined) {
        const priorStaged = stagedByCanonicalInThisPass[targetKey];
        if (priorStaged.value !== strictPhotoInches) {
          newConflicts[targetKey] = {
            expected: priorStaged.value,
            actual: `${rawKeyName}: ${strictPhotoInches}`
          };
        }
        return;
      }
      stagedByCanonicalInThisPass[targetKey] = {
        value: strictPhotoInches,
        rawKey: rawKeyName,
        isDirectCanonical: rawKeyName === targetKey || rawKeyName === "overall_solid_length_in"
      };
      newPlan[targetKey] = strictPhotoInches;
      newMetadata[targetKey] = {
        source: "Measured from photo",
        stage: sourceMeta.stage || "tab3FullRescan"
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
        titleData.canonical_title || existingManifest.nativeTargets?.productTitle || ""
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
        existingManifest.currentMetafields?.["custom.geological_era"];
      const existingAge = existingManifest.currentMetafields?.["custom.geological_age"];
      if (
        eraCandidate !== undefined &&
        String(normalizedValue).trim() === String(eraCandidate).trim() &&
        (!hasNonBlankValue(existingAge) || String(existingAge).trim() !== String(normalizedValue).trim())
      ) {
        return;
      }
    }

    if (targetKey === "custom.secondary_colors") {
      if (
        hasNonBlankValue(existingManifest.currentMetafields?.["custom.secondary_colors"]) ||
        hasNonBlankValue(existingManifest.currentMetafields?.["secondary_colors"])
      ) {
        const storedSecColors =
          existingManifest.currentMetafields?.["custom.secondary_colors"] ??
          existingManifest.currentMetafields?.["secondary_colors"];
        newPlan["custom.secondary_colors"] = String(storedSecColors).trim();
        return;
      }

      const isInvalidSecondaryColorToken = (token) => {
        if (!token) return true;
        if (token === "[object Object]") return true;
        if (/[\r\n]/.test(token)) return true;
        if (/^gid:\/\//i.test(token) || /gid:\/\/shopify\//i.test(token)) return true;
        if (/^shopify:\/\/metaobject/i.test(token)) return true;
        if (/^metaobject[:/]/i.test(token)) return true;
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return true;
        if ((token.startsWith("[") && token.endsWith("]")) || (token.startsWith("{") && token.endsWith("}"))) return true;
        return false;
      };

      const formatSecondaryColorsArray = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const cleaned = [];
        for (let i = 0; i < arr.length; i += 1) {
          const item = arr[i];
          if (typeof item !== "string") return null;
          const trimmedItem = item.trim();
          if (isInvalidSecondaryColorToken(trimmedItem)) return null;
          cleaned.push(trimmedItem);
        }
        const joined = cleaned.join(", ");
        if (!joined || isInvalidSecondaryColorToken(joined)) return null;
        return joined;
      };

      if (Array.isArray(normalizedValue)) {
        const convertedArr = formatSecondaryColorsArray(normalizedValue);
        if (!convertedArr) return;
        normalizedValue = convertedArr;
      } else if (typeof normalizedValue === "string") {
        const trimmedStr = normalizedValue.trim();
        if (!trimmedStr) return;
        if (trimmedStr.startsWith("[") || trimmedStr.endsWith("]") || trimmedStr.startsWith("{") || trimmedStr.endsWith("}")) {
          if (!(trimmedStr.startsWith("[") && trimmedStr.endsWith("]"))) {
            return;
          }
          try {
            const parsed = JSON.parse(trimmedStr);
            const convertedParsed = formatSecondaryColorsArray(parsed);
            if (!convertedParsed) return;
            normalizedValue = convertedParsed;
          } catch (e) {
            return;
          }
        } else {
          if (isInvalidSecondaryColorToken(trimmedStr)) return;
          normalizedValue = trimmedStr;
        }
      } else {
        return;
      }
    }

    const expectedType = getExpectedFieldType(targetKey);
    const formattedVal = formatComparableValue(normalizedValue, expectedType, targetKey);
    if (!formattedVal) return;

    if (
      targetKey === "custom.material" &&
      (isGenericBareStoneToken(formattedVal) || isSettingOrHardwareMediumToken(formattedVal))
    ) {
      return;
    }

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
    if (bare === "overall_solid_length_in") {
      return { source: "Measured from photo", stage: defaultStage };
    }
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
      k !== "review_proposals" &&
      k !== "custom.review_proposals" &&
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
      k !== "review_proposals" &&
      k !== "custom.review_proposals" &&
      k !== "operator_locked_fields" &&
      k !== "passive_stored_fields"
    ) {
      if (k.startsWith("std_") || k.startsWith("custom.std_") || k.startsWith("shopify.")) return;
      const targetKey = normalizeIncomingTargetKey(k);
      // When purchased provenance is active and origin_location / collection_location were not operator-locked,
      // do not let titleParse backfill river/title-derived origin or collection_location into repairPlan.
      if (
        isPurchasedForMerge &&
        (targetKey === "custom.origin_location" ||
          targetKey === "custom.origin_page_handle" ||
          targetKey === "custom.collection_location") &&
        !isLockedByOperator(targetKey)
      ) {
        return;
      }
      if (stagedByCanonicalInThisPass[targetKey] === undefined) {
        safeApply(k, titleData[k], resolveFieldSourceMeta(k, "Gemini", "titleParse"));
      }
    }
  });

  const rawVisionSeo = (visionData.seo_title || visionData["custom.seo_title"] || "").trim();
  const rawTitleSeo = (titleData.seo_title || "").trim();
  let enrichedSeo = rawVisionSeo || rawTitleSeo;
  let enrichedSeoFromVision = Boolean(rawVisionSeo);

  if (isPurchasedForMerge && enrichedSeo && hasRiverOrFieldCollectionClaimClient(enrichedSeo)) {
    const candidateStoneFam = [
      newPlan["custom.material"],
      existingManifest.currentMetafields?.["custom.material"],
      visionData.stone_family,
      titleData.stone_family,
      existingManifest.currentMetafields?.["custom.stone_family"]
    ]
      .map(c => (c !== undefined && c !== null ? String(c).trim() : ""))
      .find(c => c !== "" && !isSettingOrHardwareMediumToken(c)) || "";
    const fallbackFormat = visionData.product_format || "";
    enrichedSeo = buildSafePurchasedSeoTitleClient(candidateStoneFam, fallbackFormat);
  }

  if (enrichedSeo !== "") {
    safeApply("custom.seo_title", enrichedSeo, {
      source: enrichedSeoFromVision ? "Vision" : "Gemini",
      stage: enrichedSeoFromVision ? "tab3FullRescan" : "titleParse"
    });
  }
  if (descData) {
    safeApply("custom.generated_description", descData, {
      source: "Gemini",
      stage: "generateDescription"
    });
  }

  if (
    visionData.poetic_hook &&
    !(isPurchasedForMerge && hasRiverOrFieldCollectionClaimClient(String(visionData.poetic_hook)))
  ) {
    safeApply("native_seo_description", visionData.poetic_hook, {
      source: "Vision",
      stage: "tab3FullRescan"
    });
  }

  // If visionData.review_proposals contains a distinct general alt_text proposal for an existing custom.alt_text field
  // and custom.alt_text was not operator-locked, stage it for explicit operator review without copying a per-photo alt.
  if (
    productHasExistingGeneralAlt &&
    !isLockedByOperator("custom.alt_text") &&
    hasNonBlankValue(visionData.review_proposals?.alt_text)
  ) {
    safeApply("custom.alt_text", visionData.review_proposals.alt_text, {
      source: "Vision",
      stage: "tab3FullRescan"
    });
  }

  // Handle per-image native_image_alts_* strictly from updatedPieceAi.imageAlts;
  // never copy hero alt into custom.alt_text automatically.
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
  if (updatedPieceAi.altValidationErrors) {
    diagnostics.altValidationErrors = updatedPieceAi.altValidationErrors;
  }

  return {
    ...existingManifest,
    repairPlan: newPlan,
    metadata: newMetadata,
    conflicts: newConflicts,
    diagnostics,
    verifiedGeoValues: isVerifiedDbOrLibraryGeo ? sanitizedVerifiedGeo : {}
  };
};
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 PURE FIELD & DRAWER CONTRACT
// File: app/utils/bench-v2.contract.jsx
// Pure browser-safe contract module: zero React hooks/effects, zero storage,
// zero GraphQL/network calls, zero server-only imports.
// ==========================================================================

import {
  isExactMetaobjectGid,
  areReferenceGidSetsSemanticallyEquivalent
} from "./meta-injector.standardized.jsx";
import {
  REMOVED_PARKED_CANONICAL_IDENTITY_LIST,
  REMOVED_PARKED_DESTINATION_LIST,
  REMOVED_PARKED_CUSTOM_INPUT_ALIAS_LIST,
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES,
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_REFERENCE_PRODUCTS,
  BENCH_V2_BATCH_STAGE,
  BENCH_V2_WRITE_CAPABILITY,
  CANCELLED_INERT_DESTINATIONS,
  TASK_RESTRICTED_READ_ONLY_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS,
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_UNHELD_BARE_KEYS,
  BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS,
  REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  BENCH_V2_NON_RENDERED_HISTORICAL_RECORDS,
  BENCH_V2_PARKED_AND_PROTECTED_DRAWER_IDS,
  isParkedOrProtectedDrawerId,
  BENCH_V2_DRAWERS,
  BENCH_V2_OPTIONS_BY_KEY,
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_CONTRACTS_BY_DESTINATION,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
  MANUAL_MEASUREMENT_DESTINATIONS,
  MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS,
  isManualMeasurementDestination,
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
  REMOVED_PARKED_CANONICAL_IDENTITY_LIST,
  REMOVED_PARKED_DESTINATION_LIST,
  REMOVED_PARKED_CUSTOM_INPUT_ALIAS_LIST,
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES,
  BENCH_V2_CONTRACT_VERSION,
  BENCH_V2_REFERENCE_PRODUCTS,
  BENCH_V2_BATCH_STAGE,
  BENCH_V2_WRITE_CAPABILITY,
  CANCELLED_INERT_DESTINATIONS,
  TASK_RESTRICTED_READ_ONLY_DESTINATIONS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS,
  BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS,
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_UNHELD_BARE_KEYS,
  BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS,
  REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  BENCH_V2_NON_RENDERED_HISTORICAL_RECORDS,
  BENCH_V2_PARKED_AND_PROTECTED_DRAWER_IDS,
  isParkedOrProtectedDrawerId,
  BENCH_V2_DRAWERS,
  BENCH_V2_OPTIONS_BY_KEY,
  BENCH_V2_FIELD_CONTRACTS,
  BENCH_V2_CONTRACTS_BY_DESTINATION,
  BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS,
  BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
  MANUAL_MEASUREMENT_DESTINATIONS,
  MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS,
  isManualMeasurementDestination,
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
const CANONICAL_USD_TWO_DECIMAL_MONEY_REGEX = /^(?:0|[1-9]\d*)\.\d{2}$/;
const STORED_SHOPIFY_MONEY_DECIMAL_REGEX = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const PLAIN_TEXT_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isBlankOrWhitespaceOnly = (str) =>
  typeof str !== "string" || str.trim() === "";

function parseExactMoneyStringToCentsBigInt(moneyStr) {
  if (typeof moneyStr !== "string" || !STORED_SHOPIFY_MONEY_DECIMAL_REGEX.test(moneyStr)) {
    return null;
  }
  const parts = moneyStr.split(".");
  const dollars = parts[0];
  const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
  try {
    return BigInt(dollars + cents);
  } catch {
    return null;
  }
}

// Exact pure string replica of writer `sanitizeDescription` in app/routes/app.meta-injector-api.jsx
// so proposals that the writer would alter or block are rejected before approval.
function sanitizeWriterDescriptionHtml(html) {
  if (!html || typeof html !== "string") return html;
  let safeHtml = html;
  const targets = [
    "/pages/the-shopped-rock",
    "/collections/the-shopped-rock",
    "/pages/the-shocked-rock",
    "/collections/the-shocked-rock"
  ];
  for (const target of targets) {
    const regexNormal = new RegExp(
      `<a[^>]*href=["']?[^"'>]*${target.replace(/\//g, "\\/")}["']?[^>]*>.*?<\\/a>`,
      "gi"
    );
    safeHtml = safeHtml.replace(regexNormal, "");
    const regexEscaped = new RegExp(
      `&lt;a[^&]*href=[&quot;']?[^&quot;'>]*${target.replace(/\//g, "\\/")}[&quot;']?[^&]*&gt;.*?&lt;\\/a&gt;`,
      "gi"
    );
    safeHtml = safeHtml.replace(regexEscaped, "");
  }
  return safeHtml;
}

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

/**
 * Pure shape rejection check for `single_line_text_field` proposals.
 * Rejects non-strings, empty/whitespace strings, `[object Object]`, GIDs,
 * `shopify://metaobject`, `metaobject:`/`metaobject/`, UUIDs, and strings
 * enclosed in `[...]` or `{...}`.
 */
export function isPlainTextProposalRejectedForContract(rawVal, normalizedStr) {
  if (typeof rawVal !== "string") return true;
  const trimmed = String(normalizedStr ?? "").trim();
  if (!trimmed) return true;
  if (rawVal === "[object Object]" || trimmed === "[object Object]") return true;
  if (/^gid:\/\//i.test(trimmed) || /gid:\/\/shopify\//i.test(rawVal) || /gid:\/\/shopify\//i.test(trimmed)) return true;
  if (/^shopify:\/\/metaobject/i.test(trimmed)) return true;
  if (/^metaobject[:/]/i.test(trimmed)) return true;
  if (PLAIN_TEXT_UUID_REGEX.test(trimmed)) return true;
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    return true;
  }
  return false;
}

/**
 * Evaluates explicit live definition validations on a plain-text proposal
 * (such as choices, max, min, regex) when present on the live definition.
 */
export function validateAgainstLiveTextDefinitionValidations(liveDef, exactValue, destinationKey) {
  if (!liveDef || !Array.isArray(liveDef.validations) || liveDef.validations.length === 0) {
    return { valid: true, reason: null };
  }
  for (const v of liveDef.validations) {
    if (!v || typeof v.name !== "string") continue;
    const vName = v.name.trim().toLowerCase();
    const vRaw = v.value !== undefined && v.value !== null ? String(v.value) : "";

    if (vName === "choices" && vRaw.trim() !== "") {
      try {
        const parsedChoices = JSON.parse(vRaw);
        if (Array.isArray(parsedChoices) && parsedChoices.length > 0) {
          const strChoices = parsedChoices.map((c) => String(c));
          if (!strChoices.includes(exactValue)) {
            return {
              valid: false,
              reason: `Value "${exactValue}" is not in allowed definition choices [${strChoices.join(", ")}] for ${destinationKey}.`
            };
          }
        }
      } catch {
        // Ignore non-JSON choice representation
      }
    } else if (vName === "max" && vRaw.trim() !== "") {
      const maxLen = Number.parseInt(vRaw.trim(), 10);
      if (Number.isInteger(maxLen) && maxLen > 0 && exactValue.length > maxLen) {
        return {
          valid: false,
          reason: `Value for ${destinationKey} (${exactValue.length} chars) exceeds live definition max length (${maxLen}).`
        };
      }
    } else if (vName === "min" && vRaw.trim() !== "") {
      const minLen = Number.parseInt(vRaw.trim(), 10);
      if (Number.isInteger(minLen) && minLen > 0 && exactValue.length < minLen) {
        return {
          valid: false,
          reason: `Value for ${destinationKey} (${exactValue.length} chars) is shorter than live definition min length (${minLen}).`
        };
      }
    } else if (vName === "regex" && vRaw !== "") {
      try {
        const re = new RegExp(vRaw);
        if (!re.test(exactValue)) {
          return {
            valid: false,
            reason: `Value for ${destinationKey} does not match live definition regex validation.`
          };
        }
      } catch {
        // Ignore invalid regex syntax
      }
    }
  }
  return { valid: true, reason: null };
}

/**
 * Pure server-evidence evaluator for Bench V2 opt-in (`isBenchV2OptIn === true`)
 * PRODUCT `custom.*` metafield writes in `executeRepairPlan`.
 *
 * Scope & Non-Fallthrough Semantics:
 * - Parses `fullKey` using the existing API namespace/key splitting rule:
 *   if `fullKey` contains `.`, `ns = parts[0]` and `key = parts.slice(1).join(".")`;
 *   otherwise `ns = "custom"` and `key = fullKey`.
 *   `canonicalDestinationKey = "${ns}.${key}"`.
 * - Returns `{ handled: false }` ONLY when `ns === "shopify"` (so the API's
 *   existing standardized-reference path handles `shopify.*`).
 *   Note: caller must already have routed native fields (`shopify_title`,
 *   `native_*`, `price`) and `BENCH_V2_CONNECTED_VARIANT_DESTINATIONS` before
 *   invoking this helper.
 * - For ANY other entry in `isBenchV2OptIn` mode (`ns === "custom"`, or a non-custom
 *   namespace where `custom.${key}` is a custom contract or unknown), returns
 *   `{ handled: true, outcome, ... }` so a rejected Bench V2 custom destination
 *   NEVER falls through to legacy `ALLOWED_TAB3_KEYS` or `RETIRED_KEYS`.
 *
 * Exact Return Shape when `handled === true`:
 * - `outcome`:
 *     * `"unsupported"` -> caller pushes `fullKey` to `unsupportedKeys`
 *     * `"unchanged"`   -> caller pushes `fullKey` to `unchanged`
 *     * `"skipped"`     -> caller pushes `fullKey` to `skippedKeys`
 *     * `"blocked"`     -> caller sets `blockedFields[fullKey] = reason`
 *     * `"stage_write"` -> caller stages `{ ownerId: productGid, ownerType: "PRODUCT", namespace: "custom", key, type: resolvedType, value: resolvedValue }`
 * - `ns`: parsed namespace string
 * - `key`: parsed key string
 * - `canonicalDestinationKey`: `"${ns}.${key}"`
 * - `contract`: matched Bench V2 contract object or `null`
 * - `resolvedType`: verified Shopify metafield type string (when `outcome === "stage_write"`) or `null`
 * - `resolvedValue`: exact verified string value to write (when `outcome === "stage_write"`) or `null`
 * - `currentVal`: current stored value (`string | null`)
 * - `reason`: human-readable block/diagnostic reason string or `null`
 */
export function evaluateBenchV2OptInCustomProductWrite({
  fullKey,
  rawVal,
  productLookupComplete,
  hasMetafieldsBaseline,
  defsReadComplete,
  currentMetafields,
  currentMetafieldsTypes,
  defs,
  defConstraintErrorsByDestination,
  evaluateCategoryEligibility
}) {
  const safeFullKey = typeof fullKey === "string" ? fullKey : String(fullKey ?? "");
  let ns = "custom";
  let key = safeFullKey;
  if (safeFullKey.includes(".")) {
    const parts = safeFullKey.split(".");
    ns = parts[0];
    key = parts.slice(1).join(".");
  }
  const canonicalDestinationKey = `${ns}.${key}`;

  // Leave `shopify.*` to the existing standardized-reference branch in executeRepairPlan
  // unless `key === "construction"` was submitted under a non-shopify namespace.
  if (ns === "shopify") {
    return {
      handled: false,
      outcome: null,
      ns,
      key,
      canonicalDestinationKey,
      contract: null,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: null
    };
  }

  // Reject any non-custom namespace submission (e.g. wrong namespace for a custom key or construction)
  // without falling through to legacy allowlists.
  if (ns !== "custom") {
    return {
      handled: true,
      outcome: "unsupported",
      ns,
      key,
      canonicalDestinationKey,
      contract: null,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: `Unsupported namespace "${ns}" for "${safeFullKey}"; Bench V2 custom product metafields require the "custom" namespace.`
    };
  }

  // Explicitly reject cancelled inert destinations.
  if (
    CANCELLED_INERT_DESTINATIONS.has(key) ||
    CANCELLED_INERT_DESTINATIONS.has(safeFullKey) ||
    CANCELLED_INERT_DESTINATIONS.has(canonicalDestinationKey)
  ) {
    return {
      handled: true,
      outcome: "unsupported",
      ns,
      key,
      canonicalDestinationKey,
      contract: null,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: `Destination "${canonicalDestinationKey}" is cancelled and permanently inert.`
    };
  }

  // Explicitly reject removed parked custom product destinations and custom input aliases
  // after resolving owner ("PRODUCT") and namespace ("custom").
  const resolvedProductIdentity = `PRODUCT:${canonicalDestinationKey}`;
  if (
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(resolvedProductIdentity) ||
    REMOVED_PARKED_DESTINATIONS.has(canonicalDestinationKey) ||
    REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(key) ||
    REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(canonicalDestinationKey)
  ) {
    return {
      handled: true,
      outcome: "unsupported",
      ns,
      key,
      canonicalDestinationKey,
      contract: null,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: `Destination "${canonicalDestinationKey}" is retired and removed from the Bench V2 contract.`
    };
  }

  const contract = getFieldContractByDestination(canonicalDestinationKey);

  // Authoritative contract & writable-set membership check:
  // Must exist in BENCH_V2_CONTRACTS_BY_DESTINATION, belong to owner "PRODUCT"
  // and namespace "custom", have isWritableInBatch1 === true, and be in
  // BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.
  // Any unknown, parked, protected, compatibility, task-restricted, or held
  // custom.* destination is rejected here and never falls through to ALLOWED_TAB3_KEYS.
  if (
    !contract ||
    contract.owner !== "PRODUCT" ||
    contract.namespace !== "custom" ||
    contract.destinationKey !== canonicalDestinationKey ||
    contract.isWritableInBatch1 !== true ||
    !BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS.has(canonicalDestinationKey)
  ) {
    return {
      handled: true,
      outcome: "unsupported",
      ns,
      key,
      canonicalDestinationKey,
      contract: contract || null,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: `Destination "${canonicalDestinationKey}" is not an eligible Batch 1 writable PRODUCT custom metafield in the Bench V2 contract.`
    };
  }

  // Prerequisite server baseline & definition read completeness checks.
  if (!hasMetafieldsBaseline) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: "Product metafields baseline could not be loaded from Shopify; reload product data before saving."
    };
  }

  if (!defsReadComplete) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal: null,
      reason: `Live PRODUCT metafield definition read did not complete for ${canonicalDestinationKey}; reload product data before saving.`
    };
  }

  const currentVal =
    currentMetafields && currentMetafields[safeFullKey] !== undefined
      ? currentMetafields[safeFullKey]
      : (currentMetafields?.[canonicalDestinationKey] ?? null);

  const valStr = String(rawVal !== null && rawVal !== undefined ? rawVal : "").trim();

  // Preserve exact empty / collection_date placeholder skip/unchanged semantics.
  if (
    valStr === "" ||
    (key === "collection_date" && COLLECTION_DATE_PLACEHOLDER_REGEX.test(valStr))
  ) {
    return {
      handled: true,
      outcome: !currentVal ? "unchanged" : "skipped",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: null
    };
  }

  const def = defs?.[safeFullKey] || defs?.[canonicalDestinationKey] || null;
  const storedType =
    currentMetafieldsTypes?.[safeFullKey] ||
    currentMetafieldsTypes?.[canonicalDestinationKey] ||
    null;
  const destinationDefErr =
    defConstraintErrorsByDestination?.[safeFullKey] ||
    defConstraintErrorsByDestination?.[canonicalDestinationKey] ||
    def?.constraints?.error ||
    def?.error ||
    null;

  if (destinationDefErr) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: `Definition or constraint error on ${canonicalDestinationKey}: ${destinationDefErr}`
    };
  }

  const allowedTypes =
    Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
      ? contract.allowedTypes
      : [contract.expectedType];

  const rawReviewedContractType = Object.prototype.hasOwnProperty.call(
    REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
    canonicalDestinationKey
  )
    ? REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS[canonicalDestinationKey]
    : null;

  const reviewedContractType =
    contract.reviewedExactContractType &&
    rawReviewedContractType &&
    contract.reviewedExactContractType === rawReviewedContractType
      ? contract.reviewedExactContractType
      : rawReviewedContractType;

  const benchV2ReviewedContractType =
    productLookupComplete === true &&
    hasMetafieldsBaseline === true &&
    defsReadComplete === true &&
    !destinationDefErr &&
    canonicalDestinationKey !== "custom.is_ooak" &&
    reviewedContractType &&
    contract.reviewedExactContractType === reviewedContractType &&
    allowedTypes.includes(reviewedContractType)
      ? reviewedContractType
      : null;

  // Fail closed on live definition vs. stored metafield type conflict.
  if (def?.type && storedType && def.type !== storedType) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: `Type conflict: Definition is ${def.type} but stored is ${storedType}`
    };
  }

  // Fail closed if live definition or stored type conflicts with reviewed exact contract type.
  if (reviewedContractType) {
    if (def?.type && def.type !== reviewedContractType) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Type conflict on ${canonicalDestinationKey}: Live definition is ${def.type}, which conflicts with reviewed destination contract ${reviewedContractType}.`
      };
    }
    if (storedType && storedType !== reviewedContractType) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Type conflict on ${canonicalDestinationKey}: Stored metafield type is ${storedType}, which conflicts with reviewed destination contract ${reviewedContractType}.`
      };
    }
  }

  const observedShopifyType = def?.type || storedType || null;
  const intendedContractWriteType = !observedShopifyType ? benchV2ReviewedContractType : null;
  const resolvedType = observedShopifyType || intendedContractWriteType || null;

  if (!resolvedType) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: "No exact live definition or stored type available; fallback mappings are strictly forbidden."
    };
  }

  // Verify resolvedType against the contract's allowedTypes (preserves custom.is_ooak
  // single_line_text_field | boolean and all single-type contracts).
  if (!allowedTypes.includes(resolvedType)) {
    const expectedDesc =
      allowedTypes.length === 1
        ? allowedTypes[0]
        : allowedTypes.join(" or ");
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: `Type conflict on ${canonicalDestinationKey}: observed type is ${resolvedType}, expected ${expectedDesc}.`
    };
  }

  // If the live definition carries category/subtype constraints, verify eligibility.
  if (
    def?.constraints &&
    (def.constraints.hasConstraints || !def.constraints.isComplete) &&
    typeof evaluateCategoryEligibility === "function"
  ) {
    const catElig = evaluateCategoryEligibility(def);
    if (!catElig || !catElig.isComplete || !catElig.isEligible) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: catElig?.reason || `Category constraint check failed on ${canonicalDestinationKey}.`
      };
    }
  }

  // Exact string & fidelity requirement: never coerce non-strings or silently strip/trim
  // leading/trailing whitespace or warning prefixes in Bench V2 opt-in mode.
  if (typeof rawVal !== "string") {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: `Rejected non-string proposal for ${canonicalDestinationKey} (no implicit coercion).`
    };
  }

  const normalizedValue = valStr.replace(/^⚠️\s*/, "");
  if (normalizedValue !== rawVal) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason:
        key === "seo_title" && normalizedValue !== valStr
          ? "Rejected custom.seo_title proposal containing warning prefixes that alter approved content."
          : `Proposal for ${canonicalDestinationKey} contains leading/trailing whitespace or warning prefixes that would alter the exact approved value.`
    };
  }

  let resolvedValue = normalizedValue;

  // Destination-specific restrictions preserved verbatim.
  if (key === "generated_description") {
    const sanitizedDesc = sanitizeWriterDescriptionHtml(resolvedValue);
    if (sanitizedDesc !== resolvedValue) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: "Rejected custom.generated_description proposal containing disallowed links that alter approved content."
      };
    }
    resolvedValue = sanitizedDesc;
  }

  if (key === "seo_title" && resolvedValue.length > 70) {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: "Value exceeds 70 characters limit for custom.seo_title."
    };
  }

  // Type-specific value validation.
  if (resolvedType === "number_decimal") {
    if (!CANONICAL_DECIMAL_NUMBER_REGEX.test(resolvedValue)) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Destination "${canonicalDestinationKey}" requires a non-negative decimal number without units, spaces, or leading zeros (e.g. "14.5" or "28"; received "${resolvedValue}").`
      };
    }
    const parsedExactDecimal = Number(resolvedValue);
    const writerSerializedDecimal = String(parseFloat(resolvedValue));
    if (!Number.isFinite(parsedExactDecimal) || parsedExactDecimal < 0) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Destination "${canonicalDestinationKey}" requires a finite non-negative decimal number (received "${resolvedValue}").`
      };
    }
    if (writerSerializedDecimal !== resolvedValue) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Existing writer serializes "${resolvedValue}" as "${writerSerializedDecimal}" on save. Enter "${writerSerializedDecimal}" so your exact approved value is stored without alteration.`
      };
    }
  } else if (resolvedType === "boolean") {
    if (resolvedValue !== "true" && resolvedValue !== "false") {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Invalid boolean value: ${resolvedValue}`
      };
    }
  } else if (resolvedType === "single_line_text_field") {
    if (isPlainTextProposalRejectedForContract(rawVal, resolvedValue)) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Rejected non-text or reference-shaped proposal for plain-text destination ${canonicalDestinationKey}.`
      };
    }
    const maxLen = typeof contract.maxLength === "number" ? contract.maxLength : 255;
    if (resolvedValue.length > maxLen) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Value exceeds ${maxLen} characters limit`
      };
    }
    if (def) {
      const liveTextValidation = validateAgainstLiveTextDefinitionValidations(
        def,
        resolvedValue,
        canonicalDestinationKey
      );
      if (!liveTextValidation.valid) {
        return {
          handled: true,
          outcome: "blocked",
          ns,
          key,
          canonicalDestinationKey,
          contract,
          resolvedType: null,
          resolvedValue: null,
          currentVal,
          reason: liveTextValidation.reason
        };
      }
    }
  } else if (resolvedType === "multi_line_text_field") {
    const maxLen = typeof contract.maxLength === "number" ? contract.maxLength : 10000;
    if (resolvedValue.length > maxLen) {
      return {
        handled: true,
        outcome: "blocked",
        ns,
        key,
        canonicalDestinationKey,
        contract,
        resolvedType: null,
        resolvedValue: null,
        currentVal,
        reason: `Value exceeds ${maxLen === 10000 ? "10,000" : maxLen} characters limit`
      };
    }
  } else {
    return {
      handled: true,
      outcome: "blocked",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType: null,
      resolvedValue: null,
      currentVal,
      reason: `Unsupported resolved type "${resolvedType}" on ${canonicalDestinationKey}.`
    };
  }

  if (currentVal === resolvedValue) {
    return {
      handled: true,
      outcome: "unchanged",
      ns,
      key,
      canonicalDestinationKey,
      contract,
      resolvedType,
      resolvedValue,
      currentVal,
      reason: null
    };
  }

  return {
    handled: true,
    outcome: "stage_write",
    ns,
    key,
    canonicalDestinationKey,
    contract,
    resolvedType,
    resolvedValue,
    currentVal,
    reason: null
  };
}

function areStringArraysExactEqual(arrA, arrB) {
  if (!Array.isArray(arrA) || !Array.isArray(arrB)) return false;
  if (arrA.length !== arrB.length) return false;
  for (let i = 0; i < arrA.length; i++) {
    if (arrA[i] !== arrB[i]) return false;
  }
  return true;
}

export function validateBatch1ProposedValue({
  productId,
  destinationKey,
  proposedValue,
  baselineSnapshot,
  allowExplicitReferenceListReplacement = false
}) {
  if (!isExactProductGid(productId)) {
    return { valid: false, code: "invalid_product_gid", reason: "Exact Shopify Product GID is required." };
  }

  if (CANCELLED_INERT_DESTINATIONS.has(destinationKey)) {
    return { valid: false, code: "cancelled_destination", reason: "custom.overall_solid_length_in is cancelled and permanently inert." };
  }

  const safeDestKey = typeof destinationKey === "string" ? destinationKey.trim() : "";
  if (
    REMOVED_PARKED_DESTINATIONS.has(safeDestKey) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${safeDestKey}`) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCTVARIANT:${safeDestKey}`) ||
    (!safeDestKey.includes(".") && REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(safeDestKey)) ||
    REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(safeDestKey)
  ) {
    return {
      valid: false,
      code: "retired_destination",
      reason: `Destination "${safeDestKey || String(destinationKey ?? "")}" is retired and removed from the Bench V2 contract.`
    };
  }

  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return { valid: false, code: "unknown_destination", reason: `Destination "${destinationKey}" is not in the Bench V2 contract.` };
  }

  if (
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`${contract.owner}:${contract.destinationKey}`) ||
    REMOVED_PARKED_DESTINATIONS.has(contract.destinationKey)
  ) {
    return {
      valid: false,
      code: "retired_destination",
      reason: `Destination "${contract.destinationKey}" is retired and removed from the Bench V2 contract.`
    };
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
        reason: Array.isArray(parsedArray) && parsedArray.length === 0
          ? `Clearing the last reference entry to an empty list is not supported by the current app validation and writer for "${contract.destinationKey}"; at least one verified Metaobject GID must remain.`
          : `Destination "${contract.destinationKey}" requires a non-empty JSON array of Metaobject GIDs.`
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

    const removedStoredReferenceGids = [];
    for (const existingGid of storedCheck.gids) {
      if (!seenGids.has(existingGid)) {
        removedStoredReferenceGids.push(existingGid);
      }
    }

    const isExplicitReplacementAllowed = Boolean(allowExplicitReferenceListReplacement === true);

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
        allowExplicitReferenceListReplacement: false,
        removedStoredReferenceGids: Object.freeze([]),
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

    if (removedStoredReferenceGids.length > 0 && !isExplicitReplacementAllowed) {
      if (
        baselineObs.presence === "present" &&
        storedCheck.gids.length > 0 &&
        refEvidence.evidenceLoaded &&
        refEvidence.isComplete &&
        areReferenceGidSetsSemanticallyEquivalent(
          parsedArray,
          storedCheck.gids,
          refEvidence.entriesByGid,
          baselineObs.restrictedMetaobjectDefinitionId
        )
      ) {
        const preservedBaselineRaw =
          typeof baselineObs.rawValue === "string" && baselineObs.rawValue.trim() !== ""
            ? baselineObs.rawValue.trim()
            : JSON.stringify(storedCheck.gids);
        return {
          valid: true,
          code: "unchanged_from_baseline",
          normalizedValue: preservedBaselineRaw,
          isUnchangedFromStored: true,
          allowExplicitReferenceListReplacement: false,
          removedStoredReferenceGids: Object.freeze([]),
          verifiedActualType,
          observedShopifyType: typeAndCompleteness.observedShopifyType,
          typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
          baselineObservation: baselineObs,
          reason: "Proposed reference list is canonically equivalent to the current stored baseline."
        };
      }

      const firstDroppedGid = removedStoredReferenceGids[0];
      return {
        valid: false,
        code: "existing_reference_assignment_dropped",
        reason: `Proposal for "${contract.destinationKey}" is missing existing assigned Metaobject ${firstDroppedGid}. Existing reference assignments are preserved and never silently removed.`
      };
    }

    if (!refEvidence.evidenceLoaded || !refEvidence.isComplete) {
      return {
        valid: false,
        code: "reference_entries_not_verified",
        reason:
          refEvidence.error ||
          `Verified Metaobject entries for "${contract.destinationKey}" have not been loaded. Click "Retry Reference Choices" in this drawer before approving.`
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

    if (
      !isExplicitReplacementAllowed &&
      baselineObs.presence === "present" &&
      storedCheck.gids.length > 0 &&
      areReferenceGidSetsSemanticallyEquivalent(
        parsedArray,
        storedCheck.gids,
        refEvidence.entriesByGid,
        baselineObs.restrictedMetaobjectDefinitionId
      )
    ) {
      const preservedBaselineRaw =
        typeof baselineObs.rawValue === "string" && baselineObs.rawValue.trim() !== ""
          ? baselineObs.rawValue.trim()
          : JSON.stringify(storedCheck.gids);
      return {
        valid: true,
        code: "unchanged_from_baseline",
        normalizedValue: preservedBaselineRaw,
        isUnchangedFromStored: true,
        allowExplicitReferenceListReplacement: false,
        removedStoredReferenceGids: Object.freeze([]),
        verifiedActualType,
        observedShopifyType: typeAndCompleteness.observedShopifyType,
        typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
        baselineObservation: baselineObs,
        reason: "Proposed reference list is canonically equivalent to the current stored baseline."
      };
    }

    const hasRemovedSavedMembers = removedStoredReferenceGids.length > 0;

    return {
      valid: true,
      code: "valid_change",
      normalizedValue: exactValue,
      isUnchangedFromStored: false,
      allowExplicitReferenceListReplacement: Boolean(
        isExplicitReplacementAllowed && hasRemovedSavedMembers
      ),
      removedStoredReferenceGids: Object.freeze([...removedStoredReferenceGids]),
      verifiedActualType,
      observedShopifyType: typeAndCompleteness.observedShopifyType,
      typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
      baselineObservation: baselineObs,
      reason: hasRemovedSavedMembers
        ? `Valid Batch 1 explicit standardized reference list replacement (${removedStoredReferenceGids.length} saved entry removed).`
        : "Valid Batch 1 standardized reference proposed change."
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

    if (isPlainTextProposalRejectedForContract(exactValue, exactValue)) {
      return {
        valid: false,
        code: "invalid_plain_text_shape",
        reason: `Rejected reference, GID, UUID, or JSON-container shape for plain-text destination "${contract.destinationKey}".`
      };
    }
  } else if (verifiedActualType === "multi_line_text_field") {
    if (contract.maxLength !== null && exactValue.length > contract.maxLength) {
      return {
        valid: false,
        code: "exceeds_max_length",
        reason: `Value for "${contract.destinationKey}" (${exactValue.length} chars) exceeds the ${contract.maxLength}-character limit.`
      };
    }

    if (contract.destinationKey === "custom.generated_description") {
      if (sanitizeWriterDescriptionHtml(exactValue) !== exactValue) {
        return {
          valid: false,
          code: "disallowed_description_anchor_links",
          reason:
            "Rejected custom.generated_description proposal containing disallowed anchor links (/pages/the-shopped-rock, /collections/the-shopped-rock, /pages/the-shocked-rock, or /collections/the-shocked-rock) that the writer blocks on save."
        };
      }
    }
  } else if (verifiedActualType === "native") {
    if (
      contract.owner === "PRODUCTVARIANT" &&
      contract.namespace === "native" &&
      contract.destinationKey === "native_price"
    ) {
      if (
        baselineObs.variantTargetStatus !== "single_variant_verified" ||
        !isExactProductVariantGid(baselineObs.variantId)
      ) {
        return {
          valid: false,
          code: "unverified_single_variant_target",
          reason: `Single-variant target GID is not verified for "${contract.destinationKey}" (status: ${baselineObs.variantTargetStatus || "unknown"}).`
        };
      }

      if (!CANONICAL_USD_TWO_DECIMAL_MONEY_REGEX.test(exactValue)) {
        return {
          valid: false,
          code: "invalid_usd_money_format",
          reason: `Destination "${contract.destinationKey}" requires a canonical non-negative USD two-decimal price without currency symbols, commas, spaces, signs, exponent notation, or leading zeros (e.g. "45.00" or "0.00"; received "${exactValue}").`
        };
      }

      const proposedCents = parseExactMoneyStringToCentsBigInt(exactValue);
      if (proposedCents === null || proposedCents < 0n) {
        return {
          valid: false,
          code: "invalid_usd_money_format",
          reason: `Destination "${contract.destinationKey}" requires a valid non-negative USD two-decimal price (e.g. "45.00"; received "${exactValue}").`
        };
      }

      const storedPriceStr =
        baselineObs.presence === "present" && typeof baselineObs.rawValue === "string"
          ? baselineObs.rawValue.trim()
          : null;
      const storedCents =
        storedPriceStr !== null
          ? parseExactMoneyStringToCentsBigInt(storedPriceStr)
          : null;

      const isUnchangedPrice =
        baselineObs.presence === "present" &&
        typeof baselineObs.rawValue === "string" &&
        (baselineObs.rawValue === exactValue ||
          (storedCents !== null && storedCents === proposedCents));

      return {
        valid: true,
        code: isUnchangedPrice ? "unchanged_from_baseline" : "valid_change",
        normalizedValue: exactValue,
        isUnchangedFromStored: isUnchangedPrice,
        verifiedActualType,
        observedShopifyType: typeAndCompleteness.observedShopifyType,
        typeEvidenceSource: typeAndCompleteness.typeEvidenceSource,
        baselineObservation: baselineObs,
        reason: isUnchangedPrice
          ? "Proposed price matches the current stored single-variant price in cents."
          : "Valid Batch 1 single-variant price proposed change."
      };
    }

    if (
      contract.owner !== "PRODUCT" ||
      contract.namespace !== "native" ||
      !BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(contract.destinationKey)
    ) {
      return {
        valid: false,
        code: "unsupported_native_destination",
        reason: `Native destination "${contract.destinationKey}" is not in the connected product native allowlist.`
      };
    }

    if (contract.maxLength !== null && exactValue.length > contract.maxLength) {
      return {
        valid: false,
        code: "exceeds_max_length",
        reason: `Value for "${contract.destinationKey}" (${exactValue.length} chars) exceeds the ${contract.maxLength}-character limit.`
      };
    }

    if (contract.destinationKey === "native_description") {
      if (sanitizeWriterDescriptionHtml(exactValue) !== exactValue) {
        return {
          valid: false,
          code: "disallowed_description_anchor_links",
          reason:
            "Native product description contains disallowed anchor links (/pages/the-shopped-rock, /collections/the-shopped-rock, /pages/the-shocked-rock, or /collections/the-shocked-rock) that alter approved content; remove disallowed links before approving."
        };
      }
    }
  } else {
    return {
      valid: false,
      code: "unsupported_verified_type",
      reason: `Unsupported verified type "${String(verifiedActualType)}" for "${contract.destinationKey}".`
    };
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
  baselineSnapshot,
  allowExplicitReferenceListReplacement = false
}) {
  const contract = getFieldContractByDestination(destinationKey);
  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue,
    baselineSnapshot,
    allowExplicitReferenceListReplacement
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

  const removedStoredGids = isShopifyReference && Array.isArray(validation.removedStoredReferenceGids)
    ? Object.freeze([...validation.removedStoredReferenceGids])
    : Object.freeze([]);
  const effectiveAllowExplicitReplacement = Boolean(
    isShopifyReference &&
      allowExplicitReferenceListReplacement === true &&
      validation.allowExplicitReferenceListReplacement === true &&
      removedStoredGids.length > 0
  );

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
    allowExplicitReferenceListReplacement: effectiveAllowExplicitReplacement,
    removedStoredReferenceGids: removedStoredGids,
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
  baselineSnapshot,
  allowExplicitReferenceListReplacement = undefined
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

  const isShopifyReference = contract.namespace === "shopify";
  const recordAllowsReplacement = Boolean(
    isShopifyReference && approvalRecord.allowExplicitReferenceListReplacement === true
  );
  const effectiveReplacementIntent =
    allowExplicitReferenceListReplacement !== undefined
      ? Boolean(isShopifyReference && allowExplicitReferenceListReplacement === true)
      : recordAllowsReplacement;

  if (isShopifyReference && recordAllowsReplacement !== effectiveReplacementIntent) {
    return false;
  }

  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue: currentProposedValue,
    baselineSnapshot,
    allowExplicitReferenceListReplacement: effectiveReplacementIntent
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

  if (isShopifyReference) {
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

    const expectedRemovedGids = Array.isArray(validation.removedStoredReferenceGids)
      ? validation.removedStoredReferenceGids
      : [];
    const recordedRemovedGids = Array.isArray(approvalRecord.removedStoredReferenceGids)
      ? approvalRecord.removedStoredReferenceGids
      : [];
    const expectedReplacementFlag = Boolean(
      validation.allowExplicitReferenceListReplacement === true &&
        expectedRemovedGids.length > 0
    );

    if (recordAllowsReplacement !== expectedReplacementFlag) {
      return false;
    }
    if (!areStringArraysExactEqual(recordedRemovedGids, expectedRemovedGids)) {
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
  const isVariantOwner = contract.owner === "PRODUCTVARIANT";
  const isNativeVariantPrice =
    isVariantOwner && contract.namespace === "native" && contract.destinationKey === "native_price";

  if (!baselineObs.evidenceAvailable) {
    let errText = `Baseline evidence is not loaded for "${contract.destinationKey}".`;
    if (baselineObs.presence === "unknown_incomplete_read") {
      errText = isNativeVariantPrice
        ? `Single-variant price baseline read is incomplete for "${contract.destinationKey}"; reload product data before binding Keep Original.`
        : isVariantOwner
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

  if (isVariantOwner && !isExactProductVariantGid(baselineObs.variantId)) {
    return {
      ok: false,
      error: `Exact Shopify ProductVariant GID is required to bind Keep Original on "${contract.destinationKey}".`,
      record: null
    };
  }

  const exactRejectedProposal = rejectedProposedValue;
  if (baselineObs.presence === "present") {
    if (baselineObs.rawValue === exactRejectedProposal) {
      return { ok: false, error: "Proposal already matches the stored value.", record: null };
    }
    if (isNativeVariantPrice && typeof baselineObs.rawValue === "string") {
      const storedCents = parseExactMoneyStringToCentsBigInt(baselineObs.rawValue.trim());
      const rejectedCents = parseExactMoneyStringToCentsBigInt(exactRejectedProposal.trim());
      if (storedCents !== null && rejectedCents !== null && storedCents === rejectedCents) {
        return { ok: false, error: "Proposal already matches the stored price in cents.", record: null };
      }
    }
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

  const isVariantOwner = contract.owner === "PRODUCTVARIANT";
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
  const isNativeVariantPrice =
    contract.owner === "PRODUCTVARIANT" &&
    contract.namespace === "native" &&
    contract.destinationKey === "native_price";
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

  const allowExplicitReferenceListReplacement = Boolean(
    isShopifyReference &&
      contract.expectedType === "list.metaobject_reference" &&
      contract.isWritableInBatch1 === true &&
      hasProposalKey &&
      !isBlankOrWhitespaceOnly(proposedValue) &&
      rawPropEntry &&
      typeof rawPropEntry === "object" &&
      !Array.isArray(rawPropEntry) &&
      (rawPropEntry.origin === "Manual" || rawPropEntry.origin === "AI") &&
      typeof rawPropEntry.value === "string" &&
      rawPropEntry.value === proposedValue &&
      rawPropEntry.allowExplicitReferenceListReplacement === true &&
      typeof rawPropEntry.explicitReplacementValue === "string" &&
      rawPropEntry.explicitReplacementValue === proposedValue
  );

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
        baselineSnapshot,
        allowExplicitReferenceListReplacement
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
      baselineSnapshot,
      allowExplicitReferenceListReplacement
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
        connectionStatus = isNativeVariantPrice
          ? "Blocked (Single-Variant Price Baseline Read Incomplete)"
          : contract.owner === "PRODUCTVARIANT"
            ? `Blocked (Variant Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`
            : contract.namespace === "native"
              ? "Blocked (Native Field Baseline Read Incomplete)"
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
    } else if (isNativeVariantPrice) {
      connectionStatus = `Connected (Single-Variant Native Price Writable — Variant: ${baselineObs.variantId})`;
    } else {
      connectionStatus =
        contract.owner === "PRODUCTVARIANT"
          ? `Connected (Single-Variant Writable — Verified Type: ${typeAndCompleteness.verifiedActualType})`
          : contract.namespace === "native"
            ? `Connected (Native Product Field Writable — ${contract.expectedType})`
            : `Connected (Batch 1 Writable — Verified Type: ${typeAndCompleteness.verifiedActualType})`;
    }
  } else if (
    contract.batchStage === BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR ||
    contract.batchStage === BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR
  ) {
    connectionStatus = `Read-Only Descriptor (${contract.batchStage})`;
  } else if (contract.batchStage === BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY) {
    connectionStatus = "Read-Only (Task-Restricted: No Shipping Writes)";
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
      statusReason = isNativeVariantPrice
        ? `Single-variant price baseline "${contract.destinationKey}" was not verified during product load; reload product data before editing.`
        : contract.owner === "PRODUCTVARIANT"
          ? `Variant metafield read completeness is "${baselineObs.metafieldsCompleteState}"; absence is never inferred from partial or unflagged reads.`
          : contract.namespace === "native"
            ? `Native baseline field "${contract.destinationKey}" was not verified during product load; reload product data before editing.`
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
        ? `Approved exact value (${isNativeVariantPrice ? "USD money" : validation.verifiedActualType}) bound to variant ${baselineObs.variantId}.`
        : isShopifyReference
          ? validation.allowExplicitReferenceListReplacement
            ? `Approved exact Metaobject GID list replacement (${validation.verifiedActualType}; ${validation.removedStoredReferenceGids.length} saved entry removed) bound to definition ${baselineObs.restrictedMetaobjectDefinitionId}.`
            : `Approved exact Metaobject GID list (${validation.verifiedActualType}) bound to definition ${baselineObs.restrictedMetaobjectDefinitionId}.`
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
      `Click "Retry Reference Choices" in this drawer to verify allowed Metaobject entries for ${baselineObs.restrictedMetaobjectDefinitionId}.`;
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

  const activeDraftRawValueForOptions =
    isShopifyReference && hasProposalKey ? proposedValue : undefined;

  return Object.freeze({
    contract,
    baselineObservation: baselineObs,
    typeAndCompleteness,
    referenceEvidence: refEvidence,
    baselineDisplayValue,
    options: getContractOptionsForObservation(
      contract,
      baselineObs,
      baselineSnapshot,
      activeDraftRawValueForOptions
    ),
    hasProposalKey,
    proposedValue,
    proposedDisplayValue,
    proposalSource,
    allowExplicitReferenceListReplacement,
    validation,
    isApproved,
    isKeepOriginal,
    connectionStatus,
    reviewStatus,
    statusReason
  });
}
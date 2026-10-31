// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2 PURE FIELD & DRAWER CONTRACT
// File: app/utils/bench-v2.contract.jsx
//
// Verified Existing Sources Confirmed in Context:
// 1. app/routes/app.meta-injector.jsx
// 2. app/utils/meta-injector.loader.jsx
// 3. app/routes/app.meta-injector-api.jsx (SHA256: 929294D30480065ECA192AC1DCB7A128642FFA89879BEE5D97BAF6DA92296C75)
// 4. app/routes/app.meta-injector.matrix.jsx
// 5. app/utils/meta-injector.constants.jsx (DROPDOWN_OPTIONS reused below — unchanged)
// 6. app/utils/meta-injector.execution-hook.jsx
// 7. app/utils/meta-injector.matrix-domain.jsx
// 8. app/routes/app.jsx
// 9. app/routes.js (@react-router/fs-routes flatRoutes, v7.16.0)
// 10. app/routes/app.meta-injector-autofill.jsx
// 11. app/utils/meta-injector.autofill.server.jsx (180,240 chars)
// 12. app/utils/bench-v2.contract.jsx (Saved baseline SHA256: 43AFF33B79E1430DC59FAC2638CA759D6FF61DBA1DB6039AD4DB9D62C41DFB85)
//
// Pure contract module only:
// - Zero React hooks/effects, zero storage access, zero GraphQL/network calls.
// - Does NOT import legacy evaluators, execution hooks, or writers.
// - Separates connected contracts (Drawers 1 to 8: Identity, Origin and collection,
//   Treatment, Appearance and character, Manual measurements [dimensions_mm, weight_grams],
//   Conditional setting/accessory facts, Geology [12 active destinations + 1 read-only
//   compatibility inspection slot custom.geological_era], and Other & Channel Attributes
//   [custom.google_product_category on PRODUCT + replacement-bench-local single-variant
//   PRODUCTVARIANT destinations mm-google-shopping.age_group, mm-google-shopping.condition,
//   mm-google-shopping.gender, while keeping mm-google-shopping.custom_product on
//   UNVERIFIED_CONTRACT_HOLD and legacy google.* variant slots + custom.target_gender
//   as read-only compatibility inspection]) from future-batch descriptors and
//   read-only compatibility/parked/protected inventory.
// - Leaves app/utils/meta-injector.constants.jsx completely unchanged.
// - Never advertises unwired future-batch or unverified-hold fields as writable.
// - Enforces strict baseline vs. proposed separation, zero automatic
//   preapproval, exact-value approval binding (including owner + variantId binding),
//   baseline-bound Keep Original, and explicit live-definition / stored-evidence
//   & completeness requirements.
// - Cancelled custom.overall_solid_length_in is permanently omitted/inert.
// ==========================================================================

import { DROPDOWN_OPTIONS, collectionLocationOptions } from "./meta-injector.constants.jsx";

export const BENCH_V2_CONTRACT_VERSION = "2.0.0-batch-1";

export const BENCH_V2_REFERENCE_PRODUCTS = Object.freeze([
  Object.freeze({
    slot: 1,
    role: "primary_start",
    matchTitle: "Canyon Red",
    label: "Canyon Red (Primary Start)"
  }),
  Object.freeze({
    slot: 2,
    role: "reference",
    matchTitle: "Catalyst",
    label: "Catalyst (Reference)"
  }),
  Object.freeze({
    slot: 3,
    role: "reference",
    matchTitle: "Africa",
    label: "Africa (Reference)"
  }),
  Object.freeze({
    slot: 4,
    role: "reference",
    matchTitle: "Bold Contrast",
    label: "Bold Contrast (Reference)"
  })
]);

export const BENCH_V2_BATCH_STAGE = Object.freeze({
  BATCH_1_IMPLEMENTED: "BATCH_1_IMPLEMENTED",
  FUTURE_BATCH_2_DESCRIPTOR: "FUTURE_BATCH_2_DESCRIPTOR",
  FUTURE_BATCH_3_DESCRIPTOR: "FUTURE_BATCH_3_DESCRIPTOR",
  READ_ONLY_COMPATIBILITY: "READ_ONLY_COMPATIBILITY",
  READ_ONLY_HOLD: "READ_ONLY_HOLD",
  TASK_RESTRICTED_READ_ONLY: "TASK_RESTRICTED_READ_ONLY",
  PARKED_EXCLUDED_READ_ONLY: "PARKED_EXCLUDED_READ_ONLY",
  PROTECTED_READ_ONLY: "PROTECTED_READ_ONLY"
});

export const BENCH_V2_WRITE_CAPABILITY = Object.freeze({
  BATCH_1_WRITABLE_WITH_EXACT_APPROVAL: "BATCH_1_WRITABLE_WITH_EXACT_APPROVAL",
  FUTURE_BATCH_UNWIRED_READ_ONLY: "FUTURE_BATCH_UNWIRED_READ_ONLY",
  COMPATIBILITY_INSPECTION_ONLY: "COMPATIBILITY_INSPECTION_ONLY",
  UNVERIFIED_CONTRACT_HOLD: "UNVERIFIED_CONTRACT_HOLD",
  VARIANT_OWNER_HOLD: "VARIANT_OWNER_HOLD",
  STANDARDIZED_REFERENCE_LOCKED: "STANDARDIZED_REFERENCE_LOCKED",
  TASK_RESTRICTED_NO_WRITE: "TASK_RESTRICTED_NO_WRITE",
  PARKED_EXCLUDED_NO_WRITE: "PARKED_EXCLUDED_NO_WRITE",
  PROTECTED_NO_WRITE: "PROTECTED_NO_WRITE"
});

// Explicitly cancelled capability — never include in active or future drawers,
// never stage proposals, and never authorize writes.
export const CANCELLED_INERT_DESTINATIONS = Object.freeze(
  new Set(["overall_solid_length_in", "custom.overall_solid_length_in"])
);

// Task-level operational restrictions (price/shipping writes and deletions outside this task).
export const TASK_RESTRICTED_READ_ONLY_DESTINATIONS = Object.freeze(
  new Set(["native_price", "price", "custom.price", "native_shipping_weight", "custom.shipping_weight_oz"])
);

// Explicit replacement-bench-local allowlist of verified PRODUCTVARIANT destinations.
// Only these 3 variant destinations may be writable in Bench V2 when single-variant
// identity, variant metafield pagination, and live PRODUCTVARIANT definitions are complete.
export const BENCH_V2_CONNECTED_VARIANT_DESTINATIONS = Object.freeze(
  new Set([
    "mm-google-shopping.age_group",
    "mm-google-shopping.condition",
    "mm-google-shopping.gender"
  ])
);

export const BENCH_V2_DRAWERS = Object.freeze([
  Object.freeze({
    drawerId: "identity",
    drawerNumber: 1,
    heading: "1. Identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Core piece identity, dominant material, base stone family (custom.stone_family), and both intentional one-of-a-kind destinations (custom.is_one_of_a_kind and custom.is_ooak), plus distinct read-only inspection rows."
  }),
  Object.freeze({
    drawerId: "origin_and_collection",
    drawerNumber: 2,
    heading: "2. Origin and collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Origin location, origin page handle, collection name/location/date, and found-object provenance."
  }),
  Object.freeze({
    drawerId: "treatment",
    drawerNumber: 3,
    heading: "3. Treatment",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Lapidary treatment status and treated classification."
  }),
  Object.freeze({
    drawerId: "appearance_and_character",
    drawerNumber: 4,
    heading: "4. Appearance and character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Cut and shape, stone shape, surface finish, color, primary/secondary colors, and color pattern (with legacy retirement conflict resolved)."
  }),
  Object.freeze({
    drawerId: "manual_measurements",
    drawerNumber: 5,
    heading: "5. Manual measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Manual bench measurements: dimensions (mm) and stone weight (grams) connected for manual entry and exact-value approval (excluded from AI scan), plus 4 unverified measurement holds (overall-solid-length omitted as cancelled)."
  }),
  Object.freeze({
    drawerId: "conditional_setting_accessory",
    drawerNumber: 6,
    heading: "6. Conditional setting/accessory facts",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Connected setting and hardware facts: secondary medium, jewelry type, setting ready, bail included, chain material, chain link type, jewelry finding type, and wire material."
  }),
  Object.freeze({
    drawerId: "geology",
    drawerNumber: 7,
    heading: "7. Geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Connected geology facts: 12 deterministic custom.* geology destinations connected for manual edit, lookup staging, and exact-value approval, plus read-only compatibility inspection for custom.geological_era (authoritative ERA dropdown is shopify.geological-era)."
  }),
  Object.freeze({
    drawerId: "other_channel",
    drawerNumber: 8,
    heading: "8. Other & Channel Attributes",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Connected channel attributes: product Google product category (custom.google_product_category) and single-variant Google channel attributes (mm-google-shopping.age_group, mm-google-shopping.condition, mm-google-shopping.gender), plus read-only holds (mm-google-shopping.custom_product) and compatibility inspection rows (google.* variant slots and custom.target_gender)."
  }),
  Object.freeze({
    drawerId: "native_seo_description_media",
    drawerNumber: 9,
    heading: "9. Native, SEO, Description & Media Alts",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 3 descriptor: independent native/metafield descriptions and SEO titles, SEO description, per-image media alts, and task-restricted read-only price/shipping weight."
  }),
  Object.freeze({
    drawerId: "standardized_attributes",
    drawerNumber: 10,
    heading: "10. Standardized Attributes (shopify.*)",
    subHarness: "SUB_HARNESS_5",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 3 descriptor: all 21 shopify.* taxonomy reference attributes (6 candidate-matchable in Batch 3 + 15 read-only holds; all locked in Batch 1)."
  }),
  Object.freeze({
    drawerId: "parked_excluded_protected",
    drawerNumber: 11,
    heading: "11. Parked, Excluded & Protected Inventory (Read-Only)",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    isImplementedInBatch1: true,
    description: "Read-only inspection of parked/excluded product and variant fields plus protected third-party app metafields. Zero writes, zero deletions."
  })
]);

const COLLECTION_NAME_OPTIONS = Object.freeze(
  Array.isArray(collectionLocationOptions)
    ? collectionLocationOptions.map((loc) => Object.freeze({ label: loc, value: loc }))
    : []
);

// User-facing Yes/No + actual meaning conventions preserved without confusing
// UI display labels with actual underlying storage values ("true"/"false" for boolean,
// or exact text strings for single_line_text_field).
const IS_OOAK_BOOLEAN_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — one of a kind", value: "true" }),
  Object.freeze({ label: "No — not one of a kind", value: "false" })
]);

const IS_OOAK_TEXT_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — one of a kind", value: "Yes — one of a kind" }),
  Object.freeze({ label: "Yes — one of a kind (Yes)", value: "Yes" }),
  Object.freeze({ label: 'Yes — one of a kind ("true")', value: "true" }),
  Object.freeze({ label: "No — not one of a kind", value: "No" })
]);

const IS_ONE_OF_A_KIND_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — one of a kind", value: "true" }),
  Object.freeze({ label: "Yes — one of a kind (Yes)", value: "Yes" }),
  Object.freeze({ label: "No — not one of a kind", value: "No" })
]);

const FOUND_OBJECT_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — found in the wild", value: "true" }),
  Object.freeze({ label: "Yes — found in the wild (Yes)", value: "Yes" }),
  Object.freeze({ label: "No — purchased rough", value: "No — purchased rough" }),
  Object.freeze({ label: "No — not wild-collected (purchased)", value: "No" })
]);

const TREATED_OPTIONS = Object.freeze([
  Object.freeze({ label: "No — untreated (Untreated — Natural)", value: "Untreated — Natural" }),
  Object.freeze({ label: "Yes — treated (Stabilized)", value: "Stabilized" }),
  Object.freeze({ label: "Yes — treated (Dyed)", value: "Dyed" }),
  Object.freeze({ label: "Yes — treated (Resined)", value: "Resined" }),
  Object.freeze({ label: "Yes — treated (Enhanced)", value: "Enhanced" }),
  Object.freeze({ label: "Yes — treated (Yes)", value: "Yes" }),
  Object.freeze({ label: "No — untreated (No)", value: "No" })
]);

const SETTING_READY_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — setting ready", value: "true" }),
  Object.freeze({ label: "Yes — setting ready (Yes)", value: "Yes" }),
  Object.freeze({ label: "No — not setting ready", value: "No" })
]);

const BAIL_INCLUDED_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — bail included", value: "true" }),
  Object.freeze({ label: "Yes — bail included (Yes)", value: "Yes" }),
  Object.freeze({ label: "No — no bail included", value: "No" }),
  Object.freeze({ label: "Silver Plated Pinch Bail", value: "Silver Plated Pinch Bail" })
]);

const GOOGLE_PRODUCT_CATEGORY_OPTIONS = Object.freeze([
  Object.freeze({
    label: "Apparel & Accessories > Jewelry",
    value: "Apparel & Accessories > Jewelry"
  })
]);

const GOOGLE_AGE_GROUP_OPTIONS = Object.freeze([
  Object.freeze({ label: "adult", value: "adult" }),
  Object.freeze({ label: "kids", value: "kids" }),
  Object.freeze({ label: "toddler", value: "toddler" }),
  Object.freeze({ label: "infant", value: "infant" }),
  Object.freeze({ label: "newborn", value: "newborn" })
]);

const GOOGLE_CONDITION_OPTIONS = Object.freeze([
  Object.freeze({ label: "new", value: "new" }),
  Object.freeze({ label: "used", value: "used" }),
  Object.freeze({ label: "refurbished", value: "refurbished" })
]);

const GOOGLE_GENDER_OPTIONS = Object.freeze([
  Object.freeze({ label: "unisex", value: "unisex" }),
  Object.freeze({ label: "female", value: "female" }),
  Object.freeze({ label: "male", value: "male" })
]);

export const BENCH_V2_OPTIONS_BY_KEY = Object.freeze({
  stone_family: Object.freeze([...(DROPDOWN_OPTIONS.stone_family || [])]),
  surface_finish: Object.freeze([...(DROPDOWN_OPTIONS.surface_finish || [])]),
  is_ooak: IS_OOAK_TEXT_OPTIONS,
  is_ooak_boolean: IS_OOAK_BOOLEAN_OPTIONS,
  is_ooak_text: IS_OOAK_TEXT_OPTIONS,
  is_one_of_a_kind: IS_ONE_OF_A_KIND_OPTIONS,
  treated: TREATED_OPTIONS,
  found_object: FOUND_OBJECT_OPTIONS,
  setting_ready: SETTING_READY_OPTIONS,
  bail_included: BAIL_INCLUDED_OPTIONS,
  chain_material: Object.freeze([...(DROPDOWN_OPTIONS.chain_material || [])]),
  collection_name: COLLECTION_NAME_OPTIONS,
  google_product_category: GOOGLE_PRODUCT_CATEGORY_OPTIONS,
  google_age_group: GOOGLE_AGE_GROUP_OPTIONS,
  google_condition: GOOGLE_CONDITION_OPTIONS,
  google_gender: GOOGLE_GENDER_OPTIONS
});

const STANDARDIZED_SHOPIFY_KEYS = Object.freeze([
  "age-group",
  "authenticity",
  "chain-link-type",
  "color-pattern",
  "condition",
  "construction",
  "crystal-system",
  "geological-era",
  "jewelry-finding-type",
  "jewelry-material",
  "jewelry-type",
  "material",
  "material-origin",
  "mineral-class",
  "necklace-design",
  "product-classification",
  "product-use",
  "rarity",
  "rock-composition",
  "rock-formation",
  "target-gender"
]);

const FUTURE_BATCH_3_CANDIDATE_STANDARDIZED_KEYS = new Set([
  "chain-link-type",
  "construction",
  "jewelry-finding-type",
  "material-origin",
  "product-classification",
  "product-use"
]);

const EXCLUDED_STANDARDIZED_KEYS = new Set([
  "authenticity",
  "necklace-design",
  "rarity"
]);

function defineFieldContract(spec) {
  if (!spec || typeof spec.destinationKey !== "string" || spec.destinationKey.trim() === "") {
    throw new Error("BENCH_V2_CONTRACT_ERROR: Every field contract requires a non-empty destinationKey.");
  }
  if (CANCELLED_INERT_DESTINATIONS.has(spec.destinationKey) || CANCELLED_INERT_DESTINATIONS.has(spec.key)) {
    throw new Error(`BENCH_V2_CONTRACT_ERROR: Cancelled destination "${spec.destinationKey}" cannot be registered.`);
  }

  const isEligibleOwnerAndDestination =
    (spec.owner === "PRODUCT" && spec.namespace === "custom") ||
    (spec.owner === "PRODUCTVARIANT" &&
      BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(spec.destinationKey));

  const isBatch1Writable =
    spec.batchStage === BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED &&
    spec.writeCapability === BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL &&
    isEligibleOwnerAndDestination;

  const allowedTypes = Array.isArray(spec.allowedTypes) && spec.allowedTypes.length > 0
    ? Object.freeze([...spec.allowedTypes])
    : Object.freeze([spec.expectedType]);

  return Object.freeze({
    destinationKey: spec.destinationKey,
    namespace: spec.namespace,
    key: spec.key,
    label: spec.label,
    owner: spec.owner,
    drawerId: spec.drawerId,
    subHarness: spec.subHarness,
    batchStage: spec.batchStage,
    writeCapability: spec.writeCapability,
    isWritableInBatch1: Boolean(isBatch1Writable),
    isManualOnlyNoAi: Boolean(spec.isManualOnlyNoAi),
    usesYesNoMeaningDisplay: Boolean(spec.usesYesNoMeaningDisplay),
    requiresExactValueApproval: true,
    autoPreApproveAllowed: false,
    expectedType: spec.expectedType,
    allowedTypes,
    requiresLiveDefinitionOrStoredTypeEvidence: spec.requiresLiveDefinitionOrStoredTypeEvidence !== false,
    maxLength: typeof spec.maxLength === "number" ? spec.maxLength : null,
    control: spec.control || "text",
    optionsKey: spec.optionsKey || null,
    canonicalTarget: spec.canonicalTarget || null,
    purposeNote: spec.purposeNote || null,
    unresolvedPolicyQuestion: spec.unresolvedPolicyQuestion || null
  });
}

// ==========================================================================
// AUTHORITATIVE FIELD CONTRACTS (ALL 11 DRAWERS)
// ==========================================================================

export const BENCH_V2_FIELD_CONTRACTS = Object.freeze([
  // ------------------------------------------------------------------------
  // DRAWER 1: IDENTITY (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  // Both custom.is_one_of_a_kind and custom.is_ooak are intentional, distinct
  // destinations using the same factual answer, each requiring its own
  // exact-value approval with no automatic companion writes.
  // custom.material (Dominant Material) and custom.stone_family (Stone Family)
  // are distinct facts; custom.stone_family does not point to custom.material
  // as a canonical target and never auto-populates custom.material.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.piece_name",
    namespace: "custom",
    key: "piece_name",
    label: "Piece Name",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Individual piece identifier (never the full 3-part Shopify marketing title)."
  }),
  defineFieldContract({
    destinationKey: "custom.material",
    namespace: "custom",
    key: "material",
    label: "Dominant Material",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "stone_family",
    purposeNote: "Dominant material of the piece (distinct from custom.stone_family; preserves existing option list; never auto-populated from stone_family and never overwritten with hardware/metal/plating strings)."
  }),
  defineFieldContract({
    destinationKey: "custom.is_one_of_a_kind",
    namespace: "custom",
    key: "is_one_of_a_kind",
    label: "Is One of a Kind (custom.is_one_of_a_kind)",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    allowedTypes: ["single_line_text_field"],
    maxLength: 255,
    optionsKey: "is_one_of_a_kind",
    purposeNote: "Intentional OOAK destination #1 (single_line_text_field). Uses the same factual OOAK answer as custom.is_ooak with no second lookup; requires its own exact-value approval with no automatic companion write."
  }),
  defineFieldContract({
    destinationKey: "custom.is_ooak",
    namespace: "custom",
    key: "is_ooak",
    label: "Is OOAK (custom.is_ooak)",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    allowedTypes: ["single_line_text_field", "boolean"],
    maxLength: 255,
    optionsKey: "is_ooak",
    purposeNote: "Intentional OOAK destination #2. Preserves actual observed storage/definition type on each product ('boolean' accepts exact 'true'/'false'; 'single_line_text_field' preserves exact text) while displaying user-facing Yes/No convention. Requires its own exact-value approval with no automatic companion write."
  }),
  defineFieldContract({
    destinationKey: "custom.stone_family",
    namespace: "custom",
    key: "stone_family",
    label: "Stone Family",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "stone_family",
    canonicalTarget: null,
    purposeNote: "Base stone family (e.g. Red Jasper -> Jasper). Distinct from Dominant Material (custom.material) and Primary Medium (custom.primary_medium); requires its own exact-value approval and never auto-populates or overwrites those other destinations."
  }),
  // Identity Read-Only Inspection Row (Preserved Distinct Fact, No Implicit Dual Writes)
  defineFieldContract({
    destinationKey: "custom.primary_medium",
    namespace: "custom",
    key: "primary_medium",
    label: "Primary Medium (Saved Compatibility — Read-Only)",
    owner: "PRODUCT",
    drawerId: "identity",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "custom.material",
    purposeNote: "Inspectable saved primary_medium value. Never dual-written or promoted into custom.material if contaminated with hardware terms."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 2: ORIGIN AND COLLECTION (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.origin_location",
    namespace: "custom",
    key: "origin_location",
    label: "Origin Location",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Geological or geographic origin location of the material."
  }),
  defineFieldContract({
    destinationKey: "custom.origin_page_handle",
    namespace: "custom",
    key: "origin_page_handle",
    label: "Origin Page Handle",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Sole canonical editable origin page handle."
  }),
  defineFieldContract({
    destinationKey: "custom.collection_name",
    namespace: "custom",
    key: "collection_name",
    label: "Collection Name",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "collection_name",
    purposeNote: "Studio collection or series name."
  }),
  defineFieldContract({
    destinationKey: "custom.collection_location",
    namespace: "custom",
    key: "collection_location",
    label: "Collection Location",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Specific field/river/ranch collecting location."
  }),
  defineFieldContract({
    destinationKey: "custom.found_object",
    namespace: "custom",
    key: "found_object",
    label: "Found Object",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "found_object",
    purposeNote: "Wild-found vs. purchased provenance."
  }),
  defineFieldContract({
    destinationKey: "custom.collection_date",
    namespace: "custom",
    key: "collection_date",
    label: "Collection Date",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Collection date string. Blank/absent stays absent; placeholder tokens ('N/A', 'None', 'Unknown') are rejected at source."
  }),
  defineFieldContract({
    destinationKey: "custom.origin_handle",
    namespace: "custom",
    key: "origin_handle",
    label: "Origin Handle (Saved Compatibility — Read-Only)",
    owner: "PRODUCT",
    drawerId: "origin_and_collection",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "custom.origin_page_handle",
    purposeNote: "Inspectable legacy alias; canonical writes target custom.origin_page_handle only."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 3: TREATMENT (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.treatment_status",
    namespace: "custom",
    key: "treatment_status",
    label: "Treatment Status",
    owner: "PRODUCT",
    drawerId: "treatment",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Detailed treatment disclosure text."
  }),
  defineFieldContract({
    destinationKey: "custom.treated",
    namespace: "custom",
    key: "treated",
    label: "Treated",
    owner: "PRODUCT",
    drawerId: "treatment",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "treated",
    purposeNote: "Standardized studio treatment value (e.g. Untreated — Natural)."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 4: APPEARANCE AND CHARACTER (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  // Legacy retirement conflict on custom.cut_and_shape, custom.stone_shape,
  // and custom.color is resolved here: they are active canonical destinations
  // in FIELD_CATALOG and matrix-domain.jsx, and are NOT retired.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.cut_and_shape",
    namespace: "custom",
    key: "cut_and_shape",
    label: "Cut and Shape",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Detailed cut and shape description (distinct from broader custom.stone_shape). Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  }),
  defineFieldContract({
    destinationKey: "custom.stone_shape",
    namespace: "custom",
    key: "stone_shape",
    label: "Stone Shape",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Broader stone shape classification. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  }),
  defineFieldContract({
    destinationKey: "custom.surface_finish",
    namespace: "custom",
    key: "surface_finish",
    label: "Surface Finish",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "surface_finish",
    purposeNote: "Lapidary surface polish/finish."
  }),
  defineFieldContract({
    destinationKey: "custom.color",
    namespace: "custom",
    key: "color",
    label: "Color",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "General color descriptor. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  }),
  defineFieldContract({
    destinationKey: "custom.primary_color",
    namespace: "custom",
    key: "primary_color",
    label: "Primary Color",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Dominant visual color of the piece."
  }),
  defineFieldContract({
    destinationKey: "custom.secondary_colors",
    namespace: "custom",
    key: "secondary_colors",
    label: "Secondary Colors",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Secondary/accent colors as plain text (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.color_pattern",
    namespace: "custom",
    key: "color_pattern",
    label: "Color Pattern",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Visual patterning (banding, brecciated, dendritic, etc.) as plain text."
  }),
  defineFieldContract({
    destinationKey: "custom.cut_type",
    namespace: "custom",
    key: "cut_type",
    label: "Cut Type (Saved Compatibility — Read-Only)",
    owner: "PRODUCT",
    drawerId: "appearance_and_character",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "custom.cut_and_shape",
    purposeNote: "Inspectable compatibility field; canonical writes target custom.cut_and_shape."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 5: MANUAL MEASUREMENTS (SUB_HARNESS_2 — CONNECTED FOR MANUAL ENTRY)
  // custom.dimensions_mm and custom.weight_grams are manual bench measurements
  // (isManualOnlyNoAi: true — excluded from AI generation/staging).
  // Capabilities #59–#62 remain on unverified contract hold until live Shopify
  // definitions and writer support are verified.
  // Note: custom.overall_solid_length_in (#58) is CANCELLED and omitted.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.dimensions_mm",
    namespace: "custom",
    key: "dimensions_mm",
    label: "Dimensions (mm)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Manual caliper measurement in millimeters (e.g. 38 x 24 x 6 mm). Excluded from AI generation/staging; requires live definition or stored type verification and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "custom.weight_grams",
    namespace: "custom",
    key: "weight_grams",
    label: "Weight (grams)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "number_decimal",
    allowedTypes: ["number_decimal"],
    purposeNote: "Manual scale weight in grams (number_decimal). Excluded from AI generation/staging; requires canonical finite non-negative decimal representation matching writer serialization and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "custom.whole_product_weight_grams",
    namespace: "custom",
    key: "whole_product_weight_grams",
    label: "Actual Whole-Product Weight (g) (Unverified Hold)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    isManualOnlyNoAi: true,
    expectedType: "number_decimal",
    purposeNote: "Capability #59: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  }),
  defineFieldContract({
    destinationKey: "custom.chain_cord_length_in",
    namespace: "custom",
    key: "chain_cord_length_in",
    label: "Chain or Cord Length (in) (Unverified Hold)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    purposeNote: "Capability #60: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  }),
  defineFieldContract({
    destinationKey: "custom.accessory_dimensions_mm",
    namespace: "custom",
    key: "accessory_dimensions_mm",
    label: "Accessory Exterior Dimensions (mm) (Unverified Hold)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    purposeNote: "Capability #61: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  }),
  defineFieldContract({
    destinationKey: "custom.fitting_opening_mm",
    namespace: "custom",
    key: "fitting_opening_mm",
    label: "Fitting / Opening / Grip Dimensions (mm) (Unverified Hold)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    purposeNote: "Capability #62: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 6: CONDITIONAL SETTING/ACCESSORY FACTS (SUB_HARNESS_2 — CONNECTED)
  // All 8 fields are product-level custom.* single_line_text_field targets
  // supported by executeRepairPlan in app/routes/app.meta-injector-api.jsx.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.secondary_medium",
    namespace: "custom",
    key: "secondary_medium",
    label: "Secondary Medium",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Secondary medium (setting/hardware metal or material) when applicable; never overwrites stone identity."
  }),
  defineFieldContract({
    destinationKey: "custom.jewelry_type",
    namespace: "custom",
    key: "jewelry_type",
    label: "Jewelry Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Jewelry type classification (e.g. Pendant, Necklace, Artisan jewelry, N/A)."
  }),
  defineFieldContract({
    destinationKey: "custom.setting_ready",
    namespace: "custom",
    key: "setting_ready",
    label: "Setting Ready",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "setting_ready",
    purposeNote: "Whether the piece is setting-ready or mounted/ready to wear (preserves exact descriptive text or boolean-like text values)."
  }),
  defineFieldContract({
    destinationKey: "custom.bail_included",
    namespace: "custom",
    key: "bail_included",
    label: "Bail Included",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    usesYesNoMeaningDisplay: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "bail_included",
    purposeNote: "Whether a bail is included and/or its specific descriptive type (e.g. Silver Plated Pinch Bail)."
  }),
  defineFieldContract({
    destinationKey: "custom.chain_material",
    namespace: "custom",
    key: "chain_material",
    label: "Chain Material",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "chain_material",
    purposeNote: "Included necklace chain or cord material."
  }),
  defineFieldContract({
    destinationKey: "custom.chain_link_type",
    namespace: "custom",
    key: "chain_link_type",
    label: "Chain Link Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Chain link or cord type (e.g. Cord, Snake Chain)."
  }),
  defineFieldContract({
    destinationKey: "custom.jewelry_finding_type",
    namespace: "custom",
    key: "jewelry_finding_type",
    label: "Jewelry Finding Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Specific finding or mounting hardware (e.g. Silver Plated Pinch Bail, Glue-On Bail, Assorted Glue-In Setting)."
  }),
  defineFieldContract({
    destinationKey: "custom.wire_material",
    namespace: "custom",
    key: "wire_material",
    label: "Wire Material",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Wire material when wire-wrapped."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 7: GEOLOGY (SUB_HARNESS_3 — CONNECTED)
  // 12 deterministic custom.* single_line_text_field geology destinations
  // connected for manual edit, lookup staging, and exact-value approval.
  // Legacy custom.geological_era remains visible as READ_ONLY_COMPATIBILITY /
  // COMPATIBILITY_INSPECTION_ONLY (authoritative ERA dropdown is shopify.geological-era;
  // custom.geological_age is separate library AGE text where "Variable" can be valid).
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.mohs_hardness",
    namespace: "custom",
    key: "mohs_hardness",
    label: "Mohs Hardness",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mohs hardness scale value or range (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.specific_gravity",
    namespace: "custom",
    key: "specific_gravity",
    label: "Specific Gravity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Specific gravity value or range (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.crystal_system",
    namespace: "custom",
    key: "crystal_system",
    label: "Crystal System",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Crystal system classification as plain text (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.luster",
    namespace: "custom",
    key: "luster",
    label: "Luster",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mineralogical luster (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.cleavage",
    namespace: "custom",
    key: "cleavage",
    label: "Cleavage",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mineralogical cleavage (single_line_text_field; 'None' is a valid mineralogical value)."
  }),
  defineFieldContract({
    destinationKey: "custom.fracture_pattern",
    namespace: "custom",
    key: "fracture_pattern",
    label: "Fracture Pattern",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mineralogical fracture pattern (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.diaphaneity",
    namespace: "custom",
    key: "diaphaneity",
    label: "Diaphaneity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Light transmission / diaphaneity (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.tenacity",
    namespace: "custom",
    key: "tenacity",
    label: "Tenacity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mineralogical tenacity (single_line_text_field, e.g. Brittle)."
  }),
  defineFieldContract({
    destinationKey: "custom.mineral_class",
    namespace: "custom",
    key: "mineral_class",
    label: "Mineral Class",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Mineral class as plain text (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.rock_composition",
    namespace: "custom",
    key: "rock_composition",
    label: "Rock Composition",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Rock or mineral composition as plain text (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.rock_formation",
    namespace: "custom",
    key: "rock_formation",
    label: "Rock Formation",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Geological rock formation as plain text (single_line_text_field)."
  }),
  defineFieldContract({
    destinationKey: "custom.geological_era",
    namespace: "custom",
    key: "geological_era",
    label: "Geological Era (Saved Compatibility — Read-Only)",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    canonicalTarget: "shopify.geological-era",
    purposeNote: "Legacy custom geological_era field kept read-only for inspection only; authoritative ERA dropdown is shopify.geological-era and AGE text is custom.geological_age."
  }),
  defineFieldContract({
    destinationKey: "custom.geological_age",
    namespace: "custom",
    key: "geological_age",
    label: "Geological Age",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Library geological age text (single_line_text_field; distinct from shopify.geological-era and custom.geological_era; 'Variable' can be valid)."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 8: OTHER & CHANNEL ATTRIBUTES (SUB_HARNESS_3 — CONNECTED IN BENCH V2)
  // - custom.google_product_category (PRODUCT) connected under existing
  //   exact-value approval, completeness, and live/stored type guards.
  // - Replacement-bench-local PRODUCTVARIANT destinations:
  //   mm-google-shopping.age_group, mm-google-shopping.condition,
  //   mm-google-shopping.gender (single_line_text_field, max 255), bound to
  //   verified single-variant GID, complete variant metafields, and live
  //   PRODUCTVARIANT definitions.
  // - mm-google-shopping.custom_product remains on UNVERIFIED_CONTRACT_HOLD.
  // - Legacy PRODUCTVARIANT google.age_group, google.condition,
  //   google.target_gender and PRODUCT custom.target_gender remain visible
  //   as read-only compatibility inspection rows.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.google_product_category",
    namespace: "custom",
    key: "google_product_category",
    label: "Google Product Category",
    owner: "PRODUCT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "google_product_category",
    purposeNote: "Product-level Google product category text (custom.google_product_category). Requires live definition or stored type verification and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_product",
    namespace: "mm-google-shopping",
    key: "custom_product",
    label: "Google Shopping Custom Product (Read-Only Hold)",
    owner: "PRODUCT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    expectedType: "boolean",
    purposeNote: "Held read-only: no live PRODUCT or PRODUCTVARIANT definition or stored boolean exists on the store, and legacy custom.custom_product text ('true') does not verify channel boolean polarity."
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.age_group",
    namespace: "mm-google-shopping",
    key: "age_group",
    label: "Google: Age Group (mm-google-shopping.age_group)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "google_age_group",
    purposeNote: "Variant-owned Google age group (PRODUCTVARIANT mm-google-shopping.age_group, single_line_text_field). Requires complete single-variant enumeration, exact ProductVariant GID binding, complete variant metafields/definitions, and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.condition",
    namespace: "mm-google-shopping",
    key: "condition",
    label: "Google: Condition (mm-google-shopping.condition)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "google_condition",
    purposeNote: "Variant-owned Google condition (PRODUCTVARIANT mm-google-shopping.condition, single_line_text_field). Requires complete single-variant enumeration, exact ProductVariant GID binding, complete variant metafields/definitions, and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.gender",
    namespace: "mm-google-shopping",
    key: "gender",
    label: "Google: Gender (mm-google-shopping.gender)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "google_gender",
    purposeNote: "Variant-owned Google gender (PRODUCTVARIANT mm-google-shopping.gender, single_line_text_field). Requires complete single-variant enumeration, exact ProductVariant GID binding, complete variant metafields/definitions, and exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "google.age_group",
    namespace: "google",
    key: "age_group",
    label: "Google Age Group (Legacy Variant Compatibility — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "mm-google-shopping.age_group",
    purposeNote: "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.age_group definition; active variant definition is mm-google-shopping.age_group)."
  }),
  defineFieldContract({
    destinationKey: "google.condition",
    namespace: "google",
    key: "condition",
    label: "Google Condition (Legacy Variant Compatibility — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "mm-google-shopping.condition",
    purposeNote: "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.condition definition; active variant definition is mm-google-shopping.condition)."
  }),
  defineFieldContract({
    destinationKey: "google.target_gender",
    namespace: "google",
    key: "target_gender",
    label: "Google Target Gender (Legacy Variant Compatibility — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "mm-google-shopping.gender",
    purposeNote: "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.target_gender definition; active variant definition is mm-google-shopping.gender)."
  }),
  defineFieldContract({
    destinationKey: "custom.target_gender",
    namespace: "custom",
    key: "target_gender",
    label: "Target Gender (Custom Compatibility — Read-Only)",
    owner: "PRODUCT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget: "google.target_gender",
    purposeNote: "Inspectable product-level custom.target_gender compatibility value; never auto-migrated or copied."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 9: NATIVE, SEO, DESCRIPTION & MEDIA ALTS (SUB_HARNESS_4 — FUTURE BATCH 3)
  // Preserves distinct native and custom metafield destinations for
  // description and SEO title. Price and shipping weight are task-restricted
  // read-only (no writes in this task).
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "native_title",
    namespace: "native",
    key: "native_title",
    label: "Native Product Title (product.title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "native_title",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "native_description",
    namespace: "native",
    key: "native_description",
    label: "Native Product Description HTML (product.descriptionHtml)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "native_html",
    maxLength: 10000,
    control: "multiline",
    purposeNote: "Independent destination from custom.generated_description; requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "custom.generated_description",
    namespace: "custom",
    key: "generated_description",
    label: "Generated Description Metafield (custom.generated_description)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "multi_line_text_field",
    maxLength: 10000,
    control: "multiline",
    canonicalTarget: "native_description",
    purposeNote: "Independent destination from native_description; requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "native_seo_title",
    namespace: "native",
    key: "native_seo_title",
    label: "Native SEO Title (product.seo.title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "native_seo_title",
    maxLength: 70,
    purposeNote: "Independent destination from custom.seo_title; requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "custom.seo_title",
    namespace: "custom",
    key: "seo_title",
    label: "SEO Title Metafield (custom.seo_title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 70,
    canonicalTarget: "native_seo_title",
    purposeNote: "Independent destination from native_seo_title; requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "native_seo_description",
    namespace: "native",
    key: "native_seo_description",
    label: "Native SEO Meta Description (product.seo.description)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "native_seo_description",
    maxLength: 160,
    control: "multiline"
  }),
  defineFieldContract({
    destinationKey: "native_image_alt",
    namespace: "native",
    key: "native_image_alt",
    label: "Per-Image Media Alt Text Capability (Expands per MediaImage GID)",
    owner: "MEDIAIMAGE",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "media_alt_collection",
    purposeNote: "Capability descriptor only; actual writes in Batch 3 require exact native_image_alts_<MediaImageGid> targets."
  }),
  defineFieldContract({
    destinationKey: "custom.alt_text",
    namespace: "custom",
    key: "alt_text",
    label: "General Alt Text Compatibility Metafield (custom.alt_text)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    canonicalTarget: "native_image_alt",
    purposeNote: "Compatibility metafield; never auto-created when absent and never auto-copied from hero image alt."
  }),
  defineFieldContract({
    destinationKey: "native_price",
    namespace: "native",
    key: "native_price",
    label: "Variant Price (Task-Restricted Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.TASK_RESTRICTED_NO_WRITE,
    expectedType: "money",
    purposeNote: "Price changes are outside this task; inspectable baseline only."
  }),
  defineFieldContract({
    destinationKey: "native_shipping_weight",
    namespace: "native",
    key: "native_shipping_weight",
    label: "Inventory Shipping Weight (Task-Restricted Read-Only)",
    owner: "INVENTORYITEM",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.TASK_RESTRICTED_NO_WRITE,
    expectedType: "weight_ounces",
    purposeNote: "Shipping-weight changes are outside this task; inspectable baseline only."
  }),
  defineFieldContract({
    destinationKey: "custom.shipping_weight_oz",
    namespace: "custom",
    key: "shipping_weight_oz",
    label: "Shipping Weight Oz Metafield (Task-Restricted Read-Only)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.TASK_RESTRICTED_NO_WRITE,
    expectedType: "number_decimal",
    canonicalTarget: "native_shipping_weight",
    purposeNote: "Shipping-weight changes are outside this task; inspectable baseline only."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 10: STANDARDIZED ATTRIBUTES (shopify.* — SUB_HARNESS_5 — FUTURE BATCH 3)
  // All 21 shopify.* attributes are inspectable here so none are hidden.
  // None are unlocked by descriptor alone.
  // ------------------------------------------------------------------------
  ...STANDARDIZED_SHOPIFY_KEYS.filter((k) => !EXCLUDED_STANDARDIZED_KEYS.has(k)).map((k) => {
    const isCandidateKey = FUTURE_BATCH_3_CANDIDATE_STANDARDIZED_KEYS.has(k);
    return defineFieldContract({
      destinationKey: `shopify.${k}`,
      namespace: "shopify",
      key: k,
      label: `Shopify Standardized: ${k}`,
      owner: "PRODUCT",
      drawerId: "standardized_attributes",
      subHarness: "SUB_HARNESS_5",
      batchStage: isCandidateKey
        ? BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR
        : BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
      writeCapability: BENCH_V2_WRITE_CAPABILITY.STANDARDIZED_REFERENCE_LOCKED,
      expectedType: "list.metaobject_reference",
      purposeNote: isCandidateKey
        ? "Future Batch 3 reference-matching candidate destination. Locked in Batch 1; requires live definition, category constraint eligibility, and exact Metaobject GID resolution."
        : "Read-only standardized taxonomy attribute (pending_read_only)."
    });
  }),

  // ------------------------------------------------------------------------
  // DRAWER 11: PARKED, EXCLUDED & PROTECTED INVENTORY (READ-ONLY)
  // Includes all 31 parked/excluded entries + protected app data + legacy
  // hyphenated/global compatibility inspection slots.
  // Note on concrete policy question: custom.origin_story and
  // custom.honest_flaws_and_character were marked EXCLUDED_INPUT in
  // constants.jsx while still listed in ALLOWED_TAB3_KEYS in the legacy API.
  // They are preserved here as inspectable read-only until Bob explicitly
  // authorizes whether either should move to an active drawer in a later batch.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.origin_story",
    namespace: "custom",
    key: "origin_story",
    label: "Origin Story (Parked / Source Context — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "multi_line_text_field",
    control: "multiline",
    unresolvedPolicyQuestion: "Marked EXCLUDED_INPUT in constants.jsx but listed in ALLOWED_TAB3_KEYS in legacy API; kept read-only to preserve saved story text until explicitly decided."
  }),
  defineFieldContract({
    destinationKey: "custom.honest_flaws_and_character",
    namespace: "custom",
    key: "honest_flaws_and_character",
    label: "Honest Flaws and Character (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "multi_line_text_field",
    control: "multiline",
    unresolvedPolicyQuestion: "Marked EXCLUDED_INPUT in constants.jsx but listed in ALLOWED_TAB3_KEYS in legacy API; kept read-only to preserve saved character notes until explicitly decided."
  }),
  defineFieldContract({
    destinationKey: "custom.character_marks",
    namespace: "custom",
    key: "character_marks",
    label: "Character Marks (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "list.single_line_text_field",
    control: "multiline"
  }),
  defineFieldContract({
    destinationKey: "custom.rescued_by",
    namespace: "custom",
    key: "rescued_by",
    label: "Rescued By (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.official_name",
    namespace: "custom",
    key: "official_name",
    label: "Official Name (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.stone_story",
    namespace: "custom",
    key: "stone_story",
    label: "Stone Story (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "list.single_line_text_field",
    control: "multiline"
  }),
  defineFieldContract({
    destinationKey: "custom.artist_notes",
    namespace: "custom",
    key: "artist_notes",
    label: "Artist Notes (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "multi_line_text_field",
    control: "multiline"
  }),
  defineFieldContract({
    destinationKey: "custom.bench_notes",
    namespace: "custom",
    key: "bench_notes",
    label: "Bench Notes (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "multi_line_text_field",
    control: "multiline"
  }),
  defineFieldContract({
    destinationKey: "custom.handcrafted_by",
    namespace: "custom",
    key: "handcrafted_by",
    label: "Handcrafted By (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.primary_use",
    namespace: "custom",
    key: "primary_use",
    label: "Primary Use (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field",
    canonicalTarget: "shopify.product-use"
  }),
  defineFieldContract({
    destinationKey: "custom.necklace_design",
    namespace: "custom",
    key: "necklace_design",
    label: "Necklace Design (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.authenticity",
    namespace: "custom",
    key: "authenticity",
    label: "Authenticity (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.rarity",
    namespace: "custom",
    key: "rarity",
    label: "Rarity (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.custom_product",
    namespace: "custom",
    key: "custom_product",
    label: "Custom Product (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.age_group",
    namespace: "custom",
    key: "age_group",
    label: "Age Group Custom (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.condition",
    namespace: "custom",
    key: "condition",
    label: "Condition Custom (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.price",
    namespace: "custom",
    key: "price",
    label: "Custom Price Metafield (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "custom.story_theme",
    namespace: "custom",
    key: "story_theme",
    label: "Story Theme (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "shopify.authenticity",
    namespace: "shopify",
    key: "authenticity",
    label: "Shopify Authenticity (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "list.metaobject_reference"
  }),
  defineFieldContract({
    destinationKey: "shopify.necklace-design",
    namespace: "shopify",
    key: "necklace-design",
    label: "Shopify Necklace Design (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "list.metaobject_reference"
  }),
  defineFieldContract({
    destinationKey: "shopify.rarity",
    namespace: "shopify",
    key: "rarity",
    label: "Shopify Rarity (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "list.metaobject_reference"
  }),
  defineFieldContract({
    destinationKey: "app--3026047.conversation_starters",
    namespace: "app--3026047",
    key: "conversation_starters",
    label: "App Conversation Starters (Parked — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "global.harmonized_system_code",
    namespace: "global",
    key: "harmonized_system_code",
    label: "Harmonized System Code (Parked Variant Customs Code — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.mpn",
    namespace: "mm-google-shopping",
    key: "mpn",
    label: "Google Shopping MPN (Excluded Variant Field — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_label_0",
    namespace: "mm-google-shopping",
    key: "custom_label_0",
    label: "Google Shopping Custom Label 0 (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_label_1",
    namespace: "mm-google-shopping",
    key: "custom_label_1",
    label: "Google Shopping Custom Label 1 (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_label_2",
    namespace: "mm-google-shopping",
    key: "custom_label_2",
    label: "Google Shopping Custom Label 2 (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_label_3",
    namespace: "mm-google-shopping",
    key: "custom_label_3",
    label: "Google Shopping Custom Label 3 (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_label_4",
    namespace: "mm-google-shopping",
    key: "custom_label_4",
    label: "Google Shopping Custom Label 4 (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.size_system",
    namespace: "mm-google-shopping",
    key: "size_system",
    label: "Google Shopping Size System (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "mm-google-shopping.size_type",
    namespace: "mm-google-shopping",
    key: "size_type",
    label: "Google Shopping Size Type (Parked Variant — Read-Only)",
    owner: "PRODUCTVARIANT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  // Protected Third-Party App Data (Strictly Read-Only, Never Modified or Deleted)
  defineFieldContract({
    destinationKey: "app--3890849--eligibility.eligibility_details",
    namespace: "app--3890849--eligibility",
    key: "eligibility_details",
    label: "Shopify Eligibility Details (Protected — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "judgeme.badge",
    namespace: "judgeme",
    key: "badge",
    label: "Judge.me Badge (Protected — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "judgeme.review_widget_data",
    namespace: "judgeme",
    key: "review_widget_data",
    label: "Judge.me Review Widget Data (Protected — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  }),
  defineFieldContract({
    destinationKey: "judgeme.widget",
    namespace: "judgeme",
    key: "widget",
    label: "Judge.me Widget (Protected — Read-Only)",
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  })
]);

export const BENCH_V2_CONTRACTS_BY_DESTINATION = Object.freeze(
  BENCH_V2_FIELD_CONTRACTS.reduce((acc, contract) => {
    acc[contract.destinationKey] = contract;
    return acc;
  }, {})
);

export const BENCH_V2_BATCH_1_WRITABLE_DESTINATIONS = Object.freeze(
  new Set(
    BENCH_V2_FIELD_CONTRACTS
      .filter((c) => c.isWritableInBatch1 === true)
      .map((c) => c.destinationKey)
  )
);

export const BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS = Object.freeze(
  new Set(
    BENCH_V2_FIELD_CONTRACTS
      .filter((c) => c.isManualOnlyNoAi === true)
      .map((c) => c.destinationKey)
  )
);

export const BENCH_V2_DRAWER_GROUPS = Object.freeze(
  BENCH_V2_DRAWERS.map((drawer) =>
    Object.freeze({
      ...drawer,
      fields: Object.freeze(
        BENCH_V2_FIELD_CONTRACTS.filter((c) => c.drawerId === drawer.drawerId)
      )
    })
  )
);

// ==========================================================================
// PURE VALIDATION, BASELINE, APPROVAL & KEEP-ORIGINAL HELPERS
// ==========================================================================

const EXACT_PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const EXACT_PRODUCT_VARIANT_GID_REGEX = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const COLLECTION_DATE_PLACEHOLDER_REGEX = /^(n\/a|none|unknown)$/i;
const CANONICAL_DECIMAL_NUMBER_REGEX = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

const isBlankOrWhitespaceOnly = (str) =>
  typeof str !== "string" || str.trim() === "";

export function isExactProductGid(value) {
  return typeof value === "string" && EXACT_PRODUCT_GID_REGEX.test(value);
}

export function isExactProductVariantGid(value) {
  return typeof value === "string" && EXACT_PRODUCT_VARIANT_GID_REGEX.test(value);
}

export function getFieldContractByDestination(destinationKey) {
  if (typeof destinationKey !== "string" || destinationKey.trim() === "") return null;
  if (CANCELLED_INERT_DESTINATIONS.has(destinationKey)) return null;
  return BENCH_V2_CONTRACTS_BY_DESTINATION[destinationKey] || null;
}

/**
 * Reusable per-destination display formatter for user-facing Yes/No + actual meaning
 * conventions. Maps ONLY recognized boolean-like tokens ("true"/"false"/"Yes"/"No")
 * or established field-specific tokens while preserving descriptive treatment and
 * hardware text verbatim and leaving raw values unchanged internally and in Details.
 */
export function formatBenchV2ValueDisplay(destinationKey, rawVal, observedType = null) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return "";
  }
  const strVal = String(rawVal);
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

/**
 * Backwards-compatible export for OOAK display convention.
 */
export function formatOoakDisplayConvention(rawVal, observedType = null) {
  return formatBenchV2ValueDisplay("custom.is_ooak", rawVal, observedType);
}

/**
 * Resolves the appropriate option list for a contract, selecting type-aware
 * options for custom.is_ooak when its actual observed type is known.
 */
export function getContractOptionsForObservation(contract, baselineObs = null) {
  if (!contract || !contract.optionsKey) return [];
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

/**
 * Inspects completeness flags and destination-specific errors on baselineSnapshot.
 * Missing flags are treated as "unknown" (never assumed complete).
 */
function inspectSnapshotCompleteness(baselineSnapshot, destinationKey) {
  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return {
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null
    };
  }

  const mfFlag = baselineSnapshot.metafieldsReadComplete;
  const metafieldsCompleteState =
    mfFlag === true ? "complete" : mfFlag === false ? "incomplete" : "unknown";

  const defsFlag = baselineSnapshot.defsReadComplete;
  const defsCompleteState =
    defsFlag === true ? "complete" : defsFlag === false ? "incomplete" : "unknown";

  const liveDefEntry =
    baselineSnapshot.liveDefinitions &&
    typeof baselineSnapshot.liveDefinitions === "object" &&
    !Array.isArray(baselineSnapshot.liveDefinitions)
      ? baselineSnapshot.liveDefinitions[destinationKey]
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
    destinationDefError
  };
}

/**
 * Inspects single-variant identity, variant metafield read completeness,
 * and PRODUCTVARIANT definition read completeness on baselineSnapshot.
 * Never infers absence from unavailable, incomplete, zero-variant, or multi-variant states.
 */
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

/**
 * Computes a deterministic baseline observation and signature.
 * - Distinguishes missing/absent, null, empty string, and populated string values.
 * - Preserves positively observed raw evidence separately from completeness.
 * - Requires metafieldsReadComplete === true before inferring "absent" on a
 *   product metafield, and requires complete single-variant enumeration + exact
 *   ProductVariant GID + variantMetafieldsReadComplete === true before inferring
 *   "absent" on a variant metafield.
 * - Binds exact productId, owner, variantId (for PRODUCTVARIANT), destinationKey,
 *   presence, types, completeness, and rawValue into the signature.
 */
export function buildBaselineObservation(baselineSnapshot, destinationKey) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return Object.freeze({
      destinationKey: String(destinationKey || ""),
      owner: null,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "unknown_contract",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null,
      signature: "unavailable:unknown_contract"
    });
  }

  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "baseline_not_loaded",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null,
      signature: `unavailable:not_loaded:${contract.owner}::${contract.destinationKey}`
    });
  }

  const productGid = baselineSnapshot.productId;
  if (!isExactProductGid(productGid)) {
    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "invalid_product_gid",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null,
      signature: `unavailable:invalid_gid:${contract.owner}::${contract.destinationKey}`
    });
  }

  const completeness = inspectSnapshotCompleteness(baselineSnapshot, contract.destinationKey);

  // Variant-owned metafield baselines: require verified single-variant identity and
  // complete variant metafield read; never fabricate from product-level maps.
  if (contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native") {
    const varCompleteness = inspectVariantSnapshotCompleteness(
      baselineSnapshot,
      contract.destinationKey
    );
    const liveVarDefType =
      baselineSnapshot.liveVariantDefinitions?.[contract.destinationKey]?.type || null;

    if (varCompleteness.variantTargetStatus === "variants_read_incomplete") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "unknown_incomplete_read",
        rawValue: undefined,
        storedType: null,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:variants_incomplete_read:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });
    }

    if (varCompleteness.variantTargetStatus === "zero_variants") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "zero_variants_hold",
        rawValue: undefined,
        storedType: null,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:zero_variants:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });
    }

    if (varCompleteness.variantTargetStatus === "multiple_variants_ambiguous") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "multiple_variants_hold",
        rawValue: undefined,
        storedType: null,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:multiple_variants:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });
    }

    if (
      varCompleteness.variantTargetStatus !== "single_variant_verified" ||
      !isExactProductVariantGid(varCompleteness.variantId)
    ) {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "invalid_variant_gid",
        rawValue: undefined,
        storedType: null,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:invalid_variant_gid:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });
    }

    const verifiedVariantId = varCompleteness.variantId;
    const varMap = baselineSnapshot.currentVariantMetafields;

    if (!varMap || typeof varMap !== "object" || Array.isArray(varMap)) {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: verifiedVariantId,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "variant_baseline_unavailable",
        rawValue: undefined,
        storedType: null,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:variant:${productGid}::PRODUCTVARIANT::${verifiedVariantId}::${contract.destinationKey}`
      });
    }

    const hasProp = Object.prototype.hasOwnProperty.call(varMap, contract.destinationKey);
    const rawVal = hasProp ? varMap[contract.destinationKey] : undefined;
    const positiveEvidenceObserved = hasProp && rawVal !== undefined;
    const storedType =
      baselineSnapshot.currentVariantMetafieldTypes?.[contract.destinationKey] || null;

    if (!positiveEvidenceObserved && varCompleteness.metafieldsCompleteState !== "complete") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: verifiedVariantId,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "unknown_incomplete_read",
        rawValue: undefined,
        storedType,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: `unavailable:variant_incomplete_read:${productGid}::PRODUCTVARIANT::${verifiedVariantId}::${contract.destinationKey}`
      });
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
      metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
      defsCompleteState: varCompleteness.defsCompleteState,
      destinationDefError: varCompleteness.destinationDefError,
      signature: `${productGid}::PRODUCTVARIANT::${verifiedVariantId}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${liveVarDefType || "no_def_type"}::${varCompleteness.metafieldsCompleteState}::${varCompleteness.defsCompleteState}::${rawVal ?? ""}`
    });
  }

  if (contract.namespace === "native") {
    const nt = baselineSnapshot.nativeTargets;
    if (!nt || typeof nt !== "object") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: null,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "native_baseline_unavailable",
        rawValue: undefined,
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
    } else if (contract.destinationKey === "native_price") {
      isNativeFieldUnverified = nt.isComplete !== true || Boolean(nt.loadError);
      rawNative = nt.price;
    } else if (contract.destinationKey === "native_shipping_weight") {
      isNativeFieldUnverified = nt.isComplete !== true || Boolean(nt.loadError);
      rawNative = nt.shippingWeight;
    }

    if (isNativeFieldUnverified || rawNative === undefined) {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: null,
        variantTargetStatus: null,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: isNativeFieldUnverified ? "unknown_incomplete_read" : "absent",
        rawValue: undefined,
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
      metafieldsCompleteState: completeness.metafieldsCompleteState,
      defsCompleteState: completeness.defsCompleteState,
      destinationDefError: completeness.destinationDefError,
      signature: `${productGid}::${contract.destinationKey}::${presence}::${typeof rawNative === "object" ? JSON.stringify(rawNative) : (rawNative ?? "")}`
    });
  }

  const cm = baselineSnapshot.currentMetafields;
  if (!cm || typeof cm !== "object" || Array.isArray(cm)) {
    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "metafields_not_loaded",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
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

  // Critical Completeness Rule:
  // If a metafield is NOT positively observed in currentMetafields, we may ONLY infer
  // "absent" when metafieldsReadComplete === true. Missing/false completeness flags
  // remain "unknown_incomplete_read" with evidenceAvailable: false so partial reads
  // never manufacture absence. Positively observed raw values remain inspectable.
  if (!positiveEvidenceObserved && completeness.metafieldsCompleteState !== "complete") {
    return Object.freeze({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      variantId: null,
      variantTargetStatus: null,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "unknown_incomplete_read",
      rawValue: undefined,
      storedType,
      liveDefType,
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
    metafieldsCompleteState: completeness.metafieldsCompleteState,
    defsCompleteState: completeness.defsCompleteState,
    destinationDefError: completeness.destinationDefError,
    signature: `${productGid}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${liveDefType || "no_def_type"}::${completeness.metafieldsCompleteState}::${completeness.defsCompleteState}::${rawVal ?? ""}`
  });
}

/**
 * Evaluates whether a connected contract destination (PRODUCT or allowlisted
 * single-variant PRODUCTVARIANT) has complete, conflict-free baseline,
 * definition, and type evidence required to unlock write eligibility.
 */
export function evaluateDestinationTypeAndCompleteness({
  contract,
  baselineObs
}) {
  if (!contract || !baselineObs) {
    return {
      ready: false,
      code: "missing_contract_or_observation",
      verifiedActualType: null,
      reason: "Missing field contract or baseline observation."
    };
  }

  const isVariantOwner = contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native";

  if (!baselineObs.evidenceAvailable) {
    if (isVariantOwner) {
      if (baselineObs.presence === "multiple_variants_hold") {
        return {
          ready: false,
          code: "multiple_variants_hold",
          verifiedActualType: null,
          reason: `Product has multiple variants; "${contract.destinationKey}" is held read-only to prevent ambiguous variant targeting.`
        };
      }
      if (baselineObs.presence === "zero_variants_hold") {
        return {
          ready: false,
          code: "zero_variants_hold",
          verifiedActualType: null,
          reason: `Product has zero variants; "${contract.destinationKey}" cannot target a ProductVariant.`
        };
      }
      if (baselineObs.presence === "invalid_variant_gid") {
        return {
          ready: false,
          code: "invalid_variant_gid",
          verifiedActualType: null,
          reason: `Exact Shopify ProductVariant GID is required before authorizing writes on "${contract.destinationKey}".`
        };
      }
      if (baselineObs.presence === "unknown_incomplete_read") {
        return {
          ready: false,
          code: "incomplete_variant_metafield_read",
          verifiedActualType: null,
          reason: `Variant metafield or variant enumeration completeness is "${baselineObs.metafieldsCompleteState}" for "${contract.destinationKey}"; cannot infer absence or authorize writes until variantMetafieldsReadComplete === true.`
        };
      }
      return {
        ready: false,
        code: "missing_variant_baseline_evidence",
        verifiedActualType: null,
        reason: `Loaded single-variant baseline evidence is required for "${contract.destinationKey}" (current state: ${baselineObs.presence}).`
      };
    }

    const isUnknownRead = baselineObs.presence === "unknown_incomplete_read";
    return {
      ready: false,
      code: isUnknownRead ? "incomplete_metafield_read" : "missing_baseline_evidence",
      verifiedActualType: null,
      reason: isUnknownRead
        ? `Metafield read completeness is "${baselineObs.metafieldsCompleteState}" for "${contract.destinationKey}"; cannot infer absence or authorize writes until metafieldsReadComplete === true.`
        : `Loaded baseline evidence is required for "${contract.destinationKey}" (current state: ${baselineObs.presence}).`
    };
  }

  if (isVariantOwner) {
    if (
      baselineObs.variantTargetStatus !== "single_variant_verified" ||
      !isExactProductVariantGid(baselineObs.variantId)
    ) {
      return {
        ready: false,
        code: "unverified_single_variant_target",
        verifiedActualType: null,
        reason: `Single-variant target GID is not verified for "${contract.destinationKey}" (status: ${baselineObs.variantTargetStatus || "unknown"}).`
      };
    }
  }

  if (baselineObs.metafieldsCompleteState !== "complete") {
    return {
      ready: false,
      code: isVariantOwner ? "variant_metafields_read_not_complete" : "metafields_read_not_complete",
      verifiedActualType: null,
      reason: isVariantOwner
        ? `Variant metafield enumeration is "${baselineObs.metafieldsCompleteState}" (requires variantMetafieldsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
        : `Product metafield enumeration is "${baselineObs.metafieldsCompleteState}" (requires metafieldsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
    };
  }

  if (baselineObs.destinationDefError) {
    return {
      ready: false,
      code: "destination_definition_error",
      verifiedActualType: null,
      reason: `Definition/constraint error on "${contract.destinationKey}": ${baselineObs.destinationDefError}`
    };
  }

  if (baselineObs.defsCompleteState !== "complete") {
    return {
      ready: false,
      code: isVariantOwner ? "variant_definitions_read_not_complete" : "definitions_read_not_complete",
      verifiedActualType: null,
      reason: isVariantOwner
        ? `Live PRODUCTVARIANT metafield definition read is "${baselineObs.defsCompleteState}" (requires variantDefsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
        : `Live PRODUCT metafield definition read is "${baselineObs.defsCompleteState}" (requires defsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
    };
  }

  const liveDefType = baselineObs.liveDefType;
  const storedType = baselineObs.storedType;

  if (!liveDefType && !storedType) {
    return {
      ready: false,
      code: "missing_type_evidence",
      verifiedActualType: null,
      reason: `Neither live ${contract.owner} metafield definition nor stored metafield type is present for "${contract.destinationKey}". Guessing a type or creating a definition is forbidden.`
    };
  }

  if (liveDefType && storedType && liveDefType !== storedType) {
    return {
      ready: false,
      code: "live_vs_stored_type_conflict",
      verifiedActualType: null,
      reason: `Type conflict on "${contract.destinationKey}": live definition is "${liveDefType}" but stored metafield is "${storedType}".`
    };
  }

  const verifiedActualType = liveDefType || storedType;
  const allowedTypes = Array.isArray(contract.allowedTypes) && contract.allowedTypes.length > 0
    ? contract.allowedTypes
    : [contract.expectedType];

  if (!allowedTypes.includes(verifiedActualType)) {
    return {
      ready: false,
      code: "contract_type_mismatch",
      verifiedActualType: null,
      reason: `Type mismatch on "${contract.destinationKey}": contract allows [${allowedTypes.join(", ")}], but Shopify reports "${verifiedActualType}".`
    };
  }

  return {
    ready: true,
    code: "type_and_completeness_verified",
    verifiedActualType,
    reason: null
  };
}

/**
 * Validates a proposed value at the source against the Batch 1 contract and
 * live definition / stored type & completeness evidence. Never coerces, trims,
 * or guesses when required evidence is missing. Uses .trim() solely to test
 * whether the proposal is empty/whitespace-only.
 */
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

  // No silent clearing or blank deletion (.trim() is used ONLY to detect empty/whitespace-only input)
  if (isBlankOrWhitespaceOnly(proposedValue)) {
    return {
      valid: false,
      code: "blank_clear_forbidden",
      reason: `Blank or whitespace-only proposals are rejected for "${contract.destinationKey}" (silent clearing/deletion is forbidden).`
    };
  }

  const exactValue = proposedValue;

  // Type-specific validation using actual observed storage/definition type:
  // - Boolean custom.is_ooak accepts exact "true" or "false" only (never silently normalizing "Yes"/"No").
  // - number_decimal (e.g. custom.weight_grams) requires a finite non-negative decimal string
  //   that matches executeRepairPlan's String(parseFloat(val)) serialization verbatim so the
  //   writer never silently rewrites the approved string (e.g. stripping units, spaces, or trailing zeros).
  // - Text fields preserve exact untrimmed text and enforce maxLength & plain-text shape guards.
  if (verifiedActualType === "boolean") {
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

  // Compare exact untrimmed value against observed stored baseline without conflating absent/empty with a non-empty string
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
    baselineObservation: baselineObs,
    reason: isUnchangedFromStored
      ? "Proposed value is identical to the current stored baseline."
      : "Valid Batch 1 proposed change."
  };
}

/**
 * Creates an immutable exact-value approval record bound to the exact product,
 * owner, variantId (when owner === "PRODUCTVARIANT"), destinationKey, exact
 * untrimmed proposed string, verified actual type, and current baseline signature.
 * Any subsequent edit to the proposed value (including leading/trailing whitespace)
 * or change in baseline/variant identity invalidates it.
 */
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

  const record = Object.freeze({
    kind: "exact_value_approval",
    productId,
    owner: contract.owner,
    variantId: isVariantOwner ? obs.variantId : null,
    destinationKey: obs.destinationKey,
    approvedValue: validation.normalizedValue,
    verifiedType: validation.verifiedActualType,
    baselineSignature: obs.signature,
    approvedAt: new Date().toISOString()
  });

  return { ok: true, error: null, code: "approved", record };
}

/**
 * Verifies that an existing approval record still matches the exact product,
 * owner, variantId (for PRODUCTVARIANT), destination, exact untrimmed current
 * proposed value string, verified type, and live baseline signature.
 * Preserves backwards compatibility for existing PRODUCT approval records that
 * may omit `owner` / `variantId`.
 */
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

  return true;
}

/**
 * Creates a Keep Original decision record bound to the exact product,
 * owner, variantId (when owner === "PRODUCTVARIANT"), destinationKey, exact
 * untrimmed rejected proposal string, and observed baseline signature without
 * altering saved Shopify data.
 */
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
    if (keepOriginalRecord.variantId !== undefined && keepOriginalRecord.variantId !== null) {
      return false;
    }
  }

  return true;
}

/**
 * Pure row-state evaluator for any field across all 11 drawers.
 * Never hides fields and never auto-preapproves any proposal.
 */
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
  const usesMeaningDisplay = Boolean(contract.usesYesNoMeaningDisplay);

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
      } else if (typeAndCompleteness?.code === "destination_definition_error") {
        connectionStatus = "Blocked (Definition / Constraint Error)";
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
  }

  const baselineDisplayValue = usesMeaningDisplay
    ? formatBenchV2ValueDisplay(contract.destinationKey, baselineObs.rawValue, observedType)
    : (baselineObs.rawValue ?? "");

  const proposedDisplayValue = usesMeaningDisplay && hasNonEmptyProposal
    ? formatBenchV2ValueDisplay(contract.destinationKey, proposedValue, observedType)
    : proposedValue;

  return Object.freeze({
    contract,
    baselineObservation: baselineObs,
    baselineDisplayValue,
    options: getContractOptionsForObservation(contract, baselineObs),
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

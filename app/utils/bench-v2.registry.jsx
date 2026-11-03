// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 STATIC FIELD & DRAWER REGISTRY
// File: app/utils/bench-v2.registry.jsx
// Pure browser-safe static catalog module: zero React hooks/effects, zero storage,
// zero GraphQL/network calls, zero server-only imports.
// ==========================================================================

import { DROPDOWN_OPTIONS, collectionLocationOptions } from "./meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS,
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS
} from "./meta-injector.standardized.jsx";

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

// Explicit replacement-bench-local allowlist of finite retained Drawer 10 PRODUCT
// standardized reference destinations (18 keys; excludes authenticity, necklace-design, rarity).
export const BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS = Object.freeze(
  new Set(
    SUPPORTED_STANDARDIZED_REFERENCE_KEYS.map((k) => `shopify.${k}`)
  )
);

// Explicit replacement-bench-local allowlist of the 4 verified Drawer 9 PRODUCT
// native text/HTML/SEO destinations connected for exact-value approval.
export const BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS = Object.freeze(
  new Set([
    "native_title",
    "native_description",
    "native_seo_title",
    "native_seo_description"
  ])
);

// Explicit Bench V2 writer opt-in markers and unheld custom destination sets
// shared with app/routes/app.meta-injector-api.jsx.
export const BENCH_V2_WRITER_OPT_IN_FIELD = "benchV2OptIn";
export const BENCH_V2_WRITER_OPT_IN_VALUE = "true";

export const BENCH_V2_OPT_IN_UNHELD_BARE_KEYS = Object.freeze(
  new Set([
    "is_ooak",
    "stone_family",
    "cut_and_shape",
    "stone_shape",
    "color",
    "whole_product_weight_grams",
    "chain_cord_length_in",
    "accessory_dimensions_mm",
    "fitting_opening_mm"
  ])
);

export const BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS = Object.freeze(
  new Set([
    "custom.is_ooak",
    "custom.stone_family",
    "custom.cut_and_shape",
    "custom.stone_shape",
    "custom.color",
    "custom.whole_product_weight_grams",
    "custom.chain_cord_length_in",
    "custom.accessory_dimensions_mm",
    "custom.fitting_opening_mm"
  ])
);

// Single shared declaration of reviewed exact destination type contracts
// (owned here and reusable by app/routes/app.meta-injector-api.jsx so no parallel allowlist is maintained).
export const REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS = Object.freeze({
  "custom.rock_composition": "single_line_text_field",
  "custom.crystal_system": "single_line_text_field",
  "custom.mineral_class": "single_line_text_field",
  "custom.rock_formation": "single_line_text_field",
  "custom.geological_era": "single_line_text_field",
  "custom.is_one_of_a_kind": "single_line_text_field",
  "custom.collection_date": "single_line_text_field",
  "custom.cut_type": "single_line_text_field",
  "custom.secondary_colors": "single_line_text_field",
  "custom.tenacity": "single_line_text_field",
  "custom.color_pattern": "single_line_text_field",
  "custom.wire_material": "single_line_text_field",
  "custom.jewelry_type": "single_line_text_field",
  "custom.seo_title": "single_line_text_field",
  "custom.chain_material": "single_line_text_field",
  "custom.chain_link_type": "single_line_text_field",
  "custom.jewelry_finding_type": "single_line_text_field",
  "custom.google_product_category": "single_line_text_field",
  "custom.whole_product_weight_grams": "number_decimal",
  "custom.chain_cord_length_in": "single_line_text_field",
  "custom.accessory_dimensions_mm": "single_line_text_field",
  "custom.fitting_opening_mm": "single_line_text_field"
});

// Exact 54 bare provenance keys used by Bench V2 AI Scan (excluding cancelled
// overall_solid_length_in and legacy geological_era).
export const ENGINE_ALLOWED_PROVENANCE_BARE_KEYS = Object.freeze([
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
  "is_ooak",
  "mohs_hardness",
  "specific_gravity",
  "crystal_system",
  "luster",
  "cleavage",
  "fracture_pattern",
  "diaphaneity",
  "tenacity",
  "mineral_class",
  "rock_composition",
  "rock_formation",
  "geological_age"
]);

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
    description: "Manual bench measurements: stone dimensions (mm), stone weight (grams), actual whole-product weight (g), chain or cord length (in), accessory exterior dimensions (mm), and fitting/opening/grip dimensions (mm) connected for manual entry and exact-value approval (excluded from AI scan; overall-solid-length omitted as cancelled)."
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
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Partial Drawer 9 text & SEO connection: 6 product-owned destinations connected for exact-value approval (manual-only native_title, native_description, custom.generated_description, native_seo_description; independently reviewed native_seo_title and custom.seo_title), while per-image media alts (native_image_alt) and custom.alt_text remain read-only descriptors and price/shipping weight remain task-restricted read-only."
  }),
  Object.freeze({
    drawerId: "standardized_attributes",
    drawerNumber: 10,
    heading: "10. Standardized Attributes (shopify.*)",
    subHarness: "SUB_HARNESS_5",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Connected standardized taxonomy reference attributes (18 retained shopify.* destinations): requires complete reads, live PRODUCT list.metaobject_reference definition, product category constraint eligibility, verified restricted Metaobject definition membership for all proposed GIDs, and exact-value approval."
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

const VISION_CANDIDATE_STANDARDIZED_KEYS = new Set(ALLOWED_VISION_CANDIDATE_KEYS);
const SUPPORTED_STANDARDIZED_KEY_SET = new Set(SUPPORTED_STANDARDIZED_REFERENCE_KEYS);

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
    (spec.owner === "PRODUCT" &&
      spec.namespace === "native" &&
      BENCH_V2_CONNECTED_NATIVE_PRODUCT_DESTINATIONS.has(spec.destinationKey)) ||
    (spec.owner === "PRODUCT" &&
      spec.namespace === "shopify" &&
      SUPPORTED_STANDARDIZED_KEY_SET.has(spec.key) &&
      !EXCLUDED_STANDARDIZED_KEYS.has(spec.key) &&
      BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS.has(spec.destinationKey)) ||
    (spec.owner === "PRODUCTVARIANT" &&
      BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(spec.destinationKey));

  const isBatch1Writable =
    spec.batchStage === BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED &&
    spec.writeCapability === BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL &&
    isEligibleOwnerAndDestination;

  const allowedTypes = Array.isArray(spec.allowedTypes) && spec.allowedTypes.length > 0
    ? Object.freeze([...spec.allowedTypes])
    : Object.freeze([spec.expectedType]);

  const rawReviewedContractType = Object.prototype.hasOwnProperty.call(
    REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
    spec.destinationKey
  )
    ? REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS[spec.destinationKey]
    : null;

  const reviewedExactContractType =
    Boolean(isBatch1Writable) &&
    spec.owner === "PRODUCT" &&
    spec.namespace === "custom" &&
    spec.destinationKey !== "custom.is_ooak" &&
    allowedTypes.length === 1 &&
    ((allowedTypes[0] === "single_line_text_field" &&
      rawReviewedContractType === "single_line_text_field") ||
      (spec.destinationKey === "custom.whole_product_weight_grams" &&
        allowedTypes[0] === "number_decimal" &&
        rawReviewedContractType === "number_decimal"))
      ? rawReviewedContractType
      : null;

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
    reviewedExactContractType,
    requiresLiveDefinitionOrStoredTypeEvidence: spec.requiresLiveDefinitionOrStoredTypeEvidence !== false,
    maxLength: typeof spec.maxLength === "number" ? spec.maxLength : null,
    control: spec.control || "text",
    optionsKey: spec.optionsKey || null,
    canonicalTarget: spec.canonicalTarget || null,
    purposeNote: spec.purposeNote || null,
    unresolvedPolicyQuestion: spec.unresolvedPolicyQuestion || null
  });
}

function defineBatch1CustomField(drawerId, subHarness, key, label, purposeNote, overrides = {}) {
  return defineFieldContract({
    destinationKey: `custom.${key}`,
    namespace: "custom",
    key,
    label,
    owner: "PRODUCT",
    drawerId,
    subHarness,
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote,
    ...overrides
  });
}

function defineCompatField(drawerId, subHarness, owner, namespace, key, label, canonicalTarget, purposeNote, overrides = {}) {
  return defineFieldContract({
    destinationKey: `${namespace}.${key}`,
    namespace,
    key,
    label,
    owner,
    drawerId,
    subHarness,
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_COMPATIBILITY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.COMPATIBILITY_INSPECTION_ONLY,
    expectedType: "single_line_text_field",
    canonicalTarget,
    purposeNote,
    ...overrides
  });
}

function defineMeasurementHoldField(key, label, expectedType, purposeNote) {
  return defineFieldContract({
    destinationKey: `custom.${key}`,
    namespace: "custom",
    key,
    label,
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    isManualOnlyNoAi: true,
    expectedType,
    purposeNote
  });
}

function defineParkedField(owner, namespace, key, label, expectedType = "single_line_text_field", overrides = {}) {
  return defineFieldContract({
    destinationKey: `${namespace}.${key}`,
    namespace,
    key,
    label,
    owner,
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType,
    ...overrides
  });
}

function defineProtectedAppField(namespace, key, label) {
  return defineFieldContract({
    destinationKey: `${namespace}.${key}`,
    namespace,
    key,
    label,
    owner: "PRODUCT",
    drawerId: "parked_excluded_protected",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  });
}

// ==========================================================================
// AUTHORITATIVE FIELD CONTRACTS (ALL 11 DRAWERS)
// ==========================================================================

export const BENCH_V2_FIELD_CONTRACTS = Object.freeze([
  // DRAWER 1: IDENTITY (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  defineBatch1CustomField(
    "identity",
    "SUB_HARNESS_1",
    "piece_name",
    "Piece Name",
    "Individual piece identifier (never the full 3-part Shopify marketing title)."
  ),
  defineBatch1CustomField(
    "identity",
    "SUB_HARNESS_1",
    "material",
    "Dominant Material",
    "Dominant material of the piece (distinct from custom.stone_family; preserves existing option list; never auto-populated from stone_family and never overwritten with hardware/metal/plating strings).",
    { optionsKey: "stone_family" }
  ),
  defineBatch1CustomField(
    "identity",
    "SUB_HARNESS_1",
    "is_one_of_a_kind",
    "Is One of a Kind (custom.is_one_of_a_kind)",
    "Intentional OOAK destination #1 (single_line_text_field). Uses the same factual OOAK answer as custom.is_ooak with no second lookup; requires its own exact-value approval with no automatic companion write.",
    {
      usesYesNoMeaningDisplay: true,
      allowedTypes: ["single_line_text_field"],
      optionsKey: "is_one_of_a_kind"
    }
  ),
  defineBatch1CustomField(
    "identity",
    "SUB_HARNESS_1",
    "is_ooak",
    "Is OOAK (custom.is_ooak)",
    "Intentional OOAK destination #2. Preserves actual observed storage/definition type on each product ('boolean' accepts exact 'true'/'false'; 'single_line_text_field' preserves exact text) while displaying user-facing Yes/No convention. Requires its own exact-value approval with no automatic companion write.",
    {
      usesYesNoMeaningDisplay: true,
      allowedTypes: ["single_line_text_field", "boolean"],
      optionsKey: "is_ooak"
    }
  ),
  defineBatch1CustomField(
    "identity",
    "SUB_HARNESS_1",
    "stone_family",
    "Stone Family",
    "Base stone family (e.g. Red Jasper -> Jasper). Distinct from Dominant Material (custom.material) and Primary Medium (custom.primary_medium); requires its own exact-value approval and never auto-populates or overwrites those other destinations.",
    { optionsKey: "stone_family", canonicalTarget: null }
  ),
  defineCompatField(
    "identity",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "primary_medium",
    "Primary Medium (Saved Compatibility — Read-Only)",
    "custom.material",
    "Inspectable saved primary_medium value. Never dual-written or promoted into custom.material if contaminated with hardware terms."
  ),

  // DRAWER 2: ORIGIN AND COLLECTION (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "origin_location",
    "Origin Location",
    "Geological or geographic origin location of the material."
  ),
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "origin_page_handle",
    "Origin Page Handle",
    "Sole canonical editable origin page handle."
  ),
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "collection_name",
    "Collection Name",
    "Studio collection or series name.",
    { optionsKey: "collection_name" }
  ),
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "collection_location",
    "Collection Location",
    "Specific field/river/ranch collecting location."
  ),
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "found_object",
    "Found Object",
    "Wild-found vs. purchased provenance.",
    { usesYesNoMeaningDisplay: true, optionsKey: "found_object" }
  ),
  defineBatch1CustomField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "collection_date",
    "Collection Date",
    "Collection date string. Blank/absent stays absent; placeholder tokens ('N/A', 'None', 'Unknown') are rejected at source.",
    { isManualOnlyNoAi: true }
  ),
  defineCompatField(
    "origin_and_collection",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "origin_handle",
    "Origin Handle (Saved Compatibility — Read-Only)",
    "custom.origin_page_handle",
    "Inspectable legacy alias; canonical writes target custom.origin_page_handle only."
  ),

  // DRAWER 3: TREATMENT (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  defineBatch1CustomField(
    "treatment",
    "SUB_HARNESS_1",
    "treatment_status",
    "Treatment Status",
    "Detailed treatment disclosure text.",
    { usesYesNoMeaningDisplay: true }
  ),
  defineBatch1CustomField(
    "treatment",
    "SUB_HARNESS_1",
    "treated",
    "Treated",
    "Standardized studio treatment value (e.g. Untreated — Natural).",
    { usesYesNoMeaningDisplay: true, optionsKey: "treated" }
  ),

  // DRAWER 4: APPEARANCE AND CHARACTER (SUB_HARNESS_1 — BATCH 1 IMPLEMENTED)
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "cut_and_shape",
    "Cut and Shape",
    "Detailed cut and shape description (distinct from broader custom.stone_shape). Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "stone_shape",
    "Stone Shape",
    "Broader stone shape classification. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "surface_finish",
    "Surface Finish",
    "Lapidary surface polish/finish.",
    { optionsKey: "surface_finish" }
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "color",
    "Color",
    "General color descriptor. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "primary_color",
    "Primary Color",
    "Dominant visual color of the piece."
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "secondary_colors",
    "Secondary Colors",
    "Secondary/accent colors as plain text (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "color_pattern",
    "Color Pattern",
    "Visual patterning (banding, brecciated, dendritic, etc.) as plain text."
  ),
  defineCompatField(
    "appearance_and_character",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "cut_type",
    "Cut Type (Saved Compatibility — Read-Only)",
    "custom.cut_and_shape",
    "Inspectable compatibility field; canonical writes target custom.cut_and_shape."
  ),

  // DRAWER 5: MANUAL MEASUREMENTS (SUB_HARNESS_2 — CONNECTED FOR MANUAL ENTRY)
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "dimensions_mm",
    "Dimensions (mm)",
    "Manual caliper measurement in millimeters (e.g. 38 x 24 x 6 mm). Excluded from AI generation/staging; requires live definition or stored type verification and exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "weight_grams",
    "Weight (grams)",
    "Manual scale weight in grams (number_decimal). Excluded from AI generation/staging; requires canonical finite non-negative decimal representation matching writer serialization and exact-value approval.",
    {
      isManualOnlyNoAi: true,
      expectedType: "number_decimal",
      allowedTypes: ["number_decimal"],
      maxLength: null
    }
  ),
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "whole_product_weight_grams",
    "Actual Whole-Product Weight (g)",
    "Manual scale weight of the complete assembled piece in grams (number_decimal; distinct from stone custom.weight_grams and shipping weight). Excluded from AI generation/staging; requires canonical finite non-negative decimal representation matching writer serialization and independent exact-value approval.",
    {
      isManualOnlyNoAi: true,
      expectedType: "number_decimal",
      allowedTypes: ["number_decimal"],
      maxLength: null
    }
  ),
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "chain_cord_length_in",
    "Chain or Cord Length (in)",
    "Manual chain or cord length measurement in inches (single_line_text_field, max 255 chars), preserving adjustable/extender notation. Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "accessory_dimensions_mm",
    "Accessory Exterior Dimensions (mm)",
    "Manual labeled exterior dimensions/width/thickness of accessory or setting in millimeters (single_line_text_field, max 255 chars; distinct from stone custom.dimensions_mm). Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_measurements",
    "SUB_HARNESS_2",
    "fitting_opening_mm",
    "Fitting / Opening / Grip Dimensions (mm)",
    "Manual labeled passage/bail opening/grip/peg/hole measurements in millimeters (single_line_text_field, max 255 chars; distinct from stone custom.dimensions_mm and custom.accessory_dimensions_mm). Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),

  // DRAWER 6: CONDITIONAL SETTING/ACCESSORY FACTS (SUB_HARNESS_2 — CONNECTED)
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "secondary_medium",
    "Secondary Medium",
    "Secondary medium (setting/hardware metal or material) when applicable; never overwrites stone identity."
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "jewelry_type",
    "Jewelry Type",
    "Jewelry type classification (e.g. Pendant, Necklace, Artisan jewelry, N/A)."
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "setting_ready",
    "Setting Ready",
    "Whether the piece is setting-ready or mounted/ready to wear (preserves exact descriptive text or boolean-like text values).",
    { usesYesNoMeaningDisplay: true, optionsKey: "setting_ready" }
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "bail_included",
    "Bail Included",
    "Whether a bail is included and/or its specific descriptive type (e.g. Silver Plated Pinch Bail).",
    { usesYesNoMeaningDisplay: true, optionsKey: "bail_included" }
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "chain_material",
    "Chain Material",
    "Included necklace chain or cord material.",
    { optionsKey: "chain_material" }
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "chain_link_type",
    "Chain Link Type",
    "Chain link or cord type (e.g. Cord, Snake Chain)."
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "jewelry_finding_type",
    "Jewelry Finding Type",
    "Specific finding or mounting hardware (e.g. Silver Plated Pinch Bail, Glue-On Bail, Assorted Glue-In Setting)."
  ),
  defineBatch1CustomField(
    "conditional_setting_accessory",
    "SUB_HARNESS_2",
    "wire_material",
    "Wire Material",
    "Wire material when wire-wrapped."
  ),

  // DRAWER 7: GEOLOGY (SUB_HARNESS_3 — CONNECTED)
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "mohs_hardness",
    "Mohs Hardness",
    "Mohs hardness scale value or range (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "specific_gravity",
    "Specific Gravity",
    "Specific gravity value or range (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "crystal_system",
    "Crystal System",
    "Crystal system classification as plain text (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "luster",
    "Luster",
    "Mineralogical luster (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "cleavage",
    "Cleavage",
    "Mineralogical cleavage (single_line_text_field; 'None' is a valid mineralogical value)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "fracture_pattern",
    "Fracture Pattern",
    "Mineralogical fracture pattern (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "diaphaneity",
    "Diaphaneity",
    "Light transmission / diaphaneity (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "tenacity",
    "Tenacity",
    "Mineralogical tenacity (single_line_text_field, e.g. Brittle)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "mineral_class",
    "Mineral Class",
    "Mineral class as plain text (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "rock_composition",
    "Rock Composition",
    "Rock or mineral composition as plain text (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "rock_formation",
    "Rock Formation",
    "Geological rock formation as plain text (single_line_text_field)."
  ),
  defineCompatField(
    "geology",
    "SUB_HARNESS_3",
    "PRODUCT",
    "custom",
    "geological_era",
    "Geological Era (Saved Compatibility — Read-Only)",
    "shopify.geological-era",
    "Legacy custom geological_era field kept read-only for inspection only; authoritative ERA dropdown is shopify.geological-era and AGE text is custom.geological_age.",
    { maxLength: 255 }
  ),
  defineBatch1CustomField(
    "geology",
    "SUB_HARNESS_3",
    "geological_age",
    "Geological Age",
    "Library geological age text (single_line_text_field; distinct from shopify.geological-era and custom.geological_era; 'Variable' can be valid)."
  ),

  // DRAWER 8: OTHER & CHANNEL ATTRIBUTES (SUB_HARNESS_3 — CONNECTED IN BENCH V2)
  defineBatch1CustomField(
    "other_channel",
    "SUB_HARNESS_3",
    "google_product_category",
    "Google Product Category",
    "Product-level Google product category text (custom.google_product_category). Requires live definition or stored type verification and exact-value approval.",
    { optionsKey: "google_product_category" }
  ),
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
  defineCompatField(
    "other_channel",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "age_group",
    "Google Age Group (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.age_group",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.age_group definition; active variant definition is mm-google-shopping.age_group)."
  ),
  defineCompatField(
    "other_channel",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "condition",
    "Google Condition (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.condition",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.condition definition; active variant definition is mm-google-shopping.condition)."
  ),
  defineCompatField(
    "other_channel",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "target_gender",
    "Google Target Gender (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.gender",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.target_gender definition; active variant definition is mm-google-shopping.gender)."
  ),
  defineCompatField(
    "other_channel",
    "SUB_HARNESS_3",
    "PRODUCT",
    "custom",
    "target_gender",
    "Target Gender (Custom Compatibility — Read-Only)",
    "google.target_gender",
    "Inspectable product-level custom.target_gender compatibility value; never auto-migrated or copied."
  ),

  // DRAWER 9: NATIVE, SEO, DESCRIPTION & MEDIA ALTS (SUB_HARNESS_4 — TEXT/SEO CONNECTED, MEDIA & PRICE/WEIGHT READ-ONLY)
  defineFieldContract({
    destinationKey: "native_title",
    namespace: "native",
    key: "native_title",
    label: "Native Product Title (product.title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_title",
    allowedTypes: ["native", "native_title"],
    maxLength: 255,
    purposeNote: "Native Shopify product title (product.title, max 255 chars). Distinct from custom.piece_name; manual entry and exact-value approval only."
  }),
  defineFieldContract({
    destinationKey: "native_description",
    namespace: "native",
    key: "native_description",
    label: "Native Product Description HTML (product.descriptionHtml)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_html",
    allowedTypes: ["native", "native_html"],
    maxLength: 10000,
    control: "multiline",
    purposeNote: "Independent destination from custom.generated_description; manual entry and exact-value approval only (max 10,000 chars)."
  }),
  defineFieldContract({
    destinationKey: "custom.generated_description",
    namespace: "custom",
    key: "generated_description",
    label: "Generated Description Metafield (custom.generated_description)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "multi_line_text_field",
    allowedTypes: ["multi_line_text_field"],
    maxLength: 10000,
    control: "multiline",
    canonicalTarget: "native_description",
    purposeNote: "Independent destination from native_description; requires live definition or stored type multi_line_text_field and its own exact-value approval (max 10,000 chars)."
  }),
  defineFieldContract({
    destinationKey: "native_seo_title",
    namespace: "native",
    key: "native_seo_title",
    label: "Native SEO Title (product.seo.title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "native_seo_title",
    allowedTypes: ["native", "native_seo_title"],
    maxLength: 70,
    purposeNote: "Independent destination from custom.seo_title (max 70 chars); requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "custom.seo_title",
    namespace: "custom",
    key: "seo_title",
    label: "SEO Title Metafield (custom.seo_title)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    expectedType: "single_line_text_field",
    allowedTypes: ["single_line_text_field"],
    maxLength: 70,
    canonicalTarget: "native_seo_title",
    purposeNote: "Independent destination from native_seo_title (max 70 chars); requires its own exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "native_seo_description",
    namespace: "native",
    key: "native_seo_description",
    label: "Native SEO Meta Description (product.seo.description)",
    owner: "PRODUCT",
    drawerId: "native_seo_description_media",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_seo_description",
    allowedTypes: ["native", "native_seo_description"],
    maxLength: 160,
    control: "multiline",
    purposeNote: "Native Shopify SEO meta description (product.seo.description, max 160 chars). Manual entry and exact-value approval only."
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

  // DRAWER 10: STANDARDIZED ATTRIBUTES (shopify.* — SUB_HARNESS_5 — CONNECTED REFERENCE HARNESS)
  ...STANDARDIZED_SHOPIFY_KEYS.filter((k) => !EXCLUDED_STANDARDIZED_KEYS.has(k)).map((k) => {
    const isVisionCandidateKey = VISION_CANDIDATE_STANDARDIZED_KEYS.has(k);
    const isSupportedRefKey = SUPPORTED_STANDARDIZED_KEY_SET.has(k);
    return defineFieldContract({
      destinationKey: `shopify.${k}`,
      namespace: "shopify",
      key: k,
      label: `Shopify Standardized: ${k}`,
      owner: "PRODUCT",
      drawerId: "standardized_attributes",
      subHarness: "SUB_HARNESS_5",
      batchStage: isSupportedRefKey
        ? BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED
        : BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
      writeCapability: isSupportedRefKey
        ? BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL
        : BENCH_V2_WRITE_CAPABILITY.STANDARDIZED_REFERENCE_LOCKED,
      isManualOnlyNoAi: !isVisionCandidateKey,
      expectedType: "list.metaobject_reference",
      allowedTypes: ["list.metaobject_reference"],
      maxLength: null,
      purposeNote: isSupportedRefKey
        ? "Standardized taxonomy reference attribute (list.metaobject_reference). Requires complete reads, live PRODUCT definition, category constraint eligibility, verified restricted Metaobject definition membership for all proposed GIDs, and exact-value approval."
        : "Read-only standardized taxonomy attribute."
    });
  }),

  // DRAWER 11: PARKED, EXCLUDED & PROTECTED INVENTORY (READ-ONLY)
  defineParkedField(
    "PRODUCT",
    "custom",
    "origin_story",
    "Origin Story (Parked / Source Context — Read-Only)",
    "multi_line_text_field",
    {
      control: "multiline",
      unresolvedPolicyQuestion: "Marked EXCLUDED_INPUT in constants.jsx but listed in ALLOWED_TAB3_KEYS in legacy API; kept read-only to preserve saved story text until explicitly decided."
    }
  ),
  defineParkedField(
    "PRODUCT",
    "custom",
    "honest_flaws_and_character",
    "Honest Flaws and Character (Parked — Read-Only)",
    "multi_line_text_field",
    {
      control: "multiline",
      unresolvedPolicyQuestion: "Marked EXCLUDED_INPUT in constants.jsx but listed in ALLOWED_TAB3_KEYS in legacy API; kept read-only to preserve saved character notes until explicitly decided."
    }
  ),
  defineParkedField("PRODUCT", "custom", "character_marks", "Character Marks (Parked — Read-Only)", "list.single_line_text_field", { control: "multiline" }),
  defineParkedField("PRODUCT", "custom", "rescued_by", "Rescued By (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "official_name", "Official Name (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "stone_story", "Stone Story (Parked — Read-Only)", "list.single_line_text_field", { control: "multiline" }),
  defineParkedField("PRODUCT", "custom", "artist_notes", "Artist Notes (Parked — Read-Only)", "multi_line_text_field", { control: "multiline" }),
  defineParkedField("PRODUCT", "custom", "bench_notes", "Bench Notes (Parked — Read-Only)", "multi_line_text_field", { control: "multiline" }),
  defineParkedField("PRODUCT", "custom", "handcrafted_by", "Handcrafted By (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "primary_use", "Primary Use (Parked — Read-Only)", "single_line_text_field", { canonicalTarget: "shopify.product-use" }),
  defineParkedField("PRODUCT", "custom", "necklace_design", "Necklace Design (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "authenticity", "Authenticity (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "rarity", "Rarity (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "custom_product", "Custom Product (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "age_group", "Age Group Custom (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "condition", "Condition Custom (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "price", "Custom Price Metafield (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "custom", "story_theme", "Story Theme (Parked — Read-Only)"),
  defineParkedField("PRODUCT", "shopify", "authenticity", "Shopify Authenticity (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("PRODUCT", "shopify", "necklace-design", "Shopify Necklace Design (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("PRODUCT", "shopify", "rarity", "Shopify Rarity (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("PRODUCT", "app--3026047", "conversation_starters", "App Conversation Starters (Parked — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "global", "harmonized_system_code", "Harmonized System Code (Parked Variant Customs Code — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "mpn", "Google Shopping MPN (Excluded Variant Field — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "custom_label_0", "Google Shopping Custom Label 0 (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "custom_label_1", "Google Shopping Custom Label 1 (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "custom_label_2", "Google Shopping Custom Label 2 (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "custom_label_3", "Google Shopping Custom Label 3 (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "custom_label_4", "Google Shopping Custom Label 4 (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "size_system", "Google Shopping Size System (Parked Variant — Read-Only)"),
  defineParkedField("PRODUCTVARIANT", "mm-google-shopping", "size_type", "Google Shopping Size Type (Parked Variant — Read-Only)"),
  defineProtectedAppField("app--3890849--eligibility", "eligibility_details", "Shopify Eligibility Details (Protected — Read-Only)"),
  defineProtectedAppField("judgeme", "badge", "Judge.me Badge (Protected — Read-Only)"),
  defineProtectedAppField("judgeme", "review_widget_data", "Judge.me Review Widget Data (Protected — Read-Only)"),
  defineProtectedAppField("judgeme", "widget", "Judge.me Widget (Protected — Read-Only)")
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

export const MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS = Object.freeze(
  new Set([
    ...BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
    ...BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
    "custom.dimensions_mm",
    "custom.weight_grams",
    "custom.whole_product_weight_grams",
    "custom.chain_cord_length_in",
    "custom.accessory_dimensions_mm",
    "custom.fitting_opening_mm",
    "custom.collection_date",
    "mm-google-shopping.age_group",
    "mm-google-shopping.condition",
    "mm-google-shopping.gender",
    "native_title",
    "native_description",
    "custom.generated_description",
    "native_seo_description"
  ])
);

export function isManualOnlyNoAiDestination(destinationKey, contract = null) {
  if (!destinationKey || typeof destinationKey !== "string") return false;
  if (MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS.has(destinationKey)) return true;
  if (contract && (contract.isManualOnlyNoAi === true || contract.drawerId === "manual_measurements")) {
    return true;
  }
  return false;
}

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

export function getFieldContractByDestination(destinationKey) {
  if (typeof destinationKey !== "string" || destinationKey.trim() === "") return null;
  if (CANCELLED_INERT_DESTINATIONS.has(destinationKey)) return null;
  return BENCH_V2_CONTRACTS_BY_DESTINATION[destinationKey] || null;
}
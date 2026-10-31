// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 PURE FIELD & DRAWER CONTRACT
// File: app/utils/bench-v2.contract.jsx
// Pure browser-safe contract module: zero React hooks/effects, zero storage,
// zero GraphQL/network calls, zero server-only imports.
// ==========================================================================

import { DROPDOWN_OPTIONS, collectionLocationOptions } from "./meta-injector.constants.jsx";
import { ALLOWED_VISION_CANDIDATE_KEYS } from "./meta-injector.standardized.jsx";

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
    "color"
  ])
);

export const BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS = Object.freeze(
  new Set([
    "custom.is_ooak",
    "custom.stone_family",
    "custom.cut_and_shape",
    "custom.stone_shape",
    "custom.color"
  ])
);

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

const FUTURE_BATCH_3_CANDIDATE_STANDARDIZED_KEYS = new Set(ALLOWED_VISION_CANDIDATE_KEYS);

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
  defineMeasurementHoldField(
    "whole_product_weight_grams",
    "Actual Whole-Product Weight (g) (Unverified Hold)",
    "number_decimal",
    "Capability #59: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  ),
  defineMeasurementHoldField(
    "chain_cord_length_in",
    "Chain or Cord Length (in) (Unverified Hold)",
    "single_line_text_field",
    "Capability #60: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  ),
  defineMeasurementHoldField(
    "accessory_dimensions_mm",
    "Accessory Exterior Dimensions (mm) (Unverified Hold)",
    "single_line_text_field",
    "Capability #61: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
  ),
  defineMeasurementHoldField(
    "fitting_opening_mm",
    "Fitting / Opening / Grip Dimensions (mm) (Unverified Hold)",
    "single_line_text_field",
    "Capability #62: storageVerified=false, writerVerified=false. Held read-only pending supported Shopify definition and writer evidence."
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

  // DRAWER 9: NATIVE, SEO, DESCRIPTION & MEDIA ALTS (SUB_HARNESS_4 — FUTURE BATCH 3)
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

  // DRAWER 10: STANDARDIZED ATTRIBUTES (shopify.* — SUB_HARNESS_5 — FUTURE BATCH 3)
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
    "mm-google-shopping.gender"
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

export function formatOoakDisplayConvention(rawVal, observedType = null) {
  return formatBenchV2ValueDisplay("custom.is_ooak", rawVal, observedType);
}

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

function makeUnavailableObservation({
  destinationKey,
  owner = null,
  variantId = null,
  variantTargetStatus = null,
  presence,
  storedType = null,
  liveDefType = null,
  metafieldsCompleteState = "unknown",
  defsCompleteState = "unknown",
  destinationDefError = null,
  signature
}) {
  return Object.freeze({
    destinationKey,
    owner,
    variantId,
    variantTargetStatus,
    evidenceAvailable: false,
    positiveEvidenceObserved: false,
    presence,
    rawValue: undefined,
    storedType,
    liveDefType,
    metafieldsCompleteState,
    defsCompleteState,
    destinationDefError,
    signature
  });
}

export function buildBaselineObservation(baselineSnapshot, destinationKey) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return makeUnavailableObservation({
      destinationKey: String(destinationKey || ""),
      presence: "unknown_contract",
      signature: "unavailable:unknown_contract"
    });
  }

  if (!baselineSnapshot || typeof baselineSnapshot !== "object") {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "baseline_not_loaded",
      signature: `unavailable:not_loaded:${contract.owner}::${contract.destinationKey}`
    });
  }

  const productGid = baselineSnapshot.productId;
  if (!isExactProductGid(productGid)) {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "invalid_product_gid",
      signature: `unavailable:invalid_gid:${contract.owner}::${contract.destinationKey}`
    });
  }

  const completeness = inspectSnapshotCompleteness(baselineSnapshot, contract.destinationKey);

  // Variant-owned metafield baselines
  if (contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native") {
    const varCompleteness = inspectVariantSnapshotCompleteness(
      baselineSnapshot,
      contract.destinationKey
    );
    const liveVarDefType =
      baselineSnapshot.liveVariantDefinitions?.[contract.destinationKey]?.type || null;

    const makeVarUnavailable = (presence, sigTag, varId = null, storedT = null) =>
      makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        variantId: varId,
        variantTargetStatus: varCompleteness.variantTargetStatus,
        presence,
        storedType: storedT,
        liveDefType: liveVarDefType,
        metafieldsCompleteState: varCompleteness.metafieldsCompleteState,
        defsCompleteState: varCompleteness.defsCompleteState,
        destinationDefError: varCompleteness.destinationDefError,
        signature: varId
          ? `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${varId}::${contract.destinationKey}`
          : `unavailable:${sigTag}:${productGid}::PRODUCTVARIANT::${contract.destinationKey}`
      });

    if (varCompleteness.variantTargetStatus === "variants_read_incomplete") {
      return makeVarUnavailable("unknown_incomplete_read", "variants_incomplete_read");
    }
    if (varCompleteness.variantTargetStatus === "zero_variants") {
      return makeVarUnavailable("zero_variants_hold", "zero_variants");
    }
    if (varCompleteness.variantTargetStatus === "multiple_variants_ambiguous") {
      return makeVarUnavailable("multiple_variants_hold", "multiple_variants");
    }
    if (
      varCompleteness.variantTargetStatus !== "single_variant_verified" ||
      !isExactProductVariantGid(varCompleteness.variantId)
    ) {
      return makeVarUnavailable("invalid_variant_gid", "invalid_variant_gid");
    }

    const verifiedVariantId = varCompleteness.variantId;
    const varMap = baselineSnapshot.currentVariantMetafields;

    if (!varMap || typeof varMap !== "object" || Array.isArray(varMap)) {
      return makeVarUnavailable("variant_baseline_unavailable", "variant", verifiedVariantId);
    }

    const hasProp = Object.prototype.hasOwnProperty.call(varMap, contract.destinationKey);
    const rawVal = hasProp ? varMap[contract.destinationKey] : undefined;
    const positiveEvidenceObserved = hasProp && rawVal !== undefined;
    const storedType =
      baselineSnapshot.currentVariantMetafieldTypes?.[contract.destinationKey] || null;

    if (!positiveEvidenceObserved && varCompleteness.metafieldsCompleteState !== "complete") {
      return makeVarUnavailable("unknown_incomplete_read", "variant_incomplete_read", verifiedVariantId, storedType);
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
      return makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        presence: "native_baseline_unavailable",
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
      return makeUnavailableObservation({
        destinationKey: contract.destinationKey,
        owner: contract.owner,
        presence: isNativeFieldUnverified ? "unknown_incomplete_read" : "absent",
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
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "metafields_not_loaded",
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

  if (!positiveEvidenceObserved && completeness.metafieldsCompleteState !== "complete") {
    return makeUnavailableObservation({
      destinationKey: contract.destinationKey,
      owner: contract.owner,
      presence: "unknown_incomplete_read",
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

  if (isBlankOrWhitespaceOnly(proposedValue)) {
    return {
      valid: false,
      code: "blank_clear_forbidden",
      reason: `Blank or whitespace-only proposals are rejected for "${contract.destinationKey}" (silent clearing/deletion is forbidden).`
    };
  }

  const exactValue = proposedValue;

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
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

// Task-level operational restrictions (shipping weight writes, legacy price aliases, and deletions outside this task).
export const TASK_RESTRICTED_READ_ONLY_DESTINATIONS = Object.freeze(
  new Set(["price", "custom.price", "native_shipping_weight", "custom.shipping_weight_oz"])
);

// Explicit replacement-bench-local allowlist of verified PRODUCTVARIANT metafield destinations.
// Only these 3 variant metafield destinations may be writable in Bench V2 when single-variant
// identity, variant metafield pagination, and live PRODUCTVARIANT definitions are complete.
export const BENCH_V2_CONNECTED_VARIANT_DESTINATIONS = Object.freeze(
  new Set([
    "mm-google-shopping.age_group",
    "mm-google-shopping.condition",
    "mm-google-shopping.gender"
  ])
);

// Explicit replacement-bench-local allowlist of finite retained PRODUCT
// standardized reference destinations (18 keys; excludes authenticity, necklace-design, rarity).
export const BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS = Object.freeze(
  new Set(
    SUPPORTED_STANDARDIZED_REFERENCE_KEYS.map((k) => `shopify.${k}`)
  )
);

// Explicit replacement-bench-local allowlist of the 4 verified PRODUCT
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

// Exact bare provenance keys used by Bench V2 AI Scan (excluding cancelled
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

// Explicit accounting of non-rendered registry records (historical duplicate aliases,
// product-level channel shadow representations superseded by variant/canonical slots,
// and the four unverified historical adapters not yet verified in observation/baseline).
export const BENCH_V2_NON_RENDERED_HISTORICAL_RECORDS = Object.freeze({
  unverifiedHistoricalAdapters: Object.freeze([
    Object.freeze({
      owner: "PRODUCT",
      identity: "global.title_tag",
      role: "COMPAT_REP",
      canonicalTarget: "native_seo_title",
      status: "unverified_historical_adapter_not_in_active_controls"
    }),
    Object.freeze({
      owner: "PRODUCT",
      identity: "global.description_tag",
      role: "COMPAT_REP",
      canonicalTarget: "native_seo_description",
      status: "unverified_historical_adapter_not_in_active_controls"
    }),
    Object.freeze({
      owner: "PRODUCT",
      identity: "mc-facebook.google_product_category",
      role: "COMPAT_REP",
      canonicalTarget: "custom.google_product_category",
      status: "unverified_historical_adapter_not_in_active_controls"
    }),
    Object.freeze({
      owner: "PRODUCT",
      identity: "mm-google-shopping.google_product_category",
      role: "COMPAT_REP",
      canonicalTarget: "custom.google_product_category",
      status: "unverified_historical_adapter_not_in_active_controls"
    })
  ]),
  productLevelChannelShadowCompatReps: Object.freeze([
    Object.freeze({ owner: "PRODUCT", identity: "google.age_group", role: "COMPAT_REP", activeCanonicalOrVariantOwner: "PRODUCTVARIANT:mm-google-shopping.age_group" }),
    Object.freeze({ owner: "PRODUCT", identity: "google.condition", role: "COMPAT_REP", activeCanonicalOrVariantOwner: "PRODUCTVARIANT:mm-google-shopping.condition" }),
    Object.freeze({ owner: "PRODUCT", identity: "google.target_gender", role: "COMPAT_REP", activeCanonicalOrVariantOwner: "PRODUCTVARIANT:mm-google-shopping.gender" }),
    Object.freeze({ owner: "PRODUCT", identity: "mm-google-shopping.age_group", role: "COMPAT_REP", activeCanonicalOrVariantOwner: "PRODUCTVARIANT:mm-google-shopping.age_group" }),
    Object.freeze({ owner: "PRODUCT", identity: "mm-google-shopping.condition", role: "COMPAT_REP", activeCanonicalOrVariantOwner: "PRODUCTVARIANT:mm-google-shopping.condition" })
  ]),
  nonRenderedDuplicateAliases: Object.freeze([
    Object.freeze({ owner: "PRODUCT", identity: "custom.badge", role: "DUPLICATE_ALIAS" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.crystal-system", role: "DUPLICATE_ALIAS", canonicalTarget: "custom.crystal_system" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.geological-era", role: "DUPLICATE_ALIAS", canonicalTarget: "shopify.geological-era" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.mineral-class", role: "DUPLICATE_ALIAS", canonicalTarget: "custom.mineral_class" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.necklace-design", role: "DUPLICATE_ALIAS", canonicalTarget: "custom.necklace_design" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.review_widget_data", role: "DUPLICATE_ALIAS" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.rock-composition", role: "DUPLICATE_ALIAS", canonicalTarget: "custom.rock_composition" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.rock-formation", role: "DUPLICATE_ALIAS", canonicalTarget: "custom.rock_formation" }),
    Object.freeze({ owner: "PRODUCT", identity: "custom.widget", role: "DUPLICATE_ALIAS" }),
    Object.freeze({ owner: "PRODUCT", identity: "shopify_title", role: "DUPLICATE_ALIAS", canonicalTarget: "native_title" })
  ])
});

export const BENCH_V2_PARKED_AND_PROTECTED_DRAWER_IDS = Object.freeze(
  new Set([
    "parked_excluded_protected",
    "parked_story_and_bench_notes",
    "parked_legacy_product_exclusions",
    "parked_variant_and_protected_apps"
  ])
);

export function isParkedOrProtectedDrawerId(drawerId) {
  if (typeof drawerId !== "string" || !drawerId.trim()) return false;
  return BENCH_V2_PARKED_AND_PROTECTED_DRAWER_IDS.has(drawerId.trim());
}

export const BENCH_V2_DRAWERS = Object.freeze([
  Object.freeze({
    drawerId: "manual_stone_scale_price",
    drawerNumber: 1,
    heading: "1. Manual Stone Measurements & Price Baseline",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Manual caliper and scale measurements (stone dimensions mm, stone weight g, actual whole-product weight g) and single-variant manual price (native_price, USD two-decimal format) connected for manual entry and independent exact-value approval (excluded from AI scan; shipping weight baselines remain task-restricted read-only; overall_solid_length_in remains cancelled)."
  }),
  Object.freeze({
    drawerId: "manual_fit_and_chain_measurements",
    drawerNumber: 2,
    heading: "2. Manual Chain, Fit & Opening Measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Manual chain or cord length (in), accessory exterior dimensions (mm), and fitting/opening/grip dimensions (mm) connected for manual entry and exact-value approval (excluded from AI scan; overall_solid_length_in omitted as cancelled)."
  }),
  Object.freeze({
    drawerId: "manual_title_and_collection_date",
    drawerNumber: 3,
    heading: "3. Manual Product Title & Collection Date",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Native Shopify product title (native_title) and collection date (custom.collection_date). Existing manual-only restrictions are preserved."
  }),
  Object.freeze({
    drawerId: "identity_and_classification",
    drawerNumber: 4,
    heading: "4. Piece Identity, Material & OOAK",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Core piece identity (custom.piece_name), dominant material (custom.material), base stone family (custom.stone_family), both independent one-of-a-kind destinations (custom.is_one_of_a_kind and custom.is_ooak), related standardized reference attributes (shopify.material, shopify.product-classification, shopify.product-use, shopify.material-origin), and read-only custom.primary_medium compatibility inspection."
  }),
  Object.freeze({
    drawerId: "appearance_color_and_shape",
    drawerNumber: 5,
    heading: "5. Appearance, Cut, Color & Finish",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Cut and shape, stone shape, surface finish, color, primary/secondary colors, color pattern, related standardized reference attribute (shopify.color-pattern), and read-only custom.cut_type compatibility inspection."
  }),
  Object.freeze({
    drawerId: "treatment_and_disclosure",
    drawerNumber: 6,
    heading: "6. Treatment & Disclosure",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Lapidary treatment status (custom.treatment_status) and treated classification (custom.treated)."
  }),
  Object.freeze({
    drawerId: "origin_and_provenance",
    drawerNumber: 7,
    heading: "7. Origin, Collection & Provenance",
    subHarness: "SUB_HARNESS_1",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Origin location, canonical origin page handle (custom.origin_page_handle), collection name, collection location, found-object provenance, and read-only custom.origin_handle alias inspection."
  }),
  Object.freeze({
    drawerId: "setting_and_hardware",
    drawerNumber: 8,
    heading: "8. Setting, Chain & Hardware",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Connected setting and hardware facts (custom.secondary_medium, custom.jewelry_type, custom.setting_ready, custom.bail_included, custom.chain_material, custom.chain_link_type, custom.jewelry_finding_type, custom.wire_material) plus related standardized reference attributes (shopify.jewelry-type, shopify.jewelry-material, shopify.jewelry-finding-type, shopify.chain-link-type, shopify.construction)."
  }),
  Object.freeze({
    drawerId: "seo_and_media_alts",
    drawerNumber: 9,
    heading: "9. SEO Titles, Meta Description & Photo Alts",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Independently reviewed SEO title destinations (native_seo_title and custom.seo_title) and native SEO meta description (native_seo_description, existing manual-only restriction preserved), plus read-only per-image media alt capability descriptor (native_image_alt) and custom.alt_text."
  }),
  Object.freeze({
    drawerId: "descriptions_and_narrative",
    drawerNumber: 10,
    heading: "10. Product Descriptions (Substantive Text)",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Independent substantive product description destinations (native_description and custom.generated_description) isolated for clean review and drawer copy parts, preserving existing manual-only restrictions and independent exact-value approvals."
  }),
  Object.freeze({
    drawerId: "geology_physical_properties",
    drawerNumber: 11,
    heading: "11. Geology: Physical & Optical Properties",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Physical and optical mineralogical properties: Mohs hardness, specific gravity, crystal system (custom.crystal_system and standardized shopify.crystal-system), luster, cleavage, fracture pattern, diaphaneity, and tenacity."
  }),
  Object.freeze({
    drawerId: "geology_composition_and_time",
    drawerNumber: 12,
    heading: "12. Geology: Class, Composition, Formation & Deep Time",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Mineral class, rock composition, and rock formation (custom.* text and standardized shopify.* references), library geological age text (custom.geological_age), authoritative standardized geological era (shopify.geological-era), and read-only legacy custom.geological_era compatibility inspection."
  }),
  Object.freeze({
    drawerId: "channel_and_demographic",
    drawerNumber: 13,
    heading: "13. Google Channel & Demographic Attributes",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    isImplementedInBatch1: true,
    description: "Product Google product category (custom.google_product_category), single-variant Google channel attributes (PRODUCTVARIANT mm-google-shopping.age_group, condition, gender), related standardized demographic/condition references (shopify.age-group, shopify.condition, shopify.target-gender), read-only hold (mm-google-shopping.custom_product), and legacy compatibility inspection rows (PRODUCTVARIANT google.age_group, google.condition, google.target_gender and PRODUCT custom.target_gender)."
  }),
  Object.freeze({
    drawerId: "parked_story_and_bench_notes",
    drawerNumber: 14,
    heading: "14. Parked Story, Character & Studio Notes (Read-Only)",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    isImplementedInBatch1: true,
    description: "Read-only inspection of parked story context, flaw/character notes, studio bench notes, and provenance notes (origin_story, honest_flaws_and_character, character_marks, rescued_by, official_name, stone_story, artist_notes, bench_notes, handcrafted_by, story_theme). Zero writes, zero deletions."
  }),
  Object.freeze({
    drawerId: "parked_legacy_product_exclusions",
    drawerNumber: 15,
    heading: "15. Parked Legacy Product & Taxonomy Exclusions (Read-Only)",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    isImplementedInBatch1: true,
    description: "Read-only inspection of excluded product-level custom fields, excluded standardized attributes (shopify.authenticity, shopify.necklace-design, shopify.rarity), and parked app conversation starters. Zero writes, zero deletions."
  }),
  Object.freeze({
    drawerId: "parked_variant_and_protected_apps",
    drawerNumber: 16,
    heading: "16. Parked Variant Customs/MPN & Protected App Fields (Read-Only)",
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    isImplementedInBatch1: true,
    description: "Read-only inspection of parked/excluded PRODUCTVARIANT fields (harmonized_system_code, mpn, custom_label_0..4, size_system, size_type) and protected third-party app metafields (Shopify eligibility and Judge.me). Zero writes, zero deletions."
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
      BENCH_V2_CONNECTED_VARIANT_DESTINATIONS.has(spec.destinationKey)) ||
    (spec.owner === "PRODUCTVARIANT" &&
      spec.namespace === "native" &&
      spec.destinationKey === "native_price");

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

function defineStandardizedShopifyField(drawerId, subHarness, k, canonicalTarget = null) {
  const isVisionCandidateKey = VISION_CANDIDATE_STANDARDIZED_KEYS.has(k);
  const isSupportedRefKey = SUPPORTED_STANDARDIZED_KEY_SET.has(k);
  return defineFieldContract({
    destinationKey: `shopify.${k}`,
    namespace: "shopify",
    key: k,
    label: `Shopify Standardized: ${k}`,
    owner: "PRODUCT",
    drawerId,
    subHarness,
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
    canonicalTarget,
    purposeNote: isSupportedRefKey
      ? "Standardized taxonomy reference attribute (list.metaobject_reference). Requires complete reads, live PRODUCT definition, category constraint eligibility, verified restricted Metaobject definition membership for all proposed GIDs, and exact-value approval."
      : "Read-only standardized taxonomy attribute."
  });
}

function defineParkedField(drawerId, owner, namespace, key, label, expectedType = "single_line_text_field", overrides = {}) {
  return defineFieldContract({
    destinationKey: `${namespace}.${key}`,
    namespace,
    key,
    label,
    owner,
    drawerId,
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PARKED_EXCLUDED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PARKED_EXCLUDED_NO_WRITE,
    expectedType,
    ...overrides
  });
}

function defineProtectedAppField(drawerId, namespace, key, label) {
  return defineFieldContract({
    destinationKey: `${namespace}.${key}`,
    namespace,
    key,
    label,
    owner: "PRODUCT",
    drawerId,
    subHarness: "SUB_HARNESS_6",
    batchStage: BENCH_V2_BATCH_STAGE.PROTECTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.PROTECTED_NO_WRITE,
    expectedType: "single_line_text_field"
  });
}

// ==========================================================================
// AUTHORITATIVE FIELD CONTRACTS (ALL 16 FOCUSED DRAWERS)
// ==========================================================================

export const BENCH_V2_FIELD_CONTRACTS = Object.freeze([
  // DRAWER 1: MANUAL STONE MEASUREMENTS & PRICE BASELINE (6 CONTRACTS)
  defineBatch1CustomField(
    "manual_stone_scale_price",
    "SUB_HARNESS_2",
    "dimensions_mm",
    "Dimensions (mm)",
    "Manual caliper measurement in millimeters (e.g. 38 x 24 x 6 mm). Excluded from AI generation/staging; requires live definition or stored type verification and exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_stone_scale_price",
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
    "manual_stone_scale_price",
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
  defineFieldContract({
    destinationKey: "native_price",
    namespace: "native",
    key: "native_price",
    label: "Variant Price (USD)",
    owner: "PRODUCTVARIANT",
    drawerId: "manual_stone_scale_price",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "money",
    allowedTypes: ["native", "money"],
    purposeNote: "Single-variant native Shopify price in USD (PRODUCTVARIANT native_price, canonical non-negative two-decimal format e.g. 45.00; distinct from parked custom.price). Manual entry only (excluded from AI scan); requires verified single-variant ProductVariant GID, complete variant baseline read, and independent exact-value approval."
  }),
  defineFieldContract({
    destinationKey: "native_shipping_weight",
    namespace: "native",
    key: "native_shipping_weight",
    label: "Inventory Shipping Weight (Task-Restricted Read-Only)",
    owner: "INVENTORYITEM",
    drawerId: "manual_stone_scale_price",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.TASK_RESTRICTED_NO_WRITE,
    expectedType: "weight_ounces",
    purposeNote: "Shipping-weight changes are task-restricted read-only in this batch; inspectable baseline only."
  }),
  defineFieldContract({
    destinationKey: "custom.shipping_weight_oz",
    namespace: "custom",
    key: "shipping_weight_oz",
    label: "Shipping Weight Oz Metafield (Task-Restricted Read-Only)",
    owner: "PRODUCT",
    drawerId: "manual_stone_scale_price",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.TASK_RESTRICTED_READ_ONLY,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.TASK_RESTRICTED_NO_WRITE,
    expectedType: "number_decimal",
    canonicalTarget: "native_shipping_weight",
    purposeNote: "Shipping-weight changes are task-restricted read-only in this batch; inspectable baseline only."
  }),

  // DRAWER 2: MANUAL CHAIN, FIT & OPENING MEASUREMENTS (3 CONTRACTS; overall_solid_length_in CANCELLED)
  defineBatch1CustomField(
    "manual_fit_and_chain_measurements",
    "SUB_HARNESS_2",
    "chain_cord_length_in",
    "Chain or Cord Length (in)",
    "Manual chain or cord length measurement in inches (single_line_text_field, max 255 chars), preserving adjustable/extender notation. Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_fit_and_chain_measurements",
    "SUB_HARNESS_2",
    "accessory_dimensions_mm",
    "Accessory Exterior Dimensions (mm)",
    "Manual labeled exterior dimensions/width/thickness of accessory or setting in millimeters (single_line_text_field, max 255 chars; distinct from stone custom.dimensions_mm). Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),
  defineBatch1CustomField(
    "manual_fit_and_chain_measurements",
    "SUB_HARNESS_2",
    "fitting_opening_mm",
    "Fitting / Opening / Grip Dimensions (mm)",
    "Manual labeled passage/bail opening/grip/peg/hole measurements in millimeters (single_line_text_field, max 255 chars; distinct from stone custom.dimensions_mm and custom.accessory_dimensions_mm). Excluded from AI generation/staging; requires independent exact-value approval.",
    { isManualOnlyNoAi: true }
  ),

  // DRAWER 3: MANUAL PRODUCT TITLE & COLLECTION DATE (2 CONTRACTS)
  defineFieldContract({
    destinationKey: "native_title",
    namespace: "native",
    key: "native_title",
    label: "Native Product Title (product.title)",
    owner: "PRODUCT",
    drawerId: "manual_title_and_collection_date",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_title",
    allowedTypes: ["native", "native_title"],
    maxLength: 255,
    purposeNote: "Native Shopify product title (product.title, max 255 chars). Distinct from custom.piece_name; existing manual-only restriction and exact-value approval preserved."
  }),
  defineBatch1CustomField(
    "manual_title_and_collection_date",
    "SUB_HARNESS_1",
    "collection_date",
    "Collection Date",
    "Collection date string. Blank/absent stays absent; placeholder tokens ('N/A', 'None', 'Unknown') are rejected at source.",
    { isManualOnlyNoAi: true }
  ),

  // DRAWER 4: PIECE IDENTITY, MATERIAL & OOAK (10 CONTRACTS)
  defineBatch1CustomField(
    "identity_and_classification",
    "SUB_HARNESS_1",
    "piece_name",
    "Piece Name",
    "Individual piece identifier (never the full 3-part Shopify marketing title)."
  ),
  defineBatch1CustomField(
    "identity_and_classification",
    "SUB_HARNESS_1",
    "material",
    "Dominant Material",
    "Dominant material of the piece (distinct from custom.stone_family; preserves existing option list; never auto-populated from stone_family and never overwritten with hardware/metal/plating strings).",
    { optionsKey: "stone_family" }
  ),
  defineBatch1CustomField(
    "identity_and_classification",
    "SUB_HARNESS_1",
    "stone_family",
    "Stone Family",
    "Base stone family (e.g. Red Jasper -> Jasper). Distinct from Dominant Material (custom.material) and Primary Medium (custom.primary_medium); requires its own exact-value approval and never auto-populates or overwrites those other destinations.",
    { optionsKey: "stone_family", canonicalTarget: null }
  ),
  defineBatch1CustomField(
    "identity_and_classification",
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
    "identity_and_classification",
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
  defineStandardizedShopifyField("identity_and_classification", "SUB_HARNESS_5", "material", "custom.material"),
  defineStandardizedShopifyField("identity_and_classification", "SUB_HARNESS_5", "product-classification"),
  defineStandardizedShopifyField("identity_and_classification", "SUB_HARNESS_5", "product-use"),
  defineStandardizedShopifyField("identity_and_classification", "SUB_HARNESS_5", "material-origin"),
  defineCompatField(
    "identity_and_classification",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "primary_medium",
    "Primary Medium (Saved Compatibility — Read-Only)",
    "custom.material",
    "Inspectable saved primary_medium value. Never dual-written or promoted into custom.material if contaminated with hardware terms."
  ),

  // DRAWER 5: APPEARANCE, CUT, COLOR & FINISH (9 CONTRACTS)
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "cut_and_shape",
    "Cut and Shape",
    "Detailed cut and shape description (distinct from broader custom.stone_shape). Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "stone_shape",
    "Stone Shape",
    "Broader stone shape classification. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "surface_finish",
    "Surface Finish",
    "Lapidary surface polish/finish.",
    { optionsKey: "surface_finish" }
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "color",
    "Color",
    "General color descriptor. Resolved from legacy API retirement list; requires live definition or stored type verification on save."
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "primary_color",
    "Primary Color",
    "Dominant visual color of the piece."
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "secondary_colors",
    "Secondary Colors",
    "Secondary/accent colors as plain text (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "color_pattern",
    "Color Pattern",
    "Visual patterning (banding, brecciated, dendritic, etc.) as plain text."
  ),
  defineStandardizedShopifyField("appearance_color_and_shape", "SUB_HARNESS_5", "color-pattern", "custom.color_pattern"),
  defineCompatField(
    "appearance_color_and_shape",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "cut_type",
    "Cut Type (Saved Compatibility — Read-Only)",
    "custom.cut_and_shape",
    "Inspectable compatibility field; canonical writes target custom.cut_and_shape."
  ),

  // DRAWER 6: TREATMENT & DISCLOSURE (2 CONTRACTS)
  defineBatch1CustomField(
    "treatment_and_disclosure",
    "SUB_HARNESS_1",
    "treatment_status",
    "Treatment Status",
    "Detailed treatment disclosure text.",
    { usesYesNoMeaningDisplay: true }
  ),
  defineBatch1CustomField(
    "treatment_and_disclosure",
    "SUB_HARNESS_1",
    "treated",
    "Treated",
    "Standardized studio treatment value (e.g. Untreated — Natural).",
    { usesYesNoMeaningDisplay: true, optionsKey: "treated" }
  ),

  // DRAWER 7: ORIGIN, COLLECTION & PROVENANCE (6 CONTRACTS)
  defineBatch1CustomField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "origin_location",
    "Origin Location",
    "Geological or geographic origin location of the material."
  ),
  defineBatch1CustomField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "origin_page_handle",
    "Origin Page Handle",
    "Sole canonical editable origin page handle."
  ),
  defineBatch1CustomField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "collection_name",
    "Collection Name",
    "Studio collection or series name.",
    { optionsKey: "collection_name" }
  ),
  defineBatch1CustomField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "collection_location",
    "Collection Location",
    "Specific field/river/ranch collecting location."
  ),
  defineBatch1CustomField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "found_object",
    "Found Object",
    "Wild-found vs. purchased provenance.",
    { usesYesNoMeaningDisplay: true, optionsKey: "found_object" }
  ),
  defineCompatField(
    "origin_and_provenance",
    "SUB_HARNESS_1",
    "PRODUCT",
    "custom",
    "origin_handle",
    "Origin Handle (Saved Compatibility — Read-Only)",
    "custom.origin_page_handle",
    "Inspectable legacy alias; canonical writes target custom.origin_page_handle only."
  ),

  // DRAWER 8: SETTING, CHAIN & HARDWARE (13 CONTRACTS)
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "secondary_medium",
    "Secondary Medium",
    "Secondary medium (setting/hardware metal or material) when applicable; never overwrites stone identity."
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "jewelry_type",
    "Jewelry Type",
    "Jewelry type classification (e.g. Pendant, Necklace, Artisan jewelry, N/A)."
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "setting_ready",
    "Setting Ready",
    "Whether the piece is setting-ready or mounted/ready to wear (preserves exact descriptive text or boolean-like text values).",
    { usesYesNoMeaningDisplay: true, optionsKey: "setting_ready" }
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "bail_included",
    "Bail Included",
    "Whether a bail is included and/or its specific descriptive type (e.g. Silver Plated Pinch Bail).",
    { usesYesNoMeaningDisplay: true, optionsKey: "bail_included" }
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "chain_material",
    "Chain Material",
    "Included necklace chain or cord material.",
    { optionsKey: "chain_material" }
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "chain_link_type",
    "Chain Link Type",
    "Chain link or cord type (e.g. Cord, Snake Chain)."
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "jewelry_finding_type",
    "Jewelry Finding Type",
    "Specific finding or mounting hardware (e.g. Silver Plated Pinch Bail, Glue-On Bail, Assorted Glue-In Setting)."
  ),
  defineBatch1CustomField(
    "setting_and_hardware",
    "SUB_HARNESS_2",
    "wire_material",
    "Wire Material",
    "Wire material when wire-wrapped."
  ),
  defineStandardizedShopifyField("setting_and_hardware", "SUB_HARNESS_5", "jewelry-type", "custom.jewelry_type"),
  defineStandardizedShopifyField("setting_and_hardware", "SUB_HARNESS_5", "jewelry-material", "custom.secondary_medium"),
  defineStandardizedShopifyField("setting_and_hardware", "SUB_HARNESS_5", "jewelry-finding-type", "custom.jewelry_finding_type"),
  defineStandardizedShopifyField("setting_and_hardware", "SUB_HARNESS_5", "chain-link-type", "custom.chain_link_type"),
  defineStandardizedShopifyField("setting_and_hardware", "SUB_HARNESS_5", "construction"),

  // DRAWER 9: SEO TITLES, META DESCRIPTION & PHOTO ALTS (5 CONTRACTS + EXPANDED PHOTO ALTS)
  defineFieldContract({
    destinationKey: "native_seo_title",
    namespace: "native",
    key: "native_seo_title",
    label: "Native SEO Title (product.seo.title)",
    owner: "PRODUCT",
    drawerId: "seo_and_media_alts",
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
    drawerId: "seo_and_media_alts",
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
    drawerId: "seo_and_media_alts",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_seo_description",
    allowedTypes: ["native", "native_seo_description"],
    maxLength: 160,
    control: "multiline",
    purposeNote: "Native Shopify SEO meta description (product.seo.description, max 160 chars). Existing manual-only restriction and exact-value approval preserved."
  }),
  defineFieldContract({
    destinationKey: "native_image_alt",
    namespace: "native",
    key: "native_image_alt",
    label: "Per-Image Media Alt Text Capability (Expands per MediaImage GID)",
    owner: "MEDIAIMAGE",
    drawerId: "seo_and_media_alts",
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
    drawerId: "seo_and_media_alts",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_3_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    canonicalTarget: "native_image_alt",
    purposeNote: "Compatibility metafield; never auto-created when absent and never auto-copied from hero image alt."
  }),

  // DRAWER 10: PRODUCT DESCRIPTIONS (SUBSTANTIVE TEXT — 2 CONTRACTS)
  defineFieldContract({
    destinationKey: "native_description",
    namespace: "native",
    key: "native_description",
    label: "Native Product Description HTML (product.descriptionHtml)",
    owner: "PRODUCT",
    drawerId: "descriptions_and_narrative",
    subHarness: "SUB_HARNESS_4",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "native_html",
    allowedTypes: ["native", "native_html"],
    maxLength: 10000,
    control: "multiline",
    purposeNote: "Independent destination from custom.generated_description; existing manual-only restriction and exact-value approval preserved (max 10,000 chars)."
  }),
  defineFieldContract({
    destinationKey: "custom.generated_description",
    namespace: "custom",
    key: "generated_description",
    label: "Generated Description Metafield (custom.generated_description)",
    owner: "PRODUCT",
    drawerId: "descriptions_and_narrative",
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

  // DRAWER 11: GEOLOGY: PHYSICAL & OPTICAL PROPERTIES (9 CONTRACTS)
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "mohs_hardness",
    "Mohs Hardness",
    "Mohs hardness scale value or range (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "specific_gravity",
    "Specific Gravity",
    "Specific gravity value or range (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "crystal_system",
    "Crystal System",
    "Crystal system classification as plain text (single_line_text_field)."
  ),
  defineStandardizedShopifyField("geology_physical_properties", "SUB_HARNESS_5", "crystal-system", "custom.crystal_system"),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "luster",
    "Luster",
    "Mineralogical luster (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "cleavage",
    "Cleavage",
    "Mineralogical cleavage (single_line_text_field; 'None' is a valid mineralogical value)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "fracture_pattern",
    "Fracture Pattern",
    "Mineralogical fracture pattern (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "diaphaneity",
    "Diaphaneity",
    "Light transmission / diaphaneity (single_line_text_field)."
  ),
  defineBatch1CustomField(
    "geology_physical_properties",
    "SUB_HARNESS_3",
    "tenacity",
    "Tenacity",
    "Mineralogical tenacity (single_line_text_field, e.g. Brittle)."
  ),

  // DRAWER 12: GEOLOGY: CLASS, COMPOSITION, FORMATION & DEEP TIME (9 CONTRACTS)
  defineBatch1CustomField(
    "geology_composition_and_time",
    "SUB_HARNESS_3",
    "mineral_class",
    "Mineral Class",
    "Mineral class as plain text (single_line_text_field)."
  ),
  defineStandardizedShopifyField("geology_composition_and_time", "SUB_HARNESS_5", "mineral-class", "custom.mineral_class"),
  defineBatch1CustomField(
    "geology_composition_and_time",
    "SUB_HARNESS_3",
    "rock_composition",
    "Rock Composition",
    "Rock or mineral composition as plain text (single_line_text_field)."
  ),
  defineStandardizedShopifyField("geology_composition_and_time", "SUB_HARNESS_5", "rock-composition", "custom.rock_composition"),
  defineBatch1CustomField(
    "geology_composition_and_time",
    "SUB_HARNESS_3",
    "rock_formation",
    "Rock Formation",
    "Geological rock formation as plain text (single_line_text_field)."
  ),
  defineStandardizedShopifyField("geology_composition_and_time", "SUB_HARNESS_5", "rock-formation", "custom.rock_formation"),
  defineBatch1CustomField(
    "geology_composition_and_time",
    "SUB_HARNESS_3",
    "geological_age",
    "Geological Age",
    "Library geological age text (single_line_text_field; distinct from shopify.geological-era and custom.geological_era; 'Variable' can be valid)."
  ),
  defineStandardizedShopifyField("geology_composition_and_time", "SUB_HARNESS_5", "geological-era"),
  defineCompatField(
    "geology_composition_and_time",
    "SUB_HARNESS_3",
    "PRODUCT",
    "custom",
    "geological_era",
    "Geological Era (Saved Compatibility — Read-Only)",
    "shopify.geological-era",
    "Legacy custom geological_era field kept read-only for inspection only; authoritative ERA dropdown is shopify.geological-era and AGE text is custom.geological_age.",
    { maxLength: 255 }
  ),

  // DRAWER 13: GOOGLE CHANNEL & DEMOGRAPHIC ATTRIBUTES (12 CONTRACTS)
  defineBatch1CustomField(
    "channel_and_demographic",
    "SUB_HARNESS_3",
    "google_product_category",
    "Google Product Category",
    "Product-level Google product category text (custom.google_product_category). Requires live definition or stored type verification and exact-value approval.",
    { optionsKey: "google_product_category" }
  ),
  defineFieldContract({
    destinationKey: "mm-google-shopping.age_group",
    namespace: "mm-google-shopping",
    key: "age_group",
    label: "Google: Age Group (mm-google-shopping.age_group)",
    owner: "PRODUCTVARIANT",
    drawerId: "channel_and_demographic",
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
    drawerId: "channel_and_demographic",
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
    drawerId: "channel_and_demographic",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL,
    isManualOnlyNoAi: true,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "google_gender",
    purposeNote: "Variant-owned Google gender (PRODUCTVARIANT mm-google-shopping.gender, single_line_text_field). Requires complete single-variant enumeration, exact ProductVariant GID binding, complete variant metafields/definitions, and exact-value approval."
  }),
  defineStandardizedShopifyField("channel_and_demographic", "SUB_HARNESS_5", "age-group", "mm-google-shopping.age_group"),
  defineStandardizedShopifyField("channel_and_demographic", "SUB_HARNESS_5", "condition", "mm-google-shopping.condition"),
  defineStandardizedShopifyField("channel_and_demographic", "SUB_HARNESS_5", "target-gender", "mm-google-shopping.gender"),
  defineFieldContract({
    destinationKey: "mm-google-shopping.custom_product",
    namespace: "mm-google-shopping",
    key: "custom_product",
    label: "Google Shopping Custom Product (Read-Only Hold)",
    owner: "PRODUCT",
    drawerId: "channel_and_demographic",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.UNVERIFIED_CONTRACT_HOLD,
    expectedType: "boolean",
    purposeNote: "Held read-only: no live PRODUCT or PRODUCTVARIANT definition or stored boolean exists on the store, and legacy custom.custom_product text ('true') does not verify channel boolean polarity."
  }),
  defineCompatField(
    "channel_and_demographic",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "age_group",
    "Google Age Group (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.age_group",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.age_group definition; active variant definition is mm-google-shopping.age_group)."
  ),
  defineCompatField(
    "channel_and_demographic",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "condition",
    "Google Condition (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.condition",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.condition definition; active variant definition is mm-google-shopping.condition)."
  ),
  defineCompatField(
    "channel_and_demographic",
    "SUB_HARNESS_3",
    "PRODUCTVARIANT",
    "google",
    "target_gender",
    "Google Target Gender (Legacy Variant Compatibility — Read-Only)",
    "mm-google-shopping.gender",
    "Read-only variant compatibility inspection slot (no live PRODUCTVARIANT google.target_gender definition; active variant definition is mm-google-shopping.gender)."
  ),
  defineCompatField(
    "channel_and_demographic",
    "SUB_HARNESS_3",
    "PRODUCT",
    "custom",
    "target_gender",
    "Target Gender (Custom Compatibility — Read-Only)",
    "google.target_gender",
    "Inspectable product-level custom.target_gender compatibility value; never auto-migrated or copied."
  ),

  // DRAWER 14: PARKED STORY, CHARACTER & STUDIO NOTES (READ-ONLY — 10 CONTRACTS)
  defineParkedField(
    "parked_story_and_bench_notes",
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
    "parked_story_and_bench_notes",
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
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "character_marks", "Character Marks (Parked — Read-Only)", "list.single_line_text_field", { control: "multiline" }),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "rescued_by", "Rescued By (Parked — Read-Only)"),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "official_name", "Official Name (Parked — Read-Only)"),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "stone_story", "Stone Story (Parked — Read-Only)", "list.single_line_text_field", { control: "multiline" }),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "artist_notes", "Artist Notes (Parked — Read-Only)", "multi_line_text_field", { control: "multiline" }),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "bench_notes", "Bench Notes (Parked — Read-Only)", "multi_line_text_field", { control: "multiline" }),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "handcrafted_by", "Handcrafted By (Parked — Read-Only)"),
  defineParkedField("parked_story_and_bench_notes", "PRODUCT", "custom", "story_theme", "Story Theme (Parked — Read-Only)"),

  // DRAWER 15: PARKED LEGACY PRODUCT & TAXONOMY EXCLUSIONS (READ-ONLY — 12 CONTRACTS)
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "primary_use", "Primary Use (Parked — Read-Only)", "single_line_text_field", { canonicalTarget: "shopify.product-use" }),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "necklace_design", "Necklace Design (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "authenticity", "Authenticity (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "rarity", "Rarity (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "custom_product", "Custom Product (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "age_group", "Age Group Custom (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "condition", "Condition Custom (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "custom", "price", "Custom Price Metafield (Parked — Read-Only)"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "shopify", "authenticity", "Shopify Authenticity (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "shopify", "necklace-design", "Shopify Necklace Design (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "shopify", "rarity", "Shopify Rarity (Parked — Read-Only)", "list.metaobject_reference"),
  defineParkedField("parked_legacy_product_exclusions", "PRODUCT", "app--3026047", "conversation_starters", "App Conversation Starters (Parked — Read-Only)"),

  // DRAWER 16: PARKED VARIANT CUSTOMS/MPN & PROTECTED APP FIELDS (READ-ONLY — 13 CONTRACTS)
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "global", "harmonized_system_code", "Harmonized System Code (Parked Variant Customs Code — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "mpn", "Google Shopping MPN (Excluded Variant Field — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "custom_label_0", "Google Shopping Custom Label 0 (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "custom_label_1", "Google Shopping Custom Label 1 (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "custom_label_2", "Google Shopping Custom Label 2 (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "custom_label_3", "Google Shopping Custom Label 3 (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "custom_label_4", "Google Shopping Custom Label 4 (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "size_system", "Google Shopping Size System (Parked Variant — Read-Only)"),
  defineParkedField("parked_variant_and_protected_apps", "PRODUCTVARIANT", "mm-google-shopping", "size_type", "Google Shopping Size Type (Parked Variant — Read-Only)"),
  defineProtectedAppField("parked_variant_and_protected_apps", "app--3890849--eligibility", "eligibility_details", "Shopify Eligibility Details (Protected — Read-Only)"),
  defineProtectedAppField("parked_variant_and_protected_apps", "judgeme", "badge", "Judge.me Badge (Protected — Read-Only)"),
  defineProtectedAppField("parked_variant_and_protected_apps", "judgeme", "review_widget_data", "Judge.me Review Widget Data (Protected — Read-Only)"),
  defineProtectedAppField("parked_variant_and_protected_apps", "judgeme", "widget", "Judge.me Widget (Protected — Read-Only)")
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

export const MANUAL_MEASUREMENT_DESTINATIONS = Object.freeze(
  new Set([
    "custom.dimensions_mm",
    "custom.weight_grams",
    "custom.whole_product_weight_grams",
    "custom.chain_cord_length_in",
    "custom.accessory_dimensions_mm",
    "custom.fitting_opening_mm"
  ])
);

export const MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS = Object.freeze(
  new Set([
    ...BENCH_V2_MANUAL_ONLY_NO_AI_DESTINATIONS,
    ...BENCH_V2_CONNECTED_VARIANT_DESTINATIONS,
    ...MANUAL_MEASUREMENT_DESTINATIONS,
    "native_price",
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

export function isManualMeasurementDestination(destinationKey) {
  if (!destinationKey || typeof destinationKey !== "string") return false;
  return MANUAL_MEASUREMENT_DESTINATIONS.has(destinationKey);
}

export function isManualOnlyNoAiDestination(destinationKey, contract = null) {
  if (!destinationKey || typeof destinationKey !== "string") return false;
  if (MANUAL_MEASUREMENT_AND_MANUAL_ONLY_DESTINATIONS.has(destinationKey)) return true;
  if (contract && contract.isManualOnlyNoAi === true) {
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
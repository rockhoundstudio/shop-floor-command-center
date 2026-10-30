// ==========================================================================
// ROCKHOUND STUDIO — REPLACEMENT BENCH V2 PURE FIELD & DRAWER CONTRACT
// File: app/utils/bench-v2.contract.jsx
//
// Verified Existing Sources Confirmed in Context:
// 1. app/routes/app.meta-injector.jsx
// 2. app/utils/meta-injector.loader.jsx
// 3. app/routes/app.meta-injector-api.jsx
// 4. app/routes/app.meta-injector.matrix.jsx
// 5. app/utils/meta-injector.constants.jsx (DROPDOWN_OPTIONS reused below)
// 6. app/utils/meta-injector.execution-hook.jsx
// 7. app/utils/meta-injector.matrix-domain.jsx
// 8. app/routes/app.jsx
// 9. app/routes.js (@react-router/fs-routes flatRoutes, v7.16.0)
// 10. app/routes/app.meta-injector-autofill.jsx
// 11. app/utils/meta-injector.autofill.server.jsx
// 12. app/utils/bench-v2.contract.jsx (Saved baseline SHA256: F31EF4BC321AFC20A3696E53686EAD076D8583B8962D24EA667AC6D7DF144DBA)
//
// Pure contract module only:
// - Zero React hooks/effects, zero storage access, zero GraphQL/network calls.
// - Does NOT import legacy evaluators, execution hooks, or writers.
// - Separates Batch 1 implemented contracts (Identity, Origin and collection,
//   Treatment, Appearance and character) from future-batch descriptors and
//   read-only compatibility/parked/protected inventory.
// - Never advertises unwired future-batch fields as writable.
// - Enforces strict baseline vs. proposed separation, zero automatic
//   preapproval, exact-value approval binding, baseline-bound Keep Original,
//   and explicit live-definition / stored-evidence & completeness requirements.
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
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 2 descriptor: dimensions (mm), weight (grams), and unverified measurement holds (overall-solid-length omitted as cancelled)."
  }),
  Object.freeze({
    drawerId: "conditional_setting_accessory",
    drawerNumber: 6,
    heading: "6. Conditional setting/accessory facts",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 2 descriptor: secondary medium, jewelry type, setting ready, bail included, chain/link, finding type, and wire material."
  }),
  Object.freeze({
    drawerId: "geology",
    drawerNumber: 7,
    heading: "7. Geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 2 descriptor: 13 deterministic geology metafields."
  }),
  Object.freeze({
    drawerId: "other_channel",
    drawerNumber: 8,
    heading: "8. Other & Channel Attributes",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    isImplementedInBatch1: false,
    description: "Future Batch 2 descriptor: Google product category plus read-only channel and variant-owned holds."
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

// User-facing Yes/No conventions preserved for both OOAK destinations without confusing
// UI display labels with actual underlying storage values ("true"/"false" for boolean,
// or exact text strings for single_line_text_field).
const IS_OOAK_BOOLEAN_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — one of a kind", value: "true" }),
  Object.freeze({ label: "No", value: "false" })
]);

const IS_OOAK_TEXT_OPTIONS = Object.freeze([
  Object.freeze({ label: "Yes — one of a kind", value: "Yes — one of a kind" }),
  Object.freeze({ label: "Yes", value: "Yes" }),
  Object.freeze({ label: "true", value: "true" }),
  Object.freeze({ label: "No", value: "No" })
]);

export const BENCH_V2_OPTIONS_BY_KEY = Object.freeze({
  stone_family: Object.freeze([...(DROPDOWN_OPTIONS.stone_family || [])]),
  surface_finish: Object.freeze([...(DROPDOWN_OPTIONS.surface_finish || [])]),
  is_ooak: Object.freeze([...(DROPDOWN_OPTIONS.is_ooak || [])]),
  is_ooak_boolean: IS_OOAK_BOOLEAN_OPTIONS,
  is_ooak_text: IS_OOAK_TEXT_OPTIONS,
  is_one_of_a_kind: Object.freeze([...(DROPDOWN_OPTIONS.is_one_of_a_kind || [])]),
  treated: Object.freeze([...(DROPDOWN_OPTIONS.treated || [])]),
  found_object: Object.freeze([...(DROPDOWN_OPTIONS.found_object || [])]),
  setting_ready: Object.freeze([...(DROPDOWN_OPTIONS.setting_ready || [])]),
  bail_included: Object.freeze([...(DROPDOWN_OPTIONS.bail_included || [])]),
  chain_material: Object.freeze([...(DROPDOWN_OPTIONS.chain_material || [])]),
  collection_name: COLLECTION_NAME_OPTIONS
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

  const isBatch1Writable =
    spec.batchStage === BENCH_V2_BATCH_STAGE.BATCH_1_IMPLEMENTED &&
    spec.writeCapability === BENCH_V2_WRITE_CAPABILITY.BATCH_1_WRITABLE_WITH_EXACT_APPROVAL &&
    spec.owner === "PRODUCT" &&
    spec.namespace === "custom";

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
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "found_object",
    purposeNote: "Wild-found vs. purchased rough provenance."
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
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "treated",
    purposeNote: "Standardized studio treatment dropdown value (e.g. Untreated — Natural)."
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
  // DRAWER 5: MANUAL MEASUREMENTS (SUB_HARNESS_2 — FUTURE BATCH 2 DESCRIPTOR)
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
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    purposeNote: "Future Batch 2 writable target (inspectable read-only in Batch 1)."
  }),
  defineFieldContract({
    destinationKey: "custom.weight_grams",
    namespace: "custom",
    key: "weight_grams",
    label: "Weight (grams)",
    owner: "PRODUCT",
    drawerId: "manual_measurements",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "number_decimal",
    purposeNote: "Future Batch 2 writable target (inspectable read-only in Batch 1)."
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
    expectedType: "number_decimal",
    purposeNote: "Capability #59: storageVerified=false, writerVerified=false. Held read-only until Shopify definition is verified."
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
    expectedType: "single_line_text_field",
    purposeNote: "Capability #60: storageVerified=false, writerVerified=false. Held read-only until Shopify definition is verified."
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
    expectedType: "single_line_text_field",
    purposeNote: "Capability #61: storageVerified=false, writerVerified=false. Held read-only until Shopify definition is verified."
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
    expectedType: "single_line_text_field",
    purposeNote: "Capability #62: storageVerified=false, writerVerified=false. Held read-only until Shopify definition is verified."
  }),

  // ------------------------------------------------------------------------
  // DRAWER 6: CONDITIONAL SETTING/ACCESSORY FACTS (SUB_HARNESS_2 — FUTURE BATCH 2)
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.secondary_medium",
    namespace: "custom",
    key: "secondary_medium",
    label: "Secondary Medium",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.jewelry_type",
    namespace: "custom",
    key: "jewelry_type",
    label: "Jewelry Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.setting_ready",
    namespace: "custom",
    key: "setting_ready",
    label: "Setting Ready",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "setting_ready"
  }),
  defineFieldContract({
    destinationKey: "custom.bail_included",
    namespace: "custom",
    key: "bail_included",
    label: "Bail Included",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "bail_included"
  }),
  defineFieldContract({
    destinationKey: "custom.chain_material",
    namespace: "custom",
    key: "chain_material",
    label: "Chain Material",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255,
    optionsKey: "chain_material"
  }),
  defineFieldContract({
    destinationKey: "custom.chain_link_type",
    namespace: "custom",
    key: "chain_link_type",
    label: "Chain Link Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.jewelry_finding_type",
    namespace: "custom",
    key: "jewelry_finding_type",
    label: "Jewelry Finding Type",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.wire_material",
    namespace: "custom",
    key: "wire_material",
    label: "Wire Material",
    owner: "PRODUCT",
    drawerId: "conditional_setting_accessory",
    subHarness: "SUB_HARNESS_2",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),

  // ------------------------------------------------------------------------
  // DRAWER 7: GEOLOGY (SUB_HARNESS_3 — FUTURE BATCH 2 DESCRIPTOR)
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.mohs_hardness",
    namespace: "custom",
    key: "mohs_hardness",
    label: "Mohs Hardness",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.specific_gravity",
    namespace: "custom",
    key: "specific_gravity",
    label: "Specific Gravity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.crystal_system",
    namespace: "custom",
    key: "crystal_system",
    label: "Crystal System",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.luster",
    namespace: "custom",
    key: "luster",
    label: "Luster",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.cleavage",
    namespace: "custom",
    key: "cleavage",
    label: "Cleavage",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.fracture_pattern",
    namespace: "custom",
    key: "fracture_pattern",
    label: "Fracture Pattern",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.diaphaneity",
    namespace: "custom",
    key: "diaphaneity",
    label: "Diaphaneity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.tenacity",
    namespace: "custom",
    key: "tenacity",
    label: "Tenacity",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.mineral_class",
    namespace: "custom",
    key: "mineral_class",
    label: "Mineral Class",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.rock_composition",
    namespace: "custom",
    key: "rock_composition",
    label: "Rock Composition",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.rock_formation",
    namespace: "custom",
    key: "rock_formation",
    label: "Rock Formation",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.geological_era",
    namespace: "custom",
    key: "geological_era",
    label: "Geological Era",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),
  defineFieldContract({
    destinationKey: "custom.geological_age",
    namespace: "custom",
    key: "geological_age",
    label: "Geological Age",
    owner: "PRODUCT",
    drawerId: "geology",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
  }),

  // ------------------------------------------------------------------------
  // DRAWER 8: OTHER & CHANNEL ATTRIBUTES (SUB_HARNESS_3 — FUTURE BATCH 2)
  // Variant-owned fields remain locked by owner hold and cannot be unlocked
  // by descriptors alone.
  // ------------------------------------------------------------------------
  defineFieldContract({
    destinationKey: "custom.google_product_category",
    namespace: "custom",
    key: "google_product_category",
    label: "Google Product Category",
    owner: "PRODUCT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.FUTURE_BATCH_2_DESCRIPTOR,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.FUTURE_BATCH_UNWIRED_READ_ONLY,
    expectedType: "single_line_text_field",
    maxLength: 255
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
    purposeNote: "Read-only pending verified boolean rules."
  }),
  defineFieldContract({
    destinationKey: "google.age_group",
    namespace: "google",
    key: "age_group",
    label: "Google Age Group (Variant-Owned Hold)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.VARIANT_OWNER_HOLD,
    expectedType: "single_line_text_field",
    purposeNote: "Variant-owned (PRODUCTVARIANT); product-level writer not applicable."
  }),
  defineFieldContract({
    destinationKey: "google.condition",
    namespace: "google",
    key: "condition",
    label: "Google Condition (Variant-Owned Hold)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.VARIANT_OWNER_HOLD,
    expectedType: "single_line_text_field",
    purposeNote: "Variant-owned (PRODUCTVARIANT); product-level writer not applicable."
  }),
  defineFieldContract({
    destinationKey: "google.target_gender",
    namespace: "google",
    key: "target_gender",
    label: "Google Target Gender (Variant-Owned Hold)",
    owner: "PRODUCTVARIANT",
    drawerId: "other_channel",
    subHarness: "SUB_HARNESS_3",
    batchStage: BENCH_V2_BATCH_STAGE.READ_ONLY_HOLD,
    writeCapability: BENCH_V2_WRITE_CAPABILITY.VARIANT_OWNER_HOLD,
    expectedType: "single_line_text_field",
    purposeNote: "Variant-owned (PRODUCTVARIANT); product-level writer not applicable."
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
    canonicalTarget: "google.target_gender"
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
const COLLECTION_DATE_PLACEHOLDER_REGEX = /^(n\/a|none|unknown)$/i;

const isBlankOrWhitespaceOnly = (str) =>
  typeof str !== "string" || str.trim() === "";

export function isExactProductGid(value) {
  return typeof value === "string" && EXACT_PRODUCT_GID_REGEX.test(value);
}

export function getFieldContractByDestination(destinationKey) {
  if (typeof destinationKey !== "string" || destinationKey.trim() === "") return null;
  if (CANCELLED_INERT_DESTINATIONS.has(destinationKey)) return null;
  return BENCH_V2_CONTRACTS_BY_DESTINATION[destinationKey] || null;
}

/**
 * Formats a user-facing display label for OOAK values using the studio Yes/No
 * convention without altering or confusing the underlying stored/proposed string.
 */
export function formatOoakDisplayConvention(rawVal, observedType = null) {
  if (rawVal === undefined || rawVal === null || rawVal === "") {
    return "";
  }
  const strVal = String(rawVal);
  if (strVal === "true") {
    return observedType === "boolean"
      ? 'Yes (stored boolean: "true")'
      : 'Yes (stored text: "true")';
  }
  if (strVal === "false") {
    return observedType === "boolean"
      ? 'No (stored boolean: "false")'
      : 'No (stored text: "false")';
  }
  return strVal;
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
 * Computes a deterministic baseline observation and signature.
 * - Distinguishes missing/absent, null, empty string, and populated string values.
 * - Preserves positively observed raw evidence separately from completeness.
 * - Requires metafieldsReadComplete === true before inferring "absent" on a
 *   product metafield; if a metafield is not present in the map and
 *   metafieldsReadComplete !== true, presence is "unknown_incomplete_read"
 *   and evidenceAvailable is false so partial/unverified reads never manufacture absence.
 */
export function buildBaselineObservation(baselineSnapshot, destinationKey) {
  const contract = getFieldContractByDestination(destinationKey);
  if (!contract) {
    return Object.freeze({
      destinationKey: String(destinationKey || ""),
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
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "baseline_not_loaded",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null,
      signature: `unavailable:not_loaded:${contract.destinationKey}`
    });
  }

  const productGid = baselineSnapshot.productId;
  if (!isExactProductGid(productGid)) {
    return Object.freeze({
      destinationKey: contract.destinationKey,
      evidenceAvailable: false,
      positiveEvidenceObserved: false,
      presence: "invalid_product_gid",
      rawValue: undefined,
      storedType: null,
      liveDefType: null,
      metafieldsCompleteState: "unknown",
      defsCompleteState: "unknown",
      destinationDefError: null,
      signature: `unavailable:invalid_gid:${contract.destinationKey}`
    });
  }

  const completeness = inspectSnapshotCompleteness(baselineSnapshot, contract.destinationKey);

  // Variant-owned metafield baselines are not fabricated from product-level maps
  if (contract.owner === "PRODUCTVARIANT" && contract.namespace !== "native") {
    const varMap = baselineSnapshot.currentVariantMetafields;
    const varReadComplete = baselineSnapshot.variantMetafieldsReadComplete;
    const varCompleteState =
      varReadComplete === true ? "complete" : varReadComplete === false ? "incomplete" : "unknown";

    if (!varMap || typeof varMap !== "object" || Array.isArray(varMap)) {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "variant_baseline_unavailable",
        rawValue: undefined,
        storedType: null,
        liveDefType: null,
        metafieldsCompleteState: varCompleteState,
        defsCompleteState: completeness.defsCompleteState,
        destinationDefError: completeness.destinationDefError,
        signature: `unavailable:variant:${contract.destinationKey}`
      });
    }

    const hasProp = Object.prototype.hasOwnProperty.call(varMap, contract.destinationKey);
    const rawVal = hasProp ? varMap[contract.destinationKey] : undefined;
    const positiveEvidenceObserved = hasProp && rawVal !== undefined;
    const storedType = baselineSnapshot.currentVariantMetafieldTypes?.[contract.destinationKey] || null;

    if (!positiveEvidenceObserved && varCompleteState !== "complete") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
        evidenceAvailable: false,
        positiveEvidenceObserved: false,
        presence: "unknown_incomplete_read",
        rawValue: undefined,
        storedType,
        liveDefType: null,
        metafieldsCompleteState: varCompleteState,
        defsCompleteState: completeness.defsCompleteState,
        destinationDefError: completeness.destinationDefError,
        signature: `unavailable:variant_incomplete_read:${contract.destinationKey}`
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
      evidenceAvailable: true,
      positiveEvidenceObserved,
      presence,
      rawValue: rawVal,
      storedType,
      liveDefType: null,
      metafieldsCompleteState: varCompleteState,
      defsCompleteState: completeness.defsCompleteState,
      destinationDefError: completeness.destinationDefError,
      signature: `${productGid}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${rawVal ?? ""}`
    });
  }

  if (contract.namespace === "native") {
    const nt = baselineSnapshot.nativeTargets;
    if (!nt || typeof nt !== "object") {
      return Object.freeze({
        destinationKey: contract.destinationKey,
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
    evidenceAvailable: true,
    positiveEvidenceObserved,
    presence,
    rawValue: rawVal,
    storedType,
    liveDefType,
    metafieldsCompleteState: completeness.metafieldsCompleteState,
    defsCompleteState: completeness.defsCompleteState,
    destinationDefError: completeness.destinationDefError,
    signature: `${productGid}::${contract.destinationKey}::${presence}::${storedType || "no_stored_type"}::${liveDefType || "no_def_type"}::${ completeness.metafieldsCompleteState }::${ completeness.defsCompleteState }::${rawVal ?? ""}`
  });
}

/**
 * Evaluates whether a Batch 1 contract destination has complete, conflict-free
 * baseline, definition, and type evidence required to unlock write eligibility.
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

  if (!baselineObs.evidenceAvailable) {
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

  if (baselineObs.metafieldsCompleteState !== "complete") {
    return {
      ready: false,
      code: "metafields_read_not_complete",
      verifiedActualType: null,
      reason: `Product metafield enumeration is "${baselineObs.metafieldsCompleteState}" (requires metafieldsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
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
      code: "definitions_read_not_complete",
      verifiedActualType: null,
      reason: `Live PRODUCT metafield definition read is "${baselineObs.defsCompleteState}" (requires defsReadComplete === true) before authorizing writes on "${contract.destinationKey}".`
    };
  }

  const liveDefType = baselineObs.liveDefType;
  const storedType = baselineObs.storedType;

  if (!liveDefType && !storedType) {
    return {
      ready: false,
      code: "missing_type_evidence",
      verifiedActualType: null,
      reason: `Neither live PRODUCT metafield definition nor stored metafield type is present for "${contract.destinationKey}". Guessing a type or creating a definition is forbidden.`
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
  // - Text fields preserve exact untrimmed text and enforce maxLength & plain-text shape guards.
  if (verifiedActualType === "boolean") {
    if (exactValue !== "true" && exactValue !== "false") {
      return {
        valid: false,
        code: "invalid_boolean_literal",
        reason: `Destination "${contract.destinationKey}" has observed Shopify type "boolean" on this product and requires exact "true" or "false" (received "${exactValue}").`
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
 * destinationKey, exact untrimmed proposed string, verified actual type, and
 * current baseline signature. Any subsequent edit to the proposed value
 * (including leading/trailing whitespace) or change in baseline invalidates it.
 */
export function createExactValueApprovalRecord({
  productId,
  destinationKey,
  proposedValue,
  baselineSnapshot
}) {
  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue,
    baselineSnapshot
  });

  if (!validation.valid) {
    return { ok: false, error: validation.reason, code: validation.code, record: null };
  }

  if (validation.isUnchangedFromStored) {
    return {
      ok: false,
      error: `Cannot approve "${destinationKey}": proposed value is identical to the stored Shopify value.`,
      code: "unchanged_from_baseline",
      record: null
    };
  }

  const record = Object.freeze({
    kind: "exact_value_approval",
    productId,
    destinationKey: validation.baselineObservation.destinationKey,
    approvedValue: validation.normalizedValue,
    verifiedType: validation.verifiedActualType,
    baselineSignature: validation.baselineObservation.signature,
    approvedAt: new Date().toISOString()
  });

  return { ok: true, error: null, code: "approved", record };
}

/**
 * Verifies that an existing approval record still matches the exact product,
 * destination, exact untrimmed current proposed value string, verified type,
 * and live baseline signature.
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

  const validation = validateBatch1ProposedValue({
    productId,
    destinationKey,
    proposedValue: currentProposedValue,
    baselineSnapshot
  });
  if (!validation.valid || validation.isUnchangedFromStored) return false;
  if (approvalRecord.verifiedType !== validation.verifiedActualType) return false;
  if (approvalRecord.baselineSignature !== validation.baselineObservation.signature) return false;

  return true;
}

/**
 * Creates a Keep Original decision record bound to the exact product,
 * destinationKey, exact untrimmed rejected proposal string, and observed
 * baseline signature without altering saved Shopify data.
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
    return {
      ok: false,
      error:
        baselineObs.presence === "unknown_incomplete_read"
          ? `Baseline read is incomplete for "${contract.destinationKey}"; cannot bind Keep Original until metafieldsReadComplete === true.`
          : `Baseline evidence is not loaded for "${contract.destinationKey}".`,
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

  const baselineObs = buildBaselineObservation(baselineSnapshot, contract.destinationKey);
  if (!baselineObs.evidenceAvailable) return false;
  if (keepOriginalRecord.baselineSignature !== baselineObs.signature) return false;

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
  const isOoakDestination =
    contract.destinationKey === "custom.is_ooak" ||
    contract.destinationKey === "custom.is_one_of_a_kind";

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
      connectionStatus =
        baselineObs.presence === "unknown_incomplete_read"
          ? `Blocked (Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`
          : "Blocked (Baseline Not Loaded)";
    } else if (!typeAndCompleteness?.ready) {
      if (typeAndCompleteness?.code === "metafields_read_not_complete") {
        connectionStatus = `Blocked (Metafield Read Incomplete: ${baselineObs.metafieldsCompleteState})`;
      } else if (typeAndCompleteness?.code === "definitions_read_not_complete") {
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
      connectionStatus = `Connected (Batch 1 Writable — Verified Type: ${typeAndCompleteness.verifiedActualType})`;
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
    reviewStatus =
      baselineObs.presence === "unknown_incomplete_read"
        ? "Incomplete Baseline Read (Cannot Infer Absence)"
        : "Baseline Unavailable";
    statusReason =
      baselineObs.presence === "unknown_incomplete_read"
        ? `Metafield read completeness is "${baselineObs.metafieldsCompleteState}"; absence is never inferred from partial or unflagged reads.`
        : `Baseline state: ${baselineObs.presence}`;
  } else if (isKeepOriginal) {
    reviewStatus = "Keep Original (Proposal Rejected)";
    statusReason = "Bound to current baseline signature; omitted from save payload.";
  } else if (isApproved) {
    reviewStatus = "Approved for Save (Exact Value Bound)";
    statusReason = `Approved exact value (${validation.verifiedActualType}).`;
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

  const baselineDisplayValue = isOoakDestination
    ? formatOoakDisplayConvention(baselineObs.rawValue, observedType)
    : (baselineObs.rawValue ?? "");

  const proposedDisplayValue = isOoakDestination && hasNonEmptyProposal
    ? formatOoakDisplayConvention(proposedValue, observedType)
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
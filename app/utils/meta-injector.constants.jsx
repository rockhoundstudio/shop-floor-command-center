// ==========================================================================
// ROCKHOUND STUDIO — BENCH CONSTANTS & DROPDOWNS
// File: app/utils/meta-injector.constants.jsx
// (Consolidated Field Catalog Architecture — Universal All-Product Contract)
// ==========================================================================

import {
  UNIVERSAL_CAPABILITY_CONTRACT,
  OWNER_IDENTITY_REGISTRY,
  APPROVED_MEASUREMENT_ADDITIONS,
  REGISTRY_BY_OWNER_IDENTITY,
  PRIMARY_CANDIDATE_DESTINATIONS,
  COMPATIBILITY_REPRESENTATIONS,
  EXCLUDED_INPUT_ENTRIES,
  DUPLICATE_ALIAS_ENTRIES,
  PROTECTED_DATA_ENTRIES,
  UNVERIFIED_PROPOSED_MEASUREMENT_KEYS,
  PRODUCER_ALIGNMENT_PENDING_KEYS,
  TAB3_PARKED_DRAWER_HEADING,
  FIELD_CATALOG,
  isCanonicalCapabilityField,
  CANONICAL_CAPABILITY_FIELDS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
} from "./meta-injector.field-catalog.jsx";

export {
  UNIVERSAL_CAPABILITY_CONTRACT,
  OWNER_IDENTITY_REGISTRY,
  APPROVED_MEASUREMENT_ADDITIONS,
  REGISTRY_BY_OWNER_IDENTITY,
  PRIMARY_CANDIDATE_DESTINATIONS,
  COMPATIBILITY_REPRESENTATIONS,
  EXCLUDED_INPUT_ENTRIES,
  DUPLICATE_ALIAS_ENTRIES,
  PROTECTED_DATA_ENTRIES,
  UNVERIFIED_PROPOSED_MEASUREMENT_KEYS,
  PRODUCER_ALIGNMENT_PENDING_KEYS,
  TAB3_PARKED_DRAWER_HEADING,
  FIELD_CATALOG,
  isCanonicalCapabilityField,
  CANONICAL_CAPABILITY_FIELDS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
};

// 🟢 TEMPORARY DEVELOPMENT AUDIT OVERRIDE
// Ensures every approved canonical template capability remains visible in UI audit views
// without unlocking writes, fabricating applicability, or exposing hidden compatibility adapters.
export const DEV_SHOW_ALL_TEMPLATE_FIELDS = true;

export const STUDIO_DEFAULTS = {
  rescued_by: "Bob and Janyce",
  is_ooak: "true",
  is_one_of_a_kind: "true",
  treated: "Untreated — Natural",
  google_age_group: "adult",
  google_target_gender: "unisex",
  google_condition: "new",
};

export const DROPDOWN_OPTIONS = {};

DROPDOWN_OPTIONS.stone_family = [
  { label: "Agate", value: "Agate" },
  { label: "Amazonite", value: "Amazonite" },
  { label: "Amethyst", value: "Amethyst" },
  { label: "Andesite", value: "Andesite" },
  { label: "Apatite", value: "Apatite" },
  { label: "Aquamarine", value: "Aquamarine" },
  { label: "Argillite", value: "Argillite" },
  { label: "Aventurine", value: "Aventurine" },
  { label: "Azurite", value: "Azurite" },
  { label: "Basalt", value: "Basalt" },
  { label: "Beryl", value: "Beryl" },
  { label: "Biggs Jasper", value: "Biggs Jasper" },
  { label: "Bloodstone", value: "Bloodstone" },
  { label: "Blue Lace Agate", value: "Blue Lace Agate" },
  { label: "Botswana Agate", value: "Botswana Agate" },
  { label: "Brecciated Jasper", value: "Brecciated Jasper" },
  { label: "Brecciated Quartz", value: "Brecciated Quartz" },
  { label: "Bumblebee Jasper", value: "Bumblebee Jasper" },
  { label: "Calcite", value: "Calcite" },
  { label: "Carnelian", value: "Carnelian" },
  { label: "Chalcedony", value: "Chalcedony" },
  { label: "Charoite", value: "Charoite" },
  { label: "Chrysocolla", value: "Chrysocolla" },
  { label: "Chrysoprase", value: "Chrysoprase" },
  { label: "Citrine", value: "Citrine" },
  { label: "Copper", value: "Copper" },
  { label: "Crazy Lace Agate", value: "Crazy Lace Agate" },
  { label: "Dallasite", value: "Dallasite" },
  { label: "Dalmatian Stone", value: "Dalmatian Stone" },
  { label: "Dendritic Agate", value: "Dendritic Agate" },
  { label: "Dumortierite", value: "Dumortierite" },
  { label: "Ellensburg Blue Agate", value: "Ellensburg Blue Agate" },
  { label: "Feldspar", value: "Feldspar" },
  { label: "Fire Agate", value: "Fire Agate" },
  { label: "Fluorite", value: "Fluorite" },
  { label: "Garnet", value: "Garnet" },
  { label: "Gold", value: "Gold" },
  { label: "Gold Sheen Obsidian", value: "Gold Sheen Obsidian" },
  { label: "Granite", value: "Granite" },
  { label: "Hawk's Eye", value: "Hawk's Eye" },
  { label: "Hematite", value: "Hematite" },
  { label: "Hornblende", value: "Hornblende" },
  { label: "Howlite", value: "Howlite" },
  { label: "Ironstone", value: "Ironstone" },
  { label: "Ironstone Matrix", value: "Ironstone Matrix" },
  { label: "Jadeite", value: "Jadeite" },
  { label: "Jasper", value: "Jasper" },
  { label: "Kambaba Jasper", value: "Kambaba Jasper" },
  { label: "Kyanite", value: "Kyanite" },
  { label: "Labradorite", value: "Labradorite" },
  { label: "Lace Agate", value: "Lace Agate" },
  { label: "Lapis Lazuli", value: "Lapis Lazuli" },
  { label: "Larvikite", value: "Larvikite" },
  { label: "Lepidolite", value: "Lepidolite" },
  { label: "Magnesite", value: "Magnesite" },
  { label: "Mahogany Obsidian", value: "Mahogany Obsidian" },
  { label: "Malachite", value: "Malachite" },
  { label: "Montana Agate", value: "Montana Agate" },
  { label: "Mookaite", value: "Mookaite" },
  { label: "Moonstone", value: "Moonstone" },
  { label: "Morrisonite", value: "Morrisonite" },
  { label: "Moss Agate", value: "Moss Agate" },
  { label: "Nephrite", value: "Nephrite" },
  { label: "Obsidian", value: "Obsidian" },
  { label: "Ocean Jasper", value: "Ocean Jasper" },
  { label: "Onyx Marble", value: "Onyx Marble" },
  { label: "Owyhee Jasper", value: "Owyhee Jasper" },
  { label: "Petrified Wood", value: "Petrified Wood" },
  { label: "Picture Jasper", value: "Picture Jasper" },
  { label: "Pietersite", value: "Pietersite" },
  { label: "Plume Agate", value: "Plume Agate" },
  { label: "Prasiolite", value: "Prasiolite" },
  { label: "Prehnite", value: "Prehnite" },
  { label: "Pumice", value: "Pumice" },
  { label: "Pyrite", value: "Pyrite" },
  { label: "Quartz", value: "Quartz" },
  { label: "Quartzite", value: "Quartzite" },
  { label: "Rainbow Obsidian", value: "Rainbow Obsidian" },
  { label: "Red Jasper", value: "Red Jasper" },
  { label: "Rhodochrosite", value: "Rhodochrosite" },
  { label: "Rhodonite", value: "Rhodonite" },
  { label: "Rhyolite", value: "Rhyolite" },
  { label: "Rose Quartz", value: "Rose Quartz" },
  { label: "Rutilated Quartz", value: "Rutilated Quartz" },
  { label: "Serpentine", value: "Serpentine" },
  { label: "Silver", value: "Silver" },
  { label: "Silver Sheen Obsidian", value: "Silver Sheen Obsidian" },
  { label: "Smithsonite", value: "Smithsonite" },
  { label: "Smoky Quartz", value: "Smoky Quartz" },
  { label: "Snowflake Obsidian", value: "Snowflake Obsidian" },
  { label: "Sodalite", value: "Sodalite" },
  { label: "Spinel", value: "Spinel" },
  { label: "Star Garnet", value: "Star Garnet" },
  { label: "Sunstone", value: "Sunstone" },
  { label: "Thunderegg", value: "Thunderegg" },
  { label: "Tiger's Eye", value: "Tiger's Eye" },
  { label: "Topaz", value: "Topaz" },
  { label: "Tourmalinated Quartz", value: "Tourmalinated Quartz" },
  { label: "Tourmaline", value: "Tourmaline" },
  { label: "Tree Agate", value: "Tree Agate" },
  { label: "Turquoise", value: "Turquoise" },
  { label: "Unakite", value: "Unakite" },
  { label: "Variscite", value: "Variscite" },
  { label: "Yellow Jasper", value: "Yellow Jasper" },
];

DROPDOWN_OPTIONS.surface_finish = [
  { label: "High Polish", value: "High Polish" },
  { label: "Satin Polish", value: "Satin Polish" },
  { label: "Matte", value: "Matte" },
  { label: "Waxy", value: "Waxy" },
  { label: "Waxy to Dull", value: "Waxy to Dull" },
  { label: "Vitreous to Pearly", value: "Vitreous to Pearly" },
  { label: "Natural / Rough", value: "Natural / Rough" },
  { label: "Tumbled", value: "Tumbled" }
];

DROPDOWN_OPTIONS.is_ooak = [
  { label: "Yes — one of a kind", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.is_one_of_a_kind = DROPDOWN_OPTIONS.is_ooak;

DROPDOWN_OPTIONS.treated = [
  { label: "Untreated — Natural", value: "Untreated — Natural" },
  { label: "Stabilized", value: "Stabilized" },
  { label: "Dyed", value: "Dyed" },
  { label: "Resined", value: "Resined" },
  { label: "Enhanced", value: "Enhanced" }
];

DROPDOWN_OPTIONS.found_object = [
  { label: "Yes — found in the wild", value: "true" },
  { label: "No — purchased rough", value: "No — purchased rough" }
];

DROPDOWN_OPTIONS.primary_use = [
  { label: "Wearable Art", value: "Wearable Art" },
  { label: "Pendant", value: "Pendant" },
  { label: "Display Piece", value: "Display Piece" },
  { label: "Cabochon — Setting Ready", value: "Cabochon — Setting Ready" },
  { label: "Collector Specimen", value: "Collector Specimen" }
];

DROPDOWN_OPTIONS.setting_ready = [
  { label: "Yes", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.bail_included = [
  { label: "Yes", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.chain_material = [
  { label: "Silver Plated Snake Chain", value: "Silver Plated Snake Chain" },
  { label: "Gold Plated Snake Chain", value: "Gold Plated Snake Chain" },
  { label: "Sterling Silver Chain", value: "Sterling Silver Chain" },
  { label: "Black Cord", value: "Black Cord" },
  { label: "Brown Cord", value: "Brown Cord" },
  { label: "Tan Cord", value: "Tan Cord" },
  { label: "Ivory Cord", value: "Ivory Cord" },
  { label: "White Cord", value: "White Cord" },
  { label: "Gold Cord", value: "Gold Cord" },
  { label: "Red Cord", value: "Red Cord" },
  { label: "Burgundy Cord", value: "Burgundy Cord" },
  { label: "Steel Blue Cord", value: "Steel Blue Cord" },
  { label: "Purple Cord", value: "Purple Cord" },
  { label: "Olive Green Cord", value: "Olive Green Cord" },
  { label: "None", value: "None" }
];

// 🟢 DERIVED EXPORTS (Retained for existing callers)

export const TARGET_KEYS = FIELD_CATALOG
  .filter(f => f.targetIndex !== undefined)
  .sort((a, b) => a.targetIndex - b.targetIndex)
  .map(f => f.key);

export const ROCKHOUND_FIELDS = FIELD_CATALOG
  .filter(f => f.rockhoundIndex !== undefined)
  .sort((a, b) => a.rockhoundIndex - b.rockhoundIndex)
  .map(f => {
    const field = {
      key: f.key,
      label: f.rockhoundLabel || f.label
    };
    if (f.rockhoundConfig?.type) field.type = f.rockhoundConfig.type;
    if (f.rockhoundConfig?.isDropdown) field.isDropdown = true;
    if (f.rockhoundConfig?.multiline) field.multiline = true;
    return field;
  });

const GROUP_DEFINITIONS = [
  { heading: "Core Ignition & Lore", color: "#2E7D32", id: "green" },
  { heading: "Physical Specs & Lapidary Bench", color: "#1565C0", id: "blue" },
  { heading: "Geo-Vault Science", color: "#00695C", id: "teal" },
  { heading: "Jewelry & Hardware Settings", color: "#6A1B9A", id: "purple" },
  { heading: "Google Channels & Attributes", color: "#F9A825", id: "yellow" }
];

export const FULL_META_GROUPS = GROUP_DEFINITIONS.map(groupDef => {
  const groupFields = FIELD_CATALOG.filter(f => f.colorGroup === groupDef.id && f.uiConfig !== undefined);
  return {
    heading: groupDef.heading,
    color: groupDef.color,
    fields: groupFields.map(f => {
      const field = {
        key: f.key,
        label: f.label,
        type: f.uiConfig.type
      };
      if (f.uiConfig.multiline) field.multiline = true;
      return field;
    })
  };
});

export const METAFIELD_CONFIG = FIELD_CATALOG
  .filter(f => f.metaConfig !== undefined && f.metaConfig.definitionVerified !== false)
  .map(f => ({
    namespace: f.metaConfig.namespace || "custom",
    key: f.metaKey || f.key,
    type: f.metaConfig.type,
    label: f.label,
    colorGroup: f.colorGroup,
    options: f.optionsKey ? DROPDOWN_OPTIONS[f.optionsKey] : []
  }));

const TEMPLATE_GROUP_DEFINITIONS = [
  { heading: "Identity", color: "#2E7D32" },
  { heading: "Origin and collection", color: "#1565C0" },
  { heading: "Appearance and character", color: "#00695C" },
  { heading: "Manual measurements", color: "#6A1B9A" },
  { heading: "Treatment", color: "#F9A825" },
  { heading: "Conditional setting/accessory facts", color: "#D84315" },
  { heading: "Geology", color: "#4E342E" },
  { heading: "Other", color: "#424242" },
  { heading: "Standardized Attributes", color: "#546E7A" },
  { heading: "Native and Staging Roles", color: "#37474F" }
];

function projectCatalogFieldForTemplateGroup(f) {
  const isVariantOwned =
    f.owner === "variant_metafield" ||
    (f.registryOwner === "PRODUCTVARIANT" && f.owner !== "native" && f.namespace !== "native");
  const resolvedNamespace =
    f.namespace ||
    (typeof f.registryIdentity === "string" && f.registryIdentity.includes(".")
      ? f.registryIdentity.split(".")[0]
      : "custom");
  const resolvedMetaKey =
    f.metaKey ||
    (typeof f.registryIdentity === "string" && f.registryIdentity.includes(".")
      ? f.registryIdentity.split(".").slice(1).join(".")
      : f.key);
  const resolvedOwner =
    f.owner || (isVariantOwned ? "variant_metafield" : "metafield");
  const resolvedType =
    resolvedOwner === "native" || resolvedNamespace === "native"
      ? (f.type || "native")
      : (f.metaConfig?.type || f.type || "single_line_text_field");

  return {
    key: f.key,
    label: f.label,
    namespace: resolvedNamespace,
    owner: resolvedOwner,
    role: f.role || "custom_fact",
    applicability: f.applicability || "all",
    mappingStatus: f.mappingStatus || "active",
    metaKey: resolvedMetaKey,
    type: resolvedType,
    registryOwner: f.registryOwner || "PRODUCT",
    registryIdentity: f.registryIdentity || `${resolvedNamespace}.${resolvedMetaKey}`,
    registryRole: f.registryRole || "PRIMARY_CANDIDATE_DESTINATION",
    ...(f.capabilityNumber !== undefined ? { capabilityNumber: f.capabilityNumber } : {}),
    ...(f.unit !== undefined ? { unit: f.unit } : {}),
    ...(f.storageVerified !== undefined ? { storageVerified: f.storageVerified } : {}),
    ...(f.writerVerified !== undefined ? { writerVerified: f.writerVerified } : {}),
    ...(f.producerAlignmentPending !== undefined ? { producerAlignmentPending: f.producerAlignmentPending } : {}),
    ...(f.capabilityNote ? { capabilityNote: f.capabilityNote } : {}),
    ...(f.expandsToMediaControls ? { expandsToMediaControls: true } : {}),
    ...(f.control ? { control: f.control } : {}),
    ...(f.optionsKey ? { optionsKey: f.optionsKey } : {}),
    ...(f.canonicalTarget ? { canonicalTarget: f.canonicalTarget } : {})
  };
}

// Normal template projection built strictly from the 62 canonical capabilities (57 core + 5 measurement additions),
// excluding compatibility adapters, source-context, staging, protected, and retired copies.
export const PRODUCT_TEMPLATE_GROUPS = TEMPLATE_GROUP_DEFINITIONS.map(groupDef => {
  const groupFields = FIELD_CATALOG
    .filter(f => f.templateGroup === groupDef.heading && isCanonicalCapabilityField(f))
    .map(projectCatalogFieldForTemplateGroup);
  return {
    heading: groupDef.heading,
    color: groupDef.color,
    fields: groupFields
  };
});

// Tab 3 Complete Inspectable Inventory (93 logical slots = 62 canonical working slots + 31 parked/excluded entries).
// Reconciled directly from EXCLUDED_INPUT_ENTRIES in registry order so all 31 parked entries are owner-aware and unique.
const TAB3_PARKED_TEMPLATE_FIELDS = Object.freeze(
  EXCLUDED_INPUT_ENTRIES.map(regEntry => {
    const matchedCatalogEntry = FIELD_CATALOG.find(
      f =>
        f.registryRole === "EXCLUDED_INPUT" &&
        f.registryOwner === regEntry.owner &&
        f.registryIdentity === regEntry.identity
    );
    if (matchedCatalogEntry) {
      return Object.freeze({
        ...projectCatalogFieldForTemplateGroup(matchedCatalogEntry),
        templateGroup: TAB3_PARKED_DRAWER_HEADING,
        mappingStatus: "pending_read_only",
        isParkedExcluded: true
      });
    }
    const dotIndex = regEntry.identity.indexOf(".");
    const fallbackNamespace = dotIndex > 0 ? regEntry.identity.slice(0, dotIndex) : "custom";
    const fallbackMetaKey = dotIndex > 0 ? regEntry.identity.slice(dotIndex + 1) : regEntry.identity;
    return Object.freeze({
      key: regEntry.identity,
      label: fallbackMetaKey
        .replace(/[_-]/g, " ")
        .replace(/\b\w/g, c => c.toUpperCase()),
      namespace: fallbackNamespace,
      owner: regEntry.owner === "PRODUCTVARIANT" ? "variant_metafield" : "metafield",
      role: "parked_excluded",
      applicability: "parked_excluded",
      mappingStatus: "pending_read_only",
      metaKey: fallbackMetaKey,
      type: "single_line_text_field",
      registryOwner: regEntry.owner,
      registryIdentity: regEntry.identity,
      registryRole: "EXCLUDED_INPUT",
      templateGroup: TAB3_PARKED_DRAWER_HEADING,
      isParkedExcluded: true
    });
  })
);

export const TAB3_INSPECTABLE_TEMPLATE_GROUPS = Object.freeze([
  ...PRODUCT_TEMPLATE_GROUPS,
  Object.freeze({
    heading: TAB3_PARKED_DRAWER_HEADING,
    color: "#616161",
    isParkedGroup: true,
    fields: TAB3_PARKED_TEMPLATE_FIELDS
  })
]);

// ==========================================================================
// PURE TEMPLATE AUDIT COUNT & EXPLICIT APPLICABILITY HELPERS
// ==========================================================================

const isGeneralAltCompatibilityRowKey = (rawKey) =>
  rawKey === "custom.alt_text" || rawKey === "alt_text";

/**
 * Pure helper that computes logical capability counts, group subtotals, actual rendered-row
 * counts, and explicit media-expansion, compatibility-row, and non-media row discrepancies
 * without hardcoding 62 or substituting group.fields.length for missing rendered measurements.
 *
 * When an existing `custom.alt_text` compatibility row is rendered alongside `native_image_alt`
 * controls, it is counted accurately in `renderedCount` / `totalRenderedRows` and tracked
 * explicitly in `compatibilityRowCount` (and group `compatibilityRenderedCount`) so it never
 * inflates logical capability counts (62 / 93 / 7), never inflates `mediaControlCount`
 * (per-photo alt rows), and never produces a false `nonMediaDiscrepancy`.
 *
 * @param {Array} templateGroups - Array of template group objects (defaults to PRODUCT_TEMPLATE_GROUPS).
 * @param {Object|null} renderedMeasurements - Optional consumer-supplied measurements:
 *   - renderedCountByGroup: { [groupHeading]: number }
 *   - renderedKeysByGroup: { [groupHeading]: string[] }
 *   - mediaControlCount: number (actual rendered per-image native_image_alts_* controls)
 *   - hasZeroImagePlaceholder: boolean (whether 1 zero-image native_image_alt placeholder row is rendered)
 *   - compatibilityRowCount: number (optional explicit count of rendered compatibility rows such as custom.alt_text)
 */
export function computeTemplateAuditCounts(
  templateGroups = PRODUCT_TEMPLATE_GROUPS,
  renderedMeasurements = null
) {
  const safeGroups = Array.isArray(templateGroups) ? templateGroups : [];
  const hasMeasurementsObj =
    renderedMeasurements !== null &&
    renderedMeasurements !== undefined &&
    typeof renderedMeasurements === "object";

  const renderedCountByGroup =
    hasMeasurementsObj &&
    renderedMeasurements.renderedCountByGroup &&
    typeof renderedMeasurements.renderedCountByGroup === "object"
      ? renderedMeasurements.renderedCountByGroup
      : null;

  const renderedKeysByGroup =
    hasMeasurementsObj &&
    renderedMeasurements.renderedKeysByGroup &&
    typeof renderedMeasurements.renderedKeysByGroup === "object"
      ? renderedMeasurements.renderedKeysByGroup
      : null;

  let totalLogicalCapabilities = 0;
  let totalLogicalImageAltCapabilities = 0;
  let totalRenderedRows = 0;
  let measuredGroupCount = 0;
  let unmeasuredGroupCount = 0;
  let observedMediaControlCount =
    hasMeasurementsObj && typeof renderedMeasurements.mediaControlCount === "number" && Number.isFinite(renderedMeasurements.mediaControlCount)
      ? Math.max(0, Math.floor(renderedMeasurements.mediaControlCount))
      : null;
  let observedZeroImagePlaceholder =
    hasMeasurementsObj && typeof renderedMeasurements.hasZeroImagePlaceholder === "boolean"
      ? renderedMeasurements.hasZeroImagePlaceholder
      : null;
  let observedCompatibilityRowCount =
    hasMeasurementsObj && typeof renderedMeasurements.compatibilityRowCount === "number" && Number.isFinite(renderedMeasurements.compatibilityRowCount)
      ? Math.max(0, Math.floor(renderedMeasurements.compatibilityRowCount))
      : null;

  let derivedMediaControlsFromKeys = 0;
  let derivedPlaceholderFromKeys = false;
  let derivedCompatibilityRowsFromKeys = 0;
  let sawAnyKeysList = false;

  const groupSubtotals = safeGroups.map((group) => {
    const heading = group?.heading || "Unnamed Group";
    const fields = Array.isArray(group?.fields) ? group.fields : [];
    const logicalCount = fields.length;
    const logicalImageAltCount = fields.filter(
      (f) => f && (f.key === "native_image_alt" || f.registryIdentity === "native_image_alt" || f.expandsToMediaControls === true)
    ).length;

    totalLogicalCapabilities += logicalCount;
    totalLogicalImageAltCapabilities += logicalImageAltCount;

    let groupRenderedCount = null;
    let groupRenderedKeys = null;
    let groupCompatibilityRenderedCount = null;

    if (renderedKeysByGroup && Array.isArray(renderedKeysByGroup[heading])) {
      sawAnyKeysList = true;
      groupRenderedKeys = renderedKeysByGroup[heading];
      groupRenderedCount = groupRenderedKeys.length;
      groupCompatibilityRenderedCount = 0;
      groupRenderedKeys.forEach((k) => {
        if (typeof k === "string") {
          if (k.startsWith("native_image_alts_")) {
            derivedMediaControlsFromKeys += 1;
          } else if (k === "native_image_alt") {
            derivedPlaceholderFromKeys = true;
          } else if (isGeneralAltCompatibilityRowKey(k)) {
            derivedCompatibilityRowsFromKeys += 1;
            groupCompatibilityRenderedCount += 1;
          }
        }
      });
    } else if (
      renderedCountByGroup &&
      typeof renderedCountByGroup[heading] === "number" &&
      Number.isFinite(renderedCountByGroup[heading])
    ) {
      groupRenderedCount = Math.max(0, Math.floor(renderedCountByGroup[heading]));
    }

    const isMeasured = groupRenderedCount !== null;
    if (isMeasured) {
      measuredGroupCount += 1;
      totalRenderedRows += groupRenderedCount;
    } else {
      unmeasuredGroupCount += 1;
    }

    // For groups without native_image_alt, any difference between canonical rendered rows and logical slots is a non-media discrepancy.
    // When rendered keys are provided, exclude native_image_alt, per-image native_image_alts_*, and the existing custom.alt_text
    // compatibility row from nonMediaRenderedCount so the compatibility row is accounted for separately without a false discrepancy.
    const nonMediaLogicalCount = logicalCount - logicalImageAltCount;
    let nonMediaRenderedCount = null;
    if (groupRenderedKeys) {
      nonMediaRenderedCount = groupRenderedKeys.filter(
        (k) =>
          typeof k === "string" &&
          k !== "native_image_alt" &&
          !k.startsWith("native_image_alts_") &&
          !isGeneralAltCompatibilityRowKey(k)
      ).length;
    } else if (isMeasured && logicalImageAltCount === 0) {
      nonMediaRenderedCount = groupRenderedCount;
    }

    const nonMediaDiscrepancy =
      nonMediaRenderedCount !== null ? nonMediaRenderedCount - nonMediaLogicalCount : null;

    return {
      heading,
      logicalCount,
      logicalImageAltCount,
      renderedCount: groupRenderedCount,
      compatibilityRenderedCount: groupCompatibilityRenderedCount,
      measurementStatus: isMeasured ? "measured" : "unmeasured",
      delta: isMeasured ? groupRenderedCount - logicalCount : null,
      nonMediaLogicalCount,
      nonMediaRenderedCount,
      nonMediaDiscrepancy
    };
  });

  if (observedMediaControlCount === null && sawAnyKeysList) {
    observedMediaControlCount = derivedMediaControlsFromKeys;
  }
  if (observedZeroImagePlaceholder === null && sawAnyKeysList) {
    observedZeroImagePlaceholder = derivedPlaceholderFromKeys;
  }
  if (observedCompatibilityRowCount === null && sawAnyKeysList) {
    observedCompatibilityRowCount = derivedCompatibilityRowsFromKeys;
  }

  const allGroupsMeasured = safeGroups.length > 0 && unmeasuredGroupCount === 0;
  const anyGroupMeasured = measuredGroupCount > 0;
  const measurementStatus = allGroupsMeasured
    ? "complete"
    : anyGroupMeasured
      ? "partial_incomplete"
      : "unmeasured";

  const imageAltRenderedRows =
    observedMediaControlCount !== null
      ? observedMediaControlCount + (observedZeroImagePlaceholder ? 1 : 0)
      : null;

  const mediaExpansionDelta =
    imageAltRenderedRows !== null
      ? imageAltRenderedRows - totalLogicalImageAltCapabilities
      : null;

  const compatibilityRowDelta =
    observedCompatibilityRowCount !== null ? observedCompatibilityRowCount : 0;

  const totalLogicalMinusRenderedDelta = allGroupsMeasured
    ? totalRenderedRows - totalLogicalCapabilities
    : null;

  const nonMediaRowDiscrepancy =
    allGroupsMeasured && mediaExpansionDelta !== null
      ? totalLogicalMinusRenderedDelta - mediaExpansionDelta - compatibilityRowDelta
      : null;

  return {
    totalLogicalCapabilities,
    totalLogicalImageAltCapabilities,
    totalRenderedRows: allGroupsMeasured ? totalRenderedRows : null,
    partialRenderedRowsSum: anyGroupMeasured ? totalRenderedRows : null,
    measuredGroupCount,
    unmeasuredGroupCount,
    totalGroupCount: safeGroups.length,
    measurementStatus,
    mediaControlCount: observedMediaControlCount,
    hasZeroImagePlaceholder: observedZeroImagePlaceholder,
    compatibilityRowCount: observedCompatibilityRowCount,
    imageAltRenderedRows,
    mediaExpansionDelta,
    compatibilityRowDelta: observedCompatibilityRowCount !== null ? compatibilityRowDelta : null,
    totalDelta: totalLogicalMinusRenderedDelta,
    nonMediaRowDiscrepancy,
    groupSubtotals
  };
}

/**
 * Pure helper that reports Applicable / Inapplicable ONLY when explicit existing evidence
 * supports it (e.g., confirmed category eligibility on standardized attributes).
 * Never infers Inapplicable from blank, false, or zero values.
 */
export function resolveExplicitApplicabilityState(fieldConfig, evaluationMeta = null) {
  const catElig = evaluationMeta?.categoryEligibility || null;
  if (catElig && catElig.isComplete === true) {
    if (catElig.isEligible === false) {
      return {
        status: "Inapplicable",
        tone: "warning",
        reason: catElig.reason || "Confirmed ineligible for this product's taxonomy category"
      };
    }
    if (catElig.isEligible === true) {
      return {
        status: "Applicable",
        tone: "success",
        reason: catElig.reason || "Confirmed eligible for this product's taxonomy category"
      };
    }
  }

  if (fieldConfig?.applicability === "all_products") {
    return {
      status: "Applicable",
      tone: "success",
      reason: "Universal all-product capability"
    };
  }

  return {
    status: "Not evaluated",
    tone: "info",
    reason: fieldConfig?.applicability
      ? `Scope: ${fieldConfig.applicability} (not evaluated against product instance)`
      : "Applicability not evaluated"
  };
}

export const CHANNEL_REQUIREMENTS = {
  online_store: [
    "piece_name", "primary_medium", "is_ooak", "is_one_of_a_kind",
    "treated", "material", "stone_family",
    "surface_finish", "dimensions_mm", "weight_grams", "origin_story",
    "collection_name", "origin_handle", "origin_page_handle", "primary_use"
  ],
  point_of_sale: [
    "piece_name", "primary_medium", "material", "price",
    "weight_grams", "dimensions_mm"
  ],
  shop_app: [
    "piece_name", "primary_medium", "material", "stone_family",
    "surface_finish", "origin_story", "primary_use",
    "is_ooak", "is_one_of_a_kind", "treated"
  ],
  facebook_instagram: [
    "piece_name", "primary_medium", "material", "price",
    "primary_use", "is_ooak", "is_one_of_a_kind", "treated",
    "surface_finish", "dimensions_mm", "weight_grams"
  ],
  google_youtube: [
    "piece_name", "primary_medium", "material", "price",
    "primary_use", "setting_ready", "bail_included",
    "is_ooak", "is_one_of_a_kind", "treated", "surface_finish",
    "dimensions_mm", "weight_grams", "found_object", "condition",
    "age_group", "target_gender", "authenticity", "rarity", "color_pattern"
  ],
  inbox: [
    "piece_name", "primary_medium", "material", "price"
  ]
};

export function getFieldStatus(key, value, context = {}) {
  const isFilled = value !== undefined && value !== null && value.toString().trim() !== "";
  if (isFilled) return "green";

  const primaryUse = context.primary_use || "";
  const isJewelry = primaryUse === "Wearable Art" || primaryUse === "Pendant";

  const JEWELRY_ONLY_FIELDS = [
    "jewelry_type", "necklace_design", "chain_link_type", "chain_material",
    "jewelry_finding_type", "bail_included", "setting_ready", "wire_material",
    "chain_cord_length_in", "fitting_opening_mm"
  ];

  const ALWAYS_OPTIONAL_FIELDS = [
    "honest_flaws_and_character", "character_marks",
    "secondary_medium", "collection_date", "wire_material",
    "stone_story", "custom_product", "trip_or_series", "alt_text",
    "overall_solid_length_in", "whole_product_weight_grams",
    "chain_cord_length_in", "accessory_dimensions_mm", "fitting_opening_mm"
  ];

  if (ALWAYS_OPTIONAL_FIELDS.includes(key)) return "yellow";

  if (JEWELRY_ONLY_FIELDS.includes(key)) {
    if (isJewelry) {
      const isRequiredByAnyChannel = Object.values(CHANNEL_REQUIREMENTS).some(fields => fields.includes(key));
      return isRequiredByAnyChannel ? "red" : "yellow";
    }
    return "yellow";
  }

  const isRequiredByAnyChannel = Object.values(CHANNEL_REQUIREMENTS).some(fields => fields.includes(key));
  if (isRequiredByAnyChannel) return "red";
  return "yellow";
}

// UPGRADED: Kept all original options + added Smart Switch triggers for Tab 1
export const productTypeOptions = [
  "Cabochon", 
  "Pendant (Finished Jewelry)", 
  "Necklace", 
  "Earrings", 
  "Ring / Bezel Setting", 
  "Bracelet", 
  "Wire Wrap (Finished Jewelry)", 
  "Driftwood Art", 
  "Display Specimen", 
  "Collector Piece", 
  "Other"
];

export const collectionLocationOptions = [
  "Spokane River",
  "Yakima Canyon",
  "Yellowstone River",
  "Richardson's Rock Ranch",
  "The 3,000-Mile Run",
  "Nickel Back",
  "Rufus Serpentine",
  "The Shopped Rock",
  "The Gallery"
];

export const EXCLUDED_TITLES = [
  "Black Cord Necklace", 
  "Sterling Silver Pinch Bail"
];

export const COLOR_GROUP_LABELS = {
  green: { label: "Core Ignition & Lore", color: "#2E7D32" },
  blue: { label: "Physical Specs & Bench", color: "#1565C0" },
  teal: { label: "Geo-Vault Science", color: "#00695C" },
  purple: { label: "Jewelry & Hardware", color: "#6A1B9A" },
  yellow: { label: "Google / SEO", color: "#F9A825" }
};

export function normalizeDropdownValue(key, rawValue) {
  if (!rawValue || rawValue.includes("gid://")) return "";
  if (rawValue === undefined || rawValue === null) return "";
  
  const options = DROPDOWN_OPTIONS[key];
  if (!options || options.length === 0) return String(rawValue);
  
  let cleanRaw = String(rawValue);
  if (cleanRaw.startsWith('[') && cleanRaw.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleanRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cleanRaw = String(parsed[0]);
      }
    } catch (e) {
      // Ignore parse failure, fall back to string cleaning below
    }
  }

  const raw = cleanRaw.toLowerCase().trim();
  const match = options.find(opt =>
    String(opt.value).toLowerCase().trim() === raw ||
    String(opt.label).toLowerCase().trim() === raw
  );
  
  return match ? match.value : String(rawValue);
}

export function getLabelForValue(value, metaobjectHandles = {}) {
  if (!value) return "-";

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(gid => {
        return metaobjectHandles[gid] || gid.split('/').pop();
      }).join(", ");
    }
  } catch (e) {}

  if (typeof value === "string" && value.includes("gid://shopify/Metaobject/")) {
    return metaobjectHandles[value] || value.split('/').pop();
  }

  return value;
}

export const DEFAULT_DROPDOWNS = {
  stone_family: "",
  surface_finish: "",
  is_ooak: "",
  is_one_of_a_kind: "",
  treated: "",
  found_object: "",
  primary_use: "",
  setting_ready: "",
  bail_included: "",
  chain_material: "",
  collection_location: "",
  product_type: ""
};
// ==========================================================================
// ROCKHOUND STUDIO — PRODUCER INPUT, PROVENANCE, ROUTING & PROPOSAL HELPERS
// File: app/utils/meta-injector.autofill-inputs.server.jsx
// Pure stateless producer calculation module: zero DB, zero GraphQL/network,
// zero model calls.
// ==========================================================================

import {
  DROPDOWN_OPTIONS,
  EXCLUDED_TITLES,
  normalizeDropdownValue
} from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS,
  isGenericBareStoneProposal,
  isSettingOrHardwareMediumValue,
  classifyFoundObjectPolarity,
  hasRiverOrFieldCollectionClaim,
  buildSafePurchasedSeoTitle
} from "./meta-injector.standardized.jsx";
import {
  ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  KNOWN_STUDIO_HARDWARE_LENGTH_IN,
  isLegacyGenericStudioCordLabel,
  resolveKnownStudioHardwareOptionLength,
  areHardwareOptionsCompatibleForKnownStudioLength,
  isExactProductGid
} from "./bench-v2.contract.jsx";

export const INVALID_CANDIDATE_FILLERS = new Set([
  "none",
  "unknown",
  "n/a",
  "null",
  "undefined",
  "tbd",
  "not applicable"
]);

// Producer-local provenance set: reuses the 55 shared ENGINE_ALLOWED_PROVENANCE_BARE_KEYS
// (including "chain_cord_length_in") plus legacy "overall_solid_length_in"
// (kept producer-only for legacy Tab 2/3 provenance; permanently cancelled in Bench V2).
export const ALLOWED_PROVENANCE_FIELD_KEYS = new Set([
  ...ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  "overall_solid_length_in"
]);

export const CLASSIFICATION_OVERRIDE_KEYS = new Set([
  "jewelry_type",
  "product_format",
  "google_product_category",
  "color_pattern",
  "primary_color",
  "secondary_colors"
]);

export const PASSIVE_CONSTRUCTION_REVIEW_KEYS = new Set([
  "setting_ready",
  "bail_included",
  "jewelry_finding_type",
  "secondary_medium",
  "wire_material",
  "chain_material",
  "chain_link_type",
  "alt_text"
]);

export const PASSIVE_PROVENANCE_AND_SEO_KEYS = new Set([
  "origin_location",
  "origin_handle",
  "origin_page_handle",
  "collection_location",
  "seo_title",
  "poetic_hook"
]);

export const PASSIVE_GEOLOGY_REVIEW_KEYS = new Set([
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

export const STONE_IDENTITY_KEYS = new Set([
  "primary_medium",
  "material",
  "stone_family"
]);

export function normalizeTitleMojibakeEmDashes(str) {
  return String(str)
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, "—")
    .trim();
}

export function replaceCandidateMojibakeEmDashes(str) {
  return str
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬ ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬"/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬ ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬"/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬"/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â/g, "—")
    .replace(/ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬"/g, "—")
    .replace(/ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â/g, "—");
}

export function splitSegmentedTitle(val) {
  if (typeof val !== "string") return [];
  const normalized = normalizeTitleMojibakeEmDashes(val);
  if (!normalized) return [];
  return normalized.split(/\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean);
}

const STONE_NAME_ADJECTIVES = [
  "Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White",
  "Grey", "Gray", "Brown", "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume",
  "Moss", "Dendritic", "Banded", "Polychrome", "Imperial", "Royal", "Dark", "Light",
  "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled", "Polished", "Natural",
  "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"
];

function extractLastBaseRockWordFromPlainSection(sectionStr) {
  if (typeof sectionStr !== "string") return "Unknown";
  const cleanedSection = cleanStoneFamilyShape(sectionStr.trim());
  if (!cleanedSection) return "Unknown";
  let words = cleanedSection.split(/\s+/).filter(Boolean);
  words = words.filter(
    word => !STONE_NAME_ADJECTIVES.some(adj => adj.toLowerCase() === word.toLowerCase())
  );
  if (words.length > 0) {
    const baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }
  return "Unknown";
}

function findMatchedPicklistStoneFamilyOption(rawFamily) {
  const cleaned = cleanStoneFamilyShape(String(rawFamily || "").trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }

  const options = DROPDOWN_OPTIONS?.stone_family || [];
  const checkOptionMatch = (candidateStr) => {
    const cleanCand = String(candidateStr || "").trim();
    if (!cleanCand) return "";
    const lowerCand = cleanCand.toLowerCase();
    for (const opt of options) {
      if (typeof opt === "object" && opt !== null) {
        const val = String(opt.value || "").trim();
        const label = String(opt.label || "").trim();
        if (val && val.toLowerCase() === lowerCand) return val;
        if (label && label.toLowerCase() === lowerCand) return val || label;
      } else {
        const val = String(opt || "").trim();
        if (val && val.toLowerCase() === lowerCand) return val;
      }
    }
    return "";
  };

  if (typeof normalizeDropdownValue === "function") {
    const normalized = normalizeDropdownValue("stone_family", cleaned);
    if (normalized) {
      const verifiedNormalized = checkOptionMatch(normalized);
      if (verifiedNormalized) return verifiedNormalized;
    }
  }

  return checkOptionMatch(cleaned);
}

function resolveCanonicalBaseFamilyWithoutInclusionSplit(rawCandidate) {
  if (typeof rawCandidate !== "string") return "";
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }
  const directPicklist = findMatchedPicklistStoneFamilyOption(cleaned);
  if (directPicklist) {
    return directPicklist;
  }
  const extracted = extractLastBaseRockWordFromPlainSection(cleaned);
  if (extracted && extracted !== "Unknown") {
    const extractedPicklist = findMatchedPicklistStoneFamilyOption(extracted);
    if (extractedPicklist) {
      return extractedPicklist;
    }
  }
  const derived = getDerivedMaterial(cleaned);
  if (derived && derived !== cleaned) {
    const derivedPicklist = findMatchedPicklistStoneFamilyOption(derived);
    if (derivedPicklist) {
      return derivedPicklist;
    }
  }
  return "";
}

function splitLeadingInclusionClauses(cleanedStr) {
  if (typeof cleanedStr !== "string") return [];
  const trimmed = cleanStoneFamilyShape(cleanedStr.trim());
  if (!trimmed) return [];
  const stems = [];
  const withRegex = /\s+with\s+/gi;
  let match;
  while ((match = withRegex.exec(trimmed)) !== null) {
    const leadingStem = cleanStoneFamilyShape(trimmed.slice(0, match.index).trim());
    const trailingQualifier = trimmed.slice(match.index + match[0].length).trim();
    if (leadingStem && trailingQualifier) {
      stems.push(leadingStem);
    }
  }
  return stems;
}

/**
 * Separates a trailing `with <inclusion...>` qualifier ONLY when the remaining
 * leading stone identity validates under existing canonical stone-family/variety
 * rules (while preserving any full phrase that is itself a direct picklist option).
 * Returns `""` when no `with ...` clause is present or when the remaining stem is
 * ambiguous/unrecognized so unsupported names stay held without guessing.
 */
export function extractValidatedInclusionFreeStoneStem(rawCandidate) {
  if (typeof rawCandidate !== "string") return "";
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }

  // Never split a phrase that is itself an exact supported picklist family.
  if (findMatchedPicklistStoneFamilyOption(cleaned)) {
    return "";
  }

  const candidateStems = splitLeadingInclusionClauses(cleaned);
  for (const stem of candidateStems) {
    if (
      !stem ||
      INVALID_CANDIDATE_FILLERS.has(stem.toLowerCase()) ||
      isGenericBareStoneProposal(stem) ||
      isSettingOrHardwareMediumValue(stem)
    ) {
      continue;
    }
    if (resolveCanonicalBaseFamilyWithoutInclusionSplit(stem) !== "") {
      return stem;
    }
  }
  return "";
}

/**
 * Resolves the canonical stone-identity stem for a specific variety or stone
 * candidate: returns the validated inclusion-free variety stem when a trailing
 * `with <inclusion...>` qualifier was separated (e.g. `"Leopard Rhyolite with Mica"`
 * -> `"Leopard Rhyolite"`), or the shape-cleaned stone string itself when it
 * directly validates under canonical stone rules. Returns `""` for unvalidated
 * or ambiguous strings.
 */
export function resolveValidatedStoneVarietyStem(rawCandidate) {
  if (typeof rawCandidate !== "string") return "";
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }

  if (findMatchedPicklistStoneFamilyOption(cleaned)) {
    return cleaned;
  }

  const inclusionFreeStem = extractValidatedInclusionFreeStoneStem(cleaned);
  if (inclusionFreeStem) {
    return inclusionFreeStem;
  }

  if (resolveCanonicalBaseFamilyWithoutInclusionSplit(cleaned) !== "") {
    return cleaned;
  }

  return "";
}

export function extractStoneName(title) {
  if (!title) return "Unknown";
  const normalized = normalizeTitleMojibakeEmDashes(title);
  const segs = splitSegmentedTitle(normalized);
  const rawSectionOne = segs.length >= 2 ? segs[0] : normalized.split(/[—–-]/)[0].trim();
  const cleanedSectionOne = cleanStoneFamilyShape(rawSectionOne);
  if (!cleanedSectionOne) return "Unknown";

  const validatedInclusionFreeStem = extractValidatedInclusionFreeStoneStem(cleanedSectionOne);
  const targetSection = validatedInclusionFreeStem || cleanedSectionOne;

  // Guard: if an unvalidated "X with Y" phrase did not resolve to a supported
  // stone stem, never derive the trailing inclusion noun ("Mica", "Inclusions", etc.)
  // as the rock name.
  if (!validatedInclusionFreeStem && /\s+with\s+/i.test(cleanedSectionOne)) {
    const plainExtracted = extractLastBaseRockWordFromPlainSection(cleanedSectionOne);
    if (!plainExtracted || !findMatchedPicklistStoneFamilyOption(plainExtracted)) {
      return "Unknown";
    }
    return plainExtracted;
  }

  return extractLastBaseRockWordFromPlainSection(targetSection);
}

export function resolvePicklistStoneFamily(rawFamily) {
  const cleaned = cleanStoneFamilyShape(String(rawFamily || "").trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown stone" ||
    cleaned.toLowerCase() === "unknown" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned)
  ) {
    return "";
  }
  if (isSettingOrHardwareMediumValue(cleaned)) {
    return "";
  }

  const directPicklistMatch = findMatchedPicklistStoneFamilyOption(cleaned);
  if (directPicklistMatch) {
    return directPicklistMatch;
  }

  const inclusionFreeStem = extractValidatedInclusionFreeStoneStem(cleaned);
  if (inclusionFreeStem) {
    const stemBaseFamily = resolveCanonicalBaseFamilyWithoutInclusionSplit(inclusionFreeStem);
    if (stemBaseFamily) {
      return stemBaseFamily;
    }
  }

  const extracted = extractStoneName(cleaned);
  if (extracted && extracted !== "Unknown") {
    const extractedPicklistMatch = findMatchedPicklistStoneFamilyOption(extracted);
    if (extractedPicklistMatch) {
      return extractedPicklistMatch;
    }
  }

  const derived = getDerivedMaterial(cleaned);
  if (derived && derived !== cleaned) {
    const derivedPicklistMatch = findMatchedPicklistStoneFamilyOption(derived);
    if (derivedPicklistMatch) {
      return derivedPicklistMatch;
    }
  }

  return "";
}

export function isSupportedPicklistStoneFamily(rawFamily) {
  return findMatchedPicklistStoneFamilyOption(rawFamily) !== "";
}

export function resolveCanonicalBaseFamilyForStoneCandidate(rawCandidate) {
  if (typeof rawCandidate !== "string") return "";
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }

  const directPicklistMatch = findMatchedPicklistStoneFamilyOption(cleaned);
  if (directPicklistMatch) {
    return directPicklistMatch;
  }

  const inclusionFreeStem = extractValidatedInclusionFreeStoneStem(cleaned);
  if (inclusionFreeStem) {
    return resolveCanonicalBaseFamilyWithoutInclusionSplit(inclusionFreeStem);
  }

  return resolveCanonicalBaseFamilyWithoutInclusionSplit(cleaned);
}

export function isValidatedSpecificVarietyOfBaseFamily(rawCandidate, targetBaseFamily = "") {
  if (typeof rawCandidate !== "string") return false;
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (!cleaned) return false;
  const candidateBaseFamily = resolveCanonicalBaseFamilyForStoneCandidate(cleaned);
  if (!candidateBaseFamily) return false;

  const varietyStem = resolveValidatedStoneVarietyStem(cleaned) || cleaned;
  if (
    cleaned.toLowerCase() === candidateBaseFamily.toLowerCase() ||
    varietyStem.toLowerCase() === candidateBaseFamily.toLowerCase()
  ) {
    return false;
  }

  if (targetBaseFamily) {
    const cleanTargetFamily = resolveCanonicalBaseFamilyForStoneCandidate(targetBaseFamily);
    if (
      !cleanTargetFamily ||
      candidateBaseFamily.toLowerCase() !== cleanTargetFamily.toLowerCase()
    ) {
      return false;
    }
  }
  return true;
}

/**
 * Returns the ordered exact authoritative-DB lookup keys (`lowercase`) that are
 * allowed to satisfy a validated specific stone variety without degrading to its
 * generic base family:
 *   1) Full shape-cleaned candidate (e.g. `"leopard rhyolite with mica inclusions"`)
 *   2) Validated inclusion-free variety stem when distinct and still a specific
 *      variety of the same base family (e.g. `"leopard rhyolite"`)
 * Never includes the generic base family (e.g. `"rhyolite"`).
 */
export function buildAllowedSpecificVarietyDbMatchNames(rawCandidate, targetBaseFamily = "") {
  if (typeof rawCandidate !== "string") return [];
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (!cleaned) return [];
  if (!isValidatedSpecificVarietyOfBaseFamily(cleaned, targetBaseFamily)) {
    return [];
  }

  const allowed = [];
  const seenLower = new Set();
  const pushUnique = (val) => {
    if (typeof val !== "string") return;
    const trimmed = cleanStoneFamilyShape(val.trim());
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      allowed.push(lower);
    }
  };

  pushUnique(cleaned);
  const varietyStem = extractValidatedInclusionFreeStoneStem(cleaned);
  if (
    varietyStem &&
    isValidatedSpecificVarietyOfBaseFamily(varietyStem, targetBaseFamily)
  ) {
    pushUnique(varietyStem);
  }

  return allowed;
}

function isConfirmedPicklistOrVarietyStoneIdentity(rawCandidate) {
  return resolveCanonicalBaseFamilyForStoneCandidate(rawCandidate) !== "";
}

const EXACT_CANONICAL_ROCK_COMPOSITION_LABELS = Object.freeze({
  agate: "Agate",
  "banded iron": "Banded iron",
  basalt: "Basalt",
  chert: "Chert",
  conglomerate: "Conglomerate",
  gabbro: "Gabbro",
  gneiss: "Gneiss",
  granite: "Granite",
  jasper: "Jasper",
  limestone: "Limestone",
  marble: "Marble",
  obsidian: "Obsidian",
  peridotite: "Peridotite",
  pumice: "Pumice",
  quartzite: "Quartzite",
  rhyolite: "Rhyolite",
  sandstone: "Sandstone",
  schist: "Schist",
  scoria: "Scoria",
  shale: "Shale",
  slate: "Slate"
});

/**
 * Bounded canonical normalization for the 4 producer-backed standardized
 * geology reference companions (`shopify.crystal-system`, `shopify.mineral-class`,
 * `shopify.rock-composition`, `shopify.rock-formation`).
 *
 * - Full descriptive DB strings remain untouched in `custom.*`.
 * - Maps only unambiguous observed equivalents:
 *     * `shopify.crystal-system`: `"Trigonal (Microcrystalline Quartz)"` -> `"Trigonal"`
 *     * `shopify.mineral-class`: `"Silicate"` / `"Silicate (Quartz Group)"` -> `"Silicates"`
 *     * `shopify.rock-composition`: maps ONLY when `confirmedRockIdentity` (from
 *       confirmed current stone identity/provenance) or `rawGeoStr` itself is an
 *       exact canonical rock composition label (e.g. `"Jasper"`). Never maps generic
 *       `SiO2` / chemical descriptions to a rock identity when stone identity is
 *       not an exact canonical rock label; retains the original descriptive string
 *       so downstream resolution holds it with a clear diagnostic reason.
 *     * `shopify.rock-formation`: maps exact `"Sedimentary"` or the accepted
 *       combined Geo Library phrase `"Sedimentary / Hydrothermal precipitation"`
 *       (ignoring case and permitting whitespace around `/`) -> `"Sedimentary"`.
 *       All other multi-mechanism or unrecognized formation strings remain as-is
 *       so downstream resolution holds them as ambiguous/unmatched without global
 *       hydrothermal stripping or arbitrary mixed-label classification.
 */
export function normalizeCanonicalGeologyReferenceCandidate(
  geoKey,
  rawGeoStr,
  confirmedRockIdentity = ""
) {
  const cleaned = sanitizeCandidateString(rawGeoStr);
  if (!cleaned) return "";

  const collapsed = cleaned.replace(/\s+/g, " ").trim();
  const lower = collapsed.toLowerCase();

  if (geoKey === "crystal_system" || geoKey === "shopify.crystal-system") {
    if (
      lower === "trigonal" ||
      /^trigonal\s*\(\s*microcrystalline\s+quartz\s*\)$/i.test(collapsed)
    ) {
      return "Trigonal";
    }
    return collapsed;
  }

  if (geoKey === "mineral_class" || geoKey === "shopify.mineral-class") {
    if (
      lower === "silicates" ||
      lower === "silicate" ||
      /^silicates?\s*\(\s*quartz\s+group\s*\)$/i.test(collapsed)
    ) {
      return "Silicates";
    }
    return collapsed;
  }

  if (geoKey === "rock_composition" || geoKey === "shopify.rock-composition") {
    if (Object.prototype.hasOwnProperty.call(EXACT_CANONICAL_ROCK_COMPOSITION_LABELS, lower)) {
      return EXACT_CANONICAL_ROCK_COMPOSITION_LABELS[lower];
    }
    const cleanIdentity = sanitizeCandidateString(confirmedRockIdentity)
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    if (
      cleanIdentity &&
      Object.prototype.hasOwnProperty.call(EXACT_CANONICAL_ROCK_COMPOSITION_LABELS, cleanIdentity)
    ) {
      return EXACT_CANONICAL_ROCK_COMPOSITION_LABELS[cleanIdentity];
    }
    return collapsed;
  }

  if (geoKey === "rock_formation" || geoKey === "shopify.rock-formation") {
    if (
      lower === "sedimentary" ||
      /^sedimentary\s*\/\s*hydrothermal\s+precipitation$/i.test(collapsed)
    ) {
      return "Sedimentary";
    }
    return collapsed;
  }

  return collapsed;
}

export function resolveEvidencedOriginLocation(rawOrigin) {
  const raw = String(rawOrigin || "").trim();
  if (!raw || raw.toLowerCase() === "unknown origin" || raw.toLowerCase() === "unknown") {
    return "";
  }
  if (typeof normalizeDropdownValue === "function") {
    const normalized = normalizeDropdownValue("origin_location", raw) || normalizeDropdownValue("collection_location", raw);
    if (normalized) return enforceOriginOverrides(normalized);
  }
  return enforceOriginOverrides(raw);
}

export function resolveOriginHandle(locationSegment, pagesList, explicitHandle = "") {
  const cleanExplicit = String(explicitHandle || "").replace(/^\/pages\//i, "").trim();
  if (cleanExplicit && pagesList.some(p => p.handle === cleanExplicit)) {
    return cleanExplicit;
  }

  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (!cleanLoc || cleanLoc === "unknown origin") return "";

  let targetHandle = "";
  if (cleanLoc.includes("richardson")) targetHandle = "the-richardson-strike";
  else if (cleanLoc.includes("irv")) targetHandle = "";
  else if (cleanLoc.includes("spokane")) targetHandle = "";
  else if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc === "nor" || cleanLoc.startsWith("nor ")) targetHandle = "the-north-fork-strike";
  else if (cleanLoc.includes("yakima") || cleanLoc.includes("chert") || cleanLoc === "yak" || cleanLoc.startsWith("yak ")) targetHandle = "the-shop-lore-chert-road-detour-yakima-river-jasper";
  else {
    const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
    targetHandle = match ? match.handle : "";
  }

  if (targetHandle && pagesList.some(p => p.handle === targetHandle)) {
    return targetHandle;
  }
  return "";
}

export function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = [], explicitCollectionName = "") {
  const cleanExplicitName = String(explicitCollectionName || "").trim();
  if (cleanExplicitName) {
    const exactCol = collectionsList.find(c =>
      c.title.toLowerCase() === cleanExplicitName.toLowerCase() ||
      c.handle.toLowerCase() === cleanExplicitName.toLowerCase()
    );
    if (exactCol) {
      return {
        slug: exactCol.handle,
        name: exactCol.title
      };
    }
  }

  const cleanLoc = (locationSegment || "").toLowerCase().trim();

  let targetSlug = "";
  let targetName = "";

  if (!cleanLoc || cleanLoc === "unknown origin") {
    return { slug: "", name: cleanExplicitName || "" };
  }

  if (cleanLoc.includes("yakima") || cleanLoc.includes("chert") || cleanLoc === "yak" || cleanLoc.startsWith("yak ")) { targetSlug = "yakima-canyon"; targetName = "Yakima River Canyon"; }
  else if (cleanLoc.includes("richardson")) { targetSlug = "richardsons-rock-ranch"; targetName = "Richardson's Rock Ranch Collection"; }
  else if (cleanLoc.includes("spokane")) { targetSlug = "the-spokane-river-collection"; targetName = "Spokane River Stones and Stories"; }
  else if (cleanLoc.includes("irv")) { targetSlug = ""; targetName = ""; }
  else if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc === "nor" || cleanLoc.startsWith("nor ")) { targetSlug = "north-fork-cda-collection"; targetName = "North Fork CdA Collection"; }
  else {
    const matchedCol = collectionsList.find(c =>
      (defaultOriginSlug && c.url.includes(defaultOriginSlug)) ||
      (cleanLoc && c.title.toLowerCase().includes(cleanLoc))
    );
    if (matchedCol) {
      targetSlug = matchedCol.handle;
      targetName = matchedCol.title.endsWith("Collection") ? matchedCol.title : `${matchedCol.title} Collection`;
    } else {
      targetSlug = "";
      targetName = cleanExplicitName || "";
    }
  }

  if (targetSlug && collectionsList.some(c => c.handle === targetSlug)) {
    return { slug: targetSlug, name: targetName };
  }
  return { slug: "", name: targetName };
}

export function normalizeOoakToken(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val).trim();
  if (!str) return "";
  const lower = str.toLowerCase();
  if (lower === "yes" || lower === "true" || lower === "1" || lower === "ooak" || lower === "one-of-a-kind") {
    return "Yes";
  }
  if (lower === "no" || lower === "false" || lower === "0") {
    return "No";
  }
  return str;
}

export function resolveCanonicalOoakFromInputs(inputs = {}, aiProposal = undefined) {
  const explicitCanonical = normalizeOoakToken(inputs.is_one_of_a_kind ?? inputs["custom.is_one_of_a_kind"]);
  const explicitLegacy = normalizeOoakToken(inputs.is_ooak ?? inputs["custom.is_ooak"]);

  if (explicitCanonical && explicitLegacy && explicitCanonical !== explicitLegacy) {
    return { value: "", conflict: true };
  }
  if (explicitCanonical || explicitLegacy) {
    return { value: explicitCanonical || explicitLegacy, conflict: false };
  }

  const proposed = normalizeOoakToken(
    aiProposal?.is_one_of_a_kind ?? aiProposal?.is_ooak
  );
  if (proposed) {
    return { value: proposed, conflict: false };
  }
  return { value: "", conflict: false };
}

export function classifyOoakFactualPolarity(rawVal) {
  if (rawVal === undefined || rawVal === null) return null;
  if (typeof rawVal === "boolean") return rawVal ? "yes" : "no";
  const str = String(rawVal).trim();
  if (!str) return null;
  const lower = str.toLowerCase();
  if (
    lower === "yes" ||
    lower === "true" ||
    lower === "1" ||
    lower === "ooak" ||
    lower === "one-of-a-kind" ||
    lower.startsWith("yes ") ||
    lower.startsWith("yes—") ||
    lower.startsWith("yes -") ||
    lower.startsWith("yes Ã¢â‚¬â€") ||
    lower.startsWith("yes ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â")
  ) {
    return "yes";
  }
  if (
    lower === "no" ||
    lower === "false" ||
    lower === "0" ||
    lower.startsWith("no ") ||
    lower.startsWith("no—") ||
    lower.startsWith("no -") ||
    lower.startsWith("no Ã¢â‚¬â€") ||
    lower.startsWith("no ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â")
  ) {
    return "no";
  }
  return null;
}

export function formatBenchV2OoakProposalForType(rawVal, polarity, observedType) {
  const cleanRaw = typeof rawVal === "string" ? sanitizeCandidateString(rawVal) : "";
  if (observedType === "boolean") {
    if (polarity === "yes") return { ok: true, value: "true" };
    if (polarity === "no") return { ok: true, value: "false" };
    return {
      ok: false,
      reason: `Cannot format OOAK proposal "${cleanRaw}" as boolean ("true"/"false").`
    };
  }
  if (observedType === "single_line_text_field") {
    if (cleanRaw && cleanRaw.toLowerCase() !== "true" && cleanRaw.toLowerCase() !== "false") {
      return { ok: true, value: cleanRaw };
    }
    if (polarity === "yes") return { ok: true, value: "Yes" };
    if (polarity === "no") return { ok: true, value: "No" };
    return {
      ok: false,
      reason: `Cannot format OOAK proposal "${cleanRaw}" as single_line_text_field.`
    };
  }
  if (!observedType) {
    return {
      ok: false,
      reason: "Observed type was not supplied or is unknown; omitted OOAK proposal."
    };
  }
  return {
    ok: false,
    reason: `Unsupported observed type "${observedType}"; omitted OOAK proposal.`
  };
}

export function parseIdentityAndOriginInputs(body, provenance = null) {
  const rawProductTitle = (body.get("productTitle") || "").trim();
  const rawPieceName = (body.get("pieceName") || body.get("piece_name") || "").trim();
  const rawHumanId = (body.get("humanPieceId") || "").trim();
  const rawPostedStoneFamily = (body.get("stone_family") || "").trim();
  const rawPostedOriginLocation = (body.get("origin_location") || "").trim();
  const rawPostedOriginHandle = (body.get("origin_handle") || body.get("origin_page_handle") || "").trim();
  const rawPostedCollectionName = (body.get("collection_name") || body.get("collectionName") || "").trim();
  const rawFoundObject = body.get("found_object") ?? body.get("custom.found_object");
  const foundObjectPolarity = classifyFoundObjectPolarity(rawFoundObject);

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const passiveStoredSet = hasValidProvenance ? provenance.passiveStoredSet : new Set();

  const isFieldPassiveOnly = (bareKey) =>
    hasValidProvenance && passiveStoredSet.has(bareKey) && !operatorLockedSet.has(bareKey);

  const isStoneFamilyOperatorLocked =
    hasValidProvenance
      ? operatorLockedSet.has("stone_family") && Boolean(rawPostedStoneFamily)
      : Boolean(rawPostedStoneFamily);
  const isOriginOperatorLocked =
    hasValidProvenance
      ? operatorLockedSet.has("origin_location") && Boolean(rawPostedOriginLocation)
      : Boolean(rawPostedOriginLocation);
  const isOriginHandleOperatorLocked =
    hasValidProvenance
      ? (operatorLockedSet.has("origin_handle") || operatorLockedSet.has("origin_page_handle")) && Boolean(rawPostedOriginHandle)
      : Boolean(rawPostedOriginHandle);
  const isCollectionNameOperatorLocked =
    hasValidProvenance
      ? operatorLockedSet.has("collection_name") && Boolean(rawPostedCollectionName)
      : Boolean(rawPostedCollectionName);
  const isFoundObjectOperatorLocked =
    hasValidProvenance
      ? operatorLockedSet.has("found_object") && Boolean(rawFoundObject && String(rawFoundObject).trim() !== "")
      : Boolean(rawFoundObject && String(rawFoundObject).trim() !== "");

  const isPurchasedProvenance = foundObjectPolarity === "purchased";

  const productTitleSegments = splitSegmentedTitle(rawProductTitle);
  const pieceNameSegments = splitSegmentedTitle(rawPieceName);

  const hasSegmentedProductTitle = productTitleSegments.length >= 3;
  const hasSegmentedPieceName = pieceNameSegments.length >= 3;

  let preservedPieceName = "";
  if (rawHumanId) {
    preservedPieceName = rawHumanId;
  } else if (rawPieceName && !hasSegmentedPieceName) {
    preservedPieceName = rawPieceName;
  } else if (hasSegmentedPieceName) {
    preservedPieceName = pieceNameSegments[pieceNameSegments.length - 1];
  } else if (hasSegmentedProductTitle) {
    preservedPieceName = productTitleSegments[productTitleSegments.length - 1];
  } else if (rawProductTitle && !hasSegmentedProductTitle) {
    preservedPieceName = rawProductTitle;
  }

  const titleFamilyCandidate = hasSegmentedProductTitle
    ? productTitleSegments[0]
    : (hasSegmentedPieceName ? pieceNameSegments[0] : "");

  const titleOriginCandidate = (isPurchasedProvenance || isOriginOperatorLocked)
    ? ""
    : (hasSegmentedProductTitle
        ? productTitleSegments[1]
        : (hasSegmentedPieceName ? pieceNameSegments[1] : ""));

  const validPostedStoneFamily = !isSettingOrHardwareMediumValue(rawPostedStoneFamily)
    ? rawPostedStoneFamily
    : "";
  const validLockedStoneFamily = isStoneFamilyOperatorLocked ? validPostedStoneFamily : "";
  const validPassiveStoneFamily =
    !isStoneFamilyOperatorLocked && !isFieldPassiveOnly("stone_family")
      ? validPostedStoneFamily
      : (isFieldPassiveOnly("stone_family") ? validPostedStoneFamily : "");

  // Explicit operator-locked stone_family takes priority; otherwise a 3-segment title
  // family candidate leads over passive stored stone_family, falling back to passive if title has none.
  const rawFamilySource =
    validLockedStoneFamily ||
    titleFamilyCandidate ||
    validPassiveStoneFamily ||
     "";
  const derivedFamily = resolvePicklistStoneFamily(
    !validLockedStoneFamily && titleFamilyCandidate && extractStoneName(titleFamilyCandidate) !== "Unknown"
      ? extractStoneName(titleFamilyCandidate)
      : rawFamilySource
  ) || resolvePicklistStoneFamily(rawFamilySource);
  const derivedShape =
    extractShapeFromString(titleFamilyCandidate || rawFamilySource);

  const rawOriginSource = isOriginOperatorLocked
    ? rawPostedOriginLocation
    : isPurchasedProvenance
      ? (!isFieldPassiveOnly("origin_location") ? rawPostedOriginLocation : "")
      : (titleOriginCandidate || rawPostedOriginLocation || "");
  const originSegment = isOriginOperatorLocked
    ? rawPostedOriginLocation
    : resolveEvidencedOriginLocation(rawOriginSource);

  const explicitOriginHandle = isOriginHandleOperatorLocked
    ? rawPostedOriginHandle
    : (!hasValidProvenance ? rawPostedOriginHandle : "");
  const explicitCollectionName = isCollectionNameOperatorLocked
    ? rawPostedCollectionName
    : (!hasValidProvenance ? rawPostedCollectionName : "");

  return {
    rawTitleInput: rawProductTitle || rawPieceName,
    hasSegmentedTitle: hasSegmentedProductTitle || hasSegmentedPieceName,
    titleStoneSegment: !isSettingOrHardwareMediumValue(titleFamilyCandidate)
      ? cleanStoneFamilyShape(titleFamilyCandidate)
      : "",
    preservedPieceName,
    derivedFamily,
    derivedShape,
    originSegment,
    explicitStoneFamily: Boolean(validLockedStoneFamily),
    explicitOriginLocation: Boolean(isOriginOperatorLocked),
    explicitOriginHandle,
    explicitCollectionName,
    rawFoundObject: rawFoundObject !== null && rawFoundObject !== undefined ? String(rawFoundObject).trim() : "",
    foundObjectPolarity,
    isPurchasedProvenance,
    isOriginOperatorLocked,
    isStoneFamilyOperatorLocked,
    isFoundObjectOperatorLocked,
    hasValidProvenance,
    operatorLockedSet,
    passiveStoredSet
  };
}

export function buildGeoLookupCandidates({
  idOrigin,
  stoneIdentityContext,
  currentData = {},
  provenance = null
}) {
  const candidates = [];
  const seenLower = new Set();

  const pushSingleCandidate = (rawVal) => {
    if (typeof rawVal !== "string") return;
    const cleaned = cleanStoneFamilyShape(rawVal.trim());
    if (
      !cleaned ||
      cleaned.toLowerCase() === "unknown" ||
      cleaned.toLowerCase() === "unknown stone" ||
      INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
      isGenericBareStoneProposal(cleaned) ||
      isSettingOrHardwareMediumValue(cleaned)
    ) {
      return;
    }
    const lower = cleaned.toLowerCase();
    if (!seenLower.has(lower)) {
      seenLower.add(lower);
      candidates.push(cleaned);
    }
  };

  const pushCandidateWithVarietyStem = (rawVal) => {
    if (typeof rawVal !== "string") return;
    const cleaned = cleanStoneFamilyShape(rawVal.trim());
    if (!cleaned) return;
    pushSingleCandidate(cleaned);
    const inclusionFreeStem = extractValidatedInclusionFreeStoneStem(cleaned);
    if (
      inclusionFreeStem &&
      isValidatedSpecificVarietyOfBaseFamily(inclusionFreeStem)
    ) {
      pushSingleCandidate(inclusionFreeStem);
    }
  };

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();

  if (operatorLockedSet.has("material") && currentData.material) {
    pushCandidateWithVarietyStem(currentData.material);
  }
  if (operatorLockedSet.has("primary_medium") && currentData.primary_medium) {
    pushCandidateWithVarietyStem(currentData.primary_medium);
  }
  if (operatorLockedSet.has("stone_family") && currentData.stone_family) {
    pushCandidateWithVarietyStem(currentData.stone_family);
  }
  if (idOrigin?.titleStoneSegment && isConfirmedPicklistOrVarietyStoneIdentity(idOrigin.titleStoneSegment)) {
    pushCandidateWithVarietyStem(idOrigin.titleStoneSegment);
  }
  if (stoneIdentityContext?.effectiveMaterial) {
    pushCandidateWithVarietyStem(stoneIdentityContext.effectiveMaterial);
  }
  if (stoneIdentityContext?.effectiveFamily) {
    pushSingleCandidate(stoneIdentityContext.effectiveFamily);
  }
  if (idOrigin?.derivedFamily) {
    pushSingleCandidate(idOrigin.derivedFamily);
  }

  return candidates;
}

export function resolveVerifiedStoneIdentityContext(inputs = {}, derivedTitleFamily = "", provenance = null) {
  const rawStoneFamily = String(inputs.stone_family || "").trim();
  const rawMaterial = String(inputs.material || "").trim();
  const rawPrimaryMedium = String(inputs.primary_medium || "").trim();

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const passiveStoredSet = hasValidProvenance ? provenance.passiveStoredSet : new Set();

  const isPassiveOnly = (k) =>
    hasValidProvenance && passiveStoredSet.has(k) && !operatorLockedSet.has(k);

  const familyIsHardware = isSettingOrHardwareMediumValue(rawStoneFamily);
  const materialIsHardware = isSettingOrHardwareMediumValue(rawMaterial);
  const primaryMediumIsHardware = isSettingOrHardwareMediumValue(rawPrimaryMedium);

  const validStoneFamily = !familyIsHardware && rawStoneFamily
    ? resolvePicklistStoneFamily(rawStoneFamily)
    : "";
  const validMaterial = !materialIsHardware && rawMaterial && !isGenericBareStoneProposal(rawMaterial)
    ? rawMaterial
    : "";
  const validPrimaryMedium = !primaryMediumIsHardware && rawPrimaryMedium && !isGenericBareStoneProposal(rawPrimaryMedium)
    ? rawPrimaryMedium
    : "";
  const validDerivedTitleFamily = !isSettingOrHardwareMediumValue(derivedTitleFamily) && derivedTitleFamily
    ? resolvePicklistStoneFamily(derivedTitleFamily)
    : "";

  const lockedStoneFamily = !isPassiveOnly("stone_family") ? validStoneFamily : "";
  const lockedMaterial = !isPassiveOnly("material") ? validMaterial : "";
  const lockedPrimaryMedium = !isPassiveOnly("primary_medium") ? validPrimaryMedium : "";

  const effectiveFamily =
    lockedStoneFamily ||
    validDerivedTitleFamily ||
    (lockedMaterial ? resolvePicklistStoneFamily(lockedMaterial) : "") ||
    (lockedPrimaryMedium ? resolvePicklistStoneFamily(lockedPrimaryMedium) : "") ||
    validStoneFamily ||
    (validMaterial ? resolvePicklistStoneFamily(validMaterial) : "") ||
    (validPrimaryMedium ? resolvePicklistStoneFamily(validPrimaryMedium) : "");

  const effectiveMaterial =
    lockedMaterial ||
    lockedPrimaryMedium ||
    validMaterial ||
    validPrimaryMedium ||
    effectiveFamily ||
    "";

  const effectivePrimaryMedium =
    lockedPrimaryMedium ||
    lockedMaterial ||
    validPrimaryMedium ||
    validMaterial ||
    effectiveFamily ||
    "";

  const hadHardwareContamination = Boolean(
    (rawStoneFamily && familyIsHardware) ||
    (rawMaterial && materialIsHardware) ||
    (rawPrimaryMedium && primaryMediumIsHardware)
  );

  const contaminatedFields = [];
  if (rawPrimaryMedium && primaryMediumIsHardware) {
    contaminatedFields.push(`primary_medium ("${rawPrimaryMedium}")`);
  }
  if (rawMaterial && materialIsHardware) {
    contaminatedFields.push(`material ("${rawMaterial}")`);
  }
  if (rawStoneFamily && familyIsHardware) {
    contaminatedFields.push(`stone_family ("${rawStoneFamily}")`);
  }

  return {
    effectiveFamily,
    effectiveMaterial,
    effectivePrimaryMedium,
    hadHardwareContamination,
    contaminatedFields,
    isIdentityUncertain: !effectiveFamily && !effectiveMaterial
  };
}

export function parseProvenanceFieldSet(rawJson) {
  if (rawJson === null || rawJson === undefined || String(rawJson).trim() === "") {
    return { supplied: false, valid: true, keys: new Set() };
  }
  try {
    const parsed = JSON.parse(String(rawJson));
    if (!Array.isArray(parsed)) {
      return { supplied: true, valid: false, keys: new Set() };
    }
    const keys = new Set();
    for (const item of parsed) {
      if (typeof item !== "string") {
        return { supplied: true, valid: false, keys: new Set() };
      }
      const trimmed = item.trim();
      if (!trimmed || trimmed.includes(".") || !ALLOWED_PROVENANCE_FIELD_KEYS.has(trimmed)) {
        return { supplied: true, valid: false, keys: new Set() };
      }
      keys.add(trimmed);
    }
    return { supplied: true, valid: true, keys };
  } catch (e) {
    return { supplied: true, valid: false, keys: new Set() };
  }
}

export function resolveTab3FieldProvenance(body) {
  const lockedParsed = parseProvenanceFieldSet(body.get("operator_locked_fields"));
  const passiveParsed = parseProvenanceFieldSet(body.get("passive_stored_fields"));

  if (!lockedParsed.valid || !passiveParsed.valid || (!lockedParsed.supplied && !passiveParsed.supplied)) {
    return {
      hasValidProvenance: false,
      operatorLockedSet: new Set(),
      passiveStoredSet: new Set()
    };
  }

  const operatorLockedSet = new Set(lockedParsed.keys);
  const passiveStoredSet = new Set();

  for (const k of passiveParsed.keys) {
    if (!operatorLockedSet.has(k)) {
      passiveStoredSet.add(k);
    }
  }

  return {
    hasValidProvenance: true,
    operatorLockedSet,
    passiveStoredSet
  };
}

export function sanitizeCandidateString(str) {
  if (typeof str !== "string") return "";
  if (str.includes("See Shopify")) return "";
  return replaceCandidateMojibakeEmDashes(str).trim();
}

export function isCleanCandidateLabel(label) {
  if (typeof label !== "string") return false;
  const cleaned = sanitizeCandidateString(label);
  if (!cleaned) return false;
  if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return false;
  if (/^gid:\/\/shopify\//i.test(cleaned)) return false;
  if (/metaobject/i.test(cleaned) && /\d/.test(cleaned)) return false;
  return true;
}

const MAX_VERIFIED_COLOR_PATTERN_RAW_CHARS = 32768;
const MAX_VERIFIED_COLOR_PATTERN_LABEL_LENGTH = 120;

export function parseVerifiedColorPatternChoiceLabels(rawInput, maxLabels = 200) {
  if (rawInput === null || rawInput === undefined) {
    return { supplied: false, valid: true, labels: [], error: null };
  }

  const boundedMaxLabels =
    typeof maxLabels === "number" && Number.isFinite(maxLabels) && maxLabels > 0
      ? Math.floor(maxLabels)
      : 200;

  let rawArray = null;

  if (typeof rawInput === "string") {
    const trimmed = rawInput.trim();
    if (trimmed === "") {
      return { supplied: false, valid: true, labels: [], error: null };
    }
    if (rawInput.length > MAX_VERIFIED_COLOR_PATTERN_RAW_CHARS) {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `verified_color_pattern_choices payload exceeds maximum character bound (${MAX_VERIFIED_COLOR_PATTERN_RAW_CHARS} chars).`
      };
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (!Array.isArray(parsed)) {
        return {
          supplied: true,
          valid: false,
          labels: [],
          error: "verified_color_pattern_choices must be a JSON string array."
        };
      }
      rawArray = parsed;
    } catch (e) {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `Malformed verified_color_pattern_choices JSON: ${e.message}`
      };
    }
  } else if (Array.isArray(rawInput)) {
    rawArray = rawInput;
  } else {
    return {
      supplied: true,
      valid: false,
      labels: [],
      error: "verified_color_pattern_choices must be a JSON string array or array of strings."
    };
  }

  if (rawArray.length === 0) {
    return {
      supplied: true,
      valid: false,
      labels: [],
      error: "verified_color_pattern_choices array is empty; at least one verified choice label is required."
    };
  }

  if (rawArray.length > boundedMaxLabels) {
    return {
      supplied: true,
      valid: false,
      labels: [],
      error: `verified_color_pattern_choices array length (${rawArray.length}) exceeds maximum bound (${boundedMaxLabels}); refusing to truncate.`
    };
  }

  const dedupedLabels = [];
  const seenLower = new Set();

  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (typeof item !== "string") {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `verified_color_pattern_choices[${i}] is not a string.`
      };
    }

    const cleaned = sanitizeCandidateString(item);
    if (!cleaned || !isCleanCandidateLabel(cleaned)) {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `verified_color_pattern_choices[${i}] ("${String(item).slice(0, 60)}") is not a clean candidate label.`
      };
    }

    if (cleaned.length > MAX_VERIFIED_COLOR_PATTERN_LABEL_LENGTH) {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `verified_color_pattern_choices[${i}] exceeds maximum label length (${MAX_VERIFIED_COLOR_PATTERN_LABEL_LENGTH} chars).`
      };
    }

    if (/^gid:\/\//i.test(cleaned)) {
      return {
        supplied: true,
        valid: false,
        labels: [],
        error: `verified_color_pattern_choices[${i}] contains a GID rather than a plaintext label.`
      };
    }

    const lowerKey = cleaned.replace(/\s+/g, " ").toLowerCase();
    if (!seenLower.has(lowerKey)) {
      seenLower.add(lowerKey);
      dedupedLabels.push(cleaned);
    }
  }

  if (dedupedLabels.length === 0) {
    return {
      supplied: true,
      valid: false,
      labels: [],
      error: "No valid verified color-pattern labels remained after validation."
    };
  }

  if (dedupedLabels.length > boundedMaxLabels) {
    return {
      supplied: true,
      valid: false,
      labels: [],
      error: `Deduplicated verified_color_pattern_choices count (${dedupedLabels.length}) exceeds maximum bound (${boundedMaxLabels}).`
    };
  }

  return {
    supplied: true,
    valid: true,
    labels: dedupedLabels,
    error: null
  };
}

export function validateStandardizedCandidates(rawCandidates, currentData = {}) {
  const result = {};

  let sourceObj = rawCandidates;
  if (typeof sourceObj === "string") {
    try {
      sourceObj = JSON.parse(sourceObj);
    } catch (e) {
      sourceObj = null;
    }
  }

  let explicitCorrections = null;
  if (currentData && currentData.standardized_candidates) {
    if (typeof currentData.standardized_candidates === "string") {
      try {
        explicitCorrections = JSON.parse(currentData.standardized_candidates);
      } catch (e) {
        explicitCorrections = null;
      }
    } else if (typeof currentData.standardized_candidates === "object") {
      explicitCorrections = currentData.standardized_candidates;
    }
  }

  for (const attrKey of ALLOWED_STANDARDIZED_CANDIDATE_KEYS) {
    const underscoreKey = attrKey.replace(/-/g, "_");

    const explicitEntry =
      explicitCorrections?.[attrKey] ??
      currentData?.[`candidate_${attrKey}`] ??
      currentData?.[`candidate_${underscoreKey}`];

    const entryToValidate = explicitEntry !== undefined ? explicitEntry : sourceObj?.[attrKey];
    if (!entryToValidate) continue;

    let labels = [];
    let evidence = "";

    if (typeof entryToValidate === "string") {
      const cleaned = sanitizeCandidateString(entryToValidate);
      if (isCleanCandidateLabel(cleaned)) {
        labels = [cleaned];
        evidence = "Explicitly supplied operator candidate correction.";
      }
    } else if (typeof entryToValidate === "object" && !Array.isArray(entryToValidate)) {
      if (Array.isArray(entryToValidate.labels)) {
        labels = entryToValidate.labels
          .map(sanitizeCandidateString)
          .filter(isCleanCandidateLabel);
      }
      if (typeof entryToValidate.evidence === "string") {
        evidence = sanitizeCandidateString(entryToValidate.evidence);
      }
    }

    if (attrKey === "chain-link-type") {
      const chainMat = String(currentData?.chain_material || "").toLowerCase();
      const chainLink = String(currentData?.chain_link_type || "").toLowerCase();
      if (chainMat === "cord" || chainLink === "cord") {
        labels = labels.filter(l => !/snake\s*chain/i.test(l));
      }
    }

    if (labels.length > 0 && evidence.length > 0 && !/^gid:\/\/shopify\//i.test(evidence)) {
      result[attrKey] = {
        labels: Array.from(new Set(labels)),
        evidence
      };
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

export function sanitizeObject(obj) {
  if (!obj) return obj;
  for (let key in obj) {
    if (typeof obj[key] === "string") {
      if (obj[key].includes("See Shopify")) obj[key] = "";
      else obj[key] = replaceCandidateMojibakeEmDashes(obj[key]);
    }
  }
  return obj;
}

export function formatDyslexiaText(text) {
  if (!text) return "";
  let cleaned = text.replace(/([a-z0-9])([.?!])([A-Z])/g, "$1$2 $3").replace(/([a-z0-9]),([A-Za-z])/gi, "$1, $2");
  return cleaned.replace(/<\/p>\s*<p>/g, "</p>\n\n<p>").replace(/<br\s*\/?>/gi, "<br>\n").trim();
}

export function extractShapeFromString(str) {
  if (!str) return "";
  const SHAPES = ["Round", "Oval", "Freeform", "Teardrop", "Pear", "Cushion", "Marquise", "Rectangle", "Square", "Heart", "Slab", "Rough", "Cabochon"];
  for (const shape of SHAPES) {
    if (new RegExp(`\\b${shape}\\b`, "i").test(str)) return shape;
  }
  return "";
}

export function enforceOriginOverrides(loc) {
  if (!loc) return loc;
  const lower = loc.toLowerCase().trim();
  if (lower.includes("yakima") || lower.includes("chert") || lower === "yak" || lower.startsWith("yak ")) return "Yakima River Canyon";
  if (lower.includes("spokane")) return "Spokane River";
  if (lower.includes("richardson")) return "Richardson's Rock Ranch";
  if (lower.includes("north fork") || lower.includes("north-fork") || lower.includes("cda") || lower === "nor" || lower.startsWith("nor ")) return "North Fork CdA";
  return loc;
}

export function cleanStoneFamilyShape(familyStr) {
  if (!familyStr) return familyStr;
  return familyStr.replace(/(?:\s+(?:Round|Oval|Freeform|Teardrop|Pear|Heart|Square|Rectangle|Slab|Raw|Cabochon))+$/i, "").trim();
}

export function mapCollectionLocation(rawLocation) {
  const loc = (rawLocation || "").toLowerCase().trim();
  if (!loc) return "";
  if (loc.includes("spokane river")) return "Spokane River";
  if (loc.includes("yakima") || loc.includes("chert") || loc === "yak") return "Yakima River Canyon";
  if (loc.includes("richardson")) return "Richardson's Rock Ranch";
  if (loc.includes("north fork") || loc.includes("cda") || loc === "nor") return "North Fork CdA";
  return rawLocation.replace(/\s*Collection$/i, "").trim();
}

export function getDerivedMaterial(stoneFam) {
  if (!stoneFam) return "";
  return stoneFam.replace(/^(Dragon's Eye|Green|Blue|Fire|Rufus|Rainbow|Yellow|Red|Black|Oregon)\s+/i, "").trim();
}

export function parseValidPhotoSolidLengthInches(rawVal) {
  if (typeof rawVal !== "number" && typeof rawVal !== "string") return "";
  let num;
  if (typeof rawVal === "number") {
    num = rawVal;
  } else {
    const str = rawVal.trim();
    if (!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(str)) return "";
    num = Number(str);
  }
  if (!Number.isFinite(num) || num <= 0) return "";
  const rounded = Number(num.toFixed(4));
  if (rounded <= 0) return "";
  return String(rounded);
}

// ==========================================================================
// SHARED BENCH V2 MATERIAL & STONE FAMILY RESOLUTION
// ==========================================================================

function cleanGenericNonBlankVisionStr(rawVal) {
  if (typeof rawVal !== "string") return "";
  const cleaned = sanitizeCandidateString(rawVal);
  if (!cleaned) return "";
  if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

function resolveBenchV2MaterialAndFamilyContext({
  idOrigin,
  currentData = {},
  rawVisionSnapshot = {},
  isMaterialOperatorLocked = false
}) {
  const rawTitleSegments = splitSegmentedTitle(idOrigin?.rawTitleInput || "");
  const rawTitleStoneSegment =
    idOrigin?.hasSegmentedTitle && rawTitleSegments.length >= 3
      ? rawTitleSegments[0]
      : "";
  const cleanTitleStoneVariety =
    idOrigin?.titleStoneSegment &&
    isConfirmedPicklistOrVarietyStoneIdentity(idOrigin.titleStoneSegment)
      ? idOrigin.titleStoneSegment
      : "";

  const rawVisMaterial = cleanGenericNonBlankVisionStr(rawVisionSnapshot.material);
  const rawVisPrimaryMedium = cleanGenericNonBlankVisionStr(rawVisionSnapshot.primary_medium);
  const rawVisStoneFamily = cleanGenericNonBlankVisionStr(rawVisionSnapshot.stone_family);

  const normalizedVisStoneFamily = rawVisStoneFamily
    ? resolvePicklistStoneFamily(rawVisStoneFamily)
    : "";
  const titleDerivedStoneFamily =
    !idOrigin?.explicitStoneFamily &&
    idOrigin?.hasSegmentedTitle &&
    rawTitleStoneSegment &&
    isConfirmedPicklistOrVarietyStoneIdentity(rawTitleStoneSegment)
      ? resolvePicklistStoneFamily(
          extractStoneName(rawTitleStoneSegment) !== "Unknown"
            ? extractStoneName(rawTitleStoneSegment)
            : rawTitleStoneSegment
        )
      : "";

  const effectiveBaseFamily =
    (idOrigin?.explicitStoneFamily && currentData.stone_family
      ? resolvePicklistStoneFamily(currentData.stone_family)
      : "") ||
    normalizedVisStoneFamily ||
    titleDerivedStoneFamily ||
    "";

  // If Vision echoed a bare base family (e.g. "Jasper") while the 3-segment title carries
  // a more specific confirmed stone variety of that same family (e.g. "Brecciated Jasper"),
  // prefer the specific stone variety for custom.material while keeping custom.stone_family
  // as the normalized base family.
  const isTitleVarietyMoreSpecificThanVision = Boolean(
    cleanTitleStoneVariety &&
    effectiveBaseFamily &&
    cleanTitleStoneVariety.toLowerCase() !== effectiveBaseFamily.toLowerCase() &&
    resolvePicklistStoneFamily(
      extractStoneName(cleanTitleStoneVariety) !== "Unknown"
        ? extractStoneName(cleanTitleStoneVariety)
        : cleanTitleStoneVariety
    ).toLowerCase() === effectiveBaseFamily.toLowerCase()
  );

  let materialProposal = null;
  if (!isMaterialOperatorLocked) {
    if (
      rawVisMaterial &&
      !isGenericBareStoneProposal(rawVisMaterial) &&
      !isSettingOrHardwareMediumValue(rawVisMaterial) &&
      !(
        isTitleVarietyMoreSpecificThanVision &&
        rawVisMaterial.toLowerCase() === effectiveBaseFamily.toLowerCase()
      )
    ) {
      materialProposal = {
        value: rawVisMaterial,
        source: "Gemini Vision (material)"
      };
    } else if (
      rawVisPrimaryMedium &&
      !isGenericBareStoneProposal(rawVisPrimaryMedium) &&
      !isSettingOrHardwareMediumValue(rawVisPrimaryMedium) &&
      !(
        isTitleVarietyMoreSpecificThanVision &&
        rawVisPrimaryMedium.toLowerCase() === effectiveBaseFamily.toLowerCase()
      )
    ) {
      const isDistinctVarietyOrConfirmedStone =
        !rawVisStoneFamily ||
        rawVisPrimaryMedium.toLowerCase() !== rawVisStoneFamily.toLowerCase() ||
        Boolean(resolvePicklistStoneFamily(rawVisPrimaryMedium));
      if (isDistinctVarietyOrConfirmedStone) {
        materialProposal = {
          value: rawVisPrimaryMedium,
          source: "Gemini Vision (primary_medium stone variety)"
        };
      } else if (cleanTitleStoneVariety) {
        materialProposal = {
          value: cleanTitleStoneVariety,
          source: "Title Segment Parse (3-Segment Product Title)"
        };
      }
    } else if (cleanTitleStoneVariety) {
      materialProposal = {
        value: cleanTitleStoneVariety,
        source: "Title Segment Parse (3-Segment Product Title)"
      };
    }
  }

  return {
    rawTitleSegments,
    rawTitleStoneSegment,
    cleanTitleStoneVariety,
    normalizedVisStoneFamily,
    titleDerivedStoneFamily,
    effectiveBaseFamily,
    materialProposal
  };
}

/**
 * Computes the exact `custom.material` value that `buildBenchV2ProducerProposals`
 * will stage for the current scan inputs, using the identical precedence rules as
 * `buildBenchV2ProducerProposals` (operator lock -> `rawVisMaterial` ->
 * `rawVisPrimaryMedium` -> 3-segment title variety).
 */
export function resolveBenchV2ProducedMaterialCandidate({
  idOrigin,
  currentData = {},
  rawVisionSnapshot = {},
  provenance = null
}) {
  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const isMaterialLocked =
    hasValidProvenance &&
    operatorLockedSet.has("material") &&
    currentData.material !== undefined &&
    String(currentData.material).trim() !== "";

  if (isMaterialLocked) {
    return "";
  }

  const { materialProposal } = resolveBenchV2MaterialAndFamilyContext({
    idOrigin,
    currentData,
    rawVisionSnapshot,
    isMaterialOperatorLocked: false
  });

  return materialProposal ? materialProposal.value : "";
}

// ==========================================================================
// OPT-IN BENCH V2 PRODUCER PROPOSALS BUILDER (tab3FullRescan ONLY)
// ==========================================================================

export function buildBenchV2ProducerProposals({
  body,
  idOrigin,
  currentData = {},
  rawVisionSnapshot = {},
  geoFields = {},
  pagesList = [],
  collectionsList = []
}) {
  const producerProposals = {};
  const producerDiagnostics = {};

  const provenance =
    idOrigin && typeof idOrigin === "object" && idOrigin.operatorLockedSet instanceof Set
      ? {
          hasValidProvenance: Boolean(idOrigin.hasValidProvenance),
          operatorLockedSet: idOrigin.operatorLockedSet,
          passiveStoredSet:
            idOrigin.passiveStoredSet instanceof Set ? idOrigin.passiveStoredSet : new Set()
        }
      : resolveTab3FieldProvenance(body);

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const passiveStoredSet = hasValidProvenance ? provenance.passiveStoredSet : new Set();

  const rawProductIdFromBody = String(
    body?.get?.("pieceId") || body?.get?.("productId") || ""
  ).trim();
  const verifiedProductIdForRequest = isExactProductGid(rawProductIdFromBody)
    ? rawProductIdFromBody
    : null;
  const rawRequestIdFromBody = String(body?.get?.("requestId") || "").trim();
  const verifiedRequestIdForRequest =
    rawRequestIdFromBody !== "" ? rawRequestIdFromBody : null;

  const isBareFieldOperatorLocked = (bareKey) =>
    hasValidProvenance
      ? operatorLockedSet.has(bareKey) &&
        currentData[bareKey] !== undefined &&
        String(currentData[bareKey]).trim() !== ""
      : false;

  const isAllowedDestinationSpecificFiller = (destOrBareKey, cleanedVal) => {
    if (typeof cleanedVal !== "string") return false;
    if (
      (destOrBareKey === "jewelry_type" || destOrBareKey === "custom.jewelry_type") &&
      /^n\/a$/i.test(cleanedVal)
    ) {
      return true;
    }
    if (
      (destOrBareKey === "chain_material" || destOrBareKey === "custom.chain_material") &&
      /^none$/i.test(cleanedVal)
    ) {
      return true;
    }
    if (
      (destOrBareKey === "cleavage" || destOrBareKey === "custom.cleavage") &&
      /^none$/i.test(cleanedVal)
    ) {
      return true;
    }
    return false;
  };

  const normalizeDestinationSpecificFiller = (destOrBareKey, cleanedVal) => {
    if (
      (destOrBareKey === "jewelry_type" || destOrBareKey === "custom.jewelry_type") &&
      /^n\/a$/i.test(cleanedVal)
    ) {
      return "N/A";
    }
    if (
      (destOrBareKey === "chain_material" || destOrBareKey === "custom.chain_material") &&
      /^none$/i.test(cleanedVal)
    ) {
      return "None";
    }
    if (
      (destOrBareKey === "cleavage" || destOrBareKey === "custom.cleavage") &&
      /^none$/i.test(cleanedVal)
    ) {
      return "None";
    }
    return cleanedVal;
  };

  const cleanNonBlankVisionStr = (rawVal, destOrBareKey = "") => {
    if (typeof rawVal !== "string") return "";
    const cleaned = sanitizeCandidateString(rawVal);
    if (!cleaned) return "";
    if (isAllowedDestinationSpecificFiller(destOrBareKey, cleaned)) {
      return normalizeDestinationSpecificFiller(destOrBareKey, cleaned);
    }
    if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return "";
    return cleaned;
  };

  const addProposal = (destKey, value, source, trustedGeologyDbProvenance = null) => {
    if (typeof value !== "string") return;
    const cleaned = sanitizeCandidateString(value);
    if (!cleaned) return;
    const finalVal = isAllowedDestinationSpecificFiller(destKey, cleaned)
      ? normalizeDestinationSpecificFiller(destKey, cleaned)
      : cleaned;
    if (
      !isAllowedDestinationSpecificFiller(destKey, cleaned) &&
      INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())
    ) {
      return;
    }
    producerProposals[destKey] = {
      value: finalVal,
      source,
      ...(trustedGeologyDbProvenance &&
      typeof trustedGeologyDbProvenance === "object" &&
      trustedGeologyDbProvenance.verified === true &&
      trustedGeologyDbProvenance.destinationKey === destKey &&
      trustedGeologyDbProvenance.emittedValue === finalVal
        ? { trustedGeologyDbProvenance }
        : {})
    };
  };

  const addStandardizedGeologyCandidate = (
    destKey,
    rawLabel,
    source,
    trustedGeologyDbProvenance = null
  ) => {
    if (typeof rawLabel !== "string") return;
    const cleaned = sanitizeCandidateString(rawLabel);
    if (!isCleanCandidateLabel(cleaned)) return;
    producerProposals[destKey] = {
      candidateLabel: cleaned,
      labels: [cleaned],
      source,
      ...(trustedGeologyDbProvenance &&
      typeof trustedGeologyDbProvenance === "object" &&
      trustedGeologyDbProvenance.verified === true &&
      trustedGeologyDbProvenance.destinationKey === destKey &&
      trustedGeologyDbProvenance.emittedCandidateLabel === cleaned
        ? { trustedGeologyDbProvenance }
        : {})
    };
  };

  const {
    rawTitleSegments,
    rawTitleStoneSegment,
    cleanTitleStoneVariety,
    normalizedVisStoneFamily,
    titleDerivedStoneFamily,
    effectiveBaseFamily,
    materialProposal
  } = resolveBenchV2MaterialAndFamilyContext({
    idOrigin,
    currentData,
    rawVisionSnapshot,
    isMaterialOperatorLocked: isBareFieldOperatorLocked("material")
  });

  // 1. Segmented Product Title Piece Name
  if (idOrigin.hasSegmentedTitle && idOrigin.preservedPieceName) {
    const lastSeg = rawTitleSegments.length >= 3 ? rawTitleSegments[rawTitleSegments.length - 1] : "";
    if (lastSeg && lastSeg === idOrigin.preservedPieceName) {
      addProposal(
        "custom.piece_name",
        lastSeg,
        "Title Segment Parse (3-Segment Product Title)"
      );
    }
  }

  // 2. Dominant Material (custom.material) & Base Stone Family (custom.stone_family)
  if (materialProposal) {
    addProposal("custom.material", materialProposal.value, materialProposal.source);
  }

  // Base Stone Family (custom.stone_family) — strictly independent from custom.material
  if (!isBareFieldOperatorLocked("stone_family")) {
    if (
      normalizedVisStoneFamily &&
      !isGenericBareStoneProposal(normalizedVisStoneFamily) &&
      !isSettingOrHardwareMediumValue(normalizedVisStoneFamily)
    ) {
      addProposal(
        "custom.stone_family",
        normalizedVisStoneFamily,
        "Gemini Vision (stone_family)"
      );
    } else if (
      titleDerivedStoneFamily &&
      !isGenericBareStoneProposal(titleDerivedStoneFamily) &&
      !isSettingOrHardwareMediumValue(titleDerivedStoneFamily)
    ) {
      addProposal(
        "custom.stone_family",
        titleDerivedStoneFamily,
        "Title Segment Parse (3-Segment Product Title)"
      );
    }
  }

  // 3. Intentional Distinct OOAK Destinations
  const hasVisionOoak1 =
    rawVisionSnapshot.is_one_of_a_kind !== undefined &&
    rawVisionSnapshot.is_one_of_a_kind !== null &&
    String(rawVisionSnapshot.is_one_of_a_kind).trim() !== "";
  const hasVisionOoak2 =
    rawVisionSnapshot.is_ooak !== undefined &&
    rawVisionSnapshot.is_ooak !== null &&
    String(rawVisionSnapshot.is_ooak).trim() !== "";

  if (hasVisionOoak1 || hasVisionOoak2) {
    const pol1 = hasVisionOoak1
      ? classifyOoakFactualPolarity(rawVisionSnapshot.is_one_of_a_kind)
      : null;
    const pol2 = hasVisionOoak2
      ? classifyOoakFactualPolarity(rawVisionSnapshot.is_ooak)
      : null;

    if (hasVisionOoak1 && hasVisionOoak2 && pol1 && pol2 && pol1 !== pol2) {
      producerDiagnostics.ooak =
        "Conflicting OOAK values returned by Vision (is_one_of_a_kind vs. is_ooak); omitted both OOAK proposals.";
    } else {
      const factualPolarity = pol1 || pol2;
      if (!factualPolarity) {
        producerDiagnostics.ooak =
          "Unrecognized OOAK token returned by Vision; omitted OOAK proposals.";
      } else {
        let observedTypesMap = {};
        const rawObservedTypesJson = body.get("observed_destination_types");
        if (rawObservedTypesJson && typeof rawObservedTypesJson === "string") {
          try {
            const parsedTypes = JSON.parse(rawObservedTypesJson);
            if (parsedTypes && typeof parsedTypes === "object" && !Array.isArray(parsedTypes)) {
              observedTypesMap = parsedTypes;
            }
          } catch (e) {}
        }

        const ooak1ObservedType =
          (body.get("is_one_of_a_kind_observed_type") || "").trim() ||
          (typeof observedTypesMap["custom.is_one_of_a_kind"] === "string"
            ? observedTypesMap["custom.is_one_of_a_kind"].trim()
            : "");
        const ooak2ObservedType =
          (body.get("is_ooak_observed_type") || "").trim() ||
          (typeof observedTypesMap["custom.is_ooak"] === "string"
            ? observedTypesMap["custom.is_ooak"].trim()
            : "");

        const rawOoakStr1 = hasVisionOoak1
          ? String(rawVisionSnapshot.is_one_of_a_kind).trim()
          : String(rawVisionSnapshot.is_ooak).trim();
        const rawOoakStr2 = hasVisionOoak2
          ? String(rawVisionSnapshot.is_ooak).trim()
          : String(rawVisionSnapshot.is_one_of_a_kind).trim();

        if (ooak1ObservedType === "single_line_text_field") {
          const fmt1 = formatBenchV2OoakProposalForType(
            rawOoakStr1,
            factualPolarity,
            "single_line_text_field"
          );
          if (fmt1.ok) {
            addProposal(
              "custom.is_one_of_a_kind",
              fmt1.value,
              "Gemini Vision (OOAK factual answer)"
            );
          } else {
            producerDiagnostics["custom.is_one_of_a_kind"] = fmt1.reason;
          }
        } else {
          producerDiagnostics["custom.is_one_of_a_kind"] = ooak1ObservedType
            ? `Unsupported or conflicting observed type "${ooak1ObservedType}" for custom.is_one_of_a_kind (requires single_line_text_field); omitted proposal.`
            : "Observed type for custom.is_one_of_a_kind was not supplied; omitted proposal.";
        }

        if (
          ooak2ObservedType === "boolean" ||
          ooak2ObservedType === "single_line_text_field"
        ) {
          const fmt2 = formatBenchV2OoakProposalForType(
            rawOoakStr2,
            factualPolarity,
            ooak2ObservedType
          );
          if (fmt2.ok) {
            addProposal(
              "custom.is_ooak",
              fmt2.value,
              `Gemini Vision (OOAK factual answer formatted for observed ${ooak2ObservedType})`
            );
          } else {
            producerDiagnostics["custom.is_ooak"] = fmt2.reason;
          }
        } else {
          producerDiagnostics["custom.is_ooak"] = ooak2ObservedType
            ? `Unsupported or conflicting observed type "${ooak2ObservedType}" for custom.is_ooak; omitted proposal.`
            : "Observed type for custom.is_ooak was not supplied; omitted proposal.";
        }
      }
    }
  }

  // 4. Origin & Collection Batch 1 Destinations
  const rawVisOriginLoc = cleanNonBlankVisionStr(rawVisionSnapshot.origin_location);
  const titleDerivedOrigin =
    !idOrigin.explicitOriginLocation &&
    !idOrigin.isPurchasedProvenance &&
    idOrigin.hasSegmentedTitle
      ? idOrigin.originSegment
      : "";

  if (!idOrigin.isPurchasedProvenance && !isBareFieldOperatorLocked("origin_location")) {
    if (rawVisOriginLoc) {
      const resolvedVisOrigin = resolveEvidencedOriginLocation(rawVisOriginLoc);
      if (resolvedVisOrigin) {
        addProposal(
          "custom.origin_location",
          resolvedVisOrigin,
          "Gemini Vision (origin_location)"
        );
      }
    } else if (titleDerivedOrigin) {
      addProposal(
        "custom.origin_location",
        titleDerivedOrigin,
        "Title Segment Parse (3-Segment Product Title)"
      );
    }
  }

  const producedOriginLocForRouting =
    producerProposals["custom.origin_location"]?.value ||
    (idOrigin.isOriginOperatorLocked ? idOrigin.originSegment : "") ||
    "";
  const rawVisOriginHandle = cleanNonBlankVisionStr(
    rawVisionSnapshot.origin_page_handle ?? rawVisionSnapshot.origin_handle
  );
  if (
    !isBareFieldOperatorLocked("origin_page_handle") &&
    !isBareFieldOperatorLocked("origin_handle")
  ) {
    if (rawVisOriginHandle) {
      const verifiedVisHandle = resolveOriginHandle(
        producedOriginLocForRouting,
        pagesList,
        rawVisOriginHandle
      );
      if (verifiedVisHandle) {
        addProposal(
          "custom.origin_page_handle",
          verifiedVisHandle,
          "Gemini Vision + Store Page Directory"
        );
      }
    } else if (producedOriginLocForRouting && !idOrigin.explicitOriginHandle) {
      const derivedHandleFromProducedOrigin = resolveOriginHandle(
        producedOriginLocForRouting,
        pagesList
      );
      if (derivedHandleFromProducedOrigin) {
        addProposal(
          "custom.origin_page_handle",
          derivedHandleFromProducedOrigin,
          "Store Page Directory Resolution"
        );
      }
    }
  }

  const rawVisColName = cleanNonBlankVisionStr(rawVisionSnapshot.collection_name);
  if (!isBareFieldOperatorLocked("collection_name")) {
    if (
      rawVisColName &&
      collectionsList.some(
        c =>
          c.title.toLowerCase() === rawVisColName.toLowerCase() ||
          c.handle.toLowerCase() === rawVisColName.toLowerCase()
      )
    ) {
      const matchedCol = resolveCollectionData("", "", collectionsList, rawVisColName);
      if (matchedCol.name) {
        addProposal(
          "custom.collection_name",
          matchedCol.name,
          "Gemini Vision + Store Collection Directory"
        );
      }
    } else if (
      !idOrigin.isPurchasedProvenance &&
      !idOrigin.explicitCollectionName &&
      producedOriginLocForRouting
    ) {
      const matchedColFromOrigin = resolveCollectionData(
        producedOriginLocForRouting,
        producerProposals["custom.origin_page_handle"]?.value || "",
        collectionsList
      );
      if (matchedColFromOrigin.name) {
        addProposal(
          "custom.collection_name",
          matchedColFromOrigin.name,
          "Store Collection Directory Resolution"
        );
      }
    }
  }

  const rawVisColLoc = cleanNonBlankVisionStr(rawVisionSnapshot.collection_location);
  const producedCollectionName =
    producerProposals["custom.collection_name"]?.value || "";
  if (!idOrigin.isPurchasedProvenance && !isBareFieldOperatorLocked("collection_location")) {
    if (rawVisColLoc) {
      const mappedVisColLoc = mapCollectionLocation(rawVisColLoc);
      if (mappedVisColLoc) {
        addProposal(
          "custom.collection_location",
          mappedVisColLoc,
          "Gemini Vision (collection_location)"
        );
      }
    } else if (producedCollectionName || producedOriginLocForRouting) {
      const mappedFromProduced = mapCollectionLocation(
        producedCollectionName || producedOriginLocForRouting
      );
      if (mappedFromProduced) {
        addProposal(
          "custom.collection_location",
          mappedFromProduced,
          "Collection / Origin Location Mapping"
        );
      }
    }
  }

  const rawVisFoundObj = cleanNonBlankVisionStr(rawVisionSnapshot.found_object);
  const isFoundObjLocked =
    Boolean(idOrigin.isFoundObjectOperatorLocked) || isBareFieldOperatorLocked("found_object");
  const hasStoredFoundObj =
    currentData.found_object !== undefined && String(currentData.found_object).trim() !== "";
  if (rawVisFoundObj && !isFoundObjLocked) {
    const storedPolarity = classifyFoundObjectPolarity(currentData.found_object);
    const visPolarity = classifyFoundObjectPolarity(rawVisFoundObj);
    const flipsEstablishedPolarity =
      hasStoredFoundObj &&
      storedPolarity !== "unknown" &&
      visPolarity !== "unknown" &&
      storedPolarity !== visPolarity;
    if (!flipsEstablishedPolarity) {
      addProposal("custom.found_object", rawVisFoundObj, "Gemini Vision (found_object)");
    }
  }

  // 5. Treatment Batch 1 Destinations
  const rawVisTreated = cleanNonBlankVisionStr(rawVisionSnapshot.treated);
  if (rawVisTreated && !isBareFieldOperatorLocked("treated")) {
    addProposal("custom.treated", rawVisTreated, "Gemini Vision (treated)");
  }
  const rawVisTreatmentStatus = cleanNonBlankVisionStr(
    rawVisionSnapshot.treatment_status
  );
  if (rawVisTreatmentStatus && !isBareFieldOperatorLocked("treatment_status")) {
    addProposal(
      "custom.treatment_status",
      rawVisTreatmentStatus,
      "Gemini Vision (treatment_status)"
    );
  }

  // 6. Appearance and Character Batch 1 Destinations
  const rawVisCutAndShape = cleanNonBlankVisionStr(rawVisionSnapshot.cut_and_shape);
  if (rawVisCutAndShape && !isBareFieldOperatorLocked("cut_and_shape")) {
    addProposal(
      "custom.cut_and_shape",
      rawVisCutAndShape,
      "Gemini Vision (cut_and_shape)"
    );
  }

  const rawVisStoneShape = cleanNonBlankVisionStr(rawVisionSnapshot.stone_shape);
  const titleDerivedShape =
    !isBareFieldOperatorLocked("stone_shape") &&
    idOrigin.hasSegmentedTitle &&
    rawTitleStoneSegment
      ? extractShapeFromString(rawTitleStoneSegment)
      : "";
  if (!isBareFieldOperatorLocked("stone_shape")) {
    if (rawVisStoneShape) {
      addProposal(
        "custom.stone_shape",
        rawVisStoneShape,
        "Gemini Vision (stone_shape)"
      );
    } else if (titleDerivedShape) {
      addProposal(
        "custom.stone_shape",
        titleDerivedShape,
        "Title Segment Parse (3-Segment Product Title)"
      );
    }
  }

  const rawVisSurfaceFinish = cleanNonBlankVisionStr(rawVisionSnapshot.surface_finish);
  if (rawVisSurfaceFinish && !isBareFieldOperatorLocked("surface_finish")) {
    addProposal(
      "custom.surface_finish",
      rawVisSurfaceFinish,
      "Gemini Vision (surface_finish)"
    );
  }

  const rawVisColor = cleanNonBlankVisionStr(rawVisionSnapshot.color);
  if (rawVisColor && !isBareFieldOperatorLocked("color")) {
    addProposal(
      "custom.color",
      rawVisColor,
      "Gemini Vision (color)"
    );
  }

  const rawVisPrimaryColor = cleanNonBlankVisionStr(rawVisionSnapshot.primary_color);
  if (rawVisPrimaryColor && !isBareFieldOperatorLocked("primary_color")) {
    addProposal(
      "custom.primary_color",
      rawVisPrimaryColor,
      "Gemini Vision (primary_color)"
    );
  }

  const rawVisSecondaryColors = cleanNonBlankVisionStr(
    rawVisionSnapshot.secondary_colors
  );
  if (rawVisSecondaryColors && !isBareFieldOperatorLocked("secondary_colors")) {
    addProposal(
      "custom.secondary_colors",
      rawVisSecondaryColors,
      "Gemini Vision (secondary_colors)"
    );
  }

  const rawVisColorPattern = cleanNonBlankVisionStr(rawVisionSnapshot.color_pattern);
  if (rawVisColorPattern && !isBareFieldOperatorLocked("color_pattern")) {
    addProposal(
      "custom.color_pattern",
      rawVisColorPattern,
      "Gemini Vision (color_pattern)"
    );
  }

  // 7. Setting and Hardware Drawer 8 Destinations
  const DRAWER_6_HARDWARE_KEYS = [
    "secondary_medium",
    "jewelry_type",
    "setting_ready",
    "bail_included",
    "chain_material",
    "chain_link_type",
    "jewelry_finding_type",
    "wire_material"
  ];

  const isPassiveStoredChainMaterialVerified = Boolean(
    hasValidProvenance &&
      passiveStoredSet.has("chain_material") &&
      !operatorLockedSet.has("chain_material") &&
      currentData.chain_material !== undefined &&
      String(currentData.chain_material).trim() !== ""
  );
  const rawPassiveStoredChainMat = isPassiveStoredChainMaterialVerified
    ? String(currentData.chain_material).trim()
    : "";
  const resolvedPassiveStoredChainMat = isPassiveStoredChainMaterialVerified
    ? resolveKnownStudioHardwareOptionLength(rawPassiveStoredChainMat)
    : null;

  for (const hwKey of DRAWER_6_HARDWARE_KEYS) {
    if (isBareFieldOperatorLocked(hwKey)) continue;
    const rawHwVal = rawVisionSnapshot[hwKey];
    const cleanHwStr =
      typeof rawHwVal === "boolean"
        ? (rawHwVal ? "Yes" : "No")
        : cleanNonBlankVisionStr(rawHwVal, hwKey);
    if (!cleanHwStr) continue;

    if (
      hwKey === "chain_material" &&
      /^sterling\s+silver\s+chain$/i.test(cleanHwStr)
    ) {
      const hasCurrentSavedSterling =
        currentData.chain_material !== undefined &&
        /^sterling\s+silver\s+chain$/i.test(String(currentData.chain_material).trim());
      if (!hasCurrentSavedSterling) {
        producerDiagnostics["custom.chain_material"] =
          'Held unverified Vision chain_material proposal "Sterling Silver Chain": silver-colored appearance is not proof of sterling silver composition.';
        continue;
      }
    }

    let normalizedHwStr = cleanHwStr;
    if (hwKey === "chain_material") {
      const knownHwInfo = resolveKnownStudioHardwareOptionLength(cleanHwStr);
      if (knownHwInfo.matched) {
        if (knownHwInfo.category === "studio_cord_stock") {
          // If verified passive stored chain_material is already "Cord" or a supported
          // studio_cord_stock alias (e.g. "Black Cord"), emit its exact stored canonicalOption
          // so downstream validation classifies custom.chain_material as unchanged_from_baseline
          // (no redundant cord-color/alias recategorization draft) while keeping
          // combinedProducerAndVisionProposals["custom.chain_material"] available for 18 in
          // length verification when chain_cord_length_in is blank.
          normalizedHwStr =
            resolvedPassiveStoredChainMat &&
            resolvedPassiveStoredChainMat.matched &&
            resolvedPassiveStoredChainMat.category === "studio_cord_stock"
              ? resolvedPassiveStoredChainMat.canonicalOption
              : "Cord";
        } else {
          normalizedHwStr = knownHwInfo.canonicalOption;
        }
      }
    }

    addProposal(
      `custom.${hwKey}`,
      normalizedHwStr,
      `Gemini Vision (${hwKey})`
    );
  }

  // 7B. Narrow Known Studio Hardware Stock Length (PRODUCT custom.chain_cord_length_in)
  // Derives KNOWN_STUDIO_HARDWARE_LENGTH_IN ("18") exclusively from a positively matched
  // studio hardware option in rawVisionSnapshot.chain_material, never from any model
  // length assertion. Preserves all nonblank saved measurements, operator locks, and
  // human hardware decisions; jewelry_type "N/A" alone is never a veto.
  const hasNonBlankLengthInCurrentData =
    (currentData.chain_cord_length_in !== undefined &&
      String(currentData.chain_cord_length_in).trim() !== "") ||
    (currentData["custom.chain_cord_length_in"] !== undefined &&
      String(currentData["custom.chain_cord_length_in"]).trim() !== "");

  const isChainCordLengthLockedOrPassive = Boolean(
    hasNonBlankLengthInCurrentData ||
      (hasValidProvenance &&
        (operatorLockedSet.has("chain_cord_length_in") ||
          passiveStoredSet.has("chain_cord_length_in")))
  );

  const rawVisChainMatForLength = cleanNonBlankVisionStr(
    rawVisionSnapshot.chain_material,
    "chain_material"
  );

  // Blank or omitted Vision chain_material means unidentified (never proof of absent hardware),
  // and produces no length proposal or noise diagnostic.
  if (!isChainCordLengthLockedOrPassive && rawVisChainMatForLength !== "") {
    const isVisChainMatExplicitNone = /^none$/i.test(rawVisChainMatForLength);
    const visKnownHw = resolveKnownStudioHardwareOptionLength(rawVisChainMatForLength);

    if (!isVisChainMatExplicitNone && !visKnownHw.matched) {
      producerDiagnostics["custom.chain_cord_length_in"] =
        `Omitted studio length proposal: Vision chain_material "${rawVisChainMatForLength}" does not have a confirmed ${KNOWN_STUDIO_HARDWARE_LENGTH_IN}-inch studio stock length.`;
    } else if (visKnownHw.matched) {
      const rawSuppliedLockedOrSavedChainMat =
        currentData.chain_material !== undefined
          ? String(currentData.chain_material).trim()
          : "";
      const isChainMatOperatorLocked = Boolean(
        hasValidProvenance &&
          operatorLockedSet.has("chain_material") &&
          rawSuppliedLockedOrSavedChainMat !== ""
      );
      const isChainLinkOperatorLockedToNone = Boolean(
        hasValidProvenance &&
          operatorLockedSet.has("chain_link_type") &&
          currentData.chain_link_type !== undefined &&
          /^none$/i.test(String(currentData.chain_link_type).trim())
      );

      // Canonical studio_cord_stock target for current-scan provenance:
      // - When custom.chain_material is operator-locked, new studio_cord_stock scans bind
      //   matchedHardwareOption to canonical "Cord" (compatible via the shared registry with
      //   locked "Cord" or any locked supported "<Color> Cord" alias).
      // - When custom.chain_material is unlocked, match the exact studio_cord_stock option
      //   emitted on producerProposals["custom.chain_material"] ("Cord" for new/changed cord
      //   proposals, or the preserved passive stored studio_cord_stock canonicalOption when
      //   suppressing redundant cord-color recategorization) so client response cross-checks
      //   pass without mutating rawVisionSnapshot or weakening exact canonical comparisons.
      const canonicalMatchedHwOption =
        visKnownHw.category === "studio_cord_stock"
          ? (!isChainMatOperatorLocked &&
              resolvedPassiveStoredChainMat &&
              resolvedPassiveStoredChainMat.matched &&
              resolvedPassiveStoredChainMat.category === "studio_cord_stock"
              ? resolvedPassiveStoredChainMat.canonicalOption
              : "Cord")
          : visKnownHw.canonicalOption;

      const photoMatchEvidenceNote =
        rawVisChainMatForLength.toLowerCase() !== canonicalMatchedHwOption.toLowerCase()
          ? `Gemini Vision photo match: "${rawVisChainMatForLength}"`
          : "Gemini Vision photo match";

      if (!verifiedProductIdForRequest || !verifiedRequestIdForRequest) {
        producerDiagnostics["custom.chain_cord_length_in"] =
          `Omitted ${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in studio length proposal for "${canonicalMatchedHwOption}": exact product GID and scan requestId are required to bind hardware length provenance.`;
      } else if (isChainLinkOperatorLockedToNone) {
        producerDiagnostics["custom.chain_cord_length_in"] =
          `Omitted ${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in studio length proposal: operator-locked custom.chain_link_type is "None".`;
      } else if (isChainMatOperatorLocked) {
        // Explicit human lock/Keep Original on chain_material:
        // Allow canonical "Cord" and any supported studio_cord_stock alias for confirmed studio cord;
        // reject "None", "Gold Plated Snake Chain", "Sterling Silver Chain", cross-category hardware, or arbitrary strings.
        const isLockedMatCompatible = areHardwareOptionsCompatibleForKnownStudioLength({
          matchedOption: canonicalMatchedHwOption,
          candidateOrSavedChainMaterial: rawSuppliedLockedOrSavedChainMat,
          allowLegacyGenericCord: true
        });

        if (!isLockedMatCompatible) {
          producerDiagnostics["custom.chain_cord_length_in"] =
            `Omitted ${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in studio length proposal: operator-locked/kept custom.chain_material ("${rawSuppliedLockedOrSavedChainMat}") is not compatible with photo match "${canonicalMatchedHwOption}".`;
        } else {
          const trustedKnownHardwareLengthProvenance = Object.freeze({
            verified: true,
            productId: verifiedProductIdForRequest,
            requestId: verifiedRequestIdForRequest,
            destinationKey: "custom.chain_cord_length_in",
            matchedHardwareOption: canonicalMatchedHwOption,
            hardwareCategory: visKnownHw.category,
            emittedValue: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
            basis: "vision_photo_match_known_studio_stock"
          });

          producerProposals["custom.chain_cord_length_in"] = {
            value: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
            source: `Known Studio Hardware Stock (${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in confirmed for ${canonicalMatchedHwOption}; ${photoMatchEvidenceNote})`,
            trustedKnownHardwareLengthProvenance
          };
        }
      } else {
        // Not operator-locked on chain_material: check passive saved chain_material compatibility
        // (supporting passive saved "Cord" or supported "<Color> Cord" aliases for studio_cord_stock
        // without forcing recategorization, while rejecting cross-category or unsupported hardware).
        const isSavedMatCompatible = areHardwareOptionsCompatibleForKnownStudioLength({
          matchedOption: canonicalMatchedHwOption,
          candidateOrSavedChainMaterial: rawSuppliedLockedOrSavedChainMat,
          allowLegacyGenericCord: true
        });

        if (!isSavedMatCompatible) {
          producerDiagnostics["custom.chain_cord_length_in"] =
            `Held ${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in studio length proposal: saved custom.chain_material ("${rawSuppliedLockedOrSavedChainMat}") conflicts with photo match "${canonicalMatchedHwOption}". Review and save custom.chain_material first so length is never attached to an incompatible saved hardware option.`;
        } else {
          const trustedKnownHardwareLengthProvenance = Object.freeze({
            verified: true,
            productId: verifiedProductIdForRequest,
            requestId: verifiedRequestIdForRequest,
            destinationKey: "custom.chain_cord_length_in",
            matchedHardwareOption: canonicalMatchedHwOption,
            hardwareCategory: visKnownHw.category,
            emittedValue: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
            basis: "vision_photo_match_known_studio_stock"
          });

          producerProposals["custom.chain_cord_length_in"] = {
            value: KNOWN_STUDIO_HARDWARE_LENGTH_IN,
            source: `Known Studio Hardware Stock (${KNOWN_STUDIO_HARDWARE_LENGTH_IN} in confirmed for ${canonicalMatchedHwOption}; ${photoMatchEvidenceNote})`,
            trustedKnownHardwareLengthProvenance
          };
        }
      }
    }
  }

  // 8. Geology Drawer 7 Destinations (12 active custom destinations + 4 producer-backed standardized companions from getGeoData ONLY)
  const DRAWER_7_ACTIVE_GEOLOGY_KEYS = [
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
  ];

  const PRODUCER_GEOLOGY_STANDARDIZED_COMPANION_MAP = Object.freeze({
    crystal_system: "shopify.crystal-system",
    mineral_class: "shopify.mineral-class",
    rock_composition: "shopify.rock-composition",
    rock_formation: "shopify.rock-formation"
  });

  // Confirmed current stone identity for shopify.rock-composition:
  // Requires operator-locked stone identity, active Vision/3-segment title family,
  // or confirmed stone identity when not merely a passive unconfirmed legacy label.
  const lockedMaterialFamily =
    isBareFieldOperatorLocked("material") && currentData.material
      ? resolvePicklistStoneFamily(
          extractStoneName(currentData.material) !== "Unknown"
            ? extractStoneName(currentData.material)
            : currentData.material
        ) || resolvePicklistStoneFamily(currentData.material)
      : "";
  const lockedPrimaryMediumFamily =
    isBareFieldOperatorLocked("primary_medium") && currentData.primary_medium
      ? resolvePicklistStoneFamily(
          extractStoneName(currentData.primary_medium) !== "Unknown"
            ? extractStoneName(currentData.primary_medium)
            : currentData.primary_medium
        ) || resolvePicklistStoneFamily(currentData.primary_medium)
      : "";
  const confirmedRockIdentityForCompanion =
    effectiveBaseFamily ||
    lockedMaterialFamily ||
    lockedPrimaryMediumFamily ||
    "";

  // Verify authoritative Postgres DB lookup metadata and selected-stone identity match
  // before serialization so _dbLookupMeta (non-enumerable on geoFields) can be bound
  // exclusively to authentic DB-derived geology proposals for this product/request.
  const verifiedProductIdForGeo = verifiedProductIdForRequest;
  const verifiedRequestIdForGeo = verifiedRequestIdForRequest;

  const stoneIdentityContextForGeoVerify = resolveVerifiedStoneIdentityContext(
    currentData,
    idOrigin?.derivedFamily || "",
    provenance
  );
  const preVisionGeoCandidates = buildGeoLookupCandidates({
    idOrigin,
    stoneIdentityContext: stoneIdentityContextForGeoVerify,
    currentData,
    provenance
  });

  const activeSelectedStoneCandidatesLower = new Set();
  const registerVerifiedStoneCandidate = (rawCand) => {
    if (typeof rawCand !== "string") return;
    const cleaned = cleanStoneFamilyShape(rawCand.trim());
    if (
      !cleaned ||
      cleaned.toLowerCase() === "unknown" ||
      cleaned.toLowerCase() === "unknown stone" ||
      INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
      isGenericBareStoneProposal(cleaned) ||
      isSettingOrHardwareMediumValue(cleaned)
    ) {
      return;
    }
    if (!isConfirmedPicklistOrVarietyStoneIdentity(cleaned)) {
      return;
    }
    activeSelectedStoneCandidatesLower.add(cleaned.toLowerCase());
    const varietyStem = extractValidatedInclusionFreeStoneStem(cleaned);
    if (varietyStem && isConfirmedPicklistOrVarietyStoneIdentity(varietyStem)) {
      activeSelectedStoneCandidatesLower.add(varietyStem.toLowerCase());
    }
    const baseFam = resolveCanonicalBaseFamilyForStoneCandidate(cleaned);
    if (baseFam) {
      activeSelectedStoneCandidatesLower.add(baseFam.toLowerCase());
    }
  };

  for (const preCand of preVisionGeoCandidates) {
    registerVerifiedStoneCandidate(preCand);
  }
  if (effectiveBaseFamily) {
    registerVerifiedStoneCandidate(effectiveBaseFamily);
  }
  if (cleanTitleStoneVariety) {
    registerVerifiedStoneCandidate(cleanTitleStoneVariety);
  }
  if (materialProposal?.value) {
    registerVerifiedStoneCandidate(materialProposal.value);
  }

  const activeStoneBaseFamiliesLower = new Set();
  const registerActiveBaseFamily = (rawStone) => {
    const fam = resolveCanonicalBaseFamilyForStoneCandidate(rawStone);
    if (fam) {
      activeStoneBaseFamiliesLower.add(fam.toLowerCase());
    }
  };
  if (effectiveBaseFamily) {
    registerActiveBaseFamily(effectiveBaseFamily);
  }
  if (materialProposal?.value) {
    registerActiveBaseFamily(materialProposal.value);
  }
  if (stoneIdentityContextForGeoVerify.effectiveFamily) {
    registerActiveBaseFamily(stoneIdentityContextForGeoVerify.effectiveFamily);
  }
  if (stoneIdentityContextForGeoVerify.effectiveMaterial) {
    registerActiveBaseFamily(stoneIdentityContextForGeoVerify.effectiveMaterial);
  }

  const dbMeta =
    geoFields &&
    typeof geoFields === "object" &&
    geoFields._dbLookupMeta &&
    typeof geoFields._dbLookupMeta === "object"
      ? geoFields._dbLookupMeta
      : null;

  const geoSourceTag = geoFields?.geoSource || "none";
  const isAuthoritativePostgresGeoSource =
    geoSourceTag === "cache" || geoSourceTag === "database";
  const dbMatchedStoneNameLower =
    typeof dbMeta?.dbMatchedStoneName === "string"
      ? dbMeta.dbMatchedStoneName.trim().toLowerCase()
      : "";
  const dbCandidatesTriedLower = Array.isArray(dbMeta?.dbCandidatesTried)
    ? dbMeta.dbCandidatesTried
        .filter((c) => typeof c === "string" && c.trim() !== "")
        .map((c) => c.trim().toLowerCase())
    : [];

  const matchedBaseFamily = dbMatchedStoneNameLower
    ? resolveCanonicalBaseFamilyForStoneCandidate(dbMatchedStoneNameLower)
    : "";
  const isMatchedStoneCompatibleWithSelectedStone = Boolean(
    dbMatchedStoneNameLower &&
    !INVALID_CANDIDATE_FILLERS.has(dbMatchedStoneNameLower) &&
    !isGenericBareStoneProposal(dbMatchedStoneNameLower) &&
    !isSettingOrHardwareMediumValue(dbMatchedStoneNameLower) &&
    isConfirmedPicklistOrVarietyStoneIdentity(dbMatchedStoneNameLower) &&
    dbCandidatesTriedLower.includes(dbMatchedStoneNameLower) &&
    activeSelectedStoneCandidatesLower.has(dbMatchedStoneNameLower) &&
    matchedBaseFamily &&
    (activeStoneBaseFamiliesLower.size === 0 ||
      activeStoneBaseFamiliesLower.has(matchedBaseFamily.toLowerCase()))
  );

  // Enforce specific-variety DB matching for BOTH operator-locked and unlocked
  // stone identities so a generic base-family DB record (e.g. "rhyolite") is
  // NEVER treated as verified geology for a specific variety (e.g. "Leopard Rhyolite"
  // or "Leopard Rhyolite with Mica Inclusions").
  const isStoneFamExplicitlyLockedToBaseFamily = Boolean(
    isBareFieldOperatorLocked("stone_family") &&
    !isBareFieldOperatorLocked("material") &&
    !isBareFieldOperatorLocked("primary_medium") &&
    currentData.stone_family &&
    isSupportedPicklistStoneFamily(currentData.stone_family)
  );

  const lockedSpecificVarietyRaw =
    isBareFieldOperatorLocked("material") && currentData.material
      ? cleanStoneFamilyShape(String(currentData.material).trim())
      : isBareFieldOperatorLocked("primary_medium") && currentData.primary_medium
        ? cleanStoneFamilyShape(String(currentData.primary_medium).trim())
        : "";

  const producedMaterialVarietyCleaned =
    materialProposal?.value && typeof materialProposal.value === "string"
      ? cleanStoneFamilyShape(materialProposal.value.trim())
      : "";

  const effectiveTargetBaseFamilyForVarietyVerify =
    effectiveBaseFamily ||
    matchedBaseFamily ||
    stoneIdentityContextForGeoVerify.effectiveFamily ||
    "";

  const governingSpecificVarietyCandidate = lockedSpecificVarietyRaw
    ? (isValidatedSpecificVarietyOfBaseFamily(
        lockedSpecificVarietyRaw,
        effectiveTargetBaseFamilyForVarietyVerify
      )
        ? lockedSpecificVarietyRaw
        : "")
    : (!isStoneFamExplicitlyLockedToBaseFamily &&
       producedMaterialVarietyCleaned &&
       isValidatedSpecificVarietyOfBaseFamily(
         producedMaterialVarietyCleaned,
         effectiveTargetBaseFamilyForVarietyVerify
       )
        ? producedMaterialVarietyCleaned
        : (!isStoneFamExplicitlyLockedToBaseFamily &&
           preVisionGeoCandidates.length > 0 &&
           isValidatedSpecificVarietyOfBaseFamily(
             preVisionGeoCandidates[0],
             effectiveTargetBaseFamilyForVarietyVerify
           )
            ? cleanStoneFamilyShape(preVisionGeoCandidates[0].trim())
            : ""));

  const allowedSpecificMatchNamesLower = new Set();
  if (governingSpecificVarietyCandidate) {
    for (const allowedLower of buildAllowedSpecificVarietyDbMatchNames(
      governingSpecificVarietyCandidate,
      effectiveTargetBaseFamilyForVarietyVerify
    )) {
      allowedSpecificMatchNamesLower.add(allowedLower);
    }
    if (
      !lockedSpecificVarietyRaw &&
      preVisionGeoCandidates.length > 0 &&
      isValidatedSpecificVarietyOfBaseFamily(
        preVisionGeoCandidates[0],
        effectiveTargetBaseFamilyForVarietyVerify
      )
    ) {
      for (const allowedPreLower of buildAllowedSpecificVarietyDbMatchNames(
        preVisionGeoCandidates[0],
        effectiveTargetBaseFamilyForVarietyVerify
      )) {
        allowedSpecificMatchNamesLower.add(allowedPreLower);
      }
    }
  }

  const violatesSpecificVarietyRequirement = Boolean(
    governingSpecificVarietyCandidate &&
    !allowedSpecificMatchNamesLower.has(dbMatchedStoneNameLower)
  );

  const isTrustedDbGeologyLookupVerified = Boolean(
    verifiedProductIdForGeo &&
    isAuthoritativePostgresGeoSource &&
    dbMeta &&
    dbMeta.dbLookupComplete === true &&
    !dbMeta.dbReadError &&
    isMatchedStoneCompatibleWithSelectedStone &&
    !violatesSpecificVarietyRequirement
  );

  if (geoSourceTag !== "none" && !violatesSpecificVarietyRequirement) {
    const resolveGeologySourceLabel = (geoKey) => {
      if (geoSourceTag === "library") {
        return geoKey === "luster"
          ? "Geo Library (computed stone luster default)"
          : "Geo Library (GEO_LIBRARY)";
      }
      if (geoSourceTag === "cache") {
        return "Geo Library (StoneCache)";
      }
      if (geoSourceTag === "database") {
        return "Geo Library (StoneProfile DB)";
      }
      if (geoSourceTag === "mindat") {
        return "Mindat API";
      }
      return "Geo Library";
    };

    for (const geoKey of DRAWER_7_ACTIVE_GEOLOGY_KEYS) {
      if (!PASSIVE_GEOLOGY_REVIEW_KEYS.has(geoKey)) continue;
      const rawGeoVal = geoFields[geoKey];
      const cleanGeoStr = cleanNonBlankVisionStr(rawGeoVal, geoKey);
      if (!cleanGeoStr) continue;

      const geoSourceLabel = resolveGeologySourceLabel(geoKey);
      const customDestKey = `custom.${geoKey}`;

      if (!isBareFieldOperatorLocked(geoKey)) {
        const customProvenance = isTrustedDbGeologyLookupVerified
          ? Object.freeze({
              verified: true,
              productId: verifiedProductIdForGeo,
              requestId: verifiedRequestIdForGeo,
              destinationKey: customDestKey,
              geoKey,
              emittedValue: cleanGeoStr,
              geoSource: geoSourceTag,
              dbLookupComplete: true,
              dbMatchedStoneName: dbMatchedStoneNameLower,
              matchedBaseFamily,
              stoneIdentityMatched: true
            })
          : null;

        addProposal(
          customDestKey,
          cleanGeoStr,
          geoSourceLabel,
          customProvenance
        );
      }

      if (Object.prototype.hasOwnProperty.call(PRODUCER_GEOLOGY_STANDARDIZED_COMPANION_MAP, geoKey)) {
        const companionDestKey = PRODUCER_GEOLOGY_STANDARDIZED_COMPANION_MAP[geoKey];
        const companionCandidateLabel = normalizeCanonicalGeologyReferenceCandidate(
          geoKey,
          cleanGeoStr,
          geoKey === "rock_composition" ? confirmedRockIdentityForCompanion : ""
        );

        const rawGeoCollapsedLower = cleanGeoStr.replace(/\s+/g, " ").trim().toLowerCase();
        const rockCompUsedIdentityFallback =
          geoKey === "rock_composition" &&
          !Object.prototype.hasOwnProperty.call(
            EXACT_CANONICAL_ROCK_COMPOSITION_LABELS,
            rawGeoCollapsedLower
          );
        const isRockCompIdentityVerified =
          !rockCompUsedIdentityFallback ||
          Boolean(
            confirmedRockIdentityForCompanion &&
            confirmedRockIdentityForCompanion.trim().toLowerCase() ===
              matchedBaseFamily.toLowerCase()
          );

        const companionProvenance =
          isTrustedDbGeologyLookupVerified &&
          isRockCompIdentityVerified &&
          isCleanCandidateLabel(companionCandidateLabel)
            ? Object.freeze({
                verified: true,
                productId: verifiedProductIdForGeo,
                requestId: verifiedRequestIdForGeo,
                destinationKey: companionDestKey,
                geoKey,
                rawDbValue: cleanGeoStr,
                emittedCandidateLabel: companionCandidateLabel,
                geoSource: geoSourceTag,
                dbLookupComplete: true,
                dbMatchedStoneName: dbMatchedStoneNameLower,
                matchedBaseFamily,
                stoneIdentityMatched: true
              })
            : null;

        addStandardizedGeologyCandidate(
          companionDestKey,
          companionCandidateLabel,
          geoSourceLabel,
          companionProvenance
        );
      }
    }
  }

  // 9. Drawer 13 Product-Owned Google Product Category (custom.google_product_category)
  // Native Shopify category (Gemstones for all loose or wearable stone-bearing products;
  // standalone hardware-only excluded), custom.google_product_category, and
  // shopify.product-classification are strictly separate. Because no external Google
  // stone taxonomy value is verified in this contract, unverified Vision
  // google_product_category proposals are held on stone-bearing products (with a
  // diagnostic note only when Vision returned a candidate) while preserving explicit
  // operator locks, saved values, and standalone hardware-only products.
  const rawVisGoogleCat = cleanNonBlankVisionStr(
    rawVisionSnapshot.google_product_category
  );
  if (rawVisGoogleCat && !isBareFieldOperatorLocked("google_product_category")) {
    const stoneIdentityContextForCat = resolveVerifiedStoneIdentityContext(
      currentData,
      idOrigin?.derivedFamily || "",
      provenance
    );
    const hasConfirmedStoneIdentity = Boolean(
      !stoneIdentityContextForCat.isIdentityUncertain ||
      effectiveBaseFamily ||
      cleanTitleStoneVariety ||
      producerProposals["custom.material"]?.value ||
      producerProposals["custom.stone_family"]?.value ||
      (geoFields && geoFields.geoSource && geoFields.geoSource !== "none")
    );
    const rawTitleForHardwareCheck = String(idOrigin?.rawTitleInput || "").trim();
    const isExcludedStandaloneHardwareTitle = Boolean(
      rawTitleForHardwareCheck &&
      Array.isArray(EXCLUDED_TITLES) &&
      EXCLUDED_TITLES.some(
        (t) =>
          typeof t === "string" &&
          t.trim().toLowerCase() === rawTitleForHardwareCheck.toLowerCase()
      )
    );
    const isStandaloneHardwareOnly = Boolean(
      !hasConfirmedStoneIdentity &&
      (isExcludedStandaloneHardwareTitle ||
        stoneIdentityContextForCat.hadHardwareContamination)
    );
    const isShopifyTaxonomyPathOrGid =
      /^gid:\/\/shopify\//i.test(rawVisGoogleCat) ||
      /\b(?:TaxonomyCategory|ProductTaxonomyNode)\b/i.test(rawVisGoogleCat) ||
      /^ae-\d+(?:-\d+)*$/i.test(rawVisGoogleCat);

    if (isShopifyTaxonomyPathOrGid) {
      producerDiagnostics["custom.google_product_category"] =
        `Held Vision google_product_category candidate "${rawVisGoogleCat}": native Shopify taxonomy IDs/paths are never valid in custom.google_product_category.`;
    } else if (!isStandaloneHardwareOnly) {
      producerDiagnostics["custom.google_product_category"] =
        `Held Vision google_product_category candidate "${rawVisGoogleCat}": stone-bearing products (loose or wearable) use native Shopify Gemstones by business rule, and no external Google stone taxonomy mapping is verified in this contract (existing saved or operator-locked values are preserved).`;
    } else {
      addProposal(
        "custom.google_product_category",
        rawVisGoogleCat,
        "Gemini Vision (google_product_category)"
      );
    }
  }

  // 10. Drawer 9 Independent SEO Title Destinations (native_seo_title & custom.seo_title)
  const rawVisSeoTitle = cleanNonBlankVisionStr(rawVisionSnapshot.seo_title);
  if (rawVisSeoTitle && !isBareFieldOperatorLocked("seo_title")) {
    let candidateSeoTitle = rawVisSeoTitle;
    let seoTitleSource = "Gemini Vision (seo_title)";

    if (idOrigin.isPurchasedProvenance && hasRiverOrFieldCollectionClaim(candidateSeoTitle)) {
      const stoneIdentityContextForSeo = resolveVerifiedStoneIdentityContext(
        currentData,
        idOrigin.derivedFamily,
        provenance
      );
      const effectiveStoneFamilyForSeo =
        stoneIdentityContextForSeo.effectiveFamily ||
        idOrigin.derivedFamily ||
        normalizedVisStoneFamily ||
        titleDerivedStoneFamily ||
        "";
      const cleanVisProductFormat = cleanNonBlankVisionStr(
        rawVisionSnapshot.product_format
      );
      const cleanCurrentProductFormat = cleanNonBlankVisionStr(
        currentData.product_format
      );
      const effectiveProductFormatForSeo =
        cleanCurrentProductFormat || cleanVisProductFormat || "";

      const safeFam = String(effectiveStoneFamilyForSeo || "").trim();
      const safeFmt = String(effectiveProductFormatForSeo || "").trim();
      const fullWithFmt =
        safeFam &&
        safeFmt &&
        !/^(n\/a|none|unknown)$/i.test(safeFmt) &&
        !safeFam.toLowerCase().includes(safeFmt.toLowerCase())
          ? `${safeFam} ${safeFmt} — Rockhound Studio`
          : safeFam
            ? `${safeFam} — Rockhound Studio`
            : "";
      const fullWithoutFmt = safeFam ? `${safeFam} — Rockhound Studio` : "";

      if (fullWithFmt && fullWithFmt.length <= 70) {
        candidateSeoTitle = buildSafePurchasedSeoTitle(
          effectiveStoneFamilyForSeo,
          effectiveProductFormatForSeo
        );
        seoTitleSource =
          "Gemini Vision (seo_title — purchased provenance safety fallback)";
      } else if (fullWithoutFmt && fullWithoutFmt.length <= 70) {
        candidateSeoTitle = buildSafePurchasedSeoTitle(
          effectiveStoneFamilyForSeo,
          ""
        );
        seoTitleSource =
          "Gemini Vision (seo_title — purchased provenance safety fallback)";
      } else {
        candidateSeoTitle = "";
        producerDiagnostics.seo_title =
          "Rejected Vision seo_title containing river/field-collection claim on purchased material; safe purchased fallback could not be formed within 70 characters without truncation.";
      }
    }

    if (candidateSeoTitle) {
      if (/^⚠️\s*/.test(candidateSeoTitle)) {
        producerDiagnostics.seo_title =
          "Omitted Vision seo_title proposal containing a leading warning prefix.";
      } else if (candidateSeoTitle.length > 70) {
        producerDiagnostics.seo_title = `Omitted Vision seo_title proposal (${candidateSeoTitle.length} chars exceeds 70-character limit; silent truncation is forbidden).`;
      } else {
        addProposal("native_seo_title", candidateSeoTitle, seoTitleSource);
        addProposal("custom.seo_title", candidateSeoTitle, seoTitleSource);
      }
    }
  }

  return {
    producerProposals,
    producerDiagnostics
  };
}
// ==========================================================================
// ROCKHOUND STUDIO — PRODUCER INPUT, PROVENANCE, ROUTING & PROPOSAL HELPERS
// File: app/utils/meta-injector.autofill-inputs.server.jsx
// Pure stateless producer calculation module: zero DB, zero GraphQL/network,
// zero model calls.
// ==========================================================================

import { DROPDOWN_OPTIONS, normalizeDropdownValue } from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS,
  isGenericBareStoneProposal,
  isSettingOrHardwareMediumValue,
  classifyFoundObjectPolarity,
  hasRiverOrFieldCollectionClaim,
  buildSafePurchasedSeoTitle
} from "./meta-injector.standardized.jsx";
import { ENGINE_ALLOWED_PROVENANCE_BARE_KEYS } from "./bench-v2.contract.jsx";

export const INVALID_CANDIDATE_FILLERS = new Set([
  "none",
  "unknown",
  "n/a",
  "null",
  "undefined",
  "tbd",
  "not applicable"
]);

// Producer-local provenance set: reuses the 54 shared ENGINE_ALLOWED_PROVENANCE_BARE_KEYS
// plus legacy "overall_solid_length_in" (kept producer-only for legacy Tab 2/3 provenance;
// permanently cancelled in Bench V2).
export const ALLOWED_PROVENANCE_FIELD_KEYS = new Set([
  ...ENGINE_ALLOWED_PROVENANCE_BARE_KEYS,
  "overall_solid_length_in"
]);

export const CLASSIFICATION_OVERRIDE_KEYS = new Set([
  "primary_use",
  "jewelry_type",
  "product_format",
  "necklace_design",
  "google_product_category"
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

export function extractStoneName(title) {
  if (!title) return "Unknown";
  const normalized = normalizeTitleMojibakeEmDashes(title);
  const segs = splitSegmentedTitle(normalized);
  const sectionOne = segs.length >= 2 ? segs[0] : normalized.split(/[—–-]/)[0].trim();
  const adjectives = ["Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White", "Grey", "Gray", "Brown", "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume", "Moss", "Dendritic", "Banded", "Polychrome", "Imperial", "Royal", "Dark", "Light", "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled", "Polished", "Natural", "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"];
  let words = sectionOne.split(/\s+/);
  words = words.filter(word => !adjectives.some(adj => adj.toLowerCase() === word.toLowerCase()));
  if (words.length > 0) {
    let baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }
  return "Unknown";
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
  if (typeof normalizeDropdownValue === "function") {
    const normalized = normalizeDropdownValue("stone_family", cleaned);
    if (normalized) return normalized;
  }
  const options = DROPDOWN_OPTIONS?.stone_family || [];
  const lower = cleaned.toLowerCase();
  for (const opt of options) {
    const val = typeof opt === "object" ? (opt.value || opt.label || "") : String(opt);
    if (val.toLowerCase() === lower) return val;
  }
  return cleaned;
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
  const explicitStoneFamily = (body.get("stone_family") || "").trim();
  const explicitOriginLocation = (body.get("origin_location") || "").trim();
  const explicitOriginHandle = (body.get("origin_handle") || body.get("origin_page_handle") || "").trim();
  const explicitCollectionName = (body.get("collection_name") || body.get("collectionName") || "").trim();
  const rawFoundObject = body.get("found_object") ?? body.get("custom.found_object");
  const foundObjectPolarity = classifyFoundObjectPolarity(rawFoundObject);

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();

  const isPurchasedProvenance = foundObjectPolarity === "purchased";
  const isOriginOperatorLocked = operatorLockedSet.has("origin_location") && Boolean(explicitOriginLocation);

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

  const validExplicitStoneFamily = !isSettingOrHardwareMediumValue(explicitStoneFamily) ? explicitStoneFamily : "";
  const rawFamilySource = validExplicitStoneFamily || titleFamilyCandidate || "";
  const derivedFamily = resolvePicklistStoneFamily(rawFamilySource);
  const derivedShape = extractShapeFromString(rawFamilySource);

  const rawOriginSource = explicitOriginLocation || titleOriginCandidate || "";
  const originSegment = isOriginOperatorLocked
    ? explicitOriginLocation
    : resolveEvidencedOriginLocation(rawOriginSource);

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
    explicitStoneFamily: Boolean(validExplicitStoneFamily),
    explicitOriginLocation: Boolean(explicitOriginLocation),
    explicitOriginHandle,
    explicitCollectionName,
    rawFoundObject: rawFoundObject !== null && rawFoundObject !== undefined ? String(rawFoundObject).trim() : "",
    foundObjectPolarity,
    isPurchasedProvenance,
    isOriginOperatorLocked
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

  const pushCandidate = (rawVal) => {
    if (typeof rawVal !== "string") return;
    const cleaned = cleanStoneFamilyShape(rawVal.trim());
    if (
      !cleaned ||
      cleaned.toLowerCase() === "unknown" ||
      cleaned.toLowerCase() === "unknown stone" ||
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

  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();

  if (operatorLockedSet.has("material") && currentData.material) {
    pushCandidate(currentData.material);
  }
  if (operatorLockedSet.has("stone_family") && currentData.stone_family) {
    pushCandidate(currentData.stone_family);
  }
  if (idOrigin?.titleStoneSegment) {
    pushCandidate(idOrigin.titleStoneSegment);
  }
  if (stoneIdentityContext?.effectiveMaterial) {
    pushCandidate(stoneIdentityContext.effectiveMaterial);
  }
  if (stoneIdentityContext?.effectiveFamily) {
    pushCandidate(stoneIdentityContext.effectiveFamily);
  }
  if (idOrigin?.derivedFamily) {
    pushCandidate(idOrigin.derivedFamily);
  }

  return candidates;
}

export function resolveVerifiedStoneIdentityContext(inputs = {}, derivedTitleFamily = "") {
  const rawStoneFamily = String(inputs.stone_family || "").trim();
  const rawMaterial = String(inputs.material || "").trim();
  const rawPrimaryMedium = String(inputs.primary_medium || "").trim();

  const familyIsHardware = isSettingOrHardwareMediumValue(rawStoneFamily);
  const materialIsHardware = isSettingOrHardwareMediumValue(rawMaterial);
  const primaryMediumIsHardware = isSettingOrHardwareMediumValue(rawPrimaryMedium);

  const validStoneFamily = !familyIsHardware && rawStoneFamily
    ? resolvePicklistStoneFamily(rawStoneFamily)
    : "";
  const validMaterial = !materialIsHardware && rawMaterial ? rawMaterial : "";
  const validPrimaryMedium = !primaryMediumIsHardware && rawPrimaryMedium ? rawPrimaryMedium : "";
  const validDerivedTitleFamily = !isSettingOrHardwareMediumValue(derivedTitleFamily) && derivedTitleFamily
    ? resolvePicklistStoneFamily(derivedTitleFamily)
    : "";

  const effectiveFamily =
    validStoneFamily ||
    validDerivedTitleFamily ||
    (validMaterial ? resolvePicklistStoneFamily(validMaterial) : "") ||
    (validPrimaryMedium ? resolvePicklistStoneFamily(validPrimaryMedium) : "");

  const effectiveMaterial =
    validMaterial ||
    validPrimaryMedium ||
    effectiveFamily ||
    "";

  const effectivePrimaryMedium =
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
    const existingStdVal =
      currentData?.[`shopify.${attrKey}`] ??
      currentData?.[`std_${underscoreKey}`];

    let hasExistingAssignment = false;
    if (existingStdVal !== undefined && existingStdVal !== null) {
      const strVal = String(existingStdVal).trim();
      if (strVal !== "" && strVal !== "[]" && !INVALID_CANDIDATE_FILLERS.has(strVal.toLowerCase())) {
        hasExistingAssignment = true;
      }
    }

    const explicitEntry =
      explicitCorrections?.[attrKey] ??
      currentData?.[`candidate_${attrKey}`] ??
      currentData?.[`candidate_${underscoreKey}`];

    if (hasExistingAssignment && !explicitEntry) {
      continue;
    }

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

  const addProposal = (destKey, value, source) => {
    if (typeof value !== "string") return;
    const cleaned = sanitizeCandidateString(value);
    if (!cleaned) return;
    if (isAllowedDestinationSpecificFiller(destKey, cleaned)) {
      producerProposals[destKey] = {
        value: normalizeDestinationSpecificFiller(destKey, cleaned),
        source
      };
      return;
    }
    if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return;
    producerProposals[destKey] = { value: cleaned, source };
  };

  const rawTitleSegments = splitSegmentedTitle(idOrigin?.rawTitleInput || "");
  const rawTitleStoneSegment =
    idOrigin?.hasSegmentedTitle && rawTitleSegments.length >= 3
      ? rawTitleSegments[0]
      : "";

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
  const rawVisMaterial = cleanNonBlankVisionStr(rawVisionSnapshot.material);
  const rawVisPrimaryMedium = cleanNonBlankVisionStr(rawVisionSnapshot.primary_medium);
  const rawVisStoneFamily = cleanNonBlankVisionStr(rawVisionSnapshot.stone_family);

  if (
    rawVisMaterial &&
    !isGenericBareStoneProposal(rawVisMaterial) &&
    !isSettingOrHardwareMediumValue(rawVisMaterial)
  ) {
    addProposal("custom.material", rawVisMaterial, "Gemini Vision (material)");
  } else if (
    rawVisPrimaryMedium &&
    !isGenericBareStoneProposal(rawVisPrimaryMedium) &&
    !isSettingOrHardwareMediumValue(rawVisPrimaryMedium)
  ) {
    const isDistinctVarietyOrConfirmedStone =
      !rawVisStoneFamily ||
      rawVisPrimaryMedium.toLowerCase() !== rawVisStoneFamily.toLowerCase() ||
      Boolean(resolvePicklistStoneFamily(rawVisPrimaryMedium));
    if (isDistinctVarietyOrConfirmedStone) {
      addProposal(
        "custom.material",
        rawVisPrimaryMedium,
        "Gemini Vision (primary_medium stone variety)"
      );
    }
  }

  // Base Stone Family (custom.stone_family) — strictly independent from custom.material
  const normalizedVisStoneFamily = rawVisStoneFamily
    ? resolvePicklistStoneFamily(rawVisStoneFamily)
    : "";
  const titleDerivedStoneFamily =
    !idOrigin.explicitStoneFamily &&
    idOrigin.hasSegmentedTitle &&
    rawTitleStoneSegment
      ? resolvePicklistStoneFamily(
          extractStoneName(rawTitleStoneSegment) !== "Unknown"
            ? extractStoneName(rawTitleStoneSegment)
            : rawTitleStoneSegment
        )
      : "";

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

  if (!idOrigin.isPurchasedProvenance) {
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
    producerProposals["custom.origin_location"]?.value || "";
  const rawVisOriginHandle = cleanNonBlankVisionStr(
    rawVisionSnapshot.origin_page_handle ?? rawVisionSnapshot.origin_handle
  );
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

  const rawVisColName = cleanNonBlankVisionStr(rawVisionSnapshot.collection_name);
  if (rawVisColName && collectionsList.some(c => c.title.toLowerCase() === rawVisColName.toLowerCase() || c.handle.toLowerCase() === rawVisColName.toLowerCase())) {
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

  const rawVisColLoc = cleanNonBlankVisionStr(rawVisionSnapshot.collection_location);
  const producedCollectionName =
    producerProposals["custom.collection_name"]?.value || "";
  if (!idOrigin.isPurchasedProvenance) {
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
  const callerSuppliedFoundObj =
    currentData.found_object !== undefined && currentData.found_object !== "";
  if (rawVisFoundObj && !callerSuppliedFoundObj) {
    addProposal("custom.found_object", rawVisFoundObj, "Gemini Vision (found_object)");
  }

  // 5. Treatment Batch 1 Destinations
  const rawVisTreated = cleanNonBlankVisionStr(rawVisionSnapshot.treated);
  if (rawVisTreated && rawVisTreated !== currentData.treated) {
    addProposal("custom.treated", rawVisTreated, "Gemini Vision (treated)");
  }
  const rawVisTreatmentStatus = cleanNonBlankVisionStr(
    rawVisionSnapshot.treatment_status
  );
  if (
    rawVisTreatmentStatus &&
    rawVisTreatmentStatus !== currentData.treatment_status
  ) {
    addProposal(
      "custom.treatment_status",
      rawVisTreatmentStatus,
      "Gemini Vision (treatment_status)"
    );
  }

  // 6. Appearance and Character Batch 1 Destinations
  const rawVisCutAndShape = cleanNonBlankVisionStr(rawVisionSnapshot.cut_and_shape);
  if (rawVisCutAndShape) {
    addProposal(
      "custom.cut_and_shape",
      rawVisCutAndShape,
      "Gemini Vision (cut_and_shape)"
    );
  }

  const rawVisStoneShape = cleanNonBlankVisionStr(rawVisionSnapshot.stone_shape);
  const titleDerivedShape =
    !idOrigin.explicitStoneFamily &&
    idOrigin.hasSegmentedTitle &&
    rawTitleStoneSegment
      ? extractShapeFromString(rawTitleStoneSegment)
      : "";
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

  const rawVisSurfaceFinish = cleanNonBlankVisionStr(rawVisionSnapshot.surface_finish);
  if (rawVisSurfaceFinish) {
    addProposal(
      "custom.surface_finish",
      rawVisSurfaceFinish,
      "Gemini Vision (surface_finish)"
    );
  }

  const rawVisColor = cleanNonBlankVisionStr(rawVisionSnapshot.color);
  if (rawVisColor) {
    addProposal(
      "custom.color",
      rawVisColor,
      "Gemini Vision (color)"
    );
  }

  const rawVisPrimaryColor = cleanNonBlankVisionStr(rawVisionSnapshot.primary_color);
  if (rawVisPrimaryColor) {
    addProposal(
      "custom.primary_color",
      rawVisPrimaryColor,
      "Gemini Vision (primary_color)"
    );
  }

  const rawVisSecondaryColors = cleanNonBlankVisionStr(
    rawVisionSnapshot.secondary_colors
  );
  if (rawVisSecondaryColors) {
    addProposal(
      "custom.secondary_colors",
      rawVisSecondaryColors,
      "Gemini Vision (secondary_colors)"
    );
  }

  const rawVisColorPattern = cleanNonBlankVisionStr(rawVisionSnapshot.color_pattern);
  if (rawVisColorPattern) {
    addProposal(
      "custom.color_pattern",
      rawVisColorPattern,
      "Gemini Vision (color_pattern)"
    );
  }

  // 7. Setting and Hardware Drawer 6 Destinations
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

  for (const hwKey of DRAWER_6_HARDWARE_KEYS) {
    const rawHwVal = rawVisionSnapshot[hwKey];
    const cleanHwStr =
      typeof rawHwVal === "boolean"
        ? (rawHwVal ? "Yes" : "No")
        : cleanNonBlankVisionStr(rawHwVal, hwKey);
    if (!cleanHwStr) continue;

    addProposal(
      `custom.${hwKey}`,
      cleanHwStr,
      `Gemini Vision (${hwKey})`
    );
  }

  // 8. Geology Drawer 7 Destinations (12 active destinations from getGeoData ONLY)
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

  const geoSourceTag = geoFields?.geoSource || "none";
  if (geoSourceTag !== "none") {
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
      const rawGeoVal = geoFields[geoKey];
      const cleanGeoStr = cleanNonBlankVisionStr(rawGeoVal, geoKey);
      if (!cleanGeoStr) continue;

      addProposal(
        `custom.${geoKey}`,
        cleanGeoStr,
        resolveGeologySourceLabel(geoKey)
      );
    }
  }

  // 9. Drawer 8 Product-Owned Google Product Category
  const rawVisGoogleCat = cleanNonBlankVisionStr(
    rawVisionSnapshot.google_product_category
  );
  if (rawVisGoogleCat) {
    addProposal(
      "custom.google_product_category",
      rawVisGoogleCat,
      "Gemini Vision (google_product_category)"
    );
  }

  // 10. Drawer 9 Independent SEO Title Destinations (native_seo_title & custom.seo_title)
  const rawVisSeoTitle = cleanNonBlankVisionStr(rawVisionSnapshot.seo_title);
  if (rawVisSeoTitle) {
    let candidateSeoTitle = rawVisSeoTitle;
    let seoTitleSource = "Gemini Vision (seo_title)";

    if (idOrigin.isPurchasedProvenance && hasRiverOrFieldCollectionClaim(candidateSeoTitle)) {
      const stoneIdentityContextForSeo = resolveVerifiedStoneIdentityContext(
        currentData,
        idOrigin.derivedFamily
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
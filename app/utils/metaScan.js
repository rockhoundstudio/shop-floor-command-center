export const TARGET_KEYS = [
  "official_name",
  "mineral_class",
  "crystal_structure",
  "luster",
  "chemical_formula",
  "rock_composition",
  "specific_gravity",
  "refractive_index",
  "moh_hardness",
  "fracture_pattern",
  "cleavage",
  "tenacity",
  "origin_location",
  "geological_age",
  "geological_era",
  "rock_formation",
  "where_found",
  "gps_coordinates",
  "rescued_by",
  "date_of_discovery",
  "primary_color",
  "secondary_colors",
  "diaphaneity",
  "character_marks",
  "cut_type",
  "carat_weight",
  "dimensions",
  "polishing_compound",
  "stone_story",
  "rarity_score",
  "legacy_status",
  "bench_notes"
];

export const FIELD_LABELS = {
  official_name:     "Official Name",
  mineral_class:     "Mineral Class",
  crystal_structure: "Crystal Structure",
  luster:            "Luster",
  chemical_formula:  "Chemical Formula",
  rock_composition:  "Rock Composition",
  specific_gravity:  "Specific Gravity",
  refractive_index:  "Refractive Index",
  moh_hardness:      "Mohs Hardness",
  fracture_pattern:  "Fracture Pattern",
  cleavage:          "Cleavage",
  tenacity:          "Tenacity",
  origin_location:   "Origin Location",
  geological_age:    "Geological Age",
  geological_era:    "Geological Era",
  rock_formation:    "Rock Formation",
  where_found:       "Where Found",
  gps_coordinates:   "GPS Coordinates",
  rescued_by:        "Rescued By",
  date_of_discovery: "Date of Discovery",
  primary_color:     "Primary Color",
  secondary_colors:  "Secondary Colors",
  diaphaneity:       "Diaphaneity (Opacity)",
  character_marks:   "Character Marks",
  cut_type:          "Cut Type",
  carat_weight:      "Carat Weight",
  dimensions:        "Dimensions (mm)",
  polishing_compound:"Polishing Compound",
  stone_story:       "Stone Story",
  rarity_score:      "Rarity Score",
  legacy_status:     "Legacy Status",
  bench_notes:       "Bench Notes"
};

export function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export function parseDescription(text) {
  const result = {};
  if (!text) return result;

  const originMatch = text.match(/(found in|origin[:\s]+|from\s+)([^\n,.]+)/i);
  if (originMatch) result.origin_location = originMatch[2].trim();

  const markMatch = text.match(/(inclusion|vein|crack|mark|scratch|pattern)[:\s]+([^\n,.]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();

  const hardnessMatch = text.match(/(?:hardness|mohs)[\s:]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*|\d+\.?\d*)/i);
  if (hardnessMatch) result.moh_hardness = hardnessMatch[1].trim();

  return result;
}

export function evaluateProductStatus(metafieldsObj) {
  const filledCount = TARGET_KEYS.filter(k => {
    const val = metafieldsObj[k];
    return val !== undefined && val !== null && String(val).trim() !== "";
  }).length;

  let status = "🔴 Empty";
  if (filledCount === TARGET_KEYS.length) {
    status = "✅ Complete";
  } else if (filledCount > 0) {
    status = "⚠️ Partial";
  }

  return { status, filledCount };
}

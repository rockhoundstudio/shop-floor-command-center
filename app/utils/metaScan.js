export const TARGET_KEYS = [
  "official_name",
  "mineral_class",
  "crystal_structure",
  "luster",
  "rock_composition",
  "specific_gravity",
  "moh_hardness",
  "fracture_pattern",
  "cleavage",
  "tenacity",
  "origin_location",
  "geological_age",
  "geological_era",
  "rock_formation",
  "rescued_by",
  "primary_color",
  "secondary_colors",
  "diaphaneity",
  "character_marks",
  "cut_type",
  "carat_weight",
  "dimensions",
  "stone_story",
  "bench_notes"
];

export const FIELD_LABELS = {
  official_name:     "Official Name",
  mineral_class:     "Mineral Class",
  crystal_structure: "Crystal Structure",
  luster:            "Luster",
  rock_composition:  "Rock Composition",
  specific_gravity:  "Specific Gravity",
  moh_hardness:      "Mohs Hardness",
  fracture_pattern:  "Fracture Pattern",
  cleavage:          "Cleavage",
  tenacity:          "Tenacity",
  origin_location:   "Origin Location",
  geological_age:    "Geological Age",
  geological_era:    "Geological Era",
  rock_formation:    "Rock Formation",
  rescued_by:        "Rescued By",
  primary_color:     "Primary Color",
  secondary_colors:  "Secondary Colors",
  diaphaneity:       "Diaphaneity (Opacity)",
  character_marks:   "Character Marks",
  cut_type:          "Cut Type",
  carat_weight:      "Carat Weight",
  dimensions:        "Dimensions (mm)",
  stone_story:       "Stone Story",
  bench_notes:       "Bench Notes"
};

export function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export function parseDescription(text) {
  const result = {};
  if (!text) return result;
  const t = text;

  const originMatch = t.match(/(?:found in|origin[:\s]+|from\s+|collected in\s+|locality[:\s]+)([^\n,.;]+)/i);
  if (originMatch) result.origin_location = originMatch[1].trim();

  const hardnessMatch = t.match(/(?:hardness|mohs)[\s:]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*|\d+\.?\d*)/i);
  if (hardnessMatch) result.moh_hardness = hardnessMatch[1].trim();

  const dimMatch = t.match(/(\d+\.?\d*\s*[xX×]\s*\d+\.?\d*(?:\s*[xX×]\s*\d+\.?\d*)?)\s*mm/i);
  if (dimMatch) result.dimensions = dimMatch[1].replace(/\s/g, "") + " mm";

  const caratMatch = t.match(/(\d+\.?\d*)\s*(?:ct|carat|carats)/i);
  if (caratMatch) result.carat_weight = caratMatch[1] + " ct";

  const colorMatch = t.match(/(?:primary color|main color|color[:\s]+)([^\n,.;]+)/i);
  if (colorMatch) result.primary_color = colorMatch[1].trim();

  const secColorMatch = t.match(/(?:secondary color[s]?|accent color[s]?)[:\s]+([^\n,.;]+)/i);
  if (secColorMatch) result.secondary_colors = secColorMatch[1].trim();

  const cutMatch = t.match(/(?:cut[:\s]+|cut type[:\s]+)([^\n,.;]+)/i);
  if (cutMatch) result.cut_type = cutMatch[1].trim();

  const rescuedMatch = t.match(/(?:rescued by|found by|collected by)[:\s]+([^\n,.;]+)/i);
  if (rescuedMatch) result.rescued_by = rescuedMatch[1].trim();

  const markMatch = t.match(/(?:inclusion|vein|crack|mark|scratch|pattern|phantom|druzy)[:\s]*([^\n,.;]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();

  const diaMatch = t.match(/(?:transparent|translucent|opaque)/i);
  if (diaMatch) result.diaphaneity = diaMatch[0].charAt(0).toUpperCase() + diaMatch[0].slice(1).toLowerCase();

  const benchMatch = t.match(/(?:bench notes?|lapidary notes?|notes?)[:\s]+([^\n;]+)/i);
  if (benchMatch) result.bench_notes = benchMatch[1].trim();

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

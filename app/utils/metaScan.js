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

/**
 * Expanded description parser — extracts as many fields as possible
 * from free-text product descriptions.
 */
export function parseDescription(text) {
  const result = {};
  if (!text) return result;
  const t = text;

  // Origin / location
  const originMatch = t.match(/(?:found in|origin[:\s]+|from\s+|collected in\s+|locality[:\s]+)([^\n,.;]+)/i);
  if (originMatch) result.origin_location = originMatch[1].trim();

  // Where found
  const whereMatch = t.match(/(?:where found|location found|collected at|site[:\s]+)([^\n,.;]+)/i);
  if (whereMatch) result.where_found = whereMatch[1].trim();

  // GPS
  const gpsMatch = t.match(/(?:gps|coordinates)[:\s]*([-\d.]+\s*[,/]\s*[-\d.]+)/i);
  if (gpsMatch) result.gps_coordinates = gpsMatch[1].trim();

  // Mohs hardness
  const hardnessMatch = t.match(/(?:hardness|mohs)[\s:]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*|\d+\.?\d*)/i);
  if (hardnessMatch) result.moh_hardness = hardnessMatch[1].trim();

  // Dimensions — e.g. "45 x 32 x 18 mm" or "45x32x18mm"
  const dimMatch = t.match(/(\d+\.?\d*\s*[xX×]\s*\d+\.?\d*(?:\s*[xX×]\s*\d+\.?\d*)?)\s*mm/i);
  if (dimMatch) result.dimensions = dimMatch[1].replace(/\s/g, "") + " mm";

  // Carat weight
  const caratMatch = t.match(/(\d+\.?\d*)\s*(?:ct|carat|carats)/i);
  if (caratMatch) result.carat_weight = caratMatch[1] + " ct";

  // Primary color
  const colorMatch = t.match(/(?:primary color|main color|color[:\s]+)([^\n,.;]+)/i);
  if (colorMatch) result.primary_color = colorMatch[1].trim();

  // Secondary colors
  const secColorMatch = t.match(/(?:secondary color[s]?|accent color[s]?)[:\s]+([^\n,.;]+)/i);
  if (secColorMatch) result.secondary_colors = secColorMatch[1].trim();

  // Cut type
  const cutMatch = t.match(/(?:cut[:\s]+|cut type[:\s]+)([^\n,.;]+)/i);
  if (cutMatch) result.cut_type = cutMatch[1].trim();

  // Polishing compound
  const polishMatch = t.match(/(?:polish(?:ed with|ing compound)?[:\s]+)([^\n,.;]+)/i);
  if (polishMatch) result.polishing_compound = polishMatch[1].trim();

  // Rescued by
  const rescuedMatch = t.match(/(?:rescued by|found by|collected by)[:\s]+([^\n,.;]+)/i);
  if (rescuedMatch) result.rescued_by = rescuedMatch[1].trim();

  // Date of discovery
  const dateMatch = t.match(/(?:date|discovered|found on)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\w+ \d{1,2},?\s*\d{4})/i);
  if (dateMatch) result.date_of_discovery = dateMatch[1].trim();

  // Character marks / inclusions
  const markMatch = t.match(/(?:inclusion|vein|crack|mark|scratch|pattern|phantom|druzy)[:\s]*([^\n,.;]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();

  // Diaphaneity
  const diaMatch = t.match(/(?:transparent|translucent|opaque)/i);
  if (diaMatch) result.diaphaneity = diaMatch[0].charAt(0).toUpperCase() + diaMatch[0].slice(1).toLowerCase();

  // Rarity
  const rarityMatch = t.match(/(?:rarity[:\s]+)([^\n,.;]+)/i);
  if (rarityMatch) result.rarity_score = rarityMatch[1].trim();

  // Bench notes
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

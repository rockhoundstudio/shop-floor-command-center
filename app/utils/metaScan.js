export const TARGET_KEYS = [
  "crystal_structure",
  "mineral_class",
  "rock_formation",
  "geological_era",
  "rock_composition",
  "hardness",
  "where_found",
  "geological_age",
  "character_marks",
  "stone_story",
  "rescued_by",
  "origin_location"
];

export const FIELD_LABELS = {
  crystal_structure: "Crystal Structure",
  mineral_class: "Mineral Class",
  rock_formation: "Rock Formation",
  geological_era: "Geological Era",
  rock_composition: "Rock Composition",
  hardness: "Hardness",
  where_found: "Where Found",
  geological_age: "Geological Age",
  character_marks: "Character Marks",
  stone_story: "Stone Story",
  rescued_by: "Rescued By",
  origin_location: "Origin Location"
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
  if (hardnessMatch) result.hardness = hardnessMatch[1].trim();

  return result;
}

export function evaluateProductStatus(metafieldsObj) {
  const filledCount = TARGET_KEYS.filter(
    k => metafieldsObj[k] !== undefined && metafieldsObj[k] !== null && metafieldsObj[k].trim() !== ""
  ).length;

  let status = "🔴 Empty";
  if (filledCount === TARGET_KEYS.length) {
    status = "✅ Complete";
  } else if (filledCount > 0) {
    status = "⚠️ Partial";
  }

  return { status, filledCount };
}
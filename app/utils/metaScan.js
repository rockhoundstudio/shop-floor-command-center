// --- THE 31 TARGET METAFIELD KEYS ---
// Updated May 1, 2026: Fixed crystal_system, added 8 new OOAK/Taxonomy fields.
export const TARGET_KEYS = [
  "official_name",
  "mineral_class",
  "crystal_system",     // 🐛 FIXED: Was 'crystal_structure'
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
  "dimensions_mm",      // 🐛 FIXED: Was 'dimensions'
  "stone_story",
  "bench_notes",
  "story_theme",        // 🆕 NEW
  "origin_page_handle", // 🆕 NEW
  "treatment_status",   // 🆕 NEW
  "surface_finish",     // 🆕 NEW
  "stone_shape",        // 🆕 NEW
  "is_ooak",            // 🆕 NEW
  "custom_product"      // 🆕 NEW
];

export const FIELD_LABELS = {
  official_name:     "Official Name",
  mineral_class:     "Mineral Class",
  crystal_system:    "Crystal System",
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
  dimensions_mm:     "Dimensions (mm)",
  stone_story:       "Stone Story",
  bench_notes:       "Bench Notes",
  story_theme:       "Story Theme",
  origin_page_handle:"Origin Page Handle",
  treatment_status:  "Treatment Status",
  surface_finish:    "Surface Finish",
  stone_shape:       "Stone Shape",
  is_ooak:           "Is OOAK (One-of-a-Kind)",
  custom_product:    "Custom Product"
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
  if (dimMatch) result.dimensions_mm = dimMatch[1].replace(/\s/g, "") + " mm";

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

// ==========================================
// 🚀 SEO WIKIPEDIA AUTO-LINKER ENGINE
// ==========================================
// This dictionary maps lapidary terminology directly to your Shopify blog URLs.
export const SEO_DICTIONARY_LINKS = {
  "plume agate": "/blogs/rock-knowledge/plume-agate",
  "botswana agate": "/blogs/rock-knowledge/botswana-agate",
  "agate": "/blogs/rock-knowledge/agate",
  "jasper": "/blogs/rock-knowledge/jasper",
  "obsidian": "/blogs/rock-knowledge/obsidian",
  "labradorite": "/blogs/rock-knowledge/labradorite",
  "metamorphic": "/blogs/rock-knowledge/metamorphic-rocks",
  "igneous": "/blogs/rock-knowledge/igneous-rocks",
  "sedimentary": "/blogs/rock-knowledge/sedimentary-rocks",
  "silicate": "/blogs/rock-knowledge/silicates",
  "cabochon": "/blogs/lapidary-process/what-is-a-cabochon",
  "mohs scale": "/blogs/rock-knowledge/mohs-hardness-scale",
  "drusy": "/blogs/rock-knowledge/drusy-crystals",
  "druzy": "/blogs/rock-knowledge/drusy-crystals"
};

/**
 * Scans a Stone Story and safely injects HTML <a> tags for SEO terms 
 * without breaking existing HTML or double-linking words.
 */
export function autoLinkStory(text) {
  if (!text) return "";
  let linkedText = text;
  
  // Sort keys by length descending so "botswana agate" matches before just "agate"
  const terms = Object.keys(SEO_DICTIONARY_LINKS).sort((a, b) => b.length - a.length);
  
  terms.forEach(term => {
    // Regex looks for the exact word boundary, ignores case, and ensures it's NOT already inside an <a> tag
    const regex = new RegExp(`(?<!<a[^>]*>)\\b(${term})\\b(?![^<]*</a>)`, "gi");
    
    linkedText = linkedText.replace(regex, (match) => {
      // Wraps the matched word in a link pointing to your blog
      return `<a href="${SEO_DICTIONARY_LINKS[term]}" title="Learn more about ${match}" target="_blank" style="text-decoration: underline;">${match}</a>`;
    });
  });
  
  return linkedText;
}
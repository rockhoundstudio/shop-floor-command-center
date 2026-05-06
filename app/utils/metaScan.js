export const TARGET_KEYS = [
  "official_name", "stone_story", "cut_type", "stone_shape", "surface_finish",
  "treatment_status", "primary_color", "secondary_colors", "bench_notes",
  "rock_composition", "character_marks", "dimensions_mm", "moh_hardness", 
  "specific_gravity", "crystal_system", "luster", "cleavage", "fracture_pattern", 
  "diaphaneity", "tenacity"
];

export const MANUAL_KEYS = [
  "official_name", "stone_story", "cut_type", "stone_shape", "surface_finish",
  "treatment_status", "primary_color", "secondary_colors", "bench_notes",
  "rock_composition", "character_marks", "dimensions_mm"
];

export const DATABASE_KEYS = [
  "moh_hardness", 
  "specific_gravity", 
  "crystal_system", 
  "luster", 
  "cleavage", 
  "fracture_pattern", 
  "diaphaneity", 
  "tenacity"
];

export const FIELD_LABELS = {
  "official_name": "Official Name",
  "stone_story": "Stone Story",
  "cut_type": "Cut Type",
  "stone_shape": "Stone Shape",
  "primary_color": "Primary Color",
  "secondary_colors": "Secondary Colors",
  "surface_finish": "Surface Finish",
  "treatment_status": "Treatment Status",
  "bench_notes": "Bench Notes",
  "rock_composition": "Rock Composition",
  "character_marks": "Character Marks",
  "dimensions_mm": "Dimensions (mm)",
  "moh_hardness": "Mohs Hardness",
  "specific_gravity": "Specific Gravity",
  "crystal_system": "Crystal System",
  "luster": "Luster",
  "cleavage": "Cleavage",
  "fracture_pattern": "Fracture Pattern",
  "diaphaneity": "Diaphaneity",
  "tenacity": "Tenacity"
};

export function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
}

export function evaluateProductStatus(metafields) {
  let filledCount = 0;
  for (const key of TARGET_KEYS) {
    if (metafields[key] && String(metafields[key]).trim() !== "") {
      filledCount++;
    }
  }
  let status = "🔴 Empty";
  if (filledCount === TARGET_KEYS.length) {
    status = "✅ Complete";
  } else if (filledCount > 0) {
    status = "🟡 Partial";
  }
  return { status, filledCount };
}

export function parseDescription(description) {
  if (!description) return {};
  const data = {};
  const lines = description.split('\n');
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const matchedKey = TARGET_KEYS.find(k => k.includes(cleanKey) || cleanKey.includes(k));
      if (matchedKey) {
        data[matchedKey] = value;
      }
    }
  }
  return data;
}

export function autoLinkStory(storyText) {
  if (!storyText) return "";
  return storyText;
}

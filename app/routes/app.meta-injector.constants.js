export const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

export const METAFIELD_CONFIG = [
  { namespace: "custom", key: "official_name", type: "single_line_text_field", label: "🪨 Official Name" },

  { namespace: "shopify", key: "color-pattern", type: "list.metaobject_reference", label: "Color / Pattern", metaobjectType: "shopify--color-pattern" },
  { namespace: "shopify", key: "authenticity", type: "list.metaobject_reference", label: "Authenticity", metaobjectType: "shopify--authenticity" },
  { namespace: "shopify", key: "rarity", type: "list.metaobject_reference", label: "Rarity", metaobjectType: "shopify--rarity" },

  { namespace: "shopify", key: "crystal-system", type: "list.metaobject_reference", label: "Crystal System", metaobjectType: "shopify--crystal-system" },
  { namespace: "shopify", key: "geological-era", type: "list.metaobject_reference", label: "Geological Era", metaobjectType: "shopify--geological-era" },
  { namespace: "shopify", key: "mineral-class", type: "list.metaobject_reference", label: "Mineral Class", metaobjectType: "shopify--mineral-class" },
  { namespace: "shopify", key: "rock-composition", type: "list.metaobject_reference", label: "Rock Composition", metaobjectType: "shopify--rock-composition" },
  { namespace: "shopify", key: "rock-formation", type: "list.metaobject_reference", label: "Rock Formation", metaobjectType: "shopify--rock-formation" },

  { namespace: "custom", key: "mohs_hardness", type: "single_line_text_field", label: "Hardness (Mohs)" },
  { namespace: "custom", key: "luster", type: "single_line_text_field", label: "Luster" },
  { namespace: "custom", key: "fracture", type: "single_line_text_field", label: "Fracture" },
  { namespace: "custom", key: "cleavage", type: "single_line_text_field", label: "Cleavage" },
  { namespace: "custom", key: "specific_gravity", type: "single_line_text_field", label: "Specific Gravity" },
  { namespace: "custom", key: "diaphaneity", type: "single_line_text_field", label: "Diaphaneity" },

  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location" },
  { namespace: "custom", key: "meta_status", type: "json", label: "Data Integrity Status", hidden: true },
  { namespace: "custom", key: "rescued_by", name: "Rescued By", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "stone_story", name: "Stone Story", type: "list.single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "character_marks", name: "Character Marks", type: "list.single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "geological_age", name: "Geological Age", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "is_ooak", name: "Is One of a Kind", type: "boolean", prefix: "🪨" },
  { namespace: "custom", key: "stone_shape", name: "Stone Shape", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "dimensions_mm", name: "Dimensions (mm)", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "surface_finish", name: "Surface Finish", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "custom", key: "treatment_status", name: "Treatment Status", type: "single_line_text_field", prefix: "🪨" },
  { namespace: "shopify", key: "condition", name: "Google Condition", type: "list.metaobject_reference", prefix: "🔵" },
  { namespace: "shopify", key: "jewelry-material", name: "Google Jewelry Material", type: "list.metaobject_reference", prefix: "🔵" },
  { namespace: "shopify", key: "jewelry-type", name: "Google Jewelry Type", type: "list.metaobject_reference", prefix: "🔵" },
  { namespace: "shopify", key: "necklace-design", name: "Google Necklace Design", type: "list.metaobject_reference", prefix: "🔵" }
];

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
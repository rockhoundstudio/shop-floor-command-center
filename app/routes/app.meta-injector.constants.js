export const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

export const COLOR_GROUP_LABELS = {
  green: { label: "Always Fill", color: "#2E7D32" },
  blue: { label: "Stone Fields", color: "#1565C0" },
  orange: { label: "Story & Lore", color: "#E65100" },
  purple: { label: "Mixed Media", color: "#6A1B9A" },
  yellow: { label: "Google / SEO", color: "#F9A825" }
};

export const DROPDOWN_OPTIONS = {
  handcrafted_by: ["Bob and Janyce", "Bob", "Janyce", "Guest Artist"],
  is_one_of_a_kind: ["Yes", "No"],
  treated: ["Yes", "No"],
  surface_finish: ["Polished", "Matte", "Natural", "High Polish"],
  found_object: ["Yes", "No"],
  setting_ready: ["Yes", "No"],
  bail_included: ["Yes", "No"]
};

export const METAFIELD_CONFIG = [
  // 🟢 ALWAYS FILL
  { namespace: "custom", key: "piece_name", type: "single_line_text_field", label: "Piece Name", colorGroup: "green", options: [] },
  { namespace: "custom", key: "primary_medium", type: "single_line_text_field", label: "Primary Medium", colorGroup: "green", options: [] },
  { namespace: "custom", key: "handcrafted_by", type: "single_line_text_field", label: "Handcrafted By", colorGroup: "green", options: DROPDOWN_OPTIONS.handcrafted_by },
  { namespace: "custom", key: "is_one_of_a_kind", type: "single_line_text_field", label: "Is One of a Kind", colorGroup: "green", options: DROPDOWN_OPTIONS.is_one_of_a_kind },
  { namespace: "custom", key: "treated", type: "single_line_text_field", label: "Treated", colorGroup: "green", options: DROPDOWN_OPTIONS.treated },

  // 🔵 STONE FIELDS
  { namespace: "custom", key: "material", type: "single_line_text_field", label: "Material", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "stone_family", type: "single_line_text_field", label: "Stone Family", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "color", type: "single_line_text_field", label: "Color", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "cut_and_shape", type: "single_line_text_field", label: "Cut and Shape", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "surface_finish", type: "single_line_text_field", label: "Surface Finish", colorGroup: "blue", options: DROPDOWN_OPTIONS.surface_finish },
  { namespace: "custom", key: "dimensions_mm", type: "single_line_text_field", label: "Dimensions (mm)", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "weight_grams", type: "single_line_text_field", label: "Weight (grams)", colorGroup: "blue", options: [] },

  // 🟠 STORY & LORE
  { namespace: "custom", key: "origin_story", type: "single_line_text_field", label: "Origin Story", colorGroup: "orange", options: [] },
  { namespace: "custom", key: "trip_or_series", type: "single_line_text_field", label: "Trip or Series", colorGroup: "orange", options: [] },
  { namespace: "custom", key: "honest_flaws_and_character", type: "single_line_text_field", label: "Honest Flaws and Character", colorGroup: "orange", options: [] },
  { namespace: "custom", key: "artist_notes", type: "single_line_text_field", label: "Artist Notes", colorGroup: "orange", options: [] },
  { namespace: "custom", key: "collection_name", type: "single_line_text_field", label: "Collection Name", colorGroup: "orange", options: [] },

  // 🟣 MIXED MEDIA
  { namespace: "custom", key: "secondary_medium", type: "single_line_text_field", label: "Secondary Medium", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "found_object", type: "single_line_text_field", label: "Found Object", colorGroup: "purple", options: DROPDOWN_OPTIONS.found_object },

  // 🟡 GOOGLE / SEO
  { namespace: "custom", key: "primary_use", type: "single_line_text_field", label: "Primary Use", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "setting_ready", type: "single_line_text_field", label: "Setting Ready", colorGroup: "yellow", options: DROPDOWN_OPTIONS.setting_ready },
  { namespace: "custom", key: "bail_included", type: "single_line_text_field", label: "Bail Included", colorGroup: "yellow", options: DROPDOWN_OPTIONS.bail_included }
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
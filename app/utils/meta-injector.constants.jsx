export const ROCKHOUND_FIELDS = [
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "primary_medium", label: "Primary Medium", type: "single_line_text_field" },
  { key: "secondary_medium", label: "Secondary Medium", type: "single_line_text_field" },
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "material", label: "Material", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field" },
  { key: "color", label: "Color", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut and Shape", type: "single_line_text_field" },
  { key: "surface_finish", label: "Surface Finish", isDropdown: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "collection_name", label: "Collection Name", type: "single_line_text_field" },
  { key: "collection_location", label: "Collection Location", type: "single_line_text_field" },
  { key: "collection_date", label: "Collection Date", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", isDropdown: true },
  { key: "setting_ready", label: "Setting Ready", isDropdown: true },
  { key: "bail_included", label: "Bail Included", isDropdown: true },
  { key: "is_one_of_a_kind", label: "Is One of a Kind", isDropdown: true },
  { key: "treated", label: "Treated", isDropdown: true },
  { key: "found_object", label: "Found Object", isDropdown: true },
  { key: "wire_material", label: "Wire Material", isDropdown: true },
  { key: "artist_notes", label: "Artist Notes", type: "single_line_text_field", multiline: true }
];

export const DEFAULT_DROPDOWNS = {
  surface_finish: ["High polish lapidary finish", "Satin lapidary finish", "Raw natural surface", "Partial polish", "Tumble polished", "Hand rubbed finish"],
  primary_use: ["Wearable pendant", "Lapidary cabochon for setting", "Wire wrapped jewelry", "Display specimen", "Collector piece", "Freeform stone art", "Bezel setting ready", "Rockhound specimen"],
  setting_ready: ["Yes — bezel ready", "Yes — prong ready", "Needs evaluation", "No — display only"],
  bail_included: ["No bail", "Pinch bail included", "Custom copper wire bail", "Custom gold plated bail", "Soldered bail"],
  is_one_of_a_kind: ["Yes — one of a kind", "No — series piece"],
  treated: ["Untreated — natural", "Stabilized", "Dyed", "Coated", "Heat treated"],
  found_object: ["Wild collected — Bob and Janyce", "Customer submission", "Purchased rough", "Gifted specimen", "Rescued material"],
  wire_material: ["Copper wire", "Brass wire", "Sterling silver wire", "Gold plated wire", "Copper and brass mixed"]
};

export const REQUIRED_FIELDS = [
  "piece_name", "primary_medium", "handcrafted_by", "is_one_of_a_kind", 
  "treated", "material", "origin_story", "collection_name", "primary_use"
];

export const productTypeOptions = [
  "Cabochon", "Pendant", "Necklace", "Earrings", "Ring", "Bracelet", "Wire Wrap", "Driftwood Art", "Display Specimen", "Collector Piece", "Other"
];

export const collectionLocationOptions = [
  "Spokane River",
  "Yakima Canyon",
  "Yellowstone River",
  "Richardson's Rock Ranch",
  "The 3,000-Mile Run",
  "Nickel Back",
  "Rufus Serpentine",
  "The Shopped Rock",
  "The Gallery"
];

export const EXCLUDED_TITLES = [
  "Black Cord Necklace", 
  "Sterling Silver Pinch Bail"
];

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
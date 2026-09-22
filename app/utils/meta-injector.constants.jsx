// ==========================================================================
// ROCKHOUND STUDIO — BENCH CONSTANTS & DROPDOWNS
// File: app/utils/meta-injector.constants.jsx
// (100% Original Architecture Preserved + 62-Field Standard Centralized)
// ==========================================================================

// 🟢 MASTER 62-FIELD TARGET ARRAY (Centralized Source of Truth)
export const TARGET_KEYS = [
  "official_name", "stone_story", "cut_type", "stone_shape", "surface_finish",
  "treatment_status", "primary_color", "secondary_colors", "bench_notes",
  "rock_composition", "character_marks", "dimensions_mm", "mohs_hardness",
  "specific_gravity", "crystal_system", "luster", "cleavage", "fracture_pattern",
  "diaphaneity", "tenacity", "origin_story", "stone_family", "piece_name",
  "origin_handle", "origin_page_handle", "origin_location", "shopify_title",
  "collection_name", "collection_location", "seo_title", "authenticity",
  "rarity", "secondary_medium", "cut_and_shape", "jewelry_type", "necklace_design",
  "jewelry_finding_type", "color_pattern", "material", "generated_description",
  "color", "primary_use", "primary_medium", "wire_material", "setting_ready",
  "bail_included", "chain_material", "geological_era", "mineral_class",
  "rock_formation", "geological_age", "treated", "is_ooak", "age_group",
  "target_gender", "condition", "google_product_category", "alt_text",
  "weight_grams", "shipping_weight_oz", "price", "handcrafted_by", "rescued_by",
  "honest_flaws_and_character", "artist_notes", "custom_product", "found_object",
  "chain_link_type"
];

// NEW: Added safely for Tab 1 Auto-Pilot (Does not break existing tabs)
export const STUDIO_DEFAULTS = {
  handcrafted_by: "Bob & Janyce, Rockhound Studio",
  rescued_by: "Bob and Janyce",
  is_ooak: "true",
  treated: "Untreated — Natural",
  google_age_group: "adult",
  google_target_gender: "unisex",
  google_condition: "new",
};

export const ROCKHOUND_FIELDS = [
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field" },
  { key: "official_name", label: "Official Name", type: "single_line_text_field" },
  { key: "primary_medium", label: "Primary Medium", type: "single_line_text_field" },
  { key: "secondary_medium", label: "Secondary Medium", type: "single_line_text_field" },
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field" },
  { key: "material", label: "Material", type: "single_line_text_field" },
  { key: "stone_family", label: "Stone Family", type: "select" },
  { key: "color", label: "Color", type: "single_line_text_field" },
  { key: "primary_color", label: "Primary Color", type: "single_line_text_field" },
  { key: "secondary_colors", label: "Secondary Colors", type: "single_line_text_field" },
  { key: "cut_and_shape", label: "Cut and Shape", type: "single_line_text_field" },
  { key: "stone_shape", label: "Stone Shape", type: "single_line_text_field" },
  { key: "cut_type", label: "Cut Type", type: "single_line_text_field" },
  { key: "surface_finish", label: "Surface Finish", isDropdown: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field" },
  { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "single_line_text_field" },
  { key: "price", label: "Price", type: "single_line_text_field" },
  { key: "collection_name", label: "Collection Name", type: "single_line_text_field" },
  { key: "collection_location", label: "Collection Location", type: "single_line_text_field" },
  { key: "collection_date", label: "Collection Date", type: "single_line_text_field" },
  { key: "primary_use", label: "Primary Use", isDropdown: true },
  { key: "setting_ready", label: "Setting Ready", isDropdown: true },
  { key: "bail_included", label: "Bail Included", isDropdown: true },
  { key: "is_ooak", label: "Is One of a Kind", isDropdown: true },
  { key: "treated", label: "Treated", isDropdown: true },
  { key: "treatment_status", label: "Treatment Status", type: "single_line_text_field" },
  { key: "found_object", label: "Found Object", isDropdown: true },
  { key: "wire_material", label: "Wire Material", isDropdown: true },
  { key: "chain_material", label: "Chain Material", type: "single_line_text_field" },
  { key: "artist_notes", label: "Artist Notes", type: "single_line_text_field", multiline: true },
  { key: "bench_notes", label: "Bench Notes", type: "single_line_text_field", multiline: true },
  { key: "character_marks", label: "Character Marks", type: "single_line_text_field", multiline: true },
  { key: "honest_flaws_and_character", label: "Honest Flaws & Character", type: "single_line_text_field", multiline: true },
  { key: "origin_handle", label: "Origin Handle", type: "single_line_text_field" },
  { key: "origin_page_handle", label: "Origin Page Handle", type: "single_line_text_field" },
  { key: "origin_location", label: "Origin Location", type: "single_line_text_field" },
  { key: "shopify_title", label: "Shopify Title", type: "single_line_text_field" },
  { key: "seo_title", label: "SEO Title", type: "single_line_text_field" },
  { key: "generated_description", label: "Generated Description", type: "single_line_text_field", multiline: true }
];

export const CHANNEL_REQUIREMENTS = {
  online_store: [
    "piece_name", "primary_medium", "handcrafted_by", "is_ooak",
    "treated", "material", "stone_family", "color", "cut_and_shape",
    "surface_finish", "dimensions_mm", "weight_grams", "origin_story",
    "collection_name", "origin_handle", "primary_use"
  ],
  point_of_sale: [
    "piece_name", "primary_medium", "material", "color", "price",
    "weight_grams", "dimensions_mm"
  ],
  shop_app: [
    "piece_name", "primary_medium", "material", "stone_family", "color",
    "surface_finish", "origin_story", "primary_use", "handcrafted_by",
    "is_ooak", "treated"
  ],
  facebook_instagram: [
    "piece_name", "primary_medium", "material", "color", "price",
    "primary_use", "handcrafted_by", "is_ooak", "treated",
    "surface_finish", "dimensions_mm", "weight_grams"
  ],
  google_youtube: [
    "piece_name", "primary_medium", "material", "color", "price",
    "primary_use", "setting_ready", "bail_included", "wire_material",
    "handcrafted_by", "is_ooak", "treated", "surface_finish",
    "dimensions_mm", "weight_grams", "found_object", "condition",
    "age_group", "target_gender", "authenticity", "rarity", "color_pattern"
  ],
  inbox: [
    "piece_name", "primary_medium", "material", "color", "price"
  ]
};

export function getFieldStatus(key, value, context = {}) {
  const isFilled = value !== undefined && value !== null && value.toString().trim() !== "";
  if (isFilled) return "green";

  const primaryUse = context.primary_use || "";
  const isJewelry = primaryUse === "Wearable Art" || primaryUse === "Pendant";

  const JEWELRY_ONLY_FIELDS = [
    "jewelry_type", "necklace_design", "chain_link_type", "chain_material",
    "jewelry_finding_type", "wire_material", "bail_included", "setting_ready"
  ];

  const ALWAYS_OPTIONAL_FIELDS = [
    "honest_flaws_and_character", "character_marks", "artist_notes", "bench_notes",
    "stone_shape", "secondary_medium", "collection_date",
    "stone_story", "custom_product", "trip_or_series", "alt_text"
  ];

  if (ALWAYS_OPTIONAL_FIELDS.includes(key)) return "yellow";

  if (JEWELRY_ONLY_FIELDS.includes(key)) {
    if (isJewelry) {
      const isRequiredByAnyChannel = Object.values(CHANNEL_REQUIREMENTS).some(fields => fields.includes(key));
      return isRequiredByAnyChannel ? "red" : "yellow";
    }
    return "yellow";
  }

  const isRequiredByAnyChannel = Object.values(CHANNEL_REQUIREMENTS).some(fields => fields.includes(key));
  if (isRequiredByAnyChannel) return "red";
  return "yellow";
}

// UPGRADED: Kept all original options + added Smart Switch triggers for Tab 1
export const productTypeOptions = [
  "Cabochon", 
  "Pendant (Finished Jewelry)", 
  "Necklace", 
  "Earrings", 
  "Ring / Bezel Setting", 
  "Bracelet", 
  "Wire Wrap (Finished Jewelry)", 
  "Driftwood Art", 
  "Display Specimen", 
  "Collector Piece", 
  "Other"
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
  green: { label: "Core Ignition & Lore", color: "#2E7D32" },
  blue: { label: "Physical Specs & Bench", color: "#1565C0" },
  teal: { label: "Geo-Vault Science", color: "#00695C" },
  purple: { label: "Jewelry & Hardware", color: "#6A1B9A" },
  yellow: { label: "Google / SEO", color: "#F9A825" }
};

export const DROPDOWN_OPTIONS = {};

DROPDOWN_OPTIONS.stone_family = [
  { label: "Agate", value: "Agate" },
  { label: "Amazonite", value: "Amazonite" },
  { label: "Amethyst", value: "Amethyst" },
  { label: "Andesite", value: "Andesite" },
  { label: "Apatite", value: "Apatite" },
  { label: "Aquamarine", value: "Aquamarine" },
  { label: "Argillite", value: "Argillite" },
  { label: "Aventurine", value: "Aventurine" },
  { label: "Azurite", value: "Azurite" },
  { label: "Basalt", value: "Basalt" },
  { label: "Beryl", value: "Beryl" },
  { label: "Biggs Jasper", value: "Biggs Jasper" },
  { label: "Bloodstone", value: "Bloodstone" },
  { label: "Blue Lace Agate", value: "Blue Lace Agate" },
  { label: "Botswana Agate", value: "Botswana Agate" },
  { label: "Brecciated Jasper", value: "Brecciated Jasper" },
  { label: "Brecciated Quartz", value: "Brecciated Quartz" },
  { label: "Bumblebee Jasper", value: "Bumblebee Jasper" },
  { label: "Calcite", value: "Calcite" },
  { label: "Carnelian", value: "Carnelian" },
  { label: "Chalcedony", value: "Chalcedony" },
  { label: "Charoite", value: "Charoite" },
  { label: "Chrysocolla", value: "Chrysocolla" },
  { label: "Chrysoprase", value: "Chrysoprase" },
  { label: "Citrine", value: "Citrine" },
  { label: "Copper", value: "Copper" },
  { label: "Crazy Lace Agate", value: "Crazy Lace Agate" },
  { label: "Dallasite", value: "Dallasite" },
  { label: "Dalmatian Stone", value: "Dalmatian Stone" },
  { label: "Dendritic Agate", value: "Dendritic Agate" },
  { label: "Dumortierite", value: "Dumortierite" },
  { label: "Ellensburg Blue Agate", value: "Ellensburg Blue Agate" },
  { label: "Feldspar", value: "Feldspar" },
  { label: "Fire Agate", value: "Fire Agate" },
  { label: "Fluorite", value: "Fluorite" },
  { label: "Garnet", value: "Garnet" },
  { label: "Gold", value: "Gold" },
  { label: "Gold Sheen Obsidian", value: "Gold Sheen Obsidian" },
  { label: "Granite", value: "Granite" },
  { label: "Hawk's Eye", value: "Hawk's Eye" },
  { label: "Hematite", value: "Hematite" },
  { label: "Hornblende", value: "Hornblende" },
  { label: "Howlite", value: "Howlite" },
  { label: "Ironstone", value: "Ironstone" },
  { label: "Ironstone Matrix", value: "Ironstone Matrix" },
  { label: "Jadeite", value: "Jadeite" },
  { label: "Jasper", value: "Jasper" },
  { label: "Kambaba Jasper", value: "Kambaba Jasper" },
  { label: "Kyanite", value: "Kyanite" },
  { label: "Labradorite", value: "Labradorite" },
  { label: "Lace Agate", value: "Lace Agate" },
  { label: "Lapis Lazuli", value: "Lapis Lazuli" },
  { label: "Larvikite", value: "Larvikite" },
  { label: "Lepidolite", value: "Lepidolite" },
  { label: "Magnesite", value: "Magnesite" },
  { label: "Mahogany Obsidian", value: "Mahogany Obsidian" },
  { label: "Malachite", value: "Malachite" },
  { label: "Montana Agate", value: "Montana Agate" },
  { label: "Mookaite", value: "Mookaite" },
  { label: "Moonstone", value: "Moonstone" },
  { label: "Morrisonite", value: "Morrisonite" },
  { label: "Moss Agate", value: "Moss Agate" },
  { label: "Nephrite", value: "Nephrite" },
  { label: "Obsidian", value: "Obsidian" },
  { label: "Ocean Jasper", value: "Ocean Jasper" },
  { label: "Onyx Marble", value: "Onyx Marble" },
  { label: "Owyhee Jasper", value: "Owyhee Jasper" },
  { label: "Petrified Wood", value: "Petrified Wood" },
  { label: "Picture Jasper", value: "Picture Jasper" },
  { label: "Pietersite", value: "Pietersite" },
  { label: "Plume Agate", value: "Plume Agate" },
  { label: "Prasiolite", value: "Prasiolite" },
  { label: "Prehnite", value: "Prehnite" },
  { label: "Pumice", value: "Pumice" },
  { label: "Pyrite", value: "Pyrite" },
  { label: "Quartz", value: "Quartz" },
  { label: "Quartzite", value: "Quartzite" },
  { label: "Rainbow Obsidian", value: "Rainbow Obsidian" },
  { label: "Red Jasper", value: "Red Jasper" },
  { label: "Rhodochrosite", value: "Rhodochrosite" },
  { label: "Rhodonite", value: "Rhodonite" },
  { label: "Rhyolite", value: "Rhyolite" },
  { label: "Rose Quartz", value: "Rose Quartz" },
  { label: "Rutilated Quartz", value: "Rutilated Quartz" },
  { label: "Serpentine", value: "Serpentine" },
  { label: "Silver", value: "Silver" },
  { label: "Silver Sheen Obsidian", value: "Silver Sheen Obsidian" },
  { label: "Smithsonite", value: "Smithsonite" },
  { label: "Smoky Quartz", value: "Smoky Quartz" },
  { label: "Snowflake Obsidian", value: "Snowflake Obsidian" },
  { label: "Sodalite", value: "Sodalite" },
  { label: "Spinel", value: "Spinel" },
  { label: "Star Garnet", value: "Star Garnet" },
  { label: "Sunstone", value: "Sunstone" },
  { label: "Thunderegg", value: "Thunderegg" },
  { label: "Tiger's Eye", value: "Tiger's Eye" },
  { label: "Topaz", value: "Topaz" },
  { label: "Tourmalinated Quartz", value: "Tourmalinated Quartz" },
  { label: "Tourmaline", value: "Tourmaline" },
  { label: "Tree Agate", value: "Tree Agate" },
  { label: "Turquoise", value: "Turquoise" },
  { label: "Unakite", value: "Unakite" },
  { label: "Variscite", value: "Variscite" },
  { label: "Yellow Jasper", value: "Yellow Jasper" },
];

DROPDOWN_OPTIONS.surface_finish = [
  { label: "High Polish", value: "High Polish" },
  { label: "Satin Polish", value: "Satin Polish" },
  { label: "Matte", value: "Matte" },
  { label: "Waxy", value: "Waxy" },
  { label: "Waxy to Dull", value: "Waxy to Dull" },
  { label: "Vitreous to Pearly", value: "Vitreous to Pearly" },
  { label: "Natural / Rough", value: "Natural / Rough" },
  { label: "Tumbled", value: "Tumbled" }
];

DROPDOWN_OPTIONS.cut_and_shape = [
  { label: "Freeform", value: "Freeform" },
  { label: "Heart", value: "Heart" },
  { label: "Marquise", value: "Marquise" },
  { label: "Oval Cabochon", value: "Oval Cabochon" },
  { label: "Pear", value: "Pear" },
  { label: "Round Cabochon", value: "Round Cabochon" },
  { label: "Cabochon", value: "Cabochon" },
  { label: "Standard Cabochon", value: "Standard Cabochon" },
  { label: "Surfboard", value: "Surfboard" },
  { label: "Teardrop", value: "Teardrop" },
  { label: "Trillion", value: "Trillion" },
  { label: "Slab", value: "Slab" },
  { label: "Rough", value: "Rough" }
];

DROPDOWN_OPTIONS.handcrafted_by = [
  { label: "Bob & Janyce, Rockhound Studio", value: "Bob & Janyce, Rockhound Studio" },
  { label: "Robert", value: "Robert" },
  { label: "Janyce", value: "Janyce" }
];

DROPDOWN_OPTIONS.is_ooak = [
  { label: "Yes — one of a kind", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.treated = [
  { label: "Untreated — Natural", value: "Untreated — Natural" },
  { label: "Stabilized", value: "Stabilized" },
  { label: "Dyed", value: "Dyed" },
  { label: "Resined", value: "Resined" },
  { label: "Enhanced", value: "Enhanced" }
];

DROPDOWN_OPTIONS.found_object = [
  { label: "Yes — found in the wild", value: "true" },
  { label: "No — purchased rough", value: "No — purchased rough" }
];

DROPDOWN_OPTIONS.primary_use = [
  { label: "Wearable Art", value: "Wearable Art" },
  { label: "Pendant", value: "Pendant" },
  { label: "Display Piece", value: "Display Piece" },
  { label: "Cabochon — Setting Ready", value: "Cabochon — Setting Ready" },
  { label: "Collector Specimen", value: "Collector Specimen" }
];

DROPDOWN_OPTIONS.setting_ready = [
  { label: "Yes", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.bail_included = [
  { label: "Yes", value: "true" },
  { label: "No", value: "No" }
];

DROPDOWN_OPTIONS.chain_material = [
  { label: "Silver Plated Snake Chain", value: "Silver Plated Snake Chain" },
  { label: "Gold Plated Snake Chain", value: "Gold Plated Snake Chain" },
  { label: "Sterling Silver Chain", value: "Sterling Silver Chain" },
  { label: "Black Cord", value: "Black Cord" },
  { label: "Brown Cord", value: "Brown Cord" },
  { label: "Tan Cord", value: "Tan Cord" },
  { label: "Ivory Cord", value: "Ivory Cord" },
  { label: "White Cord", value: "White Cord" },
  { label: "Gold Cord", value: "Gold Cord" },
  { label: "Red Cord", value: "Red Cord" },
  { label: "Burgundy Cord", value: "Burgundy Cord" },
  { label: "Steel Blue Cord", value: "Steel Blue Cord" },
  { label: "Purple Cord", value: "Purple Cord" },
  { label: "Olive Green Cord", value: "Olive Green Cord" },
  { label: "None", value: "None" }
];

export function normalizeDropdownValue(key, rawValue) {
  if (!rawValue || rawValue.includes("gid://")) return "";
  if (rawValue === undefined || rawValue === null) return "";
  
  const options = DROPDOWN_OPTIONS[key];
  if (!options || options.length === 0) return String(rawValue);
  
  let cleanRaw = String(rawValue);
  if (cleanRaw.startsWith('[') && cleanRaw.endsWith(']')) {
    try {
      const parsed = JSON.parse(cleanRaw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cleanRaw = String(parsed[0]);
      }
    } catch (e) {
      // Ignore parse failure, fall back to string cleaning below
    }
  }

  const raw = cleanRaw.toLowerCase().trim();
  const match = options.find(opt =>
    String(opt.value).toLowerCase().trim() === raw ||
    String(opt.label).toLowerCase().trim() === raw
  );
  
  return match ? match.value : String(rawValue);
}

// 🟢 MAPPED ALL 62 FIELDS TO UI GROUPS
export const FULL_META_GROUPS = [
  {
    heading: "Core Ignition & Lore",
    color: "#2E7D32",
    fields: [
      { key: "shopify_title", label: "Shopify Title", type: "text" },
      { key: "piece_name", label: "Piece Name", type: "text" },
      { key: "official_name", label: "Official Name", type: "text" },
      { key: "seo_title", label: "SEO Title", type: "text" },
      { key: "stone_family", label: "Stone Family", type: "select" },
      { key: "origin_location", label: "Origin Location", type: "text" },
      { key: "origin_handle", label: "Origin Handle", type: "text" },
      { key: "origin_page_handle", label: "Origin Page Handle", type: "text" },
      { key: "collection_name", label: "Collection Name", type: "text" },
      { key: "collection_location", label: "Collection Location", type: "text" },
      { key: "is_ooak", label: "Is One of a Kind", type: "text" },
      { key: "handcrafted_by", label: "Handcrafted By", type: "text" },
      { key: "rescued_by", label: "Rescued By", type: "text" },
      { key: "origin_story", label: "Origin Story", type: "text", multiline: true },
      { key: "stone_story", label: "Stone Story", type: "text", multiline: true },
      { key: "generated_description", label: "Generated Description", type: "text", multiline: true }
    ]
  },
  {
    heading: "Physical Specs & Lapidary Bench",
    color: "#1565C0",
    fields: [
      { key: "dimensions_mm", label: "Dimensions (mm)", type: "text" },
      { key: "weight_grams", label: "Weight (grams)", type: "text" },
      { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "text" },
      { key: "price", label: "Price", type: "text" },
      { key: "stone_shape", label: "Stone Shape", type: "text" },
      { key: "cut_type", label: "Cut Type", type: "text" },
      { key: "cut_and_shape", label: "Cut and Shape", type: "text" },
      { key: "surface_finish", label: "Surface Finish", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "primary_color", label: "Primary Color", type: "text" },
      { key: "secondary_colors", label: "Secondary Colors", type: "text" },
      { key: "color_pattern", label: "Color Pattern", type: "text" },
      { key: "treatment_status", label: "Treatment Status", type: "text" },
      { key: "treated", label: "Treated", type: "text" },
      { key: "character_marks", label: "Character Marks", type: "text", multiline: true },
      { key: "honest_flaws_and_character", label: "Honest Flaws and Character", type: "text", multiline: true },
      { key: "bench_notes", label: "Bench Notes", type: "text", multiline: true },
      { key: "artist_notes", label: "Artist Notes", type: "text", multiline: true },
      { key: "alt_text", label: "Alt Text", type: "text" }
    ]
  },
  {
    heading: "Geo-Vault Science",
    color: "#00695C",
    fields: [
      { key: "mohs_hardness", label: "Mohs Hardness", type: "text" },
      { key: "specific_gravity", label: "Specific Gravity", type: "text" },
      { key: "crystal_system", label: "Crystal System", type: "text" },
      { key: "luster", label: "Luster", type: "text" },
      { key: "cleavage", label: "Cleavage", type: "text" },
      { key: "fracture_pattern", label: "Fracture Pattern", type: "text" },
      { key: "diaphaneity", label: "Diaphaneity", type: "text" },
      { key: "tenacity", label: "Tenacity", type: "text" },
      { key: "mineral_class", label: "Mineral Class", type: "text" },
      { key: "rock_composition", label: "Rock Composition", type: "text" },
      { key: "rock_formation", label: "Rock Formation", type: "text" },
      { key: "geological_era", label: "Geological Era", type: "text" },
      { key: "geological_age", label: "Geological Age", type: "text" }
    ]
  },
  {
    heading: "Jewelry & Hardware Settings",
    color: "#6A1B9A",
    fields: [
      { key: "primary_use", label: "Primary Use", type: "text" },
      { key: "primary_medium", label: "Primary Medium", type: "text" },
      { key: "secondary_medium", label: "Secondary Medium", type: "text" },
      { key: "material", label: "Material", type: "text" },
      { key: "jewelry_type", label: "Jewelry Type", type: "text" },
      { key: "necklace_design", label: "Necklace Design", type: "text" },
      { key: "setting_ready", label: "Setting Ready", type: "text" },
      { key: "wire_material", label: "Wire Material", type: "text" },
      { key: "bail_included", label: "Bail Included", type: "text" },
      { key: "chain_material", label: "Chain Material", type: "text" },
      { key: "chain_link_type", label: "Chain Link Type", type: "text" },
      { key: "jewelry_finding_type", label: "Jewelry Finding Type", type: "text" }
    ]
  },
  {
    heading: "Google Channels & Attributes",
    color: "#F9A825",
    fields: [
      { key: "google_product_category", label: "Google Product Category", type: "text" },
      { key: "age_group", label: "Age Group", type: "text" },
      { key: "target_gender", label: "Target Gender", type: "text" },
      { key: "condition", label: "Condition", type: "text" },
      { key: "authenticity", label: "Authenticity", type: "text" },
      { key: "rarity", label: "Rarity", type: "text" },
      { key: "custom_product", label: "Custom Product", type: "text" },
      { key: "found_object", label: "Found Object", type: "text" }
    ]
  }
];

export const METAFIELD_CONFIG = [
  // 🟢 CORE IGNITION
  { namespace: "custom", key: "shopify_title", type: "single_line_text_field", label: "Shopify Title", colorGroup: "green", options: [] },
  { namespace: "custom", key: "piece_name", type: "single_line_text_field", label: "Piece Name", colorGroup: "green", options: [] },
  { namespace: "custom", key: "official_name", type: "single_line_text_field", label: "Official Name", colorGroup: "green", options: [] },
  { namespace: "custom", key: "seo_title", type: "single_line_text_field", label: "SEO Title", colorGroup: "green", options: [] },
  { namespace: "custom", key: "stone_family", type: "select", label: "Stone Family", colorGroup: "green", options: DROPDOWN_OPTIONS.stone_family },
  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location", colorGroup: "green", options: [] },
  { namespace: "custom", key: "origin_handle", type: "single_line_text_field", label: "Origin Handle", colorGroup: "green", options: [] },
  { namespace: "custom", key: "origin_page_handle", type: "single_line_text_field", label: "Origin Page Handle", colorGroup: "green", options: [] },
  { namespace: "custom", key: "collection_name", type: "single_line_text_field", label: "Collection Name", colorGroup: "green", options: [] },
  { namespace: "custom", key: "collection_location", type: "single_line_text_field", label: "Collection Location", colorGroup: "green", options: [] },
  { namespace: "custom", key: "is_ooak", type: "single_line_text_field", label: "Is One of a Kind", colorGroup: "green", options: DROPDOWN_OPTIONS.is_ooak },
  { namespace: "custom", key: "handcrafted_by", type: "single_line_text_field", label: "Handcrafted By", colorGroup: "green", options: DROPDOWN_OPTIONS.handcrafted_by },
  { namespace: "custom", key: "rescued_by", type: "single_line_text_field", label: "Rescued By", colorGroup: "green", options: [] },
  { namespace: "custom", key: "origin_story", type: "multi_line_text_field", label: "Origin Story", colorGroup: "green", options: [] },
  { namespace: "custom", key: "stone_story", type: "multi_line_text_field", label: "Stone Story", colorGroup: "green", options: [] },
  { namespace: "custom", key: "generated_description", type: "multi_line_text_field", label: "Generated Description", colorGroup: "green", options: [] },

  // 🔵 PHYSICAL SPECS & BENCH
  { namespace: "custom", key: "dimensions_mm", type: "single_line_text_field", label: "Dimensions (mm)", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "weight_grams", type: "single_line_text_field", label: "Weight (grams)", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "shipping_weight_oz", type: "single_line_text_field", label: "Shipping Weight (oz)", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "price", type: "single_line_text_field", label: "Price", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "stone_shape", type: "single_line_text_field", label: "Stone Shape", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "cut_type", type: "single_line_text_field", label: "Cut Type", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "cut_and_shape", type: "single_line_text_field", label: "Cut and Shape", colorGroup: "blue", options: DROPDOWN_OPTIONS.cut_and_shape },
  { namespace: "custom", key: "surface_finish", type: "single_line_text_field", label: "Surface Finish", colorGroup: "blue", options: DROPDOWN_OPTIONS.surface_finish },
  { namespace: "custom", key: "color", type: "text", label: "Color", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "primary_color", type: "single_line_text_field", label: "Primary Color", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "secondary_colors", type: "single_line_text_field", label: "Secondary Colors", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "color_pattern", type: "single_line_text_field", label: "Color Pattern", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "treatment_status", type: "single_line_text_field", label: "Treatment Status", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "treated", type: "single_line_text_field", label: "Treated", colorGroup: "blue", options: DROPDOWN_OPTIONS.treated },
  { namespace: "custom", key: "character_marks", type: "multi_line_text_field", label: "Character Marks", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "honest_flaws_and_character", type: "multi_line_text_field", label: "Honest Flaws and Character", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "bench_notes", type: "multi_line_text_field", label: "Bench Notes", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "artist_notes", type: "multi_line_text_field", label: "Artist Notes", colorGroup: "blue", options: [] },
  { namespace: "custom", key: "alt_text", type: "single_line_text_field", label: "Alt Text", colorGroup: "blue", options: [] },

  // 🧪 GEO-VAULT (Teal)
  { namespace: "custom", key: "mohs_hardness", type: "single_line_text_field", label: "Mohs Hardness", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "specific_gravity", type: "single_line_text_field", label: "Specific Gravity", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "crystal_system", type: "single_line_text_field", label: "Crystal System", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "luster", type: "single_line_text_field", label: "Luster", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "cleavage", type: "single_line_text_field", label: "Cleavage", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "fracture_pattern", type: "single_line_text_field", label: "Fracture Pattern", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "diaphaneity", type: "single_line_text_field", label: "Diaphaneity", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "tenacity", type: "single_line_text_field", label: "Tenacity", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "mineral_class", type: "single_line_text_field", label: "Mineral Class", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "rock_composition", type: "single_line_text_field", label: "Rock Composition", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "rock_formation", type: "single_line_text_field", label: "Rock Formation", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "geological_era", type: "single_line_text_field", label: "Geological Era", colorGroup: "teal", options: [] },
  { namespace: "custom", key: "geological_age", type: "single_line_text_field", label: "Geological Age", colorGroup: "teal", options: [] },

  // 🟣 JEWELRY & HARDWARE
  { namespace: "custom", key: "primary_use", type: "single_line_text_field", label: "Primary Use", colorGroup: "purple", options: DROPDOWN_OPTIONS.primary_use },
  { namespace: "custom", key: "primary_medium", type: "single_line_text_field", label: "Primary Medium", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "secondary_medium", type: "single_line_text_field", label: "Secondary Medium", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "material", type: "single_line_text_field", label: "Material", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "jewelry_type", type: "single_line_text_field", label: "Jewelry Type", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "necklace_design", type: "single_line_text_field", label: "Necklace Design", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "setting_ready", type: "single_line_text_field", label: "Setting Ready", colorGroup: "purple", options: DROPDOWN_OPTIONS.setting_ready },
  { namespace: "custom", key: "wire_material", type: "single_line_text_field", label: "Wire Material", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "bail_included", type: "single_line_text_field", label: "Bail Included", colorGroup: "purple", options: DROPDOWN_OPTIONS.bail_included },
  { namespace: "custom", key: "chain_material", type: "single_line_text_field", label: "Chain Material", colorGroup: "purple", options: DROPDOWN_OPTIONS.chain_material },
  { namespace: "custom", key: "chain_link_type", type: "single_line_text_field", label: "Chain Link Type", colorGroup: "purple", options: [] },
  { namespace: "custom", key: "jewelry_finding_type", type: "single_line_text_field", label: "Jewelry Finding Type", colorGroup: "purple", options: [] },

  // 🟡 GOOGLE / SEO
  { namespace: "custom", key: "google_product_category", type: "single_line_text_field", label: "Google Product Category", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "age_group", type: "single_line_text_field", label: "Age Group", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "target_gender", type: "single_line_text_field", label: "Target Gender", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "condition", type: "single_line_text_field", label: "Condition", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "authenticity", type: "single_line_text_field", label: "Authenticity", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "rarity", type: "single_line_text_field", label: "Rarity", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "custom_product", type: "single_line_text_field", label: "Custom Product", colorGroup: "yellow", options: [] },
  { namespace: "custom", key: "found_object", type: "single_line_text_field", label: "Found Object", colorGroup: "yellow", options: DROPDOWN_OPTIONS.found_object }
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

export const DEFAULT_DROPDOWNS = {
  stone_family: "",
  surface_finish: "",
  color: "",
  cut_and_shape: "",
  handcrafted_by: "",
  is_ooak: "",
  treated: "",
  found_object: "",
  primary_use: "",
  setting_ready: "",
  bail_included: "",
  chain_material: "",
  wire_material: "",
  collection_location: "",
  product_type: ""
};
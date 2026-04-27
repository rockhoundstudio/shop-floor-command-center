const METAFIELDS = [
  // The Identity
  { key: "official_name", name: "Official Name", type: "single_line_text_field" },
  { key: "mineral_class", name: "Mineral Class", type: "single_line_text_field" },
  { key: "crystal_structure", name: "Crystal Structure", type: "single_line_text_field" },
  { key: "luster", name: "Luster", type: "single_line_text_field" },
  // The Chemistry
  { key: "chemical_formula", name: "Chemical Formula", type: "single_line_text_field" },
  { key: "rock_composition", name: "Rock Composition", type: "multi_line_text_field" },
  { key: "specific_gravity", name: "Specific Gravity", type: "number_decimal" },
  { key: "refractive_index", name: "Refractive Index", type: "number_decimal" },
  // The Hardness
  { key: "moh_hardness", name: "Mohs Hardness", type: "number_decimal" },
  { key: "fracture_pattern", name: "Fracture Pattern", type: "single_line_text_field" },
  { key: "cleavage", name: "Cleavage", type: "single_line_text_field" },
  { key: "tenacity", name: "Tenacity", type: "single_line_text_field" },
  // The Origin
  { key: "origin_location", name: "Origin Location", type: "single_line_text_field" },
  { key: "geological_age", name: "Geological Age", type: "single_line_text_field" },
  { key: "geological_era", name: "Geological Era", type: "single_line_text_field" },
  { key: "rock_formation", name: "Rock Formation", type: "single_line_text_field" },
  // The Discovery
  { key: "where_found", name: "Where Found", type: "single_line_text_field" },
  { key: "gps_coordinates", name: "GPS Coordinates", type: "single_line_text_field" },
  { key: "rescued_by", name: "Rescued By", type: "single_line_text_field" },
  { key: "date_of_discovery", name: "Date of Discovery", type: "date" },
  // The Visuals
  { key: "primary_color", name: "Primary Color", type: "single_line_text_field" },
  { key: "secondary_colors", name: "Secondary Colors", type: "single_line_text_field" },
  { key: "diaphaneity", name: "Diaphaneity (Opacity)", type: "single_line_text_field" },
  { key: "character_marks", name: "Character Marks", type: "multi_line_text_field" },
  // The Engineering
  { key: "cut_type", name: "Cut Type", type: "single_line_text_field" },
  { key: "carat_weight", name: "Carat Weight", type: "number_decimal" },
  { key: "dimensions", name: "Dimensions (mm)", type: "single_line_text_field" },
  { key: "polishing_compound", name: "Polishing Compound", type: "single_line_text_field" },
  // The Soul
  { key: "stone_story", name: "Stone Story", type: "multi_line_text_field" },
  { key: "rarity_score", name: "Rarity Score", type: "rating" },
  { key: "legacy_status", name: "Legacy Status", type: "boolean" },
  { key: "bench_notes", name: "Bench Notes", type: "multi_line_text_field" },
];

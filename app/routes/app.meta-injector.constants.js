export const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

export const colorOptions = [
  { label: "Select Color...", value: "" },
  { label: "Green", value: '["gid://shopify/Metaobject/151768563963"]' },
  { label: "Black", value: '["gid://shopify/Metaobject/151768596731"]' },
  { label: "Blue flash", value: '["gid://shopify/Metaobject/151792943355"]' },
  { label: "Red", value: '["gid://shopify/Metaobject/151881154811"]' },
  { label: "White", value: '["gid://shopify/Metaobject/151881810171"]' },
  { label: "Multicolor", value: '["gid://shopify/Metaobject/151950098683"]' },
  { label: "Gold", value: '["gid://shopify/Metaobject/151950754043"]' },
  { label: "Floral", value: '["gid://shopify/Metaobject/151951048955"]' },
  { label: "Pink", value: '["gid://shopify/Metaobject/151951507707"]' },
  { label: "Striped", value: '["gid://shopify/Metaobject/152875892987"]' },
  { label: "Beige", value: '["gid://shopify/Metaobject/152947491067"]' },
  { label: "Brown", value: '["gid://shopify/Metaobject/152947523835"]' },
  { label: "Clear", value: '["gid://shopify/Metaobject/152947556603"]' },
  { label: "Orange", value: '["gid://shopify/Metaobject/152947589371"]' },
  { label: "Yellow", value: '["gid://shopify/Metaobject/152947622139"]' },
  { label: "Bronze", value: '["gid://shopify/Metaobject/152947654907"]' },
  { label: "Yellow veins", value: '["gid://shopify/Metaobject/152948146427"]' },
  { label: "Landscape", value: '["gid://shopify/Metaobject/152951488763"]' },
  { label: "Blue", value: '["gid://shopify/Metaobject/152951816443"]' },
  { label: "Gray", value: '["gid://shopify/Metaobject/152951849211"]' },
  { label: "Silver", value: '["gid://shopify/Metaobject/152951881979"]' },
  { label: "Spots", value: '["gid://shopify/Metaobject/152952111355"]' },
  { label: "Dots", value: '["gid://shopify/Metaobject/152952144123"]' },
  { label: "Purple", value: '["gid://shopify/Metaobject/155539931387"]' }
];

export const authOptions = [
  { label: "Select Authenticity...", value: "" },
  { label: "Genuine", value: '["gid://shopify/Metaobject/151951114491"]' },
  { label: "Replica", value: '["gid://shopify/Metaobject/156128346363"]' }
];

export const rarityOptions = [
  { label: "Select Rarity...", value: "" },
  { label: "Common", value: '["gid://shopify/Metaobject/151951147259"]' },
  { label: "Rare", value: '["gid://shopify/Metaobject/154252050683"]' }
];

export const crystalOptions = [
  { label: "Select Crystal System...", value: "" },
  { label: "Monoclinic", value: '["gid://shopify/Metaobject/151951212795"]' },
  { label: "Trigonal", value: '["gid://shopify/Metaobject/154252116219"]' },
  { label: "Hexagonal", value: '["gid://shopify/Metaobject/154307625211"]' },
  { label: "Triclinic", value: '["gid://shopify/Metaobject/154308706555"]' }
];

export const eraOptions = [
  { label: "Select Geological Era...", value: "" },
  { label: "Precambrian", value: '["gid://shopify/Metaobject/151951245563"]' },
  { label: "Mesozoic", value: '["gid://shopify/Metaobject/154252083451"]' },
  { label: "Cenozoic", value: '["gid://shopify/Metaobject/154307854587"]' },
  { label: "Paleozoic", value: '["gid://shopify/Metaobject/156128379131"]' },
  { label: "Other", value: '["gid://shopify/Metaobject/156128444667"]' }
];

export const mineralClassOptions = [
  { label: "Select Mineral Class...", value: "" },
  { label: "Silicates", value: '["gid://shopify/Metaobject/151951278331"]' },
  { label: "Oxides", value: '["gid://shopify/Metaobject/155431371003"]' },
  { label: "Carbonates", value: '["gid://shopify/Metaobject/156128313595"]' }
];

export const rockCompOptions = [
  { label: "Select Rock Composition...", value: "" },
  { label: "Granite", value: '["gid://shopify/Metaobject/151951311099"]' },
  { label: "Obsidian", value: '["gid://shopify/Metaobject/155431338235"]' },
  { label: "Andesite", value: '["gid://shopify/Metaobject/156128411899"]' },
  { label: "Schist", value: '["gid://shopify/Metaobject/156128477435"]' },
  { label: "Jasper", value: '["gid://shopify/Metaobject/166239764731"]' }
];

export const rockFormOptions = [
  { label: "Select Rock Formation...", value: "" },
  { label: "Metamorphic", value: '["gid://shopify/Metaobject/151951343867"]' },
  { label: "Igneous", value: '["gid://shopify/Metaobject/154251985147"]' },
  { label: "Sedimentary", value: '["gid://shopify/Metaobject/154307657979"]' }
];

export const METAFIELD_CONFIG = [
  { namespace: "custom", key: "official_name", type: "single_line_text_field", label: "Official Name (North Star)" },
  { namespace: "shopify", key: "color-pattern", type: "list.metaobject_reference", label: "Color / Pattern", options: colorOptions },
  { namespace: "shopify", key: "authenticity", type: "list.metaobject_reference", label: "Authenticity", options: authOptions },
  { namespace: "shopify", key: "rarity", type: "list.metaobject_reference", label: "Rarity", options: rarityOptions },
  { namespace: "shopify", key: "crystal-system", type: "list.metaobject_reference", label: "Crystal System", options: crystalOptions },
  { namespace: "shopify", key: "geological-era", type: "list.metaobject_reference", label: "Geological Era", options: eraOptions },
  { namespace: "shopify", key: "mineral-class", type: "list.metaobject_reference", label: "Mineral Class", options: mineralClassOptions },
  { namespace: "shopify", key: "rock-composition", type: "list.metaobject_reference", label: "Rock Composition", options: rockCompOptions },
  { namespace: "shopify", key: "rock-formation", type: "list.metaobject_reference", label: "Rock Formation", options: rockFormOptions },
  { namespace: "custom", key: "hardness", type: "number_decimal", label: "Hardness (Mohs)" },
  { namespace: "custom", key: "luster", type: "single_line_text_field", label: "Luster" },
  { namespace: "custom", key: "fracture", type: "single_line_text_field", label: "Fracture" },
  { namespace: "custom", key: "cleavage", type: "single_line_text_field", label: "Cleavage" },
  { namespace: "custom", key: "specific_gravity", type: "number_decimal", label: "Specific Gravity" },
  { namespace: "custom", key: "diaphaneity", type: "single_line_text_field", label: "Diaphaneity" },
  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location" },
  { namespace: "custom", key: "meta_status", type: "json", label: "Data Integrity Status", hidden: true }
];

export const getLabelForValue = (key, value) => {
  const config = METAFIELD_CONFIG.find(c => c.key === key);
  if (config && config.options) {
    const match = config.options.find(o => o.value === value);
    return match ? match.label : value;
  }
  return value;
};

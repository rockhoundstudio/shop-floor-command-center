export const EXCLUDED_TITLES = ["Black Cord Necklace", "Sterling Silver Pinch Bail"];

// Notice we added 'metaobjectType' to the Shopify dropdowns so the backend knows the exact dictionary to query.
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

  { namespace: "custom", key: "store_hardness", type: "single_line_text_field", label: "Hardness (Mohs)" },
  { namespace: "custom", key: "store_luster", type: "single_line_text_field", label: "Luster" },
  { namespace: "custom", key: "store_fracture", type: "single_line_text_field", label: "Fracture" },
  { namespace: "custom", key: "store_cleavage", type: "single_line_text_field", label: "Cleavage" },
  { namespace: "custom", key: "store_specific_gravity", type: "single_line_text_field", label: "Specific Gravity" },
  { namespace: "custom", key: "store_diaphaneity", type: "single_line_text_field", label: "Diaphaneity" },

  { namespace: "custom", key: "origin_location", type: "single_line_text_field", label: "Origin Location" },
  { namespace: "custom", key: "meta_status", type: "json", label: "Data Integrity Status", hidden: true }
];

// --- ADDED: Helper function to translate GIDs into readable text for the UI ---
export function getLabelForValue(value, metaobjectHandles = {}) {
  if (!value) return "-";
  
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map(gid => {
        // Look up the handle, or fallback to the raw ID if handle isn't found
        return metaobjectHandles[gid] || gid.split('/').pop();
      }).join(", ");
    }
  } catch (e) {
    // If it's not JSON, it will fall through to the string check below
  }

  if (typeof value === "string" && value.includes("gid://shopify/Metaobject/")) {
    return metaobjectHandles[value] || value.split('/').pop();
  }

  return value;
}
// app/utils/taxonomyMap.js

// 🗂️ ROCKHOUND STUDIO — MASTER TAXONOMY GID DICTIONARY
// The definitive map for the Lapidary Auto-Injector.

export const TAXONOMY_GIDS = {
  "mineral-class": {
    "Silicates": "gid://shopify/Metaobject/151951278331",
    "Oxides": "gid://shopify/Metaobject/155431371003",
    "Carbonates": "gid://shopify/Metaobject/156128313595"
  },
  "rock-formation": {
    "Metamorphic": "gid://shopify/Metaobject/151951343867",
    "Igneous": "gid://shopify/Metaobject/154251985147",
    "Sedimentary": "gid://shopify/Metaobject/154307657979"
  },
  "rock-composition": {
    "Granite": "gid://shopify/Metaobject/151951311099",
    "Obsidian": "gid://shopify/Metaobject/155431338235",
    "Andesite": "gid://shopify/Metaobject/156128411899",
    "Schist": "gid://shopify/Metaobject/156128477435",
    "Jasper": "gid://shopify/Metaobject/166239764731"
  },
  "geological-era": {
    "Precambrian": "gid://shopify/Metaobject/151951245563",
    "Paleozoic": "gid://shopify/Metaobject/156128379131",
    "Mesozoic": "gid://shopify/Metaobject/154252083451",
    "Cenozoic": "gid://shopify/Metaobject/154307854587"
  },
  "crystal-system": {
    "Monoclinic": "gid://shopify/Metaobject/151951212795",
    "Trigonal": "gid://shopify/Metaobject/154252116219",
    "Hexagonal": "gid://shopify/Metaobject/154307625211",
    "Triclinic": "gid://shopify/Metaobject/154308706555"
  },
  "authenticity": {
    "Genuine": "gid://shopify/Metaobject/151951114491",
    "Replica": "gid://shopify/Metaobject/156128346363"
  },
  "rarity": {
    "Common": "gid://shopify/Metaobject/151951147259",
    "Rare": "gid://shopify/Metaobject/154252050683"
  },
  "condition": {
    "Mint (M)": "gid://shopify/Metaobject/154252017915",
    "Excellent (EX)": "gid://shopify/Metaobject/151951180027"
  }
};

// ─── THE WELDING RULES ──────────────────────────────────────────────
// Helper function to safely wrap GIDs for Shopify Metaobject Injection
export function wrapGid(gidString) {
  if (!gidString) return null;
  return `["${gidString}"]`;
}
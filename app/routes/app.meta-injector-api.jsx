import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractStoneName(title) {
  if (!title) return "Unknown";
  
  let sectionOne = title.split(/[—–-]/)[0].trim();
  
  const adjectives = [
    "Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White", "Grey", "Gray", "Brown",
    "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume", "Moss", "Dendritic", "Banded", "Polychrome",
    "Imperial", "Royal", "Dark", "Light", "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled",
    "Polished", "Natural", "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"
  ];

  let words = sectionOne.split(/\s+/);
  words = words.filter(word => !adjectives.some(adj => adj.toLowerCase() === word.toLowerCase()));

  if (words.length > 0) {
    let baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }

  return "Unknown";
}

function normalizeMetafieldValue(key, value) {
  let val = String(value);

  if (val.startsWith("⚠️ ")) {
    val = val.replace(/^⚠️\s*/, "");
  }

  const booleanKeys = [
    "is_ooak", "found_object", 
    "custom_product", "setting_ready", "bail_included", "treated"
  ];
  if (booleanKeys.includes(key)) {
    if (val.toLowerCase() === "true") val = "Yes";
    else if (val.toLowerCase() === "false") val = "No";
  }

  return val;
}

function applyOriginOverridesBeforeApi(title, metafieldsArray) {
  let newMetafields = [...(metafieldsArray || [])];

  newMetafields = newMetafields.filter(m => m.key !== "origin_handle" && m.key !== "origin_page_handle");

  if (title && typeof title === "string") {
    const segments = title.split(/\s*—\s*/);
    if (segments.length >= 3) {
      const middleSegment = segments[1].trim();
      let overrideHandle = null;

      if (middleSegment === "Richardson's Rock Ranch") {
        overrideHandle = "the-richardson-strike";
      } else if (middleSegment === "Yakima River Canyon" || middleSegment === "Yakima Canyon") {
        overrideHandle = "the-shop-lore-chert-road-detour-yakima-river-jasper";
      } else if (middleSegment === "Yellowstone River" || middleSegment === "Seven Sisters") {
        overrideHandle = "the-yellowstone-river";
      } else if (middleSegment === "Rufus" || middleSegment === "Rufus Serpentine") {
        overrideHandle = "the-rufus-protocol";
      } else if (middleSegment === "Nickel Back") {
        overrideHandle = "the-nickel-back-collection";
      } else if (middleSegment === "North Fork CdA") {
        overrideHandle = "north-fork-cda-collection";
      } else if (middleSegment === "Spokane River" || middleSegment === "Stateline") {
        overrideHandle = "spokane-river-stateline";
      } else if (middleSegment === "Irv's Rock and Jewelry" || middleSegment === "Irv's") {
        overrideHandle = "the-shopped-rock";
      }

      if (overrideHandle) {
        const ownerId = metafieldsArray.length > 0 ? metafieldsArray[0].ownerId : null;
        if (ownerId) {
          newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_handle", type: "single_line_text_field", value: overrideHandle });
          newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_page_handle", type: "single_line_text_field", value: overrideHandle });
        }
      }
    }
  }

  return newMetafields;
}

function sanitizeDescription(html) {
  if (!html || typeof html !== "string") return html;
  let safeHtml = html;
  
  const targets = [
    "/pages/the-shopped-rock",
    "/collections/the-shopped-rock",
    "/pages/the-shocked-rock",
    "/collections/the-shocked-rock"
  ];
  
  for (const target of targets) {
    const regexNormal = new RegExp(`<a[^>]*href=["']?[^"'>]*${target.replace(/\//g, '\\/')}["']?[^>]*>.*?<\\/a>`, 'gi');
    safeHtml = safeHtml.replace(regexNormal, "");
    
    const regexEscaped = new RegExp(`&lt;a[^&]*href=[&quot;']?[^&quot;'>]*${target.replace(/\//g, '\\/')}[&quot;']?[^&]*&gt;.*?&lt;\\/a&gt;`, 'gi');
    safeHtml = safeHtml.replace(regexEscaped, "");
  }
  
  return safeHtml;
}

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field",
  origin_location: "single_line_text_field",
  geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field",
  official_name: "single_line_text_field",
  luster: "single_line_text_field",
  specific_gravity: "single_line_text_field",
  fracture_pattern: "single_line_text_field",
  cleavage: "single_line_text_field",
  tenacity: "single_line_text_field",
  primary_color: "single_line_text_field",
  diaphaneity: "single_line_text_field",
  character_marks: "single_line_text_field",
  dimensions_mm: "single_line_text_field",
  cut_type: "single_line_text_field",
  bench_notes: "multi_line_text_field",
  stone_shape: "single_line_text_field",
  surface_finish: "single_line_text_field",
  treatment_status: "single_line_text_field",
  secondary_colors: "single_line_text_field",
  base_stone_type: "single_line_text_field",
  hardness: "single_line_text_field",
  primary_medium: "single_line_text_field",
  piece_name: "single_line_text_field",
  stone_family: "single_line_text_field",
  collection_name: "single_line_text_field",
  collection_location: "single_line_text_field",
  origin_handle: "single_line_text_field",
  origin_page_handle: "single_line_text_field",
  cut_and_shape: "single_line_text_field",
  primary_use: "single_line_text_field",
  handcrafted_by: "single_line_text_field",
  alt_text: "single_line_text_field",
  is_ooak: "single_line_text_field",
  found_object: "single_line_text_field",
  custom_product: "single_line_text_field",
  color: "single_line_text_field",
  setting_ready: "single_line_text_field",
  bail_included: "single_line_text_field",
  wire_material: "single_line_text_field",
  chain_material: "single_line_text_field",
  seo_title: "single_line_text_field",
  secondary_medium: "single_line_text_field",
  treated: "single_line_text_field",
  weight_grams: "number_decimal",
  shipping_weight_oz: "number_decimal",
  price: "number_decimal",
  origin_story: "multi_line_text_field",
  honest_flaws: "single_line_text_field",
  honest_flaws_and_character: "multi_line_text_field",
  generated_description: "multi_line_text_field",
  artist_notes: "multi_line_text_field",
  color_pattern: "list.metaobject_reference",
  "color-pattern": "list.metaobject_reference",
  material: "metaobject_reference",
  jewelry_material: "metaobject_reference",
  "jewelry-material": "metaobject_reference",
  age_group: "metaobject_reference",
  "age-group": "metaobject_reference",
  jewelry_type: "metaobject_reference",
  "jewelry-type": "metaobject_reference",
  target_gender: "metaobject_reference",
  "target-gender": "metaobject_reference",
  necklace_design: "metaobject_reference",
  "necklace-design": "metaobject_reference",
  authenticity: "metaobject_reference",
  rarity: "metaobject_reference",
  condition: "metaobject_reference",
  crystal_system: "metaobject_reference",
  "crystal-system": "metaobject_reference",
  mineral_class: "metaobject_reference",
  "mineral-class": "metaobject_reference",
  geological_era: "metaobject_reference",
  "geological-era": "metaobject_reference",
  rock_composition: "metaobject_reference",
  "rock-composition": "metaobject_reference",
  rock_formation: "metaobject_reference",
  "rock-formation": "metaobject_reference",
  chain_link_type: "metaobject_reference",
  "chain-link-type": "metaobject_reference",
  jewelry_finding_type: "metaobject_reference",
  "jewelry-finding-type": "metaobject_reference",
};

const EXPLICIT_METAOBJECT_KEYS = [
  "material", "color-pattern", "color_pattern", "jewelry-material", "jewelry_material",
  "target-gender", "age-group", "age_group", "condition", "rarity", 
  "authenticity", "jewelry-type", "jewelry_type", "necklace-design", "necklace_design", 
  "crystal-system", "geological-era", "geological_era", 
  "mineral-class", "mineral_class", "rock-composition", "rock_composition", 
  "rock-formation", "rock_formation", "chain-link-type", "chain_link_type",
  "jewelry-finding-type", "jewelry_finding_type"
];

// ==========================================
// 🟢 UPGRADED DYSLEXIA FORMATTING SAFEGUARD
// Catches all punctuation smashing (periods, commas, etc.)
// ==========================================
function formatDyslexiaText(text) {
  if (!text) return "";
  let cleaned = text;
  
  // Force space after period, exclamation, or question mark if missing
  cleaned = cleaned.replace(/([a-z0-9])([.?!])([A-Z])/g, "$1$2 $3");
  
  // Force space after comma if missing
  cleaned = cleaned.replace(/([a-z0-9]),([A-Za-z])/gi, "$1, $2");
  
  // Force visual spacing between HTML paragraphs
  cleaned = cleaned.replace(/<\/p>\s*<p>/g, "</p>\n\n<p>");
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "<br>\n");
  
  return cleaned.trim();
}

function extractShapeFromString(str) {
  if (!str) return "";
  const SHAPES = ["Round", "Oval", "Freeform", "Teardrop", "Pear", "Cushion", "Marquise", "Rectangle", "Square", "Heart", "Slab", "Rough", "Cabochon"];
  for (const shape of SHAPES) {
    if (new RegExp(`\\b${shape}\\b`, "i").test(str)) return shape;
  }
  return "";
}

function enforceOriginOverrides(loc) {
  if (!loc) return loc;
  const lower = loc.toLowerCase();
  if (lower.includes("yakima") || lower.includes("chert")) return "Yakima Canyon";
  if (lower.includes("spokane")) return "Spokane River";
  if (lower.includes("richardson")) return "Richardson's Rock Ranch";
  return loc;
}

function buildMasterVisionPrompt({
  pagesMenu,
  collectionsMenu,
  stoneFamily,
  derivedShape,
  originStory,
  originSegment,
  targetUrlPath,
  fullCollectionTitle,
  collectionUrlPath
}) {
  let dwellButtonsHTML = "";
  
  if (targetUrlPath && targetUrlPath !== "/pages/") {
    dwellButtonsHTML += `<br><br><a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n`;
  } else {
    dwellButtonsHTML += `<br><br>`;
  }
  
  if (collectionUrlPath && collectionUrlPath !== "/collections/") {
    dwellButtonsHTML += `${dwellButtonsHTML.endsWith('\n') ? '' : '<br>'}<a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>`;
  }
  
  if (originSegment.toLowerCase().includes("richardson") || (targetUrlPath && targetUrlPath.includes("the-richardson-strike"))) {
    dwellButtonsHTML = `<br><br><a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>
<br><a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>
<br><a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>
<br><a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>`;
  }

  return `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo and return a JSON object.
- LIVE STORE DIRECTORY:
  VALID PAGES IN STORE:
  ${pagesMenu || "No live pages found — use default URL."}
  
  VALID COLLECTIONS IN STORE:
  ${collectionsMenu || "No live collections found — use default URL."}

- primary_color
- stone_shape: Select EXACTLY one: Round, Oval, Freeform, Teardrop, Pear, Cushion, Marquise, Rectangle, Square, Heart, Slab, Rough, N/A. (CRITICAL SHAPE LOCK: The title explicitly states "${derivedShape || 'None'}". If not 'None', you MUST output this exact shape and ignore any visual confusion).
- jewelry_type: Select EXACTLY one: Pendant, Necklace, Artisan jewelry, Fine jewelry, Accessories, N/A. (Pendant = stone set in bezel/bail that hangs. Necklace = chain/strand is primary design. If stone on cord/chain, it is a Pendant).
- rarity: Select EXACTLY one: Common, Uncommon, Rare, One-of-a-Kind
- authenticity: Select EXACTLY one: Authentic, Lab-Created, Unknown
- color_pattern: Select EXACTLY one: Green, Black, Blue flash, Red, White, Multicolor, Gold, Pink, Yellow, Silver, Purple, Striped, Clear, Yellow veins, None
- google_product_category: "Apparel & Accessories > Jewelry > Charms & Pendants", "Arts & Entertainment > Hobbies & Creative Arts > Collectibles > Rocks & Fossils", "Arts & Entertainment > Hobbies & Creative Arts > Arts & Crafts > Crafting Materials", "Apparel & Accessories > Jewelry"
- cut_and_shape
- surface_finish
- honest_flaws_and_character
- origin_location: Cross-reference "${originSegment}" with LIVE STORE DIRECTORY. Return geographic name ONLY. No prefixes like "Collection" or "The". (e.g., "Yakima Canyon" or "Richardson's Rock Ranch").
- primary_use: "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)", "Loose Stone".
- primary_medium: Must match stone mineral name from title.
- setting_ready: "Bezel Setting - Ready to Wear", "Prong Setting - Ready to Wear", "Wire Wrapped - Ready to Wear", "None".
- wire_material
- bail_included: "Silver Plated Pinch Bail", "Integrated Bezel Bail", "None".
- jewelry_finding_type: MUST BE "None" if bail_included is not "None".
- alt_text: Descriptive, max 125 chars. Use exact stone name.
- found_object: Yes/No
- chain_material: "Silver Plated Snake Chain", "Gold Plated Snake Chain", "Sterling Silver Chain", "Cord", "None".
- seo_title: Max 60 chars. Stone family, origin, OOAK Lapidary Art.
- generated_description: Write in Bob's voice (plain, honest, past tense for the find). No salesy language. Short sentences. 7-BLOCK FORMAT (No markdown headers):
  1. Stone Description: Honest flaws, finish, flash.
  2. Origin Hook: 1-2 sentences from ORIGIN STORY.
  3. Collection Hook: 1-2 sentences about ${fullCollectionTitle}.
  4. Signature: — Bob & Janyce, Rockhound Studio, Spokane Valley WA
  5. Stone Data: Specs, cut. (DO NOT GUESS DIMENSIONS HERE).
  6. Ready to Wear: State if set or loose.
  7. Dwell Buttons:
${dwellButtonsHTML}

FULL ORIGIN STORY (CRITICAL LORE FIREWALL - READ CAREFULLY):
${originStory}
WARNING: The story above is a master document covering multiple distinct stones. Scan the text and extract ONLY the 1-2 sentence narrative that explicitly matches "${stoneFamily}". Completely ignore the rest of the text to prevent cross-contamination.

MANDATORY LAWS:
- HARDWARE PHYSICS LAW: bail_included and jewelry_finding_type are STRICTLY MUTUALLY EXCLUSIVE.
- LOOSE STONE OVERRIDE: If bare loose stone with no metal, you MUST return strictly "None" for setting_ready, wire_material, secondary_medium, chain_material, and bail_included.
- PRIMARY/SECONDARY MEDIUM RULE: primary_medium is the stone. secondary_medium is the hardware/setting.`;
}

const stoneProfileCache = new Map();

// 🟢 REPAIR: Persistent Database Connection Pool
let dbPool = null;

async function queryPostgres(sql, params) {
  if (!dbPool) {
    const { default: pg } = await import('pg');
    dbPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 15
    });
  }
  try {
    const result = await dbPool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error("[Postgres Pool Error]:", err);
    throw err;
  }
}

async function saveToStoneCache(stoneName, geoResult) {
  try {
    const existing = await queryPostgres(
      'SELECT id FROM "StoneCache" WHERE "stone_name" = $1 LIMIT 1',
      [stoneName]
    );
    if (existing.length === 0) {
      await queryPostgres(
        'INSERT INTO "StoneCache" ("id", "stone_name", "data", "created_at", "updated_at") VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())',
        [stoneName, JSON.stringify(geoResult)]
      );
      console.log("[StoneCache] Saved new entry for:", stoneName);
    }
  } catch (err) {
    console.error("[StoneCache] Save failed for:", stoneName, err);
  }
}

const MINDAT_API_KEY = process.env.MINDAT_API_KEY;

async function fetchWithRetry(url, options, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (res.status !== 503 && res.status !== 429 && res.status !== 500) {
        return res;
      }
      console.warn(`[Gemini Engine] API returned status ${res.status}. Retry ${i + 1} of ${retries} in ${delay}ms...`);
    } catch (err) {
      clearTimeout(id);
      console.error(`[Gemini Engine] Fetch error on retry ${i + 1} of ${retries}:`, err);
    }
    
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error("Gemini API connection timed out after multiple attempts.");
}

async function getLiveStoreDirectory(admin) {
  let pagesList = [];
  let collectionsList = [];
  try {
    const res = await admin.graphql(`
      query {
        pages(first: 100) {
          edges {
            node {
              title
              handle
              body
            }
          }
        }
        collections(first: 100) {
          edges {
            node {
              title
              handle
              description
            }
          }
        }
      }
    `);
    const data = await res.json();
    if (data.data?.pages?.edges) {
      pagesList = data.data.pages.edges.map(e => ({
        title: e.node.title,
        url: `/pages/${e.node.handle}`,
        excerpt: (e.node.body || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 10000)
      }));
    }
    if (data.data?.collections?.edges) {
      collectionsList = data.data.collections.edges.map(e => ({
        title: e.node.title,
        url: `/collections/${e.node.handle}`,
        excerpt: (e.node.description || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 5000)
      }));
    }
  } catch (err) {
    console.error("[Live Directory Scanner] Failed to fetch store inventory:", err);
  }
  return { pagesList, collectionsList };
}

function resolveOriginHandle(locationSegment, pagesList) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (!cleanLoc) return "";
  if (cleanLoc.includes("richardson")) return "the-richardson-strike";
  if (cleanLoc.includes("irv")) return ""; // Shopped Rock burned
  if (cleanLoc.includes("spokane")) return ""; // No origin page for Spokane
  if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return "the-north-fork-strike";
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return "the-shop-lore-chert-road-detour-yakima-river-jasper";

  const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
  return match ? match.url.replace("/pages/", "") : cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = []) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();

  if (cleanLoc.includes("yakima") || cleanLoc.includes("chert")) return { slug: "chert-road-detour", name: "Chert Road Detour — Yakima River Jasper Collection" };
  if (cleanLoc.includes("richardson")) return { slug: "richardsons-rock-ranch", name: "Richardson's Rock Ranch Collection" };
  if (cleanLoc.includes("spokane")) return { slug: "the-spokane-river-collection", name: "Spokane River Stones and Stories" };
  if (cleanLoc.includes("irv")) return { slug: "", name: "" }; // Shopped Rock burned
  if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return { slug: "north-fork-cda-collection", name: "North Fork CdA Collection" };

  const matchedCol = collectionsList.find(c => c.url.includes(defaultOriginSlug) || c.title.toLowerCase().includes(cleanLoc));
  if (matchedCol) {
    return { slug: matchedCol.url.replace("/collections/", ""), name: matchedCol.title.endsWith("Collection") ? matchedCol.title : `${matchedCol.title} Collection` };
  }

  return { slug: defaultOriginSlug, name: `${locationSegment.trim()} Collection` };
}

async function getGeoData(admin, stoneFamily) {
  const emptyGeo = {
    mohs_hardness: "", luster: "", fracture_pattern: "", cleavage: "",
    specific_gravity: "", diaphaneity: "", crystal_system: "",
    geological_era: "", mineral_class: "", rock_composition: "",
    rock_formation: "", geological_age: "", geoSource: "none"
  };
  
  if (!stoneFamily || !admin) return emptyGeo;

  const cleanStoneName = extractStoneName(stoneFamily);
  const search = cleanStoneName.toLowerCase().trim();

  try {
    const { lookupStone } = await import("../utils/geoLibrary.jsx");
    const localResult = lookupStone(cleanStoneName);
    if (localResult && Object.keys(localResult).length > 0) {
      return {
        mohs_hardness: localResult.moh_hardness || localResult.hardness || localResult.mohs_hardness || "",
         luster: localResult.luster || "",
        fracture_pattern: localResult.fracture_pattern || localResult.fracture || "",
        cleavage: localResult.cleavage || "",
        specific_gravity: localResult.specific_gravity || "",
        diaphaneity: localResult.diaphaneity || "",
        crystal_system: localResult.crystal_system || "",
        geological_era: localResult.geological_era || localResult.geological_age || "",
        mineral_class: localResult.mineral_class || "",
        rock_composition: localResult.rock_composition || "",
        rock_formation: localResult.rock_formation || "",
        geological_age: localResult.geological_era || localResult.geological_age || "",
        geoSource: "library"
      };
    }
  } catch (err) {
    console.error("[Geo Tier 1] geoLibrary lookup failed:", err);
  }

  try {
    const cacheRows = await queryPostgres('SELECT data FROM "StoneCache" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
    if (cacheRows.length > 0 && cacheRows[0].data) {
      const parsed = typeof cacheRows[0].data === "string" ? JSON.parse(cacheRows[0].data) : cacheRows[0].data;
      return { ...parsed, geoSource: "cache" };
    }
  } catch (err) {
    console.error("[Geo Tier 2A] PostgreSQL StoneCache lookup failed:", err.message);
  }

  try {
    if (stoneProfileCache.has(search)) {
      const cached = stoneProfileCache.get(search);
      if (cached) return { ...cached, geoSource: "cache" };
    } else {
      const rows = await queryPostgres('SELECT * FROM "StoneProfile" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
      if (rows.length > 0) {
        const s = rows[0];
        const geoResult = {
          mohs_hardness: s.hardness || s.mohs_hardness || "",
          luster: s.luster || "",
          fracture_pattern: s.fracture || "",
          cleavage: s.cleavage || "",
          specific_gravity: s.specific_gravity || "",
          diaphaneity: s.diaphaneity || "",
          crystal_system: s.crystal_system || "",
          geological_era: s.geological_era || "",
          mineral_class: s.mineral_class || "",
          rock_composition: s.rock_composition || "",
          rock_formation: s.rock_formation || "",
          geological_age: s.geological_era || "",
          geoSource: "database"
        };
        stoneProfileCache.set(search, geoResult);
        return geoResult;
      } else {
        stoneProfileCache.set(search, null);
      }
    }
  } catch (err) {
    console.error("[Geo Tier 2B] PostgreSQL StoneProfile failed:", err);
  }

  try {
    if (MINDAT_API_KEY) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000);
      const mindatRes = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(cleanStoneName)}&format=json`, { 
        headers: { Authorization: `Token ${MINDAT_API_KEY}` },
        signal: controller.signal
      });
      clearTimeout(id);
      
      const mindatData = await mindatRes.json();
      const mineral = mindatData?.results?.[0];
      if (mineral) {
        const hardness = mineral.hardness || "";
        const specific_gravity = mineral.density || "";
        const geoResult = {
          mohs_hardness: hardness, 
          luster: mineral.luster || "", 
          fracture_pattern: mineral.fracture || "", 
          cleavage: mineral.cleavage || "", 
          specific_gravity, 
          diaphaneity: mineral.transparency || "", 
          crystal_system: mineral.crystal_system || "", 
          geological_era: "", 
          mineral_class: mineral.mineral_class || "", 
          rock_composition: "", 
          rock_formation: "",
          geological_age: "",
          geoSource: "mindat"
        };
        stoneProfileCache.set(search, geoResult);
        await saveToStoneCache(search, geoResult);
        return geoResult;
      }
    }
  } catch (err) {
    console.error("[Geo Tier 3] Mindat failed:", err);
  }

  return emptyGeo;
}

function sanitizeObject(obj) {
  if (!obj) return obj;
  for (let key in obj) {
    if (typeof obj[key] === "string") {
      if (obj[key].includes("See Shopify")) {
        obj[key] = "";
      } else {
        obj[key] = obj[key].replace(/Ã¢â‚¬"/g, "—").replace(/â€”/g, "—");
      }
    }
  }
  return obj;
}

function cleanStoneFamilyShape(familyStr) {
  if (!familyStr) return familyStr;
  return familyStr.replace(/(?:\s+(?:Round|Oval|Freeform|Teardrop|Pear|Heart|Square|Rectangle|Slab|Raw|Cabochon))+$/i, "").trim();
}

function mapCollectionLocation(rawLocation) {
  const loc = (rawLocation || "").toLowerCase();
  if (loc.includes("spokane river")) return "Spokane River";
  if (loc.includes("yakima") || loc.includes("chert")) return "Yakima Canyon";
  if (loc.includes("yellowstone")) return "Yellowstone River";
  if (loc.includes("richardson")) return "Richardson's Rock Ranch";
  if (loc.includes("3,000") || loc.includes("3000")) return "The 3,000-Mile Run";
  if (loc.includes("nickel back")) return "Nickel Back";
  if (loc.includes("rufus")) return "Rufus Serpentine";
  if (loc.includes("gallery")) return "The Gallery";
  if (loc.includes("north fork") || loc.includes("cda")) return "North Fork CdA";
  return rawLocation.replace(/\s*Collection$/i, "").trim();
}

function getDerivedMaterial(stoneFam) {
  if (!stoneFam) return "";
  return stoneFam.replace(/^(Dragon's Eye|Green|Blue|Fire|Rufus|Rainbow|Yellow|Red|Black|Oregon)\s+/i, "").trim();
}

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      try { 
        const geoFields = await getGeoData(admin, stoneFamily); 
        return Response.json({ success: true, intent: "geoLookup", geoFields: sanitizeObject(geoFields) }); 
      } catch (err) { 
        console.error("[geoLookup] getGeoData crashed:", err); 
        return Response.json({ success: false, intent: "geoLookup", geoFields: {} }); 
      }
    }

    if (intent === "tab2AutoFill") {
      const stone_family = body.get("stone_family") || "";
      const rawProductTitle = body.get("productTitle") || body.get("piece_name") || body.get("title") || "";
      const productTitle = rawProductTitle.replace(/Ã¢â‚¬â€/g, "—").replace(/â€”/g, "—");
      const imageUrl = body.get("imageUrl") || "";

      const bench_weight_grams = body.get("weight_grams") || "";
      const bench_shipping_weight_oz = body.get("shipping_weight_oz") || "";
      const bench_dimensions_mm = body.get("dimensions_mm") || "";
      const bench_price = body.get("price") || "";

      const titleSegments = productTitle.split(/\s+[-—–]\s+/);
      const rawFamilySegment = titleSegments[0]?.trim() || stone_family;
      const derivedShape = extractShapeFromString(rawFamilySegment);
      let derivedFamily = cleanStoneFamilyShape(rawFamilySegment);
      const derivedOrigin = enforceOriginOverrides(titleSegments[1]?.trim() || "");
      const pieceNameSegment = titleSegments.length >= 3 ? titleSegments[2].trim() : "";

      try {
        const geoFields = await getGeoData(admin, derivedFamily);
        const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
        
        const initialOriginHandle = resolveOriginHandle(derivedOrigin, pagesList);
        const initialCollectionData = resolveCollectionData(derivedOrigin, initialOriginHandle, collectionsList);
        const targetUrlPath = initialOriginHandle ? `/pages/${initialOriginHandle}` : "";
        const collectionUrlPath = initialCollectionData.slug ? `/collections/${initialCollectionData.slug}` : "";
        const fullCollectionTitle = initialCollectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const matchedPage = pagesList.find(p => p.url.includes(initialOriginHandle));
        const origin_story = matchedPage ? matchedPage.excerpt : "";

        const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url} | Excerpt: "${p.excerpt}"`).join("\n");
        const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url} | Excerpt: "${c.excerpt}"`).join("\n");

        let visionFields = {};
        
        if (imageUrl) {
          try {
            const targetUrl = imageUrl.includes("?") ? `${imageUrl}&width=800` : `${imageUrl}?width=800`;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 60000);
            const imageRes = await fetch(targetUrl, { signal: controller.signal });
            clearTimeout(id);

            if (!imageRes.ok) throw new Error(`Shopify image fetch failed with status: ${imageRes.status}`);

            const imageBuffer = await imageRes.arrayBuffer();
            const imageBase64 = Buffer.from(imageBuffer).toString("base64");
            const imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();

            const visionPrompt = buildMasterVisionPrompt({
              pagesMenu,
              collectionsMenu,
              stoneFamily: derivedFamily,
              derivedShape,
              originStory: origin_story,
              originSegment: derivedOrigin,
              targetUrlPath,
              fullCollectionTitle,
              collectionUrlPath
            });

            const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: visionPrompt }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }],
                generationConfig: { 
                  responseMimeType: "application/json", 
                  temperature: 0.1,
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      generated_description: { type: "STRING" },
                      seo_title: { type: "STRING" },
                      origin_location: { type: "STRING" },
                      primary_color: { type: "STRING" },
                      cut_and_shape: { type: "STRING" },
                      surface_finish: { type: "STRING" },
                      stone_shape: { type: "STRING" },
                      color_pattern: { type: "STRING" },
                      pattern: { type: "STRING" },
                      primary_use: { type: "STRING" },
                      primary_medium: { type: "STRING" },
                      secondary_medium: { type: "STRING" },
                      wire_material: { type: "STRING" },
                      setting_ready: { type: "STRING" },
                      bail_included: { type: "STRING" },
                      chain_material: { type: "STRING" },
                      jewelry_type: { type: "STRING" },
                      necklace_design: { type: "STRING" },
                      jewelry_finding_type: { type: "STRING" },
                      rarity: { type: "STRING" },
                      authenticity: { type: "STRING" },
                      google_product_category: { type: "STRING" },
                      alt_text: { type: "STRING" }
                    }
                  }
                }
              })
            });

            if (geminiRes.ok) {
              const geminiData = await geminiRes.json();
              if (!geminiData || !geminiData.candidates || geminiData.candidates.length === 0) {
                 throw new Error("Gemini API returned empty response structure.");
              }
              let cleanJson = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
              const first = cleanJson.indexOf("{");
              const last = cleanJson.lastIndexOf("}");
              if (first !== -1 && last !== -1) cleanJson = cleanJson.slice(first, last + 1);
              
              try {
                visionFields = JSON.parse(cleanJson);
              } catch (parseErr) {
                console.error("[tab2AutoFill] JSON Parse Error:", parseErr, "Raw:", cleanJson);
                visionFields = { generated_description: `[JSON PARSE ERROR] ${parseErr.message}` };
              }
              
              if (visionFields.primary_color) {
                 visionFields.color = visionFields.primary_color;
              }
              
              if (visionFields.generated_description) {
                 let desc = formatDyslexiaText(visionFields.generated_description);
                 const lowerDesc = desc.toLowerCase();
                 if (desc.startsWith("[VISION API CRASH]") || desc.startsWith("[API CRASH]") || desc.startsWith("[JSON PARSE ERROR]") || lowerDesc.includes("timed out")) {
                     visionFields.generated_description = "";
                 } else {
                     visionFields.generated_description = desc;
                 }
              }
            } else {
               const errText = await geminiRes.text();
               throw new Error(`Gemini API error: ${geminiRes.status} - ${errText}`);
            }
          } catch (visionErr) {
            console.error("[tab2AutoFill] Vision scan failed:", visionErr);
            visionFields = { generated_description: `[API CRASH] ${visionErr.message}` };
          }
        }

        if (derivedShape) {
            visionFields.stone_shape = derivedShape;
            if (visionFields.cut_and_shape && !visionFields.cut_and_shape.toLowerCase().includes(derivedShape.toLowerCase())) {
                visionFields.cut_and_shape = `${derivedShape} Cabochon`;
            } else if (!visionFields.cut_and_shape) {
                visionFields.cut_and_shape = `${derivedShape} Cabochon`;
            }
        }

        const correctedOrigin = enforceOriginOverrides(visionFields.origin_location || derivedOrigin);
        const finalOriginHandle = resolveOriginHandle(correctedOrigin, pagesList);
        const finalCollectionData = resolveCollectionData(correctedOrigin, finalOriginHandle, collectionsList);
        
        const finalOriginPageHandle = finalOriginHandle === "the-richardson-strike" ? "the-richardson-strike" : finalOriginHandle;

        const manual_seo_title = correctedOrigin
          ? `Handcrafted ${derivedFamily} — ${correctedOrigin} — OOAK Lapidary Art`
          : `Handcrafted ${derivedFamily} — OOAK Lapidary Art`;

        const finalMaterial = getDerivedMaterial(derivedFamily);

        const finalFamilyTitle = stone_family ? cleanStoneFamilyShape(stone_family) : derivedFamily;

        const parsedVision = visionFields || {};
        const jewelry_type = parsedVision.jewelry_type || "N/A";
        
        let activeBail = String(parsedVision.bail_included || "None").trim();
        if (activeBail.toLowerCase() === "none" || activeBail === "") activeBail = "None";
        
        let finalFindingType = String(parsedVision.jewelry_finding_type || "None").trim();
        if (activeBail !== "None") {
            finalFindingType = "None";
        }

        const payload = sanitizeObject({
          origin_story: origin_story,
          stone_family: finalFamilyTitle,
          piece_name: pieceNameSegment,
          origin_handle: finalOriginHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_location: correctedOrigin,
          shopify_title: `${finalFamilyTitle} — ${correctedOrigin} — ${pieceNameSegment}`,
          collection_name: finalCollectionData.name,
          collection_location: mapCollectionLocation(finalCollectionData.name),
          seo_title: visionFields.seo_title || manual_seo_title,
          authenticity: visionFields.authenticity || "Authentic",
          rarity: visionFields.rarity || "Common",
          secondary_medium: visionFields.secondary_medium || "None",
          cut_and_shape: visionFields.cut_and_shape || "",
          jewelry_type: jewelry_type,
          necklace_design: jewelry_type === "Pendant" ? "Pendant" : (visionFields.necklace_design || ""),
          jewelry_finding_type: finalFindingType,
          color_pattern: visionFields.color_pattern || visionFields.pattern || "",
          material: finalMaterial,
          generated_description: visionFields.generated_description || "",
          color: visionFields.color || "",
          surface_finish: visionFields.surface_finish || "",
          stone_shape: visionFields.stone_shape || parsedVision.stone_shape || "",
          primary_use: visionFields.primary_use || "",
          primary_medium: derivedFamily,
          wire_material: visionFields.wire_material || "None",
          setting_ready: visionFields.setting_ready || "None",
          bail_included: activeBail,
          chain_material: visionFields.chain_material || "None",
          mohs_hardness: geoFields.mohs_hardness || "",
          luster: geoFields.luster || "",
          fracture_pattern: geoFields.fracture_pattern || "",
          cleavage: geoFields.cleavage || "",
          specific_gravity: geoFields.specific_gravity || "",
          diaphaneity: geoFields.diaphaneity || "",
          crystal_system: geoFields.crystal_system || "",
          geological_era: geoFields.geological_era || "",
          mineral_class: geoFields.mineral_class || "",
          rock_composition: geoFields.rock_composition || "",
          rock_formation: geoFields.rock_formation || "",
          geological_age: geoFields.geological_age || "",
          treated: "No",
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: visionFields.google_product_category || "Apparel & Accessories > Jewelry",
          alt_text: visionFields.alt_text || "",
          ...(bench_weight_grams ? { weight_grams: bench_weight_grams } : {}),
          ...(bench_shipping_weight_oz ? { shipping_weight_oz: bench_shipping_weight_oz } : {}),
          ...(bench_dimensions_mm ? { dimensions_mm: bench_dimensions_mm } : {}),
          ...(bench_price ? { price: bench_price } : {})
        });

        return Response.json({ success: true, intent: "tab2AutoFill", tab2Data: payload });
      } catch (err) {
        console.error("[tab2AutoFill] crashed:", err);
        return Response.json({ success: false, intent: "tab2AutoFill", tab2Data: {} });
      }
    }

    if (intent === "titleParse") {
      const pieceNameInput = (body.get("pieceName") || "").replace(/Ã¢â‚¬â€/g, "—").replace(/â€”/g, "—");
      const segments = pieceNameInput.split(/\s+[—–-]\s+/);
      const segment1 = cleanStoneFamilyShape(segments[0]?.trim() || "");
      const segment2 = enforceOriginOverrides(segments[1]?.trim() || "");
      const segment3 = segments.length >= 3 ? segments[2].trim() : "";

      let stonePicklist = "Agate, Amazonite, Amethyst, Andesite, Aventurine, Azurite, Brecciated Jasper, Brecciated Quartz, Calcite, Carnelian, Chalcedony, Chrysocolla, Citrine, Dalmatian Stone, Fluorite, Garnet, Hematite, Howlite, Jasper, Kyanite, Labradorite, Lapis Lazuli, Lepidolite, Malachite, Moonstone, Obsidian, Ocean Jasper, Onyx, Opal, Petrified Wood, Picture Jasper, Prehnite, Pyrite, Quartz, Quartzite, Rhodonite, Rhyolite, Rose Quartz, Serpentine, Smoky Quartz, Sodalite, Sunstone, Tourmaline, Turquoise, Unakite, Variscite";
      
      try {
        const stoneRows = await queryPostgres('SELECT "stone_name" FROM "StoneProfile" ORDER BY "stone_name"', []);
        if (stoneRows && stoneRows.length > 0) {
          stonePicklist = stoneRows.map(r => r.stone_name).join(", ");
        }
      } catch (err) {
        console.error("[titleParse] StoneProfile picklist fetch failed, using fallback:", err);
      }

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(segment2, resolvedHandle, collectionsList);

      const matchedPage = pagesList.find(p => p.url.includes(resolvedHandle));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";
      
      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url}`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url}`).join("\n");

      const promptText = `You are an expert lapidary assistant for Rockhound Studio. Analyze these segments:
- Family: "${segment1}"
- Origin: "${segment2}"
- Title: "${segment3}"

LIVE STORE DIRECTORY:
VALID PAGES IN STORE:
${pagesMenu || "No live pages found."}

VALID COLLECTIONS IN STORE:
${collectionsMenu || "No live collections found."}

INSTRUCTIONS:
1. The Origin segment ("${segment2}") is the AUTHORITY. Set 'origin_location' to the clean geographic name derived from "${segment2}" — strip prefixes like "Collection". Match 'collection_name' and 'collection_location' to the live store entry that corresponds to "${segment2}".
2. Set origin_handle strictly to: "${resolvedHandle}". 
3. stone_family must be exactly one of: ${stonePicklist} - match only the mineral/stone type word from the title. Ignore all color, pattern, cut, and modifier words. Pick the closest entry from the list.

Return valid JSON with these exact keys: stone_family, piece_name, origin_handle, origin_location, collection_name, collection_location, seo_title. Generate a keyword-rich seo_title for Google using the family and keywords like "Handcrafted" or "OOAK Lapidary Art". No markup. No extra keys.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { 
            responseMimeType: "application/json", 
            temperature: 0.1,
            responseSchema: {
              type: "OBJECT",
              properties: {
                stone_family: { type: "STRING" },
                piece_name: { type: "STRING" },
                origin_handle: { type: "STRING" },
                origin_location: { type: "STRING" },
                collection_name: { type: "STRING" },
                collection_location: { type: "STRING" },
                seo_title: { type: "STRING" }
              },
              required: ["stone_family", "piece_name", "origin_handle", "origin_location", "collection_name", "collection_location"]
            }
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        if (!data || !data.candidates || data.candidates.length === 0) {
          throw new Error("Gemini API returned empty response structure during titleParse.");
        }
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.slice(first, last + 1);
        }
        const parsed = JSON.parse(cleanJson);
        
        if (parsed.stone_family) {
          parsed.stone_family = cleanStoneFamilyShape(parsed.stone_family);
        }

        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);
        const matchedOriginPage = pagesList.find(p => p.url.includes(resolvedHandle));
        const displayName = matchedOriginPage ? matchedOriginPage.title.replace(/^(Shop Lore|Collection)[\s:\-]+/i, "").replace(/^The\s+/i, "").trim() : collectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const seoTitleParts = [];
        if (parsed.stone_family || segment1) seoTitleParts.push(parsed.stone_family || segment1);
        
        const correctedOriginLoc = enforceOriginOverrides(parsed.origin_location || segment2);

        let seo_title = "";
        if (seoTitleParts.length > 0) {
          seo_title = correctedOriginLoc
            ? `${seoTitleParts.join(" ")} — Found at ${correctedOriginLoc} — Rockhound Studio`
            : `${seoTitleParts.join(" ")} — Rockhound Studio`;
        }

        const finalOriginPageHandle = resolvedHandle === "the-richardson-strike" ? "the-richardson-strike" : resolvedHandle;

        const finalParse = sanitizeObject({
          ...parsed,
          piece_name: segment3,
          origin_handle: resolvedHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_story: extractedStory,
          origin_location: correctedOriginLoc,
          collection_name: parsed.collection_name || collectionData.name,
          collection_location: mapCollectionLocation(parsed.collection_location || collectionData.name),
          canonical_title: parsed.stone_family + " — " + (correctedOriginLoc || displayName) + " — " + segment3,
          seo_title: parsed.seo_title || seo_title,
          mohs_hardness: dbGeoData.mohs_hardness || "",
          luster: dbGeoData.luster || "",
          fracture_pattern: dbGeoData.fracture_pattern || "",
          cleavage: dbGeoData.cleavage || "",
          specific_gravity: dbGeoData.specific_gravity || "",
          diaphaneity: dbGeoData.diaphaneity || "",
          crystal_system: dbGeoData.crystal_system || "",
          geological_era: dbGeoData.geological_era || "",
          mineral_class: dbGeoData.mineral_class || "",
          rock_composition: dbGeoData.rock_composition || "",
          rock_formation: dbGeoData.rock_formation || "",
          geological_age: dbGeoData.geological_age || "",
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry"
        });
        
        return Response.json({ success: true, intent: "titleParse", titleParse: finalParse });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent: "titleParse", titleParse: null, error: `Title parse error: ${geminiRes.status} - ${errText}` }, { status: 500 });
    }

    if (intent === "visionScan" || intent === "fullRescan") {
      const pieceId = body.get("pieceId");
      const clientBase64 = body.get("imageBase64");
      const clientMime = body.get("imageMimeType") || "image/jpeg";
      
      const bench_weight_grams = body.get("weight_grams") || "";
      const bench_shipping_weight_oz = body.get("shipping_weight_oz") || "";
      const bench_dimensions_mm = body.get("dimensions_mm") || "";
      const bench_price = body.get("price") || "";
      const bench_origin_story = body.get("origin_story") || "";
      const bench_honest_flaws = body.get("honest_flaws_and_character") || "";

      const rawTitleInput = body.get("productTitle") || body.get("pieceName") || body.get("piece_name") || "";
      const titleInput = rawTitleInput.replace(/â€”/g, "—").replace(/Ã¢â‚¬â€/g, "—");
      const segments = titleInput.split(/\s+[—–-]\s+/);
      const rawFamilySegment = segments[0]?.trim() || "Unknown Stone";
      const derivedShape = extractShapeFromString(rawFamilySegment);
      let derivedFamily = cleanStoneFamilyShape(rawFamilySegment);
      const originSegment = enforceOriginOverrides(segments[1]?.trim() || "Unknown Origin");
      const pieceNameSegment = segments.length >= 3 ? segments[2].trim() : "";
      
      const geoFields = await getGeoData(admin, derivedFamily);
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      const targetUrlPath = defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "";
      const collectionUrlPath = defaultCollection.slug ? `/collections/${defaultCollection.slug}` : "";
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      
      let extractedStory = matchedPage && matchedPage.excerpt ? matchedPage.excerpt : "";
      if (!extractedStory) {
        extractedStory = bench_origin_story;
      }
      
      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url} | Excerpt: "${p.excerpt}"`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url} | Excerpt: "${c.excerpt}"`).join("\n");

      let imageBase64 = clientBase64 && clientBase64 !== "undefined" ? String(clientBase64).trim() : "";
      let imageMimeType = clientMime;
      
      if (imageBase64.includes(",")) {
        imageBase64 = imageBase64.substring(imageBase64.indexOf(",") + 1);
      }

      if (!imageBase64) {
        const rawImageUrl = body.get("imageUrl");
        if (rawImageUrl) {
          const targetUrl = rawImageUrl.includes("?") ? `${rawImageUrl}&width=800` : `${rawImageUrl}?width=800`;
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 60000);
          const imageRes = await fetch(targetUrl, { signal: controller.signal });
          clearTimeout(id);
          
          if (!imageRes.ok) throw new Error(`Shopify image fetch failed with status: ${imageRes.status}`);

          const imageBuffer = await imageRes.arrayBuffer();
          imageBase64 = Buffer.from(imageBuffer).toString("base64");
          imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        }
      }

      const promptText = buildMasterVisionPrompt({
        pagesMenu,
        collectionsMenu,
        stoneFamily: derivedFamily,
        derivedShape,
        originStory: extractedStory,
        originSegment,
        targetUrlPath,
        fullCollectionTitle,
        collectionUrlPath
      });

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }],
          generationConfig: { 
            responseMimeType: "application/json", 
            temperature: 0.2,
            responseSchema: {
              type: "OBJECT",
              properties: {
                generated_description: { type: "STRING" },
                seo_title: { type: "STRING" },
                origin_location: { type: "STRING" },
                primary_color: { type: "STRING" },
                cut_and_shape: { type: "STRING" },
                surface_finish: { type: "STRING" },
                stone_shape: { type: "STRING" },
                color_pattern: { type: "STRING" },
                pattern: { type: "STRING" },
                primary_use: { type: "STRING" },
                primary_medium: { type: "STRING" },
                secondary_medium: { type: "STRING" },
                wire_material: { type: "STRING" },
                setting_ready: { type: "STRING" },
                bail_included: { type: "STRING" },
                chain_material: { type: "STRING" },
                jewelry_type: { type: "STRING" },
                necklace_design: { type: "STRING" },
                jewelry_finding_type: { type: "STRING" },
                rarity: { type: "STRING" },
                authenticity: { type: "STRING" },
                google_product_category: { type: "STRING" },
                alt_text: { type: "STRING" }
              }
            }
          }
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        if (!geminiData || !geminiData.candidates || geminiData.candidates.length === 0) {
          throw new Error("Gemini API returned empty response structure during visionScan.");
        }
        let cleanJson = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.slice(first, last + 1);
        }
        
        let parsedVision;
        try {
          parsedVision = JSON.parse(cleanJson);
        } catch (parseErr) {
          console.error(`[${intent}] JSON Parse Error:`, parseErr, "Raw string:", cleanJson);
          return Response.json({ success: false, intent, error: `JSON Parse Error: ${parseErr.message}` });
        }
        
        const resolved_primary_use = parsedVision.primary_use || parsedVision.use || parsedVision.product_type || "";
        const resolved_secondary_medium = parsedVision.secondary_medium || "None";
        const resolved_wire_material = parsedVision.wire_material || "None";
        const resolved_setting_ready = parsedVision.setting_ready || "None";

        let activeBail = String(parsedVision.bail_included || "None").trim();
        if (activeBail.toLowerCase() === "none" || activeBail === "") activeBail = "None";
        
        let finalFindingType = String(parsedVision.jewelry_finding_type || "None").trim();
        if (activeBail !== "None") {
            finalFindingType = "None";
        }

        let final_desc = parsedVision.generated_description || "";
        final_desc = formatDyslexiaText(final_desc);
        const lowerDesc = final_desc.toLowerCase();
        
        if (final_desc.startsWith("[VISION API CRASH]") || final_desc.startsWith("[API CRASH]") || final_desc.startsWith("[JSON PARSE ERROR]") || lowerDesc.includes("timed out")) {
            final_desc = "";
        }

        if (derivedShape) {
            parsedVision.stone_shape = derivedShape;
            if (parsedVision.cut_and_shape && !parsedVision.cut_and_shape.toLowerCase().includes(derivedShape.toLowerCase())) {
                parsedVision.cut_and_shape = `${derivedShape} Cabochon`;
            } else if (!parsedVision.cut_and_shape) {
                parsedVision.cut_and_shape = `${derivedShape} Cabochon`;
            }
        }

        const finalOriginLocation = enforceOriginOverrides(parsedVision.origin_location || originSegment);
        const finalOriginHandle = resolveOriginHandle(finalOriginLocation, pagesList);
        const finalCollectionData = resolveCollectionData(finalOriginLocation, finalOriginHandle, collectionsList);

        const finalOriginPageHandle = finalOriginHandle === "the-richardson-strike" ? "the-richardson-strike" : finalOriginHandle;

        const visionFields = parsedVision || {};
        const jewelry_type = parsedVision.jewelry_type || "N/A";

        const finalMaterial = getDerivedMaterial(derivedFamily);

        const finalFamilyTitle = bench_honest_flaws ? cleanStoneFamilyShape(body.get("stone_family") || derivedFamily) : cleanStoneFamilyShape(derivedFamily);

        const payload = sanitizeObject({
          pieceId,
          generated_description: final_desc,
          debug_origin: `seg=${originSegment}|slug=${finalOriginHandle}|matched=${matchedPage ? matchedPage.url : "NULL"}|storyLen=${extractedStory.length}`,
          seo_title: parsedVision.seo_title || "",
          primary_color: parsedVision.primary_color || "",
          cut_and_shape: parsedVision.cut_and_shape || "",
          surface_finish: parsedVision.surface_finish || "",
          stone_shape: visionFields.stone_shape || parsedVision.stone_shape || "",
          jewelry_type: jewelry_type,
          necklace_design: jewelry_type === "Pendant" ? "Pendant" : (parsedVision.necklace_design || ""),
          jewelry_finding_type: finalFindingType,
          rarity: parsedVision.rarity || "Common",
          authenticity: parsedVision.authenticity || "Authentic",
          color_pattern: parsedVision.color_pattern || parsedVision.pattern || "",
          material: finalMaterial,
          primary_use: resolved_primary_use,
          primary_medium: derivedFamily,
          secondary_medium: resolved_secondary_medium,
          wire_material: resolved_wire_material,
          setting_ready: resolved_setting_ready,
          bail_included: activeBail,
          origin_story: extractedStory,
          stone_family: finalFamilyTitle,
          piece_name: pieceNameSegment,
          origin_handle: finalOriginHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_location: finalOriginLocation,
          collection_name: finalCollectionData.name,
          collection_location: mapCollectionLocation(finalCollectionData.name),
          mohs_hardness: geoFields.mohs_hardness || "",
          luster: geoFields.luster || "",
          fracture_pattern: geoFields.fracture_pattern || "",
          cleavage: geoFields.cleavage || "",
          specific_gravity: geoFields.specific_gravity || "",
          diaphaneity: geoFields.diaphaneity || "",
          crystal_system: geoFields.crystal_system || "",
          geological_era: geoFields.geological_era || "",
          mineral_class: geoFields.mineral_class || "",
          rock_composition: geoFields.rock_composition || "",
          rock_formation: geoFields.rock_formation || "",
          geological_age: geoFields.geological_age || "",
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: parsedVision.google_product_category || "Apparel & Accessories > Jewelry",
          alt_text: visionFields.alt_text || "",
          honest_flaws_and_character: bench_honest_flaws || parsedVision.honest_flaws_and_character || "",
          ...(bench_weight_grams ? { weight_grams: bench_weight_grams } : {}),
          ...(bench_shipping_weight_oz ? { shipping_weight_oz: bench_shipping_weight_oz } : {}),
          ...(bench_dimensions_mm ? { dimensions_mm: bench_dimensions_mm } : {}),
          ...(bench_price ? { price: bench_price } : {})
        });

        return Response.json({
          success: true,
          intent,
          tab2Data: payload
        });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent, error: `Vision API Failure (${geminiRes.status}): ${errText}` });
    }

    if (intent === "loadProductData") {
      try {
        const pieceId = body.get("pieceId");
        const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

        const productQuery = await admin.graphql(`
          query getProduct($id: ID!) {
            product(id: $id) {
              id
              title
              variants(first: 1) { edges { node { price } } }
              metafields(first: 250) {
                edges { node { namespace key value } }
              }
            }
          }
        `, { variables: { id: productGid } });

        const productData = await productQuery.json();
        const product = productData?.data?.product;

        if (!product) return Response.json({ intent: "loadProductData", success: false, message: "Product not found" });

        const currentMetafields = {};
        const rawMeta = {};
        if (product.metafields?.edges) {
          product.metafields.edges.forEach(({node}) => {
              currentMetafields[`${node.namespace}.${node.key}`] = node.value;
              rawMeta[node.key] = node.value;
          });
        }

        const canonicalFields = {};
        const repairPlan = {};
        const legacyFields = {};

        const CANONICAL_KEYS = [
          "global.title_tag", "global.description_tag", "custom.seo_title",
          "custom.is_ooak", "custom.is_one_of_a_kind", "custom.handcrafted_by", 
          "custom.piece_name", "custom.origin_story", "custom.origin_location", 
          "custom.origin_page_handle", "custom.origin_handle", "custom.honest_flaws_and_character", 
          "custom.collection_name", "custom.collection_location", "custom.collection_date",
          "custom.mohs_hardness", "custom.rock_composition", "custom.rock-composition",
          "custom.rock_formation", "custom.rock-formation", "custom.geological_era",
          "custom.geological-era", "custom.geological_age", "custom.crystal_system",
          "custom.crystal-system", "custom.specific_gravity", "custom.cleavage",
          "custom.diaphaneity", "custom.fracture_pattern", "custom.mineral_class",
          "custom.mineral-class", "custom.stone_family", "custom.stone_shape",
          "custom.surface_finish", "custom.cut_and_shape", "custom.dimensions_mm",
          "custom.weight_grams", "custom.shipping_weight_oz", "custom.treatment_status",
          "custom.treated", "custom.color", "custom.color_pattern", "custom.primary_color", 
          "custom.primary_medium", "custom.secondary_medium", "custom.material", 
          "custom.primary_use", "custom.setting_ready", "custom.wire_material", 
          "custom.bail_included", "custom.chain_link_type", "custom.necklace_design", 
          "custom.necklace-design", "custom.jewelry_type", "custom.jewelry_finding_type", 
          "custom.custom_product", "custom.found_object", "custom.rescued_by", 
          "custom.authenticity", "custom.rarity", "custom.luster", "custom.character_marks", 
          "custom.artist_notes", "custom.generated_description", "custom.price", 
          "custom.alt_text",
          "google.age_group", "google.condition", "google.target_gender",
          "shopify.age-group", "shopify.condition", "shopify.target-gender",
          "shopify.authenticity", "shopify.chain-link-type", "shopify.color-pattern",
          "shopify.construction", "shopify.crystal-system", "shopify.geological-era",
          "shopify.jewelry-finding-type", "shopify.jewelry-material",
          "shopify.jewelry-type", "shopify.material", "shopify.material-origin",
          "shopify.mineral-class", "shopify.necklace-design",
          "shopify.product-classification", "shopify.product-use", "shopify.rarity",
          "shopify.rock-composition", "shopify.rock-formation",
          "custom.google_product_category", "custom.target_gender",
          "mc-facebook.google_product_category", "mm-google-shopping.age_group",
          "mm-google-shopping.condition", "mm-google-shopping.custom_product",
          "mm-google-shopping.google_product_category",
          "app--3890849--eligibility.eligibility_details",
          "custom.bench_notes", "custom.badge", "custom.widget",
          "custom.review_widget_data", "judgeme.badge", "judgeme.widget",
          "judgeme.review_widget_data"
        ];

        CANONICAL_KEYS.forEach(k => {
           let val = currentMetafields[k] ?? "";
           canonicalFields[k] = val;
           repairPlan[k] = val; 
        });

        canonicalFields["shopify_title"] = product.title;
        repairPlan["shopify_title"] = product.title;
        canonicalFields["price"] = product.variants?.edges?.[0]?.node?.price || "0.00";
        repairPlan["price"] = canonicalFields["price"];

        const LEGACY_MAP_LOCAL = {
          "custom.crystal-system": "custom.crystal_system",
          "custom.mineral-class": "custom.mineral_class",
          "custom.rock-composition": "custom.rock_composition",
          "custom.geological-era": "custom.geological_era",
          "custom.rock-formation": "custom.rock_formation",
          "custom.necklace-design": "custom.necklace_design",
          "custom.is_one_of_a_kind": "custom.is_ooak"
        };

        Object.entries(LEGACY_MAP_LOCAL).forEach(([leg, can]) => {
           if (currentMetafields[leg] !== undefined) {
              legacyFields[leg] = {
                 value: String(currentMetafields[leg]),
                 canonicalTarget: can,
                 canonicalCurrent: canonicalFields[can]
              };
           }
        });

        return Response.json({
           intent: "loadProductData",
           success: true,
           productId: product.id,
           productTitle: product.title,
           currentMetafields,
           canonicalFields,
           legacyFields,
           repairPlan
        });
      } catch (err) {
         return Response.json({ intent: "loadProductData", success: false, error: err.message });
      }
    }

    if (intent === "executeRepairPlan") {
      try {
        const pieceId = body.get("pieceId");
        const rawPlan = body.get("repairPlan");
        const rawLegacy = body.get("legacyKeysToRemove");
        
        if (!pieceId || !rawPlan) {
          return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Missing pieceId or repairPlan payload." });
        }

        const repairPlan = JSON.parse(rawPlan);
        const legacyKeysToRemove = rawLegacy ? JSON.parse(rawLegacy) : [];
        const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

        // 1. Read actual current metafields by GID
        const lookupResponse = await admin.graphql(`
          query getMetafields($id: ID!) {
            product(id: $id) {
              metafields(first: 250) { edges { node { namespace key value type id } } }
            }
          }
        `, { variables: { id: productGid } });
        
        const lookupData = await lookupResponse.json();
        const currentMetaList = lookupData?.data?.product?.metafields?.edges || [];
        const currentMetafields = {};
        currentMetaList.forEach(e => {
            currentMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value;
        });

        // Generate complete field-by-field repair plan (Diffing)
        const proposedChanges = {};
        const setToShopify = [];
        const deleteFromShopify = [];
        
        const unknownFields = Object.keys(currentMetafields).filter(k => {
           return !MASTER_TYPE_MAP[k.split('.')[1]] && k.startsWith('custom.') && !k.includes("badge") && !k.includes("widget");
        });

        Object.entries(repairPlan).forEach(([fullKey, val]) => {
          if (fullKey === "shopify_title" || fullKey === "price") return;

          let ns = "custom";
          let key = fullKey;
          if (fullKey.includes(".")) {
              const parts = fullKey.split(".");
              ns = parts[0];
              key = parts.slice(1).join(".");
          }

          const valStr = String(val !== null && val !== undefined ? val : "").trim();
          const currentVal = currentMetafields[fullKey] || null;

          if (valStr === "" || valStr.toLowerCase() === "none" || valStr.toLowerCase() === "n/a" || valStr.toLowerCase() === "null" || valStr.toLowerCase() === "undefined") {
            if (currentVal !== null) {
                deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
                proposedChanges[fullKey] = { from: currentVal, to: "" };
                
                const standardKey = key.replace(/_/g, '-');
                if (ns === "custom" && (EXPLICIT_METAOBJECT_KEYS.includes(standardKey) || EXPLICIT_METAOBJECT_KEYS.includes(key))) {
                   deleteFromShopify.push({ ownerId: productGid, namespace: "shopify", key: standardKey });
                }
                
                if (ns === "custom" && key === "seo_title" && currentMetafields["global.title_tag"]) {
                   deleteFromShopify.push({ ownerId: productGid, namespace: "global", key: "title_tag" });
                }
                if (ns === "custom" && key === "generated_description" && currentMetafields["global.description_tag"]) {
                   deleteFromShopify.push({ ownerId: productGid, namespace: "global", key: "description_tag" });
                }
            }
          } else {
            let resolvedType = MASTER_TYPE_MAP[key] || "single_line_text_field";
            let resolvedValue = normalizeMetafieldValue(key, valStr);

            const multiLineKeys = ["origin_story", "artist_notes", "honest_flaws_and_character", "bench_notes", "generated_description", "description_tag"];
            const decimalKeys = ["weight_grams", "shipping_weight_oz", "price"];
            const listSingleLineKeys = ["character_marks"];

            if (key === "generated_description") {
              resolvedValue = sanitizeDescription(resolvedValue);
            }

            if (multiLineKeys.includes(key)) {
              resolvedType = "multi_line_text_field";
              if (resolvedValue.length > 10000) resolvedValue = resolvedValue.slice(0, 10000);
            } else if (decimalKeys.includes(key)) {
              resolvedType = "number_decimal";
              const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
              resolvedValue = isNaN(parsedNum) ? "0.0" : (parsedNum % 1 === 0 ? parsedNum.toFixed(1) : String(parsedNum));
            } else if (listSingleLineKeys.includes(key)) {
              resolvedType = "list.single_line_text_field";
              if (!resolvedValue.startsWith("[")) resolvedValue = JSON.stringify([resolvedValue]);
            } else if (resolvedType.includes("metaobject_reference")) {
              if (!String(resolvedValue).startsWith("gid://")) resolvedType = "single_line_text_field";
            } else {
              if (resolvedValue.length > 255) resolvedValue = resolvedValue.slice(0, 255);
            }

            if (currentVal !== resolvedValue) {
               setToShopify.push({ ownerId: productGid, namespace: ns, key: key, type: resolvedType, value: resolvedValue });
               proposedChanges[fullKey] = { from: currentVal, to: resolvedValue };

               if (ns === "custom" && key === "seo_title") {
                 setToShopify.push({ ownerId: productGid, namespace: "global", key: "title_tag", type: "single_line_text_field", value: resolvedValue });
                 if (currentMetafields["global.title_tag"] !== resolvedValue) {
                     proposedChanges["global.title_tag"] = { from: currentMetafields["global.title_tag"] || null, to: resolvedValue };
                 }
               }
               if (ns === "custom" && key === "generated_description") {
                 const descTagVal = resolvedValue.slice(0, 320);
                 setToShopify.push({ ownerId: productGid, namespace: "global", key: "description_tag", type: "single_line_text_field", value: descTagVal });
                 if (currentMetafields["global.description_tag"] !== descTagVal) {
                     proposedChanges["global.description_tag"] = { from: currentMetafields["global.description_tag"] || null, to: descTagVal };
                 }
               }
            }
          }
        });

        legacyKeysToRemove.forEach(fullKey => {
          let ns = "custom";
          let key = fullKey;
          if (fullKey.includes(".")) {
              const parts = fullKey.split(".");
              ns = parts[0];
              key = parts.slice(1).join(".");
          }
          if (currentMetafields[fullKey] !== undefined) {
             deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
             proposedChanges[fullKey] = { from: currentMetafields[fullKey], to: null };
          }
        });

        // Calculate missing fields based on empty repairPlan properties that should exist
        const missingFields = Object.keys(repairPlan).filter(k => {
           const v = repairPlan[k];
           return v === null || v === undefined || String(v).trim() === "";
        });

        // NO CHANGES CONDITION
        if (setToShopify.length === 0 && deleteFromShopify.length === 0) {
            return Response.json({
                intent: "executeRepairPlan",
                pieceId,
                success: true,
                status: "NO_CHANGES_REQUIRED",
                fieldsUpdated: 0,
                legacyKeysRemoved: 0,
                message: "No changes required.",
                currentMetafields,
                repairPlan,
                proposedChanges,
                conflicts: {},
                missingFields,
                unknownFields,
                readBackVerified: true
            });
        }

        const allErrors = [];

        // Executes Deletes
        if (deleteFromShopify.length > 0) {
          const uniqueDel = new Map();
          deleteFromShopify.forEach(m => uniqueDel.set(`${m.namespace}:${m.key}`, m));
          const finalDel = Array.from(uniqueDel.values());

          const chunks = chunkArray(finalDel, 250);
          for (let i = 0; i < chunks.length; i++) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                  metafieldsDelete(metafields: $metafields) { userErrors { message field } }
                }`,
                { variables: { metafields: chunks[i] } }
              );
              const deleteJson = await deleteResponse.json();
              if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) {
                allErrors.push(...deleteJson.data.metafieldsDelete.userErrors);
              }
            } catch (delErr) {
              allErrors.push({ message: `API Error on Delete: ${delErr.message}` });
            }
          }
        }

        // Execute Sets
        if (setToShopify.length > 0) {
          const uniqueSet = new Map();
          setToShopify.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
          const finalSet = Array.from(uniqueSet.values());

          const chunks = chunkArray(finalSet, 25);
          for (let i = 0; i < chunks.length; i++) {
            try {
              const setResponse = await admin.graphql(
                `#graphql
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) { userErrors { field message } }
                }`,
                { variables: { metafields: chunks[i] } }
              );
              const setJson = await setResponse.json();
              if (setJson?.data?.metafieldsSet?.userErrors?.length) {
                allErrors.push(...setJson.data.metafieldsSet.userErrors);
              }
            } catch (setErr) {
              allErrors.push({ message: `API Error on Set: ${setErr.message}` });
            }
          }
        }

        // FAILURE CONDITION (Shopify returned errors)
        if (allErrors.length > 0) {
           return Response.json({ 
               intent: "executeRepairPlan", 
               pieceId,
               success: false, 
               status: "REPAIR_FAILED",
               errors: allErrors,
               currentMetafields,
               repairPlan,
               proposedChanges,
               fieldsUpdated: 0,
               legacyKeysRemoved: 0,
               conflicts: {},
               missingFields,
               unknownFields,
               readBackVerified: false,
               message: "Shopify write produced errors."
           });
        }

        // Fresh Read-Back Verification
        await new Promise(r => setTimeout(r, 600)); // allow shopify to flush
        
        const readBackResponse = await admin.graphql(`
          query getMetafields($id: ID!) {
            product(id: $id) {
              metafields(first: 250) { edges { node { namespace key value } } }
            }
          }
        `, { variables: { id: productGid } });
        
        const readBackData = await readBackResponse.json();
        const newMetaList = readBackData?.data?.product?.metafields?.edges || [];
        const newMetafields = {};
        newMetaList.forEach(e => {
            newMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value;
        });

        let readBackVerified = true;
        const conflicts = {};

        setToShopify.forEach(m => {
           const dotKey = `${m.namespace}.${m.key}`;
           const actual = newMetafields[dotKey];
           let expStr = String(m.value).trim();
           let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();
           
           if (m.type === "number_decimal") {
               if (parseFloat(expStr) !== parseFloat(actStr)) {
                   readBackVerified = false;
                   conflicts[dotKey] = { expected: expStr, actual: actStr };
               }
           } else {
               if (expStr !== actStr) {
                   readBackVerified = false;
                   conflicts[dotKey] = { expected: expStr, actual: actStr };
               }
           }
        });

        deleteFromShopify.forEach(m => {
           const dotKey = `${m.namespace}.${m.key}`;
           if (newMetafields[dotKey] !== undefined) {
               readBackVerified = false;
               conflicts[dotKey] = { expected: null, actual: newMetafields[dotKey] };
           }
        });

        // FAILURE CONDITION (Read-back failed)
        if (!readBackVerified) {
             return Response.json({
               intent: "executeRepairPlan",
               pieceId,
               success: false,
               status: "REPAIR_FAILED",
               fieldsUpdated: setToShopify.length,
               legacyKeysRemoved: deleteFromShopify.length,
               message: "Repair failed: Read-back verification detected conflicts.",
               currentMetafields,
               repairPlan,
               proposedChanges,
               conflicts,
               missingFields,
               unknownFields,
               readBackVerified: false
            });
        }

        // SUCCESS CONDITION
        return Response.json({ 
          intent: "executeRepairPlan", 
          pieceId,
          success: true, 
          status: "REPAIRED",
          fieldsUpdated: setToShopify.length,
          legacyKeysRemoved: deleteFromShopify.length,
          message: `Repair successful: ${setToShopify.length} fields updated, ${deleteFromShopify.length} legacy keys cleared.`,
          currentMetafields,
          repairPlan,
          proposedChanges,
          conflicts: {},
          missingFields,
          unknownFields,
          readBackVerified: true
        });

      } catch (error) {
        return Response.json({ 
            intent: "executeRepairPlan", 
            pieceId: body.get("pieceId"),
            success: false, 
            status: "REPAIR_FAILED",
            error: error.message,
            message: `Execution error: ${error.message}`
        });
      }
    }

    if (intent === "generateDescription") {
      const sharedFields = JSON.parse(body.get("sharedFields") || "{}");
      const pieceData = JSON.parse(body.get("pieceData") || "{}");
      
      let derivedFamily = sharedFields.stone_family || "Unknown Stone";
      derivedFamily = cleanStoneFamilyShape(derivedFamily);
      const originSegment = enforceOriginOverrides(sharedFields.origin_location || "Unknown Origin");
      
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      
      const targetUrlPath = defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "";
      const collectionUrlPath = defaultCollection.slug ? `/collections/${defaultCollection.slug}` : "";
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      let dwellButtonsHTML = "";
      if (targetUrlPath && targetUrlPath !== "/pages/") {
        dwellButtonsHTML += `<br><br><a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n`;
      } else {
        dwellButtonsHTML += `<br><br>`;
      }
      if (collectionUrlPath && collectionUrlPath !== "/collections/") {
        dwellButtonsHTML += `${dwellButtonsHTML.endsWith('\n') ? '' : '<br>'}<a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>`;
      }
      
      if (originSegment.toLowerCase().includes("richardson") || (targetUrlPath && targetUrlPath.includes("the-richardson-strike"))) {
        dwellButtonsHTML = `<br><br><a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>
<br><a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>
<br><a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>
<br><a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>`;
      }

      const promptText = `You are writing a product description for Rockhound Studio, a lapidary art studio run by Bob and Janyce, married 34 years, both artists, both rockhounds. They cut and polish every stone themselves in Spokane Valley WA.

DETAILS:
- Stone Family: ${derivedFamily}
- Origin / Location: ${originSegment}
- Full Origin Story: ${extractedStory}
- Collection Name: ${fullCollectionTitle}
- Cut & Shape: ${pieceData.cut_and_shape || "Freeform"}
- Surface Finish: ${pieceData.surface_finish || "Natural/Polished"}
- Dimensions: ${pieceData.dimensions_mm || "N/A"}
- Mounting/Medium: ${pieceData.primary_medium || "Loose Stone"}
- Setting Ready: ${pieceData.setting_ready || "None"}
- Mohs Hardness: ${pieceData.mohs_hardness || "N/A"}
- Geological Age: ${pieceData.geological_age || "N/A"}
- Rarity: ${pieceData.rarity || "Common"}
- Character: ${pieceData.honest_flaws_and_character || "None"}
- Piece Name: ${pieceData.piece_name || "None"}
- Bench Notes: ${pieceData.bench_notes || "None"}
- Artist Notes: ${pieceData.artist_notes || "None"}
- Chain/Cord Database Status: ${pieceData.chain_link_type || "None"}

VOICE RULES:
- Past tense for the find. "I picked it up." Not "pick it up."
- Plain and honest. Say what happened. Stop.
- No salesy language. No Etsy language. No badges.
- Short sentences. One idea at a time.
- "We" for the partnership. "I" for Bob's personal moment with the stone.
- The stone earns its own sale. Never push it.
- No jewelry store language. This is freeform lapidary art.
- Signature always: — Bob & Janyce, Rockhound Studio, Spokane Valley WA

DESCRIPTION STRUCTURE — follow this order exactly:

1. PHYSICAL DESCRIPTION
Start with the piece_name. What makes this stone different from every other stone of its type. Lead with bench_notes and artist_notes — these are Bob's direct observations from the wheel. Then describe shape, color, flash, finish. Specific and honest.

2. ORIGIN HOOK
1-2 sentences only. Scan the Full Origin Story and ONLY pull the specific part that talks about ${derivedFamily}. Ignore stories about other stones. End with the placeholder: {{ORIGIN_LINK}}

3. COLLECTION HOOK
1-2 sentences connecting the stone to its collection. End with the placeholder: {{COLLECTION_LINKS}}

4. QUICK-REFERENCE SPECS
Stone: [stone_family]
Dimensions: EXACTLY [dimensions_mm]. Do not guess or estimate sizes.
Finish: [surface_finish]
Setting: [primary_medium]
Includes: [bail/chain/cord or "Loose stone, undrilled"]

5. COLLECTOR DATA
Mohs: [mohs_hardness]
Formation: [geological_age]
Rarity: [rarity]
Character: [honest_flaws_and_character]

6. ARTIST CALLOUT — only if loose stone or setting ready
One plain sentence for jewelers and makers. Dimensions, drill status, setting suitability.

7. SIGNATURE
— Bob & Janyce, Rockhound Studio, Spokane Valley WA

HARD RULES:
- LORE FIREWALL: The Full Origin Story provided is from a master document covering multiple sister stones. ONLY pull the narrative matching ${derivedFamily}. Do not mention other stones or unrelated finds.
- CORD/CHAIN CONFLICT LAW: You are strictly forbidden from mentioning a "dark cord", "chain", or necklace UNLESS the 'Chain/Cord Database Status' above explicitly lists it. If it says "None" or is empty, do not mention a cord.
- STRICT HTML ONLY: You MUST wrap every single paragraph in <p></p> tags. Do not use raw \n line breaks. No <h> tags. No <ul> or <li>.
- Do NOT generate any URLs or href links. Links are handled server-side.
- Do NOT use the words: unique, one-of-a-kind, handmade, artisan, special, curated, stunning, beautiful, gorgeous, perfect, love, passion.
- Do NOT hallucinate stone properties not provided in the input fields.
- Keep {{ORIGIN_LINK}} and {{COLLECTION_LINKS}} as literal placeholders. Do not replace them.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
            responseSchema: {
              type: "OBJECT",
              properties: { generated_description: { type: "STRING" } }
            }
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        if (first !== -1 && last !== -1) cleanJson = cleanJson.slice(first, last + 1);
        
        const parsed = JSON.parse(cleanJson);
        const safeParsed = sanitizeObject(parsed);
        
        let desc = formatDyslexiaText(safeParsed.generated_description || "");
        
        // Nuke the explicit Gemini placeholders so they don't render on the storefront
        desc = desc.replace(/\{\{ORIGIN_LINK\}\}/gi, "").replace(/\{\{COLLECTION_LINKS\}\}/gi, "");
        
        const finalDescription = desc.trim() + "\n\n" + dwellButtonsHTML;
        return Response.json({ success: true, intent, generated_description: finalDescription });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent, error: `Generate Description Failure: ${errText}` });
    }

    if (intent === "saveMetafields" || intent === "cleanMalformedKeys" || intent === "cleanAllCamelKeys" || intent === "stagedUpload" || intent === "createProduct" || intent === "cleanGhostNamespaces" || intent === "cleanAllGhostNamespaces" || intent === "toggleStatus" || intent === "batchAuditItem") {
       return await executeAutofill(intent, body, admin);
    }

    return Response.json({ success: true, intent: intent || "unknown", fields: {} });
  } catch (error) {
    console.error("Critical Failure:", error);
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
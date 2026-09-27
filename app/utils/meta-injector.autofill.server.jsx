import { lookupStone } from "./geoLibrary.jsx";

const stoneProfileCache = new Map();

// ==========================================
// 🟢 UPGRADED DYSLEXIA FORMATTING SAFEGUARD
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

function getDwellButtons(originSegment, targetUrlPath, collectionUrlPath, fullCollectionTitle) {
  let dwellButtonsHTML = ``;
  const lowerOrigin = (originSegment || "").toLowerCase();

  if (lowerOrigin.includes("richardson")) {
    dwellButtonsHTML = `<a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story →</a><br>\n<a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection →</a><br>\n<a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story →</a><br>\n<a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection →</a>`;
  } else if (lowerOrigin.includes("north fork") || lowerOrigin.includes("cda")) {
    dwellButtonsHTML = `<a href="/pages/the-north-fork-strike">The North Fork Strike →</a><br>\n<a href="/collections/north-fork-cda-collection">North Fork CdA Collection →</a>`;
  } else if (lowerOrigin.includes("spokane")) {
    dwellButtonsHTML = `<a href="/collections/the-spokane-river-collection">Spokane River Collection →</a>`;
  } else if (!lowerOrigin.includes("irv") && !lowerOrigin.includes("gem show") && !lowerOrigin.includes("shopped rock")) {
    if (targetUrlPath && targetUrlPath !== "/pages/") {
      dwellButtonsHTML += `<a href="${targetUrlPath}">${fullCollectionTitle} Story →</a><br>\n`;
    }
    if (collectionUrlPath && collectionUrlPath !== "/collections/") {
      dwellButtonsHTML += `<a href="${collectionUrlPath}">${fullCollectionTitle} Collection →</a>`;
    }
  }
  return dwellButtonsHTML;
}

// ==========================================
// 🟢 PROMPT 1: TITLE PARSER
// ==========================================
function buildTitleParsePrompt(segment1, segment2, segment3, pagesMenu, collectionsMenu, stonePicklist) {
  return `You are the Hellstone 3.0 Lapidary Data Extractor. Parse these dictated segments:
- Segment 1: "${segment1}"
- Segment 2: "${segment2}"
- Segment 3: "${segment3}"

LIVE STORE DIRECTORY:
PAGES: ${pagesMenu || "None"}
COLLECTIONS: ${collectionsMenu || "None"}

STEP 1: Match 'stone_family' exactly to one of these Render DB names: ${stonePicklist}. Ignore SEO words.
STEP 2: Match 'origin_location' exactly to a live store collection/origin. If vendor/show, use "The Shopped Rock".
STEP 3: Extract the unique 'piece_name'.
STEP 4: Isolate 'seo_modifiers' (e.g., "Freeform Cabochon", "High Polish").
STEP 5: Construct 'shopify_title' using EXACTLY this format with spaced hyphens:
[stone_family] [seo_modifiers] - [origin_location] - [piece_name]

Return JSON:
{
  "stone_family": "",
  "origin_location": "",
  "piece_name": "",
  "seo_modifiers": "",
  "seo_title": "Keyword rich SEO title for Google",
  "shopify_title": "",
  "collection_name": "",
  "collection_location": "",
  "origin_handle": ""
}`;
}

// ==========================================
// 🟢 PROMPT 2: VISUAL PROCESSOR
// ==========================================
function buildMasterVisionPrompt({ pagesMenu, collectionsMenu, stoneFamily, derivedShape, originSegment }) {
  return `You are the Hellstone 3.0 Lead Lapidary Inspector. Analyze this raw shop-floor photo (which includes a measuring tape) and output strict, honest mechanical data. Never use marketing fluff.

STEP 1: BENCH VARIABLES (Physical Reality)
- dimensions_mm: Read the tape. (e.g., "38x38x5mm").
- cut_shape: Geometry (e.g., Round, Oval, Freeform). The title states "${derivedShape || 'None'}". If not 'None', respect it.
- finish_stage: Polish level (e.g., 600-grit, High Polish).
- honest_flaws: Visible vugs, healed fractures. Be brutally honest.
- product_format: Finished Cabochon, Maker Blank, etc.

STEP 2: MAKER VARIABLES (The Grit)
Based on the stone family (${stoneFamily}) and visual structure:
- wheel_feel: How will this cut? Treat risk cautiously.
- blowout_risk: Where are the fracture points?
- tool_barrier: Specific polishing difficulty?

STEP 3: THE HOOK & SYSTEM VARIABLES
- poetic_hook: Meta description. Poetic, spare, story-driven. Under 160 characters.
- Map the standard Shopify fields at the root level based on the image and Origin ("${originSegment}"). 

Return JSON ONLY:
{
  "bench": {
    "dimensions_mm": "",
    "cut_shape": "",
    "finish_stage": "",
    "honest_flaws": "",
    "product_format": ""
  },
  "maker": {
    "wheel_feel": "",
    "blowout_risk": "",
    "tool_barrier": ""
  },
  "narrative": {
    "poetic_hook": ""
  },
  "seo_title": "",
  "origin_location": "",
  "primary_color": "",
  "cut_and_shape": "",
  "surface_finish": "",
  "stone_shape": "",
  "color_pattern": "",
  "pattern": "",
  "primary_use": "Pendant / Cabochon / Loose Stone",
  "jewelry_type": "Pendant / Necklace / N/A",
  "necklace_design": "",
  "jewelry_finding_type": "None",
  "rarity": "One-of-a-Kind",
  "authenticity": "Authentic",
  "primary_medium": "${stoneFamily}",
  "secondary_medium": "None",
  "wire_material": "None",
  "setting_ready": "None",
  "bail_included": "None",
  "chain_material": "None",
  "google_product_category": "Apparel & Accessories > Jewelry",
  "alt_text": ""
}`;
}

// ==========================================
// 🟢 PROMPT 3: DESCRIPTION GENERATOR
// ==========================================
function buildDescriptionPrompt(derivedFamily, extractedStory, collectionStory, pieceData, dwellButtonsHTML) {
  return `You write two product story fields from the supplied source material for Rockhound Studio.

INPUTS:
- Stone Family: ${derivedFamily}
- Full Origin Page Text: ${extractedStory || "None"}
- Full Collection Page Text: ${collectionStory || "None"}
- Maker Notes (Bench/Flaws/Format): ${JSON.stringify(pieceData)}

RULES:
- Grounding: Use only facts stated in the supplied text. Scan the master text and ONLY extract the narrative explicitly matching ${derivedFamily}.
- Zero Hallucination: Do not invent dates, locations, techniques, or results. Do not infer craftsmanship details not provided.
- Tone: Plain, concise. Past tense for the find. "I" or "we" to match the source.
- Strict Boundaries: If the source does not support a detail, leave it out. No salesy language.
- Dwell Buttons: Embed the exact HTML block provided below at the very end of the craftsmanship text.

DWELL BUTTONS TO APPEND:
${dwellButtonsHTML}

OUTPUT FORMAT (JSON only):
{
  "narrative": {
    "origin_story": "Write 2-3 sentences connecting the stone to its Origin and Collection using the source text. Use <p> tags.",
    "craftsmanship": "Write the physical description, specs, honest flaws, and Bob & Janyce's signature. Use <p> tags. Append the exact DWELL BUTTONS HTML block at the very end."
  }
}`;
}

function extractStoneName(title) {
  if (!title) return "Unknown";
  
  const sanitizedTitle = String(title).replace(/—/g, "-");
  const sectionOne = sanitizedTitle.split(/\s+-\s+/)[0].trim();
  
  const adjectives = [
    "Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White", "Grey", "Gray", "Brown",
    "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume", "Moss", "Dendritic", "Banded", "Polychrome",
    "Imperial", "Royal", "Dark", "Light", "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled",
    "Polished", "Natural", "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"
  ];

  let words = sectionOne.split(/\s+/);
  words = words.filter(word => !adjectives.some(adj => adj.toLowerCase() === word.toLowerCase()));

  if (words.length > 0) {
    const baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }

  return sectionOne;
}

async function queryPostgres(sql, params) {
  const { default: pg } = await import('pg');
  const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await db.connect();
  try {
    const result = await db.query(sql, params);
    return result.rows;
  } finally {
    await db.end();
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
        pages(first: 100) { edges { node { title handle body } } }
        collections(first: 100) { edges { node { title handle description } } }
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
  if (cleanLoc.includes("irv") || cleanLoc.includes("shopped") || cleanLoc.includes("gem show")) return "";
  if (cleanLoc.includes("spokane")) return "";
  if (cleanLoc.includes("north fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return "the-north-fork-strike";
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return "the-shop-lore-chert-road-detour-yakima-river-jasper";

  const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
  return match ? match.url.replace("/pages/", "") : cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = []) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();

  if (cleanLoc.includes("yakima") || cleanLoc.includes("chert")) return { slug: "chert-road-detour", name: "Chert Road Detour — Yakima River Jasper Collection" };
  if (cleanLoc.includes("richardson")) return { slug: "richardsons-rock-ranch", name: "Richardson's Rock Ranch Collection" };
  if (cleanLoc.includes("spokane")) return { slug: "the-spokane-river-collection", name: "Spokane River Stones and Stories" };
  if (cleanLoc.includes("irv") || cleanLoc.includes("shopped") || cleanLoc.includes("gem show")) return { slug: "the-shopped-rock", name: "The Shopped Rock Collection" };
  if (cleanLoc.includes("north fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return { slug: "north-fork-cda-collection", name: "North Fork CdA Collection" };

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
  } catch (err) { }

  try {
    const cacheRows = await queryPostgres('SELECT data FROM "StoneCache" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
    if (cacheRows.length > 0 && cacheRows[0].data) {
      const parsed = typeof cacheRows[0].data === "string" ? JSON.parse(cacheRows[0].data) : cacheRows[0].data;
      return { ...parsed, geoSource: "cache" };
    }
  } catch (err) { }

  try {
    if (stoneProfileCache.has(search)) {
      const cached = stoneProfileCache.get(search);
      if (cached) return { ...cached, geoSource: "cache" };
    } else {
      const rows = await queryPostgres('SELECT * FROM "StoneProfile" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
      if (rows.length > 0) {
        const s = rows[0];
        const geoResult = {
          mohs_hardness: s.hardness || s.mohs_hardness || "", luster: s.luster || "", fracture_pattern: s.fracture || "",
          cleavage: s.cleavage || "", specific_gravity: s.specific_gravity || "", diaphaneity: s.diaphaneity || "",
          crystal_system: s.crystal_system || "", geological_era: s.geological_era || "", mineral_class: s.mineral_class || "",
          rock_composition: s.rock_composition || "", rock_formation: s.rock_formation || "", geological_age: s.geological_era || "",
          geoSource: "database"
        };
        stoneProfileCache.set(search, geoResult);
        return geoResult;
      } else {
        stoneProfileCache.set(search, null);
      }
    }
  } catch (err) { }

  return emptyGeo;
}

function sanitizeObject(obj) {
  if (!obj) return obj;
  for (let key in obj) {
    if (typeof obj[key] === "string") {
      if (obj[key].includes("See Shopify")) {
        obj[key] = "";
      } else {
        obj[key] = obj[key].replace(/—/g, "-");
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

// ==========================================
// 🟢 THE CORE AUTOFILL ENGINE EXPORT
// ==========================================
export async function executeAutofill(intent, body, admin) {
  try {
    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      try { 
        const geoFields = await getGeoData(admin, stoneFamily); 
        return { success: true, intent: "geoLookup", geoFields: sanitizeObject(geoFields) }; 
      } catch (err) { 
        console.error("[geoLookup] getGeoData crashed:", err); 
        return { success: false, intent: "geoLookup", geoFields: {} }; 
      }
    }

    if (intent === "titleParse") {
      const pieceNameInput = (body.get("pieceName") || "").replace(/—/g, "-");
      const segments = pieceNameInput.split(/\s+-\s+/);
      const segment1 = cleanStoneFamilyShape(segments[0]?.trim() || "");
      const segment2 = enforceOriginOverrides(segments[1]?.trim() || "");
      const segment3 = segments.length >= 3 ? segments[2].trim() : "";

      let stonePicklist = "Agate, Amazonite, Amethyst, Andesite, Aventurine, Azurite, Brecciated Jasper, Brecciated Quartz, Calcite, Carnelian, Chalcedony, Chrysocolla, Citrine, Dalmatian Stone, Fluorite, Garnet, Hematite, Howlite, Jasper, Kyanite, Labradorite, Lapis Lazuli, Lepidolite, Malachite, Moonstone, Obsidian, Ocean Jasper, Onyx, Opal, Petrified Wood, Picture Jasper, Prehnite, Pyrite, Quartz, Quartzite, Rhodonite, Rhyolite, Rose Quartz, Serpentine, Smoky Quartz, Sodalite, Sunstone, Tourmaline, Turquoise, Unakite, Variscite";
      
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(segment2, resolvedHandle, collectionsList);

      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url}`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url}`).join("\n");

      const promptText = buildTitleParsePrompt(segment1, segment2, segment3, pagesMenu, collectionsMenu, stonePicklist);

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.1 }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        
        if (parsed.stone_family) parsed.stone_family = cleanStoneFamilyShape(parsed.stone_family);

        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);
        const matchedOriginPage = pagesList.find(p => p.url.includes(resolvedHandle));
        const displayName = matchedOriginPage ? matchedOriginPage.title.replace(/^(Shop Lore|Collection)[\s:\-]+/i, "").replace(/^The\s+/i, "").trim() : collectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const correctedOriginLoc = enforceOriginOverrides(parsed.origin_location || segment2);
        const finalOriginPageHandle = resolvedHandle === "the-richardson-strike" ? "the-richardson-strike" : resolvedHandle;

        const finalParse = sanitizeObject({
          ...parsed,
          piece_name: parsed.piece_name || segment3,
          origin_handle: resolvedHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_location: correctedOriginLoc,
          collection_name: parsed.collection_name || collectionData.name,
          collection_location: mapCollectionLocation(parsed.collection_location || collectionData.name),
          canonical_title: parsed.shopify_title || `${parsed.stone_family} - ${correctedOriginLoc || displayName} - ${segment3}`,
          seo_title: parsed.seo_title,
          ...dbGeoData,
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry"
        });
        
        return { success: true, intent: "titleParse", titleParse: finalParse };
      }
      const errText = await geminiRes.text();
      return { success: false, intent: "titleParse", titleParse: null, error: `Title parse error: ${geminiRes.status} - ${errText}` };
    }

    if (intent === "visionScan" || intent === "fullRescan" || intent === "tab2AutoFill") {
      const pieceId = body.get("pieceId");
      const clientBase64 = body.get("imageBase64");
      const clientMime = body.get("imageMimeType") || "image/jpeg";
      
      const bench_weight_grams = body.get("weight_grams") || "";
      const bench_shipping_weight_oz = body.get("shipping_weight_oz") || "";
      const bench_dimensions_mm = body.get("dimensions_mm") || "";
      const bench_price = body.get("price") || "";
      const bench_honest_flaws = body.get("honest_flaws_and_character") || "";

      const rawTitleInput = body.get("productTitle") || body.get("pieceName") || body.get("piece_name") || "";
      const titleInput = rawTitleInput.replace(/—/g, "-");
      const segments = titleInput.split(/\s+-\s+/);
      const rawFamilySegment = segments[0]?.trim() || body.get("stone_family") || "Unknown Stone";
      const derivedShape = extractShapeFromString(rawFamilySegment);
      let derivedFamily = cleanStoneFamilyShape(rawFamilySegment);
      const originSegment = enforceOriginOverrides(segments[1]?.trim() || "Unknown Origin");
      const pieceNameSegment = segments.length >= 3 ? segments[2].trim() : "";
      
      const geoFields = await getGeoData(admin, derivedFamily);
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);

      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url}`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url}`).join("\n");

      let imageBase64 = clientBase64 && clientBase64 !== "undefined" ? String(clientBase64).trim() : "";
      let imageMimeType = clientMime;
      
      if (imageBase64.includes(",")) imageBase64 = imageBase64.substring(imageBase64.indexOf(",") + 1);

      if (!imageBase64) {
        const rawImageUrl = body.get("imageUrl");
        if (rawImageUrl) {
          const targetUrl = rawImageUrl.includes("?") ? `${rawImageUrl}&width=800` : `${rawImageUrl}?width=800`;
          const imageRes = await fetch(targetUrl);
          if (imageRes.ok) {
            const imageBuffer = await imageRes.arrayBuffer();
            imageBase64 = Buffer.from(imageBuffer).toString("base64");
            imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
          }
        }
      }

      const promptText = buildMasterVisionPrompt({
        pagesMenu, collectionsMenu, stoneFamily: derivedFamily, derivedShape, originSegment
      });

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        let cleanJson = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsedVision = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        
        let finalFindingType = String(parsedVision.jewelry_finding_type || "None").trim();
        let activeBail = String(parsedVision.bail_included || "None").trim();
        if (activeBail !== "None" && activeBail !== "") finalFindingType = "None";

        const finalOriginLocation = enforceOriginOverrides(parsedVision.origin_location || originSegment);
        const finalOriginHandle = resolveOriginHandle(finalOriginLocation, pagesList);
        const finalCollectionData = resolveCollectionData(finalOriginLocation, finalOriginHandle, collectionsList);

        // Map 47-pin extraction strictly into flat payload for existing UI
        const payload = sanitizeObject({
          pieceId,
          stone_family: derivedFamily,
          piece_name: pieceNameSegment,
          origin_handle: finalOriginHandle,
          origin_location: finalOriginLocation,
          collection_name: finalCollectionData.name,
          collection_location: mapCollectionLocation(finalCollectionData.name),
          seo_title: parsedVision.seo_title || "",
          primary_color: parsedVision.primary_color || "",
          cut_and_shape: parsedVision.cut_and_shape || `${parsedVision.bench?.cut_shape} Cabochon` || "",
          surface_finish: parsedVision.surface_finish || parsedVision.bench?.finish_stage || "",
          stone_shape: parsedVision.stone_shape || parsedVision.bench?.cut_shape || derivedShape || "",
          jewelry_type: parsedVision.jewelry_type || "N/A",
          necklace_design: parsedVision.jewelry_type === "Pendant" ? "Pendant" : (parsedVision.necklace_design || ""),
          jewelry_finding_type: finalFindingType,
          rarity: parsedVision.rarity || "One-of-a-Kind",
          authenticity: parsedVision.authenticity || "Authentic",
          color_pattern: parsedVision.color_pattern || parsedVision.pattern || "",
          material: getDerivedMaterial(derivedFamily),
          primary_use: parsedVision.primary_use || "",
          primary_medium: derivedFamily,
          secondary_medium: parsedVision.secondary_medium || "None",
          wire_material: parsedVision.wire_material || "None",
          setting_ready: parsedVision.setting_ready || "None",
          bail_included: activeBail,
          chain_material: parsedVision.chain_material || "None",
          ...geoFields,
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: parsedVision.google_product_category || "Apparel & Accessories > Jewelry",
          alt_text: parsedVision.alt_text || "",
          honest_flaws_and_character: bench_honest_flaws || parsedVision.bench?.honest_flaws || "",
          ...(bench_weight_grams ? { weight_grams: bench_weight_grams } : {}),
          ...(bench_shipping_weight_oz ? { shipping_weight_oz: bench_shipping_weight_oz } : {}),
          ...(bench_dimensions_mm ? { dimensions_mm: bench_dimensions_mm } : {}),
          ...(bench_price ? { price: bench_price } : {})
        });

        return { success: true, intent, tab2Data: payload };
      }
      return { success: false, intent, error: "Vision API Failure" };
    }

    if (intent === "generateDescription") {
      const sharedFields = JSON.parse(body.get("sharedFields") || "{}");
      const pieceData = JSON.parse(body.get("pieceData") || "{}");
      
      let derivedFamily = cleanStoneFamilyShape(sharedFields.stone_family || "Unknown Stone");
      const originSegment = enforceOriginOverrides(sharedFields.origin_location || "Unknown Origin");
      
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      
      const targetUrlPath = defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "";
      const collectionUrlPath = defaultCollection.slug ? `/collections/${defaultCollection.slug}` : "";
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      const matchedCollection = collectionsList.find(c => c.url.includes(defaultCollection.slug));
      const collectionStory = matchedCollection ? matchedCollection.excerpt : "";

      const dwellButtonsHTML = getDwellButtons(originSegment, targetUrlPath, collectionUrlPath, fullCollectionTitle);
      const promptText = buildDescriptionPrompt(derivedFamily, extractedStory, collectionStory, pieceData, dwellButtonsHTML);

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2
          }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        
        let finalDescription = formatDyslexiaText(parsed.narrative?.origin_story) + "\n\n" + formatDyslexiaText(parsed.narrative?.craftsmanship);
        return { success: true, intent, generated_description: finalDescription };
      }
      return { success: false, intent, error: "Generate Description Failure" };
    }

    return { success: true, intent: intent || "unknown", fields: {} };
  } catch (error) {
    console.error("Critical Failure in executeAutofill:", error);
    return { success: false, intent: intent || "unknown", error: error.message };
  }
}
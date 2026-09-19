import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary.jsx";

const stoneProfileCache = new Map();

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

function extractStoneName(title) {
  if (!title) return "Unknown";
  
  const sanitizedTitle = String(title).replace(/Ã¢â‚¬â€/g, "—").replace(/â€”/g, "—");
  const sectionOne = sanitizedTitle.split(/[—–-]/)[0].trim();
  
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

// 🟢 NEW HELPER: Replaces the strict-breaking IIFE used for material generation
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

        // 🟢 FIXED: Use helper function instead of IIFE
        const finalMaterial = getDerivedMaterial(derivedFamily);

        // 🟢 TITLE LOCK: Prioritize incoming `stone_family` to prevent legacy bleed
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

        // 🟢 FIXED: Use helper function instead of IIFE
        const finalMaterial = getDerivedMaterial(derivedFamily);

        // 🟢 TITLE LOCK: Prioritize incoming `stone_family` to prevent legacy bleed
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
- STRICT HTML ONLY: You MUST wrap every single paragraph in <p></p> tags. Do not use raw \\n line breaks. No <h> tags. No <ul> or <li>.
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
        
        const finalDescription = desc + "\n\n" + dwellButtonsHTML;
        return Response.json({ success: true, intent, generated_description: finalDescription });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent, error: `Generate Description Failure: ${errText}` });
    }

    return Response.json({ success: true, intent: intent || "unknown", fields: {} });
  } catch (error) {
    console.error("Critical Failure:", error);
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
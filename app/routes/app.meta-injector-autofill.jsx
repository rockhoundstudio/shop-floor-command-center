import { authenticate } from "../shopify.server";

// 🟢 AI Engine — No Prisma Import Here

const stoneProfileCache = new Map();
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
      if (res.status !== 503 && res.status !== 429 && res.status !== 500) return res;
    } catch (err) {
      clearTimeout(id);
    }
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error("Gemini API connection timed out.");
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
    console.error("Failed to fetch store inventory:", err);
  }
  return { pagesList, collectionsList };
}

function extractStoneName(title) {
  if (!title) return "Unknown";
  let sectionOne = title.split(/[—–-]/)[0].trim();
  const adjectives = ["Green", "Blue", "Red", "Yellow", "Orange", "Purple", "Pink", "Black", "White", "Grey", "Gray", "Brown", "Brecciated", "Picture", "Ocean", "Crazy Lace", "Plume", "Moss", "Dendritic", "Banded", "Polychrome", "Imperial", "Royal", "Dark", "Light", "Clear", "Opaque", "Translucent", "Raw", "Rough", "Tumbled", "Polished", "Natural", "Fossil", "Petrified", "Mookaite", "Kambaba", "Bumblebee", "Dalmatian", "Dragon Blood"];
  let words = sectionOne.split(/\s+/);
  words = words.filter(word => !adjectives.some(adj => adj.toLowerCase() === word.toLowerCase()));
  if (words.length > 0) {
    let baseRock = words[words.length - 1];
    return baseRock.charAt(0).toUpperCase() + baseRock.slice(1).toLowerCase();
  }
  return "Unknown";
}

function resolveOriginHandle(locationSegment, pagesList) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (!cleanLoc) return "";
  if (cleanLoc.includes("richardson")) return "the-richardson-strike";
  if (cleanLoc.includes("irv")) return ""; 
  if (cleanLoc.includes("spokane")) return ""; 
  if (cleanLoc.includes("north fork") || cleanLoc.includes("cda")) return "the-north-fork-strike";
  if (cleanLoc.includes("yakima") || cleanLoc.includes("chert")) return "the-shop-lore-chert-road-detour-yakima-river-jasper";
  const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
  return match ? match.url.replace("/pages/", "") : cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = []) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (cleanLoc.includes("yakima") || cleanLoc.includes("chert")) return { slug: "chert-road-detour", name: "Chert Road Detour — Yakima River Jasper Collection" };
  if (cleanLoc.includes("richardson")) return { slug: "richardsons-rock-ranch", name: "Richardson's Rock Ranch Collection" };
  if (cleanLoc.includes("spokane")) return { slug: "the-spokane-river-collection", name: "Spokane River Stones and Stories" };
  if (cleanLoc.includes("irv")) return { slug: "", name: "" }; 
  if (cleanLoc.includes("north fork") || cleanLoc.includes("cda")) return { slug: "north-fork-cda-collection", name: "North Fork CdA Collection" };
  const matchedCol = collectionsList.find(c => c.url.includes(defaultOriginSlug) || c.title.toLowerCase().includes(cleanLoc));
  if (matchedCol) {
    return { slug: matchedCol.url.replace("/collections/", ""), name: matchedCol.title.endsWith("Collection") ? matchedCol.title : `${matchedCol.title} Collection` };
  }
  return { slug: defaultOriginSlug, name: `${locationSegment.trim()} Collection` };
}

async function getGeoData(admin, stoneFamily) {
  const emptyGeo = { mohs_hardness: "", luster: "", fracture_pattern: "", cleavage: "", specific_gravity: "", diaphaneity: "", crystal_system: "", geological_era: "", mineral_class: "", rock_composition: "", rock_formation: "", geological_age: "", geoSource: "none" };
  if (!stoneFamily || !admin) return emptyGeo;
  const cleanStoneName = extractStoneName(stoneFamily);
  const search = cleanStoneName.toLowerCase().trim();

  try {
    const { lookupStone } = await import("../utils/geoLibrary.jsx");
    const localResult = lookupStone(cleanStoneName);
    if (localResult && Object.keys(localResult).length > 0) {
      return {
        mohs_hardness: localResult.moh_hardness || localResult.hardness || "",
        luster: localResult.luster || "", fracture_pattern: localResult.fracture_pattern || localResult.fracture || "",
        cleavage: localResult.cleavage || "", specific_gravity: localResult.specific_gravity || "",
        diaphaneity: localResult.diaphaneity || "", crystal_system: localResult.crystal_system || "",
        geological_era: localResult.geological_era || localResult.geological_age || "",
        mineral_class: localResult.mineral_class || "", rock_composition: localResult.rock_composition || "",
        rock_formation: localResult.rock_formation || "", geological_age: localResult.geological_era || localResult.geological_age || "",
        geoSource: "library"
      };
    }
  } catch (err) {}

  try {
    const cacheRows = await queryPostgres('SELECT data FROM "StoneCache" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
    if (cacheRows.length > 0 && cacheRows[0].data) {
      const parsed = typeof cacheRows[0].data === "string" ? JSON.parse(cacheRows[0].data) : cacheRows[0].data;
      return { ...parsed, geoSource: "cache" };
    }
  } catch (err) {}

  try {
    if (stoneProfileCache.has(search)) {
      const cached = stoneProfileCache.get(search);
      if (cached) return { ...cached, geoSource: "cache" };
    } else {
      const rows = await queryPostgres('SELECT * FROM "StoneProfile" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
      if (rows.length > 0) {
        const s = rows[0];
        const geoResult = {
          mohs_hardness: s.hardness || s.mohs_hardness || "", luster: s.luster || "", fracture_pattern: s.fracture || "", cleavage: s.cleavage || "",
          specific_gravity: s.specific_gravity || "", diaphaneity: s.diaphaneity || "", crystal_system: s.crystal_system || "",
          geological_era: s.geological_era || "", mineral_class: s.mineral_class || "", rock_composition: s.rock_composition || "",
          rock_formation: s.rock_formation || "", geological_age: s.geological_era || "", geoSource: "database"
        };
        stoneProfileCache.set(search, geoResult);
        return geoResult;
      }
    }
  } catch (err) {}

  try {
    if (MINDAT_API_KEY) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000);
      const mindatRes = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(cleanStoneName)}&format=json`, { headers: { Authorization: `Token ${MINDAT_API_KEY}` }, signal: controller.signal });
      clearTimeout(id);
      const mindatData = await mindatRes.json();
      const mineral = mindatData?.results?.[0];
      if (mineral) {
        const geoResult = {
          mohs_hardness: mineral.hardness || "", luster: mineral.luster || "", fracture_pattern: mineral.fracture || "", cleavage: mineral.cleavage || "",
          specific_gravity: mineral.density || "", diaphaneity: mineral.transparency || "", crystal_system: mineral.crystal_system || "",
          geological_era: "", mineral_class: mineral.mineral_class || "", rock_composition: "", rock_formation: "", geological_age: "", geoSource: "mindat"
        };
        stoneProfileCache.set(search, geoResult);
        await saveToStoneCache(search, geoResult);
        return geoResult;
      }
    }
  } catch (err) {}

  return emptyGeo;
}

function sanitizeObject(obj) {
  if (!obj) return obj;
  for (let key in obj) {
    if (typeof obj[key] === "string") {
      if (obj[key].includes("See Shopify")) obj[key] = "";
      else obj[key] = obj[key].replace(/Ã¢â‚¬"/g, "—").replace(/â€”/g, "—");
    }
  }
  return obj;
}

function formatDyslexiaText(text) {
  if (!text) return "";
  let cleaned = text.replace(/([a-z0-9])([.?!])([A-Z])/g, "$1$2 $3").replace(/([a-z0-9]),([A-Za-z])/gi, "$1, $2");
  return cleaned.replace(/<\/p>\s*<p>/g, "</p>\n\n<p>").replace(/<br\s*\/?>/gi, "<br>\n").trim();
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

function cleanStoneFamilyShape(familyStr) {
  if (!familyStr) return familyStr;
  return familyStr.replace(/(?:\s+(?:Round|Oval|Freeform|Teardrop|Pear|Heart|Square|Rectangle|Slab|Raw|Cabochon))+$/i, "").trim();
}

function mapCollectionLocation(rawLocation) {
  const loc = (rawLocation || "").toLowerCase();
  if (loc.includes("spokane river")) return "Spokane River";
  if (loc.includes("yakima") || loc.includes("chert")) return "Yakima Canyon";
  if (loc.includes("richardson")) return "Richardson's Rock Ranch";
  return rawLocation.replace(/\s*Collection$/i, "").trim();
}

function getDerivedMaterial(stoneFam) {
  if (!stoneFam) return "";
  return stoneFam.replace(/^(Dragon's Eye|Green|Blue|Fire|Rufus|Rainbow|Yellow|Red|Black|Oregon)\s+/i, "").trim();
}

function buildMasterVisionPrompt({ pagesMenu, collectionsMenu, stoneFamily, derivedShape, originStory, originSegment, targetUrlPath, fullCollectionTitle, collectionUrlPath }) {
  let dwellButtonsHTML = `<br><br>`;
  if (targetUrlPath && targetUrlPath !== "/pages/") dwellButtonsHTML = `<br><br><a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n`;
  if (collectionUrlPath && collectionUrlPath !== "/collections/") dwellButtonsHTML += `<br><a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>`;
  
  return `You are a lapidary artist for Rockhound Studio. Analyze this photo and return a JSON object.
- LIVE STORE DIRECTORY:
  VALID PAGES IN STORE: ${pagesMenu || "No live pages"}
  VALID COLLECTIONS: ${collectionsMenu || "No live collections"}

- primary_color
- stone_shape: Select EXACTLY one: Round, Oval, Freeform, Teardrop, Pear, Cushion, Marquise, Rectangle, Square, Heart, Slab, Rough, N/A. (Title states: "${derivedShape || 'None'}").
- jewelry_type: Select EXACTLY one: Pendant, Necklace, Artisan jewelry, Fine jewelry, Accessories, N/A.
- rarity: Select EXACTLY one: Common, Uncommon, Rare, One-of-a-Kind
- authenticity: Select EXACTLY one: Authentic, Lab-Created, Unknown
- color_pattern: Select EXACTLY one: Green, Black, Blue flash, Red, White, Multicolor, Gold, Pink, Yellow, Silver, Purple, Striped, Clear, Yellow veins, None
- google_product_category: "Apparel & Accessories > Jewelry"
- cut_and_shape
- surface_finish
- honest_flaws_and_character
- origin_location: Cross-reference "${originSegment}" with LIVE STORE DIRECTORY. Return geographic name ONLY.
- primary_use: "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)", "Loose Stone".
- primary_medium: Must match stone mineral name.
- setting_ready: "Bezel Setting - Ready to Wear", "None".
- wire_material
- bail_included: "Silver Plated Pinch Bail", "Integrated Bezel Bail", "None".
- jewelry_finding_type: MUST BE "None" if bail_included is not "None".
- alt_text: Descriptive, max 125 chars.
- found_object: Yes/No
- chain_material: "Silver Plated Snake Chain", "None".
- seo_title: Max 60 chars. Stone family, origin, OOAK Lapidary Art.
- generated_description: Write in Bob's voice (plain, honest, past tense). No salesy language. Short sentences. 7-BLOCK FORMAT:
  1. Stone Description: Honest flaws, finish, flash.
  2. Origin Hook: 1-2 sentences from ORIGIN STORY.
  3. Collection Hook: 1-2 sentences about ${fullCollectionTitle}.
  4. Signature: — Bob & Janyce, Rockhound Studio, Spokane Valley WA
  5. Stone Data: Specs, cut.
  6. Ready to Wear: State if set or loose.
  7. Dwell Buttons:
${dwellButtonsHTML}

FULL ORIGIN STORY (CRITICAL LORE FIREWALL - READ CAREFULLY):
${originStory}
WARNING: Extract ONLY the 1-2 sentence narrative matching "${stoneFamily}".

ORIGIN PAGE DATE RULE:
If the provided origin-page story contains an explicit collection date, trip date, month, year, or date range, use it only when it is factually present and relevant to the story. Never invent or infer a date. If no explicit date is present, do not mention one.`;
}

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      const geoFields = await getGeoData(admin, stoneFamily); 
      return Response.json({ success: true, intent: "geoLookup", geoFields: sanitizeObject(geoFields) }); 
    }

    if (intent === "titleParse") {
      const pieceNameInput = (body.get("pieceName") || "").replace(/Ã¢â‚¬â€/g, "—").replace(/â€”/g, "—");
      const segments = pieceNameInput.split(/\s+[—–-]\s+/);
      const segment1 = cleanStoneFamilyShape(segments[0]?.trim() || "");
      const segment2 = enforceOriginOverrides(segments[1]?.trim() || "");
      const segment3 = segments.length >= 3 ? segments[2].trim() : "";

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(segment2, resolvedHandle, collectionsList);

      const matchedPage = pagesList.find(p => p.url.includes(resolvedHandle));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      const promptText = `Analyze: Family: "${segment1}", Origin: "${segment2}", Title: "${segment3}". Return JSON: stone_family, piece_name, origin_handle, origin_location, collection_name, collection_location, seo_title.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        
        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);
        const correctedOriginLoc = enforceOriginOverrides(parsed.origin_location || segment2);

        const finalParse = sanitizeObject({
          ...parsed,
          piece_name: segment3,
          origin_handle: resolvedHandle,
          origin_story: extractedStory,
          origin_location: correctedOriginLoc,
          collection_name: parsed.collection_name || collectionData.name,
          collection_location: mapCollectionLocation(parsed.collection_location || collectionData.name),
          canonical_title: parsed.stone_family + " — " + correctedOriginLoc + " — " + segment3,
          seo_title: parsed.seo_title || `${parsed.stone_family} — Found at ${correctedOriginLoc} — Rockhound Studio`,
          ...dbGeoData,
          is_ooak: "Yes",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry"
        });
        return Response.json({ success: true, intent: "titleParse", titleParse: finalParse });
      }
      return Response.json({ success: false, intent: "titleParse", error: `Title parse error: ${geminiRes.status}` }, { status: 500 });
    }

    if (intent === "visionScan" || intent === "fullRescan" || intent === "tab2AutoFill") {
      const pieceId = body.get("pieceId") || body.get("productId") || "NEW";
      const rawTitleInput = body.get("productTitle") || body.get("pieceName") || body.get("piece_name") || "";
      const segments = rawTitleInput.split(/\s+[—–-]\s+/);
      const derivedFamily = cleanStoneFamilyShape(segments[0]?.trim() || body.get("stone_family") || "Unknown Stone");
      const derivedShape = extractShapeFromString(segments[0]?.trim() || "");
      const originSegment = enforceOriginOverrides(segments[1]?.trim() || "Unknown Origin");

      const geoFields = await getGeoData(admin, derivedFamily);
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      
      let extractedStory = matchedPage && matchedPage.excerpt ? matchedPage.excerpt : "";
      if (!extractedStory) {
        extractedStory = body.get("origin_story") || "";
      }
      
      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url} | Excerpt: "${p.excerpt}"`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url} | Excerpt: "${c.excerpt}"`).join("\n");

      let imageBase64 = body.get("imageBase64") || "";
      let imageMimeType = body.get("imageMimeType") || "image/jpeg";
      if (!imageBase64 && body.get("imageUrl")) {
        const imageRes = await fetch(body.get("imageUrl"));
        imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
      }

      const promptText = buildMasterVisionPrompt({
        pagesMenu: pagesList.map(p => `- Title: "${p.title}"`).join("\n"),
        collectionsMenu: collectionsList.map(c => `- Title: "${c.title}"`).join("\n"),
        stoneFamily: derivedFamily, derivedShape, originStory: extractedStory,
        originSegment, targetUrlPath: defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "",
        fullCollectionTitle: defaultCollection.name, collectionUrlPath: defaultCollection.slug ? `/collections/${defaultCollection.slug}` : ""
      });

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsedVision = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        
        parsedVision.generated_description = formatDyslexiaText(parsedVision.generated_description);
        
        const payload = sanitizeObject({
          pieceId,
          ...parsedVision,
          stone_family: derivedFamily,
          origin_location: originSegment,
          origin_handle: defaultOriginSlug,
          collection_name: defaultCollection.name,
          collection_location: mapCollectionLocation(defaultCollection.name),
          material: getDerivedMaterial(derivedFamily),
          ...geoFields,
          is_ooak: "Yes", age_group: "adult", target_gender: "Unisex", condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry"
        });
        return Response.json({ success: true, intent, tab2Data: payload });
      }
      return Response.json({ success: false, intent, error: "Vision API Failure" });
    }

    if (intent === "generateDescription") {
      const sharedFields = JSON.parse(body.get("sharedFields") || "{}");
      const promptText = `Write a description for Rockhound Studio. Focus on: ${sharedFields.stone_family}.`;
      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        return Response.json({ success: true, intent, generated_description: formatDyslexiaText(parsed.generated_description) });
      }
      return Response.json({ success: false, intent, error: "Description failed" });
    }

    return Response.json({ success: false, intent, error: "Unhandled Autofiil Intent" });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};

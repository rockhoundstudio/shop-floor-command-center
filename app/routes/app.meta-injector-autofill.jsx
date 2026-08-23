import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary.jsx";
import { TARGET_KEYS } from "../utils/metaScan";

const stoneProfileCache = new Map();

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
      'SELECT id FROM "StoneCache" WHERE "stoneName" = $1 LIMIT 1',
      [stoneName]
    );
    if (existing.length === 0) {
      await queryPostgres(
        'INSERT INTO "StoneCache" ("id", "stoneName", "data", "createdAt", "updatedAt") VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())',
        [stoneName, JSON.stringify(geoResult)]
      );
      console.log("[StoneCache] Saved new entry for:", stoneName);
    }
  } catch (err) {
    console.error("[StoneCache] Save failed for:", stoneName, err.message);
  }
}

// ==========================================
// ENVIRONMENT VARIABLES & MAPS
// ==========================================
const MINDAT_API_KEY = process.env.MINDAT_API_KEY;

const MINDAT_KEY_MAP = {
  official_name: "name",
  mineral_class: "mindat_formula",
  crystal_structure: "crystal_system",
  luster: "luster",
  specific_gravity: "density",
  moh_hardness: "hardness",
  cleavage: "cleavage",
  fracture_pattern: "fracture",
  diaphaneity: "transparency",
  tenacity: "tenacity",
  origin_location: "localities_count",
};

const SHOPPED_ROCK_VENDORS = ["Richardson's Rock Ranch", "Irv's Rock and Jewelry", "Irv's Rock & Jewelry"];

// ==========================================
// ENGINE: EXPONENTIAL BACKOFF RETRY
// ==========================================
async function fetchWithRetry(url, options, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, options);
    if (res.status !== 503 && res.status !== 429) {
      return res;
    }
    console.warn(`[Gemini Engine] API returned status ${res.status}. Retry ${i + 1} of ${retries} in ${delay}ms...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw new Error("Gemini API connection timed out after multiple attempts.");
}

// 🟢 THE RESTORED LIVE SCANNER: Pulls all actual Pages and Collections from Shopify
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
        excerpt: (e.node.body || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 300)
      }));
    }
    if (data.data?.collections?.edges) {
      collectionsList = data.data.collections.edges.map(e => ({
        title: e.node.title,
        url: `/collections/${e.node.handle}`,
        excerpt: (e.node.description || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 300)
      }));
    }
  } catch (err) {
    console.error("[Live Directory Scanner] Failed to fetch store inventory:", err.message);
  }
  return { pagesList, collectionsList };
}

// Helper for quick fallback matching
function resolveOriginHandle(locationSegment, pagesList) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (!cleanLoc) return "";
  if (cleanLoc.includes("richardson")) return "the-richardson-strike";
  if (cleanLoc.includes("irv")) return "the-shopped-rock";
  if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return "the-north-fork-strike";
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return "chert-road-detour";

  const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
  return match ? match.url.replace("/pages/", "") : cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = []) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (cleanLoc.includes("richardson")) return { slug: "richardsons-rock-ranch", name: "Richardson's Rock Ranch Collection" };
  if (cleanLoc.includes("irv")) return { slug: "the-shopped-rock", name: "The Shopped Rock Collection" };
  if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return { slug: "north-fork-cda-collection", name: "North Fork CdA Collection" };
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return { slug: "chert-road-detour", name: "Chert Road Detour — Yakima River Jasper Collection" };

  const matchedCol = collectionsList.find(c => c.url.includes(defaultOriginSlug) || c.title.toLowerCase().includes(cleanLoc));
  if (matchedCol) {
    return { slug: matchedCol.url.replace("/collections/", ""), name: matchedCol.title.endsWith("Collection") ? matchedCol.title : `${matchedCol.title} Collection` };
  }

  return { slug: defaultOriginSlug, name: `${locationSegment.trim()} Collection` };
}

async function getGeoData(admin, stoneFamily) {
  const emptyGeo = {
    hardness: "", luster: "", fracture: "", cleavage: "",
    specific_gravity: "", diaphaneity: "", crystal_system: "",
    geological_era: "", mineral_class: "", rock_composition: "",
    rock_formation: "", mohs_hardness: "", fracture_pattern: "",
    specific_gravity: "", geological_age: ""
  };
  
  if (!stoneFamily || !admin) {
    return { ...emptyGeo, geoSource: "none" };
  }

  const search = stoneFamily.toLowerCase().trim();

  // TIER 1 — geoLibrary.jsx (drive, fast)
  try {
    const localResult = lookupStone(stoneFamily);
    if (localResult && Object.keys(localResult).length > 0) {
      console.log("[Geo Tier 1] Hit in geoLibrary for:", search);
      return {
        hardness: localResult.moh_hardness || localResult.hardness || "",
        luster: localResult.luster || "",
        fracture: localResult.fracture_pattern || localResult.fracture || "",
        cleavage: localResult.cleavage || "",
        specific_gravity: localResult.specific_gravity || "",
        diaphaneity: localResult.diaphaneity || "",
        crystal_system: localResult.crystal_system || "",
        geological_era: localResult.geological_era || localResult.geological_age || "",
        mineral_class: localResult.mineral_class || "",
        rock_composition: localResult.rock_composition || "",
        rock_formation: localResult.rock_formation || "",
        mohs_hardness: localResult.moh_hardness || localResult.hardness || "",
        fracture_pattern: localResult.fracture_pattern || localResult.fracture || "",
        specific_gravity: localResult.specific_gravity || "",
        geological_age: localResult.geological_era || localResult.geological_age || "",
        geoSource: "library"
      };
    }
  } catch (err) {
    console.warn("[Geo Tier 1] geoLibrary lookup failed:", err.message);
  }

  // TIER 2 — PostgreSQL StoneProfile (one DB hit per stone per server session)
  try {
    if (stoneProfileCache.has(search)) {
      const cached = stoneProfileCache.get(search);
      if (cached) {
        console.log("[Geo Tier 2] Memory cache hit for:", search);
        return { ...cached, geoSource: "cache" };
      }
    } else {
      const rows = await queryPostgres(
        'SELECT * FROM "StoneProfile" WHERE LOWER("stoneName") = $1 LIMIT 1',
        [search]
      );
      if (rows.length > 0) {
        const s = rows[0];
        console.log("[Geo Tier 2] Hit in PostgreSQL StoneProfile for:", search);
        const geoResult = {
          hardness: s.hardness || "",
          luster: s.luster || "",
          fracture: s.fracture || "",
          cleavage: s.cleavage || "",
          specific_gravity: s.specific_gravity || "",
          diaphaneity: s.diaphaneity || "",
          crystal_system: s.crystal_system || "",
          geological_era: s.geological_era || "",
          mineral_class: s.mineral_class || "",
          rock_composition: s.rock_composition || "",
          rock_formation: s.rock_formation || "",
          mohs_hardness: s.hardness || "",
          fracture_pattern: s.fracture || "",
          specific_gravity: s.specific_gravity || "",
          geological_age: s.geological_era || ""
        };
        stoneProfileCache.set(search, geoResult);
        return { ...geoResult, geoSource: "database" };
      } else {
        console.warn("[Geo Tier 2] No match in StoneProfile for:", search);
        stoneProfileCache.set(search, null);
      }
    }
  } catch (err) {
    console.error("[Geo Tier 2] PostgreSQL StoneProfile failed:", err.message);
  }

  // TIER 3 — Mindat API (last resort, saves result to StoneCache and StoneProfile)
  try {
    if (MINDAT_API_KEY) {
      console.log("[Geo Tier 3] Trying Mindat for:", search);
      const mindatRes = await fetch(
        `https://api.mindat.org/minerals/?name=${encodeURIComponent(stoneFamily)}&format=json`,
        { headers: { Authorization: `Token ${MINDAT_API_KEY}` } }
      );
      const mindatData = await mindatRes.json();
      const mineral = mindatData?.results?.[0];
      if (mineral) {
        const hardness = mineral.hardness || "";
        const specific_gravity = mineral.density || "";
        const geoResult = {
          hardness,
          luster: mineral.luster || "",
          fracture: mineral.fracture || "",
          cleavage: mineral.cleavage || "",
          specific_gravity,
          diaphaneity: mineral.transparency || "",
          crystal_system: mineral.crystal_system || "",
          geological_era: "",
          mineral_class: mineral.mineral_class || "",
          rock_composition: "",
          rock_formation: "",
          mohs_hardness: hardness,
          fracture_pattern: mineral.fracture || "",
          specific_gravity: specific_gravity,
          geological_age: ""
        };
        stoneProfileCache.set(search, geoResult);
        await saveToStoneCache(search, geoResult);
        console.log("[Geo Tier 3] Mindat hit saved to StoneCache for:", search);
        return { ...geoResult, geoSource: "mindat" };
      }
    }
  } catch (err) {
    console.error("[Geo Tier 3] Mindat failed:", err.message);
  }

  return { ...emptyGeo, geoSource: "none" };
}

// ==========================================
// CORE EXECUTION GRAPH
// ==========================================
export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const actionType = body.get("actionType");
    const intent = body.get("intent");

    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      try { 
        const geoFields = await getGeoData(admin, stoneFamily); 
        return Response.json({ geoFields }); 
      } catch (err) { 
        console.error("[geoLookup] getGeoData crashed:", err.message); 
        return Response.json({ geoFields: {} }); 
      }
    }

    // ==========================================
    // INTENT: TITLE PARSE
    // ==========================================
    if (intent === "titleParse") {
      const pieceNameInput = body.get("pieceName") || "";
      const segments = pieceNameInput.split(" - ");
      const segment1 = segments[0]?.trim() || "";
      const segment2 = segments[1]?.trim() || "";
      const segment3 = segments[2]?.trim() || "";

      let stonePicklist = "Agate, Amazonite, Amethyst, Andesite, Aventurine, Azurite, Brecciated Jasper, Brecciated Quartz, Calcite, Carnelian, Chalcedony, Chrysocolla, Citrine, Dalmatian Stone, Fluorite, Garnet, Hematite, Howlite, Jasper, Kyanite, Labradorite, Lapis Lazuli, Lepidolite, Malachite, Moonstone, Obsidian, Ocean Jasper, Onyx, Opal, Petrified Wood, Picture Jasper, Prehnite, Pyrite, Quartz, Quartzite, Rhodonite, Rhyolite, Rose Quartz, Serpentine, Smoky Quartz, Sodalite, Sunstone, Tiger's Eye, Tourmaline, Turquoise, Unakite, Variscite";
      
      try {
        const stoneRows = await queryPostgres('SELECT "stoneName" FROM "StoneProfile" ORDER BY "stoneName"', []);
        if (stoneRows && stoneRows.length > 0) {
          stonePicklist = stoneRows.map(r => r.stoneName).join(", ");
        }
      } catch (err) {
        console.warn("[titleParse] StoneProfile picklist fetch failed, using fallback:", err.message);
      }

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(segment2, resolvedHandle, collectionsList);

      const matchedPage = pagesList.find(p => p.url.includes(resolvedHandle));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      const promptText = `You are an expert lapidary assistant for Rockhound Studio. Analyze these segments:\n- Family: "${segment1}", Origin: "${segment2}", Title: "${segment3}"\nSet origin_handle strictly to: "${resolvedHandle}". Use "The Shopped Rock" for location if it is a vendor. stone_family must be exactly one of: ${stonePicklist} - pick the closest match to the Family segment. Correct typos and partial names. Return the exact string from this list, no variations, no lowercase.\nReturn valid JSON with these exact keys: stone_family, piece_name, origin_handle, origin_location, collection_name, collection_location. No markup. No extra keys.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.slice(first, last + 1);
        }
        const parsed = JSON.parse(cleanJson);
        
        // 🟢 THE HARD DB WELD: Pull immutable geo specs straight from DB / Geo Library
        console.log("[titleParse] Gemini returned stone_family:", parsed.stone_family);
        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);
        const matchedOriginPage = pagesList.find(p => p.url.includes(resolvedHandle));
        const displayName = matchedOriginPage ? matchedOriginPage.title.replace(/^The\s+/i, "").trim() : collectionData.name.replace(/\s+Collection$/i, "").trim();
        const finalParse = {
          ...parsed,
          ...dbGeoData,
          origin_handle: resolvedHandle,
          origin_story: extractedStory,
          origin_location: segment2,
          collection_name: collectionData.name,
          collection_location: collectionData.name.replace(" Collection", ""),
          canonical_title: parsed.stone_family + " — " + displayName + " — " + segment3
        };
        
        return Response.json({ titleParse: finalParse });
      }
      return Response.json({ titleParse: null, error: "Title parse error" }, { status: 500 });
    }

    // ==========================================
    // INTENT: VISION SCAN (Splicing Exact Links & Hardware)
    // ==========================================
    if (intent === "visionScan") {
      const pieceId = body.get("pieceId");
      const clientBase64 = body.get("imageBase64");
      const clientMime = body.get("imageMimeType") || "image/jpeg";
      
      const titleInput = body.get("pieceName") || "";
      const segments = titleInput.split(/\s+[-–—]\s+/);
      const originSegment = segments[1]?.trim() || "Unknown Origin";
      
      // 🟢 EXECUTE LIVE DIRECTORY SCANNER
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      
      // Build a clean text menu for Gemini to read
      const pagesMenu = pagesList.map(p => `- Title: "${p.title}" | URL: ${p.url} | Excerpt: "${p.excerpt}"`).join("\n");
      const collectionsMenu = collectionsList.map(c => `- Title: "${c.title}" | URL: ${c.url} | Excerpt: "${c.excerpt}"`).join("\n");

      // Resolve defaults just in case, but give Gemini the full menu
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      const targetUrlPath = `/pages/${defaultOriginSlug}`;
      const collectionUrlPath = `/collections/${defaultCollection.slug}`;

      // Extract exact human-readable collection name without trailing "Collection" word
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      let imageBase64 = clientBase64 && clientBase64 !== "undefined" ? String(clientBase64).trim() : "";
      let imageMimeType = clientMime;

      if (!imageBase64) {
        const rawImageUrl = body.get("imageUrl");
        if (rawImageUrl) {
          const cleanImageUrl = rawImageUrl.split('?')[0];
          const imageRes = await fetch(cleanImageUrl);
          const imageBuffer = await imageRes.arrayBuffer();
          imageBase64 = Buffer.from(imageBuffer).toString("base64");
          imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        }
      }

      const promptText = `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo and return a JSON object.\n- LIVE STORE DIRECTORY (Your Dyslexia Safeguard — Read this menu!):\n  VALID PAGES IN STORE:\n  ${pagesMenu || "No live pages found — use default URL."}\n  \n  VALID COLLECTIONS IN STORE:\n  ${collectionsMenu || "No live collections found — use default URL."}\n\n- description: Poetic, spare, story-driven product description strictly UNDER 100 WORDS total. First person voice ("Bob and Janyce" or "Janyce here..."). Credit craftsmanship strictly as "handcrafted by Bob and Janyce". ZERO workshop references.\nCRITICAL DWELL WEB EMBED LAW: Look at the Origin Segment Janyce entered ("${originSegment}"). Check the LIVE STORE DIRECTORY above and match it to the exact corresponding Page and Collection. You MUST use those live excerpts to write short story hooks leading directly into TWO clickable HTML hyperlinks. \n  1. Origin Hook: Write a short story hook based on the matching Page excerpt, followed immediately by this exact anchor tag format: <a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n  2. Collection Hook: Write a short hook based on the matching Collection excerpt, followed immediately by this exact anchor tag format: <a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>\n- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)"). If a chain is visible, classify as "Necklace".
- chain_material: If a necklace chain is visible, identify it as exactly one of: "Silver Plated Snake Chain", "Gold Plated Snake Chain", "Sterling Silver Chain", "Cord". If no chain is visible, return "None".\n- MANDATORY BENCH FINDINGS & JEWELRY LAWS:\n  * setting_ready: Look closely at the mounting. If cabochon is in a bezel setting, MUST return "Bezel Setting - Ready to Wear". If prong setting, return "Prong Setting - Ready to Wear". If wire wrapped, return "Wire Wrapped - Ready to Wear". NEVER LEAVE BLANK FOR MOUNTED STONES!\n  * wire_material: If wire wrapped, output the wire metal (e.g., "Antiqued Copper Wire"). If in a bezel or prong setting with zero wire, MUST return strictly: "None — Bezel Mounted".\n  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Gold Plated Bezel", "Copper Bezel", "Gold Tone Alloy Bezel", "Silver Tone Alloy Bezel", "Bronze Tone Alloy Bezel", "Glue-On Loop", "Drilled — Pinch Bail" (loose stone with a drilled hole and pinch bail through it, no bezel). Match the tone and finish visible in the photo. Do not leave blank!
  * surface_finish: Describe the stone's surface finish as seen in the photo. Use terms like "High Polish", "Matte", "Satin", "Natural/Raw", "Tumbled". Do not leave blank.\n  * secondary_medium: Look ONLY for a second distinct METAL component (e.g., a gold accent ring). If you see small stones or crystals on a bail, those are part of the bail — return "None" for secondary_medium. Do NOT describe bail decorations here. If no second metal component exists, return strictly "None".\n  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the bezel (with or without accent stones), return "Silver Plated Pinch Bail". If the bail is welded or formed as part of the bezel frame with no separate clip, return "Integrated Bezel Bail". If there is no bail at all, return "None". Do NOT guess — only report what is physically visible.`;

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
                description: { type: "STRING" },
                primary_color: { type: "STRING" },
                cut_and_shape: { type: "STRING" },
                surface_finish: { type: "STRING" },
                stone_shape: { type: "STRING" },
                dimensions_mm: { type: "STRING" },
                pattern: { type: "STRING" },
                primary_use: { type: "STRING" },
                primary_medium: { type: "STRING" },
                secondary_medium: { type: "STRING" },
                wire_material: { type: "STRING" },
                setting_ready: { type: "STRING" },
                bail_included: { type: "STRING" }
              },
              required: ["description", "primary_use", "setting_ready", "wire_material", "primary_medium", "secondary_medium", "bail_included"]
            }
          }
        })
      });

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        let cleanJson = (geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.slice(first, last + 1);
        }
        const parsedVision = JSON.parse(cleanJson);
        
        const resolved_primary_use = parsedVision.primary_use || parsedVision.use || parsedVision.product_type || "";
        const resolved_primary_medium = parsedVision.primary_medium || parsedVision.medium || parsedVision.metal || parsedVision.primary_metal || "";
        const resolved_secondary_medium = parsedVision.secondary_medium || parsedVision.accent || parsedVision.secondary_metal || "";
        const resolved_wire_material = parsedVision.wire_material || parsedVision.wire || parsedVision.wire_wrap || "";
        const resolved_setting_ready = parsedVision.setting_ready || parsedVision.setting || parsedVision.mounting || parsedVision.bezel || "";
        const resolved_bail_included = parsedVision.bail_included || parsedVision.bail || "";

        return Response.json({
          success: true, 
          intent: "visionScan", 
          pieceId,
          description: parsedVision.description || "",
          primary_color: parsedVision.primary_color || "",
          cut_and_shape: parsedVision.cut_and_shape || "",
          surface_finish: parsedVision.surface_finish || "",
          stone_shape: parsedVision.stone_shape || "",
          dimensions_mm: parsedVision.dimensions_mm || "",
          pattern: parsedVision.pattern || "",
          primary_use: resolved_primary_use,
          primary_medium: resolved_primary_medium,
          secondary_medium: resolved_secondary_medium,
          wire_material: resolved_wire_material,
          setting_ready: resolved_setting_ready,
          bail_included: resolved_bail_included,
          origin_story: extractedStory,
          origin_handle: defaultOriginSlug,
          origin_location: originSegment,
          collection_name: defaultCollection.name,
          collection_location: defaultCollection.name.replace(" Collection", "")
        });
      }
      return Response.json({ success: false, error: "Vision API Failure" });
    }

    return Response.json({ success: true, fields: {} });
  } catch (error) {
    console.error("Critical Failure:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};
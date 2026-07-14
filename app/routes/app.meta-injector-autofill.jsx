import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary";
import { TARGET_KEYS } from "../utils/metaScan";

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
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return "chert-road-detour";

  const match = pagesList.find(p => p.title.toLowerCase().includes(cleanLoc) || p.url.includes(cleanLoc));
  return match ? match.url.replace("/pages/", "") : cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
}

function resolveCollectionData(locationSegment, defaultOriginSlug, collectionsList = []) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (cleanLoc.includes("richardson")) return { slug: "the-3000-mile-run", name: "The 3,000-Mile Run Collection" };
  if (cleanLoc.includes("irv")) return { slug: "the-shopped-rock", name: "The Shopped Rock Collection" };
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return { slug: "chert-road-detour", name: "Chert Road Detour — Yakima River Jasper Collection" };

  const matchedCol = collectionsList.find(c => c.url.includes(defaultOriginSlug) || c.title.toLowerCase().includes(cleanLoc));
  if (matchedCol) {
    return { slug: matchedCol.url.replace("/collections/", ""), name: matchedCol.title.endsWith("Collection") ? matchedCol.title : `${matchedCol.title} Collection` };
  }

  return { slug: defaultOriginSlug, name: `${locationSegment.trim()} Collection` };
}

function getGeoData(stoneFamily) {
  const family = stoneFamily.toLowerCase().trim();
  const geoLibrary = {
    "agate": { hardness: "6.5 - 7", luster: "Vitreous to waxy", fracture: "Conchoidal", cleavage: "None", specificGravity: "2.58 - 2.64", diaphaneity: "Translucent to opaque", crystalSystem: "Trigonal", geologicalEra: "Various", mineralClass: "Silicates", rockComposition: "Silicon dioxide", rockFormation: "Volcanic cavities", mohs_hardness: "6.5 - 7", fracture_pattern: "Conchoidal", specific_gravity: "2.58 - 2.64", geological_age: "Various" },
    "jasper": { hardness: "6.5 - 7", luster: "Vitreous to dull", fracture: "Conchoidal", cleavage: "None", specificGravity: "2.5 - 2.9", diaphaneity: "Opaque", crystalSystem: "Trigonal (microcrystalline)", geologicalEra: "Various", mineralClass: "Silicates", rockComposition: "Silicon dioxide with impurities", rockFormation: "Sedimentary or volcanic", mohs_hardness: "6.5 - 7", fracture_pattern: "Conchoidal", specific_gravity: "2.5 - 2.9", geological_age: "Various" },
    "chalcedony": { hardness: "6.5 - 7", luster: "Waxy, vitreous, dull", fracture: "Conchoidal", cleavage: "None", specificGravity: "2.59 - 2.61", diaphaneity: "Translucent to opaque", crystalSystem: "Trigonal", geologicalEra: "Various", mineralClass: "Silicates", rockComposition: "Silicon dioxide", rockFormation: "Sedimentary or volcanic cavities", mohs_hardness: "6.5 - 7", fracture_pattern: "Conchoidal", specific_gravity: "2.59 - 2.61", geological_age: "Various" },
    "obsidian": { hardness: "5 - 5.5", luster: "Vitreous", fracture: "Conchoidal", cleavage: "None", specificGravity: "2.35 - 2.60", diaphaneity: "Translucent to opaque", crystalSystem: "Amorphous", geologicalEra: "Various (primarily Cenozoic)", mineralClass: "Mineraloid", rockComposition: "Silica-rich volcanic glass", rockFormation: "Extrusive igneous", mohs_hardness: "5 - 5.5", fracture_pattern: "Conchoidal", specific_gravity: "2.35 - 2.60", geological_age: "Various" },
    "quartz": { hardness: "7", luster: "Vitreous", fracture: "Conchoidal", cleavage: "None", specificGravity: "2.65", diaphaneity: "Transparent to opaque", crystalSystem: "Trigonal", geologicalEra: "Various", mineralClass: "Silicates", rockComposition: "Silicon dioxide", rockFormation: "Igneous, metamorphic, and sedimentary", mohs_hardness: "7", fracture_pattern: "Conchoidal", specific_gravity: "2.65", geological_age: "Various" }
  };
  return geoLibrary[family] || { hardness: "", luster: "", fracture: "", cleavage: "", specificGravity: "", diaphaneity: "", crystalSystem: "", geologicalEra: "", mineralClass: "", rockComposition: "", rockFormation: "", mohs_hardness: "", fracture_pattern: "", specific_gravity: "", geological_age: "" };
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
      return Response.json({ geoFields: getGeoData(stoneFamily) });
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

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(segment2, resolvedHandle, collectionsList);

      const matchedPage = pagesList.find(p => p.url.includes(resolvedHandle));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      const promptText = `You are an expert lapidary assistant for Rockhound Studio. Analyze these segments:
- Family: "${segment1}", Origin: "${segment2}", Title: "${segment3}"
Set origin_handle strictly to: "${resolvedHandle}". Use "The Shopped Rock" for location if it is a vendor. stone_family must be exactly one of: Agate, Andesite, Aventurine, Chalcedony, Jasper, Jaspagate, Labradorite, Obsidian, Quartzite, Quartz, Rhyolite, Serpentine, Variscite - pick the closest match to the Family segment. Return the exact string, no variations, no lowercase.
Return valid JSON with these exact keys: stone_family, piece_name, origin_handle, origin_location, collection_name, collection_location. No markup. No extra keys.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{"), last = cleanJson.lastIndexOf("}");
        if (first !== -1 && last !== -1) cleanJson = cleanJson.slice(first, last + 1);
        const parsed = JSON.parse(cleanJson);
        
        // 🟢 THE HARD DB WELD: Pull immutable geo specs straight from DB / Geo Library
        const dbGeoData = getGeoData(parsed.stone_family || segment1);
        const finalParse = {
          ...parsed,
          ...dbGeoData,
          origin_handle: resolvedHandle,
          origin_story: extractedStory,
          origin_location: segment2,
          collection_name: collectionData.name,
          collection_location: collectionData.name.replace(" Collection", ""),
            canonical_title: parsed.stone_family + " - " + resolvedHandle + " - " + segment3
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

      const promptText = `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo and return a JSON object.
- LIVE STORE DIRECTORY (Your Dyslexia Safeguard — Read this menu!):
  VALID PAGES IN STORE:
  ${pagesMenu || "No live pages found — use default URL."}
  
  VALID COLLECTIONS IN STORE:
  ${collectionsMenu || "No live collections found — use default URL."}

- description: Poetic, spare, story-driven product description strictly UNDER 100 WORDS total. First person voice ("Bob and Janyce" or "Janyce here..."). Credit craftsmanship strictly as "handcrafted by Bob and Janyce". ZERO workshop references.
CRITICAL DWELL WEB EMBED LAW: Look at the Origin Segment Janyce entered ("${originSegment}"). Check the LIVE STORE DIRECTORY above and match it to the exact corresponding Page and Collection. You MUST use those live excerpts to write short story hooks leading directly into TWO clickable HTML hyperlinks. 
  1. Origin Hook: Write a short story hook based on the matching Page excerpt, followed immediately by this exact anchor tag format: <a href="${targetUrlPath}">${fullCollectionTitle} Story</a>
  2. Collection Hook: Write a short hook based on the matching Collection excerpt, followed immediately by this exact anchor tag format: <a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>
- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)").
- MANDATORY BENCH FINDINGS & JEWELRY LAWS:
  * setting_ready: Look closely at the mounting. If cabochon is in a bezel setting, MUST return "Bezel Setting - Ready to Wear". If prong setting, return "Prong Setting - Ready to Wear". If wire wrapped, return "Wire Wrapped - Ready to Wear". NEVER LEAVE BLANK FOR MOUNTED STONES!
  * wire_material: If wire wrapped, output the wire metal (e.g., "Antiqued Copper Wire"). If in a bezel or prong setting with zero wire, MUST return strictly: "None — Bezel Mounted".
  * primary_medium: State the primary metal or mounting material (e.g., ".925 Sterling Silver Bezel", "Copper Bezel", "Alloy"). Do not leave blank!
  * secondary_medium: State accent metal or "None".
  * bail_included: State the bail style (e.g., "Integrated Bezel Bail", "Sterling Silver Pinch Bail") or "None".`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
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
        const first = cleanJson.indexOf("{"), last = cleanJson.lastIndexOf("}");
        if (first !== -1 && last !== -1) cleanJson = cleanJson.slice(first, last + 1);
        const parsedVision = JSON.parse(cleanJson);
        
        const resolved_primary_use = parsedVision.primary_use || parsedVision.use || parsedVision.product_type || "";
        const resolved_primary_medium = parsedVision.primary_medium || parsedVision.medium || parsedVision.metal || parsedVision.primary_metal || "";
        const resolved_secondary_medium = parsedVision.secondary_medium || parsedVision.accent || parsedVision.secondary_metal || "";
        const resolved_wire_material = parsedVision.wire_material || parsedVision.wire || parsedVision.wire_wrap || "";
        const resolved_setting_ready = parsedVision.setting_ready || parsedVision.setting || parsedVision.mounting || parsedVision.bezel || "";
        const resolved_bail_included = parsedVision.bail_included || parsedVision.bail || "";

        return Response.json({
          success: true, intent: "visionScan", pieceId,
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
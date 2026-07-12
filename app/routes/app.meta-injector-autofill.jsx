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

// Helper to pull live origin pages from Shopify metaobjects
async function getLiveOriginPages(admin) {
  let originPages = [];
  try {
    const metaRes = await admin.graphql(`
      query {
        metaobjects(type: "origin_page", first: 250) {
          edges {
            node {
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
    `);
    const metaData = await metaRes.json();
    if (metaData.data?.metaobjects?.edges) {
      originPages = metaData.data.metaobjects.edges.map(edge => {
        const fields = {};
        edge.node.fields.forEach(f => { fields[f.key] = f.value; });
        return {
          handle: edge.node.handle,
          canonical_name: fields.name || fields.display_name || fields.title || edge.node.handle,
          location: fields.location || ""
        };
      });
    }
  } catch (err) {
    console.error("Failed to fetch dynamic origin pages:", err.message);
  }
  return originPages;
}

// Helper to resolve the correct handle based on your Dwell Web business rules
function resolveOriginHandle(locationSegment, livePages) {
  const cleanLoc = (locationSegment || "").toLowerCase().trim();
  if (!cleanLoc) return "";

  // Rule 1: Vendor Exception
  if (cleanLoc.includes("irv") || cleanLoc.includes("richardson")) {
    return "shopped-rock-collection";
  }

  // Rule 2: Yakima Exception
  if (cleanLoc.includes("yakima")) {
    return "chert-road-detour";
  }

  // Rule 3: Dynamic lookup from Shopify Metaobjects list
  const match = livePages.find(p => 
    p.canonical_name.toLowerCase().includes(cleanLoc) || 
    p.handle.toLowerCase().replace(/-/g, " ").includes(cleanLoc)
  );

  if (match) return match.handle;

  // Fallback: standard hyphenated slug format
  return cleanLoc.replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
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

      const livePages = await getLiveOriginPages(admin);
      const resolvedHandle = resolveOriginHandle(segment2, livePages);

      const promptText = `You are an expert lapidary assistant for Rockhound Studio. Analyze these segments:
- Family: "${segment1}", Origin: "${segment2}", Title: "${segment3}"
Set origin_handle strictly to: "${resolvedHandle}". Use "The Shopped Rock" for location if it is a vendor. Match stone family to exact library matches.
Return valid JSON matching the structure perfectly with no markup text.`;

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          contents: [{ parts: [{ text: promptText }] }]
        })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{"), last = cleanJson.lastIndexOf("}");
        if (first !== -1 && last !== -1) cleanJson = cleanJson.slice(first, last + 1);
        const parsed = JSON.parse(cleanJson);
        // Guarantee hard structural overrides pass through safely
        parsed.origin_handle = resolvedHandle;
        return Response.json({ titleParse: parsed });
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
      const collectionInput = body.get("collectionName") || "";
      
      const segments = titleInput.split(/\s+[-–—]\s+/);
      const originSegment = segments[1]?.trim() || "Unknown Origin";
      
      const livePages = await getLiveOriginPages(admin);
      const finalTargetSlug = resolveOriginHandle(originSegment, livePages);
      const targetUrlPath = `/pages/${finalTargetSlug}`;
      
      const collectionSlug = collectionInput.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-");
      const collectionUrlPath = collectionSlug ? `/collections/${collectionSlug}` : "#";

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

      const promptText = `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo.
- description: Poetic, spare, story-driven product description strictly UNDER 100 WORDS. First person voice ("Bob and Janyce" or "Janyce here..."). Credit craftsmanship strictly as "handcrafted by Bob and Janyce". ZERO workshop references.
CRITICAL DWELL WEB EMBED LAW: You MUST naturally weave TWO clickable HTML hyperlinks into the description text:
  1. An Origin Hook linking to the stone's origin story: <a href="${targetUrlPath}">${originSegment}</a>
  2. A Collection Hook linking to the specific collection: <a href="${collectionUrlPath}">${collectionInput}</a>
- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)").
- MANDATORY BENCH FINDINGS & JEWELRY LAWS:
  * setting_ready: Look closely at the mounting. If cabochon is in a bezel setting, MUST return "Bezel Setting - Ready to Wear". If prong setting, return "Prong Setting - Ready to Wear". If wire wrapped, return "Wire Wrapped - Ready to Wear". NEVER LEAVE BLANK FOR MOUNTED STONES!
  * wire_material: If wire wrapped, output the wire metal (e.g., "Antiqued Copper Wire"). If in a bezel or prong setting with zero wire, MUST return strictly: "None — Bezel Mounted".
  * primary_medium: State the primary metal or mounting material (e.g., ".925 Sterling Silver Bezel", "Copper Bezel", "Alloy"). Do not leave blank!
  * secondary_medium: State accent metal or "None".
  * bail_included: State the bail style (e.g., "Integrated Bezel Bail", "Sterling Silver Pinch Bail") or "None".`;

      // 🟢 THE WELD: Required schema lock forces Gemini to fill every key
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
        
        return Response.json({
          success: true, intent: "visionScan", pieceId,
          description: parsedVision.description || "",
          primary_color: parsedVision.primary_color || "",
          cut_and_shape: parsedVision.cut_and_shape || "",
          surface_finish: parsedVision.surface_finish || "",
          stone_shape: parsedVision.stone_shape || "",
          dimensions_mm: parsedVision.dimensions_mm || "",
          pattern: parsedVision.pattern || "",
          primary_use: parsedVision.primary_use || "",
          primary_medium: parsedVision.primary_medium || "",
          secondary_medium: parsedVision.secondary_medium || "",
          wire_material: parsedVision.wire_material || "",
          setting_ready: parsedVision.setting_ready || "",
          bail_included: parsedVision.bail_included || ""
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
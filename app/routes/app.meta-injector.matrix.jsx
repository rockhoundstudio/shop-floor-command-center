import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";

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

    if (intent === "titleParse" || intent === "visionScan" || intent === "fullRescan" || intent === "tab2AutoFill" || intent === "generateDescription") {
        // Dispatch directly to the shared utility
        const result = await executeAutofill(intent, body, admin);
        
        // Map the utility's return payload back to standard Response.json wrapper
        if (!result.success) {
            return Response.json({ success: false, intent, error: result.error || `Execution failed for ${intent}` }, { status: 500 });
        }
        
        return Response.json(result);
    }

    if (intent === "cleanMalformedKeys" || intent === "cleanAllCamelKeys" || intent === "stagedUpload" || intent === "createProduct" || intent === "cleanGhostNamespaces" || intent === "cleanAllGhostNamespaces" || intent === "toggleStatus" || intent === "batchAuditItem") {
        // Fallback to utility for remaining intents
       return await executeAutofill(intent, body, admin);
    }

    return Response.json({ success: true, intent: intent || "unknown" });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
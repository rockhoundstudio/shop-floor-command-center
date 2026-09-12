import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary.jsx";
import { TARGET_KEYS } from "../utils/metaScan";

const stoneProfileCache = new Map();

// ==========================================
// 🔴 THE MASTER VISION PROMPT
// Tune this once. Both Tab 1 (Intake) and Tab 2 (Bench) pull from here.
// ==========================================
function buildMasterVisionPrompt({
  pagesMenu,
  collectionsMenu,
  stoneFamily,
  originStory,
  originSegment,
  targetUrlPath,
  fullCollectionTitle,
  collectionUrlPath
}) {
  let dwellButtonsHTML = `     <a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n     <a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>`;
  
  if (originSegment === "Richardson's Rock Ranch" || targetUrlPath.includes("the-richardson-strike")) {
    dwellButtonsHTML = `     <a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>
     <a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>
     <a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>
     <a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>
     CRITICAL: Copy the following six links EXACTLY as written. Do NOT alter, rewrite, or infer any href value. Every character must match precisely.
     <a href="/pages/the-shopped-rock">The Shopped Rock Story</a>
     <a href="/collections/the-shopped-rock">The Shopped Rock Collection</a>`;
  }

  return `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo and return a JSON object.
CRITICAL ANTI-HALLUCINATION RULE: NEVER use the word "shocked" or "Shocked Rock". The correct term is "Shopped Rock". Do NOT let your geological training autocorrect this.
- LIVE STORE DIRECTORY (Your Dyslexia Safeguard — Read this menu!):
  VALID PAGES IN STORE:
  ${pagesMenu || "No live pages found — use default URL."}
  
  VALID COLLECTIONS IN STORE:
  ${collectionsMenu || "No live collections found — use default URL."}

- primary_color
- stone_shape: Select EXACTLY one from this list: Round, Oval, Freeform, Teardrop, Pear, Cushion, Marquise, Rectangle, Square, Heart, N/A
- jewelry_type: Select EXACTLY one from this list: Artisan jewelry, Fine jewelry, Accessories, N/A
- rarity: Select EXACTLY one from this list: Common, Uncommon, Rare, One-of-a-Kind (default: Common if unsure)
- authenticity: Select EXACTLY one from this list: Authentic, Lab-Created, Unknown (default: Authentic for natural stones)
- color_pattern: Select EXACTLY one from this list: Green, Black, Blue flash, Red, White, Multicolor, Gold, Pink, Yellow, Silver, Purple, Striped, Clear, Yellow veins, None
- cut_and_shape
- surface_finish
- honest_flaws_and_character
- origin_location: CRITICAL! Look at the provided Origin Segment ("${originSegment}"). Cross-reference it with the LIVE STORE DIRECTORY above and return the fully expanded, correct geographic name. **NEVER include prefixes like "Shop Lore:", "The", or "Collection" in this field.** (e.g., strictly return "Yakima River Canyon" or "North Fork Coeur d'Alene").
- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)", "Loose Stone"). If a chain is visible, classify as "Necklace".
- primary_medium
- setting_ready
- wire_material
- bail_included
- chain_material: If a necklace chain is visible, identify it as exactly one of: "Silver Plated Snake Chain", "Gold Plated Snake Chain", "Sterling Silver Chain", "Cord". If no chain is visible, return "None".
- seo_title: Generate a keyword-rich SEO product title (max 60 characters) optimized for Google. Combine the stone family ("${stoneFamily}"), your newly corrected origin_location, cut/shape, and keywords like "Handcrafted", "Natural", "OOAK", or "Lapidary Art". Separate with pipes (|) or em-dashes (—). Do NOT use quotes.
- generated_description: Write in Bob's voice using this STRICT 7-BLOCK FORMAT. Separate each block naturally. Do NOT use markdown headers.
  1. Stone Description: Past tense for the find. Plain and honest — say what happened, stop. No salesy language. Short sentences. One idea at a time. Highlight the freeform revolution and honest flaws.
  2. Origin Hook: Write a short story hook based on the FULL ORIGIN STORY below.
  3. Collection Hook: Write a short hook about the ${fullCollectionTitle} Collection.
  4. Signature: EXACTLY this line: — Bob & Janyce, Rockhound Studio, Spokane Valley WA.
  5. Stone Data: Brief lapidary specs (cut, finish, dimensions).
  6. Ready to Wear: Clearly state if the piece is set and ready to wear, or a raw/loose stone for makers.
  7. Dwell Buttons: Include EXACTLY these clickable HTML hyperlinks on their own lines:
${dwellButtonsHTML}

FULL ORIGIN STORY:
${originStory}

- MANDATORY BENCH FINDINGS & JEWELRY LAWS (CRITICAL FOR LOOSE STONES):
  * THE LOOSE STONE OVERRIDE: If this is a bare, loose stone with NO metal, setting, wire, or bail, you MUST return strictly "None" for setting_ready, wire_material, primary_medium, secondary_medium, chain_material, and bail_included. Do NOT guess or hallucinate metal for a bare rock.
  * HARDWARE PHYSICS LAW: A "Glue-On Loop" requires a flat back. A "Drilled — Pinch Bail" requires a drilled hole. You cannot have both. If primary_medium is "Glue-On Loop" or "Drilled — Pinch Bail", you MUST set bail_included to "None".
  * setting_ready: Look closely at the mounting. If cabochon is in a bezel setting, MUST return "Bezel Setting - Ready to Wear". If prong setting, return "Prong Setting - Ready to Wear". If wire wrapped, return "Wire Wrapped - Ready to Wear". If loose or unmounted, return "None".
  * wire_material: If wire wrapped, output the wire metal (e.g., "Antiqued Copper Wire"). If in a bezel or prong setting with zero wire, or loose, MUST return strictly: "None".
  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Gold Plated Bezel", "Copper Bezel", "Gold Tone Alloy Bezel", "Silver Tone Alloy Bezel", "Bronze Tone Alloy Bezel", "Glue-On Loop", "Drilled — Pinch Bail". Match the tone and finish visible in the photo. If loose and unmounted, return "None".
  * surface_finish: Describe the stone's surface finish as seen in the photo. Use terms like "High Polish", "Matte", "Satin", "Natural/Raw", "Tumbled". Do not leave blank.
  * secondary_medium: Look ONLY for a second distinct METAL component. If no second metal component exists, or if loose, return strictly "None".
  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the bezel, return "Silver Plated Pinch Bail". If the bail is welded/integrated, return "Integrated Bezel Bail". If there is no bail at all, or if loose, return "None".`;
}

function extractStoneName(title) {
  if (!title) return "Unknown";
  
  const sanitizedTitle = String(title).replace(/â€”/g, "—");
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
        excerpt: (e.node.body || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 4000)
      }));
    }
    if (data.data?.collections?.edges) {
      collectionsList = data.data.collections.edges.map(e => ({
        title: e.node.title,
        url: `/collections/${e.node.handle}`,
        excerpt: (e.node.description || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim().slice(0, 2000)
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
  if (cleanLoc.includes("irv")) return "the-shopped-rock";
  if (cleanLoc.includes("north fork") || cleanLoc.includes("north-fork") || cleanLoc.includes("cda") || cleanLoc.includes("nor")) return "the-north-fork-strike";
  if (cleanLoc.includes("yakima") || cleanLoc.includes("yak") || cleanLoc.includes("chert")) return "the-shop-lore-chert-road-detour-yakima-river-jasper";

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
    mohs_hardness: "", luster: "", fracture_pattern: "", cleavage: "",
    specific_gravity: "", diaphaneity: "", crystal_system: "",
    geological_era: "", mineral_class: "", rock_composition: "",
    rock_formation: "", geological_age: "", geoSource: "none"
  };
  
  if (!stoneFamily || !admin) return emptyGeo;

  const cleanStoneName = extractStoneName(stoneFamily);
  const search = cleanStoneName.toLowerCase().trim();

  // TIER 1: Local hardcoded library
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

  // TIER 2A: PostgreSQL StoneCache
  try {
    const cacheRows = await queryPostgres('SELECT data FROM "StoneCache" WHERE LOWER("stone_name") = $1 LIMIT 1', [search]);
    if (cacheRows.length > 0 && cacheRows[0].data) {
      const parsed = typeof cacheRows[0].data === "string" ? JSON.parse(cacheRows[0].data) : cacheRows[0].data;
      return { ...parsed, geoSource: "cache" };
    }
  } catch (err) {
    console.error("[Geo Tier 2A] PostgreSQL StoneCache lookup failed:", err.message);
  }

  // TIER 2B: PostgreSQL StoneProfile Table
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

  // TIER 3: Mindat API
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
        let cleaned = obj[key].replace(/â€"/g, "—");
        cleaned = cleaned.replace(/Shocked\s*Rock/gi, "Shopped Rock");
        cleaned = cleaned.replace(/the-shocked-rock/gi, "the-shopped-rock");
        cleaned = cleaned.replace(/shocked[-_]rock/gi, "shopped-rock");
        cleaned = cleaned.replace(/shocked%2Drock/gi, "shopped-rock");
        obj[key] = cleaned;
      }
    }
  }
  return obj;
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
      const productTitle = rawProductTitle.replace(/â€”/g, "—");
      const imageUrl = body.get("imageUrl") || "";

      // Capture physical bench inputs to protect from being wiped
      const bench_weight_grams = body.get("weight_grams") || "";
      const bench_shipping_weight_oz = body.get("shipping_weight_oz") || "";
      const bench_dimensions_mm = body.get("dimensions_mm") || "";
      const bench_price = body.get("price") || "";

      const titleSegments = productTitle.split(/\s+[-—–]\s+/);
      const derivedFamily = titleSegments[0]?.trim() || stone_family;
      const derivedOrigin = titleSegments[1]?.trim() || "";
      const pieceNameSegment = titleSegments[2]?.trim() || "New Piece";

      try {
        const geoFields = await getGeoData(admin, derivedFamily);
        const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
        
        const initialOriginHandle = resolveOriginHandle(derivedOrigin, pagesList);
        const initialCollectionData = resolveCollectionData(derivedOrigin, initialOriginHandle, collectionsList);
        const targetUrlPath = `/pages/${initialOriginHandle}`;
        const collectionUrlPath = `/collections/${initialCollectionData.slug}`;
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
                      rarity: { type: "STRING" },
                      authenticity: { type: "STRING" }
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
                 const desc = visionFields.generated_description;
                 const lowerDesc = desc.toLowerCase();
                 if (desc.startsWith("[VISION API CRASH]") || desc.startsWith("[API CRASH]") || desc.startsWith("[JSON PARSE ERROR]") || lowerDesc.includes("timed out")) {
                     visionFields.generated_description = "";
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

        const correctedOrigin = visionFields.origin_location || derivedOrigin;
        const finalOriginHandle = resolveOriginHandle(correctedOrigin, pagesList);
        const finalCollectionData = resolveCollectionData(correctedOrigin, finalOriginHandle, collectionsList);
        
        // BUG 2 FIX: Ensure Richardson's page handle is absolutely enforced
        const finalOriginPageHandle = finalOriginHandle === "the-richardson-strike" ? "the-richardson-strike" : finalOriginHandle;

        const manual_seo_title = correctedOrigin
          ? `Handcrafted ${derivedFamily} — ${correctedOrigin} — OOAK Lapidary Art`
          : `Handcrafted ${derivedFamily} — OOAK Lapidary Art`;

        const payload = sanitizeObject({
          origin_story: origin_story,
          stone_family: derivedFamily,
          origin_handle: finalOriginHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_location: correctedOrigin,
          shopify_title: `${derivedFamily} — ${correctedOrigin} — ${pieceNameSegment}`,
          collection_name: finalCollectionData.name,
          collection_location: finalCollectionData.name.replace(/\s*Collection$/i, "").trim(),
          seo_title: visionFields.seo_title || manual_seo_title,
          authenticity: visionFields.authenticity || "Authentic",
          rarity: visionFields.rarity || "Common",
          secondary_medium: visionFields.secondary_medium || "None",
          cut_and_shape: visionFields.cut_and_shape || "",
          jewelry_type: visionFields.jewelry_type || "N/A",
          color_pattern: visionFields.color_pattern || visionFields.pattern || "",
          generated_description: visionFields.generated_description || "",
          color: visionFields.color || "",
          surface_finish: visionFields.surface_finish || "",
          stone_shape: visionFields.stone_shape || "",
          primary_use: visionFields.primary_use || "",
          primary_medium: visionFields.primary_medium || "",
          wire_material: visionFields.wire_material || "None",
          setting_ready: visionFields.setting_ready || "None",
          bail_included: visionFields.bail_included || "None",
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
          google_product_category: "Apparel & Accessories > Jewelry",
          // Retain physical bench attributes so they never get wiped
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
      const pieceNameInput = (body.get("pieceName") || "").replace(/â€”/g, "—");
      const segments = pieceNameInput.split(/\s+[—–-]\s+/);
      const segment1 = segments[0]?.trim() || "";
      const segment2 = segments[1]?.trim() || "";
      const segment3 = segments[2]?.trim() || "";

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
CRITICAL ANTI-HALLUCINATION RULE: NEVER use the word "shocked" or "Shocked Rock". The correct term is "Shopped Rock". Do NOT let your geological training autocorrect this.
- Family: "${segment1}"
- Origin: "${segment2}"
- Title: "${segment3}"

LIVE STORE DIRECTORY:
VALID PAGES IN STORE:
${pagesMenu || "No live pages found."}

VALID COLLECTIONS IN STORE:
${collectionsMenu || "No live collections found."}

INSTRUCTIONS:
1. The Origin segment ("${segment2}") is the AUTHORITY. Do NOT reclassify or override it. Set 'origin_location' to the clean geographic name derived from "${segment2}" — strip prefixes like "Shop Lore:", "The", or "Collection". Expand abbreviations (e.g. "cda" → "North Fork Coeur d'Alene", "yakima" → "Yakima Canyon"). Match 'collection_name' and 'collection_location' to the live store entry that corresponds to "${segment2}". Never substitute a vendor name or "The Shopped Rock" unless "${segment2}" explicitly contains a vendor name.
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
        
        const dbGeoData = await getGeoData(admin, derivedFamily || parsed.stone_family || segment1);
        const matchedOriginPage = pagesList.find(p => p.url.includes(resolvedHandle));
        const displayName = matchedOriginPage ? matchedOriginPage.title.replace(/^(Shop Lore|Collection)[\s:\-]+/i, "").replace(/^The\s+/i, "").trim() : collectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const seoTitleParts = [];
        if (derivedFamily || parsed.stone_family || segment1) seoTitleParts.push(derivedFamily || parsed.stone_family || segment1);
        
        let seo_title = "";
        if (seoTitleParts.length > 0) {
          seo_title = parsed.origin_location || segment2
            ? `${seoTitleParts.join(" ")} — Found at ${parsed.origin_location || segment2} — Rockhound Studio`
            : `${seoTitleParts.join(" ")} — Rockhound Studio`;
        }

        // BUG 2 FIX: Ensure Richardson's page handle is absolutely enforced
        const finalOriginPageHandle = resolvedHandle === "the-richardson-strike" ? "the-richardson-strike" : resolvedHandle;

        const finalParse = sanitizeObject({
          ...parsed,
          origin_handle: resolvedHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_story: extractedStory,
          origin_location: parsed.origin_location || segment2,
          collection_name: parsed.collection_name || collectionData.name,
          collection_location: parsed.collection_location || collectionData.name.replace(" Collection", ""),
          canonical_title: parsed.stone_family + " — " + (parsed.origin_location || displayName) + " — " + segment3,
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
      
      // Preserve bench fields so full rescan never clears existing weight or measurements
      const bench_weight_grams = body.get("weight_grams") || "";
      const bench_shipping_weight_oz = body.get("shipping_weight_oz") || "";
      const bench_dimensions_mm = body.get("dimensions_mm") || "";
      const bench_price = body.get("price") || "";
      const bench_origin_story = body.get("origin_story") || "";
      const bench_honest_flaws = body.get("honest_flaws_and_character") || "";

      const rawTitleInput = body.get("productTitle") || body.get("pieceName") || body.get("piece_name") || "";
      const titleInput = rawTitleInput.replace(/â€”/g, "—");
      const segments = titleInput.split(/\s+[—–-]\s+/);
      const derivedFamily = segments[0]?.trim() || "Unknown Stone";
      const originSegment = segments[1]?.trim() || "Unknown Origin";
      
      const geoFields = await getGeoData(admin, derivedFamily);
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      const targetUrlPath = `/pages/${defaultOriginSlug}`;
      const collectionUrlPath = `/collections/${defaultCollection.slug}`;
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      
      // BUG 3 FIX: Reset origin_story if matched page differs from bench, to prevent stale carry-over
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
                rarity: { type: "STRING" },
                authenticity: { type: "STRING" }
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
        const resolved_primary_medium = parsedVision.primary_medium || parsedVision.medium || parsedVision.metal || "Natural Stone";
        const resolved_secondary_medium = parsedVision.secondary_medium || "None";
        const resolved_wire_material = parsedVision.wire_material || "None";
        const resolved_setting_ready = parsedVision.setting_ready || "None";
        const resolved_bail_included = parsedVision.bail_included || "None";

        let final_desc = parsedVision.generated_description || "";
        const lowerDesc = final_desc.toLowerCase();
        if (final_desc.startsWith("[VISION API CRASH]") || final_desc.startsWith("[API CRASH]") || final_desc.startsWith("[JSON PARSE ERROR]") || lowerDesc.includes("timed out")) {
            final_desc = "";
        }

        const finalOriginLocation = parsedVision.origin_location || originSegment;
        const finalOriginHandle = resolveOriginHandle(finalOriginLocation, pagesList);
        const finalCollectionData = resolveCollectionData(finalOriginLocation, finalOriginHandle, collectionsList);

        // BUG 2 FIX: Ensure Richardson's page handle is absolutely enforced
        const finalOriginPageHandle = finalOriginHandle === "the-richardson-strike" ? "the-richardson-strike" : finalOriginHandle;

        const payload = sanitizeObject({
          pieceId,
          generated_description: final_desc,
          debug_origin: `seg=${originSegment}|slug=${finalOriginHandle}|matched=${matchedPage ? matchedPage.url : "NULL"}|storyLen=${extractedStory.length}`,
          seo_title: parsedVision.seo_title || "",
          primary_color: parsedVision.primary_color || "",
          cut_and_shape: parsedVision.cut_and_shape || "",
          surface_finish: parsedVision.surface_finish || "",
          stone_shape: parsedVision.stone_shape || "",
          jewelry_type: parsedVision.jewelry_type || "N/A",
          rarity: parsedVision.rarity || "Common",
          authenticity: parsedVision.authenticity || "Authentic",
          color_pattern: parsedVision.color_pattern || parsedVision.pattern || "",
          primary_use: resolved_primary_use,
          primary_medium: resolved_primary_medium,
          secondary_medium: resolved_secondary_medium,
          wire_material: resolved_wire_material,
          setting_ready: resolved_setting_ready,
          bail_included: resolved_bail_included,
          origin_story: extractedStory,
          origin_handle: finalOriginHandle,
          origin_page_handle: finalOriginPageHandle,
          origin_location: finalOriginLocation,
          collection_name: finalCollectionData.name,
          collection_location: finalCollectionData.name.replace(/\s*Collection$/i, "").trim(),
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
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry",
          // Preserve physical bench attributes during full rescan
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

    // ==========================================
    // 🟢 THE MAGIC WAND RECEIVER (generateDescription)
    // ==========================================
    if (intent === "generateDescription") {
      const sharedFields = JSON.parse(body.get("sharedFields") || "{}");
      const pieceData = JSON.parse(body.get("pieceData") || "{}");
      
      const derivedFamily = sharedFields.stone_family || "Unknown Stone";
      const originSegment = sharedFields.origin_location || "Unknown Origin";
      
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      
      const targetUrlPath = `/pages/${defaultOriginSlug}`;
      const collectionUrlPath = `/collections/${defaultCollection.slug}`;
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      let dwellButtonsHTML = `     <a href="${targetUrlPath}">${fullCollectionTitle} Story</a>\n     <a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>`;
      
      if (originSegment === "Richardson's Rock Ranch" || targetUrlPath.includes("the-richardson-strike")) {
        dwellButtonsHTML = `     <a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>
     <a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>
     <a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>
     <a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>
     CRITICAL: Copy the following six links EXACTLY as written. Do NOT alter, rewrite, or infer any href value. Every character must match precisely.
     <a href="/pages/the-shopped-rock">The Shopped Rock Story</a>
     <a href="/collections/the-shopped-rock">The Shopped Rock Collection</a>`;
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

VOICE RULES:
- Past tense for the find. "I picked it up." Not "pick it up."
- Plain and honest. Say what happened. Stop.
- No salesy language. No Etsy language. No badges.
- Short sentences. One idea at a time.
- "We" for the partnership. "I" for Bob's personal moment with the stone.
- The stone earns its own sale. Never push it.
- The OOAK nature is self-evident. Never say "one of a kind" as a selling point.
- No jewelry store language. This is freeform lapidary art.
- Signature always: — Bob & Janyce, Rockhound Studio, Spokane Valley WA

DESCRIPTION STRUCTURE — follow this order exactly:

1. PHYSICAL DESCRIPTION
What the stone looks like. Shape, color, flash, finish, character marks. Specific and honest. Let the stone speak first.

2. ORIGIN HOOK
1-2 sentences only. Pull from the origin_story field. Enough to make them want to read the full story. End with the placeholder: {{ORIGIN_LINK}}

3. COLLECTION HOOK
1-2 sentences connecting the stone to its collection. End with the placeholder: {{COLLECTION_LINKS}}

4. QUICK-REFERENCE SPECS
Stone: [stone_family]
Dimensions: [dimensions_mm]
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
- Do NOT generate any URLs or href links. Links are handled server-side.
- Do NOT use the words: unique, one-of-a-kind, handmade, artisan, special, curated, stunning, beautiful, gorgeous, perfect, love, passion.
- Do NOT hallucinate stone properties not provided in the input fields.
- Output HTML only. Use <p> tags for paragraphs. No <h> tags. No <ul> or <li>.
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
        const finalDescription = (safeParsed.generated_description || "").trimEnd() + "\n" + dwellButtonsHTML;
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
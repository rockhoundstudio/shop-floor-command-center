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
  return `You are a lapidary artist and master jeweler for Rockhound Studio. Analyze this photo and return a JSON object.
- LIVE STORE DIRECTORY (Your Dyslexia Safeguard — Read this menu!):
  VALID PAGES IN STORE:
  ${pagesMenu || "No live pages found — use default URL."}
  
  VALID COLLECTIONS IN STORE:
  ${collectionsMenu || "No live collections found — use default URL."}

- primary_color: Identify the dominant color of the stone.
- stone_shape: Select EXACTLY one from this list: Round, Oval, Freeform, Teardrop, Pear, Cushion, Marquise, Rectangle, Square, Heart, N/A
- jewelry_type: Select EXACTLY one from this list: Artisan jewelry, Fine jewelry, Accessories, N/A
- necklace_design: Select EXACTLY one from this list: Pendant, Chain, Anklet, Bracelet, N/A
- material: Select EXACTLY one from this list: Gold-plated, Silver-plated, Sterling Silver, Metal, Bronze, Nylon, Cotton, N/A
- chain_link_type: Return chain style or "N/A" if none.
- jewelry_finding_type: Return finding type or "N/A" if none.
- rarity: Select EXACTLY one from this list: Common, Uncommon, Rare, One-of-a-Kind (default: Common if unsure)
- authenticity: Select EXACTLY one from this list: Authentic, Lab-Created, Unknown (default: Authentic for natural stones)
- color_pattern: Analyze the visual texture of the stone. Select EXACTLY one from this lapidary list, or combine them if necessary: Brecciated, Banded, Landscape, Mottled, Striped, Solid, Plume, Dendritic, Spotted, Swirled, None.
- cut_and_shape: (e.g. "Freeform Teardrop Cabochon", "Round Cabochon")
- surface_finish: Describe the stone's surface finish as seen in the photo. Use terms like "High Polish", "Matte", "Satin", "Natural/Raw", "Tumbled". Do not leave blank.
- dimensions_mm: Estimate physical dimensions in millimeters (Length x Width x Depth) based on visual proportions. DO NOT return "N/A" or leave blank. Provide your best lapidary estimate (e.g., "30 x 20 x 5 mm").
- honest_flaws_and_character: Analyze the stone for vugs, pits, healed fractures, or raw edges. If you see them, list them honestly. If the stone is perfectly smooth and clean, output strictly: "Clean face, solid matrix, natural lapidary character."
- origin_location: CRITICAL! Look at the provided Origin Segment ("${originSegment}"). Cross-reference it with the LIVE STORE DIRECTORY above and return the fully expanded, correct geographic name. **NEVER include prefixes like "Shop Lore:", "The", or "Collection" in this field.** (e.g., strictly return "Yakima River Canyon" or "North Fork Coeur d'Alene").
- primary_use: Smart Switch! Force strictly to best match (e.g., "Pendant (Finished Jewelry)", "Necklace", "Ring / Bezel Setting", "Cabochon", "Wire Wrap (Finished Jewelry)", "Loose Stone"). If a chain is visible, classify as "Necklace".
- seo_title: Generate a keyword-rich SEO product title (max 60 characters) optimized for Google. Combine the stone family ("${stoneFamily}"), your newly corrected origin_location, cut/shape, and keywords like "Handcrafted", "Natural", "OOAK", or "Lapidary Art". Separate with pipes (|) or em-dashes (—). Do NOT use quotes.
- generated_description: Write in Bob's voice. Past tense for the find. Plain and honest — say what happened, stop. No salesy language. Short sentences. One idea at a time. Use specific details from the FULL ORIGIN STORY below. End with EXACTLY this line, using an em-dash: — Bob & Janyce, Rockhound Studio, Spokane Valley WA. Do not use hyphens or dashes other than the em-dash (—). 150–250 words. Stop when it's right.
FULL ORIGIN STORY:
${originStory}
CRITICAL DWELL WEB EMBED LAW: Look at the Origin Segment Janyce entered ("${originSegment}"). Check the LIVE STORE DIRECTORY above and match it to the exact corresponding Page and Collection. You MUST use those live excerpts to write short story hooks leading directly into TWO clickable HTML hyperlinks. 
  1. Origin Hook: Write a short story hook based on the matching Page excerpt, followed immediately by this exact anchor tag format: <a href="${targetUrlPath}">${fullCollectionTitle} Story</a>
  2. Collection Hook: Write a short hook based on the matching Collection excerpt, followed immediately by this exact anchor tag format: <a href="${collectionUrlPath}">${fullCollectionTitle} Collection</a>

- MANDATORY BENCH FINDINGS & JEWELRY LAWS (CRITICAL HARDWARE SCAN):
  * THE MICROSCOPE DIRECTIVE: You MUST zoom in on the top edge of the stone. Look for a drilled hole, a metal pinch bail passing through a hole, or wire wrapping. DO NOT blindly default to "None" without checking the top edge!
  * THE LOOSE STONE OVERRIDE: If this is truly a bare, loose stone with NO metal, hole, wire, or bail, you MUST return strictly "None" for setting_ready, wire_material, primary_medium, secondary_medium, chain_material, and bail_included. 
  * setting_ready: Look closely at the mounting. If cabochon is in a bezel setting, return "Bezel Setting - Ready to Wear". If wire wrapped, return "Wire Wrapped - Ready to Wear". If it has a pinch bail, return "Pendant - Ready to Wear". If loose, return "None".
  * wire_material: If wire wrapped, output the wire metal. If in a bezel, prong, pinch bail, or loose, MUST return strictly: "None".
  * primary_medium: State the primary metal or mounting material. Use exactly one of these: ".925 Sterling Silver Bezel", "Silver Plated Bezel", "Gold Plated Bezel", "Copper Bezel", "Drilled — Pinch Bail". Match the tone and finish visible in the photo. If there is a hole drilled through the stone with a bail pinched into it, you MUST return "Drilled — Pinch Bail". If loose, return "None".
  * secondary_medium: Look ONLY for a second distinct METAL component. If no second metal component exists, return strictly "None".
  * bail_included: Look at the TOP of the piece. If there is a separate small clip or loop pinched onto the stone, return "Silver Plated Pinch Bail" or "Gold Plated Pinch Bail". If the bail is welded/integrated into a bezel, return "Integrated Bezel Bail". If no bail, return "None".
  * chain_material: If a necklace chain is visible, identify it (e.g., "Silver Plated Snake Chain", "Cord"). If no chain, return "None".

- NEGATIVE DIRECTIVES:
  * DO NOT generate, output, or include a "collection_date" field.
  * DO NOT generate, output, or include an "alt_text" field.`;
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
    console.error("[StoneCache] Save failed for:", stoneName, err);
  }
}

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

const SHOPPED_ROCK_VENDORS = ["Richardson's Rock Ranch", "Irv's Rock and Jewelry", "Irv's Rock & Jewelry", "Rock and Gem Show"];

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

// 🔴 STRICT GEO FORMATTING
async function getGeoData(admin, stoneFamily) {
  const emptyGeo = {
    mohs_hardness: "", luster: "", fracture_pattern: "", cleavage: "",
    specific_gravity: "", diaphaneity: "", crystal_system: "",
    geological_era: "", mineral_class: "", rock_composition: "",
    rock_formation: "", geological_age: "", geoSource: "none"
  };
  
  if (!stoneFamily || !admin) return emptyGeo;

  const search = stoneFamily.toLowerCase().trim();

  try {
    const localResult = lookupStone(stoneFamily);
    if (localResult && Object.keys(localResult).length > 0) {
      return {
        mohs_hardness: localResult.moh_hardness || localResult.hardness || "",
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
    if (stoneProfileCache.has(search)) {
      const cached = stoneProfileCache.get(search);
      if (cached) return { ...cached, geoSource: "cache" };
    } else {
      const rows = await queryPostgres('SELECT * FROM "StoneProfile" WHERE LOWER("stoneName") = $1 LIMIT 1', [search]);
      if (rows.length > 0) {
        const s = rows[0];
        const geoResult = {
          mohs_hardness: s.hardness || "",
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
    console.error("[Geo Tier 2] PostgreSQL StoneProfile failed:", err);
  }

  try {
    if (MINDAT_API_KEY) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000);
      const mindatRes = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(stoneFamily)}&format=json`, { 
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

export const action = async ({ request }) => {
  try {
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      try { 
        const geoFields = await getGeoData(admin, stoneFamily); 
        return Response.json({ success: true, intent: "geoLookup", geoFields }); 
      } catch (err) { 
        console.error("[geoLookup] getGeoData crashed:", err); 
        return Response.json({ success: false, intent: "geoLookup", geoFields: {} }); 
      }
    }

    if (intent === "tab2AutoFill") {
      const stone_family = body.get("stone_family") || "";
      const origin_handle = body.get("origin_handle") || "";
      const productTitle = body.get("productTitle") || body.get("piece_name") || body.get("title") || "";
      const imageUrl = body.get("imageUrl") || "";

      const titleSegments = productTitle.split(/\s+[-—–]\s+/);
      const derivedFamily = titleSegments[0]?.trim() || stone_family;
      const derivedOrigin = titleSegments[1]?.trim() || "";
      const pieceNameSegment = titleSegments[2]?.trim() || "New Piece";

      try {
        const geoFields = await getGeoData(admin, derivedFamily);
        const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
        
        const activeOriginHandle = origin_handle || resolveOriginHandle(derivedOrigin, pagesList);
        const collectionData = resolveCollectionData(derivedOrigin, activeOriginHandle, collectionsList);
        const targetUrlPath = `/pages/${activeOriginHandle}`;
        const collectionUrlPath = `/collections/${collectionData.slug}`;
        const fullCollectionTitle = collectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const matchedPage = pagesList.find(p => p.url.includes(activeOriginHandle));
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
                      dimensions_mm: { type: "STRING" },
                      honest_flaws_and_character: { type: "STRING" },
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
                      chain_link_type: { type: "STRING" },
                      jewelry_finding_type: { type: "STRING" },
                      material: { type: "STRING" },
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
                 throw new Error("Gemini API returned empty or malformed response structure.");
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
               throw new Error(`Gemini API returned status: ${geminiRes.status} - ${errText}`);
            }
          } catch (visionErr) {
            console.error("[tab2AutoFill] Vision scan failed:", visionErr);
            visionFields = { generated_description: `[API CRASH] ${visionErr.message}` };
          }
        }

        const correctedOrigin = visionFields.origin_location || derivedOrigin;
        const manual_seo_title = correctedOrigin
          ? `Handcrafted ${derivedFamily} — ${correctedOrigin} — OOAK Lapidary Art`
          : `Handcrafted ${derivedFamily} — OOAK Lapidary Art`;

        // 🔴 STRICT EXPLICIT PAYLOAD MAPPING
        return Response.json({
          success: true,
          intent: "tab2AutoFill",
          tab2Data: {
            origin_story: origin_story,
            stone_family: derivedFamily,
            origin_handle: activeOriginHandle,
            origin_location: correctedOrigin,
            shopify_title: `${derivedFamily} — ${correctedOrigin} — ${pieceNameSegment}`,
            collection_name: collectionData.name,
            collection_location: (() => {
              const LOCATION_MAP = {
                "chert-road-detour": "Yakima Canyon",
                "yakima-canyon": "Yakima Canyon",
                "the-yellowstone-river-collection": "Yellowstone River",
                "the-rufus-serpentine-collection": "Rufus Serpentine",
                "the-nickel-back-collection": "Nickel Back",
                "the-spokane-river-collection": "Spokane River",
                "north-fork-cda-collection": "North Fork CdA",
                "richardsons-rock-ranch": "Richardson's Rock Ranch",
                "the-3-000-mile-run-1": "The 3,000-Mile Run",
                "the-shopped-rock": "The Shopped Rock",
              };
              return LOCATION_MAP[collectionData.slug] || collectionData.name.replace(/\s*Collection$/i, "").trim();
            })(),
            seo_title: visionFields.seo_title || manual_seo_title,
            authenticity: visionFields.authenticity || "Authentic",
            rarity: visionFields.rarity || "Common",
            secondary_medium: visionFields.secondary_medium || "None",
            cut_and_shape: visionFields.cut_and_shape || "",
            jewelry_type: visionFields.jewelry_type || "N/A",
            necklace_design: visionFields.necklace_design || "N/A",
            chain_link_type: visionFields.chain_link_type || "N/A",
            jewelry_finding_type: visionFields.jewelry_finding_type || "N/A",
            material: visionFields.material || "N/A",
            color_pattern: visionFields.color_pattern || visionFields.pattern || "",
            dimensions_mm: visionFields.dimensions_mm || "",
            honest_flaws_and_character: visionFields.honest_flaws_and_character || "Clean face, solid matrix, natural lapidary character.",
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
            custom_product: "true",
            age_group: "adult",
            target_gender: "Unisex",
            condition: "new",
            google_product_category: "Apparel & Accessories > Jewelry"
          }
        });
      } catch (err) {
        console.error("[tab2AutoFill] crashed:", err);
        return Response.json({ success: false, intent: "tab2AutoFill", tab2Data: {} });
      }
    }

    if (intent === "titleParse") {
      const pieceNameInput = body.get("pieceName") || "";
      const segments = pieceNameInput.split(/\s+[—–-]\s+/);
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
1. The Origin segment ("${segment2}") is the AUTHORITY. Do NOT reclassify or override it. Set 'origin_location' to the clean geographic name derived from "${segment2}" — strip prefixes like "Shop Lore:", "The", or "Collection". Expand abbreviations (e.g. "cda" → "North Fork Coeur d'Alene", "yakima" → "Yakima Canyon"). Match 'collection_name' and 'collection_location' to the live store entry that corresponds to "${segment2}". Never substitute a vendor name or "The Shopped Rock" unless "${segment2}" explicitly contains a vendor name.
2. Set origin_handle strictly to: "${resolvedHandle}". 
3. stone_family must be exactly one of: ${stonePicklist} - pick the closest match to the Family segment. Correct typos.

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
          throw new Error("Gemini API returned empty or malformed response structure during titleParse.");
        }
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        const first = cleanJson.indexOf("{");
        const last = cleanJson.lastIndexOf("}");
        
        if (first !== -1 && last !== -1) {
          cleanJson = cleanJson.slice(first, last + 1);
        }
        const parsed = JSON.parse(cleanJson);
        
        const dbGeoData = await getGeoData(admin, parsed.stone_family || segment1);
        const matchedOriginPage = pagesList.find(p => p.url.includes(resolvedHandle));
        const displayName = matchedOriginPage ? matchedOriginPage.title.replace(/^(Shop Lore|Collection)[\s:\-]+/i, "").replace(/^The\s+/i, "").trim() : collectionData.name.replace(/\s+Collection$/i, "").trim();
        
        const seoTitleParts = [];
        if (parsed.stone_family || segment1) seoTitleParts.push(parsed.stone_family || segment1);
        
        let seo_title = "";
        if (seoTitleParts.length > 0) {
          seo_title = parsed.origin_location || segment2
            ? `${seoTitleParts.join(" ")} — Found at ${parsed.origin_location || segment2} — Rockhound Studio`
            : `${seoTitleParts.join(" ")} — Rockhound Studio`;
        }

        const finalParse = {
          ...parsed,
          origin_handle: resolvedHandle,
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
          custom_product: "true",
          age_group: "adult",
          target_gender: "Unisex",
          condition: "new",
          google_product_category: "Apparel & Accessories > Jewelry"
        };
        
        return Response.json({ success: true, intent: "titleParse", titleParse: finalParse });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent: "titleParse", titleParse: null, error: `Title parse error: ${geminiRes.status} - ${errText}` }, { status: 500 });
    }

    if (intent === "visionScan") {
      const pieceId = body.get("pieceId");
      const clientBase64 = body.get("imageBase64");
      const clientMime = body.get("imageMimeType") || "image/jpeg";
      
      const titleInput = body.get("pieceName") || body.get("piece_name") || "";
      const segments = titleInput.split(/\s+[—–-]\s+/);
      const derivedFamily = segments[0]?.trim() || "Unknown Stone";
      const originSegment = segments[1]?.trim() || "Unknown Origin";
      
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      
      const defaultOriginSlug = resolveOriginHandle(originSegment, pagesList);
      const defaultCollection = resolveCollectionData(originSegment, defaultOriginSlug, collectionsList);
      const targetUrlPath = `/pages/${defaultOriginSlug}`;
      const collectionUrlPath = `/collections/${defaultCollection.slug}`;
      const fullCollectionTitle = defaultCollection.name.replace(/\s+Collection$/i, "").trim();

      const matchedPage = pagesList.find(p => p.url.includes(defaultOriginSlug));
      const extractedStory = matchedPage ? matchedPage.excerpt : "";
      
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
                dimensions_mm: { type: "STRING" },
                honest_flaws_and_character: { type: "STRING" },
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
                chain_link_type: { type: "STRING" },
                jewelry_finding_type: { type: "STRING" },
                material: { type: "STRING" },
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
          throw new Error("Gemini API returned empty or malformed response structure during visionScan.");
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
          console.error("[visionScan] JSON Parse Error:", parseErr, "Raw string:", cleanJson);
          return Response.json({ success: false, intent: "visionScan", error: `JSON Parse Error: ${parseErr.message} | Raw string: ${cleanJson.substring(0, 100)}...` });
        }
        
        const resolved_primary_use = parsedVision.primary_use || parsedVision.use || parsedVision.product_type || "";
        const resolved_primary_medium = parsedVision.primary_medium || parsedVision.medium || parsedVision.metal || parsedVision.primary_metal || "Natural Stone";
        const resolved_secondary_medium = parsedVision.secondary_medium || parsedVision.accent || parsedVision.secondary_metal || "None";
        const resolved_wire_material = parsedVision.wire_material || parsedVision.wire || parsedVision.wire_wrap || "None";
        const resolved_setting_ready = parsedVision.setting_ready || parsedVision.setting || parsedVision.mounting || parsedVision.bezel || "None";
        const resolved_bail_included = parsedVision.bail_included || parsedVision.bail || "None";

        let final_desc = parsedVision.generated_description || parsedVision.description || "";
        const lowerDesc = final_desc.toLowerCase();
        if (final_desc.startsWith("[VISION API CRASH]") || final_desc.startsWith("[API CRASH]") || final_desc.startsWith("[JSON PARSE ERROR]") || lowerDesc.includes("timed out")) {
            final_desc = "";
        }

        // 🔴 STRICT EXPLICIT PAYLOAD MAPPING
        return Response.json({
          success: true,
          intent: "visionScan",
          tab2Data: {
            pieceId,
            generated_description: final_desc,
            debug_origin: `seg=${originSegment}|slug=${defaultOriginSlug}|matched=${matchedPage ? matchedPage.url : "NULL"}|storyLen=${extractedStory.length}`,
            seo_title: parsedVision.seo_title || "",
            primary_color: parsedVision.primary_color || "",
            cut_and_shape: parsedVision.cut_and_shape || "",
            surface_finish: parsedVision.surface_finish || "",
            stone_shape: parsedVision.stone_shape || "",
            jewelry_type: parsedVision.jewelry_type || "N/A",
            necklace_design: parsedVision.necklace_design || "N/A",
            chain_link_type: parsedVision.chain_link_type || "N/A",
            jewelry_finding_type: parsedVision.jewelry_finding_type || "N/A",
            material: parsedVision.material || "N/A",
            rarity: parsedVision.rarity || "Common",
            authenticity: parsedVision.authenticity || "Authentic",
            dimensions_mm: parsedVision.dimensions_mm || "",
            color_pattern: parsedVision.color_pattern || parsedVision.pattern || "",
            honest_flaws_and_character: parsedVision.honest_flaws_and_character || "Clean face, solid matrix, natural lapidary character.",
            primary_use: resolved_primary_use,
            primary_medium: resolved_primary_medium,
            secondary_medium: resolved_secondary_medium,
            wire_material: resolved_wire_material,
            setting_ready: resolved_setting_ready,
            bail_included: resolved_bail_included,
            origin_story: extractedStory,
            origin_handle: defaultOriginSlug,
            origin_location: parsedVision.origin_location || originSegment,
            collection_name: defaultCollection.name,
            collection_location: defaultCollection.name.replace(" Collection", ""),
            custom_product: "true",
            age_group: "adult",
            target_gender: "Unisex",
            condition: "new",
            google_product_category: "Apparel & Accessories > Jewelry"
          }
        });
      }
      
      const errText = await geminiRes.text();
      return Response.json({ success: false, intent: "visionScan", error: `Vision API Failure (${geminiRes.status}): ${errText}` });
    }

    return Response.json({ success: true, intent: intent || "unknown", fields: {} });
  } catch (error) {
    console.error("Critical Failure:", error);
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
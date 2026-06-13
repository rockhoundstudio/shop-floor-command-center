import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary";
import { TARGET_KEYS } from "../utils/metaScan";
import * as cheerio from "cheerio";

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

// ==========================================
// ENGINE: MINDAT API FETCHER
// ==========================================
async function fetchMindat(title) {
  if (!MINDAT_API_KEY) return null;
  
  try {
    const search = await fetch(
      `https://api.mindat.org/minerals/?name=${encodeURIComponent(title)}&format=json`,
      { headers: { Authorization: `Token ${MINDAT_API_KEY}` } }
    );
    
    if (!search.ok) return null;
    
    const json = await search.json();
    const results = json?.results;
    
    if (!results || results.length === 0) return null;
    
    return results[0];
  } catch (error) {
    console.error("Mindat API Fetch Fault:", error.message);
    return null; // Fail gracefully so the local library data can still pass through
  }
}

// ==========================================
// ACTION: DATA MERGER & LOOKUP
// ==========================================
export const action = async ({ request }) => {
  try {
    await authenticate.admin(request);
    
    const body = await request.formData();
    const title = body.get("title") || "";
    const description = body.get("description") || ""; // HTML payload
    const existingMeta = JSON.parse(body.get("existingMeta") || "{}");

    const merged = { ...existingMeta };
    
    const safeSet = (key, value) => {
      if (!merged[key] || merged[key].trim() === "") {
        if (value && String(value).trim() !== "") {
          merged[key] = String(value).trim();
        }
      }
    };

    // ==========================================
    // PASS 0: HTML DESCRIPTION PARSER
    // ==========================================
    if (description) {
      try {
        const $ = cheerio.load(description);
        
        // --- The Stone Section Extraction ---
        // Find the heading that contains "The Stone"
        let stoneHeading = null;
        $("h1, h2, h3, h4, h5, h6, strong, b").each((i, el) => {
          if ($(el).text().trim().toLowerCase() === "the stone" || $(el).text().trim().toLowerCase() === "the stone:") {
            stoneHeading = el;
            return false; // break loop
          }
        });

        if (stoneHeading) {
          // Get all following siblings until the next heading or end
          let current = $(stoneHeading).next();
          while (current.length && !current.is("h1, h2, h3, h4, h5, h6")) {
            const text = current.text().trim();
            const lines = text.split(/\r?\n|<br\s*\/?>/i); // Split by physical breaks if packed in one p tag
            
            lines.forEach(line => {
              const cleanedLine = line.replace(/<\/?[^>]+(>|$)/g, "").trim(); // Strip HTML just in case
              const lowerLine = cleanedLine.toLowerCase();

              if (lowerLine.startsWith("type:")) safeSet("primary_medium", cleanedLine.substring(5).trim());
              if (lowerLine.startsWith("origin:")) safeSet("collection_location", cleanedLine.substring(7).trim());
              if (lowerLine.startsWith("shape:")) safeSet("cut_and_shape", cleanedLine.substring(6).trim());
              if (lowerLine.startsWith("dimensions:")) safeSet("dimensions_mm", cleanedLine.substring(11).trim());
              if (lowerLine.startsWith("finish:")) safeSet("surface_finish", cleanedLine.substring(7).trim());
              if (lowerLine.includes("one of a kind") && lowerLine.includes("yes")) safeSet("is_one_of_a_kind", "true");
              if (lowerLine.includes("not dyed") || lowerLine.includes("not enhanced") || lowerLine.includes("untreated")) safeSet("treated", "false");
            });
            
            current = current.next();
          }
        }

        // --- Origin Story Link Extraction ---
        const links = $(".rockhound-dwell-links a, #rockhound-dwell-links a");
        links.each((i, el) => {
          const href = $(el).attr("href");
          if (href && href.includes("/pages/")) {
            const ignoreList = [
              "/pages/tails-and-trails", 
              "/pages/rockhound-logbook-hub", 
              "/pages/build-your-setting", 
              "/pages/the-3-000-mile-run"
            ];
            
            // Handle both absolute and relative URLs
            const urlObj = new URL(href, "https://dummy.com"); 
            const path = urlObj.pathname;
            
            if (!ignoreList.includes(path)) {
              const slug = path.split("/").pop();
              safeSet("origin_story_page_slug", slug);
              return false; // break loop on first valid match
            }
          }
        });

        // --- Story Paragraphs Extraction ---
        // Get paragraphs before the heading "The Stone", or all paragraphs if heading is missing
        let storyParagraphs = [];
        const allParagraphs = $("p");
        
        allParagraphs.each((i, el) => {
          // If we hit the Stone heading or its container, stop collecting
          if (stoneHeading && $.contains(el, stoneHeading) || $(el).text().trim().toLowerCase().includes("the stone")) {
             return false; 
          }
          
          // Clone the element so we can remove anchors without altering the original DOM
          const clone = $(el).clone();
          clone.find('a').remove(); // Strip out anchor text
          const rawText = clone.text().trim();
          
          if (rawText.length > 0) {
            storyParagraphs.push(rawText);
          }
        });

        if (storyParagraphs.length > 0) {
           const combinedStory = storyParagraphs.join("\n\n");
           safeSet("honest_flaws_and_character", combinedStory); 
        }

      } catch (parseError) {
        console.error("Pass 0 HTML Parsing Fault:", parseError.message);
        // Continue to Pass 1 rather than hard crashing
      }
    }


    // ==========================================
    // PASS 1: LOCAL LIBRARY
    // ==========================================
    const libData = lookupStone(title);
    if (libData) {
      TARGET_KEYS.forEach(key => {
        safeSet(key, libData[key]);
      });
    }

    // ==========================================
    // PASS 2: MINDAT API EXTERNAL FETCH
    // ==========================================
    const mindatData = await fetchMindat(title);
    if (mindatData) {
      Object.entries(MINDAT_KEY_MAP).forEach(([ourKey, mindatKey]) => {
        safeSet(ourKey, mindatData[mindatKey]);
      });
    }

    // ==========================================
    // FALLBACKS
    // ==========================================
    safeSet("official_name", title);
    // Remove the old HTML description fallback to stone_story since Pass 0 handles plain text extraction now

    return Response.json({ success: true, merged });
  } catch (error) {
    console.error("Stone Lookup Engine Fault:", error.message);
    // Return a safe empty merge state if the action hard crashes
    return Response.json(
      { success: false, error: error.message, merged: {} }, 
      { status: 500 }
    );
  }
};
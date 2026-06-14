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
    
    const body = await request.json();
    const title = body.title || "";
    const description = body.description || ""; // HTML payload
    const existingMeta = body.existingMeta || {};

    const merged = { ...existingMeta };
    
    const safeSet = (key, value) => {
      if (!merged[key] || merged[key].trim() === "") {
        if (value && String(value).trim() !== "") {
          merged[key] = String(value).trim();
        }
      }
    };

    const alwaysSet = (key, value) => {
      if (value && String(value).trim() !== "") {
        merged[key] = String(value).trim();
      }
    };

    // ==========================================
    // PASS 0: NATIVE HTML DESCRIPTION PARSER
    // ==========================================
    if (description) {
      try {
        // --- 1. The Stone Section Extraction ---
        // Find a heading containing "The Stone" or "The Stone:"
        const stoneHeadingRegex = /<(h[1-6]|strong|b)[^>]*>[\s\S]*?the stone:?[\s\S]*?<\/\1>/i;
        const headingMatch = description.match(stoneHeadingRegex);
        
        let beforeStone = description; // Everything before the heading
        
        if (headingMatch) {
          beforeStone = description.substring(0, headingMatch.index);
          const afterHeading = description.substring(headingMatch.index + headingMatch[0].length);
          
          // Find the next heading to know where the Stone section ends
          const nextHeadingIndex = afterHeading.search(/<h[1-6][^>]*>/i);
          const stoneHtml = nextHeadingIndex !== -1 ? afterHeading.substring(0, nextHeadingIndex) : afterHeading;
          
          // Split content into lines using breaks, closing tags, or literal newlines
          const lines = stoneHtml.split(/<br\s*\/?>|<\/p>|<\/div>|\n/i);
          
          lines.forEach(line => {
            const cleanedLine = line.replace(/<\/?[^>]+(>|$)/g, "").trim(); // Strip HTML
            const lowerLine = cleanedLine.toLowerCase();

            if (lowerLine.startsWith("type:")) safeSet("primary_medium", cleanedLine.substring(5).trim());
            if (lowerLine.startsWith("origin:")) safeSet("collection_location", cleanedLine.substring(7).trim());
            if (lowerLine.startsWith("shape:")) safeSet("cut_and_shape", cleanedLine.substring(6).trim());
            if (lowerLine.startsWith("dimensions:")) safeSet("dimensions_mm", cleanedLine.substring(11).trim());
            if (lowerLine.startsWith("finish:")) safeSet("surface_finish", cleanedLine.substring(7).trim());
            if (lowerLine.includes("one of a kind") && lowerLine.includes("yes")) safeSet("is_one_of_a_kind", "true");
            if (lowerLine.includes("not dyed") || lowerLine.includes("not enhanced") || lowerLine.includes("untreated")) safeSet("treated", "false");
          });
        }

        // --- 2. Origin Story Link Extraction ---
        const ignoreList = [
          "/pages/tails-and-trails", 
          "/pages/rockhound-logbook-hub", 
          "/pages/build-your-setting", 
          "/pages/the-3-000-mile-run"
        ];
        
        // Try to isolate the rockhound-dwell-links div if it exists
        let linkSearchArea = description;
        const dwellLinksDiv = description.match(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*rockhound-dwell-links[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
        if (dwellLinksDiv) {
          linkSearchArea = dwellLinksDiv[1];
        }

        const linkRegex = /<a[^>]*href=["']([^"']+)["']/gi;
        let linkMatch;
        while ((linkMatch = linkRegex.exec(linkSearchArea)) !== null) {
          let href = linkMatch[1];
          if (href.includes("/pages/")) {
            let path = href;
            try {
              // Parse URL to cleanly isolate pathname from protocol/domain/query params
              const urlObj = new URL(href, "https://dummy.com"); 
              path = urlObj.pathname;
            } catch (e) {
              path = href.split('?')[0]; // fallback strip query string
            }
            
            if (!ignoreList.includes(path)) {
              const slug = path.split("/").filter(Boolean).pop();
              safeSet("origin_story_page_slug", slug);
              break; // Stop after finding the first valid link
            }
          }
        }

        // --- 3. Story Paragraphs Extraction ---
        // Extract from text physically located before the "The Stone" heading
        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let pMatch;
        const storyParagraphs = [];
        
        while ((pMatch = pRegex.exec(beforeStone)) !== null) {
          let pContent = pMatch[1];
          
          // Remove anchor tags entirely (including their text content)
          pContent = pContent.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "");
          // Strip remaining HTML tags
          pContent = pContent.replace(/<\/?[^>]+(>|$)/g, "").trim();
          
          if (pContent.length > 0) {
            storyParagraphs.push(pContent);
          }
        }

        if (storyParagraphs.length > 0) {
          const combinedStory = storyParagraphs.join("\n\n");
          alwaysSet("origin_story", combinedStory); 
        }

      } catch (parseError) {
        console.error("Pass 0 Text Parsing Fault:", parseError.message);
        // Do not crash the endpoint, proceed to Pass 1
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

    return Response.json({ success: true, fields: merged });
  } catch (error) {
    console.error("Stone Lookup Engine Fault:", error.message);
    return Response.json(
      { success: false, error: error.message, fields: {} }, 
      { status: 500 }
    );
  }
};
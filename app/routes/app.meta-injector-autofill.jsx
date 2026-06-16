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
    const { admin } = await authenticate.admin(request);
    
    const body = await request.formData();
    const actionType = body.get("actionType");

    if (actionType === "applyStoreDefaults") {
        const rawIds = body.get("productIds");
        if (!rawIds) return Response.json({ success: false, error: "No product IDs provided." });
        
        const productIds = JSON.parse(rawIds);
        const results = [];
        
        for (const productId of productIds) {
            const getMetafieldsQuery = `
                query GetProductMetafields($id: ID!) {
                    product(id: $id) {
                        id
                        metafields(first: 50, namespace: "rockhound") {
                            edges {
                                node {
                                    key
                                    value
                                }
                            }
                        }
                    }
                }
            `;
            
            const metaRes = await admin.graphql(getMetafieldsQuery, { variables: { id: productId } });
            const metaData = await metaRes.json();
            
            if (!metaData.data || !metaData.data.product) {
                console.error(`Failed to load product ${productId} for defaults check`);
                continue;
            }
            
            const existingMetafields = metaData.data.product.metafields.edges.reduce((acc, edge) => {
                acc[edge.node.key] = edge.node.value;
                return acc;
            }, {});
            
            const defaultsToApply = [];
            
            if (!existingMetafields.handcrafted_by || existingMetafields.handcrafted_by.trim() === "") {
                defaultsToApply.push({ namespace: "rockhound", key: "handcrafted_by", type: "single_line_text_field", value: "Bob & Janyce, Rockhound Studio" });
            }
            if (!existingMetafields.is_one_of_a_kind || existingMetafields.is_one_of_a_kind.trim() === "") {
                defaultsToApply.push({ namespace: "rockhound", key: "is_one_of_a_kind", type: "single_line_text_field", value: "Yes — one of a kind" });
            }
            if (!existingMetafields.treated || existingMetafields.treated.trim() === "") {
                defaultsToApply.push({ namespace: "rockhound", key: "treated", type: "single_line_text_field", value: "Untreated — Natural" });
            }
            if (!existingMetafields.found_object || existingMetafields.found_object.trim() === "") {
                defaultsToApply.push({ namespace: "rockhound", key: "found_object", type: "single_line_text_field", value: "Yes — found in the wild" });
            }
            if (!existingMetafields.primary_use || existingMetafields.primary_use.trim() === "") {
                defaultsToApply.push({ namespace: "rockhound", key: "primary_use", type: "single_line_text_field", value: "Wearable Art" });
            }
            
            console.log(`Product ${productId} defaults to apply:`, defaultsToApply.map(m => m.key));
            
            if (defaultsToApply.length > 0) {
                const updateMutation = `
                    mutation productUpdate($input: ProductInput!) {
                        productUpdate(input: $input) {
                            product { id }
                            userErrors { field message }
                        }
                    }
                `;
                
                const updateRes = await admin.graphql(updateMutation, {
                    variables: {
                        input: {
                            id: productId,
                            metafields: defaultsToApply
                        }
                    }
                });
                
                const updateData = await updateRes.json();
                if (updateData.data?.productUpdate?.userErrors?.length > 0) {
                    console.error(`Error updating product ${productId}:`, updateData.data.productUpdate.userErrors);
                } else {
                    results.push({ id: productId, appliedFields: defaultsToApply.map(m => m.key) });
                }
            } else {
                results.push({ id: productId, appliedFields: [] });
            }
        }
        
        return Response.json({ success: true, updated: results });
    }

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
          safeSet("honest_flaws_and_character", combinedStory); 
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
    // PASS 3: GEMINI VISION
    // ==========================================
    try {
      const imageUrl = body.get("imageUrl") || "";
      if (imageUrl) {
        const imageRes = await fetch(imageUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        const imageBase64 = Buffer.from(imageBuffer).toString("base64");
        const imageMimeType = imageRes.headers.get("content-type") || "image/jpeg";

        const promptText = `You are a gemologist and lapidary expert analyzing a handcrafted stone cabochon or specimen for an online store called Rockhound Studio. Look at this stone image carefully and return a JSON object with these fields — only include fields you can visually confirm, leave others out:
{
  color: (primary color and pattern description, e.g. 'Deep red with grey banding'),
  surface_finish: (one of: High Polish, Satin Polish, Matte, Natural/Rough, Tumbled),
  cut_and_shape: (e.g. Freeform, Oval Cabochon, Round Cabochon, Teardrop, Pear, Trillion),
  stone_family: (e.g. Jasper, Agate, Chalcedony, Labradorite, Obsidian, Quartz),
  character_marks: (visible inclusions, patterns, streaks, or unique features),
  alt_text: (a single descriptive sentence for screen readers and SEO, written in plain English describing what is seen in the image)
}
Return only valid JSON. No explanation. No markdown.`;

        const geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: promptText },
                    {
                      inlineData: {
                        mimeType: imageMimeType,
                        data: imageBase64
                      }
                    }
                  ]
                }
              ]
            })
          }
        );

        if (geminiRes.ok) {
          const geminiData = await geminiRes.json();
          const textContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          
          if (textContent) {
            let cleanJson = textContent.trim();
            const firstBrace = cleanJson.indexOf("{");
            const lastBrace = cleanJson.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
            }

            const visionData = JSON.parse(cleanJson);
            safeSet("color", visionData.color);
            safeSet("surface_finish", visionData.surface_finish);
            safeSet("cut_and_shape", visionData.cut_and_shape);
            safeSet("stone_family", visionData.stone_family);
            safeSet("honest_flaws_and_character", visionData.character_marks);
            safeSet("alt_text", visionData.alt_text);
          }
        } else {
          const errText = await geminiRes.text();
          console.error("Gemini Vision API Error:", geminiRes.status, errText);
        }
      }
    } catch (error) {
      console.error("Pass 3 Vision Fault:", error.message);
    }

    // ==========================================
    // STORE-WIDE DEFAULTS
    // ==========================================
    safeSet("handcrafted_by", "Bob & Janyce, Rockhound Studio");
    safeSet("is_one_of_a_kind", "Yes — one of a kind");
    safeSet("treated", "Untreated — Natural");
    safeSet("found_object", "Yes — found in the wild");
    safeSet("primary_use", "Wearable Art");

    // ==========================================
    // FALLBACKS
    // ==========================================
    safeSet("official_name", title);

    return Response.json({ success: true, merged });
  } catch (error) {
    console.error("Stone Lookup Engine Fault:", error.message);
    return Response.json(
      { success: false, error: error.message, merged: {} }, 
      { status: 500 }
    );
  }
};
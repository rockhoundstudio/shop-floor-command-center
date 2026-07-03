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
    return null;
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
    const intent = body.get("intent");

    // ==========================================
    // INTENT: VISION SCAN FOR DESCRIPTION
    // ==========================================
    if (intent === "visionScan") {
      try {
        const clientBase64 = body.get("imageBase64");
        const clientMime = body.get("imageMimeType") || "image/jpeg";

        let imageBase64 = "";
        let imageMimeType = "image/jpeg";

        if (clientBase64 && clientBase64 !== "undefined" && clientBase64 !== "null" && String(clientBase64).trim() !== "") {
          imageBase64 = String(clientBase64).trim();
          imageMimeType = clientMime;
        } else {
          const rawImageUrl = body.get("imageUrl");
          const imageUrl = rawImageUrl && rawImageUrl !== "undefined" && rawImageUrl !== "null" ? String(rawImageUrl).trim() : "";
          
          if (!imageUrl) {
            return Response.json({ description: "", error: "Gemini vision scan failed" });
          }

          const cleanImageUrl = imageUrl.split('?')[0];
          const imageRes = await fetch(cleanImageUrl);
          const imageBuffer = await imageRes.arrayBuffer();
          imageBase64 = Buffer.from(imageBuffer).toString("base64");
          imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        }

        const promptText = "You are a lapidary artist and gemstone expert. Look at this stone photo and write a rich, earthy, one-of-a-kind product description in 2-3 paragraphs. Focus on the colors, patterns, texture, and character of the stone. Write in first person as Bob or Janyce from Rockhound Studio. No corporate language. Raw, authentic, collector energy.";

        const geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
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
          
          if (!textContent) {
            return Response.json({ description: "", error: "Gemini vision scan failed" });
          }
          
          return Response.json({ description: textContent });
        } else {
          const errText = await geminiRes.text();
          console.error("Gemini Vision API Error:", geminiRes.status, errText);
          return Response.json({ description: "", error: "Gemini vision scan failed" });
        }
      } catch (error) {
        console.error("Vision Scan Fault:", error.message);
        return Response.json({ description: "", error: "Gemini vision scan failed" });
      }
    }

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
                        metafields(first: 50, namespace: "custom") {
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
                defaultsToApply.push({ namespace: "custom", key: "handcrafted_by", type: "single_line_text_field", value: "Bob & Janyce, Rockhound Studio" });
            }
            if (!existingMetafields.is_one_of_a_kind || existingMetafields.is_one_of_a_kind.trim() === "") {
                defaultsToApply.push({ namespace: "custom", key: "is_one_of_a_kind", type: "single_line_text_field", value: "true" });
            }
            if (!existingMetafields.treated || existingMetafields.treated.trim() === "") {
                defaultsToApply.push({ namespace: "custom", key: "treated", type: "single_line_text_field", value: "false" });
            }
            if (!existingMetafields.found_object || existingMetafields.found_object.trim() === "") {
                defaultsToApply.push({ namespace: "custom", key: "found_object", type: "single_line_text_field", value: "true" });
            }
            if (!existingMetafields.primary_use || existingMetafields.primary_use.trim() === "") {
                defaultsToApply.push({ namespace: "custom", key: "primary_use", type: "single_line_text_field", value: "Wearable Art" });
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
    const description = body.get("productDescription") || "";
    const promptStyle = body.get("promptStyle") || "";
    const descriptionHtml = body.get("descriptionHtml") || body.get("productDescription") || "";
    const targetDescription = descriptionHtml || description;
    const existingMeta = JSON.parse(body.get("existingMeta") || "{}");

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
    // PASS 0: TEXT PARSING
    // ==========================================
    if (targetDescription) {
      try {
        const stoneHeadingRegex = /<(h[1-6]|strong|b)[^>]*>[\s\S]*?the stone:?[\s\S]*?<\/\1>/i;
        const headingMatch = targetDescription.match(stoneHeadingRegex);
        
        let beforeStone = targetDescription;
        
        if (headingMatch) {
          beforeStone = targetDescription.substring(0, headingMatch.index);
          const afterHeading = targetDescription.substring(headingMatch.index + headingMatch[0].length);
          
          const nextHeadingIndex = afterHeading.search(/<h[1-6][^>]*>/i);
          const stoneHtml = nextHeadingIndex !== -1 ? afterHeading.substring(0, nextHeadingIndex) : afterHeading;
          
          const lines = stoneHtml.split(/<br\s*\/?>|<\/p>|<\/div>|\n/i);
          
          lines.forEach(line => {
            const cleanedLine = line.replace(/<\/?[^>]+(>|$)/g, "").trim();
            const lowerLine = cleanedLine.toLowerCase();

            if (lowerLine.startsWith("type:")) safeSet("primary_medium", cleanedLine.substring(5).trim());
            if (lowerLine.startsWith("origin:")) safeSet("collection_location", cleanedLine.substring(7).trim());
            if (lowerLine.startsWith("shape:")) safeSet("cut_and_shape", cleanedLine.substring(6).trim());
            if (lowerLine.startsWith("dimensions:")) safeSet("dimensions_mm", cleanedLine.substring(11).trim());
            if (lowerLine.startsWith("finish:")) safeSet("surface_finish", cleanedLine.substring(7).trim());
            if (lowerLine.startsWith("flash:")) safeSet("color", cleanedLine.substring(6).trim());
            if (lowerLine.includes("one of a kind") && lowerLine.includes("yes")) safeSet("is_one_of_a_kind", "true");
            if (lowerLine.includes("not dyed") || lowerLine.includes("not enhanced") || lowerLine.includes("untreated")) safeSet("treated", "false");
          });
        }

        const ignoreList = [
          "/pages/tails-and-trails", 
          "/pages/rockhound-logbook-hub", 
          "/pages/build-your-setting", 
          "/pages/the-3-000-mile-run"
        ];
        
        let linkSearchArea = targetDescription;
        const dwellLinksDiv = targetDescription.match(/<(?:div|section)[^>]*(?:id|class)=["'][^"']*rockhound-dwell-links[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|section)>/i);
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
              const urlObj = new URL(href, "https://dummy.com"); 
              path = urlObj.pathname;
            } catch (e) {
              path = href.split('?')[0];
            }
            
            if (!ignoreList.includes(path)) {
              const slug = path.split("/").filter(Boolean).pop();
              safeSet("origin_page_handle", slug);
              break;
            }
          }
        }

        const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
        let pMatch;
        const storyParagraphs = [];
        
        while ((pMatch = pRegex.exec(beforeStone)) !== null) {
          let pContent = pMatch[1];
          pContent = pContent.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, "");
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
      }
    }

    // ==========================================
    // PASS 1: TITLE PARSING
    // ==========================================
    const parseTitle = body.get("productTitle") || title || "";
    if (parseTitle) {
      const titleParts = parseTitle.split(/\s+[-–—]\s+/);
      
      let rawStoneFamily = titleParts[0] || "";
      const wordsToStrip = ["Freeform", "Cabochon", "Oval", "Round", "Teardrop", "Pear", "Square", "Rectangle", "Cushion", "Heart", "Marquise", "Tumbled", "Slab", "Rough", "Raw", "Specimen", "Free Form"];
      
      let cleanedStoneFamily = rawStoneFamily.trim();
      let stripped = true;
      while (stripped) {
        stripped = false;
        for (const word of wordsToStrip) {
          const regex = new RegExp(`(?:\\s+|^)${word}$`, "i");
          if (regex.test(cleanedStoneFamily)) {
            cleanedStoneFamily = cleanedStoneFamily.replace(regex, "").trim();
            stripped = true;
          }
        }
      }
      safeSet("stone_family", cleanedStoneFamily);
      
      if (titleParts.length > 1) {
        safeSet("origin_location", titleParts[1]?.trim() || "");
      }
    }

    const collMatches = [...(targetDescription || "").matchAll(/<a[^>]*href=["'][^"']*\/collections\/([^"'\/?]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
    if (collMatches.length > 0) {
      const uniqueCollections = [...new Set(collMatches.map(m => m[2].replace(/\s*→$/, "").replace(/<\/?[^>]+(>|$)/g, "").trim()))];
      safeSet("collection_name", uniqueCollections.join(", "));
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
    // PASS 2B: GEMINI TEXT
    // ==========================================
    if (targetDescription) {
      try {
        const plainDescription = targetDescription.replace(/<\/?[^>]+(>|$)/g, " ").replace(/\s+/g, " ").trim();
        const promptProductTitle = body.get("productTitle") || "";

        const textPrompt = `${promptStyle ? `Writing style instruction: ${promptStyle}\n\n` : ""}You are a gemologist assistant for Rockhound Studio. The product title is: ${promptProductTitle}. Parse the title segments split by ' — ' to extract piece_name and origin_location. Extract the following fields from this product description. Return only valid JSON with exactly these keys. If a field is not mentioned, return an empty string for it.

{
  "piece_name": "(the text after the second em dash — in the product title — this is the piece name only, not the full title)",
  "origin_location": "(the middle segment between the first and last em dash ' — ' in the product title)",
  "color": "(value after 'Flash:' label, e.g. 'Blue')",
  "cut_and_shape": "(value after 'Shape:' label, e.g. 'Cabochon')",
  "surface_finish": "(value after 'Finish:' label, e.g. 'High Polish')",
  "stone_family": "(the rockhound trade name of the stone — use Labradorite not Feldspar, use Jasper not Chalcedony)",
  "collection_name": "(find the URL in the description that contains /collections/ and extract the collection name from the link text or format the slug after /collections/ as title case. For example if the URL slug is mixed-media return Mixed Media. If no /collections/ URL is found return empty string)",
  "dimensions_mm": "(if dimensions are mentioned in the description in mm format, return them, else empty string)",
  "handcrafted_by": "(name from signature line, e.g. 'Bob & Janyce, Rockhound Studio')",
  "treated": "(if description says untreated or not enhanced, return 'false', else return 'true')",
  "found_object": "(if description says found or collected in the field, return 'true', else return 'false')",
  "is_one_of_a_kind": "(if description says one of a kind, return 'Yes — one of a kind', else return 'No')",
  "artist_notes": "(write 1-2 sentences of internal shop notes about this stone's character, quirks, or what makes it special, based on the description and image. Plain language, no marketing)",
  "origin_page_handle": "(find the URL in the description that contains /pages/ and extract only the handle slug after /pages/. For example if the URL is rockhoundstudio.com/pages/yakima-river-canyon return yakima-river-canyon. If no /pages/ URL is found return empty string)",
  "color_pattern": "(describe the color pattern of the stone in 2-4 words, e.g. 'Banded caramel and white', 'Solid grey with swirls' — based on description or title. Leave blank if unknown.)",
  "material": "(the primary stone or mineral material, e.g. 'Botswana Agate', 'Jasper', 'Obsidian' — use the rockhound trade name. Leave blank if unknown.)",
  "jewelry_type": "(only populate if the product is jewelry — e.g. 'Necklace', 'Pendant', 'Earrings'. Leave blank if it is a freeform stone or art piece.)",
  "necklace_design": "(only populate if jewelry_type is Necklace or Pendant — describe the necklace style in 2-4 words. Leave blank otherwise.)",
  "chain_link_type": "(only populate if jewelry_type is Necklace — e.g. 'Cable', 'Box', 'Rolo'. Leave blank otherwise.)",
  "jewelry_finding_type": "(only populate if jewelry — e.g. 'Bail', 'Bezel', 'Prong'. Leave blank otherwise.)",
  "target_gender": "(infer from description or title — e.g. 'Unisex', 'Women', 'Men'. Default to Unisex if unclear.)",
  "age_group": "(infer from description or title — e.g. 'Adult', 'All Ages'. Default to Adult if unclear.)",
  "custom_product": "(return true if the product is handcrafted or one of a kind, otherwise false.)"
}

Product description:
${plainDescription}

Return only valid JSON. No explanation. No markdown.`;

        const textGeminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: textPrompt }] }]
            })
          }
        );

        if (textGeminiRes.ok) {
          const textGeminiData = await textGeminiRes.json();
          const textContent = textGeminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";

          if (textContent) {
            let cleanJson = textContent.trim();
            const firstBrace = cleanJson.indexOf("{");
            const lastBrace = cleanJson.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
            }

            const textData = JSON.parse(cleanJson);
            console.log("GEMINI TEXT RESPONSE:", JSON.stringify(textData));

            // Sanitization to catch the hyphenated Gemini error key
            if (textData["is_one_of_a-kind"] !== undefined) {
              textData["is_one_of_a_kind"] = textData["is_one_of_a-kind"];
              delete textData["is_one_of_a-kind"];
            }

            safeSet("color", textData.color || textData.Color);
            safeSet("cut_and_shape", textData.cut_and_shape);
            safeSet("surface_finish", textData.surface_finish);
            safeSet("stone_family", textData.stone_family);
            safeSet("piece_name", textData.piece_name);
            safeSet("origin_location", textData.origin_location);
            safeSet("collection_name", textData.collection_name);
            safeSet("dimensions_mm", textData.dimensions_mm);
            safeSet("handcrafted_by", textData.handcrafted_by);
            safeSet("treated", textData.treated);
            safeSet("found_object", textData.found_object);
            safeSet("is_one_of_a_kind", textData.is_one_of_a_kind);
            safeSet("piece_name", textData.piece_name);
            safeSet("artist_notes", textData.artist_notes);
            safeSet("origin_page_handle", textData.origin_page_handle);
            if (textData.stone_family) { safeSet("material", textData.stone_family); }
            if (textData.color_pattern) { safeSet("color-pattern", textData.color_pattern); }
            if (textData.material) { safeSet("material", textData.material); }
            if (textData.jewelry_type) { safeSet("jewelry-type", textData.jewelry_type); }
            if (textData.necklace_design) { safeSet("necklace-design", textData.necklace_design); }
            if (textData.chain_link_type) { safeSet("chain-link-type", textData.chain_link_type); }
            if (textData.jewelry_finding_type) { safeSet("jewelry-finding-type", textData.jewelry_finding_type); }
            if (textData.target_gender) { safeSet("target-gender", textData.target_gender); }
            if (textData.age_group) { safeSet("age-group", textData.age_group); }
            if (textData.custom_product !== undefined) { safeSet("custom_product", textData.custom_product); }

            console.log("Pass 2B Gemini Text extracted:", Object.keys(textData).filter(k => textData[k]));
          }
        } else {
          const errText = await textGeminiRes.text();
          console.error("Pass 2B Gemini Text API Error:", textGeminiRes.status, errText);
        }
      } catch (textError) {
        console.error("Pass 2B Gemini Text Fault:", textError.message);
      }
    }

    // ==========================================
    // PASS 3: GEMINI VISION
    // ==========================================
    let rawVisionResponse = "";
    try {
      const rawBase64 = body.get("imageBase64");
      const rawMime = body.get("imageMimeType");

      let imageBase64 = "";
      let imageMimeType = "image/jpeg";

      if (rawBase64 && rawBase64.length > 100) {
        imageBase64 = rawBase64;
        imageMimeType = rawMime || "image/jpeg";
      } else {
        const rawImageUrl = body.get("imageUrl");
        const imageUrl = rawImageUrl && rawImageUrl !== "undefined" && rawImageUrl !== "null" ? String(rawImageUrl).trim() : "";
        if (imageUrl) {
          const cleanImageUrl = imageUrl.split("?")[0];
          const imageRes = await fetch(cleanImageUrl);
          const imageBuffer = await imageRes.arrayBuffer();
          imageBase64 = Buffer.from(imageBuffer).toString("base64");
          imageMimeType = (imageRes.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
        }
      }
      
      console.log("Tab2 AutoFill imageUrl sent:", body.get("imageUrl"));
      
      if (imageBase64) {

        const clientPrompt = body.get("prompt");
        const promptText = clientPrompt && clientPrompt.trim() !== "" ? clientPrompt : `${promptStyle ? `Writing style instruction: ${promptStyle}\n\n` : ""}You are a gemologist and lapidary expert analyzing a handcrafted stone cabochon or specimen for an online store called Rockhound Studio. Look at this stone image carefully and return a JSON object with these fields — only include fields you can visually confirm, leave others out:
{
  "color": "(return ONLY the primary color as a single word, e.g. 'Blue' or 'Red')",
  "surface_finish": "(one of: High Polish, Satin Polish, Matte, Natural/Rough, Tumbled)",
  "cut_and_shape": "(e.g. Freeform, Oval Cabochon, Round Cabochon, Teardrop, Pear, Trillion)",
  "character_marks": "Describe any visible banding, inclusions, color transitions, surface marks, or distinctive visual features of the stone. Be specific and factual.",
  "alt_text": "(a single descriptive sentence for screen readers and SEO, written in plain English describing what is seen in the image)",
  "is_one_of_a_kind": "(boolean)",
  "found_object": "(boolean)",
  "treated": "(boolean)",
  "setting_ready": "(boolean)",
  "bail_included": "(boolean)",
  "piece_name": "(the text after the second em dash — in the product title — this is the piece name only, not the full title)"
}
Return only valid JSON. No explanation. No markdown.`;

        const geminiRes = await fetch(
          "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY,
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
          rawVisionResponse = textContent;
          
          if (textContent) {
            let cleanJson = textContent.trim();
            const firstBrace = cleanJson.indexOf("{");
            const lastBrace = cleanJson.lastIndexOf("}");
            if (firstBrace !== -1 && lastBrace !== -1) {
              cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
            }

            const visionData = JSON.parse(cleanJson);
            
            // Sanitization to catch the hyphenated Gemini error key
            if (visionData["is_one_of_a-kind"] !== undefined) {
              visionData["is_one_of_a_kind"] = visionData["is_one_of_a-kind"];
              delete visionData["is_one_of_a-kind"];
            }

            if (visionData.is_one_of_a_kind === true) visionData.is_one_of_a_kind = "Yes — one of a kind";
            else if (visionData.is_one_of_a_kind === false) visionData.is_one_of_a_kind = "No";

            if (visionData.found_object === true) visionData.found_object = "true";
            else if (visionData.found_object === false) visionData.found_object = "false";

            if (visionData.treated === true) visionData.treated = "true";
            else if (visionData.treated === false) visionData.treated = "false";

            if (visionData.setting_ready === true) visionData.setting_ready = "true";
            else if (visionData.setting_ready === false) visionData.setting_ready = "false";

            if (visionData.bail_included === true) visionData.bail_included = "true";
            else if (visionData.bail_included === false) visionData.bail_included = "false";

            safeSet("color", visionData.color || visionData.Color || visionData.primary_color);
            safeSet("surface_finish", visionData.surface_finish || visionData.Surface_finish);
            safeSet("cut_and_shape", visionData.cut_and_shape || visionData.Cut_and_shape);
            safeSet("honest_flaws_and_character", visionData.character_marks);
            safeSet("alt_text", visionData.alt_text || visionData.Alt_text);
            safeSet("is_one_of_a_kind", visionData.is_one_of_a_kind);
            safeSet("found_object", visionData.found_object);
            safeSet("treated", visionData.treated);
            safeSet("setting_ready", visionData.setting_ready);
            safeSet("bail_included", visionData.bail_included);
            safeSet("piece_name", visionData.piece_name);
          }
        } else {
          const errText = await geminiRes.text();
          rawVisionResponse = errText;
          console.error("Gemini Vision API Error:", geminiRes.status, errText);
        }
      } else {
        rawVisionResponse = "No image URL or base64 provided to Vision pass.";
      }
    } catch (error) {
      rawVisionResponse = `Vision Exception: ${error.message}`;
      console.error("Pass 3 Vision Fault:", error.message);
    }

    // ==========================================
    // STORE-WIDE DEFAULTS
    // ==========================================
    safeSet("handcrafted_by", "Bob & Janyce, Rockhound Studio");
    safeSet("authenticity", "Genuine");
    safeSet("rarity", "Rare");
    safeSet("condition", "new");
    safeSet("age-group", "Adult");
    safeSet("target-gender", "Unisex");
    safeSet("is_one_of_a_kind", "true");
    safeSet("treated", "false");
    safeSet("found_object", "true");
    safeSet("primary_use", "Wearable Art");

    // ==========================================
    // FALLBACKS
    // ==========================================
    safeSet("official_name", title);

    // FIXED: color fallback now runs BEFORE colorWarning is calculated
    if (!merged.color || merged.color.trim() === "") {
      if (merged.primary_color && merged.primary_color.trim() !== "") {
        merged.color = merged.primary_color;
      }
    }
    const colorWarning = !merged.color || merged.color.trim() === "";

    const productTitle = body.get("productTitle") || "";
    const pieceName = productTitle.includes(" — ") ? productTitle.split(" — ").pop().trim() : productTitle;
    if (pieceName && pieceName.trim() !== "") {
      merged["piece_name"] = pieceName;
    }

    console.log("=== AUTOFILL PAYLOAD BEFORE RETURN ===", merged);

    return Response.json({ 
        success: true, 
        fields: merged, 
        intent: actionType || "autoFill", 
        colorWarning,
        rawVisionResponse
    });
  } catch (error) {
    console.error("Stone Lookup Engine Fault:", error.message);
    return Response.json(
      { success: false, error: error.message, fields: {} }, 
      { status: 500 }
    );
  }
};
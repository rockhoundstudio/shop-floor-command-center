import { data as json } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { ROCKHOUND_FIELDS } from "./meta-injector.constants.jsx";

const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          customMeta: metafields(first: 50, namespace: "custom") {
            edges { node { namespace key value type } }
          }
          rockhoundMeta: metafields(first: 50, namespace: "rockhound") {
            edges { node { namespace key value type } }
          }
          geoMeta: metafields(first: 50, namespace: "geo") {
            edges { node { namespace key value type } }
          }
        }
      }
    }
  }
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
  query GetMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "custom") {
      edges { node { id name key type { name } } }
    }
  }
`;

const GET_SNAPSHOTS_QUERY = `
  query GetSnapshots {
    metaobjects(type: "rockhound_snapshot", first: 10) {
      edges { node { id handle updatedAt fields { key value } } }
    }
  }
`;

const PRODUCT_CREATE_MUTATION = `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id }
      userErrors { field message }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

const COLLECTION_ADD_PRODUCTS_MUTATION = `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id }
      userErrors { field message }
    }
  }
`;

const COLLECTION_MAP = {
  "Spokane River": "gid://shopify/Collection/454794117371",
  "Yakima Canyon": "gid://shopify/Collection/452884922619",
  "Yellowstone River": "gid://shopify/Collection/454795886843",
  "Richardson's Rock Ranch": "gid://shopify/Collection/452912972027",
  "The 3,000-Mile Run": "gid://shopify/Collection/452913135867",
  "Nickel Back": "gid://shopify/Collection/454794871035",
  "Rufus Serpentine": "gid://shopify/Collection/454841237755",
  "The Shopped Rock": "gid://shopify/Collection/454840615163",
  "The Gallery": "gid://shopify/Collection/452886495483"
};

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
  return chunked;
};

async function fetchAllProducts(graphql) {
  const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor: null } });
  const { data } = await response.json();
  if (data && data.products) {
    return data.products.edges.map(edge => {
      const product = edge.node;
      const allEdges = [
        ...(product.customMeta?.edges || []),
        ...(product.rockhoundMeta?.edges || []),
        ...(product.geoMeta?.edges || []),
      ];
      product.metafields = { edges: allEdges };
      return product;
    });
  }
  return [];
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const products = await fetchAllProducts(admin.graphql);
  
  const [definitionsRes, snapshotsRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY)
  ]);
  
  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();
  
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(e => e.node) || [];
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(e => e.node) || [];
  
  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try { count = JSON.parse(dataField.value).length || 0; } catch (e) { count = "Unknown"; }
    }
    return { id: snap.id, createdAt: new Date(snap.updatedAt).toLocaleString(), count };
  });
  
  return json({ products, pageInfo: { hasNextPage: false, endCursor: null }, metafieldDefinitions, snapshots });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createProduct") {
    const raw = formData.get("pieces");
    if (!raw) return json({ success: false, error: "No data received" });
    const payload = JSON.parse(raw);
    const { sharedFields, rows } = payload;
    const results = [];

    for (const row of rows) {
      const title = [sharedFields.material, sharedFields.collection_location, row.piece_name]
        .filter(Boolean).join(" — ");

      const createRes = await admin.graphql(PRODUCT_CREATE_MUTATION, {
        variables: { input: { title, status: "DRAFT", variants: [{ price: row.price || "0.00" }] } }
      });
      const createData = await createRes.json();
      const productId = createData.data?.productCreate?.product?.id;
      if (!productId) { results.push({ error: "Product create failed" }); continue; }

      const keysList = [
        ...ROCKHOUND_FIELDS.map(f => f.key),
        "origin_story", "honest_flaws_and_character"
      ];

      const allValues = { ...sharedFields, ...row };
      const metafields = keysList
        .filter(key => allValues[key] && allValues[key].toString().trim() !== "")
        .map(key => ({ namespace: "custom", key, type: "single_line_text_field", value: allValues[key].toString().trim(), ownerId: productId }));

      const chunks = chunkArray(metafields, 10);
      for (const chunk of chunks) {
        await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields: chunk } });
        await new Promise(r => setTimeout(r, 300));
      }

      const collectionId = COLLECTION_MAP[sharedFields.collection_location];
      if (collectionId) {
        await admin.graphql(COLLECTION_ADD_PRODUCTS_MUTATION, {
          variables: { id: collectionId, productIds: [productId] }
        });
      }

      results.push({ productId });
    }

    return json({ success: true, intent: "createProduct", createdCount: results.filter(r => r.productId).length });
  }

  if (intent === "saveProduct" || intent === "saveMetafields") {
    try {
      const FIELD_TYPE_MAP = {
        is_one_of_a_kind: "single_line_text_field",
        treated: "single_line_text_field",
        setting_ready: "single_line_text_field",
        bail_included: "single_line_text_field",
        found_object: "single_line_text_field",
        secondary_colors: "single_line_text_field",
        character_marks: "single_line_text_field",
      };

      let metafieldsToSet = [];
      const rawPayload = formData.get("payload") || formData.get("metafields");

      if (rawPayload) {
        metafieldsToSet = JSON.parse(rawPayload);
      } else {
        const productId = formData.get("productId");
        if (!productId) {
          return json({ success: false, error: "Save failed", details: [{ message: "No product ID provided" }] });
        }
        
        const formatId = productId.includes("gid://") ? productId : `gid://shopify/Product/${productId}`;
        
        const keysList = [
          ...ROCKHOUND_FIELDS.map(f => f.key),
          "origin_story"
        ];

        keysList.forEach(key => {
          const val = formData.get(key);
          if (val && val.toString().trim() !== "") {
            metafieldsToSet.push({
              ownerId: formatId,
              namespace: "rockhound",
              key: key,
              value: val.toString().trim()
            });
          }
        });
      }

      // >>> TYPE RECONCILIATION & FORMATTING PASS <<<
      const CUSTOM_KEYS = [
        "primary_medium", "stone_family", "collection_name", "treated",
        "found_object", "cut_and_shape", "origin_story", "honest_flaws_and_character"
      ];

      metafieldsToSet = metafieldsToSet.map(mf => {
        const fieldType = FIELD_TYPE_MAP[mf.key] || mf.type || "single_line_text_field";
        let fieldValue = String(mf.value).trim();

        if (fieldType === "boolean") {
          const lowerVal = fieldValue.toLowerCase();
          fieldValue = (lowerVal === "true" || lowerVal === "1" || lowerVal === "yes") ? "true" : "false";
        } else if (fieldType === "list.single_line_text_field") {
          let listVal = fieldValue;
          try {
            const parsed = JSON.parse(listVal);
            if (Array.isArray(parsed)) {
              const unwrapped = parsed.map(item => {
                try {
                  const inner = JSON.parse(item);
                  return Array.isArray(inner) ? inner[0] : inner;
                } catch {
                  return item;
                }
              });
              listVal = JSON.stringify(unwrapped);
            }
          } catch {
            listVal = JSON.stringify([listVal]);
          }
          fieldValue = listVal;
        }

        return {
          ...mf,
          namespace: CUSTOM_KEYS.includes(mf.key) ? "custom" : (mf.namespace || "rockhound"),
          type: fieldType,
          value: fieldValue
        };
      });

      if (metafieldsToSet.length === 0) {
        return json({ success: false, error: "Save failed", details: [{ message: "No populated fields to save" }] });
      }

      const chunks = chunkArray(metafieldsToSet, 10);
      let userErrors = [];

      for (const chunk of chunks) {
        const res = await admin.graphql(SET_METAFIELDS_MUTATION, {
          variables: { metafields: chunk }
        });
        const resData = await res.json();
        
        console.log("=== SAVE CHUNK DEBUG ===");
        console.log("Chunk being sent:", JSON.stringify(chunk, null, 2));
        console.log("GraphQL response:", JSON.stringify(resData, null, 2));
        console.log("userErrors:", JSON.stringify(resData?.data?.metafieldsSet?.userErrors, null, 2));
        console.log("=== END CHUNK DEBUG ===");
        
        const errors = resData.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) {
          userErrors = userErrors.concat(errors);
        }
        
        await new Promise(r => setTimeout(r, 300));
      }

      if (userErrors.length > 0) {
        return json({ success: false, error: "Save failed", details: userErrors });
      }

      return json({ success: true, intent: intent });
    } catch (error) {
      console.error("Save Product Exception Caught:", error);
      return json({ success: false, error: "Save failed", details: [{ message: error.message }] });
    }
  }

  if (intent === "generateSEO") {
    let geminiStatus = 0;
    let rawTextOutput = "";
    try {
      const rawPayload = formData.get("formData");
      if (!rawPayload) return json({ success: false, error: "No data received" });
      
      const { title, instructions } = JSON.parse(rawPayload);
      const promptText = `${instructions}\n\nProduct Title: ${title}`;

      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }]
          })
        }
      );

      geminiStatus = geminiRes.status;

      if (!geminiRes.ok) {
        const errorBody = await geminiRes.text();
        console.error("Gemini API Error Status:", geminiStatus, "Body:", errorBody);
        return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: errorBody });
      }

      const geminiData = await geminiRes.json();
      const textContent = geminiData.candidates[0]?.content?.parts[0]?.text || "";
      rawTextOutput = textContent;
      
      return json({ success: true, intent: "generateSEO", seoDescription: textContent.trim(), text: textContent.trim() });
    } catch (error) {
      console.error("Gemini GenerateSEO Exception Caught:", error);
      return json({ success: false, error: "Gemini generation failed", status: geminiStatus, raw: rawTextOutput || error.message });
    }
  }

  function unwrapArrayValue(val) {
    if (!val) return "";
    try { const parsed = JSON.parse(val); if (Array.isArray(parsed)) return parsed[0] || ""; } catch(e) {}
    return val;
  }

  const resolveColorValue = (val) => {
    if (!val) return "";
    if (val.startsWith("gid://")) return "";
    return val;
  };

  if (intent === "smartAutoFill") {
    let geminiStatus = 0;
    let rawTextOutput = "";
    try {
      const productId = formData.get("productId");
      if (!productId) return json({ success: false, error: "No product ID" });
      
      const res = await admin.graphql(
        "query GetProduct($id: ID!) { product(id: $id) { title descriptionHtml customMeta: metafields(first: 50, namespace: \"custom\") { edges { node { namespace key value } } } rockhoundMeta: metafields(first: 50, namespace: \"rockhound\") { edges { node { namespace key value } } } geoMeta: metafields(first: 50, namespace: \"geo\") { edges { node { namespace key value } } } } }",
        { variables: { id: productId } }
      );
      
      const resData = await res.json();
      const product = resData.data?.product || {};
      const productTitle = product.title || "";
      const productDescription = product.descriptionHtml || "";
      const promptStyle = formData.get("promptStyle") || "";
      const fetchedMetafields = [
        ...(product.customMeta?.edges || []),
        ...(product.rockhoundMeta?.edges || []),
        ...(product.geoMeta?.edges || []),
      ].map(e => e.node);

      const promptText = [
        "You are a data extraction assistant. Parse the following product title and description and return a JSON object mapping these exact keys to their best-guess values extracted from the text.",
        "",
        "Keys to map: piece_name, primary_medium, secondary_medium, handcrafted_by, material, stone_family, color, cut_and_shape, surface_finish, dimensions_mm, weight_grams, collection_name, collection_location, collection_date, primary_use, setting_ready, bail_included, is_one_of_a_kind, treated, found_object, wire_material, artist_notes, origin_story, honest_flaws, honest_flaws_and_character.",
        "Required keys: ensure 'color' and 'cut_and_shape' are always included in the JSON output schema.",
        "",
        "Specific Key Instructions:",
        "- piece_name: the individual name of this stone piece, e.g. The Pine Tree",
        "- stone_family: the rockhound trade name of the stone — use Labradorite not Feldspar, use Jasper not Chalcedony, use Obsidian not Volcanic Glass. Extract from the title or description.",
        "- color: look for a line in the description that starts with \"Flash:\" and extract the color word after it. Example: \"Flash: Blue\" → return \"Blue\".",
        "- cut_and_shape: look for a line in the description that starts with \"Shape:\" and extract the shape word or phrase after it. Example: \"Shape: Freeform Cabochon\" → return \"Freeform Cabochon\".",
        "- surface_finish: extract the value after the label 'Finish:' in the description. Example: 'Finish: High Polish' → return 'High Polish'. Do not force into a fixed list.",
        "- handcrafted_by: extract the maker signature from the description. Look for 'Bob & Janyce' or 'Rockhound Studio'. Return 'Bob & Janyce, Rockhound Studio' if found.",
        "- origin_story: the narrative story of how the stone was found and crafted — this is the primary story field",
        "- honest_flaws: Any character marks, inclusions, matrix, or natural flaws observed — plain text description.",
        "- artist_notes: the lapidary process notes — how it was cut, shaped, and finished",
        "- honest_flaws_and_character: copy of honest_flaws for the Full Meta Report",
        "- treated: if the description says untreated, not enhanced, or not dyed, return 'false'. Otherwise return 'true'.",
        "- found_object: if the description says found, collected, or field collected, return 'true'. Otherwise return 'false'.",
        "- is_one_of_a_kind: if the description says one of a kind, return 'Yes — one of a kind'. Otherwise return 'No'.",
        "",
        "If a value cannot be confidently determined from the text, leave the string empty (\"\").",
        "Return ONLY valid JSON with no markdown formatting.",
        "",
        "Style Guidelines to follow while extracting or formatting fields: " + promptStyle,
        "",
        "Title: " + productTitle,
        "Description: " + productDescription
      ].join("\n");

      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }]
              }
            ],
            generationConfig: {
              response_mime_type: "application/json",
            }
          })
        }
      );

      geminiStatus = geminiRes.status;

      if (!geminiRes.ok) {
        const errorBody = await geminiRes.text();
        console.error("Gemini API Error Status:", geminiStatus, "Body:", errorBody);
        return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: errorBody });
      }

      const geminiData = await geminiRes.json();
      const textContent = geminiData.candidates[0]?.content?.parts[0]?.text || "";
      rawTextOutput = textContent;
      
      let cleanJson = textContent.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      }

      const parsedValues = JSON.parse(cleanJson);
      
      const materialName = parsedValues.material || "";
      
      if (materialName) {
        const stoneProfile = await prisma.stoneProfile.findFirst({
          where: {
            stoneName: {
              equals: materialName,
              mode: 'insensitive'
            }
          }
        });

        if (stoneProfile) {
          const geoFieldsToInject = [
            "baseMineralName", "colorPattern", "authenticity", "rarity",
            "crystalSystem", "geologicalEra", "mineralClass", "rockComposition",
            "rockFormation", "hardness", "luster", "fracture", "cleavage",
            "specificGravity", "diaphaneity"
          ];

          const formatId = productId.includes("gid://") ? productId : `gid://shopify/Product/${productId}`;
          const geoMetafieldsToSet = [];

          geoFieldsToInject.forEach(key => {
            const val = stoneProfile[key];
            if (val !== null && val !== undefined && val.toString().trim() !== "") {
              geoMetafieldsToSet.push({
                ownerId: formatId,
                namespace: "geo",
                key: key,
                value: val.toString().trim(),
                type: "single_line_text_field"
              });
            }
          });

          if (geoMetafieldsToSet.length > 0) {
            const chunks = chunkArray(geoMetafieldsToSet, 10);
            for (const chunk of chunks) {
              await admin.graphql(SET_METAFIELDS_MUTATION, {
                variables: { metafields: chunk }
              });
              await new Promise(r => setTimeout(r, 300));
            }
          }
        }
      }

      const customMeta = {};
      const rockhoundMeta = {};
      fetchedMetafields.forEach(m => {
        if (m.namespace === "custom") {
          customMeta[m.key] = m.value;
        } else if (m.namespace === "rockhound") {
          rockhoundMeta[m.key] = m.value;
        }
      });

      if (!parsedValues.color || parsedValues.color.trim() === "") {
        if (customMeta.primary_color) parsedValues.color = customMeta.primary_color;
      }
      if (!parsedValues.cut_and_shape || parsedValues.cut_and_shape.trim() === "") {
        if (customMeta.cut_type) parsedValues.cut_and_shape = customMeta.cut_type;
      }
      if (!parsedValues.origin_story || parsedValues.origin_story.trim() === "") {
        if (customMeta.stone_story) parsedValues.origin_story = customMeta.stone_story;
      }
      if (!parsedValues.honest_flaws_and_character || parsedValues.honest_flaws_and_character.trim() === "") {
        if (customMeta.character_marks) parsedValues.honest_flaws_and_character = customMeta.character_marks;
      }
      if (!parsedValues.handcrafted_by || parsedValues.handcrafted_by.trim() === "" || parsedValues.handcrafted_by === "Robert") {
        parsedValues.handcrafted_by = "Bob & Janyce, Rockhound Studio";
      }

      return json({ 
        success: true, 
        intent: "smartAutoFill", 
        fields: parsedValues,
        autoFillData: parsedValues,
        fullMetaFields: {
          color: resolveColorValue(rockhoundMeta.primary_color) || resolveColorValue(customMeta.primary_color) || rockhoundMeta.primary_color || customMeta.primary_color || "",
          cut_and_shape: customMeta.cut_and_shape || customMeta.cut_type || "",
          origin_story: customMeta.origin_story || customMeta.stone_story || "",
          honest_flaws_and_character: customMeta.honest_flaws_and_character || customMeta.character_marks || "",
          handcrafted_by: "Bob & Janyce, Rockhound Studio",
          is_one_of_a_kind: rockhoundMeta.is_one_of_a_kind === "true" || rockhoundMeta.is_ooak === "true" ? "Yes — one of a kind" : "No",
          treated: customMeta.treated === "true" ? "Yes" : customMeta.treated === "false" ? "No" : customMeta.treatment_status ? (customMeta.treatment_status.toLowerCase().includes("untreated") ? "No" : "Yes") : "",
          found_object: customMeta.found_object === "true" ? "Yes" : customMeta.found_object === "false" ? "No" : "",
          primary_medium: customMeta.primary_medium || "",
          stone_family: customMeta.stone_family || "",
          material: rockhoundMeta.material || customMeta.official_name || "",
          surface_finish: rockhoundMeta.surface_finish || customMeta.surface_finish || parsedValues.surface_finish || "",
          dimensions_mm: rockhoundMeta.dimensions_mm || customMeta.dimensions_mm || parsedValues.dimensions_mm || "",
          artist_notes: rockhoundMeta.artist_notes || customMeta.artist_notes || "",
          collection_name: customMeta.collection_name || ""
        },
        overwriteFields: {
          color: parsedValues.color || "",
          cut_and_shape: parsedValues.cut_and_shape || "",
          surface_finish: parsedValues.surface_finish || "",
          stone_family: parsedValues.stone_family || "",
          handcrafted_by: parsedValues.handcrafted_by || "",
          treated: parsedValues.treated || "",
          found_object: parsedValues.found_object || "",
          is_one_of_a_kind: parsedValues.is_one_of_a_kind || ""
        }
      });
    } catch (error) {
      console.error("Gemini SmartAutoFill Exception Caught:", error);
      return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: rawTextOutput || error.message });
    }
  }

  if (intent === "autoFill") {
    let geminiStatus = 0;
    let rawTextOutput = "";
    try {
      const productId = formData.get("productId");
      const productTitle = formData.get("productTitle") || "";
      const productDescription = formData.get("productDescription") || "";
      const promptStyle = formData.get("promptStyle") || "";

      const promptText = [
        "You are a data extraction assistant. Parse the following product title and description and return a JSON object mapping these exact keys to their best-guess values extracted from the text.",
        "",
        "Keys to map: piece_name, primary_medium, secondary_medium, handcrafted_by, material, stone_family, color, cut_and_shape, surface_finish, dimensions_mm, weight_grams, collection_name, collection_location, collection_date, primary_use, setting_ready, bail_included, is_one_of_a_kind, treated, found_object, wire_material, artist_notes, origin_story, honest_flaws, honest_flaws_and_character.",
        "Required keys: ensure 'color' and 'cut_and_shape' are always included in the JSON output schema.",
        "",
        "Specific Key Instructions:",
        "- piece_name: the individual name of this stone piece, e.g. The Pine Tree",
        "- stone_family: the rockhound trade name of the stone — use Labradorite not Feldspar, use Jasper not Chalcedony, use Obsidian not Volcanic Glass. Extract from the title or description.",
        "- color: look for a line in the description that starts with \"Flash:\" and extract the color word after it. Example: \"Flash: Blue\" → return \"Blue\".",
        "- cut_and_shape: look for a line in the description that starts with \"Shape:\" and extract the shape word or phrase after it. Example: \"Shape: Freeform Cabochon\" → return \"Freeform Cabochon\".",
        "- surface_finish: extract the value after the label 'Finish:' in the description. Example: 'Finish: High Polish' → return 'High Polish'. Do not force into a fixed list.",
        "- handcrafted_by: extract the maker signature from the description. Look for 'Bob & Janyce' or 'Rockhound Studio'. Return 'Bob & Janyce, Rockhound Studio' if found.",
        "- origin_story: the narrative story of how the stone was found and crafted — this is the primary story field",
        "- honest_flaws: Any character marks, inclusions, matrix, or natural flaws observed — plain text description.",
        "- artist_notes: the lapidary process notes — how it was cut, shaped, and finished",
        "- honest_flaws_and_character: copy of honest_flaws for the Full Meta Report",
        "- treated: if the description says untreated, not enhanced, or not dyed, return 'false'. Otherwise return 'true'.",
        "- found_object: if the description says found, collected, or field collected, return 'true'. Otherwise return 'false'.",
        "- is_one_of_a_kind: if the description says one of a kind, return 'Yes — one of a kind'. Otherwise return 'No'.",
        "",
        "If a value cannot be confidently determined from the text, leave the string empty (\"\").",
        "Return ONLY valid JSON with no markdown formatting.",
        "",
        "Style Guidelines to follow while extracting or formatting fields: " + promptStyle,
        "",
        "Title: " + productTitle,
        "Description: " + productDescription
      ].join("\n");

      const geminiRes = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: promptText }]
              }
            ],
            generationConfig: {
              response_mime_type: "application/json",
            }
          })
        }
      );

      geminiStatus = geminiRes.status;

      if (!geminiRes.ok) {
        const errorBody = await geminiRes.text();
        console.error("Gemini API Error Status:", geminiStatus, "Body:", errorBody);
        return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: errorBody });
      }

      const geminiData = await geminiRes.json();
      const textContent = geminiData.candidates[0]?.content?.parts[0]?.text || "";
      rawTextOutput = textContent;

      let cleanJson = textContent.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      }

      const parsedValues = JSON.parse(cleanJson);

      let geoFields = {};
      const materialName = parsedValues.material || "";

      if (materialName) {
        const stoneProfile = await prisma.stoneProfile.findFirst({
          where: {
            stoneName: {
              contains: materialName,
              mode: 'insensitive'
            }
          }
        });

        if (stoneProfile) {
          const geoKeysToExtract = [
            "baseMineralName", "colorPattern", "authenticity", "rarity",
            "crystalSystem", "geologicalEra", "mineralClass", "rockComposition",
            "rockFormation", "hardness", "luster", "fracture", "cleavage",
            "specificGravity", "diaphaneity"
          ];

          geoKeysToExtract.forEach(key => {
            const val = stoneProfile[key];
            if (val !== null && val !== undefined && val.toString().trim() !== "") {
              geoFields[key] = val.toString().trim();
            }
          });
        }
      }

      if (parsedValues.honest_flaws) {
        parsedValues.honest_flaws_and_character = parsedValues.honest_flaws;
      }
      
      const res = await admin.graphql(
        "query GetProduct($id: ID!) { product(id: $id) { title descriptionHtml customMeta: metafields(first: 50, namespace: \"custom\") { edges { node { namespace key value } } } rockhoundMeta: metafields(first: 50, namespace: \"rockhound\") { edges { node { namespace key value } } } geoMeta: metafields(first: 50, namespace: \"geo\") { edges { node { namespace key value } } } } }",
        { variables: { id: productId } }
      );
      const resData = await res.json();
      const fetchedMetafields = [
        ...(resData.data?.product?.customMeta?.edges || []),
        ...(resData.data?.product?.rockhoundMeta?.edges || []),
        ...(resData.data?.product?.geoMeta?.edges || []),
      ].map(e => e.node);

      const customMeta = {};
      const rockhoundMeta = {};
      fetchedMetafields.forEach(m => {
        if (m.namespace === "custom") {
          customMeta[m.key] = m.value;
        } else if (m.namespace === "rockhound") {
          rockhoundMeta[m.key] = m.value;
        }
      });

      if (!parsedValues.color || parsedValues.color.trim() === "") {
        if (customMeta.primary_color) parsedValues.color = customMeta.primary_color;
      }
      if (!parsedValues.cut_and_shape || parsedValues.cut_and_shape.trim() === "") {
        if (customMeta.cut_type) parsedValues.cut_and_shape = customMeta.cut_type;
      }
      if (!parsedValues.origin_story || parsedValues.origin_story.trim() === "") {
        if (customMeta.stone_story) parsedValues.origin_story = customMeta.stone_story;
      }
      if (!parsedValues.honest_flaws_and_character || parsedValues.honest_flaws_and_character.trim() === "") {
        if (customMeta.character_marks) parsedValues.honest_flaws_and_character = customMeta.character_marks;
      }
      if (!parsedValues.handcrafted_by || parsedValues.handcrafted_by.trim() === "" || parsedValues.handcrafted_by === "Robert") {
        parsedValues.handcrafted_by = "Bob & Janyce, Rockhound Studio";
      }

      return json({ 
        success: true, 
        intent: "autoFill", 
        fields: parsedValues,
        autoFillData: parsedValues,
        geoFields,
        fullMetaFields: {
          color: resolveColorValue(rockhoundMeta.primary_color) || resolveColorValue(customMeta.primary_color) || rockhoundMeta.primary_color || customMeta.primary_color || "",
          cut_and_shape: customMeta.cut_and_shape || customMeta.cut_type || "",
          origin_story: customMeta.origin_story || customMeta.stone_story || "",
          honest_flaws_and_character: customMeta.honest_flaws_and_character || customMeta.character_marks || "",
          handcrafted_by: "Bob & Janyce, Rockhound Studio",
          is_one_of_a_kind: rockhoundMeta.is_one_of_a_kind === "true" || rockhoundMeta.is_ooak === "true" ? "Yes — one of a kind" : "No",
          treated: customMeta.treated === "true" ? "Yes" : customMeta.treated === "false" ? "No" : customMeta.treatment_status ? (customMeta.treatment_status.toLowerCase().includes("untreated") ? "No" : "Yes") : "",
          found_object: customMeta.found_object === "true" ? "Yes" : customMeta.found_object === "false" ? "No" : "",
          primary_medium: customMeta.primary_medium || "",
          stone_family: customMeta.stone_family || "",
          material: rockhoundMeta.material || customMeta.official_name || "",
          surface_finish: rockhoundMeta.surface_finish || customMeta.surface_finish || "",
          dimensions_mm: rockhoundMeta.dimensions_mm || customMeta.dimensions_mm || "",
          artist_notes: rockhoundMeta.artist_notes || customMeta.artist_notes || "",
          collection_name: customMeta.collection_name || ""
        },
        overwriteFields: {
          color: parsedValues.color || "",
          cut_and_shape: parsedValues.cut_and_shape || "",
          surface_finish: parsedValues.surface_finish || "",
          stone_family: parsedValues.stone_family || "",
          handcrafted_by: parsedValues.handcrafted_by || "",
          treated: parsedValues.treated || "",
          found_object: parsedValues.found_object || "",
          is_one_of_a_kind: parsedValues.is_one_of_a_kind || ""
        }
      });
    } catch (error) {
      console.error("Gemini AutoFill Exception Caught:", error);
      return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: rawTextOutput || error.message });
    }
  }

  if (intent === "tab2AutoFill") {
    return json({ success: true, intent: "tab2AutoFill" });
  }

  return json({ success: false, error: "Unknown intent" });
}

export default function MigrateDataRoute() {
  const navigate = useNavigate();
  const migrateFetcher = useFetcher();
  const standardizeFetcher = useFetcher();
  const shopify = typeof window !== "undefined" ? window.shopify : undefined;

  const isMigrating = migrateFetcher.state !== "idle";
  const isStandardizing = standardizeFetcher.state !== "idle";
  const migrateData = migrateFetcher.data;
  const standardizeData = standardizeFetcher.data;

  const handleRunMigration = () => {
    migrateFetcher.submit({ intent: "migrate" }, { method: "post" });
  };

  const handleStandardize = () => {
    standardizeFetcher.submit({ intent: "standardizeOneOfAKind" }, { method: "post" });
  };

  useEffect(() => {
    if (migrateFetcher.state === "idle" && migrateData && migrateData.results) {
      if (shopify) {
        const hasErrors = migrateData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Migration finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Successfully migrated ${migrateData.fieldsMigrated} fields!`);
        }
      }
    }
  }, [migrateFetcher.state, migrateData, shopify]);

  useEffect(() => {
    if (standardizeFetcher.state === "idle" && standardizeData && standardizeData.results) {
      if (shopify) {
        const hasErrors = standardizeData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Standardize finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Done. ${standardizeData.fixed} products updated.`);
        }
      }
    }
  }, [standardizeFetcher.state, standardizeData, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success") return <span style={{ color: "#2E7D32" }}>✅</span>;
    return <span style={{ color: "#C62828" }}>❌</span>;
  };

  return (
    <Page
      title="Data Migration Engine"
      subtitle="Rockhound Studio Legacy Data Importer"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            <Banner tone="info" title="The Data Bundling Strategy">
              <p>
                This script safely grabs your old science fields (Mohs, cleavage, diaphaneity, etc.) and bundles them into a clean <b>Shop Specs</b> text string inside the new <b>Artist Notes</b> field. This keeps Google happy with keywords without forcing you to manage useless fields manually.
              </p>
            </Banner>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Run Legacy Migration</Text>
                <Text as="p">
                  Clicking this button will scan your products, map the old data over to the new Freeform Revolution schema, and build the Shop Specs bundles.
                  (It is safe to run multiple times — it will just overwrite the new fields with the exact same legacy data).
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleRunMigration}
                      loading={isMigrating}
                      accessibilityLabel="Run Data Migration"
                    >
                      {isMigrating ? "Scanning and Migrating Data..." : "Run Auto-Migration"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {migrateData && migrateData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Migration Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {migrateData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
                        <StatusIcon status={result.status} />
                        <Text as="span" tone={result.status === "error" ? "critical" : "base"}>
                          {result.message}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Standardize One of a Kind Values</Text>
                <Text as="p">
                  Finds every product where is_one_of_a_kind is set to "true" and updates it to "Yes — one of a kind" for consistent SEO and storefront display.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleStandardize}
                      loading={isStandardizing}
                      accessibilityLabel="Standardize One of a Kind Values"
                    >
                      {isStandardizing ? "Standardizing..." : "Standardize One of a Kind Values"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {standardizeData && standardizeData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Standardize Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {standardizeData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
                        <StatusIcon status={result.status} />
                        <Text as="span" tone={result.status === "error" ? "critical" : "base"}>
                          {result.message}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
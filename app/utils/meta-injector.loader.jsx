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
          metafields(first: 50) {
            edges {
              node {
                namespace
                key
                value
                type
              }
            }
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
  if (data && data.products) return data.products.edges.map(edge => edge.node);
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

  if (intent === "saveProduct") {
    try {
      let metafieldsToSet = [];
      const rawPayload = formData.get("payload");

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
              value: val.toString().trim(),
              type: "single_line_text_field"
            });
          }
        });
      }

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
        
        const errors = resData.data?.metafieldsSet?.userErrors || [];
        if (errors.length > 0) {
          userErrors = userErrors.concat(errors);
        }
        
        await new Promise(r => setTimeout(r, 300));
      }

      if (userErrors.length > 0) {
        return json({ success: false, error: "Save failed", details: userErrors });
      }

      return json({ success: true, intent: "saveProduct" });
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

  if (intent === "smartAutoFill") {
    let geminiStatus = 0;
    let rawTextOutput = "";
    try {
      const productId = formData.get("productId");
      if (!productId) return json({ success: false, error: "No product ID" });
      
      const res = await admin.graphql(
        "query GetProduct($id: ID!) { product(id: $id) { title descriptionHtml } }",
        { variables: { id: productId } }
      );
      
      const resData = await res.json();
      const product = resData.data?.product || {};
      const productTitle = product.title || "";
      const productDescription = product.descriptionHtml || "";
      const promptStyle = formData.get("promptStyle") || "";

      const promptText = [
        "You are a data extraction assistant. Parse the following product title and description and return a JSON object mapping these exact keys to their best-guess values extracted from the text.",
        "",
        "Keys to map: piece_name, primary_medium, secondary_medium, handcrafted_by, material, stone_family, color, cut_and_shape, surface_finish, dimensions_mm, weight_grams, collection_name, collection_location, collection_date, primary_use, setting_ready, bail_included, is_one_of_a_kind, treated, found_object, wire_material, artist_notes.",
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
      
      console.log("Gemini SmartAutoFill Raw Output textContent:", textContent);

      let cleanJson = textContent.trim();
      const firstBrace = cleanJson.indexOf('{');
      const lastBrace = cleanJson.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        cleanJson = cleanJson.slice(firstBrace, lastBrace + 1);
      }

      const parsedValues = JSON.parse(cleanJson);

      // >>> DATABASE LOOKUP & GEO NAMESPACE INJECTION <<<
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
            console.log(`Successfully injected ${geoMetafieldsToSet.length} geo metafields for material: ${materialName}`);
          }
        }
      }

      return json({ 
        success: true, 
        intent: "smartAutoFill", 
        fields: parsedValues,
        autoFillData: parsedValues 
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
      const productTitle = formData.get("productTitle") || "";
      const productDescription = formData.get("productDescription") || "";
      const promptStyle = formData.get("promptStyle") || "";

      const promptText = [
        "You are a data extraction assistant. Parse the following product title and description and return a JSON object mapping these exact keys to their best-guess values extracted from the text.",
        "",
        "Keys to map: piece_name, primary_medium, secondary_medium, handcrafted_by, material, stone_family, color, cut_and_shape, surface_finish, dimensions_mm, weight_grams, collection_name, collection_location, collection_date, primary_use, setting_ready, bail_included, is_one_of_a_kind, treated, found_object, wire_material, artist_notes.",
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

      console.log("Gemini AutoFill Raw Output textContent:", textContent);

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

      return json({ 
        success: true, 
        intent: "autoFill", 
        fields: parsedValues,
        autoFillData: parsedValues,
        geoFields
      });
    } catch (error) {
      console.error("Gemini AutoFill Exception Caught:", error);
      return json({ success: false, error: "Gemini parse failed", status: geminiStatus, raw: rawTextOutput || error.message });
    }
  }

  return json({ success: false, error: "Unknown intent" });
}
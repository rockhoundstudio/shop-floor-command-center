import { data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function extractStoneName(title) {
  const knownStones = ["Jasper", "Agate", "Amethyst", "Quartz", "Turquoise", "Obsidian", "Jade", "Opal"];
  const upperTitle = title.toUpperCase();
  for (const stone of knownStones) {
    if (upperTitle.includes(stone.toUpperCase())) {
      return stone;
    }
  }
  return "Unknown";
}

function normalizeMetafieldValue(key, value) {
  let val = String(value);

  // 1. STRIP ⚠️ EMOJI PREFIX
  if (val.startsWith("⚠️ ")) {
    val = val.replace(/^⚠️\s*/, "");
  }

  // 2. NORMALIZE BOOLEAN-STYLE FIELDS
  const booleanKeys = [
    "is_ooak", "is_one_of_a_kind", "found_object", 
    "custom_product", "setting_ready", "bail_included", "treated"
  ];
  if (booleanKeys.includes(key)) {
    if (val.toLowerCase() === "true") val = "Yes";
    else if (val.toLowerCase() === "false") val = "No";
  }

  return val;
}

function applyOriginOverridesBeforeApi(title, metafieldsArray) {
  if (!title || typeof title !== "string") return metafieldsArray;
  
  const segments = title.split(/\s*—\s*/);
  if (segments.length < 3) return metafieldsArray;

  const middleSegment = segments[1].trim();
  let override = null;

  if (middleSegment === "Richardson's Rock Ranch") {
    override = { origin_handle: "the-richardson-strike", origin_page_handle: "the-shopped-rock" };
  } else if (middleSegment === "Yakima River Canyon" || middleSegment === "Yakima Canyon") {
    override = { origin_handle: "the-shop-lore-chert-road-detour-yakima-river-jasper", origin_page_handle: "the-shop-lore-chert-road-detour-yakima-river-jasper" };
  } else if (middleSegment === "Yellowstone River" || middleSegment === "Seven Sisters") {
    override = { origin_handle: "the-yellowstone-river", origin_page_handle: "the-yellowstone-river" };
  } else if (middleSegment === "Rufus" || middleSegment === "Rufus Serpentine") {
    override = { origin_handle: "the-rufus-protocol", origin_page_handle: "the-rufus-protocol" };
  } else if (middleSegment === "Nickel Back") {
    override = { origin_handle: "the-nickel-back-collection", origin_page_handle: "the-nickel-back-collection" };
  } else if (middleSegment === "North Fork CdA") {
    override = { origin_handle: "north-fork-cda-collection", origin_page_handle: "north-fork-cda-collection" };
  } else if (middleSegment === "Spokane River" || middleSegment === "Stateline") {
    override = { origin_handle: "spokane-river-stateline", origin_page_handle: "spokane-river-stateline" };
  }

  if (override) {
    const ownerId = metafieldsArray.length > 0 ? metafieldsArray[0].ownerId : null;
    if (!ownerId) return metafieldsArray;

    let newMetafields = metafieldsArray.filter(m => m.key !== "origin_handle" && m.key !== "origin_page_handle");
    newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_handle", type: "single_line_text_field", value: override.origin_handle });
    newMetafields.push({ ownerId: ownerId, namespace: "custom", key: "origin_page_handle", type: "single_line_text_field", value: override.origin_page_handle });
    return newMetafields;
  }
  return metafieldsArray;
}

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field",
  origin_location: "single_line_text_field",
  geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field",
  official_name: "single_line_text_field",
  mineral_class: "single_line_text_field",
  crystal_system: "single_line_text_field",
  luster: "single_line_text_field",
  rock_composition: "single_line_text_field",
  specific_gravity: "single_line_text_field",
  fracture_pattern: "single_line_text_field",
  cleavage: "single_line_text_field",
  tenacity: "single_line_text_field",
  geological_era: "single_line_text_field",
  rock_formation: "single_line_text_field",
  primary_color: "single_line_text_field",
  diaphaneity: "single_line_text_field",
  character_marks: "list.single_line_text_field",
  dimensions_mm: "single_line_text_field",
  cut_type: "single_line_text_field",
  bench_notes: "single_line_text_field",
  stone_shape: "single_line_text_field",
  surface_finish: "single_line_text_field",
  treatment_status: "single_line_text_field",
  secondary_colors: "single_line_text_field",
  base_stone_type: "single_line_text_field",
  hardness: "single_line_text_field",
  origin_story: "single_line_text_field",
  honest_flaws: "single_line_text_field",
  honest_flaws_and_character: "single_line_text_field",
  primary_medium: "single_line_text_field",
  piece_name: "single_line_text_field",
  stone_family: "single_line_text_field",
  collection_name: "single_line_text_field",
  collection_location: "single_line_text_field",
  origin_handle: "single_line_text_field",
  origin_page_handle: "single_line_text_field",
  cut_and_shape: "single_line_text_field",
  color_pattern: "single_line_text_field",
  generated_description: "single_line_text_field",
  primary_use: "single_line_text_field",
  weight_grams: "number_decimal",
  shipping_weight_oz: "number_decimal",
  handcrafted_by: "single_line_text_field",
  artist_notes: "single_line_text_field",
  alt_text: "single_line_text_field",
  is_ooak: "single_line_text_field",
  found_object: "single_line_text_field",
  custom_product: "single_line_text_field",
  authenticity: "single_line_text_field",
  rarity: "single_line_text_field",
  color: "single_line_text_field",
  setting_ready: "single_line_text_field",
  bail_included: "single_line_text_field",
  wire_material: "single_line_text_field",
  chain_material: "single_line_text_field",
  target_gender: "single_line_text_field",
  age_group: "single_line_text_field",
  condition: "single_line_text_field",
  price: "number_decimal",
  seo_title: "single_line_text_field",
  secondary_medium: "single_line_text_field",
  jewelry_type: "single_line_text_field",
  necklace_design: "single_line_text_field",
  chain_link_type: "single_line_text_field",
  jewelry_finding_type: "single_line_text_field",
  material: "single_line_text_field",
  treated: "single_line_text_field"
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const allFormData = Object.fromEntries(formData);
  console.log("=== INCOMING ACTION FORM DATA ===");
  console.log(JSON.stringify(allFormData, null, 2));
  console.log("=================================");

  // ==========================================
  // 🟢 INTENT 1: AUTO-FILL (Mindat & Cache)
  // ==========================================
  if (intent === "auto_fill_single") {
    const title = formData.get("title");
    const stoneName = extractStoneName(title);

    if (stoneName === "Unknown") {
      return data({ success: false, message: "Could not auto-detect stone type from title. Manual entry required.", fields: {} });
    }

    try {
      let cachedStone = await prisma.stoneCache.findUnique({ where: { stoneName: stoneName } });

      if (!cachedStone) {
        let mohsVal = "Varies";
        (stoneName === "Jasper" || stoneName === "Agate") && (mohsVal = "6.5 - 7");

        const titleSegments = (title || "").split(/\s+[—–-]\s+/);
        const pieceName = titleSegments.length >= 3 ? titleSegments[titleSegments.length - 1].trim() : "";
        const lapidaryData = {
          "mineral_class": "Silicate",
          "mohs_hardness": mohsVal,
          "crystal_system": "Trigonal",
          "primary_color": "Varies by specimen",
          "title_tag": `${stoneName}${pieceName ? ` — ${pieceName}` : ""} — One-of-a-Kind Rockhound Studio`,
          "description_tag": `Natural, one-of-a-kind ${stoneName} handcrafted by Bob and Janyce. Honest flaws, authentic character, and zero workshop fluff.`,
          "google_product_category": "Apparel & Accessories > Jewelry",
          "target_gender": "Unisex",
          "age_group": "adult",
          "condition": "new",
          "geological_age": "Varies by specimen",
          "fracture_pattern": "Varies by specimen",
          "luster": "Varies by specimen",
          "fracture": "Varies by specimen",
          "cleavage": "None",
          "specific_gravity": "Varies by specimen",
          "diaphaneity": "Opaque to Translucent",
          "rock_composition": "Silicified",
          "rock_formation": "Natural"
        };

        cachedStone = await prisma.stoneCache.create({
          data: { stoneName: stoneName, data: JSON.stringify(lapidaryData) }
        });
      }

      return data({ success: true, message: `Loaded data for ${stoneName} from database.`, fields: JSON.parse(cachedStone.data) });
    } catch (error) {
      console.error("Cache Error:", error);
      return data({ success: false, message: "Database connection failed." }, { status: 500 });
    }
  }

  // ==========================================
  // 🔵 INTENT 2: LOCK DATA TO SHOPIFY
  // ==========================================
  if (intent === "saveMetafields") {
    try {
      const rawPayload = formData.get("payload") || formData.get("metafields");
      
      if (!rawPayload) {
        return data({ intent: "saveMetafields", success: false, message: "No data provided to save." });
      }

      let payloadArray = JSON.parse(rawPayload);
      
      payloadArray = payloadArray.filter(item => 
        item.key !== "collectionLocation" && 
        item.key !== "is_one_of_a_kind" &&
        item.key !== "story_theme" 
      );

      let setMetafields = payloadArray
        .filter(item => item.value !== null && String(item.value).trim() !== "")
        .flatMap(item => {
          const fallbackProductId = formData.get("productId");
          const itemOwnerId = item.ownerId || fallbackProductId;
          
          if (!itemOwnerId) throw new Error(`Missing ownerId for field: ${item.key}`);

          let resolvedId = `gid://shopify/Product/${itemOwnerId.split("/").pop()}`;
          if (itemOwnerId.startsWith("gid://")) resolvedId = itemOwnerId;

          const resolvedType = MASTER_TYPE_MAP[item.key] || item.type || "single_line_text_field";
          
          let normalizedValue = normalizeMetafieldValue(item.key, item.value);
          let resolvedValue = normalizedValue.replace(/[—–]/g, '-');
          
          if (resolvedType.startsWith("list.")) resolvedValue = JSON.stringify([normalizedValue]);

          let resolvedNamespace = item.namespace || "custom";
          if (item.key === "is_ooak" || resolvedNamespace === "none" || resolvedNamespace === "") {
            resolvedNamespace = "custom";
          }

          const fieldsToReturn = [];

          if (item.key === "seo_title") {
            fieldsToReturn.push({ ownerId: resolvedId, namespace: "global", key: "title_tag", type: "single_line_text_field", value: resolvedValue });
            fieldsToReturn.push({ ownerId: resolvedId, namespace: "custom", key: "seo_title", type: "single_line_text_field", value: resolvedValue });
          } else if (item.key === "generated_description") {
            fieldsToReturn.push({ ownerId: resolvedId, namespace: "global", key: "description_tag", type: "single_line_text_field", value: resolvedValue.slice(0, 320) });
            fieldsToReturn.push({ ownerId: resolvedId, namespace: resolvedNamespace, key: item.key, type: resolvedType, value: resolvedValue });
          } else if (["age_group", "target_gender", "condition"].includes(item.key)) {
            fieldsToReturn.push({ ownerId: resolvedId, namespace: "google", key: item.key, type: "single_line_text_field", value: resolvedValue });
          } else {
            fieldsToReturn.push({ ownerId: resolvedId, namespace: resolvedNamespace, key: item.key, type: resolvedType, value: resolvedValue });
          }

          return fieldsToReturn;
        });

      // Apply Origin Overrides right before Shopify API call
      const productTitle = formData.get("productTitle");
      if (productTitle) {
        setMetafields = applyOriginOverridesBeforeApi(productTitle, setMetafields);
      }

      if (setMetafields.length === 0) {
        return data({ intent: "saveMetafields", success: true, message: "No fields to save." });
      }

      const chunks = chunkArray(setMetafields, 25);
      const allErrors = [];

      for (const chunk of chunks) {
        const response = await admin.graphql(
          `#graphql
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }`,
          { variables: { metafields: chunk } }
        );
        const result = await response.json();
        allErrors.push(...(result?.data?.metafieldsSet?.userErrors || []));
      }

      if (allErrors.length > 0) {
        return data({ success: false, message: "Saved with errors: " + allErrors.map(e => e.message).join(" | "), errors: allErrors });
      }

      // Base Product Update
      const fallbackProductId = formData.get("productId");
      const newProductTitle = formData.get("productTitle");
      const newDescriptionHtml = formData.get("descriptionHtml");

      if (fallbackProductId && (newProductTitle || newDescriptionHtml)) {
        try {
          const productGid = `gid://shopify/Product/${fallbackProductId.split("/").pop()}`;
          let inputVars = { id: productGid };
          if (newProductTitle) inputVars.title = newProductTitle;
          if (newDescriptionHtml) inputVars.descriptionHtml = newDescriptionHtml;

          await admin.graphql(
            `#graphql
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) { userErrors { field message } }
            }`,
            { variables: { input: inputVars } }
          );
        } catch (titleErr) {
          console.warn("[saveMetafields] Base update failed:", titleErr.message);
        }
      }

      // Variant Weight Update
      const weightItem = payloadArray.find(item => item.key === "weight_grams");
      if (weightItem && weightItem.value) {
        const weightGrams = parseFloat(String(weightItem.value).replace(/['"]/g, ""));
        if (!isNaN(weightGrams) && weightGrams > 0) {
          try {
            let targetProductId = formData.get("productId");
            if (!targetProductId) {
              const fallbackField = payloadArray.find(item => item.ownerId);
              if (fallbackField) targetProductId = fallbackField.ownerId;
            }
            
            if (targetProductId) {
              const productGid = `gid://shopify/Product/${targetProductId.split("/").pop()}`;
              const variantQuery = await admin.graphql(
                `#graphql
                query getDefaultVariant($id: ID!) {
                  product(id: $id) { variants(first: 1) { edges { node { id } } } }
                }`,
                { variables: { id: productGid } }
              );
              const variantData = await variantQuery.json();
              const variantId = variantData?.data?.product?.variants?.edges?.[0]?.node?.id;
              if (variantId) {
                await admin.graphql(
                  `#graphql
                  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                    productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
                  }`,
                  { variables: { productId: productGid, variants: [{ id: variantId, inventoryItem: { measurement: { weight: { value: weightGrams / 28.3495, unit: "OUNCES" } } } }] } }
                );
              }
            }
          } catch (weightErr) {
            console.warn("[saveMetafields] Variant weight update failed:", weightErr.message);
          }
        }
      }

      return data({ intent: "saveMetafields", success: true, message: "All metafields locked in." });
    } catch (error) {
      return data({ intent: "saveMetafields", success: false, error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT 3: CLEAN MALFORMED KEYS
  // ==========================================
  if (intent === "cleanMalformedKeys") {
    const productId = formData.get("productId");
    if (!productId) return data({ success: false, message: "No productId provided." });

    let resolvedId = `gid://shopify/Product/${productId}`;
    if (productId.startsWith("gid://")) resolvedId = productId;

    const lookupResponse = await admin.graphql(
      `#graphql
      query getMetafields($ownerId: ID!) {
        product(id: $ownerId) { metafields(first: 250) { edges { node { id namespace key } } } }
      } `,
      { variables: { ownerId: resolvedId } }
    );

    const lookupResult = await lookupResponse.json();
    const allMeta = lookupResult?.data?.product?.metafields?.edges || [];
    const malformedKeys = ["cut_type", "crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "mohsHardness"];
    
    const toDelete = allMeta.map(e => e.node).filter(m => malformedKeys.includes(m.key));

    if (toDelete.length === 0) return data({ success: true, message: "No malformed keys found. Already clean." });

    const deleteResponse = await admin.graphql(
      `#graphql
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
      } `,
      { variables: { metafields: toDelete.map(m => ({ ownerId: resolvedId, namespace: m.namespace, key: m.key })) } }
    );

    const deleteResult = await deleteResponse.json();
    const deleteErrors = deleteResult?.data?.metafieldsDelete?.userErrors || [];
    const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];

    if (deleteErrors.length > 0) return data({ success: false, message: "Delete had errors.", errors: deleteErrors });

    return data({ success: true, message: `Cleaned ${deleted.length} malformed metafield(s). Re-save the product to write them correctly.`, deleted });
  }

  // ==========================================
  // 🔴 INTENT 3.5: CLEAN ALL CAMEL KEYS (NUCLEAR SWEEP)
  // ==========================================
  if (intent === "cleanAllCamelKeys") {
    try {
      let hasNextPage = true;
      let cursor = null;
      let totalScanned = 0;
      let totalDeleted = 0;

      const customCamelKeys = ["cut_type", "crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "mohsHardness", "hardness", "fracture"];

      while (hasNextPage) {
        const productsResponse = await admin.graphql(
          `#graphql
          query getProductsMetafields($cursor: String) {
            products(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges { node { id metafields(first: 250) { edges { node { id namespace key } } } } }
            }
          }`,
          { variables: { cursor } }
        );

        const productsResult = await productsResponse.json();
        const products = productsResult?.data?.products?.edges || [];

        for (const productEdge of products) {
          totalScanned++;
          const productNode = productEdge.node;
          const allMeta = productNode.metafields?.edges || [];
          
          const toDelete = allMeta.map(e => e.node).filter(m => {
              if (m.namespace === "geo" || m.namespace === "rockhound") return true;
              if (m.namespace === "custom") {
                if (customCamelKeys.includes(m.key)) return true;
                if (m.key.includes("-")) return true;
              }
              return false;
            });

          if (toDelete.length > 0) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                  metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } }
                }`,
                { variables: { metafields: toDelete.map(m => ({ ownerId: productNode.id, namespace: m.namespace, key: m.key })) } }
              );
              const deleteResult = await deleteResponse.json();
              totalDeleted += (deleteResult?.data?.metafieldsDelete?.deletedMetafields || []).length;
            } catch (errors) {}
          }
        }

        hasNextPage = productsResult?.data?.products?.pageInfo?.hasNextPage;
        cursor = productsResult?.data?.products?.pageInfo?.endCursor;
        if (hasNextPage) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return data({ success: true, message: `Nuclear sweep complete. Scanned ${totalScanned} products, deleted ${totalDeleted} ghost metafields.` });
    } catch (error) {
      return data({ success: false, message: "Bulk clean failed", error: error.message });
    }
  }

  // ==========================================
  // INTENT 4: STAGED UPLOAD
  // ==========================================
  if (intent === "stagedUpload") {
    try {
      const file = formData.get("file_0");
      const pieceId = formData.get("pieceId");
      const scanToken = formData.get("scanToken");

      if (!file || !(file instanceof File)) return data({ success: false, intent: "stagedUpload", error: "Missing file_0 binary payload." });

      const uploadResponse = await admin.graphql(
        `#graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets { url resourceUrl parameters { name value } }
            userErrors { field message }
          }
        }`,
        { variables: { input: [{ resource: "IMAGE", filename: file.name || `upload_${Date.now()}.jpg`, mimeType: file.type || "image/jpeg", fileSize: String(file.size), httpMethod: "POST" }] } }
      );

      const uploadResult = await uploadResponse.json();
      const userErrors = uploadResult?.data?.stagedUploadsCreate?.userErrors || [];
      if (userErrors.length > 0) return data({ success: false, intent: "stagedUpload", error: userErrors.map(e => e.message).join(", ") });

      const stagedTargets = uploadResult?.data?.stagedUploadsCreate?.stagedTargets;
      if (!stagedTargets || stagedTargets.length === 0) return data({ success: false, intent: "stagedUpload", error: "No upload target returned from Shopify." });

      const target = stagedTargets[0];
      const s3FormData = new FormData();
      target.parameters.forEach((param) => s3FormData.append(param.name, param.value));

      const arrayBuffer = await file.arrayBuffer();
      const fileBlob = new Blob([arrayBuffer], { type: file.type || "image/jpeg" });
      s3FormData.append("file", fileBlob, file.name || `upload_${Date.now()}.jpg`);

      const s3Response = await fetch(target.url, { method: "POST", body: s3FormData });
      if (!s3Response.ok) return data({ success: false, intent: "stagedUpload", error: `S3 upload failed.` });

      return data({ success: true, intent: "stagedUpload", resourceUrl: target.resourceUrl, pieceId: pieceId, scanToken: scanToken });
    } catch (error) {
      return data({ success: false, intent: "stagedUpload", error: error.message });
    }
  }

  // ==========================================
  // INTENT 5: CREATE PRODUCT
  // ==========================================
  if (intent === "createProduct") {
    try {
      const rawPayload = formData.get("payload");
      if (!rawPayload) return data({ success: false, intent: "createProduct", error: "Missing JSON payload." });

      const payload = JSON.parse(rawPayload);
      let piece = {};
      (payload.pieces && payload.pieces.length > 0) && (piece = payload.pieces[0]);

      const stoneFamily = payload.stone_family || "Unknown Stone";
      const pieceName = piece.piece_name || "New Piece";
      const originLocation = payload.collection_name ? payload.collection_name.replace(/\s+Collection$/i, "").trim() : (payload.origin_location || "Unknown Origin");

      const title = payload.title && !payload.title.includes("Unknown") ? payload.title : `${stoneFamily} — ${originLocation} — ${pieceName}`;
      const descriptionHtml = payload.descriptionHtml || piece.generated_description || piece.descriptionHtml || "";
      const price = String(payload.price || piece.price || "0.00");
      const productType = payload.productType || "Wearable Art";
      const status = payload.status || "DRAFT";

      const allUserErrors = [];

      const seoTitle = payload.seo_title || `${stoneFamily} — ${pieceName} — One-of-a-Kind Rockhound Studio`;
      const createResponse = await admin.graphql(
        `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product { id handle variants(first: 1) { edges { node { id } } } }
            userErrors { field message }
          }
        }`,
        { variables: { input: { title, descriptionHtml, productType, status } } }
      );

      const createResult = await createResponse.json();
      const createErrors = createResult?.data?.productCreate?.userErrors || [];
      (createErrors.length > 0) && allUserErrors.push(...createErrors);

      const createdProduct = createResult?.data?.productCreate?.product;
      if (!createdProduct) return data({ success: false, intent: "createProduct", error: "Product creation failed", userErrors: allUserErrors });

      const productId = createdProduct.id;
      const productHandle = createdProduct.handle;
      const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;

      const seoDescription = payload.descriptionHtml || piece.generated_description || piece.descriptionHtml || "";
      const seoMetafieldsToInject = [];
      if (seoTitle) seoMetafieldsToInject.push({ ownerId: productId, namespace: "global", key: "title_tag", value: seoTitle, type: "single_line_text_field" });
      if (seoDescription) seoMetafieldsToInject.push({ ownerId: productId, namespace: "global", key: "description_tag", value: seoDescription.slice(0, 320), type: "single_line_text_field" });

      if (seoMetafieldsToInject.length > 0) {
        try {
          await admin.graphql(
            `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { metafields { id key } }
            }`,
            { variables: { metafields: seoMetafieldsToInject } }
          );
        } catch (e) {}
      }

      if (price && defaultVariantId) {
        const variantResponse = await admin.graphql(
          `#graphql
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { field message } }
          } `,
          { variables: { productId, variants: [{ id: defaultVariantId, price: price, inventoryItem: { measurement: { weight: { value: parseFloat(payload.weight_grams || piece.weight_grams || 0) / 28.3495, unit: "OUNCES" } } } }] } }
        );
        const variantResult = await variantResponse.json();
        allUserErrors.push(...(variantResult?.data?.productVariantsBulkUpdate?.userErrors || []));
      }

      try {
        const mediaUrlsJson = payload.mediaUrlsJson;
        const mediaUrls = JSON.parse(mediaUrlsJson || "[]");
        const validMediaUrls = mediaUrls.filter(u => typeof u === "string" && u.startsWith("http"));

        if (validMediaUrls.length > 0) {
          const mediaInput = validMediaUrls.map(url => ({ originalSource: url, mediaContentType: "IMAGE" }));
          await new Promise(resolve => setTimeout(resolve, 3000));
          const mediaResponse = await admin.graphql(
            `#graphql
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) { mediaUserErrors { message } }
            }`,
            { variables: { productId, media: mediaInput } }
          );
          const mediaResult = await mediaResponse.json();
          allUserErrors.push(...(mediaResult?.data?.productCreateMedia?.mediaUserErrors || []));
        }
      } catch (e) {}

      if (payload.collection_name) {
        try {
          const collectionSearch = await admin.graphql(
            `#graphql
            query findCollection($title: String!) { collections(first: 5, query: $title) { edges { node { id title } } } }`,
            { variables: { title: payload.collection_name } }
          );
          const collectionData = await collectionSearch.json();
          const matchedCollection = collectionData?.data?.collections?.edges?.find(e => e.node.title.toLowerCase() === payload.collection_name.toLowerCase());
          if (matchedCollection) {
            await admin.graphql(
              `#graphql
              mutation addToCollection($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { message } } }`,
              { variables: { id: matchedCollection.node.id, productIds: [productId] } }
            );
          }
        } catch (collErr) {}
      }

      const rawMetafields = [];
      const googleMetafields = [];
      const { pieces, intent, mediaUrlsJson, title: payloadTitle, metafieldsJson, ...sharedOnly } = payload;
      const combinedFields = { ...sharedOnly, ...piece };
      
      const ignoreKeys = [
        "intent", "mediaUrlsJson", "descriptionHtml", "productType", "status", 
        "pieces", "photoFiles", "photoPreviewUrls", "photos", "imageBase64", 
        "imageMimeType", "stagedResourceUrls", "scanError", "scanToken", 
        "isUploading", "id", "price", "collectionLocation", "age_group", 
        "target_gender", "condition", "shipping_weight_oz", "collection_name", 
        "collection_location", "seo_title", "story_theme"
      ];

      Object.entries(combinedFields).forEach(([key, value]) => {
        if (!ignoreKeys.includes(key) && value !== undefined && value !== null && String(value).trim() !== "") {
           let finalKey = key === "specificGravity" ? "specific_gravity" : key;
           let normalizedValue = normalizeMetafieldValue(finalKey, value);

           const resolvedType = MASTER_TYPE_MAP[finalKey] || MASTER_TYPE_MAP[key] || "single_line_text_field";
           rawMetafields.push({ key: finalKey, value: normalizedValue, type: resolvedType });
        }
      });

      // Google fields attached to Product (productId) instead of defaultVariantId
      if (combinedFields.age_group && combinedFields.age_group !== "") googleMetafields.push({ ownerId: productId, namespace: "google", key: "age_group", type: "single_line_text_field", value: String(combinedFields.age_group) });
      if (combinedFields.target_gender && combinedFields.target_gender !== "") googleMetafields.push({ ownerId: productId, namespace: "google", key: "target_gender", type: "single_line_text_field", value: String(combinedFields.target_gender) });
      if (combinedFields.condition && combinedFields.condition !== "") googleMetafields.push({ ownerId: productId, namespace: "google", key: "condition", type: "single_line_text_field", value: String(combinedFields.condition) });
      if (combinedFields.google_product_category) googleMetafields.push({ namespace: "google", key: "custom_label_0", type: "single_line_text_field", value: String(combinedFields.google_product_category) });

      const COLLECTION_LOCATION_MAP = {
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
      const rawColLoc = combinedFields.collection_location || combinedFields.collectionLocation || "";
      const resolvedColLoc = COLLECTION_LOCATION_MAP[rawColLoc] || rawColLoc;
      if (resolvedColLoc) rawMetafields.push({ key: "collection_location", value: resolvedColLoc, type: "single_line_text_field" });

      if (rawMetafields.length > 0 || googleMetafields.length > 0) {
        try {
            const metafieldsInput = rawMetafields.map(item => {
               let resolvedType = MASTER_TYPE_MAP[item.key] || item.type || "single_line_text_field";
               let resolvedValue = String(item.value);
               if (resolvedType === "number_decimal") {
                 let parsedNum = parseFloat(String(item.value).replace(/["']/g, ""));
                 resolvedValue = isNaN(parsedNum) ? "0.0" : String(parsedNum);
               }
               if (resolvedType.startsWith("list.")) resolvedValue = JSON.stringify([String(item.value)]);

               let resolvedNamespace = item.namespace || "custom";
               if (item.key === "is_ooak" || resolvedNamespace === "none" || resolvedNamespace === "") resolvedNamespace = "custom";

               return { ownerId: productId, namespace: resolvedNamespace, key: item.key, type: resolvedType, value: resolvedValue };
            });

            let allMetafieldsToSet = [...metafieldsInput, ...googleMetafields];
            
            // Apply Origin Overrides right before Shopify API call
            allMetafieldsToSet = applyOriginOverridesBeforeApi(title, allMetafieldsToSet);

            const chunks = chunkArray(allMetafieldsToSet, 25);
            for (const chunk of chunks) {
              const metaResponse = await admin.graphql(
                `#graphql
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) { userErrors { field message } }
                }`,
                { variables: { metafields: chunk } }
              );
              const metaResult = await metaResponse.json();
              allUserErrors.push(...(metaResult?.data?.metafieldsSet?.userErrors || []));
            }
        } catch (e) {}
      }

      // ==========================================
      // 🟢 FIX: POST-CREATION METAFIELD INJECTION
      // ==========================================
      try {
        const parsedPayload = JSON.parse(rawPayload);
        const pieceData = (parsedPayload.pieces && parsedPayload.pieces.length > 0) ? parsedPayload.pieces[0] : {};
        const flatPayload = { ...parsedPayload, ...pieceData };

        const targetKeys = [
          "cut_and_shape", 
          "surface_finish", 
          "color", 
          "dimensions_mm", 
          "artist_notes",
          "origin_story", 
          "character_marks", 
          "honest_flaws", 
          "honest_flaws_and_character", 
          "is_ooak", 
          "treated", 
          "found_object", 
          "custom_product", 
          "piece_name", 
          "stone_shape", 
          "specific_gravity", 
          "mohs_hardness"
        ];
        
        const injectMetafieldsMap = new Map();

        Object.entries(flatPayload).forEach(([key, value]) => {
          if (value === null || value === undefined || String(value).trim() === "") return;
          if (key === "story_theme") return; // Strip out story_theme
          
          let metaKey = key;
          let isCustomField = targetKeys.includes(key);

          if (key.startsWith("custom/")) {
            isCustomField = true;
            metaKey = key.split("custom/")[1];
          }

          if (isCustomField && metaKey) {
             let resolvedValue = normalizeMetafieldValue(metaKey, value);

             injectMetafieldsMap.set(metaKey, {
               ownerId: productId,
               namespace: "custom",
               key: metaKey,
               type: MASTER_TYPE_MAP[metaKey] || "single_line_text_field",
               value: (MASTER_TYPE_MAP[metaKey] || "").startsWith("list.") ? JSON.stringify([resolvedValue]) : resolvedValue
             });
          }
        });

        let injectMetafields = Array.from(injectMetafieldsMap.values());
        
        // Final override application before injection
        injectMetafields = applyOriginOverridesBeforeApi(title, injectMetafields);

        if (injectMetafields.length > 0) {
          const injectChunks = chunkArray(injectMetafields, 25);
          for (const chunk of injectChunks) {
            const injectResponse = await admin.graphql(
              `#graphql
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) { userErrors { field message } }
              }`,
              { variables: { metafields: chunk } }
            );
            const injectResult = await injectResponse.json();
            const errs = injectResult?.data?.metafieldsSet?.userErrors || [];
            if (errs.length > 0) {
              console.warn("[createProduct] Metafield Injection Warnings:", errs);
            }
          }
        }
      } catch (injectionError) {
        console.error("[createProduct] Metafield Injection Exception:", injectionError);
      }

      return data({ success: true, intent: "createProduct", productId: productId, productHandle: productHandle, userErrors: allUserErrors });
    } catch (error) {
      return data({ success: false, intent: "createProduct", error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT: CLEAN GHOST NAMESPACES (SINGLE PRODUCT)
  // ==========================================
  if (intent === "cleanGhostNamespaces") {
    try {
      const productId = formData.get("productId");
      if (!productId) return data({ success: false, message: "No productId provided." });

      let resolvedId = `gid://shopify/Product/${productId}`;
      if (productId.startsWith("gid://")) resolvedId = productId;

      const lookupResponse = await admin.graphql(
        `#graphql
        query getMetafields($ownerId: ID!) { product(id: $ownerId) { metafields(first: 250) { edges { node { id namespace key } } } } } `,
        { variables: { ownerId: resolvedId } }
      );
      const lookupResult = await lookupResponse.json();
      const allMeta = lookupResult?.data?.product?.metafields?.edges || [];

      const toDelete = allMeta.map(e => e.node).filter(m => {
          if (["geo", "rockhound", "geology"].includes(m.namespace)) return true;
          if (m.namespace === "custom") {
            if (["crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "hardness", "fracture", "geoSource", "store_hardness", "store_luster", "store_fracture", "store_cleavage", "store_specific_gravity", "store_diaphaneity", "moh_hardness", "mohsHardness", "primary_color", "secondary_colors", "cut_type", "base_stone_type", "meta_status", "tenacity", "official_name", "polishing_compound", "dimensions", "chemical_formula", "crystal_structure", "refractive_index", "title_tag", "description_tag", "google_product_category", "color-pattern", "jewelry-material", "target-gender", "age-group", "seo_title", "age_group", "condition", "is_one_of_a-kind", "authenticity", "rarity"].includes(m.key)) return true;
            if (/[a-z][A-Z]/.test(m.key)) return true;
          }
          return false;
        });

      if (toDelete.length === 0) return data({ success: true, message: "No ghost namespaces or keys found.", deletedCount: 0, deletedKeys: [] });

      const deleteResponse = await admin.graphql(
        `#graphql
        mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
          metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace ownerId } userErrors { field message } }
        } `,
        { variables: { metafields: toDelete.map(m => ({ ownerId: resolvedId, namespace: m.namespace, key: m.key })) } }
      );

      const deleteResult = await deleteResponse.json();
      const deleteErrors = deleteResult?.data?.metafieldsDelete?.userErrors || [];
      const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];

      if (deleteErrors.length > 0) return data({ success: false, message: "Delete had errors.", errors: deleteErrors });
      return data({ success: true, message: `Cleaned ${deleted.length} ghost metafield(s).`, deletedCount: deleted.length, deletedKeys: deleted.map(d => `${d.namespace}/${d.key}`) });
    } catch (error) {
      return data({ success: false, error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT: CLEAN ALL GHOST NAMESPACES (ALL PRODUCTS)
  // ==========================================
  if (intent === "cleanAllGhostNamespaces") {
    try {
      let hasNextPage = true;
      let cursor = null;
      let totalScanned = 0;
      let totalDeleted = 0;
      let allDeletedKeys = [];

      while (hasNextPage) {
        const productsResponse = await admin.graphql(
          `#graphql
          query getProductsMetafields($cursor: String) {
            products(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges { node { id metafields(first: 250) { edges { node { id namespace key } } } } }
            }
          }`,
          { variables: { cursor } }
        );

        const productsResult = await productsResponse.json();
        const products = productsResult?.data?.products?.edges || [];

        for (const productEdge of products) {
          totalScanned++;
          const productNode = productEdge.node;
          const allMeta = productNode.metafields?.edges || [];
          
          const toDelete = allMeta.map(e => e.node).filter(m => {
              if (["geo", "rockhound"].includes(m.namespace)) return true;
              if (m.namespace === "custom") {
                if (["crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "specificGravity", "hardness", "fracture", "geoSource", "store_hardness", "store_luster", "store_fracture", "store_cleavage", "store_specific_gravity", "store_diaphaneity", "moh_hardness", "mohsHardness", "primary_color", "secondary_colors", "cut_type", "base_stone_type", "meta_status", "tenacity", "official_name", "polishing_compound", "dimensions", "chemical_formula", "crystal_structure", "refractive_index", "title_tag", "description_tag", "google_product_category", "color-pattern", "jewelry-material", "target-gender", "age-group", "seo_title", "age_group", "condition", "is_one_of_a-kind", "authenticity", "rarity"].includes(m.key)) return true;
                if (/[a-z][A-Z]/.test(m.key)) return true;
              }
              return false;
            });

          if (toDelete.length > 0) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
                  metafieldsDelete(metafields: $metafields) { deletedMetafields { key namespace } }
                }`,
                { variables: { metafields: toDelete.map(m => ({ ownerId: productNode.id, namespace: m.namespace, key: m.key })) } }
              );
              const deleteResult = await deleteResponse.json();
              const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];
              totalDeleted += deleted.length;
              deleted.forEach(d => allDeletedKeys.push(`${d.namespace}/${d.key}`));
            } catch (errors) {}
          }
        }

        hasNextPage = productsResult?.data?.products?.pageInfo?.hasNextPage;
        cursor = productsResult?.data?.products?.pageInfo?.endCursor;
        if (hasNextPage) await new Promise(resolve => setTimeout(resolve, 1000));
      }

      return data({ success: true, message: `Nuclear sweep complete. Scanned ${totalScanned} products, deleted ${totalDeleted} ghost metafields.`, deletedCount: totalDeleted, deletedKeys: allDeletedKeys });
    } catch (error) {
      return data({ success: false, message: "Bulk clean failed", error: error.message });
    }
  }
};
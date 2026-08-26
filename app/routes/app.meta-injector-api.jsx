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

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // ==========================================
  // DIAGNOSTIC LOGGING
  // ==========================================
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
      return data({
        success: false,
        message: "Could not auto-detect stone type from title. Manual entry required.",
        fields: {}
      });
    }

    try {
      let cachedStone = await prisma.stoneCache.findUnique({
        where: { stoneName: stoneName }
      });

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
          "stone_story": `A beautiful piece of natural ${stoneName}.`,
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
          "crystal_system": "Trigonal",
          "geological_era": "Varies by specimen",
          "mineral_class": "Silicate",
          "rock_composition": "Silicified",
          "rock_formation": "Natural"
        };

        cachedStone = await prisma.stoneCache.create({
          data: {
            stoneName: stoneName,
            data: JSON.stringify(lapidaryData)
          }
        });
      }

      return data({
        success: true,
        message: `Loaded data for ${stoneName} from database.`,
        fields: JSON.parse(cachedStone.data)
      });

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
      // FIX: Check for both 'payload' and 'metafields' since different components send different keys
      const rawPayload = formData.get("payload") || formData.get("metafields");
      
      if (!rawPayload) {
        console.log("SAVE ERROR: No payload or metafields found in request.");
        return data({ intent: "saveMetafields", success: false, message: "No data provided to save." });
      }

      let payloadArray = JSON.parse(rawPayload);
      
      // FIX: Rename is_one_of_a_kind to is_one_of_a_kind and remove rogue collectionLocation
      payloadArray = payloadArray
        .filter(item => item.key !== "collectionLocation")
        .map(item => {
          if (item.key === "is_one_of_a_kind") {
            return { ...item, key: "is_one_of_a_kind" };
          }
          return item;
        });

      const TYPE_MAP = {
        stone_story: "list.single_line_text_field",
        character_marks: "list.single_line_text_field",
        is_ooak: "single_line_text_field",
        treated: "single_line_text_field",
        found_object: "single_line_text_field",
        custom_product: "single_line_text_field",
        is_one_of_a_kind: "single_line_text_field",
        piece_name: "single_line_text_field",
        cut_and_shape: "single_line_text_field",
        surface_finish: "single_line_text_field",
        dimensions_mm: "single_line_text_field",
        stone_shape: "single_line_text_field",
        seo_title: "single_line_text_field",
        color: "single_line_text_field",
        weight_grams: "number_decimal",
        specific_gravity: "single_line_text_field",
        mohs_hardness: "single_line_text_field",
        shipping_weight_oz: "number_decimal",
        price: "number_decimal"
      };

      const setMetafields = payloadArray
        .filter(item => item.value !== null && String(item.value).trim() !== "")
        .map(item => {
          // If the payload comes from handleSaveFullMeta, it might not have ownerId attached to every field.
          // We grab it from the form data if it's missing on the individual item.
          const fallbackProductId = formData.get("productId");
          const itemOwnerId = item.ownerId || fallbackProductId;
          
          if (!itemOwnerId) {
            throw new Error(`Missing ownerId for field: ${item.key}`);
          }

          let resolvedId = `gid://shopify/Product/${itemOwnerId.split("/").pop()}`;
          (itemOwnerId.startsWith("gid://")) && (resolvedId = itemOwnerId);

          const resolvedType = TYPE_MAP[item.key] || item.type || "single_line_text_field";
          
          let resolvedValue = String(item.value);
          (resolvedType.startsWith("list.")) && (resolvedValue = JSON.stringify([String(item.value)]));
          if (item.key === "treated" || item.key === "is_one_of_a_kind") {
            if (resolvedValue === "true") resolvedValue = "Yes";
            else if (resolvedValue === "false") resolvedValue = "No";
          }

          if (item.key === "seo_title") {
            return {
              ownerId: resolvedId,
              namespace: "global",
              key: "title_tag",
              type: "single_line_text_field",
              value: resolvedValue
            };
          }

          return {
            ownerId: resolvedId,
            namespace: item.namespace || "custom",
            key: item.key,
            type: resolvedType,
            value: resolvedValue
          };
        });

      if (setMetafields.length === 0) {
        console.log("SAVE CANCELLED: Metafields array filtered down to 0 valid fields.");
        return data({ intent: "saveMetafields", success: true, message: "No fields to save." });
      }

      console.log("METAFIELDS BEING SENT TO SHOPIFY:", JSON.stringify(setMetafields, null, 2));

      const chunks = chunkArray(setMetafields, 1);
      const allErrors = [];

      for (const chunk of chunks) {
        const response = await admin.graphql(
          `#graphql
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields { id key namespace value }
              userErrors { field message }
            }
          }`,
          { variables: { metafields: chunk } }
        );

        const result = await response.json();
        const errors = result?.data?.metafieldsSet?.userErrors || [];
        allErrors.push(...errors);
      }

      if (allErrors.length > 0) {
        console.log("SAVE ERRORS:", JSON.stringify(allErrors, null, 2));
        return data({ success: false, message: "Saved with errors: " + allErrors.map(e => e.field + " — " + e.message).join(" | "), errors: allErrors });
      }

      // Update variant weight if weight_grams is in the payload
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
                  product(id: $id) {
                    variants(first: 1) {
                      edges { node { id } }
                    }
                  }
                }`,
                { variables: { id: productGid } }
              );
              const variantData = await variantQuery.json();
              const variantId = variantData?.data?.product?.variants?.edges?.[0]?.node?.id;
              if (variantId) {
                await admin.graphql(
                  `#graphql
                  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                      userErrors { field message }
                    }
                  }`,
                  { variables: { productId: productGid, variants: [{ id: variantId, inventoryItem: { measurement: { weight: { value: weightGrams / 28.3495, unit: "OUNCES" } } } }] } }
                );
                console.log("[saveMetafields] Variant weight updated:", weightGrams, "g →", weightGrams / 28.3495, "oz");
              }
            }
          } catch (weightErr) {
            console.warn("[saveMetafields] Variant weight update failed:", weightErr.message);
          }
        }
      }

      console.log("SAVE SUCCESS: All metafields locked in.");
      return data({ intent: "saveMetafields", success: true, message: "All metafields locked in." });
    } catch (error) {
      console.error("SAVE METAFIELDS CRASH:", error.message, error.stack);
      return data({ intent: "saveMetafields", success: false, error: error.message });
    }
  }

  // ==========================================
  // 🔴 INTENT 3: CLEAN MALFORMED KEYS
  // ==========================================
  if (intent === "cleanMalformedKeys") {
    const productId = formData.get("productId");

    if (!productId) {
      return data({ success: false, message: "No productId provided." });
    }

    let resolvedId = `gid://shopify/Product/${productId}`;
    (productId.startsWith("gid://")) && (resolvedId = productId);

    // Step 1 — Find the malformed metafield IDs
    const lookupResponse = await admin.graphql(
      `#graphql
      query getMetafields($ownerId: ID!) {
        product(id: $ownerId) {
          metafields(first: 250) {
            edges {
              node {
                id
                namespace
                key
              }
            }
          }
        }
      } `,
      { variables: { ownerId: resolvedId } }
    );

    const lookupResult = await lookupResponse.json();
    const allMeta = lookupResult?.data?.product?.metafields?.edges || [];

    const malformedKeys = [
      "cut_type",
      "crystalSystem",
      "geologicalEra",
      "mineralClass",
      "rockComposition",
      "rockFormation",
      "specificGravity",
      "mohsHardness"
    ];
    const toDelete = allMeta
      .map(e => e.node)
      .filter(m => malformedKeys.includes(m.key))
      .map(m => m.id);

    if (toDelete.length === 0) {
      return data({ success: true, message: "No malformed keys found. Already clean." });
    }

    // Step 2 — Delete them
    const deleteResponse = await admin.graphql(
      `#graphql
      mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
        metafieldsDelete(metafields: $metafields) {
          deletedMetafields { key namespace ownerId }
          userErrors { field message }
        }
      } `,
      {
        variables: {
          metafields: toDelete.map(id => ({ ownerId: resolvedId, id }))
        }
      }
    );

    const deleteResult = await deleteResponse.json();
    const deleteErrors = deleteResult?.data?.metafieldsDelete?.userErrors || [];
    const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafields || [];

    if (deleteErrors.length > 0) {
      return data({ success: false, message: "Delete had errors.", errors: deleteErrors });
    }

    return data({
      success: true,
      message: `Cleaned ${deleted.length} malformed metafield(s). Re-save the product to write them correctly.`,
      deleted
    });
  }

  // ==========================================
  // 🔴 INTENT 3.5: CLEAN ALL CAMEL KEYS
  // ==========================================
  if (intent === "cleanAllCamelKeys") {
    try {
      let hasNextPage = true;
      let cursor = null;
      let totalScanned = 0;
      let totalDeleted = 0;
      const malformedKeys = [
        "cut_type", "crystalSystem", "geologicalEra", "mineralClass",
        "rockComposition", "rockFormation", "specificGravity", "mohsHardness"
      ];

      while (hasNextPage) {
        const productsResponse = await admin.graphql(
          `#graphql
          query getProductsMetafields($cursor: String) {
            products(first: 50, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges {
                node {
                  id
                  metafields(first: 250) {
                    edges {
                      node {
                        id
                        namespace
                        key
                      }
                    }
                  }
                }
              }
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
          console.log("METAFIELD KEYS for", productNode.id, ":", allMeta.map(m => m.node.namespace + "." + m.node.key));

          const toDelete = allMeta
            .map(e => e.node)
            .filter(m => m.namespace === "custom" && malformedKeys.includes(m.key))
            .map(m => m.id);

          if (toDelete.length > 0) {
            try {
              const deleteResponse = await admin.graphql(
                `#graphql
                mutation metafieldsDelete($ids: [ID!]!) {
                  metafieldsDelete(metafields: $ids) {
                    deletedMetafieldsIds
                    userErrors { field message }
                  }
                }`,
                {
                  variables: { ids: toDelete }
                }
              );
              const deleteResult = await deleteResponse.json();
              console.error("metafieldsDelete graphQLErrors:", JSON.stringify(deleteResult?.errors?.graphQLErrors, null, 2));
              const deleted = deleteResult?.data?.metafieldsDelete?.deletedMetafieldsIds || [];
              totalDeleted += deleted.length;
            } catch (errors) {
              console.error("metafieldsDelete graphQLErrors:", JSON.stringify(errors.graphQLErrors, null, 2));
            }
          }
        }

        hasNextPage = productsResult?.data?.products?.pageInfo?.hasNextPage;
        cursor = productsResult?.data?.products?.pageInfo?.endCursor;
      }

      return data({
        success: true,
        message: `Bulk clean complete. Scanned ${totalScanned} products, deleted ${totalDeleted} malformed metafields.`
      });
    } catch (error) {
      console.error("BULK CLEAN CRASH:", error);
      return data({ success: false, message: "Bulk clean failed", error: error.message });
    }
  }

  // ==========================================
  // INTENT 4: STAGED UPLOAD (ONE ROUND-TRIP)
  // ==========================================
  if (intent === "stagedUpload") {
    try {
      // STEP 1: Receive the file from formData on the server
      const file = formData.get("file_0");
      const pieceId = formData.get("pieceId");
      const scanToken = formData.get("scanToken");

      if (!file || !(file instanceof File)) {
        return data({ success: false, intent: "stagedUpload", error: "Missing file_0 binary payload." });
      }

      // STEP 2: Call stagedUploadsCreate GraphQL mutation to get the staged target
      const uploadResponse = await admin.graphql(
        `#graphql
        mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
          stagedUploadsCreate(input: $input) {
            stagedTargets {
              url
              resourceUrl
              parameters {
                name
                value
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          variables: {
            input: [
              {
                resource: "IMAGE",
                filename: file.name || `upload_${Date.now()}.jpg`,
                mimeType: file.type || "image/jpeg",
                fileSize: String(file.size),
                httpMethod: "POST"
              }
            ]
          }
        }
      );

      const uploadResult = await uploadResponse.json();
      const userErrors = uploadResult?.data?.stagedUploadsCreate?.userErrors || [];
      
      if (userErrors.length > 0) {
        return data({ success: false, intent: "stagedUpload", error: userErrors.map(e => e.message).join(", ") });
      }

      const stagedTargets = uploadResult?.data?.stagedUploadsCreate?.stagedTargets;
      if (!stagedTargets || stagedTargets.length === 0) {
        return data({ success: false, intent: "stagedUpload", error: "No upload target returned from Shopify." });
      }

      const target = stagedTargets[0];

      // STEP 3: Do the S3 POST upload server-side
      const s3FormData = new FormData();

      // Build a FormData with all target.parameters appended first
      target.parameters.forEach((param) => {
        s3FormData.append(param.name, param.value);
      });

      // Convert Node/Remix File to Blob for reliable fetch transmission and append last under name "file"
      const arrayBuffer = await file.arrayBuffer();
      const fileBlob = new Blob([arrayBuffer], { type: file.type || "image/jpeg" });
      s3FormData.append("file", fileBlob, file.name || `upload_${Date.now()}.jpg`);

      // POST to target.url without manually setting Content-Type
      const s3Response = await fetch(target.url, {
        method: "POST",
        body: s3FormData
      });

      if (!s3Response.ok) {
        const errorText = await s3Response.text();
        return data({ success: false, intent: "stagedUpload", error: `S3 upload failed: ${errorText}` });
      }

      // STEP 4: Return to the client
      return data({
        success: true,
        intent: "stagedUpload",
        resourceUrl: target.resourceUrl,
        pieceId: pieceId,
        scanToken: scanToken
      });
    } catch (error) {
      console.error("STAGED UPLOAD CRASH:", error);
      return data({ success: false, intent: "stagedUpload", error: error.message });
    }
  }

  // ==========================================
  // INTENT 5: CREATE PRODUCT
  // ==========================================
  if (intent === "createProduct") {
    try {
      const rawPayload = formData.get("payload");
      if (!rawPayload) {
        return data({ success: false, intent: "createProduct", error: "Missing JSON payload." });
      }

      const payload = JSON.parse(rawPayload);

      let piece = {};
      (payload.pieces && payload.pieces.length > 0) && (piece = payload.pieces[0]);

      const stoneFamily = payload.stone_family || "Unknown Stone";
      const pieceName = piece.piece_name || "New Piece";
      const originLocation = payload.collection_name
        ? payload.collection_name.replace(/\s+Collection$/i, "").trim()
        : (payload.origin_location || "Unknown Origin");

      const title = payload.title && !payload.title.includes("Unknown")
        ? payload.title
        : `${stoneFamily} — ${originLocation} — ${pieceName}`;
      const descriptionHtml = payload.descriptionHtml || piece.generated_description || piece.descriptionHtml || "";
      const price = String(payload.price || piece.price || "0.00");
      const productType = payload.productType || "Wearable Art";
      const status = payload.status || "DRAFT";

      const allUserErrors = [];

      // Step 1: Create Product (returning default variant ID)
      const seoTitle = payload.seo_title || `${stoneFamily} — ${pieceName} — One-of-a-Kind Rockhound Studio`;
      const productInput = {
        title: title,
        descriptionHtml: descriptionHtml,
        productType: productType,
        status: status
      };

      const createResponse = await admin.graphql(
        `#graphql
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              handle
              variants(first: 1) {
                edges {
                  node {
                    id
                  }
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { variables: { input: productInput } }
      );

      const createResult = await createResponse.json();
      const createErrors = createResult?.data?.productCreate?.userErrors || [];
      (createErrors.length > 0) && allUserErrors.push(...createErrors);

      const createdProduct = createResult?.data?.productCreate?.product;
      
      if (!createdProduct) {
         return data({ success: false, intent: "createProduct", error: "Product creation failed", userErrors: allUserErrors });
      }

      const productId = createdProduct.id;
      const productHandle = createdProduct.handle;
      const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;

      // 🔵 INJECT SEO TITLE HERE
      if (seoTitle) {
        try {
          const seoResponse = await admin.graphql(
            `#graphql
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                metafields { id key namespace value }
                userErrors { field message }
              }
            }`,
            {
              variables: {
                metafields: [
                  {
                    ownerId: productId,
                    namespace: "global",
                    key: "title_tag",
                    value: seoTitle,
                    type: "single_line_text_field"
                  }
                ]
              }
            }
          );
          const seoResult = await seoResponse.json();
          console.log("SEO title save result:", JSON.stringify(seoResult, null, 2));
        } catch (e) {
          console.error("Failed to save SEO title:", e);
        }
      }

      // Step 1.5: Set Price on Default Variant
      if (price && defaultVariantId) {
        const variantResponse = await admin.graphql(
          `#graphql
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }`,
          { variables: { productId, variants: [{ id: defaultVariantId, price: price, inventoryItem: { measurement: { weight: { value: parseFloat(payload.weight_grams || piece.weight_grams || 0) / 28.3495, unit: "OUNCES" } } } }] } }
        );
        
        const variantResult = await variantResponse.json();
        const varErrors = variantResult?.data?.productVariantsBulkUpdate?.userErrors || [];
        (varErrors.length > 0) && allUserErrors.push(...varErrors);
      }

      // Step 2: Attach Media using pre-staged URLs from Frontend
      try {
        const mediaUrlsJson = payload.mediaUrlsJson;
        const mediaUrls = JSON.parse(mediaUrlsJson || "[]");
        const validMediaUrls = mediaUrls.filter(u => typeof u === "string" && u.startsWith("http"));

        if (validMediaUrls.length > 0) {
          const mediaInput = validMediaUrls.map(url => ({
            originalSource: url,
            mediaContentType: "IMAGE"
          }));

          await new Promise(resolve => setTimeout(resolve, 3000));

          const mediaResponse = await admin.graphql(
            `#graphql
            mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
              productCreateMedia(productId: $productId, media: $media) {
                media {
                  id
                }
                mediaUserErrors {
                  field
                  message
                }
              }
            }`,
            { variables: { productId, media: mediaInput } }
          );

          const mediaResult = await mediaResponse.json();
          console.log("productCreateMedia result:", JSON.stringify(mediaResult?.data?.productCreateMedia, null, 2));

          const mediaErrors = mediaResult?.data?.productCreateMedia?.mediaUserErrors || [];
          (mediaErrors.length > 0) && allUserErrors.push(...mediaErrors);
        }
      } catch (e) {
        console.error("Error attaching media URLs in productCreateMedia:", e);
      }

      // Assign product to collection
      if (payload.collection_name) {
        try {
          const collectionSearch = await admin.graphql(
            `#graphql
            query findCollection($title: String!) {
              collections(first: 5, query: $title) {
                edges { node { id title } }
              }
            }`,
            { variables: { title: payload.collection_name } }
          );
          const collectionData = await collectionSearch.json();
          const matchedCollection = collectionData?.data?.collections?.edges?.find(
            e => e.node.title.toLowerCase() === payload.collection_name.toLowerCase()
          );
          if (matchedCollection) {
            await admin.graphql(
              `#graphql
              mutation addToCollection($id: ID!, $productIds: [ID!]!) {
                collectionAddProducts(id: $id, productIds: $productIds) {
                  userErrors { field message }
                }
              }`,
              { variables: { id: matchedCollection.node.id, productIds: [productId] } }
            );
          }
        } catch (collErr) {
          console.warn("[createProduct] Collection assignment failed:", collErr.message);
        }
      }

      // Step 3: Write Metafields
      const rawMetafields = [];
      const googleMetafields = [];

      // Combine shared fields and piece fields
      const { pieces, intent, mediaUrlsJson, title: payloadTitle, metafieldsJson, ...sharedOnly } = payload;
      const combinedFields = { ...sharedOnly, ...piece };
      
      // We don't want to save these system/structural keys as metafields
      // Added collection_date, primary_medium, secondary_medium, wire_material, setting_ready, bail_included, artist_notes, character_marks
      // BENCH UPGRADE: Stripped out lapidary & jewelry specs so they save unblocked to Shopify DB
      const ignoreKeys = [
        "intent", "mediaUrlsJson", "descriptionHtml", "productType", "status", "pieces", "photoFiles",
        "photoPreviewUrls", "photos", "imageBase64", "imageMimeType", "stagedResourceUrls", "scanError",
        "scanToken", "isUploading", "id", "generated_description", "price", "collectionLocation",
        "age_group", "target_gender", "condition", "shipping_weight_oz", "collection_name", "collection_location",
        "seo_title" // Exclude seo_title from the generic loop since we handle it explicitly above
      ];

      // Explicitly build and save SEO title from piece_name + stone_family
      const pieceNameForSeo = combinedFields.piece_name || "";
      const stoneFamilyForSeo = combinedFields.stone_family || "";
      const builtSeoTitle = (pieceNameForSeo && stoneFamilyForSeo)
        ? `${stoneFamilyForSeo} \u2014 ${pieceNameForSeo} \u2014 One-of-a-Kind Rockhound Studio`
        : (combinedFields.seo_title || "");
      if (builtSeoTitle) {
        rawMetafields.push({
          key: "title_tag",
          namespace: "global",
          value: builtSeoTitle,
          type: "single_line_text_field"
        });
      }

      Object.entries(combinedFields).forEach(([key, value]) => {
        if (!ignoreKeys.includes(key) && value !== undefined && value !== null && String(value).trim() !== "") {
           let finalKey = key;
           (key === "specificGravity") && (finalKey = "specific_gravity");

           if (key === "treated" || key === "is_one_of_a_kind") {
             if (value === true || value === "true") value = "Yes";
             else if (value === false || value === "false") value = "No";
           }

           rawMetafields.push({
             key: finalKey,
             value: value,
             type: "single_line_text_field" // The map below will fix the types
           });
        }
      });

      // Populate separate google namespace array if present — write to the VARIANT level
      (combinedFields.age_group && combinedFields.age_group !== "" && defaultVariantId) && googleMetafields.push({
        ownerId: defaultVariantId,
        namespace: "google",
        key: "age_group",
        type: "single_line_text_field",
        value: String(combinedFields.age_group)
      });

      (combinedFields.target_gender && combinedFields.target_gender !== "" && defaultVariantId) && googleMetafields.push({
        ownerId: defaultVariantId,
        namespace: "google",
        key: "target_gender",
        type: "single_line_text_field",
        value: String(combinedFields.target_gender)
      });

      (combinedFields.condition && combinedFields.condition !== "" && defaultVariantId) && googleMetafields.push({
        ownerId: defaultVariantId,
        namespace: "google",
        key: "condition",
        type: "single_line_text_field",
        value: String(combinedFields.condition)
      });

      if (combinedFields.google_product_category) {
        googleMetafields.push({
          namespace: "google",
          key: "custom_label_0",
          type: "single_line_text_field",
          value: String(combinedFields.google_product_category)
        });
      }

      if (rawMetafields.length > 0 || googleMetafields.length > 0) {
        try {
            const TYPE_MAP = {
              stone_story: "list.single_line_text_field",
              character_marks: "list.single_line_text_field",
              is_ooak: "single_line_text_field",
              treated: "single_line_text_field",
              found_object: "single_line_text_field",
              custom_product: "single_line_text_field",
              is_one_of_a_kind: "single_line_text_field",
              piece_name: "single_line_text_field",
              cut_and_shape: "single_line_text_field",
              surface_finish: "single_line_text_field",
              dimensions_mm: "single_line_text_field",
              stone_shape: "single_line_text_field",
              color: "single_line_text_field",
              weight_grams: "number_decimal",
              specific_gravity: "single_line_text_field",
              mohs_hardness: "single_line_text_field",
              shipping_weight_oz: "number_decimal",
              price: "number_decimal"
            };

            const metafieldsInput = rawMetafields.map(item => {
               let resolvedType = TYPE_MAP[item.key] || item.type || "single_line_text_field";
               let resolvedValue = String(item.value);

               if (resolvedType === "number_decimal") {
                 let parsedNum = parseFloat(String(item.value).replace(/["']/g, ""));
                 resolvedValue = isNaN(parsedNum) ? "0.0" : String(parsedNum);
               }
               
               (resolvedType.startsWith("list.")) && (resolvedValue = JSON.stringify([String(item.value)]));

               return {
                 ownerId: productId,
                 namespace: "custom",
                 key: item.key,
                 type: resolvedType,
                 value: resolvedValue
               };
            });

            // Merge the google array alongside custom metafields
            const allMetafieldsToSet = [...metafieldsInput, ...googleMetafields];

            // Shopify limits metafieldsSet to 25 items per request
            const chunks = chunkArray(allMetafieldsToSet, 25);
            for (const chunk of chunks) {
              const metaResponse = await admin.graphql(
                `#graphql
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) {
                    metafields { id key namespace }
                    userErrors { field message }
                  }
                }`,
                { variables: { metafields: chunk } }
              );
              
              const metaResult = await metaResponse.json();
              const metaErrors = metaResult?.data?.metafieldsSet?.userErrors || [];
              (metaErrors.length > 0) && allUserErrors.push(...metaErrors);
            }
        } catch (e) {
          console.error("Error formatting metafields:", e);
        }
      }

      if (allUserErrors.length > 0) {
        console.log("CREATE PRODUCT ERRORS:", JSON.stringify(allUserErrors, null, 2));
      }

      return data({ 
        success: true, 
        intent: "createProduct", 
        productId: productId, 
        productHandle: productHandle,
        userErrors: allUserErrors
      });

    } catch (error) {
      console.error("CREATE PRODUCT CRASH:", error);
      return data({ success: false, intent: "createProduct", error: error.message });
    }
  }

};
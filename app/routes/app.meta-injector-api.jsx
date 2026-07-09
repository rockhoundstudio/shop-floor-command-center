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
        const lapidaryData = {
          "mineral_class": "Silicate",
          "mohs_hardness": stoneName === "Jasper" || stoneName === "Agate" ? "6.5 - 7" : "Varies",
          "crystal_system": "Trigonal",
          "primary_color": "Varies by specimen",
          "stone_story": `A beautiful piece of natural ${stoneName}.`
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
      
      // FIX: Rename is_one_of_a-kind to is_one_of_a_kind
      payloadArray = payloadArray.map(item => {
        if (item.key === "is_one_of_a-kind") {
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
        seo_title: "single_line_text_field"
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

          const resolvedId = itemOwnerId.startsWith("gid://")
            ? itemOwnerId
            : `gid://shopify/Product/${itemOwnerId.split("/").pop()}`;

          const resolvedType = TYPE_MAP[item.key] || item.type || "single_line_text_field";
          const resolvedValue = resolvedType.startsWith("list.") ? JSON.stringify([String(item.value)]) : String(item.value);

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

    const resolvedId = productId.startsWith("gid://")
      ? productId
      : `gid://shopify/Product/${productId}`;

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

    const malformedKeys = ["cut_type", "cut_and_shape"];
    const toDelete = allMeta
      .map(e => e.node)
      .filter(m => {
        const rawKey = `${m.namespace}.${m.key}`;
        const combined = `${m.namespace}${m.key}`;
        return (
          malformedKeys.some(k => combined.includes(`=${k}`)) ||
          malformedKeys.some(k => m.key === k && m.namespace !== "custom")
        );
      })
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
      }`,
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

      const piece = payload.pieces && payload.pieces[0] ? payload.pieces[0] : {};

      const stoneFamily = payload.stone_family || "Unknown Stone";
      const originLocation = payload.origin_location || "Unknown Origin";
      const pieceName = piece.piece_name || "New Piece";
      
      const title = `${stoneFamily} — ${originLocation} — ${pieceName}`;
      const descriptionHtml = payload.descriptionHtml || "";
      const price = piece.price || "0.00";
      const productType = payload.productType || "Wearable Art";
      const status = payload.status || "DRAFT";

      const allUserErrors = [];

      // Step 1: Create Product (returning default variant ID)
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

      // Step 1.5: Set Price on Default Variant (BUG 4 FIX)
      if (price && defaultVariantId) {
        const numericPrice = parseFloat(price);
        if (!isNaN(numericPrice)) {
          const variantResponse = await admin.graphql(
            `#graphql
            mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors { field message }
              }
            }`,
            { variables: { productId, variants: [{ id: defaultVariantId, price: numericPrice.toString() }] } }
          );
          
          const variantResult = await variantResponse.json();
          const varErrors = variantResult?.data?.productVariantsBulkUpdate?.userErrors || [];
          if (varErrors.length > 0) {
            allUserErrors.push(...varErrors);
          }
        }
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
          const mediaErrors = mediaResult?.data?.productCreateMedia?.mediaUserErrors || [];
          (mediaErrors.length > 0) && allUserErrors.push(...mediaErrors);
        }
      } catch (e) {
        console.error("Error attaching media URLs in productCreateMedia:", e);
      }

      // Step 3: Write Metafields
      const rawMetafields = [];

      // Combine shared fields and piece fields
      const combinedFields = { ...payload, ...piece };
      
      // We don't want to save these system/structural keys as metafields
      const ignoreKeys = ["intent", "mediaUrlsJson", "descriptionHtml", "productType", "status", "pieces", "photoFiles", "photoPreviewUrls", "photos", "imageBase64", "imageMimeType", "stagedResourceUrls", "scanError", "scanToken", "isUploading", "id", "generated_description", "price", "seo_title"];

      Object.entries(combinedFields).forEach(([key, value]) => {
        if (!ignoreKeys.includes(key) && value !== undefined && value !== null && String(value).trim() !== "") {
           rawMetafields.push({
             key: key === "is_one_of_a-kind" ? "is_one_of_a_kind" : key,
             value: value,
             type: "single_line_text_field" // The map below will fix the types
           });
        }
      });

      if (rawMetafields.length > 0) {
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
              seo_title: "single_line_text_field"
            };

            const metafieldsInput = rawMetafields.map(item => {
               let resolvedType = TYPE_MAP[item.key] || item.type || "single_line_text_field";
               let resolvedValue = String(item.value);

               // BUG 1 FIX: weight_grams type and value
               if (item.key === "weight_grams") {
                 resolvedType = "number_decimal";
                 let parsedNum = parseFloat(String(item.value).replace(/["']/g, ""));
                 resolvedValue = isNaN(parsedNum) ? "0.0" : String(parsedNum);
               } 
               
               if (resolvedType.startsWith("list.")) {
                 resolvedValue = JSON.stringify([String(item.value)]);
               }

               return {
                 ownerId: productId,
                 namespace: "custom",
                 key: item.key,
                 type: resolvedType,
                 value: resolvedValue
               };
            });

            // Shopify limits metafieldsSet to 25 items per request
            const chunks = chunkArray(metafieldsInput, 25);
            for (const chunk of chunks) {
              const metaResponse = await admin.graphql(
                `#graphql
                mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) {
                    metafields { id key }
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
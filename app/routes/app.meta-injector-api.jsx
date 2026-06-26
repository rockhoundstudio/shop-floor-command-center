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
    const rawPayload = formData.get("payload");
    const payloadArray = JSON.parse(rawPayload);

    const TYPE_MAP = {
      stone_story: "list.single_line_text_field",
      character_marks: "list.single_line_text_field",
      is_ooak: "boolean"
    };

    const setMetafields = payloadArray
      .filter(item => item.value !== null && String(item.value).trim() !== "")
      .map(item => {
        const resolvedId = item.ownerId.startsWith("gid://")
          ? item.ownerId
          : `gid://shopify/Product/${item.ownerId.split("/").pop()}`;

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
      return data({ success: true, message: "No fields to save." });
    }

    console.log("METAFIELDS BEING SENT TO SHOPIFY:", JSON.stringify(setMetafields, null, 2));

    const chunks = chunkArray(setMetafields, 3);
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
      return data({ success: false, message: "Saved with errors.", errors: allErrors });
    }

    return data({ success: true, message: "All metafields locked in." });
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
};
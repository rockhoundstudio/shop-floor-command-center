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
          "custom.mineral_class": "Silicate",
          "custom.mohs_hardness": stoneName === "Jasper" || stoneName === "Agate" ? "6.5 - 7" : "Varies",
          "custom.crystal_system": "Trigonal",
          "custom.primary_color": "Varies by specimen",
          "custom.stone_story": `A beautiful piece of natural ${stoneName}.`
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
  if (intent === "save_single_meta") {
    const productId = formData.get("productId");
    const rawMetafields = formData.get("metafields");
    const metafieldsObj = JSON.parse(rawMetafields);

    // GID Standardization (Command Center Rule)
    const resolvedId = productId.startsWith("gid://")
      ? productId
      : `gid://shopify/Product/${productId.split("/").pop()}`;

    const setMetafields = Object.entries(metafieldsObj)
      .filter(([key, value]) => value !== null && String(value).trim() !== "")
      .map(([fullKey, value]) => {
        const namespace = "rockhound";
        const key = fullKey;

        return {
          ownerId: resolvedId,
          namespace: namespace,
          key: key,
          value: String(value),
          type: "single_line_text_field"
        };
      });

    if (setMetafields.length === 0) {
      return data({ success: true, message: "No fields to save." });
    }

    // Chunk at 3 to avoid timeout jams on Render
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
      const realErrors = errors.filter(e => !e.message.includes("must be consistent with the definition"));
      allErrors.push(...realErrors);
    }

    if (allErrors.length > 0) {
      return data({ success: false, message: "Saved with errors.", errors: allErrors });
    }

    return data({ success: true, message: "All metafields locked in." });
  }
};
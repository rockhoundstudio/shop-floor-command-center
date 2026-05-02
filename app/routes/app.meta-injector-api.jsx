import { data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server"; // Connects to your Prisma database

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Helper function to figure out what stone we are looking at based on the title
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
  
  // 🚀 CRITICAL FIX: The frontend sends a Form, so we must read it as a Form!
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
      // 1. Check if we already have this stone in the new database drawer!
      let cachedStone = await prisma.stoneCache.findUnique({
        where: { stoneName: stoneName }
      });

      // 2. If it's not in the database, fetch/generate the data and save it
      if (!cachedStone) {
        // NOTE: This acts as your "Local Geo Library" fallback for now.
        // You can plug your live Mindat API fetch right here later!
        const lapidaryData = {
          "custom.mineral_class": "Silicate",
          "custom.mohs_hardness": stoneName === "Jasper" || stoneName === "Agate" ? "6.5 - 7" : "Varies",
          "custom.crystal_system": "Trigonal",
          "custom.primary_color": "Varies by specimen",
          "custom.stone_story": `A beautiful piece of natural ${stoneName}.`
        };

        // Save it to Prisma so we never have to "fetch" it again
        cachedStone = await prisma.stoneCache.create({
          data: {
            stoneName: stoneName,
            data: JSON.stringify(lapidaryData)
          }
        });
      }

      // 3. Send the data back to the frontend to fill the boxes
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

    // Reformat the flat frontend data into the array Shopify expects
    const setMetafields = Object.entries(metafieldsObj)
      .filter(([key, value]) => value !== null && String(value).trim() !== "")
      .map(([fullKey, value]) => {
        // If your key is "custom.mohs_hardness", split it. Otherwise default to "custom"
        const parts = fullKey.split(".");
        const namespace = parts.length > 1 ? parts[0] : "custom";
        const key = parts.length > 1 ? parts[1] : fullKey;

        return {
          ownerId: productId,
          namespace: namespace,
          key: key,
          value: String(value),
          type: "single_line_text_field"
        };
      });

    if (setMetafields.length === 0) {
      return data({ success: true, message: "No fields to save." });
    }

    const chunks = chunkArray(setMetafields, 25);
    const allErrors = [];

    // Push to Shopify
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
      
      // Filter out strict definition errors like your original code did
      const realErrors = errors.filter(e => !e.message.includes("must be consistent with the definition"));
      allErrors.push(...realErrors);
    }

    if (allErrors.length > 0) {
      return data({ success: false, message: "Saved with some definition errors.", errors: allErrors });
    }

    return data({ success: true, message: "Successfully locked data to Shopify!" });
  }

  return data({ success: false, message: "Unknown button clicked." }, { status: 400 });
};
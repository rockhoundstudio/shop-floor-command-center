import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";

export const action = async ({ request }) => {
  // 1. Ensure it's a POST request
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  // 2. Check Rockhound Studio security secret
  const secret = request.headers.get("X-Sidekick-Secret");
  if (secret !== "RockhoundAlpha7799!") {
    return json({ error: "Unauthorized. Invalid secret." }, { status: 401 });
  }

  try {
    // 3. Parse the incoming payload from Flow/Sidekick
    const payload = await request.json();
    const { shop, productId, key, value, type } = payload;

    if (!shop || !productId || !key || value === undefined) {
      return json({ error: "Missing required fields: shop, productId, key, value" }, { status: 400 });
    }

    // 4. Connect to Shopify admin safely
    const { admin } = await unauthenticated.admin(shop);

    const mutation = `
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      metafields: [
        {
          ownerId: productId,
          namespace: "custom",
          key: key,
          value: String(value),
          type: type || "single_line_text_field"
        }
      ]
    };

    // 5. Execute the update
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    if (data.data.metafieldsSet.userErrors.length > 0) {
      return json({ success: false, errors: data.data.metafieldsSet.userErrors }, { status: 400 });
    }

    return json({
      success: true,
      message: "Rockhound Studio Metafield Updated Successfully",
      updated: data.data.metafieldsSet.metafields
    });

  } catch (error) {
    return json({ success: false, error: error.message }, { status: 500 });
  }
};

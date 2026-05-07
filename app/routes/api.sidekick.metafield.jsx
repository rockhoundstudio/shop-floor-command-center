import { unauthenticated } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  const secret = request.headers.get("X-Sidekick-Secret");
  if (secret !== "RockhoundAlpha7799!") {
    return Response.json({ error: "Unauthorized. Invalid secret." }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { shop, productId, key, value, type } = payload;

    if (!shop || !productId || !key || value === undefined) {
      return Response.json({ error: "Missing required fields: shop, productId, key, value" }, { status: 400 });
    }

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

    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    if (data.data.metafieldsSet.userErrors.length > 0) {
      return Response.json({ success: false, errors: data.data.metafieldsSet.userErrors }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: "Rockhound Studio Metafield Updated Successfully",
      updated: data.data.metafieldsSet.metafields
    });

  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};

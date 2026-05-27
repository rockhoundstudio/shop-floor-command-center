import { unauthenticated } from "../shopify.server";

// ==========================================
// ENGINE: SIDEKICK EXTERNAL WEBHOOK RECEIVER
// ==========================================
export const action = async ({ request }) => {
  // 1. Method Validation
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }

  // 2. Authentication Validation
  const secret = request.headers.get("X-Sidekick-Secret");
  if (secret !== process.env.SIDEKICK_SECRET) {
    return Response.json({ error: "Unauthorized access" }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const { shop, productId, key, value, type } = payload;

    // 3. Payload Validation
    if (!shop || !productId || !key || value === undefined) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 4. Establish Offline Session
    const { admin } = await unauthenticated.admin(shop);

    // 5. GID Standardization (Command Center Rule)
    // Ensures Sidekick doesn't break the GraphQL call if it sends a raw ID instead of a GID
    const targetGid = productId.includes("gid://shopify/")
      ? productId
      : `gid://shopify/Product/${productId.split("/").pop()}`;

    // 6. GraphQL Execution
    const mutation = `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }
    `;

    const variables = {
      metafields: [{
        ownerId: targetGid,
        namespace: "custom",
        key: key,
        value: String(value),
        type: type || "single_line_text_field"
      }]
    };

    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();

    // 7. Error Handling
    if (data.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Sidekick Metafield Error:", data.data.metafieldsSet.userErrors);
      return Response.json(
        { success: false, errors: data.data.metafieldsSet.userErrors },
        { status: 400 }
      );
    }

    return Response.json({ 
      success: true, 
      message: `Successfully locked ${key} into ${targetGid}` 
    });

  } catch (error) {
    console.error("Sidekick Webhook Fault:", error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};
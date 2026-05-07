import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";

// ==========================================
// API: SIDEKICK SECURE HOOK (SINGLE METAFIELD)
// ==========================================
// Endpoint: /api/sidekick/metafield
// Receives POST requests from Sidekick AI to update product metafields.

export async function action({ request }) {
  // 1. Check HTTP Method
  if (request.method !== "POST") {
    return json({ error: "Method not allowed. Use POST." }, { status: 405 });
  }

  // 2. Verify the Secret Password (SIDEKICK_HOOK_SECRET)
  const authHeader = request.headers.get("Authorization");
  const EXPECTED_SECRET = process.env.SIDEKICK_HOOK_SECRET;

  if (!EXPECTED_SECRET) {
    console.error("CRITICAL: SIDEKICK_HOOK_SECRET is not set in Render environment.");
    return json({ error: "Server misconfiguration" }, { status: 500 });
  }

  if (!authHeader || authHeader !== `Bearer ${EXPECTED_SECRET}`) {
    console.warn("Unauthorized access attempt to Sidekick Hook");
    return json({ error: "Unauthorized: Invalid secret" }, { status: 401 });
  }

  // 3. Parse the Payload
  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const { shop, productId, key, value, type, namespace } = payload;

  if (!shop || !productId || !key || value === undefined) {
    return json({ error: "Missing required fields: shop, productId, key, value" }, { status: 400 });
  }

  // Ensure GID formatting
  const productGid = String(productId).includes("gid://") ? productId : `gid://shopify/Product/${productId}`;
  const fieldType = type || "single_line_text_field";
  const fieldNamespace = namespace || "custom";

  // 4. Inject into Shopify using the unauthenticated admin client
  try {
    const { admin } = await unauthenticated.admin(shop);

    const response = await admin.graphql(
      `#graphql
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
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: productGid,
              namespace: fieldNamespace,
              key: key,
              type: fieldType,
              value: String(value)
            }
          ]
        }
      }
    );

    const responseJson = await response.json();

    if (responseJson.data?.metafieldsSet?.userErrors?.length > 0) {
      console.error("Shopify Injection Error:", responseJson.data.metafieldsSet.userErrors);
      return json({ error: responseJson.data.metafieldsSet.userErrors }, { status: 400 });
    }

    return json({ success: true, message: `Injected ${key}: ${value} into ${productGid}` });

  } catch (error) {
    console.error("Sidekick Hook Engine Error:", error);
    return json({ error: "Internal server error during injection" }, { status: 500 });
  }
}
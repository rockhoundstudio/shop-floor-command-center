import { unauthenticated } from "../shopify.server";

export const action = async ({ request }) => {
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  const secret = request.headers.get("X-Sidekick-Secret");
  if (secret !== "RockhoundAlpha7799!") return Response.json({ error: "Unauthorized" }, { status: 401 });
  
  try {
    const payload = await request.json();
    const { shop, productId, key, value, type } = payload;
    if (!shop || !productId || !key || value === undefined) return Response.json({ error: "Missing fields" }, { status: 400 });
    const { admin } = await unauthenticated.admin(shop);
    const mutation = `mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { id } userErrors { message } } }`;
    const variables = { metafields: [{ ownerId: productId, namespace: "custom", key, value: String(value), type: type || "single_line_text_field" }] };
    const response = await admin.graphql(mutation, { variables });
    const data = await response.json();
    if (data.data?.metafieldsSet?.userErrors?.length > 0) return Response.json({ success: false, errors: data.data.metafieldsSet.userErrors }, { status: 400 });
    return Response.json({ success: true, message: "Updated" });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
};

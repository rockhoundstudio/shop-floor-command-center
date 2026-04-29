import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const body = await request.json();
  const { productId, metafields } = body;

  const setMetafields = metafields.map((mf) => ({
    ownerId: productId,
    namespace: mf.namespace,
    key: mf.key,
    value: mf.value,
    type: mf.type,
  }));

  const response = await admin.graphql(
    `#graphql
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key namespace value }
        userErrors { field message }
      }
    }`,
    { variables: { metafields: setMetafields } }
  );

  const data = await response.json();
  return json(data);
};

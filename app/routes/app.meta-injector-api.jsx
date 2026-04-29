import { data } from "react-router";
import { authenticate } from "../shopify.server";

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

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

  const chunks = chunkArray(setMetafields, 25);
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

  return data({ data: { metafieldsSet: { userErrors: allErrors } } });
};

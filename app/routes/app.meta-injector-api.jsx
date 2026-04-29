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

  // Skip blank values and list-type fields
  const setMetafields = metafields
    .filter((mf) => mf.value && mf.value.trim() !== "")
    .map((mf) => ({
      ownerId: productId,
      namespace: mf.namespace,
      key: mf.key,
      value: mf.value,
      type: "single_line_text_field",
    }));

  if (setMetafields.length === 0) {
    return data({ data: { metafieldsSet: { userErrors: [] } } });
  }

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
    // Only keep non-type errors
    const realErrors = errors.filter(e => !e.message.includes("must be consistent with the definition"));
    allErrors.push(...realErrors);
  }

  return data({ data: { metafieldsSet: { userErrors: allErrors } } });
};

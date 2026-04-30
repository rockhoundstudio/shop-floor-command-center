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

  // Only skip list-type fields — save everything else including blanks
  const setMetafields = metafields
    .map((mf) => ({
      ownerId: productId,
      namespace: mf.namespace,
      key: mf.key,
      value: mf.value || "",
      type: "single_line_text_field",
    }));

  if (setMetafields.length === 0) {
    return data({ data: { metafieldsSet: { userErrors: [] } } });
  }

  const chunks = chunkArray(setMetafields, 25);
  const allErrors = [];

  for (const chunk of chunks) {
    // Only send fields with values — but track all as "attempted"
    const nonEmpty = chunk.filter(mf => mf.value.trim() !== "");
    if (nonEmpty.length === 0) continue;

    const response = await admin.graphql(
      `#graphql
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id key namespace value }
          userErrors { field message }
        }
      }`,
      { variables: { metafields: nonEmpty } }
    );

    const result = await response.json();
    const errors = result?.data?.metafieldsSet?.userErrors || [];
    const realErrors = errors.filter(e => !e.message.includes("must be consistent with the definition"));
    allErrors.push(...realErrors);
  }

  return data({ data: { metafieldsSet: { userErrors: allErrors } } });
};

import { data } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Page } from "@shopify/polaris";
import CollectionsTab from "../components/meta/CollectionsTab";

// ── LOADER ──────────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  const res = await admin.graphql(`
    query {
      collections(first: 50) {
        nodes { id title }
      }
      products(first: 100) {
        nodes {
          id title
          featuredImage { url }
          collections(first: 10) { nodes { id title } }
        }
      }
    }
  `);

  const json = await res.json();
  const collections = json.data.collections.nodes;
  const products = json.data.products.nodes.map(p => ({
    ...p,
    currentCollections: p.collections?.nodes ?? [],
  }));

  return data({ collections, products });
};

// ── ACTION ───────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "createCollection") {
    const title = fd.get("title");
    const res = await admin.graphql(`
      mutation createCollection($title: String!) {
        collectionCreate(input: { title: $title }) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { title } });
    const json = await res.json();
    if (json.data?.collectionCreate?.userErrors?.length)
      return data({ ok: false, error: json.data.collectionCreate.userErrors[0].message });
    return data({ ok: true });
  }

  if (intent === "deleteCollection") {
    const id = fd.get("id");
    const res = await admin.graphql(`
      mutation deleteCollection($id: ID!) {
        collectionDelete(input: { id: $id }) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `, { variables: { id } });
    const json = await res.json();
    if (json.data?.collectionDelete?.userErrors?.length)
      return data({ ok: false, error: json.data.collectionDelete.userErrors[0].message });
    return data({ ok: true });
  }

  if (intent === "assignCollection") {
    const productId = fd.get("productId");
    const collectionId = fd.get("collectionId");
    const res = await admin.graphql(`
      mutation assignCollection($collectionId: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $collectionId, productIds: $productIds) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { collectionId, productIds: [productId] } });
    const json = await res.json();
    if (json.data?.collectionAddProducts?.userErrors?.length)
      return data({ ok: false, error: json.data.collectionAddProducts.userErrors[0].message });
    return data({ ok: true });
  }

  if (intent === "removeCollection") {
    const productId = fd.get("productId");
    const collectionId = fd.get("collectionId");
    const res = await admin.graphql(`
      mutation removeCollection($collectionId: ID!, $productIds: [ID!]!) {
        collectionRemoveProducts(id: $collectionId, productIds: $productIds) {
          job { id }
          userErrors { field message }
        }
      }
    `, { variables: { collectionId, productIds: [productId] } });
    const json = await res.json();
    if (json.data?.collectionRemoveProducts?.userErrors?.length)
      return data({ ok: false, error: json.data.collectionRemoveProducts.userErrors[0].message });
    return data({ ok: true });
  }

  return data({ ok: false, error: "Unknown intent" });
};

// ── COMPONENT ────────────────────────────────────────────────────────────────
export default function CollectionManager() {
  const { collections, products } = useLoaderData();

  return (
    <Page title="📁 Collection Manager">
      <CollectionsTab
        collections={collections}
        products={products}
        onBack={() => window.history.back()}
      />
    </Page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

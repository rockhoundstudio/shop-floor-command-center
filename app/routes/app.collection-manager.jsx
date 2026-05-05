import { data as json } from "react-router";
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

  const data = await res.json();
  const collections = data.data.collections.nodes;
  const products = data.data.products.nodes.map(p => ({
    ...p,
    currentCollections: p.collections?.nodes ?? [],
  }));

  return json({ collections, products });
};

// ── ACTION ───────────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const fd = await request.formData();
  const intent = fd.get("intent");

  if (intent === "createCollection") {
    const title = fd.get("title");
    await admin.graphql(`
      mutation {
        collectionCreate(input: { title: "${title}" }) {
          collection { id title }
          userErrors { field message }
        }
      }
    `);
    return json({ ok: true });
  }

  if (intent === "deleteCollection") {
    const id = fd.get("id");
    await admin.graphql(`
      mutation {
        collectionDelete(input: { id: "${id}" }) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `);
    return json({ ok: true });
  }

  if (intent === "assignCollection") {
    const productId = fd.get("productId");
    const collectionId = fd.get("collectionId");
    await admin.graphql(`
      mutation {
        collectionAddProducts(id: "${collectionId}", productIds: ["${productId}"]) {
          collection { id title }
          userErrors { field message }
        }
      }
    `);
    return json({ ok: true });
  }

  if (intent === "removeCollection") {
    const productId = fd.get("productId");
    const collectionId = fd.get("collectionId");
    await admin.graphql(`
      mutation {
        collectionRemoveProducts(id: "${collectionId}", productIds: ["${productId}"]) {
          job { id }
          userErrors { field message }
        }
      }
    `);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Unknown intent" });
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

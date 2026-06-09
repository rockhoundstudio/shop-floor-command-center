import { data as json } from "react-router";
import { authenticate } from "../shopify.server";

const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title } }
    }
  }
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
  query GetMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "custom") {
      edges { node { id name key type { name } } }
    }
  }
`;

const GET_SNAPSHOTS_QUERY = `
  query GetSnapshots {
    metaobjects(type: "rockhound_snapshot", first: 10) {
      edges { node { id handle updatedAt fields { key value } } }
    }
  }
`;

const PRODUCT_CREATE_MUTATION = `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product { id }
      userErrors { field message }
    }
  }
`;

const SET_METAFIELDS_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key value }
      userErrors { field message }
    }
  }
`;

const COLLECTION_ADD_PRODUCTS_MUTATION = `
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id }
      userErrors { field message }
    }
  }
`;

const COLLECTION_MAP = {
  "Spokane River": "gid://shopify/Collection/454794117371",
  "Yakima Canyon": "gid://shopify/Collection/452884922619",
  "Yellowstone River": "gid://shopify/Collection/454795886843",
  "Richardson's Rock Ranch": "gid://shopify/Collection/452912972027",
  "The 3,000-Mile Run": "gid://shopify/Collection/452913135867",
  "Nickel Back": "gid://shopify/Collection/454794871035",
  "Rufus Serpentine": "gid://shopify/Collection/454841237755",
  "The Shopped Rock": "gid://shopify/Collection/454840615163",
  "The Gallery": "gid://shopify/Collection/452886495483"
};

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
  return chunked;
};

async function fetchAllProducts(graphql) {
  const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor: null } });
  const { data } = await response.json();
  if (data && data.products) return data.products.edges.map(edge => edge.node);
  return [];
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const products = await fetchAllProducts(admin.graphql);
  const [definitionsRes, snapshotsRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY)
  ]);
  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(e => e.node) || [];
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(e => e.node) || [];
  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try { count = JSON.parse(dataField.value).length || 0; } catch (e) { count = "Unknown"; }
    }
    return { id: snap.id, createdAt: new Date(snap.updatedAt).toLocaleString(), count };
  });
  return json({ products, pageInfo: { hasNextPage: false, endCursor: null }, metafieldDefinitions, snapshots });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createProduct") {
    const raw = formData.get("pieces");
    if (!raw) return json({ success: false, error: "No data received" });
    const payload = JSON.parse(raw);
    const { sharedFields, rows } = payload;
    const results = [];

    for (const row of rows) {
      const title = [sharedFields.material, sharedFields.collection_location, row.piece_name]
        .filter(Boolean).join(" — ");

      const createRes = await admin.graphql(PRODUCT_CREATE_MUTATION, {
        variables: { input: { title, status: "DRAFT", variants: [{ price: row.price || "0.00" }] } }
      });
      const createData = await createRes.json();
      const productId = createData.data?.productCreate?.product?.id;
      if (!productId) { results.push({ error: "Product create failed" }); continue; }

      const keysList = [
        "piece_name", "primary_medium", "secondary_medium", "handcrafted_by",
        "material", "stone_family", "color", "cut_and_shape", "surface_finish",
        "dimensions_mm", "weight_grams", "collection_name", "collection_location",
        "collection_date", "primary_use", "setting_ready", "bail_included",
        "is_one_of_a_kind", "treated", "found_object", "wire_material",
        "artist_notes", "origin_story", "honest_flaws_and_character"
      ];

      const allValues = { ...sharedFields, ...row };
      const metafields = keysList
        .filter(key => allValues[key] && allValues[key].toString().trim() !== "")
        .map(key => ({ namespace: "custom", key, type: "single_line_text_field", value: allValues[key].toString().trim(), ownerId: productId }));

      const chunks = chunkArray(metafields, 10);
      for (const chunk of chunks) {
        await admin.graphql(SET_METAFIELDS_MUTATION, { variables: { metafields: chunk } });
        await new Promise(r => setTimeout(r, 300));
      }

      const collectionId = COLLECTION_MAP[sharedFields.collection_location];
      if (collectionId) {
        await admin.graphql(COLLECTION_ADD_PRODUCTS_MUTATION, {
          variables: { id: collectionId, productIds: [productId] }
        });
      }

      results.push({ productId });
    }

    return json({ success: true, intent: "createProduct", createdCount: results.filter(r => r.productId).length });
  }

  return json({ success: false, error: "Unknown intent" });
}

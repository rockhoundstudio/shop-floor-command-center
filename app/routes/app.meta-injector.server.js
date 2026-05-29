import { authenticate } from "../shopify.server";
import { EXCLUDED_TITLES } from "./app.meta-injector.constants";

async function fetchProfilesFromRenderDB() {
  return [
    { 
      name: "Quartz", 
      data: { 
        hardness: "7", luster: "Vitreous", "crystal-system": '["gid://shopify/Metaobject/154252116219"]', 
        fracture: "Conchoidal", cleavage: "None", specific_gravity: "2.65", 
        "mineral-class": '["gid://shopify/Metaobject/151951278331"]', diaphaneity: "Transparent to Opaque" 
      } 
    },
    { 
      name: "Labradorite", 
      data: { 
        hardness: "6", luster: "Vitreous to Pearly", "crystal-system": '["gid://shopify/Metaobject/154308706555"]', 
        fracture: "Uneven", cleavage: "Perfect", specific_gravity: "2.70", diaphaneity: "Translucent" 
      } 
    }
  ];
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const dbProfiles = await fetchProfilesFromRenderDB();

  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const response = await admin.graphql(`
      query GetAllProducts($cursor: String) {
        products(first: 50, after: $cursor, sortKey: TITLE) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              id title status featuredImage { url altText }
              metafields(first: 50) {
                edges { node { id namespace key value type } }
              }
            }
          }
        }
      }
    `, { variables: { cursor } });

    const parsed = await response.json();
    const productsData = parsed.data?.products ? parsed.data.products : null;
    
    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo.hasNextPage ? true : false;
      cursor = productsData.pageInfo.endCursor ? productsData.pageInfo.endCursor : null;
    } else {
      hasNextPage = false;
    }
  }
  
  const products = allRawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  const snapResponse = await admin.graphql(`
    query GetSnapshots {
      metaobjects(type: "meta_injector_snapshot", first: 10, sortKey: "updated_at", reverse: true) {
        edges {
          node {
            id
            timestamp: field(key: "timestamp") { value }
            scope: field(key: "scope") { value }
            action: field(key: "action") { value }
            payload: field(key: "payload") { value }
          }
        }
      }
    }
  `);
  
  const snapParsed = await snapResponse.json();
  const rawSnapshots = snapParsed.data?.metaobjects?.edges.map(e => e.node) ? snapParsed.data.metaobjects.edges.map(e => e.node) : [];
  
  const snapshots = rawSnapshots.map(s => ({
    id: s.id,
    date: s.timestamp?.value ? s.timestamp.value : "Unknown Date",
    action: s.action?.value ? s.action.value : "Snapshot",
    scopeCount: s.scope?.value ? s.scope.value : "0",
    payloadStr: s.payload?.value ? s.payload.value : "[]"
  }));

  return { products, snapshots, dbProfiles };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveMetafields") {
    const payload = JSON.parse(formData.get("payload"));
    const chunks = [];
    for (let i = 0; i < payload.length; i += 3) {
      chunks.push(payload.slice(i, i + 3));
    }

    let allErrors = [];
    for (const chunk of chunks) {
      const response = await admin.graphql(`
        mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            userErrors { field message }
          }
        }
      `, { variables: { metafields: chunk } });
      const json = await response.json();
      const errors = json.data?.metafieldsSet?.userErrors ? json.data.metafieldsSet.userErrors : [];
      if (errors.length > 0) allErrors = [...allErrors, ...errors];
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated in batches." };
  }

  if (intent === "fetchSingleProduct") {
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      query GetSingleProduct($id: ID!) {
        product(id: $id) {
          id title status featuredImage { url altText }
          metafields(first: 50) {
            edges { node { id namespace key value type } }
          }
        }
      }
    `, { variables: { id: productId } });
    const json = await response.json();
    return { success: true, product: json.data?.product ? json.data.product : null };
  }

  if (intent === "fetchOrigins") {
    let allRaw = [];
    let hasNext = true;
    let cursor = null;

    while (hasNext) {
      const response = await admin.graphql(`
        query GetOrigins($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title
                originMetafield: metafield(namespace: "custom", key: "origin_location") { value }
              }
            }
          }
        }
      `, { variables: { cursor } });
      const json = await response.json();
      const data = json.data?.products ? json.data.products : null;
      if (data) {
        allRaw = [...allRaw, ...data.edges.map(e => e.node)];
        hasNext = data.pageInfo.hasNextPage ? true : false;
        cursor = data.pageInfo.endCursor ? data.pageInfo.endCursor : null;
      } else {
        hasNext = false;
      }
    }
    const filtered = allRaw.filter(p => !EXCLUDED_TITLES.includes(p.title));
    return { success: true, origins: filtered };
  }

  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const response = await admin.graphql(`
      query ValidateGIDs($ids: [ID!]!) {
        nodes(ids: $ids) { id }
      }
    `, { variables: { ids: gids } });
    const json = await response.json();
    const nodes = json.data?.nodes ? json.data.nodes : [];
    const isInvalid = nodes.some(n => n === null);
    return { success: true, isValid: !isInvalid };
  }

  if (intent === "saveSnapshot") {
    const actionName = formData.get("actionName");
    const payloadStr = formData.get("payloadStr");
    const scopeCount = formData.get("scopeCount");
    
    const createRes = await admin.graphql(`
      mutation CreateSnapshot($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id }
          userErrors { field message }
        }
      }
    `, {
      variables: {
        metaobject: {
          type: "meta_injector_snapshot",
          capabilities: { publishable: { status: "ACTIVE" } },
          fields: [
            { key: "timestamp", value: new Date().toLocaleString() },
            { key: "action", value: actionName },
            { key: "scope", value: scopeCount },
            { key: "payload", value: payloadStr }
          ]
        }
      }
    });

    const createJson = await createRes.json();
    const errors = createJson.data?.metaobjectCreate?.userErrors ? createJson.data.metaobjectCreate.userErrors : [];
    
    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
       return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    const existingIds = JSON.parse(formData.get("existingIds") ? formData.get("existingIds") : "[]");
    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      await admin.graphql(`
        mutation DeleteSnapshot($id: ID!) { metaobjectDelete(id: $id) { userErrors { message } } }
      `, { variables: { id: oldestId } });
    }

    return { success: true };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}
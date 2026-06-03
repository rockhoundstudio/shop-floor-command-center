import { authenticate } from "../shopify.server";
import { EXCLUDED_TITLES } from "./app.meta-injector.constants";
import db from "../db.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const rawStoneProfiles = await db.stoneProfile.findMany();

  const dbProfiles = rawStoneProfiles.map((sp) => {
    return {
      title: sp.stoneName,
      stoneName: sp.stoneName
    };
  });

  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    let response;
    try {
      response = await admin.graphql(`
        #graphql
        query GetAllProducts($cursor: String) {
          products(first: 50, after: $cursor, sortKey: TITLE) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                featuredImage { url altText }
                metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      id namespace key value type
                    }
                  }
                }
              }
            }
          }
        }
      `, { variables: { cursor } });
    } catch (error) {
      console.log("GetAllProducts error:", JSON.stringify(error.graphQLErrors, null, 2));
      throw error;
    }

    const parsed = await response.json();
    const productsData = parsed.data && parsed.data.products;

    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo && productsData.pageInfo.hasNextPage;
      cursor = productsData.pageInfo && productsData.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }

  const products = allRawProducts.filter((p) => {
    return !EXCLUDED_TITLES.includes(p.title);
  });

  let snapResponse;
  try {
    snapResponse = await admin.graphql(`
      #graphql
      query GetSnapshots {
        metaobjects(type: "meta_injector_snapshot", first: 10, reverse: true) {
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
  } catch (error) {
    console.log("GetSnapshots error:", JSON.stringify(error.graphQLErrors, null, 2));
    throw error;
  }

  const snapParsed = await snapResponse.json();
  const metaobjectsEdges = snapParsed.data && snapParsed.data.metaobjects && snapParsed.data.metaobjects.edges;
  const rawSnapshots = metaobjectsEdges ? metaobjectsEdges.map(e => e.node) : [];

  const snapshots = rawSnapshots.map((s) => {
    return {
      id: s.id,
      date: (s.timestamp && s.timestamp.value) || "Unknown Date",
      action: (s.action && s.action.value) || "Snapshot",
      scopeCount: (s.scope && s.scope.value) || "0",
      payloadStr: (s.payload && s.payload.value) || "[]"
    };
  });

  return { products, snapshots, dbProfiles };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveMetafields") {
    let rawPayload = JSON.parse(formData.get("payload"));
    let productsToUpdate = {};

    rawPayload.forEach((mf) => {
      let ownerIdStr = String(mf.ownerId);
      let normalizedOwnerId = ownerIdStr.includes("gid://shopify/Product/") 
        ? ownerIdStr 
        : `gid://shopify/Product/${ownerIdStr}`;

      if (!productsToUpdate[normalizedOwnerId]) {
        productsToUpdate[normalizedOwnerId] = [];
      }

      let cleanMf = {
        namespace: mf.namespace || "custom",
        key: mf.key,
        value: mf.value,
        type: mf.type || "single_line_text_field"
      };

      productsToUpdate[normalizedOwnerId].push(cleanMf);
    });

    let allErrors = [];

    for (const [productId, metafields] of Object.entries(productsToUpdate)) {
      try {
        const response = await admin.graphql(`
          #graphql
          mutation ProductMetafieldsUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id }
              userErrors { field message }
            }
          }
        `, {
          variables: {
            input: {
              id: productId,
              metafields: metafields
            }
          }
        });

        const json = await response.json();
        const productUpdateData = json.data && json.data.productUpdate;
        const errors = productUpdateData && productUpdateData.userErrors ? productUpdateData.userErrors : [];

        if (errors.length > 0) {
          allErrors = [...allErrors, ...errors];
        }
      } catch (error) {
        console.error("GraphQL productUpdate failed for product:", productId, error);
        allErrors.push({ field: ["graphql"], message: error.message });
      }
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated via productUpdate." };
  }

  if (intent === "fetchSingleProduct") {
    const rawProductId = formData.get("productId");
    const normalizedId = rawProductId.includes("gid://shopify/Product/") 
      ? rawProductId 
      : `gid://shopify/Product/${rawProductId}`;

    const response = await admin.graphql(`
      #graphql
      query GetSingleProduct($id: ID!) {
        product(id: $id) {
          id title handle status featuredImage { url altText }
          metafields(first: 50, namespace: "custom") {
            edges {
              node {
                id namespace key value type
              }
            }
          }
        }
      }
    `, { variables: { id: normalizedId } });

    const json = await response.json();
    const product = json.data && json.data.product;

    return { success: true, product };
  }

  if (intent === "fetchOrigins") {
    let allRaw = [];
    let hasNext = true;
    let cursor = null;
    let batchCount = 0;
    const MAX_BATCHES = 10;

    while (hasNext && batchCount < MAX_BATCHES) {
      const response = await admin.graphql(`
        #graphql
        query GetOrigins($cursor: String) {
          products(first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title handle
                originMetafield: metafield(namespace: "custom", key: "origin_story") { value }
              }
            }
          }
        }
      `, { variables: { cursor } });

      const json = await response.json();
      const data = json.data && json.data.products;

      if (data) {
        allRaw = [...allRaw, ...data.edges.map(e => e.node)];
        hasNext = data.pageInfo && data.pageInfo.hasNextPage;
        cursor = data.pageInfo && data.pageInfo.endCursor;
        batchCount = batchCount + 1;
      } else {
        hasNext = false;
      }
    }

    const filtered = allRaw.filter((p) => {
      return !EXCLUDED_TITLES.includes(p.title);
    });

    return { success: true, origins: filtered, hasMore: hasNext };
  }

  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const normalizedGids = gids.map(gid => {
      return gid.includes("gid://shopify/") ? gid : `gid://shopify/Product/${gid}`;
    });

    const response = await admin.graphql(`
      #graphql
      query ValidateGIDs($ids: [ID!]!) {
        nodes(ids: $ids) { id }
      }
    `, { variables: { ids: normalizedGids } });

    const json = await response.json();
    const nodes = json.data && json.data.nodes ? json.data.nodes : [];
    const isInvalid = nodes.some(n => n === null);
    
    return { success: true, isValid: !isInvalid };
  }

  if (intent === "saveSnapshot") {
    const actionName = formData.get("actionName");
    const payloadStr = formData.get("payloadStr");
    const scopeCount = formData.get("scopeCount");

    const createRes = await admin.graphql(`
      #graphql
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
    const metaobjectCreateData = createJson.data && createJson.data.metaobjectCreate;
    const errors = metaobjectCreateData && metaobjectCreateData.userErrors ? metaobjectCreateData.userErrors : [];

    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
      return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    const rawExistingIds = formData.get("existingIds");
    const existingIds = JSON.parse(rawExistingIds || "[]");

    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      const normalizedOldestId = oldestId.includes("gid://shopify/Metaobject/") 
        ? oldestId 
        : `gid://shopify/Metaobject/${oldestId}`;

      await admin.graphql(`
        #graphql
        mutation DeleteSnapshot($id: ID!) {
          metaobjectDelete(id: $id) { userErrors { message } }
        }
      `, { variables: { id: normalizedOldestId } });
    }

    return { success: true };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}
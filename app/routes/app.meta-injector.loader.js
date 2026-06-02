import { authenticate } from "../shopify.server";
import { EXCLUDED_TITLES } from "./app.meta-injector.constants";
import db from "../db.server";

async function fetchDynamicMetaobjects(admin) {
  const types = [
    "shopify--color-pattern", "shopify--authenticity", "shopify--rarity",
    "shopify--crystal-system", "shopify--geological-era", "shopify--mineral-class",
    "shopify--rock-composition", "shopify--rock-formation"
  ];

  let dynamicOptions = {};

  await Promise.all(types.map(async (type) => {
    const response = await admin.graphql(`
      query getMetaobjects($type: String!) {
        metaobjects(type: $type, first: 250) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
    `, { variables: { type } });

    const data = await response.json();

    if (data.data && data.data.metaobjects) {
      dynamicOptions[type] = data.data.metaobjects.edges.map(({ node }) => {
        const labelField = node.fields.find(f => f.key === 'name' || f.key === 'label');
        const displayLabel = labelField ? labelField.value : node.handle;
        return {
          label: displayLabel,
          value: `["${node.id}"]`
        };
      });
      dynamicOptions[type].sort((a, b) => a.label.localeCompare(b.label));
    } else {
      dynamicOptions[type] = [];
    }
  }));

  return dynamicOptions;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const dynamicMetaobjectOptions = await fetchDynamicMetaobjects(admin);

  const rawStoneProfiles = await db.stoneProfile.findMany();

  // KEY LAW — these keys must match exactly what InjectorTab looks for
  const dbProfiles = rawStoneProfiles.map(sp => ({
    title: sp.stoneName,
    stoneName: sp.stoneName,
    authenticity: sp.authenticity,
    google_authenticity: sp.authenticity,
    rarity: sp.rarity,
    google_rarity: sp.rarity,
    google_crystal_system: sp.crystalSystem,
    google_geological_era: sp.geologicalEra,
    google_mineral_class: sp.mineralClass,
    google_rock_composition: sp.rockComposition,
    google_rock_formation: sp.rockFormation,
    mohs_hardness: sp.hardness,
    luster: sp.luster,
    fracture_pattern: sp.fracture,
    cleavage: sp.cleavage,
    specific_gravity: sp.specificGravity,
    diaphaneity: sp.diaphaneity
  }));

  let allRawProducts = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    let response;
    try {
      response = await admin.graphql(`
        #graphql
        query GetAllProducts($cursor: String) {
          products(first: 10, after: $cursor, sortKey: TITLE) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id title status featuredImage { url altText }
                metafields(first: 50) {
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
    const productsData = parsed.data?.products || null;

    if (productsData) {
      allRawProducts = [...allRawProducts, ...productsData.edges.map(e => e.node)];
      hasNextPage = productsData.pageInfo.hasNextPage || false;
      cursor = productsData.pageInfo.endCursor || null;
    } else {
      hasNextPage = false;
    }
  }

  const products = allRawProducts.filter(p => !EXCLUDED_TITLES.includes(p.title));

  const gidsToResolve = new Set();

  products.forEach(p => {
    if (p.metafields && p.metafields.edges) {
      p.metafields.edges.forEach(edge => {
        const mf = edge.node;
        if (mf.type === "list.metaobject_reference" || mf.type === "metaobject_reference") {
          try {
            const parsedValue = JSON.parse(mf.value);
            if (Array.isArray(parsedValue)) {
              parsedValue.forEach(gid => gidsToResolve.add(gid));
            } else if (typeof parsedValue === "string") {
              gidsToResolve.add(parsedValue);
            }
          } catch (e) {
            if (typeof mf.value === "string" && mf.value.includes("gid://shopify/Metaobject/")) {
              const matches = mf.value.match(/gid:\/\/shopify\/Metaobject\/\d+/g);
              if (matches) {
                matches.forEach(gid => gidsToResolve.add(gid));
              }
            }
          }
        }
      });
    }
  });

  const uniqueGids = Array.from(gidsToResolve);
  const metaobjectHandles = {};

  const chunks = [];
  for (let i = 0; i < uniqueGids.length; i += 10) {
    chunks.push(uniqueGids.slice(i, i + 10));
  }

  for (const chunk of chunks) {
    const resolveResponse = await admin.graphql(`
      #graphql
      query ResolveNodes($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Metaobject {
            id
            handle
          }
        }
      }
    `, { variables: { ids: chunk } });

    const resolveParsed = await resolveResponse.json();
    const nodes = resolveParsed.data?.nodes || [];

    nodes.forEach(node => {
      if (node && node.id && node.handle) {
        metaobjectHandles[node.id] = node.handle;
      }
    });
  }

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
  const rawSnapshots = snapParsed.data?.metaobjects?.edges ? snapParsed.data.metaobjects.edges.map(e => e.node) : [];

  const snapshots = rawSnapshots.map(s => ({
    id: s.id,
    date: s.timestamp?.value ? s.timestamp.value : "Unknown Date",
    action: s.action?.value ? s.action.value : "Snapshot",
    scopeCount: s.scope?.value ? s.scope.value : "0",
    payloadStr: s.payload?.value ? s.payload.value : "[]"
  }));

  return { products, snapshots, metaobjectHandles, dbProfiles, dynamicMetaobjectOptions };
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createMetaobject") {
    const type = formData.get("type");
    const value = formData.get("value");

    try {
      const response = await admin.graphql(`
        mutation CreateTaxonomyTerm($metaobject: MetaobjectCreateInput!) {
          metaobjectCreate(metaobject: $metaobject) {
            metaobject { id handle }
            userErrors { field message }
          }
        }
      `, {
        variables: {
          metaobject: {
            type: type,
            capabilities: { publishable: { status: "ACTIVE" } },
            fields: [{ key: "name", value: value }]
          }
        }
      });
      const data = await response.json();
      if (data.data?.metaobjectCreate?.userErrors?.length > 0) {
        return { success: false, errors: data.data.metaobjectCreate.userErrors };
      }
      return { success: true, newGid: data.data.metaobjectCreate.metaobject.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  if (intent === "saveMetafields") {
    let rawPayload = JSON.parse(formData.get("payload"));

    let payload = rawPayload.reduce((acc, mf) => {
      let cleanMf = {
        ownerId: mf.ownerId,
        namespace: mf.namespace || "custom",
        key: mf.key,
        value: mf.value,
        type: mf.type
      };

      if (cleanMf.key === "moh_hardness" || cleanMf.key === "hardness") {
        cleanMf.key = "mohs_hardness";
      }

      const isMetaobjectType = cleanMf.type && cleanMf.type.includes("metaobject_reference");

      if (!isMetaobjectType && typeof cleanMf.value === "string" && cleanMf.value.includes("gid://shopify")) {
        console.warn(`GID Leak intercepted on ${cleanMf.key} for ${cleanMf.ownerId}. Skipping this metafield.`);
        return acc;
      }

      acc.push(cleanMf);
      return acc;
    }, []);

    const chunks = [];
    for (let i = 0; i < payload.length; i += 25) {
      chunks.push(payload.slice(i, i + 25));
    }

    let allErrors = [];
    for (const chunk of chunks) {
      console.log("Sending metafieldsSet chunk:", JSON.stringify(chunk, null, 2));

      try {
        const response = await admin.graphql(`
          #graphql
          mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }
        `, { variables: { metafields: chunk } });

        const json = await response.json();
        console.log("Received metafieldsSet response:", JSON.stringify(json, null, 2));

        const errors = json.data?.metafieldsSet?.userErrors ? json.data.metafieldsSet.userErrors : [];
        if (errors.length > 0) {
          allErrors = [...allErrors, ...errors];
        }
      } catch (error) {
        console.error("GraphQL execution failed for chunk:", error);
        allErrors.push({ field: ["graphql"], message: error.message });
      }
    }

    if (allErrors.length > 0) {
      return { success: false, errors: allErrors, message: "Failed to save some metafields." };
    }
    return { success: true, message: "Metafields securely updated in batches." };
  }

  if (intent === "fetchSingleProduct") {
    const productId = formData.get("productId");
    const response = await admin.graphql(`
      #graphql
      query GetSingleProduct($id: ID!) {
        product(id: $id) {
          id title status featuredImage { url altText }
          metafields(first: 50) {
            edges {
              node {
                id namespace key value type
              }
            }
          }
        }
      }
    `, { variables: { id: productId } });
    const json = await response.json();
    const product = json.data?.product ? json.data.product : null;

    if (product) {
      const officialNameMf = product.metafields.edges.find(e => e.node.key === "official_name");
      if (officialNameMf && /gid:\/\/shopify/.test(officialNameMf.node.value)) {
        console.warn(`Guard Triggered: official_name is a raw GID. Bypassing DB lookup to prevent hang.`);
      }
    }

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
          products(first: 10, after: $cursor) {
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
        batchCount = batchCount + 1;
      } else {
        hasNext = false;
      }
    }

    const filtered = allRaw.filter(p => !EXCLUDED_TITLES.includes(p.title));
    const hasMore = hasNext ? true : false;
    return { success: true, origins: filtered, hasMore };
  }

  if (intent === "validateGIDs") {
    const gids = JSON.parse(formData.get("gids"));
    const response = await admin.graphql(`
      #graphql
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
    const errors = createJson.data?.metaobjectCreate?.userErrors ? createJson.data.metaobjectCreate.userErrors : [];

    if (errors.length > 0 && errors[0].message.includes("type must exist")) {
      return { success: false, errors: [{ message: "Requires Metaobject Definition: 'meta_injector_snapshot' with fields: timestamp, action, scope, payload." }] };
    }

    const existingIds = JSON.parse(formData.get("existingIds") ? formData.get("existingIds") : "[]");
    if (existingIds.length >= 5) {
      const oldestId = existingIds[existingIds.length - 1];
      await admin.graphql(`
        #graphql
        mutation DeleteSnapshot($id: ID!) {
          metaobjectDelete(id: $id) { userErrors { message } }
        }
      `, { variables: { id: oldestId } });
    }

    return { success: true };
  }

  return { success: false, errors: [{ message: "Unknown command" }] };
}
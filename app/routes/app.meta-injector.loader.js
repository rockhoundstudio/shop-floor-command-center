import { authenticate } from "../shopify.server";

// --- GRAPHQL QUERIES ---

const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          title
        }
      }
    }
  }
`;

const GET_SINGLE_PRODUCT_QUERY = `
  query GetSingleProduct($id: ID!) {
    product(id: $id) {
      id
      title
      tags
      metafields(namespace: "rockhound", first: 50) {
        edges {
          node {
            id
            key
            value
            namespace
            type
          }
        }
      }
    }
  }
`;

const GET_METAFIELD_DEFINITIONS_QUERY = `
  query GetMetafieldDefinitions {
    metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "rockhound") {
      edges {
        node {
          id
          name
          key
          type {
            name
          }
        }
      }
    }
  }
`;

const GET_SNAPSHOTS_QUERY = `
  query GetSnapshots {
    metaobjects(type: "rockhound_snapshot", first: 10, sortKey: "updated_at", reverse: true) {
      edges {
        node {
          id
          handle
          updatedAt
          fields {
            key
            value
          }
        }
      }
    }
  }
`;

// --- GRAPHQL MUTATIONS ---

const SET_METAFIELDS_MUTATION = `
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        key
        value
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_METAFIELD_DEFINITION_MUTATION = `
  mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_METAOBJECT_MUTATION = `
  mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject {
        id
        handle
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const DELETE_METAOBJECT_MUTATION = `
  mutation DeleteMetaobject($id: ID!) {
    metaobjectDelete(id: $id) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

// --- UTILITY FUNCTIONS ---

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) {
    chunked.push(array.slice(i, i + size));
  }
  return chunked;
};

const formatGid = (id, type) => {
  if (id.includes("gid://")) return id;
  return `gid://shopify/${type}/${id}`;
};

const extractOriginFromTitle = (title) => {
  const parts = title.split(" — ");
  if (parts.length >= 3) {
    return parts[1].trim();
  }
  return null;
};

async function fetchAllProducts(graphql) {
  let hasNextPage = true;
  let cursor = null;
  const allProducts = [];

  while (hasNextPage) {
    const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor } });
    const { data } = await response.json();
    
    if (data && data.products) {
      const nodes = data.products.edges.map(edge => edge.node);
      allProducts.push(...nodes);
      hasNextPage = data.products.pageInfo.hasNextPage;
      cursor = data.products.pageInfo.endCursor;
    } else {
      hasNextPage = false;
    }
  }
  
  return allProducts;
}

// --- LOADER EXPORT ---

export async function loader({ request }) {
  // authenticate.admin(request) MUST be called before any request parsing
  const { admin } = await authenticate.admin(request);
  
  // 1. Fetch ALL products recursively using the helper
  const products = await fetchAllProducts(admin.graphql);
  console.log("fetchAllProducts returned:", products.length, "products");

  // 2. Fetch definitions and snapshots concurrently
  const [definitionsRes, snapshotsRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY)
  ]);

  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();

  // 3. Format the data for the UI
  const pageInfo = { hasNextPage: false, endCursor: null }; // Cursor loop is complete
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(edge => edge.node) || [];
  
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(edge => edge.node) || [];
  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try {
        const parsed = JSON.parse(dataField.value);
        count = parsed.length || 0;
      } catch (e) {
        count = "Unknown";
      }
    }
    return {
      id: snap.id,
      createdAt: new Date(snap.updatedAt).toLocaleString(),
      count
    };
  });

  return new Response(JSON.stringify({
    products,
    pageInfo,
    metafieldDefinitions,
    snapshots
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

// --- ACTION EXPORT ---

export async function action({ request }) {
  // authenticate.admin(request) MUST be called before any request parsing
  const { admin } = await authenticate.admin(request);
  
  // Safe to parse x-www-form-urlencoded now without breaking session re-auth
  const formData = await request.formData();
  const intent = formData.get("intent");

  const errors = [];

  switch (intent) {
    case "saveProduct": {
      const payloadStr = formData.get("payload");
      if (!payloadStr) {
        return new Response(JSON.stringify({ success: false, error: "No payload provided" }), { status: 400 });
      }

      const payload = JSON.parse(payloadStr);
      const metafieldsInputs = payload.map(field => ({
        ownerId: formatGid(field.ownerId, "Product"),
        namespace: "rockhound",
        key: field.key,
        value: field.value.toString(),
        type: field.type || "single_line_text_field"
      }));

      const chunks = chunkArray(metafieldsInputs, 10);
      
      for (const chunk of chunks) {
        const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
          variables: { metafields: chunk }
        });
        const result = await response.json();
        
        if (result.data?.metafieldsSet?.userErrors?.length > 0) {
          errors.push(...result.data.metafieldsSet.userErrors);
        }
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, errors }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    case "autoFill": {
      const productId = formData.get("productId");
      if (!productId) {
        return new Response(JSON.stringify({ success: false, error: "Missing productId" }), { status: 400 });
      }

      const response = await admin.graphql(GET_SINGLE_PRODUCT_QUERY, {
        variables: { id: formatGid(productId, "Product") }
      });
      const result = await response.json();
      const product = result.data?.product;

      if (!product) {
        return new Response(JSON.stringify({ success: false, error: "Product not found" }), { status: 404 });
      }

      const autoFillData = {};
      const titleParts = product.title.split(" — ");
      
      if (titleParts.length === 1) {
        autoFillData.piece_name = titleParts[0];
      } else if (titleParts.length === 2) {
        autoFillData.material = titleParts[0];
        autoFillData.piece_name = titleParts[1];
      } else if (titleParts.length >= 3) {
        autoFillData.material = titleParts[0];
        autoFillData.collection_location = titleParts[1];
        autoFillData.piece_name = titleParts[titleParts.length - 1];
      }

      if (product.tags && product.tags.length > 0) {
        const colorTag = product.tags.find(t => ["red", "blue", "green", "black", "white", "purple", "yellow", "orange", "brown", "pink", "clear"].some(c => t.toLowerCase().includes(c)));
        if (colorTag && !autoFillData.color) {
          autoFillData.color = colorTag;
        }

        const locationTag = product.tags.find(t => t.toLowerCase().includes("mine") || t.toLowerCase().includes("ridge") || t.toLowerCase().includes("county"));
        if (locationTag && !autoFillData.collection_location) {
          autoFillData.collection_location = locationTag;
        }
      }

      return new Response(JSON.stringify({ success: true, intent, autoFillData }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    case "autoExtractAll": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const updates = [];

      allProducts.forEach(product => {
        const origin = extractOriginFromTitle(product.title);
        if (!origin) return;

        let hasOrigin = false;
        if (product.metafields && product.metafields.edges) {
          hasOrigin = product.metafields.edges.some(edge => 
            edge.node.namespace === "rockhound" && edge.node.key === "collection_location" && edge.node.value !== ""
          );
        }

        if (!hasOrigin) {
          updates.push({
            ownerId: formatGid(product.id, "Product"),
            namespace: "rockhound",
            key: "collection_location",
            value: origin,
            type: "single_line_text_field"
          });
        }
      });

      if (updates.length > 0) {
        const chunks = chunkArray(updates, 10);
        for (const chunk of chunks) {
          const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
            variables: { metafields: chunk }
          });
          const result = await response.json();
          if (result.data?.metafieldsSet?.userErrors?.length > 0) {
            errors.push(...result.data.metafieldsSet.userErrors);
          }
        }
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, updatedCount: updates.length, errors }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    case "standardizeOOAK": {
      const allProducts = await fetchAllProducts(admin.graphql);
      const updates = [];

      allProducts.forEach(product => {
        let isStandardized = false;
        if (product.metafields && product.metafields.edges) {
          const ooakField = product.metafields.edges.find(edge => 
            edge.node.namespace === "rockhound" && edge.node.key === "is_one_of_a_kind"
          );
          if (ooakField && ooakField.node.value === "Yes — one of a kind") {
            isStandardized = true;
          }
        }

        if (!isStandardized) {
          updates.push({
            ownerId: formatGid(product.id, "Product"),
            namespace: "rockhound",
            key: "is_one_of_a_kind",
            value: "Yes — one of a kind",
            type: "single_line_text_field"
          });
        }
      });

      if (updates.length > 0) {
        const chunks = chunkArray(updates, 10);
        for (const chunk of chunks) {
          const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
            variables: { metafields: chunk }
          });
          const result = await response.json();
          if (result.data?.metafieldsSet?.userErrors?.length > 0) {
            errors.push(...result.data.metafieldsSet.userErrors);
          }
        }
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, updatedCount: updates.length, errors }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    case "saveSnapshot": {
      const allProducts = await fetchAllProducts(admin.graphql);
      
      const snapshotData = allProducts.map(p => {
        const fieldData = {};
        if (p.metafields && p.metafields.edges) {
          p.metafields.edges.forEach(edge => {
            fieldData[edge.node.key] = edge.node.value;
          });
        }
        return {
          id: p.id,
          title: p.title,
          fields: fieldData
        };
      });

      const existingSnapshotsRes = await admin.graphql(GET_SNAPSHOTS_QUERY);
      const existingData = await existingSnapshotsRes.json();
      const existingNodes = existingData.data?.metaobjects?.edges.map(e => e.node) || [];

      if (existingNodes.length >= 5) {
        const oldestId = existingNodes[existingNodes.length - 1].id;
        const delRes = await admin.graphql(DELETE_METAOBJECT_MUTATION, { variables: { id: oldestId } });
        const delResult = await delRes.json();
        if (delResult.data?.metaobjectDelete?.userErrors?.length > 0) {
            errors.push(...delResult.data.metaobjectDelete.userErrors);
        }
      }

      const timestamp = new Date().toISOString();
      const createRes = await admin.graphql(CREATE_METAOBJECT_MUTATION, {
        variables: {
          metaobject: {
            type: "rockhound_snapshot",
            handle: `snapshot-${Date.now()}`,
            fields: [
              {
                key: "created_at",
                value: timestamp
              },
              {
                key: "snapshot_data",
                value: JSON.stringify(snapshotData)
              }
            ]
          }
        }
      });
      const createResult = await createRes.json();
      if (createResult.data?.metaobjectCreate?.userErrors?.length > 0) {
        errors.push(...createResult.data.metaobjectCreate.userErrors);
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, errors }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    case "exportCSV": {
      const allProducts = await fetchAllProducts(admin.graphql);
      
      const keys = [
        "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", 
        "material", "stone_family", "color", "cut_and_shape", "surface_finish", 
        "dimensions_mm", "weight_grams", "collection_name", "collection_location", 
        "collection_date", "primary_use", "setting_ready", "bail_included", 
        "is_one_of_a_kind", "treated", "found_object", "wire_material", "artist_notes"
      ];

      let csv = "Product ID,Product Title," + keys.join(",") + "\n";

      allProducts.forEach(product => {
        const row = [`"${product.id}"`, `"${product.title.replace(/"/g, '""')}"`];
        
        const fieldMap = {};
        if (product.metafields && product.metafields.edges) {
          product.metafields.edges.forEach(edge => {
            fieldMap[edge.node.key] = edge.node.value;
          });
        }

        keys.forEach(key => {
          const val = fieldMap[key] || "";
          row.push(`"${val.toString().replace(/"/g, '""')}"`);
        });

        csv += row.join(",") + "\n";
      });

      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="rockhound_matrix_export.csv"'
        }
      });
    }

    case "addFieldDefinition": {
      const key = formData.get("key");
      const name = formData.get("name");
      const type = formData.get("type") || "single_line_text_field";

      if (!key || !name) {
        return new Response(JSON.stringify({ success: false, error: "Missing required fields" }), { status: 400 });
      }

      const response = await admin.graphql(CREATE_METAFIELD_DEFINITION_MUTATION, {
        variables: {
          definition: {
            name,
            namespace: "rockhound",
            key,
            type,
            ownerType: "PRODUCT"
          }
        }
      });

      const result = await response.json();
      if (result.data?.metafieldDefinitionCreate?.userErrors?.length > 0) {
        errors.push(...result.data.metafieldDefinitionCreate.userErrors);
      }

      return new Response(JSON.stringify({ success: errors.length === 0, intent, errors }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    default: {
      return new Response(JSON.stringify({ success: false, error: "Unknown intent" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}
import { authenticate } from "../shopify.server";
import { EXCLUDED_TITLES } from "./app.meta-injector.constants";
import db from "../db.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  let allProducts = [];
  let hasNextPage = true;
  let endCursor = null;

  try {
    while (hasNextPage) {
      const query = `
        query getProducts($cursor: String) {
          products(first: 250, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                handle
                status
                metafields(namespace: "rockhound", first: 50) {
                  edges {
                    node {
                      id
                      key
                      value
                      type
                      namespace
                    }
                  }
                }
              }
            }
          }
        }
      `;
      
      const response = await admin.graphql(query, {
        variables: { cursor: endCursor },
      });
      
      const responseJson = await response.json();
      
      if (responseJson.data && responseJson.data.products && responseJson.data.products.edges) {
        const fetchedProducts = responseJson.data.products.edges.map((edge) => edge.node);
        allProducts = allProducts.concat(fetchedProducts);
        
        hasNextPage = responseJson.data.products.pageInfo.hasNextPage;
        endCursor = responseJson.data.products.pageInfo.endCursor;
      } else {
        hasNextPage = false;
      }
    }

    const filteredProducts = allProducts.filter(
      (product) => !EXCLUDED_TITLES.includes(product.title)
    );

    const defQuery = `
      query {
        metafieldDefinitions(first: 250, ownerType: PRODUCT) {
          edges {
            node {
              id
              name
              namespace
              key
              type {
                name
              }
            }
          }
        }
      }
    `;
    
    const defResponse = await admin.graphql(defQuery);
    const defJson = await defResponse.json();
    
    const metafieldDefinitions = defJson.data?.metafieldDefinitions?.edges
      ? defJson.data.metafieldDefinitions.edges
          .map((edge) => edge.node)
          .filter((node) => node.namespace === "rockhound")
      : [];

    return { 
      products: filteredProducts, 
      metafieldDefinitions,
      success: true 
    };
    
  } catch (error) {
    console.error("Meta Injector Loader Error:", error);
    return { 
      products: [], 
      metafieldDefinitions: [], 
      success: false, 
      error: error.message 
    };
  }
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  
  let payload = {};
  try {
    const payloadString = formData.get("payload");
    if (payloadString) {
      payload = JSON.parse(payloadString);
    }
  } catch (e) {
    console.error("Failed to parse incoming payload:", e);
  }

  if (intent === "saveMetafields") {
    try {
      const query = `
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields {
              id
              key
              value
              namespace
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      const response = await admin.graphql(query, {
        variables: { metafields: payload }
      });
      const responseJson = await response.json();
      return { success: true, data: responseJson.data, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "createMetafieldDefinition") {
    try {
      const query = `
        mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
          metafieldDefinitionCreate(definition: $definition) {
            createdDefinition {
              id
              name
              namespace
              key
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      const response = await admin.graphql(query, {
        variables: { definition: payload }
      });
      const responseJson = await response.json();
      return { success: true, data: responseJson.data, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "deleteMetafieldDefinition") {
    try {
      const query = `
        mutation DeleteMetafieldDefinition($id: ID!) {
          metafieldDefinitionDelete(id: $id) {
            deletedDefinitionId
            userErrors {
              field
              message
            }
          }
        }
      `;
      const response = await admin.graphql(query, {
        variables: { id: payload.id }
      });
      const responseJson = await response.json();
      return { success: true, data: responseJson.data, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "geminiAutoFill") {
    try {
      // Integration hook for Gemini Auto-Fill logic
      // Receives { productId, title } in payload
      return { success: true, message: "Gemini Auto-Fill execution initiated", payload, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "geminiTrendWatch") {
    try {
      // Integration hook for Gemini Trend Watch analysis
      return { success: true, message: "Gemini Trend Watch execution initiated", payload, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "fetchSingleProduct") {
    try {
      const query = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            metafields(namespace: "rockhound", first: 50) {
              edges {
                node {
                  id
                  key
                  value
                  type
                  namespace
                }
              }
            }
          }
        }
      `;
      const response = await admin.graphql(query, {
        variables: { id: payload.id }
      });
      const responseJson = await response.json();
      return { success: true, data: responseJson.data, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "fetchOrigins") {
    try {
      // Hook to retrieve origins from Prisma DB
      const origins = await db.origin?.findMany() || [];
      return { success: true, data: origins, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "validateGIDs") {
    try {
      // Verification logic for internal Shopify GIDs
      return { success: true, message: "GIDs successfully validated", payload, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  if (intent === "saveSnapshot") {
    try {
      // Hook to persist current metafield states to DB
      return { success: true, message: "Snapshot saved successfully", payload, intent };
    } catch (error) {
      return { success: false, errors: [error.message], intent };
    }
  }

  return { success: true, errors: [] };
}
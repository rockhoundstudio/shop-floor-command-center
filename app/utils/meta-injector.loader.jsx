import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { FIELD_CATALOG, ROCKHOUND_FIELDS } from "./meta-injector.constants.jsx";
import { data as json } from "react-router";
import React, { useEffect } from "react";
import { useNavigate, useFetcher } from "react-router";
import { Page, Layout, BlockStack, Banner, Card, Text, Box, Button, Divider } from "@shopify/polaris";

const GET_PRODUCTS_QUERY = `
  query GetProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          title
          descriptionHtml
          images(first: 1) {
            edges {
              node {
                url
              }
            }
          }
          variants(first: 1) {
            edges {
              node {
                price
                inventoryItem {
                  measurement {
                    weight {
                      value
                      unit
                    }
                  }
                }
              }
            }
          }
          customMeta: metafields(first: 50, namespace: "custom") {
            edges { node { namespace key value type } }
          }
          rockhoundMeta: metafields(first: 50, namespace: "custom") {
            edges { node { namespace key value type } }
          }
          geoMeta: metafields(first: 50, namespace: "geo") {
            edges { node { namespace key value type } }
          }
        }
      }
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

const RETIRED_SAVE_KEYS = new Set([
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
  "custom.cut_and_shape", "custom.stone_shape", "custom.primary_use"
]);

const ALLOWED_STANDARDIZED_SAVE_KEYS = new Set([
  "chain-link-type",
  "construction",
  "jewelry-finding-type",
  "material-origin",
  "product-classification",
  "product-use"
]);

const CATALOG_DESTINATION_MAP = new Map();
if (Array.isArray(FIELD_CATALOG)) {
  FIELD_CATALOG.forEach((f) => {
    if (!f || f.owner === "native" || f.namespace === "native" || String(f.key || "").startsWith("native_")) return;
    if (f.key === "shopify_title" || f.key === "price") return;
    const ns = f.namespace || f.metaConfig?.namespace || "custom";
    const mk = f.metaKey || f.key;
    if (!ns || !mk) return;
    const dest = `${ns}.${mk}`;
    if (RETIRED_SAVE_KEYS.has(mk) || RETIRED_SAVE_KEYS.has(dest)) return;
    CATALOG_DESTINATION_MAP.set(dest, {
      namespace: ns,
      key: mk,
      type: f.metaConfig?.type || f.type || "single_line_text_field",
      mappingStatus: f.mappingStatus || "active",
      role: f.role || "custom_fact"
    });
  });
}

const chunkArray = (array, size) => {
  const chunked = [];
  for (let i = 0; i < array.length; i += size) chunked.push(array.slice(i, i + size));
  return chunked;
};

async function fetchAllProducts(graphql) {
  let allProducts = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await graphql(GET_PRODUCTS_QUERY, { variables: { cursor } });
    const { data } = await response.json();
    if (!data || !data.products) break;

    const edges = data.products.edges.map(edge => {
      const product = edge.node;
      const allEdges = [
        ...(product.customMeta?.edges || []),
        ...(product.rockhoundMeta?.edges || []),
        ...(product.geoMeta?.edges || []),
      ];
      
      const vNode = product.variants?.edges?.[0]?.node;
      if (vNode && vNode.inventoryItem?.measurement?.weight) {
        vNode.weight = vNode.inventoryItem.measurement.weight.value;
        vNode.weightUnit = vNode.inventoryItem.measurement.weight.unit;
      }

      return { ...product, metafields: { edges: allEdges } };
    });

    allProducts = allProducts.concat(edges);
    hasNextPage = data.products.pageInfo.hasNextPage;
    cursor = data.products.pageInfo.endCursor;
  }

  return allProducts;
}

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  const products = await fetchAllProducts(admin.graphql);
  console.log("PRODUCTS LOADED:", products.length, products.slice(0,3).map(p => p.title));
  
  const originPagesQuery = `
    query GetOriginPages {
      metaobjects(type: "origin_page", first: 50) {
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
  `;

  const [definitionsRes, snapshotsRes, originPagesRes] = await Promise.all([
    admin.graphql(GET_METAFIELD_DEFINITIONS_QUERY),
    admin.graphql(GET_SNAPSHOTS_QUERY),
    admin.graphql(originPagesQuery)
  ]);
  
  const definitionsData = await definitionsRes.json();
  const snapshotsData = await snapshotsRes.json();
  const originPagesData = await originPagesRes.json();
  
  const metafieldDefinitions = definitionsData.data?.metafieldDefinitions?.edges.map(e => e.node) || [];
  const rawSnapshots = snapshotsData.data?.metaobjects?.edges.map(e => e.node) || [];
  
  const originPages = (originPagesData.data?.metaobjects?.edges || []).map(edge => {
    const fields = {};
    edge.node.fields.forEach(f => { fields[f.key] = f.value; });
    return {
      id: edge.node.id,
      handle: edge.node.handle,
      display_name: fields.display_name || "",
      page_handle: fields.page_handle || "",
      location: fields.location || "",
      stone_types: fields.stone_types || ""
    };
  });

  const snapshots = rawSnapshots.map(snap => {
    const dataField = snap.fields.find(f => f.key === "snapshot_data");
    let count = 0;
    if (dataField && dataField.value) {
      try { count = JSON.parse(dataField.value).length || 0; } catch (e) { count = "Unknown"; }
    }
    return { id: snap.id, createdAt: new Date(snap.updatedAt).toLocaleString(), count };
  });
  
  return json({ products, pageInfo: { hasNextPage: false, endCursor: null }, metafieldDefinitions, snapshots, originPages });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const rawIntent = formData.get("intent");
  const intent = typeof rawIntent === "string" ? rawIntent.trim() : "";

  if (!intent) {
    return {
      intent: "unknown",
      success: false,
      status: "INVALID_INTENT",
      error: "Missing required action intent. Refusing to execute fallback or migration.",
      errors: [{ message: "Missing required action intent. Refusing to execute fallback or migration." }]
    };
  }

  if (intent === "saveProduct" || intent === "saveMetafields") {
    try {
      const payloadStr = formData.get("payload") || formData.get("metafields");
      let rawMetafields = [];
      if (payloadStr) {
        const parsed = JSON.parse(payloadStr);
        if (!Array.isArray(parsed)) {
          return {
            intent,
            success: false,
            error: "Metafields payload must be a JSON array.",
            errors: [{ message: "Metafields payload must be a JSON array." }]
          };
        }
        rawMetafields = parsed;
      }

      const fallbackProductIdRaw = formData.get("productId") || formData.get("pieceId") || "";
      const fallbackOwnerId =
        typeof fallbackProductIdRaw === "string" && fallbackProductIdRaw.trim() !== ""
          ? (fallbackProductIdRaw.trim().startsWith("gid://shopify/Product/")
              ? fallbackProductIdRaw.trim()
              : `gid://shopify/Product/${fallbackProductIdRaw.trim().split("/").pop()}`)
          : "";

      const unsupportedTargets = [];
      const blockedFields = {};

      // Validate requested native product changes strictly from form inputs without introducing new queries/mutations
      const requestedProductTitle = formData.get("productTitle");
      const requestedDescriptionHtml = formData.get("descriptionHtml");
      const requestedShippingWeightOz = formData.get("shippingWeightOz");
      const requestedWeightGrams = formData.get("weightGrams");
      const requestedNativeChanges = formData.get("nativeChanges");

      if (typeof requestedProductTitle === "string" && requestedProductTitle.trim() !== "") {
        unsupportedTargets.push("native_title");
        blockedFields["native_title"] = "Native productTitle updates are not supported in saveMetafields; use executeRepairPlan.";
      }

      if (typeof requestedDescriptionHtml === "string" && requestedDescriptionHtml.trim() !== "") {
        unsupportedTargets.push("native_description");
        blockedFields["native_description"] = "Native descriptionHtml updates are not supported in saveMetafields; use executeRepairPlan.";
      }

      if (typeof requestedShippingWeightOz === "string" && requestedShippingWeightOz.trim() !== "") {
        unsupportedTargets.push("native_shipping_weight");
        blockedFields["native_shipping_weight"] = "Native inventoryItem shippingWeightOz updates are not supported in saveMetafields; use executeRepairPlan.";
      }

      if (typeof requestedWeightGrams === "string" && requestedWeightGrams.trim() !== "") {
        const hasWeightMetafieldEntry = rawMetafields.some(
          (m) => m && typeof m === "object" && (m.key === "weight_grams" || m.key === "custom.weight_grams")
        );
        if (!hasWeightMetafieldEntry) {
          unsupportedTargets.push("weightGrams");
          blockedFields["weightGrams"] = "Top-level weightGrams parameter is not written outside the metafields array.";
        }
      }

      if (typeof requestedNativeChanges === "string" && requestedNativeChanges.trim() !== "" && requestedNativeChanges.trim() !== "{}") {
        unsupportedTargets.push("nativeChanges");
        blockedFields["nativeChanges"] = "Native product mutations (nativeChanges) are not supported in saveMetafields; use executeRepairPlan.";
      }

      const skippedKeys = [];
      const validatedMetafields = [];

      for (const mf of rawMetafields) {
        if (!mf || typeof mf !== "object") {
          unsupportedTargets.push("malformed_entry");
          blockedFields["malformed_entry"] = "Metafield entry must be a valid object.";
          continue;
        }

        const rawNs = typeof mf.namespace === "string" && mf.namespace.trim() !== "" ? mf.namespace.trim() : "";
        const rawKey = typeof mf.key === "string" ? mf.key.trim() : "";
        if (!rawNs || !rawKey) {
          const badKey = `${rawNs || "missing_ns"}.${rawKey || "missing_key"}`;
          unsupportedTargets.push(badKey);
          blockedFields[badKey] = "Metafield entry requires an explicit namespace and key.";
          continue;
        }

        const fullDest = `${rawNs}.${rawKey}`;

        if (RETIRED_SAVE_KEYS.has(rawKey) || RETIRED_SAVE_KEYS.has(fullDest)) {
          skippedKeys.push(fullDest);
          continue;
        }

        if (rawKey === "shopify_title" || rawKey === "price" || rawNs === "native" || rawKey.startsWith("native_")) {
          unsupportedTargets.push(fullDest);
          blockedFields[fullDest] = `Native target "${fullDest}" cannot be written as a metafield.`;
          continue;
        }

        const catalogContract = CATALOG_DESTINATION_MAP.get(fullDest);
        if (!catalogContract) {
          unsupportedTargets.push(fullDest);
          blockedFields[fullDest] = `Destination "${fullDest}" is not in the evidenced catalog contract.`;
          continue;
        }

        if (catalogContract.namespace === "shopify") {
          if (!ALLOWED_STANDARDIZED_SAVE_KEYS.has(catalogContract.key)) {
            unsupportedTargets.push(fullDest);
            blockedFields[fullDest] = `Standardized attribute "${fullDest}" is read-only (pending_read_only).`;
            continue;
          }
        } else if (catalogContract.namespace !== "custom") {
          unsupportedTargets.push(fullDest);
          blockedFields[fullDest] = `Unsupported metafield namespace "${catalogContract.namespace}" on "${fullDest}".`;
          continue;
        }

        const ownerIdRaw = typeof mf.ownerId === "string" && mf.ownerId.trim() !== "" ? mf.ownerId.trim() : fallbackOwnerId;
        if (!ownerIdRaw || !/^gid:\/\/shopify\/Product\/\d+$/.test(ownerIdRaw)) {
          unsupportedTargets.push(fullDest);
          blockedFields[fullDest] = `Missing or invalid Product GID ownerId for "${fullDest}".`;
          continue;
        }

        const valStr = mf.value !== undefined && mf.value !== null ? String(mf.value).trim() : "";
        if (valStr === "" || valStr === "See Shopify metaobject") {
          skippedKeys.push(fullDest);
          continue;
        }

        if (catalogContract.key === "collection_date" && /^(n\/a|none|unknown)$/i.test(valStr)) {
          skippedKeys.push(fullDest);
          continue;
        }

        const expectedType = catalogContract.type;
        const suppliedType = typeof mf.type === "string" && mf.type.trim() !== "" ? mf.type.trim() : expectedType;

        const isCompatibleType =
          suppliedType === expectedType ||
          (expectedType === "list.single_line_text_field" &&
            (suppliedType === "single_line_text_field" || suppliedType === "multi_line_text_field")) ||
          (expectedType === "number_decimal" && suppliedType === "single_line_text_field") ||
          (catalogContract.key === "is_ooak" && (suppliedType === "boolean" || suppliedType === "single_line_text_field"));

        if (!isCompatibleType) {
          unsupportedTargets.push(fullDest);
          blockedFields[fullDest] = `Type mismatch on "${fullDest}": supplied "${suppliedType}", contract expects "${expectedType}".`;
          continue;
        }

        const effectiveType = catalogContract.key === "is_ooak" && suppliedType === "boolean" ? "boolean" : expectedType;
        let formattedValue = valStr;

        if (effectiveType === "list.metaobject_reference" || effectiveType === "metaobject_reference") {
          try {
            const parsedIds = effectiveType.startsWith("list.")
              ? (formattedValue.startsWith("[") ? JSON.parse(formattedValue) : [formattedValue])
              : [formattedValue];
            if (
              !Array.isArray(parsedIds) ||
              parsedIds.length === 0 ||
              !parsedIds.every((id) => typeof id === "string" && /^gid:\/\/shopify\/Metaobject\/\d+$/.test(id.trim()))
            ) {
              unsupportedTargets.push(fullDest);
              blockedFields[fullDest] = `Destination "${fullDest}" requires exact Metaobject GID reference(s).`;
              continue;
            }
            formattedValue = effectiveType.startsWith("list.")
              ? JSON.stringify(parsedIds.map((id) => id.trim()))
              : parsedIds[0].trim();
          } catch (e) {
            unsupportedTargets.push(fullDest);
            blockedFields[fullDest] = `Malformed Metaobject GID reference payload for "${fullDest}".`;
            continue;
          }
        } else if (effectiveType === "list.single_line_text_field") {
          if (formattedValue.startsWith("[") && formattedValue.endsWith("]")) {
            try {
              const parsedArr = JSON.parse(formattedValue);
              if (!Array.isArray(parsedArr)) throw new Error("Not an array");
              formattedValue = JSON.stringify(parsedArr.map((item) => String(item ?? "").trim()).filter(Boolean));
            } catch (e) {
              formattedValue = JSON.stringify([formattedValue]);
            }
          } else {
            formattedValue = JSON.stringify([formattedValue]);
          }
        } else if (effectiveType === "number_decimal" || effectiveType === "number_integer") {
          const cleanNum = formattedValue.replace(/[^0-9.-]/g, "");
          const parsedNum = Number(cleanNum);
          if (!cleanNum || Number.isNaN(parsedNum)) {
            unsupportedTargets.push(fullDest);
            blockedFields[fullDest] = `Invalid numeric value "${formattedValue}" for "${fullDest}".`;
            continue;
          }
          formattedValue = effectiveType === "number_integer" ? String(Math.round(parsedNum)) : String(parsedNum);
        } else if (effectiveType === "boolean") {
          const lower = formattedValue.toLowerCase();
          if (lower !== "true" && lower !== "false") {
            unsupportedTargets.push(fullDest);
            blockedFields[fullDest] = `Invalid boolean value "${formattedValue}" for "${fullDest}".`;
            continue;
          }
          formattedValue = lower;
        } else if (effectiveType === "single_line_text_field") {
          if (/^gid:\/\/shopify\/Metaobject\//i.test(formattedValue) || formattedValue === "[object Object]") {
            unsupportedTargets.push(fullDest);
            blockedFields[fullDest] = `Rejected reference/object value for plain-text field "${fullDest}".`;
            continue;
          }
        }

        validatedMetafields.push({
          ownerId: ownerIdRaw,
          namespace: catalogContract.namespace,
          key: catalogContract.key,
          type: effectiveType,
          value: formattedValue
        });
      }

      const resolvedProductId = validatedMetafields[0]?.ownerId || fallbackOwnerId || null;

      if (unsupportedTargets.length > 0 || Object.keys(blockedFields).length > 0) {
        const uniqueUnsupported = Array.from(new Set(unsupportedTargets));
        const errMsg = `Save blocked before writing: unsupported or invalid targets detected (${uniqueUnsupported.join(", ")}).`;
        return {
          intent,
          pieceId: resolvedProductId,
          productId: resolvedProductId,
          success: false,
          status: "SAVE_BLOCKED",
          message: errMsg,
          error: errMsg,
          errors: Object.entries(blockedFields).map(([dest, msg]) => ({ destination: dest, field: dest, message: msg })),
          unsupportedKeys: uniqueUnsupported,
          blockedFields,
          skippedKeys
        };
      }

      if (validatedMetafields.length === 0) {
        return {
          intent,
          pieceId: resolvedProductId,
          productId: resolvedProductId,
          success: true,
          status: "NO_CHANGES_REQUIRED",
          fieldsUpdated: 0,
          message: "No supported metafield changes to save.",
          skippedKeys,
          unsupportedKeys: [],
          blockedFields: {}
        };
      }

      const chunks = chunkArray(validatedMetafields, 25);
      const savedMetafields = [];
      const userErrors = [];

      for (const chunk of chunks) {
        const response = await admin.graphql(SET_METAFIELDS_MUTATION, {
          variables: { metafields: chunk }
        });
        const result = await response.json();
        console.log("SHOPIFY RAW RESPONSE:", JSON.stringify(result, null, 2));

        if (result?.errors?.length) {
          userErrors.push(...result.errors.map((e) => ({ message: e.message })));
        }
        const chunkErrors = result?.data?.metafieldsSet?.userErrors || [];
        if (chunkErrors.length > 0) {
          console.log("SHOPIFY USER ERRORS:", JSON.stringify(chunkErrors, null, 2));
          userErrors.push(...chunkErrors);
        }
        const chunkSaved = result?.data?.metafieldsSet?.metafields || [];
        savedMetafields.push(...chunkSaved);
      }

      if (userErrors.length > 0) {
        return {
          intent,
          pieceId: resolvedProductId,
          productId: resolvedProductId,
          success: false,
          status: "SAVE_FAILED",
          error: userErrors.map((e) => e.message).join("; "),
          errors: userErrors,
          savedMetafields,
          skippedKeys
        };
      }

      return {
        intent,
        pieceId: resolvedProductId,
        productId: resolvedProductId,
        success: true,
        status: "SAVED",
        fieldsUpdated: savedMetafields.length,
        message: `Saved ${savedMetafields.length} metafield(s).`,
        savedMetafields,
        skippedKeys,
        unsupportedKeys: [],
        blockedFields: {},
        result: { data: { metafieldsSet: { metafields: savedMetafields, userErrors: [] } } }
      };
    } catch (error) {
      console.error("SAVE PRODUCT CATCH BLOCK FIRED:", error.message, error.stack);
      return { intent, success: false, error: error.message, errors: [{ message: error.message }] };
    }
  }

  if (intent === "standardizeOneOfAKind") {
    const results = [];
    let fixed = 0;

    try {
      const queryResponse = await admin.graphql(`
        #graphql
        query GetProductsForStandardize {
          products(first: 250) {
            edges {
              node {
                id
                title
                metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      id
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `);

      const json = await queryResponse.json();
      const products = json.data && json.data.products && json.data.products.edges
        ? json.data.products.edges.map(e => e.node)
        : [];

      const toFix = [];

      products.forEach(product => {
        if (product.metafields && product.metafields.edges) {
          product.metafields.edges.forEach(edge => {
            if (edge.node.key === "is_one_of_a_kind" && edge.node.value === "true") {
              toFix.push({
                ownerId: product.id,
                namespace: "custom",
                key: "is_one_of_a_kind",
                value: "Yes — one of a kind",
                type: "single_line_text_field"
              });
            }
          });
        }
      });

      if (toFix.length === 0) {
        results.push({ status: "success", message: "All products already standardized. Nothing to update." });
      } else {
        const chunks = [];
        for (let i = 0; i < toFix.length; i += 25) {
          chunks.push(toFix.slice(i, i + 25));
        }

        for (const chunk of chunks) {
          const setResponse = await admin.graphql(`
            #graphql
            mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                userErrors { field message }
              }
            }
          `, { variables: { metafields: chunk } });

          const setJson = await setResponse.json();
          const errors = setJson.data && setJson.data.metafieldsSet && setJson.data.metafieldsSet.userErrors
            ? setJson.data.metafieldsSet.userErrors
            : [];

          if (errors.length > 0) {
            results.push({ status: "error", message: `Chunk failed: ${errors[0].message}` });
          } else {
            fixed += chunk.length;
          }
        }

        results.push({ status: "success", message: `Done. Updated ${fixed} products to "Yes — one of a kind".` });
      }
    } catch (error) {
      results.push({ status: "error", message: `Standardize failed: ${error.message}` });
    }

    return { intent, results, fixed };
  }

  if (intent === "migrate") {
    const results = [];
    let productsProcessed = 0;
    let fieldsMigrated = 0;

    try {
      const queryResponse = await admin.graphql(`
        #graphql
        query GetAllProductsForMigration {
          products(first: 250) {
            edges {
              node {
                id
                title
                customMetafields: metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
                rockhoundMetafields: metafields(first: 50, namespace: "custom") {
                  edges {
                    node {
                      key
                      value
                    }
                  }
                }
              }
            }
          }
        }
      `);

      const json = await queryResponse.json();
      const products = json.data && json.data.products && json.data.products.edges
        ? json.data.products.edges.map(e => e.node)
        : [];

      const pendingUpdates = [];

      products.forEach(product => {
        const getCustom = (key) => {
          if (!product.customMetafields || !product.customMetafields.edges) return null;
          const field = product.customMetafields.edges.find(e => e.node.key === key);
          return field ? field.value : null;
        };

        const getRockhound = (key) => {
          if (!product.rockhoundMetafields || !product.rockhoundMetafields.edges) return null;
          const field = product.rockhoundMetafields.edges.find(e => e.node.key === key);
          return field ? field.value : null;
        };

        const custDim = getCustom("dimensions_mm");
        const custTreat = getCustom("treatment_status");
        const custStory = getCustom("stone_story");
        const custChar = getCustom("character_marks");

        const rhDim = getRockhound("dimensions_mm");
        const rhTreat = getRockhound("treated");
        const rhStory = getRockhound("origin_story");
        const rhFlaws = getRockhound("honest_flaws_and_character");

        let addedToThisProduct = false;

        const pushUpdate = (key, value, type) => {
          pendingUpdates.push({
            update: { ownerId: product.id, namespace: "custom", key, value, type },
            title: product.title
          });
          addedToThisProduct = true;
        };

        if (custDim && !rhDim) {
          pushUpdate("dimensions_mm", custDim, "single_line_text_field");
        }

        if (custTreat && !rhTreat) {
          pushUpdate("treated", custTreat, "single_line_text_field");
        }

        if (custStory && !rhStory) {
          pushUpdate("origin_story", custStory, "multi_line_text_field");
        }

        if (!rhFlaws && custChar) {
          pushUpdate("honest_flaws_and_character", custChar, "multi_line_text_field");
        }

        if (addedToThisProduct) {
          productsProcessed++;
        }
      });

      const chunks = [];
      for (let i = 0; i < pendingUpdates.length; i += 25) {
        chunks.push(pendingUpdates.slice(i, i + 25));
      }

      for (const chunk of chunks) {
        const metafields = chunk.map(c => c.update);

        const setResponse = await admin.graphql(`
          #graphql
          mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              userErrors { field message }
            }
          }
        `, { variables: { metafields } });

        const setJson = await setResponse.json();
        const errors = setJson.data && setJson.data.metafieldsSet && setJson.data.metafieldsSet.userErrors
          ? setJson.data.metafieldsSet.userErrors
          : [];

        if (errors.length > 0) {
          results.push({ status: "error", message: `Chunk failed: ${errors[0].message}` });
        } else {
          fieldsMigrated += chunk.length;
          chunk.forEach(c => {
            results.push({ status: "success", message: `Migrated '${c.update.key}' for product: ${c.title}` });
          });
        }
      }

      if (fieldsMigrated === 0 && results.length === 0) {
        results.push({ status: "success", message: `Scanned ${products.length} products. All fields are already migrated or blank.` });
      } else {
        results.unshift({ status: "success", message: `SUMMARY: Scanned ${products.length} products. Migrated ${fieldsMigrated} total fields across ${productsProcessed} items.` });
      }

    } catch (error) {
      results.push({ status: "error", message: `Migration completely failed: ${error.message}` });
    }

    return { intent: "migrate", results, productsProcessed, fieldsMigrated };
  }

  return {
    intent,
    success: false,
    status: "UNSUPPORTED_INTENT",
    error: `Unsupported action intent "${intent}" in meta-injector.loader.jsx. Refusing to run fallback or migration.`,
    errors: [{ message: `Unsupported action intent "${intent}" in meta-injector.loader.jsx. Refusing to run fallback or migration.` }]
  };
}

export default function MigrateDataRoute() {
  const navigate = useNavigate();
  const migrateFetcher = useFetcher();
  const standardizeFetcher = useFetcher();
  const shopify = typeof window !== "undefined" ? window.shopify : undefined;

  const isMigrating = migrateFetcher.state !== "idle";
  const isStandardizing = standardizeFetcher.state !== "idle";
  const migrateData = migrateFetcher.data;
  const standardizeData = standardizeFetcher.data;

  const handleRunMigration = () => {
    migrateFetcher.submit({ intent: "migrate" }, { method: "post" });
  };

  const handleStandardize = () => {
    standardizeFetcher.submit({ intent: "standardizeOneOfAKind" }, { method: "post" });
  };

  useEffect(() => {
    if (migrateFetcher.state === "idle" && migrateData && migrateData.results) {
      if (shopify) {
        const hasErrors = migrateData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Migration finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Successfully migrated ${migrateData.fieldsMigrated} fields!`);
        }
      }
    }
  }, [migrateFetcher.state, migrateData, shopify]);

  useEffect(() => {
    if (standardizeFetcher.state === "idle" && standardizeData && standardizeData.results) {
      if (shopify) {
        const hasErrors = standardizeData.results.some(r => r.status === "error");
        if (hasErrors) {
          shopify.toast.show("Standardize finished with some errors.", { isError: true });
        } else {
          shopify.toast.show(`Done. ${standardizeData.fixed} products updated.`);
        }
      }
    }
  }, [standardizeFetcher.state, standardizeData, shopify]);

  const StatusIcon = ({ status }) => {
    if (status === "success") return <span style={{ color: "#2E7D32" }}>✅</span>;
    return <span style={{ color: "#C62828" }}>❌</span>;
  };

  return (
    <Page
      title="Data Migration Engine"
      subtitle="Rockhound Studio Legacy Data Importer"
      backAction={{ content: "Dashboard", onAction: () => navigate("/app"), accessibilityLabel: "Back to Dashboard" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">

            <Banner tone="info" title="The Data Bundling Strategy">
              <p>
                This script safely grabs your old science fields (Mohs, cleavage, diaphaneity, etc.) and bundles them into a clean <b>Shop Specs</b> text string inside the new <b>Artist Notes</b> field. This keeps Google happy with keywords without forcing you to manage useless fields manually.
              </p>
            </Banner>

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Run Legacy Migration</Text>
                <Text as="p">
                  Clicking this button will scan your products, map the old data over to the new Freeform Revolution schema, and build the Shop Specs bundles.
                  (It is safe to run multiple times — it will just overwrite the new fields with the exact same legacy data).
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleRunMigration}
                      loading={isMigrating}
                      accessibilityLabel="Run Data Migration"
                    >
                      {isMigrating ? "Scanning and Migrating Data..." : "Run Auto-Migration"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {migrateData && migrateData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Migration Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {migrateData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
                        <StatusIcon status={result.status} />
                        <Text as="span" tone={result.status === "error" ? "critical" : "base"}>
                          {result.message}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

            <Card padding="600">
              <BlockStack gap="400">
                <Text variant="headingLg" as="h2">Standardize One of a Kind Values</Text>
                <Text as="p">
                  Finds every product where is_one_of_a_kind is set to "true" and updates it to "Yes — one of a kind" for consistent SEO and storefront display.
                </Text>
                <Box paddingBlockStart="400">
                  <div style={{ minHeight: "60px", minWidth: "100%" }}>
                    <Button
                      size="large"
                      variant="primary"
                      fullWidth
                      onClick={handleStandardize}
                      loading={isStandardizing}
                      accessibilityLabel="Standardize One of a Kind Values"
                    >
                      {isStandardizing ? "Standardizing..." : "Standardize One of a Kind Values"}
                    </Button>
                  </div>
                </Box>
              </BlockStack>
            </Card>

            {standardizeData && standardizeData.results && (
              <Card padding="600">
                <BlockStack gap="500">
                  <Text variant="headingLg" as="h3">Standardize Report</Text>
                  <Divider />
                  <BlockStack gap="300">
                    {standardizeData.results.map((result, idx) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 0", borderBottom: "1px solid #E1E3E5" }}>
                        <StatusIcon status={result.status} />
                        <Text as="span" tone={result.status === "error" ? "critical" : "base"}>
                          {result.message}
                        </Text>
                      </div>
                    ))}
                  </BlockStack>
                </BlockStack>
              </Card>
            )}

          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
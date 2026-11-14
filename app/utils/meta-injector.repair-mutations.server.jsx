// ==========================================================================
// ROCKHOUND STUDIO — REPAIR PLAN GRAPHQL WRITE EXECUTION & READ-BACK VERIFIER
// File: app/utils/meta-injector.repair-mutations.server.jsx
// ==========================================================================

import {
  paginateOwnerMetafieldsConnection
} from "./bench-v2.baseline.server.jsx";
import {
  chunkArray,
  attachChunkDestinationToUserErrors,
  attachNativeDestinationToUserErrors,
  areDescriptionHtmlEquivalentOnReadBack,
  parsePriceToCentsBigInt
} from "./meta-injector.repair-helpers.server.jsx";

export async function executeStagedRepairMutationsAndReadBack(ctx) {
  const {
    admin,
    pieceId,
    productGid,
    isBenchV2OptIn,
    repairPlan,
    nativeChanges,
    nativeInput,
    doNativeUpdate,
    doPriceUpdate,
    priceDestinationKey,
    priceVariantGid,
    newPriceString,
    doShippingWeightUpdate,
    shippingWeightInput,
    doImageAltUpdates,
    imageAltInputs,
    attemptedVariantMetafieldWrite,
    verifiedSingleVariantGid,
    variantCount,
    variantTargetStatus,
    resolvedVariantTargetForResponse,
    productCategory,
    hasMetafieldsBaseline,
    currentMetafields,
    currentMetafieldsTypes,
    currentVariantMetafields,
    currentVariantMetafieldTypes,
    currentVariantMetafieldIds,
    variantMetafieldsReadComplete,
    variantMetafieldsReadError,
    proposedChanges,
    setToShopify,
    deleteFromShopify,
    blockedFields,
    skippedKeys,
    unsupportedKeys,
    unchanged,
    attemptedDestinations,
    verifiedDestinations,
    unresolvedChanges
  } = ctx;

  let priceReadBackVerified = false;
  const allErrors = [];

  if (deleteFromShopify.length > 0) {
    const uniqueDel = new Map();
    deleteFromShopify.forEach(m => uniqueDel.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));
    const chunks = chunkArray(Array.from(uniqueDel.values()), 250);
    for (let i = 0; i < chunks.length; i++) {
      try {
        const deleteResponse = await admin.graphql(
          `#graphql
          mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) { userErrors { message field } }
          }`,
          { variables: { metafields: chunks[i] } }
        );
        const deleteJson = await deleteResponse.json();
        if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) {
          allErrors.push(...attachChunkDestinationToUserErrors(deleteJson.data.metafieldsDelete.userErrors, chunks[i], "metafields"));
        }
      } catch (delErr) { allErrors.push({ message: `API Error on Delete: ${delErr.message}` }); }
    }
  }

  if (setToShopify.length > 0) {
    const uniqueSet = new Map();
    setToShopify.forEach(m => uniqueSet.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));
    const dedupedItems = Array.from(uniqueSet.values());
    const chunks = chunkArray(dedupedItems, 25);
    for (let i = 0; i < chunks.length; i++) {
      const gqlChunkInput = chunks[i].map(({ ownerId, namespace, key, type, value }) => ({
        ownerId,
        namespace,
        key,
        type,
        value
      }));
      try {
        const setResponse = await admin.graphql(
          `#graphql
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }`,
          { variables: { metafields: gqlChunkInput } }
        );
        const setJson = await setResponse.json();
        if (setJson?.data?.metafieldsSet?.userErrors?.length) {
          allErrors.push(...attachChunkDestinationToUserErrors(setJson.data.metafieldsSet.userErrors, chunks[i], "metafields"));
        }
      } catch (setErr) { allErrors.push({ message: `API Error on Set: ${setErr.message}` }); }
    }
  }

  let nativeWriteSucceeded = false;
  if (doNativeUpdate) {
    try {
      const nativeResponse = await admin.graphql(
        `#graphql
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product { id }
            userErrors { field message }
          }
        }`,
        { variables: { input: nativeInput } }
      );
      const nativeJson = await nativeResponse.json();
      if (nativeJson?.data?.productUpdate?.userErrors?.length) {
        allErrors.push(...attachNativeDestinationToUserErrors(nativeJson.data.productUpdate.userErrors, nativeInput));
      } else {
        nativeWriteSucceeded = true;
      }
    } catch (nativeErr) {
      allErrors.push({ message: `API Error on Native Update: ${nativeErr.message}` });
    }
  }

  let priceWriteSucceeded = false;
  if (doPriceUpdate) {
    try {
      const priceResponse = await admin.graphql(
        `#graphql
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            product { id }
            productVariants { id price }
            userErrors { field message }
          }
        }`,
        { variables: { productId: productGid, variants: [{ id: priceVariantGid, price: newPriceString }] } }
      );
      const priceJson = await priceResponse.json();
      const bulkData = priceJson?.data?.productVariantsBulkUpdate;
      if (bulkData?.userErrors?.length) {
        allErrors.push(...bulkData.userErrors.map(uErr => ({ ...uErr, destination: priceDestinationKey })));
      } else if (!bulkData?.productVariants || !bulkData.productVariants.some(v => v.id === priceVariantGid)) {
        allErrors.push({ destination: priceDestinationKey, message: "Price update accepted by API but variant was not returned in success payload." });
      } else {
        priceWriteSucceeded = true;
      }
    } catch (priceErr) {
      allErrors.push({ destination: priceDestinationKey, message: `API Error on Price Update: ${priceErr.message}` });
    }
  }

  let shippingWeightSucceeded = false;
  if (doShippingWeightUpdate) {
     try {
        const swResponse = await admin.graphql(`
           #graphql
           mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
              inventoryItemUpdate(id: $id, input: $input) {
                 inventoryItem { id measurement { weight { value unit } } }
                 userErrors { field message }
              }
           }
        `, { variables: { id: shippingWeightInput.id, input: { measurement: shippingWeightInput.measurement } } });

        const swJson = await swResponse.json();
        const swData = swJson?.data?.inventoryItemUpdate;
        if (swData?.userErrors?.length) {
           allErrors.push(...swData.userErrors.map(uErr => ({ ...uErr, destination: "native_shipping_weight" })));
        } else {
           shippingWeightSucceeded = true;
        }
     } catch (swErr) {
        allErrors.push({ destination: "native_shipping_weight", message: `API Error on Shipping Weight Update: ${swErr.message}` });
     }
  }

  let imageAltUpdatesSucceeded = 0;
  if (doImageAltUpdates) {
     for (const imgInput of imageAltInputs) {
        try {
           const imgResponse = await admin.graphql(`
              #graphql
              mutation productUpdateMedia($media: [UpdateMediaInput!]!, $productId: ID!) {
                 productUpdateMedia(media: $media, productId: $productId) {
                    media { ... on MediaImage { id alt } }
                    userErrors { field message }
                 }
              }
           `, { variables: { productId: productGid, media: [{ id: imgInput.id, alt: imgInput.alt }] } });

           const imgJson = await imgResponse.json();
           const imgData = imgJson?.data?.productUpdateMedia;

           if (imgData?.userErrors?.length) {
              allErrors.push(...imgData.userErrors.map(uErr => ({
                 ...uErr,
                 destination: `native_image_alts_${imgInput.id}`
              })));
           } else {
              imageAltUpdatesSucceeded++;
           }
        } catch (imgErr) {
           allErrors.push({
              destination: `native_image_alts_${imgInput.id}`,
              message: `API Error on Image Alt Update for ${imgInput.id}: ${imgErr.message}`
           });
        }
     }
  }

  if (allErrors.length > 0) {
     allErrors.forEach(errObj => {
       if (errObj?.destination && !blockedFields[errObj.destination]) {
         blockedFields[errObj.destination] = errObj.message || "Shopify write error.";
       }
     });
     return Response.json({
       intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_FAILED",
       errors: allErrors,
       currentMetafields,
       currentMetafieldTypes: currentMetafieldsTypes,
       metafieldsReadComplete: hasMetafieldsBaseline,
       primaryVariantId: verifiedSingleVariantGid,
       variantCount,
       variantTargetStatus,
       currentVariantMetafields,
       currentVariantMetafieldTypes,
       currentVariantMetafieldIds,
       variantMetafieldsReadComplete,
       variantMetafieldsReadError,
       repairPlan, proposedChanges, fieldsUpdated: 0, legacyKeysRemoved: 0,
       conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write produced unhandled errors.",
       variantTarget: resolvedVariantTargetForResponse
     });
  }

  await new Promise(r => setTimeout(r, 600));

  let readBackVariantId = null;
  if (doPriceUpdate) readBackVariantId = priceVariantGid;
  if (doShippingWeightUpdate && nativeChanges.shippingWeight?.variantId) readBackVariantId = nativeChanges.shippingWeight.variantId;
  if (attemptedVariantMetafieldWrite && verifiedSingleVariantGid) readBackVariantId = verifiedSingleVariantGid;

  const readBackQuery = `
    query getProductAndVariant($id: ID!${readBackVariantId ? ', $variantId: ID!' : ''}) {
      product(id: $id) { 
        id
        title 
        descriptionHtml 
        seo { title description }
        category { id fullName }
        media(first: 50) { edges { node { ... on MediaImage { id alt } } } }
        metafields(first: 250) {
          pageInfo { hasNextPage endCursor }
          edges { node { id namespace key value type } }
        } 
      }
      ${readBackVariantId ? `
      node(id: $variantId) {
        ... on ProductVariant { 
           id 
           price 
           product { id } 
           inventoryItem { measurement { weight { value unit } } }
           metafields(first: 250) {
              pageInfo { hasNextPage endCursor }
              edges { node { id namespace key value type } }
           }
        }
      }
      ` : ''}
    }
  `;
  const readBackVars = { id: productGid };
  if (readBackVariantId) readBackVars.variantId = readBackVariantId;

  let readBackData = null;
  let readBackError = null;
  try {
    const readBackResponse = await admin.graphql(readBackQuery, { variables: readBackVars });
    readBackData = await readBackResponse.json();
    if (readBackData?.errors?.length) {
      readBackError = readBackData.errors.map(e => e.message).join("; ");
    }
  } catch (rbErr) {
    readBackError = rbErr.message || "Read-back query failed.";
  }

  const readBackProductNode = readBackData?.data?.product || null;
  const hasProductReadBack = Boolean(
    readBackProductNode &&
    readBackProductNode.id === productGid &&
    !readBackError
  );

  const hasTitleReadBack = hasProductReadBack && typeof readBackProductNode.title === "string";
  const hasBodyReadBack = hasProductReadBack && typeof readBackProductNode.descriptionHtml === "string";
  const hasSeoReadBack =
    hasProductReadBack &&
    readBackProductNode.seo !== null &&
    readBackProductNode.seo !== undefined &&
    typeof readBackProductNode.seo === "object" &&
    !Array.isArray(readBackProductNode.seo) &&
    Object.prototype.hasOwnProperty.call(readBackProductNode.seo, "title") &&
    Object.prototype.hasOwnProperty.call(readBackProductNode.seo, "description");
  const hasMediaReadBack = hasProductReadBack && Array.isArray(readBackProductNode.media?.edges);

  let newMetaList = [];
  let hasMetafieldsReadBack = false;
  if (hasProductReadBack && Array.isArray(readBackProductNode.metafields?.edges)) {
    const rbMfPageInfo = readBackProductNode.metafields.pageInfo;
    if (rbMfPageInfo && rbMfPageInfo.hasNextPage === true) {
      const rbMfPaginated = await paginateOwnerMetafieldsConnection({
        admin,
        ownerGid: productGid,
        connectionLabel: "Product metafields read-back",
        initialEdges: readBackProductNode.metafields.edges,
        initialPageInfo: rbMfPageInfo,
        maxPages: 10,
        buildPageQuery: () => `
          query getMoreProductMetafieldsReadBack($id: ID!, $cursor: String!) {
            product(id: $id) {
              metafields(first: 250, after: $cursor) {
                pageInfo { hasNextPage endCursor }
                edges { node { id namespace key value type } }
              }
            }
          }
        `,
        extractConnection: (json) => json?.data?.product?.metafields
      });
      newMetaList = rbMfPaginated.edges;
      hasMetafieldsReadBack = rbMfPaginated.isComplete === true;
    } else if (!rbMfPageInfo || rbMfPageInfo.hasNextPage === false) {
      newMetaList = readBackProductNode.metafields.edges;
      hasMetafieldsReadBack = true;
    }
  }

  const actualTitle = hasTitleReadBack ? readBackProductNode.title : undefined;
  const actualBodyHtml = hasBodyReadBack ? readBackProductNode.descriptionHtml : undefined;
  const actualSeoTitle = hasSeoReadBack && (typeof readBackProductNode.seo.title === "string" || readBackProductNode.seo.title === null)
    ? (readBackProductNode.seo.title ?? "")
    : undefined;
  const actualSeoDescription = hasSeoReadBack && (typeof readBackProductNode.seo.description === "string" || readBackProductNode.seo.description === null)
    ? (readBackProductNode.seo.description ?? "")
    : undefined;
  const actualMedia = hasMediaReadBack
    ? readBackProductNode.media.edges.filter(e => e && e.node && e.node.id)
    : [];

  const newMetafields = {};
  const newMetafieldTypes = {};
  newMetaList.forEach(e => {
    if (e?.node?.namespace && e?.node?.key) {
      const dotKey = `${e.node.namespace}.${e.node.key}`;
      newMetafields[dotKey] = e.node.value;
      newMetafieldTypes[dotKey] = typeof e.node.type === "string" ? e.node.type : null;
    }
  });

  const readBackVariantNode = readBackVariantId ? readBackData?.data?.node : null;
  const hasValidVariantNodeReadBack = Boolean(
    readBackVariantId &&
    readBackVariantNode &&
    readBackVariantNode.id === readBackVariantId &&
    readBackVariantNode.product?.id === productGid &&
    !readBackError
  );

  let hasVariantMetafieldsReadBack = false;
  let newVariantMetafields = currentVariantMetafields;
  let newVariantMetafieldTypes = currentVariantMetafieldTypes;
  let newVariantMetafieldIds = currentVariantMetafieldIds;
  let readBackVariantMetafieldsError = null;

  if (attemptedVariantMetafieldWrite) {
    if (!hasValidVariantNodeReadBack || !Array.isArray(readBackVariantNode?.metafields?.edges)) {
      hasVariantMetafieldsReadBack = false;
      readBackVariantMetafieldsError = readBackError || `Variant node ${String(readBackVariantId)} missing or owner mismatch on read-back.`;
    } else {
      const rbVarPageInfo = readBackVariantNode.metafields.pageInfo;
      let rbVarEdges = readBackVariantNode.metafields.edges;
      if (rbVarPageInfo && rbVarPageInfo.hasNextPage === true) {
        const rbVarPaginated = await paginateOwnerMetafieldsConnection({
          admin,
          ownerGid: readBackVariantId,
          connectionLabel: "Variant metafields read-back",
          initialEdges: readBackVariantNode.metafields.edges,
          initialPageInfo: rbVarPageInfo,
          maxPages: 10,
          buildPageQuery: () => `
            query getMoreVariantMetafieldsReadBack($id: ID!, $cursor: String!) {
              productVariant(id: $id) {
                id
                metafields(first: 250, after: $cursor) {
                  pageInfo { hasNextPage endCursor }
                  edges { node { id namespace key value type } }
                }
              }
            }
          `,
          extractConnection: (json) => json?.data?.productVariant?.metafields
        });
        rbVarEdges = rbVarPaginated.edges;
        hasVariantMetafieldsReadBack = rbVarPaginated.isComplete === true;
        readBackVariantMetafieldsError = rbVarPaginated.error || null;
      } else if (!rbVarPageInfo || rbVarPageInfo.hasNextPage === false) {
        hasVariantMetafieldsReadBack = true;
      }

      if (hasVariantMetafieldsReadBack) {
        newVariantMetafields = {};
        newVariantMetafieldTypes = {};
        newVariantMetafieldIds = {};
        for (const edge of rbVarEdges) {
          const node = edge?.node;
          if (!node || typeof node.namespace !== "string" || typeof node.key !== "string") continue;
          const dotKey = `${node.namespace}.${node.key}`;
          newVariantMetafields[dotKey] = node.value;
          newVariantMetafieldTypes[dotKey] = typeof node.type === "string" ? node.type : null;
          newVariantMetafieldIds[dotKey] = node.id || null;
        }
      }
    }
  }

  const unverifiedNativeFields = [];
  if (!hasTitleReadBack) unverifiedNativeFields.push("productTitle");
  if (!hasBodyReadBack) unverifiedNativeFields.push("descriptionHtml");
  if (!hasSeoReadBack) unverifiedNativeFields.push("seo");
  if (!hasMediaReadBack) unverifiedNativeFields.push("media");

  let readBackVerified = Boolean(
    hasProductReadBack &&
    hasMetafieldsReadBack &&
    (!attemptedVariantMetafieldWrite || hasVariantMetafieldsReadBack)
  );
  const conflicts = {};
  let verifiedReadBackPriceString = undefined;

  if (doPriceUpdate) {
     if (!priceWriteSucceeded) {
         readBackVerified = false;
         unverifiedNativeFields.push("price");
         unresolvedChanges[priceDestinationKey] = {
           ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
           reason: "API mutation failed",
           expected: newPriceString,
           actual: "Unchanged"
         };
     } else {
         const variantNode = readBackData?.data?.node;
         const variantMatchesProductAndTarget = Boolean(
           variantNode &&
           variantNode.id === priceVariantGid &&
           variantNode.product?.id === productGid &&
           typeof variantNode.price === "string" &&
           !readBackError
         );
         if (!variantMatchesProductAndTarget) {
             readBackVerified = false;
             unverifiedNativeFields.push("price");
             unresolvedChanges[priceDestinationKey] = {
               ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
               reason: "Missing, detached, or malformed variant node",
               expected: newPriceString,
               actual: "Unknown"
             };
             conflicts[priceDestinationKey] = {
               ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
               expected: newPriceString,
               actual: "Missing, detached, or malformed variant node"
             };
         } else {
             const isExactPriceMatch =
               priceDestinationKey === "native_price"
                 ? variantNode.price === newPriceString &&
                   parsePriceToCentsBigInt(variantNode.price) === parsePriceToCentsBigInt(newPriceString)
                 : parsePriceToCentsBigInt(variantNode.price) === parsePriceToCentsBigInt(newPriceString);

             if (!isExactPriceMatch) {
                 readBackVerified = false;
                 unverifiedNativeFields.push("price");
                 unresolvedChanges[priceDestinationKey] = {
                   ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
                   reason: "Read-back mismatch",
                   expected: newPriceString,
                   actual: variantNode.price
                 };
                 conflicts[priceDestinationKey] = {
                   ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
                   expected: newPriceString,
                   actual: variantNode.price
                 };
             } else {
                 priceReadBackVerified = true;
                 verifiedReadBackPriceString = variantNode.price;
                 verifiedDestinations.push(priceDestinationKey);
             }
         }
     }
  }

  const readBackNativeComplete = hasProductReadBack && unverifiedNativeFields.length === 0;
  const readBackNativeTargets = {
    productId: productGid,
    productTitle: hasTitleReadBack ? actualTitle : undefined,
    descriptionHtml: hasBodyReadBack ? actualBodyHtml : undefined,
    seo: hasSeoReadBack
      ? {
          title: actualSeoTitle,
          description: actualSeoDescription
        }
      : undefined,
    ...(priceReadBackVerified && typeof verifiedReadBackPriceString === "string"
      ? { price: verifiedReadBackPriceString }
      : {}),
    category: hasProductReadBack && readBackProductNode.category
      ? {
          id: readBackProductNode.category.id || null,
          fullName: readBackProductNode.category.fullName || null
        }
      : productCategory,
    media: hasMediaReadBack
      ? {
          edges: actualMedia.map(e => ({
            node: {
              id: e.node.id,
              alt: typeof e.node.alt === "string" ? e.node.alt : ""
            }
          }))
        }
      : undefined,
    isComplete: readBackNativeComplete,
    loadError: readBackError || (unverifiedNativeFields.length > 0 ? `Unverified native read-back fields: ${unverifiedNativeFields.join(", ")}` : null),
    unverifiedFields: unverifiedNativeFields
  };

  if (doNativeUpdate) {
      if (!nativeWriteSucceeded) {
          readBackVerified = false;
          if (nativeInput.descriptionHtml !== undefined) unresolvedChanges["native_description"] = { reason: "API mutation failed", expected: nativeInput.descriptionHtml, actual: "Unchanged" };
          if (nativeInput.seo?.title !== undefined) unresolvedChanges["native_seo_title"] = { reason: "API mutation failed", expected: nativeInput.seo.title, actual: "Unchanged" };
          if (nativeInput.seo?.description !== undefined) unresolvedChanges["native_seo_description"] = { reason: "API mutation failed", expected: nativeInput.seo.description, actual: "Unchanged" };
          if (nativeInput.title !== undefined) unresolvedChanges["native_title"] = { reason: "API mutation failed", expected: nativeInput.title, actual: "Unchanged" };
      } else {
          const verifyNativeFieldReadBack = (destKey, expectedVal, actualVal, hasFieldReadBack, missingFieldLabel, eqFn = (a, b) => a === b) => {
            if (expectedVal === undefined) return;
            if (!hasFieldReadBack) {
              readBackVerified = false;
              unresolvedChanges[destKey] = { reason: `Unverified native read-back (${missingFieldLabel} missing)`, expected: expectedVal, actual: "Unverified" };
              conflicts[destKey] = { expected: expectedVal, actual: "Unverified (missing from read-back)" };
            } else if (!eqFn(expectedVal, actualVal)) {
              readBackVerified = false;
              unresolvedChanges[destKey] = { reason: "Read-back mismatch", expected: expectedVal, actual: actualVal };
              conflicts[destKey] = { expected: expectedVal, actual: actualVal };
            } else {
              verifiedDestinations.push(destKey);
            }
          };

          verifyNativeFieldReadBack("native_description", nativeInput.descriptionHtml, actualBodyHtml, hasBodyReadBack, "descriptionHtml", areDescriptionHtmlEquivalentOnReadBack);
          verifyNativeFieldReadBack("native_seo_title", nativeInput.seo?.title, actualSeoTitle, actualSeoTitle !== undefined, "seo.title");
          verifyNativeFieldReadBack("native_seo_description", nativeInput.seo?.description, actualSeoDescription, actualSeoDescription !== undefined, "seo.description");
          verifyNativeFieldReadBack("native_title", nativeInput.title, actualTitle, hasTitleReadBack, "title");
      }
  }

  if (doShippingWeightUpdate) {
     if (!shippingWeightSucceeded) {
         readBackVerified = false;
         unresolvedChanges["native_shipping_weight"] = { reason: "API mutation failed", expected: shippingWeightInput.measurement.weight.value, actual: "Unchanged" };
     } else {
         const variantNode = readBackData?.data?.node;
         if (!variantNode || variantNode.id !== nativeChanges.shippingWeight.variantId) {
            readBackVerified = false;
            unresolvedChanges["native_shipping_weight"] = { reason: "Missing variant node", expected: shippingWeightInput.measurement.weight.value, actual: "Unknown" };
            conflicts["native_shipping_weight"] = { expected: shippingWeightInput.measurement.weight.value, actual: "Missing variant node" };
         } else {
            const actualWeight = variantNode.inventoryItem?.measurement?.weight?.value;
            const actualUnit = variantNode.inventoryItem?.measurement?.weight?.unit;
            const expectedWeight = shippingWeightInput.measurement.weight.value;
            const expectedUnit = shippingWeightInput.measurement.weight.unit;

            if (parseFloat(actualWeight) !== parseFloat(expectedWeight) || actualUnit !== expectedUnit) {
               readBackVerified = false;
               unresolvedChanges["native_shipping_weight"] = { reason: "Read-back mismatch", expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
               conflicts["native_shipping_weight"] = { expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
            } else {
               verifiedDestinations.push("native_shipping_weight");
            }
         }
     }
  }

  if (doImageAltUpdates) {
     for (const imgInput of imageAltInputs) {
        if (!hasMediaReadBack) {
           readBackVerified = false;
           unresolvedChanges[`native_image_alts_${imgInput.id}`] = { reason: "Unverified native read-back (media missing)", expected: imgInput.alt, actual: "Unverified" };
           conflicts[`native_image_alts_${imgInput.id}`] = { expected: imgInput.alt, actual: "Unverified (missing from read-back)" };
           continue;
        }
        const match = actualMedia.find(m => m.node.id === imgInput.id);
        if (!match || typeof match.node.alt !== "string" || match.node.alt !== imgInput.alt) {
           readBackVerified = false;
           unresolvedChanges[`native_image_alts_${imgInput.id}`] = { reason: "Read-back mismatch", expected: imgInput.alt, actual: match?.node?.alt ?? "Missing node" };
           conflicts[`native_image_alts_${imgInput.id}`] = { expected: imgInput.alt, actual: match?.node?.alt ?? "Missing node" };
        } else {
           verifiedDestinations.push(`native_image_alts_${imgInput.id}`);
        }
     }
  }

  setToShopify.forEach(m => {
     const dotKey = `${m.namespace}.${m.key}`;
     const isVariantItem = m.ownerType === "PRODUCTVARIANT" || m.ownerId !== productGid;

     if (isVariantItem) {
         if (!hasValidVariantNodeReadBack || !hasVariantMetafieldsReadBack || !newVariantMetafields) {
             readBackVerified = false;
             const reasonMsg = readBackVariantMetafieldsError || "Unverified variant metafield read-back";
             unresolvedChanges[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 reason: reasonMsg,
                 expected: String(m.value),
                 actual: "Unverified"
             };
             conflicts[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 expected: String(m.value),
                 actual: `Unverified (${reasonMsg})`
             };
             return;
         }

         const actualVarVal = newVariantMetafields[dotKey];
         const actualVarType = newVariantMetafieldTypes?.[dotKey] || null;
         const expVarStr = String(m.value);
         const actVarStr = actualVarVal !== undefined && actualVarVal !== null ? String(actualVarVal) : null;

         if (actualVarType !== m.type) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 reason: `Read-back type mismatch (expected ${m.type}, got ${actualVarType || "none"})`,
                 expected: expVarStr,
                 actual: actVarStr ?? "Missing"
             };
             conflicts[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 expected: expVarStr,
                 actual: actVarStr ?? "Missing"
             };
             return;
         }

         if (actVarStr === null || expVarStr !== actVarStr) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 reason: "Read-back value mismatch",
                 expected: expVarStr,
                 actual: actVarStr ?? "Missing"
             };
             conflicts[dotKey] = {
                 owner: "PRODUCTVARIANT",
                 variantId: m.ownerId,
                 expected: expVarStr,
                 actual: actVarStr ?? "Missing"
             };
         } else {
             verifiedDestinations.push(dotKey);
         }
         return;
     }

     if (!hasMetafieldsReadBack) {
         readBackVerified = false;
         unresolvedChanges[dotKey] = { reason: "Unverified metafield read-back", expected: String(m.value).trim(), actual: "Unverified" };
         conflicts[dotKey] = { expected: String(m.value).trim(), actual: "Unverified (missing from read-back)" };
         return;
     }
     const actual = newMetafields[dotKey];
     const actualProdType = newMetafieldTypes[dotKey] || null;
     let expStr = String(m.value).trim();
     let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();

     if ((isBenchV2OptIn || dotKey === "custom.whole_product_weight_grams") && actualProdType !== m.type) {
         readBackVerified = false;
         unresolvedChanges[dotKey] = {
             owner: "PRODUCT",
             reason: `Read-back type mismatch (expected ${m.type}, got ${actualProdType || "none"})`,
             expected: expStr,
             actual: actStr || "Missing"
         };
         conflicts[dotKey] = {
             owner: "PRODUCT",
             expected: expStr,
             actual: actStr || "Missing"
         };
         return;
     }

     if (m.type === "number_decimal") {
         if (parseFloat(expStr) !== parseFloat(actStr)) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = { reason: "Read-back mismatch", expected: expStr, actual: actStr };
             conflicts[dotKey] = { expected: expStr, actual: actStr };
         } else {
             verifiedDestinations.push(dotKey);
         }
     } else {
         if (expStr !== actStr) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = { reason: "Read-back mismatch", expected: expStr, actual: actStr };
             conflicts[dotKey] = { expected: expStr, actual: actStr };
         } else {
             verifiedDestinations.push(dotKey);
         }
     }
  });

  deleteFromShopify.forEach(m => {
     const dotKey = `${m.namespace}.${m.key}`;
     if (!hasMetafieldsReadBack) {
         readBackVerified = false;
         unresolvedChanges[dotKey] = { reason: "Unverified deletion read-back", expected: null, actual: "Unverified" };
         return;
     }
     if (newMetafields[dotKey] !== undefined) {
         readBackVerified = false;
         unresolvedChanges[dotKey] = { reason: "Deletion failed", expected: null, actual: newMetafields[dotKey] };
     } else {
         verifiedDestinations.push(dotKey);
     }
  });

  const verifiedSetCount = setToShopify.filter(m => verifiedDestinations.includes(`${m.namespace}.${m.key}`)).length;
  const verifiedImageAltCount = imageAltInputs.filter(img => verifiedDestinations.includes(`native_image_alts_${img.id}`)).length;
  const verifiedNativeTitleCount = verifiedDestinations.includes("native_title") ? 1 : 0;
  const verifiedNativeDescCount = verifiedDestinations.includes("native_description") ? 1 : 0;
  const verifiedNativeSeoTitleCount = verifiedDestinations.includes("native_seo_title") ? 1 : 0;
  const verifiedNativeSeoDescCount = verifiedDestinations.includes("native_seo_description") ? 1 : 0;
  const verifiedShippingWeightCount = verifiedDestinations.includes("native_shipping_weight") ? 1 : 0;
  const totalFieldsUpdated =
    verifiedSetCount +
    (priceReadBackVerified ? 1 : 0) +
    verifiedNativeTitleCount +
    verifiedNativeDescCount +
    verifiedNativeSeoTitleCount +
    verifiedNativeSeoDescCount +
    verifiedShippingWeightCount +
    verifiedImageAltCount;

  const hasUnresolved = Object.keys(unresolvedChanges).length > 0 || Object.keys(conflicts).length > 0;
  const hasExcluded = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;

  let finalStatus = "REPAIRED";
  let finalSuccess = true;

  if (hasUnresolved || hasExcluded) {
      finalStatus = "PARTIAL_SUCCESS";
      finalSuccess = false;
  }

  const diagnosticMsg = finalStatus === "PARTIAL_SUCCESS"
      ? `Partial execution: ${verifiedDestinations.length} verified. ${Object.keys(unresolvedChanges).length} unresolved, ${Object.keys(blockedFields).length} blocked, ${unsupportedKeys.length} unsupported.`
      : `Repair successful: ${verifiedDestinations.length} verified destinations.`;

  return Response.json({
    intent: "executeRepairPlan", pieceId, success: finalSuccess, status: finalStatus,
    fieldsUpdated: totalFieldsUpdated, legacyKeysRemoved: deleteFromShopify.length,
    message: diagnosticMsg,
    currentMetafields: hasMetafieldsReadBack ? newMetafields : currentMetafields,
    currentMetafieldTypes: hasMetafieldsReadBack ? newMetafieldTypes : currentMetafieldsTypes,
    metafieldsReadComplete: hasMetafieldsBaseline,
    primaryVariantId: verifiedSingleVariantGid,
    variantCount,
    variantTargetStatus,
    currentVariantMetafields: attemptedVariantMetafieldWrite
      ? (hasVariantMetafieldsReadBack ? newVariantMetafields : null)
      : currentVariantMetafields,
    currentVariantMetafieldTypes: attemptedVariantMetafieldWrite
      ? (hasVariantMetafieldsReadBack ? newVariantMetafieldTypes : null)
      : currentVariantMetafieldTypes,
    currentVariantMetafieldIds: attemptedVariantMetafieldWrite
      ? (hasVariantMetafieldsReadBack ? newVariantMetafieldIds : null)
      : currentVariantMetafieldIds,
    variantMetafieldsReadComplete: attemptedVariantMetafieldWrite
      ? hasVariantMetafieldsReadBack
      : variantMetafieldsReadComplete,
    variantMetafieldsReadError: attemptedVariantMetafieldWrite
      ? readBackVariantMetafieldsError
      : variantMetafieldsReadError,
    nativeTargets: readBackNativeTargets,
    productCategory: readBackNativeTargets.category || productCategory,
    repairPlan, proposedChanges, conflicts, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified,
    variantTarget: resolvedVariantTargetForResponse
  });
}
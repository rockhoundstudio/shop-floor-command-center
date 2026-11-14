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

function isFatalAuthOrTransportFailure(rawMessage) {
  if (typeof rawMessage !== "string") return false;
  const msg = rawMessage.trim();
  if (!msg) return false;
  return /\b(401|403|unauthorized|forbidden|invalid\s+api\s+key|access\s+token|expired\s+token|authentication|unauthenticated|econnreset|econnrefused|etimedout|enotfound|socket\s+hang\s+up|fetch\s+failed|network\s+error)\b/i.test(
    msg
  );
}

function isGlobalOwnerIdentityFailure(rawMessage) {
  if (typeof rawMessage !== "string") return false;
  const msg = rawMessage.trim();
  if (!msg) return false;
  return /\b(owner\s+does\s+not\s+exist|product\s+does\s+not\s+exist|product\s+not\s+found|owner\s+id\s+is\s+invalid)\b/i.test(
    msg
  );
}

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
  const rejectedMetafieldSetDestinations = new Map();
  const uncertainMetafieldSetDestinations = new Map();
  const notSubmittedMetafieldSetDestinations = new Map();
  const rejectedDeleteDestinations = new Map();
  const uncertainDeleteDestinations = new Map();
  const notSubmittedDeleteDestinations = new Map();
  let globalPrerequisiteAbortReason = null;

  const recordDestinationBlockedReason = (destKey, reasonMsg) => {
    if (!destKey) return;
    const cleanReason =
      typeof reasonMsg === "string" && reasonMsg.trim() !== ""
        ? reasonMsg.trim()
        : "Shopify rejected this destination.";
    if (!blockedFields[destKey]) {
      blockedFields[destKey] = cleanReason;
    } else if (!blockedFields[destKey].includes(cleanReason)) {
      blockedFields[destKey] = `${blockedFields[destKey]} | ${cleanReason}`;
    }
  };

  if (deleteFromShopify.length > 0) {
    const uniqueDel = new Map();
    deleteFromShopify.forEach(m => uniqueDel.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));
    const chunks = chunkArray(Array.from(uniqueDel.values()), 1);
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const item = currentChunk[0];
      const dotKey = item ? `${item.namespace}.${item.key}` : null;

      if (globalPrerequisiteAbortReason) {
        if (dotKey) {
          notSubmittedDeleteDestinations.set(
            dotKey,
            `Write skipped after global prerequisite/transport failure: ${globalPrerequisiteAbortReason}`
          );
        }
        continue;
      }

      try {
        const deleteResponse = await admin.graphql(
          `#graphql
          mutation metafieldsDelete($metafields: [MetafieldIdentifierInput!]!) {
            metafieldsDelete(metafields: $metafields) { userErrors { message field } }
          }`,
          { variables: { metafields: currentChunk } }
        );
        const deleteJson = await deleteResponse.json();
        if (Array.isArray(deleteJson?.errors) && deleteJson.errors.length > 0) {
          const gqlMsg = deleteJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          allErrors.push({
            ...(dotKey ? { destination: dotKey } : {}),
            message: `GraphQL Error on Delete${dotKey ? ` (${dotKey})` : ""}: ${gqlMsg}`
          });
          if (dotKey) {
            uncertainDeleteDestinations.set(dotKey, `GraphQL error during delete: ${gqlMsg}`);
          }
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
          continue;
        }

        if (deleteJson?.data?.metafieldsDelete?.userErrors?.length) {
          const attachedDelErrors = attachChunkDestinationToUserErrors(
            deleteJson.data.metafieldsDelete.userErrors,
            currentChunk,
            "metafields"
          ).map(errObj => (dotKey && !errObj.destination ? { ...errObj, destination: dotKey } : errObj));
          allErrors.push(...attachedDelErrors);
          const combinedMsg = attachedDelErrors.map(e => e?.message || "Shopify delete userError").join("; ");
          if (dotKey) {
            rejectedDeleteDestinations.set(dotKey, combinedMsg);
            recordDestinationBlockedReason(dotKey, combinedMsg);
          }
          if (isGlobalOwnerIdentityFailure(combinedMsg)) {
            globalPrerequisiteAbortReason = combinedMsg;
          }
        }
      } catch (delErr) {
        const errMsg = delErr?.message || "Unknown transport error on delete";
        allErrors.push({
          ...(dotKey ? { destination: dotKey } : {}),
          message: `API Error on Delete${dotKey ? ` (${dotKey})` : ""}: ${errMsg}`
        });
        if (dotKey) {
          uncertainDeleteDestinations.set(dotKey, `API transport error on delete: ${errMsg}`);
        }
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  if (setToShopify.length > 0) {
    const uniqueSet = new Map();
    setToShopify.forEach(m => uniqueSet.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));
    const dedupedItems = Array.from(uniqueSet.values());
    const chunks = chunkArray(dedupedItems, 1);
    for (let i = 0; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const item = currentChunk[0];
      const dotKey = item ? `${item.namespace}.${item.key}` : null;

      if (globalPrerequisiteAbortReason) {
        const skipMsg = `Write not attempted because an earlier fatal transport/authentication/owner error occurred: ${globalPrerequisiteAbortReason}`;
        if (dotKey) {
          notSubmittedMetafieldSetDestinations.set(dotKey, skipMsg);
        }
        allErrors.push({
          ...(dotKey ? { destination: dotKey, ownerId: item.ownerId || null, namespace: item.namespace, key: item.key } : {}),
          message: skipMsg
        });
        continue;
      }

      const gqlChunkInput = currentChunk.map(({ ownerId, namespace, key, type, value }) => ({
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
        if (Array.isArray(setJson?.errors) && setJson.errors.length > 0) {
          const gqlMsg = setJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          allErrors.push({
            ...(dotKey ? { destination: dotKey, ownerId: item.ownerId || null, namespace: item.namespace, key: item.key } : {}),
            message: `GraphQL Error on Set${dotKey ? ` (${dotKey})` : ""}: ${gqlMsg}`
          });
          if (dotKey) {
            uncertainMetafieldSetDestinations.set(dotKey, `GraphQL error on metafieldsSet: ${gqlMsg}`);
          }
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
          continue;
        }

        if (setJson?.data?.metafieldsSet?.userErrors?.length) {
          const attachedSetErrors = attachChunkDestinationToUserErrors(
            setJson.data.metafieldsSet.userErrors,
            currentChunk,
            "metafields"
          ).map(errObj =>
            dotKey && !errObj.destination
              ? {
                  ...errObj,
                  destination: dotKey,
                  ownerId: item.ownerId || null,
                  namespace: item.namespace,
                  key: item.key
                }
              : errObj
          );
          allErrors.push(...attachedSetErrors);
          const combinedMsg = attachedSetErrors.map(e => e?.message || "Shopify write error.").join("; ");
          if (dotKey) {
            rejectedMetafieldSetDestinations.set(dotKey, combinedMsg);
            recordDestinationBlockedReason(dotKey, combinedMsg);
          }
          if (isGlobalOwnerIdentityFailure(combinedMsg)) {
            globalPrerequisiteAbortReason = combinedMsg;
          }
        } else if (!setJson?.data?.metafieldsSet) {
          const missingPayloadMsg = `Missing metafieldsSet payload from Shopify${dotKey ? ` for ${dotKey}` : ""}.`;
          allErrors.push({
            ...(dotKey ? { destination: dotKey, ownerId: item.ownerId || null, namespace: item.namespace, key: item.key } : {}),
            message: missingPayloadMsg
          });
          if (dotKey) {
            uncertainMetafieldSetDestinations.set(dotKey, missingPayloadMsg);
          }
        }
      } catch (setErr) {
        const errMsg = setErr?.message || "Unknown transport error on metafieldsSet";
        allErrors.push({
          ...(dotKey ? { destination: dotKey, ownerId: item.ownerId || null, namespace: item.namespace, key: item.key } : {}),
          message: `API Error on Set${dotKey ? ` (${dotKey})` : ""}: ${errMsg}`
        });
        if (dotKey) {
          uncertainMetafieldSetDestinations.set(dotKey, `API transport error on Set: ${errMsg}`);
        }
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  let nativeWriteSucceeded = false;
  let nativeWriteUncertain = false;
  let nativeWriteErrorMessage = null;
  if (doNativeUpdate) {
    if (globalPrerequisiteAbortReason) {
      nativeWriteErrorMessage = `Write not attempted because an earlier fatal transport/authentication/owner error occurred: ${globalPrerequisiteAbortReason}`;
      allErrors.push({ message: nativeWriteErrorMessage });
    } else {
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
        if (Array.isArray(nativeJson?.errors) && nativeJson.errors.length > 0) {
          const gqlMsg = nativeJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          nativeWriteUncertain = true;
          nativeWriteErrorMessage = `GraphQL Error on Native Update: ${gqlMsg}`;
          allErrors.push({ message: nativeWriteErrorMessage });
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
        } else if (nativeJson?.data?.productUpdate?.userErrors?.length) {
          const attachedNativeErrors = attachNativeDestinationToUserErrors(
            nativeJson.data.productUpdate.userErrors,
            nativeInput
          );
          allErrors.push(...attachedNativeErrors);
          nativeWriteErrorMessage = attachedNativeErrors.map(e => e?.message || "Native product update error").join("; ");
          attachedNativeErrors.forEach(errObj => {
            if (errObj?.destination) {
              recordDestinationBlockedReason(errObj.destination, errObj.message || "Native product update error.");
            }
          });
          if (isGlobalOwnerIdentityFailure(nativeWriteErrorMessage)) {
            globalPrerequisiteAbortReason = nativeWriteErrorMessage;
          }
        } else if (nativeJson?.data?.productUpdate?.product?.id === productGid) {
          nativeWriteSucceeded = true;
        } else {
          nativeWriteUncertain = true;
          nativeWriteErrorMessage = "Native productUpdate returned without userErrors but product ID was missing or mismatched.";
          allErrors.push({ message: nativeWriteErrorMessage });
        }
      } catch (nativeErr) {
        const errMsg = nativeErr?.message || "Unknown transport error on Native Update";
        nativeWriteUncertain = true;
        nativeWriteErrorMessage = `API Error on Native Update: ${errMsg}`;
        allErrors.push({ message: nativeWriteErrorMessage });
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  let priceWriteSucceeded = false;
  let priceWriteUncertain = false;
  let priceWriteRejectedReason = null;
  if (doPriceUpdate) {
    if (globalPrerequisiteAbortReason) {
      priceWriteRejectedReason = `Write not attempted because an earlier fatal transport/authentication/owner error occurred: ${globalPrerequisiteAbortReason}`;
      allErrors.push({ destination: priceDestinationKey, message: priceWriteRejectedReason });
    } else {
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
        if (Array.isArray(priceJson?.errors) && priceJson.errors.length > 0) {
          const gqlMsg = priceJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          priceWriteUncertain = true;
          priceWriteRejectedReason = `GraphQL Error on Price Update: ${gqlMsg}`;
          allErrors.push({ destination: priceDestinationKey, message: priceWriteRejectedReason });
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
        } else if (bulkData?.userErrors?.length) {
          const mappedPriceErrors = bulkData.userErrors.map(uErr => ({ ...uErr, destination: priceDestinationKey }));
          allErrors.push(...mappedPriceErrors);
          priceWriteRejectedReason = mappedPriceErrors.map(e => e?.message || "Price update rejected").join("; ");
          recordDestinationBlockedReason(priceDestinationKey, priceWriteRejectedReason);
        } else if (!bulkData?.productVariants || !bulkData.productVariants.some(v => v.id === priceVariantGid)) {
          priceWriteUncertain = true;
          priceWriteRejectedReason = "Price update accepted by API but variant was not returned in success payload.";
          allErrors.push({ destination: priceDestinationKey, message: priceWriteRejectedReason });
        } else {
          priceWriteSucceeded = true;
        }
      } catch (priceErr) {
        const errMsg = priceErr?.message || "Unknown transport error on Price Update";
        priceWriteUncertain = true;
        priceWriteRejectedReason = `API Error on Price Update: ${errMsg}`;
        allErrors.push({ destination: priceDestinationKey, message: priceWriteRejectedReason });
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  let shippingWeightSucceeded = false;
  let shippingWeightUncertain = false;
  let shippingWeightErrorReason = null;
  if (doShippingWeightUpdate) {
    if (globalPrerequisiteAbortReason) {
      shippingWeightErrorReason = `Write not attempted because an earlier fatal transport/authentication/owner error occurred: ${globalPrerequisiteAbortReason}`;
      allErrors.push({ destination: "native_shipping_weight", message: shippingWeightErrorReason });
    } else {
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
        if (Array.isArray(swJson?.errors) && swJson.errors.length > 0) {
          const gqlMsg = swJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          shippingWeightUncertain = true;
          shippingWeightErrorReason = `GraphQL Error on Shipping Weight Update: ${gqlMsg}`;
          allErrors.push({ destination: "native_shipping_weight", message: shippingWeightErrorReason });
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
        } else if (swData?.userErrors?.length) {
          const mappedSwErrors = swData.userErrors.map(uErr => ({ ...uErr, destination: "native_shipping_weight" }));
          allErrors.push(...mappedSwErrors);
          shippingWeightErrorReason = mappedSwErrors.map(e => e?.message || "Shipping weight update rejected").join("; ");
          recordDestinationBlockedReason("native_shipping_weight", shippingWeightErrorReason);
        } else if (swData?.inventoryItem?.id) {
          shippingWeightSucceeded = true;
        } else {
          shippingWeightUncertain = true;
          shippingWeightErrorReason = "Shipping weight mutation returned without userErrors or inventoryItem payload.";
          allErrors.push({ destination: "native_shipping_weight", message: shippingWeightErrorReason });
        }
      } catch (swErr) {
        const errMsg = swErr?.message || "Unknown transport error on Shipping Weight Update";
        shippingWeightUncertain = true;
        shippingWeightErrorReason = `API Error on Shipping Weight Update: ${errMsg}`;
        allErrors.push({ destination: "native_shipping_weight", message: shippingWeightErrorReason });
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  let imageAltUpdatesSucceeded = 0;
  const rejectedImageAltDestinations = new Map();
  const uncertainImageAltDestinations = new Map();
  if (doImageAltUpdates) {
    for (const imgInput of imageAltInputs) {
      const imgDestKey = `native_image_alts_${imgInput.id}`;
      if (globalPrerequisiteAbortReason) {
        const skipMsg = `Write not attempted because an earlier fatal transport/authentication/owner error occurred: ${globalPrerequisiteAbortReason}`;
        uncertainImageAltDestinations.set(imgDestKey, skipMsg);
        allErrors.push({ destination: imgDestKey, message: skipMsg });
        continue;
      }

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

        if (Array.isArray(imgJson?.errors) && imgJson.errors.length > 0) {
          const gqlMsg = imgJson.errors.map(e => e?.message || "GraphQL error").join("; ");
          uncertainImageAltDestinations.set(imgDestKey, `GraphQL Error on Image Alt Update: ${gqlMsg}`);
          allErrors.push({
            destination: imgDestKey,
            message: `GraphQL Error on Image Alt Update for ${imgInput.id}: ${gqlMsg}`
          });
          if (isFatalAuthOrTransportFailure(gqlMsg) || isGlobalOwnerIdentityFailure(gqlMsg)) {
            globalPrerequisiteAbortReason = gqlMsg;
          }
        } else if (imgData?.userErrors?.length) {
          const mappedImgErrors = imgData.userErrors.map(uErr => ({
            ...uErr,
            destination: imgDestKey
          }));
          allErrors.push(...mappedImgErrors);
          const combinedImgErr = mappedImgErrors.map(e => e?.message || "Image alt update rejected").join("; ");
          rejectedImageAltDestinations.set(imgDestKey, combinedImgErr);
          recordDestinationBlockedReason(imgDestKey, combinedImgErr);
        } else {
          imageAltUpdatesSucceeded++;
        }
      } catch (imgErr) {
        const errMsg = imgErr?.message || "Unknown transport error on Image Alt Update";
        uncertainImageAltDestinations.set(imgDestKey, `API Error on Image Alt Update: ${errMsg}`);
        allErrors.push({
          destination: imgDestKey,
          message: `API Error on Image Alt Update for ${imgInput.id}: ${errMsg}`
        });
        if (isFatalAuthOrTransportFailure(errMsg)) {
          globalPrerequisiteAbortReason = errMsg;
        }
      }
    }
  }

  allErrors.forEach(errObj => {
    if (
      errObj?.destination &&
      !blockedFields[errObj.destination] &&
      !uncertainMetafieldSetDestinations.has(errObj.destination) &&
      !notSubmittedMetafieldSetDestinations.has(errObj.destination) &&
      !uncertainDeleteDestinations.has(errObj.destination) &&
      !notSubmittedDeleteDestinations.has(errObj.destination) &&
      !(errObj.destination === priceDestinationKey && priceWriteUncertain) &&
      !(errObj.destination === "native_shipping_weight" && shippingWeightUncertain) &&
      !uncertainImageAltDestinations.has(errObj.destination)
    ) {
      blockedFields[errObj.destination] = errObj.message || "Shopify write error.";
    }
  });

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
    const variantNode = readBackData?.data?.node;
    const variantMatchesProductAndTarget = Boolean(
      variantNode &&
      variantNode.id === priceVariantGid &&
      variantNode.product?.id === productGid &&
      typeof variantNode.price === "string" &&
      !readBackError
    );

    if (!priceWriteSucceeded && !priceWriteUncertain) {
      readBackVerified = false;
      unverifiedNativeFields.push("price");
      const actualPriceAfterReject = variantMatchesProductAndTarget ? variantNode.price : "Unchanged";
      unresolvedChanges[priceDestinationKey] = {
        ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
        reason: priceWriteRejectedReason || "API mutation failed",
        expected: newPriceString,
        actual: actualPriceAfterReject
      };
    } else if (!variantMatchesProductAndTarget) {
      readBackVerified = false;
      unverifiedNativeFields.push("price");
      const missingVarReason = priceWriteUncertain && priceWriteRejectedReason
        ? `${priceWriteRejectedReason}; variant read-back missing or unverified`
        : "Missing, detached, or malformed variant node";
      unresolvedChanges[priceDestinationKey] = {
        ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
        reason: missingVarReason,
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
        const mismatchReason = priceWriteUncertain && priceWriteRejectedReason
          ? `${priceWriteRejectedReason} (read-back price is ${variantNode.price})`
          : "Read-back mismatch";
        unresolvedChanges[priceDestinationKey] = {
          ...(priceDestinationKey === "native_price" ? { owner: "PRODUCTVARIANT", variantId: priceVariantGid } : {}),
          reason: mismatchReason,
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
    if (!nativeWriteSucceeded && !nativeWriteUncertain) {
      readBackVerified = false;
      const failReason = nativeWriteErrorMessage || "API mutation failed";
      if (nativeInput.descriptionHtml !== undefined) {
        unresolvedChanges["native_description"] = {
          reason: blockedFields["native_description"] || failReason,
          expected: nativeInput.descriptionHtml,
          actual: hasBodyReadBack ? actualBodyHtml : "Unchanged"
        };
      }
      if (nativeInput.seo?.title !== undefined) {
        unresolvedChanges["native_seo_title"] = {
          reason: blockedFields["native_seo_title"] || failReason,
          expected: nativeInput.seo.title,
          actual: actualSeoTitle !== undefined ? actualSeoTitle : "Unchanged"
        };
      }
      if (nativeInput.seo?.description !== undefined) {
        unresolvedChanges["native_seo_description"] = {
          reason: blockedFields["native_seo_description"] || failReason,
          expected: nativeInput.seo.description,
          actual: actualSeoDescription !== undefined ? actualSeoDescription : "Unchanged"
        };
      }
      if (nativeInput.title !== undefined) {
        unresolvedChanges["native_title"] = {
          reason: blockedFields["native_title"] || failReason,
          expected: nativeInput.title,
          actual: hasTitleReadBack ? actualTitle : "Unchanged"
        };
      }
    } else {
      const verifyNativeFieldReadBack = (destKey, expectedVal, actualVal, hasFieldReadBack, missingFieldLabel, eqFn = (a, b) => a === b) => {
        if (expectedVal === undefined) return;
        if (!hasFieldReadBack) {
          readBackVerified = false;
          const unvReason = nativeWriteUncertain && nativeWriteErrorMessage
            ? `${nativeWriteErrorMessage}; native read-back (${missingFieldLabel}) missing`
            : `Unverified native read-back (${missingFieldLabel} missing)`;
          unresolvedChanges[destKey] = { reason: unvReason, expected: expectedVal, actual: "Unverified" };
          conflicts[destKey] = { expected: expectedVal, actual: "Unverified (missing from read-back)" };
        } else if (!eqFn(expectedVal, actualVal)) {
          readBackVerified = false;
          const mismatchReason = nativeWriteUncertain && nativeWriteErrorMessage
            ? `${nativeWriteErrorMessage} (read-back did not match)`
            : "Read-back mismatch";
          unresolvedChanges[destKey] = { reason: mismatchReason, expected: expectedVal, actual: actualVal };
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
    if (!shippingWeightSucceeded && !shippingWeightUncertain) {
      readBackVerified = false;
      unresolvedChanges["native_shipping_weight"] = {
        reason: shippingWeightErrorReason || "API mutation failed",
        expected: shippingWeightInput.measurement.weight.value,
        actual: "Unchanged"
      };
    } else {
      const variantNode = readBackData?.data?.node;
      if (!variantNode || variantNode.id !== nativeChanges.shippingWeight.variantId) {
        readBackVerified = false;
        const missingReason = shippingWeightUncertain && shippingWeightErrorReason
          ? `${shippingWeightErrorReason}; variant node missing on read-back`
          : "Missing variant node";
        unresolvedChanges["native_shipping_weight"] = { reason: missingReason, expected: shippingWeightInput.measurement.weight.value, actual: "Unknown" };
        conflicts["native_shipping_weight"] = { expected: shippingWeightInput.measurement.weight.value, actual: "Missing variant node" };
      } else {
        const actualWeight = variantNode.inventoryItem?.measurement?.weight?.value;
        const actualUnit = variantNode.inventoryItem?.measurement?.weight?.unit;
        const expectedWeight = shippingWeightInput.measurement.weight.value;
        const expectedUnit = shippingWeightInput.measurement.weight.unit;

        if (parseFloat(actualWeight) !== parseFloat(expectedWeight) || actualUnit !== expectedUnit) {
          readBackVerified = false;
          const swMismatchReason = shippingWeightUncertain && shippingWeightErrorReason
            ? `${shippingWeightErrorReason} (read-back weight mismatch)`
            : "Read-back mismatch";
          unresolvedChanges["native_shipping_weight"] = { reason: swMismatchReason, expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
          conflicts["native_shipping_weight"] = { expected: `${expectedWeight} ${expectedUnit}`, actual: `${actualWeight} ${actualUnit}` };
        } else {
          verifiedDestinations.push("native_shipping_weight");
        }
      }
    }
  }

  if (doImageAltUpdates) {
    for (const imgInput of imageAltInputs) {
      const imgDestKey = `native_image_alts_${imgInput.id}`;
      if (rejectedImageAltDestinations.has(imgDestKey)) {
        readBackVerified = false;
        const rejReason = rejectedImageAltDestinations.get(imgDestKey);
        const matchAfterRej = hasMediaReadBack ? actualMedia.find(m => m.node.id === imgInput.id) : null;
        unresolvedChanges[imgDestKey] = {
          reason: rejReason,
          expected: imgInput.alt,
          actual: matchAfterRej?.node?.alt ?? "Unchanged"
        };
        continue;
      }
      if (!hasMediaReadBack) {
        readBackVerified = false;
        const unvImgReason = uncertainImageAltDestinations.get(imgDestKey)
          ? `${uncertainImageAltDestinations.get(imgDestKey)}; media read-back missing`
          : "Unverified native read-back (media missing)";
        unresolvedChanges[imgDestKey] = { reason: unvImgReason, expected: imgInput.alt, actual: "Unverified" };
        conflicts[imgDestKey] = { expected: imgInput.alt, actual: "Unverified (missing from read-back)" };
        continue;
      }
      const match = actualMedia.find(m => m.node.id === imgInput.id);
      if (!match || typeof match.node.alt !== "string" || match.node.alt !== imgInput.alt) {
        readBackVerified = false;
        const mismatchImgReason = uncertainImageAltDestinations.get(imgDestKey) || "Read-back mismatch";
        unresolvedChanges[imgDestKey] = { reason: mismatchImgReason, expected: imgInput.alt, actual: match?.node?.alt ?? "Missing node" };
        conflicts[imgDestKey] = { expected: imgInput.alt, actual: match?.node?.alt ?? "Missing node" };
      } else {
        verifiedDestinations.push(imgDestKey);
      }
    }
  }

  const uniqueSetForVerification = new Map();
  setToShopify.forEach(m => uniqueSetForVerification.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));

  Array.from(uniqueSetForVerification.values()).forEach(m => {
    const dotKey = `${m.namespace}.${m.key}`;
    const isVariantItem = m.ownerType === "PRODUCTVARIANT" || m.ownerId !== productGid;
    const explicitRejectionReason = rejectedMetafieldSetDestinations.get(dotKey) || null;
    const uncertainSetReason = uncertainMetafieldSetDestinations.get(dotKey) || null;
    const notSubmittedSetReason = notSubmittedMetafieldSetDestinations.get(dotKey) || null;

    if (explicitRejectionReason) {
      readBackVerified = false;
      recordDestinationBlockedReason(dotKey, explicitRejectionReason);
      return;
    }

    if (notSubmittedSetReason) {
      readBackVerified = false;
      unresolvedChanges[dotKey] = {
        ...(isVariantItem ? { owner: "PRODUCTVARIANT", variantId: m.ownerId } : { owner: "PRODUCT" }),
        reason: notSubmittedSetReason,
        expected: String(m.value),
        actual: "Not submitted (prior fatal transport/authentication/owner failure)"
      };
      return;
    }

    if (isVariantItem) {
      if (!hasValidVariantNodeReadBack || !hasVariantMetafieldsReadBack || !newVariantMetafields) {
        readBackVerified = false;
        const baseVarReason = readBackVariantMetafieldsError || "Unverified variant metafield read-back";
        const reasonMsg = uncertainSetReason
          ? `${uncertainSetReason}; ${baseVarReason}`
          : baseVarReason;
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
        const typeMismatchReason = uncertainSetReason
          ? `${uncertainSetReason} (read-back type ${actualVarType || "none"}, expected ${m.type})`
          : `Read-back type mismatch (expected ${m.type}, got ${actualVarType || "none"})`;
        unresolvedChanges[dotKey] = {
          owner: "PRODUCTVARIANT",
          variantId: m.ownerId,
          reason: typeMismatchReason,
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
        const valMismatchReason = uncertainSetReason
          ? `${uncertainSetReason} (read-back value did not match expected proposal)`
          : "Read-back value mismatch";
        unresolvedChanges[dotKey] = {
          owner: "PRODUCTVARIANT",
          variantId: m.ownerId,
          reason: valMismatchReason,
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
      const unvProdReason = uncertainSetReason
        ? `${uncertainSetReason}; unverified metafield read-back`
        : "Unverified metafield read-back";
      unresolvedChanges[dotKey] = { reason: unvProdReason, expected: String(m.value).trim(), actual: "Unverified" };
      conflicts[dotKey] = { expected: String(m.value).trim(), actual: "Unverified (missing from read-back)" };
      return;
    }
    const actual = newMetafields[dotKey];
    const actualProdType = newMetafieldTypes[dotKey] || null;
    let expStr = String(m.value).trim();
    let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();

    if ((isBenchV2OptIn || dotKey === "custom.whole_product_weight_grams") && actualProdType !== m.type) {
      readBackVerified = false;
      const prodTypeMismatchReason = uncertainSetReason
        ? `${uncertainSetReason} (read-back type ${actualProdType || "none"}, expected ${m.type})`
        : `Read-back type mismatch (expected ${m.type}, got ${actualProdType || "none"})`;
      unresolvedChanges[dotKey] = {
        owner: "PRODUCT",
        reason: prodTypeMismatchReason,
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
        const decMismatchReason = uncertainSetReason
          ? `${uncertainSetReason} (read-back decimal mismatch)`
          : "Read-back mismatch";
        unresolvedChanges[dotKey] = { reason: decMismatchReason, expected: expStr, actual: actStr };
        conflicts[dotKey] = { expected: expStr, actual: actStr };
      } else {
        verifiedDestinations.push(dotKey);
      }
    } else {
      if (expStr !== actStr) {
        readBackVerified = false;
        const strMismatchReason = uncertainSetReason
          ? `${uncertainSetReason} (read-back value mismatch)`
          : "Read-back mismatch";
        unresolvedChanges[dotKey] = { reason: strMismatchReason, expected: expStr, actual: actStr };
        conflicts[dotKey] = { expected: expStr, actual: actStr };
      } else {
        verifiedDestinations.push(dotKey);
      }
    }
  });

  const uniqueDelForVerification = new Map();
  deleteFromShopify.forEach(m => uniqueDelForVerification.set(`${m.ownerId}:${m.namespace}:${m.key}`, m));

  Array.from(uniqueDelForVerification.values()).forEach(m => {
    const dotKey = `${m.namespace}.${m.key}`;
    const explicitDelReject = rejectedDeleteDestinations.get(dotKey) || null;
    const uncertainDelReason = uncertainDeleteDestinations.get(dotKey) || null;
    const notSubmittedDelReason = notSubmittedDeleteDestinations.get(dotKey) || null;

    if (explicitDelReject) {
      readBackVerified = false;
      recordDestinationBlockedReason(dotKey, explicitDelReject);
      return;
    }

    if (notSubmittedDelReason) {
      readBackVerified = false;
      unresolvedChanges[dotKey] = {
        reason: notSubmittedDelReason,
        expected: null,
        actual: "Not submitted (prior fatal transport/authentication/owner failure)"
      };
      return;
    }

    if (!hasMetafieldsReadBack) {
      readBackVerified = false;
      const unvDelReason = uncertainDelReason
        ? `${uncertainDelReason}; unverified deletion read-back`
        : "Unverified deletion read-back";
      unresolvedChanges[dotKey] = { reason: unvDelReason, expected: null, actual: "Unverified" };
      return;
    }
    if (newMetafields[dotKey] !== undefined) {
      readBackVerified = false;
      const delFailReason = uncertainDelReason || "Deletion failed";
      unresolvedChanges[dotKey] = { reason: delFailReason, expected: null, actual: newMetafields[dotKey] };
    } else {
      verifiedDestinations.push(dotKey);
    }
  });

  const verifiedSetCount = Array.from(uniqueSetForVerification.values()).filter(m =>
    verifiedDestinations.includes(`${m.namespace}.${m.key}`)
  ).length;
  const verifiedDeleteCount = Array.from(uniqueDelForVerification.values()).filter(m =>
    verifiedDestinations.includes(`${m.namespace}.${m.key}`)
  ).length;
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
  const hasAnyErrors = allErrors.length > 0;

  let finalStatus = "REPAIRED";
  let finalSuccess = true;

  if (verifiedDestinations.length === 0 && (hasUnresolved || hasExcluded || hasAnyErrors)) {
    finalStatus = "REPAIR_FAILED";
    finalSuccess = false;
  } else if (hasUnresolved || hasExcluded || hasAnyErrors) {
    finalStatus = "PARTIAL_SUCCESS";
    finalSuccess = false;
  }

  let diagnosticMsg = `Repair successful: ${verifiedDestinations.length} verified destinations.`;
  if (finalStatus === "PARTIAL_SUCCESS") {
    diagnosticMsg = `Partial execution: ${verifiedDestinations.length} verified. ${Object.keys(unresolvedChanges).length} unresolved, ${Object.keys(blockedFields).length} blocked, ${unsupportedKeys.length} unsupported.`;
  } else if (finalStatus === "REPAIR_FAILED") {
    diagnosticMsg = `No destinations were verified on read-back (${Object.keys(blockedFields).length} blocked, ${Object.keys(unresolvedChanges).length} unresolved, ${unsupportedKeys.length} unsupported).`;
  }

  return Response.json({
    intent: "executeRepairPlan",
    pieceId,
    success: finalSuccess,
    status: finalStatus,
    errors: allErrors,
    fieldsUpdated: totalFieldsUpdated,
    legacyKeysRemoved: verifiedDeleteCount,
    message: diagnosticMsg,
    currentMetafields: hasMetafieldsReadBack ? newMetafields : currentMetafields,
    currentMetafieldTypes: hasMetafieldsReadBack ? newMetafieldTypes : currentMetafieldsTypes,
    metafieldsReadComplete: hasMetafieldsReadBack ? true : hasMetafieldsBaseline,
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
    repairPlan,
    proposedChanges,
    conflicts,
    blockedFields,
    skippedKeys,
    unsupportedKeys,
    unchanged,
    attemptedDestinations,
    verifiedDestinations,
    unresolvedChanges,
    missingFields: [],
    unknownFields: [],
    readBackVerified,
    variantTarget: resolvedVariantTargetForResponse
  });
}
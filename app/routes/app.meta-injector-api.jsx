import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";
import { action as loaderAction } from "../utils/meta-injector.loader.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS,
  isExactMetaobjectGid
} from "../utils/meta-injector.standardized.jsx";
import {
  CATALOG_STANDARDIZED_META_KEYS,
  executeLoadProductData,
  executeResolveStandardizedCandidates
} from "../utils/meta-injector.read-actions.server.jsx";
import {
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS as BENCH_V2_OPT_IN_VARIANT_DESTINATIONS,
  BENCH_V2_CONNECTED_STANDARDIZED_DESTINATIONS as BENCH_V2_OPT_IN_STANDARDIZED_DESTINATIONS,
  REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
  isExactProductVariantGid,
  inspectStoredReferenceListRawValue,
  buildBaselineObservation,
  isPlainTextProposalRejectedForContract,
  evaluateBenchV2OptInCustomProductWrite
} from "../utils/bench-v2.contract.jsx";
import {
  evaluateStandardizedCategoryEligibility,
  continueProductDefinitionCategoryConstraintMatch,
  readProductMetafieldDefinitionsWithConstraints as fetchProductMetafieldDefinitionsWithConstraints,
  readVariantMetafieldDefinitionsWithConstraints as fetchVariantMetafieldDefinitionsWithConstraints,
  paginateOwnerMetafieldsConnection,
  readSingleVariantMetafields as fetchSingleVariantMetafieldsForWriter
} from "../utils/bench-v2.baseline.server.jsx";
import {
  ALLOWED_TAB3_KEYS,
  STRICT_CUSTOM_KEYS,
  BENCH_V2_OPT_IN_SUPPORTED_STANDARDIZED_KEY_SET,
  CANONICAL_DECIMAL_NUMBER_REGEX,
  CANONICAL_USD_TWO_DECIMAL_MONEY_REGEX,
  isRetiredProductMetafieldDestination,
  normalizeMetafieldValue,
  sanitizeDescription,
  parsePriceToCentsBigInt,
  stageNativeAndShippingAndMediaChanges,
  evaluateBenchV2VariantDestinationWrite
} from "../utils/meta-injector.repair-helpers.server.jsx";
import {
  executeStagedRepairMutationsAndReadBack
} from "../utils/meta-injector.repair-mutations.server.jsx";

// 🟢 Structural Engine — No Prisma Import Here
// Note: Non-framework exports (BENCH_V2_WRITER_OPT_IN_FIELD, BENCH_V2_WRITER_OPT_IN_VALUE,
// BENCH_V2_OPT_IN_VARIANT_DESTINATIONS) are kept module-private here (and owned/exported
// by browser-safe ../utils/bench-v2.contract.jsx) so React Router treats this route as a
// pure server resource route (exporting only `action`) without generating a client chunk
// that fails on `../utils/bench-v2.baseline.server.jsx`.

export const action = async ({ request }) => {
  let matchingContext = null;
  try {
    const unconsumedRequestClone = request.clone();
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "loadProductData") {
      return await executeLoadProductData({ admin, body });
    }

    if (intent === "resolveStandardizedCandidates") {
      return await executeResolveStandardizedCandidates({
        admin,
        body,
        onMatchingContext: (ctx) => {
          matchingContext = ctx;
        }
      });
    }

    if (intent === "executeRepairPlan") {
      const pieceId = body.get("pieceId");
      const rawPlan = body.get("repairPlan");
      const rawLegacy = body.get("legacyKeysToRemove");
      const rawNativeChanges = body.get("nativeChanges");
      const rawExplicitReferenceReplacements = body.get("explicitReferenceReplacements");
      const isBenchV2OptIn = body.get(BENCH_V2_WRITER_OPT_IN_FIELD) === BENCH_V2_WRITER_OPT_IN_VALUE;
      const rawCallerVariantTargetId = body.get("variantTargetId");
      const callerVariantTargetId =
        typeof rawCallerVariantTargetId === "string" && rawCallerVariantTargetId.trim() !== ""
          ? rawCallerVariantTargetId.trim()
          : null;

      if (!pieceId || !rawPlan) {
        return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Missing pieceId or repairPlan payload." });
      }

      const repairPlan = JSON.parse(rawPlan);
      const legacyKeysToRemove = rawLegacy ? JSON.parse(rawLegacy) : [];
      const nativeChanges = rawNativeChanges ? JSON.parse(rawNativeChanges) : {};

      let explicitReferenceReplacements = {};
      let explicitReferenceReplacementsParseError = null;
      if (
        typeof rawExplicitReferenceReplacements === "string" &&
        rawExplicitReferenceReplacements.trim() !== ""
      ) {
        try {
          const parsedExplicitReplacements = JSON.parse(rawExplicitReferenceReplacements);
          if (
            parsedExplicitReplacements &&
            typeof parsedExplicitReplacements === "object" &&
            !Array.isArray(parsedExplicitReplacements)
          ) {
            explicitReferenceReplacements = parsedExplicitReplacements;
          } else {
            explicitReferenceReplacementsParseError =
              "explicitReferenceReplacements payload must be a plain JSON object.";
          }
        } catch (repParseErr) {
          explicitReferenceReplacementsParseError =
            `Malformed explicitReferenceReplacements JSON: ${repParseErr.message}`;
        }
      }

      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      let lookupData = null;
      let productLookupComplete = false;
      try {
        const lookupResponse = await admin.graphql(`
          query getProductAndMetafields($id: ID!) {
            product(id: $id) { 
              id
              title 
              descriptionHtml 
              seo { title description }
              category { id fullName }
              variants(first: 2) {
                pageInfo { hasNextPage }
                edges { node { id price } }
              }
              media(first: 50) {
                edges {
                  node {
                    ... on MediaImage { id alt }
                  }
                }
              }
              metafields(first: 250) {
                pageInfo { hasNextPage endCursor }
                edges { node { namespace key value type id } }
              } 
            }
          }
        `, { variables: { id: productGid } });
        lookupData = await lookupResponse.json();
        if (
          !lookupData?.errors?.length &&
          lookupData?.data?.product &&
          lookupData.data.product.id === productGid
        ) {
          productLookupComplete = true;
        }
      } catch (lookupErr) {
        productLookupComplete = false;
      }

      const productNode = lookupData?.data?.product || null;
      const resolvedServerProductId =
        productLookupComplete && productNode?.id === productGid ? productNode.id : null;
      const productCategory = productNode?.category
        ? { id: productNode.category.id || null, fullName: productNode.category.fullName || null }
        : null;

      const hasNativeTitleBaseline = productLookupComplete && typeof productNode?.title === "string";
      const hasNativeBodyBaseline = productLookupComplete && typeof productNode?.descriptionHtml === "string";
      const hasNativeSeoObject =
        productLookupComplete &&
        productNode?.seo !== null &&
        productNode?.seo !== undefined &&
        typeof productNode.seo === "object" &&
        !Array.isArray(productNode.seo);
      const hasNativeSeoTitleBaseline =
        hasNativeSeoObject &&
        Object.prototype.hasOwnProperty.call(productNode.seo, "title") &&
        (typeof productNode.seo.title === "string" || productNode.seo.title === null);
      const hasNativeSeoDescriptionBaseline =
        hasNativeSeoObject &&
        Object.prototype.hasOwnProperty.call(productNode.seo, "description") &&
        (typeof productNode.seo.description === "string" || productNode.seo.description === null);

      let currentMetaList = [];
      let hasMetafieldsBaseline = false;
      if (productLookupComplete && Array.isArray(productNode?.metafields?.edges)) {
        const mfPageInfo = productNode.metafields?.pageInfo;
        if (mfPageInfo && mfPageInfo.hasNextPage === true) {
          const mfPaginated = await paginateOwnerMetafieldsConnection({
            admin,
            ownerGid: productGid,
            connectionLabel: "Product metafields",
            initialEdges: productNode.metafields.edges,
            initialPageInfo: mfPageInfo,
            maxPages: 10,
            buildPageQuery: () => `
              query getMoreProductMetafieldsForWriter($id: ID!, $cursor: String!) {
                product(id: $id) {
                  metafields(first: 250, after: $cursor) {
                    pageInfo { hasNextPage endCursor }
                    edges { node { namespace key value type id } }
                  }
                }
              }
            `,
            extractConnection: (json) => json?.data?.product?.metafields
          });
          currentMetaList = mfPaginated.edges;
          hasMetafieldsBaseline = mfPaginated.isComplete === true;
        } else if (!mfPageInfo || mfPageInfo.hasNextPage === false) {
          currentMetaList = productNode.metafields.edges;
          hasMetafieldsBaseline = true;
        }
      }

      const currentNativeTitle = hasNativeTitleBaseline ? productNode.title : undefined;
      const currentNativeBodyHtml = hasNativeBodyBaseline ? productNode.descriptionHtml : undefined;
      const currentNativeSeoTitle = hasNativeSeoTitleBaseline ? (productNode.seo.title ?? "") : undefined;
      const currentNativeSeoDescription = hasNativeSeoDescriptionBaseline ? (productNode.seo.description ?? "") : undefined;

      const currentMetafields = {};
      const currentMetafieldsTypes = {};
      currentMetaList.forEach(e => {
        if (!e?.node?.namespace || !e?.node?.key) return;
        const fullKey = `${e.node.namespace}.${e.node.key}`;
        currentMetafields[fullKey] = e.node.value;
        currentMetafieldsTypes[fullKey] = e.node.type;
      });

      const variantsConn = productNode?.variants;
      const variantsEnumerationComplete = Boolean(
        productLookupComplete &&
        variantsConn &&
        Array.isArray(variantsConn.edges) &&
        typeof variantsConn.pageInfo?.hasNextPage === "boolean" &&
        variantsConn.pageInfo.hasNextPage === false
      );
      const variantCount =
        productLookupComplete && Array.isArray(variantsConn?.edges)
          ? variantsConn.edges.length
          : null;
      const candidateSingleVariantGid =
        variantsEnumerationComplete && variantsConn.edges.length === 1
          ? String(variantsConn.edges[0]?.node?.id || "").trim()
          : null;
      const hasVerifiedSingleVariantGid = Boolean(
        candidateSingleVariantGid && isExactProductVariantGid(candidateSingleVariantGid)
      );
      const verifiedSingleVariantGid = hasVerifiedSingleVariantGid
        ? candidateSingleVariantGid
        : null;

      let variantTargetStatus = "unknown";
      if (!productLookupComplete || !variantsConn || typeof variantsConn.pageInfo?.hasNextPage !== "boolean") {
        variantTargetStatus = "variants_read_incomplete";
      } else if (variantsConn.pageInfo.hasNextPage === true || (variantCount !== null && variantCount > 1)) {
        variantTargetStatus = "multiple_variants_ambiguous";
      } else if (variantCount === 0) {
        variantTargetStatus = "zero_variants";
      } else if (hasVerifiedSingleVariantGid) {
        variantTargetStatus = "single_variant_verified";
      } else {
        variantTargetStatus = "invalid_or_missing_variant_gid";
      }

      const defReadResult = await fetchProductMetafieldDefinitionsWithConstraints(admin);
      const defs = defReadResult.defs;
      const defsReadComplete = defReadResult.defsReadComplete;
      const defConstraintErrorsByDestination = defReadResult.constraintErrorsByDestination || {};

      const hasBenchV2VariantEntryInPlan = Boolean(
        isBenchV2OptIn &&
        repairPlan &&
        typeof repairPlan === "object" &&
        Object.keys(repairPlan).some((rawK) => {
          const normalizedK = rawK.includes(".") ? rawK : `custom.${rawK}`;
          return BENCH_V2_OPT_IN_VARIANT_DESTINATIONS.has(normalizedK);
        })
      );

      let currentVariantMetafields = null;
      let currentVariantMetafieldTypes = null;
      let currentVariantMetafieldIds = null;
      let variantMetafieldsReadComplete = false;
      let variantMetafieldsReadError = null;
      let variantDefs = {};
      let variantDefsReadComplete = false;
      let variantDefReadErrors = [];

      if (hasBenchV2VariantEntryInPlan) {
        const varDefResult = await fetchVariantMetafieldDefinitionsWithConstraints(admin);
        variantDefs = varDefResult.defs || {};
        variantDefsReadComplete = varDefResult.defsReadComplete === true;
        variantDefReadErrors = Array.isArray(varDefResult.errors) ? varDefResult.errors : [];

        if (
          variantTargetStatus === "single_variant_verified" &&
          verifiedSingleVariantGid &&
          callerVariantTargetId &&
          callerVariantTargetId === verifiedSingleVariantGid
        ) {
          const varMfResult = await fetchSingleVariantMetafieldsForWriter(
            admin,
            productGid,
            verifiedSingleVariantGid
          );
          currentVariantMetafields = varMfResult.metafields;
          currentVariantMetafieldTypes = varMfResult.metafieldTypes;
          currentVariantMetafieldIds = varMfResult.metafieldIds;
          variantMetafieldsReadComplete = varMfResult.isComplete === true;
          variantMetafieldsReadError = varMfResult.error || null;
        }
      }

      const proposedChanges = {};
      const setToShopify = [];
      const deleteFromShopify = [];
      const blockedFields = {};
      const skippedKeys = [];
      const unsupportedKeys = [];
      const unchanged = [];
      const attemptedDestinations = [];
      const verifiedDestinations = [];
      const unresolvedChanges = {};

      const nativeInput = { id: productGid };

      let doPriceUpdate = false;
      let priceDestinationKey = "price";
      let priceVariantGid = null;
      let newPriceString = null;
      let attemptedVariantMetafieldWrite = false;

      const stagedNativeAndMedia = await stageNativeAndShippingAndMediaChanges({
        admin,
        nativeChanges,
        lookupData,
        hasNativeTitleBaseline,
        hasNativeBodyBaseline,
        hasNativeSeoTitleBaseline,
        hasNativeSeoDescriptionBaseline,
        currentNativeTitle,
        currentNativeBodyHtml,
        currentNativeSeoTitle,
        currentNativeSeoDescription,
        nativeInput,
        blockedFields,
        proposedChanges,
        attemptedDestinations,
        unchanged
      });

      const {
        getDoNativeUpdate,
        getNativeTitleUpdated,
        getNativeDescriptionUpdated,
        getNativeSeoTitleUpdated,
        getNativeSeoDescriptionUpdated,
        evaluateAndStageNativeDescription,
        evaluateAndStageNativeSeoTitle,
        evaluateAndStageNativeSeoDescription,
        doShippingWeightUpdate,
        shippingWeightInput,
        doImageAltUpdates,
        imageAltInputs
      } = stagedNativeAndMedia;

      const moValidationCache = new Map();
      const hasBothPriceAndNativePriceInPlan = Boolean(
        repairPlan &&
        typeof repairPlan === "object" &&
        Object.prototype.hasOwnProperty.call(repairPlan, "price") &&
        Object.prototype.hasOwnProperty.call(repairPlan, "native_price")
      );
      let priceSlotEvaluated = false;

      for (const [fullKey, val] of Object.entries(repairPlan)) {
        if (fullKey === "shopify_title" || fullKey === "native_title") {
           if (!getNativeTitleUpdated() && nativeChanges.title === undefined) {
               skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_description") {
           const rawDescStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!getNativeDescriptionUpdated() && nativeChanges.description === undefined && rawDescStr !== "") {
              evaluateAndStageNativeDescription(rawDescStr, false);
           } else if (!getNativeDescriptionUpdated()) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_seo_title") {
           const rawSeoTitleStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!getNativeSeoTitleUpdated() && nativeChanges.seoTitle === undefined && rawSeoTitleStr !== "") {
              evaluateAndStageNativeSeoTitle(rawSeoTitleStr, false);
           } else if (!getNativeSeoTitleUpdated()) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_seo_description") {
           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!getNativeSeoDescriptionUpdated() && nativeChanges.seoDescription === undefined && valStr !== "") {
              evaluateAndStageNativeSeoDescription(valStr, false);
           } else if (!getNativeSeoDescriptionUpdated()) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "price" || fullKey === "native_price") {
           const isNativePriceKey = fullKey === "native_price";
           const priceDestKey = isNativePriceKey ? "native_price" : "price";

           if (hasBothPriceAndNativePriceInPlan) {
              blockedFields[priceDestKey] = "Ambiguous price submission: both 'price' and 'native_price' were included in repairPlan; submit only one canonical destination.";
              continue;
           }

           if (priceSlotEvaluated) {
              blockedFields[priceDestKey] = `Duplicate price entry for ${priceDestKey} in repairPlan.`;
              continue;
           }
           priceSlotEvaluated = true;

           if (isNativePriceKey) {
              if (!isBenchV2OptIn) {
                 unsupportedKeys.push(fullKey);
                 continue;
              }
              if (typeof val !== "string") {
                 blockedFields["native_price"] = "Rejected non-string proposal for native_price (no implicit coercion).";
                 continue;
              }
              const rawUntrimmedPrice = val;
              const trimmedPrice = rawUntrimmedPrice.trim();
              if (trimmedPrice === "") {
                 blockedFields["native_price"] = "Blank or whitespace-only proposals are forbidden for native_price.";
                 continue;
              }
              if (rawUntrimmedPrice !== trimmedPrice) {
                 blockedFields["native_price"] = "Proposal for native_price contains leading or trailing whitespace that would alter the exact approved value.";
                 continue;
              }
              if (!CANONICAL_USD_TWO_DECIMAL_MONEY_REGEX.test(rawUntrimmedPrice)) {
                 blockedFields["native_price"] = `Malformed price for native_price: requires canonical non-negative USD two-decimal text without currency symbols, commas, spaces, signs, exponent notation, or leading zeros (e.g. "45.00" or "0.00"; received "${rawUntrimmedPrice}").`;
                 continue;
              }
              if (!callerVariantTargetId || !isExactProductVariantGid(callerVariantTargetId)) {
                 blockedFields["native_price"] = "Missing or invalid caller variantTargetId for variant-owned destination native_price; exact Shopify ProductVariant GID is required.";
                 continue;
              }
              if (!productLookupComplete || !variantsConn || !variantsConn.edges || typeof variantsConn.pageInfo?.hasNextPage !== "boolean") {
                 blockedFields["native_price"] = "Missing variant or pagination data from Shopify for native_price.";
                 continue;
              }
              if (variantTargetStatus === "zero_variants" || variantsConn.edges.length === 0) {
                 blockedFields["native_price"] = "Ambiguous destination on native_price: Product has zero variants.";
                 continue;
              }
              if (variantTargetStatus === "multiple_variants_ambiguous" || variantsConn.edges.length > 1 || variantsConn.pageInfo.hasNextPage === true) {
                 blockedFields["native_price"] = "Ambiguous destination on native_price: Product has multiple variants; single-variant target is required.";
                 continue;
              }
              if (variantTargetStatus !== "single_variant_verified" || !verifiedSingleVariantGid) {
                 blockedFields["native_price"] = `Single-variant target could not be verified on native_price (status: ${variantTargetStatus}).`;
                 continue;
              }
              if (callerVariantTargetId !== verifiedSingleVariantGid) {
                 blockedFields["native_price"] = `Caller variantTargetId (${callerVariantTargetId}) does not match the product's verified single variant (${verifiedSingleVariantGid}) for native_price.`;
                 continue;
              }

              const currentPriceStr = variantsConn.edges[0]?.node?.price;
              if (typeof currentPriceStr !== "string" || currentPriceStr.trim() === "") {
                 blockedFields["native_price"] = "Missing current price data from Shopify for native_price.";
                 continue;
              }

              if (parsePriceToCentsBigInt(rawUntrimmedPrice) !== parsePriceToCentsBigInt(currentPriceStr.trim())) {
                 doPriceUpdate = true;
                 priceDestinationKey = "native_price";
                 priceVariantGid = verifiedSingleVariantGid;
                 newPriceString = rawUntrimmedPrice;
                 proposedChanges["native_price"] = {
                   owner: "PRODUCTVARIANT",
                   variantId: verifiedSingleVariantGid,
                   from: currentPriceStr,
                   to: rawUntrimmedPrice
                 };
                 attemptedDestinations.push("native_price");
              } else {
                 unchanged.push("native_price");
              }
              continue;
           }

           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (valStr === "") continue;

           const validPrice = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
           if (!validPrice.test(valStr)) {
              blockedFields["price"] = "Malformed price: must be a non-negative number with up to two decimals.";
              continue;
           }

           if (!variantsConn || !variantsConn.edges || typeof variantsConn.pageInfo?.hasNextPage !== "boolean") {
              blockedFields["price"] = "Missing variant or pagination data from Shopify.";
              continue;
           }
           if (variantsConn.edges.length === 0) {
              blockedFields["price"] = "Ambiguous destination: Product has zero variants.";
              continue;
           }
           if (variantsConn.edges.length > 1 || variantsConn.pageInfo.hasNextPage === true) {
              blockedFields["price"] = "Ambiguous destination: Product has multiple variants. Edit price manually.";
              continue;
           }

           const targetVariantId = variantsConn.edges[0].node.id;
           const currentPriceStr = variantsConn.edges[0].node.price;

           if (!targetVariantId || !isExactProductVariantGid(targetVariantId)) {
              blockedFields["price"] = "Invalid variant ID retrieved.";
              continue;
           }
           if (typeof currentPriceStr !== "string") {
              blockedFields["price"] = "Missing current price data from Shopify.";
              continue;
           }

           if (parsePriceToCentsBigInt(valStr) !== parsePriceToCentsBigInt(currentPriceStr)) {
              doPriceUpdate = true;
              priceDestinationKey = "price";
              priceVariantGid = targetVariantId;
              newPriceString = valStr;
              proposedChanges["price"] = { from: currentPriceStr, to: valStr };
              attemptedDestinations.push("price");
           } else {
              unchanged.push("price");
           }
           continue;
        }

        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }

        const canonicalDestinationKey = `${ns}.${key}`;

        // ====================================================================
        // SCOPED BENCH V2 OPT-IN VARIANT-OWNED DESTINATION PATH
        // ====================================================================
        if (BENCH_V2_OPT_IN_VARIANT_DESTINATIONS.has(canonicalDestinationKey)) {
          const varEval = evaluateBenchV2VariantDestinationWrite({
            isBenchV2OptIn,
            fullKey,
            ns,
            key,
            canonicalDestinationKey,
            val,
            productGid,
            callerVariantTargetId,
            productLookupComplete,
            variantTargetStatus,
            verifiedSingleVariantGid,
            variantMetafieldsReadComplete,
            currentVariantMetafields,
            variantMetafieldsReadError,
            variantDefsReadComplete,
            variantDefReadErrors,
            variantDefs,
            currentVariantMetafieldTypes,
            unsupportedKeys,
            blockedFields,
            unchanged,
            setToShopify,
            proposedChanges,
            attemptedDestinations
          });
          if (varEval.attemptedVariantMetafieldWrite) {
            attemptedVariantMetafieldWrite = true;
          }
          continue;
        }

        // ====================================================================
        // SCOPED BENCH V2 OPT-IN PRODUCT CUSTOM METAFIELD PATH
        // ====================================================================
        if (isBenchV2OptIn) {
          const customEval = evaluateBenchV2OptInCustomProductWrite({
            fullKey,
            rawVal: val,
            productLookupComplete,
            hasMetafieldsBaseline,
            defsReadComplete,
            currentMetafields,
            currentMetafieldsTypes,
            defs,
            defConstraintErrorsByDestination,
            evaluateCategoryEligibility: (liveDefForDest) =>
              evaluateStandardizedCategoryEligibility({
                productId: resolvedServerProductId,
                destination: fullKey,
                liveDef: liveDefForDest,
                defsReadComplete,
                productCategory,
                productCategoryReadComplete: productLookupComplete
              })
          });

          if (customEval.handled) {
            if (customEval.outcome === "unsupported") {
              unsupportedKeys.push(fullKey);
            } else if (customEval.outcome === "skipped") {
              skippedKeys.push(fullKey);
            } else if (customEval.outcome === "unchanged") {
              unchanged.push(fullKey);
            } else if (customEval.outcome === "blocked") {
              blockedFields[fullKey] = customEval.reason;
            } else if (customEval.outcome === "stage_write") {
              setToShopify.push({
                ownerId: productGid,
                ownerType: "PRODUCT",
                namespace: customEval.ns,
                key: customEval.key,
                type: customEval.resolvedType,
                value: customEval.resolvedValue
              });
              proposedChanges[fullKey] = {
                owner: "PRODUCT",
                from: customEval.currentVal,
                to: customEval.resolvedValue
              };
              attemptedDestinations.push(fullKey);
            }
            continue;
          }
        }

        const isWholeProductWeightGramsTarget =
          ns === "custom" &&
          canonicalDestinationKey === "custom.whole_product_weight_grams";

        if (isRetiredProductMetafieldDestination(ns, key, fullKey, canonicalDestinationKey)) {
            skippedKeys.push(fullKey);
            continue;
        }

        if (
          ns === "custom" &&
          (key === "is_ooak" ||
            key === "stone_family" ||
            key === "primary_medium" ||
            key === "origin_handle")
        ) {
            skippedKeys.push(fullKey);
            continue;
        }

        const isBenchV2OptInStandardizedDestination =
          isBenchV2OptIn &&
          ns === "shopify" &&
          fullKey === canonicalDestinationKey &&
          BENCH_V2_OPT_IN_SUPPORTED_STANDARDIZED_KEY_SET.has(key) &&
          BENCH_V2_OPT_IN_STANDARDIZED_DESTINATIONS.has(canonicalDestinationKey);

        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom" && !isBenchV2OptInStandardizedDestination) {
            unsupportedKeys.push(fullKey);
            continue;
        }

        if (ns === "shopify" && !CATALOG_STANDARDIZED_META_KEYS.has(key)) {
            unsupportedKeys.push(fullKey);
            continue;
        }
        if (key === "construction" && ns !== "shopify") {
            unsupportedKeys.push(fullKey);
            continue;
        }

        if (
          !ALLOWED_TAB3_KEYS.includes(key) &&
          !ALLOWED_TAB3_KEYS.includes(fullKey) &&
          !ALLOWED_TAB3_KEYS.includes(canonicalDestinationKey)
        ) {
            unsupportedKeys.push(fullKey);
            continue;
        }

        if (!hasMetafieldsBaseline) {
            blockedFields[fullKey] = "Product metafields baseline could not be loaded from Shopify; reload product data before saving.";
            continue;
        }

        if ((isBenchV2OptIn || isWholeProductWeightGramsTarget) && !defsReadComplete) {
            blockedFields[fullKey] = `Live PRODUCT metafield definition read did not complete for ${canonicalDestinationKey}; reload product data before saving.`;
            continue;
        }

        const currentVal = currentMetafields[fullKey] !== undefined
          ? currentMetafields[fullKey]
          : (currentMetafields[canonicalDestinationKey] ?? null);
        const valStr = String(val !== null && val !== undefined ? val : "").trim();

        const isAllowedStandardizedDestinationForWrite = isBenchV2OptIn
          ? (
              fullKey === canonicalDestinationKey &&
              BENCH_V2_OPT_IN_SUPPORTED_STANDARDIZED_KEY_SET.has(key) &&
              BENCH_V2_OPT_IN_STANDARDIZED_DESTINATIONS.has(canonicalDestinationKey)
            )
          : ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(key);

        if (ns === "shopify" && !isAllowedStandardizedDestinationForWrite) {
            if (!currentVal && valStr === "") {
                unchanged.push(fullKey);
            } else if (currentVal === valStr) {
                unchanged.push(fullKey);
            } else {
                blockedFields[fullKey] = "Standardized attribute read-only (pending_read_only).";
            }
            continue;
        }

        if (valStr === "" || (ns === "custom" && key === "collection_date" && /^(n\/a|none|unknown)$/i.test(valStr))) {
            if (!currentVal) unchanged.push(fullKey);
            else skippedKeys.push(fullKey);
            continue;
        }

        const def = defs[fullKey] || defs[canonicalDestinationKey];
        const storedType = currentMetafieldsTypes[fullKey] || currentMetafieldsTypes[canonicalDestinationKey];
        const destinationDefErr =
          defConstraintErrorsByDestination[fullKey] ||
          defConstraintErrorsByDestination[canonicalDestinationKey] ||
          def?.constraints?.error ||
          def?.error ||
          null;

        if ((isBenchV2OptIn || isWholeProductWeightGramsTarget) && destinationDefErr) {
            blockedFields[fullKey] = `Definition or constraint error on ${canonicalDestinationKey}: ${destinationDefErr}`;
            continue;
        }

        if (isBenchV2OptIn && ns === "shopify") {
            if (!def?.type) {
                blockedFields[fullKey] = `Missing live PRODUCT metafield definition for "${canonicalDestinationKey}". Standardized reference attributes require a live PRODUCT definition.`;
                continue;
            }
            if (def.type !== "list.metaobject_reference") {
                blockedFields[fullKey] = `Type mismatch on "${canonicalDestinationKey}": expected live definition "list.metaobject_reference", but Shopify reports "${def.type}".`;
                continue;
            }
            if (storedType && storedType !== "list.metaobject_reference") {
                blockedFields[fullKey] = `Type conflict on "${canonicalDestinationKey}": live definition is "list.metaobject_reference" but stored metafield is "${storedType}".`;
                continue;
            }
        }

        const reviewedContractType = isWholeProductWeightGramsTarget
          ? "number_decimal"
          : Object.prototype.hasOwnProperty.call(
              REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS,
              canonicalDestinationKey
            )
            ? REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS[canonicalDestinationKey]
            : null;

        if (def && storedType && def.type !== storedType) {
            blockedFields[fullKey] = `Type conflict: Definition is ${def.type} but stored is ${storedType}`;
            continue;
        }
        if (reviewedContractType) {
            if (def?.type && def.type !== reviewedContractType) {
                blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: Live definition is ${def.type}, which conflicts with reviewed destination contract ${reviewedContractType}.`;
                continue;
            }
            if (storedType && storedType !== reviewedContractType) {
                blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: Stored metafield type is ${storedType}, which conflicts with reviewed destination contract ${reviewedContractType}.`;
                continue;
            }
        }

        const observedShopifyType = def?.type || storedType || null;
        const intendedContractWriteType = !observedShopifyType ? reviewedContractType : null;
        const resolvedType = observedShopifyType || intendedContractWriteType || null;

        if (!resolvedType) {
            blockedFields[fullKey] = "No exact live definition or stored type available; fallback mappings are strictly forbidden.";
            continue;
        }

        if (isWholeProductWeightGramsTarget && resolvedType !== "number_decimal") {
            blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: observed type is ${resolvedType}, expected number_decimal.`;
            continue;
        }

        let evaluatedCatEligForDest = null;
        if (ns === "shopify" || (def?.constraints && (def.constraints.hasConstraints || !def.constraints.isComplete))) {
            let catElig = evaluateStandardizedCategoryEligibility({
                productId: resolvedServerProductId,
                destination: canonicalDestinationKey,
                liveDef: def,
                defsReadComplete,
                productCategory,
                productCategoryReadComplete: productLookupComplete
            });
            if (
                ns === "shopify" &&
                catElig.status === "incomplete_constraints" &&
                !def?.constraints?.error &&
                def?.constraints?.continuation?.stopReason === "max_pages_reached"
            ) {
                catElig = await continueProductDefinitionCategoryConstraintMatch({
                    admin,
                    productId: resolvedServerProductId,
                    destination: canonicalDestinationKey,
                    liveDef: def,
                    defsReadComplete,
                    productCategory,
                    productCategoryReadComplete: productLookupComplete
                });
            }
            evaluatedCatEligForDest = catElig;
            if (!catElig.isComplete || !catElig.isEligible) {
                blockedFields[fullKey] = catElig.reason;
                continue;
            }
        }

        let resolvedValue = normalizeMetafieldValue(key, valStr);

        if (isBenchV2OptIn && ns === "shopify") {
            if (typeof val !== "string") {
                blockedFields[fullKey] = `Rejected non-string proposal for ${canonicalDestinationKey} (no implicit coercion).`;
                continue;
            }
            if (resolvedValue !== val) {
                blockedFields[fullKey] = `Proposal for ${canonicalDestinationKey} contains leading/trailing whitespace or warning prefixes that would alter the exact approved value.`;
                continue;
            }
        }

        if (isWholeProductWeightGramsTarget) {
            if (typeof val !== "string") {
                blockedFields[fullKey] = `Rejected non-string proposal for ${canonicalDestinationKey} (no implicit coercion).`;
                continue;
            }
            if (resolvedValue !== val) {
                blockedFields[fullKey] = `Proposal for ${canonicalDestinationKey} contains leading/trailing whitespace or warning prefixes that would alter the exact approved value.`;
                continue;
            }
            if (!CANONICAL_DECIMAL_NUMBER_REGEX.test(resolvedValue)) {
                blockedFields[fullKey] = `Destination "${canonicalDestinationKey}" requires a non-negative decimal number without units, spaces, or leading zeros (e.g. "14.5" or "28"; received "${resolvedValue}").`;
                continue;
            }
            const parsedExactDecimal = Number(resolvedValue);
            const writerSerializedDecimal = String(parseFloat(resolvedValue));
            if (!Number.isFinite(parsedExactDecimal) || parsedExactDecimal < 0) {
                blockedFields[fullKey] = `Destination "${canonicalDestinationKey}" requires a finite non-negative decimal number (received "${resolvedValue}").`;
                continue;
            }
            if (writerSerializedDecimal !== resolvedValue) {
                blockedFields[fullKey] = `Existing writer serializes "${resolvedValue}" as "${writerSerializedDecimal}" on save. Enter "${writerSerializedDecimal}" so your exact approved value is stored without alteration.`;
                continue;
            }
        }

        if (reviewedContractType === "single_line_text_field") {
            if (isPlainTextProposalRejectedForContract(val, resolvedValue)) {
                blockedFields[fullKey] = `Rejected non-text or reference-shaped proposal for plain-text destination ${canonicalDestinationKey}.`;
                continue;
            }
        }

        if (key === "generated_description") {
            const sanitizedDesc = sanitizeDescription(resolvedValue);
            if (sanitizedDesc !== resolvedValue) {
                blockedFields[fullKey] = `Rejected custom.generated_description proposal containing disallowed links that alter approved content.`;
                continue;
            }
            resolvedValue = sanitizedDesc;
        }

        if (key === "seo_title") {
            if (resolvedValue !== valStr) {
                blockedFields[fullKey] = `Rejected custom.seo_title proposal containing warning prefixes that alter approved content.`;
                continue;
            }
            if (resolvedValue.length > 70) {
                blockedFields[fullKey] = `Value exceeds 70 characters limit for custom.seo_title.`;
                continue;
            }
        }

        if (resolvedType === "number_decimal" || resolvedType === "number_integer") {
          const parsedNum = parseFloat(String(resolvedValue).replace(/[^0-9.-]/g, ""));
          if (isNaN(parsedNum)) {
             blockedFields[fullKey] = `Invalid numeric value: ${resolvedValue}`;
             continue;
          }
          resolvedValue = resolvedType === "number_integer" ? String(Math.round(parsedNum)) : String(parsedNum);
        } else if (resolvedType === "boolean") {
          const lower = String(resolvedValue).toLowerCase();
          if (lower === "true" || lower === "false") {
             resolvedValue = lower;
          } else {
             blockedFields[fullKey] = `Invalid boolean value: ${resolvedValue}`;
             continue;
          }
        } else if (resolvedType.includes("metaobject_reference")) {

          let idsToVerify = [];

          if (isBenchV2OptIn && ns === "shopify") {
             let parsedArray;
             try {
                parsedArray = JSON.parse(resolvedValue);
             } catch {
                blockedFields[fullKey] = `Destination "${canonicalDestinationKey}" requires a canonical JSON array of Metaobject GIDs (e.g. ["gid://shopify/Metaobject/123"]).`;
                continue;
             }

             if (!Array.isArray(parsedArray) || parsedArray.length === 0) {
                blockedFields[fullKey] = Array.isArray(parsedArray) && parsedArray.length === 0
                  ? `Clearing the last reference entry to an empty list is not supported by the current app validation and writer for "${canonicalDestinationKey}"; at least one verified Metaobject GID must remain.`
                  : `Destination "${canonicalDestinationKey}" requires a non-empty JSON array of Metaobject GIDs.`;
                continue;
             }

             const seenGids = new Set();
             let elementErr = null;
             for (const item of parsedArray) {
                if (typeof item !== "string" || item.trim() !== item || !isExactMetaobjectGid(item)) {
                   elementErr = `Invalid reference element "${String(item)}" for "${canonicalDestinationKey}": every item must be an exact "gid://shopify/Metaobject/<id>" string.`;
                   break;
                }
                if (seenGids.has(item)) {
                   elementErr = `Duplicate Metaobject GID "${item}" in proposal for "${canonicalDestinationKey}".`;
                   break;
                }
                seenGids.add(item);
                idsToVerify.push(item);
             }

             if (elementErr) {
                blockedFields[fullKey] = elementErr;
                continue;
             }

             const canonicalSerialized = JSON.stringify(parsedArray);
             if (canonicalSerialized !== resolvedValue) {
                blockedFields[fullKey] = `Existing writer serializes this reference list as ${canonicalSerialized}. Use ${canonicalSerialized} so your exact approved value is stored without alteration.`;
                continue;
             }

             const storedCheck = inspectStoredReferenceListRawValue(currentVal);
             if (!storedCheck.valid) {
                blockedFields[fullKey] = `Existing stored reference list on "${canonicalDestinationKey}" could not be parsed safely: ${storedCheck.error}`;
                continue;
             }

             const missingAssignedGids = [];
             for (const existingGid of storedCheck.gids) {
                if (!seenGids.has(existingGid)) {
                   missingAssignedGids.push(existingGid);
                }
             }

             if (missingAssignedGids.length > 0) {
                const firstMissingGid = missingAssignedGids[0];
                if (explicitReferenceReplacementsParseError) {
                   blockedFields[fullKey] = `Explicit reference replacement rejected for "${canonicalDestinationKey}": ${explicitReferenceReplacementsParseError}`;
                   continue;
                }

                const repRecord = explicitReferenceReplacements?.[canonicalDestinationKey];
                const requiredDefIdForCheck =
                  def?.restrictedMetaobjectDefinitionId ||
                  def?.requiredDefinitionId ||
                  null;

                const serverSnapshotForDest = {
                  productId: productGid,
                  metafieldsReadComplete: hasMetafieldsBaseline,
                  defsReadComplete,
                  productCategoryReadComplete: productLookupComplete,
                  productCategory,
                  currentMetafields,
                  currentMetafieldTypes: currentMetafieldsTypes,
                  liveDefinitions: defs,
                  constraintErrorsByDestination: defConstraintErrorsByDestination,
                  categoryEligibilityByDestination: evaluatedCatEligForDest
                    ? { [canonicalDestinationKey]: evaluatedCatEligForDest }
                    : {}
                };
                const serverObs = buildBaselineObservation(
                  serverSnapshotForDest,
                  canonicalDestinationKey
                );

                const isValidExplicitReplacement = Boolean(
                  repRecord &&
                  typeof repRecord === "object" &&
                  !Array.isArray(repRecord) &&
                  repRecord.allowExplicitReferenceListReplacement === true &&
                  repRecord.productId === productGid &&
                  repRecord.destinationKey === canonicalDestinationKey &&
                  repRecord.approvedValue === canonicalSerialized &&
                  typeof requiredDefIdForCheck === "string" &&
                  requiredDefIdForCheck.trim() !== "" &&
                  repRecord.restrictedMetaobjectDefinitionId === requiredDefIdForCheck &&
                  (repRecord.productCategoryId || null) === (productCategory?.id || null) &&
                  (repRecord.categoryEligibilityStatus || null) ===
                    (evaluatedCatEligForDest?.status || null) &&
                  serverObs.evidenceAvailable === true &&
                  typeof repRecord.baselineSignature === "string" &&
                  repRecord.baselineSignature === serverObs.signature
                );

                if (!isValidExplicitReplacement) {
                   let rejectDetail = `Proposal for "${canonicalDestinationKey}" is missing existing assigned Metaobject ${firstMissingGid}. Existing reference assignments are preserved and never silently removed.`;
                   if (repRecord && typeof repRecord === "object") {
                     if (repRecord.baselineSignature !== serverObs.signature) {
                       rejectDetail = `Explicit reference replacement rejected for "${canonicalDestinationKey}": live server baseline signature drifted since approval. Reload product data and re-approve.`;
                     } else if (repRecord.approvedValue !== canonicalSerialized) {
                       rejectDetail = `Explicit reference replacement rejected for "${canonicalDestinationKey}": approved replacement value does not match submitted value.`;
                     } else {
                       rejectDetail = `Explicit reference replacement rejected for "${canonicalDestinationKey}": replacement approval metadata did not match live product/definition/category state.`;
                     }
                   }
                   blockedFields[fullKey] = rejectDetail;
                   continue;
                }
             }

             resolvedValue = canonicalSerialized;
          } else if (resolvedType.includes("list.")) {
             try {
                const parsed = JSON.parse(resolvedValue);
                if (!Array.isArray(parsed)) throw new Error();

                for (const item of parsed) {
                    if (!String(item).startsWith("gid://shopify/Metaobject/")) {
                        throw new Error(`Invalid item: ${item}`);
                    }
                    idsToVerify.push(String(item));
                }
                resolvedValue = JSON.stringify(parsed);
             } catch (e) {
                if (resolvedValue.startsWith("gid://shopify/Metaobject/")) {
                    idsToVerify.push(resolvedValue);
                    resolvedValue = JSON.stringify([resolvedValue]);
                } else {
                    blockedFields[fullKey] = `Requires valid JSON array of metaobject reference IDs, got text instead.`;
                    continue;
                }
             }
          } else {
             if (!String(resolvedValue).startsWith("gid://shopify/Metaobject/")) {
                blockedFields[fullKey] = `Requires metaobject reference ID, got plain text.`;
                continue;
             }
             idsToVerify.push(String(resolvedValue));
          }

          const requiredDefId = def?.requiredDefinitionId;
          if (!requiredDefId) {
             blockedFields[fullKey] = "Destination field lacks a required metaobject definition ID restriction.";
             continue;
          }

          let allValid = true;
          for (const moId of idsToVerify) {
              if (moValidationCache.has(moId)) {
                  const cachedDefId = moValidationCache.get(moId);
                  if (cachedDefId !== requiredDefId) {
                      blockedFields[fullKey] = `Reference ${moId} belongs to def ${cachedDefId}, but field requires ${requiredDefId}`;
                      allValid = false;
                      break;
                  }
              } else {
                  try {
                      const moRes = await admin.graphql(`
                         query getMetaobject($id: ID!) {
                            metaobject(id: $id) {
                               definition { id }
                            }
                         }
                      `, { variables: { id: moId } });
                      const moJson = await moRes.json();
                      const actualDefId = moJson?.data?.metaobject?.definition?.id;

                      if (!actualDefId) {
                          blockedFields[fullKey] = `Metaobject ${moId} not found or missing definition.`;
                          allValid = false;
                          break;
                      }

                      moValidationCache.set(moId, actualDefId);

                      if (actualDefId !== requiredDefId) {
                          blockedFields[fullKey] = `Reference ${moId} belongs to def ${actualDefId}, but field requires ${requiredDefId}`;
                          allValid = false;
                          break;
                      }
                  } catch (e) {
                      blockedFields[fullKey] = `Validation lookup failed for ${moId}: ${e.message}`;
                      allValid = false;
                      break;
                  }
              }
          }

          if (!allValid) continue;

        } else if (resolvedType === "list.single_line_text_field") {
          try {
             const parsed = JSON.parse(resolvedValue);
             if (!Array.isArray(parsed)) throw new Error();
             resolvedValue = JSON.stringify(parsed);
          } catch {
             if (!resolvedValue.startsWith("[")) resolvedValue = JSON.stringify([resolvedValue]);
          }
        } else if (resolvedType === "multi_line_text_field") {
          if (resolvedValue.length > 10000) {
             blockedFields[fullKey] = `Value exceeds 10,000 characters limit`;
             continue;
          }
        } else {
          if (resolvedValue.length > 255) {
             blockedFields[fullKey] = `Value exceeds 255 characters limit`;
             continue;
          }
        }

        if (currentVal !== resolvedValue) {
            setToShopify.push({ ownerId: productGid, ownerType: "PRODUCT", namespace: ns, key: key, type: resolvedType, value: resolvedValue });
            proposedChanges[fullKey] = { owner: "PRODUCT", from: currentVal, to: resolvedValue };
            attemptedDestinations.push(fullKey);
        } else {
            unchanged.push(fullKey);
        }
      }

      legacyKeysToRemove.forEach(fullKey => {
        let ns = "custom";
        let key = fullKey;
        if (fullKey.includes(".")) {
            const parts = fullKey.split(".");
            ns = parts[0];
            key = parts.slice(1).join(".");
        }

        const canonicalDestinationKey = `${ns}.${key}`;

        if (isRetiredProductMetafieldDestination(ns, key, fullKey, canonicalDestinationKey)) {
            skippedKeys.push(fullKey);
            return;
        }

        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            return;
        }

        if (!ALLOWED_TAB3_KEYS.includes(key) && !ALLOWED_TAB3_KEYS.includes(fullKey) && !ALLOWED_TAB3_KEYS.includes(canonicalDestinationKey)) {
            unsupportedKeys.push(fullKey);
            return;
        }

        if (!hasMetafieldsBaseline) {
            blockedFields[fullKey] = "Product metafields baseline could not be loaded from Shopify; reload product data before deleting.";
            return;
        }

        if (currentMetafields[fullKey] !== undefined) {
           deleteFromShopify.push({ ownerId: productGid, namespace: ns, key: key });
           proposedChanges[fullKey] = { from: currentMetafields[fullKey], to: null };
           attemptedDestinations.push(fullKey);
        } else {
           unchanged.push(fullKey);
        }
      });

      const resolvedVariantTargetForResponse =
        attemptedVariantMetafieldWrite && verifiedSingleVariantGid
          ? verifiedSingleVariantGid
          : priceVariantGid || verifiedSingleVariantGid || null;

      if (attemptedDestinations.length === 0) {
          const hasIntendedThatFailed = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;
          if (hasIntendedThatFailed) {
              return Response.json({
                  intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_BLOCKED",
                  message: "No changes executed. Some requested changes were blocked or unsupported.",
                  fieldsUpdated: 0, legacyKeysRemoved: 0,
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
                  repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
                  variantTarget: resolvedVariantTargetForResponse
              });
          }
          return Response.json({
              intent: "executeRepairPlan", pieceId, success: true, status: "NO_CHANGES_REQUIRED",
              fieldsUpdated: 0, legacyKeysRemoved: 0, message: "No intended changes required.",
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
              repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
              variantTarget: resolvedVariantTargetForResponse
          });
      }

      return await executeStagedRepairMutationsAndReadBack({
        admin,
        pieceId,
        productGid,
        isBenchV2OptIn,
        repairPlan,
        nativeChanges,
        nativeInput,
        doNativeUpdate: getDoNativeUpdate(),
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
      });
    }

    if (intent === "saveMetafields" || intent === "saveProduct") {
      const loaderRes = await loaderAction({ request: unconsumedRequestClone });
      if (loaderRes instanceof Response) {
        return loaderRes;
      }
      return Response.json(loaderRes);
    }

    if (intent === "geoLookup" || intent === "tab2AutoFill" || intent === "titleParse" || intent === "visionScan" || intent === "fullRescan" || intent === "tab3FullRescan" || intent === "generateDescription") {
      const autofillRes = await executeAutofill(intent, body, admin);
      if (autofillRes instanceof Response) {
        return autofillRes;
      }
      return Response.json(autofillRes);
    }

    const targetId = body.get("pieceId") || body.get("productId") || null;
    const unsupportedErrMsg = `Unsupported action intent "${intent || "unknown"}" on /app/meta-injector-api: no writer handler is implemented for this operation.`;
    return Response.json({
      intent: intent || "unknown",
      pieceId: targetId,
      productId: targetId,
      success: false,
      status: "UNSUPPORTED_INTENT",
      message: unsupportedErrMsg,
      error: unsupportedErrMsg,
      errors: [{ message: unsupportedErrMsg }]
    });
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    if (matchingContext) {
      return Response.json({
        intent: matchingContext.intent,
        readOnly: true,
        requestId: matchingContext.requestId,
        pieceId: matchingContext.pieceId,
        success: false,
        isComplete: false,
        error: error.message,
        errors: [error.message]
      }, { status: 500 });
    }
    return Response.json({ success: false, intent: "unknown", error: error.message }, { status: 500 });
  }
};
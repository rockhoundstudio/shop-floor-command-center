import {
  REMOVED_PARKED_DESTINATION_LIST,
  REMOVED_PARKED_CUSTOM_INPUT_ALIAS_LIST,
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES,
  FIELD_CATALOG
} from "./meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS,
  SUPPORTED_STANDARDIZED_REFERENCE_KEYS,
  extractEntryMatchingLabels,
  extractTaxonomyReference
} from "./meta-injector.standardized.jsx";
import {
  isExactProductGid,
  isExactMetaobjectDefinitionGid
} from "./bench-v2.contract.jsx";
import {
  evaluateStandardizedCategoryEligibility,
  readProductMetafieldDefinitionsWithConstraints as fetchProductMetafieldDefinitionsWithConstraints
} from "./bench-v2.baseline.server.jsx";

// 🟢 Read-Only Actions Engine — No Prisma Import, No Mutations Here

export const RETIRED_KEYS = Array.from(
  new Set([
    "artist_notes", "bench_notes", "handcrafted_by", "color",
    "cut_and_shape", "stone_shape", "primary_use",
    "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
    "custom.cut_and_shape", "custom.stone_shape", "custom.primary_use",
    ...REMOVED_PARKED_DESTINATION_LIST,
    ...REMOVED_PARKED_CUSTOM_INPUT_ALIAS_LIST
  ])
);

const RETIRED_KEYS_SET = new Set(RETIRED_KEYS);

function isRetiredCatalogMetafieldEntry(field, destKey) {
  if (!field || typeof destKey !== "string" || !destKey.trim()) return true;
  const resolvedOwner =
    field.registryOwner ||
    (field.owner === "variant_metafield" ? "PRODUCTVARIANT" : "PRODUCT");
  const rawKey = typeof field.key === "string" ? field.key.trim() : "";

  if (
    RETIRED_KEYS_SET.has(destKey) ||
    RETIRED_KEYS_SET.has(rawKey) ||
    REMOVED_PARKED_CANONICAL_IDENTITIES.has(`${resolvedOwner}:${destKey}`) ||
    REMOVED_PARKED_DESTINATIONS.has(destKey)
  ) {
    return true;
  }

  if (
    resolvedOwner === "PRODUCT" &&
    (field.namespace === "custom" || (!field.namespace && !rawKey.includes("."))) &&
    (REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(rawKey) ||
      REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(destKey))
  ) {
    return true;
  }

  return false;
}

export const ALL_STANDARDIZED_META_KEYS = Array.from(
  new Set(
    FIELD_CATALOG
      .filter(f => {
        if (!f || (f.role !== "standardized_attribute" && f.namespace !== "shopify")) return false;
        const mk = f.metaKey || f.key;
        const destKey = `shopify.${mk}`;
        return (
          !REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${destKey}`) &&
          !REMOVED_PARKED_DESTINATIONS.has(destKey)
        );
      })
      .map(f => f.metaKey || f.key)
  )
);

export const CATALOG_STANDARDIZED_META_KEYS = new Set(ALL_STANDARDIZED_META_KEYS);

const CATALOG_METAFIELD_DESTINATIONS = Array.from(
  new Set(
    FIELD_CATALOG
      .filter(f => {
        if (!f || f.owner === "native" || f.namespace === "native" || f.key.startsWith("native_")) return false;
        if (f.key === "shopify_title" || f.key === "price") return false;
        const ns = f.namespace || f.metaConfig?.namespace || "custom";
        const mk = f.metaKey || f.key;
        const destKey = `${ns}.${mk}`;
        if (isRetiredCatalogMetafieldEntry(f, destKey)) return false;
        return true;
      })
      .map(f => {
        const ns = f.namespace || f.metaConfig?.namespace || "custom";
        const mk = f.metaKey || f.key;
        return `${ns}.${mk}`;
      })
  )
);

const CATALOG_READ_ONLY_DESTINATIONS = new Set([
  ...FIELD_CATALOG
    .filter(f => f.mappingStatus === "pending_read_only" || f.key === "is_ooak")
    .map(f => {
      const ns = f.namespace || f.metaConfig?.namespace || "custom";
      const mk = f.metaKey || f.key;
      return `${ns}.${mk}`;
    }),
  ...REMOVED_PARKED_DESTINATION_LIST
]);

function isGeneratedIdLabel(str) {
  if (typeof str !== "string") return true;
  const trimmed = str.trim();
  if (!trimmed) return true;
  if (/^gid:\/\//i.test(trimmed)) return true;
  if (/metaobject/i.test(trimmed) && /\d/.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (/^\d+$/.test(trimmed)) return true;
  return false;
}

function normalizeCandidateMatchKey(str) {
  return String(str || "").trim().toLowerCase();
}

function parseStoredReferenceList(rawVal) {
  if (rawVal === undefined || rawVal === null) return { valid: true, ids: [] };
  const trimmed = String(rawVal).trim();
  if (trimmed === "") return { valid: true, ids: [] };
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const allValid = parsed.every(item => typeof item === "string" && /^gid:\/\/shopify\/Metaobject\/\d+$/.test(item.trim()));
      if (!allValid) {
        return { valid: false, ids: [], error: "Stored value contains non-Metaobject GID items." };
      }
      return { valid: true, ids: parsed.map(item => item.trim()) };
    }
  } catch (e) {
    // Fallback check for single GID
  }
  if (/^gid:\/\/shopify\/Metaobject\/\d+$/.test(trimmed)) {
    return { valid: true, ids: [trimmed] };
  }
  return { valid: false, ids: [], error: "Stored value is not a valid Metaobject GID list." };
}

export async function executeLoadProductData({ admin, body }) {
  const pieceId = body.get("pieceId");
  const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

  let productQueryRes;
  try {
    productQueryRes = await admin.graphql(`
      query getProduct($id: ID!) {
        product(id: $id) {
          id title descriptionHtml seo { title description }
          category { id fullName }
          metafields(first: 250) { edges { node { namespace key value } } }
          variants(first: 250) {
            pageInfo { hasNextPage endCursor }
            edges { node { id title price inventoryItem { measurement { weight { value unit } } } } }
          }
          media(first: 250) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                ... on MediaImage {
                  id alt preview { image { url } }
                }
              }
            }
          }
        }
      }
    `, { variables: { id: productGid } });
  } catch (e) {
    return Response.json({ intent: "loadProductData", success: false, message: "Failed to query product data: " + e.message });
  }

  const productData = await productQueryRes.json();
  const product = productData?.data?.product;
  if (!product) return Response.json({ intent: "loadProductData", success: false, message: "Product not found" });

  const currentMetafields = {};
  if (product.metafields?.edges) {
    product.metafields.edges.forEach(({node}) => {
        currentMetafields[`${node.namespace}.${node.key}`] = node.value;
    });
  }

  const allVariants = [];
  const allMedia = [];
  let vPageInfo = product.variants?.pageInfo || { hasNextPage: false, endCursor: null };
  let mPageInfo = product.media?.pageInfo || { hasNextPage: false, endCursor: null };

  if (product.variants?.edges) allVariants.push(...product.variants.edges);
  if (product.media?.edges) {
      allMedia.push(...product.media.edges.filter(e => e.node && e.node.id));
  }

  let isComplete = true;
  let loadError = null;

  try {
      while (vPageInfo.hasNextPage) {
          const vRes = await admin.graphql(`
              query getVariants($id: ID!, $cursor: String!) {
                  product(id: $id) {
                      variants(first: 250, after: $cursor) {
                          pageInfo { hasNextPage endCursor }
                          edges { node { id title price inventoryItem { measurement { weight { value unit } } } } }
                      }
                  }
              }
          `, { variables: { id: productGid, cursor: vPageInfo.endCursor } });
          const vJson = await vRes.json();
          if (vJson.errors) throw new Error(vJson.errors[0].message);
          const newVariants = vJson?.data?.product?.variants;
          if (newVariants?.edges) allVariants.push(...newVariants.edges);
          vPageInfo = newVariants?.pageInfo || { hasNextPage: false, endCursor: null };
      }
  } catch (err) {
      isComplete = false;
      loadError = `Variants pagination failed: ${err.message}`;
      vPageInfo.hasNextPage = true;
  }

  try {
      while (mPageInfo.hasNextPage) {
          const mRes = await admin.graphql(`
              query getMedia($id: ID!, $cursor: String!) {
                  product(id: $id) {
                      media(first: 250, after: $cursor) {
                          pageInfo { hasNextPage endCursor }
                          edges {
                              node {
                                  ... on MediaImage { id alt preview { image { url } } }
                              }
                          }
                      }
                  }
              }
          `, { variables: { id: productGid, cursor: mPageInfo.endCursor } });
          const mJson = await mRes.json();
          if (mJson.errors) throw new Error(mJson.errors[0].message);
          const newMedia = mJson?.data?.product?.media;
          if (newMedia?.edges) {
              allMedia.push(...newMedia.edges.filter(e => e.node && e.node.id));
          }
          mPageInfo = newMedia?.pageInfo || { hasNextPage: false, endCursor: null };
      }
  } catch (err) {
      isComplete = false;
      loadError = loadError ? `${loadError} | Media pagination failed: ${err.message}` : `Media pagination failed: ${err.message}`;
      mPageInfo.hasNextPage = true;
  }

  const uniqueVariants = Array.from(new Map(allVariants.map(e => [e.node.id, e])).values());
  const uniqueMedia = Array.from(new Map(allMedia.map(e => [e.node.id, e])).values());

  const productCategory = product.category
    ? { id: product.category.id || null, fullName: product.category.fullName || null }
    : null;

  const nativeTargets = {
      productId: product.id, productTitle: product.title, descriptionHtml: product.descriptionHtml, seo: product.seo,
      category: productCategory,
      isComplete,
      loadError,
      variants: {
          edges: uniqueVariants,
          pageInfo: vPageInfo
      },
      media: {
          edges: uniqueMedia,
          pageInfo: mPageInfo
      }
  };

  const canonicalFields = {};
  const repairPlan = {};
  const legacyFields = {};

  CATALOG_METAFIELD_DESTINATIONS.forEach(destKey => {
      if (
        RETIRED_KEYS_SET.has(destKey) ||
        REMOVED_PARKED_DESTINATIONS.has(destKey) ||
        REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${destKey}`) ||
        REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCTVARIANT:${destKey}`)
      ) {
          return;
      }
      const val = currentMetafields[destKey] ?? "";
      canonicalFields[destKey] = val;
      if (!CATALOG_READ_ONLY_DESTINATIONS.has(destKey)) {
          repairPlan[destKey] = val;
      }
  });

  const INSPECTION_ONLY_KEYS = [
    "global.title_tag",
    "global.description_tag",
    "custom.base_stone_type",
    "custom.hardness",
    "custom.honest_flaws",
    "custom.is_ooak",
    "custom.stone_family",
    "custom.primary_medium",
    "custom.origin_handle"
  ];
  INSPECTION_ONLY_KEYS.forEach(k => {
      if (currentMetafields[k] !== undefined) {
          canonicalFields[k] = currentMetafields[k];
      }
  });

  canonicalFields["shopify_title"] = product.title;
  repairPlan["shopify_title"] = product.title;
  canonicalFields["price"] = uniqueVariants[0]?.node?.price || "0.00";
  repairPlan["price"] = canonicalFields["price"];

  if (typeof product.seo?.description === "string" && product.seo.description.trim() !== "") {
      canonicalFields["native_seo_description"] = product.seo.description;
  }

  const LEGACY_MAP_LOCAL = {
    "custom.crystal-system": "shopify.crystal-system",
    "custom.mineral-class": "shopify.mineral-class",
    "custom.rock-composition": "shopify.rock-composition",
    "custom.geological-era": "shopify.geological-era",
    "custom.rock-formation": "shopify.rock-formation"
  };

  Object.entries(LEGACY_MAP_LOCAL).forEach(([leg, can]) => {
     if (currentMetafields[leg] !== undefined) {
        legacyFields[leg] = {
           value: String(currentMetafields[leg]),
           canonicalTarget: can,
           canonicalCurrent: canonicalFields[can]
        };
     }
  });

  return Response.json({
     intent: "loadProductData",
     success: true,
     productId: product.id, productTitle: product.title, descriptionHtml: product.descriptionHtml, seo: product.seo,
     productCategory,
     currentMetafields,
     canonicalFields,
     legacyFields,
     repairPlan,
     nativeTargets
  });
}

export async function executeResolveStandardizedCandidates({ admin, body, onMatchingContext }) {
  const rawPieceId = body.get("pieceId");
  const rawCandidates = body.get("standardized_candidates");
  const rawEnumerateDestinations = body.get("enumerate_destinations");
  const rawRequestId = body.get("requestId");
  const pieceId = typeof rawPieceId === "string" ? rawPieceId.trim() : "";
  const requestId = typeof rawRequestId === "string" && rawRequestId.trim() !== "" ? rawRequestId.trim() : null;

  if (typeof onMatchingContext === "function") {
    onMatchingContext({
      intent: "resolveStandardizedCandidates",
      pieceId: pieceId || null,
      requestId,
      readOnly: true
    });
  }

  if (!pieceId || !isExactProductGid(pieceId)) {
    return Response.json({
      intent: "resolveStandardizedCandidates",
      readOnly: true,
      requestId,
      success: false,
      pieceId: pieceId || null,
      isComplete: false,
      errors: ["Invalid or missing pieceId: exact product GID (gid://shopify/Product/...) is required."],
      resolutions: {},
      currentReferenceLists: {},
      categoryEligibility: {}
    });
  }

  const supportedBareKeySet = new Set(SUPPORTED_STANDARDIZED_REFERENCE_KEYS);
  let hasExplicitEnumerateDestinations = false;
  const explicitEnumerateBareKeys = [];
  const seenEnumerateBareKeys = new Set();

  if (rawEnumerateDestinations !== null && rawEnumerateDestinations !== undefined) {
    hasExplicitEnumerateDestinations = true;
    if (typeof rawEnumerateDestinations !== "string" || rawEnumerateDestinations.trim() === "") {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: ["Invalid enumerate_destinations payload: must be a non-empty JSON array of supported shopify.* destinations."],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }

    let parsedEnumerateList;
    try {
      parsedEnumerateList = JSON.parse(rawEnumerateDestinations);
    } catch (err) {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: [`Malformed enumerate_destinations JSON: ${err.message}`],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }

    if (!Array.isArray(parsedEnumerateList) || parsedEnumerateList.length === 0) {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: ["enumerate_destinations must be a non-empty JSON array of supported shopify.* destinations."],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }

    const enumerateValidationErrors = [];
    for (const rawDestItem of parsedEnumerateList) {
      if (typeof rawDestItem !== "string" || rawDestItem.trim() === "") {
        enumerateValidationErrors.push(`Invalid destination entry in enumerate_destinations: "${String(rawDestItem)}".`);
        continue;
      }
      const trimmedDest = rawDestItem.trim();
      const bareKey = trimmedDest.startsWith("shopify.") ? trimmedDest.slice(8) : trimmedDest;
      const fullStdDest = `shopify.${bareKey}`;
      if (
        REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${fullStdDest}`) ||
        REMOVED_PARKED_DESTINATIONS.has(fullStdDest) ||
        !supportedBareKeySet.has(bareKey)
      ) {
        enumerateValidationErrors.push(`Unsupported standardized reference destination "${trimmedDest}" in enumerate_destinations.`);
        continue;
      }
      if (!seenEnumerateBareKeys.has(bareKey)) {
        seenEnumerateBareKeys.add(bareKey);
        explicitEnumerateBareKeys.push(bareKey);
      }
    }

    if (enumerateValidationErrors.length > 0 || explicitEnumerateBareKeys.length === 0) {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: enumerateValidationErrors.length > 0
          ? enumerateValidationErrors
          : ["No supported standardized reference destinations remained in enumerate_destinations."],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }
  }

  if (
    !hasExplicitEnumerateDestinations &&
    (rawCandidates === null || rawCandidates === undefined || String(rawCandidates).trim() === "")
  ) {
    return Response.json({
      intent: "resolveStandardizedCandidates",
      readOnly: true,
      requestId,
      success: false,
      pieceId,
      isComplete: false,
      errors: ["Missing standardized_candidates JSON payload."],
      resolutions: {},
      currentReferenceLists: {},
      categoryEligibility: {}
    });
  }

  let parsedCandidates = {};
  if (rawCandidates !== null && rawCandidates !== undefined && String(rawCandidates).trim() !== "") {
    try {
      parsedCandidates = typeof rawCandidates === "string" ? JSON.parse(rawCandidates) : rawCandidates;
    } catch (err) {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: [`Malformed standardized_candidates JSON: ${err.message}`],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }

    if (!parsedCandidates || typeof parsedCandidates !== "object" || Array.isArray(parsedCandidates)) {
      return Response.json({
        intent: "resolveStandardizedCandidates",
        readOnly: true,
        requestId,
        success: false,
        pieceId,
        isComplete: false,
        errors: ["standardized_candidates must be a non-null JSON object."],
        resolutions: {},
        currentReferenceLists: {},
        categoryEligibility: {}
      });
    }
  }

  const inputValidationErrors = [];
  const validatedCandidateEntries = {};

  for (const [key, val] of Object.entries(parsedCandidates)) {
    const bareCandidateKey = key.startsWith("shopify.") ? key.slice(8) : key;
    const fullCandidateDest = `shopify.${bareCandidateKey}`;
    if (
      REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:${fullCandidateDest}`) ||
      REMOVED_PARKED_DESTINATIONS.has(fullCandidateDest) ||
      !ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(key)
    ) {
      inputValidationErrors.push(`Disallowed candidate key "${key}". Allowed keys: ${ALLOWED_STANDARDIZED_CANDIDATE_KEYS.join(", ")}.`);
      continue;
    }
    if (!val || typeof val !== "object" || Array.isArray(val)) {
      inputValidationErrors.push(`Candidate "${key}" must be an object containing labels and evidence.`);
      continue;
    }
    if (!Array.isArray(val.labels) || val.labels.length === 0) {
      inputValidationErrors.push(`Candidate "${key}" requires a non-empty string array for "labels".`);
      continue;
    }
    if (typeof val.evidence !== "string" || val.evidence.trim() === "") {
      inputValidationErrors.push(`Candidate "${key}" requires a non-empty string for "evidence".`);
      continue;
    }

    const cleanLabels = [];
    for (const rawLabel of val.labels) {
      if (typeof rawLabel !== "string" || rawLabel.trim() === "") {
        inputValidationErrors.push(`Candidate "${key}" contains an empty or non-string label.`);
        continue;
      }
      if (isGeneratedIdLabel(rawLabel)) {
        inputValidationErrors.push(`Candidate "${key}" contains a generated ID or invalid identifier as label: "${rawLabel}".`);
        continue;
      }
      cleanLabels.push(rawLabel.trim());
    }

    validatedCandidateEntries[key] = {
      labels: cleanLabels,
      evidence: val.evidence.trim()
    };
  }

  if (inputValidationErrors.length > 0) {
    return Response.json({
      intent: "resolveStandardizedCandidates",
      readOnly: true,
      requestId,
      success: false,
      pieceId,
      isComplete: false,
      errors: inputValidationErrors,
      resolutions: {},
      currentReferenceLists: {},
      categoryEligibility: {}
    });
  }

  const topErrors = [];
  let overallComplete = true;

  const productShopifyMetafields = {};
  let productCategory = null;
  let productCategoryReadComplete = false;
  let productMetafieldsReadComplete = false;
  let mfPageInfo = { hasNextPage: true, endCursor: null };
  let mfPagesFetched = 0;
  const MAX_MF_PAGES = 10;

  try {
    while (mfPageInfo.hasNextPage && mfPagesFetched < MAX_MF_PAGES) {
      mfPagesFetched++;
      const prodRes = await admin.graphql(`
        query getProductStandardizedMetafields($id: ID!, $cursor: String) {
          product(id: $id) {
            id
            category { id fullName }
            metafields(first: 250, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      `, { variables: { id: pieceId, cursor: mfPageInfo.endCursor } });

      const prodJson = await prodRes.json();
      if (prodJson.errors?.length) {
        throw new Error(prodJson.errors.map(e => e.message).join("; "));
      }
      const productNode = prodJson?.data?.product;
      if (!productNode || productNode.id !== pieceId) {
        return Response.json({
          intent: "resolveStandardizedCandidates",
          readOnly: true,
          requestId,
          success: false,
          pieceId,
          isComplete: false,
          errors: [`Product not found or ID mismatch for ${pieceId}.`],
          resolutions: {},
          currentReferenceLists: {},
          categoryEligibility: {}
        });
      }

      if (mfPagesFetched === 1) {
        productCategory = productNode.category
          ? { id: productNode.category.id || null, fullName: productNode.category.fullName || null }
          : null;
        productCategoryReadComplete = true;
      }

      const mfConn = productNode.metafields;
      if (!mfConn || !Array.isArray(mfConn.edges) || typeof mfConn.pageInfo?.hasNextPage !== "boolean") {
        throw new Error("Malformed product metafields connection response.");
      }

      for (const edge of mfConn.edges) {
        const node = edge?.node;
        if (!node) continue;
        const fullKey = `${node.namespace}.${node.key}`;
        if (node.namespace === "shopify" && CATALOG_STANDARDIZED_META_KEYS.has(node.key)) {
          productShopifyMetafields[fullKey] = {
            id: node.id,
            namespace: node.namespace,
            key: node.key,
            value: node.value,
            type: node.type
          };
        }
      }

      mfPageInfo = mfConn.pageInfo;
    }

    if (mfPageInfo.hasNextPage) {
      overallComplete = false;
      topErrors.push(`Product metafields pagination exceeded bounded limit (${MAX_MF_PAGES} pages). endCursor: ${mfPageInfo.endCursor}`);
    } else {
      productMetafieldsReadComplete = true;
    }
  } catch (err) {
    overallComplete = false;
    topErrors.push(`Failed reading product metafields and category: ${err.message}`);
  }

  const defReadResult = await fetchProductMetafieldDefinitionsWithConstraints(admin);
  const liveDefs = defReadResult.defs;
  const defsReadComplete = defReadResult.defsReadComplete;
  if (!defsReadComplete) {
    overallComplete = false;
  }
  if (defReadResult.errors.length > 0) {
    topErrors.push(...defReadResult.errors);
  }

  const categoryEligibility = {};
  const nonCandidateConstraintDiagnostics = {};
  for (const stdMetaKey of ALL_STANDARDIZED_META_KEYS) {
    const dest = `shopify.${stdMetaKey}`;
    const liveDef = liveDefs[dest] || null;
    const elig = evaluateStandardizedCategoryEligibility({
      destination: dest,
      liveDef,
      defsReadComplete,
      productCategory,
      productCategoryReadComplete
    });
    categoryEligibility[dest] = elig;
    if (!elig.isComplete && !ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(stdMetaKey) && !seenEnumerateBareKeys.has(stdMetaKey)) {
      nonCandidateConstraintDiagnostics[dest] = elig.reason;
    }
  }

  const metaobjectDefCache = new Map();
  const MAX_ENTRY_PAGES = 20;

  async function resolveAndEnumerateMetaobjectDef(moDefId) {
    if (metaobjectDefCache.has(moDefId)) {
      return metaobjectDefCache.get(moDefId);
    }

    const state = {
      definition: null,
      entries: [],
      isComplete: false,
      error: null,
      continuation: null
    };

    try {
      const moDefRes = await admin.graphql(`
        query getMetaobjectDefinition($id: ID!) {
          metaobjectDefinition(id: $id) {
            id
            type
            name
            displayNameKey
            fieldDefinitions {
              key
              name
              type { name }
            }
          }
        }
      `, { variables: { id: moDefId } });

      const moDefJson = await moDefRes.json();
      if (moDefJson.errors?.length) {
        throw new Error(moDefJson.errors.map(e => e.message).join("; "));
      }

      const defNode = moDefJson?.data?.metaobjectDefinition;
      if (!defNode || !defNode.id || !defNode.type) {
        state.error = `Restricted metaobjectDefinition ${moDefId} not found or missing required type.`;
        metaobjectDefCache.set(moDefId, state);
        return state;
      }

      state.definition = {
        id: defNode.id,
        type: defNode.type,
        name: defNode.name || null,
        displayNameKey: defNode.displayNameKey || null
      };

      let entryPageInfo = { hasNextPage: true, endCursor: null };
      let pagesFetched = 0;

      while (entryPageInfo.hasNextPage && pagesFetched < MAX_ENTRY_PAGES) {
        pagesFetched++;
        const entriesRes = await admin.graphql(`
          query listMetaobjectsByType($type: String!, $cursor: String) {
            metaobjects(type: $type, first: 250, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              edges {
                node {
                  id
                  handle
                  type
                  displayName
                  definition { id type name }
                  fields { key value }
                }
              }
            }
          }
        `, { variables: { type: defNode.type, cursor: entryPageInfo.endCursor } });

        const entriesJson = await entriesRes.json();
        if (entriesJson.errors?.length) {
          throw new Error(entriesJson.errors.map(e => e.message).join("; "));
        }

        const moConn = entriesJson?.data?.metaobjects;
        if (!moConn || !Array.isArray(moConn.edges) || typeof moConn.pageInfo?.hasNextPage !== "boolean") {
          throw new Error(`Malformed metaobjects connection response for type "${defNode.type}".`);
        }

        for (const edge of moConn.edges) {
          const node = edge?.node;
          if (!node || !node.id) continue;
          if (!/^gid:\/\/shopify\/Metaobject\/\d+$/.test(node.id)) continue;
          if (node.definition?.id && node.definition.id !== defNode.id) continue;

          const candidateLabels = extractEntryMatchingLabels(node);
          const taxonomyRef = extractTaxonomyReference(node);

          state.entries.push({
            id: node.id,
            handle: node.handle || null,
            displayName: node.displayName || (candidateLabels[0] ?? null),
            matchingLabels: candidateLabels,
            definition: {
              id: node.definition?.id || defNode.id,
              type: node.definition?.type || defNode.type,
              name: node.definition?.name || defNode.name || null
            },
            taxonomy_reference: taxonomyRef
          });
        }

        entryPageInfo = moConn.pageInfo;
      }

      if (entryPageInfo.hasNextPage) {
        state.isComplete = false;
        state.continuation = {
          hasNextPage: true,
          endCursor: entryPageInfo.endCursor,
          pagesFetched
        };
        state.error = `Enumeration for "${defNode.type}" reached bounded page limit (${MAX_ENTRY_PAGES} pages).`;
      } else {
        state.isComplete = true;
      }
    } catch (err) {
      state.isComplete = false;
      state.error = err.message;
    }

    metaobjectDefCache.set(moDefId, state);
    return state;
  }

  const resolutions = {};
  const currentReferenceLists = {};

  const keysForReferenceLists = hasExplicitEnumerateDestinations
    ? SUPPORTED_STANDARDIZED_REFERENCE_KEYS.filter(
        (k) =>
          (seenEnumerateBareKeys.has(k) || ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(k)) &&
          !REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:shopify.${k}`) &&
          !REMOVED_PARKED_DESTINATIONS.has(`shopify.${k}`)
      )
    : ALLOWED_STANDARDIZED_CANDIDATE_KEYS.filter(
        (k) =>
          !REMOVED_PARKED_CANONICAL_IDENTITIES.has(`PRODUCT:shopify.${k}`) &&
          !REMOVED_PARKED_DESTINATIONS.has(`shopify.${k}`)
      );

  for (const attrKey of keysForReferenceLists) {
    const destination = `shopify.${attrKey}`;
    const storedMf = productShopifyMetafields[destination] || null;
    const parsedStored = parseStoredReferenceList(storedMf?.value);
    const liveDef = liveDefs[destination] || null;
    const catElig = categoryEligibility[destination] || evaluateStandardizedCategoryEligibility({
      destination,
      liveDef,
      defsReadComplete,
      productCategory,
      productCategoryReadComplete
    });

    currentReferenceLists[destination] = {
      destination,
      readComplete: productMetafieldsReadComplete,
      metafieldId: storedMf?.id || null,
      storedType: storedMf?.type || null,
      rawValue: storedMf?.value ?? null,
      referenceIds: parsedStored.ids,
      parseValid: parsedStored.valid,
      parseError: parsedStored.error || null
    };

    const candidateInput = validatedCandidateEntries[attrKey] || null;
    const isRequestedForEnumeration = hasExplicitEnumerateDestinations && seenEnumerateBareKeys.has(attrKey);
    if (!candidateInput && !isRequestedForEnumeration) {
      continue;
    }

    const candidateLabels = candidateInput ? candidateInput.labels : [];
    const fieldErrors = [];
    let fieldStatus = "incomplete";
    let entryMatchStatus = "incomplete";
    let fieldComplete = false;
    let resolvedMetaobjectDefinition = null;
    let enumeratedEntries = [];
    let continuation = null;
    const labelResults = [];

    if (!defsReadComplete || !productMetafieldsReadComplete || !productCategoryReadComplete) {
      fieldStatus = "incomplete";
      entryMatchStatus = "incomplete";
      fieldComplete = false;
      overallComplete = false;
      fieldErrors.push("Initial product metafields, product category, or PRODUCT metafieldDefinitions read did not complete.");
      for (const lbl of candidateLabels) {
        labelResults.push({
          label: lbl,
          status: "incomplete",
          matches: [],
          error: "Prerequisite product or definition read was incomplete."
        });
      }
    } else if (!liveDef) {
      fieldStatus = "blocked";
      entryMatchStatus = "blocked";
      fieldComplete = true;
      fieldErrors.push(`Missing live PRODUCT metafield definition for ${destination}.`);
      for (const lbl of candidateLabels) {
        labelResults.push({
          label: lbl,
          status: "blocked",
          matches: [],
          error: `Missing live PRODUCT metafield definition for ${destination}.`
        });
      }
    } else if (liveDef.type !== "list.metaobject_reference") {
      fieldStatus = "blocked";
      entryMatchStatus = "blocked";
      fieldComplete = true;
      fieldErrors.push(`Wrong live type for ${destination}: expected "list.metaobject_reference", got "${liveDef.type || "none"}".`);
      for (const lbl of candidateLabels) {
        labelResults.push({
          label: lbl,
          status: "blocked",
          matches: [],
          error: `Wrong live type: "${liveDef.type || "none"}" (requires "list.metaobject_reference").`
        });
      }
    } else if (
      !liveDef.restrictedMetaobjectDefinitionId ||
      !isExactMetaobjectDefinitionGid(liveDef.restrictedMetaobjectDefinitionId)
    ) {
      fieldStatus = "blocked";
      entryMatchStatus = "blocked";
      fieldComplete = true;
      fieldErrors.push(`Missing or invalid metaobject_definition_id restriction on ${destination}.`);
      for (const lbl of candidateLabels) {
        labelResults.push({
          label: lbl,
          status: "blocked",
          matches: [],
          error: `Missing or invalid metaobject_definition_id restriction on ${destination}.`
        });
      }
    } else if (isRequestedForEnumeration && !candidateInput && catElig.isComplete && !catElig.isEligible) {
      fieldStatus = "category_ineligible";
      entryMatchStatus = "category_ineligible";
      fieldComplete = true;
      continuation = catElig.continuation || null;
      if (catElig.reason) {
        fieldErrors.push(catElig.reason);
      }
    } else {
      const enumState = await resolveAndEnumerateMetaobjectDef(liveDef.restrictedMetaobjectDefinitionId);
      resolvedMetaobjectDefinition = enumState.definition;
      enumeratedEntries = enumState.entries;
      continuation = enumState.continuation || catElig.continuation || null;

      if (!enumState.definition) {
        fieldStatus = "blocked";
        entryMatchStatus = "blocked";
        fieldComplete = true;
        fieldErrors.push(enumState.error || `Restricted metaobject definition ${liveDef.restrictedMetaobjectDefinitionId} could not be resolved.`);
        for (const lbl of candidateLabels) {
          labelResults.push({
            label: lbl,
            status: "blocked",
            matches: [],
            error: enumState.error || "Restricted metaobject definition could not be resolved."
          });
        }
      } else if (!enumState.isComplete) {
        fieldStatus = "incomplete";
        entryMatchStatus = "incomplete";
        fieldComplete = false;
        overallComplete = false;
        if (enumState.error) fieldErrors.push(enumState.error);

        for (const lbl of candidateLabels) {
          const normTarget = normalizeCandidateMatchKey(lbl);
          const partialMatches = enumeratedEntries.filter(entry =>
            entry.matchingLabels.some(mLbl => normalizeCandidateMatchKey(mLbl) === normTarget)
          ).map(entry => ({
            id: entry.id,
            displayName: entry.displayName,
            definition: entry.definition,
            taxonomy_reference: entry.taxonomy_reference
          }));

          labelResults.push({
            label: lbl,
            status: "incomplete",
            matches: partialMatches,
            error: enumState.error || "Metaobject enumeration was not completed; cannot assert missing_entry or final resolution."
          });
        }
      } else {
        for (const lbl of candidateLabels) {
          const normTarget = normalizeCandidateMatchKey(lbl);
          const exactMatches = enumeratedEntries.filter(entry =>
            entry.matchingLabels.some(mLbl => normalizeCandidateMatchKey(mLbl) === normTarget)
          ).map(entry => ({
            id: entry.id,
            displayName: entry.displayName,
            definition: entry.definition,
            taxonomy_reference: entry.taxonomy_reference
          }));

          if (exactMatches.length === 1) {
            labelResults.push({
              label: lbl,
              status: "matched",
              matchedEntry: exactMatches[0],
              matches: exactMatches
            });
          } else if (exactMatches.length > 1) {
            labelResults.push({
              label: lbl,
              status: "ambiguous",
              matches: exactMatches
            });
          } else {
            labelResults.push({
              label: lbl,
              status: "missing_entry",
              matches: []
            });
          }
        }

        if (candidateLabels.length > 0) {
          const statuses = labelResults.map(r => r.status);
          if (statuses.every(s => s === "matched")) {
            entryMatchStatus = "matched";
          } else if (statuses.some(s => s === "ambiguous")) {
            entryMatchStatus = "ambiguous";
          } else if (statuses.some(s => s === "missing_entry")) {
            entryMatchStatus = "missing_entry";
          } else {
            entryMatchStatus = "incomplete";
          }
        } else {
          entryMatchStatus = "matched";
        }

        if (!catElig.isComplete) {
          fieldStatus = "incomplete";
          fieldComplete = false;
          overallComplete = false;
          fieldErrors.push(catElig.reason);
        } else if (!catElig.isEligible) {
          fieldStatus = "category_ineligible";
          fieldComplete = true;
          fieldErrors.push(catElig.reason);
        } else {
          fieldStatus = entryMatchStatus;
          fieldComplete = true;
        }
      }
    }

    if (!fieldComplete && fieldErrors.length > 0) {
      topErrors.push(...fieldErrors.map(e => `[${destination}] ${e}`));
    }

    resolutions[destination] = {
      destination,
      attributeKey: attrKey,
      status: fieldStatus,
      entryMatchStatus,
      isComplete: fieldComplete,
      isCategoryEligible: catElig.isEligible === true,
      categoryEligibility: catElig,
      candidate: candidateInput
        ? {
            labels: candidateInput.labels,
            evidence: candidateInput.evidence
          }
        : null,
      currentAssignment: currentReferenceLists[destination],
      metafieldDefinition: liveDef
        ? {
            id: liveDef.id,
            name: liveDef.name,
            namespace: liveDef.namespace,
            key: liveDef.key,
            type: liveDef.type,
            restrictedMetaobjectDefinitionId: liveDef.restrictedMetaobjectDefinitionId,
            constraints: liveDef.constraints
          }
        : null,
      restrictedMetaobjectDefinition: resolvedMetaobjectDefinition,
      availableEntries: enumeratedEntries.map(e => ({
        id: e.id,
        displayName: e.displayName,
        definition: e.definition,
        taxonomy_reference: e.taxonomy_reference
      })),
      labelResolutions: labelResults,
      continuation,
      errors: fieldErrors
    };
  }

  return Response.json({
    intent: "resolveStandardizedCandidates",
    readOnly: true,
    requestId,
    success: overallComplete,
    pieceId,
    isComplete: overallComplete,
    defsReadComplete,
    productCategory,
    categoryEligibility,
    nonCandidateConstraintDiagnostics,
    resolutions,
    currentReferenceLists,
    errors: topErrors
  });
}
// ==========================================================================
// ROCKHOUND STUDIO — BENCH V2 ISOLATED READ-ONLY BASELINE CONNECTION
// File: app/utils/bench-v2.baseline.server.jsx
//
// Verified Existing Sources Confirmed in Context:
// 1. app/routes/app.meta-injector-api.jsx (138,970 chars — read-only query
//    shapes and definition/constraint readers organized locally below)
// 2. app/utils/bench-v2.contract.jsx (Saved SHA256:
//    F31EF4BC321AFC20A3696E53686EAD076D8583B8962D24EA667AC6D7DF144DBA)
//
// Source Dependency Note:
// - In app/routes/app.meta-injector-api.jsx, the read-only helpers
//   (fetchProductMetafieldDefinitionsWithConstraints,
//   evaluateStandardizedCategoryEligibility, normalizeTaxonomyCategoryCode,
//   doesCategoryMatchConstraintValue) and the single-product read queries inside
//   action (loadProductData and resolveStandardizedCandidates) are module-private
//   and not exported separately from the route action (which also contains
//   writer/mutation internals).
// - Per architectural boundary rules, we do NOT import app.meta-injector-api.jsx
//   into this module and do NOT claim global deduplication is completed yet.
//   Instead, this module organizes those exact verified read-only queries and
//   definition/constraint readers into an isolated, zero-mutation server module
//   that produces the exact baselineSnapshot shape consumed by
//   app/utils/bench-v2.contract.jsx.
//
// Strict Guarantees:
// - Accepts the authenticated admin client and one exact Product GID.
// - Reads ONLY that single product (never loads whole-store product inventory).
// - Completes pagination for product metafields, variants, media, and live
//   PRODUCT metafieldDefinitions + constraint values with cursor/loop/budget guards.
// - Preserves raw stored strings and types verbatim (zero trimming or coercion).
// - Never seeds baseline values into a repairPlan or proposal map.
// - Missing/failed/truncated reads report explicit false/incomplete flags and
//   per-destination constraint errors; never fabricates empty/absent completeness.
// - Zero GraphQL mutations, zero AI calls, zero database/service writes.
// ==========================================================================

import { isExactProductGid } from "./bench-v2.contract.jsx";

const MAX_METAFIELD_PAGES = 10;
const MAX_VARIANT_PAGES = 10;
const MAX_MEDIA_PAGES = 10;
const MAX_DEF_PAGES = 10;
const MAX_CONSTRAINT_PAGES = 20;

export function normalizeTaxonomyCategoryCode(rawVal) {
  if (typeof rawVal !== "string") return "";
  const trimmed = rawVal.trim();
  if (!trimmed) return "";
  const gidPrefix = "gid://shopify/TaxonomyCategory/";
  if (trimmed.startsWith(gidPrefix)) {
    return trimmed.slice(gidPrefix.length).trim();
  }
  return trimmed;
}

export function doesCategoryMatchConstraintValue(productCategoryId, constraintValue) {
  const prodCode = normalizeTaxonomyCategoryCode(productCategoryId);
  const consCode = normalizeTaxonomyCategoryCode(constraintValue);
  if (!prodCode || !consCode) return false;
  if (prodCode === consCode) return true;
  if (prodCode.startsWith(`${consCode}-`)) return true;
  return false;
}

/**
 * Evaluates category constraint eligibility for a destination using live
 * PRODUCT metafield definition constraints and the product's taxonomy category.
 * Organized from app/routes/app.meta-injector-api.jsx without modification.
 */
export function evaluateStandardizedCategoryEligibility({
  destination,
  liveDef,
  defsReadComplete,
  productCategory,
  productCategoryReadComplete
}) {
  const catId = productCategory?.id || null;
  const catFullName = productCategory?.fullName || null;
  const normalizedProductCategoryCode = normalizeTaxonomyCategoryCode(catId);

  if (defsReadComplete !== true || productCategoryReadComplete !== true) {
    return {
      destination,
      isComplete: false,
      isEligible: false,
      status: "incomplete",
      productCategory: productCategory || null,
      normalizedProductCategoryCode: normalizedProductCategoryCode || null,
      constraintKey: liveDef?.constraints?.key || null,
      permittedCategoryValues: liveDef?.constraints?.values || [],
      reason: "Prerequisite product category or PRODUCT metafieldDefinition enumeration did not complete."
    };
  }

  if (!liveDef) {
    return {
      destination,
      isComplete: true,
      isEligible: false,
      status: "missing_definition",
      productCategory: productCategory || null,
      normalizedProductCategoryCode: normalizedProductCategoryCode || null,
      constraintKey: null,
      permittedCategoryValues: [],
      reason: `Missing live PRODUCT metafield definition for ${destination}.`
    };
  }

  const constraintInfo = liveDef.constraints;
  if (!constraintInfo || constraintInfo.isComplete !== true || constraintInfo.error) {
    return {
      destination,
      isComplete: false,
      isEligible: false,
      status: "incomplete_constraints",
      productCategory: productCategory || null,
      normalizedProductCategoryCode: normalizedProductCategoryCode || null,
      constraintKey: constraintInfo?.key || null,
      permittedCategoryValues: constraintInfo?.values || [],
      continuation: constraintInfo?.continuation || null,
      reason: constraintInfo?.error || `Incomplete constraint enumeration on ${destination}.`
    };
  }

  const permittedValues = Array.isArray(constraintInfo.values) ? constraintInfo.values : [];
  const hasCategoryConstraint = Boolean(
    constraintInfo.hasConstraints || constraintInfo.key || permittedValues.length > 0
  );

  if (!hasCategoryConstraint) {
    return {
      destination,
      isComplete: true,
      isEligible: true,
      status: "unconstrained_eligible",
      productCategory: productCategory || null,
      normalizedProductCategoryCode: normalizedProductCategoryCode || null,
      constraintKey: null,
      permittedCategoryValues: [],
      reason: `No owner-subtype/category constraints restricted on ${destination}.`
    };
  }

  if (!catId || !normalizedProductCategoryCode) {
    return {
      destination,
      isComplete: true,
      isEligible: false,
      status: "missing_product_category",
      productCategory: productCategory || null,
      normalizedProductCategoryCode: null,
      constraintKey: constraintInfo.key || "category",
      permittedCategoryValues: permittedValues,
      reason: `Product has no assigned taxonomy category, but ${destination} requires category constraint (${constraintInfo.key || "category"}: [${permittedValues.join(", ")}]).`
    };
  }

  if (permittedValues.length === 0) {
    return {
      destination,
      isComplete: true,
      isEligible: false,
      status: "empty_constraint_values",
      productCategory: productCategory || null,
      normalizedProductCategoryCode,
      constraintKey: constraintInfo.key || "category",
      permittedCategoryValues: [],
      reason: `Metafield definition ${destination} declares constraint key "${constraintInfo.key}" with zero permitted values.`
    };
  }

  const matchedConstraintVal =
    permittedValues.find((val) => doesCategoryMatchConstraintValue(catId, val)) || null;

  if (!matchedConstraintVal) {
    const catDesc = catFullName ? `${catFullName} (${catId})` : catId;
    return {
      destination,
      isComplete: true,
      isEligible: false,
      status: "category_ineligible",
      productCategory: productCategory || null,
      normalizedProductCategoryCode,
      constraintKey: constraintInfo.key || "category",
      permittedCategoryValues: permittedValues,
      matchedConstraintValue: null,
      reason: `Category constraint mismatch on ${destination}: product category "${catDesc}" is not permitted by definition constraints [${permittedValues.join(", ")}].`
    };
  }

  return {
    destination,
    isComplete: true,
    isEligible: true,
    status: "eligible",
    productCategory: productCategory || null,
    normalizedProductCategoryCode,
    constraintKey: constraintInfo.key || "category",
    permittedCategoryValues: permittedValues,
    matchedConstraintValue: matchedConstraintVal,
    reason: `Product category ${catFullName ? `"${catFullName}" (${catId})` : catId} satisfies ${destination} constraint (${matchedConstraintVal}).`
  };
}

/**
 * Reads live PRODUCT metafieldDefinitions and paginates their constraint values
 * with cursor/loop/budget guards.
 * Organized from app/routes/app.meta-injector-api.jsx (fetchProductMetafieldDefinitionsWithConstraints).
 */
export async function readProductMetafieldDefinitionsWithConstraints(admin) {
  if (!admin || typeof admin.graphql !== "function") {
    return {
      defs: {},
      defsReadComplete: false,
      errors: ["Authenticated Shopify admin GraphQL client is required."],
      constraintErrorsByDestination: {}
    };
  }

  const defs = {};
  let defsReadComplete = true;
  const errors = [];
  const constraintErrorsByDestination = {};
  let defPageInfo = { hasNextPage: true, endCursor: null };
  let defPagesFetched = 0;
  const seenDefRequestedCursors = new Set();
  const seenDefReturnedCursors = new Set();

  try {
    while (defPageInfo.hasNextPage && defPagesFetched < MAX_DEF_PAGES) {
      const requestedDefCursor =
        typeof defPageInfo.endCursor === "string" && defPageInfo.endCursor.trim() !== ""
          ? defPageInfo.endCursor.trim()
          : null;

      if (defPagesFetched > 0) {
        if (!requestedDefCursor) {
          defsReadComplete = false;
          errors.push(
            `Metafield definitions pagination stopped after page ${defPagesFetched}: hasNextPage is true but endCursor is missing.`
          );
          break;
        }
        if (seenDefRequestedCursors.has(requestedDefCursor)) {
          defsReadComplete = false;
          errors.push(
            `Metafield definitions pagination stopped at page ${defPagesFetched}: repeated cursor "${requestedDefCursor}".`
          );
          break;
        }
        seenDefRequestedCursors.add(requestedDefCursor);
      }

      defPagesFetched++;

      const defRes = await admin.graphql(
        `
        query getProductMetafieldDefsWithConstraints($cursor: String) {
          metafieldDefinitions(first: 250, ownerType: PRODUCT, after: $cursor) {
            nodes {
              id
              name
              namespace
              key
              type { name }
              validations { name value }
              constraints {
                key
                values(first: 250) {
                  nodes { value }
                  pageInfo { hasNextPage endCursor }
                }
              }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      `,
        { variables: { cursor: requestedDefCursor } }
      );

      const defJson = await defRes.json();
      if (defJson.errors?.length) {
        throw new Error(defJson.errors.map((e) => e.message).join("; "));
      }

      const defConn = defJson?.data?.metafieldDefinitions;
      if (
        !defConn ||
        !Array.isArray(defConn.nodes) ||
        typeof defConn.pageInfo?.hasNextPage !== "boolean"
      ) {
        throw new Error("Malformed metafieldDefinitions connection response.");
      }

      for (const node of defConn.nodes) {
        if (!node || !node.namespace || !node.key) continue;
        const fullKey = `${node.namespace}.${node.key}`;
        const validation = Array.isArray(node.validations)
          ? node.validations.find((v) => v.name === "metaobject_definition_id")
          : null;

        let constraintKey = null;
        const constraintValues = [];
        const seenConstraintValues = new Set();
        let constraintsComplete = true;
        let constraintError = null;
        let constraintContinuation = null;

        const rawConstraints = node.constraints;
        if (rawConstraints !== null && rawConstraints !== undefined) {
          if (typeof rawConstraints !== "object" || Array.isArray(rawConstraints)) {
            constraintsComplete = false;
            constraintError = `Malformed constraints object on ${fullKey}.`;
            constraintErrorsByDestination[fullKey] = constraintError;
          } else {
            constraintKey = typeof rawConstraints.key === "string" ? rawConstraints.key : null;
            const valConn = rawConstraints.values;
            if (
              !valConn ||
              !Array.isArray(valConn.nodes) ||
              typeof valConn.pageInfo?.hasNextPage !== "boolean"
            ) {
              constraintsComplete = false;
              constraintError = `Malformed constraint values connection on ${fullKey}.`;
              constraintErrorsByDestination[fullKey] = constraintError;
            } else {
              for (const vNode of valConn.nodes) {
                if (typeof vNode?.value === "string" && vNode.value.trim() !== "") {
                  const trimmedVal = vNode.value.trim();
                  if (!seenConstraintValues.has(trimmedVal)) {
                    seenConstraintValues.add(trimmedVal);
                    constraintValues.push(trimmedVal);
                  }
                }
              }

              let cPageInfo = valConn.pageInfo;
              let cPagesFetched = 1;
              const seenRequestedCursors = new Set();
              const seenReturnedCursors = new Set();
              if (typeof cPageInfo.endCursor === "string" && cPageInfo.endCursor.trim() !== "") {
                seenReturnedCursors.add(cPageInfo.endCursor.trim());
              }

              while (cPageInfo.hasNextPage && cPagesFetched < MAX_CONSTRAINT_PAGES) {
                if (!node.id) {
                  constraintsComplete = false;
                  constraintContinuation = {
                    hasNextPage: true,
                    endCursor: cPageInfo.endCursor ?? null,
                    pagesFetched: cPagesFetched,
                    stopReason: "missing_definition_id"
                  };
                  constraintError = `Constraint value pagination stopped on ${fullKey}: missing definition ID at page ${cPagesFetched}.`;
                  constraintErrorsByDestination[fullKey] = constraintError;
                  break;
                }

                const requestedCursor =
                  typeof cPageInfo.endCursor === "string" ? cPageInfo.endCursor.trim() : "";
                if (!requestedCursor) {
                  constraintsComplete = false;
                  constraintContinuation = {
                    hasNextPage: true,
                    endCursor: cPageInfo.endCursor ?? null,
                    pagesFetched: cPagesFetched,
                    stopReason: "missing_end_cursor"
                  };
                  constraintError = `Constraint value pagination stopped on ${fullKey}: hasNextPage is true after page ${cPagesFetched}, but endCursor is missing or blank.`;
                  constraintErrorsByDestination[fullKey] = constraintError;
                  break;
                }

                if (seenRequestedCursors.has(requestedCursor)) {
                  constraintsComplete = false;
                  constraintContinuation = {
                    hasNextPage: true,
                    endCursor: requestedCursor,
                    pagesFetched: cPagesFetched,
                    stopReason: "repeated_requested_cursor"
                  };
                  constraintError = `Constraint value pagination stopped on ${fullKey}: cursor "${requestedCursor}" was already requested (page ${cPagesFetched}).`;
                  constraintErrorsByDestination[fullKey] = constraintError;
                  break;
                }

                seenRequestedCursors.add(requestedCursor);
                cPagesFetched++;

                try {
                  const moreRes = await admin.graphql(
                    `
                    query getMetafieldDefConstraintValues($id: ID!, $cursor: String!) {
                      metafieldDefinition(id: $id) {
                        id
                        constraints {
                          key
                          values(first: 250, after: $cursor) {
                            nodes { value }
                            pageInfo { hasNextPage endCursor }
                          }
                        }
                      }
                    }
                  `,
                    { variables: { id: node.id, cursor: requestedCursor } }
                  );

                  const moreJson = await moreRes.json();
                  if (moreJson.errors?.length) {
                    throw new Error(moreJson.errors.map((e) => e.message).join("; "));
                  }

                  const moreConn = moreJson?.data?.metafieldDefinition?.constraints?.values;
                  if (
                    !moreConn ||
                    !Array.isArray(moreConn.nodes) ||
                    typeof moreConn.pageInfo?.hasNextPage !== "boolean"
                  ) {
                    throw new Error(`Malformed paginated constraint values response for ${fullKey}.`);
                  }

                  let newUniqueValuesOnPage = 0;
                  for (const vNode of moreConn.nodes) {
                    if (typeof vNode?.value === "string" && vNode.value.trim() !== "") {
                      const trimmedVal = vNode.value.trim();
                      if (!seenConstraintValues.has(trimmedVal)) {
                        seenConstraintValues.add(trimmedVal);
                        constraintValues.push(trimmedVal);
                        newUniqueValuesOnPage++;
                      }
                    }
                  }

                  const nextPageInfo = moreConn.pageInfo;
                  const returnedCursor =
                    typeof nextPageInfo.endCursor === "string" ? nextPageInfo.endCursor.trim() : "";

                  if (nextPageInfo.hasNextPage) {
                    if (!returnedCursor) {
                      constraintsComplete = false;
                      constraintContinuation = {
                        hasNextPage: true,
                        requestedCursor,
                        endCursor: nextPageInfo.endCursor ?? null,
                        pagesFetched: cPagesFetched,
                        stopReason: "missing_returned_cursor"
                      };
                      constraintError = `Constraint value pagination stopped on ${fullKey}: page ${cPagesFetched} reported hasNextPage:true with a missing endCursor.`;
                      constraintErrorsByDestination[fullKey] = constraintError;
                      break;
                    }

                    if (
                      returnedCursor === requestedCursor ||
                      seenReturnedCursors.has(returnedCursor) ||
                      seenRequestedCursors.has(returnedCursor)
                    ) {
                      constraintsComplete = false;
                      constraintContinuation = {
                        hasNextPage: true,
                        requestedCursor,
                        endCursor: returnedCursor,
                        pagesFetched: cPagesFetched,
                        stopReason: "repeated_returned_cursor"
                      };
                      constraintError = `Constraint value pagination stopped on ${fullKey}: page ${cPagesFetched} returned repeated cursor "${returnedCursor}" while hasNextPage:true.`;
                      constraintErrorsByDestination[fullKey] = constraintError;
                      break;
                    }

                    if (newUniqueValuesOnPage === 0) {
                      constraintsComplete = false;
                      constraintContinuation = {
                        hasNextPage: true,
                        requestedCursor,
                        endCursor: returnedCursor,
                        pagesFetched: cPagesFetched,
                        stopReason: "no_new_values_with_has_next_page"
                      };
                      constraintError = `Constraint value pagination stopped on ${fullKey}: page ${cPagesFetched} returned hasNextPage:true (cursor "${returnedCursor}") but yielded zero new constraint values.`;
                      constraintErrorsByDestination[fullKey] = constraintError;
                      break;
                    }

                    seenReturnedCursors.add(returnedCursor);
                  }

                  cPageInfo = nextPageInfo;
                } catch (cErr) {
                  constraintsComplete = false;
                  constraintContinuation = {
                    hasNextPage: true,
                    requestedCursor,
                    endCursor: cPageInfo.endCursor ?? null,
                    pagesFetched: cPagesFetched,
                    stopReason: "query_error"
                  };
                  constraintError = `Constraint value pagination failed for ${fullKey} on page ${cPagesFetched}: ${cErr.message}`;
                  constraintErrorsByDestination[fullKey] = constraintError;
                  break;
                }
              }

              if (cPageInfo.hasNextPage && !constraintError) {
                constraintsComplete = false;
                constraintContinuation = {
                  hasNextPage: true,
                  endCursor: cPageInfo.endCursor ?? null,
                  pagesFetched: cPagesFetched,
                  stopReason: "max_pages_reached"
                };
                constraintError = `Constraint values pagination for ${fullKey} reached bounded limit (${MAX_CONSTRAINT_PAGES} pages; endCursor: ${cPageInfo.endCursor || "none"}).`;
                constraintErrorsByDestination[fullKey] = constraintError;
              }
            }
          }
        }

        const typeName =
          node.type && typeof node.type === "object" ? node.type.name : node.type;
        defs[fullKey] = {
          id: node.id || null,
          name: node.name || null,
          namespace: node.namespace,
          key: node.key,
          type: typeName || null,
          requiredDefinitionId: validation?.value || null,
          restrictedMetaobjectDefinitionId: validation?.value || null,
          validations: node.validations || [],
          constraints: {
            hasConstraints: Boolean(constraintKey !== null || constraintValues.length > 0),
            key: constraintKey,
            values: constraintValues,
            isComplete: constraintsComplete,
            continuation: constraintContinuation,
            error: constraintError
          }
        };
      }

      const nextDefPageInfo = defConn.pageInfo;
      const returnedDefCursor =
        typeof nextDefPageInfo.endCursor === "string" ? nextDefPageInfo.endCursor.trim() : "";

      if (nextDefPageInfo.hasNextPage) {
        if (!returnedDefCursor) {
          defsReadComplete = false;
          errors.push(
            `Metafield definitions pagination stopped on page ${defPagesFetched}: hasNextPage is true with a missing endCursor.`
          );
          break;
        }
        if (
          returnedDefCursor === requestedDefCursor ||
          seenDefReturnedCursors.has(returnedDefCursor) ||
          seenDefRequestedCursors.has(returnedDefCursor)
        ) {
          defsReadComplete = false;
          errors.push(
            `Metafield definitions pagination stopped on page ${defPagesFetched}: repeated cursor "${returnedDefCursor}" while hasNextPage:true.`
          );
          break;
        }
        seenDefReturnedCursors.add(returnedDefCursor);
      }

      defPageInfo = nextDefPageInfo;
    }

    if (defPageInfo.hasNextPage && defsReadComplete) {
      defsReadComplete = false;
      errors.push(
        `Metafield definitions pagination exceeded bounded limit (${MAX_DEF_PAGES} pages). endCursor: ${defPageInfo.endCursor}`
      );
    }
  } catch (err) {
    defsReadComplete = false;
    errors.push(`Failed reading live PRODUCT metafield definitions: ${err.message}`);
  }

  return {
    defs,
    defsReadComplete,
    errors,
    constraintErrorsByDestination
  };
}

/**
 * Paginates remaining connection edges (metafields, variants, or media) on a single
 * product with strict cursor-loop and page-budget guards.
 */
async function paginateProductConnection({
  admin,
  productGid,
  connectionName,
  initialEdges,
  initialPageInfo,
  maxPages,
  buildPageQuery,
  extractConnection
}) {
  const edges = Array.isArray(initialEdges) ? [...initialEdges] : [];
  let pageInfo =
    initialPageInfo && typeof initialPageInfo.hasNextPage === "boolean"
      ? {
          hasNextPage: initialPageInfo.hasNextPage,
          endCursor: initialPageInfo.endCursor ?? null
        }
      : { hasNextPage: true, endCursor: null };

  if (
    !initialPageInfo ||
    typeof initialPageInfo.hasNextPage !== "boolean" ||
    !Array.isArray(initialEdges)
  ) {
    return {
      edges,
      pageInfo,
      isComplete: false,
      error: `Initial ${connectionName} connection or pageInfo was missing or malformed.`
    };
  }

  let pagesFetched = 1;
  const seenRequestedCursors = new Set();
  const seenReturnedCursors = new Set();
  if (typeof pageInfo.endCursor === "string" && pageInfo.endCursor.trim() !== "") {
    seenReturnedCursors.add(pageInfo.endCursor.trim());
  }

  while (pageInfo.hasNextPage && pagesFetched < maxPages) {
    const requestedCursor =
      typeof pageInfo.endCursor === "string" ? pageInfo.endCursor.trim() : "";

    if (!requestedCursor) {
      return {
        edges,
        pageInfo: { hasNextPage: true, endCursor: pageInfo.endCursor ?? null },
        isComplete: false,
        error: `${connectionName} pagination stopped after page ${pagesFetched}: hasNextPage is true, but endCursor is missing or blank.`
      };
    }

    if (seenRequestedCursors.has(requestedCursor)) {
      return {
        edges,
        pageInfo: { hasNextPage: true, endCursor: requestedCursor },
        isComplete: false,
        error: `${connectionName} pagination stopped on page ${pagesFetched}: cursor "${requestedCursor}" was already requested.`
      };
    }

    seenRequestedCursors.add(requestedCursor);
    pagesFetched++;

    try {
      const res = await admin.graphql(buildPageQuery(), {
        variables: { id: productGid, cursor: requestedCursor }
      });
      const json = await res.json();
      if (json.errors?.length) {
        throw new Error(json.errors.map((e) => e.message).join("; "));
      }

      const conn = extractConnection(json);
      if (!conn || !Array.isArray(conn.edges) || typeof conn.pageInfo?.hasNextPage !== "boolean") {
        throw new Error(`Malformed paginated ${connectionName} response on page ${pagesFetched}.`);
      }

      edges.push(...conn.edges);

      const nextPageInfo = conn.pageInfo;
      const returnedCursor =
        typeof nextPageInfo.endCursor === "string" ? nextPageInfo.endCursor.trim() : "";

      if (nextPageInfo.hasNextPage) {
        if (!returnedCursor) {
          return {
            edges,
            pageInfo: { hasNextPage: true, endCursor: nextPageInfo.endCursor ?? null },
            isComplete: false,
            error: `${connectionName} pagination stopped on page ${pagesFetched}: hasNextPage is true with a missing endCursor.`
          };
        }

        if (
          returnedCursor === requestedCursor ||
          seenReturnedCursors.has(returnedCursor) ||
          seenRequestedCursors.has(returnedCursor)
        ) {
          return {
            edges,
            pageInfo: { hasNextPage: true, endCursor: returnedCursor },
            isComplete: false,
            error: `${connectionName} pagination stopped on page ${pagesFetched}: repeated cursor "${returnedCursor}" while hasNextPage:true.`
          };
        }

        if (conn.edges.length === 0) {
          return {
            edges,
            pageInfo: { hasNextPage: true, endCursor: returnedCursor },
            isComplete: false,
            error: `${connectionName} pagination stopped on page ${pagesFetched}: returned 0 edges while hasNextPage:true.`
          };
        }

        seenReturnedCursors.add(returnedCursor);
      }

      pageInfo = {
        hasNextPage: nextPageInfo.hasNextPage,
        endCursor: nextPageInfo.endCursor ?? null
      };
    } catch (err) {
      return {
        edges,
        pageInfo: { hasNextPage: true, endCursor: requestedCursor },
        isComplete: false,
        error: `${connectionName} pagination failed on page ${pagesFetched}: ${err.message}`
      };
    }
  }

  if (pageInfo.hasNextPage) {
    return {
      edges,
      pageInfo,
      isComplete: false,
      error: `${connectionName} pagination reached bounded limit (${maxPages} pages; endCursor: ${pageInfo.endCursor || "none"}).`
    };
  }

  return {
    edges,
    pageInfo,
    isComplete: true,
    error: null
  };
}

/**
 * Reads the complete single-product baseline and live PRODUCT metafield definitions
 * required by app/utils/bench-v2.contract.jsx.
 *
 * - Requires an authenticated admin client and one exact Product GID
 *   ("gid://shopify/Product/<digits>").
 * - Never seeds a repairPlan or proposal map.
 * - Preserves raw values and types verbatim without trimming or normalization.
 * - Reports explicit completeness flags (metafieldsReadComplete, defsReadComplete,
 *   variantsReadComplete, mediaReadComplete, productCategoryReadComplete) and
 *   per-destination constraint errors (constraintErrorsByDestination).
 */
export async function loadSingleProductBaselineSnapshot(admin, productId) {
  if (!admin || typeof admin.graphql !== "function") {
    return {
      success: false,
      error: "Authenticated Shopify admin GraphQL client is required.",
      baselineSnapshot: null
    };
  }

  if (!isExactProductGid(productId)) {
    return {
      success: false,
      error: `Invalid productId "${String(productId ?? "")}": exact Shopify Product GID (gid://shopify/Product/<id>) is required.`,
      baselineSnapshot: null
    };
  }

  let initialProductJson;
  try {
    const productRes = await admin.graphql(
      `
      query getSingleProductBaseline($id: ID!) {
        product(id: $id) {
          id
          title
          descriptionHtml
          seo {
            title
            description
          }
          category {
            id
            fullName
          }
          metafields(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
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
          variants(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
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
          media(first: 250) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                ... on MediaImage {
                  id
                  alt
                  preview {
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
      { variables: { id: productId } }
    );
    initialProductJson = await productRes.json();
    if (initialProductJson.errors?.length) {
      throw new Error(initialProductJson.errors.map((e) => e.message).join("; "));
    }
  } catch (err) {
    return {
      success: false,
      error: `Failed to query product baseline for ${productId}: ${err.message}`,
      baselineSnapshot: null
    };
  }

  const product = initialProductJson?.data?.product;
  if (!product || product.id !== productId) {
    return {
      success: false,
      error: `Product not found or ID mismatch for ${productId}.`,
      baselineSnapshot: null
    };
  }

  // 1. Paginate product metafields (with id, namespace, key, value, type)
  const mfPaginated = await paginateProductConnection({
    admin,
    productGid: productId,
    connectionName: "Product metafields",
    initialEdges: product.metafields?.edges,
    initialPageInfo: product.metafields?.pageInfo,
    maxPages: MAX_METAFIELD_PAGES,
    buildPageQuery: () => `
      query getMoreProductMetafields($id: ID!, $cursor: String!) {
        product(id: $id) {
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
    `,
    extractConnection: (json) => json?.data?.product?.metafields
  });

  const currentMetafields = {};
  const currentMetafieldTypes = {};
  const currentMetafieldIds = {};

  for (const edge of mfPaginated.edges) {
    const node = edge?.node;
    if (!node || typeof node.namespace !== "string" || typeof node.key !== "string") {
      continue;
    }
    const fullKey = `${node.namespace}.${node.key}`;
    currentMetafields[fullKey] = node.value;
    currentMetafieldTypes[fullKey] = typeof node.type === "string" ? node.type : null;
    currentMetafieldIds[fullKey] = node.id || null;
  }

  // 2. Paginate product variants
  const variantsPaginated = await paginateProductConnection({
    admin,
    productGid: productId,
    connectionName: "Product variants",
    initialEdges: product.variants?.edges,
    initialPageInfo: product.variants?.pageInfo,
    maxPages: MAX_VARIANT_PAGES,
    buildPageQuery: () => `
      query getMoreProductVariants($id: ID!, $cursor: String!) {
        product(id: $id) {
          variants(first: 250, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
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
        }
      }
    `,
    extractConnection: (json) => json?.data?.product?.variants
  });

  // 3. Paginate product media
  const mediaPaginated = await paginateProductConnection({
    admin,
    productGid: productId,
    connectionName: "Product media",
    initialEdges: product.media?.edges,
    initialPageInfo: product.media?.pageInfo,
    maxPages: MAX_MEDIA_PAGES,
    buildPageQuery: () => `
      query getMoreProductMedia($id: ID!, $cursor: String!) {
        product(id: $id) {
          media(first: 250, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                ... on MediaImage {
                  id
                  alt
                  preview {
                    image {
                      url
                    }
                  }
                }
              }
            }
          }
        }
      }
    `,
    extractConnection: (json) => json?.data?.product?.media
  });

  const uniqueVariants = Array.from(
    new Map(
      variantsPaginated.edges
        .filter((e) => e?.node?.id)
        .map((e) => [e.node.id, e])
    ).values()
  );

  const uniqueMedia = Array.from(
    new Map(
      mediaPaginated.edges
        .filter((e) => e?.node?.id)
        .map((e) => [e.node.id, e])
    ).values()
  );

  const hasProductCategoryField = Object.prototype.hasOwnProperty.call(product, "category");
  const productCategory =
    hasProductCategoryField && product.category
      ? {
          id: product.category.id || null,
          fullName: product.category.fullName || null
        }
      : null;
  const productCategoryReadComplete = hasProductCategoryField;

  // Verify native field presence without fabricating values
  const unverifiedNativeFields = [];
  const hasNativeTitle = typeof product.title === "string";
  const hasNativeDescriptionHtml = typeof product.descriptionHtml === "string";
  const hasNativeSeo =
    product.seo !== null &&
    product.seo !== undefined &&
    typeof product.seo === "object" &&
    !Array.isArray(product.seo) &&
    Object.prototype.hasOwnProperty.call(product.seo, "title") &&
    Object.prototype.hasOwnProperty.call(product.seo, "description");

  if (!hasNativeTitle) unverifiedNativeFields.push("productTitle");
  if (!hasNativeDescriptionHtml) unverifiedNativeFields.push("descriptionHtml");
  if (!hasNativeSeo) unverifiedNativeFields.push("seo");
  if (!variantsPaginated.isComplete) unverifiedNativeFields.push("variants");
  if (!mediaPaginated.isComplete) unverifiedNativeFields.push("media");

  const nativeLoadErrors = [variantsPaginated.error, mediaPaginated.error].filter(Boolean);
  const nativeIsComplete =
    unverifiedNativeFields.length === 0 && nativeLoadErrors.length === 0;

  // Expose single-variant price and shipping weight on nativeTargets only when
  // variant pagination completed unambiguously with exactly 1 variant.
  const hasUnambiguousSingleVariant =
    variantsPaginated.isComplete && uniqueVariants.length === 1;
  const primaryVariantNode = hasUnambiguousSingleVariant ? uniqueVariants[0].node : null;
  const primaryVariantPrice =
    primaryVariantNode && typeof primaryVariantNode.price === "string"
      ? primaryVariantNode.price
      : undefined;
  const primaryVariantWeightObj =
    primaryVariantNode?.inventoryItem?.measurement?.weight || null;
  const primaryVariantShippingWeight =
    primaryVariantWeightObj &&
    typeof primaryVariantWeightObj.value === "number" &&
    typeof primaryVariantWeightObj.unit === "string"
      ? {
          value: primaryVariantWeightObj.value,
          unit: primaryVariantWeightObj.unit
        }
      : undefined;

  const nativeTargets = {
    productId: product.id,
    productTitle: hasNativeTitle ? product.title : undefined,
    descriptionHtml: hasNativeDescriptionHtml ? product.descriptionHtml : undefined,
    seo: hasNativeSeo
      ? {
          title: product.seo.title,
          description: product.seo.description
        }
      : undefined,
    price: primaryVariantPrice,
    shippingWeight: primaryVariantShippingWeight,
    category: productCategory,
    isComplete: nativeIsComplete,
    loadError: nativeLoadErrors.length > 0 ? nativeLoadErrors.join(" | ") : null,
    unverifiedFields: unverifiedNativeFields,
    variants: {
      edges: uniqueVariants,
      pageInfo: variantsPaginated.pageInfo
    },
    media: {
      edges: uniqueMedia,
      pageInfo: mediaPaginated.pageInfo
    }
  };

  // 4. Read live PRODUCT metafield definitions + paginated constraint values
  const defReadResult = await readProductMetafieldDefinitionsWithConstraints(admin);

  // Merge any destination-level category/constraint ineligibility or incomplete
  // constraint errors for definitions that declare constraints.
  const constraintErrorsByDestination = {
    ...(defReadResult.constraintErrorsByDestination || {})
  };

  const categoryEligibilityByDestination = {};
  for (const [destKey, liveDef] of Object.entries(defReadResult.defs || {})) {
    const hasConstraints = Boolean(
      liveDef?.constraints &&
        (liveDef.constraints.hasConstraints ||
          liveDef.constraints.key ||
          (Array.isArray(liveDef.constraints.values) && liveDef.constraints.values.length > 0) ||
          liveDef.constraints.isComplete !== true ||
          liveDef.constraints.error)
    );
    if (destKey.startsWith("shopify.") || hasConstraints) {
      const elig = evaluateStandardizedCategoryEligibility({
        destination: destKey,
        liveDef,
        defsReadComplete: defReadResult.defsReadComplete,
        productCategory,
        productCategoryReadComplete
      });
      categoryEligibilityByDestination[destKey] = elig;
      if ((!elig.isComplete || !elig.isEligible) && !constraintErrorsByDestination[destKey]) {
        constraintErrorsByDestination[destKey] = elig.reason;
      }
    }
  }

  const allErrors = [
    mfPaginated.error,
    ...nativeLoadErrors,
    ...(defReadResult.errors || [])
  ].filter(Boolean);

  // Variant-level metafields are not queried by the product-level query;
  // variantMetafieldsReadComplete is explicitly false (never fabricated as complete).
  const baselineSnapshot = {
    productId: product.id,
    productTitle: hasNativeTitle ? product.title : "",
    productCategory,
    productCategoryReadComplete,
    nativeTargets,
    currentMetafields,
    currentMetafieldTypes,
    currentMetafieldIds,
    metafieldsReadComplete: mfPaginated.isComplete === true,
    metafieldsReadError: mfPaginated.error || null,
    variantsReadComplete: variantsPaginated.isComplete === true,
    mediaReadComplete: mediaPaginated.isComplete === true,
    currentVariantMetafields: null,
    currentVariantMetafieldTypes: null,
    variantMetafieldsReadComplete: false,
    liveDefinitions: defReadResult.defs,
    defsReadComplete: defReadResult.defsReadComplete === true,
    defReadErrors: defReadResult.errors || [],
    constraintErrorsByDestination,
    categoryEligibilityByDestination,
    errors: allErrors,
    loadedAt: new Date().toISOString()
  };

  return {
    success:
      baselineSnapshot.metafieldsReadComplete === true &&
      baselineSnapshot.defsReadComplete === true &&
      nativeIsComplete,
    error: allErrors.length > 0 ? allErrors.join(" | ") : null,
    baselineSnapshot
  };
}
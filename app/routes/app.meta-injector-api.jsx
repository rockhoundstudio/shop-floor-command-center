import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";
import { action as loaderAction } from "../utils/meta-injector.loader.jsx";
import { FIELD_CATALOG } from "../utils/meta-injector.constants.jsx";

// 🟢 Structural Engine — No Prisma Import Here

const ALLOWED_TAB3_KEYS = [
  "shopify_title", "piece_name", "stone_family", "price", "weight_grams", 
  "shipping_weight_oz", "is_ooak", "dimensions_mm", 
  "surface_finish", "primary_color", "color_pattern", "honest_flaws_and_character", 
  "jewelry_type", "wire_material",
  "primary_medium", "secondary_medium", "setting_ready", "bail_included", 
  "chain_material", "jewelry_finding_type", "mohs_hardness", "specific_gravity", 
  "crystal_system", "fracture_pattern", "cleavage", "luster", "diaphaneity", 
  "mineral_class", "geological_era", "rock_formation", "origin_location", 
  "origin_handle", "collection_name", "collection_location", "origin_story", 
  "seo_title", "alt_text", 
  "google_product_category", "authenticity", "rarity", "generated_description",
  
  // EXACT CUSTOM DESTINATIONS
  "is_one_of_a_kind", "origin_page_handle", "rescued_by", "character_marks",
  "treatment_status", "treated", "necklace_design", "chain_link_type",
  "rock_composition", "geological_age", "target_gender",
  "official_name", "stone_story", "cut_type", "secondary_colors",
  "tenacity", "age_group", "condition", "custom_product",
  "found_object", "collection_date",
  "custom.official_name", "custom.stone_story", "custom.cut_type", "custom.secondary_colors",
  "custom.tenacity", "custom.age_group", "custom.condition", "custom.custom_product",
  "custom.found_object", "custom.collection_date", "custom.wire_material", "custom.jewelry_type",

  // NATIVE CONTRACT TARGETS (ACCEPTED FOR ROUTING, EXCLUDED FROM CUSTOM NAMESPACE)
  "native_title", "native_shipping_weight", "native_image_alts", "native_seo_description",

  // STANDARDIZED TAXONOMY LIST
  "age-group", "chain-link-type", "color-pattern", "condition", "construction", "crystal-system", 
  "geological-era", "jewelry-finding-type", "jewelry-material", "jewelry-type", 
  "material", "material-origin", "mineral-class", "necklace-design", 
  "product-classification", "product-use", "rock-composition", "rock-formation", 
  "target-gender"
];

// Strictly enforce these specific keys reside only in the custom namespace
const STRICT_CUSTOM_KEYS = [
  "is_one_of_a_kind", "origin_page_handle", "rescued_by", "character_marks",
  "treatment_status", "treated", "necklace_design", "chain_link_type",
  "rock_composition", "geological_age", "target_gender",
  "official_name", "stone_story", "cut_type", "secondary_colors",
  "tenacity", "age_group", "condition", "custom_product",
  "found_object", "collection_date", "wire_material"
];

const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
  "custom.cut_and_shape", "custom.stone_shape", "custom.primary_use"
];

// Narrow, explicit reviewed destination type contracts (never generic fallbacks or inferred mappings)
const REVIEWED_EXACT_DESTINATION_TYPE_CONTRACTS = Object.freeze({
  "custom.rock_composition": "single_line_text_field",
  "custom.crystal_system": "single_line_text_field",
  "custom.mineral_class": "single_line_text_field",
  "custom.rock_formation": "single_line_text_field",
  "custom.geological_era": "single_line_text_field",
  "custom.is_one_of_a_kind": "single_line_text_field",
  "custom.collection_date": "single_line_text_field",
  "custom.cut_type": "single_line_text_field",
  "custom.secondary_colors": "single_line_text_field",
  "custom.wire_material": "single_line_text_field",
  "custom.jewelry_type": "single_line_text_field",
  "custom.seo_title": "single_line_text_field",
  "custom.chain_material": "single_line_text_field",
  "custom.chain_link_type": "single_line_text_field",
  "custom.jewelry_finding_type": "single_line_text_field",
  "custom.google_product_category": "single_line_text_field"
});

const MASTER_TYPE_MAP = {
  rescued_by: "single_line_text_field", origin_location: "single_line_text_field", geological_age: "single_line_text_field",
  mohs_hardness: "single_line_text_field", official_name: "single_line_text_field", luster: "single_line_text_field",
  specific_gravity: "single_line_text_field", fracture_pattern: "single_line_text_field", cleavage: "single_line_text_field",
  tenacity: "single_line_text_field", primary_color: "single_line_text_field", diaphaneity: "single_line_text_field",
  character_marks: "single_line_text_field", dimensions_mm: "single_line_text_field", cut_type: "single_line_text_field",
  surface_finish: "single_line_text_field", treatment_status: "single_line_text_field", secondary_colors: "single_line_text_field",
  base_stone_type: "single_line_text_field", hardness: "single_line_text_field", primary_medium: "single_line_text_field",
  piece_name: "single_line_text_field", stone_family: "single_line_text_field", collection_name: "single_line_text_field",
  collection_location: "single_line_text_field", origin_handle: "single_line_text_field", origin_page_handle: "single_line_text_field",
  alt_text: "single_line_text_field", is_ooak: "single_line_text_field", is_one_of_a_kind: "single_line_text_field",
  found_object: "single_line_text_field", collection_date: "single_line_text_field", wire_material: "single_line_text_field",
  custom_product: "single_line_text_field", setting_ready: "single_line_text_field", bail_included: "single_line_text_field",
  chain_material: "single_line_text_field", seo_title: "single_line_text_field", secondary_medium: "single_line_text_field",
  treated: "single_line_text_field", weight_grams: "number_decimal", shipping_weight_oz: "number_decimal", price: "number_decimal",
  origin_story: "multi_line_text_field", honest_flaws: "single_line_text_field", honest_flaws_and_character: "multi_line_text_field",
  generated_description: "multi_line_text_field", color_pattern: "list.metaobject_reference", "color-pattern": "list.metaobject_reference",
  material: "metaobject_reference", jewelry_material: "metaobject_reference", "jewelry-material": "metaobject_reference",
  age_group: "metaobject_reference", "age-group": "metaobject_reference", jewelry_type: "single_line_text_field",
  "jewelry-type": "metaobject_reference", target_gender: "metaobject_reference", "target-gender": "metaobject_reference",
  necklace_design: "metaobject_reference", "necklace-design": "metaobject_reference", authenticity: "metaobject_reference",
  rarity: "metaobject_reference", condition: "metaobject_reference", crystal_system: "metaobject_reference",
  "crystal-system": "metaobject_reference", mineral_class: "metaobject_reference", "mineral-class": "metaobject_reference",
  geological_era: "metaobject_reference", "geological-era": "metaobject_reference", rock_composition: "metaobject_reference",
  "rock-composition": "metaobject_reference", rock_formation: "metaobject_reference", "rock-formation": "metaobject_reference",
  chain_link_type: "metaobject_reference", "chain-link-type": "metaobject_reference", jewelry_finding_type: "metaobject_reference",
  "jewelry-finding-type": "metaobject_reference", google_product_category: "single_line_text_field",
  
  // Standardized taxonomy explicit mappings to avoid fallback to single_line_text_field
  "construction": "metaobject_reference",
  "material-origin": "metaobject_reference",
  "product-classification": "metaobject_reference",
  "product-use": "metaobject_reference"
};

const EXPLICIT_METAOBJECT_KEYS = [
  "material", "color-pattern", "color_pattern", "jewelry-material", "jewelry_material",
  "target-gender", "age-group", "age_group", "condition", "rarity", 
  "authenticity", "jewelry-type", "necklace-design", "necklace_design", 
  "crystal-system", "geological-era", "geological_era", 
  "mineral-class", "mineral_class", "rock-composition", "rock_composition", 
  "rock-formation", "rock_formation", "chain-link-type", "chain_link_type",
  "jewelry-finding-type", "jewelry_finding_type", "construction", "material-origin",
  "product-classification", "product-use"
];

const ALLOWED_STANDARDIZED_CANDIDATE_KEYS = [
  "chain-link-type",
  "construction",
  "jewelry-finding-type",
  "material-origin",
  "product-classification",
  "product-use"
];

const ALL_STANDARDIZED_META_KEYS = Array.from(
  new Set(
    FIELD_CATALOG
      .filter(f => f.role === "standardized_attribute" || f.namespace === "shopify")
      .map(f => f.metaKey || f.key)
  )
);

const CATALOG_STANDARDIZED_META_KEYS = new Set(ALL_STANDARDIZED_META_KEYS);

const CATALOG_METAFIELD_DESTINATIONS = Array.from(
  new Set(
    FIELD_CATALOG
      .filter(f => {
        if (!f || f.owner === "native" || f.namespace === "native" || f.key.startsWith("native_")) return false;
        if (f.key === "shopify_title" || f.key === "price") return false;
        if (RETIRED_KEYS.includes(f.key)) return false;
        return true;
      })
      .map(f => {
        const ns = f.namespace || f.metaConfig?.namespace || "custom";
        const mk = f.metaKey || f.key;
        return `${ns}.${mk}`;
      })
  )
);

const CATALOG_READ_ONLY_DESTINATIONS = new Set(
  FIELD_CATALOG
    .filter(f => f.mappingStatus === "pending_read_only" || f.key === "is_ooak")
    .map(f => {
      const ns = f.namespace || f.metaConfig?.namespace || "custom";
      const mk = f.metaKey || f.key;
      return `${ns}.${mk}`;
    })
);

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

function isPlainTextProposalRejectedForContract(rawVal, normalizedStr) {
  if (typeof rawVal !== "string") return true;
  const trimmed = String(normalizedStr ?? "").trim();
  if (!trimmed) return true;
  if (trimmed === "[object Object]") return true;
  if (/^gid:\/\//i.test(trimmed) || /gid:\/\/shopify\//i.test(trimmed)) return true;
  if (/^shopify:\/\/metaobject/i.test(trimmed)) return true;
  if (/^metaobject[:/]/i.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null) return true;
    } catch (e) {
      return true;
    }
  }
  return false;
}

function normalizeCandidateMatchKey(str) {
  return String(str || "").trim().toLowerCase();
}

function extractEntryMatchingLabels(node) {
  const rawSet = new Set();
  if (typeof node?.displayName === "string" && node.displayName.trim() !== "") {
    rawSet.add(node.displayName.trim());
  }
  if (Array.isArray(node?.fields)) {
    for (const f of node.fields) {
      if (!f || typeof f.key !== "string" || typeof f.value !== "string") continue;
      const k = f.key.trim().toLowerCase();
      const v = f.value.trim();
      if (!v) continue;
      if (k === "label" || k === "name" || k === "title" || k === "display_name") {
        if (!/^gid:\/\//i.test(v)) {
          rawSet.add(v);
        }
      }
    }
  }
  return Array.from(rawSet);
}

function extractTaxonomyReference(node) {
  if (!Array.isArray(node?.fields)) return null;
  for (const f of node.fields) {
    if (!f || typeof f.key !== "string") continue;
    if (f.key.trim().toLowerCase() === "taxonomy_reference") {
      return f.value ?? null;
    }
  }
  return null;
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

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function normalizeMetafieldValue(key, value) {
  let val = String(value).replace(/^⚠️\s*/, "");
  return val;
}

function sanitizeDescription(html) {
  if (!html || typeof html !== "string") return html;
  let safeHtml = html;
  const targets = ["/pages/the-shopped-rock", "/collections/the-shopped-rock", "/pages/the-shocked-rock", "/collections/the-shocked-rock"];
  for (const target of targets) {
    const regexNormal = new RegExp(`<a[^>]*href=["']?[^"'>]*${target.replace(/\//g, '\\/')}["']?[^>]*>.*?<\\/a>`, 'gi');
    safeHtml = safeHtml.replace(regexNormal, "");
    const regexEscaped = new RegExp(`&lt;a[^&]*href=[&quot;']?[^&quot;'>]*${target.replace(/\//g, '\\/')}[&quot;']?[^&]*&gt;.*?&lt;\\/a&gt;`, 'gi');
    safeHtml = safeHtml.replace(regexEscaped, "");
  }
  return safeHtml;
}

function normalizeTaxonomyCategoryCode(rawVal) {
  if (typeof rawVal !== "string") return "";
  const trimmed = rawVal.trim();
  if (!trimmed) return "";
  const gidPrefix = "gid://shopify/TaxonomyCategory/";
  if (trimmed.startsWith(gidPrefix)) {
    return trimmed.slice(gidPrefix.length).trim();
  }
  return trimmed;
}

function doesCategoryMatchConstraintValue(productCategoryId, constraintValue) {
  const prodCode = normalizeTaxonomyCategoryCode(productCategoryId);
  const consCode = normalizeTaxonomyCategoryCode(constraintValue);
  if (!prodCode || !consCode) return false;
  if (prodCode === consCode) return true;
  if (prodCode.startsWith(`${consCode}-`)) return true;
  return false;
}

async function fetchProductMetafieldDefinitionsWithConstraints(admin) {
  const defs = {};
  let defsReadComplete = true;
  const errors = [];
  const constraintErrorsByDestination = {};
  let defPageInfo = { hasNextPage: true, endCursor: null };
  let defPagesFetched = 0;
  const MAX_DEF_PAGES = 10;
  const MAX_CONSTRAINT_PAGES = 20;

  try {
    while (defPageInfo.hasNextPage && defPagesFetched < MAX_DEF_PAGES) {
      defPagesFetched++;
      const defRes = await admin.graphql(`
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
      `, { variables: { cursor: defPageInfo.endCursor } });

      const defJson = await defRes.json();
      if (defJson.errors?.length) {
        throw new Error(defJson.errors.map(e => e.message).join("; "));
      }

      const defConn = defJson?.data?.metafieldDefinitions;
      if (!defConn || !Array.isArray(defConn.nodes) || typeof defConn.pageInfo?.hasNextPage !== "boolean") {
        throw new Error("Malformed metafieldDefinitions connection response.");
      }

      for (const node of defConn.nodes) {
        if (!node || !node.namespace || !node.key) continue;
        const fullKey = `${node.namespace}.${node.key}`;
        const validation = Array.isArray(node.validations)
          ? node.validations.find(v => v.name === "metaobject_definition_id")
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
            if (!valConn || !Array.isArray(valConn.nodes) || typeof valConn.pageInfo?.hasNextPage !== "boolean") {
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

                const requestedCursor = typeof cPageInfo.endCursor === "string" ? cPageInfo.endCursor.trim() : "";
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
                  const moreRes = await admin.graphql(`
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
                  `, { variables: { id: node.id, cursor: requestedCursor } });

                  const moreJson = await moreRes.json();
                  if (moreJson.errors?.length) {
                    throw new Error(moreJson.errors.map(e => e.message).join("; "));
                  }

                  const moreConn = moreJson?.data?.metafieldDefinition?.constraints?.values;
                  if (!moreConn || !Array.isArray(moreConn.nodes) || typeof moreConn.pageInfo?.hasNextPage !== "boolean") {
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
                  const returnedCursor = typeof nextPageInfo.endCursor === "string" ? nextPageInfo.endCursor.trim() : "";

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

                    if (returnedCursor === requestedCursor || seenReturnedCursors.has(returnedCursor) || seenRequestedCursors.has(returnedCursor)) {
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

        const typeName = node.type && typeof node.type === "object" ? node.type.name : node.type;
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

      defPageInfo = defConn.pageInfo;
    }

    if (defPageInfo.hasNextPage) {
      defsReadComplete = false;
      errors.push(`Metafield definitions pagination exceeded bounded limit (${MAX_DEF_PAGES} pages). endCursor: ${defPageInfo.endCursor}`);
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

function evaluateStandardizedCategoryEligibility({
  destination,
  liveDef,
  defsReadComplete,
  productCategory,
  productCategoryReadComplete
}) {
  const catId = productCategory?.id || null;
  const catFullName = productCategory?.fullName || null;
  const normalizedProductCategoryCode = normalizeTaxonomyCategoryCode(catId);

  if (!defsReadComplete || !productCategoryReadComplete) {
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
  const hasCategoryConstraint = Boolean(constraintInfo.hasConstraints || constraintInfo.key || permittedValues.length > 0);

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

  const matchedConstraintVal = permittedValues.find(val => doesCategoryMatchConstraintValue(catId, val)) || null;

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

function parseIndexedMutationFieldIndex(fieldProp, rootFieldName) {
  if (Array.isArray(fieldProp)) {
    const rootIdx = fieldProp.findIndex(part => String(part) === rootFieldName);
    if (rootIdx !== -1 && fieldProp.length > rootIdx + 1) {
      const parsed = Number.parseInt(String(fieldProp[rootIdx + 1]), 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
    if (fieldProp.length >= 2 && String(fieldProp[0]) === "input") {
      const parsed = Number.parseInt(String(fieldProp[1]), 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
  } else if (typeof fieldProp === "string") {
    const trimmed = fieldProp.trim();
    const regex = new RegExp(`(?:^|\\.|\\[)${rootFieldName}(?:\\.|\\[)(\\d+)(?:\\]|\\.|$)`);
    const match = trimmed.match(regex);
    if (match && match[1] !== undefined) {
      const parsed = Number.parseInt(match[1], 10);
      if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

function attachChunkDestinationToUserErrors(userErrors, chunkItems, rootFieldName = "metafields") {
  if (!Array.isArray(userErrors)) return [];
  return userErrors.map(err => {
    if (!err || typeof err !== "object") return err;
    const idx = parseIndexedMutationFieldIndex(err.field, rootFieldName);
    const targetItem = idx !== null && Array.isArray(chunkItems) ? chunkItems[idx] : null;
    if (targetItem && targetItem.namespace && targetItem.key) {
      const destination = `${targetItem.namespace}.${targetItem.key}`;
      return {
        ...err,
        destination,
        namespace: targetItem.namespace,
        key: targetItem.key
      };
    }
    return { ...err };
  });
}

export const action = async ({ request }) => {
  let matchingContext = null;
  try {
    const unconsumedRequestClone = request.clone();
    const { admin } = await authenticate.admin(request);
    const body = await request.formData();
    const intent = body.get("intent");

    if (intent === "loadProductData") {
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

      // Explicit namespace + metaKey routing from shared catalog (all 21 shopify.* and active custom.* kept distinct)
      CATALOG_METAFIELD_DESTINATIONS.forEach(destKey => {
          const val = currentMetafields[destKey] ?? "";
          canonicalFields[destKey] = val;
          if (!CATALOG_READ_ONLY_DESTINATIONS.has(destKey)) {
              repairPlan[destKey] = val;
          }
      });

      // Preserve non-contract stored values in canonicalFields for inspection/compatibility without seeding executable proposals
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

      // Removed mapping is_one_of_a_kind -> is_ooak per requirement
      const LEGACY_MAP_LOCAL = {
        "custom.crystal-system": "shopify.crystal-system",
        "custom.mineral-class": "shopify.mineral-class",
        "custom.rock-composition": "shopify.rock-composition",
        "custom.geological-era": "shopify.geological-era",
        "custom.rock-formation": "shopify.rock-formation",
        "custom.necklace-design": "shopify.necklace-design"
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

    if (intent === "resolveStandardizedCandidates") {
      const rawPieceId = body.get("pieceId");
      const rawCandidates = body.get("standardized_candidates");
      const rawRequestId = body.get("requestId");
      const pieceId = typeof rawPieceId === "string" ? rawPieceId.trim() : "";
      const requestId = typeof rawRequestId === "string" && rawRequestId.trim() !== "" ? rawRequestId.trim() : null;

      matchingContext = {
        intent: "resolveStandardizedCandidates",
        pieceId: pieceId || null,
        requestId,
        readOnly: true
      };

      if (!pieceId || !/^gid:\/\/shopify\/Product\/\d+$/.test(pieceId)) {
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

      if (rawCandidates === null || rawCandidates === undefined || String(rawCandidates).trim() === "") {
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

      let parsedCandidates;
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

      const inputValidationErrors = [];
      const validatedCandidateEntries = {};

      for (const [key, val] of Object.entries(parsedCandidates)) {
        if (!ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(key)) {
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

      // 1. Read exact product's category and current assignments (paginated metafield read)
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

      // 2. Read live PRODUCT metafield definitions + paginated constraints
      // Separation of concerns:
      // - defsReadComplete tracks top-level metafieldDefinitions enumeration completeness
      // - each definition's constraints.isComplete tracks that specific definition's constraint-values completeness
      const defReadResult = await fetchProductMetafieldDefinitionsWithConstraints(admin);
      const liveDefs = defReadResult.defs;
      const defsReadComplete = defReadResult.defsReadComplete;
      if (!defsReadComplete) {
        overallComplete = false;
      }
      if (defReadResult.errors.length > 0) {
        topErrors.push(...defReadResult.errors);
      }

      // Evaluate category applicability for all 21 standardized destinations.
      // An incomplete constraint read on an unrelated read-only field stays explicitly incomplete for THAT field
      // without poisoning overallComplete for the six candidate resolutions.
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
        if (!elig.isComplete && !ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(stdMetaKey)) {
          nonCandidateConstraintDiagnostics[dest] = elig.reason;
        }
      }

      // Cache for resolved metaobject definitions and their enumerated entries
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

      for (const attrKey of ALLOWED_STANDARDIZED_CANDIDATE_KEYS) {
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
        if (!candidateInput) {
          continue;
        }

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
          for (const lbl of candidateInput.labels) {
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
          for (const lbl of candidateInput.labels) {
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
          for (const lbl of candidateInput.labels) {
            labelResults.push({
              label: lbl,
              status: "blocked",
              matches: [],
              error: `Wrong live type: "${liveDef.type || "none"}" (requires "list.metaobject_reference").`
            });
          }
        } else if (
          !liveDef.restrictedMetaobjectDefinitionId ||
          !/^gid:\/\/shopify\/MetaobjectDefinition\/\d+$/.test(liveDef.restrictedMetaobjectDefinitionId)
        ) {
          fieldStatus = "blocked";
          entryMatchStatus = "blocked";
          fieldComplete = true;
          fieldErrors.push(`Missing or invalid metaobject_definition_id restriction on ${destination}.`);
          for (const lbl of candidateInput.labels) {
            labelResults.push({
              label: lbl,
              status: "blocked",
              matches: [],
              error: `Missing or invalid metaobject_definition_id restriction on ${destination}.`
            });
          }
        } else {
          // Perform entry matching distinctly from category eligibility so candidate evidence and entry matches remain visible
          const enumState = await resolveAndEnumerateMetaobjectDef(liveDef.restrictedMetaobjectDefinitionId);
          resolvedMetaobjectDefinition = enumState.definition;
          enumeratedEntries = enumState.entries;
          continuation = enumState.continuation || catElig.continuation || null;

          if (!enumState.definition) {
            fieldStatus = "blocked";
            entryMatchStatus = "blocked";
            fieldComplete = true;
            fieldErrors.push(enumState.error || `Restricted metaobject definition ${liveDef.restrictedMetaobjectDefinitionId} could not be resolved.`);
            for (const lbl of candidateInput.labels) {
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

            for (const lbl of candidateInput.labels) {
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
            for (const lbl of candidateInput.labels) {
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

            // Category eligibility gate: an exact reference match is not sufficient to unlock saving.
            // Fail closed on incomplete candidate constraint reads.
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

        // Preserve per-field errors on resolutions[destination].errors so ineligible/errored fields remain blocked,
        // while keeping topErrors strictly for candidate read/enumeration failures so eligible candidate fields can unlock.
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
          candidate: {
            labels: candidateInput.labels,
            evidence: candidateInput.evidence
          },
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

    if (intent === "executeRepairPlan") {
      const pieceId = body.get("pieceId");
      const rawPlan = body.get("repairPlan");
      const rawLegacy = body.get("legacyKeysToRemove");
      const rawNativeChanges = body.get("nativeChanges");
      
      if (!pieceId || !rawPlan) {
        return Response.json({ intent: "executeRepairPlan", success: false, status: "REPAIR_FAILED", message: "Missing pieceId or repairPlan payload." });
      }

      const repairPlan = JSON.parse(rawPlan);
      const legacyKeysToRemove = rawLegacy ? JSON.parse(rawLegacy) : [];
      const nativeChanges = rawNativeChanges ? JSON.parse(rawNativeChanges) : {};
      
      const productGid = pieceId.startsWith("gid://") ? pieceId : `gid://shopify/Product/${pieceId.split("/").pop()}`;

      let lookupData = null;
      let productLookupComplete = false;
      try {
        const lookupResponse = await admin.graphql(`
          query getProductAndMetafields($id: ID!) {
            product(id: $id) { 
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
              metafields(first: 250) { edges { node { namespace key value type id } } } 
            }
          }
        `, { variables: { id: productGid } });
        lookupData = await lookupResponse.json();
        if (!lookupData?.errors?.length && lookupData?.data?.product) {
          productLookupComplete = true;
        }
      } catch (lookupErr) {
        productLookupComplete = false;
      }

      const productNode = lookupData?.data?.product || null;
      const productCategory = productNode?.category
        ? { id: productNode.category.id || null, fullName: productNode.category.fullName || null }
        : null;
      const currentNativeTitle = productNode?.title || "";
      const currentNativeBodyHtml = productNode?.descriptionHtml || "";
      const currentNativeSeoTitle = productNode?.seo?.title || "";
      const currentNativeSeoDescription = productNode?.seo?.description || "";
      const currentMetaList = productNode?.metafields?.edges || [];
      
      const currentMetafields = {};
      const currentMetafieldsTypes = {};
      currentMetaList.forEach(e => { 
        const fullKey = `${e.node.namespace}.${e.node.key}`;
        currentMetafields[fullKey] = e.node.value;
        currentMetafieldsTypes[fullKey] = e.node.type; 
      });

      // Fetch dynamic definitions + paginated constraints for true types and live category eligibility
      const defReadResult = await fetchProductMetafieldDefinitionsWithConstraints(admin);
      const defs = defReadResult.defs;
      const defsReadComplete = defReadResult.defsReadComplete;

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
      let doNativeUpdate = false;

      let doPriceUpdate = false;
      let priceVariantGid = null;
      let newPriceString = null;
      let priceReadBackVerified = false;
      
      // Native Changes Integration
      let nativeTitleUpdated = false;
      if (nativeChanges.title !== undefined) {
         if (nativeChanges.title !== currentNativeTitle) {
             nativeInput.title = nativeChanges.title;
             doNativeUpdate = true;
             nativeTitleUpdated = true;
             proposedChanges["native_title"] = { from: currentNativeTitle, to: nativeChanges.title };
             attemptedDestinations.push("native_title");
         } else {
             unchanged.push("native_title");
         }
      }

      let nativeSeoDescriptionUpdated = false;
      if (nativeChanges.seoDescription !== undefined) {
         const seoDescStr = String(nativeChanges.seoDescription ?? "").trim();
         if (seoDescStr !== "") {
            if (seoDescStr.length > 160) {
               blockedFields["native_seo_description"] = "SEO description exceeds 160 characters limit.";
            } else if (seoDescStr !== currentNativeSeoDescription) {
               nativeInput.seo = nativeInput.seo || {};
               nativeInput.seo.description = seoDescStr;
               doNativeUpdate = true;
               nativeSeoDescriptionUpdated = true;
               proposedChanges["native_seo_description"] = { from: currentNativeSeoDescription, to: seoDescStr };
               attemptedDestinations.push("native_seo_description");
            } else {
               unchanged.push("native_seo_description");
            }
         }
      }
      
      // We must handle shipping weight via inventoryItem mutation, not productUpdate
      let doShippingWeightUpdate = false;
      let shippingWeightInput = null;
      
      if (nativeChanges.shippingWeight) {
         const sw = nativeChanges.shippingWeight;
         const valStr = String(sw.value !== null && sw.value !== undefined ? sw.value : "").trim();
         
         if (valStr !== "") {
            const parsedNum = parseFloat(valStr);
            if (isNaN(parsedNum) || parsedNum < 0) {
               blockedFields["native_shipping_weight"] = "Shipping weight must be a positive number.";
            } else if (!sw.variantId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(sw.variantId)) {
               blockedFields["native_shipping_weight"] = "Missing or invalid variant ID for shipping weight.";
            } else if (sw.unit !== "OUNCES") {
               blockedFields["native_shipping_weight"] = "Shipping weight unit must be exactly 'OUNCES'.";
            } else {
               try {
                  const invRes = await admin.graphql(`
                     query getInventoryItem($id: ID!) {
                        productVariant(id: $id) {
                           inventoryItem { id measurement { weight { value unit } } }
                        }
                     }
                  `, { variables: { id: sw.variantId }});
                  const invJson = await invRes.json();
                  const invItem = invJson.data?.productVariant?.inventoryItem;
                  
                  if (!invItem) {
                     blockedFields["native_shipping_weight"] = "Failed to resolve inventory item for variant.";
                  } else {
                     const currentWeight = invItem.measurement?.weight?.value;
                     const currentUnit = invItem.measurement?.weight?.unit;
                     
                     if (parseFloat(currentWeight) !== parsedNum || currentUnit !== sw.unit) {
                        doShippingWeightUpdate = true;
                        shippingWeightInput = {
                           id: invItem.id,
                           measurement: { weight: { value: parsedNum, unit: sw.unit } }
                        };
                        proposedChanges["native_shipping_weight"] = { 
                           from: `${currentWeight} ${currentUnit}`, 
                           to: `${parsedNum} ${sw.unit}` 
                        };
                        attemptedDestinations.push("native_shipping_weight");
                     } else {
                        unchanged.push("native_shipping_weight");
                     }
                  }
               } catch (e) {
                  blockedFields["native_shipping_weight"] = "Failed to fetch inventory item details.";
               }
            }
         }
      }
      
      // Image Alt Text Native Updates
      let doImageAltUpdates = false;
      const imageAltInputs = [];
      
      if (nativeChanges.imageAlts && Array.isArray(nativeChanges.imageAlts)) {
         const currentMedia = lookupData?.data?.product?.media?.edges || [];
         
         for (const imgReq of nativeChanges.imageAlts) {
            if (!imgReq.imageId || !/^gid:\/\/shopify\/MediaImage\/\d+$/.test(imgReq.imageId)) {
               blockedFields[`native_image_alts_${imgReq.imageId || 'unknown'}`] = "Invalid image ID.";
               continue;
            }
            
            const match = currentMedia.find(m => m.node.id === imgReq.imageId);
            if (!match) {
               blockedFields[`native_image_alts_${imgReq.imageId}`] = "Image ID not found on this product.";
               continue;
            }
            
            if (match.node.alt !== imgReq.altText) {
               doImageAltUpdates = true;
               imageAltInputs.push({
                  id: imgReq.imageId,
                  alt: imgReq.altText || ""
               });
               proposedChanges[`native_image_alts_${imgReq.imageId}`] = { from: match.node.alt, to: imgReq.altText };
               attemptedDestinations.push(`native_image_alts_${imgReq.imageId}`);
            } else {
               unchanged.push(`native_image_alts_${imgReq.imageId}`);
            }
         }
      }

      // Shared Metaobject Validation Cache
      const moValidationCache = new Map();
      
      for (const [fullKey, val] of Object.entries(repairPlan)) {
        if (fullKey === "shopify_title") {
           if (!nativeTitleUpdated && nativeChanges.title === undefined) {
               skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_seo_description") {
           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!nativeSeoDescriptionUpdated && nativeChanges.seoDescription === undefined && valStr !== "") {
              if (valStr.length > 160) {
                 blockedFields["native_seo_description"] = "SEO description exceeds 160 characters limit.";
              } else if (valStr !== currentNativeSeoDescription) {
                 nativeInput.seo = nativeInput.seo || {};
                 nativeInput.seo.description = valStr;
                 doNativeUpdate = true;
                 nativeSeoDescriptionUpdated = true;
                 proposedChanges["native_seo_description"] = { from: currentNativeSeoDescription, to: valStr };
                 attemptedDestinations.push("native_seo_description");
              } else {
                 unchanged.push("native_seo_description");
              }
           } else if (!nativeSeoDescriptionUpdated) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "price") {
           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (valStr === "") continue;

           const validPrice = /^(0|[1-9]\d*)(\.\d{1,2})?$/;
           if (!validPrice.test(valStr)) {
               blockedFields["price"] = "Malformed price: must be a non-negative number with up to two decimals.";
               continue;
           }

           const variantsConn = lookupData?.data?.product?.variants;
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

           if (!targetVariantId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(targetVariantId)) {
               blockedFields["price"] = "Invalid variant ID retrieved.";
               continue;
           }
           if (typeof currentPriceStr !== "string") {
               blockedFields["price"] = "Missing current price data from Shopify.";
               continue;
           }

           const getCents = (str) => {
               const parts = (str || "0").split(".");
               const dollars = parts[0];
               const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
               return BigInt(dollars + cents);
           };

           if (getCents(valStr) !== getCents(currentPriceStr)) {
               doPriceUpdate = true;
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

        // 🟢 RETIREMENT GUARD
        if (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey) || RETIRED_KEYS.includes(canonicalDestinationKey)) {
            skippedKeys.push(fullKey);
            continue;
        }

        // 🟢 SINGLE CANONICAL OOAK & IDENTITY COMPANION WRITE GUARD
        // Retain legacy reads without dual writes: custom.is_one_of_a_kind, custom.material, and custom.origin_page_handle are the sole editable targets.
        if (ns === "custom" && (key === "is_ooak" || key === "stone_family" || key === "primary_medium" || key === "origin_handle")) {
            skippedKeys.push(fullKey);
            continue;
        }

        // 🟢 STRICT NAMESPACE ENFORCEMENT FOR CUSTOM KEYS
        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            continue;
        }

        // 🟢 STRICT NAMESPACE & SIX-FIELD GATE FOR STANDARDIZED KEYS
        if (ns === "shopify" && !CATALOG_STANDARDIZED_META_KEYS.has(key)) {
            unsupportedKeys.push(fullKey);
            continue;
        }
        if (key === "construction" && ns !== "shopify") {
            unsupportedKeys.push(fullKey);
            continue;
        }

        // 🟢 STRICT ALLOWLIST ENFORCEMENT
        if (!ALLOWED_TAB3_KEYS.includes(key) && !ALLOWED_TAB3_KEYS.includes(fullKey) && !ALLOWED_TAB3_KEYS.includes(canonicalDestinationKey)) {
            unsupportedKeys.push(fullKey);
            continue;
        }

        const currentVal = currentMetafields[fullKey] !== undefined
          ? currentMetafields[fullKey]
          : (currentMetafields[canonicalDestinationKey] || null);
        const valStr = String(val !== null && val !== undefined ? val : "").trim();

        // Preserve six-field standardized write gate: non-verified shopify.* attributes remain read-only
        if (ns === "shopify" && !ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(key)) {
            if (!currentVal && valStr === "") {
                unchanged.push(fullKey);
            } else if (currentVal === valStr) {
                unchanged.push(fullKey);
            } else {
                blockedFields[fullKey] = "Standardized attribute read-only (pending_read_only).";
            }
            continue;
        }
        
        // Blank strings and N/A collection_date placeholders must not implicitly delete or publish as dates.
        if (valStr === "" || (ns === "custom" && key === "collection_date" && /^(n\/a|none|unknown)$/i.test(valStr))) {
            if (!currentVal) unchanged.push(fullKey);
            else skippedKeys.push(fullKey);
            continue; 
        }

        // Resolve exact type from definition, stored type, or reviewed exact destination contract
        const def = defs[fullKey] || defs[canonicalDestinationKey];
        const storedType = currentMetafieldsTypes[fullKey] || currentMetafieldsTypes[canonicalDestinationKey];
        const reviewedContractType = Object.prototype.hasOwnProperty.call(
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

        let resolvedType = def?.type ? def.type : (storedType || reviewedContractType || null);

        if (!resolvedType) {
            blockedFields[fullKey] = "No exact live definition or stored type available; fallback mappings are strictly forbidden.";
            continue;
        }

        // Live category / owner-subtype constraint preflight check for standardized destinations
        if (ns === "shopify" || (def?.constraints && (def.constraints.hasConstraints || !def.constraints.isComplete))) {
            const catElig = evaluateStandardizedCategoryEligibility({
                destination: fullKey,
                liveDef: def,
                defsReadComplete,
                productCategory,
                productCategoryReadComplete: productLookupComplete
            });
            if (!catElig.isComplete || !catElig.isEligible) {
                blockedFields[fullKey] = catElig.reason;
                continue;
            }
        }

        let resolvedValue = normalizeMetafieldValue(key, valStr);

        if (reviewedContractType === "single_line_text_field") {
            if (isPlainTextProposalRejectedForContract(val, resolvedValue)) {
                blockedFields[fullKey] = `Rejected non-text or reference-shaped proposal for plain-text destination ${canonicalDestinationKey}.`;
                continue;
            }
        }

        if (key === "generated_description") {
            resolvedValue = sanitizeDescription(resolvedValue);
            if (currentNativeBodyHtml !== resolvedValue) {
                nativeInput.descriptionHtml = resolvedValue;
                doNativeUpdate = true;
                proposedChanges["native_description"] = { from: currentNativeBodyHtml, to: resolvedValue };
                attemptedDestinations.push("native_description");
            } else {
                unchanged.push("native_description");
            }
        }
        
        if (key === "seo_title") {
            if (currentNativeSeoTitle !== resolvedValue) {
                nativeInput.seo = nativeInput.seo || {};
                nativeInput.seo.title = resolvedValue;
                doNativeUpdate = true;
                proposedChanges["native_seo_title"] = { from: currentNativeSeoTitle, to: resolvedValue };
                attemptedDestinations.push("native_seo_title");
            } else {
                unchanged.push("native_seo_title");
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
          
          if (resolvedType.includes("list.")) {
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

          // Strict Structural Metaobject Validation
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
            setToShopify.push({ ownerId: productGid, namespace: ns, key: key, type: resolvedType, value: resolvedValue });
            proposedChanges[fullKey] = { from: currentVal, to: resolvedValue };
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

        // 🟢 RETIREMENT GUARD
        if (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey) || RETIRED_KEYS.includes(canonicalDestinationKey)) {
            skippedKeys.push(fullKey);
            return;
        }

        // 🟢 STRICT NAMESPACE ENFORCEMENT
        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            return;
        }

        // 🟢 STRICT ALLOWLIST ENFORCEMENT FOR DELETES
        if (!ALLOWED_TAB3_KEYS.includes(key) && !ALLOWED_TAB3_KEYS.includes(fullKey) && !ALLOWED_TAB3_KEYS.includes(canonicalDestinationKey)) {
            unsupportedKeys.push(fullKey);
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

      if (attemptedDestinations.length === 0) {
          const hasIntendedThatFailed = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;
          if (hasIntendedThatFailed) {
              return Response.json({
                  intent: "executeRepairPlan", pieceId, success: false, status: "REPAIR_BLOCKED",
                  message: "No changes executed. Some requested changes were blocked or unsupported.",
                  fieldsUpdated: 0, legacyKeysRemoved: 0,
                  currentMetafields, repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
                  variantTarget: priceVariantGid || null
              });
          }
          return Response.json({
              intent: "executeRepairPlan", pieceId, success: true, status: "NO_CHANGES_REQUIRED",
              fieldsUpdated: 0, legacyKeysRemoved: 0, message: "No intended changes required.",
              currentMetafields, repairPlan, proposedChanges, conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: true,
              variantTarget: priceVariantGid || null
          });
      }

      const allErrors = [];

      if (deleteFromShopify.length > 0) {
        const uniqueDel = new Map();
        deleteFromShopify.forEach(m => uniqueDel.set(`${m.namespace}:${m.key}`, m));
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
        setToShopify.forEach(m => uniqueSet.set(`${m.namespace}:${m.key}`, m));
        const chunks = chunkArray(Array.from(uniqueSet.values()), 25);
        for (let i = 0; i < chunks.length; i++) {
          try {
            const setResponse = await admin.graphql(
              `#graphql
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) { userErrors { field message } }
              }`,
              { variables: { metafields: chunks[i] } }
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
            allErrors.push(...nativeJson.data.productUpdate.userErrors);
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
            allErrors.push(...bulkData.userErrors);
          } else if (!bulkData?.productVariants || !bulkData.productVariants.some(v => v.id === priceVariantGid)) {
            allErrors.push({ message: "Price update accepted by API but variant was not returned in success payload." });
          } else {
            priceWriteSucceeded = true;
          }
        } catch (priceErr) {
          allErrors.push({ message: `API Error on Price Update: ${priceErr.message}` });
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
               allErrors.push(...swData.userErrors);
            } else {
               shippingWeightSucceeded = true;
            }
         } catch (swErr) {
            allErrors.push({ message: `API Error on Shipping Weight Update: ${swErr.message}` });
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
             errors: allErrors, currentMetafields, repairPlan, proposedChanges, fieldsUpdated: 0, legacyKeysRemoved: 0,
             conflicts: {}, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified: false, message: "Shopify write produced unhandled errors.",
             variantTarget: priceVariantGid || null
         });
      }

      await new Promise(r => setTimeout(r, 600)); 
      
      let readBackVariantId = null;
      if (doPriceUpdate) readBackVariantId = priceVariantGid;
      if (doShippingWeightUpdate && nativeChanges.shippingWeight?.variantId) readBackVariantId = nativeChanges.shippingWeight.variantId;
      
      const readBackQuery = `
        query getProductAndVariant($id: ID!${readBackVariantId ? ', $variantId: ID!' : ''}) {
          product(id: $id) { 
            title 
            descriptionHtml 
            seo { title description }
            category { id fullName }
            media(first: 50) { edges { node { ... on MediaImage { id alt } } } }
            metafields(first: 250) { edges { node { namespace key value } } } 
          }
          ${readBackVariantId ? `
          node(id: $variantId) {
            ... on ProductVariant { 
               id 
               price 
               product { id } 
               inventoryItem { measurement { weight { value unit } } }
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
      const hasProductReadBack = Boolean(readBackProductNode && !readBackError);

      const hasTitleReadBack = hasProductReadBack && typeof readBackProductNode.title === "string";
      const hasBodyReadBack = hasProductReadBack && typeof readBackProductNode.descriptionHtml === "string";
      const hasSeoReadBack = hasProductReadBack && readBackProductNode.seo !== null && typeof readBackProductNode.seo === "object";
      const hasMediaReadBack = hasProductReadBack && Array.isArray(readBackProductNode.media?.edges);
      const hasMetafieldsReadBack = hasProductReadBack && Array.isArray(readBackProductNode.metafields?.edges);

      const actualTitle = hasTitleReadBack ? readBackProductNode.title : undefined;
      const actualBodyHtml = hasBodyReadBack ? readBackProductNode.descriptionHtml : undefined;
      const actualSeoTitle = hasSeoReadBack && typeof readBackProductNode.seo.title === "string" ? readBackProductNode.seo.title : undefined;
      const actualSeoDescription = hasSeoReadBack && typeof readBackProductNode.seo.description === "string" ? readBackProductNode.seo.description : undefined;
      const actualMedia = hasMediaReadBack
        ? readBackProductNode.media.edges.filter(e => e && e.node && e.node.id)
        : [];

      const newMetaList = hasMetafieldsReadBack ? readBackProductNode.metafields.edges : [];
      const newMetafields = {};
      newMetaList.forEach(e => {
        if (e?.node?.namespace && e?.node?.key) {
          newMetafields[`${e.node.namespace}.${e.node.key}`] = e.node.value;
        }
      });

      const unverifiedNativeFields = [];
      if (!hasTitleReadBack) unverifiedNativeFields.push("productTitle");
      if (!hasBodyReadBack) unverifiedNativeFields.push("descriptionHtml");
      if (!hasSeoReadBack) unverifiedNativeFields.push("seo");
      if (!hasMediaReadBack) unverifiedNativeFields.push("media");

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

      let readBackVerified = Boolean(hasProductReadBack && hasMetafieldsReadBack);
      const conflicts = {};

      if (doPriceUpdate) {
         if (!priceWriteSucceeded) {
             readBackVerified = false;
             unresolvedChanges["price"] = { reason: "API mutation failed", expected: newPriceString, actual: "Unchanged" };
         } else {
             const variantNode = readBackData?.data?.node;
             if (!variantNode || variantNode.id !== priceVariantGid || typeof variantNode.price !== "string") {
                 readBackVerified = false;
                 unresolvedChanges["price"] = { reason: "Missing, detached, or malformed variant node", expected: newPriceString, actual: "Unknown" };
                 conflicts["price"] = { expected: newPriceString, actual: "Missing, detached, or malformed variant node" };
             } else {
                 const getCents = (str) => {
                     const parts = (str || "0").split(".");
                     const dollars = parts[0];
                     const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
                     return BigInt(dollars + cents);
                 };
                 if (getCents(variantNode.price) !== getCents(newPriceString)) {
                     readBackVerified = false;
                     unresolvedChanges["price"] = { reason: "Read-back mismatch", expected: newPriceString, actual: variantNode.price };
                     conflicts["price"] = { expected: newPriceString, actual: variantNode.price };
                 } else {
                     priceReadBackVerified = true;
                     verifiedDestinations.push("price");
                 }
             }
         }
      }

      if (doNativeUpdate) {
          if (!nativeWriteSucceeded) {
              readBackVerified = false;
              if (nativeInput.descriptionHtml !== undefined) unresolvedChanges["native_description"] = { reason: "API mutation failed", expected: nativeInput.descriptionHtml, actual: "Unchanged" };
              if (nativeInput.seo?.title !== undefined) unresolvedChanges["native_seo_title"] = { reason: "API mutation failed", expected: nativeInput.seo.title, actual: "Unchanged" };
              if (nativeInput.seo?.description !== undefined) unresolvedChanges["native_seo_description"] = { reason: "API mutation failed", expected: nativeInput.seo.description, actual: "Unchanged" };
              if (nativeInput.title !== undefined) unresolvedChanges["native_title"] = { reason: "API mutation failed", expected: nativeInput.title, actual: "Unchanged" };
          } else {
              if (nativeInput.descriptionHtml !== undefined) {
                 if (!hasBodyReadBack) {
                     readBackVerified = false;
                     unresolvedChanges["native_description"] = { reason: "Unverified native read-back (descriptionHtml missing)", expected: nativeInput.descriptionHtml, actual: "Unverified" };
                     conflicts["native_description"] = { expected: nativeInput.descriptionHtml, actual: "Unverified (missing from read-back)" };
                 } else if (nativeInput.descriptionHtml !== actualBodyHtml) {
                     readBackVerified = false;
                     unresolvedChanges["native_description"] = { reason: "Read-back mismatch", expected: nativeInput.descriptionHtml, actual: actualBodyHtml };
                     conflicts["native_description"] = { expected: nativeInput.descriptionHtml, actual: actualBodyHtml };
                 } else {
                     verifiedDestinations.push("native_description");
                 }
              }
              if (nativeInput.seo?.title !== undefined) {
                 if (actualSeoTitle === undefined) {
                     readBackVerified = false;
                     unresolvedChanges["native_seo_title"] = { reason: "Unverified native read-back (seo.title missing)", expected: nativeInput.seo.title, actual: "Unverified" };
                     conflicts["native_seo_title"] = { expected: nativeInput.seo.title, actual: "Unverified (missing from read-back)" };
                 } else if (nativeInput.seo.title !== actualSeoTitle) {
                     readBackVerified = false;
                     unresolvedChanges["native_seo_title"] = { reason: "Read-back mismatch", expected: nativeInput.seo.title, actual: actualSeoTitle };
                     conflicts["native_seo_title"] = { expected: nativeInput.seo.title, actual: actualSeoTitle };
                 } else {
                     verifiedDestinations.push("native_seo_title");
                 }
              }
              if (nativeInput.seo?.description !== undefined) {
                 if (actualSeoDescription === undefined) {
                     readBackVerified = false;
                     unresolvedChanges["native_seo_description"] = { reason: "Unverified native read-back (seo.description missing)", expected: nativeInput.seo.description, actual: "Unverified" };
                     conflicts["native_seo_description"] = { expected: nativeInput.seo.description, actual: "Unverified (missing from read-back)" };
                 } else if (nativeInput.seo.description !== actualSeoDescription) {
                     readBackVerified = false;
                     unresolvedChanges["native_seo_description"] = { reason: "Read-back mismatch", expected: nativeInput.seo.description, actual: actualSeoDescription };
                     conflicts["native_seo_description"] = { expected: nativeInput.seo.description, actual: actualSeoDescription };
                 } else {
                     verifiedDestinations.push("native_seo_description");
                 }
              }
              if (nativeInput.title !== undefined) {
                 if (!hasTitleReadBack) {
                     readBackVerified = false;
                     unresolvedChanges["native_title"] = { reason: "Unverified native read-back (title missing)", expected: nativeInput.title, actual: "Unverified" };
                     conflicts["native_title"] = { expected: nativeInput.title, actual: "Unverified (missing from read-back)" };
                 } else if (nativeInput.title !== actualTitle) {
                     readBackVerified = false;
                     unresolvedChanges["native_title"] = { reason: "Read-back mismatch", expected: nativeInput.title, actual: actualTitle };
                     conflicts["native_title"] = { expected: nativeInput.title, actual: actualTitle };
                 } else {
                     verifiedDestinations.push("native_title");
                 }
              }
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
         if (!hasMetafieldsReadBack) {
             readBackVerified = false;
             unresolvedChanges[dotKey] = { reason: "Unverified metafield read-back", expected: String(m.value).trim(), actual: "Unverified" };
             conflicts[dotKey] = { expected: String(m.value).trim(), actual: "Unverified (missing from read-back)" };
             return;
         }
         const actual = newMetafields[dotKey];
         let expStr = String(m.value).trim();
         let actStr = String(actual !== undefined && actual !== null ? actual : "").trim();
         
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
      const verifiedNativeSeoDescCount = verifiedDestinations.includes("native_seo_description") ? 1 : 0;
      const verifiedShippingWeightCount = verifiedDestinations.includes("native_shipping_weight") ? 1 : 0;
      const totalFieldsUpdated = verifiedSetCount + (priceReadBackVerified ? 1 : 0) + verifiedNativeTitleCount + verifiedNativeSeoDescCount + verifiedShippingWeightCount + verifiedImageAltCount;

      const hasUnresolved = Object.keys(unresolvedChanges).length > 0;
      const hasExcluded = Object.keys(blockedFields).length > 0 || unsupportedKeys.length > 0;
      
      let finalStatus = "REPAIRED";
      let finalSuccess = true;

      if (hasUnresolved || hasExcluded) {
          finalStatus = "PARTIAL_SUCCESS";
          if (hasUnresolved) finalSuccess = false;
      }

      const diagnosticMsg = finalStatus === "PARTIAL_SUCCESS" 
          ? `Partial execution: ${verifiedDestinations.length} verified. ${Object.keys(unresolvedChanges).length} unresolved, ${Object.keys(blockedFields).length} blocked, ${unsupportedKeys.length} unsupported.` 
          : `Repair successful: ${verifiedDestinations.length} verified destinations.`;

      return Response.json({ 
        intent: "executeRepairPlan", pieceId, success: finalSuccess, status: finalStatus,
        fieldsUpdated: totalFieldsUpdated, legacyKeysRemoved: deleteFromShopify.length,
        message: diagnosticMsg,
        currentMetafields: hasMetafieldsReadBack ? newMetafields : currentMetafields,
        nativeTargets: readBackNativeTargets,
        productCategory: readBackNativeTargets.category || productCategory,
        repairPlan, proposedChanges, conflicts, blockedFields, skippedKeys, unsupportedKeys, unchanged, attemptedDestinations, verifiedDestinations, unresolvedChanges, missingFields: [], unknownFields: [], readBackVerified,
        variantTarget: priceVariantGid || null
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
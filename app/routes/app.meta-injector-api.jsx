import { authenticate } from "../shopify.server";
import { executeAutofill } from "../utils/meta-injector.autofill.server.jsx";
import { action as loaderAction } from "../utils/meta-injector.loader.jsx";
import { FIELD_CATALOG } from "../utils/meta-injector.constants.jsx";
import { ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS } from "../utils/meta-injector.standardized.jsx";
import {
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS,
  BENCH_V2_OPT_IN_UNHELD_BARE_KEYS,
  BENCH_V2_CONNECTED_VARIANT_DESTINATIONS as BENCH_V2_OPT_IN_VARIANT_DESTINATIONS,
  isExactProductGid,
  isExactProductVariantGid
} from "../utils/bench-v2.contract.jsx";
import {
  normalizeTaxonomyCategoryCode,
  doesCategoryMatchConstraintValue,
  evaluateStandardizedCategoryEligibility,
  readProductMetafieldDefinitionsWithConstraints as fetchProductMetafieldDefinitionsWithConstraints,
  readVariantMetafieldDefinitionsWithConstraints as fetchVariantMetafieldDefinitionsWithConstraints,
  paginateOwnerMetafieldsConnection,
  readSingleVariantMetafields as fetchSingleVariantMetafieldsForWriter
} from "../utils/bench-v2.baseline.server.jsx";

export {
  BENCH_V2_WRITER_OPT_IN_FIELD,
  BENCH_V2_WRITER_OPT_IN_VALUE,
  BENCH_V2_OPT_IN_VARIANT_DESTINATIONS
};

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
  "native_seo_title", "native_description",

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
  "custom.tenacity": "single_line_text_field",
  "custom.color_pattern": "single_line_text_field",
  "custom.wire_material": "single_line_text_field",
  "custom.jewelry_type": "single_line_text_field",
  "custom.seo_title": "single_line_text_field",
  "custom.chain_material": "single_line_text_field",
  "custom.chain_link_type": "single_line_text_field",
  "custom.jewelry_finding_type": "single_line_text_field",
  "custom.google_product_category": "single_line_text_field"
});

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

const RAW_TEXT_ELEMENTS = new Set(["script", "style", "textarea", "title", "xmp"]);

function normalizeBareAmpersandsInOrdinaryText(textSegment) {
  return textSegment.replace(/&(?!(?:[a-zA-Z][a-zA-Z0-9]*|#\d+|#[xX][0-9a-fA-F]+);)/g, "&amp;");
}

function canonicalizeDescriptionHtmlForReadBack(html) {
  if (typeof html !== "string") return null;
  let out = "";
  let i = 0;
  const len = html.length;
  let rawTextTag = null;

  while (i < len) {
    if (rawTextTag !== null) {
      const rest = html.slice(i);
      const closeRe = new RegExp(`^<\\/${rawTextTag}(?=[\\t\\n\\f\\r />])`, "i");
      const m = closeRe.exec(rest);
      if (m) {
        let j = i + m[0].length;
        while (j < len && html[j] !== ">") {
          if (html[j] === "<" || html[j] === '"' || html[j] === "'") return null;
          j++;
        }
        if (j >= len) return null;
        out += html.slice(i, j + 1);
        rawTextTag = null;
        i = j + 1;
        continue;
      }
      const nextLt = html.indexOf("<", i + 1);
      if (nextLt === -1) {
        out += html.slice(i);
        break;
      }
      out += html.slice(i, nextLt);
      i = nextLt;
      continue;
    }

    const lt = html.indexOf("<", i);
    if (lt === -1) {
      out += normalizeBareAmpersandsInOrdinaryText(html.slice(i));
      break;
    }

    if (lt > i) {
      out += normalizeBareAmpersandsInOrdinaryText(html.slice(i, lt));
      i = lt;
    }

    if (html.startsWith("<!--", i)) {
      const endComment = html.indexOf("-->", i + 4);
      if (endComment === -1) return null;
      out += html.slice(i, endComment + 3);
      i = endComment + 3;
      continue;
    }

    if (html.startsWith("<![CDATA[", i)) {
      const endCdata = html.indexOf("]]>", i + 9);
      if (endCdata === -1) return null;
      out += html.slice(i, endCdata + 3);
      i = endCdata + 3;
      continue;
    }

    if (/^<![a-zA-Z]/.test(html.slice(i, i + 3)) || html.startsWith("<?", i)) {
      let j = i + 2;
      let quote = null;
      while (j < len) {
        const ch = html[j];
        if (quote) {
          if (ch === quote) quote = null;
        } else {
          if (ch === '"' || ch === "'") quote = ch;
          else if (ch === ">") break;
        }
        j++;
      }
      if (j >= len) return null;
      out += html.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    const tagMatch = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)(?=[\t\n\f\r />])/.exec(html.slice(i));
    if (!tagMatch) {
      return null;
    }

    const isClosing = tagMatch[1] === "/";
    const tagNameLower = tagMatch[2].toLowerCase();
    let j = i + tagMatch[0].length;
    let quote = null;
    while (j < len) {
      const ch = html[j];
      if (quote) {
        if (ch === quote) quote = null;
      } else {
        if (ch === '"' || ch === "'") quote = ch;
        else if (ch === "<") return null;
        else if (ch === ">") break;
      }
      j++;
    }
    if (j >= len) return null;

    const fullTag = html.slice(i, j + 1);
    const isSelfClosing = !isClosing && /\/\s*>$/.test(fullTag);
    out += fullTag;
    i = j + 1;

    if (!isClosing && !isSelfClosing && RAW_TEXT_ELEMENTS.has(tagNameLower)) {
      rawTextTag = tagNameLower;
    }
  }

  if (rawTextTag !== null) return null;
  return out;
}

function areDescriptionHtmlEquivalentOnReadBack(expectedHtml, actualHtml) {
  if (typeof expectedHtml !== "string" || typeof actualHtml !== "string") return false;
  if (expectedHtml === actualHtml) return true;
  const canonExpected = canonicalizeDescriptionHtmlForReadBack(expectedHtml);
  if (canonExpected === null) return false;
  const canonActual = canonicalizeDescriptionHtmlForReadBack(actualHtml);
  if (canonActual === null) return false;
  return canonExpected === canonActual;
}

/**
 * Evaluates explicit live definition validations on a plain-text proposal
 * (such as choices, max, min, regex) when present on the live definition.
 */
function validateAgainstLiveTextDefinitionValidations(liveDef, exactValue, destinationKey) {
  if (!liveDef || !Array.isArray(liveDef.validations) || liveDef.validations.length === 0) {
    return { valid: true, reason: null };
  }
  for (const v of liveDef.validations) {
    if (!v || typeof v.name !== "string") continue;
    const vName = v.name.trim().toLowerCase();
    const vRaw = v.value !== undefined && v.value !== null ? String(v.value) : "";

    if (vName === "choices" && vRaw.trim() !== "") {
      try {
        const parsedChoices = JSON.parse(vRaw);
        if (Array.isArray(parsedChoices) && parsedChoices.length > 0) {
          const strChoices = parsedChoices.map((c) => String(c));
          if (!strChoices.includes(exactValue)) {
            return {
              valid: false,
              reason: `Value "${exactValue}" is not in allowed definition choices [${strChoices.join(", ")}] for ${destinationKey}.`
            };
          }
        }
      } catch {
        // Ignore non-JSON choice representation
      }
    } else if (vName === "max" && vRaw.trim() !== "") {
      const maxLen = Number.parseInt(vRaw.trim(), 10);
      if (Number.isInteger(maxLen) && maxLen > 0 && exactValue.length > maxLen) {
        return {
          valid: false,
          reason: `Value for ${destinationKey} (${exactValue.length} chars) exceeds live definition max length (${maxLen}).`
        };
      }
    } else if (vName === "min" && vRaw.trim() !== "") {
      const minLen = Number.parseInt(vRaw.trim(), 10);
      if (Number.isInteger(minLen) && minLen > 0 && exactValue.length < minLen) {
        return {
          valid: false,
          reason: `Value for ${destinationKey} (${exactValue.length} chars) is shorter than live definition min length (${minLen}).`
        };
      }
    } else if (vName === "regex" && vRaw !== "") {
      try {
        const re = new RegExp(vRaw);
        if (!re.test(exactValue)) {
          return {
            valid: false,
            reason: `Value for ${destinationKey} does not match live definition regex validation.`
          };
        }
      } catch {
        // Ignore invalid regex syntax
      }
    }
  }
  return { valid: true, reason: null };
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
        ownerId: targetItem.ownerId || null,
        namespace: targetItem.namespace,
        key: targetItem.key
      };
    }
    return { ...err };
  });
}

function attachNativeDestinationToUserErrors(userErrors, nativeInput) {
  if (!Array.isArray(userErrors)) return [];
  const attemptedNativeKeys = [];
  if (nativeInput?.title !== undefined) attemptedNativeKeys.push("native_title");
  if (nativeInput?.descriptionHtml !== undefined) attemptedNativeKeys.push("native_description");
  if (nativeInput?.seo?.title !== undefined) attemptedNativeKeys.push("native_seo_title");
  if (nativeInput?.seo?.description !== undefined) attemptedNativeKeys.push("native_seo_description");

  return userErrors.map(err => {
    if (!err || typeof err !== "object") return err;
    if (err.destination) return { ...err };
    const pathStr = Array.isArray(err.field)
      ? err.field.map(p => String(p)).join(".")
      : (typeof err.field === "string" ? err.field : "");

    let destination = null;
    if (/(?:^|\.)seo\.title(?:$|\.)/i.test(pathStr)) {
      destination = "native_seo_title";
    } else if (/(?:^|\.)seo\.description(?:$|\.)/i.test(pathStr)) {
      destination = "native_seo_description";
    } else if (/(?:^|\.)descriptionHtml(?:$|\.)/i.test(pathStr)) {
      destination = "native_description";
    } else if (/(?:^|\.)title(?:$|\.)/i.test(pathStr) && !/seo/i.test(pathStr)) {
      destination = "native_title";
    } else if (attemptedNativeKeys.length === 1) {
      destination = attemptedNativeKeys[0];
    }

    return destination ? { ...err, destination } : { ...err };
  });
}

function parsePriceToCentsBigInt(str) {
  const parts = (str || "0").split(".");
  const dollars = parts[0];
  const cents = (parts[1] || "00").padEnd(2, "0").slice(0, 2);
  return BigInt(dollars + cents);
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

      CATALOG_METAFIELD_DESTINATIONS.forEach(destKey => {
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
        if (!elig.isComplete && !ALLOWED_STANDARDIZED_CANDIDATE_KEYS.includes(stdMetaKey)) {
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
      let doNativeUpdate = false;

      let doPriceUpdate = false;
      let priceVariantGid = null;
      let newPriceString = null;
      let priceReadBackVerified = false;
      let attemptedVariantMetafieldWrite = false;

      // Native Changes Integration (Decoupled from custom.* metafields)
      let nativeTitleUpdated = false;
      if (nativeChanges.title !== undefined) {
        const titleStr = String(nativeChanges.title ?? "").trim();
        if (!hasNativeTitleBaseline) {
          blockedFields["native_title"] = "Native product title baseline could not be loaded from Shopify; reload product data before saving.";
        } else if (titleStr === "") {
          blockedFields["native_title"] = "Native product title cannot be empty.";
        } else if (titleStr.length > 255) {
          blockedFields["native_title"] = "Native product title exceeds 255 characters limit.";
        } else if (titleStr !== currentNativeTitle) {
          nativeInput.title = titleStr;
          doNativeUpdate = true;
          nativeTitleUpdated = true;
          proposedChanges["native_title"] = { from: currentNativeTitle, to: titleStr };
          attemptedDestinations.push("native_title");
        } else {
          unchanged.push("native_title");
        }
      }

      let nativeDescriptionUpdated = false;
      const evaluateAndStageNativeDescription = (rawDescStr, allowEmptyBlock) => {
        const sanitizedDescStr = sanitizeDescription(rawDescStr);
        if (!hasNativeBodyBaseline) {
          blockedFields["native_description"] = "Native product description baseline could not be loaded from Shopify; reload product data before saving.";
        } else if (allowEmptyBlock && rawDescStr === "") {
          blockedFields["native_description"] = "Native product description cannot be empty.";
        } else if (sanitizedDescStr !== rawDescStr) {
          blockedFields["native_description"] = "Native product description contains disallowed anchor links that alter approved content; remove disallowed links and re-approve before saving.";
        } else if (sanitizedDescStr.length > 10000) {
          blockedFields["native_description"] = "Native product description exceeds 10,000 characters limit.";
        } else if (sanitizedDescStr !== currentNativeBodyHtml) {
          nativeInput.descriptionHtml = sanitizedDescStr;
          doNativeUpdate = true;
          nativeDescriptionUpdated = true;
          proposedChanges["native_description"] = { from: currentNativeBodyHtml, to: sanitizedDescStr };
          attemptedDestinations.push("native_description");
        } else {
          unchanged.push("native_description");
        }
      };

      if (nativeChanges.description !== undefined) {
        evaluateAndStageNativeDescription(String(nativeChanges.description ?? "").trim(), true);
      }

      let nativeSeoTitleUpdated = false;
      const evaluateAndStageNativeSeoTitle = (rawSeoTitleStr, allowEmptyBlock) => {
        const normalizedSeoTitleStr = normalizeMetafieldValue("seo_title", rawSeoTitleStr).trim();
        if (!hasNativeSeoTitleBaseline) {
          blockedFields["native_seo_title"] = "Native SEO title baseline could not be loaded from Shopify; reload product data before saving.";
        } else if (allowEmptyBlock && normalizedSeoTitleStr === "") {
          blockedFields["native_seo_title"] = "Native SEO title cannot be empty.";
        } else if (normalizedSeoTitleStr !== rawSeoTitleStr) {
          blockedFields["native_seo_title"] = "Native SEO title contains warning prefixes that alter approved content; edit and re-approve before saving.";
        } else if (normalizedSeoTitleStr.length > 70) {
          blockedFields["native_seo_title"] = "Native SEO title exceeds 70 characters limit.";
        } else if (normalizedSeoTitleStr !== currentNativeSeoTitle) {
          nativeInput.seo = nativeInput.seo || {};
          nativeInput.seo.title = normalizedSeoTitleStr;
          doNativeUpdate = true;
          nativeSeoTitleUpdated = true;
          proposedChanges["native_seo_title"] = { from: currentNativeSeoTitle, to: normalizedSeoTitleStr };
          attemptedDestinations.push("native_seo_title");
        } else {
          unchanged.push("native_seo_title");
        }
      };

      if (nativeChanges.seoTitle !== undefined) {
        evaluateAndStageNativeSeoTitle(String(nativeChanges.seoTitle ?? "").trim(), true);
      }

      let nativeSeoDescriptionUpdated = false;
      const evaluateAndStageNativeSeoDescription = (seoDescStr, allowEmptyBlock) => {
        if (!hasNativeSeoDescriptionBaseline) {
          blockedFields["native_seo_description"] = "Native SEO description baseline could not be loaded from Shopify; reload product data before saving.";
        } else if (allowEmptyBlock && seoDescStr === "") {
          blockedFields["native_seo_description"] = "Native SEO description cannot be empty.";
        } else if (seoDescStr.length > 160) {
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
      };

      if (nativeChanges.seoDescription !== undefined) {
        evaluateAndStageNativeSeoDescription(String(nativeChanges.seoDescription ?? "").trim(), true);
      }

      let doShippingWeightUpdate = false;
      let shippingWeightInput = null;

      if (nativeChanges.shippingWeight) {
         const sw = nativeChanges.shippingWeight;
         const valStr = String(sw.value !== null && sw.value !== undefined ? sw.value : "").trim();

         if (valStr !== "") {
            const parsedNum = parseFloat(valStr);
            if (isNaN(parsedNum) || parsedNum < 0) {
               blockedFields["native_shipping_weight"] = "Shipping weight must be a positive number.";
            } else if (!sw.variantId || !isExactProductVariantGid(sw.variantId)) {
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

      const moValidationCache = new Map();

      for (const [fullKey, val] of Object.entries(repairPlan)) {
        if (fullKey === "shopify_title" || fullKey === "native_title") {
           if (!nativeTitleUpdated && nativeChanges.title === undefined) {
               skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_description") {
           const rawDescStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!nativeDescriptionUpdated && nativeChanges.description === undefined && rawDescStr !== "") {
              evaluateAndStageNativeDescription(rawDescStr, false);
           } else if (!nativeDescriptionUpdated) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_seo_title") {
           const rawSeoTitleStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!nativeSeoTitleUpdated && nativeChanges.seoTitle === undefined && rawSeoTitleStr !== "") {
              evaluateAndStageNativeSeoTitle(rawSeoTitleStr, false);
           } else if (!nativeSeoTitleUpdated) {
              skippedKeys.push(fullKey);
           }
           continue;
        }

        if (fullKey === "native_seo_description") {
           const valStr = String(val !== null && val !== undefined ? val : "").trim();
           if (!nativeSeoDescriptionUpdated && nativeChanges.seoDescription === undefined && valStr !== "") {
              evaluateAndStageNativeSeoDescription(valStr, false);
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
          if (!isBenchV2OptIn || fullKey !== canonicalDestinationKey) {
            unsupportedKeys.push(fullKey);
            continue;
          }

          if (!callerVariantTargetId || !isExactProductVariantGid(callerVariantTargetId)) {
            blockedFields[fullKey] = `Missing or invalid caller variantTargetId for variant-owned destination ${canonicalDestinationKey}; exact Shopify ProductVariant GID is required.`;
            continue;
          }

          if (!productLookupComplete) {
            blockedFields[fullKey] = `Product lookup did not complete for ${productGid}; cannot verify single-variant membership for ${canonicalDestinationKey}.`;
            continue;
          }

          if (variantTargetStatus === "multiple_variants_ambiguous") {
            blockedFields[fullKey] = `Ambiguous variant destination on ${canonicalDestinationKey}: product has multiple variants; single-variant target is required.`;
            continue;
          }

          if (variantTargetStatus === "zero_variants") {
            blockedFields[fullKey] = `Invalid variant destination on ${canonicalDestinationKey}: product has zero variants.`;
            continue;
          }

          if (variantTargetStatus !== "single_variant_verified" || !verifiedSingleVariantGid) {
            blockedFields[fullKey] = `Single-variant enumeration could not be verified on ${canonicalDestinationKey} (status: ${variantTargetStatus}).`;
            continue;
          }

          if (callerVariantTargetId !== verifiedSingleVariantGid) {
            blockedFields[fullKey] = `Caller variantTargetId (${callerVariantTargetId}) does not match the product's verified single variant (${verifiedSingleVariantGid}) for ${canonicalDestinationKey}.`;
            continue;
          }

          if (!variantMetafieldsReadComplete || !currentVariantMetafields) {
            blockedFields[fullKey] = variantMetafieldsReadError
              ? `Variant metafields baseline read failed on ${verifiedSingleVariantGid}: ${variantMetafieldsReadError}`
              : `Variant metafields baseline read did not complete on ${verifiedSingleVariantGid} for ${canonicalDestinationKey}.`;
            continue;
          }

          if (!variantDefsReadComplete) {
            blockedFields[fullKey] = variantDefReadErrors.length > 0
              ? `Live PRODUCTVARIANT metafield definition read did not complete for ${canonicalDestinationKey}: ${variantDefReadErrors.join("; ")}`
              : `Live PRODUCTVARIANT metafield definition read did not complete for ${canonicalDestinationKey}; reload product data before saving.`;
            continue;
          }

          const varDef = variantDefs[canonicalDestinationKey] || null;
          const varStoredType = currentVariantMetafieldTypes?.[canonicalDestinationKey] || null;

          if (varDef?.constraints && (varDef.constraints.hasConstraints || varDef.constraints.isComplete !== true || varDef.constraints.error)) {
            if (varDef.constraints.isComplete !== true || varDef.constraints.error) {
              blockedFields[fullKey] = varDef.constraints.error || `Incomplete constraint enumeration on PRODUCTVARIANT definition ${canonicalDestinationKey}.`;
              continue;
            }
          }

          if (!varDef?.type && !varStoredType) {
            blockedFields[fullKey] = `Neither live PRODUCTVARIANT metafield definition nor stored variant metafield type is available for ${canonicalDestinationKey}; guessing a type is forbidden.`;
            continue;
          }

          if (varDef?.type && varStoredType && varDef.type !== varStoredType) {
            blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: live PRODUCTVARIANT definition is ${varDef.type} but stored variant metafield is ${varStoredType}.`;
            continue;
          }

          const resolvedVarType = varDef?.type || varStoredType;
          if (resolvedVarType !== "single_line_text_field") {
            blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: observed PRODUCTVARIANT type is ${resolvedVarType}, expected single_line_text_field.`;
            continue;
          }

          if (typeof val !== "string") {
            blockedFields[fullKey] = `Rejected non-string proposal for ${canonicalDestinationKey}.`;
            continue;
          }

          const rawUntrimmedVal = val;
          const valStr = rawUntrimmedVal.trim();
          if (valStr === "") {
            blockedFields[fullKey] = `Blank or whitespace-only proposals are forbidden for ${canonicalDestinationKey}.`;
            continue;
          }

          const normalizedVarVal = normalizeMetafieldValue(key, valStr);
          if (normalizedVarVal !== rawUntrimmedVal) {
            blockedFields[fullKey] = `Proposal for ${canonicalDestinationKey} contains leading/trailing whitespace or warning prefixes that would alter the exact approved value.`;
            continue;
          }

          if (isPlainTextProposalRejectedForContract(rawUntrimmedVal, normalizedVarVal)) {
            blockedFields[fullKey] = `Rejected non-text or reference-shaped proposal for plain-text variant destination ${canonicalDestinationKey}.`;
            continue;
          }

          if (normalizedVarVal.length > 255) {
            blockedFields[fullKey] = `Value exceeds 255 characters limit for ${canonicalDestinationKey}.`;
            continue;
          }

          const liveValidationCheck = validateAgainstLiveTextDefinitionValidations(
            varDef,
            normalizedVarVal,
            canonicalDestinationKey
          );
          if (!liveValidationCheck.valid) {
            blockedFields[fullKey] = liveValidationCheck.reason;
            continue;
          }

          const hasCurrentVarProp = Object.prototype.hasOwnProperty.call(
            currentVariantMetafields,
            canonicalDestinationKey
          );
          const currentVarVal = hasCurrentVarProp
            ? currentVariantMetafields[canonicalDestinationKey]
            : null;

          if (hasCurrentVarProp && typeof currentVarVal === "string" && currentVarVal === normalizedVarVal) {
            unchanged.push(canonicalDestinationKey);
          } else {
            setToShopify.push({
              ownerId: verifiedSingleVariantGid,
              ownerType: "PRODUCTVARIANT",
              namespace: ns,
              key: key,
              type: resolvedVarType,
              value: normalizedVarVal
            });
            proposedChanges[canonicalDestinationKey] = {
              owner: "PRODUCTVARIANT",
              variantId: verifiedSingleVariantGid,
              from: currentVarVal,
              to: normalizedVarVal
            };
            attemptedDestinations.push(canonicalDestinationKey);
            attemptedVariantMetafieldWrite = true;
          }
          continue;
        }

        const isBenchV2UnheldCustomTarget =
          isBenchV2OptIn &&
          ns === "custom" &&
          BENCH_V2_OPT_IN_UNHELD_CUSTOM_DESTINATIONS.has(canonicalDestinationKey);

        if (isBenchV2OptIn && BENCH_V2_OPT_IN_UNHELD_BARE_KEYS.has(key) && ns !== "custom") {
            unsupportedKeys.push(fullKey);
            continue;
        }

        if (
          !isBenchV2UnheldCustomTarget &&
          (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey) || RETIRED_KEYS.includes(canonicalDestinationKey))
        ) {
            skippedKeys.push(fullKey);
            continue;
        }

        if (
          ns === "custom" &&
          (((key === "is_ooak" || key === "stone_family") && !isBenchV2UnheldCustomTarget) ||
            key === "primary_medium" ||
            key === "origin_handle")
        ) {
            skippedKeys.push(fullKey);
            continue;
        }

        if (STRICT_CUSTOM_KEYS.includes(key) && ns !== "custom") {
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
          !isBenchV2UnheldCustomTarget &&
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

        if (isBenchV2OptIn && !defsReadComplete) {
            blockedFields[fullKey] = `Live PRODUCT metafield definition read did not complete for ${canonicalDestinationKey}; reload product data before saving.`;
            continue;
        }

        const currentVal = currentMetafields[fullKey] !== undefined
          ? currentMetafields[fullKey]
          : (currentMetafields[canonicalDestinationKey] ?? null);
        const valStr = String(val !== null && val !== undefined ? val : "").trim();

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

        if (valStr === "" || (ns === "custom" && key === "collection_date" && /^(n\/a|none|unknown)$/i.test(valStr))) {
            if (!currentVal) unchanged.push(fullKey);
            else skippedKeys.push(fullKey);
            continue;
        }

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

        let resolvedType = def?.type
          ? def.type
          : (storedType || (!isBenchV2OptIn ? reviewedContractType : null) || null);

        if (!resolvedType) {
            blockedFields[fullKey] = "No exact live definition or stored type available; fallback mappings are strictly forbidden.";
            continue;
        }

        if (isBenchV2UnheldCustomTarget) {
            if (canonicalDestinationKey === "custom.is_ooak") {
                if (resolvedType !== "single_line_text_field" && resolvedType !== "boolean") {
                    blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: observed type is ${resolvedType}, expected single_line_text_field or boolean.`;
                    continue;
                }
            } else if (resolvedType !== "single_line_text_field") {
                blockedFields[fullKey] = `Type conflict on ${canonicalDestinationKey}: observed type is ${resolvedType}, expected single_line_text_field.`;
                continue;
            }
        }

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

        if (
          reviewedContractType === "single_line_text_field" ||
          (isBenchV2UnheldCustomTarget && resolvedType === "single_line_text_field")
        ) {
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
          if (isBenchV2UnheldCustomTarget) {
             if (resolvedValue !== "true" && resolvedValue !== "false") {
                blockedFields[fullKey] = `Invalid boolean value: ${resolvedValue}`;
                continue;
             }
          } else {
             const lower = String(resolvedValue).toLowerCase();
             if (lower === "true" || lower === "false") {
                resolvedValue = lower;
             } else {
                blockedFields[fullKey] = `Invalid boolean value: ${resolvedValue}`;
                continue;
             }
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

        if (RETIRED_KEYS.includes(key) || RETIRED_KEYS.includes(fullKey) || RETIRED_KEYS.includes(canonicalDestinationKey)) {
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
            allErrors.push(...bulkData.userErrors.map(uErr => ({ ...uErr, destination: "price" })));
          } else if (!bulkData?.productVariants || !bulkData.productVariants.some(v => v.id === priceVariantGid)) {
            allErrors.push({ destination: "price", message: "Price update accepted by API but variant was not returned in success payload." });
          } else {
            priceWriteSucceeded = true;
          }
        } catch (priceErr) {
          allErrors.push({ destination: "price", message: `API Error on Price Update: ${priceErr.message}` });
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

      let readBackVerified = Boolean(
        hasProductReadBack &&
        hasMetafieldsReadBack &&
        (!attemptedVariantMetafieldWrite || hasVariantMetafieldsReadBack)
      );
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
                 if (parsePriceToCentsBigInt(variantNode.price) !== parsePriceToCentsBigInt(newPriceString)) {
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
        metafieldsReadComplete: hasMetafieldsReadBack,
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
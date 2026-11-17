import { useState, useEffect, useCallback, useRef } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation, useNavigate } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, List, Button, TextField,
  Tabs, Badge, Box, Divider, Banner, Scrollable, Modal, Select, FormLayout, ButtonGroup
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { storeTelemetryReport } from "../utils/meta-injector.sidekick-report-cache.server.js";

const PINNED_FILES = [
  "config/settings_schema.json",
  "config/settings_data.json",
  "layout/theme.liquid",
  "sections/header.liquid",
  "sections/footer.liquid",
];

const THEME_READBACK_MODE = "theme_editor_readback";
const PRODUCT_GID_REGEX = /^gid:\/\/shopify\/Product\/\d+$/;
const MAX_SECTION_SCHEMA_READS = 14;
const PRODUCT_SELECTOR_LIMIT = 25;
const MEDIA_READ_LIMIT = 25;
const VARIANT_READ_LIMIT = 25;
const METAFIELD_READ_LIMIT = 100;

const SHARED_GROUP_ASSET_KEYS = [
  "sections/header-group.json",
  "sections/footer-group.json",
  "sections/overlay-group.json",
  "sections/aside-group.json",
];

// ── SHARED BROWSER-SAFE PURE SCHEMA EXTRACTOR ────────────────────────────────
const parseLiquidSchemaBlock = (content) => {
  if (typeof content !== "string" || !content) {
    return { schemaFound: false, parseOk: false, schema: null, parseError: null };
  }
  const match = content.match(/\{%\s*schema\s*%\}([\s\S]*?)\{%\s*endschema\s*%\}/);
  if (!match || !match[1]) {
    return { schemaFound: false, parseOk: false, schema: null, parseError: null };
  }
  try {
    return { schemaFound: true, parseOk: true, schema: JSON.parse(match[1]), parseError: null };
  } catch (err) {
    return { schemaFound: true, parseOk: false, schema: null, parseError: err.message };
  }
};

// ── HELPER: GET ACTIVE THEME ─────────────────────────────────────────────────
const getActiveTheme = async (admin) => {
  const themeQuery = `#graphql
    query {
      themes(first: 1, roles: [MAIN]) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `;
  const themeRes = await admin.graphql(themeQuery);
  const themeJson = await themeRes.json();
  const activeThemeNode = themeJson.data?.themes?.edges[0]?.node;
  
  if (!activeThemeNode) {
    throw new Error("No active main theme found.");
  }
  
  return {
    id: activeThemeNode.id.split("/").pop(),
    gid: activeThemeNode.id,
    name: activeThemeNode.name
  };
};

// ── HELPER: FETCH RECENT PRODUCTS FOR GENUINE PRODUCT IDENTITY ───────────────
const getRecentProductsForReadback = async (admin) => {
  const productsQuery = `#graphql
    query ThemeEditorReadbackProducts($first: Int!) {
      products(first: $first, sortKey: UPDATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
        }
        edges {
          node {
            id
            title
            handle
            status
            templateSuffix
          }
        }
      }
    }
  `;
  const res = await admin.graphql(productsQuery, {
    variables: { first: PRODUCT_SELECTOR_LIMIT },
  });
  const json = await res.json();
  const edges = json.data?.products?.edges || [];
  return {
    items: edges.map((edge) => edge.node).filter((node) => node && PRODUCT_GID_REGEX.test(node.id)),
    hasMoreProducts: Boolean(json.data?.products?.pageInfo?.hasNextPage),
  };
};

// ── HELPER: FETCH COMPLETE PRODUCT SNAPSHOT FOR READBACK ─────────────────────
const getProductReadbackSnapshot = async (admin, productGid) => {
  if (!productGid || !PRODUCT_GID_REGEX.test(productGid)) {
    throw new Error("A genuine Shopify Product GID (gid://shopify/Product/<digits>) is required.");
  }

  const productQuery = `#graphql
    query ThemeEditorProductSnapshot($id: ID!, $mediaFirst: Int!, $variantsFirst: Int!, $metafieldsFirst: Int!) {
      product(id: $id) {
        id
        title
        handle
        status
        vendor
        productType
        tags
        templateSuffix
        updatedAt
        description
        descriptionHtml
        totalInventory
        tracksInventory
        seo {
          title
          description
        }
        options(first: 10) {
          id
          name
          position
          values
        }
        media(first: $mediaFirst) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              alt
              mediaContentType
              ... on MediaImage {
                image {
                  url
                  width
                  height
                }
              }
            }
          }
        }
        variants(first: $variantsFirst) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              title
              sku
              price
              compareAtPrice
              availableForSale
              inventoryQuantity
              selectedOptions {
                name
                value
              }
            }
          }
        }
        metafields(first: $metafieldsFirst) {
          pageInfo {
            hasNextPage
          }
          edges {
            node {
              id
              namespace
              key
              type
              value
              updatedAt
            }
          }
        }
      }
    }
  `;

  const res = await admin.graphql(productQuery, {
    variables: {
      id: productGid,
      mediaFirst: MEDIA_READ_LIMIT,
      variantsFirst: VARIANT_READ_LIMIT,
      metafieldsFirst: METAFIELD_READ_LIMIT,
    },
  });
  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Product GraphQL read failed: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  const product = json.data?.product;
  if (!product) {
    throw new Error(`Product not found for ID ${productGid}.`);
  }

  const mediaHasNextPage = Boolean(product.media?.pageInfo?.hasNextPage);
  const variantsHasNextPage = Boolean(product.variants?.pageInfo?.hasNextPage);
  const metafieldsHasNextPage = Boolean(product.metafields?.pageInfo?.hasNextPage);

  const mediaItems = (product.media?.edges || []).map((edge, idx) => {
    const node = edge?.node || {};
    return {
      index: idx,
      id: node.id || null,
      mediaContentType: node.mediaContentType || null,
      alt: node.alt ?? null,
      width: node.image?.width ?? null,
      height: node.image?.height ?? null,
      urlPresent: Boolean(node.image?.url),
    };
  });

  const variants = (product.variants?.edges || []).map((edge, idx) => {
    const node = edge?.node || {};
    return {
      index: idx,
      id: node.id || null,
      title: node.title || null,
      sku: node.sku || null,
      price: node.price || null,
      compareAtPrice: node.compareAtPrice || null,
      availableForSale: typeof node.availableForSale === "boolean" ? node.availableForSale : null,
      inventoryQuantity: typeof node.inventoryQuantity === "number" ? node.inventoryQuantity : null,
      selectedOptions: Array.isArray(node.selectedOptions) ? node.selectedOptions : [],
    };
  });

  const metafieldsList = (product.metafields?.edges || []).map((edge) => {
    const node = edge?.node || {};
    return {
      id: node.id || null,
      namespace: node.namespace || "",
      key: node.key || "",
      fullKey: node.namespace && node.key ? `${node.namespace}.${node.key}` : node.key || "",
      type: node.type || null,
      value: node.value ?? null,
      updatedAt: node.updatedAt || null,
    };
  });

  const metafieldsByFullKey = {};
  for (let i = 0; i < metafieldsList.length; i += 1) {
    const mf = metafieldsList[i];
    if (mf.fullKey) {
      metafieldsByFullKey[mf.fullKey] = mf;
    }
  }

  return {
    id: product.id,
    title: product.title || "",
    handle: product.handle || "",
    status: product.status || null,
    vendor: product.vendor || null,
    productType: product.productType || null,
    tags: Array.isArray(product.tags) ? product.tags : [],
    templateSuffix: product.templateSuffix || null,
    resolvedTemplateAssetKey: product.templateSuffix
      ? `templates/product.${product.templateSuffix}.json`
      : "templates/product.json",
    updatedAt: product.updatedAt || null,
    totalInventory: typeof product.totalInventory === "number" ? product.totalInventory : null,
    tracksInventory: typeof product.tracksInventory === "boolean" ? product.tracksInventory : null,
    seo: {
      title: product.seo?.title ?? null,
      description: product.seo?.description ?? null,
    },
    descriptionLength: typeof product.description === "string" ? product.description.length : 0,
    descriptionHtmlLength: typeof product.descriptionHtml === "string" ? product.descriptionHtml.length : 0,
    descriptionText: typeof product.description === "string" ? product.description : "",
    descriptionHtml: typeof product.descriptionHtml === "string" ? product.descriptionHtml : "",
    options: Array.isArray(product.options) ? product.options : [],
    coverageCompleteness: {
      isComplete: !(mediaHasNextPage || variantsHasNextPage || metafieldsHasNextPage),
      media: {
        returnedCount: mediaItems.length,
        capUsed: MEDIA_READ_LIMIT,
        hasNextPage: mediaHasNextPage,
        isComplete: !mediaHasNextPage,
      },
      variants: {
        returnedCount: variants.length,
        capUsed: VARIANT_READ_LIMIT,
        hasNextPage: variantsHasNextPage,
        isComplete: !variantsHasNextPage,
      },
      metafields: {
        returnedCount: metafieldsList.length,
        capUsed: METAFIELD_READ_LIMIT,
        hasNextPage: metafieldsHasNextPage,
        isComplete: !metafieldsHasNextPage,
      },
    },
    mediaCount: mediaItems.length,
    mediaItems,
    variantCount: variants.length,
    anyVariantAvailableForSale: variants.some((v) => v.availableForSale === true),
    variants,
    metafieldCount: metafieldsList.length,
    metafields: metafieldsList,
    metafieldsByFullKey,
  };
};

// ── HELPER: FETCH SAVED THEME ASSET SAFELY ───────────────────────────────────
const fetchSavedThemeAsset = async (shop, accessToken, themeId, assetKey) => {
  if (!assetKey || typeof assetKey !== "string") {
    return {
      assetKey: assetKey || null,
      ok: false,
      status: 0,
      value: null,
      updatedAt: null,
      error: "Invalid assetKey.",
    };
  }
  try {
    const response = await fetch(
      `https://${shop}/admin/api/2024-10/themes/${themeId}/assets.json?asset[key]=${encodeURIComponent(assetKey)}&_t=${Date.now()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      }
    );

    if (!response.ok) {
      return {
        assetKey,
        ok: false,
        status: response.status,
        value: null,
        updatedAt: null,
        error: `HTTP ${response.status}`,
      };
    }

    const data = await response.json();
    const value = typeof data.asset?.value === "string" ? data.asset.value : null;
    return {
      assetKey,
      ok: value !== null,
      status: response.status,
      value,
      updatedAt: data.asset?.updated_at || null,
      checksum: data.asset?.checksum || null,
      error: value !== null ? null : "Asset response did not include string value.",
    };
  } catch (err) {
    return {
      assetKey,
      ok: false,
      status: 0,
      value: null,
      updatedAt: null,
      error: err.message || "Asset fetch error.",
    };
  }
};

// ── HELPER: STRIP LEADING JSON COMMENTS IN SHOPIFY TEMPLATES/GROUPS ──────────
const parseShopifyJsonAsset = (rawText) => {
  if (typeof rawText !== "string" || !rawText.trim()) {
    return { ok: false, data: null, error: "Empty JSON asset text." };
  }
  const stripped = rawText.replace(/^\s*\/\*[\s\S]*?\*\/\s*/, "");
  try {
    return { ok: true, data: JSON.parse(stripped), error: null };
  } catch (err) {
    return { ok: false, data: null, error: err.message };
  }
};

// ── HELPER: EXTRACT DYNAMIC SOURCE EXPRESSIONS ({{ ... }}) ───────────────────
const extractDynamicExpressionsFromValue = (val, pathPrefix = "", out = []) => {
  if (typeof val === "string") {
    const matches = val.match(/\{\{[\s\S]*?\}\}/g);
    if (matches && matches.length > 0) {
      for (let i = 0; i < matches.length; i += 1) {
        const expr = matches[i].trim();
        out.push({
          settingPath: pathPrefix,
          rawExpression: expr,
          innerExpression: expr.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, ""),
          rawSettingValue: val,
        });
      }
    }
    return out;
  }
  if (Array.isArray(val)) {
    for (let i = 0; i < val.length; i += 1) {
      extractDynamicExpressionsFromValue(val[i], `${pathPrefix}[${i}]`, out);
    }
    return out;
  }
  if (val && typeof val === "object") {
    const keys = Object.keys(val);
    for (let i = 0; i < keys.length; i += 1) {
      const k = keys[i];
      const nextPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      extractDynamicExpressionsFromValue(val[k], nextPath, out);
    }
  }
  return out;
};

// ── HELPER: MATCH DYNAMIC EXPRESSION TO PRODUCT DATA (HONEST BOUNDS) ─────────
const matchDynamicExpressionToProductData = (innerExpression, productSnapshot) => {
  if (typeof innerExpression !== "string" || !innerExpression.trim()) {
    return {
      resolutionState: "unknown_expression",
      matchedSourcePath: null,
      hasLiquidFiltersOrOperators: false,
      productValue: null,
      note: "Empty dynamic expression.",
    };
  }

  const trimmed = innerExpression.trim();
  const hasFilters = trimmed.includes("|");
  const normalized = trimmed.split("|")[0].trim();

  if (!productSnapshot) {
    return {
      resolutionState: "product_unavailable",
      matchedSourcePath: normalized,
      hasLiquidFiltersOrOperators: hasFilters,
      productValue: null,
      note: "No product snapshot available.",
    };
  }

  const mfMatch = normalized.match(
    /^product\.metafields\.([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)(?:\.value)?$/
  );
  if (mfMatch) {
    const namespace = mfMatch[1];
    const key = mfMatch[2];
    const fullKey = `${namespace}.${key}`;
    const found = productSnapshot.metafieldsByFullKey?.[fullKey] || null;
    if (found) {
      return {
        resolutionState: hasFilters
          ? "matched_raw_source_with_unevaluated_liquid_filters"
          : "matched_product_metafield_raw",
        matchedSourcePath: `product.metafields.${fullKey}`,
        hasLiquidFiltersOrOperators: hasFilters,
        metafieldType: found.type,
        productValue: found.value,
        note: "Static path match against raw Admin GraphQL product metafield only; Liquid runtime rendering and filters are not executed.",
      };
    }
    const mfIncomplete = productSnapshot.coverageCompleteness?.metafields?.hasNextPage === true;
    return {
      resolutionState: mfIncomplete
        ? "unknown_beyond_metafield_read_cap"
        : "missing_on_product",
      matchedSourcePath: `product.metafields.${fullKey}`,
      hasLiquidFiltersOrOperators: hasFilters,
      metafieldType: null,
      productValue: null,
      note: mfIncomplete
        ? `Metafield ${fullKey} was not in the first ${METAFIELD_READ_LIMIT} metafields; product has additional unread metafields.`
        : `Metafield ${fullKey} is not present on product ${productSnapshot.id}.`,
    };
  }

  const directFieldMap = {
    "product.title": { path: "product.title", value: productSnapshot.title },
    "product.description": { path: "product.descriptionHtml", value: productSnapshot.descriptionHtml },
    "product.vendor": { path: "product.vendor", value: productSnapshot.vendor },
    "product.type": { path: "product.productType", value: productSnapshot.productType },
  };

  if (Object.prototype.hasOwnProperty.call(directFieldMap, normalized)) {
    const entry = directFieldMap[normalized];
    return {
      resolutionState: hasFilters
        ? "matched_raw_source_with_unevaluated_liquid_filters"
        : "matched_product_field_raw",
      matchedSourcePath: entry.path,
      hasLiquidFiltersOrOperators: hasFilters,
      productValue: entry.value,
      note: "Static path match against raw Admin GraphQL product field; Liquid runtime rendering is not executed.",
    };
  }

  return {
    resolutionState: "unknown_unverified_dynamic_source",
    matchedSourcePath: normalized,
    hasLiquidFiltersOrOperators: hasFilters,
    productValue: null,
    note: "Expression was not assumed resolved; requires Liquid runtime evaluation or uninspected context.",
  };
};

// ── HELPER: PARSE STRUCTURAL TEMPLATE OR SECTION GROUP JSON ──────────────────
const buildStructuredTemplateOrGroupMap = (assetKey, rawJsonText, provenanceLabel, productSnapshot) => {
  const parsed = parseShopifyJsonAsset(rawJsonText);
  if (!parsed.ok || !parsed.data || typeof parsed.data !== "object") {
    return {
      assetKey,
      provenance: provenanceLabel,
      parseOk: false,
      parseError: parsed.error || "Not a valid JSON template/group object.",
      name: null,
      type: null,
      layout: null,
      wrapper: null,
      sectionOrder: [],
      undeclaredSectionKeys: [],
      sections: [],
      dynamicExpressions: [],
    };
  }

  const doc = parsed.data;
  const sectionsObj = doc.sections && typeof doc.sections === "object" && !Array.isArray(doc.sections)
    ? doc.sections
    : {};
  const declaredOrder = Array.isArray(doc.order) ? doc.order.map((k) => String(k)) : [];
  const allSectionKeys = Object.keys(sectionsObj);
  const undeclaredSectionKeys = allSectionKeys.filter((k) => !declaredOrder.includes(k));
  const effectiveSectionKeys = [
    ...declaredOrder.filter((k) => Object.prototype.hasOwnProperty.call(sectionsObj, k)),
    ...undeclaredSectionKeys,
  ];

  const dynamicExpressions = [];
  const structuredSections = effectiveSectionKeys.map((sectionId, sectionIdx) => {
    const sec = sectionsObj[sectionId] || {};
    const blocksObj = sec.blocks && typeof sec.blocks === "object" && !Array.isArray(sec.blocks)
      ? sec.blocks
      : {};
    const declaredBlockOrder = Array.isArray(sec.block_order)
      ? sec.block_order.map((bk) => String(bk))
      : [];
    const allBlockKeys = Object.keys(blocksObj);
    const undeclaredBlockKeys = allBlockKeys.filter((bk) => !declaredBlockOrder.includes(bk));
    const effectiveBlockKeys = [
      ...declaredBlockOrder.filter((bk) => Object.prototype.hasOwnProperty.call(blocksObj, bk)),
      ...undeclaredBlockKeys,
    ];

    const secDynamic = extractDynamicExpressionsFromValue(
      sec.settings || {},
      `sections.${sectionId}.settings`
    ).map((item) => ({
      ...item,
      ownerKind: "section",
      sectionId,
      sectionType: sec.type || null,
      blockId: null,
      blockType: null,
      ...matchDynamicExpressionToProductData(item.innerExpression, productSnapshot),
    }));
    dynamicExpressions.push(...secDynamic);

    const structuredBlocks = effectiveBlockKeys.map((blockId, blockIdx) => {
      const blk = blocksObj[blockId] || {};
      const blkDynamic = extractDynamicExpressionsFromValue(
        blk.settings || {},
        `sections.${sectionId}.blocks.${blockId}.settings`
      ).map((item) => ({
        ...item,
        ownerKind: "block",
        sectionId,
        sectionType: sec.type || null,
        blockId,
        blockType: blk.type || null,
        ...matchDynamicExpressionToProductData(item.innerExpression, productSnapshot),
      }));
      dynamicExpressions.push(...blkDynamic);

      return {
        sourceIndex: blockIdx,
        inDeclaredBlockOrder: declaredBlockOrder.includes(blockId),
        blockId,
        type: blk.type || null,
        disabled: Boolean(blk.disabled),
        name: blk.name || null,
        settings: blk.settings && typeof blk.settings === "object" ? blk.settings : {},
        dynamicSourceCount: blkDynamic.length,
      };
    });

    return {
      sourceIndex: sectionIdx,
      inDeclaredSectionOrder: declaredOrder.includes(sectionId),
      sectionId,
      type: sec.type || null,
      sectionAssetKey: typeof sec.type === "string" && sec.type.trim() ? `sections/${sec.type.trim()}.liquid` : null,
      disabled: Boolean(sec.disabled),
      customCssCount: Array.isArray(sec.custom_css) ? sec.custom_css.length : 0,
      customCss: Array.isArray(sec.custom_css) ? sec.custom_css : [],
      settings: sec.settings && typeof sec.settings === "object" ? sec.settings : {},
      blockOrder: declaredBlockOrder,
      undeclaredBlockKeys,
      blockCount: structuredBlocks.length,
      blocks: structuredBlocks,
    };
  });

  return {
    assetKey,
    provenance: provenanceLabel,
    parseOk: true,
    parseError: null,
    name: doc.name || null,
    type: doc.type || null,
    layout: doc.layout !== undefined ? doc.layout : null,
    wrapper: doc.wrapper || null,
    sectionOrder: declaredOrder,
    undeclaredSectionKeys,
    sectionCount: structuredSections.length,
    sections: structuredSections,
    dynamicExpressions,
  };
};

// ── HELPER: SUMMARIZE SECTION SCHEMA, OPTIONS & CONDITIONS ───────────────────
const summarizeSectionSchema = (assetKey, rawLiquidText, provenanceLabel) => {
  const extracted = parseLiquidSchemaBlock(rawLiquidText);
  const liquidWithoutSchema = typeof rawLiquidText === "string"
    ? rawLiquidText.replace(/\{%\s*schema\s*%\}[\s\S]*?\{%\s*endschema\s*%\}/g, "")
    : "";

  const metafieldRefs = [];
  const seenRefs = new Set();
  const mfRegex = /\b(?:product|variant|collection|shop|page|article)\.metafields\.[a-zA-Z0-9_.-]+/g;
  const rawMatches = liquidWithoutSchema.match(mfRegex) || [];
  for (let i = 0; i < rawMatches.length; i += 1) {
    const token = rawMatches[i].trim();
    if (!seenRefs.has(token)) {
      seenRefs.add(token);
      metafieldRefs.push(token);
    }
  }

  if (!extracted.schemaFound || !extracted.parseOk || !extracted.schema) {
    return {
      assetKey,
      provenance: provenanceLabel,
      schemaFound: extracted.schemaFound,
      parseOk: extracted.parseOk,
      parseError: extracted.parseError,
      sectionName: null,
      tag: null,
      class: null,
      limit: null,
      enabledOn: null,
      disabledOn: null,
      settingsCount: 0,
      settings: [],
      blockTypesCount: 0,
      blockTypes: [],
      presetsCount: 0,
      liquidMetafieldReferences: metafieldRefs,
    };
  }

  const schema = extracted.schema;
  const mapSettingDescriptor = (s) => ({
    id: s.id || null,
    type: s.type || null,
    label: s.label || s.content || null,
    default: s.default !== undefined ? s.default : null,
    info: s.info || null,
    visibleIf: s.visible_if || null,
    ...(Array.isArray(s.options)
      ? { options: s.options.map((opt) => ({ value: opt.value ?? null, label: opt.label ?? null })) }
      : {}),
  });

  const settings = (Array.isArray(schema.settings) ? schema.settings : []).map(mapSettingDescriptor);
  const blockTypes = (Array.isArray(schema.blocks) ? schema.blocks : []).map((b) => ({
    type: b.type || null,
    name: b.name || null,
    limit: typeof b.limit === "number" ? b.limit : null,
    visibleIf: b.visible_if || null,
    settingsCount: Array.isArray(b.settings) ? b.settings.length : 0,
    settings: (Array.isArray(b.settings) ? b.settings : []).map(mapSettingDescriptor),
  }));

  return {
    assetKey,
    provenance: provenanceLabel,
    schemaFound: true,
    parseOk: true,
    parseError: null,
    sectionName: schema.name || null,
    tag: schema.tag || null,
    class: schema.class || null,
    limit: typeof schema.limit === "number" ? schema.limit : null,
    enabledOn: schema.enabled_on || null,
    disabledOn: schema.disabled_on || null,
    settingsCount: settings.length,
    settings,
    blockTypesCount: blockTypes.length,
    blockTypes,
    presetsCount: Array.isArray(schema.presets) ? schema.presets.length : 0,
    liquidMetafieldReferences: metafieldRefs,
  };
};

// ── HELPER: SUMMARIZE GLOBAL THEME SETTINGS (settings_data + settings_schema) ─
const buildGlobalThemeSettingsSummary = (settingsDataRaw, settingsSchemaRaw) => {
  const parsedData = parseShopifyJsonAsset(settingsDataRaw);
  const parsedSchema = parseShopifyJsonAsset(settingsSchemaRaw);

  const currentSettings =
    parsedData.ok &&
    parsedData.data &&
    typeof parsedData.data.current === "object" &&
    parsedData.data.current !== null &&
    !Array.isArray(parsedData.data.current)
      ? parsedData.data.current
      : {};

  const rootBlocks =
    currentSettings.blocks &&
    typeof currentSettings.blocks === "object" &&
    !Array.isArray(currentSettings.blocks)
      ? currentSettings.blocks
      : {};

  const scalarSettings = {};
  for (const [k, v] of Object.entries(currentSettings)) {
    if (k !== "sections" && k !== "blocks" && k !== "content_for_index") {
      scalarSettings[k] = v;
    }
  }

  const schemaGroups =
    parsedSchema.ok && Array.isArray(parsedSchema.data)
      ? parsedSchema.data
          .filter((g) => g && typeof g === "object")
          .map((g, idx) => ({
            name: g.name || `Group_${idx}`,
            settings: (Array.isArray(g.settings) ? g.settings : [])
              .filter((s) => s && s.id)
              .map((s) => ({
                id: s.id,
                type: s.type || null,
                label: s.label || null,
                default: s.default !== undefined ? s.default : null,
                visibleIf: s.visible_if || null,
                ...(Array.isArray(s.options)
                  ? { options: s.options.map((o) => ({ value: o.value ?? null, label: o.label ?? null })) }
                  : {}),
              })),
          }))
      : [];

  return {
    settingsDataParseOk: parsedData.ok,
    settingsDataParseError: parsedData.error,
    settingsSchemaParseOk: parsedSchema.ok,
    settingsSchemaParseError: parsedSchema.error,
    scalarSettingCount: Object.keys(scalarSettings).length,
    currentScalarSettings: scalarSettings,
    appEmbedOrRootBlocks: Object.entries(rootBlocks).map(([blockId, blk]) => ({
      blockId,
      type: blk?.type || null,
      disabled: Boolean(blk?.disabled),
      settings: blk?.settings && typeof blk.settings === "object" ? blk.settings : {},
    })),
    schemaGroupCount: schemaGroups.length,
    schemaGroups,
  };
};

// ── HELPER: COMPACT STRUCTURAL INDEX FOR UI_AUDIT (NO DUPLICATE CATALOGUE) ───
const buildCompactThemeStructuralIndexAudit = ({
  capturedAt,
  theme,
  productSnapshot,
  selectedFileKey,
  hasUnsavedAppDraft,
  savedSelectedFileAsset,
  clientDraftContent,
  activeTemplateKey,
  savedTemplateMap,
  draftTemplateMap,
  sharedGroupMaps,
  sectionSchemaCoverage,
}) => ({
  auditKind: "theme_editor_structural_index",
  capturedAt,
  captureNature: "point_in_time_read_only_snapshot",
  productId: productSnapshot.id,
  productTitle: productSnapshot.title,
  productHandle: productSnapshot.handle,
  productStatus: productSnapshot.status,
  productTemplateSuffix: productSnapshot.templateSuffix,
  resolvedProductTemplateAssetKey: productSnapshot.resolvedTemplateAssetKey,
  theme: {
    id: theme.id,
    gid: theme.gid,
    name: theme.name,
    role: "MAIN",
    selectionScopeNote: "Queried active MAIN theme only; does not track arbitrary theme selections in Shopify's native Theme Editor.",
  },
  provenanceBoundaries: {
    savedThemeSource: savedSelectedFileAsset?.ok || savedTemplateMap?.parseOk
      ? "VERIFIED_SHOPIFY_REST_ASSET_READ"
      : "UNAVAILABLE_OR_MISSING",
    thisAppEditorDraft: selectedFileKey
      ? hasUnsavedAppDraft
        ? "UNSAVED_IN_APP_BUFFER_PRESENT"
        : "MATCHES_SAVED_THEME_SOURCE"
      : "NO_FILE_SELECTED_IN_APP",
    nativeShopifyThemeCustomizerUnsavedState: "UNKNOWN_NOT_CAPTURED_BY_THIS_ROUTE",
    visualPlacementAndScreenshots: "NOT_MEASURED_SOURCE_ORDER_IS_NOT_VISUAL_PLACEMENT",
  },
  completenessAndCaps: {
    productDataCoverage: productSnapshot.coverageCompleteness,
    sectionSchemaReadCoverage: sectionSchemaCoverage,
  },
  selectedEditorFile: {
    assetKey: selectedFileKey || null,
    savedAssetAvailable: Boolean(savedSelectedFileAsset?.ok),
    savedUpdatedAt: savedSelectedFileAsset?.updatedAt || null,
    savedCharCount: typeof savedSelectedFileAsset?.value === "string" ? savedSelectedFileAsset.value.length : null,
    hasUnsavedAppDraft: Boolean(hasUnsavedAppDraft),
    thisAppDraftCharCount: typeof clientDraftContent === "string" ? clientDraftContent.length : null,
  },
  inspectedTemplateKey: activeTemplateKey,
  savedTemplateOrderIndex: savedTemplateMap
    ? {
        assetKey: savedTemplateMap.assetKey,
        parseOk: savedTemplateMap.parseOk,
        sectionOrder: savedTemplateMap.sectionOrder,
        undeclaredSectionKeys: savedTemplateMap.undeclaredSectionKeys,
        sections: (savedTemplateMap.sections || []).map((s) => ({
          sectionId: s.sectionId,
          type: s.type,
          disabled: s.disabled,
          blockOrder: s.blockOrder,
          undeclaredBlockKeys: s.undeclaredBlockKeys,
        })),
        dynamicExpressionCount: (savedTemplateMap.dynamicExpressions || []).length,
      }
    : null,
  thisAppDraftTemplateOrderIndex: draftTemplateMap
    ? {
        assetKey: draftTemplateMap.assetKey,
        parseOk: draftTemplateMap.parseOk,
        sectionOrder: draftTemplateMap.sectionOrder,
        undeclaredSectionKeys: draftTemplateMap.undeclaredSectionKeys,
        sections: (draftTemplateMap.sections || []).map((s) => ({
          sectionId: s.sectionId,
          type: s.type,
          disabled: s.disabled,
          blockOrder: s.blockOrder,
          undeclaredBlockKeys: s.undeclaredBlockKeys,
        })),
        dynamicExpressionCount: (draftTemplateMap.dynamicExpressions || []).length,
      }
    : null,
  sharedShellGroupOrderIndex: Object.fromEntries(
    Object.entries(sharedGroupMaps).map(([gk, gm]) => [
      gk,
      {
        available: typeof gm?.available === "boolean" ? gm.available : null,
        status: typeof gm?.status === "number" ? gm.status : null,
        error: gm?.error ?? gm?.parseError ?? null,
        parseOk: Boolean(gm?.parseOk),
        sectionOrder: Array.isArray(gm?.sectionOrder) ? gm.sectionOrder : [],
      },
    ])
  ),
  reportSectionPointers: {
    readFullReportVia: 'read_meta_injector_report with section="report" and view="chunk" (follow nextChunkIndex)',
    topLevelReportKeys: [
      "provenanceAndBoundaries",
      "completenessAndCaps",
      "themeIdentity",
      "productIdentityAndValues",
      "editorShellAndLayout",
      "sharedSectionGroups",
      "productTemplateResolution",
      "savedTemplateStructure",
      "thisAppUnsavedDraftTemplateStructure",
      "referencedSectionSchemasAndOptions",
      "globalThemeSettings",
      "selectedEditorFileReadback",
    ],
  },
});

// ── SERVER LOADER ────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  
  try {
    const [theme, productListResult] = await Promise.all([
      getActiveTheme(admin),
      getRecentProductsForReadback(admin).catch((err) => {
        console.error("Failed to load recent products for readback selector:", err);
        return { items: [], hasMoreProducts: false };
      }),
    ]);
    
    // Note: Theme Asset manipulation currently requires REST API in Shopify
    const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${theme.id}/assets.json?_t=${Date.now()}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return Response.json({
      shop,
      theme,
      files: data.assets || [],
      products: productListResult.items,
      hasMoreProducts: productListResult.hasMoreProducts,
    });
  } catch (error) {
    console.error("Failed to load theme assets:", error);
    return Response.json({
      shop,
      theme: null,
      files: [],
      products: [],
      hasMoreProducts: false,
      error: `Failed to load theme files: ${error.message}`,
    });
  }
};

// ── SERVER ACTION ────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const assetKey = formData.get("assetKey");
  const timestamp = Date.now(); 

  try {
    const theme = await getActiveTheme(admin);
    const THEME_ID = theme.id;

    if (intent === "fetchAsset") {
      const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch asset content.");
      
      const data = await response.json();
      return Response.json({ intent, assetKey, content: data.asset?.value || "", timestamp });
    }

    if (intent === "publishThemeReadback") {
      const rawProductId = String(formData.get("productId") || "").trim();
      if (!PRODUCT_GID_REGEX.test(rawProductId)) {
        return Response.json(
          {
            intent,
            success: false,
            error:
              "A genuine Shopify Product GID (gid://shopify/Product/<digits>) is required to publish a theme readback report.",
            timestamp,
          },
          { status: 400 }
        );
      }

      const selectedFileKey = typeof assetKey === "string" && assetKey.trim() ? assetKey.trim() : null;
      const hasClientContent = formData.has("currentContent") && selectedFileKey !== null;
      const clientDraftContent = hasClientContent ? String(formData.get("currentContent") ?? "") : null;

      const capturedAt = new Date().toISOString();
      const productSnapshot = await getProductReadbackSnapshot(admin, rawProductId);

      const productTemplateAssetKey = productSnapshot.resolvedTemplateAssetKey || "templates/product.json";
      const activeTemplateKey =
        selectedFileKey && selectedFileKey.startsWith("templates/") && selectedFileKey.endsWith(".json")
          ? selectedFileKey
          : productTemplateAssetKey;

      const keysToFetchSet = new Set([
        productTemplateAssetKey,
        activeTemplateKey,
        "templates/product.json",
        "layout/theme.liquid",
        "config/settings_data.json",
        "config/settings_schema.json",
        ...SHARED_GROUP_ASSET_KEYS,
      ]);
      if (selectedFileKey) {
        keysToFetchSet.add(selectedFileKey);
      }

      const initialKeys = Array.from(keysToFetchSet);
      const initialAssetResults = await Promise.all(
        initialKeys.map((k) => fetchSavedThemeAsset(shop, accessToken, THEME_ID, k))
      );
      const assetsByKey = {};
      for (let i = 0; i < initialAssetResults.length; i += 1) {
        const res = initialAssetResults[i];
        if (res && res.assetKey) {
          assetsByKey[res.assetKey] = res;
        }
      }

      const resolvedProductTemplateAsset =
        assetsByKey[productTemplateAssetKey]?.ok
          ? assetsByKey[productTemplateAssetKey]
          : assetsByKey["templates/product.json"];

      const savedSelectedFileAsset = selectedFileKey ? assetsByKey[selectedFileKey] || null : null;
      const hasUnsavedAppDraft = Boolean(
        selectedFileKey &&
          savedSelectedFileAsset?.ok &&
          typeof clientDraftContent === "string" &&
          clientDraftContent !== savedSelectedFileAsset.value
      );

      const savedActiveTemplateAsset = assetsByKey[activeTemplateKey] || resolvedProductTemplateAsset || null;
      const savedTemplateMap = savedActiveTemplateAsset?.ok
        ? buildStructuredTemplateOrGroupMap(
            savedActiveTemplateAsset.assetKey,
            savedActiveTemplateAsset.value,
            "SAVED_SHOPIFY_THEME_ASSET",
            productSnapshot
          )
        : null;

      let draftTemplateMap = null;
      if (
        hasUnsavedAppDraft &&
        selectedFileKey === activeTemplateKey &&
        typeof clientDraftContent === "string"
      ) {
        draftTemplateMap = buildStructuredTemplateOrGroupMap(
          selectedFileKey,
          clientDraftContent,
          "THIS_APP_UNSAVED_EDITOR_DRAFT",
          productSnapshot
        );
      }

      const sharedGroupMaps = {};
      for (let i = 0; i < SHARED_GROUP_ASSET_KEYS.length; i += 1) {
        const gk = SHARED_GROUP_ASSET_KEYS[i];
        const groupAsset = assetsByKey[gk];
        if (groupAsset?.ok) {
          const parsedGroup = buildStructuredTemplateOrGroupMap(
            gk,
            groupAsset.value,
            "SAVED_SHOPIFY_THEME_ASSET",
            productSnapshot
          );
          sharedGroupMaps[gk] = {
            ...parsedGroup,
            available: true,
            status: typeof groupAsset.status === "number" ? groupAsset.status : 200,
            error: parsedGroup.parseError || null,
          };
        } else {
          sharedGroupMaps[gk] = {
            assetKey: gk,
            provenance: "SAVED_SHOPIFY_THEME_ASSET",
            available: groupAsset ? false : null,
            status: typeof groupAsset?.status === "number" ? groupAsset.status : null,
            error: groupAsset?.error || "Not present in theme",
            parseOk: false,
            sectionOrder: [],
            sections: [],
          };
        }
      }

      // Discover all referenced section files and explicitly track any omitted due to MAX_SECTION_SCHEMA_READS
      const allDiscoveredSectionKeys = [];
      const addDiscoveredSection = (secKey) => {
        if (
          typeof secKey === "string" &&
          secKey.startsWith("sections/") &&
          secKey.endsWith(".liquid") &&
          !allDiscoveredSectionKeys.includes(secKey)
        ) {
          allDiscoveredSectionKeys.push(secKey);
        }
      };

      if (selectedFileKey && selectedFileKey.startsWith("sections/") && selectedFileKey.endsWith(".liquid")) {
        addDiscoveredSection(selectedFileKey);
      }
      if (savedTemplateMap?.sections) {
        for (let i = 0; i < savedTemplateMap.sections.length; i += 1) {
          addDiscoveredSection(savedTemplateMap.sections[i].sectionAssetKey);
        }
      }
      if (draftTemplateMap?.sections) {
        for (let i = 0; i < draftTemplateMap.sections.length; i += 1) {
          addDiscoveredSection(draftTemplateMap.sections[i].sectionAssetKey);
        }
      }
      for (const gk of SHARED_GROUP_ASSET_KEYS) {
        const gm = sharedGroupMaps[gk];
        if (gm?.sections) {
          for (let i = 0; i < gm.sections.length; i += 1) {
            addDiscoveredSection(gm.sections[i].sectionAssetKey);
          }
        }
      }

      const referencedSectionAssetKeys = allDiscoveredSectionKeys.slice(0, MAX_SECTION_SCHEMA_READS);
      const omittedSectionAssetKeys = allDiscoveredSectionKeys.slice(MAX_SECTION_SCHEMA_READS);
      const sectionSchemaCoverage = {
        discoveredSectionCount: allDiscoveredSectionKeys.length,
        inspectedSectionCount: referencedSectionAssetKeys.length,
        capUsed: MAX_SECTION_SCHEMA_READS,
        isComplete: omittedSectionAssetKeys.length === 0,
        omittedSectionAssetKeys,
      };

      const missingSectionKeys = referencedSectionAssetKeys.filter((k) => !assetsByKey[k]);
      if (missingSectionKeys.length > 0) {
        const fetchedSections = await Promise.all(
          missingSectionKeys.map((k) => fetchSavedThemeAsset(shop, accessToken, THEME_ID, k))
        );
        for (let i = 0; i < fetchedSections.length; i += 1) {
          const secRes = fetchedSections[i];
          if (secRes && secRes.assetKey) {
            assetsByKey[secRes.assetKey] = secRes;
          }
        }
      }

      const sectionSchemas = [];
      for (let i = 0; i < referencedSectionAssetKeys.length; i += 1) {
        const secKey = referencedSectionAssetKeys[i];
        const savedSec = assetsByKey[secKey];
        if (savedSec?.ok) {
          sectionSchemas.push(
            summarizeSectionSchema(secKey, savedSec.value, "SAVED_SHOPIFY_THEME_ASSET")
          );
        } else {
          sectionSchemas.push({
            assetKey: secKey,
            provenance: "SAVED_SHOPIFY_THEME_ASSET",
            available: false,
            error: savedSec?.error || "Section asset not found",
            schemaFound: false,
            parseOk: false,
            settingsCount: 0,
            blockTypesCount: 0,
          });
        }
        if (hasUnsavedAppDraft && selectedFileKey === secKey && typeof clientDraftContent === "string") {
          sectionSchemas.push(
            summarizeSectionSchema(secKey, clientDraftContent, "THIS_APP_UNSAVED_EDITOR_DRAFT")
          );
        }
      }

      const globalSettingsSummary = buildGlobalThemeSettingsSummary(
        assetsByKey["config/settings_data.json"]?.value || "",
        assetsByKey["config/settings_schema.json"]?.value || ""
      );

      const layoutAsset = assetsByKey["layout/theme.liquid"];
      const layoutSummary = {
        assetKey: "layout/theme.liquid",
        provenance: "SAVED_SHOPIFY_THEME_ASSET",
        available: Boolean(layoutAsset?.ok),
        updatedAt: layoutAsset?.updatedAt || null,
        charLength: typeof layoutAsset?.value === "string" ? layoutAsset.value.length : null,
        referencedSectionGroups:
          typeof layoutAsset?.value === "string"
            ? (layoutAsset.value.match(/\{%-?\s*sections\s+['"][^'"]+['"]\s*-?%\}/g) || []).map((m) => m.trim())
            : [],
        hasContentForHeader:
          typeof layoutAsset?.value === "string" ? layoutAsset.value.includes("content_for_header") : null,
        hasContentForLayout:
          typeof layoutAsset?.value === "string" ? layoutAsset.value.includes("content_for_layout") : null,
      };

      const effectiveSectionKey = selectedFileKey || activeTemplateKey || "templates/product.json";
      const draftStateTag = hasUnsavedAppDraft ? "app_draft_dirty" : "saved_clean";
      const runIdentity = `theme:${theme.id}|file:${effectiveSectionKey}|state:${draftStateTag}`;
      const sectionLabel = `THEME ${theme.name} (${theme.id}) | ${effectiveSectionKey} | ${
        hasUnsavedAppDraft ? "SAVED + APP DRAFT" : "SAVED SOURCE"
      }`;

      const reportPayloadObj = {
        schemaVersion: 1,
        reportKind: THEME_READBACK_MODE,
        capturedAt,
        captureNature:
          "Point-in-time read-only snapshot. Does NOT represent a continuous live stream, a browser DOM render, or native Shopify Theme Customizer in-memory state.",
        provenanceAndBoundaries: {
          savedThemeSource: {
            status: "VERIFIED_READ_FROM_SHOPIFY_REST_ASSET_API",
            themeId: theme.id,
            themeGid: theme.gid,
            themeName: theme.name,
            themeRole: "MAIN",
            selectionScopeNote:
              "This route queries the store's active MAIN theme only; it does not follow an arbitrary theme selection in Shopify's native Theme Editor.",
          },
          thisAppThemeEditorDraft: {
            status: selectedFileKey
              ? hasUnsavedAppDraft
                ? "UNSAVED_IN_APP_BUFFER_INCLUDED_SEPARATELY"
                : "OPEN_FILE_MATCHES_SAVED_THEME_ASSET"
              : "NO_FILE_SELECTED_IN_APP_EDITOR",
            selectedFileKey,
            hasUnsavedAppDraft,
            note: "This app buffer is local to Command Center Theme Editor (app/routes/app.theme-editor.jsx) and is completely separate from Shopify's native Online Store Theme Customizer.",
          },
          nativeShopifyThemeCustomizerUnsavedState: {
            status: "UNKNOWN_NOT_CAPTURED_BY_THIS_ROUTE",
            note: "This route's current Shopify REST Asset API and Admin GraphQL reads return saved theme assets and product data only. Native Shopify Theme Customizer unsaved state is not captured by this route's current reads; it remains unknown unless supplied through a supported source and must never be overwritten or assumed absent.",
          },
          visualPlacementAndScreenshots: {
            status: "NOT_CAPTURED_BY_THIS_ROUTE",
            note: "Source order in JSON/Liquid does NOT prove responsive visual placement, CSS grid/flex ordering, visibility, or accessibility. Observed visual placement requires merchant-supplied reference photographs or screenshots.",
          },
        },
        completenessAndCaps: {
          productDataCoverage: productSnapshot.coverageCompleteness,
          sectionSchemaReadCoverage: sectionSchemaCoverage,
        },
        themeIdentity: {
          id: theme.id,
          gid: theme.gid,
          name: theme.name,
          role: "MAIN",
          selectionScopeNote:
            "Active MAIN theme selected via GraphQL roles:[MAIN]; does not track arbitrary native Theme Editor theme selections.",
        },
        productIdentityAndValues: productSnapshot,
        editorShellAndLayout: layoutSummary,
        sharedSectionGroups: sharedGroupMaps,
        productTemplateResolution: {
          productId: productSnapshot.id,
          productStatus: productSnapshot.status,
          productTemplateSuffix: productSnapshot.templateSuffix,
          expectedTemplateAssetKey: productTemplateAssetKey,
          expectedTemplateAssetExistsInSavedTheme: Boolean(assetsByKey[productTemplateAssetKey]?.ok),
          fallbackDefaultTemplateAssetKey: "templates/product.json",
          inspectedTemplateAssetKey: activeTemplateKey,
        },
        savedTemplateStructure: savedTemplateMap,
        thisAppUnsavedDraftTemplateStructure: draftTemplateMap,
        referencedSectionSchemasAndOptions: sectionSchemas,
        globalThemeSettings: globalSettingsSummary,
        selectedEditorFileReadback: selectedFileKey
          ? {
              assetKey: selectedFileKey,
              savedAssetAvailable: Boolean(savedSelectedFileAsset?.ok),
              savedAssetUpdatedAt: savedSelectedFileAsset?.updatedAt || null,
              savedAssetChecksum: savedSelectedFileAsset?.checksum || null,
              savedCharCount:
                typeof savedSelectedFileAsset?.value === "string"
                  ? savedSelectedFileAsset.value.length
                  : null,
              hasUnsavedAppDraft,
              thisAppDraftCharCount:
                typeof clientDraftContent === "string" ? clientDraftContent.length : null,
              savedSourceContent: savedSelectedFileAsset?.value ?? null,
              thisAppUnsavedDraftContent: hasUnsavedAppDraft ? clientDraftContent : null,
            }
          : null,
      };

      const fullText = JSON.stringify(reportPayloadObj);

      const uiAuditObj = buildCompactThemeStructuralIndexAudit({
        capturedAt,
        theme,
        productSnapshot,
        selectedFileKey,
        hasUnsavedAppDraft,
        savedSelectedFileAsset,
        clientDraftContent,
        activeTemplateKey,
        savedTemplateMap,
        draftTemplateMap,
        sharedGroupMaps,
        sectionSchemaCoverage,
      });

      const storeResult = storeTelemetryReport({
        shop,
        packet: {
          productId: productSnapshot.id,
          productTitle: productSnapshot.title,
          mode: THEME_READBACK_MODE,
          sectionKey: effectiveSectionKey,
          sectionLabel,
          runIdentity,
          runTimestamp: capturedAt,
          capturedAt,
          fullText,
        },
        uiAudit: uiAuditObj,
        liveState: null,
      });

      if (!storeResult || storeResult.ok !== true) {
        return Response.json(
          {
            intent,
            success: false,
            error:
              storeResult?.message ||
              `Failed to store theme readback report (${storeResult?.code || "unknown_error"}).`,
            storeResult,
            timestamp,
          },
          { status: 400 }
        );
      }

      return Response.json({
        intent,
        success: true,
        message: `Published Theme Readback snapshot (${storeResult.report?.reportId}) for ${productSnapshot.title}.`,
        readbackMeta: {
          reportId: storeResult.report?.reportId || null,
          mode: THEME_READBACK_MODE,
          capturedAt,
          expiresAt: storeResult.report?.expiresAt || null,
          themeId: theme.id,
          themeName: theme.name,
          productId: productSnapshot.id,
          productTitle: productSnapshot.title,
          productStatus: productSnapshot.status,
          selectedFile: effectiveSectionKey,
          hasUnsavedAppDraft,
          reportChunkCount: storeResult.report?.reportChunkCount ?? null,
          uiAuditChunkCount: storeResult.report?.uiAuditChunkCount ?? null,
          isCoverageComplete:
            productSnapshot.coverageCompleteness.isComplete && sectionSchemaCoverage.isComplete,
          deduplicated: Boolean(storeResult.deduplicated),
        },
        timestamp,
      });
    }

    if (intent === "saveAsset" || intent === "createAsset" || intent === "duplicateAsset") {
      const content = formData.get("content");
      
      try {
        const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
          method: "PUT",
          headers: { 
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            asset: { key: assetKey, value: content },
          }),
        });
        
        if (!response.ok) {
          const errorBody = await response.text();
          console.error(`Shopify API Asset Save Error [${response.status}] for ${assetKey}:`, errorBody);
          
          let errorMessage = `Failed to save asset: ${assetKey}. Status: ${response.status}`;
          try {
            const parsedError = JSON.parse(errorBody);
            if (parsedError.errors) {
              errorMessage = typeof parsedError.errors === 'string' 
                ? parsedError.errors 
                : JSON.stringify(parsedError.errors);
            }
          } catch (e) {
            errorMessage = `${errorMessage} - ${errorBody}`;
          }
          
          return Response.json({ intent, assetKey, success: false, error: errorMessage, timestamp });
        }
        
        return Response.json({ intent, assetKey, content, success: true, message: `Saved ${assetKey} successfully.`, timestamp });
      } catch (fetchErr) {
        console.error("Fetch Exception during asset save:", fetchErr);
        return Response.json({ intent, assetKey, success: false, error: fetchErr.message, timestamp });
      }
    }

    if (intent === "deleteAsset") {
      const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Delete Asset Error:", errorBody);
        return Response.json({ intent, assetKey, success: false, error: `Failed to delete asset: ${errorBody}`, timestamp });
      }
      
      return Response.json({ intent, assetKey, success: true, message: `Deleted ${assetKey} successfully.`, timestamp });
    }

    if (intent === "renameAsset") {
      let newKey = formData.get("newKey");
      const content = formData.get("content");

      if (!newKey.includes('/')) {
        const folder = assetKey.substring(0, assetKey.indexOf('/'));
        newKey = `${folder}/${newKey}`;
      }

      const copyResponse = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          asset: { key: newKey, source_key: assetKey },
        }),
      });

      if (!copyResponse.ok) {
        const errorBody = await copyResponse.text();
        console.error("Rename Copy Error:", errorBody);
        return Response.json({ intent, success: false, error: `Rename copy failed: ${errorBody}`, timestamp });
      }

      const deleteResponse = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!deleteResponse.ok) {
        return Response.json({ intent, success: false, error: `Successfully created ${newKey} but failed to delete original file ${assetKey}.`, timestamp });
      }

      return Response.json({ intent, oldKey: assetKey, assetKey: newKey, content, success: true, message: `Renamed to ${newKey}.`, timestamp });
    }

    if (intent === "populateMosaic") {
      const assetRes = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=templates/index.json`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }
      });
      const assetData = await assetRes.json();
      if (!assetData.asset?.value) return Response.json({ intent, success: false, error: "Could not load templates/index.json", timestamp });

      const templateData = JSON.parse(assetData.asset.value);

      let targetSectionKey = null;
      let targetSection = null;

      for (const [key, section] of Object.entries(templateData.sections)) {
        if (section.type === 'hero-mosaic-panel') {
          targetSectionKey = key;
          targetSection = section;
          break;
        }
      }

      if (!targetSection) {
        return Response.json({ 
          intent, 
          error: "Hero Living Mosaic section not found on homepage template.", 
          timestamp 
        });
      }

      // Converted to native admin.graphql calls
      const collectionsRes = await admin.graphql(`query { collections(first: 50, query: "published_status:published") { edges { node { handle } } } }`);
      const collectionsData = await collectionsRes.json();
      const collections = collectionsData.data.collections.edges.map(e => e.node.handle);

      const pagesRes = await admin.graphql(`query { pages(first: 50, query: "published_status:published") { edges { node { handle } } } }`);
      const pagesData = await pagesRes.json();
      const pages = pagesData.data.pages.edges.map(e => e.node.handle);

      const newBlocks = {};
      const newBlockOrder = [];

      collections.forEach((handle, index) => {
        const blockId = `stone_collection_${index}`;
        newBlocks[blockId] = {
          type: "stone_collection",
          settings: { collection: handle }
        };
        newBlockOrder.push(blockId);
      });

      pages.forEach((handle, index) => {
        const blockId = `story_page_${index}`;
        newBlocks[blockId] = {
          type: "story_page",
          settings: { page: handle }
        };
        newBlockOrder.push(blockId);
      });

      targetSection.blocks = {
        ...targetSection.blocks,
        ...newBlocks
      };
      targetSection.block_order = [
        ...(targetSection.block_order || []),
        ...newBlockOrder
      ];

      templateData.sections[targetSectionKey] = targetSection;

      const saveRes = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({
          asset: {
            key: "templates/index.json",
            value: JSON.stringify(templateData)
          }
        })
      });

      if (!saveRes.ok) {
        const errorBody = await saveRes.text();
        console.error("Populate Mosaic Save Error:", errorBody);
        return Response.json({ intent, success: false, error: `Failed to save populated index.json to theme: ${errorBody}`, timestamp });
      }

      return Response.json({ 
        intent, 
        success: true, 
        message: "Successfully populated the Living Mosaic wall!", 
        timestamp 
      });
    }

    if (intent === "geminiAssist") {
      const content = formData.get("content");
      const instruction = formData.get("instruction");
      const apiKey = process.env.GEMINI_API_KEY;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: `You are a Shopify Liquid and theme architecture expert.\nFile: ${assetKey}\n\nCurrent file content:\n${content}\n\nInstruction: ${instruction}\n\nReturn only the complete modified file content, no explanation.` }] }] }),
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const modifiedContent = data.candidates?.[0]?.content?.parts?.[0]?.text || content;
        return Response.json({ intent, assetKey, modifiedContent, timestamp });
      } catch (error) {
        clearTimeout(timeoutId);
        throw new Error(`Gemini Assist failed: ${error.message}`);
      }
    }

    if (intent === "geminiResearch") {
      const content = formData.get("content");
      const apiKey = process.env.GEMINI_API_KEY;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: `You are a Shopify Liquid and theme architecture expert.\nCatalog all schema settings and blocks in this file: ${assetKey}\n\nFile content:\n${content}\n\nReturn a structured list of all settings IDs, types, labels, and blocks found.` }] }] }),
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const researchContent = data.candidates?.[0]?.content?.parts?.[0]?.text || "No results returned.";
        return Response.json({ intent, assetKey, researchContent, timestamp });
      } catch (error) {
        clearTimeout(timeoutId);
        throw new Error(`Gemini Research failed: ${error.message}`);
      }
    }

    return Response.json({ error: "Invalid intent", timestamp }, { status: 400 });

  } catch (error) {
    console.error("Action error:", error);
    return Response.json({ error: error.message, timestamp }, { status: 500 });
  }
};

// ── REACT COMPONENT ──────────────────────────────────────────────────────────
export default function ThemeEditorTab() {
  const loaderData = useLoaderData() || {};
  const { theme, files = [], products = [], hasMoreProducts = false, error: loaderError } = loaderData;
  
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [localFiles, setLocalFiles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [originalContent, setOriginalContent] = useState("");
  const [currentContent, setCurrentContent] = useState("");
  
  const [showDiff, setShowDiff] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [researchData, setResearchData] = useState("");

  const [selectedProductGid, setSelectedProductGid] = useState("");
  const [customProductGidInput, setCustomProductGidInput] = useState("");
  const [lastReadbackMeta, setLastReadbackMeta] = useState(null);

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("sections");
  const [renameInput, setRenameInput] = useState("");
  const [duplicateInput, setDuplicateInput] = useState("");

  const lastProcessedActionRef = useRef(null);

  const isNavigating = navigation.state !== "idle";
  const hasChanges = currentContent !== originalContent;
  const isSaving = isNavigating && navigation.formData?.get("intent") === "saveAsset";
  const isAssisting = isNavigating && navigation.formData?.get("intent") === "geminiAssist";
  const isResearching = isNavigating && navigation.formData?.get("intent") === "geminiResearch";
  const isPopulating = isNavigating && navigation.formData?.get("intent") === "populateMosaic";
  const isPublishingReadback =
    isNavigating && navigation.formData?.get("intent") === "publishThemeReadback";

  useEffect(() => {
    if (files.length > 0) {
      setLocalFiles(files);
    }
  }, [files]);

  useEffect(() => {
    if (!selectedProductGid && products.length > 0) {
      const draftCandidate = products.find((p) => p.status === "DRAFT") || products[0];
      if (draftCandidate?.id) {
        setSelectedProductGid(draftCandidate.id);
      }
    }
  }, [products, selectedProductGid]);

  useEffect(() => {
    if (actionData) {
      if (actionData.timestamp !== lastProcessedActionRef.current) {
        lastProcessedActionRef.current = actionData.timestamp;

        if (actionData.intent === "fetchAsset") {
          setOriginalContent(actionData.content);
          setCurrentContent(actionData.content);
          setResearchData("");
        } else if (actionData.intent === "publishThemeReadback") {
          if (actionData.success && actionData.readbackMeta) {
            setLastReadbackMeta(actionData.readbackMeta);
            shopify.toast.show(actionData.message || "Theme Readback published to Sidekick.");
          }
        } else if (actionData.success) {
          shopify.toast.show(actionData.message);
          
          if (actionData.intent === "saveAsset") {
            setOriginalContent(actionData.content);
            setShowDiff(false);
          } else if (actionData.intent === "createAsset" || actionData.intent === "duplicateAsset") {
            setSelectedFile(actionData.assetKey);
            setOriginalContent(actionData.content);
            setCurrentContent(actionData.content);
            setIsNewModalOpen(false);
            setIsDuplicateModalOpen(false);
            setNewFileName(""); 
            setDuplicateInput("");
            setLocalFiles((prev) => prev.some((f) => f.key === actionData.assetKey) ? prev : [...prev, { key: actionData.assetKey }]);
          } else if (actionData.intent === "renameAsset") {
            setSelectedFile(actionData.assetKey);
            setOriginalContent(actionData.content);
            setCurrentContent(actionData.content);
            setIsRenameModalOpen(false);
            setRenameInput(""); 
            setLocalFiles((prev) => prev.map((f) => f.key === actionData.oldKey ? { ...f, key: actionData.assetKey } : f));
          } else if (actionData.intent === "deleteAsset") {
            setSelectedFile(null);
            setCurrentContent("");
            setOriginalContent("");
            setIsDeleteModalOpen(false);
            setLocalFiles((prev) => prev.filter((f) => f.key !== actionData.assetKey));
          }
        } else if (actionData.intent === "geminiAssist") {
          setCurrentContent(actionData.modifiedContent);
          setShowDiff(true);
          shopify.toast.show("Gemini modifications applied to editor.");
        } else if (actionData.intent === "geminiResearch") {
          setResearchData(actionData.researchContent);
          shopify.toast.show("Research complete.");
        }
      }
    }
  }, [actionData]);

  const effectiveProductGid = (() => {
    const rawCustom = customProductGidInput.trim();
    if (rawCustom) {
      return rawCustom.startsWith("gid://shopify/Product/")
        ? rawCustom
        : /^\d+$/.test(rawCustom)
          ? `gid://shopify/Product/${rawCustom}`
          : rawCustom;
    }
    return selectedProductGid;
  })();

  const handleSelectFile = useCallback((key) => {
    setSelectedFile(key);
    submit({ intent: "fetchAsset", assetKey: key }, { method: "post" });
  }, [submit]);

  const handleSave = useCallback(() => {
    if (!selectedFile) return;
    submit({ intent: "saveAsset", assetKey: selectedFile, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, currentContent]);

  const handleCreateNew = useCallback(() => {
    const fullKey = `${newFileType}/${newFileName}.liquid`;
    submit({ intent: "createAsset", assetKey: fullKey, content: "" }, { method: "post" });
  }, [submit, newFileType, newFileName]);

  const handleRename = useCallback(() => {
    submit({ intent: "renameAsset", assetKey: selectedFile, newKey: renameInput, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, renameInput, currentContent]);

  const handleDelete = useCallback(() => {
    submit({ intent: "deleteAsset", assetKey: selectedFile }, { method: "post" });
  }, [submit, selectedFile]);

  const handleDuplicate = useCallback(() => {
    submit({ intent: "duplicateAsset", assetKey: duplicateInput, content: currentContent }, { method: "post" });
  }, [submit, duplicateInput, currentContent]);

  const handleDiscard = useCallback(() => {
    setCurrentContent(originalContent);
  }, [originalContent]);

  const handleGeminiAssist = useCallback(() => {
    if (!instruction.trim()) {
      shopify.toast.show("Please enter an instruction for Gemini.");
      return;
    }
    submit({ intent: "geminiAssist", assetKey: selectedFile, content: currentContent, instruction }, { method: "post" });
  }, [submit, selectedFile, currentContent, instruction]);

  const handleGeminiResearch = useCallback(() => {
    submit({ intent: "geminiResearch", assetKey: selectedFile, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, currentContent]);

  const handlePopulateMosaic = useCallback(() => {
    submit({ intent: "populateMosaic" }, { method: "post" });
  }, [submit]);

  const handlePublishThemeReadback = useCallback(() => {
    if (!effectiveProductGid || !PRODUCT_GID_REGEX.test(effectiveProductGid)) {
      shopify.toast.show("Select a valid product or enter a numeric Product ID / GID first.");
      return;
    }
    const payload = {
      intent: "publishThemeReadback",
      productId: effectiveProductGid,
    };
    if (selectedFile) {
      payload.assetKey = selectedFile;
      payload.currentContent = currentContent;
    }
    submit(payload, { method: "post" });
  }, [submit, effectiveProductGid, selectedFile, currentContent]);

  const lineCount = currentContent.split("\n").length;
  const charCount = currentContent.length;
  const liveSchema = parseLiquidSchemaBlock(currentContent).schema;

  const productSelectOptions = [
    ...(products.length === 0 ? [{ label: "No products loaded — enter Product ID on right", value: "" }] : []),
    ...products.map((p) => ({
      label: `[${p.status || "UNKNOWN"}] ${p.title} (${p.id.split("/").pop()})${
        p.templateSuffix ? ` • product.${p.templateSuffix}.json` : ""
      }`,
      value: p.id,
    })),
  ];

  const filteredFiles = localFiles.filter((f) => 
    f.key.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const dynamicFolders = [...new Set(localFiles.map((f) => f.key.split('/')[0]))];

  const visiblePinned = PINNED_FILES.filter((f) => 
    f.toLowerCase().includes(searchQuery.toLowerCase()) && localFiles.some(lf => lf.key === f)
  );

  const renderFileGroup = (folderName) => {
    const folderFiles = filteredFiles.filter((a) => a.key.startsWith(`${folderName}/`) && !PINNED_FILES.includes(a.key));
    
    if (folderFiles.length === 0) return null;

    return (
      <Box paddingBlockEnd="400" key={folderName}>
        <Text variant="headingSm" as="h6" fontWeight="bold">{folderName.toUpperCase()}</Text>
        <List type="bullet">
          {folderFiles.map((file) => (
            <List.Item key={file.key}>
              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                <Button 
                  variant="plain" 
                  onClick={() => handleSelectFile(file.key)} 
                  textAlign="left"
                  accessibilityLabel={`Open file ${file.key}`}
                >
                  {file.key.replace(`${folderName}/`, "")}
                </Button>
              </div>
            </List.Item>
          ))}
        </List>
      </Box>
    );
  };

  return (
    <Page
      title={theme ? `Theme Editor: ${theme.name}` : "Theme Editor"}
      fullWidth
      backAction={{ content: "Home", onAction: () => navigate("/app") }}
    >
      {loaderError && <Banner tone="critical">{loaderError}</Banner>}
      
      {actionData?.error && !actionData?.debugTypes && (
        <Box paddingBlockEnd="400">
          <Banner tone="critical">{actionData.error}</Banner>
        </Box>
      )}

      {actionData?.intent === "populateMosaic" && actionData?.success && (
        <Box paddingBlockEnd="400">
          <Banner tone="success" title="Success">
            {actionData.message}
          </Banner>
        </Box>
      )}

      {/* MODALS */}
      {isNewModalOpen && (
        <Modal
          open={true}
          onClose={() => setIsNewModalOpen(false)}
          title="Create New File"
          primaryAction={{ content: "Create", onAction: handleCreateNew, loading: isNavigating, accessibilityLabel: "Confirm create new file" }}
          secondaryActions={[{ content: "Cancel", onAction: () => setIsNewModalOpen(false), accessibilityLabel: "Cancel create new file" }]}
        >
          <Modal.Section>
            <FormLayout>
              <div style={{ minHeight: "48px", display: "flex", width: "100%", alignItems: "center" }}>
                <Select
                  label="Folder"
                  options={[
                    { label: "Sections", value: "sections" },
                    { label: "Snippets", value: "snippets" },
                    { label: "Templates", value: "templates" },
                    { label: "Assets", value: "assets" }
                  ]}
                  value={newFileType}
                  onChange={setNewFileType}
                />
              </div>
              <div style={{ minHeight: "48px", display: "flex", width: "100%", alignItems: "center" }}>
                <TextField
                  label="Filename (without extension)"
                  value={newFileName}
                  onChange={setNewFileName}
                  autoComplete="off"
                  accessibilityLabel="New filename input"
                />
              </div>
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}

      {isRenameModalOpen && (
        <Modal
          open={true}
          onClose={() => setIsRenameModalOpen(false)}
          title="Rename File"
          primaryAction={{ content: "Rename", onAction: handleRename, loading: isNavigating, accessibilityLabel: "Confirm rename file" }}
          secondaryActions={[{ content: "Cancel", onAction: () => setIsRenameModalOpen(false), accessibilityLabel: "Cancel rename file" }]}
        >
          <Modal.Section>
            <div style={{ minHeight: "48px", display: "flex", width: "100%", alignItems: "center" }}>
              <TextField
                label="New File Path (e.g., snippets/new-name.liquid)"
                value={renameInput}
                onChange={setRenameInput}
                autoComplete="off"
                accessibilityLabel="Rename file path input"
              />
            </div>
          </Modal.Section>
        </Modal>
      )}

      {isDeleteModalOpen && (
        <Modal
          open={true}
          onClose={() => setIsDeleteModalOpen(false)}
          title="Delete File"
          primaryAction={{ content: "Delete", onAction: handleDelete, destructive: true, loading: isNavigating, accessibilityLabel: "Confirm delete file" }}
          secondaryActions={[{ content: "Cancel", onAction: () => setIsDeleteModalOpen(false), accessibilityLabel: "Cancel delete file" }]}
        >
          <Modal.Section>
            <Text as="p">Are you sure you want to delete {selectedFile}? This cannot be undone.</Text>
          </Modal.Section>
        </Modal>
      )}

      {isDuplicateModalOpen && (
        <Modal
          open={true}
          onClose={() => setIsDuplicateModalOpen(false)}
          title="Duplicate File"
          primaryAction={{ content: "Duplicate", onAction: handleDuplicate, loading: isNavigating, accessibilityLabel: "Confirm duplicate file" }}
          secondaryActions={[{ content: "Cancel", onAction: () => setIsDuplicateModalOpen(false), accessibilityLabel: "Cancel duplicate file" }]}
        >
          <Modal.Section>
            <div style={{ minHeight: "48px", display: "flex", width: "100%", alignItems: "center" }}>
              <TextField
                label="New File Path (e.g., sections/copy.liquid)"
                value={duplicateInput}
                onChange={setDuplicateInput}
                autoComplete="off"
                accessibilityLabel="Duplicate file path input"
              />
            </div>
          </Modal.Section>
        </Modal>
      )}

      {/* SIDEKICK STRUCTURED THEME READBACK PANEL */}
      <Box paddingBlockEnd="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="100">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingMd" as="h2">Sidekick Theme &amp; Product Structured Readback</Text>
                  <Badge tone="info">Read-Only Snapshot (MAIN Theme)</Badge>
                  {hasChanges && <Badge tone="warning">Includes Unsaved App Draft</Badge>}
                </InlineStack>
                <Text as="p" tone="subdued">
                  Publishes a point-in-time read-only snapshot (mode=&quot;theme_editor_readback&quot;) for the active MAIN theme binding theme identity, shared shell groups, product template section/block source order, section schemas/options/conditions, dynamic expressions, and genuine product values. Keeps saved theme source, this app&apos;s draft buffer, and native Shopify Customizer unsaved state (not captured by this route&apos;s current reads; unknown unless supplied through a supported source) strictly separate.
                </Text>
              </BlockStack>
              <div style={{ display: "inline-flex", minHeight: "48px", alignItems: "stretch" }}>
                <Button
                  variant="primary"
                  size="large"
                  loading={isPublishingReadback}
                  disabled={!effectiveProductGid || !PRODUCT_GID_REGEX.test(effectiveProductGid)}
                  onClick={handlePublishThemeReadback}
                  accessibilityLabel="Publish structured theme and product readback snapshot to Sidekick"
                >
                  Publish Theme Readback to Sidekick
                </Button>
              </div>
            </InlineStack>

            <InlineStack gap="300" wrap={true} blockAlign="end">
              <Box minWidth="320px" width="55%">
                <Select
                  label={
                    hasMoreProducts
                      ? `Target Product for Readback (Latest ${products.length} loaded — use GID override for older)`
                      : "Target Product for Readback (Draft or Active)"
                  }
                  options={productSelectOptions}
                  value={selectedProductGid}
                  onChange={(val) => {
                    setSelectedProductGid(val);
                    setCustomProductGidInput("");
                  }}
                />
              </Box>
              <Box minWidth="260px" width="40%">
                <TextField
                  label="Or Explicit Product ID / GID Override"
                  placeholder="e.g. gid://shopify/Product/123456789"
                  value={customProductGidInput}
                  onChange={setCustomProductGidInput}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setCustomProductGidInput("")}
                  accessibilityLabel="Explicit Shopify Product GID override"
                />
              </Box>
            </InlineStack>

            {lastReadbackMeta && (
              <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                <BlockStack gap="100">
                  <InlineStack gap="200" wrap={true} blockAlign="center">
                    <Badge tone="success">Published</Badge>
                    <Text as="span" fontWeight="bold">Report ID: {lastReadbackMeta.reportId}</Text>
                    <Badge>{lastReadbackMeta.mode}</Badge>
                    <Badge tone="info">MAIN Theme {lastReadbackMeta.themeId}</Badge>
                    <Badge tone={lastReadbackMeta.hasUnsavedAppDraft ? "warning" : "success"}>
                      {lastReadbackMeta.hasUnsavedAppDraft ? "Saved + App Draft" : "Saved Source Only"}
                    </Badge>
                    <Badge tone={lastReadbackMeta.isCoverageComplete ? "info" : "warning"}>
                      {lastReadbackMeta.isCoverageComplete ? "Full CoverageWithinCaps" : "Capped Partial Coverage"}
                    </Badge>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Product: {lastReadbackMeta.productTitle} ({lastReadbackMeta.productId} • {lastReadbackMeta.productStatus}) | Inspected File: {lastReadbackMeta.selectedFile} | Captured: {lastReadbackMeta.capturedAt} | Chunks: {lastReadbackMeta.reportChunkCount} report / {lastReadbackMeta.uiAuditChunkCount} ui_audit
                  </Text>
                </BlockStack>
              </Box>
            )}
          </BlockStack>
        </Card>
      </Box>

      {/* AUTOMATION HEADER */}
      <Box paddingBlockEnd="400">
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="200">
              <Text variant="headingMd" as="h2">Living Mosaic Automation</Text>
              <Text as="p" tone="subdued">Automatically pull all published collections and pages into the homepage hero section.</Text>
            </BlockStack>
            
            <div style={{ display: 'inline-flex', minHeight: '48px', alignItems: 'stretch' }}>
              <Button
                tone="success"
                variant="primary"
                size="large"
                loading={isPopulating}
                onClick={handlePopulateMosaic}
                accessibilityLabel="Populate Living Mosaic hero section with all collections and story pages"
              >
                Populate Living Mosaic
              </Button>
            </div>
          </InlineStack>
        </Card>
      </Box>

      {/* DUAL PANE EDITOR */}
      <Layout>
        <Layout.Section variant="oneThird">
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Live File Tree</Text>
                <div style={{ minHeight: "48px", display: "flex", width: "100%" }}>
                  <TextField
                    labelHidden
                    label="Search files"
                    placeholder="Filter files by name..."
                    value={searchQuery}
                    onChange={setSearchQuery}
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => setSearchQuery("")}
                    accessibilityLabel="Search files filter"
                  />
                </div>
              </BlockStack>
            </Box>
            <Scrollable style={{ height: "75vh" }} focusable>
              <Box padding="400">
                {visiblePinned.length > 0 && (
                  <Box paddingBlockEnd="400">
                    <Text variant="headingSm" as="h6" fontWeight="bold">PINNED QUICK-ACCESS</Text>
                    <List type="bullet">
                      {visiblePinned.map((fileKey) => (
                        <List.Item key={fileKey}>
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button 
                              variant="plain" 
                              onClick={() => handleSelectFile(fileKey)} 
                              textAlign="left"
                              accessibilityLabel={`Open pinned file ${fileKey}`}
                            >
                              <Text fontWeight="bold">{fileKey}</Text>
                            </Button>
                          </div>
                        </List.Item>
                      ))}
                    </List>
                  </Box>
                )}
                <Divider />
                <Box paddingBlockStart="400">
                  {dynamicFolders.map((folder) => renderFileGroup(folder))}
                </Box>
              </Box>
            </Scrollable>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {selectedFile ? (
              <BlockStack>
                <Box padding="400" borderBottom="025" borderColor="border">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2">{selectedFile}</Text>
                        <InlineStack gap="300">
                          <Badge tone="info">{lineCount} Lines</Badge>
                          <Badge>{charCount} Characters</Badge>
                        </InlineStack>
                      </BlockStack>
                      <InlineStack gap="300">
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button 
                            onClick={() => setShowDiff(!showDiff)} 
                            size="large"
                            accessibilityLabel="Toggle Diff View"
                          >
                            {showDiff ? "Hide Diff" : "Show Diff"}
                          </Button>
                        </div>
                        <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                          <Button 
                            variant="primary" 
                            onClick={handleSave} 
                            loading={isSaving} 
                            disabled={!hasChanges}
                            size="large"
                            accessibilityLabel="Save changes to Theme"
                          >
                            SAVE TO THEME
                          </Button>
                        </div>
                      </InlineStack>
                    </InlineStack>

                    <ButtonGroup segmented>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={() => setIsNewModalOpen(true)} accessibilityLabel="Create a new file">
                          New File
                        </Button>
                      </div>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={handleSave} disabled={!hasChanges} loading={isSaving} accessibilityLabel="Save current file">
                          Save File
                        </Button>
                      </div>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={() => { setRenameInput(selectedFile); setIsRenameModalOpen(true); }} accessibilityLabel="Rename current file">
                          Rename File
                        </Button>
                      </div>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={() => setIsDeleteModalOpen(true)} tone="critical" accessibilityLabel="Delete current file">
                          Delete File
                        </Button>
                      </div>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={() => { setDuplicateInput(selectedFile.replace('.liquid', '-copy.liquid')); setIsDuplicateModalOpen(true); }} accessibilityLabel="Duplicate current file">
                          Duplicate File
                        </Button>
                      </div>
                      <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                        <Button size="large" onClick={handleDiscard} disabled={!hasChanges} accessibilityLabel="Discard unsaved changes">
                          Discard Changes
                        </Button>
                      </div>
                    </ButtonGroup>
                  </BlockStack>
                </Box>

                <Tabs
                  tabs={[
                    { id: "editor", content: "Editor", accessibilityLabel: "Editor Tab" }, 
                    { id: "research", content: "Research", accessibilityLabel: "Research Tab" },
                    { id: "schema", content: "Live Schema", accessibilityLabel: "Schema Tab" }
                  ]}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                  fitted
                >
                  <Box padding="400">
                    {selectedTab === 0 && (
                      <BlockStack gap="400">
                        <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Gemini Assist (gemini-2.5-pro)</Text>
                            <InlineStack gap="300" wrap={false} blockAlign="center">
                              <Box width="100%">
                                <div style={{ minHeight: "48px", display: "flex", width: "100%" }}>
                                  <TextField
                                    labelHidden
                                    label="Instruction for Gemini"
                                    value={instruction}
                                    onChange={setInstruction}
                                    placeholder="e.g. 'Add a new schema setting for background color with id custom_bg'"
                                    autoComplete="off"
                                    accessibilityLabel="Instruction input for Gemini Assist"
                                  />
                                </div>
                              </Box>
                              <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                                <Button onClick={handleGeminiAssist} loading={isAssisting} tone="success" size="large" accessibilityLabel="Send instruction to Gemini">
                                  Modify Code
                                </Button>
                              </div>
                            </InlineStack>
                          </BlockStack>
                        </Box>

                        {showDiff ? (
                          <InlineStack gap="400" wrap={false} align="start">
                            <Box width="50%">
                              <Text fontWeight="bold">Original Content</Text>
                              <Box paddingBlockStart="200">
                                <div style={{ minHeight: "48px", display: "flex", width: "100%" }}>
                                  <TextField labelHidden label="Original file content" value={originalContent} multiline={25} monospaced autoComplete="off" readOnly accessibilityLabel="Original read-only content" />
                                </div>
                              </Box>
                            </Box>
                            <Box width="50%">
                              <Text fontWeight="bold">Modified Content</Text>
                              <Box paddingBlockStart="200">
                                <div style={{ minHeight: "48px", display: "flex", width: "100%" }}>
                                  <TextField labelHidden label="Modified file content" value={currentContent} onChange={setCurrentContent} multiline={25} monospaced autoComplete="off" accessibilityLabel="Editable modified content" />
                                </div>
                              </Box>
                            </Box>
                          </InlineStack>
                        ) : (
                          <div style={{ minHeight: "48px", display: "flex", width: "100%" }}>
                            <TextField labelHidden label="Code Editor" value={currentContent} onChange={setCurrentContent} multiline={30} monospaced autoComplete="off" disabled={isNavigating} accessibilityLabel="Main code editor" />
                          </div>
                        )}
                      </BlockStack>
                    )}

                    {selectedTab === 1 && (
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingMd" as="h3">Prestige Schema Cataloger</Text>
                          <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                            <Button onClick={handleGeminiResearch} loading={isResearching} size="large" accessibilityLabel="Run schema analysis using Gemini">
                              Run Schema Analysis
                            </Button>
                          </div>
                        </InlineStack>
                        <Divider />
                        {researchData ? (
                          <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                            <Text as="pre" variant="bodyMd" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {researchData}
                            </Text>
                          </Box>
                        ) : (
                          <Box padding="800">
                            <Text alignment="center" tone="subdued">
                              Click "Run Schema Analysis" to have Gemini map all settings and blocks in {selectedFile}.
                            </Text>
                          </Box>
                        )}
                      </BlockStack>
                    )}

                    {selectedTab === 2 && (
                      <BlockStack gap="400">
                        <Text variant="headingMd" as="h3">Live Extracted Section Schema</Text>
                        <Divider />
                        {liveSchema ? (
                          <BlockStack gap="400">
                            <Text variant="headingLg" as="h4">{liveSchema.name || "Unnamed Section"}</Text>
                            {liveSchema.settings && liveSchema.settings.length > 0 ? (
                              <BlockStack gap="300">
                                <Text variant="headingSm" as="h5">Settings</Text>
                                {liveSchema.settings.map((setting, idx) => (
                                  <Box key={idx} padding="300" background="bg-surface-secondary" borderRadius="100">
                                    <InlineStack align="space-between">
                                      <Text fontWeight="bold">{setting.label || setting.id || "Unnamed Setting"}</Text>
                                      <Badge tone="info">{setting.type}</Badge>
                                    </InlineStack>
                                    <Text tone="subdued">ID: {setting.id}</Text>
                                  </Box>
                                ))}
                              </BlockStack>
                            ) : (
                              <Text tone="subdued">No top-level settings mapped.</Text>
                            )}

                            {liveSchema.blocks && liveSchema.blocks.length > 0 && (
                              <BlockStack gap="300">
                                <Text variant="headingSm" as="h5">Blocks</Text>
                                {liveSchema.blocks.map((block, idx) => (
                                  <Box key={idx} padding="300" background="bg-surface" borderColor="border" borderWidth="025" borderRadius="100">
                                    <BlockStack gap="200">
                                      <InlineStack align="space-between">
                                        <Text fontWeight="bold">{block.name || block.type}</Text>
                                        <Badge tone="success">{block.type}</Badge>
                                      </InlineStack>
                                      {block.settings && block.settings.map((bSet, bIdx) => (
                                        <Box key={bIdx} paddingInlineStart="400">
                                          <InlineStack align="space-between">
                                            <Text tone="subdued">{bSet.label || bSet.id}</Text>
                                            <Text tone="subdued" variant="bodySm">({bSet.type})</Text>
                                          </InlineStack>
                                        </Box>
                                      ))}
                                    </BlockStack>
                                  </Box>
                                ))}
                              </BlockStack>
                            )}
                          </BlockStack>
                        ) : (
                          <Box padding="800">
                            <Text alignment="center" tone="subdued">
                              No valid JSON schema block detected in this file. (Must be a section file with a {'{% schema %}'} tag).
                            </Text>
                          </Box>
                        )}
                      </BlockStack>
                    )}
                  </Box>
                </Tabs>
              </BlockStack>
            ) : (
              <Box padding="800">
                <Text alignment="center" variant="headingLg" tone="subdued">
                  Select a file from the tree to begin editing.
                </Text>
                <Box paddingBlockStart="400" display="flex" justifyContent="center">
                  <div style={{ minHeight: "48px", display: "flex", alignItems: "center" }}>
                    <Button size="large" onClick={() => setIsNewModalOpen(true)} accessibilityLabel="Create new file from empty state">
                      Create New File
                    </Button>
                  </div>
                </Box>
              </Box>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
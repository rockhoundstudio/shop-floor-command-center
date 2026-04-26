import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  Badge,
  FormLayout,
  Banner,
  Select,
  Tooltip,
  Icon,
  Grid,
  Box,
  Popover,
  ActionList,
} from "@shopify/polaris";
import { QuestionCircleIcon, MenuIcon } from "@shopify/polaris-icons";

const TAXONOMY = {
  crystal_system: {
    label: "Crystal Structure",
    namespace: "shopify",
    key: "crystal-system",
    help: "The geometric arrangement of atoms in the mineral",
    metaobjectType: "crystal-system",
  },
  mineral_class: {
    label: "Mineral Class",
    namespace: "shopify",
    key: "mineral-class",
    help: "Scientific classification based on chemical composition",
    metaobjectType: "mineral-class",
  },
  rock_formation: {
    label: "Rock Formation",
    namespace: "shopify",
    key: "rock-formation",
    help: "The geological process that formed this rock",
    metaobjectType: "rock-formation",
  },
  geological_era: {
    label: "Geological Era",
    namespace: "shopify",
    key: "geological-era",
    help: "The time period when this rock was formed",
    metaobjectType: "geological-era",
  },
  rock_composition: {
    label: "Rock Composition",
    namespace: "shopify",
    key: "rock-composition",
    help: "The primary rock or mineral matrix",
    metaobjectType: "rock-composition",
  },
};

const TEXT_FIELDS = [
  { key: "hardness", label: "Hardness", help: "Mohs hardness scale 1 (softest) to 10 (hardest)", placeholder: "e.g. 7, 6.5-7, Mohs scale" },
  { key: "where_found", label: "Where Found", help: "Geographic origin or collection location", placeholder: "e.g. Brazil, Madagascar, Pacific Northwest" },
  { key: "geological_age", label: "Geological Age", help: "Estimated age or geological time period", placeholder: "e.g. 65 million years, Cretaceous period" },
  { key: "character_marks", label: "Character Marks", help: "Natural imperfections, inclusions, or unique features", placeholder: "e.g. Natural inclusion, iron vein, surface scratch" },
  { key: "stone_story", label: "Stone Story", help: "The narrative history or provenance of this stone", placeholder: "e.g. Found near volcanic ridge in Eastern Oregon..." },
  { key: "rescued_by", label: "Rescued By", help: "Who collected or rescued this stone", placeholder: "e.g. Bob, field collected 2023" },
  { key: "origin_location", label: "Origin Location", help: "Specific location where the stone was found", placeholder: "e.g. Yakima Valley, WA" },
];

const STONE_TYPES = [
  "agate","jasper","serpentine","obsidian","quartz","amethyst","chalcedony",
  "petrified wood","opal","turquoise","malachite","azurite","labradorite",
  "moonstone","sunstone","garnet","ruby","sapphire","emerald","topaz",
  "tourmaline","citrine","onyx","carnelian","rhodonite","sodalite","lapis",
  "pyrite","hematite","calcite","fluorite","selenite","gypsum","marble",
  "granite","basalt","rhyolite","andesite","schist","slate","sandstone",
  "limestone","dolomite","chert","flint","pumice","scoria","tuff",
];

const GEM_DATABASE = {
  "agate":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "amethyst":{hardness:"7",crystal_system:"Trigonal",luster:"Vitreous"},
  "jasper":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "obsidian":{hardness:"5-5.5",crystal_system:"Amorphous",luster:"Vitreous"},
  "quartz":{hardness:"7",crystal_system:"Trigonal",luster:"Vitreous"},
  "chalcedony":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "opal":{hardness:"5.5-6.5",crystal_system:"Amorphous",luster:"Vitreous"},
  "turquoise":{hardness:"5-6",crystal_system:"Triclinic",luster:"Waxy"},
  "malachite":{hardness:"3.5-4",crystal_system:"Monoclinic",luster:"Vitreous"},
  "azurite":{hardness:"3.5-4",crystal_system:"Monoclinic",luster:"Vitreous"},
  "labradorite":{hardness:"6-6.5",crystal_system:"Triclinic",luster:"Vitreous"},
  "moonstone":{hardness:"6-6.5",crystal_system:"Monoclinic",luster:"Pearly"},
  "sunstone":{hardness:"6-6.5",crystal_system:"Triclinic",luster:"Vitreous"},
  "garnet":{hardness:"6.5-7.5",crystal_system:"Cubic",luster:"Vitreous"},
  "ruby":{hardness:"9",crystal_system:"Trigonal",luster:"Vitreous"},
  "sapphire":{hardness:"9",crystal_system:"Trigonal",luster:"Vitreous"},
  "emerald":{hardness:"7.5-8",crystal_system:"Hexagonal",luster:"Vitreous"},
  "topaz":{hardness:"8",crystal_system:"Orthorhombic",luster:"Vitreous"},
  "tourmaline":{hardness:"7-7.5",crystal_system:"Trigonal",luster:"Vitreous"},
  "citrine":{hardness:"7",crystal_system:"Trigonal",luster:"Vitreous"},
  "onyx":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "carnelian":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "rhodonite":{hardness:"5.5-6.5",crystal_system:"Triclinic",luster:"Vitreous"},
  "sodalite":{hardness:"5.5-6",crystal_system:"Cubic",luster:"Vitreous"},
  "lapis":{hardness:"5-6",crystal_system:"Cubic",luster:"Waxy"},
  "pyrite":{hardness:"6-6.5",crystal_system:"Cubic",luster:"Metallic"},
  "hematite":{hardness:"5-6",crystal_system:"Trigonal",luster:"Metallic"},
  "calcite":{hardness:"3",crystal_system:"Trigonal",luster:"Vitreous"},
  "fluorite":{hardness:"4",crystal_system:"Cubic",luster:"Vitreous"},
  "selenite":{hardness:"2",crystal_system:"Monoclinic",luster:"Pearly"},
  "serpentine":{hardness:"3-6",crystal_system:"Monoclinic",luster:"Waxy"},
  "petrified wood":{hardness:"6.5-7",crystal_system:"Trigonal",luster:"Waxy"},
  "granite":{hardness:"6-7",crystal_system:"Cubic",luster:"Vitreous"},
  "basalt":{hardness:"5-6",crystal_system:"Amorphous",luster:"Dull"},
  "rhyolite":{hardness:"6-7",crystal_system:"Amorphous",luster:"Waxy"},
  "sandstone":{hardness:"6-7",crystal_system:"Amorphous",luster:"Dull"},
  "marble":{hardness:"3-4",crystal_system:"Trigonal",luster:"Waxy"},
  "slate":{hardness:"3-4",crystal_system:"Monoclinic",luster:"Dull"},
  "flint":{hardness:"7",crystal_system:"Trigonal",luster:"Waxy"},
  "chert":{hardness:"7",crystal_system:"Trigonal",luster:"Waxy"},
  "gypsum":{hardness:"2",crystal_system:"Monoclinic",luster:"Pearly"},
  "dolomite":{hardness:"3.5-4",crystal_system:"Trigonal",luster:"Vitreous"},
  "limestone":{hardness:"3",crystal_system:"Trigonal",luster:"Dull"},
  "andesite":{hardness:"5-6",crystal_system:"Amorphous",luster:"Dull"},
  "schist":{hardness:"4-5",crystal_system:"Monoclinic",luster:"Pearly"},
};

const COLOR_KEYWORDS = ["red","blue","green","purple","yellow","orange","pink","black","white","grey","gray","brown","cream","gold","silver","multicolor","banded","spotted","lavender","violet","teal","indigo","amber","copper","rose","ivory"];

const CUT_KEYWORDS = ["freeform","cabochon","tumbled","raw","rough","polished","slab","sphere","point","tower","cluster","geode","nodule","egg","heart","palm stone","worry stone"];

const CRYSTAL_KEYWORDS = ["cubic","hexagonal","trigonal","monoclinic","triclinic","orthorhombic","tetragonal","amorphous"];

const COLLECTION_GIDS = {
  "The 3,000-Mile Run": "gid://shopify/Collection/452913135867",
  "Richardson's Rock Ranch": "gid://shopify/Collection/452912972027",
  "The Gallery": "gid://shopify/Collection/452886495483",
  "The Yakima Canyon Collection": "gid://shopify/Collection/452884922619",
  "Wearable Art": "gid://shopify/Collection/452823482619",
  "Small Batches / The Vault": "gid://shopify/Collection/452658528507",
  "Touch Stones & Mile Stones": "gid://shopify/Collection/452655775995",
};

const ORIGIN_KEYWORDS = {
  "Yakima Canyon": COLLECTION_GIDS["The Yakima Canyon Collection"],
  "Yakima": COLLECTION_GIDS["The Yakima Canyon Collection"],
  "Richardson": COLLECTION_GIDS["Richardson's Rock Ranch"],
  "Rock Ranch": COLLECTION_GIDS["Richardson's Rock Ranch"],
  "3,000-Mile": COLLECTION_GIDS["The 3,000-Mile Run"],
  "3000 Mile": COLLECTION_GIDS["The 3,000-Mile Run"],
};

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

function parseDescription(text) {
  const result = {};
  const colorMatch = text.match(/colou?r[:\s]+([^\n,.]+)/i);
  if (colorMatch) result.color_pattern = colorMatch[1].trim();
  const sizeMatch = text.match(/(\d+[\d\s.x×*by]+\d+\s*(mm|cm|in|inch)?)/i);
  if (sizeMatch) result.measurements = sizeMatch[1].trim();
  const weightMatch = text.match(/(\d+\.?\d*\s*(g|gram|oz|lb))/i);
  if (weightMatch) result.weight = weightMatch[1].trim();
  const originMatch = text.match(/(found in|origin[:\s]+|from\s+)([^\n,.]+)/i);
  if (originMatch) result.origin_location = originMatch[2].trim();
  const markMatch = text.match(/(inclusion|vein|crack|mark|scratch|pattern)[:\s]+([^\n,.]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();
  return result;
}

function suggestCollections(product, existingCollections) {
  const title = (product.title || "").toLowerCase();
  const desc = (product.description || "").toLowerCase();
  const combined = title + " " + desc;
  const meta = product.metafields || {};
  const tags = (product.tags || []).map((t) => t.toLowerCase());
  const suggestions = [];

  if (tags.includes("sold")) {
    suggestions.push({ name: "Not For Sale", reason: "Tagged as sold" });
  }

  for (const stone of STONE_TYPES) {
    if (title.includes(stone)) {
      const name = stone.charAt(0).toUpperCase() + stone.slice(1);
      suggestions.push({ name, reason: `"${name}" found in title` });
      break;
    }
  }

  const originText = (meta.origin_location || meta.where_found || "").toLowerCase() + " " + combined;
  for (const [keyword, collId] of Object.entries(ORIGIN_KEYWORDS)) {
    if (originText.includes(keyword.toLowerCase())) {
      suggestions.push({ name: keyword, id: collId, reason: `Origin: ${keyword}` });
    }
  }

  if (/pendant|bracelet|ring|wearable|necklace|earring/.test(combined)) {
    suggestions.push({ name: "Wearable Art", id: COLLECTION_GIDS["Wearable Art"], reason: "Wearable keyword found" });
  }

  if (combined.includes("freeform")) {
    suggestions.push({ name: "Freeforms", reason: '"freeform" found in title/description' });
  }

  if (combined.includes("custom cut") || combined.includes("custom-cut")) {
    suggestions.push({ name: "Custom Cuts", reason: '"custom cut" found' });
  }

  if (combined.includes("display")) {
    suggestions.push({ name: "Display", reason: '"display" found' });
  }

  if (/hardware|setting|bezel/.test(combined)) {
    suggestions.push({ name: "Hardware and Settings", reason: "Hardware keyword found" });
  }

  if (meta.stone_story) {
    suggestions.push({ name: "Touch Stones & Mile Stones", id: COLLECTION_GIDS["Touch Stones & Mile Stones"], reason: "Stone story present" });
  }

  return suggestions;
}

function scanProduct(product) {
  const result = {};
  const title = (product.title || "").toLowerCase();
  const desc = (product.description || "").toLowerCase();
  const combined = title + " " + desc;
  const mf = product.metafields || {};
  
  const l1 = {
    hardness: mf.hardness || null,
    origin_location: mf.origin_location || mf.where_found || null,
    color: mf.color_pattern || null,
    cut_shape: mf.cut_shape || null,
    stone_type: mf.stone_type || null,
    crystal_system: mf.crystal_system || null,
  };
  
  const l2 = {};
  if (!l1.stone_type) {
    for (const s of STONE_TYPES) {
      if (new RegExp(`\\b${s}\\b`, 'i').test(combined)) { l2.stone_type = s; break; }
    }
  }
  if (!l1.color) {
    for (const c of COLOR_KEYWORDS) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(combined)) { l2.color = c; break; }
    }
  }
  if (!l1.cut_shape) {
    for (const c of CUT_KEYWORDS) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(combined)) { l2.cut_shape = c; break; }
    }
  }
  if (!l1.origin_location) {
    for (const kw of Object.keys(ORIGIN_KEYWORDS)) {
      if (combined.includes(kw.toLowerCase())) { l2.origin_location = kw; break; }
    }
    if (!l2.origin_location) {
      const originMatch = combined.match(/(?:found in|origin[:\s]+|from\s+)([a-z\s,]{3,30})(?:\.|\n|<|$)/i);
      if (originMatch) l2.origin_location = originMatch[1].trim();
    }
  }
  if (!l1.hardness) {
    const hMatch = combined.match(/(?:hardness|mohs)[\s:]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*|\d+\.?\d*)/i);
    if (hMatch) l2.hardness = hMatch[1].trim();
  }
  if (!l1.crystal_system) {
    for (const c of CRYSTAL_KEYWORDS) {
      if (new RegExp(`\\b${c}\\b`, 'i').test(combined)) { l2.crystal_system = c.charAt(0).toUpperCase()+c.slice(1); break; }
    }
  }
  
  const stoneKey = (l1.stone_type || l2.stone_type || "").toLowerCase();
  const gem = stoneKey ? GEM_DATABASE[stoneKey] : null;
  const l3 = gem ? { hardness: gem.hardness, crystal_system: gem.crystal_system } : {};
  
  const fields = ["stone_type","color","origin_location","cut_shape","hardness","crystal_system"];
  fields.forEach((f) => {
    if (l1[f]) result[f] = { value: l1[f], source: "metafield" };
    else if (l3[f]) result[f] = { value: l3[f], source: "lookup" };
    else if (l2[f]) result[f] = { value: l2[f], source: "parsed" };
    else result[f] = { value: "", source: "manual" };
  });
  
  return result;
}

const SOURCE_BADGE_TONE = { metafield:"info", parsed:"success", lookup:"attention", manual:"warning" };
const SOURCE_BADGE_LABEL = { metafield:"metafield", parsed:"parsed", lookup:"lookup", manual:"⚠️ manual" };
const SCAN_FIELD_LABELS = { stone_type:"Stone Type", color:"Color", origin_location:"Origin", cut_shape:"Cut Shape", hardness:"Hardness", crystal_system:"Crystal System" };

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const [productsRes, collectionsRes, taxonomiesRes] = await Promise.all([
      admin.graphql(`
        query {
          products(first: 100) {
            edges {
              node {
                id
                title
                descriptionHtml
                tags
                featuredImage { url altText }
                metafields(first: 20, namespace: "geology") {
                  edges { node { key value } }
                }
                collections(first: 10) {
                  edges { node { id title } }
                }
              }
            }
          }
        }
      `),
      admin.graphql(`
        query {
          collections(first: 50) {
            edges {
              node { id title handle }
            }
          }
        }
      `),
      admin.graphql(`
        query {
          crystal: metaobjects(type: "crystal-system", first: 50) { edges { node { id handle fields { key value } } } }
          mineral: metaobjects(type: "mineral-class", first: 50) { edges { node { id handle fields { key value } } } }
          rockForm: metaobjects(type: "rock-formation", first: 50) { edges { node { id handle fields { key value } } } }
          geoEra: metaobjects(type: "geological-era", first: 50) { edges { node { id handle fields { key value } } } }
          rockComp: metaobjects(type: "rock-composition", first: 50) { edges { node { id handle fields { key value } } } }
        }
      `)
    ]);

    const productsData = await productsRes.json();
    const collectionsData = await collectionsRes.json();
    const taxonomiesData = await taxonomiesRes.json();

    if (productsData.errors) console.error("🚨 GraphQL Products Error:", JSON.stringify(productsData.errors, null, 2));
    if (collectionsData.errors) console.error("🚨 GraphQL Collections Error:", JSON.stringify(collectionsData.errors, null, 2));
    if (taxonomiesData.errors) console.error("🚨 GraphQL Taxonomies Error:", JSON.stringify(taxonomiesData.errors, null, 2));

    const products = (productsData.data?.products?.edges || []).map(({ node }) => ({
      ...node,
      description: stripHtml(node.descriptionHtml),
      metafields: Object.fromEntries(
        (node.metafields?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      ),
      currentCollections: (node.collections?.edges || []).map(({ node: c }) => ({ id: c.id, title: c.title })),
    }));

    const collections = (collectionsData.data?.collections?.edges || [])
      .map(({ node }) => node)
      .filter((c) => c.handle !== "all-collections" && c.title !== "all collections");

    const parseMetaobjects = (edges) => edges.map(({node}) => {
       const nameField = node.fields.find(f => f.key === 'name');
       const label = nameField ? nameField.value : (node.handle || node.id);
       return { label, value: node.id };
    }).sort((a,b) => a.label.localeCompare(b.label));

    const dynamicTaxonomy = {
       crystal_system: parseMetaobjects(taxonomiesData.data?.crystal?.edges || []),
       mineral_class: parseMetaobjects(taxonomiesData.data?.mineral?.edges || []),
       rock_formation: parseMetaobjects(taxonomiesData.data?.rockForm?.edges || []),
       geological_era: parseMetaobjects(taxonomiesData.data?.geoEra?.edges || []),
       rock_composition: parseMetaobjects(taxonomiesData.data?.rockComp?.edges || []),
    };

    return data({ products, collections, dynamicTaxonomy });

  } catch (error) {
    console.error("🚨 FATAL LOADER ERROR:", error);
    return data({ products: [], collections: [], dynamicTaxonomy: {} });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save" || intent === "bulk") {
    const ids = JSON.parse(formData.get("ids"));
    const metafields = [];
    
    ids.forEach((ownerId) => {
      Object.keys(TAXONOMY).forEach((fieldKey) => {
        const val = formData.get(fieldKey);
        if (val === "") {
          metafields.push({ ownerId, namespace: "shopify", key: TAXONOMY[fieldKey].key, value: "[]", type: "list.metaobject_reference" });
        } else if (val && val !== "__add__") {
          metafields.push({ ownerId, namespace: "shopify", key: TAXONOMY[fieldKey].key, value: `["${val}"]`, type: "list.metaobject_reference" });
        }
      });
      TEXT_FIELDS.forEach(({ key }) => {
        const val = formData.get(key);
        if (val === "") {
          metafields.push({ ownerId, namespace: "geology", key, value: "", type: "single_line_text_field" });
        } else if (val) {
          metafields.push({ ownerId, namespace: "geology", key, value: val, type: "single_line_text_field" });
        }
      });
    });
    
    const batchSize = 6;
    for (let i = 0; i < metafields.length; i += batchSize) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }
      `, { variables: { metafields: metafields.slice(i, i + batchSize) } });
    }
    return data({ ok: true, intent });
  }

  if (intent === "addTaxonomy") {
    const metaobjectType = formData.get("metaobjectType");
    const name = formData.get("name");
    const result = await admin.graphql(`
      mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject { id fields { key value } }
          userErrors { field message }
        }
      }
    `, { variables: { metaobject: { type: metaobjectType, fields: [{ key: "name", value: name }] } } });
    const jsonRes = await result.json();
    const newObj = jsonRes.data?.metaobjectCreate?.metaobject;
    return data({ ok: true, intent: "addTaxonomy", newId: newObj?.id, name, metaobjectType });
  }

  if (intent === "inject") {
    const payload = formData.get("payload");
    const lines = payload.split("\n").filter(Boolean);
    const metafields = [];
    for (const line of lines) {
      try { metafields.push(JSON.parse(line)); } catch {}
    }
    let injected = 0;
    for (let i = 0; i < metafields.length; i += 2) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }
      `, { variables: { metafields: metafields.slice(i, i + 2) } });
      injected += metafields.slice(i, i + 2).length;
    }
    return data({ ok: true, injected });
  }

  if (intent === "createCollection") {
    const title = formData.get("title");
    const result = await admin.graphql(`
      mutation collectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { input: { title } } });
    const jsonRes = await result.json();
    const errors = jsonRes.data?.collectionCreate?.userErrors;
    if (errors?.length) return data({ ok: false, intent, error: errors[0].message });
    return data({ ok: true, intent, collection: jsonRes.data?.collectionCreate?.collection });
  }

  if (intent === "editCollection") {
    const id = formData.get("id");
    const title = formData.get("title");
    const result = await admin.graphql(`
      mutation collectionUpdate($input: CollectionInput!) {
        collectionUpdate(input: $input) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { input: { id, title } } });
    const jsonRes = await result.json();
    const errors = jsonRes.data?.collectionUpdate?.userErrors;
    if (errors?.length) return data({ ok: false, intent, error: errors[0].message });
    return data({ ok: true, intent });
  }

  if (intent === "deleteCollection") {
    const id = formData.get("id");
    const result = await admin.graphql(`
      mutation collectionDelete($input: CollectionDeleteInput!) {
        collectionDelete(input: $input) {
          deletedCollectionId
          userErrors { field message }
        }
      }
    `, { variables: { input: { id } } });
    const jsonRes = await result.json();
    const errors = jsonRes.data?.collectionDelete?.userErrors;
    if (errors?.length) return data({ ok: false, intent, error: errors[0].message });
    return data({ ok: true, intent, deletedId: id });
  }

  if (intent === "assignCollection") {
    const productId = formData.get("productId");
    const collectionId = formData.get("collectionId");
    const result = await admin.graphql(`
      mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) {
        collectionAddProducts(id: $id, productIds: $productIds) {
          collection { id title }
          userErrors { field message }
        }
      }
    `, { variables: { id: collectionId, productIds: [productId] } });
    const jsonRes = await result.json();
    const errors = jsonRes.data?.collectionAddProducts?.userErrors;
    if (errors?.length) return data({ ok: false, intent, error: errors[0].message });
    return data({ ok: true, intent });
  }

  return data({ ok: false });
};

function LabelWithHelp({ label, help }) {
  return (
    <InlineStack gap="100" blockAlign="center">
      <Text>{label}</Text>
      <Tooltip content={help}>
        <Icon source={QuestionCircleIcon} tone="subdued" />
      </Tooltip>
    </InlineStack>
  );
}

function completeness(metafields) {
  const filled = TEXT_FIELDS.filter((f) => metafields[f.key]).length;
  if (filled === TEXT_FIELDS.length) return "success";
  if (filled === 0) return "critical";
  return "warning";
}

function completenessLabel(metafields) {
  const filled = TEXT_FIELDS.filter((f) => metafields[f.key]).length;
  if (filled === TEXT_FIELDS.length) return "Complete";
  if (filled === 0) return "Empty";
  return `${filled}/${TEXT_FIELDS.length} fields`;
}

function ScanPreviewCard({ product, scanResult, onConfirm, onDismiss, loading }) {
  const fields = ["stone_type","color","origin_location","cut_shape","hardness","crystal_system"];
  const hasManual = fields.some((f) => scanResult[f]?.source === "manual");
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack gap="300" blockAlign="center">
          <img src={product.featuredImage?.url || ""} alt={product.title} style={{width:"56px",height:"56px",objectFit:"cover",borderRadius:"6px"}} />
          <BlockStack gap="100">
            <Text variant="headingMd">{product.title}</Text>
            <Text variant="bodySm" tone="subdued">Scan preview — review before writing to Shopify</Text>
          </BlockStack>
        </InlineStack>
        {hasManual && (
          <Banner tone="warning">Some fields could not be detected (⚠️ manual). You can still inject — fill them in Edit Stone afterward.</Banner>
        )}
        <div style={{display:"grid",gridTemplateColumns:"160px 1fr 120px",gap:"6px 12px",alignItems:"center"}}>
          <Text variant="bodySm" fontWeight="semibold" tone="subdued">Field</Text>
          <Text variant="bodySm" fontWeight="semibold" tone="subdued">Value</Text>
          <Text variant="bodySm" fontWeight="semibold" tone="subdued">Source</Text>
          {fields.map((f) => {
            const { value, source } = scanResult[f];
            return (
              <>
                <Text key={f+"_l"} variant="bodySm" fontWeight="semibold">{SCAN_FIELD_LABELS[f]}</Text>
                <Text key={f+"_v"} variant="bodySm">{value || "—"}</Text>
                <span key={f+"_b"}><Badge tone={SOURCE_BADGE_TONE[source]}>{SOURCE_BADGE_LABEL[source]}</Badge></span>
              </>
            );
          })}
        </div>
        <InlineStack gap="300">
          <Button variant="primary" onClick={onConfirm} loading={loading}>Inject All Fields</Button>
          <Button onClick={onDismiss}>Dismiss</Button>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

function MindatVerifier({ product }) {
  const [status, setStatus] = useState(null);
  const [results, setResults] = useState(null);
  const COMPARE_FIELDS = [
    { key: "hardness", mindatKey: "hardness", label: "Hardness" },
    { key: "where_found", mindatKey: "localities", label: "Where Found" },
    { key: "geological_age", mindatKey: "geological_age", label: "Geological Age" },
  ];
  const verify = async () => {
    setStatus("loading");
    try {
      const res = await fetch(
        `https://api.mindat.org/minerals/?name=${encodeURIComponent(product.title)}&format=json`,
        { headers: { Authorization: "Token YOUR_MINDAT_API_TOKEN" } }
      );
      const resData = await res.json();
      const mineral = resData.results?.[0];
      if (!mineral) { setStatus("notfound"); return; }
      const compared = COMPARE_FIELDS.map(({ key, mindatKey, label }) => ({
        label,
        store: product.metafields[key] || "—",
        mindat: mineral[mindatKey] || "—",
        match: (product.metafields[key] || "").toLowerCase().trim() === (mineral[mindatKey] || "").toLowerCase().trim(),
      }));
      setResults(compared);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };
  return (
    <BlockStack gap="200">
      <Button size="slim" onClick={verify} loading={status === "loading"}>🔍 Verify vs Mindat</Button>
      {status === "notfound" && <Text tone="caution">Not found on Mindat.</Text>}
      {status === "error" && <Text tone="critical">Lookup failed — check API token.</Text>}
      {status === "done" && results && (
        <BlockStack gap="100">
          {results.map((r) => (
            <InlineStack key={r.label} align="space-between">
              <Text variant="bodySm">{r.label}</Text>
              <Text variant="bodySm" tone={r.match ? "success" : "critical"}>
                {r.match ? "✓" : "✗"} Store: {r.store} | Mindat: {r.mindat}
              </Text>
            </InlineStack>
          ))}
        </BlockStack>
      )}
    </BlockStack>
  );
}

function ProductCollectionCard({ product, collections }) {
  const fetcher = useFetcher(); 
  const [manualAssign, setManualAssign] = useState("");

  const handleAssign = (productId, collectionId) => {
    if (!collectionId) return;
    const fd = new FormData();
    fd.append("intent", "assignCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post" });
  };

  const suggestions = suggestCollections(product, collections);
  const currentNames = product.currentCollections.map((c) => c.title).join(", ") || "None";

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="center">
          <img
            src={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
            alt={product.title}
            style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px" }}
          />
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
            <Text variant="bodySm" tone="subdued">Currently in: {currentNames}</Text>
          </BlockStack>
        </InlineStack>

        {suggestions.length > 0 && (
          <BlockStack gap="100">
            <Text variant="bodySm" fontWeight="semibold">Suggested:</Text>
            {suggestions.map((s, i) => {
              const targetCollectionId = s.id || collections.find((c) => c.title === s.name)?.id;
              const isAlreadyAssigned = product.currentCollections.some(c => c.id === targetCollectionId);

              return (
                <InlineStack key={i} gap="200" blockAlign="center">
                  <Badge tone="info">{s.name}</Badge>
                  <Text variant="bodySm" tone="subdued">{s.reason}</Text>
                  {targetCollectionId && (
                    isAlreadyAssigned ? (
                      <Badge tone="success">Already Assigned</Badge>
                    ) : (
                      <Button
                        size="slim"
                        onClick={() => handleAssign(product.id, targetCollectionId)}
                        loading={fetcher.state === "submitting"}
                        variant="primary"
                        tone="success"
                      >
                        Assign
                      </Button>
                    )
                  )}
                </InlineStack>
              );
            })}
          </BlockStack>
        )}

        {suggestions.length === 0 && (
          <Text variant="bodySm" tone="caution">No auto-suggestion — use manual assign below.</Text>
        )}

        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <Select
              label="Manual assign"
              options={[
                { label: "-- Pick a collection --", value: "" },
                ...collections.map((c) => ({ label: c.title, value: c.id })),
              ]}
              value={manualAssign}
              onChange={setManualAssign}
            />
          </div>
          <Button
            variant="primary"
            disabled={!manualAssign}
            onClick={() => handleAssign(product.id, manualAssign)}
            loading={fetcher.state === "submitting"}
          >
            Assign
          </Button>
        </InlineStack>

        {fetcher.data?.ok && fetcher.data?.intent === "assignCollection" && (
          <Banner tone="success">Assigned successfully!</Banner>
        )}
        {fetcher.data?.ok === false && fetcher.data?.intent === "assignCollection" && (
          <Banner tone="critical">{fetcher.data.error || "Assignment failed."}</Banner>
        )}
      </BlockStack>
    </Card>
  );
}

function CollectionsTab({ products, collections, fetcher }) {
  const [newCollTitle, setNewCollTitle] = useState("");
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleCreate = () => {
    if (!newCollTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "createCollection");
    fd.append("title", newCollTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setNewCollTitle("");
  };

  const handleEdit = (id) => {
    if (!editTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "editCollection");
    fd.append("id", id);
    fd.append("title", editTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setEditId(null);
    setEditTitle("");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.append("intent", "deleteCollection");
    fd.append("id", deleteTarget.id);
    fetcher.submit(fd, { method: "post" });
    setDeleteTarget(null);
  };

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">➕ Create New Collection</Text>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flex: 1 }}>
              <TextField
                label="Collection name"
                value={newCollTitle}
                onChange={setNewCollTitle}
                placeholder="e.g. Jasper, Freeforms, Display..."
                autoComplete="off"
              />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={!newCollTitle.trim()}>
              Create
            </Button>
          </InlineStack>
          {fetcher.data?.ok && fetcher.data?.intent === "createCollection" && (
            <Banner tone="success">Collection created!</Banner>
          )}
          {fetcher.data?.ok === false && fetcher.data?.intent === "createCollection" && (
            <Banner tone="critical">{fetcher.data.error || "Could not create collection."}</Banner>
          )}
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">🗂️ Existing Collections</Text>
          {collections.map((c) => (
            <InlineStack key={c.id} align="space-between" blockAlign="center" gap="300">
              {editId === c.id ? (
                <>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      value={editTitle}
                      onChange={setEditTitle}
                      autoComplete="off"
                    />
                  </div>
                  <Button variant="primary" onClick={() => handleEdit(c.id)}>Save</Button>
                  <Button onClick={() => setEditId(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Text variant="bodyMd">{c.title}</Text>
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => { setEditId(c.id); setEditTitle(c.title); }}>Edit</Button>
                    <Button size="slim" tone="critical" onClick={() => setDeleteTarget(c)}>Delete</Button>
                  </InlineStack>
                </>
              )}
            </InlineStack>
          ))}
          {fetcher.data?.ok && fetcher.data?.intent === "editCollection" && (
            <Banner tone="success">Collection updated!</Banner>
          )}
          {fetcher.data?.ok && fetcher.data?.intent === "deleteCollection" && (
            <Banner tone="success">Collection deleted.</Banner>
          )}
        </BlockStack>
      </Card>

      {deleteTarget && (
        <Banner tone="critical">
          <BlockStack gap="200">
            <Text>Delete "{deleteTarget.title}"? This cannot be undone.</Text>
            <InlineStack gap="200">
              <Button tone="critical" variant="primary" onClick={handleDelete}>Yes, Delete</Button>
              <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Banner>
      )}

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd">🪨 Auto-Assign Products to Collections</Text>
          {products.map((product) => (
            <ProductCollectionCard key={product.id} product={product} collections={collections} />
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default function MetaInjector() {
  const { products, collections, dynamicTaxonomy } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [form, setForm] = useState({});
  const [bulkForm, setBulkForm] = useState({});
  
  const [tabIndex, setTabIndex] = useState(0);
  const [menuActive, setMenuActive] = useState(false);
  const toggleMenu = () => setMenuActive((active) => !active);

  const [payload, setPayload] = useState("");
  const [injectProduct, setInjectProduct] = useState("");
  const [injectStatus, setInjectStatus] = useState(null);
  const [mindatName, setMindatName] = useState("");
  const [mindatStatus, setMindatStatus] = useState(null);
  const [addingNew, setAddingNew] = useState({});
  const [newName, setNewName] = useState({});

  const [scanResult, setScanResult] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanAllResults, setScanAllResults] = useState(null);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const getGidFromLabel = (fieldKey, label) => {
    if (!label || !dynamicTaxonomy[fieldKey]) return label;
    const option = dynamicTaxonomy[fieldKey].find(o => o.label.toLowerCase() === label.toLowerCase());
    return option ? option.value : label;
  };

  const handleSelect = (product) => {
    const result = scanProduct(product);
    setScanResult(result);
    setScannedProduct(product);
    setSelected(product);
    
    const prefilled = {};
    Object.entries(result).forEach(([k,v]) => { 
      if (v.value) {
         prefilled[k] = TAXONOMY[k] ? getGidFromLabel(k, v.value) : v.value;
      } 
    });
    setForm({ ...product.metafields, ...prefilled });
  };

  const handleScanConfirm = () => {
    if (!scannedProduct) return;
    const fd = new FormData();
    fd.append("intent","save");
    fd.append("ids", JSON.stringify([scannedProduct.id]));
    Object.keys(TAXONOMY).forEach((k) => fd.append(k, form[k] || ""));
    TEXT_FIELDS.forEach(({key}) => fd.append(key, form[key] || ""));
    fetcher.submit(fd, { method:"post" });
    setScanResult(null);
    setScannedProduct(null);
    setTabIndex(1);
  };

  const handleScanDismiss = () => { setScanResult(null); setScannedProduct(null); };

  const handleScanAll = () => {
    const results = products.map((p) => ({ product: p, scan: scanProduct(p) }));
    setScanAllResults(results);
    setScanResult(null);
    setScannedProduct(null);
  };

  const handleInjectAll = () => {
    const lines = [];
    scanAllResults.forEach(({product:p, scan}) => {
      Object.entries(scan).forEach(([key,{value}]) => {
        if (!value) return;
        
        if (TEXT_FIELDS.find((f) => f.key === key)) {
          lines.push(JSON.stringify({ownerId:p.id,namespace:"geology",key,value,type:"single_line_text_field"}));
        } else if (TAXONOMY[key]) {
          const gid = getGidFromLabel(key, value);
          if (gid && gid.startsWith("gid://")) {
            lines.push(JSON.stringify({ownerId:p.id,namespace:"shopify",key:TAXONOMY[key].key,value:`["${gid}"]`,type:"list.metaobject_reference"}));
          }
        }
      });
    });
    const fd = new FormData();
    fd.append("intent","inject");
    fd.append("payload", lines.join("\n"));
    fetcher.submit(fd, { method:"post" });
    setScanAllResults(null);
  };

  const handleDropdownChange = (fieldKey, value, isBulk) => {
    if (value === "__add__") {
      setAddingNew({ ...addingNew, [fieldKey]: true });
    } else {
      if (isBulk) setBulkForm({ ...bulkForm, [fieldKey]: value });
      else setForm({ ...form, [fieldKey]: value });
    }
  };

  const handleAddTaxonomy = (fieldKey) => {
    const name = newName[fieldKey];
    if (!name) return;
    const fd = new FormData();
    fd.append("intent", "addTaxonomy");
    fd.append("metaobjectType", TAXONOMY[fieldKey].metaobjectType);
    fd.append("name", name);
    fetcher.submit(fd, { method: "post" });
    setAddingNew({ ...addingNew, [fieldKey]: false });
    setNewName({ ...newName, [fieldKey]: "" });
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append("intent", "save");
    fd.append("ids", JSON.stringify([selected.id]));
    Object.keys(TAXONOMY).forEach((k) => fd.append(k, form[k] || ""));
    TEXT_FIELDS.forEach(({ key }) => fd.append(key, form[key] || ""));
    fetcher.submit(fd, { method: "post" });
  };

  const handleBulk = () => {
    const fd = new FormData();
    fd.append("intent", "bulk");
    fd.append("ids", JSON.stringify(checkedIds));
    Object.keys(TAXONOMY).forEach((k) => fd.append(k, bulkForm[k] || ""));
    TEXT_FIELDS.forEach(({ key }) => fd.append(key, bulkForm[key] || ""));
    fetcher.submit(fd, { method: "post" });
  };

  const handleAutoInject = async () => {
    if (!injectProduct) return;
    setInjectStatus("loading");
    const product = products.find((p) => p.id === injectProduct);
    if (!product) { setInjectStatus("error"); return; }
    const descData = parseDescription(product.description || "");
    let mindatData = {};
    try {
      const res = await fetch(
        `https://api.mindat.org/minerals/?name=${encodeURIComponent(product.title)}&format=json`,
        { headers: { Authorization: "Token YOUR_MINDAT_API_TOKEN" } }
      );
      const resData = await res.json();
      const mineral = resData.results?.[0];
      if (mineral) {
        mindatData = {
          hardness: mineral.hardness || "",
          where_found: mineral.localities || "",
          geological_age: mineral.geological_age || "",
        };
      }
    } catch {}
    const lines = [];
    const textData = { ...descData, ...mindatData };
    TEXT_FIELDS.forEach(({ key }) => {
      if (textData[key]) {
        lines.push(JSON.stringify({ ownerId: product.id, namespace: "geology", key, value: textData[key], type: "single_line_text_field" }));
      }
    });
    Object.keys(TAXONOMY).forEach((fieldKey) => {
      const config = TAXONOMY[fieldKey];
      lines.push(JSON.stringify({ ownerId: product.id, namespace: "shopify", key: config.key, value: `["REPLACE_WITH_GID"]`, type: "list.metaobject_reference", _note: `Select correct ${config.label} GID` }));
    });
    setPayload(lines.join("\n"));
    setInjectStatus("ready");
  };

  const handleInject = () => {
    const fd = new FormData();
    fd.append("intent", "inject");
    fd.append("payload", payload);
    fetcher.submit(fd, { method: "post" });
  };

  const handleMindat = async () => {
    setMindatStatus("loading");
    try {
      const res = await fetch(
        `https://api.mindat.org/minerals/?name=${encodeURIComponent(mindatName)}&format=json`,
        { headers: { Authorization: "Token YOUR_MINDAT_API_TOKEN" } }
      );
      const resData = await res.json();
      const mineral = resData.results?.[0];
      if (mineral) {
        setForm({ hardness: mineral.hardness || "", where_found: mineral.localities || "", geological_age: mineral.geological_age || "" });
        setMindatStatus("found");
        setTabIndex(1);
      } else {
        setMindatStatus("notfound");
      }
    } catch {
      setMindatStatus("error");
    }
  };

  const allIds = filtered.map((p) => p.id);
  const allChecked = filtered.length > 0 && checkedIds.length === filtered.length;

  const tabs = [
    { id: "grid", content: "🪨 Products" },
    { id: "form", content: "✏️ Edit Stone" },
    { id: "check", content: "🔍 Check Meta" },
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
    { id: "collections", content: "🗂️ Collections" },
  ];

  const renderTaxonomyField = (fieldKey, isBulk) => {
    const config = TAXONOMY[fieldKey];
    const currentForm = isBulk ? bulkForm : form;
    const options = [
      { label: "-- Select --", value: "" },
      ...(dynamicTaxonomy[fieldKey] || []),
      { label: "+ Add New", value: "__add__" }
    ];

    return (
      <BlockStack gap="200" key={fieldKey}>
        <Select
          label={<LabelWithHelp label={config.label} help={config.help} />}
          options={options}
          value={currentForm[fieldKey] || ""}
          onChange={(v) => handleDropdownChange(fieldKey, v, isBulk)}
        />
        {addingNew[fieldKey] && (
          <InlineStack gap="200">
            <TextField
              label=""
              value={newName[fieldKey] || ""}
              onChange={(v) => setNewName({ ...newName, [fieldKey]: v })}
              placeholder={`New ${config.label} name...`}
              autoComplete="off"
            />
            <Button onClick={() => handleAddTaxonomy(fieldKey)} variant="primary">Save</Button>
            <Button onClick={() => setAddingNew({ ...addingNew, [fieldKey]: false })}>Cancel</Button>
          </InlineStack>
        )}
      </BlockStack>
    );
  };

  return (
    <Page title="Meta Injector 🪨">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              
              <InlineStack>
                <Popover
                  active={menuActive}
                  activator={
                    <Button onClick={toggleMenu} icon={MenuIcon} size="large">
                      <span style={{ marginLeft: "8px", fontWeight: "bold" }}>
                        {tabs[tabIndex].content}
                      </span>
                    </Button>
                  }
                  onClose={toggleMenu}
                >
                  <ActionList
                    actionRole="menuitem"
                    items={tabs.map((tab, index) => ({
                      content: tab.content,
                      onAction: () => {
                        setTabIndex(index);
                        setMenuActive(false);
                      },
                    }))}
                  />
                </Popover>
              </InlineStack>

              <Box>
                {tabIndex === 0 && (
                  <BlockStack gap="400">
                    <TextField label="Search stones" value={search} onChange={setSearch} placeholder="Type a stone name..." clearButton onClearButtonClick={() => setSearch("")} autoComplete="off" />
                    <InlineStack gap="300" blockAlign="center">
                      <Button variant="primary" onClick={handleScanAll}>🔍 Scan All {products.length} Products</Button>
                      {scanAllResults && <Text tone="caution">⚠️ {scanAllResults.filter((r) => Object.values(r.scan).some((f) => f.source==="manual")).length} products need manual input</Text>}
                      {scanAllResults && <Button onClick={() => setScanAllResults(null)}>Clear</Button>}
                    </InlineStack>
                    {scanAllResults && (
                      <Card>
                        <BlockStack gap="300">
                          <Text variant="headingMd">Scan All Results — {scanAllResults.length} products</Text>
                          <div style={{overflowX:"auto"}}>
                            <table style={{width:"100%",borderCollapse:"collapse",fontSize:"13px"}}>
                              <thead>
                                <tr style={{background:"#f6f6f7"}}>
                                  {["Product","Stone Type","Color","Origin","Cut Shape","Hardness","Crystal System","Status"].map((h) => (
                                    <th key={h} style={{padding:"8px 10px",textAlign:"left",borderBottom:"1px solid #e1e3e5",whiteSpace:"nowrap"}}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {scanAllResults.map(({product:p, scan}) => {
                                  const allFound = Object.values(scan).every((f) => f.source !== "manual");
                                  return (
                                    <tr key={p.id} style={{borderBottom:"1px solid #f1f1f1"}}>
                                      <td style={{padding:"8px 10px",fontWeight:"600"}}>{p.title}</td>
                                      {["stone_type","color","origin_location","cut_shape","hardness","crystal_system"].map((f) => (
                                        <td key={f} style={{padding:"8px 10px",color:scan[f].source==="manual"?"#b98900":"#202223"}}>{scan[f].value||"—"}</td>
                                      ))}
                                      <td style={{padding:"8px 10px",fontSize:"16px"}}>{allFound?"✅":"⚠️"}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <InlineStack gap="300">
                            <Button variant="primary" onClick={handleInjectAll} loading={fetcher.state==="submitting"}>Inject All</Button>
                            <Button onClick={() => setScanAllResults(null)}>Dismiss</Button>
                          </InlineStack>
                          {fetcher.data?.injected !== undefined && <Banner tone="success">Injected {fetcher.data.injected} metafield(s) successfully!</Banner>}
                        </BlockStack>
                      </Card>
                    )}
                    {scanResult && scannedProduct && !scanAllResults && (
                      <ScanPreviewCard product={scannedProduct} scanResult={scanResult} onConfirm={handleScanConfirm} onDismiss={handleScanDismiss} loading={fetcher.state==="submitting"} />
                    )}
                    <Grid>
                      {filtered.map((product) => (
                        <Grid.Cell key={product.id} columnSpan={{xs:6,sm:4,md:3,lg:3}}>
                          <div onClick={() => handleSelect(product)} style={{cursor:"pointer",border:"1px solid #e1e3e5",borderRadius:"8px",overflow:"hidden",textAlign:"center"}}>
                            <img src={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} alt={product.title} style={{width:"100%",height:"140px",objectFit:"cover"}} />
                            <div style={{padding:"8px"}}>
                              <Text variant="bodySm" fontWeight="bold">{product.title}</Text>
                              <Badge tone={completeness(product.metafields)}>{completenessLabel(product.metafields)}</Badge>
                            </div>
                          </div>
                        </Grid.Cell>
                      ))}
                    </Grid>
                  </BlockStack>
                )}

                {tabIndex === 1 && (
                  <BlockStack gap="400">
                    {!selected ? (
                      <Banner tone="info">Select a stone from the Products tab to edit its metafields.</Banner>
                    ) : (
                      <>
                        <Text variant="headingMd">{selected.title}</Text>
                        <FormLayout>
                          {Object.keys(TAXONOMY).map((fieldKey) => renderTaxonomyField(fieldKey, false))}
                          {TEXT_FIELDS.map((f) => (
                            <TextField
                              key={f.key}
                              label={<LabelWithHelp label={f.label} help={f.help} />}
                              value={form[f.key] || ""}
                              onChange={(v) => setForm({ ...form, [f.key]: v })}
                              placeholder={f.placeholder}
                              autoComplete="off"
                              multiline={f.key === "stone_story" ? 4 : undefined}
                            />
                          ))}
                        </FormLayout>
                        <Button variant="primary" onClick={handleSave} loading={fetcher.state === "submitting"}>
                          Save Stone
                        </Button>
                        {fetcher.data?.ok && fetcher.data?.intent === "save" && (
                          <Banner tone="success">Stone saved successfully!</Banner>
                        )}
                      </>
                    )}
                  </BlockStack>
                )}

                {tabIndex === 2 && (
                  <BlockStack gap="400">
                    <Text variant="headingMd">Metafield Verification Report</Text>
                    <Banner tone="info">Compares your store metafields against Mindat.org data. Requires Mindat API token.</Banner>
                    {products.map((p) => (
                      <Card key={p.id}>
                        <BlockStack gap="200">
                          <InlineStack align="space-between">
                            <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                            <Badge tone={completeness(p.metafields)}>{completenessLabel(p.metafields)}</Badge>
                          </InlineStack>
                          <MindatVerifier product={p} />
                        </BlockStack>
                      </Card>
                    ))}
                  </BlockStack>
                )}

                {tabIndex === 3 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <BlockStack gap="300">
                      <InlineStack gap="200">
                        <Button onClick={() => setCheckedIds(allChecked ? [] : allIds)}>
                          {allChecked ? "Deselect All" : "Select All"}
                        </Button>
                        <Text>{checkedIds.length} selected</Text>
                      </InlineStack>
                      <div style={{ maxHeight: "600px", overflowY: "auto" }}>
                        <BlockStack gap="200">
                          {filtered.map((p) => (
                            <InlineStack key={p.id} gap="200" blockAlign="center">
                              <Checkbox
                                label=""
                                checked={checkedIds.includes(p.id)}
                                onChange={(checked) => {
                                  if (checked) setCheckedIds([...checkedIds, p.id]);
                                  else setCheckedIds(checkedIds.filter((id) => id !== p.id));
                                }}
                              />
                              <img src={p.featuredImage?.url || ""} alt={p.title} style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" }} />
                              <Text variant="bodySm">{p.title}</Text>
                            </InlineStack>
                          ))}
                        </BlockStack>
                      </div>
                    </BlockStack>
                    <BlockStack gap="300">
                      <Text variant="headingMd">Apply to {checkedIds.length} Stone(s)</Text>
                      <FormLayout>
                        {Object.keys(TAXONOMY).map((fieldKey) => renderTaxonomyField(fieldKey, true))}
                        {TEXT_FIELDS.map((f) => (
                          <TextField
                            key={f.key}
                            label={<LabelWithHelp label={f.label} help={f.help} />}
                            value={bulkForm[f.key] || ""}
                            onChange={(v) => setBulkForm({ ...bulkForm, [f.key]: v })}
                            placeholder={f.placeholder}
                            autoComplete="off"
                          />
                        ))}
                      </FormLayout>
                      <Button variant="primary" onClick={handleBulk} disabled={checkedIds.length === 0} loading={fetcher.state === "submitting"}>
                        Apply to {checkedIds.length} Stone(s)
                      </Button>
                      {fetcher.data?.ok && fetcher.data?.intent === "bulk" && (
                        <Banner tone="success">Bulk save complete!</Banner>
                      )}
                    </BlockStack>
                  </div>
                )}

                {tabIndex === 4 && (
                  <BlockStack gap="400">
                    <Text variant="headingMd">Auto-build payload from product + Mindat</Text>
                    <Select
                      label="Select a stone"
                      options={[{ label: "-- Pick a stone --", value: "" }, ...products.map((p) => ({ label: p.title, value: p.id }))]}
                      value={injectProduct}
                      onChange={setInjectProduct}
                    />
                    <Button variant="primary" onClick={handleAutoInject} loading={injectStatus === "loading"} disabled={!injectProduct}>
                      🔄 Build Payload
                    </Button>
                    {injectStatus === "ready" && <Banner tone="success">Payload built — review and edit below, then inject.</Banner>}
                    {injectStatus === "error" && <Banner tone="critical">Could not build payload. Check product and Mindat token.</Banner>}
                    <TextField
                      label="JSON Payload (one object per line — edit before injecting)"
                      value={payload}
                      onChange={setPayload}
                      multiline={12}
                      autoComplete="off"
                    />
                    <Button variant="primary" onClick={handleInject} loading={fetcher.state === "submitting"} disabled={!payload}>
                      💉 Inject
                    </Button>
                    {fetcher.data?.injected !== undefined && (
                      <Banner tone="success">Injected {fetcher.data.injected} metafield(s) successfully!</Banner>
                    )}
                  </BlockStack>
                )}

                {tabIndex === 5 && (
                  <BlockStack gap="400">
                    <Text variant="headingMd">Pull verified geological data from Mindat.org.</Text>
                    <TextField
                      label="Stone name"
                      value={mindatName}
                      onChange={setMindatName}
                      placeholder="e.g. Amethyst"
                      autoComplete="off"
                    />
                    <Button variant="primary" onClick={handleMindat} loading={mindatStatus === "loading"}>
                      🌍 Lookup
                    </Button>
                    {mindatStatus === "found" && <Banner tone="success">Found! Fields pre-filled — switch to Edit Stone to review and save.</Banner>}
                    {mindatStatus === "notfound" && <Banner tone="warning">No results found for "{mindatName}".</Banner>}
                    {mindatStatus === "error" && <Banner tone="critical">Lookup failed. Check your Mindat API token.</Banner>}
                    <Banner tone="info">Requires a Mindat.org API token. Token not yet configured.</Banner>
                  </BlockStack>
                )}

                {tabIndex === 6 && (
                  <CollectionsTab products={products} collections={collections} fetcher={fetcher} />
                )}
              </Box>

            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong loading Meta Injector.</div>;
}
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
  Divider,
  Scrollable,
  ProgressBar
} from "@shopify/polaris";
import { QuestionCircleIcon, MenuIcon } from "@shopify/polaris-icons";

// --- VERIFIED GID MAPS ---
const MENU_MAP = {
  main: [
    { name: "all collections", path: "/collections/all-collections", gid: "gid://shopify/MenuItem/619586322683" },
    { name: "Touch Stones & Mile Stones", path: "/collections/memorials", gid: "gid://shopify/MenuItem/619586355451" },
    { name: "Small Batches / The Vault", path: "/collections/small-batches-the-vault", gid: "gid://shopify/MenuItem/619586388219" },
    { name: "Wearable Art", path: "/collections/wearable-art", gid: "gid://shopify/MenuItem/619586420987" },
    { name: "The Yakima Canyon Collection", path: "/collections/yakima-canyon", gid: "gid://shopify/MenuItem/619586453755" },
    { name: "The Gallery", path: "/collections/the-gallery", gid: "gid://shopify/MenuItem/619586486523" },
    { name: "Richardson's Rock Ranch", path: "/collections/richardsons-rock-ranch", gid: "gid://shopify/MenuItem/619586519291" },
    { name: "The 3,000-Mile Run", path: "/collections/the-3-000-mile-run-1", gid: "gid://shopify/MenuItem/619586552059" },
    { name: "Home", path: "/", gid: "gid://shopify/MenuItem/619586584827" },
  ],
  footer: [
    { name: "About the Makers", path: "/pages/our-story", gid: "gid://shopify/MenuItem/619584356603" },
    { name: "Search the Archive", path: "/search", gid: "gid://shopify/MenuItem/619584389371" },
    { name: "FAQ & Practical Testing", path: "/pages/frequently-asked-questions", gid: "gid://shopify/MenuItem/619584422139" },
    { name: "Standard Specs", path: "/pages/standard-specs", gid: "gid://shopify/MenuItem/619584454907" },
    { name: "all collections", path: "/collections/all-collections", gid: "gid://shopify/MenuItem/619584487675" },
    { name: "Touch Stones & Mile Stones", path: "/collections/memorials", gid: "gid://shopify/MenuItem/619584520443" },
    { name: "Small Batches / The Vault", path: "/collections/small-batches-the-vault", gid: "gid://shopify/MenuItem/619584553211" },
    { name: "Wearable Art", path: "/collections/wearable-art", gid: "gid://shopify/MenuItem/619584585979" },
    { name: "The Yakima Canyon Collection", path: "/collections/yakima-canyon", gid: "gid://shopify/MenuItem/619584618747" },
    { name: "The Gallery", path: "/collections/the-gallery", gid: "gid://shopify/MenuItem/619584651515" },
    { name: "Richardson's Rock Ranch", path: "/collections/richardsons-rock-ranch", gid: "gid://shopify/MenuItem/619584684283" },
    { name: "The 3,000-Mile Run", path: "/collections/the-3-000-mile-run-1", gid: "gid://shopify/MenuItem/619584717051" },
  ],
  customer: [
    { name: "Orders", path: "https://account.rockhoundstudio.com/orders", gid: "gid://shopify/MenuItem/606227923195" },
    { name: "Profile", path: "https://account.rockhoundstudio.com/profile", gid: "gid://shopify/MenuItem/607948570875" },
  ]
};

const TAXONOMY = {
  crystal_system: {
    label: "Crystal Structure",
    namespace: "shopify",
    key: "crystal-system",
    help: "The geometric arrangement of atoms in the mineral",
    metaobjectType: "crystal-system",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Monoclinic", value: "gid://shopify/Metaobject/151951212795" },
      { label: "Trigonal", value: "gid://shopify/Metaobject/154252116219" },
      { label: "Hexagonal", value: "gid://shopify/Metaobject/154307625211" },
      { label: "Triclinic", value: "gid://shopify/Metaobject/154308706555" },
      { label: "+ Add New", value: "__add__" },
    ],
  },
  mineral_class: {
    label: "Mineral Class",
    namespace: "shopify",
    key: "mineral-class",
    help: "Scientific classification based on chemical composition",
    metaobjectType: "mineral-class",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Silicates", value: "gid://shopify/Metaobject/151951278331" },
      { label: "Oxides", value: "gid://shopify/Metaobject/155431371003" },
      { label: "Carbonates", value: "gid://shopify/Metaobject/156128313595" },
      { label: "+ Add New", value: "__add__" },
    ],
  },
  rock_formation: {
    label: "Rock Formation",
    namespace: "shopify",
    key: "rock-formation",
    help: "The geological process that formed this rock",
    metaobjectType: "rock-formation",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Metamorphic", value: "gid://shopify/Metaobject/151951343867" },
      { label: "Igneous", value: "gid://shopify/Metaobject/154251985147" },
      { label: "Sedimentary", value: "gid://shopify/Metaobject/154307657979" },
      { label: "+ Add New", value: "__add__" },
    ],
  },
  geological_era: {
    label: "Geological Era",
    namespace: "shopify",
    key: "geological-era",
    help: "The time period when this rock was formed",
    metaobjectType: "geological-era",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Precambrian", value: "gid://shopify/Metaobject/151951245563" },
      { label: "Paleozoic", value: "gid://shopify/Metaobject/156128379131" },
      { label: "Mesozoic", value: "gid://shopify/Metaobject/154252083451" },
      { label: "Cenozoic", value: "gid://shopify/Metaobject/154307854587" },
      { label: "+ Add New", value: "__add__" },
    ],
  },
  rock_composition: {
    label: "Rock Composition",
    namespace: "shopify",
    key: "rock-composition",
    help: "The primary rock or mineral matrix",
    metaobjectType: "rock-composition",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Granite", value: "gid://shopify/Metaobject/151951311099" },
      { label: "Obsidian", value: "gid://shopify/Metaobject/155431338235" },
      { label: "Andesite", value: "gid://shopify/Metaobject/156128411899" },
      { label: "Schist", value: "gid://shopify/Metaobject/156128477435" },
      { label: "+ Add New", value: "__add__" },
    ],
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

const TARGET_KEYS = [
  "crystal-system", "mineral-class", "rock-formation", "geological-era", "rock-composition",
  "hardness", "where_found", "geological_age", "character_marks", "stone_story", "rescued_by", "origin_location"
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

function scanProduct(product, dynamicGemDatabase) {
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
    mineral_class: mf.mineral_class || null,
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
  const gem = stoneKey && dynamicGemDatabase ? dynamicGemDatabase[stoneKey] : null;
  const l3 = gem ? { 
    hardness: gem.hardness, 
    crystal_system: gem.crystal_system, 
    mineral_class: gem.mineral_class 
  } : {};
  
  const fields = ["stone_type","color","origin_location","cut_shape","hardness","crystal_system", "mineral_class"];
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
const SCAN_FIELD_LABELS = { stone_type:"Stone Type", color:"Color", origin_location:"Origin", cut_shape:"Cut Shape", hardness:"Hardness", crystal_system:"Crystal System", mineral_class: "Mineral Class" };

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
                shopifyMeta: metafields(first: 20, namespace: "shopify") {
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
          gemDict: metaobjects(type: "gem_dictionary", first: 100) { edges { node { fields { key value } } } }
        }
      `)
    ]);

    const productsData = await productsRes.json();
    const collectionsData = await collectionsRes.json();
    const taxonomiesData = await taxonomiesRes.json();

    if (productsData.errors) console.error("🚨 GraphQL Products Error:", JSON.stringify(productsData.errors, null, 2));
    if (collectionsData.errors) console.error("🚨 GraphQL Collections Error:", JSON.stringify(collectionsData.errors, null, 2));
    if (taxonomiesData.errors) console.error("🚨 GraphQL Taxonomies Error:", JSON.stringify(taxonomiesData.errors, null, 2));

    const products = (productsData.data?.products?.edges || []).map(({ node }) => {
      const mergedMetafields = {
        ...Object.fromEntries((node.metafields?.edges || []).map(({ node: mf }) => [mf.key, mf.value])),
        ...Object.fromEntries((node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value]))
      };

      const filledFields = Object.keys(mergedMetafields).filter(k => TARGET_KEYS.includes(k) && mergedMetafields[k] && mergedMetafields[k] !== "[]");
      let status = "🔴 Empty";
      if (filledFields.length === TARGET_KEYS.length) status = "✅ Complete";
      else if (filledFields.length > 0) status = "⚠️ Partial";

      return {
        ...node,
        description: stripHtml(node.descriptionHtml),
        metafields: mergedMetafields,
        status,
        currentCollections: (node.collections?.edges || []).map(({ node: c }) => ({ id: c.id, title: c.title })),
      };
    });

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

    const dynamicGemDatabase = {};
    (taxonomiesData.data?.gemDict?.edges || []).forEach(({ node }) => {
      const getVal = (k) => node.fields.find(f => f.key === k)?.value;
      const name = getVal('stone_name')?.toLowerCase();
      if (name) {
        dynamicGemDatabase[name] = { 
          mineral_class: getVal('mineral_class'),
          crystal_system: getVal('crystal_system'),
          hardness: getVal('mohs_hardness'), 
          typical_origins: getVal('typical_origins'),
          treatment_notes: getVal('treatment_notes'),
          story_seed: getVal('story_seed'),
        };
      }
    });

    return data({ products, collections, dynamicTaxonomy, dynamicGemDatabase });

  } catch (error) {
    console.error("🚨 FATAL LOADER ERROR:", error);
    return data({ products: [], collections: [], dynamicTaxonomy: {}, dynamicGemDatabase: {} });
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

  if (intent === "bulk_edit_new") {
      const updates = JSON.parse(formData.get("updates"));
      const ids = JSON.parse(formData.get("ids"));
      const metafields = [];

      ids.forEach((ownerId) => {
          Object.keys(updates).forEach(key => {
             const val = updates[key];
             const taxDef = Object.values(TAXONOMY).find(t => t.key === key);
             if (taxDef) {
                 metafields.push({ ownerId, namespace: "shopify", key, value: val ? `["${val}"]` : "[]", type: "list.metaobject_reference" });
             } else {
                 metafields.push({ ownerId, namespace: "geology", key, value: val || "", type: "single_line_text_field" });
             }
          });
      });

      const batchSize = 6;
      for (let i = 0; i < metafields.length; i += batchSize) {
          await admin.graphql(`
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                  metafieldsSet(metafields: $metafields) { userErrors { field message } }
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
  const filled = TARGET_KEYS.filter((k) => metafields[k] && metafields[k] !== "[]").length;
  if (filled === TARGET_KEYS.length) return "success";
  if (filled === 0) return "critical";
  return "warning";
}

function completenessLabel(metafields) {
  const filled = TARGET_KEYS.filter((k) => metafields[k] && metafields[k] !== "[]").length;
  if (filled === TARGET_KEYS.length) return "Complete";
  if (filled === 0) return "Empty";
  return `${filled}/${TARGET_KEYS.length} fields`;
}

function ScanPreviewCard({ product, scanResult, onConfirm, onDismiss, loading }) {
  const fields = ["stone_type","color","origin_location","cut_shape","hardness","crystal_system", "mineral_class"];
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

function CollectionsTab({ products, collections, fetcher, onBack }) {
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
      <InlineStack>
        <Button onClick={onBack}>⬅️ Back to Products</Button>
      </InlineStack>

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
  const { products, collections, dynamicTaxonomy, dynamicGemDatabase } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, title: "" });
  
  const [tabIndex, setTabIndex] = useState(0);
  const [menuActive, setMenuActive] = useState(false);
  const toggleMenu = () => setMenuActive((active) => !active);

  const [payload, setPayload] = useState("");
  const [injectProduct, setInjectProduct] = useState("");
  const [injectStatus, setInjectStatus] = useState(null);
  const [mindatName, setMindatName] = useState("");
  const [mindatStatus, setMindatStatus] = useState(null);

  const [scanResult, setScanResult] = useState(null);
  const [scannedProduct, setScannedProduct] = useState(null);
  const [scanAllResults, setScanAllResults] = useState(null);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const getGidFromLabel = (fieldKey, label) => {
    if (!label) return label;
    let option = (dynamicTaxonomy?.[fieldKey] || []).find(o => o.label.toLowerCase() === label.toLowerCase());
    if (!option && TAXONOMY[fieldKey]?.options) {
      option = TAXONOMY[fieldKey].options.find(o => o.label.toLowerCase() === label.toLowerCase());
    }
    return option ? option.value : label;
  };

  const handleSelect = (product) => {
    const result = scanProduct(product, dynamicGemDatabase);
    setScanResult(result);
    setScannedProduct(product);
    setSelected(product);
  };

  const handleScanDismiss = () => { setScanResult(null); setScannedProduct(null); };

  const handleScanAll = () => {
    const results = products.map((p) => ({ product: p, scan: scanProduct(p, dynamicGemDatabase) }));
    setScanAllResults(results);
    setScanResult(null);
    setScannedProduct(null);
  };

  const processBulkQueue = async () => {
     if (checkedIds.length === 0 || !Object.values(tickedFields).some(Boolean)) return;
     setIsProcessing(true);

     const updates = {};
     Object.keys(tickedFields).forEach(k => {
         if (tickedFields[k]) updates[k] = fieldValues[k] || "";
     });

     for (let i = 0; i < checkedIds.length; i++) {
        const pId = checkedIds[i];
        const pObj = products.find(p => p.id === pId);
        setProgress({ current: i + 1, total: checkedIds.length, title: pObj?.title || "Unknown" });

        const fd = new FormData();
        fd.append("intent", "bulk_edit_new");
        fd.append("ids", JSON.stringify([pId]));
        fd.append("updates", JSON.stringify(updates));
        
        await fetch(".", { method: "POST", body: fd });
     }
     
     setIsProcessing(false);
     setProgress({ current: 0, total: 0, title: "" });
     fetcher.submit({}, { method: "get" }); 
  };

  const handleAutoInject = async () => {
    if (!injectProduct) return;
    setInjectStatus("loading");
    const product = products.find((p) => p.id === injectProduct);
    if (!product) return;

    const existingMeta = product.metafields || {};
    const fieldsToCheck = [
        { key: 'hardness', type: 'text', ns: 'geology' },
        { key: 'where_found', type: 'text', ns: 'geology' },
        { key: 'geological_age', type: 'text', ns: 'geology' },
        { key: 'character_marks', type: 'text', ns: 'geology' },
        { key: 'stone_story', type: 'text', ns: 'geology' },
        { key: 'rescued_by', type: 'text', ns: 'geology' },
        { key: 'origin_location', type: 'text', ns: 'geology' },
        { key: 'crystal_system', storeKey: 'crystal-system', type: 'tax', ns: 'shopify' },
        { key: 'mineral_class', storeKey: 'mineral-class', type: 'tax', ns: 'shopify' },
        { key: 'rock_formation', storeKey: 'rock-formation', type: 'tax', ns: 'shopify' },
        { key: 'geological_era', storeKey: 'geological-era', type: 'tax', ns: 'shopify' },
        { key: 'rock_composition', storeKey: 'rock-composition', type: 'tax', ns: 'shopify' }
    ];

    const isFilled = (k) => existingMeta[k] && existingMeta[k] !== "[]" && existingMeta[k] !== "";
    const parsed = parseDescription(product.description || "");
    
    let mindatData = {};
    const emptyForMindat = fieldsToCheck.filter(f => !isFilled(f.storeKey || f.key) && ['hardness','where_found','geological_age'].includes(f.key));

    if (emptyForMindat.length > 0) {
        try {
             const res = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(product.title)}&format=json`, {
               headers: { Authorization: `Token ${process.env.MINDAT_API_KEY || "YOUR_MINDAT_API_TOKEN"}` }
             });
             const resData = await res.json();
             if (resData.results?.[0]) {
               mindatData = {
                 hardness: resData.results[0].hardness,
                 where_found: resData.results[0].localities,
                 geological_age: resData.results[0].geological_age
               };
             }
        } catch(e) {}
    }

    const lines = [];
    fieldsToCheck.forEach(f => {
        const actKey = f.storeKey || f.key;
        if (isFilled(actKey)) return;

        let val = "";
        let verified = false;

        if (mindatData[f.key]) {
            val = mindatData[f.key];
            verified = true;
        } else if (parsed[f.key]) {
            val = parsed[f.key];
            verified = false;
        } else {
            const scanned = scanProduct(product, dynamicGemDatabase);
            if (scanned[f.key]?.value) {
                val = scanned[f.key].value;
                verified = scanned[f.key].source === "lookup";
            }
        }

        if (val) {
            const finalVal = verified ? val : `⚠️ ${val}`;
            if (f.type === 'text') {
                lines.push(JSON.stringify({ ownerId: product.id, namespace: f.ns, key: f.key, value: finalVal, type: "single_line_text_field" }));
            } else {
                lines.push(JSON.stringify({ ownerId: product.id, namespace: f.ns, key: actKey, value: `["REPLACE_WITH_GID_FOR_${finalVal}"]`, type: "list.metaobject_reference" }));
            }
        }
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
        { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY || "YOUR_MINDAT_API_TOKEN"}` } }
      );
      const resData = await res.json();
      const mineral = resData.results?.[0];
      if (mineral) {
        setMindatStatus("found");
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
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
    { id: "collections", content: "🗂️ Collections" },
    { id: "menus", content: "🗂️ Menu Config" },
  ];

  const renderNewTaxonomyField = (fieldKey, label) => {
    const dynamicOpts = dynamicTaxonomy?.[fieldKey] || [];
    const hardcodedOpts = TAXONOMY[fieldKey]?.options?.filter(o => o.value !== "" && o.value !== "__add__") || [];
    
    const combinedMap = new Map();
    hardcodedOpts.forEach(o => combinedMap.set(o.label.toLowerCase(), o));
    dynamicOpts.forEach(o => combinedMap.set(o.label.toLowerCase(), o));

    const finalOptions = [
      { label: "-- Select --", value: "" },
      ...Array.from(combinedMap.values()).sort((a,b) => a.label.localeCompare(b.label))
    ];

    return (
      <Select
        label=""
        options={finalOptions}
        value={fieldValues[TAXONOMY[fieldKey].key] || ""}
        onChange={(v) => setFieldValues({ ...fieldValues, [TAXONOMY[fieldKey].key]: v })}
      />
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

              {isProcessing && (
                  <Box paddingBlockEnd="400">
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p">
                        Processing {progress.current} of {progress.total} — {progress.title}...
                      </Text>
                      <ProgressBar progress={(progress.current / progress.total) * 100} size="small" tone="primary" />
                    </BlockStack>
                  </Box>
              )}

              <Box>
                {tabIndex === 0 && (
                  <BlockStack gap="400">
                    <TextField label="Search stones" value={search} onChange={setSearch} placeholder="Type a stone name..." clearButton onClearButtonClick={() => setSearch("")} autoComplete="off" />
                    <InlineStack gap="300" blockAlign="center">
                      <Button variant="primary" onClick={handleScanAll}>🔍 Scan All {products.length} Products</Button>
                      {scanAllResults && <Text tone="caution">⚠️ {scanAllResults.filter((r) => Object.values(r.scan).some((f) => f.source==="manual")).length} products need manual input</Text>}
                      {scanAllResults && <Button onClick={() => setScanAllResults(null)}>Clear</Button>}
                    </InlineStack>
                    
                    <Grid>
                      {filtered.map((product) => (
                        <Grid.Cell key={product.id} columnSpan={{xs:6,sm:4,md:3,lg:3}}>
                          <div onClick={() => handleSelect(product)} style={{cursor:"pointer",border:"1px solid #e1e3e5",borderRadius:"8px",overflow:"hidden",textAlign:"center"}}>
                            <img src={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} alt={product.title} style={{width:"100%",height:"140px",objectFit:"cover"}} />
                            <div style={{padding:"8px"}}>
                              <Text variant="bodySm" fontWeight="bold">{product.title}</Text>
                              <Badge tone={product.status === "✅ Complete" ? "success" : product.status === "🔴 Empty" ? "critical" : "warning"}>
                                 {product.status}
                              </Badge>
                            </div>
                          </div>
                        </Grid.Cell>
                      ))}
                    </Grid>
                  </BlockStack>
                )}

                {tabIndex === 1 && (
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
                      <Text variant="headingMd">Fields to Update</Text>
                      <Scrollable style={{ height: "500px" }} shadow>
                         <BlockStack gap="300">
                            {Object.keys(TAXONOMY).map(fieldKey => (
                               <BlockStack key={TAXONOMY[fieldKey].key} gap="100">
                                  <Checkbox 
                                     label={TAXONOMY[fieldKey].label} 
                                     checked={tickedFields[TAXONOMY[fieldKey].key] || false} 
                                     onChange={() => setTickedFields(prev => ({...prev, [TAXONOMY[fieldKey].key]: !prev[TAXONOMY[fieldKey].key]}))} 
                                  />
                                  {tickedFields[TAXONOMY[fieldKey].key] && renderNewTaxonomyField(fieldKey, TAXONOMY[fieldKey].label)}
                               </BlockStack>
                            ))}
                            {TEXT_FIELDS.map(f => (
                               <BlockStack key={f.key} gap="100">
                                  <Checkbox 
                                     label={f.label} 
                                     checked={tickedFields[f.key] || false} 
                                     onChange={() => setTickedFields(prev => ({...prev, [f.key]: !prev[f.key]}))} 
                                  />
                                  {tickedFields[f.key] && (
                                     <TextField
                                        label=""
                                        value={fieldValues[f.key] || ""}
                                        onChange={(v) => setFieldValues({ ...fieldValues, [f.key]: v })}
                                        placeholder={f.placeholder}
                                        autoComplete="off"
                                     />
                                  )}
                               </BlockStack>
                            ))}
                         </BlockStack>
                      </Scrollable>
                      <Button variant="primary" onClick={processBulkQueue} disabled={checkedIds.length === 0 || isProcessing || !Object.values(tickedFields).some(Boolean)}>
                        Save Ticked Fields to {checkedIds.length} Stone(s)
                      </Button>
                    </BlockStack>
                  </div>
                )}

                {tabIndex === 2 && (
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

                {tabIndex === 3 && (
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
                    {mindatStatus === "found" && <Banner tone="success">Found! Verify details in JSON payload builder.</Banner>}
                    {mindatStatus === "notfound" && <Banner tone="warning">No results found for "{mindatName}".</Banner>}
                    {mindatStatus === "error" && <Banner tone="critical">Lookup failed. Check your Mindat API token.</Banner>}
                    <Banner tone="info">Requires a Mindat.org API token. Ensure process.env.MINDAT_API_KEY is configured.</Banner>
                  </BlockStack>
                )}

                {tabIndex === 4 && (
                  <CollectionsTab products={products} collections={collections} fetcher={fetcher} onBack={() => setTabIndex(0)} />
                )}

                {tabIndex === 5 && (
                  <BlockStack gap="400">
                    <Text variant="headingMd">Menu GID Configuration</Text>
                    <Banner tone="success">All GIDs matched and locked. External customer URLs correctly bypass internal GID routing.</Banner>
                    
                    <Card title="Main Menu">
                      <BlockStack gap="200">
                        {MENU_MAP.main.map((m, idx) => (
                          <InlineStack key={idx} align="space-between">
                            <Text variant="bodyMd" fontWeight="bold">{m.name}</Text>
                            <Text tone="subdued">{m.gid}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Card>

                    <Card title="Footer Menu">
                      <BlockStack gap="200">
                        {MENU_MAP.footer.map((m, idx) => (
                          <InlineStack key={idx} align="space-between">
                            <Text variant="bodyMd" fontWeight="bold">{m.name}</Text>
                            <Text tone="subdued">{m.gid}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Card>

                    <Card title="Customer Account Menu">
                      <BlockStack gap="200">
                        {MENU_MAP.customer.map((m, idx) => (
                          <InlineStack key={idx} align="space-between">
                            <Text variant="bodyMd" fontWeight="bold">{m.name}</Text>
                            <Text tone="subdued">{m.path}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </Card>
                  </BlockStack>
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
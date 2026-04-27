import { useState } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  Button,
  Box,
  Popover,
  ActionList,
  BlockStack,
  InlineStack,
  Divider,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

import ProductsTab from "../components/meta/ProductsTab";
import CollectionsTab from "../components/meta/CollectionsTab";
import MetaCore from "../components/meta/MetaCore";

const METAFIELDS = [
  { key: "crystal_structure", name: "Crystal Structure" },
  { key: "mineral_class", name: "Mineral Class" },
  { key: "rock_formation", name: "Rock Formation" },
  { key: "geological_era", name: "Geological Era" },
  { key: "rock_composition", name: "Rock Composition" },
  { key: "hardness", name: "Hardness" },
  { key: "where_found", name: "Where Found" },
  { key: "geological_age", name: "Geological Age" },
  { key: "character_marks", name: "Character Marks" },
  { key: "stone_story", name: "Stone Story" },
  { key: "rescued_by", name: "Rescued By" },
  { key: "origin_location", name: "Origin Location" }
];

function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const [productsRes, collectionsRes] = await Promise.all([
      admin.graphql(`
        query {
          products(first: 100) {
            edges {
              node {
                id
                title
                descriptionHtml
                featuredImage { url }
                metafields(first: 50, namespace: "custom") {
                  edges { node { key value } }
                }
              }
            }
          }
        }
      `),
      admin.graphql(`query { collections(first: 50) { edges { node { id title handle } } } }`)
    ]);

    const pData = await productsRes.json();
    const cData = await collectionsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const mfs = Object.fromEntries((node.metafields?.edges || []).map(({ node: mf }) => [mf.key, mf.value]));
      const filled = METAFIELDS.filter(f => mfs[f.key] && mfs[f.key] !== "" && mfs[f.key] !== "[]").length;
      
      let status = "🔴 Empty";
      if (filled === METAFIELDS.length) status = "✅ Complete";
      else if (filled > 0) status = "⚠️ Partial";

      return {
        id: node.id,
        title: node.title,
        description: stripHtml(node.descriptionHtml),
        featuredImage: node.featuredImage,
        metafields: mfs,
        status,
        filledCount: filled,
      };
    });

    return data({ products, collections: cData.data?.collections?.edges.map(e => e.node) || [] });
  } catch (e) { return data({ products: [], collections: [] }); }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const metafields = [];
    ids.forEach(ownerId => {
      Object.entries(updates).forEach(([key, value]) => {
        metafields.push({ ownerId, namespace: "custom", key, value, type: "single_line_text_field" });
      });
    });
    await admin.graphql(`mutation mSet($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }`, { variables: { m: metafields } });
    return data({ ok: true });
  }

  if (intent === "build_payload") {
    const productId = formData.get("productId");
    const title = formData.get("title");
    const description = formData.get("description");
    const existing = JSON.parse(formData.get("existingMeta"));

    const payloadLines = [];
    for (const field of METAFIELDS) {
      if (existing[field.key]) continue; 

      let value = "";
      let verified = false;

      const hintRegex = new RegExp(`${field.name}:?\\s*([^\\n.,]+)`, "i");
      const match = description.match(hintRegex);
      if (match) value = match[1].trim();

      if (!value && ["hardness", "where_found", "geological_age"].includes(field.key)) {
        try {
          const res = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(title)}&format=json`, {
            headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` }
          });
          const json = await res.json();
          if (json.results?.[0]) {
            value = json.results[0][field.key === "where_found" ? "localities" : field.key];
            verified = true;
          }
        } catch (e) {}
      }

      if (value) {
        payloadLines.push(JSON.stringify({
          ownerId: productId,
          namespace: "custom",
          key: field.key,
          value: verified ? value : `⚠️ ${value}`,
          type: "single_line_text_field"
        }));
      }
    }
    return data({ ok: true, payload: payloadLines.join("\n") });
  }

  if (intent === "inject") {
    const lines = formData.get("payload").split("\n").filter(Boolean);
    const mSet = lines.map(l => JSON.parse(l));
    await admin.graphql(`mutation mSet($m: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $m) { userErrors { message } } }`, { variables: { m: mSet } });
    return data({ ok: true });
  }

  if (intent === "createCollection") {
    const title = formData.get("title");
    await admin.graphql(`mutation cCreate($input: CollectionInput!) { collectionCreate(input: $input) { userErrors { message } } }`, { variables: { input: { title } } });
    return data({ ok: true });
  }

  if (intent === "deleteCollection") {
    const id = formData.get("id");
    await admin.graphql(`mutation cDelete($input: CollectionDeleteInput!) { collectionDelete(input: $input) { userErrors { message } } }`, { variables: { input: { id } } });
    return data({ ok: true });
  }

  if (intent === "assignCollection") {
    const productId = formData.get("productId");
    const collectionId = formData.get("collectionId");
    await admin.graphql(`mutation cAdd($id: ID!, $pids: [ID!]!) { collectionAddProducts(id: $id, productIds: $pids) { userErrors { message } } }`, { variables: { id: collectionId, productIds: [productId] } });
    return data({ ok: true });
  }

  return data({ ok: false });
};

export default function MetaInjector() {
  const { products, collections } = useLoaderData();
  const [tabIndex, setTabIndex] = useState(0);
  const [menuActive, setMenuActive] = useState(false);

  const tabs = [
    { id: "products", content: "🪨 Products" },
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
    { id: "collections", content: "🗂️ Collections" }
  ];

  return (
    <Page title="Rockhound Command Center" fullWidth>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <Box padding="400">
              <Popover
                active={menuActive}
                activator={<Button onClick={() => setMenuActive(!menuActive)} icon={MenuIcon} size="large">{tabs[tabIndex].content}</Button>}
                onClose={() => setMenuActive(false)}
              >
                <ActionList items={tabs.map((t, i) => ({ content: t.content, onAction: () => { setTabIndex(i); setMenuActive(false); } }))} />
              </Popover>
            </Box>
            <Divider />
            <Box padding="400">
              {tabIndex === 0 && <ProductsTab products={products} />}
              {tabIndex === 1 && <MetaCore products={products} mode="bulk" />}
              {tabIndex === 2 && <MetaCore products={products} mode="inject" />}
              {tabIndex === 3 && <MetaCore products={products} mode="mindat" />}
              {tabIndex === 4 && <CollectionsTab products={products} collections={collections} onBack={() => setTabIndex(0)} />}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
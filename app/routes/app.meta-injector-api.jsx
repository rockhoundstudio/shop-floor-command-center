import { useState } from "react";
import { useLoaderData, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

// ─── IMPORT YOUR NEW SUB-FILES ───
import ProductsTab from "../components/meta/ProductsTab";
import MetaCore from "../components/meta/MetaCore";
import MindatTab from "../components/meta/MindatTab";
import CollectionsTab from "../components/meta/CollectionsTab";

import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";

const SKIP_KEYS = new Set(["mineral_class", "rock_composition"]);

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const [productsRes, collectionsRes] = await Promise.all([
      admin.graphql(`
        query {
          products(first: 100) {
            edges {
              node {
                id title descriptionHtml
                featuredImage { url altText }
                customMeta: metafields(first: 100, namespace: "custom") {
                  edges { node { key value } }
                }
                shopifyMeta: metafields(first: 100, namespace: "shopify") {
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
            edges { node { id title handle image { url } } }
          }
        }
      `)
    ]);

    const pData = await productsRes.json();
    const cData = await collectionsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const customMfs = Object.fromEntries((node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value]));
      const shopifyMfs = Object.fromEntries((node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key.replace(/-/g, "_"), mf.value]));
      const mfs = { ...shopifyMfs, ...customMfs };
      const { status, filledCount } = evaluateProductStatus(mfs);
      return {
        ...node,
        description: stripHtml(node.descriptionHtml),
        metafields: mfs,
        status,
        filledCount,
        currentCollections: (node.collections?.edges || []).map(({ node: c }) => ({ id: c.id, title: c.title })),
      };
    });

    const collections = (cData.data?.collections?.edges || [])
      .map(({ node }) => node)
      .filter((c) => c.handle !== "all-collections");

    return data({ products, collections, loaderError: null });
  } catch (error) {
    return data({ products: [], collections: [], loaderError: error.message });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    
    const metafields = [];
    
    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (SKIP_KEYS.has(key)) return;
        if (updates[key] && updates[key].trim() !== "") {
          metafields.push({ ownerId, namespace: "custom", key, value: updates[key], type: "single_line_text_field" });
        }
      });
    });

    if (metafields.length > 0) {
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { message } }
          }
        `, { variables: { metafields: chunk } });
      }
    }
    return data({ ok: true });
  }

  if (intent === "update_product") {
    const id = formData.get("id");
    const title = formData.get("title");
    const descriptionHtml = formData.get("description");
    
    await admin.graphql(`
      mutation productUpdate($input: ProductInput!) {
        productUpdate(input: $input) { userErrors { message } }
      }
    `, { variables: { input: { id, title, descriptionHtml } } });
    return data({ updated: true });
  }

  if (intent === "mindat_lookup") {
    const query = formData.get("query");
    if (!query || !query.trim()) return data({ ok: true, found: false });
    try {
      const res = await fetch(
        `https://api.mindat.org/geomaterials/?name=${encodeURIComponent(query.trim())}&format=json`,
        { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
      );
      if (res.ok) {
        const json = await res.json();
        if (json.results?.[0]) return data({ ok: true, found: true, result: json.results[0] });
      }
    } catch (e) {}
    return data({ ok: true, found: false });
  }

  return data({ ok: false });
};

export default function MetaInjector() {
  const { products, collections, loaderError } = useLoaderData();
  const [tabIndex, setTabIndex] = useState(0);
  const [menuActive, setMenuActive] = useState(false);

  const tabs = [
    { id: "bulk",        content: "📦 Bulk Edit (SEO Engine)" },
    { id: "products",    content: "🪨 Product Polisher" },
    { id: "mindat",      content: "🌍 The Lab (Mindat)" },
    { id: "collections", content: "🗂️ Collection Gatekeeper" }
  ];

  return (
    <Page title="Shop Floor Command Center" fullWidth>
      <Layout>
        <Layout.Section>
          {loaderError && <Banner tone="critical">Loader error: {loaderError}</Banner>}
          <Card padding="0">
            <Box padding="400">
              <Popover
                active={menuActive}
                activator={<Button onClick={() => setMenuActive(!menuActive)} icon={MenuIcon} size="large">{tabs[tabIndex].content}</Button>}
                onClose={() => setMenuActive(false)}
              >
                <ActionList
                  actionRole="menuitem"
                  items={tabs.map((tab, index) => ({
                    content: tab.content,
                    onAction: () => { setTabIndex(index); setMenuActive(false); },
                  }))}
                />
              </Popover>
            </Box>
            <Divider />
            <Box padding="400">
              {tabIndex === 0 && <MetaCore products={products} mode="bulk" />}
              {tabIndex === 1 && <ProductsTab products={products} />}
              {tabIndex === 2 && <MindatTab />}
              {tabIndex === 3 && <CollectionsTab collections={collections} />}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
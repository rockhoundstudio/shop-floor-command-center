import { useState, useMemo } from "react";
import { useLoaderData, useFetcher, useSubmit, data } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page, Layout, Card, Button, Box, Popover, ActionList, Divider, Banner,
  IndexTable, useIndexResourceState, Text, Badge, TextField, BlockStack,
  InlineStack, Grid, Scrollable, FormLayout, Thumbnail
} from "@shopify/polaris";
import { MenuIcon, SearchIcon, ViewIcon, ImageIcon } from "@shopify/polaris-icons";

// --- EXTERNAL IMPORTS ---
import { TARGET_KEYS, stripHtml, evaluateProductStatus, parseDescription, autoLinkStory } from "../utils/metaScan";
import { lookupStone } from "../utils/geoLibrary";
import { TAXONOMY_GIDS, wrapGid } from "../utils/taxonomyMap";

// --- CONSTANTS & HELPERS ---
const LIST_TEXT_FIELDS = ["character_marks", "stone_story"];
const BOOLEAN_FIELDS = ["is_ooak", "custom_product"];

const KEYS_TO_PROCESS = TARGET_KEYS.filter(k =>
  !["geological_age", "geological_era", "rock_composition", "rock_formation", "mineral_class"].includes(k)
);

function unwrapListValue(value) {
  let val = String(value).trim();
  while (val.startsWith("[") && val.endsWith("]")) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed) && parsed.length > 0) {
        val = String(parsed[0]).trim();
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return val;
}

function formatMetafieldValue(originalKey, value) {
  const cleanValue = String(value).replace(/[✅⚠️]/g, "").trim();
  const mapKey = originalKey.replace(/-/g, "_");

  if (TAXONOMY_GIDS[mapKey] && TAXONOMY_GIDS[mapKey][cleanValue]) {
    return {
      value: wrapGid(TAXONOMY_GIDS[mapKey][cleanValue]),
      type: "list.metaobject_reference",
      namespace: "shopify",
      key: originalKey.replace(/_/g, "-")
    };
  }

  const isListField = LIST_TEXT_FIELDS.includes(mapKey);
  const isBooleanField = BOOLEAN_FIELDS.includes(mapKey);

  let finalValue = String(value).trim();
  let finalType = "single_line_text_field";

  if (isListField) {
    finalValue = JSON.stringify([finalValue]);
    finalType = "list.single_line_text_field";
  } else if (isBooleanField) {
    const truthy = ["true", "yes", "1", "✅ true"];
    finalValue = truthy.some(t => finalValue.toLowerCase().includes(t)) ? "true" : "false";
    finalType = "boolean";
  }

  return {
    value: finalValue,
    type: finalType,
    namespace: "custom",
    key: mapKey
  };
}

function extractShopifyError(errors, chunk) {
  if (!errors || errors.length === 0) return null;
  let failingKey = "UNKNOWN";
  try {
    if (errors[0].field && typeof errors[0].field[1] === "number") {
      failingKey = chunk[errors[0].field[1]]?.key || "UNKNOWN";
    }
  } catch (e) {}
  return `[FIELD: ${failingKey}] ${errors[0].message} | RAW: ${JSON.stringify(errors)} | CHUNK: [${chunk.map(c => c.key).join(", ")}]`;
}

// --- SERVER LOADER ---
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const productsRes = await admin.graphql(`
      query {
        products(first: 100) {
          edges {
            node {
              id title descriptionHtml status
              variants(first: 1) { edges { node { id price } } }
              featuredImage { url altText }
              customMeta: metafields(first: 100, namespace: "custom") {
                edges { node { key value } }
              }
              shopifyMeta: metafields(first: 100, namespace: "shopify") {
                edges { node { key value } }
              }
            }
          }
        }
      }
    `);

    const pData = await productsRes.json();

    const products = (pData.data?.products?.edges || []).map(({ node }) => {
      const customMfs = Object.fromEntries(
        (node.customMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const shopifyMfs = Object.fromEntries(
        (node.shopifyMeta?.edges || []).map(({ node: mf }) => [mf.key, mf.value])
      );
      const rawMfs = { ...shopifyMfs, ...customMfs };

      const mfs = Object.fromEntries(
        Object.entries(rawMfs).map(([k, v]) => {
          let finalVal = unwrapListValue(String(v));
          const dictKey = k.replace(/_/g, "-");
          if (TAXONOMY_GIDS[dictKey]) {
            for (const [word, mappedGid] of Object.entries(TAXONOMY_GIDS[dictKey])) {
              if (finalVal.includes(String(mappedGid))) {
                finalVal = word;
                break;
              }
            }
          }
          return [k.replace(/-/g, "_"), finalVal];
        })
      );

      const { status, filledCount } = evaluateProductStatus(mfs);
      const missing = TARGET_KEYS.filter(k => !mfs || !mfs[k] || String(mfs[k]).trim() === "");
      const price = node.variants?.edges?.[0]?.node?.price || "0.00";

      return {
        id: node.id,
        title: node.title,
        price,
        shopifyStatus: node.status,
        description: stripHtml(node.descriptionHtml),
        image: node.featuredImage?.url || null,
        metafields: mfs,
        status,
        filledCount,
        missing
      };
    });

    return data({ products, loaderError: null });
  } catch (error) {
    return data({ products: [], loaderError: error.message });
  }
};

// --- SERVER ACTION ---
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const { default: prisma } = await import("../db.server");

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveSingleProduct") {
    const id = formData.get("id");
    const title = formData.get("title");
    const price = formData.get("price");

    try {
      await admin.graphql(`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) { userErrors { message } }
        }
      `, { variables: { input: { id, title } } });

      const variantRes = await admin.graphql(`
        query getVariant($id: ID!) { product(id: $id) { variants(first: 1) { edges { node { id } } } } }
      `, { variables: { id } });
      const variantJson = await variantRes.json();
      const variantId = variantJson.data?.product?.variants?.edges?.[0]?.node?.id;

      if (variantId && price) {
        await admin.graphql(`
          mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) { userErrors { message } }
          }
        `, { variables: { productId: id, variants: [{ id: variantId, price: String(parseFloat(price).toFixed(2)) }] }});
      }

      const mfs = [];
      TARGET_KEYS.forEach(key => {
        const val = formData.get(`mf_${key}`);
        if (val !== null && val !== undefined) {
          let finalValue = val;
          if (key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);
          const formatted = formatMetafieldValue(key, finalValue);
          if (formatted) {
            mfs.push({ ownerId: id, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
          }
        }
      });

      if (mfs.length > 0) {
        for (let i = 0; i < mfs.length; i += 25) {
          await admin.graphql(`
            mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) { userErrors { message } }
            }
          `, { variables: { metafields: mfs.slice(i, i + 25) } });
        }
      }
      return data({ ok: true, message: "Product saved successfully!" });
    } catch (e) {
      return data({ ok: false, error: e.message });
    }
  }

  if (intent === "bulk_edit_new") {
    const updates = JSON.parse(formData.get("updates"));
    const ids = JSON.parse(formData.get("ids"));
    const ooakText = formData.get("ooakText") || "";
    
    console.log("BULK EDIT IDs:", ids);
    
    const metafields = [];
    ids.forEach((ownerId) => {
      Object.keys(updates).forEach(key => {
        if (updates[key] && updates[key].trim() !== "") {
          let finalValue = updates[key];
          if (key.replace(/-/g, "_") === "stone_story") finalValue = autoLinkStory(finalValue);
          const formatted = formatMetafieldValue(key, finalValue);
          if (formatted) {
            metafields.push({ ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
          }
        }
      });
      if (ooakText && ooakText.trim() !== "") {
        const linkedStory = autoLinkStory(`✨ Unique Features: ${ooakText}`);
        const formatted = formatMetafieldValue("stone_story", linkedStory);
        if (formatted) {
          metafields.push({ ownerId, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type });
        }
      }
    });

    if (metafields.length === 0) return data({ ok: false, error: "No data to save." });

    const chunks = [];
    for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
    for (const chunk of chunks) {
      try {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) return data({ ok: false, error: errorMsg });
      } catch (e) {
        return data({ ok: false, error: e.message });
      }
    }
    return data({ ok: true });
  }

  if (intent === "bulkAutoFill") {
    const products = JSON.parse(formData.get("products"));
    const results = [];
    
    if (!process.env.MINDAT_API_KEY) {
      return data({ ok: false, error: "MINDAT_API_KEY not set in environment." });
    }

    for (const p of products) {
      const library  = lookupStone(p.title) || {};
      const parsed   = parseDescription(p.description || "");
      const existing = p.metafields || {};
      let stoneName = existing.official_name ? String(existing.official_name).trim() : null;
      if (!stoneName && library.official_name) stoneName = library.official_name;
      if (!stoneName && p.title) stoneName = p.title;
      if (!stoneName) { results.push({ id: p.id, title: p.title, ok: false, error: "Could not identify stone." }); continue; }

      let mindat = {};
      let mindatError = null;
      try {
        const normalizedName = stoneName.toLowerCase().trim();
        const cachedStone = await prisma.stoneCache.findUnique({ where: { stoneName: normalizedName } });
        if (cachedStone) {
          mindat = JSON.parse(cachedStone.data);
        } else {
          const res = await fetch(
            `https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(stoneName)}&format=json`,
            { headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` } }
          );
          if (res.ok) {
            const json = await res.json();
            if (json.results?.[0]) {
              const m = json.results[0];
              const hardnessStr = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
              const gravityStr = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";
              mindat = {
                moh_hardness: hardnessStr, crystal_system: m.crystal_system || "",
                specific_gravity: gravityStr, luster: m.lustre || "",
                cleavage: m.cleavage || "", fracture_pattern: m.fracture || "",
                diaphaneity: m.diaphaneity || "", tenacity: m.tenacity || "",
              };
              Object.keys(mindat).forEach(k => { if (!mindat[k]) delete mindat[k]; });
              if (Object.keys(mindat).length > 0) {
                await prisma.stoneCache.create({ data: { stoneName: normalizedName, data: JSON.stringify(mindat) } });
              }
            }
          }
        }
      } catch (e) { mindatError = e.message; }

      const merged = {};
      if (stoneName && !existing["official_name"]) merged["official_name"] = stoneName;

      KEYS_TO_PROCESS.forEach(key => {
        if (existing[key] && String(existing[key]).trim() !== "") { merged[key] = existing[key]; return; }
        const libVal    = library[key] || "";
        const parsedVal = parsed[key]  || "";
        const mindatVal = mindat[key]  || "";
        if (mindatVal) { merged[key] = `✅ ${mindatVal}`; }
        else if (libVal) { merged[key] = libVal; }
        else if (parsedVal) { merged[key] = `⚠️ ${parsedVal}`; }
      });

      const metafields = KEYS_TO_PROCESS
        .filter(key => merged[key] && String(merged[key]).trim() !== "")
        .map(key => {
          let finalValue = merged[key];
          if (key === "stone_story") finalValue = autoLinkStory(finalValue);
          const formatted = formatMetafieldValue(key, finalValue);
          if (!formatted) return null;
          return { ownerId: p.id, namespace: formatted.namespace, key: formatted.key, value: formatted.value, type: formatted.type };
        }).filter(Boolean);

      if (metafields.length === 0) { results.push({ id: p.id, title: p.title, ok: false, error: "no data found" }); continue; }

      let saveError = null;
      const chunks = [];
      for (let i = 0; i < metafields.length; i += 25) chunks.push(metafields.slice(i, i + 25));
      for (const chunk of chunks) {
        const res = await admin.graphql(`
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) { userErrors { field message } }
          }
        `, { variables: { metafields: chunk } });
        const json = await res.json();
        const errorMsg = extractShopifyError(json.data?.metafieldsSet?.userErrors, chunk);
        if (errorMsg) { saveError = errorMsg; break; }
      }

      results.push({ id: p.id, title: p.title, ok: !saveError, error: saveError || mindatError || null, merged });
      await new Promise(r => setTimeout(r, 200));
    }
    return data({ ok: true, results });
  }

  if (intent === "mindat_lookup") {
    const query = formData.get("query");
    if (!query || !query.trim()) return data({ ok: true, found: false });
    try {
      const res = await fetch(
        `https://api.mindat.org/v1/geomaterials/?name=${encodeURIComponent(query.trim())}&format=json`,
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

// --- VIEW COMPONENTS ---

function ProductsView({ products }) {
  const submit = useSubmit();
  const [editingId, setEditingId] = useState(null);
  
  const product = products.find(p => p.id === editingId);

  const handleSave = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    formData.append("intent", "saveSingleProduct");
    formData.append("id", product.id);
    submit(formData, { method: "post" });
    setEditingId(null);
  };

  if (product) {
    return (
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Button onClick={() => setEditingId(null)}>← Back to Roster</Button>
          <Text variant="headingLg">{product.title}</Text>
        </InlineStack>
        <Card>
          <form onSubmit={handleSave}>
            <FormLayout>
              <FormLayout.Group>
                <TextField label="Title" name="title" defaultValue={product.title} autoComplete="off"/>
                <TextField label="Price" name="price" defaultValue={product.price} autoComplete="off"/>
              </FormLayout.Group>
              <TextField label="Description" value={product.description} disabled={true} multiline={3} autoComplete="off"/>
              <Divider/>
              <Text variant="headingMd">Metafields</Text>
              <Grid>
                {TARGET_KEYS.map(key => (
                  <Grid.Cell key={key} columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                    <TextField 
                      label={key.replace(/_/g, " ").toUpperCase()} 
                      name={`mf_${key}`} 
                      defaultValue={product.metafields[key] || ""} 
                      autoComplete="off"
                    />
                  </Grid.Cell>
                ))}
              </Grid>
              <Box paddingBlockStart="400">
                <Button submit variant="primary" size="large">Lock to Shopify</Button>
              </Box>
            </FormLayout>
          </form>
        </Card>
      </BlockStack>
    );
  }

  const rowMarkup = products.map(({ id, title, price, status, shopifyStatus, image }, index) => (
    <IndexTable.Row id={id} key={id} position={index}>
      <IndexTable.Cell>
        <Thumbnail source={image || ImageIcon} alt={title} size="small" />
      </IndexTable.Cell>
      <IndexTable.Cell><Text fontWeight="bold">{title}</Text></IndexTable.Cell>
      <IndexTable.Cell>${price}</IndexTable.Cell>
      <IndexTable.Cell>{shopifyStatus}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={status === "Complete" ? "success" : status === "Partial" ? "warning" : "critical"}>
          {status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button size="slim" icon={ViewIcon} onClick={() => setEditingId(id)}>Edit Single</Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      <Text variant="headingMd">Product Roster</Text>
      <Card padding="0">
        <IndexTable 
          resourceName={{ singular: 'product', plural: 'products' }} 
          itemCount={products.length} 
          selectable={false} 
          headings={[{ title: '' }, { title: 'Title' }, { title: 'Price' }, { title: 'Store Status' }, { title: 'Meta Completeness' }, { title: 'Action' }]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </BlockStack>
  );
}

function BulkEditView({ products }) {
  const submit = useSubmit();
  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(products);

  const handleBulkSave = (e) => {
    e.preventDefault();
    if (selectedResources.length === 0) return alert("Select at least one product.");
    const fd = new FormData(e.target);
    const updates = {};
    TARGET_KEYS.forEach(k => {
      const val = fd.get(`mf_${k}`);
      if (val && val.trim() !== "") updates[k] = val.trim();
    });
    
    const submitData = new FormData();
    submitData.append("intent", "bulk_edit_new");
    submitData.append("ids", JSON.stringify(selectedResources));
    submitData.append("updates", JSON.stringify(updates));
    submitData.append("ooakText", fd.get("ooakText") || "");
    submit(submitData, { method: "post" });
  };

  const rowMarkup = products.map(({ id, title, status, image }, index) => (
    <IndexTable.Row id={id} key={id} selected={selectedResources.includes(id)} position={index}>
      <IndexTable.Cell>
        <Thumbnail source={image || ImageIcon} alt={title} size="small" />
      </IndexTable.Cell>
      <IndexTable.Cell><Text fontWeight="bold">{title}</Text></IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={status === "Complete" ? "success" : status === "Partial" ? "warning" : "critical"}>
          {status}
        </Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <form onSubmit={handleBulkSave}>
      <Layout>
        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Apply Data Fields</Text>
                <Text tone="subdued">Fields left blank are ignored. Filled fields will overwrite existing data on all selected stones.</Text>
                <Scrollable style={{ maxHeight: "50vh" }}>
                  <FormLayout>
                    <TextField label="OOAK Features (Appended to Story)" name="ooakText" autoComplete="off"/>
                    {TARGET_KEYS.map(key => (
                      <TextField key={key} label={key.replace(/_/g, " ").toUpperCase()} name={`mf_${key}`} autoComplete="off"/>
                    ))}
                  </FormLayout>
                </Scrollable>
                <Button submit variant="primary" disabled={selectedResources.length === 0}>
                  Apply to {selectedResources.length} Stones
                </Button>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section>
          <Card padding="0">
            <IndexTable 
              resourceName={{ singular: 'product', plural: 'products' }} 
              itemCount={products.length} 
              selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length} 
              onSelectionChange={handleSelectionChange} 
              headings={[{ title: '' }, { title: 'Title' }, { title: 'Completeness' }]}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>
    </form>
  );
}

function QAInjectView({ products }) {
  const fetcher = useFetcher();
  
  const handleInject = (product) => {
    const fd = new FormData();
    fd.append("intent", "bulkAutoFill");
    fd.append("products", JSON.stringify([product]));
    fetcher.submit(fd, { method: "post" });
  };

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row id={product.id} key={product.id} position={index}>
      <IndexTable.Cell>
        <Thumbnail source={product.image || ImageIcon} alt={product.title} size="small" />
      </IndexTable.Cell>
      <IndexTable.Cell><Text fontWeight="bold">{product.title}</Text></IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={product.status === "Complete" ? "success" : product.status === "Partial" ? "warning" : "critical"}>
          {product.status}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {product.missing.length === 0 ? <Text tone="success">None</Text> : <Text tone="critical">{product.missing.length} Missing</Text>}
        <Text variant="bodySm" tone="subdued">{product.missing.slice(0, 3).join(", ")}{product.missing.length > 3 ? "..." : ""}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button 
          size="slim" 
          onClick={() => handleInject(product)}
          disabled={product.status === "Complete"}
        >
          Inject Missing
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <BlockStack gap="400">
      <Text variant="headingMd">Quality Assurance & Data Injection</Text>
      <Card padding="0">
        <IndexTable 
          resourceName={{ singular: 'product', plural: 'products' }} 
          itemCount={products.length} 
          selectable={false} 
          headings={[{ title: '' }, { title: 'Title' }, { title: 'Status' }, { title: 'Missing Fields' }, { title: 'Action' }]}
        >
          {rowMarkup}
        </IndexTable>
      </Card>
    </BlockStack>
  );
}

function MindatView() {
  const fetcher = useFetcher();
  const isLoading = fetcher.state === "submitting";
  const result = fetcher.data?.result;

  return (
    <BlockStack gap="500">
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">Mindat Geological Lookup</Text>
          <Text tone="subdued">Look up pure minerals to return baseline geological facts. Will not return data for composites or regional rocks.</Text>
          <fetcher.Form method="post">
            <input type="hidden" name="intent" value="mindat_lookup" />
            <InlineStack gap="300" blockAlign="end">
              <Box minWidth="300px">
                <TextField label="Mineral Name" name="query" placeholder="e.g. Quartz, Pyrite" autoComplete="off"/>
              </Box>
              <Button submit variant="primary" loading={isLoading} icon={SearchIcon}>Search Mindat</Button>
            </InlineStack>
          </fetcher.Form>
        </BlockStack>
      </Card>

      {fetcher.data && !result && fetcher.data.found === false && (
        <Banner tone="warning">No mineral found with that exact name.</Banner>
      )}

      {fetcher.data && fetcher.data.error && (
        <Banner tone="critical">{fetcher.data.error}</Banner>
      )}

      {result && (
        <Card>
          <BlockStack gap="400">
            <Text variant="headingLg">{result.name}</Text>
            <Divider/>
            <Grid>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Mohs Hardness:</Text>
                <Text>{result.hardness_min} {result.hardness_max ? `- ${result.hardness_max}` : ""}</Text>
              </Grid.Cell>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Crystal System:</Text>
                <Text>{result.crystal_system || "N/A"}</Text>
              </Grid.Cell>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Luster:</Text>
                <Text>{result.lustre || "N/A"}</Text>
              </Grid.Cell>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Specific Gravity:</Text>
                <Text>{result.density_min} {result.density_max ? `- ${result.density_max}` : ""}</Text>
              </Grid.Cell>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Cleavage:</Text>
                <Text>{result.cleavage || "N/A"}</Text>
              </Grid.Cell>
              <Grid.Cell columnSpan={{xs: 6, sm: 6, md: 4, lg: 4, xl: 4}}>
                <Text fontWeight="bold">Fracture:</Text>
                <Text>{result.fracture || "N/A"}</Text>
              </Grid.Cell>
            </Grid>
          </BlockStack>
        </Card>
      )}
    </BlockStack>
  );
}

export default function MetaInjector() {
  const { products, loaderError } = useLoaderData();
  const [activeView, setActiveView] = useState(0);
  const [menuActive, setMenuActive] = useState(false);

  const views = [
    { id: 0, content: "🪨 Products" },
    { id: 1, content: "📦 Bulk Edit" },
    { id: 2, content: "💉 QA & Inject" },
    { id: 3, content: "🌍 Mindat" }
  ];

  const currentViewTitle = views.find(v => v.id === activeView)?.content || "Menu";

  return (
    <Page title="Meta Injector Command Center" fullWidth>
      <Layout>
        <Layout.Section>
          {loaderError && <Banner tone="critical">Loader error: {loaderError}</Banner>}
          
          <Card padding="0">
            <Box padding="400">
              <Popover 
                active={menuActive} 
                activator={
                  <Button onClick={() => setMenuActive(!menuActive)} icon={MenuIcon} size="large">
                    {currentViewTitle}
                  </Button>
                }
                onClose={() => setMenuActive(false)}
              >
                <ActionList 
                  actionRole="menuitem" 
                  items={views.map((view, index) => ({
                    content: view.content,
                    onAction: () => { 
                      setActiveView(Number(index)); 
                      setMenuActive(false); 
                    },
                  }))}
                />
              </Popover>
            </Box>
            
            <Divider/>
            
            <Box padding="400" background="bg-surface-secondary">
              {activeView === 0 && <ProductsView products={products}/>}
              {activeView === 1 && <BulkEditView products={products}/>}
              {activeView === 2 && <QAInjectView products={products}/>}
              {activeView === 3 && <MindatView/>}
            </Box>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
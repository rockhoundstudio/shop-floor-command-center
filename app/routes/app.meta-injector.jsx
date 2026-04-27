import { useState, useEffect } from "react";
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
  Banner,
  Select,
  Box,
  Popover,
  ActionList,
  Scrollable,
  ProgressBar
} from "@shopify/polaris";
import { MenuIcon } from "@shopify/polaris-icons";

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

function parseDescription(text) {
  const result = {};
  const originMatch = text.match(/(found in|origin[:\s]+|from\s+)([^\n,.]+)/i);
  if (originMatch) result.origin_location = originMatch[2].trim();
  const markMatch = text.match(/(inclusion|vein|crack|mark|scratch|pattern)[:\s]+([^\n,.]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();
  const hardnessMatch = text.match(/(?:hardness|mohs)[\s:]*(\d+\.?\d*\s*[-–]\s*\d+\.?\d*|\d+\.?\d*)/i);
  if (hardnessMatch) result.hardness = hardnessMatch[1].trim();
  return result;
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
                featuredImage { url altText }
                metafields(first: 50, namespace: "custom") {
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
            edges { node { id title handle } }
          }
        }
      `)
    ]);

    const productsData = await productsRes.json();
    const collectionsData = await collectionsRes.json();

    const products = (productsData.data?.products?.edges || []).map(({ node }) => {
      const productMetafields = {};
      (node.metafields?.edges || []).forEach(({ node: mf }) => {
        if (METAFIELDS.some(m => m.key === mf.key)) {
          productMetafields[mf.key] = mf.value;
        }
      });

      const filledCount = Object.keys(productMetafields).filter(k => productMetafields[k]).length;
      let status = "🔴 Empty";
      if (filledCount === METAFIELDS.length) status = "✅ Complete";
      else if (filledCount > 0) status = "⚠️ Partial";

      return {
        id: node.id,
        title: node.title,
        description: stripHtml(node.descriptionHtml),
        featuredImage: node.featuredImage,
        metafields: productMetafields,
        status,
        filledCount,
        currentCollections: (node.collections?.edges || []).map(({ node: c }) => ({ id: c.id, title: c.title })),
      };
    });

    const collections = (collectionsData.data?.collections?.edges || [])
      .map(({ node }) => node)
      .filter((c) => c.handle !== "all-collections" && c.title !== "all collections");

    return data({ products, collections });
  } catch (error) {
    return data({ products: [], collections: [] });
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
        const val = updates[key];
        metafields.push({
          ownerId,
          namespace: "custom",
          key,
          value: val || "",
          type: "single_line_text_field"
        });
      });
    });

    if (metafields.length > 0) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }
      `, { variables: { metafields } });
    }
    return data({ ok: true, intent });
  }

  if (intent === "build_payload") {
    const productId = formData.get("productId");
    const title = formData.get("title");
    const description = formData.get("description");
    const existingMeta = JSON.parse(formData.get("existingMeta"));

    const parsedData = parseDescription(description);
    let mindatData = {};

    try {
      const res = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(title)}&format=json`, {
        headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.results?.[0]) {
          mindatData = {
            hardness: json.results[0].hardness,
            where_found: json.results[0].localities,
            geological_age: json.results[0].geological_age
          };
        }
      }
    } catch (e) {}

    const payloadLines = [];
    METAFIELDS.forEach(f => {
      if (existingMeta[f.key]) return; 

      let val = mindatData[f.key] || parsedData[f.key];
      let isVerified = !!mindatData[f.key];

      if (val) {
        const finalVal = isVerified ? val : `⚠️ ${val}`;
        payloadLines.push(JSON.stringify({
          ownerId: productId,
          namespace: "custom",
          key: f.key,
          value: finalVal,
          type: "single_line_text_field"
        }));
      }
    });

    return data({ ok: true, intent, payload: payloadLines.join("\n") });
  }

  if (intent === "inject") {
    const payload = formData.get("payload");
    const lines = payload.split("\n").filter(Boolean);
    const metafields = [];
    for (const line of lines) {
      try { metafields.push(JSON.parse(line)); } catch {}
    }
    let injected = 0;
    for (let i = 0; i < metafields.length; i += 5) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) { userErrors { field message } }
        }
      `, { variables: { metafields: metafields.slice(i, i + 5) } });
      injected += metafields.slice(i, i + 5).length;
    }
    return data({ ok: true, injected });
  }

  if (intent === "createCollection") {
    const title = formData.get("title");
    await admin.graphql(`mutation collectionCreate($input: CollectionInput!) { collectionCreate(input: $input) { userErrors { field message } } }`, { variables: { input: { title } } });
    return data({ ok: true });
  }

  if (intent === "deleteCollection") {
    const id = formData.get("id");
    await admin.graphql(`mutation collectionDelete($input: CollectionDeleteInput!) { collectionDelete(input: $input) { userErrors { field message } } }`, { variables: { input: { id } } });
    return data({ ok: true });
  }

  if (intent === "assignCollection") {
    const productId = formData.get("productId");
    const collectionId = formData.get("collectionId");
    await admin.graphql(`mutation collectionAddProducts($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { userErrors { field message } } }`, { variables: { id: collectionId, productIds: [productId] } });
    return data({ ok: true });
  }

  if (intent === "mindat_lookup") {
    const query = formData.get("query");
    try {
      const res = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(query)}&format=json`, {
        headers: { Authorization: `Token ${process.env.MINDAT_API_KEY}` }
      });
      if (res.ok) {
        const json = await res.json();
        if (json.results?.[0]) return data({ ok: true, intent, found: true, result: json.results[0] });
      }
    } catch (e) {}
    return data({ ok: true, intent, found: false });
  }

  return data({ ok: false });
};

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

  const currentNames = product.currentCollections.map((c) => c.title).join(", ") || "None";

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="center">
          <img src={product.featuredImage?.url || ""} alt={product.title} style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px" }} />
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
            <Text variant="bodySm" tone="subdued">Currently in: {currentNames}</Text>
          </BlockStack>
        </InlineStack>

        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <Select label="Manual assign" options={[{ label: "-- Pick a collection --", value: "" }, ...collections.map((c) => ({ label: c.title, value: c.id }))]} value={manualAssign} onChange={setManualAssign} />
          </div>
          <Button variant="primary" disabled={!manualAssign} onClick={() => handleAssign(product.id, manualAssign)} loading={fetcher.state === "submitting"}>Assign</Button>
        </InlineStack>

        {fetcher.data?.ok && fetcher.data?.intent === "assignCollection" && (
          <Banner tone="success">Assigned successfully!</Banner>
        )}
      </BlockStack>
    </Card>
  );
}

function CollectionsTab({ products, collections, fetcher, onBack }) {
  const [newCollTitle, setNewCollTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleCreate = () => {
    if (!newCollTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "createCollection");
    fd.append("title", newCollTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setNewCollTitle("");
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
              <TextField label="Collection name" value={newCollTitle} onChange={setNewCollTitle} placeholder="e.g. Jasper, Freeforms..." autoComplete="off" />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={!newCollTitle.trim()}>Create</Button>
          </InlineStack>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">🗂️ Existing Collections</Text>
          {collections.map((c) => (
            <InlineStack key={c.id} align="space-between" blockAlign="center" gap="300">
              <Text variant="bodyMd">{c.title}</Text>
              <Button size="slim" tone="critical" onClick={() => setDeleteTarget(c)}>Delete</Button>
            </InlineStack>
          ))}
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
          <Text variant="headingMd">🪨 Assign Products</Text>
          {products.map((product) => (
            <ProductCollectionCard key={product.id} product={product} collections={collections} />
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}

export default function MetaInjector() {
  const { products, collections } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
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
  const [mindatName, setMindatName] = useState("");

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

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

  const handleAutoInject = () => {
    if (!injectProduct) return;
    const product = products.find((p) => p.id === injectProduct);
    if (!product) return;

    const fd = new FormData();
    fd.append("intent", "build_payload");
    fd.append("productId", product.id);
    fd.append("title", product.title);
    fd.append("description", product.description);
    fd.append("existingMeta", JSON.stringify(product.metafields));
    fetcher.submit(fd, { method: "post" });
  };

  useEffect(() => {
    if (fetcher.data?.intent === "build_payload" && fetcher.data?.payload !== undefined) {
      setPayload(fetcher.data.payload);
    }
  }, [fetcher.data]);

  const handleInject = () => {
    const fd = new FormData();
    fd.append("intent", "inject");
    fd.append("payload", payload);
    fetcher.submit(fd, { method: "post" });
  };

  const handleMindat = () => {
    const fd = new FormData();
    fd.append("intent", "mindat_lookup");
    fd.append("query", mindatName);
    fetcher.submit(fd, { method: "post" });
  };

  const allIds = filtered.map((p) => p.id);
  const allChecked = filtered.length > 0 && checkedIds.length === filtered.length;

  const tabs = [
    { id: "products", content: "🪨 Products" },
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
    { id: "collections", content: "🗂️ Collections" }
  ];

  return (
    <Page title="Meta Injector 🪨" fullWidth>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="400">
              
              <Box padding="400">
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
              </Box>

              <Box paddingInlineStart="400" paddingInlineEnd="400" paddingBlockEnd="400">
                {isProcessing && (
                  <Box paddingBlockEnd="400">
                    <Banner tone="info" title="Bulk Operation in Progress">
                      <BlockStack gap="200">
                        <Text variant="bodyMd" as="p">
                          Processing {progress.current} of {progress.total} — {progress.title}...
                        </Text>
                        <ProgressBar progress={(progress.current / progress.total) * 100} size="small" tone="primary" />
                      </BlockStack>
                    </Banner>
                  </Box>
                )}

                {tabIndex === 0 && (
                  <BlockStack gap="400">
                    <TextField label="Search stones" value={search} onChange={setSearch} placeholder="Type a stone name..." clearButton onClearButtonClick={() => setSearch("")} autoComplete="off" />
                    
                    <Card padding="0">
                      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                         <thead>
                            <tr style={{ borderBottom: "1px solid #ebebeb", background: "#f9f9f9" }}>
                               <th style={{ padding: "12px 16px" }}><Text fontWeight="bold">Image</Text></th>
                               <th style={{ padding: "12px 16px" }}><Text fontWeight="bold">Product Title</Text></th>
                               <th style={{ padding: "12px 16px" }}><Text fontWeight="bold">Status</Text></th>
                            </tr>
                         </thead>
                         <tbody>
                            {filtered.map(p => (
                               <tr key={p.id} style={{ borderBottom: "1px solid #ebebeb" }}>
                                  <td style={{ padding: "12px 16px" }}>
                                     <img src={p.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"} style={{ width: "40px", height: "40px", objectFit: "cover", borderRadius: "4px" }} />
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                     <Text variant="bodyMd" fontWeight="500">{p.title}</Text>
                                  </td>
                                  <td style={{ padding: "12px 16px" }}>
                                     <Badge tone={p.status === "✅ Complete" ? "success" : p.status === "🔴 Empty" ? "critical" : "warning"}>
                                        {p.status} ({p.filledCount}/{METAFIELDS.length})
                                     </Badge>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                    </Card>
                  </BlockStack>
                )}

                {tabIndex === 1 && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                    <BlockStack gap="300">
                      <Text variant="headingMd">Select Products ({checkedIds.length} chosen)</Text>
                      <InlineStack gap="200">
                        <Button onClick={() => setCheckedIds(allChecked ? [] : allIds)}>
                          {allChecked ? "Deselect All" : "Select All"}
                        </Button>
                      </InlineStack>
                      <Card padding="0">
                        <Scrollable style={{ height: "600px" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                             <tbody>
                                {filtered.map((p) => (
                                  <tr key={p.id} style={{ borderBottom: "1px solid #ebebeb", cursor: "pointer" }} onClick={() => {
                                      if (checkedIds.includes(p.id)) setCheckedIds(checkedIds.filter(id => id !== p.id));
                                      else setCheckedIds([...checkedIds, p.id]);
                                  }}>
                                    <td style={{ padding: "8px 12px", width: "40px" }} onClick={e => e.stopPropagation()}>
                                      <Checkbox
                                        label=""
                                        checked={checkedIds.includes(p.id)}
                                        onChange={(checked) => {
                                          if (checked) setCheckedIds([...checkedIds, p.id]);
                                          else setCheckedIds(checkedIds.filter((id) => id !== p.id));
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: "8px" }}>
                                      <InlineStack gap="300" blockAlign="center">
                                        <img src={p.featuredImage?.url || ""} style={{ width: "32px", height: "32px", objectFit: "cover", borderRadius: "4px" }} />
                                        <Text variant="bodySm" fontWeight="500">{p.title}</Text>
                                      </InlineStack>
                                    </td>
                                  </tr>
                                ))}
                             </tbody>
                          </table>
                        </Scrollable>
                      </Card>
                    </BlockStack>
                    
                    <BlockStack gap="300">
                      <Text variant="headingMd">Fields to Update</Text>
                      <Banner tone="info">Tick a box to open the input. Only ticked fields will be written.</Banner>
                      <Card padding="0">
                        <Scrollable style={{ height: "550px" }}>
                           <BlockStack gap="300" padding="400">
                              {METAFIELDS.map(f => (
                                 <BlockStack key={f.key} gap="100">
                                    <Checkbox 
                                       label={f.name} 
                                       checked={tickedFields[f.key] || false} 
                                       onChange={() => setTickedFields(prev => ({...prev, [f.key]: !prev[f.key]}))} 
                                    />
                                    {tickedFields[f.key] && (
                                        <TextField
                                           label=""
                                           value={fieldValues[f.key] || ""}
                                           onChange={(v) => setFieldValues({ ...fieldValues, [f.key]: v })}
                                           placeholder={`Enter ${f.name}...`}
                                           autoComplete="off"
                                        />
                                    )}
                                 </BlockStack>
                              ))}
                           </BlockStack>
                        </Scrollable>
                      </Card>
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
                    <Button variant="primary" onClick={handleAutoInject} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "build_payload"} disabled={!injectProduct}>
                      🔄 Build Payload
                    </Button>
                    {fetcher.data?.intent === "build_payload" && <Banner tone="success">Payload built — review and edit below, then inject.</Banner>}
                    <TextField
                      label="JSON Payload (one object per line — edit before injecting)"
                      value={payload}
                      onChange={setPayload}
                      multiline={12}
                      autoComplete="off"
                    />
                    <Button variant="primary" onClick={handleInject} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "inject"} disabled={!payload}>
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
                    <Button variant="primary" onClick={handleMindat} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "mindat_lookup"}>
                      🌍 Lookup
                    </Button>
                    {fetcher.data?.intent === "mindat_lookup" && fetcher.data?.found && (
                       <Banner tone="success">Found! Verify details in JSON payload builder.</Banner>
                    )}
                    {fetcher.data?.intent === "mindat_lookup" && !fetcher.data?.found && (
                       <Banner tone="warning">No results found for "{mindatName}".</Banner>
                    )}
                  </BlockStack>
                )}

                {tabIndex === 4 && (
                  <CollectionsTab products={products} collections={collections} fetcher={fetcher} onBack={() => setTabIndex(0)} />
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
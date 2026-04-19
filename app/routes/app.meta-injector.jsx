import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
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
  Tabs,
  FormLayout,
  Banner,
  Select,
  Tooltip,
  Icon,
  Grid,
} from "@shopify/polaris";
import { QuestionCircleIcon } from "@shopify/polaris-icons";

const TAXONOMY = {
  crystal_system: {
    label: "Crystal Structure",
    namespace: "shopify",
    key: "crystal-system",
    help: "The geometric arrangement of atoms in the mineral",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Monoclinic", value: "gid://shopify/Metaobject/151951212795" },
      { label: "Trigonal", value: "gid://shopify/Metaobject/154252116219" },
      { label: "Hexagonal", value: "gid://shopify/Metaobject/154307625211" },
      { label: "Triclinic", value: "gid://shopify/Metaobject/154308706555" },
      { label: "+ Add New", value: "__add__" },
    ],
    metaobjectType: "crystal-system",
  },
  mineral_class: {
    label: "Mineral Class",
    namespace: "shopify",
    key: "mineral-class",
    help: "Scientific classification based on chemical composition",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Silicates", value: "gid://shopify/Metaobject/151951278331" },
      { label: "Oxides", value: "gid://shopify/Metaobject/155431371003" },
      { label: "Carbonates", value: "gid://shopify/Metaobject/156128313595" },
      { label: "+ Add New", value: "__add__" },
    ],
    metaobjectType: "mineral-class",
  },
  rock_formation: {
    label: "Rock Formation",
    namespace: "shopify",
    key: "rock-formation",
    help: "The geological process that formed this rock",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Metamorphic", value: "gid://shopify/Metaobject/151951343867" },
      { label: "Igneous", value: "gid://shopify/Metaobject/154251985147" },
      { label: "Sedimentary", value: "gid://shopify/Metaobject/154307657979" },
      { label: "+ Add New", value: "__add__" },
    ],
    metaobjectType: "rock-formation",
  },
  geological_era: {
    label: "Geological Era",
    namespace: "shopify",
    key: "geological-era",
    help: "The time period when this rock was formed",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Precambrian", value: "gid://shopify/Metaobject/151951245563" },
      { label: "Paleozoic", value: "gid://shopify/Metaobject/156128379131" },
      { label: "Mesozoic", value: "gid://shopify/Metaobject/154252083451" },
      { label: "Cenozoic", value: "gid://shopify/Metaobject/154307854587" },
      { label: "+ Add New", value: "__add__" },
    ],
    metaobjectType: "geological-era",
  },
  rock_composition: {
    label: "Rock Composition",
    namespace: "shopify",
    key: "rock-composition",
    help: "The primary rock or mineral matrix",
    options: [
      { label: "-- Select --", value: "" },
      { label: "Granite", value: "gid://shopify/Metaobject/151951311099" },
      { label: "Obsidian", value: "gid://shopify/Metaobject/155431338235" },
      { label: "Andesite", value: "gid://shopify/Metaobject/156128411899" },
      { label: "Schist", value: "gid://shopify/Metaobject/156128477435" },
      { label: "+ Add New", value: "__add__" },
    ],
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

// Extract plain text from HTML description
function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

// Try to extract values from product description text
function parseDescription(text) {
  const result = {};
  const lower = text.toLowerCase();

  // Color/pattern
  const colorMatch = text.match(/colou?r[:\s]+([^\n,.]+)/i);
  if (colorMatch) result.color_pattern = colorMatch[1].trim();

  // Measurements/dimensions
  const sizeMatch = text.match(/(\d+[\d\s.x×*by]+\d+\s*(mm|cm|in|inch)?)/i);
  if (sizeMatch) result.measurements = sizeMatch[1].trim();

  // Weight
  const weightMatch = text.match(/(\d+\.?\d*\s*(g|gram|oz|lb))/i);
  if (weightMatch) result.weight = weightMatch[1].trim();

  // Where found / origin
  const originMatch = text.match(/(found in|origin[:\s]+|from\s+)([^\n,.]+)/i);
  if (originMatch) result.origin_location = originMatch[2].trim();

  // Character marks
  const markMatch = text.match(/(inclusion|vein|crack|mark|scratch|pattern)[:\s]+([^\n,.]+)/i);
  if (markMatch) result.character_marks = markMatch[0].trim();

  return result;
}

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`
    query {
      products(first: 100) {
        edges {
          node {
            id
            title
            descriptionHtml
            featuredImage { url altText }
            metafields(first: 20, namespace: "geology") {
              edges { node { key value } }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  const products = data.data.products.edges.map(({ node }) => ({
    ...node,
    description: stripHtml(node.descriptionHtml),
    metafields: Object.fromEntries(
      node.metafields.edges.map(({ node: mf }) => [mf.key, mf.value])
    ),
  }));
  return { products };
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
        if (val && val !== "__add__") {
          metafields.push({
            ownerId,
            namespace: "shopify",
            key: TAXONOMY[fieldKey].key,
            value: `["${val}"]`,
            type: "list.metaobject_reference",
          });
        }
      });
      TEXT_FIELDS.forEach(({ key }) => {
        const val = formData.get(key);
        if (val) {
          metafields.push({
            ownerId,
            namespace: "geology",
            key,
            value: val,
            type: "single_line_text_field",
          });
        }
      });
    });
    const batchSize = 6;
    for (let i = 0; i < metafields.length; i += batchSize) {
      const batch = metafields.slice(i, i + batchSize);
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }
      `, { variables: { metafields: batch } });
    }
    return { ok: true, intent };
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
    `, {
      variables: {
        metaobject: {
          type: metaobjectType,
          fields: [{ key: "name", value: name }],
        },
      },
    });
    const json = await result.json();
    const newObj = json.data?.metaobjectCreate?.metaobject;
    return { ok: true, intent: "addTaxonomy", newId: newObj?.id, name, metaobjectType };
  }

  if (intent === "inject") {
    const payload = formData.get("payload");
    const lines = payload.split("\n").filter(Boolean);
    const metafields = [];
    for (const line of lines) {
      try { metafields.push(JSON.parse(line)); } catch {}
    }
    const batchSize = 2;
    let injected = 0;
    for (let i = 0; i < metafields.length; i += batchSize) {
      const batch = metafields.slice(i, i + batchSize);
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }
      `, { variables: { metafields: batch } });
      injected += batch.length;
    }
    return { ok: true, injected };
  }

  return { ok: false };
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
      const data = await res.json();
      const mineral = data.results?.[0];
      if (!mineral) { setStatus("notfound"); return; }
      const compared = COMPARE_FIELDS.map(({ key, mindatKey, label }) => ({
        label,
        store: product.metafields[key] || "—",
        mindat: mineral[mindatKey] || "—",
        match:
          (product.metafields[key] || "").toLowerCase().trim() ===
          (mineral[mindatKey] || "").toLowerCase().trim(),
      }));
      setResults(compared);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  return (
    <BlockStack gap="200">
      <Button size="slim" onClick={verify} loading={status === "loading"}>
        🔍 Verify vs Mindat
      </Button>
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

export default function MetaInjector() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [form, setForm] = useState({});
  const [bulkForm, setBulkForm] = useState({});
  const [tabIndex, setTabIndex] = useState(0);
  const [payload, setPayload] = useState("");
  const [injectProduct, setInjectProduct] = useState("");
  const [injectStatus, setInjectStatus] = useState(null);
  const [mindatName, setMindatName] = useState("");
  const [mindatStatus, setMindatStatus] = useState(null);
  const [addingNew, setAddingNew] = useState({});
  const [newName, setNewName] = useState({});

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (product) => {
    setSelected(product);
    setForm({ ...product.metafields });
    setTabIndex(1);
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

    // Parse description for physical data
    const descData = parseDescription(product.description || "");

    // Query Mindat for geological data
    let mindatData = {};
    try {
      const res = await fetch(
        `https://api.mindat.org/minerals/?name=${encodeURIComponent(product.title)}&format=json`,
        { headers: { Authorization: "Token YOUR_MINDAT_API_TOKEN" } }
      );
      const data = await res.json();
      const mineral = data.results?.[0];
      if (mineral) {
        mindatData = {
          hardness: mineral.hardness || "",
          where_found: mineral.localities || "",
          geological_age: mineral.geological_age || "",
        };
      }
    } catch {}

    // Build JSON payload lines
    const lines = [];

    // Text fields from Mindat + description
    const textData = { ...descData, ...mindatData };
    TEXT_FIELDS.forEach(({ key }) => {
      if (textData[key]) {
        lines.push(JSON.stringify({
          ownerId: product.id,
          namespace: "geology",
          key,
          value: textData[key],
          type: "single_line_text_field",
        }));
      }
    });

    // Taxonomy fields — leave as placeholders for user to review
    Object.keys(TAXONOMY).forEach((fieldKey) => {
      const config = TAXONOMY[fieldKey];
      lines.push(JSON.stringify({
        ownerId: product.id,
        namespace: "shopify",
        key: config.key,
        value: `["REPLACE_WITH_GID"]`,
        type: "list.metaobject_reference",
        _note: `Select correct ${config.label} GID from dropdown`,
      }));
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
      const data = await res.json();
      const mineral = data.results?.[0];
      if (mineral) {
        setForm({
          hardness: mineral.hardness || "",
          where_found: mineral.localities || "",
          geological_age: mineral.geological_age || "",
        });
        setMindatStatus("found");
        setTabIndex(1);
      } else {
        setMindatStatus("notfound");
      }
    } catch {
      setMindatStatus("error");
    }
  };

  const allIds = products.map((p) => p.id);
  const allChecked = checkedIds.length === products.length;

  const tabs = [
    { id: "grid", content: "🪨 Products" },
    { id: "form", content: "✏️ Edit Stone" },
    { id: "check", content: "🔍 Check Meta" },
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
  ];

  function TaxonomyField({ fieldKey, isBulk }) {
    const config = TAXONOMY[fieldKey];
    const currentForm = isBulk ? bulkForm : form;
    return (
      <BlockStack gap="200">
        <Select
          label={<LabelWithHelp label={config.label} help={config.help} />}
          options={config.options}
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
  }

  return (
    <Page title="Meta Injector 🪨">
      <Layout>
        <Layout.Section>
          <Card>
            <Tabs tabs={tabs} selected={tabIndex} onSelect={setTabIndex}>

              {tabIndex === 0 && (
                <BlockStack gap="400">
                  <TextField
                    label="Search stones"
                    value={search}
                    onChange={setSearch}
                    placeholder="Type a stone name..."
                    clearButton
                    onClearButtonClick={() => setSearch("")}
                    autoComplete="off"
                  />
                  <Grid>
                    {filtered.map((product) => (
                      <Grid.Cell key={product.id} columnSpan={{ xs: 6, sm: 4, md: 3, lg: 3 }}>
                        <div
                          onClick={() => handleSelect(product)}
                          style={{ cursor: "pointer", border: "1px solid #e1e3e5", borderRadius: "8px", overflow: "hidden", textAlign: "center" }}
                        >
                          <img
                            src={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
                            alt={product.title}
                            style={{ width: "100%", height: "140px", objectFit: "cover" }}
                          />
                          <div style={{ padding: "8px" }}>
                            <Text variant="bodySm" fontWeight="bold">{product.title}</Text>
                            <Badge tone={completeness(product.metafields)}>
                              {completenessLabel(product.metafields)}
                            </Badge>
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
                        {Object.keys(TAXONOMY).map((fieldKey) => (
                          <TaxonomyField key={fieldKey} fieldKey={fieldKey} isBulk={false} />
                        ))}
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
                  <Banner tone="info">
                    Compares your store metafields against Mindat.org data. Requires Mindat API token.
                  </Banner>
                  {products.map((p) => (
                    <Card key={p.id}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" fontWeight="bold">{p.title}</Text>
                          <Badge tone={completeness(p.metafields)}>
                            {completenessLabel(p.metafields)}
                          </Badge>
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
                        {products.map((p) => (
                          <InlineStack key={p.id} gap="200" blockAlign="center">
                            <Checkbox
                              label=""
                              checked={checkedIds.includes(p.id)}
                              onChange={(checked) => {
                                if (checked) setCheckedIds([...checkedIds, p.id]);
                                else setCheckedIds(checkedIds.filter((id) => id !== p.id));
                              }}
                            />
                            <img
                              src={p.featuredImage?.url || ""}
                              alt={p.title}
                              style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px" }}
                            />
                            <Text variant="bodySm">{p.title}</Text>
                          </InlineStack>
                        ))}
                      </BlockStack>
                    </div>
                  </BlockStack>

                  <BlockStack gap="300">
                    <Text variant="headingMd">Apply to {checkedIds.length} Stone(s)</Text>
                    <FormLayout>
                      {Object.keys(TAXONOMY).map((fieldKey) => (
                        <TaxonomyField key={fieldKey} fieldKey={fieldKey} isBulk={true} />
                      ))}
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
                    <Button
                      variant="primary"
                      onClick={handleBulk}
                      disabled={checkedIds.length === 0}
                      loading={fetcher.state === "submitting"}
                    >
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
                    options={[
                      { label: "-- Pick a stone --", value: "" },
                      ...products.map((p) => ({ label: p.title, value: p.id })),
                    ]}
                    value={injectProduct}
                    onChange={setInjectProduct}
                  />
                  <Button
                    variant="primary"
                    onClick={handleAutoInject}
                    loading={injectStatus === "loading"}
                    disabled={!injectProduct}
                  >
                    🔄 Build Payload
                  </Button>
                  {injectStatus === "ready" && (
                    <Banner tone="success">Payload built from description + Mindat — review and edit below, then inject.</Banner>
                  )}
                  {injectStatus === "error" && (
                    <Banner tone="critical">Could not build payload. Check product and Mindat token.</Banner>
                  )}
                  <TextField
                    label="JSON Payload (one object per line — edit before injecting)"
                    value={payload}
                    onChange={setPayload}
                    multiline={12}
                    placeholder={`{"ownerId":"gid://shopify/Product/123","namespace":"shopify","key":"mineral-class","value":"[\\"gid://shopify/Metaobject/151951278331\\"]","type":"list.metaobject_reference"}`}
                    autoComplete="off"
                  />
                  <Button
                    variant="primary"
                    onClick={handleInject}
                    loading={fetcher.state === "submitting"}
                    disabled={!payload}
                  >
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

            </Tabs>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong loading Meta Injector.</div>;
}

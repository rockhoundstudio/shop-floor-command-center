import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  TextField,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Checkbox,
  Badge,
  Tabs,
  FormLayout,
  Banner,
} from "@shopify/polaris";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(`
    query {
      products(first: 100) {
        edges {
          node {
            id
            title
            featuredImage {
              url
              altText
            }
            metafields(first: 20, namespace: "geology") {
              edges {
                node {
                  key
                  value
                }
              }
            }
          }
        }
      }
    }
  `);
  const data = await response.json();
  const products = data.data.products.edges.map(({ node }) => ({
    ...node,
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
    const fields = {
      crystal_structure: formData.get("crystal_structure"),
      mineral_class: formData.get("mineral_class"),
      rock_formation: formData.get("rock_formation"),
      geological_era: formData.get("geological_era"),
      rock_composition: formData.get("rock_composition"),
      hardness: formData.get("hardness"),
      where_found: formData.get("where_found"),
      geological_age: formData.get("geological_age"),
    };
    const metafields = ids.flatMap((id) =>
      Object.entries(fields)
        .filter(([, v]) => v)
        .map(([key, value]) => ({
          ownerId: id,
          namespace: "geology",
          key,
          value,
          type: "single_line_text_field",
        }))
    );
    await admin.graphql(`
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { key value }
          userErrors { field message }
        }
      }
    `, { variables: { metafields } });
    return { ok: true, intent };
  }

  if (intent === "inject") {
    const payload = formData.get("payload");
    const lines = payload.split("\n").filter(Boolean);
    const metafields = [];
    for (const line of lines) {
      try { metafields.push(JSON.parse(line)); } catch {}
    }
    if (metafields.length > 0) {
      await admin.graphql(`
        mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { key value }
            userErrors { field message }
          }
        }
      `, { variables: { metafields } });
    }
    return { ok: true, injected: metafields.length };
  }

  return { ok: false };
};

const FIELDS = [
  { key: "crystal_structure", label: "Crystal Structure" },
  { key: "mineral_class", label: "Mineral Class" },
  { key: "rock_formation", label: "Rock Formation" },
  { key: "geological_era", label: "Geological Era" },
  { key: "rock_composition", label: "Rock Composition" },
  { key: "hardness", label: "Hardness" },
  { key: "where_found", label: "Where Found" },
  { key: "geological_age", label: "Geological Age" },
];

function completeness(metafields) {
  const filled = FIELDS.filter((f) => metafields[f.key]).length;
  if (filled === 8) return "success";
  if (filled === 0) return "critical";
  return "warning";
}

function completenessLabel(metafields) {
  const filled = FIELDS.filter((f) => metafields[f.key]).length;
  if (filled === 8) return "Complete";
  if (filled === 0) return "Empty";
  return `${filled}/8 fields`;
}

export default function MetaInjector() {
  const { products } = useLoaderData();
  const fetcher = useFetcher();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [checkedIds, setCheckedIds] = useState([]);
  const [form, setForm] = useState({});
  const [tabIndex, setTabIndex] = useState(0);
  const [payload, setPayload] = useState("");
  const [mindatName, setMindatName] = useState("");
  const [mindatStatus, setMindatStatus] = useState(null);

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (product) => {
    setSelected(product);
    setForm({ ...product.metafields });
    setTabIndex(1);
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append("intent", "save");
    fd.append("ids", JSON.stringify([selected.id]));
    FIELDS.forEach((f) => fd.append(f.key, form[f.key] || ""));
    fetcher.submit(fd, { method: "post" });
  };

  const handleBulk = () => {
    const fd = new FormData();
    fd.append("intent", "bulk");
    fd.append("ids", JSON.stringify(checkedIds));
    FIELDS.forEach((f) => fd.append(f.key, form[f.key] || ""));
    fetcher.submit(fd, { method: "post" });
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
          crystal_structure: mineral.crystal_system || "",
          mineral_class: mineral.mineral_class || "",
          rock_formation: mineral.rock_formation || "",
          geological_era: mineral.geological_era || "",
          rock_composition: mineral.chemical_formula || "",
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

  const tabs = [
    { id: "grid", content: "🪨 Products" },
    { id: "form", content: "✏️ Edit Stone" },
    { id: "check", content: "🔍 Check Meta" },
    { id: "bulk", content: "📦 Bulk Edit" },
    { id: "inject", content: "💉 Inject" },
    { id: "mindat", content: "🌍 Mindat" },
  ];

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
                  <ResourceList
                    resourceName={{ singular: "stone", plural: "stones" }}
                    items={filtered}
                    renderItem={(product) => (
                      <ResourceItem
                        id={product.id}
                        onClick={() => handleSelect(product)}
                        media={
                          <Thumbnail
                            source={product.featuredImage?.url || ""}
                            alt={product.featuredImage?.altText || product.title}
                            size="medium"
                          />
                        }
                      >
                        <InlineStack align="space-between">
                          <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
                          <Badge tone={completeness(product.metafields)}>
                            {completenessLabel(product.metafields)}
                          </Badge>
                        </InlineStack>
                      </ResourceItem>
                    )}
                  />
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
                        {FIELDS.map((f) => (
                          <TextField
                            key={f.key}
                            label={f.label}
                            value={form[f.key] || ""}
                            onChange={(v) => setForm({ ...form, [f.key]: v })}
                            autoComplete="off"
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
                <BlockStack gap="300">
                  <Text variant="headingMd">Metafield Status Report</Text>
                  {products.map((p) => (
                    <InlineStack key={p.id} align="space-between">
                      <Text>{p.title}</Text>
                      <Badge tone={completeness(p.metafields)}>
                        {completenessLabel(p.metafields)}
                      </Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
              {tabIndex === 3 && (
                <BlockStack gap="400">
                  <Text variant="headingMd">Select stones then apply values to all at once.</Text>
                  <BlockStack gap="200">
                    {products.map((p) => (
                      <Checkbox
                        key={p.id}
                        label={p.title}
                        checked={checkedIds.includes(p.id)}
                        onChange={(checked) => {
                          if (checked) setCheckedIds([...checkedIds, p.id]);
                          else setCheckedIds(checkedIds.filter((id) => id !== p.id));
                        }}
                      />
                    ))}
                  </BlockStack>
                  <FormLayout>
                    {FIELDS.map((f) => (
                      <TextField
                        key={f.key}
                        label={f.label}
                        value={form[f.key] || ""}
                        onChange={(v) => setForm({ ...form, [f.key]: v })}
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
              )}
              {tabIndex === 4 && (
                <BlockStack gap="400">
                  <Text variant="headingMd">Paste one JSON metafield object per line.</Text>
                  <TextField
                    label="GID Payload"
                    value={payload}
                    onChange={setPayload}
                    multiline={8}
                    placeholder={`{"ownerId":"gid://shopify/Product/123","namespace":"geology","key":"hardness","value":"7","type":"single_line_text_field"}`}
                    autoComplete="off"
                  />
                  <Button variant="primary" onClick={handleInject} loading={fetcher.state === "submitting"}>
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
                  {mindatStatus === "found" && (
                    <Banner tone="success">Found! Fields pre-filled — switch to Edit Stone to review and save.</Banner>
                  )}
                  {mindatStatus === "notfound" && (
                    <Banner tone="warning">No results found for "{mindatName}".</Banner>
                  )}
                  {mindatStatus === "error" && (
                    <Banner tone="critical">Lookup failed. Check your Mindat API token.</Banner>
                  )}
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

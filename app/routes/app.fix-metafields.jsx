import { useActionData, useNavigate, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";

const TARGETS = [
  { id: "gid://shopify/MetafieldDefinition/186700136699", key: "origin_story", name: "Origin Story" },
  { id: "gid://shopify/MetafieldDefinition/186700202235", key: "honest_flaws_and_character", name: "Honest Flaws and Character" },
  { id: "gid://shopify/MetafieldDefinition/186700235003", key: "artist_notes", name: "Artist Notes" },
];

export async function loader({ request }) {
  await authenticate.admin(request);
  return null;
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const results = [];

  // Query for the cut_and_shape and color metafield definitions in the rockhound namespace
  const defsRes = await admin.graphql(`#graphql
    query {
      metafieldDefinitions(first: 50, ownerType: PRODUCT, namespace: "rockhound") {
        edges {
          node {
            id
            key
          }
        }
      }
    }
  `);
  const defsData = await defsRes.json();
  const edges = defsData.data.metafieldDefinitions.edges;
  
  const cutShapeNode = edges.find(e => e.node.key === "cut_and_shape")?.node;
  const colorNode = edges.find(e => e.node.key === "color")?.node;

  const ALL_TARGETS = [
    ...TARGETS,
    { id: cutShapeNode?.id, key: "cut_and_shape", name: "Cut and Shape" },
    { id: colorNode?.id, key: "color", name: "Color" }
  ];

  for (const field of ALL_TARGETS) {
    // Only attempt to delete if an existing ID was found
    if (field.id) {
      const delRes = await admin.graphql(`#graphql
        mutation {
          metafieldDefinitionDelete(id: "${field.id}", deleteAllAssociatedMetafields: false) {
            deletedDefinitionId
            userErrors { field message }
          }
        }
      `);
      const delData = await delRes.json();
      const delErrors = delData.data.metafieldDefinitionDelete.userErrors;
      results.push({ key: field.key, action: "delete", ok: delErrors.length === 0, error: delErrors[0]?.message });
    } else {
      results.push({ key: field.key, action: "delete", ok: true, error: "Skipped (Did not exist)" });
    }

    const createRes = await admin.graphql(`#graphql
      mutation {
        metafieldDefinitionCreate(definition: {
          namespace: "rockhound"
          key: "${field.key}"
          name: "${field.name}"
          ownerType: PRODUCT
          type: "single_line_text_field"
        }) {
          createdDefinition { id }
          userErrors { field message }
        }
      }
    `);
    const createData = await createRes.json();
    const createErrors = createData.data.metafieldDefinitionCreate.userErrors;
    results.push({ key: field.key, action: "create", ok: createErrors.length === 0, error: createErrors[0]?.message });
  }

  return { results };
}

export default function FixMetafields() {
  const actionData = useActionData();
  const navigate = useNavigate();
  const submit = useSubmit();

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "600px" }}>
      <button
        onClick={() => navigate("/app")}
        aria-label="Back to home"
        style={{ marginBottom: "24px", padding: "12px 24px", fontSize: "18px", cursor: "pointer", borderRadius: "8px", border: "1px solid #ccc" }}
      >
        ← Back
      </button>
      <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Fix 5 Broken Metafields</h1>
      <p style={{ marginBottom: "24px", color: "#555" }}>Targets origin_story, honest_flaws_and_character, artist_notes, cut_and_shape, and color — deletes and recreates as single_line_text_field.</p>
      <button
        onClick={() => submit({}, { method: "post" })}
        aria-label="Fix the 5 broken metafields"
        style={{ padding: "16px 32px", fontSize: "20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", marginBottom: "32px" }}
      >
        Fix 5 Fields Now
      </button>
      {actionData?.results && actionData.results.map((r, i) => (
        <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid #eee", fontSize: "16px" }}>
          <span style={{ color: r.ok ? "#2E7D32" : "#C62828" }}>
            {r.ok ? "✅" : "❌"}
          </span>
          {" "}{r.action.toUpperCase()} — {r.key}
          {!r.ok && <span style={{ color: "#C62828" }}> — {r.error}</span>}
        </div>
      ))}
    </div>
  );
}
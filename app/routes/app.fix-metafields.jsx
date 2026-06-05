import { json } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "react-router";
import { authenticate } from "../shopify.server";

const KEYS = [
  "piece_name", "primary_medium", "handcrafted_by", "is_one_of_a_kind",
  "treated", "material", "stone_family", "color", "cut_and_shape",
  "surface_finish", "dimensions_mm", "weight_grams", "origin_story",
  "trip_or_series", "honest_flaws_and_character", "artist_notes",
  "collection_name", "secondary_medium", "found_object", "primary_use",
  "setting_ready", "bail_included"
];

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const results = [];

  const listQuery = await admin.graphql(`#graphql
    query {
      metafieldDefinitions(first: 50, ownerType: PRODUCT) {
        edges { node { id key namespace } }
      }
    }
  `);
  const listData = await listQuery.json();
  const existing = listData.data.metafieldDefinitions.edges
    .map(e => e.node)
    .filter(n => n.namespace === "rockhound");

  for (const key of KEYS) {
    const match = existing.find(e => e.key === key);
    if (match) {
      const delRes = await admin.graphql(`#graphql
        mutation {
          metafieldDefinitionDelete(id: "${match.id}", deleteAllAssociatedMetafields: false) {
            deletedDefinitionId
            userErrors { field message }
          }
        }
      `);
      const delData = await delRes.json();
      const delErrors = delData.data.metafieldDefinitionDelete.userErrors;
      results.push({ key, action: "delete", ok: delErrors.length === 0, error: delErrors[0]?.message });
    }

    const createRes = await admin.graphql(`#graphql
      mutation {
        metafieldDefinitionCreate(definition: {
          namespace: "rockhound"
          key: "${key}"
          name: "${key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}"
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
    results.push({ key, action: "create", ok: createErrors.length === 0, error: createErrors[0]?.message });
  }

  return json({ results });
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
      <h1 style={{ fontSize: "28px", marginBottom: "8px" }}>Fix All 22 Metafields</h1>
      <p style={{ marginBottom: "24px", color: "#555" }}>Deletes and recreates all 22 rockhound metafield definitions as single_line_text_field.</p>
      <button
        onClick={() => submit({}, { method: "post" })}
        aria-label="Run fix for all 22 metafields"
        style={{ padding: "16px 32px", fontSize: "20px", background: "#2E7D32", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", marginBottom: "32px" }}
      >
        Fix All 22 Fields
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

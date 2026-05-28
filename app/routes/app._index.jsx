import { useNavigate } from "react-router";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "32px" }}>Shop Floor Command Center</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "400px" }}>
        {[
          ["Meta Injector", "/app/meta-injector"],
          ["Menu Manager", "/app/menu-manager"],
          ["Collection Manager", "/app/collection-manager"],
          ["Bulk Edit", "/app/bulk-edit"],
          ["AI Content Forge", "/app/ai-content-forge"],
          ["Theme Editor", "/app/theme-editor"],
          ["Store Health Check", "/app/store-health-check"],
          ["Image Extractor", "/app/image-extractor"],
        ].map(([label, path]) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            aria-label={`Open ${label}`}
            style={{ padding: "20px", fontSize: "20px", cursor: "pointer", borderRadius: "8px", border: "2px solid #333", background: "#fff" }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

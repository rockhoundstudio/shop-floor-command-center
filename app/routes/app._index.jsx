import { useNavigate } from "react-router";

const TOOLS = [
  { label: "Meta Injector", path: "/app/meta-injector", color: "#2E7D32" },
  { label: "Setup Metafields", path: "/app/setup-metafields", color: "#2E7D32" },
  { label: "Bulk Edit", path: "/app/bulk-edit", color: "#2E7D32" },
  { label: "Menu Manager", path: "/app/menu-manager", color: "#1565C0" },
  { label: "Collection Manager", path: "/app/collection-manager", color: "#1565C0" },
  { label: "AI Content Forge", path: "/app/ai-content-forge", color: "#E65100" },
  { label: "Image Extractor", path: "/app/image-extractor", color: "#E65100" },
  { label: "Theme Editor", path: "/app/theme-editor", color: "#6A1B9A" },
  { label: "Store Health Check", path: "/app/store-health-check", color: "#6A1B9A" },
];

const Dot = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
    <circle cx="7" cy="7" r="7" fill={color} />
  </svg>
);

export default function Index() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "24px" }}>Shop Floor Command Center</h1>
      <div style={{ overflowY: "auto", maxHeight: "80vh", maxWidth: "420px", display: "flex", flexDirection: "column", gap: "4px" }}>
        {TOOLS.map(({ label, path, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            aria-label={`Open ${label}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              minHeight: "60px",
              padding: "0 20px",
              fontSize: "20px",
              cursor: "pointer",
              borderRadius: "8px",
              border: "none",
              background: "#fff",
              textAlign: "left",
              transition: "background 0.15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#f3f3f3"}
            onMouseLeave={e => e.currentTarget.style.background = "#fff"}
          >
            <Dot color={color} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Link } from "react-router";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "8px" }}>🪨 Rockhound Studio</h1>
      <h2 style={{ fontSize: "20px", color: "#555", marginBottom: "40px" }}>Shop Floor Command Center</h2>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>

        <Link to="/app/meta-injector" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#1a1a1a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          💎 Meta Injector
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Inject geological metafields into stone products
          </div>
        </Link>

        <Link to="/app/menu-manager" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#1a3a1a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          🗂️ Menu Manager
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Build and edit your store navigation menus
          </div>
        </Link>

        <Link to="/app/collection-manager" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#1a1a3a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          📁 Collection Manager
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Organize and manage your store collections
          </div>
        </Link>

        <Link to="/app/dwell-web-manager" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#3a1a1a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          🕸️ Dwell Web Manager
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Manage dwell time and content engagement
          </div>
        </Link>

        <Link to="/app/seo-alt-text" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#2a1a3a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          🔍 SEO & Alt Text
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Scan and fix product SEO and image alt text
          </div>
        </Link>

        <Link to="/app/theme-editor" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#1a2a3a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          🎨 Theme Editor
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Read and edit Prestige theme files directly
          </div>
        </Link>

        <Link to="/app/image-extractor" style={{
          display: "block", padding: "32px 40px", backgroundColor: "#1a3a2a",
          color: "#fff", borderRadius: "12px", textDecoration: "none",
          fontSize: "22px", fontWeight: "bold", minWidth: "220px"
        }}>
          🖼️ Image Extractor
          <div style={{ fontSize: "14px", fontWeight: "normal", marginTop: "8px", color: "#aaa" }}>
            Build the story slideshow image pool from page content
          </div>
        </Link>

      </div>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

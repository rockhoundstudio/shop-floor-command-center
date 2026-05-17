import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

// ==========================================
// WIRING: MASTER APP ROUTER & NAVIGATION
// ==========================================
// This is the root layout for the Shopify admin interface.

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <PolarisProvider i18n={polarisTranslations}>
      <AppProvider embedded apiKey={apiKey}>
        {/* ⚙️ SHOP FLOOR NOTE: APP BRIDGE NAVIGATION
          If you see duplicate tabs in your Shopify dashboard, it is because 
          these exact same links are also defined in your Shopify Partner Dashboard. 
          To fix the duplicates, log into the Partner Dashboard online and delete 
          the navigation items there. Let this code handle it!
        */}
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/meta-injector">Meta Injector</a>
          <a href="/app/menu-manager">Menu Manager</a>
          <a href="/app/collection-manager">Collection Manager</a>
          <a href="/app/bulk-edit">Bulk Edit</a>
          <a href="/app/ai-content-forge">AI Content Forge</a>
        </ui-nav-menu>
        
        {/* Renders the active tab */}
        <Outlet />
      </AppProvider>
    </PolarisProvider>
  );
}

// --- ERROR HANDLING ---
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <ui-nav-menu>
        <a href="/app" rel="home">Home</a>
        <a href="/app/meta-injector">Meta Injector</a>
        <a href="/app/menu-manager">Menu Manager</a>
        <a href="/app/collection-manager">Collection Manager</a>
        <a href="/app/bulk-edit">Bulk Edit</a>
        <a href="/app/ai-content-forge">AI Content Forge</a>
        <a href="/app/theme-editor">Theme Editor</a>
        <a href="/app/store-health-check">Store Health Check</a>
      </ui-nav-menu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

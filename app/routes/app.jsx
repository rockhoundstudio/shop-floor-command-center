import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { AppProvider as PolarisProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();

  return (
    <PolarisProvider i18n={polarisTranslations}>
      <AppProvider embedded apiKey={apiKey}>
        <ui-nav-menu>
          <a href="/app" rel="home">Home</a>
          <a href="/app/meta-injector">Meta Injector</a>
          <a href="/app/menu-manager">Menu Manager</a>
          <a href="/app/collections">Collection Creator</a>
        </ui-nav-menu>
        <Outlet />
      </AppProvider>
    </PolarisProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};

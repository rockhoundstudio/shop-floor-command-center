import { Outlet } from "react-router";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "react-router";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <Outlet />
    </AppProvider>
  );
}

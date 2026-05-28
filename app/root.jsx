import { Links, Meta, Outlet, Scripts, ScrollRestoration, useRouteError } from "react-router";
import { AppProvider } from "@shopify/polaris";
import polarisTranslations from "@shopify/polaris/locales/en.json";
import "@shopify/polaris/build/esm/styles.css";

export default function App() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider i18n={polarisTranslations}>
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <title>Error</title>
      </head>
      <body style={{ padding: "40px", fontFamily: "sans-serif" }}>
        <h1 style={{ color: "red", fontSize: "32px" }}>⚠️ App Error</h1>
        <p style={{ fontSize: "22px", fontWeight: "bold" }}>
          {error?.message || "Unknown error"}
        </p>
        <pre style={{ background: "#f4f4f4", padding: "20px", fontSize: "16px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {error?.stack || JSON.stringify(error, null, 2)}
        </pre>
      </body>
    </html>
  );
}

# Command Center repair history

Original repair records dated April 19, 2026. Consolidated November 10, 2026.

HISTORICAL RECORD, NOT CURRENT OPERATING INSTRUCTIONS.

Both original notes are preserved verbatim below. Their old app identifiers, database settings, component rules, reinstall advice, staging commands and destructive rollback commands are historical claims, not verified current procedures. Do not execute them automatically. Current source, configuration and working rules govern any repair.

Stone Tagger was version one of this same app, as confirmed by Bob. April 19 is the date of these notes, not a verified app creation date.

## Original SETUP_STEPS.txt

Source: C:\Users\elega\rockhound-cmd\SETUP_STEPS.txt

SHOP FLOOR COMMAND CENTER — SETUP STEPS TO WORKING STATE
Updated: April 19, 2026

═══════════════════════════════════════════
STARTING POINT
═══════════════════════════════════════════
- One app: Shop Floor Command Center
- Deployed on Render
- Installed on rockhoundstudio.myshopify.com
- Home tab and Tools tab working

═══════════════════════════════════════════
PROBLEM WE FIXED TODAY
═══════════════════════════════════════════
app.jsx had broken placeholder components:
  BROKEN:  <s-app-nav> and <s-link>
  FIXED:   <NavMenu> from @shopify/app-bridge-react and <a> tags

This was causing every build to fail with:
  "Exited with status 1 while building your code"

═══════════════════════════════════════════
CODE CHANGES MADE TODAY
═══════════════════════════════════════════

FILE 1: app\routes\app.jsx
CHANGE: Replaced <s-app-nav> and <s-link> with NavMenu and <a> tags
ADDED:  Meta Injector nav link

CORRECT CODE:
---
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  return (
    <AppProvider embedded apiKey={apiKey}>
      <NavMenu>
        <a href="/app">Home</a>
        <a href="/app/additional">Tools</a>
        <a href="/app/meta-injector">Meta Injector</a>
      </NavMenu>
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
---

FILE 2: app\routes\app.meta-injector.jsx
CHANGE: Created new file — Meta Injector tab stub

CORRECT CODE:
---
import { Page, Layout, Card, Text } from "@shopify/polaris";

export default function MetaInjector() {
  return (
    <Page title="Meta Injector">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p">Meta Injector coming soon.</Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

export function ErrorBoundary() {
  return <div>Something went wrong loading Meta Injector.</div>;
}
---

═══════════════════════════════════════════
DEPLOY STEPS USED TODAY
═══════════════════════════════════════════
1. Set-Content to write both files above
2. git add -A
3. git commit -m "fix nav replace s-link with NavMenu add meta injector route"
4. git push
5. Watched Render for "Your service is live"
6. Uninstall Command Center from Settings > Apps
7. Reinstall from Dev Dashboard > rockhoundstudio

═══════════════════════════════════════════
CURRENT STATE
═══════════════════════════════════════════
- app.jsx: FIXED — NavMenu working, no placeholder components
- app.meta-injector.jsx: CREATED — stub only, full build pending
- Meta Injector tab: visible in nav after reinstall
- Command Center: working on rockhoundstudio.myshopify.com

═══════════════════════════════════════════
NEXT STEP
═══════════════════════════════════════════
- Reinstall Command Center after today's nav change
- Then build Meta Injector full functionality
- See MOD LIST in preferences for planned features


## Original SOLUTION_LOG.txt

Source: C:\Users\elega\rockhound-cmd\SOLUTION_LOG.txt

SHOP FLOOR COMMAND CENTER — MASTER SOLUTION LOG (Updated April 19, 2026)

═══════════════════════════════════════════
ARCHITECTURE
═══════════════════════════════════════════
- ONE app: Shop Floor Command Center
- Hosted: https://shop-floor-command-center.onrender.com
- GitHub: https://github.com/rockhoundstudio/shop-floor-command-center
- Local: C:\Users\elega\rockhound-cmd\shop-floor-command-center
- Dev Dashboard: https://dev.shopify.com/dashboard/202897819/apps
- Live store: rockhoundstudio.myshopify.com
- Client ID: ebd24a6ef0340032dccc88b0dfe1b7df
- Stack: React Router, Shopify App Bridge, Polaris, Prisma/SQLite, Render

═══════════════════════════════════════════
CONFIRMED WORKING shopify.app.toml VALUES
═══════════════════════════════════════════
client_id = "ebd24a6ef0340032dccc88b0dfe1b7df"
application_url = "https://shop-floor-command-center.onrender.com"
redirect_urls = ["https://shop-floor-command-center.onrender.com/auth/callback"]

═══════════════════════════════════════════
CONFIRMED WORKING RENDER ENV VARS
═══════════════════════════════════════════
SHOPIFY_API_KEY = ebd24a6ef0340032dccc88b0dfe1b7df
SHOPIFY_APP_URL = https://shop-floor-command-center.onrender.com
DATABASE_URL = file:./dev.sqlite
NODE_ENV = production

═══════════════════════════════════════════
KNOWN ERRORS AND FIXES
═══════════════════════════════════════════

ERROR 1: "There's a problem loading this page"
CAUSE: App URL mismatch OR session token mismatch after deploy
FIX: Uninstall from Settings > Apps, reinstall from Dev Dashboard > rockhoundstudio
PREVENTION: Always run npx shopify app deploy after changing shopify.app.toml

ERROR 2: Build fails "Exited with status 1"
CAUSE: <s-app-nav> <s-link> placeholder components in app.jsx
FIX: Replace with <NavMenu> from @shopify/app-bridge-react and standard <a> tags
NEVER USE: <s-app-nav>, <s-link>, <s-page>, or any <s-> prefixed components

ERROR 3: White screen in Shopify admin iframe
CAUSE A: application_url pointing to localhost or wrong URL
CAUSE B: App authenticating against dev store (qda81g-v1) not rockhoundstudio
CAUSE C: SHOPIFY_APP_URL env var missing or wrong in Render
FIX: Verify toml + Render env vars + Dev Dashboard all match exactly

ERROR 4: "No app with client ID found" during deploy
CAUSE: client_id mismatch after app deletion/recreation
FIX: Run npx shopify app deploy --reset

ERROR 5: Prisma crash / blank white screen
CAUSE: npm ci --omit=dev skips Prisma devDependencies
FIX: Use npm ci (no omit flag)
docker-start must run: prisma generate && prisma migrate deploy && npm run start

ERROR 6: Wrong org in Dev Dashboard
CORRECT: 202897819 (Rockhound Studio)
WRONG: 214205171 (never use)

ERROR 7: Reinstall loop after new tab added
CAUSE: NavMenu changes trigger session invalidation
FIX: After any nav change deploy — uninstall > reinstall from Dev Dashboard

ERROR 8: && not valid in PowerShell
FIX: Run commands on separate lines

═══════════════════════════════════════════
STANDARD DEPLOY WORKFLOW
═══════════════════════════════════════════
1. Make code changes locally
2. git add -A
3. git commit -m "description"
4. git push
5. Watch Render for "Your service is live"
6. If nav changed: uninstall > reinstall from Dev Dashboard
7. Test: https://admin.shopify.com/store/rockhoundstudio/apps/shop-floor-command-center

═══════════════════════════════════════════
ROLLBACK PROCEDURE
═══════════════════════════════════════════
1. git log --oneline -10
2. git reset --hard [hash]
3. git push --force
4. Watch Render for live confirmation
5. Reinstall if needed

═══════════════════════════════════════════
TABS STATUS
═══════════════════════════════════════════
BUILT:
- Home (app._index.jsx) DONE
- Additional/Tools (app.additional.jsx) DONE
- Meta Injector stub (app.meta-injector.jsx) DONE — full build pending

PLANNED:
- Stone Workshop
- Stone Tagger
- Logbook Pipeline
- Auction / Pricing
- Product Manager
- Store Health Check
- Navigation Repair

═══════════════════════════════════════════
CRITICAL RULES — NEVER VIOLATE
═══════════════════════════════════════════
- NEVER use <s-> prefixed components in JSX
- NEVER use npm ci --omit=dev in Dockerfile
- NEVER reference org 214205171
- NEVER use placeholder values in toml or env vars
- ALWAYS verify toml + Render env + Dev Dashboard match before deploy
- ALWAYS use NavMenu from @shopify/app-bridge-react
- Meta Injector is a TAB inside Command Center — NOT a standalone app
- stone_story metafield = Rich text or Multi-line text — NOT single_line_text_field


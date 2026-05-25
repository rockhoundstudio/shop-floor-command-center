import { useState, useEffect, useMemo, useRef } from "react";
import { useLoaderData, useFetcher, data, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  TextField, Badge, Banner, Box, Select, Divider, Checkbox, List,
  Icon
} from "@shopify/polaris";
import {
  PlusIcon, AlertTriangleIcon, MagicIcon, DragHandleIcon, CheckIcon, ReplaceIcon
} from "@shopify/polaris-icons";

// ==========================================
// STATIC MAPPINGS & HELPERS
// ==========================================
const KNOWN_FIXES = {
  "/pages/rockhound-logbook-hub": "/pages/the-rockhound-logbook",
  "/pages/animal-tails": "/pages/tails-and-trails",
  "/pages/chipper-lore": "/pages/the-chipper-lore-wood-pile-rescue-eight-generations",
  "/pages/spencer-opal-mine-and-sox": "/pages/the-shop-lore-spencer-opal-mine-sox-the-manx",
  "/collections/all": "/collections/all-collections",
  "/pages/the-richardson-rock-ranch-strike": "/pages/the-richardson-strike",
  "/pages/the-shop-lore-frankenstein-lapidary-line-v2": "/pages/frankenstein-lapidary-line",
  "/collections/small-batches-the-vault": "/collections/all-collections",
  "/collections/the-yakima-canyon-collection": "/collections/all-collections",
  "/collections/nickel-back": "/collections/all-collections",
  "/collections/the-3-000-mile-run": "/collections/the-3-000-mile-run-1",
  "/pages/stabilizing-stone": "UNBUILT",
  "/pages/spokane-river-tales": "UNBUILT"
};

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function getClosestHandle(target, handles) {
  if (!handles || handles.length === 0) return null;
  let bestMatch = null;
  let bestScore = Infinity;
  for (const h of handles) {
    let score = levenshtein(target, h);
    if (score < bestScore) {
      bestScore = score;
      bestMatch = h;
    }
  }
  return bestScore <= 5 ? bestMatch : null; 
}

function getDestinationStatus(url, liveCollectionHandles, livePageHandles) {
  if (!url || url.trim() === "" || url === "#") return "dead";
  if (url === "/" || url === "/collections/all") return "live";
  
  if (KNOWN_FIXES[url] === "UNBUILT") return "unbuilt";
  if (KNOWN_FIXES[url]) return "stale";

  const collMatch = url.match(/^\/collections\/(.+)$/);
  if (collMatch) return liveCollectionHandles.includes(collMatch[1]) ? "live" : "dead";
  const pageMatch = url.match(/^\/pages\/(.+)$/);
  if (pageMatch) return livePageHandles.includes(pageMatch[1]) ? "live" : "draft";
  if (url.startsWith("http")) return "external";
  return "unknown";
}

function StatusBadge({ status }) {
  const map = {
    live:     { tone: "success",  label: "🟢 Live" },
    draft:    { tone: "warning",  label: "🟡 Draft / Unverified" },
    dead:     { tone: "critical", label: "🔴 Dead" },
    stale:    { tone: "warning",  label: "🟠 Stale Handle" },
    unbuilt:  { tone: "info",     label: "🛠️ Not Built Yet" },
    external: { tone: "info",     label: "🔗 External" },
    unknown:  { tone: "warning",  label: "⚠️ Unknown" },
  };
  const { tone, label } = map[status] || map.unknown;
  return <Badge tone={tone}>{label}</Badge>;
}

function countByStatus(items, liveCollectionHandles, livePageHandles) {
  let live = 0, draft = 0, dead = 0, stale = 0;
  const check = (url) => {
    const s = getDestinationStatus(url, liveCollectionHandles, livePageHandles);
    if (s === "live" || s === "external") live++;
    else if (s === "draft" || s === "unknown") draft++;
    else if (s === "stale") stale++;
    else if (s === "dead") dead++;
  };
  items.forEach(item => {
    check(item.url);
    (item.items || []).forEach(child => check(child.url));
  });
  return { live, draft, dead, stale };
}

function getPageCategory(url, collectionHandles) {
  if (!url || typeof url !== "string") return { label: "Page", tone: null };
  const normalizedUrl = url.toLowerCase();
  const urlParts = normalizedUrl.split("/");
  const handle = urlParts[urlParts.length - 1];

  if (collectionHandles.includes(handle)) return { label: "Collection", tone: "info" };
  if (normalizedUrl.includes("/pages/")) return { label: "Story", tone: "success" };
  
  return { label: "Page", tone: null };
}

// ==========================================
// ENGINE: LOADER
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  try {
    const res = await admin.graphql(`
      query {
        menus(first: 50) {
          edges {
            node {
              id title handle
              items {
                id title url type
                items { id title url type }
              }
            }
          }
        }
        collections(first: 250) {
          edges { node { id title handle } }
        }
        pages(first: 250) {
          edges { node { id title handle body } } 
        }
      }
    `);
    const json = await res.json();
    const menus = (json.data?.menus?.edges || []).map(e => e.node);
    const collections = (json.data?.collections?.edges || []).map(e => e.node);
    const pages = (json.data?.pages?.edges || []).map(e => e.node);
    
    const liveCollectionHandles = collections.map(c => c.handle);
    const livePageHandles = pages.map(p => p.handle);

    const dbSettings = await prisma.menuSetting.findMany();
    const dbHistoryRaw = await prisma.menuHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const dbHistory = {};
    dbHistoryRaw.forEach(h => {
      if (!dbHistory[h.menuHandle]) dbHistory[h.menuHandle] = [];
      if (dbHistory[h.menuHandle].length < 5) dbHistory[h.menuHandle].push(h);
    });

    return data({ menus, collections, pages, liveCollectionHandles, livePageHandles, collectionHandles: liveCollectionHandles, dbSettings, dbHistory });
  } catch (error) {
    return data({ menus: [], collections: [], pages: [], liveCollectionHandles: [], livePageHandles: [], collectionHandles: [], dbSettings: [], dbHistory: {} });
  }
};

// ==========================================
// ENGINE: ACTION
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "fetchPageBatch") {
    const cursor = formData.get("cursor");
    const res = await admin.graphql(`
      query GetPageBatch($cursor: String) {
        pages(first: 10, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges { node { id title handle body } }
        }
      }
    `, { variables: { cursor: cursor === "null" ? null : cursor } });
    
    const json = await res.json();
    if (json.errors) return data({ ok: false, error: json.errors[0].message });
    
    return data({
      ok: true,
      requestCursor: cursor,
      batch: json.data?.pages?.edges?.map(e => e.node) || [],
      pageInfo: json.data?.pages?.pageInfo || {}
    });
  }

  if (intent === "createAllStoriesMenu") {
    const resPages = await admin.graphql(`
      query { pages(first: 250) { edges { node { title handle body } } } }
    `);
    const jsonPages = await resPages.json();
    const allPages = jsonPages.data?.pages?.edges?.map(e => e.node) || [];
    
    const imagePages = allPages.filter(p => p.body && /<img[^>]+>/i.test(p.body));
    
    const items = imagePages.map(p => ({
      title: p.title,
      url: `/pages/${p.handle}`,
      type: "HTTP"
    }));

    // Updated 2026-07 signature for menuCreate
    const res = await admin.graphql(`
      mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu { id title handle }
          userErrors { message }
        }
      }
    `, { variables: { title: "All Stories", handle: "all-stories", items } });

    const json = await res.json();
    if (json.data?.menuCreate?.userErrors?.length) {
      return data({ ok: false, error: json.data.menuCreate.userErrors[0].message });
    }

    await prisma.menuHistory.create({
      data: { menuHandle: "all-stories", message: `Generated All Stories menu with ${items.length} image pages.` }
    });

    return data({ ok: true, message: `All Stories Menu created with ${items.length} pages!` });
  }

  if (intent === "fixPageLinks") {
    const fixesRaw = formData.get("fixes");
    const fixes = JSON.parse(fixesRaw);
    let successCount = 0;

    for (const fix of fixes) {
      const pageRes = await admin.graphql(`query { page(id: "${fix.pageId}") { body } }`);
      const pageData = await pageRes.json();
      const currentBody = pageData.data?.page?.body;
      
      if (currentBody) {
        const newBody = currentBody.replace(fix.exactMatch, fix.replacementMatch);
        // Signature for pageUpdate in 2026-07 is intact and correct
        const updateRes = await admin.graphql(`
          mutation pageUpdate($id: ID!, $page: PageUpdateInput!) {
            pageUpdate(id: $id, page: $page) {
              userErrors { message }
            }
          }
        `, { variables: { id: fix.pageId, page: { body: newBody } } });
        
        const updateData = await updateRes.json();
        if (!updateData.data?.pageUpdate?.userErrors?.length) {
          successCount++;
        }
      }
    }

    return data({ ok: true, message: `Successfully applied ${successCount} link fixes!` });
  }

  if (intent === "createMenu") {
    const title = formData.get("title");
    const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const itemsRaw = formData.get("items");
    const items = JSON.parse(itemsRaw).map(item => ({
      title: item.title,
      url: item.url,
      type: "HTTP"
    }));

    // Updated 2026-07 signature for menuCreate
    const res = await admin.graphql(`
      mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
        menuCreate(title: $title, handle: $handle, items: $items) {
          menu { id title handle }
          userErrors { message }
        }
      }
    `, { variables: { title, handle, items } });

    const json = await res.json();
    if (json.data?.menuCreate?.userErrors?.length) {
      return data({ ok: false, error: json.data.menuCreate.userErrors[0].message });
    }

    const newMenu = json.data?.menuCreate?.menu;
    await prisma.menuHistory.create({
      data: { menuHandle: newMenu.handle || "new-menu", message: "New menu created via Menu Manager." }
    });

    return data({ ok: true, message: `Menu "${title}" created successfully!` });
  }

  if (intent === "updateMenu") {
    const id = formData.get("id");
    const title = formData.get("title");
    const handle = formData.get("handle");
    const itemsRaw = formData.get("items");
    const logMessage = formData.get("logMessage") || "Menu structure manually updated and saved.";

    // Only pass ID back if it's a valid Shopify global ID. Passing frontend random IDs breaks GraphQL.
    const formatItem = (item) => {
      const formatted = {
        title: item.title,
        url: item.url || "#",
        type: "HTTP",
        items: item.items && item.items.length > 0 ? item.items.map(formatItem) : []
      };
      if (item.id && typeof item.id === "string" && item.id.includes("gid://")) {
        formatted.id = item.id;
      }
      return formatted;
    };

    const items = JSON.parse(itemsRaw).map(formatItem);

    // Updated 2026-07 signature for menuUpdate
    const res = await admin.graphql(`
      mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
        menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
          userErrors { message }
        }
      }
    `, { variables: { id, title, handle, items } });

    const json = await res.json();
    if (json.data?.menuUpdate?.userErrors?.length) {
      return data({ ok: false, error: json.data.menuUpdate.userErrors[0].message });
    }

    await prisma.menuHistory.create({
      data: { menuHandle: handle, message: logMessage }
    });

    return data({ ok: true, message: "Menu saved successfully!" });
  }

  if (intent === "toggleLock") {
    const menuHandle = formData.get("menuHandle");
    const isLocked = formData.get("isLocked") === "true";
    await prisma.menuSetting.upsert({
      where: { menuHandle }, update: { isLocked }, create: { menuHandle, isLocked }
    });
    return data({ ok: true });
  }

  if (intent === "toggleAutoSync") {
    const menuHandle = formData.get("menuHandle");
    const autoSync = formData.get("autoSync") === "true";
    await prisma.menuSetting.upsert({
      where: { menuHandle }, update: { autoSync }, create: { menuHandle, autoSync }
    });
    return data({ ok: true });
  }

  return data({ ok: false });
};

// ==========================================
// CHASSIS: CREATOR COMPONENT
// ==========================================
function MenuCreator({ pages, fetcher, onCancel, collectionHandles }) {
  const [title, setTitle] = useState("");
  const [selectedPages, setSelectedPages] = useState([]);

  const handleAddPage = (page) => {
    if (!selectedPages.find(p => p.id === page.id)) {
      setSelectedPages([...selectedPages, page]);
    }
  };

  const handleRemovePage = (pageId) => {
    setSelectedPages(selectedPages.filter(p => p.id !== pageId));
  };

  const handleSave = () => {
    const fd = new FormData();
    fd.append("intent", "createMenu");
    fd.append("title", title);
    const items = selectedPages.map(p => ({ title: p.title, url: `/pages/${p.handle}` }));
    fd.append("items", JSON.stringify(items));
    fetcher.submit(fd, { method: "post" });
  };

  const availablePages = pages.filter(p => !selectedPages.find(sp => sp.id === p.id));

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <BlockStack gap="100">
            <Text variant="headingLg" as="h2">Create New Menu</Text>
            <Text tone="subdued" as="p">Build a new menu by selecting pages from your store.</Text>
          </BlockStack>
          <Button onClick={onCancel} aria-label="Cancel creating new menu" size="large">Cancel</Button>
        </InlineStack>
        <Divider />

        <BlockStack gap="400">
          <TextField
            label="Menu Title"
            value={title}
            onChange={setTitle}
            autoComplete="off"
            helpText="Give your new menu a clear name, like 'Holiday Sale Navigation'."
            aria-label="Input field for new menu title"
          />

          <InlineStack align="end">
            <Button
              variant="primary"
              size="large"
              onClick={handleSave}
              disabled={title.trim() === ""}
              aria-label="Save and Create Menu in Shopify"
            >
              Create Menu
            </Button>
          </InlineStack>
        </BlockStack>

        <Box paddingBlockStart="400">
          <Text variant="headingSm" as="h3">Available Pages</Text>
          <Text tone="subdued" variant="bodySm" as="p">Click to add pages to your new menu.</Text>

          {availablePages.length > 0 ? (
            <Box paddingBlockStart="200" style={{ maxHeight: "300px", overflowY: "auto" }}>
              <Card background="bg-surface-secondary">
                <List type="bullet">
                  {availablePages.map(page => {
                    const generatedUrl = `/pages/${page.handle}`;
                    const category = getPageCategory(generatedUrl, collectionHandles);
                    return (
                      <List.Item key={page.id}>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span">{page.title}</Text>
                            {category.tone ? (
                              <Badge tone={category.tone}>{category.label}</Badge>
                            ) : (
                              <Badge>{category.label}</Badge>
                            )}
                          </InlineStack>
                          <Button
                            size="large"
                            onClick={() => handleAddPage(page)}
                            aria-label={`Add page ${page.title} to the new menu list`}
                          >
                            Add Link
                          </Button>
                        </InlineStack>
                      </List.Item>
                    );
                  })}
                </List>
              </Card>
            </Box>
          ) : (
            <Box padding="400" background="bg-surface-secondary" borderRadius="100" paddingBlockStart="200">
              <Text tone="subdued" as="p">No more pages available to add.</Text>
            </Box>
          )}
        </Box>

        <Box paddingBlockStart="400">
          <Text variant="headingSm" as="h3">Selected Links in this Menu</Text>
          {selectedPages.length === 0 ? (
            <Box padding="400" background="bg-surface-secondary" borderRadius="100">
              <Text tone="subdued" as="p">No pages added yet. Select pages from the list above.</Text>
            </Box>
          ) : (
            <BlockStack gap="200">
              {selectedPages.map((page) => {
                const generatedUrl = `/pages/${page.handle}`;
                const category = getPageCategory(generatedUrl, collectionHandles);
                return (
                  <Card key={page.id} background="bg-surface-secondary">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text fontWeight="bold" as="span">{page.title}</Text>
                          {category.tone ? (
                            <Badge tone={category.tone}>{category.label}</Badge>
                          ) : (
                            <Badge>{category.label}</Badge>
                          )}
                        </InlineStack>
                        <Text tone="subdued" variant="bodySm" as="span">{generatedUrl}</Text>
                      </BlockStack>
                      <Button
                        tone="critical"
                        size="large"
                        onClick={() => handleRemovePage(page.id)}
                        aria-label={`Remove page ${page.title} from the new menu list`}
                      >
                        Remove
                      </Button>
                    </InlineStack>
                  </Card>
                );
              })}
            </BlockStack>
          )}
        </Box>
      </BlockStack>
    </Card>
  );
}

// ==========================================
// CHASSIS: MAIN DASHBOARD
// ==========================================
export default function MenuManager() {
  const navigate = useNavigate();
  const { menus, collections, pages, liveCollectionHandles, livePageHandles, dbSettings, dbHistory, collectionHandles } = useLoaderData();
  const fetcher = useFetcher();
  const scanFetcher = useFetcher({ key: "deepScanner" });

  const [activeMenu, setActiveMenu] = useState(null);
  const [isCreatingMenu, setIsCreatingMenu] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuTitle, setMenuTitle] = useState("");
  const [scanned, setScanned] = useState(false);
  const [globalScan, setGlobalScan] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savingMenuData, setSavingMenuData] = useState(null);
  const [savedOverrides, setSavedOverrides] = useState({});

  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [deepScanResults, setDeepScanResults] = useState(null);
  
  const accumulatedPagesRef = useRef([]);
  const lastCursorRef = useRef(null);

  const allStoriesMenuExists = useMemo(() => menus.some(m => m.handle === "all-stories"), [menus]);

  // Handle Fetcher State Completion
  useEffect(() => {
    const isSubmitUpdate = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu";
    
    if (isSubmitUpdate) {
      setIsSaving(true);
      setSavingMenuData({
        id: fetcher.formData.get("id"),
        title: fetcher.formData.get("title"),
        items: JSON.parse(fetcher.formData.get("items"))
      });
    }

    if (fetcher.state === "idle") {
      setIsSaving(false);
      
      if (fetcher.data?.ok && savingMenuData) {
        setSavedOverrides(prev => ({
          ...prev,
          [savingMenuData.id]: { items: savingMenuData.items, title: savingMenuData.title }
        }));
        if (globalScan) {
          setGlobalScan(prev => ({
            ...prev,
            [savingMenuData.id]: countByStatus(savingMenuData.items, liveCollectionHandles, livePageHandles)
          }));
        }
      }

      const isCreateSuccess = fetcher.data?.ok && fetcher.data?.message?.includes("created");
      if (isCreateSuccess) {
        setIsCreatingMenu(false);
      }

      const isFixLinksSuccess = fetcher.data?.ok && fetcher.formData?.get("intent") === "fixPageLinks";
      if (isFixLinksSuccess) {
        setDeepScanResults(prev => prev.filter(r => !JSON.parse(fetcher.formData.get("fixes")).some(f => f.pageId === r.pageId && f.exactMatch === r.exactMatch)));
      }
    }
  }, [fetcher.state, fetcher.data, globalScan, liveCollectionHandles, livePageHandles, savingMenuData]);

  // Deep Scan Fetch Loop
  useEffect(() => {
    const canProcessScan = isDeepScanning && scanFetcher.state === "idle";
    
    if (canProcessScan) {
      if (scanFetcher.data?.error) {
        setIsDeepScanning(false);
        return;
      }
      
      if (scanFetcher.data?.batch) {
        const { batch, pageInfo, requestCursor } = scanFetcher.data;

        if (lastCursorRef.current === requestCursor) return;
        lastCursorRef.current = requestCursor;

        const newPages = [...accumulatedPagesRef.current, ...batch];
        accumulatedPagesRef.current = newPages;
        setScanProgress(newPages.length);

        if (pageInfo?.hasNextPage) {
          const fd = new FormData();
          fd.append("intent", "fetchPageBatch");
          fd.append("cursor", pageInfo.endCursor);
          scanFetcher.submit(fd, { method: "post" });
        } else {
          processScanResults(newPages);
          setIsDeepScanning(false);
        }
      }
    }
  }, [isDeepScanning, scanFetcher.state, scanFetcher.data]);

  const processScanResults = (fetchedPages) => {
    const brokenLinks = [];
    const regex = /href=["'](?:https?:\/\/[^\/]+)?\/?(pages|collections)\/([^"'\?\#>]+)["']/gi;

    fetchedPages.forEach(page => {
      if (!page.body) return;
      let match;
      regex.lastIndex = 0;
      
      while ((match = regex.exec(page.body)) !== null) {
        const fullMatchStr = match[0];
        const type = match[1].toLowerCase();
        const handle = match[2];
        const urlToCheck = `/${type}/${handle}`;
        
        const isLive = type === 'pages' ? livePageHandles.includes(handle) : liveCollectionHandles.includes(handle);
        const hardcodedFix = KNOWN_FIXES[urlToCheck];

        if (!isLive) {
          let suggestion = null;
          let isUnbuilt = false;

          if (hardcodedFix) {
            if (hardcodedFix === "UNBUILT") {
              isUnbuilt = true;
            } else {
              suggestion = hardcodedFix;
            }
          } else {
            suggestion = getClosestHandle(handle, type === 'pages' ? livePageHandles : liveCollectionHandles);
            if (suggestion) {
              suggestion = `/${type}/${suggestion}`;
            }
          }

          brokenLinks.push({
            pageId: page.id,
            sourcePage: page.title,
            sourceHandle: page.handle,
            brokenType: type,
            brokenUrl: urlToCheck,
            suggestion: suggestion,
            isUnbuilt: isUnbuilt,
            isStale: !!hardcodedFix && hardcodedFix !== "UNBUILT",
            exactMatch: fullMatchStr,
            replacementMatch: suggestion ? fullMatchStr.replace(urlToCheck, suggestion) : null
          });
        }
      }
    });
    setDeepScanResults(brokenLinks);
  };

  const handleStartDeepScan = () => {
    setIsDeepScanning(true);
    setScanProgress(0);
    setDeepScanResults(null);
    accumulatedPagesRef.current = [];
    lastCursorRef.current = "START";

    const fd = new FormData();
    fd.append("intent", "fetchPageBatch");
    fd.append("cursor", "null");
    scanFetcher.submit(fd, { method: "post" });
  };

  const displayMenus = menus.map(menu => {
    const override = savedOverrides[menu.id];
    if (override) {
      return { ...menu, items: override.items, title: override.title };
    }
    return menu;
  });

  const globalTotals = useMemo(() => {
    if (!globalScan) return null;
    let live = 0, draft = 0, dead = 0, stale = 0;
    Object.values(globalScan).forEach(counts => {
      live += counts.live; draft += counts.draft; dead += counts.dead; stale += counts.stale;
    });
    return { live, draft, dead, stale };
  }, [globalScan]);

  const unlinkedPages = useMemo(() => {
    if (!scanned) return [];
    const allUsedUrls = new Set();
    displayMenus.forEach(menu => {
      menu.items.forEach(item => {
        allUsedUrls.add(item.url);
        (item.items || []).forEach(child => allUsedUrls.add(child.url));
      });
    });
    return pages.filter(p => !allUsedUrls.has(`/pages/${p.handle}`));
  },
import { useState, useEffect, useMemo, useRef } from "react";
import { useLoaderData, useFetcher, data, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  TextField, Badge, Banner, Box, Select, Divider, Checkbox, List
} from "@shopify/polaris";
import {
  PlusIcon, AlertTriangleIcon, MagicIcon, ArrowLeftIcon
} from "@shopify/polaris-icons";

// 🚀 Hardcoded Dwell Web Exemption List
const DWELL_WEB_PAGES = [
  "frankenstein-lapidary-line",
  "the-banshee-flat-lap",
  "the-richardson-strike",
  "the-rufus-protocol",
  "the-yellowstone-river",
  "day-7-yellowstone-sun-enters",
  "the-shop-lore-spencer-opal-mine-sox-the-manx",
  "the-shop-lore-chert-road-detour-yakima-river-jasper",
  "the-shop-lore-shift-change-3d-marquise",
  "the-chipper-lore-wood-pile-rescue-eight-generations",
  "nickel-back-collection",
  "the-shopped-rock",
  "the-rockhound-logbook",
  "the-3-000-mile-run",
  "memories-in-stone",
  "standard-specs",
  "frequently-asked-questions"
];

// Fuzzy Matching Helper for Deep Scan Suggestions
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
          edges { node { id title handle } } 
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

    return data({ menus, collections, pages, liveCollectionHandles, livePageHandles, dbSettings, dbHistory });
  } catch (error) {
    return data({ menus: [], collections: [], pages: [], liveCollectionHandles: [], livePageHandles: [], dbSettings: [], dbHistory: {} });
  }
};

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
          edges { node { title handle body } }
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

  if (intent === "createMenu") {
    const title = formData.get("title");
    const itemsRaw = formData.get("items");
    const items = JSON.parse(itemsRaw).map(item => ({
      title: item.title,
      url: item.url,
      type: "HTTP"
    }));

    const res = await admin.graphql(`
      mutation menuCreate($menu: MenuCreateInput!) {
        menuCreate(menu: $menu) {
          menu { id title handle }
          userErrors { message }
        }
      }
    `, { variables: { menu: { title, items } } });

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

    const formatItem = (item) => ({
      title: item.title,
      url: item.url || "#",
      type: "HTTP",
      items: item.items ? (item.items.length > 0 ? item.items.map(formatItem) : []) : []
    });

    const items = JSON.parse(itemsRaw).map(formatItem);

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

function getDestinationStatus(url, liveCollectionHandles, livePageHandles) {
  if (!url || url.trim() === "" || url === "#") return "dead";
  if (url === "/" || url === "/collections/all") return "live";
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
    external: { tone: "info",     label: "🔗 External" },
    unknown:  { tone: "warning",  label: "⚠️ Unknown" },
  };
  const { tone, label } = map[status] ? map[status] : map.unknown;
  return <Badge tone={tone}>{label}</Badge>;
}

function countByStatus(items, liveCollectionHandles, livePageHandles) {
  let live = 0, draft = 0, dead = 0;
  const check = (url) => {
    const s = getDestinationStatus(url, liveCollectionHandles, livePageHandles);
    if (s === "live" ? true : (s === "external" ? true : false)) live++;
    else if (s === "draft" ? true : (s === "unknown" ? true : false)) draft++;
    else dead++;
  };
  items.forEach(item => {
    check(item.url);
    (item.items || []).forEach(child => check(child.url));
  });
  return { live, draft, dead };
}

// 🚀 Helper to categorize page handles
function getPageCategory(handle) {
  const h = handle.toLowerCase();
  
  const storyKeywords = ["logbook", "lore", "trail", "story", "strike", "protocol", "shopped", "run", "clock", "nickel", "yellowstone", "rufus", "chipper", "janyce", "richardson", "spencer", "chopper", "evolution", "banshee", "dop", "frankenstein"];
  const collectionKeywords = ["collection", "stones", "gems"];

  const isStory = storyKeywords.some(kw => h.includes(kw)) ? true : false;
  if (isStory) {
    return { label: "Story", tone: "success" };
  }

  const isCollection = collectionKeywords.some(kw => h.includes(kw)) ? true : false;
  if (isCollection) {
    return { label: "Collection", tone: "info" };
  }

  return { label: "Page", tone: null };
}

// 🚀 MODULAR COMPONENT: MenuCreator
function MenuCreator({ pages, fetcher, onCancel }) {
  const [title, setTitle] = useState("");
  const [selectedPages, setSelectedPages] = useState([]);

  const handleAddPage = (page) => {
    const isAlreadyAdded = selectedPages.find(p => p.id === page.id) ? true : false;
    if (!isAlreadyAdded) {
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

  // Filter out pages that are already selected so they disappear from the list
  const availablePages = pages.filter(p => selectedPages.find(sp => sp.id === p.id) ? false : true);

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
              disabled={title.trim() === "" ? true : false}
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
                    const category = getPageCategory(page.handle);
                    return (
                      <List.Item key={page.id}>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="span">{page.title}</Text>
                            {category.tone !== null ? (
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
                const category = getPageCategory(page.handle);
                return (
                  <Card key={page.id} background="bg-surface-secondary">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <InlineStack gap="200" blockAlign="center">
                          <Text fontWeight="bold" as="span">{page.title}</Text>
                          {category.tone !== null ? (
                            <Badge tone={category.tone}>{category.label}</Badge>
                          ) : (
                            <Badge>{category.label}</Badge>
                          )}
                        </InlineStack>
                        <Text tone="subdued" variant="bodySm" as="span">/pages/{page.handle}</Text>
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

export default function MenuManager() {
  const navigate = useNavigate();
  const { menus, collections, pages, liveCollectionHandles, livePageHandles, dbSettings, dbHistory } = useLoaderData();
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

  // Background Saver with Unconditional Idle Reset
  useEffect(() => {
    const isSubmitUpdate = fetcher.state === "submitting" ? (fetcher.formData?.get("intent") === "updateMenu" ? true : false) : false;
    
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
      
      if (fetcher.data?.ok ? (savingMenuData ? true : false) : false) {
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

      const isCreateSuccess = fetcher.data?.ok ? (fetcher.data?.message?.includes("created") ? true : false) : false;
      if (isCreateSuccess) {
        setIsCreatingMenu(false);
      }
    }
  }, [fetcher.state, fetcher.data, globalScan, liveCollectionHandles, livePageHandles, savingMenuData]);

  // Deep Scan Pagination Loop
  useEffect(() => {
    const canProcessScan = isDeepScanning ? (scanFetcher.state === "idle" ? true : false) : false;
    
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
    const regex = /href=["'](?:https?:\/\/[^\/]+)?\/?(pages|collections)\/([^"'\?\#>]+)/gi;

    fetchedPages.forEach(page => {
      if (!page.body) return;
      let match;
      regex.lastIndex = 0;
      
      while ((match = regex.exec(page.body)) !== null) {
        const type = match[1].toLowerCase();
        const handle = match[2];
        
        if (type === 'pages') {
          if (!livePageHandles.includes(handle)) {
            brokenLinks.push({
              sourcePage: page.title,
              sourceHandle: page.handle,
              brokenType: type,
              brokenHandle: handle,
              suggestion: getClosestHandle(handle, livePageHandles)
            });
          }
        } else {
          if (type === 'collections') {
            if (!liveCollectionHandles.includes(handle)) {
              brokenLinks.push({
                sourcePage: page.title,
                sourceHandle: page.handle,
                brokenType: type,
                brokenHandle: handle,
                suggestion: getClosestHandle(handle, liveCollectionHandles)
              });
            }
          }
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
    let live = 0, draft = 0, dead = 0;
    Object.values(globalScan).forEach(counts => {
      live += counts.live; draft += counts.draft; dead += counts.dead;
    });
    return { live, draft, dead };
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
    return pages.filter(p => !allUsedUrls.has(`/pages/${p.handle}`) ? (!DWELL_WEB_PAGES.includes(p.handle) ? true : false) : false);
  }, [scanned, displayMenus, pages]);

  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...collections.map(c => ({ label: `📦 ${c.title}`, value: `/collections/${c.handle}` })),
    ...pages.map(p => ({ label: `📄 ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
    setIsCreatingMenu(false);
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    setMenuItems(menu.items.map(item => ({
      id: item.id || Math.random().toString(),
      title: item.title,
      url: item.url || "",
      items: (item.items || []).map(child => ({
        id: child.id || Math.random().toString(),
        title: child.title,
        url: child.url || ""
      }))
    })));
    setScanned(globalScan !== null ? true : false);
  };

  const activeMenuSetting = dbSettings?.find(s => s.menuHandle === activeMenu?.handle) || {};
  const isLocked = activeMenu?.handle === "main-menu" ? (activeMenuSetting.isLocked ? true : false) : false;
  const autoSyncFooter = activeMenuSetting.autoSync || false;
  const activeMenuHistory = dbHistory[activeMenu?.handle] || [];

  const toggleLock = () => {
    const fd = new FormData();
    fd.append("intent", "toggleLock");
    fd.append("menuHandle", activeMenu.handle);
    fd.append("isLocked", (!isLocked).toString());
    fetcher.submit(fd, { method: "post" });
  };

  const handleAutoSyncChange = (newVal) => {
    const fd = new FormData();
    fd.append("intent", "toggleAutoSync");
    fd.append("menuHandle", activeMenu.handle);
    fd.append("autoSync", newVal.toString());
    fetcher.submit(fd, { method: "post" });
  };

  const handleAddLink = () => {
    if (isLocked) return;
    setMenuItems(prev => [...prev, { id: Math.random().toString(), title: "New Link", url: "", items: [] }]);
    setScanned(false);
  };

  const handleAddSubLink = (parentId) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          items: [...(item.items || []), { id: Math.random().toString(), title: "New Sub-link", url: "" }]
        };
      }
      return item;
    }));
    setScanned(false);
  };

  const handleUpdateLink = (id, field, value) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    setScanned(false);
  };

  const handleUpdateSubLink = (parentId, childId, field, value) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          items: (item.items || []).map(child => child.id === childId ? { ...child, [field]: value } : child)
        };
      }
      return item;
    }));
    setScanned(false);
  };

  const handleDeleteLink = (e, id) => {
    e.stopPropagation();
    if (isLocked) return;
    setMenuItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteSubLink = (e, parentId, childId) => {
    e.stopPropagation();
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return { ...item, items: (item.items || []).filter(child => child.id !== childId) };
      }
      return item;
    }));
  };

  const handleMoveLink = (e, index, direction) => {
    e.stopPropagation();
    if (isLocked) return;
    const newItems = [...menuItems];
    if (direction === "up") {
      if (index > 0) {
        [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
      }
    } else {
      if (direction === "down") {
        if (index < newItems.length - 1) {
          [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
        }
      }
    }
    setMenuItems(newItems);
  };

  const handleMoveSubLink = (e, parentIndex, childIndex, direction) => {
    e.stopPropagation();
    if (isLocked) return;
    const newItems = [...menuItems];
    const parent = { ...newItems[parentIndex] };
    const children = [...(parent.items || [])];
    if (direction === "up") {
      if (childIndex > 0) {
        [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
      }
    } else {
      if (direction === "down") {
        if (childIndex < children.length - 1) {
          [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
        }
      }
    }
    parent.items = children;
    newItems[parentIndex] = parent;
    setMenuItems(newItems);
  };

  const handleFixIt = (e, id) => {
    e.stopPropagation();
    if (isLocked) return;
    const el = document.getElementById(`quick-select-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  const handleScan = () => setScanned(true);

  const handleGlobalScan = () => {
    const result = {};
    displayMenus.forEach(menu => {
      result[menu.id] = countByStatus(menu.items, liveCollectionHandles, livePageHandles);
    });
    setGlobalScan(result);
    setScanned(true);
  };

  const autoFillCollections = () => {
    const isFooterAndUnlocked = activeMenu?.handle === "footer" ? (!isLocked ? true : false) : false;
    if (!isFooterAndUnlocked) return;
    
    const existingUrls = new Set();
    menuItems.forEach(item => {
      existingUrls.add(item.url);
      (item.items || []).forEach(child => existingUrls.add(child.url));
    });

    const newLinks = collections
      .filter(c => !existingUrls.has(`/collections/${c.handle}`))
      .map(c => ({
        id: Math.random().toString(),
        title: c.title,
        url: `/collections/${c.handle}`,
        items: []
      }));

    if (newLinks.length > 0) {
      setMenuItems(prev => [...prev, ...newLinks]);
      setScanned(false);
    }
  };

  const autoCleanDeadLinks = () => {
    if (isLocked) return;
    setMenuItems(prev => prev
      .map(item => ({
        ...item,
        items: (item.items || []).filter(child => getDestinationStatus(child.url, liveCollectionHandles, livePageHandles) !== "dead")
      }))
      .filter(item => getDestinationStatus(item.url, liveCollectionHandles, livePageHandles) !== "dead" ? true : (item.items ? (item.items.length > 0 ? true : false) : false))
    );
    setScanned(true);
  };

  const handleFixOrphans = () => {
    const footerMenu = displayMenus.find(m => m.handle === "footer");
    if (!footerMenu) return;

    const existingUrls = new Set();
    const gatherUrls = (items) => {
      items.forEach(item => {
        existingUrls.add(item.url);
        if (item.items) gatherUrls(item.items);
      });
    };
    gatherUrls(footerMenu.items);

    const newLinks = unlinkedPages
      .filter(p => !existingUrls.has(`/pages/${p.handle}`))
      .map(p => ({
        id: Math.random().toString(),
        title: p.title,
        url: `/pages/${p.handle}`,
        items: []
      }));

    if (newLinks.length === 0) return;

    const updatedFooterItems = [...footerMenu.items, ...newLinks];

    const formatItem = (item) => ({
      title: item.title,
      url: item.url || "#",
      type: "HTTP",
      items: item.items ? (item.items.length > 0 ? item.items.map(formatItem) : []) : []
    });

    const itemsForServer = updatedFooterItems.map(formatItem);

    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", footerMenu.id);
    fd.append("title", footerMenu.title);
    fd.append("handle", footerMenu.handle);
    fd.append("items", JSON.stringify(itemsForServer));
    fd.append("logMessage", "⚡ Auto-fixed orphaned pages by adding them to the footer.");
    fetcher.submit(fd, { method: "post" });

    if (activeMenu?.handle === "footer") {
      setMenuItems(prev => [...prev, ...newLinks]);
    }
  };

  const handleSaveMenu = () => {
    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", activeMenu.id);
    fd.append("title", menuTitle);
    fd.append("handle", activeMenu.handle);
    fd.append("items", JSON.stringify(menuItems));
    fd.append("logMessage", "Menu structure manually updated and saved.");
    fetcher.submit(fd, { method: "post" });
  };

  const handleOpenCreator = () => {
    setActiveMenu(null);
    setIsCreatingMenu(true);
  };

  const handleCancelCreator = () => {
    setIsCreatingMenu(false);
  };

  const activeCounts = scanned ? (activeMenu ? countByStatus(menuItems, liveCollectionHandles, livePageHandles) : null) : null;

  let orphanedCollections = [];
  const shouldCalculateOrphanCollections = scanned ? (activeMenu ? (activeMenu.handle === "footer" ? true : false) : false) : false;
  if (shouldCalculateOrphanCollections) {
    const activeUrls = new Set();
    menuItems.forEach(item => {
      activeUrls.add(item.url);
      (item.items || []).forEach(child => activeUrls.add(child.url));
    });
    orphanedCollections = collections.filter(c => !activeUrls.has(`/collections/${c.handle}`));
  }

  const actionBtnStyle = {
    background: "none", border: "none", cursor: isLocked ? "not-allowed" : "pointer",
    fontSize: "16px", color: isLocked ? "#a6a6a6" : "#5c5f62",
    minHeight: "48px", minWidth: "48px", display: "flex", alignItems: "center", justifyContent: "center"
  };
  const deleteBtnStyle = { ...actionBtnStyle, color: isLocked ? "#a6a6a6" : "#d72c0d" };

  return (
    <>
      <Box padding="400" paddingBlockEnd="0">
        <Button onClick={() => navigate("/app")} icon={ArrowLeftIcon} aria-label="Navigate back to main dashboard" size="large">Back</Button>
      </Box>
      <Page
        title="Menu Manager 🗂️"
        subtitle="Link Governance — Nav Audit & Repair"
        primaryAction={{
          content: "🔍 Scan All Menus",
          onAction: handleGlobalScan,
          accessibilityLabel: "Execute global scan across all store menus"
        }}
      >
        <Layout>

          {globalTotals ? (
            <Layout.Section>
              <Card background="bg-surface-secondary">
                <BlockStack gap="300" align="center" inlineAlign="center">
                  <Text variant="headingMd" as="h2">Global Menu Diagnostics</Text>
                  <InlineStack gap="300">
                    <Badge tone="success">🟢 {globalTotals.live} Live</Badge>
                    <Badge tone="warning">🟡 {globalTotals.draft} Draft/Unverified</Badge>
                    <Badge tone="critical">🔴 {globalTotals.dead} Dead</Badge>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          ) : null}

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h3">Your Menus</Text>
                    <Button icon={PlusIcon} size="large" onClick={handleOpenCreator} aria-label="Create a new store menu">Create Menu</Button>
                  </InlineStack>
                  <Divider />
                  {displayMenus.map((menu) => {
                    const counts = globalScan?.[menu.id];
                    const setting = dbSettings?.find(s => s.menuHandle === menu.handle);
                    const menuIsLocked = menu.handle === "main-menu" ? (setting?.isLocked ? true : false) : false;

                    return (
                      <Box
                        key={menu.id}
                        padding="300"
                        background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                        borderWidth="025"
                        borderColor="border"
                        borderRadius="100"
                        onClick={() => handleSelectMenu(menu)}
                        style={{ cursor: "pointer", minHeight: "48px" }}
                        role="button"
                        aria-label={`Edit ${menu.title} menu`}
                      >
                        <BlockStack gap="100">
                          <InlineStack align="space-between" blockAlign="center">
                            <InlineStack gap="200" blockAlign="center">
                              <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"} as="span">
                                {menu.title}
                              </Text>
                              {menuIsLocked ? <Badge tone="info">Locked</Badge> : null}
                            </InlineStack>
                            <Badge tone="info">{menu.items.length} Links</Badge>
                          </InlineStack>
                          {counts ? (
                            <InlineStack gap="100">
                              <Badge tone="success">🟢 {counts.live}</Badge>
                              {counts.draft > 0 ? <Badge tone="warning">🟡 {counts.draft}</Badge> : null}
                              {counts.dead > 0 ? <Badge tone="critical">🔴 {counts.dead}</Badge> : null}
                            </InlineStack>
                          ) : null}
                        </BlockStack>
                      </Box>
                    );
                  })}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text variant="headingSm" as="h3">🕸️ Link Governance</Text>
                  <Text tone="subdued" variant="bodySm" as="p">
                    Nav links checked here. Body copy links checked in Dwell Web Manager.
                  </Text>
                  <Button url="/app/dwell-web-manager" disabled size="large" aria-label="Run full site audit link governance">
                    Run Full Site Audit → (coming soon)
                  </Button>
                </BlockStack>
              </Card>

              {scanned ? (unlinkedPages.length > 0 ? (
                <Card>
                  <BlockStack gap="300">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack>
                        <Text variant="headingSm" tone="warning" as="h3">True Orphans</Text>
                        <Text variant="bodySm" tone="subdued" as="p">These pages exist in Shopify but are not linked in any navigational menu.</Text>
                      </BlockStack>
                      <Button 
                        size="large" 
                        onClick={handleFixOrphans}
                        loading={fetcher.state === "submitting" ? (fetcher.formData?.get("logMessage")?.includes("Auto-fixed") ? true : false) : false}
                        aria-label="Automatically fix orphan pages by linking them"
                      >
                        Fix Orphans
                      </Button>
                    </InlineStack>
                    <Box style={{ maxHeight: "200px", overflowY: "auto" }}>
                      <InlineStack gap="200" wrap>
                        {unlinkedPages.map(p => (
                          <Badge key={p.id} tone="info">{p.title}</Badge>
                        ))}
                      </InlineStack>
                    </Box>
                  </BlockStack>
                </Card>
              ) : null) : null}

              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack>
                      <Text variant="headingSm" as="h3">Deep Link Scanner</Text>
                      <Text variant="bodySm" tone="subdued" as="p">Scans page body content for broken internal links.</Text>
                    </BlockStack>
                    <InlineStack gap="300" blockAlign="center">
                      {isDeepScanning ? (
                        <Text tone="subdued" variant="bodySm" as="span">
                          Scanning page {scanProgress} of {Math.max(scanProgress, pages.length)}...
                        </Text>
                      ) : null}
                      <Button size="large" onClick={handleStartDeepScan} loading={isDeepScanning} aria-label="Start deep scanning for broken body content links">
                        Scan Page Content
                      </Button>
                    </InlineStack>
                  </InlineStack>
                  
                  {deepScanResults !== null ? (!isDeepScanning ? (
                    <Box paddingBlockStart="200">
                      {deepScanResults.length === 0 ? (
                        <Banner tone="success">All internal links are healthy ✅</Banner>
                      ) : (
                        <BlockStack gap="300">
                          <Badge tone="critical">{deepScanResults.length} broken internal links found</Badge>
                          <List type="bullet">
                            {deepScanResults.map((err, i) => (
                              <List.Item key={i}>
                                <Text fontWeight="bold" as="span">{err.sourcePage}</Text>
                                <Text tone="subdued" variant="bodySm" as="span"> ({err.sourceHandle}) contains broken link: </Text>
                                <Text tone="critical" as="span">/{err.brokenType}/{err.brokenHandle}</Text>
                                {err.suggestion ? (
                                  <Text tone="success" variant="bodySm" as="span">
                                    {" "}→ Did you mean: /{err.brokenType}/{err.suggestion}?
                                  </Text>
                                ) : null}
                              </List.Item>
                            ))}
                          </List>
                        </BlockStack>
                      )}
                    </Box>
                  ) : null) : null}
                </BlockStack>
              </Card>

              {fetcher.data?.message ? <Banner tone="success">{fetcher.data.message}</Banner> : null}
              {fetcher.data?.error ? <Banner tone="critical">{fetcher.data.error}</Banner> : null}
            </BlockStack>
          </Layout.Section>

          <Layout.Section>
            {isCreatingMenu ? (
              <MenuCreator pages={pages} fetcher={fetcher} onCancel={handleCancelCreator} />
            ) : (!activeMenu ? (
              <Card>
                <Box padding="800" textAlign="center">
                  <Text variant="headingLg" tone="subdued" as="h2">Select a menu on the left to start editing, or create a new one.</Text>
                </Box>
              </Card>
            ) : (
              <BlockStack gap="400">

                <InlineStack align="end">
                  <Button
                    variant="primary"
                    size="large"
                    onClick={handleSaveMenu}
                    loading={fetcher.state === "submitting" ? (fetcher.formData?.get("intent") === "updateMenu" ? true : false) : false}
                    disabled={isLocked}
                    aria-label="Save current menu configuration"
                  >
                    Save Menu
                  </Button>
                </InlineStack>

                {isLocked ? (
                  <Banner tone="warning" title="Main Menu is Locked">
                    <Text as="p">This menu is structurally locked to prevent accidental modifications. Unlock it using the button below to enable editing controls.</Text>
                  </Banner>
                ) : null}

                {activeCounts ? (
                  <Banner tone={activeCounts.dead > 0 ? "critical" : (activeCounts.draft > 0 ? "warning" : "success")}>
                    <Text as="p">
                      Scan complete — 🟢 {activeCounts.live} live &nbsp;|&nbsp;
                      🟡 {activeCounts.draft} draft/unverified &nbsp;|&nbsp;
                      🔴 {activeCounts.dead} dead
                    </Text>
                  </Banner>
                ) : null}

                {shouldCalculateOrphanCollections ? (orphanedCollections.length > 0 ? (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" tone="critical" as="h3">Orphaned Collections — not in this menu</Text>
                      <InlineStack gap="200" wrap>
                        {orphanedCollections.map(c => (
                          <Badge key={c.id} tone="warning">{c.title}</Badge>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  </Card>
                ) : null) : null}

                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">✨ Quick Actions</Text>
                    <InlineStack gap="200" wrap>
                      {activeMenu.handle === "footer" ? (
                        <Button size="large" icon={MagicIcon} onClick={autoFillCollections} disabled={isLocked} aria-label="Auto fill missing collections">🪄 Auto-Fill Missing Collections</Button>
                      ) : null}
                      <Button size="large" icon={AlertTriangleIcon} onClick={autoCleanDeadLinks} disabled={isLocked} aria-label="Remove dead links from menu">🧹 Remove Dead Links</Button>
                      <Button size="large" onClick={handleScan} aria-label="Scan current active menu">🔍 Scan This Menu</Button>
                    </InlineStack>
                    {activeMenu.handle === "footer" ? (
                      <Box paddingBlockStart="200">
                        <Checkbox
                          label="Auto-sync collections to footer"
                          checked={autoSyncFooter}
                          onChange={handleAutoSyncChange}
                          helpText="Automatically injects new collections when created in Shopify."
                          aria-label="Toggle auto sync collections to footer menu checkbox"
                        />
                      </Box>
                    ) : null}
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="500">
                    <TextField
                      label="Menu Title"
                      value={menuTitle}
                      onChange={setMenuTitle}
                      autoComplete="off"
                      disabled={isLocked}
                      aria-label="Input field for editing current menu title"
                    />

                    <Box padding="400" borderRadius="200" borderWidth="025" borderColor="border">
                      <BlockStack gap="400">
                        <InlineStack align="space-between">
                          <InlineStack gap="300" blockAlign="center">
                            <Text variant="headingSm" as="h3">Menu Links ({menuItems.length})</Text>
                            {activeMenu.handle === "main-menu" ? (
                              <Button size="large" onClick={toggleLock} loading={fetcher.state === "submitting" ? (fetcher.formData?.get("intent") === "toggleLock" ? true : false) : false} aria-label="Toggle menu lock status">
                                {isLocked ? "🔓 Unlock Menu" : "🔒 Lock Menu"}
                              </Button>
                            ) : null}
                          </InlineStack>
                          <Button size="large" icon={PlusIcon} variant="primary" onClick={handleAddLink} disabled={isLocked} aria-label="Add new parent link to menu">Add Link</Button>
                        </InlineStack>

                        {menuItems.map((item, index) => {
                          const status = scanned
                            ? getDestinationStatus(item.url, liveCollectionHandles, livePageHandles)
                            : null;
                          
                          return (
                            <Card key={item.id} background="bg-surface">
                              <BlockStack gap="300">
                                
                                {/* PARENT LINK */}
                                <BlockStack gap="200">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                      {status ? <StatusBadge status={status} /> : <Badge tone="info">Not scanned</Badge>}
                                      {status === "dead" ? (!isLocked ? (
                                        <Button size="large" onClick={(e) => handleFixIt(e, item.id)} aria-label={`Fix dead link for ${item.title}`}>Fix It</Button>
                                      ) : null) : null}
                                    </InlineStack>
                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                      <button disabled={index === 0 ? true : (isLocked ? true : false)} onClick={(e) => handleMoveLink(e, index, "up")} style={actionBtnStyle} title="Move Up" aria-label={`Move link ${item.title} up`}>↑</button>
                                      <button disabled={index === menuItems.length - 1 ? true : (isLocked ? true : false)} onClick={(e) => handleMoveLink(e, index, "down")} style={actionBtnStyle} title="Move Down" aria-label={`Move link ${item.title} down`}>↓</button>
                                      <button disabled={isLocked} onClick={(e) => handleDeleteLink(e, item.id)} style={deleteBtnStyle} title="Delete link" aria-label={`Delete link ${item.title}`}>✕</button>
                                    </div>
                                  </InlineStack>
                                  
                                  <InlineStack blockAlign="end" gap="300" wrap>
                                    <div style={{ flex: 1, minWidth: "140px" }}>
                                      <TextField
                                        label="Display Name"
                                        value={item.title}
                                        onChange={(v) => handleUpdateLink(item.id, "title", v)}
                                        autoComplete="off"
                                        disabled={isLocked}
                                        aria-label={`Input field for link display name ${item.title}`}
                                      />
                                    </div>
                                    <div style={{ flex: 1, minWidth: "180px" }}>
                                      <Select
                                        id={`quick-select-${item.id}`}
                                        label="Quick Select"
                                        options={linkOptions}
                                        value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"}
                                        onChange={(v) => v !== "custom" ? handleUpdateLink(item.id, "url", v) : null}
                                        disabled={isLocked}
                                        aria-label={`Quick select destination for link ${item.title}`}
                                      />
                                    </div>
                                    <div style={{ flex: 1, minWidth: "180px" }}>
                                      <TextField
                                        label="URL Path"
                                        value={item.url}
                                        onChange={(v) => handleUpdateLink(item.id, "url", v)}
                                        autoComplete="off"
                                        disabled={isLocked}
                                        aria-label={`Input field for URL path for link ${item.title}`}
                                        error={
                                          scanned ? (status === "dead" ? "Dead link — destination not found" : (status === "draft" ? "Page may be unpublished" : undefined)) : undefined
                                        }
                                      />
                                    </div>
                                  </InlineStack>
                                </BlockStack>

                                {/* SUB-LINKS SECTION */}
                                <Box paddingInlineStart="400" borderWidth="0" borderInlineStartWidth="025" borderColor="border">
                                  <BlockStack gap="400">
                                    {(item.items || []).map((child, childIndex) => {
                                      const childStatus = scanned
                                        ? getDestinationStatus(child.url, liveCollectionHandles, livePageHandles)
                                        : null;

                                      return (
                                        <BlockStack key={child.id} gap="200">
                                          <InlineStack align="space-between" blockAlign="center">
                                            <InlineStack gap="200" blockAlign="center">
                                              {childStatus ? <StatusBadge status={childStatus} /> : <Badge tone="info">Not scanned</Badge>}
                                              {childStatus === "dead" ? (!isLocked ? (
                                                <Button size="large" onClick={(e) => handleFixIt(e, child.id)} aria-label={`Fix dead sub-link for ${child.title}`}>Fix It</Button>
                                              ) : null) : null}
                                            </InlineStack>
                                            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                              <button disabled={childIndex === 0 ? true : (isLocked ? true : false)} onClick={(e) => handleMoveSubLink(e, index, childIndex, "up")} style={actionBtnStyle} title="Move Up" aria-label={`Move sub-link ${child.title} up`}>↑</button>
                                              <button disabled={childIndex === (item.items || []).length - 1 ? true : (isLocked ? true : false)} onClick={(e) => handleMoveSubLink(e, index, childIndex, "down")} style={actionBtnStyle} title="Move Down" aria-label={`Move sub-link ${child.title} down`}>↓</button>
                                              <button disabled={isLocked} onClick={(e) => handleDeleteSubLink(e, item.id, child.id)} style={deleteBtnStyle} title="Delete sub-link" aria-label={`Delete sub-link ${child.title}`}>✕</button>
                                            </div>
                                          </InlineStack>
                                          
                                          <InlineStack blockAlign="end" gap="300" wrap>
                                            <div style={{ flex: 1, minWidth: "140px" }}>
                                              <TextField
                                                label="Sub-link Name"
                                                value={child.title}
                                                onChange={(v) => handleUpdateSubLink(item.id, child.id, "title", v)}
                                                autoComplete="off"
                                                disabled={isLocked}
                                                aria-label={`Input field for sub-link display name ${child.title}`}
                                              />
                                            </div>
                                            <div style={{ flex: 1, minWidth: "180px" }}>
                                              <Select
                                                id={`quick-select-${child.id}`}
                                                label="Quick Select"
                                                options={linkOptions}
                                                value={linkOptions.find(o => o.value === child.url) ? child.url : "custom"}
                                                onChange={(v) => v !== "custom" ? handleUpdateSubLink(item.id, child.id, "url", v) : null}
                                                disabled={isLocked}
                                                aria-label={`Quick select destination for sub-link ${child.title}`}
                                              />
                                            </div>
                                            <div style={{ flex: 1, minWidth: "180px" }}>
                                              <TextField
                                                label="URL Path"
                                                value={child.url}
                                                onChange={(v) => handleUpdateSubLink(item.id, child.id, "url", v)}
                                                autoComplete="off"
                                                disabled={isLocked}
                                                aria-label={`Input field for URL path for sub-link ${child.title}`}
                                                error={
                                                  scanned ? (childStatus === "dead" ? "Dead link — destination not found" : (childStatus === "draft" ? "Page may be unpublished" : undefined)) : undefined
                                                }
                                              />
                                            </div>
                                          </InlineStack>
                                        </BlockStack>
                                      );
                                    })}
                                    <InlineStack>
                                      <Button size="large" icon={PlusIcon} onClick={() => handleAddSubLink(item.id)} disabled={isLocked} aria-label={`Add new sub-link under ${item.title}`}>Add Sub-link</Button>
                                    </InlineStack>
                                  </BlockStack>
                                </Box>

                              </BlockStack>
                            </Card>
                          );
                        })}
                      </BlockStack>
                    </Box>

                    <InlineStack align="end">
                      <Button
                        variant="primary"
                        size="large"
                        onClick={handleSaveMenu}
                        loading={fetcher.state === "submitting" ? (fetcher.formData?.get("intent") === "updateMenu" ? true : false) : false}
                        disabled={isLocked}
                        aria-label="Save current menu configuration"
                      >
                        Save Menu
                      </Button>
                    </InlineStack>
                  </BlockStack>
                </Card>

                {activeMenuHistory.length > 0 ? (
                  <Card>
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Change History</Text>
                      <List type="bullet">
                        {activeMenuHistory.map((entry) => (
                          <List.Item key={entry.id}>
                            <Text tone="subdued" as="span">
                              {new Date(entry.createdAt).toLocaleString()} — {entry.message}
                            </Text>
                          </List.Item>
                        ))}
                      </List>
                    </BlockStack>
                  </Card>
                ) : null}

              </BlockStack>
            ))}
          </Layout.Section>
        </Layout>
      </Page>
    </>
  );
}
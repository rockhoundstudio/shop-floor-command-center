import { useState, useEffect, useMemo } from "react";
import { useLoaderData, useFetcher, data } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Button,
  TextField, Badge, Banner, Box, Select, Divider, Checkbox, List
} from "@shopify/polaris";
import {
  PlusIcon, AlertTriangleIcon, MagicIcon
} from "@shopify/polaris-icons";

// 🚀 NEW: Hardcoded Dwell Web Exemption List
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
];

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
        pages(first: 100) {
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

    // Fetch persistent settings and history from Prisma
    const dbSettings = await prisma.menuSetting.findMany();
    const dbHistoryRaw = await prisma.menuHistory.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Group history by menuHandle (limit to 5 per menu)
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

  if (intent === "updateMenu") {
    const id = formData.get("id");
    const title = formData.get("title");
    const handle = formData.get("handle");
    const itemsRaw = formData.get("items");

    const formatItem = (item) => ({
      title: item.title,
      url: item.url || "#",
      type: "HTTP",
      items: item.items && item.items.length > 0 ? item.items.map(formatItem) : []
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

    // Log the successful save to Prisma
    await prisma.menuHistory.create({
      data: {
        menuHandle: handle,
        message: "Menu structure manually updated and saved."
      }
    });

    return data({ ok: true, message: "Menu saved successfully!" });
  }

  if (intent === "toggleLock") {
    const menuHandle = formData.get("menuHandle");
    const isLocked = formData.get("isLocked") === "true";
    await prisma.menuSetting.upsert({
      where: { menuHandle },
      update: { isLocked },
      create: { menuHandle, isLocked }
    });
    return data({ ok: true });
  }

  if (intent === "toggleAutoSync") {
    const menuHandle = formData.get("menuHandle");
    const autoSync = formData.get("autoSync") === "true";
    await prisma.menuSetting.upsert({
      where: { menuHandle },
      update: { autoSync },
      create: { menuHandle, autoSync }
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
  const { tone, label } = map[status] || map.unknown;
  return <Badge tone={tone}>{label}</Badge>;
}

function countByStatus(items, liveCollectionHandles, livePageHandles) {
  let live = 0, draft = 0, dead = 0;
  const check = (url) => {
    const s = getDestinationStatus(url, liveCollectionHandles, livePageHandles);
    if (s === "live" || s === "external") live++;
    else if (s === "draft" || s === "unknown") draft++;
    else dead++;
  };
  items.forEach(item => {
    check(item.url);
    (item.items || []).forEach(child => check(child.url));
  });
  return { live, draft, dead };
}

export default function MenuManager() {
  const { menus, collections, pages, liveCollectionHandles, livePageHandles, dbSettings, dbHistory } = useLoaderData();
  const fetcher = useFetcher();

  const [activeMenu, setActiveMenu] = useState(null);
  const [menuItems, setMenuItems] = useState([]);
  const [menuTitle, setMenuTitle] = useState("");
  const [scanned, setScanned] = useState(false);
  const [globalScan, setGlobalScan] = useState(null);

  const [isSaving, setIsSaving] = useState(false);
  const [savedOverrides, setSavedOverrides] = useState({});

  useEffect(() => {
    if (fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu") {
      setIsSaving(true);
    } else if (fetcher.state === "idle" && isSaving) {
      setIsSaving(false);
      if (fetcher.data?.ok && activeMenu) {
        setSavedOverrides(prev => ({
          ...prev,
          [activeMenu.id]: { items: menuItems, title: menuTitle }
        }));
        if (globalScan) {
          setGlobalScan(prev => ({
            ...prev,
            [activeMenu.id]: countByStatus(menuItems, liveCollectionHandles, livePageHandles)
          }));
        }
      }
    }
  }, [fetcher.state, fetcher.data, activeMenu, menuItems, menuTitle, globalScan, liveCollectionHandles, livePageHandles, isSaving]);

  const displayMenus = menus.map(menu => {
    const override = savedOverrides[menu.id];
    if (override) {
      return { ...menu, items: override.items, title: override.title };
    }
    return menu;
  });

  // Calculate Global Scan Totals
  const globalTotals = useMemo(() => {
    if (!globalScan) return null;
    let live = 0, draft = 0, dead = 0;
    Object.values(globalScan).forEach(counts => {
      live += counts.live; draft += counts.draft; dead += counts.dead;
    });
    return { live, draft, dead };
  }, [globalScan]);

  // Calculate True Orphans (excluding Dwell Web Pages)
  const unlinkedPages = useMemo(() => {
    if (!scanned) return [];
    const allUsedUrls = new Set();
    displayMenus.forEach(menu => {
      menu.items.forEach(item => {
        allUsedUrls.add(item.url);
        (item.items || []).forEach(child => allUsedUrls.add(child.url));
      });
    });
    return pages.filter(p => !allUsedUrls.has(`/pages/${p.handle}`) && !DWELL_WEB_PAGES.includes(p.handle));
  }, [scanned, displayMenus, pages]);

  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...collections.map(c => ({ label: `📦 ${c.title}`, value: `/collections/${c.handle}` })),
    ...pages.map(p => ({ label: `📄 ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
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
    setScanned(globalScan !== null);
  };

  // Derive persistent state from database loader
  const activeMenuSetting = dbSettings?.find(s => s.menuHandle === activeMenu?.handle) || {};
  const isLocked = activeMenu?.handle === "main-menu" && activeMenuSetting.isLocked;
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
    if (direction === "up" && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === "down" && index < newItems.length - 1) {
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    setMenuItems(newItems);
  };

  const handleMoveSubLink = (e, parentIndex, childIndex, direction) => {
    e.stopPropagation();
    if (isLocked) return;
    const newItems = [...menuItems];
    const parent = { ...newItems[parentIndex] };
    const children = [...(parent.items || [])];
    if (direction === "up" && childIndex > 0) {
      [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
    } else if (direction === "down" && childIndex < children.length - 1) {
      [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
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
    if (activeMenu?.handle !== "footer" || isLocked) return;
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
      .filter(item => getDestinationStatus(item.url, liveCollectionHandles, livePageHandles) !== "dead" || (item.items && item.items.length > 0))
    );
    setScanned(true);
  };

  const handleSaveMenu = () => {
    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", activeMenu.id);
    fd.append("title", menuTitle);
    fd.append("handle", activeMenu.handle);
    fd.append("items", JSON.stringify(menuItems));
    fetcher.submit(fd, { method: "post" });
  };

  const activeCounts = scanned && activeMenu
    ? countByStatus(menuItems, liveCollectionHandles, livePageHandles)
    : null;

  let orphanedCollections = [];
  if (scanned && activeMenu && activeMenu.handle === "footer") {
    const activeUrls = new Set();
    menuItems.forEach(item => {
      activeUrls.add(item.url);
      (item.items || []).forEach(child => activeUrls.add(child.url));
    });
    orphanedCollections = collections.filter(c => !activeUrls.has(`/collections/${c.handle}`));
  }

  const actionBtnStyle = {
    background: "none", border: "none", cursor: isLocked ? "not-allowed" : "pointer",
    fontSize: "16px", padding: "4px 8px", color: isLocked ? "#a6a6a6" : "#5c5f62"
  };
  const deleteBtnStyle = { ...actionBtnStyle, color: isLocked ? "#a6a6a6" : "#d72c0d" };

  return (
    <Page
      title="Menu Manager 🗂️"
      subtitle="Link Governance — Nav Audit & Repair"
      backAction={{ content: "Command Center", url: "/app/_index" }}
      primaryAction={{
        content: "🔍 Scan All Menus",
        onAction: handleGlobalScan
      }}
    >
      <Layout>

        {globalTotals && (
          <Layout.Section>
            <Card background="bg-surface-secondary">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Text variant="headingMd">Global Menu Diagnostics</Text>
                <InlineStack gap="300">
                  <Badge tone="success">🟢 {globalTotals.live} Live</Badge>
                  <Badge tone="warning">🟡 {globalTotals.draft} Draft/Unverified</Badge>
                  <Badge tone="critical">🔴 {globalTotals.dead} Dead</Badge>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd">Your Menus</Text>
                <Divider />
                {displayMenus.map((menu) => {
                  const counts = globalScan?.[menu.id];
                  const setting = dbSettings?.find(s => s.menuHandle === menu.handle);
                  const menuIsLocked = menu.handle === "main-menu" && setting?.isLocked;

                  return (
                    <Box
                      key={menu.id}
                      padding="300"
                      background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="100"
                      onClick={() => handleSelectMenu(menu)}
                      style={{ cursor: "pointer" }}
                    >
                      <BlockStack gap="100">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"}>
                              {menu.title}
                            </Text>
                            {menuIsLocked && <Badge tone="info">Locked</Badge>}
                          </InlineStack>
                          <Badge tone="info">{menu.items.length} Links</Badge>
                        </InlineStack>
                        {counts && (
                          <InlineStack gap="100">
                            <Badge tone="success">🟢 {counts.live}</Badge>
                            {counts.draft > 0 && <Badge tone="warning">🟡 {counts.draft}</Badge>}
                            {counts.dead > 0 && <Badge tone="critical">🔴 {counts.dead}</Badge>}
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm">🕸️ Link Governance</Text>
                <Text tone="subdued" variant="bodySm">
                  Nav links checked here. Body copy links checked in Dwell Web Manager.
                </Text>
                <Button url="/app/dwell-web-manager" disabled>
                  Run Full Site Audit → (coming soon)
                </Button>
              </BlockStack>
            </Card>

            {scanned && unlinkedPages.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" tone="warning">True Orphans</Text>
                  <Text variant="bodySm" tone="subdued">These pages exist in Shopify but are not linked in any navigational menu, nor are they Dwell Web exemptions.</Text>
                  <Box style={{ maxHeight: "200px", overflowY: "auto" }}>
                    <InlineStack gap="200" wrap>
                      {unlinkedPages.map(p => (
                        <Badge key={p.id} tone="info">{p.title}</Badge>
                      ))}
                    </InlineStack>
                  </Box>
                </BlockStack>
              </Card>
            )}

            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
            {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          {!activeMenu ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text variant="headingLg" tone="subdued">Select a menu on the left to start editing.</Text>
              </Box>
            </Card>
          ) : (
            <BlockStack gap="400">

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleSaveMenu}
                  loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu"}
                  disabled={isLocked}
                >
                  Save Menu
                </Button>
              </InlineStack>

              {isLocked && (
                <Banner tone="warning" title="Main Menu is Locked">
                  <Text>This menu is structurally locked to prevent accidental modifications. Unlock it using the button below to enable editing controls.</Text>
                </Banner>
              )}

              {activeCounts && (
                <Banner tone={activeCounts.dead > 0 ? "critical" : activeCounts.draft > 0 ? "warning" : "success"}>
                  <Text>
                    Scan complete — 🟢 {activeCounts.live} live &nbsp;|&nbsp;
                    🟡 {activeCounts.draft} draft/unverified &nbsp;|&nbsp;
                    🔴 {activeCounts.dead} dead
                  </Text>
                </Banner>
              )}

              {scanned && activeMenu.handle === "footer" && orphanedCollections.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" tone="critical">Orphaned Collections — not in this menu</Text>
                    <InlineStack gap="200" wrap>
                      {orphanedCollections.map(c => (
                        <Badge key={c.id} tone="warning">{c.title}</Badge>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm">✨ Quick Actions</Text>
                  <InlineStack gap="200" wrap>
                    {activeMenu.handle === "footer" && (
                      <Button icon={MagicIcon} onClick={autoFillCollections} disabled={isLocked}>🪄 Auto-Fill Missing Collections</Button>
                    )}
                    <Button icon={AlertTriangleIcon} onClick={autoCleanDeadLinks} disabled={isLocked}>🧹 Remove Dead Links</Button>
                    <Button onClick={handleScan}>🔍 Scan This Menu</Button>
                  </InlineStack>
                  {activeMenu.handle === "footer" && (
                    <Box paddingBlockStart="200">
                      <Checkbox
                        label="Auto-sync collections to footer"
                        checked={autoSyncFooter}
                        onChange={handleAutoSyncChange}
                        helpText="Automatically injects new collections when created in Shopify."
                      />
                    </Box>
                  )}
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
                  />

                  <Box padding="400" borderRadius="200" borderWidth="025" borderColor="border">
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <InlineStack gap="300" blockAlign="center">
                          <Text variant="headingSm">Menu Links ({menuItems.length})</Text>
                          {activeMenu.handle === "main-menu" && (
                            <Button size="slim" onClick={toggleLock} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "toggleLock"}>
                              {isLocked ? "🔓 Unlock Menu" : "🔒 Lock Menu"}
                            </Button>
                          )}
                        </InlineStack>
                        <Button icon={PlusIcon} variant="primary" onClick={handleAddLink} disabled={isLocked}>Add Link</Button>
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
                                    {status === "dead" && !isLocked && (
                                      <Button size="micro" onClick={(e) => handleFixIt(e, item.id)}>Fix It</Button>
                                    )}
                                  </InlineStack>
                                  <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                    <button disabled={index === 0 || isLocked} onClick={(e) => handleMoveLink(e, index, "up")} style={actionBtnStyle} title="Move Up">↑</button>
                                    <button disabled={index === menuItems.length - 1 || isLocked} onClick={(e) => handleMoveLink(e, index, "down")} style={actionBtnStyle} title="Move Down">↓</button>
                                    <button disabled={isLocked} onClick={(e) => handleDeleteLink(e, item.id)} style={deleteBtnStyle} title="Delete link">✕</button>
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
                                    />
                                  </div>
                                  <div style={{ flex: 1, minWidth: "180px" }}>
                                    <Select
                                      id={`quick-select-${item.id}`}
                                      label="Quick Select"
                                      options={linkOptions}
                                      value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"}
                                      onChange={(v) => v !== "custom" && handleUpdateLink(item.id, "url", v)}
                                      disabled={isLocked}
                                    />
                                  </div>
                                  <div style={{ flex: 1, minWidth: "180px" }}>
                                    <TextField
                                      label="URL Path"
                                      value={item.url}
                                      onChange={(v) => handleUpdateLink(item.id, "url", v)}
                                      autoComplete="off"
                                      disabled={isLocked}
                                      error={
                                        scanned && status === "dead"
                                          ? "Dead link — destination not found"
                                          : scanned && status === "draft"
                                          ? "Page may be unpublished"
                                          : undefined
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
                                            {childStatus === "dead" && !isLocked && (
                                              <Button size="micro" onClick={(e) => handleFixIt(e, child.id)}>Fix It</Button>
                                            )}
                                          </InlineStack>
                                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                            <button disabled={childIndex === 0 || isLocked} onClick={(e) => handleMoveSubLink(e, index, childIndex, "up")} style={actionBtnStyle} title="Move Up">↑</button>
                                            <button disabled={childIndex === (item.items || []).length - 1 || isLocked} onClick={(e) => handleMoveSubLink(e, index, childIndex, "down")} style={actionBtnStyle} title="Move Down">↓</button>
                                            <button disabled={isLocked} onClick={(e) => handleDeleteSubLink(e, item.id, child.id)} style={deleteBtnStyle} title="Delete sub-link">✕</button>
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
                                            />
                                          </div>
                                          <div style={{ flex: 1, minWidth: "180px" }}>
                                            <Select
                                              id={`quick-select-${child.id}`}
                                              label="Quick Select"
                                              options={linkOptions}
                                              value={linkOptions.find(o => o.value === child.url) ? child.url : "custom"}
                                              onChange={(v) => v !== "custom" && handleUpdateSubLink(item.id, child.id, "url", v)}
                                              disabled={isLocked}
                                            />
                                          </div>
                                          <div style={{ flex: 1, minWidth: "180px" }}>
                                            <TextField
                                              label="URL Path"
                                              value={child.url}
                                              onChange={(v) => handleUpdateSubLink(item.id, child.id, "url", v)}
                                              autoComplete="off"
                                              disabled={isLocked}
                                              error={
                                                scanned && childStatus === "dead"
                                                  ? "Dead link — destination not found"
                                                  : scanned && childStatus === "draft"
                                                  ? "Page may be unpublished"
                                                  : undefined
                                              }
                                            />
                                          </div>
                                        </InlineStack>
                                      </BlockStack>
                                    );
                                  })}
                                  <InlineStack>
                                    <Button size="micro" icon={PlusIcon} onClick={() => handleAddSubLink(item.id)} disabled={isLocked}>Add Sub-link</Button>
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
                      loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu"}
                      disabled={isLocked}
                    >
                      Save Menu
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              {activeMenuHistory.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm">Change History</Text>
                    <List type="bullet">
                      {activeMenuHistory.map((entry) => (
                        <List.Item key={entry.id}>
                          <Text tone="subdued">
                            {new Date(entry.createdAt).toLocaleString()} — {entry.message}
                          </Text>
                        </List.Item>
                      ))}
                    </List>
                  </BlockStack>
                </Card>
              )}

            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
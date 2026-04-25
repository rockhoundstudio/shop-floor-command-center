import { useState, useEffect } from "react";
import { data } from "react-router";
import { useActionData, useSubmit, useNavigation, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);

  if (url.searchParams.get("scan") === "true") {
    try {
      const response = await admin.graphql(`#graphql
        query scanStore {
          pages(first: 50) { edges { node { id title handle } } }
          collections(first: 50) { edges { node { id title handle } } }
          blogs(first: 10) { edges { node { id title handle } } }
        }
      `);
      const result = await response.json();

      if (!result?.data) {
        return data({ success: false, error: "GraphQL returned empty data" });
      }

      return data({
        success: true,
        pages: result.data.pages.edges.map(e => e.node),
        collections: result.data.collections.edges.map(e => e.node),
        blogs: result.data.blogs.edges.map(e => e.node),
      });
    } catch (err) {
      return data({ success: false, error: "GraphQL failed: " + err.message });
    }
  }

  return data({});
};

function getMenuItemType(url) {
  if (url === "/") return "FRONTPAGE";
  if (url === "/search") return "SEARCH";
  if (url.startsWith("/collections/")) return "COLLECTION";
  if (url.startsWith("/pages/")) return "PAGE";
  if (url.startsWith("/blogs/")) return "BLOG";
  if (url.startsWith("/products/")) return "PRODUCT";
  return "HTTP";
}

function friendlyError(message) {
  if (!message) return message;
  if (message.toLowerCase().includes("collection not found") ||
      message.toLowerCase().includes("couldn't create link") && message.toLowerCase().includes("collection")) {
    return "⚠ Collection must be created in Meta Injector first before it can be added to a menu.";
  }
  if (message.toLowerCase().includes("page not found") ||
      message.toLowerCase().includes("couldn't create link") && message.toLowerCase().includes("page")) {
    return "⚠ Page not found — create it in Shopify Admin first before adding to a menu.";
  }
  if (message.toLowerCase().includes("blog not found") ||
      message.toLowerCase().includes("couldn't create link") && message.toLowerCase().includes("blog")) {
    return "⚠ Blog not found — create it in Shopify Admin first before adding to a menu.";
  }
  return message;
}

function buildGqlItems(items, depth = 0) {
  return items.map(item => {
    const children = item.items && item.items.length > 0 && depth === 0
      ? `items: [${buildGqlItems(item.items, depth + 1).join(", ")}]`
      : null;
    const title = item.title.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const url = item.url.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const type = getMenuItemType(item.url);
    const fields = [`title: "${title}"`, `url: "${url}"`, `type: ${type}`];
    if (children) fields.push(children);
    return `{ ${fields.join(", ")} }`;
  });
}

const MAIN_MENU_GID = "gid://shopify/Menu/252615295227";
const FOOTER_MENU_GID = "gid://shopify/Menu/251808547067";

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get("menuPayload"));
  const menuGid = formData.get("menuGid");

  try {
    const itemsGql = buildGqlItems(payload).join(", ");
    const menuTitle = menuGid === MAIN_MENU_GID ? "Main menu" : "Footer menu";

    const response = await admin.graphql(
      `#graphql
      mutation {
        menuUpdate(id: "${menuGid}", title: "${menuTitle}", items: [${itemsGql}]) {
          menu { id title }
          userErrors { field message }
        }
      }`
    );

    const result = await response.json();
    console.log("menuUpdate result:", JSON.stringify(result, null, 2));

    if (!result?.data?.menuUpdate) {
      return data({ status: "error", message: "No response: " + JSON.stringify(result) });
    }

    if (result.data.menuUpdate.userErrors.length > 0) {
      const raw = result.data.menuUpdate.userErrors[0].message;
      return data({ status: "error", message: friendlyError(raw) });
    }

    return data({ status: "success", message: "Menu successfully torqued down and saved!" });
  } catch (error) {
    return data({ status: "error", message: "Engine fault: " + error.message });
  }
};

const defaultBlueprintMain = [
  { title: "Home", url: "/", items: [] },
  { title: "All Stone", url: "/collections/all-collections", items: [
    { title: "Available Case Files", url: "/collections/all-collections" },
    { title: "The Private Collection", url: "/collections/all-collections" }
  ]},
  { title: "All Tales", url: "/blogs/the-rockhound-logbook", items: [
    { title: "Stories from the Bench", url: "/blogs/the-rockhound-logbook/tagged/stories-from-the-bench" },
    { title: "The Community Archive", url: "/blogs/the-rockhound-logbook/tagged/the-community-archive" }
  ]},
  { title: "Rescue Your Memory", url: "/pages/memories-in-stone", items: [] }
];

const defaultBlueprintFooter = [
  { title: "About the Makers", url: "/pages/about", items: [] },
  { title: "Search the Archive", url: "/search", items: [] },
  { title: "FAQ & Practical Testing", url: "/pages/frequently-asked-questions", items: [] },
  { title: "Standard Specs", url: "/pages/standard-specs", items: [] }
];

function getAllBlueprintUrls(main, footer) {
  const all = [];
  [...main, ...footer].forEach(item => {
    all.push({ title: item.title, url: item.url });
    (item.items || []).forEach(sub => all.push({ title: sub.title, url: sub.url }));
  });
  return all;
}

function buildValidUrlSet(scanResults) {
  const valid = new Set();
  valid.add("/");
  valid.add("/search");
  (scanResults.pages || []).forEach(p => valid.add("/pages/" + p.handle));
  (scanResults.collections || []).forEach(c => valid.add("/collections/" + c.handle));
  (scanResults.blogs || []).forEach(b => valid.add("/blogs/" + b.handle));
  return valid;
}

function getNow() {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function MenuManager() {
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const isSaving = navigation.state === "submitting";
  const isScanning = fetcher.state === "loading";

  const [selectedMenu, setSelectedMenu] = useState(MAIN_MENU_GID);
  const [statusState, setStatusState] = useState("unsaved");
  const [mainItems, setMainItems] = useState(defaultBlueprintMain);
  const [footerItems, setFooterItems] = useState(defaultBlueprintFooter);
  const [scanResults, setScanResults] = useState(null);
  const [scanError, setScanError] = useState(null);
  const [showAutoBuildPreview, setShowAutoBuildPreview] = useState(false);
  const [autoBuildTarget, setAutoBuildTarget] = useState(null);
  const [verifyResults, setVerifyResults] = useState(null);
  const [errorLog, setErrorLog] = useState([]);
  const [addedItems, setAddedItems] = useState({});

  const currentItems = selectedMenu === MAIN_MENU_GID ? mainItems : footerItems;

  const addError = (type, message) => {
    setErrorLog(prev => [{ time: getNow(), type, message }, ...prev].slice(0, 50));
  };

  const getStatusBanner = () => {
    if (statusState === "saved") return { bg: "#0b5b3c", color: "#ffffff", text: "SAVED" };
    if (statusState === "error") return { bg: "#8b0000", color: "#ffffff", text: "ERROR" };
    return { bg: "#ffd700", color: "#000000", text: "UNSAVED CHANGES" };
  };
  const statusConfig = getStatusBanner();

  useEffect(() => {
    if (actionData?.status === "success") setStatusState("saved");
    if (actionData?.status === "error") {
      setStatusState("error");
      addError("SAVE", actionData.message);
    }
  }, [actionData]);

  useEffect(() => {
    if (fetcher.data?.success === true && fetcher.data.pages) {
      setScanResults(fetcher.data);
      setScanError(null);
      setAddedItems({});
    } else if (fetcher.data?.success === false) {
      const errMsg = fetcher.data.error || "Unknown scan error";
      setScanError(errMsg);
      setScanResults(null);
      addError("SCAN", errMsg);
    }
  }, [fetcher.data]);

  const handleMenuChange = (value) => {
    setSelectedMenu(value);
    setStatusState("unsaved");
    setShowAutoBuildPreview(false);
    setVerifyResults(null);
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("menuGid", selectedMenu);
    formData.append("menuPayload", JSON.stringify(currentItems));
    submit(formData, { method: "post" });
  };

  const handleScan = () => {
    fetcher.load("/app/menu-manager?scan=true");
    setVerifyResults(null);
  };

  const handleAutoBuild = (menuGid) => {
    setAutoBuildTarget(menuGid);
    setShowAutoBuildPreview(true);
    setSelectedMenu(menuGid);
    setStatusState("unsaved");
    setVerifyResults(null);
  };

  const handleConfirmAutoBuild = () => {
    if (autoBuildTarget === MAIN_MENU_GID) setMainItems(defaultBlueprintMain);
    else setFooterItems(defaultBlueprintFooter);
    const formData = new FormData();
    formData.append("menuGid", autoBuildTarget);
    formData.append("menuPayload", JSON.stringify(
      autoBuildTarget === MAIN_MENU_GID ? defaultBlueprintMain : defaultBlueprintFooter
    ));
    submit(formData, { method: "post" });
    setShowAutoBuildPreview(false);
  };

  const handleRemoveItem = (index) => {
    if (selectedMenu === MAIN_MENU_GID) {
      setMainItems(prev => prev.filter((_, i) => i !== index));
    } else {
      setFooterItems(prev => prev.filter((_, i) => i !== index));
    }
    setStatusState("unsaved");
    setVerifyResults(null);
  };

  const handleAddToMenu = (title, url, menuGid) => {
    const key = menuGid + "|" + url;
    if (addedItems[key]) return;
    const newItem = { title, url, items: [] };
    if (menuGid === MAIN_MENU_GID) {
      setMainItems(prev => [...prev, newItem]);
    } else {
      setFooterItems(prev => [...prev, newItem]);
    }
    setAddedItems(prev => ({ ...prev, [key]: true }));
    setStatusState("unsaved");
    setVerifyResults(null);
  };

  const handleVerify = () => {
    if (!scanResults) {
      addError("VERIFY", "Run SCAN STORE first before verifying.");
      return;
    }
    const validUrls = buildValidUrlSet(scanResults);
    const allUrls = getAllBlueprintUrls(mainItems, footerItems);
    const results = allUrls.map(item => {
      let urlToCheck = item.url;
      if (urlToCheck.includes("/tagged/")) {
        urlToCheck = urlToCheck.split("/tagged/")[0];
      }
      const ok = validUrls.has(urlToCheck);
      return { title: item.title, url: item.url, ok };
    });
    setVerifyResults(results);
    const failures = results.filter(r => !r.ok);
    if (failures.length > 0) {
      addError("VERIFY", failures.length + " URL(s) not found in store: " + failures.map(f => f.url).join(", "));
    }
  };

  const allVerifyPassed = verifyResults && verifyResults.every(r => r.ok);

  const menuOptions = [
    { label: "Main Menu (Header)", value: MAIN_MENU_GID },
    { label: "Footer Menu", value: FOOTER_MENU_GID },
  ];

  const renderScanSection = (label, items, prefix) => (
    <Box padding="300" background="bg-surface-secondary" borderRadius="100">
      <Text as="h4" variant="headingMd" fontWeight="bold">{label} ({items?.length ?? 0})</Text>
      <BlockStack gap="300">
        {(items ?? []).map(item => {
          const url = prefix + item.handle;
          const addedMain = addedItems[MAIN_MENU_GID + "|" + url];
          const addedFooter = addedItems[FOOTER_MENU_GID + "|" + url];
          return (
            <Box key={item.id} padding="200" background="bg-surface" borderRadius="100">
              <BlockStack gap="200">
                <Text as="p" variant="bodyLg" fontWeight="bold">{item.title}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">{url}</Text>
                <InlineStack gap="300">
                  <Button
                    size="large"
                    variant="primary"
                    tone={addedMain ? "success" : undefined}
                    onClick={() => handleAddToMenu(item.title, url, MAIN_MENU_GID)}
                    disabled={!!addedMain}
                  >
                    <span style={{ fontSize: "15px", fontWeight: "bold" }}>
                      {addedMain ? "✅ Added to Main" : "+ ADD TO MAIN"}
                    </span>
                  </Button>
                  <Button
                    size="large"
                    variant="primary"
                    tone={addedFooter ? "success" : undefined}
                    onClick={() => handleAddToMenu(item.title, url, FOOTER_MENU_GID)}
                    disabled={!!addedFooter}
                  >
                    <span style={{ fontSize: "15px", fontWeight: "bold" }}>
                      {addedFooter ? "✅ Added to Footer" : "+ ADD TO FOOTER"}
                    </span>
                  </Button>
                </InlineStack>
              </BlockStack>
            </Box>
          );
        })}
      </BlockStack>
    </Box>
  );

  return (
    <Page title="Rockhound Menu Manager">
      <Layout>
        <Layout.Section>

          {/* STATUS BANNER */}
          <Box padding="400" background="bg-surface" borderRadius="200" shadow="100">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h1" variant="heading2xl" fontWeight="bold">Dashboard Status</Text>
              <div style={{ backgroundColor: statusConfig.bg, color: statusConfig.color, padding: "12px 24px", borderRadius: "8px", fontWeight: "bold", fontSize: "18px", border: "2px solid #000" }}>
                {statusConfig.text}
              </div>
            </InlineStack>
            {actionData?.message && (
              <Box paddingBlockStart="300">
                <Text as="p" variant="bodyLg" fontWeight="bold">{actionData.message}</Text>
              </Box>
            )}
          </Box>
          <br />

          {/* SCAN STORE */}
          <Card padding="600">
            <BlockStack gap="500">
              <Text as="h2" variant="headingXl" fontWeight="bold">Store Scanner</Text>
              <Text as="p" variant="bodyLg">
                Scan your live store. Hit ADD TO MAIN or ADD TO FOOTER next to any item to wire it in.
              </Text>

              <Button size="large" variant="primary" onClick={handleScan} loading={isScanning}>
                <span style={{ fontSize: "18px", fontWeight: "bold" }}>SCAN STORE</span>
              </Button>

              {scanError && (
                <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                  <Text as="p" variant="bodyLg" fontWeight="bold" tone="critical">⚠ Scan failed: {scanError}</Text>
                </Box>
              )}

              {scanResults && (
                <BlockStack gap="400">
                  <Divider />
                  <Text as="h3" variant="headingLg" fontWeight="bold">Scan Results</Text>
                  {renderScanSection("Pages", scanResults.pages, "/pages/")}
                  {renderScanSection("Collections", scanResults.collections, "/collections/")}
                  {renderScanSection("Blogs", scanResults.blogs, "/blogs/")}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
          <br />

          {/* VERIFY BLUEPRINT */}
          <Card padding="600">
            <BlockStack gap="500">
              <Text as="h2" variant="headingXl" fontWeight="bold">Blueprint Verifier</Text>
              <Text as="p" variant="bodyLg">
                Cross-checks every URL in both menus against your live store scan.
                Run SCAN STORE first, then hit VERIFY.
              </Text>

              <Button
                size="large"
                variant="primary"
                tone={allVerifyPassed ? "success" : undefined}
                onClick={handleVerify}
                disabled={!scanResults}
              >
                <span style={{ fontSize: "18px", fontWeight: "bold" }}>
                  {allVerifyPassed ? "✅ ALL URLS VERIFIED" : "🔍 VERIFY BLUEPRINT"}
                </span>
              </Button>

              {!scanResults && (
                <Text as="p" variant="bodyMd" tone="subdued">Run SCAN STORE above to enable verification.</Text>
              )}

              {verifyResults && (
                <BlockStack gap="300">
                  <Divider />
                  <Text as="h3" variant="headingLg" fontWeight="bold">
                    Verification Results — {verifyResults.filter(r => r.ok).length}/{verifyResults.length} passed
                  </Text>
                  {verifyResults.map((r, i) => (
                    <Box key={i} padding="300" borderRadius="100" background="bg-surface-secondary">
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="050">
                          <Text as="p" variant="bodyLg" fontWeight="bold">{r.title}</Text>
                          <Text as="p" variant="bodyMd">{r.url}</Text>
                        </BlockStack>
                        <div style={{
                          backgroundColor: r.ok ? "#0b5b3c" : "#8b0000",
                          color: "#ffffff",
                          padding: "6px 16px",
                          borderRadius: "6px",
                          fontWeight: "bold",
                          fontSize: "16px",
                          minWidth: "80px",
                          textAlign: "center"
                        }}>
                          {r.ok ? "✅ OK" : "❌ 404"}
                        </div>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
          <br />

          {/* AUTO-BUILD */}
          <Card padding="600">
            <BlockStack gap="500">
              <Text as="h2" variant="headingXl" fontWeight="bold">Auto-Build from Blueprint</Text>
              <Text as="p" variant="bodyLg">Reset either menu back to the Rockhound blueprint. Preview before saving.</Text>

              <InlineStack gap="400">
                <Button size="large" variant="primary" onClick={() => handleAutoBuild(MAIN_MENU_GID)}>
                  <span style={{ fontSize: "18px", fontWeight: "bold" }}>BUILD MAIN MENU</span>
                </Button>
                <Button size="large" variant="primary" onClick={() => handleAutoBuild(FOOTER_MENU_GID)}>
                  <span style={{ fontSize: "18px", fontWeight: "bold" }}>BUILD FOOTER MENU</span>
                </Button>
              </InlineStack>

              {showAutoBuildPreview && (
                <BlockStack gap="400">
                  <Divider />
                  <div style={{ backgroundColor: "#ffd700", padding: "12px 20px", borderRadius: "8px", border: "2px solid #000" }}>
                    <Text as="p" variant="headingLg" fontWeight="bold">⚠ PREVIEW — Review before saving</Text>
                  </div>
                  <BlockStack gap="200">
                    {(autoBuildTarget === MAIN_MENU_GID ? defaultBlueprintMain : defaultBlueprintFooter).map((item, i) => (
                      <Box key={i} padding="300" background="bg-surface-secondary" borderRadius="100">
                        <Text as="h3" variant="headingLg" fontWeight="bold">{item.title}</Text>
                        <Text as="p" variant="bodyLg">{item.url}</Text>
                        {item.items && item.items.map((sub, j) => (
                          <Text key={j} as="p" variant="bodyMd">↳ {sub.title} — {sub.url}</Text>
                        ))}
                      </Box>
                    ))}
                  </BlockStack>
                  <Button size="large" variant="primary" tone="success" onClick={handleConfirmAutoBuild} loading={isSaving}>
                    <span style={{ fontSize: "20px", fontWeight: "bold" }}>✅ CONFIRM & SAVE TO SHOPIFY</span>
                  </Button>
                </BlockStack>
              )}
            </BlockStack>
          </Card>
          <br />

          {/* MANUAL EDITOR */}
          <Card padding="600">
            <BlockStack gap="500">
              <Text as="h2" variant="headingXl" fontWeight="bold">Select Engine Mount</Text>

              <Select
                label={<Text as="span" variant="headingLg" fontWeight="bold">Choose Menu to Edit</Text>}
                options={menuOptions}
                onChange={handleMenuChange}
                value={selectedMenu}
              />

              <Divider />

              <Text as="h2" variant="headingXl" fontWeight="bold">
                Current Wiring — {selectedMenu === MAIN_MENU_GID ? "Main Menu" : "Footer Menu"} ({currentItems.length} items)
              </Text>

              <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                <BlockStack gap="400">
                  {currentItems.map((item, index) => (
                    <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="100">
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingLg" fontWeight="bold">{item.title}</Text>
                          <Text as="p" variant="bodyLg">{item.url}</Text>
                        </BlockStack>
                        <Button
                          size="large"
                          tone="critical"
                          onClick={() => handleRemoveItem(index)}
                        >
                          Remove
                        </Button>
                      </InlineStack>

                      {item.items && item.items.length > 0 && (
                        <Box paddingBlockStart="300" paddingInlineStart="600">
                          <BlockStack gap="200">
                            {item.items.map((subItem, subIndex) => (
                              <InlineStack key={subIndex} align="space-between" blockAlign="center">
                                <Text as="p" variant="headingMd" fontWeight="bold">↳ {subItem.title} ({subItem.url})</Text>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </Box>
                      )}
                    </Box>
                  ))}
                </BlockStack>
              </Box>

              <Box paddingBlockStart="500">
                <Button size="large" variant="primary" tone="success" onClick={handleSave} loading={isSaving}>
                  <span style={{ fontSize: "20px", fontWeight: "bold" }}>💾 SAVE WIRING TO SHOPIFY</span>
                </Button>
              </Box>
            </BlockStack>
          </Card>
          <br />

          {/* ERROR LOG */}
          <Card padding="600">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingXl" fontWeight="bold">Error Log</Text>
                <Button size="large" tone="critical" onClick={() => setErrorLog([])}>
                  <span style={{ fontSize: "16px", fontWeight: "bold" }}>CLEAR LOG</span>
                </Button>
              </InlineStack>

              {errorLog.length === 0 ? (
                <Box padding="300" background="bg-surface-secondary" borderRadius="100">
                  <Text as="p" variant="bodyLg" tone="subdued">No errors recorded this session.</Text>
                </Box>
              ) : (
                <BlockStack gap="200">
                  {errorLog.map((entry, i) => (
                    <Box key={i} padding="300" borderRadius="100" background="bg-surface-secondary">
                      <InlineStack gap="400" blockAlign="start">
                        <div style={{
                          backgroundColor: "#8b0000",
                          color: "#ffffff",
                          padding: "4px 12px",
                          borderRadius: "4px",
                          fontWeight: "bold",
                          fontSize: "14px",
                          whiteSpace: "nowrap"
                        }}>
                          {entry.type}
                        </div>
                        <div style={{ color: "#888", fontSize: "14px", whiteSpace: "nowrap" }}>{entry.time}</div>
                        <Text as="p" variant="bodyLg">{entry.message}</Text>
                      </InlineStack>
                    </Box>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>

        </Layout.Section>
      </Layout>
    </Page>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useSubmit, useNavigation, useActionData, useNavigate } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, TextField, Button,
  Badge, Spinner, Checkbox, Box, Divider, Modal, Frame, Toast, Icon
} from "@shopify/polaris";
import { DragHandleIcon, DeleteIcon, RefreshIcon, CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";

// ==========================================
// HELPER: HTML PARSER
// ==========================================
const extractImagesFromHtml = (html) => {
  if (!html) return [];
  const imgRegex = /<img[^>]+>/g;
  const srcRegex = /src=["']([^"']+)["']/;
  const altRegex = /alt=["']([^"']*)["']/;
  
  const images = [];
  let match;
  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(srcRegex);
    const altMatch = imgTag.match(altRegex);
    
    if (srcMatch && srcMatch[1]) {
      // Ensure it's a valid URL or CDN path
      images.push({
        src: srcMatch[1],
        alt: altMatch ? altMatch[1] : ""
      });
    }
  }
  return images;
};

// ==========================================
// 1. ENGINE: LOADER
// ==========================================
export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    // A. Fetch existing exclude settings from Shop Metafields
    const settingsQuery = `#graphql
      query {
        shop {
          metafield(namespace: "image_extractor", key: "excludes") {
            value
          }
        }
      }
    `;
    const settingsRes = await admin.graphql(settingsQuery);
    const settingsData = await settingsRes.json();
    const excludedHandlesStr = settingsData.data?.shop?.metafield?.value || "";

    // B. Fetch existing saved Metaobjects (The Pool)
    let savedPool = {};
    let hasNextMeta = true;
    let cursorMeta = null;
    
    while (hasNextMeta) {
      const metaQuery = `#graphql
        query($cursor: String) {
          metaobjects(type: "story_slideshow_pool", first: 50, after: $cursor) {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                handle
                page_url: field(key: "page_url") { value }
                image_urls: field(key: "image_urls") { value }
                image_alts: field(key: "image_alts") { value }
                display_order: field(key: "display_order") { value }
              }
            }
          }
        }
      `;
      const mRes = await admin.graphql(metaQuery, { variables: { cursor: cursorMeta } });
      const mData = await mRes.json();
      
      const objects = mData.data?.metaobjects?.edges || [];
      objects.forEach(({ node }) => {
        savedPool[node.handle] = {
          image_urls: node.image_urls?.value ? JSON.parse(node.image_urls.value) : [],
          image_alts: node.image_alts?.value ? JSON.parse(node.image_alts.value) : [],
          display_order: node.display_order?.value ? JSON.parse(node.display_order.value) : []
        };
      });

      hasNextMeta = mData.data?.metaobjects?.pageInfo?.hasNextPage || false;
      cursorMeta = mData.data?.metaobjects?.pageInfo?.endCursor || null;
    }

    // C. Fetch all published pages using strict cycle limits
    let allPages = [];
    let hasNext = true;
    let cursor = null;
    let cycleCount = 0;

    while (hasNext && cycleCount < 20) {
      const pageQuery = `#graphql
        query($cursor: String) {
          pages(first: 50, after: $cursor, query: "published_status:published") {
            pageInfo { hasNextPage endCursor }
            edges {
              node {
                id
                title
                handle
                bodyHtml
              }
            }
          }
        }
      `;
      const res = await admin.graphql(pageQuery, { variables: { cursor } });
      const data = await res.json();

      if (data.errors) {
        throw new Error(data.errors[0].message);
      }

      const rawPages = data.data?.pages?.edges || [];
      
      rawPages.forEach(({ node }) => {
        const extractedImages = extractImagesFromHtml(node.bodyHtml);
        if (extractedImages.length > 0) {
          allPages.push({
            id: node.id,
            handle: node.handle,
            title: node.title,
            url: `/pages/${node.handle}`,
            images: extractedImages
          });
        }
      });

      hasNext = data.data?.pages?.pageInfo?.hasNextPage || false;
      cursor = data.data?.pages?.pageInfo?.endCursor || null;
      cycleCount++;
    }

    return { pages: allPages, savedPool, excludedHandlesStr, success: true };

  } catch (error) {
    console.error("LOADER FAULT:", error.message);
    return { error: error.message, success: false };
  }
};

// ==========================================
// 2. ENGINE: ACTION (SAVE)
// ==========================================
export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  
  try {
    const payload = JSON.parse(formData.get("payload"));
    const { curatedPages, excludedHandlesStr } = payload;

    // 1. Save Excludes to Shop Metafield
    const updateExcludesQuery = `#graphql
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `;
    await admin.graphql(updateExcludesQuery, {
      variables: {
        metafields: [{
          namespace: "image_extractor",
          key: "excludes",
          type: "single_line_text_field",
          value: excludedHandlesStr,
          ownerId: (await admin.graphql(`query { shop { id } }`)).json().then(res => res.data.shop.id)
        }]
      }
    });

    // 2. Upsert Metaobjects per page
    for (const page of curatedPages) {
      if (page.selectedImages.length === 0) continue; // Skip empty pools

      const upsertQuery = `#graphql
        mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
          metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
            metaobject { id }
            userErrors { field message }
          }
        }
      `;

      await admin.graphql(upsertQuery, {
        variables: {
          handle: { type: "story_slideshow_pool", handle: page.handle },
          metaobject: {
            capabilities: { publishable: { status: "ACTIVE" } },
            fields: [
              { key: "page_title", value: page.title },
              { key: "page_url", value: page.url },
              { key: "image_urls", value: JSON.stringify(page.selectedImages.map(img => img.src)) },
              { key: "image_alts", value: JSON.stringify(page.selectedImages.map(img => img.alt)) },
              { key: "display_order", value: JSON.stringify(page.selectedImages.map(img => img.src)) }
            ]
          }
        }
      });
    }

    return { success: true, timestamp: new Date().toLocaleTimeString() };

  } catch (error) {
    console.error("ACTION FAULT:", error.message);
    return { error: error.message, success: false };
  }
};

// ==========================================
// 3. CHASSIS: UI DASHBOARD
// ==========================================
export default function ImageExtractor() {
  const loaderData = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const isSaving = navigation.state === "submitting";

  const [excludes, setExcludes] = useState("");
  const [pageData, setPageData] = useState([]);
  
  // Toast & Modal State
  const [toastMsg, setToastMsg] = useState("");
  const [toastError, setToastError] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  // Initialize State
  useEffect(() => {
    if (loaderData?.success) {
      setExcludes(loaderData.excludedHandlesStr);
      
      const structuredData = loaderData.pages.map(page => {
        const savedData = loaderData.savedPool[page.handle];
        let orderedImages = [];
        
        if (savedData && savedData.display_order && savedData.display_order.length > 0) {
          // Reconstruct saved order
          savedData.display_order.forEach(savedSrc => {
            const foundExtracted = page.images.find(img => img.src === savedSrc);
            if (foundExtracted) {
              orderedImages.push({ ...foundExtracted, selected: true });
            }
          });
          // Append any newly found extracted images that weren't in the saved order
          page.images.forEach(img => {
            if (!savedData.display_order.includes(img.src)) {
              orderedImages.push({ ...img, selected: false });
            }
          });
        } else {
          // No saved data, just map extracted
          orderedImages = page.images.map(img => ({ ...img, selected: false }));
        }

        return { ...page, images: orderedImages };
      });

      setPageData(structuredData);
    }
    
    if (loaderData?.error) {
      setToastError(true);
      setToastMsg(`Failed to load: ${loaderData.error}`);
    }
  }, [loaderData]);

  // Action Success Handler
  useEffect(() => {
    if (actionData?.success) {
      setToastError(false);
      setToastMsg(`Pool saved successfully at ${actionData.timestamp}`);
    } else if (actionData?.error) {
      setToastError(true);
      setToastMsg(`Save failed: ${actionData.error}`);
    }
  }, [actionData]);

  // ==========================================
  // LOGIC CONTROLLERS
  // ==========================================
  const toggleImageSelect = (pageId, src) => {
    setPageData(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return {
        ...p,
        images: p.images.map(img => img.src === src ? { ...img, selected: !img.selected } : img)
      };
    }));
  };

  const toggleSelectAll = (pageId, forceState) => {
    setPageData(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return {
        ...p,
        images: p.images.map(img => ({ ...img, selected: forceState }))
      };
    }));
  };

  // Drag and Drop Handlers
  const handleDragStart = (e, pageId, index) => {
    e.dataTransfer.setData("pageId", pageId);
    e.dataTransfer.setData("index", index);
  };

  const handleDrop = (e, pageId, dropIndex) => {
    const sourcePageId = e.dataTransfer.getData("pageId");
    if (sourcePageId !== pageId) return; // Block cross-page dragging
    
    const dragIndex = parseInt(e.dataTransfer.getData("index"), 10);
    if (dragIndex === dropIndex) return;

    setPageData(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      const newImages = [...p.images];
      const [draggedItem] = newImages.splice(dragIndex, 1);
      newImages.splice(dropIndex, 0, draggedItem);
      return { ...p, images: newImages };
    }));
  };

  const runSyncAndClean = () => {
    let orphansRemoved = 0;
    
    setPageData(prev => {
      return prev.map(page => {
        const savedData = loaderData.savedPool[page.handle];
        if (!savedData) return page;

        const liveUrls = page.images.map(img => img.src);
        let cleanedImages = [...page.images];

        // If a saved image is no longer in live HTML, deselect it (it's orphaned)
        savedData.image_urls.forEach(savedSrc => {
          if (!liveUrls.includes(savedSrc)) {
            orphansRemoved++;
            // The item is already technically removed because it's not in page.images anymore,
            // but we register the count for the toast.
          }
        });
        return { ...page, images: cleanedImages };
      });
    });

    setToastError(false);
    setToastMsg(orphansRemoved > 0 ? `Swept ${orphansRemoved} orphaned images.` : "Pool is perfectly synced.");
  };

  const handleSave = () => {
    const curatedPages = pageData
      .filter(p => !getExcludedList().includes(p.handle)) // Don't save excluded pages
      .map(p => ({
        handle: p.handle,
        title: p.title,
        url: p.url,
        selectedImages: p.images.filter(img => img.selected)
      }));

    const payload = { curatedPages, excludedHandlesStr: excludes };
    
    const formData = new FormData();
    formData.append("payload", JSON.stringify(payload));
    submit(formData, { method: "post" });
  };

  // Helpers
  const getExcludedList = () => excludes.split(",").map(s => s.trim().toLowerCase());
  const activePages = pageData.filter(p => !getExcludedList().includes(p.handle));

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <Frame>
      <Page
        title="Command Center: Image Extractor"
        subtitle="Curate the high-speed CDN image pool for your storefront slideshow."
        fullWidth
        backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
        primaryAction={{
          content: "Save Pool to Storefront",
          onAction: handleSave,
          loading: isSaving,
          disabled: activePages.length === 0,
          accessibilityLabel: "Save the curated image pool to Shopify Metaobjects"
        }}
        secondaryActions={[{
          content: "Sync & Clean",
          icon: RefreshIcon,
          onAction: runSyncAndClean,
          accessibilityLabel: "Scan pool for missing images and clean them out"
        }]}
      >
        <BlockStack gap="600">

          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Exclusion Rules</Text>
              <TextField
                label="Exclude Page Handles"
                value={excludes}
                onChange={setExcludes}
                helpText="Comma separated. Any page matching these handles will be ignored by the crawler (e.g. contact, privacy-policy)."
                autoComplete="off"
                disabled={isSaving}
              />
            </BlockStack>
          </Card>

          {loaderData && !loaderData.success && (
            <Card padding="400"><Text tone="critical">Engine Fault: Check Loader connection.</Text></Card>
          )}

          {activePages.length === 0 && loaderData?.success && (
            <Card padding="400">
              <Box padding="400" textAlign="center">
                <Text tone="subdued">No images found or all pages are excluded.</Text>
              </Box>
            </Card>
          )}

          {activePages.map((page) => {
            const selectedCount = page.images.filter(img => img.selected).length;
            const allSelected = selectedCount === page.images.length;

            return (
              <Card key={page.id} padding="400">
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="headingLg" as="h3">{page.title}</Text>
                      <Text tone="subdued" variant="bodySm">{page.url}</Text>
                    </BlockStack>
                    <InlineStack gap="300" blockAlign="center">
                      <Badge tone={selectedCount > 0 ? "success" : "warning"}>
                        {selectedCount} Selected
                      </Badge>
                      <Button 
                        onClick={() => toggleSelectAll(page.id, !allSelected)}
                        size="micro"
                        accessibilityLabel={`Select or deselect all images for ${page.title}`}
                        minHeight="48px"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </Button>
                    </InlineStack>
                  </InlineStack>

                  <Divider />

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "16px" }}>
                    {page.images.map((img, index) => (
                      <div
                        key={img.src}
                        draggable
                        onDragStart={(e) => handleDragStart(e, page.id, index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleDrop(e, page.id, index)}
                        style={{
                          position: "relative",
                          border: img.selected ? "2px solid #005bd3" : "2px solid transparent",
                          borderRadius: "8px",
                          overflow: "hidden",
                          cursor: "grab",
                          backgroundColor: "#f4f6f8"
                        }}
                      >
                        <div style={{ position: "absolute", top: "8px", left: "8px", zIndex: 10 }}>
                          <Checkbox
                            checked={img.selected}
                            onChange={() => toggleImageSelect(page.id, img.src)}
                            labelHidden
                            label={`Select image ${index + 1}`}
                          />
                        </div>
                        <div 
                          style={{ position: "absolute", top: "8px", right: "8px", zIndex: 10, background: "rgba(255,255,255,0.8)", borderRadius: "4px" }}
                          aria-label="Drag to reorder"
                        >
                          <Icon source={DragHandleIcon} tone="base" />
                        </div>
                        
                        <button
                          type="button"
                          onClick={() => setPreviewImage(img.src)}
                          style={{ border: "none", background: "none", padding: 0, width: "100%", height: "150px", cursor: "pointer", display: "block", minHeight: "48px" }}
                          aria-label={`Preview image ${index + 1} for ${page.title}`}
                        >
                          <img 
                            src={img.src} 
                            alt={img.alt || "Extracted image"} 
                            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                          />
                        </button>
                      </div>
                    ))}
                  </div>
                </BlockStack>
              </Card>
            );
          })}

          {activePages.length > 0 && (
            <InlineStack align="end">
               <Button 
                 variant="primary" 
                 size="large" 
                 loading={isSaving} 
                 onAction={handleSave}
                 accessibilityLabel="Save the curated image pool to Shopify Metaobjects"
               >
                 Save Pool
               </Button>
            </InlineStack>
          )}

        </BlockStack>

        {toastMsg && (
          <Toast 
            content={toastMsg} 
            error={toastError} 
            onDismiss={() => setToastMsg("")} 
            duration={4500} 
          />
        )}

        <Modal
          open={!!previewImage}
          onClose={() => setPreviewImage(null)}
          title="Image Preview"
        >
          <Modal.Section>
             {previewImage && (
               <img 
                 src={previewImage} 
                 alt="Preview" 
                 style={{ width: "100%", height: "auto", display: "block" }} 
               />
             )}
          </Modal.Section>
        </Modal>

      </Page>
    </Frame>
  );
}
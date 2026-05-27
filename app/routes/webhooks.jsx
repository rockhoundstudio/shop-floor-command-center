import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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
      images.push({
        src: srcMatch[1],
        alt: (altMatch && altMatch[1]) ? altMatch[1] : ""
      });
    }
  }
  
  return images;
};

// ==========================================
// WEBHOOK ACTION HANDLER
// ==========================================
export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      break;

    // ==========================================
    // AUTO-SYNC COLLECTIONS TO FOOTER MENU
    // ==========================================
    case "COLLECTIONS_CREATE":
      try {
        const footerSetting = await prisma.menuSetting.findUnique({
          where: { menuHandle: "footer" }
        });

        if (footerSetting && footerSetting.autoSync) {
          const collectionTitle = payload.title;
          const collectionHandle = payload.handle;
          const newUrl = `/collections/${collectionHandle}`;

          const menuRes = await admin.graphql(`#graphql
            query {
              menus(first: 1, query: "handle:footer") {
                edges {
                  node {
                    id
                    title
                    handle
                    items {
                      title
                      url
                      type
                      items {
                        title
                        url
                        type
                      }
                    }
                  }
                }
              }
            }
          `);
          
          const menuJson = await menuRes.json();
          const footerMenu = menuJson.data?.menus?.edges[0]?.node;

          if (footerMenu) {
            const formatItem = (item) => ({
              title: item.title,
              url: item.url || "#",
              type: "HTTP",
              items: (item.items && item.items.length > 0) ? item.items.map(formatItem) : []
            });

            const currentItems = footerMenu.items.map(formatItem);
            const alreadyExists = currentItems.some(item => item.url === newUrl);

            if (!alreadyExists) {
              currentItems.push({
                title: collectionTitle,
                url: newUrl,
                type: "HTTP",
                items: []
              });

              await admin.graphql(`#graphql
                mutation menuUpdate($id: ID!, $title: String!, $handle: String!, $items: [MenuItemUpdateInput!]!) {
                  menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
                    userErrors { message }
                  }
                }
              `, {
                variables: {
                  id: footerMenu.id,
                  title: footerMenu.title,
                  handle: "footer",
                  items: currentItems
                }
              });

              await prisma.menuHistory.create({
                data: {
                  menuHandle: "footer",
                  message: `⚡ Auto-synced new collection: ${collectionTitle}`
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("Error in COLLECTIONS_CREATE webhook:", error);
      }
      break;

    // ==========================================
    // AUTO-EXTRACT IMAGES FROM PAGES
    // ==========================================
    case "PAGES_CREATE":
    case "PAGES_UPDATE":
      try {
        if (!payload.body_html || !payload.handle || !payload.title) {
          break; 
        }

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
        const excludedHandles = excludedHandlesStr.split(",").map(s => s.trim().toLowerCase());

        if (excludedHandles.includes(payload.handle.toLowerCase())) {
          console.log(`[Image Extractor] Skipped excluded page: ${payload.handle}`);
          break;
        }

        const extractedImages = extractImagesFromHtml(payload.body_html);
        
        if (extractedImages.length === 0) {
          console.log(`[Image Extractor] No images found on page: ${payload.handle}`);
          break;
        }

        const liveImageUrls = extractedImages.map(img => img.src);
        let finalDisplayOrder = [...liveImageUrls];

        // Fetch existing metaobject to preserve drag-and-drop order
        const existingMetaQuery = `#graphql
          query getExistingMetaobject($handle: MetaobjectHandleInput!) {
            metaobject(handle: $handle) {
              fields {
                key
                value
              }
            }
          }
        `;
        const existingRes = await admin.graphql(existingMetaQuery, {
          variables: { handle: { type: "story_slideshow_pool", handle: payload.handle } }
        });
        const existingData = await existingRes.json();
        const existingFields = existingData.data?.metaobject?.fields || [];
        const orderField = existingFields.find(f => f.key === "display_order");

        // Merge logic: Preserve sorting, remove deleted images, append new ones
        if (orderField && orderField.value) {
          try {
            const savedOrder = JSON.parse(orderField.value);
            const preservedOrder = savedOrder.filter(url => liveImageUrls.includes(url));
            const newUrls = liveImageUrls.filter(url => !savedOrder.includes(url));
            finalDisplayOrder = [...preservedOrder, ...newUrls];
          } catch (e) {
            console.error("Failed to parse existing display_order", e);
          }
        }

        const upsertQuery = `#graphql
          mutation metaobjectUpsert($handle: MetaobjectHandleInput!, $metaobject: MetaobjectUpsertInput!) {
            metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
              metaobject { id }
              userErrors { field message }
            }
          }
        `;

        const variables = {
          handle: { type: "story_slideshow_pool", handle: payload.handle },
          metaobject: {
            capabilities: { publishable: { status: "ACTIVE" } },
            fields: [
              { key: "page_title", value: payload.title },
              { key: "page_url", value: `https://rockhoundstudio.com/pages/${payload.handle}` },
              { key: "image_urls", value: JSON.stringify(liveImageUrls) },
              { key: "image_alts", value: JSON.stringify(extractedImages.map(img => (!img.alt || img.alt.trim() === "") ? payload.title : img.alt)) },
              { key: "display_order", value: JSON.stringify(finalDisplayOrder) }
            ]
          }
        };

        const upsertRes = await admin.graphql(upsertQuery, { variables });
        const upsertData = await upsertRes.json();

        if (upsertData.errors || (upsertData.data?.metaobjectUpsert?.userErrors && upsertData.data.metaobjectUpsert.userErrors.length > 0)) {
          console.error(`[Image Extractor] Webhook Upsert Failed for ${payload.handle}:`, JSON.stringify(upsertData));
        } else {
          console.log(`[Image Extractor] Successfully auto-synced ${extractedImages.length} images for ${payload.handle}`);
        }

      } catch (error) {
        console.error("Error in PAGES_UPDATE webhook:", error);
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response(); 
};

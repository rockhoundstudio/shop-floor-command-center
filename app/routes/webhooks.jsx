import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ==========================================
// HELPER: HTML PARSER
// ==========================================
const extractImagesFromHtml = (html) => {
  if (html === null) { return []; }
  if (html === undefined) { return []; }
  if (html === "") { return []; }
  
  const imgRegex = /<img[^>]+>/g;
  const srcRegex = /src=["']([^"']+)["']/;
  const altRegex = /alt=["']([^"']*)["']/;
  
  const images = [];
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(srcRegex);
    const altMatch = imgTag.match(altRegex);
    
    if (srcMatch) {
      if (srcMatch[1]) {
        images.push({
          src: srcMatch[1],
          alt: altMatch ? (altMatch[1] ? altMatch[1] : "") : ""
        });
      }
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
    // The admin context isn't available if the webhook is fired after a shop uninstalls the app
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
        // 1. Check if Footer Auto-Sync is turned on in the database
        const footerSetting = await prisma.menuSetting.findUnique({
          where: { menuHandle: "footer" }
        });

        if (footerSetting) {
          if (footerSetting.autoSync) {
            const collectionTitle = payload.title;
            const collectionHandle = payload.handle;
            const newUrl = `/collections/${collectionHandle}`;

            // 2. Fetch the current footer menu from Shopify
            const menuRes = await admin.graphql(`
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
              // 3. Format existing items so Shopify accepts them back
              const formatItem = (item) => {
                let formattedItems = [];
                if (item.items) {
                  if (item.items.length > 0) {
                    formattedItems = item.items.map(formatItem);
                  }
                }
                
                return {
                  title: item.title,
                  url: item.url ? item.url : "#",
                  type: "HTTP",
                  items: formattedItems
                };
              };

              const currentItems = footerMenu.items.map(formatItem);
              
              // Safety Check: Don't add it if it somehow already exists
              const alreadyExists = currentItems.some(item => item.url === newUrl);

              if (!alreadyExists) {
                // Append the new collection to the end of the menu
                currentItems.push({
                  title: collectionTitle,
                  url: newUrl,
                  type: "HTTP",
                  items: []
                });

                // 4. Update the menu in Shopify
                await admin.graphql(`
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

                // 5. Log the action to the MenuHistory table in Prisma
                await prisma.menuHistory.create({
                  data: {
                    menuHandle: "footer",
                    message: `⚡ Auto-synced new collection: ${collectionTitle}`
                  }
                });
              }
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
        if (!payload.body_html) { break; }
        if (!payload.handle) { break; }
        if (!payload.title) { break; }

        // 1. Fetch Global Excludes (e.g. contact, privacy-policy)
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
        
        let excludedHandlesStr = "";
        if (settingsData.data) {
          if (settingsData.data.shop) {
            if (settingsData.data.shop.metafield) {
              if (settingsData.data.shop.metafield.value) {
                excludedHandlesStr = settingsData.data.shop.metafield.value;
              }
            }
          }
        }

        const excludedHandles = excludedHandlesStr.split(",").map(s => s.trim().toLowerCase());

        // 2. Bail out immediately if this page is excluded
        if (excludedHandles.includes(payload.handle.toLowerCase())) {
          console.log(`[Image Extractor] Skipped excluded page: ${payload.handle}`);
          break;
        }

        // 3. Extract Images
        const extractedImages = extractImagesFromHtml(payload.body_html);
        
        // Bail out if there are no images
        if (extractedImages.length === 0) {
          console.log(`[Image Extractor] No images found on page: ${payload.handle}`);
          break;
        }

        // 4. Save to Metaobject Pool
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
              { key: "image_urls", value: JSON.stringify(extractedImages.map(img => img.src)) },
              { key: "image_alts", value: JSON.stringify(extractedImages.map(img => {
                 if (!img.alt) { return payload.title; }
                 if (img.alt.trim() === "") { return payload.title; }
                 return img.alt;
              })) },
              { key: "display_order", value: JSON.stringify(extractedImages.map(img => img.src)) }
            ]
          }
        };

        const upsertRes = await admin.graphql(upsertQuery, { variables });
        const upsertData = await upsertRes.json();

        if (upsertData.errors) {
          console.error(`[Image Extractor] Webhook Upsert Root Error for ${payload.handle}:`, upsertData.errors);
        } else {
          if (upsertData.data) {
            if (upsertData.data.metaobjectUpsert) {
              if (upsertData.data.metaobjectUpsert.userErrors) {
                if (upsertData.data.metaobjectUpsert.userErrors.length > 0) {
                  console.error(`[Image Extractor] UserErrors for ${payload.handle}:`, upsertData.data.metaobjectUpsert.userErrors);
                } else {
                  console.log(`[Image Extractor] Successfully auto-synced ${extractedImages.length} images for ${payload.handle}`);
                }
              } else {
                console.log(`[Image Extractor] Successfully auto-synced ${extractedImages.length} images for ${payload.handle}`);
              }
            }
          }
        }

      } catch (error) {
        console.error("Error in PAGES_UPDATE webhook:", error);
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Shopify Mandatory Privacy Webhooks
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response(); // Returns 200 OK to Shopify
};
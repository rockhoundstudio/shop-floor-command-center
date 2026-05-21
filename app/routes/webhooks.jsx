import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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

    case "COLLECTIONS_CREATE":
      try {
        // 1. Check if Footer Auto-Sync is turned on in the database
        const footerSetting = await prisma.menuSetting.findUnique({
          where: { menuHandle: "footer" }
        });

        if (footerSetting && footerSetting.autoSync) {
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
            const formatItem = (item) => ({
              title: item.title,
              url: item.url || "#",
              type: "HTTP",
              items: item.items && item.items.length > 0 ? item.items.map(formatItem) : []
            });

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
      } catch (error) {
        console.error("Error in COLLECTIONS_CREATE webhook:", error);
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
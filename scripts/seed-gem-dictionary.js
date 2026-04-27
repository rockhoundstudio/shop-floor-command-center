import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const SHOP = process.env.SHOPIFY_SHOP || 'qda81g-v1.myshopify.com';
const DATABASE_URL = process.env.DATABASE_URL;
const METAOBJECT_TYPE = "gem_dictionary";

if (!DATABASE_URL) {
  console.error("🚨 DATABASE_URL is missing from .env");
  process.exit(1);
}

// Clean product titles to extract the base stone name
function extractStoneName(title) {
  const ignoreWords = /\b(ring|pendant|necklace|bracelet|earrings|cabochon|slab|freeform|rough|raw|tumbled|sphere|tower|point|cluster|geode)\b/gi;
  return title.replace(ignoreWords, "").replace(/[-–—]/g, "").replace(/\s{2,}/g, " ").trim();
}

// Strip HTML from descriptions
function stripHtml(html) {
  return html ? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : "";
}

// Parse description for fallback data
function parseDescription(text) {
  const result = {};
  const originMatch = text.match(/(?:found in|origin[:\s]+|from\s+)([A-Z][a-zA-Z\s,]+)/);
  if (originMatch) result.typical_origins = originMatch[1].trim();
  
  const hardnessMatch = text.match(/(?:mohs|hardness)[\s:]*([\d.-]+)/i);
  if (hardnessMatch) result.mohs_hardness = hardnessMatch[1].trim();

  return result;
}

// 1. Get Access Token from Render PostgreSQL
async function getAccessToken() {
  console.log(`🔍 Connecting to Render PostgreSQL to find token for ${SHOP}...`);
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    // Try Prisma default table name first, fallback to shopify_sessions
    let res;
    try {
      res = await client.query(`SELECT "accessToken" FROM "session" WHERE shop = $1 ORDER BY "updatedAt" DESC LIMIT 1`, [SHOP]);
    } catch (e) {
      res = await client.query(`SELECT "accessToken" FROM shopify_sessions WHERE shop = $1 ORDER BY updated_at DESC LIMIT 1`, [SHOP]);
    }

    if (res.rows.length === 0) {
      console.error(`🚨 No active session found in the DB for shop: ${SHOP}`);
      process.exit(1);
    }

    console.log(`✅ Access token successfully retrieved.`);
    return res.rows[0].accessToken || res.rows[0].access_token;
  } catch (error) {
    console.error("🚨 Database connection error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// 2. Fetch All Products from Shopify
async function fetchAllProducts(token) {
  const endpoint = `https://${SHOP}/admin/api/2024-01/graphql.json`;
  let products = [];
  let hasNextPage = true;
  let cursor = null;

  console.log(`\n📦 Fetching products from ${SHOP}...`);

  while (hasNextPage) {
    const query = `
      query getProducts($cursor: String) {
        products(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          edges {
            node {
              title
              descriptionHtml
              tags
              geologyMetafields: metafields(first: 10, namespace: "geology") {
                edges { node { key value } }
              }
              shopifyMetafields: metafields(first: 10, namespace: "shopify") {
                edges { node { key value } }
              }
            }
          }
        }
      }
    `;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ query, variables: { cursor } })
    });

    const { data, errors } = await response.json();
    if (errors) throw new Error(JSON.stringify(errors));

    const pageInfo = data.products.pageInfo;
    products = products.concat(data.products.edges.map(e => e.node));
    
    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  console.log(`✅ Fetched ${products.length} products.`);
  return products;
}

// 3. Create Metaobject in Shopify
async function createMetaobject(token, gemData) {
  const endpoint = `https://${SHOP}/admin/api/2024-01/graphql.json`;
  
  const fields = Object.entries(gemData).map(([key, value]) => ({
    key,
    value: value ? String(value).trim() : ""
  })).filter(f => f.value !== ""); // Only send fields that have data. Do not fabricate.

  const mutation = `
    mutation CreateGemMetaobject($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { handle }
        userErrors { field message }
      }
    }
  `;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({
      query: mutation,
      variables: {
        metaobject: { type: METAOBJECT_TYPE, capabilities: { publishable: { status: "ACTIVE" } }, fields }
      }
    })
  });

  const { data, errors } = await response.json();
  if (errors) throw new Error(JSON.stringify(errors));
  
  const userErrors = data?.metaobjectCreate?.userErrors || [];
  if (userErrors.length > 0) throw new Error(userErrors.map(e => e.message).join(", "));
  
  return data.metaobjectCreate.metaobject.handle;
}

// Main Execution Flow
(async () => {
  try {
    const token = await getAccessToken();
    const products = await fetchAllProducts(token);
    
    const uniqueGems = new Map();

    console.log(`\n🧠 Extracting and deduplicating gem data...`);

    for (const p of products) {
      const stoneName = extractStoneName(p.title);
      if (!stoneName || stoneName.length < 3) continue;

      // Extract Metafields
      const mf = {};
      const allMetafields = [...(p.geologyMetafields?.edges||[]), ...(p.shopifyMetafields?.edges||[])];
      allMetafields.forEach(({ node }) => {
        mf[node.key] = node.value.replace(/\[|\]|"/g, ""); // Clean GID lists if any
      });

      const parsedDesc = parseDescription(stripHtml(p.descriptionHtml));

      // Build the Gem Object based on strict schema
      const gemEntry = {
        stone_name: stoneName,
        mineral_class: mf['mineral-class'] || mf['mineral_class'] || "",
        crystal_system: mf['crystal-system'] || mf['crystal_system'] || "",
        mohs_hardness: mf['hardness'] || parsedDesc.mohs_hardness || "",
        typical_origins: mf['origin_location'] || mf['where_found'] || parsedDesc.typical_origins || "",
        treatment_notes: "", // Rarely stored in standard product metafields, leaving blank
        story_seed: mf['stone_story'] || ""
      };

      // Deduplicate: If we already have this stone, merge any missing data
      if (uniqueGems.has(stoneName.toLowerCase())) {
        const existing = uniqueGems.get(stoneName.toLowerCase());
        Object.keys(gemEntry).forEach(key => {
          if (!existing[key] && gemEntry[key]) {
            existing[key] = gemEntry[key];
          }
        });
      } else {
        uniqueGems.set(stoneName.toLowerCase(), gemEntry);
      }
    }

    console.log(`✅ Found ${uniqueGems.size} unique stones. Beginning Metaobject creation...\n`);

    let successCount = 0;
    let errorCount = 0;

    for (const [key, gemData] of uniqueGems.entries()) {
      try {
        const handle = await createMetaobject(token, gemData);
        console.log(`✅ Created: ${gemData.stone_name} -> ${handle}`);
        successCount++;
      } catch (e) {
        console.error(`❌ Failed: ${gemData.stone_name} - ${e.message}`);
        errorCount++;
      }
      // Throttle API calls
      await new Promise(res => setTimeout(res, 300));
    }

    console.log(`\n🎉 Process complete. ${successCount} created, ${errorCount} failed.`);

  } catch (err) {
    console.error("\n🚨 FATAL ERROR:", err);
  }
})();
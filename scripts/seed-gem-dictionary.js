import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const SHOP = "qda81g-v1.myshopify.com";
const DB_URL = "postgresql://shop_floor_db_6m6m_user:agFKlV4RhxTFC0L3IVGOhELpXQOmC7ph@dpg-d7hverhkh4rs73amn1q0-a.oregon-postgres.render.com/shop_floor_db_6m6m";
const GRAPHQL_URL = `https://${SHOP}/admin/api/2025-01/graphql.json`;

// 1. The Master Gem Dictionary
const gemDictionary = [
  { name: "Jasper (Yakima)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Yakima Canyon WA", "Oregon"], notes: "Untreated typical.", story: "Shaped by ancient pressure." },
  { name: "Jasper (Picture)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Yakima Canyon WA", "Oregon"], notes: "Untreated typical.", story: "A painting made by the earth." },
  { name: "Jasper (Brecciated)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Yakima River WA", "Oregon"], notes: "Untreated typical.", story: "Broken and reborn." },
  { name: "Agate (Botswana)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Botswana"], notes: "Untreated typical.", story: "Banded by ancient seas." },
  { name: "Agate (Montana)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Yellowstone River MT"], notes: "Untreated typical.", story: "Carried by glacial melt." },
  { name: "Chalcedony (Drusy)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Pacific Northwest"], notes: "Untreated typical.", story: "Crystallized in silence." },
  { name: "Labradorite", class: "Silicates", crystal: "Triclinic", hardness: "6–6.5", origins: ["Madagascar"], notes: "Untreated typical.", story: "The aurora you can hold." },
  { name: "Serpentine", class: "Silicates", crystal: "Monoclinic", hardness: "3–5", origins: ["Pacific Northwest"], notes: "Untreated typical.", story: "Born from the ocean floor." },
  { name: "Obsidian (Fire)", class: "Silicates", crystal: "Amorphous", hardness: "5–5.5", origins: ["Oregon"], notes: "Untreated.", story: "Forged in volcanic fire." },
  { name: "Snow Quartz", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Worldwide"], notes: "Untreated typical.", story: "Clarity in frozen form." },
  { name: "Clear Quartz", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Brazil"], notes: "Untreated typical.", story: "Pure light made solid." },
  { name: "Rose Quartz", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Madagascar"], notes: "Untreated typical.", story: "Soft as dawn." },
  { name: "Smoky Quartz", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Brazil"], notes: "Natural irradiation.", story: "Smoke frozen in crystal." },
  { name: "Amethyst", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Uruguay"], notes: "Can fade in sunlight.", story: "The royal purple of clarity." },
  { name: "Citrine", class: "Silicates", crystal: "Trigonal", hardness: "7", origins: ["Brazil"], notes: "Heat-treated amethyst.", story: "Sunlight crystallized." },
  { name: "Aventurine", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["India"], notes: "Untreated typical.", story: "A thousand tiny mirrors." },
  { name: "Tiger's Eye", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["South Africa"], notes: "Untreated typical.", story: "The eye of the earth." },
  { name: "Carnelian", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["India"], notes: "Often heat treated.", story: "Fire in the hand." },
  { name: "Chrysoprase", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Australia"], notes: "Untreated typical.", story: "Green from nickel." },
  { name: "Bloodstone", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["India"], notes: "Untreated typical.", story: "Green marked by red." },
  { name: "Onyx", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Brazil"], notes: "Often dyed.", story: "Pure black." },
  { name: "Blue Lace Agate", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Namibia"], notes: "Untreated typical.", story: "Sky layered in stone." },
  { name: "Moss Agate", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["India"], notes: "Untreated typical.", story: "A forest inside a stone." },
  { name: "Dendritic Agate", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Brazil"], notes: "Untreated typical.", story: "Winter trees etched." },
  { name: "Moonstone", class: "Silicates", crystal: "Monoclinic", hardness: "6–6.5", origins: ["Sri Lanka"], notes: "Untreated typical.", story: "The moon's light." },
  { name: "Sunstone (Oregon)", class: "Silicates", crystal: "Triclinic", hardness: "6–6.5", origins: ["Plush OR"], notes: "Untreated.", story: "Copper fire." },
  { name: "Amazonite", class: "Silicates", crystal: "Triclinic", hardness: "6–6.5", origins: ["Colorado"], notes: "Untreated typical.", story: "Cool and ancient." },
  { name: "Almandine Garnet", class: "Silicates", crystal: "Cubic", hardness: "7–7.5", origins: ["India"], notes: "Untreated typical.", story: "Deep red." },
  { name: "Pyrope Garnet", class: "Silicates", crystal: "Cubic", hardness: "7–7.5", origins: ["South Africa"], notes: "Untreated typical.", story: "Blood red." },
  { name: "Emerald", class: "Silicates", crystal: "Hexagonal", hardness: "7.5–8", origins: ["Colombia"], notes: "Oiling universal.", story: "The green of life." },
  { name: "Aquamarine", class: "Silicates", crystal: "Hexagonal", hardness: "7.5–8", origins: ["Brazil"], notes: "Heat treatment common.", story: "The sea frozen." },
  { name: "Morganite", class: "Silicates", crystal: "Hexagonal", hardness: "7.5–8", origins: ["Brazil"], notes: "Heat treatment common.", story: "Peach and pink." },
  { name: "Ruby", class: "Oxides", crystal: "Trigonal", hardness: "9", origins: ["Myanmar"], notes: "Heat treatment universal.", story: "The king of gems." },
  { name: "Sapphire (Blue)", class: "Oxides", crystal: "Trigonal", hardness: "9", origins: ["Sri Lanka"], notes: "Heat treatment common.", story: "The blue of deep sky." },
  { name: "Sapphire (Montana)", class: "Oxides", crystal: "Trigonal", hardness: "9", origins: ["Montana"], notes: "Often untreated.", story: "Montana sky in a stone." },
  { name: "Black Tourmaline", class: "Silicates", crystal: "Trigonal", hardness: "7–7.5", origins: ["Brazil"], notes: "Untreated typical.", story: "The grounding stone." },
  { name: "Watermelon Tourmaline", class: "Silicates", crystal: "Trigonal", hardness: "7–7.5", origins: ["Brazil"], notes: "Untreated typical.", story: "Pink and green." },
  { name: "Nephrite Jade", class: "Silicates", crystal: "Monoclinic", hardness: "6–6.5", origins: ["British Columbia"], notes: "Untreated typical.", story: "The toughest stone." },
  { name: "Malachite", class: "Carbonates", crystal: "Monoclinic", hardness: "3.5–4", origins: ["Congo"], notes: "Toxic dust.", story: "Banded green copper." },
  { name: "Turquoise", class: "Phosphates", crystal: "Triclinic", hardness: "5–6", origins: ["Arizona"], notes: "Stabilization common.", story: "Sky stone of the desert." },
  { name: "Pyrite", class: "Sulfides", crystal: "Cubic", hardness: "6–6.5", origins: ["Spain"], notes: "Untreated.", story: "Fool's gold." },
  { name: "Petrified Wood (PNW)", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Washington"], notes: "Untreated.", story: "A forest turned to stone." },
  { name: "Thunderegg", class: "Silicates", crystal: "Trigonal", hardness: "6.5–7", origins: ["Oregon"], notes: "Untreated.", story: "Oregon's state rock." }
];

const CREATE_METAOBJECT_MUTATION = `
  mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
    metaobjectCreate(metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  console.log(`\n?? Searching database for access token belonging to ${SHOP}...`);

  const client = new Client({
    connectionString: DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  let token = null;

  try {
    // Try Prisma's 'Session' table first, then fallback to 'sessions'
    let res;
    try {
      res = await client.query(`SELECT * FROM "Session" WHERE shop = $1 LIMIT 1`, [SHOP]);
    } catch (e) {
      res = await client.query(`SELECT * FROM sessions WHERE shop = $1 LIMIT 1`, [SHOP]);
    }

    if (res && res.rows.length > 0) {
      token = res.rows[0].accessToken || res.rows[0].access_token;
    }
  } catch (err) {
    console.error("?? Database query failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }

  if (!token) {
    console.error(`?? No access token found in the database for ${SHOP}. Ensure the app is installed on the store!`);
    process.exit(1);
  }

  console.log("?? Token acquired successfully! Starting injection...\n");

  for (const gem of gemDictionary) {
    const variables = {
      metaobject: {
        type: "gem_dictionary",
        fields: [
          { key: "stone_name", value: gem.name },
          { key: "mineral_class", value: gem.class },
          { key: "crystal_system", value: gem.crystal },
          { key: "mohs_hardness", value: gem.hardness },
          { key: "typical_origins", value: JSON.stringify(gem.origins) },
          { key: "treatment_notes", value: gem.notes },
          { key: "story_seed", value: gem.story }
        ]
      }
    };

    try {
      const response = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token
        },
        body: JSON.stringify({ query: CREATE_METAOBJECT_MUTATION, variables })
      });

      const result = await response.json();
      
      if (result.errors) {
        console.error(`? Network error for ${gem.name}:`, result.errors[0].message);
      } else if (result.data?.metaobjectCreate?.userErrors?.length > 0) {
        console.error(`?? Shopify rejected ${gem.name}:`, result.data.metaobjectCreate.userErrors[0].message);
      } else {
        console.log(`? Injected: ${gem.name}`);
      }
      
    } catch (error) {
      console.error(`?? Crash on ${gem.name}:`, error.message);
    }

    await delay(300);
  }
  
  console.log("\n?? Vault seeding complete! Your AI Scanner is fully loaded.");
}

run();

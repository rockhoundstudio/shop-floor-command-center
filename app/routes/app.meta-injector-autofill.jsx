import { data } from "react-router";
import { authenticate } from "../shopify.server";
import { lookupStone } from "../utils/geoLibrary";
import { TARGET_KEYS } from "../utils/metaScan";

const MINDAT_API_KEY = process.env.MINDAT_API_KEY;

const MINDAT_KEY_MAP = {
  official_name: "name",
  mineral_class: "mindat_formula",
  crystal_structure: "crystal_system",
  luster: "luster",
  specific_gravity: "density",
  moh_hardness: "hardness",
  cleavage: "cleavage",
  fracture_pattern: "fracture",
  diaphaneity: "transparency",
  tenacity: "tenacity",
  origin_location: "localities_count",
};

async function fetchMindat(title) {
  if (!MINDAT_API_KEY) return null;
  try {
    const search = await fetch(
      `https://api.mindat.org/minerals/?name=${encodeURIComponent(title)}&format=json`,
      { headers: { Authorization: `Token ${MINDAT_API_KEY}` } }
    );
    if (!search.ok) return null;
    const json = await search.json();
    const results = json?.results;
    if (!results || results.length === 0) return null;
    return results[0];
  } catch {
    return null;
  }
}

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const body = await request.formData();
  const title = body.get("title") || "";
  const description = body.get("description") || "";
  const existingMeta = JSON.parse(body.get("existingMeta") || "{}");

  const libData = lookupStone(title);
  const mindatData = await fetchMindat(title);

  const merged = { ...existingMeta };

  // Pass 1 — fill from geoLibrary
  if (libData) {
    TARGET_KEYS.forEach(key => {
      if (!merged[key] || merged[key].trim() === "") {
        if (libData[key]) merged[key] = libData[key];
      }
    });
  }

  // Pass 2 — fill gaps from Mindat
  if (mindatData) {
    Object.entries(MINDAT_KEY_MAP).forEach(([ourKey, mindatKey]) => {
      if (!merged[ourKey] || merged[ourKey].trim() === "") {
        const val = mindatData[mindatKey];
        if (val !== undefined && val !== null && String(val).trim() !== "") {
          merged[ourKey] = String(val);
        }
      }
    });
  }

  if (!merged.official_name) merged.official_name = title;
  if (!merged.stone_story && description) merged.stone_story = description;

  return data({ merged });
};

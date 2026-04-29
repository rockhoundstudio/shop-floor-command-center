import { data } from "react-router";
import { authenticate } from "../shopify.server";
import geoLibrary from "../utils/geoLibrary";
import { TARGET_KEYS } from "../utils/metaScan";

export const action = async ({ request }) => {
  await authenticate.admin(request);
  const body = await request.formData();
  const title = body.get("title") || "";
  const description = body.get("description") || "";
  const existingMeta = JSON.parse(body.get("existingMeta") || "{}");

  const titleLower = title.toLowerCase();
  const match = Object.keys(geoLibrary).find(key =>
    titleLower.includes(key.toLowerCase())
  );

  if (!match) return data({ merged: null });

  const libData = geoLibrary[match];
  const merged = { ...existingMeta };

  TARGET_KEYS.forEach(key => {
    if (!merged[key] || merged[key].trim() === "") {
      if (libData[key]) merged[key] = libData[key];
    }
  });

  if (!merged.official_name) merged.official_name = title;
  if (!merged.stone_story && description) merged.stone_story = description;

  return data({ merged });
};

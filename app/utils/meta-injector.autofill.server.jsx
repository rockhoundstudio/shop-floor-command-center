import {
  DROPDOWN_OPTIONS,
  REMOVED_PARKED_CANONICAL_IDENTITIES,
  REMOVED_PARKED_DESTINATIONS,
  REMOVED_PARKED_CUSTOM_INPUT_ALIASES
} from "../utils/meta-injector.constants.jsx";
import {
  ALLOWED_VISION_CANDIDATE_KEYS as ALLOWED_STANDARDIZED_CANDIDATE_KEYS,
  isGenericBareStoneProposal,
  isSettingOrHardwareMediumValue,
  classifyFoundObjectPolarity,
  hasRiverOrFieldCollectionClaim,
  buildSafePurchasedSeoTitle
} from "./meta-injector.standardized.jsx";
import {
  INVALID_CANDIDATE_FILLERS,
  CLASSIFICATION_OVERRIDE_KEYS,
  PASSIVE_CONSTRUCTION_REVIEW_KEYS,
  PASSIVE_PROVENANCE_AND_SEO_KEYS,
  STONE_IDENTITY_KEYS,
  normalizeTitleMojibakeEmDashes,
  splitSegmentedTitle,
  extractStoneName,
  resolvePicklistStoneFamily,
  resolveEvidencedOriginLocation,
  resolveOriginHandle,
  resolveCollectionData,
  resolveCanonicalOoakFromInputs,
  parseIdentityAndOriginInputs,
  buildGeoLookupCandidates,
  resolveVerifiedStoneIdentityContext,
  resolveTab3FieldProvenance,
  parseVerifiedColorPatternChoiceLabels,
  validateStandardizedCandidates,
  sanitizeObject,
  formatDyslexiaText,
  cleanStoneFamilyShape,
  mapCollectionLocation,
  getDerivedMaterial,
  parseValidPhotoSolidLengthInches,
  buildBenchV2ProducerProposals
} from "./meta-injector.autofill-inputs.server.jsx";
import {
  getSharedFactualContract,
  buildDescriptionPrompt,
  buildMasterVisionPrompt,
  buildTab3VisionPrompt
} from "./meta-injector.prompts.server.jsx";

function stripRetiredParkedProducerEntries(obj, defaultOwner = "PRODUCT") {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
  for (const key of Object.keys(obj)) {
    const trimmed = String(key || "").trim();
    if (!trimmed) continue;
    if (
      REMOVED_PARKED_CANONICAL_IDENTITIES.has(trimmed) ||
      REMOVED_PARKED_CANONICAL_IDENTITIES.has(`${defaultOwner}:${trimmed}`) ||
      REMOVED_PARKED_DESTINATIONS.has(trimmed) ||
      (defaultOwner === "PRODUCT" && REMOVED_PARKED_CUSTOM_INPUT_ALIASES.has(trimmed))
    ) {
      delete obj[key];
    }
  }
  return obj;
}

// 🟢 AI Engine — No Prisma Import Here

const stoneProfileCache = new Map();
let dbPool = null;

async function queryPostgres(sql, params) {
  if (!dbPool) {
    const { default: pg } = await import('pg');
    dbPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 15
    });
  }
  try {
    const result = await dbPool.query(sql, params);
    return result.rows;
  } catch (err) {
    console.error("[Postgres Pool Error]:", err);
    throw err;
  }
}

async function saveToStoneCache(stoneName, geoResult) {
  try {
    const existing = await queryPostgres(
      'SELECT id FROM "StoneCache" WHERE "stone_name" = $1 LIMIT 1',
      [stoneName]
    );
    if (existing.length === 0) {
      await queryPostgres(
        'INSERT INTO "StoneCache" ("id", "stone_name", "data", "created_at", "updated_at") VALUES (gen_random_uuid()::text, $1, $2, NOW(), NOW())',
        [stoneName, JSON.stringify(geoResult)]
      );
    }
  } catch (err) {
    console.error("[StoneCache] Save failed for:", stoneName, err);
  }
}

const MINDAT_API_KEY = process.env.MINDAT_API_KEY;

async function fetchWithRetry(url, options, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60000);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(id);
      if (res.status !== 503 && res.status !== 429 && res.status !== 500) return res;
    } catch (err) {
      clearTimeout(id);
    }
    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
    }
  }
  throw new Error("Gemini API connection timed out.");
}

async function getLiveStoreDirectory(admin) {
  let pagesList = [];
  let collectionsList = [];
  try {
    let hasNextPage = true;
    let endCursor = null;

    // Fetch Published Pages Only
    while (hasNextPage) {
      const pagesQuery = `
        query getPublishedPages($cursor: String) {
          pages(first: 250, query: "published_status:published", after: $cursor) {
            edges { node { title handle body } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;
      const pagesRes = await admin.graphql(pagesQuery, endCursor ? { variables: { cursor: endCursor } } : {});
      const pagesData = await pagesRes.json();

      if (pagesData.data?.pages?.edges) {
        pagesList = pagesList.concat(pagesData.data.pages.edges.map(e => {
          const rawBody = (e.node.body || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
          return {
            title: e.node.title,
            url: `/pages/${e.node.handle}`,
            handle: e.node.handle,
            excerpt: rawBody.slice(0, 10000),
            rawExcerptLength: rawBody.length
          };
        }));
      }
      hasNextPage = pagesData.data?.pages?.pageInfo?.hasNextPage;
      endCursor = pagesData.data?.pages?.pageInfo?.endCursor;
    }

    hasNextPage = true;
    endCursor = null;

    // Fetch Published Collections Only
    while (hasNextPage) {
      const collectionsQuery = `
        query getPublishedCollections($cursor: String) {
          collections(first: 250, query: "published_status:published", after: $cursor) {
            edges { node { title handle description } }
            pageInfo { hasNextPage endCursor }
          }
        }
      `;
      const colRes = await admin.graphql(collectionsQuery, endCursor ? { variables: { cursor: endCursor } } : {});
      const colData = await colRes.json();

      if (colData.data?.collections?.edges) {
        collectionsList = collectionsList.concat(collectionsDataEdgesMap(colData.data.collections.edges));
      }
      hasNextPage = colData.data?.collections?.pageInfo?.hasNextPage;
      endCursor = colData.data?.collections?.pageInfo?.endCursor;
    }

  } catch (err) {
    console.error("Failed to fetch store inventory:", err);
  }
  return { pagesList, collectionsList };
}

function collectionsDataEdgesMap(edges) {
  return edges.map(e => {
    const rawDesc = (e.node.description || "").replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
    return {
      title: e.node.title,
      url: `/collections/${e.node.handle}`,
      handle: e.node.handle,
      excerpt: rawDesc.slice(0, 5000),
      rawExcerptLength: rawDesc.length
    };
  });
}

async function getGeoData(admin, stoneFamily) {
  const emptyGeo = {
    mohs_hardness: "",
    luster: "",
    fracture_pattern: "",
    cleavage: "",
    specific_gravity: "",
    diaphaneity: "",
    tenacity: "",
    crystal_system: "",
    geological_era: "",
    mineral_class: "",
    rock_composition: "",
    rock_formation: "",
    geological_age: "",
    geoSource: "none"
  };

  if (!admin) return emptyGeo;

  const rawCandidates = Array.isArray(stoneFamily) ? stoneFamily : [stoneFamily];
  const fullCandidates = [];
  const seenFullLower = new Set();

  for (const rawItem of rawCandidates) {
    if (typeof rawItem !== "string") continue;
    const cleaned = cleanStoneFamilyShape(rawItem.trim());
    if (
      !cleaned ||
      cleaned.toLowerCase() === "unknown" ||
      cleaned.toLowerCase() === "unknown stone" ||
      isSettingOrHardwareMediumValue(cleaned)
    ) {
      continue;
    }
    const lower = cleaned.toLowerCase();
    if (!seenFullLower.has(lower)) {
      seenFullLower.add(lower);
      fullCandidates.push(cleaned);
    }
  }

  if (fullCandidates.length === 0) return emptyGeo;

  const primaryStoneCandidate = fullCandidates[0];
  const cleanStoneName = extractStoneName(primaryStoneCandidate);
  if (
    (!primaryStoneCandidate || primaryStoneCandidate.toLowerCase() === "unknown") &&
    (!cleanStoneName || cleanStoneName === "Unknown")
  ) {
    return emptyGeo;
  }

  try {
    const { lookupStone } = await import("../utils/geoLibrary.jsx");
    let localResult = null;
    for (const candidate of fullCandidates) {
      localResult = lookupStone(candidate);
      if (localResult && Object.keys(localResult).length > 0) {
        break;
      }
    }
    if (!localResult && cleanStoneName && cleanStoneName !== "Unknown") {
      localResult = lookupStone(cleanStoneName);
    }
    if (localResult && Object.keys(localResult).length > 0) {
      return {
        mohs_hardness: localResult.moh_hardness || localResult.hardness || "",
        luster: localResult.luster || "",
        fracture_pattern: localResult.fracture_pattern || localResult.fracture || "",
        cleavage: localResult.cleavage || "",
        specific_gravity: localResult.specific_gravity || "",
        diaphaneity: localResult.diaphaneity || "",
        tenacity: localResult.tenacity || "",
        crystal_system: localResult.crystal_system || "",
        geological_era: localResult.geological_era || "",
        mineral_class: localResult.mineral_class || "",
        rock_composition: localResult.rock_composition || "",
        rock_formation: localResult.rock_formation || "",
        geological_age: localResult.geological_age || "",
        geoSource: "library"
      };
    }
  } catch (err) {}

  const search = (cleanStoneName && cleanStoneName !== "Unknown" ? cleanStoneName : primaryStoneCandidate).toLowerCase().trim();

  const CANONICAL_GEO_FIELD_KEYS = [
    "mohs_hardness",
    "luster",
    "fracture_pattern",
    "cleavage",
    "specific_gravity",
    "diaphaneity",
    "tenacity",
    "crystal_system",
    "geological_era",
    "mineral_class",
    "rock_composition",
    "rock_formation",
    "geological_age"
  ];

  const CANONICAL_GEO_KEY_MAP = {
    mohs_hardness: "mohs_hardness",
    moh_hardness: "mohs_hardness",
    hardness: "mohs_hardness",
    luster: "luster",
    fracture_pattern: "fracture_pattern",
    fracture: "fracture_pattern",
    cleavage: "cleavage",
    specific_gravity: "specific_gravity",
    diaphaneity: "diaphaneity",
    tenacity: "tenacity",
    crystal_system: "crystal_system",
    geological_era: "geological_era",
    mineral_class: "mineral_class",
    rock_composition: "rock_composition",
    rock_formation: "rock_formation",
    geological_age: "geological_age"
  };

  const cleanGeoDisplayString = (rawVal, canonicalKey) => {
    if (typeof rawVal !== "string") return "";
    const strippedMarkup = rawVal.replace(/<\/?[A-Za-z][A-Za-z0-9:_-]*(?:\s+[^<>]*)?>/g, "").trim();
    if (!strippedMarkup) return "";
    if (canonicalKey === "cleavage" && /^none$/i.test(strippedMarkup)) {
      return "None";
    }
    if (INVALID_CANDIDATE_FILLERS.has(strippedMarkup.toLowerCase())) {
      return "";
    }
    return strippedMarkup;
  };

  const normalizeStoneCacheObject = (rawParsed) => {
    if (!rawParsed || typeof rawParsed !== "object" || Array.isArray(rawParsed)) {
      return { normalized: null, hasUsableGeoField: false };
    }
    const normalized = {};
    let hasUsableGeoField = false;

    for (const [rawKey, rawVal] of Object.entries(rawParsed)) {
      if (rawKey === "geoSource") continue;
      const strippedKey = rawKey.startsWith("geo.") ? rawKey.slice(4) : rawKey;
      const canonicalKey = CANONICAL_GEO_KEY_MAP[strippedKey];

      if (canonicalKey) {
        const cleanedVal = cleanGeoDisplayString(rawVal, canonicalKey);
        if (cleanedVal) {
          if (!normalized[canonicalKey] || rawKey === canonicalKey || rawKey === `geo.${canonicalKey}`) {
            normalized[canonicalKey] = cleanedVal;
          }
          hasUsableGeoField = true;
        }
      } else if (!rawKey.startsWith("geo.")) {
        normalized[rawKey] = rawVal;
      }
    }

    return { normalized, hasUsableGeoField };
  };

  const loadStoneProfileForName = async (stoneNameLower) => {
    if (!stoneNameLower) return null;
    if (stoneProfileCache.has(stoneNameLower)) {
      return stoneProfileCache.get(stoneNameLower) || null;
    }
    const rows = await queryPostgres(
      'SELECT * FROM "StoneProfile" WHERE LOWER("stone_name") = $1 LIMIT 1',
      [stoneNameLower]
    );
    if (rows.length > 0) {
      const s = rows[0];
      const geoResult = {
        mohs_hardness: cleanGeoDisplayString(s.hardness || s.mohs_hardness || "", "mohs_hardness"),
        luster: cleanGeoDisplayString(s.luster || "", "luster"),
        fracture_pattern: cleanGeoDisplayString(s.fracture || s.fracture_pattern || "", "fracture_pattern"),
        cleavage: cleanGeoDisplayString(s.cleavage || "", "cleavage"),
        specific_gravity: cleanGeoDisplayString(s.specific_gravity || "", "specific_gravity"),
        diaphaneity: cleanGeoDisplayString(s.diaphaneity || "", "diaphaneity"),
        tenacity: "",
        crystal_system: cleanGeoDisplayString(s.crystal_system || "", "crystal_system"),
        geological_era: cleanGeoDisplayString(s.geological_era || "", "geological_era"),
        mineral_class: cleanGeoDisplayString(s.mineral_class || "", "mineral_class"),
        rock_composition: cleanGeoDisplayString(s.rock_composition || "", "rock_composition"),
        rock_formation: cleanGeoDisplayString(s.rock_formation || "", "rock_formation"),
        geological_age: "",
        geoSource: "database"
      };
      stoneProfileCache.set(stoneNameLower, geoResult);
      return geoResult;
    }
    return null;
  };

  try {
    const cacheCandidateOrder = [];
    const seenCacheLower = new Set();
    for (const candidate of fullCandidates) {
      const candidateLower = candidate.toLowerCase().trim();
      if (candidateLower && !seenCacheLower.has(candidateLower)) {
        seenCacheLower.add(candidateLower);
        cacheCandidateOrder.push(candidateLower);
      }
    }
    if (search && !seenCacheLower.has(search)) {
      seenCacheLower.add(search);
      cacheCandidateOrder.push(search);
    }

    let matchedCacheNameLower = "";
    let matchedNormalizedCache = null;

    for (const candidateLower of cacheCandidateOrder) {
      const cacheRows = await queryPostgres(
        'SELECT data FROM "StoneCache" WHERE LOWER("stone_name") = $1 LIMIT 1',
        [candidateLower]
      );
      if (cacheRows.length > 0 && cacheRows[0].data) {
        const parsed =
          typeof cacheRows[0].data === "string"
            ? JSON.parse(cacheRows[0].data)
            : cacheRows[0].data;
        const { normalized, hasUsableGeoField } = normalizeStoneCacheObject(parsed);
        if (hasUsableGeoField && normalized) {
          matchedCacheNameLower = candidateLower;
          matchedNormalizedCache = normalized;
          break;
        }
      }
    }

    if (matchedNormalizedCache) {
      const hasMissingCanonicalField = CANONICAL_GEO_FIELD_KEYS.some(
        (k) => !matchedNormalizedCache[k]
      );
      let matchingProfileGeo = null;
      if (hasMissingCanonicalField && matchedCacheNameLower) {
        try {
          matchingProfileGeo = await loadStoneProfileForName(matchedCacheNameLower);
        } catch (profileErr) {}
      }

      const mergedCacheResult = {
        ...emptyGeo,
        ...(matchingProfileGeo || {}),
        ...matchedNormalizedCache,
        tenacity: matchedNormalizedCache.tenacity || matchingProfileGeo?.tenacity || "",
        geological_age: matchedNormalizedCache.geological_age || matchingProfileGeo?.geological_age || "",
        geoSource: "cache"
      };
      return mergedCacheResult;
    }
  } catch (err) {}

  try {
    const profileCandidateOrder = [];
    const seenProfileLower = new Set();
    for (const candidate of fullCandidates) {
      const candidateLower = candidate.toLowerCase().trim();
      if (candidateLower && !seenProfileLower.has(candidateLower)) {
        seenProfileLower.add(candidateLower);
        profileCandidateOrder.push(candidateLower);
      }
    }
    if (search && !seenProfileLower.has(search)) {
      seenProfileLower.add(search);
      profileCandidateOrder.push(search);
    }

    for (const candidateLower of profileCandidateOrder) {
      const profileGeo = await loadStoneProfileForName(candidateLower);
      if (profileGeo) {
        return {
          ...emptyGeo,
          ...profileGeo,
          tenacity: profileGeo.tenacity || "",
          geological_age: profileGeo.geological_age || "",
          geoSource: "database"
        };
      }
    }
  } catch (err) {}

  try {
    if (MINDAT_API_KEY && cleanStoneName && cleanStoneName !== "Unknown") {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 60000);
      const mindatRes = await fetch(`https://api.mindat.org/minerals/?name=${encodeURIComponent(cleanStoneName)}&format=json`, { headers: { Authorization: `Token ${MINDAT_API_KEY}` }, signal: controller.signal });
      clearTimeout(id);
      const mindatData = await mindatRes.json();
      const mineral = mindatData?.results?.[0];
      if (mineral) {
        const geoResult = {
          mohs_hardness: mineral.hardness || "",
          luster: mineral.luster || "",
          fracture_pattern: mineral.fracture || "",
          cleavage: mineral.cleavage || "",
          specific_gravity: mineral.density || "",
          diaphaneity: mineral.transparency || "",
          tenacity: "",
          crystal_system: mineral.crystal_system || "",
          geological_era: "",
          mineral_class: mineral.mineral_class || "",
          rock_composition: "",
          rock_formation: "",
          geological_age: "",
          geoSource: "mindat"
        };
        stoneProfileCache.set(search, geoResult);
        await saveToStoneCache(search, geoResult);
        return geoResult;
      }
    }
  } catch (err) {}

  return emptyGeo;
}

export async function executeAutofill(intent, body, admin) {
  let activeRequestId = null;
  try {
    const rawReqId = body?.get?.("requestId");
    activeRequestId =
      typeof rawReqId === "string" && rawReqId.trim() !== "" ? rawReqId.trim() : null;

    if (intent === "geoLookup") {
      const stoneFamily = body.get("stoneFamily") || "";
      const geoFields = await getGeoData(admin, stoneFamily);
      return Response.json({ success: true, intent: "geoLookup", geoFields: sanitizeObject(geoFields) });
    }

    if (intent === "titleParse") {
      const pieceNameInput = normalizeTitleMojibakeEmDashes(body.get("pieceName") || "");
      const segments = splitSegmentedTitle(pieceNameInput);

      if (segments.length < 3) {
        return Response.json({
          success: false,
          intent: "titleParse",
          pieceId: body.get("pieceId"),
          error: "Title parse requires a 3-segment title (Stone Family — Origin — Piece Name). Standalone human identifiers are preserved as piece_name."
        }, { status: 400 });
      }

      const provenance = resolveTab3FieldProvenance(body);
      const explicitOriginLocation = (body.get("origin_location") || "").trim();
      const explicitCollectionName = (body.get("collection_name") || body.get("collectionName") || "").trim();
      const rawFoundObject = body.get("found_object") ?? body.get("custom.found_object");
      const foundPolarity = classifyFoundObjectPolarity(rawFoundObject);
      const isPurchasedProvenance = foundPolarity === "purchased";
      const isOriginLocked = provenance.hasValidProvenance && provenance.operatorLockedSet.has("origin_location") && Boolean(explicitOriginLocation);

      const rawSegment1Stone = cleanStoneFamilyShape(segments[0] || "");
      const segment1 = resolvePicklistStoneFamily(segments[0] || "");
      const segment2 = isOriginLocked
        ? explicitOriginLocation
        : isPurchasedProvenance
          ? (explicitOriginLocation ? resolveEvidencedOriginLocation(explicitOriginLocation) : "")
          : resolveEvidencedOriginLocation(explicitOriginLocation || segments[1] || "");
      const segment3 = segments[segments.length - 1] || "";

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const resolvedHandle = isPurchasedProvenance
        ? resolveOriginHandle(segment2, pagesList, (body.get("origin_handle") || body.get("origin_page_handle") || "").trim())
        : resolveOriginHandle(segment2, pagesList);
      const collectionData = resolveCollectionData(
        isPurchasedProvenance ? "" : segment2,
        resolvedHandle,
        collectionsList,
        explicitCollectionName
      );

      const matchedPage = resolvedHandle ? pagesList.find(p => p.handle === resolvedHandle || p.url.includes(resolvedHandle)) : null;
      const extractedStory = matchedPage ? matchedPage.excerpt : "";

      const validFamilies = (DROPDOWN_OPTIONS?.stone_family || []).map(o => typeof o === "object" ? (o.value || o.label) : o);
      const provenanceInstruction = isPurchasedProvenance
        ? `2. Purchased Provenance Authority: This piece was purchased (found_object="${String(rawFoundObject).trim()}"). Do NOT infer field/river collection from the title segment "${segments[1] || ""}" or collection membership. Set 'origin_location' to "${segment2}" (leave "" if empty). Never write "Found at..." or river-collected claims in 'seo_title'. Purchase source does not establish geological origin.`
        : `2. Origin ("${segment2}") is the AUTHORITY. Set 'origin_location' to the clean geographic name. Match 'collection_name' and 'collection_location' to the live store entry when evidenced; do not invent collection names or handles.`;

      const promptText = `
${getSharedFactualContract()}

Analyze these segments:
- Family: "${segment1}"
- Origin: "${segment2}"
- Human Identifier (preserve exact, do not alter): "${segment3}"
${rawFoundObject !== null && rawFoundObject !== undefined && String(rawFoundObject).trim() !== "" ? `- Found Object: "${String(rawFoundObject).trim()}"` : ""}

LIVE STORE DIRECTORY:
PAGES: ${pagesList.map(p => p.handle).join(", ")}
COLLECTIONS: ${collectionsList.map(c => c.handle).join(", ")}

INSTRUCTIONS:
1. Keep title parsing focused on identity. SEO must use supported facts and must not compete with later factual SEO generation.
${provenanceInstruction}
3. 'stone_family' must match an entry from the supported list: ${validFamilies.join(", ")}. Do not force unsupported titles into guessed minerals.
4. Never alter or replace 'piece_name'; it must remain "${segment3}".

Return JSON with EXACT keys: stone_family, piece_name, origin_handle, origin_location, collection_name, collection_location, seo_title.
      `.trim();

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        let parsed;
        try {
          parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        } catch (parseErr) {
          return Response.json({ success: false, intent: "titleParse", pieceId: body.get("pieceId"), error: "Invalid JSON from titleParse model." }, { status: 500 });
        }

        const verifiedFamily = resolvePicklistStoneFamily(parsed.stone_family || segment1) || segment1;
        const dbGeoData = await getGeoData(
          admin,
          [rawSegment1Stone, verifiedFamily].filter(Boolean)
        );
        const correctedOriginLoc = isOriginLocked
          ? explicitOriginLocation
          : isPurchasedProvenance
            ? segment2
            : resolveEvidencedOriginLocation(segment2 || parsed.origin_location);
        const finalCollectionName = collectionData.name || (!isPurchasedProvenance && collectionsList.some(c => c.title === parsed.collection_name) ? parsed.collection_name : "");

        const explicitOoak = resolveCanonicalOoakFromInputs(Object.fromEntries(body.entries()));

        let resolvedSeoTitle = typeof parsed.seo_title === "string" ? parsed.seo_title.trim() : "";
        if (isPurchasedProvenance) {
          if (!resolvedSeoTitle || hasRiverOrFieldCollectionClaim(resolvedSeoTitle)) {
            resolvedSeoTitle = buildSafePurchasedSeoTitle(verifiedFamily);
          }
        } else if (!resolvedSeoTitle) {
          resolvedSeoTitle = verifiedFamily && correctedOriginLoc
            ? `${verifiedFamily} — Found at ${correctedOriginLoc} — Rockhound Studio`
            : "";
        }

        const finalParse = sanitizeObject({
          ...parsed,
          stone_family: verifiedFamily,
          piece_name: segment3,
          origin_handle: resolvedHandle,
          ...(resolvedHandle ? { origin_page_handle: resolvedHandle } : {}),
          origin_story: extractedStory,
          origin_location: correctedOriginLoc,
          collection_name: finalCollectionName,
          collection_location: isPurchasedProvenance
            ? (correctedOriginLoc ? mapCollectionLocation(correctedOriginLoc) : "")
            : mapCollectionLocation(finalCollectionName || correctedOriginLoc),
          canonical_title: [verifiedFamily, correctedOriginLoc, segment3].filter(Boolean).join(" — "),
          seo_title: resolvedSeoTitle,
          ...(rawFoundObject !== null && rawFoundObject !== undefined && String(rawFoundObject).trim() !== ""
            ? { found_object: String(rawFoundObject).trim() }
            : {}),
          ...dbGeoData,
          ...(explicitOoak.value ? { is_one_of_a_kind: explicitOoak.value } : {}),
          target_gender: "Unisex",
          google_product_category: "Apparel & Accessories > Jewelry"
        });
        delete finalParse.is_ooak;
        delete finalParse.rarity;
        delete finalParse.authenticity;
        delete finalParse.age_group;
        delete finalParse.condition;
        delete finalParse.verified_color_pattern_choices;
        stripRetiredParkedProducerEntries(finalParse, "PRODUCT");

        return Response.json({ success: true, intent: "titleParse", pieceId: body.get("pieceId"), titleParse: finalParse });
      }
      return Response.json({ success: false, intent: "titleParse", pieceId: body.get("pieceId"), error: `Title parse error: ${geminiRes.status}` }, { status: 500 });
    }

    if (intent === "visionScan" || intent === "fullRescan" || intent === "tab2AutoFill") {
      const pieceId = body.get("pieceId") || body.get("productId") || "NEW";
      const provenance = resolveTab3FieldProvenance(body);
      const idOrigin = parseIdentityAndOriginInputs(body, provenance);
      const parsedVerifiedColorChoices = parseVerifiedColorPatternChoiceLabels(
        body.get("verified_color_pattern_choices")
      );
      const validVerifiedColorPatternChoices =
        parsedVerifiedColorChoices.supplied &&
        parsedVerifiedColorChoices.valid &&
        parsedVerifiedColorChoices.labels.length > 0
          ? parsedVerifiedColorChoices.labels
          : null;

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(idOrigin.originSegment, pagesList, idOrigin.explicitOriginHandle);
      const defaultCollection = resolveCollectionData(
        idOrigin.isPurchasedProvenance ? "" : idOrigin.originSegment,
        defaultOriginSlug,
        collectionsList,
        idOrigin.explicitCollectionName
      );

      const matchedPage = defaultOriginSlug
        ? pagesList.find(p => p.handle === defaultOriginSlug || p.url.includes(defaultOriginSlug))
        : null;

      let extractedStory = matchedPage && matchedPage.excerpt ? matchedPage.excerpt : "";
      if (!extractedStory) {
        extractedStory = (body.get("origin_story") || "").trim();
      }

      const rawInputFacts = Object.fromEntries(
        Array.from(body.entries())
          .filter(([key, value]) => value && typeof value === "string" && value.trim() !== "" && !["intent", "pieceId", "productId", "productTitle", "pieceName", "imageBase64", "imageMimeType", "imageUrl", "mediaInputs", "operator_locked_fields", "passive_stored_fields", "verified_color_pattern_choices"].includes(key))
          .map(([k, v]) => [k, v.trim()])
      );
      stripRetiredParkedProducerEntries(rawInputFacts, "PRODUCT");

      const stoneIdentityContext = resolveVerifiedStoneIdentityContext(rawInputFacts, idOrigin.derivedFamily);
      const effectiveStoneFamilyForScan = stoneIdentityContext.effectiveFamily || idOrigin.derivedFamily || "";
      const geoLookupCandidates = buildGeoLookupCandidates({
        idOrigin,
        stoneIdentityContext,
        currentData: rawInputFacts,
        provenance
      });
      const geoFields = await getGeoData(
        admin,
        geoLookupCandidates.length > 0 ? geoLookupCandidates : effectiveStoneFamilyForScan
      );

      let imageBase64 = (body.get("imageBase64") || "").trim();
      let imageMimeType = body.get("imageMimeType") || "image/jpeg";
      if (imageBase64.includes(",")) {
        imageBase64 = imageBase64.slice(imageBase64.indexOf(",") + 1);
      }
      if (!imageBase64 && body.get("imageUrl")) {
        const imageRes = await fetch(body.get("imageUrl"));
        if (!imageRes.ok) {
          return Response.json({ success: false, intent, pieceId, error: `Failed to fetch image (${imageRes.status})` }, { status: 400 });
        }
        imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
      }
      if (!imageBase64) {
        return Response.json({ success: false, intent, pieceId, error: "No image data supplied for Vision scan." }, { status: 400 });
      }

      const currentInputFacts = { ...rawInputFacts };
      for (const sKey of STONE_IDENTITY_KEYS) {
        if (currentInputFacts[sKey] !== undefined && isSettingOrHardwareMediumValue(currentInputFacts[sKey])) {
          delete currentInputFacts[sKey];
        }
      }
      if (effectiveStoneFamilyForScan && !currentInputFacts.stone_family) {
        currentInputFacts.stone_family = effectiveStoneFamilyForScan;
      }
      if (stoneIdentityContext.effectiveMaterial && !currentInputFacts.material) {
        currentInputFacts.material = stoneIdentityContext.effectiveMaterial;
      }
      if (stoneIdentityContext.effectivePrimaryMedium && !currentInputFacts.primary_medium) {
        currentInputFacts.primary_medium = stoneIdentityContext.effectivePrimaryMedium;
      }

      const matchedCollectionObj = defaultCollection.slug
        ? collectionsList.find(c => c.handle === defaultCollection.slug)
        : null;

      const promptText = buildMasterVisionPrompt({
        pagesMenu: pagesList.map(p => `- Title: "${p.title}" | Handle: ${p.handle}`).join("\n"),
        collectionsMenu: collectionsList.map(c => `- Title: "${c.title}" | Handle: ${c.handle}`).join("\n"),
        stoneFamily: effectiveStoneFamilyForScan || "Unspecified Stone",
        derivedShape: idOrigin.derivedShape,
        originStory: extractedStory,
        collectionStory: matchedCollectionObj?.excerpt || "",
        originSegment: idOrigin.originSegment || "Unspecified Origin",
        targetUrlPath: defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "",
        fullCollectionTitle: defaultCollection.name,
        collectionUrlPath: defaultCollection.slug ? `/collections/${defaultCollection.slug}` : "",
        pagesList,
        operatorFacts: currentInputFacts,
        verifiedColorPatternChoices: validVerifiedColorPatternChoices,
        requireVerifiedColorPatternChoices: false
      });

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }, { inlineData: { mimeType: imageMimeType, data: imageBase64 } }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        let parsedVision;
        try {
          parsedVision = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        } catch (parseErr) {
          return Response.json({ success: false, intent, pieceId, error: "Vision response failed JSON parsing." }, { status: 500 });
        }

        delete parsedVision.verified_color_pattern_choices;

        for (const sKey of ["primary_medium", "material", "stone_family"]) {
          if (
            isGenericBareStoneProposal(parsedVision[sKey]) ||
            isSettingOrHardwareMediumValue(parsedVision[sKey])
          ) {
            delete parsedVision[sKey];
          }
        }

        if (parsedVision.overall_solid_length_in !== undefined) {
          const validSolidLen = parseValidPhotoSolidLengthInches(parsedVision.overall_solid_length_in);
          if (validSolidLen) {
            parsedVision.overall_solid_length_in = validSolidLen;
          } else {
            delete parsedVision.overall_solid_length_in;
          }
        }

        const validatedCandidates = validateStandardizedCandidates(
          parsedVision.standardized_candidates,
          {
            ...parsedVision,
            ...currentInputFacts
          }
        );
        delete parsedVision.standardized_candidates;
        ALLOWED_STANDARDIZED_CANDIDATE_KEYS.forEach(k => {
          delete parsedVision[k];
          delete parsedVision[`shopify.${k}`];
          delete parsedVision[`std_${k.replace(/-/g, "_")}`];
          delete parsedVision[`custom.std_${k.replace(/-/g, "_")}`];
        });

        delete parsedVision.piece_name;
        delete parsedVision.rarity;
        delete parsedVision.authenticity;
        delete parsedVision.character_marks;
        delete parsedVision.primary_use;
        delete parsedVision.necklace_design;
        delete parsedVision.weight_grams;
        delete parsedVision.shipping_weight_oz;
        delete parsedVision.price;
        stripRetiredParkedProducerEntries(parsedVision, "PRODUCT");

        parsedVision.generated_description = formatDyslexiaText(parsedVision.generated_description);

        const reviewProposals = {};
        if (stoneIdentityContext.hadHardwareContamination && stoneIdentityContext.isIdentityUncertain) {
          reviewProposals.stone_identity_warning = `Setting/metal value in ${stoneIdentityContext.contaminatedFields.join(", ")} is not a valid stone identity; verify stone family/material before saving.`;
        }
        const explicitOperatorKeys = [
          "dimensions_mm", "overall_solid_length_in", "weight_grams", "shipping_weight_oz", "price",
          "honest_flaws_and_character", "wire_material",
          "cut_and_shape", "stone_shape", "color",
          "surface_finish", "primary_color", "secondary_colors", "color_pattern",
          "primary_medium", "secondary_medium", "setting_ready", "bail_included",
          "jewelry_finding_type", "chain_material", "chain_link_type",
          "jewelry_type", "treated", "treatment_status", "alt_text",
          "found_object", "origin_location", "collection_name", "collection_location"
        ];
        for (const key of explicitOperatorKeys) {
          if (currentInputFacts[key] !== undefined && currentInputFacts[key] !== "") {
            if (parsedVision[key] && parsedVision[key] !== currentInputFacts[key]) {
              reviewProposals[key] = parsedVision[key];
            }
            parsedVision[key] = currentInputFacts[key];
          }
        }

        const resolvedFamily = effectiveStoneFamilyForScan || resolvePicklistStoneFamily(parsedVision.stone_family) || "";
        const resolvedOriginLoc = idOrigin.isOriginOperatorLocked
          ? idOrigin.originSegment
          : idOrigin.isPurchasedProvenance
            ? (idOrigin.originSegment || "")
            : (idOrigin.originSegment || resolveEvidencedOriginLocation(parsedVision.origin_location) || "");
        const finalOriginSlug = defaultOriginSlug || resolveOriginHandle(resolvedOriginLoc, pagesList);
        const finalCollection = defaultCollection.name
          ? defaultCollection
          : resolveCollectionData(
              idOrigin.isPurchasedProvenance ? "" : resolvedOriginLoc,
              finalOriginSlug,
              collectionsList
            );

        if (idOrigin.isPurchasedProvenance) {
          if (typeof parsedVision.seo_title === "string" && hasRiverOrFieldCollectionClaim(parsedVision.seo_title)) {
            parsedVision.seo_title = buildSafePurchasedSeoTitle(resolvedFamily, parsedVision.product_format);
          }
          if (typeof parsedVision.poetic_hook === "string" && hasRiverOrFieldCollectionClaim(parsedVision.poetic_hook)) {
            delete parsedVision.poetic_hook;
          }
        }

        const ooakResult = resolveCanonicalOoakFromInputs(currentInputFacts, parsedVision);
        delete parsedVision.is_ooak;
        delete parsedVision.is_one_of_a_kind;

        const singleImageId = (body.get("imageId") || "").trim();
        const singleAltText = (currentInputFacts.alt_text || parsedVision.alt_text || "").trim();

        const resolvedMaterialVariety =
          currentInputFacts.material ||
          parsedVision.material ||
          parsedVision.primary_medium ||
          (resolvedFamily ? getDerivedMaterial(resolvedFamily) : "");

        const payload = sanitizeObject({
          pieceId,
          ...parsedVision,
          ...(idOrigin.preservedPieceName ? { piece_name: idOrigin.preservedPieceName } : {}),
          ...(resolvedFamily ? { stone_family: resolvedFamily } : {}),
          ...(resolvedOriginLoc ? { origin_location: resolvedOriginLoc } : {}),
          ...(finalOriginSlug ? { origin_handle: finalOriginSlug, origin_page_handle: finalOriginSlug } : {}),
          ...(finalCollection.name ? { collection_name: finalCollection.name } : {}),
          ...(idOrigin.isPurchasedProvenance
            ? (currentInputFacts.collection_location
                ? { collection_location: currentInputFacts.collection_location }
                : (resolvedOriginLoc ? { collection_location: mapCollectionLocation(resolvedOriginLoc) } : {}))
            : (finalCollection.name || resolvedOriginLoc
                ? { collection_location: mapCollectionLocation(finalCollection.name || resolvedOriginLoc) }
                : {})),
          ...(extractedStory ? { origin_story: extractedStory } : {}),
          ...(resolvedMaterialVariety ? { material: resolvedMaterialVariety } : {}),
          ...geoFields,
          ...(ooakResult.value ? { is_one_of_a_kind: ooakResult.value } : {}),
          ...(ooakResult.conflict ? { ooak_conflict: "Conflicting OOAK values supplied; verify before saving." } : {}),
          ...(singleAltText ? { alt_text: singleAltText } : {}),
          ...(singleImageId && singleAltText ? { imageAlts: [{ imageId: singleImageId, altText: singleAltText }] } : {}),
          target_gender: currentInputFacts.target_gender || "Unisex",
          google_product_category: currentInputFacts.google_product_category || parsedVision.google_product_category || "Apparel & Accessories > Jewelry"
        });

        delete payload.is_ooak;
        delete payload.rarity;
        delete payload.authenticity;
        delete payload.character_marks;
        delete payload.primary_use;
        delete payload.necklace_design;
        delete payload.age_group;
        delete payload.condition;
        delete payload.verified_color_pattern_choices;
        delete reviewProposals.verified_color_pattern_choices;
        stripRetiredParkedProducerEntries(payload, "PRODUCT");
        stripRetiredParkedProducerEntries(reviewProposals, "PRODUCT");

        if (validatedCandidates) {
          payload.standardized_candidates = validatedCandidates;
        }
        if (Object.keys(reviewProposals).length > 0) {
          payload.review_proposals = reviewProposals;
        }

        return Response.json({
          success: true,
          intent,
          pieceId,
          tab2Data: payload,
          ...(validatedCandidates ? { standardized_candidates: validatedCandidates } : {}),
          ...(Object.keys(reviewProposals).length > 0 ? { review_proposals: reviewProposals } : {})
        });
      }
      return Response.json({ success: false, intent, pieceId, error: `Vision API Failure (${geminiRes.status})` }, { status: 500 });
    }

    if (intent === "tab3FullRescan") {
      const pieceId = body.get("pieceId") || body.get("productId") || "NEW";
      const rawRequestId = body.get("requestId");
      const requestId =
        typeof rawRequestId === "string" && rawRequestId.trim() !== ""
          ? rawRequestId.trim()
          : null;
      const isBenchV2OptIn =
        String(body.get("benchV2OptIn") || "").trim().toLowerCase() === "true" ||
        String(body.get("bench_v2_opt_in") || "").trim().toLowerCase() === "true";

      const parsedVerifiedColorChoices = parseVerifiedColorPatternChoiceLabels(
        body.get("verified_color_pattern_choices")
      );
      const hasValidVerifiedColorPatternChoices = Boolean(
        parsedVerifiedColorChoices.supplied &&
        parsedVerifiedColorChoices.valid &&
        parsedVerifiedColorChoices.labels.length > 0
      );
      const validVerifiedColorPatternChoices = hasValidVerifiedColorPatternChoices
        ? parsedVerifiedColorChoices.labels
        : null;

      const EXCLUDED_CURRENT_DATA_META_KEYS = new Set([
        "intent",
        "pieceId",
        "productId",
        "productTitle",
        "pieceName",
        "humanPieceId",
        "imageBase64",
        "imageMimeType",
        "imageUrl",
        "imageId",
        "mediaInputs",
        "operator_locked_fields",
        "passive_stored_fields",
        "requestId",
        "benchV2OptIn",
        "bench_v2_opt_in",
        "is_ooak_observed_type",
        "is_one_of_a_kind_observed_type",
        "observed_destination_types",
        "verified_color_pattern_choices"
      ]);

      const provenance = resolveTab3FieldProvenance(body);
      const idOrigin = parseIdentityAndOriginInputs(body, provenance);

      const currentData = Object.fromEntries(
        Array.from(body.entries())
          .filter(
            ([key, value]) =>
              value &&
              typeof value === "string" &&
              value.trim() !== "" &&
              !EXCLUDED_CURRENT_DATA_META_KEYS.has(key)
          )
          .map(([k, v]) => [k, v.trim()])
      );
      stripRetiredParkedProducerEntries(currentData, "PRODUCT");

      const isOriginPassive =
        provenance.hasValidProvenance &&
        provenance.passiveStoredSet.has("origin_location") &&
        !provenance.operatorLockedSet.has("origin_location");

      const stoneIdentityContext = resolveVerifiedStoneIdentityContext(currentData, idOrigin.derivedFamily);
      const effectiveFamily = stoneIdentityContext.effectiveFamily || idOrigin.derivedFamily || "";
      const effectiveOriginLoc = idOrigin.isOriginOperatorLocked
        ? idOrigin.originSegment
        : idOrigin.isPurchasedProvenance
          ? (isOriginPassive ? "" : (idOrigin.originSegment || ""))
          : (idOrigin.originSegment || resolveEvidencedOriginLocation(currentData.origin_location) || "");

      const geoLookupCandidates = buildGeoLookupCandidates({
        idOrigin,
        stoneIdentityContext,
        currentData,
        provenance
      });
      const geoFields = await getGeoData(
        admin,
        geoLookupCandidates.length > 0 ? geoLookupCandidates : effectiveFamily
      );
      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);
      const defaultOriginSlug = resolveOriginHandle(
        effectiveOriginLoc,
        pagesList,
        idOrigin.explicitOriginHandle || currentData.origin_handle || currentData.origin_page_handle
      );
      const defaultCollection = resolveCollectionData(
        idOrigin.isPurchasedProvenance ? "" : effectiveOriginLoc,
        defaultOriginSlug,
        collectionsList,
        idOrigin.explicitCollectionName || currentData.collection_name
      );

      const matchedPage = defaultOriginSlug
        ? pagesList.find(p => p.handle === defaultOriginSlug || p.url.includes(defaultOriginSlug))
        : null;

      let extractedStory = matchedPage && matchedPage.excerpt ? matchedPage.excerpt : "";
      if (!extractedStory) {
        extractedStory = (body.get("origin_story") || "").trim();
      }

      let mediaInputs = [];
      try {
        const rawMedia = body.get("mediaInputs");
        if (rawMedia) mediaInputs = JSON.parse(rawMedia);
      } catch (e) {
        console.error("Failed to parse mediaInputs:", e);
      }

      const contents = [];
      const hasMultipleImages = Array.isArray(mediaInputs) && mediaInputs.length > 0;
      const hasExistingGeneralAlt = Boolean(
        currentData.alt_text !== undefined && String(currentData.alt_text).trim() !== ""
      );
      const matchedCollectionObj = defaultCollection.slug
        ? collectionsList.find(c => c.handle === defaultCollection.slug)
        : null;

      const promptText = buildTab3VisionPrompt({
        pagesMenu: pagesList.map(p => `- Title: "${p.title}" | Handle: ${p.handle}`).join("\n"),
        collectionsMenu: collectionsList.map(c => `- Title: "${c.title}" | Handle: ${c.handle}`).join("\n"),
        stoneFamily: effectiveFamily || "Unspecified Stone",
        derivedShape: idOrigin.derivedShape,
        originStory: extractedStory,
        collectionStory: matchedCollectionObj?.excerpt || "",
        originSegment: effectiveOriginLoc || "Unspecified Origin",
        targetUrlPath: defaultOriginSlug ? `/pages/${defaultOriginSlug}` : "",
        fullCollectionTitle: defaultCollection.name,
        collectionUrlPath: defaultCollection.slug ? `/collections/${defaultCollection.slug}` : "",
        currentData,
        hasMultipleImages,
        hasExistingGeneralAlt,
        provenance,
        verifiedColorPatternChoices: validVerifiedColorPatternChoices,
        requireVerifiedColorPatternChoices: isBenchV2OptIn
      });
      contents.push({ text: promptText });

      let loadedImageCount = 0;
      if (hasMultipleImages) {
        const MAX_IMAGES = 15;
        if (mediaInputs.length > MAX_IMAGES) {
          console.warn(`[WARNING] Limiting Vision processing to ${MAX_IMAGES} images (received ${mediaInputs.length}).`);
          mediaInputs = mediaInputs.slice(0, MAX_IMAGES);
        }
        for (const input of mediaInputs) {
          if (input.url && input.imageId) {
            try {
              const imageRes = await fetch(input.url);
              if (imageRes.ok) {
                const buffer = await imageRes.arrayBuffer();
                const base64Data = Buffer.from(buffer).toString("base64");
                contents.push({ text: `Image ID: ${input.imageId}` });
                contents.push({ inlineData: { mimeType: "image/jpeg", data: base64Data } });
                loadedImageCount++;
              }
            } catch (err) {
              console.error(`Failed to fetch image ${input.imageId} from ${input.url}`, err);
            }
          }
        }
      } else {
        let imageBase64 = (body.get("imageBase64") || "").trim();
        let imageMimeType = body.get("imageMimeType") || "image/jpeg";
        if (imageBase64.includes(",")) {
          imageBase64 = imageBase64.slice(imageBase64.indexOf(",") + 1);
        }
        if (!imageBase64 && body.get("imageUrl")) {
          const imageRes = await fetch(body.get("imageUrl"));
          if (imageRes.ok) {
            imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64");
          }
        }
        if (imageBase64) {
          contents.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
          loadedImageCount++;
        }
      }

      if (loadedImageCount === 0) {
        return Response.json(
          {
            success: false,
            intent,
            pieceId,
            ...(requestId ? { requestId } : {}),
            error: "No valid images could be loaded for Tab 3 Vision Rescan."
          },
          { status: 400 }
        );
      }

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: contents }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
        let parsedVision;
        try {
          parsedVision = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));
        } catch (parseErr) {
          return Response.json(
            {
              success: false,
              intent,
              pieceId,
              ...(requestId ? { requestId } : {}),
              error: "Tab 3 Vision response failed JSON parsing."
            },
            { status: 500 }
          );
        }

        delete parsedVision.character_marks;
        delete parsedVision.primary_use;
        delete parsedVision.necklace_design;
        delete parsedVision.verified_color_pattern_choices;
        stripRetiredParkedProducerEntries(parsedVision, "PRODUCT");

        const rawVisionSnapshot = {};
        if (parsedVision && typeof parsedVision === "object" && !Array.isArray(parsedVision)) {
          for (const [vk, vv] of Object.entries(parsedVision)) {
            if (vk === "verified_color_pattern_choices") continue;
            if (typeof vv === "string" || typeof vv === "boolean" || typeof vv === "number") {
              rawVisionSnapshot[vk] = vv;
            }
          }
        }
        stripRetiredParkedProducerEntries(rawVisionSnapshot, "PRODUCT");

        let validatedImageAlts = [];
        let altValidationErrors = [];

        if (hasMultipleImages) {
          if (!hasExistingGeneralAlt) {
            delete parsedVision.alt_text;
          }
          if (Array.isArray(parsedVision.imageAlts)) {
            const inputIdSet = new Set(mediaInputs.map(m => m.imageId));
            const processedIdSet = new Set();

            for (const altObj of parsedVision.imageAlts) {
              if (!altObj.imageId || !altObj.altText) {
                altValidationErrors.push(`Malformed alt object: missing ID or text.`);
                continue;
              }
              if (!inputIdSet.has(altObj.imageId)) {
                altValidationErrors.push(`Unknown image ID returned: ${altObj.imageId}`);
                continue;
              }
              if (processedIdSet.has(altObj.imageId)) {
                altValidationErrors.push(`Duplicate image ID returned: ${altObj.imageId}`);
                continue;
              }
              validatedImageAlts.push({
                imageId: altObj.imageId,
                altText: String(altObj.altText).trim()
              });
              processedIdSet.add(altObj.imageId);
            }

            for (const inputId of inputIdSet) {
              if (!processedIdSet.has(inputId)) {
                altValidationErrors.push(`Missing target image ID: ${inputId}`);
              }
            }
          }
          delete parsedVision.imageAlts;
        } else {
          const singleImageId = (body.get("imageId") || "").trim();
          const isAltLocked = provenance.hasValidProvenance && provenance.operatorLockedSet.has("alt_text");
          const singleAlt = isAltLocked
            ? (currentData.alt_text || "").trim()
            : (parsedVision.alt_text || currentData.alt_text || "").trim();
          if (singleImageId && singleAlt) {
            validatedImageAlts.push({ imageId: singleImageId, altText: singleAlt });
          }
          if (!hasExistingGeneralAlt) {
            delete parsedVision.alt_text;
          }
          delete parsedVision.imageAlts;
        }

        for (const sKey of ["primary_medium", "material", "stone_family"]) {
          if (
            isGenericBareStoneProposal(parsedVision[sKey]) ||
            isSettingOrHardwareMediumValue(parsedVision[sKey])
          ) {
            delete parsedVision[sKey];
          }
        }

        if (parsedVision.overall_solid_length_in !== undefined) {
          const validSolidLen = parseValidPhotoSolidLengthInches(parsedVision.overall_solid_length_in);
          if (validSolidLen) {
            parsedVision.overall_solid_length_in = validSolidLen;
          } else {
            delete parsedVision.overall_solid_length_in;
          }
        }

        const protectedKeys = [
          "color_pattern", "primary_color", "secondary_colors", "color",
          "cut_and_shape", "stone_shape",
          "dimensions_mm", "overall_solid_length_in",
          "honest_flaws_and_character", "surface_finish", "jewelry_finding_type", "bail_included",
          "chain_material", "wire_material", "secondary_medium", "primary_medium", "material", "stone_family",
          "product_format", "jewelry_type", "chain_link_type",
          "setting_ready", "craftsmanship", "poetic_hook",
          "seo_title", "alt_text", "google_product_category", "treated", "treatment_status",
          "found_object", "origin_location", "origin_handle", "origin_page_handle",
          "collection_name", "collection_location"
        ];

        const reviewProposals = {};
        if (stoneIdentityContext.hadHardwareContamination) {
          reviewProposals.stone_identity_warning = stoneIdentityContext.isIdentityUncertain
            ? `Setting/metal value in ${stoneIdentityContext.contaminatedFields.join(", ")} is not a valid stone identity and no verified stone identity was found; review and set custom.material before saving.`
            : `Ignored setting/metal value in ${stoneIdentityContext.contaminatedFields.join(", ")}; using reviewed stone identity "${stoneIdentityContext.effectiveMaterial || stoneIdentityContext.effectiveFamily}".`;
        }

        protectedKeys.forEach(k => {
          if (currentData[k] !== undefined && currentData[k] !== "") {
            const isOperatorLocked =
              provenance.hasValidProvenance &&
              provenance.operatorLockedSet.has(k);
            const isMarkedPassive =
              provenance.hasValidProvenance &&
              provenance.passiveStoredSet.has(k) &&
              !isOperatorLocked;

            if ((k === "primary_medium" || k === "material") && isSettingOrHardwareMediumValue(currentData[k])) {
              const replacementStoneVal =
                k === "material"
                  ? (stoneIdentityContext.effectiveMaterial || parsedVision.material || parsedVision.primary_medium || "")
                  : (stoneIdentityContext.effectivePrimaryMedium || parsedVision.primary_medium || parsedVision.material || "");
              if (replacementStoneVal && !isSettingOrHardwareMediumValue(replacementStoneVal)) {
                parsedVision[k] = replacementStoneVal;
                reviewProposals[k] = replacementStoneVal;
              } else {
                delete parsedVision[k];
              }
              return;
            }

            if (k === "stone_family" && isSettingOrHardwareMediumValue(currentData[k])) {
              const replacementFamilyVal =
                stoneIdentityContext.effectiveFamily ||
                resolvePicklistStoneFamily(parsedVision.stone_family) ||
                "";
              if (replacementFamilyVal && !isSettingOrHardwareMediumValue(replacementFamilyVal)) {
                parsedVision[k] = replacementFamilyVal;
                reviewProposals[k] = replacementFamilyVal;
              } else {
                delete parsedVision[k];
              }
              return;
            }

            const isPassiveClassification =
              isMarkedPassive &&
              CLASSIFICATION_OVERRIDE_KEYS.has(k);

            const isPassiveConstruction =
              isMarkedPassive &&
              PASSIVE_CONSTRUCTION_REVIEW_KEYS.has(k);

            const isPassiveProvenanceOrSeo =
              isMarkedPassive &&
              PASSIVE_PROVENANCE_AND_SEO_KEYS.has(k);

            const rawProposedVal =
              parsedVision[k] !== undefined && parsedVision[k] !== null
                ? String(parsedVision[k]).trim()
                : "";
            const isAllowedDestinationDomainValue =
              (k === "jewelry_type" && /^n\/a$/i.test(rawProposedVal)) ||
              (k === "chain_material" && /^none$/i.test(rawProposedVal));
            const hasFreshProposal =
              rawProposedVal !== "" &&
              (isAllowedDestinationDomainValue || !INVALID_CANDIDATE_FILLERS.has(rawProposedVal.toLowerCase()));

            if (isPassiveClassification || isPassiveConstruction || isPassiveProvenanceOrSeo) {
              if (hasFreshProposal && rawProposedVal !== currentData[k]) {
                const normalizedDomainVal =
                  k === "jewelry_type" && /^n\/a$/i.test(rawProposedVal)
                    ? "N/A"
                    : k === "chain_material" && /^none$/i.test(rawProposedVal)
                      ? "None"
                      : rawProposedVal;
                parsedVision[k] = normalizedDomainVal;
                reviewProposals[k] = normalizedDomainVal;
              } else {
                parsedVision[k] = currentData[k];
              }
            } else {
              if (parsedVision[k] !== undefined && parsedVision[k] !== "" && parsedVision[k] !== currentData[k]) {
                reviewProposals[k] = parsedVision[k];
              }
              parsedVision[k] = currentData[k];
            }
          }
        });

        const validatedCandidates = validateStandardizedCandidates(
          parsedVision.standardized_candidates,
          {
            ...currentData,
            ...parsedVision
          }
        );
        delete parsedVision.standardized_candidates;
        ALLOWED_STANDARDIZED_CANDIDATE_KEYS.forEach(k => {
          delete parsedVision[k];
          delete parsedVision[`shopify.${k}`];
          delete parsedVision[`std_${k.replace(/-/g, "_")}`];
          delete parsedVision[`custom.std_${k.replace(/-/g, "_")}`];
        });

        const geoKeys = [
          "mohs_hardness", "luster", "fracture_pattern", "cleavage",
          "specific_gravity", "diaphaneity", "tenacity", "crystal_system",
          "geological_era", "mineral_class", "rock_composition", "rock_formation", "geological_age"
        ];
        const verifiedGeoValues = {};
        geoKeys.forEach(key => {
          const isGeoOperatorLocked =
            provenance.hasValidProvenance &&
            provenance.operatorLockedSet.has(key);
          const isGeoPassiveStored =
            provenance.hasValidProvenance &&
            provenance.passiveStoredSet.has(key) &&
            !isGeoOperatorLocked;

          if (currentData[key] !== undefined && currentData[key] !== "" && !isGeoPassiveStored) {
            verifiedGeoValues[key] = currentData[key];
            parsedVision[key] = currentData[key];
          } else if (geoFields[key] !== undefined && geoFields[key] !== null && geoFields[key] !== "") {
            verifiedGeoValues[key] = geoFields[key];
            parsedVision[key] = geoFields[key];
          } else if (currentData[key] !== undefined && currentData[key] !== "") {
            verifiedGeoValues[key] = currentData[key];
            parsedVision[key] = currentData[key];
          }
        });

        delete parsedVision.piece_name;
        delete parsedVision.origin_story;
        delete parsedVision.price;
        delete parsedVision.shopify_title;
        delete parsedVision.weight_grams;
        delete parsedVision.shipping_weight_oz;
        delete parsedVision.generated_description;
        delete parsedVision.rarity;
        delete parsedVision.authenticity;
        delete parsedVision.character_marks;
        delete parsedVision.primary_use;
        delete parsedVision.necklace_design;

        const ooakResult = resolveCanonicalOoakFromInputs(currentData, parsedVision);
        delete parsedVision.is_ooak;
        delete parsedVision.is_one_of_a_kind;

        const finalFamily = effectiveFamily || resolvePicklistStoneFamily(parsedVision.stone_family) || "";
        const finalOriginLoc = idOrigin.isOriginOperatorLocked
          ? idOrigin.originSegment
          : idOrigin.isPurchasedProvenance
            ? (effectiveOriginLoc || "")
            : (effectiveOriginLoc || resolveEvidencedOriginLocation(parsedVision.origin_location) || "");
        const finalOriginSlug = defaultOriginSlug || resolveOriginHandle(finalOriginLoc, pagesList);
        const finalCollection = defaultCollection.name
          ? defaultCollection
          : resolveCollectionData(
              idOrigin.isPurchasedProvenance ? "" : finalOriginLoc,
              finalOriginSlug,
              collectionsList
            );

        const isSeoTitleOperatorLocked =
          provenance.hasValidProvenance &&
          provenance.operatorLockedSet.has("seo_title") &&
          Boolean(currentData.seo_title);
        const isPoeticHookOperatorLocked =
          provenance.hasValidProvenance &&
          provenance.operatorLockedSet.has("poetic_hook") &&
          Boolean(currentData.poetic_hook);

        if (idOrigin.isPurchasedProvenance) {
          if (!isSeoTitleOperatorLocked && typeof parsedVision.seo_title === "string" && hasRiverOrFieldCollectionClaim(parsedVision.seo_title)) {
            parsedVision.seo_title = buildSafePurchasedSeoTitle(finalFamily, parsedVision.product_format);
          }
          if (!isPoeticHookOperatorLocked && typeof parsedVision.poetic_hook === "string" && hasRiverOrFieldCollectionClaim(parsedVision.poetic_hook)) {
            delete parsedVision.poetic_hook;
          }
        }

        const isCollectionLocationOperatorLocked =
          provenance.hasValidProvenance &&
          provenance.operatorLockedSet.has("collection_location") &&
          Boolean(currentData.collection_location);

        const resolvedCollectionLocation = isCollectionLocationOperatorLocked
          ? currentData.collection_location
          : idOrigin.isPurchasedProvenance
            ? (finalOriginLoc ? mapCollectionLocation(finalOriginLoc) : "")
            : (currentData.collection_location || (finalCollection.name || finalOriginLoc ? mapCollectionLocation(finalCollection.name || finalOriginLoc) : ""));

        const payload = sanitizeObject({
          pieceId,
          ...geoFields,
          ...parsedVision,
          ...(idOrigin.rawTitleInput ? { shopify_title: idOrigin.rawTitleInput } : {}),
          ...(idOrigin.preservedPieceName ? { piece_name: idOrigin.preservedPieceName } : {}),
          ...(finalFamily ? { stone_family: finalFamily } : {}),
          ...(finalOriginLoc ? { origin_location: finalOriginLoc } : {}),
          ...(finalOriginSlug ? { origin_handle: finalOriginSlug, origin_page_handle: finalOriginSlug } : {}),
          ...(finalCollection.name ? { collection_name: finalCollection.name } : {}),
          ...(resolvedCollectionLocation ? { collection_location: resolvedCollectionLocation } : {}),
          ...(extractedStory ? { origin_story: extractedStory } : {}),
          ...(ooakResult.value ? { is_one_of_a_kind: ooakResult.value } : {}),
          ...(ooakResult.conflict ? { ooak_conflict: "Conflicting OOAK values supplied; verify before saving." } : {})
        });

        if (idOrigin.isPurchasedProvenance && !finalOriginLoc && !idOrigin.isOriginOperatorLocked) {
          delete payload.origin_location;
        }
        if (idOrigin.isPurchasedProvenance && !resolvedCollectionLocation && !isCollectionLocationOperatorLocked) {
          delete payload.collection_location;
        }

        delete payload.is_ooak;
        delete payload.rarity;
        delete payload.authenticity;
        delete payload.character_marks;
        delete payload.primary_use;
        delete payload.necklace_design;
        delete payload.verified_color_pattern_choices;
        delete reviewProposals.verified_color_pattern_choices;
        stripRetiredParkedProducerEntries(payload, "PRODUCT");
        stripRetiredParkedProducerEntries(reviewProposals, "PRODUCT");

        if (currentData.price) payload.price = currentData.price;
        if (currentData.weight_grams) payload.weight_grams = currentData.weight_grams;
        if (currentData.shipping_weight_oz) payload.shipping_weight_oz = currentData.shipping_weight_oz;

        const finalPayload = {};
        for (const [k, v] of Object.entries(payload)) {
          if (v !== undefined && v !== null && v !== "") {
            finalPayload[k] = v;
          }
        }
        if (validatedCandidates) {
          finalPayload.standardized_candidates = validatedCandidates;
        }
        if (Object.keys(reviewProposals).length > 0) {
          finalPayload.review_proposals = reviewProposals;
        }

        // ====================================================================
        // OPT-IN BENCH V2 PRODUCER PROPOSALS SEPARATION (tab3FullRescan ONLY)
        // ====================================================================
        let producerProposals = undefined;
        let producerDiagnostics = undefined;

        if (isBenchV2OptIn) {
          const builtBenchV2 = buildBenchV2ProducerProposals({
            body,
            idOrigin,
            currentData,
            rawVisionSnapshot,
            geoFields,
            pagesList,
            collectionsList
          });
          producerProposals = stripRetiredParkedProducerEntries(builtBenchV2.producerProposals, "PRODUCT");
          producerDiagnostics = stripRetiredParkedProducerEntries(builtBenchV2.producerDiagnostics, "PRODUCT");

          if (!hasValidVerifiedColorPatternChoices) {
            producerDiagnostics = producerDiagnostics && typeof producerDiagnostics === "object"
              ? producerDiagnostics
              : {};
            producerDiagnostics["shopify.color-pattern"] = parsedVerifiedColorChoices.supplied
              ? (parsedVerifiedColorChoices.error ||
                  "Verified Shopify Color reference choices (verified_color_pattern_choices) were invalid or empty on this AI Scan request; standardized color-pattern candidate generation was omitted.")
              : "Verified Shopify Color reference choices (verified_color_pattern_choices) were not supplied on this AI Scan request; standardized color-pattern candidate generation was omitted until verified reference choices are loaded.";
          }
        }

        return Response.json({
          success: true,
          intent,
          pieceId,
          ...(requestId ? { requestId } : {}),
          tab3Data: finalPayload,
          ...(isBenchV2OptIn ? { producerProposals } : {}),
          ...(isBenchV2OptIn && producerDiagnostics && Object.keys(producerDiagnostics).length > 0
            ? { producerDiagnostics }
            : {}),
          ...(validatedCandidates ? { standardized_candidates: validatedCandidates } : {}),
          ...(Object.keys(reviewProposals).length > 0 ? { review_proposals: reviewProposals } : {}),
          verifiedGeoValues,
          imageAlts: validatedImageAlts,
          altValidationErrors: altValidationErrors.length > 0 ? altValidationErrors : undefined
        });
      }
      return Response.json(
        {
          success: false,
          intent,
          pieceId,
          ...(requestId ? { requestId } : {}),
          error: `Vision API Failure (Tab 3: ${geminiRes.status})`
        },
        { status: 500 }
      );
    }

    if (intent === "generateDescription") {
      const pieceId = body.get("pieceId");
      const sharedFields = JSON.parse(body.get("sharedFields") || "{}");
      const pieceDataStr = body.get("pieceData");
      let promptText = "";

      const { pagesList, collectionsList } = await getLiveStoreDirectory(admin);

      let diagPieceId = "Unknown_GID";
      let diagPieceName = "Unknown_Name";
      let diagTargetOriginHandle = "None";
      let diagCollectionSlug = "None";
      let diagOriginSource = "None";
      let diagOriginRawLength = 0;
      let diagOriginExtractedLength = 0;
      let diagOriginTruncated = false;
      let diagCollectionRawLength = 0;
      let diagCollectionExtractedLength = 0;
      let diagCollectionTruncated = false;
      let diagExtractedStory = "";
      let diagCollectionStory = "";

      if (pieceDataStr) {
        try {
          const pieceData = JSON.parse(pieceDataStr);
          diagPieceId = pieceData.pieceId || pieceData.id || pieceId || "Unknown_GID";
          diagPieceName = pieceData.piece_name || pieceData.shopify_title || "Unknown_Name";

          const mergedPieceForPrompt = {
            ...sharedFields,
            ...pieceData
          };
          stripRetiredParkedProducerEntries(mergedPieceForPrompt, "PRODUCT");

          const stoneIdentityContext = resolveVerifiedStoneIdentityContext(
            mergedPieceForPrompt,
            sharedFields.stone_family || pieceData.stone_family || ""
          );

          if (stoneIdentityContext.isIdentityUncertain) {
            return Response.json({
              success: false,
              intent,
              pieceId,
              error: stoneIdentityContext.hadHardwareContamination
                ? `Stone identity is uncertain: ${stoneIdentityContext.contaminatedFields.join(", ")} contains setting/hardware material rather than stone identity. Review and set Stone Family / Material before generating a description.`
                : "Stone identity is missing or uncertain. Review and set Stone Family / Material before generating a description."
            });
          }

          const derivedFamily = stoneIdentityContext.effectiveFamily;
          mergedPieceForPrompt.stone_family = derivedFamily;
          if (stoneIdentityContext.effectiveMaterial) {
            mergedPieceForPrompt.material = stoneIdentityContext.effectiveMaterial;
          } else {
            delete mergedPieceForPrompt.material;
          }
          if (stoneIdentityContext.effectivePrimaryMedium) {
            mergedPieceForPrompt.primary_medium = stoneIdentityContext.effectivePrimaryMedium;
          } else {
            delete mergedPieceForPrompt.primary_medium;
          }

          const rawFoundObj = pieceData.found_object ?? pieceData["custom.found_object"] ?? sharedFields.found_object ?? sharedFields["custom.found_object"];
          const isPurchasedProvenance = classifyFoundObjectPolarity(rawFoundObj) === "purchased";

          const validPieceOrigin = pieceData.origin_location && pieceData.origin_location !== "Unknown Origin" && pieceData.origin_location.trim() !== "";
          const isSharedOriginDerived = !sharedFields.origin_location || sharedFields.origin_location === "Unknown Origin" || sharedFields.origin_location.trim() === "";

          const rawOriginSegment = (isSharedOriginDerived && validPieceOrigin) ? pieceData.origin_location : (sharedFields.origin_location || pieceData.origin_location || "");
          const originSegment = resolveEvidencedOriginLocation(rawOriginSegment);

          const explicitOriginHandle = sharedFields.origin_handle || sharedFields.origin_page_handle || pieceData.origin_handle || pieceData.origin_page_handle || "";
          const targetOriginHandle = resolveOriginHandle(originSegment, pagesList, explicitOriginHandle);
          diagTargetOriginHandle = targetOriginHandle || "None";

          const matchedPage = targetOriginHandle
            ? pagesList.find(p => p.handle === targetOriginHandle)
            : undefined;

          const carriedOriginStory = typeof pieceData.origin_story === "string" && pieceData.origin_story.trim()
            ? pieceData.origin_story
            : (typeof sharedFields.origin_story === "string" ? sharedFields.origin_story : "");

          const extractedStory = carriedOriginStory.trim()
            ? carriedOriginStory
            : (matchedPage?.excerpt || "");
          diagExtractedStory = extractedStory;
          diagOriginExtractedLength = extractedStory.length;
          diagOriginSource = carriedOriginStory.trim()
            ? "Carried pieceData/sharedFields"
            : (extractedStory ? "Matched origin page" : "Empty");

          let canonicalCollectionName = pieceData.collection_name || sharedFields.collection_name || "";
          if (originSegment === "Yakima River Canyon" || canonicalCollectionName === "The Yakima Canyon Collection") {
            canonicalCollectionName = "Yakima River Canyon";
          }

          const collectionData = resolveCollectionData(
            isPurchasedProvenance ? "" : originSegment,
            targetOriginHandle,
            collectionsList,
            canonicalCollectionName
          );
          diagCollectionSlug = collectionData.slug || "None";
          if (!canonicalCollectionName && collectionData.name) {
            canonicalCollectionName = collectionData.name;
          }

          if (!targetOriginHandle && originSegment !== "Unknown Origin" && originSegment !== "") {
            console.warn(`[ROUTING WARNING] Piece ${diagPieceName}: Could not resolve Origin Handle for location "${originSegment}"`);
          }
          if (!collectionData.slug && originSegment !== "Unknown Origin" && originSegment !== "") {
            console.warn(`[ROUTING WARNING] Piece ${diagPieceName}: Could not resolve Collection Slug for location "${originSegment}" and default handle "${targetOriginHandle}"`);
          }

          diagOriginRawLength = matchedPage ? matchedPage.rawExcerptLength : diagOriginExtractedLength;
          diagOriginTruncated = diagOriginRawLength > 10000;

          const matchedCollection = collectionData.slug ? collectionsList.find(c => c.handle === collectionData.slug) : undefined;
          const collectionStory = matchedCollection ? matchedCollection.excerpt : "";
          diagCollectionStory = collectionStory;
          diagCollectionExtractedLength = collectionStory.length;
          diagCollectionRawLength = matchedCollection ? matchedCollection.rawExcerptLength : 0;
          diagCollectionTruncated = diagCollectionRawLength > 5000;

          promptText = buildDescriptionPrompt(
            derivedFamily,
            originSegment,
            extractedStory,
            canonicalCollectionName,
            mergedPieceForPrompt,
            collectionStory
          );
        } catch (e) {
          return Response.json({ success: false, intent, pieceId, error: "Description context could not be prepared. Rebuild the product manifest and review its facts before generating a description." });
        }
      } else {
        return Response.json({ success: false, intent, pieceId, error: "Description context could not be prepared. Rebuild the product manifest and review its facts before generating a description." });
      }

      console.log(`\n========== [DIAGNOSTIC RUN START - Piece: ${diagPieceName}] ==========`);
      console.log(`Piece GID: ${diagPieceId}`);
      console.log(`Origin Handle Selected: ${diagTargetOriginHandle}`);
      console.log(`Collection Handle Selected: ${diagCollectionSlug}`);
      console.log(`Origin Context Source: ${diagOriginSource}`);
      console.log(`Origin Text Length (Before Truncation): ${diagOriginRawLength}`);
      console.log(`Origin Text Length (After Truncation): ${diagOriginExtractedLength}`);
      console.log(`Origin Truncated? ${diagOriginTruncated}`);
      console.log(`Collection Text Length (Before Truncation): ${diagCollectionRawLength}`);
      console.log(`Collection Text Length (After Truncation): ${diagCollectionExtractedLength}`);
      console.log(`Collection Truncated? ${diagCollectionTruncated}`);
      console.log(`\n--- EXACT ORIGIN TEXT SENT ---\n${diagExtractedStory}\n------------------------------`);
      console.log(`\n--- EXACT COLLECTION TEXT SENT ---\n${diagCollectionStory}\n----------------------------------`);
      console.log(`\n--- EXACT FINAL PROMPT SENT TO GEMINI ---\n${promptText}\n-----------------------------------------`);
      console.log(`========== [DIAGNOSTIC RUN END - Piece: ${diagPieceName}] ==========\n`);

      const geminiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } })
      });

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let cleanJson = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

        let generatedDescription = "";

        try {
          const parsed = JSON.parse(cleanJson.slice(cleanJson.indexOf("{"), cleanJson.lastIndexOf("}") + 1));

          if (!parsed.generated_description || typeof parsed.generated_description !== "string" || parsed.generated_description.trim() === "") {
            return Response.json({ success: false, intent, pieceId, error: "AI failed to return the expected generated_description string property." });
          }

          generatedDescription = parsed.generated_description;
        } catch (e) {
          return Response.json({ success: false, intent, pieceId, error: "AI response failed strict JSON parsing or wrapper validation." });
        }

        if (pieceDataStr) {
          const pieceData = JSON.parse(pieceDataStr);
          const rawFoundObj = pieceData.found_object ?? pieceData["custom.found_object"] ?? sharedFields.found_object ?? sharedFields["custom.found_object"];
          const isPurchasedProvenance = classifyFoundObjectPolarity(rawFoundObj) === "purchased";

          const validPieceOrigin = pieceData.origin_location && pieceData.origin_location !== "Unknown Origin" && pieceData.origin_location.trim() !== "";
          const isSharedOriginDerived = !sharedFields.origin_location || sharedFields.origin_location === "Unknown Origin" || sharedFields.origin_location.trim() === "";

          const rawOriginSegment = (isSharedOriginDerived && validPieceOrigin) ? pieceData.origin_location : (sharedFields.origin_location || pieceData.origin_location || "");
          const originSegment = resolveEvidencedOriginLocation(rawOriginSegment);

          let fullCollectionTitle = pieceData.collection_name || sharedFields.collection_name || "";
          if (originSegment === "Yakima River Canyon" || fullCollectionTitle === "The Yakima Canyon Collection") {
            fullCollectionTitle = "Yakima River Canyon";
          }

          const explicitOriginHandle = sharedFields.origin_handle || sharedFields.origin_page_handle || pieceData.origin_handle || pieceData.origin_page_handle || "";
          const targetOriginHandle = resolveOriginHandle(originSegment, pagesList, explicitOriginHandle);
          const collectionData = resolveCollectionData(
            isPurchasedProvenance ? "" : originSegment,
            targetOriginHandle,
            collectionsList,
            fullCollectionTitle
          );

          let dwellButtonsHTML = `<br><br>`;

          let displayOriginName = fullCollectionTitle || originSegment;
          let displayColName = fullCollectionTitle || originSegment;

          if (originSegment === "Yakima River Canyon" || targetOriginHandle === "the-shop-lore-chert-road-detour-yakima-river-jasper") {
            displayOriginName = "Chert Road Detour";
            displayColName = "Yakima River Canyon";
          }

          if (targetOriginHandle) {
            dwellButtonsHTML += `<a href="/pages/${targetOriginHandle}">${displayOriginName} Story</a>\n`;
          }

          if (collectionData.slug) {
            if (targetOriginHandle) dwellButtonsHTML += `<br>`;
            let colLabel = displayColName;
            if (!/collection/i.test(colLabel)) colLabel += " Collection";
            dwellButtonsHTML += `<a href="/collections/${collectionData.slug}">${colLabel}</a>`;
          }

          if (originSegment === "Richardson's Rock Ranch" || targetOriginHandle === "the-richardson-strike") {
            dwellButtonsHTML = `<br><br>`;
            if (pagesList.some(p => p.handle === "the-richardson-strike")) {
              dwellButtonsHTML += `<a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>\n`;
            }

            if (collectionsList.some(c => c.handle === "richardsons-rock-ranch")) {
              dwellButtonsHTML += `<br><a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>`;
            }

            if (pagesList.some(p => p.handle === "the-3-000-mile-run")) {
              dwellButtonsHTML += `\n<br><a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>`;
            }

            if (collectionsList.some(c => c.handle === "the-3-000-mile-run-1")) {
              dwellButtonsHTML += `\n<br><a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>`;
            }
          }

          if (dwellButtonsHTML !== `<br><br>`) {
            generatedDescription += `\n${dwellButtonsHTML}`;
          }
        }

        return Response.json({ success: true, intent, pieceId, generated_description: formatDyslexiaText(generatedDescription) });
      }
      return Response.json({ success: false, intent, pieceId, error: `Description failed (${geminiRes.status})` }, { status: 500 });
    }

    return Response.json({ success: false, intent, ...(activeRequestId ? { requestId: activeRequestId } : {}), error: "Unhandled Autofill Intent" }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", ...(activeRequestId ? { requestId: activeRequestId } : {}), error: error.message }, { status: 500 });
  }
}
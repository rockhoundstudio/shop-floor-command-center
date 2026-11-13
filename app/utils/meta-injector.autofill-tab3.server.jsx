// ==========================================================================
// ROCKHOUND STUDIO — TAB 3 VISION RESCAN, DESCRIPTION & DIRECTORY TRANSPORT
// File: app/utils/meta-injector.autofill-tab3.server.jsx
// ==========================================================================

import {
  EXCLUDED_TITLES,
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
  mapCollectionLocation,
  parseValidPhotoSolidLengthInches,
  buildBenchV2ProducerProposals
} from "./meta-injector.autofill-inputs.server.jsx";
import {
  buildDescriptionPrompt,
  buildTab3VisionPrompt
} from "./meta-injector.prompts.server.jsx";
import {
  cleanProducerNonBlankVisionStr,
  getGeoData,
  resolvePostVisionBenchV2GeoFields,
  applyBenchV2DbGeologyDiagnostics
} from "./meta-injector.geology-db.server.jsx";

export function stripRetiredParkedProducerEntries(obj, defaultOwner = "PRODUCT") {
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

export function isShopifyTaxonomyPathOrGidString(rawVal) {
  if (typeof rawVal !== "string") return false;
  const trimmed = rawVal.trim();
  if (!trimmed) return false;
  return (
    /^gid:\/\/shopify\//i.test(trimmed) ||
    /\b(?:TaxonomyCategory|ProductTaxonomyNode)\b/i.test(trimmed) ||
    /^ae-\d+(?:-\d+)*$/i.test(trimmed)
  );
}

export async function fetchWithRetry(url, options, retries = 3, delay = 1500) {
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

export async function getLiveStoreDirectory(admin) {
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

export async function executeTab3FullRescanIntent({ intent, body, admin }) {
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

  const stoneIdentityContext = resolveVerifiedStoneIdentityContext(
    currentData,
    idOrigin.derivedFamily,
    provenance
  );
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
  let geoFields = await getGeoData(
    admin,
    geoLookupCandidates.length > 0 ? geoLookupCandidates : effectiveFamily,
    { requireAuthoritativeDbOnly: isBenchV2OptIn }
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

    geoFields = await resolvePostVisionBenchV2GeoFields({
      isBenchV2OptIn,
      provenance,
      currentData,
      geoLookupCandidates,
      effectiveFamily,
      idOrigin,
      rawVisionSnapshot,
      admin,
      geoFields
    });

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

    const hasConfirmedStoneForTab3 = Boolean(
      !stoneIdentityContext.isIdentityUncertain ||
      effectiveFamily ||
      resolvePicklistStoneFamily(parsedVision.stone_family) ||
      cleanProducerNonBlankVisionStr(parsedVision.material) ||
      cleanProducerNonBlankVisionStr(parsedVision.primary_medium) ||
      (geoFields && geoFields.geoSource && geoFields.geoSource !== "none")
    );
    const rawTitleForTab3HardwareCheck = String(idOrigin?.rawTitleInput || "").trim();
    const isExcludedHardwareTitleForTab3 = Boolean(
      rawTitleForTab3HardwareCheck &&
      Array.isArray(EXCLUDED_TITLES) &&
      EXCLUDED_TITLES.some(
        (t) =>
          typeof t === "string" &&
          t.trim().toLowerCase() === rawTitleForTab3HardwareCheck.toLowerCase()
      )
    );
    const isStandaloneHardwareOnlyForTab3 = Boolean(
      !hasConfirmedStoneForTab3 &&
      (isExcludedHardwareTitleForTab3 ||
        stoneIdentityContext.hadHardwareContamination)
    );

    if (parsedVision.google_product_category !== undefined) {
      const cleanVisTab3GoogleCat = cleanProducerNonBlankVisionStr(
        parsedVision.google_product_category
      );
      if (
        !cleanVisTab3GoogleCat ||
        isShopifyTaxonomyPathOrGidString(cleanVisTab3GoogleCat) ||
        !isStandaloneHardwareOnlyForTab3
      ) {
        delete parsedVision.google_product_category;
      } else {
        parsedVision.google_product_category = cleanVisTab3GoogleCat;
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
      } else if (currentData[key] !== undefined && currentData[key] !== "" && !isBenchV2OptIn) {
        verifiedGeoValues[key] = currentData[key];
        parsedVision[key] = currentData[key];
      } else {
        delete parsedVision[key];
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

      producerDiagnostics = producerDiagnostics && typeof producerDiagnostics === "object"
        ? producerDiagnostics
        : {};

      applyBenchV2DbGeologyDiagnostics({
        geoFields,
        effectiveFamily,
        provenance,
        currentData,
        producerProposals,
        producerDiagnostics
      });

      if (!hasValidVerifiedColorPatternChoices) {
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

export async function executeGenerateDescriptionIntent({ intent, body, admin }) {
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
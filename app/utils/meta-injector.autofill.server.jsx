// ==========================================================================
// ROCKHOUND STUDIO — AI AUTOFILL, VISION SCAN & DB GEOLOGY PRODUCER ENGINE
// File: app/utils/meta-injector.autofill.server.jsx
// ==========================================================================

import {
  DROPDOWN_OPTIONS,
  EXCLUDED_TITLES
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
  STONE_IDENTITY_KEYS,
  normalizeTitleMojibakeEmDashes,
  splitSegmentedTitle,
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
  parseValidPhotoSolidLengthInches
} from "./meta-injector.autofill-inputs.server.jsx";
import {
  getSharedFactualContract,
  buildMasterVisionPrompt
} from "./meta-injector.prompts.server.jsx";
import {
  cleanProducerNonBlankVisionStr,
  getGeoData
} from "./meta-injector.geology-db.server.jsx";
import {
  stripRetiredParkedProducerEntries,
  isShopifyTaxonomyPathOrGidString,
  fetchWithRetry,
  getLiveStoreDirectory,
  executeTab3FullRescanIntent,
  executeGenerateDescriptionIntent
} from "./meta-injector.autofill-tab3.server.jsx";

// 🟢 AI Engine — No Prisma Import Here

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

        const rawSuppliedGoogleCat =
          (body.get("google_product_category") ?? body.get("custom.google_product_category") ?? "").trim();
        const isSuppliedGoogleCatPassiveOnly =
          provenance.hasValidProvenance &&
          provenance.passiveStoredSet.has("google_product_category") &&
          !provenance.operatorLockedSet.has("google_product_category");
        const preservedGoogleCatForTitleParse =
          rawSuppliedGoogleCat &&
          !INVALID_CANDIDATE_FILLERS.has(rawSuppliedGoogleCat.toLowerCase()) &&
          !isShopifyTaxonomyPathOrGidString(rawSuppliedGoogleCat) &&
          (!provenance.hasValidProvenance ||
            provenance.operatorLockedSet.has("google_product_category") ||
            isSuppliedGoogleCatPassiveOnly)
            ? rawSuppliedGoogleCat
            : "";

        delete parsed.google_product_category;

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
          ...(preservedGoogleCatForTitleParse
            ? { google_product_category: preservedGoogleCatForTitleParse }
            : {})
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

      const stoneIdentityContext = resolveVerifiedStoneIdentityContext(rawInputFacts, idOrigin.derivedFamily, provenance);
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

      const isGoogleCatPassiveInScan =
        provenance.hasValidProvenance &&
        provenance.passiveStoredSet.has("google_product_category") &&
        !provenance.operatorLockedSet.has("google_product_category");
      const promptOperatorFacts = { ...currentInputFacts };
      if (isGoogleCatPassiveInScan) {
        delete promptOperatorFacts.google_product_category;
        delete promptOperatorFacts["custom.google_product_category"];
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
        operatorFacts: promptOperatorFacts,
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

        const hasConfirmedStoneForScan = Boolean(
          !stoneIdentityContext.isIdentityUncertain ||
          resolvedFamily ||
          resolvedMaterialVariety ||
          (geoFields && geoFields.geoSource && geoFields.geoSource !== "none")
        );
        const rawTitleForScanHardwareCheck = String(idOrigin?.rawTitleInput || "").trim();
        const isExcludedHardwareTitleForScan = Boolean(
          rawTitleForScanHardwareCheck &&
          Array.isArray(EXCLUDED_TITLES) &&
          EXCLUDED_TITLES.some(
            (t) =>
              typeof t === "string" &&
              t.trim().toLowerCase() === rawTitleForScanHardwareCheck.toLowerCase()
          )
        );
        const isStandaloneHardwareOnlyForScan = Boolean(
          !hasConfirmedStoneForScan &&
          (isExcludedHardwareTitleForScan ||
            stoneIdentityContext.hadHardwareContamination)
        );

        const rawSuppliedScanGoogleCat = String(
          currentInputFacts.google_product_category ??
          currentInputFacts["custom.google_product_category"] ??
          ""
        ).trim();
        const cleanSuppliedScanGoogleCat =
          rawSuppliedScanGoogleCat &&
          !INVALID_CANDIDATE_FILLERS.has(rawSuppliedScanGoogleCat.toLowerCase()) &&
          !isShopifyTaxonomyPathOrGidString(rawSuppliedScanGoogleCat)
            ? rawSuppliedScanGoogleCat
            : "";

        const rawVisScanGoogleCat = cleanProducerNonBlankVisionStr(
          parsedVision.google_product_category
        );
        const cleanVisScanGoogleCat =
          rawVisScanGoogleCat && !isShopifyTaxonomyPathOrGidString(rawVisScanGoogleCat)
            ? rawVisScanGoogleCat
            : "";

        delete parsedVision.google_product_category;

        let resolvedScanGoogleCat = "";
        if (cleanSuppliedScanGoogleCat) {
          resolvedScanGoogleCat = cleanSuppliedScanGoogleCat;
          if (
            isStandaloneHardwareOnlyForScan &&
            cleanVisScanGoogleCat &&
            cleanVisScanGoogleCat !== cleanSuppliedScanGoogleCat
          ) {
            reviewProposals.google_product_category = cleanVisScanGoogleCat;
          }
        } else if (isStandaloneHardwareOnlyForScan && cleanVisScanGoogleCat) {
          resolvedScanGoogleCat = cleanVisScanGoogleCat;
        }

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
          ...(resolvedScanGoogleCat ? { google_product_category: resolvedScanGoogleCat } : {})
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
      return await executeTab3FullRescanIntent({ intent, body, admin });
    }

    if (intent === "generateDescription") {
      return await executeGenerateDescriptionIntent({ intent, body, admin });
    }

    return Response.json({ success: false, intent, ...(activeRequestId ? { requestId: activeRequestId } : {}), error: "Unhandled Autofill Intent" }, { status: 400 });
  } catch (error) {
    return Response.json({ success: false, intent: "unknown", ...(activeRequestId ? { requestId: activeRequestId } : {}), error: error.message }, { status: 500 });
  }
}
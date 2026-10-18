// ==========================================================================
// ROCKHOUND STUDIO — INTAKE HELPER FUNCTIONS
// File: app/routes/app.meta-injector.intake-helpers.jsx
// (100% Original Logic & Dash Delimiters Preserved + Strict Schema Map Added)
// ==========================================================================
//
// CALLER ARGUMENT LIMITATION NOTE:
// In app/routes/app.meta-injector.injector.jsx (L181), handleScanGeminiPhotos
// calls handleScanPhoto({ piece, updatePiece: handlePieceChange, visionFetcher, setErrorMessage })
// without passing sharedFields. Therefore, when piece holds only a 1-segment human
// identifier (e.g. "BQH-1") and no piece.canonical_title / piece.stone_family /
// piece.origin_location, handleScanPhoto cannot read Section B sharedFields
// unless the caller passes sharedFields or stores those values on piece.
// Secondly,app/routes/app.meta-injector-autofill.jsx (visionScan, L562) splits
// productTitle/pieceName on dashes and uses segments[0] as derivedFamily whenever
// productTitle/pieceName is non-empty; therefore handleScanPhoto only sends a
// 3-segment title as productTitle when available, and sends a 1-segment human ID
// under humanPieceId so segments[0] does not misclassify the human ID as stone_family.

function splitSegmentedTitle(val) {
  if (typeof val !== "string") return [];
  const normalized = val
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—")
    .replace(/Ã¢â‚¬â€/g, "—")
    .trim();
  if (!normalized) return [];
  return normalized.split(/\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean);
}

function normalizeOoakToken(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val).trim();
  if (!str) return "";
  const lower = str.toLowerCase();
  if (lower === "yes" || lower === "true" || lower === "1" || lower === "ooak" || lower === "one-of-a-kind") {
    return "Yes";
  }
  if (lower === "no" || lower === "false" || lower === "0") {
    return "No";
  }
  return str;
}

function resolveCanonicalOoak(sharedFields = {}, piece = {}) {
  const pieceCanonical = normalizeOoakToken(piece?.is_one_of_a_kind);
  const pieceLegacy = normalizeOoakToken(piece?.is_ooak);

  if (pieceCanonical && pieceLegacy && pieceCanonical !== pieceLegacy) {
    return { value: "", conflict: true };
  }
  if (pieceCanonical || pieceLegacy) {
    return { value: pieceCanonical || pieceLegacy, conflict: false };
  }

  const sharedCanonical = normalizeOoakToken(sharedFields?.is_one_of_a_kind);
  const sharedLegacy = normalizeOoakToken(sharedFields?.is_ooak);

  if (sharedCanonical && sharedLegacy && sharedCanonical !== sharedLegacy) {
    return { value: "", conflict: true };
  }
  return { value: sharedCanonical || sharedLegacy || "", conflict: false };
}

export async function handleScanPhoto({ piece, updatePiece, visionFetcher, setErrorMessage, sharedFields }) {
  const file = piece?.photoFiles?.[0];
  const existingBase64 = typeof piece?.imageBase64 === "string" ? piece.imageBase64.trim() : "";
  if (!file && !existingBase64) return;

  updatePiece(piece.id, "scanError", "");

  const rawPieceName = typeof piece?.piece_name === "string" ? piece.piece_name.trim() : "";
  const rawCanonical = typeof piece?.canonical_title === "string" ? piece.canonical_title.trim() : "";
  const nameSegments = splitSegmentedTitle(rawPieceName);
  const canonicalSegments = splitSegmentedTitle(rawCanonical);

  const hasThreePartName = nameSegments.length >= 3;
  const hasThreePartCanonical = canonicalSegments.length >= 3;

  const humanIdentifier = hasThreePartName
    ? nameSegments[nameSegments.length - 1]
    : rawPieceName;

  const resolvedStoneFamily =
    piece?.stone_family ||
    sharedFields?.stone_family ||
    (hasThreePartCanonical ? canonicalSegments[0] : "") ||
    (hasThreePartName ? nameSegments[0] : "");

  const resolvedOriginLocation =
    piece?.origin_location ||
    sharedFields?.origin_location ||
    (hasThreePartCanonical ? canonicalSegments[1] : "") ||
    (hasThreePartName ? nameSegments[1] : "");

  const resolvedCollectionName =
    piece?.collection_name ||
    sharedFields?.collection_name ||
    "";

  const resolvedOriginHandle =
    piece?.origin_handle ||
    piece?.origin_page_handle ||
    sharedFields?.origin_handle ||
    sharedFields?.origin_page_handle ||
    "";

  const resolvedOriginStory =
    piece?.origin_story ||
    sharedFields?.origin_story ||
    "";

  // Only supply a 3-segment title in pieceName/productTitle so autofill.jsx does not
  // split a 1-segment human ID into segments[0] (stone_family) + "Unknown Origin".
  let segmentedTitleForRoute = "";
  if (hasThreePartCanonical) {
    segmentedTitleForRoute = rawCanonical;
  } else if (hasThreePartName) {
    segmentedTitleForRoute = rawPieceName;
  } else if (resolvedStoneFamily && resolvedOriginLocation && humanIdentifier) {
    segmentedTitleForRoute = `${resolvedStoneFamily} — ${resolvedOriginLocation} — ${humanIdentifier}`;
  }

  const submitScan = (base64Data, mimeType) => {
    const payload = {
      intent: "visionScan",
      pieceId: piece.id,
      pieceName: segmentedTitleForRoute,
      ...(segmentedTitleForRoute ? { productTitle: segmentedTitleForRoute } : {}),
      ...(humanIdentifier ? { humanPieceId: humanIdentifier } : {}),
      ...(resolvedStoneFamily ? { stone_family: resolvedStoneFamily } : {}),
      ...(resolvedOriginLocation ? { origin_location: resolvedOriginLocation } : {}),
      ...(resolvedCollectionName ? { collection_name: resolvedCollectionName } : {}),
      ...(resolvedOriginHandle ? { origin_handle: resolvedOriginHandle } : {}),
      ...(resolvedOriginStory ? { origin_story: resolvedOriginStory } : {}),
      ...(piece?.dimensions_mm ? { dimensions_mm: piece.dimensions_mm } : {}),
      ...(piece?.weight_grams ? { weight_grams: piece.weight_grams } : {}),
      ...(piece?.shipping_weight_oz ? { shipping_weight_oz: piece.shipping_weight_oz } : {}),
      ...(piece?.honest_flaws_and_character ? { honest_flaws_and_character: piece.honest_flaws_and_character } : {}),
      ...(piece?.character_marks ? { character_marks: piece.character_marks } : {}),
      ...(piece?.wire_material || sharedFields?.wire_material
        ? { wire_material: piece?.wire_material || sharedFields?.wire_material }
        : {}),
      imageBase64: base64Data,
      imageMimeType: mimeType || "image/jpeg"
    };

    visionFetcher.submit(
      payload,
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  };

  if (!file && existingBase64) {
    const cleanBase64 = existingBase64.includes(",")
      ? existingBase64.split(",")[1]
      : existingBase64;
    submitScan(cleanBase64, piece.imageMimeType || "image/jpeg");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const resultStr = typeof reader.result === "string" ? reader.result : "";
    const base64 = resultStr.includes(",") ? resultStr.split(",")[1] : resultStr;
    submitScan(base64, file.type || piece.imageMimeType || "image/jpeg");
  };
  reader.onerror = () => {
    updatePiece(piece.id, "scanError", "Failed to read file");
    if (typeof setErrorMessage === "function") {
      setErrorMessage("Failed to read photo file");
    }
  };
  reader.readAsDataURL(file);
}

export async function handleGenerateDescription({ sharedFields, pieces, descFetcher }) {
  const targetPiece = pieces?.[0] || {};
  const rawPieceName = typeof targetPiece.piece_name === "string" ? targetPiece.piece_name.trim() : "";
  const segs = splitSegmentedTitle(rawPieceName);
  const cleanIdentifier = segs.length >= 3 ? segs[segs.length - 1] : rawPieceName;

  const { conflict: ooakConflict, value: canonicalOoak } = resolveCanonicalOoak(sharedFields, targetPiece);

  const sanitizedShared = { ...(sharedFields || {}) };
  const sanitizedPiece = {
    ...targetPiece,
    piece_name: cleanIdentifier
  };

  delete sanitizedShared.is_ooak;
  delete sanitizedPiece.is_ooak;

  if (ooakConflict) {
    delete sanitizedShared.is_one_of_a_kind;
    delete sanitizedPiece.is_one_of_a_kind;
    sanitizedPiece.ooak_conflict = "Conflicting OOAK values detected; verify before publishing.";
  } else if (canonicalOoak) {
    sanitizedShared.is_one_of_a_kind = canonicalOoak;
    sanitizedPiece.is_one_of_a_kind = canonicalOoak;
  }

  descFetcher.submit(
    {
      intent: "generateDescription",
      ...(targetPiece.id ? { pieceId: targetPiece.id } : {}),
      sharedFields: JSON.stringify(sanitizedShared),
      pieceData: JSON.stringify(sanitizedPiece)
    },
    { method: "post", action: "/app/meta-injector-autofill" }
  );
}

// ==========================================
// STRICT METAFIELD SCHEMA MAP (Aligned with API)
// ==========================================
const METAFIELD_SCHEMA = {
  // SHOPIFY TAXONOMY (Requires metaobject_reference)
  "color-pattern": { namespace: "shopify", type: "list.metaobject_reference" },
  "age-group": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-type": { namespace: "shopify", type: "metaobject_reference" },
  "target-gender": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-material": { namespace: "shopify", type: "metaobject_reference" },
  "necklace-design": { namespace: "shopify", type: "metaobject_reference" },
  "condition": { namespace: "shopify", type: "metaobject_reference" },
  "crystal-system": { namespace: "shopify", type: "metaobject_reference" },
  "mineral-class": { namespace: "shopify", type: "metaobject_reference" },
  "geological-era": { namespace: "shopify", type: "metaobject_reference" },
  "rock-composition": { namespace: "shopify", type: "metaobject_reference" },
  "rock-formation": { namespace: "shopify", type: "metaobject_reference" },
  "chain-link-type": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-finding-type": { namespace: "shopify", type: "metaobject_reference" },

  // CUSTOM NAMESPACE (Strict Types)
  // 🟢 FIX: Aligned material to custom / single_line_text_field
  "material": { namespace: "custom", type: "single_line_text_field" },
  "is_one_of_a_kind": { namespace: "custom", type: "single_line_text_field" },
  "wire_material": { namespace: "custom", type: "single_line_text_field" },
  "weight_grams": { namespace: "custom", type: "number_decimal" },
  "shipping_weight_oz": { namespace: "custom", type: "number_decimal" },
  "price": { namespace: "custom", type: "number_decimal" },
  
  // HEAVY TEXT BLOCKS (Multi-line)
  "origin_story": { namespace: "custom", type: "multi_line_text_field" },
  "honest_flaws_and_character": { namespace: "custom", type: "multi_line_text_field" },
  "honest_flaws": { namespace: "custom", type: "multi_line_text_field" },

  "character_marks": { namespace: "custom", type: "list.single_line_text_field" },
  
  // 🟢 ORIGIN HANDLE MAPPED CORRECTLY 
  "origin_page_handle": { namespace: "custom", type: "single_line_text_field" },
  "origin_handle": { namespace: "custom", type: "single_line_text_field" }
};

const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "primary_use",
  "is_ooak", "rarity", "authenticity",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
  "custom.cut_and_shape", "custom.stone_shape", "custom.primary_use",
  "custom.is_ooak", "custom.rarity", "custom.authenticity",
  "shopify.rarity", "shopify.authenticity"
];

export function buildMetafieldsJson(sharedFields, piece) {
  const allFields = { ...(sharedFields || {}), ...(piece || {}) };

  // Resolve single canonical OOAK destination: custom.is_one_of_a_kind
  // Preserve explicit answers; omit on conflict rather than guessing or assuming Yes.
  const { value: resolvedOoak, conflict: ooakConflict } = resolveCanonicalOoak(sharedFields, piece);
  delete allFields.is_ooak;
  delete allFields["custom.is_ooak"];
  if (ooakConflict) {
    console.warn("[buildMetafieldsJson] Conflicting OOAK values detected between is_ooak and is_one_of_a_kind; omitting to prevent unverified write.");
    delete allFields.is_one_of_a_kind;
  } else if (resolvedOoak) {
    allFields.is_one_of_a_kind = resolvedOoak;
  } else {
    delete allFields.is_one_of_a_kind;
  }

  // Ensure piece_name remains the exact human identifier, never the full 3-part customer title
  if (typeof allFields.piece_name === "string") {
    const segs = splitSegmentedTitle(allFields.piece_name);
    if (segs.length >= 3) {
      allFields.piece_name = segs[segs.length - 1];
    }
  }

  // Omit internal UI state, transient scan payloads, and native product fields from custom metafields
  const omitKeys = [
    "id",
    "pieceId",
    "productId",
    "status",
    "previousStatus",
    "canonical_title",
    "shopify_title",
    "product_title",
    "official_name",
    "handle",
    "seo_title",
    "title_tag",
    "description_tag",
    "alt_text",
    "imageAlts",
    "altValidationErrors",
    "standardized_candidates",
    "review_proposals",
    "verifiedGeoValues",
    "geoSource",
    "debug_origin",
    "needs_new_origin_page",
    "origin_name",
    "ooak_conflict",
    "photoFiles",
    "photoPreviewUrls",
    "stagedResourceUrls",
    "stagedUploadIndex",
    "scanError",
    "isUploading",
    "scanToken",
    "photos",
    "imageBase64",
    "imageMimeType",
    "generated_description" // This belongs in body_html, not a metafield
  ];

  const metaArr = [];
  const emittedTargets = new Set();

  Object.keys(allFields).forEach(rawKey => {
    if (
      omitKeys.includes(rawKey) ||
      RETIRED_KEYS.includes(rawKey) ||
      allFields[rawKey] === undefined ||
      allFields[rawKey] === null ||
      allFields[rawKey] === ""
    ) {
      return;
    }

    const val = allFields[rawKey];
    if (typeof val === "object" && !Array.isArray(val)) {
      return;
    }

    const cleanKey = rawKey.replace(/^(custom|shopify)\./, "");
    if (omitKeys.includes(cleanKey) || RETIRED_KEYS.includes(cleanKey)) {
      return;
    }

    // 2. LOOKUP SCHEMA (Default to custom string if not mapped above)
    const schema = METAFIELD_SCHEMA[cleanKey] || METAFIELD_SCHEMA[rawKey] || { namespace: "custom", type: "single_line_text_field" };
    let finalValue = Array.isArray(val) ? JSON.stringify(val) : String(val).trim();
    if (!finalValue) return;

    // Prevent invalid non-GID strings from being written to shopify.* metaobject_reference fields
    if (schema.namespace === "shopify" && schema.type.includes("metaobject_reference")) {
      if (schema.type.startsWith("list.")) {
        try {
          const parsedArr = finalValue.startsWith("[") ? JSON.parse(finalValue) : [finalValue];
          const validGids = Array.isArray(parsedArr)
            ? parsedArr.map(v => String(v).trim()).filter(v => /^gid:\/\/shopify\/Metaobject\//i.test(v))
            : [];
          if (validGids.length === 0) return;
          finalValue = JSON.stringify(validGids);
        } catch (e) {
          return;
        }
      } else {
        if (!/^gid:\/\/shopify\/Metaobject\//i.test(finalValue)) return;
      }
    }
    // 3. FORMAT VALUE BASED ON SHOPIFY DATA TYPE
    else if (schema.type.startsWith("list.")) {
      // Shopify requires list fields to be stringified JSON arrays
      try {
        if (finalValue.startsWith("[") && finalValue.endsWith("]")) {
          JSON.parse(finalValue); // Verify it is a valid array
        } else {
          finalValue = JSON.stringify([finalValue]); // Wrap plain string into JSON array
        }
      } catch (e) {
        finalValue = JSON.stringify([finalValue]);
      }
    } else if (schema.type === "number_decimal") {
      // Strip out words like "grams", leaving only numbers and decimals
      // Never derive shipping_weight_oz from weight_grams
      const num = finalValue.replace(/[^\d.-]/g, "");
      if (!num || isNaN(parseFloat(num))) return;
      finalValue = num;
    }

    const targetId = `${schema.namespace}.${cleanKey}`;
    if (emittedTargets.has(targetId)) return;
    emittedTargets.add(targetId);

    metaArr.push({
      namespace: schema.namespace,
      key: cleanKey,
      type: schema.type,
      value: finalValue
    });
  });

  return JSON.stringify(metaArr);
}

export function buildTitle(sharedFields, piece) {
  const canonicalSegments = splitSegmentedTitle(piece?.canonical_title);
  if (canonicalSegments.length >= 3) {
    return `${canonicalSegments[0]} — ${canonicalSegments[1]} — ${canonicalSegments[canonicalSegments.length - 1]}`;
  }

  const rawName = typeof piece?.piece_name === "string" ? piece.piece_name.trim() : "";
  const nameSegments = splitSegmentedTitle(rawName);
  if (nameSegments.length >= 3) {
    const familyFromTitle = sharedFields?.stone_family || nameSegments[0] || "Unknown Stone";
    const originFromTitle = sharedFields?.collection_name
      ? sharedFields.collection_name.replace(/\s+Collection$/i, "").trim()
      : (sharedFields?.origin_location || nameSegments[1] || "Unknown Origin");
    const tailIdentifier = nameSegments[nameSegments.length - 1] || "New Piece";
    return `${familyFromTitle} — ${originFromTitle} — ${tailIdentifier}`;
  }

  const family = sharedFields?.stone_family || piece?.stone_family || "Unknown Stone";
  const origin = sharedFields?.collection_name
    ? sharedFields.collection_name.replace(/\s+Collection$/i, "").trim()
    : (sharedFields?.origin_location || piece?.origin_location || "Unknown Origin");
  const name = rawName || "New Piece";

  // EXACT ORIGINAL DASHES PRESERVED — DO NOT TOUCH
  return `${family} — ${origin} — ${name}`;
}
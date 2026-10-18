// ==========================================================================
// ROCKHOUND STUDIO — INTAKE HELPER FUNCTIONS
// File: app/routes/app.meta-injector.intake-helpers.jsx
// (Universal 62-Capability Registry Contract & Explicit Field Guards)
// ==========================================================================
//
// CALLER ARGUMENT LIMITATION NOTE:
// In app/routes/app.meta-injector.injector.jsx (L181), handleScanGeminiPhotos
// calls handleScanPhoto({ piece, updatePiece: handlePieceChange, visionFetcher, setErrorMessage, sharedFields })
// passing latestShared.current. When piece holds only a 1-segment human
// identifier (e.g. "BQH-1", "BQH-2", "bob") and no piece.canonical_title,
// handleScanPhoto only sends a 3-segment title as productTitle when available,
// and sends a 1-segment human ID under humanPieceId so segments[0] does not
// misclassify the human ID as stone_family.

import {
  CANONICAL_CAPABILITY_FIELDS,
  COMPATIBILITY_ADAPTER_FIELDS,
  EXCLUDED_CATALOG_FIELDS,
  DUPLICATE_ALIAS_CATALOG_FIELDS,
  PROTECTED_DATA_ENTRIES,
  UNVERIFIED_PROPOSED_MEASUREMENT_KEYS,
  PRODUCER_ALIGNMENT_PENDING_KEYS
} from "../utils/meta-injector.constants.jsx";

function splitSegmentedTitle(val) {
  if (typeof val !== "string") return [];
  const normalized = val
    .replace(/ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â/g, "—")
    .replace(/Ã¢â‚¬â€/g, "—")
    .trim();
  if (!normalized) return [];
  // Require whitespace around dash delimiters so internal hyphens in human IDs (e.g. BQH-1, BQH-2) are never split
  return normalized.split(/\s+[—–-]\s+/).map(s => s.trim()).filter(Boolean);
}

function hasMeaningfulValue(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return true;
  if (typeof val === "number") return !Number.isNaN(val);
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return false;
  return String(val).trim() !== "";
}

function normalizeOoakToken(val) {
  if (val === undefined || val === null) return "";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  const str = String(val).trim();
  if (!str) return "";
  const lower = str.toLowerCase();
  if (
    lower === "yes" ||
    lower === "true" ||
    lower === "1" ||
    lower === "ooak" ||
    lower === "one-of-a-kind" ||
    lower === "one of a kind" ||
    lower.startsWith("yes —") ||
    lower.startsWith("yes -")
  ) {
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

function isLikelyStoneBearingContext(sharedFields = {}, piece = {}) {
  const materialVal = String(
    piece?.material ?? sharedFields?.material ?? piece?.stone_family ?? sharedFields?.stone_family ?? ""
  ).trim();
  if (materialVal) return true;

  const useText = String(
    piece?.primary_use ?? sharedFields?.primary_use ?? piece?.product_type ?? sharedFields?.product_type ?? ""
  ).toLowerCase();
  if (
    useText.includes("chain") ||
    useText.includes("cord") ||
    useText.includes("bail") ||
    useText.includes("finding") ||
    useText.includes("accessory")
  ) {
    return false;
  }
  return false;
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

  // Prefer canonical material first, then legacy stone_family companion, then 3-part title segment.
  // Never use primary_medium (metal/hardware) as a fallback for stone identity.
  const resolvedStoneIdentity =
    (hasMeaningfulValue(piece?.material) ? String(piece.material).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.material) ? String(sharedFields.material).trim() : "") ||
    (hasMeaningfulValue(piece?.stone_family) ? String(piece.stone_family).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.stone_family) ? String(sharedFields.stone_family).trim() : "") ||
    (hasThreePartCanonical ? canonicalSegments[0] : "") ||
    (hasThreePartName ? nameSegments[0] : "");

  const resolvedOriginLocation =
    (hasMeaningfulValue(piece?.origin_location) ? String(piece.origin_location).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.origin_location) ? String(sharedFields.origin_location).trim() : "") ||
    (hasThreePartCanonical ? canonicalSegments[1] : "") ||
    (hasThreePartName ? nameSegments[1] : "");

  const resolvedCollectionName =
    (hasMeaningfulValue(piece?.collection_name) ? String(piece.collection_name).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.collection_name) ? String(sharedFields.collection_name).trim() : "");

  const resolvedOriginPageHandle =
    (hasMeaningfulValue(piece?.origin_page_handle) ? String(piece.origin_page_handle).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.origin_page_handle) ? String(sharedFields.origin_page_handle).trim() : "") ||
    (hasMeaningfulValue(piece?.origin_handle) ? String(piece.origin_handle).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.origin_handle) ? String(sharedFields.origin_handle).trim() : "");

  const resolvedOriginStory =
    (hasMeaningfulValue(piece?.origin_story) ? String(piece.origin_story).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.origin_story) ? String(sharedFields.origin_story).trim() : "");

  const resolvedCutAndShape =
    (hasMeaningfulValue(piece?.cut_and_shape) ? String(piece.cut_and_shape).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.cut_and_shape) ? String(sharedFields.cut_and_shape).trim() : "") ||
    (hasMeaningfulValue(piece?.cut_type) ? String(piece.cut_type).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.cut_type) ? String(sharedFields.cut_type).trim() : "");

  const resolvedStoneShape =
    (hasMeaningfulValue(piece?.stone_shape) ? String(piece.stone_shape).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.stone_shape) ? String(sharedFields.stone_shape).trim() : "");

  const resolvedColor =
    (hasMeaningfulValue(piece?.color) ? String(piece.color).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.color) ? String(sharedFields.color).trim() : "");

  // Only supply a 3-segment title in pieceName/productTitle so autofill.jsx does not
  // split a 1-segment human ID (e.g. BQH-1, BQH-2, bob) into segments[0] (stone_family) + "Unknown Origin".
  let segmentedTitleForRoute = "";
  if (hasThreePartCanonical) {
    segmentedTitleForRoute = rawCanonical;
  } else if (hasThreePartName) {
    segmentedTitleForRoute = rawPieceName;
  } else if (resolvedStoneIdentity && resolvedOriginLocation && humanIdentifier) {
    segmentedTitleForRoute = `${resolvedStoneIdentity} - ${resolvedOriginLocation} - ${humanIdentifier}`;
  }

  const submitScan = (base64Data, mimeType) => {
    const payload = {
      intent: "visionScan",
      pieceId: piece.id,
      pieceName: segmentedTitleForRoute,
      ...(segmentedTitleForRoute ? { productTitle: segmentedTitleForRoute } : {}),
      ...(humanIdentifier ? { humanPieceId: humanIdentifier } : {}),
      ...(resolvedStoneIdentity ? { material: resolvedStoneIdentity, stone_family: resolvedStoneIdentity } : {}),
      ...(resolvedOriginLocation ? { origin_location: resolvedOriginLocation } : {}),
      ...(resolvedCollectionName ? { collection_name: resolvedCollectionName } : {}),
      ...(resolvedOriginPageHandle ? { origin_page_handle: resolvedOriginPageHandle, origin_handle: resolvedOriginPageHandle } : {}),
      ...(resolvedOriginStory ? { origin_story: resolvedOriginStory } : {}),
      ...(resolvedCutAndShape ? { cut_and_shape: resolvedCutAndShape } : {}),
      ...(resolvedStoneShape ? { stone_shape: resolvedStoneShape } : {}),
      ...(resolvedColor ? { color: resolvedColor } : {}),
      ...(hasMeaningfulValue(piece?.dimensions_mm) ? { dimensions_mm: piece.dimensions_mm } : {}),
      ...(hasMeaningfulValue(piece?.weight_grams) ? { weight_grams: piece.weight_grams } : {}),
      ...(hasMeaningfulValue(piece?.shipping_weight_oz) ? { shipping_weight_oz: piece.shipping_weight_oz } : {}),
      ...(hasMeaningfulValue(piece?.honest_flaws_and_character) ? { honest_flaws_and_character: piece.honest_flaws_and_character } : {}),
      ...(hasMeaningfulValue(piece?.character_marks) ? { character_marks: piece.character_marks } : {}),
      ...(hasMeaningfulValue(piece?.wire_material) || hasMeaningfulValue(sharedFields?.wire_material)
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

  // Provide transient legacy companions for the AI route only when needed, without overwriting canonical values
  // and never copying primary_medium (metal/hardware) into material or stone_family.
  const canonicalMaterial =
    (hasMeaningfulValue(sanitizedPiece.material) ? String(sanitizedPiece.material).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.material) ? String(sanitizedShared.material).trim() : "") ||
    (hasMeaningfulValue(sanitizedPiece.stone_family) ? String(sanitizedPiece.stone_family).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.stone_family) ? String(sanitizedShared.stone_family).trim() : "");

  if (canonicalMaterial) {
    if (!hasMeaningfulValue(sanitizedShared.material)) sanitizedShared.material = canonicalMaterial;
    if (!hasMeaningfulValue(sanitizedShared.stone_family)) sanitizedShared.stone_family = canonicalMaterial;
  }

  const canonicalOriginHandle =
    (hasMeaningfulValue(sanitizedPiece.origin_page_handle) ? String(sanitizedPiece.origin_page_handle).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.origin_page_handle) ? String(sanitizedShared.origin_page_handle).trim() : "") ||
    (hasMeaningfulValue(sanitizedPiece.origin_handle) ? String(sanitizedPiece.origin_handle).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.origin_handle) ? String(sanitizedShared.origin_handle).trim() : "");

  if (canonicalOriginHandle) {
    if (!hasMeaningfulValue(sanitizedShared.origin_page_handle)) sanitizedShared.origin_page_handle = canonicalOriginHandle;
    if (!hasMeaningfulValue(sanitizedShared.origin_handle)) sanitizedShared.origin_handle = canonicalOriginHandle;
  }

  const canonicalCutAndShape =
    (hasMeaningfulValue(sanitizedPiece.cut_and_shape) ? String(sanitizedPiece.cut_and_shape).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.cut_and_shape) ? String(sanitizedShared.cut_and_shape).trim() : "") ||
    (hasMeaningfulValue(sanitizedPiece.cut_type) ? String(sanitizedPiece.cut_type).trim() : "") ||
    (hasMeaningfulValue(sanitizedShared.cut_type) ? String(sanitizedShared.cut_type).trim() : "");

  if (canonicalCutAndShape) {
    if (!hasMeaningfulValue(sanitizedPiece.cut_and_shape)) sanitizedPiece.cut_and_shape = canonicalCutAndShape;
  }

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

// ==========================================================================
// EXPLICIT CANONICAL CAPABILITY REGISTRY MAP (Derived from constants.jsx)
// ==========================================================================

const BLOCKED_COMPAT_EXCLUDED_ALIAS_PROTECTED_KEYS = (() => {
  const blocked = new Set([
    "id",
    "pieceId",
    "productId",
    "status",
    "previousStatus",
    "canonical_title",
    "shopify_title",
    "product_title",
    "official_name",
    "custom.official_name",
    "handle",
    "seo_title",
    "custom.seo_title",
    "title_tag",
    "global.title_tag",
    "description_tag",
    "global.description_tag",
    "alt_text",
    "custom.alt_text",
    "imageAlts",
    "altValidationErrors",
    "standardized_candidates",
    "custom.standardized_candidates",
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
    "generated_description",
    "custom.generated_description",
    "native_title",
    "native_description",
    "native_seo_title",
    "native_seo_description",
    "native_price",
    "native_shipping_weight",
    "native_image_alt",
    "price",
    "custom.price",
    "shipping_weight_oz",
    "custom.shipping_weight_oz",
    "is_ooak",
    "custom.is_ooak",
    "stone_family",
    "custom.stone_family",
    "primary_medium",
    "custom.primary_medium",
    "origin_handle",
    "custom.origin_handle",
    "cut_type",
    "custom.cut_type",
    "target_gender",
    "custom.target_gender",
    "age_group",
    "custom.age_group",
    "condition",
    "custom.condition",
    "custom_product",
    "custom.custom_product",
    "origin_story",
    "custom.origin_story",
    "stone_story",
    "custom.stone_story",
    "collection_story",
    "custom.collection_story",
    "rescued_by",
    "custom.rescued_by",
    "character_marks",
    "custom.character_marks",
    "honest_flaws_and_character",
    "custom.honest_flaws_and_character",
    "honest_flaws",
    "custom.honest_flaws",
    "necklace_design",
    "custom.necklace_design",
    "primary_use",
    "custom.primary_use",
    "rarity",
    "custom.rarity",
    "authenticity",
    "custom.authenticity",
    "artist_notes",
    "custom.artist_notes",
    "bench_notes",
    "custom.bench_notes",
    "handcrafted_by",
    "custom.handcrafted_by"
  ]);

  const registerBlockedField = (f) => {
    if (!f) return;
    if (f.key) {
      blocked.add(f.key);
      if (!f.key.includes(".") && (!f.namespace || f.namespace === "custom")) {
        blocked.add(`custom.${f.key}`);
      }
    }
    if (f.metaKey && f.namespace) {
      blocked.add(`${f.namespace}.${f.metaKey}`);
    }
    if (f.registryIdentity) {
      blocked.add(f.registryIdentity);
    }
  };

  (COMPATIBILITY_ADAPTER_FIELDS || []).forEach(registerBlockedField);
  (EXCLUDED_CATALOG_FIELDS || []).forEach(registerBlockedField);
  (DUPLICATE_ALIAS_CATALOG_FIELDS || []).forEach(registerBlockedField);
  (PROTECTED_DATA_ENTRIES || []).forEach(entry => {
    if (entry?.identity) blocked.add(entry.identity);
  });
  (UNVERIFIED_PROPOSED_MEASUREMENT_KEYS || []).forEach(k => blocked.add(k));
  (PRODUCER_ALIGNMENT_PENDING_KEYS || []).forEach(k => blocked.add(k));

  return blocked;
})();

const CANONICAL_METAFIELD_CONTRACTS_BY_KEY = (() => {
  const map = new Map();

  (CANONICAL_CAPABILITY_FIELDS || []).forEach(field => {
    if (!field) return;
    // Native capabilities are transported via dedicated top-level product/variant/media fields, not metafieldsJson
    if (field.owner === "native" || field.namespace === "native" || field.type === "native") {
      return;
    }

    const ns = field.metaConfig?.namespace || field.namespace || "custom";
    const metaKey = field.metaKey || field.key.replace(/^(custom|shopify|google|mm-google-shopping)\./, "");
    const resolvedType = field.metaConfig?.type || field.type;
    if (!ns || !metaKey || !resolvedType) return;

    const isHeldOrUnverified =
      field.mappingStatus === "pending_read_only" ||
      field.storageVerified === false ||
      field.writerVerified === false ||
      field.metaConfig?.definitionVerified === false ||
      field.producerAlignmentPending === true ||
      field.registryRole === "APPROVED_MEASUREMENT_ADDITION" ||
      field.owner === "variant_metafield" ||
      (field.registryOwner && field.registryOwner !== "PRODUCT") ||
      `${ns}.${metaKey}` === "mm-google-shopping.custom_product";

    const contract = {
      namespace: ns,
      key: metaKey,
      type: resolvedType,
      owner: field.owner || "metafield",
      registryOwner: field.registryOwner || "PRODUCT",
      registryIdentity: field.registryIdentity || `${ns}.${metaKey}`,
      isHeldOrUnverified
    };

    map.set(field.key, contract);
    map.set(metaKey, contract);
    map.set(`${ns}.${metaKey}`, contract);
    if (field.registryIdentity) {
      map.set(field.registryIdentity, contract);
    }
  });

  return map;
})();

export function buildMetafieldsJson(sharedFields, piece) {
  const safeShared = sharedFields || {};
  const safePiece = piece || {};
  const allFields = { ...safeShared, ...safePiece };

  // 1. Resolve single canonical OOAK destination: custom.is_one_of_a_kind
  // Preserve explicit answers; omit on conflict rather than guessing or assuming Yes.
  const { value: resolvedOoak, conflict: ooakConflict } = resolveCanonicalOoak(safeShared, safePiece);
  delete allFields.is_ooak;
  delete allFields["custom.is_ooak"];
  if (ooakConflict) {
    console.warn("[buildMetafieldsJson] Conflicting OOAK values detected between is_ooak and is_one_of_a_kind; omitting to prevent unverified write.");
    delete allFields.is_one_of_a_kind;
    delete allFields["custom.is_one_of_a_kind"];
  } else if (hasMeaningfulValue(resolvedOoak)) {
    allFields.is_one_of_a_kind = resolvedOoak;
  } else {
    delete allFields.is_one_of_a_kind;
    delete allFields["custom.is_one_of_a_kind"];
  }

  // 2. Canonical stone identity: custom.material
  // Prefer canonical material. Only fall back to legacy stone_family when material is blank.
  // NEVER fall back to primary_medium (which can hold metal/setting hardware).
  const explicitMaterial = hasMeaningfulValue(safePiece.material)
    ? safePiece.material
    : (hasMeaningfulValue(safeShared.material) ? safeShared.material : "");
  const fallbackStoneFamily = hasMeaningfulValue(safePiece.stone_family)
    ? safePiece.stone_family
    : (hasMeaningfulValue(safeShared.stone_family) ? safeShared.stone_family : "");

  if (hasMeaningfulValue(explicitMaterial)) {
    allFields.material = explicitMaterial;
  } else if (hasMeaningfulValue(fallbackStoneFamily)) {
    allFields.material = fallbackStoneFamily;
  }
  delete allFields.stone_family;
  delete allFields["custom.stone_family"];
  delete allFields.primary_medium;
  delete allFields["custom.primary_medium"];

  // 3. Canonical origin page handle: custom.origin_page_handle (companion: origin_handle)
  const explicitOriginPageHandle = hasMeaningfulValue(safePiece.origin_page_handle)
    ? safePiece.origin_page_handle
    : (hasMeaningfulValue(safeShared.origin_page_handle) ? safeShared.origin_page_handle : "");
  const fallbackOriginHandle = hasMeaningfulValue(safePiece.origin_handle)
    ? safePiece.origin_handle
    : (hasMeaningfulValue(safeShared.origin_handle) ? safeShared.origin_handle : "");

  if (hasMeaningfulValue(explicitOriginPageHandle)) {
    allFields.origin_page_handle = explicitOriginPageHandle;
  } else if (hasMeaningfulValue(fallbackOriginHandle)) {
    allFields.origin_page_handle = fallbackOriginHandle;
  }
  delete allFields.origin_handle;
  delete allFields["custom.origin_handle"];

  // 4. Canonical cut and shape: custom.cut_and_shape (companion: cut_type)
  const explicitCutAndShape = hasMeaningfulValue(safePiece.cut_and_shape)
    ? safePiece.cut_and_shape
    : (hasMeaningfulValue(safeShared.cut_and_shape) ? safeShared.cut_and_shape : "");
  const fallbackCutType = hasMeaningfulValue(safePiece.cut_type)
    ? safePiece.cut_type
    : (hasMeaningfulValue(safeShared.cut_type) ? safeShared.cut_type : "");

  if (hasMeaningfulValue(explicitCutAndShape)) {
    allFields.cut_and_shape = explicitCutAndShape;
  } else if (hasMeaningfulValue(fallbackCutType)) {
    allFields.cut_and_shape = fallbackCutType;
  }
  delete allFields.cut_type;
  delete allFields["custom.cut_type"];

  // 5. Ensure piece_name remains the exact human identifier (e.g. bob, BQH-1, BQH-2), never the full 3-part customer title
  if (typeof allFields.piece_name === "string") {
    const segs = splitSegmentedTitle(allFields.piece_name);
    if (segs.length >= 3) {
      allFields.piece_name = segs[segs.length - 1];
    }
  }

  const metaArr = [];
  const emittedTargets = new Set();

  Object.keys(allFields).forEach(rawKey => {
    const val = allFields[rawKey];
    if (!hasMeaningfulValue(val)) {
      return;
    }

    if (BLOCKED_COMPAT_EXCLUDED_ALIAS_PROTECTED_KEYS.has(rawKey)) {
      return;
    }

    const contract = CANONICAL_METAFIELD_CONTRACTS_BY_KEY.get(rawKey);
    // Strict registry contract: never catch-all unknown/unmapped keys into custom.single_line_text_field
    if (!contract) {
      return;
    }

    // Fail closed on all explicit storage, writer, producer-alignment, pending_read_only, channel-flag, and variant-owner holds
    if (
      contract.isHeldOrUnverified ||
      BLOCKED_COMPAT_EXCLUDED_ALIAS_PROTECTED_KEYS.has(contract.registryIdentity) ||
      BLOCKED_COMPAT_EXCLUDED_ALIAS_PROTECTED_KEYS.has(`${contract.namespace}.${contract.key}`)
    ) {
      return;
    }

    if (contract.key === "collection_date" && /^(n\/a|none|unknown)$/i.test(String(val).trim())) {
      return;
    }

    let finalValue = Array.isArray(val) ? JSON.stringify(val) : String(val).trim();
    if (!finalValue) return;

    // Validate shopify.* list.metaobject_reference / metaobject_reference values without flattening reference lists
    if (contract.namespace === "shopify" && contract.type.includes("metaobject_reference")) {
      if (contract.type.startsWith("list.")) {
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
    } else if (contract.type.startsWith("list.")) {
      try {
        if (finalValue.startsWith("[") && finalValue.endsWith("]")) {
          const parsed = JSON.parse(finalValue);
          if (!Array.isArray(parsed) || parsed.length === 0) return;
          finalValue = JSON.stringify(parsed.map(item => String(item).trim()).filter(Boolean));
          if (finalValue === "[]") return;
        } else {
          finalValue = JSON.stringify([finalValue]);
        }
      } catch (e) {
        finalValue = JSON.stringify([finalValue]);
      }
    } else if (contract.type === "number_decimal") {
      // Preserve numeric 0 or positive decimals; never derive shipping_weight_oz from weight_grams
      const numStr = finalValue.replace(/[^\d.-]/g, "");
      const parsedNum = Number(numStr);
      if (numStr === "" || Number.isNaN(parsedNum)) return;
      finalValue = String(parsedNum);
    } else if (contract.type === "boolean") {
      const lower = finalValue.toLowerCase();
      if (lower === "true" || lower === "yes" || lower === "1") {
        finalValue = "true";
      } else if (lower === "false" || lower === "no" || lower === "0") {
        finalValue = "false";
      } else {
        return;
      }
    }

    const targetId = `${contract.namespace}.${contract.key}`;
    if (emittedTargets.has(targetId)) return;
    emittedTargets.add(targetId);

    metaArr.push({
      namespace: contract.namespace,
      key: contract.key,
      type: contract.type,
      value: finalValue
    });
  });

  return JSON.stringify(metaArr);
}

export function buildTitle(sharedFields, piece) {
  // 1. Preserve an existing explicit canonical_title unchanged
  const rawCanonical = typeof piece?.canonical_title === "string" ? piece.canonical_title.trim() : "";
  if (rawCanonical) {
    return rawCanonical;
  }

  // 2. If piece_name itself was entered as a 3-segment title, assemble with approved " - " separators
  const rawName = typeof piece?.piece_name === "string" ? piece.piece_name.trim() : "";
  const nameSegments = splitSegmentedTitle(rawName);

  // Prefer canonical material first, then legacy stone_family companion (never primary_medium)
  const stoneIdentity =
    (hasMeaningfulValue(piece?.material) ? String(piece.material).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.material) ? String(sharedFields.material).trim() : "") ||
    (hasMeaningfulValue(piece?.stone_family) ? String(piece.stone_family).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.stone_family) ? String(sharedFields.stone_family).trim() : "");

  const originSegment =
    (hasMeaningfulValue(sharedFields?.collection_name)
      ? String(sharedFields.collection_name).replace(/\s+Collection$/i, "").trim()
      : "") ||
    (hasMeaningfulValue(piece?.collection_name)
      ? String(piece.collection_name).replace(/\s+Collection$/i, "").trim()
      : "") ||
    (hasMeaningfulValue(piece?.origin_location) ? String(piece.origin_location).trim() : "") ||
    (hasMeaningfulValue(sharedFields?.origin_location) ? String(sharedFields.origin_location).trim() : "");

  if (nameSegments.length >= 3) {
    const segFamily = stoneIdentity || nameSegments[0];
    const segOrigin = originSegment || nameSegments[1];
    const tailIdentifier = nameSegments[nameSegments.length - 1];
    return [segFamily, segOrigin, tailIdentifier].filter(Boolean).join(" - ");
  }

  // 3. Do not force 3-segment stone-title formatting onto non-stone accessories or when stone identity is absent
  if (!isLikelyStoneBearingContext(sharedFields, piece) && !stoneIdentity) {
    if (rawName && originSegment) {
      return `${originSegment} - ${rawName}`;
    }
    return rawName || originSegment || "";
  }

  // 4. Assemble stone product title from available verified segments using " - " without inventing "Unknown Stone" / "Unknown Origin"
  const assembledSegments = [stoneIdentity, originSegment, rawName].filter(Boolean);
  return assembledSegments.join(" - ");
}
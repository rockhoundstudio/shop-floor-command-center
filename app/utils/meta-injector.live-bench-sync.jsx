// ==========================================================================
// ROCKHOUND STUDIO — TAB 3 LIVE BENCH SNAPSHOT & TELEMETRY SYNC MODULE
// File: app/utils/meta-injector.live-bench-sync.jsx
// (Extracted Pure Snapshot/UI Audit Builders & Live/Manual Telemetry Sync)
// ==========================================================================

import { useState, useCallback, useEffect, useRef } from "react";
import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  TAB3_PARKED_DRAWER_HEADING,
  TAB3_INSPECTABLE_TEMPLATE_GROUPS
} from "./meta-injector.constants.jsx";
import {
  parseMetaobjectGidArray,
  buildCanonicalCandidateBundle,
  evaluateProductReferenceMatchReadiness,
  validArray,
  validObj
} from "./meta-injector.standardized.jsx";
import {
  UNSELECTED_DRAFT_STORAGE_KEY,
  NATIVE_FIELDS,
  NATIVE_ALIAS_MAP,
  DESTINATION_SPECIFIC_APPROVAL_KEYS,
  HIDDEN_CONTEXT_FIELDS,
  resolveApprovalStorageKey,
  isParkedExcludedKey,
  getDynamicSections
} from "./meta-injector.matrix-domain.jsx";

export const TELEMETRY_PUBLISH_ENDPOINT = "/api/meta-injector-telemetry";
export const TELEMETRY_PUBLISH_TIMEOUT_MS = 8000;
export const LIVE_BENCH_SYNC_DEBOUNCE_MS = 380;
export const LIVE_BENCH_MODE = "live_bench_state";
export const MAX_PUBLISHED_CAPTURE_SIGNATURES = 64;

export const RAW_COMPANION_LOOKUP_KEYS = Object.freeze({
  "custom.material": ["custom.stone_family", "stone_family", "custom.primary_medium", "primary_medium"],
  "custom.is_one_of_a_kind": ["custom.is_ooak", "custom.is_ooak"],
  "custom.origin_page_handle": ["custom.origin_handle", "origin_handle"],
  "custom.cut_and_shape": ["custom.cut_type", "cut_type"]
});

export function createInitialUnselectedDraftManifest() {
  return {
    isUnselectedDraft: true,
    currentMetafields: {},
    nativeTargets: null,
    repairPlan: {},
    metadata: {},
    verifiedGeoValues: {}
  };
}

export function createInitialDraftSourceContext() {
  return {
    rawSeedInput: "",
    explicitTitleOverride: "",
    primary_use: "",
    origin_story: "",
    honest_flaws_and_character: ""
  };
}

export const isExactProductGid = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/Product\/[0-9]+$/.test(val.trim());

export const isValidTelemetryPacketForProduct = (packet, targetProductId) =>
  Boolean(
    packet &&
    typeof packet === "object" &&
    typeof packet.productId === "string" &&
    (!targetProductId || packet.productId === targetProductId) &&
    typeof packet.fullText === "string" &&
    packet.fullText.length > 0 &&
    Array.isArray(packet.parts) &&
    packet.parts.length > 0
  );

export function generateStableBenchSessionId() {
  const randA = Math.random().toString(36).slice(2, 10);
  const randB = Math.random().toString(36).slice(2, 10);
  return `bsess_${Date.now().toString(36)}_${randA}${randB}`;
}

export function redactRecognizableCredentialStrings(val) {
  if (typeof val !== "string" || val.length === 0) return val;
  return val
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]{20,}/gi, "Bearer [REDACTED]")
    .replace(/\bshpat_[a-fA-F0-9]{32,}\b/g, "shpat_[REDACTED]")
    .replace(/\bshpca_[a-fA-F0-9]{32,}\b/g, "shpca_[REDACTED]")
    .replace(/\bshpss_[a-fA-F0-9]{32,}\b/g, "shpss_[REDACTED]")
    .replace(/\bshpua_[a-fA-F0-9]{32,}\b/g, "shpua_[REDACTED]")
    .replace(/\bshprt_[a-fA-F0-9]{32,}\b/g, "shprt_[REDACTED]");
}

export function computeQuickTextDigest(text) {
  const str = typeof text === "string" ? text : "";
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= code + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  return `${str.length}:${h1.toString(16)}:${h2.toString(16)}`;
}

export function buildImmutableCaptureSignature(packet) {
  if (!packet || typeof packet !== "object") return "";
  return [
    typeof packet.productId === "string" ? packet.productId.trim() : "",
    typeof packet.capturedAt === "string" ? packet.capturedAt.trim() : "",
    typeof packet.mode === "string" ? packet.mode.trim() : "",
    typeof packet.sectionKey === "string" ? packet.sectionKey.trim() : "",
    typeof packet.sectionLabel === "string" ? packet.sectionLabel.trim() : "",
    typeof packet.runIdentity === "string" ? packet.runIdentity.trim() : "",
    typeof packet.runTimestamp === "string" ? packet.runTimestamp.trim() : "",
    computeQuickTextDigest(packet.fullText)
  ].join("|");
}

export function sanitizeSafePublishMessage(rawMsg, fallbackMsg) {
  if (typeof rawMsg !== "string") return fallbackMsg;
  const trimmed = rawMsg.trim();
  if (!trimmed) return fallbackMsg;
  if (/<[a-z!/][\s\S]*>/i.test(trimmed)) return fallbackMsg;
  const redacted = redactRecognizableCredentialStrings(trimmed);
  const singleLine = redacted.replace(/\s+/g, " ");
  return singleLine.length > 220 ? `${singleLine.slice(0, 220)}...` : singleLine;
}

export function inspectRawStoredFieldBaseline(key, data, meta = null) {
  const safeData = data || {};
  const currentMetafields = validObj(safeData.currentMetafields);
  const nativeTargets = safeData.nativeTargets || null;
  const variants = Array.isArray(nativeTargets?.variants?.edges)
    ? nativeTargets.variants.edges
    : [];
  const isSingleVariantComplete =
    variants.length === 1 &&
    nativeTargets?.variants?.pageInfo?.hasNextPage === false &&
    nativeTargets?.isComplete === true &&
    !nativeTargets?.loadError;

  if (key === "native_image_alt") {
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: null,
      rawNote: "Zero-image capability placeholder; not a stored Shopify field."
    };
  }

  if (key.startsWith("native_image_alts_")) {
    const imageId = key.replace("native_image_alts_", "");
    const mediaEdges = Array.isArray(nativeTargets?.media?.edges)
      ? nativeTargets.media.edges
      : null;
    if (!mediaEdges) {
      return {
        rawEvidenceAvailable: false,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: imageId,
        rawNote: "nativeTargets.media.edges unavailable."
      };
    }
    const matchedEdge = mediaEdges.find((e) => e?.node?.id === imageId);
    if (!matchedEdge || !matchedEdge.node) {
      return {
        rawEvidenceAvailable: false,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: imageId,
        rawNote: "MediaImage node not found in loaded nativeTargets."
      };
    }
    const rawAlt =
      typeof matchedEdge.node.alt === "string"
        ? redactRecognizableCredentialStrings(matchedEdge.node.alt)
        : null;
    return {
      rawEvidenceAvailable: true,
      rawStoredExists: Boolean(rawAlt && rawAlt.trim() !== ""),
      rawStoredValue: rawAlt,
      rawSourceKey: imageId,
      rawNote: null
    };
  }

  if (key === "native_title" || key === "shopify_title") {
    if (typeof nativeTargets?.productTitle === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.productTitle);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.productTitle",
        rawNote: null
      };
    }
    if (typeof safeData.canonicalFields?.shopify_title === "string") {
      const cleanVal = redactRecognizableCredentialStrings(safeData.canonicalFields.shopify_title);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "canonicalFields.shopify_title",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.productTitle",
      rawNote: "Product title baseline not present on manifest."
    };
  }

  if (key === "native_description") {
    if (typeof nativeTargets?.descriptionHtml === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.descriptionHtml);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.descriptionHtml",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.descriptionHtml",
      rawNote: "nativeTargets.descriptionHtml not present on manifest."
    };
  }

  if (key === "native_seo_title") {
    if (nativeTargets?.seo && typeof nativeTargets.seo.title === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.seo.title);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.seo.title",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: Boolean(nativeTargets?.seo && Object.prototype.hasOwnProperty.call(nativeTargets.seo, "title")),
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.seo.title",
      rawNote: nativeTargets?.seo && Object.prototype.hasOwnProperty.call(nativeTargets.seo, "title")
        ? null
        : "nativeTargets.seo.title not present on manifest."
    };
  }

  if (key === "native_seo_description") {
    if (nativeTargets?.seo && typeof nativeTargets.seo.description === "string") {
      const cleanVal = redactRecognizableCredentialStrings(nativeTargets.seo.description);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: cleanVal.trim() !== "",
        rawStoredValue: cleanVal,
        rawSourceKey: "nativeTargets.seo.description",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: Boolean(nativeTargets?.seo && Object.prototype.hasOwnProperty.call(nativeTargets.seo, "description")),
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.seo.description",
      rawNote: nativeTargets?.seo && Object.prototype.hasOwnProperty.call(nativeTargets.seo, "description")
        ? null
        : "nativeTargets.seo.description not present on manifest."
    };
  }

  if (key === "native_price" || key === "price") {
    if (isSingleVariantComplete) {
      const rawPrice = variants[0]?.node?.price ?? null;
      const cleanPrice =
        rawPrice !== null && rawPrice !== undefined
          ? redactRecognizableCredentialStrings(String(rawPrice))
          : null;
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: Boolean(cleanPrice && cleanPrice.trim() !== ""),
        rawStoredValue: cleanPrice,
        rawSourceKey: "nativeTargets.variants[0].price",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.variants[0].price",
      rawNote: "Single complete variant baseline unavailable."
    };
  }

  if (key === "native_shipping_weight") {
    if (isSingleVariantComplete) {
      const w = variants[0]?.node?.inventoryItem?.measurement?.weight;
      if (w && w.value !== undefined && w.value !== null) {
        return {
          rawEvidenceAvailable: true,
          rawStoredExists: true,
          rawStoredValue: { value: w.value, unit: w.unit || null },
          rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
          rawNote: null
        };
      }
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: false,
        rawStoredValue: null,
        rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
        rawNote: null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: "nativeTargets.variants[0].inventoryItem.measurement.weight",
      rawNote: "Single complete variant weight baseline unavailable."
    };
  }

  // Variant-owned metafields (PRODUCTVARIANT): never flatten into product-level currentMetafields
  const isVariantOwnedMetafield = Boolean(
    meta?.isVariantMetafieldHold ||
      meta?.owner === "variant_metafield" ||
      (meta?.registryOwner === "PRODUCTVARIANT" &&
        meta?.owner !== "native" &&
        meta?.namespace !== "native" &&
        !key.startsWith("native_") &&
        !NATIVE_FIELDS.includes(key))
  );

  if (isVariantOwnedMetafield) {
    const bd = meta?.baselineDescriptor || null;
    if (bd && bd.evidenceAvailable) {
      const sanitizedVarRaw =
        typeof bd.rawValue === "string"
          ? redactRecognizableCredentialStrings(bd.rawValue)
          : (bd.rawValue !== undefined ? bd.rawValue : null);
      const varNonBlank =
        sanitizedVarRaw !== null &&
        sanitizedVarRaw !== undefined &&
        (typeof sanitizedVarRaw === "string"
          ? sanitizedVarRaw.trim() !== "" && sanitizedVarRaw.trim() !== "[]"
          : Array.isArray(sanitizedVarRaw)
            ? sanitizedVarRaw.length > 0
            : true);
      return {
        rawEvidenceAvailable: true,
        rawStoredExists: varNonBlank,
        rawStoredValue: sanitizedVarRaw,
        rawSourceKey: bd.sourceKey || key,
        rawNote: bd.note || null
      };
    }
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: key,
      rawNote:
        bd?.note ||
        "Variant-owned metafield (PRODUCTVARIANT) baseline is not loaded in product-level currentMetafields."
    };
  }

  const hasCurrentMetafieldsMap = Boolean(
    safeData.currentMetafields && typeof safeData.currentMetafields === "object"
  );
  if (!hasCurrentMetafieldsMap) {
    return {
      rawEvidenceAvailable: false,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: key,
      rawNote: "currentMetafields map unavailable on manifest."
    };
  }

  const isParkedEntry = Boolean(
    meta?.isParkedExcluded ||
      meta?.registryRole === "EXCLUDED_INPUT" ||
      isParkedExcludedKey(key)
  );

  let matchedKey = null;
  let rawVal = undefined;

  if (Object.prototype.hasOwnProperty.call(currentMetafields, key)) {
    matchedKey = key;
    rawVal = currentMetafields[key];
  } else if (!key.includes(".") && Object.prototype.hasOwnProperty.call(currentMetafields, `custom.${key}`)) {
    matchedKey = `custom.${key}`;
    rawVal = currentMetafields[`custom.${key}`];
  }

  const rawStringTrimmed =
    rawVal === undefined || rawVal === null
      ? ""
      : typeof rawVal === "string"
        ? rawVal.trim()
        : JSON.stringify(rawVal);

  // Never consult canonical read companions for parked/excluded entries
  if (
    !isParkedEntry &&
    (!matchedKey || rawStringTrimmed === "" || rawStringTrimmed === "[]") &&
    RAW_COMPANION_LOOKUP_KEYS[key]
  ) {
    for (const compKey of RAW_COMPANION_LOOKUP_KEYS[key]) {
      if (Object.prototype.hasOwnProperty.call(currentMetafields, compKey)) {
        const compVal = currentMetafields[compKey];
        if (compVal !== undefined && compVal !== null && String(compVal).trim() !== "") {
          matchedKey = compKey;
          rawVal = compVal;
          break;
        }
      }
    }
  }

  if (rawVal === undefined || rawVal === null) {
    return {
      rawEvidenceAvailable: true,
      rawStoredExists: false,
      rawStoredValue: null,
      rawSourceKey: matchedKey,
      rawNote:
        key === "custom.collection_date"
          ? 'No stored metafield value in Shopify (UI displays "N/A" as a display convention, not a stored string).'
          : null
    };
  }

  const sanitizedRaw =
    typeof rawVal === "string"
      ? redactRecognizableCredentialStrings(rawVal)
      : rawVal;
  const nonBlank =
    typeof sanitizedRaw === "string"
      ? sanitizedRaw.trim() !== "" && sanitizedRaw.trim() !== "[]"
      : Array.isArray(sanitizedRaw)
        ? sanitizedRaw.length > 0
        : true;

  return {
    rawEvidenceAvailable: true,
    rawStoredExists: nonBlank,
    rawStoredValue: sanitizedRaw,
    rawSourceKey: matchedKey,
    rawNote: null
  };
}

export function buildMeasuredUiAuditSnapshot(productId, measurementsState, options = {}) {
  const allowUnselectedPreview = Boolean(options?.allowUnselectedPreview);
  const isUnselectedPreviewTarget = allowUnselectedPreview && productId === null;

  if (!isUnselectedPreviewTarget && (!productId || !isExactProductGid(productId))) {
    return null;
  }

  if (
    !measurementsState ||
    typeof measurementsState !== "object" ||
    measurementsState.productId !== (isUnselectedPreviewTarget ? null : productId) ||
    !measurementsState.bySection ||
    typeof measurementsState.bySection !== "object"
  ) {
    return null;
  }

  const bySection = measurementsState.bySection;
  const measuredEntries = {};
  let measuredSectionCount = 0;

  for (const [secTitle, rec] of Object.entries(bySection)) {
    const rawDescCount =
      typeof rec?.descriptorCount === "number" && Number.isFinite(rec.descriptorCount)
        ? rec.descriptorCount
        : typeof rec?.renderedCount === "number" && Number.isFinite(rec.renderedCount)
          ? rec.renderedCount
          : null;
    const rawDescKeys = Array.isArray(rec?.descriptorKeys)
      ? rec.descriptorKeys
      : Array.isArray(rec?.renderedKeys)
        ? rec.renderedKeys
        : null;

    if (!rec || typeof rec !== "object" || rawDescCount === null || !rawDescKeys) {
      continue;
    }

    const safeDescriptorKeys = rawDescKeys.filter(
      (k) => typeof k === "string" && k.length > 0 && k.length <= 200
    );
    const safeFullInventoryKeys = Array.isArray(rec.fullInventoryKeys)
      ? rec.fullInventoryKeys.filter(
          (k) => typeof k === "string" && k.length > 0 && k.length <= 200
        )
      : safeDescriptorKeys;
    const rawFullInventoryCount =
      typeof rec.fullInventoryRowCount === "number" && Number.isFinite(rec.fullInventoryRowCount)
        ? rec.fullInventoryRowCount
        : safeFullInventoryKeys.length;
    const hasMountedDomCount =
      typeof rec.mountedDomRowCount === "number" && Number.isFinite(rec.mountedDomRowCount);
    const safeMountedDomKeys = Array.isArray(rec.mountedDomKeys)
      ? rec.mountedDomKeys.filter(
          (k) => typeof k === "string" && k.length > 0 && k.length <= 200
        )
      : null;

    measuredEntries[secTitle] = {
      measurementStatus: "measured",
      measurementKind:
        typeof rec.measurementKind === "string"
          ? rec.measurementKind
          : "scoped_dom_ref_and_descriptor_audit",
      isParkedGroup: Boolean(rec.isParkedGroup),
      activeFilter: typeof rec.activeFilter === "string" ? rec.activeFilter : "All",
      isExpanded: typeof rec.isExpanded === "boolean" ? rec.isExpanded : null,
      sectionDomMounted:
        typeof rec.sectionDomMounted === "boolean" ? rec.sectionDomMounted : null,
      rowsContainerDomMounted:
        typeof rec.rowsContainerDomMounted === "boolean"
          ? rec.rowsContainerDomMounted
          : null,
      logicalCount:
        typeof rec.logicalCount === "number" && Number.isFinite(rec.logicalCount)
          ? rec.logicalCount
          : null,
      fullInventoryRowCount: rawFullInventoryCount,
      fullInventoryKeys: safeFullInventoryKeys,
      fullInventoryMediaControlCount:
        typeof rec.fullInventoryMediaControlCount === "number" &&
        Number.isFinite(rec.fullInventoryMediaControlCount)
          ? rec.fullInventoryMediaControlCount
          : 0,
      fullInventoryHasZeroImagePlaceholder: Boolean(rec.fullInventoryHasZeroImagePlaceholder),
      renderedCount: rawDescCount,
      renderedKeys: safeDescriptorKeys,
      descriptorCount: rawDescCount,
      descriptorKeys: safeDescriptorKeys,
      mountedDomRowCount: hasMountedDomCount ? rec.mountedDomRowCount : null,
      mountedDomKeys: safeMountedDomKeys,
      mediaControlCount:
        typeof rec.mediaControlCount === "number" && Number.isFinite(rec.mediaControlCount)
          ? rec.mediaControlCount
          : 0,
      hasZeroImagePlaceholder: Boolean(rec.hasZeroImagePlaceholder),
      mountedDomMediaControlCount:
        typeof rec.mountedDomMediaControlCount === "number" &&
        Number.isFinite(rec.mountedDomMediaControlCount)
          ? rec.mountedDomMediaControlCount
          : null,
      mountedDomHasZeroImagePlaceholder:
        typeof rec.mountedDomHasZeroImagePlaceholder === "boolean"
          ? rec.mountedDomHasZeroImagePlaceholder
          : null,
      cssVisibilityMeasured: Boolean(rec.cssVisibilityMeasured),
      viewportVisibilityMeasured: Boolean(rec.viewportVisibilityMeasured)
    };
    measuredSectionCount += 1;
  }

  if (measuredSectionCount === 0) {
    return null;
  }

  const expectedSectionHeadings = TAB3_INSPECTABLE_TEMPLATE_GROUPS.map((g) => g.heading).filter(
    (h) => typeof h === "string" && h.trim().length > 0
  );

  const sectionsReport = {};
  const unmeasuredSectionHeadings = [];
  let totalMeasuredFullInventoryRows = 0;
  let totalMeasuredDescriptorRows = 0;
  let totalMeasuredMountedDomRows = 0;
  let allMeasuredHaveMountedDomCount = true;
  let expandedSectionCount = 0;
  let collapsedSectionCount = 0;
  let totalMeasuredFullMediaControls = 0;
  let anyFullZeroImagePlaceholder = false;
  let totalMeasuredMediaControls = 0;
  let anyZeroImagePlaceholder = false;
  let totalMountedDomMediaControls = 0;
  let anyMountedDomZeroImagePlaceholder = false;
  let observedActiveFilter = "All";

  const accumulateSectionEntry = (entry) => {
    if (typeof entry.activeFilter === "string" && entry.activeFilter) {
      observedActiveFilter = entry.activeFilter;
    }
    totalMeasuredFullInventoryRows += entry.fullInventoryRowCount;
    totalMeasuredDescriptorRows += entry.descriptorCount;
    if (typeof entry.mountedDomRowCount === "number") {
      totalMeasuredMountedDomRows += entry.mountedDomRowCount;
    } else {
      allMeasuredHaveMountedDomCount = false;
    }
    if (entry.isExpanded === true) {
      expandedSectionCount += 1;
    } else if (entry.isExpanded === false) {
      collapsedSectionCount += 1;
    }
    totalMeasuredFullMediaControls += entry.fullInventoryMediaControlCount;
    if (entry.fullInventoryHasZeroImagePlaceholder) {
      anyFullZeroImagePlaceholder = true;
    }
    totalMeasuredMediaControls += entry.mediaControlCount;
    if (entry.hasZeroImagePlaceholder) {
      anyZeroImagePlaceholder = true;
    }
    if (typeof entry.mountedDomMediaControlCount === "number") {
      totalMountedDomMediaControls += entry.mountedDomMediaControlCount;
    }
    if (entry.mountedDomHasZeroImagePlaceholder) {
      anyMountedDomZeroImagePlaceholder = true;
    }
  };

  for (let i = 0; i < expectedSectionHeadings.length; i += 1) {
    const heading = expectedSectionHeadings[i];
    if (Object.prototype.hasOwnProperty.call(measuredEntries, heading)) {
      const entry = measuredEntries[heading];
      sectionsReport[heading] = entry;
      accumulateSectionEntry(entry);
    } else {
      sectionsReport[heading] = {
        measurementStatus: "not_measured",
        measurementKind: null,
        isParkedGroup: heading === TAB3_PARKED_DRAWER_HEADING,
        activeFilter: null,
        isExpanded: null,
        sectionDomMounted: null,
        rowsContainerDomMounted: null,
        logicalCount: null,
        fullInventoryRowCount: null,
        fullInventoryKeys: null,
        fullInventoryMediaControlCount: null,
        fullInventoryHasZeroImagePlaceholder: null,
        renderedCount: null,
        renderedKeys: null,
        descriptorCount: null,
        descriptorKeys: null,
        mountedDomRowCount: null,
        mountedDomKeys: null,
        mediaControlCount: null,
        hasZeroImagePlaceholder: null,
        mountedDomMediaControlCount: null,
        mountedDomHasZeroImagePlaceholder: null,
        cssVisibilityMeasured: false,
        viewportVisibilityMeasured: false
      };
      unmeasuredSectionHeadings.push(heading);
    }
  }

  for (const [secTitle, entry] of Object.entries(measuredEntries)) {
    if (!Object.prototype.hasOwnProperty.call(sectionsReport, secTitle)) {
      sectionsReport[secTitle] = entry;
      accumulateSectionEntry(entry);
    }
  }

  const totalKnownGroups = expectedSectionHeadings.length;
  const isComplete =
    totalKnownGroups > 0 &&
    unmeasuredSectionHeadings.length === 0 &&
    measuredSectionCount >= totalKnownGroups;

  return {
    productId: isUnselectedPreviewTarget ? null : productId,
    selectionState: isUnselectedPreviewTarget ? "unselected_preview" : "selected",
    activeFilter: observedActiveFilter,
    measurementKind: "scoped_dom_ref_and_descriptor_audit",
    cssVisibilityMeasured: false,
    viewportVisibilityMeasured: false,
    measurementCoverage: isComplete ? "complete" : "partial",
    measuredSectionCount,
    totalKnownTemplateGroups: totalKnownGroups,
    unmeasuredSectionCount: unmeasuredSectionHeadings.length,
    unmeasuredSections: unmeasuredSectionHeadings,
    expandedSectionCount,
    collapsedSectionCount,
    totalFullInventoryRows: isComplete ? totalMeasuredFullInventoryRows : null,
    measuredFullInventoryRowsSubtotal: totalMeasuredFullInventoryRows,
    totalRenderedRows: isComplete ? totalMeasuredDescriptorRows : null,
    measuredRenderedRowsSubtotal: totalMeasuredDescriptorRows,
    totalDescriptorRows: isComplete ? totalMeasuredDescriptorRows : null,
    measuredDescriptorRowsSubtotal: totalMeasuredDescriptorRows,
    totalMountedDomRows:
      isComplete && allMeasuredHaveMountedDomCount ? totalMeasuredMountedDomRows : null,
    measuredMountedDomRowsSubtotal: allMeasuredHaveMountedDomCount
      ? totalMeasuredMountedDomRows
      : null,
    fullInventoryMediaControlCount: totalMeasuredFullMediaControls,
    fullInventoryHasZeroImagePlaceholder: anyFullZeroImagePlaceholder,
    mediaControlCount: totalMeasuredMediaControls,
    hasZeroImagePlaceholder: anyZeroImagePlaceholder,
    mountedDomMediaControlCount: allMeasuredHaveMountedDomCount
      ? totalMountedDomMediaControls
      : null,
    mountedDomHasZeroImagePlaceholder: allMeasuredHaveMountedDomCount
      ? anyMountedDomZeroImagePlaceholder
      : null,
    devShowAllTemplateFieldsActive: Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS),
    sections: sectionsReport
  };
}

export function buildSelectedUnloadedLiveBenchPayload({
  benchSessionId,
  benchRevision,
  clientStateChangedAt,
  productId,
  productTitle,
  productQueueStatus
}) {
  const cleanTitle = redactRecognizableCredentialStrings(productTitle || "Not recorded") || "Not recorded";
  const runIdentity = "selected_manifest_not_loaded";
  const runTimestamp = "Manifest not loaded in browser";

  const structuredPayload = {
    schemaVersion: 1,
    stateKind: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    productTitle: cleanTitle,
    clientStateChangedAt,
    baselineLoadedAt: null,
    baselineEventKind: "manifest_not_loaded",
    baselineState: "unavailable_not_loaded",
    manifestLoaded: false,
    productQueueStatus: productQueueStatus || null,
    dataAuthorityNote:
      "Product is selected on the Tab 3 bench, but its Shopify manifest baseline has NOT been loaded into browser state yet. No field values, proposals, or baseline timestamps exist for this product in the current browser session.",
    runIdentity,
    runTimestamp,
    systemStatus: {
      shopifyReadStatus: "Not loaded",
      geminiStatus: "Not called",
      visionStatus: "Not called",
      geoLibraryStatus: "Not called",
      readBackStatus: "Not called",
      currentStage: "manifest_not_loaded",
      finalStageDisplay: "Selected (Manifest Not Loaded)",
      fetcherStateDisplay: "idle",
      loadingStateDisplay: "Idle",
      errorMessageDisplay: "None"
    },
    diagnosticsStats: null,
    manualEditedKeys: [],
    explicitlyApprovedKeys: [],
    keepOriginalKeys: [],
    standardizedReferenceState: {
      readinessState: "manifest_not_loaded",
      readinessReason: "Product manifest baseline has not been loaded yet.",
      stagedCandidateCount: 0,
      stagedCandidates: {},
      eligibleDestinationKeys: [],
      blockedDestinationKeys: [],
      lastMatchRequestId: null,
      lastMatchedAt: null,
      lastMatchSuccess: null,
      lastMatchIsComplete: null,
      productCategory: null
    },
    saveVerificationEvidence: {
      hasRepairAttemptInSession: false,
      lastRepairCompletedAt: null,
      lastRepairStatus: null,
      lastRepairSuccess: null,
      readBackVerified: null,
      fieldsUpdatedCount: null,
      verifiedDestinations: [],
      attemptedDestinations: [],
      blockedFields: {},
      conflicts: {},
      unresolvedChanges: {},
      note: "Product manifest is not loaded; no baseline or working field values are available."
    },
    sectionOrder: [],
    fieldsByKey: {}
  };

  const fullText = JSON.stringify(structuredPayload);

  const packet = {
    mode: LIVE_BENCH_MODE,
    sectionKey: LIVE_BENCH_MODE,
    sectionLabel: "LIVE BENCH FIELD STATE (MANIFEST NOT LOADED)",
    productId,
    productTitle: cleanTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientStateChangedAt,
    limitUsed: 400000,
    fullText,
    parts: [
      {
        index: 0,
        partNumber: 1,
        totalParts: 1,
        label: "LIVE BENCH FIELD STATE (MANIFEST NOT LOADED)",
        charCount: fullText.length
      }
    ],
    activePartIndex: 0,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  const liveState = {
    mode: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  return { packet, liveState };
}

export function buildUnselectedPreviewLiveBenchPayload({
  benchSessionId,
  benchRevision,
  clientStateChangedAt,
  draftManifest,
  draftSourceContext = null,
  approvals,
  manualEdits,
  getFieldMetadata,
  getDiagnosticsStats
}) {
  const previewData =
    draftManifest && typeof draftManifest === "object"
      ? draftManifest
      : createInitialUnselectedDraftManifest();
  const safeSourceContext =
    draftSourceContext && typeof draftSourceContext === "object"
      ? draftSourceContext
      : createInitialDraftSourceContext();
  const draftApprovalsMap = validObj(approvals?.[UNSELECTED_DRAFT_STORAGE_KEY]);
  const draftManualEditsMap = validObj(manualEdits?.[UNSELECTED_DRAFT_STORAGE_KEY]);
  const dynamicSections = getDynamicSections(previewData, { includeTab3InspectableInventory: true });
  const allConfigFields = dynamicSections.flatMap((sec) => sec.configFields || []);

  const serializePreviewFieldRow = (key, sectionHeading, sectionConfigFields = []) => {
    const meta = getFieldMetadata(
      key,
      previewData,
      null,
      approvals,
      sectionConfigFields.length > 0 ? sectionConfigFields : allConfigFields
    );
    const isParked = Boolean(meta.isParkedExcluded || meta.registryRole === "EXCLUDED_INPUT");
    const targetKey = isParked ? key : (NATIVE_ALIAS_MAP[key] || key);
    const approvalStorageKey = isParked ? key : resolveApprovalStorageKey(key);
    const isManualEdited = Boolean(
      !isParked &&
        (draftManualEditsMap[key] === true ||
          draftManualEditsMap[targetKey] === true ||
          draftManualEditsMap[approvalStorageKey] === true)
    );
    const isCollectionDateDisplayNa =
      (key === "custom.collection_date" || key === "collection_date") &&
      meta.currentVal === "N/A";

    return {
      key,
      targetKey,
      approvalKey: approvalStorageKey,
      section: sectionHeading,
      label: meta.label,
      type: meta.type,
      owner: meta.owner,
      namespace: meta.namespace,
      metaKey: meta.metaKey,
      control: meta.control || null,
      registryOwner: meta.registryOwner || "PRODUCT",
      registryIdentity: meta.registryIdentity || key,
      registryRole: meta.registryRole || (isParked ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION"),
      isParkedExcluded: isParked,
      rawStoredBaseline: {
        evidenceAvailable: false,
        exists: false,
        value: null,
        sourceKey: null,
        note: "Unsaved new-product draft / unselected template preview (no product selected or saved in Shopify; not a stored Shopify baseline)."
      },
      evaluatedBaseline: {
        currentExists: false,
        value: redactRecognizableCredentialStrings(meta.currentVal ?? ""),
        isDisplayOnlyPlaceholderOrNa: Boolean(
          meta.isImageAltCapabilityPlaceholder || isCollectionDateDisplayNa
        )
      },
      workingState: {
        isProposed: Boolean(meta.isProposed),
        proposalExists: Boolean(meta.proposalExists),
        proposalStatus: meta.proposalStatus || "Not provided",
        proposedValue: redactRecognizableCredentialStrings(meta.propVal ?? ""),
        isManualEdit: isManualEdited,
        isApproved: Boolean(meta.isApproved),
        isKeepOriginal: false,
        keepOriginalDecision: null,
        canKeepOriginal: false,
        isContentPreApproved: Boolean(meta.isContentPreApproved),
        preApprovalReason: meta.preApprovalReason || null,
        contentNeedsReview: Boolean(meta.contentNeedsReview),
        source: meta.source && meta.source !== "Not reported" ? meta.source : "Not reported",
        stage: meta.stage && meta.stage !== "Not reported" ? meta.stage : "unselected_draft"
      },
      statusAndHolds: {
        fieldStatus: meta.fieldStatus,
        isSupported: Boolean(meta.isSupported),
        hasLoadedBaseline: false,
        isBlockedAction: Boolean(meta.isBlockedAction),
        hasTechnicalBlock: Boolean(meta.hasTechnicalBlock),
        isActualBlockedProposal: Boolean(meta.isActualBlockedProposal),
        isManualOnly: Boolean(meta.isManualOnly),
        isOperatorOwned: Boolean(meta.isOperatorOwned),
        isPendingReadOnly: Boolean(meta.isPendingReadOnly),
        isParkedExcluded: isParked,
        registryRole: meta.registryRole || (isParked ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION"),
        registryOwner: meta.registryOwner || "PRODUCT",
        registryIdentity: meta.registryIdentity || key,
        isStandardizedAttribute: Boolean(meta.isStandardizedAttribute),
        isVerifiedStdDest: Boolean(meta.isVerifiedStdDest),
        isCategoryEligible: false,
        hasContractOrOwnerHold: Boolean(meta.hasContractOrOwnerHold),
        hasExplicitStorageHold: Boolean(meta.hasExplicitStorageHold),
        hasExplicitProducerHold: Boolean(meta.hasExplicitProducerHold),
        isChannelFlagReadOnly: Boolean(meta.isChannelFlagReadOnly),
        isVariantMetafieldHold: Boolean(meta.isVariantMetafieldHold),
        isImageAltCapabilityPlaceholder: Boolean(meta.isImageAltCapabilityPlaceholder),
        imageAltPlaceholderReason: meta.imageAltPlaceholderReason || null,
        applicability: meta.applicabilityState || null,
        reasons: Array.isArray(meta.reasons)
          ? meta.reasons.map((r) => redactRecognizableCredentialStrings(String(r)))
          : []
      },
      conflictsAndSaveEvidence: {
        conflictData: null,
        nativeDescConflictData: null,
        wasSubmittedInLastRepair: false,
        lastSubmittedValue: null
      }
    };
  };

  const fieldsByKey = {};
  const sectionOrder = [];

  // Dedicated Description Review companion row (custom.generated_description) + native_description
  fieldsByKey["custom.generated_description"] = serializePreviewFieldRow(
    "custom.generated_description",
    "Description Review",
    allConfigFields
  );

  for (let i = 0; i < dynamicSections.length; i += 1) {
    const sec = dynamicSections[i];
    const isParkedSection = Boolean(
      sec.isParkedGroup === true || sec.title === TAB3_PARKED_DRAWER_HEADING
    );
    const rawKeys = Array.isArray(sec.keys) ? sec.keys : [];
    // Keep compatibility custom.generated_description out of the 93-slot sectionOrder inventory,
    // while keeping custom.origin_story once inside the Parked / Excluded drawer.
    const secKeys = rawKeys.filter(
      (k) =>
        k !== "custom.generated_description" &&
        (isParkedSection || !HIDDEN_CONTEXT_FIELDS.includes(k))
    );
    sectionOrder.push({
      sectionTitle: sec.title,
      fieldKeys: secKeys
    });
    for (let j = 0; j < secKeys.length; j += 1) {
      const k = secKeys[j];
      fieldsByKey[k] = serializePreviewFieldRow(k, sec.title, sec.configFields || []);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(fieldsByKey, "native_description")) {
    fieldsByKey["native_description"] = serializePreviewFieldRow(
      "native_description",
      "Description Review",
      allConfigFields
    );
  }

  const diagnosticsStats =
    typeof getDiagnosticsStats === "function"
      ? getDiagnosticsStats(previewData)
      : null;

  const manualEditedKeysList = Object.keys(draftManualEditsMap).filter(
    (k) => draftManualEditsMap[k] === true
  );
  const explicitlyApprovedKeysList = Object.keys(draftApprovalsMap);
  const cleanRawSeedInput = redactRecognizableCredentialStrings(
    typeof safeSourceContext.rawSeedInput === "string" ? safeSourceContext.rawSeedInput : ""
  );
  const cleanExplicitTitleOverride = redactRecognizableCredentialStrings(
    typeof safeSourceContext.explicitTitleOverride === "string"
      ? safeSourceContext.explicitTitleOverride
      : ""
  );
  const cleanOriginStoryContext = redactRecognizableCredentialStrings(
    typeof safeSourceContext.origin_story === "string" ? safeSourceContext.origin_story : ""
  );
  const cleanFlawsContext = redactRecognizableCredentialStrings(
    typeof safeSourceContext.honest_flaws_and_character === "string"
      ? safeSourceContext.honest_flaws_and_character
      : ""
  );
  const hasSourceContextInput =
    cleanRawSeedInput.trim() !== "" ||
    cleanExplicitTitleOverride.trim() !== "" ||
    cleanOriginStoryContext.trim() !== "" ||
    cleanFlawsContext.trim() !== "";

  const hasUnsavedDraftChanges =
    manualEditedKeysList.length > 0 ||
    explicitlyApprovedKeysList.length > 0 ||
    hasSourceContextInput ||
    (diagnosticsStats && diagnosticsStats.proposed > 0);

  const runIdentity = hasUnsavedDraftChanges
    ? "unselected_new_product_draft"
    : "unselected_blank_template_preview";
  const runTimestamp = hasUnsavedDraftChanges
    ? "Unsaved new-product draft in browser (no product selected or saved)"
    : "Unselected new-product draft / template preview (no product selected)";

  const rawDraftTitle =
    previewData.repairPlan?.["shopify_title"] ||
    previewData.repairPlan?.["native_title"] ||
    cleanExplicitTitleOverride ||
    null;
  const cleanDraftTitle = rawDraftTitle
    ? redactRecognizableCredentialStrings(String(rawDraftTitle))
    : null;

  const structuredPayload = {
    schemaVersion: 1,
    stateKind: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "unselected_preview",
    productId: null,
    productTitle: cleanDraftTitle,
    clientStateChangedAt,
    baselineLoadedAt: null,
    baselineEventKind: "unselected_blank_preview",
    baselineState: "unselected_blank_preview",
    manifestLoaded: false,
    baselineSource: "unselected_blank_preview",
    workingState: hasUnsavedDraftChanges
      ? "unsaved_unselected_draft_bench"
      : "unselected_draft_template_preview",
    productQueueStatus: null,
    dataAuthorityNote:
      'Unselected new-product draft / template preview (DEV_SHOW_ALL_TEMPLATE_FIELDS=true, selectionState="unselected_preview", productId=null). No product is selected or loaded from Shopify. All 11 Tab 3 inspectable drawers and 93 logical slots (62 canonical working slots + 31 parked/excluded read-only entries, plus custom.generated_description in Description Review) are inspectable. Working capabilities without technical/owner/reference holds accept unsaved starting data, 3-part seed titleParse suggestions, and suggestion approvals in browser state, while rawStoredBaseline.exists is strictly false and no values are saved to Shopify.',
    runIdentity,
    runTimestamp,
    draftIntakeContext: {
      rawSeedInput: cleanRawSeedInput,
      explicitTitleOverride: cleanExplicitTitleOverride,
      stagedPieceIdentifier: redactRecognizableCredentialStrings(
        previewData.repairPlan?.["custom.piece_name"] || ""
      ),
      stagedNativeTitleProposal: cleanDraftTitle || "",
      originStorySourceContextPresent: Boolean(cleanOriginStoryContext.trim() !== ""),
      originStorySourceContextLength: cleanOriginStoryContext.length,
      originStorySourceContextPreview:
        cleanOriginStoryContext.length > 240
          ? `${cleanOriginStoryContext.slice(0, 240)}... (${cleanOriginStoryContext.length} chars)`
          : cleanOriginStoryContext,
      benchFlawsContextPresent: Boolean(cleanFlawsContext.trim() !== ""),
      note: "origin_story and bench flaw notes are isolated AI source context only and are never placed in repairPlan or treated as save candidates."
    },
    systemStatus: {
      shopifyReadStatus: "Unselected Draft (No Product Loaded)",
      geminiStatus: "Not called",
      visionStatus: "Not called",
      geoLibraryStatus: "Not called",
      readBackStatus: "Not called",
      currentStage: hasUnsavedDraftChanges ? "unselected_draft_editing" : "unselected_preview",
      finalStageDisplay: hasUnsavedDraftChanges
        ? "Unsaved New-Product Draft (Not Saved to Shopify)"
        : "Unselected New-Product Draft / Template Preview",
      fetcherStateDisplay: "idle",
      loadingStateDisplay: "Idle",
      errorMessageDisplay: "None"
    },
    diagnosticsStats,
    manualEditedKeys: manualEditedKeysList,
    explicitlyApprovedKeys: explicitlyApprovedKeysList,
    keepOriginalKeys: [],
    standardizedReferenceState: {
      readinessState: "unselected_preview",
      readinessReason:
        "No product is selected; standardized attributes require a saved product GID and category match and remain held read-only in unselected draft mode.",
      stagedCandidateCount: 0,
      stagedCandidates: {},
      eligibleDestinationKeys: [],
      blockedDestinationKeys: [],
      lastMatchRequestId: null,
      lastMatchedAt: null,
      lastMatchSuccess: null,
      lastMatchIsComplete: null,
      productCategory: null
    },
    saveVerificationEvidence: {
      hasRepairAttemptInSession: false,
      lastRepairCompletedAt: null,
      lastRepairStatus: null,
      lastRepairSuccess: null,
      readBackVerified: null,
      fieldsUpdatedCount: null,
      verifiedDestinations: [],
      attemptedDestinations: [],
      blockedFields: {},
      conflicts: {},
      unresolvedChanges: {},
      note: "Unselected draft state is unsaved browser working data only (productId=null); no Shopify product exists or has been written."
    },
    sectionOrder,
    fieldsByKey
  };

  const fullText = JSON.stringify(structuredPayload);

  const packet = {
    mode: LIVE_BENCH_MODE,
    sectionKey: LIVE_BENCH_MODE,
    sectionLabel: hasUnsavedDraftChanges
      ? "LIVE BENCH UNSAVED NEW-PRODUCT DRAFT (NO PRODUCT SELECTED)"
      : "LIVE BENCH BLANK TEMPLATE PREVIEW (NO PRODUCT SELECTED)",
    productId: null,
    productTitle: cleanDraftTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientStateChangedAt,
    limitUsed: 400000,
    fullText,
    parts: [
      {
        index: 0,
        partNumber: 1,
        totalParts: 1,
        label: hasUnsavedDraftChanges
          ? "LIVE BENCH UNSAVED NEW-PRODUCT DRAFT (NO PRODUCT SELECTED)"
          : "LIVE BENCH BLANK TEMPLATE PREVIEW (NO PRODUCT SELECTED)",
        charCount: fullText.length
      }
    ],
    activePartIndex: 0,
    benchSessionId,
    benchRevision,
    selectionState: "unselected_preview",
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  const liveState = {
    mode: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "unselected_preview",
    productId: null,
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  return { packet, liveState };
}

export function buildPureLiveBenchPayload({
  benchSessionId,
  benchRevision,
  clientStateChangedAt,
  baselineLoadedAt,
  baselineEventKind,
  productId,
  productTitle,
  data,
  approvals,
  keepOriginalDecisions,
  manualEdits,
  repairHistory,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  pendingReferenceMatch,
  getFieldMetadata,
  getSystemStatus,
  getDiagnosticsStats
}) {
  const safeData = data || {};
  const dynamicSections = getDynamicSections(safeData, { includeTab3InspectableInventory: true });
  const allConfigFields = dynamicSections.flatMap((sec) => sec.configFields || []);
  const productManualEdits = validObj(manualEdits?.[productId]);
  const productApprovals = validObj(approvals?.[productId]);
  const history = repairHistory?.[productId] || null;
  const lastSubmitted = submittedPayloads?.[productId] || null;
  const diag = validObj(safeData.diagnostics);

  const rawCandidates = standardizedCandidatesByProduct?.[productId] || {};
  const candidateBundle = buildCanonicalCandidateBundle(rawCandidates);
  const refMatchResult = referenceMatchResultsByProduct?.[productId] || null;
  const refMatchStatus = referenceMatchStatusByProduct?.[productId] || null;
  const refReadiness = evaluateProductReferenceMatchReadiness({
    productId,
    data: safeData,
    rawCandidates,
    refMatchResult,
    refMatchStatus,
    pendingReferenceMatch
  });

  const runIdentity =
    refMatchResult?.workflowRunId ||
    refMatchStatus?.workflowRunId ||
    refMatchResult?.requestId ||
    refMatchStatus?.requestId ||
    (history?.status ? `repair:${history.status}` : null) ||
    (diag.stage && diag.stage !== "Not reported" ? `stage:${diag.stage}` : "manifest_loaded");

  const runTimestamp =
    history?.completedAt ||
    refMatchResult?.matchedAt ||
    refMatchStatus?.updatedAt ||
    "No repair/match timestamp recorded";

  const activeKeepOriginalKeysSet = new Set();

  const serializeSingleFieldRow = (key, sectionHeading, sectionConfigFields = []) => {
    const meta = getFieldMetadata(
      key,
      safeData,
      productId,
      approvals,
      sectionConfigFields.length > 0 ? sectionConfigFields : allConfigFields
    );
    const isParked = Boolean(meta.isParkedExcluded || meta.registryRole === "EXCLUDED_INPUT");
    const targetKey = isParked ? key : (NATIVE_ALIAS_MAP[key] || key);
    const approvalStorageKey = isParked ? key : resolveApprovalStorageKey(key);
    const isDestSpecificApproval = DESTINATION_SPECIFIC_APPROVAL_KEYS.has(approvalStorageKey);
    const rawBaseline = inspectRawStoredFieldBaseline(key, safeData, meta);
    const isManualEdited = Boolean(
      !isParked &&
        (productManualEdits[key] === true || productManualEdits[targetKey] === true)
    );
    const isCollectionDateDisplayNa =
      (key === "custom.collection_date" || key === "collection_date") &&
      !rawBaseline.rawStoredExists &&
      meta.currentVal === "N/A";

    if (meta.isKeepOriginalSelected && approvalStorageKey) {
      activeKeepOriginalKeysSet.add(approvalStorageKey);
    }

    const verifiedMap = meta.stdEvaluation?.verifiedEntriesMap || null;
    let resolvedStandardizedLabels = null;
    if (meta.isStandardizedAttribute && verifiedMap instanceof Map && verifiedMap.size > 0) {
      const currentGids = parseMetaobjectGidArray(meta.currentVal);
      const proposedGids = parseMetaobjectGidArray(meta.propVal);
      resolvedStandardizedLabels = {
        currentEntries: currentGids.map((gid) => ({
          gid,
          label: verifiedMap.get(gid)?.displayName || verifiedMap.get(gid)?.label || null
        })),
        proposedEntries: proposedGids.map((gid) => ({
          gid,
          label: verifiedMap.get(gid)?.displayName || verifiedMap.get(gid)?.label || null
        }))
      };
    }

    const wasSubmittedInLastSave = Boolean(
      !isParked &&
        lastSubmitted &&
        (Object.prototype.hasOwnProperty.call(lastSubmitted, key) ||
          (!isDestSpecificApproval && Object.prototype.hasOwnProperty.call(lastSubmitted, targetKey)))
    );
    const lastSubmittedValue = wasSubmittedInLastSave
      ? redactRecognizableCredentialStrings(
          String(
            Object.prototype.hasOwnProperty.call(lastSubmitted, key)
              ? lastSubmitted[key]
              : lastSubmitted[targetKey]
          )
        )
      : null;

    return {
      key,
      targetKey,
      approvalKey: approvalStorageKey,
      section: sectionHeading,
      label: meta.label,
      type: meta.type,
      owner: meta.owner,
      namespace: meta.namespace,
      metaKey: meta.metaKey,
      control: meta.control || null,
      registryOwner: meta.registryOwner || "PRODUCT",
      registryIdentity: meta.registryIdentity || key,
      registryRole: meta.registryRole || (isParked ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION"),
      isParkedExcluded: isParked,
      rawStoredBaseline: {
        evidenceAvailable: rawBaseline.rawEvidenceAvailable,
        exists: rawBaseline.rawStoredExists,
        value: rawBaseline.rawStoredValue,
        sourceKey: rawBaseline.rawSourceKey,
        note: rawBaseline.rawNote
      },
      evaluatedBaseline: {
        currentExists: Boolean(meta.currentExists),
        value: redactRecognizableCredentialStrings(meta.currentVal ?? ""),
        isDisplayOnlyPlaceholderOrNa: Boolean(
          meta.isImageAltCapabilityPlaceholder || isCollectionDateDisplayNa
        )
      },
      workingState: {
        isProposed: Boolean(meta.isProposed),
        proposalExists: Boolean(meta.proposalExists),
        proposalStatus: meta.proposalStatus,
        proposedValue: redactRecognizableCredentialStrings(meta.propVal ?? ""),
        isManualEdit: isManualEdited,
        isApproved: Boolean(meta.isApproved),
        isKeepOriginal: Boolean(meta.isKeepOriginalSelected),
        keepOriginalDecision: meta.keepOriginalDecision || null,
        canKeepOriginal: Boolean(meta.canKeepOriginal),
        isContentPreApproved: Boolean(meta.isContentPreApproved),
        preApprovalReason: meta.preApprovalReason || null,
        contentNeedsReview: Boolean(meta.contentNeedsReview),
        source: meta.source || "Not reported",
        stage: meta.stage || "Not reported"
      },
      statusAndHolds: {
        fieldStatus: meta.fieldStatus,
        isSupported: Boolean(meta.isSupported),
        hasLoadedBaseline: Boolean(meta.hasLoadedBaseline),
        isBlockedAction: Boolean(meta.isBlockedAction),
        hasTechnicalBlock: Boolean(meta.hasTechnicalBlock),
        isActualBlockedProposal: Boolean(meta.isActualBlockedProposal),
        isManualOnly: Boolean(meta.isManualOnly),
        isOperatorOwned: Boolean(meta.isOperatorOwned),
        isPendingReadOnly: Boolean(meta.isPendingReadOnly),
        isParkedExcluded: isParked,
        registryRole: meta.registryRole || (isParked ? "EXCLUDED_INPUT" : "PRIMARY_CANDIDATE_DESTINATION"),
        registryOwner: meta.registryOwner || "PRODUCT",
        registryIdentity: meta.registryIdentity || key,
        isStandardizedAttribute: Boolean(meta.isStandardizedAttribute),
        isVerifiedStdDest: Boolean(meta.isVerifiedStdDest),
        isCategoryEligible: Boolean(meta.isCategoryEligible),
        hasContractOrOwnerHold: Boolean(meta.hasContractOrOwnerHold),
        hasExplicitStorageHold: Boolean(meta.hasExplicitStorageHold),
        hasExplicitProducerHold: Boolean(meta.hasExplicitProducerHold),
        isChannelFlagReadOnly: Boolean(meta.isChannelFlagReadOnly),
        isVariantMetafieldHold: Boolean(meta.isVariantMetafieldHold),
        isImageAltCapabilityPlaceholder: Boolean(meta.isImageAltCapabilityPlaceholder),
        imageAltPlaceholderReason: meta.imageAltPlaceholderReason || null,
        applicability: meta.applicabilityState || null,
        reasons: Array.isArray(meta.reasons)
          ? meta.reasons.map((r) => redactRecognizableCredentialStrings(String(r)))
          : []
      },
      conflictsAndSaveEvidence: {
        conflictData: meta.conflictData || null,
        nativeDescConflictData: meta.nativeDescConflictData || null,
        wasSubmittedInLastRepair: wasSubmittedInLastSave,
        lastSubmittedValue
      },
      ...(resolvedStandardizedLabels ? { standardizedEntryLabels: resolvedStandardizedLabels } : {})
    };
  };

  const fieldsByKey = {};
  const sectionOrder = [];

  // Dedicated Description Review companion row (custom.generated_description) + native_description
  const customDescRow = serializeSingleFieldRow(
    "custom.generated_description",
    "Description Review",
    allConfigFields
  );
  fieldsByKey["custom.generated_description"] = customDescRow;

  for (let i = 0; i < dynamicSections.length; i += 1) {
    const sec = dynamicSections[i];
    const isParkedSection = Boolean(
      sec.isParkedGroup === true || sec.title === TAB3_PARKED_DRAWER_HEADING
    );
    const rawKeys = Array.isArray(sec.keys) ? sec.keys : [];
    const secKeys = rawKeys.filter(
      (k) =>
        k !== "custom.generated_description" &&
        (isParkedSection || !HIDDEN_CONTEXT_FIELDS.includes(k))
    );
    sectionOrder.push({
      sectionTitle: sec.title,
      fieldKeys: secKeys
    });
    for (let j = 0; j < secKeys.length; j += 1) {
      const k = secKeys[j];
      fieldsByKey[k] = serializeSingleFieldRow(k, sec.title, sec.configFields || []);
    }
  }

  if (!Object.prototype.hasOwnProperty.call(fieldsByKey, "native_description")) {
    fieldsByKey["native_description"] = serializeSingleFieldRow(
      "native_description",
      "Description Review",
      allConfigFields
    );
  }

  const systemStatus = getSystemStatus();
  const diagnosticsStats = getDiagnosticsStats(safeData);

  const standardizedSummary = {
    readinessState: refReadiness.state,
    readinessReason: refReadiness.reason || null,
    stagedCandidateCount: candidateBundle.count,
    stagedCandidates: candidateBundle.ordered,
    eligibleDestinationKeys: refReadiness.eligibleDestinationKeys || [],
    blockedDestinationKeys: refReadiness.blockedDestinationKeys || [],
    lastMatchRequestId: refMatchResult?.requestId || refMatchStatus?.requestId || null,
    lastMatchedAt: refMatchResult?.matchedAt || null,
    lastMatchSuccess: refMatchResult ? Boolean(refMatchResult.success) : null,
    lastMatchIsComplete: refMatchResult ? Boolean(refMatchResult.isComplete) : null,
    productCategory: refMatchResult?.productCategory || safeData.productCategory || null
  };

  const saveVerificationSummary = {
    hasRepairAttemptInSession: Boolean(history),
    lastRepairCompletedAt: history?.completedAt || null,
    lastRepairStatus: history?.status || null,
    lastRepairSuccess: history?.success !== undefined ? Boolean(history.success) : null,
    readBackVerified:
      history?.readBackVerified !== undefined ? Boolean(history.readBackVerified) : null,
    fieldsUpdatedCount:
      history?.fieldsUpdated !== undefined ? history.fieldsUpdated : null,
    verifiedDestinations: validArray(history?.verifiedDestinations),
    attemptedDestinations: validArray(history?.attemptedDestinations),
    blockedFields: validObj(history?.blockedFields),
    conflicts: validObj(history?.conflicts),
    unresolvedChanges: validObj(history?.unresolvedChanges),
    note:
      "Live bench state synchronization to the Sidekick cache never saves changes to Shopify. Only verifiedDestinations with readBackVerified=true reflect confirmed Shopify writes."
  };

  const cleanTitle = redactRecognizableCredentialStrings(productTitle || "Not recorded") || "Not recorded";

  const structuredPayload = {
    schemaVersion: 1,
    stateKind: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    productTitle: cleanTitle,
    clientStateChangedAt,
    baselineLoadedAt: baselineLoadedAt || null,
    baselineEventKind: baselineEventKind || "last_loaded_manifest",
    baselineState: "loaded_in_browser",
    manifestLoaded: true,
    baselineSource: "last_loaded_manifest",
    workingState: "unsaved_browser_bench",
    dataAuthorityNote:
      "All field values are passive diagnostic data. rawStoredBaseline reflects the last manifest loaded into the browser (not a live Shopify GraphQL read at query time). workingState reflects unsaved browser proposals, manual edits, approvals, and keep-original decisions across all 93 logical Tab 3 slots (plus custom.generated_description in Description Review).",
    runIdentity,
    runTimestamp,
    systemStatus,
    diagnosticsStats,
    manualEditedKeys: Object.keys(productManualEdits).filter((k) => productManualEdits[k] === true),
    explicitlyApprovedKeys: Object.keys(productApprovals),
    keepOriginalKeys: Array.from(activeKeepOriginalKeysSet),
    standardizedReferenceState: standardizedSummary,
    saveVerificationEvidence: saveVerificationSummary,
    sectionOrder,
    fieldsByKey
  };

  const fullText = JSON.stringify(structuredPayload);

  const packet = {
    mode: LIVE_BENCH_MODE,
    sectionKey: LIVE_BENCH_MODE,
    sectionLabel: "LIVE BENCH FIELD STATE",
    productId,
    productTitle: cleanTitle,
    runIdentity,
    runTimestamp,
    capturedAt: clientStateChangedAt,
    limitUsed: 400000,
    fullText,
    parts: [
      {
        index: 0,
        partNumber: 1,
        totalParts: 1,
        label: "LIVE BENCH FIELD STATE",
        charCount: fullText.length
      }
    ],
    activePartIndex: 0,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    clientStateChangedAt,
    baselineLoadedAt: baselineLoadedAt || null
  };

  const liveState = {
    mode: LIVE_BENCH_MODE,
    benchSessionId,
    benchRevision,
    selectionState: "selected",
    productId,
    clientStateChangedAt,
    baselineLoadedAt: null
  };

  return { packet, liveState };
}

export function useLiveBenchTelemetrySync({
  isComponentMountedRef,
  activeBenchIdRef,
  sectionAuditMeasurementsRef,
  safeProducts,
  selectedBenchId,
  isLoadingData,
  productStates,
  manifestData,
  unselectedDraftManifest,
  draftSourceContext,
  approvals,
  keepOriginalDecisions,
  manualEdits,
  repairHistory,
  submittedPayloads,
  standardizedCandidatesByProduct,
  referenceMatchResultsByProduct,
  referenceMatchStatusByProduct,
  pendingReferenceMatch,
  sectionAuditMeasurements,
  setTelemetryPublishNotice,
  getFieldMetadata,
  getSystemStatus,
  getDiagnosticsStats
}) {
  // Latest evaluator callback refs so the debounced timeout always uses current evaluators
  // without causing unnecessary effect re-triggers on every render
  const getFieldMetadataRef = useRef(getFieldMetadata);
  getFieldMetadataRef.current = getFieldMetadata;

  const getSystemStatusRef = useRef(getSystemStatus);
  getSystemStatusRef.current = getSystemStatus;

  const getDiagnosticsStatsRef = useRef(getDiagnosticsStats);
  getDiagnosticsStatsRef.current = getDiagnosticsStats;

  // Manual capture deduplication and abort refs
  const publishDedupMapRef = useRef(new Map());
  const activePublishAbortRef = useRef(null);

  // Live bench session identity, monotonic revision counter, baseline timestamp tracker, and sync refs
  const benchSessionIdRef = useRef(null);
  if (!benchSessionIdRef.current) {
    benchSessionIdRef.current = generateStableBenchSessionId();
  }
  const benchRevisionRef = useRef(0);
  const nextBenchRevision = useCallback(() => {
    benchRevisionRef.current += 1;
    return benchRevisionRef.current;
  }, []);

  const [liveBenchSyncStatus, setLiveBenchSyncStatus] = useState(() => ({
    lifecycle: "unavailable",
    benchSessionId: benchSessionIdRef.current,
    benchRevision: null,
    selectionState: "none",
    productId: null,
    reportId: null,
    clientStateChangedAt: null,
    baselineLoadedAt: null,
    serverReceivedAt: null,
    errorCode: null,
    errorMessage: null
  }));

  const baselineMetaByProductRef = useRef({});
  const prevMetafieldsRefByProduct = useRef({});
  const prevNativeTargetsRefByProduct = useRef({});
  const prevRepairCompletedAtByProduct = useRef({});

  const liveSyncAbortRef = useRef(null);
  const liveSyncDebounceTimerRef = useRef(null);
  const lastLiveStateDigestRef = useRef("");
  const lastLiveSyncedDigestRef = useRef("");
  const lastLiveStateChangedAtRef = useRef(null);
  const lastLiveStateRevisionRef = useRef(0);
  const lastNotifiedSelectionClearRef = useRef(true);

  // Track actual baseline load and verified read-back timestamps when manifestData or repairHistory updates
  useEffect(() => {
    const nowIso = new Date().toISOString();
    const productIds = Object.keys(manifestData || {});
    for (let i = 0; i < productIds.length; i += 1) {
      const pid = productIds[i];
      const entry = manifestData[pid];
      if (!entry || typeof entry !== "object") continue;

      const prevMf = prevMetafieldsRefByProduct.current[pid];
      const prevNt = prevNativeTargetsRefByProduct.current[pid];
      const histCompletedAt = repairHistory?.[pid]?.completedAt || null;
      const prevHistCompletedAt = prevRepairCompletedAtByProduct.current[pid] || null;

      if (!baselineMetaByProductRef.current[pid]) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: histCompletedAt || nowIso,
          eventKind: histCompletedAt ? "repair_execution_response" : "manifest_loaded"
        };
      } else if (histCompletedAt && histCompletedAt !== prevHistCompletedAt) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: histCompletedAt,
          eventKind:
            repairHistory?.[pid]?.readBackVerified === true
              ? "verified_repair_readback"
              : "repair_execution_response"
        };
      } else if (
        (entry.currentMetafields && entry.currentMetafields !== prevMf) ||
        (entry.nativeTargets && entry.nativeTargets !== prevNt)
      ) {
        baselineMetaByProductRef.current[pid] = {
          loadedAt: nowIso,
          eventKind: "manifest_reloaded"
        };
      }

      prevMetafieldsRefByProduct.current[pid] = entry.currentMetafields;
      prevNativeTargetsRefByProduct.current[pid] = entry.nativeTargets;
      prevRepairCompletedAtByProduct.current[pid] = histCompletedAt;
    }
  }, [manifestData, repairHistory]);

  const sendLiveBenchSelectionClear = useCallback(
    (options = {}) => {
      const { useKeepalive = false } = options;
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
      if (liveSyncAbortRef.current) {
        try {
          liveSyncAbortRef.current.abort();
        } catch {
          // Ignore abort errors
        }
        liveSyncAbortRef.current = null;
      }

      const sessionId = benchSessionIdRef.current;
      const revision = nextBenchRevision();
      const clientStateChangedAt = new Date().toISOString();
      lastLiveStateDigestRef.current = `none:${revision}`;
      lastLiveSyncedDigestRef.current = "";
      lastLiveStateRevisionRef.current = revision;
      lastLiveStateChangedAtRef.current = clientStateChangedAt;
      lastNotifiedSelectionClearRef.current = true;

      if (!useKeepalive && isComponentMountedRef.current) {
        setLiveBenchSyncStatus({
          lifecycle: "pending",
          benchSessionId: sessionId,
          benchRevision: revision,
          selectionState: "none",
          productId: null,
          reportId: null,
          clientStateChangedAt,
          baselineLoadedAt: null,
          serverReceivedAt: null,
          errorCode: null,
          errorMessage: null
        });
      }

      const bodyStr = JSON.stringify({
        liveState: {
          mode: LIVE_BENCH_MODE,
          benchSessionId: sessionId,
          benchRevision: revision,
          selectionState: "none",
          clientStateChangedAt
        }
      });

      const controller = new AbortController();
      if (!useKeepalive) {
        liveSyncAbortRef.current = controller;
      }
      let timedOut = false;
      const timerId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Ignore abort timeout error
        }
      }, TELEMETRY_PUBLISH_TIMEOUT_MS);

      fetch(TELEMETRY_PUBLISH_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: bodyStr,
        keepalive: Boolean(useKeepalive),
        signal: controller.signal
      })
        .then(async (response) => {
          if (useKeepalive || !isComponentMountedRef.current) return;
          const rawText = await response.text();
          let parsed = null;
          if (rawText && rawText.trim().length > 0) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
          }

          if (
            !isComponentMountedRef.current ||
            benchSessionIdRef.current !== sessionId ||
            benchRevisionRef.current !== revision
          ) {
            return;
          }

          const liveSession =
            parsed && typeof parsed === "object" && parsed.liveSession && typeof parsed.liveSession === "object"
              ? parsed.liveSession
              : null;

          if (
            response.ok &&
            parsed &&
            parsed.ok === true &&
            parsed.status === "stored" &&
            parsed.selectionState === "none" &&
            liveSession &&
            liveSession.benchSessionId === sessionId &&
            liveSession.benchRevision === revision &&
            liveSession.selectionState === "none"
          ) {
            setLiveBenchSyncStatus({
              lifecycle: "cleared",
              benchSessionId: liveSession.benchSessionId,
              benchRevision: liveSession.benchRevision,
              selectionState: "none",
              productId: null,
              reportId: null,
              clientStateChangedAt:
                typeof liveSession.clientStateChangedAt === "string"
                  ? liveSession.clientStateChangedAt
                  : clientStateChangedAt,
              baselineLoadedAt: null,
              serverReceivedAt:
                typeof liveSession.serverReceivedAt === "string"
                  ? liveSession.serverReceivedAt
                  : null,
              errorCode: null,
              errorMessage: null
            });
            return;
          }

          if (
            parsed &&
            parsed.code === "stale_bench_revision" &&
            typeof parsed.highestRevision === "number" &&
            Number.isSafeInteger(parsed.highestRevision) &&
            parsed.highestRevision > benchRevisionRef.current
          ) {
            benchRevisionRef.current = parsed.highestRevision;
          }

          const backendCode =
            parsed && typeof parsed.code === "string" && parsed.code.trim()
              ? parsed.code.trim()
              : `http_${response.status}`;
          const backendMsg = sanitizeSafePublishMessage(
            parsed?.message,
            `Selection clear rejected (HTTP ${response.status}).`
          );

          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: sessionId,
            benchRevision: revision,
            selectionState: "none",
            productId: null,
            reportId: null,
            clientStateChangedAt,
            baselineLoadedAt: null,
            serverReceivedAt: null,
            errorCode: backendCode,
            errorMessage: backendMsg
          });
        })
        .catch(() => {
          if (useKeepalive || !isComponentMountedRef.current) return;
          if (!timedOut && controller.signal.aborted) {
            return;
          }
          if (
            benchSessionIdRef.current !== sessionId ||
            benchRevisionRef.current !== revision
          ) {
            return;
          }
          const errCode = timedOut ? "request_timeout" : "network_error";
          const errMsg = timedOut
            ? `Selection clear timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
            : "Network or authentication error while clearing live bench state.";
          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: sessionId,
            benchRevision: revision,
            selectionState: "none",
            productId: null,
            reportId: null,
            clientStateChangedAt,
            baselineLoadedAt: null,
            serverReceivedAt: null,
            errorCode: errCode,
            errorMessage: errMsg
          });
        })
        .finally(() => {
          clearTimeout(timerId);
          if (liveSyncAbortRef.current === controller) {
            liveSyncAbortRef.current = null;
          }
        });
    },
    [isComponentMountedRef, nextBenchRevision]
  );

  // Unmount cleanup
  useEffect(() => {
    return () => {
      if (activePublishAbortRef.current) {
        try {
          activePublishAbortRef.current.abort();
        } catch {
          // Ignore unmount abort errors
        }
        activePublishAbortRef.current = null;
      }
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
      if (!lastNotifiedSelectionClearRef.current) {
        sendLiveBenchSelectionClear({ useKeepalive: true });
      }
    };
  }, [sendLiveBenchSelectionClear]);

  // Helper for product switch in handleSelectBenchItem
  const handleLiveSyncOnProductSwitch = useCallback(
    (prevId, nextId) => {
      if (prevId === nextId) return;
      if (activePublishAbortRef.current) {
        try {
          activePublishAbortRef.current.abort();
        } catch {
          // Ignore abort errors on product switch
        }
        activePublishAbortRef.current = null;
      }
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
      if (liveSyncAbortRef.current) {
        try {
          liveSyncAbortRef.current.abort();
        } catch {
          // Ignore live sync abort on switch
        }
        liveSyncAbortRef.current = null;
      }
      // Immediately invalidate previous stone on switch or deselection so old stone is never exposed as current
      if (!nextId) {
        sendLiveBenchSelectionClear();
      } else if (prevId && prevId !== nextId) {
        sendLiveBenchSelectionClear();
      }
    },
    [sendLiveBenchSelectionClear]
  );

  // Helper for clearBench
  const handleLiveSyncOnClearBench = useCallback(() => {
    if (activePublishAbortRef.current) {
      try {
        activePublishAbortRef.current.abort();
      } catch {
        // Ignore abort errors on clearBench
      }
      activePublishAbortRef.current = null;
    }
    publishDedupMapRef.current.clear();
    baselineMetaByProductRef.current = {};
    prevMetafieldsRefByProduct.current = {};
    prevNativeTargetsRefByProduct.current = {};
    prevRepairCompletedAtByProduct.current = {};
    sendLiveBenchSelectionClear();
  }, [sendLiveBenchSelectionClear]);

  // Automatic debounced live-bench-state synchronization (publishes unselected draft preview, selected-unloaded, and selected-loaded states)
  const isSelectedBenchProductValid = Boolean(selectedBenchId && isExactProductGid(selectedBenchId));
  const isUnselectedBlankPreviewActive = Boolean(!selectedBenchId && DEV_SHOW_ALL_TEMPLATE_FIELDS);
  const activeProductDataForLiveSync = isSelectedBenchProductValid ? manifestData[selectedBenchId] : null;
  const activeProductApprovalsForLiveSync = isSelectedBenchProductValid
    ? approvals[selectedBenchId]
    : (isUnselectedBlankPreviewActive ? approvals[UNSELECTED_DRAFT_STORAGE_KEY] : null);
  const activeProductKeepOriginalForLiveSync = isSelectedBenchProductValid ? keepOriginalDecisions[selectedBenchId] : null;
  const activeProductManualEditsForLiveSync = isSelectedBenchProductValid
    ? manualEdits[selectedBenchId]
    : (isUnselectedBlankPreviewActive ? manualEdits[UNSELECTED_DRAFT_STORAGE_KEY] : null);
  const activeProductHistoryForLiveSync = isSelectedBenchProductValid ? repairHistory[selectedBenchId] : null;
  const activeProductSubmittedForLiveSync = isSelectedBenchProductValid ? submittedPayloads[selectedBenchId] : null;
  const activeProductCandidatesForLiveSync = isSelectedBenchProductValid ? standardizedCandidatesByProduct[selectedBenchId] : null;
  const activeProductRefMatchForLiveSync = isSelectedBenchProductValid ? referenceMatchResultsByProduct[selectedBenchId] : null;
  const activeProductRefStatusForLiveSync = isSelectedBenchProductValid ? referenceMatchStatusByProduct[selectedBenchId] : null;
  const activeProductQueueStateStatus = isSelectedBenchProductValid ? (productStates[selectedBenchId]?.status || null) : null;
  const targetMeasurementProductId = isSelectedBenchProductValid ? selectedBenchId : null;
  const activeMeasurementsForLiveSync =
    sectionAuditMeasurements.productId === targetMeasurementProductId
      ? sectionAuditMeasurements
      : null;

  useEffect(() => {
    if (!isSelectedBenchProductValid && !isUnselectedBlankPreviewActive) {
      if (!lastNotifiedSelectionClearRef.current) {
        sendLiveBenchSelectionClear();
      }
      return;
    }

    if (isLoadingData) {
      return;
    }

    const effectiveSelectionState = isSelectedBenchProductValid
      ? "selected"
      : "unselected_preview";
    const effectiveProductId = isSelectedBenchProductValid ? selectedBenchId : null;
    const isManifestLoadedForSelected = Boolean(
      isSelectedBenchProductValid && activeProductDataForLiveSync
    );

    const measuredUiAudit =
      isManifestLoadedForSelected || isUnselectedBlankPreviewActive
        ? buildMeasuredUiAuditSnapshot(effectiveProductId, activeMeasurementsForLiveSync, {
            allowUnselectedPreview: isUnselectedBlankPreviewActive
          })
        : null;

    const contentChangeDigest = computeQuickTextDigest(
      JSON.stringify({
        selectionState: effectiveSelectionState,
        productId: effectiveProductId,
        manifestLoaded: isManifestLoadedForSelected,
        queueStatus: activeProductQueueStateStatus,
        currentMetafields: activeProductDataForLiveSync?.currentMetafields || null,
        nativeTargets: activeProductDataForLiveSync?.nativeTargets || null,
        repairPlan: isSelectedBenchProductValid
          ? (activeProductDataForLiveSync?.repairPlan || null)
          : (unselectedDraftManifest?.repairPlan || null),
        metadata: isSelectedBenchProductValid
          ? (activeProductDataForLiveSync?.metadata || null)
          : (unselectedDraftManifest?.metadata || null),
        draftSourceContext: isSelectedBenchProductValid ? null : draftSourceContext,
        diagnostics: activeProductDataForLiveSync?.diagnostics || null,
        approvals: activeProductApprovalsForLiveSync || null,
        keepOriginal: activeProductKeepOriginalForLiveSync || null,
        manualEdits: activeProductManualEditsForLiveSync || null,
        historyCompletedAt: activeProductHistoryForLiveSync?.completedAt || null,
        historyStatus: activeProductHistoryForLiveSync?.status || null,
        submitted: activeProductSubmittedForLiveSync || null,
        candidates: activeProductCandidatesForLiveSync || null,
        refMatchAt: activeProductRefMatchForLiveSync?.matchedAt || null,
        refStatusAt: activeProductRefStatusForLiveSync?.updatedAt || null,
        refStatusState: activeProductRefStatusForLiveSync?.state || null,
        uiAudit: measuredUiAudit
      })
    );

    // If working state and measurements have not changed and are already synced, do nothing
    if (
      contentChangeDigest === lastLiveStateDigestRef.current &&
      contentChangeDigest === lastLiveSyncedDigestRef.current
    ) {
      return;
    }

    let stateRevision = lastLiveStateRevisionRef.current;
    let clientStateChangedAt = lastLiveStateChangedAtRef.current;

    if (contentChangeDigest !== lastLiveStateDigestRef.current || !clientStateChangedAt || stateRevision < 1) {
      stateRevision = nextBenchRevision();
      clientStateChangedAt = new Date().toISOString();
      lastLiveStateDigestRef.current = contentChangeDigest;
      lastLiveStateRevisionRef.current = stateRevision;
      lastLiveStateChangedAtRef.current = clientStateChangedAt;
      lastNotifiedSelectionClearRef.current = false;
    }

    const currentSessionId = benchSessionIdRef.current;
    const candidateBaselineLoadedAt = isManifestLoadedForSelected
      ? (baselineMetaByProductRef.current[selectedBenchId]?.loadedAt || null)
      : null;

    setLiveBenchSyncStatus({
      lifecycle: "pending",
      benchSessionId: currentSessionId,
      benchRevision: stateRevision,
      selectionState: effectiveSelectionState,
      productId: effectiveProductId,
      reportId: null,
      clientStateChangedAt,
      baselineLoadedAt: candidateBaselineLoadedAt,
      serverReceivedAt: null,
      errorCode: null,
      errorMessage: null
    });

    if (liveSyncDebounceTimerRef.current) {
      clearTimeout(liveSyncDebounceTimerRef.current);
      liveSyncDebounceTimerRef.current = null;
    }

    const targetProductId = effectiveProductId;
    const targetSelectionState = effectiveSelectionState;
    const targetRevision = stateRevision;
    const targetChangedAt = clientStateChangedAt;
    const targetDigest = contentChangeDigest;

    liveSyncDebounceTimerRef.current = setTimeout(() => {
      liveSyncDebounceTimerRef.current = null;
      const currentActiveBenchId = activeBenchIdRef.current || null;
      if (
        !isComponentMountedRef.current ||
        currentActiveBenchId !== targetProductId ||
        benchSessionIdRef.current !== currentSessionId ||
        benchRevisionRef.current !== targetRevision
      ) {
        return;
      }

      let packet;
      let liveState;
      let latestUiAudit = null;
      let effectiveBaselineLoadedAt = null;

      if (targetSelectionState === "unselected_preview") {
        const builtPreview = buildUnselectedPreviewLiveBenchPayload({
          benchSessionId: currentSessionId,
          benchRevision: targetRevision,
          clientStateChangedAt: targetChangedAt,
          draftManifest: unselectedDraftManifest,
          draftSourceContext,
          approvals,
          manualEdits,
          getFieldMetadata: getFieldMetadataRef.current,
          getDiagnosticsStats: (d) => getDiagnosticsStatsRef.current(d, null)
        });
        packet = builtPreview.packet;
        liveState = builtPreview.liveState;
        latestUiAudit = buildMeasuredUiAuditSnapshot(
          null,
          sectionAuditMeasurementsRef.current,
          { allowUnselectedPreview: true }
        );
        effectiveBaselineLoadedAt = null;
      } else if (activeProductDataForLiveSync) {
        const productRecord = (safeProducts || []).find((p) => p.id === targetProductId) || {};
        const productTitle =
          productRecord.title ||
          activeProductDataForLiveSync?.nativeTargets?.productTitle ||
          "Not recorded";
        const baselineInfo = baselineMetaByProductRef.current[targetProductId] || null;
        const baselineLoadedAt = baselineInfo?.loadedAt || null;
        const baselineEventKind = baselineInfo?.eventKind || "last_loaded_manifest";
        effectiveBaselineLoadedAt = baselineLoadedAt;

        const built = buildPureLiveBenchPayload({
          benchSessionId: currentSessionId,
          benchRevision: targetRevision,
          clientStateChangedAt: targetChangedAt,
          baselineLoadedAt,
          baselineEventKind,
          productId: targetProductId,
          productTitle,
          data: activeProductDataForLiveSync,
          approvals,
          keepOriginalDecisions,
          manualEdits,
          repairHistory,
          submittedPayloads,
          standardizedCandidatesByProduct,
          referenceMatchResultsByProduct,
          referenceMatchStatusByProduct,
          pendingReferenceMatch,
          getFieldMetadata: getFieldMetadataRef.current,
          getSystemStatus: getSystemStatusRef.current,
          getDiagnosticsStats: getDiagnosticsStatsRef.current
        });
        packet = built.packet;
        liveState = built.liveState;
        latestUiAudit = buildMeasuredUiAuditSnapshot(
          targetProductId,
          sectionAuditMeasurementsRef.current
        );
      } else {
        const productRecord = (safeProducts || []).find((p) => p.id === targetProductId) || {};
        const productTitle = productRecord.title || "Not recorded";
        const builtUnloaded = buildSelectedUnloadedLiveBenchPayload({
          benchSessionId: currentSessionId,
          benchRevision: targetRevision,
          clientStateChangedAt: targetChangedAt,
          productId: targetProductId,
          productTitle,
          productQueueStatus: activeProductQueueStateStatus
        });
        packet = builtUnloaded.packet;
        liveState = builtUnloaded.liveState;
        latestUiAudit = null;
        effectiveBaselineLoadedAt = null;
      }

      const postBody =
        latestUiAudit !== null
          ? { packet, liveState, uiAudit: latestUiAudit }
          : { packet, liveState };

      if (liveSyncAbortRef.current) {
        try {
          liveSyncAbortRef.current.abort();
        } catch {
          // Ignore superseding abort
        }
        liveSyncAbortRef.current = null;
      }

      const controller = new AbortController();
      liveSyncAbortRef.current = controller;
      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Ignore timeout abort
        }
      }, TELEMETRY_PUBLISH_TIMEOUT_MS);

      (async () => {
        try {
          const response = await fetch(TELEMETRY_PUBLISH_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify(postBody),
            signal: controller.signal
          });

          const rawText = await response.text();
          let parsed = null;
          if (rawText && rawText.trim().length > 0) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
          }

          const latestActiveBenchId = activeBenchIdRef.current || null;
          if (
            !isComponentMountedRef.current ||
            latestActiveBenchId !== targetProductId ||
            benchSessionIdRef.current !== currentSessionId ||
            benchRevisionRef.current !== targetRevision
          ) {
            return;
          }

          const returnedReport =
            parsed && typeof parsed === "object" && parsed.report && typeof parsed.report === "object"
              ? parsed.report
              : null;
          const returnedSession =
            parsed && typeof parsed === "object" && parsed.liveSession && typeof parsed.liveSession === "object"
              ? parsed.liveSession
              : null;

          if (
            response.ok &&
            parsed &&
            parsed.ok === true &&
            parsed.status === "stored" &&
            returnedReport &&
            typeof returnedReport.reportId === "string" &&
            returnedReport.reportId.trim().length > 0 &&
            (returnedReport.productId ?? null) === targetProductId &&
            returnedReport.benchSessionId === currentSessionId &&
            returnedReport.benchRevision === targetRevision &&
            returnedReport.selectionState === targetSelectionState
          ) {
            lastLiveSyncedDigestRef.current = targetDigest;
            setLiveBenchSyncStatus({
              lifecycle: "acknowledged",
              benchSessionId: returnedReport.benchSessionId,
              benchRevision: returnedReport.benchRevision,
              selectionState: returnedReport.selectionState,
              productId: returnedReport.productId ?? null,
              reportId: returnedReport.reportId.trim(),
              clientStateChangedAt:
                typeof returnedReport.clientStateChangedAt === "string"
                  ? returnedReport.clientStateChangedAt
                  : (typeof returnedReport.capturedAt === "string" ? returnedReport.capturedAt : targetChangedAt),
              baselineLoadedAt:
                typeof returnedReport.baselineLoadedAt === "string"
                  ? returnedReport.baselineLoadedAt
                  : effectiveBaselineLoadedAt,
              serverReceivedAt:
                typeof returnedReport.serverReceivedAt === "string"
                  ? returnedReport.serverReceivedAt
                  : (typeof returnedReport.storedAt === "string"
                      ? returnedReport.storedAt
                      : (typeof returnedSession?.serverReceivedAt === "string" ? returnedSession.serverReceivedAt : null)),
              errorCode: null,
              errorMessage: null
            });
            setTelemetryPublishNotice((prev) =>
              prev && prev.source === "live_sync_error" ? null : prev
            );
            return;
          }

          if (
            parsed &&
            parsed.code === "stale_bench_revision" &&
            typeof parsed.highestRevision === "number" &&
            Number.isSafeInteger(parsed.highestRevision) &&
            parsed.highestRevision > benchRevisionRef.current
          ) {
            benchRevisionRef.current = parsed.highestRevision;
            setLiveBenchSyncStatus({
              lifecycle: "error",
              benchSessionId: currentSessionId,
              benchRevision: targetRevision,
              selectionState: targetSelectionState,
              productId: targetProductId,
              reportId: null,
              clientStateChangedAt: targetChangedAt,
              baselineLoadedAt: effectiveBaselineLoadedAt,
              serverReceivedAt: null,
              errorCode: "stale_bench_revision",
              errorMessage: sanitizeSafePublishMessage(
                parsed?.message,
                `Revision ${targetRevision} superseded by server high-water revision ${parsed.highestRevision}.`
              )
            });
            return;
          }

          const backendCode =
            parsed && typeof parsed.code === "string" && parsed.code.trim()
              ? parsed.code.trim()
              : `http_${response.status}`;
          const backendMsg = sanitizeSafePublishMessage(
            parsed?.message,
            `Sidekick live bench sync rejected (HTTP ${response.status}).`
          );

          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: currentSessionId,
            benchRevision: targetRevision,
            selectionState: targetSelectionState,
            productId: targetProductId,
            reportId: null,
            clientStateChangedAt: targetChangedAt,
            baselineLoadedAt: effectiveBaselineLoadedAt,
            serverReceivedAt: null,
            errorCode: backendCode,
            errorMessage: backendMsg
          });
          setTelemetryPublishNotice({
            source: "live_sync_error",
            productId: targetProductId,
            capturedAt: targetChangedAt,
            tone: "warning",
            message: `Sidekick live bench sync failed (${backendCode}): ${backendMsg}`
          });
        } catch {
          if (!timedOut && controller.signal.aborted) {
            return;
          }
          const latestActiveBenchId = activeBenchIdRef.current || null;
          if (
            !isComponentMountedRef.current ||
            latestActiveBenchId !== targetProductId ||
            benchSessionIdRef.current !== currentSessionId ||
            benchRevisionRef.current !== targetRevision
          ) {
            return;
          }
          const errCode = timedOut ? "request_timeout" : "network_error";
          const errDetail = timedOut
            ? `Request timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
            : "Network or authentication error while contacting /api/meta-injector-telemetry.";
          setLiveBenchSyncStatus({
            lifecycle: "error",
            benchSessionId: currentSessionId,
            benchRevision: targetRevision,
            selectionState: targetSelectionState,
            productId: targetProductId,
            reportId: null,
            clientStateChangedAt: targetChangedAt,
            baselineLoadedAt: effectiveBaselineLoadedAt,
            serverReceivedAt: null,
            errorCode: errCode,
            errorMessage: errDetail
          });
          setTelemetryPublishNotice({
            source: "live_sync_error",
            productId: targetProductId,
            capturedAt: targetChangedAt,
            tone: "warning",
            message: `Sidekick live bench sync failed: ${errDetail}`
          });
        } finally {
          clearTimeout(timeoutId);
          if (liveSyncAbortRef.current === controller) {
            liveSyncAbortRef.current = null;
          }
        }
      })();
    }, LIVE_BENCH_SYNC_DEBOUNCE_MS);

    return () => {
      if (liveSyncDebounceTimerRef.current) {
        clearTimeout(liveSyncDebounceTimerRef.current);
        liveSyncDebounceTimerRef.current = null;
      }
    };
  }, [
    activeBenchIdRef,
    isComponentMountedRef,
    sectionAuditMeasurementsRef,
    safeProducts,
    isSelectedBenchProductValid,
    isUnselectedBlankPreviewActive,
    selectedBenchId,
    isLoadingData,
    activeProductQueueStateStatus,
    activeProductDataForLiveSync,
    unselectedDraftManifest,
    draftSourceContext,
    approvals,
    keepOriginalDecisions,
    manualEdits,
    repairHistory,
    submittedPayloads,
    standardizedCandidatesByProduct,
    referenceMatchResultsByProduct,
    referenceMatchStatusByProduct,
    pendingReferenceMatch,
    activeProductApprovalsForLiveSync,
    activeProductKeepOriginalForLiveSync,
    activeProductManualEditsForLiveSync,
    activeProductHistoryForLiveSync,
    activeProductSubmittedForLiveSync,
    activeProductCandidatesForLiveSync,
    activeProductRefMatchForLiveSync,
    activeProductRefStatusForLiveSync,
    activeMeasurementsForLiveSync,
    nextBenchRevision,
    sendLiveBenchSelectionClear,
    setTelemetryPublishNotice
  ]);

  const publishCapturedPacketToSidekickCache = useCallback(
    (capturedPacket, expectedProductId) => {
      if (!expectedProductId || activeBenchIdRef.current !== expectedProductId) {
        return;
      }
      if (!isValidTelemetryPacketForProduct(capturedPacket, expectedProductId)) {
        return;
      }

      const captureSignature = buildImmutableCaptureSignature(capturedPacket);
      if (!captureSignature) {
        return;
      }

      const dedupMap = publishDedupMapRef.current;
      const existingStatus = dedupMap.get(captureSignature);
      if (existingStatus === "inflight" || existingStatus === "stored") {
        return;
      }

      if (dedupMap.size >= MAX_PUBLISHED_CAPTURE_SIGNATURES) {
        for (const [k, v] of dedupMap.entries()) {
          if (v !== "inflight") {
            dedupMap.delete(k);
            if (dedupMap.size < MAX_PUBLISHED_CAPTURE_SIGNATURES) {
              break;
            }
          }
        }
        if (dedupMap.size >= MAX_PUBLISHED_CAPTURE_SIGNATURES) {
          const oldestKey = dedupMap.keys().next().value;
          if (oldestKey !== undefined) {
            dedupMap.delete(oldestKey);
          }
        }
      }

      dedupMap.set(captureSignature, "inflight");

      const measuredUiAudit = buildMeasuredUiAuditSnapshot(
        expectedProductId,
        sectionAuditMeasurementsRef.current
      );

      const requestBody =
        measuredUiAudit !== null
          ? { packet: capturedPacket, uiAudit: measuredUiAudit }
          : { packet: capturedPacket };

      if (activePublishAbortRef.current) {
        try {
          activePublishAbortRef.current.abort();
        } catch {
          // Ignore abort error on superseding manual capture
        }
        activePublishAbortRef.current = null;
      }

      const controller = new AbortController();
      activePublishAbortRef.current = controller;
      let timedOut = false;

      const timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          controller.abort();
        } catch {
          // Ignore timeout abort error
        }
      }, TELEMETRY_PUBLISH_TIMEOUT_MS);

      if (isComponentMountedRef.current && activeBenchIdRef.current === expectedProductId) {
        setTelemetryPublishNotice({
          source: "manual_capture",
          productId: expectedProductId,
          capturedAt: capturedPacket.capturedAt || null,
          tone: "info",
          message: "Publishing captured telemetry report to temporary Sidekick memory cache..."
        });
      }

      (async () => {
        try {
          const response = await fetch(TELEMETRY_PUBLISH_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
          });

          const rawText = await response.text();
          let parsed = null;
          if (rawText && rawText.trim().length > 0) {
            try {
              parsed = JSON.parse(rawText);
            } catch {
              parsed = null;
            }
          }

          const returnedReport =
            parsed && typeof parsed === "object" && parsed.report && typeof parsed.report === "object"
              ? parsed.report
              : null;

          const isVerifiedStored = Boolean(
            response.ok &&
              parsed &&
              parsed.ok === true &&
              parsed.status === "stored" &&
              returnedReport &&
              typeof returnedReport.reportId === "string" &&
              returnedReport.reportId.trim().length > 0 &&
              returnedReport.productId === capturedPacket.productId &&
              returnedReport.capturedAt === capturedPacket.capturedAt
          );

          if (isVerifiedStored) {
            dedupMap.set(captureSignature, "stored");
            if (isComponentMountedRef.current && activeBenchIdRef.current === expectedProductId) {
              const confirmedReportId = returnedReport.reportId.trim();
              const auditStateLabel =
                returnedReport.uiAuditState === "measured"
                  ? "measured"
                  : "not_measured";
              setTelemetryPublishNotice({
                source: "manual_capture",
                productId: expectedProductId,
                capturedAt: returnedReport.capturedAt,
                reportId: confirmedReportId,
                tone: "success",
                message: `Sidekick report published (${confirmedReportId}) for ${returnedReport.productId} at ${returnedReport.capturedAt} [UI audit: ${auditStateLabel}].`
              });
            }
            return;
          }

          dedupMap.delete(captureSignature);
          if (isComponentMountedRef.current && activeBenchIdRef.current === expectedProductId) {
            const backendCode =
              parsed && typeof parsed.code === "string" && parsed.code.trim()
                ? parsed.code.trim()
                : `http_${response.status}`;
            const backendMessage = sanitizeSafePublishMessage(
              parsed?.message,
              `Telemetry cache endpoint rejected publication (HTTP ${response.status}).`
            );
            setTelemetryPublishNotice({
              source: "manual_capture",
              productId: expectedProductId,
              capturedAt: capturedPacket.capturedAt || null,
              tone: "warning",
              message: `Local capture succeeded, but Sidekick report cache publication failed (${backendCode}): ${backendMessage}`
            });
          }
        } catch {
          dedupMap.delete(captureSignature);
          if (!timedOut && controller.signal.aborted) {
            return;
          }
          if (isComponentMountedRef.current && activeBenchIdRef.current === expectedProductId) {
            const errSummary = timedOut
              ? `Request timed out after ${TELEMETRY_PUBLISH_TIMEOUT_MS}ms.`
              : "Network or authentication error while contacting /api/meta-injector-telemetry.";
            setTelemetryPublishNotice({
              source: "manual_capture",
              productId: expectedProductId,
              capturedAt: capturedPacket.capturedAt || null,
              tone: "warning",
              message: `Local capture succeeded, but Sidekick report cache publication failed: ${errSummary}`
            });
          }
        } finally {
          clearTimeout(timeoutId);
          if (activePublishAbortRef.current === controller) {
            activePublishAbortRef.current = null;
          }
        }
      })();
    },
    [
      activeBenchIdRef,
      isComponentMountedRef,
      sectionAuditMeasurementsRef,
      setTelemetryPublishNotice
    ]
  );

  return {
    benchSessionIdRef,
    lastLiveStateRevisionRef,
    lastLiveStateDigestRef,
    lastLiveSyncedDigestRef,
    lastNotifiedSelectionClearRef,
    baselineMetaByProductRef,
    liveBenchSyncStatus,
    sendLiveBenchSelectionClear,
    handleLiveSyncOnProductSwitch,
    handleLiveSyncOnClearBench,
    publishCapturedPacketToSidekickCache
  };
}
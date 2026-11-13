// ==========================================================================
// ROCKHOUND STUDIO — DB GEOLOGY, CACHE/PROFILE PRECEDENCE & VARIETY RELOOKUP
// File: app/utils/meta-injector.geology-db.server.jsx
// ==========================================================================

import { DROPDOWN_OPTIONS } from "../utils/meta-injector.constants.jsx";
import {
  isGenericBareStoneProposal,
  isSettingOrHardwareMediumValue
} from "./meta-injector.standardized.jsx";
import {
  INVALID_CANDIDATE_FILLERS,
  splitSegmentedTitle,
  extractStoneName,
  resolvePicklistStoneFamily,
  sanitizeCandidateString,
  cleanStoneFamilyShape,
  getDerivedMaterial
} from "./meta-injector.autofill-inputs.server.jsx";

export const BENCH_V2_DB_GEOLOGY_DESTINATIONS = Object.freeze({
  mohs_hardness: ["custom.mohs_hardness"],
  specific_gravity: ["custom.specific_gravity"],
  crystal_system: ["custom.crystal_system", "shopify.crystal-system"],
  luster: ["custom.luster"],
  cleavage: ["custom.cleavage"],
  fracture_pattern: ["custom.fracture_pattern"],
  diaphaneity: ["custom.diaphaneity"],
  tenacity: ["custom.tenacity"],
  mineral_class: ["custom.mineral_class", "shopify.mineral-class"],
  rock_composition: ["custom.rock_composition", "shopify.rock-composition"],
  rock_formation: ["custom.rock_formation", "shopify.rock-formation"],
  geological_age: ["custom.geological_age"]
});

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

function isSupportedPicklistStoneFamily(rawFamily) {
  const cleaned = cleanStoneFamilyShape(String(rawFamily || "").trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return false;
  }
  const options = DROPDOWN_OPTIONS?.stone_family || [];
  const lower = cleaned.toLowerCase();
  for (const opt of options) {
    const val = typeof opt === "object" ? (opt.value || opt.label || "") : String(opt);
    if (val && val.toLowerCase().trim() === lower) {
      return true;
    }
  }
  return false;
}

function resolveCanonicalBaseFamilyForStoneCandidate(rawCandidate) {
  if (typeof rawCandidate !== "string") return "";
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (
    !cleaned ||
    cleaned.toLowerCase() === "unknown" ||
    cleaned.toLowerCase() === "unknown stone" ||
    INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
    isGenericBareStoneProposal(cleaned) ||
    isSettingOrHardwareMediumValue(cleaned)
  ) {
    return "";
  }
  if (isSupportedPicklistStoneFamily(cleaned)) {
    return resolvePicklistStoneFamily(cleaned);
  }
  const extracted = extractStoneName(cleaned);
  if (
    extracted &&
    extracted !== "Unknown" &&
    isSupportedPicklistStoneFamily(extracted)
  ) {
    return resolvePicklistStoneFamily(extracted);
  }
  const derived = getDerivedMaterial(cleaned);
  if (
    derived &&
    derived !== cleaned &&
    isSupportedPicklistStoneFamily(derived)
  ) {
    return resolvePicklistStoneFamily(derived);
  }
  return "";
}

function isValidatedSpecificVarietyOfBaseFamily(rawCandidate, targetBaseFamily = "") {
  if (typeof rawCandidate !== "string") return false;
  const cleaned = cleanStoneFamilyShape(rawCandidate.trim());
  if (!cleaned) return false;
  const candidateBaseFamily = resolveCanonicalBaseFamilyForStoneCandidate(cleaned);
  if (!candidateBaseFamily) return false;
  if (cleaned.toLowerCase() === candidateBaseFamily.toLowerCase()) {
    return false;
  }
  if (targetBaseFamily) {
    const cleanTargetFamily = resolveCanonicalBaseFamilyForStoneCandidate(targetBaseFamily);
    if (
      !cleanTargetFamily ||
      candidateBaseFamily.toLowerCase() !== cleanTargetFamily.toLowerCase()
    ) {
      return false;
    }
  }
  return true;
}

export function cleanProducerNonBlankVisionStr(rawVal) {
  if (typeof rawVal !== "string") return "";
  const cleaned = sanitizeCandidateString(rawVal);
  if (!cleaned) return "";
  if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

/**
 * Computes the exact `custom.material` value that `buildBenchV2ProducerProposals`
 * will stage for the current scan inputs, using the identical precedence rules as
 * `buildBenchV2ProducerProposals` (operator lock -> `rawVisMaterial` ->
 * `rawVisPrimaryMedium` -> 3-segment title variety).
 */
export function resolveBenchV2ProducedMaterialCandidate({
  idOrigin,
  currentData = {},
  rawVisionSnapshot = {},
  provenance = null
}) {
  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const isMaterialLocked =
    hasValidProvenance &&
    operatorLockedSet.has("material") &&
    currentData.material !== undefined &&
    String(currentData.material).trim() !== "";

  if (isMaterialLocked) {
    return "";
  }

  const rawTitleSegments = splitSegmentedTitle(idOrigin?.rawTitleInput || "");
  const rawTitleStoneSegment =
    idOrigin?.hasSegmentedTitle && rawTitleSegments.length >= 3
      ? rawTitleSegments[0]
      : "";
  const cleanTitleStoneVariety =
    idOrigin?.titleStoneSegment &&
    resolveCanonicalBaseFamilyForStoneCandidate(idOrigin.titleStoneSegment) !== ""
      ? idOrigin.titleStoneSegment
      : "";

  const rawVisMaterial = cleanProducerNonBlankVisionStr(rawVisionSnapshot.material);
  const rawVisPrimaryMedium = cleanProducerNonBlankVisionStr(rawVisionSnapshot.primary_medium);
  const rawVisStoneFamily = cleanProducerNonBlankVisionStr(rawVisionSnapshot.stone_family);

  const normalizedVisStoneFamily = rawVisStoneFamily
    ? resolvePicklistStoneFamily(rawVisStoneFamily)
    : "";
  const titleDerivedStoneFamily =
    !idOrigin?.explicitStoneFamily &&
    idOrigin?.hasSegmentedTitle &&
    rawTitleStoneSegment &&
    resolveCanonicalBaseFamilyForStoneCandidate(rawTitleStoneSegment) !== ""
      ? resolvePicklistStoneFamily(
          extractStoneName(rawTitleStoneSegment) !== "Unknown"
            ? extractStoneName(rawTitleStoneSegment)
            : rawTitleStoneSegment
        )
      : "";

  const effectiveBaseFamily =
    (idOrigin?.explicitStoneFamily && currentData.stone_family
      ? resolvePicklistStoneFamily(currentData.stone_family)
      : "") ||
    normalizedVisStoneFamily ||
    titleDerivedStoneFamily ||
    "";

  const isTitleVarietyMoreSpecificThanVision = Boolean(
    cleanTitleStoneVariety &&
    effectiveBaseFamily &&
    cleanTitleStoneVariety.toLowerCase() !== effectiveBaseFamily.toLowerCase() &&
    resolvePicklistStoneFamily(
      extractStoneName(cleanTitleStoneVariety) !== "Unknown"
        ? extractStoneName(cleanTitleStoneVariety)
        : cleanTitleStoneVariety
    ).toLowerCase() === effectiveBaseFamily.toLowerCase()
  );

  if (
    rawVisMaterial &&
    !isGenericBareStoneProposal(rawVisMaterial) &&
    !isSettingOrHardwareMediumValue(rawVisMaterial) &&
    !(
      isTitleVarietyMoreSpecificThanVision &&
      rawVisMaterial.toLowerCase() === effectiveBaseFamily.toLowerCase()
    )
  ) {
    return rawVisMaterial;
  }

  if (
    rawVisPrimaryMedium &&
    !isGenericBareStoneProposal(rawVisPrimaryMedium) &&
    !isSettingOrHardwareMediumValue(rawVisPrimaryMedium) &&
    !(
      isTitleVarietyMoreSpecificThanVision &&
      rawVisPrimaryMedium.toLowerCase() === effectiveBaseFamily.toLowerCase()
    )
  ) {
    const isDistinctVarietyOrConfirmedStone =
      !rawVisStoneFamily ||
      rawVisPrimaryMedium.toLowerCase() !== rawVisStoneFamily.toLowerCase() ||
      Boolean(resolvePicklistStoneFamily(rawVisPrimaryMedium));
    if (isDistinctVarietyOrConfirmedStone) {
      return rawVisPrimaryMedium;
    }
    if (cleanTitleStoneVariety) {
      return cleanTitleStoneVariety;
    }
    return "";
  }

  if (cleanTitleStoneVariety) {
    return cleanTitleStoneVariety;
  }

  return "";
}

export async function getGeoData(admin, stoneFamily, options = {}) {
  const {
    requireAuthoritativeDbOnly = false,
    exactCandidatesOnly = false
  } = options && typeof options === "object" ? options : {};

  const attachDbLookupMeta = Boolean(requireAuthoritativeDbOnly || exactCandidatesOnly);

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

  const dbCandidateOrder = [];
  const seenDbLower = new Set();
  for (const candidate of fullCandidates) {
    const candidateLower = candidate.toLowerCase().trim();
    if (candidateLower && !seenDbLower.has(candidateLower)) {
      seenDbLower.add(candidateLower);
      dbCandidateOrder.push(candidateLower);
    }
  }
  if (!exactCandidatesOnly && search && !seenDbLower.has(search)) {
    seenDbLower.add(search);
    dbCandidateOrder.push(search);
  }

  let dbReadError = null;

  // 1 & 2. Authoritative Postgres Lookup by Candidate Identity Priority:
  // For each ordered candidate in dbCandidateOrder, check StoneCache first and
  // StoneProfile second for THAT candidate before moving to the next (more generic)
  // candidate. Never merge a generic fallback candidate's cache/profile fields into
  // a preceding specific candidate's record.
  try {
    for (const candidateLower of dbCandidateOrder) {
      let matchedNormalizedCache = null;

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
          matchedNormalizedCache = normalized;
        }
      }

      if (matchedNormalizedCache) {
        const hasMissingCanonicalField = CANONICAL_GEO_FIELD_KEYS.some(
          (k) => !matchedNormalizedCache[k]
        );
        let matchingProfileGeo = null;
        if (hasMissingCanonicalField) {
          try {
            matchingProfileGeo = await loadStoneProfileForName(candidateLower);
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
        const hasAnyUsableMergedField = CANONICAL_GEO_FIELD_KEYS.some(
          (k) => typeof mergedCacheResult[k] === "string" && mergedCacheResult[k].trim() !== ""
        );
        if (hasAnyUsableMergedField) {
          if (attachDbLookupMeta) {
            Object.defineProperty(mergedCacheResult, "_dbLookupMeta", {
              value: {
                dbLookupComplete: true,
                dbMatchedStoneName: candidateLower,
                dbCandidatesTried: dbCandidateOrder,
                dbReadError: null
              },
              enumerable: false
            });
          }
          return mergedCacheResult;
        }
      }

      const profileGeo = await loadStoneProfileForName(candidateLower);
      if (profileGeo) {
        const profileResult = {
          ...emptyGeo,
          ...profileGeo,
          tenacity: profileGeo.tenacity || "",
          geological_age: profileGeo.geological_age || "",
          geoSource: "database"
        };
        const hasAnyUsableProfileField = CANONICAL_GEO_FIELD_KEYS.some(
          (k) => typeof profileResult[k] === "string" && profileResult[k].trim() !== ""
        );
        if (hasAnyUsableProfileField) {
          if (attachDbLookupMeta) {
            Object.defineProperty(profileResult, "_dbLookupMeta", {
              value: {
                dbLookupComplete: true,
                dbMatchedStoneName: candidateLower,
                dbCandidatesTried: dbCandidateOrder,
                dbReadError: null
              },
              enumerable: false
            });
          }
          return profileResult;
        }
      }
    }
  } catch (err) {
    dbReadError = err?.message || "Database geology query failed.";
  }

  // If DB read failed or caller requires authoritative DB evidence only or exact candidates only,
  // never fall back to static GEO_LIBRARY or Mindat to masquerade as verified DB truth.
  if (dbReadError || requireAuthoritativeDbOnly || exactCandidatesOnly) {
    const authoritativeEmpty = { ...emptyGeo, geoSource: "none" };
    Object.defineProperty(authoritativeEmpty, "_dbLookupMeta", {
      value: {
        dbLookupComplete: !dbReadError,
        dbMatchedStoneName: null,
        dbCandidatesTried: dbCandidateOrder,
        dbReadError
      },
      enumerable: false
    });
    return authoritativeEmpty;
  }

  // 3. Non-Bench Fallback Only (when Postgres DB completed with 0 matching records): Local GEO_LIBRARY
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

  // 4. Non-Bench Fallback Last: Mindat API
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

/**
 * Bounded Post-Vision Specific Variety DB Relookup (Bench V2 Opt-In Only):
 * Uses the exact material proposal precedence of `buildBenchV2ProducerProposals`.
 * When `custom.material`, `primary_medium`, and `stone_family` are not operator-locked
 * to a conflicting identity, and the pre-Vision lookup did NOT already lead with a
 * validated specific variety, check whether the actual produced `custom.material`
 * candidate is a validated specific variety compatible with the established base
 * stone family. If so, run ONE exact-candidate-only authoritative DB lookup for
 * `[emergedSpecificVariety]` (`requireAuthoritativeDbOnly: true, exactCandidatesOnly: true`).
 * - Success requires: `dbLookupComplete === true`, `!dbReadError`,
 *   `dbMatchedStoneName === expectedSpecificLower`, `geoSource` in `("cache", "database")`,
 *   and at least one usable canonical geology field.
 * - Failure (no exact DB record for `emergedSpecificVariety` or DB read error) is
 *   fail-closed: `geoFields` is set to the empty `geoSource: "none"` result carrying
 *   `_dbLookupMeta` for `[expectedSpecificLower]`, so downstream producer diagnostics
 *   explicitly hold all 12 geology fields for that specific variety rather than
 *   silently pairing `emergedSpecificVariety` with pre-Vision generic fallback facts.
 */
export async function resolvePostVisionBenchV2GeoFields({
  isBenchV2OptIn,
  provenance,
  currentData = {},
  geoLookupCandidates = [],
  effectiveFamily = "",
  idOrigin,
  rawVisionSnapshot = {},
  admin,
  geoFields
}) {
  let nextGeoFields = geoFields;

  const hasOperatorLockedMaterialOrMedium = Boolean(
    provenance?.hasValidProvenance &&
    ((provenance.operatorLockedSet.has("material") &&
      currentData.material !== undefined &&
      String(currentData.material).trim() !== "") ||
      (provenance.operatorLockedSet.has("primary_medium") &&
        currentData.primary_medium !== undefined &&
        String(currentData.primary_medium).trim() !== ""))
  );

  if (isBenchV2OptIn && !hasOperatorLockedMaterialOrMedium) {
    const preVisionPrimaryCandidate =
      geoLookupCandidates.length > 0
        ? cleanStoneFamilyShape(String(geoLookupCandidates[0] || "").trim())
        : "";
    const preVisionBaseFamily =
      resolveCanonicalBaseFamilyForStoneCandidate(effectiveFamily) ||
      resolveCanonicalBaseFamilyForStoneCandidate(preVisionPrimaryCandidate);
    const preVisionAlreadySpecificVariety = Boolean(
      preVisionPrimaryCandidate &&
      isValidatedSpecificVarietyOfBaseFamily(
        preVisionPrimaryCandidate,
        preVisionBaseFamily
      )
    );

    if (!preVisionAlreadySpecificVariety) {
      const producedMaterialCandidate = resolveBenchV2ProducedMaterialCandidate({
        idOrigin,
        currentData,
        rawVisionSnapshot,
        provenance
      });
      const cleanedProducedVariety = producedMaterialCandidate
        ? cleanStoneFamilyShape(producedMaterialCandidate.trim())
        : "";
      const rawVisFamCandidate =
        typeof rawVisionSnapshot.stone_family === "string"
          ? cleanStoneFamilyShape(rawVisionSnapshot.stone_family.trim())
          : "";

      const targetBaseFamilyForCheck =
        preVisionBaseFamily ||
        resolveCanonicalBaseFamilyForStoneCandidate(rawVisFamCandidate) ||
        resolveCanonicalBaseFamilyForStoneCandidate(cleanedProducedVariety);

      const emergedSpecificVariety =
        cleanedProducedVariety &&
        !INVALID_CANDIDATE_FILLERS.has(cleanedProducedVariety.toLowerCase()) &&
        !isGenericBareStoneProposal(cleanedProducedVariety) &&
        !isSettingOrHardwareMediumValue(cleanedProducedVariety) &&
        isValidatedSpecificVarietyOfBaseFamily(
          cleanedProducedVariety,
          targetBaseFamilyForCheck
        )
          ? cleanedProducedVariety
          : "";

      const alreadyTriedLowerSet = new Set(
        geoLookupCandidates.map((c) => String(c || "").toLowerCase().trim())
      );

      if (
        emergedSpecificVariety &&
        !alreadyTriedLowerSet.has(emergedSpecificVariety.toLowerCase())
      ) {
        const expectedSpecificLower = emergedSpecificVariety.toLowerCase().trim();
        const relookupGeoFields = await getGeoData(
          admin,
          [emergedSpecificVariety],
          {
            requireAuthoritativeDbOnly: true,
            exactCandidatesOnly: true
          }
        );
        const relookupMeta = relookupGeoFields?._dbLookupMeta || null;
        const RELOOKUP_GEO_KEYS = Object.keys(BENCH_V2_DB_GEOLOGY_DESTINATIONS);
        const hasUsableSpecificField = Boolean(
          relookupGeoFields &&
          RELOOKUP_GEO_KEYS.some(
            (k) =>
              typeof relookupGeoFields[k] === "string" &&
              relookupGeoFields[k].trim() !== ""
          )
        );
        const isExactSpecificMatchVerified = Boolean(
          relookupMeta &&
          relookupMeta.dbLookupComplete === true &&
          !relookupMeta.dbReadError &&
          relookupMeta.dbMatchedStoneName === expectedSpecificLower &&
          (relookupGeoFields?.geoSource === "cache" ||
            relookupGeoFields?.geoSource === "database") &&
          hasUsableSpecificField
        );

        if (isExactSpecificMatchVerified) {
          nextGeoFields = relookupGeoFields;
        } else {
          const failClosedEmptyGeo = {
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
          const failClosedReadError =
            relookupMeta?.dbReadError ||
            (!relookupMeta || relookupMeta.dbLookupComplete !== true
              ? `Incomplete database lookup verification for specific stone variety "${emergedSpecificVariety}".`
              : null);
          Object.defineProperty(failClosedEmptyGeo, "_dbLookupMeta", {
            value: {
              dbLookupComplete: Boolean(
                relookupMeta?.dbLookupComplete === true && !failClosedReadError
              ),
              dbMatchedStoneName: null,
              dbCandidatesTried: [expectedSpecificLower],
              dbReadError: failClosedReadError
            },
            enumerable: false
          });
          nextGeoFields = failClosedEmptyGeo;
        }
      }
    }
  }

  return nextGeoFields;
}

export function applyBenchV2DbGeologyDiagnostics({
  geoFields,
  effectiveFamily = "",
  provenance,
  currentData = {},
  producerProposals = {},
  producerDiagnostics = {}
}) {
  const dbMeta = geoFields?._dbLookupMeta || null;
  const dbSourceLabel =
    geoFields?.geoSource === "cache"
      ? "StoneCache DB"
      : geoFields?.geoSource === "database"
        ? "StoneProfile DB"
        : null;
  const triedStoneLabel =
    Array.isArray(dbMeta?.dbCandidatesTried) && dbMeta.dbCandidatesTried.length > 0
      ? dbMeta.dbCandidatesTried.join(", ")
      : (effectiveFamily || "unknown stone");

  for (const [geoBareKey, destList] of Object.entries(BENCH_V2_DB_GEOLOGY_DESTINATIONS)) {
    const hasDbGeoValue =
      Boolean(dbSourceLabel) &&
      typeof geoFields?.[geoBareKey] === "string" &&
      geoFields[geoBareKey].trim() !== "";
    if (hasDbGeoValue) continue;

    const isCustomGeoLocked =
      provenance?.hasValidProvenance &&
      provenance.operatorLockedSet.has(geoBareKey) &&
      currentData[geoBareKey] !== undefined &&
      String(currentData[geoBareKey]).trim() !== "";

    let missingReason = "";
    if (dbMeta?.dbReadError) {
      missingReason = `Database geology query failed (${dbMeta.dbReadError}); held pending verified DB geology record (library/model guesses are not substituted).`;
    } else if (!dbSourceLabel) {
      missingReason = `No authoritative database geology record found in StoneCache or StoneProfile for "${triedStoneLabel}"; held pending verified DB record (library/model guesses are not substituted).`;
    } else {
      missingReason = `Authoritative ${dbSourceLabel} record for "${dbMeta?.dbMatchedStoneName || triedStoneLabel}" has no value for ${geoBareKey}; held blank pending verified DB evidence.`;
    }

    for (const destKey of destList) {
      if (destKey.startsWith("custom.") && isCustomGeoLocked) {
        continue;
      }
      if (!Object.prototype.hasOwnProperty.call(producerProposals, destKey)) {
        producerDiagnostics[destKey] = missingReason;
      }
    }
  }

  return producerDiagnostics;
}
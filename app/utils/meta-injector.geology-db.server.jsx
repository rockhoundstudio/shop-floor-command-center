// ==========================================================================
// ROCKHOUND STUDIO — DB GEOLOGY, CACHE/PROFILE PRECEDENCE & VARIETY RELOOKUP
// File: app/utils/meta-injector.geology-db.server.jsx
// ==========================================================================

import {
  isGenericBareStoneProposal,
  isSettingOrHardwareMediumValue
} from "./meta-injector.standardized.jsx";
import {
  INVALID_CANDIDATE_FILLERS,
  extractStoneName,
  sanitizeCandidateString,
  cleanStoneFamilyShape,
  isSupportedPicklistStoneFamily,
  resolveCanonicalBaseFamilyForStoneCandidate,
  isValidatedSpecificVarietyOfBaseFamily,
  extractValidatedInclusionFreeStoneStem,
  buildAllowedSpecificVarietyDbMatchNames,
  resolveBenchV2ProducedMaterialCandidate
} from "./meta-injector.autofill-inputs.server.jsx";

export { resolveBenchV2ProducedMaterialCandidate };

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

export function cleanProducerNonBlankVisionStr(rawVal) {
  if (typeof rawVal !== "string") return "";
  const cleaned = sanitizeCandidateString(rawVal);
  if (!cleaned) return "";
  if (INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase())) return "";
  return cleaned;
}

function createEmptyGeoResult() {
  return {
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
}

function createFailClosedGeoResultWithMeta({
  dbLookupComplete,
  dbCandidatesTried = [],
  dbReadError = null
}) {
  const empty = createEmptyGeoResult();
  Object.defineProperty(empty, "_dbLookupMeta", {
    value: {
      dbLookupComplete: Boolean(dbLookupComplete && !dbReadError),
      dbMatchedStoneName: null,
      dbCandidatesTried: Array.isArray(dbCandidatesTried) ? [...dbCandidatesTried] : [],
      dbReadError: dbReadError || null
    },
    enumerable: false
  });
  return empty;
}

export async function getGeoData(admin, stoneFamily, options = {}) {
  const {
    requireAuthoritativeDbOnly = false,
    exactCandidatesOnly = false
  } = options && typeof options === "object" ? options : {};

  const attachDbLookupMeta = Boolean(requireAuthoritativeDbOnly || exactCandidatesOnly);
  const emptyGeo = createEmptyGeoResult();

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
      INVALID_CANDIDATE_FILLERS.has(cleaned.toLowerCase()) ||
      isGenericBareStoneProposal(cleaned) ||
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

  if (fullCandidates.length === 0) {
    if (attachDbLookupMeta) {
      return createFailClosedGeoResultWithMeta({
        dbLookupComplete: true,
        dbCandidatesTried: [],
        dbReadError: null
      });
    }
    return emptyGeo;
  }

  const primaryStoneCandidate = fullCandidates[0];
  const cleanStoneName = extractStoneName(primaryStoneCandidate);
  if (
    (!primaryStoneCandidate || primaryStoneCandidate.toLowerCase() === "unknown") &&
    (!cleanStoneName || cleanStoneName === "Unknown")
  ) {
    if (attachDbLookupMeta) {
      return createFailClosedGeoResultWithMeta({
        dbLookupComplete: true,
        dbCandidatesTried: [],
        dbReadError: null
      });
    }
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

  // Authoritative-DB-only specific-variety guard:
  // When `requireAuthoritativeDbOnly` leads with a validated specific stone variety
  // (e.g. "Leopard Rhyolite with Mica Inclusions" or "Leopard Rhyolite"), allow only
  // compatible specific varieties of that same base family and their validated
  // inclusion-free variety stems — NEVER trailing generic base-family candidates
  // (such as "Rhyolite") or implicit generic `search` fallback.
  const primaryCandidateBaseFamily =
    resolveCanonicalBaseFamilyForStoneCandidate(primaryStoneCandidate);
  const isAuthoritativeSpecificVarietyLead = Boolean(
    requireAuthoritativeDbOnly &&
    primaryCandidateBaseFamily &&
    isValidatedSpecificVarietyOfBaseFamily(
      primaryStoneCandidate,
      primaryCandidateBaseFamily
    )
  );

  const dbCandidateOrder = [];
  const seenDbLower = new Set();
  const pushDbCandidate = (rawStr) => {
    if (typeof rawStr !== "string") return;
    const candidateLower = cleanStoneFamilyShape(rawStr.trim()).toLowerCase();
    if (!candidateLower || seenDbLower.has(candidateLower)) return;
    if (
      candidateLower === "unknown" ||
      candidateLower === "unknown stone" ||
      INVALID_CANDIDATE_FILLERS.has(candidateLower) ||
      isGenericBareStoneProposal(candidateLower) ||
      isSettingOrHardwareMediumValue(candidateLower)
    ) {
      return;
    }
    seenDbLower.add(candidateLower);
    dbCandidateOrder.push(candidateLower);
  };

  if (exactCandidatesOnly) {
    for (const candidate of fullCandidates) {
      pushDbCandidate(candidate);
    }
  } else if (isAuthoritativeSpecificVarietyLead) {
    for (const candidate of fullCandidates) {
      if (
        !isValidatedSpecificVarietyOfBaseFamily(
          candidate,
          primaryCandidateBaseFamily
        )
      ) {
        continue;
      }
      for (const allowedLower of buildAllowedSpecificVarietyDbMatchNames(
        candidate,
        primaryCandidateBaseFamily
      )) {
        pushDbCandidate(allowedLower);
      }
    }
  } else {
    for (const candidate of fullCandidates) {
      pushDbCandidate(candidate);
      const inclusionFreeStem = extractValidatedInclusionFreeStoneStem(candidate);
      if (
        inclusionFreeStem &&
        isValidatedSpecificVarietyOfBaseFamily(inclusionFreeStem)
      ) {
        pushDbCandidate(inclusionFreeStem);
      }
    }
    if (
      !requireAuthoritativeDbOnly &&
      search &&
      !seenDbLower.has(search)
    ) {
      pushDbCandidate(search);
    } else if (
      requireAuthoritativeDbOnly &&
      search &&
      !seenDbLower.has(search) &&
      resolveCanonicalBaseFamilyForStoneCandidate(search) !== "" &&
      primaryStoneCandidate.toLowerCase().trim() === search
    ) {
      pushDbCandidate(search);
    }
  }

  if (dbCandidateOrder.length === 0) {
    if (attachDbLookupMeta) {
      return createFailClosedGeoResultWithMeta({
        dbLookupComplete: true,
        dbCandidatesTried: [],
        dbReadError: null
      });
    }
    return emptyGeo;
  }

  let dbReadError = null;

  // 1 & 2. Authoritative Postgres Lookup by Candidate Identity Priority:
  // For each ordered candidate in dbCandidateOrder, check StoneCache first and
  // StoneProfile second for THAT candidate before moving to the next candidate.
  // Never merge a generic fallback candidate's cache/profile fields into a
  // preceding specific candidate's record.
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
    return createFailClosedGeoResultWithMeta({
      dbLookupComplete: !dbReadError,
      dbCandidatesTried: dbCandidateOrder,
      dbReadError
    });
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
 * Bounded Post-Vision Specific Variety DB Verification & Relookup (Bench V2 Opt-In Only):
 * Enforces exact specific/stem identity across BOTH pre-Vision and post-Vision paths
 * (including operator-locked `material` / `primary_medium` and `preVisionAlreadySpecificVariety`)
 * BEFORE `geoFields` reaches `verifiedGeoValues`, `tab3Data`, `buildBenchV2ProducerProposals`,
 * or `applyBenchV2DbGeologyDiagnostics`.
 *
 * - Determines the governing specific stone variety (operator-locked `material`/`primary_medium`
 *   first; otherwise produced `custom.material` variety or pre-Vision leading specific variety,
 *   unless `stone_family` was explicitly operator-locked to a bare base family without a locked
 *   specific `material`/`primary_medium`).
 * - Builds the exact allowed DB match set via `buildAllowedSpecificVarietyDbMatchNames`
 *   (full cleaned variety + validated inclusion-free variety stem, e.g.
 *   `["leopard rhyolite with mica inclusions", "leopard rhyolite"]` — never generic `"rhyolite"`).
 * - If any allowed specific candidate has not yet been queried in DB, runs ONE bounded
 *   `exactCandidatesOnly: true, requireAuthoritativeDbOnly: true` lookup for the untried
 *   allowed specific names (preserving full candidate history on `_dbLookupMeta.dbCandidatesTried`).
 * - Accepts `geoFields` ONLY when `geoSource` is `"cache"` or `"database"`,
 *   `dbLookupComplete === true`, `!dbReadError`, `dbMatchedStoneName` is in the allowed
 *   specific-variety set, and at least one usable canonical geology field exists.
 *   Note: `geological_era` on a matched specific record counts as a valid DB match for the
 *   record itself even when active Bench V2 destinations hold missing fields blank, so
 *   partial same-identity DB records retain accurate `"has no value for ..."` diagnostics
 *   while `geological_age` and `geological_era` stay strictly separate.
 * - Rejects any mismatched or generic base-family DB result (e.g. `"rhyolite"` for
 *   `"Leopard Rhyolite"`) fail-closed (`geoSource: "none"`, `dbMatchedStoneName: null`),
 *   keeping DB errors distinct from completed no-match lookups.
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
  if (!isBenchV2OptIn) {
    return geoFields;
  }

  const hasValidProvenance = Boolean(provenance?.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();

  const isBareLockedNonBlank = (bareKey) =>
    Boolean(
      hasValidProvenance &&
      operatorLockedSet.has(bareKey) &&
      currentData[bareKey] !== undefined &&
      String(currentData[bareKey]).trim() !== ""
    );

  const isMaterialLocked = isBareLockedNonBlank("material");
  const isPrimaryMediumLocked = isBareLockedNonBlank("primary_medium");
  const isStoneFamilyLocked = isBareLockedNonBlank("stone_family");

  const isStoneFamExplicitlyLockedToBaseFamily = Boolean(
    isStoneFamilyLocked &&
    !isMaterialLocked &&
    !isPrimaryMediumLocked &&
    isSupportedPicklistStoneFamily(currentData.stone_family)
  );

  const preVisionPrimaryCandidate =
    geoLookupCandidates.length > 0
      ? cleanStoneFamilyShape(String(geoLookupCandidates[0] || "").trim())
      : "";

  const lockedSpecificVarietyRaw = isMaterialLocked
    ? cleanStoneFamilyShape(String(currentData.material).trim())
    : isPrimaryMediumLocked
      ? cleanStoneFamilyShape(String(currentData.primary_medium).trim())
      : "";

  const producedMaterialCandidate = !isMaterialLocked && !isPrimaryMediumLocked
    ? resolveBenchV2ProducedMaterialCandidate({
        idOrigin,
        currentData,
        rawVisionSnapshot,
        provenance
      })
    : "";
  const cleanedProducedVariety = producedMaterialCandidate
    ? cleanStoneFamilyShape(producedMaterialCandidate.trim())
    : "";

  const rawVisFamCandidate =
    typeof rawVisionSnapshot.stone_family === "string"
      ? cleanStoneFamilyShape(rawVisionSnapshot.stone_family.trim())
      : "";

  const preVisionBaseFamily =
    resolveCanonicalBaseFamilyForStoneCandidate(effectiveFamily) ||
    resolveCanonicalBaseFamilyForStoneCandidate(preVisionPrimaryCandidate);

  const targetBaseFamilyForCheck =
    (isStoneFamilyLocked
      ? resolveCanonicalBaseFamilyForStoneCandidate(currentData.stone_family)
      : "") ||
    (lockedSpecificVarietyRaw
      ? resolveCanonicalBaseFamilyForStoneCandidate(lockedSpecificVarietyRaw)
      : "") ||
    resolveCanonicalBaseFamilyForStoneCandidate(rawVisFamCandidate) ||
    resolveCanonicalBaseFamilyForStoneCandidate(cleanedProducedVariety) ||
    preVisionBaseFamily ||
    "";

  const isValidSpecificVarietyCandidate = (candStr) =>
    Boolean(
      candStr &&
      !INVALID_CANDIDATE_FILLERS.has(candStr.toLowerCase()) &&
      !isGenericBareStoneProposal(candStr) &&
      !isSettingOrHardwareMediumValue(candStr) &&
      isValidatedSpecificVarietyOfBaseFamily(candStr, targetBaseFamilyForCheck)
    );

  // If an operator-locked material/primary_medium contains an unvalidated or ambiguous
  // non-hardware string that does NOT resolve to any supported stone family, fail closed
  // if current geoFields somehow matched a different stone identity.
  if (
    lockedSpecificVarietyRaw &&
    !isSettingOrHardwareMediumValue(lockedSpecificVarietyRaw) &&
    resolveCanonicalBaseFamilyForStoneCandidate(lockedSpecificVarietyRaw) === ""
  ) {
    const existingMeta = geoFields?._dbLookupMeta || null;
    const existingMatchedLower =
      typeof existingMeta?.dbMatchedStoneName === "string"
        ? existingMeta.dbMatchedStoneName.trim().toLowerCase()
        : "";
    if (
      existingMatchedLower &&
      existingMatchedLower !== lockedSpecificVarietyRaw.toLowerCase()
    ) {
      const triedOnAmbiguous = Array.isArray(existingMeta?.dbCandidatesTried)
        ? existingMeta.dbCandidatesTried
        : [lockedSpecificVarietyRaw.toLowerCase()];
      return createFailClosedGeoResultWithMeta({
        dbLookupComplete: existingMeta ? Boolean(existingMeta.dbLookupComplete) : true,
        dbCandidatesTried: triedOnAmbiguous,
        dbReadError: existingMeta?.dbReadError || null
      });
    }
    return geoFields;
  }

  let governingSpecificVariety = "";
  if (lockedSpecificVarietyRaw) {
    if (isValidSpecificVarietyCandidate(lockedSpecificVarietyRaw)) {
      governingSpecificVariety = lockedSpecificVarietyRaw;
    }
  } else if (!isStoneFamExplicitlyLockedToBaseFamily) {
    if (isValidSpecificVarietyCandidate(cleanedProducedVariety)) {
      governingSpecificVariety = cleanedProducedVariety;
    } else if (isValidSpecificVarietyCandidate(preVisionPrimaryCandidate)) {
      governingSpecificVariety = preVisionPrimaryCandidate;
    }
  }

  const CANONICAL_USABLE_CHECK_KEYS = [
    ...Object.keys(BENCH_V2_DB_GEOLOGY_DESTINATIONS),
    "geological_era"
  ];
  const hasAnyUsableDbField = (candidateGeo) =>
    Boolean(
      candidateGeo &&
      (candidateGeo.geoSource === "cache" || candidateGeo.geoSource === "database") &&
      CANONICAL_USABLE_CHECK_KEYS.some(
        (k) => typeof candidateGeo[k] === "string" && candidateGeo[k].trim() !== ""
      )
    );

  // If no specific variety governs this scan (i.e. plain base family such as "Rhyolite"),
  // still verify that any pre-Vision DB match belongs to the active target base family
  // (for example, if pre-Vision lacked identity or changed family post-Vision).
  if (!governingSpecificVariety) {
    if (targetBaseFamilyForCheck && geoFields && geoFields.geoSource !== "none") {
      const currentMeta = geoFields._dbLookupMeta || null;
      const currentMatchedLower =
        typeof currentMeta?.dbMatchedStoneName === "string"
          ? currentMeta.dbMatchedStoneName.trim().toLowerCase()
          : "";
      const matchedFam = currentMatchedLower
        ? resolveCanonicalBaseFamilyForStoneCandidate(currentMatchedLower)
        : "";
      const isAuthoritativeSource =
        geoFields.geoSource === "cache" || geoFields.geoSource === "database";

      if (
        !isAuthoritativeSource ||
        !currentMeta ||
        currentMeta.dbLookupComplete !== true ||
        Boolean(currentMeta.dbReadError) ||
        !matchedFam ||
        matchedFam.toLowerCase() !== targetBaseFamilyForCheck.toLowerCase()
      ) {
        const baseLower = targetBaseFamilyForCheck.toLowerCase().trim();
        const priorTried = Array.isArray(currentMeta?.dbCandidatesTried)
          ? currentMeta.dbCandidatesTried.map((c) => String(c || "").toLowerCase().trim()).filter(Boolean)
          : [];
        if (!priorTried.includes(baseLower) && admin) {
          return await getGeoData(admin, [targetBaseFamilyForCheck], {
            requireAuthoritativeDbOnly: true,
            exactCandidatesOnly: true
          });
        }
        return createFailClosedGeoResultWithMeta({
          dbLookupComplete: currentMeta ? Boolean(currentMeta.dbLookupComplete) : true,
          dbCandidatesTried: priorTried.length > 0 ? priorTried : [baseLower],
          dbReadError: currentMeta?.dbReadError || null
        });
      }
    } else if (
      targetBaseFamilyForCheck &&
      (!geoFields || geoFields.geoSource === "none") &&
      admin
    ) {
      const currentMeta = geoFields?._dbLookupMeta || null;
      const priorTried = Array.isArray(currentMeta?.dbCandidatesTried)
        ? currentMeta.dbCandidatesTried.map((c) => String(c || "").toLowerCase().trim()).filter(Boolean)
        : [];
      const baseLower = targetBaseFamilyForCheck.toLowerCase().trim();
      if (!currentMeta?.dbReadError && !priorTried.includes(baseLower)) {
        return await getGeoData(admin, [targetBaseFamilyForCheck], {
          requireAuthoritativeDbOnly: true,
          exactCandidatesOnly: true
        });
      }
    }
    return geoFields;
  }

  // Build exact allowed specific-variety DB match keys (full specific phrase + validated
  // inclusion-free variety stem; never generic base family).
  const allowedMatchOrder = [];
  const allowedMatchSet = new Set();
  const registerAllowed = (candStr) => {
    for (const allowedLower of buildAllowedSpecificVarietyDbMatchNames(
      candStr,
      targetBaseFamilyForCheck
    )) {
      if (!allowedMatchSet.has(allowedLower)) {
        allowedMatchSet.add(allowedLower);
        allowedMatchOrder.push(allowedLower);
      }
    }
  };

  registerAllowed(governingSpecificVariety);
  if (
    !lockedSpecificVarietyRaw &&
    preVisionPrimaryCandidate &&
    isValidSpecificVarietyCandidate(preVisionPrimaryCandidate)
  ) {
    registerAllowed(preVisionPrimaryCandidate);
  }

  const currentMeta = geoFields?._dbLookupMeta || null;
  const currentMatchedLower =
    typeof currentMeta?.dbMatchedStoneName === "string"
      ? currentMeta.dbMatchedStoneName.trim().toLowerCase()
      : "";
  const priorDbTriedLower = Array.isArray(currentMeta?.dbCandidatesTried)
    ? currentMeta.dbCandidatesTried
        .filter((c) => typeof c === "string" && c.trim() !== "")
        .map((c) => c.trim().toLowerCase())
    : [];

  const isCurrentGeoVerifiedSpecificMatch = Boolean(
    currentMeta &&
    currentMeta.dbLookupComplete === true &&
    !currentMeta.dbReadError &&
    currentMatchedLower &&
    allowedMatchSet.has(currentMatchedLower) &&
    hasAnyUsableDbField(geoFields)
  );

  // If pre-Vision already matched the primary preferred allowed candidate (or matched an
  // allowed stem after already trying any preceding allowed candidate), keep it directly.
  if (isCurrentGeoVerifiedSpecificMatch) {
    const primaryAllowedLower = allowedMatchOrder[0] || "";
    if (
      !primaryAllowedLower ||
      currentMatchedLower === primaryAllowedLower ||
      priorDbTriedLower.includes(primaryAllowedLower)
    ) {
      return geoFields;
    }
  }

  // Determine which allowed specific candidates have NOT yet been queried in Postgres
  // (excluding any generic base-family candidates from relookup).
  const priorTriedSet = new Set(priorDbTriedLower);
  const untriedAllowedCandidates = allowedMatchOrder.filter(
    (candLower) => !priorTriedSet.has(candLower)
  );

  // Build clean specific-only tried list for accurate fail-closed diagnostics
  // (preserving exact specific candidates tried in order, without generic fallback noise).
  const combinedSpecificTried = [];
  const seenCombinedSpecific = new Set();
  const pushCombinedTried = (candLower) => {
    if (!candLower || seenCombinedSpecific.has(candLower)) return;
    if (
      targetBaseFamilyForCheck &&
      candLower === targetBaseFamilyForCheck.toLowerCase().trim()
    ) {
      return;
    }
    seenCombinedSpecific.add(candLower);
    combinedSpecificTried.push(candLower);
  };

  // Record allowed candidates that were already tried pre-Vision in their executed order,
  // followed by newly queried allowed candidates.
  for (const prevLower of priorDbTriedLower) {
    if (allowedMatchSet.has(prevLower)) {
      pushCombinedTried(prevLower);
    }
  }

  if (!currentMeta?.dbReadError && untriedAllowedCandidates.length > 0 && admin) {
    for (const nextCandLower of untriedAllowedCandidates) {
      pushCombinedTried(nextCandLower);
    }

    const relookupGeoFields = await getGeoData(
      admin,
      untriedAllowedCandidates,
      {
        requireAuthoritativeDbOnly: true,
        exactCandidatesOnly: true
      }
    );
    const relookupMeta = relookupGeoFields?._dbLookupMeta || null;
    const relookupMatchedLower =
      typeof relookupMeta?.dbMatchedStoneName === "string"
        ? relookupMeta.dbMatchedStoneName.trim().toLowerCase()
        : "";

    const isRelookupVerifiedSpecificMatch = Boolean(
      relookupMeta &&
      relookupMeta.dbLookupComplete === true &&
      !relookupMeta.dbReadError &&
      relookupMatchedLower &&
      allowedMatchSet.has(relookupMatchedLower) &&
      hasAnyUsableDbField(relookupGeoFields)
    );

    if (isRelookupVerifiedSpecificMatch) {
      Object.defineProperty(relookupGeoFields, "_dbLookupMeta", {
        value: {
          dbLookupComplete: true,
          dbMatchedStoneName: relookupMatchedLower,
          dbCandidatesTried:
            combinedSpecificTried.length > 0
              ? combinedSpecificTried
              : [relookupMatchedLower],
          dbReadError: null
        },
        enumerable: false
      });
      return relookupGeoFields;
    }

    if (isCurrentGeoVerifiedSpecificMatch && !relookupMeta?.dbReadError) {
      Object.defineProperty(geoFields, "_dbLookupMeta", {
        value: {
          dbLookupComplete: true,
          dbMatchedStoneName: currentMatchedLower,
          dbCandidatesTried:
            combinedSpecificTried.length > 0
              ? combinedSpecificTried
              : [currentMatchedLower],
          dbReadError: null
        },
        enumerable: false
      });
      return geoFields;
    }

    const relookupReadError =
      relookupMeta?.dbReadError ||
      (!relookupMeta || relookupMeta.dbLookupComplete !== true
        ? `Incomplete database lookup verification for specific stone variety "${governingSpecificVariety}".`
        : null);

    return createFailClosedGeoResultWithMeta({
      dbLookupComplete: Boolean(
        relookupMeta?.dbLookupComplete === true && !relookupReadError
      ),
      dbCandidatesTried:
        combinedSpecificTried.length > 0
          ? combinedSpecificTried
          : [...allowedMatchOrder],
      dbReadError: relookupReadError
    });
  }

  // All allowed specific candidates were already tried pre-Vision (or pre-Vision encountered
  // a DB read error), and any existing match was NOT a verified allowed specific variety
  // (e.g. a rejected generic base-family match or completed 0-row result): fail closed.
  for (const allowedLower of allowedMatchOrder) {
    if (priorTriedSet.has(allowedLower)) {
      pushCombinedTried(allowedLower);
    }
  }
  const finalTriedList =
    combinedSpecificTried.length > 0
      ? combinedSpecificTried
      : [...allowedMatchOrder];

  const preVisionReadError =
    currentMeta?.dbReadError ||
    (!currentMeta || currentMeta.dbLookupComplete !== true
      ? `Incomplete database lookup verification for specific stone variety "${governingSpecificVariety}".`
      : null);

  return createFailClosedGeoResultWithMeta({
    dbLookupComplete: Boolean(
      currentMeta?.dbLookupComplete === true && !preVisionReadError
    ),
    dbCandidatesTried: finalTriedList,
    dbReadError: preVisionReadError
  });
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
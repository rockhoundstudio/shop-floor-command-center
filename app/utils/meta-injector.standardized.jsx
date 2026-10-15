export const ALLOWED_VISION_CANDIDATE_KEYS = [
  "chain-link-type",
  "construction",
  "jewelry-finding-type",
  "material-origin",
  "product-classification",
  "product-use"
];

export const VERIFIED_STANDARDIZED_DESTINATIONS = ALLOWED_VISION_CANDIDATE_KEYS.map(
  (k) => `shopify.${k}`
);

export const isVerifiedStandardizedDestination = (key) => {
  return VERIFIED_STANDARDIZED_DESTINATIONS.includes(key);
};

export const isExactMetaobjectGid = (val) => {
  if (typeof val !== "string") return false;
  return /^gid:\/\/shopify\/Metaobject\/[0-9]+$/.test(val.trim());
};

export const extractNumericMetaobjectId = (gid) => {
  if (!isExactMetaobjectGid(gid)) return null;
  const match = gid.trim().match(/^gid:\/\/shopify\/Metaobject\/([0-9]+)$/);
  if (!match) return null;
  try {
    return BigInt(match[1]);
  } catch (e) {
    return null;
  }
};

export const normalizeCandidateLabel = (str) => {
  if (typeof str !== "string") return "";
  return str.trim().replace(/\s+/g, " ").toLowerCase();
};

export const extractEntryGid = (entry) => {
  if (!entry || typeof entry !== "object") return "";
  const raw = entry.id || entry.gid || "";
  return typeof raw === "string" ? raw.trim() : "";
};

export const extractEntryLabel = (entry) => {
  if (!entry || typeof entry !== "object") return "";
  const raw = entry.displayName ?? entry.label ?? entry.name ?? entry.title ?? entry.value ?? "";
  return typeof raw === "string" ? raw.trim() : "";
};

export const extractEntryDefinitionId = (entry) => {
  if (!entry || typeof entry !== "object") return "";
  const def = entry.definition ?? entry.definitionId ?? entry.metaobjectDefinitionId ?? "";
  if (typeof def === "string" || typeof def === "number") return String(def).trim();
  if (def && typeof def === "object") {
    const nested = def.id || def.gid || "";
    if (typeof nested === "string" || typeof nested === "number") return String(nested).trim();
  }
  return "";
};

export const extractEntryTaxonomyRef = (entry) => {
  if (!entry || typeof entry !== "object") return "";
  const tax = entry.taxonomy_reference ?? entry.taxonomyReference ?? entry.taxonomyValueId ?? "";
  if (typeof tax === "string" || typeof tax === "number") return String(tax).trim();
  if (tax && typeof tax === "object") {
    const nested = tax.id || tax.gid || tax.value || "";
    if (typeof nested === "string" || typeof nested === "number") return String(nested).trim();
  }
  return "";
};

export const parseMetaobjectGidArray = (rawVal) => {
  if (rawVal === undefined || rawVal === null || rawVal === "") return [];
  let arr = [];
  if (Array.isArray(rawVal)) {
    arr = rawVal;
  } else if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    if (!trimmed || trimmed === "[]") return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) arr = parsed;
        else return [];
      } catch (e) {
        return [];
      }
    } else if (isExactMetaobjectGid(trimmed)) {
      arr = [trimmed];
    } else {
      return [];
    }
  } else {
    return [];
  }

  const result = [];
  arr.forEach((item) => {
    let gid = "";
    if (typeof item === "string") gid = item.trim();
    else if (item && typeof item === "object") {
      const id = item.id || item.gid || item.value;
      if (typeof id === "string") gid = id.trim();
    }
    if (isExactMetaobjectGid(gid) && !result.includes(gid)) {
      result.push(gid);
    }
  });
  return result;
};

const inspectAndExtractStoredReferenceSource = (sourceVal, sourceLabel) => {
  if (sourceVal === undefined || sourceVal === null || sourceVal === "") {
    return { valid: true, gids: [], reason: "" };
  }

  if (typeof sourceVal === "string") {
    const trimmed = sourceVal.trim();
    if (trimmed === "" || trimmed === "[]") {
      return { valid: true, gids: [], reason: "" };
    }
    if (isExactMetaobjectGid(trimmed)) {
      return { valid: true, gids: [trimmed], reason: "" };
    }
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (!Array.isArray(parsed)) {
          return {
            valid: false,
            gids: [],
            reason: `Existing assignment preservation cannot be established: ${sourceLabel} is not a JSON array.`
          };
        }
        const extracted = [];
        for (const item of parsed) {
          let gid = "";
          if (typeof item === "string") gid = item.trim();
          else if (item && typeof item === "object") {
            const id = item.id || item.gid || item.value;
            if (typeof id === "string") gid = id.trim();
          }
          if (!isExactMetaobjectGid(gid)) {
            return {
              valid: false,
              gids: [],
              reason: `Existing assignment preservation cannot be established: ${sourceLabel} contains non-Metaobject GID item "${String(item)}".`
            };
          }
          if (!extracted.includes(gid)) extracted.push(gid);
        }
        return { valid: true, gids: extracted, reason: "" };
      } catch (e) {
        return {
          valid: false,
          gids: [],
          reason: `Existing assignment preservation cannot be established: ${sourceLabel} contains malformed JSON.`
        };
      }
    }
    return {
      valid: false,
      gids: [],
      reason: `Existing assignment preservation cannot be established: ${sourceLabel} has unrecognized non-empty value.`
    };
  }

  if (Array.isArray(sourceVal)) {
    const extracted = [];
    for (const item of sourceVal) {
      let gid = "";
      if (typeof item === "string") gid = item.trim();
      else if (item && typeof item === "object") {
        const id = item.id || item.gid || item.value;
        if (typeof id === "string") gid = id.trim();
      }
      if (!isExactMetaobjectGid(gid)) {
        return {
          valid: false,
          gids: [],
          reason: `Existing assignment preservation cannot be established: ${sourceLabel} array contains invalid Metaobject GID "${String(item)}".`
        };
      }
      if (!extracted.includes(gid)) extracted.push(gid);
    }
    return { valid: true, gids: extracted, reason: "" };
  }

  if (typeof sourceVal === "object") {
    if (sourceVal.readComplete === false) {
      return {
        valid: false,
        gids: parseMetaobjectGidArray(sourceVal.referenceIds ?? sourceVal.rawValue),
        reason: `Existing assignment preservation cannot be established: ${sourceLabel} read did not complete (readComplete: false).`
      };
    }
    if (sourceVal.parseValid === false || Boolean(sourceVal.parseError)) {
      return {
        valid: false,
        gids: [],
        reason: `Existing assignment preservation cannot be established: ${sourceLabel} reported parse error (${sourceVal.parseError || "parseValid: false"}).`
      };
    }

    const hasRefIdsProp = Object.prototype.hasOwnProperty.call(sourceVal, "referenceIds");
    const hasRawValProp = Object.prototype.hasOwnProperty.call(sourceVal, "rawValue");

    if (!hasRefIdsProp && !hasRawValProp) {
      return {
        valid: false,
        gids: [],
        reason: `Existing assignment preservation cannot be established: ${sourceLabel} object is missing referenceIds and rawValue.`
      };
    }

    const combined = [];
    if (hasRefIdsProp) {
      if (!Array.isArray(sourceVal.referenceIds)) {
        return {
          valid: false,
          gids: [],
          reason: `Existing assignment preservation cannot be established: ${sourceLabel}.referenceIds is not an array.`
        };
      }
      const refIdsCheck = inspectAndExtractStoredReferenceSource(
        sourceVal.referenceIds,
        `${sourceLabel}.referenceIds`
      );
      if (!refIdsCheck.valid) return refIdsCheck;
      refIdsCheck.gids.forEach((gid) => {
        if (!combined.includes(gid)) combined.push(gid);
      });
    }

    if (hasRawValProp && sourceVal.rawValue !== undefined && sourceVal.rawValue !== null && String(sourceVal.rawValue).trim() !== "") {
      const rawValCheck = inspectAndExtractStoredReferenceSource(
        sourceVal.rawValue,
        `${sourceLabel}.rawValue`
      );
      if (!rawValCheck.valid) return rawValCheck;
      rawValCheck.gids.forEach((gid) => {
        if (!combined.includes(gid)) combined.push(gid);
      });
    }

    return { valid: true, gids: combined, reason: "" };
  }

  return {
    valid: false,
    gids: [],
    reason: `Existing assignment preservation cannot be established: ${sourceLabel} has unsupported data type.`
  };
};

export const collectVerifiedEntriesForResolution = (fieldResolution) => {
  const map = new Map();
  if (!fieldResolution || typeof fieldResolution !== "object") return map;

  const addEntry = (entry) => {
    if (!entry || typeof entry !== "object") return;
    const gid = extractEntryGid(entry);
    if (!isExactMetaobjectGid(gid)) return;
    const existing = map.get(gid) || {};
    const label = extractEntryLabel(entry) || existing.label || "";
    const definitionId = extractEntryDefinitionId(entry) || existing.definitionId || "";
    const taxonomyRef = extractEntryTaxonomyRef(entry) || existing.taxonomyRef || "";
    map.set(gid, {
      id: gid,
      label,
      definitionId,
      taxonomyRef
    });
  };

  if (Array.isArray(fieldResolution.availableEntries)) {
    fieldResolution.availableEntries.forEach(addEntry);
  }

  const lr = fieldResolution.labelResolutions;
  if (Array.isArray(lr)) {
    lr.forEach((item) => {
      if (!item || typeof item !== "object") return;
      if (Array.isArray(item.matches)) item.matches.forEach(addEntry);
      if (Array.isArray(item.entries)) item.entries.forEach(addEntry);
      if (Array.isArray(item.candidates)) item.candidates.forEach(addEntry);
      if (item.matchedEntry) addEntry(item.matchedEntry);
      if (item.entry) addEntry(item.entry);
    });
  } else if (lr && typeof lr === "object") {
    Object.values(lr).forEach((val) => {
      if (Array.isArray(val)) {
        val.forEach(addEntry);
      } else if (val && typeof val === "object") {
        if (Array.isArray(val.matches)) val.matches.forEach(addEntry);
        if (Array.isArray(val.entries)) val.entries.forEach(addEntry);
        if (Array.isArray(val.candidates)) val.candidates.forEach(addEntry);
        if (val.matchedEntry) addEntry(val.matchedEntry);
        if (val.entry) addEntry(val.entry);
        if (val.id || val.gid) addEntry(val);
      }
    });
  }

  return map;
};

export const findLabelMatchEntries = (candLabel, fieldResolution, verifiedEntriesMap) => {
  const normTarget = normalizeCandidateLabel(candLabel);
  if (!normTarget) return [];

  const matchedGids = new Set();

  const lr = fieldResolution?.labelResolutions;
  const inspectResolutionItem = (item) => {
    if (!item || typeof item !== "object") return;
    const list = item.matches || item.entries || item.candidates || [];
    if (Array.isArray(list)) {
      list.forEach((m) => {
        const gid = typeof m === "string" ? m.trim() : extractEntryGid(m);
        if (isExactMetaobjectGid(gid) && verifiedEntriesMap.has(gid)) {
          const entryObj = verifiedEntriesMap.get(gid);
          if (!entryObj.label || normalizeCandidateLabel(entryObj.label) === normTarget) {
            matchedGids.add(gid);
          }
        }
      });
    }
    const single = item.matchedEntry || item.entry;
    if (single) {
      const gid = typeof single === "string" ? single.trim() : extractEntryGid(single);
      if (isExactMetaobjectGid(gid) && verifiedEntriesMap.has(gid)) {
        const entryObj = verifiedEntriesMap.get(gid);
        if (!entryObj.label || normalizeCandidateLabel(entryObj.label) === normTarget) {
          matchedGids.add(gid);
        }
      }
    }
  };

  if (Array.isArray(lr)) {
    lr.forEach((item) => {
      if (!item || typeof item !== "object") return;
      const itemLbl = item.label ?? item.candidateLabel ?? item.candidate ?? item.name ?? "";
      if (normalizeCandidateLabel(itemLbl) === normTarget) {
        inspectResolutionItem(item);
      }
    });
  } else if (lr && typeof lr === "object") {
    Object.entries(lr).forEach(([k, val]) => {
      if (normalizeCandidateLabel(k) === normTarget) {
        if (Array.isArray(val)) {
          val.forEach((m) => {
            const gid = typeof m === "string" ? m.trim() : extractEntryGid(m);
            if (isExactMetaobjectGid(gid) && verifiedEntriesMap.has(gid)) {
              matchedGids.add(gid);
            }
          });
        } else if (val && typeof val === "object") {
          inspectResolutionItem(val);
        }
      }
    });
  }

  verifiedEntriesMap.forEach((entry, gid) => {
    if (normalizeCandidateLabel(entry.label) === normTarget) {
      matchedGids.add(gid);
    }
  });

  return Array.from(matchedGids)
    .map((gid) => verifiedEntriesMap.get(gid))
    .filter(Boolean);
};

export const evaluateCandidateLabelResolution = (candLabel, fieldResolution, verifiedEntriesMap, existingAssignedGids) => {
  const normTarget = normalizeCandidateLabel(candLabel);
  if (!normTarget) {
    return { status: "blocked", reason: "Blank candidate label.", selectedEntry: null, matchingEntries: [] };
  }

  const matchingEntries = findLabelMatchEntries(candLabel, fieldResolution, verifiedEntriesMap);

  if (matchingEntries.length === 0) {
    return {
      status: "missing_entry",
      reason: `No matching verified Metaobject entry found for "${candLabel}".`,
      selectedEntry: null,
      matchingEntries: []
    };
  }

  if (matchingEntries.length === 1) {
    const only = matchingEntries[0];
    if (!isExactMetaobjectGid(only.id)) {
      return {
        status: "blocked",
        reason: `Matched entry for "${candLabel}" does not have a valid Metaobject GID.`,
        selectedEntry: null,
        matchingEntries
      };
    }
    return {
      status: "unique",
      reason: `Uniquely matched "${only.label || candLabel}" (${only.id}).`,
      selectedEntry: only,
      matchingEntries
    };
  }

  // Multiple entries matched: verify strict equivalence rules
  // Must share same normalized label, restricted definition ID, and nonblank taxonomy_reference
  const firstNormLabel = normalizeCandidateLabel(matchingEntries[0].label || candLabel);
  const firstDefId = matchingEntries[0].definitionId;
  const firstTaxRef = matchingEntries[0].taxonomyRef;

  const allHaveRequiredMetadata = matchingEntries.every((e) => {
    const eNorm = normalizeCandidateLabel(e.label || candLabel);
    const numId = extractNumericMetaobjectId(e.id);
    return (
      numId !== null &&
      eNorm !== "" &&
      eNorm === firstNormLabel &&
      Boolean(e.definitionId) &&
      e.definitionId === firstDefId &&
      Boolean(e.taxonomyRef) &&
      e.taxonomyRef === firstTaxRef
    );
  });

  if (!allHaveRequiredMetadata) {
    return {
      status: "ambiguous_blocked",
      reason: `Non-equivalent ambiguity for "${candLabel}": ${matchingEntries.length} entries do not share identical normalized label, restricted definition ID, and nonblank taxonomy_reference.`,
      selectedEntry: null,
      matchingEntries
    };
  }

  const existingSet = new Set(existingAssignedGids || []);
  const alreadyAssignedMatches = matchingEntries.filter((e) => existingSet.has(e.id));

  const sortByLowestNumericId = (list) => {
    return [...list].sort((a, b) => {
      const numA = extractNumericMetaobjectId(a.id);
      const numB = extractNumericMetaobjectId(b.id);
      if (numA === null && numB === null) return a.id.localeCompare(b.id);
      if (numA === null) return 1;
      if (numB === null) return -1;
      if (numA < numB) return -1;
      if (numA > numB) return 1;
      return 0;
    });
  };

  if (alreadyAssignedMatches.length > 0) {
    const sortedAssigned = sortByLowestNumericId(alreadyAssignedMatches);
    const chosen = sortedAssigned[0];
    return {
      status: "equivalent_existing",
      reason: `Equivalent duplicate entries for "${candLabel}" (Def: ${firstDefId}, Taxonomy: ${firstTaxRef}); preferred entry already assigned to product (${chosen.id}).`,
      selectedEntry: chosen,
      matchingEntries: sortByLowestNumericId(matchingEntries)
    };
  }

  const sortedAll = sortByLowestNumericId(matchingEntries);
  const chosenNew = sortedAll[0];
  return {
    status: "equivalent_lowest_new",
    reason: `Equivalent duplicate entries for "${candLabel}" (Def: ${firstDefId}, Taxonomy: ${firstTaxRef}); selected lowest numeric Metaobject ID (${chosenNew.id}) for new assignment.`,
    selectedEntry: chosenNew,
    matchingEntries: sortedAll
  };
};

export const evaluateStandardizedDestinationTechnicalStatus = ({
  destinationKey,
  productId,
  data,
  candidateBundle,
  refMatchResult,
  refMatchStatus
}) => {
  if (!isVerifiedStandardizedDestination(destinationKey)) {
    return {
      isVerifiedDestination: false,
      isTechnicallyEligible: false,
      blockReason: "Standardized attribute read-only (pending_read_only)",
      verifiedEntriesMap: new Map(),
      existingGids: [],
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  const metaKey = destinationKey.slice(8);
  const currentMetafieldRaw = data?.currentMetafields?.[destinationKey];
  const fieldResolution = refMatchResult?.resolutions?.[destinationKey] || null;
  const refListRaw =
    refMatchResult?.currentReferenceLists?.[destinationKey] ??
    refMatchResult?.currentReferenceLists?.[metaKey] ??
    fieldResolution?.currentAssignment;

  const manifestCheck = inspectAndExtractStoredReferenceSource(
    currentMetafieldRaw,
    `manifest.currentMetafields["${destinationKey}"]`
  );
  const refListCheck = inspectAndExtractStoredReferenceSource(
    refListRaw,
    `currentReferenceLists["${destinationKey}"]`
  );
  const resolutionAssignmentCheck =
    fieldResolution?.currentAssignment !== undefined && fieldResolution?.currentAssignment !== refListRaw
      ? inspectAndExtractStoredReferenceSource(
          fieldResolution.currentAssignment,
          `resolutions["${destinationKey}"].currentAssignment`
        )
      : { valid: true, gids: [], reason: "" };

  const existingGids = [...manifestCheck.gids];
  refListCheck.gids.forEach((gid) => {
    if (!existingGids.includes(gid)) existingGids.push(gid);
  });
  resolutionAssignmentCheck.gids.forEach((gid) => {
    if (!existingGids.includes(gid)) existingGids.push(gid);
  });

  const candidateEntry = candidateBundle?.ordered?.[metaKey] || null;
  const hasCandidateLabels = Boolean(candidateEntry && Array.isArray(candidateEntry.labels) && candidateEntry.labels.length > 0);

  if (!hasCandidateLabels) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: "No Vision standardized candidate staged for this attribute.",
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (!refMatchResult) {
    const stateHint = refMatchStatus?.state === "discarded_stale"
      ? "Reference match result is stale for current candidates. Click 'Match Reference Choices' to re-validate."
      : "Reference matching required. Click 'Match Reference Choices' to validate candidate entries.";
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: stateHint,
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (
    refMatchResult.pieceId !== productId ||
    refMatchResult.intent !== "resolveStandardizedCandidates" ||
    refMatchResult.readOnly !== true
  ) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: "Reference match result failed product or contract identity verification.",
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (refMatchResult.snapshot !== candidateBundle.snapshot) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: "Stale reference match result: candidate snapshot changed. Re-run 'Match Reference Choices'.",
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (!refMatchResult.success || !refMatchResult.isComplete || (Array.isArray(refMatchResult.errors) && refMatchResult.errors.length > 0)) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: "Incomplete or errored top-level reference matching result. Re-run 'Match Reference Choices'.",
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (!fieldResolution || typeof fieldResolution !== "object") {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: `Missing backend resolution entry for ${destinationKey}.`,
      verifiedEntriesMap: new Map(),
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  const verifiedEntriesMap = collectVerifiedEntriesForResolution(fieldResolution);

  // Do not interpret missing, malformed or incomplete reference data as proof that the product has no assignments
  if (refListRaw === undefined || refListRaw === null) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: `Existing assignment preservation cannot be established: missing currentReferenceLists entry for ${destinationKey}.`,
      verifiedEntriesMap,
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  if (!manifestCheck.valid || !refListCheck.valid || !resolutionAssignmentCheck.valid) {
    const preservationError =
      manifestCheck.reason ||
      refListCheck.reason ||
      resolutionAssignmentCheck.reason ||
      `Existing assignment preservation cannot be established for ${destinationKey}.`;
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: preservationError,
      verifiedEntriesMap,
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  const fieldErrors = formatErrorsList(fieldResolution.errors || fieldResolution.error);
  const hasContinuation =
    fieldResolution.continuation !== undefined &&
    fieldResolution.continuation !== null &&
    formatStructuredDiagValue(fieldResolution.continuation) !== "{}" &&
    formatStructuredDiagValue(fieldResolution.continuation) !== "null";

  if (fieldResolution.isComplete !== true || fieldErrors.length > 0 || hasContinuation) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: `Incomplete reference enumeration for ${destinationKey} (${fieldErrors[0] || "continuation pending"}).`,
      verifiedEntriesMap,
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations: []
    };
  }

  const labelEvaluations = candidateEntry.labels.map((lbl) =>
    evaluateCandidateLabelResolution(lbl, fieldResolution, verifiedEntriesMap, existingGids)
  );

  const failedEval = labelEvaluations.find(
    (ev) => ev.status === "missing_entry" || ev.status === "ambiguous_blocked" || ev.status === "blocked" || !ev.selectedEntry
  );

  if (failedEval) {
    return {
      isVerifiedDestination: true,
      isTechnicallyEligible: false,
      blockReason: failedEval.reason,
      verifiedEntriesMap,
      existingGids,
      autoProposedGids: [],
      autoProposalSerialized: "",
      labelEvaluations
    };
  }

  // Merge existing assigned GIDs first so existing assignments are never deleted or replaced
  const mergedGids = [...existingGids];
  labelEvaluations.forEach((ev) => {
    const gid = ev.selectedEntry?.id;
    if (isExactMetaobjectGid(gid) && !mergedGids.includes(gid)) {
      mergedGids.push(gid);
    }
  });

  return {
    isVerifiedDestination: true,
    isTechnicallyEligible: true,
    blockReason: "",
    verifiedEntriesMap,
    existingGids,
    autoProposedGids: mergedGids,
    autoProposalSerialized: mergedGids.length > 0 ? JSON.stringify(mergedGids) : "",
    labelEvaluations
  };
};

export const validateProposedStandardizedGidList = (rawPropVal, evalResult) => {
  if (!evalResult?.isTechnicallyEligible) {
    return { valid: false, reason: evalResult?.blockReason || "Reference matching not complete." };
  }
  if (typeof rawPropVal !== "string" || !rawPropVal.trim().startsWith("[")) {
    return { valid: false, reason: "Proposal must be a serialized JSON array of exact Metaobject GIDs." };
  }
  let parsed;
  try {
    parsed = JSON.parse(rawPropVal.trim());
  } catch (e) {
    return { valid: false, reason: "Proposal is not valid JSON array." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { valid: false, reason: "Proposal array cannot be empty." };
  }

  for (const item of parsed) {
    if (!isExactMetaobjectGid(item)) {
      return { valid: false, reason: `Invalid entry ID "${String(item)}": must be an exact Metaobject GID (never TaxonomyValue or Definition ID).` };
    }
  }

  const uniqueCheck = new Set(parsed);
  if (uniqueCheck.size !== parsed.length) {
    return { valid: false, reason: "Proposal contains duplicate Metaobject GIDs." };
  }

  for (const existingGid of evalResult.existingGids) {
    if (!uniqueCheck.has(existingGid)) {
      return { valid: false, reason: `Proposal is missing existing assigned entry ${existingGid}. Existing assignments are never deleted or replaced.` };
    }
  }

  const existingSet = new Set(evalResult.existingGids);
  for (const gid of parsed) {
    if (!existingSet.has(gid) && !evalResult.verifiedEntriesMap.has(gid)) {
      return { valid: false, reason: `Selected entry ${gid} is not in the current verified reference entries for this attribute.` };
    }
  }

  return { valid: true, reason: "", gids: parsed };
};

export const isGeneratedReferenceId = (val) => {
  if (typeof val !== "string") return true;
  const trimmed = val.trim();
  if (!trimmed) return true;
  if (/^gid:\/\/shopify\//i.test(trimmed)) return true;
  if (/^shopify:\/\/metaobject/i.test(trimmed)) return true;
  if (/^metaobject[:/]/i.test(trimmed)) return true;
  if (/^[0-9]+$/.test(trimmed)) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return true;
  if (trimmed === "[object Object]") return true;
  return false;
};

export const sanitizeStandardizedCandidates = (rawContainer) => {
  const sanitized = {};
  if (!rawContainer || typeof rawContainer !== "object" || Array.isArray(rawContainer)) {
    return sanitized;
  }

  ALLOWED_VISION_CANDIDATE_KEYS.forEach((allowedKey) => {
    const entry = rawContainer[allowedKey] ?? rawContainer[`shopify.${allowedKey}`];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;

    const rawLabels = Array.isArray(entry.labels) ? entry.labels : [];
    const validLabels = rawLabels
      .filter((lbl) => typeof lbl === "string")
      .map((lbl) => lbl.trim())
      .filter((lbl) => lbl.length > 0 && !isGeneratedReferenceId(lbl));

    const validEvidence =
      typeof entry.evidence === "string" && entry.evidence.trim() !== "[object Object]"
        ? entry.evidence.trim()
        : "";

    if (validLabels.length > 0 && validEvidence.length > 0) {
      sanitized[allowedKey] = {
        labels: validLabels,
        evidence: validEvidence
      };
    }
  });

  return sanitized;
};

export const buildCanonicalCandidateBundle = (rawContainer) => {
  const sanitized = sanitizeStandardizedCandidates(rawContainer);
  const ordered = {};
  ALLOWED_VISION_CANDIDATE_KEYS.forEach((k) => {
    if (sanitized[k]) {
      ordered[k] = {
        labels: [...sanitized[k].labels],
        evidence: sanitized[k].evidence
      };
    }
  });
  const count = Object.keys(ordered).length;
  return {
    ordered,
    snapshot: JSON.stringify(ordered),
    count,
    hasSupported: count > 0
  };
};

export const buildCanonicalCandidateSnapshot = (rawContainer) => {
  return buildCanonicalCandidateBundle(rawContainer).snapshot;
};

export const formatStructuredDiagValue = (val) => {
  if (val === undefined || val === null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  try {
    return JSON.stringify(val, null, 2);
  } catch (e) {
    return "";
  }
};

export const formatErrorsList = (rawErrors) => {
  if (!rawErrors) return [];
  if (typeof rawErrors === "string") {
    return rawErrors.trim() && rawErrors.trim() !== "[object Object]" ? [rawErrors.trim()] : [];
  }
  if (Array.isArray(rawErrors)) {
    return rawErrors
      .map((item) => {
        if (typeof item === "string") return item.trim() !== "[object Object]" ? item.trim() : "";
        if (item && typeof item === "object") {
          const msg = item.message || item.error || item.reason || item.code;
          if (typeof msg === "string" && msg.trim() && msg.trim() !== "[object Object]") {
            return item.field ? `${item.field}: ${msg.trim()}` : msg.trim();
          }
          return formatStructuredDiagValue(item);
        }
        return String(item ?? "");
      })
      .filter(Boolean);
  }
  if (typeof rawErrors === "object") {
    const formatted = formatStructuredDiagValue(rawErrors);
    return formatted && formatted !== "{}" ? [formatted] : [];
  }
  return [];
};

export const serializeStandardizedAssignmentForVision = (rawVal) => {
  if (rawVal === undefined || rawVal === null) return "";
  if (Array.isArray(rawVal)) {
    const cleaned = rawVal
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const id = item.id || item.gid || item.value;
          return typeof id === "string" ? id.trim() : "";
        }
        return "";
      })
      .filter(Boolean);
    return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
  }
  if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    if (!trimmed || trimmed === "[]" || trimmed === "{}" || trimmed === "[object Object]") return "";
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
          return cleaned.length > 0 ? JSON.stringify(cleaned) : "";
        }
      } catch (e) {
        return trimmed;
      }
    }
    return trimmed;
  }
  return "";
};

export const formatDisplayFieldValue = (rawVal, isStandardized, data, verifiedEntriesMap = null) => {
  if (rawVal === undefined || rawVal === null || rawVal === "") return "";

  const labelLookup =
    data?.referenceLabels ||
    data?.metaobjectLabels ||
    data?.standardizedLabels ||
    data?.resolvedReferenceLabels ||
    null;

  const resolveSingleItem = (item) => {
    if (item === undefined || item === null) return "";
    if (typeof item === "string") {
      if (verifiedEntriesMap && verifiedEntriesMap.has(item)) {
        const entry = verifiedEntriesMap.get(item);
        if (entry?.label) return `${entry.label} (${item})`;
      }
      if (labelLookup && typeof labelLookup === "object" && labelLookup[item]) {
        return `${labelLookup[item]} (${item})`;
      }
      return item;
    }
    if (typeof item === "object") {
      const label = item.label || item.displayName || item.name || item.title || item.value;
      const id = item.id || item.gid;
      if (label && id) return `${label} (${id})`;
      if (label) return String(label);
      if (id) return String(id);
      return JSON.stringify(item);
    }
    return String(item);
  };

  if (Array.isArray(rawVal)) {
    if (rawVal.length === 0) return "";
    if (isStandardized || rawVal.length > 1) {
      return rawVal.map(resolveSingleItem).join(", ");
    }
    return resolveSingleItem(rawVal[0]);
  }

  if (typeof rawVal === "string") {
    const trimmed = rawVal.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          if (parsed.length === 0) return "";
          if (isStandardized || parsed.length > 1) {
            return parsed.map(resolveSingleItem).join(", ");
          }
          return resolveSingleItem(parsed[0]);
        }
      } catch (e) {
        return rawVal;
      }
    } else if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed);
        return JSON.stringify(obj);
      } catch (e) {
        return rawVal;
      }
    }
    return resolveSingleItem(rawVal);
  }

  if (typeof rawVal === "object") {
    return JSON.stringify(rawVal);
  }

  return String(rawVal);
};

export const validArray = (arr) => Array.isArray(arr) ? arr : [];
export const validObj = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};
import { PRODUCT_TEMPLATE_GROUPS } from "./meta-injector.constants.jsx";
import {
  isVerifiedStandardizedDestination,
  validateProposedStandardizedGidList
} from "./meta-injector.standardized.jsx";

export const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  COMPLETE: "Repaired",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

export const BLOCKED_UNVERIFIED_PINS = [
  "custom.jewelry_type"
];

export const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.alt_text": 100000,
  "custom.honest_flaws_and_character": 255
};

export const PROTECTED_FIELDS = [
  "custom.stone_family", "custom.surface_finish",
  "custom.color_pattern", "custom.google_product_category", "custom.setting_ready",
  "custom.bail_included", "custom.chain_material", "custom.jewelry_finding_type",
  "shopify_title"
];

export const HARDWARE_FIELDS = [
  "custom.setting_ready", "custom.bail_included", "custom.chain_material",
  "custom.jewelry_finding_type"
];

export const POLICY_PRE_APPROVED_FIELDS = [
  "custom.rarity",
  "custom.authenticity",
  "custom.alt_text",
  "custom.stone_family",
  "custom.surface_finish",
  "custom.primary_color",
  "custom.color_pattern",
  "custom.honest_flaws_and_character",
  "custom.setting_ready",
  "custom.chain_material",
  "custom.jewelry_finding_type",
  "custom.seo_title"
];

export const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];
export const REQUIRED_FIELDS = ["shopify_title", "price"];
export const INTEGRATION_PREFIXES = ["google.", "shopify.", "mm-google", "mc-facebook"];
export const NATIVE_FIELDS = ["price", "shopify_title"];

export const NATIVE_ALIAS_MAP = {
  "native_title": "shopify_title",
  "native_description": "custom.generated_description",
  "native_seo_title": "custom.seo_title",
  "native_shipping_weight": "custom.shipping_weight_oz",
  "native_price": "price"
};

export const DESCRIPTION_REVIEW_EXCLUDED_KEYS = ["native_description", "custom.generated_description"];

// Used strictly for global telemetry tracking to preserve 45-count. Do not render.
export const HIDDEN_CONTEXT_FIELDS = ["custom.origin_story"];

export const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "wire_material", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
  "custom.cut_and_shape", "custom.stone_shape", "custom.wire_material", "custom.primary_use"
];

export const FILTER_OPTIONS = [
  {label: 'All', value: 'All'},
  {label: 'Needs review', value: 'Needs review'},
  {label: 'Proposed changes', value: 'Proposed changes'},
  {label: 'Conflicts', value: 'Conflicts'},
  {label: 'Blank', value: 'Blank'},
  {label: 'Shopify', value: 'Shopify'},
  {label: 'Gemini', value: 'Gemini'},
  {label: 'Vision', value: 'Vision'},
  {label: 'Geo Library', value: 'Geo Library'},
  {label: 'Derived', value: 'Derived'},
  {label: 'Manual', value: 'Manual'}
];

export const formatLabel = (key) => {
  const parts = key.split('.');
  const name = parts[parts.length - 1];
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export const resolveConfigFieldDestination = (f) => {
  if (!f) return "";
  if (f.role === "standardized_attribute" && f.namespace && f.metaKey) {
    return `${f.namespace}.${f.metaKey}`;
  }
  if (f.namespace && f.metaKey && !f.key?.startsWith("native_") && !NATIVE_FIELDS.includes(f.key)) {
    return `${f.namespace}.${f.metaKey}`;
  }
  if (NATIVE_FIELDS.includes(f.key) || f.key.includes('.') || f.key.startsWith('native_')) {
    return f.key;
  }
  return `custom.${f.key}`;
};

export const getDynamicSections = (manifest) => {
  return PRODUCT_TEMPLATE_GROUPS.map(group => {
    let keys = [];
    group.fields.forEach(f => {
      if (RETIRED_KEYS.includes(f.key) || RETIRED_KEYS.includes(`custom.${f.key}`)) return;
      
      if (f.key === "native_image_alt") {
        if (manifest?.nativeTargets?.media?.edges) {
          const mediaKeys = manifest.nativeTargets.media.edges.map(e => `native_image_alts_${e.node.id}`);
          keys.push(...mediaKeys);
        }
        return;
      }
      
      const resolvedKey = resolveConfigFieldDestination(f);
      if (resolvedKey && !RETIRED_KEYS.includes(resolvedKey)) {
        keys.push(resolvedKey);
      }
    });
    
    if (group.heading === "3. Origin, Story, and Collection") {
        if (!keys.includes("custom.origin_story")) keys.push("custom.origin_story");
    }

    return { title: group.heading, keys: keys, configFields: group.fields };
  });
};

export const getStatusTone = (status) => {
  switch(status) {
    case STATUS.VALIDATED: return "success";
    case STATUS.COMPLETE: return "success";
    case STATUS.SCANNING: return "magic";
    case STATUS.FAILED: return "critical";
    case STATUS.QUEUED: return "info";
    default: return undefined;
  }
};

export const isMultilineKey = (k, control) => control === "multiline" || [
  "custom.generated_description", "custom.stone_story", 
  "custom.bench_notes", "custom.character_marks", "custom.honest_flaws_and_character", 
  "custom.artist_notes", "custom.origin_story"
].includes(k);

export const evaluateFieldMetadata = ({
  key,
  data,
  productId,
  currentApprovals,
  configFields = [],
  standardizedCandidatesByProduct = {},
  getStandardizedEvaluationForField
}) => {
  const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
  const isNativeImageAlt = key.startsWith("native_image_alts_");
  
  const unprefixedKey = targetKeyForProposal.replace(/^custom\./, '');
  const templateConfig = configFields.find(f => {
    const resolvedDest = resolveConfigFieldDestination(f);
    return (
      resolvedDest === key ||
      resolvedDest === targetKeyForProposal ||
      f.key === key ||
      f.key === targetKeyForProposal ||
      (f.role !== "standardized_attribute" && f.key === unprefixedKey)
    );
  });

  const isStandardizedAttribute = templateConfig?.role === "standardized_attribute" || key.startsWith("shopify.");
  const isVerifiedStdDest = isVerifiedStandardizedDestination(targetKeyForProposal);

  const stdEvaluation = isVerifiedStdDest && typeof getStandardizedEvaluationForField === "function"
    ? getStandardizedEvaluationForField(productId, targetKeyForProposal, data)
    : null;

  // Relax pending_read_only ONLY for the six verified destinations when all required matching checks pass
  const isPendingReadOnly = isVerifiedStdDest
    ? !Boolean(stdEvaluation?.isTechnicallyEligible)
    : templateConfig?.mappingStatus === "pending_read_only";

  let currentVal = "";
  const variants = data.nativeTargets?.variants?.edges || [];
  const isSingleVariant = variants.length === 1 && 
                          data.nativeTargets?.variants?.pageInfo?.hasNextPage === false && 
                          data.nativeTargets?.isComplete === true && 
                          !data.nativeTargets?.loadError;

  if (isNativeImageAlt) {
      const imageId = key.replace("native_image_alts_", "");
      const match = data.nativeTargets?.media?.edges?.find(e => e.node?.id === imageId);
      currentVal = match?.node?.alt ?? "";
  } else if (key === "native_title" || key === "shopify_title") {
      currentVal = data.nativeTargets?.productTitle ?? data.canonicalFields?.shopify_title ?? "";
  } else if (key === "native_description" || key === "custom.generated_description") {
      currentVal = key === "native_description" 
        ? (data.nativeTargets?.descriptionHtml ?? "")
        : (data.currentMetafields?.["custom.generated_description"] ?? "");
  } else if (key === "native_seo_title" || key === "custom.seo_title") {
      currentVal = key === "native_seo_title"
        ? (data.nativeTargets?.seo?.title ?? "")
        : (data.currentMetafields?.["custom.seo_title"] ?? "");
  } else if (key === "native_seo_description") {
      currentVal = data.nativeTargets?.seo?.description ?? "";
  } else if (key === "native_price" || key === "price") {
      if (isSingleVariant) {
          currentVal = variants[0].node?.price ?? "";
      } else if (variants.length !== 1 || data.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !data.nativeTargets?.isComplete || data.nativeTargets?.loadError) {
          currentVal = "Multiple variants / Incomplete data - review manually";
      }
  } else if (key === "native_shipping_weight" || key === "custom.shipping_weight_oz") {
      if (key === "native_shipping_weight") {
          if (isSingleVariant) {
              const w = variants[0].node?.inventoryItem?.measurement?.weight;
              currentVal = (w?.value !== undefined && w?.value !== null) ? `${w.value} ${w.unit}` : "";
          } else if (variants.length !== 1 || data.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !data.nativeTargets?.isComplete || data.nativeTargets?.loadError) {
              currentVal = "Multiple variants / Incomplete data - review manually";
          }
      } else {
          currentVal = data.currentMetafields?.["custom.shipping_weight_oz"] ?? "";
      }
  } else if (isVerifiedStdDest && stdEvaluation) {
      if (stdEvaluation.existingGids.length > 0) {
          currentVal = JSON.stringify(stdEvaluation.existingGids);
      } else {
          const hasCurrent = data.currentMetafields?.hasOwnProperty(key);
          const rawCurrent = hasCurrent ? data.currentMetafields[key] : "";
          if (Array.isArray(rawCurrent)) {
              currentVal = rawCurrent.length > 0 ? JSON.stringify(rawCurrent) : "";
          } else if (typeof rawCurrent === "object" && rawCurrent !== null) {
              currentVal = JSON.stringify(rawCurrent);
          } else {
              currentVal = hasCurrent ? String(rawCurrent ?? "") : "";
          }
      }
  } else {
      const hasCurrent = data.currentMetafields?.hasOwnProperty(key);
      const rawCurrent = hasCurrent ? data.currentMetafields[key] : "";
      if (Array.isArray(rawCurrent)) {
          currentVal = JSON.stringify(rawCurrent);
      } else if (typeof rawCurrent === "object" && rawCurrent !== null) {
          currentVal = JSON.stringify(rawCurrent);
      } else {
          currentVal = hasCurrent ? String(rawCurrent ?? "") : "";
      }
  }

  let isProposed = false;
  let propVal = "";

  if (isVerifiedStdDest) {
      if (stdEvaluation?.isTechnicallyEligible) {
          if (data.repairPlan !== undefined && data.repairPlan.hasOwnProperty(targetKeyForProposal)) {
              isProposed = true;
              const rawProp = data.repairPlan[targetKeyForProposal];
              propVal = Array.isArray(rawProp) ? JSON.stringify(rawProp) : String(rawProp ?? "");
          } else if (stdEvaluation.autoProposalSerialized) {
              isProposed = true;
              propVal = stdEvaluation.autoProposalSerialized;
          }
      }
  } else if (data.repairPlan !== undefined && !isPendingReadOnly && !isStandardizedAttribute) {
      if (data.repairPlan.hasOwnProperty(targetKeyForProposal)) {
          isProposed = true;
          const rawProp = data.repairPlan[targetKeyForProposal];
          if (Array.isArray(rawProp)) {
              propVal = JSON.stringify(rawProp);
          } else if (typeof rawProp === "object" && rawProp !== null) {
              propVal = JSON.stringify(rawProp);
          } else {
              propVal = String(rawProp ?? "");
          }
      } else if (key === "native_shipping_weight" || key === "custom.shipping_weight_oz") {
          const stoneGrams = parseFloat(data.currentMetafields?.["custom.weight_grams"] || data.repairPlan?.["custom.weight_grams"]) || 0;
          if (stoneGrams > 0) {
              isProposed = true;
              propVal = String(Math.ceil((stoneGrams / 28.3495) + 0.5));
          }
      } else if (key === "native_seo_description" && data.repairPlan.hasOwnProperty("native_seo_description")) {
          isProposed = true;
          propVal = String(data.repairPlan["native_seo_description"]);
      }
  }

  let fieldMeta = data.metadata?.[key] || data.metadata?.[targetKeyForProposal] || {};
  let source = fieldMeta.source || (isVerifiedStdDest && isProposed ? "Vision" : "Not reported");
  let stage = fieldMeta.stage || (isVerifiedStdDest && isProposed ? "resolveStandardizedCandidates" : "Not reported");

  let fieldStatus = "Unchanged";
  let proposalStatus = isProposed ? (propVal.trim() !== "" ? "Provided" : "Empty") : "Not provided";
  let isBlockedAction = false;
  let reasons = [];
  
  let isContentPreApproved = false;
  let preApprovalReason = "";

  const currentExists = currentVal.trim() !== "" && currentVal.trim() !== "[]";
  const proposalExists = isProposed && propVal.trim() !== "" && propVal.trim() !== "[]";

  const isKnownKey = templateConfig !== undefined || NATIVE_FIELDS.includes(key) || isNativeImageAlt || HIDDEN_CONTEXT_FIELDS.includes(key) || key.startsWith('native_');

  // Never auto-preapprove the six standardized reference proposals; Bob's meaning approval is not technical list approval
  if (!isPendingReadOnly && !isVerifiedStdDest) {
      if (targetKeyForProposal === "custom.google_product_category" && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Category pre-approved";
      } else if (
          data.verifiedGeoValues && 
          data.verifiedGeoValues[unprefixedKey] !== undefined && 
          String(data.verifiedGeoValues[unprefixedKey]) === propVal && 
          proposalExists
      ) {
          isContentPreApproved = true;
          preApprovalReason = "Verified Geo Library";
      } else if (POLICY_PRE_APPROVED_FIELDS.includes(targetKeyForProposal) && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Pre-approved by operator policy";
      } else if (isNativeImageAlt && proposalExists) {
          isContentPreApproved = true;
          preApprovalReason = "Native Image Alt pre-approved by policy";
      }
  }

  const isRequired = REQUIRED_FIELDS.includes(targetKeyForProposal);
  const isProtected = PROTECTED_FIELDS.includes(targetKeyForProposal);
  const isHardware = HARDWARE_FIELDS.includes(targetKeyForProposal);
  const isIntegration = INTEGRATION_PREFIXES.some(prefix => targetKeyForProposal.startsWith(prefix));

  const currentCount = currentVal.length;
  const propCount = propVal.length;
  const limit = FIELD_LIMITS[targetKeyForProposal] || null;

  const isManualOnly = false;
  const isOperatorOwned = (targetKeyForProposal === "price" || targetKeyForProposal === "custom.weight_grams" || targetKeyForProposal === "custom.dimensions_mm");
  
  const exactApprovalVal = currentApprovals?.[productId]?.[targetKeyForProposal];
  const isApproved = !isPendingReadOnly && exactApprovalVal !== undefined && exactApprovalVal === propVal && propVal.trim() !== "";

  if (HIDDEN_CONTEXT_FIELDS.includes(key)) {
      return { currentVal, propVal, isProposed, fieldStatus: "Hidden Source", proposalStatus, source, stage, isBlockedAction: true, reasons: ["Hidden Context"], currentExists, proposalExists, isApproved: false, hasTechnicalBlock: true, contentNeedsReview: false, isContentPreApproved: false, preApprovalReason: "", isManualOnly: false, isActualBlockedProposal: false, isOperatorOwned: false, isSupported: true, isPendingReadOnly: false, isStandardizedAttribute: false };
  }

  let hasTechnicalBlock = false;
  let contentNeedsReview = false;

  // Technical Verification Layer
  const isOverLimit = limit !== null && !isNativeImageAlt && (currentCount > limit || (isProposed && propCount > limit));
  if (isOverLimit) {
      hasTechnicalBlock = true;
      reasons.push("Over limit");
  }
  
  if (isIntegration) reasons.push("Integration owned");

  if (isVerifiedStdDest) {
      if (!stdEvaluation?.isTechnicallyEligible) {
          hasTechnicalBlock = true;
          reasons.push(stdEvaluation?.blockReason || "Standardized attribute awaiting valid reference match.");
      } else if (proposalExists) {
          const propValidation = validateProposedStandardizedGidList(propVal, stdEvaluation);
          if (!propValidation.valid) {
              hasTechnicalBlock = true;
              reasons.push(propValidation.reason);
          } else {
              // Require explicit exact-value approval for all standardized reference proposals
              contentNeedsReview = true;
          }
      }
  } else if (isPendingReadOnly) {
      hasTechnicalBlock = true;
      reasons.push("Standardized attribute read-only (pending_read_only)");
  }

  if (BLOCKED_UNVERIFIED_PINS.includes(targetKeyForProposal) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Type/destination unverified");
  }

  if (isHardware && GENERIC_VALUES.includes(propVal.trim()) && proposalExists) {
      hasTechnicalBlock = true;
      reasons.push("Generic hardware fill into blank");
  }

  if (isNativeImageAlt) {
      if (data.nativeTargets?.isComplete === false || data.nativeTargets?.loadError) {
          hasTechnicalBlock = true;
          reasons.push(`Media targets incomplete/failed. Retry load. Error: ${data.nativeTargets?.loadError || 'Pagination failed'}`);
      }
  }
  
  if (key === "native_seo_description") {
      hasTechnicalBlock = true;
      reasons.push("SEO description save connection pending.");
  }

  // New Backend Technical Blockers
  const apiBlockReason = data.blockedFields?.[targetKeyForProposal] || data.blockedFields?.[unprefixedKey];
  if (apiBlockReason) {
      reasons.push(`Backend Blocked: ${apiBlockReason}`);
  }

  let conflictData = data.conflicts?.[targetKeyForProposal] || data.conflicts?.[unprefixedKey];
  let nativeDescConflictData = null;
  
  if (targetKeyForProposal === "custom.generated_description" && data.conflicts?.["native_description"]) {
      nativeDescConflictData = data.conflicts["native_description"];
      const expLen = String(nativeDescConflictData.expected || "").length;
      const actLen = String(nativeDescConflictData.actual || "").length;
      reasons.push(`Read-back Mismatch [Native descriptionHtml]: Expected (${expLen} chars) != Actual (${actLen} chars)`);
  }

  if (conflictData) {
      if (targetKeyForProposal === "custom.generated_description") {
          const expLen = String(conflictData.expected || "").length;
          const actLen = String(conflictData.actual || "").length;
          reasons.push(`Read-back Mismatch [Metafield / Native Field]: Expected (${expLen} chars) != Actual (${actLen} chars)`);
      } else {
          reasons.push(`Read-back Mismatch [Metafield / Native Field]: ${conflictData.expected} != ${conflictData.actual}`);
      }
  }

  // Content Review Status Evaluation
  if (currentExists) {
      if (!proposalExists) {
          fieldStatus = "Unchanged";
      } else if (currentVal === propVal) {
          fieldStatus = "Unchanged";
      } else {
          if (isVerifiedStdDest) {
              contentNeedsReview = true;
              fieldStatus = "Proposed";
              reasons.push("Proposed (Preserves existing references + adds verified entry)");
          } else if (isProtected || isOperatorOwned) {
              contentNeedsReview = true;
              if (!isContentPreApproved) fieldStatus = "Degrade";
              reasons.push(isContentPreApproved ? "Historical: Degrade (Pre-approved)" : "Degrade");
          } else {
              contentNeedsReview = true;
              if (!isContentPreApproved) fieldStatus = "Conflict";
              reasons.push(isContentPreApproved ? "Historical: Conflict (Pre-approved)" : "Conflict");
          }
      }
  } else {
      if (!proposalExists) {
          fieldStatus = isRequired ? "Required missing" : "Optional blank";
          if (isRequired) reasons.push("Required missing");
      } else {
          if (source === "Not reported") {
              contentNeedsReview = true;
              if (!isContentPreApproved) fieldStatus = "Unverified proposal";
              reasons.push(isContentPreApproved ? "Historical: Unverified proposal (Pre-approved)" : "Unverified proposal");
          } else {
              if (!isContentPreApproved) fieldStatus = "Proposed";
              reasons.push("Proposed");
          }
      }
  }

  const candidateMetaKeyForCheck = templateConfig?.metaKey || (key.startsWith("shopify.") ? key.slice(8) : "");
  const hasStagedCandidateForRow =
    isVerifiedStdDest &&
    Boolean(standardizedCandidatesByProduct[productId]?.[candidateMetaKeyForCheck]);

  // Apply baseline technical overrides
  if (isVerifiedStdDest && hasTechnicalBlock && hasStagedCandidateForRow) {
      fieldStatus = "Blocked";
  } else if (hasTechnicalBlock && fieldStatus !== "Unchanged" && fieldStatus !== "Optional blank" && fieldStatus !== "Required missing") {
      if (isOverLimit) {
          fieldStatus = "Over limit";
      } else if (isPendingReadOnly || hasTechnicalBlock || reasons.includes("Type/destination unverified") || reasons.includes("Generic hardware fill into blank")) {
          fieldStatus = "Blocked";
      } else if (isNativeImageAlt) {
          fieldStatus = "Blocked";
      }
  }
  
  // Apply read-back and block overrides strictly for UI display
  if (apiBlockReason) {
      fieldStatus = "API Error / Blocked";
  } else if (conflictData || nativeDescConflictData) {
      fieldStatus = "Save Conflict";
  }

  // React to Approvals & Pre-Approvals
  if (proposalExists && currentVal !== propVal && !isManualOnly && !isPendingReadOnly && !apiBlockReason && !conflictData && !nativeDescConflictData) {
      if (isContentPreApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Pre-approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Pre-approved, not saved";
              isBlockedAction = false;
          }
      } else if (isApproved) {
          if (hasTechnicalBlock) {
              fieldStatus = "Approved, blocked";
              isBlockedAction = true;
          } else {
              fieldStatus = "Approved, not saved";
              isBlockedAction = false;
          }
      } else {
          if (contentNeedsReview || hasTechnicalBlock) {
              isBlockedAction = true;
          } else {
              isBlockedAction = false; 
          }
      }
  } else {
      if (hasTechnicalBlock || isPendingReadOnly || apiBlockReason || conflictData || nativeDescConflictData || fieldStatus === "Optional blank" || fieldStatus === "Required missing") {
          isBlockedAction = true;
      }
  }

  if (isManualOnly) {
      isBlockedAction = true;
      if (proposalExists && currentVal !== propVal) {
          fieldStatus = "Manual only";
          if (!reasons.includes("Manual only")) reasons.push("Manual only");
      }
  }

  if (isPendingReadOnly) {
      isBlockedAction = true;
  }

  const isActualBlockedProposal = isBlockedAction && 
                                  !isManualOnly && 
                                  (!isPendingReadOnly || (isVerifiedStdDest && hasStagedCandidateForRow)) &&
                                  (!isStandardizedAttribute || isVerifiedStdDest) &&
                                  !HIDDEN_CONTEXT_FIELDS.includes(key) && 
                                  ((proposalExists && currentVal !== propVal) || (isVerifiedStdDest && hasStagedCandidateForRow && hasTechnicalBlock));

  return { 
    currentVal, propVal, isProposed, fieldStatus, proposalStatus, source, stage, 
    isBlockedAction, reasons, currentExists, proposalExists, isApproved, hasTechnicalBlock, contentNeedsReview,
    isContentPreApproved, preApprovalReason, isManualOnly, isOperatorOwned, isActualBlockedProposal,
    conflictData, nativeDescConflictData,
    isSupported: isKnownKey,
    isPendingReadOnly,
    isStandardizedAttribute,
    isVerifiedStdDest,
    stdEvaluation,
    metaKey: templateConfig?.metaKey || (key.startsWith("shopify.") ? key.slice(8) : ""),
    label: templateConfig?.label || formatLabel(key),
    control: templateConfig?.control
  };
};

export const computeSystemStatus = ({
  data,
  selectedBenchId,
  isLoadingData,
  isExecuting,
  executionMode,
  queueIds,
  loadIndex,
  executeIndex,
  aiStep,
  batchFetcherState,
  batchFetcherFormData,
  safetyError
}) => {
  let diag = data?.diagnostics || {
      shopifyRead: "Not reported",
      gemini: "Not reported",
      vision: "Not reported",
      geoLibrary: "Not reported",
      readBack: "Not called",
      stage: "Not reported",
      error: null
  };

  let shopifyReadStatus = diag.shopifyRead;
  let geminiStatus = diag.gemini;
  let visionStatus = diag.vision;
  let geoLibraryStatus = diag.geoLibrary;
  let readBackStatus = diag.readBack;
  let currentStage = diag.stage || "Not reported";

  const isCurrentlyProcessing = (isLoadingData && queueIds[loadIndex] === selectedBenchId) ||
                                (isExecuting && executionMode === "AI_BATCH_PIPELINE" && queueIds[executeIndex] === selectedBenchId) ||
                                (isExecuting && executionMode === "AI_SINGLE_PIPELINE" && selectedBenchId);
  
  let finalStageDisplay = executionMode || "Not reported";
  let fetcherStateDisplay = batchFetcherState;
  let loadingStateDisplay = isLoadingData ? "Loading" : "Idle";
  let errorMessageDisplay = safetyError || diag.error || "None";

  if (isCurrentlyProcessing) {
      if (isLoadingData) {
          shopifyReadStatus = "Running";
      } else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
          if (aiStep === 1) { geminiStatus = "Running"; currentStage = "titleParse"; }
          if (aiStep === 2) { geminiStatus = "Running"; visionStatus = "Running"; currentStage = "tab3FullRescan"; }
          if (aiStep === 3) { geminiStatus = "Running"; currentStage = "generateDescription"; }
      } else if (executionMode === "REPAIR") {
          shopifyReadStatus = "Running"; 
          currentStage = "executeRepairPlan";
      }
  }

  if (batchFetcherState !== "idle" && batchFetcherFormData?.get("pieceId") === selectedBenchId) {
      const intent = batchFetcherFormData?.get("intent");
      if (intent === "executeRepairPlan") {
          shopifyReadStatus = "Running";
          currentStage = "executeRepairPlan";
      }
  }

  return {
      shopifyReadStatus, geminiStatus, visionStatus, geoLibraryStatus, readBackStatus,
      currentStage, finalStageDisplay, fetcherStateDisplay, loadingStateDisplay, errorMessageDisplay
  };
};

export const computeDiagnosticsStats = ({
  data,
  selectedBenchId,
  approvals,
  getFieldMetadata
}) => {
  if (!data) return null;
  let stats = {
      proposed: 0,
      blocked: 0,
      degraded: 0,
      conflicts: 0,
      unverified: 0,
      optionalBlanks: 0,
      requiredMissing: 0,
      approvedWrite: 0,
      total: 0,
      filled: 0,
      blank: 0,
      manualOnly: 0,
      unchangedFlagged: 0
  };

  const dynamicSections = getDynamicSections(data);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  dynamicSections.forEach(sec => {
      sec.keys.forEach(k => {
          stats.total++;
          const meta = getFieldMetadata(k, data, selectedBenchId, approvals, allConfigFields);
          
          if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
          else stats.filled++;

          if (meta.isManualOnly) stats.manualOnly++;

          const eligibleForStats = !meta.isPendingReadOnly && (!meta.isStandardizedAttribute || meta.isVerifiedStdDest);

          if (eligibleForStats && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked")) stats.proposed++;
          
          if (meta.isActualBlockedProposal) {
              stats.blocked++;
          } else if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k) && !meta.isManualOnly && eligibleForStats && meta.proposalExists && meta.currentVal === meta.propVal) {
              stats.unchangedFlagged++;
          }

          if (meta.fieldStatus === "Degrade") stats.degraded++;
          
          if (meta.fieldStatus === "Conflict") {
              stats.conflicts++;
          } else if (meta.fieldStatus === "Save Conflict") {
              let conflictCounted = false;
              if (meta.conflictData) {
                  stats.conflicts++;
                  conflictCounted = true;
              }
              if (meta.nativeDescConflictData) {
                  stats.conflicts++;
                  conflictCounted = true;
              }
              if (!conflictCounted) {
                  stats.conflicts++;
              }
          }

          if (meta.fieldStatus === "Unverified proposal") stats.unverified++;
          if (meta.fieldStatus === "Optional blank") stats.optionalBlanks++;
          if (meta.fieldStatus === "Required missing") stats.requiredMissing++;
          if ((meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") && !meta.isBlockedAction && eligibleForStats && !HIDDEN_CONTEXT_FIELDS.includes(k)) stats.approvedWrite++;
      });
  });

  return stats;
};

export const buildRepairPayload = (manifest, product, currentId, currentApprovals, getFieldMetadata) => {
  const safePlan = {};
  const nativeChanges = {};
  
  const dynamicSections = getDynamicSections(manifest);
  const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

  Object.keys(manifest.repairPlan || {}).forEach(key => {
      if (key.startsWith("native_image_alts_")) return; 
      if (key === "native_seo_description") return;
      if (key === "standardized_candidates" || key === "custom.standardized_candidates") return;
      if (key.startsWith("custom.std_") || key.startsWith("std_")) return;
      if (key.startsWith("shopify.") && !isVerifiedStandardizedDestination(key)) return;
      
      const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);

      if (isVerifiedStandardizedDestination(key)) {
          if (meta.isPendingReadOnly || meta.isBlockedAction || !meta.isApproved || meta.hasTechnicalBlock) return;
          const valCheck = validateProposedStandardizedGidList(meta.propVal, meta.stdEvaluation);
          if (!valCheck.valid) return;
          if (meta.proposalExists && meta.propVal !== meta.currentVal) {
              safePlan[key] = JSON.stringify(valCheck.gids);
          }
          return;
      }

      if (meta.isPendingReadOnly || meta.isStandardizedAttribute) return;
      if (!meta.isSupported || meta.isManualOnly || meta.hasTechnicalBlock || meta.isBlockedAction) return;
      if (HIDDEN_CONTEXT_FIELDS.includes(key) || RETIRED_KEYS.includes(key)) return;
      if (!meta.proposalExists) return;

      if (key === "shopify_title" || key === "native_title") {
          const titleMeta = getFieldMetadata("native_title", manifest, currentId, currentApprovals, allConfigFields);
          const hasTitleBaseline = typeof manifest.nativeTargets?.productTitle === "string";
          if (
              !titleMeta.isBlockedAction &&
              !titleMeta.hasTechnicalBlock &&
              titleMeta.proposalExists &&
              (!hasTitleBaseline || titleMeta.propVal !== titleMeta.currentVal)
          ) {
              nativeChanges.title = manifest.repairPlan[key];
          }
          return;
      }

      if (key === "custom.shipping_weight_oz" || key === "native_shipping_weight") {
          const variantsConn = manifest.nativeTargets?.variants;
          if (
              variantsConn?.edges?.length === 1 &&
              variantsConn?.pageInfo?.hasNextPage === false &&
              manifest.nativeTargets?.isComplete === true &&
              !manifest.nativeTargets?.loadError
          ) {
              const variantNode = variantsConn.edges[0]?.node;
              const variantId = variantNode?.id;
              const nativeWeightMeta = getFieldMetadata("native_shipping_weight", manifest, currentId, currentApprovals, allConfigFields);
              if (variantId && !nativeWeightMeta.isBlockedAction && !nativeWeightMeta.hasTechnicalBlock && nativeWeightMeta.proposalExists) {
                  const rawProposedWeight = manifest.repairPlan[key] !== undefined ? manifest.repairPlan[key] : nativeWeightMeta.propVal;
                  const proposedNum = Number(rawProposedWeight);
                  const w = variantNode?.inventoryItem?.measurement?.weight;
                  const hasWeightBaseline =
                      w !== null &&
                      w !== undefined &&
                      typeof w === "object" &&
                      w.value !== undefined &&
                      w.value !== null &&
                      typeof w.unit === "string";
                  const isWeightEqual =
                      hasWeightBaseline &&
                      !Number.isNaN(proposedNum) &&
                      Number(w.value) === proposedNum &&
                      w.unit === "OUNCES";
                  if (!isWeightEqual) {
                      nativeChanges.shippingWeight = {
                          variantId: variantId,
                          value: rawProposedWeight,
                          unit: "OUNCES"
                      };
                  }
              }
          }
          return;
      }

      if (key === "custom.generated_description") {
          const nativeDescMeta = getFieldMetadata("native_description", manifest, currentId, currentApprovals, allConfigFields);
          const hasMetafieldBaseline = Object.prototype.hasOwnProperty.call(manifest.currentMetafields || {}, "custom.generated_description");
          const hasNativeDescBaseline = typeof manifest.nativeTargets?.descriptionHtml === "string";
          const metafieldDiffers = !hasMetafieldBaseline || meta.propVal !== meta.currentVal;
          const nativeDescDiffers =
              !nativeDescMeta.isBlockedAction &&
              !nativeDescMeta.hasTechnicalBlock &&
              (!hasNativeDescBaseline || nativeDescMeta.propVal !== nativeDescMeta.currentVal);
          if (metafieldDiffers || nativeDescDiffers) {
              safePlan[key] = manifest.repairPlan[key];
          }
          return;
      }

      if (key === "custom.seo_title") {
          const nativeSeoMeta = getFieldMetadata("native_seo_title", manifest, currentId, currentApprovals, allConfigFields);
          const hasMetafieldBaseline = Object.prototype.hasOwnProperty.call(manifest.currentMetafields || {}, "custom.seo_title");
          const hasNativeSeoBaseline = typeof manifest.nativeTargets?.seo?.title === "string";
          const metafieldDiffers = !hasMetafieldBaseline || meta.propVal !== meta.currentVal;
          const nativeSeoDiffers =
              !nativeSeoMeta.isBlockedAction &&
              !nativeSeoMeta.hasTechnicalBlock &&
              (!hasNativeSeoBaseline || nativeSeoMeta.propVal !== nativeSeoMeta.currentVal);
          if (metafieldDiffers || nativeSeoDiffers) {
              safePlan[key] = manifest.repairPlan[key];
          }
          return;
      }

      if (key === "price" || key === "native_price") {
          const variantsConn = manifest.nativeTargets?.variants;
          const hasSingleVariantBaseline =
              variantsConn?.edges?.length === 1 &&
              variantsConn?.pageInfo?.hasNextPage === false &&
              manifest.nativeTargets?.isComplete === true &&
              !manifest.nativeTargets?.loadError &&
              typeof variantsConn.edges[0]?.node?.price === "string";
          if (!hasSingleVariantBaseline) return;
          if (meta.propVal !== meta.currentVal) {
              safePlan["price"] = manifest.repairPlan[key];
          }
          return;
      }

      const hasMetafieldBaseline = Object.prototype.hasOwnProperty.call(manifest.currentMetafields || {}, key);
      if (!hasMetafieldBaseline || meta.propVal !== meta.currentVal) {
          safePlan[key] = manifest.repairPlan[key];
      }
  });

  const isMediaComplete = manifest.nativeTargets?.isComplete === true;
  const mediaLoadError = manifest.nativeTargets?.loadError;

  if (isMediaComplete && !mediaLoadError) {
      const imageAlts = [];
      (manifest.nativeTargets?.media?.edges || []).forEach(({ node }) => {
          if (node?.id) {
              const key = `native_image_alts_${node.id}`;
              if (manifest.repairPlan[key] !== undefined) {
                  const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);
                  const hasMediaAltBaseline = typeof node.alt === "string";
                  if (
                      !meta.isBlockedAction &&
                      !meta.hasTechnicalBlock &&
                      meta.proposalExists &&
                      (!hasMediaAltBaseline || meta.propVal !== meta.currentVal)
                  ) {
                      imageAlts.push({ imageId: node.id, altText: meta.propVal });
                  }
              }
          }
      });
      if (imageAlts.length > 0) {
          nativeChanges.imageAlts = imageAlts;
      }
  }
  
  return { safePlan, nativeChanges };
};
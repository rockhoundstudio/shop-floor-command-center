import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar, Select } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon, ChevronDownIcon, ChevronUpIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { PRODUCT_TEMPLATE_GROUPS } from "../utils/meta-injector.constants.jsx";

const STATUS = {
  QUEUED: "Queued",
  SCANNING: "Scanning",
  VALIDATED: "Manifest Built",
  COMPLETE: "Repaired",
  FAILED: "Failed",
  SKIPPED: "Skipped"
};

const BLOCKED_UNVERIFIED_PINS = [
  "custom.jewelry_type"
];

const FIELD_LIMITS = {
  "custom.seo_title": 70,
  "shopify_title": 255,
  "custom.piece_name": 255,
  "custom.alt_text": 100000,
  "custom.honest_flaws_and_character": 255
};

const PROTECTED_FIELDS = [
  "custom.stone_family", "custom.surface_finish",
  "custom.color_pattern", "custom.google_product_category", "custom.setting_ready",
  "custom.bail_included", "custom.chain_material", "custom.jewelry_finding_type",
  "shopify_title"
];

const HARDWARE_FIELDS = [
  "custom.setting_ready", "custom.bail_included", "custom.chain_material",
  "custom.jewelry_finding_type"
];

const POLICY_PRE_APPROVED_FIELDS = [
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

const GENERIC_VALUES = ["None", "Unknown", "N/A", "N/a", "none", "unknown", "n/a"];
const REQUIRED_FIELDS = ["shopify_title", "price"];
const INTEGRATION_PREFIXES = ["google.", "shopify.", "mm-google", "mc-facebook"];
const NATIVE_FIELDS = ["price", "shopify_title"];

const NATIVE_ALIAS_MAP = {
  "native_title": "shopify_title",
  "native_description": "custom.generated_description",
  "native_seo_title": "custom.seo_title",
  "native_shipping_weight": "custom.shipping_weight_oz",
  "native_price": "price"
};

// Used strictly for global telemetry tracking to preserve 45-count. Do not render.
const HIDDEN_CONTEXT_FIELDS = ["custom.origin_story"]; 

const RETIRED_KEYS = [
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "wire_material", "primary_use",
  "custom.artist_notes", "custom.bench_notes", "custom.handcrafted_by", "custom.color",
  "custom.cut_and_shape", "custom.stone_shape", "custom.wire_material", "custom.primary_use"
];

const formatLabel = (key) => {
  const parts = key.split('.');
  const name = parts[parts.length - 1];
  return name.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const getDynamicSections = (manifest) => {
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
      
      if (NATIVE_FIELDS.includes(f.key) || f.key.includes('.') || f.key.startsWith('native_')) {
        keys.push(f.key);
      } else {
        keys.push(`custom.${f.key}`);
      }
    });
    
    if (group.heading === "3. Origin, Story, and Collection") {
        if (!keys.includes("custom.origin_story")) keys.push("custom.origin_story");
    }

    return { title: group.heading, keys: keys, configFields: group.fields };
  });
};

const validArray = (arr) => Array.isArray(arr) ? arr : [];
const validObj = (obj) => (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) ? obj : {};

export function OperationsMatrixTab({ products }) {
  const safeProducts = products || [];
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data Loading State
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [loadIndex, setLoadIndex] = useState(0);

  // Execution State
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionMode, setExecutionMode] = useState(null);
  const [executeIndex, setExecuteIndex] = useState(0);
  const [aiStep, setAiStep] = useState(0);
  
  const [pendingOperation, setPendingOperation] = useState(null); // { id, intent, token }
  const [aiData, setAiData] = useState({}); // Indexed by pieceId to isolate cross-contamination

  const [queueIds, setQueueIds] = useState([]);
  const [productStates, setProductStates] = useState({}); 
  const [manifestData, setManifestData] = useState({}); 
  const [lastProcessedData, setLastProcessedData] = useState(null);
  
  const [approvals, setApprovals] = useState({});
  const [manualEdits, setManualEdits] = useState({}); 
  const [submittedPayloads, setSubmittedPayloads] = useState({}); 
  
  const [repairHistory, setRepairHistory] = useState({});

  const [selectedBenchId, setSelectedBenchId] = useState(null);
  const [safetyMessage, setSafetyMessage] = useState("");
  const [safetyError, setSafetyError] = useState("");

  const [activeFilter, setActiveFilter] = useState("All");
  const [expandedBays, setExpandedBays] = useState({
    "1. Identity and Merchandising": true,
    "2. Stone Facts and Physical Details": true,
    "3. Origin, Story, and Collection": true,
    "4. Jewelry and Setting": true,
    "5. Search, Sales, and Media": true
  });

  const batchFetcher = useFetcher();

  const handleSearchChange = useCallback((value) => setSearchQuery(value), []);
  const handleClearSearch = useCallback(() => setSearchQuery(""), []);
  
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const allFilteredSelected = filteredProducts.length > 0 && filteredProducts.every(p => queueIds.includes(p.id));

  const updateProductState = useCallback((id, status, newLogs = []) => {
    setProductStates(prev => {
      const updated = { ...prev };
      const existingLogs = updated[id]?.logs || [];
      updated[id] = { status: status, logs: [...existingLogs, ...newLogs] };
      return updated;
    });
  }, []);

  const handleToggleProductSelection = useCallback((id) => {
    if (isLoadingData || isExecuting) return; 
    setQueueIds(prev => {
      const newIds = prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id];
      setProductStates(states => {
        const newStates = { ...states };
        if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] };
        return newStates;
      });
      return newIds;
    });
  }, [isLoadingData, isExecuting]);

  const toggleSelectAllFiltered = useCallback(() => {
    if (isLoadingData || isExecuting) return;
    setQueueIds(prev => {
      let newIds = [...prev];
      if (allFilteredSelected) {
        newIds = newIds.filter(id => !filteredProducts.find(p => p.id === id));
      } else {
        filteredProducts.forEach(p => { if (!newIds.includes(p.id)) newIds.push(p.id); });
      }
      setProductStates(states => {
        const newStates = { ...states };
        newIds.forEach(id => { if (!newStates[id]) newStates[id] = { status: STATUS.QUEUED, logs: [] }; });
        return newStates;
      });
      return newIds;
    });
  }, [allFilteredSelected, filteredProducts, isLoadingData, isExecuting]);

  const clearBench = useCallback(() => {
    setQueueIds([]);
    setProductStates({});
    setManifestData({});
    setApprovals({});
    setManualEdits({});
    setSubmittedPayloads({});
    setRepairHistory({});
    setSelectedBenchId(null);
    setIsLoadingData(false);
    setIsExecuting(false);
    setExecutionMode(null);
    setExecuteIndex(0);
    setAiStep(0);
    setAiData({});
    setLoadIndex(0);
    setLastProcessedData(null);
    setPendingOperation(null);
    setSafetyMessage("Rack and Bench cleared. Repair history reset.");
    setSafetyError("");
  }, []);

  const generateRepairPlan = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot generate plan: No inventory selected. Please check items in the left column first.");
       return;
    }
    setApprovals({}); 
    setManualEdits({}); 
    setIsLoadingData(true);
    setLoadIndex(0);
    setSafetyMessage("Fetching live product data and building manifests by GID...");
    setSafetyError("");
  }, [queueIds]);

  const handleToggleApproval = useCallback((pieceId, key, propVal, isChecked) => {
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    setApprovals(prev => {
      const next = { ...prev };
      if (!next[pieceId]) next[pieceId] = {};
      if (isChecked) {
        next[pieceId][targetKey] = propVal;
      } else {
        delete next[pieceId][targetKey];
      }
      return next;
    });
  }, []);

  const getFieldMetadata = (key, data, productId, currentApprovals, configFields = []) => {
    const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;
    const isNativeImageAlt = key.startsWith("native_image_alts_");
    
    let currentVal = "";
    const variants = data.nativeTargets?.variants?.edges || [];
    const isSingleVariant = variants.length === 1 && 
                            data.nativeTargets?.variants?.pageInfo?.hasNextPage === false && 
                            data.nativeTargets?.isComplete === true && 
                            !data.nativeTargets?.loadError;

    if (isNativeImageAlt) {
        const imageId = key.replace("native_image_alts_", "");
        const match = data.nativeTargets?.media?.edges?.find(e => e.node?.id === imageId);
        currentVal = match?.node?.alt || "";
    } else if (key === "native_title" || key === "shopify_title") {
        currentVal = data.nativeTargets?.productTitle || data.canonicalFields?.shopify_title || "";
    } else if (key === "native_description" || key === "custom.generated_description") {
        currentVal = key === "native_description" 
          ? (data.nativeTargets?.descriptionHtml || "")
          : (data.currentMetafields?.["custom.generated_description"] || "");
    } else if (key === "native_seo_title" || key === "custom.seo_title") {
        currentVal = key === "native_seo_title"
          ? (data.nativeTargets?.seo?.title || "")
          : (data.currentMetafields?.["custom.seo_title"] || "");
    } else if (key === "native_seo_description") {
        currentVal = data.nativeTargets?.seo?.description || "";
    } else if (key === "native_price" || key === "price") {
        if (isSingleVariant) {
            currentVal = variants[0].node?.price || "";
        } else if (variants.length !== 1 || data.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !data.nativeTargets?.isComplete || data.nativeTargets?.loadError) {
            currentVal = "Multiple variants / Incomplete data - review manually";
        }
    } else if (key === "native_shipping_weight" || key === "custom.shipping_weight_oz") {
        if (key === "native_shipping_weight") {
            if (isSingleVariant) {
                const w = variants[0].node?.inventoryItem?.measurement?.weight;
                currentVal = w?.value ? `${w.value} ${w.unit}` : "";
            } else if (variants.length !== 1 || data.nativeTargets?.variants?.pageInfo?.hasNextPage !== false || !data.nativeTargets?.isComplete || data.nativeTargets?.loadError) {
                currentVal = "Multiple variants / Incomplete data - review manually";
            }
        } else {
            currentVal = data.currentMetafields?.["custom.shipping_weight_oz"] || "";
        }
    } else {
        const hasCurrent = data.currentMetafields?.hasOwnProperty(key);
        currentVal = hasCurrent ? String(data.currentMetafields[key] || "") : "";
    }

    let isProposed = false;
    let propVal = "";

    if (data.repairPlan !== undefined) {
        if (data.repairPlan.hasOwnProperty(targetKeyForProposal)) {
            isProposed = true;
            propVal = String(data.repairPlan[targetKeyForProposal] ?? "");
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

    let fieldMeta = data.metadata?.[key] || {};
    let source = fieldMeta.source || "Not reported";
    let stage = fieldMeta.stage || "Not reported";

    let fieldStatus = "Unchanged";
    let proposalStatus = isProposed ? (propVal.trim() !== "" ? "Provided" : "Empty") : "Not provided";
    let isBlockedAction = false;
    let reasons = [];
    
    let isContentPreApproved = false;
    let preApprovalReason = "";

    const currentExists = currentVal.trim() !== "";
    const proposalExists = isProposed && propVal.trim() !== "";

    const unprefixedKey = targetKeyForProposal.replace(/^custom\./, '');
    const templateConfig = configFields.find(f => f.key === unprefixedKey || f.key === targetKeyForProposal || f.key === key);

    const isKnownKey = templateConfig !== undefined || NATIVE_FIELDS.includes(key) || isNativeImageAlt || HIDDEN_CONTEXT_FIELDS.includes(key) || key.startsWith('native_');

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
    const isApproved = exactApprovalVal !== undefined && exactApprovalVal === propVal && propVal.trim() !== "";

    if (HIDDEN_CONTEXT_FIELDS.includes(key)) {
        return { currentVal, propVal, isProposed, fieldStatus: "Hidden Source", proposalStatus, source, stage, isBlockedAction: true, reasons: ["Hidden Context"], currentExists, proposalExists, isApproved: false, hasTechnicalBlock: true, contentNeedsReview: false, isContentPreApproved: false, preApprovalReason: "", isManualOnly: false, isActualBlockedProposal: false, isOperatorOwned: false, isSupported: true };
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
        reasons.push(`Read-back Mismatch [Native descriptionHtml]: ${nativeDescConflictData.expected} != ${nativeDescConflictData.actual}`);
    }

    if (conflictData) {
        reasons.push(`Read-back Mismatch [Metafield / Native Field]: ${conflictData.expected} != ${conflictData.actual}`);
    }

    // Content Review Status Evaluation
    if (currentExists) {
        if (!proposalExists) {
            fieldStatus = "Unchanged";
        } else if (currentVal === propVal) {
            fieldStatus = "Unchanged";
        } else {
            if (isProtected || isOperatorOwned) {
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

    // Apply baseline technical overrides
    if (hasTechnicalBlock && fieldStatus !== "Unchanged" && fieldStatus !== "Optional blank" && fieldStatus !== "Required missing") {
        if (isOverLimit) {
            fieldStatus = "Over limit";
        } else if (reasons.includes("Type/destination unverified") || reasons.includes("Generic hardware fill into blank")) {
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
    if (proposalExists && currentVal !== propVal && !isManualOnly && !apiBlockReason && !conflictData && !nativeDescConflictData) {
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
        if (hasTechnicalBlock || apiBlockReason || conflictData || nativeDescConflictData || fieldStatus === "Optional blank" || fieldStatus === "Required missing") {
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

    const isActualBlockedProposal = isBlockedAction && 
                                    !isManualOnly && 
                                    !HIDDEN_CONTEXT_FIELDS.includes(key) && 
                                    proposalExists && 
                                    currentVal !== propVal;

    return { 
      currentVal, propVal, isProposed, fieldStatus, proposalStatus, source, stage, 
      isBlockedAction, reasons, currentExists, proposalExists, isApproved, hasTechnicalBlock, contentNeedsReview,
      isContentPreApproved, preApprovalReason, isManualOnly, isOperatorOwned, isActualBlockedProposal,
      conflictData, nativeDescConflictData,
      isSupported: isKnownKey,
      label: templateConfig?.label || formatLabel(key),
      control: templateConfig?.control
    };
  };

  const buildRepairPayload = (manifest, product, currentId, currentApprovals) => {
    const safePlan = {};
    const nativeChanges = {};
    
    const dynamicSections = getDynamicSections(manifest);
    const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

    Object.keys(manifest.repairPlan).forEach(key => {
        if (key.startsWith("native_image_alts_")) return; 
        if (key === "native_seo_description") return;
        
        const meta = getFieldMetadata(key, manifest, currentId, currentApprovals, allConfigFields);
        if (!meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key) && !RETIRED_KEYS.includes(key)) {
            if (key === "shopify_title") {
                nativeChanges.title = manifest.repairPlan[key];
            } else if (key === "custom.shipping_weight_oz") {
                const variantsConn = manifest.nativeTargets?.variants;
                if (variantsConn?.edges?.length === 1 && 
                    variantsConn?.pageInfo?.hasNextPage === false && 
                    manifest.nativeTargets?.isComplete === true &&
                    !manifest.nativeTargets?.loadError) {
                    const variantId = variantsConn.edges[0].node?.id;
                    if (variantId) {
                        nativeChanges.shippingWeight = {
                            variantId: variantId,
                            value: manifest.repairPlan[key],
                            unit: "OUNCES"
                        };
                    }
                }
            } else {
                safePlan[key] = manifest.repairPlan[key];
            }
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
                    if (!meta.isBlockedAction && meta.proposalExists && meta.propVal !== meta.currentVal) {
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

  const executeRepairs = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot execute: No items loaded on the bench.");
       return;
    }
    
    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
       setSafetyError("Cannot execute: You must click 'GENERATE REPAIR PLAN' first to load data.");
       return;
    }
    
    if (readyItems.length < queueIds.length) {
        if (!window.confirm(`WARNING: LIVE RUN.\n\nOnly ${readyItems.length} of ${queueIds.length} queued items have loaded manifests. The others will be skipped.\n\nProceed?`)) {
            return;
        }
    } else {
        if (!window.confirm("WARNING: LIVE RUN.\n\nThis will execute structural repairs (edits and deletions) on the live Shopify database for all queued items. Proceed?")) {
            return;
        }
    }
    
    setSafetyError("");
    setSafetyMessage("Structural Repair Engine engaged. Mutating live data...");
    setExecutionMode("REPAIR");
    setIsExecuting(true);
    setExecuteIndex(0);
  }, [queueIds, manifestData]);

  const executeAIFill = useCallback(() => {
    if (queueIds.length === 0) {
       setSafetyError("Cannot run AI: No items loaded on the bench.");
       return;
    }
    
    const readyItems = queueIds.filter(id => manifestData[id]);
    if (readyItems.length === 0) {
       setSafetyError("Cannot run AI: You must click 'GENERATE REPAIR PLAN' first to load data.");
       return;
    }
    
    setApprovals({}); 
    setSafetyError("");
    setSafetyMessage("Industrial AI Batch Pipeline engaged. Firing up the Gemini cores...");
    setExecutionMode("AI_BATCH_PIPELINE");
    setIsExecuting(true);
    setExecuteIndex(0);
    setAiStep(1);
  }, [queueIds, manifestData]);

  // Unified Dispatch Loop Driver
  useEffect(() => {
    const isProcessing = isLoadingData || isExecuting;
    if (!isProcessing) return;
    if (batchFetcher.state !== "idle" || pendingOperation !== null) return;

    if (isLoadingData && loadIndex >= queueIds.length) {
      setIsLoadingData(false);
      setSafetyMessage(`Data loaded and manifests built for ${queueIds.length} items.`);
      return;
    }

    if (isExecuting) {
      if (executionMode === "REPAIR" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
      if (executionMode === "AI_SINGLE_PIPELINE" && aiStep > 4) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Single AI Run Complete. Data staged for review.`);
        return;
      }
      if (executionMode === "AI_BATCH_PIPELINE" && executeIndex >= queueIds.length) {
        setIsExecuting(false);
        setExecutionMode(null);
        setAiStep(0);
        setSafetyMessage(`Execution Complete. Processed ${queueIds.length} items. Note: AI Autofill only populates fields where visual or titled data is evident.`);
        return;
      }
    }

    const currentId = isLoadingData ? queueIds[loadIndex] : (executionMode === "AI_SINGLE_PIPELINE" ? selectedBenchId : queueIds[executeIndex]);
    if (!currentId) return;

    const manifest = manifestData[currentId];
    const product = safeProducts.find(p => p.id === currentId);

    if (!isLoadingData && (!manifest || !product)) {
      updateProductState(currentId, STATUS.SKIPPED, ["No manifest or product data built."]);
      if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
      else setExecuteIndex(i => i + 1);
      return;
    }

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);

    if (isLoadingData) {
      setPendingOperation({ id: currentId, intent: "loadProductData", token });
      updateProductState(currentId, STATUS.SCANNING, ["Fetching live metafields by GID..."]);
      const fd = new FormData();
      fd.append("intent", "loadProductData");
      fd.append("pieceId", currentId);
      batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
    }
    else if (executionMode === "REPAIR") {
      const pieceAi = aiData[currentId] || {};
      if (!pieceAi.repairRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, repairRequested: true } }));
        setPendingOperation({ id: currentId, intent: "executeRepairPlan", token });
        updateProductState(currentId, STATUS.SCANNING, ["Executing structural repairs..."]);
        
        const fd = new FormData();
        fd.append("intent", "executeRepairPlan");
        fd.append("pieceId", currentId);
        
        const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, currentId, approvals);

        const snapshot = { ...safePlan };
        if (nativeChanges.title) snapshot.shopify_title = nativeChanges.title;
        (nativeChanges.imageAlts || []).forEach(alt => {
            snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
        });
        setSubmittedPayloads(prev => ({ ...prev, [currentId]: snapshot }));

        fd.append("repairPlan", JSON.stringify(safePlan));
        fd.append("nativeChanges", JSON.stringify(nativeChanges));
        fd.append("legacyKeysToRemove", JSON.stringify([]));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
      }
    } 
    else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
      const pieceAi = aiData[currentId] || {};

      if (aiStep === 1 && !pieceAi.titleParseRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, titleParseRequested: true } }));
        setPendingOperation({ id: currentId, intent: "titleParse", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 1: Parsing Title & Origin (Gemini + Render DB)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const fd = new FormData();
        fd.append("intent", "titleParse");
        fd.append("pieceName", titleToParse);
        fd.append("pieceId", currentId);
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 2 && !pieceAi.fullRescanRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, fullRescanRequested: true } }));
        setPendingOperation({ id: currentId, intent: "tab3FullRescan", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 2: Vision API Deep Scan (Gemini)..."]);
        
        const titleToParse = manifest.canonicalFields?.shopify_title || product.title;
        const fd = new FormData();
        fd.append("intent", "tab3FullRescan");
        fd.append("pieceId", currentId);
        fd.append("productTitle", titleToParse);
        
        const mediaEdges = manifest.nativeTargets?.media?.edges || [];
        if (mediaEdges.length > 0) {
            const mediaInputs = mediaEdges.map(e => ({
                imageId: e.node.id,
                url: e.node.preview?.image?.url,
                currentAltText: e.node.alt || ""
            })).filter(m => m.imageId && m.url);
            fd.append("mediaInputs", JSON.stringify(mediaInputs));
        } else {
            const imageUrl = product.images?.edges?.[0]?.node?.url || product.featuredImage?.url || product.media?.edges?.[0]?.node?.image?.url || "";
            fd.append("imageUrl", imageUrl);
        }

        fd.append("stone_family", pieceAi.titleParse?.stone_family || "");
        const currentOriginStory = manifest.currentMetafields["custom.origin_story"] || manifest.canonicalFields["custom.origin_story"] || "";
        fd.append("origin_story", currentOriginStory || pieceAi.titleParse?.origin_story || "");
        fd.append("honest_flaws_and_character", manifest.currentMetafields["custom.honest_flaws_and_character"] || "");
        fd.append("weight_grams", manifest.currentMetafields["custom.weight_grams"] || "");
        fd.append("dimensions_mm", manifest.currentMetafields["custom.dimensions_mm"] || "");

        const hardwareKeys = [
            "bail_included", "secondary_medium", "jewelry_finding_type",
            "primary_use", "jewelry_type", "setting_ready",
            "chain_material", "chain_link_type", "character_marks",
            "primary_color", "color_pattern", "surface_finish",
            "treatment_status", "treated", "necklace_design"
        ];
        hardwareKeys.forEach(k => {
            const fullKey = `custom.${k}`;
            let val = "";
            if (manualEdits[currentId]?.[fullKey] === true &&
                manifest.repairPlan?.[fullKey] !== undefined) {
                val = manifest.repairPlan[fullKey];
            } else if (approvals[currentId]?.[fullKey] !== undefined) {
                val = approvals[currentId][fullKey];
            } else if (manifest.currentMetafields?.[fullKey] !== undefined) {
                val = manifest.currentMetafields[fullKey];
            }
            if (val !== undefined && val !== null && String(val).trim() !== "") {
                fd.set(k, String(val));
            }
        });

        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
      else if (aiStep === 3 && !pieceAi.generateDescRequested) {
        setAiData(prev => ({ ...prev, [currentId]: { ...pieceAi, generateDescRequested: true } }));
        setPendingOperation({ id: currentId, intent: "generateDescription", token });
        updateProductState(currentId, STATUS.SCANNING, ["Stage 3: Generating Story Narrative (Gemini)..."]);
        
        const fd = new FormData();
        fd.append("intent", "generateDescription");
        fd.append("pieceId", currentId);
        const descriptionFacts = {};
        const mergeDescriptionFacts = (source) => {
            Object.entries(source || {}).forEach(([key, value]) => {
                if (key.includes(".") && !key.startsWith("custom.")) return;
                const factKey = key.startsWith("custom.") ? key.slice(7) : key;
                if (["intent", "success", "error", "errors", "logs", "debug_origin"].includes(factKey)) return;
                if (value !== undefined && value !== null && String(value).trim() !== "") {
                    descriptionFacts[factKey] = value;
                }
            });
        };

        mergeDescriptionFacts(manifest.currentMetafields);
        mergeDescriptionFacts(pieceAi.titleParse);
        mergeDescriptionFacts(pieceAi.tab3Data);

        Object.entries(manualEdits[currentId] || {}).forEach(([key, edited]) => {
            if (edited === true && key.startsWith("custom.") &&
                manifest.repairPlan?.[key] !== undefined) {
                descriptionFacts[key.slice(7)] = manifest.repairPlan[key];
            }
        });

        Object.entries(approvals[currentId] || {}).forEach(([key, value]) => {
            if (key.startsWith("custom.") && manualEdits[currentId]?.[key] !== true) {
                descriptionFacts[key.slice(7)] = value;
            }
        });

        descriptionFacts.pieceId = currentId;
        fd.append("sharedFields", JSON.stringify({
            stone_family: descriptionFacts.stone_family || descriptionFacts.material || "",
            origin_location: descriptionFacts.origin_location || ""
        }));
        fd.append("pieceData", JSON.stringify(descriptionFacts));
        batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-autofill" });
      }
    }
  }, [isLoadingData, isExecuting, batchFetcher.state, pendingOperation, executionMode, loadIndex, executeIndex, aiStep, queueIds, selectedBenchId, manifestData, safeProducts, aiData, approvals]);

  // Unified Response Receiver
  useEffect(() => {
    if (batchFetcher.state === "idle" && batchFetcher.data && batchFetcher.data !== lastProcessedData) {
      const data = batchFetcher.data;
      setLastProcessedData(data);

      const targetId = data.pieceId || data.productId;
      const intent = data.intent;
      const success = data.success;

      if (pendingOperation) {
          const productIntents = ["loadProductData", "executeRepairPlan", "batchAuditItem", "saveMetafields", "titleParse", "tab3FullRescan", "generateDescription"];
          if (productIntents.includes(intent)) {
              if (!targetId || targetId !== pendingOperation.id) {
                  setSafetyError(`Identity Guard Failed. Response intent: [${intent}], returned ID: [${targetId || 'None'}], expected ID: [${pendingOperation.id}], pending stage: [${isLoadingData ? 'Manifest Load' : 'AI/Repair'}], processed state: [${success ? 'Success' : 'Failed'}]. Result discarded.`);
                  setIsExecuting(false);
                  setIsLoadingData(false);
                  setPendingOperation(null);
                  return;
              }
          }
          if (intent !== pendingOperation.intent) {
             if (!productIntents.includes(intent)) {
                 setPendingOperation(null);
             } else {
                 return; 
             }
          }
      }

      if (!intent) {
          if (pendingOperation) {
              setSafetyError(`Unrecognized Response. No intent provided by backend. Expected ID: [${pendingOperation.id}], pending stage: [${isLoadingData ? 'Manifest Load' : 'AI/Repair'}]. Result discarded.`);
              setIsExecuting(false);
              setIsLoadingData(false);
              setPendingOperation(null);
          }
          return;
      }

      const {
          message, error, errors, logs, status, finalStatus, titleParse, tab3Data, generated_description, fieldsUpdated, legacyKeysRemoved, verifiedGeoValues, readBackVerified, proposedChanges, variantTarget, imageAlts, altValidationErrors,
          unsupportedKeys: rawUnsupportedKeys,
          attemptedDestinations: rawAttemptedDestinations,
          verifiedDestinations: rawVerifiedDestinations,
          unresolvedChanges: rawUnresolvedChanges,
          blockedFields: rawBlockedFields,
          conflicts: rawConflicts
      } = data;

      const unsupportedKeys = validArray(rawUnsupportedKeys);
      const attemptedDestinations = validArray(rawAttemptedDestinations);
      const verifiedDestinations = validArray(rawVerifiedDestinations);
      const unresolvedChanges = validObj(rawUnresolvedChanges);
      const blockedFields = validObj(rawBlockedFields);
      const conflicts = validObj(rawConflicts);
      
      if (intent === "loadProductData" && targetId) {
         if (!success) {
            updateProductState(targetId, STATUS.FAILED, [error || message || "Failed to load data"]);
            setApprovals(prev => { const n = {...prev}; delete n[targetId]; return n; });
            setManualEdits(prev => { const n = {...prev}; delete n[targetId]; return n; });
         } else {
            setManualEdits(prev => {
                const n = {...prev};
                if (n[targetId]) {
                    const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
                    Object.keys(n[targetId]).forEach(k => {
                        if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
                    });
                }
                return n;
            });
            setApprovals(prev => {
                const n = {...prev};
                if (n[targetId]) {
                    const validIds = new Set(data.nativeTargets?.media?.edges?.map(e => `native_image_alts_${e.node.id}`) || []);
                    Object.keys(n[targetId]).forEach(k => {
                        if (k.startsWith("native_image_alts_") && !validIds.has(k)) delete n[targetId][k];
                    });
                }
                return n;
            });

            setManifestData(prev => {
                const prevDiag = prev[targetId]?.diagnostics || {};
                return {
                    ...prev,
                    [targetId]: {
                        ...data,
                        diagnostics: {
                            shopifyRead: success ? "Success" : "Failed",
                            gemini: prevDiag.gemini === "Success" ? "Success" : "Not called",
                            vision: prevDiag.vision === "Success" ? "Success" : "Not called",
                            geoLibrary: prevDiag.geoLibrary === "Success" ? "Success" : "Not called",
                            readBack: "Not called",
                            stage: "loadProductData"
                        }
                    }
                };
            });
            updateProductState(targetId, STATUS.VALIDATED, ["Data Loaded. Manifest Built."]);
         }
      }

      if ((intent === "executeRepairPlan" || intent === "batchAuditItem" || intent === "saveMetafields") && targetId && (!pendingOperation || pendingOperation.intent === intent)) {
        
        if (intent === "executeRepairPlan") {
            const ts = new Date().toISOString();
            setRepairHistory(prev => ({
                ...prev,
                [targetId]: {
                    status,
                    success,
                    message,
                    fieldsUpdated,
                    legacyKeysRemoved,
                    unsupportedKeys,
                    attemptedDestinations,
                    verifiedDestinations,
                    unresolvedChanges,
                    blockedFields,
                    conflicts,
                    readBackVerified,
                    proposedChanges,
                    completedAt: ts,
                    variantTarget: variantTarget || null
                }
            }));
            
            if (data.currentMetafields) {
                 setManifestData(prev => {
                    const existing = prev[targetId];
                    if (!existing) return prev;
                    return {
                        ...prev,
                        [targetId]: {
                            ...existing,
                            currentMetafields: data.currentMetafields,
                            fieldsUpdated: data.fieldsUpdated !== undefined ? data.fieldsUpdated : existing.fieldsUpdated,
                            legacyKeysRemoved: data.legacyKeysRemoved !== undefined ? data.legacyKeysRemoved : existing.legacyKeysRemoved,
                            blockedFields: blockedFields,
                            conflicts: conflicts,
                            diagnostics: {
                                ...existing.diagnostics,
                                shopifyRead: "Success",
                                readBack: data.readBackVerified === true ? "Success" : (data.readBackVerified === false ? "Failed" : "Not called"),
                                stage: "executeRepairPlan"
                            }
                        }
                    };
                });
            }
        }

        if (!success) {
           console.error("Execute Error from Backend:", data);
           const errMsg = message || error || (errors ? errors[0]?.message : "Unknown Error");
           setSafetyError(`Engine halted on ${targetId}. Error: ${errMsg}`);
           updateProductState(targetId, STATUS.FAILED, errors ? errors.map(e => e.message) : (logs || [errMsg]));
        } else {
           if (intent === "batchAuditItem") {
               updateProductState(targetId, STATUS.SCANNING, ["AI Run complete. Fetching fresh data..."]);
               setSafetyMessage("Single AI Run complete. Reloading manifest to display new data...");
               setManifestData(prev => {
                   const existing = prev[targetId];
                   if (!existing) return prev;
                   return {
                       ...prev,
                       [targetId]: {
                           ...existing,
                           diagnostics: {
                               ...existing.diagnostics, gemini: "Success", vision: "Success", stage: "batchAuditItem"
                           }
                       }
                   };
               });
               
               let loadLockActive = true;
               if (!pendingOperation) {
                  setPendingOperation({ id: targetId, intent: "loadProductData", token: "audit-reload" });
               } else {
                  loadLockActive = false; 
               }

               setTimeout(() => {
                   if (loadLockActive) {
                       const fd = new FormData();
                       fd.append("intent", "loadProductData");
                       fd.append("pieceId", targetId);
                       batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
                   }
               }, 500);
           }

           const successLogs = logs || [message || "Operation applied successfully."];
           let statusToSet = STATUS.COMPLETE;
           if (status === "NO_CHANGES_REQUIRED" || message === "No changes required." || (fieldsUpdated === 0 && Object.keys(blockedFields).length === 0)) {
               statusToSet = STATUS.SKIPPED;
               successLogs.push("No changes required.");
           } else if (finalStatus === "Needs Review" || status === "REPAIR_FAILED" || readBackVerified === false) {
               statusToSet = STATUS.FAILED;
           }
           
           if (Object.keys(blockedFields).length > 0) successLogs.push(`Partial API block: ${Object.keys(blockedFields).length} fields rejected by Shopify.`);
           if (Object.keys(conflicts).length > 0) successLogs.push(`Read-back error: ${Object.keys(conflicts).length} fields failed to save properly.`);

           updateProductState(targetId, statusToSet, successLogs);
        }
      }

      if (["titleParse", "tab3FullRescan", "generateDescription"].includes(intent) && (!pendingOperation || pendingOperation.intent === intent)) {
          if (!success) {
              updateProductState(targetId, STATUS.FAILED, [error || `Gemini failed at ${intent}`]);
              setSafetyError(`Engine halted on piece ${targetId}. Error: ${error || "Unknown Gemini API Error"}`);
              setManifestData(prev => {
                  const existing = prev[targetId];
                  if (!existing) return prev;
                  const diagnostics = { ...existing.diagnostics, error: error || `Gemini failed at ${intent}` };
                  if (intent === "titleParse" || intent === "generateDescription") diagnostics.gemini = "Failed";
                  if (intent === "tab3FullRescan") { diagnostics.vision = "Failed"; diagnostics.gemini = "Failed"; }
                  return { ...prev, [targetId]: { ...existing, diagnostics } };
              });
          } else {
              if (intent === "titleParse") {
                  setAiData(prev => ({ ...prev, [targetId]: { ...prev[targetId], titleParse } }));
              } 
              else if (intent === "tab3FullRescan") {
                  setAiData(prev => ({ 
                      ...prev, 
                      [targetId]: { 
                          ...prev[targetId], 
                          tab3Data, 
                          verifiedGeoValues,
                          imageAlts,
                          altValidationErrors 
                      } 
                  }));
              } 
              else if (intent === "generateDescription") {
                  setAiData(prevAi => {
                      const updatedPieceAi = { ...prevAi[targetId], generated_description };
                      setManifestData(prevMan => {
                          const existing = prevMan[targetId];
                          if (!existing) return prevMan;
                          const newPlan = { ...existing.repairPlan };
                          const diagnostics = { ...(existing.diagnostics || {}) };
                          
                          const titleData = updatedPieceAi.titleParse || {};
                          const visionData = updatedPieceAi.tab3Data || {};
                          const descData = updatedPieceAi.generated_description || "";
                          const verifiedGeo = updatedPieceAi.verifiedGeoValues || {};

                          if (updatedPieceAi.titleParseRequested) {
                              diagnostics.gemini = "Success";
                              diagnostics.geoLibrary = titleData?.geoSource === "library" ? "Success" : (titleData?.geoSource || "Not reported");
                              diagnostics.stage = "titleParse";
                          }
                          if (updatedPieceAi.fullRescanRequested) {
                              diagnostics.vision = "Success"; diagnostics.gemini = "Success"; diagnostics.stage = "tab3FullRescan";
                          }
                          if (updatedPieceAi.generateDescRequested) {
                              diagnostics.gemini = "Success"; diagnostics.stage = "generateDescription";
                          }

                          const safeApply = (keyName, aiValue) => {
                              const targetKey = NATIVE_ALIAS_MAP[keyName] || keyName;
                              if (RETIRED_KEYS.includes(targetKey)) return; 
                              if (manualEdits[targetId] && manualEdits[targetId][targetKey] === true) return; 
                              newPlan[targetKey] = aiValue;
                          };

                          Object.keys(visionData).forEach(k => {
                              if (k !== "generated_description" && k !== "pieceId" && k !== "debug_origin" && k !== "intent" && k !== "success" && k !== "origin_story") {
                                  safeApply(NATIVE_FIELDS.includes(k) || k.includes('.') || k.startsWith('native_') ? k : `custom.${k}`, visionData[k]);
                              }
                          });
                          
                          Object.keys(titleData).forEach(k => {
                              if (k !== "pieceId" && k !== "intent" && k !== "success" && k !== "geoSource" && k !== "origin_story") {
                                  const targetKey = NATIVE_FIELDS.includes(k) || k.includes('.') || k.startsWith('native_') ? k : `custom.${k}`;
                                  const bareKey = targetKey.startsWith("custom.") ? targetKey.slice(7) : k;
                                  const visionHasValue = [k, targetKey, bareKey].some(candidate =>
                                      Object.prototype.hasOwnProperty.call(visionData, candidate) &&
                                      visionData[candidate] !== undefined &&
                                      visionData[candidate] !== null &&
                                      String(visionData[candidate]).trim() !== ""
                                  );
                                  if (!visionHasValue) safeApply(targetKey, titleData[k]);
                              }
                          });

                          const enrichedSeo = visionData.seo_title || visionData["custom.seo_title"] || titleData.seo_title || "";
                          if (enrichedSeo.trim() !== "") safeApply("custom.seo_title", enrichedSeo.trim());
                          if (descData) safeApply("custom.generated_description", descData);

                          const stoneGrams = parseFloat(existing.currentMetafields?.["custom.weight_grams"]) || 0;
                          if (stoneGrams > 0) {
                              safeApply("custom.shipping_weight_oz", String(Math.ceil((stoneGrams / 28.3495) + 0.5)));
                          }
                          
                          if (visionData.poetic_hook) {
                              safeApply("native_seo_description", visionData.poetic_hook);
                          }

                          if (updatedPieceAi.imageAlts) {
                              updatedPieceAi.imageAlts.forEach(altObj => {
                                  if (altObj.imageId && altObj.altText) safeApply(`native_image_alts_${altObj.imageId}`, altObj.altText);
                              });
                          }
                          if (updatedPieceAi.altValidationErrors) diagnostics.altValidationErrors = updatedPieceAi.altValidationErrors;

                          return { ...prevMan, [targetId]: { ...existing, repairPlan: newPlan, diagnostics, verifiedGeoValues: verifiedGeo } };
                      });
                      return { ...prevAi, [targetId]: updatedPieceAi };
                  });
                  updateProductState(targetId, STATUS.VALIDATED, ["AI Pipeline Complete. Data staged."]);
              }
          }
      }

      if (pendingOperation) {
          const op = pendingOperation;
          setPendingOperation(null);
          
          if (!success) {
              setIsExecuting(false);
              setIsLoadingData(false);
              return;
          }

          if (isLoadingData) {
              setLoadIndex(i => i + 1);
          } else if (isExecuting) {
              if (executionMode === "REPAIR") {
                  setExecuteIndex(i => i + 1);
              } else if (executionMode === "AI_BATCH_PIPELINE" || executionMode === "AI_SINGLE_PIPELINE") {
                  if (op.intent === "titleParse") {
                      setAiStep(2);
                  } else if (op.intent === "tab3FullRescan") {
                      setAiStep(3);
                  } else if (op.intent === "generateDescription") {
                      if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
                      else { setAiStep(1); setExecuteIndex(i => i + 1); }
                  }
              }
          }
      }
    }
  }, [batchFetcher.state, batchFetcher.data, lastProcessedData, pendingOperation, executionMode, isLoadingData, isExecuting, manualEdits, updateProductState]);

  const handleRepairPlanChange = (key, value) => {
    if (!selectedBenchId) return;
    const targetKey = NATIVE_ALIAS_MAP[key] || key;
    
    setManualEdits(prev => {
        const next = { ...prev };
        if (!next[selectedBenchId]) next[selectedBenchId] = {};
        next[selectedBenchId][targetKey] = true;
        return next;
    });
    
    setApprovals(prev => {
        if (prev[selectedBenchId] && prev[selectedBenchId][targetKey] !== undefined) {
            const next = { ...prev };
            delete next[selectedBenchId][targetKey];
            return next;
        }
        return prev;
    });

    setManifestData(prev => ({
       ...prev,
       [selectedBenchId]: {
          ...prev[selectedBenchId],
          repairPlan: {
             ...prev[selectedBenchId].repairPlan,
             [targetKey]: value
          }
       }
    }));
  };

  const handleExecuteSingleRepair = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
       setSafetyError("Generate Repair Plan for this item first.");
       return;
    }
    
    const product = safeProducts.find(p => p.id === selectedBenchId);
    if (!product) {
       setSafetyError("Product data not found in inventory.");
       return;
    }

    const fd = new FormData();
    fd.append("intent", "executeRepairPlan");
    fd.append("pieceId", selectedBenchId);
    
    const { safePlan, nativeChanges } = buildRepairPayload(manifest, product, selectedBenchId, approvals);

    const snapshot = { ...safePlan };
    if (nativeChanges.title) snapshot.shopify_title = nativeChanges.title;
    (nativeChanges.imageAlts || []).forEach(alt => {
        snapshot[`native_image_alts_${alt.imageId}`] = alt.altText;
    });
    setSubmittedPayloads(prev => ({ ...prev, [selectedBenchId]: snapshot }));

    fd.append("repairPlan", JSON.stringify(safePlan));
    fd.append("nativeChanges", JSON.stringify(nativeChanges));
    fd.append("legacyKeysToRemove", JSON.stringify([]));

    const token = Date.now().toString() + Math.random().toString(36).substring(2, 7);
    setPendingOperation({ id: selectedBenchId, intent: "executeRepairPlan", token });
    updateProductState(selectedBenchId, STATUS.SCANNING, ["Executing single structural repair..."]);
    batchFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedBenchId, manifestData, approvals, batchFetcher, updateProductState, safeProducts]);

  const handleExecuteSingleAI = useCallback(() => {
    if (!selectedBenchId) return;
    const manifest = manifestData[selectedBenchId];
    if (!manifest) {
       setSafetyError("Cannot run AI: Generate Repair Plan for this item first to load live data.");
       return;
    }

    setApprovals(prev => {
        const next = { ...prev };
        delete next[selectedBenchId];
        return next;
    });
    
    setSafetyError("");
    setSafetyMessage(`Single-Pass AI Pipeline engaged for ${selectedBenchId}...`);
    setExecutionMode("AI_SINGLE_PIPELINE");
    setIsExecuting(true);
    setAiStep(1);
    setAiData({});
  }, [selectedBenchId, manifestData]);

  const getStatusTone = (status) => {
    switch(status) {
      case STATUS.VALIDATED: return "success";
      case STATUS.COMPLETE: return "success";
      case STATUS.SCANNING: return "magic";
      case STATUS.FAILED: return "critical";
      case STATUS.QUEUED: return "info";
      default: return undefined;
    }
  };

  const isMultilineKey = (k, control) => control === "multiline" || [
    "custom.generated_description", "custom.stone_story", 
    "custom.bench_notes", "custom.character_marks", "custom.honest_flaws_and_character", 
    "custom.artist_notes", "custom.origin_story"
  ].includes(k);

  const getSystemStatus = () => {
      const data = manifestData[selectedBenchId];
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
      let fetcherStateDisplay = batchFetcher.state;
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

      if (batchFetcher.state !== "idle" && batchFetcher.formData?.get("pieceId") === selectedBenchId) {
          const intent = batchFetcher.formData?.get("intent");
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

  const getDiagnosticsStats = (data) => {
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

            if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked") stats.proposed++;
            
            if (meta.isActualBlockedProposal) {
                stats.blocked++;
            } else if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k) && !meta.isManualOnly && meta.proposalExists && meta.currentVal === meta.propVal) {
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
            if ((meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") && !meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(k)) stats.approvedWrite++;
        });
    });

    return stats;
  };

  const handleCollectTelemetry = useCallback((mode = 'full') => {
      if (!selectedBenchId || !manifestData[selectedBenchId]) {
          setSafetyError(`Cannot collect telemetry: No active bench item.`);
          return;
      }

      const data = manifestData[selectedBenchId];
      const history = repairHistory[selectedBenchId];
      const product = safeProducts.find(p => p.id === selectedBenchId) || {};
      const statusObj = getSystemStatus();
      const diag = data.diagnostics || {};
      const dynamicSections = getDynamicSections(data);
      const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);
      const lastSubmitted = submittedPayloads[selectedBenchId];

      const unsupportedKeys = validArray(history?.unsupportedKeys);
      const verifiedDestinations = validArray(history?.verifiedDestinations);
      const blockedFields = validObj(history?.blockedFields);
      const conflicts = validObj(history?.conflicts);
      const unresolvedChanges = validObj(history?.unresolvedChanges);

      let stats = {
          loaded: 0,
          blank: 0,
          proposed: 0,
          blocked: 0,
          protected: 0,
          conflicting: 0,
          updated: history && history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not recorded",
          errored: "Not recorded"
      };

      const isGeologyField = (key) => {
          const normalized = key.replace(/^custom\./, '').replace(/-/g, '_').toLowerCase();
          const geoKeys = [
              "mohs_hardness", "specific_gravity", "crystal_system", "fracture_pattern",
              "cleavage", "luster", "diaphaneity", "mineral_class", "geological_age",
              "geological_era", "rock_formation", "rock_composition"
          ];
          return geoKeys.includes(normalized);
      };

      const isNarrativeBlock = (key) => {
          const normalized = key.replace(/^custom\./, '').replace(/-/g, '_').toLowerCase();
          return ["generated_description", "stone_story", "origin_story", "native_description", "native_descriptionhtml"].includes(normalized);
      };

      const isProtectedIntegration = (key) => {
          return INTEGRATION_PREFIXES.some(prefix => key.startsWith(prefix));
      };

      const truncateForTelemetry = (text, limit = 100) => {
          if (!text) return "";
          const str = String(text).replace(/\n/g, " ").trim();
          if (str.length <= limit) return str;
          return `${str.substring(0, limit)}...`;
      };

      let reviewCandidates = [];

      dynamicSections.forEach(sec => {
          sec.keys.forEach(key => {
              const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
              
              if (meta.currentExists) stats.loaded++;
              if (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing") stats.blank++;
              if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked") stats.proposed++;
              if (meta.isBlockedAction && !HIDDEN_CONTEXT_FIELDS.includes(key)) stats.blocked++;
              if (PROTECTED_FIELDS.includes(key) || meta.isOperatorOwned) stats.protected++;
              if (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade" || meta.fieldStatus === "Save Conflict") stats.conflicting++;

              const isGeo = isGeologyField(key);
              const isNarrative = isNarrativeBlock(key);
              const isProtectedInt = isProtectedIntegration(key);

              if (mode === 'review') {
                  let isUnapprovedProblem = false;
                  let isOptionalConditional = false;
                  
                  if (!meta.isApproved && meta.proposalExists && meta.currentVal !== meta.propVal) isUnapprovedProblem = true;
                  if (!meta.isApproved && meta.contentNeedsReview) isUnapprovedProblem = true;
                  if (["Required missing", "Unverified proposal", "Conflict", "Degrade", "API Error / Blocked", "Save Conflict"].includes(meta.fieldStatus) || meta.fieldStatus.includes("Blocked")) {
                      isUnapprovedProblem = true;
                  }
                  if (meta.fieldStatus === "Optional blank" || meta.proposalStatus === "Empty" || meta.fieldStatus === "Manual only") {
                      isOptionalConditional = true;
                  }

                  const isRoutineMandatory = REQUIRED_FIELDS.includes(key) && (meta.isApproved || meta.currentVal === meta.propVal);

                  if ((isUnapprovedProblem || isOptionalConditional) && !isRoutineMandatory) {
                      reviewCandidates.push({
                          key, meta, isGeo, isNarrative, isProtectedInt, priority: isUnapprovedProblem ? 1 : 2
                      });
                  }
              }
          });
      });

      let reportBlocks = [];
      let reportType = mode === 'review' ? 'REVIEW TELEMETRY' : 'FULL TELEMETRY DUMP';

      reportBlocks.push(`=== ROCKHOUND STUDIO ${reportType} ===\nProduct: ${product.title || "Not recorded"}\nGID: ${selectedBenchId || "Not recorded"}\nRun Time: ${new Date().toISOString()}`);

      const titleParseStatus = (diag.stage === "titleParse" || diag.stage === "tab3FullRescan" || diag.stage === "generateDescription" || diag.stage === "batchAuditItem") ? (diag.gemini || "Unknown") : "Not called";
      const visionStatus = diag.vision || "Not called";
      const geoStatus = diag.geoLibrary || "Not called";
      const descStatus = (data.repairPlan?.["custom.generated_description"] || data.currentMetafields?.["custom.generated_description"]) ? "Success" : (diag.stage === "generateDescription" ? (diag.gemini || "Unknown") : "Not called");

      const shopifyRead = statusObj.shopifyReadStatus;
      const readBack = history && history.readBackVerified !== undefined ? (history.readBackVerified ? "Success" : "Failed") : statusObj.readBackStatus;

      reportBlocks.push(`--- PIPELINE STATUS ---\n[Shopify IO]\nRead: ${shopifyRead}\nBackend-reported updates: ${history && history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not recorded"}\nRead-Back: ${readBack}\n\n[AI Stages]\nTitle Parse: ${titleParseStatus}\nVision Scan: ${visionStatus}\nGeo Library: ${geoStatus}\nStory Gen: ${descStatus}`);

      reportBlocks.push(`--- FIELD SUMMARY ---\nLoaded: ${stats.loaded}\nBlank: ${stats.blank}\nProposed: ${stats.proposed}\nBlocked: ${stats.blocked}\nProtected: ${stats.protected}\nConflicting: ${stats.conflicting}\nUpdated: ${stats.updated}\nErrored: ${stats.errored}`);

      if (history) {
          reportBlocks.push(`--- LAST REPAIR HISTORY ---\nTime: ${history.completedAt}\nStatus: ${history.status}\nMessage: ${history.message}\nBlocked: ${Object.keys(blockedFields).length}\nConflicts: ${Object.keys(conflicts).length}\nVariant Target: ${history.variantTarget || 'Not recorded'}`);
      } else {
          reportBlocks.push(`--- LAST REPAIR HISTORY ---\nNot recorded`);
      }

      let telemetryBody = "--- EXECUTION & REVIEW DETAILS ---\n";
      let detailExcludedCount = 0;
      let omissionsCount = 0;
      let unchangedCount = 0;
      let optionalBlankCount = 0;
      let verifiedMatchesCount = 0;

      let failures = [];
      if (unsupportedKeys.length > 0) failures.push(`Unsupported Keys: ${unsupportedKeys.join(", ")}`);

      Object.keys(blockedFields).forEach(k => failures.push(`Blocked [${k}]: ${blockedFields[k]}`));
      Object.keys(conflicts).forEach(k => {
          const expected = typeof conflicts[k] === 'object' ? conflicts[k].expected : 'unknown';
          const actual = typeof conflicts[k] === 'object' ? conflicts[k].actual : conflicts[k];
          failures.push(`Conflict [${k}]: Expected [${truncateForTelemetry(expected, 60)}] -> Actual [${truncateForTelemetry(actual, 60)}]`);
      });
      Object.keys(unresolvedChanges).forEach(k => {
          failures.push(`Unresolved [${k}]: ${truncateForTelemetry(unresolvedChanges[k], 60)}`);
      });

      if (lastSubmitted) {
          Object.keys(lastSubmitted).forEach(submitKey => {
              const meta = getFieldMetadata(submitKey, data, selectedBenchId, approvals, allConfigFields);
              const intendedVal = String(lastSubmitted[submitKey] || "");
              const returnVal = String(meta.currentVal || "");

              const isGeo = isGeologyField(submitKey);
              const isNarrative = isNarrativeBlock(submitKey);
              const isProtectedInt = isProtectedIntegration(submitKey);

              if (returnVal === intendedVal && returnVal !== "") {
                  verifiedMatchesCount++;
              } else if (returnVal !== intendedVal && returnVal !== "") {
                  if (isGeo || isNarrative || isProtectedInt) {
                      failures.push(`Execution Mismatch [${submitKey}]: [Detail Excluded]`);
                      detailExcludedCount++;
                  } else {
                      failures.push(`Execution Mismatch [${submitKey}]:\n  Intended: [${truncateForTelemetry(intendedVal, 100)}]\n  Returned: [${truncateForTelemetry(returnVal, 100)}]\n  Outcome: Returned mismatch`);
                  }
              } else if (returnVal === "") {
                  failures.push(`Execution Mismatch [${submitKey}]: Not verified (verification unavailable)`);
              }
          });
      }

      const reviewKeys = new Set(reviewCandidates.map(c => c.key));
      reviewCandidates.forEach(c => {
           const { key, meta, isGeo, isNarrative, isProtectedInt } = c;
           if (key === "custom.origin_story") {
                failures.push(`- ${key}: [Hidden Context] Status: ${meta.fieldStatus}`);
                detailExcludedCount++;
           } else if (isGeo || isNarrative || isProtectedInt) {
                failures.push(`- ${key}: [Detail Excluded] Status: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"}`);
                detailExcludedCount++;
           } else {
                failures.push(`- ${key}: Stat: ${meta.fieldStatus} | Rsn: ${meta.reasons[0] || "None"} | Curr: [${truncateForTelemetry(meta.currentVal, 60)}] | Prop: [${truncateForTelemetry(meta.propVal, 60)}]`);
           }
      });

      if (failures.length > 0) {
           telemetryBody += "[FAILURES & ATTENTION NEEDED]\n" + failures.join("\n") + "\n";
      }

      if (verifiedDestinations.length > 0) {
           telemetryBody += `\n[VERIFIED DESTINATIONS]\nBackend Confirmed: ${verifiedDestinations.join(", ")}\n`;
      } else if (history) {
           telemetryBody += `\n[VERIFIED DESTINATIONS]\nNot recorded\n`;
      }

      dynamicSections.forEach(sec => {
           sec.keys.forEach(key => {
               const meta = getFieldMetadata(key, data, selectedBenchId, approvals, allConfigFields);
               if (!reviewKeys.has(key) && !blockedFields[key] && !conflicts[key] && !unresolvedChanges[key] && !unsupportedKeys.includes(key)) {
                    if (meta.fieldStatus === "Unchanged" && meta.currentVal !== "") unchangedCount++;
                    else if (meta.fieldStatus === "Optional blank") optionalBlankCount++;
                    else omissionsCount++; 
               }
           });
      });

      telemetryBody += `\n[SUMMARY STATS]\n`;
      if (lastSubmitted) telemetryBody += `Verified Matches (Submitted vs Read-Back): ${verifiedMatchesCount} fields\n`;
      telemetryBody += `Unchanged Comparisons: ${unchangedCount} fields intact\n`;
      telemetryBody += `Optional Blanks: ${optionalBlankCount} fields\n`;
      telemetryBody += `Other Omissions: ${omissionsCount} fields\n`;
      telemetryBody += `Detail Excluded (Geo/Narrative/Protected): ${detailExcludedCount} fields`;

      reportBlocks.push(telemetryBody);

      const recommendations = [];
      if (Object.keys(blockedFields).length > 0 || failures.some(f => f.includes("Required missing"))) {
          recommendations.push("1. DO NOT WRITE. Review and manually resolve blocked or required fields.");
      } else if (lastSubmitted && (failures.some(f => f.includes("Execution Mismatch")))) {
          recommendations.push(`1. WARNING: Submitted change(s) remain unresolved or unverified after execution. Review the execution mismatch block.`);
      } else if (!lastSubmitted && history && stats.proposed > 0) {
          recommendations.push("1. Exact execution payload unavailable. Some fields appear proposed post-save, but cannot be proven as failed writes. Review manually.");
      } else if (stats.proposed > 0 && !history) {
          recommendations.push("1. Content review complete. Technically eligible proposals are staged. Proceed with 'Execute Single Repair'.");
      } else if (history && history.fieldsUpdated !== undefined) {
          recommendations.push("1. Backend request successful. Check live Shopify admin to confirm field updates.");
      } else {
          recommendations.push("1. Load data or generate a repair plan to begin.");
      }

      reportBlocks.push(`--- RECOMMENDATIONS ---\n${recommendations.join("\n")}\n=========================================`);

      let finalReport = "";
      let maxLimit = mode === 'review' ? 6000 : 10000;

      for (let i = 0; i < reportBlocks.length; i++) {
          if (finalReport.length + reportBlocks[i].length + 2 > maxLimit) {
              finalReport += `\n\n[WARNING: Cutoff reached. Exceeded limit by ${finalReport.length + reportBlocks[i].length + 2 - maxLimit} characters.]`;
              break;
          }
          finalReport += (i > 0 ? "\n\n" : "") + reportBlocks[i];
      }

      navigator.clipboard.writeText(finalReport)
          .then(() => {
              if (window.shopify && window.shopify.toast) {
                  window.shopify.toast.show(`${mode === 'review' ? 'Review telemetry' : 'Full report'} copied`);
              } else {
                  setSafetyMessage(`${mode === 'review' ? 'Review telemetry' : 'Full report'} copied to clipboard.`);
              }
          })
          .catch(err => {
              console.error("Clipboard error", err);
              setSafetyError("Failed to copy telemetry to clipboard.");
          });
  }, [selectedBenchId, manifestData, repairHistory, safeProducts, approvals, batchFetcher.state, isLoadingData, safetyError, aiStep, executionMode, getSystemStatus, submittedPayloads]);

  const renderDiagnosticHeader = () => {
    const data = manifestData[selectedBenchId];
    if (!data) return null;

    const stats = getDiagnosticsStats(data);
    const statusObj = getSystemStatus();
    const history = repairHistory[selectedBenchId];

    return (
      <Card padding="400">
        <BlockStack gap="400">
          <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingLg" as="h3">Diagnostic Header</Text>
            <InlineStack gap="300">
              <Button size="large" onClick={() => handleCollectTelemetry('review')}>
                Copy review telemetry
              </Button>
              <Button size="large" variant="primary" icon={ClipboardIcon} onClick={() => handleCollectTelemetry('full')}>
                Copy full report
              </Button>
            </InlineStack>
          </InlineStack>
          
          {data.diagnostics?.altValidationErrors && data.diagnostics.altValidationErrors.length > 0 && (
              <Banner tone="warning" title="Vision Alt Validation Errors">
                  <BlockStack gap="100">
                      {data.diagnostics.altValidationErrors.map((err, i) => (
                          <Text key={i} as="p" variant="bodyMd">{err}</Text>
                      ))}
                  </BlockStack>
              </Banner>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            
            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">System Status</Text>
                <BlockStack gap="100" align="start">
                  <Text as="p" fontWeight="bold">Shopify Read: <Badge tone={statusObj.shopifyReadStatus === "Success" ? "success" : (statusObj.shopifyReadStatus === "Running" ? "magic" : "critical")}>{statusObj.shopifyReadStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Gemini API: <Badge tone={statusObj.geminiStatus === "Running" ? "magic" : "info"}>{statusObj.geminiStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Vision API: <Badge tone={statusObj.visionStatus === "Running" ? "magic" : "info"}>{statusObj.visionStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Geo Library: <Badge tone="info">{statusObj.geoLibraryStatus}</Badge></Text>
                  <Text as="p" fontWeight="bold">Read-back: <Badge tone={statusObj.readBackStatus === "Success" ? "success" : (statusObj.readBackStatus === "Failed" ? "critical" : "info")}>{statusObj.readBackStatus}</Badge></Text>
                </BlockStack>
              </div>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">Repair Engine</Text>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="bold">Proposed changes: {stats.proposed}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Blocked changes: {stats.blocked}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Degraded fields: {stats.degraded}</Text>
                  <Text as="p" fontWeight="bold" color="critical">Conflicts: {stats.conflicts}</Text>
                  <Text as="p" fontWeight="bold" color="attention">Unverified proposals: {stats.unverified}</Text>
                  <Text as="p" fontWeight="bold" tone="subdued">Manual exclusions: {stats.manualOnly}</Text>
                  <Text as="p" fontWeight="bold" tone="subdued">Unchanged w/ flags: {stats.unchangedFlagged}</Text>
                  <Text as="p" fontWeight="bold" color="success">Fields approved for write: {stats.approvedWrite}</Text>
                </BlockStack>
              </div>
            </Box>

            <Box padding="300" background="bg-surface-secondary" borderRadius="100" borderColor="border" borderWidth="1">
              <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                <Text as="p" variant="headingSm" tone="subdued">Field Metrics</Text>
                <BlockStack gap="100">
                  <Text as="p" fontWeight="bold">Total Fields: {stats.total}</Text>
                  <Text as="p" fontWeight="bold">Filled: <span style={{ color: "#22c55e" }}>{stats.filled}</span></Text>
                  <Text as="p" fontWeight="bold">Optional blanks: <span style={{ color: "#eab308" }}>{stats.optionalBlanks}</span></Text>
                  <Text as="p" fontWeight="bold" color="critical">Required missing fields: {stats.requiredMissing}</Text>
                  <Text as="p" fontWeight="bold">Fields Updated: {data.fieldsUpdated !== undefined ? data.fieldsUpdated : "Not reported"}</Text>
                </BlockStack>
              </div>
            </Box>

          </div>

          {history && (
            <Card padding="300" background="bg-surface-secondary">
              <BlockStack gap="200">
                 <Text as="h4" variant="headingSm" tone="subdued">Last Repair Results</Text>
                 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                   <BlockStack gap="100">
                     <Text as="p" variant="bodySm"><strong>Time:</strong> {new Date(history.completedAt).toLocaleTimeString()}</Text>
                     <Text as="p" variant="bodySm"><strong>Status:</strong> {history.status}</Text>
                     <Text as="p" variant="bodySm"><strong>Message:</strong> {history.message}</Text>
                   </BlockStack>
                   <BlockStack gap="100">
                     <Text as="p" variant="bodySm"><strong>Updated:</strong> {history.fieldsUpdated !== undefined ? history.fieldsUpdated : "Not reported"}</Text>
                     <Text as="p" variant="bodySm"><strong>Verified Destinations:</strong> {validArray(history.verifiedDestinations).length}</Text>
                     <Text as="p" variant="bodySm"><strong>Blocked:</strong> {Object.keys(validObj(history.blockedFields)).length}</Text>
                   </BlockStack>
                   <BlockStack gap="100">
                     <Text as="p" variant="bodySm"><strong>Conflicts:</strong> {Object.keys(validObj(history.conflicts)).length}</Text>
                     <Text as="p" variant="bodySm"><strong>Unresolved:</strong> {Object.keys(validObj(history.unresolvedChanges)).length}</Text>
                     <Text as="p" variant="bodySm"><strong>Unsupported:</strong> {validArray(history.unsupportedKeys).length}</Text>
                     <Text as="p" variant="bodySm"><strong>Read-Back:</strong> {history.readBackVerified !== undefined ? (history.readBackVerified ? "Verified" : "Failed") : "Not reported"}</Text>
                   </BlockStack>
                 </div>
              </BlockStack>
            </Card>
          )}
        </BlockStack>
      </Card>
    );
  };

  const toggleBay = (title) => {
    setExpandedBays(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const renderManifestTable = (section) => {
    const data = manifestData[selectedBenchId];
    if (!data) return null;

    const filteredKeys = section.keys.filter(k => {
      if (HIDDEN_CONTEXT_FIELDS.includes(k)) return false;
      
      if (activeFilter === "All") return true;
      const meta = getFieldMetadata(k, data, selectedBenchId, approvals, section.configFields);
      
      if (activeFilter === "Blank" && (meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing")) return true;
      if (activeFilter === "Proposed changes" && (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, not saved" || meta.fieldStatus === "Pre-approved, blocked")) return true;
      if (activeFilter === "Conflicts" && (meta.fieldStatus === "Conflict" || meta.fieldStatus === "Degrade" || meta.fieldStatus === "Save Conflict")) return true;
      if (activeFilter === "Needs review" && (meta.fieldStatus === "Required missing" || meta.fieldStatus === "Unverified proposal" || (meta.contentNeedsReview && !meta.isApproved && !meta.isContentPreApproved) || meta.fieldStatus === "API Error / Blocked")) return true;
      if (activeFilter === meta.source) return true;
      return false;
    });

    if (filteredKeys.length === 0) return null;
    const isExpanded = expandedBays[section.title];
    const groupColorTone = section.configFields?.[0]?.color === "success" ? "success" : undefined;

    return (
      <Card padding="0" key={section.title}>
        <div 
            onClick={() => toggleBay(section.title)} 
            style={{ padding: "16px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderBottom: isExpanded ? "1px solid #e1e3e5" : "none", minWidth: 0, boxSizing: "border-box" }}
        >
          <div style={{ minWidth: 0 }}>
            <Text as="h3" variant="headingLg" fontWeight="bold" tone={groupColorTone}>{section.title} ({filteredKeys.length} fields)</Text>
          </div>
          <Button variant="plain" icon={isExpanded ? ChevronUpIcon : ChevronDownIcon} />
        </div>
        
        {isExpanded && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0, boxSizing: "border-box" }}>
            {filteredKeys.map((key) => {
              const meta = getFieldMetadata(key, data, selectedBenchId, approvals, section.configFields);
              const isBlank = meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing";
              
              let statusTone = undefined;
              if (meta.fieldStatus === "Optional blank") statusTone = "attention";
              if (["Required missing", "Conflict", "Degrade", "Blocked", "API Error / Blocked", "Over limit", "Failed", "Unverified proposal", "Save Conflict"].includes(meta.fieldStatus)) statusTone = "critical";
              if (meta.fieldStatus === "Manual only") statusTone = "info";
              if (meta.fieldStatus === "Proposed" || meta.fieldStatus === "Approved, not saved" || meta.fieldStatus === "Pre-approved, not saved") statusTone = "success";
              if (meta.fieldStatus === "Unchanged") statusTone = "new";
              if (meta.fieldStatus === "Approved, blocked" || meta.fieldStatus === "Pre-approved, blocked") statusTone = "warning";

              const canApprove = meta.proposalExists && meta.currentVal !== meta.propVal && !meta.isManualOnly && !meta.isContentPreApproved && meta.fieldStatus !== "API Error / Blocked" && meta.fieldStatus !== "Save Conflict" && meta.isSupported;
              const isPreApprovedDisplay = meta.isContentPreApproved && meta.proposalExists && meta.currentVal !== meta.propVal;
              
              let boxBg = "#f8f9fa";
              let boxBorder = "#dee2e6";
              let textColor = "#212529";
              let statusText = "Ready for review";

              if (!meta.isSupported) {
                  boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                  statusText = "Connection pending.";
              } else if (meta.reasons.includes("SEO description save connection pending.")) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  statusText = "SEO description save connection pending. Draft is staged but write is disabled.";
              } else if (meta.isManualOnly) {
                  boxBg = "#f8f9fa"; boxBorder = "#dee2e6"; textColor = "#41464c";
                  statusText = "Manual only field. Excluded from automated writes.";
              } else if (meta.fieldStatus === "API Error / Blocked" || meta.fieldStatus === "Save Conflict") {
                  boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
                  statusText = "Previous save attempt failed API validation or read-back. Review specific error.";
              } else if (meta.isContentPreApproved && !meta.hasTechnicalBlock) {
                  boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
                  statusText = "Pre-approved, not saved.";
              } else if (meta.isContentPreApproved && meta.hasTechnicalBlock) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  const technicalBlockers = meta.reasons.filter(r => !["Proposed", "Category pre-approved", "Verified Geo Library", "Pre-approved by operator policy", "Native Image Alt pre-approved by policy", "Historical: Conflict (Pre-approved)", "Historical: Degrade (Pre-approved)", "Historical: Unverified proposal (Pre-approved)"].includes(r)).join(", ");
                  statusText = `Pre-approved. Cannot save until field destination/type is verified or limits resolved. (${technicalBlockers})`;
              } else if (meta.isApproved && !meta.hasTechnicalBlock) {
                  boxBg = "#d1e7dd"; boxBorder = "#badbcc"; textColor = "#0f5132";
                  statusText = "Approved and technically eligible.";
              } else if (meta.isApproved && meta.hasTechnicalBlock) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  statusText = "Suggestion approved. Cannot save until field destination/type is verified or limits resolved.";
              } else if (!meta.isApproved && meta.hasTechnicalBlock) {
                  boxBg = "#f8d7da"; boxBorder = "#f5c2c7"; textColor = "#842029";
                  statusText = "Blocked by technical error. Review needed.";
              } else if (!meta.isApproved && meta.contentNeedsReview) {
                  boxBg = "#fff3cd"; boxBorder = "#ffecb5"; textColor = "#664d03";
                  statusText = "Review needed to verify content explicitly before write can occur.";
              } else if (!meta.isApproved && meta.fieldStatus === "Proposed") {
                  boxBg = "#e2e3e5"; boxBorder = "#d3d6d8"; textColor = "#41464c";
                  statusText = "Safe suggestion. Approval optional but recorded if checked.";
              }

              let customLabel = meta.label;
              let thumbnailUrl = null;
              if (key.startsWith("native_image_alts_")) {
                  const id = key.replace("native_image_alts_", "");
                  customLabel = `Native Image Alt (${id.split('/').pop()})`;
                  thumbnailUrl = data.nativeTargets?.media?.edges?.find(e => e.node?.id === id)?.node?.preview?.image?.url;
              }

              let displayCurrentVal = meta.currentVal;
              if (typeof displayCurrentVal === 'string' && displayCurrentVal.startsWith('[')) {
                try {
                  const arr = JSON.parse(displayCurrentVal);
                  displayCurrentVal = Array.isArray(arr) ? arr[0] : displayCurrentVal;
                } catch(e) {}
              } else if (typeof displayCurrentVal === 'string' && displayCurrentVal.startsWith('{')) {
                try {
                  const obj = JSON.parse(displayCurrentVal);
                  displayCurrentVal = JSON.stringify(obj);
                } catch(e) {}
              } else if (Array.isArray(displayCurrentVal)) {
                displayCurrentVal = displayCurrentVal[0];
              } else if (typeof displayCurrentVal === 'object' && displayCurrentVal !== null) {
                displayCurrentVal = JSON.stringify(displayCurrentVal);
              }
              
              let displayPropVal = meta.propVal;
              if (typeof displayPropVal === 'string' && displayPropVal.startsWith('[')) {
                try {
                  const arr = JSON.parse(displayPropVal);
                  displayPropVal = Array.isArray(arr) ? arr[0] : displayPropVal;
                } catch(e) {}
              } else if (typeof displayPropVal === 'string' && displayPropVal.startsWith('{')) {
                try {
                  const obj = JSON.parse(displayPropVal);
                  displayPropVal = JSON.stringify(obj);
                } catch(e) {}
              } else if (Array.isArray(displayPropVal)) {
                displayPropVal = displayPropVal[0];
              } else if (typeof displayPropVal === 'object' && displayPropVal !== null) {
                displayPropVal = JSON.stringify(displayPropVal);
              }

              return (
                <Box key={key} padding="300" background={isBlank && meta.isSupported ? "bg-surface-warning" : "bg-surface"} borderColor="border" borderWidth="1" borderRadius="200">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", boxSizing: "border-box", minWidth: 0 }}>
                    
                    {/* Left Panel: Labels & Metadata */}
                    <div style={{ flex: "1 1 250px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                      <BlockStack gap="100">
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
                            {thumbnailUrl && (
                                <div style={{ width: "48px", height: "48px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, border: "1px solid #d2d5d8" }}>
                                    <img src={thumbnailUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                </div>
                            )}
                            <div style={{ wordBreak: "break-word", overflowWrap: "anywhere", minWidth: 0 }}>
                                <Text as="h4" variant="headingMd" fontWeight="bold">{customLabel}</Text>
                                <Text as="p" variant="bodySm" tone="subdued" fontWeight="medium">{key}</Text>
                            </div>
                        </div>
                        
                        <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px", wordBreak: "break-word", overflowWrap: "anywhere" }}>
                            {meta.isSupported ? (
                              <>
                                <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone={statusTone}>{meta.fieldStatus}</Badge></Text>
                                <Text as="p" variant="bodyMd" fontWeight="bold">Source: <Text as="span" fontWeight="regular">{meta.source}</Text></Text>
                                <Text as="p" variant="bodyMd" fontWeight="bold">Stage: <Text as="span" fontWeight="regular">{meta.stage}</Text></Text>
                              </>
                            ) : (
                              <Text as="p" variant="bodyMd" fontWeight="bold">Status: <Badge tone="info">Connection pending.</Badge></Text>
                            )}
                        </div>
                      </BlockStack>
                    </div>

                    {/* Right Panel: Current & Proposal Values */}
                    <div style={{ flex: "2 1 300px", display: "flex", flexDirection: "column", gap: "12px", minWidth: 0, maxWidth: "100%", boxSizing: "border-box" }}>
                        <div style={{ padding: "12px", backgroundColor: "#f4f6f8", borderRadius: "8px", border: "1px solid #d2d5d8", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", boxSizing: "border-box" }}>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Current Shopify Value</Text>
                            <div style={{ whiteSpace: "pre-wrap", minWidth: 0 }}>
                                <Text as="p" variant="bodyLg">{displayCurrentVal || <span style={{ color: "#8c9196", fontStyle: "italic" }}>Blank</span>}</Text>
                            </div>
                        </div>
                        
                        <div style={{ minWidth: 0, width: "100%", boxSizing: "border-box" }}>
                            <Text as="p" variant="headingSm" tone="subdued" fontWeight="bold" style={{ marginBottom: "6px" }}>Bench Proposal Value</Text>
                            <TextField
                                value={meta.isSupported ? displayPropVal : "Connection pending."}
                                onChange={(val) => { if (meta.isSupported) handleRepairPlanChange(key, val) }}
                                autoComplete="off"
                                multiline={isMultilineKey(key, meta.control) ? 3 : undefined}
                                placeholder={meta.fieldStatus === "Optional blank" || meta.fieldStatus === "Required missing" ? "Blank" : (meta.fieldStatus === "Proposal not provided" ? "Not provided" : "")}
                                disabled={!meta.isSupported}
                                readOnly={!meta.isSupported}
                            />
                        </div>

                        {/* Separate display block for Native Description Conflict specifically on generated_description card */}
                        {key === "custom.generated_description" && meta.nativeDescConflictData && (
                            <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: Native product descriptionHtml</Text>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", whiteSpace: "pre-wrap", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                                    <div><strong>Expected:</strong><br/>{meta.nativeDescConflictData.expected}</div>
                                    <div style={{ borderTop: "1px dashed #f5c2c7", paddingTop: "8px" }}><strong>Actual:</strong><br/>{meta.nativeDescConflictData.actual}</div>
                                </div>
                            </div>
                        )}

                        {/* Standard Metafield Conflict Display */}
                        {meta.conflictData && (
                            <div style={{ marginTop: "12px", backgroundColor: "#f8d7da", border: "1px solid #f5c2c7", borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                <Text as="p" variant="headingSm" tone="critical" fontWeight="bold" style={{ marginBottom: "6px" }}>Read-Back Mismatch: Field Value</Text>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", whiteSpace: "pre-wrap", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere", fontSize: "13px", color: "#842029" }}>
                                    <div><strong>Expected:</strong><br/>{meta.conflictData.expected}</div>
                                    <div style={{ borderTop: "1px dashed #f5c2c7", paddingTop: "8px" }}><strong>Actual:</strong><br/>{meta.conflictData.actual}</div>
                                </div>
                            </div>
                        )}

                        {canApprove && (
                            <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                    <input
                                        type="checkbox"
                                        id={`approve-${key}`}
                                        checked={meta.isApproved || false}
                                        onChange={(e) => handleToggleApproval(selectedBenchId, key, meta.propVal, e.target.checked)}
                                        style={{ width: "24px", height: "24px", flexShrink: 0, cursor: "pointer", accentColor: textColor, marginTop: "2px" }}
                                        aria-label={`Approve suggestion for ${customLabel}: ${meta.propVal}`}
                                    />
                                    <label htmlFor={`approve-${key}`} style={{ fontWeight: "bold", fontSize: "16px", cursor: "pointer", color: textColor, display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", flex: 1, minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                        Approve this suggestion: <span style={{ fontWeight: "normal", whiteSpace: "pre-wrap" }}>"{meta.propVal}"</span>
                                    </label>
                                </div>
                                <div style={{ marginTop: "8px", marginLeft: "36px", minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    <Text as="p" tone={(!meta.isApproved && meta.hasTechnicalBlock) || (meta.isApproved && meta.hasTechnicalBlock) ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor }}>
                                        {statusText}
                                    </Text>
                                </div>
                            </div>
                        )}

                        {isPreApprovedDisplay && (
                            <div style={{ marginTop: "12px", backgroundColor: boxBg, border: `1px solid ${boxBorder}`, borderRadius: "8px", padding: "12px", minWidth: 0, boxSizing: "border-box" }}>
                                <div style={{ minWidth: 0, wordBreak: "break-word", overflowWrap: "anywhere" }}>
                                    <Text as="p" fontWeight="bold" style={{ color: textColor }}>
                                        {meta.preApprovalReason}
                                    </Text>
                                    <Text as="p" tone={meta.hasTechnicalBlock ? "critical" : "subdued"} fontWeight="medium" style={{ color: textColor, marginTop: "4px" }}>
                                        {statusText}
                                    </Text>
                                </div>
                            </div>
                        )}

                        {/* APPROVAL DIAGNOSTIC BLOCK */}
                        {["custom.generated_description", "custom.origin_location", "custom.collection_name", "custom.collection_location"].includes(key) && (() => {
                            const blockReason = !meta.proposalExists ? "No proposal" : (meta.currentVal === meta.propVal) ? "Values match" : meta.isManualOnly ? "Manual only" : meta.isContentPreApproved ? "Pre-approved" : (meta.fieldStatus === "API Error / Blocked") ? "API Blocked" : (meta.fieldStatus === "Save Conflict") ? "Save Conflict" : "None";
                            return (
                                <div style={{ marginTop: "12px", backgroundColor: "#000", border: "2px solid #0f0", borderRadius: "4px", padding: "10px", color: "#0f0", fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", userSelect: "all" }}>
                                    <strong style={{fontSize:"13px", color:"#fff"}}>APPROVAL DIAGNOSTIC</strong><br/>
                                    Key: {key} | ID: {selectedBenchId}<br/>
                                    fieldStatus: {meta.fieldStatus}<br/>
                                    proposalExists: {String(meta.proposalExists)} | isDiff: {String(meta.currentVal !== meta.propVal)}<br/>
                                    isManualOnly: {String(meta.isManualOnly)} | isContentPreApproved: {String(meta.isContentPreApproved)} | isApproved: {String(meta.isApproved)}<br/>
                                    hasTechnicalBlock: {String(meta.hasTechnicalBlock)} | apiBlockReason: {String(meta.reasons.some(r => r.includes("Backend Blocked")))}<br/>
                                    conflictData: {String(!!meta.conflictData)} | nativeDescConflictData: {String(!!meta.nativeDescConflictData)}<br/>
                                    canApprove: {String(canApprove)} | Blocker: {blockReason}<br/>
                                    Chars: Current({meta.currentVal.length}) / Proposed({meta.propVal.length})
                                </div>
                            );
                        })()}

                    </div>
                  </div>
                </Box>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  const progressPercentage = queueIds.length > 0 ? Math.round(((isLoadingData ? loadIndex : executeIndex) / queueIds.length) * 100) : 0;
  const dynamicSections = manifestData[selectedBenchId] ? getDynamicSections(manifestData[selectedBenchId]) : getDynamicSections();

  const filterOptions = [
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

  return (
    <BlockStack gap="600">
      <BlockStack gap="200">
        <Text variant="headingXl" as="h1">Meta Injector</Text>
        <Text variant="headingMd" tone="subdued">Data Integrity & Operations Hub — Accessible Diagnostic View</Text>
      </BlockStack>

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: "24px", alignItems: "start", boxSizing: "border-box", maxWidth: "100%" }}>
        
        {/* LEFT COLUMN: 1. Select Raw Inventory */}
        <div>
          <Card padding="300">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2" fontWeight="bold">1. Select Raw Inventory ({queueIds.length})</Text>
              
              <TextField
                value={searchQuery}
                onChange={handleSearchChange}
                clearButton
                onClearButtonClick={handleClearSearch}
                autoComplete="off"
                placeholder="Search inventory..."
                disabled={isLoadingData || isExecuting}
              />

              <Button 
                size="large" 
                fullWidth 
                onClick={toggleSelectAllFiltered}
                disabled={isLoadingData || isExecuting}
              >
                {allFilteredSelected ? `Unload (${filteredProducts.length})` : `Load (${filteredProducts.length})`}
              </Button>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto", height: "70vh", paddingRight: "4px", minWidth: 0 }}>
                {filteredProducts.map(p => {
                  const isChecked = queueIds.includes(p.id);
                  const isSelectedForBench = selectedBenchId === p.id;
                  const currentStatus = productStates[p.id]?.status || STATUS.QUEUED;
                  const imageUrl = p.images?.edges?.[0]?.node?.url || p.featuredImage?.url || p.media?.edges?.[0]?.node?.image?.url;
                  
                  return (
                    <div 
                      key={p.id} 
                      onClick={() => handleToggleProductSelection(p.id)}
                      style={{ 
                        flexShrink: 0, 
                        border: isSelectedForBench ? "3px solid #005bd3" : "2px solid #c9cccf", 
                        borderRadius: "8px", 
                        backgroundColor: isChecked ? "#f0f2f4" : "#ffffff", 
                        cursor: isLoadingData || isExecuting ? "not-allowed" : "pointer", 
                        padding: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "12px",
                        minWidth: 0
                      }} 
                    >
                      <div style={{ display: "flex", gap: "12px", alignItems: "center", minWidth: 0 }}>
                        <div style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", borderRadius: "6px", overflow: "hidden", flexShrink: 0 }}>
                          {imageUrl && <img src={imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <Text as="p" variant="bodyLg" fontWeight="bold" truncate>{p.title.split(" — ").pop()}</Text>
                          <div style={{ marginTop: "4px" }}>
                            <Badge tone={getStatusTone(currentStatus)} size="medium">{currentStatus}</Badge>
                          </div>
                        </div>
                      </div>

                      <Button 
                        size="medium" 
                        fullWidth
                        variant={isSelectedForBench ? "primary" : "secondary"}
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (manifestData[p.id]) setSelectedBenchId(p.id);
                          else alert("Hit GENERATE REPAIR PLAN (Load Data) first to fetch this item's live data.");
                        }}
                      >
                        View Manifest on Bench
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        {/* RIGHT COLUMN: Repair Manifest Viewer */}
        <div style={{ minWidth: 0, width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
          <BlockStack gap="600">
            <Text variant="headingXl" as="h2">2. Repair Bench & Engine Diagnostics</Text>

            {safetyMessage && (
              <Banner tone="info" onDismiss={() => setSafetyMessage("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyMessage}</Text>
              </Banner>
            )}
            {safetyError && (
              <Banner tone="critical" onDismiss={() => setSafetyError("")}>
                <Text as="p" variant="bodyLg" fontWeight="medium">{safetyError}</Text>
              </Banner>
            )}

            <Card padding="400">
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h3">Repair Engine Orchestrator</Text>
                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", minWidth: 0 }}>
                    <Button 
                      size="large" 
                      variant="secondary" 
                      icon={MagicIcon} 
                      onClick={generateRepairPlan} 
                      disabled={isLoadingData || isExecuting}
                      loading={isLoadingData}
                    >
                      GENERATE REPAIR PLAN (LOAD DATA)
                    </Button>
                    
                    <Button 
                      size="large" 
                      variant="primary" 
                      tone="critical" 
                      onClick={executeRepairs} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "REPAIR"}
                    >
                      EXECUTE REPAIRS (LIVE)
                    </Button>

                    <Button 
                      size="large" 
                      variant="primary" 
                      icon={MagicIcon}
                      onClick={executeAIFill} 
                      disabled={Object.keys(manifestData).length === 0 || isLoadingData || isExecuting}
                      loading={isExecuting && executionMode === "AI_BATCH_PIPELINE"}
                    >
                      EXECUTE AI AUTO-FILL (STAGE)
                    </Button>
                  </div>
                </InlineStack>

                <Banner tone="warning">
                  <Text as="p" variant="bodyLg"><strong>Structural Repairs</strong> writes your edited Local Repair Plan to Shopify. <strong>AI Auto-Fill</strong> spins up Gemini to generate missing data and stages it below for you to review before writing.</Text>
                </Banner>

                {(isExecuting || isLoadingData) && queueIds.length > 0 && (
                  <Box padding="400" border="1px solid #E1E3E5" borderRadius="200" background="bg-surface-secondary">
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text as="p" variant="headingMd">{isLoadingData ? "Fetching Live Data..." : "Live Execution Progress"}</Text>
                        <Text as="p" variant="headingMd">{isLoadingData ? loadIndex : executeIndex} of {queueIds.length} Processed</Text>
                      </InlineStack>
                      <ProgressBar progress={progressPercentage} color="primary" size="large" />
                    </BlockStack>
                  </Box>
                )}

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "12px", minWidth: 0 }}>
                  <Button size="large" tone="critical" onClick={clearBench} disabled={isExecuting || isLoadingData}>Clear Rack & Reset Bench</Button>
                  
                  <Button size="large" icon={ClipboardIcon} onClick={() => handleCollectTelemetry('full')}>
                    Global Telemetry Dump
                  </Button>
                </div>
              </BlockStack>
            </Card>

            {!selectedBenchId || !manifestData[selectedBenchId] ? (
              <Box padding="800" background="bg-surface-secondary" borderRadius="200" borderColor="border" borderWidth="1">
                <Text as="p" variant="headingLg" alignment="center" tone="subdued">Load inventory, hit GENERATE REPAIR PLAN, then drop a piece on the bench to view its diagnostic readout.</Text>
              </Box>
            ) : (
              <BlockStack gap="600">
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f0fdf4", padding: "16px", borderRadius: "8px", border: "2px solid #22c55e", gap: "16px", minWidth: 0, boxSizing: "border-box" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <Text as="h3" variant="headingLg" fontWeight="bold" style={{ color: "#166534" }}>
                            <span style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}>GID Lock: {selectedBenchId}</span>
                        </Text>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", minWidth: 0 }}>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={MagicIcon} 
                        onClick={handleExecuteSingleAI}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                      >
                        Run AI (Single)
                      </Button>
                      <Button 
                        size="large" 
                        variant="primary" 
                        icon={SaveIcon} 
                        onClick={handleExecuteSingleRepair}
                        loading={batchFetcher.state !== "idle" && !isExecuting}
                        tone="success"
                      >
                        Execute Single Repair
                      </Button>
                    </div>
                </div>

                {renderDiagnosticHeader()}

                <Card padding="400">
                    <InlineStack align="space-between" blockAlign="center">
                        <Text variant="headingLg" as="h3">Review Board Controls</Text>
                        <Select
                            label="Filter Fields"
                            labelInline
                            options={filterOptions}
                            onChange={(val) => setActiveFilter(val)}
                            value={activeFilter}
                        />
                    </InlineStack>
                </Card>

                {dynamicSections.map(sec => renderManifestTable(sec))}
                
              </BlockStack>
            )}
          </BlockStack>
        </div>
      </div>
    </BlockStack>
  );
}

export default OperationsMatrixTab;
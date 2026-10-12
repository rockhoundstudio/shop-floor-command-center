import React, { useState, useCallback, useEffect } from "react";
import { BlockStack, Card, Text, Banner, TextField, Button, InlineStack, Box, Badge, ProgressBar, Select, Collapsible, Checkbox, Icon, Divider, Scrollable } from "@shopify/polaris";
import { MagicIcon, ClipboardIcon, SaveIcon, ChevronDownIcon, ChevronUpIcon, AlertTriangleIcon } from "@shopify/polaris-icons";
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

    // REMOVE description keys from standard sections to prevent duplicates
    keys = keys.filter(k => k !== "native_description" && k !== "custom.generated_description");

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
    "Description Review": true,
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
                if (["intent", "success", "error", "errors", "logs", "debug_origin", "generated_description"].includes(factKey)) return;
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
         
         setPendingOperation(null);
         setLoadIndex(i => i + 1);
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
           
           if (Object.keys(blockedFields).length > 0) {
               successLogs.push(`Blocked fields: ${Object.keys(blockedFields).join(', ')}`);
           }
           
           if (intent !== "batchAuditItem") {
               updateProductState(targetId, statusToSet, successLogs);
           }
        }
        
        if (intent !== "batchAuditItem") {
            setPendingOperation(null);
            if (executionMode === "AI_SINGLE_PIPELINE") {
                setAiStep(5);
            } else {
                setExecuteIndex(i => i + 1);
            }
        }
      }

      if ((intent === "titleParse" || intent === "tab3FullRescan" || intent === "generateDescription") && targetId) {
          if (!success) {
              setSafetyError(`AI Engine halted on ${targetId}. Stage: ${intent}. Error: ${error || message}`);
              updateProductState(targetId, STATUS.FAILED, [error || message]);
              setPendingOperation(null);
              if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
              else setExecuteIndex(i => i + 1);
              return;
          }

          setAiData(prev => {
              const current = prev[targetId] || {};
              const next = { ...current };
              if (intent === "titleParse") next.titleParse = titleParse || {};
              if (intent === "tab3FullRescan") next.tab3Data = tab3Data || {};
              if (intent === "generateDescription") next.generated_description = generated_description || "";
              return { ...prev, [targetId]: next };
          });

          setManifestData(prev => {
              const existing = prev[targetId];
              if (!existing) return prev;
              const nextRepairPlan = { ...existing.repairPlan };
              
              if (intent === "titleParse" && titleParse) {
                  Object.entries(titleParse).forEach(([k, v]) => {
                      if (v !== undefined && v !== null && String(v).trim() !== "") {
                          const fullKey = k.startsWith("custom.") ? k : `custom.${k}`;
                          nextRepairPlan[fullKey] = String(v);
                      }
                  });
              }
              if (intent === "tab3FullRescan" && tab3Data) {
                  Object.entries(tab3Data).forEach(([k, v]) => {
                      if (v !== undefined && v !== null && String(v).trim() !== "") {
                          const fullKey = k.startsWith("custom.") ? k : `custom.${k}`;
                          nextRepairPlan[fullKey] = String(v);
                      }
                  });
              }
              if (intent === "generateDescription" && generated_description) {
                  nextRepairPlan["custom.generated_description"] = generated_description;
              }

              return {
                  ...prev,
                  [targetId]: {
                      ...existing,
                      repairPlan: nextRepairPlan,
                      diagnostics: { ...existing.diagnostics, gemini: "Success" }
                  }
              };
          });

          setPendingOperation(null);
          
          if (executionMode === "AI_SINGLE_PIPELINE" || executionMode === "AI_BATCH_PIPELINE") {
              if (intent === "titleParse") setAiStep(2);
              else if (intent === "tab3FullRescan") setAiStep(3);
              else if (intent === "generateDescription") {
                  updateProductState(targetId, STATUS.VALIDATED, ["AI Processing Complete. Staged for review."]);
                  if (executionMode === "AI_SINGLE_PIPELINE") setAiStep(5);
                  else {
                      setAiStep(1);
                      setExecuteIndex(i => i + 1);
                  }
              }
          }
      }
    }
  }, [batchFetcher.data, batchFetcher.state, lastProcessedData, pendingOperation, executionMode, isLoadingData]);

  // Reporting Helper for Telemetry constraint
  const getTelemetryReport = (manifest, currentId, dynamicSections) => {
      const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);
      const report = [];

      dynamicSections.forEach(section => {
          section.keys.forEach(key => {
              if (HIDDEN_CONTEXT_FIELDS.includes(key)) return;
              const meta = getFieldMetadata(key, manifest, currentId, approvals, allConfigFields);
              
              if (meta.currentVal !== meta.propVal || meta.isBlockedAction) {
                  report.push({
                      section: section.title,
                      key: key,
                      status: meta.fieldStatus,
                      reason: meta.reasons.join(', ') || 'N/A',
                      approvalState: meta.isApproved ? 'Approved' : 'Pending',
                      currentCount: meta.currentVal.length,
                      proposedCount: meta.propVal.length
                  });
              }
          });
      });

      // Specifically capture the description review without HTML payload
      const descMeta = getFieldMetadata("native_description", manifest, currentId, approvals, allConfigFields);
      if (descMeta.currentVal !== descMeta.propVal || descMeta.isBlockedAction) {
          report.push({
              section: "Description Review",
              key: "native_description",
              status: descMeta.fieldStatus,
              reason: descMeta.reasons.join(', ') || 'N/A',
              approvalState: descMeta.isApproved ? 'Approved' : 'Pending',
              currentCount: descMeta.currentVal.length,
              proposedCount: descMeta.propVal.length
          });
      }

      return report;
  };

  const renderFieldRow = (manifest, currentId, key, allConfigFields) => {
      const meta = getFieldMetadata(key, manifest, currentId, approvals, allConfigFields);
      if (!meta.isSupported) return null;

      const isEdited = manualEdits[currentId]?.[key];
      const targetKeyForProposal = NATIVE_ALIAS_MAP[key] || key;

      return (
          <Box paddingBlockStart="200" paddingBlockEnd="200" key={key}>
              <InlineStack align="space-between" blockAlign="center">
                  <Box width="25%">
                      <Text variant="bodyMd" fontWeight="bold">{meta.label || key}</Text>
                      {meta.isBlockedAction && <Badge tone="warning">{meta.fieldStatus}</Badge>}
                  </Box>
                  <Box width="30%">
                      <Text variant="bodySm" color="subdued">Current: {meta.currentVal || 'Empty'}</Text>
                  </Box>
                  <Box width="40%">
                      <TextField 
                          value={isEdited ? manifest.repairPlan[targetKeyForProposal] : meta.propVal}
                          onChange={(val) => {
                              setManifestData(prev => {
                                  const existing = prev[currentId];
                                  return {
                                      ...prev,
                                      [currentId]: {
                                          ...existing,
                                          repairPlan: {
                                              ...existing.repairPlan,
                                              [targetKeyForProposal]: val
                                          }
                                      }
                                  };
                              });
                              setManualEdits(prev => {
                                  const n = {...prev};
                                  if (!n[currentId]) n[currentId] = {};
                                  n[currentId][key] = true;
                                  return n;
                              });
                          }}
                          disabled={meta.isManualOnly}
                          multiline={meta.control === "multiline" ? 3 : false}
                          autoComplete="off"
                      />
                  </Box>
                  <Box width="5%">
                      <Checkbox 
                          checked={meta.isApproved} 
                          onChange={(checked) => handleToggleApproval(currentId, key, meta.propVal, checked)} 
                      />
                  </Box>
              </InlineStack>
          </Box>
      );
  };

  return (
    <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
            <Text variant="headingLg" as="h2">Matrix Tab 3 - Repair & Execution</Text>
            <InlineStack gap="300">
                <Button onClick={generateRepairPlan} loading={isLoadingData} variant="primary">Generate Repair Plan</Button>
                <Button onClick={executeRepairs} disabled={isExecuting || isLoadingData} icon={SaveIcon}>Execute Repairs</Button>
                <Button onClick={executeAIFill} disabled={isExecuting || isLoadingData} icon={MagicIcon}>Batch AI Fill</Button>
                <Button onClick={clearBench} destructive>Clear Bench</Button>
            </InlineStack>
        </InlineStack>

        {safetyMessage && <Banner tone="info">{safetyMessage}</Banner>}
        {safetyError && <Banner tone="critical">{safetyError}</Banner>}

        <InlineStack gap="500" wrap={false}>
            {/* Left Column: Selection */}
            <Box width="300px">
                <Card>
                    <BlockStack gap="300">
                        <TextField 
                            label="Filter Products"
                            value={searchQuery}
                            onChange={handleSearchChange}
                            clearButton
                            onClearButtonClick={handleClearSearch}
                            autoComplete="off"
                        />
                        <Button onClick={toggleSelectAllFiltered} size="slim">
                            {allFilteredSelected ? "Deselect All Filtered" : "Select All Filtered"}
                        </Button>
                        <Scrollable style={{height: '60vh'}}>
                            <BlockStack gap="200">
                                {filteredProducts.map(p => {
                                    const isSelected = queueIds.includes(p.id);
                                    const state = productStates[p.id]?.status || STATUS.QUEUED;
                                    return (
                                        <Card key={p.id} background={isSelected ? "bg-surface-active" : "bg-surface"}>
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Checkbox checked={isSelected} onChange={() => handleToggleProductSelection(p.id)} />
                                                <Box flex="1"><Text truncate>{p.title}</Text></Box>
                                                <Badge tone={state === STATUS.COMPLETE ? "success" : state === STATUS.FAILED ? "critical" : "info"}>{state}</Badge>
                                            </InlineStack>
                                        </Card>
                                    );
                                })}
                            </BlockStack>
                        </Scrollable>
                    </BlockStack>
                </Card>
            </Box>

            {/* Right Column: Execution View */}
            <Box flex="1">
                <Scrollable style={{height: '75vh'}}>
                    <BlockStack gap="400">
                        {queueIds.map(id => {
                            const manifest = manifestData[id];
                            if (!manifest) return null;
                            const dynamicSections = getDynamicSections(manifest);
                            const allConfigFields = dynamicSections.flatMap(sec => sec.configFields || []);

                            // Specifically pull description metadata for the isolated view
                            const descMeta = getFieldMetadata("native_description", manifest, id, approvals, allConfigFields);
                            const isDescEdited = manualEdits[id]?.["native_description"];

                            return (
                                <Card key={id}>
                                    <BlockStack gap="400">
                                        <Text variant="headingMd" as="h3">{safeProducts.find(p => p.id === id)?.title}</Text>
                                        
                                        {/* EXPLICIT ISOLATED DESCRIPTION REVIEW SECTION */}
                                        <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                                            <InlineStack align="space-between" blockAlign="center">
                                                <Text variant="headingSm">Description Review</Text>
                                                <Button 
                                                    plain 
                                                    icon={expandedBays["Description Review"] ? ChevronUpIcon : ChevronDownIcon}
                                                    onClick={() => setExpandedBays(prev => ({...prev, "Description Review": !prev["Description Review"]}))}
                                                />
                                            </InlineStack>
                                            <Collapsible open={expandedBays["Description Review"]} id={`desc-review-${id}`}>
                                                <Box paddingBlockStart="300">
                                                    <BlockStack gap="300">
                                                        <InlineStack align="space-between" blockAlign="center">
                                                            <Badge tone={descMeta.isBlockedAction ? "warning" : "success"}>
                                                                Status: {descMeta.fieldStatus}
                                                            </Badge>
                                                            <Text variant="bodySm">Current chars: {descMeta.currentVal.length} | Proposed chars: {descMeta.propVal.length}</Text>
                                                            <Checkbox 
                                                                label="Approve Proposal"
                                                                checked={descMeta.isApproved} 
                                                                onChange={(checked) => handleToggleApproval(id, "native_description", descMeta.propVal, checked)} 
                                                            />
                                                        </InlineStack>
                                                        
                                                        {descMeta.reasons.length > 0 && (
                                                            <Banner tone="warning" title="Diagnostics">
                                                                <BlockStack gap="100">
                                                                    {descMeta.reasons.map((r, i) => <Text key={i} variant="bodySm">{r}</Text>)}
                                                                </BlockStack>
                                                            </Banner>
                                                        )}

                                                        <InlineStack gap="400" align="start">
                                                            <Box width="48%">
                                                                <Text variant="headingSm" as="h4">Current Native Baseline</Text>
                                                                <Box padding="200" background="bg-surface" borderRadius="100" style={{maxHeight: '200px', overflowY: 'auto'}}>
                                                                    <Text variant="bodySm" as="span"><div dangerouslySetInnerHTML={{__html: descMeta.currentVal || '<i>No current description</i>'}} /></Text>
                                                                </Box>
                                                            </Box>
                                                            <Box width="48%">
                                                                <Text variant="headingSm" as="h4">Editable Proposal (custom.generated_description)</Text>
                                                                <TextField 
                                                                    value={isDescEdited ? manifest.repairPlan["custom.generated_description"] : descMeta.propVal}
                                                                    onChange={(val) => {
                                                                        setManifestData(prev => {
                                                                            const existing = prev[id];
                                                                            return {
                                                                                ...prev,
                                                                                [id]: {
                                                                                    ...existing,
                                                                                    repairPlan: {
                                                                                        ...existing.repairPlan,
                                                                                        ["custom.generated_description"]: val
                                                                                    }
                                                                                }
                                                                            };
                                                                        });
                                                                        setManualEdits(prev => {
                                                                            const n = {...prev};
                                                                            if (!n[id]) n[id] = {};
                                                                            n[id]["native_description"] = true;
                                                                            return n;
                                                                        });
                                                                    }}
                                                                    disabled={descMeta.isManualOnly}
                                                                    multiline={8}
                                                                    autoComplete="off"
                                                                />
                                                            </Box>
                                                        </InlineStack>
                                                    </BlockStack>
                                                </Box>
                                            </Collapsible>
                                        </Box>
                                        
                                        <Divider />

                                        {/* DYNAMIC SECTIONS WITH DESCRIPTION FILTERED OUT */}
                                        {dynamicSections.map(section => (
                                            <Box key={section.title}>
                                                <InlineStack align="space-between" blockAlign="center">
                                                    <Text variant="headingSm">{section.title}</Text>
                                                    <Button 
                                                        plain 
                                                        icon={expandedBays[section.title] ? ChevronUpIcon : ChevronDownIcon}
                                                        onClick={() => setExpandedBays(prev => ({...prev, [section.title]: !prev[section.title]}))}
                                                    />
                                                </InlineStack>
                                                <Collapsible open={expandedBays[section.title]} id={`col-${id}-${section.title}`}>
                                                    <Box paddingBlockStart="200">
                                                        <BlockStack gap="200">
                                                            {section.keys.map(key => renderFieldRow(manifest, id, key, allConfigFields))}
                                                        </BlockStack>
                                                    </Box>
                                                </Collapsible>
                                                <Divider />
                                            </Box>
                                        ))}

                                    </BlockStack>
                                </Card>
                            );
                        })}
                    </BlockStack>
                </Scrollable>
            </Box>
        </InlineStack>
    </BlockStack>
  );
}
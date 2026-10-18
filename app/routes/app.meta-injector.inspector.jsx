import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, DropZone, Badge } from "@shopify/polaris";
import { MagicIcon, SaveIcon, ClipboardIcon } from "@shopify/polaris-icons";
import {
  DEV_SHOW_ALL_TEMPLATE_FIELDS,
  DROPDOWN_OPTIONS,
  FULL_META_GROUPS,
  getFieldStatus,
  ROCKHOUND_FIELDS,
  PRODUCT_TEMPLATE_GROUPS,
  computeTemplateAuditCounts
} from "../utils/meta-injector.constants.jsx";
import { evaluateFieldMetadata, buildRepairPayload, resolveConfigFieldDestination } from "../utils/meta-injector.matrix-domain.jsx";
import { useFetcher } from "react-router";

const CUSTOM_FIELDS = [
  { key: "shopify_title", label: "MASTER SHOPIFY TITLE (Edit Here)", type: "single_line_text_field", isShared: false },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field", isShared: true },
  { key: "surface_finish", label: "Surface Finish", type: "single_line_text_field", isShared: true }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field", isShared: true },
  { key: "primary_use", label: "Primary Use", type: "single_line_text_field", isShared: true }, 
  { key: "origin_story", label: "The Origin Story", type: "multi_line_text_field", multiline: true, isShared: true },
  { key: "stone_story", label: "Stone Story", type: "list.single_line_text_field", multiline: true, isShared: true },
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "official_name", label: "Official Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_type", label: "Cut Type", type: "single_line_text_field", isPerPiece: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "number_decimal", isPerPiece: true },
  { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "number_decimal", isPerPiece: true },
  { key: "honest_flaws_and_character", label: "Honest Flaws & Character", type: "multi_line_text_field", multiline: true, isPerPiece: true },
  { key: "character_marks", label: "Character Marks", type: "list.single_line_text_field", multiline: true, isPerPiece: true },
  { key: "price", label: "Price", type: "single_line_text_field", isPerPiece: true },
  { key: "generated_description", label: "Generated Description", type: "multi_line_text_field", multiline: true, isPerPiece: true }
];

const NAMESPACE_MAP = {
  custom: [
    "official_name", "stone_story", "cut_type", "cut_and_shape", "stone_shape", "surface_finish",
    "treatment_status", "color", "primary_color", "secondary_colors",
    "rock_composition", "character_marks", "dimensions_mm", "mohs_hardness",
    "specific_gravity", "crystal_system", "luster", "cleavage", "fracture_pattern",
    "diaphaneity", "tenacity", "origin_story", "stone_family", "piece_name",
    "origin_handle", "origin_page_handle", "origin_location", "shopify_title",
    "collection_name", "collection_location", "collection_date", "seo_title", "authenticity",
    "rarity", "secondary_medium", "jewelry_type", "necklace_design",
    "jewelry_finding_type", "wire_material", "color_pattern", "material", "generated_description",
    "primary_medium", "setting_ready",
    "bail_included", "chain_material", "geological_era",
    "mineral_class", "rock_formation", "geological_age", "treated", "is_ooak", "is_one_of_a_kind",
    "age_group", "target_gender", "condition", "google_product_category",
    "alt_text", "weight_grams", "shipping_weight_oz", "price",
    "rescued_by", "honest_flaws_and_character",
    "custom_product", "found_object", "chain_link_type",
    "overall_solid_length_in", "whole_product_weight_grams",
    "chain_cord_length_in", "accessory_dimensions_mm", "fitting_opening_mm"
  ]
};

const RETIRED_TAB2_KEYS = new Set([
  "artist_notes", "bench_notes", "handcrafted_by", "primary_use"
]);

const PROTECTED_MANUAL_STORY_TITLES = [
  "the creek find",
  "the violet hour",
  "the statement"
];

const EMPTY_DEV_PREVIEW_MANIFEST = Object.freeze({
  currentMetafields: {},
  nativeTargets: null,
  repairPlan: {},
  metadata: {},
  verifiedGeoValues: {}
});

const isExactProductGid = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/Product\/[0-9]+$/.test(val.trim());

const isExactMediaImageGid = (val) =>
  typeof val === "string" && /^gid:\/\/shopify\/MediaImage\/[0-9]+$/.test(val.trim());

const formatCompactDiagPreview = (val, maxLen = 110) => {
  if (val === undefined || val === null) return "Not recorded";
  const str = String(val);
  if (str.trim() === "") return "Blank";
  const singleLine = str.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen)}… (${str.length} chars)`;
};

const isManualStoryProtectedPiece = (title, pieceName) => {
  const combined = `${title || ""} ${pieceName || ""}`.toLowerCase();
  return PROTECTED_MANUAL_STORY_TITLES.some(protectedName => combined.includes(protectedName));
};

const extractLegacyPieceNameIfSegmented = (rawTitle) => {
  if (typeof rawTitle !== "string") return "";
  const trimmed = rawTitle.trim();
  if (!trimmed) return "";
  const segments = trimmed.split(/\s+[—–-]\s+/);
  if (segments.length >= 3) {
    return segments[segments.length - 1].trim();
  }
  return "";
};

export function IntakeBenchTab({ products, injectFetcher, tab2Fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const [liveProductManifest, setLiveProductManifest] = useState(null);
  const originalMetaRef = useRef({});
  const fullMetaStateRef = useRef({});
  const editedKeysRef = useRef(new Set());
  const keySourcesRef = useRef({});
  const lastProcessedAiData = useRef(null);
  const lastProcessedInjectData = useRef(null);
  const lastProcessedLoadData = useRef(null);
  const lastAutofilledTitle = useRef("");
  
  const [statusMessage, setStatusMessage] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [tab2StatusMessage, setTab2StatusMessage] = useState("");
  const [tab2ErrorMessage, setTab2ErrorMessage] = useState("");
  const [pendingFixFields, setPendingFixFields] = useState([]);
  const [currentFixIndex, setCurrentFixIndex] = useState(0);
  const [fixPopupValue, setFixPopupValue] = useState("");
  const [showFixPopup, setShowFixPopup] = useState(false);
  const [overridePhoto, setOverridePhoto] = useState(null);
  const [productStatus, setProductStatus] = useState("DRAFT");
  
  const statusFetcher = useFetcher();
  const productLoadFetcher = useFetcher();

  const safeProducts = products || [];
  const selectedProductObj = isExactProductGid(selectedProductId)
    ? (safeProducts.find(p => p.id === selectedProductId) || null)
    : null;
  const hasValidSelectedProductContext = Boolean(selectedProductObj && isExactProductGid(selectedProductId));
  const isDevUnselectedPreview = Boolean(DEV_SHOW_ALL_TEMPLATE_FIELDS && !hasValidSelectedProductContext);

  const selectedProductContextRef = useRef({
    id: "",
    isValid: false
  });
  selectedProductContextRef.current = {
    id: selectedProductId,
    isValid: hasValidSelectedProductContext
  };

  const allTemplateFields = PRODUCT_TEMPLATE_GROUPS.flatMap(g => g.fields || []);

  const recordKeySource = useCallback((key, sourceLabel, stageLabel) => {
    if (!key) return;
    const entry = {
      source: sourceLabel || "Not recorded",
      stage: stageLabel || "Not recorded"
    };
    keySourcesRef.current[key] = entry;
    const bare = key.replace(/^custom\./, "");
    keySourcesRef.current[bare] = entry;
    if (!key.includes(".") && NAMESPACE_MAP.custom.includes(bare)) {
      keySourcesRef.current[`custom.${bare}`] = entry;
    }
    if (key === "shopify_title" || key === "native_title") {
      keySourcesRef.current.shopify_title = entry;
      keySourcesRef.current.native_title = entry;
    }
    if (key === "generated_description" || key === "native_description") {
      keySourcesRef.current.generated_description = entry;
      keySourcesRef.current.native_description = entry;
      keySourcesRef.current["custom.generated_description"] = entry;
    }
    if (key === "seo_title" || key === "native_seo_title") {
      keySourcesRef.current.seo_title = entry;
      keySourcesRef.current.native_seo_title = entry;
      keySourcesRef.current["custom.seo_title"] = entry;
    }
    if (key === "shipping_weight_oz" || key === "native_shipping_weight") {
      keySourcesRef.current.shipping_weight_oz = entry;
      keySourcesRef.current.native_shipping_weight = entry;
      keySourcesRef.current["custom.shipping_weight_oz"] = entry;
    }
    if (key === "price" || key === "native_price") {
      keySourcesRef.current.price = entry;
      keySourcesRef.current.native_price = entry;
    }
    if (key === "is_ooak" || key === "is_one_of_a_kind") {
      keySourcesRef.current.is_ooak = entry;
      keySourcesRef.current.is_one_of_a_kind = entry;
      keySourcesRef.current["custom.is_one_of_a_kind"] = entry;
    }
    if (key === "stone_family" || key === "primary_medium" || key === "material") {
      keySourcesRef.current.material = entry;
      keySourcesRef.current["custom.material"] = entry;
    }
    if (key === "origin_handle" || key === "origin_page_handle") {
      keySourcesRef.current.origin_page_handle = entry;
      keySourcesRef.current["custom.origin_page_handle"] = entry;
    }
    if (key === "cut_type" || key === "cut_and_shape") {
      keySourcesRef.current.cut_and_shape = entry;
      keySourcesRef.current["custom.cut_and_shape"] = entry;
    }
  }, []);

  useEffect(() => {
    if (tab2Fetcher && tab2Fetcher.data) {
      lastProcessedAiData.current = tab2Fetcher.data;
    }
  }, [selectedProductId, tab2Fetcher]);

  const handleDropOverridePhoto = useCallback((_dropFiles, acceptedFiles) => {
    if (!selectedProductContextRef.current.isValid) return;
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result.replace("data:", "").replace(/^.+,/, "");
        setOverridePhoto({
          base64: base64String,
          mimeType: file.type,
          previewUrl: URL.createObjectURL(file)
        });
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSelectProduct = useCallback((id) => {
    if (!isExactProductGid(id)) return;
    const product = (products || []).find(p => p.id === id);
    if (!product) return;

    setSelectedProductId(id);
    setStatusMessage("");
    setWarningMessage("");
    setErrorMessage("");
    setTab2StatusMessage("");
    setTab2ErrorMessage("");
    setOverridePhoto(null);
    setLiveProductManifest(null);
    
    setFormState({});
    setFullMetaState({});
    fullMetaStateRef.current = {};
    originalMetaRef.current = {};
    editedKeysRef.current = new Set();
    keySourcesRef.current = {};
    setPendingFixFields([]);
    setCurrentFixIndex(0);
    setShowFixPopup(false);
    setFixPopupValue("");
    lastProcessedAiData.current = null;
    lastAutofilledTitle.current = "";

    setProductStatus(product.status || "DRAFT");
    
    const newForm = {};
    const newFullForm = {};
    
    if (product.title) {
      newForm.shopify_title = product.title;
      newFullForm.shopify_title = product.title;
      newForm.native_title = product.title;
      newFullForm.native_title = product.title;
      recordKeySource("native_title", "Shopify", "Product Loader Snapshot");
    }

    if (typeof product.descriptionHtml === "string") {
      newForm.native_description = product.descriptionHtml;
      newFullForm.native_description = product.descriptionHtml;
      if (product.descriptionHtml.trim() !== "") {
        recordKeySource("native_description", "Shopify", "Product Loader Snapshot");
      }
      if (!newFullForm.generated_description) {
        newForm.generated_description = product.descriptionHtml;
        newFullForm.generated_description = product.descriptionHtml;
      }
    }

    const allEdges = [
      ...(product?.customMeta?.edges || []),
      ...(product?.rockhoundMeta?.edges || []),
      ...(product?.geoMeta?.edges || []),
      ...(product?.metafields?.edges || [])
    ];
    
    if (allEdges.length > 0) {
      allEdges.forEach(({ node }) => {
        const hasValue = node && node.value !== null && node.value !== undefined;
        if (!hasValue) return;

        if (node.namespace === "custom" || node.namespace === "geo" || node.namespace === "rockhound") {
          if (RETIRED_TAB2_KEYS.has(node.key)) {
            return;
          }

          let parsedValue = String(node.value);
          if (parsedValue.includes("gid://")) parsedValue = "See Shopify metaobject";
          if (parsedValue.startsWith("[")) {
            try {
              const arr = JSON.parse(parsedValue);
              parsedValue = Array.isArray(arr) ? arr[0] : parsedValue;
            } catch (e) { }
          }
          
          const booleanKeys = ["is_ooak", "is_one_of_a_kind", "found_object", "custom_product", "treated"];
          if (booleanKeys.includes(node.key) && parsedValue !== "See Shopify metaobject") {
            const lowerVal = parsedValue.toLowerCase().trim();
            if (lowerVal === "true" || lowerVal === "yes" || lowerVal.startsWith("yes —") || lowerVal.startsWith("yes -")) parsedValue = "Yes";
            else if (lowerVal === "false" || lowerVal === "no") parsedValue = "No";
          }

          newForm[node.key] = parsedValue;
          newFullForm[node.key] = parsedValue;
          if (String(parsedValue).trim() !== "") {
            recordKeySource(`custom.${node.key}`, "Shopify", "Product Loader Snapshot");
          }
        } else if (node.namespace === "google" || node.namespace === "mm-google-shopping" || node.namespace === "shopify") {
          const qualifiedKey = `${node.namespace}.${node.key}`;
          newForm[qualifiedKey] = String(node.value);
          newFullForm[qualifiedKey] = String(node.value);
          if (String(node.value).trim() !== "") {
            recordKeySource(qualifiedKey, "Shopify", "Product Loader Snapshot");
          }
        }
      });
    }

    const CAMEL_TO_SNAKE = { 
      crystalSystem: "crystal_system", 
      geologicalEra: "geological_era", 
      mineralClass: "mineral_class", 
      rockComposition: "rock_composition", 
      rockFormation: "rock_formation", 
      geologicalAge: "geological_age", 
      fracture: "fracture_pattern" 
    };
    
    Object.entries(CAMEL_TO_SNAKE).forEach(([camel, snake]) => {
      if (newFullForm[camel] !== undefined) { 
        if (!newFullForm[snake]) {
          newFullForm[snake] = newFullForm[camel];
          recordKeySource(`custom.${snake}`, "Shopify", "Product Loader Snapshot");
        }
        delete newFullForm[camel]; 
      }
      if (newForm[camel] !== undefined) { 
        if (!newForm[snake]) newForm[snake] = newForm[camel]; 
        delete newForm[camel]; 
      }
    });

    // Safe legacy read companions without automatic overwrite of populated canonical values
    if (!newFullForm.is_one_of_a_kind && newFullForm.is_ooak) {
      newFullForm.is_one_of_a_kind = newFullForm.is_ooak;
      newForm.is_one_of_a_kind = newFullForm.is_ooak;
      recordKeySource("custom.is_one_of_a_kind", "Shopify (Companion custom.is_ooak)", "Product Loader Snapshot");
    }
    if (!newFullForm.material && (newFullForm.stone_family || newFullForm.primary_medium)) {
      const fallbackMat = newFullForm.stone_family || newFullForm.primary_medium;
      newFullForm.material = fallbackMat;
      newForm.material = fallbackMat;
      recordKeySource("custom.material", "Shopify (Companion stone_family/primary_medium)", "Product Loader Snapshot");
    }
    if (!newFullForm.origin_page_handle && newFullForm.origin_handle) {
      newFullForm.origin_page_handle = newFullForm.origin_handle;
      newForm.origin_page_handle = newFullForm.origin_handle;
      recordKeySource("custom.origin_page_handle", "Shopify (Companion custom.origin_handle)", "Product Loader Snapshot");
    }
    if (!newFullForm.cut_and_shape && newFullForm.cut_type) {
      newFullForm.cut_and_shape = newFullForm.cut_type;
      newForm.cut_and_shape = newFullForm.cut_type;
      recordKeySource("custom.cut_and_shape", "Shopify (Companion custom.cut_type)", "Product Loader Snapshot");
    }

    // Read actual variant shipping weight in OUNCES when present; never derive shipping weight from stone-only weight_grams
    const vNode = product?.variants?.edges?.[0]?.node;
    const wMeasurement = vNode?.inventoryItem?.measurement?.weight;
    const rawVariantWeightVal = wMeasurement?.value ?? vNode?.weight;
    const rawVariantWeightUnit = wMeasurement?.unit ?? vNode?.weightUnit;

    if (!newFullForm.shipping_weight_oz && rawVariantWeightVal !== undefined && rawVariantWeightVal !== null && Number(rawVariantWeightVal) > 0 && (!rawVariantWeightUnit || rawVariantWeightUnit === "OUNCES")) {
      const ozStr = String(rawVariantWeightVal);
      newFullForm.shipping_weight_oz = ozStr;
      newForm.shipping_weight_oz = ozStr;
      newFullForm.native_shipping_weight = ozStr;
      newForm.native_shipping_weight = ozStr;
      recordKeySource("native_shipping_weight", "Shopify", "Product Loader Snapshot");
    } else if (newFullForm.shipping_weight_oz) {
      newFullForm.native_shipping_weight = newFullForm.shipping_weight_oz;
      newForm.native_shipping_weight = newFullForm.shipping_weight_oz;
    }

    if (newForm.origin_story && newForm.origin_story.startsWith("[")) {
      try { 
        const arr = JSON.parse(newForm.origin_story); 
        newForm.origin_story = Array.isArray(arr) ? arr[0] : newForm.origin_story; 
      } catch (e) {}
    }
    newFullForm.origin_story = newForm.origin_story;

    if (newForm.stone_story && newForm.stone_story.startsWith("[")) {
      try { 
        const arr = JSON.parse(newForm.stone_story); 
        newForm.stone_story = Array.isArray(arr) ? arr[0] : newForm.stone_story; 
      } catch (e) {}
    }
    newFullForm.stone_story = newForm.stone_story;

    if (newForm.honest_flaws_and_character && newForm.honest_flaws_and_character.startsWith("[")) {
      try { 
        const arr = JSON.parse(newForm.honest_flaws_and_character); 
        newForm.honest_flaws_and_character = Array.isArray(arr) ? arr[0] : newForm.honest_flaws_and_character; 
      } catch (e) { }
    }
    newFullForm.honest_flaws_and_character = newForm.honest_flaws_and_character;

    const customPM = allEdges.find(e => e.node.key === "primary_medium")?.node?.value;
    let bestPM = customPM || newForm.base_stone_type || "";
    if (bestPM === "Stone") bestPM = ""; 
    
    newFullForm.primary_medium = bestPM;

    // Preserve stored piece_name; only extract from 3-part title if no stored piece_name exists
    const storedPieceName = newFullForm.piece_name ? String(newFullForm.piece_name).trim() : "";
    if (storedPieceName) {
      newForm.piece_name = storedPieceName;
      newFullForm.piece_name = storedPieceName;
    } else if (product && product.title) {
      const legacyExtracted = extractLegacyPieceNameIfSegmented(product.title);
      if (legacyExtracted) {
        newForm.piece_name = legacyExtracted;
        newFullForm.piece_name = legacyExtracted;
        recordKeySource("custom.piece_name", "Derived (Legacy 3-Segment Title)", "Product Selection");
      }
    }

    if (vNode && vNode.price) {
      newForm.price = vNode.price; 
      newFullForm.price = vNode.price; 
      newForm.native_price = vNode.price;
      newFullForm.native_price = vNode.price;
      recordKeySource("native_price", "Shopify", "Product Loader Snapshot");
    }

    const seoTitleNode = allEdges.find(e => e.node.key === "seo_title" || e.node.key === "title_tag")?.node;
    if (seoTitleNode && seoTitleNode.value) {
      newFullForm.seo_title = seoTitleNode.value;
      newFullForm.native_seo_title = seoTitleNode.value;
      recordKeySource("native_seo_title", "Shopify", "Product Loader Snapshot");
    }
    
    setFormState(newForm);
    setFullMetaState(newFullForm);
    fullMetaStateRef.current = newFullForm;
    originalMetaRef.current = { ...newFullForm };

    // Load live product manifest from backend when a user explicitly selects a product
    const fd = new FormData();
    fd.append("intent", "loadProductData");
    fd.append("pieceId", id);
    productLoadFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [products, productLoadFetcher, recordKeySource]);

  useEffect(() => {
    if (
      productLoadFetcher.state === "idle" &&
      productLoadFetcher.data &&
      productLoadFetcher.data !== lastProcessedLoadData.current
    ) {
      lastProcessedLoadData.current = productLoadFetcher.data;
      const lData = productLoadFetcher.data;
      if (lData.intent === "loadProductData" && lData.success && lData.productId === selectedProductId) {
        setLiveProductManifest(lData);

        const seoDesc = lData.nativeTargets?.seo?.description ?? lData.seo?.description ?? "";
        const seoTitle = lData.nativeTargets?.seo?.title ?? lData.seo?.title ?? "";
        const liveDescHtml = lData.nativeTargets?.descriptionHtml ?? "";
        const vEdge = lData.nativeTargets?.variants?.edges?.[0]?.node;
        const wObj = vEdge?.inventoryItem?.measurement?.weight;
        const liveShipOz =
          wObj && wObj.value !== undefined && wObj.value !== null && Number(wObj.value) > 0 && wObj.unit === "OUNCES"
            ? String(wObj.value)
            : "";

        const liveMediaEdges = Array.isArray(lData.nativeTargets?.media?.edges)
          ? lData.nativeTargets.media.edges
          : [];

        setFullMetaState(prev => {
          const next = { ...prev };
          const liveMfs = lData.currentMetafields || {};

          Object.entries(liveMfs).forEach(([qualifiedKey, mfVal]) => {
            if (mfVal === undefined || mfVal === null || String(mfVal).trim() === "") return;
            const strVal = String(mfVal);
            if (!next[qualifiedKey]) {
              next[qualifiedKey] = strVal;
              originalMetaRef.current[qualifiedKey] = strVal;
              recordKeySource(qualifiedKey, "Shopify", "loadProductData");
            }
            if (qualifiedKey.startsWith("custom.")) {
              const bare = qualifiedKey.slice(7);
              if (!RETIRED_TAB2_KEYS.has(bare) && !editedKeysRef.current.has(bare) && (next[bare] === undefined || next[bare] === "")) {
                next[bare] = strVal;
                originalMetaRef.current[bare] = strVal;
                recordKeySource(qualifiedKey, "Shopify", "loadProductData");
              }
            }
          });

          liveMediaEdges.forEach(({ node }) => {
            if (!node?.id || !isExactMediaImageGid(node.id)) return;
            const mediaAltKey = `native_image_alts_${node.id}`;
            if (typeof node.alt === "string" && node.alt.trim() !== "") {
              originalMetaRef.current[mediaAltKey] = node.alt;
              if (!editedKeysRef.current.has(mediaAltKey) && (next[mediaAltKey] === undefined || next[mediaAltKey] === "")) {
                next[mediaAltKey] = node.alt;
                recordKeySource(mediaAltKey, "Shopify", "loadProductData");
              }
            }
          });

          if (!next.cut_and_shape && next.cut_type) {
            next.cut_and_shape = next.cut_type;
            originalMetaRef.current.cut_and_shape = next.cut_type;
            recordKeySource("custom.cut_and_shape", "Shopify (Companion custom.cut_type)", "loadProductData");
          }

          if (!editedKeysRef.current.has("native_seo_description") && seoDesc) {
            next.native_seo_description = seoDesc;
            originalMetaRef.current.native_seo_description = seoDesc;
            recordKeySource("native_seo_description", "Shopify", "loadProductData");
          }
          if (!editedKeysRef.current.has("seo_title") && !next.seo_title && seoTitle) {
            next.seo_title = seoTitle;
            next.native_seo_title = seoTitle;
            originalMetaRef.current.seo_title = seoTitle;
            originalMetaRef.current.native_seo_title = seoTitle;
            recordKeySource("native_seo_title", "Shopify", "loadProductData");
          }
          if (!editedKeysRef.current.has("generated_description") && !editedKeysRef.current.has("native_description") && !next.generated_description && liveDescHtml) {
            next.generated_description = liveDescHtml;
            next.native_description = liveDescHtml;
            originalMetaRef.current.generated_description = liveDescHtml;
            originalMetaRef.current.native_description = liveDescHtml;
            recordKeySource("native_description", "Shopify", "loadProductData");
          }
          if (!editedKeysRef.current.has("shipping_weight_oz") && !next.shipping_weight_oz && liveShipOz) {
            next.shipping_weight_oz = liveShipOz;
            next.native_shipping_weight = liveShipOz;
            originalMetaRef.current.shipping_weight_oz = liveShipOz;
            originalMetaRef.current.native_shipping_weight = liveShipOz;
            recordKeySource("native_shipping_weight", "Shopify", "loadProductData");
          }
          fullMetaStateRef.current = next;
          return next;
        });
      }
    }
  }, [productLoadFetcher.state, productLoadFetcher.data, selectedProductId, recordKeySource]);

  const markKeyEdited = useCallback((key, sourceLabel = "Manual", stageLabel = "Tab2Review") => {
    if (!key || key === "native_image_alt") return;
    editedKeysRef.current.add(key);
    recordKeySource(key, sourceLabel, stageLabel);
    if (key === "shopify_title" || key === "native_title") {
      editedKeysRef.current.add("shopify_title");
      editedKeysRef.current.add("native_title");
    }
    if (key === "generated_description" || key === "native_description") {
      editedKeysRef.current.add("generated_description");
      editedKeysRef.current.add("native_description");
    }
    if (key === "seo_title" || key === "native_seo_title") {
      editedKeysRef.current.add("seo_title");
      editedKeysRef.current.add("native_seo_title");
    }
    if (key === "shipping_weight_oz" || key === "native_shipping_weight") {
      editedKeysRef.current.add("shipping_weight_oz");
      editedKeysRef.current.add("native_shipping_weight");
    }
    if (key === "price" || key === "native_price") {
      editedKeysRef.current.add("price");
      editedKeysRef.current.add("native_price");
    }
    if (key === "is_ooak" || key === "is_one_of_a_kind") {
      editedKeysRef.current.add("is_one_of_a_kind");
    }
    if (key === "stone_family" || key === "primary_medium" || key === "material") {
      editedKeysRef.current.add("material");
    }
    if (key === "origin_handle" || key === "origin_page_handle") {
      editedKeysRef.current.add("origin_page_handle");
    }
  }, [recordKeySource]);

  const handleTitleBlur = useCallback((value) => {
    if (!selectedProductContextRef.current.isValid) return;
    if (!value) return;
    const segments = value.split(/\s+[-—–]\s+/);
    if (segments.length >= 3 && value !== lastAutofilledTitle.current) {
      lastAutofilledTitle.current = value;
      const formData = new FormData();
      formData.append("intent", "titleParse");
      formData.append("pieceName", value);
      tab2Fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
    }
  }, [tab2Fetcher]);

  const updateWeightFields = useCallback((key, value) => {
    if (!selectedProductContextRef.current.isValid) return;
    markKeyEdited(key, "Manual", "Tab2Review");
    // Stone-only weight (weight_grams) must never populate or overwrite shipping_weight_oz
    const companionUpdates = {};
    if (key === "shipping_weight_oz" || key === "native_shipping_weight") {
      companionUpdates.shipping_weight_oz = value;
      companionUpdates.native_shipping_weight = value;
    } else {
      companionUpdates[key] = value;
    }

    setFormState(prev => ({ ...prev, ...companionUpdates }));
    setFullMetaState(prev => ({ ...prev, ...companionUpdates }));
    fullMetaStateRef.current = { ...fullMetaStateRef.current, ...companionUpdates };
  }, [markKeyEdited]);

  const updateFullMetaState = useCallback((key, value) => {
    if (!selectedProductContextRef.current.isValid) return;
    if (!key || key === "native_image_alt") return;
    if (key.startsWith("native_image_alts_")) {
      const mediaId = key.replace("native_image_alts_", "");
      if (!isExactMediaImageGid(mediaId)) return;
    }
    if (key === "weight_grams" || key === "shipping_weight_oz" || key === "native_shipping_weight") {
      updateWeightFields(key, value);
      return;
    }
    markKeyEdited(key, "Manual", "Tab2Review");

    const updates = { [key]: value };
    if (key === "shopify_title" || key === "native_title") {
      updates.shopify_title = value;
      updates.native_title = value;
    } else if (key === "generated_description" || key === "native_description") {
      updates.generated_description = value;
      updates.native_description = value;
    } else if (key === "seo_title" || key === "native_seo_title") {
      updates.seo_title = value;
      updates.native_seo_title = value;
    } else if (key === "price" || key === "native_price") {
      updates.price = value;
      updates.native_price = value;
    } else if (key === "is_ooak" || key === "is_one_of_a_kind") {
      updates.is_one_of_a_kind = value;
      updates.is_ooak = value;
    } else if (key === "origin_handle" || key === "origin_page_handle") {
      updates.origin_page_handle = value;
      updates.origin_handle = value;
    } else if (key === "stone_family" || key === "material") {
      updates.material = value;
      updates.stone_family = value;
    }

    setFullMetaState(prev => ({ ...prev, ...updates }));
    setFormState(prev => ({ ...prev, ...updates }));
    fullMetaStateRef.current = { ...fullMetaStateRef.current, ...updates };
  }, [updateWeightFields, markKeyEdited]);

  const handleTab2AutoFill = useCallback(() => {
    if (!selectedProductContextRef.current.isValid || !isExactProductGid(selectedProductId)) return;
    const product = (products || []).find(p => p.id === selectedProductId);
    if (!product) return;

    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.material || fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_page_handle || fullMetaState.origin_handle || "";
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const formData = new FormData();
    formData.append("intent", "tab2AutoFill");
    formData.append("productId", selectedProductId);
    formData.append("stone_family", stoneFamily);
    formData.append("origin_handle", originHandle);
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);
    formData.append("origin_story", fullMetaState.origin_story || formState.origin_story || "");

    if (overridePhoto) {
      formData.append("imageBase64", overridePhoto.base64);
      formData.append("imageMimeType", overridePhoto.mimeType);
    } else {
      formData.append("imageUrl", imageUrl);
    }

    tab2Fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
  }, [selectedProductId, tab2Fetcher, fullMetaState, products, formState, overridePhoto]);

  const handleFullRescan = useCallback(() => {
    if (!selectedProductContextRef.current.isValid || !isExactProductGid(selectedProductId)) return;
    const product = (products || []).find(p => p.id === selectedProductId);
    if (!product) return;

    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.material || fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_page_handle || fullMetaState.origin_handle || "";
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const RESCAN_PRESERVE_KEYS = [
      "shopify_title", "native_title",
      "origin_handle", "origin_page_handle", "origin_location", "collection_name", "collection_location", "collection_date",
      "stone_family", "surface_finish", "source_location",
      "color", "cut_and_shape", "stone_shape", "cut_type",
      "piece_name", "dimensions_mm",
      "weight_grams", "shipping_weight_oz", "native_shipping_weight", "price", "native_price",
      "overall_solid_length_in", "whole_product_weight_grams", "chain_cord_length_in", "accessory_dimensions_mm", "fitting_opening_mm",
      "character_marks", "honest_flaws_and_character", "primary_medium",
      "secondary_medium", "treatment_status", "is_ooak", "is_one_of_a_kind", "treated",
      "material", "rescued_by", "alt_text",
      "found_object", "bail_included", "setting_ready",
      "jewelry_type", "necklace_design", "jewelry_finding_type", "wire_material",
      "chain_material", "chain_link_type", "target_gender",
      "origin_story", "stone_story", "custom_product",
      "google.age_group", "google.condition", "google.target_gender", "mm-google-shopping.custom_product"
    ];

    const preserveSnapshot = (prev) => {
      const next = {};
      RESCAN_PRESERVE_KEYS.forEach(k => {
        if (prev[k] !== undefined && prev[k] !== "") {
          next[k] = prev[k];
        }
      });
      editedKeysRef.current.forEach(k => {
        if (prev[k] !== undefined && prev[k] !== "") {
          next[k] = prev[k];
        }
      });
      Object.keys(prev).forEach(k => {
        if (k.startsWith("native_image_alts_") && prev[k] !== undefined && prev[k] !== "") {
          next[k] = prev[k];
        }
      });
      if (isManualStoryProtectedPiece(titleToUse, prev.piece_name)) {
        if (prev.generated_description) next.generated_description = prev.generated_description;
        if (prev.native_description) next.native_description = prev.native_description;
      }
      return next;
    };
    
    setFullMetaState(prev => {
      const preserved = preserveSnapshot(prev);
      fullMetaStateRef.current = preserved;
      return preserved;
    });
    setFormState(prev => preserveSnapshot(prev));

    const formData = new FormData();
    formData.append("intent", "fullRescan");
    formData.append("productId", selectedProductId);
    formData.append("stone_family", stoneFamily);
    formData.append("origin_handle", originHandle);
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);
    formData.append("honest_flaws_and_character", fullMetaState.honest_flaws_and_character || formState.honest_flaws_and_character || "");
    formData.append("price", fullMetaState.price || "");
    formData.append("origin_story", fullMetaState.origin_story || formState.origin_story || "");

    if (overridePhoto) {
      formData.append("imageBase64", overridePhoto.base64);
      formData.append("imageMimeType", overridePhoto.mimeType);
    } else {
      formData.append("imageUrl", imageUrl);
    }

    tab2Fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
  }, [selectedProductId, tab2Fetcher, fullMetaState, products, formState, overridePhoto]);

  const handleCopyTelemetry = useCallback(() => {
    if (!selectedProductContextRef.current.isValid) return;
    navigator.clipboard.writeText(JSON.stringify(fullMetaState, null, 2))
      .then(() => {
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Telemetry data copied to clipboard!");
        }
      })
      .catch(err => console.error("Failed to copy telemetry:", err));
  }, [fullMetaState]);

  const handleToggleStatus = useCallback(() => {
    if (!selectedProductContextRef.current.isValid || !isExactProductGid(selectedProductId)) return;
    const newStatus = productStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";
    
    const formData = new FormData();
    formData.append("intent", "toggleStatus");
    formData.append("pieceId", selectedProductId);
    formData.append("newStatus", newStatus);
    
    setProductStatus(newStatus);
    
    statusFetcher.submit(formData, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedProductId, productStatus, statusFetcher]);
  
  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data) {
      if (statusFetcher.data.success) {
        setProductStatus(statusFetcher.data.newStatus);
        if (window.shopify?.toast) {
          window.shopify.toast.show(`Status successfully updated to ${statusFetcher.data.newStatus}`);
        }
      } else {
        setProductStatus(productStatus === "ACTIVE" ? "DRAFT" : "ACTIVE"); 
        setErrorMessage(statusFetcher.data.error || "Failed to toggle status");
        if (window.shopify?.toast) {
          window.shopify.toast.show("Failed to update status", { isError: true });
        }
      }
    }
  }, [statusFetcher.state, statusFetcher.data]);

  const handleInject = useCallback(() => {
    if (!selectedProductContextRef.current.isValid || !isExactProductGid(selectedProductId)) return;
    setStatusMessage("");
    setWarningMessage("");
    setErrorMessage("");

    const selectedProduct = (products || []).find(p => p.id === selectedProductId);
    if (!selectedProduct) {
      setErrorMessage("Selected product not found in inventory. Reselect the product and try again.");
      return;
    }

    const currentState = fullMetaStateRef.current || {};
    const baselineState = originalMetaRef.current || {};

    // Build baseline currentMetafields from live manifest if loaded, else from product edges
    const currentMetafields = { ...(liveProductManifest?.currentMetafields || {}) };
    if (Object.keys(currentMetafields).length === 0) {
      const allEdges = [
        ...(selectedProduct?.customMeta?.edges || []),
        ...(selectedProduct?.rockhoundMeta?.edges || []),
        ...(selectedProduct?.geoMeta?.edges || []),
        ...(selectedProduct?.metafields?.edges || [])
      ];
      allEdges.forEach(({ node }) => {
        if (node && node.namespace && node.key && node.value !== undefined && node.value !== null) {
          currentMetafields[`${node.namespace}.${node.key}`] = String(node.value);
        }
      });
    }

    // Build baseline nativeTargets from live manifest if loaded, else from product object (never fabricate Variant GIDs)
    const fallbackVariantsEdges = (selectedProduct.variants?.edges || [])
      .filter(e => e?.node?.id && /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/.test(String(e.node.id)))
      .map((e) => {
        const vNode = e.node;
        const wObj = vNode.inventoryItem?.measurement?.weight;
        return {
          node: {
            id: vNode.id,
            title: vNode.title || "Default Title",
            price: vNode.price ?? "",
            inventoryItem: {
              measurement: {
                weight: wObj || (vNode.weight !== undefined ? { value: vNode.weight, unit: vNode.weightUnit || "OUNCES" } : null)
              }
            }
          }
        };
      });

    const hasValidFallbackVariantId =
      fallbackVariantsEdges.length === 1 &&
      /^gid:\/\/shopify\/ProductVariant\/[0-9]+$/.test(fallbackVariantsEdges[0]?.node?.id || "");

    const nativeTargets = liveProductManifest?.nativeTargets || {
      productId: selectedProduct.id,
      productTitle: selectedProduct.title || "",
      descriptionHtml: typeof selectedProduct.descriptionHtml === "string" ? selectedProduct.descriptionHtml : "",
      seo: {
        title: baselineState.seo_title || "",
        description: baselineState.native_seo_description || ""
      },
      isComplete: hasValidFallbackVariantId,
      loadError: null,
      variants: {
        edges: fallbackVariantsEdges,
        pageInfo: { hasNextPage: false, endCursor: null }
      },
      media: {
        edges: [],
        pageInfo: { hasNextPage: false, endCursor: null }
      }
    };

    const repairPlan = {};
    const metadata = {};
    const approvalsForProduct = {};

    const stageProposalIfIntended = (canonicalKey, rawProposedValue, baselineCompareValue) => {
      if (!canonicalKey || canonicalKey === "native_image_alt") return;
      if (rawProposedValue === undefined || rawProposedValue === null) return;
      const cleanVal = String(rawProposedValue).trim();
      if (!cleanVal || cleanVal === "See Shopify metaobject") return;
      if (canonicalKey === "custom.collection_date" && /^(n\/a|none|unknown)$/i.test(cleanVal)) return;

      const baseStr = baselineCompareValue !== undefined && baselineCompareValue !== null ? String(baselineCompareValue).trim() : "";
      const bareKey = canonicalKey.replace(/^custom\./, "");
      const wasExplicitlyEditedOrFilled =
        editedKeysRef.current.has(canonicalKey) ||
        editedKeysRef.current.has(bareKey) ||
        cleanVal !== baseStr;

      if (!wasExplicitlyEditedOrFilled) return;

      const recordedMeta = keySourcesRef.current[canonicalKey] || keySourcesRef.current[bareKey] || null;
      repairPlan[canonicalKey] = cleanVal;
      metadata[canonicalKey] = {
        source: recordedMeta?.source || "Manual",
        stage: recordedMeta?.stage || "Tab2Review"
      };
      approvalsForProduct[canonicalKey] = cleanVal;
    };

    // 1. Native Title (only when changed from baseline productTitle)
    const proposedTitle = String(currentState.shopify_title ?? currentState.native_title ?? "").trim();
    const baselineTitle = String(nativeTargets.productTitle ?? selectedProduct.title ?? "").trim();
    if (proposedTitle && (editedKeysRef.current.has("shopify_title") || editedKeysRef.current.has("native_title")) && proposedTitle !== baselineTitle) {
      repairPlan["shopify_title"] = proposedTitle;
      repairPlan["native_title"] = proposedTitle;
      metadata["shopify_title"] = { source: "Manual", stage: "Tab2Review" };
      metadata["native_title"] = { source: "Manual", stage: "Tab2Review" };
      approvalsForProduct["shopify_title"] = proposedTitle;
      approvalsForProduct["native_title"] = proposedTitle;
    }

    // 2. Price (only when changed from baseline variant price)
    const proposedPrice = String(currentState.price ?? currentState.native_price ?? "").trim();
    const baselinePrice = String(nativeTargets.variants?.edges?.[0]?.node?.price ?? baselineState.price ?? "").trim();
    if (proposedPrice && (editedKeysRef.current.has("price") || editedKeysRef.current.has("native_price")) && proposedPrice !== baselinePrice) {
      repairPlan["price"] = proposedPrice;
      repairPlan["native_price"] = proposedPrice;
      metadata["price"] = { source: "Manual", stage: "Tab2Review" };
      metadata["native_price"] = { source: "Manual", stage: "Tab2Review" };
      approvalsForProduct["price"] = proposedPrice;
      approvalsForProduct["native_price"] = proposedPrice;
    }

    // 3. Shipping weight (only when explicitly entered/edited by operator; never derived from weight_grams)
    const proposedShipOz = String(currentState.shipping_weight_oz ?? currentState.native_shipping_weight ?? "")
      .replace(/\s*OUNCES$/i, "")
      .trim();
    const baselineShipOz = String(baselineState.shipping_weight_oz ?? "").replace(/\s*OUNCES$/i, "").trim();
    if (
      proposedShipOz &&
      (editedKeysRef.current.has("shipping_weight_oz") || editedKeysRef.current.has("native_shipping_weight")) &&
      proposedShipOz !== baselineShipOz
    ) {
      repairPlan["native_shipping_weight"] = proposedShipOz;
      repairPlan["custom.shipping_weight_oz"] = proposedShipOz;
      metadata["native_shipping_weight"] = { source: "Manual", stage: "Tab2Review" };
      metadata["custom.shipping_weight_oz"] = { source: "Manual", stage: "Tab2Review" };
      approvalsForProduct["native_shipping_weight"] = proposedShipOz;
      approvalsForProduct["custom.shipping_weight_oz"] = proposedShipOz;
    }

    // 4. Native SEO Description
    const proposedSeoDesc = String(currentState.native_seo_description ?? "").trim();
    const baselineSeoDesc = String(nativeTargets.seo?.description ?? baselineState.native_seo_description ?? "").trim();
    if (proposedSeoDesc && (editedKeysRef.current.has("native_seo_description") || proposedSeoDesc !== baselineSeoDesc)) {
      const seoMeta = keySourcesRef.current["native_seo_description"];
      repairPlan["native_seo_description"] = proposedSeoDesc;
      metadata["native_seo_description"] = {
        source: seoMeta?.source || "Manual",
        stage: seoMeta?.stage || "Tab2Review"
      };
      approvalsForProduct["native_seo_description"] = proposedSeoDesc;
    }

    // 5. Piece Name (preserve operator-entered value; only fallback to 3-part title extraction if piece_name is blank and no stored piece_name exists)
    const currentPieceName = String(currentState.piece_name ?? "").trim();
    const storedPieceName = String(currentMetafields["custom.piece_name"] ?? "").trim();
    const effectivePieceName =
      currentPieceName ||
      (!storedPieceName ? extractLegacyPieceNameIfSegmented(proposedTitle || baselineTitle) : "");
    if (effectivePieceName) {
      stageProposalIfIntended("custom.piece_name", effectivePieceName, storedPieceName);
    }

    // 6. Canonical OOAK, Material, Origin Page Handle, and Cut & Shape
    const effectiveOoak = currentState.is_one_of_a_kind ?? currentState.is_ooak;
    if (effectiveOoak !== undefined) {
      stageProposalIfIntended(
        "custom.is_one_of_a_kind",
        effectiveOoak,
        currentMetafields["custom.is_one_of_a_kind"] ?? currentMetafields["custom.is_ooak"] ?? baselineState.is_one_of_a_kind
      );
    }

    const effectiveMaterial = currentState.material || currentState.stone_family || currentState.primary_medium;
    if (effectiveMaterial !== undefined) {
      stageProposalIfIntended(
        "custom.material",
        effectiveMaterial,
        currentMetafields["custom.material"] ?? currentMetafields["custom.stone_family"] ?? baselineState.material
      );
    }

    const effectiveOriginPageHandle = currentState.origin_page_handle || currentState.origin_handle;
    if (effectiveOriginPageHandle !== undefined) {
      stageProposalIfIntended(
        "custom.origin_page_handle",
        effectiveOriginPageHandle,
        currentMetafields["custom.origin_page_handle"] ?? currentMetafields["custom.origin_handle"] ?? baselineState.origin_page_handle
      );
    }

    if (currentState.cut_and_shape !== undefined && (editedKeysRef.current.has("cut_and_shape") || editedKeysRef.current.has("custom.cut_and_shape") || String(currentState.cut_and_shape).trim() !== String(baselineState.cut_and_shape ?? "").trim())) {
      stageProposalIfIntended(
        "custom.cut_and_shape",
        currentState.cut_and_shape,
        currentMetafields["custom.cut_and_shape"] ?? currentMetafields["custom.cut_type"] ?? baselineState.cut_and_shape
      );
    }

    // 7. Remaining supported custom fields
    const SKIP_DIRECT_LOOP_KEYS = new Set([
      "shopify_title", "native_title",
      "price", "native_price",
      "shipping_weight_oz", "native_shipping_weight",
      "native_seo_description",
      "piece_name",
      "is_ooak", "is_one_of_a_kind",
      "stone_family", "primary_medium", "material",
      "origin_handle", "origin_page_handle",
      "cut_type", "cut_and_shape",
      "origin_story", "stone_story", "custom_product",
      "native_image_alt"
    ]);

    Object.entries(currentState).forEach(([rawKey, rawVal]) => {
      const bareKey = rawKey.replace(/^custom\./, "");
      if (SKIP_DIRECT_LOOP_KEYS.has(bareKey) || SKIP_DIRECT_LOOP_KEYS.has(rawKey)) return;
      if (RETIRED_TAB2_KEYS.has(bareKey) || RETIRED_TAB2_KEYS.has(rawKey)) return;
      if (rawKey.startsWith("std_") || rawKey.startsWith("shopify.") || rawKey.startsWith("native_") || rawKey.startsWith("google.") || rawKey.startsWith("mm-google-shopping.")) return;
      if (!NAMESPACE_MAP.custom.includes(bareKey)) return;

      const canonicalKey = `custom.${bareKey}`;
      stageProposalIfIntended(canonicalKey, rawVal, currentMetafields[canonicalKey] ?? baselineState[bareKey]);

      if (bareKey === "generated_description" && repairPlan["custom.generated_description"] !== undefined) {
        approvalsForProduct["native_description"] = repairPlan["custom.generated_description"];
      }
      if (bareKey === "seo_title" && repairPlan["custom.seo_title"] !== undefined) {
        approvalsForProduct["native_seo_title"] = repairPlan["custom.seo_title"];
      }
    });

    // Preserve native_image_alt media repairs ONLY for valid exact MediaImage GIDs present in live manifest (never placeholder)
    if (liveProductManifest?.nativeTargets?.media?.edges) {
      liveProductManifest.nativeTargets.media.edges.forEach(({ node }) => {
        if (!node?.id || !isExactMediaImageGid(node.id)) return;
        const mediaAltKey = `native_image_alts_${node.id}`;
        if (currentState[mediaAltKey] !== undefined && editedKeysRef.current.has(mediaAltKey)) {
          const cleanAlt = String(currentState[mediaAltKey]).trim();
          if (cleanAlt && cleanAlt !== String(node.alt ?? "").trim()) {
            const mediaMeta = keySourcesRef.current[mediaAltKey];
            repairPlan[mediaAltKey] = cleanAlt;
            metadata[mediaAltKey] = {
              source: mediaMeta?.source || "Manual",
              stage: mediaMeta?.stage || "Tab2Review"
            };
            approvalsForProduct[mediaAltKey] = cleanAlt;
          }
        }
      });
    }

    const manifestForBuild = {
      ...(liveProductManifest || {}),
      currentMetafields,
      nativeTargets,
      repairPlan,
      metadata,
      verifiedGeoValues: {}
    };

    const approvalsMap = { [selectedProductId]: approvalsForProduct };

    const getFieldMetaWrapper = (key, data, prodId, currApprovals, cfgFields) =>
      evaluateFieldMetadata({
        key,
        data,
        productId: prodId,
        currentApprovals: currApprovals,
        configFields: cfgFields,
        standardizedCandidatesByProduct: {},
        getStandardizedEvaluationForField: null
      });

    const { safePlan, nativeChanges } = buildRepairPayload(
      manifestForBuild,
      selectedProduct,
      selectedProductId,
      approvalsMap,
      getFieldMetaWrapper
    );

    const hasSafePlanChanges = Object.keys(safePlan).length > 0;
    const hasNativeChanges = Object.keys(nativeChanges).length > 0;

    if (!hasSafePlanChanges && !hasNativeChanges) {
      if (
        (editedKeysRef.current.has("shipping_weight_oz") || editedKeysRef.current.has("native_shipping_weight") ||
         editedKeysRef.current.has("price") || editedKeysRef.current.has("native_price")) &&
        !nativeTargets.isComplete
      ) {
        setErrorMessage("Save blocked: Variant details are still loading or product has multiple variants. Wait a moment for live product data to finish loading and click Inject Metafields again.");
        return;
      }
      if (editedKeysRef.current.has("origin_story") && editedKeysRef.current.size === 1) {
        setWarningMessage("Origin Story is a read-only source-context draft used to inform AI description generation; direct metafield persistence for custom.origin_story is held by domain policy. Edit Native Description or another supported canonical field before clicking Inject Metafields.");
        return;
      }
      setWarningMessage("No modified or new fields to save. Edit a supported canonical field or run Auto-Fill before clicking Inject Metafields.");
      return;
    }

    const fd = new FormData();
    fd.append("intent", "executeRepairPlan");
    fd.append("pieceId", selectedProductId);
    fd.append("repairPlan", JSON.stringify(safePlan));
    fd.append("nativeChanges", JSON.stringify(nativeChanges));
    fd.append("legacyKeysToRemove", JSON.stringify([]));

    injectFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [selectedProductId, products, liveProductManifest, injectFetcher]);

  // Handle actual executeRepairPlan and other injectFetcher responses with Red / Yellow / Green banners
  useEffect(() => {
    if (
      injectFetcher.state === "idle" &&
      injectFetcher.data &&
      injectFetcher.data !== lastProcessedInjectData.current
    ) {
      lastProcessedInjectData.current = injectFetcher.data;
      const res = injectFetcher.data;

      if (res.intent === "cleanGhostNamespaces" || res.intent === "cleanAllGhostNamespaces") {
        if (!res.success) {
          setErrorMessage(res.error || res.message || `Operation "${res.intent}" failed. Use Tab 3 (Operations Matrix) for verified repairs.`);
        }
        return;
      }

      if (res.intent === "executeRepairPlan" || res.intent === "saveMetafields" || res.intent === "saveProduct") {
        const verifiedList = Array.isArray(res.verifiedDestinations) ? res.verifiedDestinations : [];
        const blockedObj = res.blockedFields && typeof res.blockedFields === "object" ? res.blockedFields : {};
        const unresolvedObj = res.unresolvedChanges && typeof res.unresolvedChanges === "object" ? res.unresolvedChanges : {};
        const unsupportedList = Array.isArray(res.unsupportedKeys) ? res.unsupportedKeys : [];
        const errList = Array.isArray(res.errors) ? res.errors : [];

        const blockedDetails = Object.entries(blockedObj).map(([k, v]) => `${k}: ${v}`).join(" | ");
        const unresolvedDetails = Object.entries(unresolvedObj).map(([k, v]) => `${k} (${v?.reason || "unresolved"})`).join(" | ");
        const apiErrorDetails = errList.map(e => (typeof e === "string" ? e : e?.message || "")).filter(Boolean).join(" | ");

        if (res.status === "NO_CHANGES_REQUIRED") {
          setWarningMessage("No changes were written because all submitted values already match live Shopify data.");
          setStatusMessage("");
          setErrorMessage("");
          return;
        }

        const hasVerifiedConfirmation =
          res.intent === "executeRepairPlan" &&
          res.readBackVerified === true &&
          res.success === true &&
          res.status === "REPAIRED" &&
          verifiedList.length > 0 &&
          Object.keys(blockedObj).length === 0 &&
          Object.keys(unresolvedObj).length === 0 &&
          unsupportedList.length === 0;

        if (hasVerifiedConfirmation) {
          setStatusMessage(`Verified & saved ${verifiedList.length} destination(s) to Shopify: ${verifiedList.join(", ")}.`);
          setWarningMessage("");
          setErrorMessage("");
          if (res.currentMetafields || res.nativeTargets) {
            setLiveProductManifest(prev => ({
              ...(prev || {}),
              currentMetafields: res.currentMetafields || prev?.currentMetafields || {},
              nativeTargets: res.nativeTargets || prev?.nativeTargets
            }));
          }
          originalMetaRef.current = { ...fullMetaStateRef.current };
          editedKeysRef.current = new Set();
          if (window.shopify?.toast) {
            window.shopify.toast.show(`Verified & saved ${verifiedList.length} destination(s)`);
          }
          return;
        }

        if (res.status === "PARTIAL_SUCCESS" || (verifiedList.length > 0 && (Object.keys(blockedObj).length > 0 || Object.keys(unresolvedObj).length > 0 || unsupportedList.length > 0))) {
          const detailParts = [];
          if (verifiedList.length > 0) detailParts.push(`Verified (${verifiedList.length}): ${verifiedList.join(", ")}`);
          if (blockedDetails) detailParts.push(`Blocked: ${blockedDetails}`);
          if (unresolvedDetails) detailParts.push(`Unresolved: ${unresolvedDetails}`);
          if (unsupportedList.length > 0) detailParts.push(`Unsupported: ${unsupportedList.join(", ")}`);
          setWarningMessage(`Partial or unresolved save — ${detailParts.join(" — ")}. Review the flagged fields and click Inject Metafields again.`);
          setStatusMessage("");
          setErrorMessage("");
          return;
        }

        // Red failure state with plain-English next action
        const reasonText =
          blockedDetails ||
          unresolvedDetails ||
          apiErrorDetails ||
          res.error ||
          res.message ||
          "Backend returned no verified save confirmation.";
        setErrorMessage(`Save failed: ${reasonText} Next action: Check the flagged field values (or wait for live product data to finish loading) and click Inject Metafields again.`);
        setStatusMessage("");
        setWarningMessage("");
      }
    }
  }, [injectFetcher.state, injectFetcher.data]);

  useEffect(() => {
    const isIdle = tab2Fetcher.state === "idle";
    const hasData = tab2Fetcher.data !== undefined && tab2Fetcher.data !== null;

    if (isIdle && hasData && lastProcessedAiData.current !== tab2Fetcher.data) {
      const fetcherProductId = tab2Fetcher.formData?.get("productId") || tab2Fetcher.formData?.get("pieceId");
      if (fetcherProductId && fetcherProductId !== selectedProductId && tab2Fetcher.data.intent !== "titleParse") {
         return; 
      }

      lastProcessedAiData.current = tab2Fetcher.data;

      if (tab2Fetcher.data.intent === "titleParse" && tab2Fetcher.data.titleParse) {
        const parsed = tab2Fetcher.data.titleParse;
        setFullMetaState(prev => {
          const updated = { ...prev };
          Object.entries(parsed).forEach(([k, v]) => {
            if (k === "weight_grams" || k === "shipping_weight_oz" || k === "piece_name") return;
            if (RETIRED_TAB2_KEYS.has(k)) return;
            if (k === "origin_story" && editedKeysRef.current.has("origin_story") && updated.origin_story) return;
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              updated[k] = v;
              markKeyEdited(k, "Gemini / Geo Library", "titleParse");
            }
          });
          if (parsed.stone_family && !updated.material) {
            updated.material = parsed.stone_family;
            markKeyEdited("material", "Gemini / Geo Library", "titleParse");
          }
          if (parsed.origin_handle && !updated.origin_page_handle) {
            updated.origin_page_handle = parsed.origin_handle;
            markKeyEdited("origin_page_handle", "Gemini / Geo Library", "titleParse");
          }
          // Preserve operator-entered piece_name; only populate from parsed piece_name if currently blank
          if (!updated.piece_name || String(updated.piece_name).trim() === "") {
            const candidatePieceName =
              parsed.piece_name ||
              extractLegacyPieceNameIfSegmented(parsed.canonical_title || "");
            if (candidatePieceName) {
              updated.piece_name = candidatePieceName;
              markKeyEdited("piece_name", "Gemini / Geo Library", "titleParse");
            }
          }
          fullMetaStateRef.current = updated;
          return updated;
        });
        setTab2StatusMessage("Title parsed — Geo-Vault & Dwell Web loaded");
        if (window.shopify?.toast) window.shopify.toast.show("Title parsed!");
        return;
      }

      const tab2Data = tab2Fetcher.data.tab2Data || {};
      if (tab2Fetcher.data.generated_description) tab2Data.generated_description = tab2Fetcher.data.generated_description;

      const aiIntentName = tab2Fetcher.data.intent || "tab2AutoFill";

      if (Object.keys(tab2Data).length > 0) {
        const applyAiUpdates = (prev) => {
          const updatedState = { ...prev };
          const isProtectedStory = isManualStoryProtectedPiece(
            updatedState.shopify_title || updatedState.native_title,
            updatedState.piece_name
          );

          const ALWAYS_OVERWRITE = [
            "mohs_hardness", "moh_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", 
            "diaphaneity", "mineral_class", "crystal_system", "rock_composition", 
            "rock_formation", "geological_era", "geological_age", "generated_description", 
            "seo_title", "bail_included", 
            "setting_ready", "primary_medium", "alt_text", "found_object", 
            "secondary_medium", "surface_finish", "material", "treated", 
            "jewelry_type", "jewelry_finding_type", "wire_material",
            "color", "cut_and_shape", "stone_shape"
          ];

          Object.entries(tab2Data).forEach(([key, val]) => {
            if (key === "weight_grams" || key === "shipping_weight_oz" || key === "piece_name" || key === "shopify_title" || key === "canonical_title" || key === "product_title") return;
            if (RETIRED_TAB2_KEYS.has(key)) return;
            if (key === "tenacity" || key === "secondary_colors" || key === "custom_product") return;

            // Preserve manual origin_story edits and protected manual-story descriptions
            if (key === "origin_story" && (editedKeysRef.current.has("origin_story") || (updatedState.origin_story && String(updatedState.origin_story).trim() !== ""))) {
              return;
            }
            if ((key === "generated_description" || key === "native_description") && isProtectedStory && (updatedState.generated_description || updatedState.native_description)) {
              return;
            }

            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            const currentlyEmpty = !updatedState[key] || updatedState[key].toString().trim() === "";
            
            if (hasNewValue && (currentlyEmpty || ALWAYS_OVERWRITE.includes(key))) {
              let normalizedVal = val;
              const booleanKeys = ["is_ooak", "is_one_of_a_kind", "found_object", "custom_product", "treated"];
              if (booleanKeys.includes(key)) {
                const lowerVal = String(val).toLowerCase().trim();
                if (lowerVal === "true" || lowerVal === "yes" || lowerVal.startsWith("yes —") || lowerVal.startsWith("yes -")) normalizedVal = "Yes";
                else if (lowerVal === "false" || lowerVal === "no") normalizedVal = "No";
              }
              
              if (key === "cut_type") {
                updatedState.cut_type = normalizedVal;
                if (!updatedState.cut_and_shape || String(updatedState.cut_and_shape).trim() === "") {
                  updatedState.cut_and_shape = normalizedVal;
                  markKeyEdited("cut_and_shape", "Gemini / Vision", aiIntentName);
                }
              } else if (key === "is_ooak" || key === "is_one_of_a_kind") {
                updatedState.is_one_of_a_kind = normalizedVal;
                updatedState.is_ooak = normalizedVal;
                markKeyEdited("is_one_of_a_kind", "Gemini / Vision", aiIntentName);
              } else if (key === "stone_family" || key === "material") {
                updatedState.material = normalizedVal;
                updatedState.stone_family = normalizedVal;
                markKeyEdited("material", "Gemini / Vision", aiIntentName);
              } else if (key === "origin_handle" || key === "origin_page_handle") {
                updatedState.origin_page_handle = normalizedVal;
                updatedState.origin_handle = normalizedVal;
                markKeyEdited("origin_page_handle", "Gemini / Vision", aiIntentName);
              } else if (key === "generated_description") {
                updatedState.generated_description = normalizedVal;
                updatedState.native_description = normalizedVal;
                markKeyEdited("generated_description", "Gemini", aiIntentName);
              } else if (key === "poetic_hook") {
                updatedState.native_seo_description = String(normalizedVal).trim();
                markKeyEdited("native_seo_description", "Gemini", aiIntentName);
              } else {
                updatedState[key] = normalizedVal;
                markKeyEdited(key, "Gemini / Vision", aiIntentName);
              }
            }
          });

          return updatedState;
        };

        setFormState(prev => applyAiUpdates(prev));

        setFullMetaState(prev => {
          const updatedState = applyAiUpdates(prev);
          fullMetaStateRef.current = updatedState;

          const REQUIRED_TAB2_FIELDS = [
            { key: "generated_description", label: "Generated Description" },
            { key: "color_pattern", label: "Color Pattern" },
            { key: "collection_location", label: "Collection Location" },
            { key: "origin_page_handle", label: "Origin Page Handle" }
          ];
          const missingFields = REQUIRED_TAB2_FIELDS.filter(f => {
            const val = updatedState[f.key] || (f.key === "origin_page_handle" ? updatedState.origin_handle : "") || "";
            return val.toString().trim() === "" || val === "[No story provided]";
          });
          if (missingFields.length > 0) {
            setTimeout(() => {
              setPendingFixFields(missingFields);
              setCurrentFixIndex(0);
              setFixPopupValue("");
              setShowFixPopup(true);
            }, 0);
          }

          return updatedState;
        });

        setTab2StatusMessage("Auto-Fill complete — review fields before saving");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill complete!");
      } else {
        setTab2ErrorMessage("Auto-Fill returned no data — check stone_family and origin_handle.");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill failed", { isError: true });
      }
    }
  }, [tab2Fetcher.state, tab2Fetcher.data, selectedProductId, products, markKeyEdited]);

  const handleFixPopupConfirm = useCallback(() => {
    if (!selectedProductContextRef.current.isValid) return;
    const field = pendingFixFields[currentFixIndex];
    if (field && fixPopupValue.trim() !== "") {
      updateFullMetaState(field.key, fixPopupValue.trim());
    }
    const nextIndex = currentFixIndex + 1;
    if (nextIndex < pendingFixFields.length) {
      setCurrentFixIndex(nextIndex);
      setFixPopupValue("");
    } else {
      setShowFixPopup(false); setPendingFixFields([]); setCurrentFixIndex(0); setFixPopupValue("");
    }
  }, [pendingFixFields, currentFixIndex, fixPopupValue, updateFullMetaState]);

  const handleFixPopupSkip = useCallback(() => {
    const nextIndex = currentFixIndex + 1;
    if (nextIndex < pendingFixFields.length) {
      setCurrentFixIndex(nextIndex);
      setFixPopupValue("");
    } else {
      setShowFixPopup(false); setPendingFixFields([]); setCurrentFixIndex(0); setFixPopupValue("");
    }
  }, [pendingFixFields, currentFixIndex]);

  // ============================================================================
  // UNIFIED TEMPLATE ROW-DESCRIPTOR & AUDIT COUNT PIPELINE
  // Builds the exact rendered row descriptors for all 10 PRODUCT_TEMPLATE_GROUPS
  // so UI rendering and computeTemplateAuditCounts share the identical array.
  // ============================================================================
  const rawMediaEdges = hasValidSelectedProductContext && Array.isArray(liveProductManifest?.nativeTargets?.media?.edges)
    ? liveProductManifest.nativeTargets.media.edges
    : [];
  const validMediaNodes = rawMediaEdges
    .filter(e => e?.node?.id && isExactMediaImageGid(e.node.id))
    .map(e => e.node);

  const shouldRenderTemplateCard = Boolean(hasValidSelectedProductContext || DEV_SHOW_ALL_TEMPLATE_FIELDS);
  const renderedKeysByGroupForAudit = {};
  let observedMediaControlCount = 0;
  let observedZeroImagePlaceholder = false;

  const templateGroupRenderModels = shouldRenderTemplateCard
    ? PRODUCT_TEMPLATE_GROUPS.map((group) => {
        const groupFields = Array.isArray(group.fields) ? group.fields : [];
        const rowDescriptors = [];

        groupFields.forEach((field) => {
          if (!field) return;
          if (RETIRED_TAB2_KEYS.has(field.key)) return;
          if (
            field.registryRole &&
            field.registryRole !== "PRIMARY_CANDIDATE_DESTINATION" &&
            field.registryRole !== "APPROVED_MEASUREMENT_ADDITION"
          ) {
            return;
          }

          if (field.key === "native_image_alt") {
            if (validMediaNodes.length > 0) {
              validMediaNodes.forEach((mediaNode) => {
                const mediaId = mediaNode.id;
                const shortId = mediaId.split("/").pop();
                const mediaKey = `native_image_alts_${mediaId}`;
                observedMediaControlCount += 1;
                rowDescriptors.push({
                  descriptorKey: mediaKey,
                  field,
                  overrideKey: mediaKey,
                  overrideLabel: `Native Image Alt (${shortId})`,
                  mediaNode,
                  isPerImageMediaRow: true,
                  isZeroImagePlaceholderRow: false
                });
              });
            } else {
              observedZeroImagePlaceholder = true;
              rowDescriptors.push({
                descriptorKey: "native_image_alt",
                field,
                overrideKey: null,
                overrideLabel: "Native Image Alt Text (Zero-Image Capability Placeholder)",
                mediaNode: null,
                isPerImageMediaRow: false,
                isZeroImagePlaceholderRow: true
              });
            }
            return;
          }

          const resolvedDest = resolveConfigFieldDestination(field);
          rowDescriptors.push({
            descriptorKey: resolvedDest || field.key,
            field,
            overrideKey: null,
            overrideLabel: null,
            mediaNode: null,
            isPerImageMediaRow: false,
            isZeroImagePlaceholderRow: false
          });
        });

        renderedKeysByGroupForAudit[group.heading] = rowDescriptors.map(r => r.descriptorKey);

        return {
          heading: group.heading,
          color: group.color,
          logicalFields: groupFields,
          rowDescriptors
        };
      })
    : [];

  const templateAuditSummary = computeTemplateAuditCounts(
    PRODUCT_TEMPLATE_GROUPS,
    shouldRenderTemplateCard
      ? {
          renderedKeysByGroup: renderedKeysByGroupForAudit,
          mediaControlCount: observedMediaControlCount,
          hasZeroImagePlaceholder: observedZeroImagePlaceholder
        }
      : null
  );

  const renderCapabilityRowFromDescriptor = (descriptor) => {
    const {
      descriptorKey,
      field,
      overrideKey,
      overrideLabel,
      mediaNode,
      isPerImageMediaRow,
      isZeroImagePlaceholderRow
    } = descriptor;

    const resolvedDest = overrideKey || resolveConfigFieldDestination(field);
    const bareKey = (field.metaKey || field.key || "").replace(/^custom\./, "");

    const evalMeta = evaluateFieldMetadata({
      key: isZeroImagePlaceholderRow ? "native_image_alt" : resolvedDest,
      data: hasValidSelectedProductContext
        ? (liveProductManifest || EMPTY_DEV_PREVIEW_MANIFEST)
        : EMPTY_DEV_PREVIEW_MANIFEST,
      productId: hasValidSelectedProductContext ? selectedProductId : null,
      currentApprovals: {},
      configFields: allTemplateFields,
      standardizedCandidatesByProduct: {},
      getStandardizedEvaluationForField: null
    });

    const isHeldReadOnly = Boolean(
      !hasValidSelectedProductContext ||
      isZeroImagePlaceholderRow ||
      evalMeta.isImageAltCapabilityPlaceholder ||
      evalMeta.isPendingReadOnly ||
      evalMeta.hasExplicitStorageHold ||
      evalMeta.hasExplicitProducerHold ||
      evalMeta.isChannelFlagReadOnly ||
      evalMeta.isVariantMetafieldHold ||
      field.mappingStatus === "pending_read_only" ||
      field.storageVerified === false ||
      field.writerVerified === false ||
      field.producerAlignmentPending === true ||
      field.owner === "variant_metafield" ||
      resolvedDest === "mm-google-shopping.custom_product" ||
      field.namespace === "shopify"
    );

    const nativeEditableKeys = [
      "shopify_title", "native_title",
      "price", "native_price",
      "weight_grams", "shipping_weight_oz", "native_shipping_weight",
      "native_description", "native_seo_title", "native_seo_description",
      "native_image_alt"
    ];

    const isKnownKey =
      Boolean(evalMeta.isSupported) ||
      NAMESPACE_MAP.custom.includes(bareKey) ||
      nativeEditableKeys.includes(field.key) ||
      isPerImageMediaRow;

    const isSupported = isKnownKey && !RETIRED_TAB2_KEYS.has(bareKey);
    const canEdit = Boolean(
      hasValidSelectedProductContext &&
      isSupported &&
      !isHeldReadOnly &&
      !evalMeta.isManualOnly &&
      !isZeroImagePlaceholderRow &&
      field.key !== "native_image_alt"
    );

    const stateKey =
      isPerImageMediaRow ? resolvedDest :
      field.key === "native_title" ? "shopify_title" :
      field.key === "native_description" ? "generated_description" :
      field.key === "native_seo_title" ? "seo_title" :
      field.key === "native_price" ? "price" :
      field.key === "native_shipping_weight" ? "shipping_weight_oz" :
      (field.namespace && field.namespace !== "custom" && field.namespace !== "native"
        ? resolvedDest
        : bareKey);

    let val = "";
    if (hasValidSelectedProductContext && !isZeroImagePlaceholderRow) {
      val = fullMetaState[stateKey] !== undefined && fullMetaState[stateKey] !== null
        ? fullMetaState[stateKey]
        : (fullMetaState[resolvedDest] ?? fullMetaState[field.key] ?? evalMeta.currentVal ?? "");

      if (bareKey === "is_one_of_a_kind" && (val === "" || val === undefined) && fullMetaState.is_ooak) {
        val = fullMetaState.is_ooak;
      }
      if (bareKey === "material" && (val === "" || val === undefined) && (fullMetaState.stone_family || fullMetaState.primary_medium)) {
        val = fullMetaState.stone_family || fullMetaState.primary_medium;
      }
      if (bareKey === "origin_page_handle" && (val === "" || val === undefined) && fullMetaState.origin_handle) {
        val = fullMetaState.origin_handle;
      }
      if (bareKey === "cut_and_shape" && (val === "" || val === undefined) && fullMetaState.cut_type) {
        val = fullMetaState.cut_type;
      }
    }

    if (typeof val === "string" && val.startsWith("[")) {
      try {
        const arr = JSON.parse(val);
        val = Array.isArray(arr) ? arr.join(", ") : val;
      } catch(e) {}
    } else if (typeof val === "string" && val.startsWith("{")) {
      try {
        const obj = JSON.parse(val);
        val = JSON.stringify(obj);
      } catch(e) {}
    } else if (Array.isArray(val)) {
      val = val.join(", ");
    } else if (typeof val === "object" && val !== null) {
      val = JSON.stringify(val);
    }

    let holdReasonText = "";
    let holdBadgeLabel = "";
    let holdBadgeTone = "info";

    if (!hasValidSelectedProductContext) {
      holdBadgeLabel = "Read-Only (Unselected DEV Preview)";
      holdBadgeTone = "warning";
      holdReasonText = isZeroImagePlaceholderRow
        ? "DEV Unselected Preview: Zero-image placeholder for native_image_alt (read-only; requires a selected product and exact MediaImage GID)."
        : "DEV Unselected Preview: Select a product in Column 1 to load values and unlock supported editing.";
    } else if (!isSupported) {
      holdBadgeLabel = "Connection Pending";
      holdReasonText = "Connection pending.";
    } else if (isZeroImagePlaceholderRow || (field.key === "native_image_alt" && !overrideKey)) {
      holdBadgeLabel = "Read-Only (No Media Target)";
      holdBadgeTone = "warning";
      holdReasonText = evalMeta.imageAltPlaceholderReason || "Read-only zero-image placeholder: individual media alt controls appear only when valid MediaImage GIDs exist on the product.";
    } else if (evalMeta.isStandardizedAttribute || field.namespace === "shopify") {
      holdBadgeLabel = "Read-Only (Standardized)";
      holdReasonText = "Standardized attribute (pending_read_only). Use Tab 3 for reference-matched writes.";
    } else if (evalMeta.hasExplicitStorageHold || field.storageVerified === false || field.writerVerified === false) {
      holdBadgeLabel = "Read-Only (Storage Unverified)";
      holdReasonText = "Proposed measurement capability: storage/writer contract unverified (writes disabled).";
    } else if (evalMeta.hasExplicitProducerHold || field.producerAlignmentPending === true) {
      holdBadgeLabel = "Read-Only (Producer Alignment Pending)";
      holdBadgeTone = "warning";
      holdReasonText = "Producer/writer definition alignment pending verification (writes disabled).";
    } else if (evalMeta.isChannelFlagReadOnly || resolvedDest === "mm-google-shopping.custom_product") {
      holdBadgeLabel = "Read-Only (Channel Rule Pending)";
      holdReasonText = "Channel boolean flag read-only pending verified rules (writes disabled).";
    } else if (evalMeta.isVariantMetafieldHold || field.owner === "variant_metafield") {
      holdBadgeLabel = "Read-Only (Variant Owner Hold)";
      holdBadgeTone = "warning";
      holdReasonText = "Variant-owned metafield (PRODUCTVARIANT) held: product-level writer route not applicable.";
    } else if (isHeldReadOnly) {
      holdBadgeLabel = "Read-Only (Held)";
      holdReasonText = "Field contract held read-only (writes disabled).";
    }

    const reqKeys = [
      "shopify_title", "native_title", "piece_name", "price", "native_price",
      "weight_grams", "shipping_weight_oz", "native_shipping_weight",
      "material", "collection_name", "origin_page_handle", "treatment_status", "seo_title", "native_seo_title"
    ];
    const isFilled =
      hasValidSelectedProductContext &&
      !isZeroImagePlaceholderRow &&
      val !== undefined &&
      val !== null &&
      String(val).trim() !== "" &&
      String(val).trim() !== "false" &&
      !(bareKey === "collection_date" && /^(n\/a|none|unknown)$/i.test(String(val).trim()));
    const isRequiredEmpty = !isFilled && canEdit && reqKeys.includes(field.key);
    const isEmpty = !isFilled;
    
    let dotFillColor = isHeldReadOnly ? "#6b7280" : "#eab308";
    if (isFilled) dotFillColor = "#22c55e"; 
    if (isRequiredEmpty) dotFillColor = "#ef4444"; 

    const effectiveLabel = overrideLabel || field.label;
    const thumbnailUrl = isPerImageMediaRow ? (mediaNode?.preview?.image?.url || null) : null;

    const labelNode = (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {thumbnailUrl && (
            <img
              src={thumbnailUrl}
              alt=""
              style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover", border: "1px solid #d2d5d8", flexShrink: 0 }}
            />
          )}
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: "18px" }}>
            <circle cx="9" cy="9" r="9" fill={dotFillColor} />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: "500" }}>
            {effectiveLabel}
          </span>
        </div>
        {holdBadgeLabel && <Badge tone={holdBadgeTone}>{holdBadgeLabel}</Badge>}
      </div>
    );

    const displayVal = isSupported
      ? (isZeroImagePlaceholderRow || (bareKey === "collection_date" && !isFilled) ? "" : String(val ?? ""))
      : "Connection pending.";
    const isDisabled = !canEdit || (!isEmpty && val === "See Shopify metaobject" && field.key !== "shopify_title");
    const isMultiline =
      field.control === "multiline" ||
      field.key.includes("story") ||
      field.key.includes("notes") ||
      field.key.includes("flaws") ||
      field.key.includes("character") ||
      field.key === "generated_description" ||
      field.key === "native_description" ||
      field.key === "native_seo_description";
    const optionsKey = field.optionsKey || bareKey;

    // Compact DEV field diagnostic strip values derived strictly from existing metadata and recorded state
    const destNamespace = field.namespace || evalMeta.namespace || "Not recorded";
    const destMetaKey = isPerImageMediaRow ? resolvedDest : (field.metaKey || evalMeta.metaKey || field.key);
    const destIdentity = isPerImageMediaRow
      ? `MEDIAIMAGE:${mediaNode?.id} (alt)`
      : (field.registryIdentity || (destNamespace === "native" ? destMetaKey : `${destNamespace}.${destMetaKey}`));
    const destOwner = field.registryOwner || field.owner || evalMeta.owner || "Not recorded";
    const destDataType = field.type || evalMeta.type || "Not recorded";

    const baselineStoredVal = !hasValidSelectedProductContext
      ? null
      : isZeroImagePlaceholderRow
        ? null
        : (originalMetaRef.current[stateKey] ??
           originalMetaRef.current[resolvedDest] ??
           (evalMeta.currentExists ? evalMeta.currentVal : ""));

    const hasEditedState = hasValidSelectedProductContext && !isZeroImagePlaceholderRow && (
      editedKeysRef.current.has(stateKey) ||
      editedKeysRef.current.has(resolvedDest) ||
      editedKeysRef.current.has(bareKey)
    );

    const recordedSourceEntry = hasValidSelectedProductContext && !isZeroImagePlaceholderRow
      ? (keySourcesRef.current[resolvedDest] || keySourcesRef.current[stateKey] || keySourcesRef.current[bareKey] || null)
      : null;

    const applicabilityObj = evalMeta.applicabilityState || {
      status: "Not evaluated",
      tone: "info",
      reason: "Applicability not evaluated"
    };

    return (
      <div key={descriptorKey}>
        <div style={{ backgroundColor: isEmpty && canEdit ? "#FFF5F5" : (isHeldReadOnly ? "#f8f9fa" : "transparent"), minHeight: "48px", padding: "8px", borderRadius: "4px", border: isHeldReadOnly ? "1px dashed #d2d5d8" : "none" }}>
          {canEdit && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[optionsKey] && DROPDOWN_OPTIONS[optionsKey].length > 0 ? (
            <Select 
              label={labelNode} 
              options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[optionsKey] || [])]} 
              value={displayVal} 
              onChange={(v) => {
                if (!canEdit || !selectedProductContextRef.current.isValid) return;
                updateFullMetaState(stateKey, v);
              }} 
              disabled={isDisabled} 
            />
          ) : (
            <TextField 
              label={labelNode} 
              value={displayVal} 
              onChange={(v) => {
                if (!canEdit || !selectedProductContextRef.current.isValid) return;
                updateFullMetaState(stateKey, v);
              }} 
              multiline={isMultiline ? true : false} 
              autoComplete="off" 
              placeholder={isHeldReadOnly ? holdReasonText : (bareKey === "collection_date" ? "Blank (unknown)" : "")}
              helpText={holdReasonText || undefined}
              disabled={isDisabled} 
              readOnly={!canEdit} 
            />
          )}

          {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                backgroundColor: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                fontSize: "11px",
                lineHeight: "1.4",
                color: "#1e293b",
                wordBreak: "break-word",
                overflowWrap: "anywhere"
              }}
            >
              <div style={{ fontWeight: "700", color: "#0f172a", marginBottom: "2px" }}>
                DEV DIAGNOSTIC STRIP (Evaluation Only — Not Save / Read-Back Proof)
              </div>
              <div>
                <strong>Destination:</strong> <code>{destIdentity}</code> | <strong>Owner:</strong> <code>{destOwner}</code> | <strong>Type:</strong> <code>{destDataType}</code>
              </div>
              <div>
                <strong>Stored Baseline:</strong>{" "}
                <code>
                  {!hasValidSelectedProductContext
                    ? "Not recorded (no product selected)"
                    : isZeroImagePlaceholderRow
                      ? "None (zero-image placeholder)"
                      : formatCompactDiagPreview(baselineStoredVal)}
                </code>
                {" | "}
                <strong>Current Form State:</strong>{" "}
                <code>
                  {!hasValidSelectedProductContext
                    ? "Not recorded (unselected preview)"
                    : isZeroImagePlaceholderRow
                      ? "Non-writable placeholder"
                      : formatCompactDiagPreview(displayVal)}
                </code>
              </div>
              <div>
                <strong>Recorded Source:</strong> <code>{recordedSourceEntry?.source || "Not recorded"}</code>
                {" | "}
                <strong>Stage:</strong> <code>{recordedSourceEntry?.stage || "Not recorded"}</code>
                {" | "}
                <strong>Edited in Session:</strong> <code>{hasEditedState ? "Yes" : "No"}</code>
              </div>
              <div>
                <strong>Applicability:</strong> <code>{applicabilityObj.status}</code>
                {" | "}
                <strong>Mode:</strong> <code>{canEdit ? "Editable" : (holdBadgeLabel || "Read-Only")}</code>
              </div>
              {holdReasonText && (
                <div>
                  <strong>Hold / Reason:</strong> <code>{holdReasonText}</code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));
  const isSaving =
    injectFetcher.state !== "idle" &&
    (injectFetcher.formData?.get("intent") === "executeRepairPlan" ||
      injectFetcher.formData?.get("intent") === "saveProduct" ||
      injectFetcher.formData?.get("intent") === "saveMetafields");

  return (
    <BlockStack gap="400">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">1. Select Raw Inventory</Text>
              <TextField value={searchQuery} onChange={setSearchQuery} placeholder="Search products by title..." autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery("")} />
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto", height: "600px", paddingRight: "8px" }}>
                {filteredProducts.map(p => (
                  <div key={p.id} style={{ minHeight: "140px", overflow: "hidden", flexShrink: 0 }}>
                    <Button fullWidth size="large" textAlign="left" variant={selectedProductId === p.id ? "primary" : "secondary"} onClick={() => handleSelectProduct(p.id)}>
                      <div style={{ display: "flex", flexDirection: "column", width: "100%", padding: "4px 0" }}>
                        <div style={{ marginBottom: "8px" }}>
                          {p.images?.edges?.[0]?.node?.url ? (
                            <img src={p.images.edges[0].node.url} alt="" style={{ width: "120px", height: "120px", minWidth: "120px", minHeight: "120px", objectFit: "cover", objectPosition: "center", borderRadius: "6px", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: "120px", height: "120px", minWidth: "120px", minHeight: "120px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }} />
                          )}
                        </div>
                        <div style={{ width: "100%", borderTop: "1px solid rgba(150, 150, 150, 0.3)", paddingTop: "8px" }}>
                          {p.title.split(" — ").map((part, idx) => (
                            <span key={idx} style={{ display: "block", marginBottom: "4px", whiteSpace: "normal", wordBreak: "break-word", fontWeight: idx === 0 ? "bold" : "normal" }}>
                              {part}
                            </span>
                          ))}
                          {p.variants?.edges?.[0]?.node?.price && (
                            <span style={{ display: "block", marginBottom: "4px", whiteSpace: "normal", opacity: 0.8 }}>
                              ${parseFloat(p.variants.edges[0].node.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Button>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">2. Data Sieve & Injection</Text>
                {hasValidSelectedProductContext && (
                  <Button 
                    size="micro" 
                    tone={productStatus === "ACTIVE" ? "success" : "critical"}
                    onClick={handleToggleStatus}
                    loading={statusFetcher.state !== "idle"}
                  >
                    {productStatus === "ACTIVE" ? "🟢 ACTIVE (Click to Draft)" : "🔴 DRAFT (Click to Publish)"}
                  </Button>
                )}
              </InlineStack>

              {statusMessage !== "" && <Banner title="Save Verified" tone="success"><Text as="p">{statusMessage}</Text></Banner>}
              {warningMessage !== "" && <Banner title="Partial or Unresolved Changes" tone="warning"><Text as="p">{warningMessage}</Text></Banner>}
              {errorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{errorMessage}</Text></Banner>}
              
              <TextField label="Gemini Presentation Style" placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy." value={promptStyle} onChange={setPromptStyle} multiline={3} autoComplete="off" disabled={!hasValidSelectedProductContext} />

              {hasValidSelectedProductContext && (() => {
                const product = selectedProductObj;
                return (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Review before running — edit if legacy data is incorrect:</Text>
                    <TextField 
                      label="Product Title" 
                      value={formState.shopify_title || fullMetaState.shopify_title || product?.title || ""} 
                      onChange={(val) => updateFullMetaState("shopify_title", val)} 
                      onBlur={() => handleTitleBlur(formState.shopify_title || fullMetaState.shopify_title || product?.title || "")}
                      autoComplete="off" 
                      helpText="Format: Stone Family — Origin Location — Piece Name" 
                    />
                    <TextField
                      label="Origin Page Handle (override)"
                      value={formState.origin_page_handle || fullMetaState.origin_page_handle || formState.origin_handle || fullMetaState.origin_handle || ""}
                      onChange={(val) => updateFullMetaState("origin_page_handle", val)}
                      autoComplete="off"
                      helpText="e.g. the-richardson-strike — leave blank to auto-resolve from title"
                    />
                    
                    <div style={{ marginTop: "16px" }}>
                      <Text variant="headingMd" as="h3" fontWeight="bold">Upload New Hero Photo (overrides Shopify image for rescan)</Text>
                      {overridePhoto ? (
                        <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                          <img src={overridePhoto.previewUrl} alt="Override preview" style={{ minWidth: "120px", minHeight: "120px", width: "120px", height: "120px", objectFit: "cover", objectPosition: "center", borderRadius: "6px" }} />
                          <Button onClick={() => setOverridePhoto(null)} tone="critical">Remove</Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: "8px" }}>
                          <DropZone 
                            accept="image/jpeg, image/png" 
                            type="image" 
                            allowMultiple={false} 
                            onDrop={handleDropOverridePhoto}
                          >
                            <DropZone.FileUpload actionTitle="Drop photo here or click to upload" />
                          </DropZone>
                        </div>
                      )}
                    </div>
                  </BlockStack>
                );
              })()}

              <InlineStack align="space-between" gap="300">
                <Button icon={MagicIcon} onClick={handleTab2AutoFill} size="large" fullWidth disabled={!hasValidSelectedProductContext} loading={tab2Fetcher.state !== "idle"}>RUN</Button>
                <Button icon={MagicIcon} onClick={handleFullRescan} size="large" fullWidth disabled={!hasValidSelectedProductContext} loading={tab2Fetcher.state !== "idle"} tone="success">Full Rescan</Button>
                <Button
                  tone="critical"
                  onClick={() => {
                    if (!selectedProductContextRef.current.isValid || !isExactProductGid(selectedProductId)) return;
                    injectFetcher.submit({ intent: "cleanGhostNamespaces", productId: selectedProductId }, { method: "post", action: "/app/meta-injector-api" });
                  }}
                  size="large"
                  fullWidth
                  disabled={!hasValidSelectedProductContext}
                  loading={injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "cleanGhostNamespaces"}
                >
                  Wipe Ghosts
                </Button>
                <Button icon={ClipboardIcon} onClick={handleCopyTelemetry} size="large" fullWidth disabled={!hasValidSelectedProductContext}>Copy Telemetry</Button>
                <Button icon={SaveIcon} tone="success" variant="primary" onClick={handleInject} size="large" fullWidth disabled={!hasValidSelectedProductContext} loading={isSaving}>Inject Metafields</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </div>

      {hasValidSelectedProductContext && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingLg">Origin Story & Long-Text Repair Workbench</Text>
                <Badge tone="info">Dedicated Workbench Panel (Not Extra Logical Capabilities)</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                Origin Story Draft provides protected source context for RUN / Full Rescan generation and is preserved across rescans. Direct metafield writes to custom.origin_story are held by domain policy (source context is not a saved canonical metafield). Native Description and Native SEO Description save directly via verified native/staging routes when Inject Metafields is clicked, and are shared with their corresponding canonical rows in the 62-capability template below.
              </Text>
              <TextField
                label="Origin Story Source Context (Used by RUN / Full Rescan — Not Written as a Metafield)"
                value={fullMetaState.origin_story ?? formState.origin_story ?? ""}
                onChange={(val) => updateFullMetaState("origin_story", val)}
                multiline={4}
                autoComplete="off"
                helpText="Stored origin_story and manual edits here are preserved across rescans and passed to AI generation, without triggering automatic saves."
              />
              <TextField
                label="Native Product Description (Canonical Long-Text — Saved on Inject Metafields)"
                value={fullMetaState.generated_description ?? fullMetaState.native_description ?? ""}
                onChange={(val) => updateFullMetaState("generated_description", val)}
                multiline={6}
                autoComplete="off"
                helpText="Stages both custom.generated_description and native descriptionHtml for verified write on Inject Metafields."
              />
              <TextField
                label="Native SEO Description (Meta Description — Under 160 Characters)"
                value={fullMetaState.native_seo_description ?? ""}
                onChange={(val) => updateFullMetaState("native_seo_description", val)}
                multiline={2}
                autoComplete="off"
                helpText={`Current length: ${String(fullMetaState.native_seo_description ?? "").length}/160 characters.`}
              />
            </BlockStack>
          </Card>
        </div>
      )}

      {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Badge tone="warning">DEV: Show All Template Fields</Badge>
                  <Text as="h3" variant="headingMd" fontWeight="bold">
                    Tab 2 Template Capability & Rendered Row Audit ({isDevUnselectedPreview ? "Unselected Read-Only Preview" : `Active Product: ${selectedProductId}`})
                  </Text>
                </InlineStack>
                <Badge tone={templateAuditSummary.measurementStatus === "complete" ? "success" : "attention"}>
                  {templateAuditSummary.measurementStatus === "complete"
                    ? `Measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups)`
                    : `Not measured (${templateAuditSummary.measuredGroupCount}/${templateAuditSummary.totalGroupCount} groups reported)`}
                </Badge>
              </InlineStack>

              <Text as="p" variant="bodySm" tone="subdued">
                <strong>Scope:</strong> Counts below measure only the canonical template rows rendered inside the 10 <code>PRODUCT_TEMPLATE_GROUPS</code> sections in Tab 2 using the shared <code>computeTemplateAuditCounts</code> helper and the exact rendered row descriptor list. Dedicated top-level convenience panels (Product Title / Origin Page Handle override / Origin Story & Long-Text Repair Workbench) are not counted as extra logical capabilities. Compatibility adapters, excluded inputs, duplicate aliases, and protected records remain hidden.
              </Text>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "2px solid #cbd5e1", textAlign: "left" }}>
                      <th style={{ padding: "8px 10px" }}>Template Group</th>
                      <th style={{ padding: "8px 10px" }}>Logical Capabilities</th>
                      <th style={{ padding: "8px 10px" }}>Running Logical Subtotal</th>
                      <th style={{ padding: "8px 10px" }}>Measured Rendered Template Rows</th>
                      <th style={{ padding: "8px 10px" }}>Running Rendered Subtotal</th>
                      <th style={{ padding: "8px 10px" }}>Notes / Media Expansion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let runningLogical = 0;
                      let runningRendered = 0;
                      let allMeasuredSoFar = true;

                      return templateAuditSummary.groupSubtotals.map((grp) => {
                        runningLogical += grp.logicalCount;
                        const isGrpMeasured = grp.measurementStatus === "measured" && typeof grp.renderedCount === "number";
                        if (isGrpMeasured) {
                          runningRendered += grp.renderedCount;
                        } else {
                          allMeasuredSoFar = false;
                        }

                        let rowNote = "1:1 canonical rows";
                        if (!isGrpMeasured) {
                          rowNote = "Not measured";
                        } else if (grp.logicalImageAltCount > 0) {
                          if (templateAuditSummary.mediaControlCount > 0) {
                            rowNote = `Includes ${templateAuditSummary.mediaControlCount} per-image media alt control(s) from 1 logical native_image_alt capability`;
                          } else if (templateAuditSummary.hasZeroImagePlaceholder) {
                            rowNote = "Includes 1 read-only zero-image placeholder row for native_image_alt (non-writable)";
                          }
                        } else if (grp.nonMediaDiscrepancy !== null && grp.nonMediaDiscrepancy !== 0) {
                          rowNote = `Non-media row delta: ${grp.nonMediaDiscrepancy > 0 ? `+${grp.nonMediaDiscrepancy}` : grp.nonMediaDiscrepancy}`;
                        }

                        return (
                          <tr key={grp.heading} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "6px 10px", fontWeight: "600" }}>{grp.heading}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace" }}>{grp.logicalCount}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>{runningLogical}</td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace", fontWeight: "600" }}>
                              {isGrpMeasured ? grp.renderedCount : "Not measured"}
                            </td>
                            <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#475569" }}>
                              {allMeasuredSoFar ? runningRendered : "Not measured"}
                            </td>
                            <td style={{ padding: "6px 10px", color: "#475569" }}>{rowNote}</td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#e2e8f0", fontWeight: "700", borderTop: "2px solid #94a3b8" }}>
                      <td style={{ padding: "8px 10px" }}>GRAND TOTAL ({templateAuditSummary.totalGroupCount} Groups)</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>{templateAuditSummary.totalLogicalCapabilities}</td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                        {templateAuditSummary.totalRenderedRows !== null
                          ? templateAuditSummary.totalRenderedRows
                          : "Not measured"}
                      </td>
                      <td style={{ padding: "8px 10px", fontFamily: "monospace" }}>
                        {templateAuditSummary.totalRenderedRows !== null
                          ? templateAuditSummary.totalRenderedRows
                          : "Not measured"}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        {templateAuditSummary.mediaControlCount !== null
                          ? `Per-Image Media Controls: ${templateAuditSummary.mediaControlCount} | Zero-Image Placeholder: ${templateAuditSummary.hasZeroImagePlaceholder ? "1 (Active)" : "0"}`
                          : "Media breakdown: Not measured"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </BlockStack>
          </Card>
        </div>
      )}

      {shouldRenderTemplateCard && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">
              {tab2StatusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{tab2StatusMessage}</Text></Banner>}
              {tab2ErrorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{tab2ErrorMessage}</Text></Banner>}
              {injectFetcher.state === "idle" && injectFetcher.data?.message?.includes("Cleaned") && <Banner title="Ghosts Cleaned" tone="success"><Text as="p">{injectFetcher.data.message}</Text></Banner>}

              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingLg">
                  Universal Product Capability Template ({templateAuditSummary.totalLogicalCapabilities} Logical Capabilities{templateAuditSummary.totalRenderedRows !== null ? ` / ${templateAuditSummary.totalRenderedRows} Rendered Template Rows` : ""})
                </Text>
                {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
                  <Badge tone={isDevUnselectedPreview ? "warning" : "info"}>
                    {isDevUnselectedPreview ? "DEV Read-Only Unselected Preview" : "DEV: All Canonical Groups Open"}
                  </Badge>
                )}
              </InlineStack>

              {isDevUnselectedPreview && (
                <Banner tone="info" title="DEV Show-All Read-Only Preview (No Product Selected)">
                  <Text as="p">
                    All approved canonical template groups and rows are displayed below in read-only mode (including the non-writable zero-image <code>native_image_alt</code> placeholder) so the visible UI can be audited before selecting a product. Select a product in Column 1 to load live product data and enable supported editing.
                  </Text>
                </Banner>
              )}

              {templateGroupRenderModels.map((groupModel, groupIdx) => {
                const logicalCount = groupModel.logicalFields.length;
                const renderedCount = groupModel.rowDescriptors.length;
                return (
                  <BlockStack gap="300" key={groupModel.heading || groupIdx}>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h4" variant="headingMd" tone={groupModel.color === "success" ? "success" : undefined}>
                        {DEV_SHOW_ALL_TEMPLATE_FIELDS
                          ? `${groupModel.heading} (${logicalCount} logical / ${renderedCount} rendered template ${renderedCount === 1 ? "row" : "rows"})`
                          : groupModel.heading}
                      </Text>
                      {DEV_SHOW_ALL_TEMPLATE_FIELDS && (
                        <Badge tone="info">DEV: Open</Badge>
                      )}
                    </InlineStack>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                      {groupModel.rowDescriptors.map(renderCapabilityRowFromDescriptor)}
                    </div>
                  </BlockStack>
                );
              })}

            </BlockStack>
          </Card>
        </div>
      )}

      <div style={{ marginTop: "32px" }}>
        <Card padding="400">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Nuclear Ghost Cleanup</Text>
            {injectFetcher.state === "idle" && injectFetcher.data?.message?.includes("Nuclear sweep") && <Banner title={injectFetcher.data.success ? "Operation Successful" : "Operation Failed"} tone={injectFetcher.data.success ? "success" : "critical"}><Text as="p">{injectFetcher.data.message}</Text></Banner>}
            <Button tone="critical" variant="primary" onClick={() => injectFetcher.submit({ intent: "cleanAllGhostNamespaces" }, { method: "post", action: "/app/meta-injector-api" })} loading={injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "cleanAllGhostNamespaces"}>Clean ALL Ghost Namespaces (Store-Wide)</Button>
          </BlockStack>
        </Card>
      </div>

      {showFixPopup && pendingFixFields[currentFixIndex] && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "480px", maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Missing: {pendingFixFields[currentFixIndex].label}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Field {currentFixIndex + 1} of {pendingFixFields.length} — enter a value or skip.</Text>
              <TextField value={fixPopupValue} onChange={setFixPopupValue} label={pendingFixFields[currentFixIndex].label} autoComplete="off" multiline={pendingFixFields[currentFixIndex].key === "generated_description" ? 4 : undefined} />
              <InlineStack gap="300" align="end">
                <Button onClick={handleFixPopupSkip}>Skip</Button>
                <Button variant="primary" onClick={handleFixPopupConfirm}>Save & Continue</Button>
              </InlineStack>
            </BlockStack>
          </div>
        </div>
      )}
    </BlockStack>
  );
}

export default IntakeBenchTab;
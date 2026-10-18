import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, DropZone } from "@shopify/polaris";
import { MagicIcon, SaveIcon, ClipboardIcon } from "@shopify/polaris-icons";
import { DROPDOWN_OPTIONS, FULL_META_GROUPS, getFieldStatus, ROCKHOUND_FIELDS, PRODUCT_TEMPLATE_GROUPS } from "../utils/meta-injector.constants.jsx";
import { evaluateFieldMetadata, buildRepairPayload } from "../utils/meta-injector.matrix-domain.jsx";
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
    "official_name", "stone_story", "cut_type", "surface_finish",
    "treatment_status", "primary_color", "secondary_colors",
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
    "custom_product", "found_object", "chain_link_type"
  ]
};

const RETIRED_TAB2_KEYS = new Set([
  "artist_notes", "bench_notes", "handcrafted_by", "color",
  "cut_and_shape", "stone_shape", "primary_use"
]);

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

  useEffect(() => {
    if (tab2Fetcher && tab2Fetcher.data) {
      lastProcessedAiData.current = tab2Fetcher.data;
    }
  }, [selectedProductId, tab2Fetcher]);

  const handleDropOverridePhoto = useCallback((_dropFiles, acceptedFiles) => {
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
    setPendingFixFields([]);
    setCurrentFixIndex(0);
    setShowFixPopup(false);
    setFixPopupValue("");
    lastProcessedAiData.current = null;
    lastAutofilledTitle.current = "";

    const product = products.find(p => p.id === id);
    if (product) {
      setProductStatus(product.status || "DRAFT");
    }
    
    const newForm = {};
    const newFullForm = {};
    
    if (product && product.title) {
      newForm.shopify_title = product.title;
      newFullForm.shopify_title = product.title;
      newForm.native_title = product.title;
      newFullForm.native_title = product.title;
    }

    if (product && typeof product.descriptionHtml === "string") {
      newForm.native_description = product.descriptionHtml;
      newFullForm.native_description = product.descriptionHtml;
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
        if (hasValue && (node.namespace === "custom" || node.namespace === "geo" || node.namespace === "rockhound")) {
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
        if (!newFullForm[snake]) newFullForm[snake] = newFullForm[camel]; 
        delete newFullForm[camel]; 
      }
      if (newForm[camel] !== undefined) { 
        if (!newForm[snake]) newForm[snake] = newForm[camel]; 
        delete newForm[camel]; 
      }
    });

    // Safe legacy read companions without automatic overwrite
    if (!newFullForm.is_one_of_a_kind && newFullForm.is_ooak) {
      newFullForm.is_one_of_a_kind = newFullForm.is_ooak;
      newForm.is_one_of_a_kind = newFullForm.is_ooak;
    }
    if (!newFullForm.material && (newFullForm.stone_family || newFullForm.primary_medium)) {
      const fallbackMat = newFullForm.stone_family || newFullForm.primary_medium;
      newFullForm.material = fallbackMat;
      newForm.material = fallbackMat;
    }
    if (!newFullForm.origin_page_handle && newFullForm.origin_handle) {
      newFullForm.origin_page_handle = newFullForm.origin_handle;
      newForm.origin_page_handle = newFullForm.origin_handle;
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
      }
    }

    if (vNode && vNode.price) {
      newForm.price = vNode.price; 
      newFullForm.price = vNode.price; 
      newForm.native_price = vNode.price;
      newFullForm.native_price = vNode.price;
    }

    const seoTitleNode = allEdges.find(e => e.node.key === "seo_title" || e.node.key === "title_tag")?.node;
    if (seoTitleNode && seoTitleNode.value) {
      newFullForm.seo_title = seoTitleNode.value;
      newFullForm.native_seo_title = seoTitleNode.value;
    }
    
    setFormState(newForm);
    setFullMetaState(newFullForm);
    fullMetaStateRef.current = newFullForm;
    originalMetaRef.current = { ...newFullForm };

    // Load live product manifest from backend so executeRepairPlan has exact baselines and variant/SEO targets
    const fd = new FormData();
    fd.append("intent", "loadProductData");
    fd.append("pieceId", id);
    productLoadFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [products]);

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
        const vEdge = lData.nativeTargets?.variants?.edges?.[0]?.node;
        const wObj = vEdge?.inventoryItem?.measurement?.weight;
        const liveShipOz =
          wObj && wObj.value !== undefined && wObj.value !== null && Number(wObj.value) > 0 && wObj.unit === "OUNCES"
            ? String(wObj.value)
            : "";

        setFullMetaState(prev => {
          const next = { ...prev };
          if (!editedKeysRef.current.has("native_seo_description") && seoDesc) {
            next.native_seo_description = seoDesc;
            originalMetaRef.current.native_seo_description = seoDesc;
          }
          if (!editedKeysRef.current.has("seo_title") && !next.seo_title && seoTitle) {
            next.seo_title = seoTitle;
            next.native_seo_title = seoTitle;
            originalMetaRef.current.seo_title = seoTitle;
            originalMetaRef.current.native_seo_title = seoTitle;
          }
          if (!editedKeysRef.current.has("shipping_weight_oz") && !next.shipping_weight_oz && liveShipOz) {
            next.shipping_weight_oz = liveShipOz;
            next.native_shipping_weight = liveShipOz;
            originalMetaRef.current.shipping_weight_oz = liveShipOz;
            originalMetaRef.current.native_shipping_weight = liveShipOz;
          }
          fullMetaStateRef.current = next;
          return next;
        });
      }
    }
  }, [productLoadFetcher.state, productLoadFetcher.data, selectedProductId]);

  const markKeyEdited = useCallback((key) => {
    editedKeysRef.current.add(key);
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
  }, []);

  const handleTitleBlur = useCallback((value) => {
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
    markKeyEdited(key);
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
    if (key === "weight_grams" || key === "shipping_weight_oz" || key === "native_shipping_weight") {
      updateWeightFields(key, value);
      return;
    }
    markKeyEdited(key);

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
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.material || fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_page_handle || fullMetaState.origin_handle || "";
    const product = products.find(p => p.id === selectedProductId);
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
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.material || fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_page_handle || fullMetaState.origin_handle || "";
    const product = products.find(p => p.id === selectedProductId);
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const RESCAN_PRESERVE_KEYS = [
      "shopify_title", "native_title",
      "origin_handle", "origin_page_handle", "collection_location", "collection_date",
      "stone_family", "surface_finish", "source_location",
      "piece_name", "dimensions_mm",
      "weight_grams", "shipping_weight_oz", "native_shipping_weight", "price", "native_price",
      "character_marks", "primary_medium",
      "secondary_medium", "treatment_status", "is_ooak", "is_one_of_a_kind", "treated",
      "material", "rescued_by", "alt_text",
      "found_object", "bail_included", "setting_ready",
      "jewelry_type", "necklace_design", "jewelry_finding_type", "wire_material",
      "chain_link_type", "target_gender"
    ];
    
    setFullMetaState(prev => Object.fromEntries(RESCAN_PRESERVE_KEYS.map(k => [k, prev[k] || ""])));
    setFormState(prev => Object.fromEntries(RESCAN_PRESERVE_KEYS.map(k => [k, prev[k] || ""])));
    setFullMetaState(prev => ({ ...prev, custom_product: prev.custom_product || "Yes" }));
    setFormState(prev => ({ ...prev, custom_product: prev.custom_product || "Yes" }));

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
    navigator.clipboard.writeText(JSON.stringify(fullMetaState, null, 2))
      .then(() => {
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Telemetry data copied to clipboard!");
        }
      })
      .catch(err => console.error("Failed to copy telemetry:", err));
  }, [fullMetaState]);

  const handleToggleStatus = useCallback(() => {
    if (!selectedProductId) return;
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
    if (!selectedProductId) return;
    setStatusMessage("");
    setWarningMessage("");
    setErrorMessage("");

    const selectedProduct = products.find(p => p.id === selectedProductId);
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

    // Build baseline nativeTargets from live manifest if loaded, else from product object
    const fallbackVariantsEdges = (selectedProduct.variants?.edges || []).map((e, idx) => {
      const vNode = e?.node || {};
      const wObj = vNode.inventoryItem?.measurement?.weight;
      return {
        node: {
          id: vNode.id || `gid://shopify/ProductVariant/${idx}`,
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
      /^gid:\/\/shopify\/ProductVariant\/\d+$/.test(fallbackVariantsEdges[0]?.node?.id || "");

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

      repairPlan[canonicalKey] = cleanVal;
      metadata[canonicalKey] = { source: "Manual", stage: "Tab2Review" };
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
      repairPlan["native_seo_description"] = proposedSeoDesc;
      metadata["native_seo_description"] = { source: "Manual", stage: "Tab2Review" };
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

    // 6. Canonical OOAK, Material, and Origin Page Handle
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
      "origin_story"
    ]);

    Object.entries(currentState).forEach(([rawKey, rawVal]) => {
      const bareKey = rawKey.replace(/^custom\./, "");
      if (SKIP_DIRECT_LOOP_KEYS.has(bareKey) || SKIP_DIRECT_LOOP_KEYS.has(rawKey)) return;
      if (RETIRED_TAB2_KEYS.has(bareKey) || RETIRED_TAB2_KEYS.has(rawKey)) return;
      if (rawKey.startsWith("std_") || rawKey.startsWith("shopify.") || rawKey.startsWith("native_")) return;
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
      setWarningMessage("No modified or new fields to save. Edit a field or run Auto-Fill before clicking Inject Metafields.");
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
            if (v !== undefined && v !== null && String(v).trim() !== "") {
              updated[k] = v;
              markKeyEdited(k);
            }
          });
          if (parsed.stone_family && !updated.material) {
            updated.material = parsed.stone_family;
            markKeyEdited("material");
          }
          if (parsed.origin_handle && !updated.origin_page_handle) {
            updated.origin_page_handle = parsed.origin_handle;
            markKeyEdited("origin_page_handle");
          }
          // Preserve operator-entered piece_name; only populate from parsed piece_name if currently blank
          if (!updated.piece_name || String(updated.piece_name).trim() === "") {
            const candidatePieceName =
              parsed.piece_name ||
              extractLegacyPieceNameIfSegmented(parsed.canonical_title || "");
            if (candidatePieceName) {
              updated.piece_name = candidatePieceName;
              markKeyEdited("piece_name");
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

      if (Object.keys(tab2Data).length > 0) {
        const applyAiUpdates = (prev) => {
          const updatedState = { ...prev };
          const ALWAYS_OVERWRITE = [
            "mohs_hardness", "moh_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", 
            "diaphaneity", "mineral_class", "crystal_system", "rock_composition", 
            "rock_formation", "geological_era", "geological_age", "generated_description", 
            "seo_title", "origin_story", "stone_story", "bail_included", 
            "setting_ready", "primary_medium", "alt_text", "found_object", 
            "secondary_medium", "surface_finish", "material", "treated", 
            "jewelry_type", "jewelry_finding_type", "wire_material"
          ];

          Object.entries(tab2Data).forEach(([key, val]) => {
            if (key === "weight_grams" || key === "shipping_weight_oz" || key === "piece_name" || key === "shopify_title" || key === "canonical_title" || key === "product_title") return;
            if (RETIRED_TAB2_KEYS.has(key) && key !== "color") return;

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
              
              if (key === "color") {
                if (!updatedState.primary_color || updatedState.primary_color.trim() === "") {
                  updatedState.primary_color = normalizedVal;
                  markKeyEdited("primary_color");
                }
              } else if (key === "is_ooak" || key === "is_one_of_a_kind") {
                updatedState.is_one_of_a_kind = normalizedVal;
                updatedState.is_ooak = normalizedVal;
                markKeyEdited("is_one_of_a_kind");
              } else if (key === "stone_family" || key === "material") {
                updatedState.material = normalizedVal;
                updatedState.stone_family = normalizedVal;
                markKeyEdited("material");
              } else if (key === "origin_handle" || key === "origin_page_handle") {
                updatedState.origin_page_handle = normalizedVal;
                updatedState.origin_handle = normalizedVal;
                markKeyEdited("origin_page_handle");
              } else if (key === "poetic_hook") {
                updatedState.native_seo_description = String(normalizedVal).trim();
                markKeyEdited("native_seo_description");
              } else {
                updatedState[key] = normalizedVal;
                markKeyEdited(key);
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

  const renderTemplateField = (field) => {
    const nativeEditableKeys = [
      "shopify_title", "native_title",
      "price", "native_price",
      "weight_grams", "shipping_weight_oz", "native_shipping_weight",
      "native_description", "native_seo_title", "native_seo_description"
    ];
    const isKnownKey = NAMESPACE_MAP.custom.includes(field.key) || nativeEditableKeys.includes(field.key);
    const isSupported = isKnownKey && !RETIRED_TAB2_KEYS.has(field.key) && field.namespace !== "shopify" && field.mappingStatus !== "pending_read_only";

    const stateKey =
      field.key === "native_title" ? "shopify_title" :
      field.key === "native_description" ? "generated_description" :
      field.key === "native_seo_title" ? "seo_title" :
      field.key === "native_price" ? "price" :
      field.key === "native_shipping_weight" ? "shipping_weight_oz" :
      field.key;

    let val = fullMetaState[stateKey] !== undefined && fullMetaState[stateKey] !== null
      ? fullMetaState[stateKey]
      : (fullMetaState[field.key] ?? "");
    
    if (field.key === "is_one_of_a_kind" && (val === "" || val === undefined) && fullMetaState.is_ooak) {
      val = fullMetaState.is_ooak;
    }
    if (field.key === "material" && (val === "" || val === undefined) && (fullMetaState.stone_family || fullMetaState.primary_medium)) {
      val = fullMetaState.stone_family || fullMetaState.primary_medium;
    }
    if (field.key === "origin_page_handle" && (val === "" || val === undefined) && fullMetaState.origin_handle) {
      val = fullMetaState.origin_handle;
    }

    if (typeof val === 'string' && val.startsWith('[')) {
      try {
        const arr = JSON.parse(val);
        val = Array.isArray(arr) ? arr[0] : val;
      } catch(e) {}
    } else if (typeof val === 'string' && val.startsWith('{')) {
      try {
        const obj = JSON.parse(val);
        val = JSON.stringify(obj);
      } catch(e) {}
    } else if (Array.isArray(val)) {
      val = val[0];
    } else if (typeof val === 'object' && val !== null) {
      val = JSON.stringify(val);
    }

    if (field.key === "rescued_by" && typeof val === 'string') {
      if (val.includes("Bob & Janyce") || val.includes("Rockhound Studio")) val = "Bob and Janyce";
    }
    if (field.key === "primary_medium" && val === "Stone") val = "";

    const reqKeys = ["shopify_title", "native_title", "piece_name", "price", "native_price", "weight_grams", "shipping_weight_oz", "native_shipping_weight", "material", "stone_family", "collection_name", "origin_page_handle", "origin_handle", "rescued_by", "treatment_status", "origin_story", "seo_title"];
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "false" && !(field.key === "collection_date" && /^(n\/a|none|unknown)$/i.test(String(val).trim()));
    const isRequiredEmpty = !isFilled && reqKeys.includes(field.key);
    const isEmpty = !isFilled;
    
    let dotFillColor = "#eab308";
    if (isFilled) dotFillColor = "#22c55e"; 
    if (isRequiredEmpty) dotFillColor = "#ef4444"; 

    const labelNode = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px', marginRight: '8px' }}>
          <circle cx="9" cy="9" r="9" fill={dotFillColor} />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>
          {field.label}
        </span>
      </div>
    );

    const displayVal = isSupported ? (field.key === "collection_date" && !isFilled ? "N/A" : val) : "Connection pending.";
    const isDisabled = !isSupported || (!isEmpty && val === "See Shopify metaobject" && field.key !== "shopify_title");
    const isMultiline = field.control === "multiline" || field.key.includes("story") || field.key.includes("notes") || field.key.includes("flaws") || field.key.includes("character") || field.key === "generated_description" || field.key === "native_description" || field.key === "native_seo_description";
    const optionsKey = field.optionsKey || field.key;

    return (
      <div key={field.key}>
        <div style={{ backgroundColor: isEmpty && isSupported ? "#FFF5F5" : "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
          {isSupported && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[optionsKey] && DROPDOWN_OPTIONS[optionsKey].length > 0 ? (
            <Select 
              label={labelNode} 
              options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[optionsKey] || [])]} 
              value={displayVal} 
              onChange={(v) => updateFullMetaState(stateKey, v)} 
              disabled={isDisabled} 
            />
          ) : (
            <TextField 
              label={labelNode} 
              value={displayVal} 
              onChange={(v) => { if (isSupported) updateFullMetaState(stateKey, v) }} 
              multiline={isMultiline ? true : false} 
              autoComplete="off" 
              disabled={isDisabled} 
              readOnly={!isSupported} 
            />
          )}
        </div>
      </div>
    );
  };

  const safeProducts = products || [];
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
                {selectedProductId && (
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
              
              <TextField label="Gemini Presentation Style" placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy." value={promptStyle} onChange={setPromptStyle} multiline={3} autoComplete="off" disabled={!selectedProductId} />

              {selectedProductId && (() => {
                const product = products.find(p => p.id === selectedProductId);
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
                <Button icon={MagicIcon} onClick={handleTab2AutoFill} size="large" fullWidth disabled={!selectedProductId} loading={tab2Fetcher.state !== "idle"}>RUN</Button>
                <Button icon={MagicIcon} onClick={handleFullRescan} size="large" fullWidth disabled={!selectedProductId} loading={tab2Fetcher.state !== "idle"} tone="success">Full Rescan</Button>
                <Button tone="critical" onClick={() => injectFetcher.submit({ intent: "cleanGhostNamespaces", productId: selectedProductId }, { method: "post", action: "/app/meta-injector-api" })} size="large" fullWidth disabled={!selectedProductId} loading={injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "cleanGhostNamespaces"}>Wipe Ghosts</Button>
                <Button icon={ClipboardIcon} onClick={handleCopyTelemetry} size="large" fullWidth disabled={!selectedProductId}>Copy Telemetry</Button>
                <Button icon={SaveIcon} tone="success" variant="primary" onClick={handleInject} size="large" fullWidth disabled={!selectedProductId} loading={isSaving}>Inject Metafields</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </div>

      {selectedProductId !== "" && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">
              {tab2StatusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{tab2StatusMessage}</Text></Banner>}
              {tab2ErrorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{tab2ErrorMessage}</Text></Banner>}
              {injectFetcher.state === "idle" && injectFetcher.data?.message?.includes("Cleaned") && <Banner title="Ghosts Cleaned" tone="success"><Text as="p">{injectFetcher.data.message}</Text></Banner>}

              <Text as="h3" variant="headingLg">Full Meta Report — Standard 60+ Fields</Text>

              {PRODUCT_TEMPLATE_GROUPS.map((group, groupIdx) => (
                <BlockStack gap="300" key={groupIdx}>
                  <Text as="h4" variant="headingMd" tone={group.color === "success" ? "success" : undefined}>
                    {group.heading}
                  </Text>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {group.fields.map(renderTemplateField)}
                  </div>
                </BlockStack>
              ))}

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
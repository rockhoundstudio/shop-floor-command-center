import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, DropZone } from "@shopify/polaris";
import { MagicIcon, SaveIcon, ClipboardIcon } from "@shopify/polaris-icons";
import { DROPDOWN_OPTIONS, FULL_META_GROUPS, getFieldStatus, ROCKHOUND_FIELDS, PRODUCT_TEMPLATE_GROUPS } from "../utils/meta-injector.constants.jsx";
import { useFetcher } from "react-router";

const CUSTOM_FIELDS = [
  { key: "shopify_title", label: "MASTER SHOPIFY TITLE (Edit Here)", type: "single_line_text_field", isShared: false },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field", isShared: true },
  { key: "surface_finish", label: "Surface Finish", type: "single_line_text_field", isShared: true }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field", isShared: true },
  { key: "primary_use", label: "Primary Use", type: "single_line_text_field", isShared: true }, 
  { key: "origin_story", label: "The Origin Story", type: "multi_line_text_field", multiline: true, isShared: true },
  { key: "stone_story", label: "Stone Story", type: "multi_line_text_field", multiline: true, isShared: true },
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "official_name", label: "Official Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_type", label: "Cut Type", type: "single_line_text_field", isPerPiece: true },
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field", isPerPiece: true },
  { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "single_line_text_field", isPerPiece: true },
  { key: "honest_flaws_and_character", label: "Honest Flaws & Character", type: "multi_line_text_field", multiline: true, isPerPiece: true },
  { key: "character_marks", label: "Character Marks", type: "multi_line_text_field", multiline: true, isPerPiece: true },
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
    "collection_name", "collection_location", "seo_title", "authenticity",
    "rarity", "secondary_medium", "jewelry_type", "necklace_design",
    "jewelry_finding_type", "color_pattern", "material", "generated_description",
    "primary_medium", "setting_ready",
    "bail_included", "chain_material", "geological_era",
    "mineral_class", "rock_formation", "geological_age", "treated", "is_ooak",
    "age_group", "target_gender", "condition", "google_product_category",
    "alt_text", "weight_grams", "shipping_weight_oz", "price",
    "rescued_by", "honest_flaws_and_character",
    "custom_product", "found_object", "chain_link_type"
  ]
};

export function IntakeBenchTab({ products, injectFetcher, tab2Fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const originalMetaRef = useRef({});
  const fullMetaStateRef = useRef({});
  const lastProcessedAiData = useRef(null);
  const lastAutofilledTitle = useRef("");
  
  const [statusMessage, setStatusMessage] = useState("");
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
    setErrorMessage("");
    setTab2StatusMessage("");
    setTab2ErrorMessage("");
    setOverridePhoto(null);
    
    setFormState({});
    setFullMetaState({});
    fullMetaStateRef.current = {};
    originalMetaRef.current = {};
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
          // Do not load retired legacy values into the state mapping
          if (["artist_notes", "bench_notes", "handcrafted_by", "color", "cut_and_shape", "stone_shape", "wire_material"].includes(node.key)) {
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
          
          const booleanKeys = ["is_ooak", "found_object", "custom_product", "treated"];
          if (booleanKeys.includes(node.key) && parsedValue !== "See Shopify metaobject") {
            const lowerVal = parsedValue.toLowerCase().trim();
            if (lowerVal === "true" || lowerVal === "yes") parsedValue = "Yes";
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

    if (!newFullForm.target_gender) newFullForm.target_gender = "Unisex";
    if (!newFullForm.age_group) newFullForm.age_group = "adult";
    if (!newFullForm.condition) newFullForm.condition = "new";
    if (!newFullForm.google_product_category) newFullForm.google_product_category = "Apparel & Accessories > Jewelry";
    
    if (!newFullForm.shipping_weight_oz && newFullForm.weight_grams) {
      const grams = parseFloat(newFullForm.weight_grams);
      if (!isNaN(grams) && grams > 0) {
        const oz = String(Math.ceil((grams / 28.3495) + 0.5));
        newFullForm.shipping_weight_oz = oz;
        newForm.shipping_weight_oz = oz;
      }
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

    if (product && product.title) {
      newForm.piece_name = product.title.includes(" — ") ? product.title.split(" — ").pop().trim() : product.title;
      newFullForm.piece_name = product.title.includes(" — ") ? product.title.split(" — ").pop().trim() : product.title;
    }

    if (product && product.variants && product.variants.edges && product.variants.edges[0]) {
      const price = product.variants.edges[0].node.price;
      if (price) { 
        newForm.price = price; 
        newFullForm.price = price; 
      }
    }

    const seoTitleNode = allEdges.find(e => e.node.key === "seo_title" || e.node.key === "title_tag")?.node;
    if (seoTitleNode && seoTitleNode.value) {
      newFullForm.seo_title = seoTitleNode.value;
    }
    
    setFormState(newForm);
    setFullMetaState(newFullForm);
    fullMetaStateRef.current = newFullForm;
    originalMetaRef.current = { ...newFullForm };
  }, [products]);

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
    let newShippingOz = "";

    if (key === "weight_grams") {
      const parsedG = parseFloat(value);
      if (!isNaN(parsedG) && parsedG > 0) {
        newShippingOz = String(Math.ceil((parsedG / 28.3495) + 0.5));
      }
      
      setFormState(prev => ({
        ...prev,
        [key]: value,
        ...(newShippingOz ? { shipping_weight_oz: newShippingOz } : {})
      }));

      setFullMetaState(prev => ({
        ...prev,
        [key]: value,
        ...(newShippingOz ? { shipping_weight_oz: newShippingOz } : {})
      }));

      fullMetaStateRef.current = {
        ...fullMetaStateRef.current,
        [key]: value,
        ...(newShippingOz ? { shipping_weight_oz: newShippingOz } : {})
      };
    } else {
      setFormState(prev => ({ ...prev, [key]: value }));
      setFullMetaState(prev => ({ ...prev, [key]: value }));
      fullMetaStateRef.current = { ...fullMetaStateRef.current, [key]: value };
    }
  }, []);

  const updateFullMetaState = useCallback((key, value) => {
    if (key === "weight_grams" || key === "shipping_weight_oz") {
      updateWeightFields(key, value);
      return;
    }
    setFullMetaState(prev => ({ ...prev, [key]: value }));
    setFormState(prev => ({ ...prev, [key]: value }));
    
    fullMetaStateRef.current = { ...fullMetaStateRef.current, [key]: value };
  }, [updateWeightFields]);

  const handleTab2AutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_handle || fullMetaState.origin_page_handle || "";
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

    const stoneFamily = fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_handle || fullMetaState.origin_page_handle || "";
    const product = products.find(p => p.id === selectedProductId);
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const RESCAN_PRESERVE_KEYS = [
      "shopify_title",
      "origin_handle", "origin_page_handle", "collection_location",
      "stone_family", "surface_finish", "source_location",
      "primary_use", "piece_name", "dimensions_mm",
      "weight_grams", "shipping_weight_oz", "price", "character_marks", "primary_medium",
      "secondary_medium", "treatment_status", "is_ooak", "treated",
      "material", "rescued_by", "alt_text",
      "found_object", "bail_included", "setting_ready",
      "jewelry_type", "necklace_design", "jewelry_finding_type",
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
    setErrorMessage("");

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const masterTitle = fullMetaStateRef.current.shopify_title || formState.shopify_title || selectedProduct?.title || "";
    const resolvedPieceName = masterTitle.includes(" — ") ? masterTitle.split(" — ").pop().trim() : masterTitle;
    
    const allowedKeys = NAMESPACE_MAP.custom;
    const payload = [];

    const activeWeights = {
      weight_grams: fullMetaStateRef.current.weight_grams || formState.weight_grams || "",
      shipping_weight_oz: fullMetaStateRef.current.shipping_weight_oz || formState.shipping_weight_oz || ""
    };

    const combinedState = { ...fullMetaStateRef.current, ...activeWeights };

    Object.entries(combinedState).forEach(([key, value]) => {
      if (key === "shopify_title") return; 
      if (!allowedKeys.includes(key)) return;

      // EXPLICITLY PREVENT RETIRED FIELDS AND PRIMARY_USE FROM SAVING
      if (["artist_notes", "bench_notes", "handcrafted_by", "color", "cut_and_shape", "stone_shape", "wire_material", "primary_use"].includes(key)) {
        return;
      }

      let injectValue = String(value !== null && value !== undefined ? value : "");
      if (key === "piece_name") injectValue = resolvedPieceName;

      injectValue = injectValue.trim();

      const config = CUSTOM_FIELDS.find(f => f.key === key);
      let fieldType = config && config.type ? config.type : "single_line_text_field";
      
      if (["honest_flaws_and_character", "origin_story", "stone_story", "generated_description", "character_marks"].includes(key)) {
        fieldType = "multi_line_text_field";
      }

      const isPopulated = injectValue !== "" && injectValue !== "N/A";
      
      if (isPopulated && injectValue !== "See Shopify metaobject") {
        let formatId = selectedProductId.includes("gid://") ? selectedProductId : `gid://shopify/Product/${selectedProductId}`;
        
        payload.push({
          namespace: "custom", 
          key: key.replace(/-/g, "_"),
          type: fieldType,
          value: injectValue,
          ownerId: formatId
        });
      }
    });

    if (payload.length === 0 && !masterTitle) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    const descHtml = payload.find(p => p.key === "generated_description")?.value || "";

    injectFetcher.submit(
      { 
        intent: "saveMetafields", 
        payload: JSON.stringify(payload),
        productId: selectedProductId,
        productTitle: masterTitle,
        descriptionHtml: descHtml,
        weightGrams: activeWeights.weight_grams,
        shippingWeightOz: activeWeights.shipping_weight_oz
      },
      { method: "post", action: "/app/meta-injector-api" }
    );
  }, [selectedProductId, formState, products, injectFetcher, fullMetaStateRef]);

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
          const updated = { ...prev, ...parsed };
          if (parsed.canonical_title) updated.shopify_title = parsed.canonical_title;
          fullMetaStateRef.current = updated;
          return updated;
        });
        setFormState(prev => ({ ...prev, shopify_title: parsed.canonical_title || prev.shopify_title }));
        setTab2StatusMessage("Title parsed — Geo-Vault & Dwell Web loaded");
        if (window.shopify?.toast) window.shopify.toast.show("Title parsed!");
        return;
      }

      const product = products.find(p => p.id === selectedProductId);
      const productTitle = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
      const tab2Data = tab2Fetcher.data.tab2Data || {};
      if (tab2Fetcher.data.generated_description) tab2Data.generated_description = tab2Fetcher.data.generated_description;

      if (Object.keys(tab2Data).length > 0) {
        setFormState(prev => {
          const updatedState = { ...prev };
          Object.entries(tab2Data).forEach(([key, val]) => {
            if (key === "weight_grams" || key === "shipping_weight_oz") return;
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            if (hasNewValue) {
              let normalizedVal = val;
              const booleanKeys = ["is_ooak", "found_object", "custom_product", "treated"];
              if (booleanKeys.includes(key)) {
                const lowerVal = String(val).toLowerCase().trim();
                if (lowerVal === "true" || lowerVal === "yes") normalizedVal = "Yes";
                else if (lowerVal === "false" || lowerVal === "no") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });
          fullMetaStateRef.current = updatedState;
          return updatedState;
        });

        setFullMetaState(prev => {
          const updatedState = { ...prev };
          const ALWAYS_OVERWRITE = [
            "mohs_hardness", "moh_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", 
            "diaphaneity", "mineral_class", "crystal_system", "rock_composition", 
            "rock_formation", "geological_era", "geological_age", "generated_description", 
            "seo_title", "origin_story", "stone_story", "primary_use", "bail_included", 
            "setting_ready", "primary_medium", "alt_text", "found_object", 
            "secondary_medium", "surface_finish", "material", "treated", 
            "jewelry_type", "jewelry_finding_type"
          ];

          Object.entries(tab2Data).forEach(([key, val]) => {
            if (key === "weight_grams" || key === "shipping_weight_oz") return;

            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            const currentlyEmpty = !updatedState[key] || updatedState[key].toString().trim() === "";
            
            if (hasNewValue && (currentlyEmpty || ALWAYS_OVERWRITE.includes(key))) {
              let normalizedVal = val;
              const booleanKeys = ["is_ooak", "found_object", "custom_product", "treated"];
              if (booleanKeys.includes(key)) {
                const lowerVal = String(val).toLowerCase().trim();
                if (lowerVal === "true" || lowerVal === "yes") normalizedVal = "Yes";
                else if (lowerVal === "false" || lowerVal === "no") normalizedVal = "No";
              }
              
              // Protect previously corrected primary_color from legacy custom.color payloads
              if (key === "color") {
                 if (!updatedState.primary_color || updatedState.primary_color.trim() === "") {
                     updatedState.primary_color = normalizedVal;
                 }
              } else {
                 updatedState[key] = normalizedVal;
              }
            }
          });

          if (productTitle) updatedState.piece_name = productTitle.includes(" — ") ? productTitle.split(" — ").pop().trim() : productTitle;
          fullMetaStateRef.current = updatedState;

          const REQUIRED_TAB2_FIELDS = [{ key: "generated_description", label: "Generated Description" }, { key: "color_pattern", label: "Color Pattern" }, { key: "collection_location", label: "Collection Location" }, { key: "origin_handle", label: "Origin Handle" }];
          const missingFields = REQUIRED_TAB2_FIELDS.filter(f => {
            const val = updatedState[f.key] || "";
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

          fullMetaStateRef.current = updatedState;
          return updatedState;
        });

        setTab2StatusMessage("Auto-Fill complete — review fields before saving");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill complete!");
      } else {
        setTab2ErrorMessage("Auto-Fill returned no data — check stone_family and origin_handle.");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill failed", { isError: true });
      }
    }
  }, [tab2Fetcher.state, tab2Fetcher.data, selectedProductId, products]);

  const handleFixPopupConfirm = useCallback(() => {
    const field = pendingFixFields[currentFixIndex];
    if (field && fixPopupValue.trim() !== "") {
      setFormState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
      setFullMetaState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
      fullMetaStateRef.current = { ...fullMetaStateRef.current, [field.key]: fixPopupValue.trim() };
    }
    const nextIndex = currentFixIndex + 1;
    if (nextIndex < pendingFixFields.length) {
      setCurrentFixIndex(nextIndex);
      setFixPopupValue("");
    } else {
      setShowFixPopup(false); setPendingFixFields([]); setCurrentFixIndex(0); setFixPopupValue("");
    }
  }, [pendingFixFields, currentFixIndex, fixPopupValue]);

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
    const retiredFields = ["artist_notes", "bench_notes", "handcrafted_by", "color", "cut_and_shape", "stone_shape", "wire_material", "primary_use"];
    const isKnownKey = NAMESPACE_MAP.custom.includes(field.key) || ["shopify_title", "price", "weight_grams", "shipping_weight_oz"].includes(field.key);
    const isSupported = isKnownKey && !retiredFields.includes(field.key);

    let val = fullMetaState[field.key] !== undefined && fullMetaState[field.key] !== null ? fullMetaState[field.key] : "";
    
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

    const reqKeys = ["shopify_title", "piece_name", "price", "weight_grams", "shipping_weight_oz", "material", "stone_family", "collection_name", "origin_handle", "rescued_by", "treatment_status", "origin_story", "seo_title"];
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "false";
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

    const displayVal = isSupported ? val : "Connection pending.";
    const isDisabled = !isSupported || (!isEmpty && val === "See Shopify metaobject" && field.key !== "shopify_title");
    const isMultiline = field.control === "multiline" || field.key.includes("story") || field.key.includes("notes") || field.key.includes("flaws") || field.key.includes("character") || field.key === "generated_description";

    return (
      <div key={field.key}>
        <div style={{ backgroundColor: isEmpty && isSupported ? "#FFF5F5" : "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
          {isSupported && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
            <Select 
              label={labelNode} 
              options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]} 
              value={displayVal} 
              onChange={(v) => updateFullMetaState(field.key, v)} 
              disabled={isDisabled} 
            />
          ) : (
            <TextField 
              label={labelNode} 
              value={displayVal} 
              onChange={(v) => { if (isSupported) updateFullMetaState(field.key, v) }} 
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

              {statusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{statusMessage}</Text></Banner>}
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
                      onChange={(val) => { 
                        setFormState(prev => ({ ...prev, shopify_title: val })); 
                        setFullMetaState(prev => ({ ...prev, shopify_title: val })); 
                        fullMetaStateRef.current = { ...fullMetaStateRef.current, shopify_title: val }; 
                      }} 
                      onBlur={() => handleTitleBlur(formState.shopify_title || fullMetaState.shopify_title || product?.title || "")}
                      autoComplete="off" 
                      helpText="Format: Stone Family — Origin Location — Piece Name" 
                    />
                    <TextField label="Origin Handle (override)" value={formState.origin_handle || fullMetaState.origin_handle || ""} onChange={(val) => { setFormState(prev => ({ ...prev, origin_handle: val })); setFullMetaState(prev => ({ ...prev, origin_handle: val })); fullMetaStateRef.current = { ...fullMetaStateRef.current, origin_handle: val }; }} autoComplete="off" helpText="e.g. the-richardson-strike — leave blank to auto-resolve from title" />
                    
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
                <Button icon={SaveIcon} tone="success" variant="primary" onClick={handleInject} size="large" fullWidth disabled={!selectedProductId} loading={injectFetcher.state !== "idle" && (injectFetcher.formData?.get("intent") === "saveProduct" || injectFetcher.formData?.get("intent") === "saveMetafields")}>Inject Metafields</Button>
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
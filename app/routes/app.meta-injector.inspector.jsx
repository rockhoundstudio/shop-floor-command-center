// ==========================================================================
// ROCKHOUND STUDIO — TAB 2: META INSPECTOR Bench
// File: app/routes/app.meta-injector.inspector.jsx
// ==========================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, DropZone } from "@shopify/polaris";
import { MagicIcon, SaveIcon, ClipboardIcon } from "@shopify/polaris-icons";
import { DROPDOWN_OPTIONS, FULL_META_GROUPS, getFieldStatus, ROCKHOUND_FIELDS } from "../utils/meta-injector.constants.jsx";

const CUSTOM_FIELDS = [
  { key: "shopify_title", label: "MASTER SHOPIFY TITLE (Edit Here)", type: "single_line_text_field", isShared: false },
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field", isShared: true },
  { key: "color", label: "Color", type: "single_line_text_field", isShared: true }, 
  { key: "surface_finish", label: "Surface Finish", type: "single_line_text_field", isShared: true }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field", isShared: true },
  { key: "primary_use", label: "Primary Use", type: "single_line_text_field", isShared: true }, 
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field", isShared: true },
  { key: "origin_story", label: "The Origin Story", type: "multi_line_text_field", multiline: true, isShared: true },
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_and_shape", label: "Cut / Shape", type: "single_line_text_field", isPerPiece: true }, 
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field", isPerPiece: true },
  { key: "shipping_weight_oz", label: "Shipping Weight (oz)", type: "single_line_text_field", isPerPiece: true },
  { key: "honest_flaws_and_character", label: "Character Marks (Honest Flaws)", type: "multi_line_text_field", multiline: true, isPerPiece: true },
  { key: "price", label: "Price", type: "single_line_text_field", isPerPiece: true },
  { key: "generated_description", label: "Generated Description", type: "multi_line_text_field", multiline: true, isPerPiece: true }
];

// 🔴 THE MASTER LIST: Everything locked strictly to custom
const NAMESPACE_MAP = {
  custom: [
    "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "stone_family", "color", "cut_and_shape", "surface_finish", "dimensions_mm", "weight_grams", "shipping_weight_oz", "price", "collection_name", "collection_location", "primary_use", "bail_included", "is_ooak", "treated", "wire_material", "setting_ready", "material", "origin_story", "origin_handle", "honest_flaws_and_character", "artist_notes", "generated_description", "rescued_by", "stone_shape", "target_gender", "age_group", "condition", "color_pattern", "jewelry_type", "necklace_design", "custom_product", "seo_title", "google_product_category",
    "mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "crystal_system", "geological_era", "geological_age", "mineral_class", "rock_composition", "rock_formation",
    "character_marks", "bench_notes", "alt_text", "found_object", "treatment_status", "origin_location", "origin_page_handle", "primary_color", "rarity", "authenticity", "jewelry_finding_type", "chain_link_type"
  ]
};

export function IntakeBenchTab({ products, injectFetcher, tab2Fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const originalMetaRef = useRef({});
  const fullMetaStateRef = useRef({});
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

    const product = products.find(p => p.id === id);
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
          let parsedValue = String(node.value);
          if (parsedValue.includes("gid://")) parsedValue = "See Shopify metaobject";
          if (parsedValue.startsWith("[")) {
            try {
              const arr = JSON.parse(parsedValue);
              parsedValue = Array.isArray(arr) ? arr[0] : parsedValue;
            } catch (e) { }
          }
          newForm[node.key] = parsedValue;
          newFullForm[node.key] = parsedValue;
        }
      });
    }

    // 🔴 PHYSICAL LIVE VARIANT WEIGHT INGESTION
    const firstVariant = product?.variants?.edges?.[0]?.node;
    if (firstVariant && firstVariant.weight !== undefined && firstVariant.weight !== null) {
      const vWeight = parseFloat(firstVariant.weight);
      const vUnit = String(firstVariant.weightUnit || "OUNCES").toUpperCase();
      let derivedGrams = 0;
      let derivedOz = 0;

      if (vUnit.includes("OUNCE") || vUnit === "OZ") {
        derivedOz = vWeight;
        derivedGrams = Math.round(vWeight * 28.3495);
      } else if (vUnit.includes("GRAM") || vUnit === "G") {
        derivedGrams = Math.round(vWeight);
        derivedOz = parseFloat((vWeight / 28.3495).toFixed(2));
      }

      if (!newFullForm.weight_grams && derivedGrams > 0) {
        newForm.weight_grams = String(derivedGrams);
        newFullForm.weight_grams = String(derivedGrams);
      }
      if (!newFullForm.shipping_weight_oz && derivedOz > 0) {
        const roundedOz = String(Math.ceil(derivedOz + 0.5));
        newForm.shipping_weight_oz = roundedOz;
        newFullForm.shipping_weight_oz = roundedOz;
      }
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
    if (!newFullForm.handcrafted_by) newFullForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
    
    if (!newFullForm.shipping_weight_oz && newFullForm.weight_grams) {
      const grams = parseFloat(newFullForm.weight_grams);
      if (!isNaN(grams) && grams > 0) {
        const oz = String(Math.ceil((grams / 28.35) + 0.5));
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
    if (newForm.color) newFullForm.color = newForm.color;

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
    
    delete newFullForm.stone_story;
    setFormState(newForm);
    setFullMetaState(newFullForm);
    fullMetaStateRef.current = newFullForm;
    originalMetaRef.current = { ...newFullForm };
  }, [products]);

  const updateWeightFields = useCallback((key, value) => {
    let newWeightGrams = "";
    let newShippingOz = "";

    if (key === "weight_grams") {
      newWeightGrams = value;
      const parsedG = parseFloat(value);
      if (!isNaN(parsedG) && parsedG > 0) {
        newShippingOz = String(Math.ceil((parsedG / 28.35) + 0.5));
      }
    } else if (key === "shipping_weight_oz") {
      newShippingOz = value;
      const parsedOz = parseFloat(value);
      if (!isNaN(parsedOz) && parsedOz > 0) {
        newWeightGrams = String(Math.round(parsedOz * 28.3495));
      }
    }

    setFormState(prev => ({
      ...prev,
      [key]: value,
      ...(key === "weight_grams" && newShippingOz ? { shipping_weight_oz: newShippingOz } : {}),
      ...(key === "shipping_weight_oz" && newWeightGrams ? { weight_grams: newWeightGrams } : {})
    }));

    setFullMetaState(prev => ({
      ...prev,
      [key]: value,
      ...(key === "weight_grams" && newShippingOz ? { shipping_weight_oz: newShippingOz } : {}),
      ...(key === "shipping_weight_oz" && newWeightGrams ? { weight_grams: newWeightGrams } : {})
    }));
  }, []);

  const updateFullMetaState = useCallback((key, value) => {
    if (key === "weight_grams" || key === "shipping_weight_oz") {
      updateWeightFields(key, value);
      return;
    }
    setFullMetaState(prev => ({ ...prev, [key]: value }));
    setFormState(prev => ({ ...prev, [key]: value }));
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
    formData.append("cut_and_shape", fullMetaState.cut_and_shape || "");
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);

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
      "stone_family", "color", "surface_finish", "source_location",
      "primary_use", "handcrafted_by", "origin_story",
      "piece_name", "cut_and_shape", "dimensions_mm",
      "weight_grams", "shipping_weight_oz", "honest_flaws_and_character", "artist_notes",
      "price", "bench_notes", "character_marks", "primary_medium",
      "secondary_medium", "treatment_status", "is_ooak", "treated",
      "material", "stone_shape", "rescued_by", "alt_text",
      "found_object", "wire_material", "bail_included", "setting_ready",
      "jewelry_type", "necklace_design", "jewelry_finding_type",
      "chain_link_type", "target_gender", "mohs_hardness", "luster",
      "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity",
      "crystal_system", "geological_era", "geological_age", "mineral_class",
      "rock_composition", "rock_formation"
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
    formData.append("cut_and_shape", fullMetaState.cut_and_shape || "");
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);
    formData.append("honest_flaws_and_character", fullMetaState.honest_flaws_and_character || "");
    formData.append("price", fullMetaState.price || "");

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

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const masterTitle = fullMetaState.shopify_title || formState.shopify_title || selectedProduct?.title || "";
    const resolvedPieceName = masterTitle.includes(" — ") ? masterTitle.split(" — ").pop().trim() : masterTitle;
    
    const allowedKeys = NAMESPACE_MAP.custom;
    const payload = [];

    // Ensure weights are explicitly bound into state snapshot
    const activeWeights = {
      weight_grams: fullMetaState.weight_grams || formState.weight_grams || "",
      shipping_weight_oz: fullMetaState.shipping_weight_oz || formState.shipping_weight_oz || ""
    };

    const combinedState = { ...fullMetaState, ...fullMetaStateRef.current, ...activeWeights };

    Object.entries(combinedState).forEach(([key, value]) => {
      if (key === "shopify_title") return; 
      if (!allowedKeys.includes(key)) return;

      let injectValue = String(value !== null && value !== undefined ? value : "");
      if (key === "piece_name") injectValue = resolvedPieceName;

      // Clean line breaks
      injectValue = injectValue.replace(/\\[rn]/g, " ").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

      const config = CUSTOM_FIELDS.find(f => f.key === key);
      let fieldType = config && config.type ? config.type : "single_line_text_field";
      
      if (["honest_flaws_and_character", "origin_story", "generated_description", "artist_notes"].includes(key)) {
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
        descriptionHtml: descHtml, // Passes to bodyHtml in the API
        weightGrams: activeWeights.weight_grams,
        shippingWeightOz: activeWeights.shipping_weight_oz
      },
      { method: "post", action: "/app/meta-injector-api" }
    );
  }, [selectedProductId, formState, products, injectFetcher, fullMetaState]);

  useEffect(() => {
    const isIdle = tab2Fetcher.state === "idle";
    const hasData = tab2Fetcher.data !== undefined && tab2Fetcher.data !== null;

    if (isIdle && hasData) {
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
              if (key === "treated" || key === "is_ooak") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });
          return updatedState;
        });

        setFullMetaState(prev => {
          const updatedState = { ...prev };
          const ALWAYS_OVERWRITE = ["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age", "generated_description", "seo_title", "origin_story", "stone_story", "primary_use", "bail_included", "setting_ready", "primary_medium", "alt_text"];

          Object.entries(tab2Data).forEach(([key, val]) => {
            // NEVER allow AI autofill scans to overwrite manual bench weights
            if (key === "weight_grams" || key === "shipping_weight_oz") return;

            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            const currentlyEmpty = !updatedState[key] || updatedState[key].toString().trim() === "";
            
            if (hasNewValue && (currentlyEmpty || ALWAYS_OVERWRITE.includes(key))) {
              let normalizedVal = val;
              if (key === "treated" || key === "is_ooak") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });

          if (productTitle) updatedState.piece_name = productTitle.includes(" — ") ? productTitle.split(" — ").pop().trim() : productTitle;

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

  useEffect(() => {
    const isIdle = injectFetcher.state === "idle";
    const hasData = injectFetcher.data !== undefined && injectFetcher.data !== null;
    if (isIdle && hasData) {
      if (injectFetcher.data.success) {
        setStatusMessage("Data cleanly locked into Shopify database.");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Update successful!");
      } else {
        setErrorMessage(injectFetcher.data.message || injectFetcher.data.error || "An unknown error occurred");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Action failed", { isError: true });
      }
    }
  }, [injectFetcher.state, injectFetcher.data]);

  const handleFixPopupConfirm = useCallback(() => {
    const field = pendingFixFields[currentFixIndex];
    if (field && fixPopupValue.trim() !== "") {
      setFormState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
      setFullMetaState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
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

  const renderFullMetaField = (key) => {
    let field = null;
    for (const group of FULL_META_GROUPS) {
      const found = group.fields.find(f => f.key === key);
      if (found) { field = found; break; }
    }
    if (!field) {
      const rf = CUSTOM_FIELDS.find(f => f.key === key);
      if (rf) field = rf; 
    }
    if (!field) {
      field = { key: key, label: key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), type: 'text', multiline: key.includes("story") || key.includes("notes") || key.includes("flaws") || key.includes("character") || key === "generated_description" };
    }

    let val = fullMetaState[field.key] !== undefined && fullMetaState[field.key] !== null ? fullMetaState[field.key] : "";
    if (typeof val === 'string' && val.startsWith('[')) { 
      try { 
        const arr = JSON.parse(val); 
        val = Array.isArray(arr) ? arr[0] : val; 
      } catch(e) {} 
    } else if (Array.isArray(val)) { 
      val = val[0]; 
    }

    if ((field.key === "handcrafted_by" || field.key === "rescued_by") && typeof val === 'string') {
      if (val.includes("Bob & Janyce") || val.includes("Rockhound Studio")) val = "Bob & Janyce, Rockhound Studio";
    }
    if (field.key === "primary_medium" && val === "Stone") val = "";
    if (field.key === "color" && formState.color) val = formState.color;

    const reqKeys = ["shopify_title", "piece_name", "price", "weight_grams", "shipping_weight_oz", "material", "stone_family", "collection_name", "origin_handle", "rescued_by", "treatment_status", "origin_story", "primary_use", "seo_title"];
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
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{field.label}</span>
      </div>
    );

    return (
      <div key={field.key}>
        <div style={{ backgroundColor: isEmpty ? "#FFF5F5" : "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
          {field.type !== "text" && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
            <Select label={labelNode} options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]} value={val} onChange={(v) => updateFullMetaState(field.key, v)} accessibilityLabel={field.label} />
          ) : (
            <TextField label={labelNode} value={val} onChange={(v) => updateFullMetaState(field.key, v)} accessibilityLabel={field.label} multiline={field.multiline ? true : false} autoComplete="off" disabled={!isEmpty && val === "See Shopify metaobject" && field.key !== "shopify_title"} />
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
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredProducts.map(p => (
                  <div key={p.id} style={{ minHeight: "54px" }}>
                    <Button fullWidth size="large" textAlign="left" variant={selectedProductId === p.id ? "primary" : "secondary"} onClick={() => handleSelectProduct(p.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {p.images?.edges?.[0]?.node?.url ? <img src={p.images.edges[0].node.url} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} /> : <div style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }} />}
                        <span>{p.title}</span>
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
              <Text as="h2" variant="headingMd">2. Data Sieve & Injection</Text>
              {statusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{statusMessage}</Text></Banner>}
              {errorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{errorMessage}</Text></Banner>}
              
              <TextField label="Gemini Presentation Style" placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy." value={promptStyle} onChange={setPromptStyle} multiline={3} autoComplete="off" disabled={!selectedProductId} />

              {selectedProductId && (() => {
                const product = products.find(p => p.id === selectedProductId);
                return (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Review before running — edit if legacy data is incorrect:</Text>
                    <TextField label="Product Title" value={formState.shopify_title || fullMetaState.shopify_title || product?.title || ""} onChange={(val) => { setFormState(prev => ({ ...prev, shopify_title: val })); setFullMetaState(prev => ({ ...prev, shopify_title: val })); }} autoComplete="off" helpText="Format: Stone Family — Origin Location — Piece Name" />
                    <TextField label="Origin Handle (override)" value={formState.origin_handle || fullMetaState.origin_handle || ""} onChange={(val) => { setFormState(prev => ({ ...prev, origin_handle: val })); setFullMetaState(prev => ({ ...prev, origin_handle: val })); }} autoComplete="off" helpText="e.g. the-richardson-strike — leave blank to auto-resolve from title" />
                    
                    <div style={{ marginTop: "16px" }}>
                      <Text variant="headingMd" as="h3" fontWeight="bold">Upload New Hero Photo (overrides Shopify image for rescan)</Text>
                      {overridePhoto ? (
                        <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                          <img src={overridePhoto.previewUrl} alt="Override preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
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

              <Text as="h3" variant="headingLg">Full Meta Report</Text>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 1 — Core Ignition</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["shopify_title", "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_ooak", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price", "character_marks", "bench_notes", "alt_text", "found_object", "stone_family", "treatment_status"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 2 — Human Engine</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character", "origin_location", "origin_page_handle"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 3 — Google Machine</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "target_gender", "age_group", "condition", "custom_product", "seo_title", "google_product_category", "primary_color", "rarity", "authenticity", "jewelry_finding_type", "chain_link_type"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 4 — Geo-Vault</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"].map(renderFullMetaField)}
                </div>
              </BlockStack>

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
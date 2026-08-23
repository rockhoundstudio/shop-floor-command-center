// ==========================================================================
// ROCKHOUND STUDIO — TAB 1: NEW PRODUCT INTAKE Bench
// File: app/routes/app.meta-injector.injector.jsx
// (100% Original Logic + useRef Stale Closure Bypass for Dwell Web)
// ==========================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, Banner, TextField, Select, Button, InlineStack, Collapsible } from "@shopify/polaris";
import { MagicIcon, SaveIcon } from "@shopify/polaris-icons";
import { normalizeDropdownValue, DROPDOWN_OPTIONS, unwrapArrayValue, CHANNEL_REQUIREMENTS, getFieldStatus } from "../utils/meta-injector.constants.jsx";

const CUSTOM_FIELDS = [
  // ==========================================
  // SECTION A: SHARED BATCH FIELDS (The Story & Material)
  // ==========================================
  { key: "stone_family", label: "Stone Family", type: "single_line_text_field", isShared: true },
  { key: "color", label: "Color", type: "single_line_text_field", isShared: true }, 
  { key: "surface_finish", label: "Surface Finish", type: "single_line_text_field", isShared: true }, 
  { key: "source_location", label: "Source / Discovery Location", type: "single_line_text_field", isShared: true },
  { key: "primary_use", label: "Primary Use", type: "single_line_text_field", isShared: true }, 
  { key: "handcrafted_by", label: "Handcrafted By", type: "single_line_text_field", isShared: true },
  { key: "origin_story", label: "The Origin Story", type: "single_line_text_field", multiline: true, isShared: true },

  // ==========================================
  // SECTION B: PER-PIECE ROWS (The Hard Specs)
  // ==========================================
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_and_shape", label: "Cut / Shape", type: "single_line_text_field", isPerPiece: true }, 
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field", isPerPiece: true },
  { key: "honest_flaws", label: "Character Marks (Honest Flaws)", type: "single_line_text_field", multiline: true, isPerPiece: true },
  { key: "price", label: "Price", type: "single_line_text_field", isPerPiece: true }
];

const FULL_META_GROUPS = [
  {
    heading: "Always Fill",
    color: "#2E7D32",
    fields: [
      { key: "piece_name", label: "Piece Name", type: "text" },
      { key: "primary_medium", label: "Primary Medium", type: "text" },
      { key: "handcrafted_by", label: "Handcrafted By", type: "text" },
      { key: "is_one_of_a_kind", label: "Is One of a Kind", type: "text" },
      { key: "treated", label: "Treated", type: "text" }
    ]
  },
  {
    heading: "Stone Fields",
    color: "#1565C0",
    fields: [
      { key: "stone_family", label: "Stone Family", type: "text" },
      { key: "color", label: "Color", type: "text" },
      { key: "cut_and_shape", label: "Cut and Shape", type: "text" },
      { key: "surface_finish", label: "Surface Finish", type: "text" },
      { key: "dimensions_mm", label: "Dimensions (mm)", type: "text" },
      { key: "weight_grams", label: "Weight (grams)", type: "text" }
    ]
  },
  {
    heading: "Story & Lore",
    color: "#E65100",
    fields: [
      { key: "origin_story", label: "Origin Story", type: "text", multiline: true },
      { key: "honest_flaws_and_character", label: "Honest Flaws and Character", type: "text", multiline: true },
      { key: "collection_name", label: "Collection Name", type: "text" }
    ]
  },
  {
    heading: "Mixed Media",
    color: "#6A1B9A",
    fields: [
      { key: "found_object", label: "Found Object", type: "text" }
    ]
  },
  {
    heading: "Google / SEO",
    color: "#F9A825",
    fields: [
      { key: "primary_use", label: "Primary Use", type: "text" },
      { key: "bail_included", label: "Bail Included", type: "text" }
    ]
  },
  {
    heading: "Geo-Vault",
    color: "#4E342E",
    fields: [
      { key: "mineral_class", label: "Mineral Class", type: "text" },
      { key: "crystal_system", label: "Crystal System", type: "text" },
      { key: "rock_composition", label: "Rock Composition", type: "text" },
      { key: "rock_formation", label: "Rock Formation", type: "text" },
      { key: "geological_era", label: "Geological Era", type: "text" }
    ]
  }
];

const NAMESPACE_MAP = {
  custom: [
    "piece_name", "primary_medium", "secondary_medium", "handcrafted_by",
    "stone_family", "color", "cut_and_shape", "surface_finish",
    "dimensions_mm", "weight_grams", "shipping_weight_oz", "price",
    "collection_name", "collection_location",
    "primary_use", "bail_included", "is_one_of_a_kind", "treated",
    "found_object", "wire_material", "setting_ready", "material",
    "origin_story", "origin_handle", "honest_flaws_and_character",
    "artist_notes", "generated_description", "rescued_by", "stone_shape",
    "target_gender", "age_group", "condition", "color_pattern",
    "jewelry_type", "necklace_design", "chain_link_type",
    "jewelry_finding_type", "custom_product", "seo_title"
  ],
  geo: [
    "mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity",
    "diaphaneity", "crystal_system", "geological_era", "geological_age", "mineral_class",
    "rock_composition", "rock_formation"
  ]
};

const getNamespaceForKey = (key) => {
  if (NAMESPACE_MAP.custom.includes(key)) return "custom";
  if (NAMESPACE_MAP.geo.includes(key)) return "geo";
  return "custom";
};

export function IntakeBenchTab({ products, autoFillFetcher, injectFetcher, tab2Fetcher }) {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [formState, setFormState] = useState({});
  const [fullMetaState, setFullMetaState] = useState({});
  const originalMetaRef = useRef({});
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Tab 2 Auto-Fill State
  const [tab2StatusMessage, setTab2StatusMessage] = useState("");
  const [tab2ErrorMessage, setTab2ErrorMessage] = useState("");

  // Collapsible Sections State
  const [isSection3Open, setIsSection3Open] = useState(false);
  const [isSection4Open, setIsSection4Open] = useState(false);

  const handleSelectProduct = useCallback((id) => {
    setSelectedProductId(id);
    setStatusMessage("");
    setErrorMessage("");
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const product = products.find(p => p.id === id);
    const newForm = {};
    const newFullForm = {};
    
    const hasMetafields = product && product.metafields && product.metafields.edges;
    
    if (hasMetafields) {
      // Pass 1 — custom namespace only:
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        if (hasValue && node.namespace === "custom") {
          let parsedValue = node.value;
          if (parsedValue && parsedValue.includes("gid://")) {
            parsedValue = "See Shopify metaobject";
          }
          if (parsedValue && typeof parsedValue === 'string' && parsedValue.startsWith("[")) {
            try {
              const arr = JSON.parse(parsedValue);
              parsedValue = Array.isArray(arr) ? arr[0] : parsedValue;
            } catch (e) { }
          }
          newForm[node.key] = parsedValue;
          newFullForm[node.key] = parsedValue;
        }
      });

      // Pass 2 — geo namespace only:
      product.metafields.edges.forEach(({ node }) => {
        const hasValue = node.value !== null && node.value !== undefined;
        if (hasValue && node.namespace === "geo") {
          let parsedValue = node.value;
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

  // ==========================================
  // BLOCK 1 — Normalize camelCase geo keys to snake_case
  // ==========================================
  const CAMEL_TO_SNAKE = {
    crystalSystem: "crystal_system",
    geologicalEra: "geological_era",
    mineralClass: "mineral_class",
    rockComposition: "rock_composition",
    rockFormation: "rock_formation",
    geologicalAge: "geological_age",
    fracture: "fracture_pattern",
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

  // ==========================================
  // BLOCK 2 — Smart defaults for missing Google Machine fields
  // ==========================================
  if (!newFullForm.target_gender) newFullForm.target_gender = "Unisex";
  if (!newFullForm.age_group) newFullForm.age_group = "adult";
  if (!newFullForm.condition) newFullForm.condition = "new";
  if (!newFullForm.handcrafted_by) newFullForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
  if (!newForm.target_gender) newForm.target_gender = "Unisex";
  if (!newForm.age_group) newForm.age_group = "adult";
  if (!newForm.condition) newForm.condition = "new";
  if (!newForm.handcrafted_by) newForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";

  // ==========================================
  // BLOCK 3 — Calculate shipping_weight_oz from weight_grams if missing
  // ==========================================
  if (!newFullForm.shipping_weight_oz && newFullForm.weight_grams) {
    const grams = parseFloat(newFullForm.weight_grams);
    if (!isNaN(grams) && grams > 0) {
      newFullForm.shipping_weight_oz = (grams / 28.3495).toFixed(2);
      newForm.shipping_weight_oz = newFullForm.shipping_weight_oz;
    }
  }

    if (!newForm.origin_story && newForm.stone_story) {
      newForm.origin_story = newForm.stone_story;
    }
    if (newForm.origin_story && newForm.origin_story.startsWith("[")) {
      try { const arr = JSON.parse(newForm.origin_story); newForm.origin_story = Array.isArray(arr) ? arr[0] : newForm.origin_story; } catch (e) {}
    }

    // Un-wrap story arrays strictly
    if (newForm.origin_story && newForm.origin_story.startsWith("[")) {
      try {
        const arr = JSON.parse(newForm.origin_story);
        newForm.origin_story = Array.isArray(arr) ? arr[0] : newForm.origin_story;
      } catch (e) { }
    }
    if (newForm.stone_story && newForm.stone_story.startsWith("[")) {
      try {
        const arr = JSON.parse(newForm.stone_story);
        newForm.origin_story = Array.isArray(arr) ? arr[0] : newForm.stone_story;
      } catch (e) { }
    }
    newFullForm.origin_story = newForm.origin_story;

    if (newForm.honest_flaws_and_character && newForm.honest_flaws_and_character.startsWith("[")) {
      try {
        const arr = JSON.parse(newForm.honest_flaws_and_character);
        newForm.honest_flaws_and_character = Array.isArray(arr) ? arr[0] : newForm.honest_flaws_and_character;
      } catch (e) { }
    }
    if (newForm.character_marks && newForm.character_marks.startsWith("[")) {
      try {
        const arr = JSON.parse(newForm.character_marks);
        newForm.honest_flaws_and_character = Array.isArray(arr) ? arr[0] : newForm.character_marks;
      } catch (e) { }
    }
    newFullForm.honest_flaws_and_character = newForm.honest_flaws_and_character;

    // Fix duplicated Handcrafted By strings
    if (newForm.handcrafted_by && typeof newForm.handcrafted_by === 'string') {
      if (newForm.handcrafted_by.startsWith("[")) {
         try { const arr = JSON.parse(newForm.handcrafted_by); newForm.handcrafted_by = Array.isArray(arr) ? arr[0] : newForm.handcrafted_by; } catch (e) {}
      }
      if (newForm.handcrafted_by.includes("Bob & Janyce") || newForm.handcrafted_by.includes("Rockhound Studio")) {
         newForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
      }
    }
    if (newFullForm.handcrafted_by && typeof newFullForm.handcrafted_by === 'string') {
      if (newFullForm.handcrafted_by.startsWith("[")) {
         try { const arr = JSON.parse(newFullForm.handcrafted_by); newFullForm.handcrafted_by = Array.isArray(arr) ? arr[0] : newFullForm.handcrafted_by; } catch (e) {}
      }
      if (newFullForm.handcrafted_by.includes("Bob & Janyce") || newFullForm.handcrafted_by.includes("Rockhound Studio")) {
         newFullForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
      }
    }

    const customPM = product?.metafields?.edges?.find(e => e.node.namespace === "custom" && e.node.key === "primary_medium")?.node?.value;
    
    let bestPM = customPM || newForm.base_stone_type || "";
    
    if (bestPM && bestPM.startsWith("[")) {
      try {
        const arr = JSON.parse(bestPM);
        bestPM = Array.isArray(arr) ? arr[0] : bestPM;
      } catch (e) { }
    }

    if (bestPM === "Stone") bestPM = ""; // Explicitly strip hardcoded fallback
    
    newFullForm.primary_medium = bestPM;
    newForm.primary_medium = bestPM;

    // Prioritize Form State Color over Raw Primary Color
    if (newForm.color) {
      newFullForm.color = newForm.color;
    }

    if (!newFullForm.handcrafted_by || newFullForm.handcrafted_by.trim() === "") {
        newFullForm.handcrafted_by = "Bob & Janyce, Rockhound Studio";
    }

    // Auto-populate Piece Name from product title unconditionally at select time
    if (product && product.title) {
      newForm.piece_name = product.title;
      newFullForm.piece_name = product.title;
    }
    if (product && product.variants && product.variants.edges && product.variants.edges[0]) {
      const price = product.variants.edges[0].node.price;
      if (price) {
        newForm.price = price;
        newFullForm.price = price;
      }
    }
    
    setFormState(newForm);
    setFullMetaState(newFullForm);
    originalMetaRef.current = { ...newFullForm };
  }, [products]);

  // Seed formState from existing custom metafields when a product is selected
  useEffect(() => {
    if (selectedProductId && products && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product && product.metafields && product.metafields.edges) {
        setFormState(prev => {
          const updatedState = { ...prev };
          const dropdownFields = [
            "handcrafted_by", "is_one_of_a_kind", "treated", "found_object", 
            "primary_use", "bail_included", "setting_ready", "wire_material", "stone_family", 
            "color", "cut_and_shape", "surface_finish"
          ];
          const textFields = [
            "piece_name", "primary_medium", "dimensions_mm", 
            "weight_grams", "origin_story",
            "honest_flaws_and_character", "collection_name"
          ];

          product.metafields.edges.forEach(({ node }) => {
            if (node.namespace === "custom" && node.value && node.value.trim() !== "") {
              if (dropdownFields.includes(node.key)) {
                updatedState[node.key] = normalizeDropdownValue(node.key, node.value);
              } else if (textFields.includes(node.key)) {
                updatedState[node.key] = node.value;
              }
            }
          });
          
          if (product.title) {
            updatedState.piece_name = product.title;
          }
          
          return updatedState;
        });
      }
    }
  }, [selectedProductId, products]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
    // Keep Color actively synced between Form State and Full Meta Report
    if (key === "color") {
      setFullMetaState(prev => ({ ...prev, [key]: value }));
    }
  }, []);

  const updateFullMetaState = useCallback((key, value) => {
    setFullMetaState(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleAutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");

    const product = products.find(p => p.id === selectedProductId) || {};
    const title = product.title || "";
    const description = product.descriptionHtml || product.description || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    console.log("AutoFill imageUrl sent:", imageUrl);

    autoFillFetcher.submit(
      {
        intent: "autoFill",
        productId: selectedProductId,
        productTitle: title,
        productDescription: description,
        promptStyle: promptStyle,
        existingColor: formState.color || "",
        existingCutAndShape: formState.cut_and_shape || "",
        imageUrl: imageUrl
      },
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  }, [selectedProductId, autoFillFetcher, products, promptStyle, formState]);

  const handleTab2AutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_handle || fullMetaState.origin_page_handle || "";

    const formData = new FormData();
    const imageUrl = products.find(p => p.id === selectedProductId)?.images?.edges?.[0]?.node?.url || "";
    formData.append("intent", "tab2AutoFill");
    formData.append("productId", selectedProductId);
    formData.append("stone_family", stoneFamily);
    formData.append("origin_handle", originHandle);
    formData.append("cut_and_shape", fullMetaState.cut_and_shape || "");
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("imageUrl", imageUrl);

    tab2Fetcher.submit(
      formData,
      { method: "post", action: "/app/meta-injector-autofill" }
    );
    console.log("[Tab2 AutoFill] stone_family:", stoneFamily, "origin_handle:", originHandle);
  }, [selectedProductId, tab2Fetcher, fullMetaState, products]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const rawTitle = selectedProduct?.title || formState.piece_name || "";
    const resolvedPieceName = rawTitle.includes(" — ") ? rawTitle.split(" — ").pop().trim() : rawTitle;
    
    const payload = [];
    const entries = Object.entries(formState);
    
    entries.forEach(([key, value]) => {
      let injectValue = value;
      if (key === "piece_name") {
        injectValue = resolvedPieceName;
      }

      const isPopulated = injectValue !== undefined && injectValue !== null && injectValue.toString().trim() !== "";
      
      // Removed the overly strict '&& config' that was dropping standard fields
      if (isPopulated && injectValue !== "See Shopify metaobject") {
        const config = CUSTOM_FIELDS.find(f => f.key === key);
        let fieldType = "single_line_text_field";
        if (config && config.type) {
          fieldType = config.type;
        }
        
        let formatId = `gid://shopify/Product/${selectedProductId}`;
        if (selectedProductId.includes("gid://")) {
          formatId = selectedProductId;
        }

        payload.push({
          namespace: "custom",
          key: key.replace(/-/g, "_"),
          type: fieldType,
          value: injectValue,
          ownerId: formatId
        });
      }
    });

    if (payload.length === 0) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    // Explicit form action wiring restored to guarantee hitting the server action block
    injectFetcher.submit(
      { intent: "saveMetafields", payload: JSON.stringify(payload) },
      { method: "post", action: "/app/meta-injector-api" }
    );
  }, [selectedProductId, formState, products, injectFetcher]);

  const handleSaveFullMeta = useCallback(() => {
    if (!selectedProductId) return;
    const changes = [];
    
    const ALWAYS_INCLUDE = ["seo_title", "weight_grams"];

    Object.entries(fullMetaState).forEach(([key, value]) => {
      const originalValue = originalMetaRef.current[key] || "";
      const newValue = value || "";

      const alwaysInclude = ALWAYS_INCLUDE.includes(key) && newValue !== "";
      if ((alwaysInclude || originalValue !== newValue) && newValue !== "See Shopify metaobject") {
        changes.push({
          namespace: getNamespaceForKey(key),
          key: key.replace(/-/g, "_"),
          value: newValue,
          type: "single_line_text_field"
        });
      }
    });

    if (changes.length > 0) {
      // Explicit form action wiring restored to prevent silent drop
      injectFetcher.submit(
        { intent: "saveMetafields", productId: selectedProductId, metafields: JSON.stringify(changes) },
        { method: "post", action: "/app/meta-injector-api" }
      );
    }
  }, [selectedProductId, fullMetaState, injectFetcher]);

  useEffect(() => {
    const isIdle = autoFillFetcher.state === "idle";
    const hasData = autoFillFetcher.data !== undefined && autoFillFetcher.data !== null;
    
    if (isIdle && hasData) {
      const product = products.find(p => p.id === selectedProductId);
      const productTitle = product ? product.title : "";

      const isAutoFill = autoFillFetcher.data.intent === "autoFill";
      const isSmartAutoFill = autoFillFetcher.data.intent === "smartAutoFill";
      
      const isSuccess = autoFillFetcher.data.success === true;
      const isError = autoFillFetcher.data.success === false;

      if ((isAutoFill || isSmartAutoFill) && isSuccess && autoFillFetcher.data.fields) {
        setFormState(prev => {
          const updatedState = { ...prev };
          Object.entries(autoFillFetcher.data.fields).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "";
            
            // Only fill if currently empty in fullMetaState
            const ALWAYS_OVERWRITE = ["color", "cut_and_shape", "stone_family", "surface_finish", "handcrafted_by", "treated", "is_one_of_a_kind"];
            const currentlyEmpty = !fullMetaState[key] || (typeof fullMetaState[key] === 'string' && fullMetaState[key].trim() === "");
            const shouldOverwrite = ALWAYS_OVERWRITE.includes(key);

            if (hasNewValue && (currentlyEmpty || shouldOverwrite) && val !== "See Shopify metaobject") {
              let normalizedVal = val;
              if (key === "treated" || key === "is_one_of_a_kind") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });
          
          if (updatedState.stone_family && !updatedState.material) {
            updatedState.material = updatedState.stone_family;
          }
          
          if (productTitle) {
            updatedState.piece_name = productTitle.includes(" — ") ? productTitle.split(" — ").pop().trim() : productTitle;
          }
          
          return updatedState;
        });

        if (isSmartAutoFill || isAutoFill) {
          setFullMetaState(prev => {
            const parsedValues = autoFillFetcher.data.fields || {};
            const fullMetaFields = autoFillFetcher.data.fullMetaFields || {};
            const nextState = {
              ...prev,
              ...parsedValues,
              ...fullMetaFields
            };
            
            // Ensure Color is driven by parsed/form state, not raw primary_color meta
            if (parsedValues.color) {
                nextState.color = parsedValues.color;
            } else if (formState.color) {
                nextState.color = formState.color;
            }

            // Clean handcrafted_by deduplication on AutoFill return
            if (typeof nextState.handcrafted_by === 'string' && (nextState.handcrafted_by.includes("Bob & Janyce") || nextState.handcrafted_by.includes("Rockhound Studio"))) {
                nextState.handcrafted_by = "Bob & Janyce, Rockhound Studio";
            }

            // Clean primary_medium hardcode
            if (nextState.primary_medium === "Stone") {
                nextState.primary_medium = "";
            }

            if (productTitle) {
              nextState.piece_name = productTitle.includes(" — ") ? productTitle.split(" — ").pop().trim() : productTitle;
            }

            return nextState;
          });
        }

        if (isSmartAutoFill) {
          setStatusMessage("Smart Auto-Fill complete — fields populated from all available data sources.");
        }
        
        if (isAutoFill) {
          setStatusMessage("Title and tags successfully parsed and loaded into fields.");
          if (autoFillFetcher.data.colorWarning) { setErrorMessage("WARNING: Vision could not detect Color from the hero image   please enter Color manually."); }
        }

        // Show Polaris Toast for Success
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Auto-Fill complete!");
        }
      }

      if (isError) {
        setErrorMessage(autoFillFetcher.data.error || "An unknown error occurred during the operation.");
        // Fallback catch-all error Toast
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Action failed", { isError: true });
        }
      }
    }
  }, [autoFillFetcher.state, autoFillFetcher.data]);

  useEffect(() => {
    const isIdle = tab2Fetcher.state === "idle";
    const hasData = tab2Fetcher.data !== undefined && tab2Fetcher.data !== null;

    if (isIdle && hasData) {
      const product = products.find(p => p.id === selectedProductId);
      const productTitle = product ? product.title : "";
      const tab2Data = tab2Fetcher.data.tab2Data || {};
      const hasTab2Data = Object.keys(tab2Data).length > 0;

      if (hasTab2Data) {
        setFullMetaState(prev => {
          const updatedState = { ...prev };
          const ALWAYS_OVERWRITE_TAB2 = ["stone_family", "surface_finish", "handcrafted_by", "treated", "is_one_of_a_kind", "mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age", "color", "stone_shape", "color_pattern", "cut_and_shape", "honest_flaws_and_character", "primary_use", "primary_medium", "setting_ready", "wire_material", "bail_included", "generated_description", "seo_title"];

          Object.entries(tab2Data).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            const currentlyEmpty = !updatedState[key] || updatedState[key].toString().trim() === "";
            const shouldOverwrite = ALWAYS_OVERWRITE_TAB2.includes(key);

            if (hasNewValue && (currentlyEmpty || shouldOverwrite)) {
              let normalizedVal = val;
              if (key === "treated" || key === "is_one_of_a_kind") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });

          if (productTitle) {
            updatedState.piece_name = productTitle.includes(" \u2014 ") ? productTitle.split(" \u2014 ").pop().trim() : productTitle;
          }

          return updatedState;
        });
        setTab2StatusMessage("Auto-Fill complete \u2014 review fields before saving");
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Auto-Fill complete!");
        }
      } else {
        setTab2ErrorMessage("Auto-Fill returned no data \u2014 check stone_family and origin_handle.");
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Auto-Fill failed", { isError: true });
        }
      }
    }
  }, [tab2Fetcher.state, tab2Fetcher.data, selectedProductId, products]);

  useEffect(() => {
    const isIdle = injectFetcher.state === "idle";
    const hasData = injectFetcher.data !== undefined && injectFetcher.data !== null;
    
    if (isIdle && hasData) {
      const isSuccess = injectFetcher.data.success === true;
      const isError = injectFetcher.data.success === false;

      if (isSuccess) {
        setStatusMessage("Metafields injected cleanly into Shopify database.");
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Metafields injected!");
        }
      }

      if (isError) {
        setErrorMessage(injectFetcher.data.message || injectFetcher.data.error || "An unknown error occurred");
        // Fallback catch-all error Toast
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Action failed", { isError: true });
        }
      }
    }
  }, [injectFetcher.state, injectFetcher.data]);

  const renderFullMetaField = (key) => {
    let field = null;
    for (const group of FULL_META_GROUPS) {
      const found = group.fields.find(f => f.key === key);
      if (found) { field = found; break; }
    }
    if (!field) {
      const rf = CUSTOM_FIELDS.find(f => f.key === key);
      if (rf) { field = rf; }
    }
    if (!field) {
      field = {
        key: key,
        label: key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        type: 'text',
        multiline: key.includes("story") || key.includes("notes") || key.includes("flaws") || key.includes("character")
      };
    }

    let val = fullMetaState[field.key] || "";

    if (typeof val === 'string' && val.startsWith('[')) {
        try { const arr = JSON.parse(val); val = Array.isArray(arr) ? arr[0] : val; } catch(e) {}
    } else if (Array.isArray(val)) {
        val = val[0];
    }

    if ((field.key === "handcrafted_by" || field.key === "rescued_by") && typeof val === 'string') {
        if (val.includes("Bob & Janyce") || val.includes("Rockhound Studio")) {
            val = "Bob & Janyce, Rockhound Studio";
        }
    }

    if (field.key === "primary_medium" && val === "Stone") {
        val = "";
    }

    if (field.key === "color" && formState.color) {
        val = formState.color;
    }

    const reqKeys = ["piece_name", "price", "weight_grams", "material", "stone_family", "collection_name", "origin_handle", "rescued_by", "treatment_status", "origin_story", "primary_use", "seo_title"];
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "false";
    const isRequiredEmpty = !isFilled && reqKeys.includes(field.key);
    const isOptionalEmpty = !isFilled && !reqKeys.includes(field.key);
    const isEmpty = !isFilled;
    
    const labelNode = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px', marginRight: '8px' }}>
          {isRequiredEmpty && <circle cx="9" cy="9" r="9" fill="#ef4444" />}
          {isFilled && <circle cx="9" cy="9" r="9" fill="#22c55e" />}
          {isOptionalEmpty && <circle cx="9" cy="9" r="9" fill="#eab308" />}
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{field.label}</span>
      </div>
    );

    return (
      <div key={field.key}>
        {isEmpty && (
          <div style={{ backgroundColor: "#FFF5F5", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
            {field.type !== "text" && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
              <Select
                label={labelNode}
                options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]}
                value={val}
                onChange={(v) => updateFullMetaState(field.key, v)}
                accessibilityLabel={field.label}
              />
            ) : (
              <TextField
                label={labelNode}
                value={val}
                onChange={(v) => updateFullMetaState(field.key, v)}
                accessibilityLabel={field.label}
                multiline={field.multiline ? true : false}
                autoComplete="off"
              />
            )}
          </div>
        )}
        {!isEmpty && (
          <div style={{ backgroundColor: "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
            {field.type !== "text" && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
              <Select
                label={labelNode}
                options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]}
                value={val}
                onChange={(v) => updateFullMetaState(field.key, v)}
                accessibilityLabel={field.label}
              />
            ) : (
              <TextField
                label={labelNode}
                value={val}
                onChange={(v) => updateFullMetaState(field.key, v)}
                accessibilityLabel={field.label}
                multiline={field.multiline ? true : false}
                autoComplete="off"
                disabled={val === "See Shopify metaobject"}
              />
            )}
          </div>
        )}
      </div>
    );
  };

  const safeProducts = products || [];
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const isAutoFilling = autoFillFetcher.state !== "idle" && (autoFillFetcher.formData?.get("intent") === "autoFill" || autoFillFetcher.formData?.get("intent") === "smartAutoFill");
  const isTab2AutoFilling = tab2Fetcher.state !== "idle";
  const isSaving = injectFetcher.state !== "idle" && (injectFetcher.formData?.get("intent") === "saveProduct" || injectFetcher.formData?.get("intent") === "saveMetafields");
  
  return (
    <BlockStack gap="400">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">1. Select Raw Inventory</Text>
              <TextField
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search products by title..."
                autoComplete="off"
                clearButton
                onClearButtonClick={() => setSearchQuery("")}
              />
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredProducts.map(p => {
                  const isSelected = selectedProductId === p.id;
                  const imageUrl = p.images?.edges?.[0]?.node?.url;

                  return (
                    <div key={p.id} style={{ minHeight: "54px" }}>
                      <Button
                        fullWidth
                        size="large"
                        textAlign="left"
                        variant={isSelected ? "primary" : "secondary"}
                        onClick={() => handleSelectProduct(p.id)}
                        accessibilityLabel={`Select product ${p.title}`}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={`Hero image for ${p.title}`}
                              aria-label={`Hero image for ${p.title}`}
                              style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }}
                            />
                          ) : (
                            <div
                              aria-label={`Hero image for ${p.title}`}
                              style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }}
                            />
                          )}
                          <span>{p.title}</span>
                        </div>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">2. Data Sieve & Injection</Text>
              
              {statusMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{statusMessage}</Text>
                  </Banner>
                </div>
              )}

              {errorMessage !== "" && (
                <div style={{ minHeight: "54px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{errorMessage}</Text>
                  </Banner>
                </div>
              )}

              <div style={{ minHeight: "54px" }}>
                <TextField
                  label="Gemini Presentation Style"
                  placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy. No corporate language."
                  value={promptStyle}
                  onChange={setPromptStyle}
                  multiline={3}
                  autoComplete="off"
                  disabled={!selectedProductId}
                  accessibilityLabel="Enter Gemini Presentation Style instructions"
                />
                </div>

              <InlineStack gap="300" align="space-between">
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={MagicIcon} 
                    onClick={handleTab2AutoFill}
                    accessibilityLabel="Run Auto-Fill"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isTab2AutoFilling}
                  >
                    RUN
                  </Button>
                </div>
                <div style={{ minHeight: "54px", flexGrow: 1 }}>
                  <Button 
                    icon={SaveIcon} 
                    tone="success" 
                    variant="primary" 
                    onClick={handleInject}
                    accessibilityLabel="Inject Metafields"
                    size="large"
                    fullWidth
                    disabled={!selectedProductId}
                    loading={isSaving}
                  >
                    Inject Metafields
                  </Button>
                </div>
              </InlineStack>

            </BlockStack>
          </Card>
        </div>
      </div>

      {selectedProductId !== "" && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">

              {tab2StatusMessage !== "" && (
                <div style={{ minHeight: "54px", marginBottom: "16px" }}>
                  <Banner tone="success" title="Operation Successful">
                    <Text as="p">{tab2StatusMessage}</Text>
                  </Banner>
                </div>
              )}

              {tab2ErrorMessage !== "" && (
                <div style={{ minHeight: "54px", marginBottom: "16px" }}>
                  <Banner tone="critical" title="Operation Failed">
                    <Text as="p">{tab2ErrorMessage}</Text>
                  </Banner>
                </div>
              )}

              <Text variant="headingLg" as="h3">Full Meta Report</Text>

              <BlockStack gap="300">
                <Text variant="headingMd" as="h4">Section 1 — Core Ignition</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_one_of_a_kind", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text variant="headingMd" as="h4">Section 2 — Human Engine</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character", "found_object"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <div onClick={() => setIsSection3Open(!isSection3Open)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                  <Text variant="headingMd" as="h4">Section 3 — Google Machine</Text>
                </div>
                <Collapsible open={isSection3Open} id="section-3-collapsible" transition={{duration: '200ms', timingFunction: 'ease-in-out'}}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    {["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "chain_link_type", "jewelry_finding_type", "target_gender", "age_group", "condition", "custom_product", "seo_title"].map(renderFullMetaField)}
                  </div>
                </Collapsible>
              </BlockStack>

              <BlockStack gap="300">
                <div onClick={() => setIsSection4Open(!isSection4Open)} style={{ cursor: 'pointer', display: 'inline-block' }}>
                  <Text variant="headingMd" as="h4">Section 4 — Geo-Vault</Text>
                </div>
                <Collapsible open={isSection4Open} id="section-4-collapsible" transition={{duration: '200ms', timingFunction: 'ease-in-out'}}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px', marginTop: '16px' }}>
                    {["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"].map(renderFullMetaField)}
                  </div>
                </Collapsible>
              </BlockStack>

            </BlockStack>
          </Card>
        </div>
      )}

    </BlockStack>
  );
}

export default IntakeBenchTab;
Below is the full contents of app.meta-injector-api.jsx from a Shopify Remix app called Meta Injector for Rockhound Studio.

Make exactly ONE change. Do not change anything else. Do not restructure the file.

Inside the saveMetafields intent block, find this exact sequence:

      // Update variant weight if weight_grams is in the payload
      const weightItem = payloadArray.find(item => item.key === "weight_grams");
      if (weightItem && weightItem.value) {
        const weightGrams = parseFloat(String(weightItem.value).replace(/['"]/g, ""));
        if (!isNaN(weightGrams) && weightGrams > 0) {
          try {
            const productGid = `gid://shopify/Product/${formData.get("productId").split("/").pop()}`;
            const variantQuery = await admin.graphql(
              `#graphql
              query getDefaultVariant($id: ID!) {
                product(id: $id) {
                  variants(first: 1) {
                    edges { node { id } }
                  }
                }
              }`,
              { variables: { id: productGid } }
            );
            const variantData = await variantQuery.json();
            const variantId = variantData?.data?.product?.variants?.edges?.[0]?.node?.id;
            if (variantId) {
              await admin.graphql(
                `#graphql
                mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                    userErrors { field message }
                  }
                }`,
                { variables: { productId: productGid, variants: [{ id: variantId, inventoryItem: { measurement: { weight: { value: weightGrams / 28.3495, unit: "OUNCES" } } } }] } }
              );
              console.log("[saveMetafields] Variant weight updated:", weightGrams, "g →", weightGrams / 28.3495, "oz");
            }
          } catch (weightErr) {
            console.warn("[saveMetafields] Variant weight update failed:", weightErr.message);
          }
        }
      }

Replace it with:

      // Update variant weight if weight_grams is in the payload
      const weightItem = payloadArray.find(item => item.key === "weight_grams");
      if (weightItem && weightItem.value) {
        const weightGrams = parseFloat(String(weightItem.value).replace(/['"]/g, ""));
        if (!isNaN(weightGrams) && weightGrams > 0) {
          try {
            let targetProductId = formData.get("productId");
            if (!targetProductId) {
              const fallbackField = payloadArray.find(item => item.ownerId);
              if (fallbackField) targetProductId = fallbackField.ownerId;
            }
            
            if (targetProductId) {
              const productGid = `gid://shopify/Product/${targetProductId.split("/").pop()}`;
              const variantQuery = await admin.graphql(
                `#graphql
                query getDefaultVariant($id: ID!) {
                  product(id: $id) {
                    variants(first: 1) {
                      edges { node { id } }
                    }
                  }
                }`,
                { variables: { id: productGid } }
              );
              const variantData = await variantQuery.json();
              const variantId = variantData?.data?.product?.variants?.edges?.[0]?.node?.id;
              if (variantId) {
                await admin.graphql(
                  `#graphql
                  mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                      userErrors { field message }
                    }
                  }`,
                  { variables: { productId: productGid, variants: [{ id: variantId, inventoryItem: { measurement: { weight: { value: weightGrams / 28.3495, unit: "OUNCES" } } } }] } }
                );
                console.log("[saveMetafields] Variant weight updated:", weightGrams, "g →", weightGrams / 28.3495, "oz");
              }
            }
          } catch (weightErr) {
            console.warn("[saveMetafields] Variant weight update failed:", weightErr.message);
          }
        }
      }

Do not change anything else. Full file only. Do not truncate. Do not summarize.
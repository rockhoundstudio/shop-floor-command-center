// ==========================================================================
// ROCKHOUND STUDIO — TAB 1: NEW PRODUCT INTAKE Bench
// File: app/routes/app.meta-injector.injector.jsx
// ==========================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, DropZone, Spinner, Frame, Toast, InlineGrid, Box, Divider } from "@shopify/polaris";
import { PlusIcon, MagicIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, CHANNEL_REQUIREMENTS, getFieldStatus, productTypeOptions, collectionLocationOptions, normalizeDropdownValue, DROPDOWN_OPTIONS } from "../utils/meta-injector.constants.jsx";
import { handleScanPhoto, handleGenerateDescription, buildMetafieldsJson, buildTitle } from "./app.meta-injector.intake-helpers.jsx";

const SHOPPED_ROCK_VENDORS = ["Richardson's Rock Ranch", "Irv's Rock and Jewelry"];

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
  { key: "origin_story", label: "The Origin Story", type: "multi_line_text_field", multiline: true, isShared: true },

  // ==========================================
  // SECTION B: PER-PIECE ROWS (The Hard Specs)
  // ==========================================
  { key: "piece_name", label: "Piece Name", type: "single_line_text_field", isPerPiece: true },
  { key: "cut_and_shape", label: "Cut / Shape", type: "single_line_text_field", isPerPiece: true }, 
  { key: "dimensions_mm", label: "Dimensions (mm)", type: "single_line_text_field", isPerPiece: true },
  { key: "weight_grams", label: "Weight (grams)", type: "single_line_text_field", isPerPiece: true },
  { key: "honest_flaws", label: "Character Marks (Honest Flaws)", type: "multi_line_text_field", multiline: true, isPerPiece: true },
  { key: "price", label: "Price", type: "single_line_text_field", isPerPiece: true },
  { key: "seo_title", label: "SEO Title", type: "single_line_text_field", isPerPiece: true }
];

const FULL_META_GROUPS = [
  {
    heading: "Always Fill",
    color: "#2E7D32",
    fields: [
      { key: "piece_name", label: "Piece Name", type: "text" },
      { key: "primary_medium", label: "Primary Medium", type: "text" },
      { key: "handcrafted_by", label: "Handcrafted By", type: "text" },
      { key: "is_ooak", label: "Is One of a Kind", type: "text" },
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
      { key: "bail_included", label: "Bail Included", type: "text" },
      { key: "seo_title", label: "SEO Title", type: "text" }
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
    "primary_use", "bail_included", "is_ooak", "treated",
    "found_object", "wire_material", "setting_ready", "material",
    "origin_story", "origin_handle", "honest_flaws_and_character",
    "artist_notes", "generated_description", "rescued_by", "stone_shape",
    "target_gender", "age_group", "condition", "color_pattern",
    "jewelry_type", "necklace_design", "chain_link_type",
    "jewelry_finding_type", "custom_product", "seo_title",
    "mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity",
    "diaphaneity", "crystal_system", "geological_era", "geological_age", "mineral_class",
    "rock_composition", "rock_formation"
  ]
};

const getNamespaceForKey = (key) => "custom";

export function NewProductIntakeTab({ fetcher }) {
  const stageFetcher = useFetcher();
  const autoFillFetcher = useFetcher();
  const visionFetcher = useFetcher();
  const descriptionFetcher = useFetcher();

  const [sharedFields, setSharedFields] = useState({
    material: "",
    stone_family: "",
    collection_name: "",
    collection_location: "",
    origin_location: "",
    origin_handle: "", 
    rescued_by: "Bob and Janyce",
    treatment_status: "100% Natural/Untreated",
    origin_story: "",
    primary_use: "",
    handcrafted_by: "Bob & Janyce, Rockhound Studio",
    is_ooak: "Yes",
    treated: "Untreated — Natural",
    found_object: "true",
    condition: "new",
    target_gender: "Unisex",
    age_group: "adult",
    google_product_category: "Apparel & Accessories > Jewelry",
    primary_medium: "",
    secondary_medium: "",
    wire_material: "",
    setting_ready: "",
    bail_included: ""
  });

  const [pieces, setPieces] = useState([
    {
      id: Date.now().toString(),
      piece_name: "",
      dimensions_mm: "",
      cut_and_shape: "",
      surface_finish: "",
      color: "",
      price: "",
      weight_grams: "",
      shipping_weight_oz: "",
      photoFiles: [],
      photoPreviewUrls: [],
      photos: [],
      imageBase64: "",
      imageMimeType: "",
      stagedResourceUrls: [],
      generated_description: "",
      seo_title: "",
      artist_notes: "",
      scanError: "",
      scanToken: "",
      isUploading: false
    }
  ]);

  // 🟢 THE WELD: Live State References to bypass the Stale Closure ghost
  const latestPieces = useRef(pieces);
  const latestShared = useRef(sharedFields);
  useEffect(() => { latestPieces.current = pieces; }, [pieces]);
  useEffect(() => { latestShared.current = sharedFields; }, [sharedFields]);

  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");
  const [geoToast, setGeoToast] = useState(false);
  const [reportToastActive, setReportToastActive] = useState(false);
  
  const [titleToastActive, setTitleToastActive] = useState(false);
  const [titleToastMsg, setTitleToastMsg] = useState("");
  const [titleToastError, setTitleToastError] = useState(false);
  
  const [lastScannedPieceId, setLastScannedPieceId] = useState(null);

  const handleScanGeminiPhotos = useCallback((piece) => {
    // Check if the piece already has a base64 image; if so, we can call handleScanPhoto immediately.
    if (piece?.imageBase64) {
      handleScanPhoto({
        piece,
        updatePiece: handlePieceChange,
        visionFetcher, // Fix: Changed autoFillFetcher to visionFetcher
        setErrorMessage
      });
      return;
    }

    // Fallback: stage upload flow if base64 is not already set.
    !!(piece?.photoFiles?.[0]) && (() => {
      const formData = new FormData();
      formData.append("intent", "stagedUpload");
      formData.append("file_0", piece.photoFiles[0]);
      formData.append("pieceId", piece.id);
      stageFetcher.submit(formData, {
        method: "post",
        action: "/app/meta-injector-api",
        encType: "multipart/form-data"
      });
    })();
  }, [stageFetcher, visionFetcher]);

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleStoneFamilyChange = useCallback((value) => {
    setSharedFields(prev => ({ ...prev, stone_family: value }));
  }, []);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (updated[key] = value);
      return updated;
    }));
  }, []);

  const handlePieceNameBlur = useCallback((id, value) => {
    if (!value) return;
    const segments = value.split(/\s+[-—–]\s+/);
    if (segments.length === 3) {
      setLastScannedPieceId(id);
      
      const formData = new FormData();
      formData.append("intent", "titleParse");
      formData.append("pieceName", value);

      autoFillFetcher.submit(
        formData,
        { method: "post", action: "/app/meta-injector-autofill" }
      );
    }
  }, [autoFillFetcher]);

  const handleTopDropZoneDrop = useCallback((dropFiles) => {
    setPhotoFiles(prev => {
      const combined = [...prev, ...dropFiles];
      const capped = combined.slice(0, 5);
      setPhotoPreviewUrls(capped.map(f => URL.createObjectURL(f)));
      return capped;
    });
    setPieces(prev => prev.map((p, i) => {
      let updated = { ...p };
      (i === 0) && (() => {
        const combined = [...p.photoFiles, ...dropFiles];
        const capped = combined.slice(0, 5);
        updated.photoFiles = capped;
        updated.photoPreviewUrls = capped.map(f => URL.createObjectURL(f));
      })();
      return updated;
    }));
  }, []);

  const handleRemoveTopPhoto = useCallback((index) => {
    setPhotoFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      setPhotoPreviewUrls(updated.map(f => URL.createObjectURL(f)));
      return updated;
    });
  }, []);

  const handleDropZoneDrop = useCallback((id, dropFiles) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (() => {
        const combined = [...p.photoFiles, ...dropFiles];
        const capped = combined.slice(0, 5);
        updated.photoFiles = capped;
        updated.photos = capped;
        updated.photoPreviewUrls = capped.map(f => URL.createObjectURL(f));
        if (capped.length > 0) {
          updated.imageMimeType = capped[0].type;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.replace("data:", "").replace(/^.+,/, "");
            handlePieceChange(id, "imageBase64", base64String);
          };
          reader.readAsDataURL(capped[0]);
        } else {
          updated.imageBase64 = "";
          updated.imageMimeType = "";
        }
      })();
      return updated;
    }));
  }, [handlePieceChange]);

  const handleRemoveRowPhoto = useCallback((id, index) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (() => {
        const filtered = p.photoFiles.filter((_, i) => i !== index);
        updated.photoFiles = filtered;
        updated.photos = filtered;
        updated.photoPreviewUrls = filtered.map(f => URL.createObjectURL(f));
        if (filtered.length > 0) {
          updated.imageMimeType = filtered[0].type;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.replace("data:", "").replace(/^.+,/, "");
            handlePieceChange(id, "imageBase64", base64String);
          };
          reader.readAsDataURL(filtered[0]);
        } else {
          updated.imageBase64 = "";
          updated.imageMimeType = "";
        }
      })();
      return updated;
    }));
  }, [handlePieceChange]);

  const handleAddRow = useCallback(() => {
    setPieces(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(),
        piece_name: "",
        dimensions_mm: "",
        cut_and_shape: "",
        surface_finish: "",
        color: "",
        price: "",
        weight_grams: "",
        shipping_weight_oz: "",
        photoFiles: [],
        photoPreviewUrls: [],
        photos: [],
        imageBase64: "",
        imageMimeType: "",
        stagedResourceUrls: [],
        generated_description: "",
        seo_title: "",
        artist_notes: "",
        scanError: "",
        scanToken: "",
        isUploading: false
      }
    ]);
  }, []);

  const handleRemoveRow = useCallback((id) => {
    setPieces(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleCopyFieldReportTab1 = useCallback(() => {
    const p = pieces[0] || {};
    const report = `=== TAB 1 FIELD REPORT ===
piece_name: ${p.piece_name || "EMPTY"}
generated_description: ${p.generated_description || "EMPTY"}
seo_title: ${p.seo_title || "EMPTY"}
artist_notes: ${p.artist_notes || "EMPTY"}
price: ${p.price || "EMPTY"}
weight_grams: ${p.weight_grams || "EMPTY"}
shipping_weight_oz: ${p.shipping_weight_oz || "EMPTY"}
dimensions_mm: ${p.dimensions_mm || "EMPTY"}
cut_and_shape: ${p.cut_and_shape || "EMPTY"}
surface_finish: ${p.surface_finish || "EMPTY"}
color: ${p.color || "EMPTY"}
imageBase64: ${p.imageBase64 ? "PRESENT" : "EMPTY"}
imageMimeType: ${p.imageMimeType || "EMPTY"}
stagedResourceUrls: ${(p.stagedResourceUrls && p.stagedResourceUrls.length > 0) ? p.stagedResourceUrls.join(", ") : "EMPTY"}
=== END REPORT ===`;

    navigator.clipboard.writeText(report).then(() => {
      setReportToastActive(true);
      setTimeout(() => setReportToastActive(false), 3000);
    }).catch(err => console.error("Clipboard copy failed", err));
  }, [pieces]);

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    let productType = "Wearable Art";
    (sharedFields.primary_use && sharedFields.primary_use !== "") && (productType = sharedFields.primary_use);

    const payload = {
      intent: "createProduct",
      ...latestShared.current,
      piece_name: pieces[0].piece_name,
      dimensions_mm: pieces[0].dimensions_mm,
      cut_and_shape: pieces[0].cut_and_shape,
      surface_finish: pieces[0].surface_finish,
      color: pieces[0].color,
      price: pieces[0].price,
      weight_grams: pieces[0].weight_grams,
      seo_title: pieces[0].seo_title,
      title: pieces[0].canonical_title || buildTitle(latestShared.current, pieces[0]),
      descriptionHtml: pieces[0].generated_description,
      productType: productType,
      status: "DRAFT",
      metafieldsJson: buildMetafieldsJson(sharedFields, pieces[0]),
      mediaUrlsJson: JSON.stringify(pieces[0].stagedResourceUrls.filter(u => u !== undefined && u !== ""))
    };

    const fd = new FormData();
    fd.append("intent", "createProduct");
    fd.append("payload", JSON.stringify(payload));

    fetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [sharedFields, pieces, fetcher]);

  const handleStartNewBatch = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");
    setSharedFields({
      material: "",
      stone_family: "",
      collection_name: "",
      collection_location: "",
      origin_location: "",
      origin_handle: "",
      rescued_by: "Bob and Janyce",
      treatment_status: "100% Natural/Untreated",
      origin_story: "",
      primary_use: "",
      handcrafted_by: "Bob & Janyce, Rockhound Studio",
      is_ooak: "Yes",
      treated: "Untreated — Natural",
      found_object: "true",
      condition: "new",
      target_gender: "Unisex",
      age_group: "adult",
      google_product_category: "Apparel & Accessories > Jewelry",
      primary_medium: "",
      secondary_medium: "",
      wire_material: "",
      setting_ready: "",
      bail_included: ""
    });
    setPieces([{
      id: Date.now().toString(),
      piece_name: "",
      dimensions_mm: "",
      cut_and_shape: "",
      surface_finish: "",
      color: "",
      price: "",
      weight_grams: "",
      shipping_weight_oz: "",
      photoFiles: [],
      photoPreviewUrls: [],
      photos: [],
      imageBase64: "",
      imageMimeType: "",
      stagedResourceUrls: [],
      generated_description: "",
      seo_title: "",
      artist_notes: "",
      scanError: "",
      scanToken: "",
      isUploading: false
    }]);
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setGeneratedDescription("");
    setLastScannedPieceId(null);
  }, []);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;

    (isIdle && hasData) && (() => {
      const isCreate = fetcher.data.intent === "createProduct";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      (isCreate && isSuccess) && (() => {
        let count = 0;
        fetcher.data.createdCount && (count = fetcher.data.createdCount);
        setStatusMessage(`Successfully created pieces.`);
      })();

      (isCreate && isError) && (() => {
        let errStr = "An error occurred during product creation.";
        fetcher.data.error && (errStr = fetcher.data.error);
        setErrorMessage(errStr);
      })();
    })();
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    const isIdle = stageFetcher.state === "idle";
    const hasData = stageFetcher.data !== undefined && stageFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = stageFetcher.data;
      const isStaged = data.intent === "stagedUpload";
      const isSuccess = data.success === true;
      const isError = data.success === false;
      const pid = data.pieceId;
      const resourceUrl = data.resourceUrl;

      (isStaged && isError) && (() => {
        handlePieceChange(pid, "scanError", data.error || "Stage failed");
      })();

      (isStaged && isSuccess && resourceUrl) && (() => {
        setPieces(prev => prev.map(p =>
          p.id === pid ? { ...p, stagedResourceUrls: [resourceUrl] } : p
        ));

        const executeVisionScan = (finalBase64, finalMime) => {
          const currentPiece = latestPieces.current.find(p => p.id === pid);
          const pName = currentPiece ? currentPiece.piece_name : "";
          const cName = latestShared.current.collection_name || "";

          // THE FIX: Forcing FormData to prevent stringification limits dropping the Base64 payload
          const formData = new FormData();
          formData.append("intent", "visionScan");
          formData.append("pieceId", pid);
          formData.append("imageUrl", resourceUrl);
          formData.append("pieceName", pName);
          formData.append("collectionName", cName);
          formData.append("imageBase64", finalBase64);
          formData.append("imageMimeType", finalMime);

          visionFetcher.submit(
            formData,
            { method: "post", action: "/app/meta-injector-autofill" }
          );
        };

        const initialPiece = latestPieces.current.find(p => p.id === pid);
        if (initialPiece && initialPiece.imageBase64) {
          executeVisionScan(initialPiece.imageBase64, initialPiece.imageMimeType);
        } else {
          let attempts = 0;
          const maxAttempts = 25; // 25 polls * 200ms = 5 seconds
          const pollInterval = setInterval(() => {
            attempts++;
            const currentPiece = latestPieces.current.find(p => p.id === pid);
            const currentBase64 = currentPiece ? currentPiece.imageBase64 : "";
            const currentMime = currentPiece ? currentPiece.imageMimeType : "image/jpeg";

            if (currentBase64) {
              clearInterval(pollInterval);
              executeVisionScan(currentBase64, currentMime);
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval);
              executeVisionScan("", currentMime);
            }
          }, 200);
        }
      })();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFetcher.state, stageFetcher.data]);

  useEffect(() => {
    const isIdle = visionFetcher.state === "idle";
    const hasData = visionFetcher.data !== undefined && visionFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = visionFetcher.data;
      const isScan = data.intent === "visionScan";
      const isSuccess = data.success === true;
      const isError = data.success === false;

      (isScan && isSuccess) && (() => {
        setSharedFields(prev => ({
          ...prev,
          primary_use: data.tab2Data?.primary_use || data.primary_use || prev.primary_use,
          primary_medium: data.tab2Data?.primary_medium || data.primary_medium || prev.primary_medium,
          secondary_medium: data.tab2Data?.secondary_medium || data.secondary_medium || prev.secondary_medium,
          wire_material: data.tab2Data?.wire_material || data.wire_material || prev.wire_material,
          setting_ready: data.tab2Data?.setting_ready || data.setting_ready || prev.setting_ready,
          bail_included: data.tab2Data?.bail_included || data.bail_included || prev.bail_included
        }));

        setPieces(prev => prev.map(p => {
          let updated = { ...p };
          const pId = data.tab2Data?.pieceId || data.pieceId;
          (p.id === pId) && (() => {
            const desc = data.tab2Data?.generated_description || data.description;
            const tColor = data.tab2Data?.primary_color || data.color;
            const tShape = data.tab2Data?.cut_and_shape || data.cut_and_shape;
            const tFinish = data.tab2Data?.surface_finish || data.surface_finish;
            const tDims = data.tab2Data?.dimensions_mm || data.dimensions_mm;
            const tSeo = data.tab2Data?.seo_title || data.seo_title;

            (desc !== undefined && desc !== "") && (updated.generated_description = desc);
            (tColor !== undefined && tColor !== "") && (updated.color = tColor);
            (tShape !== undefined && tShape !== "") && (updated.cut_and_shape = tShape);
            (tFinish !== undefined && tFinish !== "") && (updated.surface_finish = tFinish);
            (tDims !== undefined && tDims !== "") && (updated.dimensions_mm = tDims);
            (tSeo !== undefined && tSeo !== "") && (updated.seo_title = tSeo);
            updated.scanError = "";
            window.shopify?.toast?.show("Scan complete — fields loaded");
          })();
          return updated;
        }));
      })();

      (isScan && isError) && (() => {
        setPieces(prev => prev.map(p => {
          let updated = { ...p };
          // If the pieceId isn't returned due to a hard crash, default to the first piece in the array
          const targetId = data.pieceId || latestPieces.current[0]?.id;
          (p.id === targetId) && (() => {
            let errStr = "Scan failed";
            data.error && (errStr = data.error);
            updated.scanError = errStr;
          })();
          return updated;
        }));
      })();
    })();
  }, [visionFetcher.state, visionFetcher.data]);

  useEffect(() => {
    const isIdle = autoFillFetcher.state === "idle";
    const hasData = autoFillFetcher.data !== undefined && autoFillFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = autoFillFetcher.data;
      (data.geoFields) && (() => {
        const geo = data.geoFields;
        if (geo.geoSource === "none") { window.shopify?.toast?.show("Not in geo database   enter manually", { duration: 3000 }); return; }
        setSharedFields(prev => {
          const updated = { ...prev };
          updated.mohs_hardness = geo.mohs_hardness ?? geo.hardness;
          updated.luster = geo.luster;
          updated.fracture_pattern = geo.fracture_pattern ?? geo.fracture;
          updated.cleavage = geo.cleavage;
          updated.specific_gravity = geo.specific_gravity;
          updated.diaphaneity = geo.diaphaneity;
          updated.crystal_system = geo.crystal_system;
          updated.geological_era = geo.geological_era;
          updated.geological_age = geo.geological_age;
          updated.mineral_class = geo.mineral_class;
          updated.rock_composition = geo.rock_composition;
          updated.rock_formation = geo.rock_formation;
          return updated;
        });
        setGeoToast(true);
      })();
    })();
  }, [autoFillFetcher.state, autoFillFetcher.data]);

  useEffect(() => {
    if (!autoFillFetcher.data?.titleParse) return;
    const parsed = autoFillFetcher.data.titleParse;

    setSharedFields(prev => {
      let resolvedCollectionLoc = parsed.collection_location || prev.collection_location;
      if (SHOPPED_ROCK_VENDORS.includes(parsed.origin_name)) {
        resolvedCollectionLoc = "Shopped Rock";
      }

      return {
        ...prev,
        material: "Stone",
        stone_family: normalizeDropdownValue("stone_family", parsed.stone_family?.trim()) || prev.stone_family,
        collection_name: parsed.collection_name || prev.collection_name,
        collection_location: resolvedCollectionLoc,
        origin_handle: parsed.origin_handle || prev.origin_handle, 
        origin_story: parsed.origin_story || prev.origin_story,
        specific_gravity: parsed.specific_gravity || prev.specific_gravity,
        diaphaneity: parsed.diaphaneity || prev.diaphaneity,
        crystal_system: parsed.crystal_system || prev.crystal_system,
        geological_era: parsed.geological_era || prev.geological_era,
        mineral_class: parsed.mineral_class || prev.mineral_class,
        rock_composition: parsed.rock_composition || prev.rock_composition,
        rock_formation: parsed.rock_formation || prev.rock_formation,
        geological_age: parsed.geological_age || prev.geological_age,
        fracture_pattern: parsed.fracture_pattern || prev.fracture_pattern,
        collection_story: parsed.collection_story || prev.collection_story,
        ...(parsed.title_tag && { title_tag: parsed.title_tag }),
        ...(parsed.description_tag && { description_tag: parsed.description_tag }),
        ...(parsed.google_product_category && { google_product_category: parsed.google_product_category }),
        ...(parsed.target_gender && { target_gender: parsed.target_gender }),
        ...(parsed.age_group && { age_group: parsed.age_group }),
        ...(parsed.condition && { condition: parsed.condition }),
        ...(parsed.geological_age && { geological_age: parsed.geological_age }),
        ...(parsed.fracture_pattern && { fracture_pattern: parsed.fracture_pattern }),
        ...(parsed.mohs_hardness && { mohs_hardness: parsed.mohs_hardness }),
        ...(parsed.luster && { luster: parsed.luster }),
        ...(parsed.fracture && { fracture: parsed.fracture }),
        ...(parsed.cleavage && { cleavage: parsed.cleavage }),
        ...(parsed.specific_gravity && { specific_gravity: parsed.specific_gravity }),
        ...(parsed.diaphaneity && { diaphaneity: parsed.diaphaneity }),
        ...(parsed.crystal_system && { crystal_system: parsed.crystal_system }),
        ...(parsed.geological_era && { geological_era: parsed.geological_era }),
        ...(parsed.mineral_class && { mineral_class: parsed.mineral_class }),
        ...(parsed.rock_composition && { rock_composition: parsed.rock_composition }),
        ...(parsed.rock_formation && { rock_formation: parsed.rock_formation }),
      };
    });

    if (parsed.canonical_title || parsed.product_title || parsed.seo_title) {
      const pieceTitleVal = parsed.canonical_title || parsed.product_title;
      setPieces(prev => prev.map((p, i) =>
        p.id === lastScannedPieceId || (!lastScannedPieceId && i === 0)
          ? { ...p, piece_name: pieceTitleVal, seo_title: parsed.seo_title, handle: parsed.handle, canonical_title: parsed.canonical_title }
          : p
      ));
    }

    if (parsed.needs_new_origin_page) {
      setTitleToastMsg("⚠️ No origin page found — create one for: " + parsed.origin_name);
      setTitleToastError(true);
      setTitleToastActive(true); setTimeout(() => setTitleToastActive(false), 3000);
    } else {
      setTitleToastMsg("Title parsed — fields pre-filled");
      setTitleToastError(false);
      setTitleToastActive(true); setTimeout(() => setTitleToastActive(false), 3000);
    }

  }, [autoFillFetcher, autoFillFetcher.data, lastScannedPieceId]);

  useEffect(() => {
    const isIdle = descriptionFetcher.state === "idle";
    const hasData = descriptionFetcher.data !== undefined && descriptionFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = descriptionFetcher.data;
      const isDesc = data.intent === "generateDescription";
      const isSuccess = data.success === true;

      (isDesc && isSuccess) && (() => {
        let descStr = "";
        data.description && (descStr = data.description);
        setPieces(prev => prev.map((p, i) =>
          p.id === data.pieceId || (!data.pieceId && i === 0)
            ? { ...p, generated_description: descStr, seo_title: data.seo_title || p.seo_title }
            : p
        ));
      })();
    })();
  }, [descriptionFetcher.state, descriptionFetcher.data]);

  useEffect(() => {
    const stagedUrl = pieces[0]?.stagedResourceUrls?.[0];
    (stagedUrl && stagedUrl !== "") && (() => {
      window.shopify?.toast?.show("Photo ready — tap Scan to generate description");
    })();
  }, [pieces[0]?.stagedResourceUrls?.[0]]);

  let isSubmitting = false;
  (fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct") && (isSubmitting = true);

  let isDescLoading = false;
  (descriptionFetcher.state !== "idle") && (isDescLoading = true);

  const rescuedByOptions = ["", "Bob", "Janyce", "Bob and Janyce"];
  const treatmentStatusOptions = ["100% Natural/Untreated", "Heat Treated", "Dyed", "Stabilized", "Irradiated", "Coated"];
  const surfaceFinishOptions = ["", "High Polish", "Matte", "Satin", "Hand Polish", "Natural"];

  const isJewelry = ["Pendant (Finished Jewelry)", "Wire Wrap (Finished Jewelry)", "Ring / Bezel Setting", "Pendant", "Wire Wrap", "Ring", "Necklace", "Earrings", "Bracelet", "Jewelry", "Wearable Art"].some(type => (sharedFields.primary_use || "").includes(type));

  const combinedData = { ...sharedFields, ...(pieces[0] || {}) };
  const scanKeys = [
    ...ROCKHOUND_FIELDS.map(f => f.key),
    "origin_story",
    "price",
    "honest_flaws_and_character",
    "stone_shape",
    "mohs_hardness",
    "luster",
    "fracture_pattern",
    "cleavage",
    "specific_gravity",
    "diaphaneity",
    "crystal_system",
    "geological_era",
    "mineral_class",
    "rock_composition",
    "rock_formation",
    "geological_age",
    "age_group",
    "target_gender",
    "color_pattern",
    "jewelry_type",
    "necklace_design",
    "chain_link_type",
    "jewelry_finding_type",
    "authenticity",
    "rarity",
    "condition",
    "found_object",
    "setting_ready",
    "bail_included",
    "wire_material",
    "seo_title"
  ];

  const actionData = fetcher.data;
  let useSaved = false;
  (actionData?.success === true) && (useSaved = true);

  const savedMap = {};
  (actionData && actionData.savedMetafields) && actionData.savedMetafields.forEach(mf => { savedMap[mf.key] = mf.value; });

  const renderLabel = (text, key, val) => {
    const status = getFieldStatus(key, val);
    const isFilled = status === "green";
    const isOptionalEmpty = status === "yellow";
    const isRequiredEmpty = status === "red";

    let dotColor = "#FFC453";
    isFilled && (dotColor = "#008060");
    isRequiredEmpty && (dotColor = "#D72C0D");

    return (
      <span style={{ fontSize: "14px", fontWeight: "600" }}>
        <span style={{ color: dotColor, fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center", marginRight: "4px" }}>●</span>
        {text}
      </span>
    );
  };

  const filteredPieces = pieces.filter(piece =>
    piece.piece_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  let isScanningVision = false;
  (stageFetcher.state !== "idle") && (isScanningVision = true);
  (visionFetcher.state !== "idle") && (isScanningVision = true);

  const currentWordCount = (pieces[0]?.generated_description || "").trim().split(/\s+/).filter(Boolean).length;
  const wordCountTone = currentWordCount > 100 ? "critical" : "subdued";

  const requiredPanelFields = [
    "piece_name", "price", "weight_grams", "material", "stone_family",
    "collection_name", "origin_handle", "rescued_by", "treatment_status",
    "origin_story", "primary_use", "seo_title"
  ];

  const getVal = (key, defaultSource) => {
    return (useSaved && savedMap[key] !== undefined) ? savedMap[key] : defaultSource;
  };

  const getPanelFieldStatus = (key, val) => {
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "false";
    const isReq = requiredPanelFields.includes(key);
    if (isFilled) return { dotColor: "#22c55e", text: "Filled", isFilled: true };
    if (isReq) return { dotColor: "#ef4444", text: "Required — Empty", isFilled: false };
    return { dotColor: "#eab308", text: "Optional — Empty", isFilled: false };
  };

  const dot = (color) => (
    <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", backgroundColor: color, marginRight: 6, verticalAlign: "middle" }} />
  );

  const renderPanelRow = (label, key, val) => {
    const status = getPanelFieldStatus(key, val);
    let displayVal = "";
    if (status.isFilled) {
      displayVal = String(val);
      if (displayVal.length > 60) displayVal = displayVal.substring(0, 60) + "...";
    }

    return (
      <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#f4f6f8", minWidth: 0 }}>
        {dot(status.dotColor)}
        <span style={{ fontWeight: "600", whiteSpace: "nowrap" }}>{label}:</span>
        <span style={{ color: status.dotColor, whiteSpace: "nowrap" }}>{status.text}</span>
        {status.isFilled && <span style={{ color: "#a6a6a6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>— {displayVal}</span>}
      </div>
    );
  };

  const showJewelrySpecsPanel = (sharedFields.primary_use || "").toLowerCase().includes("jewelry");

  return (
    <Frame>
      <BlockStack gap="600">
        <Banner title="Machine Auto-Pilot Active — No Typing Required for Studio Constants:" tone="success">
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              ✔ Handcrafted & Rescued by: <strong>Bob and Janyce</strong> | ✔ OOAK: <strong>True</strong> | ✔ Treatment: <strong>100% Natural/Untreated</strong>
            </Text>
            <Text as="p" variant="bodyMd">
              ✔ Google Feed: <strong>Active (Adult/Unisex/New)</strong> | ✔ Geo-Vault: <strong>Auto-Fills 12 Minerals Specs from Title Delimiters</strong>
            </Text>
          </BlockStack>
        </Banner>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>Section A: Per-Piece Details</Text>

            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  fontSize: "18px",
                  border: "2px solid #000",
                  borderRadius: "4px",
                  padding: "8px 40px 8px 16px",
                  boxSizing: "border-box"
                }}
              />
              {searchQuery !== "" && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    fontSize: "20px",
                    cursor: "pointer",
                    padding: "4px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#5c5f62"
                  }}
                >✕</button>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {filteredPieces.map((piece, index) => {
                
                let isScanning = false;
                (stageFetcher.state !== "idle" && stageFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (visionFetcher.state !== "idle" && visionFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (autoFillFetcher.state !== "idle" && autoFillFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (piece.isUploading) && (isScanning = true);

                let hasScanError = false;
                (piece.scanError && piece.scanError !== "") && (hasScanError = true);

                let hasPhotos = false;
                (piece.photoFiles && piece.photoFiles.length > 0) && (hasPhotos = true);

                let disableScan = true;
                (hasPhotos) && (disableScan = false);

                let rowTopDotColor = "#C62828";
                (hasPhotos) && (rowTopDotColor = "#2E7D32");

                let rowDescDotColor = "#C62828";
                (piece.generated_description && piece.generated_description !== "") && (rowDescDotColor = "#2E7D32");

                return (
                  <div key={piece.id} style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "24px", borderBottom: "1px solid #e1e3e5" }}>
                    
                    <div style={{ display: "flex", alignItems: "end", gap: "16px" }}>
                      <div style={{ flexGrow: 1, minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Piece Name", "piece_name", piece.piece_name)}
                          value={piece.piece_name}
                          onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                          onBlur={() => handlePieceNameBlur(piece.id, piece.piece_name)}
                          autoComplete="off"
                        />
                        <div style={{ marginTop: "4px" }}>
                          <Text variant="bodySm" tone="subdued" as="p">
                            Format: Stone Family — Origin — Piece Name (e.g. Tiger's Eye — Irv's — Tiger Fly)
                          </Text>
                        </div>
                      </div>

                      <div style={{ minHeight: "54px", width: "120px" }}>
                        <Button
                          size="large"
                          tone="critical"
                          fullWidth
                          onClick={() => handleRemoveRow(piece.id)}
                          disabled={pieces.length <= 1}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                      <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
                        <circle cx="9" cy="9" r="9" fill={rowTopDotColor} />
                      </svg>
                      <Text variant="headingMd" as="h3" fontWeight="bold">Stone Photos</Text>
                    </div>

                    <DropZone 
                      accept="image/jpeg, image/png, image/gif" 
                      type="image" 
                      allowMultiple 
                      onDrop={(_dropFiles, acceptedFiles) => handleDropZoneDrop(piece.id, acceptedFiles)}
                    >
                      <DropZone.FileUpload actionTitle="Drop photos here or click to upload" />
                    </DropZone>
                    
                    {hasPhotos && (
                      <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap", paddingTop: "8px", paddingRight: "8px" }}>
                        {piece.photoPreviewUrls.map((url, i) => (
                          <div key={i} style={{ position: "relative", width: "80px", height: "80px" }}>
                            <img src={url} alt={`Preview ${i}`} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                handleRemoveRowPhoto(piece.id, i);
                              }}
                              style={{
                                position: "absolute",
                                top: "-12px",
                                right: "-12px",
                                width: "48px",
                                height: "48px",
                                background: "#ffffff",
                                border: "1px solid #c9cccf",
                                borderRadius: "24px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "16px",
                                fontWeight: "bold",
                                color: "#202223",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                                zIndex: 10
                              }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <Text as="p" style={{ fontSize: "14px", marginTop: "4px", color: "#6d7175" }}>
                      {piece.photoFiles.length} of 5 photos
                    </Text>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <Button
                        onClick={() => handleScanGeminiPhotos(piece)}
                        loading={isScanning}
                        disabled={disableScan}
                      >
                        {isScanning && <Spinner size="small" />}
                        Scan with Gemini
                      </Button>
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={
                          <div style={{ display: "flex", alignItems: "center", justify: "space-between", width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
                                <circle cx="9" cy="9" r="9" fill={rowDescDotColor} />
                              </svg>
                              <Text variant="headingMd" as="h3">Description</Text>
                            </div>
                            <Text variant="bodySm" tone={wordCountTone} as="span">
                              {currentWordCount}/100 words {currentWordCount > 100 && "(Exceeds 100-Word Law)"}
                            </Text>
                          </div>
                        }
                        value={piece.generated_description}
                        onChange={(v) => handlePieceChange(piece.id, "generated_description", v)}
                        multiline={6}
                        autoComplete="off"
                        placeholder="Gemini will generate a poetic, spare description under 100 words..."
                      />
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("SEO Title", "seo_title", piece.seo_title)}
                        value={piece.seo_title}
                        onChange={(v) => handlePieceChange(piece.id, "seo_title", v)}
                        autoComplete="off"
                        placeholder="Keyword-rich title for Google..."
                      />
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Artist Notes", "artist_notes", piece.artist_notes)}
                        value={piece.artist_notes}
                        onChange={(v) => handlePieceChange(piece.id, "artist_notes", v)}
                        multiline={3}
                        autoComplete="off"
                        placeholder="Internal shop notes about this stone's character..."
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Price", "price", piece.price)}
                          value={piece.price}
                          onChange={(v) => handlePieceChange(piece.id, "price", v)}
                          autoComplete="off"
                          placeholder="e.g. 45.00"
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Weight (grams)", "weight_grams", piece.weight_grams)}
                          value={piece.weight_grams}
                          onChange={(v) => handlePieceChange(piece.id, "weight_grams", v)}
                          autoComplete="off"
                          placeholder="e.g. 14.5"
                        />
                      </div>
                    </div>
                    <TextField
                      label={renderLabel("Shipping Weight (oz)", "shipping_weight_oz", piece.shipping_weight_oz)}
                      value={piece.shipping_weight_oz}
                      onChange={(v) => handlePieceChange(piece.id, "shipping_weight_oz", v)}
                      placeholder="e.g. 1.5"
                      type="number"
                    />

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "16px" }}>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Dimensions (mm)", "dimensions_mm", piece.dimensions_mm)}
                          value={piece.dimensions_mm}
                          onChange={(v) => handlePieceChange(piece.id, "dimensions_mm", v)}
                          autoComplete="off"
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Cut & Shape", "cut_and_shape", piece.cut_and_shape)}
                          value={piece.cut_and_shape}
                          onChange={(v) => handlePieceChange(piece.id, "cut_and_shape", v)}
                          autoComplete="off"
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <Select
                          label={renderLabel("Surface Finish", "surface_finish", piece.surface_finish)}
                          options={[...surfaceFinishOptions.map(o => ({ label: o, value: o }))]}
                          value={piece.surface_finish}
                          onChange={(v) => handlePieceChange(piece.id, "surface_finish", v)}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Color", "color", piece.color)}
                          value={piece.color}
                          onChange={(v) => handlePieceChange(piece.id, "color", v)}
                          autoComplete="off"
                          placeholder="Primary color"
                        />
                      </div>
                    </div>

                    {hasScanError && (
                      <Banner tone="critical" title="Scan Failed">
                        <Text as="p" style={{ fontSize: "14px" }}>{piece.scanError}</Text>
                      </Banner>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ minHeight: "54px", marginTop: "16px" }}>
              <Button
                icon={PlusIcon}
                size="large"
                onClick={handleAddRow}
              >
                Add Row
              </Button>
            </div>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>Section B: Shared Batch Fields</Text>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Material", "material", sharedFields.material)}
                  value={sharedFields.material}
                  onChange={(v) => handleSharedFieldChange("material", v)}
                  autoComplete="off"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Stone Family", "stone_family", sharedFields.stone_family)}
                  options={[{ label: "Select stone family...", value: "" }, ...DROPDOWN_OPTIONS.stone_family]}
                  value={sharedFields.stone_family}
                  onChange={(v) => handleStoneFamilyChange(v)}
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Collection Name", "collection_name", sharedFields.collection_name)}
                  value={sharedFields.collection_name}
                  onChange={(v) => handleSharedFieldChange("collection_name", v)}
                  autoComplete="off"
                />
              </div>
              
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Origin Handle (Slug)", "origin_handle", sharedFields.origin_handle)}
                  value={sharedFields.origin_handle}
                  onChange={(v) => handleSharedFieldChange("origin_handle", v)}
                  autoComplete="off"
                  placeholder="e.g. yakima-river-chert-road"
                />
              </div>

              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Rescued By", "rescued_by", sharedFields.rescued_by)}
                  options={[...rescuedByOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.rescued_by}
                  onChange={(v) => handleSharedFieldChange("rescued_by", v)}
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Treatment Status", "treatment_status", sharedFields.treatment_status)}
                  options={[...treatmentStatusOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.treatment_status}
                  onChange={(v) => handleSharedFieldChange("treatment_status", v)}
                />
              </div>
              <div style={{ minHeight: "54px", gridColumn: "span 2" }}>
                <TextField
                  label={renderLabel("Origin Story", "origin_story", sharedFields.origin_story)}
                  value={sharedFields.origin_story}
                  onChange={(v) => handleSharedFieldChange("origin_story", v)}
                  autoComplete="off"
                  multiline={2}
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Product Type (Smart Switch)", "primary_use", sharedFields.primary_use)}
                  options={[{ label: "Select...", value: "" }, ...productTypeOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.primary_use}
                  onChange={(v) => handleSharedFieldChange("primary_use", v)}
                />
              </div>
            </div>
          </BlockStack>
        </Card>

        {isJewelry && (
          <Card padding="400" background="bg-surface-warning">
            <BlockStack gap="400">
              <InlineGrid columns={2} alignItems="center">
                <Text variant="headingMd" as="h2" tone="caution" style={{ fontSize: "16px", fontWeight: "bold" }}>⚙️ Bench Findings & Jewelry Specs</Text>
              </InlineGrid>
              <Divider />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Primary Medium", "primary_medium", sharedFields.primary_medium)}
                    value={sharedFields.primary_medium}
                    onChange={(v) => handleSharedFieldChange("primary_medium", v)}
                    autoComplete="off"
                    placeholder="e.g. .925 Sterling Silver"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Secondary Medium", "secondary_medium", sharedFields.secondary_medium)}
                    value={sharedFields.secondary_medium}
                    onChange={(v) => handleSharedFieldChange("secondary_medium", v)}
                    autoComplete="off"
                    placeholder="e.g. 14k Gold Accents"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Wire Material", "wire_material", sharedFields.wire_material)}
                    value={sharedFields.wire_material}
                    onChange={(v) => handleSharedFieldChange("wire_material", v)}
                    autoComplete="off"
                    placeholder="e.g. Antiqued Copper Wire"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Bail Included", "bail_included", sharedFields.bail_included)}
                    value={sharedFields.bail_included}
                    onChange={(v) => handleSharedFieldChange("bail_included", v)}
                    autoComplete="off"
                    placeholder="e.g. Silver Filigree Pinch Bail"
                  />
                </div>
                <div style={{ minHeight: "54px", gridColumn: "span 2" }}>
                  <TextField
                    label={renderLabel("Setting Ready", "setting_ready", sharedFields.setting_ready)}
                    value={sharedFields.setting_ready}
                    onChange={(v) => handleSharedFieldChange("setting_ready", v)}
                    autoComplete="off"
                    placeholder="e.g. Ready to Wear (Chain Included) or Custom Blank"
                  />
                </div>
              </div>
            </BlockStack>
          </Card>
        )}

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>Section C: Generate Description</Text>
            <div style={{ minHeight: "54px" }}>
              <Button
                size="large"
                variant="primary"
                icon={MagicIcon}
                onClick={() => handleGenerateDescription({ sharedFields, pieces, descFetcher: descriptionFetcher })}
                loading={isDescLoading}
              >
                Write Description with Gemini
              </Button>
            </div>
            {pieces[0]?.generated_description !== "" && (
              <TextField
                label={
                  <div style={{ display: "flex", alignItems: "center", justify: "space-between", width: "100%" }}>
                    <span>Generated Description — edit before saving</span>
                    <Text variant="bodySm" tone={wordCountTone} as="span">
                      {currentWordCount}/100 words
                    </Text>
                  </div>
                }
                value={pieces[0]?.generated_description || ""}
                onChange={(v) => handlePieceChange(pieces[0]?.id, "generated_description", v)}
                multiline={10}
                autoComplete="off"
              />
            )}
          </BlockStack>
        </Card>

        {statusMessage !== "" && (
          <div style={{ minHeight: "54px" }}>
            <Banner tone="success" title="Operation Successful">
              <Text as="p" style={{ fontSize: "14px" }}>{statusMessage}</Text>
            </Banner>
          </div>
        )}

        {errorMessage !== "" && (
          <div style={{ minHeight: "54px" }}>
            <Banner tone="critical" title="Operation Failed">
              <Text as="p" style={{ fontSize: "14px" }}>{errorMessage}</Text>
            </Banner>
          </div>
        )}

        <div style={{ minHeight: "54px", marginBottom: "16px" }}>
          <Button
            size="large"
            tone="base"
            fullWidth
            onClick={handleCopyFieldReportTab1}
          >
            Copy Field Report
          </Button>
        </div>

        <div style={{ minHeight: "54px" }}>
          {statusMessage !== "" ? (
            <Button
              size="large"
              variant="primary"
              fullWidth
              onClick={handleStartNewBatch}
            >
              Start New Batch (Wipe Section A, Keep Section B)
            </Button>
          ) : (
            <Button
              size="large"
              variant="primary"
              tone="success"
              fullWidth
              onClick={handleCreateAll}
              loading={isSubmitting}
              disabled={isSubmitting}
            >
              Create All Pieces
            </Button>
          )}
        </div>

        <div style={{ background: "#1a1a1a", padding: "20px", borderRadius: "8px", marginTop: "16px" }}>
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold", color: "#ffffff" }}>Metafield Status Panel — All Fields</Text>

            <div style={{ background: "#333333", padding: "6px 12px", borderRadius: "4px", width: "100%", fontWeight: "bold", color: "#ffffff", fontSize: "12px" }}>SECTION 1 — Per-Piece Fields</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {renderPanelRow("Piece Name", "piece_name", getVal("piece_name", pieces[0]?.piece_name))}
              {renderPanelRow("Price", "price", getVal("price", pieces[0]?.price))}
              {renderPanelRow("Weight (grams)", "weight_grams", getVal("weight_grams", pieces[0]?.weight_grams))}
              {renderPanelRow("Shipping Weight (oz)", "shipping_weight_oz", getVal("shipping_weight_oz", pieces[0]?.shipping_weight_oz))}
              {renderPanelRow("Dimensions (mm)", "dimensions_mm", getVal("dimensions_mm", pieces[0]?.dimensions_mm))}
              {renderPanelRow("Cut & Shape", "cut_and_shape", getVal("cut_and_shape", pieces[0]?.cut_and_shape))}
              {renderPanelRow("Surface Finish", "surface_finish", getVal("surface_finish", pieces[0]?.surface_finish))}
              {renderPanelRow("Color", "color", getVal("color", pieces[0]?.color))}
              {renderPanelRow("Generated Description", "generated_description", getVal("generated_description", pieces[0]?.generated_description))}
              {renderPanelRow("SEO Title", "seo_title", getVal("seo_title", pieces[0]?.seo_title))}
              {renderPanelRow("Artist Notes", "artist_notes", getVal("artist_notes", pieces[0]?.artist_notes))}
              {renderPanelRow("Stone Shape", "stone_shape", getVal("stone_shape", combinedData.stone_shape))}
              {renderPanelRow("Color Pattern", "color_pattern", getVal("color_pattern", combinedData.color_pattern))}
              {renderPanelRow("Handcrafted By", "handcrafted_by", getVal("handcrafted_by", combinedData.handcrafted_by))}
              {renderPanelRow("Is One of a Kind", "is_ooak", getVal("is_ooak", combinedData.is_ooak))}
              {renderPanelRow("Treated", "treated", getVal("treated", combinedData.treated))}
            </div>

            <div style={{ background: "#333333", padding: "6px 12px", borderRadius: "4px", width: "100%", fontWeight: "bold", color: "#ffffff", fontSize: "12px", marginTop: "8px" }}>SECTION 2 — Shared Batch Fields</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {renderPanelRow("Material", "material", getVal("material", sharedFields.material))}
              {renderPanelRow("Stone Family", "stone_family", getVal("stone_family", sharedFields.stone_family))}
              {renderPanelRow("Collection Name", "collection_name", getVal("collection_name", sharedFields.collection_name))}
              {renderPanelRow("Origin Handle", "origin_handle", getVal("origin_handle", sharedFields.origin_handle))}
              {renderPanelRow("Rescued By", "rescued_by", getVal("rescued_by", sharedFields.rescued_by))}
              {renderPanelRow("Treatment Status", "treatment_status", getVal("treatment_status", sharedFields.treatment_status))}
              {renderPanelRow("Origin Story", "origin_story", getVal("origin_story", sharedFields.origin_story))}
              {renderPanelRow("Primary Use", "primary_use", getVal("primary_use", sharedFields.primary_use))}
              {renderPanelRow("Honest Flaws", "honest_flaws_and_character", getVal("honest_flaws_and_character", combinedData.honest_flaws_and_character))}
              {renderPanelRow("Found Object", "found_object", getVal("found_object", combinedData.found_object))}
              {renderPanelRow("Collection Location", "collection_location", getVal("collection_location", combinedData.collection_location))}
              {renderPanelRow("Collection Date", "collection_date", getVal("collection_date", combinedData.collection_date))}
            </div>

            {showJewelrySpecsPanel && (
              <>
                <div style={{ background: "#333333", padding: "6px 12px", borderRadius: "4px", width: "100%", fontWeight: "bold", color: "#ffffff", fontSize: "12px", marginTop: "8px" }}>SECTION 3 — Jewelry Specs</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {renderPanelRow("Primary Medium", "primary_medium", getVal("primary_medium", sharedFields.primary_medium))}
                  {renderPanelRow("Secondary Medium", "secondary_medium", getVal("secondary_medium", sharedFields.secondary_medium))}
                  {renderPanelRow("Wire Material", "wire_material", getVal("wire_material", sharedFields.wire_material))}
                  {renderPanelRow("Bail Included", "bail_included", getVal("bail_included", sharedFields.bail_included))}
                  {renderPanelRow("Setting Ready", "setting_ready", getVal("setting_ready", sharedFields.setting_ready))}
                  {renderPanelRow("Jewelry Type", "jewelry_type", getVal("jewelry_type", combinedData.jewelry_type))}
                  {renderPanelRow("Necklace Design", "necklace_design", getVal("necklace_design", combinedData.necklace_design))}
                  {renderPanelRow("Chain Link Type", "chain_link_type", getVal("chain_link_type", combinedData.chain_link_type))}
                  {renderPanelRow("Finding Type", "jewelry_finding_type", getVal("jewelry_finding_type", combinedData.jewelry_finding_type))}
                </div>
              </>
            )}

            <div style={{ background: "#333333", padding: "6px 12px", borderRadius: "4px", width: "100%", fontWeight: "bold", color: "#ffffff", fontSize: "12px", marginTop: "8px" }}>SECTION 4 — Geo Vault Fields</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {renderPanelRow("Mohs Hardness", "mohs_hardness", getVal("mohs_hardness", sharedFields.mohs_hardness))}
              {renderPanelRow("Specific Gravity", "specific_gravity", getVal("specific_gravity", sharedFields.specific_gravity))}
              {renderPanelRow("Mineral Class", "mineral_class", getVal("mineral_class", sharedFields.mineral_class))}
              {renderPanelRow("Crystal System", "crystal_system", getVal("crystal_system", sharedFields.crystal_system))}
              {renderPanelRow("Rock Composition", "rock_composition", getVal("rock_composition", sharedFields.rock_composition))}
              {renderPanelRow("Rock Formation", "rock_formation", getVal("rock_formation", sharedFields.rock_formation))}
              {renderPanelRow("Geological Era", "geological_era", getVal("geological_era", sharedFields.geological_era))}
              {renderPanelRow("Geological Age", "geological_age", getVal("geological_age", sharedFields.geological_age))}
              {renderPanelRow("Fracture Pattern", "fracture_pattern", getVal("fracture_pattern", sharedFields.fracture_pattern))}
              {renderPanelRow("Diaphaneity", "diaphaneity", getVal("diaphaneity", sharedFields.diaphaneity))}
              {renderPanelRow("Luster", "luster", getVal("luster", sharedFields.luster))}
              {renderPanelRow("Cleavage", "cleavage", getVal("cleavage", sharedFields.cleavage))}
              {renderPanelRow("Fracture", "fracture", getVal("fracture", sharedFields.fracture))}
            </div>

            <div style={{ background: "#333333", padding: "6px 12px", borderRadius: "4px", width: "100%", fontWeight: "bold", color: "#ffffff", fontSize: "12px", marginTop: "8px" }}>SECTION 5 — Google & SEO Fields</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {renderPanelRow("Google Product Category", "google_product_category", getVal("google_product_category", sharedFields.google_product_category))}
              {renderPanelRow("Age Group", "age_group", getVal("age_group", sharedFields.age_group))}
              {renderPanelRow("Target Gender", "target_gender", getVal("target_gender", sharedFields.target_gender))}
              {renderPanelRow("Condition", "condition", getVal("condition", sharedFields.condition))}
              {renderPanelRow("Authenticity", "authenticity", getVal("authenticity", combinedData.authenticity))}
              {renderPanelRow("Rarity", "rarity", getVal("rarity", combinedData.rarity))}
            </div>
          </BlockStack>
        </div>
      </BlockStack>
      {geoToast && <Toast content="Geo data loaded" onDismiss={() => setGeoToast(false)} />}
      {reportToastActive && <Toast content="Field Report Copied!" onDismiss={() => setReportToastActive(false)} />}
      {titleToastActive && (
        <Toast
          content={titleToastMsg}
          error={titleToastError}
          duration={3000}
          onDismiss={() => setTitleToastActive(false)}
        />
      )}
    </Frame>
  );
}
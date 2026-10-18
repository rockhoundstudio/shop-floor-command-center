// ==========================================================================
// ROCKHOUND STUDIO — TAB 1: NEW PRODUCT INTAKE BENCH
// File: app/routes/app.meta-injector.injector.jsx
// (Universal 62-Capability Registry Alignment & Source-Context Workflow)
// ==========================================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, DropZone, Spinner, Frame, Toast, InlineGrid, Divider, Badge } from "@shopify/polaris";
import { PlusIcon, MagicIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import {
  ROCKHOUND_FIELDS,
  DEFAULT_DROPDOWNS,
  CHANNEL_REQUIREMENTS,
  getFieldStatus,
  productTypeOptions,
  collectionLocationOptions,
  normalizeDropdownValue,
  DROPDOWN_OPTIONS,
  TARGET_KEYS,
  PRODUCT_TEMPLATE_GROUPS,
  FIELD_CATALOG,
  CANONICAL_CAPABILITY_FIELDS
} from "../utils/meta-injector.constants.jsx";
import { handleScanPhoto, handleGenerateDescription, buildMetafieldsJson, buildTitle } from "./app.meta-injector.intake-helpers.jsx";

function getDerivedMaterial(stoneFam) {
  if (!stoneFam) return "";
  return stoneFam.replace(/^(Dragon's Eye|Green|Blue|Fire|Rufus|Rainbow|Yellow|Red|Black|Oregon)\s+/i, "").trim();
}

function isSegmentedMarketingTitle(val) {
  if (typeof val !== "string") return false;
  return val.trim().split(/\s+[-—–]\s+/).length >= 3;
}

function hasMeaningfulValue(val) {
  if (val === undefined || val === null) return false;
  if (typeof val === "boolean") return true;
  if (typeof val === "number") return !Number.isNaN(val);
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return false;
  return String(val).trim() !== "";
}

function resolveIdentifierToPreserve(currentPieceName, parsedPieceName) {
  const existing = typeof currentPieceName === "string" ? currentPieceName.trim() : "";
  if (existing && !isSegmentedMarketingTitle(existing)) {
    return existing;
  }
  if (isSegmentedMarketingTitle(existing)) {
    const segs = existing.split(/\s+[-—–]\s+/);
    const tail = segs[segs.length - 1]?.trim() || "";
    if (tail) return tail;
  }
  const candidate = typeof parsedPieceName === "string" ? parsedPieceName.trim() : "";
  if (candidate && !isSegmentedMarketingTitle(candidate)) {
    return candidate;
  }
  return existing;
}

const PROTECTED_MANUAL_STORY_TITLES = [
  "the creek find",
  "the violet hour",
  "the statement"
];

function isManualStoryProtectedPiece(title, pieceName) {
  const combined = `${title || ""} ${pieceName || ""}`.toLowerCase();
  return PROTECTED_MANUAL_STORY_TITLES.some(protectedName => combined.includes(protectedName));
}

const PER_PIECE_CANONICAL_KEYS = new Set([
  "piece_name",
  "native_title",
  "native_description",
  "native_seo_title",
  "native_seo_description",
  "native_price",
  "native_shipping_weight",
  "native_image_alt",
  "dimensions_mm",
  "weight_grams",
  "overall_solid_length_in",
  "whole_product_weight_grams",
  "chain_cord_length_in",
  "accessory_dimensions_mm",
  "fitting_opening_mm",
  "cut_and_shape",
  "stone_shape",
  "surface_finish",
  "color",
  "primary_color",
  "secondary_colors",
  "color_pattern"
]);

export function NewProductIntakeTab({ fetcher }) {
  const stageFetcher = useFetcher();
  const autoFillFetcher = useFetcher();
  const visionFetcher = useFetcher();
  const descriptionFetcher = useFetcher();

  const initialSharedState = {
    material: "",
    stone_family: "",
    collection_name: "",
    collection_location: "",
    collection_date: "",
    origin_location: "",
    origin_handle: "",
    origin_page_handle: "",
    rescued_by: "Bob and Janyce",
    treatment_status: "100% Natural/Untreated",
    origin_story: "",
    stone_story: "",
    primary_use: "",
    is_ooak: "Yes",
    is_one_of_a_kind: "Yes",
    treated: "Untreated — Natural",
    found_object: "true",
    condition: "",
    target_gender: "",
    age_group: "",
    "google.age_group": "",
    "google.condition": "",
    "google.target_gender": "",
    "mm-google-shopping.custom_product": "",
    google_product_category: "Apparel & Accessories > Jewelry",
    primary_medium: "",
    secondary_medium: "",
    setting_ready: "",
    bail_included: "",
    jewelry_finding_type: "",
    wire_material: "",
    chain_material: "",
    chain_link_type: "",
    necklace_design: "",
    jewelry_type: "",
    luster: "",
    mohs_hardness: "",
    specific_gravity: "",
    fracture_pattern: "",
    cleavage: "",
    diaphaneity: "",
    crystal_system: "",
    geological_age: "",
    geological_era: "",
    mineral_class: "",
    rock_composition: "",
    rock_formation: "",
    tenacity: "",
    custom_product: "",
    authenticity: "",
    rarity: "",
    std_construction: "",
    std_material_origin: "",
    std_product_classification: "",
    std_product_use: ""
  };

  const makeInitialPieceState = (idSuffix = "") => ({
    id: `${Date.now()}${idSuffix}`,
    piece_name: "",
    canonical_title: "",
    native_title: "",
    official_name: "",
    dimensions_mm: "",
    overall_solid_length_in: "",
    whole_product_weight_grams: "",
    chain_cord_length_in: "",
    accessory_dimensions_mm: "",
    fitting_opening_mm: "",
    cut_type: "",
    cut_and_shape: "",
    stone_shape: "",
    surface_finish: "",
    color: "",
    primary_color: "",
    secondary_colors: "",
    color_pattern: "",
    price: "",
    native_price: "",
    weight_grams: "",
    shipping_weight_oz: "",
    native_shipping_weight: "",
    photoFiles: [],
    photoPreviewUrls: [],
    photos: [],
    imageBase64: "",
    imageMimeType: "",
    stagedResourceUrls: [],
    stagedUploadIndex: 0,
    generated_description: "",
    native_description: "",
    seo_title: "",
    native_seo_title: "",
    native_seo_description: "",
    native_image_alt: "",
    scanError: "",
    scanToken: "",
    isUploading: false,
    character_marks: "",
    honest_flaws_and_character: "",
    alt_text: "",
    productId: null,
    status: "DRAFT",
    manualPieceEdits: {}
  });

  const [sharedFields, setSharedFields] = useState(initialSharedState);
  const [pieces, setPieces] = useState(() => [makeInitialPieceState()]);
  const [activePieceId, setActivePieceId] = useState("");

  const latestPieces = useRef(pieces);
  const latestShared = useRef(sharedFields);
  const lastAutofilledTitle = useRef("");

  useEffect(() => { latestPieces.current = pieces; }, [pieces]);
  useEffect(() => { latestShared.current = sharedFields; }, [sharedFields]);

  useEffect(() => {
    if (pieces.length > 0 && (!activePieceId || !pieces.some(p => p.id === activePieceId))) {
      setActivePieceId(pieces[0].id);
    }
  }, [pieces, activePieceId]);

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

  const statusFetcher = useFetcher();

  const isCapabilityHeldReadOnly = useCallback((fieldDef) => {
    if (!fieldDef) return true;
    const identity = fieldDef.registryIdentity || `${fieldDef.namespace || "custom"}.${fieldDef.metaKey || fieldDef.key}`;
    return Boolean(
      fieldDef.mappingStatus === "pending_read_only" ||
      fieldDef.storageVerified === false ||
      fieldDef.writerVerified === false ||
      fieldDef.metaConfig?.definitionVerified === false ||
      fieldDef.producerAlignmentPending === true ||
      fieldDef.registryRole === "APPROVED_MEASUREMENT_ADDITION" ||
      fieldDef.owner === "variant_metafield" ||
      fieldDef.namespace === "shopify" ||
      identity === "mm-google-shopping.custom_product"
    );
  }, []);

  const getHoldExplanation = useCallback((fieldDef) => {
    if (!fieldDef) return { badge: "Read-Only", reason: "Connection pending." };
    const identity = fieldDef.registryIdentity || `${fieldDef.namespace || "custom"}.${fieldDef.metaKey || fieldDef.key}`;
    if (fieldDef.key === "native_image_alt") {
      return {
        badge: "Per-Image Alt",
        reason: "Editable per-piece image alt text; sent with uploaded media."
      };
    }
    if (fieldDef.namespace === "shopify" || fieldDef.role === "standardized_attribute") {
      return {
        badge: "Read-Only (Standardized)",
        reason: "Standardized attribute (pending_read_only). Reference matching occurs in Tab 3 after product creation."
      };
    }
    if (fieldDef.storageVerified === false || fieldDef.writerVerified === false || fieldDef.registryRole === "APPROVED_MEASUREMENT_ADDITION") {
      return {
        badge: "Read-Only (Storage Unverified)",
        reason: "Proposed measurement capability (#58–62): storage/writer contract unverified (writes disabled)."
      };
    }
    if (fieldDef.producerAlignmentPending === true) {
      return {
        badge: "Read-Only (Producer Alignment Pending)",
        reason: "Producer/writer definition alignment pending verification (writes disabled)."
      };
    }
    if (identity === "mm-google-shopping.custom_product") {
      return {
        badge: "Read-Only (Channel Rule Pending)",
        reason: "Google custom_product boolean rules pending verification (writes disabled)."
      };
    }
    if (fieldDef.owner === "variant_metafield") {
      return {
        badge: "Read-Only (Variant Owner Hold)",
        reason: "Variant-owned metafield (PRODUCTVARIANT) held: product-level writer route not applicable."
      };
    }
    return {
      badge: "Read-Only (Held)",
      reason: "Field contract held read-only (writes disabled)."
    };
  }, []);

  const handleToggleStatus = useCallback((pieceId, currentStatus, productId) => {
    if (!productId) return;
    const newStatus = currentStatus === "ACTIVE" ? "DRAFT" : "ACTIVE";

    const fd = new FormData();
    fd.append("intent", "toggleStatus");
    fd.append("pieceId", productId);
    fd.append("newStatus", newStatus);
    
    setPieces(prev => prev.map(p => 
      p.id === pieceId ? { ...p, previousStatus: currentStatus, status: newStatus } : p
    ));

    statusFetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [statusFetcher]);

  useEffect(() => {
    if (statusFetcher.state === "idle" && statusFetcher.data) {
      const sData = statusFetcher.data;
      if (!sData.success || sData.status === "UNSUPPORTED_INTENT" || !sData.newStatus) {
        const targetProdId = sData.pieceId || sData.productId;
        setPieces(prev => prev.map(p =>
          (!targetProdId || p.productId === targetProdId) && p.previousStatus
            ? { ...p, status: p.previousStatus, previousStatus: undefined }
            : p
        ));
        setErrorMessage(sData.error || sData.message || "Status toggle failed: operation is not supported on this route.");
        if (window.shopify?.toast) window.shopify.toast.show("Status update failed", { isError: true });
      } else {
        if (window.shopify?.toast) window.shopify.toast.show(`Status changed to ${sData.newStatus}`);
      }
    }
  }, [statusFetcher.state, statusFetcher.data]);

  const handlePieceChange = useCallback((id, key, value, isManual = true) => {
    const fieldDef = FIELD_CATALOG.find(f => f.key === key || f.registryIdentity === key);
    if (fieldDef && isCapabilityHeldReadOnly(fieldDef) && key !== "native_image_alt" && key !== "alt_text") {
      return;
    }

    setPieces(prev => prev.map(p => {
      if (p.id !== id) return p;
      const nextManualEdits = isManual
        ? { ...(p.manualPieceEdits || {}), [key]: true }
        : (p.manualPieceEdits || {});

      const updated = { ...p, [key]: value, manualPieceEdits: nextManualEdits };

      if (key === "is_ooak" || key === "is_one_of_a_kind") {
        updated.is_ooak = value;
        updated.is_one_of_a_kind = value;
      } else if (key === "canonical_title" || key === "native_title") {
        updated.canonical_title = value;
        updated.native_title = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, canonical_title: true, native_title: true };
        }
      } else if (key === "generated_description" || key === "native_description") {
        updated.generated_description = value;
        updated.native_description = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, generated_description: true, native_description: true };
        }
      } else if (key === "seo_title" || key === "native_seo_title") {
        updated.seo_title = value;
        updated.native_seo_title = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, seo_title: true, native_seo_title: true };
        }
      } else if (key === "price" || key === "native_price") {
        updated.price = value;
        updated.native_price = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, price: true, native_price: true };
        }
      } else if (key === "shipping_weight_oz" || key === "native_shipping_weight") {
        updated.shipping_weight_oz = value;
        updated.native_shipping_weight = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, shipping_weight_oz: true, native_shipping_weight: true };
        }
      } else if (key === "alt_text" || key === "native_image_alt") {
        updated.alt_text = value;
        updated.native_image_alt = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, alt_text: true, native_image_alt: true };
        }
      } else if (key === "cut_and_shape") {
        updated.cut_and_shape = value;
        updated.cut_type = value;
        if (isManual) {
          updated.manualPieceEdits = { ...nextManualEdits, cut_and_shape: true };
        }
      } else if (key === "cut_type") {
        updated.cut_type = value;
        if (!hasMeaningfulValue(updated.cut_and_shape)) {
          updated.cut_and_shape = value;
        }
      } else if (key === "material") {
        updated.material = value;
        updated.stone_family = value;
      } else if (key === "stone_family") {
        updated.stone_family = value;
        if (!hasMeaningfulValue(updated.material)) {
          updated.material = getDerivedMaterial(value) || value;
        }
      } else if (key === "origin_page_handle" || key === "origin_handle") {
        updated.origin_page_handle = value;
        updated.origin_handle = value;
      }
      // Stone-only weight (weight_grams) must never populate or overwrite shipping_weight_oz
      return updated;
    }));
  }, [isCapabilityHeldReadOnly]);

  const handleSharedFieldChange = useCallback((key, value) => {
    const fieldDef = FIELD_CATALOG.find(f => f.key === key || f.registryIdentity === key);
    if (fieldDef && isCapabilityHeldReadOnly(fieldDef)) {
      return;
    }

    setSharedFields(prev => {
      const next = { ...prev, [key]: value };
      if (key === "is_ooak" || key === "is_one_of_a_kind") {
        next.is_ooak = value;
        next.is_one_of_a_kind = value;
      } else if (key === "origin_handle" || key === "origin_page_handle") {
        next.origin_handle = value;
        next.origin_page_handle = value;
      } else if (key === "material") {
        next.material = value;
        next.stone_family = value;
      } else if (key === "stone_family") {
        next.stone_family = value;
        if (!hasMeaningfulValue(prev.material)) {
          next.material = getDerivedMaterial(value) || value;
        }
      }
      // Never copy primary_medium (metal/hardware) into material
      return next;
    });
  }, [isCapabilityHeldReadOnly]);

  const handleStoneFamilyChange = useCallback((value) => {
    setSharedFields(prev => ({
      ...prev,
      stone_family: value,
      material: value || prev.material
    }));
  }, []);

  const handleScanGeminiPhotos = useCallback((piece) => {
    if (piece?.imageBase64) {
      handleScanPhoto({
        piece,
        updatePiece: (pid, k, v) => handlePieceChange(pid, k, v, false),
        visionFetcher,
        setErrorMessage,
        sharedFields: latestShared.current
      });
      return;
    }

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
  }, [stageFetcher, visionFetcher, handlePieceChange]);

  const handleFullRescan = useCallback((piece) => {
    if (!piece.imageBase64 && !(piece.stagedResourceUrls && piece.stagedResourceUrls.length > 0)) {
      if (window.shopify && window.shopify.toast) {
        window.shopify.toast.show("Photo required for Full Rescan", { isError: true });
      }
      return;
    }
    
    const currentShared = latestShared.current || {};
    const rawPieceName = (piece.piece_name || "").trim();
    const rawCanonical = (piece.canonical_title || piece.native_title || "").trim();
    const cleanHumanId = resolveIdentifierToPreserve(rawPieceName, "");
    const cName = piece.collection_name || currentShared.collection_name || "";
    const sIdentity = piece.material || currentShared.material || piece.stone_family || currentShared.stone_family || "";
    const oLocation = piece.origin_location || currentShared.origin_location || "";
    const oHandle = piece.origin_page_handle || piece.origin_handle || currentShared.origin_page_handle || currentShared.origin_handle || "";
    const oStory = piece.origin_story || currentShared.origin_story || "";

    let segmentedTitle = "";
    if (isSegmentedMarketingTitle(rawCanonical)) {
      segmentedTitle = rawCanonical;
    } else if (isSegmentedMarketingTitle(rawPieceName)) {
      segmentedTitle = rawPieceName;
    } else if (sIdentity && oLocation && cleanHumanId) {
      segmentedTitle = `${sIdentity} - ${oLocation} - ${cleanHumanId}`;
    }

    const formData = new FormData();
    formData.append("intent", "fullRescan");
    formData.append("pieceId", piece.id);
    formData.append("imageUrl", piece.stagedResourceUrls?.[0] || "");
    formData.append("pieceName", segmentedTitle || cleanHumanId);
    if (segmentedTitle) formData.append("productTitle", segmentedTitle);
    if (cleanHumanId) formData.append("humanPieceId", cleanHumanId);
    if (sIdentity) {
      formData.append("material", sIdentity);
      formData.append("stone_family", sIdentity);
    }
    if (oLocation) formData.append("origin_location", oLocation);
    if (oHandle) {
      formData.append("origin_page_handle", oHandle);
      formData.append("origin_handle", oHandle);
    }
    if (oStory) formData.append("origin_story", oStory);
    formData.append("collectionName", cName);
    if (cName) formData.append("collection_name", cName);
    formData.append("imageBase64", piece.imageBase64 || "");
    formData.append("imageMimeType", piece.imageMimeType || "image/jpeg");

    visionFetcher.submit(
      formData,
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  }, [visionFetcher]);

  const handlePieceNameBlur = useCallback((id, value) => {
    if (!value) return;
    const segments = value.split(/\s+[-—–]\s+/);
    
    if (segments.length === 3 && value !== lastAutofilledTitle.current) {
      const extractedIdentifier = segments[2].trim();
      setPieces(prev => prev.map(p =>
        p.id === id
          ? {
              ...p,
              canonical_title: value.trim(),
              native_title: value.trim(),
              piece_name: extractedIdentifier || p.piece_name
            }
          : p
      ));
      setLastScannedPieceId(id);
      lastAutofilledTitle.current = value; 
      
      const formData = new FormData();
      formData.append("intent", "titleParse");
      formData.append("pieceId", id);
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
            handlePieceChange(id, "imageBase64", base64String, false);
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
            handlePieceChange(id, "imageBase64", base64String, false);
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
    const newPiece = makeInitialPieceState(`_${Math.random().toString(36).slice(2, 7)}`);
    setPieces(prev => [...prev, newPiece]);
    setActivePieceId(newPiece.id);
  }, []);

  const handleRemoveRow = useCallback((id) => {
    setPieces(prev => prev.filter(p => p.id !== id));
  }, []);

  const selectedPieceForTemplate =
    pieces.find(p => p.id === activePieceId) || pieces[0] || makeInitialPieceState();

  const handleCopyFieldReportTab1 = useCallback(() => {
    const p = selectedPieceForTemplate || {};
    const report = `=== TAB 1 FIELD REPORT ===
piece_name: ${p.piece_name || "EMPTY"}
canonical_title: ${p.canonical_title || p.native_title || "EMPTY"}
generated_description: ${p.generated_description || p.native_description || "EMPTY"}
debug_origin: ${p.debug_origin || "EMPTY"}
seo_title: ${p.seo_title || p.native_seo_title || "EMPTY"}
native_seo_description: ${p.native_seo_description || "EMPTY"}
price: ${p.price || p.native_price || "EMPTY"}
weight_grams: ${p.weight_grams || "EMPTY"}
shipping_weight_oz: ${p.shipping_weight_oz || p.native_shipping_weight || "EMPTY"}
dimensions_mm: ${p.dimensions_mm || "EMPTY"}
cut_and_shape: ${p.cut_and_shape || p.cut_type || "EMPTY"}
stone_shape: ${p.stone_shape || "EMPTY"}
surface_finish: ${p.surface_finish || "EMPTY"}
color: ${p.color || "EMPTY"}
primary_color: ${p.primary_color || "EMPTY"}
color_pattern: ${p.color_pattern || "EMPTY"}
material: ${p.material || sharedFields.material || "EMPTY"}
is_one_of_a_kind: ${p.is_one_of_a_kind || sharedFields.is_one_of_a_kind || "EMPTY"}
jewelry_type: ${p.jewelry_type || sharedFields.jewelry_type || "EMPTY"}
imageBase64: ${p.imageBase64 ? "PRESENT" : "EMPTY"}
imageMimeType: ${p.imageMimeType || "EMPTY"}
stagedResourceUrls: ${(p.stagedResourceUrls && p.stagedResourceUrls.length > 0) ? p.stagedResourceUrls.join(", ") : "EMPTY"}
=== END REPORT ===`;

    navigator.clipboard.writeText(report).then(() => {
      setReportToastActive(true);
      setTimeout(() => setReportToastActive(false), 3000);
    }).catch(err => console.error("Clipboard copy failed", err));
  }, [selectedPieceForTemplate, sharedFields]);

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    const currentShared = latestShared.current;
    const currentPiece =
      latestPieces.current.find(p => p.id === activePieceId) ||
      latestPieces.current[0];

    if (!currentPiece) {
      setErrorMessage("No active piece found to create.");
      return;
    }

    let productType = "Wearable Art";
    (currentShared.primary_use && currentShared.primary_use !== "") && (productType = currentShared.primary_use);

    // Prefer authoritative canonical material, then legacy stone_family companion (never primary_medium)
    const derivedMaterial =
      (hasMeaningfulValue(currentPiece.material) ? String(currentPiece.material).trim() : "") ||
      (hasMeaningfulValue(currentShared.material) ? String(currentShared.material).trim() : "") ||
      (hasMeaningfulValue(currentPiece.stone_family) ? String(currentPiece.stone_family).trim() : "") ||
      getDerivedMaterial(currentShared.stone_family || "");

    const cleanPieceIdentifier = resolveIdentifierToPreserve(currentPiece.piece_name, "");
    const resolvedTitle =
      (hasMeaningfulValue(currentPiece.canonical_title) ? String(currentPiece.canonical_title).trim() : "") ||
      (hasMeaningfulValue(currentPiece.native_title) ? String(currentPiece.native_title).trim() : "") ||
      buildTitle({ ...currentShared, material: derivedMaterial }, { ...currentPiece, piece_name: cleanPieceIdentifier });

    if (!resolvedTitle) {
      setErrorMessage("Creation blocked: Product title or stone/piece identity is required before creating a product.");
      return;
    }

    const pieceForBuild = {
      ...currentPiece,
      piece_name: cleanPieceIdentifier,
      cut_and_shape: hasMeaningfulValue(currentPiece.cut_and_shape) ? currentPiece.cut_and_shape : (currentPiece.cut_type || ""),
      stone_shape: currentPiece.stone_shape,
      color: currentPiece.color,
      primary_color: currentPiece.primary_color,
      color_pattern: currentPiece.color_pattern,
      surface_finish: currentPiece.surface_finish,
      dimensions_mm: currentPiece.dimensions_mm,
      weight_grams: currentPiece.weight_grams
    };

    // Exclude non-metafield UI/smart-switch keys before building canonical metafieldsJson
    const { primary_use, ...sharedForPayload } = currentShared;

    const payload = {
      intent: "createProduct",
      ...sharedForPayload,
      ...pieceForBuild,
      material: derivedMaterial,
      piece_name: cleanPieceIdentifier,
      dimensions_mm: currentPiece.dimensions_mm,
      surface_finish: currentPiece.surface_finish,
      color: currentPiece.color,
      primary_color: currentPiece.primary_color,
      color_pattern: currentPiece.color_pattern,
      cut_and_shape: pieceForBuild.cut_and_shape,
      stone_shape: currentPiece.stone_shape,
      price: hasMeaningfulValue(currentPiece.native_price) ? currentPiece.native_price : currentPiece.price,
      weight_grams: currentPiece.weight_grams,
      shipping_weight_oz: hasMeaningfulValue(currentPiece.native_shipping_weight) ? currentPiece.native_shipping_weight : currentPiece.shipping_weight_oz,
      seo_title: hasMeaningfulValue(currentPiece.native_seo_title) ? currentPiece.native_seo_title : currentPiece.seo_title,
      seo_description: currentPiece.native_seo_description || "",
      alt_text: hasMeaningfulValue(currentPiece.native_image_alt) ? currentPiece.native_image_alt : currentPiece.alt_text,
      title: resolvedTitle,
      descriptionHtml: hasMeaningfulValue(currentPiece.native_description) ? currentPiece.native_description : currentPiece.generated_description,
      productType: productType,
      status: "DRAFT",
      metafieldsJson: buildMetafieldsJson({ ...sharedForPayload, material: derivedMaterial }, pieceForBuild),
      mediaUrlsJson: JSON.stringify((currentPiece.stagedResourceUrls || []).filter(u => u !== undefined && u !== ""))
    };

    const fd = new FormData();
    fd.append("intent", "createProduct");
    fd.append("payload", JSON.stringify(payload));

    fetcher.submit(fd, { method: "post", action: "/app/meta-injector-api" });
  }, [fetcher, activePieceId]);

  const handleStartNewBatch = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");
    const freshPiece = makeInitialPieceState();
    setPieces([freshPiece]);
    setActivePieceId(freshPiece.id);
    setPhotoFiles([]);
    setPhotoPreviewUrls([]);
    setGeneratedDescription("");
    setLastScannedPieceId(null);
    lastAutofilledTitle.current = ""; 
  }, []);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;

    (isIdle && hasData) && (() => {
      const isCreate = fetcher.data.intent === "createProduct";
      const hasVerifiedCreateEvidence =
        Boolean(fetcher.data.productId) ||
        (typeof fetcher.data.createdCount === "number" && fetcher.data.createdCount > 0);
      const isSuccess =
        fetcher.data.success === true &&
        fetcher.data.status !== "UNSUPPORTED_INTENT" &&
        hasVerifiedCreateEvidence;
      const isError = !isSuccess;

      (isCreate && isSuccess) && (() => {
        if (fetcher.data.productId && pieces.length > 0) {
          setPieces(prev => prev.map((p, i) => 
            (p.id === activePieceId || (!activePieceId && i === 0))
              ? { ...p, productId: fetcher.data.productId, status: "DRAFT" }
              : p
          ));
        }
        setStatusMessage(`Successfully created pieces.`);
        setErrorMessage("");
      })();

      (isCreate && isError) && (() => {
        const errStr =
          fetcher.data.error ||
          fetcher.data.message ||
          ( !hasVerifiedCreateEvidence
              ? "Product creation did not complete: backend returned no created product ID."
              : "An error occurred during product creation." );
        setErrorMessage(errStr);
        setStatusMessage("");
      })();
    })();
  }, [fetcher.state, fetcher.data, pieces.length, activePieceId]);

  useEffect(() => {
    const isIdle = stageFetcher.state === "idle";
    const hasData = stageFetcher.data !== undefined && stageFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = stageFetcher.data;
      const isStaged = data.intent === "stagedUpload";
      const resourceUrl = data.resourceUrl;
      const isSuccess = data.success === true && data.status !== "UNSUPPORTED_INTENT" && Boolean(resourceUrl);
      const isError = !isSuccess;
      const pid = data.pieceId || stageFetcher.formData?.get("pieceId");

      (isStaged && isError) && (() => {
        if (pid) {
          handlePieceChange(pid, "scanError", data.error || data.message || "Staged upload is not supported or failed.", false);
        } else {
          setErrorMessage(data.error || data.message || "Staged upload failed.");
        }
      })();

      (isStaged && isSuccess && resourceUrl && pid) && (() => {
        const currentPiece = latestPieces.current.find(p => p.id === pid);
        if (!currentPiece) return;
        const currentIndex = currentPiece?.stagedUploadIndex || 0;

        setPieces(prev => prev.map(p =>
          p.id === pid ? { 
            ...p, 
            stagedResourceUrls: [...(p.stagedResourceUrls || []), resourceUrl],
            stagedUploadIndex: currentIndex + 1 
          } : p
        ));

        if (currentIndex === 0) {
          const executeVisionScan = (finalBase64, finalMime) => {
            const latestP = latestPieces.current.find(p => p.id === pid);
            const currentShared = latestShared.current || {};
            const rawPieceName = (latestP?.piece_name || document.querySelector(`[data-piece-id="${pid}"][data-field="piece_name"]`)?.value || "").trim();
            const rawCanonical = (latestP?.canonical_title || latestP?.native_title || "").trim();
            const cleanHumanId = resolveIdentifierToPreserve(rawPieceName, "");
            const cName = latestP?.collection_name || currentShared.collection_name || "";
            const sIdentity = latestP?.material || currentShared.material || latestP?.stone_family || currentShared.stone_family || "";
            const oLocation = latestP?.origin_location || currentShared.origin_location || "";
            const oHandle = latestP?.origin_page_handle || latestP?.origin_handle || currentShared.origin_page_handle || currentShared.origin_handle || "";
            const oStory = latestP?.origin_story || currentShared.origin_story || "";

            let segmentedTitle = "";
            if (isSegmentedMarketingTitle(rawCanonical)) {
              segmentedTitle = rawCanonical;
            } else if (isSegmentedMarketingTitle(rawPieceName)) {
              segmentedTitle = rawPieceName;
            } else if (sIdentity && oLocation && cleanHumanId) {
              segmentedTitle = `${sIdentity} - ${oLocation} - ${cleanHumanId}`;
            }

            const formData = new FormData();
            formData.append("intent", "visionScan");
            formData.append("pieceId", pid);
            formData.append("imageUrl", resourceUrl);
            formData.append("pieceName", segmentedTitle || cleanHumanId);
            if (segmentedTitle) formData.append("productTitle", segmentedTitle);
            if (cleanHumanId) formData.append("humanPieceId", cleanHumanId);
            if (sIdentity) {
              formData.append("material", sIdentity);
              formData.append("stone_family", sIdentity);
            }
            if (oLocation) formData.append("origin_location", oLocation);
            if (oHandle) {
              formData.append("origin_page_handle", oHandle);
              formData.append("origin_handle", oHandle);
            }
            if (oStory) formData.append("origin_story", oStory);
            formData.append("collectionName", cName);
            if (cName) formData.append("collection_name", cName);
            formData.append("imageBase64", finalBase64);
            formData.append("imageMimeType", finalMime);

            visionFetcher.submit(
              formData,
              { method: "post", action: "/app/meta-injector-autofill" }
            );
          };

          if (currentPiece && currentPiece.imageBase64) {
            executeVisionScan(currentPiece.imageBase64, currentPiece.imageMimeType);
          } else {
            let attempts = 0;
            const maxAttempts = 25; 
            const pollInterval = setInterval(() => {
              attempts++;
              const latestP = latestPieces.current.find(p => p.id === pid);
              const currentBase64 = latestP ? latestP.imageBase64 : "";
              const currentMime = latestP ? latestP.imageMimeType : "image/jpeg";

              if (currentBase64) {
                clearInterval(pollInterval);
                executeVisionScan(currentBase64, currentMime);
              } else if (attempts >= maxAttempts) {
                clearInterval(pollInterval);
                executeVisionScan("", currentMime);
              }
            }, 200);
          }
        }

        const nextIndex = currentIndex + 1;
        if (currentPiece && currentPiece.photoFiles && nextIndex < currentPiece.photoFiles.length) {
          const formData = new FormData();
          formData.append("intent", "stagedUpload");
          formData.append("file_0", currentPiece.photoFiles[nextIndex]);
          formData.append("pieceId", pid);
          stageFetcher.submit(formData, {
            method: "post",
            action: "/app/meta-injector-api",
            encType: "multipart/form-data"
          });
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
      const isScan = data.intent === "visionScan" || data.intent === "fullRescan";
      const isSuccess = data.success === true;
      const isError = data.success === false;
      const pId = data.tab2Data?.pieceId || data.pieceId || visionFetcher.formData?.get("pieceId");

      (isScan && isSuccess) && (() => {
        setSharedFields(prev => {
          const nextStoneFamily = data.tab2Data?.stone_family || data.stone_family || prev.stone_family || "";
          // Prefer canonical material or derived stone_family; never overwrite existing manual shared material or copy primary_medium into material
          const candidateMaterial = data.tab2Data?.material || data.material || getDerivedMaterial(nextStoneFamily);
          const nextMaterial = hasMeaningfulValue(prev.material) ? prev.material : (candidateMaterial || "");

          return {
            ...prev,
            material: nextMaterial,
            stone_family: prev.stone_family || nextStoneFamily,
            primary_use: prev.primary_use || data.tab2Data?.primary_use || data.primary_use || "",
            primary_medium: prev.primary_medium || data.tab2Data?.primary_medium || data.primary_medium || "",
            secondary_medium: prev.secondary_medium || data.tab2Data?.secondary_medium || data.secondary_medium || "",
            setting_ready: prev.setting_ready || data.tab2Data?.setting_ready || data.setting_ready || "",
            bail_included: prev.bail_included || data.tab2Data?.bail_included || data.bail_included || "",
            jewelry_finding_type: prev.jewelry_finding_type || data.tab2Data?.jewelry_finding_type || data.jewelry_finding_type || "",
            wire_material: prev.wire_material || data.tab2Data?.wire_material || data.wire_material || "",
            chain_material: prev.chain_material || data.tab2Data?.chain_material || data.chain_material || "",
            chain_link_type: prev.chain_link_type || data.tab2Data?.chain_link_type || data.chain_link_type || "",
            necklace_design: prev.necklace_design || data.tab2Data?.necklace_design || data.necklace_design || "",
            jewelry_type: prev.jewelry_type || data.tab2Data?.jewelry_type || data.jewelry_type || ""
          };
        });

        if (!pId) return;

        setPieces(prev => prev.map(p => {
          if (p.id !== pId) return p;
          const updated = { ...p };
          const manualEdits = updated.manualPieceEdits || {};
          const isProtectedStory = isManualStoryProtectedPiece(
            updated.canonical_title || updated.native_title,
            updated.piece_name
          );

          const desc = data.tab2Data?.generated_description || data.generated_description || data.description;
          const tColor = data.tab2Data?.color || data.color;
          const tPrimaryColor = data.tab2Data?.primary_color || data.primary_color;
          const tCutAndShape =
            data.tab2Data?.cut_and_shape ||
            data.cut_and_shape ||
            data.tab2Data?.cut_type ||
            data.cut_type;
          const tStoneShape = data.tab2Data?.stone_shape || data.stone_shape;
          const tFinish = data.tab2Data?.surface_finish || data.surface_finish;
          const tDims = data.tab2Data?.dimensions_mm || data.dimensions_mm;
          const tSeo = data.tab2Data?.seo_title || data.seo_title;
          const tSeoDesc = data.tab2Data?.poetic_hook || data.poetic_hook || data.tab2Data?.native_seo_description;
          const tPattern = data.tab2Data?.color_pattern || data.color_pattern;
          const tFlaws = data.tab2Data?.honest_flaws_and_character || data.honest_flaws_and_character;
          const tCharMarks = data.tab2Data?.character_marks || data.character_marks;
          const tAltText = data.tab2Data?.alt_text || data.alt_text;

          if (desc !== undefined && desc !== "" && !manualEdits.generated_description && !(isProtectedStory && hasMeaningfulValue(updated.generated_description))) {
            updated.generated_description = desc;
            updated.native_description = desc;
          }
          if (tColor !== undefined && tColor !== "" && !manualEdits.color) {
            updated.color = tColor;
          }
          if (tPrimaryColor !== undefined && tPrimaryColor !== "" && !manualEdits.primary_color) {
            updated.primary_color = tPrimaryColor;
          }
          // Do not populate held secondary_colors from scan
          if (tCutAndShape !== undefined && tCutAndShape !== "" && !manualEdits.cut_and_shape) {
            updated.cut_and_shape = tCutAndShape;
            updated.cut_type = tCutAndShape;
          }
          if (tStoneShape !== undefined && tStoneShape !== "" && !manualEdits.stone_shape) {
            updated.stone_shape = tStoneShape;
          }
          if (tFinish !== undefined && tFinish !== "" && !manualEdits.surface_finish) {
            updated.surface_finish = tFinish;
          }
          // Never overwrite operator-entered physical dimensions_mm
          if (tDims !== undefined && tDims !== "" && !manualEdits.dimensions_mm && !hasMeaningfulValue(updated.dimensions_mm)) {
            updated.dimensions_mm = tDims;
          }
          if (tSeo !== undefined && tSeo !== "" && !manualEdits.seo_title) {
            updated.seo_title = tSeo;
            updated.native_seo_title = tSeo;
          }
          if (tSeoDesc !== undefined && tSeoDesc !== "" && !manualEdits.native_seo_description && !hasMeaningfulValue(updated.native_seo_description)) {
            updated.native_seo_description = String(tSeoDesc).trim();
          }
          if (tPattern !== undefined && tPattern !== "" && !manualEdits.color_pattern) {
            updated.color_pattern = tPattern;
          }
          if (tFlaws !== undefined && tFlaws !== "" && !manualEdits.honest_flaws_and_character) {
            updated.honest_flaws_and_character = tFlaws;
          }
          if (tCharMarks !== undefined && tCharMarks !== "" && !manualEdits.character_marks) {
            updated.character_marks = tCharMarks;
          }
          if (tAltText !== undefined && tAltText !== "" && !manualEdits.alt_text && !manualEdits.native_image_alt) {
            updated.alt_text = tAltText;
            updated.native_image_alt = tAltText;
          }
          
          // Never overwrite or rename the human piece_name identifier on visionScan / fullRescan
          updated.piece_name = resolveIdentifierToPreserve(p.piece_name, "");

          updated.scanError = "";
          updated.debug_origin = data.tab2Data?.debug_origin || data.debug_origin || "";
          window.shopify?.toast?.show("Scan complete — fields loaded");
          return updated;
        }));
      })();

      (isScan && isError && pId) && (() => {
        setPieces(prev => prev.map(p => {
          if (p.id !== pId) return p;
          return {
            ...p,
            scanError: data.error || data.message || "Scan failed"
          };
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
        if (geo.geoSource === "none") { window.shopify?.toast?.show("Not in geo database — enter manually", { duration: 3000 }); return; }
        setSharedFields(prev => {
          const updated = { ...prev };
          updated.mohs_hardness = geo.mohs_hardness ?? geo.hardness ?? prev.mohs_hardness;
          updated.luster = geo.luster ?? prev.luster;
          updated.fracture_pattern = geo.fracture_pattern ?? geo.fracture ?? prev.fracture_pattern;
          updated.cleavage = geo.cleavage ?? prev.cleavage;
          updated.specific_gravity = geo.specific_gravity ?? prev.specific_gravity;
          updated.diaphaneity = geo.diaphaneity ?? prev.diaphaneity;
          updated.crystal_system = geo.crystal_system ?? prev.crystal_system;
          updated.geological_era = geo.geological_era ?? prev.geological_era;
          updated.geological_age = geo.geological_age ?? prev.geological_age;
          updated.mineral_class = geo.mineral_class ?? prev.mineral_class;
          updated.rock_composition = geo.rock_composition ?? prev.rock_composition;
          updated.rock_formation = geo.rock_formation ?? prev.rock_formation;
          return updated;
        });
        setGeoToast(true);
      })();
    })();
  }, [autoFillFetcher.state, autoFillFetcher.data]);

  useEffect(() => {
    if (!autoFillFetcher.data?.titleParse) return;
    const parsed = autoFillFetcher.data.titleParse;
    const responsePieceId = autoFillFetcher.data.pieceId || autoFillFetcher.formData?.get("pieceId") || lastScannedPieceId;

    setSharedFields(prev => {
      const resolvedCollectionLoc = parsed.collection_location || prev.collection_location;
      const nextStoneFamily = normalizeDropdownValue("stone_family", parsed.stone_family?.trim()) || prev.stone_family || "";
      const derivedMaterial = prev.material || parsed.material || getDerivedMaterial(nextStoneFamily);

      return {
        ...prev,
        material: derivedMaterial, 
        stone_family: nextStoneFamily,
        collection_name: parsed.collection_name || prev.collection_name,
        collection_location: resolvedCollectionLoc,
        origin_location: parsed.origin_location || prev.origin_location,
        origin_handle: parsed.origin_handle || prev.origin_handle, 
        origin_page_handle: parsed.origin_page_handle || parsed.origin_handle || prev.origin_page_handle, 
        origin_story: prev.origin_story || parsed.origin_story || "",
        specific_gravity: parsed.specific_gravity || prev.specific_gravity,
        diaphaneity: parsed.diaphaneity || prev.diaphaneity,
        crystal_system: parsed.crystal_system || prev.crystal_system,
        geological_era: parsed.geological_era || prev.geological_era,
        mineral_class: parsed.mineral_class || prev.mineral_class,
        rock_composition: parsed.rock_composition || prev.rock_composition,
        rock_formation: parsed.rock_formation || prev.rock_formation,
        geological_age: parsed.geological_age || prev.geological_age,
        fracture_pattern: parsed.fracture_pattern || parsed.fracture || prev.fracture_pattern,
        mohs_hardness: parsed.mohs_hardness || prev.mohs_hardness,
        luster: parsed.luster || prev.luster,
        cleavage: parsed.cleavage || prev.cleavage,
        ...(parsed.google_product_category && { google_product_category: parsed.google_product_category })
      };
    });

    if (parsed.canonical_title || parsed.product_title || parsed.seo_title || parsed.piece_name) {
      const fullCustomerTitle = parsed.canonical_title || parsed.product_title || "";
      setPieces(prev => prev.map((p, i) => {
        const isTargetRow = responsePieceId ? p.id === responsePieceId : i === 0;
        if (!isTargetRow) return p;

        // Keep human internal identifier (e.g. BQH-1, BQH-2, bob) separate from canonical_title
        const preservedIdentifier = resolveIdentifierToPreserve(p.piece_name, parsed.piece_name);
        const resolvedTitle = fullCustomerTitle || p.canonical_title || p.native_title;

        return {
          ...p,
          piece_name: preservedIdentifier,
          canonical_title: resolvedTitle,
          native_title: resolvedTitle,
          seo_title: parsed.seo_title || p.seo_title,
          native_seo_title: parsed.seo_title || p.native_seo_title || p.seo_title,
          handle: parsed.handle || p.handle
        };
      }));
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
        data.generated_description && (descStr = data.generated_description);
        const targetId = data.pieceId || descriptionFetcher.formData?.get("pieceId") || activePieceId;
        setPieces(prev => prev.map((p, i) => {
          const isMatch = targetId ? p.id === targetId : i === 0;
          if (!isMatch) return p;
          const nextSeoTitle = data.seo_title || p.seo_title;
          return {
            ...p,
            generated_description: descStr,
            native_description: descStr,
            seo_title: nextSeoTitle,
            native_seo_title: nextSeoTitle
          };
        }));
      })();
    })();
  }, [descriptionFetcher.state, descriptionFetcher.data, activePieceId]);

  useEffect(() => {
    const stagedUrl = selectedPieceForTemplate?.stagedResourceUrls?.[0];
    (stagedUrl && stagedUrl !== "") && (() => {
      window.shopify?.toast?.show("Photo ready — tap Scan to generate description");
    })();
  }, [selectedPieceForTemplate?.stagedResourceUrls?.[0]]);

  let isSubmitting = false;
  (fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct") && (isSubmitting = true);

  let isDescLoading = false;
  (descriptionFetcher.state !== "idle") && (isDescLoading = true);

  const renderLabel = (text, key, val) => {
    const status = getFieldStatus(key, val, { primary_use: sharedFields.primary_use });
    const isFilled = status === "green";
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
    (piece.piece_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (piece.canonical_title || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentWordCount = (selectedPieceForTemplate?.generated_description || selectedPieceForTemplate?.native_description || "").trim().split(/\s+/).filter(Boolean).length;
  const wordCountTone = currentWordCount > 100 ? "critical" : "subdued";

  const formatValue = (val) => {
    if (val === null || val === undefined) return "";
    if (typeof val === "object") {
      try { return JSON.stringify(val); } catch(e) { return String(val); }
    }
    return String(val);
  };

  // 🟢 UNIVERSAL 62-CAPABILITY TEMPLATE RENDERER (Connected to Active Piece + Shared Batch State)
  const renderTemplateField = (field) => {
    const targetPiece = selectedPieceForTemplate;
    const fieldDef = FIELD_CATALOG.find(f => f.key === field.key) || field;
    const isHeld = isCapabilityHeldReadOnly(fieldDef);
    const holdInfo = isHeld ? getHoldExplanation(fieldDef) : null;

    const isPerPieceField = PER_PIECE_CANONICAL_KEYS.has(field.key);

    const resolveFieldDisplayValue = () => {
      if (field.key === "native_title") {
        return targetPiece.native_title || targetPiece.canonical_title || "";
      }
      if (field.key === "native_description") {
        return targetPiece.native_description || targetPiece.generated_description || "";
      }
      if (field.key === "native_seo_title") {
        return targetPiece.native_seo_title || targetPiece.seo_title || "";
      }
      if (field.key === "native_seo_description") {
        return targetPiece.native_seo_description || "";
      }
      if (field.key === "native_price") {
        return targetPiece.native_price || targetPiece.price || "";
      }
      if (field.key === "native_shipping_weight") {
        return targetPiece.native_shipping_weight || targetPiece.shipping_weight_oz || "";
      }
      if (field.key === "native_image_alt") {
        return targetPiece.native_image_alt || targetPiece.alt_text || "";
      }
      if (field.key === "cut_and_shape") {
        return hasMeaningfulValue(targetPiece.cut_and_shape) ? targetPiece.cut_and_shape : (targetPiece.cut_type || "");
      }
      if (field.key === "material") {
        return hasMeaningfulValue(targetPiece.material)
          ? targetPiece.material
          : (hasMeaningfulValue(sharedFields.material) ? sharedFields.material : (sharedFields.stone_family || ""));
      }
      if (field.key === "is_one_of_a_kind") {
        return hasMeaningfulValue(targetPiece.is_one_of_a_kind)
          ? targetPiece.is_one_of_a_kind
          : (hasMeaningfulValue(sharedFields.is_one_of_a_kind) ? sharedFields.is_one_of_a_kind : (sharedFields.is_ooak || ""));
      }
      if (field.key === "origin_page_handle") {
        return hasMeaningfulValue(targetPiece.origin_page_handle)
          ? targetPiece.origin_page_handle
          : (hasMeaningfulValue(sharedFields.origin_page_handle) ? sharedFields.origin_page_handle : (sharedFields.origin_handle || ""));
      }
      if (isPerPieceField) {
        return targetPiece[field.key] ?? sharedFields[field.key] ?? "";
      }
      return hasMeaningfulValue(targetPiece[field.key])
        ? targetPiece[field.key]
        : (sharedFields[field.key] ?? "");
    };

    const displayVal = formatValue(resolveFieldDisplayValue());
    const optionsKey = fieldDef?.optionsKey || field.optionsKey;
    const isDropdown = Boolean(optionsKey && DROPDOWN_OPTIONS[optionsKey]);
    const isMultiline = Boolean(fieldDef?.uiConfig?.multiline || field.control === "multiline");

    if (isHeld) {
      return (
        <div key={field.key} style={{ padding: "10px 12px", background: "#2a2b2d", borderRadius: "6px", border: "1px dashed #555", minHeight: "64px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "14px", fontWeight: "600", color: "#d2d5d8" }}>{field.label}</span>
            <Badge tone="info">{holdInfo.badge}</Badge>
          </div>
          <div style={{ color: displayVal ? "#ffffff" : "#999fa4", fontSize: "13px", marginTop: "6px", wordBreak: "break-word", fontFamily: "monospace" }}>
            {displayVal || "Blank (Read-Only Hold)"}
          </div>
          <div style={{ fontSize: "11px", color: "#b5b9be", marginTop: "4px" }}>
            {holdInfo.reason} [{field.registryIdentity || `${field.namespace}.${field.metaKey || field.key}`}]
          </div>
        </div>
      );
    }

    const onFieldChange = (v) => {
      if (isPerPieceField) {
        handlePieceChange(targetPiece.id, field.key, v, true);
      } else {
        handleSharedFieldChange(field.key, v);
      }
    };

    const scopeTag = isPerPieceField ? "Per-Piece" : "Shared Batch";

    if (isDropdown) {
      return (
        <div key={field.key} style={{ minHeight: "54px", background: "#ffffff", padding: "10px", borderRadius: "6px" }}>
          <Select
            label={renderLabel(`${field.label} (${scopeTag})`, field.key, displayVal)}
            options={[{ label: "Select...", value: "" }, ...DROPDOWN_OPTIONS[optionsKey]]}
            value={displayVal}
            onChange={onFieldChange}
          />
        </div>
      );
    }

    return (
      <div key={field.key} style={{ minHeight: "54px", background: "#ffffff", padding: "10px", borderRadius: "6px" }}>
        <TextField
          label={renderLabel(`${field.label} (${scopeTag})`, field.key, displayVal)}
          value={displayVal}
          onChange={onFieldChange}
          multiline={isMultiline ? 2 : false}
          autoComplete="off"
          helpText={field.capabilityNote || undefined}
        />
      </div>
    );
  };

  const renderTemplateGroup = (group) => {
    return (
      <div key={group.heading} style={{ marginBottom: "24px", padding: "16px", background: "#202123", borderRadius: "8px", borderLeft: `4px solid ${group.color || "#444"}` }}>
        <div style={{ fontWeight: "bold", color: "#ffffff", fontSize: "16px", marginBottom: "16px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {group.heading} ({group.fields.length})
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          {group.fields.map(field => renderTemplateField(field))}
        </div>
      </div>
    );
  };

  return (
    <Frame>
      <BlockStack gap="600">
        <Banner title="Universal All-Product Contract Active (62 Canonical Capabilities):" tone="success">
          <BlockStack gap="100">
            <Text as="p" variant="bodyMd">
              ✔ Primary Stone Identity: <strong>custom.material</strong> | ✔ Canonical OOAK: <strong>custom.is_one_of_a_kind</strong> | ✔ Appearance: <strong>color, cut_and_shape, stone_shape</strong>
            </Text>
            <Text as="p" variant="bodyMd">
              ✔ Held Capabilities: <strong>Measurements #58–62, tenacity, secondary_colors, shopify.*, google.*, and mm-google-shopping.custom_product fail closed as read-only</strong>
            </Text>
          </BlockStack>
        </Banner>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>
              Section A: Per-Piece Creation & Scan Workbench
            </Text>

            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search pieces by identifier or title..."
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
              {filteredPieces.map((piece) => {
                let isScanning = false;
                (stageFetcher.state !== "idle" && stageFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (visionFetcher.state !== "idle" && visionFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (autoFillFetcher.state !== "idle" && autoFillFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
                (piece.isUploading) && (isScanning = true);

                let hasScanError = false;
                (piece.scanError && piece.scanError !== "") && (hasScanError = true);

                let hasPhotos = false;
                (piece.photoFiles && piece.photoFiles.length > 0) && (hasPhotos = true);

                let disableScan = !hasPhotos;

                let rowTopDotColor = hasPhotos ? "#2E7D32" : "#C62828";
                let rowDescDotColor = (piece.generated_description && piece.generated_description !== "") ? "#2E7D32" : "#C62828";

                const isStatusUpdating = statusFetcher.state !== "idle" && statusFetcher.formData?.get("pieceId") === piece.productId;
                const statusButtonLabel = piece.status === "ACTIVE" ? "Move to Draft" : "Publish";
                const isSelectedPiece = piece.id === selectedPieceForTemplate.id;
                const pieceWordCount = (piece.generated_description || "").trim().split(/\s+/).filter(Boolean).length;

                return (
                  <div
                    key={piece.id}
                    onClick={() => setActivePieceId(piece.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "16px",
                      padding: "16px",
                      borderRadius: "8px",
                      border: isSelectedPiece ? "2px solid #008060" : "1px solid #e1e3e5",
                      backgroundColor: isSelectedPiece ? "#f6fef9" : "#ffffff"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                      <Badge tone={isSelectedPiece ? "success" : "info"}>
                        {isSelectedPiece ? "Active Piece in Template Below" : "Click to Inspect in Template Below"}
                      </Badge>
                      {piece.canonical_title && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          Assembled Title: <strong>{piece.canonical_title}</strong>
                        </Text>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "end", gap: "16px", flexWrap: "wrap" }}>
                      <div style={{ flexGrow: 1, minHeight: "54px", minWidth: "260px" }}>
                        <TextField
                          label={renderLabel("Piece Name (Human Identifier or 3-Part Title Seed)", "piece_name", piece.piece_name)}
                          value={piece.piece_name}
                          onChange={(v) => handlePieceChange(piece.id, "piece_name", v, true)}
                          onBlur={() => handlePieceNameBlur(piece.id, piece.piece_name)}
                          autoComplete="off"
                        />
                        <div style={{ marginTop: "4px" }}>
                          <Text variant="bodySm" tone="subdued" as="p">
                            Enter human ID (e.g. BQH-1, BQH-2, bob) or 3-part seed: Stone - Origin - Piece Name
                          </Text>
                        </div>
                      </div>

                      <div style={{ flexGrow: 1, minHeight: "54px", minWidth: "260px" }}>
                        <TextField
                          label={renderLabel("Native Product Title (Explicit Override)", "native_title", piece.canonical_title || piece.native_title)}
                          value={piece.canonical_title || piece.native_title || ""}
                          onChange={(v) => handlePieceChange(piece.id, "canonical_title", v, true)}
                          autoComplete="off"
                          placeholder="Leave blank to assemble from Stone - Origin - Piece Name"
                        />
                      </div>

                      {piece.productId && (
                        <div style={{ minHeight: "54px", width: "140px" }}>
                          <Button
                            size="large"
                            fullWidth
                            onClick={() => handleToggleStatus(piece.id, piece.status, piece.productId)}
                            loading={isStatusUpdating}
                            tone={piece.status === "ACTIVE" ? "critical" : "success"}
                          >
                            {statusButtonLabel}
                          </Button>
                        </div>
                      )}

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
                      <Text variant="headingMd" as="h3" fontWeight="bold">Product Photos</Text>
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

                    <div style={{ display: "flex", gap: "12px", minHeight: "48px", marginTop: "8px" }}>
                      <Button
                        onClick={() => handleScanGeminiPhotos(piece)}
                        loading={isScanning}
                        disabled={disableScan}
                      >
                        {isScanning && <Spinner size="small" />}
                        Scan with Gemini
                      </Button>
                      <Button
                        variant="primary"
                        tone="success"
                        onClick={() => handleFullRescan(piece)}
                        loading={isScanning && visionFetcher.formData?.get("intent") === "fullRescan"}
                        disabled={disableScan}
                      >
                        Full Rescan
                      </Button>
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
                                <circle cx="9" cy="9" r="9" fill={rowDescDotColor} />
                              </svg>
                              <Text variant="headingMd" as="h3">Native Description</Text>
                            </div>
                            <Text variant="bodySm" tone={pieceWordCount > 100 ? "critical" : "subdued"} as="span">
                              {pieceWordCount}/100 words {pieceWordCount > 100 && "(Exceeds 100-Word Law)"}
                            </Text>
                          </div>
                        }
                        value={piece.generated_description}
                        onChange={(v) => handlePieceChange(piece.id, "generated_description", v, true)}
                        multiline={6}
                        autoComplete="off"
                        placeholder="Gemini will generate a poetic, spare description under 100 words..."
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Native SEO Title", "native_seo_title", piece.seo_title)}
                        value={piece.seo_title}
                        onChange={(v) => handlePieceChange(piece.id, "seo_title", v, true)}
                        autoComplete="off"
                        placeholder="Keyword-rich title for Google..."
                      />
                      <TextField
                        label={renderLabel("Native SEO Description (Under 160 chars)", "native_seo_description", piece.native_seo_description)}
                        value={piece.native_seo_description}
                        onChange={(v) => handlePieceChange(piece.id, "native_seo_description", v, true)}
                        autoComplete="off"
                        placeholder="Poetic, spare, story-driven under 160 chars..."
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Native Price", "native_price", piece.price)}
                        value={piece.price}
                        onChange={(v) => handlePieceChange(piece.id, "price", v, true)}
                        autoComplete="off"
                        placeholder="e.g. 45.00"
                      />
                      <TextField
                        label={renderLabel("Stone Weight (grams)", "weight_grams", piece.weight_grams)}
                        value={piece.weight_grams}
                        onChange={(v) => handlePieceChange(piece.id, "weight_grams", v, true)}
                        autoComplete="off"
                        placeholder="e.g. 14.5"
                      />
                      <TextField
                        label={renderLabel("Native Shipping Weight (oz)", "native_shipping_weight", piece.shipping_weight_oz)}
                        value={piece.shipping_weight_oz}
                        onChange={(v) => handlePieceChange(piece.id, "shipping_weight_oz", v, true)}
                        placeholder="Actual product oz + 0.5 oz pkg"
                        type="number"
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Dimensions (mm)", "dimensions_mm", piece.dimensions_mm)}
                        value={piece.dimensions_mm}
                        onChange={(v) => handlePieceChange(piece.id, "dimensions_mm", v, true)}
                        autoComplete="off"
                      />
                      <TextField
                        label={renderLabel("Cut and Shape (Detailed)", "cut_and_shape", piece.cut_and_shape)}
                        value={piece.cut_and_shape}
                        onChange={(v) => handlePieceChange(piece.id, "cut_and_shape", v, true)}
                        autoComplete="off"
                        placeholder="Detailed cut & contour"
                      />
                      <TextField
                        label={renderLabel("Stone Shape (Broad)", "stone_shape", piece.stone_shape)}
                        value={piece.stone_shape}
                        onChange={(v) => handlePieceChange(piece.id, "stone_shape", v, true)}
                        autoComplete="off"
                        placeholder="e.g. Freeform, Oval, Teardrop"
                      />
                      <Select
                        label={renderLabel("Surface Finish", "surface_finish", piece.surface_finish)}
                        options={[{ label: "Select...", value: "" }, ...DROPDOWN_OPTIONS.surface_finish]}
                        value={piece.surface_finish}
                        onChange={(v) => handlePieceChange(piece.id, "surface_finish", v, true)}
                      />
                      <TextField
                        label={renderLabel("Color", "color", piece.color)}
                        value={piece.color}
                        onChange={(v) => handlePieceChange(piece.id, "color", v, true)}
                        autoComplete="off"
                        placeholder="Descriptive color summary"
                      />
                      <TextField
                        label={renderLabel("Primary Color", "primary_color", piece.primary_color)}
                        value={piece.primary_color}
                        onChange={(v) => handlePieceChange(piece.id, "primary_color", v, true)}
                        autoComplete="off"
                        placeholder="Dominant hue"
                      />
                      <TextField
                        label={renderLabel("Color Pattern", "color_pattern", piece.color_pattern)}
                        value={piece.color_pattern}
                        onChange={(v) => handlePieceChange(piece.id, "color_pattern", v, true)}
                        autoComplete="off"
                      />
                      <div style={{ gridColumn: "span 2" }}>
                        <TextField
                          label={renderLabel("Native Image Alt Text", "native_image_alt", piece.native_image_alt || piece.alt_text)}
                          value={piece.native_image_alt || piece.alt_text}
                          onChange={(v) => handlePieceChange(piece.id, "native_image_alt", v, true)}
                          autoComplete="off"
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
            <InlineGrid columns={2} alignItems="center">
              <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>
                Section B: Creation Workflow Context (Source Context & Product Type)
              </Text>
              <Badge tone="info">AI Context & Native Product Type — Not Duplicated as Metafields</Badge>
            </InlineGrid>
            <Text as="p" variant="bodySm" tone="subdued">
              Origin Story and bench flaw notes below supply human context to Scan / Write Description with Gemini without creating duplicate or excluded custom metafields. Canonical batch fields (Material, Origin Page Handle, Collection, Treatment, Hardware, and Geology) are edited directly in the 62-Capability Template below.
            </Text>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <Select
                label={renderLabel("Native Product Type (Smart Switch)", "primary_use", sharedFields.primary_use)}
                options={[{ label: "Select...", value: "" }, ...productTypeOptions.map(o => ({ label: o, value: o }))]}
                value={sharedFields.primary_use}
                onChange={(v) => handleSharedFieldChange("primary_use", v)}
              />
              <Select
                label={renderLabel("Quick Stone Family Selector (Populates Canonical Material)", "material", sharedFields.material || sharedFields.stone_family)}
                options={[{ label: "Select stone family...", value: "" }, ...DROPDOWN_OPTIONS.stone_family]}
                value={sharedFields.stone_family || sharedFields.material}
                onChange={(v) => handleStoneFamilyChange(v)}
              />
              <div style={{ gridColumn: "span 2" }}>
                <TextField
                  label="Origin Story Source Context (Used by Gemini Scan / Description — Not Written as a Metafield)"
                  value={sharedFields.origin_story}
                  onChange={(v) => handleSharedFieldChange("origin_story", v)}
                  autoComplete="off"
                  multiline={3}
                  helpText="Provides lived collecting/origin context for description generation. Single-item story/long-text repair lives in Tab 2."
                />
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <TextField
                  label="Bench Flaws / Character Context for Active Piece (AI Context Only — Not Written as a Metafield)"
                  value={selectedPieceForTemplate.honest_flaws_and_character || ""}
                  onChange={(v) => handlePieceChange(selectedPieceForTemplate.id, "honest_flaws_and_character", v, true)}
                  autoComplete="off"
                  multiline={2}
                />
              </div>
            </div>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "16px", fontWeight: "bold" }}>Section C: Generate Description</Text>
            <div style={{ minHeight: "54px" }}>
              <Button
                size="large"
                variant="primary"
                icon={MagicIcon}
                onClick={() => handleGenerateDescription({
                  sharedFields,
                  pieces: [selectedPieceForTemplate],
                  descFetcher: descriptionFetcher
                })}
                loading={isDescLoading}
              >
                Write Description with Gemini (Active Piece)
              </Button>
            </div>
            {(selectedPieceForTemplate?.generated_description || "") !== "" && (
              <TextField
                label={
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                    <span>Generated Description — edit before saving</span>
                    <Text variant="bodySm" tone={wordCountTone} as="span">
                      {currentWordCount}/100 words
                    </Text>
                  </div>
                }
                value={selectedPieceForTemplate?.generated_description || ""}
                onChange={(v) => handlePieceChange(selectedPieceForTemplate.id, "generated_description", v, true)}
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
              Start New Batch (Wipe Section A, Keep Shared Batch Context)
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
              <Text variant="headingMd" as="h2" style={{ fontSize: "20px", fontWeight: "bold", color: "#ffffff" }}>
                Universal Product Capability Template (62 Canonical Capabilities)
              </Text>
              <Badge tone="success">
                Active Piece: {selectedPieceForTemplate.piece_name || selectedPieceForTemplate.id}
              </Badge>
            </div>
            {PRODUCT_TEMPLATE_GROUPS.map(group => renderTemplateGroup(group))}
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

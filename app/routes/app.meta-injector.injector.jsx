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
    // Check if the piece already has a base64 image; ifI seem to be encountering an error. Can I try something else for you?
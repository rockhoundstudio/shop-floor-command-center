import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, DropZone, Spinner, Frame, Toast } from "@shopify/polaris";
import { PlusIcon, MagicIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";
import { handleScanPhoto, handleGenerateDescription, buildMetafieldsJson, buildTitle } from "./app.meta-injector.intake-helpers.jsx";

const SHOPPED_ROCK_VENDORS = ["Richardson's Rock Ranch", "Irv's Rock and Jewelry"];

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
    collection_date: "",
    origin_location: "",
    rescued_by: "Bob and Janyce",
    treatment_status: "100% Natural/Untreated",
    origin_story: "",
    primary_use: "",
    handcrafted_by: "Bob & Janyce, Rockhound Studio",
    is_one_of_a_kind: "Yes — one of a kind",
    treated: "Untreated — Natural",
    found_object: "true",
    condition: "new",
    target_gender: "Unisex",
    age_group: "adult",
    primary_medium: "",
    secondary_medium: "",
    wire_material: "",
    setting_ready: "",
    bail_included: "",
    weight_grams: ""
  });

  const [pieces, setPieces] = useState([
    {
      id: Date.now().toString(),
      piece_name: "",
      dimensions_mm: "",
      cut_and_shape: "",
      surface_finish: "",
      color: "",
      stone_shape: "",
      price: "",
      character_marks: "",
      stone_story: "",
      photoFiles: [],
      photoPreviewUrls: [],
      photos: [],
      imageBase64: "",
      imageMimeType: "",
      stagedResourceUrls: [],
      generated_description: "",
      artist_notes: "",
      scanError: "",
      scanToken: "",
      isUploading: false
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [geoToast, setGeoToast] = useState(false);
  
  // Title Parse Toast State
  const [titleToastActive, setTitleToastActive] = useState(false);
  const [titleToastMsg, setTitleToastMsg] = useState("");
  const [titleToastError, setTitleToastError] = useState(false);
  
  const [lastScannedPieceId, setLastScannedPieceId] = useState(null);

  const handleScanGeminiPhotos = useCallback((piece) => {
    (piece?.photoFiles?.[0]) && (() => {
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
  }, [stageFetcher]);

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleStoneFamilyChange = useCallback((value) => {
    setSharedFields(prev => ({ ...prev, stone_family: value }));
    (value && value.trim() !== "") && autoFillFetcher.submit(
      { intent: "geoLookup", stoneFamily: value },
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  }, [autoFillFetcher]);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (updated[key] = value);
      return updated;
    }));
  }, []);

  const handlePieceNameBlur = useCallback((id, value) => {
    if (!value) return;
    const segments = value.split(" - ");
    if (segments.length === 3) {
      setLastScannedPieceId(id);
      autoFillFetcher.submit(
        { intent: "titleParse", pieceName: value },
        { method: "post", action: "/app/meta-injector-autofill" }
      );
    }
  }, [autoFillFetcher]);

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
        stone_shape: "",
        price: "",
        character_marks: "",
        stone_story: "",
        photoFiles: [],
        photoPreviewUrls: [],
        photos: [],
        imageBase64: "",
        imageMimeType: "",
        stagedResourceUrls: [],
        generated_description: "",
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

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    let productType = "Wearable Art";
    (sharedFields.primary_use && sharedFields.primary_use !== "") && (productType = sharedFields.primary_use);

    const payload = {
      intent: "createProduct",
      ...sharedFields,
      piece_name: pieces[0].piece_name,
      dimensions_mm: pieces[0].dimensions_mm,
      cut_and_shape: pieces[0].cut_and_shape,
      surface_finish: pieces[0].surface_finish,
      color: pieces[0].color,
      stone_shape: pieces[0].stone_shape,
      price: pieces[0].price,
      seo_title: pieces[0].seo_title,
      character_marks: pieces[0].character_marks,
      stone_story: pieces[0].stone_story,
      title: buildTitle(sharedFields, pieces[0]),
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
      collection_date: "",
      origin_location: "",
      rescued_by: "Bob and Janyce",
      treatment_status: "100% Natural/Untreated",
      origin_story: "",
      primary_use: "",
      handcrafted_by: "Bob & Janyce, Rockhound Studio",
      is_one_of_a_kind: "Yes — one of a kind",
      treated: "Untreated — Natural",
      found_object: "true",
      condition: "new",
      target_gender: "Unisex",
      age_group: "adult",
      primary_medium: "",
      secondary_medium: "",
      wire_material: "",
      setting_ready: "",
      bail_included: "",
      weight_grams: ""
    });
    setPieces([{
      id: Date.now().toString(),
      piece_name: "",
      dimensions_mm: "",
      cut_and_shape: "",
      surface_finish: "",
      color: "",
      stone_shape: "",
      price: "",
      character_marks: "",
      stone_story: "",
      photoFiles: [],
      photoPreviewUrls: [],
      photos: [],
      imageBase64: "",
      imageMimeType: "",
      stagedResourceUrls: [],
      generated_description: "",
      artist_notes: "",
      scanError: "",
      scanToken: "",
      isUploading: false
    }]);
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

        visionFetcher.submit(
          { intent: "visionScan", pieceId: pid, imageUrl: resourceUrl },
          { method: "post", action: "/app/meta-injector-autofill" }
        );
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
        setPieces(prev => prev.map(p => {
          let updated = { ...p };
          (p.id === data.pieceId) && (() => {
            (data.description !== undefined && data.description !== "") && (updated.generated_description = data.description);
            (data.color !== undefined && data.color !== "") && (updated.color = data.color);
            (data.cut_and_shape !== undefined && data.cut_and_shape !== "") && (updated.cut_and_shape = data.cut_and_shape);
            (data.surface_finish !== undefined && data.surface_finish !== "") && (updated.surface_finish = data.surface_finish);
            (data.stone_shape !== undefined && data.stone_shape !== "") && (updated.stone_shape = data.stone_shape);
            (data.dimensions_mm !== undefined && data.dimensions_mm !== "") && (updated.dimensions_mm = data.dimensions_mm);
            updated.scanError = "";
          })();
          return updated;
        }));
      })();

      (isScan && isError) && (() => {
        setPieces(prev => prev.map(p => {
          let updated = { ...p };
          (p.id === data.pieceId) && (() => {
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
        setSharedFields(prev => {
          const updated = { ...prev };
          (geo.hardness !== undefined) && (updated.hardness = geo.hardness);
          (geo.luster !== undefined) && (updated.luster = geo.luster);
          (geo.fracture !== undefined) && (updated.fracture = geo.fracture);
          (geo.cleavage !== undefined) && (updated.cleavage = geo.cleavage);
          (geo.specificGravity !== undefined) && (updated.specificGravity = geo.specificGravity);
          (geo.diaphaneity !== undefined) && (updated.diaphaneity = geo.diaphaneity);
          (geo.crystalSystem !== undefined) && (updated.crystalSystem = geo.crystalSystem);
          (geo.geologicalEra !== undefined) && (updated.geologicalEra = geo.geologicalEra);
          (geo.mineralClass !== undefined) && (updated.mineralClass = geo.mineralClass);
          (geo.rockComposition !== undefined) && (updated.rockComposition = geo.rockComposition);
          (geo.rockFormation !== undefined) && (updated.rockFormation = geo.rockFormation);
          (geo.mohs_hardness !== undefined) && (updated.mohs_hardness = geo.mohs_hardness);
          (geo.fracture_pattern !== undefined) && (updated.fracture_pattern = geo.fracture_pattern);
          (geo.specific_gravity !== undefined) && (updated.specific_gravity = geo.specific_gravity);
          (geo.geological_age !== undefined) && (updated.geological_age = geo.geological_age);
          return updated;
        });
        setGeoToast(true);
      })();
    })();
  }, [autoFillFetcher.state, autoFillFetcher.data]);

  useEffect(() => {
    if (!autoFillFetcher.data?.titleParse) return;
    const parsed = autoFillFetcher.data.titleParse;

    // SHARED FIELDS
    setSharedFields(prev => {
      let resolvedCollectionLoc = parsed.collection_location || prev.collection_location;
      if (SHOPPED_ROCK_VENDORS.includes(parsed.origin_name)) {
        resolvedCollectionLoc = "Shopped Rock";
      }

      return {
        ...prev,
        material: parsed.material || "Stone",
        stone_family: parsed.stone_family || prev.stone_family,
        collection_name: parsed.collection_name || prev.collection_name,
        collection_location: resolvedCollectionLoc,
        collectionLocation: resolvedCollectionLoc,
        origin_location: parsed.origin_name || prev.origin_location,
        origin_story: parsed.origin_story || prev.origin_story,
        mohs_hardness: parsed.mohs_hardness || prev.mohs_hardness,
        luster: parsed.luster || prev.luster,
        fracture: parsed.fracture || prev.fracture,
        cleavage: parsed.cleavage || prev.cleavage,
        specificGravity: parsed.specific_gravity || prev.specificGravity,
        diaphaneity: parsed.diaphaneity || prev.diaphaneity,
        crystalSystem: parsed.crystal_system || prev.crystalSystem,
        geologicalEra: parsed.geological_era || prev.geologicalEra,
        mineralClass: parsed.mineral_class || prev.mineralClass,
        rockComposition: parsed.rock_composition || prev.rockComposition,
        rockFormation: parsed.rock_formation || prev.rockFormation,
        geological_age: parsed.geological_age || prev.geological_age,
        fracture_pattern: parsed.fracture_pattern || prev.fracture_pattern,
        collection_story: parsed.collection_story || prev.collection_story,
        origin_handle: parsed.origin_handle || prev.origin_handle,
      };
    });

    // PER-PIECE ROW — write canonical title back to piece name field
    if (parsed.canonical_title || parsed.product_title) {
      const pieceTitleVal = parsed.canonical_title || parsed.product_title;
      setPieces(prev => prev.map((p, i) =>
        p.id === lastScannedPieceId || (!lastScannedPieceId && i === 0)
          ? { ...p, piece_name: pieceTitleVal, seo_title: parsed.seo_title, handle: parsed.handle, stone_story: parsed.stone_story }
          : p
      ));
    }

    // FLAG — needs new origin page
    if (parsed.needs_new_origin_page) {
      setTitleToastMsg("⚠️ No origin page found — create one for: " + parsed.origin_name);
      setTitleToastError(true);
      setTitleToastActive(true);
    } else {
      setTitleToastMsg("Title parsed — fields pre-filled");
      setTitleToastError(false);
      setTitleToastActive(true);
    }

  }, [autoFillFetcher.data, lastScannedPieceId]);

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
            ? { ...p, generated_description: descStr }
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

  const productTypeOptions = [
    "Cabochon", "Pendant", "Necklace", "Earrings", "Ring", "Bracelet", "Wire Wrap", "Driftwood Art", "Display Specimen", "Collector Piece", "Freeform", "Other"
  ];

  const collectionLocationOptions = [
    "Spokane River", "Yakima Canyon", "Yellowstone River", "Richardson's Rock Ranch", "The 3,000-Mile Run", "Nickel Back", "Rufus Serpentine", "The Shopped Rock", "Shopped Rock", "The Gallery"
  ];

  const rescuedByOptions = ["", "Bob", "Janyce", "Bob and Janyce"];
  const treatmentStatusOptions = ["100% Natural/Untreated", "Heat Treated", "Dyed", "Stabilized", "Irradiated", "Coated"];
  const surfaceFinishOptions = ["", "High Polish", "Matte", "Satin", "Hand Polish", "Natural"];

  const combinedData = { ...sharedFields, ...(pieces[0] || {}) };
  const scanKeys = [...ROCKHOUND_FIELDS.map(f => f.key), "origin_story", "price", "mohs_hardness", "luster", "fracture", "cleavage", "specificGravity", "diaphaneity", "crystalSystem", "geologicalEra", "mineralClass", "rockComposition", "rockFormation", "geological_age", "fracture_pattern"];

  const actionData = fetcher.data;
  let useSaved = false;
  (actionData?.success === true) && (useSaved = true);

  const savedMap = {};
  (actionData && actionData.savedMetafields) && actionData.savedMetafields.forEach(mf => { savedMap[mf.key] = mf.value; });

  const renderLabel = (text, key, value) => {
    const isRequired = REQUIRED_FIELDS.includes(key);
    let isFilled = false;
    (value !== undefined && value !== null && value.toString().trim() !== "") && (isFilled = true);

    let dotColor = "#FFC453";
    isFilled && (dotColor = "#008060");
    (!isFilled && isRequired) && (dotColor = "#D72C0D");

    return (
      <span style={{ fontSize: "14px" }}>
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

  return (
    <Frame>
      <BlockStack gap="600">
        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Section A: Per-Piece Details</Text>

            <div style={{ position: "relative", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Search products..."
                aria-label="Search products"
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
                  aria-label="Clear search"
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
                >
                  ✕
                </button>
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
                          accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                        />
                        <div style={{ marginTop: "4px" }}>
                          <Text variant="bodySm" tone="subdued" as="p">
                            Format: Stone Family - Origin - Piece Name (e.g. Tiger's Eye - Irv's - Tiger Fly)
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
                          accessibilityLabel={`Remove row ${index + 1}`}
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
                      accessibilityLabel={`Upload stone photos for row ${index + 1}`}
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
                              aria-label={`Remove photo ${i + 1}`}
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
                            >
                              ✕
                            </button>
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
                        accessibilityLabel={`Scan photo with Gemini for row ${index + 1}`}
                      >
                        {isScanning && <Spinner size="small" />}
                        Scan with Gemini
                      </Button>
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
                              <circle cx="9" cy="9" r="9" fill={rowDescDotColor} />
                            </svg>
                            <Text variant="headingMd" as="h3">Description</Text>
                          </div>
                        }
                        value={piece.generated_description}
                        onChange={(v) => handlePieceChange(piece.id, "generated_description", v)}
                        multiline={6}
                        autoComplete="off"
                        placeholder="Gemini will generate a description from your photos..."
                        accessibilityLabel={`Generated product description for row ${index + 1}`}
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
                        accessibilityLabel={`Enter Artist Notes for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Character Marks", "character_marks", piece.character_marks)}
                        value={piece.character_marks}
                        onChange={(v) => handlePieceChange(piece.id, "character_marks", v)}
                        multiline={2}
                        autoComplete="off"
                        placeholder="Describe any natural character marks, inclusions, or patterns..."
                        accessibilityLabel={`Enter Character Marks for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ minHeight: "48px", marginTop: "8px" }}>
                      <TextField
                        label={renderLabel("Stone Story", "stone_story", piece.stone_story)}
                        value={piece.stone_story}
                        onChange={(v) => handlePieceChange(piece.id, "stone_story", v)}
                        multiline={3}
                        autoComplete="off"
                        placeholder="The unique story or geological journey of this specific stone..."
                        accessibilityLabel={`Enter Stone Story for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Dimensions (mm)", "dimensions_mm", piece.dimensions_mm)}
                          value={piece.dimensions_mm}
                          onChange={(v) => handlePieceChange(piece.id, "dimensions_mm", v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter Dimensions for row ${index + 1}`}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Cut & Shape", "cut_and_shape", piece.cut_and_shape)}
                          value={piece.cut_and_shape}
                          onChange={(v) => handlePieceChange(piece.id, "cut_and_shape", v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter Cut and Shape for row ${index + 1}`}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <Select
                          label={renderLabel("Surface Finish", "surface_finish", piece.surface_finish)}
                          options={[...surfaceFinishOptions.map(o => ({ label: o, value: o }))]}
                          value={piece.surface_finish}
                          onChange={(v) => handlePieceChange(piece.id, "surface_finish", v)}
                          accessibilityLabel={`Select surface finish for row ${index + 1}`}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Color", "color", piece.color)}
                          value={piece.color}
                          onChange={(v) => handlePieceChange(piece.id, "color", v)}
                          autoComplete="off"
                          placeholder="Primary color"
                          accessibilityLabel={`Enter color for row ${index + 1}`}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Stone Shape", "stone_shape", piece.stone_shape)}
                          value={piece.stone_shape}
                          onChange={(v) => handlePieceChange(piece.id, "stone_shape", v)}
                          autoComplete="off"
                          placeholder="Shape of the stone"
                          accessibilityLabel={`Enter stone shape for row ${index + 1}`}
                        />
                      </div>
                      <div style={{ minHeight: "54px" }}>
                        <TextField
                          label={renderLabel("Price", "price", piece.price)}
                          value={piece.price}
                          onChange={(v) => handlePieceChange(piece.id, "price", v)}
                          autoComplete="off"
                          accessibilityLabel={`Enter Price for row ${index + 1}`}
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
                accessibilityLabel="Add new piece row"
              >
                Add Row
              </Button>
            </div>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Section B: Shared Batch Fields</Text>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Material", "material", sharedFields.material)}
                  value={sharedFields.material}
                  onChange={(v) => handleSharedFieldChange("material", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter shared material"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Stone Family", "stone_family", sharedFields.stone_family)}
                  options={[
                    { label: "Select stone family...", value: "" },
                    { label: "agate", value: "agate" },
                    { label: "jasper", value: "jasper" },
                    { label: "chalcedony", value: "chalcedony" },
                    { label: "obsidian", value: "obsidian" },
                    { label: "quartz", value: "quartz" },
                    { label: "amethyst", value: "amethyst" },
                    { label: "tiger's eye", value: "tiger's eye" },
                    { label: "turquoise", value: "turquoise" },
                    { label: "malachite", value: "malachite" },
                    { label: "labradorite", value: "labradorite" },
                    { label: "moonstone", value: "moonstone" },
                    { label: "onyx", value: "onyx" },
                    { label: "opal", value: "opal" },
                    { label: "petrified wood", value: "petrified wood" },
                    { label: "serpentine", value: "serpentine" },
                    { label: "rhodonite", value: "rhodonite" },
                    { label: "sodalite", value: "sodalite" },
                    { label: "unakite", value: "unakite" },
                    { label: "andesite", value: "andesite" },
                    { label: "basalt", value: "basalt" },
                    { label: "granite", value: "granite" },
                    { label: "sandstone", value: "sandstone" }
                  ]}
                  value={sharedFields.stone_family}
                  onChange={(v) => handleStoneFamilyChange(v)}
                  accessibilityLabel="Select shared stone family"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Collection Name", "collection_name", sharedFields.collection_name)}
                  value={sharedFields.collection_name}
                  onChange={(v) => handleSharedFieldChange("collection_name", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter collection name"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Collection Location", "collection_location", sharedFields.collection_location)}
                  options={[{ label: "Select location...", value: "" }, ...collectionLocationOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.collection_location}
                  onChange={(v) => handleSharedFieldChange("collection_location", v)}
                  accessibilityLabel="Select collection location"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Collection Date", "collection_date", sharedFields.collection_date)}
                  value={sharedFields.collection_date}
                  onChange={(v) => handleSharedFieldChange("collection_date", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter shared collection date"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Origin Location", "origin_location", sharedFields.origin_location)}
                  value={sharedFields.origin_location}
                  onChange={(v) => handleSharedFieldChange("origin_location", v)}
                  autoComplete="off"
                  placeholder="Where was this stone found?"
                  accessibilityLabel="Enter origin location"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Rescued By", "rescued_by", sharedFields.rescued_by)}
                  options={[...rescuedByOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.rescued_by}
                  onChange={(v) => handleSharedFieldChange("rescued_by", v)}
                  accessibilityLabel="Select rescued by"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Treatment Status", "treatment_status", sharedFields.treatment_status)}
                  options={[...treatmentStatusOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.treatment_status}
                  onChange={(v) => handleSharedFieldChange("treatment_status", v)}
                  accessibilityLabel="Select treatment status"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Origin Story", "origin_story", sharedFields.origin_story)}
                  value={sharedFields.origin_story}
                  onChange={(v) => handleSharedFieldChange("origin_story", v)}
                  autoComplete="off"
                  multiline={2}
                  accessibilityLabel="Enter shared origin story"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <Select
                  label={renderLabel("Product Type", "primary_use", sharedFields.primary_use)}
                  options={[{ label: "Select...", value: "" }, ...productTypeOptions.map(o => ({ label: o, value: o }))]}
                  value={sharedFields.primary_use}
                  onChange={(v) => handleSharedFieldChange("primary_use", v)}
                  accessibilityLabel="Select product type"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Primary Medium", "primary_medium", sharedFields.primary_medium)}
                  value={sharedFields.primary_medium}
                  onChange={(v) => handleSharedFieldChange("primary_medium", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter Primary Medium"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Secondary Medium", "secondary_medium", sharedFields.secondary_medium)}
                  value={sharedFields.secondary_medium}
                  onChange={(v) => handleSharedFieldChange("secondary_medium", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter Secondary Medium"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Wire Material", "wire_material", sharedFields.wire_material)}
                  value={sharedFields.wire_material}
                  onChange={(v) => handleSharedFieldChange("wire_material", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter Wire Material"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Setting Ready", "setting_ready", sharedFields.setting_ready)}
                  value={sharedFields.setting_ready}
                  onChange={(v) => handleSharedFieldChange("setting_ready", v)}
                  autoComplete="off"
                  placeholder="e.g. true or false"
                  accessibilityLabel="Enter Setting Ready"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Bail Included", "bail_included", sharedFields.bail_included)}
                  value={sharedFields.bail_included}
                  onChange={(v) => handleSharedFieldChange("bail_included", v)}
                  autoComplete="off"
                  placeholder="e.g. true or false"
                  accessibilityLabel="Enter Bail Included"
                />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField
                  label={renderLabel("Weight (grams)", "weight_grams", sharedFields.weight_grams)}
                  value={sharedFields.weight_grams}
                  onChange={(v) => handleSharedFieldChange("weight_grams", v)}
                  autoComplete="off"
                  accessibilityLabel="Enter Weight in grams"
                />
              </div>
            </div>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Section C: Generate Description</Text>
            <div style={{ minHeight: "54px" }}>
              <Button
                size="large"
                variant="primary"
                icon={MagicIcon}
                onClick={() => handleGenerateDescription({ sharedFields, pieces, descFetcher: descriptionFetcher })}
                loading={isDescLoading}
                accessibilityLabel="Write Description with Gemini"
              >
                Write Description with Gemini
              </Button>
            </div>
            {pieces[0]?.generated_description !== "" && (
              <TextField
                label="Generated Description — edit before saving"
                value={pieces[0]?.generated_description || ""}
                onChange={(v) => handlePieceChange(pieces[0]?.id, "generated_description", v)}
                multiline={10}
                autoComplete="off"
                accessibilityLabel="Generated Description"
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

        <div style={{ minHeight: "54px" }}>
          {statusMessage !== "" ? (
            <Button
              size="large"
              variant="primary"
              fullWidth
              onClick={handleStartNewBatch}
              accessibilityLabel="Start New Batch"
            >
              Start New Batch
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
              accessibilityLabel="Submit and Create All Pieces"
            >
              Create All Pieces
            </Button>
          )}
        </div>

        <Card padding="400">
          <BlockStack gap="200">
            <Text variant="headingMd" as="h3">Debug — Piece State</Text>
            <Text as="p">Photos uploaded: {pieces[0]?.photoFiles?.length || 0}</Text>
            <Text as="p">Is uploading: {String(pieces[0]?.isUploading)}</Text>
            <Text as="p">Staged URLs: {JSON.stringify(pieces[0]?.stagedResourceUrls)}</Text>
            <Text as="p">mediaUrlsJson will send: {JSON.stringify((pieces[0]?.stagedResourceUrls || []).filter(u => u !== undefined && u !== ""))}</Text>
          </BlockStack>
        </Card>

        <Card padding="400">
          <BlockStack gap="400">
            <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Meta Scan</Text>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {scanKeys.map(key => {
                const isRequired = REQUIRED_FIELDS.includes(key);
                let val = combinedData[key];
                useSaved && (val = savedMap[key]);

                let isFilled = false;
                (val !== undefined && val !== null && val.toString().trim() !== "") && (isFilled = true);
                
                let isOptionalEmpty = false;
                (!isRequired && !isFilled) && (isOptionalEmpty = true);
                
                let isRequiredEmpty = false;
                (isRequired && !isFilled) && (isRequiredEmpty = true);
                
                const labelText = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {isFilled && <span style={{ color: "#008060", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
                    {isOptionalEmpty && <span style={{ color: "#FFC453", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
                    {isRequiredEmpty && <span style={{ color: "#D72C0D", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
                    <span style={{ fontSize: "15px", fontWeight: "500" }}>
                      {labelText}
                      {(useSaved && isFilled) && ` — ${val}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </BlockStack>
        </Card>
      </BlockStack>
      {geoToast && <Toast content="Geo data loaded" onDismiss={() => setGeoToast(false)} />}
      {titleToastActive && (
        <Toast 
          content={titleToastMsg} 
          error={titleToastError} 
          onDismiss={() => setTitleToastActive(false)} 
        />
      )}
    </Frame>
  );
}
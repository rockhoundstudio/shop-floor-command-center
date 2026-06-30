import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, DropZone, Spinner } from "@shopify/polaris";
import { PlusIcon, MagicIcon } from "@shopify/polaris-icons";
import { useFetcher } from "react-router";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";
import { handleScanPhoto, handleGenerateDescription, buildMetafieldsJson, buildTitle } from "./app.meta-injector.intake-helpers.jsx";

export function NewProductIntakeTab({ fetcher }) {
  const stageFetcher = useFetcher();
  const autoFillFetcher = useFetcher();
  const descriptionFetcher = useFetcher();
  const scanFetcher = useFetcher();

  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState([]);

  const [sharedFields, setSharedFields] = useState({
    material: "",
    stone_family: "",
    collection_location: "",
    collection_date: "",
    origin_location: "",
    rescued_by: "",
    treatment_status: "100% Natural/Untreated",
    bench_notes: "",
    origin_story: "",
    primary_use: ""
  });

  const [pieces, setPieces] = useState([
    {
      id: Date.now().toString(),
      piece_name: "",
      dimensions_mm: "",
      cut_and_shape: "",
      surface_finish: "",
      primary_color: "",
      stone_shape: "",
      price: "",
      photoFiles: [],
      photoPreviewUrls: [],
      stagedResourceUrls: [],
      scanError: "",
      scanToken: "",
      isUploading: false
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");

  const handleTopDropZoneDrop = useCallback((dropFiles) => {
    setPhotoFiles(prev => {
      const combined = [...prev, ...dropFiles];
      const capped = combined.slice(0, 5);
      setPhotoPreviewUrls(capped.map(f => URL.createObjectURL(f)));
      return capped;
    });
  }, []);

  const handleRemoveTopPhoto = useCallback((index) => {
    setPhotoFiles(prev => {
      const updated = prev.filter((_, i) => i !== index);
      setPhotoPreviewUrls(updated.map(f => URL.createObjectURL(f)));
      return updated;
    });
  }, []);

  const handleScanGeminiPhotos = useCallback(() => {
    const formData = new FormData();
    formData.append("intent", "visionScan");
    photoFiles.forEach(file => {
      formData.append("photos[]", file);
    });
    scanFetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill", encType: "multipart/form-data" });
  }, [photoFiles, scanFetcher]);

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (updated[key] = value);
      return updated;
    }));
  }, []);

  const handleDropZoneDrop = useCallback((id, dropFiles) => {
    setPieces(prev => prev.map(p => {
      let updated = { ...p };
      (p.id === id) && (() => {
        const combined = [...p.photoFiles, ...dropFiles];
        const capped = combined.slice(0, 5);
        updated.photoFiles = capped;
        updated.photoPreviewUrls = capped.map(f => URL.createObjectURL(f));
      })();
      return updated;
    }));
  }, []);

  const handleAddRow = useCallback(() => {
    setPieces(prev => [
      ...prev,
      {
        id: Date.now().toString() + Math.random().toString(),
        piece_name: "",
        dimensions_mm: "",
        cut_and_shape: "",
        surface_finish: "",
        primary_color: "",
        stone_shape: "",
        price: "",
        photoFiles: [],
        photoPreviewUrls: [],
        stagedResourceUrls: [],
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
      primary_color: pieces[0].primary_color,
      stone_shape: pieces[0].stone_shape,
      price: pieces[0].price,
      title: buildTitle(sharedFields, pieces[0]),
      descriptionHtml: generatedDescription,
      productType: productType,
      status: "DRAFT",
      metafieldsJson: buildMetafieldsJson(sharedFields, pieces[0]),
      mediaUrlsJson: JSON.stringify(pieces[0].stagedResourceUrls.filter(u => u !== undefined && u !== ""))
    };

    fetcher.submit(payload, { method: "post", action: "/app/meta-injector-api" });
  }, [sharedFields, pieces, generatedDescription, fetcher]);

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
        setPieces([{
          id: Date.now().toString(),
          piece_name: "",
          dimensions_mm: "",
          cut_and_shape: "",
          surface_finish: "",
          primary_color: "",
          stone_shape: "",
          price: "",
          photoFiles: [],
          photoPreviewUrls: [],
          stagedResourceUrls: [],
          scanError: "",
          scanToken: "",
          isUploading: false
        }]);
        setGeneratedDescription("");
        setPhotoFiles([]);
        setPhotoPreviewUrls([]);
      })();

      (isCreate && isError) && (() => {
        let errStr = "An error occurred during product creation.";
        fetcher.data.error && (errStr = fetcher.data.error);
        setErrorMessage(errStr);
      })();
    })();
  }, [fetcher.state, fetcher.data]);

  useEffect(() => {
    const isIdle = scanFetcher.state === "idle";
    const hasData = scanFetcher.data !== undefined && scanFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = scanFetcher.data;
      const hasDescription = data.description !== undefined && data.description !== null && data.description !== "";

      (hasDescription) && (() => {
        setGeneratedDescription(data.description);
      })();
    })();
  }, [scanFetcher.state, scanFetcher.data]);

  useEffect(() => {
    const isIdle = stageFetcher.state === "idle";
    const hasData = stageFetcher.data !== undefined && stageFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = stageFetcher.data;
      const isStaged = data.intent === "stagedUpload";
      const isSuccess = data.success === true;
      const isError = data.success === false;
      const pid = data.pieceId;
      const token = data.scanToken;
      const target = data.targets?.[0];

      (isStaged && isError) && (() => {
        handlePieceChange(pid, "scanError", data.error || "Stage failed");
      })();

      const piece = pieces.find(p => p.id === pid);
      let shouldUpload = false;
      (isStaged && isSuccess && piece && piece.scanToken === token && !piece.isUploading && target) && (shouldUpload = true);

      (shouldUpload) && (() => {
        handlePieceChange(pid, "isUploading", true);

        const doUpload = async () => {
          const file = piece.photoFiles[0];
          const formData = new FormData();
          target.parameters.forEach(p => formData.append(p.name, p.value));
          formData.append("file", file);

          try {
            const res = await fetch(target.url, { method: "POST", body: formData });
            (!res.ok) && (() => { throw new Error("Upload to Shopify failed"); })();

            let newUrls = [...piece.stagedResourceUrls];
            newUrls[0] = target.resourceUrl;
            handlePieceChange(pid, "stagedResourceUrls", newUrls);

            autoFillFetcher.submit(
              { intent: "tab2AutoFill", pieceId: pid, imageUrl: target.resourceUrl },
              { method: "post", action: "/app/meta-injector-autofill" }
            );
          } catch (err) {
            handlePieceChange(pid, "scanError", err.message);
          } finally {
            handlePieceChange(pid, "isUploading", false);
          }
        };
        doUpload();
      })();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stageFetcher.state, stageFetcher.data]);

  useEffect(() => {
    const isIdle = autoFillFetcher.state === "idle";
    const hasData = autoFillFetcher.data !== undefined && autoFillFetcher.data !== null;

    (isIdle && hasData) && (() => {
      const data = autoFillFetcher.data;
      const isScan = data.intent === "tab2AutoFill";
      const isSuccess = data.success === true;
      const isError = data.success === false;

      (isScan && isSuccess) && (() => {
        setPieces(prev => prev.map(p => {
          let updated = { ...p };
          (p.id === data.pieceId) && (() => {
            data.surface_finish && (updated.surface_finish = data.surface_finish);
            data.primary_color && (updated.primary_color = data.primary_color);
            data.stone_shape && (updated.stone_shape = data.stone_shape);
            data.dimensions_mm && (updated.dimensions_mm = data.dimensions_mm);
            data.cut_and_shape && (updated.cut_and_shape = data.cut_and_shape);
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
  }, [autoFillFetcher.state, autoFillFetcher.data]);

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
        setGeneratedDescription(descStr);
      })();
    })();
  }, [descriptionFetcher.state, descriptionFetcher.data]);

  let isSubmitting = false;
  (fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct") && (isSubmitting = true);

  let isDescLoading = false;
  (descriptionFetcher.state !== "idle") && (isDescLoading = true);

  const productTypeOptions = [
    "Cabochon", "Pendant", "Necklace", "Earrings", "Ring", "Bracelet", "Wire Wrap", "Driftwood Art", "Display Specimen", "Collector Piece", "Other"
  ];

  const collectionLocationOptions = [
    "Spokane River", "Yakima Canyon", "Yellowstone River", "Richardson's Rock Ranch", "The 3,000-Mile Run", "Nickel Back", "Rufus Serpentine", "The Shopped Rock", "The Gallery"
  ];

  const rescuedByOptions = ["", "Bob", "Janyce", "Bob and Janyce"];
  const treatmentStatusOptions = ["100% Natural/Untreated", "Heat Treated", "Dyed", "Stabilized", "Irradiated", "Coated"];
  const surfaceFinishOptions = ["", "High Polish", "Matte", "Satin", "Hand Polish", "Natural"];

  const combinedData = { ...sharedFields, ...(pieces[0] || {}) };
  const scanKeys = [...ROCKHOUND_FIELDS.map(f => f.key), "origin_story", "price"];

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

  let topDotColor = "#C62828";
  (photoFiles.length > 0) && (topDotColor = "#2E7D32");

  let hasTopPhotos = false;
  (photoFiles.length > 0) && (hasTopPhotos = true);

  let showScanButton = false;
  (photoFiles.length >= 1) && (showScanButton = true);

  let isScanningVision = false;
  (scanFetcher.state === "submitting") && (isScanningVision = true);

  let genDescDotColor = "#C62828";
  (generatedDescription !== "") && (genDescDotColor = "#2E7D32");

  return (
    <BlockStack gap="600">
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
              <circle cx="9" cy="9" r="9" fill={topDotColor} />
            </svg>
            <Text variant="headingMd" as="h2" fontWeight="bold">Stone Photos</Text>
          </div>
          
          <DropZone 
            accept="image/jpeg, image/png, image/gif" 
            type="image" 
            allowMultiple 
            onDrop={(_dropFiles, acceptedFiles) => handleTopDropZoneDrop(acceptedFiles)}
            accessibilityLabel="Upload stone photos"
          >
            <DropZone.FileUpload actionTitle="Drop photos here or click to upload" />
          </DropZone>
          
          {hasTopPhotos && (
            <div style={{ display: "flex", gap: "16px", marginTop: "12px", flexWrap: "wrap", paddingTop: "8px", paddingRight: "8px" }}>
              {photoPreviewUrls.map((url, i) => (
                <div key={i} style={{ position: "relative", width: "80px", height: "80px" }}>
                  <img src={url} alt={`Preview ${i}`} style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemoveTopPhoto(i);
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
            {photoFiles.length} of 5 photos
          </Text>

          {showScanButton && (
            <div style={{ minHeight: "48px", marginTop: "16px" }}>
              <Button
                size="large"
                variant="primary"
                fullWidth
                onClick={handleScanGeminiPhotos}
              >
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  {isScanningVision && <Spinner size="small" />}
                  Scan Photos with Gemini
                </span>
              </Button>
            </div>
          )}

          <div style={{ minHeight: "48px", marginTop: "16px" }}>
            <TextField
              label={
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <svg width="18" height="18" viewBox="0 0 18 18" style={{ display: "inline-block" }}>
                    <circle cx="9" cy="9" r="9" fill={genDescDotColor} />
                  </svg>
                  <Text variant="headingMd" as="h3">Description</Text>
                </div>
              }
              value={generatedDescription}
              onChange={setGeneratedDescription}
              multiline={6}
              autoComplete="off"
              placeholder="Gemini will generate a description from your photos..."
              accessibilityLabel="Generated product description"
            />
          </div>
        </BlockStack>
      </Card>

      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Section A: Shared Batch Fields</Text>
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
              <TextField
                label={renderLabel("Stone Family", "stone_family", sharedFields.stone_family)}
                value={sharedFields.stone_family}
                onChange={(v) => handleSharedFieldChange("stone_family", v)}
                autoComplete="off"
                accessibilityLabel="Enter shared stone family"
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
                label={renderLabel("Bench Notes", "bench_notes", sharedFields.bench_notes)}
                value={sharedFields.bench_notes}
                onChange={(v) => handleSharedFieldChange("bench_notes", v)}
                autoComplete="off"
                multiline={3}
                placeholder="Setting, drill, bail, wire — anything special"
                accessibilityLabel="Enter bench notes"
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
          </div>
        </BlockStack>
      </Card>

      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2" style={{ fontSize: "14px" }}>Section B: Per-Piece Rows</Text>

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
              (autoFillFetcher.state !== "idle" && autoFillFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);
              (piece.isUploading) && (isScanning = true);

              let hasScanError = false;
              (piece.scanError && piece.scanError !== "") && (hasScanError = true);

              let hasPhotos = false;
              (piece.photoFiles && piece.photoFiles.length > 0) && (hasPhotos = true);

              let disableScan = true;
              (hasPhotos) && (disableScan = false);

              return (
                <div key={piece.id} style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "24px", borderBottom: "1px solid #e1e3e5" }}>
                  
                  <div style={{ display: "flex", alignItems: "end", gap: "16px" }}>
                    <div style={{ flexGrow: 1, minHeight: "54px" }}>
                      <TextField
                        label={renderLabel("Piece Name", "piece_name", piece.piece_name)}
                        value={piece.piece_name}
                        onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                        autoComplete="off"
                        accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ minHeight: "54px", width: "240px" }}>
                      <Button
                        size="large"
                        fullWidth
                        icon={MagicIcon}
                        disabled={disableScan}
                        onClick={() => handleScanPhoto({ piece, updatePiece: handlePieceChange, stageFetcher, setErrorMessage })}
                        loading={isScanning}
                        accessibilityLabel={`Scan First Photo with Gemini for row ${index + 1}`}
                      >
                        Scan First Photo with Gemini
                      </Button>
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
                        label={renderLabel("Primary Color", "primary_color", piece.primary_color)}
                        value={piece.primary_color}
                        onChange={(v) => handlePieceChange(piece.id, "primary_color", v)}
                        autoComplete="off"
                        placeholder="Primary color"
                        accessibilityLabel={`Enter primary color for row ${index + 1}`}
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
          {generatedDescription !== "" && (
            <TextField
              label="Generated Description — edit before saving"
              value={generatedDescription}
              onChange={setGeneratedDescription}
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
        <Button
          size="large"
          variant="primary"
          tone="success"
          fullWidth
          onClick={handleCreateAll}
          loading={isSubmitting}
          accessibilityLabel="Submit and Create All Pieces"
        >
          Create All Pieces
        </Button>
      </div>

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
  );
}
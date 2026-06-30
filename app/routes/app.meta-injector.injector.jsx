import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";

// NOTE ON GRAPHQL FETCH:
// If the product list is loaded via a loader in a separate file (like meta-injector.loader.jsx),
// you MUST add `images(first: 1) { edges { node { url } } }` to the products query in that file.
// There is no existing GraphQL query in THIS specific code snippet to modify, as this component 
// handles state for creating new products and uses fetcher.submit() to send data.

export function NewProductIntakeTab({ fetcher }) {
  const [sharedFields, setSharedFields] = useState({
    material: "",
    collection_location: "",
    collection_date: "",
    origin_story: "",
    treated: "",
    stone_family: "",
    primary_use: ""
  });

  const [pieces, setPieces] = useState([
    { id: Date.now().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // Log the first product's images array to the browser console so we can confirm data is arriving
    if (pieces.length > 0) {
      console.log("First product images array:", pieces[0]?.images?.edges || "No images array currently present on piece");
    }
  }, [pieces]);

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  }, []);

  const handleAddRow = useCallback(() => {
    setPieces(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }
    ]);
  }, []);

  const handleRemoveRow = useCallback((id) => {
    setPieces(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    const payload = {
      sharedFields,
      rows: pieces
    };

    fetcher.submit(
      { intent: "createProduct", pieces: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [sharedFields, pieces, fetcher]);

  useEffect(() => {
    const isIdle = fetcher.state === "idle";
    const hasData = fetcher.data !== undefined && fetcher.data !== null;

    if (isIdle && hasData) {
      const isCreate = fetcher.data.intent === "createProduct";
      const isSuccess = fetcher.data.success === true;
      const isError = fetcher.data.success === false;

      if (isCreate && isSuccess) {
        setStatusMessage(`Successfully created ${fetcher.data.createdCount || 0} pieces.`);
        setPieces([{ id: Date.now().toString(), piece_name: "", dimensions_mm: "", cut_and_shape: "", price: "" }]);
      }

      if (isCreate && isError) {
        setErrorMessage(fetcher.data.error || "An error occurred during product creation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const isSubmitting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct";
  
  const productTypeOptions = [
    "Cabochon", "Pendant", "Necklace", "Earrings", "Ring", "Bracelet", "Wire Wrap", "Driftwood Art", "Display Specimen", "Collector Piece", "Other"
  ];

  const collectionLocationOptions = [
    "Spokane River",
    "Yakima Canyon",
    "Yellowstone River",
    "Richardson's Rock Ranch",
    "The 3,000-Mile Run",
    "Nickel Back",
    "Rufus Serpentine",
    "The Shopped Rock",
    "The Gallery"
  ];

  const combinedData = { ...sharedFields, ...(pieces[0] || {}) };
  const scanKeys = [...ROCKHOUND_FIELDS.map(f => f.key), "origin_story", "price"];

  const actionData = fetcher.data;
  const useSaved = actionData?.success === true;
  const savedMap = {};
  if (actionData && actionData.savedMetafields) {
    actionData.savedMetafields.forEach(mf => { savedMap[mf.key] = mf.value; });
  }

  const renderLabel = (text, key, value) => {
    const isRequired = REQUIRED_FIELDS.includes(key);
    const isFilled = value !== undefined && value !== null && value.toString().trim() !== "";
    const dotColor = isFilled ? "#008060" : (isRequired ? "#D72C0D" : "#FFC453");
    return (
      <span>
        <span style={{ color: dotColor, fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center", marginRight: "4px" }}>●</span>
        {text}
      </span>
    );
  };

  const filteredPieces = pieces.filter(piece => 
    piece.piece_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <BlockStack gap="600">
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section A: Shared Batch Fields</Text>
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
                label={renderLabel("Treated", "treated", sharedFields.treated)}
                options={[{ label: "Select...", value: "" }, ...DEFAULT_DROPDOWNS.treated.map(o => ({ label: o.replace(/ΓÇö/g, '—'), value: o.replace(/ΓÇö/g, '—') }))]}
                value={sharedFields.treated}
                onChange={(v) => handleSharedFieldChange("treated", v)}
                accessibilityLabel="Select shared treated status"
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
          <Text variant="headingMd" as="h2">Section B: Per-Piece Rows</Text>
          
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
            {searchQuery && (
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
              const imageUrl = piece.images?.edges?.[0]?.node?.url;
              
              return (
                <div key={piece.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "16px", alignItems: "end" }}>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "56px" }}>
                    {imageUrl ? (
                      <img 
                        src={imageUrl} 
                        alt={`Hero image for ${piece.piece_name || 'New Piece'}`}
                        style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} 
                        aria-label={`Hero image for ${piece.piece_name || 'New Piece'}`}
                      />
                    ) : (
                      <div 
                        style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }}
                        aria-label={`Hero image for ${piece.piece_name || 'New Piece'}`}
                      />
                    )}
                    
                    <div style={{ flexGrow: 1 }}>
                      <TextField
                        label={renderLabel("Piece Name", "piece_name", piece.piece_name)}
                        value={piece.piece_name}
                        onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                        autoComplete="off"
                        accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                      />
                    </div>
                  </div>

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
                    <TextField
                      label={renderLabel("Price", "price", piece.price)}
                      value={piece.price}
                      onChange={(v) => handlePieceChange(piece.id, "price", v)}
                      autoComplete="off"
                      accessibilityLabel={`Enter Price for row ${index + 1}`}
                    />
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
          <Text variant="headingMd" as="h2">Meta Scan</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {scanKeys.map(key => {
              const isRequired = REQUIRED_FIELDS.includes(key);
              const val = useSaved ? savedMap[key] : combinedData[key];
              const isFilled = val !== undefined && val !== null && val.toString().trim() !== "";
              const isOptionalEmpty = !isRequired && !isFilled;
              const isRequiredEmpty = isRequired && !isFilled;
              const labelText = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');

              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {isFilled && <span style={{ color: "#008060", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
                  {isOptionalEmpty && <span style={{ color: "#FFC453", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
                  {isRequiredEmpty && <span style={{ color: "#D72C0D", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { useFetcher } from "@remix-run/react";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";

export function NewProductIntakeTab({ fetcher }) {
  const autoFillFetcher = useFetcher();
  const descriptionFetcher = useFetcher();

  const [sharedFields, setSharedFields] = useState({
    material: "",
    collection_location: "",
    collection_date: "",
    origin_location: "",
    rescued_by: "",
    treatment_status: "100% Natural/Untreated",
    bench_notes: "",
    origin_story: "",
    treated: "",
    stone_family: "",
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
      photoBase64: "",
      scanError: ""
    }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [generatedDescription, setGeneratedDescription] = useState("");

  useEffect(() => {
    (pieces.length > 0) && console.log("First product images array:", pieces[0]?.images?.edges || "No images array currently present on piece");
  }, [pieces]);

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

  const handleFileUpload = useCallback((id, event) => {
    const file = event.target.files[0];
    file && (() => {
      const reader = new FileReader();
      reader.onloadend = () => {
        handlePieceChange(id, "photoBase64", reader.result);
      };
      reader.readAsDataURL(file);
    })();
  }, [handlePieceChange]);

  const handleScanPhoto = useCallback((piece) => {
    autoFillFetcher.submit(
      { intent: "tab2AutoFill", pieceId: piece.id, photoBase64: piece.photoBase64, pieceData: JSON.stringify(piece) },
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  }, [autoFillFetcher]);

  const handleGenerateDescription = useCallback(() => {
    const payload = {
      sharedFields,
      firstPiece: pieces[0]
    };
    descriptionFetcher.submit(
      { intent: "generateDescription", payload: JSON.stringify(payload) },
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  }, [sharedFields, pieces, descriptionFetcher]);

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
        photoBase64: "",
        scanError: ""
      }
    ]);
  }, []);

  const handleRemoveRow = useCallback((id) => {
    setPieces(prev => prev.filter(p => p.id !== id));
  }, []);

  const handleCreateAll = useCallback(() => {
    setStatusMessage("");
    setErrorMessage("");

    const payload = {
      sharedFields,
      rows: pieces,
      description: generatedDescription
    };

    fetcher.submit(
      { intent: "createProduct", pieces: JSON.stringify(payload) },
      { method: "post" }
    );
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
        setStatusMessage(`Successfully created ${count} pieces.`);
        setPieces([{
          id: Date.now().toString(),
          piece_name: "",
          dimensions_mm: "",
          cut_and_shape: "",
          surface_finish: "",
          primary_color: "",
          stone_shape: "",
          price: "",
          photoBase64: "",
          scanError: ""
        }]);
        setGeneratedDescription("");
      })();

      (isCreate && isError) && (() => {
        let errStr = "An error occurred during product creation.";
        fetcher.data.error && (errStr = fetcher.data.error);
        setErrorMessage(errStr);
      })();
    })();
  }, [fetcher.state, fetcher.data]);

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

  const rescuedByOptions = ["Bob", "Janyce", "Bob and Janyce"];
  const treatmentStatusOptions = ["100% Natural/Untreated", "Heat Treated", "Dyed", "Stabilized", "Irradiated", "Coated"];
  const surfaceFinishOptions = ["High Polish", "Matte", "Satin", "Hand Polish", "Natural"];

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

  return (
    <BlockStack gap="600">
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
                accessibilityLabel="Enter origin location"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <Select
                label={renderLabel("Rescued By", "rescued_by", sharedFields.rescued_by)}
                options={[{ label: "Select rescuer...", value: "" }, ...rescuedByOptions.map(o => ({ label: o, value: o }))]}
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
                label={renderLabel("Treated", "treated", sharedFields.treated)}
                options={[{ label: "Select...", value: "" }, ...DEFAULT_DROPDOWNS.treated.map(o => ({ label: o.replace(/ΓÇö/g, '—'), value: o.replace(/ΓÇö/g, '—') }))]}
                value={sharedFields.treated}
                onChange={(v) => handleSharedFieldChange("treated", v)}
                accessibilityLabel="Select shared treated status"
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
              const imageUrl = piece.images?.edges?.[0]?.node?.url;
              
              let hasBase64 = false;
              (piece.photoBase64 && piece.photoBase64 !== "") && (hasBase64 = true);
              
              let hasUrl = false;
              (imageUrl && imageUrl !== "") && (hasUrl = true);
              
              let showImage = false;
              (hasBase64 || hasUrl) && (showImage = true);

              let imgSrc = "";
              hasUrl && (imgSrc = imageUrl);
              hasBase64 && (imgSrc = piece.photoBase64);

              let isScanning = false;
              (autoFillFetcher.state !== "idle" && autoFillFetcher.formData?.get("pieceId") === piece.id) && (isScanning = true);

              let hasScanError = false;
              (piece.scanError && piece.scanError !== "") && (hasScanError = true);

              return (
                <div key={piece.id} style={{ display: "flex", flexDirection: "column", gap: "16px", paddingBottom: "24px", borderBottom: "1px solid #e1e3e5" }}>
                  
                  <div style={{ display: "flex", alignItems: "end", gap: "16px" }}>
                    {showImage && (
                      <img
                        src={imgSrc}
                        alt={`Hero image for ${piece.piece_name || 'New Piece'}`}
                        style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }}
                        aria-label={`Hero image for ${piece.piece_name || 'New Piece'}`}
                      />
                    )}
                    {!showImage && (
                      <div
                        style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }}
                        aria-label={`Hero image for ${piece.piece_name || 'New Piece'}`}
                      />
                    )}

                    <div style={{ flexGrow: 1, minHeight: "54px" }}>
                      <TextField
                        label={renderLabel("Piece Name", "piece_name", piece.piece_name)}
                        value={piece.piece_name}
                        onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                        autoComplete="off"
                        accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ position: "relative", overflow: "hidden", display: "inline-block", minHeight: "54px", width: "160px" }}>
                      <Button size="large" fullWidth accessibilityLabel={`Upload Photo for row ${index + 1}`}>
                        Upload Photo
                      </Button>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        onChange={(e) => handleFileUpload(piece.id, e)}
                        aria-label={`Upload Photo for row ${index + 1}`}
                      />
                    </div>

                    <div style={{ minHeight: "54px", width: "220px" }}>
                      <Button
                        size="large"
                        fullWidth
                        onClick={() => handleScanPhoto(piece)}
                        loading={isScanning}
                        accessibilityLabel={`Scan Photo with Gemini for row ${index + 1}`}
                      >
                        Scan Photo with Gemini
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
                        options={[{ label: "Select finish...", value: "" }, ...surfaceFinishOptions.map(o => ({ label: o, value: o }))]}
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
                        accessibilityLabel={`Enter primary color for row ${index + 1}`}
                      />
                    </div>
                    <div style={{ minHeight: "54px" }}>
                      <TextField
                        label={renderLabel("Stone Shape", "stone_shape", piece.stone_shape)}
                        value={piece.stone_shape}
                        onChange={(v) => handlePieceChange(piece.id, "stone_shape", v)}
                        autoComplete="off"
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
              onClick={handleGenerateDescription}
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
}}
                  <span style={{ fontSize: "15px", fontWeight: "500" }}>
                    {labelText}
                    {useSaved && isFilled && ` — ${val}`}
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
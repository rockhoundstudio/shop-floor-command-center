import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";

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
            {filteredPieces.map((piece, index) => (
              <div key={piece.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr auto", gap: "16px", alignItems: "end" }}>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Piece Name", "piece_name", piece.piece_name)}
                    value={piece.piece_name}
                    onChange={(v) => handlePieceChange(piece.id, "piece_name", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Piece Name for row ${index + 1}`}
                  />
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
            ))}
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
                  {isRequiredEmpty && <span style={{ color: "#D72C0D", fontSize: "18px", lineHeight: "18px", width: "18px", height: "18px", display: "inline-block", textAlign: "center" }}>●</span>}
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
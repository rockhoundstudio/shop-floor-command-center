import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, Checkbox, Collapsible } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";

export function NewProductIntakeTab({ fetcher }) {
  const [sharedFields, setSharedFields] = useState({
    // Preserved for save logic integrity
    collection_location: "",
    collection_date: "",
    stone_family: "",
    primary_use: "",
    
    // SECTION 1: Core Ignition
    handcrafted_by: "Bob and Janyce",
    is_one_of_a_kind: true,
    treated: "",
    
    // SECTION 2: Human Engine
    origin_story: "",
    honest_flaws_and_character: "",
    artist_notes: "",
    rescued_by: "",
    story_theme: "",
    origin_page_handle: "",
    stone_shape: "",
    surface_finish: "",
    collection_name: "",

    // SECTION 3: Google Machine
    "color-pattern": "",
    material: "",
    "jewelry-type": "",
    "necklace-design": "",
    "chain-link-type": "",
    "jewelry-finding-type": "",
    "target-gender": "",
    "age-group": "",
    authenticity: "",
    rarity: "",
    condition: "",
    found_object: false,
    custom_product: false,

    // SECTION 4: Geo-Vault
    mohs_hardness: "",
    luster: "",
    fracture_pattern: "",
    cleavage: "",
    specific_gravity: "",
    diaphaneity: "",
    "mineral-class": "",
    "crystal-system": "",
    "rock-composition": "",
    "rock-formation": "",
    "geological-era": "",
    geological_age: ""
  });

  const [pieces, setPieces] = useState([
    { id: Date.now().toString(), piece_name: "", dimensions_mm: "", weight_grams: "", price: "" }
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const [isGoogleOpen, setIsGoogleOpen] = useState(false);
  const [isGeoOpen, setIsGeoOpen] = useState(false);

  const handleSharedFieldChange = useCallback((key, value) => {
    setSharedFields(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePieceChange = useCallback((id, key, value) => {
    setPieces(prev => prev.map(p => p.id === id ? { ...p, [key]: value } : p));
  }, []);

  const handleAddRow = useCallback(() => {
    setPieces(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random().toString(), piece_name: "", dimensions_mm: "", weight_grams: "", price: "" }
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
        setPieces([{ id: Date.now().toString(), piece_name: "", dimensions_mm: "", weight_grams: "", price: "" }]);
      }

      if (isCreate && isError) {
        setErrorMessage(fetcher.data.error || "An error occurred during product creation.");
      }
    }
  }, [fetcher.state, fetcher.data]);

  const isSubmitting = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "createProduct";
  
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

  const renderSharedText = (label, key, multiline = false) => (
    <div style={{ minHeight: "54px" }}>
      <TextField
        label={renderLabel(label, key, sharedFields[key])}
        value={sharedFields[key] || ""}
        onChange={(v) => handleSharedFieldChange(key, v)}
        autoComplete="off"
        multiline={multiline ? 2 : false}
        accessibilityLabel={`Enter ${label}`}
      />
    </div>
  );

  const renderSharedCheckbox = (label, key) => (
    <div style={{ minHeight: "54px", display: "flex", alignItems: "center", paddingTop: "24px" }}>
      <Checkbox
        label={label}
        checked={!!sharedFields[key]}
        onChange={(v) => handleSharedFieldChange(key, v)}
      />
    </div>
  );

  const filteredPieces = pieces.filter(piece => 
    piece.piece_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <BlockStack gap="600">
      
      {/* SECTION 1: CORE IGNITION */}
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section 1 — Core Ignition</Text>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {renderSharedText("Handcrafted By", "handcrafted_by")}
            <div style={{ minHeight: "54px" }}>
              <Select
                label={renderLabel("Treated", "treated", sharedFields.treated)}
                options={[{ label: "Select...", value: "" }, ...(DEFAULT_DROPDOWNS?.treated?.map(o => ({ label: o.replace(/ΓÇö/g, '—'), value: o.replace(/ΓÇö/g, '—') })) || [])]}
                value={sharedFields.treated}
                onChange={(v) => handleSharedFieldChange("treated", v)}
                accessibilityLabel="Select treated status"
              />
            </div>
            {renderSharedCheckbox("Is One of a Kind", "is_one_of_a_kind")}
          </div>

          <div style={{ position: "relative", marginBottom: "8px", marginTop: "16px" }}>
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
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "transparent", border: "none", fontSize: "20px", cursor: "pointer",
                  padding: "4px", display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5f62"
                }}
              >✕</button>
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
                  />
                </div>
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
                    label={renderLabel("Weight (grams)", "weight_grams", piece.weight_grams)}
                    value={piece.weight_grams}
                    onChange={(v) => handlePieceChange(piece.id, "weight_grams", v)}
                    autoComplete="off"
                  />
                </div>
                <div style={{ minHeight: "54px" }}>
                  <TextField
                    label={renderLabel("Price", "price", piece.price)}
                    value={piece.price}
                    onChange={(v) => handlePieceChange(piece.id, "price", v)}
                    autoComplete="off"
                  />
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
            ))}
          </div>
          
          <div style={{ minHeight: "54px", marginTop: "16px" }}>
            <Button icon={PlusIcon} size="large" onClick={handleAddRow}>Add Row</Button>
          </div>
        </BlockStack>
      </Card>

      {/* SECTION 2: HUMAN ENGINE */}
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section 2 — Human Engine</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {renderSharedText("Origin Story", "origin_story", true)}
            {renderSharedText("Honest Flaws & Character", "honest_flaws_and_character", true)}
            {renderSharedText("Artist Notes", "artist_notes", true)}
            {renderSharedText("Rescued By", "rescued_by")}
            {renderSharedText("Story Theme", "story_theme")}
            {renderSharedText("Collection Name", "collection_name")}
            {renderSharedText("Origin Page Handle", "origin_page_handle")}
            {renderSharedText("Stone Shape", "stone_shape")}
            {renderSharedText("Surface Finish", "surface_finish")}
          </div>
        </BlockStack>
      </Card>

      {/* SECTION 3: GOOGLE MACHINE */}
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="headingMd" as="h2">Section 3 — Google Machine</Text>
            <Button onClick={() => setIsGoogleOpen(!isGoogleOpen)}>
              {isGoogleOpen ? "Close Section" : "Open Section"}
            </Button>
          </div>
          <Collapsible open={isGoogleOpen} id="google-machine-collapsible" transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingTop: "16px" }}>
              {renderSharedText("Color Pattern", "color-pattern")}
              {renderSharedText("Material", "material")}
              {renderSharedText("Jewelry Type", "jewelry-type")}
              {renderSharedText("Necklace Design", "necklace-design")}
              {renderSharedText("Chain Link Type", "chain-link-type")}
              {renderSharedText("Jewelry Finding Type", "jewelry-finding-type")}
              {renderSharedText("Target Gender", "target-gender")}
              {renderSharedText("Age Group", "age-group")}
              {renderSharedText("Authenticity", "authenticity")}
              {renderSharedText("Rarity", "rarity")}
              {renderSharedText("Condition", "condition")}
              {renderSharedCheckbox("Found Object", "found_object")}
              {renderSharedCheckbox("Custom Product", "custom_product")}
            </div>
          </Collapsible>
        </BlockStack>
      </Card>

      {/* SECTION 4: GEO-VAULT */}
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="headingMd" as="h2">Section 4 — Geo-Vault</Text>
            <Button onClick={() => setIsGeoOpen(!isGeoOpen)}>
              {isGeoOpen ? "Close Section" : "Open Section"}
            </Button>
          </div>
          <Collapsible open={isGeoOpen} id="geo-vault-collapsible" transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingTop: "16px" }}>
              {renderSharedText("Mohs Hardness", "mohs_hardness")}
              {renderSharedText("Luster", "luster")}
              {renderSharedText("Fracture Pattern", "fracture_pattern")}
              {renderSharedText("Cleavage", "cleavage")}
              {renderSharedText("Specific Gravity", "specific_gravity")}
              {renderSharedText("Diaphaneity", "diaphaneity")}
              {renderSharedText("Mineral Class", "mineral-class")}
              {renderSharedText("Crystal System", "crystal-system")}
              {renderSharedText("Rock Composition", "rock-composition")}
              {renderSharedText("Rock Formation", "rock-formation")}
              {renderSharedText("Geological Era", "geological-era")}
              {renderSharedText("Geological Age", "geological_age")}
            </div>
          </Collapsible>
        </BlockStack>
      </Card>

      {/* SYSTEM MESSAGES & SUBMIT */}
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

      {/* META SCAN */}
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

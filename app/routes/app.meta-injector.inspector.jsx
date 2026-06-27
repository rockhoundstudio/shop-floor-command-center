import React, { useState, useEffect, useCallback } from "react";
import { BlockStack, Card, Text, TextField, Select, Button, Banner, Checkbox, Collapsible } from "@shopify/polaris";
import { PlusIcon } from "@shopify/polaris-icons";
import { ROCKHOUND_FIELDS, DEFAULT_DROPDOWNS, REQUIRED_FIELDS } from "../utils/meta-injector.constants.jsx";

export function IntakeBenchTab({ products, autoFillFetcher, injectFetcher }) {
  const [sharedFields, setSharedFields] = useState({
    // Maintained state for save logic integrity
    collection_location: "",
    collection_date: "",
    stone_family: "",
    primary_use: "",
    
    // SECTION 1
    handcrafted_by: "Bob and Janyce",
    is_one_of_a_kind: true,
    treated: "",
    
    // SECTION 2
    origin_story: "",
    honest_flaws_and_character: "",
    artist_notes: "",
    rescued_by: "",
    story_theme: "",
    origin_page_handle: "",
    stone_shape: "",
    surface_finish: "",
    collection_name: "",

    // SECTION 3
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

    // SECTION 4
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

    injectFetcher.submit(
      { intent: "createProduct", pieces: JSON.stringify(payload) },
      { method: "post" }
    );
  }, [sharedFields, pieces, injectFetcher]);

  useEffect(() => {
    const isIdle = injectFetcher.state === "idle";
    const hasData = injectFetcher.data !== undefined && injectFetcher.data !== null;

    if (isIdle && hasData) {
      const isCreate = injectFetcher.data.intent === "createProduct";
      const isSuccess = injectFetcher.data.success === true;
      const isError = injectFetcher.data.success === false;

      if (isCreate && isSuccess) {
        setStatusMessage(`Successfully created ${injectFetcher.data.createdCount || 0} pieces.`);
        setPieces([{ id: Date.now().toString(), piece_name: "", dimensions_mm: "", weight_grams: "", price: "" }]);
      }

      if (isCreate && isError) {
        setErrorMessage(injectFetcher.data.error || "An error occurred during product creation.");
      }
    }
  }, [injectFetcher.state, injectFetcher.data]);

  const isSubmitting = injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "createProduct";
  
  const combinedData = { ...sharedFields, ...(pieces[0] || {}) };
  const scanKeys = [...ROCKHOUND_FIELDS.map(f => f.key), "origin_story", "price"];

  const actionData = injectFetcher.data;
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
      
      {/* SECTION 1: CORE IGNITION */}
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section 1 — Core Ignition</Text>
          
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Handcrafted By", "handcrafted_by", sharedFields.handcrafted_by)}
                value={sharedFields.handcrafted_by}
                onChange={(v) => handleSharedFieldChange("handcrafted_by", v)}
                autoComplete="off"
                accessibilityLabel="Enter Handcrafted By"
              />
            </div>
            <div style={{ minHeight: "54px", display: "flex", alignItems: "center", paddingTop: "24px" }}>
              <Checkbox
                label="Is One of a Kind"
                checked={!!sharedFields.is_one_of_a_kind}
                onChange={(v) => handleSharedFieldChange("is_one_of_a_kind", v)}
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <Select
                label={renderLabel("Treated", "treated", sharedFields.treated)}
                options={[{ label: "Select...", value: "" }, ...(DEFAULT_DROPDOWNS?.treated || []).map(o => ({ label: o.replace(/ΓÇö/g, '—'), value: o.replace(/ΓÇö/g, '—') }))]}
                value={sharedFields.treated}
                onChange={(v) => handleSharedFieldChange("treated", v)}
                accessibilityLabel="Select treated status"
              />
            </div>
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
                    label={renderLabel("Weight (grams)", "weight_grams", piece.weight_grams)}
                    value={piece.weight_grams}
                    onChange={(v) => handlePieceChange(piece.id, "weight_grams", v)}
                    autoComplete="off"
                    accessibilityLabel={`Enter Weight for row ${index + 1}`}
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
            <Button icon={PlusIcon} size="large" onClick={handleAddRow} accessibilityLabel="Add new piece row">
              Add Row
            </Button>
          </div>
        </BlockStack>
      </Card>

      {/* SECTION 2: HUMAN ENGINE */}
      <Card padding="400">
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">Section 2 — Human Engine</Text>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Origin Story", "origin_story", sharedFields.origin_story)}
                value={sharedFields.origin_story}
                onChange={(v) => handleSharedFieldChange("origin_story", v)}
                autoComplete="off"
                multiline={2}
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Honest Flaws and Character", "honest_flaws_and_character", sharedFields.honest_flaws_and_character)}
                value={sharedFields.honest_flaws_and_character}
                onChange={(v) => handleSharedFieldChange("honest_flaws_and_character", v)}
                autoComplete="off"
                multiline={2}
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Artist Notes", "artist_notes", sharedFields.artist_notes)}
                value={sharedFields.artist_notes}
                onChange={(v) => handleSharedFieldChange("artist_notes", v)}
                autoComplete="off"
                multiline={2}
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Rescued By", "rescued_by", sharedFields.rescued_by)}
                value={sharedFields.rescued_by}
                onChange={(v) => handleSharedFieldChange("rescued_by", v)}
                autoComplete="off"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Story Theme", "story_theme", sharedFields.story_theme)}
                value={sharedFields.story_theme}
                onChange={(v) => handleSharedFieldChange("story_theme", v)}
                autoComplete="off"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Origin Page Handle", "origin_page_handle", sharedFields.origin_page_handle)}
                value={sharedFields.origin_page_handle}
                onChange={(v) => handleSharedFieldChange("origin_page_handle", v)}
                autoComplete="off"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Stone Shape", "stone_shape", sharedFields.stone_shape)}
                value={sharedFields.stone_shape}
                onChange={(v) => handleSharedFieldChange("stone_shape", v)}
                autoComplete="off"
              />
            </div>
            <div style={{ minHeight: "54px" }}>
              <TextField
                label={renderLabel("Surface Finish", "surface_finish", sharedFields.surface_finish)}
                value={sharedFields.surface_finish}
                onChange={(v) => handleSharedFieldChange("surface_finish", v)}
                autoComplete="off"
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
          </div>
        </BlockStack>
      </Card>

      {/* SECTION 3: GOOGLE MACHINE */}
      <Card padding="400">
        <BlockStack gap="400">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Text variant="headingMd" as="h2">Section 3 — Google Machine</Text>
            <Button onClick={() => setIsGoogleOpen(!isGoogleOpen)}>
              {isGoogleOpen && "Close Section"}
              {!isGoogleOpen && "Open Section"}
            </Button>
          </div>
          <Collapsible open={isGoogleOpen} id="google-machine-collapsible" transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingTop: "16px" }}>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Color Pattern", "color-pattern", sharedFields["color-pattern"])} value={sharedFields["color-pattern"]} onChange={(v) => handleSharedFieldChange("color-pattern", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Material", "material", sharedFields.material)} value={sharedFields.material} onChange={(v) => handleSharedFieldChange("material", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Jewelry Type", "jewelry-type", sharedFields["jewelry-type"])} value={sharedFields["jewelry-type"]} onChange={(v) => handleSharedFieldChange("jewelry-type", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Necklace Design", "necklace-design", sharedFields["necklace-design"])} value={sharedFields["necklace-design"]} onChange={(v) => handleSharedFieldChange("necklace-design", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Chain Link Type", "chain-link-type", sharedFields["chain-link-type"])} value={sharedFields["chain-link-type"]} onChange={(v) => handleSharedFieldChange("chain-link-type", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Jewelry Finding Type", "jewelry-finding-type", sharedFields["jewelry-finding-type"])} value={sharedFields["jewelry-finding-type"]} onChange={(v) => handleSharedFieldChange("jewelry-finding-type", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Target Gender", "target-gender", sharedFields["target-gender"])} value={sharedFields["target-gender"]} onChange={(v) => handleSharedFieldChange("target-gender", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Age Group", "age-group", sharedFields["age-group"])} value={sharedFields["age-group"]} onChange={(v) => handleSharedFieldChange("age-group", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Authenticity", "authenticity", sharedFields.authenticity)} value={sharedFields.authenticity} onChange={(v) => handleSharedFieldChange("authenticity", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Rarity", "rarity", sharedFields.rarity)} value={sharedFields.rarity} onChange={(v) => handleSharedFieldChange("rarity", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Condition", "condition", sharedFields.condition)} value={sharedFields.condition} onChange={(v) => handleSharedFieldChange("condition", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px", display: "flex", alignItems: "center", paddingTop: "24px" }}>
                <Checkbox label="Found Object" checked={!!sharedFields.found_object} onChange={(v) => handleSharedFieldChange("found_object", v)} />
              </div>
              <div style={{ minHeight: "54px", display: "flex", alignItems: "center", paddingTop: "24px" }}>
                <Checkbox label="Custom Product" checked={!!sharedFields.custom_product} onChange={(v) => handleSharedFieldChange("custom_product", v)} />
              </div>
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
              {isGeoOpen && "Close Section"}
              {!isGeoOpen && "Open Section"}
            </Button>
          </div>
          <Collapsible open={isGeoOpen} id="geo-vault-collapsible" transition={{ duration: '300ms', timingFunction: 'ease-in-out' }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", paddingTop: "16px" }}>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Mohs Hardness", "mohs_hardness", sharedFields.mohs_hardness)} value={sharedFields.mohs_hardness} onChange={(v) => handleSharedFieldChange("mohs_hardness", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Luster", "luster", sharedFields.luster)} value={sharedFields.luster} onChange={(v) => handleSharedFieldChange("luster", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Fracture Pattern", "fracture_pattern", sharedFields.fracture_pattern)} value={sharedFields.fracture_pattern} onChange={(v) => handleSharedFieldChange("fracture_pattern", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Cleavage", "cleavage", sharedFields.cleavage)} value={sharedFields.cleavage} onChange={(v) => handleSharedFieldChange("cleavage", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Specific Gravity", "specific_gravity", sharedFields.specific_gravity)} value={sharedFields.specific_gravity} onChange={(v) => handleSharedFieldChange("specific_gravity", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Diaphaneity", "diaphaneity", sharedFields.diaphaneity)} value={sharedFields.diaphaneity} onChange={(v) => handleSharedFieldChange("diaphaneity", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Mineral Class", "mineral-class", sharedFields["mineral-class"])} value={sharedFields["mineral-class"]} onChange={(v) => handleSharedFieldChange("mineral-class", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Crystal System", "crystal-system", sharedFields["crystal-system"])} value={sharedFields["crystal-system"]} onChange={(v) => handleSharedFieldChange("crystal-system", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Rock Composition", "rock-composition", sharedFields["rock-composition"])} value={sharedFields["rock-composition"]} onChange={(v) => handleSharedFieldChange("rock-composition", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Rock Formation", "rock-formation", sharedFields["rock-formation"])} value={sharedFields["rock-formation"]} onChange={(v) => handleSharedFieldChange("rock-formation", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Geological Era", "geological-era", sharedFields["geological-era"])} value={sharedFields["geological-era"]} onChange={(v) => handleSharedFieldChange("geological-era", v)} autoComplete="off" />
              </div>
              <div style={{ minHeight: "54px" }}>
                <TextField label={renderLabel("Geological Age", "geological_age", sharedFields.geological_age)} value={sharedFields.geological_age} onChange={(v) => handleSharedFieldChange("geological_age", v)} autoComplete="off" />
              </div>
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
const handleInjectFields = () => {
    if (selectedItems.length === 0) return;

    // Package the full structural array of 22 metafields
    const payload = selectedItems.flatMap(id => {
      const fieldSpecs = [
        { key: "piece_name", value: pieceName },
        { key: "material", value: material },
        { key: "collection_location", value: origin },
        { key: "color", value: color },
        { key: "is_one_of_a_kind", value: "Yes — one of a kind" }, // Always stamped on intake
        
        // --- Remaining Shop Floor Specifications ---
        { key: "primary_medium", value: "" }, 
        { key: "secondary_medium", value: "" },
        { key: "handcrafted_by", value: "Janyce" }, // Auto-set for intake bench
        { key: "stone_family", value: "" },
        { key: "cut_and_shape", value: "" },
        { key: "surface_finish", value: "" },
        { key: "dimensions_mm", value: "" },
        { key: "weight_grams", value: "" },
        { key: "collection_name", value: "" },
        { key: "collection_date", value: "" },
        { key: "primary_use", value: "" },
        { key: "setting_ready", value: "" },
        { key: "bail_included", value: "" },
        { key: "treated", value: "No" }, // Default safe value
        { key: "found_object", value: "" },
        { key: "wire_material", value: "" },
        { key: "artist_notes", value: "" }
      ];

      // 🛑 THE SIEVE: Pass through defaults, but screen out any text fields left completely blank
      return fieldSpecs
        .filter(field => field.value !== undefined && field.value !== null && field.value.toString().trim() !== "")
        .map(field => ({
          ownerId: id,
          namespace: "rockhound",
          key: field.key,
          value: field.value.toString().trim(),
          type: "single_line_text_field"
        }));
    });

    if (payload.length === 0) {
      if (shopify) shopify.toast.show("Fill at least one specification field before injecting");
      return;
    }

    const formData = new FormData();
    formData.append("intent", "saveProduct");
    formData.append("payload", JSON.stringify(payload));
    fetcher.submit(formData, { method: "post" });
  };
export default IntakeEngine;

// ==========================================================================
// ROCKHOUND STUDIO — INTAKE HELPER FUNCTIONS
// File: app/routes/app.meta-injector.intake-helpers.jsx
// (100% Original Logic & Dash Delimiters Preserved + Strict Schema Map Added)
// ==========================================================================

export async function handleScanPhoto({ piece, updatePiece, autoFillFetcher, setErrorMessage }) {
  const file = piece.photoFiles[0];
  if (!file) return;

  updatePiece(piece.id, "scanError", "");

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(",")[1];
    autoFillFetcher.submit(
      {
        intent: "visionScan",
        pieceId: piece.id,
        imageBase64: base64,
        imageMimeType: file.type || "image/jpeg"
      },
      { method: "post", action: "/app/meta-injector-autofill" }
    );
  };
  reader.onerror = () => {
    updatePiece(piece.id, "scanError", "Failed to read file");
    setErrorMessage("Failed to read photo file");
  };
  reader.readAsDataURL(file);
}

export async function handleGenerateDescription({ sharedFields, pieces, descFetcher }) {
  const payload = {
    sharedFields,
    pieceData: pieces[0]
  };
  descFetcher.submit(
    {
      intent: "generateDescription",
      sharedFields: JSON.stringify(sharedFields),
      pieceData: JSON.stringify(pieces[0])
    },
    { method: "post", action: "/app/meta-injector-autofill" }
  );
}

// ==========================================
// STRICT METAFIELD SCHEMA MAP (From Sidekick)
// ==========================================
const METAFIELD_SCHEMA = {
  // SHOPIFY TAXONOMY (Requires metaobject_reference)
  "color-pattern": { namespace: "shopify", type: "list.metaobject_reference" },
  "material": { namespace: "shopify", type: "metaobject_reference" },
  "age-group": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-type": { namespace: "shopify", type: "metaobject_reference" },
  "target-gender": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-material": { namespace: "shopify", type: "metaobject_reference" },
  "necklace-design": { namespace: "shopify", type: "metaobject_reference" },
  "authenticity": { namespace: "shopify", type: "metaobject_reference" },
  "rarity": { namespace: "shopify", type: "metaobject_reference" },
  "condition": { namespace: "shopify", type: "metaobject_reference" },
  "crystal-system": { namespace: "shopify", type: "metaobject_reference" },
  "mineral-class": { namespace: "shopify", type: "metaobject_reference" },
  "geological-era": { namespace: "shopify", type: "metaobject_reference" },
  "rock-composition": { namespace: "shopify", type: "metaobject_reference" },
  "rock-formation": { namespace: "shopify", type: "metaobject_reference" },
  "chain-link-type": { namespace: "shopify", type: "metaobject_reference" },
  "jewelry-finding-type": { namespace: "shopify", type: "metaobject_reference" },

  // CUSTOM NAMESPACE (Strict Types)
  "weight_grams": { namespace: "custom", type: "number_decimal" },
  "stone_story": { namespace: "custom", type: "list.single_line_text_field" },
  "character_marks": { namespace: "custom", type: "list.single_line_text_field" }
};

export function buildMetafieldsJson(sharedFields, piece) {
  const allFields = { ...sharedFields, ...piece };
  
  // Omit internal UI state keys from being sent to Shopify Metafields
  const omitKeys = [
    "id", 
    "photoFiles", 
    "photoPreviewUrls", 
    "stagedResourceUrls", 
    "scanError", 
    "isUploading", 
    "scanToken",
    "photos",
    "imageBase64",
    "imageMimeType",
    "generated_description" // This belongs in body_html, not a metafield
  ];
  
  const metaArr = [];
  
  Object.keys(allFields).forEach(rawKey => {
    if (omitKeys.includes(rawKey) || allFields[rawKey] === undefined || allFields[rawKey] === null || allFields[rawKey] === "") {
      return;
    }

    let key = rawKey;
    let val = allFields[rawKey];

    // 1. FIX THE KEY MISMATCH
    if (key === "origin_handle") {
      key = "origin_page_handle";
    }

    // 2. LOOKUP SCHEMA (Default to custom string if not mapped above)
    const schema = METAFIELD_SCHEMA[key] || { namespace: "custom", type: "single_line_text_field" };
    let finalValue = String(val).trim();

    // 3. FORMAT VALUE BASED ON SHOPIFY DATA TYPE
    if (schema.type.startsWith("list.")) {
      // Shopify requires list fields to be stringified JSON arrays
      try {
        if (finalValue.startsWith("[") && finalValue.endsWith("]")) {
          JSON.parse(finalValue); // Verify it is a valid array
        } else {
          finalValue = JSON.stringify([finalValue]); // Wrap plain string into JSON array
        }
      } catch (e) {
        finalValue = JSON.stringify([finalValue]);
      }
    } 
    else if (schema.type === "number_decimal") {
      // Strip out words like "grams", leaving only numbers and decimals
      const num = finalValue.replace(/[^\d.-]/g, "");
      if (!num || isNaN(parseFloat(num))) return; 
      finalValue = num;
    }

    metaArr.push({
      namespace: schema.namespace,
      key: key,
      type: schema.type,
      value: finalValue
    });
  });
  
  return JSON.stringify(metaArr);
}

export function buildTitle(sharedFields, piece) {
  const family = sharedFields.stone_family || "Unknown Stone";
  const origin = sharedFields.origin_location || "Unknown Origin";
  const name = piece.piece_name || "New Piece";
  
  // EXACT ORIGINAL DASHES PRESERVED — DO NOT TOUCH
  return `${family} — ${origin} — ${name}`;
}
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

export function buildMetafieldsJson(sharedFields, piece) {
  const allFields = { ...sharedFields, ...piece };
  const omitKeys = ["id", "photoFiles", "photoPreviewUrls", "stagedResourceUrls", "scanError", "isUploading", "scanToken"];
  const metaArr = [];
  
  Object.keys(allFields).forEach(k => {
    if (!omitKeys.includes(k) && allFields[k] !== undefined && allFields[k] !== null && allFields[k] !== "") {
      metaArr.push({ key: k, value: allFields[k], type: "single_line_text_field" });
    }
  });
  
  return JSON.stringify(metaArr);
}

export function buildTitle(sharedFields, piece) {
  const family = sharedFields.stone_family || "Unknown Stone";
  const origin = sharedFields.origin_location || "Unknown Origin";
  const name = piece.piece_name || "New Piece";
  return `${family} — ${origin} — ${name}`;
}
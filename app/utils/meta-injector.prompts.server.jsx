// ==========================================================================
// ROCKHOUND STUDIO — PRODUCER GEMINI PROMPT BUILDERS
// File: app/utils/meta-injector.prompts.server.jsx
// Pure stateless prompt construction module: zero DB, zero GraphQL/network,
// zero model calls.
// ==========================================================================

import {
  isSettingOrHardwareMediumValue,
  classifyFoundObjectPolarity
} from "./meta-injector.standardized.jsx";
import {
  CLASSIFICATION_OVERRIDE_KEYS,
  PASSIVE_CONSTRUCTION_REVIEW_KEYS,
  PASSIVE_PROVENANCE_AND_SEO_KEYS,
  PASSIVE_GEOLOGY_REVIEW_KEYS,
  STONE_IDENTITY_KEYS,
  resolveCanonicalOoakFromInputs,
  resolveVerifiedStoneIdentityContext
} from "./meta-injector.autofill-inputs.server.jsx";

// ==========================================
// SHARED FACTUAL CONTRACT
// ==========================================
export const getSharedFactualContract = () => `
--- SHARED FACTUAL CONTRACT ---
1. PRIORITY: Explicit operator-locked corrections > established verified product facts > resolved origin/collection source context > supported visible observations.
2. UNKNOWN FACTS: Unknown facts MUST remain omitted. Do NOT invent defaults.
3. NO VISUAL INFERENCE OF FASTENING OR METAL COMPOSITION: Do not infer treatment, provenance, fastening method (bezel vs. glue-on/adhesive), metal alloy/fineness, plating, or mineral rarity from appearance or front photographs alone.
4. SEPARATE CONSTRUCTION DIMENSIONS: Keep these five dimensions strictly distinct:
   (a) Fastening method (e.g., glue-on/glue-in adhesive setting, pinch bail with pins passing through a drilled hole, wire wrap, or explicit verified bezel setting),
   (b) Decorative metal rim or frame around the stone,
   (c) Top chain loop or bail,
   (d) Metal alloy or fineness,
   (e) Metalwork plating/construction (e.g., Plated).
   Never infer "Bezel Setting", "Integrated Bezel Bail", "bezel-set", or "glue-on" from a visible metal rim, backing frame, or top chain loop alone. Where construction fastening is not explicitly confirmed in supplied facts, use supported neutral wording (such as "metal setting", "decorative metal rim", or "top chain loop") rather than inventing a mounting mechanism.
5. PINCH BAILS VS. FRAMED/BACKED SETTINGS: Preserve pinch-bail construction ("Silver Plated Pinch Bail", whose pins pass through a drilled hole in the stone) whenever visibly present or supplied in facts. Never turn a pinch bail into a glue-on or bezel setting.
6. STONE IDENTITY VS. SETTING / HARDWARE MATERIAL: primary_medium, material, and stone_family represent STONE/MINERAL identity ONLY (keeping mineral family such as "Agate" distinct from variety such as "Botswana Agate" when applicable). NEVER put metal, plating, alloy, wire, chain, or setting hardware (such as "Silver Plated", "Silver Alloy", "Sterling Silver", "Copper Wire", or "Pinch Bail") into primary_medium, material, or stone_family. Hardware/metal belongs only in secondary_medium, wire_material, chain_material, bail_included, or jewelry_finding_type. If stone identity is uncertain, omit it rather than guessing or substituting hardware material.
7. PROVENANCE & PURCHASE CONSISTENCY:
   - Never override explicit human/locked purchase provenance (such as found_object indicating purchased/false/No or an explicit purchase source) with a product title segment or collection membership.
   - When a stone was purchased (not field/river-collected), NEVER claim or imply it was "Found at...", river-collected, or field-collected in generated_description, seo_title, or poetic_hook, even if the product belongs to a regional or river-named collection.
   - A purchase venue or shop name establishes where the material was bought, NOT its geological origin. Never treat a purchase venue as geological formation/locality origin.
8. PHOTO-BASED SOLID LENGTH MEASUREMENT (overall_solid_length_in):
   - When a product is deliberately aligned with a measuring tape or ruler in the photo(s), read the visible tape markings, identifiable units, and both solid-product endpoints to determine overall_solid_length_in in decimal inches (including the solid setting/bail, strictly excluding any flexible necklace chain or cord).
   - All necklace chain/cord lengths are a separate confirmed 18 inches; never confuse or conflate the 18-inch necklace length with overall_solid_length_in.
   - If the measuring tape/ruler markings, units, or both solid-product endpoints cannot be read reliably from the photo(s), omit overall_solid_length_in completely. Never fall back to or calculate from dimensions_mm text alone.
-------------------------------
`;

export const getStandardizedCandidatesInstructions = () => `
STANDARDIZED ATTRIBUTE REVIEW CANDIDATES (standardized_candidates):
Also return a separate top-level JSON object key named "standardized_candidates" evaluating ONLY these six hyphenated keys when supported by evidence:
- "chain-link-type": Preserve "Cord" as an evidence-supported REVIEW candidate where explicitly supplied, but do not claim it is a verified allowed reference choice. Do not turn "Cord" into "Snake Chain".
- "construction": Metalwork construction, NOT craftsmanship or pendant assembly. Verified choices: "Clad", "Filled", "Other", "Plated", "Solid", "Toned", "Vermeil", "Whole". Propose only an evidence-supported choice. Explicit silver-plated or gold-plated hardware supports "Plated". Do not infer the construction of every component from one bail or infer plating/alloy from a front photo alone. Evidence must identify the component supporting the choice. Never default to "Solid" or "Other". Do NOT place "Handcrafted" in standardized "construction" candidates.
- "jewelry-finding-type": Preserve explicitly supplied component facts such as "Silver Plated Pinch Bail", "Glue-On Bail", "Assorted Glue-In Setting", or verified bezel findings when supplied in facts. These remain review candidates until exact reference matching. Do not claim the detailed label is accepted reference vocabulary. Do not infer hidden hardware or propose bezel or glue-on findings from a decorative rim or top loop alone.
- "material-origin": Physical product form/mounting state, NOT geography, natural/synthetic status, or intended use. Relevant verified choices: "Finished product (jewelry/watch)", "Loose/unmounted". Propose "Finished product (jewelry/watch)" ONLY when actual mounted or wear-ready evidence (such as an installed pinch bail, glue-on/mounted setting with top loop, wire wrap, verified bezel setting, finished drilled wear-ready form, or explicit operator finished-jewelry facts) establishes a finished wearable piece. Intended pendant/jewelry use, a bare "Pendant" label in jewelry_type, or an unattached chain/cord alone does NOT establish "Finished product (jewelry/watch)". Propose "Loose/unmounted" when explicit facts or clear multi-angle/hero evidence establish an unmounted, undrilled loose stone or cabochon. Missing hardware in a single photo alone is not conclusive; if physical mounting/drilling state is uncertain, omit "material-origin". "Natural/Untreated" does not establish either choice. Do NOT use geographic collecting location.
- "product-classification": Precious-material/item classification, NOT "Pendant" product format. Verified relevant choices include: "Semi-precious stones", "Loose precious stones". Do not infer material grade from photos. Propose only when trusted supplied material facts support the choice; otherwise omit it pending verified classification evidence. "Pendant" alone is insufficient evidence.
- "product-use": Intended or actual use. Relevant verified choice: "Jewelry/ornament". Use when supplied facts or visible form establish finished jewelry, ornament, or intended jewelry-making/pendant use. Keep "product-use" distinct from physical "material-origin" ("Jewelry/ornament" does NOT by itself make an unmounted stone a "Finished product (jewelry/watch)"). Do not output "Finished Jewelry" as though it were an accepted label. Do not default unrelated display/specimen products to "Jewelry/ornament".

HANDCRAFTED & CRAFTSMANSHIP RULES:
- Retain "Handcrafted" for craftsmanship and SEO outputs only when supplied facts identify work by Bob and Janyce.
- "Ground out the miles" describes travel, NOT stone grinding. Never cite that idiom as craftsmanship evidence.
- Never place "Handcrafted" inside standardized "construction" candidates.

Format for each supported key inside "standardized_candidates":
{
  "labels": ["plain evidence-supported candidate"],
  "evidence": "short explanation referencing supplied facts and identifying the specific component where applicable"
}

STRICT RULES FOR standardized_candidates:
- Review candidates ONLY. Do NOT output shopify.* keys or custom.std_* keys.
- Priority: Explicit operator-locked facts > verified stored facts > permitted image observations.
- Preserve existing nonblank standardized assignments: if current standardized data is already supplied for an attribute, omit that key unless an explicit correction requests a replacement.
- Omit any of the six keys that lack clear factual/visual support.
- Never output empty arrays, "None", "Unknown", "N/A", guessed GIDs, taxonomy IDs, or definition IDs.
- Do not infer hidden hardware or undisclosed treatment.
- Preserve existing legacy keys (chain_link_type, jewelry_finding_type, craftsmanship, seo_title, etc.) alongside standardized_candidates.
`;

// ==========================================
// PROMPT 1: DESCRIPTION GENERATION
// ==========================================
export function buildDescriptionPrompt(derivedFamily, originSegment, extractedStory, fullCollectionTitle, pieceData, collectionStory = "") {
  const ooakResolved = resolveCanonicalOoakFromInputs(pieceData);
  const stoneContext = resolveVerifiedStoneIdentityContext(pieceData, derivedFamily);
  const effectiveFamilyForPrompt = stoneContext.effectiveFamily || derivedFamily || "";
  const effectiveVarietyForPrompt = stoneContext.effectiveMaterial || effectiveFamilyForPrompt || "";

  const rawFoundObj = pieceData.found_object ?? pieceData["custom.found_object"];
  const foundPolarity = classifyFoundObjectPolarity(rawFoundObj);
  const provenanceRuleLine =
    foundPolarity === "purchased"
      ? `- Provenance Status: Purchased material (found_object=${String(rawFoundObj)}). This piece was bought/acquired${originSegment ? ` (${originSegment})` : ""}, NOT river-collected or field-collected. Do NOT claim it was pulled from a river or found in the wild, even if Collection Name is "${fullCollectionTitle}". Purchase source does not establish geological origin.`
      : foundPolarity === "wild_found"
        ? `- Provenance Status: Field-collected (found_object=${String(rawFoundObj)}).`
        : `- Provenance Status: Use only explicitly supplied origin/provenance facts; do not invent river/field-collection claims from collection membership alone.`;

  return `You are writing a product description for Rockhound Studio, a lapidary art studio run by Bob and Janyce, married 34 years, both artists, both rockhounds. They cut and polish every stone themselves in Spokane Valley WA.
${getSharedFactualContract()}

DETAILS:
- Stone Family: ${effectiveFamilyForPrompt}
- Stone Variety / Material: ${effectiveVarietyForPrompt}
- Origin / Location: ${originSegment}
${provenanceRuleLine}
- Origin Lore: ${extractedStory}
- Collection Name: ${fullCollectionTitle} (Canonical Name: Use this exact name in prose instead of legacy titles found in the lore text)
- Collection Lore: ${collectionStory}
- Product Format: ${pieceData.product_format || ""}
- Jewelry Type: ${pieceData.jewelry_type || "N/A"}
- Finding/Setting Type: ${pieceData.jewelry_finding_type || "N/A"}
- Setting Ready: ${pieceData.setting_ready || "N/A"}
- Bail Included: ${pieceData.bail_included || "N/A"}
- Wire Material: ${pieceData.wire_material || "N/A"}
- Chain/Cord: ${pieceData.chain_material || "N/A"}
- Secondary Medium (Metal): ${pieceData.secondary_medium || "N/A"}
- Surface Finish: ${pieceData.surface_finish || ""}
- Dimensions: ${pieceData.dimensions_mm || "N/A"}
- Overall Solid Length (in): ${pieceData.overall_solid_length_in || "N/A"}
- Stone Weight: ${pieceData.weight_grams ? pieceData.weight_grams + " g" : "N/A"}
- Shipping Weight: ${pieceData.shipping_weight_oz ? pieceData.shipping_weight_oz + " oz" : "N/A"}
- Geology display: Geological facts are already presented in the product-page geology drawer table. Do not repeat geology in this description.
- Preserve geological data unchanged outside this description; this output does not replace the geology table.
- One-of-a-Kind (is_one_of_a_kind): ${ooakResolved.value || ""}
- Primary Color: ${pieceData.primary_color || ""}
- Secondary Colors: ${pieceData.secondary_colors || ""}
- Color Pattern: ${pieceData.color_pattern || ""}
- Honest Flaws and Character: ${pieceData.honest_flaws_and_character || ""}
- Chain Type: ${pieceData.chain_link_type || ""}
- Human Identifier (Internal only, do not rename): ${pieceData.piece_name || "None"}

STONE IDENTITY & CONSTRUCTION RULES FOR DESCRIPTION (CRITICAL):
- Stone Family and Stone Variety / Material represent the STONE ONLY. Never treat a metal, plating, alloy, wire, or setting term as the stone identity. Preserve the distinction between mineral family (e.g., Agate) and variety (e.g., Botswana Agate) when both are provided.
- Strictly follow the hardware facts in DETAILS above (Finding/Setting Type, Setting Ready, Bail Included, Wire Material, Chain/Cord, Secondary Medium).
- Never invent "bezel", "bezel setting", "bezel-set", "integrated bezel bail", or "glue-on" unless the DETAILS block above explicitly states that construction.
- If Finding/Setting Type or Bail Included specifies a glue-on / glue-in setting, decorative rim, or integrated/top chain loop, describe that exact construction plainly and honestly.
- If Finding/Setting Type or Bail Included specifies a pinch bail (whose pins pass through a drilled hole), describe the pinch bail accurately.
- If Finding/Setting Type, Setting Ready, or Bail Included in DETAILS explicitly specifies a bezel setting, describe that bezel setting accurately.
- If the piece is mounted/wear-ready (e.g., Setting Ready is "Yes"/"true" or Bail Included is "Yes"/"true") but the exact fastening mechanism is not specified in DETAILS, use neutral supported wording (such as "mounted in a metal setting with a top chain loop" or "fitted with a bail") without inventing bezel or glue-on claims or guessing metal fineness/plating.

VOICE RULES (CRITICAL):
- Use Bob's plain, honest voice: short sentences, one idea at a time.
- No poetic geology, personification, or grand claims such as "the earth remembering itself".
- Do not repeat physical details between paragraphs.
- Use "I" for Bob's personal actions and "we" for shared actions.
- Janyce does the final shine on ALL stones. This is an approved shop-wide fact; retain appropriate credit without forcing it into every paragraph.
- Past tense for the find or purchase. "I picked it up." Not "pick it up."
- No sales language, flourish, or invented activity.
- Use only source-supported physical observations.
- Do not transfer another stone's events or details to this piece.
- If Provenance Status indicates purchased material, state the purchase/acquisition honestly without claiming river or wild field collection, and do not treat the purchase venue as geological origin.
- Counts, dates, and trip details require source support.
- If context is insufficient, flag it for review rather than invent.
- Weave physical facts naturally into the physical description. Never output labels or missing-value placeholders.
- Preserve explicitly supplied one-of-a-kind status once as a plain factual spec when provided, without sales language. Never invent rarity or default it from a blank field.
- Signature always: — Bob and Janyce, Rockhound Studio, Spokane Valley WA

DESCRIPTION STRUCTURE — follow this order exactly:

1. PHYSICAL DESCRIPTION
Lead with specific, honest observations. Describe color, natural form, and finish. Do not output labels like "Bench Notes:".

2. ORIGIN HOOK
Select the source episode relevant to the current product from the Origin Lore or supplied provenance facts. Aim for 2-4 short sentences containing the relevant setup and outcome. Tease the story; do not retell the whole page. Never invent a river find when the piece was purchased.

3. COLLECTION HOOK
1-2 short, source-supported sentences connecting this piece to the collection based on the Collection Lore. Use the exact Canonical Name provided above rather than any legacy title found in the lore text. Preserve the referent of counts: stone types, pieces, people, stops, or trips must not be conflated (e.g., "three finds" refers to three stone types, not three pieces of this stone). Do not use collection membership to override purchased provenance.

4. QUICK-REFERENCE SPECS
Use a compact block instead of a paragraph for every pin. Do not print filler such as "Formation: Variable". Avoid repeating facts already stated in the prose. Include verified dimensions, stone weight, finish, and hardware when present.
Stone: [Use Stone Variety / Material or Stone Family from DETAILS — never use metal/setting hardware as the Stone spec]
Dimensions: [dimensions_mm]
Weight: [Stone Weight - do not use Shipping Weight. Omit if N/A]
Finish: [surface_finish]
Setting/Format: [List product_format and any relevant finding/setting/wire_material data from DETAILS. DO NOT write "Loose stone, undrilled" if finding/bail/wire/chain/pendant data is present. Never invent unstated fastening wording.]
Includes: [List bail/chain/cord. If none exist AND it is confirmed loose, state "Loose stone, undrilled".]

5. CHARACTER
Geology: Do not output a geology row or geological properties; these belong in the existing product-page geology table.
Do not repeat hardness, age, era, composition, formation, crystal system, mineral class, specific gravity, luster, cleavage, fracture, tenacity, or diaphaneity in the description.
Character: [Include supported honest_flaws_and_character distinctly; omit missing facts.]

6. ARTIST CALLOUT — only if loose stone or setting ready
One plain sentence for jewelers and makers. Dimensions, drill status, setting suitability.

7. SIGNATURE
— Bob and Janyce, Rockhound Studio, Spokane Valley WA

HARD RULES:
- Do NOT generate any URLs, href links, or Dwell Buttons. The system will append them automatically.
- Do NOT use the words: unique, handmade, artisan, special, curated, stunning, beautiful, gorgeous, perfect, love, passion.
- Do NOT hallucinate stone properties or hardware not provided in the DETAILS block.
- Output a strict JSON object with EXACTLY one key: "generated_description". The value MUST be the HTML string of the description. Use <p> tags for paragraphs. Use <br> for compact block line breaks. No <h> tags. No <ul> or <li>. Do not wrap the JSON in markdown code blocks.

ORIGIN PAGE DATE RULE:
If the provided origin-page story contains an explicit collection date, trip date, month, year, or date range, use it only when it is factually present and relevant to the story. Never invent or infer a date. If no explicit date is present, do not mention one.`;
}

export function buildMasterVisionPrompt({ pagesMenu, collectionsMenu, stoneFamily, derivedShape, originStory, originSegment, targetUrlPath, fullCollectionTitle, collectionUrlPath, pagesList = [], collectionStory = "", operatorFacts = {} }) {
  let dwellButtonsHTML = `<br><br>`;

  let displayOriginName = fullCollectionTitle || originSegment;
  let displayColName = fullCollectionTitle || originSegment;

  if (originSegment === "Yakima River Canyon" || (targetUrlPath && targetUrlPath.includes("chert-road-detour-yakima-river-jasper"))) {
    displayOriginName = "Chert Road Detour";
    displayColName = "Yakima River Canyon";
  }

  if (targetUrlPath && targetUrlPath !== "/pages/") {
    dwellButtonsHTML += `<a href="${targetUrlPath}">${displayOriginName} Story</a>\n`;
  }

  if (collectionUrlPath && collectionUrlPath !== "/collections/") {
    if (targetUrlPath && targetUrlPath !== "/pages/") dwellButtonsHTML += `<br>`;
    let colLabel = displayColName;
    if (!/collection/i.test(colLabel)) colLabel += " Collection";
    dwellButtonsHTML += `<a href="${collectionUrlPath}">${colLabel}</a>`;
  }

  if (originSegment === "Richardson's Rock Ranch" || (targetUrlPath && targetUrlPath.includes("the-richardson-strike"))) {
    dwellButtonsHTML = `<br><br>`;
    if (pagesList.some(p => p.handle === "the-richardson-strike")) {
      dwellButtonsHTML += `<a href="/pages/the-richardson-strike">Richardson's Rock Ranch Story</a>\n`;
    }
    dwellButtonsHTML += `<br><a href="/collections/richardsons-rock-ranch">Richardson's Rock Ranch Collection</a>`;

    if (pagesList.some(p => p.handle === "the-3-000-mile-run")) {
      dwellButtonsHTML += `\n<br><a href="/pages/the-3-000-mile-run">The 3,000-Mile Run Story</a>`;
    }
    dwellButtonsHTML += `\n<br><a href="/collections/the-3-000-mile-run-1">The 3,000-Mile Run Collection</a>`;
  }

  if (dwellButtonsHTML === `<br><br>`) dwellButtonsHTML = "";

  const operatorFactsStr = Object.entries(operatorFacts || {})
    .filter(([k, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `You are a lapidary artist for Rockhound Studio. Analyze this photo and return a JSON object.
${getSharedFactualContract()}

- LIVE STORE DIRECTORY:
  VALID PAGES IN STORE: ${pagesMenu || "No live pages"}
  VALID COLLECTIONS: ${collectionsMenu || "No live collections"}

SUPPLIED HUMAN / BENCH FACTS (Authoritative when nonblank; do not contradict or invent replacements):
${operatorFactsStr || "- No explicit operator overrides supplied."}

TREATMENT & YES/NO / PROVENANCE PRESERVATION RULES:
- Preserve actual supplied Yes/No TEXT metafield values (such as treated and is_one_of_a_kind) as exact "Yes" or "No" strings, never boolean true/false or text "true"/"false".
- Preserve supplied found_object values and polarity exactly as provided. Do not flip purchased material to field-found or vice versa.
- Preserve supplied treatment and hardware phrases verbatim.
- Do not infer treatment from photographs or replace unknown/blank treatment with a guess.

PHYSICAL FORM, HARDWARE & SETTING INFERENCE RULES:
- Separate physical product form (mounted/wear-ready finished jewelry vs. loose/unmounted stone) from intended use.
- Do not treat a loose, unmounted stone as finished jewelry merely because it is teardrop/pendant-shaped, could be set as a pendant, or has an unattached chain/cord nearby.
- Require actual visible mounted/wear-ready evidence (such as an installed pinch bail, mounted setting with top loop, wire wrap, verified bezel setting, or finished drilled wear-ready hole/suspension) or explicit supplied bench facts before classifying a piece as a finished pendant or finished jewelry.
- NEVER infer "Bezel Setting", "Integrated Bezel Bail", "bezel-set", or "glue-on" from a front photo, decorative metal rim, or top chain loop alone. Front photos cannot establish whether a rimmed/backed setting is bezel-set or glue-on, nor can they establish metal alloy fineness or plating.
- When a stone is visibly mounted in a metal rim/backing with a top loop but fastening is not explicitly specified in SUPPLIED HUMAN / BENCH FACTS, use neutral supported values ("Yes" for setting_ready and bail_included, and neutral wording in alt_text / generated_description such as "in a metal setting with a top loop") and omit jewelry_finding_type rather than guessing bezel or glue-on.
- When a pinch bail is visibly gripping a drilled hole in the stone, use "Silver Plated Pinch Bail" (or supplied pinch-bail wording).
- Missing hardware in a single photo alone is not conclusive if supplied bench facts explicitly establish mounted hardware; when evidence is insufficient, preserve uncertainty rather than guessing.

REQUIRED JSON KEYS:
- primary_color
- secondary_colors: Visible secondary or accent colors in the stone (plain text, e.g., "Cream, Rust Red, Charcoal"); omit if monochromatic or if image evidence does not clearly show secondary colors. Never invent colors.
- color_pattern: Select EXACTLY one: Green, Black, Blue flash, Red, White, Multicolor, Gold, Pink, Yellow, Silver, Purple, Striped, Clear, Yellow veins, None
- surface_finish
- overall_solid_length_in: Photo-based measurement in decimal inches (number only, e.g. 1.75) read directly from a measuring tape or ruler deliberately aligned with the product in the photo. Require readable tape/ruler markings, identifiable units, and both solid-product endpoints visible (from the bottom tip of the stone/piece to the top of the solid setting or bail, strictly excluding any flexible necklace chain or cord; necklace chain/cord is a separate confirmed 18 inches). Omit completely if no tape/ruler is visible or if markings, units, or endpoints cannot be read reliably. Never calculate from dimensions_mm alone.
- honest_flaws_and_character
- secondary_medium: Metal/setting hardware medium only when explicitly supplied in bench facts or unambiguously known; do not guess alloy or plating from a photo.
- wire_material: Plain text description of wire material if visibly wire-wrapped or supplied in bench facts; omit if not applicable.
- setting_ready: Exact supplied value ("Yes" / "No" / "true"), or "Yes" if visibly mounted/wear-ready, or "No" if confirmed loose/unmounted. Never infer "Bezel Setting - Ready to Wear" from a photo unless explicitly supplied in bench facts.
- bail_included: Exact supplied value ("Yes" / "No" / "true"), "Silver Plated Pinch Bail" if visibly a pinch bail, or "Yes" if a top loop/bail is visibly present. Never output "Integrated Bezel Bail" unless explicitly supplied in bench facts.
- chain_material: Identify the visible chain or cord. INVENTORY OPTIONS: "Cord", "Silver Plated Snake Chain", "Gold Plated Snake Chain". Distinguish clearly absent hardware from hardware out of view.
- chain_link_type: Cord or Snake Chain (when applicable). Never turn Cord into Snake Chain.
- jewelry_finding_type: INVENTORY OPTIONS: "Silver Plated Pinch Bail", "Glue-On Bail", "Assorted Glue-In Setting". Preserve explicitly supplied construction descriptions verbatim. Do NOT guess "Bezel Setting", "Integrated Bezel Bail", or "Glue-On Bail" from a front photo alone; omit if fastening method is not visually certain (e.g., pinch bail) or explicitly supplied.
- jewelry_type: Select EXACTLY one: Pendant, Necklace, Artisan jewelry, Fine jewelry, Accessories, N/A. Select "N/A" when the piece is an unmounted loose stone, cabochon, display piece, or specimen without mounted/wear-ready evidence or explicit finished-jewelry bench facts.
- google_product_category: "Apparel & Accessories > Jewelry"
- origin_location: Cross-reference "${originSegment}" with LIVE STORE DIRECTORY and supplied bench facts. Return geographic name ONLY. Do not invent an origin if unknown, and never override an explicit purchased source with a title or collection name. Purchase source does not establish geological origin.
- primary_medium: Must be the STONE/MINERAL identity or variety ONLY (never the bare word "Stone", and NEVER metal, plating, wire, alloy, or setting hardware). Keep stone family (e.g. Agate) and variety (e.g. Botswana Agate) distinct when applicable; omit if stone identity is unknown.
- alt_text: Descriptive for THIS single photo only, max 125 chars. Describe visible stone, decorative rim, or top loop/pinch bail truthfully; never claim "bezel" or "glue-on" unless explicitly supplied in bench facts.
- found_object: Preserve supplied value/polarity if provided; otherwise omit if unknown (never guess from appearance or collection).
- seo_title: Max 70 chars. Customer-facing title/pitch based on Vision, origin-page content, and supplied human facts. Never use or overwrite the internal human piece_name ID. Never write "Found at..." or river-collected claims when found_object or bench facts indicate purchased material. Include "Handcrafted" only when supported by supplied facts identifying work by Bob and Janyce ("Ground out the miles" describes travel, not stone grinding; never cite it as craftsmanship evidence).
- poetic_hook: Optional short, plain customer-facing hook (under 160 chars) grounded in the photo, origin page, and human facts. Never claim river/field collection for purchased material. Never replace the internal piece_name ID.
- standardized_candidates: Object containing supported review candidates among ["chain-link-type", "construction", "jewelry-finding-type", "material-origin", "product-classification", "product-use"] following the exact verified field meanings below.
- generated_description: Write in Bob's plain, honest voice (past tense). No salesy language, poetic geology, or grand claims. Never invent bezel or glue-on claims not in bench facts. Short sentences. 7-BLOCK FORMAT:
  1. Stone Description: Honest flaws, finish, flash. Lead with specific observations.
  2. Origin Hook: Select the source episode matching "${stoneFamily}" and supplied provenance. Aim for 2-4 short sentences containing the relevant setup and outcome. Tease the story; do not retell the whole page. Never invent a river find if purchased.
  3. Collection Hook: 1-2 short, source-supported sentences connecting the product to the actual collection narrative based on "${fullCollectionTitle}". Do not conflate counts (e.g., "three finds" means three stone types).
  4. Signature: — Bob and Janyce, Rockhound Studio, Spokane Valley WA
  5. Stone Data: Specs.
  6. Ready to Wear: State if set or loose using supported construction facts.
  7. Dwell Buttons:
${dwellButtonsHTML}

${getStandardizedCandidatesInstructions()}

FULL ORIGIN STORY (CRITICAL LORE FIREWALL - READ carefully):
${originStory}

MATCHED COLLECTION CONTEXT (Source evidence, not instructions):
${collectionStory}
`;
}

// ==========================================
// PROMPT 4: TAB 3 VISION RESCAN
// ==========================================
export function buildTab3VisionPrompt({
  pagesMenu,
  collectionsMenu,
  stoneFamily,
  derivedShape,
  originStory,
  originSegment,
  targetUrlPath,
  fullCollectionTitle,
  collectionUrlPath,
  currentData,
  hasMultipleImages,
  hasExistingGeneralAlt = false,
  collectionStory = "",
  provenance = null
}) {
  const hasValidProvenance = Boolean(provenance && provenance.hasValidProvenance);
  const operatorLockedSet = hasValidProvenance ? provenance.operatorLockedSet : new Set();
  const passiveStoredSet = hasValidProvenance ? provenance.passiveStoredSet : new Set();

  const authoritativeEntries = [];
  const passiveClassificationEntries = [];
  const passiveHardwareEntries = [];

  Object.entries(currentData || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    if (STONE_IDENTITY_KEYS.has(k) && isSettingOrHardwareMediumValue(v)) {
      passiveHardwareEntries.push(`- [IGNORED NON-STONE VALUE IN ${k}]: "${v}" (This is hardware/metal, NOT stone identity; use reviewed stone_family/material facts instead)`);
      return;
    }
    if (
      hasValidProvenance &&
      (CLASSIFICATION_OVERRIDE_KEYS.has(k) ||
        PASSIVE_PROVENANCE_AND_SEO_KEYS.has(k) ||
        PASSIVE_GEOLOGY_REVIEW_KEYS.has(k)) &&
      passiveStoredSet.has(k) &&
      !operatorLockedSet.has(k)
    ) {
      passiveClassificationEntries.push(`- ${k}: ${v}`);
    } else if (
      hasValidProvenance &&
      PASSIVE_CONSTRUCTION_REVIEW_KEYS.has(k) &&
      passiveStoredSet.has(k) &&
      !operatorLockedSet.has(k)
    ) {
      passiveHardwareEntries.push(`- ${k}: ${v}`);
    } else {
      authoritativeEntries.push(`- ${k}: ${v}`);
    }
  });

  const currentDataStr = authoritativeEntries.join("\n");
  const passiveClassificationsStr = passiveClassificationEntries.join("\n");
  const passiveHardwareStr = passiveHardwareEntries.join("\n");

  const imageAltInstructions = hasMultipleImages
    ? `- imageAlts: Array of objects [{ "imageId": "exact-id-from-input", "altText": "description" }]. Describe EACH supplied image individually. Use only visible, truthful detail and operator-locked construction and stone facts from CURRENT KNOWN DATA. Max 125 chars per alt text. Use verified mineral/stone name (never substitute setting metal as stone name). Never infer "bezel", "bezel setting", "bezel-set", or "glue-on" from a photo alone unless supported by CURRENT KNOWN DATA; if a metal rim or top loop is visible without confirmed fastening in CURRENT KNOWN DATA, describe it neutrally (e.g. "in a metal setting with top loop" or "with decorative metal rim"). Preserve pinch-bail descriptions when a pinch bail is visible. Do not reuse generic captions across images. You MUST copy the exact imageId from the input. Reject unknown or duplicate IDs.${
        hasExistingGeneralAlt
          ? `\n- alt_text: Product-level general alt text (max 125 chars) for this product's existing general alt compatibility field. Summarize the overall piece using the verified mineral/stone name and reviewed construction facts from CURRENT KNOWN DATA. Keep it distinct as a product-level summary; do not copy a single photo's angle caption.`
          : ""
      }`
    : `- alt_text: Descriptive alt text for the single supplied image (max 125 chars). Use verified mineral/stone name and operator-locked construction facts from CURRENT KNOWN DATA. Never guess "bezel" or "glue-on" from a front photo; use neutral wording ("metal setting", "decorative metal rim", "top loop") when fastening is not confirmed in CURRENT KNOWN DATA.`;

  return `You are a lapidary artist for Rockhound Studio. Analyze the provided photo(s) and return a JSON object.
${getSharedFactualContract()}

- LIVE STORE DIRECTORY:
  VALID PAGES IN STORE: ${pagesMenu || "No live pages"}
  VALID COLLECTIONS: ${collectionsMenu || "No live collections"}

CURRENT KNOWN DATA (Operator-locked and verified facts — preserve these exactly; these govern all generated fields and alt text):
${currentDataStr || "- No explicit operator-locked data provided."}

PASSIVE STORED HARDWARE / SETTING CONTEXT (Stored product context; NOT operator-locked — if an explicit operator-locked value in CURRENT KNOWN DATA contradicts a passive stored value, CURRENT KNOWN DATA takes priority; never treat hardware/metal in primary_medium as stone identity):
${passiveHardwareStr || "- None."}

PASSIVE STORED CLASSIFICATIONS & PRIOR DRAFTS (Fallback only; not operator-locked — re-evaluate against physical/visual evidence and authoritative human provenance/hardware facts; if fresh evidence or locked human provenance contradicts a stale carried value, propose the corrected value; if fresh evidence is insufficient, omit or retain as fallback):
${passiveClassificationsStr || "- None."}

CRITICAL RULES FOR TAB 3:
1. Explicit operator-locked corrections in CURRENT KNOWN DATA take strict priority over passive stored hardware/classifications, image inference, product titles, and collection names.
2. Preserve nonblank CURRENT KNOWN DATA values and operator-locked finding details verbatim. When setting_ready, bail_included, jewelry_finding_type, secondary_medium, or alt_text are in CURRENT KNOWN DATA, your proposed fields, alt_text, and imageAlts MUST align with those reviewed construction facts and never contradict them. For PASSIVE STORED CLASSIFICATIONS & PRIOR DRAFTS, re-evaluate against the photos and authoritative human facts so stale carried "Pendant" labels do not force a loose stone into finished jewelry and stale AI river-origin/SEO drafts do not contradict human-confirmed purchase provenance.
3. Never infer "Bezel Setting", "Integrated Bezel Bail", "bezel-set", or "glue-on" from a decorative rim, backing frame, front photo, or top chain loop alone. Do not infer metal alloy fineness or plating from photos.
4. STONE IDENTITY VS. SETTING MATERIAL: primary_medium, material, and stone_family must NEVER contain metal, plating, alloy, wire, or setting hardware (such as "Silver Plated", "Sterling Silver", "Silver Alloy", "Copper Wire", or "Pinch Bail"). Keep mineral family (stone_family, e.g., "Agate") and stone variety (material / primary_medium, e.g., "Botswana Agate") distinct when evidenced; do not force them to be identical. If stone identity is uncertain, omit primary_medium rather than guessing.
5. Preserve pinch-bail construction ("Silver Plated Pinch Bail", whose pins pass through a drilled hole) when visibly present or stated in facts.
6. Never change setting_ready to "No" merely because fastening wording is unconfirmed; if a piece is visibly mounted/wear-ready with a setting or bail, setting_ready remains "Yes" (or its exact supplied value).
7. Never generate, rename, or propose a shopify_title, piece_name, or price during repair/rescan.
8. Do not infer jewelry, chain material, cord, bail, wire wrapping, or readiness from an image when the source data and visible evidence don't establish it. Missing hardware in a single photo alone is not conclusive; leave uncertain values unresolved.
9. Treat origin_story as hidden, read-only context from the existing origin page. Do not generate or save an origin story. Use the page only for supported metadata.
10. Never write "None" or "Unknown" as filler.
11. Do not invent details or lived history. Leave unknown fields entirely unset.
12. Distinguish physical finished form from intended pendant/jewelry use: set product_format to "Pendant" (or similar finished wearable form) ONLY when authoritative hardware/mounting facts (such as an installed bail, mounted setting with loop, wire wrap, verified bezel setting, or finished drilled wear-ready form) or clear visible mounted hardware establish a finished piece. A bare passive "Pendant" label in jewelry_type, or an unattached chain/cord alone, does NOT establish finished jewelry or force product_format to "Pendant".
13. Preserve actual supplied Yes/No TEXT metafield values (such as treated and is_one_of_a_kind) as exact "Yes" or "No" strings, never boolean true/false or text "true"/"false". Preserve supplied found_object values and polarity verbatim. Preserve supplied treatment and operator-locked hardware phrases verbatim. Do not infer treatment from photographs or replace unknown/blank treatment with a guess.
14. PURCHASE VS. FIELD COLLECTION PROVENANCE: When CURRENT KNOWN DATA indicates purchased material (e.g., found_object is false/"No"/"No — purchased rough" or an explicit operator-locked purchase source is provided), NEVER write "Found at..." or river/field-collection claims in seo_title or poetic_hook, and NEVER override the purchase source with a river or collection name. Purchase location does not establish geological origin.
15. PHOTO-BASED SOLID LENGTH MEASUREMENT (overall_solid_length_in): Read the measuring tape or ruler markings, identifiable units, and both solid-product endpoints from the photo where the product is deliberately aligned with the tape/ruler. Return decimal inches (including setting/bail, excluding any flexible necklace chain/cord; necklace chain/cord is a separate confirmed 18 inches). Preserve any existing nonblank overall_solid_length_in in CURRENT KNOWN DATA. If the markings, units, or solid endpoints are not clearly readable in the photo(s), omit overall_solid_length_in completely (never guess or derive from dimensions_mm text).

Return ONLY a JSON object. OMIT any keys if you cannot determine the value supported by evidence. DO NOT include "piece_name", "origin_story", "price", "shopify_title", "weight_grams", "shipping_weight_oz", "generated_description", "rarity", or "authenticity".

Potential JSON Keys to evaluate and propose if blank (or when correcting a PASSIVE STORED CLASSIFICATION/PROVENANCE entry or updating PASSIVE STORED HARDWARE when supported by operator-locked facts or clear evidence):
- is_one_of_a_kind: Propose "Yes" only when supported by existing product facts; do not overwrite an explicit operator value.
- product_format: Describe the evidenced physical form (e.g., Cabochon, Pendant, Specimen, Loose Stone).
- craftsmanship: Propose exactly "Handcrafted" only when supplied product facts identify the work as handcrafted by Bob & Janyce. ("Ground out the miles" describes travel, not stone grinding; never cite that idiom as craftsmanship evidence. Do not place "Handcrafted" in standardized construction candidates.)
- poetic_hook: Write one short, plain, factual hook based on the supported provenance/origin context and physical piece (under 160 characters). Never claim river/field collection when the material was purchased.
- seo_title: Max 70 chars. Natural, descriptive wording based on supported facts. Never claim "Found at..." or river collection when purchased. Include "Handcrafted" only when supported by supplied facts identifying work by Bob and Janyce.
- dimensions_mm: Leave unchanged if provided.
- overall_solid_length_in: Photo-based measurement in decimal inches read from the visible measuring tape/ruler markings, identifiable units, and both solid-product endpoints (including setting/bail, excluding flexible 18-inch chain/cord). Leave unchanged if already provided in CURRENT KNOWN DATA; omit if tape markings, units, or endpoints cannot be read reliably.
- cut_and_shape: Detailed lapidary cut and shape description (e.g., "Freeform Cabochon", "Domed Oval Cabochon") distinct from broader stone_shape; omit if uncertain.
- stone_shape: Broader stone shape classification (e.g., "Freeform", "Oval", "Teardrop", "Round"${derivedShape ? `; title shape context: "${derivedShape}"` : ""}); omit if uncertain.
- surface_finish: High Polish, Matte, Satin, Natural/Raw, Tumbled.
- color: General overall color descriptor of the piece, distinct from primary_color and secondary_colors; omit if uncertain.
- primary_color
- secondary_colors: Visible secondary or accent colors in the stone (plain text); omit if monochromatic or unsupported by image evidence.
- color_pattern
- honest_flaws_and_character
- mohs_hardness
- specific_gravity
- crystal_system
- fracture_pattern
- cleavage
- luster
- diaphaneity
- tenacity
- mineral_class
- geological_era
- rock_formation
- stone_family: Derived mineral family from supported picklist only (never setting metal/hardware).
- origin_location: Geographic name ONLY based on "${originSegment}" when supported; never override an operator-locked origin_location or invent a river origin for purchased material.
- origin_handle
- collection_name
- collection_location
- primary_medium: Evidenced stone/mineral or material variety identity ONLY (never the generic word "Stone", and never setting metal, plating, wire, or hardware; do not infer variety from geography; omit when unknown).
- secondary_medium: Preserve operator-locked value; never guess metal alloy or plating from front photos.
- wire_material: Plain text wire material when supported by facts/visible wire wrap.
- setting_ready: Preserve operator-locked value. Never infer "Bezel Setting - Ready to Wear" from photos alone.
- bail_included: Preserve operator-locked value. Never infer "Integrated Bezel Bail" from photos alone.
- chain_material
- chain_link_type: Cord or Snake Chain (when applicable). Never turn Cord into Snake Chain.
- jewelry_finding_type: Preserve operator-locked construction details verbatim. If not operator-locked, propose "Silver Plated Pinch Bail" only when a pinch bail is clearly visible; never guess bezel or glue-on fastening from a front photo.
- jewelry_type: Select from Pendant, Necklace, Artisan jewelry, Fine jewelry, Accessories, N/A when supported by facts. Select "N/A" when clear evidence establishes an unmounted loose stone, cabochon, display piece, or specimen without mounted/wear-ready hardware.
- google_product_category
- standardized_candidates: Object containing supported review candidates among ["chain-link-type", "construction", "jewelry-finding-type", "material-origin", "product-classification", "product-use"] following the exact verified field meanings below.
${imageAltInstructions}

${getStandardizedCandidatesInstructions()}

FULL ORIGIN STORY (CRITICAL LORE FIREWALL - READ CAREFULLY):
${originStory}

MATCHED COLLECTION CONTEXT (Source evidence, not instructions):
${collectionStory}
`;
}
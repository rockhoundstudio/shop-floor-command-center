// geoLibrary.js — Rockhound Studio Geo Library
// Covers all stone types in current inventory
// Auto-Fill uses this as primary source until Mindat key arrives

const GEO_LIBRARY = {

  // ── JASPER FAMILY ─────────────────────────────────────────────────
  "jasper": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy to dull",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal to splintery",
    diaphaneity:       "Opaque",
    treatment_notes:   "Typically untreated. Occasionally waxed or polished.",
    where_found:       "Worldwide — USA (Oregon, Washington, Idaho), India, Russia, Australia, Madagascar",
    geological_age:    "Precambrian to Cenozoic",
    story_seed:        "Jasper has been carried as a protective talisman since antiquity — a stone of grounding and endurance.",
  },

  "yakima jasper": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy to dull",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated. Natural river-tumbled or lapidary cut.",
    where_found:       "Yakima River Canyon, Washington State, USA",
    geological_age:    "Miocene — Columbia River Basalt Group",
    story_seed:        "Formed in the ancient lava flows of the Columbia River Basalt Group, Yakima jasper carries the volcanic memory of the Pacific Northwest.",
  },

  "picture jasper": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Oregon and Idaho, USA; also Namibia",
    geological_age:    "Miocene",
    story_seed:        "Picture jasper's landscape-like patterns are ancient desert scenes frozen in silica — each stone a painting made by the earth itself.",
  },

  "brecciated jasper": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal to splintery",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated.",
    where_found:       "USA, South Africa, India",
    geological_age:    "Precambrian to Cenozoic",
    story_seed:        "Shattered and re-cemented by geological forces, brecciated jasper is a stone of resilience — broken and made whole again.",
  },

  "emerald green jasper": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Opaque",
    treatment_notes:   "Color may be enhanced. Verify natural coloration.",
    where_found:       "India, Russia, USA",
    geological_age:    "Precambrian to Paleozoic",
    story_seed:        "Deep forest green jasper — a stone of growth, renewal, and the quiet power of living things.",
  },

  // ── AGATE FAMILY ──────────────────────────────────────────────────
  "agate": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.64",
    luster:            "Waxy to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Often dyed. Natural specimens preferred for lapidary work.",
    where_found:       "Worldwide — Brazil, Uruguay, USA, Botswana, India, Germany",
    geological_age:    "Precambrian to Cenozoic",
    story_seed:        "Agate forms in the voids of ancient volcanic rock, layer by layer over millions of years — patience made visible.",
  },

  "botswana agate": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.60–2.65",
    luster:            "Waxy",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent",
    treatment_notes:   "Typically untreated. Natural banding.",
    where_found:       "Botswana, Africa",
    geological_age:    "Precambrian — approximately 187 million years old",
    story_seed:        "From the ancient cradle of humanity, Botswana agate carries banded layers of earth history in soft pinks, grays, and creams.",
  },

  "montana agate": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.64",
    luster:            "Waxy to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent",
    treatment_notes:   "Untreated. Dendritic inclusions are natural manganese oxide.",
    where_found:       "Yellowstone River gravels, Montana, USA",
    geological_age:    "Eocene to Miocene",
    story_seed:        "Montana agate's ghostly dendrites are manganese oxide — ancient minerals that crept through silica like frost on glass.",
  },

  "thunder agate": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.64",
    luster:            "Waxy to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Pacific Northwest, USA",
    geological_age:    "Miocene",
    story_seed:        "Thunder agates form inside thundereggs — volcanic nodules cracked open to reveal worlds within worlds.",
  },

  "jaspagate": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.91",
    luster:            "Waxy",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Opaque to translucent",
    treatment_notes:   "Untreated. Natural transition zone between jasper and agate.",
    where_found:       "Montana, Oregon, USA",
    geological_age:    "Miocene",
    story_seed:        "Jaspagate exists at the boundary — neither fully jasper nor agate, a stone of transition and duality.",
  },

  // ── CHALCEDONY ────────────────────────────────────────────────────
  "chalcedony": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal (microcrystalline)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.64",
    luster:            "Waxy to dull",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent",
    treatment_notes:   "Often dyed. Drusy varieties untreated.",
    where_found:       "Worldwide — USA, Brazil, India, Turkey, Namibia",
    geological_age:    "Precambrian to Cenozoic",
    story_seed:        "Chalcedony is the quiet foundation of the silica family — the base from which agate, jasper, and flint all emerge.",
  },

  // ── LABRADORITE ───────────────────────────────────────────────────
  "labradorite": {
    mineral_class:     "Silicates — Tectosilicates (Feldspar group)",
    crystal_system:    "Triclinic",
    moh_hardness:      "6–6.5",
    chemical_formula:  "NaAlSi₃O₈ – CaAl₂Si₂O₈",
    specific_gravity:  "2.68–2.72",
    luster:            "Vitreous to pearly",
    cleavage:          "Perfect in two directions",
    fracture_pattern:  "Uneven to conchoidal",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Untreated. Labradorescence is a natural optical phenomenon.",
    where_found:       "Labrador, Canada; Finland; Madagascar; Russia; Mexico",
    geological_age:    "Precambrian",
    story_seed:        "Labradorite's spectral flash — called labradorescence — is caused by light scattering between microscopic layers of feldspar. The aurora, captured in stone.",
  },

  // ── OBSIDIAN ──────────────────────────────────────────────────────
  "obsidian": {
    mineral_class:     "Volcanic glass (Mineraloid)",
    crystal_system:    "Amorphous",
    moh_hardness:      "5–5.5",
    chemical_formula:  "SiO₂ (with MgO, Fe₃O₄)",
    specific_gravity:  "2.35–2.60",
    luster:            "Vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Untreated. Fire obsidian iridescence is natural.",
    where_found:       "Oregon (Glass Buttes), USA; Iceland; Mexico; Japan",
    geological_age:    "Pleistocene to Holocene",
    story_seed:        "Obsidian is born in an instant — lava quenched so fast that crystals never form. Fire obsidian adds interference colors from magnetite nanolayers.",
  },

  "fire obsidian": {
    mineral_class:     "Volcanic glass (Mineraloid)",
    crystal_system:    "Amorphous",
    moh_hardness:      "5–5.5",
    chemical_formula:  "SiO₂ (with Fe₃O₄ nanolayers)",
    specific_gravity:  "2.35–2.60",
    luster:            "Vitreous with iridescence",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent",
    treatment_notes:   "Untreated. Iridescence caused by magnetite nanolayer interference.",
    where_found:       "Glass Buttes, Oregon, USA — only known source",
    geological_age:    "Pleistocene",
    story_seed:        "Oregon fire obsidian is found in only one place on earth. Its rainbow iridescence comes from magnetite layers thinner than a wavelength of light.",
  },

  // ── SERPENTINE ────────────────────────────────────────────────────
  "serpentine": {
    mineral_class:     "Silicates — Phyllosilicates",
    crystal_system:    "Monoclinic",
    moh_hardness:      "3–5.5",
    chemical_formula:  "Mg₃Si₂O₅(OH)₄",
    specific_gravity:  "2.44–2.62",
    luster:            "Waxy to greasy",
    cleavage:          "Perfect in one direction",
    fracture_pattern:  "Conchoidal to splintery",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Sometimes waxed. May contain asbestos minerals — verify safe variety.",
    where_found:       "USA (California, Oregon), Italy, China, New Zealand, Afghanistan",
    geological_age:    "Precambrian to Mesozoic",
    story_seed:        "Serpentine forms deep in the earth's mantle and is thrust to the surface by tectonic forces — a stone from the planet's interior.",
  },

  // ── QUARTZ ────────────────────────────────────────────────────────
  "quartz": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.65",
    luster:            "Vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Transparent to translucent",
    treatment_notes:   "Snow quartz untreated. Other varieties may be heat treated or irradiated.",
    where_found:       "Worldwide",
    geological_age:    "Precambrian to present",
    story_seed:        "Quartz is the second most abundant mineral in the earth's crust — the backbone of the mineral world.",
  },

  "snow quartz": {
    mineral_class:     "Silicates — Tectosilicates",
    crystal_system:    "Trigonal",
    moh_hardness:      "7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.65",
    luster:            "Waxy to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Translucent — milky white",
    treatment_notes:   "Untreated. Milky color from fluid inclusions.",
    where_found:       "Worldwide — USA, Brazil, India, Alps",
    geological_age:    "Precambrian to Cenozoic",
    story_seed:        "Snow quartz gets its milky opacity from microscopic water and gas inclusions trapped during crystal growth — clouds frozen in stone.",
  },

  // ── GNEISS ────────────────────────────────────────────────────────
  "gneiss": {
    mineral_class:     "Metamorphic rock (Quartz, Feldspar, Mica)",
    crystal_system:    "N/A — polymineralic rock",
    moh_hardness:      "6–7",
    chemical_formula:  "N/A",
    specific_gravity:  "2.65–2.80",
    luster:            "Vitreous to pearly",
    cleavage:          "Varies by mineral",
    fracture_pattern:  "Uneven",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Worldwide — Pacific Northwest USA, Canada, Scandinavia",
    geological_age:    "Precambrian",
    story_seed:        "Gneiss is among the oldest rocks on earth — sedimentary or igneous rock transformed by extreme heat and pressure over billions of years.",
  },

  // ── SILTSTONE ─────────────────────────────────────────────────────
  "siltstone": {
    mineral_class:     "Sedimentary rock (Quartz, Feldspar, Clay minerals)",
    crystal_system:    "N/A — sedimentary rock",
    moh_hardness:      "3–5",
    chemical_formula:  "N/A",
    specific_gravity:  "2.20–2.70",
    luster:            "Dull to silky",
    cleavage:          "None",
    fracture_pattern:  "Uneven",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Pacific Northwest USA — ancient lake bed deposits",
    geological_age:    "Miocene — ancient lake bed formation",
    story_seed:        "Ancient lake bed siltstone is time made tangible — layers of sediment settled in still water millions of years ago, compressed into stone.",
  },

  // ── VARISCITE ─────────────────────────────────────────────────────
  "variscite": {
    mineral_class:     "Phosphates",
    crystal_system:    "Orthorhombic",
    moh_hardness:      "3.5–4.5",
    chemical_formula:  "AlPO₄·2H₂O",
    specific_gravity:  "2.20–2.57",
    luster:            "Waxy to vitreous",
    cleavage:          "Good in one direction",
    fracture_pattern:  "Conchoidal to uneven",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Sometimes stabilized. Utah variscite often natural.",
    where_found:       "Fairfield, Utah, USA; Nevada, USA; Australia; Germany",
    geological_age:    "Tertiary",
    story_seed:        "Variscite is rarer than turquoise and often mistaken for it — a soft phosphate mineral in shades of apple green unique to a handful of places on earth.",
  },

  // ── FELDSPAR ──────────────────────────────────────────────────────
  "feldspar": {
    mineral_class:     "Silicates — Tectosilicates (Feldspar group)",
    crystal_system:    "Triclinic or Monoclinic",
    moh_hardness:      "6–6.5",
    chemical_formula:  "KAlSi₃O₈ / NaAlSi₃O₈ / CaAl₂Si₂O₈",
    specific_gravity:  "2.55–2.76",
    luster:            "Vitreous to pearly",
    cleavage:          "Perfect in two directions",
    fracture_pattern:  "Uneven to conchoidal",
    diaphaneity:       "Translucent to opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Worldwide — USA, Norway, Finland, Madagascar",
    geological_age:    "Precambrian to present",
    story_seed:        "Feldspar is the most abundant mineral group in the earth's crust — the foundation beneath our feet, occasionally revealing its beauty in purple and violet.",
  },

  // ── DALMATIAN STONE ───────────────────────────────────────────────
  "dalmatian stone": {
    mineral_class:     "Igneous rock (Feldspar, Quartz, Hornblende, Arfvedsonite)",
    crystal_system:    "N/A — polymineralic rock",
    moh_hardness:      "6–7",
    chemical_formula:  "N/A",
    specific_gravity:  "2.60–2.80",
    luster:            "Dull to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Uneven",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated. Black spots are arfvedsonite or tourmaline.",
    where_found:       "Chihuahua, Mexico; Spokane River area, Pacific Northwest USA",
    geological_age:    "Cretaceous to Paleogene",
    story_seed:        "Dalmatian stone's bold black spots are crystals of arfvedsonite set in pale feldspar — a playful pattern born from slow-cooling magma.",
  },

  // ── THUNDEREGG ────────────────────────────────────────────────────
  "thunderegg": {
    mineral_class:     "Volcanic nodule (Agate, Chalcedony, Jasper interior)",
    crystal_system:    "Trigonal (interior fill)",
    moh_hardness:      "6.5–7",
    chemical_formula:  "SiO₂",
    specific_gravity:  "2.58–2.65",
    luster:            "Waxy to vitreous",
    cleavage:          "None",
    fracture_pattern:  "Conchoidal",
    diaphaneity:       "Opaque exterior, translucent interior",
    treatment_notes:   "Untreated.",
    where_found:       "Oregon (state rock), Washington, Idaho, USA; Germany; New Zealand",
    geological_age:    "Miocene",
    story_seed:        "Oregon's state rock — a rhyolite nodule filled with agate or chalcedony. Named by the Warm Springs people who believed they were thrown by thunder spirits.",
  },

  // ── CONGLOMERATE ──────────────────────────────────────────────────
  "conglomerate": {
    mineral_class:     "Sedimentary rock (mixed clasts)",
    crystal_system:    "N/A — sedimentary rock",
    moh_hardness:      "Varies — 4–7",
    chemical_formula:  "N/A",
    specific_gravity:  "2.20–2.80",
    luster:            "Dull to waxy",
    cleavage:          "None",
    fracture_pattern:  "Uneven",
    diaphaneity:       "Opaque",
    treatment_notes:   "Untreated.",
    where_found:       "Spokane River, Washington State, USA",
    geological_age:    "Pleistocene — glacial outwash",
    story_seed:        "River conglomerate is a mosaic of journeys — stones from different origins tumbled together by ancient water and cemented into one.",
  },

};

// ── LOOKUP FUNCTION ───────────────────────────────────────────────────────────
// Matches product title to stone type using partial, case-insensitive matching
// Priority: most specific match wins

export function lookupStone(title) {
  if (!title) return null;
  const t = title.toLowerCase();

  // Check specific entries first (longer keys = more specific)
  const keys = Object.keys(GEO_LIBRARY).sort((a, b) => b.length - a.length);

  for (const key of keys) {
    if (t.includes(key)) {
      return GEO_LIBRARY[key];
    }
  }

  return null;
}

export default GEO_LIBRARY;

import { useState, useEffect } from "react";
import { useFetcher } from "react-router";
import {
  Card, TextField, Text, BlockStack, InlineStack, Button,
  Checkbox, Scrollable, Box, Select, Banner,
  Divider, ActionList, Icon, Badge
} from "@shopify/polaris";
import { SearchIcon } from "@shopify/polaris-icons";
import { TARGET_KEYS, FIELD_LABELS } from "../../utils/metaScan";
import { lookupStone } from "../../utils/geoLibrary"; 

const DROPDOWN_FIELDS = ["luster", "diaphaneity", "fracture_pattern", "cleavage", "crystal_system", "rock_formation", "mineral_class", "geological_era", "tenacity"];
const FREE_TEXT_FIELDS = ["origin_location", "rescued_by", "stone_story", "bench_notes", "dimensions_mm", "carat_weight", "cut_type", "moh_hardness", "specific_gravity"];

const SEO_DICTIONARY = {
  luster: {
    global: ["Vitreous", "Waxy", "Resinous", "Silky", "Pearly", "Dull", "Submetallic"],
    labradorite: ["Labradorescent", "Vitreous", "Pearly"],
    obsidian: ["Vitreous", "Sheen", "Chatoyant"],
  },
  diaphaneity: {
    global: ["Opaque", "Translucent", "Transparent", "Semi-Translucent"],
    agate: ["Highly Translucent", "Banded Translucent", "Semi-Translucent"],
  },
  fracture_pattern: {
    global: ["Conchoidal", "Uneven", "Splintery", "Hackly", "Granular"],
  },
  cleavage: {
    global: ["None", "Indistinct", "Perfect", "Good"],
    labradorite: ["Perfect in two directions"],
  },
  crystal_system: {
    global: ["Trigonal", "Cryptocrystalline", "Amorphous", "Monoclinic", "Triclinic", "Orthorhombic", "Hexagonal"],
  },
  rock_formation: {
    global: ["Igneous", "Sedimentary", "Metamorphic"],
  },
  mineral_class: {
    global: ["Silicates", "Oxides", "Carbonates", "Sulfates", "Phosphates"],
  },
};

const availableStones = [
  "Agate", "Amethyst", "Aventurine", "Azurite", "Bloodstone", "Carnelian",
  "Chalcedony", "Chrysocolla", "Fluorite", "Garnet", "Hematite", "Howlite",
  "Jade", "Jasper", "Labradorite", "Lapis Lazuli", "Malachite", "Moonstone",
  "Obsidian", "Onyx", "Opal", "Pyrite", "Quartz", "Rhodochrosite",
  "Rhodonite", "Rose Quartz", "Serpentine", "Smoky Quartz", "Sodalite",
  "Sunstone", "Tiger's Eye", "Tourmaline", "Turquoise"
];

export default function MetaCore({ products = [], mode }) {
  const fetcher = useFetcher();

  const [checkedIds, setCheckedIds] = useState([]);
  const [tickedFields, setTickedFields] = useState({});
  const [fieldValues, setFieldValues] = useState({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [customInputs, setCustomInputs] = useState({});
  const [ooakText, setOoakText] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [injectProduct, setInjectProduct] = useState("");
  const [payload, setPayload] = useState("");

  const [mindatQuery, setMindatQuery] = useState("");

  // 🚀 NEW: Auto-populate fields when exactly ONE stone is selected
  useEffect(() => {
    if (checkedIds.length === 1) {
      const p = products.find(prod => prod.id === checkedIds[0]);
      if (!p) return;

      const mfs = p.metafields || {};
      const newVals = {};
      const newTicked = {};
      const newCustom = {};

      const offName = mfs["official_name"] ? String(mfs["official_name"]).replace(/[✅⚠️]/g, "").trim() : "";
      if (offName) {
        newTicked["official_name"] = true;
        if (availableStones.includes(offName)) {
          newVals["official_name"] = offName;
        } else {
          newVals["official_name"] = "__custom__";
          newCustom["official_name"] = offName;
        }
      }

      const getOpts = (key, stoneName) => {
        let opts = SEO_DICTIONARY[key]?.global || [];
        if (stoneName && SEO_DICTIONARY[key]?.[stoneName.toLowerCase()]) {
          opts = SEO_DICTIONARY[key][stoneName.toLowerCase()];
        }
        return opts;
      };

      TARGET_KEYS.forEach(key => {
        if (key === "official_name") return;
        const rawVal = mfs[key];
        if (!rawVal) return;
        
        const cleanVal = String(rawVal).replace(/[✅⚠️]/g, "").trim();
        newTicked[key] = true;

        if (FREE_TEXT_FIELDS.includes(key)) {
          newVals[key] = cleanVal;
        } else if (DROPDOWN_FIELDS.includes(key)) {
          const opts = getOpts(key, offName);
          const match = opts.find(o => o.toLowerCase() === cleanVal.toLowerCase());
          if (match) {
            newVals[key] = match;
          } else {
            newVals[key] = "__custom__";
            newCustom[key] = cleanVal;
          }
        }
      });

      setFieldValues(newVals);
      setCustomInputs(newCustom);
      setTickedFields(newTicked);
      setOoakText(""); 
    }
  }, [checkedIds, products]);

  const getOptionsForField = (fieldKey) => {
    const currentStone = fieldValues["official_name"] === "__custom__" 
      ? (customInputs["official_name"] || "").toLowerCase()
      : (fieldValues["official_name"] || "").toLowerCase();
      
    let opts = SEO_DICTIONARY[fieldKey]?.global || [];
    if (currentStone && SEO_DICTIONARY[fieldKey]?.[currentStone]) {
      opts = SEO_DICTIONARY[fieldKey][currentStone];
    }
    return opts;
  };

  const autoSuggestFields = async () => {
    if (checkedIds.length === 0) return;
    setIsSuggesting(true);

    const firstStone = products.find(p => p.id === checkedIds[0]);
    if (!firstStone) { setIsSuggesting(false); return; }

    let suggestedName = fieldValues["official_name"] === "__custom__" 
      ? customInputs["official_name"] 
      : fieldValues["official_name"];

    if (!suggestedName) {
      suggestedName = firstStone.metafields?.official_name || firstStone.title;
    }

    if (!suggestedName || suggestedName.trim() === "") {
      setIsSuggesting(false);
      return; 
    }
    
    const libraryData = lookupStone(suggestedName) || {};
    if (libraryData.official_name) suggestedName = libraryData.official_name;

    const newValues = { ...fieldValues };
    const newTicked = { ...tickedFields };
    const newCustom = { ...customInputs };

    const applySuggestion = (key, value) => {
      if (!value) return;
      const opts = getOptionsForField(key);
      
      if (opts.length === 0 || FREE_TEXT_FIELDS.includes(key)) {
         newValues[key] = value;
      } else {
         const match = opts.find(opt => opt.toLowerCase().includes(value.toLowerCase()) || value.toLowerCase().includes(opt.toLowerCase()));
         if (match) {
           newValues[key] = match;
         } else {
           newValues[key] = "__custom__";
           newCustom[key] = value;
         }
      }
      newTicked[key] = true;
    };

    const fd = new FormData();
    fd.append("intent", "mindat_lookup");
    fd.append("query", suggestedName);
    
    try {
      const res = await fetch("?index", { method: "POST", body: fd });
      const data = await res.json();
      if (data.ok && data.found) {
          const m = data.result;
          const hardness = m.hardness_min ? (m.hardness_max && m.hardness_max !== m.hardness_min ? `${m.hardness_min}-${m.hardness_max}` : `${m.hardness_min}`) : "";
          const density = m.density_min ? (m.density_max && m.density_max !== m.density_min ? `${m.density_min}-${m.density_max}` : `${m.density_min}`) : "";
          
          applySuggestion("moh_hardness", hardness);
          applySuggestion("specific_gravity", density);
          applySuggestion("crystal_system", m.crystal_system);
          applySuggestion("luster", m.lustre);
          applySuggestion("cleavage", m.cleavage);
          applySuggestion("fracture_pattern", m.fracture);
          applySuggestion("diaphaneity", m.diaphaneity);
      }
    } catch (e) {
        console.error("Mindat fetch failed");
    }

    if (fieldValues["official_name"] !== "__custom__") {
      newValues["official_name"] = suggestedName;
    }
    newTicked["official_name"] = true;
    
    if (libraryData.crystal_system) applySuggestion("crystal_system", libraryData.crystal_system);
    if (libraryData.luster) applySuggestion("luster", libraryData.luster);
    if (libraryData.diaphaneity) applySuggestion("diaphaneity", libraryData.diaphaneity);
    if (libraryData.fracture_pattern) applySuggestion("fracture_pattern", libraryData.fracture_pattern);
    if (libraryData.cleavage) applySuggestion("cleavage", libraryData.cleavage);
    if (libraryData.rock_formation) applySuggestion("rock_formation", libraryData.rock_formation);
    if (libraryData.mineral_class) applySuggestion("mineral_class", libraryData.mineral_class);

    setFieldValues(newValues);
    setCustomInputs(newCustom);
    setTickedFields(newTicked);
    setIsSuggesting(false);
  };

  const processBulkQueue = async () => {
    if (checkedIds.length === 0 || (!Object.values(tickedFields).some(Boolean) && !ooakText)) return;
    setIsProcessing(true);

    const updates = {};
    TARGET_KEYS.forEach(k => {
      if (tickedFields[k]) {
        updates[k] = fieldValues[k] === "__custom__" ? (customInputs[k] || "") : (fieldValues[k] || "");
      }
    });

    const currentStories = {};
    if (ooakText) {
      checkedIds.forEach(id => {
        const product = products.find(p => p.id === id);
        currentStories[id] = product?.metafields?.stone_story || "";
      });
    }

    const fd = new FormData();
    fd.append("intent", "bulk_edit_new");
    fd.append("ids", JSON.stringify(checkedIds));
    fd.append("updates", JSON.stringify(updates));
    fd.append("ooakText", ooakText || "");
    fd.append("currentStories", JSON.stringify(currentStories));

    try {
      await fetch("?index", { method: "POST", body: fd });
    } catch (e) {
      console.error("Save failed", e);
    }

    setIsProcessing(false);
    window.location.reload();
  };

  useEffect(() => {
    if (fetcher.data?.payload !== undefined) {
      setPayload(fetcher.data.payload);
    }
  }, [fetcher.data]);

  const filteredProducts = products.filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase()));

  // ==========================================
  // VIEW 1: BULK EDIT
  // ==========================================
  if (mode === "bulk") {
    const allChecked = checkedIds.length === filteredProducts.length && filteredProducts.length > 0;
    const indeterminate = checkedIds.length > 0 && checkedIds.length < filteredProducts.length;

    return (
      <BlockStack gap="400">
        {isProcessing && <Banner tone="info">Saving data to Shopify. This may take a moment...</Banner>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "24px" }}>
          
          <BlockStack gap="300">
            <Card padding="0">
              <Box padding="300" border
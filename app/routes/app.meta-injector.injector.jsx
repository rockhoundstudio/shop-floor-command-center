import React, { useState, useCallback } from "react";
import {
  Box,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Checkbox,
  ChoiceList,
  Divider,
  Select,
  Scrollable,
  Modal,
  DataTable
} from "@shopify/polaris";
import { METAFIELD_CONFIG } from "./app.meta-injector.constants";

export function InjectorTab({ products, fetcher, shopify, dbProfiles = [] }) {
  const [bulkMode, setBulkMode] = useState("fill");
  const [bulkFormData, setBulkFormData] = useState({});
  const [bulkSelectedProductIds, setBulkSelectedProductIds] = useState([]);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const [dynamicCustomFields, setDynamicCustomFields] = useState([]);
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, diffs: [], payload: [] });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const inputTapTargetStyle = { minHeight: '48px', display: 'flex', flexDirection: 'column', justifyContent: 'center' };

  const getMetafieldValue = useCallback((product, key) => {
    if (!product || !product.metafields) return "";
    const mf = product.metafields.edges.find(e => e.node.key === key);
    return mf ? mf.node.value : "";
  }, []);

  const resolveMetafieldType = useCallback((product, fieldConfig, newValue) => {
    if (fieldConfig.options) return "list.metaobject_reference";
    const existingMf = product.metafields.edges.find(e => e.node.key === fieldConfig.key);
    if (existingMf) return existingMf.node.type;
    const isNumberType = fieldConfig.type.includes("number");
    const containsDash = newValue ? /[\-–—]/.test(newValue) : false;
    return isNumberType ? (containsDash ? "single_line_text_field" : fieldConfig.type) : fieldConfig.type;
  }, []);

  const toggleProduct = (id) => {
    setBulkSelectedProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAutoFill = () => {
    const baseStoneType = bulkFormData["base_stone_type"] || "";

    if (!baseStoneType.trim()) {
      if (shopify && shopify.toast) shopify.toast.show("Please type a base stone (e.g., 'Jasper') into 'Base Stone Type' first!", { isError: true });
      return;
    }

    const profile = dbProfiles.find(db => 
      baseStoneType.toLowerCase().includes((db.title || db.stoneName || "").toLowerCase()) || 
      (db.title || db.stoneName || "").toLowerCase().includes(baseStoneType.toLowerCase())
    );
    
    if (!profile) {
      if (shopify && shopify.toast) shopify.toast.show(`No dictionary entry found for "${baseStoneType}".`, { isError: true });
      return;
    }

    setBulkFormData(prev => ({
      ...prev,
      google_authenticity: profile.googleAuthenticity || prev.google_authenticity || "",
      google_rarity: profile.googleRarity || prev.google_rarity || "",
      google_crystal_system: profile.googleCrystalSystem || prev.google_crystal_system || "",
      google_geological_era: profile.googleGeologicalEra || prev.google_geological_era || "",
      google_mineral_class: profile.googleMineralClass || prev.google_mineral_class || "",
      google_rock_composition: profile.googleRockComposition || prev.google_rock_composition || "",
      google_rock_formation: profile.googleRockFormation || prev.google_rock_formation || "",
      
      store_hardness: profile.storeHardness || prev.store_hardness || "",
      store_luster: profile.storeLuster || prev.store_luster || "",
      store_fracture: profile.storeFracture || prev.store_fracture || "",
      store_cleavage: profile.storeCleavage || prev.store_cleavage || "",
      store_specific_gravity: profile.storeSpecificGravity || prev.store_specific_gravity || "",
      store_diaphaneity: profile.storeDiaphaneity || prev.store_diaphaneity || ""
    }));

    if (shopify && shopify.toast) shopify.toast.show(`${profile.title || profile.stoneName} science successfully loaded from dictionary!`, { isError: false });
  };

  const handleBulkSubmit = () => {
    const selectedProducts = products.filter(p => bulkSelectedProductIds.includes(p.id));
    if (selectedProducts.length === 0) {
      if (shopify && shopify.toast) shopify.toast.show("Select at least one product.", { isError: true });
      return;
    }

    const payload = [];
    const diffSummary = [];
    let changesCount = 0;

    selectedProducts.forEach(product => {
      const statusStr = getMetafieldValue(product, "meta_status");
      let statusObj = {};
      try { 
        statusObj = statusStr ? JSON.parse(statusStr) : {}; 
      } catch(e) {}
      
      let productChanged = false;

      METAFIELD_CONFIG.forEach(field => {
        if (field.hidden) return;
        const newVal = bulkFormData[field.key] || "";
        if (!newVal) return;

        const currentVal = getMetafieldValue(product, field.key);
        if (bulkMode === "fill" && currentVal) return;
        if (currentVal === newVal) return;

        const resolvedType = resolveMetafieldType(product, field, newVal);
        
        let finalValue = newVal;
        if (resolvedType.includes("list.")) {
          finalValue = JSON.stringify([newVal]);
        }

        payload.push({ ownerId: product.id, namespace: field.namespace, key: field.key, type: resolvedType, value: finalValue });
        statusObj[field.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      dynamicCustomFields.forEach(df => {
        if (!df.key || !df.value) return;
        const currentVal = getMetafieldValue(product, df.key);
        if (bulkMode === "fill" && currentVal) return;
        if (currentVal === df.value) return;

        payload.push({ ownerId: product.id, namespace: "custom", key: df.key, type: "single_line_text_field", value: df.value });
        statusObj[df.key] = "bulk_unverified";
        productChanged = true;
        changesCount++;
      });

      if (productChanged) {
        payload.push({ ownerId: product.id, namespace: "custom", key: "meta_status", type: "json", value: JSON.stringify(statusObj) });
      }
    });

    if (payload.length === 0) {
      if (shopify && shopify.toast) shopify.toast.show("No changes to apply based on current mode and inputs.", { isError: false });
      return;
    }

    diffSummary.push({ field: "Total Updates", old: "Current State", new: `${changesCount} updates across ${selectedProducts.length} products` });

    setModalConfig({
      active: true, 
      title: `Confirm Bulk Injection (${bulkMode.toUpperCase()})`,
      body: bulkMode === "overwrite" ? "WARNING: OVERWRITE mode destroys existing verified data." : "FILL ONLY mode. Existing data is safe.",
      diffs: diffSummary, 
      payload: payload
    });
  };

  const executeBulkSubmit = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
    setModalConfig({ active: false, title: "", body: null, diffs: [], payload: [] });
  };

  let visibleProducts = products;
  if (bulkSearchQuery.trim() !== "") {
    const lowerQuery = bulkSearchQuery.toLowerCase();
    visibleProducts = products.filter(p => p.title.toLowerCase().includes(lowerQuery));
  }

  return (
    <BlockStack gap="500">
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button tone="success" size="large" onClick={handleBulkSubmit} accessibilityLabel="Preview bulk injection">
          Preview & Run Bulk Inject
        </Button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'row', gap: '24px', minHeight: '600px' }}>
        <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column' }}>
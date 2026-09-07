useEffect(() => {
    if (selectedProductId && products && products.length > 0) {
      const product = products.find(p => p.id === selectedProductId);
      if (product) {
        const allEdges = [
          ...(product.customMeta?.edges || []),
          ...(product.rockhoundMeta?.edges || []),
          ...(product.geoMeta?.edges || []),
          ...(product.metafields?.edges || [])
        ];

        const incoming = {};

        allEdges.forEach(({ node }) => {
          if (node && node.key && node.value && String(node.value).trim() !== '') {
            incoming[node.key] = String(node.value).replace(/â€”/g, '—');
          }
        });

        if (incoming.weight_grams && !incoming.shipping_weight_oz) {
          const grams = parseFloat(incoming.weight_grams);
          if (!isNaN(grams) && grams > 0) {
            incoming.shipping_weight_oz = String(Math.ceil((grams / 28.35) + 0.5));
          }
        }

        if (product.title) {
          const cleanTitle = product.title.replace(/â€”/g, '—');
          incoming.shopify_title = cleanTitle;
          incoming.piece_name = cleanTitle.includes(' — ') ? cleanTitle.split(' — ').pop().trim() : cleanTitle;
        }

        setFormState(prev => ({ ...prev, ...incoming }));
        setFullMetaState(prev => ({ ...prev, ...incoming }));
        originalMetaRef.current = { ...originalMetaRef.current, ...incoming };
      }
    }
  }, [selectedProductId, products]);

  const updateFormState = useCallback((key, value) => {
    setFormState(prev => ({ ...prev, [key]: value }));
    if (key === "color") setFullMetaState(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateFullMetaState = useCallback((key, value) => {
    setFullMetaState(prev => {
      const updated = { ...prev, [key]: value };
      if (key === "weight_grams" && value !== "") {
        const grams = parseFloat(value);
        if (!isNaN(grams) && grams > 0) {
          updated.shipping_weight_oz = String(Math.ceil((grams / 28.35) + 0.5));
        }
      }
      return updated;
    });
  }, []);

  const handleTab2AutoFill = useCallback(() => {
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_handle || fullMetaState.origin_page_handle || "";
    const product = products.find(p => p.id === selectedProductId);
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const formData = new FormData();
    formData.append("intent", "tab2AutoFill");
    formData.append("productId", selectedProductId);
    formData.append("stone_family", stoneFamily);
    formData.append("origin_handle", originHandle);
    formData.append("cut_and_shape", fullMetaState.cut_and_shape || "");
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);

    if (overridePhoto) {
      formData.append("imageBase64", overridePhoto.base64);
      formData.append("imageMimeType", overridePhoto.mimeType);
    } else {
      formData.append("imageUrl", imageUrl);
    }

    tab2Fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
  }, [selectedProductId, tab2Fetcher, fullMetaState, products, formState, overridePhoto]);

  const handleFullRescan = useCallback(() => {
    if (!selectedProductId) return;
    setTab2StatusMessage("");
    setTab2ErrorMessage("");

    const stoneFamily = fullMetaState.stone_family || "";
    const originHandle = fullMetaState.origin_handle || fullMetaState.origin_page_handle || "";
    const product = products.find(p => p.id === selectedProductId);
    const titleToUse = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
    const imageUrl = product?.images?.edges?.[0]?.node?.url || "";

    const formData = new FormData();
    formData.append("intent", "fullRescan");
    formData.append("productId", selectedProductId);
    formData.append("stone_family", stoneFamily);
    formData.append("origin_handle", originHandle);
    formData.append("cut_and_shape", fullMetaState.cut_and_shape || "");
    formData.append("collection_location", fullMetaState.collection_location || "");
    formData.append("piece_name", fullMetaState.piece_name || "");
    formData.append("productTitle", titleToUse);
    formData.append("origin_story", fullMetaState.origin_story || "");
    formData.append("honest_flaws_and_character", fullMetaState.honest_flaws_and_character || "");
    formData.append("generated_description", fullMetaState.generated_description || "");
    formData.append("price", fullMetaState.price || "");

    if (overridePhoto) {
      formData.append("imageBase64", overridePhoto.base64);
      formData.append("imageMimeType", overridePhoto.mimeType);
    } else {
      formData.append("imageUrl", imageUrl);
    }

    tab2Fetcher.submit(formData, { method: "post", action: "/app/meta-injector-autofill" });
  }, [selectedProductId, tab2Fetcher, fullMetaState, products, formState, overridePhoto]);

  const handleCopyTelemetry = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(fullMetaState, null, 2))
      .then(() => {
        if (window.shopify && window.shopify.toast) {
          window.shopify.toast.show("Telemetry data copied to clipboard!");
        }
      })
      .catch(err => console.error("Failed to copy telemetry:", err));
  }, [fullMetaState]);

  const handleInject = useCallback(() => {
    if (!selectedProductId) return;
    setStatusMessage("");
    setErrorMessage("");

    const selectedProduct = products.find(p => p.id === selectedProductId);
    const masterTitle = fullMetaState.shopify_title || formState.shopify_title || selectedProduct?.title || "";
    const resolvedPieceName = masterTitle.includes(" — ") ? masterTitle.split(" — ").pop().trim() : masterTitle;
    
    const allowedKeys = NAMESPACE_MAP.custom;
    const payload = [];

    Object.entries(fullMetaState).forEach(([key, value]) => {
      if (key === "shopify_title") return; 
      if (!allowedKeys.includes(key)) return;

      let injectValue = String(value);
      if (key === "piece_name") injectValue = resolvedPieceName;

      // 🔴 UNIVERSAL STEAMROLLER: Crush all hidden line breaks, 'Enter' keys, and carriage returns.
      injectValue = injectValue.replace(/\\[rn]/g, " ").replace(/[\r\n]+/g, " ").replace(/\s{2,}/g, " ").trim();

      const config = CUSTOM_FIELDS.find(f => f.key === key);
      let fieldType = config && config.type ? config.type : "single_line_text_field";
      
      if (["honest_flaws_and_character", "origin_story", "generated_description", "artist_notes"].includes(key)) {
        fieldType = "multi_line_text_field";
      }

      // 🟢 FIX: Safe-strip numbers before sending so Shopify doesn't crash the decimal schema
      if (fieldType === "number_decimal") {
        injectValue = injectValue.replace(/[^\d.-]/g, "");
        if (!injectValue || isNaN(parseFloat(injectValue))) return; 
      }

      const isPopulated = injectValue !== "" && injectValue !== "N/A";
      
      if (isPopulated && injectValue !== "See Shopify metaobject") {
        let formatId = selectedProductId.includes("gid://") ? selectedProductId : `gid://shopify/Product/${selectedProductId}`;
        
        payload.push({
          namespace: "custom", 
          key: key.replace(/-/g, "_"),
          type: fieldType,
          value: injectValue,
          ownerId: formatId
        });
      }
    });

    if (payload.length === 0 && !masterTitle) {
      setErrorMessage("No fields are populated. Fill at least one field to inject.");
      return;
    }

    const descHtml = formState.generated_description || fullMetaState.generated_description || "";

    injectFetcher.submit(
      { 
        intent: "saveMetafields", 
        payload: JSON.stringify(payload),
        productId: selectedProductId,
        productTitle: masterTitle,
        descriptionHtml: descHtml
      },
      { method: "post", action: "/app/meta-injector-api" }
    );
  }, [selectedProductId, formState, products, injectFetcher, fullMetaState]);

  useEffect(() => {
    const isIdle = tab2Fetcher.state === "idle";
    const hasData = tab2Fetcher.data !== undefined && tab2Fetcher.data !== null;

    if (isIdle && hasData) {
      const product = products.find(p => p.id === selectedProductId);
      const productTitle = fullMetaState.shopify_title || formState.shopify_title || product?.title || "";
      const tab2Data = tab2Fetcher.data.tab2Data || {};

      if (Object.keys(tab2Data).length > 0) {
        setFormState(prev => {
          const updatedState = { ...prev };
          Object.entries(tab2Data).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            if (hasNewValue) {
              let normalizedVal = val;
              if (key === "treated" || key === "is_ooak") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });
          return updatedState;
        });

        setFullMetaState(prev => {
          const updatedState = { ...prev };
          // 🔴 REPAIRED: "stone_story" amputated from ALWAYS_OVERWRITE
          const ALWAYS_OVERWRITE = ["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age", "generated_description", "seo_title", "origin_story", "primary_use", "bail_included", "setting_ready", "primary_medium", "alt_text"];

          Object.entries(tab2Data).forEach(([key, val]) => {
            const hasNewValue = val !== undefined && val !== null && val.toString().trim() !== "" && val !== "See Shopify metaobject";
            const currentlyEmpty = !updatedState[key] || updatedState[key].toString().trim() === "";
            
            if (hasNewValue && (currentlyEmpty || ALWAYS_OVERWRITE.includes(key))) {
              let normalizedVal = val;
              if (key === "treated" || key === "is_ooak") {
                if (val === true || val === "true") normalizedVal = "Yes";
                else if (val === false || val === "false") normalizedVal = "No";
              }
              updatedState[key] = normalizedVal;
            }
          });

          if (productTitle) updatedState.piece_name = productTitle.includes(" \u2014 ") ? productTitle.split(" \u2014 ").pop().trim() : productTitle;

          const REQUIRED_TAB2_FIELDS = [{ key: "generated_description", label: "Generated Description" }, { key: "color_pattern", label: "Color Pattern" }, { key: "collection_location", label: "Collection Location" }, { key: "origin_handle", label: "Origin Handle" }];
          const missingFields = REQUIRED_TAB2_FIELDS.filter(f => {
            const val = updatedState[f.key] || "";
            return val.toString().trim() === "" || val === "[No story provided]";
          });
          if (missingFields.length > 0) {
            setTimeout(() => {
              setPendingFixFields(missingFields);
              setCurrentFixIndex(0);
              setFixPopupValue("");
              setShowFixPopup(true);
            }, 0);
          }

          return updatedState;
        });
        setTab2StatusMessage("Auto-Fill complete \u2014 review fields before saving");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill complete!");
      } else {
        setTab2ErrorMessage("Auto-Fill returned no data \u2014 check stone_family and origin_handle.");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Auto-Fill failed", { isError: true });
      }
    }
  }, [tab2Fetcher.state, tab2Fetcher.data, selectedProductId, products]);

  useEffect(() => {
    const isIdle = injectFetcher.state === "idle";
    const hasData = injectFetcher.data !== undefined && injectFetcher.data !== null;
    if (isIdle && hasData) {
      if (injectFetcher.data.success) {
        setStatusMessage("Data cleanly locked into Shopify database.");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Update successful!");
      } else {
        setErrorMessage(injectFetcher.data.message || injectFetcher.data.error || "An unknown error occurred");
        if (window.shopify && window.shopify.toast) window.shopify.toast.show("Action failed", { isError: true });
      }
    }
  }, [injectFetcher.state, injectFetcher.data]);

  const handleFixPopupConfirm = useCallback(() => {
    const field = pendingFixFields[currentFixIndex];
    if (field && fixPopupValue.trim() !== "") {
      setFormState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
      setFullMetaState(prev => ({ ...prev, [field.key]: fixPopupValue.trim() }));
    }
    const nextIndex = currentFixIndex + 1;
    if (nextIndex < pendingFixFields.length) {
      setCurrentFixIndex(nextIndex);
      setFixPopupValue("");
    } else {
      setShowFixPopup(false); setPendingFixFields([]); setCurrentFixIndex(0); setFixPopupValue("");
    }
  }, [pendingFixFields, currentFixIndex, fixPopupValue]);

  const handleFixPopupSkip = useCallback(() => {
    const nextIndex = currentFixIndex + 1;
    if (nextIndex < pendingFixFields.length) {
      setCurrentFixIndex(nextIndex);
      setFixPopupValue("");
    } else {
      setShowFixPopup(false); setPendingFixFields([]); setCurrentFixIndex(0); setFixPopupValue("");
    }
  }, [pendingFixFields, currentFixIndex]);

  const renderFullMetaField = (key) => {
    let field = null;
    for (const group of FULL_META_GROUPS) {
      const found = group.fields.find(f => f.key === key);
      if (found) { field = found; break; }
    }
    if (!field) {
      const rf = CUSTOM_FIELDS.find(f => f.key === key);
      if (rf) field = rf; 
    }
    if (!field) {
      field = { key: key, label: key.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), type: 'text', multiline: key.includes("story") || key.includes("notes") || key.includes("flaws") || key.includes("character") || key === "generated_description" };
    }

    let val = fullMetaState[field.key] || "";
    if (typeof val === 'string' && val.startsWith('[')) { try { const arr = JSON.parse(val); val = Array.isArray(arr) ? arr[0] : val; } catch(e) {} } else if (Array.isArray(val)) { val = val[0]; }

    if ((field.key === "handcrafted_by" || field.key === "rescued_by") && typeof val === 'string') {
        if (val.includes("Bob & Janyce") || val.includes("Rockhound Studio")) val = "Bob & Janyce, Rockhound Studio";
    }
    if (field.key === "primary_medium" && val === "Stone") val = "";
    if (field.key === "color" && formState.color) val = formState.color;

    const reqKeys = ["shopify_title", "piece_name", "price", "weight_grams", "material", "stone_family", "collection_name", "origin_handle", "rescued_by", "treatment_status", "origin_story", "primary_use", "seo_title"];
    const isFilled = val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "false";
    const isRequiredEmpty = !isFilled && reqKeys.includes(field.key);
    const isEmpty = !isFilled;
    
    let dotFillColor = "#eab308";
    if (isFilled) dotFillColor = "#22c55e"; 
    if (isRequiredEmpty) dotFillColor = "#ef4444"; 

    const labelNode = (
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" style={{ minWidth: '18px', marginRight: '8px' }}>
          <circle cx="9" cy="9" r="9" fill={dotFillColor} />
        </svg>
        <span style={{ fontSize: '14px', fontWeight: '500' }}>{field.label}</span>
      </div>
    );

    return (
      <div key={field.key}>
        <div style={{ backgroundColor: isEmpty ? "#FFF5F5" : "transparent", minHeight: "48px", padding: "8px", borderRadius: "4px" }}>
          {field.type !== "text" && DROPDOWN_OPTIONS && DROPDOWN_OPTIONS[field.key] && DROPDOWN_OPTIONS[field.key].length > 0 ? (
            <Select label={labelNode} options={[{ label: "Select...", value: "" }, ...(DROPDOWN_OPTIONS[field.key] || [])]} value={val} onChange={(v) => updateFullMetaState(field.key, v)} accessibilityLabel={field.label} />
          ) : (
            <TextField label={labelNode} value={val} onChange={(v) => updateFullMetaState(field.key, v)} accessibilityLabel={field.label} multiline={field.multiline ? true : false} autoComplete="off" disabled={!isEmpty && val === "See Shopify metaobject" && field.key !== "shopify_title"} />
          )}
        </div>
      </div>
    );
  };

  const safeProducts = products || [];
  const filteredProducts = safeProducts.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <BlockStack gap="400">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">1. Select Raw Inventory</Text>
              <TextField value={searchQuery} onChange={setSearchQuery} placeholder="Search products by title..." autoComplete="off" clearButton onClearButtonClick={() => setSearchQuery("")} />
              <div style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredProducts.map(p => (
                  <div key={p.id} style={{ minHeight: "54px" }}>
                    <Button fullWidth size="large" textAlign="left" variant={selectedProductId === p.id ? "primary" : "secondary"} onClick={() => handleSelectProduct(p.id)}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        {p.images?.edges?.[0]?.node?.url ? <img src={p.images.edges[0].node.url} alt="" style={{ width: "48px", height: "48px", objectFit: "cover", borderRadius: "6px", flexShrink: 0 }} /> : <div style={{ width: "48px", height: "48px", backgroundColor: "#2a2a2a", border: "1px solid #444", borderRadius: "6px", flexShrink: 0 }} />}
                        <span>{p.title}</span>
                      </div>
                    </Button>
                  </div>
                ))}
              </div>
            </BlockStack>
          </Card>
        </div>

        <div>
          <Card padding="400">
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">2. Data Sieve & Injection</Text>
              {statusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{statusMessage}</Text></Banner>}
              {errorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{errorMessage}</Text></Banner>}
              
              <TextField label="Gemini Presentation Style" placeholder="e.g. Write with OOAK grit — raw, earthy, one-of-a-kind stone energy." value={promptStyle} onChange={setPromptStyle} multiline={3} autoComplete="off" disabled={!selectedProductId} />

              {selectedProductId && (() => {
                const product = products.find(p => p.id === selectedProductId);
                return (
                  <BlockStack gap="200">
                    <Text as="p" variant="bodyMd" tone="subdued">Review before running — edit if legacy data is incorrect:</Text>
                    <TextField label="Product Title" value={formState.shopify_title || fullMetaState.shopify_title || product?.title || ""} onChange={(val) => { setFormState(prev => ({ ...prev, shopify_title: val })); setFullMetaState(prev => ({ ...prev, shopify_title: val })); }} autoComplete="off" helpText="Format: Stone Family — Origin Location — Piece Name" />
                    <TextField label="Origin Handle (override)" value={formState.origin_handle || fullMetaState.origin_handle || ""} onChange={(val) => { setFormState(prev => ({ ...prev, origin_handle: val })); setFullMetaState(prev => ({ ...prev, origin_handle: val })); }} autoComplete="off" helpText="e.g. the-richardson-strike — leave blank to auto-resolve from title" />
                    
                    <div style={{ marginTop: "16px" }}>
                      <Text variant="headingMd" as="h3" fontWeight="bold">Upload New Hero Photo (overrides Shopify image for rescan)</Text>
                      {overridePhoto ? (
                        <div style={{ display: "flex", gap: "16px", marginTop: "8px", alignItems: "center" }}>
                          <img src={overridePhoto.previewUrl} alt="Override preview" style={{ width: "80px", height: "80px", objectFit: "cover", borderRadius: "6px" }} />
                          <Button onClick={() => setOverridePhoto(null)} tone="critical">Remove</Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: "8px" }}>
                          <DropZone 
                            accept="image/jpeg, image/png" 
                            type="image" 
                            allowMultiple={false} 
                            onDrop={handleDropOverridePhoto}
                          >
                            <DropZone.FileUpload actionTitle="Drop photo here or click to upload" />
                          </DropZone>
                        </div>
                      )}
                    </div>
                  </BlockStack>
                );
              })()}

              <InlineStack align="space-between" gap="300">
                <Button icon={MagicIcon} onClick={handleTab2AutoFill} size="large" fullWidth disabled={!selectedProductId} loading={tab2Fetcher.state !== "idle"}>RUN</Button>
                <Button icon={MagicIcon} onClick={handleFullRescan} size="large" fullWidth disabled={!selectedProductId} loading={tab2Fetcher.state !== "idle"} tone="success">Full Rescan</Button>
                <Button tone="critical" onClick={() => injectFetcher.submit({ intent: "cleanGhostNamespaces", productId: selectedProductId }, { method: "post", action: "/app/meta-injector-api" })} size="large" fullWidth disabled={!selectedProductId} loading={injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "cleanGhostNamespaces"}>Wipe Ghosts</Button>
                <Button icon={ClipboardIcon} onClick={handleCopyTelemetry} size="large" fullWidth disabled={!selectedProductId}>Copy Telemetry</Button>
                <Button icon={SaveIcon} tone="success" variant="primary" onClick={handleInject} size="large" fullWidth disabled={!selectedProductId} loading={injectFetcher.state !== "idle" && (injectFetcher.formData?.get("intent") === "saveProduct" || injectFetcher.formData?.get("intent") === "saveMetafields")}>Inject Metafields</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </div>

      {selectedProductId !== "" && (
        <div style={{ marginTop: "32px" }}>
          <Card padding="400">
            <BlockStack gap="400">
              {tab2StatusMessage !== "" && <Banner title="Operation Successful" tone="success"><Text as="p">{tab2StatusMessage}</Text></Banner>}
              {tab2ErrorMessage !== "" && <Banner title="Operation Failed" tone="critical"><Text as="p">{tab2ErrorMessage}</Text></Banner>}
              {injectFetcher.state === "idle" && injectFetcher.data?.message?.includes("Cleaned") && <Banner title="Ghosts Cleaned" tone="success"><Text as="p">{injectFetcher.data.message}</Text></Banner>}

              <Text as="h3" variant="headingLg">Full Meta Report</Text>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 1 — Core Ignition</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["shopify_title", "piece_name", "primary_medium", "secondary_medium", "handcrafted_by", "is_ooak", "treated", "dimensions_mm", "weight_grams", "shipping_weight_oz", "cut_and_shape", "surface_finish", "color", "artist_notes", "generated_description", "price"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 2 — Human Engine</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["origin_story", "rescued_by", "stone_shape", "collection_name", "origin_handle", "collection_location", "honest_flaws_and_character"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 3 — Google Machine</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["primary_use", "setting_ready", "wire_material", "bail_included", "color_pattern", "material", "jewelry_type", "necklace_design", "target_gender", "age_group", "condition", "custom_product", "seo_title", "google_product_category"].map(renderFullMetaField)}
                </div>
              </BlockStack>

              <BlockStack gap="300">
                <Text as="h4" variant="headingMd">Section 4 — Geo-Vault</Text>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                  {["mohs_hardness", "luster", "fracture_pattern", "cleavage", "specific_gravity", "diaphaneity", "mineral_class", "crystal_system", "rock_composition", "rock_formation", "geological_era", "geological_age"].map(renderFullMetaField)}
                </div>
              </BlockStack>

            </BlockStack>
          </Card>
        </div>
      )}

      <div style={{ marginTop: "32px" }}>
        <Card padding="400">
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">Nuclear Ghost Cleanup</Text>
            {injectFetcher.state === "idle" && injectFetcher.data?.message?.includes("Nuclear sweep") && <Banner title={injectFetcher.data.success ? "Operation Successful" : "Operation Failed"} tone={injectFetcher.data.success ? "success" : "critical"}><Text as="p">{injectFetcher.data.message}</Text></Banner>}
            <Button tone="critical" variant="primary" onClick={() => injectFetcher.submit({ intent: "cleanAllGhostNamespaces" }, { method: "post", action: "/app/meta-injector-api" })} loading={injectFetcher.state !== "idle" && injectFetcher.formData?.get("intent") === "cleanAllGhostNamespaces"}>Clean ALL Ghost Namespaces (Store-Wide)</Button>
          </BlockStack>
        </Card>
      </div>

      {showFixPopup && pendingFixFields[currentFixIndex] && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "480px", maxWidth: "90vw", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Missing: {pendingFixFields[currentFixIndex].label}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">Field {currentFixIndex + 1} of {pendingFixFields.length} — enter a value or skip.</Text>
              <TextField value={fixPopupValue} onChange={setFixPopupValue} label={pendingFixFields[currentFixIndex].label} autoComplete="off" multiline={pendingFixFields[currentFixIndex].key === "generated_description" ? 4 : undefined} />
              <InlineStack gap="300" align="end">
                <Button onClick={handleFixPopupSkip}>Skip</Button>
                <Button variant="primary" onClick={handleFixPopupConfirm}>Save & Continue</Button>
              </InlineStack>
            </BlockStack>
          </div>
        </div>
      )}
    </BlockStack>
  );
}

export default IntakeBenchTab;
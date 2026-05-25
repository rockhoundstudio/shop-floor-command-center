[scanned, displayMenus, pages]);

  const linkOptions = [
    { label: "✏️ Type Custom Link...", value: "custom" },
    { label: "🏠 Home Page", value: "/" },
    { label: "🛍️ All Products", value: "/collections/all" },
    ...collections.map(c => ({ label: `📦 ${c.title}`, value: `/collections/${c.handle}` })),
    ...pages.map(p => ({ label: `📄 ${p.title}`, value: `/pages/${p.handle}` }))
  ];

  const handleSelectMenu = (menu) => {
    setIsCreatingMenu(false);
    setActiveMenu(menu);
    setMenuTitle(menu.title);
    setMenuItems(menu.items.map(item => ({
      id: item.id || Math.random().toString(),
      title: item.title,
      url: item.url || "",
      items: (item.items || []).map(child => ({
        id: child.id || Math.random().toString(),
        title: child.title,
        url: child.url || ""
      }))
    })));
    setScanned(globalScan !== null);
  };

  const activeMenuSetting = dbSettings?.find(s => s.menuHandle === activeMenu?.handle) || {};
  const isLocked = activeMenu?.handle === "main-menu" && activeMenuSetting.isLocked;
  const autoSyncFooter = activeMenuSetting.autoSync || false;
  const activeMenuHistory = dbHistory[activeMenu?.handle] || [];

  // Data Mutators
  const toggleLock = () => {
    const fd = new FormData();
    fd.append("intent", "toggleLock");
    fd.append("menuHandle", activeMenu.handle);
    fd.append("isLocked", (!isLocked).toString());
    fetcher.submit(fd, { method: "post" });
  };

  const handleAutoSyncChange = (newVal) => {
    const fd = new FormData();
    fd.append("intent", "toggleAutoSync");
    fd.append("menuHandle", activeMenu.handle);
    fd.append("autoSync", newVal.toString());
    fetcher.submit(fd, { method: "post" });
  };

  const handleAddLink = () => {
    if (isLocked) return;
    setMenuItems(prev => [...prev, { id: Math.random().toString(), title: "New Link", url: "", items: [] }]);
    setScanned(false);
  };

  const handleAddSubLink = (parentId) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          items: [...(item.items || []), { id: Math.random().toString(), title: "New Sub-link", url: "" }]
        };
      }
      return item;
    }));
    setScanned(false);
  };

  const handleUpdateLink = (id, field, value) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    setScanned(false);
  };

  const handleUpdateSubLink = (parentId, childId, field, value) => {
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return {
          ...item,
          items: (item.items || []).map(child => child.id === childId ? { ...child, [field]: value } : child)
        };
      }
      return item;
    }));
    setScanned(false);
  };

  const handleDeleteLink = (e, id) => {
    e.stopPropagation(); e.preventDefault();
    if (isLocked) return;
    setMenuItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDeleteSubLink = (e, parentId, childId) => {
    e.stopPropagation(); e.preventDefault();
    if (isLocked) return;
    setMenuItems(prev => prev.map(item => {
      if (item.id === parentId) {
        return { ...item, items: (item.items || []).filter(child => child.id !== childId) };
      }
      return item;
    }));
  };

  // Button Arrow Fallbacks
  const handleMoveLink = (e, index, direction) => {
    e.stopPropagation(); e.preventDefault();
    if (isLocked) return;
    const newItems = [...menuItems];
    if (direction === "up" && index > 0) {
      [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    } else if (direction === "down" && index < newItems.length - 1) {
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    setMenuItems(newItems);
  };

  const handleMoveSubLink = (e, parentIndex, childIndex, direction) => {
    e.stopPropagation(); e.preventDefault();
    if (isLocked) return;
    const newItems = [...menuItems];
    const parent = { ...newItems[parentIndex] };
    const children = [...(parent.items || [])];
    
    if (direction === "up" && childIndex > 0) {
      [children[childIndex - 1], children[childIndex]] = [children[childIndex], children[childIndex - 1]];
    } else if (direction === "down" && childIndex < children.length - 1) {
      [children[childIndex], children[childIndex + 1]] = [children[childIndex + 1], children[childIndex]];
    }
    
    parent.items = children;
    newItems[parentIndex] = parent;
    setMenuItems(newItems);
  };

  // Drag and Drop Ordering
  const handleDragStart = (e, id, parentId = "") => {
    if (isLocked) { e.preventDefault(); return; }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("dragId", id);
    e.dataTransfer.setData("parentId", parentId);
  };

  const handleDrop = (e, dropId, targetParentId = "") => {
    e.preventDefault();
    if (isLocked) return;
    
    const dragId = e.dataTransfer.getData("dragId");
    const sourceParentId = e.dataTransfer.getData("parentId");
    if (!dragId || dragId === dropId) return;

    if (targetParentId === "" && sourceParentId === "") {
      setMenuItems(prev => {
        const newItems = [...prev];
        const dragIdx = newItems.findIndex(i => i.id === dragId);
        const dropIdx = newItems.findIndex(i => i.id === dropId);
        if (dragIdx === -1 || dropIdx === -1) return prev;
        const [dragged] = newItems.splice(dragIdx, 1);
        newItems.splice(dropIdx, 0, dragged);
        return newItems;
      });
    } else if (targetParentId !== "" && sourceParentId === targetParentId) {
      setMenuItems(prev => prev.map(item => {
        if (item.id === targetParentId) {
          const newChildren = [...(item.items || [])];
          const dragIdx = newChildren.findIndex(c => c.id === dragId);
          const dropIdx = newChildren.findIndex(c => c.id === dropId);
          if (dragIdx === -1 || dropIdx === -1) return item;
          const [dragged] = newChildren.splice(dragIdx, 1);
          newChildren.splice(dropIdx, 0, dragged);
          return { ...item, items: newChildren };
        }
        return item;
      }));
    }
  };

  const handleFixIt = (e, id) => {
    e.stopPropagation();
    if (isLocked) return;
    const el = document.getElementById(`quick-select-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus();
    }
  };

  const handleScan = () => setScanned(true);

  const handleGlobalScan = () => {
    const result = {};
    displayMenus.forEach(menu => {
      result[menu.id] = countByStatus(menu.items, liveCollectionHandles, livePageHandles);
    });
    setGlobalScan(result);
    setScanned(true);
  };

  const autoFillCollections = () => {
    if (activeMenu?.handle !== "footer" || isLocked) return;
    
    const existingUrls = new Set();
    menuItems.forEach(item => {
      existingUrls.add(item.url);
      (item.items || []).forEach(child => existingUrls.add(child.url));
    });

    const newLinks = collections
      .filter(c => !existingUrls.has(`/collections/${c.handle}`))
      .map(c => ({
        id: Math.random().toString(),
        title: c.title,
        url: `/collections/${c.handle}`,
        items: []
      }));

    if (newLinks.length > 0) {
      setMenuItems(prev => [...prev, ...newLinks]);
      setScanned(false);
    }
  };

  const autoCleanDeadLinks = () => {
    if (isLocked) return;
    setMenuItems(prev => prev
      .map(item => ({
        ...item,
        items: (item.items || []).filter(child => getDestinationStatus(child.url, liveCollectionHandles, livePageHandles) !== "dead")
      }))
      .filter(item => getDestinationStatus(item.url, liveCollectionHandles, livePageHandles) !== "dead" || (item.items && item.items.length > 0))
    );
    setScanned(true);
  };

  const handleSaveMenu = () => {
    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", activeMenu.id);
    fd.append("title", menuTitle);
    fd.append("handle", activeMenu.handle);
    fd.append("items", JSON.stringify(menuItems));
    fd.append("logMessage", "Menu structure manually updated and saved.");
    fetcher.submit(fd, { method: "post" });
  };

  const handleCreateAllStoriesMenu = () => {
    if (allStoriesMenuExists) return;
    const fd = new FormData();
    fd.append("intent", "createAllStoriesMenu");
    fetcher.submit(fd, { method: "post" });
  };

  const handleAssignOrphanToStories = (page) => {
    if (!allStoriesMenuExists) {
      alert("The 'All Stories' menu does not exist yet. Please create it first using the button at the top.");
      return;
    }
    const storiesMenu = displayMenus.find(m => m.handle === "all-stories");
    if (!storiesMenu) return;

    const newItems = [...storiesMenu.items, {
      title: page.title,
      url: `/pages/${page.handle}`,
      type: "HTTP",
      items: []
    }];

    const fd = new FormData();
    fd.append("intent", "updateMenu");
    fd.append("id", storiesMenu.id);
    fd.append("title", storiesMenu.title);
    fd.append("handle", storiesMenu.handle);
    fd.append("items", JSON.stringify(newItems));
    fd.append("logMessage", `⚡ Auto-assigned orphaned page to All Stories: ${page.title}`);
    fetcher.submit(fd, { method: "post" });
  };

  const handleAcceptFix = (fix) => {
    if (!fix.suggestion) return;
    const fd = new FormData();
    fd.append("intent", "fixPageLinks");
    fd.append("fixes", JSON.stringify([fix]));
    fetcher.submit(fd, { method: "post" });
  };

  const handleFixAll = () => {
    const fixable = deepScanResults.filter(r => r.suggestion && !r.isUnbuilt);
    if (fixable.length === 0) return;
    const fd = new FormData();
    fd.append("intent", "fixPageLinks");
    fd.append("fixes", JSON.stringify(fixable));
    fetcher.submit(fd, { method: "post" });
  };

  const handleOpenCreator = () => {
    setActiveMenu(null);
    setIsCreatingMenu(true);
  };

  const handleCancelCreator = () => {
    setIsCreatingMenu(false);
  };

  const activeCounts = scanned && activeMenu ? countByStatus(menuItems, liveCollectionHandles, livePageHandles) : null;
  const shouldCalculateOrphanCollections = scanned && activeMenu?.handle === "footer";
  
  let orphanedCollections = [];
  if (shouldCalculateOrphanCollections) {
    const activeUrls = new Set();
    menuItems.forEach(item => {
      activeUrls.add(item.url);
      (item.items || []).forEach(child => activeUrls.add(child.url));
    });
    orphanedCollections = collections.filter(c => !activeUrls.has(`/collections/${c.handle}`));
  }

  const actionBtnStyle = {
    background: "none", border: "none", cursor: isLocked ? "not-allowed" : "pointer",
    fontSize: "16px", color: isLocked ? "#a6a6a6" : "#5c5f62",
    minHeight: "48px", minWidth: "48px", display: "flex", alignItems: "center", justifyContent: "center"
  };
  const dragBtnStyle = { ...actionBtnStyle, cursor: isLocked ? "not-allowed" : "grab" };
  const deleteBtnStyle = { ...actionBtnStyle, color: isLocked ? "#a6a6a6" : "#d72c0d" };

  return (
    <Page
      title="Menu Manager 🗂️"
      subtitle="Link Governance — Nav Audit & Repair"
      backAction={{
        content: "Back",
        onAction: () => navigate("/app"),
        accessibilityLabel: "Navigate back to Command Center",
      }}
      primaryAction={{
        content: "🔍 Scan All Menus",
        onAction: handleGlobalScan,
        accessibilityLabel: "Execute global scan across all store menus"
      }}
    >
      <Layout>

        {globalTotals && (
          <Layout.Section>
            <Card background="bg-surface-secondary">
              <BlockStack gap="300" align="center" inlineAlign="center">
                <Text variant="headingMd" as="h2">Global Menu Diagnostics</Text>
                <InlineStack gap="300">
                  <Badge tone="success">🟢 {globalTotals.live} Live</Badge>
                  {globalTotals.stale > 0 && <Badge tone="warning">🟠 {globalTotals.stale} Stale Handles</Badge>}
                  {globalTotals.draft > 0 && <Badge tone="warning">🟡 {globalTotals.draft} Draft/Unverified</Badge>}
                  {globalTotals.dead > 0 && <Badge tone="critical">🔴 {globalTotals.dead} Dead</Badge>}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">

            {!allStoriesMenuExists && (
              <Card background="bg-surface-info">
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">Automated Menu Builder</Text>
                  <Text as="p" tone="subdued">Generate an "All Stories" menu populated with every page containing images.</Text>
                  <Button 
                    size="large" 
                    variant="primary" 
                    onClick={handleCreateAllStoriesMenu}
                    loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "createAllStoriesMenu"}
                    aria-label="Create All Stories Menu automatically"
                  >
                    Create All Stories Menu
                  </Button>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h3">Your Menus</Text>
                  <Button icon={PlusIcon} size="large" onClick={handleOpenCreator} aria-label="Create a new store menu">Create Menu</Button>
                </InlineStack>
                <Divider />
                {displayMenus.map((menu) => {
                  const counts = globalScan?.[menu.id];
                  const setting = dbSettings?.find(s => s.menuHandle === menu.handle);
                  const menuIsLocked = menu.handle === "main-menu" && setting?.isLocked;

                  return (
                    <Box
                      key={menu.id}
                      padding="300"
                      background={activeMenu?.id === menu.id ? "bg-surface-active" : "bg-surface"}
                      borderWidth="025"
                      borderColor="border"
                      borderRadius="100"
                      onClick={() => handleSelectMenu(menu)}
                      style={{ cursor: "pointer", minHeight: "48px" }}
                      role="button"
                      aria-label={`Edit ${menu.title} menu`}
                    >
                      <BlockStack gap="100">
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Text fontWeight={activeMenu?.id === menu.id ? "bold" : "regular"} as="span">
                              {menu.title}
                            </Text>
                            {menuIsLocked && <Badge tone="info">Locked</Badge>}
                          </InlineStack>
                          <Badge tone="info">{menu.items.length} Links</Badge>
                        </InlineStack>
                        {counts && (
                          <InlineStack gap="100">
                            <Badge tone="success">🟢 {counts.live}</Badge>
                            {counts.stale > 0 && <Badge tone="warning">🟠 {counts.stale}</Badge>}
                            {counts.draft > 0 && <Badge tone="warning">🟡 {counts.draft}</Badge>}
                            {counts.dead > 0 && <Badge tone="critical">🔴 {counts.dead}</Badge>}
                          </InlineStack>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </BlockStack>
            </Card>

            {scanned && unlinkedPages.length > 0 && (
              <Card>
                <BlockStack gap="300">
                  <BlockStack>
                    <Text variant="headingSm" tone="warning" as="h3">True Orphans</Text>
                    <Text variant="bodySm" tone="subdued" as="p">Pages existing in Shopify but not linked in any navigational menu.</Text>
                  </BlockStack>
                  <Box style={{ maxHeight: "300px", overflowY: "auto" }}>
                    <BlockStack gap="200">
                      {unlinkedPages.map(p => {
                        const hasImages = p.body && /<img[^>]+>/i.test(p.body);
                        return (
                          <InlineStack key={p.id} align="space-between" blockAlign="center">
                            <Badge tone="info">{p.title}</Badge>
                            {hasImages && (
                              <Button 
                                size="large"
                                onClick={() => handleAssignOrphanToStories(p)}
                                aria-label={`Add orphaned page ${p.title} to All Stories menu`}
                              >
                                Add to All Stories
                              </Button>
                            )}
                          </InlineStack>
                        );
                      })}
                    </BlockStack>
                  </Box>
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack>
                    <Text variant="headingSm" as="h3">Deep Link Scanner</Text>
                    <Text variant="bodySm" tone="subdued" as="p">Scans page body content for broken internal links.</Text>
                  </BlockStack>
                  <InlineStack gap="300" blockAlign="center">
                    {isDeepScanning && (
                      <Text tone="subdued" variant="bodySm" as="span">
                        Scanning {scanProgress} / {Math.max(scanProgress, pages.length)}...
                      </Text>
                    )}
                    <Button size="large" onClick={handleStartDeepScan} loading={isDeepScanning} aria-label="Start deep scanning for broken body content links">
                      Scan Content
                    </Button>
                  </InlineStack>
                </InlineStack>
                
                {deepScanResults !== null && !isDeepScanning && (
                  <Box paddingBlockStart="200">
                    {deepScanResults.length === 0 ? (
                      <Banner tone="success">All internal links are healthy ✅</Banner>
                    ) : (
                      <BlockStack gap="300">
                        <InlineStack align="space-between" blockAlign="center">
                          <Badge tone="critical">{deepScanResults.length} broken links found</Badge>
                          {deepScanResults.some(r => r.suggestion && !r.isUnbuilt) && (
                            <Button 
                              onClick={handleFixAll} 
                              icon={CheckIcon}
                              aria-label="Accept all available link fixes"
                            >
                              Fix All
                            </Button>
                          )}
                        </InlineStack>
                        <List type="bullet">
                          {deepScanResults.map((err, i) => (
                            <List.Item key={i}>
                              <BlockStack gap="100">
                                <Text fontWeight="bold" as="span">{err.sourcePage}</Text>
                                <InlineStack wrap gap="100" blockAlign="center">
                                  <Text tone="critical" as="span">/{err.brokenType}/{err.brokenHandle}</Text>
                                  {err.isUnbuilt && <Badge tone="info">Page Not Built Yet</Badge>}
                                  {err.isStale && <Badge tone="warning">Stale Handle</Badge>}
                                  {!err.isUnbuilt && !err.isStale && <Badge tone="critical">Dead Link</Badge>}
                                </InlineStack>
                                {err.suggestion && !err.isUnbuilt && (
                                  <InlineStack blockAlign="center" gap="200">
                                    <Text tone="success" variant="bodySm" as="span">
                                      → Suggestion: {err.suggestion}
                                    </Text>
                                    <Button 
                                      size="micro" 
                                      variant="plain" 
                                      icon={ReplaceIcon}
                                      onClick={() => handleAcceptFix(err)}
                                      aria-label={`Fix link to ${err.suggestion}`}
                                    >
                                      Accept Fix
                                    </Button>
                                  </InlineStack>
                                )}
                              </BlockStack>
                            </List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    )}
                  </Box>
                )}
              </BlockStack>
            </Card>

            {fetcher.data?.message && <Banner tone="success">{fetcher.data.message}</Banner>}
            {fetcher.data?.error && <Banner tone="critical">{fetcher.data.error}</Banner>}
          </BlockStack>
        </Layout.Section>

        <Layout.Section>
          {isCreatingMenu ? (
            <MenuCreator pages={pages} fetcher={fetcher} onCancel={handleCancelCreator} collectionHandles={collectionHandles} />
          ) : !activeMenu ? (
            <Card>
              <Box padding="800" textAlign="center">
                <Text variant="headingLg" tone="subdued" as="h2">Select a menu on the left to start editing, or create a new one.</Text>
              </Box>
            </Card>
          ) : (
            <BlockStack gap="400">

              <InlineStack align="end">
                <Button
                  variant="primary"
                  size="large"
                  onClick={handleSaveMenu}
                  loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu"}
                  disabled={isLocked}
                  aria-label="Save current menu configuration"
                >
                  Save Menu
                </Button>
              </InlineStack>

              {isLocked && (
                <Banner tone="warning" title="Main Menu is Locked">
                  <Text as="p">This menu is structurally locked to prevent accidental modifications. Unlock it using the button below to enable editing controls.</Text>
                </Banner>
              )}

              {activeCounts && (
                <Banner tone={activeCounts.dead > 0 ? "critical" : (activeCounts.stale > 0 ? "warning" : "success")}>
                  <Text as="p">
                    Scan complete — 🟢 {activeCounts.live} live &nbsp;|&nbsp;
                    {activeCounts.stale > 0 && `🟠 ${activeCounts.stale} stale  | `}
                    🟡 {activeCounts.draft} draft/unverified &nbsp;|&nbsp;
                    🔴 {activeCounts.dead} dead
                  </Text>
                </Banner>
              )}

              {shouldCalculateOrphanCollections && orphanedCollections.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" tone="critical" as="h3">Orphaned Collections — not in this menu</Text>
                    <InlineStack gap="200" wrap>
                      {orphanedCollections.map(c => (
                        <Badge key={c.id} tone="warning">{c.title}</Badge>
                      ))}
                    </InlineStack>
                  </BlockStack>
                </Card>
              )}

              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm" as="h3">✨ Quick Actions</Text>
                  <InlineStack gap="200" wrap>
                    {activeMenu.handle === "footer" && (
                      <Button size="large" icon={MagicIcon} onClick={autoFillCollections} disabled={isLocked} aria-label="Auto fill missing collections">🪄 Auto-Fill Missing Collections</Button>
                    )}
                    <Button size="large" icon={AlertTriangleIcon} onClick={autoCleanDeadLinks} disabled={isLocked} aria-label="Remove dead links from menu">🧹 Remove Dead Links</Button>
                    <Button size="large" onClick={handleScan} aria-label="Scan current active menu">🔍 Scan This Menu</Button>
                  </InlineStack>
                  {activeMenu.handle === "footer" && (
                    <Box paddingBlockStart="200">
                      <Checkbox
                        label="Auto-sync collections to footer"
                        checked={autoSyncFooter}
                        onChange={handleAutoSyncChange}
                        helpText="Automatically injects new collections when created in Shopify."
                        aria-label="Toggle auto sync collections to footer menu checkbox"
                      />
                    </Box>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="500">
                  <TextField
                    label="Menu Title"
                    value={menuTitle}
                    onChange={setMenuTitle}
                    autoComplete="off"
                    disabled={isLocked}
                    aria-label="Input field for editing current menu title"
                  />

                  <Box padding="400" borderRadius="200" borderWidth="025" borderColor="border">
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <InlineStack gap="300" blockAlign="center">
                          <Text variant="headingSm" as="h3">Menu Links ({menuItems.length})</Text>
                          {activeMenu.handle === "main-menu" && (
                            <Button size="large" onClick={toggleLock} loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "toggleLock"} aria-label="Toggle menu lock status">
                              {isLocked ? "🔓 Unlock Menu" : "🔒 Lock Menu"}
                            </Button>
                          )}
                        </InlineStack>
                        <Button size="large" icon={PlusIcon} variant="primary" onClick={handleAddLink} disabled={isLocked} aria-label="Add new parent link to menu">Add Link</Button>
                      </InlineStack>

                      {menuItems.map((item, index) => {
                        const status = scanned
                          ? getDestinationStatus(item.url, liveCollectionHandles, livePageHandles)
                          : null;
                        
                        return (
                          <div 
                            key={item.id}
                            draggable={!isLocked}
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => handleDrop(e, item.id)}
                          >
                            <Card background="bg-surface">
                              <BlockStack gap="300">
                                
                                {/* PARENT LINK */}
                                <BlockStack gap="200">
                                  <InlineStack align="space-between" blockAlign="center">
                                    <InlineStack gap="200" blockAlign="center">
                                      <div style={dragBtnStyle} title="Drag to reorder" aria-hidden="true">
                                        <Icon source={DragHandleIcon} tone="base" />
                                      </div>
                                      {status ? <StatusBadge status={status} /> : <Badge tone="info">Not scanned</Badge>}
                                      {status === "dead" && !isLocked && (
                                        <Button size="large" onClick={(e) => handleFixIt(e, item.id)} aria-label={`Fix dead link for ${item.title}`}>Fix It</Button>
                                      )}
                                    </InlineStack>
                                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                      <button disabled={index === 0 || isLocked} onClick={(e) => handleMoveLink(e, index, "up")} style={actionBtnStyle} title="Move Up" aria-label={`Move link ${item.title} up`}>↑</button>
                                      <button disabled={index === menuItems.length - 1 || isLocked} onClick={(e) => handleMoveLink(e, index, "down")} style={actionBtnStyle} title="Move Down" aria-label={`Move link ${item.title} down`}>↓</button>
                                      <button disabled={isLocked} onClick={(e) => handleDeleteLink(e, item.id)} style={deleteBtnStyle} title="Delete link" aria-label={`Delete link ${item.title}`}>✕</button>
                                    </div>
                                  </InlineStack>
                                  
                                  <InlineStack blockAlign="end" gap="300" wrap>
                                    <div style={{ flex: 1, minWidth: "140px" }}>
                                      <TextField
                                        label="Display Name"
                                        value={item.title}
                                        onChange={(v) => handleUpdateLink(item.id, "title", v)}
                                        autoComplete="off"
                                        disabled={isLocked}
                                        aria-label={`Input field for link display name ${item.title}`}
                                      />
                                    </div>
                                    <div style={{ flex: 1, minWidth: "180px" }}>
                                      <Select
                                        id={`quick-select-${item.id}`}
                                        label="Quick Select"
                                        options={linkOptions}
                                        value={linkOptions.find(o => o.value === item.url) ? item.url : "custom"}
                                        onChange={(v) => v !== "custom" && handleUpdateLink(item.id, "url", v)}
                                        disabled={isLocked}
                                        aria-label={`Quick select destination for link ${item.title}`}
                                      />
                                    </div>
                                    <div style={{ flex: 1, minWidth: "180px" }}>
                                      <TextField
                                        label="URL Path"
                                        value={item.url}
                                        onChange={(v) => handleUpdateLink(item.id, "url", v)}
                                        autoComplete="off"
                                        disabled={isLocked}
                                        aria-label={`Input field for URL path for link ${item.title}`}
                                        error={
                                          scanned ? (status === "dead" ? "Dead link — destination not found" : (status === "stale" ? "Stale handle" : undefined)) : undefined
                                        }
                                      />
                                    </div>
                                  </InlineStack>
                                </BlockStack>

                                {/* SUB-LINKS SECTION */}
                                <Box paddingInlineStart="400" borderWidth="0" borderInlineStartWidth="025" borderColor="border">
                                  <BlockStack gap="400">
                                    {(item.items || []).map((child, childIndex) => {
                                      const childStatus = scanned
                                        ? getDestinationStatus(child.url, liveCollectionHandles, livePageHandles)
                                        : null;

                                      return (
                                        <div 
                                          key={child.id}
                                          draggable={!isLocked}
                                          onDragStart={(e) => handleDragStart(e, child.id, item.id)}
                                          onDragOver={(e) => e.preventDefault()}
                                          onDrop={(e) => handleDrop(e, child.id, item.id)}
                                        >
                                          <BlockStack gap="200">
                                            <InlineStack align="space-between" blockAlign="center">
                                              <InlineStack gap="200" blockAlign="center">
                                                <div style={dragBtnStyle} title="Drag to reorder" aria-hidden="true">
                                                  <Icon source={DragHandleIcon} tone="base" />
                                                </div>
                                                {childStatus ? <StatusBadge status={childStatus} /> : <Badge tone="info">Not scanned</Badge>}
                                                {childStatus === "dead" && !isLocked && (
                                                  <Button size="large" onClick={(e) => handleFixIt(e, child.id)} aria-label={`Fix dead sub-link for ${child.title}`}>Fix It</Button>
                                                )}
                                              </InlineStack>
                                              <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                                <button disabled={childIndex === 0 || isLocked} onClick={(e) => handleMoveSubLink(e, index, childIndex, "up")} style={actionBtnStyle} title="Move Up" aria-label={`Move sub-link ${child.title} up`}>↑</button>
                                                <button disabled={childIndex === (item.items || []).length - 1 || isLocked} onClick={(e) => handleMoveSubLink(e, index, childIndex, "down")} style={actionBtnStyle} title="Move Down" aria-label={`Move sub-link ${child.title} down`}>↓</button>
                                                <button disabled={isLocked} onClick={(e) => handleDeleteSubLink(e, item.id, child.id)} style={deleteBtnStyle} title="Delete sub-link" aria-label={`Delete sub-link ${child.title}`}>✕</button>
                                              </div>
                                            </InlineStack>
                                            
                                            <InlineStack blockAlign="end" gap="300" wrap>
                                              <div style={{ flex: 1, minWidth: "140px" }}>
                                                <TextField
                                                  label="Sub-link Name"
                                                  value={child.title}
                                                  onChange={(v) => handleUpdateSubLink(item.id, child.id, "title", v)}
                                                  autoComplete="off"
                                                  disabled={isLocked}
                                                  aria-label={`Input field for sub-link display name ${child.title}`}
                                                />
                                              </div>
                                              <div style={{ flex: 1, minWidth: "180px" }}>
                                                <Select
                                                  id={`quick-select-${child.id}`}
                                                  label="Quick Select"
                                                  options={linkOptions}
                                                  value={linkOptions.find(o => o.value === child.url) ? child.url : "custom"}
                                                  onChange={(v) => v !== "custom" && handleUpdateSubLink(item.id, child.id, "url", v)}
                                                  disabled={isLocked}
                                                  aria-label={`Quick select destination for sub-link ${child.title}`}
                                                />
                                              </div>
                                              <div style={{ flex: 1, minWidth: "180px" }}>
                                                <TextField
                                                  label="URL Path"
                                                  value={child.url}
                                                  onChange={(v) => handleUpdateSubLink(item.id, child.id, "url", v)}
                                                  autoComplete="off"
                                                  disabled={isLocked}
                                                  aria-label={`Input field for URL path for sub-link ${child.title}`}
                                                  error={
                                                    scanned ? (childStatus === "dead" ? "Dead link — destination not found" : (childStatus === "stale" ? "Stale handle" : undefined)) : undefined
                                                  }
                                                />
                                              </div>
                                            </InlineStack>
                                          </BlockStack>
                                        </div>
                                      );
                                    })}
                                    <InlineStack>
                                      <Button size="large" icon={PlusIcon} onClick={() => handleAddSubLink(item.id)} disabled={isLocked} aria-label={`Add new sub-link under ${item.title}`}>Add Sub-link</Button>
                                    </InlineStack>
                                  </BlockStack>
                                </Box>

                              </BlockStack>
                            </Card>
                          </div>
                        );
                      })}
                    </BlockStack>
                  </Box>

                  <InlineStack align="end">
                    <Button
                      variant="primary"
                      size="large"
                      onClick={handleSaveMenu}
                      loading={fetcher.state === "submitting" && fetcher.formData?.get("intent") === "updateMenu"}
                      disabled={isLocked}
                      aria-label="Save current menu configuration"
                    >
                      Save Menu
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>

              {activeMenuHistory.length > 0 && (
                <Card>
                  <BlockStack gap="300">
                    <Text variant="headingSm" as="h3">Change History</Text>
                    <List type="bullet">
                      {activeMenuHistory.map((entry) => (
                        <List.Item key={entry.id}>
                          <Text tone="subdued" as="span">
                            {new Date(entry.createdAt).toLocaleString()} — {entry.message}
                          </Text>
                        </List.Item>
                      ))}
                    </List>
                  </BlockStack>
                </Card>
              )}

            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
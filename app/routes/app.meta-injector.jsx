// 1. THE ISOLATED CARD ENGINE
function ProductCollectionCard({ product, collections }) {
  // We give EVERY card its own private fetcher!
  const fetcher = useFetcher(); 
  const [manualAssign, setManualAssign] = useState("");

  const handleAssign = (productId, collectionId) => {
    if (!collectionId) return;
    const fd = new FormData();
    fd.append("intent", "assignCollection");
    fd.append("productId", productId);
    fd.append("collectionId", collectionId);
    fetcher.submit(fd, { method: "post" });
  };

  const suggestions = suggestCollections(product, collections);
  const currentNames = product.currentCollections.map((c) => c.title).join(", ") || "None";

  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="300" blockAlign="center">
          <img
            src={product.featuredImage?.url || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_medium.png"}
            alt={product.title}
            style={{ width: "56px", height: "56px", objectFit: "cover", borderRadius: "6px" }}
          />
          <BlockStack gap="100">
            <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
            <Text variant="bodySm" tone="subdued">Currently in: {currentNames}</Text>
          </BlockStack>
        </InlineStack>

        {suggestions.length > 0 && (
          <BlockStack gap="100">
            <Text variant="bodySm" fontWeight="semibold">Suggested:</Text>
            {suggestions.map((s, i) => {
              const targetCollectionId = s.id || collections.find((c) => c.title === s.name)?.id;
              const isAlreadyAssigned = product.currentCollections.some(c => c.id === targetCollectionId);

              return (
                <InlineStack key={i} gap="200" blockAlign="center">
                  <Badge tone="info">{s.name}</Badge>
                  <Text variant="bodySm" tone="subdued">{s.reason}</Text>
                  {targetCollectionId && (
                    isAlreadyAssigned ? (
                      <Badge tone="success">Already Assigned</Badge>
                    ) : (
                      <Button
                        size="slim"
                        onClick={() => handleAssign(product.id, targetCollectionId)}
                        loading={fetcher.state === "submitting"}
                        variant="primary" // Turned the Auto-Assign button green for you!
                        tone="success"
                      >
                        Assign
                      </Button>
                    )
                  )}
                </InlineStack>
              );
            })}
          </BlockStack>
        )}

        {suggestions.length === 0 && (
          <Text variant="bodySm" tone="caution">No auto-suggestion — use manual assign below.</Text>
        )}

        {/* Manual assign */}
        <InlineStack gap="200" blockAlign="end">
          <div style={{ flex: 1 }}>
            <Select
              label="Manual assign"
              options={[
                { label: "-- Pick a collection --", value: "" },
                ...collections.map((c) => ({ label: c.title, value: c.id })),
              ]}
              value={manualAssign}
              onChange={setManualAssign}
            />
          </div>
          <Button
            variant="primary"
            disabled={!manualAssign}
            onClick={() => handleAssign(product.id, manualAssign)}
            loading={fetcher.state === "submitting"}
          >
            Assign
          </Button>
        </InlineStack>

        {/* ISOLATED BANNERS: These will strictly only light up for THIS card now */}
        {fetcher.data?.ok && fetcher.data?.intent === "assignCollection" && (
          <Banner tone="success">Assigned successfully!</Banner>
        )}
        {fetcher.data?.ok === false && fetcher.data?.intent === "assignCollection" && (
          <Banner tone="critical">{fetcher.data.error || "Assignment failed."}</Banner>
        )}
      </BlockStack>
    </Card>
  );
}

// 2. THE CLEANED UP TAB
function CollectionsTab({ products, collections, fetcher }) {
  const [newCollTitle, setNewCollTitle] = useState("");
  const [editId, setEditId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleCreate = () => {
    if (!newCollTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "createCollection");
    fd.append("title", newCollTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setNewCollTitle("");
  };

  const handleEdit = (id) => {
    if (!editTitle.trim()) return;
    const fd = new FormData();
    fd.append("intent", "editCollection");
    fd.append("id", id);
    fd.append("title", editTitle.trim());
    fetcher.submit(fd, { method: "post" });
    setEditId(null);
    setEditTitle("");
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    const fd = new FormData();
    fd.append("intent", "deleteCollection");
    fd.append("id", deleteTarget.id);
    fetcher.submit(fd, { method: "post" });
    setDeleteTarget(null);
  };

  return (
    <BlockStack gap="500">
      {/* Create new collection */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">➕ Create New Collection</Text>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flex: 1 }}>
              <TextField
                label="Collection name"
                value={newCollTitle}
                onChange={setNewCollTitle}
                placeholder="e.g. Jasper, Freeforms, Display..."
                autoComplete="off"
              />
            </div>
            <Button variant="primary" onClick={handleCreate} disabled={!newCollTitle.trim()}>
              Create
            </Button>
          </InlineStack>
          {fetcher.data?.ok && fetcher.data?.intent === "createCollection" && (
            <Banner tone="success">Collection created!</Banner>
          )}
          {fetcher.data?.ok === false && fetcher.data?.intent === "createCollection" && (
            <Banner tone="critical">{fetcher.data.error || "Could not create collection."}</Banner>
          )}
        </BlockStack>
      </Card>

      {/* Existing collections — edit and delete */}
      <Card>
        <BlockStack gap="300">
          <Text variant="headingMd">🗂️ Existing Collections</Text>
          {collections.map((c) => (
            <InlineStack key={c.id} align="space-between" blockAlign="center" gap="300">
              {editId === c.id ? (
                <>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label=""
                      value={editTitle}
                      onChange={setEditTitle}
                      autoComplete="off"
                    />
                  </div>
                  <Button variant="primary" onClick={() => handleEdit(c.id)}>Save</Button>
                  <Button onClick={() => setEditId(null)}>Cancel</Button>
                </>
              ) : (
                <>
                  <Text variant="bodyMd">{c.title}</Text>
                  <InlineStack gap="200">
                    <Button size="slim" onClick={() => { setEditId(c.id); setEditTitle(c.title); }}>Edit</Button>
                    <Button size="slim" tone="critical" onClick={() => setDeleteTarget(c)}>Delete</Button>
                  </InlineStack>
                </>
              )}
            </InlineStack>
          ))}
          {fetcher.data?.ok && fetcher.data?.intent === "editCollection" && (
            <Banner tone="success">Collection updated!</Banner>
          )}
          {fetcher.data?.ok && fetcher.data?.intent === "deleteCollection" && (
            <Banner tone="success">Collection deleted.</Banner>
          )}
        </BlockStack>
      </Card>

      {/* Delete confirm */}
      {deleteTarget && (
        <Banner tone="critical">
          <BlockStack gap="200">
            <Text>Delete "{deleteTarget.title}"? This cannot be undone.</Text>
            <InlineStack gap="200">
              <Button tone="critical" variant="primary" onClick={handleDelete}>Yes, Delete</Button>
              <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
            </InlineStack>
          </BlockStack>
        </Banner>
      )}

      {/* Product auto-assign */}
      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd">🪨 Auto-Assign Products to Collections</Text>
          {products.map((product) => (
            /* EVERY CARD GETS ITS OWN CIRCUIT NOW */
            <ProductCollectionCard key={product.id} product={product} collections={collections} />
          ))}
        </BlockStack>
      </Card>
    </BlockStack>
  );
}
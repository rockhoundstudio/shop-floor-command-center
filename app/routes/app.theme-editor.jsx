import { useState, useEffect, useCallback, useRef } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation, useNavigate } from "react-router";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, List, Button, TextField,
  Tabs, Badge, Box, Divider, Banner, Scrollable, Modal, Select, FormLayout, ButtonGroup
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const THEME_ID = "158876434683";

const PINNED_FILES = [
  "config/settings_schema.json",
  "config/settings_data.json",
  "layout/theme.liquid",
  "sections/header.liquid",
  "sections/footer.liquid",
];

const FOLDERS = ["sections", "snippets", "templates", "assets", "config"];

// ── SERVER LOADER ────────────────────────────────────────────────────────────
export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  
  try {
    const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Shopify API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    return Response.json({ files: data.assets ? data.assets : [] });
  } catch (error) {
    console.error("Failed to load theme assets:", error);
    return Response.json({ files: [], error: `Failed to load theme files: ${error.message}` });
  }
};

// ── SERVER ACTION ────────────────────────────────────────────────────────────
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const assetKey = formData.get("assetKey");
  const timestamp = Date.now(); 

  try {
    if (intent === "fetchAsset") {
      const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!response.ok) throw new Error("Failed to fetch asset content.");
      
      const data = await response.json();
      return Response.json({ intent, assetKey, content: data.asset?.value ? data.asset.value : "", timestamp });
    }

    if (intent === "saveAsset" || intent === "createAsset" || intent === "duplicateAsset") {
      const content = formData.get("content");
      const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          asset: { key: assetKey, value: content },
        }),
      });
      
      if (!response.ok) throw new Error(`Failed to save asset: ${assetKey}`);
      
      return Response.json({ intent, assetKey, content, success: true, message: `Saved ${assetKey} successfully.`, timestamp });
    }

    if (intent === "deleteAsset") {
      const response = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!response.ok) throw new Error(`Failed to delete asset: ${assetKey}`);
      
      return Response.json({ intent, assetKey, success: true, message: `Deleted ${assetKey} successfully.`, timestamp });
    }

    if (intent === "renameAsset") {
      const newKey = formData.get("newKey");
      const content = formData.get("content");

      const createResponse = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          asset: { key: newKey, value: content },
        }),
      });

      if (!createResponse.ok) throw new Error("Failed to create new file during rename.");

      const deleteResponse = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
      });

      if (!deleteResponse.ok) throw new Error("Created new file but failed to delete original.");

      return Response.json({ intent, assetKey: newKey, content, success: true, message: `Renamed to ${newKey}.`, timestamp });
    }

    if (intent === "populateMosaic") {
      // 1. Debug Step: Fetch index.json asset using raw fetch FIRST
      const assetRes = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json?asset[key]=templates/index.json`, {
        method: "GET",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }
      });
      const assetData = await assetRes.json();
      if (!assetData.asset?.value) throw new Error("Could not load templates/index.json");

      const templateData = JSON.parse(assetData.asset.value);

      // 2. Debug Step: Extract and console.log section types
      const foundSectionTypes = Object.values(templateData.sections).map(s => s.type);
      console.log("DEBUG: Homepage Section Types:", foundSectionTypes);

      // 3. Find Hero Living Mosaic Section
      let targetSectionKey = null;
      let targetSection = null;

      for (const [key, section] of Object.entries(templateData.sections)) {
        if (section.type === 'hero-living-mosaic') {
          targetSectionKey = key;
          targetSection = section;
          break;
        }
      }

      if (!targetSection) {
        return Response.json({ 
          intent, 
          error: "Hero Living Mosaic section not found on homepage template.", 
          debugTypes: foundSectionTypes,
          timestamp 
        });
      }

      // 4. Fetch Collections using raw fetch
      const collectionsRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({
          query: `query { collections(first: 50, query: "published_status:published") { edges { node { handle } } } }`
        })
      });
      const collectionsData = await collectionsRes.json();
      const collections = collectionsData.data.collections.edges.map(e => e.node.handle);

      // 5. Fetch Pages using raw fetch
      const pagesRes = await fetch(`https://${shop}/admin/api/2024-10/graphql.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({
          query: `query { pages(first: 50, query: "published_status:published") { edges { node { handle } } } }`
        })
      });
      const pagesData = await pagesRes.json();
      const pages = pagesData.data.pages.edges.map(e => e.node.handle);

      // 6. Generate New Blocks
      const newBlocks = {};
      const newBlockOrder = [];

      collections.forEach((handle, index) => {
        const blockId = `stone_collection_${index}`;
        newBlocks[blockId] = {
          type: "stone_collection",
          settings: { collection: handle }
        };
        newBlockOrder.push(blockId);
      });

      pages.forEach((handle, index) => {
        const blockId = `story_page_${index}`;
        newBlocks[blockId] = {
          type: "story_page",
          settings: { page: handle }
        };
        newBlockOrder.push(blockId);
      });

      // 7. Update Section in Template
      targetSection.blocks = {
        ...targetSection.blocks,
        ...newBlocks
      };
      targetSection.block_order = [
        ...(targetSection.block_order || []),
        ...newBlockOrder
      ];

      templateData.sections[targetSectionKey] = targetSection;

      // 8. POST updated template back to the theme using raw fetch
      const saveRes = await fetch(`https://${shop}/admin/api/2024-10/themes/${THEME_ID}/assets.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken },
        body: JSON.stringify({
          asset: {
            key: "templates/index.json",
            value: JSON.stringify(templateData)
          }
        })
      });

      if (!saveRes.ok) throw new Error("Failed to save populated index.json to theme.");

      return Response.json({ 
        intent, 
        success: true, 
        message: "Successfully populated the Living Mosaic wall!", 
        debugTypes: foundSectionTypes,
        timestamp 
      });
    }

    if (intent === "geminiAssist") {
      const content = formData.get("content");
      const instruction = formData.get("instruction");
      const apiKey = process.env.GEMINI_API_KEY;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: `You are a Shopify Liquid and theme architecture expert.\nFile: ${assetKey}\n\nCurrent file content:\n${content}\n\nInstruction: ${instruction}\n\nReturn only the complete modified file content, no explanation.` }] }] }),
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const modifiedContent = data.candidates?.[0]?.content?.parts?.[0]?.text ? data.candidates[0].content.parts[0].text : content;
        return Response.json({ intent, assetKey, modifiedContent, timestamp });
      } catch (error) {
        clearTimeout(timeoutId);
        throw new Error(`Gemini Assist failed: ${error.message}`);
      }
    }

    if (intent === "geminiResearch") {
      const content = formData.get("content");
      const apiKey = process.env.GEMINI_API_KEY;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({ contents: [{ parts: [{ text: `You are a Shopify Liquid and theme architecture expert.\nCatalog all schema settings and blocks in this file: ${assetKey}\n\nFile content:\n${content}\n\nReturn a structured list of all settings IDs, types, labels, and blocks found.` }] }] }),
        });
        clearTimeout(timeoutId);
        const data = await res.json();
        const researchContent = data.candidates?.[0]?.content?.parts?.[0]?.text ? data.candidates[0].content.parts[0].text : "No results returned.";
        return Response.json({ intent, assetKey, researchContent, timestamp });
      } catch (error) {
        clearTimeout(timeoutId);
        throw new Error(`Gemini Research failed: ${error.message}`);
      }
    }

    return Response.json({ error: "Invalid intent", timestamp }, { status: 400 });

  } catch (error) {
    console.error("Action error:", error);
    return Response.json({ error: error.message, timestamp }, { status: 500 });
  }
};

// ── REACT COMPONENT ──────────────────────────────────────────────────────────
export default function ThemeEditorTab() {
  const loaderData = useLoaderData();
  const files = loaderData?.files ? loaderData.files : [];
  const loaderError = loaderData?.error;
  
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [originalContent, setOriginalContent] = useState("");
  const [currentContent, setCurrentContent] = useState("");
  
  const [showDiff, setShowDiff] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [researchData, setResearchData] = useState("");

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const [newFileName, setNewFileName] = useState("");
  const [newFileType, setNewFileType] = useState("sections");
  const [renameInput, setRenameInput] = useState("");
  const [duplicateInput, setDuplicateInput] = useState("");

  const lastProcessedActionRef = useRef(null);

  const isNavigating = navigation.state !== "idle";
  const hasChanges = currentContent !== originalContent;
  const isSaving = isNavigating ? navigation.formData?.get("intent") === "saveAsset" : false;
  const isAssisting = isNavigating ? navigation.formData?.get("intent") === "geminiAssist" : false;
  const isResearching = isNavigating ? navigation.formData?.get("intent") === "geminiResearch" : false;
  const isPopulating = isNavigating ? navigation.formData?.get("intent") === "populateMosaic" : false;

  useEffect(() => {
    if (actionData) {
      if (actionData.timestamp !== lastProcessedActionRef.current) {
        lastProcessedActionRef.current = actionData.timestamp;

        if (actionData.intent === "fetchAsset") {
          setOriginalContent(actionData.content);
          setCurrentContent(actionData.content);
          setResearchData("");
        } else if (actionData.success) {
          shopify.toast.show(actionData.message);
          
          if (actionData.intent === "saveAsset") {
            setOriginalContent(actionData.content);
            setShowDiff(false);
          } else if (actionData.intent === "createAsset" || actionData.intent === "duplicateAsset") {
            setSelectedFile(actionData.assetKey);
            setOriginalContent(actionData.content);
            setCurrentContent(actionData.content);
            setIsNewModalOpen(false);
            setIsDuplicateModalOpen(false);
          } else if (actionData.intent === "renameAsset") {
            setSelectedFile(actionData.assetKey);
            setOriginalContent(actionData.content);
            setIsRenameModalOpen(false);
          } else if (actionData.intent === "deleteAsset") {
            setSelectedFile(null);
            setCurrentContent("");
            setOriginalContent("");
            setIsDeleteModalOpen(false);
          }
        } else if (actionData.intent === "geminiAssist") {
          setCurrentContent(actionData.modifiedContent);
          setShowDiff(true);
          shopify.toast.show("Gemini modifications applied to editor.");
        } else if (actionData.intent === "geminiResearch") {
          setResearchData(actionData.researchContent);
          shopify.toast.show("Research complete.");
        }
      }
    }
  }, [actionData]);

  const handleSelectFile = useCallback((key) => {
    setSelectedFile(key);
    submit({ intent: "fetchAsset", assetKey: key }, { method: "post" });
  }, [submit]);

  const handleSave = useCallback(() => {
    if (!selectedFile) return;
    submit({ intent: "saveAsset", assetKey: selectedFile, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, currentContent]);

  const handleCreateNew = useCallback(() => {
    const fullKey = `${newFileType}/${newFileName}.liquid`;
    submit({ intent: "createAsset", assetKey: fullKey, content: "" }, { method: "post" });
  }, [submit, newFileType, newFileName]);

  const handleRename = useCallback(() => {
    submit({ intent: "renameAsset", assetKey: selectedFile, newKey: renameInput, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, renameInput, currentContent]);

  const handleDelete = useCallback(() => {
    submit({ intent: "deleteAsset", assetKey: selectedFile }, { method: "post" });
  }, [submit, selectedFile]);

  const handleDuplicate = useCallback(() => {
    submit({ intent: "duplicateAsset", assetKey: duplicateInput, content: currentContent }, { method: "post" });
  }, [submit, duplicateInput, currentContent]);

  const handleDiscard = useCallback(() => {
    setCurrentContent(originalContent);
  }, [originalContent]);

  const handleGeminiAssist = useCallback(() => {
    if (!instruction.trim()) {
      shopify.toast.show("Please enter an instruction for Gemini.");
      return;
    }
    submit({ intent: "geminiAssist", assetKey: selectedFile, content: currentContent, instruction }, { method: "post" });
  }, [submit, selectedFile, currentContent, instruction]);

  const handleGeminiResearch = useCallback(() => {
    submit({ intent: "geminiResearch", assetKey: selectedFile, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, currentContent]);

  const handlePopulateMosaic = useCallback(() => {
    submit({ intent: "populateMosaic" }, { method: "post" });
  }, [submit]);

  const lineCount = currentContent.split("\n").length;
  const charCount = currentContent.length;

  const filteredFiles = files.filter((f) => 
    f.key.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const visiblePinned = PINNED_FILES.filter((f) => 
    f.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFileGroup = (folderName) => {
    const folderFiles = filteredFiles.filter((a) => a.key.startsWith(`${folderName}/`) && !PINNED_FILES.includes(a.key));
    
    return folderFiles.length > 0 ? (
      <Box paddingBlockEnd="400" key={folderName}>
        <Text variant="headingSm" as="h6" fontWeight="bold">{folderName.toUpperCase()}</Text>
        <List type="bullet">
          {folderFiles.map((file) => (
            <List.Item key={file.key}>
              <Button 
                variant="monochromePlain" 
                onClick={() => handleSelectFile(file.key)} 
                textAlign="left"
                accessibilityLabel={`Open file ${file.key}`}
              >
                {file.key.replace(`${folderName}/`, "")}
              </Button>
            </List.Item>
          ))}
        </List>
      </Box>
    ) : null;
  };

  const renderNewFileModal = () => {
    return isNewModalOpen ? (
      <Modal
        open={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Create New File"
        primaryAction={{ content: "Create", onAction: handleCreateNew, loading: isNavigating, accessibilityLabel: "Confirm create new file" }}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsNewModalOpen(false), accessibilityLabel: "Cancel create new file" }]}
      >
        <Modal.Section>
          <FormLayout>
            <Select
              label="Folder"
              options={[
                { label: "Sections", value: "sections" },
                { label: "Snippets", value: "snippets" },
                { label: "Templates", value: "templates" },
                { label: "Assets", value: "assets" }
              ]}
              value={newFileType}
              onChange={setNewFileType}
            />
            <TextField
              label="Filename (without extension)"
              value={newFileName}
              onChange={setNewFileName}
              autoComplete="off"
              accessibilityLabel="New filename input"
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    ) : null;
  };

  const renderRenameModal = () => {
    return isRenameModalOpen ? (
      <Modal
        open={isRenameModalOpen}
        onClose={() => setIsRenameModalOpen(false)}
        title="Rename File"
        primaryAction={{ content: "Rename", onAction: handleRename, loading: isNavigating, accessibilityLabel: "Confirm rename file" }}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsRenameModalOpen(false), accessibilityLabel: "Cancel rename file" }]}
      >
        <Modal.Section>
          <TextField
            label="New File Path (e.g., snippets/new-name.liquid)"
            value={renameInput}
            onChange={setRenameInput}
            autoComplete="off"
            accessibilityLabel="Rename file path input"
          />
        </Modal.Section>
      </Modal>
    ) : null;
  };

  const renderDeleteModal = () => {
    return isDeleteModalOpen ? (
      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete File"
        primaryAction={{ content: "Delete", onAction: handleDelete, destructive: true, loading: isNavigating, accessibilityLabel: "Confirm delete file" }}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsDeleteModalOpen(false), accessibilityLabel: "Cancel delete file" }]}
      >
        <Modal.Section>
          <Text as="p">Are you sure you want to delete {selectedFile}? This cannot be undone.</Text>
        </Modal.Section>
      </Modal>
    ) : null;
  };

  const renderDuplicateModal = () => {
    return isDuplicateModalOpen ? (
      <Modal
        open={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        title="Duplicate File"
        primaryAction={{ content: "Duplicate", onAction: handleDuplicate, loading: isNavigating, accessibilityLabel: "Confirm duplicate file" }}
        secondaryActions={[{ content: "Cancel", onAction: () => setIsDuplicateModalOpen(false), accessibilityLabel: "Cancel duplicate file" }]}
      >
        <Modal.Section>
          <TextField
            label="New File Path (e.g., sections/copy.liquid)"
            value={duplicateInput}
            onChange={setDuplicateInput}
            autoComplete="off"
            accessibilityLabel="Duplicate file path input"
          />
        </Modal.Section>
      </Modal>
    ) : null;
  };

  return (
    <Page
      title={selectedFile ? selectedFile : "Theme Editor"}
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      {loaderError ? <Banner tone="critical">{loaderError}</Banner> : null}
      
      {actionData?.error && !actionData?.debugTypes ? (
        <Banner tone="critical">{actionData.error}</Banner>
      ) : null}
      
      {/* ── NEW DEBUG BANNER ── */}
      {actionData?.debugTypes && (
        <Box paddingBlockEnd="400">
          <Banner tone={actionData.success ? "info" : "critical"} title={actionData.success ? "Debug: Homepage Section Types Found" : actionData.error}>
            <div style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              <strong>Available Sections:</strong> {actionData.debugTypes.join(", ")}
            </div>
          </Banner>
        </Box>
      )}

      {actionData?.intent === "populateMosaic" && actionData?.success && (
        <Box paddingBlockEnd="400">
          <Banner tone="success" title="Success">
            {actionData.message}
          </Banner>
        </Box>
      )}

      {renderNewFileModal()}
      {renderRenameModal()}
      {renderDeleteModal()}
      {renderDuplicateModal()}

      <Layout>
        <Layout.Section>
          <Card>
            <InlineStack align="space-between" blockAlign="center">
              <BlockStack gap="200">
                <Text variant="headingMd" as="h2">Living Mosaic Automation</Text>
                <Text as="p" tone="subdued">Automatically pull all published collections and pages into the homepage hero section.</Text>
              </BlockStack>
              
              <div style={{ display: 'inline-flex', minHeight: '48px', alignItems: 'stretch' }}>
                <Button
                  tone="success"
                  variant="primary"
                  size="large"
                  loading={isPopulating}
                  onClick={handlePopulateMosaic}
                  aria-label="Populate Living Mosaic hero section with all collections and story pages"
                >
                  Populate Living Mosaic
                </Button>
              </div>
            </InlineStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">File Tree</Text>
                <TextField
                  labelHidden
                  label="Search files"
                  placeholder="Filter files by name..."
                  value={searchQuery}
                  onChange={setSearchQuery}
                  autoComplete="off"
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                  accessibilityLabel="Search files filter"
                />
              </BlockStack>
            </Box>
            <Scrollable style={{ height: "75vh" }} focusable>
              <Box padding="400">
                {visiblePinned.length > 0 ? (
                  <Box paddingBlockEnd="400">
                    <Text variant="headingSm" as="h6" fontWeight="bold">PINNED QUICK-ACCESS</Text>
                    <List type="bullet">
                      {visiblePinned.map((fileKey) => (
                        <List.Item key={fileKey}>
                          <Button 
                            variant="monochromePlain" 
                            onClick={() => handleSelectFile(fileKey)} 
                            textAlign="left"
                            accessibilityLabel={`Open pinned file ${fileKey}`}
                          >
                            <Text fontWeight="bold">{fileKey}</Text>
                          </Button>
                        </List.Item>
                      ))}
                    </List>
                  </Box>
                ) : null}
                <Divider />
                <Box paddingBlockStart="400">
                  {FOLDERS.map((folder) => renderFileGroup(folder))}
                </Box>
              </Box>
            </Scrollable>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card padding="0">
            {selectedFile ? (
              <BlockStack>
                <Box padding="400" borderBottom="025" borderColor="border">
                  <BlockStack gap="400">
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="headingLg" as="h2">{selectedFile}</Text>
                        <InlineStack gap="300">
                          <Badge tone="info">{lineCount} Lines</Badge>
                          <Badge>{charCount} Characters</Badge>
                        </InlineStack>
                      </BlockStack>
                      <InlineStack gap="300">
                        <Button 
                          onClick={() => setShowDiff(!showDiff)} 
                          size="large"
                          accessibilityLabel="Toggle Diff View"
                        >
                          {showDiff ? "Hide Diff" : "Show Diff"}
                        </Button>
                        <Button 
                          variant="primary" 
                          onClick={handleSave} 
                          loading={isSaving} 
                          disabled={!hasChanges}
                          size="large"
                          accessibilityLabel="Save changes to Theme"
                        >
                          SAVE TO THEME
                        </Button>
                      </InlineStack>
                    </InlineStack>

                    <ButtonGroup segmented>
                      <Button size="large" onClick={() => setIsNewModalOpen(true)} accessibilityLabel="Create a new file">
                        New File
                      </Button>
                      <Button size="large" onClick={handleSave} disabled={!hasChanges} loading={isSaving} accessibilityLabel="Save current file">
                        Save File
                      </Button>
                      <Button size="large" onClick={() => { setRenameInput(selectedFile); setIsRenameModalOpen(true); }} accessibilityLabel="Rename current file">
                        Rename File
                      </Button>
                      <Button size="large" onClick={() => setIsDeleteModalOpen(true)} tone="critical" accessibilityLabel="Delete current file">
                        Delete File
                      </Button>
                      <Button size="large" onClick={() => { setDuplicateInput(selectedFile.replace('.liquid', '-copy.liquid')); setIsDuplicateModalOpen(true); }} accessibilityLabel="Duplicate current file">
                        Duplicate File
                      </Button>
                      <Button size="large" onClick={handleDiscard} disabled={!hasChanges} accessibilityLabel="Discard unsaved changes">
                        Discard Changes
                      </Button>
                    </ButtonGroup>
                  </BlockStack>
                </Box>

                <Tabs
                  tabs={[{ id: "editor", content: "Editor", accessibilityLabel: "Editor Tab" }, { id: "research", content: "Research", accessibilityLabel: "Research Tab" }]}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                  fitted
                >
                  <Box padding="400">
                    {selectedTab === 0 ? (
                      <BlockStack gap="400">
                        <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Gemini Assist (gemini-2.5-pro)</Text>
                            <InlineStack gap="300" wrap={false} blockAlign="center">
                              <Box width="100%">
                                <TextField
                                  labelHidden
                                  label="Instruction for Gemini"
                                  value={instruction}
                                  onChange={setInstruction}
                                  placeholder="e.g. 'Add a new schema setting for background color with id custom_bg'"
                                  autoComplete="off"
                                  accessibilityLabel="Instruction input for Gemini Assist"
                                />
                              </Box>
                              <Button onClick={handleGeminiAssist} loading={isAssisting} tone="success" size="large" accessibilityLabel="Send instruction to Gemini">
                                Modify Code
                              </Button>
                            </InlineStack>
                          </BlockStack>
                        </Box>

                        {showDiff ? (
                          <InlineStack gap="400" wrap={false} align="start">
                            <Box width="50%">
                              <Text fontWeight="bold">Original Content</Text>
                              <Box paddingBlockStart="200">
                                <TextField labelHidden label="Original file content" value={originalContent} multiline={25} monospaced autoComplete="off" readOnly accessibilityLabel="Original read-only content" />
                              </Box>
                            </Box>
                            <Box width="50%">
                              <Text fontWeight="bold">Modified Content</Text>
                              <Box paddingBlockStart="200">
                                <TextField labelHidden label="Modified file content" value={currentContent} onChange={setCurrentContent} multiline={25} monospaced autoComplete="off" accessibilityLabel="Editable modified content" />
                              </Box>
                            </Box>
                          </InlineStack>
                        ) : (
                          <TextField labelHidden label="Code Editor" value={currentContent} onChange={setCurrentContent} multiline={30} monospaced autoComplete="off" disabled={isNavigating} accessibilityLabel="Main code editor" />
                        )}
                      </BlockStack>
                    ) : null}

                    {selectedTab === 1 ? (
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingMd" as="h3">Prestige Schema Cataloger</Text>
                          <Button onClick={handleGeminiResearch} loading={isResearching} size="large" accessibilityLabel="Run schema analysis using Gemini">
                            Run Schema Analysis
                          </Button>
                        </InlineStack>
                        <Divider />
                        {researchData ? (
                          <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                            <Text as="pre" variant="bodyMd" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                              {researchData}
                            </Text>
                          </Box>
                        ) : (
                          <Box padding="800">
                            <Text alignment="center" tone="subdued">
                              Click "Run Schema Analysis" to have Gemini map all settings and blocks in {selectedFile}.
                            </Text>
                          </Box>
                        )}
                      </BlockStack>
                    ) : null}
                  </Box>
                </Tabs>
              </BlockStack>
            ) : (
              <Box padding="800">
                <Text alignment="center" variant="headingLg" tone="subdued">
                  Select a file from the tree to begin editing.
                </Text>
                <Box paddingBlockStart="400" display="flex" justifyContent="center">
                   <Button size="large" onClick={() => setIsNewModalOpen(true)} accessibilityLabel="Create new file from empty state">
                     Create New File
                   </Button>
                </Box>
              </Box>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
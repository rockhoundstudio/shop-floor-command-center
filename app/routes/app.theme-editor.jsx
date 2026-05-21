import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  List,
  Button,
  TextField,
  Tabs,
  Badge,
  Box,
  Divider,
  Banner,
  Scrollable
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

const THEME_ID = "158876434683"; // Live Prestige v11.1.0 Theme

const PINNED_FILES = [
  "config/settings_schema.json",
  "config/settings_data.json",
  "layout/theme.liquid",
  "sections/header.liquid",
  "sections/footer.liquid",
];

const FOLDERS = ["sections", "snippets", "templates", "assets", "config"];

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);

  try {
    const response = await admin.rest.get({
      path: `/themes/${THEME_ID}/assets.json`,
    });
    
    const data = await response.json();
    return Response.json({ assets: data.assets || [] });
  } catch (error) {
    console.error("Failed to load theme assets:", error);
    return Response.json({ assets: [], error: "Failed to load theme files." });
  }
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const assetKey = formData.get("assetKey");

  try {
    // 1. FETCH ASSET CONTENT
    if (intent === "fetchAsset") {
      const response = await admin.rest.get({
        path: `/themes/${THEME_ID}/assets.json`,
        query: { "asset[key]": assetKey },
      });
      const data = await response.json();
      return Response.json({ intent, assetKey, content: data.asset?.value || "" });
    }

    // 2. SAVE ASSET TO THEME
    if (intent === "saveAsset") {
      const content = formData.get("content");
      const response = await admin.rest.put({
        path: `/themes/${THEME_ID}/assets.json`,
        data: {
          asset: { key: assetKey, value: content },
        },
      });
      const data = await response.json();
      return Response.json({ intent, success: true, message: `Saved ${assetKey} successfully.` });
    }

    // 3. GEMINI ASSIST (CODE MODIFICATION)
    if (intent === "geminiAssist") {
      const content = formData.get("content");
      const instruction = formData.get("instruction");
      const apiKey = process.env.GEMINI_API_KEY;

      const prompt = `You are a Shopify Liquid and theme architecture expert.
Theme: Prestige v11.1.0 by Maestrooo.
File: ${assetKey}

Current file content:
${content}

Task: ${instruction}

Return only the modified file content. No explanation unless asked.`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      
      const geminiData = await geminiRes.json();
      let modifiedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Strip markdown code block formatting if Gemini wraps it
      modifiedContent = modifiedContent.replace(/^```liquid\n|^```html\n|^```\n/, "").replace(/\n```$/, "");

      return Response.json({ intent, assetKey, modifiedContent });
    }

    // 4. GEMINI RESEARCH (SCHEMA CATALOGING)
    if (intent === "geminiResearch") {
      const content = formData.get("content");
      const apiKey = process.env.GEMINI_API_KEY;

      const prompt = `You are a Shopify Liquid and Prestige theme expert.
Catalog every setting, block type, and preset defined in this file.
For each setting: ID, label, type, default value, and what it controls.
For each block: type, name, available settings.
Return as a structured markdown table.

File: ${assetKey}
Content:
${content}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );
      
      const geminiData = await geminiRes.json();
      const researchContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "No research data generated.";

      return Response.json({ intent, assetKey, researchContent });
    }

    return Response.json({ error: "Invalid intent" }, { status: 400 });

  } catch (error) {
    console.error("Action error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export default function ThemeEditorTab() {
  const { assets, error: loaderError } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  // State Management
  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalContent, setOriginalContent] = useState("");
  const [currentContent, setCurrentContent] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [researchData, setResearchData] = useState("");

  const isLoading = navigation.state === "submitting" || navigation.state === "loading";

  // Handle Action Responses
  useEffect(() => {
    if (actionData) {
      if (actionData.intent === "fetchAsset") {
        setOriginalContent(actionData.content);
        setCurrentContent(actionData.content);
        setResearchData(""); // Reset research on new file load
      } else if (actionData.intent === "saveAsset" && actionData.success) {
        setOriginalContent(currentContent); // Update baseline after save
        setShowDiff(false);
        shopify.toast.show(actionData.message);
      } else if (actionData.intent === "geminiAssist") {
        setCurrentContent(actionData.modifiedContent);
        setShowDiff(true); // Auto-show diff so user can review AI changes
        shopify.toast.show("Gemini modifications applied to editor.");
      } else if (actionData.intent === "geminiResearch") {
        setResearchData(actionData.researchContent);
        shopify.toast.show("Research complete.");
      }
    }
  }, [actionData]);

  // File Handlers
  const handleSelectFile = useCallback((key) => {
    setSelectedFile(key);
    submit({ intent: "fetchAsset", assetKey: key }, { method: "post" });
  }, [submit]);

  const handleSave = useCallback(() => {
    submit({ intent: "saveAsset", assetKey: selectedFile, content: currentContent }, { method: "post" });
  }, [submit, selectedFile, currentContent]);

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

  // Derived Stats
  const lineCount = currentContent.split("\n").length;
  const charCount = currentContent.length;

  // File Tree Grouping Logic
  const renderFileGroup = (folderName) => {
    const files = assets.filter((a) => a.key.startsWith(`${folderName}/`) && !PINNED_FILES.includes(a.key));
    if (files.length === 0) return null;
    
    return (
      <Box paddingBlockEnd="400" key={folderName}>
        <Text variant="headingSm" as="h6" fontWeight="bold">{folderName.toUpperCase()}</Text>
        <List type="bullet">
          {files.map((file) => (
            <List.Item key={file.key}>
              <Button variant="monochromePlain" onClick={() => handleSelectFile(file.key)} textAlign="left">
                {file.key.replace(`${folderName}/`, "")}
              </Button>
            </List.Item>
          ))}
        </List>
      </Box>
    );
  };

  return (
    <Page title="Theme Editor: Prestige v11.1.0" fullWidth>
      {loaderError && <Banner tone="critical">{loaderError}</Banner>}
      {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}

      <Layout>
        {/* LEFT PANEL: FILE TREE */}
        <Layout.Section variant="oneThird">
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <Text variant="headingMd" as="h2">File Tree</Text>
            </Box>
            <Scrollable style={{ height: "75vh" }} focusable>
              <Box padding="400">
                {/* Pinned Files */}
                <Box paddingBlockEnd="400">
                  <Text variant="headingSm" as="h6" fontWeight="bold">PINNED QUICK-ACCESS</Text>
                  <List type="bullet">
                    {PINNED_FILES.map((fileKey) => (
                      <List.Item key={fileKey}>
                        <Button variant="monochromePlain" onClick={() => handleSelectFile(fileKey)} textAlign="left">
                          <Text fontWeight="bold">{fileKey}</Text>
                        </Button>
                      </List.Item>
                    ))}
                  </List>
                </Box>
                <Divider />
                <Box paddingBlockStart="400">
                  {FOLDERS.map((folder) => renderFileGroup(folder))}
                </Box>
              </Box>
            </Scrollable>
          </Card>
        </Layout.Section>

        {/* RIGHT PANEL: EDITOR & RESEARCH */}
        <Layout.Section>
          <Card padding="0">
            {selectedFile ? (
              <BlockStack>
                {/* Editor Header */}
                <Box padding="400" borderBottom="025" borderColor="border">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="100">
                      <Text variant="headingLg" as="h2">{selectedFile}</Text>
                      <InlineStack gap="300">
                        <Badge tone="info">{lineCount} Lines</Badge>
                        <Badge>{charCount} Characters</Badge>
                      </InlineStack>
                    </BlockStack>
                    <InlineStack gap="300">
                      <Button onClick={() => setShowDiff(!showDiff)}>
                        {showDiff ? "Hide Diff" : "Show Diff"}
                      </Button>
                      <Button variant="primary" onClick={handleSave} loading={isLoading && actionData?.intent === "saveAsset"}>
                        SAVE TO THEME
                      </Button>
                    </InlineStack>
                  </InlineStack>
                </Box>

                <Tabs
                  tabs={[{ id: "editor", content: "Editor" }, { id: "research", content: "Research" }]}
                  selected={selectedTab}
                  onSelect={setSelectedTab}
                  fitted
                >
                  <Box padding="400">
                    {/* TAB 1: EDITOR */}
                    {selectedTab === 0 && (
                      <BlockStack gap="400">
                        {/* Gemini Assist Bar */}
                        <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                          <BlockStack gap="300">
                            <Text variant="headingSm" as="h3">Gemini Assist (gemini-2.5-pro)</Text>
                            <InlineStack gap="300" wrap={false} blockAlign="center">
                              <Box width="100%">
                                <TextField
                                  value={instruction}
                                  onChange={setInstruction}
                                  placeholder="e.g. 'Add a new schema setting for background color with id custom_bg'"
                                  autoComplete="off"
                                />
                              </Box>
                              <Button 
                                onClick={handleGeminiAssist} 
                                loading={isLoading && navigation.formData?.get("intent") === "geminiAssist"}
                                tone="success"
                              >
                                Modify Code
                              </Button>
                            </InlineStack>
                          </BlockStack>
                        </Box>

                        {/* Editor Workspace */}
                        {showDiff ? (
                          <InlineStack gap="400" wrap={false} align="start">
                            <Box width="50%">
                              <Text fontWeight="bold">Original Content</Text>
                              <Box paddingBlockStart="200">
                                <TextField
                                  value={originalContent}
                                  multiline={25}
                                  monospaced
                                  autoComplete="off"
                                  readOnly
                                />
                              </Box>
                            </Box>
                            <Box width="50%">
                              <Text fontWeight="bold">Modified Content</Text>
                              <Box paddingBlockStart="200">
                                <TextField
                                  value={currentContent}
                                  onChange={setCurrentContent}
                                  multiline={25}
                                  monospaced
                                  autoComplete="off"
                                />
                              </Box>
                            </Box>
                          </InlineStack>
                        ) : (
                          <TextField
                            value={currentContent}
                            onChange={setCurrentContent}
                            multiline={30}
                            monospaced
                            autoComplete="off"
                            disabled={isLoading}
                          />
                        )}
                      </BlockStack>
                    )}

                    {/* TAB 2: RESEARCH */}
                    {selectedTab === 1 && (
                      <BlockStack gap="400">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text variant="headingMd" as="h3">Prestige Schema Cataloger</Text>
                          <Button 
                            onClick={handleGeminiResearch} 
                            loading={isLoading && navigation.formData?.get("intent") === "geminiResearch"}
                          >
                            Run Schema Analysis
                          </Button>
                        </InlineStack>
                        <Divider />
                        {researchData ? (
                          <Box background="bg-surface-secondary" padding="400" borderRadius="200">
                            {/* Rendering markdown structure safely inside a preformatted text block for the admin UI */}
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
                    )}
                  </Box>
                </Tabs>
              </BlockStack>
            ) : (
              <Box padding="800">
                <Text alignment="center" variant="headingLg" tone="subdued">
                  Select a file from the tree to begin editing.
                </Text>
              </Box>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
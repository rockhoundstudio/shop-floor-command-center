import { useState, useEffect, useCallback } from "react";
import { useLoaderData, useActionData, useSubmit, useNavigation, useNavigate } from "react-router";
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

const THEME_ID = "158876434683";

const PINNED_FILES = [
  "config/settings_schema.json",
  "config/settings_data.json",
  "layout/theme.liquid",
  "sections/header.liquid",
  "sections/footer.liquid",
];

const FOLDERS = ["sections", "snippets", "templates", "assets", "config"];

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
    return Response.json({ files: data.assets || [] });
  } catch (error) {
    console.error("Failed to load theme assets:", error);
    return Response.json({ files: [], error: `Failed to load theme files: ${error.message}` });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const { shop, accessToken } = session;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const assetKey = formData.get("assetKey");

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
      return Response.json({ intent, assetKey, content: data.asset?.value || "" });
    }

    if (intent === "saveAsset") {
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
      
      if (!response.ok) throw new Error("Failed to save asset to theme.");
      
      return Response.json({ intent, success: true, message: `Saved ${assetKey} successfully.` });
    }

    if (intent === "geminiAssist") { return Response.json({ intent, assetKey, modifiedContent: "// AI STUBBED" }); }

    if (intent === "geminiResearch") { return Response.json({ intent, assetKey, researchContent: "// AI STUBBED" }); }

    return Response.json({ error: "Invalid intent" }, { status: 400 });

  } catch (error) {
    console.error("Action error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
};

export default function ThemeEditorTab() {
  const loaderData = useLoaderData();
  const files = loaderData?.files || [];
  const loaderError = loaderData?.error;
  
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const navigate = useNavigate();

  const [selectedTab, setSelectedTab] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);
  const [originalContent, setOriginalContent] = useState("");
  const [currentContent, setCurrentContent] = useState("");
  const [showDiff, setShowDiff] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [researchData, setResearchData] = useState("");

  const isLoading = navigation.state === "submitting" || navigation.state === "loading";

  useEffect(() => {
    if (actionData) {
      if (actionData.intent === "fetchAsset") {
        setOriginalContent(actionData.content);
        setCurrentContent(actionData.content);
        setResearchData("");
      } else if (actionData.intent === "saveAsset" && actionData.success) {
        setOriginalContent(currentContent);
        setShowDiff(false);
        shopify.toast.show(actionData.message);
      } else if (actionData.intent === "geminiAssist") {
        setCurrentContent(actionData.modifiedContent);
        setShowDiff(true);
        shopify.toast.show("Gemini modifications applied to editor.");
      } else if (actionData.intent === "geminiResearch") {
        setResearchData(actionData.researchContent);
        shopify.toast.show("Research complete.");
      }
    }
  }, [actionData]);

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

  const lineCount = currentContent.split("\n").length;
  const charCount = currentContent.length;

  const renderFileGroup = (folderName) => {
    const folderFiles = files.filter((a) => a.key.startsWith(`${folderName}/`) && !PINNED_FILES.includes(a.key));
    if (folderFiles.length === 0) return null;
    
    return (
      <Box paddingBlockEnd="400" key={folderName}>
        <Text variant="headingSm" as="h6" fontWeight="bold">{folderName.toUpperCase()}</Text>
        <List type="bullet">
          {folderFiles.map((file) => (
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
    <Page
      title="Theme Editor: Prestige v11.1.0"
      fullWidth
      backAction={{ content: "Dashboard", onAction: () => navigate("/app") }}
    >
      {loaderError && <Banner tone="critical">{loaderError}</Banner>}
      {actionData?.error && <Banner tone="critical">{actionData.error}</Banner>}

      <Layout>
        <Layout.Section variant="oneThird">
          <Card padding="0">
            <Box padding="400" borderBottom="025" borderColor="border">
              <Text variant="headingMd" as="h2">File Tree</Text>
            </Box>
            <Scrollable style={{ height: "75vh" }} focusable>
              <Box padding="400">
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

        <Layout.Section>
          <Card padding="0">
            {selectedFile ? (
              <BlockStack>
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
                    {selectedTab === 0 && (
                      <BlockStack gap="400">
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

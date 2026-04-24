import { useState, useEffect } from "react";
import { data } from "react-router";
import { useActionData, useSubmit, useNavigation } from "react-router";
import {
  Page,
  Layout,
  Card,
  Select,
  Button,
  BlockStack,
  Text,
  InlineStack,
  Box,
  Divider
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return {};
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const payload = JSON.parse(formData.get("menuPayload"));
  const menuGid = formData.get("menuGid");

  try {
    const response = await admin.graphql(
      `#graphql
      mutation menuUpdate($id: ID!, $menu: MenuInput!) {
        menuUpdate(id: $id, menu: $menu) {
          menu {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          id: menuGid,
          menu: { items: payload }
        }
      }
    );

    const result = await response.json();

    if (result.data.menuUpdate.userErrors.length > 0) {
      return data({ status: "error", message: result.data.menuUpdate.userErrors[0].message });
    }

    return data({ status: "success", message: "Menu successfully torqued down and saved!" });
  } catch (error) {
    return data({ status: "error", message: "Engine fault: Failed to reach Shopify API." });
  }
};

export default function MenuManager() {
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [selectedMenu, setSelectedMenu] = useState("gid://shopify/Menu/252615295227");
  const [statusState, setStatusState] = useState("unsaved");

  const initialMainMenu = [
    { title: "All Stone", url: "/collections/all", items: [
        { title: "Available Case Files", url: "/collections/all" },
        { title: "The Private Collection", url: "/collections/all" }
    ]},
    { title: "All Tales", url: "/blogs/the-rockhound-logbook", items: [
        { title: "Stories from the Bench", url: "/blogs/the-rockhound-logbook/tagged/stories-from-the-bench" },
        { title: "The Community Archive", url: "/blogs/the-rockhound-logbook/tagged/the-community-archive" }
    ]},
    { title: "Rescue Your Memory", url: "/pages/memories-in-stone", items: [] }
  ];

  const initialFooterMenu = [
    { title: "About the Makers", url: "/pages/our-story" },
    { title: "Search the Archive", url: "/search" },
    { title: "FAQ & Practical Testing", url: "/pages/frequently-asked-questions" },
    { title: "Standard Specs", url: "/pages/standard-specs" }
  ];

  const [menuItems, setMenuItems] = useState(initialMainMenu);

  const getStatusBanner = () => {
    if (statusState === "saved") return { bg: "#0b5b3c", color: "#ffffff", text: "SAVED" };
    if (statusState === "error") return { bg: "#8b0000", color: "#ffffff", text: "ERROR" };
    return { bg: "#ffd700", color: "#000000", text: "UNSAVED CHANGES" };
  };
  const statusConfig = getStatusBanner();

  useEffect(() => {
    if (actionData?.status === "success") setStatusState("saved");
    if (actionData?.status === "error") setStatusState("error");
  }, [actionData]);

  const handleMenuChange = (value) => {
    setSelectedMenu(value);
    setMenuItems(value === "gid://shopify/Menu/252615295227" ? initialMainMenu : initialFooterMenu);
    setStatusState("unsaved");
  };

  const handleSave = () => {
    const formData = new FormData();
    formData.append("menuGid", selectedMenu);
    formData.append("menuPayload", JSON.stringify(menuItems));
    submit(formData, { method: "post" });
  };

  return (
    <Page title="Rockhound Menu Manager">
      <Layout>
        <Layout.Section>

          <Box padding="400" background="bg-surface" borderRadius="200" shadow="100">
            <InlineStack align="space-between" blockAlign="center">
              <Text as="h1" variant="heading2xl" fontWeight="bold">
                Dashboard Status
              </Text>
              <div style={{ backgroundColor: statusConfig.bg, color: statusConfig.color, padding: "12px 24px", borderRadius: "8px", fontWeight: "bold", fontSize: "18px", border: "2px solid #000" }}>
                {statusConfig.text}
              </div>
            </InlineStack>
            {actionData?.message && (
              <Box paddingBlockStart="300">
                <Text as="p" variant="bodyLg" fontWeight="bold">{actionData.message}</Text>
              </Box>
            )}
          </Box>
          <br/>

          <Card padding="600">
            <BlockStack gap="500">
              <Text as="h2" variant="headingXl" fontWeight="bold">Select Engine Mount</Text>

              <Select
                label={<Text as="span" variant="headingLg" fontWeight="bold">Choose Menu to Edit</Text>}
                options={[
                  { label: "Main Menu (Header)", value: "gid://shopify/Menu/252615295227" },
                  { label: "Footer Menu", value: "gid://shopify/Menu/251808547067" },
                ]}
                onChange={handleMenuChange}
                value={selectedMenu}
              />

              <Divider />

              <Text as="h2" variant="headingXl" fontWeight="bold">Current Wiring (Preview)</Text>

              <Box padding="400" borderColor="border" borderWidth="025" borderRadius="200">
                <BlockStack gap="400">
                  {menuItems.map((item, index) => (
                    <Box key={index} padding="300" background="bg-surface-secondary" borderRadius="100">
                      <InlineStack align="space-between">
                        <BlockStack gap="100">
                          <Text as="h3" variant="headingLg" fontWeight="bold">{item.title}</Text>
                          <Text as="p" variant="bodyLg">{item.url}</Text>
                        </BlockStack>
                        <InlineStack gap="300">
                          <Button size="large" onClick={() => setStatusState("unsaved")}>Edit</Button>
                          <Button size="large" tone="critical" onClick={() => setStatusState("unsaved")}>Delete</Button>
                        </InlineStack>
                      </InlineStack>

                      {item.items && item.items.length > 0 && (
                        <Box paddingBlockStart="300" paddingInlineStart="600">
                          <BlockStack gap="200">
                            {item.items.map((subItem, subIndex) => (
                              <InlineStack key={subIndex} align="space-between" blockAlign="center">
                                <Text as="p" variant="headingMd" fontWeight="bold">↳ {subItem.title} ({subItem.url})</Text>
                                <Button size="large" onClick={() => setStatusState("unsaved")}>Edit</Button>
                              </InlineStack>
                            ))}
                          </BlockStack>
                        </Box>
                      )}
                    </Box>
                  ))}
                </BlockStack>
              </Box>

              <Box paddingBlockStart="500">
                <Button
                  size="large"
                  variant="primary"
                  onClick={handleSave}
                  loading={isSaving}
                  fullWidth
                >
                  <span style={{ fontSize: "20px", fontWeight: "bold" }}>SAVE MENU WIRING</span>
                </Button>
              </Box>

            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

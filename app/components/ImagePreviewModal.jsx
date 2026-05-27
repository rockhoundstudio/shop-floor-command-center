import { Modal, BlockStack, Text, Box, Divider } from "@shopify/polaris";

export default function ImagePreviewModal({
  imageUrl,
  imageAlt,
  altText,
  seoTitle,
  metaDescription,
  onClose
}) {
  return (
    <Modal
      open={true}
      onClose={onClose}
      title="Content Preview"
      size="large"
    >
      <Modal.Section>
        <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          
          {/* LEFT SIDE: Image (50%) */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <img
              src={imageUrl}
              alt={imageAlt || "Preview"}
              style={{ 
                width: "100%", 
                height: "auto", 
                maxHeight: "60vh",
                borderRadius: "8px", 
                objectFit: "contain",
                backgroundColor: "#f4f6f8" 
              }}
            />
          </div>

          {/* RIGHT SIDE: Copy (50%) */}
          <div style={{ flex: '1 1 45%', minWidth: '300px' }}>
            <BlockStack gap="500">
              <BlockStack gap="200">
                <Text variant="headingSm" fontWeight="bold">Alt Text</Text>
                <Text as="p">{altText || "No Alt Text available."}</Text>
              </BlockStack>
              
              <Divider />
              
              <BlockStack gap="200">
                <Text variant="headingSm" fontWeight="bold">SEO Title</Text>
                <Text as="p">{seoTitle || "No SEO Title available."}</Text>
              </BlockStack>
              
              <Divider />
              
              <BlockStack gap="200">
                <Text variant="headingSm" fontWeight="bold">Meta Description</Text>
                <Text as="p">{metaDescription || "No Meta Description available."}</Text>
              </BlockStack>
            </BlockStack>
          </div>
          
        </div>
      </Modal.Section>
    </Modal>
  );
}

import React from "react";
import { BlockStack, Card, Text, TextField } from "@shopify/polaris";

const MANUAL_FIELDS = [
  { key: "native_price", label: "Native Price (USD)", placeholder: "e.g. 45.00" },
  { key: "custom.weight_grams", label: "Stone Weight (grams)", placeholder: "Measured stone weight" },
  { key: "custom.dimensions_mm", label: "Dimensions (mm)", placeholder: "Measured dimensions in mm" }
];

export function UnselectedDraftManualInputs({
  selectedBenchId,
  draftManifest,
  currentApprovals,
  configFields,
  getFieldMetadata,
  onRepairPlanChange
}) {
  if (selectedBenchId !== null || draftManifest?.isUnselectedDraft !== true) {
    return null;
  }

  return (
    <Card padding="400">
      <BlockStack gap="400">
        <Text as="h3" variant="headingMd">Manual Product Inputs</Text>
        <Text as="p" variant="bodySm" tone="subdued">
          Enter your price and applicable measured values here.
          These are the same unsaved working values shown in the drawers.
          Leave unknown measurements blank; entering data does not save a product.
        </Text>
        {MANUAL_FIELDS.map((field) => {
          const meta = getFieldMetadata(
            field.key,
            draftManifest,
            null,
            currentApprovals,
            configFields
          );
          const held = Boolean(
            !meta ||
            meta.isSupported !== true ||
            meta.isManualOnly ||
            meta.isParkedExcluded ||
            meta.isImageAltCapabilityPlaceholder ||
            meta.isPendingReadOnly ||
            meta.hasContractOrOwnerHold ||
            meta.hasExplicitStorageHold ||
            meta.hasExplicitProducerHold ||
            meta.isChannelFlagReadOnly ||
            meta.isVariantMetafieldHold
          );
          const value = meta?.propVal == null ? "" : String(meta.propVal);

          return (
            <TextField
              key={field.key}
              label={field.label}
              value={value}
              onChange={(nextValue) => {
                if (!held) onRepairPlanChange(field.key, nextValue);
              }}
              disabled={held}
              autoComplete="off"
              placeholder={field.placeholder}
              helpText={held ? "Read-only: the existing field contract remains held." : undefined}
            />
          );
        })}
      </BlockStack>
    </Card>
  );
}

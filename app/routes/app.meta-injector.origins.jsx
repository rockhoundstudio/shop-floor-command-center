import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, InlineStack, Box, DataTable, Badge, Text, Button, Spinner, Modal, Toast
} from "@shopify/polaris";

export function OriginsTab({ fetcher }) {
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, payload: [], diffs: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, payload: [], diffs: [] }), []);

  useEffect(() => {
    if (fetcher.data && fetcher.data.message) {
      setToastState({ active: true, message: fetcher.data.message, isError: !fetcher.data.success });
      if (fetcher.data.success) {
        closeModal();
      }
    }
  }, [fetcher.data, closeModal]);

  const liveOrigins = fetcher.data?.origins || [];
  const isLoading = fetcher.state !== "idle";
  const hasLoaded = fetcher.data?.origins !== undefined;

  const parsedOrigins = liveOrigins.map(p => {
    const parts = p.title.split(/\s[—-]\s/);
    const currentOrigin = p.originMetafield?.value || null;
    let suggested = "";
    let status = "Missing";
    let tone = "critical";

    if (parts.length >= 3) suggested = parts[1].trim();

    if (currentOrigin && suggested && currentOrigin.toLowerCase() === suggested.toLowerCase()) {
      status = "Match";
      tone = "success";
    } else if (currentOrigin && suggested) {
      status = "Mismatch";
      tone = "warning";
    } else if (currentOrigin && !suggested) {
      status = "Cannot Parse Title";
      tone = "info";
    } else if (!currentOrigin && suggested) {
      status = "Ready to Inject";
      tone = "magic";
    }
    return { id: p.id, title: p.title, current: currentOrigin, suggested, status, tone, rawProduct: p };
  });

  const handleApproveAll = () => {
    const targets = parsedOrigins.filter(r => r.suggested && r.status !== "Match");
    if (targets.length === 0) {
      setToastState({ active: true, message: "No actionable origins found.", isError: true });
      return;
    }
    const payload = targets.map(r => ({
      ownerId: r.id,
      namespace: "custom",
      key: "origin_location",
      type: "single_line_text_field",
      value: r.suggested
    }));
    setModalConfig({
      active: true,
      title: "Approve All Suggested Origins",
      body: `This will update the origin location for ${targets.length} products.`,
      diffs: [],
      payload
    });
  };

  const handleApproveSingle = (row) => {
    setModalConfig({
      active: true,
      title: `Approve Origin for ${row.title}`,
      body: `Setting origin to: ${row.suggested}`,
      diffs: [],
      payload: [{ ownerId: row.id, namespace: "custom", key: "origin_location", type: "single_line_text_field", value: row.suggested }]
    });
  };

  const executeSave = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };

  return (
    <Box>
      <BlockStack gap="400">
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="300" blockAlign="center">
            <Text variant="headingMd" as="h2">Auto-Extract Origin from Titles</Text>
            {isLoading && <Spinner size="small" accessibilityLabel="Loading origins data" />}
          </InlineStack>
          <InlineStack gap="300">
            <div style={tapTargetStyle}>
              <Button
                onClick={() => fetcher.submit({ intent: "fetchOrigins" }, { method: "post" })}
                loading={isLoading}
                accessibilityLabel="Load origins from product titles"
              >
                Load Origins
              </Button>
            </div>
            {hasLoaded && (
              <div style={tapTargetStyle}>
                <Button
                  tone="success"
                  onClick={handleApproveAll}
                  disabled={isLoading}
                  accessibilityLabel="Approve all suggested origins"
                >
                  Approve All Suggestions
                </Button>
              </div>
            )}
          </InlineStack>
        </InlineStack>

        {hasLoaded && (
          <Box background="bg-surface" borderRadius="200" shadow="100">
            <DataTable
              columnContentTypes={["text", "text", "text", "text", "text"]}
              headings={["Product", "Current Origin", "Suggested Extract", "Status", "Action"]}
              rows={parsedOrigins.map(r => [
                r.title,
                r.current || "-",
                r.suggested || "-",
                <Badge tone={r.tone} key={`badge-${r.id}`}>{r.status}</Badge>,
                <div style={tapTargetStyle} key={`btn-${r.id}`}>
                  <Button
                    disabled={!r.suggested || r.status === "Match"}
                    onClick={() => handleApproveSingle(r)}
                    accessibilityLabel={`Approve origin for ${r.title}`}
                  >
                    Approve
                  </Button>
                </div>
              ])}
            />
          </Box>
        )}
      </BlockStack>

      {modalConfig.active && (
        <Modal
          open={true}
          onClose={closeModal}
          title={modalConfig.title}
          primaryAction={{ content: "Confirm & Execute", onAction: executeSave, tone: "success", accessibilityLabel: "Confirm and execute action" }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel action" }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {modalConfig.body && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {toastState.active && (
        <Toast
          content={toastState.message}
          error={toastState.isError}
          onDismiss={closeToast}
        />
      )}
    </Box>
  );
}

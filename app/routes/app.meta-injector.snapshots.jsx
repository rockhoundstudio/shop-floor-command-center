import React, { useState, useCallback, useEffect } from "react";
import {
  BlockStack, Banner, EmptySearchResult, ResourceList, ResourceItem, InlineStack, Text, Button, Modal, Toast, Box
} from "@shopify/polaris";
import { UndoIcon } from "@shopify/polaris-icons";

export function SnapshotsTab({ fetcher, snapshots = [] }) {
  const [modalConfig, setModalConfig] = useState({ active: false, title: "", body: null, payload: [] });
  const [toastState, setToastState] = useState({ active: false, message: "", isError: false });

  const tapTargetStyle = { minHeight: '48px', minWidth: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' };

  const closeToast = useCallback(() => setToastState(prev => ({ ...prev, active: false })), []);
  const closeModal = useCallback(() => setModalConfig({ active: false, title: "", body: null, payload: [] }), []);

  useEffect(() => {
    const hasData = fetcher.data !== undefined;
    const hasMessage = fetcher.data?.message !== undefined;
    
    if (hasData && hasMessage) {
      setToastState({ active: true, message: fetcher.data.message, isError: !fetcher.data.success });
      if (fetcher.data.success) {
        closeModal();
      }
    }
  }, [fetcher.data, closeModal]);

  const handleRestore = (snapshot) => {
    const payload = [];
    const parsedData = JSON.parse(snapshot.payloadStr);
    
    parsedData.forEach(pData => {
      pData.metafields.forEach(mf => { 
        payload.push({ ownerId: pData.id, namespace: mf.namespace, key: mf.key, type: mf.type, value: mf.value }); 
      });
    });

    setModalConfig({
      active: true, 
      title: `Restore Snapshot: ${snapshot.action}`,
      body: `This will revert ${snapshot.scopeCount} products back to their exact state on ${snapshot.date}.`,
      payload
    });
  };

  const executeRestore = () => {
    fetcher.submit({ intent: "saveMetafields", payload: JSON.stringify(modalConfig.payload) }, { method: "post" });
  };

  const hasSnapshots = snapshots.length > 0;
  const noSnapshots = snapshots.length === 0;
  const isModalActive = modalConfig.active === true;
  const hasModalBody = modalConfig.body !== null;
  const isToastActive = toastState.active === true;

  return (
    <Box>
      <BlockStack gap="400">
        <Banner tone="info" title="Persistent Safety Net">
          <Text as="p">Snapshots are saved to Shopify Metaobjects and survive page reloads. Maximum 5 snapshots retained.</Text>
        </Banner>
        
        {noSnapshots && (
          <EmptySearchResult title="No snapshots found" description="Perform an action to generate a backup snapshot." withIllustration />
        )}
        
        {hasSnapshots && (
          <ResourceList 
            resourceName={{ singular: "snapshot", plural: "snapshots" }} 
            items={snapshots} 
            renderItem={(item) => (
              <ResourceItem id={item.id} accessibilityLabel={`Snapshot ${item.action}`}>
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text variant="bodyMd" fontWeight="bold">{item.action}</Text>
                    <Text variant="bodySm" color="subdued">{item.date} • {item.scopeCount} products tracked</Text>
                  </BlockStack>
                  <div style={tapTargetStyle}>
                    <Button icon={UndoIcon} onClick={() => handleRestore(item)} accessibilityLabel={`Restore ${item.action}`}>
                      Restore This State
                    </Button>
                  </div>
                </InlineStack>
              </ResourceItem>
            )} 
          />
        )}
      </BlockStack>

      {isModalActive && (
        <Modal
          open={true} 
          onClose={closeModal} 
          title={modalConfig.title}
          primaryAction={{ content: "Confirm & Execute", onAction: executeRestore, tone: "success", accessibilityLabel: "Confirm and execute snapshot restore" }}
          secondaryActions={[{ content: "Cancel", onAction: closeModal, accessibilityLabel: "Cancel snapshot restore" }]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              {hasModalBody && <Text variant="bodyLg" as="p" fontWeight="bold">{modalConfig.body}</Text>}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}

      {isToastActive && (
        <Toast 
          content={toastState.message} 
          error={toastState.isError} 
          onDismiss={closeToast} 
        />
      )}
    </Box>
  );
}

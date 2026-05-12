import { useEffect } from 'react';
import { useAppBridge } from '@shopify/app-bridge-react';

export function useSidekickActivityTools(currentCollections, currentAssignments) {
  const shopify = useAppBridge();

  useEffect(() => {
    const executeAction = async (payload) => {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
      const response = await fetch('/app/collection-manager', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Action failed with status ${response.status}: ${response.statusText}`);
      }
      return await response.json().catch(() => ({}));
    };

    const activityTools = {
      deleteCollection: async ({ collectionId }) => {
        await executeAction({ intent: 'deleteCollection', id: collectionId });
        return { success: true, message: `Confirmed: Deleted collection ${collectionId}.` };
      },
      addStoneToCollection: async ({ productId, collectionId }) => {
        await executeAction({ intent: 'assignCollection', productId, collectionId });
        return { success: true, message: `Confirmed: Added stone ${productId} to ${collectionId}.` };
      },
      removeStoneFromCollection: async ({ productId, collectionId }) => {
        await executeAction({ intent: 'removeCollection', productId, collectionId });
        return { success: true, message: `Confirmed: Removed stone ${productId} from ${collectionId}.` };
      },
      getCollectionList: async () => {
        return currentCollections;
      },
      getStoneAssignments: async () => {
        return currentAssignments;
      }
    };

    const registeredTools = Object.keys(activityTools).map(toolName => ({
      name: toolName,
      status: 'ready'
    }));

    shopify.dispatch('SIDEKICK::REGISTER_ACTIVITY_TOOLS', { tools: registeredTools });

    const unsubscribe = shopify.subscribe('SIDEKICK::INVOKE_ACTIVITY', async (event) => {
      const { actionName, params, invocationId } = event.data;

      if (!activityTools[actionName]) {
        shopify.dispatch('SIDEKICK::ACTIVITY_RESULT', {
          invocationId,
          success: false,
          error: `Tool '${actionName}' is not registered.`
        });
        return;
      }

      console.log(`[App Bridge] Sidekick invoking: ${actionName}`, params);

      try {
        const result = await activityTools[actionName](params || {});
        shopify.dispatch('SIDEKICK::ACTIVITY_RESULT', {
          invocationId,
          success: true,
          data: result
        });
      } catch (error) {
        console.error(`[App Bridge] Error in ${actionName}:`, error);
        shopify.dispatch('SIDEKICK::ACTIVITY_RESULT', {
          invocationId,
          success: false,
          error: error.message
        });
      }
    });

    return () => {
      shopify.dispatch('SIDEKICK::DEREGISTER_ACTIVITY_TOOLS', {
        tools: registeredTools.map(t => t.name)
      });
      unsubscribe();
    };
  }, [shopify, currentCollections, currentAssignments]);
}

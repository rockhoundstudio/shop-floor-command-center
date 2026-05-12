import { useEffect } from 'react';

export function useSidekickActivityTools(currentCollections, currentAssignments) {
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
      getCollectionList: async () => currentCollections,
      getStoneAssignments: async () => currentAssignments
    };

    const registeredTools = Object.keys(activityTools).map(toolName => ({
      name: toolName,
      status: 'ready'
    }));

    window.parent.postMessage({
      type: 'SIDEKICK::REGISTER_ACTIVITY_TOOLS',
      payload: { tools: registeredTools }
    }, 'https://admin.shopify.com');

    const handleMessage = async (event) => {
      if (event.origin !== 'https://admin.shopify.com' && !event.origin.endsWith('.myshopify.com')) {
        return;
      }
      const { type, payload } = event.data || {};
      if (type !== 'SIDEKICK::INVOKE_ACTIVITY') return;

      const { actionName, params, invocationId } = payload;

      if (!activityTools[actionName]) {
        window.parent.postMessage({
          type: 'SIDEKICK::ACTIVITY_RESULT',
          payload: { invocationId, success: false, error: `Tool '${actionName}' is not registered.` }
        }, event.origin);
        return;
      }

      console.log(`[Sidekick] Invoking: ${actionName}`, params);

      try {
        const result = await activityTools[actionName](params || {});
        window.parent.postMessage({
          type: 'SIDEKICK::ACTIVITY_RESULT',
          payload: { invocationId, success: true, data: result }
        }, event.origin);
      } catch (error) {
        console.error(`[Sidekick] Error in ${actionName}:`, error);
        window.parent.postMessage({
          type: 'SIDEKICK::ACTIVITY_RESULT',
          payload: { invocationId, success: false, error: error.message }
        }, event.origin);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      window.parent.postMessage({
        type: 'SIDEKICK::DEREGISTER_ACTIVITY_TOOLS',
        payload: { tools: registeredTools.map(t => t.name) }
      }, 'https://admin.shopify.com');
    };
  }, [currentCollections, currentAssignments]);
}

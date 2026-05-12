import { useEffect } from 'react';

export function useSidekickActivityTools(currentCollections, currentAssignments) {
  useEffect(() => {

    const executeAction = async (payload) => {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
      const response = await fetch(window.location.pathname + window.location.search, {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        throw new Error(`Action failed with status ${response.status}: ${response.statusText}`);
      }
      const data = await response.json().catch(() => ({}));
      return data;
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

    window.get_activity_tools = () => {
      return Object.keys(activityTools).map(toolName => ({
        name: toolName,
        status: 'ready'
      }));
    };

    window.invoke_activity = async (actionName, params = {}) => {
      if (!activityTools[actionName]) {
        throw new Error(`Activity tool '${actionName}' is not registered on this route.`);
      }
      console.log(`[Sidekick] Invoking: ${actionName}`, params);
      try {
        const result = await activityTools[actionName](params);
        return result;
      } catch (error) {
        console.error(`[Sidekick] Error in ${actionName}:`, error);
        return { success: false, error: error.message };
      }
    };

    return () => {
      delete window.get_activity_tools;
      delete window.invoke_activity;
    };
  }, [currentCollections, currentAssignments]);
}

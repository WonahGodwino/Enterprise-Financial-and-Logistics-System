import { cacheManager } from '../middleware/cache.middleware.js';

export const invalidateDashboardDrilldownCache = async () => {
  try {
    await cacheManager.invalidateTags(['dashboard:drilldown']);
  } catch (error) {
    // Cache invalidation failure should not block business operations.
    console.error('Dashboard drilldown cache invalidation failed:', error?.message || error);
  }
};

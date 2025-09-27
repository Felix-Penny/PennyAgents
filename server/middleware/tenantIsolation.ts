import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      storeId?: number;
      userId?: number;
      userRole?: string;
    }
  }
}

interface TenantContext {
  tenantId: number;
  tenantSlug: string;
  planType: 'basic' | 'premium' | 'enterprise';
  isActive: boolean;
  limits: {
    maxStores: number;
    maxUsersPerStore: number;
    maxCamerasPerStore: number;
    maxStorageGB: number;
    maxAlertsPerMonth: number;
  };
  features: {
    facialRecognition: boolean;
    behaviorAnalysis: boolean;
    ptzControl: boolean;
    aiAnalysis: boolean;
    multiLocation: boolean;
    apiAccess: boolean;
    exportData: boolean;
    customReports: boolean;
  };
  settings: {
    dataRetentionDays: number;
    autoArchive: boolean;
    allowGuestAccess: boolean;
    requireTwoFactor: boolean;
  };
}

interface StoreContext {
  storeId: number;
  tenantId: number;
  storeName: string;
  location: string;
  isActive: boolean;
  managerIds: number[];
  userCount: number;
  cameraCount: number;
}

class TenantIsolationMiddleware {
  private logger: winston.Logger;
  private enableMultiTenant: boolean;
  private defaultTenantId: number;
  private tenantCache: Map<string, TenantContext>;
  private storeCache: Map<number, StoreContext>;
  private cacheTimeout: number;

  constructor() {
    this.enableMultiTenant = process.env.ENABLE_MULTI_TENANT === 'true';
    this.defaultTenantId = parseInt(process.env.DEFAULT_TENANT_ID || '1');
    this.tenantCache = new Map();
    this.storeCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/tenant-isolation.log' })
      ]
    });

    // Clear cache periodically
    setInterval(() => {
      this.clearExpiredCache();
    }, this.cacheTimeout);
  }

  // Main tenant resolution middleware
  resolveTenant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.enableMultiTenant) {
        // Single tenant mode - use default tenant
        req.tenant = await this.getDefaultTenant();
        return next();
      }

      // Extract tenant from various sources
      let tenantIdentifier: string | undefined;

      // 1. From subdomain (e.g., acme.pennyprotect.com)
      const host = req.get('host') || '';
      const subdomain = host.split('.')[0];
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        tenantIdentifier = subdomain;
      }

      // 2. From custom header
      if (!tenantIdentifier) {
        tenantIdentifier = req.get('X-Tenant-Id') || req.get('X-Tenant-Slug');
      }

      // 3. From query parameter
      if (!tenantIdentifier) {
        tenantIdentifier = req.query.tenant as string;
      }

      // 4. From JWT token (if authenticated)
      if (!tenantIdentifier && req.user) {
        tenantIdentifier = (req.user as any).tenantId?.toString();
      }

      if (!tenantIdentifier) {
        res.status(400).json({
          error: 'Tenant identifier required',
          code: 'TENANT_REQUIRED'
        });
        return;
      }

      // Resolve tenant context
      const tenant = await this.resolveTenantContext(tenantIdentifier);
      
      if (!tenant) {
        res.status(404).json({
          error: 'Tenant not found',
          code: 'TENANT_NOT_FOUND'
        });
        return;
      }

      if (!tenant.isActive) {
        res.status(403).json({
          error: 'Tenant account suspended',
          code: 'TENANT_SUSPENDED'
        });
        return;
      }

      req.tenant = tenant;
      
      this.logger.info('Tenant resolved', {
        tenantId: tenant.tenantId,
        tenantSlug: tenant.tenantSlug,
        planType: tenant.planType
      });

      next();

    } catch (error) {
      this.logger.error('Tenant resolution failed:', error);
      res.status(500).json({
        error: 'Tenant resolution failed',
        code: 'TENANT_RESOLUTION_ERROR'
      });
    }
  };

  // Store context resolution middleware
  resolveStore = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        res.status(401).json({
          error: 'Tenant context required',
          code: 'TENANT_CONTEXT_REQUIRED'
        });
        return;
      }

      // Extract store ID from various sources
      let storeId: number | undefined;

      // 1. From route parameters
      if (req.params.storeId) {
        storeId = parseInt(req.params.storeId);
      }

      // 2. From query parameters
      if (!storeId && req.query.storeId) {
        storeId = parseInt(req.query.storeId as string);
      }

      // 3. From body
      if (!storeId && req.body && req.body.storeId) {
        storeId = parseInt(req.body.storeId);
      }

      // 4. From user's default store (if authenticated)
      if (!storeId && req.user) {
        storeId = (req.user as any).defaultStoreId;
      }

      if (!storeId) {
        res.status(400).json({
          error: 'Store ID required',
          code: 'STORE_ID_REQUIRED'
        });
        return;
      }

      // Verify store belongs to tenant
      const store = await this.resolveStoreContext(storeId);
      
      if (!store) {
        res.status(404).json({
          error: 'Store not found',
          code: 'STORE_NOT_FOUND'
        });
        return;
      }

      if (store.tenantId !== req.tenant.tenantId) {
        res.status(403).json({
          error: 'Store does not belong to tenant',
          code: 'STORE_ACCESS_DENIED'
        });
        return;
      }

      if (!store.isActive) {
        res.status(403).json({
          error: 'Store is inactive',
          code: 'STORE_INACTIVE'
        });
        return;
      }

      req.storeId = storeId;

      this.logger.info('Store resolved', {
        storeId: store.storeId,
        tenantId: store.tenantId,
        storeName: store.storeName
      });

      next();

    } catch (error) {
      this.logger.error('Store resolution failed:', error);
      res.status(500).json({
        error: 'Store resolution failed',
        code: 'STORE_RESOLUTION_ERROR'
      });
    }
  };

  // Feature access control middleware
  requireFeature = (feature: keyof TenantContext['features']) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.tenant) {
        res.status(401).json({
          error: 'Tenant context required',
          code: 'TENANT_CONTEXT_REQUIRED'
        });
        return;
      }

      if (!req.tenant.features[feature]) {
        res.status(403).json({
          error: `Feature '${feature}' not available for your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          requiredPlan: this.getRequiredPlan(feature)
        });
        return;
      }

      next();
    };
  };

  // Resource limit checking middleware
  checkResourceLimit = (resource: 'stores' | 'users' | 'cameras' | 'alerts') => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.tenant) {
          res.status(401).json({
            error: 'Tenant context required',
            code: 'TENANT_CONTEXT_REQUIRED'
          });
          return;
        }

        const usage = await this.getCurrentResourceUsage(req.tenant.tenantId, resource);
        const limit = this.getResourceLimit(req.tenant, resource);

        if (usage >= limit) {
          res.status(429).json({
            error: `${resource} limit reached`,
            code: 'RESOURCE_LIMIT_EXCEEDED',
            limit,
            usage,
            upgradeRequired: true
          });
          return;
        }

        // Add usage info to request for logging
        (req as any).resourceUsage = { resource, usage, limit };

        next();

      } catch (error) {
        this.logger.error('Resource limit check failed:', error);
        res.status(500).json({
          error: 'Resource limit check failed',
          code: 'RESOURCE_CHECK_ERROR'
        });
      }
    };
  };

  // Data isolation for database queries
  createTenantFilter = (tenantId?: number): Record<string, any> => {
    if (!this.enableMultiTenant) {
      return {};
    }

    return {
      tenantId: tenantId || this.defaultTenantId
    };
  };

  createStoreFilter = (storeId?: number, tenantId?: number): Record<string, any> => {
    const filter: Record<string, any> = {};

    if (this.enableMultiTenant && tenantId) {
      filter.tenantId = tenantId;
    }

    if (storeId) {
      filter.storeId = storeId;
    }

    return filter;
  };

  // Private methods
  private async getDefaultTenant(): Promise<TenantContext> {
    // In single tenant mode, return default tenant
    return {
      tenantId: this.defaultTenantId,
      tenantSlug: 'default',
      planType: 'enterprise',
      isActive: true,
      limits: {
        maxStores: 999,
        maxUsersPerStore: 999,
        maxCamerasPerStore: 999,
        maxStorageGB: 9999,
        maxAlertsPerMonth: 999999
      },
      features: {
        facialRecognition: true,
        behaviorAnalysis: true,
        ptzControl: true,
        aiAnalysis: true,
        multiLocation: true,
        apiAccess: true,
        exportData: true,
        customReports: true
      },
      settings: {
        dataRetentionDays: 90,
        autoArchive: true,
        allowGuestAccess: false,
        requireTwoFactor: false
      }
    };
  }

  private async resolveTenantContext(identifier: string): Promise<TenantContext | null> {
    // Check cache first
    const cached = this.tenantCache.get(identifier);
    if (cached) {
      return cached;
    }

    try {
      // In a real implementation, this would query the database
      // For now, return a mock tenant based on identifier
      const tenant: TenantContext = {
        tenantId: parseInt(identifier) || 1,
        tenantSlug: identifier,
        planType: 'premium',
        isActive: true,
        limits: {
          maxStores: 10,
          maxUsersPerStore: 50,
          maxCamerasPerStore: 20,
          maxStorageGB: 100,
          maxAlertsPerMonth: 10000
        },
        features: {
          facialRecognition: true,
          behaviorAnalysis: true,
          ptzControl: false,
          aiAnalysis: true,
          multiLocation: true,
          apiAccess: false,
          exportData: true,
          customReports: false
        },
        settings: {
          dataRetentionDays: 60,
          autoArchive: true,
          allowGuestAccess: false,
          requireTwoFactor: true
        }
      };

      // Cache the result
      this.tenantCache.set(identifier, tenant);

      return tenant;

    } catch (error) {
      this.logger.error('Failed to resolve tenant context:', error);
      return null;
    }
  }

  private async resolveStoreContext(storeId: number): Promise<StoreContext | null> {
    // Check cache first
    const cached = this.storeCache.get(storeId);
    if (cached) {
      return cached;
    }

    try {
      // In a real implementation, this would query the database
      // For now, return a mock store
      const store: StoreContext = {
        storeId,
        tenantId: 1, // Would come from database
        storeName: `Store ${storeId}`,
        location: 'Mock Location',
        isActive: true,
        managerIds: [1], // Would come from database
        userCount: 5,
        cameraCount: 3
      };

      // Cache the result
      this.storeCache.set(storeId, store);

      return store;

    } catch (error) {
      this.logger.error('Failed to resolve store context:', error);
      return null;
    }
  }

  private getRequiredPlan(feature: keyof TenantContext['features']): string {
    const featurePlans: Record<string, string> = {
      facialRecognition: 'premium',
      behaviorAnalysis: 'premium',
      ptzControl: 'enterprise',
      aiAnalysis: 'premium',
      multiLocation: 'premium',
      apiAccess: 'enterprise',
      exportData: 'premium',
      customReports: 'enterprise'
    };

    return featurePlans[feature] || 'premium';
  }

  private getResourceLimit(tenant: TenantContext, resource: string): number {
    switch (resource) {
      case 'stores':
        return tenant.limits.maxStores;
      case 'users':
        return tenant.limits.maxUsersPerStore;
      case 'cameras':
        return tenant.limits.maxCamerasPerStore;
      case 'alerts':
        return tenant.limits.maxAlertsPerMonth;
      default:
        return 0;
    }
  }

  private async getCurrentResourceUsage(tenantId: number, resource: string): Promise<number> {
    // In a real implementation, this would query the database
    // For now, return mock usage
    return Math.floor(Math.random() * 10);
  }

  private clearExpiredCache(): void {
    // In a real implementation, you'd track cache timestamps
    // For now, just clear periodically
    this.tenantCache.clear();
    this.storeCache.clear();
    this.logger.debug('Cleared tenant and store cache');
  }

  // Utility methods
  isMultiTenantEnabled(): boolean {
    return this.enableMultiTenant;
  }

  getDefaultTenantId(): number {
    return this.defaultTenantId;
  }

  // Export middleware functions
  get middleware() {
    return {
      resolveTenant: this.resolveTenant,
      resolveStore: this.resolveStore,
      requireFeature: this.requireFeature,
      checkResourceLimit: this.checkResourceLimit
    };
  }
}

export default new TenantIsolationMiddleware();
export { TenantContext, StoreContext };
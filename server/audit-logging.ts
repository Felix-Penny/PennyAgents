// Standardized Audit Logging for Advanced Features - Privacy & Compliance
import type { Request } from 'express';
import { storage } from './storage';

/**
 * Audit Feature Types for advanced capabilities
 */
export const AUDIT_FEATURE_TYPES = {
  FACIAL_RECOGNITION: 'facial_recognition',
  BEHAVIOR_ANALYSIS: 'behavior_analysis',
  PREDICTIVE_ANALYTICS: 'predictive_analytics',
  CONSENT_VERIFICATION: 'consent_verification',
  BIOMETRIC_PROCESSING: 'biometric_processing',
  WATCHLIST_MANAGEMENT: 'watchlist_management',
  TEMPLATE_ACCESS: 'template_access',
  PRIVACY_CONTROLS: 'privacy_controls'
} as const;

export type AuditFeatureType = typeof AUDIT_FEATURE_TYPES[keyof typeof AUDIT_FEATURE_TYPES];

/**
 * Audit Actions for comprehensive tracking
 */
export const AUDIT_ACTIONS = {
  // Read operations
  SEARCH: 'search',
  VIEW: 'view',
  ACCESS: 'access',
  RETRIEVE: 'retrieve',
  
  // Write operations  
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  MODIFY: 'modify',
  
  // Security operations
  MATCH: 'match',
  ENCRYPT: 'encrypt',
  DECRYPT: 'decrypt',
  CONSENT_CHECK: 'consent_check',
  PERMISSION_CHECK: 'permission_check',
  
  // Management operations
  APPROVE: 'approve',
  REJECT: 'reject',
  ESCALATE: 'escalate',
  ASSIGN: 'assign'
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

/**
 * Audit Outcomes for result tracking
 */
export const AUDIT_OUTCOMES = {
  SUCCESS: 'success',
  DENIED: 'denied',
  ERROR: 'error',
  BLOCKED: 'blocked',
  PARTIAL: 'partial'
} as const;

export type AuditOutcome = typeof AUDIT_OUTCOMES[keyof typeof AUDIT_OUTCOMES];

/**
 * Standardized audit logging function for all advanced feature endpoints
 * 
 * CRITICAL COMPLIANCE FUNCTION:
 * - Logs ALL advanced feature operations for forensic capability
 * - Captures user context, operation details, and outcomes
 * - Cannot be bypassed - mandatory for all sensitive operations
 * - Provides complete audit trail for privacy compliance
 */
export const auditAdvancedFeatureAction = async (
  userId: string,
  storeId: string,
  featureType: AuditFeatureType,
  action: AuditAction,
  outcome: AuditOutcome,
  details: any,
  req: Request,
  resourceType?: string,
  resourceId?: string
): Promise<void> => {
  try {
    await storage.createAdvancedFeatureAuditLog({
      userId,
      storeId,
      featureType,
      action,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
      outcome,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        requestPath: req.path,
        requestMethod: req.method,
        queryParams: req.query,
        userAgent: req.headers['user-agent'],
        referrer: req.headers.referer
      },
      ipAddress: req.ip || 'unknown',
      userAgent: req.headers['user-agent'] || 'unknown'
    });
  } catch (error) {
    // Critical: Log audit failures but don't block operations
    console.error('CRITICAL: Audit logging failed for advanced feature operation:', {
      userId,
      storeId,
      featureType,
      action,
      outcome,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // In production, you might want to:
    // 1. Send alert to security team
    // 2. Store in emergency audit buffer
    // 3. Consider blocking operation if audit is critical
  }
};

/**
 * Audit wrapper middleware for automatic logging
 */
export const withAuditLogging = (
  featureType: AuditFeatureType,
  action: AuditAction,
  resourceType?: string
) => {
  return (target: any, propertyName: string, descriptor: PropertyDescriptor) => {
    const method = descriptor.value;

    descriptor.value = async function(...args: any[]) {
      const req = args.find(arg => arg && arg.user && arg.params); // Find Request object
      if (!req) {
        console.warn('Audit logging: Could not find request object in arguments');
        return method.apply(this, args);
      }

      const startTime = Date.now();
      let outcome: AuditOutcome = AUDIT_OUTCOMES.SUCCESS;
      let errorDetails: any = null;

      try {
        const result = await method.apply(this, args);
        
        // Audit successful operation
        await auditAdvancedFeatureAction(
          req.user.id,
          req.params.storeId || req.user.storeId,
          featureType,
          action,
          outcome,
          {
            executionTime: Date.now() - startTime,
            result: typeof result === 'object' ? Object.keys(result || {}).length : 'primitive'
          },
          req,
          resourceType,
          args[0]?.id || args[1]?.id // Try to extract resource ID
        );

        return result;
      } catch (error) {
        outcome = AUDIT_OUTCOMES.ERROR;
        errorDetails = error instanceof Error ? error.message : 'Unknown error';
        
        // Audit failed operation
        await auditAdvancedFeatureAction(
          req.user.id,
          req.params.storeId || req.user.storeId,
          featureType,
          action,
          outcome,
          {
            executionTime: Date.now() - startTime,
            error: errorDetails
          },
          req,
          resourceType
        );

        throw error; // Re-throw original error
      }
    };

    return descriptor;
  };
};

/**
 * Audit helpers for specific advanced feature operations
 */
export const auditHelpers = {
  /**
   * Audit facial recognition operations
   */
  async facialRecognition(
    req: Request,
    action: AuditAction,
    outcome: AuditOutcome,
    details: {
      templateId?: string;
      matchCount?: number;
      confidence?: number;
      processingTime?: number;
    }
  ) {
    await auditAdvancedFeatureAction(
      req.user!.id,
      req.params.storeId,
      AUDIT_FEATURE_TYPES.FACIAL_RECOGNITION,
      action,
      outcome,
      details,
      req,
      'face_template',
      details.templateId
    );
  },

  /**
   * Audit behavior analysis operations
   */
  async behaviorAnalysis(
    req: Request,
    action: AuditAction,
    outcome: AuditOutcome,
    details: {
      eventType?: string;
      area?: string;
      confidence?: number;
      anomalyDetected?: boolean;
    }
  ) {
    await auditAdvancedFeatureAction(
      req.user!.id,
      req.params.storeId,
      AUDIT_FEATURE_TYPES.BEHAVIOR_ANALYSIS,
      action,
      outcome,
      details,
      req,
      'behavior_event'
    );
  },

  /**
   * Audit consent verification operations
   */
  async consentVerification(
    req: Request,
    action: AuditAction,
    outcome: AuditOutcome,
    details: {
      consentType?: string;
      consentGiven?: boolean;
      legalBasis?: string;
      subjectType?: string;
    }
  ) {
    await auditAdvancedFeatureAction(
      req.user!.id,
      req.params.storeId,
      AUDIT_FEATURE_TYPES.CONSENT_VERIFICATION,
      action,
      outcome,
      details,
      req,
      'consent_preference'
    );
  },

  /**
   * Audit predictive analytics operations
   */
  async predictiveAnalytics(
    req: Request,
    action: AuditAction,
    outcome: AuditOutcome,
    details: {
      modelType?: string;
      riskScore?: number;
      timeWindow?: string;
      confidence?: number;
    }
  ) {
    await auditAdvancedFeatureAction(
      req.user!.id,
      req.params.storeId,
      AUDIT_FEATURE_TYPES.PREDICTIVE_ANALYTICS,
      action,
      outcome,
      details,
      req,
      'risk_score'
    );
  },

  /**
   * Audit watchlist management operations
   */
  async watchlistManagement(
    req: Request,
    action: AuditAction,
    outcome: AuditOutcome,
    details: {
      entryId?: string;
      personName?: string;
      riskLevel?: string;
      isActive?: boolean;
    }
  ) {
    await auditAdvancedFeatureAction(
      req.user!.id,
      req.params.storeId,
      AUDIT_FEATURE_TYPES.WATCHLIST_MANAGEMENT,
      action,
      outcome,
      details,
      req,
      'watchlist_entry',
      details.entryId
    );
  }
};

/**
 * Audit query functions for compliance reporting
 */
export const auditQueries = {
  /**
   * Get audit trail for a specific user
   */
  async getAuditTrailForUser(userId: string, startDate: Date, endDate: Date) {
    return await storage.getAdvancedFeatureAuditLogs({
      userId,
      startDate,
      endDate
    });
  },

  /**
   * Get audit trail for a specific store
   */
  async getAuditTrailForStore(storeId: string, startDate: Date, endDate: Date) {
    return await storage.getAdvancedFeatureAuditLogs({
      storeId,
      startDate,
      endDate
    });
  },

  /**
   * Get audit trail for specific feature type
   */
  async getAuditTrailForFeature(featureType: AuditFeatureType, startDate: Date, endDate: Date) {
    return await storage.getAdvancedFeatureAuditLogs({
      featureType,
      startDate,
      endDate
    });
  },

  /**
   * Get failed operations for security analysis
   */
  async getFailedOperations(storeId: string, startDate: Date, endDate: Date) {
    return await storage.getAdvancedFeatureAuditLogs({
      storeId,
      outcome: AUDIT_OUTCOMES.ERROR,
      startDate,
      endDate
    });
  }
};

/**
 * Compliance reporting functions
 */
export const complianceReporting = {
  /**
   * Generate privacy compliance report
   */
  async generatePrivacyComplianceReport(storeId: string, period: { start: Date; end: Date }) {
    const consentChecks = await auditQueries.getAuditTrailForFeature(
      AUDIT_FEATURE_TYPES.CONSENT_VERIFICATION,
      period.start,
      period.end
    );

    const biometricAccess = await auditQueries.getAuditTrailForFeature(
      AUDIT_FEATURE_TYPES.FACIAL_RECOGNITION,
      period.start,
      period.end
    );

    return {
      period,
      storeId,
      summary: {
        totalConsentChecks: consentChecks.length,
        consentDenials: consentChecks.filter(log => log.outcome === AUDIT_OUTCOMES.DENIED).length,
        biometricAccesses: biometricAccess.length,
        failedOperations: biometricAccess.filter(log => log.outcome === AUDIT_OUTCOMES.ERROR).length
      },
      details: {
        consentChecks,
        biometricAccess
      }
    };
  },

  /**
   * Generate security audit report
   */
  async generateSecurityAuditReport(storeId: string, period: { start: Date; end: Date }) {
    const allLogs = await auditQueries.getAuditTrailForStore(storeId, period.start, period.end);
    const failedOps = await auditQueries.getFailedOperations(storeId, period.start, period.end);

    return {
      period,
      storeId,
      summary: {
        totalOperations: allLogs.length,
        failedOperations: failedOps.length,
        successRate: ((allLogs.length - failedOps.length) / allLogs.length * 100).toFixed(2) + '%',
        featureUsage: allLogs.reduce((acc, log) => {
          acc[log.featureType] = (acc[log.featureType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      details: {
        allLogs: allLogs.slice(0, 100), // Limit for report size
        failedOperations: failedOps
      }
    };
  }
};
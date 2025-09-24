// Consent Verification Middleware - Privacy-Compliant consent checks
import type { Request, Response, NextFunction } from 'express';
import { storage } from './storage';

/**
 * Consent Types for different privacy-sensitive operations
 */
export const CONSENT_TYPES = {
  FACIAL_RECOGNITION: 'facial_recognition',
  BEHAVIOR_ANALYSIS: 'behavior_analysis',
  BIOMETRIC_PROCESSING: 'biometric_processing',
  PREDICTIVE_ANALYTICS: 'predictive_analytics',
  VIDEO_ANALYTICS: 'video_analytics'
} as const;

export type ConsentType = typeof CONSENT_TYPES[keyof typeof CONSENT_TYPES];

/**
 * Legal Basis for processing under GDPR/privacy regulations
 */
export const LEGAL_BASIS = {
  CONSENT: 'consent',
  LEGITIMATE_INTEREST: 'legitimate_interest',
  VITAL_INTEREST: 'vital_interest',
  LEGAL_OBLIGATION: 'legal_obligation',
  PUBLIC_TASK: 'public_task',
  CONTRACT: 'contract'
} as const;

export type LegalBasis = typeof LEGAL_BASIS[keyof typeof LEGAL_BASIS];

/**
 * Middleware to require explicit consent for privacy-sensitive operations
 * 
 * CRITICAL PRIVACY COMPLIANCE:
 * - Checks consent before any facial recognition or biometric processing
 * - Blocks operations if consent not given or withdrawn
 * - Logs all consent checks for audit trail
 * - Cannot be bypassed - hard stop for privacy violations
 */
export const requireConsent = (consentType: ConsentType, options: {
  subjectType?: 'customer' | 'employee' | 'visitor';
  legalBasis?: LegalBasis;
  allowLegitimateInterest?: boolean;
} = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { storeId } = req.params;
      const userId = req.user?.id;

      if (!userId || !storeId) {
        return res.status(400).json({ 
          error: "Missing required user or store information for consent check" 
        });
      }

      // Check if consent is given for this operation
      const hasConsent = await checkConsentWithAudit(
        storeId,
        userId,
        consentType,
        options,
        req
      );

      if (!hasConsent.granted) {
        // Log the consent denial
        await auditConsentCheck(
          userId,
          storeId,
          consentType,
          'denied',
          hasConsent.reason,
          req
        );

        return res.status(403).json({ 
          error: "Consent required for this operation",
          consentType,
          reason: hasConsent.reason,
          legalBasis: hasConsent.legalBasis,
          howToProvideConsent: "Contact store management to provide consent for this operation"
        });
      }

      // Log successful consent check
      await auditConsentCheck(
        userId,
        storeId,
        consentType,
        'granted',
        hasConsent.reason,
        req
      );

      // Attach consent information to request for downstream use
      req.consentInfo = {
        consentType,
        legalBasis: hasConsent.legalBasis,
        consentDate: hasConsent.consentDate,
        subjectType: hasConsent.subjectType
      };

      next();
    } catch (error) {
      console.error('Consent check failed:', error);
      
      // Fail secure - deny operation if consent check fails
      return res.status(500).json({ 
        error: "Unable to verify consent - operation denied for privacy protection" 
      });
    }
  };
};

/**
 * Check consent with comprehensive audit trail
 */
async function checkConsentWithAudit(
  storeId: string,
  userId: string,
  consentType: ConsentType,
  options: any,
  req: Request
): Promise<{
  granted: boolean;
  reason: string;
  legalBasis?: LegalBasis;
  consentDate?: Date;
  subjectType?: string;
}> {
  try {
    // For employees, check if they have organizational consent
    if (options.subjectType === 'employee') {
      const hasEmployeeConsent = await storage.checkEmployeeConsent(storeId, userId, consentType);
      if (hasEmployeeConsent) {
        return {
          granted: true,
          reason: 'Employee consent on file',
          legalBasis: LEGAL_BASIS.LEGITIMATE_INTEREST,
          subjectType: 'employee'
        };
      }
    }

    // Check for explicit consent in consent_preferences table
    const consentRecord = await storage.getConsentPreference(storeId, consentType, options.subjectType);
    
    if (consentRecord && consentRecord.consentGiven && !consentRecord.withdrawnDate) {
      return {
        granted: true,
        reason: 'Explicit consent provided',
        legalBasis: consentRecord.legalBasis as LegalBasis,
        consentDate: consentRecord.consentDate,
        subjectType: consentRecord.subjectType
      };
    }

    // Check if legitimate interest applies for certain operations
    if (options.allowLegitimateInterest && isLegitimateInterestApplicable(consentType, storeId)) {
      return {
        granted: true,
        reason: 'Legitimate interest - security and safety',
        legalBasis: LEGAL_BASIS.LEGITIMATE_INTEREST,
        subjectType: options.subjectType || 'visitor'
      };
    }

    // Default: consent required but not provided
    const reason = consentRecord?.withdrawnDate 
      ? 'Consent has been withdrawn'
      : 'No consent record found';

    return {
      granted: false,
      reason,
      legalBasis: undefined
    };

  } catch (error) {
    console.error('Error checking consent:', error);
    return {
      granted: false,
      reason: 'Error checking consent records'
    };
  }
}

/**
 * Determine if legitimate interest applies for this operation
 */
function isLegitimateInterestApplicable(consentType: ConsentType, storeId: string): boolean {
  // Legitimate interest may apply for:
  // - Basic security monitoring (not facial recognition)
  // - Theft prevention behavior analysis
  // - Safety-related analytics
  
  switch (consentType) {
    case CONSENT_TYPES.BEHAVIOR_ANALYSIS:
    case CONSENT_TYPES.VIDEO_ANALYTICS:
      return true; // Can rely on legitimate interest for basic behavior monitoring
    
    case CONSENT_TYPES.FACIAL_RECOGNITION:
    case CONSENT_TYPES.BIOMETRIC_PROCESSING:
      return false; // Always require explicit consent for biometric processing
    
    case CONSENT_TYPES.PREDICTIVE_ANALYTICS:
      return true; // Can use for general safety and security predictions
    
    default:
      return false;
  }
}

/**
 * Audit all consent checks for compliance
 */
async function auditConsentCheck(
  userId: string,
  storeId: string,
  consentType: ConsentType,
  outcome: 'granted' | 'denied',
  reason: string,
  req: Request
): Promise<void> {
  try {
    await storage.createAdvancedFeatureAuditLog({
      userId,
      storeId,
      featureType: 'consent_verification',
      action: 'consent_check',
      resourceType: 'consent_preference',
      resourceId: `${storeId}-${consentType}`,
      outcome,
      details: {
        consentType,
        reason,
        requestPath: req.path,
        requestMethod: req.method,
        timestamp: new Date().toISOString()
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch (error) {
    console.error('Failed to audit consent check:', error);
    // Don't throw - this shouldn't block the operation
  }
}

/**
 * Middleware to record consent when provided
 */
export const recordConsent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consentType, subjectType, legalBasis } = req.body;
    const { storeId } = req.params;
    const userId = req.user?.id;

    if (!userId || !storeId || !consentType) {
      return res.status(400).json({ error: "Missing required consent information" });
    }

    // Create consent record
    await storage.createConsentPreference({
      storeId,
      subjectType: subjectType || 'customer',
      consentType,
      consentGiven: true,
      legalBasis: legalBasis || LEGAL_BASIS.CONSENT,
      retentionPeriod: 90, // 90 days default
      notes: `Consent provided via API by user ${userId}`
    });

    // Audit the consent grant
    await auditConsentCheck(
      userId,
      storeId,
      consentType,
      'granted',
      'Consent explicitly provided',
      req
    );

    res.json({ 
      success: true, 
      message: "Consent recorded successfully",
      consentType,
      effectiveDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to record consent:', error);
    res.status(500).json({ error: "Failed to record consent" });
  }
};

/**
 * Middleware to withdraw consent
 */
export const withdrawConsent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consentType } = req.body;
    const { storeId } = req.params;
    const userId = req.user?.id;

    if (!userId || !storeId || !consentType) {
      return res.status(400).json({ error: "Missing required information for consent withdrawal" });
    }

    // Update consent record to mark as withdrawn
    await storage.withdrawConsent(storeId, consentType, userId);

    // Audit the consent withdrawal
    await auditConsentCheck(
      userId,
      storeId,
      consentType,
      'denied',
      'Consent explicitly withdrawn',
      req
    );

    res.json({ 
      success: true, 
      message: "Consent withdrawn successfully",
      consentType,
      withdrawalDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to withdraw consent:', error);
    res.status(500).json({ error: "Failed to withdraw consent" });
  }
};

// Extend Express Request type to include consent information
declare global {
  namespace Express {
    interface Request {
      consentInfo?: {
        consentType: ConsentType;
        legalBasis: LegalBasis;
        consentDate?: Date;
        subjectType?: string;
      };
    }
  }
}
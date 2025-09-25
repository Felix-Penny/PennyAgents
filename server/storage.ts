// Penny MVP Storage Layer - Based on javascript_auth_all_persistance integration
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";

// Type-safe JSON field handling utilities
type JSONValue = string | number | boolean | null | JSONObject | JSONArray;
interface JSONObject {
  [key: string]: JSONValue;
}
interface JSONArray extends Array<JSONValue> {}

/**
 * Type-safe JSON field builder functions to eliminate type assertions
 */
const JsonBuilders = {
  /**
   * Safely converts an object to JSON for storage, ensuring type safety
   */
  toStorageJSON<T extends Record<string, any>>(value: T | undefined | null): T | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    // Validate that the value is a proper object
    if (typeof value !== 'object') {
      throw new Error(`Expected object for JSON field, got ${typeof value}`);
    }
    return value;
  },

  /**
   * Safely converts an array to JSON for storage
   */
  toStorageArray<T>(value: T[] | undefined | null): T[] | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (!Array.isArray(value)) {
      throw new Error(`Expected array for JSON field, got ${typeof value}`);
    }
    return value;
  },

  /**
   * Safely handles user profile data
   */
  buildUserProfile(profile: any): Record<string, any> {
    if (!profile) return {};
    return {
      firstName: String(profile.firstName || ''),
      lastName: String(profile.lastName || ''),
      phone: String(profile.phone || ''),
      role: String(profile.role || 'user'),
      ...(typeof profile === 'object' ? profile : {})
    };
  },

  /**
   * Safely handles store agent settings
   */
  buildAgentSettings(settings: any): Record<string, any> {
    if (!settings) return {};
    return {
      enabledAgents: Array.isArray(settings.enabledAgents) ? settings.enabledAgents : [],
      agentConfigurations: typeof settings.agentConfigurations === 'object' ? settings.agentConfigurations : {},
      ...(typeof settings === 'object' ? settings : {})
    };
  },

  /**
   * Safely handles alert location and metadata
   */
  buildAlertData(location: any, metadata: any): { location: Record<string, any>; metadata: Record<string, any> } {
    return {
      location: typeof location === 'object' && location ? location : {},
      metadata: typeof metadata === 'object' && metadata ? metadata : {}
    };
  },

  /**
   * Safely handles contributing factors for risk assessments
   */
  buildContributingFactors(factors: any): Record<string, any> {
    if (!factors) return {};
    if (typeof factors !== 'object') {
      throw new Error('Contributing factors must be an object');
    }
    return factors;
  },

  /**
   * Safely handles offender data including arrays and physical description
   */
  buildOffenderData(offender: any): {
    aliases: string[];
    physicalDescription: Record<string, any>;
    behaviorPatterns: string[];
    thumbnails: string[];
    confirmedIncidentIds: string[];
  } {
    return {
      aliases: Array.isArray(offender.aliases) ? offender.aliases : [],
      physicalDescription: typeof offender.physicalDescription === 'object' && offender.physicalDescription ? offender.physicalDescription : {},
      behaviorPatterns: Array.isArray(offender.behaviorPatterns) ? offender.behaviorPatterns : [],
      thumbnails: Array.isArray(offender.thumbnails) ? offender.thumbnails : [],
      confirmedIncidentIds: Array.isArray(offender.confirmedIncidentIds) ? offender.confirmedIncidentIds : []
    };
  },

  /**
   * Safely handles configuration and settings objects
   */
  buildConfigurationData(config: any): Record<string, any> {
    if (!config) return {};
    return typeof config === 'object' ? config : {};
  },

  /**
   * Safely handles incident data with complex JSON fields
   */
  buildIncidentData(incident: any): {
    location: Record<string, any>;
    evidenceFiles: string[];
    witnessAccounts: string[];
    metadata: Record<string, any>;
  } {
    return {
      location: typeof incident.location === 'object' && incident.location ? incident.location : {},
      evidenceFiles: Array.isArray(incident.evidenceFiles) ? incident.evidenceFiles : [],
      witnessAccounts: Array.isArray(incident.witnessAccounts) ? incident.witnessAccounts : [],
      metadata: typeof incident.metadata === 'object' && incident.metadata ? incident.metadata : {}
    };
  },

  /**
   * Safely handles metric data with thresholds
   */
  buildMetricData(metric: any): {
    metadata: Record<string, any>;
    threshold: Record<string, any>;
  } {
    return {
      metadata: typeof metric.metadata === 'object' && metric.metadata ? metric.metadata : {},
      threshold: typeof metric.threshold === 'object' && metric.threshold ? metric.threshold : {}
    };
  },

  /**
   * Safely handles billing information
   */
  buildBillingInfo(billingInfo: any): Record<string, any> {
    if (!billingInfo) return {};
    return typeof billingInfo === 'object' ? billingInfo : {};
  },

  /**
   * Safely handles employee profile and diversity data
   */
  buildEmployeeData(employee: any): {
    profile: Record<string, any>;
    diversityInfo: Record<string, any>;
  } {
    return {
      profile: typeof employee.profile === 'object' && employee.profile ? employee.profile : {},
      diversityInfo: typeof employee.diversityInfo === 'object' && employee.diversityInfo ? employee.diversityInfo : {}
    };
  }
};
import {
  users,
  stores,
  alerts,
  alertAcknowledgments,
  alertEscalationRules,
  alertTemplates,
  offenders,
  thefts,
  debtPayments,
  qrTokens,
  notifications,
  evidenceBundles,
  organizations,
  agents,
  userAgentAccess,
  agentConfigurations,
  cameras,
  incidents,
  systemMetrics,
  processes,
  infrastructureComponents,
  operationalIncidents,
  departments,
  employees,
  performanceReviews,
  performanceGoals,
  recruitmentJobs,
  recruitmentCandidates,
  trainingPrograms,
  trainingCompletions,
  engagementSurveys,
  surveyResponses,
  hrMetrics,
  type InsertUser,
  type User,
  type InsertStore,
  type Store,
  type InsertAlert,
  type Alert,
  type AlertAcknowledgment,
  type AlertAcknowledgmentInsert,
  type AlertEscalationRule,
  type AlertEscalationRuleInsert,
  type AlertTemplate,
  type AlertTemplateInsert,
  type InsertOffender,
  type Offender,
  type InsertTheft,
  type Theft,
  type InsertDebtPayment,
  type DebtPayment,
  type InsertQrToken,
  type QrToken,
  type InsertOrganization,
  type Organization,
  type InsertAgent,
  type Agent,
  type InsertUserAgentAccess,
  type UserAgentAccess,
  type InsertAgentConfiguration,
  type AgentConfiguration,
  type InsertCamera,
  type Camera,
  type InsertIncident,
  type Incident,
  type InsertSystemMetric,
  type SystemMetric,
  type InsertProcess,
  type Process,
  type InsertInfrastructureComponent,
  type InfrastructureComponent,
  type InsertOperationalIncident,
  type OperationalIncident,
  type InsertDepartment,
  type Department,
  type InsertEmployee,
  type Employee,
  type InsertPerformanceReview,
  type PerformanceReview,
  type InsertPerformanceGoal,
  type PerformanceGoal,
  type InsertRecruitmentJob,
  type RecruitmentJob,
  type InsertRecruitmentCandidate,
  type RecruitmentCandidate,
  type InsertTrainingProgram,
  type TrainingProgram,
  type InsertTrainingCompletion,
  type TrainingCompletion,
  type InsertEngagementSurvey,
  type EngagementSurvey,
  type InsertSurveyResponse,
  type SurveyResponse,
  type InsertHrMetric,
  type HrMetric,
  // AI Video Analytics types
  aiDetections,
  videoAnalytics,
  behaviorPatterns,
  facialRecognition,
  type InsertAiDetection,
  type AiDetection,
  type InsertVideoAnalytics,
  type VideoAnalytics,
  type InsertBehaviorPattern,
  type BehaviorPattern,
  type InsertFacialRecognition,
  type FacialRecognition,
  // Enhanced Camera Management types
  cameraZones,
  cameraSchedules,
  cameraPresets,
  type InsertCameraZone,
  type CameraZone,
  type InsertCameraSchedule,
  type CameraSchedule,
  type InsertCameraPreset,
  type CameraPreset,
  // Real-Time Detection & Alerts types
  threatClassifications,
  alertRules,
  alertEscalation,
  type InsertThreatClassification,
  type ThreatClassification,
  type InsertAlertRule,
  type AlertRule,
  type InsertAlertEscalation,
  type AlertEscalation,
  // Advanced Incident Management types
  incidentTimeline,
  incidentResponse,
  evidenceChain,
  type InsertIncidentTimeline,
  type IncidentTimeline,
  type InsertIncidentResponse,
  type IncidentResponse,
  type InsertEvidenceChain,
  type EvidenceChain,
  // Analytics & Intelligence types
  securityMetrics,
  trendAnalysis,
  networkIntelligence,
  type InsertSecurityMetrics,
  type SecurityMetrics,
  type InsertTrendAnalysis,
  type TrendAnalysis,
  type InsertNetworkIntelligence,
  type NetworkIntelligence,
  // Role-Based Access Control types
  securityRoles,
  accessPermissions,
  type InsertSecurityRole,
  type SecurityRole,
  type InsertAccessPermission,
  type AccessPermission,
  // Advanced AI Features types
  behaviorEvents,
  areaBaselineProfiles,
  anomalyEvents,
  faceTemplates,
  watchlistEntries,
  consentPreferences,
  predictiveModelSnapshots,
  riskScores,
  advancedFeatureAuditLog,
  type InsertBehaviorEvent,
  type BehaviorEvent,
  type InsertAreaBaselineProfile,
  type AreaBaselineProfile,
  type InsertAnomalyEvent,
  type AnomalyEvent,
  type InsertFaceTemplate,
  type FaceTemplate,
  type InsertWatchlistEntry,
  type WatchlistEntry,
  type InsertConsentPreference,
  type ConsentPreference,
  type InsertPredictiveModelSnapshot,
  type PredictiveModelSnapshot,
  type InsertRiskScore,
  type RiskScore,
  type InsertAdvancedFeatureAuditLog,
  type AdvancedFeatureAuditLog,
  // Predictive Analytics types
  riskAssessments,
  seasonalAnalyses,
  staffingRecommendations,
  incidentForecasts,
  predictiveModelPerformance,
  type InsertRiskAssessment,
  type RiskAssessment,
  type InsertSeasonalAnalysis,
  type SeasonalAnalysis,
  type InsertStaffingRecommendation,
  type StaffingRecommendation,
  type InsertIncidentForecast,
  type IncidentForecast,
  type InsertPredictiveModelPerformance,
  type PredictiveModelPerformance,
} from "@shared/schema";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// MINIMAL IStorage Interface - Only methods actually implemented in DatabaseStorage
export interface IStorage {
  // User management
  createUser(user: InsertUser): Promise<User>;
  getUserByUsername(username: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUser(id: string): Promise<User | null>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User>;
  updateStripeCustomerId(userId: string, customerId: string): Promise<User>;
  updateUserStripeInfo(userId: string, info: { customerId: string; subscriptionId: string }): Promise<User>;

  // Store management
  createStore(store: InsertStore): Promise<Store>;
  getStore(id: string): Promise<Store | null>;
  getStoresByRegion(region?: string): Promise<Store[]>;
  updateStore(id: string, updates: Partial<InsertStore>): Promise<Store>;
  getStoreUsers(storeId: string): Promise<User[]>;

  // Alert Management
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  getAlertsByStore(storeId: string, limit?: number): Promise<Alert[]>;
  getActiveAlerts(storeId?: string): Promise<Alert[]>;
  updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert>;
  getPendingReviewAlerts(): Promise<Alert[]>;

  // Offender Management
  createOffender(offender: InsertOffender): Promise<Offender>;
  getOffender(id: string): Promise<Offender | null>;
  getOffendersByStore(storeId: string): Promise<Offender[]>;
  getNetworkOffenders(excludeStoreId?: string): Promise<Offender[]>;
  updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender>;
  linkOffenderToUser(offenderId: string, userId: string): Promise<Offender>;

  // Theft Management
  createTheft(theft: InsertTheft): Promise<Theft>;
  getTheft(id: string): Promise<Theft | null>;
  getTheftsByOffender(offenderId: string): Promise<Theft[]>;
  getTheftsByStore(storeId: string): Promise<Theft[]>;
  updateTheft(id: string, updates: Partial<InsertTheft>): Promise<Theft>;
  confirmTheft(id: string, confirmedBy: string): Promise<Theft>;

  // Payment Management
  createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment>;
  getDebtPayment(id: string): Promise<DebtPayment | null>;
  getPaymentsByOffender(offenderId: string): Promise<DebtPayment[]>;
  getPaymentsByStore(storeId: string): Promise<DebtPayment[]>;
  updatePayment(id: string, updates: Partial<InsertDebtPayment>): Promise<DebtPayment>;
  markPaymentCompleted(id: string, stripeData: any): Promise<DebtPayment>;

  // QR Token Management
  createQrToken(token: InsertQrToken): Promise<QrToken>;
  getQrToken(token: string): Promise<QrToken | null>;
  markQrTokenUsed(token: string, userId: string): Promise<QrToken>;

  // Notification System
  createNotification(notification: any): Promise<any>;
  getNotificationsByUser(userId: string): Promise<any[]>;
  markNotificationRead(id: string): Promise<any>;

  // Basic Video Analysis (simple implementation)
  createVideoAnalysis(analysis: {
    id: string;
    storeId: string;
    cameraId?: string | null;
    videoFilePath: string;
    analysisStatus: string;
    detectedFaces: any[];
    matchedOffenders: any[];
    confidenceScores: any;
    videoDurationSeconds?: number;
    analyzedAt?: Date;
  }): Promise<any>;
  getVideoAnalysis(id: string): Promise<any | null>;
  updateVideoAnalysis(id: string, updates: any): Promise<any>;

  // Advanced AI Features - Privacy-Compliant Methods
  // Behavior Events
  createBehaviorEvent(event: InsertBehaviorEvent): Promise<BehaviorEvent>;
  getBehaviorEvent(id: string): Promise<BehaviorEvent | null>;
  getBehaviorEventsByStore(storeId: string): Promise<BehaviorEvent[]>;
  
  // Area Baseline Profiles  
  createAreaBaselineProfile(profile: InsertAreaBaselineProfile): Promise<AreaBaselineProfile>;
  getAreaBaselineProfile(id: string): Promise<AreaBaselineProfile | null>;
  getAreaBaselineProfilesByStore(storeId: string): Promise<AreaBaselineProfile[]>;
  
  // Anomaly Events
  createAnomalyEvent(event: InsertAnomalyEvent): Promise<AnomalyEvent>;
  getAnomalyEvent(id: string): Promise<AnomalyEvent | null>;
  getAnomalyEventsByStore(storeId: string): Promise<AnomalyEvent[]>;
  
  // Face Templates (Encrypted)
  createFaceTemplate(template: InsertFaceTemplate): Promise<FaceTemplate>;
  storeFaceTemplate(template: InsertFaceTemplate): Promise<FaceTemplate>; // Alias for createFaceTemplate
  getFaceTemplate(id: string): Promise<FaceTemplate | null>;
  getFaceTemplatesByStore(storeId: string): Promise<FaceTemplate[]>;
  getFaceTemplatesByPerson(personId: string, storeId: string): Promise<FaceTemplate[]>;
  getExpiredFaceTemplates(expiredBefore: Date): Promise<FaceTemplate[]>;
  deleteFaceTemplate(id: string): Promise<void>;
  deleteFaceTemplatesByPerson(personId: string, storeId: string): Promise<number>;
  
  // Watchlist Entries
  createWatchlistEntry(entry: InsertWatchlistEntry): Promise<WatchlistEntry>;
  getWatchlistEntry(id: string): Promise<WatchlistEntry | null>;
  getWatchlistEntriesByStore(storeId: string): Promise<WatchlistEntry[]>;
  getActiveWatchlistEntries(storeId: string): Promise<WatchlistEntry[]>; // Active entries only
  getWatchlistEntriesByPerson(personId: string, storeId: string): Promise<WatchlistEntry[]>;
  updateWatchlistEntry(id: string, updates: Partial<InsertWatchlistEntry>): Promise<WatchlistEntry>;
  deleteWatchlistEntry(id: string): Promise<void>;
  deleteWatchlistEntriesByPerson(personId: string, storeId: string): Promise<number>;
  
  // Consent Management - CRITICAL PRIVACY COMPLIANCE
  createConsentPreference(consent: InsertConsentPreference): Promise<ConsentPreference>;
  getConsentPreference(storeId: string, consentType: string, subjectType?: string): Promise<ConsentPreference | null>;
  getConsentHistoryByPerson(personId: string, storeId: string): Promise<ConsentPreference[]>;
  updateConsentPreference(storeId: string, consentType: string, updates: Partial<InsertConsentPreference>): Promise<ConsentPreference>;
  withdrawConsent(storeId: string, consentType: string, userId: string): Promise<void>;
  checkEmployeeConsent(storeId: string, userId: string, consentType: string): Promise<boolean>;
  
  // Facial Recognition Events
  createFacialRecognitionEvent(event: InsertFacialRecognition): Promise<FacialRecognition>;
  getFacialRecognitionEventsSummary(personId: string, storeId: string): Promise<{
    count: number;
    dateRange: { earliest?: Date; latest?: Date };
  }>;
  deleteFacialRecognitionEventsByPerson(personId: string, storeId: string): Promise<number>;
  cleanupOrphanedFacialRecognitionEvents(): Promise<void>;
  
  // Privacy Requests Management (GDPR/CCPA)
  createPrivacyRequest(request: any): Promise<any>; // PrivacyRequest type to be defined
  updatePrivacyRequest(id: string, request: any): Promise<any>;
  getPrivacyRequest(id: string): Promise<any | null>;
  getPrivacyRequestsByPerson(personId: string): Promise<any[]>;
  
  // Audit Trail for Facial Recognition
  logAdvancedFeatureAudit(log: InsertAdvancedFeatureAuditLog): Promise<AdvancedFeatureAuditLog>; // Alias for createAdvancedFeatureAuditLog
  getFacialRecognitionAuditTrail(personId: string, storeId: string): Promise<AdvancedFeatureAuditLog[]>;
  
  // Predictive Model Snapshots
  createPredictiveModelSnapshot(snapshot: InsertPredictiveModelSnapshot): Promise<PredictiveModelSnapshot>;
  getPredictiveModelSnapshot(id: string): Promise<PredictiveModelSnapshot | null>;
  getActivePredictiveModels(): Promise<PredictiveModelSnapshot[]>;
  
  // Risk Scores
  createRiskScore(score: InsertRiskScore): Promise<RiskScore>;
  getRiskScore(id: string): Promise<RiskScore | null>;
  getRiskScoresByStore(storeId: string): Promise<RiskScore[]>;
  
  // Advanced Feature Audit Log - CRITICAL COMPLIANCE FUNCTION
  createAdvancedFeatureAuditLog(log: InsertAdvancedFeatureAuditLog): Promise<AdvancedFeatureAuditLog>;
  getAdvancedFeatureAuditLogs(filters: {
    userId?: string;
    storeId?: string;
    featureType?: string;
    outcome?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AdvancedFeatureAuditLog[]>;

  // Organization Management
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;

  // Agent Management
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | null>;
  getAgentsByOrganization(organizationId: string): Promise<Agent[]>;

  // User Agent Access
  createUserAgentAccess(access: InsertUserAgentAccess): Promise<UserAgentAccess>;
  getUserAgentAccess(userId: string, agentId: string): Promise<UserAgentAccess | null>;
  getUserAgentsByUser(userId: string): Promise<UserAgentAccess[]>;
  updateUserAgentAccess(id: string, updates: Partial<InsertUserAgentAccess>): Promise<UserAgentAccess>;
  removeUserAgentAccess(userId: string, agentId: string): Promise<void>;

  // Agent Configurations
  createAgentConfiguration(config: InsertAgentConfiguration): Promise<AgentConfiguration>;
  getAgentConfiguration(organizationId: string, agentId: string): Promise<AgentConfiguration | null>;
  getOrganizationAgentConfigurations(organizationId: string): Promise<AgentConfiguration[]>;
  updateAgentConfiguration(id: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration>;

  // Advanced AI Features - Behavioral Pattern Learning
  createBehaviorEvent(event: InsertBehaviorEvent): Promise<BehaviorEvent>;
  getBehaviorEvent(id: string): Promise<BehaviorEvent | null>;
  getBehaviorEventsByStore(storeId: string, eventType?: string): Promise<BehaviorEvent[]>;
  getBehaviorEventsByCamera(cameraId: string, eventType?: string): Promise<BehaviorEvent[]>;
  updateBehaviorEvent(id: string, updates: Partial<InsertBehaviorEvent>): Promise<BehaviorEvent>;

  createAreaBaselineProfile(profile: InsertAreaBaselineProfile): Promise<AreaBaselineProfile>;
  getAreaBaselineProfile(id: string): Promise<AreaBaselineProfile | null>;
  getAreaBaselineProfilesByStore(storeId: string): Promise<AreaBaselineProfile[]>;
  getAreaBaselineProfileByKey(storeId: string, area: string, timeWindow: string, eventType: string): Promise<AreaBaselineProfile | null>;
  updateAreaBaselineProfile(id: string, updates: Partial<InsertAreaBaselineProfile>): Promise<AreaBaselineProfile>;

  createAnomalyEvent(anomaly: InsertAnomalyEvent): Promise<AnomalyEvent>;
  getAnomalyEvent(id: string): Promise<AnomalyEvent | null>;
  getAnomalyEventsByStore(storeId: string, severity?: string): Promise<AnomalyEvent[]>;
  getAnomalyEventsByCamera(cameraId: string): Promise<AnomalyEvent[]>;
  updateAnomalyEvent(id: string, updates: Partial<InsertAnomalyEvent>): Promise<AnomalyEvent>;

  // Advanced AI Features - Facial Recognition (Privacy-Compliant)
  createFaceTemplate(template: InsertFaceTemplate): Promise<FaceTemplate>;
  getFaceTemplate(id: string): Promise<FaceTemplate | null>;
  getFaceTemplatesByStore(storeId: string, personType?: string): Promise<FaceTemplate[]>;
  updateFaceTemplate(id: string, updates: Partial<InsertFaceTemplate>): Promise<FaceTemplate>;
  deleteFaceTemplate(id: string): Promise<void>;

  createWatchlistEntry(entry: InsertWatchlistEntry): Promise<WatchlistEntry>;
  getWatchlistEntry(id: string): Promise<WatchlistEntry | null>;
  getWatchlistEntriesByStore(storeId: string, riskLevel?: string): Promise<WatchlistEntry[]>;
  getActiveWatchlistEntriesByStore(storeId: string): Promise<WatchlistEntry[]>;
  updateWatchlistEntry(id: string, updates: Partial<InsertWatchlistEntry>): Promise<WatchlistEntry>;
  deactivateWatchlistEntry(id: string): Promise<WatchlistEntry>;

  createConsentPreference(preference: InsertConsentPreference): Promise<ConsentPreference>;
  getConsentPreference(id: string): Promise<ConsentPreference | null>;
  getConsentPreferencesByStore(storeId: string, consentType?: string): Promise<ConsentPreference[]>;
  checkConsent(storeId: string, subjectType: string, consentType: string, subjectId?: string): Promise<boolean>;
  updateConsentPreference(id: string, updates: Partial<InsertConsentPreference>): Promise<ConsentPreference>;
  withdrawConsent(id: string): Promise<ConsentPreference>;

  // Advanced AI Features - Predictive Analytics
  createPredictiveModelSnapshot(snapshot: InsertPredictiveModelSnapshot): Promise<PredictiveModelSnapshot>;
  getPredictiveModelSnapshot(id: string): Promise<PredictiveModelSnapshot | null>;
  getPredictiveModelSnapshotsByType(modelType: string): Promise<PredictiveModelSnapshot[]>;
  getActivePredictiveModelSnapshot(modelType: string): Promise<PredictiveModelSnapshot | null>;
  updatePredictiveModelSnapshot(id: string, updates: Partial<InsertPredictiveModelSnapshot>): Promise<PredictiveModelSnapshot>;

  createRiskScore(score: InsertRiskScore): Promise<RiskScore>;
  getRiskScore(id: string): Promise<RiskScore | null>;
  getRiskScoresByStore(storeId: string, scoreType?: string): Promise<RiskScore[]>;
  getCurrentRiskScores(storeId: string, scoreType?: string): Promise<RiskScore[]>;
  updateRiskScore(id: string, updates: Partial<InsertRiskScore>): Promise<RiskScore>;

  // Advanced AI Features - Privacy Audit Trail
  createAdvancedFeatureAuditLog(log: InsertAdvancedFeatureAuditLog): Promise<AdvancedFeatureAuditLog>;
  getAdvancedFeatureAuditLog(id: string): Promise<AdvancedFeatureAuditLog | null>;
  getAdvancedFeatureAuditLogsByUser(userId: string, featureType?: string): Promise<AdvancedFeatureAuditLog[]>;
  getAdvancedFeatureAuditLogsByStore(storeId: string, featureType?: string): Promise<AdvancedFeatureAuditLog[]>;
  getAdvancedFeatureAuditLogsByResource(resourceType: string, resourceId: string): Promise<AdvancedFeatureAuditLog[]>;

  // Predictive Analytics - Risk Assessments
  createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment>;
  getRiskAssessment(id: string): Promise<RiskAssessment | null>;
  getRiskAssessmentsByStore(storeId: string, limit?: number): Promise<RiskAssessment[]>;
  getLatestRiskAssessment(storeId: string): Promise<RiskAssessment | null>;
  updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment>;
  deleteRiskAssessment(id: string): Promise<void>;

  // Predictive Analytics - Seasonal Analyses
  createSeasonalAnalysis(analysis: InsertSeasonalAnalysis): Promise<SeasonalAnalysis>;
  getSeasonalAnalysis(id: string): Promise<SeasonalAnalysis | null>;
  getSeasonalAnalysesByTimespan(timespan: string, limit?: number): Promise<SeasonalAnalysis[]>;
  getLatestSeasonalAnalysis(timespan: string): Promise<SeasonalAnalysis | null>;
  updateSeasonalAnalysis(id: string, updates: Partial<InsertSeasonalAnalysis>): Promise<SeasonalAnalysis>;
  deleteSeasonalAnalysis(id: string): Promise<void>;

  // Predictive Analytics - Staffing Recommendations
  createStaffingRecommendation(recommendation: InsertStaffingRecommendation): Promise<StaffingRecommendation>;
  getStaffingRecommendation(id: string): Promise<StaffingRecommendation | null>;
  getStaffingRecommendationsByStore(storeId: string, status?: string, limit?: number): Promise<StaffingRecommendation[]>;
  getActiveStaffingRecommendations(storeId: string): Promise<StaffingRecommendation[]>;
  updateStaffingRecommendation(id: string, updates: Partial<InsertStaffingRecommendation>): Promise<StaffingRecommendation>;
  deleteStaffingRecommendation(id: string): Promise<void>;

  // Predictive Analytics - Incident Forecasts
  createIncidentForecast(forecast: InsertIncidentForecast): Promise<IncidentForecast>;
  getIncidentForecast(id: string): Promise<IncidentForecast | null>;
  getIncidentForecastsByStore(storeId: string, limit?: number): Promise<IncidentForecast[]>;
  getActiveIncidentForecasts(storeId: string): Promise<IncidentForecast[]>;
  getIncidentForecastsByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<IncidentForecast[]>;
  updateIncidentForecast(id: string, updates: Partial<InsertIncidentForecast>): Promise<IncidentForecast>;
  deleteIncidentForecast(id: string): Promise<void>;

  // Predictive Analytics - Model Performance
  createPredictiveModelPerformance(performance: InsertPredictiveModelPerformance): Promise<PredictiveModelPerformance>;
  getPredictiveModelPerformance(id: string): Promise<PredictiveModelPerformance | null>;
  getPredictiveModelPerformanceByModel(modelName: string, modelVersion?: string): Promise<PredictiveModelPerformance[]>;
  getLatestModelPerformance(modelName: string): Promise<PredictiveModelPerformance | null>;
  getAllModelPerformance(modelType?: string): Promise<PredictiveModelPerformance[]>;
  getStaffingRecommendation(id: string): Promise<StaffingRecommendation | null>;
  updateStaffingRecommendation(id: string, updates: Partial<InsertStaffingRecommendation>): Promise<StaffingRecommendation>;
  updatePredictiveModelPerformance(id: string, updates: Partial<InsertPredictiveModelPerformance>): Promise<PredictiveModelPerformance>;
  deleteModelPerformance(id: string): Promise<void>;

  // Session store
  sessionStore: any;
}

export class DatabaseStorage implements IStorage {
  sessionStore: any;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
    });
  }

  // =====================================
  // User Management
  // =====================================

  async createUser(user: InsertUser): Promise<User> {
    const userData = {
      ...user,
      profile: JsonBuilders.buildUserProfile(user.profile)
    };
    const [newUser] = await db.insert(users).values([userData]).returning();
    return newUser;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return user[0] || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user[0] || null;
  }

  async getUser(id: string): Promise<User | null> {
    const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user[0] || null;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      profile: JsonBuilders.buildUserProfile(updates.profile)
    };
    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async updateStripeCustomerId(userId: string, customerId: string): Promise<User> {
    // Note: Stripe data should be stored in stores.billingInfo or separate table
    // For now, just return the user unchanged
    const user = await this.getUser(userId);
    return user!;
  }

  async updateUserStripeInfo(userId: string, info: { customerId: string; subscriptionId: string }): Promise<User> {
    // Note: Stripe data should be stored in stores.billingInfo or separate table
    // For now, just return the user unchanged
    const user = await this.getUser(userId);
    return user!;
  }

  // =====================================
  // Store Management
  // =====================================

  async createStore(store: InsertStore): Promise<Store> {
    const storeData = {
      ...store,
      agentSettings: JsonBuilders.buildAgentSettings(store.agentSettings)
    };
    const [newStore] = await db.insert(stores).values([storeData]).returning();
    return newStore;
  }

  async getStore(id: string): Promise<Store | null> {
    const store = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
    return store[0] || null;
  }

  async getStoresByRegion(region?: string): Promise<Store[]> {
    // For MVP, return all stores (can add region filtering later)
    return await db.select().from(stores);
  }

  async updateStore(id: string, updates: Partial<InsertStore>): Promise<Store> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      agentSettings: JsonBuilders.buildAgentSettings(updates.agentSettings)
    };
    const [updatedStore] = await db
      .update(stores)
      .set(updateData)
      .where(eq(stores.id, id))
      .returning();
    return updatedStore;
  }

  async getStoreUsers(storeId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.storeId, storeId));
  }

  // =====================================
  // Alert & Detection System
  // =====================================

  async createAlert(alert: InsertAlert): Promise<Alert> {
    const alertData = {
      ...alert,
      ...JsonBuilders.buildAlertData(alert.location, alert.metadata)
    };
    const [newAlert] = await db.insert(alerts).values([alertData]).returning();
    return newAlert;
  }

  async getAlert(id: string): Promise<Alert | null> {
    const alert = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
    return alert[0] || null;
  }

  async getAlertsByStore(storeId: string, limit = 50): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.storeId, storeId))
      .orderBy(desc(alerts.createdAt))
      .limit(limit);
  }

  async getActiveAlerts(storeId?: string): Promise<Alert[]> {
    const baseCondition = eq(alerts.isActive, true);
    const whereCondition = storeId 
      ? and(eq(alerts.storeId, storeId), baseCondition)
      : baseCondition;

    return await db
      .select()
      .from(alerts)
      .where(whereCondition)
      .orderBy(desc(alerts.createdAt));
  }

  async updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert> {
    const updateData = {
      ...updates,
      ...JsonBuilders.buildAlertData(updates.location, updates.metadata)
    };
    const [updatedAlert] = await db
      .update(alerts)
      .set(updateData)
      .where(eq(alerts.id, id))
      .returning();
    return updatedAlert;
  }

  async getPendingReviewAlerts(): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.isActive, true), eq(alerts.isRead, false)))
      .orderBy(desc(alerts.createdAt));
  }

  // =====================================
  // Offender Management
  // =====================================

  async createOffender(offender: InsertOffender): Promise<Offender> {
    const offenderData = {
      ...offender,
      ...JsonBuilders.buildOffenderData(offender)
    };
    const [newOffender] = await db.insert(offenders).values([offenderData]).returning();
    return newOffender;
  }

  async getOffender(id: string): Promise<Offender | null> {
    const offender = await db.select().from(offenders).where(eq(offenders.id, id)).limit(1);
    return offender[0] || null;
  }

  async getOffendersByStore(storeId: string): Promise<Offender[]> {
    // Get offenders who have thefts at this store
    const results = await db
      .select({
        offender: offenders
      })
      .from(offenders)
      .innerJoin(thefts, eq(thefts.offenderId, offenders.id))
      .where(eq(thefts.storeId, storeId))
      .groupBy(offenders.id);
    return results.map(r => r.offender);
  }

  async getNetworkOffenders(excludeStoreId?: string): Promise<Offender[]> {
    return await db
      .select()
      .from(offenders)
      .where(eq(offenders.isNetworkApproved, true))
      .orderBy(desc(offenders.lastSeenAt));
  }

  async updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      aliases: updates.aliases ? Array.from(updates.aliases as string[]) : undefined,
      physicalDescription: JsonBuilders.buildConfigurationData(updates.physicalDescription),
      behaviorPatterns: updates.behaviorPatterns ? Array.from(updates.behaviorPatterns as string[]) : undefined,
      thumbnails: updates.thumbnails ? Array.from(updates.thumbnails as string[]) : undefined,
      confirmedIncidentIds: updates.confirmedIncidentIds ? Array.from(updates.confirmedIncidentIds as string[]) : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updatedOffender] = await db
      .update(offenders)
      .set(updateData)
      .where(eq(offenders.id, id))
      .returning();
    return updatedOffender;
  }

  async linkOffenderToUser(offenderId: string, userId: string): Promise<Offender> {
    return this.updateOffender(offenderId, { linkedUserId: userId });
  }

  // =====================================
  // Theft & Evidence Management
  // =====================================

  async createTheft(theft: InsertTheft): Promise<Theft> {
    const [newTheft] = await db.insert(thefts).values([theft]).returning();
    return newTheft;
  }

  async getTheft(id: string): Promise<Theft | null> {
    const theft = await db.select().from(thefts).where(eq(thefts.id, id)).limit(1);
    return theft[0] || null;
  }

  async getTheftsByOffender(offenderId: string): Promise<Theft[]> {
    return await db
      .select()
      .from(thefts)
      .where(eq(thefts.offenderId, offenderId))
      .orderBy(desc(thefts.incidentTimestamp));
  }

  async getTheftsByStore(storeId: string): Promise<Theft[]> {
    return await db
      .select()
      .from(thefts)
      .where(eq(thefts.storeId, storeId))
      .orderBy(desc(thefts.incidentTimestamp));
  }

  async updateTheft(id: string, updates: Partial<InsertTheft>): Promise<Theft> {
    const [updatedTheft] = await db
      .update(thefts)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(thefts.id, id))
      .returning();
    return updatedTheft;
  }

  async confirmTheft(id: string, confirmedBy: string): Promise<Theft> {
    return this.updateTheft(id, {
      confirmedBy,
      confirmedAt: new Date(),
      networkStatus: "APPROVED",
    });
  }

  // =====================================
  // Payment & Commission System
  // =====================================

  async createDebtPayment(payment: InsertDebtPayment): Promise<DebtPayment> {
    const [newPayment] = await db.insert(debtPayments).values([payment]).returning();
    return newPayment;
  }

  async getDebtPayment(id: string): Promise<DebtPayment | null> {
    const payment = await db.select().from(debtPayments).where(eq(debtPayments.id, id)).limit(1);
    return payment[0] || null;
  }

  async getPaymentsByOffender(offenderId: string): Promise<DebtPayment[]> {
    return await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.offenderId, offenderId))
      .orderBy(desc(debtPayments.createdAt));
  }

  async getPaymentsByStore(storeId: string): Promise<DebtPayment[]> {
    return await db
      .select()
      .from(debtPayments)
      .where(eq(debtPayments.storeId, storeId))
      .orderBy(desc(debtPayments.createdAt));
  }

  async updatePayment(id: string, updates: Partial<InsertDebtPayment>): Promise<DebtPayment> {
    const [updatedPayment] = await db
      .update(debtPayments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(debtPayments.id, id))
      .returning();
    return updatedPayment;
  }

  async markPaymentCompleted(id: string, stripeData: any): Promise<DebtPayment> {
    return this.updatePayment(id, {
      status: "COMPLETED",
      paidAt: new Date(),
      stripePaymentIntentId: stripeData.payment_intent_id,
    });
  }

  // =====================================
  // QR Token Management
  // =====================================

  async createQrToken(token: InsertQrToken): Promise<QrToken> {
    const [newToken] = await db.insert(qrTokens).values([token]).returning();
    return newToken;
  }

  async getQrToken(token: string): Promise<QrToken | null> {
    const qrToken = await db.select().from(qrTokens).where(eq(qrTokens.token, token)).limit(1);
    return qrToken[0] || null;
  }

  async markQrTokenUsed(token: string, userId: string): Promise<QrToken> {
    const [updatedToken] = await db
      .update(qrTokens)
      .set({
        isUsed: true,
        usedAt: new Date(),
        usedBy: userId,
      })
      .where(eq(qrTokens.token, token))
      .returning();
    return updatedToken;
  }

  // =====================================
  // Notification System
  // =====================================

  async createNotification(notification: any): Promise<any> {
    const [newNotification] = await db.insert(notifications).values([notification]).returning();
    return newNotification;
  }

  async getNotificationsByUser(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: string): Promise<any> {
    const [updatedNotification] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date(),
      })
      .where(eq(notifications.id, id))
      .returning();
    return updatedNotification;
  }

  // =====================================
  // Video Analysis Management
  // =====================================

  async createVideoAnalysis(analysis: {
    id: string;
    storeId: string;
    cameraId?: string | null;
    videoFilePath: string;
    analysisStatus: string;
    detectedFaces: any[];
    matchedOffenders: any[];
    confidenceScores: any;
    videoDurationSeconds?: number;
    analyzedAt?: Date;
  }): Promise<any> {
    // For MVP, we'll store in memory since the video_analyses table structure is complex
    // In production, insert into video_analyses table
    console.log(`Video analysis stored: ${analysis.id} for store ${analysis.storeId}`);
    return analysis;
  }

  async getVideoAnalysis(id: string): Promise<any | null> {
    // For MVP, return null - in production query video_analyses table
    console.log(`Looking up video analysis: ${id}`);
    return null;
  }

  async updateVideoAnalysis(id: string, updates: any): Promise<any> {
    // For MVP, return updates - in production update video_analyses table
    console.log(`Updating video analysis: ${id}`);
    return updates;
  }

  // =====================================
  // Multi-Agent Platform Management
  // =====================================

  // Organizations
  async createOrganization(org: InsertOrganization): Promise<Organization> {
    const orgData = {
      ...org,
      subscription: org.subscription ? {
        plan: org.subscription.plan as "free" | "starter" | "professional" | "enterprise",
        agents: Array.from(org.subscription.agents as string[]),
        limits: org.subscription.limits
      } : undefined,
      billingInfo: JsonBuilders.buildBillingInfo(org.billingInfo)
    };
    Object.keys(orgData).forEach(key => orgData[key as keyof typeof orgData] === undefined && delete orgData[key as keyof typeof orgData]);
    const [newOrg] = await db.insert(organizations).values([orgData]).returning();
    return newOrg;
  }

  async getOrganization(id: string): Promise<Organization | null> {
    const org = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
    return org[0] || null;
  }

  async updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      subscription: updates.subscription ? {
        plan: updates.subscription.plan as "free" | "starter" | "professional" | "enterprise",
        agents: Array.from(updates.subscription.agents as string[]),
        limits: updates.subscription.limits
      } : undefined,
      billingInfo: JsonBuilders.buildBillingInfo(updates.billingInfo)
    };
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updatedOrg] = await db
      .update(organizations)
      .set(updateData)
      .where(eq(organizations.id, id))
      .returning();
    return updatedOrg;
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return await db.select().from(agents).where(eq(agents.isActive, true));
  }

  async getAgent(id: string): Promise<Agent | null> {
    const agent = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
    return agent[0] || null;
  }

  async getAgentsByOrganization(organizationId: string): Promise<Agent[]> {
    // Get enabled agents for this organization based on agent configurations
    const results = await db
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        sector: agents.sector,
        icon: agents.icon,
        colorScheme: agents.colorScheme,
        features: agents.features,
        baseRoute: agents.baseRoute,
        isActive: agents.isActive,
        status: agents.status,
        minimumRole: agents.minimumRole,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt
      })
      .from(agents)
      .innerJoin(agentConfigurations, eq(agentConfigurations.agentId, agents.id))
      .where(
        and(
          eq(agentConfigurations.organizationId, organizationId),
          eq(agentConfigurations.isEnabled, true),
          eq(agents.isActive, true)
        )
      );
    return results as Agent[];
  }

  // User Agent Access
  async createUserAgentAccess(access: InsertUserAgentAccess): Promise<UserAgentAccess> {
    const accessData = {
      ...access,
      permissions: access.permissions ? Array.from(access.permissions as string[]) : []
    };
    const [newAccess] = await db.insert(userAgentAccess).values([accessData]).returning();
    return newAccess;
  }

  async getUserAgentAccess(userId: string, agentId: string): Promise<UserAgentAccess | null> {
    const access = await db
      .select()
      .from(userAgentAccess)
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.agentId, agentId)))
      .limit(1);
    return access[0] || null;
  }

  async getUserAgentsByUser(userId: string): Promise<UserAgentAccess[]> {
    const results = await db
      .select({
        id: userAgentAccess.id,
        userId: userAgentAccess.userId,
        agentId: userAgentAccess.agentId,
        role: userAgentAccess.role,
        permissions: userAgentAccess.permissions,
        isActive: userAgentAccess.isActive,
        grantedBy: userAgentAccess.grantedBy,
        grantedAt: userAgentAccess.grantedAt,
        createdAt: userAgentAccess.createdAt,
        agent: {
          id: agents.id,
          name: agents.name,
          isActive: agents.isActive,
          category: agents.sector,
          description: agents.description,
          baseRoute: agents.baseRoute,
          minimumRole: agents.minimumRole
        }
      })
      .from(userAgentAccess)
      .innerJoin(agents, eq(userAgentAccess.agentId, agents.id))
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.isActive, true)))
      .orderBy(userAgentAccess.grantedAt);
      
    return results as UserAgentAccess[];
  }

  async updateUserAgentAccess(id: string, updates: Partial<InsertUserAgentAccess>): Promise<UserAgentAccess> {
    const updateData = {
      ...updates,
      permissions: updates.permissions ? Array.from(updates.permissions as string[]) : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updatedAccess] = await db
      .update(userAgentAccess)
      .set(updateData)
      .where(eq(userAgentAccess.id, id))
      .returning();
    return updatedAccess;
  }

  async removeUserAgentAccess(userId: string, agentId: string): Promise<void> {
    await db
      .update(userAgentAccess)
      .set({ isActive: false })
      .where(and(eq(userAgentAccess.userId, userId), eq(userAgentAccess.agentId, agentId)));
  }

  // Agent Configurations
  async createAgentConfiguration(config: InsertAgentConfiguration): Promise<AgentConfiguration> {
    const configData = {
      ...config,
      settings: JsonBuilders.buildConfigurationData(config.settings)
    };
    const [newConfig] = await db.insert(agentConfigurations).values([configData]).returning();
    return newConfig;
  }

  async getAgentConfiguration(organizationId: string, agentId: string): Promise<AgentConfiguration | null> {
    const config = await db
      .select()
      .from(agentConfigurations)
      .where(
        and(
          eq(agentConfigurations.organizationId, organizationId),
          eq(agentConfigurations.agentId, agentId)
        )
      )
      .limit(1);
    const result = config[0] || null;
    return result || null;
  }

  async getOrganizationAgentConfigurations(organizationId: string): Promise<AgentConfiguration[]> {
    const configs = await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.organizationId, organizationId))
      .orderBy(agentConfigurations.createdAt);
    return configs;
  }

  async updateAgentConfiguration(id: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      settings: JsonBuilders.buildConfigurationData(updates.settings)
    };
    const [updatedConfig] = await db
      .update(agentConfigurations)
      .set(updateData)
      .where(eq(agentConfigurations.id, id))
      .returning();
    return updatedConfig;
  }

  // =====================================
  // Enhanced Alert Management (Security Agent)
  // =====================================

  async getAlertsByPriority(storeId: string, priority: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.storeId, storeId), eq(alerts.priority, priority)))
      .orderBy(desc(alerts.createdAt));
  }

  async getAlertsByStatus(storeId: string, status: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(and(eq(alerts.storeId, storeId), eq(alerts.status, status)))
      .orderBy(desc(alerts.createdAt));
  }

  async getAssignedAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.assignedTo, userId))
      .orderBy(desc(alerts.createdAt));
  }

  async assignAlert(id: string, userId: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        assignedTo: userId, 
        status: "IN_PROGRESS",
        updatedAt: new Date() 
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async acknowledgeAlert(id: string, userId: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        isRead: true,
        updatedAt: new Date()
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async resolveAlert(id: string, userId: string): Promise<Alert | null> {
    const now = new Date();
    const [updated] = await db
      .update(alerts)
      .set({ 
        resolvedBy: userId,
        resolvedAt: now,
        status: "RESOLVED",
        isActive: false,
        updatedAt: now
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async escalateAlert(id: string, reason: string): Promise<Alert | null> {
    const [updated] = await db
      .update(alerts)
      .set({ 
        status: "ESCALATED",
        priority: "urgent",
        metadata: sql`jsonb_set(COALESCE(metadata, '{}'), '{escalation_reason}', ${reason})`,
        updatedAt: new Date()
      })
      .where(eq(alerts.id, id))
      .returning();
    return updated || null;
  }

  async deleteAlert(id: string): Promise<boolean> {
    const result = await db
      .delete(alerts)
      .where(eq(alerts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // =====================================
  // Camera Management (Security Agent)
  // =====================================

  async getCamerasByStore(storeId: string): Promise<Camera[]> {
    return await db
      .select()
      .from(cameras)
      .where(and(eq(cameras.storeId, storeId), eq(cameras.isActive, true)))
      .orderBy(cameras.name);
  }

  async getCameraById(id: string): Promise<Camera | null> {
    const [camera] = await db
      .select()
      .from(cameras)
      .where(eq(cameras.id, id))
      .limit(1);
    return camera || null;
  }

  async getCamerasByStatus(storeId: string, status: string): Promise<Camera[]> {
    return await db
      .select()
      .from(cameras)
      .where(and(eq(cameras.storeId, storeId), eq(cameras.status, status)))
      .orderBy(cameras.name);
  }

  async createCamera(camera: InsertCamera): Promise<Camera> {
    const cameraData = {
      ...camera,
      capabilities: camera.capabilities ? Array.from(camera.capabilities as string[]) : []
    };
    const [newCamera] = await db
      .insert(cameras)
      .values([cameraData])
      .returning();
    return newCamera;
  }

  async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const updateData = {
      ...updates,
      capabilities: updates.capabilities ? Array.from(updates.capabilities as string[]) : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updated] = await db
      .update(cameras)
      .set(updateData)
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async updateCameraStatus(id: string, status: string): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ 
        status, 
        lastHeartbeat: new Date()
      })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async updateCameraHeartbeat(id: string): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ 
        lastHeartbeat: new Date(),
        status: "online"
      })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async deleteCamera(id: string): Promise<boolean> {
    const result = await db
      .update(cameras)
      .set({ isActive: false })
      .where(eq(cameras.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // =====================================
  // Incident Management (Security Agent)
  // =====================================

  async getIncidentsByStore(storeId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(eq(incidents.storeId, storeId))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentById(id: string): Promise<Incident | null> {
    const [incident] = await db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);
    return incident || null;
  }

  async getIncidentsByStatus(storeId: string, status: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(and(eq(incidents.storeId, storeId), eq(incidents.status, status)))
      .orderBy(desc(incidents.createdAt));
  }

  async getIncidentsByOffender(offenderId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(eq(incidents.offenderId, offenderId))
      .orderBy(desc(incidents.createdAt));
  }

  async createIncident(incident: InsertIncident): Promise<Incident> {
    const incidentData = {
      ...incident,
      ...JsonBuilders.buildIncidentData(incident)
    };
    const [newIncident] = await db
      .insert(incidents)
      .values([incidentData])
      .returning();
    return newIncident;
  }

  async updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async assignIncident(id: string, userId: string): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        assignedTo: userId, 
        status: "INVESTIGATING",
        updatedAt: new Date() 
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async addEvidenceToIncident(id: string, evidenceFiles: string[]): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        evidenceFiles: sql`COALESCE(evidence_files, '[]'::jsonb) || ${JSON.stringify(evidenceFiles)}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async addWitnessAccount(id: string, witness: { name: string; contact: string; statement: string }): Promise<Incident | null> {
    const witnessWithTimestamp = {
      ...witness,
      timestamp: new Date().toISOString()
    };
    
    const [updated] = await db
      .update(incidents)
      .set({ 
        witnessAccounts: sql`COALESCE(witness_accounts, '[]'::jsonb) || ${JSON.stringify([witnessWithTimestamp])}::jsonb`,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async resolveIncident(id: string, userId: string): Promise<Incident | null> {
    const [updated] = await db
      .update(incidents)
      .set({ 
        status: "RESOLVED",
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return updated || null;
  }

  async deleteIncident(id: string): Promise<boolean> {
    const result = await db
      .delete(incidents)
      .where(eq(incidents.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // =====================================
  // Sales Metrics Implementation
  // =====================================

  async getSalesMetrics(organizationId?: string): Promise<{
    totalSales: number;
    avgDealSize: number;
    conversionRate: number;
    pipelineValue: number;
    activeLeads: number;
  }> {
    // Get completed payments in last 30 days for totalSales
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const completedPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(organizationId 
        ? and(
            eq(debtPayments.status, "COMPLETED"),
            sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`,
            eq(stores.organizationId, organizationId)
          )
        : and(
            eq(debtPayments.status, "COMPLETED"),
            sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`
          )
      );
    
    const completedPayments = await completedPaymentsQuery;

    const totalSales = completedPayments.reduce((sum, payment) => 
      sum + parseFloat(payment.debtPayment.amount), 0);

    const avgDealSize = completedPayments.length > 0 ? 
      totalSales / completedPayments.length : 0;

    // Get all payments for conversion rate
    const allPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(organizationId ? eq(stores.organizationId, organizationId) : sql`1=1`);
    
    const allPayments = await allPaymentsQuery;
    const completed = allPayments.filter(p => p.debtPayment.status === "COMPLETED").length;
    const conversionRate = allPayments.length > 0 ? 
      (completed / allPayments.length) * 100 : 0;

    // Get pending payments for pipeline value
    const pendingPaymentsQuery = db
      .select({
        debtPayment: debtPayments,
        store: stores
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(organizationId 
        ? and(
            eq(debtPayments.status, "PENDING"),
            eq(stores.organizationId, organizationId)
          )
        : eq(debtPayments.status, "PENDING")
      );
    
    const pendingPayments = await pendingPaymentsQuery;

    const pendingValue = pendingPayments.reduce((sum, payment) => 
      sum + parseFloat(payment.debtPayment.amount), 0);

    // Get offenders with unpaid debt
    const offendersWithDebt = await db
      .select()
      .from(offenders)
      .where(sql`CAST(${offenders.totalDebt} AS DECIMAL) > CAST(${offenders.totalPaid} AS DECIMAL)`);

    const unpaidDebtValue = offendersWithDebt.reduce((sum, offender) => 
      sum + (parseFloat(offender.totalDebt || "0") - parseFloat(offender.totalPaid || "0")), 0);

    const pipelineValue = pendingValue + unpaidDebtValue;

    // Active leads: offenders with recent activity or unpaid debt
    const activeLeads = offendersWithDebt.length;

    return {
      totalSales,
      avgDealSize,
      conversionRate,
      pipelineValue,
      activeLeads
    };
  }

  async getRecentCompletedPayments(limit: number = 10, organizationId?: string): Promise<Array<DebtPayment & { offenderName?: string; storeName?: string }>> {
    const paymentsQuery = db
      .select({
        debtPayment: debtPayments,
        offenderName: offenders.name,
        storeName: stores.name
      })
      .from(debtPayments)
      .leftJoin(offenders, eq(debtPayments.offenderId, offenders.id))
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(organizationId 
        ? and(
            eq(debtPayments.status, "COMPLETED"),
            eq(stores.organizationId, organizationId)
          )
        : eq(debtPayments.status, "COMPLETED")
      )
      .orderBy(desc(debtPayments.paidAt))
      .limit(limit);
    
    const payments = await paymentsQuery;

    return payments.map(p => ({
      ...p.debtPayment,
      offenderName: p.offenderName || "Unknown",
      storeName: p.storeName || "Unknown Store"
    }));
  }

  async getPaymentsInLast30Days(organizationId?: string): Promise<DebtPayment[]> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const query = db
      .select({
        debtPayment: debtPayments
      })
      .from(debtPayments)
      .leftJoin(stores, eq(debtPayments.storeId, stores.id))
      .where(organizationId 
        ? and(
            eq(debtPayments.status, "COMPLETED"),
            sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`,
            eq(stores.organizationId, organizationId)
          )
        : and(
            eq(debtPayments.status, "COMPLETED"),
            sql`${debtPayments.paidAt} >= ${thirtyDaysAgo}`
          )
      )
      .orderBy(desc(debtPayments.paidAt));
    
    const result = await query;
    return result.map(r => r.debtPayment);
  }

  // =====================================
  // Operations Agent Dashboard Methods
  // =====================================

  async getOperationsMetrics(organizationId?: string): Promise<{
    systemUptime: number;
    avgResponseTime: number;
    totalProcesses: number;
    activeProcesses: number;
    completedTasks: number;
    failedTasks: number;
    infrastructureHealth: number;
    recentIncidents: number;
    efficiencyRate: number;
  }> {
    // Get processes for this organization
    const orgProcesses = await db
      .select()
      .from(processes)
      .where(organizationId ? eq(processes.organizationId, organizationId) : sql`1=1`);

    // Get infrastructure components
    const infraComponents = await db
      .select()
      .from(infrastructureComponents)
      .where(organizationId ? eq(infrastructureComponents.organizationId, organizationId) : sql`1=1`);

    // Get recent incidents (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentIncidents = await db
      .select()
      .from(operationalIncidents)
      .where(organizationId 
        ? and(
            sql`${operationalIncidents.detectedAt} >= ${sevenDaysAgo}`,
            eq(operationalIncidents.organizationId, organizationId)
          )
        : sql`${operationalIncidents.detectedAt} >= ${sevenDaysAgo}`
      );

    // Calculate metrics
    const totalProcesses = orgProcesses.length;
    const activeProcesses = orgProcesses.filter(p => p.status === 'running').length;
    const completedTasks = orgProcesses.filter(p => p.status === 'completed').length;
    const failedTasks = orgProcesses.filter(p => p.status === 'failed').length;

    // Calculate average infrastructure health
    const avgInfraHealth = infraComponents.length > 0 
      ? infraComponents.reduce((sum, comp) => sum + (comp.healthScore || 100), 0) / infraComponents.length
      : 100;

    // Calculate efficiency rate
    const totalFinishedTasks = completedTasks + failedTasks;
    const efficiencyRate = totalFinishedTasks > 0 ? (completedTasks / totalFinishedTasks) * 100 : 100;

    return {
      systemUptime: 99.7, // Mock uptime percentage
      avgResponseTime: 245, // Mock average response time in ms
      totalProcesses,
      activeProcesses,
      completedTasks,
      failedTasks,
      infrastructureHealth: Math.round(avgInfraHealth),
      recentIncidents: recentIncidents.length,
      efficiencyRate: Math.round(efficiencyRate * 10) / 10 // Round to 1 decimal
    };
  }

  // System Metrics Management
  async createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric> {
    const metricData = {
      ...metric,
      ...JsonBuilders.buildMetricData(metric)
    };
    const [newMetric] = await db.insert(systemMetrics).values([metricData]).returning();
    return newMetric;
  }

  async getSystemMetrics(organizationId: string, metricType?: string): Promise<SystemMetric[]> {
    return await db
      .select()
      .from(systemMetrics)
      .where(metricType 
        ? and(
            eq(systemMetrics.organizationId, organizationId),
            eq(systemMetrics.metricType, metricType)
          )
        : eq(systemMetrics.organizationId, organizationId)
      )
      .orderBy(desc(systemMetrics.collectedAt));
  }

  async getLatestSystemMetrics(organizationId: string): Promise<SystemMetric[]> {
    return await db
      .select()
      .from(systemMetrics)
      .where(eq(systemMetrics.organizationId, organizationId))
      .orderBy(desc(systemMetrics.collectedAt))
      .limit(20);
  }

  async updateSystemMetric(id: string, updates: Partial<InsertSystemMetric>): Promise<SystemMetric> {
    const updateData = {
      ...updates,
      ...JsonBuilders.buildMetricData(updates)
    };
    const [updated] = await db
      .update(systemMetrics)
      .set(updateData)
      .where(eq(systemMetrics.id, id))
      .returning();
    return updated;
  }

  // Process Management
  async createProcess(process: InsertProcess): Promise<Process> {
    const processData = {
      ...process,
      configuration: JsonBuilders.buildConfigurationData(process.configuration),
      results: JsonBuilders.buildConfigurationData(process.results)
    };
    const [newProcess] = await db.insert(processes).values([processData]).returning();
    return newProcess;
  }

  async getProcess(id: string): Promise<Process | null> {
    const result = await db.select().from(processes).where(eq(processes.id, id)).limit(1);
    return result[0] || null;
  }

  async getProcessesByOrganization(organizationId: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(eq(processes.organizationId, organizationId))
      .orderBy(desc(processes.createdAt));
  }

  async getProcessesByStatus(organizationId: string, status: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(and(
        eq(processes.organizationId, organizationId),
        eq(processes.status, status)
      ))
      .orderBy(desc(processes.createdAt));
  }

  async getActiveProcesses(organizationId: string): Promise<Process[]> {
    return await db
      .select()
      .from(processes)
      .where(and(
        eq(processes.organizationId, organizationId),
        or(
          eq(processes.status, 'running'),
          eq(processes.status, 'pending')
        )
      ))
      .orderBy(desc(processes.createdAt));
  }

  async updateProcess(id: string, updates: Partial<InsertProcess>): Promise<Process> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      configuration: JsonBuilders.buildConfigurationData(updates.configuration),
      results: JsonBuilders.buildConfigurationData(updates.results)
    };
    const [updated] = await db
      .update(processes)
      .set(updateData)
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  async startProcess(id: string, userId: string): Promise<Process> {
    const [updated] = await db
      .update(processes)
      .set({
        status: 'running',
        startedBy: userId,
        startedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  async completeProcess(id: string, userId: string, results?: any): Promise<Process> {
    const [updated] = await db
      .update(processes)
      .set({
        status: 'completed',
        progress: 100,
        completedBy: userId,
        completedAt: new Date(),
        results: results || {},
        updatedAt: new Date()
      })
      .where(eq(processes.id, id))
      .returning();
    return updated;
  }

  // Infrastructure Monitoring
  async createInfrastructureComponent(component: InsertInfrastructureComponent): Promise<InfrastructureComponent> {
    const componentData = {
      ...component,
      specifications: JsonBuilders.buildConfigurationData(component.specifications)
    };
    const [newComponent] = await db.insert(infrastructureComponents).values([componentData]).returning();
    return newComponent;
  }

  async getInfrastructureComponent(id: string): Promise<InfrastructureComponent | null> {
    const result = await db.select().from(infrastructureComponents).where(eq(infrastructureComponents.id, id)).limit(1);
    return result[0] || null;
  }

  async getInfrastructureComponentsByOrganization(organizationId: string): Promise<InfrastructureComponent[]> {
    return await db
      .select()
      .from(infrastructureComponents)
      .where(eq(infrastructureComponents.organizationId, organizationId))
      .orderBy(desc(infrastructureComponents.createdAt));
  }

  async getInfrastructureComponentsByStatus(organizationId: string, status: string): Promise<InfrastructureComponent[]> {
    return await db
      .select()
      .from(infrastructureComponents)
      .where(and(
        eq(infrastructureComponents.organizationId, organizationId),
        eq(infrastructureComponents.status, status)
      ))
      .orderBy(desc(infrastructureComponents.createdAt));
  }

  async updateInfrastructureComponent(id: string, updates: Partial<InsertInfrastructureComponent>): Promise<InfrastructureComponent> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      specifications: JsonBuilders.buildConfigurationData(updates.specifications)
    };
    const [updated] = await db
      .update(infrastructureComponents)
      .set(updateData)
      .where(eq(infrastructureComponents.id, id))
      .returning();
    return updated;
  }

  // Operational Incidents Management
  async createOperationalIncident(incident: InsertOperationalIncident): Promise<OperationalIncident> {
    const incidentData = {
      ...incident,
      affectedComponents: incident.affectedComponents ? Array.from(incident.affectedComponents as string[]) : [],
      affectedProcesses: incident.affectedProcesses ? Array.from(incident.affectedProcesses as string[]) : []
    };
    const [newIncident] = await db.insert(operationalIncidents).values([incidentData]).returning();
    return newIncident;
  }

  async getOperationalIncident(id: string): Promise<OperationalIncident | null> {
    const result = await db.select().from(operationalIncidents).where(eq(operationalIncidents.id, id)).limit(1);
    return result[0] || null;
  }

  async getOperationalIncidentsByOrganization(organizationId: string): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(eq(operationalIncidents.organizationId, organizationId))
      .orderBy(desc(operationalIncidents.detectedAt));
  }

  async getOperationalIncidentsByStatus(organizationId: string, status: string): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(and(
        eq(operationalIncidents.organizationId, organizationId),
        eq(operationalIncidents.status, status)
      ))
      .orderBy(desc(operationalIncidents.detectedAt));
  }

  async getRecentOperationalIncidents(organizationId: string, limit: number = 10): Promise<OperationalIncident[]> {
    return await db
      .select()
      .from(operationalIncidents)
      .where(eq(operationalIncidents.organizationId, organizationId))
      .orderBy(desc(operationalIncidents.detectedAt))
      .limit(limit);
  }

  async updateOperationalIncident(id: string, updates: Partial<InsertOperationalIncident>): Promise<OperationalIncident> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      affectedComponents: updates.affectedComponents ? Array.from(updates.affectedComponents as string[]) : undefined,
      affectedProcesses: updates.affectedProcesses ? Array.from(updates.affectedProcesses as string[]) : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updated] = await db
      .update(operationalIncidents)
      .set(updateData)
      .where(eq(operationalIncidents.id, id))
      .returning();
    return updated;
  }

  async resolveOperationalIncident(id: string, userId: string, resolution: string): Promise<OperationalIncident> {
    const [updated] = await db
      .update(operationalIncidents)
      .set({
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolution: resolution,
        updatedAt: new Date()
      })
      .where(eq(operationalIncidents.id, id))
      .returning();
    return updated;
  }

  // =====================================
  // HR Agent Dashboard Methods
  // =====================================

  async getHRMetrics(organizationId?: string): Promise<{
    totalEmployees: number;
    newHires: number;
    turnoverRate: number;
    satisfactionScore: number;
    openPositions: number;
    attendanceRate: number;
    avgPerformanceRating: number;
    completedTrainings: number;
    pendingReviews: number;
    diversityMetrics: {
      genderRatio: Record<string, number>;
      ethnicityRatio: Record<string, number>;
      ageGroups: Record<string, number>;
    };
  }> {
    // Get basic employee metrics
    const allEmployees = organizationId 
      ? await db.select().from(employees).where(eq(employees.organizationId, organizationId))
      : await db.select().from(employees);
    
    const activeEmployees = allEmployees.filter(emp => emp.status === 'active');
    const totalEmployees = activeEmployees.length;
    
    // Calculate new hires (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const newHires = allEmployees.filter(emp => 
      emp.startDate && new Date(emp.startDate) >= thirtyDaysAgo
    ).length;

    // Get open positions
    const openJobs = organizationId 
      ? await db.select().from(recruitmentJobs).where(and(
          eq(recruitmentJobs.status, 'open'),
          eq(recruitmentJobs.organizationId, organizationId)
        ))
      : await db.select().from(recruitmentJobs).where(eq(recruitmentJobs.status, 'open'));
    const openPositions = openJobs.reduce((sum, job) => sum + ((job.positionsToFill || 0) - (job.positionsFilled || 0)), 0);

    // Get performance reviews for ratings
    const reviews = organizationId 
      ? await db.select().from(performanceReviews).where(eq(performanceReviews.organizationId, organizationId))
      : await db.select().from(performanceReviews);
    const completedReviews = reviews.filter(r => r.status === 'completed' && r.overallRating);
    const avgPerformanceRating = completedReviews.length > 0 ? 
      completedReviews.reduce((sum, r) => sum + parseFloat(r.overallRating!), 0) / completedReviews.length : 0;
    
    const pendingReviews = reviews.filter(r => r.status === 'draft' || r.status === 'in_progress').length;

    // Get training completions
    const trainingCompletions_result = organizationId 
      ? await db.select().from(trainingCompletions).where(and(
          eq(trainingCompletions.status, 'completed'),
          eq(trainingCompletions.organizationId, organizationId)
        ))
      : await db.select().from(trainingCompletions).where(eq(trainingCompletions.status, 'completed'));
    const completedTrainings = trainingCompletions_result.length;

    // Calculate diversity metrics
    const genderRatio: Record<string, number> = {};
    const ethnicityRatio: Record<string, number> = {};
    const ageGroups: Record<string, number> = {};

    activeEmployees.forEach(emp => {
      // Gender ratio
      const gender = emp.diversityInfo?.gender || 'Not specified';
      genderRatio[gender] = (genderRatio[gender] || 0) + 1;

      // Ethnicity ratio
      const ethnicity = emp.diversityInfo?.ethnicity || 'Not specified';
      ethnicityRatio[ethnicity] = (ethnicityRatio[ethnicity] || 0) + 1;

      // Age groups
      const ageGroup = emp.diversityInfo?.ageGroup || 'Not specified';
      ageGroups[ageGroup] = (ageGroups[ageGroup] || 0) + 1;
    });

    return {
      totalEmployees,
      newHires,
      turnoverRate: totalEmployees > 0 ? (newHires / totalEmployees) * 100 : 0, // Simplified calculation
      satisfactionScore: 4.2, // Would come from survey data
      openPositions,
      attendanceRate: 96.8, // Would come from attendance tracking
      avgPerformanceRating,
      completedTrainings,
      pendingReviews,
      diversityMetrics: {
        genderRatio,
        ethnicityRatio,
        ageGroups
      }
    };
  }

  // Department Management
  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values([department]).returning();
    return newDepartment;
  }

  async getDepartment(id: string): Promise<Department | null> {
    const result = await db.select().from(departments).where(eq(departments.id, id)).limit(1);
    return result[0] || null;
  }

  async getDepartmentsByOrganization(organizationId: string): Promise<Department[]> {
    return await db
      .select()
      .from(departments)
      .where(and(eq(departments.organizationId, organizationId), eq(departments.isActive, true)))
      .orderBy(departments.name);
  }

  async updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department> {
    const [updated] = await db
      .update(departments)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning();
    return updated;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await db.update(departments).set({ isActive: false }).where(eq(departments.id, id));
    return true;
  }

  // Employee Management
  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const employeeData = {
      ...employee,
      ...JsonBuilders.buildEmployeeData(employee)
    };
    const [newEmployee] = await db.insert(employees).values([employeeData]).returning();
    return newEmployee;
  }

  async getEmployee(id: string): Promise<Employee | null> {
    const result = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    return result[0] || null;
  }

  async getEmployeesByOrganization(organizationId: string): Promise<Employee[]> {
    return await db
      .select()
      .from(employees)
      .where(and(eq(employees.organizationId, organizationId), eq(employees.isActive, true)))
      .orderBy(employees.lastName, employees.firstName);
  }

  async getEmployeesByDepartment(departmentId: string): Promise<Employee[]> {
    return await db
      .select()
      .from(employees)
      .where(and(eq(employees.departmentId, departmentId), eq(employees.isActive, true)))
      .orderBy(employees.lastName, employees.firstName);
  }

  async getEmployeesByStatus(organizationId: string, status: string): Promise<Employee[]> {
    return await db
      .select()
      .from(employees)
      .where(and(
        eq(employees.organizationId, organizationId),
        eq(employees.status, status),
        eq(employees.isActive, true)
      ))
      .orderBy(employees.lastName, employees.firstName);
  }

  async getEmployeesByManager(managerId: string): Promise<Employee[]> {
    return await db
      .select()
      .from(employees)
      .where(and(eq(employees.managerId, managerId), eq(employees.isActive, true)))
      .orderBy(employees.lastName, employees.firstName);
  }

  async updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      ...JsonBuilders.buildEmployeeData(updates)
    };
    const [updated] = await db
      .update(employees)
      .set(updateData)
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  async deactivateEmployee(id: string): Promise<Employee> {
    const [updated] = await db
      .update(employees)
      .set({ isActive: false, status: 'terminated', updatedAt: new Date() })
      .where(eq(employees.id, id))
      .returning();
    return updated;
  }

  // Performance Management
  async createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview> {
    const reviewData = {
      ...review,
      ratings: review.ratings ? {
        performance: review.ratings.performance as number,
        communication: review.ratings.communication as number,
        teamwork: review.ratings.teamwork as number,
        leadership: review.ratings.leadership as number,
        innovation: review.ratings.innovation as number,
        reliability: review.ratings.reliability as number,
        growthMindset: review.ratings.growthMindset as number
      } : null
    };
    const [newReview] = await db.insert(performanceReviews).values([reviewData]).returning();
    return newReview;
  }

  async getPerformanceReview(id: string): Promise<PerformanceReview | null> {
    const result = await db.select().from(performanceReviews).where(eq(performanceReviews.id, id)).limit(1);
    return result[0] || null;
  }

  async getPerformanceReviewsByEmployee(employeeId: string): Promise<PerformanceReview[]> {
    return await db
      .select()
      .from(performanceReviews)
      .where(eq(performanceReviews.employeeId, employeeId))
      .orderBy(desc(performanceReviews.reviewDate));
  }

  async getPerformanceReviewsByOrganization(organizationId: string): Promise<PerformanceReview[]> {
    return await db
      .select()
      .from(performanceReviews)
      .where(eq(performanceReviews.organizationId, organizationId))
      .orderBy(desc(performanceReviews.reviewDate));
  }

  async getPendingPerformanceReviews(organizationId: string): Promise<PerformanceReview[]> {
    return await db
      .select()
      .from(performanceReviews)
      .where(and(
        eq(performanceReviews.organizationId, organizationId),
        or(
          eq(performanceReviews.status, 'draft'),
          eq(performanceReviews.status, 'in_progress')
        )
      ))
      .orderBy(desc(performanceReviews.reviewDate));
  }

  async updatePerformanceReview(id: string, updates: Partial<InsertPerformanceReview>): Promise<PerformanceReview> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      ratings: updates.ratings ? {
        performance: updates.ratings.performance as number,
        communication: updates.ratings.communication as number,
        teamwork: updates.ratings.teamwork as number,
        leadership: updates.ratings.leadership as number,
        innovation: updates.ratings.innovation as number,
        reliability: updates.ratings.reliability as number,
        growthMindset: updates.ratings.growthMindset as number
      } : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updated] = await db
      .update(performanceReviews)
      .set(updateData)
      .where(eq(performanceReviews.id, id))
      .returning();
    return updated;
  }

  async submitPerformanceReview(id: string, userId: string): Promise<PerformanceReview> {
    const [updated] = await db
      .update(performanceReviews)
      .set({
        status: 'completed',
        submittedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(performanceReviews.id, id))
      .returning();
    return updated;
  }

  async createPerformanceGoal(goal: InsertPerformanceGoal): Promise<PerformanceGoal> {
    const goalData = {
      ...goal,
      metrics: goal.metrics ? {
        kpis: goal.metrics.kpis as Array<{ name: string; target: number; current: number; unit: string }>,
        milestones: goal.metrics.milestones as Array<{ name: string; dueDate: string; completed: boolean }>
      } : null
    };
    const [newGoal] = await db.insert(performanceGoals).values([goalData]).returning();
    return newGoal;
  }

  async getPerformanceGoal(id: string): Promise<PerformanceGoal | null> {
    const result = await db.select().from(performanceGoals).where(eq(performanceGoals.id, id)).limit(1);
    return result[0] || null;
  }

  async getPerformanceGoalsByEmployee(employeeId: string): Promise<PerformanceGoal[]> {
    return await db
      .select()
      .from(performanceGoals)
      .where(eq(performanceGoals.employeeId, employeeId))
      .orderBy(desc(performanceGoals.createdAt));
  }

  async getPerformanceGoalsByOrganization(organizationId: string): Promise<PerformanceGoal[]> {
    return await db
      .select()
      .from(performanceGoals)
      .where(eq(performanceGoals.organizationId, organizationId))
      .orderBy(desc(performanceGoals.createdAt));
  }

  async updatePerformanceGoal(id: string, updates: Partial<InsertPerformanceGoal>): Promise<PerformanceGoal> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      metrics: updates.metrics ? {
        kpis: updates.metrics.kpis as Array<{ name: string; target: number; current: number; unit: string }>,
        milestones: updates.metrics.milestones as Array<{ name: string; dueDate: string; completed: boolean }>
      } : undefined
    };
    // Remove undefined values
    Object.keys(updateData).forEach(key => updateData[key as keyof typeof updateData] === undefined && delete updateData[key as keyof typeof updateData]);
    const [updated] = await db
      .update(performanceGoals)
      .set(updateData)
      .where(eq(performanceGoals.id, id))
      .returning();
    return updated;
  }

  async completePerformanceGoal(id: string, userId: string): Promise<PerformanceGoal> {
    const [updated] = await db
      .update(performanceGoals)
      .set({
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(performanceGoals.id, id))
      .returning();
    return updated;
  }

  // Recruitment Management
  async createRecruitmentJob(job: InsertRecruitmentJob): Promise<RecruitmentJob> {
    const [newJob] = await db.insert(recruitmentJobs).values([job]).returning();
    return newJob;
  }

  async getRecruitmentJob(id: string): Promise<RecruitmentJob | null> {
    const result = await db.select().from(recruitmentJobs).where(eq(recruitmentJobs.id, id)).limit(1);
    return result[0] || null;
  }

  async getRecruitmentJobsByOrganization(organizationId: string): Promise<RecruitmentJob[]> {
    return await db
      .select()
      .from(recruitmentJobs)
      .where(and(eq(recruitmentJobs.organizationId, organizationId), eq(recruitmentJobs.isActive, true)))
      .orderBy(desc(recruitmentJobs.postedAt));
  }

  async getActiveRecruitmentJobs(organizationId: string): Promise<RecruitmentJob[]> {
    return await db
      .select()
      .from(recruitmentJobs)
      .where(and(
        eq(recruitmentJobs.organizationId, organizationId),
        eq(recruitmentJobs.status, 'open'),
        eq(recruitmentJobs.isActive, true)
      ))
      .orderBy(desc(recruitmentJobs.postedAt));
  }

  async updateRecruitmentJob(id: string, updates: Partial<InsertRecruitmentJob>): Promise<RecruitmentJob> {
    const [updated] = await db
      .update(recruitmentJobs)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recruitmentJobs.id, id))
      .returning();
    return updated;
  }

  async closeRecruitmentJob(id: string, userId: string): Promise<RecruitmentJob> {
    const [updated] = await db
      .update(recruitmentJobs)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(recruitmentJobs.id, id))
      .returning();
    return updated;
  }

  async createRecruitmentCandidate(candidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate> {
    const [newCandidate] = await db.insert(recruitmentCandidates).values([candidate]).returning();
    return newCandidate;
  }

  async getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | null> {
    const result = await db.select().from(recruitmentCandidates).where(eq(recruitmentCandidates.id, id)).limit(1);
    return result[0] || null;
  }

  async getRecruitmentCandidatesByJob(jobId: string): Promise<RecruitmentCandidate[]> {
    return await db
      .select()
      .from(recruitmentCandidates)
      .where(eq(recruitmentCandidates.jobId, jobId))
      .orderBy(desc(recruitmentCandidates.appliedAt));
  }

  async getRecruitmentCandidatesByOrganization(organizationId: string): Promise<RecruitmentCandidate[]> {
    return await db
      .select()
      .from(recruitmentCandidates)
      .where(eq(recruitmentCandidates.organizationId, organizationId))
      .orderBy(desc(recruitmentCandidates.appliedAt));
  }

  async updateRecruitmentCandidate(id: string, updates: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate> {
    const [updated] = await db
      .update(recruitmentCandidates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(recruitmentCandidates.id, id))
      .returning();
    return updated;
  }

  async moveRecruitmentCandidateToStage(id: string, stage: string): Promise<RecruitmentCandidate> {
    const [updated] = await db
      .update(recruitmentCandidates)
      .set({
        stage: stage,
        lastUpdated: new Date(),
        updatedAt: new Date()
      })
      .where(eq(recruitmentCandidates.id, id))
      .returning();
    return updated;
  }

  // Training Management
  async createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram> {
    const [newProgram] = await db.insert(trainingPrograms).values([program]).returning();
    return newProgram;
  }

  async getTrainingProgram(id: string): Promise<TrainingProgram | null> {
    const result = await db.select().from(trainingPrograms).where(eq(trainingPrograms.id, id)).limit(1);
    return result[0] || null;
  }

  async getTrainingProgramsByOrganization(organizationId: string): Promise<TrainingProgram[]> {
    return await db
      .select()
      .from(trainingPrograms)
      .where(and(eq(trainingPrograms.organizationId, organizationId), eq(trainingPrograms.isActive, true)))
      .orderBy(trainingPrograms.title);
  }

  async getActiveTrainingPrograms(organizationId: string): Promise<TrainingProgram[]> {
    return await db
      .select()
      .from(trainingPrograms)
      .where(and(eq(trainingPrograms.organizationId, organizationId), eq(trainingPrograms.isActive, true)))
      .orderBy(trainingPrograms.title);
  }

  async updateTrainingProgram(id: string, updates: Partial<InsertTrainingProgram>): Promise<TrainingProgram> {
    const [updated] = await db
      .update(trainingPrograms)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trainingPrograms.id, id))
      .returning();
    return updated;
  }

  async createTrainingCompletion(completion: InsertTrainingCompletion): Promise<TrainingCompletion> {
    const [newCompletion] = await db.insert(trainingCompletions).values([completion]).returning();
    return newCompletion;
  }

  async getTrainingCompletion(id: string): Promise<TrainingCompletion | null> {
    const result = await db.select().from(trainingCompletions).where(eq(trainingCompletions.id, id)).limit(1);
    return result[0] || null;
  }

  async getTrainingCompletionsByEmployee(employeeId: string): Promise<TrainingCompletion[]> {
    return await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.employeeId, employeeId))
      .orderBy(desc(trainingCompletions.enrolledAt));
  }

  async getTrainingCompletionsByProgram(programId: string): Promise<TrainingCompletion[]> {
    return await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.programId, programId))
      .orderBy(desc(trainingCompletions.enrolledAt));
  }

  async getTrainingCompletionsByOrganization(organizationId: string): Promise<TrainingCompletion[]> {
    return await db
      .select()
      .from(trainingCompletions)
      .where(eq(trainingCompletions.organizationId, organizationId))
      .orderBy(desc(trainingCompletions.enrolledAt));
  }

  async updateTrainingCompletion(id: string, updates: Partial<InsertTrainingCompletion>): Promise<TrainingCompletion> {
    const [updated] = await db
      .update(trainingCompletions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(trainingCompletions.id, id))
      .returning();
    return updated;
  }

  async completeTraining(id: string, score?: number, feedback?: any): Promise<TrainingCompletion> {
    const [updated] = await db
      .update(trainingCompletions)
      .set({
        status: 'completed',
        progress: 100,
        score: score ? score.toString() : undefined,
        feedback: feedback || {},
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(trainingCompletions.id, id))
      .returning();
    return updated;
  }

  // Engagement & Survey Management
  async createEngagementSurvey(survey: InsertEngagementSurvey): Promise<EngagementSurvey> {
    const [newSurvey] = await db.insert(engagementSurveys).values([survey]).returning();
    return newSurvey;
  }

  async getEngagementSurvey(id: string): Promise<EngagementSurvey | null> {
    const result = await db.select().from(engagementSurveys).where(eq(engagementSurveys.id, id)).limit(1);
    return result[0] || null;
  }

  async getEngagementSurveysByOrganization(organizationId: string): Promise<EngagementSurvey[]> {
    return await db
      .select()
      .from(engagementSurveys)
      .where(eq(engagementSurveys.organizationId, organizationId))
      .orderBy(desc(engagementSurveys.createdAt));
  }

  async getActiveEngagementSurveys(organizationId: string): Promise<EngagementSurvey[]> {
    return await db
      .select()
      .from(engagementSurveys)
      .where(and(
        eq(engagementSurveys.organizationId, organizationId),
        eq(engagementSurveys.status, 'active')
      ))
      .orderBy(desc(engagementSurveys.launchDate));
  }

  async updateEngagementSurvey(id: string, updates: Partial<InsertEngagementSurvey>): Promise<EngagementSurvey> {
    const [updated] = await db
      .update(engagementSurveys)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(engagementSurveys.id, id))
      .returning();
    return updated;
  }

  async createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse> {
    const [newResponse] = await db.insert(surveyResponses).values([response]).returning();
    return newResponse;
  }

  async getSurveyResponse(id: string): Promise<SurveyResponse | null> {
    const result = await db.select().from(surveyResponses).where(eq(surveyResponses.id, id)).limit(1);
    return result[0] || null;
  }

  async getSurveyResponsesBySurvey(surveyId: string): Promise<SurveyResponse[]> {
    return await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.surveyId, surveyId))
      .orderBy(desc(surveyResponses.submittedAt));
  }

  async getSurveyResponsesByEmployee(employeeId: string): Promise<SurveyResponse[]> {
    return await db
      .select()
      .from(surveyResponses)
      .where(eq(surveyResponses.employeeId, employeeId))
      .orderBy(desc(surveyResponses.submittedAt));
  }

  // HR Analytics & Metrics
  async createHrMetric(metric: InsertHrMetric): Promise<HrMetric> {
    const [newMetric] = await db.insert(hrMetrics).values([metric]).returning();
    return newMetric;
  }

  async getHrMetric(id: string): Promise<HrMetric | null> {
    const result = await db.select().from(hrMetrics).where(eq(hrMetrics.id, id)).limit(1);
    return result[0] || null;
  }

  async getHrMetricsByOrganization(organizationId: string, metricType?: string): Promise<HrMetric[]> {
    if (metricType) {
      return await db
        .select()
        .from(hrMetrics)
        .where(and(
          eq(hrMetrics.organizationId, organizationId),
          eq(hrMetrics.metricType, metricType)
        ))
        .orderBy(desc(hrMetrics.calculatedAt));
    }
    
    return await db
      .select()
      .from(hrMetrics)
      .where(eq(hrMetrics.organizationId, organizationId))
      .orderBy(desc(hrMetrics.calculatedAt));
  }

  async getLatestHrMetrics(organizationId: string): Promise<HrMetric[]> {
    return await db
      .select()
      .from(hrMetrics)
      .where(eq(hrMetrics.organizationId, organizationId))
      .orderBy(desc(hrMetrics.calculatedAt))
      .limit(20);
  }

  async updateHrMetric(id: string, updates: Partial<InsertHrMetric>): Promise<HrMetric> {
    const [updated] = await db
      .update(hrMetrics)
      .set({ ...updates, calculatedAt: new Date() })
      .where(eq(hrMetrics.id, id))
      .returning();
    return updated;
  }

  // AI Detection Methods (stub implementations for compilation)
  async createAiDetection(detection: InsertAiDetection): Promise<AiDetection> {
    const [newDetection] = await db.insert(aiDetections).values([detection]).returning();
    return newDetection;
  }

  async getAiDetection(id: string): Promise<AiDetection | null> {
    const result = await db.select().from(aiDetections).where(eq(aiDetections.id, id)).limit(1);
    return result[0] || null;
  }

  async getAiDetectionsByStore(storeId: string, limit: number = 50): Promise<AiDetection[]> {
    return await db
      .select()
      .from(aiDetections)
      .where(eq(aiDetections.storeId, storeId))
      .orderBy(desc(aiDetections.frameTimestamp))
      .limit(limit);
  }

  async getAiDetectionsByCamera(cameraId: string, limit: number = 50): Promise<AiDetection[]> {
    return await db
      .select()
      .from(aiDetections)
      .where(eq(aiDetections.cameraId, cameraId))
      .orderBy(desc(aiDetections.frameTimestamp))
      .limit(limit);
  }

  async getAiDetectionsByType(storeId: string, detectionType: string): Promise<AiDetection[]> {
    return await db
      .select()
      .from(aiDetections)
      .where(and(
        eq(aiDetections.storeId, storeId),
        eq(aiDetections.detectionType, detectionType)
      ))
      .orderBy(desc(aiDetections.frameTimestamp));
  }

  async getAiDetectionsByConfidence(storeId: string, minConfidence: number): Promise<AiDetection[]> {
    return await db
      .select()
      .from(aiDetections)
      .where(and(
        eq(aiDetections.storeId, storeId),
        sql`confidence >= ${minConfidence}`
      ))
      .orderBy(desc(aiDetections.frameTimestamp));
  }

  async updateAiDetection(id: string, updates: Partial<InsertAiDetection>): Promise<AiDetection> {
    const [updated] = await db
      .update(aiDetections)
      .set(updates)
      .where(eq(aiDetections.id, id))
      .returning();
    return updated;
  }

  async getThreatClassificationsByStore(storeId: string): Promise<ThreatClassification[]> {
    return await db
      .select()
      .from(threatClassifications)
      .where(eq(threatClassifications.storeId, storeId))
      .orderBy(desc(threatClassifications.createdAt));
  }

  async getVideoAnalyticsByStore(storeId: string, limit: number = 50): Promise<VideoAnalytics[]> {
    return await db
      .select()
      .from(videoAnalytics)
      .where(eq(videoAnalytics.storeId, storeId))
      .orderBy(desc(videoAnalytics.startTime))
      .limit(limit);
  }

  // =====================================
  // COMPREHENSIVE INCIDENT MANAGEMENT METHODS
  // =====================================

  // Enhanced Incident CRUD Operations
  async getIncident(id: string): Promise<Incident | null> {
    return this.getIncidentById(id); // Use existing method
  }

  async getStoreIncidents(storeId: string, filters?: {
    status?: string;
    priority?: string;
    assignedTo?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<Incident[]> {
    // Build conditions array properly to avoid overwriting filters
    const conditions = [eq(incidents.storeId, storeId)];
    
    // Add filter conditions dynamically
    if (filters?.status) {
      conditions.push(eq(incidents.status, filters.status));
    }
    if (filters?.priority) {
      conditions.push(eq(incidents.priority, filters.priority));
    }
    if (filters?.assignedTo) {
      conditions.push(eq(incidents.assignedTo, filters.assignedTo));
    }
    if (filters?.dateFrom) {
      conditions.push(sql`${incidents.createdAt} >= ${filters.dateFrom}`);
    }
    if (filters?.dateTo) {
      conditions.push(sql`${incidents.createdAt} <= ${filters.dateTo}`);
    }
    
    // Combine all conditions with AND
    return await db
      .select()
      .from(incidents)
      .where(and(...conditions))
      .orderBy(desc(incidents.createdAt));
  }

  async getActiveIncidents(): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(or(
        eq(incidents.status, "OPEN"),
        eq(incidents.status, "INVESTIGATING")
      ))
      .orderBy(desc(incidents.createdAt));
  }

  async getUserActiveIncidents(userId: string): Promise<Incident[]> {
    return await db
      .select()
      .from(incidents)
      .where(and(
        eq(incidents.assignedTo, userId),
        or(
          eq(incidents.status, "OPEN"),
          eq(incidents.status, "INVESTIGATING")
        )
      ))
      .orderBy(desc(incidents.createdAt));
  }

  async getUserRecentIncidents(userId: string, days: number = 30): Promise<Incident[]> {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);
    
    return await db
      .select()
      .from(incidents)
      .where(and(
        eq(incidents.assignedTo, userId),
        sql`${incidents.createdAt} >= ${daysAgo}`
      ))
      .orderBy(desc(incidents.createdAt));
  }

  async getRecentIncidentActivity(storeId: string, limit: number = 50): Promise<IncidentTimeline[]> {
    return await db
      .select()
      .from(incidentTimeline)
      .innerJoin(incidents, eq(incidentTimeline.incidentId, incidents.id))
      .where(eq(incidents.storeId, storeId))
      .orderBy(desc(incidentTimeline.timestamp))
      .limit(limit);
  }

  // Incident Timeline Management
  async createIncidentTimelineEvent(event: InsertIncidentTimeline): Promise<IncidentTimeline> {
    const [newEvent] = await db.insert(incidentTimeline).values([event]).returning();
    return newEvent;
  }

  async getIncidentTimeline(incidentId: string): Promise<IncidentTimeline[]> {
    return await db
      .select()
      .from(incidentTimeline)
      .where(eq(incidentTimeline.incidentId, incidentId))
      .orderBy(desc(incidentTimeline.timestamp));
  }

  async updateIncidentTimelineEvent(id: string, updates: Partial<InsertIncidentTimeline>): Promise<IncidentTimeline> {
    const [updated] = await db
      .update(incidentTimeline)
      .set(updates)
      .where(eq(incidentTimeline.id, id))
      .returning();
    return updated;
  }

  // Evidence Chain Management
  async createEvidenceChain(evidence: InsertEvidenceChain): Promise<EvidenceChain> {
    const evidenceData = {
      ...evidence,
      chainOfCustody: JsonBuilders.toStorageJSON(evidence.chainOfCustody),
      metadata: JsonBuilders.toStorageJSON(evidence.metadata)
    };
    const [newEvidence] = await db.insert(evidenceChain).values([evidenceData]).returning();
    return newEvidence;
  }

  async getEvidenceChain(id: string): Promise<EvidenceChain | null> {
    const result = await db.select().from(evidenceChain).where(eq(evidenceChain.id, id)).limit(1);
    return result[0] || null;
  }

  async getIncidentEvidence(incidentId: string): Promise<EvidenceChain[]> {
    return await db
      .select()
      .from(evidenceChain)
      .where(eq(evidenceChain.incidentId, incidentId))
      .orderBy(desc(evidenceChain.collectedAt));
  }

  async updateEvidenceChain(id: string, updates: Partial<InsertEvidenceChain>): Promise<EvidenceChain> {
    const updateData = {
      ...updates,
      chainOfCustody: JsonBuilders.toStorageJSON(updates.chainOfCustody),
      metadata: JsonBuilders.toStorageJSON(updates.metadata)
    };
    const [updated] = await db
      .update(evidenceChain)
      .set(updateData)
      .where(eq(evidenceChain.id, id))
      .returning();
    return updated;
  }

  // User and Store Helper Methods - Duplicate removed

  async getUserById(userId: string): Promise<User | null> {
    const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return result[0] || null;
  }

  // Incident Response Management  
  async createIncidentResponse(response: InsertIncidentResponse): Promise<IncidentResponse> {
    const responseData = {
      ...response,
      response: JsonBuilders.toStorageJSON(response.response),
      metadata: JsonBuilders.toStorageJSON(response.metadata)
    };
    const [newResponse] = await db.insert(incidentResponse).values([responseData]).returning();
    return newResponse;
  }

  async getIncidentResponse(id: string): Promise<IncidentResponse | null> {
    const result = await db.select().from(incidentResponse).where(eq(incidentResponse.id, id)).limit(1);
    return result[0] || null;
  }

  async getIncidentResponsesByIncident(incidentId: string): Promise<IncidentResponse[]> {
    return await db
      .select()
      .from(incidentResponse)
      .where(eq(incidentResponse.incidentId, incidentId))
      .orderBy(desc(incidentResponse.responseAt));
  }

  async updateIncidentResponse(id: string, updates: Partial<InsertIncidentResponse>): Promise<IncidentResponse> {
    const updateData = {
      ...updates,
      response: JsonBuilders.toStorageJSON(updates.response),
      metadata: JsonBuilders.toStorageJSON(updates.metadata)
    };
    const [updated] = await db
      .update(incidentResponse)
      .set(updateData)
      .where(eq(incidentResponse.id, id))
      .returning();
    return updated;
  }

  // =====================================
  // Advanced AI Features - Behavioral Pattern Learning
  // =====================================

  async createBehaviorEvent(event: InsertBehaviorEvent): Promise<BehaviorEvent> {
    const eventData = {
      ...event,
      metadata: JsonBuilders.toStorageJSON(event.metadata)
    };
    const [newEvent] = await db.insert(behaviorEvents).values([eventData]).returning();
    return newEvent;
  }

  async getBehaviorEvent(id: string): Promise<BehaviorEvent | null> {
    const result = await db.select().from(behaviorEvents).where(eq(behaviorEvents.id, id)).limit(1);
    return result[0] || null;
  }

  async getBehaviorEventsByStore(storeId: string, eventType?: string): Promise<BehaviorEvent[]> {
    const conditions = [eq(behaviorEvents.storeId, storeId)];
    if (eventType) {
      conditions.push(eq(behaviorEvents.eventType, eventType));
    }
    return await db
      .select()
      .from(behaviorEvents)
      .where(and(...conditions))
      .orderBy(desc(behaviorEvents.timestamp));
  }

  async getBehaviorEventsByCamera(cameraId: string, eventType?: string): Promise<BehaviorEvent[]> {
    const conditions = [eq(behaviorEvents.cameraId, cameraId)];
    if (eventType) {
      conditions.push(eq(behaviorEvents.eventType, eventType));
    }
    return await db
      .select()
      .from(behaviorEvents)
      .where(and(...conditions))
      .orderBy(desc(behaviorEvents.timestamp));
  }

  async updateBehaviorEvent(id: string, updates: Partial<InsertBehaviorEvent>): Promise<BehaviorEvent> {
    const updateData = {
      ...updates,
      metadata: JsonBuilders.toStorageJSON(updates.metadata)
    };
    const [updated] = await db
      .update(behaviorEvents)
      .set(updateData)
      .where(eq(behaviorEvents.id, id))
      .returning();
    return updated;
  }

  async createAreaBaselineProfile(profile: InsertAreaBaselineProfile): Promise<AreaBaselineProfile> {
    const [newProfile] = await db.insert(areaBaselineProfiles).values([profile]).returning();
    return newProfile;
  }

  async getAreaBaselineProfile(id: string): Promise<AreaBaselineProfile | null> {
    const result = await db.select().from(areaBaselineProfiles).where(eq(areaBaselineProfiles.id, id)).limit(1);
    return result[0] || null;
  }

  async getAreaBaselineProfilesByStore(storeId: string): Promise<AreaBaselineProfile[]> {
    return await db
      .select()
      .from(areaBaselineProfiles)
      .where(eq(areaBaselineProfiles.storeId, storeId))
      .orderBy(areaBaselineProfiles.area, areaBaselineProfiles.timeWindow);
  }

  async getAreaBaselineProfileByKey(storeId: string, area: string, timeWindow: string, eventType: string): Promise<AreaBaselineProfile | null> {
    const result = await db
      .select()
      .from(areaBaselineProfiles)
      .where(and(
        eq(areaBaselineProfiles.storeId, storeId),
        eq(areaBaselineProfiles.area, area),
        eq(areaBaselineProfiles.timeWindow, timeWindow),
        eq(areaBaselineProfiles.eventType, eventType)
      ))
      .limit(1);
    return result[0] || null;
  }

  async updateAreaBaselineProfile(id: string, updates: Partial<InsertAreaBaselineProfile>): Promise<AreaBaselineProfile> {
    const [updated] = await db
      .update(areaBaselineProfiles)
      .set(updates)
      .where(eq(areaBaselineProfiles.id, id))
      .returning();
    return updated;
  }

  async createAnomalyEvent(anomaly: InsertAnomalyEvent): Promise<AnomalyEvent> {
    const [newAnomaly] = await db.insert(anomalyEvents).values([anomaly]).returning();
    return newAnomaly;
  }

  async getAnomalyEvent(id: string): Promise<AnomalyEvent | null> {
    const result = await db.select().from(anomalyEvents).where(eq(anomalyEvents.id, id)).limit(1);
    return result[0] || null;
  }

  async getAnomalyEventsByStore(storeId: string, severity?: string): Promise<AnomalyEvent[]> {
    const conditions = [eq(anomalyEvents.storeId, storeId)];
    if (severity) {
      conditions.push(eq(anomalyEvents.severity, severity));
    }
    return await db
      .select()
      .from(anomalyEvents)
      .where(and(...conditions))
      .orderBy(desc(anomalyEvents.timestamp));
  }

  async getAnomalyEventsByCamera(cameraId: string): Promise<AnomalyEvent[]> {
    return await db
      .select()
      .from(anomalyEvents)
      .where(eq(anomalyEvents.cameraId, cameraId))
      .orderBy(desc(anomalyEvents.timestamp));
  }

  async updateAnomalyEvent(id: string, updates: Partial<InsertAnomalyEvent>): Promise<AnomalyEvent> {
    const [updated] = await db
      .update(anomalyEvents)
      .set(updates)
      .where(eq(anomalyEvents.id, id))
      .returning();
    return updated;
  }

  // =====================================
  // Advanced AI Features - Facial Recognition (Privacy-Compliant)
  // =====================================

  async createFaceTemplate(template: InsertFaceTemplate): Promise<FaceTemplate> {
    const [newTemplate] = await db.insert(faceTemplates).values([template]).returning();
    return newTemplate;
  }

  async getFaceTemplate(id: string): Promise<FaceTemplate | null> {
    const result = await db.select().from(faceTemplates).where(eq(faceTemplates.id, id)).limit(1);
    return result[0] || null;
  }

  async getFaceTemplatesByStore(storeId: string, personType?: string): Promise<FaceTemplate[]> {
    const conditions = [eq(faceTemplates.storeId, storeId)];
    if (personType) {
      conditions.push(eq(faceTemplates.personType, personType));
    }
    return await db
      .select()
      .from(faceTemplates)
      .where(and(...conditions))
      .orderBy(desc(faceTemplates.createdAt));
  }

  async updateFaceTemplate(id: string, updates: Partial<InsertFaceTemplate>): Promise<FaceTemplate> {
    const [updated] = await db
      .update(faceTemplates)
      .set(updates)
      .where(eq(faceTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteFaceTemplate(id: string): Promise<void> {
    await db.delete(faceTemplates).where(eq(faceTemplates.id, id));
  }

  async createWatchlistEntry(entry: InsertWatchlistEntry): Promise<WatchlistEntry> {
    const [newEntry] = await db.insert(watchlistEntries).values([entry]).returning();
    return newEntry;
  }

  async getWatchlistEntry(id: string): Promise<WatchlistEntry | null> {
    const result = await db.select().from(watchlistEntries).where(eq(watchlistEntries.id, id)).limit(1);
    return result[0] || null;
  }

  async getWatchlistEntriesByStore(storeId: string, riskLevel?: string): Promise<WatchlistEntry[]> {
    const conditions = [eq(watchlistEntries.storeId, storeId)];
    if (riskLevel) {
      conditions.push(eq(watchlistEntries.riskLevel, riskLevel));
    }
    return await db
      .select()
      .from(watchlistEntries)
      .where(and(...conditions))
      .orderBy(desc(watchlistEntries.createdAt));
  }

  async getActiveWatchlistEntriesByStore(storeId: string): Promise<WatchlistEntry[]> {
    return await db
      .select()
      .from(watchlistEntries)
      .where(and(
        eq(watchlistEntries.storeId, storeId),
        eq(watchlistEntries.isActive, true)
      ))
      .orderBy(desc(watchlistEntries.createdAt));
  }

  async updateWatchlistEntry(id: string, updates: Partial<InsertWatchlistEntry>): Promise<WatchlistEntry> {
    const [updated] = await db
      .update(watchlistEntries)
      .set(updates)
      .where(eq(watchlistEntries.id, id))
      .returning();
    return updated;
  }

  async deactivateWatchlistEntry(id: string): Promise<WatchlistEntry> {
    const [updated] = await db
      .update(watchlistEntries)
      .set({ isActive: false })
      .where(eq(watchlistEntries.id, id))
      .returning();
    return updated;
  }

  async createConsentPreference(preference: InsertConsentPreference): Promise<ConsentPreference> {
    const [newPreference] = await db.insert(consentPreferences).values([preference]).returning();
    return newPreference;
  }

  async getConsentPreference(id: string): Promise<ConsentPreference | null> {
    const result = await db.select().from(consentPreferences).where(eq(consentPreferences.id, id)).limit(1);
    return result[0] || null;
  }

  async getConsentPreferencesByStore(storeId: string, consentType?: string): Promise<ConsentPreference[]> {
    const conditions = [eq(consentPreferences.storeId, storeId)];
    if (consentType) {
      conditions.push(eq(consentPreferences.consentType, consentType));
    }
    return await db
      .select()
      .from(consentPreferences)
      .where(and(...conditions))
      .orderBy(desc(consentPreferences.consentDate));
  }

  async checkConsent(storeId: string, subjectType: string, consentType: string, subjectId?: string): Promise<boolean> {
    const conditions = [
      eq(consentPreferences.storeId, storeId),
      eq(consentPreferences.subjectType, subjectType),
      eq(consentPreferences.consentType, consentType),
      eq(consentPreferences.consentGiven, true),
      isNull(consentPreferences.withdrawnDate)
    ];
    
    if (subjectId) {
      conditions.push(eq(consentPreferences.subjectId, subjectId));
    }

    const result = await db
      .select()
      .from(consentPreferences)
      .where(and(...conditions))
      .limit(1);
    
    return result.length > 0;
  }

  async updateConsentPreference(id: string, updates: Partial<InsertConsentPreference>): Promise<ConsentPreference> {
    const [updated] = await db
      .update(consentPreferences)
      .set(updates)
      .where(eq(consentPreferences.id, id))
      .returning();
    return updated;
  }

  async withdrawConsent(id: string): Promise<ConsentPreference> {
    const [updated] = await db
      .update(consentPreferences)
      .set({ 
        consentGiven: false, 
        withdrawnDate: new Date() 
      })
      .where(eq(consentPreferences.id, id))
      .returning();
    return updated;
  }

  // =====================================
  // Advanced AI Features - Predictive Analytics
  // =====================================

  async createPredictiveModelSnapshot(snapshot: InsertPredictiveModelSnapshot): Promise<PredictiveModelSnapshot> {
    const snapshotData = {
      ...snapshot,
      hyperparameters: JsonBuilders.toStorageJSON(snapshot.hyperparameters),
      performance: JsonBuilders.toStorageJSON(snapshot.performance)
    };
    const [newSnapshot] = await db.insert(predictiveModelSnapshots).values([snapshotData]).returning();
    return newSnapshot;
  }

  async getPredictiveModelSnapshot(id: string): Promise<PredictiveModelSnapshot | null> {
    const result = await db.select().from(predictiveModelSnapshots).where(eq(predictiveModelSnapshots.id, id)).limit(1);
    return result[0] || null;
  }

  async getPredictiveModelSnapshotsByType(modelType: string): Promise<PredictiveModelSnapshot[]> {
    return await db
      .select()
      .from(predictiveModelSnapshots)
      .where(eq(predictiveModelSnapshots.modelType, modelType))
      .orderBy(desc(predictiveModelSnapshots.createdAt));
  }

  async getActivePredictiveModelSnapshot(modelType: string): Promise<PredictiveModelSnapshot | null> {
    const result = await db
      .select()
      .from(predictiveModelSnapshots)
      .where(and(
        eq(predictiveModelSnapshots.modelType, modelType),
        eq(predictiveModelSnapshots.isActive, true)
      ))
      .orderBy(desc(predictiveModelSnapshots.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async updatePredictiveModelSnapshot(id: string, updates: Partial<InsertPredictiveModelSnapshot>): Promise<PredictiveModelSnapshot> {
    const updateData = {
      ...updates,
      hyperparameters: JsonBuilders.toStorageJSON(updates.hyperparameters),
      performance: JsonBuilders.toStorageJSON(updates.performance)
    };
    const [updated] = await db
      .update(predictiveModelSnapshots)
      .set(updateData)
      .where(eq(predictiveModelSnapshots.id, id))
      .returning();
    return updated;
  }

  async createRiskScore(score: InsertRiskScore): Promise<RiskScore> {
    const scoreData = {
      ...score,
      contributingFactors: JsonBuilders.buildContributingFactors(score.contributingFactors)
    };
    const [newScore] = await db.insert(riskScores).values([scoreData]).returning();
    return newScore;
  }

  async getRiskScore(id: string): Promise<RiskScore | null> {
    const result = await db.select().from(riskScores).where(eq(riskScores.id, id)).limit(1);
    return result[0] || null;
  }

  async getRiskScoresByStore(storeId: string, scoreType?: string): Promise<RiskScore[]> {
    const conditions = [eq(riskScores.storeId, storeId)];
    if (scoreType) {
      conditions.push(eq(riskScores.scoreType, scoreType));
    }
    return await db
      .select()
      .from(riskScores)
      .where(and(...conditions))
      .orderBy(desc(riskScores.validFrom));
  }

  async getCurrentRiskScores(storeId: string, scoreType?: string): Promise<RiskScore[]> {
    const now = new Date();
    const conditions = [
      eq(riskScores.storeId, storeId),
      sql`${riskScores.validFrom} <= ${now}`,
      sql`${riskScores.validTo} > ${now}`
    ];
    if (scoreType) {
      conditions.push(eq(riskScores.scoreType, scoreType));
    }
    return await db
      .select()
      .from(riskScores)
      .where(and(...conditions))
      .orderBy(desc(riskScores.riskScore));
  }

  async updateRiskScore(id: string, updates: Partial<InsertRiskScore>): Promise<RiskScore> {
    const updateData = {
      ...updates,
      contributingFactors: JsonBuilders.buildContributingFactors(updates.contributingFactors)
    };
    const [updated] = await db
      .update(riskScores)
      .set(updateData)
      .where(eq(riskScores.id, id))
      .returning();
    return updated;
  }

  // =====================================
  // Advanced AI Features - Privacy Audit Trail
  // =====================================

  async createAdvancedFeatureAuditLog(log: InsertAdvancedFeatureAuditLog): Promise<AdvancedFeatureAuditLog> {
    const logData = {
      ...log,
      details: JsonBuilders.toStorageJSON(log.details)
    };
    const [newLog] = await db.insert(advancedFeatureAuditLog).values([logData]).returning();
    return newLog;
  }

  async getAdvancedFeatureAuditLog(id: string): Promise<AdvancedFeatureAuditLog | null> {
    const result = await db.select().from(advancedFeatureAuditLog).where(eq(advancedFeatureAuditLog.id, id)).limit(1);
    return result[0] || null;
  }

  async getAdvancedFeatureAuditLogsByUser(userId: string, featureType?: string): Promise<AdvancedFeatureAuditLog[]> {
    const conditions = [eq(advancedFeatureAuditLog.userId, userId)];
    if (featureType) {
      conditions.push(eq(advancedFeatureAuditLog.featureType, featureType));
    }
    return await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(...conditions))
      .orderBy(desc(advancedFeatureAuditLog.timestamp));
  }

  async getAdvancedFeatureAuditLogsByStore(storeId: string, featureType?: string): Promise<AdvancedFeatureAuditLog[]> {
    const conditions = [eq(advancedFeatureAuditLog.storeId, storeId)];
    if (featureType) {
      conditions.push(eq(advancedFeatureAuditLog.featureType, featureType));
    }
    return await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(...conditions))
      .orderBy(desc(advancedFeatureAuditLog.timestamp));
  }

  async getAdvancedFeatureAuditLogsByResource(resourceType: string, resourceId: string): Promise<AdvancedFeatureAuditLog[]> {
    return await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(
        eq(advancedFeatureAuditLog.resourceType, resourceType),
        eq(advancedFeatureAuditLog.resourceId, resourceId)
      ))
      .orderBy(desc(advancedFeatureAuditLog.timestamp));
  }

  // =====================================
  // Additional Facial Recognition Storage Methods - GDPR Compliant
  // =====================================

  // Alias methods for facial recognition service compatibility
  async storeFaceTemplate(template: InsertFaceTemplate): Promise<FaceTemplate> {
    return await this.createFaceTemplate(template);
  }

  async getActiveWatchlistEntries(storeId: string): Promise<WatchlistEntry[]> {
    return await this.getActiveWatchlistEntriesByStore(storeId);
  }

  async logAdvancedFeatureAudit(log: InsertAdvancedFeatureAuditLog): Promise<AdvancedFeatureAuditLog> {
    return await this.createAdvancedFeatureAuditLog(log);
  }

  // Enhanced facial recognition methods for privacy compliance
  async getFaceTemplatesByPerson(personId: string, storeId: string): Promise<FaceTemplate[]> {
    return await db
      .select()
      .from(faceTemplates)
      .where(and(
        eq(faceTemplates.storeId, storeId),
        sql`JSON_EXTRACT(${faceTemplates.justification}, '$.personId') = ${personId}`
      ))
      .orderBy(desc(faceTemplates.createdAt));
  }

  async getExpiredFaceTemplates(expiredBefore: Date): Promise<FaceTemplate[]> {
    return await db
      .select()
      .from(faceTemplates)
      .where(sql`${faceTemplates.retentionExpiry} <= ${expiredBefore}`)
      .orderBy(desc(faceTemplates.retentionExpiry));
  }

  async deleteFaceTemplatesByPerson(personId: string, storeId: string): Promise<number> {
    const result = await db
      .delete(faceTemplates)
      .where(and(
        eq(faceTemplates.storeId, storeId),
        sql`JSON_EXTRACT(${faceTemplates.justification}, '$.personId') = ${personId}`
      ));
    return result.rowCount || 0;
  }

  async getWatchlistEntriesByPerson(personId: string, storeId: string): Promise<WatchlistEntry[]> {
    return await db
      .select()
      .from(watchlistEntries)
      .where(and(
        eq(watchlistEntries.storeId, storeId),
        eq(watchlistEntries.personId, personId)
      ))
      .orderBy(desc(watchlistEntries.createdAt));
  }

  async deleteWatchlistEntriesByPerson(personId: string, storeId: string): Promise<number> {
    const result = await db
      .delete(watchlistEntries)
      .where(and(
        eq(watchlistEntries.storeId, storeId),
        eq(watchlistEntries.personId, personId)
      ));
    return result.rowCount || 0;
  }

  // Enhanced consent management methods for GDPR compliance
  async getConsentHistoryByPerson(personId: string, storeId: string): Promise<ConsentPreference[]> {
    return await db
      .select()
      .from(consentPreferences)
      .where(and(
        eq(consentPreferences.storeId, storeId),
        eq(consentPreferences.personId, personId)
      ))
      .orderBy(desc(consentPreferences.consentDate));
  }

  // Overloaded updateConsentPreference method for different signature compatibility
  async updateConsentPreferenceByType(storeId: string, consentType: string, updates: Partial<InsertConsentPreference>): Promise<ConsentPreference> {
    // Find the most recent consent record for this type
    const existingConsent = await db
      .select()
      .from(consentPreferences)
      .where(and(
        eq(consentPreferences.storeId, storeId),
        eq(consentPreferences.consentType, consentType)
      ))
      .orderBy(desc(consentPreferences.consentDate))
      .limit(1);

    if (existingConsent.length === 0) {
      throw new Error('No consent record found to update');
    }

    const [updated] = await db
      .update(consentPreferences)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(consentPreferences.id, existingConsent[0].id))
      .returning();
    return updated;
  }

  // Facial recognition events management
  async createFacialRecognitionEvent(event: InsertFacialRecognition): Promise<FacialRecognition> {
    const [newEvent] = await db.insert(facialRecognition).values([event]).returning();
    return newEvent;
  }

  async getFacialRecognitionEventsSummary(personId: string, storeId: string): Promise<{
    count: number;
    dateRange: { earliest?: Date; latest?: Date };
  }> {
    const result = await db
      .select({
        count: sql`count(*)`,
        earliest: sql`min(${facialRecognition.detectionTimestamp})`,
        latest: sql`max(${facialRecognition.detectionTimestamp})`
      })
      .from(facialRecognition)
      .where(and(
        eq(facialRecognition.storeId, storeId),
        sql`JSON_EXTRACT(${facialRecognition.faceAttributes}, '$.personId') = ${personId}`
      ));

    const summary = result[0];
    return {
      count: Number(summary.count) || 0,
      dateRange: {
        earliest: summary.earliest ? new Date(summary.earliest) : undefined,
        latest: summary.latest ? new Date(summary.latest) : undefined
      }
    };
  }

  async deleteFacialRecognitionEventsByPerson(personId: string, storeId: string): Promise<number> {
    const result = await db
      .delete(facialRecognition)
      .where(and(
        eq(facialRecognition.storeId, storeId),
        sql`JSON_EXTRACT(${facialRecognition.faceAttributes}, '$.personId') = ${personId}`
      ));
    return result.rowCount || 0;
  }

  async cleanupOrphanedFacialRecognitionEvents(): Promise<void> {
    // Delete facial recognition events where the referenced face template no longer exists
    await db
      .delete(facialRecognition)
      .where(sql`NOT EXISTS (
        SELECT 1 FROM ${faceTemplates} 
        WHERE ${faceTemplates.id} = ${facialRecognition.id}
      )`);
  }

  // Privacy requests management for GDPR compliance
  async createPrivacyRequest(request: any): Promise<any> {
    // For now, store in a simple JSON structure in advanced feature audit log
    // In production, this would be a dedicated privacy_requests table
    const auditLog = await this.createAdvancedFeatureAuditLog({
      id: request.id,
      userId: request.requesterId,
      storeId: request.storeId,
      featureType: 'privacy_request',
      action: request.requestType,
      resourceType: 'privacy_request',
      resourceId: request.id,
      outcome: 'pending',
      details: request,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
      timestamp: request.requestDate
    });
    
    return request;
  }

  async updatePrivacyRequest(id: string, request: any): Promise<any> {
    // Update the audit log entry for this privacy request
    await this.createAdvancedFeatureAuditLog({
      id: `${id}-update-${Date.now()}`,
      userId: request.requesterId,
      storeId: request.storeId,
      featureType: 'privacy_request',
      action: 'update_request',
      resourceType: 'privacy_request',
      resourceId: id,
      outcome: request.status === 'completed' ? 'success' : 'pending',
      details: request,
      timestamp: new Date()
    });
    
    return request;
  }

  async getPrivacyRequest(id: string): Promise<any | null> {
    // Retrieve from audit log
    const logs = await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(
        eq(advancedFeatureAuditLog.featureType, 'privacy_request'),
        eq(advancedFeatureAuditLog.resourceId, id)
      ))
      .orderBy(desc(advancedFeatureAuditLog.timestamp))
      .limit(1);
    
    return logs.length > 0 ? logs[0].details : null;
  }

  async getPrivacyRequestsByPerson(personId: string): Promise<any[]> {
    // Retrieve all privacy requests for a person from audit log
    const logs = await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(
        eq(advancedFeatureAuditLog.featureType, 'privacy_request'),
        sql`JSON_EXTRACT(${advancedFeatureAuditLog.details}, '$.personId') = ${personId}`
      ))
      .orderBy(desc(advancedFeatureAuditLog.timestamp));
    
    return logs.map(log => log.details);
  }

  // Facial recognition audit trail
  async getFacialRecognitionAuditTrail(personId: string, storeId: string): Promise<AdvancedFeatureAuditLog[]> {
    return await db
      .select()
      .from(advancedFeatureAuditLog)
      .where(and(
        eq(advancedFeatureAuditLog.storeId, storeId),
        eq(advancedFeatureAuditLog.featureType, 'facial_recognition'),
        sql`JSON_EXTRACT(${advancedFeatureAuditLog.details}, '$.personId') = ${personId}`
      ))
      .orderBy(desc(advancedFeatureAuditLog.timestamp));
  }

  // Missing Predictive Analytics Storage Methods
  async getLatestRiskAssessment(storeId: string): Promise<RiskAssessment | null> {
    const result = await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.storeId, storeId))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async getLatestSeasonalAnalysis(timespan: string): Promise<SeasonalAnalysis | null> {
    const result = await db
      .select()
      .from(seasonalAnalyses)
      .where(eq(seasonalAnalyses.timespan, timespan))
      .orderBy(desc(seasonalAnalyses.createdAt))
      .limit(1);
    return result[0] || null;
  }

  async getActiveStaffingRecommendations(storeId: string): Promise<StaffingRecommendation[]> {
    return await db
      .select()
      .from(staffingRecommendations)
      .where(and(
        eq(staffingRecommendations.storeId, storeId),
        eq(staffingRecommendations.isActive, true)
      ))
      .orderBy(desc(staffingRecommendations.createdAt));
  }

  async getIncidentForecastsByStore(storeId: string, limit: number = 5): Promise<IncidentForecast[]> {
    return await db
      .select()
      .from(incidentForecasts)
      .where(eq(incidentForecasts.storeId, storeId))
      .orderBy(desc(incidentForecasts.createdAt))
      .limit(limit);
  }

  async getAllModelPerformance(modelType?: string): Promise<PredictiveModelPerformance[]> {
    const query = db.select().from(predictiveModelPerformance);
    if (modelType) {
      return await query.where(eq(predictiveModelPerformance.modelType, modelType));
    }
    return await query.orderBy(desc(predictiveModelPerformance.evaluatedAt));
  }

  async getLatestModelPerformance(modelName: string): Promise<PredictiveModelPerformance | null> {
    const result = await db
      .select()
      .from(predictiveModelPerformance)
      .where(eq(predictiveModelPerformance.modelName, modelName))
      .orderBy(desc(predictiveModelPerformance.evaluatedAt))
      .limit(1);
    return result[0] || null;
  }

  // =====================================
  // Predictive Analytics - Risk Assessments Implementation
  // =====================================

  async createRiskAssessment(assessment: InsertRiskAssessment): Promise<RiskAssessment> {
    const assessmentData = {
      ...assessment,
      contributingFactors: assessment.contributingFactors || {}
    };
    const [newAssessment] = await db.insert(riskAssessments).values([assessmentData]).returning();
    return newAssessment;
  }

  async getRiskAssessment(id: string): Promise<RiskAssessment | null> {
    const result = await db.select().from(riskAssessments).where(eq(riskAssessments.id, id)).limit(1);
    return result[0] || null;
  }

  async getRiskAssessmentsByStore(storeId: string, limit: number = 10): Promise<RiskAssessment[]> {
    return await db
      .select()
      .from(riskAssessments)
      .where(eq(riskAssessments.storeId, storeId))
      .orderBy(desc(riskAssessments.createdAt))
      .limit(limit);
  }

  async updateRiskAssessment(id: string, updates: Partial<InsertRiskAssessment>): Promise<RiskAssessment> {
    const updateData = {
      ...updates,
      contributingFactors: updates.contributingFactors || {},
      updatedAt: new Date()
    };
    const [updated] = await db
      .update(riskAssessments)
      .set(updateData)
      .where(eq(riskAssessments.id, id))
      .returning();
    return updated;
  }

  async deleteRiskAssessment(id: string): Promise<void> {
    await db.delete(riskAssessments).where(eq(riskAssessments.id, id));
  }

  // =====================================
  // Predictive Analytics - Seasonal Analyses Implementation
  // =====================================

  async createSeasonalAnalysis(analysis: InsertSeasonalAnalysis): Promise<SeasonalAnalysis> {
    const analysisData = {
      ...analysis,
      patterns: analysis.patterns || {},
      storesAnalyzed: analysis.storesAnalyzed || []
    };
    const [newAnalysis] = await db.insert(seasonalAnalyses).values([analysisData]).returning();
    return newAnalysis;
  }

  async getSeasonalAnalysis(id: string): Promise<SeasonalAnalysis | null> {
    const result = await db.select().from(seasonalAnalyses).where(eq(seasonalAnalyses.id, id)).limit(1);
    return result[0] || null;
  }

  async getSeasonalAnalysesByTimespan(timespan: string, limit: number = 10): Promise<SeasonalAnalysis[]> {
    return await db
      .select()
      .from(seasonalAnalyses)
      .where(eq(seasonalAnalyses.timespan, timespan))
      .orderBy(desc(seasonalAnalyses.createdAt))
      .limit(limit);
  }

  async updateSeasonalAnalysis(id: string, updates: Partial<InsertSeasonalAnalysis>): Promise<SeasonalAnalysis> {
    const updateData = {
      ...updates,
      patterns: updates.patterns || {},
      storesAnalyzed: updates.storesAnalyzed || [],
      updatedAt: new Date()
    };
    const [updated] = await db
      .update(seasonalAnalyses)
      .set(updateData)
      .where(eq(seasonalAnalyses.id, id))
      .returning();
    return updated;
  }

  async deleteSeasonalAnalysis(id: string): Promise<void> {
    await db.delete(seasonalAnalyses).where(eq(seasonalAnalyses.id, id));
  }

  // =====================================
  // Predictive Analytics - Staffing Recommendations Implementation
  // =====================================

  async createStaffingRecommendation(recommendation: InsertStaffingRecommendation): Promise<StaffingRecommendation> {
    const recommendationData = {
      ...recommendation,
      recommendation: recommendation.recommendation || {},
      constraints: recommendation.constraints || {}
    };
    const [newRecommendation] = await db.insert(staffingRecommendations).values([recommendationData]).returning();
    return newRecommendation;
  }

  async deleteStaffingRecommendation(id: string): Promise<void> {
    await db.delete(staffingRecommendations).where(eq(staffingRecommendations.id, id));
  }

  // =====================================
  // Predictive Analytics - Incident Forecasts Implementation
  // =====================================

  async createIncidentForecast(forecast: InsertIncidentForecast): Promise<IncidentForecast> {
    const forecastData = {
      ...forecast,
      predictions: forecast.predictions || [],
      factors: forecast.factors || {}
    };
    const [newForecast] = await db.insert(incidentForecasts).values([forecastData]).returning();
    return newForecast;
  }

  async getIncidentForecast(id: string): Promise<IncidentForecast | null> {
    const result = await db.select().from(incidentForecasts).where(eq(incidentForecasts.id, id)).limit(1);
    return result[0] || null;
  }

  async getActiveIncidentForecasts(storeId: string): Promise<IncidentForecast[]> {
    const now = new Date();
    return await db
      .select()
      .from(incidentForecasts)
      .where(and(
        eq(incidentForecasts.storeId, storeId),
        sql`${incidentForecasts.validFrom} <= ${now}`,
        sql`${incidentForecasts.validTo} > ${now}`
      ))
      .orderBy(desc(incidentForecasts.createdAt));
  }

  async getIncidentForecastsByDateRange(storeId: string, startDate: Date, endDate: Date): Promise<IncidentForecast[]> {
    return await db
      .select()
      .from(incidentForecasts)
      .where(and(
        eq(incidentForecasts.storeId, storeId),
        sql`${incidentForecasts.validFrom} >= ${startDate}`,
        sql`${incidentForecasts.validTo} <= ${endDate}`
      ))
      .orderBy(desc(incidentForecasts.createdAt));
  }

  async updateIncidentForecast(id: string, updates: Partial<InsertIncidentForecast>): Promise<IncidentForecast> {
    const updateData = {
      ...updates,
      predictions: updates.predictions || [],
      factors: updates.factors || {},
      updatedAt: new Date()
    };
    const [updated] = await db
      .update(incidentForecasts)
      .set(updateData)
      .where(eq(incidentForecasts.id, id))
      .returning();
    return updated;
  }

  async deleteIncidentForecast(id: string): Promise<void> {
    await db.delete(incidentForecasts).where(eq(incidentForecasts.id, id));
  }

  // =====================================
  // Predictive Analytics - Model Performance Implementation
  // =====================================

  async createPredictiveModelPerformance(performance: InsertPredictiveModelPerformance): Promise<PredictiveModelPerformance> {
    const performanceData = {
      ...performance,
      accuracyMetrics: performance.accuracyMetrics || {},
      performanceData: performance.performanceData || {}
    };
    const [newPerformance] = await db.insert(predictiveModelPerformance).values([performanceData]).returning();
    return newPerformance;
  }

  async getPredictiveModelPerformance(id: string): Promise<PredictiveModelPerformance | null> {
    const result = await db.select().from(predictiveModelPerformance).where(eq(predictiveModelPerformance.id, id)).limit(1);
    return result[0] || null;
  }

  async getPredictiveModelPerformanceByModel(modelName: string, modelVersion?: string): Promise<PredictiveModelPerformance[]> {
    const conditions = [eq(predictiveModelPerformance.modelName, modelName)];
    if (modelVersion) {
      conditions.push(eq(predictiveModelPerformance.modelVersion, modelVersion));
    }
    return await db
      .select()
      .from(predictiveModelPerformance)
      .where(and(...conditions))
      .orderBy(desc(predictiveModelPerformance.evaluatedAt));
  }

  async updatePredictiveModelPerformance(id: string, updates: Partial<InsertPredictiveModelPerformance>): Promise<PredictiveModelPerformance> {
    const updateData = {
      ...updates,
      accuracyMetrics: updates.accuracyMetrics || {},
      performanceData: updates.performanceData || {},
      updatedAt: new Date()
    };
    const [updated] = await db
      .update(predictiveModelPerformance)
      .set(updateData)
      .where(eq(predictiveModelPerformance.id, id))
      .returning();
    return updated;
  }

  async deleteModelPerformance(id: string): Promise<void> {
    await db.delete(predictiveModelPerformance).where(eq(predictiveModelPerformance.id, id));
  }

  // Additional Missing Storage Methods for Routes
  async getStaffingRecommendation(id: string): Promise<StaffingRecommendation | null> {
    const result = await db
      .select()
      .from(staffingRecommendations)
      .where(eq(staffingRecommendations.id, id))
      .limit(1);
    return result[0] || null;
  }

  async updateStaffingRecommendation(id: string, updates: Partial<InsertStaffingRecommendation>): Promise<StaffingRecommendation> {
    const [updated] = await db
      .update(staffingRecommendations)
      .set(updates)
      .where(eq(staffingRecommendations.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
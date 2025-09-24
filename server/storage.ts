// Penny MVP Storage Layer - Based on javascript_auth_all_persistance integration
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { Pool } from "@neondatabase/serverless";
import {
  users,
  stores,
  alerts,
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
} from "@shared/schema";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store
const sessionPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

  // Enhanced Alert & Detection System
  createAlert(alert: InsertAlert): Promise<Alert>;
  getAlert(id: string): Promise<Alert | null>;
  getAlertsByStore(storeId: string, limit?: number): Promise<Alert[]>;
  getActiveAlerts(storeId?: string): Promise<Alert[]>;
  getAlertsByPriority(storeId: string, priority: string): Promise<Alert[]>;
  getAlertsByStatus(storeId: string, status: string): Promise<Alert[]>;
  getAssignedAlerts(userId: string): Promise<Alert[]>;
  updateAlert(id: string, updates: Partial<InsertAlert>): Promise<Alert>;
  assignAlert(id: string, userId: string): Promise<Alert | null>;
  acknowledgeAlert(id: string, userId: string): Promise<Alert | null>;
  resolveAlert(id: string, userId: string): Promise<Alert | null>;
  escalateAlert(id: string, reason: string): Promise<Alert | null>;
  getPendingReviewAlerts(): Promise<Alert[]>; // For Penny Ops Dashboard
  deleteAlert(id: string): Promise<boolean>;
  
  // Camera Management
  getCamerasByStore(storeId: string): Promise<Camera[]>;
  getCameraById(id: string): Promise<Camera | null>;
  getCamerasByStatus(storeId: string, status: string): Promise<Camera[]>;
  createCamera(camera: InsertCamera): Promise<Camera>;
  updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null>;
  updateCameraStatus(id: string, status: string): Promise<Camera | null>;
  updateCameraHeartbeat(id: string): Promise<Camera | null>;
  deleteCamera(id: string): Promise<boolean>;
  
  // Incident Management  
  getIncidentsByStore(storeId: string): Promise<Incident[]>;
  getIncidentById(id: string): Promise<Incident | null>;
  getIncidentsByStatus(storeId: string, status: string): Promise<Incident[]>;
  getIncidentsByOffender(offenderId: string): Promise<Incident[]>;
  createIncident(incident: InsertIncident): Promise<Incident>;
  updateIncident(id: string, updates: Partial<Incident>): Promise<Incident | null>;
  assignIncident(id: string, userId: string): Promise<Incident | null>;
  addEvidenceToIncident(id: string, evidenceFiles: string[]): Promise<Incident | null>;
  addWitnessAccount(id: string, witness: { name: string; contact: string; statement: string }): Promise<Incident | null>;
  resolveIncident(id: string, userId: string): Promise<Incident | null>;
  deleteIncident(id: string): Promise<boolean>;

  // Offender Management
  createOffender(offender: InsertOffender): Promise<Offender>;
  getOffender(id: string): Promise<Offender | null>;
  getOffendersByStore(storeId: string): Promise<Offender[]>;
  getNetworkOffenders(excludeStoreId?: string): Promise<Offender[]>;
  updateOffender(id: string, updates: Partial<InsertOffender>): Promise<Offender>;
  linkOffenderToUser(offenderId: string, userId: string): Promise<Offender>;

  // Theft & Evidence Management
  createTheft(theft: InsertTheft): Promise<Theft>;
  getTheft(id: string): Promise<Theft | null>;

  // Video Analysis Management
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
  getTheftsByOffender(offenderId: string): Promise<Theft[]>;
  getTheftsByStore(storeId: string): Promise<Theft[]>;
  updateTheft(id: string, updates: Partial<InsertTheft>): Promise<Theft>;
  confirmTheft(id: string, confirmedBy: string): Promise<Theft>;

  // Payment & Commission System
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

  // Sales Metrics (for Sales Agent Dashboard) - with organization scoping
  getSalesMetrics(organizationId?: string): Promise<{
    totalSales: number;
    avgDealSize: number;
    conversionRate: number;
    pipelineValue: number;
    activeLeads: number;
  }>;
  getRecentCompletedPayments(limit?: number, organizationId?: string): Promise<Array<DebtPayment & { offenderName?: string; storeName?: string }>>;
  getPaymentsInLast30Days(organizationId?: string): Promise<DebtPayment[]>;

  // Operations Agent Dashboard Methods - with organization scoping
  getOperationsMetrics(organizationId?: string): Promise<{
    systemUptime: number;
    avgResponseTime: number;
    totalProcesses: number;
    activeProcesses: number;
    completedTasks: number;
    failedTasks: number;
    infrastructureHealth: number;
    recentIncidents: number;
    efficiencyRate: number;
  }>;
  
  // System Metrics Management
  createSystemMetric(metric: InsertSystemMetric): Promise<SystemMetric>;
  getSystemMetrics(organizationId: string, metricType?: string): Promise<SystemMetric[]>;
  getLatestSystemMetrics(organizationId: string): Promise<SystemMetric[]>;
  updateSystemMetric(id: string, updates: Partial<InsertSystemMetric>): Promise<SystemMetric>;
  
  // Process Management
  createProcess(process: InsertProcess): Promise<Process>;
  getProcess(id: string): Promise<Process | null>;
  getProcessesByOrganization(organizationId: string): Promise<Process[]>;
  getProcessesByStatus(organizationId: string, status: string): Promise<Process[]>;
  getActiveProcesses(organizationId: string): Promise<Process[]>;
  updateProcess(id: string, updates: Partial<InsertProcess>): Promise<Process>;
  startProcess(id: string, userId: string): Promise<Process>;
  completeProcess(id: string, userId: string, results?: any): Promise<Process>;
  
  // Infrastructure Monitoring
  createInfrastructureComponent(component: InsertInfrastructureComponent): Promise<InfrastructureComponent>;
  getInfrastructureComponent(id: string): Promise<InfrastructureComponent | null>;
  getInfrastructureComponentsByOrganization(organizationId: string): Promise<InfrastructureComponent[]>;
  getInfrastructureComponentsByStatus(organizationId: string, status: string): Promise<InfrastructureComponent[]>;
  updateInfrastructureComponent(id: string, updates: Partial<InsertInfrastructureComponent>): Promise<InfrastructureComponent>;
  
  // Operational Incidents Management
  createOperationalIncident(incident: InsertOperationalIncident): Promise<OperationalIncident>;
  getOperationalIncident(id: string): Promise<OperationalIncident | null>;
  getOperationalIncidentsByOrganization(organizationId: string): Promise<OperationalIncident[]>;
  getOperationalIncidentsByStatus(organizationId: string, status: string): Promise<OperationalIncident[]>;
  getRecentOperationalIncidents(organizationId: string, limit?: number): Promise<OperationalIncident[]>;
  updateOperationalIncident(id: string, updates: Partial<InsertOperationalIncident>): Promise<OperationalIncident>;
  resolveOperationalIncident(id: string, userId: string, resolution: string): Promise<OperationalIncident>;

  // Multi-Agent Platform Management
  // Organizations
  createOrganization(org: InsertOrganization): Promise<Organization>;
  getOrganization(id: string): Promise<Organization | null>;
  updateOrganization(id: string, updates: Partial<InsertOrganization>): Promise<Organization>;
  
  // Agents
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

  // HR Agent Dashboard Methods - with organization scoping
  getHRMetrics(organizationId?: string): Promise<{
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
  }>;

  // Department Management
  createDepartment(department: InsertDepartment): Promise<Department>;
  getDepartment(id: string): Promise<Department | null>;
  getDepartmentsByOrganization(organizationId: string): Promise<Department[]>;
  updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department>;
  deleteDepartment(id: string): Promise<boolean>;

  // Employee Management
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  getEmployee(id: string): Promise<Employee | null>;
  getEmployeesByOrganization(organizationId: string): Promise<Employee[]>;
  getEmployeesByDepartment(departmentId: string): Promise<Employee[]>;
  getEmployeesByStatus(organizationId: string, status: string): Promise<Employee[]>;
  getEmployeesByManager(managerId: string): Promise<Employee[]>;
  updateEmployee(id: string, updates: Partial<InsertEmployee>): Promise<Employee>;
  deactivateEmployee(id: string): Promise<Employee>;

  // Performance Management
  createPerformanceReview(review: InsertPerformanceReview): Promise<PerformanceReview>;
  getPerformanceReview(id: string): Promise<PerformanceReview | null>;
  getPerformanceReviewsByEmployee(employeeId: string): Promise<PerformanceReview[]>;
  getPerformanceReviewsByOrganization(organizationId: string): Promise<PerformanceReview[]>;
  getPendingPerformanceReviews(organizationId: string): Promise<PerformanceReview[]>;
  updatePerformanceReview(id: string, updates: Partial<InsertPerformanceReview>): Promise<PerformanceReview>;
  submitPerformanceReview(id: string, userId: string): Promise<PerformanceReview>;

  createPerformanceGoal(goal: InsertPerformanceGoal): Promise<PerformanceGoal>;
  getPerformanceGoal(id: string): Promise<PerformanceGoal | null>;
  getPerformanceGoalsByEmployee(employeeId: string): Promise<PerformanceGoal[]>;
  getPerformanceGoalsByOrganization(organizationId: string): Promise<PerformanceGoal[]>;
  updatePerformanceGoal(id: string, updates: Partial<InsertPerformanceGoal>): Promise<PerformanceGoal>;
  completePerformanceGoal(id: string, userId: string): Promise<PerformanceGoal>;

  // Recruitment Management
  createRecruitmentJob(job: InsertRecruitmentJob): Promise<RecruitmentJob>;
  getRecruitmentJob(id: string): Promise<RecruitmentJob | null>;
  getRecruitmentJobsByOrganization(organizationId: string): Promise<RecruitmentJob[]>;
  getActiveRecruitmentJobs(organizationId: string): Promise<RecruitmentJob[]>;
  updateRecruitmentJob(id: string, updates: Partial<InsertRecruitmentJob>): Promise<RecruitmentJob>;
  closeRecruitmentJob(id: string, userId: string): Promise<RecruitmentJob>;

  createRecruitmentCandidate(candidate: InsertRecruitmentCandidate): Promise<RecruitmentCandidate>;
  getRecruitmentCandidate(id: string): Promise<RecruitmentCandidate | null>;
  getRecruitmentCandidatesByJob(jobId: string): Promise<RecruitmentCandidate[]>;
  getRecruitmentCandidatesByOrganization(organizationId: string): Promise<RecruitmentCandidate[]>;
  updateRecruitmentCandidate(id: string, updates: Partial<InsertRecruitmentCandidate>): Promise<RecruitmentCandidate>;
  moveRecruitmentCandidateToStage(id: string, stage: string): Promise<RecruitmentCandidate>;

  // Training Management
  createTrainingProgram(program: InsertTrainingProgram): Promise<TrainingProgram>;
  getTrainingProgram(id: string): Promise<TrainingProgram | null>;
  getTrainingProgramsByOrganization(organizationId: string): Promise<TrainingProgram[]>;
  getActiveTrainingPrograms(organizationId: string): Promise<TrainingProgram[]>;
  updateTrainingProgram(id: string, updates: Partial<InsertTrainingProgram>): Promise<TrainingProgram>;

  createTrainingCompletion(completion: InsertTrainingCompletion): Promise<TrainingCompletion>;
  getTrainingCompletion(id: string): Promise<TrainingCompletion | null>;
  getTrainingCompletionsByEmployee(employeeId: string): Promise<TrainingCompletion[]>;
  getTrainingCompletionsByProgram(programId: string): Promise<TrainingCompletion[]>;
  getTrainingCompletionsByOrganization(organizationId: string): Promise<TrainingCompletion[]>;
  updateTrainingCompletion(id: string, updates: Partial<InsertTrainingCompletion>): Promise<TrainingCompletion>;
  completeTraining(id: string, score?: number, feedback?: any): Promise<TrainingCompletion>;

  // Engagement & Survey Management
  createEngagementSurvey(survey: InsertEngagementSurvey): Promise<EngagementSurvey>;
  getEngagementSurvey(id: string): Promise<EngagementSurvey | null>;
  getEngagementSurveysByOrganization(organizationId: string): Promise<EngagementSurvey[]>;
  getActiveEngagementSurveys(organizationId: string): Promise<EngagementSurvey[]>;
  updateEngagementSurvey(id: string, updates: Partial<InsertEngagementSurvey>): Promise<EngagementSurvey>;

  createSurveyResponse(response: InsertSurveyResponse): Promise<SurveyResponse>;
  getSurveyResponse(id: string): Promise<SurveyResponse | null>;
  getSurveyResponsesBySurvey(surveyId: string): Promise<SurveyResponse[]>;
  getSurveyResponsesByEmployee(employeeId: string): Promise<SurveyResponse[]>;

  // HR Analytics & Metrics
  createHrMetric(metric: InsertHrMetric): Promise<HrMetric>;
  getHrMetric(id: string): Promise<HrMetric | null>;
  getHrMetricsByOrganization(organizationId: string, metricType?: string): Promise<HrMetric[]>;
  getLatestHrMetrics(organizationId: string): Promise<HrMetric[]>;
  updateHrMetric(id: string, updates: Partial<InsertHrMetric>): Promise<HrMetric>;

  // =====================================
  // AI Video Analytics Management
  // =====================================
  // AI Detections
  createAiDetection(detection: InsertAiDetection): Promise<AiDetection>;
  getAiDetection(id: string): Promise<AiDetection | null>;
  getAiDetectionsByStore(storeId: string, limit?: number): Promise<AiDetection[]>;
  getAiDetectionsByCamera(cameraId: string, limit?: number): Promise<AiDetection[]>;
  getAiDetectionsByType(storeId: string, detectionType: string): Promise<AiDetection[]>;
  getAiDetectionsByConfidence(storeId: string, minConfidence: number): Promise<AiDetection[]>;
  updateAiDetection(id: string, updates: Partial<InsertAiDetection>): Promise<AiDetection>;
  verifyAiDetection(id: string, userId: string, isVerified: boolean): Promise<AiDetection>;
  markFalsePositive(id: string, userId: string, reason: string): Promise<AiDetection>;

  // Video Analytics
  createVideoAnalytics(analytics: InsertVideoAnalytics): Promise<VideoAnalytics>;
  getVideoAnalytics(id: string): Promise<VideoAnalytics | null>;
  getVideoAnalyticsByStore(storeId: string, limit?: number): Promise<VideoAnalytics[]>;
  getVideoAnalyticsByCamera(cameraId: string, limit?: number): Promise<VideoAnalytics[]>;
  getVideoAnalyticsByStatus(storeId: string, status: string): Promise<VideoAnalytics[]>;
  updateVideoAnalytics(id: string, updates: Partial<InsertVideoAnalytics>): Promise<VideoAnalytics>;
  markVideoAnalyticsCompleted(id: string, results: any): Promise<VideoAnalytics>;

  // Behavior Patterns
  createBehaviorPattern(pattern: InsertBehaviorPattern): Promise<BehaviorPattern>;
  getBehaviorPattern(id: string): Promise<BehaviorPattern | null>;
  getBehaviorPatternsByStore(storeId: string): Promise<BehaviorPattern[]>;
  getBehaviorPatternsByType(storeId: string, patternType: string): Promise<BehaviorPattern[]>;
  getActiveBehaviorPatterns(storeId: string): Promise<BehaviorPattern[]>;
  updateBehaviorPattern(id: string, updates: Partial<InsertBehaviorPattern>): Promise<BehaviorPattern>;
  validateBehaviorPattern(id: string, userId: string): Promise<BehaviorPattern>;

  // Facial Recognition
  createFacialRecognition(recognition: InsertFacialRecognition): Promise<FacialRecognition>;
  getFacialRecognition(id: string): Promise<FacialRecognition | null>;
  getFacialRecognitionsByStore(storeId: string, limit?: number): Promise<FacialRecognition[]>;
  getFacialRecognitionsByCamera(cameraId: string, limit?: number): Promise<FacialRecognition[]>;
  getFacialRecognitionsByOffender(offenderId: string): Promise<FacialRecognition[]>;
  updateFacialRecognition(id: string, updates: Partial<InsertFacialRecognition>): Promise<FacialRecognition>;
  verifyFacialRecognition(id: string, userId: string, isVerified: boolean): Promise<FacialRecognition>;

  // =====================================
  // Enhanced Camera Management
  // =====================================
  // Camera Zones
  createCameraZone(zone: InsertCameraZone): Promise<CameraZone>;
  getCameraZone(id: string): Promise<CameraZone | null>;
  getCameraZonesByCamera(cameraId: string): Promise<CameraZone[]>;
  getCameraZonesByStore(storeId: string): Promise<CameraZone[]>;
  getCameraZonesByType(cameraId: string, zoneType: string): Promise<CameraZone[]>;
  updateCameraZone(id: string, updates: Partial<InsertCameraZone>): Promise<CameraZone>;
  activateCameraZone(id: string): Promise<CameraZone>;
  deactivateCameraZone(id: string): Promise<CameraZone>;

  // Camera Schedules
  createCameraSchedule(schedule: InsertCameraSchedule): Promise<CameraSchedule>;
  getCameraSchedule(id: string): Promise<CameraSchedule | null>;
  getCameraSchedulesByCamera(cameraId: string): Promise<CameraSchedule[]>;
  getCameraSchedulesByStore(storeId: string): Promise<CameraSchedule[]>;
  getCameraSchedulesByType(cameraId: string, scheduleType: string): Promise<CameraSchedule[]>;
  updateCameraSchedule(id: string, updates: Partial<InsertCameraSchedule>): Promise<CameraSchedule>;
  getActiveCameraSchedules(cameraId: string): Promise<CameraSchedule[]>;

  // Camera Presets
  createCameraPreset(preset: InsertCameraPreset): Promise<CameraPreset>;
  getCameraPreset(id: string): Promise<CameraPreset | null>;
  getCameraPresetsByCamera(cameraId: string): Promise<CameraPreset[]>;
  getCameraPresetsByStore(storeId: string): Promise<CameraPreset[]>;
  getCameraPresetsByScenario(cameraId: string, scenario: string): Promise<CameraPreset[]>;
  updateCameraPreset(id: string, updates: Partial<InsertCameraPreset>): Promise<CameraPreset>;
  activateCameraPreset(id: string): Promise<CameraPreset>;

  // =====================================
  // Real-Time Detection & Alerts
  // =====================================
  // Threat Classifications
  createThreatClassification(classification: InsertThreatClassification): Promise<ThreatClassification>;
  getThreatClassification(id: string): Promise<ThreatClassification | null>;
  getThreatClassificationsByStore(storeId: string): Promise<ThreatClassification[]>;
  getThreatClassificationsByOrganization(organizationId: string): Promise<ThreatClassification[]>;
  getThreatClassificationsByCategory(category: string): Promise<ThreatClassification[]>;
  updateThreatClassification(id: string, updates: Partial<InsertThreatClassification>): Promise<ThreatClassification>;
  getActiveThreatClassifications(storeId?: string): Promise<ThreatClassification[]>;

  // Alert Rules
  createAlertRule(rule: InsertAlertRule): Promise<AlertRule>;
  getAlertRule(id: string): Promise<AlertRule | null>;
  getAlertRulesByStore(storeId: string): Promise<AlertRule[]>;
  getAlertRulesByOrganization(organizationId: string): Promise<AlertRule[]>;
  getAlertRulesByCamera(cameraId: string): Promise<AlertRule[]>;
  getAlertRulesByType(ruleType: string): Promise<AlertRule[]>;
  updateAlertRule(id: string, updates: Partial<InsertAlertRule>): Promise<AlertRule>;
  getActiveAlertRules(storeId?: string): Promise<AlertRule[]>;
  validateAlertRule(id: string, userId: string): Promise<AlertRule>;

  // Alert Escalation
  createAlertEscalation(escalation: InsertAlertEscalation): Promise<AlertEscalation>;
  getAlertEscalation(id: string): Promise<AlertEscalation | null>;
  getAlertEscalationsByAlert(alertId: string): Promise<AlertEscalation[]>;
  getAlertEscalationsByStore(storeId: string): Promise<AlertEscalation[]>;
  getAlertEscalationsByAssignee(assigneeId: string): Promise<AlertEscalation[]>;
  updateAlertEscalation(id: string, updates: Partial<InsertAlertEscalation>): Promise<AlertEscalation>;
  acknowledgeAlertEscalation(id: string, userId: string): Promise<AlertEscalation>;
  resolveAlertEscalation(id: string, userId: string): Promise<AlertEscalation>;

  // =====================================
  // Advanced Incident Management
  // =====================================
  // Incident Timeline
  createIncidentTimeline(timeline: InsertIncidentTimeline): Promise<IncidentTimeline>;
  getIncidentTimeline(id: string): Promise<IncidentTimeline | null>;
  getIncidentTimelinesByIncident(incidentId: string): Promise<IncidentTimeline[]>;
  getIncidentTimelinesByStore(storeId: string, limit?: number): Promise<IncidentTimeline[]>;
  updateIncidentTimeline(id: string, updates: Partial<InsertIncidentTimeline>): Promise<IncidentTimeline>;
  verifyIncidentTimeline(id: string, userId: string): Promise<IncidentTimeline>;
  disputeIncidentTimeline(id: string, userId: string, reason: string): Promise<IncidentTimeline>;

  // Incident Response
  createIncidentResponse(response: InsertIncidentResponse): Promise<IncidentResponse>;
  getIncidentResponse(id: string): Promise<IncidentResponse | null>;
  getIncidentResponsesByIncident(incidentId: string): Promise<IncidentResponse[]>;
  getIncidentResponsesByStore(storeId: string): Promise<IncidentResponse[]>;
  getIncidentResponsesByResponder(responderId: string): Promise<IncidentResponse[]>;
  updateIncidentResponse(id: string, updates: Partial<InsertIncidentResponse>): Promise<IncidentResponse>;
  completeIncidentResponse(id: string, userId: string): Promise<IncidentResponse>;

  // Evidence Chain
  createEvidenceChain(evidence: InsertEvidenceChain): Promise<EvidenceChain>;
  getEvidenceChain(id: string): Promise<EvidenceChain | null>;
  getEvidenceChainsByIncident(incidentId: string): Promise<EvidenceChain[]>;
  getEvidenceChainsByStore(storeId: string): Promise<EvidenceChain[]>;
  getEvidenceChainsByCustodian(custodianId: string): Promise<EvidenceChain[]>;
  updateEvidenceChain(id: string, updates: Partial<InsertEvidenceChain>): Promise<EvidenceChain>;
  transferEvidenceCustody(id: string, fromUserId: string, toUserId: string, reason: string): Promise<EvidenceChain>;
  verifyEvidenceIntegrity(id: string): Promise<EvidenceChain>;

  // =====================================
  // Analytics & Intelligence
  // =====================================
  // Security Metrics
  createSecurityMetrics(metrics: InsertSecurityMetrics): Promise<SecurityMetrics>;
  getSecurityMetrics(id: string): Promise<SecurityMetrics | null>;
  getSecurityMetricsByStore(storeId: string, metricType?: string): Promise<SecurityMetrics[]>;
  getSecurityMetricsByOrganization(organizationId: string, metricType?: string): Promise<SecurityMetrics[]>;
  getSecurityMetricsByPeriod(storeId: string, periodStart: Date, periodEnd: Date): Promise<SecurityMetrics[]>;
  updateSecurityMetrics(id: string, updates: Partial<InsertSecurityMetrics>): Promise<SecurityMetrics>;
  getLatestSecurityMetrics(storeId: string): Promise<SecurityMetrics[]>;

  // Trend Analysis
  createTrendAnalysis(analysis: InsertTrendAnalysis): Promise<TrendAnalysis>;
  getTrendAnalysis(id: string): Promise<TrendAnalysis | null>;
  getTrendAnalysisByStore(storeId: string, analysisType?: string): Promise<TrendAnalysis[]>;
  getTrendAnalysisByOrganization(organizationId: string, analysisType?: string): Promise<TrendAnalysis[]>;
  getTrendAnalysisBySubject(subject: string): Promise<TrendAnalysis[]>;
  updateTrendAnalysis(id: string, updates: Partial<InsertTrendAnalysis>): Promise<TrendAnalysis>;
  getCompletedTrendAnalysis(storeId?: string): Promise<TrendAnalysis[]>;

  // Network Intelligence
  createNetworkIntelligence(intelligence: InsertNetworkIntelligence): Promise<NetworkIntelligence>;
  getNetworkIntelligence(id: string): Promise<NetworkIntelligence | null>;
  getNetworkIntelligenceByOrganization(organizationId: string): Promise<NetworkIntelligence[]>;
  getNetworkIntelligenceByOffender(networkOffenderId: string): Promise<NetworkIntelligence[]>;
  getNetworkIntelligenceByType(intelligenceType: string): Promise<NetworkIntelligence[]>;
  updateNetworkIntelligence(id: string, updates: Partial<InsertNetworkIntelligence>): Promise<NetworkIntelligence>;
  getActiveNetworkIntelligence(organizationId?: string): Promise<NetworkIntelligence[]>;
  validateNetworkIntelligence(id: string, userId: string): Promise<NetworkIntelligence>;

  // =====================================
  // Role-Based Access Control
  // =====================================
  // Security Roles
  createSecurityRole(role: InsertSecurityRole): Promise<SecurityRole>;
  getSecurityRole(id: string): Promise<SecurityRole | null>;
  getSecurityRolesByOrganization(organizationId: string): Promise<SecurityRole[]>;
  getSecurityRolesByStore(storeId: string): Promise<SecurityRole[]>;
  getSecurityRolesByCategory(category: string): Promise<SecurityRole[]>;
  updateSecurityRole(id: string, updates: Partial<InsertSecurityRole>): Promise<SecurityRole>;
  getActiveSecurityRoles(organizationId?: string): Promise<SecurityRole[]>;
  approveSecurityRole(id: string, userId: string): Promise<SecurityRole>;

  // Access Permissions
  createAccessPermission(permission: InsertAccessPermission): Promise<AccessPermission>;
  getAccessPermission(id: string): Promise<AccessPermission | null>;
  getAccessPermissionsByCode(permissionCode: string): Promise<AccessPermission | null>;
  getAccessPermissionsByCategory(category: string): Promise<AccessPermission[]>;
  getAccessPermissionsByResourceType(resourceType: string): Promise<AccessPermission[]>;
  updateAccessPermission(id: string, updates: Partial<InsertAccessPermission>): Promise<AccessPermission>;
  getActiveAccessPermissions(): Promise<AccessPermission[]>;
  approveAccessPermission(id: string, userId: string): Promise<AccessPermission>;

  // Session store for authentication
  sessionStore: any; // Using any to avoid type issues with session.SessionStore
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
      profile: user.profile as any // Type assertion for JSON field
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
      profile: updates.profile as any // Type assertion for JSON field
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
      agentSettings: store.agentSettings as any // Type assertion for JSON field
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
      agentSettings: updates.agentSettings as any // Type assertion for JSON field
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
      location: alert.location as any, // Type assertion for JSON field
      metadata: alert.metadata as any // Type assertion for JSON field
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
      location: updates.location as any, // Type assertion for JSON field
      metadata: updates.metadata as any // Type assertion for JSON field
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
      aliases: offender.aliases ? Array.from(offender.aliases as string[]) : [],
      physicalDescription: offender.physicalDescription as any,
      behaviorPatterns: offender.behaviorPatterns ? Array.from(offender.behaviorPatterns as string[]) : [],
      thumbnails: offender.thumbnails ? Array.from(offender.thumbnails as string[]) : [],
      confirmedIncidentIds: offender.confirmedIncidentIds ? Array.from(offender.confirmedIncidentIds as string[]) : []
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
    return await db
      .select()
      .from(offenders)
      .innerJoin(thefts, eq(thefts.offenderId, offenders.id))
      .where(eq(thefts.storeId, storeId))
      .groupBy(offenders.id);
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
      physicalDescription: updates.physicalDescription as any,
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
      billingInfo: org.billingInfo as any
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
      billingInfo: updates.billingInfo as any
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
        createdAt: userAgentAccess.createdAt
      })
      .from(userAgentAccess)
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
      settings: config.settings as any // Type assertion for JSON field
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
    return config[0] || null;
  }

  async getOrganizationAgentConfigurations(organizationId: string): Promise<AgentConfiguration[]> {
    return await db
      .select()
      .from(agentConfigurations)
      .where(eq(agentConfigurations.organizationId, organizationId))
      .orderBy(agentConfigurations.createdAt);
  }

  async updateAgentConfiguration(id: string, updates: Partial<InsertAgentConfiguration>): Promise<AgentConfiguration> {
    const updateData = {
      ...updates,
      updatedAt: new Date(),
      settings: updates.settings as any // Type assertion for JSON field
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
      settings: camera.settings as any // Type assertion for JSON field
    };
    const [newCamera] = await db
      .insert(cameras)
      .values([cameraData])
      .returning();
    return newCamera;
  }

  async updateCamera(id: string, updates: Partial<Camera>): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async updateCameraStatus(id: string, status: string): Promise<Camera | null> {
    const [updated] = await db
      .update(cameras)
      .set({ 
        status, 
        lastHeartbeat: new Date(),
        updatedAt: new Date() 
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
        status: "online",
        updatedAt: new Date() 
      })
      .where(eq(cameras.id, id))
      .returning();
    return updated || null;
  }

  async deleteCamera(id: string): Promise<boolean> {
    const result = await db
      .update(cameras)
      .set({ isActive: false, updatedAt: new Date() })
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
      location: incident.location as any, // Type assertion for JSON field
      evidenceFiles: incident.evidenceFiles as any,
      witnessAccounts: incident.witnessAccounts as any,
      metadata: incident.metadata as any // Type assertion for JSON field
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
      metadata: metric.metadata as any, // Type assertion for JSON field
      threshold: metric.threshold as any // Type assertion for JSON field
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
      metadata: updates.metadata as any, // Type assertion for JSON field
      threshold: updates.threshold as any // Type assertion for JSON field
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
      configuration: process.configuration as any, // Type assertion for JSON field
      results: process.results as any // Type assertion for JSON field
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
      configuration: updates.configuration as any, // Type assertion for JSON field
      results: updates.results as any // Type assertion for JSON field
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
    const [newComponent] = await db.insert(infrastructureComponents).values([component]).returning();
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
    const [updated] = await db
      .update(infrastructureComponents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(infrastructureComponents.id, id))
      .returning();
    return updated;
  }

  // Operational Incidents Management
  async createOperationalIncident(incident: InsertOperationalIncident): Promise<OperationalIncident> {
    const [newIncident] = await db.insert(operationalIncidents).values([incident]).returning();
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
    const [updated] = await db
      .update(operationalIncidents)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newEmployee] = await db.insert(employees).values([employee]).returning();
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
    const [updated] = await db
      .update(employees)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newReview] = await db.insert(performanceReviews).values([review]).returning();
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
    const [updated] = await db
      .update(performanceReviews)
      .set({ ...updates, updatedAt: new Date() })
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
    const [newGoal] = await db.insert(performanceGoals).values([goal]).returning();
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
    const [updated] = await db
      .update(performanceGoals)
      .set({ ...updates, updatedAt: new Date() })
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
}

export const storage = new DatabaseStorage();